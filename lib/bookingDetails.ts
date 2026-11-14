import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { auth, db } from './firebase';
import { logError } from './logError';
import { CITY_COORDS } from './jobUtils';
import { cityFromAddress } from './cityFromAddress';

/**
 * The part of a booking that says where the client actually lives.
 *
 * It lives at `bookings/{id}/private/details` rather than on the booking, and
 * the reason is the open board. A job nobody has taken yet has to be readable
 * by cleaners who have not taken it — that is what a board is — and Firestore
 * rules cannot hide one FIELD of a document. So one ordinary client account
 * could list every open job and read a live feed of names, streets, floor and
 * flat numbers, and the window during which each of those homes would be
 * occupied by a stranger.
 *
 * The booking keeps what a cleaner needs in order to decide: city, service,
 * date, time, hours, price. This is everything else.
 */
export interface BookingDetails {
  address?: string;
  addrStreet?: string;
  addrFloor?: string;
  addrApt?: string;
  notes?: string;
  phone?: string;
}

// One attempt per booking per app session, whatever the outcome.
const attempted = new Set<string>();

/** The fields a booking's private half adds to it (see withBookingDetails). */
export const DETAIL_KEYS: (keyof BookingDetails)[] =
  ['address', 'addrStreet', 'addrFloor', 'addrApt', 'notes', 'phone'];


export async function writeBookingDetails(bookingId: string, details: BookingDetails): Promise<void> {
  await setDoc(doc(db, 'bookings', bookingId, 'private', 'details'), details, { merge: true });
  cache.set(bookingId, { ...(cache.get(bookingId) ?? {}), ...details });
}

// One read per booking is the cost of the split, so nothing is fetched twice in
// a page's lifetime. Cleared on reload, which is when a booking could have
// changed hands anyway.
const cache = new Map<string, BookingDetails>();
// When the last read of a booking's private half was refused. Since 9.11.2026
// the cleaner reads it only once the booking is confirmed — and her own
// approval shows on screen (the local copy) before the server has it, so the
// read made at that moment is refused and nothing asks again. A confirmed row
// whose read was refused is asked once more, a moment later.
const deniedAt = new Map<string, number>();
const LIVE_FOR_CLEANER = ['confirmed', 'onway', 'active', 'done'];
const copyWaited = new Set<string>();

export async function fetchBookingDetails(bookingId: string): Promise<BookingDetails> {
  const hit = cache.get(bookingId);
  if (hit) return hit;
  try {
    const snap = await getDoc(doc(db, 'bookings', bookingId, 'private', 'details'));
    if (!snap.exists()) {
      // Not cached. A client's own snapshot fires on the local post before the
      // details are written, and caching that miss hid the address until the
      // app restarted.
      return {};
    }
    const d = snap.data() as BookingDetails;
    cache.set(bookingId, d);
    return d;
  } catch (err) {
    if ((err as { code?: string })?.code === 'permission-denied') deniedAt.set(bookingId, Date.now());
    // Not a party (or offline). The caller renders what it has rather than
    // failing the screen — a missing street is a worse day than a blank one,
    // but a blank list is worse than both.
    logError('bookingDetails/fetch', err);
    return {};
  }
}

// Once per booking per app session.
const phoneBackfilled = new Set<string>();

/**
 * Put the client's phone on their live bookings' private half where it is
 * missing. Run from the CLIENT's own screen, because only the client may write
 * their details once a booking exists.
 *
 * The cleaner reads it from there ("on my way", the payment sheet) — the
 * client's profile no longer shows it to anyone. An urgent claim is written by
 * the cleaner, who has no phone to copy; a booking made by an older build
 * never carried one; and a repeat visit or repost copies what its parent had.
 */
/** Whether backfillClientPhone has anything left to look at — so the phone is only read when it does. */
export function needsPhoneBackfill(rows: { id: string; status?: string }[]): boolean {
  return rows.some((b) => !!b?.id && !phoneBackfilled.has(b.id)
    && !['done', 'cancelled', 'expired'].includes(String(b.status)));
}

export async function backfillClientPhone(
  rows: { id: string; status?: string }[],
  phone: string,
): Promise<void> {
  if (!phone) return;
  for (const b of rows) {
    if (!b?.id || phoneBackfilled.has(b.id)) continue;
    if (['done', 'cancelled', 'expired'].includes(String(b.status))) continue;
    phoneBackfilled.add(b.id);
    try {
      const d = await fetchBookingDetails(b.id);
      if (!d.phone) await writeBookingDetails(b.id, { phone });
    } catch (err) {
      phoneBackfilled.delete(b.id);
      logError('bookingDetails/backfillPhone', err);
    }
  }
}

/** The private half of an urgent request: its exact address and the client's phone. */
export const urgentDetailsRef = (reqId: string) => doc(db, 'urgentRequests', reqId, 'private', 'details');

const urgentCache = new Map<string, BookingDetails>();

/**
 * Read an urgent request's private half — the client, the cleaner holding the
 * request and an admin may. Empty when there is none (a request written by an
 * older build carries its address on the broadcast itself) or it is refused.
 */
export async function fetchUrgentDetails(reqId: string): Promise<BookingDetails> {
  const hit = urgentCache.get(reqId);
  if (hit) return hit;
  try {
    const snap = await getDoc(urgentDetailsRef(reqId));
    if (!snap.exists()) return {};
    const d = snap.data() as BookingDetails;
    urgentCache.set(reqId, d);
    return d;
  } catch (err) {
    logError('bookingDetails/fetchUrgent', err);
    return {};
  }
}

const urgentCopied = new Set<string>();

/**
 * Copy an urgent request's address and phone into the booking the claim made.
 *
 * The broadcast carries only the city now. The claim cannot copy the rest in
 * its own transaction — until that commits the cleaner does not hold the
 * request and may not read its private half — so she copies it right after,
 * word for word; the rules check it matches.
 */
export async function copyUrgentDetails(bookingId: string, reqId: string): Promise<boolean> {
  if (!bookingId || !reqId || urgentCopied.has(bookingId)) return false;
  urgentCopied.add(bookingId);
  try {
    const u = await fetchUrgentDetails(reqId);
    if (!u.address) { urgentCopied.delete(bookingId); return false; }
    const out: BookingDetails = { address: u.address };
    if (u.phone) out.phone = u.phone;
    await writeBookingDetails(bookingId, out);
    return true;
  } catch (err) {
    urgentCopied.delete(bookingId);
    logError('bookingDetails/copyUrgent', err);
    return false;
  }
}

/**
 * Fold the private half back into bookings the reader is a party to.
 *
 * Done where bookings are LOADED rather than where they are displayed: every
 * screen already reads `b.address`, and rewiring a dozen of those is how a
 * cleaner ends up standing outside with no street name.
 *
 * Only fetches for rows that actually need it — a booking written before the
 * split still carries its own address, and asking again would double the reads
 * for no answer.
 */
/**
 * The private half, asked again while the rules still refuse it for a booking
 * that is already confirmed: the approve shows locally before the server has
 * it, so the first read is refused, and no new snapshot follows the server's
 * acknowledgement. Three more tries over ~10s, then whatever there is.
 */
export async function fetchDetailsWhenReadable(b: { id: string; status?: string; urgentRequestId?: string; cleanerId?: string; clientUid?: string }): Promise<BookingDetails> {
  // The rules give the provider the private half only once she has confirmed
  // (LIVE_FOR_CLEANER). Asked earlier, it is refused every time — a read on
  // every snapshot of her dashboard for each request still waiting for her
  // answer (load test, 14.11.2026). Nothing to show until then anyway.
  const me = auth.currentUser?.uid;
  if (me && me === b.cleanerId && me !== b.clientUid && !LIVE_FOR_CLEANER.includes(String(b.status))) return {};
  deniedAt.delete(b.id);
  let d = await fetchBookingDetails(b.id);
  // An urgent booking's address reaches its cleaner a moment after she
  // confirms: the notification server copies it in (copyUrgentAddress). Waited
  // for once per booking per session, and only while the job is ahead — an old
  // one whose copy never came must not hold the whole list up on every load.
  const awaitingCopy = !!b.urgentRequestId && auth.currentUser?.uid === b.cleanerId
    && ['confirmed', 'onway', 'active'].includes(String(b.status)) && !copyWaited.has(b.id);
  if (awaitingCopy) copyWaited.add(b.id);
  for (const wait of [1500, 3000, 6000]) {
    if (d.address || !(deniedAt.has(b.id) || awaitingCopy) || !LIVE_FOR_CLEANER.includes(String(b.status))) break;
    await new Promise((r) => setTimeout(r, wait));
    deniedAt.delete(b.id);
    d = await fetchBookingDetails(b.id);
  }
  return d;
}

export async function withBookingDetails<T extends { id: string; address?: string }>(
  rows: T[],
): Promise<T[]> {
  return Promise.all(rows.map(async (b) => {
    if (b.address) return b;
    const d = await fetchDetailsWhenReadable(b);
    const rid = (b as { urgentRequestId?: string }).urgentRequestId;
    if (d.address || !rid) return { ...b, ...d };
    // The request's private half is the client's alone (11.11.2026): its
    // cleaner gets the address on the booking, copied in once she confirms.
    const st = String((b as { status?: string }).status);
    if (auth.currentUser?.uid === (b as { cleanerId?: string }).cleanerId) {
      return { ...b, ...d };
    }
    // An urgent booking whose address has not been copied in yet — the copy
    // right after the claim failed, or has not run. Shown from the request's
    // private half, and copied in when the reader is the cleaner.
    const u = await fetchUrgentDetails(rid);
    // The client hands it across once the cleaner has confirmed — a second
    // path beside the notification server's copy, for a push that never came.
    if (u.address && auth.currentUser?.uid === (b as { clientUid?: string }).clientUid && LIVE_FOR_CLEANER.includes(st)) {
      void copyUrgentDetails(b.id, rid);
    }
    return { ...b, ...u, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)) };
  }));
}

/**
 * Move a job's private half off the booking, where it should never have been.
 *
 * Bookings posted before the split still carry the street, floor, flat and
 * notes on the parent — which is exactly the exposure — and only the client who
 * owns one (or an admin) may write it. So it heals in two ways: a client's own
 * screen migrates their open jobs when it loads them, and an admin can sweep
 * whatever is left in one go.
 *
 * Idempotent, and it only touches jobs that are actually still on the board:
 * a booking already claimed is readable to its parties alone, so moving it
 * would spend a write to change nothing.
 */
export async function migrateOpenJobDetails(b: {
  id: string;
  open?: boolean;
  address?: string;
  addrStreet?: string;
  addrFloor?: string;
  addrApt?: string;
  notes?: string;
  phone?: string;
  status?: string;
  addrCity?: string;
}): Promise<boolean> {
  // Still on the board: open AND pending. A cancelled unclaimed board job keeps
  // open: true and is settled, so the parent update is refused there — every
  // snapshot wrote the private copy and then failed, forever.
  if (b.open !== true || b.status !== 'pending') return false;
  if (attempted.has(b.id)) return false;
  attempted.add(b.id);
  const carries = DETAIL_KEYS.some((k) => {
    const v = b[k as keyof typeof b];
    return typeof v === 'string' && v !== '';
  });
  if (!carries) return false;
  try {
    // Only the fields this booking actually carries. Writing the whole set with
    // '' for the missing ones erased what was already in the private half — the
    // client's own screen fills in the phone there (backfillClientPhone), and a
    // migration a moment later blanked it.
    const move: BookingDetails = {};
    for (const k of DETAIL_KEYS) {
      const v = (b as Record<string, unknown>)[k];
      if (typeof v === 'string' && v !== '') (move as Record<string, string>)[k] = v;
    }
    await writeBookingDetails(b.id, move);
    // Only once the copy is safely written. The reverse order would leave a job
    // with no address at all if the second write failed.
    await updateDoc(doc(db, 'bookings', b.id), {
      // addrCity held a full saved address on jobs posted from a pre-filled form.
      addrCity: cityFromAddress(b.addrCity || '', CITY_COORDS) || cityFromAddress(b.address || '', CITY_COORDS),
      address: deleteField(),
      addrStreet: deleteField(),
      addrFloor: deleteField(),
      addrApt: deleteField(),
      notes: deleteField(),
      phone: deleteField(),
    });
    cache.delete(b.id);
    return true;
  } catch (err) {
    logError('bookingDetails/migrate', err);
    return false;
  }
}

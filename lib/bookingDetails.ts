import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './firebase';
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

const DETAIL_KEYS: (keyof BookingDetails)[] =
  ['address', 'addrStreet', 'addrFloor', 'addrApt', 'notes', 'phone'];

/** Split a booking payload into what may be public and what may not. */
export function splitBookingDetails<T extends Record<string, unknown>>(
  payload: T,
): { open: Omit<T, keyof BookingDetails>; details: BookingDetails } {
  const open = { ...payload } as Record<string, unknown>;
  const details: BookingDetails = {};
  for (const k of DETAIL_KEYS) {
    if (payload[k] !== undefined) {
      (details as Record<string, unknown>)[k] = payload[k];
      delete open[k];
    }
  }
  return { open: open as Omit<T, keyof BookingDetails>, details };
}

export async function writeBookingDetails(bookingId: string, details: BookingDetails): Promise<void> {
  await setDoc(doc(db, 'bookings', bookingId, 'private', 'details'), details, { merge: true });
  cache.set(bookingId, { ...(cache.get(bookingId) ?? {}), ...details });
}

// One read per booking is the cost of the split, so nothing is fetched twice in
// a page's lifetime. Cleared on reload, which is when a booking could have
// changed hands anyway.
const cache = new Map<string, BookingDetails>();

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
export async function withBookingDetails<T extends { id: string; address?: string }>(
  rows: T[],
): Promise<T[]> {
  return Promise.all(rows.map(async (b) => {
    if (b.address) return b;
    return { ...b, ...(await fetchBookingDetails(b.id)) };
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
    await writeBookingDetails(b.id, {
      address: b.address ?? '',
      addrStreet: b.addrStreet ?? '',
      addrFloor: b.addrFloor ?? '',
      addrApt: b.addrApt ?? '',
      notes: b.notes ?? '',
      phone: b.phone ?? '',
    });
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

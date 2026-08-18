// Device-calendar sync for confirmed bookings.
//
// A booking is written to the phone's calendar only once BOTH sides are in:
// the client created it and the cleaner approved it (status === 'confirmed').
// Both roles call this, so each party ends up with the job in their own calendar.
//
// Everything here is best-effort. Calendar access is a privilege the user can
// refuse, and a cleaning is still perfectly valid without a calendar entry — so
// no failure in this module is ever allowed to break the booking flow.

import * as Calendar from 'expo-calendar';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';
import { logError } from './logError';
import { record } from './diagnostics';
import { auth } from './firebase';

/**
 * SecureStore key holding the created event id for a booking, per signed-in user.
 *
 * The uid matters. Both parties sync the SAME booking id, so a key of just
 * `cal_evt_{bookingId}` is one slot shared by two people. On a device where both
 * roles are used — a tester, or a cleaner who also books cleanings — whoever
 * synced first left the key behind and the second was told `already-synced`:
 * no event, no permission prompt, and nothing on screen, because that result is
 * deliberately silent. Cancellation had the mirror image, the first remover
 * clearing the key out from under the second.
 *
 * Falls back to `anon` when signed out, which only happens on paths that have
 * already checked for a user.
 */
const evtKey = (bookingId: string) => `cal_evt_${auth.currentUser?.uid ?? 'anon'}_${bookingId}`;

export interface CalendarBooking {
  id: string;
  bookingDate?: string;   // YYYY-MM-DD
  startTime?: string;     // HH:mm
  hours?: number;
  address?: string;
  serviceType?: string;
  cleanerName?: string;
  clientName?: string;
}

/** Parse the stored date + time into a real Date, or null if unusable. */
function startDateOf(b: CalendarBooking): Date | null {
  const date = String(b.bookingDate || '').trim();
  const time = String(b.startTime || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  if (isNaN(dt.getTime())) return null;
  // Reject anything the Date constructor silently rolled over.
  //
  // The regexes above check shape, not range, so '24:30' passes them — and
  // new Date(y, m, d, 24, 30) is not invalid, it is 00:30 the NEXT DAY. A
  // booking saved with that time produced a real calendar event on the wrong
  // date, which reads to the user as 'it never reached my calendar' while
  // every result code reports success. Month 13 and day 32 roll the same way.
  //
  // Comparing the parts back is the whole check: if any field moved, the
  // input was not a real instant, and it belongs in bad-slot where it gets
  // logged instead of quietly landing on another day.
  if (
    dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d
    || dt.getHours() !== h || dt.getMinutes() !== mi
  ) return null;
  return dt;
}

/**
 * Pick a calendar the user can actually see, and that we may write to.
 *
 * Writability alone is not enough, and that cost a whole round of debugging.
 * An Android phone carries several writable calendars, and the first one is
 * usually a local, unsynced account — id "1" on the device this was traced on.
 * Events written there are created perfectly: the API returns an id, the sync
 * reports 'added', and the entry never appears in the user's calendar app,
 * because that app does not display that calendar. From the outside it is
 * indistinguishable from a booking that never synced at all.
 *
 * So `isVisible` is the property that matters most, and it is checked before
 * anything else. Ordering after that goes from the strongest signal of "this
 * is the calendar this person lives in" to the weakest.
 */
async function writableCalendarId(): Promise<string | null> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = cals.filter(c => c.allowsModifications);
  if (writable.length === 0) return null;

  if (Platform.OS === 'ios') {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.id && writable.some(c => c.id === def.id)) return def.id;
    } catch (_) { /* fall through to the heuristics below */ }
  }

  // isVisible is undefined on platforms that do not report it; treat only an
  // explicit false as hidden, so a missing field never empties the list.
  const shown = writable.filter(c => (c as any).isVisible !== false);
  const pool = shown.length > 0 ? shown : writable;

  const synced = pool.filter(c => (c as any).isSynced !== false);
  const google = synced.filter(c => String(c.source?.type ?? '').includes('google'));

  const pick =
    // the account's own calendar: its owner is the account itself
    google.find(c => (c as any).ownerAccount && (c as any).ownerAccount === c.source?.name)
    ?? google.find(c => (c as any).isPrimary)
    ?? google[0]
    ?? synced.find(c => (c as any).isPrimary)
    // anything but the local phone account, which is the trap above
    ?? synced.find(c => c.source?.isLocalAccount !== true)
    ?? synced[0]
    ?? pool[0];

  return pick.id;
}

/** Marks that we've already offered calendar access once on this install. */
const ASKED_KEY = 'cal_perm_asked';

/**
 * Ask for calendar access once, shortly after sign-in, instead of ambushing the
 * user mid-flow.
 *
 * The permission used to be requested at the moment a cleaner approved a
 * booking — which can be hours later, with the phone in a pocket. A system
 * dialog that appears then is easy to miss or dismiss reflexively, and Android
 * stops asking after two dismissals, so one badly-timed prompt can disable the
 * feature permanently and invisibly.
 *
 * Asked here, with a sentence of context first, the user knows what they are
 * agreeing to and finds out immediately whether it worked.
 *
 * Deliberately best-effort and non-blocking:
 *  - only when the status is still `undetermined`, so we never re-prompt
 *    someone who already decided, in either direction;
 *  - only once per install, even if they choose "later" — the booking flow
 *    still asks if it comes to that, so nothing is lost by not nagging;
 *  - never awaited by the caller, so a slow dialog can't hold up sign-in.
 */
export async function primeCalendarPermission(): Promise<void> {
  try {
    if (await SecureStore.getItemAsync(ASKED_KEY).catch(() => null)) return;

    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== 'undetermined') {
      // Already granted or already refused — record it so we stop checking.
      await SecureStore.setItemAsync(ASKED_KEY, '1').catch(() => {});
      return;
    }

    const proceed = await new Promise<boolean>(resolve => {
      Alert.alert(
        '📅 סנכרון עם היומן',
        'נוסיף את ההזמנות המאושרות שלך ליומן המכשיר, עם תזכורת שעה לפני. '
        + 'אפשר לאשר עכשיו — או לדלג ולהחליט בהמשך.',
        [
          { text: 'לא עכשיו', style: 'cancel', onPress: () => resolve(false) },
          { text: 'אישור', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

    // Recorded either way: someone who said "not now" should not be asked again
    // on every launch.
    await SecureStore.setItemAsync(ASKED_KEY, '1').catch(() => {});
    if (proceed) await Calendar.requestCalendarPermissionsAsync();
  } catch (err) {
    logError('calendarSync:prime', err);
  }
}

/**
 * A message worth showing the user, or '' when the outcome needs no comment.
 *
 * Only the two causes a person can actually act on get surfaced. 'already-synced'
 * is the common case and must stay silent; 'bad-slot' and 'no-id' are our bugs,
 * not theirs, and go to logError instead.
 */
export function calendarSyncMessage(r: CalendarSyncResult): string {
  if (r === 'denied') {
    return 'ההזמנה לא נוספה ליומן — לא ניתנה הרשאה. אפשר לאשר בהגדרות המכשיר.';
  }
  if (r === 'no-calendar') {
    return 'ההזמנה לא נוספה ליומן — לא נמצא יומן שניתן לכתוב אליו במכשיר.';
  }
  if (r === 'error') {
    return 'ההזמנה לא נוספה ליומן. אפשר להוסיף אותה ידנית.';
  }
  return '';
}

/**
 * Why a sync attempt ended. Every one of these used to be an undifferentiated
 * `false`, which is why a client reporting "nothing happened" could not be
 * told apart from six different causes — including two the user can fix
 * themselves (a refused permission, a phone with no writable calendar).
 */
export type CalendarSyncResult =
  | 'added'
  | 'already-synced'
  | 'no-id'
  | 'bad-slot'        // date/time not in the expected format
  | 'denied'          // user refused, or permission previously denied
  | 'no-calendar'     // no writable calendar on the device (no account synced)
  | 'error';

/**
 * Bookings currently mid-sync on this device.
 *
 * The stored key alone is not enough. Between reading it and writing it there
 * are three awaits — a permission prompt among them — and several callers fire
 * on the same status change at once: the root listener for the client, the root
 * listener for the cleaner, and the confirm handler acting directly. All three
 * read "no key", all three create an event, and the booking lands in the
 * calendar two or three times. Only the last id gets stored, so cancelling then
 * removes one and leaves the rest behind for good.
 *
 * A promise per booking collapses those callers onto one attempt: whoever
 * arrives second awaits the first instead of racing it.
 */
const inFlight = new Map<string, Promise<CalendarSyncResult>>();

/**
 * Add a confirmed booking to the device calendar.
 *
 * Idempotent across both repeats and concurrency: the created event id is
 * stored per booking and per user, and simultaneous callers share one attempt.
 */
export async function addBookingToCalendar(
  b: CalendarBooking,
  opts: { role: 'client' | 'cleaner'; title?: string; notes?: string } = { role: 'client' },
): Promise<CalendarSyncResult> {
  if (!b?.id) return 'no-id';
  const key = evtKey(b.id);
  const running = inFlight.get(key);
  if (running) return running;

  const attempt = addBookingToCalendarInner(b, opts, key)
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, attempt);
  return attempt;
}

async function addBookingToCalendarInner(
  b: CalendarBooking,
  opts: { role: 'client' | 'cleaner'; title?: string; notes?: string },
  key: string,
): Promise<CalendarSyncResult> {
  try {
    // Already synced? Bail before prompting for permission.
    const existing = await SecureStore.getItemAsync(key).catch(() => null);
    if (existing) return 'already-synced';

    const start = startDateOf(b);
    if (!start) return 'bad-slot';
    const end = new Date(start.getTime() + (Number(b.hours) > 0 ? Number(b.hours) : 2) * 3600000);

    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return 'denied';

    // A phone with no account synced has no writable calendar at all. Nothing
    // the app can do about it, but the user can — so say so rather than
    // vanishing.
    const calendarId = await writableCalendarId();
    if (!calendarId) return 'no-calendar';
    // Named in the log too: an id alone cannot tell you whether the event
    // landed somewhere the user will ever look.
    const calendarName = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
      .then(all => {
        const c: any = all.find(x => x.id === calendarId);
        return c ? `${c.title ?? '?'} / ${c.source?.name ?? '?'}` : '?';
      })
      .catch(() => '?');

    const other = opts.role === 'cleaner' ? b.clientName : b.cleanerName;
    const title = opts.title
      ?? `🧹 ${b.serviceType || 'ניקיון'}${other ? ` — ${other}` : ''}`;

    const eventId = await Calendar.createEventAsync(calendarId, {
      title,
      startDate: start,
      endDate: end,
      location: b.address || undefined,
      notes: opts.notes ?? 'A&M Clean',
      timeZone: 'Asia/Jerusalem',
      alarms: [{ relativeOffset: -60 }],   // remind an hour before
    });

    if (eventId) {
      await SecureStore.setItemAsync(key, String(eventId)).catch(() => {});
      // Which calendar matters: writableCalendarId falls back to the first
      // writable one, which on a phone with no primary can be a local
      // calendar the user's calendar app does not display. The event is
      // real, just invisible — indistinguishable from never created.
      record('calendar:added', { calendarId, calendar: calendarName, start: start.toISOString() });
      return 'added';
    }
    return 'error';
  } catch (err) {
    // Never let a calendar problem surface as a booking failure — but do not
    // lose the evidence either. A silently swallowed throw here is what made
    // this whole path undiagnosable from a user's "nothing happened".
    logError('calendarSync:add', err);
    return 'error';
  }
}

/**
 * Remove a previously synced event (booking cancelled). Silently does nothing
 * if we never created one.
 */
export async function removeBookingFromCalendar(
  bookingId: string,
  b?: CalendarBooking,
  opts: { sweep?: boolean } = {},
): Promise<void> {
  try {
    const key = evtKey(bookingId);
    const id = await SecureStore.getItemAsync(key).catch(() => null);
    if (!id) {
      // Nothing recorded for this booking on this device. Worth saying so:
      // it is the difference between "removed" and "there was never an
      // entry here", which look the same from the calendar.
      record('calendar:remove', { id: bookingId, res: 'no-stored-event' });
    } else {
      // The key is only dropped once the event is actually gone. It used to
      // be deleted regardless: a failed delete then left the entry sitting
      // in the calendar with nothing left pointing at it, so no later
      // cancellation could ever find it again.
      let deleted = false;
      try {
        await Calendar.deleteEventAsync(id);
        deleted = true;
      } catch (err) {
        logError('calendarSync:delete', err);
      }
      if (deleted) await SecureStore.deleteItemAsync(key).catch(() => {});
      record('calendar:remove', { id: bookingId, event: id, res: deleted ? 'deleted' : 'delete-failed' });
    }

    // The sweep is OFF unless asked for, and that default matters.
    //
    // It exists to catch duplicates left by a race that older builds had, and
    // it identifies events by start minute alone — it cannot tell which booking
    // an event belongs to. Run it on every snapshot, as the root listener did,
    // and every past cancellation keeps re-sweeping its old slot: book the same
    // hour again later and the new event is created and then deleted moments
    // afterwards by the ghost of the cancelled one.
    //
    // So it runs only on a genuine transition to cancelled, once, and never
    // again for that booking.
    if (!opts.sweep || !b) return;
    const start = startDateOf(b);
    if (!start) return;
    const end = new Date(start.getTime() + (Number(b.hours) > 0 ? Number(b.hours) : 2) * 3600000);

    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const ids = cals.filter(c => c.allowsModifications).map(c => c.id);
    if (ids.length === 0) return;

    const events = await Calendar.getEventsAsync(ids, start, end);
    for (const e of events) {
      if ((e as any)?.notes !== 'A&M Clean') continue;
      if (new Date(e.startDate as any).getTime() !== start.getTime()) continue;
      await Calendar.deleteEventAsync(e.id).catch(() => {});
    }
  } catch (err) {
    logError('calendarSync:remove', err);
  }
}
/**
 * Every calendar on the device, and the one this module would choose.
 *
 * The selection logic is an inference from flags; this is the fact it is
 * inferring from. It settles the question no result code can: whether the
 * phone has a visible, synced calendar to write to at all. A device with
 * only a local account has nowhere an event can be seen, and no amount of
 * fixing the picker changes that — it is a device setting, not a bug.
 */
export async function describeCalendars(): Promise<string[]> {
  try {
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const chosen = await writableCalendarId();
    const out = cals.map((c: any) => [
      c.id === chosen ? String.fromCharCode(9656) + ' ' : "  ",
      `id=${c.id}`,
      `"${c.title ?? "?"}"`,
      `src=${c.source?.name ?? "?"}/${c.source?.type ?? "?"}`,
      `write=${c.allowsModifications ? "Y" : "n"}`,
      `visible=${c.isVisible === undefined ? "?" : (c.isVisible ? "Y" : "n")}`,
      `synced=${c.isSynced === undefined ? "?" : (c.isSynced ? "Y" : "n")}`,
    ].join(" "));
    out.unshift(`${cals.length} calendars, chosen: ${chosen ?? "NONE"}`);
    return out;
  } catch (err) {
    logError("calendarSync:describe", err);
    return ["failed to read calendars"];
  }
}
/**
 * Re-create a booking's calendar entry, wherever it went last time.
 *
 * The stored event id is what makes the sync idempotent — and what strands a
 * booking whose event was written somewhere the user cannot see. It says
 * "already synced", so the entry is never made again, and no amount of fixing
 * where new events go helps the ones already placed.
 *
 * Deleting the old event first, rather than only forgetting it, avoids leaving
 * a duplicate behind in the calendar it originally landed in.
 */
export async function resyncBooking(b: CalendarBooking, role: 'client' | 'cleaner'): Promise<CalendarSyncResult> {
  try {
    const key = evtKey(b.id);
    const old = await SecureStore.getItemAsync(key).catch(() => null);
    if (old) {
      await Calendar.deleteEventAsync(old).catch(() => {});
      await SecureStore.deleteItemAsync(key).catch(() => {});
    }
  } catch (err) {
    logError('calendarSync:resync', err);
  }
  return addBookingToCalendar(b, { role });
}

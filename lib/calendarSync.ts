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

/** SecureStore key holding the created event id for a booking. */
const evtKey = (bookingId: string) => `cal_evt_${bookingId}`;

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
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Pick a calendar we're actually allowed to write to. `getDefaultCalendarAsync`
 * is iOS-only, and on Android the default can be a read-only subscription (a
 * holiday feed), so filter on `allowsModifications` rather than trusting it.
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
  // Prefer the primary/local account, else just the first writable one.
  const primary = writable.find(c => (c as any).isPrimary)
    ?? writable.find(c => c.source?.name && c.source.name !== 'Other');
  return (primary ?? writable[0]).id;
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
 * Add a confirmed booking to the device calendar.
 *
 * Idempotent: the created event id is stored per booking, so re-running this
 * (re-render, app relaunch, both parties' listeners firing) won't pile up
 * duplicates.
 */
export async function addBookingToCalendar(
  b: CalendarBooking,
  opts: { role: 'client' | 'cleaner'; title?: string; notes?: string } = { role: 'client' },
): Promise<CalendarSyncResult> {
  try {
    if (!b?.id) return 'no-id';

    // Already synced? Bail before prompting for permission.
    const existing = await SecureStore.getItemAsync(evtKey(b.id)).catch(() => null);
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
      await SecureStore.setItemAsync(evtKey(b.id), String(eventId)).catch(() => {});
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
export async function removeBookingFromCalendar(bookingId: string): Promise<void> {
  try {
    const id = await SecureStore.getItemAsync(evtKey(bookingId)).catch(() => null);
    if (!id) return;
    await Calendar.deleteEventAsync(id).catch(() => {});
    await SecureStore.deleteItemAsync(evtKey(bookingId)).catch(() => {});
  } catch (_) { /* best-effort */ }
}

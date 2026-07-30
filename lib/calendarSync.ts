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
import { Platform } from 'react-native';

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

/**
 * Add a confirmed booking to the device calendar.
 *
 * Idempotent: the created event id is stored per booking, so re-running this
 * (re-render, app relaunch, both parties' listeners firing) won't pile up
 * duplicates. Returns true only when a new event was actually written.
 */
export async function addBookingToCalendar(
  b: CalendarBooking,
  opts: { role: 'client' | 'cleaner'; title?: string; notes?: string } = { role: 'client' },
): Promise<boolean> {
  try {
    if (!b?.id) return false;

    // Already synced? Bail before prompting for permission.
    const existing = await SecureStore.getItemAsync(evtKey(b.id)).catch(() => null);
    if (existing) return false;

    const start = startDateOf(b);
    if (!start) return false;
    const end = new Date(start.getTime() + (Number(b.hours) > 0 ? Number(b.hours) : 2) * 3600000);

    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return false;

    const calendarId = await writableCalendarId();
    if (!calendarId) return false;

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
      return true;
    }
    return false;
  } catch (_) {
    // Never let a calendar problem surface as a booking failure.
    return false;
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

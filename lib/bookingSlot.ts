/**
 * When a booking actually starts and ends.
 *
 * Pulled out of calendarSync so it can be tested. That module imports
 * expo-calendar, expo-secure-store, react-native and Firebase, so nothing
 * inside it can be exercised without a device — and this is the part with the
 * subtle arithmetic, the part that has already put an event on the wrong day
 * once. It has no imports at all, which is what makes it testable.
 *
 * See lib/resolveRole.ts and lib/verifyRule.ts: same reasoning, same shape.
 */

export interface BookingSlot {
  /** YYYY-MM-DD */
  bookingDate?: string;
  /** HH:mm */
  startTime?: string;
  hours?: number;
}

/** Hours to assume when a booking does not say how long it runs. */
export const DEFAULT_BOOKING_HOURS = 2;

/**
 * Parse the stored date + time into a real local Date, or null if unusable.
 *
 * The regexes check shape, not range, and that distinction is the whole bug
 * this function exists to prevent: '24:30' matches `HH:mm` perfectly, and
 * `new Date(y, m, d, 24, 30)` is not an invalid date — it is 00:30 the NEXT
 * day. A booking saved that way produced a real calendar event on the wrong
 * date while every result code reported success, which reaches the user as
 * "the booking never got to my calendar" and cannot be told apart from a sync
 * that genuinely failed. Month 13 and day 32 roll over the same silent way.
 *
 * So every field is compared back after construction. If any of them moved,
 * the input was not a real instant and the caller gets null — which surfaces
 * as 'bad-slot' and gets logged, instead of landing quietly on another day.
 */
export function startDateOf(b: BookingSlot): Date | null {
  const date = String(b?.bookingDate || '').trim();
  const time = String(b?.startTime || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  if (isNaN(dt.getTime())) return null;
  if (
    dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d
    || dt.getHours() !== h || dt.getMinutes() !== mi
  ) return null;
  return dt;
}

/**
 * How long the booking runs, in hours.
 *
 * A missing, zero, negative or unparseable value falls back to the default
 * rather than producing an event that ends before it starts.
 */
export function bookingHours(b: BookingSlot): number {
  const n = Number(b?.hours);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BOOKING_HOURS;
}

/** The end of the booking, or null when the start could not be read. */
export function endDateOf(b: BookingSlot): Date | null {
  const start = startDateOf(b);
  if (!start) return null;
  // Wall-clock hours, not absolute milliseconds.
  //
  // A two-hour job starting 01:00 on the night the clocks go back was written
  // as 01:00–02:00 rather than 01:00–03:00, because that stretch of wall clock
  // really does contain three hours of elapsed time. The window came out one
  // hour short and the last hour was bookable by somebody else. One hour a
  // year, Israel included. setHours moves the calendar field and lets the
  // runtime resolve the offset for the resulting instant.
  const end = new Date(start.getTime());
  end.setHours(end.getHours() + bookingHours(b));
  return end;
}

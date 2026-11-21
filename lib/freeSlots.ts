/**
 * "התפנה לי מקום" (Ofek, 21.11.2026): a cleaner says she has room this week
 * without waiting to be asked — up to two windows, on the next seven days.
 * Clients see them on her card and under the "התפנה מקום השבוע" button, and
 * book straight into the hour.
 *
 * Stored on her own public document as `freeSlots` (firestore.rules holds the
 * list to two). Nobody else writes it: a window is "taken" — off her card,
 * making room for another — the moment any booking holds an hour inside it,
 * which her busySlots and pendingSlots already say (the notify Worker holds a
 * new booking's hour there at once, even with her app closed). A booking
 * cancelled or declined frees that hour again, and the window comes back if
 * its time has not passed. A window whose time has passed is simply over.
 * Nothing has to be cleaned up for any of this to be true; her next save
 * drops what is over.
 *
 * Shared by the app and the website, byte for byte (scripts/shared-hash.mjs).
 */
import { addDays, todayYmd } from './workDiary';
import { workingHoursVerdict } from './cleanerTraits';

/** How many windows she may have open at once. */
export const FREE_SLOT_MAX = 2;
/** Today and the six days after it. */
export const FREE_SLOT_DAYS = 7;
/** Whole hours only — the booking form's clock has no minutes. */
export const FREE_SLOT_MIN_HOURS = 1;
/** The latest hour a cleaning may start in the app's booking clock (MAX_BOOKING_HOUR 20; the website's goes later). */
export const FREE_SLOT_LATEST_START = 20 * 60;

export interface FreeSlot {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Start and end, minutes from midnight, whole hours. */
  s: number;
  e: number;
  createdAt?: string;
}

/** A busy or pending slot as her document publishes it (lib/bookingActions busySlotOf). */
interface HeldSlot { date?: unknown; s?: unknown; e?: unknown }

const DATE_RE = /^20\d{2}-[01]\d-[0-3]\d$/;

const minutesNow = (now: Date) => now.getHours() * 60 + now.getMinutes();

/** A stored window that can be read at all. */
export function isFreeSlot(x: unknown): x is FreeSlot {
  const f = x as FreeSlot;
  return !!f && typeof f.id === 'string' && typeof f.date === 'string' && DATE_RE.test(f.date)
    && Number.isInteger(f.s) && Number.isInteger(f.e) && f.s >= 0 && f.e <= 24 * 60 && f.s < f.e;
}

/** The next whole hour from now, in minutes — where a window running today can still be booked from. */
const nextWholeHour = (now: Date) => (now.getHours() + 1) * 60;

/** No whole hour of it is left to book. */
export function freeSlotOver(f: FreeSlot, now: Date = new Date()): boolean {
  const today = todayYmd(now);
  return f.date < today || (f.date === today && Math.max(f.s, nextWholeHour(now)) >= f.e);
}

/** An hour inside it is held by a booking (or by one of her private jobs). */
export function freeSlotTaken(f: FreeSlot, held: readonly (HeldSlot | null | undefined)[]): boolean {
  return held.some((h) => !!h && h.date === f.date && typeof h.s === 'number' && typeof h.e === 'number'
    && h.s < f.e && f.s < h.e);
}

/**
 * Her windows still on offer, soonest first: readable, not over, not taken.
 * What her card shows, what the filter keeps, and what counts towards the two.
 */
export function activeFreeSlots(
  stored: unknown,
  busy: unknown,
  pending: unknown,
  now: Date = new Date(),
): FreeSlot[] {
  const held = [
    ...(Array.isArray(busy) ? busy : []),
    ...(Array.isArray(pending) ? pending : []),
  ] as HeldSlot[];
  const today = todayYmd(now);
  return (Array.isArray(stored) ? stored : [])
    .filter(isFreeSlot)
    .filter((f) => !freeSlotOver(f, now) && !freeSlotTaken(f, held))
    // One already running today is offered from the next whole hour: "פנוי
    // 14:00" at 15:30 opened the booking form on an hour that had gone, and
    // editing it was refused as past (review 21.11.2026).
    .map((f) => (f.date === today && f.s <= minutesNow(now) ? { ...f, s: nextWholeHour(now) } : f))
    .sort((a, b) => (a.date + String(a.s).padStart(4, '0')).localeCompare(b.date + String(b.s).padStart(4, '0')));
}

/** The days she may offer, today first. */
export function freeSlotDays(now: Date = new Date()): string[] {
  const today = todayYmd(now);
  return Array.from({ length: FREE_SLOT_DAYS }, (_, i) => addDays(today, i));
}

/** What the booking forms read of her hours: the days she set, and whether she set them. */
export interface FreeSlotHours { availability?: unknown; availabilitySet?: unknown }

/**
 * What is wrong with a window before it is saved, or null.
 * `others` are her other active windows (the one being edited left out).
 * `hours` are her working days and hours: a window on her day off, or past
 * her day, opened a booking form that refused it (review 21.11.2026).
 */
export function freeSlotProblem(
  f: FreeSlot,
  others: readonly FreeSlot[],
  busy: unknown,
  pending: unknown,
  now: Date = new Date(),
  hours: FreeSlotHours = {},
): 'full' | 'day' | 'time' | 'past' | 'overlap' | 'busy' | 'dayOff' | 'offHours' | null {
  if (others.length >= FREE_SLOT_MAX) return 'full';
  if (!freeSlotDays(now).includes(f.date)) return 'day';
  if (!isFreeSlot(f) || f.s % 60 !== 0 || f.e % 60 !== 0 || f.e - f.s < FREE_SLOT_MIN_HOURS * 60) return 'time';
  if (f.date === todayYmd(now) && f.s <= minutesNow(now)) return 'past';
  const [y, m, d] = f.date.split('-').map(Number);
  const verdict = workingHoursVerdict(
    hours.availability, new Date(y, m - 1, d).getDay(), f.s / 60, (f.e - f.s) / 60, hours.availabilitySet === true,
  ).verdict;
  if (verdict === 'day-off') return 'dayOff';
  if (verdict === 'outside-hours' || f.s > FREE_SLOT_LATEST_START) return 'offHours';
  if (others.some((o) => o.date === f.date && o.s < f.e && f.s < o.e)) return 'overlap';
  const held = [...(Array.isArray(busy) ? busy : []), ...(Array.isArray(pending) ? pending : [])] as HeldSlot[];
  if (freeSlotTaken(f, held)) return 'busy';
  return null;
}

/** HH:MM of minutes from midnight. */
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

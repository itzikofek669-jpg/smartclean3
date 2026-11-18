/**
 * The cleaner's work diary (Ofek, 18.11.2026): her jobs through the app and the
 * private ones she adds herself, in one list by day, with what the coming week
 * holds in hours and in money.
 *
 * Private jobs live at users/{uid}/diary/{id}, readable and writable by her
 * alone (firestore.rules, diaryEntrySane). Their hours go into the busySlots
 * she publishes, so no client is let book her into a private job — and the
 * app knows her real week. They earn no rating and no level: those come from
 * jobs done through the app only (lib/retention cleanerLevel).
 *
 * Shared by the app and the website, byte for byte (scripts/shared-hash.mjs).
 */
import { busySlotOf } from './bookingActions';
import { bookingAmount } from './bookingAmount';

export type DiaryRepeat = 'once' | 'weekly' | 'biweekly';

/** One private job, or one series of them, as stored. */
export interface DiaryEntry {
  id?: string;
  clientName: string;
  phone?: string;
  address?: string;
  /** YYYY-MM-DD: the only visit, or the first of a series. */
  date: string;
  /** HH:MM */
  startTime: string;
  hours: number;
  /** ₪ for one visit; null when she did not say. */
  price?: number | null;
  notes?: string;
  repeat: DiaryRepeat;
  /** Visits of a series that are off (YYYY-MM-DD). */
  skip?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/** The bounds firestore.rules holds a diary entry to — kept in step by hand. */
export const DIARY_LIMITS = { name: 80, phone: 30, address: 200, notes: 500, skip: 60, maxHours: 12, maxPrice: 100000 };

/** How far ahead private visits are published as busy hours. */
export const DIARY_DAYS_PUBLISHED = 56;

const DATE_RE = /^20\d{2}-[01]\d-[0-3]\d$/;
const TIME_RE = /^[0-2]\d:[0-5]\d$/;

/** Day number (days since 1970-01-01) of a real calendar date, or null. */
function dayNum(ymd: string): number | null {
  if (!DATE_RE.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  // 2026-02-30 rolls over to March; a date that does not exist is refused.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return t / 86400000;
}

function dayStr(n: number): string {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * The skipped dates worth keeping, with `add` among them: past ones go, so a
 * long series never reaches the cap the rules hold the list to.
 */
export function prunedSkip(skip: readonly string[] | null | undefined, today: string, add?: string): string[] {
  const out = new Set((Array.isArray(skip) ? skip : []).filter((d) => typeof d === 'string' && d >= today));
  if (add) out.add(add);
  return [...out].sort().slice(-DIARY_LIMITS.skip);
}

/** Today as YYYY-MM-DD on the device's own calendar. */
export function todayYmd(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Add days to a YYYY-MM-DD date. */
export function addDays(ymd: string, n: number): string {
  const d = dayNum(ymd);
  return d === null ? ymd : dayStr(d + n);
}

/**
 * What is wrong with an entry before it is saved, or null. The same bounds
 * the rules enforce, so the form says which field instead of the save failing.
 */
export function diaryEntryProblem(e: Partial<DiaryEntry> | null | undefined):
  'name' | 'date' | 'time' | 'hours' | 'end' | 'price' | 'repeat' | 'text' | null {
  if (!e) return 'name';
  const name = String(e.clientName ?? '').trim();
  if (!name || name.length > DIARY_LIMITS.name) return 'name';
  if (dayNum(String(e.date ?? '')) === null) return 'date';
  const time = String(e.startTime ?? '');
  if (!TIME_RE.test(time) || Number(time.slice(0, 2)) > 23) return 'time';
  const h = Number(e.hours);
  if (!Number.isFinite(h) || h < 0.5 || h > DIARY_LIMITS.maxHours) return 'hours';
  // Over by midnight: a slot past 24:00 is read within its own day only, so
  // the next morning would show free (review 18.11.2026).
  if (Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + h * 60 > 24 * 60) return 'end';
  if (e.price != null && (!Number.isFinite(Number(e.price)) || Number(e.price) < 0 || Number(e.price) > DIARY_LIMITS.maxPrice)) return 'price';
  if (!['once', 'weekly', 'biweekly'].includes(String(e.repeat))) return 'repeat';
  if (String(e.phone ?? '').length > DIARY_LIMITS.phone
    || String(e.address ?? '').length > DIARY_LIMITS.address
    || String(e.notes ?? '').length > DIARY_LIMITS.notes) return 'text';
  return null;
}

/** One visit of a private job, on one day. */
export interface DiaryVisit {
  entryId: string;
  date: string;
  startTime: string;
  hours: number;
  price: number | null;
  clientName: string;
  address: string;
  phone: string;
  notes: string;
  repeat: DiaryRepeat;
}

const STEP: Record<DiaryRepeat, number> = { once: 0, weekly: 7, biweekly: 14 };

/**
 * Every visit of these entries from `fromYmd` for `days` days, soonest first.
 * A series runs on from its first date with no end; dates in `skip` are off.
 */
export function diaryVisits(
  entries: readonly (DiaryEntry | null | undefined)[],
  fromYmd: string,
  days: number,
): DiaryVisit[] {
  const start = dayNum(fromYmd);
  if (start === null || !(days > 0)) return [];
  const end = start + days;
  const out: DiaryVisit[] = [];
  for (const e of entries) {
    if (!e || diaryEntryProblem(e)) continue;
    const first = dayNum(e.date) as number;
    const step = STEP[e.repeat];
    const skip = new Set(Array.isArray(e.skip) ? e.skip : []);
    let d = first;
    if (step > 0 && d < start) d += Math.ceil((start - d) / step) * step;
    for (; d < end; d += step) {
      if (d >= start && !skip.has(dayStr(d))) {
        out.push({
          entryId: String(e.id ?? ''), date: dayStr(d), startTime: e.startTime, hours: Number(e.hours),
          price: e.price == null ? null : Number(e.price), clientName: String(e.clientName).trim(),
          address: String(e.address ?? ''), phone: String(e.phone ?? ''), notes: String(e.notes ?? ''), repeat: e.repeat,
        });
      }
      if (step === 0) break;
    }
  }
  return out.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

/**
 * The private visits ahead, as busy slots in the shape a booking's slot has
 * (lib/bookingActions busySlotOf) — so every reader of busySlots already
 * understands them — plus `p: 1`. The notify Worker frees the hour of a
 * cancelled booking on her document; `p` tells it this hour is not a
 * booking's, so a booking created at that hour and cancelled cannot wipe it
 * (worker/notify.js freeProviderHours).
 */
export function diaryBusySlots(
  entries: readonly (DiaryEntry | null | undefined)[],
  today: string,
  days: number = DIARY_DAYS_PUBLISHED,
): { date: string; s: number; e: number; from: string; until: string; p: 1 }[] {
  return diaryVisits(entries, today, days)
    .map((v) => busySlotOf({ bookingDate: v.date, startTime: v.startTime, hours: v.hours } as never))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({ ...s, p: 1 as const }));
}

/** What the diary needs of one of her bookings in the app. */
export interface DiaryAppJob {
  id?: string;
  status?: string;
  bookingDate?: string;
  startTime?: string;
  hours?: number;
  total?: number | null;
  clientName?: string;
  addrCity?: string;
  address?: string;
  serviceType?: string;
}

/** One line of the diary: a job through the app, or a private one. */
export interface DiaryItem {
  kind: 'app' | 'private';
  id: string;
  date: string;
  startTime: string;
  hours: number;
  price: number | null;
  title: string;
  place: string;
  /** The booking's status for an app job ('pending' awaits her answer). */
  status?: string;
  visit?: DiaryVisit;
}

/** App bookings that belong in her diary: still to happen, under way, or done. */
const DIARY_STATUSES = ['pending', 'confirmed', 'onway', 'active', 'done'];

export interface DiaryTotals { count: number; hours: number; money: number }

/**
 * Her days from `fromYmd` for `days` days: app jobs and private visits side by
 * side, each day's in time order, and the totals of each kind.
 */
export function diaryAgenda(
  appJobs: readonly (DiaryAppJob | null | undefined)[],
  entries: readonly (DiaryEntry | null | undefined)[],
  fromYmd: string,
  days: number,
): { days: { date: string; items: DiaryItem[] }[]; app: DiaryTotals; private: DiaryTotals } {
  const start = dayNum(fromYmd);
  const items: DiaryItem[] = [];
  if (start !== null) {
    for (const b of appJobs) {
      if (!b || !DIARY_STATUSES.includes(String(b.status))) continue;
      const d = dayNum(String(b.bookingDate ?? ''));
      if (d === null || d < start || d >= start + days || !TIME_RE.test(String(b.startTime ?? ''))) continue;
      items.push({
        kind: 'app', id: String(b.id ?? ''), date: String(b.bookingDate), startTime: String(b.startTime),
        hours: Number(b.hours) > 0 ? Number(b.hours) : 2,
        price: b.status === 'done' ? bookingAmount(b as never) : (Number(b.total) >= 0 && b.total != null ? Number(b.total) : null),
        title: String(b.clientName || ''), place: String(b.addrCity || ''), status: String(b.status),
      });
    }
  }
  for (const v of diaryVisits(entries, fromYmd, days)) {
    items.push({
      kind: 'private', id: `${v.entryId}|${v.date}`, date: v.date, startTime: v.startTime, hours: v.hours,
      price: v.price, title: v.clientName, place: v.address, visit: v,
    });
  }
  items.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const byDay = new Map<string, DiaryItem[]>();
  for (const it of items) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);
  const sum = (kind: DiaryItem['kind']): DiaryTotals => items.filter((i) => i.kind === kind)
    .reduce((t, i) => ({ count: t.count + 1, hours: t.hours + i.hours, money: t.money + (i.price ?? 0) }), { count: 0, hours: 0, money: 0 });
  return {
    days: [...byDay.entries()].map(([date, list]) => ({ date, items: list })),
    app: sum('app'),
    private: sum('private'),
  };
}

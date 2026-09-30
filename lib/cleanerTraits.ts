/**
 * Cleaner traits a client wants to know before booking: which languages the
 * cleaner speaks, and which days they work.
 *
 * Both are stored as stable codes, never as display text. A cleaner who ticks
 * "Русский" must show as "Russian" to an English client and "רוסית" to a Hebrew
 * one — storing the label would freeze it in whatever language the cleaner
 * happened to be using. The labels live in translations.ts under
 * `langNames` / `dayNames`; this file only defines the codes and their order.
 *
 * Byte-identical to the other product's copy. The two must agree: they write
 * to the same Firestore documents.
 */

/** The seven languages the apps themselves are translated into. */
export const LANGUAGE_CODES = ['he', 'en', 'ru', 'ar', 'fr', 'hi', 'uk'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** Flags for the picker — decoration only, never the source of meaning. */
export const LANGUAGE_FLAGS: Record<LanguageCode, string> = {
  he: '🇮🇱', en: '🇬🇧', ru: '🇷🇺', ar: '🇸🇦', fr: '🇫🇷', hi: '🇮🇳', uk: '🇺🇦',
};

/**
 * Work days as JavaScript's `Date.getDay()` numbers, so a stored day can be
 * compared against a booking date without a lookup table: 0 = Sunday through
 * 6 = Saturday. Listed Sunday-first, which is how the Israeli week reads.
 */
export const WORK_DAY_CODES = [0, 1, 2, 3, 4, 5, 6] as const;
export type WorkDayCode = (typeof WORK_DAY_CODES)[number];

/** Keep only recognised language codes, in canonical order. */
export function normalizeLanguages(value: unknown): LanguageCode[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(value.map(String));
  return LANGUAGE_CODES.filter((c) => set.has(c));
}

/**
 * Keep only real weekday numbers, sorted Sunday-first and de-duplicated.
 * Accepts numeric strings too — Firestore documents written by older builds
 * (and by hand in the console) are not consistently typed.
 */
export function normalizeWorkDays(value: unknown): WorkDayCode[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(value.map((d) => Number(d)));
  return WORK_DAY_CODES.filter((d) => set.has(d));
}

/**
 * Day keys used by the app's `availability` map, Sunday-first so the index is
 * already a `Date.getDay()` number.
 */
export const AVAILABILITY_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** One day's entry in the `availability` map. Hours are whole numbers, 6–23. */
export interface DayAvailability { active: boolean; start: number; end: number }

/** What the app writes when a day has never been touched. */
export const DEFAULT_DAY: DayAvailability = { active: false, start: 9, end: 18 };

/**
 * One stored day, whatever shape it was written in. The oldest shape is a bare
 * `true`, which the profile screen has always read as working 9–18; it used to
 * be read three ways — working by the booking check, not working by the card,
 * and switched off by the website's editor, which then saved it that way.
 */
function readDay(v: unknown): DayAvailability | null {
  if (v === true) return { ...DEFAULT_DAY, active: true };
  if (!v || typeof v !== 'object') return null;
  const o = v as { active?: unknown; start?: unknown; end?: unknown };
  let start = Number(o.start);
  let end = Number(o.end);
  if (!Number.isFinite(start)) start = DEFAULT_DAY.start;
  if (!Number.isFinite(end)) end = DEFAULT_DAY.end;
  // An inverted or empty window is unusable; read it as the default hours.
  if (end <= start) { start = DEFAULT_DAY.start; end = DEFAULT_DAY.end; }
  return { active: o.active === true, start, end };
}

/**
 * Coerce a stored `availability` map into a complete, well-typed one.
 *
 * Firestore holds whatever was written, and the app only ever stores the days
 * a cleaner actually toggled — so most maps are partial. Filling the gaps here
 * means the editor never has to reason about missing keys.
 */
export function normalizeAvailability(value: unknown): Record<string, DayAvailability> {
  const src = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const out: Record<string, DayAvailability> = {};
  for (const k of AVAILABILITY_DAY_KEYS) {
    const d = readDay(src[k]) ?? DEFAULT_DAY;
    out[k] = {
      active: d.active,
      start: Math.min(23, Math.max(6, d.start)),
      end: Math.min(23, Math.max(6, d.end)),
    };
    // An inverted or empty window is unusable; fall back rather than store it.
    if (out[k].end <= out[k].start) { out[k].start = DEFAULT_DAY.start; out[k].end = DEFAULT_DAY.end; }
  }
  return out;
}

/**
 * Which days a cleaner works, read from the `availability` map the app's
 * profile screen has always written: `{ sun: { active, start, end }, ... }`.
 *
 * This is the single source of truth. A separate `workDays` array was briefly
 * added alongside it and removed again — two editors writing two fields for the
 * same fact means whichever screen was used last silently wins, and the profile
 * shows days the cleaner did not choose on the screen they actually use.
 *
 * The hours in each entry are deliberately ignored here; the profile card shows
 * days only.
 */
export function workDaysFromAvailability(availability: unknown): WorkDayCode[] {
  if (!availability || typeof availability !== 'object') return [];
  const map = availability as Record<string, unknown>;
  return WORK_DAY_CODES.filter((d) => readDay(map[AVAILABILITY_DAY_KEYS[d]])?.active === true);
}

/**
 * Collapse consecutive days into ranges: [0,1,2,3,4] reads as "Sun–Thu" rather
 * than five chips. Returns groups of codes; the caller supplies the labels.
 *
 * Deliberately does NOT wrap around the week boundary — a cleaner working
 * Friday and Sunday means two separate entries, and "Fri–Sun" would wrongly
 * imply Saturday too.
 */
export function groupConsecutiveDays(days: WorkDayCode[]): WorkDayCode[][] {
  const groups: WorkDayCode[][] = [];
  for (const d of days) {
    const last = groups[groups.length - 1];
    if (last && d === last[last.length - 1] + 1) last.push(d);
    else groups.push([d]);
  }
  return groups;
}

/**
 * Whether a booking falls inside the days and hours a cleaner said she works.
 *
 *   'ok'            — inside that day's window.
 *   'day-off'       — she does not work that day.
 *   'outside-hours' — she works that day, but the job starts before her window
 *                     or runs past its end.
 *   'unset'         — no day is marked and `daysChosen` is false. Profiles older
 *                     than the setting have nothing here, and the website's
 *                     editor saves a full week of "off" for anyone who never
 *                     touched it, so "never works" cannot be read into that:
 *                     callers allow it. `daysChosen` is the profile's
 *                     `availabilitySet` — written when she actually sets her
 *                     days — and with it, a week of all days off means that.
 *
 * Nothing checked this before: a client could book a cleaner on a day she had
 * switched off, or at six in the morning when her day starts at nine.
 *
 * `day` is `Date.getDay()` of the booking's local date; `startHour` is decimal
 * (9.5 is 09:30). A day stored as a bare `true` — the oldest shape — is read as
 * 9–18, the way the profile screen has always read it. The hours that apply are
 * returned with the verdict so the message can say what they are.
 */

export function workingHoursVerdict(
  availability: unknown,
  day: number,
  startHour: number,
  hours: number,
  daysChosen = false,
): { verdict: 'ok' | 'day-off' | 'outside-hours' | 'unset'; start?: number; end?: number } {
  const map = (availability && typeof availability === 'object' ? availability : {}) as Record<string, unknown>;
  const days = AVAILABILITY_DAY_KEYS.map((k) => readDay(map[k]));
  if (!days.some((d) => d?.active)) return { verdict: daysChosen ? 'day-off' : 'unset' };
  const d = days[((Math.trunc(day) % 7) + 7) % 7];
  if (!d?.active) return { verdict: 'day-off' };
  if (startHour < d.start || startHour + hours > d.end) {
    return { verdict: 'outside-hours', start: d.start, end: d.end };
  }
  return { verdict: 'ok', start: d.start, end: d.end };
}

/**
 * Is this cleaner worth alerting about work at this time?
 *
 * Used by the urgent-request broadcast in both products. A cleaner who told us
 * she does not work Saturdays, or does not start before 09:00, was still being
 * woken by a 🚨 push for a Saturday job at 07:00 — a notification she can do
 * nothing with, on the one channel the app is allowed to interrupt her on.
 *
 * `unset` is deliberately alertable. A cleaner who never filled in her hours
 * has not said no to anything, and silencing her would quietly cut every
 * cleaner who skipped that step out of the urgent market.
 *
 * `daysChosen` is the profile's `availabilitySet` flag, and it matters for one
 * case: every day switched off. Without the flag that reads as "never set her
 * hours" and she is alerted for everything; with it, she deliberately chose to
 * work no days, and alerting her for anything is exactly wrong. Every other
 * caller of workingHoursVerdict already passes it — this one did not.
 *
 * This decides ALERTS only — the push, and the app's in-app urgent popup. The
 * request still reaches her board either way: declining to ring someone's
 * phone is not the same as hiding work from her.
 */
export function worksAt(
  availability: unknown,
  day: number,
  startHour: number,
  hours: number,
  daysChosen = false,
): boolean {
  const { verdict } = workingHoursVerdict(availability, day, startHour, hours, daysChosen);
  return verdict !== 'day-off' && verdict !== 'outside-hours';
}

/** Minutes from midnight of one day; `s < e`, and `e` may run past 1440. */
export interface DayWindow { s: number; e: number }

/**
 * A cleaner's stored busy slots, as windows on the day `date` (`YYYY-MM-DD`).
 *
 * Both stored shapes are read: `{ date, s, e }` in minutes (current), and
 * `{ from, until }` as ISO instants (older clients) — the latter read on the
 * reader's local wall clock, as every other check that reads them does. A slot
 * from the day before that runs past midnight lands at the start of this one.
 */
export function busyWindowsOn(slots: unknown, date: string): DayWindow[] {
  const dayNo = (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 : NaN;
  };
  const target = dayNo(date);
  if (!Number.isFinite(target) || !Array.isArray(slots)) return [];
  // Local wall-clock minutes relative to `date`. Not (instant - midnight):
  // on the day the clocks change that is an hour off, and a slot at 10:00
  // read as 11:00.
  const wallMinutes = (iso: string) => {
    const t = new Date(iso);
    if (!Number.isFinite(t.getTime())) return NaN;
    const day = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 86400000;
    return (day - target) * 1440 + t.getHours() * 60 + t.getMinutes();
  };
  const out: DayWindow[] = [];
  for (const raw of slots) {
    const slot = raw as { date?: unknown; s?: unknown; e?: unknown; from?: unknown; until?: unknown } | null;
    if (!slot || typeof slot !== 'object') continue;
    let s: number;
    let e: number;
    if (typeof slot.date === 'string' && typeof slot.s === 'number' && typeof slot.e === 'number') {
      const offset = (dayNo(slot.date) - target) * 1440;
      if (!Number.isFinite(offset)) continue;
      s = slot.s + offset;
      e = slot.e + offset;
    } else if (typeof slot.from === 'string' && typeof slot.until === 'string') {
      s = wallMinutes(slot.from);
      e = wallMinutes(slot.until);
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    } else continue;
    if (e > s && e > 0 && s < 1440 * 2) out.push({ s, e });
  }
  return out;
}

/**
 * The start times a direct booking can offer on one day, in half hours
 * (decimal: 9.5 is 09:30).
 *
 *   min   — the start of her working day, or `earliest` when that is later
 *           (today: the next slot from now).
 *   max   — the last start that still finishes by the end of her working day,
 *           so the clock runs to the last hour she works and no further.
 *   first — the hour to put on the clock: the first start from `min` whose
 *           job overlaps none of `busy`. `min` again when every start in the
 *           range collides, and `allBusy` says so.
 *
 * With no working hours set at all (see workingHoursVerdict: 'unset') the
 * clock keeps the old general range, `fallback`. `null` when the day cannot
 * take this job: a day off, or less of her day left than the job needs.
 */
export function bookableStarts(
  availability: unknown,
  day: number,
  hours: number,
  daysChosen: boolean,
  opts: { earliest: number; fallback: { min: number; max: number }; busy?: DayWindow[] },
): { min: number; max: number; first: number; allBusy: boolean; fromProfile: boolean } | null {
  const up = (h: number) => Math.ceil(h * 2 - 1e-9) / 2;
  const down = (h: number) => Math.floor(h * 2 + 1e-9) / 2;
  const map = (availability && typeof availability === 'object' ? availability : {}) as Record<string, unknown>;
  const days = AVAILABILITY_DAY_KEYS.map((k) => readDay(map[k]));
  const len = Math.max(0.5, Number(hours) || 0);

  let min: number;
  let max: number;
  let fromProfile = true;
  if (!days.some((d) => d?.active) && !daysChosen) {
    fromProfile = false;
    min = up(Math.max(opts.fallback.min, opts.earliest));
    max = down(opts.fallback.max);
  } else {
    const d = days[((Math.trunc(day) % 7) + 7) % 7];
    if (!d?.active) return null;
    min = up(Math.max(d.start, opts.earliest));
    max = down(d.end - len);
  }
  if (!(max >= min)) return null;

  const busy = opts.busy ?? [];
  for (let h = min; h <= max + 1e-9; h += 0.5) {
    const s = h * 60;
    const e = s + len * 60;
    if (!busy.some((b) => s < b.e && e > b.s)) return { min, max, first: h, allBusy: false, fromProfile };
  }
  return { min, max, first: min, allBusy: true, fromProfile };
}

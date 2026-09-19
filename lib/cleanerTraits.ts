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
 * Coerce a stored `availability` map into a complete, well-typed one.
 *
 * Firestore holds whatever was written, and the app only ever stores the days
 * a cleaner actually toggled — so most maps are partial. Filling the gaps here
 * means the editor never has to reason about missing keys.
 */
export function normalizeAvailability(value: unknown): Record<string, DayAvailability> {
  const src = (value && typeof value === 'object' ? value : {}) as Record<string, any>;
  const out: Record<string, DayAvailability> = {};
  for (const k of AVAILABILITY_DAY_KEYS) {
    const d = src[k] ?? {};
    const start = Number(d.start);
    const end = Number(d.end);
    out[k] = {
      active: d.active === true,
      start: Number.isFinite(start) ? Math.min(23, Math.max(6, start)) : DEFAULT_DAY.start,
      end: Number.isFinite(end) ? Math.min(23, Math.max(6, end)) : DEFAULT_DAY.end,
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
  const map = availability as Record<string, { active?: boolean } | undefined>;
  return WORK_DAY_CODES.filter((d) => map[AVAILABILITY_DAY_KEYS[d]]?.active === true);
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
 *   'unset'         — she never marked any day. Profiles older than the setting
 *                     have nothing here, and reading that as "never works" would
 *                     make every one of them unbookable, so callers allow it.
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
): { verdict: 'ok' | 'day-off' | 'outside-hours' | 'unset'; start?: number; end?: number } {
  if (!availability || typeof availability !== 'object') return { verdict: 'unset' };
  const map = availability as Record<string, unknown>;
  const read = (v: unknown): DayAvailability | null => {
    if (v === true) return { ...DEFAULT_DAY, active: true };
    if (!v || typeof v !== 'object') return null;
    const o = v as { active?: unknown; start?: unknown; end?: unknown };
    let start = Number(o.start);
    let end = Number(o.end);
    if (!Number.isFinite(start)) start = DEFAULT_DAY.start;
    if (!Number.isFinite(end)) end = DEFAULT_DAY.end;
    // An inverted or empty window is unusable; read it the way the editor does.
    if (end <= start) { start = DEFAULT_DAY.start; end = DEFAULT_DAY.end; }
    return { active: o.active === true, start, end };
  };
  const days = AVAILABILITY_DAY_KEYS.map((k) => read(map[k]));
  if (!days.some((d) => d?.active)) return { verdict: 'unset' };
  const d = days[((Math.trunc(day) % 7) + 7) % 7];
  if (!d?.active) return { verdict: 'day-off' };
  if (startHour < d.start || startHour + hours > d.end) {
    return { verdict: 'outside-hours', start: d.start, end: d.end };
  }
  return { verdict: 'ok', start: d.start, end: d.end };
}

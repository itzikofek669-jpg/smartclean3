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
 * Mirrored in A-M-Clean-web/src/lib/cleanerTraits.ts. The two must agree: they write
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

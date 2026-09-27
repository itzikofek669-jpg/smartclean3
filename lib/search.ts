// Cleaner discovery search — what a typed query actually selects.
//
// ── The bug this replaces ───────────────────────────────────────────────────
// A query that resolved to a PLACE (a city name, or a picked dropdown result)
// did not filter at all. It only re-sorted: searching "חיפה" returned every
// cleaner in the country, 207 of them in a seeded run, with Haifa merely near
// the top. Searching "תל אביב" put a Ramat Gan cleaner first and left the two
// actual Tel Aviv cleaners further down the list.
//
// From the other side of the screen that is simply a search box that does
// nothing, and that is exactly how it was reported: "doesn't find by name or
// by city". Names and services did filter; cities never did.
//
// The mobile app had the opposite bug with the same cause. It matched a city
// by text alone, against the cleaner's own `city` field — so with every real
// cleaner registered in חריש, searching חדרה, ten kilometres away, returned an
// empty list. One product showed everyone, the other showed no one, and both
// were wrong for the same reason: neither asked whether the cleaner goes there.
//
// The original reasoning is in the old comment — "never hides them, so the
// list is never empty just because of a radius" — and it is not wrong about
// the risk. A cleaner who lives in Pardesiya genuinely serves Netanya, and a
// strict city-text match would hide her. The answer is not to skip filtering,
// it is to filter on the right thing: whether she travels to the place you
// searched for.
//
// ── The rule ────────────────────────────────────────────────────────────────
// A cleaner answers a place search when EITHER
//   • her own text — name, city, work areas, services — contains the query, or
//   • the place is inside the distance she said she travels (`maxDistance`,
//     defaulting to the same 30 km the urgent broadcast uses).
// A cleaner we cannot place at all is kept rather than dropped: no coordinates
// means we do not know she is far away, and hiding a real cleaner on a guess
// is worse than showing one extra.
//
// Kept identical between the two products — shared-files.sha256 covers it.

/** The fields discovery search reads. Deliberately structural — the Cleaner
 *  type carries thirty more that have nothing to do with searching. */
export interface SearchableCleaner {
  name?: string;
  city?: string;
  workAreas?: string[];
  services?: string[];
  lat?: number;
  lng?: number;
  maxDistance?: number;
}

export interface Place {
  lat: number;
  lng: number;
}

/** How far a cleaner travels when she never said. Matches the urgent broadcast. */
export const DEFAULT_TRAVEL_KM = 30;

/**
 * Text compared the way people type it: ״ and ", hyphens and spaces, קרית and
 * קריית, and case. The same folding lib/cityFromAddress applies to addresses —
 * repeated here rather than imported so this file compiles on its own for the
 * tests. Without it "תל-אביב" found nobody listed in "תל אביב".
 */
export function normText(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/[״”“]/g, '"')
    .replace(/[׳’‘]/g, "'")
    .replace(/[-־–]/g, ' ')
    .replace(/קריית/g, 'קרית')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Everything about a cleaner that free text is matched against. */
export function haystack(c: SearchableCleaner): string {
  return normText([c.name, c.city, ...(c.workAreas ?? []), ...(c.services ?? [])]
    .filter(Boolean)
    .join(' '));
}

/** Does the cleaner's own text answer this query? */
export function textMatches(c: SearchableCleaner, query: string): boolean {
  const q = normText(query);
  return !!q && haystack(c).includes(q);
}

/**
 * The town a query names, if it names one.
 *
 * The app used to accept only an exact Hebrew key of the city table, so the
 * fix for "search by town finds nothing" survived in six of seven languages:
 * "Hadera", "תל-אביב", "פרדס חנה כרכור" and a half-typed "חדר" all fell back to
 * matching the cleaner's own city text, and found nobody. The website had a
 * looser rule of its own; this is the one rule both now use.
 *
 * An exact match — Hebrew or the viewer's language, after normText — always
 * wins. A PARTIAL one (the start of a town's name, two letters or more) counts
 * only when `allowPartial`: callers pass false when the text already matches a
 * cleaner's name, so "אבי" finds Avi rather than dragging the list to תל אביב.
 * Among partial matches the shortest name wins — "חדר" is חדרה, not חדרה-West.
 */
export function resolvePlace(
  query: string,
  table: Record<string, Place>,
  nameOf: (city: string) => string = () => '',
  allowPartial = true,
): (Place & { city: string }) | null {
  const q = normText(query);
  if (!q) return null;
  let partial: string | null = null;
  for (const city of Object.keys(table)) {
    const he = normText(city);
    const tr = normText(nameOf(city));
    if (he === q || (tr && tr === q)) return { city, ...table[city] };
    if (allowPartial && q.length >= 2 && (he.startsWith(q) || (tr && tr.startsWith(q)))) {
      if (partial === null || normText(city).length < normText(partial).length) partial = city;
    }
  }
  return partial ? { city: partial, ...table[partial] } : null;
}

/**
 * Does this cleaner travel to `place`?
 *
 * `distanceKm` is injected rather than imported so this stays pure and
 * testable; callers pass the same haversine the rest of the app uses.
 */
export function servesPlace(
  c: SearchableCleaner,
  place: Place,
  distanceKm: (a: Place, b: Place) => number,
): boolean {
  if (typeof c.lat !== 'number' || typeof c.lng !== 'number') return true; // unplaceable — keep
  const reach = typeof c.maxDistance === 'number' && c.maxDistance > 0 ? c.maxDistance : DEFAULT_TRAVEL_KM;
  return distanceKm(place, { lat: c.lat, lng: c.lng }) <= reach;
}

/**
 * Should this cleaner appear for this search?
 *
 * `place` is non-null when the query resolved to somewhere on the map — a city
 * name or a picked dropdown result. An empty query keeps everyone.
 */
export function matchesSearch(
  c: SearchableCleaner,
  query: string,
  place: Place | null,
  distanceKm: (a: Place, b: Place) => number,
): boolean {
  if (!query.trim()) return true;
  if (textMatches(c, query)) return true;
  return place ? servesPlace(c, place, distanceKm) : false;
}

/**
 * The search step of both cleaner lists, as one testable function.
 *
 * Each screen did this inline — filter, then re-derive the text match inside
 * the sort comparator — and that inline wiring is exactly where all three
 * search bugs lived, out of reach of every test. Here each cleaner is adapted
 * once (the app's list rebuilds on every render, and building the searchable
 * shape twice per comparison was measurable at 700 cleaners), and the caller
 * gets back who stays plus whether their own text matched, so it can put the
 * cleaners who actually say that town above the ones who merely travel there.
 */
export function searchCleaners<T>(
  cleaners: T[],
  query: string,
  place: Place | null,
  toSearchable: (c: T) => SearchableCleaner,
  distanceKm: (a: Place, b: Place) => number,
): { item: T; textHit: boolean }[] {
  const q = query.trim();
  const kept: { item: T; textHit: boolean }[] = [];
  for (const item of cleaners) {
    if (!q) { kept.push({ item, textHit: false }); continue; }
    const s = toSearchable(item);
    const textHit = textMatches(s, q);
    if (textHit || (place && servesPlace(s, place, distanceKm))) kept.push({ item, textHit });
  }
  return kept;
}

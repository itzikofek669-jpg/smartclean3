/**
 * Display order for the two lists a person actually browses: the cleaners a
 * client sees, and the jobs a cleaner sees.
 *
 * Both used to be fully deterministic, and that is a problem the sort itself
 * creates. The nearest cleaner was #1 for a given client on every visit forever,
 * and a cleaner who joined yesterday with no ratings sat at the bottom with no
 * way to ever climb — the order decided who got work, and it never moved.
 *
 * So the ranking keeps every distinction a person can actually perceive —
 * available before unavailable, near before far, well-rated before poorly rated
 * — and rotates only *within* a group where those are equal. A client still gets
 * a sensible list; nobody is pinned to the bottom of it.
 *
 * The rotation is stable for the whole visit. It is a pure function of the id
 * and one seed drawn at startup, not a shuffle, so re-renders, filtering,
 * searching and live Firestore updates all leave the order exactly where it
 * was — cards never move under a finger mid-scroll. Reopening the app or
 * reloading the page draws a new seed and a new order.
 *
 * Kept in step with src/lib/displayOrder.ts on the website; the two products show
 * the same people the same way.
 */

/** Drawn once per app start. Reopening the app is what re-rotates the lists. */
const SESSION_SEED = Math.random().toString(36).slice(2);

/** Cleaners within this many km of each other count as equally near. */
export const DISTANCE_BAND_KM = 5;

/** Ratings within this much of each other count as equally good. */
export const RATING_BAND = 0.5;

/**
 * A stable pseudo-random rank in [0,1) for an id, fixed for this visit.
 *
 * FNV-1a: cheap, no dependency, and well spread for short strings — which
 * matters, because a weak hash would leave the same ids adjacent every time and
 * defeat the whole point. Deliberately NOT `sort(() => Math.random() - 0.5)`:
 * that is both biased (it is not a uniform shuffle) and unstable (it gives a
 * different answer for the same pair on the same pass, which no comparator may
 * do).
 */
export function rotationRank(id: string): number {
  const s = `${id}:${SESSION_SEED}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Which distance bucket a job/cleaner falls in. No distance sorts last. */
export function distanceBand(km: number | null | undefined): number {
  if (km == null || !Number.isFinite(km)) return Number.MAX_SAFE_INTEGER;
  return Math.floor(km / DISTANCE_BAND_KM);
}

/** Which rating bucket. Higher is better, so callers compare b - a. */
export function ratingBand(rating: number | null | undefined): number {
  return Math.floor((Number(rating) || 0) / RATING_BAND);
}

export interface OrderableCleaner {
  id: string;
  /** Absent counts as available — every profile predating the flag travelled. */
  available?: boolean;
  rating?: number;
  distKm?: number | null;
}

export interface OrderableJob {
  id: string;
  distKm?: number | null;
}

/**
 * Availability, then distance band, then rating band, then rotation.
 *
 * This exact order is what the web and the app now share. They used to disagree
 * outright — the web sorted on distance alone and the app on rating alone, so
 * the same client saw two different lists depending on which one they opened.
 */
export function compareCleaners(a: OrderableCleaner, b: OrderableCleaner): number {
  const byAvailable = Number(b.available !== false) - Number(a.available !== false);
  if (byAvailable) return byAvailable;
  const byDistance = distanceBand(a.distKm) - distanceBand(b.distKm);
  if (byDistance) return byDistance;
  const byRating = ratingBand(b.rating) - ratingBand(a.rating);
  if (byRating) return byRating;
  return rotationRank(a.id) - rotationRank(b.id);
}

/**
 * Distance band, then rotation.
 *
 * Newest-first used to break the tie, which meant a job that went unclaimed for
 * a day sank under every later post and stayed there. Every job in the band is
 * live (open and pending; urgent ones expire on their own), so there is nothing
 * to gain by ranking them against each other on age.
 */
export function compareJobs(a: OrderableJob, b: OrderableJob): number {
  const byDistance = distanceBand(a.distKm) - distanceBand(b.distKm);
  if (byDistance) return byDistance;
  return rotationRank(a.id) - rotationRank(b.id);
}

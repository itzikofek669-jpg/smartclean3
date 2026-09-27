/**
 * What a cleaner's search box finds on the job board.
 *
 * Reported as: searching as a cleaner finds nothing, not by name and not by
 * city. Reproduced against a seeded board, every part of that was true:
 *
 *   • A client's name found nothing at all. Both boards matched city and
 *     service only; `clientName` was never read, though it is printed on every
 *     card the cleaner is looking at.
 *
 *   • "תל אביב" found two of the three Tel Aviv jobs. The third was a job from
 *     before `addrCity` existed. Its street address has since moved to the
 *     private half, so the public document names no place at all — only
 *     coordinates — and a text search had nothing to read.
 *
 *   • "חיפה" found nothing. The Haifa job was 80 km from a cleaner who
 *     travels 30, and the distance filter ran before the search did, so no
 *     query could ever reach it.
 *
 * The first two are plain misses. The third is a question of intent: the
 * radius is the right default for browsing, because it is the cleaner's own
 * answer to "how far will I go". But a cleaner who types a town or a person is
 * asking about that town or that person, and answering "nothing" when the job
 * is right there is the bug being reported. So a match on a PLACE or a CLIENT
 * reaches past the radius; a match on a service — "משרדים" — does not, since
 * that is still browsing, just narrower.
 *
 * Pure, with every lookup passed in, because each product keeps its own city
 * table and translations. Kept identical between the two products —
 * shared-files.sha256 covers it.
 */

export interface SearchableJob {
  clientName?: string | null;
  addrCity?: string | null;
  address?: string | null;
  serviceType?: string | null;
  serviceTypes?: string[] | null;
}

export interface JobSearchLookups {
  /** The city's name in the viewer's language, or '' when there is none. */
  cityName?: (city: string) => string;
  /** The service's label in the viewer's language, or '' when there is none. */
  serviceName?: (key: string) => string;
  /** The city to use when the job itself names none — see nearestCity. */
  fallbackCity?: string | null;
}

/** How a job answered a query. `none` drops it; the rest keep it. */
export type JobMatch = 'none' | 'client' | 'place' | 'service';

/** The place a job is in, as text: its own field, else the derived fallback. */
export function jobCityOf(job: SearchableJob, fallbackCity?: string | null): string {
  return String(job.addrCity || job.address || fallbackCity || '').trim();
}

/**
 * What, if anything, this job matched. An empty query matches as `service` —
 * the browsing case — so the caller's radius still applies to it.
 */
export function matchJob(job: SearchableJob, query: string, lookups: JobSearchLookups = {}): JobMatch {
  const q = query.trim().toLowerCase();
  if (!q) return 'service';

  if (String(job.clientName ?? '').toLowerCase().includes(q)) return 'client';

  const city = jobCityOf(job, lookups.fallbackCity);
  if (city) {
    const translated = (lookups.cityName?.(city) ?? '').toLowerCase();
    if (city.toLowerCase().includes(q) || (translated && translated.includes(q))) return 'place';
  }

  const services = Array.isArray(job.serviceTypes) && job.serviceTypes.length
    ? job.serviceTypes
    : (job.serviceType ? [job.serviceType] : []);
  const hit = services.some((s) => {
    const label = (lookups.serviceName?.(s) ?? '').toLowerCase();
    return String(s).toLowerCase().includes(q) || (!!label && label.includes(q));
  });
  return hit ? 'service' : 'none';
}

/**
 * Does the job belong on the board for this query, given how far it is?
 *
 * `distKm` null means the distance is unknown, which never hides a job — the
 * same rule both boards already applied.
 */
export function jobOnBoard(match: JobMatch, distKm: number | null, maxKm: number): boolean {
  if (match === 'none') return false;
  if (match === 'client' || match === 'place') return true;   // asked for by name
  return distKm == null || distKm <= maxKm;
}

/** Great-circle distance in km. Local, so this file needs nothing imported. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * The known city nearest to a point, when one is close enough to be the
 * answer. For a job whose document names no place — only coordinates — so it
 * can still be searched for, and shown, by town.
 *
 * `withinKm` keeps this honest: a point in open country is not "in" whichever
 * town happens to be least far away.
 */
export function nearestCity(
  point: { lat: number; lng: number } | null | undefined,
  table: Record<string, { lat: number; lng: number }>,
  withinKm = 5,
): string | null {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  let best: string | null = null;
  let bestKm = Infinity;
  for (const [name, c] of Object.entries(table)) {
    const d = haversineKm(point, c);
    if (d < bestKm) { bestKm = d; best = name; }
  }
  return bestKm <= withinKm ? best : null;
}

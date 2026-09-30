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

import { normText } from './search';
import { allCityNames } from './cityNames';

export interface SearchableJob {
  clientName?: string | null;
  addrCity?: string | null;
  /** Some older documents name the town here; getJobCoords and the app's card both read it. */
  city?: string | null;
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

/**
 * How a job answered a query. `none` drops it. `client` and `place` were asked
 * for by name and reach past the radius. `service` is every other match — a
 * service, or a fragment of a word — and keeps the radius, like browsing.
 */
export type JobMatch = 'none' | 'client' | 'place' | 'service';

/** The place a job is in, as text: its own field, else the derived fallback. */
export function jobCityOf(job: SearchableJob, fallbackCity?: string | null): string {
  return String(job.addrCity || job.city || job.address || fallbackCity || '').trim();
}

/** Does `text`, or any word in it, start with `q`? Both already normText'ed. */
function wordStarts(text: string, q: string): boolean {
  return !!text && (text.startsWith(q) || text.split(' ').some((w) => w.startsWith(q)));
}

/**
 * What, if anything, this job matched. An empty query matches as `service` —
 * the browsing case — so the caller's radius still applies to it.
 *
 * A name reaches past the radius only when it looks like one: two letters or
 * more, at the start of a word. A plain substring did it on the first
 * keystroke — "ר" matched 143 of the 208 towns, and a cleaner who began typing
 * "ניקיון" watched jobs from across the country flood in and drain away again.
 * Anything shorter or mid-word still narrows the list, inside the radius.
 */
export function matchJob(job: SearchableJob, query: string, lookups: JobSearchLookups = {}): JobMatch {
  const q = normText(query);
  if (!q) return 'service';

  const client = normText(job.clientName);
  const city = jobCityOf(job, lookups.fallbackCity);
  const cityHe = normText(city);
  const cityTr = city ? normText(lookups.cityName?.(city)) : '';

  if (q.length >= 2) {
    if (wordStarts(client, q)) return 'client';
    if (wordStarts(cityHe, q) || wordStarts(cityTr, q)) return 'place';
    // Its name in any other language (lib/cityNames): "Haifa" on a Hebrew screen.
    if (city && allCityNames(city).some((n) => wordStarts(normText(n), q))) return 'place';
  }

  const services = Array.isArray(job.serviceTypes) && job.serviceTypes.length
    ? job.serviceTypes
    : (job.serviceType ? [job.serviceType] : []);
  const text = [client, cityHe, cityTr,
    ...services.map((s) => normText(s)),
    ...services.map((s) => normText(lookups.serviceName?.(s))),
  ].filter(Boolean).join(' ');
  return text.includes(q) ? 'service' : 'none';
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

/** What the boards attach to a job before searching it. */
export interface BoardJob extends SearchableJob {
  /** Distance from the cleaner, or null when either end cannot be placed. */
  _distKm?: number | null;
  /** The derived town for a job that names none — see nearestCity. */
  _city?: string | null;
  /** A demo card: never radius-limited, matched without translations. */
  _bot?: boolean;
}

/**
 * The search-and-radius step of both job boards, as one testable function.
 *
 * Each board did this inline, and the inline version is where the radius once
 * ran before the search, and where dropping `fallbackCity` or the demo branch
 * would have passed every test. The lookups translate towns and services into
 * the viewer's language; the fallback town comes from each job.
 */
export function filterBoard<T extends BoardJob>(
  jobs: T[],
  query: string,
  maxKm: number,
  lookups: Omit<JobSearchLookups, 'fallbackCity'> = {},
): T[] {
  return jobs.filter((j) => {
    if (j._bot) return matchJob(j, query) !== 'none';
    const match = matchJob(j, query, { ...lookups, fallbackCity: j._city });
    return jobOnBoard(match, j._distKm ?? null, maxKm);
  });
}

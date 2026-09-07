/**
 * When an urgent request is still live, and when it may be deleted.
 *
 * These were two questions being answered by one expression, differently, in
 * five places. `!r.expiresAt || parse(r.expiresAt) > now` in two of them treated
 * a request with no expiry as live; `!r.expiresAt || parse(r.expiresAt) <= now`
 * in two others treated it as expired AND deleted it; a fifth required the field
 * and hid the request without it. An unparseable timestamp inverted all of them
 * at once, because both `NaN > now` and `NaN <= now` are false.
 *
 * So one legacy document without the field showed on both job boards, was
 * invisible in the app's urgent popup, and was deleted out from under all of
 * them the moment its owner opened their dashboard.
 *
 * Splitting the two questions is what makes them answerable:
 *
 *   • Showing a request we cannot bound is wrong — it might have lapsed weeks
 *     ago and a cleaner would be told to hurry.
 *   • Deleting a request we cannot bound is worse, and irreversible. The
 *     timestamp is our own bug; the client's request is real. Deletion requires
 *     a timestamp that actually parses and has actually passed.
 *
 * Kept identical between the two products — shared-files.sha256 covers it.
 */

export interface ExpirableRequest {
  /** ISO 8601. Written by both products since urgent requests existed. */
  expiresAt?: string | null;
}

/** Milliseconds since the epoch, or null when the value is not a real instant. */
export function expiryOf(r: ExpirableRequest | null | undefined): number | null {
  const raw = r?.expiresAt;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

/**
 * Should this request be shown to anyone?
 *
 * No usable expiry means no: an unbounded request is one nobody can say is
 * still wanted.
 */
export function isUrgentRequestLive(
  r: ExpirableRequest | null | undefined,
  now: Date = new Date(),
): boolean {
  const t = expiryOf(r);
  return t !== null && t > now.getTime();
}

/**
 * May this request be deleted as expired?
 *
 * Only with a timestamp that parses and has passed. A missing or malformed one
 * is our defect, and destroying somebody's request over it is not a repair —
 * it stays hidden by isUrgentRequestLive until a person looks at it.
 */
export function isUrgentRequestExpired(
  r: ExpirableRequest | null | undefined,
  now: Date = new Date(),
): boolean {
  const t = expiryOf(r);
  return t !== null && t <= now.getTime();
}

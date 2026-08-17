/**
 * Where a booking came from. Only 'direct' — a client choosing one specific
 * cleaner — has no re-post path: there is no advert to put back.
 *
 * Mirrored in A-M-Clean-web/src/lib/bookingOrigin.ts, where the type lives in
 * types/models.ts. Declared inline here because the app has no shared model file.
 */
export type BookingOrigin = 'direct' | 'open' | 'urgent';

/** Just the fields this module reads. */
interface BookingLike {
  origin?: string;
  urgent?: boolean;
  open?: boolean;
  repostedFrom?: string;
}


/**
 * Work out where a booking came from, tolerating documents written before
 * `origin` existed.
 *
 * The stored field wins when present. Otherwise we infer, and the inference has
 * to be conservative in one specific direction: a booking we cannot classify is
 * treated as `direct`, which is the option with no re-post button. Guessing
 * wrong the other way would offer to re-advertise a job that was never
 * advertised — putting a client's address back on the open board when all they
 * did was book one cleaner they chose.
 *
 * Note what is deliberately NOT used as a signal: `open`. Claiming a posted job
 * sets it false (see claimOpenJob), so by the time a cancelled booking is being
 * examined it says nothing about how the booking started.
 */
export function bookingOrigin(b: BookingLike | null | undefined): BookingOrigin {
  const stored = b?.origin;
  if (stored === 'direct' || stored === 'open' || stored === 'urgent') return stored;

  // ── Legacy documents ──────────────────────────────────────────────────────
  if (b?.urgent === true) return 'urgent';
  // Still unclaimed, so it is provably an advert rather than a direct booking.
  if (b?.open === true) return 'open';
  // Only re-posting writes this, and only ever from an advert.
  if (b?.repostedFrom) return 'open';
  return 'direct';
}

/**
 * May the client be offered "re-post and find another cleaner" for this
 * cancelled booking?
 *
 * Only for jobs that were advertised in the first place. A direct booking is an
 * arrangement between one client and one cleaner they picked; when the cleaner
 * pulls out there is no advert to restore, and re-posting would silently turn a
 * private arrangement into a public listing. Those clients choose a new cleaner
 * themselves instead.
 */
export function canRepost(b: BookingLike | null | undefined): boolean {
  return bookingOrigin(b) !== 'direct';
}

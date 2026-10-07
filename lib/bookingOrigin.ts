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
  // A board job only. An urgent booking's request goes back out to cleaners by
  // itself when the cleaner walks away (releaseUrgentRequest), so reposting it
  // always collided with that request: the client pressed "post again" and was
  // told they had already booked that hour.
  return bookingOrigin(b) === 'open';
}

/**
 * Is this the old copy of a job its client edited?
 *
 * Editing a posted job replaces it: the old one is cancelled with `replacedBy`
 * naming the new one. It is not a cancellation, and no list should show or
 * count it as one — not the client's, not the admin's.
 *
 * `replacedBy` alone does not say so. The rules do not freeze the field, so a
 * cleaner holding a job could write it and make a live booking vanish from its
 * client's list. Only a cancelled job that nobody had taken is an edit.
 */
export function replacedByEdit(
  b: { replacedBy?: unknown; status?: string; cleanerId?: string } | null | undefined,
): boolean {
  return !!b?.replacedBy && b.status === 'cancelled' && !b.cleanerId;
}

/**
 * What a client is told after the cleaner pulled out of a booking.
 *
 * The notice used to say "you can post it again" whatever the booking was —
 * also under an urgent booking, which has no such button because its request
 * has already gone back out by itself, and under a direct one, which has
 * nothing to post.
 *
 *   'repost'   — a board job: it can be posted again, and the button is there.
 *   'reposted' — an urgent booking whose request is out again: other cleaners
 *                can take it, and the client has nothing to do.
 *   'plain'    — nothing went back out: a direct booking, or an urgent one
 *                whose request is over. The client books somebody else.
 *   'pending'  — an urgent booking whose request has not been seen out again
 *                (yet): only that the booking was cancelled.
 *
 * `requestOut` is urgentBackOut() of the request the booking came from;
 * undefined while that has not been read.
 */
export type CancelledNotice = 'repost' | 'reposted' | 'plain' | 'pending';

export function cancelledNotice(
  b: BookingLike | null | undefined,
  requestOut?: boolean | null,
): CancelledNotice {
  const origin = bookingOrigin(b);
  if (origin === 'open') return 'repost';
  if (origin !== 'urgent') return 'plain';
  if (requestOut === true) return 'reposted';
  return requestOut === false ? 'plain' : 'pending';
}

/**
 * The two tabs at the top of the profile: what is still going on, and what is
 * over. A booking whose day has passed is history whatever its status says,
 * even when the payment was never approved.
 *
 * A cleaner's unanswered booking is in neither: it waits in "incoming bookings"
 * until they answer, and only then is it their work. Once its day has passed it
 * is history like the rest.
 */
const LIVE = ['pending', 'confirmed', 'onway', 'active'];

export function bookingTabs<B extends { status: string }>(
  bookings: B[],
  isPast: (b: B) => boolean,
  forCleaner: boolean,
): { active: B[]; history: B[] } {
  const live = forCleaner ? LIVE.filter((s) => s !== 'pending') : LIVE;
  return {
    active: bookings.filter((b) => live.includes(b.status) && !isPast(b)),
    history: bookings.filter((b) => !LIVE.includes(b.status) || isPast(b)),
  };
}

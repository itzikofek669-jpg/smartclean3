/**
 * Who sees the "past bookings" banner on the home screen, and what it opens.
 * Pure, so it can be tested; the write is in lib/firstBooking.
 */
import { bookingOrigin } from './bookingOrigin';

type PastBooking = {
  id?: string; status?: string; cleanerId?: string; hiddenFromRebook?: boolean;
  origin?: string; urgent?: boolean; open?: boolean; repostedFrom?: string;
};

/**
 * Whether this client has ever booked a cleaner.
 *
 * It was `myBookings.length > 0`, which answered two other questions: a client
 * who had only posted a job, with nobody on it yet, counted as having booked,
 * and the banner went with the list. The flag on the profile cannot stop being
 * true. The list still counts, for a client who booked before the flag existed
 * and until their profile has been marked.
 */
export function hasBookedACleaner(flag: unknown, bookings: readonly PastBooking[]): boolean {
  // Not a board job a cleaner has only just claimed: she can still turn it down,
  // which clears her name, and nobody has been booked until she has approved.
  return flag === true || bookings.some((b) => !!b.cleanerId
    && !(bookingOrigin(b) === 'open' && b.status === 'pending'));
}

const REBOOKABLE = ['done', 'confirmed', 'active', 'pending'];

/**
 * The bookings worth repeating, newest first as they arrive. A job still on the
 * board is left out: nobody has taken it, so there is no "same service provider"
 * to book again, and pressing the button only said the provider was not found.
 */
export function rebookableBookings<T extends PastBooking>(bookings: readonly T[], hidden: ReadonlySet<string>): T[] {
  return bookings
    .filter((b) => REBOOKABLE.includes(String(b.status)) && !!b.cleanerId
      && !b.hiddenFromRebook && !hidden.has(String(b.id)))
    .slice(0, 10);
}

type BookedAddress = {
  address?: string; addrCity?: string; addrStreet?: string; addrFloor?: string; addrApt?: string; addrPrivate?: boolean;
};

/**
 * The address a repeated booking opens on, as the form's fields.
 *
 * Every field is set, because the form stays mounted: a field left alone keeps
 * the client's primary address, and the two then combine into a place that does
 * not exist ("Rakefet 27 Harish, floor 5, Haifa, floor 3, flat 12").
 *
 * A website booking has one free-text `address` and no street fields, and its
 * `addrCity` can be the cleaner's town. So that text is kept whole, in `street`:
 * the form composes street, floor, flat and city, and with the rest empty it
 * comes out word for word. The city is split off only when the text really ends
 * in it, and never guessed from the last comma, which is as often a flat number.
 */
export function prefillFromBooking(b: BookedAddress) {
  const isPrivate = !!b.addrPrivate;
  if (b.addrStreet) {
    return { city: b.addrCity || '', street: b.addrStreet, floor: b.addrFloor || '', apt: b.addrApt || '', isPrivate };
  }
  const full = b.address || '';
  const parts = full.split(', ');
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const endsInCity = !!last && last === b.addrCity;
  return {
    city: endsInCity ? last : (full ? '' : b.addrCity || ''),
    street: endsInCity ? parts.slice(0, -1).join(', ') : full,
    floor: '', apt: '', isPrivate,
  };
}

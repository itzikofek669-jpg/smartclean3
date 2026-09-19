import { CITY_COORDS } from './jobUtils';
import { cityFromAddress } from './cityFromAddress';

/**
 * Which half of a profile each field belongs in, and what a move does to it.
 *
 * Pure: no Firestore, so it can be tested directly. lib/privateProfile.ts is
 * the half that writes. Mirrored in the website's src/lib/profileFields.ts.
 *
 * `users/{uid}` is readable by any signed-in account one document at a time —
 * chat names, cleaner cards and push tokens depend on that — and rules cannot
 * hide one field of a document. A client's uid is on every job they post, so
 * any account could read their email, phone, saved home addresses with floor
 * and flat, and GPS position; a cleaner's street address, bank account and ID
 * photo sat on the same public document.
 *
 * Stays public on purpose: name, role, city, a cleaner's phone (on her card
 * unless she turns it off) and her position, rounded to about a kilometre,
 * which discovery measures from.
 */
export const ALWAYS_PRIVATE = [
  'email', 'address', 'street', 'floor', 'apt', 'apartment', 'addresses', 'savedAddresses',
  'cleanerAddress', 'cleanerFloor', 'cleanerApt',
  'bitPhone', 'payboxLink', 'bankName', 'bankNum', 'bankBranch', 'bankAccount', 'idPhotoB64',
];

/** A cleaner's number is on her card, and clients call it. A client's is not. */
export const CLIENT_PRIVATE = ['phone', 'lat', 'lng'];

export function privateKeysFor(role?: string | null): string[] {
  return role === 'cleaner' ? ALWAYS_PRIVATE : [...ALWAYS_PRIVATE, ...CLIENT_PRIVATE];
}

/** A cleaner's public position, to about a kilometre. */
export function publicCoord(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * The city alone, for a client's public `city`.
 *
 * Registration asks a client for their home address and stored the whole of it
 * in `city` — street, number, floor, flat — on the public document. The full
 * text stays in the private half, where the owner's own screens read it back.
 */
export function publicCity(raw: string): string {
  return cityFromAddress(raw, CITY_COORDS);
}

/**
 * Split a profile write into what may be public and what may not.
 *
 * `clearPrivate` names the private keys the same write must remove — the
 * caller turns those into deleteField(), which this module cannot produce
 * without importing Firestore.
 */
export function splitFields(data: Record<string, any>, role?: string | null): {
  pub: Record<string, any>;
  priv: Record<string, any>;
  clearPrivate: string[];
} {
  const keys = privateKeysFor(role);
  const pub: Record<string, any> = {};
  const priv: Record<string, any> = {};
  const clearPrivate: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (keys.includes(k)) priv[k] = v;
    else pub[k] = v;
  }
  if (role === 'cleaner') {
    if (typeof pub.lat === 'number') pub.lat = publicCoord(pub.lat);
    if (typeof pub.lng === 'number') pub.lng = publicCoord(pub.lng);
  } else if (typeof pub.city === 'string') {
    const raw = pub.city;
    pub.city = publicCity(raw);
    // A private copy only when it says more than the public one — and cleared
    // when it does not, or an old full address would keep winning the merge.
    if (pub.city === raw.trim()) clearPrivate.push('city');
    else priv.city = raw;
  }
  return { pub, priv, clearPrivate };
}

export const isBlank = (v: any) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Keys an older build rebuilds from what it can still see on the public
 * document — by then only the city — rather than from anything the person
 * typed. Build 200's profile form writes `address` as street + city + floor +
 * flat, so with the street gone it saves "תל אביב" over a full home address,
 * even when only the name was changed.
 */
const REBUILT_BY_OLD_BUILDS = ['address', 'street', 'floor', 'apt', 'apartment', 'addresses', 'savedAddresses', 'city'];

function mergeLists(first: any[], second: any[]): any[] {
  const keyOf = (x: any) => (typeof x === 'string' ? x : String(x?.address ?? JSON.stringify(x)));
  const seen = new Set<string>();
  return [...first, ...second].filter((x) => {
    const k = keyOf(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 5);
}

/**
 * Which value the private half keeps when both halves hold the key.
 *
 * The public copy can only have come from an older build writing after the
 * move, and such a build fills its edit form from the public document, where
 * the field is now gone. So a blank there is the form's emptiness, not the
 * person clearing it, and loses; anything they actually typed — a phone, a
 * bank account — wins. Address fields are the exception (see
 * REBUILT_BY_OLD_BUILDS): there the private value wins, and address lists are
 * merged with the private entries first, since the old web client re-saved the
 * list as the one address it had just used.
 */
export function reconcile(pubVal: any, privVal: any, key?: string): any {
  if (privVal === undefined || isBlank(privVal)) return pubVal;
  if (isBlank(pubVal)) return privVal;
  const rebuilt = !!key && REBUILT_BY_OLD_BUILDS.includes(key);
  if (Array.isArray(pubVal) && Array.isArray(privVal)) {
    return rebuilt ? mergeLists(privVal, pubVal) : mergeLists(pubVal, privVal);
  }
  return rebuilt ? privVal : pubVal;
}

/** What a public profile document still has to give up, if anything. */
export function pendingMove(data: Record<string, any>) {
  const role = typeof data.role === 'string' ? data.role : null;
  const keys = privateKeysFor(role).filter((k) => data[k] !== undefined);
  const roundLat = role === 'cleaner' && typeof data.lat === 'number' && publicCoord(data.lat) !== data.lat;
  const roundLng = role === 'cleaner' && typeof data.lng === 'number' && publicCoord(data.lng) !== data.lng;
  const rawCity = role !== 'cleaner' && typeof data.city === 'string' ? data.city : null;
  const cityMoves = rawCity !== null && publicCity(rawCity) !== rawCity.trim();
  const any = keys.length > 0 || roundLat || roundLng || cityMoves;
  return { keys, roundLat, roundLng, rawCity, cityMoves, any };
}

/** Does this public profile still carry something that belongs in the private half? */
export function needsProfileMigration(data: Record<string, any> | null | undefined): boolean {
  return !!data && pendingMove(data).any;
}

import { deleteField, doc, getDoc, writeBatch, type WriteBatch } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './logError';
import { pendingMove, privateKeysFor, publicCity, publicCoord, reconcile, splitFields } from './profileFields';

/**
 * The half of a profile only its owner (and an admin) may read:
 * `users/{uid}/private/profile`.
 *
 * Which fields, and why, is lib/profileFields.ts — this is the half that reads
 * and writes. Mirrored in the website's src/lib/privateProfile.ts.
 */
export { needsProfileMigration, privateKeysFor, publicCoord } from './profileFields';

export const privateProfileRef = (uid: string) => doc(db, 'users', uid, 'private', 'profile');

/**
 * A cleaner's ID photo, in a document of its own beside the private profile.
 * Hundreds of kilobytes that only an admin reviewing it needs — on the profile
 * it rode along with every read of the owner's own details.
 */
export const idPhotoRef = (uid: string) => doc(db, 'users', uid, 'private', 'idPhoto');

/** Add both halves of a profile write to a batch. */
export function batchProfile(
  batch: WriteBatch,
  uid: string,
  data: Record<string, any>,
  role: string | null | undefined,
  mode: 'set' | 'update',
): void {
  const { pub, priv, clearPrivate } = splitFields(data, role);
  for (const k of clearPrivate) priv[k] = deleteField();
  // Any copy an older build left on the public document goes in the same
  // write. Left there it stays readable by everyone, and at the next sign-in
  // it would be reconciled against — and could undo — what was just saved.
  if (mode === 'update') {
    for (const k of Object.keys(priv)) if (privateKeysFor(role).includes(k)) pub[k] = deleteField();
  }
  if (mode === 'set') batch.set(doc(db, 'users', uid), pub);
  else if (Object.keys(pub).length) batch.update(doc(db, 'users', uid), pub);
  if (Object.keys(priv).length) batch.set(privateProfileRef(uid), priv, { merge: true });
}

export async function fetchPrivateProfile(uid: string): Promise<Record<string, any>> {
  if (!uid) return {};
  try {
    const snap = await getDoc(privateProfileRef(uid));
    return snap.exists() ? (snap.data() as Record<string, any>) : {};
  } catch (err) {
    logError('privateProfile/fetch', err);
    return {};
  }
}

/**
 * Your own profile, both halves. The private half wins where both hold a key.
 *
 * Throws when either read fails. An edit form filled from the public half
 * alone opens with the phone, addresses and bank details blank, and saving it
 * writes those blanks over the real values — offline, the public half still
 * answers from the cache while the private one does not.
 */
export async function fetchOwnProfile(uid: string): Promise<Record<string, any> | null> {
  if (!uid) return null;
  const [snap, privSnap] = await Promise.all([getDoc(doc(db, 'users', uid)), getDoc(privateProfileRef(uid))]);
  if (!snap.exists()) return null;
  return { ...snap.data(), ...(privSnap.exists() ? privSnap.data() : {}) };
}

/**
 * A client's phone, for the private half of a booking they create.
 *
 * The cleaner of a job used to read it off the client's profile, which is what
 * let everyone else read it too. It travels with the booking now.
 */
export async function ownPhone(uid: string): Promise<string> {
  try {
    const me = await fetchOwnProfile(uid);
    return typeof me?.phone === 'string' ? me.phone : '';
  } catch (err) {
    logError('privateProfile/ownPhone', err);
    return '';
  }
}

const migrated = new Set<string>();

/**
 * Move whatever private field is still on the public document — the owner's own
 * on sign-in, or anyone's from an admin. Where both halves hold a key, see
 * reconcile() in lib/profileFields.
 */
export async function migrateProfile(uid: string, data: Record<string, any> | null | undefined): Promise<boolean> {
  if (!uid || !data || migrated.has(uid)) return false;
  const { keys, roundLat, roundLng, rawCity, cityMoves, any } = pendingMove(data);
  if (!any) return false;
  migrated.add(uid);
  try {
    // Read strictly: a failed read taken as "nothing there yet" would write the
    // public blanks over the real values.
    const privSnap = await getDoc(privateProfileRef(uid));
    const existing = (privSnap.exists() ? privSnap.data() : {}) as Record<string, any>;
    const batch = writeBatch(db);
    const priv: Record<string, any> = {};
    const pub: Record<string, any> = {};
    for (const k of keys) {
      const keep = reconcile(data[k], existing[k], k);
      if (keep !== existing[k]) priv[k] = keep;
      pub[k] = deleteField();
    }
    if (roundLat) pub.lat = publicCoord(data.lat);
    if (roundLng) pub.lng = publicCoord(data.lng);
    if (cityMoves) {
      const keep = reconcile(rawCity, existing.city, 'city');
      if (keep !== existing.city) priv.city = keep;
      pub.city = publicCity(rawCity!);
    }
    if (Object.keys(priv).length) batch.set(privateProfileRef(uid), priv, { merge: true });
    batch.update(doc(db, 'users', uid), pub);
    await batch.commit();
    return true;
  } catch (err) {
    migrated.delete(uid);
    logError('privateProfile/migrate', err);
    return false;
  }
}

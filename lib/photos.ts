import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import { db } from './firebase';

/**
 * Profile photo storage — mobile side. Mirrors A-M-Clean-web/src/lib/photos.ts;
 * the two apps share one Firebase project, so the collection name, field name
 * and size cap must match exactly.
 *
 * ── Why photos are not in the user document ─────────────────────────────────
 * They used to be, as base64 under `photoB64`. The cleaner list reads every
 * cleaner document, and Firestore's client SDKs cannot fetch a subset of fields
 * — so every photo of every cleaner was downloaded just to draw a list of
 * names. A document is also capped at 1 MiB, which the photo shared with every
 * other profile field.
 *
 * ── Why not Cloud Storage ───────────────────────────────────────────────────
 * That was the first fix and it was reverted. Firebase Storage was never
 * enabled on `smartclean1-db1fb`: the bucket does not exist, and creating one
 * has required the Blaze plan since October 2024. Uploads failed — including,
 * for months, every voice note this app sent (see lib/voiceNotes.ts).
 *
 * ── What happens instead ────────────────────────────────────────────────────
 * The photo lives alone in `userPhotos/{uid}`. The list stays light, the photo
 * gets its own 1 MiB budget, and a screen pays one read for a face it actually
 * shows. `hasPhoto: true` on the user document lets a list skip even that read
 * for the profiles that have none.
 */

const PHOTOS = 'userPhotos';

/**
 * Character cap on the stored data URI, matching `firestore.rules`.
 *
 * Keep the two in step: a photo over this is rejected by the rules with a
 * permission error, which reads like a login problem rather than a big file.
 */
export const MAX_AVATAR_CHARS = 250_000;

export class AvatarTooLargeError extends Error {
  constructor() {
    super('התמונה גדולה מדי — נסה/י תמונה קטנה יותר.');
    this.name = 'AvatarTooLargeError';
  }
}

/** Session cache, shared by every screen that draws the same face. */
const cache = new Map<string, Promise<string>>();

/** `file://…` → `data:image/jpeg;base64,…`. Already-data URIs pass through. */
async function toDataUri(image: string): Promise<string> {
  if (image.startsWith('data:')) return image;
  const b64 = await FileSystem.readAsStringAsync(image, { encoding: 'base64' as any });
  return `data:image/jpeg;base64,${b64}`;
}

/**
 * Save a photo as the user's avatar. Accepts a compressed data URI or a local
 * file URI; resize before calling, or the full camera capture goes in.
 *
 * Throws `AvatarTooLargeError` rather than letting the rules reject the write —
 * a permission error here would send the user hunting for the wrong problem.
 */
export async function saveAvatar(uid: string, image: string): Promise<void> {
  if (!uid) throw new Error('saveAvatar: missing uid');
  const dataUrl = await toDataUri(image);
  if (dataUrl.length > MAX_AVATAR_CHARS) throw new AvatarTooLargeError();
  await setDoc(doc(db, PHOTOS, uid), {
    dataUrl,
    updatedAt: new Date().toISOString(),
  });
  cache.set(uid, Promise.resolve(dataUrl));
}

/** Remove a user's avatar. Best-effort: a missing document is not an error. */
export async function deleteAvatar(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PHOTOS, uid));
  } catch (_) {
    /* already gone */
  } finally {
    cache.delete(uid);
  }
}

/**
 * Read a user's avatar, or '' when there is none. Never throws — a missing
 * photo must not break the screen that wanted to draw it.
 */
export function fetchAvatar(uid: string): Promise<string> {
  if (!uid) return Promise.resolve('');
  const hit = cache.get(uid);
  if (hit) return hit;

  const pending = getDoc(doc(db, PHOTOS, uid))
    .then((snap) => (snap.exists() ? String((snap.data() as any)?.dataUrl || '') : ''))
    .catch(() => '');
  cache.set(uid, pending);
  return pending;
}

/**
 * Resolve whichever inline photo field a *legacy* user document carries.
 * Returns '' for documents written by the current build — those callers fall
 * through to `fetchAvatar()`.
 *
 * `photoUrl` was the short-lived Cloud Storage URL, `photo` an intermediate
 * spelling, `photoB64` the original inline blob.
 */
export function resolvePhoto(d: any): string {
  return d?.photoUrl || d?.photo || d?.photoB64 || '';
}

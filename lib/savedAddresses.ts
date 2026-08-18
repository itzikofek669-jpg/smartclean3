// Saved addresses for a client, stored on their Firestore user document.
//
// There used to be two implementations of this, both writing to the same
// SecureStore key with different shapes:
//
//   home.tsx     {id, address, city, street, floor, apt, isPrivate, lat, lng}
//   profile.tsx  {id, address, isPrimary, lastUsed}
//
// So an address added on the profile screen came back to the booking form with
// no city and no street, and the booking form's structured fields came back to
// the profile screen as an opaque string. Whichever screen wrote last decided
// the shape. One module now, one shape.
//
// On Firestore rather than the device, because SecureStore dies with the
// install: changing the release signing key meant uninstalling, and every saved
// address on the device went with it. These are typed by hand, they are the
// same on every device a person signs in from, and they belong with the account.

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as SecureStore from 'expo-secure-store';
import { auth, db } from './firebase';
import { logError } from './logError';

export const MAX_ADDRESSES = 5;

export type SavedAddress = {
  id: string;
  address: string;      // full formatted string (computed)
  city: string;
  street: string;       // רחוב + מספר בית
  floor: string;
  apt: string;
  isPrivate: boolean;   // בית פרטי
  isPrimary: boolean;
  lastUsed: string;
  lat?: number;
  lng?: number;
};

/** The two SecureStore keys addresses used to live under, newest first. */
const LEGACY_KEYS = () => [
  `saved_addresses_${auth.currentUser?.uid ?? 'anon'}`,
  'saved_addresses',
];

/** Fill in the fields an older or flatter record is missing. */
function normalise(raw: any, i: number): SavedAddress {
  const address = String(raw?.address ?? raw ?? '').trim();
  return {
    id: String(raw?.id ?? `${Date.now()}_${i}`),
    address,
    // A flat record has no city/street. Putting the whole string in `street`
    // keeps it visible and editable rather than silently blanking the field —
    // the same choice the old upsertAddress() compatibility shim made.
    city: String(raw?.city ?? ''),
    street: String(raw?.street ?? (raw?.city ? '' : address)),
    floor: String(raw?.floor ?? ''),
    apt: String(raw?.apt ?? ''),
    isPrivate: Boolean(raw?.isPrivate ?? false),
    isPrimary: Boolean(raw?.isPrimary ?? false),
    lastUsed: String(raw?.lastUsed ?? new Date().toISOString()),
    ...(typeof raw?.lat === 'number' ? { lat: raw.lat } : {}),
    ...(typeof raw?.lng === 'number' ? { lng: raw.lng } : {}),
  };
}

/** Exactly one entry may be primary; default to the first. */
function withOnePrimary(list: SavedAddress[]): SavedAddress[] {
  if (list.length === 0) return list;
  const idx = list.findIndex(a => a.isPrimary);
  return list.map((a, i) => ({ ...a, isPrimary: i === (idx >= 0 ? idx : 0) }));
}

/**
 * Anything still on the device, so nobody loses a list on the way over.
 * Read only — the local copies are left alone rather than deleted, in case a
 * second account on the same device has yet to migrate.
 */
async function readLegacyLocal(): Promise<SavedAddress[]> {
  for (const key of LEGACY_KEYS()) {
    try {
      const raw = await SecureStore.getItemAsync(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(normalise);
    } catch { /* a corrupt or unreadable key is not worth failing over */ }
  }
  return [];
}

/**
 * Read the signed-in client's addresses.
 *
 * Migrates on first read: an account with nothing stored yet adopts whatever
 * the device or the web's flat `addresses` list holds, and writes it back in
 * the new shape.
 */
export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.data() as any;

    const structured = data?.savedAddresses;
    if (Array.isArray(structured) && structured.length) {
      return withOnePrimary(structured.map(normalise));
    }

    // Nothing structured yet. The web has been writing plain strings to
    // `addresses` for a while, and the device may still hold a list.
    const flat: string[] = Array.isArray(data?.addresses) ? data.addresses : [];
    const merged = [...(await readLegacyLocal()), ...flat.map(normalise)];
    const deduped = withOnePrimary(
      merged.filter((a, i, all) => a.address && all.findIndex(b => b.address === a.address) === i)
            .slice(0, MAX_ADDRESSES),
    );
    if (deduped.length) await persist(uid, deduped);
    return deduped;
  } catch (err) {
    logError('savedAddresses:get', err);
    // Falling back to the device beats showing an empty list when the network
    // is the only thing that failed.
    return withOnePrimary(await readLegacyLocal());
  }
}

/**
 * Write the list, and mirror the plain strings to `addresses`.
 *
 * The web reads that flat field (src/lib/addresses.ts) and is not being changed
 * in this pass, so keeping it in step is what lets an address saved in the app
 * show up there.
 */
async function persist(uid: string, list: SavedAddress[]): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    savedAddresses: list,
    addresses: list.map(a => a.address).filter(Boolean),
  });
}

/** Add or update an address, most-recently-used first. */
export async function upsertStructuredAddress(
  fields: Omit<SavedAddress, 'id' | 'isPrimary' | 'lastUsed'>,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !fields.address.trim()) return;
  try {
    const list = await getSavedAddresses();
    const existing = list.find(a => a.address === fields.address);
    let next: SavedAddress[];
    if (existing) {
      next = list.map(a => (a.id === existing.id
        ? { ...a, ...fields, lastUsed: new Date().toISOString() }
        : a));
    } else {
      next = [
        { ...fields, id: Date.now().toString(), isPrimary: list.length === 0, lastUsed: new Date().toISOString() },
        ...list,
      ].slice(0, MAX_ADDRESSES);
    }
    await persist(uid, withOnePrimary(next));
  } catch (err) {
    logError('savedAddresses:upsert', err);
  }
}

/** Compatibility shim for callers holding only a formatted string. */
export async function upsertAddress(address: string): Promise<void> {
  await upsertStructuredAddress({
    address, city: '', street: address, floor: '', apt: '', isPrivate: false,
  });
}

export async function setPrimaryAddress(id: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const list = await getSavedAddresses();
    await persist(uid, list.map(a => ({ ...a, isPrimary: a.id === id })));
  } catch (err) {
    logError('savedAddresses:setPrimary', err);
  }
}

export async function deleteAddressById(id: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const list = await getSavedAddresses();
    await persist(uid, withOnePrimary(list.filter(a => a.id !== id)));
  } catch (err) {
    logError('savedAddresses:delete', err);
  }
}

/**
 * Replace the whole list.
 *
 * For the caller that geocodes saved addresses and writes lat/lng back onto
 * all of them at once — going through upsert one at a time would re-read and
 * re-write the document for every entry.
 */
export async function replaceSavedAddresses(list: SavedAddress[]): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await persist(uid, withOnePrimary(list.slice(0, MAX_ADDRESSES)));
  } catch (err) {
    logError('savedAddresses:replace', err);
  }
}

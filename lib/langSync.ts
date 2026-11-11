/**
 * The language a signed-in user picked, on their profile (`preferredLang`), so
 * the notification server can write their pushes in it (translation sweep,
 * 11.11.2026). Written only when it differs from what this phone last wrote
 * for that account: a write to the profile reaches every client listing
 * cleaners, so it must not happen on every launch.
 */
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import * as SecureStore from 'expo-secure-store';
import { auth, db } from './firebase';

export function useLangSync(lang: string, ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const key = `lang_synced_${user.uid}`;
      const last = await SecureStore.getItemAsync(key).catch(() => null);
      if (last === lang) return;
      try {
        await updateDoc(doc(db, 'users', user.uid), { preferredLang: lang });
        await SecureStore.setItemAsync(key, lang).catch(() => {});
      } catch {
        /* no profile yet (mid sign-up) or offline: the next change tries again */
      }
    });
  }, [lang, ready]);
}

/**
 * The language a signed-in user picked, on their profile (`preferredLang`), so
 * the notification server can write their pushes in it (translation sweep,
 * 11.11.2026).
 *
 * The phone is where pushes ring, so the phone's language is the one that
 * counts: compared with what the profile says now, not with what this phone
 * wrote last. Remembered per phone, a sign-in on the website (Hebrew by
 * default) set the profile to Hebrew, and the phone — "already wrote Russian" —
 * never put it back: every push from then on came in Hebrew (audit 22.11.2026).
 * One read per sign-in or language change; a write only when they differ, since
 * a profile write reaches every client listing cleaners.
 */
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export function useLangSync(lang: string, ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists() || snap.data()?.preferredLang === lang) return;
        await updateDoc(ref, { preferredLang: lang });
      } catch {
        /* no profile yet (mid sign-up) or offline: the next change tries again */
      }
    });
  }, [lang, ready]);
}

import { doc, deleteField, runTransaction } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from './firebase';

/**
 * Where this device's push token lives from now on: `pushTokens/{uid}`,
 * readable by its owner and an admin and by nobody else.
 *
 * The token used to live only on the public profile, and every push was sent
 * from the sender's phone straight to Expo, which asks for no credentials — so
 * any account could list every cleaner's token and push them anything. Pushes
 * are moving to the notification server (the website's worker/notify.js),
 * which reads this collection with its own service account after checking the
 * sender is really a party to the event.
 *
 * Phase D (Ofek, 11.11.2026): the profile's `pushToken` is no longer written —
 * this collection is the only copy, the notification server reads nothing
 * else, and a launch clears a token an older build left on the profile.
 */
export const pushTokenRef = (uid: string) => doc(db, 'pushTokens', uid);

export const pushTokenDoc = (token: string) => ({
  token,
  updatedAt: new Date().toISOString(),
  platform: Platform.OS,
});

/**
 * Take this phone's token out of the private document and leave the rest.
 *
 * The website keeps its browser token in the same document (`webToken`, see the
 * site's src/lib/webPush.ts). Deleting the whole document on sign-out or on
 * "notifications off" silently cut that account's browser off too; with no
 * browser token in it the document still goes. `onlyIf`: only when the stored
 * token is this one — another phone of the same account keeps its own.
 * Every write of the phone's token is merged (`{ merge: true }`) for the same
 * reason: a plain setDoc replaced the document and dropped `webToken`.
 * In a transaction: a browser registering between the read and the delete
 * would otherwise lose the token it just wrote.
 */
export async function clearPhoneToken(uid: string, onlyIf?: string): Promise<void> {
  const ref = pushTokenRef(uid);
  await runTransaction(db, async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists()) return;
    const d = cur.data();
    if (onlyIf !== undefined && d?.token !== onlyIf) return;
    if (d?.webToken) tx.update(ref, { token: deleteField(), platform: deleteField() });
    else tx.delete(ref);
  });
}

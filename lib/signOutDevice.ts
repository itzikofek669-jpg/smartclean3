import { signOut } from 'firebase/auth';
import { doc, getDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { auth, db } from './firebase';
import { pushTokenRef } from './pushTokenStore';
import { logError } from './logError';

const within = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

/**
 * Sign out, first taking this device's push token off the account.
 *
 * Nothing cleared it. A user who logged out kept receiving pushes — chat message
 * text included — and when another account signed in on the same phone both held
 * the same token, so the first account's messages showed on the second person's
 * phone. Only a token matching this device is removed: another phone of the same
 * account keeps its own, and every device writes its token again on sign-in.
 * Best effort, and bounded — signing out must never hang on the network.
 */
export async function signOutOfDevice(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId ??
        Constants.expoConfig?.slug;
      const perm = await Notifications.getPermissionsAsync();
      if (projectId && perm.status === 'granted') {
        const token = (await within(Notifications.getExpoPushTokenAsync({ projectId }), 4000))?.data;
        if (token) {
          await within(runTransaction(db, async (tx) => {
            const ref = doc(db, 'users', uid);
            const cur = await tx.get(ref);
            if (cur.exists() && cur.data()?.pushToken === token) tx.update(ref, { pushToken: '' });
          }), 4000);
          // The private copy too, or the notification server keeps ringing a
          // phone its owner signed out of. Its own step, best effort: until the
          // rules opening `pushTokens` are deployed it is refused, and that must
          // not stop the profile's token being cleared. See lib/pushTokenStore.
          await within((async () => {
            const priv = pushTokenRef(uid);
            const mine = await getDoc(priv);
            if (mine.exists() && mine.data()?.token === token) await deleteDoc(priv);
          })(), 4000).catch(err => logError('signOutOfDevice:private', err));
        }
      }
    } catch (err) {
      logError('signOutOfDevice', err);
    }
  }
  await signOut(auth);
}

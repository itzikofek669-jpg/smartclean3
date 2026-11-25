import { signOut } from 'firebase/auth';
import { doc, runTransaction } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { auth, db } from './firebase';
import { clearPhoneToken } from './pushTokenStore';
import { logError } from './logError';
import { Platform } from 'react-native';

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
      const token = projectId && perm.status === 'granted'
        ? (await within(Notifications.getExpoPushTokenAsync({ projectId }), 4000).catch(() => null))?.data
        : undefined;
      if (token) {
        // The old copy on the profile, its own step: a failure here skipped the
        // private copy below, and the phone kept ringing (audit 22.11.2026).
        await within(runTransaction(db, async (tx) => {
          const ref = doc(db, 'users', uid);
          const cur = await tx.get(ref);
          if (cur.exists() && cur.data()?.pushToken === token) tx.update(ref, { pushToken: '' });
        }), 4000).catch(err => logError('signOutOfDevice:profile', err));
      }
      // The private copy, or the notification server keeps ringing a phone its
      // owner signed out of — also when notifications were switched off since,
      // and there is no token to name: then this kind of phone's. Only the
      // phone's token: the website's webToken shares the document.
      // Without a token only when notifications are off here — not when the
      // token fetch merely failed offline, or another phone's token could go.
      const clear = token ? clearPhoneToken(uid, token)
        : perm.status !== 'granted' ? clearPhoneToken(uid, undefined, Platform.OS) : null;
      if (clear) await within(clear, 4000).catch(err => logError('signOutOfDevice:private', err));
    } catch (err) {
      logError('signOutOfDevice', err);
    }
  }
  await signOut(auth);
}

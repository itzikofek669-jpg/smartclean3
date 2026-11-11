import { doc } from 'firebase/firestore';
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

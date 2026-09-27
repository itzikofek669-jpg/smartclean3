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
 * During the move every write here is mirrored on the profile's `pushToken`,
 * because builds up to 204 still send directly and read it there. The last
 * step of the migration drops the profile field and this note with it.
 */
export const pushTokenRef = (uid: string) => doc(db, 'pushTokens', uid);

export const pushTokenDoc = (token: string) => ({
  token,
  updatedAt: new Date().toISOString(),
  platform: Platform.OS,
});

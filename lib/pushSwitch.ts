import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { pushTokenRef, pushTokenDoc } from './pushTokenStore';
import { logError } from './logError';

/**
 * What became of switching this phone's alerts on.
 *
 *   'on'       — registered: pushes reach this phone again.
 *   'denied'   — the system permission is off, and asking did not change it.
 *   'expo-go'  — Expo Go on Android, which has had no remote push since SDK 53.
 *   'no-token' — the system gave no token. In a real build that is a fault
 *                (logged), not "development mode".
 */
export type PushOnResult = 'on' | 'denied' | 'expo-go' | 'no-token';

/**
 * Whether the system lets this app show alerts at all. Null when that cannot
 * be told, or does not apply (Expo Go on Android) — and null is not a warning.
 */
export async function pushPermission(): Promise<boolean | null> {
  if (Constants.appOwnership === 'expo' && Platform.OS === 'android') return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    // Not asked yet: registerPushToken (app/_layout) asks at sign-in, and until
    // that is answered there is nothing to warn about.
    return status === 'undetermined' ? null : false;
  } catch (err) {
    logError('pushSwitch:check', err);
    return null;
  }
}

/**
 * Switch alerts back on for this account, on this phone: ask the system for
 * permission, fetch the device's token and record it — on the profile, with the
 * opt-out cleared, and in the private copy the notification server reads
 * (lib/pushTokenStore).
 *
 * One place, because two screens do it: the profile's switch, and the warning a
 * provider sees on the home screen while her alerts are off (lib/pushState).
 *
 * Throws only when the profile write itself is refused; the caller says so.
 */
export async function turnPushOn(uid: string): Promise<PushOnResult> {
  let status = 'undetermined';
  try {
    const existing = await Notifications.getPermissionsAsync();
    status = existing.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  } catch (err) {
    logError('pushSwitch:permission', err);
    status = 'denied';
  }
  if (status !== 'granted') return 'denied';

  if (Constants.appOwnership === 'expo' && Platform.OS === 'android') return 'expo-go';

  let token = '';
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId ??
      Constants.expoConfig?.slug ?? '';
    if (projectId) token = (await Notifications.getExpoPushTokenAsync({ projectId }))?.data ?? '';
  } catch (err) {
    logError('pushSwitch:token', err);
  }
  if (!token) return 'no-token';

  // The opt-out is cleared in the same write: registerPushToken (app/_layout)
  // leaves an opted-out account alone, so a token written beside the flag would
  // never be refreshed, and the server would go on skipping the account.
  await updateDoc(doc(db, 'users', uid), { pushToken: token, pushOptOut: false });
  await setDoc(pushTokenRef(uid), pushTokenDoc(token)).catch(err => logError('pushSwitch:private', err));
  return 'on';
}

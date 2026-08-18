import * as SecureStore from 'expo-secure-store';
import { logError } from './logError';

/**
 * Per-device opt-in for the synthetic demo cleaners.
 *
 * They used to be gated on `__DEV__` alone, which meant they vanished from
 * exactly the build being tested — a release APK. This flag brings them back
 * for whoever asks for them, on their own device, and leaves every other
 * install untouched.
 *
 * Off by default, and that is deliberate rather than cautious. The demo
 * cleaners carry invented names, invented ratings and photographs of real
 * people pulled from someone else's service. Mixing those into the list a
 * paying customer browses is fabricated advertising; nothing about testing
 * requires that anyone but the tester can see them. Booking and chat refuse a
 * demo id in every build regardless of this flag.
 */
const KEY = 'amclean_demo_cleaners';

// Read synchronously by the cleaner list, so it is cached in memory and primed
// once at startup rather than awaited on every render.
let enabled = false;

/** True when this device has opted in. Always true in a dev build. */
export function demoCleanersEnabled(): boolean {
  return __DEV__ || enabled;
}

/** Load the stored preference. Called once, at app start. */
export async function loadDemoMode(): Promise<void> {
  try {
    enabled = (await SecureStore.getItemAsync(KEY)) === '1';
  } catch (err) {
    logError('demoMode:load', err);
  }
}

/** Turn demo cleaners on or off for this device, and remember it. */
export async function setDemoMode(on: boolean): Promise<void> {
  enabled = on;
  try {
    if (on) await SecureStore.setItemAsync(KEY, '1');
    else await SecureStore.deleteItemAsync(KEY);
  } catch (err) {
    logError('demoMode:save', err);
  }
}

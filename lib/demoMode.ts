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

/**
 * TEMPORARY — demo data on unless this device has explicitly turned it off.
 *
 * On for the duration of testing so nobody has to walk into the admin screen
 * on every install just to see the demo cleaners and the demo job board.
 *
 * TO REVERT: set this to false. That restores opt-in without touching
 * anything else — the stored preference is still read, and a device that
 * chose either way keeps its choice. Search DEMO_DEFAULT_ON; the web has
 * the same switch in src/lib/botCleaners.ts and both must be turned back
 * together.
 */
const DEMO_DEFAULT_ON = true;

// Read synchronously by the cleaner list, so it is cached in memory and primed
// once at startup rather than awaited on every render.
let enabled = DEMO_DEFAULT_ON;

/** True when this device has opted in. Always true in a dev build. */
export function demoCleanersEnabled(): boolean {
  return __DEV__ || enabled;
}

/** Load the stored preference. Called once, at app start. */
export async function loadDemoMode(): Promise<void> {
  try {
    // Three states, not two: unset means "never decided" and follows the
    // default, which is what lets the default be flipped without overriding
    // someone who deliberately turned it off.
    const stored = await SecureStore.getItemAsync(KEY);
    enabled = stored === null ? DEMO_DEFAULT_ON : stored === '1';
  } catch (err) {
    logError('demoMode:load', err);
  }
}

/** Turn demo cleaners on or off for this device, and remember it. */
export async function setDemoMode(on: boolean): Promise<void> {
  enabled = on;
  try {
    // '0' rather than deleting: an absent key means "never decided" and
    // would fall back to the default, so turning it off would not stick.
    await SecureStore.setItemAsync(KEY, on ? '1' : '0');
  } catch (err) {
    logError('demoMode:save', err);
  }
}

/**
 * The stored per-device preference, ignoring the `__DEV__` override.
 *
 * The admin toggle shows this rather than `demoCleanersEnabled()`: in a dev
 * build the latter is always true, so a switch bound to it would sit on ON and
 * ignore being turned off, which reads as a broken control rather than as the
 * override it is.
 */
export function demoModeStored(): boolean {
  return enabled;
}

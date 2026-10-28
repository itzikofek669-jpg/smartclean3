import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, connectAuthEmulator } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from './firebaseConfig';

// `getReactNativePersistence` lives only in Firebase's React-Native entry point.
// Metro resolves it at runtime via the package's "react-native" export
// condition, but the default `firebase/auth` types don't expose it — so pull it
// off the namespace with a cast to keep both `tsc` and Metro happy.
const getReactNativePersistence = (firebaseAuth as any).getReactNativePersistence as (
  storage: typeof AsyncStorage,
) => import('firebase/auth').Persistence;

const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);

export const auth = getApps().length > 1
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

export const db = getFirestore(app);

// ── Local emulator, development only ─────────────────────────────────────────
// The app talks to the live project, so any screen behind a login could only
// be looked at with a real account — which meant UI changes to the chat, the
// profile or the board went into an APK unseen. Set EXPO_PUBLIC_USE_EMULATOR=1
// and the app points at the emulators instead, the way the website's
// `npm run dev:emulated` already does:
//
//   cd ~/Projects/A-M-Clean && npm run emulators      # then, in another shell:
//   node scripts/seed-emulator.mjs
//   cd ~/Projects/smartclean3 && EXPO_PUBLIC_USE_EMULATOR=1 npx expo run:ios
//
// CI never sets the flag, so a release build cannot pick this up. On a
// simulator `localhost` is this Mac; a real device needs the Mac's address in
// EXPO_PUBLIC_EMULATOR_HOST.
if (process.env.EXPO_PUBLIC_USE_EMULATOR === '1') {
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || 'localhost';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8085);
  console.warn(`[firebase] emulators on ${host} — this is not the live project`);
}

// No `storage` export on purpose. Firebase Storage was never enabled on this
// project — the bucket does not exist, and creating one has required the Blaze
// plan since October 2024 — so every upload that reached for it failed, quietly,
// for months. Photos and voice notes now go to Firestore: see lib/photos.ts and
// lib/voiceNotes.ts.

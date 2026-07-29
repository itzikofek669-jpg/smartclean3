import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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

export const db      = getFirestore(app);
export const storage = getStorage(app, 'gs://smartclean1-db1fb.firebasestorage.app');

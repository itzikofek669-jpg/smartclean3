import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from './firebaseConfig';

const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);

export const auth = getApps().length > 1
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

export const db      = getFirestore(app);
export const storage = getStorage(app, 'gs://smartclean1-db1fb.firebasestorage.app');

import { useEffect, useState, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { LanguageProvider } from '../lib/LanguageContext';
import { ThemeProvider } from '../lib/ThemeContext';
import { useFonts, NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari';

// ── הגדרת התנהגות כשהאפליקציה פתוחה בפורגראונד ─────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

// ── הגדרת ערוץ אנדרואיד עם צליל ─────────────────────────────────────────────
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('messages', {
    name:              'הודעות',
    importance:        Notifications.AndroidImportance.MAX,
    vibrationPattern:  [0, 250, 250, 250],
    sound:             'default',
    enableLights:      true,
    lightColor:        '#185FA5',
  }).catch(() => {});
}

// ── רישום push token ושמירה ב-Firestore ──────────────────────────────────────
async function registerPushToken(uid: string) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId ??
      Constants.expoConfig?.slug;

    if (!projectId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    if (!token) return;

    await updateDoc(doc(db, 'users', uid), { pushToken: token });
  } catch (_) {}
}

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();
  const [ready,  setReady]  = useState(false);
  const [fontsLoaded, fontError] = useFonts({ NotoSansDevanagari_400Regular });
  const readyRef = useRef(false); // ref לגישה בטוחה מתוך callbacks

  // ── Auth routing ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let unsubAuth: (() => void) | undefined;

    (async () => {
      try {
        const savedEmail = await SecureStore.getItemAsync('remember_email');
        const savedPass  = await SecureStore.getItemAsync('remember_pass');
        if (savedEmail && savedPass && !auth.currentUser) {
          await signInWithEmailAndPassword(auth, savedEmail, savedPass);
        }
      } catch (_) {
        await SecureStore.deleteItemAsync('remember_email').catch(() => {});
        await SecureStore.deleteItemAsync('remember_pass').catch(() => {});
      }

      unsubAuth = onAuthStateChanged(auth, user => {
        if (cancelled) return;
        readyRef.current = true;
        setReady(true);
        const seg0 = segments[0] as string | undefined;
        const inAuth = seg0 === undefined || seg0 === 'index' || seg0 === 'register';
        const ADMIN_EMAIL = 'cleantouchapp@gmail.com';
        if (!user && !inAuth) router.replace('/');
        else if (user && inAuth) {
          if (user.email === ADMIN_EMAIL) {
            router.replace('/admin');
          } else {
            // בדוק אם מנקה עם הזמנות ממתינות
            (async () => {
              try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const role = userDoc.data()?.role;
                if (role === 'cleaner') {
                  const q = query(
                    collection(db, 'bookings'),
                    where('cleanerId', '==', user.uid),
                    where('status', '==', 'pending')
                  );
                  const snap = await getDocs(q);
                  if (!snap.empty) {
                    router.replace('/profile');
                    return;
                  }
                }
              } catch (_) {}
              router.replace('/home');
            })();
          }
        }
        if (user) registerPushToken(user.uid);
      });
    })();

    return () => {
      cancelled = true;
      if (unsubAuth) unsubAuth();
    };
  }, [segments]);

  // ── מאזיני התראות — רק פעם אחת, נפרד מה-auth effect ────────────────────
  useEffect(() => {
    // לחיצה על התראה כשהאפליקציה סגורה/ברקע
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const data = response.notification.request.content.data as any;
        if (!readyRef.current) return;
        if (data?.type === 'new_booking') {
          router.push('/profile');
        } else if (data?.type === 'urgent' || data?.urgent === true) {
          router.push('/profile?tab=urgent');
        }
      } catch (_) {}
    });

    // התראה שמגיעה כשהאפליקציה פתוחה (foreground)
    const receiveSub = Notifications.addNotificationReceivedListener(notification => {
      try {
        const data = notification.request.content.data as any;
        if ((data?.type === 'urgent' || data?.urgent === true) && readyRef.current) {
          router.push('/profile?tab=urgent');
        }
      } catch (_) {}
    });

    return () => {
      responseSub.remove();
      receiveSub.remove();
    };
  }, []); // רץ רק פעם אחת!

  if (!ready || (!fontsLoaded && !fontError)) return null;

  return (
    <View style={ls.root}>
      <ThemeProvider>
        <LanguageProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </LanguageProvider>
      </ThemeProvider>
    </View>
  );
}

const ls = StyleSheet.create({
  root: { flex: 1, direction: 'ltr' },
});

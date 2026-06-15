import React, { useEffect, useState, useRef } from 'react';
import { Platform, View, StyleSheet, Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getActiveChat } from '../lib/chatPresence';
import { LanguageProvider } from '../lib/LanguageContext';
import { ThemeProvider } from '../lib/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari';

// ── הגדרת התנהגות כשהאפליקציה פתוחה בפורגראונד ─────────────────────────────
// להודעות צ'אט: בפורגראונד לא מציגים באנר מערכת — הפופ-אפ הפנימי (Firestore) מטפל,
// כדי שתהיה רק הקפצה אחת. ברקע המערכת ממילא מציגה את הפוש כרגיל.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = (notification?.request?.content?.data as any)?.type;
    const isMessage = type === 'message';
    return {
      shouldShowAlert:  !isMessage,
      shouldShowBanner: !isMessage,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   true,
    };
  },
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

  // ── ערוץ ניקיון דחוף — צבע אדום בולט, רטט חזק, אור אדום ──
  Notifications.setNotificationChannelAsync('urgent', {
    name:              'ניקיון דחוף',
    importance:        Notifications.AndroidImportance.MAX,
    vibrationPattern:  [0, 400, 200, 400, 200, 400],
    sound:             'default',
    enableLights:      true,
    lightColor:        '#FF1744',
    enableVibrate:     true,
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
  const pendingNavRef  = useRef<any>(null);   // ניווט מפוש שהגיע לפני מוכנות
  const launchHandledRef = useRef(false);     // טופלה ההתראה שהפעילה את האפליקציה

  // ניווט לפי סוג ההתראה
  const navForNotification = (data: any) => {
    if (!data) return;
    if (data.type === 'new_booking') {
      // open the cleaner's bookings tab and the confirm modal for THIS booking
      router.push({ pathname: '/profile', params: { tab: data.tab || 'bookings', confirmBookingId: data.bookingId || '' } });
    } else if (data.type === 'booking_confirmed') {
      router.push('/profile');
    } else if (data.type === 'urgent' || data.urgent === true) {
      // הקשה על פוש דחוף = "אני לוקח/ת" → לפרופיל → קבלה אוטומטית + מסך אישור/צ'אט (overlay מכסה את ההבזק)
      router.push({ pathname: '/profile', params: { tab: 'urgent', acceptReqId: data.requestId || '' } });
    } else if (data.type === 'message') {
      router.push('/messages');
    }
  };

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
        const ADMIN_EMAILS = ['cleantouchapp@gmail.com'];
        if (!user && !inAuth) router.replace('/');
        else if (user && inAuth) {
          if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
            router.replace('/admin');
          } else {
            router.replace('/home');
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

  // ── פופ-אפ הודעה חדשה — גלובלי (בכל מסך), ללא תלות בהתראות פוש ──────────────
  useEffect(() => {
    let chatUnsub: (() => void) | undefined;
    const stamps: Record<string, string> = {};
    let inited = false;
    const unsubAuth = onAuthStateChanged(auth, user => {
      if (chatUnsub) { chatUnsub(); chatUnsub = undefined; }
      inited = false;
      Object.keys(stamps).forEach(k => delete stamps[k]);
      if (!user) return;
      const uid = user.uid;
      const qChats = query(collection(db, 'chats'), where('participants', 'array-contains', uid));
      chatUnsub = onSnapshot(qChats, snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        if (!inited) {
          docs.forEach((c: any) => { stamps[c.id] = c.lastMessageAt || ''; });
          inited = true;
          return;
        }
        let popped = false; // פופ-אפ אחד לכל אצווה — לא אחרי כל הודעה
        docs.forEach((c: any) => {
          const prev = stamps[c.id] || '';
          const cur  = c.lastMessageAt || '';
          stamps[c.id] = cur;
          if (!cur || cur === prev || popped) return;
          if (getActiveChat() === c.id) return;   // המשתמש כבר בצ'אט הזה — לא להקפיץ
          const forMe     = Array.isArray(c.unreadBy) && c.unreadBy.includes(uid);
          // הודעה נכנסת בלבד — לא הודעה ששלחתי בעצמי (לפי lastSenderUid אם קיים)
          const fromOther = c.lastSenderUid ? c.lastSenderUid !== uid : forMe;
          if (forMe && fromOther) {
            popped = true;
            const otherUid  = (Array.isArray(c.participants) ? c.participants.find((p: string) => p !== uid) : '') || '';
            const otherName = (c.participantNames && c.participantNames[otherUid]) || '';
            Alert.alert('📩 הודעה חדשה', 'קיבלת הודעה חדשה.', [
              { text: 'סגור', style: 'cancel' },
              { text: 'פתח צ\'אט', onPress: () => {
                if (!readyRef.current) return;
                router.push({ pathname: '/messages', params: { openChatId: c.id, openOtherUid: otherUid, openOtherName: otherName } });
              } },
            ]);
          }
        });
      }, () => {});
    });
    return () => { if (chatUnsub) chatUnsub(); unsubAuth(); };
  }, []);

  // ── מאזיני התראות — רק פעם אחת, נפרד מה-auth effect ────────────────────
  useEffect(() => {
    // לחיצה על התראה כשהאפליקציה סגורה/ברקע
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        const data = response.notification.request.content.data as any;
        // אם האפליקציה עוד לא מוכנה (נפתחה מהלחיצה) — נשמור ונבצע כשתהיה מוכנה
        if (!readyRef.current) { pendingNavRef.current = data; return; }
        navForNotification(data);
      } catch (_) {}
    });

    // התראה שמגיעה כשהאפליקציה פתוחה (foreground):
    // לא מנווטים! הכל (כולל דחוף) מטופל ע"י מאזיני Firestore בזמן-אמת (home.tsx) —
    // פופ-אפ דחוף מותאם נשאר במסך הראשי, וניווט קורה רק כשלוחצים "אשר".
    const receiveSub = Notifications.addNotificationReceivedListener(() => {});

    return () => {
      responseSub.remove();
      receiveSub.remove();
    };
  }, []); // רץ רק פעם אחת!

  // כשהאפליקציה מוכנה — בצע את הניווט מהלחיצה על הפוש (גם cold start)
  useEffect(() => {
    if (!ready) return;
    // 1) ניווט שנשמר ממאזין שרץ לפני מוכנות
    if (pendingNavRef.current) {
      const d = pendingNavRef.current; pendingNavRef.current = null;
      launchHandledRef.current = true;
      setTimeout(() => navForNotification(d), 350);
      return;
    }
    // 2) ההתראה שהפעילה את האפליקציה מהמצב הסגור (פעם אחת בלבד)
    if (!launchHandledRef.current) {
      launchHandledRef.current = true;
      Notifications.getLastNotificationResponseAsync().then((resp: any) => {
        if (!resp) return;
        const data = resp?.notification?.request?.content?.data;
        if (data) setTimeout(() => navForNotification(data), 350);
      }).catch(() => {});
    }
  }, [ready]);

  if (!ready || (!fontsLoaded && !fontError)) return null;

  return (
    <SafeAreaProvider>
      <View style={ls.root}>
        <ThemeProvider>
          <LanguageProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </LanguageProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}

const ls = StyleSheet.create({
  root: { flex: 1, direction: 'ltr' },
});


import React, { useEffect, useState, useRef } from 'react';
import { Platform, View, StyleSheet, Alert, LogBox } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getActiveChat } from '../lib/chatPresence';
import { logError } from '../lib/logError';
import { mustVerifyEmail } from '../lib/emailVerification';
import { loadDemoMode } from '../lib/demoMode';
import { loadDiagnostics, diagnosticsEnabled, record } from '../lib/diagnostics';
import { primeCalendarPermission, addBookingToCalendar, removeBookingFromCalendar, calendarSyncMessage } from '../lib/calendarSync';
import { LanguageProvider } from '../lib/LanguageContext';
import { ThemeProvider } from '../lib/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari';
import ErrorBoundary from '../lib/ErrorBoundary';

// Hide the Expo Go push-notification warnings (remote push isn't supported in
// Expo Go since SDK 53; works in a real build). Avoids the red error overlay.
LogBox.ignoreLogs([
  /expo-notifications/i,
  'Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

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
  // Remote push tokens don't work in Expo Go (SDK 53+) — skip to avoid the error.
  if (Constants.appOwnership === 'expo') return;
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

/** `YYYY-MM-DD` as day-first `DD/MM/YYYY`, the order Hebrew readers expect. */
function formatCancelDate(iso: string): string {
  const m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
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

  // Demo-cleaner opt-in is stored per device; read it once before the
  // cleaner list is built. See lib/demoMode.
  useEffect(() => { loadDemoMode(); loadDiagnostics(); }, []);

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

      // חשבון שנרשם תחת דרישת אימות המייל ולא אימת — לא נכנס, גם לא דרך
      // "זכור אותי" ולא דרך סשן ששרד במכשיר.
      //
      // נבדק כאן, לפני שההאזנה מתחילה לנתב, ולא בתוך ההאזנה עצמה: שם הוא היה
      // מנתק גם את החשבון שנוצר ברגע זה במסך ההרשמה (ומפיל את כתיבת הפרופיל
      // שרצה מיד אחריו) וגם את השליחה החוזרת של קישור האימות ממסך הכניסה.
      // שני המסכים האלה מתנתקים בעצמם בסיום.
      //
      // ה-reload נדרש כי הדגל צרוב באסימון: מי שאימת בדפדפן עדיין נושא אסימון
      // ישן, ובלעדיו היה נחסם בדיוק על ידי הבדיקה שהקישור אמור היה לספק.
      const restored = auth.currentUser;
      if (!cancelled && restored && mustVerifyEmail(restored)) {
        await restored.reload().catch(() => {});
        if (!cancelled && mustVerifyEmail(restored)) {
          await SecureStore.deleteItemAsync('remember_email').catch(() => {});
          await SecureStore.deleteItemAsync('remember_pass').catch(() => {});
          await signOut(auth).catch(() => {});
        }
      }

      unsubAuth = onAuthStateChanged(auth, user => {
        if (cancelled) return;
        readyRef.current = true;
        setReady(true);
        const seg0 = segments[0] as string | undefined;
        const inAuth = seg0 === undefined || seg0 === 'index' || seg0 === 'register';
        // חייב להיות זהה ל-isAdmin() ב-firestore.rules ולרשימות בווב ובפונקציות.
        const ADMIN_EMAILS = ['cleantouchapp@gmail.com', 'itzikofek669@gmail.com'];
        if (!user && !inAuth) router.replace('/');
        else if (user && inAuth) {
          if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
            router.replace('/admin');
          } else {
            router.replace('/home');
          }
        }
        if (user) {
          registerPushToken(user.uid);
          primeCalendarPermission();
        }
      });
    })();

    return () => {
      cancelled = true;
      if (unsubAuth) unsubAuth();
    };
  }, [segments]);

  // ── סנכרון יומן — גלובלי, בכל מסך ──────────────────────────────────────────
  //
  // This belongs at the root and nowhere else. Every calendar call used to live
  // in home.tsx or profile.tsx, which unmount the moment you navigate away — so
  // whether a booking reached the device calendar depended on which screen the
  // user happened to be looking at.
  //
  // That is why the cleaner's side always appeared to work and the client's
  // never did: a cleaner confirms FROM the profile screen, so its listener was
  // mounted by definition. The client is somewhere else entirely when their
  // cleaner approves, and a cleaner is rarely sitting on their profile when a
  // client cancels — so that removal had no path either.
  //
  // Two listeners because a user can be both parties on different bookings, and
  // Firestore has no OR across fields. Both are idempotent (see calendarSync),
  // so a booking seen by both costs nothing.
  useEffect(() => {
    let unsubClient: (() => void) | undefined;
    let unsubCleaner: (() => void) | undefined;

    // Actionable failures are worth telling the user about, but once — not once
    // per booking in the snapshot, which on a busy account would be a wall of
    // identical alerts.
    let warned = false;
    // Bookings whose calendar entry we have already taken out on this run.
    const removedCancelled = new Set<string>();

    const sync = (b: any, role: 'client' | 'cleaner') => {
      if (b?.status === 'confirmed') {
        addBookingToCalendar(b, { role })
          .then(res => {
            // Every outcome, not just the two that used to be logged. The
            // silent ones — already-synced above all — are exactly the
            // answers we could never get out of a release build.
            record(`calendar:${role}`, { id: b.id, date: b.bookingDate, time: b.startTime, res });
            if (res === 'bad-slot' || res === 'no-id') {
              logError('layout:calendarSlot', { id: b.id, bookingDate: b.bookingDate, startTime: b.startTime, res });
              return;
            }
            const msg = calendarSyncMessage(res);
            if (msg && !warned) { warned = true; Alert.alert('', msg); }
            else if (diagnosticsEnabled() && res !== 'added' && !warned) {
              warned = true;
              Alert.alert('אבחון — יומן', `תפקיד: ${role}
תוצאה: ${res}`);
            }
          })
          .catch(err => logError('layout:calendarAdd', err));
      }
      if (b?.status === 'cancelled') {
        // Remove once per booking, not once per snapshot.
        //
        // This callback runs over every document on every snapshot, so an
        // already-cancelled booking was re-processed on every launch and every
        // change. The stray-sweep inside identifies events by start minute
        // alone, so each replay re-swept that old slot -- and a NEW booking for
        // the same hour later on was created and then deleted moments
        // afterwards by the ghost of the cancelled one. That is the "the
        // booking never reaches the calendar" report.
        //
        // The sweep is opt-in now and fires only here, the first time we see
        // this particular booking cancelled.
        if (!removedCancelled.has(b.id)) {
          removedCancelled.add(b.id);
          // Which role's listener saw the cancellation is the thing that
          // separates "the removal ran and failed" from "this device never
          // heard about it" — and those need completely different fixes.
          record(`cancel:${role}`, { id: b.id, date: b.bookingDate });
          removeBookingFromCalendar(b.id, b, { sweep: true })
            .catch(err => logError('layout:calendarRemove', err));
        }
      }
    };

    /**
     * Tell the CLEANER when a client calls a booking off.
     *
     * The app had no such notice at all. The client gets a full popup when a
     * cleaner cancels (home.tsx), but the mirror case — the one that costs a
     * cleaner their afternoon — was silent: the card simply disappeared from
     * their list. The web has had this since the cancellation work; the app
     * never got it.
     *
     * Lives here rather than on the profile screen so it reaches them wherever
     * they are, and skips their own cancellations — they pressed the button.
     */
    const seenCancelled = new Set<string>();
    let firstSnapshot = true;

    const noticeForCleaner = (b: any) => {
      if (b?.status !== 'cancelled' || b?.cancelledBy === 'cleaner') return;
      if (seenCancelled.has(b.id)) return;
      seenCancelled.add(b.id);
      // The first snapshot is history, not news — announcing it would replay
      // every past cancellation on every launch.
      if (firstSnapshot) return;
      const when = b.bookingDate
        ? `${formatCancelDate(b.bookingDate)}${b.startTime ? ` ${b.startTime}` : ''}`
        : '';
      Alert.alert(
        '❌ ההזמנה בוטלה',
        `הלקוח ביטל את ההזמנה${b.clientName ? ` — ${b.clientName}` : ''}.`
        + (when ? `\n${when}` : '')
        + '\nהשעה התפנתה ביומן שלך.',
        [{ text: 'הבנתי' }],
      );
    };

    const watch = (field: 'clientUid' | 'cleanerId', role: 'client' | 'cleaner', uid: string) =>
      onSnapshot(
        // No orderBy: pairing a where with an orderBy on another field needs a
        // composite index this project does not have, and the query would fail
        // outright. Order is irrelevant here anyway.
        query(collection(db, 'bookings'), where(field, '==', uid)),
        snap => {
          snap.docs.forEach(d => {
            const b = { id: d.id, ...(d.data() as any) };
            sync(b, role);
            // Only on the cleaner's own listener — on the client's, they are
            // the one who cancelled.
            if (role === 'cleaner') noticeForCleaner(b);
          });
          if (role === 'cleaner') firstSnapshot = false;
        },
        err => {
          logError(`layout:${role}Bookings`, err);
          // A failed query means the sync never even ran for this role.
          if (diagnosticsEnabled()) {
            Alert.alert('אבחון — שאילתת הזמנות נכשלה', `תפקיד: ${role}
${(err as any)?.message ?? err}`);
          }
        },
      );

    const unsubAuth = onAuthStateChanged(auth, user => {
      unsubClient?.(); unsubClient = undefined;
      unsubCleaner?.(); unsubCleaner = undefined;
      // A different account starts with a clean slate, or the previous user's
      // cancellations would be treated as already announced.
      seenCancelled.clear();
      removedCancelled.clear();
      firstSnapshot = true;
      if (!user) return;
      unsubClient = watch('clientUid', 'client', user.uid);
      unsubCleaner = watch('cleanerId', 'cleaner', user.uid);
    });

    return () => { unsubAuth(); unsubClient?.(); unsubCleaner?.(); };
  }, []);

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
          // An automatic message announcing something the user is already
          // being told about by a dialog. It belongs in the chat, not on top
          // of the dialog that says the same thing.
          if (c.lastMessageAuto === true) return;
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

  // הגבול יושב בתוך הספקים ולא מחוץ להם: מסך הקריסה צריך להיות מסוגל להציג
  // עברית בערכת הנושא של המשתמש. בלעדיו, שגיאת רינדור אחת מפרקת את כל העץ
  // ומשאירה מסך לבן שאפשר לצאת ממנו רק בסגירה כפויה של האפליקציה.
  return (
    <SafeAreaProvider>
      <View style={ls.root}>
        <ThemeProvider>
          <LanguageProvider>
            <ErrorBoundary context="root">
              <Stack screenOptions={{ headerShown: false }} />
            </ErrorBoundary>
          </LanguageProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}

const ls = StyleSheet.create({
  root: { flex: 1, direction: 'ltr' },
});


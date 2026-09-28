import { AppState } from 'react-native';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { logError } from './logError';

// מעקב אחרי הצ'אט הפעיל כרגע (פתוח על המסך).
//
// שני שימושים:
//   • בתוך האפליקציה — לא להקפיץ פופ-אפ "הודעה חדשה", ולא להשמיע צליל על
//     התראה, כשהמשתמש כבר נמצא באותו צ'אט (ראה app/_layout.tsx).
//   • מחוץ לה — הצ'אט הפתוח נרשם ב-chatPresence/{uid}, ושרת ההתראות לא שולח
//     פוש על הודעה למי שכבר מסתכל על אותה שיחה: לא לטלפון שביד, ולא לטלפון
//     שמונח על השולחן בזמן שהשיחה פתוחה באתר. האתר רושם באותו מקום.
//
// הרישום מתרענן כל חצי דקה כל עוד הצ'אט פתוח והאפליקציה בחזית, ונמחק ביציאה
// מהצ'אט או במעבר לרקע — וההתראות חוזרות מיד. השרת מתייחס לרישום כעדכני עד
// 75 שניות, כך שטלפון שנסגר בלי להספיק למחוק לא משתיק התראות לאורך זמן.

const HEARTBEAT_MS = 30_000;

let activeChatId: string | null = null;
let appActive = AppState.currentState === 'active';
let beat: ReturnType<typeof setInterval> | null = null;
let published = false;

function presenceRef() {
  const uid = auth.currentUser?.uid;
  return uid ? doc(db, 'chatPresence', uid) : null;
}

function publish() {
  const ref = presenceRef();
  if (!ref) return;
  if (activeChatId && appActive) {
    published = true;
    setDoc(ref, { chatId: activeChatId, at: new Date().toISOString() })
      .catch(err => logError('chatPresence:write', err));
  } else if (published) {
    // רק אם באמת נרשם משהו — מחיקה היא כתיבה, וזה רץ בכל מעבר לרקע.
    published = false;
    deleteDoc(ref).catch(err => logError('chatPresence:clear', err));
  }
}

function reschedule() {
  if (beat) { clearInterval(beat); beat = null; }
  if (activeChatId && appActive) beat = setInterval(publish, HEARTBEAT_MS);
}

AppState.addEventListener('change', state => {
  const next = state === 'active';
  if (next === appActive) return;
  appActive = next;
  publish();
  reschedule();
});

export function setActiveChat(id: string | null) {
  const next = id || null;
  if (next === activeChatId) return;
  activeChatId = next;
  publish();
  reschedule();
}

export function getActiveChat(): string | null {
  return activeChatId;
}

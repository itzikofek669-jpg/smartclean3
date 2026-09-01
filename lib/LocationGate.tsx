import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useLanguage, T, useAppColors } from './LanguageContext';
import { logError } from './logError';

/**
 * נועל את האפליקציה למנקה שלא אישר גישה למיקום.
 *
 * כל המוצר בנוי על קרבה: מנקה רואה עבודות בטווח שהוא בחר, ולקוחות מוצאים אותו
 * לפי מרחק. חשבון מנקה בלי מיקום אינו חשבון מוגבל — הוא חשבון שאי אפשר להתאים
 * לו כלום, ולכן הוא נעול במקום להיראות שבור.
 *
 * מנקים בלבד. לקוחות מחפשים לפי עיר ויכולים לעבוד בלי לשתף מיקום, ואדמין נעול
 * לא יוכל לתקן כלום.
 */
export default function LocationGate() {
  const { t } = useLanguage();
  const C = useAppColors();
  const [isCleaner, setIsCleaner] = useState(false);
  const [granted, setGranted] = useState(true);
  const roleUidRef = useRef<string | null>(null);

  // התפקיד נקרא פעם אחת לכל כניסה. יציאה מהחשבון מכבה את הנעילה מיד, אחרת
  // המסך היה נשאר תקוע מעל מסך הכניסה.
  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) { roleUidRef.current = null; setIsCleaner(false); setGranted(true); return; }
    if (roleUidRef.current === user.uid) return;
    roleUidRef.current = user.uid;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      setIsCleaner(snap.data()?.role === 'cleaner');
    } catch (err) {
      // קריאה שנכשלה לא נועלת אף אחד — עדיף חשבון פתוח בלי לדעת את התפקיד
      // מאשר מנקה שנחסם בגלל תקלת רשת.
      logError('LocationGate/role', err);
      setIsCleaner(false);
    }
  }), []);

  const check = useCallback(async () => {
    // אין setState כאן ללקוח/אדמין: הרינדור כבר יוצא מוקדם על !isCleaner, וקביעת
    // state באופן סינכרוני מתוך effect גוררת רינדור מיותר בכל טעינה.
    if (!isCleaner) return;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      setGranted(perm.status === 'granted');
    } catch (err) {
      logError('LocationGate/permission', err);
      setGranted(true);   // כנ"ל: תקלה אינה סירוב
    }
  }, [isCleaner]);

  // הכלל לא רואה מבעד לגבול ה-async: כל setGranted ב-check רץ אחרי await, ולכן
  // שום state לא נקבע סינכרונית בגוף ה-effect. אזהרה שגויה.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void check(); }, [check]);

  // ההרשאה ניתנת בהגדרות המערכת, מחוץ לאפליקציה. בלי בדיקה חוזרת בחזרה לחזית
  // המנקה היה מפעיל את המיקום וממשיך לראות מסך נעול עד שיסגור ויפתח מחדש.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void check(); });
    return () => sub.remove();
  }, [check]);

  if (!isCleaner || granted) return null;

  const tt = t as any;
  const ask = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status === 'granted') { setGranted(true); return; }
    // נדחה לצמיתות — הדיאלוג לא יופיע שוב, וההגדרות הן הדרך היחידה.
    if (!perm.canAskAgain) Linking.openSettings().catch(() => {});
  };

  return (
    <View style={[s.overlay, { backgroundColor: C.white }]}>
      <T style={{ fontSize: 56, marginBottom: 10 }}>📍</T>
      <T style={[s.title, { color: C.textDark }]}>
        {tt.locationLockTitle || 'נדרשת הרשאת מיקום'}
      </T>
      <T style={[s.body, { color: C.textSub }]}>
        {tt.locationLockBody
          || 'ההתאמה בין מנקים ללקוחות מבוססת על מרחק, ולכן חשבון מנקה אינו יכול לפעול בלי גישה למיקום. עד שתפעילו את ההרשאה, החשבון יישאר נעול.'}
      </T>
      <TouchableOpacity style={[s.btn, { backgroundColor: C.blue }]} onPress={ask}>
        <T style={s.btnText}>{tt.locationLockRecheck || 'הפעלתי — בדקו שוב'}</T>
      </TouchableOpacity>
      <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openSettings().catch(() => {})}>
        <T style={[s.linkText, { color: C.blue }]}>
          {tt.locationLockOpenSettings || 'פתיחת ההגדרות'}
        </T>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  // מכסה הכול, מעל ה-Stack ומעל סרגל הניווט, כדי שלא תישאר דרך עקיפה למסך אחר.
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title:    { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  body:     { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 26 },
  btn:      { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, minWidth: 240, alignItems: 'center' },
  btnText:  { color: '#fff', fontSize: 16, fontWeight: '900' },
  linkBtn:  { marginTop: 16, padding: 8 },
  linkText: { fontSize: 15, fontWeight: '700' },
});

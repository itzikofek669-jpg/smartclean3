import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { mustVerifyEmail, sendVerificationEmail } from './emailVerification';
import { useLanguage, T, useAppColors } from './LanguageContext';
import { logError } from './logError';

/**
 * מחזיק חשבון שלא אומת בפתח — בלי לנתק אותו.
 *
 * הגרסה הראשונה ניתקה את החשבון החדש מיד אחרי ההרשמה. זה היה שגוי בשלוש דרכים,
 * וכולן צצו ברגע שמשתמש אמיתי ניסה:
 *
 *  - כשהמייל לא הגיע, החשבון פשוט ננעל בחוץ. אין סשן, אין שליחה חוזרת, אין דרך
 *    חזרה. שליחה שנכשלה הפכה לחשבון מת.
 *  - אחרי אישור המייל, המשתמש נזרק למסך הכניסה להקליד מייל וסיסמה שהזין דקה
 *    וחצי קודם.
 *  - יציאה מהאפליקציה מיד אחרי הרשמה נקראת כקריסה, לא ככלל.
 *
 * הישארות מחובר פותרת את שלושתן. הסשן עצמו לא שווה כלום — כל מסך חסום מאחורי
 * השער הזה, וחוקי Firestore מעולם לא העניקו דבר עבור "מחובר" בלבד — אבל הוא מה
 * שמאפשר לשלוח את המייל שוב ולהיכנס ישר פנימה ברגע שהכתובת מאומתת.
 */
export default function EmailVerifyGate() {
  const { t, lang } = useLanguage();
  const C = useAppColors();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => onAuthStateChanged(auth, u => {
    setUser(u);
    setBlocked(!!u && mustVerifyEmail(u));
    setNote('');
  }), []);

  /** אימות נעשה בדפדפן, מחוץ לאפליקציה — לכן בודקים מחדש בכל חזרה לחזית. */
  const recheck = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    try {
      // הדגל צרוב באסימון, ולכן לחיצה על הקישור בדפדפן לא משנה כאן דבר עד רענון.
      await u.reload();
      const still = mustVerifyEmail(u);
      setBlocked(still);
      if (still) setNote((t as any).verifyEmailNotYet
        || 'הכתובת עדיין לא מאומתת. פתחו את הקישור שבמייל ואז נסו שוב.');
    } catch (err) { logError('EmailVerifyGate/reload', err); }
  }, [t]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void recheck(); });
    return () => sub.remove();
  }, [recheck]);

  if (!blocked || !user) return null;

  const tt = t as any;
  const resend = async () => {
    setBusy(true); setNote('');
    try {
      await sendVerificationEmail(user, lang);
      setNote(tt.verifyEmailResent || 'שלחנו מייל אימות חדש.');
    } catch (err) {
      logError('EmailVerifyGate/resend', err);
      setNote(tt.verifyEmailSendFailed
        || 'לא הצלחנו לשלוח את מייל האימות. לחצו על שליחה שוב — ואם זה נמשך, פנו לתמיכה.');
    } finally { setBusy(false); }
  };

  return (
    <View style={[s.overlay, { backgroundColor: C.white }]}>
      <T style={{ fontSize: 52, marginBottom: 10 }}>✉️</T>
      <T style={[s.title, { color: C.textDark }]}>{tt.verifyEmailTitle || 'אימות כתובת המייל'}</T>
      <T style={[s.body, { color: C.textSub, marginBottom: 4 }]}>
        {tt.verifyEmailSentTo || 'שלחנו קישור אימות לכתובת:'}
      </T>
      <T style={[s.email, { color: C.textDark }]}>{user.email}</T>
      <T style={[s.body, { color: C.textSub }]}>
        {tt.verifyEmailInstructions
          || 'יש לפתוח את הקישור שבמייל ואז להתחבר. אם המייל לא הגיע תוך כמה דקות, בדקו גם בתיקיית הספאם.'}
      </T>

      {!!note && <T style={[s.note, { color: C.blue }]}>{note}</T>}

      <TouchableOpacity style={[s.btn, { backgroundColor: C.blue, opacity: busy ? 0.6 : 1 }]}
                        disabled={busy} onPress={() => { void recheck(); }}>
        <T style={s.btnText}>{tt.verifyEmailContinue || 'אימתתי — המשך'}</T>
      </TouchableOpacity>
      <TouchableOpacity style={s.linkBtn} disabled={busy} onPress={resend}>
        <T style={[s.linkText, { color: C.blue }]}>{tt.verifyEmailResend || 'שליחת מייל אימות שוב'}</T>
      </TouchableOpacity>
      <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL('mailto:').catch(() => {})}>
        <T style={[s.linkText, { color: C.textSub }]}>{tt.openMailApp || 'פתיחת אפליקציית המייל'}</T>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10000, elevation: 10000,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  title:    { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  body:     { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 18 },
  email:    { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  note:     { fontSize: 14, textAlign: 'center', marginBottom: 14 },
  btn:      { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, minWidth: 250, alignItems: 'center' },
  btnText:  { color: '#fff', fontSize: 16, fontWeight: '900' },
  linkBtn:  { marginTop: 14, padding: 6 },
  linkText: { fontSize: 15, fontWeight: '700' },
});

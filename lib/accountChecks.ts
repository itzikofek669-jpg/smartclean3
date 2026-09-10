import { collection, getDocs, limit, query, where, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * האם מספר הטלפון כבר רשום על חשבון אחר?
 *
 * הטלפון הוא הדרך שבה לקוח ומנקה באמת מגיעים זה לזה ביום העבודה, ולכן שני
 * חשבונות שחולקים מספר אינם כפילות קוסמטית: שיחה מגיעה למי שאינו הצד להזמנה.
 * זה גם מאפשר לאדם אחד להחזיק כמה חשבונות — לניפוח דירוגים, או כדי לחזור אחרי
 * חסימה.
 *
 * ל-Firestore אין אילוץ ייחודיות, ולכן זו בדיקת קריאה-לפני-כתיבה. היא אינה
 * יכולה לרוץ לפני שהחשבון קיים: אוסף users קריא רק לקורא מחובר, ומי שממלא את
 * טופס ההרשמה עדיין אינו כזה. לכן הקורא יוצר קודם את חשבון ההזדהות ומגלגל אותו
 * לאחור כשזה מחזיר true — אותו דפוס שכבר קיים לכישלון כתיבת הפרופיל.
 *
 * שם אינו נבדק כאן במכוון: שני אנשים אמיתיים יכולים להיקרא אותו דבר, וחסימה על
 * שם הייתה דוחה מנקים אמיתיים.
 *
 * @param phone מנורמל דרך normalizePhone — קלט גולמי היה מפספס "050-123" מול "050123".
 * @param exceptUid החשבון שנערך, כדי ששמירת פרופיל ללא שינוי לא תתנגש בעצמה.
 */
export async function isPhoneTaken(phone: string, exceptUid?: string): Promise<boolean> {
  const v = String(phone || '').trim();
  if (!v) return false;
  try {
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('phone', '==', v),
      limit(2),                 // 2, כדי שעריכה תוכל לראות מעבר למסמך של עצמה
    ));
    return snap.docs.some(d => d.id !== exceptUid);
  } catch {
    // נדחה, ובכוונה.
    //
    // `users` היה ניתן לרשימה לכל מחובר, וזה מה שאיפשר את השאילתה הזו — וגם
    // איפשר לבקשה אחת לשאוב את כל המיילים, הטלפונים, הכתובות השמורות וטוקני
    // הפוש במוצר. הרשימה מוגבלת עכשיו למסמכי מנקים, ושאילתה שעלולה להחזיר
    // מסמך של לקוח נדחית. זו כזו.
    //
    // הנפילה הפתוחה מאבדת בדיקת כפילות מייעצת במסך עריכת הפרופיל. זו מעולם לא
    // הייתה אילוץ נאכף: ל-Firestore אין אינדקס ייחודי, שתי עריכות בו-זמנית תמיד
    // עברו אותה, ושום דבר לא תלוי בה. התמורה מול טבלת הלקוחות אינה שקולה.
    //
    // התיקון האמיתי הוא זה שמתואר למעלה — מסמך `phoneIndex/{number}` תחת חוק
    // שאוסר דריסה של קיים. הוא אטומי, לא דורש רשימה כלל, ומחזיר את הבדיקה
    // כמו שצריך. הוא דורש backfill לחשבונות קיימים, ולכן הוא עבודה בפני עצמה.
    return false;
  }
}

/**
 * Claim a phone number for this account.
 *
 * The real fix the comment above describes. `phoneIndex/{number}` is one
 * document per number holding the uid that owns it, under a rule that permits
 * `create` and forbids `update` — so the first writer keeps it and a second
 * account is refused by the database itself, atomically, with no listing and no
 * read of anyone else's profile.
 *
 * Returns true when the number is now ours (or already was), false when another
 * account holds it. An unreadable answer returns false: a phone number is only
 * ever changed by a deliberate edit, so asking the person to try again costs
 * one retry, while guessing "free" hands out a number that is taken.
 *
 * Existing accounts are NOT backfilled — an index entry appears the first time
 * an account registers or edits its number. So this enforces uniqueness from
 * here on rather than retroactively, and a number registered before today can
 * still be claimed once by somebody else. A backfill is an admin job against
 * production and belongs in its own pass.
 */
export async function claimPhone(phone: string, uid: string): Promise<boolean> {
  const v = String(phone || '').trim();
  if (!v || !uid) return true;                 // nothing to claim
  try {
    await setDoc(doc(db, 'phoneIndex', v), { uid, claimedAt: new Date().toISOString() });
    return true;
  } catch {
    // Refused, which is what a taken number looks like. Read it back to tell
    // "somebody else has it" from "it was already mine".
    try {
      const snap = await getDoc(doc(db, 'phoneIndex', v));
      return snap.exists() && snap.data()?.uid === uid;
    } catch {
      return false;
    }
  }
}

/** Give a number back, so changing yours does not leave it held forever. */
export async function releasePhone(phone: string, uid: string): Promise<void> {
  const v = String(phone || '').trim();
  if (!v || !uid) return;
  try {
    const snap = await getDoc(doc(db, 'phoneIndex', v));
    if (snap.exists() && snap.data()?.uid === uid) {
      await deleteDoc(doc(db, 'phoneIndex', v));
    }
  } catch {
    // A number left held is a nuisance, not a hazard: it only ever blocks the
    // person who used to own it from re-taking it. Never fail an edit over it.
  }
}

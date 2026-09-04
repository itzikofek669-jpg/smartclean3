import { collection, getDocs, limit, query, where } from 'firebase/firestore';
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
  const snap = await getDocs(query(
    collection(db, 'users'),
    where('phone', '==', v),
    limit(2),                 // 2, כדי שעריכה תוכל לראות מעבר למסמך של עצמה
  ));
  return snap.docs.some(d => d.id !== exceptUid);
}

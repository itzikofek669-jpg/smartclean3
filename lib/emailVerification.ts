import { sendEmailVerification, type User } from 'firebase/auth';
import { auth } from './firebase';

/** Where the confirmation link lands once Firebase has marked the address good. */
const CONTINUE_URL = 'https://smartclean1-db1fb.web.app/';

/**
 * הרשמה מחייבת תיבת דואר עובדת מהרגע הזה והלאה.
 *
 * חשבונות שנוצרו לפני כן קדמו לדרישה ומעולם לא קיבלו קישור אימות, ולכן דרישה
 * מהם עכשיו הייתה נועלת בחוץ כל לקוח וכל מנקה קיימים בלי שום דרך לחזור פנימה.
 * ההשוואה לזמן היצירה של החשבון עצמו פוטרת אותם בלי מיגרציה, בלי קריאה נוספת
 * ל-Firestore ובלי שינוי בכללים: uid שנוצר אחרי התאריך הזה עבר במסלול החדש
 * וקיבל את המייל.
 *
 * חייב להישאר זהה ל-VERIFY_REQUIRED_FROM באתר (src/lib/emailVerification.ts) —
 * שני המוצרים חולקים פרויקט Firebase אחד, וסף שונה ביניהם היה מכניס חשבון חסום
 * דרך הדלת השנייה.
 */
export const VERIFY_REQUIRED_FROM = Date.parse('2026-09-01T00:00:00Z');

/** האם החשבון הזה חייב לאמת את כתובתו לפני שמותר לו להיכנס. */
export function mustVerifyEmail(user: User): boolean {
  if (user.emailVerified) return false;
  const created = Date.parse(user.metadata?.creationTime ?? '');
  // אין זמן יצירה קריא — מכניסים. כניסה שנכשלת לטובת המשתמש עולה קצת סינון
  // ספאם; כניסה שנכשלת לרעתו נועלת בחוץ משתמש אמיתי בגלל שדה מטא־דאטה חסר.
  return !Number.isNaN(created) && created >= VERIFY_REQUIRED_FROM;
}

/** שליחה (או שליחה חוזרת) של קישור האימות. */
export async function sendVerificationEmail(user: User, lang?: string): Promise<void> {
  // Firebase בוחר את שפת תבנית המייל לפי זה. קוד שפה שאינו נתמך נופל לאנגלית
  // ולא נכשל, ולכן בטוח להעביר כל ערך.
  if (lang) auth.languageCode = lang;
  await sendEmailVerification(user, { url: CONTINUE_URL, handleCodeInApp: false });
}

import { sendEmailVerification, type User } from 'firebase/auth';
import { auth } from './firebase';

// הכלל עצמו חי ב-verifyRule, בלי תלות ב-Firebase, כדי שאפשר יהיה לבדוק אותו.
export { VERIFY_REQUIRED_FROM, mustVerifyEmail } from './verifyRule';

/** שליחה (או שליחה חוזרת) של קישור האימות. */
export async function sendVerificationEmail(user: User, lang?: string): Promise<void> {
  // Firebase בוחר את שפת תבנית המייל לפי זה. קוד שפה שאינו נתמך נופל לאנגלית
  // ולא נכשל, ולכן בטוח להעביר כל ערך.
  if (lang) auth.languageCode = lang;
  // בכוונה בלי actionCodeSettings. כתובת המשך חייבת להופיע ברשימת הדומיינים
  // המורשים של Auth, וכשהיא לא שם Firebase דוחה את כל הקריאה עם
  // auth/unauthorized-continue-uri — לא נשלח מייל, והתסמין היחיד הוא שליחה
  // ששקטה ולא עשתה כלום. הצורה הפשוטה לא יכולה להיכשל כך.
  await sendEmailVerification(user);
}

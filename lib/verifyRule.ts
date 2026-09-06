/**
 * הכלל: מי חייב לאמת את כתובת המייל שלו.
 *
 * מופרד מהשליחה בכוונה. השליחה נוגעת ב-Firebase; הכלל הוא פונקציה טהורה של
 * המשתמש — וזה ההבדל בין החלטה שאפשר לבדוק לבין החלטה שנבדקת רק בייצור, על
 * משתמשים אמיתיים.
 *
 * חייב להישאר זהה ל-src/lib/verifyRule.ts באתר. שני המוצרים חולקים פרויקט
 * Firebase אחד, וסף שונה ביניהם היה מכניס חשבון חסום דרך הדלת השנייה.
 * test/shared.test.mjs נכשל אם הם נפרדים.
 */
export const VERIFY_REQUIRED_FROM = Date.parse('2026-09-01T00:00:00Z');

/** מה שצריך לדעת על משתמש כדי להכריע — לא יותר מזה. */
export interface VerifiableUser {
  emailVerified: boolean;
  metadata?: { creationTime?: string | null } | null;
}

export function mustVerifyEmail(user: VerifiableUser): boolean {
  if (user.emailVerified) return false;
  const created = Date.parse(user.metadata?.creationTime ?? '');
  // זמן יצירה שאי אפשר לקרוא — מכניסים. נעילה של משתמש משלם בגלל שדה
  // מטא־דאטה חסר גרועה בהרבה מכתובת אחת שלא אומתה.
  return !Number.isNaN(created) && created >= VERIFY_REQUIRED_FROM;
}

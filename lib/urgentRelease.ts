import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './logError';

/**
 * הזמנה שבוטלה לא תשאיר את הבקשה הדחופה שממנה נולדה נעולה.
 *
 * תפיסת בקשה דחופה מסמנת אותה `taken`, ושום דבר לא החזיר אותה משם — כך שאם
 * העבודה בוטלה אחר כך, הבקשה נשארה `taken` לנצח: מחוץ ללוח של כל המנקים, בלי
 * שאיש יכול לקחת אותה, ובלי שאף ניקיון קורה. מי שביטל קובע לאן היא הולכת:
 *
 *   ביטל המנקה  → חזרה ל-`open`. הלקוח עדיין רוצה את הניקיון והשעה התפנתה,
 *                  ולכן מנקים אחרים צריכים לראות אותה שוב. (אם בינתיים פג
 *                  תוקפה, הלוח מסנן אותה ממילא לפי expiresAt.)
 *   ביטל הלקוח   → `cancelled`. הלקוח כבר לא רוצה, והחזרת הכרטיס ללוח הייתה
 *   או האדמין      מוסרת למישהו עבודה שכבר בוטלה.
 *
 * מאמץ מיטבי: ההזמנה מבוטלת כך או כך, וכישלון בניקוי הבקשה אסור שייראה לקורא
 * כאילו הביטול עצמו נכשל.
 *
 * חייב להישאר זהה ל-releaseUrgentRequest באתר (src/lib/cleanerActions.ts).
 */
export async function releaseUrgentRequest(
  booking: { urgentRequestId?: string } | null | undefined,
  cancelledBy: 'cleaner' | 'client' | 'admin',
): Promise<void> {
  const reqId = booking?.urgentRequestId;
  if (!reqId) return;
  try {
    await updateDoc(
      doc(db, 'urgentRequests', reqId),
      cancelledBy === 'cleaner'
        ? {
            status: 'open',
            // נמחקים, לא נדרסים ב-'': בדיקות התפיסה קוראות אותם כדי לדעת אם
            // מישהו כבר מחזיק בבקשה.
            takenByUid: deleteField(),
            takenBy: deleteField(),
            takenByName: deleteField(),
            takenAt: deleteField(),
          }
        : { status: 'cancelled' },
    );
  } catch (err) {
    logError('urgentRelease/releaseUrgentRequest', err);
  }
}

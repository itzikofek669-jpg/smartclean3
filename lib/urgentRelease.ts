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
  booking: { urgentRequestId?: string; bookingDate?: string; startTime?: string } | null | undefined,
  cancelledBy: 'cleaner' | 'client' | 'admin',
): Promise<void> {
  const reqId = booking?.urgentRequestId;
  if (!reqId) return;

  // חלון חדש, אחרת השחרור הוא ריק מתוכן.
  //
  // expiresAt נקבע לשעתיים מרגע *היצירה*. בקשה שנוצרה ב-09:00 למחר ב-10:00 פגה
  // כבר ב-11:00 היום, ולכן החזרתה ל-open מחר בבוקר החזירה כרטיס פג — וכל לוח
  // מסנן אותו החוצה מיד. השחרור עבד על הנייר ולא הופיע אצל אף מנקה.
  //
  // ואם המועד שביקש הלקוח כבר עבר, אין מה להחזיר: הבקשה נסגרת.
  const slot = booking?.bookingDate && booking?.startTime
    ? new Date(`${booking.bookingDate}T${booking.startTime}`)
    : null;
  const slotStillAhead = !!slot && !Number.isNaN(slot.getTime()) && slot.getTime() > Date.now();
  // A cleaner may only ever put a request BACK. Cancelling belongs to the
  // owner: anyone can become the holder by claiming, so letting a holder cancel
  // meant two legal writes emptied the whole board. A request whose slot has
  // passed is reopened too — isUrgentRequestLive hides it from every board and
  // its owner's sweep clears it, which is the same end state without handing
  // strangers a delete.
  const reopen = cancelledBy === 'cleaner';
  void slotStillAhead;

  try {
    await updateDoc(
      doc(db, 'urgentRequests', reqId),
      reopen
        ? {
            status: 'open',
            // חלון חדש שנמשך עד המועד עצמו, ולכל הפחות שעה — מספיק זמן למנקה
            // אחר לראות ולקחת. אם המועד כבר עבר, החלון יוצא בעבר וההסתרה
            // והסחיפה של הבעלים מטפלות בשאר.
            expiresAt: new Date(Math.max(slot!.getTime(), Date.now() + 3600000)).toISOString(),
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

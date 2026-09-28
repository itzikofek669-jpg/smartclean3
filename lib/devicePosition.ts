import { logError } from './logError';

// מיקום המכשיר, או null כשאי אפשר לדעת אותו כרגע.
//
// קודם מבקשים מיקום עדכני. הבקשה הזאת נכשלת גם כשהכול תקין — בתוך בניין בלי
// קליטת GPS, רגע אחרי שהמיקום הופעל, או בסימולטור בלי מיקום מוגדר
// (kCLErrorDomain error 0, "Cannot obtain current location"). אז נופלים למיקום
// האחרון שהמכשיר מכיר, אם הוא מהשעה האחרונה. רק כששניהם חסרים מחזירים null,
// והקורא מחליט אם להציג הודעה — בטעינת המסך לא, בלחיצה על כפתור כן.
//
// קודם כל קורא קרא ל-getCurrentPositionAsync בעצמו: בטעינת מסך הבית הכישלון
// לא נתפס בכלל (שגיאה אדומה "Uncaught (in promise)"), ובכפתור המיקום הוא הציג
// "שגיאת מיקום" גם כשמיקום מלפני דקה היה זמין.

const LAST_KNOWN_MAX_AGE_MS = 60 * 60 * 1000;

export type Coords = { lat: number; lng: number };

/** Assumes permission was already granted; asks for nothing. */
export async function devicePosition(): Promise<Coords | null> {
  // Imported here, as register.tsx always did: the registration screen should
  // not load the location module until someone actually registers.
  const Location = await import('expo-location');
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (err) {
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
      if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    } catch { /* reported below, with the original failure */ }
    logError('devicePosition', err);
    return null;
  }
}

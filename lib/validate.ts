/**
 * Input validation for the values that reach Firestore.
 *
 * Mirrors A-M-Clean-web/src/lib/validate.ts — the two apps write to the same
 * collections, so a rule enforced on one side and not the other just means the
 * bad data arrives by the other door.
 *
 * None of these fields were checked before: registration accepted an empty
 * phone number, a price of 0 or 999999, an age of 3, and a service radius of
 * 10000 km. Firestore stores whatever it's given, so the bad value doesn't
 * surface at write time — it surfaces later as a cleaner nobody can call, a
 * booking whose total is nonsense, or a map pin that matches every search in
 * the country.
 *
 * Each function returns a Hebrew error string, or null when the value is fine.
 */

/** Strip formatting and normalise a +972 prefix to a leading 0. */
export function normalizePhone(raw: string): string {
  const digits = String(raw || '').replace(/[\s\-().]/g, '');
  return digits.replace(/^(?:\+?972)/, '0');
}

/**
 * Israeli phone number — mobile (05X, 10 digits) or landline (0X, 9 digits).
 * This is how a client and cleaner reach each other on the day, so a wrong
 * number is a failed job rather than a cosmetic issue.
 */
export function validatePhone(raw: string, required = true): string | null {
  const v = normalizePhone(raw);
  if (!v) return required ? 'נא למלא מספר טלפון' : null;
  if (!/^0(5\d{8}|[2-4,8-9]\d{7})$/.test(v)) {
    return 'מספר טלפון לא תקין (לדוגמה: 050-1234567)';
  }
  return null;
}

/** Email — light structural check; Firebase Auth does the authoritative one. */
export function validateEmail(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!v) return 'נא למלא כתובת אימייל';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'כתובת אימייל לא תקינה';
  return null;
}

/**
 * Password. Firebase enforces 6 characters and nothing else, which permits
 * "123456" — the most common password in the world. 8 with a letter and a digit
 * is a low bar that still removes the worst of it.
 */
export function validatePassword(raw: string): string | null {
  const v = String(raw || '');
  if (v.length < 8) return 'הסיסמה חייבת להכיל לפחות 8 תווים';
  if (!/[A-Za-z֐-׿]/.test(v) || !/\d/.test(v)) return 'הסיסמה חייבת לכלול אות וספרה';
  return null;
}

export const PRICE_MIN = 30;
export const PRICE_MAX = 500;

/** Hourly rate in shekels. */
export function validatePrice(raw: string | number, required = true): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return required ? 'נא למלא מחיר לשעה' : null;
  const n = Number(s);
  if (!isFinite(n)) return 'מחיר לא תקין';
  if (n < PRICE_MIN || n > PRICE_MAX) {
    return `מחיר לשעה חייב להיות בין ₪${PRICE_MIN} ל-₪${PRICE_MAX}`;
  }
  return null;
}

/** Age. 18 is the floor because the terms require it. */
export function validateAge(raw: string | number, required = false): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return required ? 'נא למלא גיל' : null;
  const n = Number(s);
  if (!Number.isInteger(n)) return 'גיל לא תקין';
  if (n < 18) return 'הגיל המינימלי הוא 18';
  if (n > 99) return 'גיל לא תקין';
  return null;
}

/** Service radius in km. Israel is ~420 km end to end, so 200 covers anything real. */
export function validateDistance(raw: string | number): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!isFinite(n)) return 'מרחק לא תקין';
  if (n < 1 || n > 200) return 'טווח הגעה חייב להיות בין 1 ל-200 ק"מ';
  return null;
}

/** A person's name. */
export function validateName(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!v) return 'נא למלא שם מלא';
  if (v.length < 2) return 'השם קצר מדי';
  if (v.length > 60) return 'השם ארוך מדי';
  return null;
}

/** Run several checks and return the first failure. */
export function firstError(...errors: (string | null)[]): string | null {
  return errors.find((e) => e !== null) ?? null;
}

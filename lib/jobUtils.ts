/**
 * Pure helpers shared by the app's screens — geography, job time windows and
 * small text utilities.
 *
 * These all used to live inside app/home.tsx, a 6,500-line file where they sat
 * between UI components and Firestore listeners. They are pure functions of
 * their arguments with no React and no I/O, so keeping them there only made the
 * screen harder to read and the helpers impossible to reuse — profile.tsx and
 * support.tsx each reimplemented parts of them.
 *
 * The web app has its own copies of the same logic (A-M-Clean-web/src/lib);
 * they must stay in step, because both write to the same Firestore collections.
 */


// ── Cities & coordinates ─────────────────────────────────────────────────────

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'תל אביב':        { lat: 32.087, lng: 34.789 }, 'חיפה':           { lat: 32.794, lng: 34.989 },
  'ירושלים':        { lat: 31.782, lng: 35.218 }, 'באר שבע':        { lat: 31.252, lng: 34.791 },
  'נתניה':          { lat: 32.329, lng: 34.857 }, 'ראשון לציון':    { lat: 31.971, lng: 34.789 },
  'אשדוד':          { lat: 31.804, lng: 34.655 }, 'אשקלון':         { lat: 31.668, lng: 34.571 },
  'פתח תקוה':       { lat: 32.089, lng: 34.888 }, 'כפר סבא':        { lat: 32.175, lng: 34.907 },
  'הרצליה':         { lat: 32.165, lng: 34.843 }, 'נצרת':           { lat: 32.699, lng: 35.303 },
  'טבריה':          { lat: 32.795, lng: 35.531 }, 'אילת':           { lat: 29.558, lng: 34.952 },
  'עכו':            { lat: 32.928, lng: 35.082 }, 'חריש':           { lat: 32.458, lng: 35.041 },
  'רחובות':         { lat: 31.894, lng: 34.811 }, 'בת ים':          { lat: 32.022, lng: 34.750 },
  'רמת גן':         { lat: 32.082, lng: 34.813 }, 'הוד השרון':      { lat: 32.150, lng: 34.887 },
  'עפולה':          { lat: 32.607, lng: 35.290 }, 'קריית שמונה':    { lat: 33.207, lng: 35.570 },
  'מודיעין':        { lat: 31.898, lng: 35.010 }, 'מודיעין עילית':  { lat: 31.930, lng: 35.043 },
  'לוד':            { lat: 31.952, lng: 34.895 }, 'רמלה':           { lat: 31.929, lng: 34.874 },
  'גבעת שמואל':     { lat: 32.078, lng: 34.848 }, 'בני ברק':        { lat: 32.084, lng: 34.833 },
  'גבעתיים':        { lat: 32.073, lng: 34.813 }, 'חולון':          { lat: 32.010, lng: 34.779 },
  'אור יהודה':      { lat: 32.029, lng: 34.856 }, 'יבנה':           { lat: 31.877, lng: 34.741 },
  'קריית אתא':      { lat: 32.808, lng: 35.107 }, 'קריית גת':       { lat: 31.607, lng: 34.771 },
  'קריית מלאכי':   { lat: 31.730, lng: 34.737 }, 'קריית ביאליק':   { lat: 32.834, lng: 35.087 },
  'קריית מוצקין':  { lat: 32.835, lng: 35.074 }, 'קריית ים':       { lat: 32.854, lng: 35.066 },
  'נהריה':          { lat: 33.002, lng: 35.098 }, 'נצרת עילית':     { lat: 32.706, lng: 35.318 },
  'ראש העין':       { lat: 32.095, lng: 34.957 }, 'אלעד':           { lat: 32.053, lng: 34.952 },
  'יהוד':           { lat: 32.030, lng: 34.888 }, 'מזכרת בתיה':     { lat: 31.858, lng: 34.843 },
  'גדרה':           { lat: 31.812, lng: 34.779 }, 'נס ציונה':       { lat: 31.930, lng: 34.797 },
  'ראשל"צ':         { lat: 31.971, lng: 34.789 }, 'ת"א':            { lat: 32.087, lng: 34.789 },
  'פ"ת':            { lat: 32.089, lng: 34.888 }, 'ר"ג':            { lat: 32.082, lng: 34.813 },
  'ב"ב':            { lat: 32.084, lng: 34.833 }, 'כ"ס':            { lat: 32.175, lng: 34.907 },
  'טירת כרמל':      { lat: 32.759, lng: 34.970 }, 'דלית אל כרמל':  { lat: 32.703, lng: 35.034 },
  'עמק יזרעאל':    { lat: 32.600, lng: 35.200 }, 'בית שמש':        { lat: 31.743, lng: 34.988 },
  'מעלה אדומים':   { lat: 31.773, lng: 35.296 }, 'אריאל':          { lat: 32.106, lng: 35.167 },
  'זכרון יעקב':    { lat: 32.568, lng: 34.953 }, 'פרדס חנה':       { lat: 32.471, lng: 34.964 },
  'מגדל העמק':      { lat: 32.677, lng: 35.238 },
  'שדרות':          { lat: 31.524, lng: 34.596 }, 'נתיבות':         { lat: 31.421, lng: 34.594 },
  'דימונה':         { lat: 31.069, lng: 35.033 }, 'ערד':            { lat: 31.258, lng: 35.214 },
  'מצפה רמון':     { lat: 30.612, lng: 34.803 }, 'אופקים':         { lat: 31.312, lng: 34.620 },
  // ערים נוספות
  'נשר':            { lat: 32.772, lng: 35.031 }, 'נוף הגליל':      { lat: 32.706, lng: 35.318 },
  'שפרעם':          { lat: 32.804, lng: 35.169 }, 'צפת':            { lat: 32.965, lng: 35.497 },
  'בית שאן':        { lat: 32.498, lng: 35.499 }, 'יוקנעם':         { lat: 32.658, lng: 35.106 },
  'סח\'נין':        { lat: 32.856, lng: 35.302 }, 'טמרה':           { lat: 32.862, lng: 35.197 },
  'אום אל-פחם':     { lat: 32.526, lng: 35.152 }, 'מג\'ד אל-כרום': { lat: 32.908, lng: 35.255 },
  'באקה אל-גרביה':  { lat: 32.418, lng: 35.042 }, 'כפר קאסם':      { lat: 32.116, lng: 34.977 },
  'קלנסווה':        { lat: 32.284, lng: 34.978 }, 'טייבה':          { lat: 32.241, lng: 34.997 },
  'אור עקיבא':      { lat: 32.508, lng: 34.921 }, 'פרדס חנה-כרכור': { lat: 32.471, lng: 34.968 },
  'חדרה':           { lat: 32.435, lng: 34.919 }, 'כפר יונה':       { lat: 32.322, lng: 34.939 },
  'קדימה-צורן':     { lat: 32.274, lng: 34.923 }, 'רמת השרון':      { lat: 32.146, lng: 34.840 },
  'יהוד-מונוסון':   { lat: 32.030, lng: 34.888 }, 'גני תקווה':      { lat: 32.062, lng: 34.875 },
  'שוהם':           { lat: 31.998, lng: 34.942 }, 'אזור':           { lat: 32.020, lng: 34.818 },
  'מבשרת ציון':     { lat: 31.808, lng: 35.156 }, 'גבעת זאב':       { lat: 31.869, lng: 35.168 },
  'ביתר עלית':      { lat: 31.697, lng: 35.120 }, 'מודיעין עלית':   { lat: 31.930, lng: 35.043 },
  'רהט':            { lat: 31.393, lng: 34.754 }, 'ירוחם':          { lat: 30.987, lng: 34.930 },
};

export const REGION_CENTER: Record<string, { lat: number; lng: number }> = {
  north:  { lat: 32.8,  lng: 35.2  },
  center: { lat: 32.0,  lng: 34.85 },
  south:  { lat: 31.0,  lng: 34.8  },
};

// city names sorted longest-first so e.g. "קריית אתא" matches before "אתא"
export const CITY_KEYS_BY_LEN = Object.keys(CITY_COORDS).sort((a, b) => b.length - a.length);

/** North / centre / south from a latitude. */
export function regionFromLat(lat: number): string { if (lat >= 32.4) return 'north'; if (lat <= 31.6) return 'south'; return 'center'; }

// ── Geography ────────────────────────────────────────────────────────────────

export // Extract just the city name from a cleaner's city/address (e.g. "רקפת 50 חריש" → "חריש")
function cityNameOf(cleaner: any): string {
  const raw = String(cleaner?.city || cleaner?.cleanerAddress || cleaner?.address || '').trim();
  if (!raw) return '';
  if (CITY_COORDS[raw]) return raw;
  for (const key of CITY_KEYS_BY_LEN) { if (raw.includes(key)) return key; }
  const parts = raw.split(/[,]+/).map(p => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : raw;
}

export function getCoordsForCleaner(d: any): { lat: number; lng: number } {
  // קואורדינטות מדויקות מהכתובת (גיאוקודינג שנשמר) — עדיפות עליונה
  if (typeof d.lat === 'number' && typeof d.lng === 'number' && !isNaN(d.lat) && !isNaN(d.lng)) return { lat: d.lat, lng: d.lng };
  const cityRaw = String(d.city || '').trim();
  if (cityRaw && CITY_COORDS[cityRaw]) return CITY_COORDS[cityRaw];
  // נסה למצוא שם עיר ידוע בתוך העיר/הכתובת המלאה (מנקה שומר כתובת ב-cleanerAddress)
  const hay = `${cityRaw} ${d.cleanerAddress || ''} ${d.address || ''}`;
  for (const key of CITY_KEYS_BY_LEN) {
    if (hay.includes(key)) return CITY_COORDS[key];
  }
  // נסה עיר ראשונה בworkAreas
  if (d.workAreas) {
    for (const area of d.workAreas) {
      if (CITY_COORDS[area]) return CITY_COORDS[area];
    }
  }
  const area = d.workAreas?.[0] || d.region;
  const base = REGION_CENTER[area] || REGION_CENTER.center;
  return { lat: base.lat, lng: base.lng };
}

/**
 * Resolve a JOB's coordinates, or null when they genuinely can't be determined.
 *
 * Unlike `getCoordsForCleaner` — which always falls back to a region centre so a
 * cleaner still lands somewhere on the map — a job with an unrecognised city must
 * yield null. Otherwise it inherits a fabricated centre-of-country distance and
 * can sort ahead of jobs that are actually nearby (and slip past the max-distance
 * filter). Callers treat null as "unknown distance" and sort those last.
 */
export function getJobCoords(j: any): { lat: number; lng: number } | null {
  if (typeof j?.lat === 'number' && typeof j?.lng === 'number' && !isNaN(j.lat) && !isNaN(j.lng)) {
    return { lat: j.lat, lng: j.lng };
  }
  const hay = `${j?.addrCity || ''} ${j?.city || ''} ${j?.address || ''}`.trim();
  if (!hay) return null;
  for (const key of CITY_KEYS_BY_LEN) {
    if (hay.includes(key)) return CITY_COORDS[key];
  }
  return null;
}

/** Great-circle distance in kilometres. */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Great-circle distance in metres. */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Job time windows ─────────────────────────────────────────────────────────

/**
 * Format a stored ISO date (`YYYY-MM-DD`) as day-first `DD/MM/YYYY`, the order
 * Hebrew readers expect. Anything not matching that shape is returned unchanged.
 */
export function formatJobDate(iso: string): string {
  const m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

/** A busy window: a day plus start/end as minutes from midnight. */
export interface BusyWindow { date: string; s: number; e: number }

export // Turn a booking/urgent job into a busy time window { date, s, e } in minutes-from-
// midnight, or null if it has no usable date/time. Used to hide overlapping jobs.
function bookingBusyWindow(j: any): { date: string; s: number; e: number } | null {
  const date = String(j?.bookingDate || j?.dateStr || '').trim();
  const time = String(j?.startTime || '').trim();
  if (!date || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number);
  const s = h * 60 + m;
  const hours = Number(j?.hours) > 0 ? Number(j.hours) : 1;
  return { date, s, e: s + hours * 60 };
}

export // Do two busy windows overlap (same day + intersecting minute ranges)?
function windowsOverlap(a: { date: string; s: number; e: number }, b: { date: string; s: number; e: number }): boolean {
  return a.date === b.date && a.s < b.e && a.e > b.s;
}

// ── Text ─────────────────────────────────────────────────────────────────────

/**
 * Drop emoji/pictographs from a label. The header pills are tight on a phone —
 * decorative icons cost real characters and were truncating "ניקיון בזמן שלך".
 * The dictionary strings keep their emoji for use elsewhere (modals, menus).
 */
export function stripEmoji(s: string): string {
  return String(s || '')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .trim();
}

export function countWords(text: string): number {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Clamp free text to `max` words as the user types. Below the cap the raw input
 * is kept so a trailing space (mid-typing) survives; exactly at the cap the text
 * is collapsed so no further word can be started; above it (a paste) it's cut.
 */
export function limitWords(text: string, max: number): string {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < max) return text;
  if (words.length === max) return words.join(' ');
  return words.slice(0, max).join(' ');
}

export function buildFullAddress(city: string, street: string, floor: string, apt: string, isPrivate: boolean): string {
  const parts: string[] = [];
  if (street.trim()) parts.push(street.trim());
  if (city.trim()) parts.push(city.trim());
  if (isPrivate) { parts.push('בית פרטי'); }
  else { if (floor.trim()) parts.push(`קומה ${floor.trim()}`); if (apt.trim()) parts.push(`דירה ${apt.trim()}`); }
  return parts.join(', ');
}

# A&M Clean — צילומי מסך של האפליקציה

> קובץ אינדקס לצילומי המסך. שמור את התמונות בתיקייה `screenshots/` בשמות המתאימים,
> והן יוצגו אוטומטית כאן. מתאים גם להעלאת חנות (Play Store) וגם לשיווק.

---

## איך מקבלים צילומים אמיתיים אוטומטית (ADB)

אם תחבר את הטלפון, אוכל לצלם את כל המסכים אוטומטית ולשמור לתיקייה. שתי אפשרויות:

**USB (הכי פשוט):**
1. הגדרות → אפשרויות מפתח → הפעל **USB debugging**.
2. חבר את הטלפון למחשב בכבל ואשר את החיבור בטלפון.
3. אגיד לי "תצלם" — ואריץ `adb exec-out screencap` לכל מסך.

**אלחוטי (Wi-Fi):**
1. הגדרות → אפשרויות מפתח → **Wireless debugging** → הצג IP+port.
2. תן לי את ה-IP:port — אריץ `adb connect <ip:port>` ואצלם.

> פקודת הצילום שאריץ לכל מסך:
> `adb exec-out screencap -p > screenshots/<שם>.png`

---

## רשימת מסכים לצילום (Checklist)

סדר מומלץ (גם לחנות אפליקציות):

| # | קובץ | מסך | מה להראות |
|---|------|-----|-----------|
| 1 | `01-onboarding.png` | פתיחה / Onboarding | מסך הברוכים הבאים + לוגו |
| 2 | `02-login.png` | התחברות | אימייל/OAuth |
| 3 | `03-register-client.png` | הרשמת לקוח | כתובת + הערת פרטיות 🔒 |
| 4 | `04-register-cleaner.png` | הרשמת מנקה | שירותים, תמחור, מרחק, זמינות |
| 5 | `05-home-map.png` | מסך ראשי | מפה + מנקים + נקודה כתומה |
| 6 | `06-search.png` | חיפוש/השלמה | הצעות ערים + מיקוד מפה |
| 7 | `07-filter.png` | סינון | סינון מתקדם + כפתור איפוס |
| 8 | `08-cleaner-card.png` | כרטיס מנקה | דירוג, מחיר, שירותים |
| 9 | `09-cleaner-profile.png` | פרופיל מנקה | מחיר ליד כל שירות |
| 10 | `10-booking.png` | מודאל הזמנה | סוג ניקיון (חובה), תאריך, שעה |
| 11 | `11-booking-success.png` | אישור הזמנה | "ההזמנה אושרה" + צ'אט |
| 12 | `12-urgent.png` | ניקיון דחוף | טופס דחוף 🚨 |
| 13 | `13-urgent-found.png` | נמצא מנקה | 🎉 |
| 14 | `14-chat.png` | צ'אט | טקסט/תמונה/קול |
| 15 | `15-profile-client.png` | פרופיל לקוח | הזמנות + היסטוריה |
| 16 | `16-profile-cleaner.png` | פרופיל מנקה | דשבורד + הכנסות |
| 17 | `17-schedule.png` | לוח זמנים | שבועי |
| 18 | `18-confirm-booking.png` | אישור הזמנה (מנקה) | סוג ניקיון + צ'אט |
| 19 | `19-rating.png` | דירוג | כוכבים אחרי ניקיון |
| 20 | `20-support.png` | תמיכה | בוט |

---

## תצוגה (Gallery)

> התמונות יופיעו כאן אוטומטית ברגע שיישמרו בתיקייה `screenshots/` בשמות הנכונים.

### Onboarding & הרשמה
![Onboarding](screenshots/01-onboarding.png)
![Login](screenshots/02-login.png)
![Register Client](screenshots/03-register-client.png)
![Register Cleaner](screenshots/04-register-cleaner.png)

### מסך ראשי, חיפוש וסינון
![Home Map](screenshots/05-home-map.png)
![Search](screenshots/06-search.png)
![Filter](screenshots/07-filter.png)
![Cleaner Card](screenshots/08-cleaner-card.png)
![Cleaner Profile](screenshots/09-cleaner-profile.png)

### הזמנה
![Booking](screenshots/10-booking.png)
![Booking Success](screenshots/11-booking-success.png)

### ניקיון דחוף
![Urgent](screenshots/12-urgent.png)
![Urgent Found](screenshots/13-urgent-found.png)

### צ'אט ופרופילים
![Chat](screenshots/14-chat.png)
![Profile Client](screenshots/15-profile-client.png)
![Profile Cleaner](screenshots/16-profile-cleaner.png)
![Schedule](screenshots/17-schedule.png)
![Confirm Booking](screenshots/18-confirm-booking.png)

### דירוג ותמיכה
![Rating](screenshots/19-rating.png)
![Support](screenshots/20-support.png)

---

## טיפים לצילום איכותי (לחנות/שיווק)

- מצב **Do Not Disturb** (בלי באנרים אישיים בראש המסך).
- נתוני דמו נקיים (שמות/כתובות לדמו, לא אמיתיים).
- בהירות מסך גבוהה.
- ל-Play Store: לפחות 2-8 צילומים, יחס טלפון רגיל (1080×1920 או דומה).
- אפשר להוסיף כיתוב-על (overlay) קצר לכל צילום שיווקי: "מנקים לידך", "הזמנה ב-30 שניות", "ניקיון דחוף".

---

*© A&M Clean — כל הזכויות שמורות.*

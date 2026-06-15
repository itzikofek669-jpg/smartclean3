# A&M Clean — Cloud / Design Document

> מסמך מקיף על האפליקציה: ארכיטקטורה, מודל נתונים, פיצ'רים, התראות, אבטחה ופריסה.
> מיועד לפריסה בענן, ל-handoff למפתחים, או כקלט למערכת/סוכן אחר.

---

## 1. סקירה כללית (Overview)

**A&M Clean** היא אפליקציית מרקטפלייס לשירותי ניקיון המחברת בין **לקוחות** ל**מנקים** (נותני שירות), כולל הזמנות רגילות, ניקיון **דחוף**, צ'אט בזמן אמת, התראות, דירוגים ותמיכה.

| פרט | ערך |
|------|------|
| שם מסחרי | A&M Clean |
| Slug / Android package | `cleantouch` / `com.itzik669.cleantouch` |
| גרסה | 1.0.0 |
| פלטפורמה | Android (Expo Dev/Prod build), מבנה תומך גם iOS |
| קהל | דוברי עברית בעיקר; נתמכות 6 שפות |
| תפקידי משתמש | `client` (לקוח), `cleaner` (מנקה), `admin` |

---

## 2. Tech Stack

| שכבה | טכנולוגיה |
|------|-----------|
| Framework | React Native `0.81.5` + **Expo SDK 54** |
| שפה | TypeScript, React `19.1.0` |
| ניווט | `expo-router` 6 (Stack, לא Tabs) |
| Backend / DB | **Firebase** (JS SDK 12) — Firestore, Auth, Storage |
| מפות | `react-native-maps` 1.20 (Google Maps) |
| התראות | `expo-notifications` + Expo Push API |
| מיקום | `expo-location` (גם geocoding/reverse) |
| מדיה | `expo-image`, `expo-image-picker`, הקלטות קוליות |
| אחסון מקומי | `@react-native-async-storage/async-storage`, `expo-secure-store` |
| תרגום | מודול פנימי `lib/translations.ts` (6 שפות) |

> אין שרת backend ייעודי — הלוגיקה רצה בצד הלקוח מול Firestore, עם התראות דרך Expo Push API.

---

## 3. ארכיטקטורה (Architecture)

```
┌─────────────────────────────────────────────┐
│              אפליקציית React Native           │
│  expo-router (Stack)                          │
│  ┌──────────┬──────────┬──────────────────┐  │
│  │  home    │ profile  │ messages/support │  │
│  └────┬─────┴────┬─────┴────────┬─────────┘  │
│       │ Firestore onSnapshot (real-time)     │
└───────┼──────────┼──────────────┼────────────┘
        ▼          ▼              ▼
┌──────────────────────────────────────────────┐
│                  Firebase                      │
│  Auth · Firestore · Storage                    │
│  project: smartclean1-db1fb                    │
└───────────────────────┬───────────────────────┘
                        │ pushToken
                        ▼
              ┌────────────────────┐
              │  Expo Push API     │  → התראות למכשיר
              └────────────────────┘
```

**עקרונות מפתח:**
- **Real-time דרך `onSnapshot`** — הזמנות, צ'אט, בקשות דחופות ופופ-אפים מבוססי מאזיני Firestore חיים.
- **פופ-אפ פנימי בלתי-תלוי בפוש** — גם אם המשתמש כיבה התראות פוש, פופ-אפים באפליקציה ממשיכים לעבוד (Firestore-driven).
- **טרנזקציות אטומיות** (`runTransaction`) לשיבוץ ניקיון דחוף — מונע כפילות (רק מנקה אחד תופס בקשה).

---

## 4. מבנה Firebase

### 4.1 פרויקט
```
projectId:      smartclean1-db1fb
authDomain:     smartclean1-db1fb.firebaseapp.com
storageBucket:  smartclean1-db1fb.firebasestorage.app
```

### 4.2 Collections (Firestore)

#### `users/{uid}`
| שדה | טיפוס | תיאור |
|------|-------|-------|
| `role` | string | `client` / `cleaner` |
| `name` | string | שם תצוגה |
| `phone` | string | טלפון |
| `city`, `lat`, `lng` | string/number | מיקום |
| `pushToken` | string | Expo push token (ריק = פוש כבוי) |
| **שדות מנקה:** | | |
| `available` | bool | זמין להזמנות |
| `maxDistance` | number | מרחק הגעה מקסימלי (ק"מ) — קובע נמעני פוש דחוף |
| `types` | string[] | סוגי שירות |
| `servicePricing` | map | מחיר לשעה לכל סוג שירות |
| `price`, `rating`, `reviewCount` | number | תמחור ודירוג |
| `workAreas`, `region` | string[] / string | אזורי עבודה |
| `payment` | string[] | אמצעי תשלום נתמכים |
| `bio`, `photoB64`/`photo` | string | פרופיל |
| `blockedUntilReview` | bool | חסימה עד מתן ביקורת חובה |

#### `bookings/{id}`
| שדה | תיאור |
|------|-------|
| `clientUid`, `clientName` | לקוח |
| `cleanerId`, `cleanerName` | מנקה |
| `bookingDate` | **תאריך מקומי** `YYYY-MM-DD` (לא UTC!) |
| `startTime` | `HH:MM` |
| `hours`, `total`, `pricePerHour` | משך וסכום |
| `address` | כתובת מלאה (נחשפת רק לאחר הזמנה) |
| `serviceType`, `serviceTypes[]` | סוגי ניקיון |
| `payment`, `paymentStatus` | תשלום |
| `status` | `pending` → `confirmed` → `onway` → `active` → `done` / `cancelled` |
| `source` | `urgent` אם נוצרה מבקשה דחופה |
| `reviewRequired`, `reviewDeadline` | דירוג חובה (7 ימים) |
| `cleanerRating`, `cleanerReviewText` | דירוג הלקוח את המנקה |
| `cancelledBy`, `cancelledAt` | תיעוד ביטול |

#### `urgentRequests/{id}`
| שדה | תיאור |
|------|-------|
| `clientUid`, `clientName`, `address`, `lat`, `lng` | פרטי לקוח |
| `date` (`today`/`tomorrow`), `dateStr`, `startTime`, `hours` | מועד |
| `serviceType`, `paymentMethod`, `total` | פרטי שירות |
| `status` | `open` → `taken` / `cancelled` / `expired` |
| `expiresAt` | תפוגה (שעתיים) |
| `notifiedCleaners[]` | מנקים שקיבלו פוש |
| `takenByUid`, `takenByName`, `takenAt` | המנקה שתפס (טרנזקציה) |

#### `chats/{chatId}` + subcollection `messages/{id}`
| שדה (chat) | תיאור |
|------|-------|
| `participants[]` | UIDs |
| `participantNames` | map uid→name |
| `lastMessage`, `lastMessageAt`, `lastSenderUid` | מטא |
| `unreadBy[]` | מי שלא קרא |
| **message:** `text`/`type` (text/image/audio), `from`, `createdAt`, `imageBase64`/`audioUrl` |

#### `users/{cleanerId}/reviews/{id}` (subcollection)
`stars`, `text`, `clientName`, `createdAt` — אגרגציה אטומית ל-`rating`/`reviewCount` ב-doc המנקה.

### 4.3 Storage
`gs://smartclean1-db1fb.firebasestorage.app` — תמונות צ'אט, הקלטות קוליות, תמונות פרופיל/לפני-אחרי.

---

## 5. מסכים (Screens — `app/`)

| קובץ | תיאור |
|------|-------|
| `_layout.tsx` | Root: Auth routing, מאזיני התראות (cold-start nav), ערוצי אנדרואיד, פופ-אפ הודעות גלובלי |
| `index.tsx` | מסך כניסה / התחברות (Email + OAuth) |
| `onboarding.tsx` | מסך פתיחה |
| `register.tsx` | הרשמה — לקוח (כתובת + הערת פרטיות) / מנקה (שירותים, תמחור, מרחק, אמצעי תשלום) |
| `home.tsx` | **מסך ראשי** (~5000 שורות): מפה, רשימת מנקים, סינון/חיפוש, כרטיס מנקה, הזמנה, ניקיון דחוף, פופ-אפים |
| `profile.tsx` | פרופיל: לקוח (הזמנות, היסטוריה) / מנקה (דשבורד, לוח זמנים, אישור הזמנות, צ'אט, דירוגים) |
| `messages.tsx` | צ'אט בזמן אמת (טקסט/תמונה/קול) |
| `support.tsx` | בוט תמיכה (חוקי, טקסט חופשי, ללא AI בתשלום) |
| `admin.tsx` | מסך ניהול (אדמין בלבד) |

### `lib/`
`firebase.ts`/`firebaseConfig.ts` · `translations.ts` (6 שפות) · `LanguageContext.tsx` · `ThemeContext.tsx` · `ServiceInfoBtn.tsx` · `serviceDescriptions.ts` · `chatPresence.ts` (דיכוי פופ-אפ בצ'אט פעיל) · `AccessibilityModal.tsx` · `BottomTabBar.tsx` · `terms.ts`

---

## 6. פיצ'רים מרכזיים (Features)

### 6.1 הזמנה רגילה
- בחירת מנקה → מודאל הזמנה: **סוג ניקיון חובה** (מסומן אדום אם חסר), תאריך (לוח שנה), שעה (גלגלת, עד 20:00), שעות, כתובת, תשלום.
- בדיקת **חפיפת זמנים** מודעת-תאריך (לקוח + מנקה) לפני שמירה.
- מסך הצלחה + פופ-אפ אישור כשהמנקה מאשר.

### 6.2 ניקיון דחוף (Urgent)
- לקוח שולח בקשה (היום/מחר, **לא ניתן לבחור שעה שעברה**, עד 21:00).
- פוש לכל המנקים **בתוך טווח ההגעה שכל מנקה הגדיר** (`maxDistance`).
- שיבוץ **אטומי** (`runTransaction`) — מנקה ראשון תופס; השאר מקבלים "ההזמנה נתפסה".
- שדות חובה מסומנים אדום; כפתור שליחה חסום עד מילוי.
- לאחר אישור — נפתח למנקה מסך המתנה עם צ'אט מובנה מול הלקוח.

### 6.3 צ'אט
- בזמן אמת (Firestore), טקסט/תמונה/הקלטה קולית.
- פופ-אפ "הודעה חדשה" גלובלי; מדוכא כשהמשתמש כבר בצ'אט (`chatPresence`).

### 6.4 התראות (Notifications)
- **פוש** דרך Expo Push API (`color` חייב hex קטן, למשל `#ff1744`).
- ערוצי אנדרואיד: `messages`, `urgent` (אדום, רטט חזק).
- **פופ-אפ פנימי תמיד פעיל** — בלתי תלוי בפוש. כיבוי פוש מסיר רק `pushToken`.
- אירועים: הזמנה חדשה, אישור הזמנה, "בדרך", סיום, דירוג נדרש, **ביטול הזמנה** (לשני הצדדים), הודעה חדשה.

### 6.5 דירוגים
- **רק הלקוח מדרג את המנקה** (דירוג לקוח הוסר).
- דירוג חובה תוך 7 ימים אחרת חסימה (`blockedUntilReview`); אגרגציה אטומית.

### 6.6 חיפוש וסינון
- חיפוש עם **השלמה אוטומטית** (ערים מכל הארץ לפי תחילית).
- בחירת עיר → **מיקוד מפה** אוטומטי לעיר.
- סינון מתעלם מאזור/קרבה כשמחפשים עיר; הודעת "אין תוצאות" עם **סיבה**.
- כפתור איפוס בולט.

### 6.7 מפה
- נקודת מיקום **כתומה** מותאמת (לא הנקודה הכחולה של המערכת).
- לחיצה על כרטיס מנקה → מיקוד למיקומו; לחיצה על שם → הרחבה; על תמונה → הגדלה.

### 6.8 תמיכה (Support Bot)
- מנוע חוקי לטקסט חופשי: נורמליזציה, edit-distance, זיהוי כוונה, זיכרון הקשר, fallback עם סיבות. ללא AI בתשלום.

### 6.9 רב-לשוניות
עברית, אנגלית, רוסית, ערבית, צרפתית, הינדי — דרך `translations.ts` + `LanguageContext`.

---

## 7. אבטחה ופרטיות (Security & Privacy)

- **כתובת הלקוח פרטית** — נחשפת רק למנקה שהוזמן.
- Firestore Security Rules צריכות לאכוף: קריאה/כתיבה לפי `auth.uid`; חשיפת כתובת רק לצדדים בהזמנה.
- אין הזנת אמצעי תשלום באפליקציה — **התשלום ישיר בין הלקוח לנותן השירות בלבד**.
- `expo-secure-store` ל-credentials (remember-me).

> ⚠️ פעולות רגישות (יצירת חשבונות SMTP, מפתחות API, הזנת סיסמאות) — לא מתבצעות אוטומטית; דורשות פעולה ידנית של בעל החשבון.

---

## 8. פריסה (Build & Deploy)

### פיתוח (Dev)
```bash
npx expo start --dev-client --lan --port 8081
# אם הטלפון לא מתחבר (timeout/חומת-אש/בידוד ראוטר):
npx expo start --dev-client --tunnel --port 8081
```
- דורש **Development Build** (dev-client), לא Expo Go (פוש לא נתמך ב-Expo Go מ-SDK 53+).
- שינויי קוד → Fast Refresh. שינויי `_layout.tsx` (root) → דרוש Reload מלא.

### Production (EAS)
```bash
eas build --profile production --platform android   # APK/AAB
```
- `app.json > extra.eas.projectId` = `f1addab5-9323-4e97-88d4-8cbc19acd742`.

### תלויות חיצוניות לפעולה מלאה
| שירות | שימוש |
|-------|-------|
| Firebase (Firestore/Auth/Storage) | DB + אימות + מדיה |
| Expo Push (`exp.host`) | התראות פוש |
| Google Maps | מפה + geocoding |
| (אופציונלי) SMTP/SendGrid | מיילים מותאמים (כרגע ברירת מחדל Firebase) |

---

## 9. מוסכמות חשובות (Conventions / Gotchas)

- 📅 **תאריכים תמיד מקומיים** (`getFullYear()-getMonth()-getDate()`), **לעולם לא `toISOString()`** לחישוב יום — אחרת זזים יום ב-UTC.
- 🎨 צבע פוש (`color`) — **hex קטנות** בלבד.
- 🌐 עריכת `translations.ts` — **רק דרך עורך טקסט/Edit**, לא סקריפטים (משבש UTF-8 עברית).
- 🧩 אייקוני סוגי שירות מוטמעים בתרגום — מנוקים ב-regex בכרטיס.
- 🔄 שינוי ערוצי אנדרואיד / root layout — דורש Reload מלא.

---

## 10. מצב נוכחי (Status)

האפליקציה בפיתוח חי על מכשירים פיזיים (debug dev-client + Metro). הליבה פעילה: הרשמה, הזמנות רגילות+דחופות, צ'אט, התראות (פוש + פופ-אפ), דירוגים, סינון/מפה, תמיכה, 6 שפות.

---

*נוצר אוטומטית כמסמך עיצוב/ארכיטקטורה ל-A&M Clean. © A&M Clean — כל הזכויות שמורות.*

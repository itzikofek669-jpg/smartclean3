import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView,
  Platform, Animated, Keyboard, Linking, BackHandler, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NAV_BAR_HEIGHT = Platform.OS === 'android'
  ? Math.max(0, Dimensions.get('screen').height - Dimensions.get('window').height - (StatusBar.currentHeight || 0))
  : 0;
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useRouter } from 'expo-router';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:        '#F0F4FF',
  botBg:     '#FFFFFF',
  userBg:    '#2563EB',
  blue:      '#2563EB',
  blueDark:  '#1E3A8A',
  blueLight: '#EFF6FF',
  text:      '#1A1A2E',
  sub:       '#6B7280',
  border:    '#E5E7EB',
  white:     '#FFFFFF',
  green:     '#10B981',
  red:       '#EF4444',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  from: 'bot' | 'user';
  text: string;
  quickReplies?: string[];
  time: Date;
}

interface BotContext {
  userName: string;
  role: 'client' | 'cleaner';
  activeBooking: any | null;
  allBookings: any[];
}

// ─── Chatbot Engine ───────────────────────────────────────────────────────────

function normalize(text: string) {
  return text.trim().toLowerCase()
    .replace(/[?!.،,]/g, '')
    .replace(/\s+/g, ' ');
}

function matchAny(msg: string, keywords: string[]): boolean {
  return keywords.some(kw => msg.includes(kw));
}

function getStatusText(b: any): string {
  return ({
    pending:   '⏳ ממתין לאישור המנקה',
    confirmed: `✅ אושר — מגיע ב-${b.date} בשעה ${b.startTime || ''}`,
    onway:     '🚗 המנקה בדרך אליך עכשיו!',
    active:    '🧹 הניקוי מתבצע כרגע',
    done:      '✅ הניקוי הסתיים בהצלחה',
    cancelled: '❌ ההזמנה בוטלה',
  } as Record<string, string>)[b.status] || b.status;
}

interface BotResponse {
  text: string;
  quickReplies?: string[];
  navigateTo?: string;
  action?: 'sendEmail';
}

function getBotResponse(input: string, ctx: BotContext): BotResponse {
  const msg = normalize(input);
  const { userName, role, activeBooking, allBookings } = ctx;
  const isCleaner = role === 'cleaner';

  // ── ניתוב לפי תפקיד ───────────────────────────────────────────────────────
  if (isCleaner) return getCleanerResponse(msg, userName, allBookings);
  return getClientResponse(msg, userName, activeBooking, allBookings);
}

// ══════════════════════════════════════════════════════════════════════════════
// תשובות ללקוח
// ══════════════════════════════════════════════════════════════════════════════
function getClientResponse(msg: string, userName: string, activeBooking: any, allBookings: any[]): BotResponse {

  // ── ברכות ─────────────────────────────────────────────────────────────────
  if (matchAny(msg, ['שלום', 'היי', 'הי', 'בוקר טוב', 'ערב טוב', 'צהריים', 'מה שלומך', 'מה נשמע', 'מה המצב'])) {
    return {
      text: `שלום ${userName}! 😊\nאני CLEAN Bot — עוזר התמיכה של A&M Clean.\nאיך אוכל לעזור לך?`,
      quickReplies: ['מה הסטטוס שלי?', 'רוצה לבטל', 'כמה זה עולה?', 'פרטי המנקה'],
    };
  }

  // ── תודה ──────────────────────────────────────────────────────────────────
  if (matchAny(msg, ['תודה', 'תודה רבה', 'מעולה', 'סבבה', 'ממש עזרת', 'יפה', 'כל הכבוד', 'אחלה', 'גדול'])) {
    return {
      text: `שמחתי לעזור ${userName}! 🌟\n\nהאם יש שאלות נוספות או שאלות שלא נענו?`,
      quickReplies: ['כן, יש לי שאלה נוספת', 'לא, הכל בסדר', 'שאלה שלא נענתה — שלח מייל'],
    };
  }

  // ── כן, יש עוד שאלות ──────────────────────────────────────────────────────
  if (matchAny(msg, ['כן יש לי שאלה', 'יש לי שאלה נוספת', 'כן יש עוד', 'יש עוד שאלה', 'כן יש לי שאלה נוספת'])) {
    return {
      text: `😊 בשמחה! מה השאלה שלך?\n\nאו בחר מהנושאים:`,
      quickReplies: [
        'מה הסטטוס שלי?', 'רוצה לבטל', 'כמה זה עולה?',
        'פרטי המנקה', 'הזמנות שלי', 'ביטוח', 'צור קשר',
      ],
    };
  }

  // ── לא, הכל בסדר ──────────────────────────────────────────────────────────
  if (matchAny(msg, ['לא הכל בסדר', 'הכל בסדר', 'הכל ברור', 'אין שאלות', 'לא תודה', 'לא יש עוד', 'לא כל הכבוד', 'לא הכל ברור'])) {
    return {
      text: `מעולה! 🎉\nשמחנו לעזור ${userName}!\n\nCLEAN Bot זמין 24/7 — תמיד שמח לעזור 💙\nיום טוב ונקי! ✨`,
      quickReplies: [],
    };
  }

  // ── שלח מייל לתמיכה ──────────────────────────────────────────────────────
  if (matchAny(msg, ['שלח מייל', 'שאלה שלא נענתה', 'שלח לתמיכה', 'מייל לתמיכה', 'שאלה שלא נענתה — שלח מייל'])) {
    return {
      text: `בוודאי! 📧\nנפתח את אפליקציית המייל שלך לפנייה ישירה לצוות התמיכה שלנו.\n\n✉️ support@amclean.co.il\n\nנחזור אליך תוך 24 שעות! 🕐`,
      quickReplies: ['חזור לתפריט'],
      action: 'sendEmail',
    };
  }

  // ── סטטוס הזמנה ───────────────────────────────────────────────────────────
  if (matchAny(msg, ['סטטוס', 'הזמנה שלי', 'מתי מגיע', 'מתי המנקה', 'איפה המנקה', 'מה קורה', 'עדכון', 'מגיע היום'])) {
    if (!activeBooking) {
      return {
        text: 'אין לך הזמנה פעילה כרגע. 📋\nרוצה להזמין מנקה חדש?',
        quickReplies: ['כן, להזמין', 'ראה היסטוריה', 'חזור לתפריט'],
      };
    }
    const b = activeBooking;
    return {
      text: `📋 הזמנה פעילה:\n\n✨ מנקה: ${b.cleanerName || '—'}\n📅 תאריך: ${b.date || '—'} | ⏰ ${b.startTime || '—'}\n📍 כתובת: ${b.address || '—'}\n⏱️ שעות: ${b.hours || 1}\n💰 סכום: ₪${b.total || 0}\n\nסטטוס: ${getStatusText(b)}`,
      quickReplies: ['פרטי המנקה', 'רוצה לבטל', 'חזור לתפריט'],
    };
  }

  // ── ביטול הזמנה ───────────────────────────────────────────────────────────
  if (matchAny(msg, ['לבטל', 'ביטול', 'לא רוצה', 'בטל הזמנה', 'cancel', 'לא צריך'])) {
    if (!activeBooking) {
      return {
        text: 'אין הזמנה פעילה לביטול. 🙂',
        quickReplies: ['חזור לתפריט'],
      };
    }
    const b = activeBooking;
    return {
      text: `📋 מדיניות ביטול A&M Clean:\n\n✅ ביטול עד 24 שעות לפני — החזר מלא\n❌ ביטול פחות מ-24 שעות — אין החזר\n\nלביטול ההזמנה עם ${b.cleanerName || 'המנקה'} ב-${b.date || '—'}:\nכנס ל"הזמנות שלי" ולחץ "ביטול הזמנה".`,
      quickReplies: ['הזמנות שלי', 'שמור הזמנה', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── שינוי תאריך ───────────────────────────────────────────────────────────
  if (matchAny(msg, ['לשנות תאריך', 'לדחות', 'לשנות שעה', 'לשנות הזמנה', 'לעדכן הזמנה'])) {
    return {
      text: '📅 שינוי תאריך:\n\nכרגע לא ניתן לשנות הזמנה קיימת.\nלשינוי — בטל את ההזמנה הנוכחית והזמן מחדש בתאריך המועדף.\n\nהביטול חינמי עד 24 שעות לפני!',
      quickReplies: ['רוצה לבטל', 'חזור לתפריט'],
    };
  }

  // ── מחיר ──────────────────────────────────────────────────────────────────
  if (matchAny(msg, ['כמה עולה', 'מחיר', 'עלות', 'תעריף', 'כמה זה', 'כסף', 'עמלה', 'דמי שירות'])) {
    if (activeBooking) {
      const b = activeBooking;
      const perHour = b.hours ? Math.round((b.total || 0) / b.hours) : 0;
      return {
        text: `💰 עלות ההזמנה הנוכחית:\n\n⏱️ ${b.hours} שעות × ₪${perHour}/שעה\n💵 סה"כ: ₪${b.total || 0}\n💳 תשלום ב: ${b.paymentMethod === 'cash' ? 'מזומן' : b.paymentMethod === 'bit' ? 'ביט' : 'אשראי'}\n\n✅ ₪0 דמי שירות — A&M Clean חינמי!`,
        quickReplies: ['מה הסטטוס?', 'חזור לתפריט'],
      };
    }
    return {
      text: '💰 מחירי השירות:\n\nכל מנקה קובע את המחיר שלו לשעה.\nטווח מחירים: ₪55–₪120/שעה\n\nניתן לראות את המחיר של כל מנקה ישירות בכרטיס שלו במסך הראשי.\n\n✅ ₪0 דמי שירות — אתה משלם רק למנקה!',
      quickReplies: ['איך להזמין?', 'חזור לתפריט'],
    };
  }

  // ── שיטת תשלום ───────────────────────────────────────────────────────────
  if (matchAny(msg, ['איך משלמים', 'שיטת תשלום', 'ביט', 'אשראי', 'מזומן', 'כרטיס אשראי', 'ויזה'])) {
    return {
      text: '💳 שיטות תשלום מקובלות:\n\n📱 ביט — העברה מיידית\n💳 אשראי — ויזה / מסטרקארד\n💵 מזומן — בסיום העבודה\n\nשיטת התשלום נבחרת בעת ההזמנה.',
      quickReplies: ['כמה עולה?', 'חזור לתפריט'],
    };
  }

  // ── פרטי מנקה ────────────────────────────────────────────────────────────
  if (matchAny(msg, ['פרטי המנקה', 'מי המנקה', 'טלפון מנקה', 'ליצור קשר', 'מספר טלפון', 'להתקשר למנקה'])) {
    if (!activeBooking) {
      return {
        text: 'אין הזמנה פעילה כרגע. 🙂',
        quickReplies: ['חזור לתפריט'],
      };
    }
    return {
      text: `✨ פרטי המנקה שלך:\n\nשם: ${activeBooking.cleanerName || '—'}\nתאריך: ${activeBooking.date || '—'} | שעה: ${activeBooking.startTime || '—'}\n\n💬 לשיחה עם המנקה:\nכנס ל"הזמנות שלי" ולחץ על כפתור הצ'אט.`,
      quickReplies: ['הזמנות שלי', 'מה הסטטוס?', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── דירוג / ביקורת ────────────────────────────────────────────────────────
  if (matchAny(msg, ['לדרג', 'ביקורת', 'דירוג', 'כוכבים', 'לתת דירוג', 'לדרג מנקה', 'חוות דעת'])) {
    return {
      text: '⭐ כיצד לדרג את המנקה:\n\n1️⃣ אחרי סיום הניקוי תקבל התראה\n2️⃣ כנס ל"הזמנות שלי"\n3️⃣ בחר "דרג שירות"\n4️⃣ תן כוכבים וכתוב ביקורת\n\n⚠️ חשוב לדרג תוך 7 ימים!',
      quickReplies: ['הזמנות שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── מה כולל הניקוי ───────────────────────────────────────────────────────
  if (matchAny(msg, ['מה כולל', 'מה הניקוי', 'מה עושים', 'סוגי שירות', 'שירותים', 'ניקוי עמוק', 'ניקוי פסח'])) {
    return {
      text: '🧹 סוגי ניקוי ב-A&M Clean:\n\n• שוטף — ניקוי בסיסי יומיומי/שבועי\n• עמוק — ניקוי יסודי מלא + מטבח/שירותים\n• חלונות — ניקוי חלונות, מרפסות, ממ"ד\n• אחרי שיפוץ — פינוי אבק ופסולת בנייה\n• אחרי אירוע — ניקיון מהיר ויסודי\n• גינון 🌿 / שטיפת רכב 🚗',
      quickReplies: ['כמה עולה?', 'איך להזמין?', 'חזור לתפריט'],
    };
  }

  // ── חומרי ניקוי ──────────────────────────────────────────────────────────
  if (matchAny(msg, ['חומרים', 'מוצרים', 'ציוד', 'שואב', 'מטאטא', 'חומר', 'מי מביא'])) {
    return {
      text: '🧴 חומרי ניקוי:\n\nכל מנקה מציין בפרופיל שלו:\n\n✅ "המנקה מביא" — ציוד מלא, אין מה להכין\n🛒 "הלקוח מספק" — יש להכין חומרים מראש\n\nראה בפרופיל המנקה לפני ההזמנה.',
      quickReplies: ['חזור לתפריט'],
    };
  }

  // ── ביטוח ─────────────────────────────────────────────────────────────────
  if (matchAny(msg, ['ביטוח', 'נזק', 'אחריות', 'שבר', 'פגע', 'תביעה', 'הגנה'])) {
    return {
      text: '🛡️ ביטוח A&M Clean:\n\nכל הזמנה מבוטחת דרך השותף שלנו.\nלכפתור הביטוח — פתח כרטיס מנקה ולחץ "🛡️ ביטוח".\n\nלתביעה ישירה:\n📧 support@amclean.co.il',
      quickReplies: ['צור קשר', 'חזור לתפריט'],
    };
  }

  // ── אזורים ───────────────────────────────────────────────────────────────
  if (matchAny(msg, ['אזורים', 'איפה עובדים', 'כיסוי', 'יגיע אלי', 'מגיע ל', 'עיר', 'פועלים'])) {
    return {
      text: '📍 אזורי שירות:\n\n🌿 צפון — חיפה, נצרת, טבריה, עכו, קריות\n🏙️ מרכז — ת"א, ירושלים, ר"ג, פ"ת, נתניה, רחובות\n☀️ דרום — ב"ש, אשדוד, אשקלון, אילת\n\nמנקים חדשים מצטרפים כל יום! 🚀',
      quickReplies: ['איך להזמין?', 'חזור לתפריט'],
    };
  }

  // ── שעות פעילות ──────────────────────────────────────────────────────────
  if (matchAny(msg, ['שעות', 'פעילות', 'מתי אפשר', 'בשבת', 'ימי עבודה', 'בשבוע', 'זמינים'])) {
    return {
      text: '🕐 שעות פעילות:\n\nכל מנקה קובע את הזמינות שלו.\nרוב המנקים פעילים:\n\n• א׳–ה׳: 07:00–20:00\n• ו׳: 07:00–14:00\n• שבת: לפי מנקה (בחר "זמינים עכשיו")',
      quickReplies: ['איך להזמין?', 'חזור לתפריט'],
    };
  }

  // ── איך להזמין ────────────────────────────────────────────────────────────
  if (matchAny(msg, ['איך מזמינים', 'איך להזמין', 'לחפש מנקה', 'להזמין', 'הזמן'])) {
    return {
      text: '📱 איך להזמין מנקה:\n\n1️⃣ חפש מנקה במפה\n2️⃣ לחץ על כרטיס המנקה\n3️⃣ לחץ "הזמן"\n4️⃣ בחר תאריך ושעת התחלה\n5️⃣ הכנס כתובת + שיטת תשלום\n6️⃣ לחץ "אשר הזמנה" ✅\n\nתקבל אישור מיידי!',
      quickReplies: ['כמה עולה?', 'חזור לתפריט'],
    };
  }

  // ── הזמנות קודמות ─────────────────────────────────────────────────────────
  if (matchAny(msg, ['היסטוריה', 'הזמנות קודמות', 'הזמנות ישנות', 'הזמנות שלי', 'כמה הזמנות'])) {
    const count = allBookings.length;
    const done = allBookings.filter(b => b.status === 'done').length;
    return {
      text: `📋 הזמנות שלך:\n\nסה"כ: ${count} הזמנות\nבוצעו: ${done}\n\nלרשימה המלאה — כנס ל"הזמנות שלי"`,
      quickReplies: ['הזמנות שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── סיסמה / כניסה ─────────────────────────────────────────────────────────
  if (matchAny(msg, ['שכחתי סיסמה', 'לשנות סיסמה', 'סיסמה', 'לא נכנס', 'לאפס', 'איפוס'])) {
    return {
      text: '🔑 לאיפוס סיסמה:\n\n1️⃣ צא מהחשבון\n2️⃣ במסך הכניסה לחץ "שכחתי סיסמה"\n3️⃣ הכנס אימייל → קבל קישור לאיפוס\n4️⃣ לחץ על הקישור ובחר סיסמה חדשה',
      quickReplies: ['חזור לתפריט'],
    };
  }

  // ── שינוי פרטים ───────────────────────────────────────────────────────────
  if (matchAny(msg, ['לשנות פרטים', 'עדכון פרטים', 'שם', 'טלפון שלי', 'כתובת אימייל', 'לעדכן'])) {
    return {
      text: '✏️ לשינוי פרטים אישיים:\n\nכנס לפרופיל שלך ולחץ על הפרטים לעדכון.\nניתן לשנות שם, טלפון והגדרות.',
      quickReplies: ['הפרופיל שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── מחיקת חשבון ──────────────────────────────────────────────────────────
  if (matchAny(msg, ['למחוק חשבון', 'מחיקת חשבון', 'לסגור חשבון', 'להתנתק לצמיתות'])) {
    return {
      text: '🗑️ מחיקת חשבון:\n\nלמחיקת החשבון שלך צור קשר ישיר:\n📧 support@amclean.co.il\n\nנחזור אליך תוך 24 שעות.',
      quickReplies: ['חזור לתפריט'],
    };
  }



  // ── עמלות ─────────────────────────────────────────────────────────────────
  if (matchAny(msg, ['עמלה', 'דמי שירות', 'כמה אתם לוקחים', 'חינם', 'בחינם', 'ללא עמלה', 'אחוז'])) {
    return {
      text: '💚 A&M Clean — 0% עמלה!\n\n✅ למנקים: שומרים 100% מהתשלום\n✅ ללקוחות: ₪0 דמי שירות\n\nהפלטפורמה חינמית לחלוטין.',
      quickReplies: ['חזור לתפריט'],
    };
  }

  // ── תמיכה / נציג ─────────────────────────────────────────────────────────
  if (matchAny(msg, ['לדבר עם אדם', 'נציג', 'שירות לקוחות', 'צור קשר', 'להתקשר', 'אדם אמיתי', 'תמיכה אנושית'])) {
    return {
      text: '📞 תמיכת A&M Clean:\n\n📧 support@amclean.co.il\n📱 WhatsApp: 050-000-0000\n\nשעות מענה:\nא׳–ה׳: 09:00–18:00',
      quickReplies: ['חזור לתפריט'],
    };
  }

  // ── מנקה לא הגיע ─────────────────────────────────────────────────────────
  if (matchAny(msg, ['לא הגיע', 'לא הופיע', 'עזב', 'אין מנקה', 'מאחר', 'איחור'])) {
    return {
      text: '⚠️ המנקה לא הגיע?\n\n1️⃣ נסה לפנות למנקה דרך הצ׳אט בהזמנה\n2️⃣ אם אין מענה תוך 15 דקות — צור קשר:\n📱 WhatsApp: 050-000-0000\n\nנטפל בזה מיידית!',
      quickReplies: ['הזמנות שלי', 'צור קשר', 'חזור לתפריט'],
    };
  }

  // ── תלונה / בעיה ─────────────────────────────────────────────────────────
  if (matchAny(msg, ['תלונה', 'בעיה', 'לא מרוצה', 'גרוע', 'גרועה', 'להתלונן', 'פגם', 'נזק'])) {
    return {
      text: '😔 מצטערים לשמוע!\n\nלדיווח על בעיה:\n1️⃣ כנס לפרופיל שלך\n2️⃣ לחץ "🚨 דיווח"\n3️⃣ מלא את הפרטים\n\nאו צור קשר ישיר:\n📧 support@amclean.co.il',
      quickReplies: ['הפרופיל שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── מה אתה יכול / עזרה ────────────────────────────────────────────────────
  if (matchAny(msg, ['מה אתה יכול', 'עזרה', 'help', 'אפשרויות', 'מה יש', 'תפריט', 'חזור לתפריט'])) {
    return {
      text: '👨‍💼 במה אוכל לעזור?\n\nבחר נושא:',
      quickReplies: [
        'מה הסטטוס שלי?',
        'רוצה לבטל',
        'כמה זה עולה?',
        'פרטי המנקה',
        'הזמנות שלי',
        'ביטוח',
        'צור קשר',
      ],
    };
  }

  // ── ברירת מחדל משופרת — זיהוי כוונה חלקית ────────────────────────────────

  // מנסה לנחש את הנושא לפי מילות מפתח חלקיות
  type IntentHint = { keywords: string[]; label: string; replies: string[] };
  const intentHints: IntentHint[] = [
    {
      keywords: ['הזמנ', 'להזמין', 'לבדוק', 'זמין', 'מגיע', 'מנקה', 'ניקוי', 'עובד', 'יבוא'],
      label: '📋 סטטוס הזמנה',
      replies: ['מה הסטטוס שלי?', 'פרטי המנקה', 'הזמנות שלי'],
    },
    {
      keywords: ['כסף', 'שקל', 'עלות', 'תשלום', 'מחיר', 'עמלה', 'ויזה', 'ביט', 'אשראי', 'משלם'],
      label: '💰 מחיר ותשלום',
      replies: ['כמה זה עולה?', 'שיטת תשלום', 'חזור לתפריט'],
    },
    {
      keywords: ['בטל', 'ביטל', 'להחזיר', 'החזר', 'זיכוי', 'רפנד', 'cancel'],
      label: '❌ ביטול הזמנה',
      replies: ['רוצה לבטל', 'מה הסטטוס שלי?', 'חזור לתפריט'],
    },
    {
      keywords: ['תלונ', 'נזק', 'שבר', 'גרוע', 'לא מרוצ', 'בעיה', 'פגם', 'איחור', 'לא הגיע'],
      label: '🚨 בעיה / תלונה',
      replies: ['שאלה שלא נענתה — שלח מייל', 'צור קשר', 'חזור לתפריט'],
    },
    {
      keywords: ['ביטוח', 'נזק', 'אחריות', 'תביעה', 'הגנה'],
      label: '🛡️ ביטוח',
      replies: ['ביטוח', 'צור קשר', 'חזור לתפריט'],
    },
    {
      keywords: ['סיסמ', 'חשבון', 'להיכנס', 'לא נכנס', 'אימייל', 'לאפס'],
      label: '🔑 סיסמה / כניסה',
      replies: ['שכחתי סיסמה', 'שאלה שלא נענתה — שלח מייל', 'חזור לתפריט'],
    },
  ];

  const matched = intentHints.find(h => h.keywords.some(kw => msg.includes(kw)));

  if (matched) {
    return {
      text: `לא הצלחתי לזהות את שאלתך במדויק 🤔\n\n💡 אולי התכוונת לנושא: ${matched.label}?\n\nנסה לבחור מהאפשרויות למטה, או שלח מייל לצוות שלנו:`,
      quickReplies: [
        ...matched.replies,
        'שאלה שלא נענתה — שלח מייל',
      ],
    };
  }

  // ברירת מחדל כללית — לא נמצאה כוונה
  return {
    text: `לא הצלחתי להבין את השאלה 😅\n${userName}, נסה לכתוב בצורה אחרת, או בחר נושא:\n\n📌 לא מצאת תשובה? שלח מייל לצוות שלנו — נחזור תוך 24 שעות!`,
    quickReplies: [
      'מה הסטטוס שלי?',
      'כמה זה עולה?',
      'רוצה לבטל',
      'ביטוח',
      'צור קשר',
      'שאלה שלא נענתה — שלח מייל',
      'חזור לתפריט',
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// תשובות למנקה
// ══════════════════════════════════════════════════════════════════════════════
function getCleanerResponse(msg: string, userName: string, allBookings: any[]): BotResponse {
  const pending   = allBookings.filter(b => b.status === 'pending').length;
  const confirmed = allBookings.filter(b => b.status === 'confirmed').length;
  const done      = allBookings.filter(b => b.status === 'done').length;
  const totalEarned = allBookings.filter(b => b.status === 'done').reduce((s, b) => s + (b.total || 0), 0);

  // ── ברכות ────────────────────────────────────────────────────────────────
  if (matchAny(msg, ['שלום','היי','הי','בוקר טוב','ערב טוב','מה שלומך','מה נשמע'])) {
    return {
      text: `שלום ${userName}! 👋\nאני CLEAN Bot — עוזר התמיכה למנקים של A&M Clean.\nאיך אוכל לעזור לך היום?`,
      quickReplies: ['ההזמנות שלי', 'כמה הרווחתי?', 'איך מקבלים תשלום?', 'עדכון זמינות', 'חזור לתפריט'],
    };
  }

  // ── תודה ────────────────────────────────────────────────────────────────
  if (matchAny(msg, ['תודה','תודה רבה','מעולה','סבבה','ממש עזרת','אחלה','כל הכבוד'])) {
    return {
      text: `שמחתי לעזור ${userName}! 🌟\n\nהאם יש שאלות נוספות או שאלות שלא נענו?`,
      quickReplies: ['כן, יש לי שאלה נוספת', 'לא, הכל בסדר', 'שאלה שלא נענתה — שלח מייל'],
    };
  }

  // ── הזמנות שלי ───────────────────────────────────────────────────────────
  if (matchAny(msg, ['הזמנות שלי','כמה הזמנות','ההזמנות','הזמנה חדשה','הזמנות ממתינות','בדיקת הזמנות'])) {
    return {
      text: `📋 סיכום ההזמנות שלך, ${userName}:\n\n⏳ ממתינות לאישור: ${pending}\n✅ מאושרות: ${confirmed}\n🏁 הושלמו: ${done}\n\nלניהול הזמנות — כנס לפרופיל שלך.`,
      quickReplies: ['הפרופיל שלי', 'כמה הרווחתי?', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── הכנסות ───────────────────────────────────────────────────────────────
  if (matchAny(msg, ['כמה הרווחתי','הכנסות','הרוויח','כסף','תשלום שקיבלתי','סה"כ','כמה קיבלתי'])) {
    return {
      text: `💰 הכנסות שלך, ${userName}:\n\n✅ ניקויים שהושלמו: ${done}\n💵 סה"כ הכנסות: ₪${totalEarned}\n\n🎉 A&M Clean לא גובה עמלה — 100% הולך אליך!`,
      quickReplies: ['ההזמנות שלי', 'איך מקבלים תשלום?', 'חזור לתפריט'],
    };
  }

  // ── קבלת תשלום ───────────────────────────────────────────────────────────
  if (matchAny(msg, ['איך מקבלים תשלום','קבלת תשלום','ביט','מזומן','אשראי','אמצעי תשלום','כרטיס'])) {
    return {
      text: `💳 קבלת תשלום מלקוחות:\n\n💵 מזומן — בסיום הניקוי ישירות מהלקוח\n📱 ביט — העברה דיגיטלית מיידית\n💳 אשראי — הלקוח משלם דרך האפליקציה\n\n✅ A&M Clean לא גובה עמלה — כל הסכום שלך!`,
      quickReplies: ['כמה הרווחתי?', 'חזור לתפריט'],
    };
  }

  // ── עדכון זמינות ─────────────────────────────────────────────────────────
  if (matchAny(msg, ['עדכון זמינות','לעדכן זמינות','זמינות','ימי עבודה','שעות עבודה','לשנות זמינות','להגדיר ימים'])) {
    return {
      text: `🗓️ עדכון זמינות:\n\n1️⃣ כנס לפרופיל שלך\n2️⃣ לחץ על "ימי עבודה"\n3️⃣ בחר את הימים והשעות שבהם אתה זמין\n4️⃣ לחץ שמור\n\nלקוחות יוכלו להזמין אותך רק בשעות שהגדרת!`,
      quickReplies: ['הפרופיל שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── עדכון מחיר ───────────────────────────────────────────────────────────
  if (matchAny(msg, ['לשנות מחיר','עדכון מחיר','מחיר לשעה','תעריף','לעדכן תעריף','כמה לגבות'])) {
    return {
      text: `💲 עדכון מחיר:\n\n1️⃣ כנס לפרופיל שלך\n2️⃣ לחץ על "עריכת פרופיל"\n3️⃣ עדכן את המחיר לשעה\n4️⃣ שמור שינויים\n\n💡 טיפ: מחיר ממוצע בשוק: ₪65–₪90/שעה`,
      quickReplies: ['הפרופיל שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── אישור הזמנה ──────────────────────────────────────────────────────────
  if (matchAny(msg, ['לאשר הזמנה','אישור הזמנה','לקבל הזמנה','לאשר','לדחות הזמנה','לסרב'])) {
    return {
      text: `✅ אישור/דחיית הזמנה:\n\n1️⃣ תקבל התראה על הזמנה חדשה\n2️⃣ כנס לפרופיל → "הזמנות נכנסות"\n3️⃣ לחץ "אשר" או "דחה"\n\n⚠️ הזמנה שלא אושרה תוך שעה — מתבטלת אוטומטית.`,
      quickReplies: ['הפרופיל שלי', 'ההזמנות שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── התחלת ניקוי ──────────────────────────────────────────────────────────
  if (matchAny(msg, ['להתחיל ניקוי','להתחיל','כפתור התחלה','איך מתחילים','הגעתי ללקוח','להתחיל עבודה'])) {
    return {
      text: `🧹 התחלת ניקוי:\n\n1️⃣ לחץ "אני בדרך" כשאתה יוצא לכיוון הלקוח\n2️⃣ הגע ללקוח — לחץ "התחל ניקוי"\n3️⃣ בסיום — לחץ "סיים ניקוי"\n\nהלקוח יקבל התראה בכל שלב 📲`,
      quickReplies: ['הפרופיל שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── דירוג וביקורות ───────────────────────────────────────────────────────
  if (matchAny(msg, ['דירוג','ביקורת','כוכבים','ביקורות שלי','דירוג שלי','לקוח דירג','ציון'])) {
    return {
      text: `⭐ דירוגים וביקורות:\n\nהדירוג שלך מחושב מממוצע כל הביקורות.\n\nלראות ביקורות:\n📋 כנס לפרופיל → "ביקורות"\n\n💡 טיפ: שירות מצוין = ביקורות טובות = יותר לקוחות!`,
      quickReplies: ['הפרופיל שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── פרופיל ותמונה ────────────────────────────────────────────────────────
  if (matchAny(msg, ['פרופיל','תמונה','עריכת פרופיל','לשנות פרטים','תיאור','bio','להוסיף תמונה'])) {
    return {
      text: `👤 עריכת פרופיל:\n\n1️⃣ כנס לפרופיל שלך\n2️⃣ לחץ "ערוך פרופיל"\n3️⃣ עדכן: שם / תמונה / תיאור / מחיר / שירותים\n\n📸 תמונה מקצועית = 3× יותר הזמנות!`,
      quickReplies: ['הפרופיל שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── ביטול הזמנה ──────────────────────────────────────────────────────────
  if (matchAny(msg, ['לבטל הזמנה','ביטול הזמנה','לא יכול להגיע','לסגת','לבטל'])) {
    return {
      text: `❌ ביטול הזמנה:\n\n1️⃣ כנס לפרופיל → "הזמנות"\n2️⃣ בחר את ההזמנה\n3️⃣ לחץ "בטל הזמנה"\n\n⚠️ ביטולים רבים עלולים להשפיע על הדירוג שלך.\nמומלץ לעדכן זמינות כדי למנוע מצב זה.`,
      quickReplies: ['עדכון זמינות', 'הפרופיל שלי', 'חזור לתפריט'],
    };
  }

  // ── צ'אט עם לקוח ─────────────────────────────────────────────────────────
  if (matchAny(msg, ['צ\'אט','לשלוח הודעה ללקוח','לדבר עם לקוח','ליצור קשר עם לקוח','הודעה'])) {
    return {
      text: `💬 צ'אט עם לקוח:\n\n1️⃣ כנס לפרופיל → "הזמנות"\n2️⃣ בחר הזמנה\n3️⃣ לחץ "💬 צ'אט"\n\nכל ההודעות נשמרות ומאובטחות 🔒`,
      quickReplies: ['הפרופיל שלי', 'חזור לתפריט'],
      navigateTo: '/profile',
    };
  }

  // ── עמלה ─────────────────────────────────────────────────────────────────
  if (matchAny(msg, ['עמלה','דמי שירות','כמה לוקחים','אחוז','חינם','בחינם','ללא עמלה'])) {
    return {
      text: `💚 עמלת A&M Clean: 0%!\n\n✅ אתה שומר 100% מהתשלום מהלקוח\n✅ אין דמי רישום\n✅ אין דמי חודשי\n\nPlatform חינמי לחלוטין למנקים! 🎉`,
      quickReplies: ['איך מקבלים תשלום?', 'חזור לתפריט'],
    };
  }

  // ── תמיכה אנושית ─────────────────────────────────────────────────────────
  if (matchAny(msg, ['לדבר עם אדם','נציג','שירות לקוחות','צור קשר','אדם אמיתי','תמיכה אנושית'])) {
    return {
      text: `📞 תמיכה למנקים:\n\n📧 cleaners@amclean.co.il\n📱 WhatsApp: 050-000-0000\n\nשעות מענה לצוות מנקים:\nא׳–ה׳: 08:00–20:00`,
      quickReplies: ['שאלה שלא נענתה — שלח מייל', 'חזור לתפריט'],
    };
  }

  // ── כן יש עוד שאלות ─────────────────────────────────────────────────────
  if (matchAny(msg, ['כן יש לי שאלה','יש לי שאלה נוספת','כן יש עוד','יש עוד שאלה'])) {
    return {
      text: `😊 בשמחה! מה השאלה שלך?\n\nאו בחר מהנושאים:`,
      quickReplies: ['ההזמנות שלי', 'כמה הרווחתי?', 'עדכון זמינות', 'דירוג וביקורות', 'עמלה', 'צור קשר'],
    };
  }

  // ── לא הכל בסדר ─────────────────────────────────────────────────────────
  if (matchAny(msg, ['לא הכל בסדר','הכל בסדר','הכל ברור','אין שאלות','לא תודה'])) {
    return {
      text: `מעולה! 🎉\nשמחנו לעזור ${userName}!\n\nCLEAN Bot זמין 24/7 — תמיד שמח לעזור 💙\nעבודה פורה! ✨`,
      quickReplies: [],
    };
  }

  // ── שלח מייל ────────────────────────────────────────────────────────────
  if (matchAny(msg, ['שלח מייל','שאלה שלא נענתה','שלח לתמיכה','מייל לתמיכה','שאלה שלא נענתה — שלח מייל'])) {
    return {
      text: `בוודאי! 📧\nנפתח את אפליקציית המייל שלך.\n\n✉️ cleaners@amclean.co.il\n\nנחזור אליך תוך 24 שעות! 🕐`,
      quickReplies: ['חזור לתפריט'],
      action: 'sendEmail',
    };
  }

  // ── תפריט ────────────────────────────────────────────────────────────────
  if (matchAny(msg, ['תפריט','חזור לתפריט','עזרה','help','אפשרויות','מה יש'])) {
    return {
      text: `👨‍💼 במה אוכל לעזור, ${userName}?\n\nבחר נושא:`,
      quickReplies: [
        'ההזמנות שלי',
        'כמה הרווחתי?',
        'איך מקבלים תשלום?',
        'עדכון זמינות',
        'אישור הזמנה',
        'התחלת ניקוי',
        'דירוג וביקורות',
        'עמלה',
        'צור קשר',
      ],
    };
  }

  // ── ברירת מחדל למנקה ────────────────────────────────────────────────────
  return {
    text: `לא הצלחתי להבין 🤔\n${userName}, נסה לבחור מהנושאים:`,
    quickReplies: [
      'ההזמנות שלי',
      'כמה הרווחתי?',
      'עדכון זמינות',
      'עמלה',
      'צור קשר',
      'שאלה שלא נענתה — שלח מייל',
    ],
  };
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 250, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0,  duration: 250, useNativeDriver: true }),
          Animated.delay(500),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={s.typingWrap}>
      <View style={s.botAvatarSm}>
        <Text style={{ fontSize: 12 }}>👨‍💼</Text>
      </View>
      <View style={s.typingBubble}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[s.typingDot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SupportScreen() {
  const router = useRouter();
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, []);

  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [typing,    setTyping]    = useState(false);
  const [context,   setContext]   = useState<BotContext>({
    userName:      'אורח',
    role:          'client',
    activeBooking:  null,
    allBookings:   [],
  });

  // ── Load user context ──────────────────────────────────────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      // Guest greeting
      setTimeout(() => {
        pushBotMessage(
          'הגעת למרכז השירות של A&M Clean 👨‍💼\nבמה נוכל לעזור?',
          ['מה הסטטוס שלי?', 'כמה זה עולה?', 'איך להזמין?', 'צור קשר'],
        );
      }, 600);
      return;
    }

    (async () => {
      // ── קריאת פרטי משתמש כולל תפקיד ────────────────────────────────────
      let userName = 'אורח';
      let role: 'client' | 'cleaner' = 'client';
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) {
          const data = uSnap.data();
          userName = data.name || 'אורח';
          role = data.role === 'cleaner' ? 'cleaner' : 'client';
        }
      } catch (_) {}

      // ── הזמנות לפי תפקיד ────────────────────────────────────────────────
      let allBookings: any[] = [];
      let activeBooking: any = null;
      try {
        const bookingField = role === 'cleaner' ? 'cleanerUid' : 'clientUid';
        const q = query(
          collection(db, 'bookings'),
          where(bookingField, '==', uid),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        allBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (role === 'client') {
          activeBooking = allBookings.find(b =>
            b.status && !['done', 'cancelled'].includes(b.status)
          ) || null;
        }
      } catch (_) {}

      const ctx: BotContext = { userName, role, activeBooking, allBookings };
      setContext(ctx);

      // ── ברכת פתיחה לפי תפקיד ────────────────────────────────────────────
      setTimeout(() => {
        if (role === 'cleaner') {
          pushBotMessage(
            'הגעת למרכז השירות של A&M Clean 👨‍💼\nבמה נוכל לעזור?',
            ['ההזמנות שלי', 'כמה הרווחתי?', 'איך מקבלים תשלום?', 'עדכון זמינות', 'חזור לתפריט'],
            ctx
          );
        } else {
          pushBotMessage(
            'הגעת למרכז השירות של A&M Clean 👨‍💼\nבמה נוכל לעזור?',
            ['מה הסטטוס שלי?', 'רוצה לבטל', 'כמה זה עולה?', 'פרטי המנקה', 'איך להזמין?'],
            ctx
          );
        }
      }, 600);
    })();
  }, []);

  // ── Message helpers ────────────────────────────────────────────────────────
  const pushBotMessage = (
    text: string,
    quickReplies?: string[],
    _ctx?: BotContext
  ) => {
    setMessages(prev => [...prev, {
      id:    Date.now().toString(),
      from:  'bot',
      text,
      quickReplies,
      time:  new Date(),
    }]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const pushUserMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id:   Date.now().toString() + 'u',
      from: 'user',
      text,
      time: new Date(),
    }]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Send flow ──────────────────────────────────────────────────────────────
  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput('');
    Keyboard.dismiss();
    pushUserMessage(trimmed);

    // Handle navigation shortcuts
    if (trimmed === 'הזמנות שלי' || trimmed === 'הפרופיל שלי') {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        pushBotMessage('מעביר אותך לפרופיל... 📋');
        setTimeout(() => router.push('/profile'), 800);
      }, 700);
      return;
    }

    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const response = getBotResponse(trimmed, context);
      pushBotMessage(response.text, response.quickReplies);

      // Open email client if needed
      if (response.action === 'sendEmail') {
        const isCleaner = context.role === 'cleaner';
        const emailAddr = isCleaner ? 'cleaners@amclean.co.il' : 'support@amclean.co.il';
        const roleLabel = isCleaner ? 'מנקה' : 'לקוח';
        const subject = encodeURIComponent(`שאלה שלא נענתה — פנייה לתמיכה A&M Clean (${roleLabel})`);
        const body = encodeURIComponent(
          `שלום צוות A&M Clean,\n\nשמי: ${context.userName}\nתפקיד: ${roleLabel}\n\nאנא פנו אלי בנוגע לשאלה הבאה:\n\n`
        );
        setTimeout(() => {
          Linking.openURL(`mailto:${emailAddr}?subject=${subject}&body=${body}`);
        }, 1200);
      }
    }, 800 + Math.random() * 400);
  };

  // ── Render message ─────────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isBot = item.from === 'bot';
    return (
      <View style={[s.msgRow, isBot ? s.msgRowBot : s.msgRowUser]}>
        {isBot && (
          <View style={s.botAvatarSm}>
            <Text style={{ fontSize: 14 }}>👨‍💼</Text>
          </View>
        )}
        <View style={{ maxWidth: '80%' }}>
          <View style={[s.bubble, isBot ? s.bubbleBot : s.bubbleUser]}>
            <Text style={[s.bubbleText, isBot ? s.bubbleTextBot : s.bubbleTextUser]}>
              {item.text}
            </Text>
          </View>
          <Text style={[s.timeText, isBot ? { textAlign: 'left' } : { textAlign: 'right' }]}>
            {item.time.getHours().toString().padStart(2, '0')}:
            {item.time.getMinutes().toString().padStart(2, '0')}
          </Text>

          {/* Quick replies */}
          {isBot && item.quickReplies && item.quickReplies.length > 0 && (
            <View style={s.qrWrap}>
              {item.quickReplies.map(qr => (
                <TouchableOpacity
                  key={qr}
                  style={s.qrChip}
                  onPress={() => handleSend(qr)}
                >
                  <Text style={s.qrChipText}>{qr}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerAvatar}>
            <Text style={{ fontSize: 20 }}>👨‍💼</Text>
          </View>
          <View>
            <Text style={s.headerName}>CLEAN Bot</Text>
            <View style={s.onlineRow}>
              <View style={s.onlineDot} />
              <Text style={s.onlineText}>מחובר תמיד</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={m => m.id}
          contentContainerStyle={s.msgList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={typing ? <TypingDots /> : null}
        />

        {/* Input bar */}
        <View style={s.inputBar}>
          <TextInput
            style={s.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="כתוב שאלה..."
            placeholderTextColor={C.sub}
            onSubmitEditing={() => handleSend(input)}
            returnKeyType="send"
            multiline={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, !input.trim() && { opacity: 0.4 }]}
            onPress={() => handleSend(input)}
            disabled={!input.trim()}
          >
            <Text style={s.sendBtnText}>▶</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: NAV_BAR_HEIGHT, backgroundColor: C.white }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg },

  // Header
  header:        { backgroundColor: C.blueDark, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  backBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtnText:   { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -3 },
  headerCenter:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar:  { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerName:    { color: '#fff', fontSize: 16, fontWeight: '800' },
  onlineRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  onlineText:    { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  // Messages
  msgList:       { paddingHorizontal: 16, paddingVertical: 12, gap: 8, paddingBottom: 20 },
  msgRow:        { flexDirection: 'row', gap: 8, marginVertical: 4 },
  msgRowBot:     { alignSelf: 'flex-start', maxWidth: '90%' },
  msgRowUser:    { alignSelf: 'flex-end',   flexDirection: 'row-reverse', maxWidth: '90%' },

  // Avatar
  botAvatarSm:   { width: 32, height: 32, borderRadius: 16, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center', marginTop: 4, flexShrink: 0 },

  // Bubbles
  bubble:        { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '100%' },
  bubbleBot:     { backgroundColor: C.white, borderBottomLeftRadius: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  bubbleUser:    { backgroundColor: C.blue, borderBottomRightRadius: 4 },
  bubbleText:    { fontSize: 14, lineHeight: 22 },
  bubbleTextBot: { color: C.text },
  bubbleTextUser:{ color: '#fff' },
  timeText:      { fontSize: 10, color: C.sub, marginTop: 3, paddingHorizontal: 4 },

  // Quick replies
  qrWrap:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  qrChip:        { backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: C.blue },
  qrChipText:    { fontSize: 12, fontWeight: '700', color: C.blue },

  // Typing
  typingWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  typingBubble:  { backgroundColor: C.white, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', gap: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  typingDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: C.sub },

  // Input bar
  inputBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  textInput:     { flex: 1, backgroundColor: C.bg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.text, maxHeight: 80, borderWidth: 1, borderColor: C.border, textAlign: 'right' },
  sendBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  sendBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
});


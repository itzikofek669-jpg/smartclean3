import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, Dimensions,
  Alert, ScrollView, Modal, ActivityIndicator, Animated,
 Image as RNImage } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useLanguage, T, useAppColors, AppColors } from '../lib/LanguageContext';
import { Lang } from '../lib/translations';
import { TERMS_BY_LANG } from '../lib/terms';
import ServiceInfoBtn from '../lib/ServiceInfoBtn';
import { MaterialIcons } from '@expo/vector-icons';

const NAV_BAR_HEIGHT = Platform.OS === 'android'
  ? Math.max(0, Dimensions.get('screen').height - Dimensions.get('window').height - (StatusBar.currentHeight || 0))
  : 0;

function createTM(c: AppColors) {
  return StyleSheet.create({
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.blueDark, padding: 16 },
    title:       { fontSize: 17, fontWeight: '800', color: c.white },
    closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    body:        { fontSize: 14, color: c.textDark, lineHeight: 24, textAlign: 'right' },
    agreeBtn:    { backgroundColor: c.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
    agreeBtnText:{ fontSize: 16, fontWeight: '800', color: c.white },
  });
}

function createS(c: AppColors) {
  return StyleSheet.create({
    wrap:            { flex: 1, backgroundColor: c.white },
    hero:            { alignItems: 'center', paddingTop: 8, paddingBottom: 4, position: 'relative', backgroundColor: c.white },
    backBtn:         { position: 'absolute', top: 16, left: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: c.blueLight, borderWidth: 1.5, borderColor: c.blueBorder, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    logo:            { fontSize: 44, marginBottom: 8 },
    title:           { fontSize: 22, fontWeight: '800', color: c.white },
    card:            { backgroundColor: c.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1 },
    cardTitle:       { fontSize: 22, fontWeight: '800', color: c.textDark, marginBottom: 20, textAlign: 'center' },
    label:           { fontSize: 13, fontWeight: '700', color: c.textDark, marginBottom: 8, textAlign: 'right' },
    field:           { marginBottom: 14 },
    input:           { backgroundColor: c.blueLight, borderRadius: 12, padding: 14, fontSize: 15, color: c.textDark, borderWidth: 1, borderColor: c.blueBorder, textAlign: 'center' },
    inputError:      { borderColor: '#EF4444', borderWidth: 1.5, backgroundColor: '#FEF2F2' },
    sectionTitleError: { color: '#EF4444' },
    checkBoxError:   { borderColor: '#EF4444' },
    roleRow:         { flexDirection: 'row', gap: 12, marginBottom: 20 },
    roleBtn:         { flex: 1, backgroundColor: c.blueLight, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: c.blueBorder },
    roleBtnActive:   { borderColor: c.blue, backgroundColor: '#EBF4FF' },
    roleIcon:        { fontSize: 28, marginBottom: 6 },
    roleLabel:       { fontSize: 16, fontWeight: '800', color: c.textDark, marginBottom: 2, textAlign: 'center' },
    roleLabelActive: { color: c.blue },
    roleDesc:        { fontSize: 11, color: c.textSub, textAlign: 'center' },
    clientBlock:     { backgroundColor: c.blueLight, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.blueBorder },
    freePromoCard:   { backgroundColor: '#D1FAE5', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: '#6EE7B7', alignItems: 'center' },
    freePromoText:   { fontSize: 13, fontWeight: '800', color: '#065F46', textAlign: 'center', lineHeight: 20 },
    cleanerBlock:    { backgroundColor: c.blueLight, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.blueBorder },
    sectionTitle:    { fontSize: 13, fontWeight: '800', color: c.textDark, marginBottom: 10, marginTop: 4, textAlign: 'right' },
    pillRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    availRow:        { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: c.blueBorder },
    availDayBtn:     { minWidth: 56, height: 38, borderRadius: 10, paddingHorizontal: 8, backgroundColor: c.white, borderWidth: 1.5, borderColor: c.blueBorder, alignItems: 'center', justifyContent: 'center' },
    availDayBtnActive: { backgroundColor: c.blue, borderColor: c.blue },
    availDayText:    { fontSize: 12, fontWeight: '800', color: c.textDark },
    availDayTextActive: { color: c.white },
    availTimePickers: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 6, paddingRight: 8 },
    availTimeGroup:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    availTimeLabel:  { fontSize: 11, fontWeight: '700', color: c.textSub },
    availTimeScroll: { flexDirection: 'row' },
    availTimeInput:  { width: 52, backgroundColor: c.blueLight, borderRadius: 8, borderWidth: 1, borderColor: c.blueBorder, paddingVertical: 6, paddingHorizontal: 4, fontSize: 14, fontWeight: '700', color: c.textDark, textAlign: 'center' },
    availTimeChip:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: c.white, borderWidth: 1, borderColor: c.blueBorder, marginRight: 6 },
    availTimeChipActive: { backgroundColor: c.blue, borderColor: c.blue },
    availTimeChipText: { fontSize: 12, fontWeight: '600', color: c.textDark },
    availTimeChipTextActive: { color: c.white },
    pill:            { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: c.white, borderWidth: 1.5, borderColor: c.blueBorder },
    pillActive:      { backgroundColor: c.blue, borderColor: c.blue },
    pillText:        { fontSize: 12, fontWeight: '700', color: c.textDark, fontFamily: 'sans-serif' },
    pillTextActive:  { color: c.white },
    termsBox:        { backgroundColor: c.blueLight, borderRadius: 14, padding: 14, marginBottom: 16, gap: 12, borderWidth: 1, borderColor: c.blueBorder },
    checkRow:        { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
    checkBox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.blueBorder, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
    checkBoxOn:      { backgroundColor: c.blue, borderColor: c.blue },
    checkMark:       { color: c.white, fontSize: 13, fontWeight: '900' },
    checkLabel:      { flex: 1, fontSize: 13, color: c.textDark, lineHeight: 20, textAlign: 'right' },
    checkLink:       { color: c.blue, fontWeight: '700', textDecorationLine: 'underline' },
    btn:             { backgroundColor: c.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
    btnDisabled:     { backgroundColor: c.blueBorder },
    btnText:         { fontSize: 16, fontWeight: '800', color: c.white },
    // Photo picker
    photoPickerWrap:        { alignItems: 'center', marginBottom: 20, gap: 8 },
    photoPickerBtn:         { width: 110, height: 110, borderRadius: 55, position: 'relative' },
    photoPickerImg:         { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: c.blue },
    photoPickerPlaceholder: { width: 110, height: 110, borderRadius: 55, backgroundColor: c.blueLight, borderWidth: 2.5, borderColor: c.blueBorder, alignItems: 'center', justifyContent: 'center' },
    photoPickerBadge:       { position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.white },
    photoPickerLabel:       { fontSize: 14, fontWeight: '700', color: c.textDark },
    photoPickerSub:         { fontSize: 12, color: c.textSub, textAlign: 'center' },
    addrDropdown:    { position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: c.white, borderRadius: 10, borderWidth: 1, borderColor: c.blueBorder, zIndex: 100, elevation: 5, maxHeight: 200 },
    addrSugRow:      { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
    addrSugBorder:   { borderBottomWidth: 1, borderBottomColor: c.blueBorder },
    addrSugText:     { fontSize: 14, color: c.textDark, flex: 1, textAlign: 'right' },
  });
}

const SERVICE_TYPES = [
  { key: 'ניקיון רגיל',              icon: '🏠' },
  { key: 'ניקוי לפסח',             icon: '🧹' },
  { key: 'חלונות',                 icon: '🪟' },
  { key: 'שטיפת רכב',              icon: '🚗' },
  { key: 'לאחר שיפוץ',             icon: '🔨' },
  { key: 'ניקיון משרדים',           icon: '🏢' },
  { key: 'ניקיון אחרי אירוע',       icon: '🎉' },
  { key: 'מחסן ועליית גג',          icon: '📦' },
  { key: 'סידורי בגדים וארונות',    icon: '👔' },
];

const PAYMENT_OPTS = [
  { key: 'cash',   label: 'מזומן',           icon: '💵' },
  { key: 'bit',    label: 'Bit',              icon: '📱' },
  { key: 'paybox', label: 'PayBox',            icon: '🅿️' },
  { key: 'bank',   label: 'העברה בנקאית',   icon: '🏦' },
];

const LANG_OPTS = [
  { key: 'he', label: 'עברית',    flag: '🇮🇱' },
  { key: 'en', label: 'English',  flag: '🇬🇧' },
  { key: 'ru', label: 'Русский',  flag: '🇷🇺' },
  { key: 'ar', label: 'العربية',  flag: '🇸🇦' },
  { key: 'fr', label: 'Français', flag: '🇫🇷' },
  { key: 'hi', label: 'Hindi',   flag: '🇮🇳' },
  { key: 'uk', label: 'Ukrainian', flag: '🇺🇦' },
];

const TERMS = `תקנון שימוש, מדיניות פרטיות והגבלת אחריות
אפליקציית A&M Clean
עדכון אחרון: מאי 2026

═══════════════════════════════
פרק א' — הגדרות כלליות
═══════════════════════════════

1. מבוא ואופי השירות
1.1 אפליקציית A&M Clean ("האפליקציה", "הפלטפורמה") הינה פלטפורמה טכנולוגית דיגיטלית בלבד, המשמשת כמתווכת אלקטרונית בין לקוחות המעוניינים בשירותי ניקיון לבין נותני שירות עצמאיים ("מנקים").
1.2 האפליקציה אינה חברת ניקיון, אינה מעסיקה מנקים ואינה צד כלשהו להסכם השירות הנחתם בין הלקוח למנקה.
1.3 כל עסקה, שירות, תשלום ופעילות מתבצעים ישירות ובאופן בלעדי בין המשתמשים עצמם.
1.4 עצם ההרשמה לאפליקציה ו/או השימוש בה מהווה הסכמה מלאה, מוחלטת ובלתי חוזרת לכל תנאי תקנון זה.

═══════════════════════════════
פרק ב' — הגבלת אחריות מוחלטת
═══════════════════════════════

2. היעדר אחריות כוללת
2.1 האפליקציה, בעליה, מנהליה, עובדיה, שלוחיה וכל מי מטעמה ("הנהלת האפליקציה") לא יישאו בכל אחריות, ישירה, עקיפה, נסיבתית, תוצאתית, עונשית או מיוחדת, לכל נזק מכל סוג שהוא, לרבות:

• נזק גופני, פציעה, מוות, תאונה או פגיעה בריאותית מכל סוג
• נזק לרכוש, שבר, אובדן, גניבה, שריפה, הצפה או כל נזק פיזי לנכס
• נזק כלכלי, הפסד הכנסה, אובדן רווח או נזק עסקי
• נזק לצד שלישי כלשהו הנובע מפעילות המנקה
• נזק כתוצאה מאי התאמת השירות לציפיות הלקוח
• נזק כתוצאה מרשלנות, מחדל או מעשה של מנקה
• נזק עקב שימוש בחומרי ניקוי, ציוד או כלים
• אובדן מידע, נתונים פרטיים או פגיעה בפרטיות
• כל נזק אחר הנובע מהשימוש באפליקציה או מהסתמכות עליה

2.2 הנהלת האפליקציה לא תישא בכל אחריות לאיכות, מקצועיות, אמינות, כשירות משפטית או ביטחונית של מנקה כלשהו הפועל דרך הפלטפורמה.

2.3 האפליקציה אינה בודקת, מאמתת, מסמיכה או מעניקה כל הסמכה מקצועית למנקים. האחריות לבחירת המנקה ולבדיקת כשירותו מוטלת על הלקוח בלבד.

═══════════════════════════════
פרק ג' — אחריות המשתמשים
═══════════════════════════════

3. אחריות הלקוח
3.1 הלקוח מצהיר ומתחייב כי:
• הוא בחר את המנקה מרצונו החופשי ועל דעתו בלבד
• הוא מאפשר למנקה כניסה לנכסו על דעתו ואחריותו המלאה
• הוא מודע לכך שהאפליקציה אינה ערבה לתוצאות השירות
• כל מחלוקת עם המנקה תיושב ישירות בינו לבין המנקה בלבד
• הוא ישפה את הנהלת האפליקציה בגין כל תביעה, הוצאה או נזק שייגרמו לה עקב פעולותיו

3.2 הלקוח מוותר במפורש על כל טענה, תביעה, דרישה או תרעומת כלפי הנהלת האפליקציה בכל עניין הקשור לשירות שקיבל מהמנקה.

4. אחריות המנקה
4.1 המנקה מצהיר ומתחייב כי:
• הוא עצמאי, בעל כישורים מתאימים ופועל על דעתו ואחריותו בלבד
• הוא אחראי לכל נזק שייגרם במסגרת עבודתו
• הוא אחראי לביטוח עצמו, לרבות ביטוח צד ג' וביטוח נזקים
• הוא ישא בכל אחריות מקצועית, משפטית, פלילית ואזרחית בגין פעולותיו
• הוא אחראי לדיווח מס, הפרשות סוציאליות וכל חובה חוקית החלה עליו כעצמאי

4.2 הנהלת האפליקציה לא תישא בכל אחריות לנזק שייגרם על ידי מנקה כלשהו.

═══════════════════════════════
פרק ד' — תשלומים וביטולים
═══════════════════════════════

5. מדיניות תשלומים
5.1 כל תשלום מתבצע ישירות בין הלקוח למנקה. האפליקציה אינה גובה תשלום ואינה מחזיקה כספים בנאמנות.
5.2 האפליקציה אינה אחראית לאי תשלום, מחלוקות תשלום, עיכובים או כשלים בהעברת כספים.
5.3 כל מחלוקת כספית בין לקוח למנקה תיושב ביניהם ישירות ללא מעורבות האפליקציה.

6. מדיניות ביטולים
6.1 ביטול עד 24 שעות לפני מועד השירות — החזר מלא.
6.2 ביטול פחות מ-24 שעות לפני מועד השירות — לא יינתן החזר כלשהו.
6.3 אי הגעת לקוח ללא הודעה מוקדמת — לא יינתן החזר כלשהו.
6.4 האפליקציה אינה אחראית לאכיפת מדיניות הביטולים ואינה צד למחלוקות הנובעות מביטולים.

═══════════════════════════════
פרק ה' — שיפוי והגנה משפטית
═══════════════════════════════

7. התחייבות לשיפוי
7.1 כל משתמש (לקוח או מנקה) מתחייב בזאת לשפות, להגן ולפצות את הנהלת האפליקציה, בעליה, מנהליה ועובדיה, בגין כל תביעה, הוצאה משפטית, פיצוי, קנס, נזק ישיר ועקיף, לרבות שכר טרחת עורך דין, הנובעים מ:
• הפרת תנאי תקנון זה
• שימוש לרעה באפליקציה
• נזק שגרם המשתמש לצד שלישי
• כל פעולה בלתי חוקית שביצע המשתמש

7.2 ויתור על תביעות: המשתמש מוותר בזאת, באופן מוחלט, בלתי חוזר ובלא תנאי, על כל טענה, תביעה, דרישה, קובלנה או הליך משפטי כלשהו כנגד הנהלת האפליקציה בקשר לשימוש בה.

═══════════════════════════════
פרק ו' — הוראות נוספות
═══════════════════════════════

8. היעדר יחסי עבודה
8.1 השימוש באפליקציה אינו יוצר בשום מקרה יחסי עובד-מעסיק, שותפות, סוכנות, שליחות, זיכיון או כל מערכת יחסים משפטית אחרת בין הנהלת האפליקציה לבין כל משתמש.
8.2 המנקים פועלים כקבלנים עצמאיים בלבד.

9. פרטיות ואבטחת מידע
9.1 האפליקציה אוספת מידע אישי לצורך מתן השירות בלבד.
9.2 המידע לא יועבר לצדדים שלישיים ללא הסכמת המשתמש, למעט כנדרש על פי דין.
9.3 המשתמש מסכים לאיסוף ועיבוד מידעו לצורך פעילות האפליקציה.

10. שינויים בתקנון
10.1 הנהלת האפליקציה רשאית לשנות תקנון זה בכל עת וללא הודעה מוקדמת.
10.2 המשך השימוש באפליקציה לאחר שינוי התקנון מהווה הסכמה לנוסחו המעודכן.

11. תחולת הדין וסמכות שיפוט
11.1 על תקנון זה יחולו דיני מדינת ישראל בלבד.
11.2 סמכות השיפוט הבלעדית לכל מחלוקת הנובעת מתקנון זה תהא נתונה לבתי המשפט המוסמכים במחוז תל אביב בלבד.
11.3 ככל שייקבע כי סעיף כלשהו בתקנון זה אינו חוקי או בלתי אכיף, יוסיף יתר הסעיפים לחול במלואם.

12. כותרת לעניין פרשנות
12.1 בכל מקרה של סתירה בין הוראות תקנון זה לבין כל הבנה, הצהרה או מצג אחר, יגברו הוראות תקנון זה.
12.2 אי מימוש זכות כלשהי על פי תקנון זה לא ייחשב כוויתור עליה.

═══════════════════════════════
אישור והסכמה
═══════════════════════════════

על ידי לחיצה על "אני מסכים/ה לתנאי השימוש" ו/או שימוש באפליקציה, המשתמש מאשר כי:
✓ קרא את כל תנאי תקנון זה והבין אותם במלואם
✓ הוא בגיר (מעל גיל 18) וכשיר משפטית לכרות הסכם זה
✓ הוא מסכים לכל הוראות התקנון ללא הסתייגות
✓ הוא מוותר על כל טענה עתידית כנגד הנהלת האפליקציה
✓ הוא מודע לכך שהאפליקציה פועלת כפלטפורמה בלבד

A&M Clean © 2026 — כל הזכויות שמורות`;

function TermsModal({ visible, onClose, closeLabel, title, terms }: { visible: boolean; onClose: () => void; closeLabel: string; title: string; terms: string }) {
  const C = useAppColors();
  const tm = createTM(C);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
        <View style={tm.header}>
          <T style={tm.title}>{title}</T>
          <TouchableOpacity onPress={onClose} style={tm.closeBtn}>
            <T style={{ color: C.white, fontSize: 18 }}>✕</T>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <T style={tm.body}>{terms}</T>
        </ScrollView>
        <View style={{ padding: 16 }}>
          <TouchableOpacity style={tm.agreeBtn} onPress={onClose}>
            <T style={tm.agreeBtnText}>{closeLabel}</T>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Checkbox({ checked, onPress, label, linkLabel, onLinkPress, error }: {
  checked: boolean; onPress: () => void;
  label: string; linkLabel?: string; onLinkPress?: () => void; error?: boolean;
}) {
  const C = useAppColors();
  const s = createS(C);
  return (
    <TouchableOpacity style={s.checkRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.checkBox, checked && s.checkBoxOn, error && s.checkBoxError]}>
        {checked && <T style={s.checkMark}>✓</T>}
      </View>
      <T style={s.checkLabel}>
        {label}{' '}
        {linkLabel && (
          <T style={s.checkLink} onPress={e => { e.stopPropagation?.(); onLinkPress?.(); }}>
            {linkLabel}
          </T>
        )}
      </T>
    </TouchableOpacity>
  );
}

function SectionTitle({ children, error }: { children: string; error?: boolean }) {
  const C = useAppColors();
  const s = createS(C);
  return <T style={[s.sectionTitle, error && s.sectionTitleError]}>{error ? `⚠️ ${children}` : children}</T>;
}

function TogglePill({ label, active, onPress, devanagari }: { label: string; active: boolean; onPress: () => void; devanagari?: boolean }) {
  const C = useAppColors();
  const s = createS(C);
  return (
    <TouchableOpacity style={[s.pill, active && s.pillActive]} onPress={onPress}>
      <T style={[s.pillText, active && s.pillTextActive, devanagari && { fontFamily: 'NotoSansDevanagari_400Regular', fontWeight: '400' }]}>{label}</T>
    </TouchableOpacity>
  );
}

// ─── Free Banner (הרשמה) ──────────────────────────────────────────────────────
function RegisterFreeBanner({ label1, sub1, label2, sub2, color1, color2, bg1, bg2, border1, border2 }: {
  label1: string; sub1: string; label2: string; sub2: string;
  color1: string; color2: string; bg1: string; bg2: string; border1: string; border2: string;
}) {
  const p1 = useRef(new Animated.Value(1)).current;
  const p2 = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = (val: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(val, { toValue: 1,    duration: 600, useNativeDriver: true }),
        Animated.delay(1800),
      ])).start();
    anim(p1, 0);
    anim(p2, 700);
  }, []);
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 18, marginBottom: 14, paddingVertical: 14, paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#6EE7B7', elevation: 3, shadowColor: '#10B981', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
      <Text style={{ fontSize: 13, fontWeight: '900', color: '#065F46', textAlign: 'center', marginBottom: 10 }}>🎉 A&M Clean — חינמי לחלוטין</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: bg1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: border1 }}>
          <Animated.Text style={{ fontSize: 26, fontWeight: '900', color: color1, transform: [{ scale: p1 }] }}>{label1}</Animated.Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: color1, marginTop: 2 }}>{sub1}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: bg2, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: border2 }}>
          <Animated.Text style={{ fontSize: 26, fontWeight: '900', color: color2, transform: [{ scale: p2 }] }}>{label2}</Animated.Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: color2, marginTop: 2 }}>{sub2}</Text>
        </View>
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { lang, t, setLang } = useLanguage();
  const C = useAppColors();
  const s = createS(C);

  // Base fields
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role,     setRole]     = useState<'client' | 'cleaner'>('client');
  const [loading,  setLoading]  = useState(false);

  // Client-specific fields
  const [city,           setCity]           = useState('');
  const [addrSuggestions, setAddrSuggestions] = useState<string[]>([]);
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // כתובת לקוח — בית פרטי או בניין דירות (בבניין חובה קומה + מספר דירה)
  const [isPrivateHouse, setIsPrivateHouse] = useState(false);
  const [clientFloor,    setClientFloor]    = useState('');
  const [clientApt,      setClientApt]      = useState('');

  const fetchAddrSuggestions = (text: string) => {
    if (addrTimer.current) clearTimeout(addrTimer.current);
    if (text.length < 2) { setAddrSuggestions([]); return; }
    addrTimer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&countrycodes=il&limit=6&addressdetails=1&accept-language=he`;
        const res = await fetch(url, { headers: { 'User-Agent': 'AMCleanApp/1.0' } });
        const json = await res.json();
        if (json && json.length > 0) {
          const results = json.map((p: any) => {
            const addr    = p.address || {};
            const road    = addr.road || addr.pedestrian || '';
            const houseNo = addr.house_number || '';
            const city    = addr.city || addr.town || addr.village || addr.municipality || '';
            const street  = road ? (houseNo ? `${road} ${houseNo}` : road) : p.display_name.split(',')[0];
            return street && city ? `${street}, ${city}` : p.display_name.split(',').slice(0, 2).join(', ');
          });
          setAddrSuggestions(results);
        } else {
          setAddrSuggestions([]);
        }
      } catch (_) {}
    }, 350);
  };

  const handleCityChange = (text: string) => {
    setCity(text);
    fetchAddrSuggestions(text);
  };

  const [prefLang,  setPrefLang]  = useState<string>(lang);

  // Cleaner-specific fields
  const [phone,          setPhone]          = useState('');
  const [price,          setPrice]          = useState('');
  const [bio,            setBio]            = useState('');
  const [types,          setTypes]          = useState<string[]>([]);
  const [payment,        setPayment]        = useState<string[]>([]);
  const [servicePricing, setServicePricing] = useState<Record<string, string>>({});
  const [photoB64,       setPhotoB64]       = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [citizenship,    setCitizenship]    = useState('');
  const [isMobile,       setIsMobile]       = useState(true);
  const [cleanerAge,     setCleanerAge]     = useState('');
  const [cleanerAddress, setCleanerAddress] = useState('');
  // מנקה: כתובת = עיר + רחוב בלבד (ללא קומה/מספר דירה)
  const [maxDistance,    setMaxDistance]    = useState<number>(10);
  const [bringSupplies,  setBringSupplies]  = useState(true);

  type DayKey = 'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat';
  const DAY_KEYS: DayKey[] = ['sun','mon','tue','wed','thu','fri','sat'];
  const [availability, setAvailability] = useState<Record<DayKey, { active: boolean; start: number; end: number }>>(
    Object.fromEntries(DAY_KEYS.map(d => [d, { active: false, start: 8, end: 18 }])) as any
  );
  const toggleDay = (day: DayKey) =>
    setAvailability(prev => ({ ...prev, [day]: { ...prev[day], active: !prev[day].active } }));
  const setDayTime = (day: DayKey, field: 'start'|'end', val: number) =>
    setAvailability(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }));

  const pickCleanerPhoto = () => {
    Alert.alert(t.photoPickerTitle, t.photoPickerTitle, [
      {
        text: t.photoGallery,
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, t.photoGallery);
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false, quality: 0.15, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) {
            setPhotoB64(`data:image/jpeg;base64,${res.assets[0].base64}`);
          }
        },
      },
      {
        text: t.photoCamera,
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, t.photoCamera);
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: false, quality: 0.15, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) {
            setPhotoB64(`data:image/jpeg;base64,${res.assets[0].base64}`);
          }
        },
      },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  // Terms
  const [termsOk,    setTermsOk]    = useState(false);
  const [ageOk,      setAgeOk]      = useState(false);
  const [privacyOk,  setPrivacyOk]  = useState(false);
  const [showTerms,  setShowTerms]  = useState(false);

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, key: string) => {
    setArr(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key]);
  };

  // work-areas picker was removed — don't gate registration on it any more,
  // otherwise the button stays disabled forever with no reason shown.
  const canRegister = termsOk && ageOk && privacyOk && (role === 'client' || (types.length > 0 && payment.length > 0 && !!photoB64));

  // ── סימון אדום לשדות חסרים אחרי ניסיון הרשמה ──
  const fphone    = phone.replace(/[-\s]/g, '');
  const missName  = submitAttempted && !name.trim();
  const missEmail = submitAttempted && !email.trim();
  const missPass  = submitAttempted && password.length < 6;
  const missPhone = submitAttempted && !/^0\d{8,9}$/.test(fphone);
  const missTerms = submitAttempted && !termsOk;
  const missAge   = submitAttempted && !ageOk;
  const missPriv  = submitAttempted && !privacyOk;
  const missPhoto = submitAttempted && role === 'cleaner' && !photoB64;
  const missTypes = submitAttempted && role === 'cleaner' && types.length === 0;
  const missPay   = submitAttempted && role === 'cleaner' && payment.length === 0;

  const handleRegister = async () => {
    setSubmitAttempted(true);
    if (!name.trim() || !email.trim() || password.length < 6)
      return Alert.alert(t.error, t.regErrFillFields);
    if (!phone.trim() || !/^0\d{8,9}$/.test(phone.replace(/[-\s]/g, '')))
      return Alert.alert(t.error, t.regErrPhone);
    if (!termsOk)
      return Alert.alert(t.error, t.regErrTerms);
    if (!ageOk)
      return Alert.alert(t.error, t.regErrAge);
    if (!privacyOk)
      return Alert.alert(t.error, t.regErrPrivacy);
    if (role === 'client') {
      if (!city.trim() || city.trim().length < 5)
        return Alert.alert(t.error, t.regErrAddress ?? 'יש להזין כתובת מלאה');
      // גר בבניין דירות — חובה קומה ומספר דירה
      if (!isPrivateHouse) {
        if (!clientFloor.trim())
          return Alert.alert(t.error, t.fillFloorRequired ?? 'יש למלא קומה (או לסמן "בית פרטי")');
        if (!clientApt.trim())
          return Alert.alert(t.error, t.fillAptRequired ?? 'יש למלא מספר דירה (או לסמן "בית פרטי")');
      }
    }
    if (role === 'cleaner') {
      if (!photoB64)         return Alert.alert(t.error, t.photoRequiredMsg);
      if (!types.length)     return Alert.alert(t.error, t.regErrTypes);
      if (!payment.length)   return Alert.alert(t.error, t.regErrPayment);
    }
    setLoading(true);
    // ── שלב 1: יצירת חשבון Auth ──────────────────────────────────────────
    let cred: any;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      console.error('[REGISTER AUTH ERROR]', e.code, e.message);
      const msg =
        e.code === 'auth/email-already-in-use' ? `${t.regErrEmailInUse}\n\nנסה להתחבר עם המייל הזה במקום` :
        e.code === 'auth/invalid-email'         ? t.regErrInvalidEmail :
        e.code === 'auth/weak-password'         ? t.regErrWeakPassword :
        e.code === 'auth/network-request-failed' ? t.errNoInternet :
        e.code === 'auth/too-many-requests'      ? t.errTooMany :
        `שגיאת הרשמה (${e.code || e.message || 'unknown'})`;
      Alert.alert(t.error, msg);
      setLoading(false);
      return;
    }

    // ── שלב 2: שמירת פרופיל ב-Firestore ────────────────────────────────
    try {
      const data: any = {
        name: name.trim(),
        email: email.trim(),
        role,
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      if (role === 'client') {
        // כתובת מלאה — כולל קומה ומספר דירה אם גר בבניין
        const fullAddress = isPrivateHouse
          ? `${city.trim()} (בית פרטי)`
          : `${city.trim()}, קומה ${clientFloor.trim()}, דירה ${clientApt.trim()}`;
        data.address       = fullAddress;
        data.city          = city.trim();   // גם לאחור-תאימות
        data.isPrivateHouse = isPrivateHouse;
        if (!isPrivateHouse) { data.floor = clientFloor.trim(); data.apartment = clientApt.trim(); }
        data.preferredLang = prefLang;
        data.phone         = phone.replace(/[-\s]/g, '');
      }
      if (role === 'cleaner') {
        data.city          = city.trim();
        data.phone         = phone.trim();
        data.price         = Number(servicePricing['ניקיון רגיל']) || Number(price) || 0;
        data.bio           = bio.trim();
        data.types         = types;
        data.payment       = payment;
        data.available     = true;
        data.rating        = 0;
        data.reviews       = 0;
        data.preferredLang = prefLang;
        if (photoB64)       data.photoB64     = photoB64;
        if (citizenship)    data.citizenship  = citizenship.trim();
        data.isMobile       = isMobile;
        data.bringSupplies  = bringSupplies;
        if (cleanerAge)     data.age          = Number(cleanerAge) || 0;
        if (cleanerAddress) data.cleanerAddress = cleanerAddress.trim();
        data.maxDistance = maxDistance;
        // Convert servicePricing string values to numbers
        const spNum: Record<string, number> = {};
        Object.entries(servicePricing).forEach(([k, v]) => { if (v) spNum[k] = Number(v); });
        if (Object.keys(spNum).length > 0) data.servicePricing = spNum;
        // Availability — save only active days (same format as profile.tsx: numeric hours)
        const activeDays: Record<string, { active: boolean; start: number; end: number }> = {};
        DAY_KEYS.forEach(d => { if (availability[d].active) activeDays[d] = { active: true, start: availability[d].start, end: availability[d].end }; });
        if (Object.keys(activeDays).length > 0) data.availability = activeDays;
      }
await setDoc(doc(db, 'users', cred.user.uid), data);
      setLang(prefLang as Lang);

      // שמור כתובת לקוח בכתובות שמורות
      if (role === 'client' && city.trim().length >= 5) {
        try {
          const { setItemAsync } = await import('expo-secure-store');
          // פצל את הכתובת המלאה לרחוב ועיר לטעינה נכונה בטופס הזמנה
          const fullAddr = (data.address || city.trim());
          const lastComma = fullAddr.lastIndexOf(',');
          const addrStreetPart = lastComma > 0 ? fullAddr.slice(0, lastComma).trim() : fullAddr;
          const addrCityPart   = lastComma > 0 ? fullAddr.slice(lastComma + 1).trim() : '';
          const initialAddr = [{
            id: Date.now().toString(),
            address: fullAddr,
            street: addrStreetPart,
            city: addrCityPart,
            isPrimary: true,
            lastUsed: new Date().toISOString(),
          }];
          await setItemAsync('saved_addresses', JSON.stringify(initialAddr));
        } catch (_) {}
      }

      // צור קבוצת וואצאפ אוטומטית למנקה חדש
      if (role === 'cleaner' && phone.trim()) {
        try {
          const cleanerPhone = phone.trim().replace(/[-\s]/g, '');
          let normalized = cleanerPhone;
          if (normalized.startsWith('0')) normalized = '972' + normalized.slice(1);
          if (!normalized.startsWith('972')) normalized = '972' + normalized;

          const res = await fetch('https://api.ultramsg.com/instance172639/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token:        'e6v2dd4dayk5rhay',
              name:         `🧹 A&M Clean — ${name.trim()}`,
              participants: normalized,
            }),
          });
          const json = await res.json().catch(() => ({}));
          const groupId: string = json?.id || json?.gid || '';
          if (groupId) {
            await setDoc(doc(db, 'users', cred.user.uid), { whatsappGroupId: groupId }, { merge: true });
            console.log('[WA GROUP CREATED]', name.trim(), groupId);
          }
        } catch (_) {}
      }

      // ── מנקה: הצג הסבר חשוב ואז בקש הרשאות מיקום + התראות ──
      if (role === 'cleaner') {
        const requestCleanerPermissions = async () => {
          try {
            const Notifications = await import('expo-notifications');
            const notif = await Notifications.getPermissionsAsync();
            if (notif.status !== 'granted') await Notifications.requestPermissionsAsync();
          } catch (_) {}
          try {
            const Location = await import('expo-location');
            const loc = await Location.getForegroundPermissionsAsync();
            if (loc.status !== 'granted') await Location.requestForegroundPermissionsAsync();
          } catch (_) {}
        };
        Alert.alert(t.cleanerPermTitle, t.cleanerPermBody, [
          { text: t.cleanerPermBtn, onPress: () => { requestCleanerPermissions(); } },
        ]);
      }
    } catch (e: any) {
      console.error('[REGISTER FIRESTORE ERROR]', e.code, e.message);
      Alert.alert(t.error, `שגיאת שמירת פרופיל (${e.code || e.message || 'unknown'})\nהחשבון נוצר — נסה להתחבר ולפנות לתמיכה`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.wrap}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        <View style={s.hero}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={28} color={C.blue} />
          </TouchableOpacity>
          <RNImage
            source={require('../assets/images/logo-ui.png')}
            style={{ width: 280, height: 280, marginBottom: -40 }}
            resizeMode="contain"
          />
        </View>

        <ScrollView
          style={s.card}
          contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <T style={s.cardTitle}>{t.createAccountTitle}</T>

          {/* תפקיד */}
          <View style={s.roleRow}>
            <TouchableOpacity style={[s.roleBtn, role === 'client' && s.roleBtnActive]} onPress={() => setRole('client')}>
              <T style={s.roleIcon}>👤</T>
              <T style={[s.roleLabel, role === 'client' && s.roleLabelActive]}>{t.clientLabel}</T>
              <T style={[s.roleDesc, role === 'client' && { color: C.blue }]}>{t.lookingForCleaner}</T>
            </TouchableOpacity>
            <TouchableOpacity style={[s.roleBtn, role === 'cleaner' && s.roleBtnActive]} onPress={() => setRole('cleaner')}>
              <T style={s.roleIcon}>✨</T>
              <T style={[s.roleLabel, role === 'cleaner' && s.roleLabelActive]}>{t.cleanerLabel}</T>
              <T style={[s.roleDesc, role === 'cleaner' && { color: C.blue }]}>{t.offeringService}</T>
            </TouchableOpacity>
          </View>

          {/* שדות בסיס */}
          <View style={s.field}>
            <T style={s.label}>{t.fullNameLabel}</T>
            <TextInput style={[s.input, missName && s.inputError]} placeholder={t.namePlaceholder} value={name} onChangeText={setName} placeholderTextColor={C.sub} textAlign="center" />
          </View>
          <View style={s.field}>
            <T style={s.label}>{t.emailLabel}</T>
            <TextInput style={[s.input, missEmail && s.inputError]} placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.sub} textAlign="center" />
          </View>
          <View style={s.field}>
            <T style={s.label}>{t.passwordLabel}</T>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput style={[s.input, missPass && s.inputError, { paddingLeft: 44 }]} placeholder={t.passwordHint} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholderTextColor={C.sub} textAlign="center" />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ position: 'absolute', left: 10, padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}>
                <Text style={{ fontSize: 20 }}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.field}>
            <T style={s.label}>📱 {t.phoneLabel} *</T>
            <TextInput
              style={[s.input, missPhone && s.inputError]}
              placeholder="0501234567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor={C.sub}
              textAlign="center"
              maxLength={10}
            />
          </View>

          {/* שדות לקוח */}
          {role === 'client' && (
            <>
              <View style={s.freePromoCard}>
                <T style={s.freePromoText}>{t.freeClientPromo}</T>
              </View>
            <View style={s.clientBlock}>
              <View style={s.field}>
                <T style={s.label}>{t.clientAddressLabel}</T>
                <TextInput
                  style={s.input} placeholder={t.addressPlaceholder}
                  value={city} onChangeText={handleCityChange}
                  placeholderTextColor={C.sub} textAlign="center"
                />
                {addrSuggestions.length > 0 && (
                  <View style={s.addrDropdown}>
                    {addrSuggestions.map((sug, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[s.addrSugRow, i < addrSuggestions.length - 1 && s.addrSugBorder]}
                        onPress={() => { setCity(sug); setAddrSuggestions([]); }}
                      >
                        <Text style={s.addrSugText}>📍 {sug}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {/* הערת פרטיות — הכתובת נשמרת מוסתרת עד הזמנת מנקה ספציפי */}
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#BFDBFE' }}>
                  <Text style={{ fontSize: 14 }}>🔒</Text>
                  <Text style={{ flex: 1, fontSize: 11.5, color: '#1E40AF', textAlign: 'right', lineHeight: 16 }}>
                    {(t as any).addressPrivateNote ?? 'הפרטיות שלך חשובה לנו: הכתובת המדויקת שלך נשמרת מוסתרת ולא מוצגת לאף מנקה. היא נחשפת רק למנקה שתבחר/י להזמין — ורק לצורך אותו ניקיון.'}
                  </Text>
                </View>
              </View>

              {/* סוג מגורים — בית פרטי או בניין דירות */}
              <View style={[s.pillRow, { justifyContent: 'center', marginBottom: 4 }]}>
                <TogglePill label={`🏠 ${t.privateHouseLabel ?? 'בית פרטי'}`}   active={isPrivateHouse}  onPress={() => setIsPrivateHouse(true)}  devanagari={false} />
                <TogglePill label={`🏢 ${t.aptBuildingLabel ?? 'בניין דירות'}`} active={!isPrivateHouse} onPress={() => setIsPrivateHouse(false)} devanagari={false} />
              </View>

              {/* בבניין דירות — קומה ומספר דירה (חובה) */}
              {!isPrivateHouse && (
                <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                  <View style={[s.field, { flex: 1 }]}>
                    <T style={s.label}>{t.floorLabel ?? 'קומה'}</T>
                    <TextInput
                      style={[s.input, (submitAttempted && !clientFloor.trim()) && s.inputError]}
                      placeholder={t.floorLabel ?? 'קומה'} value={clientFloor} onChangeText={setClientFloor}
                      keyboardType="number-pad" placeholderTextColor={C.sub} textAlign="center"
                    />
                  </View>
                  <View style={[s.field, { flex: 1 }]}>
                    <T style={s.label}>{t.aptLabel ?? 'מספר דירה'}</T>
                    <TextInput
                      style={[s.input, (submitAttempted && !clientApt.trim()) && s.inputError]}
                      placeholder={t.aptLabel ?? 'מספר דירה'} value={clientApt} onChangeText={setClientApt}
                      keyboardType="number-pad" placeholderTextColor={C.sub} textAlign="center"
                    />
                  </View>
                </View>
              )}

              <SectionTitle>{t.prefLangSection}</SectionTitle>
              <View style={[s.pillRow, { justifyContent: 'center' }]}>
                {LANG_OPTS.map(l => (
                  <TogglePill
                    key={l.key}
                    label={`${l.flag} ${l.label}`}
                    active={prefLang === l.key}
                    onPress={() => { setPrefLang(l.key); setLang(l.key as Lang); }}
                    devanagari={false}
                  />
                ))}
              </View>
            </View>
            </>
          )}

          {/* שדות מנקה */}
          {role === 'cleaner' && (
            <>
              {/* Free promo card for cleaner */}
              <View style={s.freePromoCard}>
                <T style={s.freePromoText}>{t.freeCleanerPromo}</T>
              </View>

              <View style={s.cleanerBlock}>

                {/* תמונת פרופיל — חובה */}
                <View style={s.photoPickerWrap}>
                  <TouchableOpacity style={s.photoPickerBtn} onPress={pickCleanerPhoto}>
                    {photoB64 ? (
                      <Image source={{ uri: photoB64 }} style={s.photoPickerImg} contentFit="cover" />
                    ) : (
                      <View style={[s.photoPickerPlaceholder, missPhoto && { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }]}>
                        <T style={{ fontSize: 36 }}>📷</T>
                      </View>
                    )}
                    <View style={s.photoPickerBadge}>
                      <T style={{ fontSize: 14 }}>✏️</T>
                    </View>
                  </TouchableOpacity>
                  <T style={[s.photoPickerLabel, missPhoto && { color: '#EF4444' }]}>
                    {photoB64 ? t.photoAdded : t.photoRequiredMsg}
                  </T>
                </View>

                <View style={s.field}>
                  <T style={s.label}>{t.citizenshipLabel}</T>
                  <TextInput style={s.input} placeholder={t.citizenshipPlaceholder} value={citizenship} onChangeText={setCitizenship} placeholderTextColor={C.sub} textAlign="center" />
                </View>

                <View style={s.field}>
                  <T style={s.label}>{t.ageLabel}</T>
                  <TextInput style={s.input} placeholder={t.agePlaceholder} value={cleanerAge} onChangeText={setCleanerAge} keyboardType="numeric" placeholderTextColor={C.sub} textAlign="center" />
                </View>

                <View style={s.field}>
                  <T style={s.label}>{t.mobileLabel}</T>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[s.pill, isMobile && s.pillActive, { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }]}
                      onPress={() => setIsMobile(true)}>
                      <T style={[s.pillText, isMobile && s.pillTextActive, { textAlign: 'center' }]}>{t.mobileYes}</T>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.pill, !isMobile && s.pillActive, { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }]}
                      onPress={() => setIsMobile(false)}>
                      <T style={[s.pillText, !isMobile && s.pillTextActive, { textAlign: 'center' }]}>{t.mobileNo}</T>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.field}>
                  <T style={s.label}>{t.cleanerAddressLabel}</T>
                  {/* מנקה — רק עיר ורחוב, ללא קומה/מספר דירה */}
                  <TextInput style={s.input} placeholder={t.cleanerAddressPlaceholder} value={cleanerAddress} onChangeText={setCleanerAddress} placeholderTextColor={C.sub} textAlign="center" />
                </View>

                {/* מרחק הגעה מקסימלי */}
                <View style={s.field}>
                  <T style={s.label}>{t.maxDistanceLabel}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, justifyContent: 'center' }}>
                    {[5, 10, 20, 30, 50, 999].map(km => (
                      <TouchableOpacity
                        key={km}
                        style={[s.pill, maxDistance === km && s.pillActive, { paddingVertical: 10, paddingHorizontal: 14 }]}
                        onPress={() => setMaxDistance(km)}
                      >
                        <T style={[s.pillText, maxDistance === km && s.pillTextActive]}>
                          {km === 999 ? t.noLimit : `${km} ${t.kmUnit}`}
                        </T>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>



                <View style={s.field}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <T style={[s.label, { marginBottom: 0, color: bio.trim().split(/\s+/).filter(Boolean).length > 30 ? C.error : C.text }]}>
                      {bio.trim().split(/\s+/).filter(Boolean).length}/30 {t.bioWordCount}
                    </T>
                    <T style={s.label}>{t.bioLabel}</T>
                  </View>
                  <TextInput
                    style={[s.input, { height: 90, textAlignVertical: 'top' }, bio.trim().split(/\s+/).filter(Boolean).length > 30 && { borderColor: C.error }]}
                    placeholder={`${t.bioPlaceholder} (${t.bioWordLimitHint})`}
                    value={bio}
                    onChangeText={v => {
                      const words = v.trim().split(/\s+/).filter(Boolean);
                      if (words.length < 30) {
                        setBio(v);
                      } else if (words.length === 30) {
                        // מגיעים ל-30 מילים — חוסמים רווח נוסף שיאפשר מילה 31
                        setBio(words.join(' '));
                      } else {
                        setBio(words.slice(0, 30).join(' '));
                      }
                    }}
                    multiline placeholderTextColor={C.sub} textAlign="center"
                  />
                  <T style={{ fontSize: 11, color: C.sub, textAlign: 'right', marginTop: 4 }}>{t.bioWordLimitHint}</T>
                </View>

                <View style={s.field}>
                  <T style={s.label}>{t.suppliesLabel}</T>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[s.pill, bringSupplies && s.pillActive, { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }]}
                      onPress={() => setBringSupplies(true)}>
                      <T style={[s.pillText, bringSupplies && s.pillTextActive, { textAlign: 'center' }]}>{t.suppliesCleaner}</T>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.pill, !bringSupplies && s.pillActive, { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }]}
                      onPress={() => setBringSupplies(false)}>
                      <T style={[s.pillText, !bringSupplies && s.pillTextActive, { textAlign: 'center' }]}>{t.suppliesClient}</T>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* סוגי שירות + מחיר לשעה */}
                <SectionTitle error={missTypes}>{t.servicePricingLabel}</SectionTitle>
                <View style={{ gap: 8, marginBottom: 14 }}>
                  {SERVICE_TYPES.map(svc => {
                    const active = types.includes(svc.key);
                    return (
                      <View key={svc.key} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                        {/* כפתור בחירת שירות */}
                        <TouchableOpacity
                          style={[s.pill, active && s.pillActive, { flex: 1, alignItems: 'flex-end', paddingVertical: 12 }]}
                          onPress={() => toggleItem(types, setTypes, svc.key)}
                        >
                          <T style={[s.pillText, active && s.pillTextActive, { textAlign: 'right', fontSize: 13 }]}>{svc.icon} {t.types[svc.key] || svc.key}</T>
                        </TouchableOpacity>
                        {/* שדה מחיר */}
                        <TextInput
                          style={[s.input, { width: 72, marginBottom: 0, textAlign: 'center', opacity: active ? 1 : 0.45 }]}
                          value={servicePricing[svc.key] || ''}
                          onChangeText={v => {
                            setServicePricing(prev => ({ ...prev, [svc.key]: v }));
                            if (svc.key === 'ניקיון רגיל') setPrice(v);
                            if (v && !active) toggleItem(types, setTypes, svc.key);
                          }}
                          placeholder={svc.key === 'ניקיון רגיל' ? '70' : svc.key === 'ניקוי לפסח' ? '100' : '₪'}
                          keyboardType="numeric"
                          placeholderTextColor={C.sub}
                          editable={active}
                        />
                        <ServiceInfoBtn serviceKey={svc.key} />
                      </View>
                    );
                  })}
                </View>

                <SectionTitle error={missPay}>{t.paymentSection}</SectionTitle>
                <View style={[s.pillRow, { justifyContent: 'center' }]}>
                  {PAYMENT_OPTS.map(p => (
                    <TogglePill key={p.key}
                      label={`${p.icon} ${p.key === 'cash' ? t.payCash : p.key === 'bit' ? t.payBit : p.key === 'paybox' ? t.payPaybox : t.payBank}`}
                      active={payment.includes(p.key)} onPress={() => toggleItem(payment, setPayment, p.key)} />
                  ))}
                </View>
                <T style={{ fontSize: 14, color: '#EF4444', fontWeight: '800', textAlign: 'center', marginTop: -2, marginBottom: 16, lineHeight: 19 }}>{t.paymentDirectNote}</T>

                {/* ─── ימי ושעות עבודה ─── */}
                <SectionTitle>{`🕐 ${t.availTitle}`}</SectionTitle>
                <View style={{ backgroundColor: C.blueLight, borderRadius: 14, borderWidth: 1, borderColor: C.blueBorder, overflow: 'hidden', marginBottom: 14 }}>
                  {DAY_KEYS.map((day, idx) => {
                    const dayLabel = t[`avail${day.charAt(0).toUpperCase() + day.slice(1)}` as keyof typeof t] as string;
                    const info = availability[day];
                    return (
                      <View key={day} style={[s.availRow, idx === DAY_KEYS.length - 1 && { borderBottomWidth: 0 }]}>
                        {/* כפתור יום */}
                        <TouchableOpacity
                          style={[s.availDayBtn, info.active && s.availDayBtnActive]}
                          onPress={() => toggleDay(day)}
                        >
                          <T style={[s.availDayText, info.active && s.availDayTextActive]}>{dayLabel}</T>
                        </TouchableOpacity>

                        {/* שעות — מוצג רק אם היום פעיל */}
                        {info.active ? (
                          <View style={s.availTimePickers}>
                            <View style={s.availTimeGroup}>
                              <T style={s.availTimeLabel}>{t.availFromShort}</T>
                              <TextInput
                                style={s.availTimeInput}
                                value={String(info.start)}
                                onChangeText={v => {
                                  const n = parseInt(v) || 0;
                                  if (n >= 0 && n <= 23) setDayTime(day, 'start', n);
                                }}
                                keyboardType="numeric"
                                maxLength={2}
                                selectTextOnFocus
                              />
                            </View>
                            <T style={{ fontSize: 14, color: C.textSub, marginHorizontal: 2 }}>{t.availUntilShort}</T>
                            <View style={s.availTimeGroup}>
                              <TextInput
                                style={s.availTimeInput}
                                value={String(info.end)}
                                onChangeText={v => {
                                  const n = parseInt(v) || 0;
                                  if (n >= 0 && n <= 23) setDayTime(day, 'end', n);
                                }}
                                keyboardType="numeric"
                                maxLength={2}
                                selectTextOnFocus
                              />
                            </View>
                          </View>
                        ) : (
                          <T style={{ flex: 1, fontSize: 12, color: C.textSub, paddingLeft: 10 }}>{t.availOff}</T>
                        )}
                      </View>
                    );
                  })}
                </View>

                <SectionTitle>{t.prefLangSection}</SectionTitle>
                <View style={[s.pillRow, { justifyContent: 'center' }]}>
                  {LANG_OPTS.map(l => (
                    <TogglePill
                      key={l.key}
                      label={`${l.flag} ${l.label}`}
                      active={prefLang === l.key}
                      onPress={() => { setPrefLang(l.key); setLang(l.key as Lang); }}
                      devanagari={false}
                    />
                  ))}
                </View>

              </View>
            </>
          )}

          {/* תקנון */}
          <View style={s.termsBox}>
            <Checkbox
              checked={termsOk} onPress={() => setTermsOk(v => !v)}
              label={t.termsAgreeText} linkLabel={t.termsLinkLabel}
              onLinkPress={() => setShowTerms(true)}
              error={missTerms}
            />
            <Checkbox
              checked={ageOk} onPress={() => setAgeOk(v => !v)}
              label={role === 'cleaner' ? t.ageCheckCleaner : t.ageCheck18}
              error={missAge}
            />
            <Checkbox
              checked={privacyOk} onPress={() => setPrivacyOk(v => !v)}
              label={t.privacyConsent}
              error={missPriv}
            />
          </View>

          <TouchableOpacity
            style={[s.btn, (!canRegister || loading) && s.btnDisabled]}
            onPress={handleRegister} disabled={loading}
          >
            <T style={s.btnText}>{loading ? t.registering : t.registerBtn}</T>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => router.back()}>
            <T style={{ color: C.sub, fontSize: 14 }}>{t.alreadyAccount}</T>
          </TouchableOpacity>
        </ScrollView>

      </KeyboardAvoidingView>
      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} closeLabel={t.closeBtn} title={t.termsLinkLabel} terms={TERMS_BY_LANG[lang] ?? TERMS_BY_LANG.he} />
      <View style={{ height: NAV_BAR_HEIGHT }} />
    </SafeAreaView>
  );
}



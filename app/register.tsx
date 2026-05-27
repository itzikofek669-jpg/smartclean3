import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform, Dimensions,
  Alert, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NAV_BAR_HEIGHT = Platform.OS === 'android'
  ? Math.max(0, Dimensions.get('screen').height - Dimensions.get('window').height - (StatusBar.currentHeight || 0))
  : 0;
import { Image } from 'expo-image';
import { Image as RNImage } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useLanguage, T, useAppColors, AppColors } from '../lib/LanguageContext';
import { Lang } from '../lib/translations';
import ServiceInfoBtn from '../lib/ServiceInfoBtn';

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
    wrap:            { flex: 1, backgroundColor: c.blueDark },
    hero:            { alignItems: 'center', paddingTop: 40, paddingBottom: 30, position: 'relative' },
    backBtn:         { position: 'absolute', top: 44, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    logo:            { fontSize: 44, marginBottom: 8 },
    title:           { fontSize: 22, fontWeight: '800', color: c.white },
    card:            { backgroundColor: c.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1 },
    cardTitle:       { fontSize: 22, fontWeight: '800', color: c.textDark, marginBottom: 20, textAlign: 'center' },
    label:           { fontSize: 13, fontWeight: '700', color: c.textDark, marginBottom: 8, textAlign: 'right' },
    field:           { marginBottom: 14 },
    input:           { backgroundColor: c.blueLight, borderRadius: 12, padding: 14, fontSize: 15, color: c.textDark, borderWidth: 1, borderColor: c.blueBorder },
    roleRow:         { flexDirection: 'row', gap: 12, marginBottom: 20 },
    roleBtn:         { flex: 1, backgroundColor: c.blueLight, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: c.blueBorder },
    roleBtnActive:   { borderColor: c.blue, backgroundColor: '#EBF4FF' },
    roleIcon:        { fontSize: 28, marginBottom: 6 },
    roleLabel:       { fontSize: 16, fontWeight: '800', color: c.textDark, marginBottom: 2 },
    roleLabelActive: { color: c.blue },
    roleDesc:        { fontSize: 11, color: c.textSub },
    clientBlock:     { backgroundColor: c.blueLight, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.blueBorder },
    freePromoCard:   { backgroundColor: '#D1FAE5', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: '#6EE7B7', alignItems: 'center' },
    freePromoText:   { fontSize: 13, fontWeight: '800', color: '#065F46', textAlign: 'center', lineHeight: 20 },
    cleanerBlock:    { backgroundColor: c.blueLight, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.blueBorder },
    sectionTitle:    { fontSize: 13, fontWeight: '800', color: c.textDark, marginBottom: 10, marginTop: 4, textAlign: 'right' },
    pillRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    availRow:        { marginBottom: 10 },
    availDayBtn:     { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: c.white, borderWidth: 1.5, borderColor: c.blueBorder, alignSelf: 'flex-start', marginBottom: 6 },
    availDayBtnActive: { backgroundColor: c.blue, borderColor: c.blue },
    availDayText:    { fontSize: 13, fontWeight: '700', color: c.textDark },
    availDayTextActive: { color: c.white },
    availTimePickers: { paddingLeft: 8, gap: 6 },
    availTimeGroup:  { marginBottom: 4 },
    availTimeLabel:  { fontSize: 11, fontWeight: '700', color: c.textSub, marginBottom: 4, textAlign: 'right' },
    availTimeScroll: { flexDirection: 'row' },
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
  });
}

const SERVICE_TYPES = [
  { key: 'ניקוי כללי',              icon: '🏠' },
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
  { key: 'paybox', label: 'PayBox',            icon: '💜' },
  { key: 'bank',   label: 'העברה בנקאית',   icon: '🏦' },
];

const AREA_OPTS = [
  { key: 'north',  label: '🌿 צפון'  },
  { key: 'center', label: '🏙️ מרכז' },
  { key: 'south',  label: '☀️ דרום'  },
];

const LANG_OPTS = [
  { key: 'he', label: 'עברית',    flag: '🇮🇱' },
  { key: 'en', label: 'English',  flag: '🇬🇧' },
  { key: 'ru', label: 'Русский',  flag: '🇷🇺' },
  { key: 'ar', label: 'العربية',  flag: '🇸🇦' },
  { key: 'fr', label: 'Français', flag: '🇫🇷' },
  { key: 'hi', label: 'हिन्दी',  flag: '🇮🇳' },
];

const TERMS = `תקנון והסרת אחריות – שימוש באפליקציה

1. כללי
האפליקציה מהווה פלטפורמה טכנולוגית בלבד המחברת בין משתמשים שונים לצורך ביצוע עסקאות, שירותים ו/או התקשרויות ביניהם. האפליקציה אינה צד לכל הסכם, התקשרות או פעילות בין המשתמשים.

2. היעדר אחריות כללית
השימוש באפליקציה נעשה באחריותם הבלעדית של המשתמשים. האפליקציה, בעליה, מנהליה ו/או מי מטעמה לא יישאו בכל אחריות, ישירה או עקיפה, לכל נזק, הפסד או פגיעה מכל סוג שהוא, לרבות אך לא רק:

• פגיעה גופנית, תאונה, נפילה או כל נזק פיזי אחר
• גניבה, אובדן או נזק לרכוש
• נזקים לצדדים שלישיים (צד ג')
• אי עמידה בהתחייבויות בין משתמשים
• אי קבלת תשלום או עיכוב בתשלום
• כל נזק עקיף, תוצאתי או מיוחד

3. אחריות המשתמשים
כל התקשרות, הסכמה, תשלום, אספקת שירות או מוצר נעשים ישירות בין המשתמשים בלבד. המשתמשים נושאים באחריות המלאה והבלעדית לכל פעולה, התחייבות או תוצאה הנובעת מהשימוש באפליקציה.

4. תשלומים ומיסוי
האפליקציה אינה אחראית ואינה מעורבת בניהול תשלומים בין משתמשים, אלא אם צוין אחרת במפורש.
כל משתמש אחראי באופן בלעדי ל:

• דיווח והעברת מס הכנסה בהתאם לדין
• תשלום והפרשה לביטוח לאומי
• עמידה בכל דרישות החוק, הרגולציה והמיסוי החלות עליו

האפליקציה לא תישא בכל אחריות להפרות או אי עמידה בהוראות אלו.

5. היעדר יחסי עבודה
השימוש באפליקציה אינו יוצר יחסי עובד-מעביד, שותפות, שליחות או כל מערכת יחסים משפטית אחרת בין האפליקציה לבין המשתמשים, או בין המשתמשים לבין עצמם, מעבר למה שהוסכם ביניהם במפורש.

6. ויתור ושיפוי
המשתמשים מוותרים בזאת באופן בלתי חוזר על כל טענה, דרישה או תביעה כלפי האפליקציה, בעליה או מי מטעמה.
בנוסף, המשתמשים מתחייבים לשפות את האפליקציה בגין כל נזק, הפסד, הוצאה או תביעה שתיגרם לה עקב שימושם באפליקציה או הפרת התקנון.

7. שימוש על אחריות המשתמש
המשתמשים מצהירים כי הם מודעים לכך שהאפליקציה משמשת כפלטפורמה בלבד, וכי כל סיכון הנובע מהשימוש בה מוטל עליהם בלבד.

8. תחולת הדין
על תקנון זה יחולו דיני מדינת ישראל בלבד, וכל מחלוקת תתברר בבתי המשפט המוסמכים לכך.

אישור התקנון
עצם השימוש באפליקציה מהווה אישור והסכמה מלאה לכל תנאי תקנון זה.`;

function TermsModal({ visible, onClose, closeLabel, title }: { visible: boolean; onClose: () => void; closeLabel: string; title: string }) {
  const C = useAppColors();
  const tm = createTM(C);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
        <View style={tm.header}>
          <T style={tm.title}>{title}</T>
          <TouchableOpacity onPress={onClose} style={tm.closeBtn}>
            <T style={{ color: C.white, fontSize: 18 }}>✕</T>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <T style={tm.body}>{TERMS}</T>
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

function Checkbox({ checked, onPress, label, linkLabel, onLinkPress }: {
  checked: boolean; onPress: () => void;
  label: string; linkLabel?: string; onLinkPress?: () => void;
}) {
  const C = useAppColors();
  const s = createS(C);
  return (
    <TouchableOpacity style={s.checkRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.checkBox, checked && s.checkBoxOn]}>
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

function SectionTitle({ children }: { children: string }) {
  const C = useAppColors();
  const s = createS(C);
  return <T style={s.sectionTitle}>{children}</T>;
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

export default function RegisterScreen() {
  const router = useRouter();
  const { lang, t, setLang } = useLanguage();
  const C = useAppColors();
  const s = createS(C);

  // Base fields
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<'client' | 'cleaner'>('client');
  const [loading,  setLoading]  = useState(false);

  // Client-specific fields
  const [city,      setCity]      = useState('');
  const [prefLang,  setPrefLang]  = useState<string>(lang);

  // Cleaner-specific fields
  const [phone,          setPhone]          = useState('');
  const [price,          setPrice]          = useState('');
  const [bio,            setBio]            = useState('');
  const [types,          setTypes]          = useState<string[]>([]);
  const [payment,        setPayment]        = useState<string[]>([]);
  const [workAreas,      setWorkAreas]      = useState<string[]>([]);
  const [servicePricing, setServicePricing] = useState<Record<string, string>>({});
  const [photoB64,       setPhotoB64]       = useState<string | null>(null);
  const [photoLoading,   setPhotoLoading]   = useState(false);
  const [citizenship,    setCitizenship]    = useState('');
  const [isMobile,       setIsMobile]       = useState(true);
  const [experience,     setExperience]     = useState('');
  const [cleanerAge,     setCleanerAge]     = useState('');
  const [cleanerAddress, setCleanerAddress] = useState('');
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
  const TIME_OPTS = Array.from({ length: 17 }, (_, i) => i + 6); // 6..22

  const pickCleanerPhoto = () => {
    Alert.alert(t.photoPickerTitle, t.photoPickerTitle, [
      {
        text: t.photoGallery,
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, t.photoGallery);
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.15, base64: true,
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
            allowsEditing: true, aspect: [1, 1], quality: 0.15, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) {
            setPhotoB64(`data:image/jpeg;base64,${res.assets[0].base64}`);
          }
        },
      },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  // Referral
  const [referralCode, setReferralCode] = useState('');

  // Terms
  const [termsOk,    setTermsOk]    = useState(false);
  const [ageOk,      setAgeOk]      = useState(false);
  const [privacyOk,  setPrivacyOk]  = useState(false);
  const [showTerms,  setShowTerms]  = useState(false);

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, key: string) => {
    setArr(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key]);
  };

  const canRegister = termsOk && ageOk && privacyOk && (role === 'client' || (types.length > 0 && payment.length > 0 && workAreas.length > 0 && !!photoB64));

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || password.length < 6)
      return Alert.alert(t.error, t.regErrFillFields);
    if (!phone.trim() || !/^0\d{8,9}$/.test(phone.replace(/[-\s]/g, '')))
      return Alert.alert(t.error, 'יש להזין מספר טלפון נייד תקין (לדוגמה: 0501234567)');
    if (!termsOk)
      return Alert.alert(t.error, t.regErrTerms);
    if (!ageOk)
      return Alert.alert(t.error, t.regErrAge);
    if (!privacyOk)
      return Alert.alert(t.error, t.regErrPrivacy);
    if (role === 'cleaner') {
      if (!photoB64)         return Alert.alert(t.error, t.photoRequiredMsg);
      if (!types.length)     return Alert.alert(t.error, t.regErrTypes);
      if (!payment.length)   return Alert.alert(t.error, t.regErrPayment);
      if (!workAreas.length) return Alert.alert(t.error, t.regErrAreas);
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const data: any = {
        name: name.trim(),
        email: email.trim(),
        role,
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      if (role === 'client') {
        data.city          = city.trim();
        data.preferredLang = prefLang;
        data.phone         = phone.replace(/[-\s]/g, '');
      }
      if (role === 'cleaner') {
        data.city          = city.trim();
        data.phone         = phone.trim();
        data.price         = Number(price) || 0;
        data.bio           = bio.trim();
        data.types         = types;
        data.payment       = payment;
        data.workAreas     = workAreas;
        data.available     = true;
        data.rating        = 0;
        data.reviews       = 0;
        data.preferredLang = prefLang;
        if (photoB64)       data.photoB64     = photoB64;
        if (citizenship)    data.citizenship  = citizenship.trim();
        data.isMobile       = isMobile;
        data.bringSupplies  = bringSupplies;
        if (experience)     data.experience   = Number(experience) || 0;
        if (cleanerAge)     data.age          = Number(cleanerAge) || 0;
        if (cleanerAddress) data.cleanerAddress = cleanerAddress.trim();
        // Convert servicePricing string values to numbers
        const spNum: Record<string, number> = {};
        Object.entries(servicePricing).forEach(([k, v]) => { if (v) spNum[k] = Number(v); });
        if (Object.keys(spNum).length > 0) data.servicePricing = spNum;
        // Availability — save only active days (same format as profile.tsx: numeric hours)
        const activeDays: Record<string, { active: boolean; start: number; end: number }> = {};
        DAY_KEYS.forEach(d => { if (availability[d].active) activeDays[d] = { active: true, start: availability[d].start, end: availability[d].end }; });
        if (Object.keys(activeDays).length > 0) data.availability = activeDays;
      }
      if (referralCode.trim()) data.referredBy = referralCode.trim().toUpperCase();
      await setDoc(doc(db, 'users', cred.user.uid), data);
      setLang(prefLang as Lang);

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
    } catch (e: any) {
      const msg =
        e.code === 'auth/email-already-in-use' ? t.regErrEmailInUse :
        e.code === 'auth/invalid-email'         ? t.regErrInvalidEmail :
        e.code === 'auth/weak-password'         ? t.regErrWeakPassword :
        t.regErrDefault;
      Alert.alert(t.error, msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.wrap}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>

        <View style={s.hero}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <T style={{ color: C.white, fontSize: 20 }}>←</T>
          </TouchableOpacity>
          <RNImage
            source={require('../assets/images/icon.png')}
            style={{ width: 70, height: 70, marginBottom: 2 }}
            resizeMode="contain"
          />
          <T style={s.title}>{t.joinTitle}</T>
        </View>

        <ScrollView style={s.card} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <T style={s.cardTitle}>{t.createAccountTitle}</T>

          {/* תפקיד */}
          <T style={s.label}>{t.iAmLabel}</T>
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
            <TextInput style={s.input} placeholder={t.namePlaceholder} value={name} onChangeText={setName} placeholderTextColor={C.sub} textAlign="right" />
          </View>
          <View style={s.field}>
            <T style={s.label}>{t.emailLabel}</T>
            <TextInput style={s.input} placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.sub} textAlign="right" />
          </View>
          <View style={s.field}>
            <T style={s.label}>{t.passwordLabel}</T>
            <TextInput style={s.input} placeholder={t.passwordHint} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={C.sub} textAlign="right" />
          </View>
          <View style={s.field}>
            <T style={s.label}>📱 {t.phoneLabel} *</T>
            <TextInput
              style={s.input}
              placeholder="0501234567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor={C.sub}
              textAlign="right"
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
                <T style={s.label}>🏙️ {t.cityLabel}</T>
                <TextInput
                  style={s.input} placeholder="תל אביב, חיפה, באר שבע..."
                  value={city} onChangeText={setCity}
                  placeholderTextColor={C.sub} textAlign="right"
                />
              </View>
              <SectionTitle>{t.prefLangSection}</SectionTitle>
              <View style={s.pillRow}>
                {LANG_OPTS.map(l => (
                  <TogglePill
                    key={l.key}
                    label={`${l.flag} ${l.label}`}
                    active={prefLang === l.key}
                    onPress={() => setPrefLang(l.key)}
                    devanagari={l.key === 'hi'}
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
                      <View style={s.photoPickerPlaceholder}>
                        <T style={{ fontSize: 36 }}>📷</T>
                      </View>
                    )}
                    <View style={s.photoPickerBadge}>
                      <T style={{ fontSize: 14 }}>✏️</T>
                    </View>
                  </TouchableOpacity>
                  <T style={s.photoPickerLabel}>
                    {photoB64 ? t.photoAdded : t.photoRequiredMsg}
                  </T>
                </View>

                <View style={s.field}>
                  <T style={s.label}>🏙️ {t.cityLabel}</T>
                  <TextInput style={s.input} placeholder="תל אביב, חיפה..." value={city} onChangeText={setCity} placeholderTextColor={C.sub} textAlign="right" />
                </View>


                <View style={s.field}>
                  <T style={s.label}>{t.citizenshipLabel}</T>
                  <TextInput style={s.input} placeholder={t.citizenshipPlaceholder} value={citizenship} onChangeText={setCitizenship} placeholderTextColor={C.sub} textAlign="right" />
                </View>

                <View style={s.field}>
                  <T style={s.label}>{t.ageLabel}</T>
                  <TextInput style={s.input} placeholder={t.agePlaceholder} value={cleanerAge} onChangeText={setCleanerAge} keyboardType="numeric" placeholderTextColor={C.sub} textAlign="right" />
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
                  <TextInput style={s.input} placeholder={t.cleanerAddressPlaceholder} value={cleanerAddress} onChangeText={setCleanerAddress} placeholderTextColor={C.sub} textAlign="right" />
                </View>

                <View style={s.field}>
                  <T style={s.label}>{t.basePriceLabel}</T>
                  <TextInput style={s.input} placeholder={t.basePricePlaceholder} value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor={C.sub} textAlign="right" />
                </View>

                {/* Per-service pricing (optional) */}
                <SectionTitle>{t.servicePricingTitle}</SectionTitle>
                <T style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>{t.servicePricingNote}</T>
                {[
                  { key: 'ניקוי לפסח',         icon: '🧹' },
                  { key: 'שטיפת רכב',            icon: '🚗' },
                  { key: 'חלונות',               icon: '🪟' },
                  { key: 'לאחר שיפוץ',           icon: '🔨' },
                  { key: 'ניקיון אחרי אירוע',    icon: '🎉' },
                ].map(svc => (
                  <View key={svc.key} style={[s.field, { marginBottom: 8 }]}>
                    <T style={[s.label, { fontSize: 12 }]}>{svc.icon} {t.types[svc.key] || svc.key} — ₪{t.perHour}</T>
                    <TextInput
                      style={s.input}
                      placeholder={price || t.basePriceDefault}
                      value={servicePricing[svc.key] || ''}
                      onChangeText={v => setServicePricing(prev => ({ ...prev, [svc.key]: v }))}
                      keyboardType="numeric"
                      placeholderTextColor={C.sub}
                      textAlign="right"
                    />
                  </View>
                ))}

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
                    multiline placeholderTextColor={C.sub} textAlign="right"
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

                <SectionTitle>{t.serviceTypesSection}</SectionTitle>
                <View style={s.pillRow}>
                  {SERVICE_TYPES.map(svc => (
                    <View key={svc.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TogglePill label={`${svc.icon} ${t.types[svc.key] || svc.key}`} active={types.includes(svc.key)} onPress={() => toggleItem(types, setTypes, svc.key)} />
                      <ServiceInfoBtn serviceKey={svc.key} />
                    </View>
                  ))}
                </View>

                <SectionTitle>{t.paymentSection}</SectionTitle>
                <View style={s.pillRow}>
                  {PAYMENT_OPTS.map(p => (
                    <TogglePill key={p.key}
                      label={`${p.icon} ${p.key === 'cash' ? t.payCash : p.key === 'bit' ? t.payBit : p.key === 'paybox' ? t.payPaybox : t.payBank}`}
                      active={payment.includes(p.key)} onPress={() => toggleItem(payment, setPayment, p.key)} />
                  ))}
                </View>

                <SectionTitle>{`📍 ${t.workAreasTitle}`}</SectionTitle>
                <View style={s.pillRow}>
                  {AREA_OPTS.map(a => (
                    <TogglePill key={a.key}
                      label={a.key === 'north' ? t.regionNorth : a.key === 'center' ? t.regionCenter : t.regionSouth}
                      active={workAreas.includes(a.key)} onPress={() => toggleItem(workAreas, setWorkAreas, a.key)} />
                  ))}
                </View>

                {/* ─── ימי ושעות עבודה ─── */}
                <SectionTitle>{`🕐 ${t.availTitle}`}</SectionTitle>
                {DAY_KEYS.map(day => {
                  const dayLabel = t[`avail${day.charAt(0).toUpperCase() + day.slice(1)}` as keyof typeof t] as string;
                  const info = availability[day];
                  return (
                    <View key={day} style={s.availRow}>
                      <TouchableOpacity
                        style={[s.availDayBtn, info.active && s.availDayBtnActive]}
                        onPress={() => toggleDay(day)}
                      >
                        <T style={[s.availDayText, info.active && s.availDayTextActive]}>{dayLabel}</T>
                      </TouchableOpacity>
                      {info.active && (
                        <View style={s.availTimePickers}>
                          <View style={s.availTimeGroup}>
                            <T style={s.availTimeLabel}>{t.availStartTime}</T>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.availTimeScroll}>
                              {TIME_OPTS.map(h => (
                                <TouchableOpacity
                                  key={h}
                                  style={[s.availTimeChip, info.start === h && s.availTimeChipActive]}
                                  onPress={() => setDayTime(day, 'start', h)}
                                >
                                  <T style={[s.availTimeChipText, info.start === h && s.availTimeChipTextActive]}>{h}:00</T>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                          <View style={s.availTimeGroup}>
                            <T style={s.availTimeLabel}>{t.availEndTime}</T>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.availTimeScroll}>
                              {TIME_OPTS.map(h => (
                                <TouchableOpacity
                                  key={h}
                                  style={[s.availTimeChip, info.end === h && s.availTimeChipActive]}
                                  onPress={() => setDayTime(day, 'end', h)}
                                >
                                  <T style={[s.availTimeChipText, info.end === h && s.availTimeChipTextActive]}>{h}:00</T>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}

                <SectionTitle>{t.prefLangSection}</SectionTitle>
                <View style={s.pillRow}>
                  {LANG_OPTS.map(l => (
                    <TogglePill
                      key={l.key}
                      label={`${l.flag} ${l.label}`}
                      active={prefLang === l.key}
                      onPress={() => setPrefLang(l.key)}
                      devanagari={l.key === 'hi'}
                    />
                  ))}
                </View>

              </View>
            </>
          )}

          {/* קוד הפניה */}
          <View style={s.field}>
            <T style={s.label}>🎁 {t.referralInput}</T>
            <TextInput
              style={s.input}
              placeholder="ABC123"
              value={referralCode}
              onChangeText={v => setReferralCode(v.toUpperCase())}
              autoCapitalize="characters"
              placeholderTextColor={C.sub}
              textAlign="right"
            />
          </View>

          {/* תקנון */}
          <View style={s.termsBox}>
            <Checkbox
              checked={termsOk} onPress={() => setTermsOk(v => !v)}
              label={t.termsAgreeText} linkLabel={t.termsLinkLabel}
              onLinkPress={() => setShowTerms(true)}
            />
            <Checkbox
              checked={ageOk} onPress={() => setAgeOk(v => !v)}
              label={role === 'cleaner' ? t.ageCheckCleaner : t.ageCheck18}
            />
            <Checkbox
              checked={privacyOk} onPress={() => setPrivacyOk(v => !v)}
              label={t.privacyConsent}
            />
          </View>

          <TouchableOpacity
            style={[s.btn, (!canRegister || loading) && s.btnDisabled]}
            onPress={handleRegister} disabled={!canRegister || loading}
          >
            <T style={s.btnText}>{loading ? t.registering : t.registerBtn}</T>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => router.back()}>
            <T style={{ color: C.sub, fontSize: 14 }}>{t.alreadyAccount}</T>
          </TouchableOpacity>
        </ScrollView>

      </KeyboardAvoidingView>
      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} closeLabel={t.closeBtn} title={t.termsLinkLabel} />
      <View style={{ height: NAV_BAR_HEIGHT }} />
    </SafeAreaView>
  );
}



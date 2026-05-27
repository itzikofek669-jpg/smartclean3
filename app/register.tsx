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
import { useLanguage } from '../lib/LanguageContext';
import { Lang } from '../lib/translations';

const C = {
  blue:      '#185FA5',
  blueDark:  '#0D4F96',
  blueLight: '#E6F1FB',
  border:    '#B5D4F4',
  text:     '#042C53',
  sub:      '#6B9DC2',
  white:    '#FFFFFF',
  green:    '#10B981',
  greenBg:  '#D1FAE5',
  error:    '#EF4444',
};

const SERVICE_TYPES = [
  { key: 'ניקוי לפסח',          icon: '🧹' },
  { key: 'חלונות',              icon: '🪟' },
  { key: 'שטיפת רכב',           icon: '🚗' },
  { key: 'לאחר שיפוץ',          icon: '🔨' },
  { key: 'ניקיון משרדים',        icon: '🏢' },
  { key: 'ניקיון אחרי אירוע',    icon: '🎉' },
  { key: 'מחסן ועליית גג',       icon: '📦' },
];

const PAYMENT_OPTS = [
  { key: 'cash',   label: 'מזומן',  icon: '💵' },
  { key: 'bit',    label: 'ביט',    icon: '📱' },
  { key: 'paybox', label: 'paybox', icon: '💳' },
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
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
        <View style={tm.header}>
          <Text style={tm.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={tm.closeBtn}>
            <Text style={{ color: C.white, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={tm.body}>{TERMS}</Text>
        </ScrollView>
        <View style={{ padding: 16 }}>
          <TouchableOpacity style={tm.agreeBtn} onPress={onClose}>
            <Text style={tm.agreeBtnText}>{closeLabel}</Text>
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
  return (
    <TouchableOpacity style={s.checkRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.checkBox, checked && s.checkBoxOn]}>
        {checked && <Text style={s.checkMark}>✓</Text>}
      </View>
      <Text style={s.checkLabel}>
        {label}{' '}
        {linkLabel && (
          <Text style={s.checkLink} onPress={e => { e.stopPropagation?.(); onLinkPress?.(); }}>
            {linkLabel}
          </Text>
        )}
      </Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

function TogglePill({ label, active, onPress, devanagari }: { label: string; active: boolean; onPress: () => void; devanagari?: boolean }) {
  return (
    <TouchableOpacity style={[s.pill, active && s.pillActive]} onPress={onPress}>
      <Text style={[s.pillText, active && s.pillTextActive, devanagari && { fontFamily: 'NotoSansDevanagari_400Regular', fontWeight: '400' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { lang, t, setLang } = useLanguage();

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
  const [maxDistance,    setMaxDistance]    = useState('');
  const [bringSupplies,  setBringSupplies]  = useState(true);

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
        if (maxDistance)    data.maxDistance  = Number(maxDistance) || 0;
        // Convert servicePricing string values to numbers
        const spNum: Record<string, number> = {};
        Object.entries(servicePricing).forEach(([k, v]) => { if (v) spNum[k] = Number(v); });
        if (Object.keys(spNum).length > 0) data.servicePricing = spNum;
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
            <Text style={{ color: C.white, fontSize: 20 }}>←</Text>
          </TouchableOpacity>
          <RNImage
            source={require('../assets/images/icon.png')}
            style={{ width: 70, height: 70, marginBottom: 2 }}
            resizeMode="contain"
          />
          <Text style={s.title}>{t.joinTitle}</Text>
        </View>

        <ScrollView style={s.card} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <Text style={s.cardTitle}>{t.createAccountTitle}</Text>

          {/* תפקיד */}
          <Text style={s.label}>{t.iAmLabel}</Text>
          <View style={s.roleRow}>
            <TouchableOpacity style={[s.roleBtn, role === 'client' && s.roleBtnActive]} onPress={() => setRole('client')}>
              <Text style={s.roleIcon}>👤</Text>
              <Text style={[s.roleLabel, role === 'client' && s.roleLabelActive]}>{t.clientLabel}</Text>
              <Text style={[s.roleDesc, role === 'client' && { color: C.blue }]}>{t.lookingForCleaner}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.roleBtn, role === 'cleaner' && s.roleBtnActive]} onPress={() => setRole('cleaner')}>
              <Text style={s.roleIcon}>✨</Text>
              <Text style={[s.roleLabel, role === 'cleaner' && s.roleLabelActive]}>{t.cleanerLabel}</Text>
              <Text style={[s.roleDesc, role === 'cleaner' && { color: C.blue }]}>{t.offeringService}</Text>
            </TouchableOpacity>
          </View>

          {/* שדות בסיס */}
          <View style={s.field}>
            <Text style={s.label}>{t.fullNameLabel}</Text>
            <TextInput style={s.input} placeholder={t.namePlaceholder} value={name} onChangeText={setName} placeholderTextColor={C.sub} textAlign="right" />
          </View>
          <View style={s.field}>
            <Text style={s.label}>{t.emailLabel}</Text>
            <TextInput style={s.input} placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.sub} textAlign="right" />
          </View>
          <View style={s.field}>
            <Text style={s.label}>{t.passwordLabel}</Text>
            <TextInput style={s.input} placeholder={t.passwordHint} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={C.sub} textAlign="right" />
          </View>
          <View style={s.field}>
            <Text style={s.label}>📱 {t.phoneLabel} *</Text>
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
                <Text style={s.freePromoText}>{t.freeClientPromo}</Text>
              </View>
            <View style={s.clientBlock}>
              <View style={s.field}>
                <Text style={s.label}>🏙️ {t.cityLabel}</Text>
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
                <Text style={s.freePromoText}>{t.freeCleanerPromo}</Text>
              </View>

              <View style={s.cleanerBlock}>

                {/* תמונת פרופיל — חובה */}
                <View style={s.photoPickerWrap}>
                  <TouchableOpacity style={s.photoPickerBtn} onPress={pickCleanerPhoto}>
                    {photoB64 ? (
                      <Image source={{ uri: photoB64 }} style={s.photoPickerImg} contentFit="cover" />
                    ) : (
                      <View style={s.photoPickerPlaceholder}>
                        <Text style={{ fontSize: 36 }}>📷</Text>
                      </View>
                    )}
                    <View style={s.photoPickerBadge}>
                      <Text style={{ fontSize: 14 }}>✏️</Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={s.photoPickerLabel}>
                    {photoB64 ? t.photoAdded : t.photoRequiredMsg}
                  </Text>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>🏙️ {t.cityLabel}</Text>
                  <TextInput style={s.input} placeholder="תל אביב, חיפה..." value={city} onChangeText={setCity} placeholderTextColor={C.sub} textAlign="right" />
                </View>


                <View style={s.field}>
                  <Text style={s.label}>{t.citizenshipLabel}</Text>
                  <TextInput style={s.input} placeholder={t.citizenshipPlaceholder} value={citizenship} onChangeText={setCitizenship} placeholderTextColor={C.sub} textAlign="right" />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t.ageLabel}</Text>
                  <TextInput style={s.input} placeholder={t.agePlaceholder} value={cleanerAge} onChangeText={setCleanerAge} keyboardType="numeric" placeholderTextColor={C.sub} textAlign="right" />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t.mobileLabel}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[s.pill, isMobile && s.pillActive, { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }]}
                      onPress={() => setIsMobile(true)}>
                      <Text style={[s.pillText, isMobile && s.pillTextActive, { textAlign: 'center' }]}>{t.mobileYes}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.pill, !isMobile && s.pillActive, { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }]}
                      onPress={() => setIsMobile(false)}>
                      <Text style={[s.pillText, !isMobile && s.pillTextActive, { textAlign: 'center' }]}>{t.mobileNo}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t.maxDistanceLabel}</Text>
                  <TextInput style={s.input} placeholder={t.maxDistancePlaceholder} value={maxDistance} onChangeText={setMaxDistance} keyboardType="numeric" placeholderTextColor={C.sub} textAlign="right" />
                </View>

                {/* Per-service pricing (optional) */}
                <SectionTitle>{t.servicePricingTitle}</SectionTitle>
                <Text style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>{t.servicePricingNote}</Text>
                {[
                  { key: 'ניקוי לפסח',         icon: '🧹' },
                  { key: 'שטיפת רכב',            icon: '🚗' },
                  { key: 'חלונות',               icon: '🪟' },
                  { key: 'לאחר שיפוץ',           icon: '🔨' },
                  { key: 'ניקיון אחרי אירוע',    icon: '🎉' },
                ].map(svc => (
                  <View key={svc.key} style={[s.field, { marginBottom: 8 }]}>
                    <Text style={[s.label, { fontSize: 12 }]}>{svc.icon} {t.types[svc.key] || svc.key} — ₪{t.perHour}</Text>
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
                  <Text style={s.label}>🧹 מחיר לשעה לניקוי רגיל (₪)</Text>
                  <TextInput style={s.input} placeholder={t.basePricePlaceholder} value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor={C.sub} textAlign="right" />
                </View>

                <View style={s.field}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[s.label, { marginBottom: 0, color: bio.trim().split(/\s+/).filter(Boolean).length > 30 ? C.error : C.text }]}>
                      {bio.trim().split(/\s+/).filter(Boolean).length}/30 {t.bioWordCount}
                    </Text>
                    <Text style={s.label}>{t.bioLabel}</Text>
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
                  <Text style={{ fontSize: 11, color: C.sub, textAlign: 'right', marginTop: 4 }}>{t.bioWordLimitHint}</Text>
                </View>

                <View style={s.field}>
                  <Text style={s.label}>{t.suppliesLabel}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[s.pill, bringSupplies && s.pillActive, { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }]}
                      onPress={() => setBringSupplies(true)}>
                      <Text style={[s.pillText, bringSupplies && s.pillTextActive, { textAlign: 'center' }]}>{t.suppliesCleaner}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.pill, !bringSupplies && s.pillActive, { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }]}
                      onPress={() => setBringSupplies(false)}>
                      <Text style={[s.pillText, !bringSupplies && s.pillTextActive, { textAlign: 'center' }]}>{t.suppliesClient}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <SectionTitle>{t.serviceTypesSection}</SectionTitle>
                <View style={s.pillRow}>
                  {SERVICE_TYPES.map(svc => (
                    <TogglePill key={svc.key} label={`${svc.icon} ${t.types[svc.key] || svc.key}`} active={types.includes(svc.key)} onPress={() => toggleItem(types, setTypes, svc.key)} />
                  ))}
                </View>

                <SectionTitle>{t.paymentSection}</SectionTitle>
                <View style={s.pillRow}>
                  {PAYMENT_OPTS.map(p => (
                    <TogglePill key={p.key}
                      label={`${p.icon} ${p.key === 'cash' ? t.payCash : p.key === 'bit' ? t.payBit : 'Paybox'}`}
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
            <Text style={s.label}>🎁 {t.referralInput}</Text>
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
            <Text style={s.btnText}>{loading ? t.registering : t.registerBtn}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', marginTop: 16 }} onPress={() => router.back()}>
            <Text style={{ color: C.sub, fontSize: 14 }}>{t.alreadyAccount}</Text>
          </TouchableOpacity>
        </ScrollView>

      </KeyboardAvoidingView>
      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} closeLabel={t.closeBtn} title={t.termsLinkLabel} />
      <View style={{ height: NAV_BAR_HEIGHT }} />
    </SafeAreaView>
  );
}

const tm = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.blueDark, padding: 16 },
  title:       { fontSize: 17, fontWeight: '800', color: C.white },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  body:        { fontSize: 14, color: C.text, lineHeight: 24, textAlign: 'right' },
  agreeBtn:    { backgroundColor: C.blue, borderRadius: 14, padding: 16, alignItems: 'center' },
  agreeBtnText:{ fontSize: 16, fontWeight: '800', color: C.white },
});

const s = StyleSheet.create({
  wrap:            { flex: 1, backgroundColor: C.blueDark },
  hero:            { alignItems: 'center', paddingTop: 40, paddingBottom: 30, position: 'relative' },
  backBtn:         { position: 'absolute', top: 44, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  logo:            { fontSize: 44, marginBottom: 8 },
  title:           { fontSize: 22, fontWeight: '800', color: C.white },
  card:            { backgroundColor: C.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1 },
  cardTitle:       { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 20, textAlign: 'center' },
  label:           { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 8, textAlign: 'right' },
  field:           { marginBottom: 14 },
  input:           { backgroundColor: C.blueLight, borderRadius: 12, padding: 14, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
  roleRow:         { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleBtn:         { flex: 1, backgroundColor: C.blueLight, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
  roleBtnActive:   { borderColor: C.blue, backgroundColor: '#EBF4FF' },
  roleIcon:        { fontSize: 28, marginBottom: 6 },
  roleLabel:       { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 2 },
  roleLabelActive: { color: C.blue },
  roleDesc:        { fontSize: 11, color: C.sub },
  clientBlock:     { backgroundColor: C.blueLight, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  freePromoCard:   { backgroundColor: '#D1FAE5', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: '#6EE7B7', alignItems: 'center' },
  freePromoText:   { fontSize: 13, fontWeight: '800', color: '#065F46', textAlign: 'center', lineHeight: 20 },
  cleanerBlock:    { backgroundColor: C.blueLight, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  sectionTitle:    { fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 10, marginTop: 4, textAlign: 'right' },
  pillRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pill:            { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border },
  pillActive:      { backgroundColor: C.blue, borderColor: C.blue },
  pillText:        { fontSize: 12, fontWeight: '700', color: C.text, fontFamily: 'sans-serif' },
  pillTextActive:  { color: C.white },
  termsBox:        { backgroundColor: C.blueLight, borderRadius: 14, padding: 14, marginBottom: 16, gap: 12, borderWidth: 1, borderColor: C.border },
  checkRow:        { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  checkBox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkBoxOn:      { backgroundColor: C.blue, borderColor: C.blue },
  checkMark:       { color: C.white, fontSize: 13, fontWeight: '900' },
  checkLabel:      { flex: 1, fontSize: 13, color: C.text, lineHeight: 20, textAlign: 'right' },
  checkLink:       { color: C.blue, fontWeight: '700', textDecorationLine: 'underline' },
  btn:             { backgroundColor: C.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled:     { backgroundColor: C.border },
  btnText:         { fontSize: 16, fontWeight: '800', color: C.white },
  // Photo picker
  photoPickerWrap:        { alignItems: 'center', marginBottom: 20, gap: 8 },
  photoPickerBtn:         { width: 110, height: 110, borderRadius: 55, position: 'relative' },
  photoPickerImg:         { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: C.blue },
  photoPickerPlaceholder: { width: 110, height: 110, borderRadius: 55, backgroundColor: C.blueLight, borderWidth: 2.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  photoPickerBadge:       { position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white },
  photoPickerLabel:       { fontSize: 14, fontWeight: '700', color: C.text },
  photoPickerSub:         { fontSize: 12, color: C.sub, textAlign: 'center' },
});

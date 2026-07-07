import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, Alert, ScrollView, Modal, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useLanguage, T, useAppColors, AppColors } from '../lib/LanguageContext';
import { Lang } from '../lib/translations';

function createS(c: AppColors) {
  return StyleSheet.create({
    wrap:         { flex: 1, backgroundColor: c.white },
    hero:         { alignItems: 'center', paddingTop: 0, paddingBottom: 0, backgroundColor: c.white },
    logo:         { fontSize: 44, marginBottom: 6 },
    title:        { fontSize: 32, fontWeight: '900', color: c.white, letterSpacing: -1 },
    subtitle:     { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

    langBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: c.blueLight, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5, borderColor: c.blueBorder },
    langBtnFlag:  { fontSize: 18 },
    langBtnLabel: { fontSize: 14, fontWeight: '700', color: c.blue },
    langBtnArrow: { fontSize: 10, color: c.textSub, marginLeft: 2 },

    langOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
    langMenu:         { backgroundColor: c.white, borderRadius: 20, width: '100%', maxWidth: 320, overflow: 'hidden' },
    langMenuTitle:    { fontSize: 15, fontWeight: '900', color: c.textDark, padding: 18, paddingBottom: 12, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: c.blueBorder },
    langMenuItem:     { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, gap: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    langMenuItemActive: { backgroundColor: c.blueLight },
    langMenuFlag:     { fontSize: 26 },
    langMenuName:     { flex: 1, fontSize: 16, fontWeight: '600', color: c.textDark },
    langMenuNameActive: { color: c.blue, fontWeight: '800' },
    langMenuCheck:    { fontSize: 18, color: c.blue, fontWeight: '900' },

    card:         { backgroundColor: c.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1 },
    cardTitle:    { fontSize: 22, fontWeight: '800', color: c.textDark, marginBottom: 20, textAlign: 'center' },
    field:        { marginBottom: 16 },
    label:        { fontSize: 13, fontWeight: '700', color: c.textDark, marginBottom: 8, textAlign: 'right' },
    input:        { backgroundColor: c.blueLight, borderRadius: 12, padding: 14, fontSize: 15, color: c.textDark, borderWidth: 1, borderColor: c.blueBorder },
    btn:          { backgroundColor: c.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
    btnText:      { fontSize: 16, fontWeight: '800', color: c.white },
    divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
    dividerLine:  { flex: 1, height: 1, backgroundColor: c.blueBorder },
    dividerText:  { fontSize: 13, color: c.textSub, fontWeight: '600' },
    rememberRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18, paddingHorizontal: 2 },
    checkbox:         { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.blue, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' },
    checkboxChecked:  { backgroundColor: c.blue, borderColor: c.blue },
    checkmark:        { color: c.white, fontSize: 13, fontWeight: '900', lineHeight: 16 },
    rememberText:     { fontSize: 13, color: c.textDark, fontWeight: '600', flex: 1, textAlign: 'right' },
    registerBtn:  { borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: c.blue, marginBottom: 12 },
    registerBtnText: { fontSize: 16, fontWeight: '700', color: c.blue },

    socialRow:         { flexDirection: 'row', gap: 12, marginBottom: 16 },
    socialBtnGoogle:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 8, borderWidth: 1.5, borderColor: '#DADCE0', backgroundColor: c.white, elevation: 2 },
    socialBtnFacebook: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 8, backgroundColor: '#1877F2' },
    socialBtnTextGoogle:   { fontSize: 13, fontWeight: '700', color: '#3C4043' },
    socialBtnTextFacebook: { fontSize: 13, fontWeight: '700', color: c.white },
    googleIcon:   { fontSize: 16, fontWeight: '900', color: '#4285F4' },
    facebookIcon: { fontSize: 18, fontWeight: '900', color: c.white },
  });
}

const LANGS: { code: Lang; flag: string; label: string; nativeName: string }[] = [
  { code: 'he', flag: '🇮🇱', label: 'עב',  nativeName: 'עברית'   },
  { code: 'en', flag: '🇬🇧', label: 'EN',  nativeName: 'English'  },
  { code: 'ru', flag: '🇷🇺', label: 'РУ',  nativeName: 'Русский'  },
  { code: 'ar', flag: '🇸🇦', label: 'عر',  nativeName: 'العربية' },
  { code: 'fr', flag: '🇫🇷', label: 'FR',  nativeName: 'Français' },
  { code: 'hi', flag: '🇮🇳', label: 'हिं', nativeName: 'हिन्दी'  },
  { code: 'uk', flag: '🇺🇦', label: 'UK', nativeName: 'Українська' },
];

// ─── יוצר פרופיל ב-Firestore למשתמש חדש שנכנס ברשת חברתית ─────────────────
async function ensureUserProfile(uid: string, name: string, email: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name, email,
      role: 'client',
      createdAt: new Date().toISOString(),
      socialLogin: true,
    });
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const C = useAppColors();
  const s = createS(C);

  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [showPass,      setShowPass]      = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [rememberMe,    setRememberMe]    = useState(false);
  const [showLangMenu,  setShowLangMenu]  = useState(false);

  const currentLang = LANGS.find(l => l.code === lang) || LANGS[0];

  // טעינת פרטים שמורים (זכור אותי)
  useEffect(() => {
    (async () => {
      const savedEmail = await SecureStore.getItemAsync('remember_email');
      const savedPass  = await SecureStore.getItemAsync('remember_pass');
      if (savedEmail && savedPass) {
        setEmail(savedEmail);
        setPassword(savedPass);
        setRememberMe(true);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) return Alert.alert(t.error, `${t.emailLabel} & ${t.passwordLabel}`);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      if (rememberMe) {
        await SecureStore.setItemAsync('remember_email', email.trim());
        await SecureStore.setItemAsync('remember_pass',  password);
      } else {
        await SecureStore.deleteItemAsync('remember_email');
        await SecureStore.deleteItemAsync('remember_pass');
      }
    } catch (e: any) {
      const msg =
        e.code === 'auth/user-not-found'      ? 'משתמש לא קיים — בדוק אם ההרשמה הושלמה' :
        e.code === 'auth/wrong-password'      ? 'סיסמה שגויה' :
        e.code === 'auth/invalid-email'       ? 'כתובת email לא תקינה' :
        e.code === 'auth/invalid-credential'  ? 'אימייל או סיסמה שגויים — נסה שוב' :
        e.code === 'auth/too-many-requests'   ? 'יותר מדי ניסיונות — המתן כמה דקות ונסה שוב' :
        e.code === 'auth/network-request-failed' ? 'בעיית רשת — בדוק חיבור אינטרנט' :
        e.code === 'auth/user-disabled'       ? 'החשבון הושבת — פנה לתמיכה' :
        `שגיאת כניסה (${e.code || e.message || 'unknown'})`;
      Alert.alert(t.error, msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.wrap}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0} style={{ flex: 1 }}>

        {/* Hero */}
        <View style={s.hero}>
          <Image
            source={require('../assets/images/logo-ui.png')}
            style={{ width: 300, height: 300, marginBottom: -45 }}
            resizeMode="contain"
          />
        </View>

        {/* Card */}
        <ScrollView style={s.card} contentContainerStyle={{ padding: 28, paddingTop: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Language button */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity style={s.langBtn} onPress={() => setShowLangMenu(true)}>
              <T style={s.langBtnFlag}>{currentLang.flag}</T>
              <T style={s.langBtnLabel}>{currentLang.nativeName}</T>
              <T style={s.langBtnArrow}>▼</T>
            </TouchableOpacity>
          </View>

          <View style={s.field}>
            <T style={s.label}>{t.emailLabel}</T>
            <TextInput
              style={s.input}
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={C.sub}
              textAlign="right"
            />
          </View>

          <View style={s.field}>
            <T style={s.label}>{t.passwordLabel}</T>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput
                style={[s.input, { paddingLeft: 48 }]}
                placeholder={t.passwordHint}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                placeholderTextColor={C.sub}
                textAlign="right"
              />
              <TouchableOpacity
                onPress={() => setShowPass(v => !v)}
                style={{ position: 'absolute', left: 8, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 8 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <T style={{ fontSize: 20 }}>{showPass ? '🙈' : '👁️'}</T>
              </TouchableOpacity>
            </View>
          </View>

          {/* זכור אותי + שכחתי סיסמה */}
          <TouchableOpacity style={s.rememberRow} onPress={() => setRememberMe(v => !v)} activeOpacity={0.7}>
            <View style={[s.checkbox, rememberMe && s.checkboxChecked]}>
              {rememberMe && <T style={s.checkmark}>✓</T>}
            </View>
            <T style={s.rememberText}>{t.rememberMeText}</T>
          </TouchableOpacity>

          <TouchableOpacity onPress={async () => {
            if (!email.trim()) return Alert.alert(t.error, t.enterEmailFirst);
            try {
              try { auth.languageCode = 'he'; } catch (_) {}
              await sendPasswordResetEmail(auth, email.trim());
              Alert.alert(t.resetSentTitle, t.resetSentMsg);
            } catch {
              Alert.alert(t.error, t.emailNotFound);
            }
          }} style={{ alignItems: 'flex-end', paddingVertical: 6, marginBottom: 4 }}>
            <T style={{ color: C.blue, fontSize: 13, fontWeight: '600' }}>{t.forgotPasswordBtn}</T>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
            <T style={s.btnText}>{loading ? t.loggingIn : t.loginBtn}</T>
          </TouchableOpacity>

          <TouchableOpacity style={[s.registerBtn, { marginTop: 12 }]} onPress={() => router.push('/register')}>
            <T style={s.registerBtnText}>{t.registerLink}</T>
          </TouchableOpacity>

        </ScrollView>

      </KeyboardAvoidingView>

      {/* Language picker modal */}
      <Modal visible={showLangMenu} transparent animationType="fade">
        <TouchableOpacity style={s.langOverlay} activeOpacity={1} onPress={() => setShowLangMenu(false)}>
          <View style={s.langMenu}>
            <T style={s.langMenuTitle}>{t.drawerLanguage}</T>
            {LANGS.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[s.langMenuItem, lang === l.code && s.langMenuItemActive]}
                onPress={() => { setLang(l.code); setShowLangMenu(false); }}
              >
                <T style={s.langMenuFlag}>{l.flag}</T>
                <T style={[s.langMenuName, lang === l.code && s.langMenuNameActive]}>{l.nativeName}</T>
                {lang === l.code && <T style={s.langMenuCheck}>✓</T>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}


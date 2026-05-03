import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, KeyboardAvoidingView, Platform, Alert, ScrollView, Modal, Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, FacebookAuthProvider, signInWithCredential } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri, exchangeCodeAsync } from 'expo-auth-session';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useLanguage } from '../lib/LanguageContext';
import { Lang } from '../lib/translations';

WebBrowser.maybeCompleteAuthSession();

// ─── 🔑 מפתחות OAuth ──────────────────────────────────────────────────────────
// Android client — נוצר ב-Google Cloud Console עם package name + SHA-1
// !! להחליף אחרי יצירת Android client ב-Google Cloud Console !!
const GOOGLE_CLIENT_ID = 'REPLACE_WITH_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const FACEBOOK_APP_ID  = '293492306044443';

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};
// ──────────────────────────────────────────────────────────────────────────────

const C = {
  blue:     '#185FA5',
  blueDark: '#0D4F96',
  blueMid:  '#1E6FC0',
  blueLight:'#E6F1FB',
  border:   '#B5D4F4',
  text:     '#042C53',
  sub:      '#6B9DC2',
  white:    '#FFFFFF',
  error:    '#EF4444',
};

const LANGS: { code: Lang; flag: string; label: string; nativeName: string }[] = [
  { code: 'he', flag: '🇮🇱', label: 'עב',  nativeName: 'עברית'   },
  { code: 'en', flag: '🇬🇧', label: 'EN',  nativeName: 'English'  },
  { code: 'ru', flag: '🇷🇺', label: 'РУ',  nativeName: 'Русский'  },
  { code: 'ar', flag: '🇸🇦', label: 'عر',  nativeName: 'العربية' },
  { code: 'fr', flag: '🇫🇷', label: 'FR',  nativeName: 'Français' },
  { code: 'hi', flag: '🇮🇳', label: 'हिं', nativeName: 'हिन्दी'  },
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

  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google'|'facebook'|null>(null);
  const [rememberMe,    setRememberMe]    = useState(false);
  const [showLangMenu,  setShowLangMenu]  = useState(false);

  // ─── Google auth session (Android client + PKCE code flow) ──────────────
  const googleRedirect = makeRedirectUri({ native: 'com.itzik669.cleantouch:/oauth2redirect' });
  const [, googleResponse, googlePrompt] = useAuthRequest(
    {
      clientId:     GOOGLE_CLIENT_ID,
      redirectUri:  googleRedirect,
      scopes:       ['openid', 'profile', 'email'],
      responseType: 'code',
    },
    GOOGLE_DISCOVERY
  );

  useEffect(() => {
    if (googleResponse?.type !== 'success') {
      if (googleResponse?.type === 'error')
        Alert.alert('שגיאה', googleResponse.error?.message || 'כניסה עם Google נכשלה');
      return;
    }
    const { code } = googleResponse.params;
    setSocialLoading('google');
    exchangeCodeAsync(
      { clientId: GOOGLE_CLIENT_ID,
        redirectUri: googleRedirect, code },
      GOOGLE_DISCOVERY
    )
      .then(async tokenResult => {
        const idToken = tokenResult.idToken;
        if (!idToken) throw new Error('no id_token');
        const credential = GoogleAuthProvider.credential(idToken);
        const res = await signInWithCredential(auth, credential);
        await ensureUserProfile(res.user.uid, res.user.displayName || 'משתמש', res.user.email || '');
      })
      .catch((e: any) => {
        const msg = e?.code === 'auth/account-exists-with-different-credential'
          ? 'כתובת האימייל הזו כבר רשומה בשיטה אחרת'
          : 'כניסה עם Google נכשלה — נסה שוב';
        Alert.alert('שגיאה', msg);
      })
      .finally(() => setSocialLoading(null));
  }, [googleResponse]);

  // ─── Facebook auth session ───────────────────────────────────────────────
  // Facebook דורש https:// URI — משתמשים בפרוקסי של Expo
  const fbRedirect = makeRedirectUri({ useProxy: true });
  const [, fbResponse, fbPrompt] = useAuthRequest(
    {
      clientId: FACEBOOK_APP_ID,
      redirectUri: fbRedirect,
      scopes: ['public_profile', 'email'],
      responseType: 'token',
    },
    { authorizationEndpoint: 'https://www.facebook.com/dialog/oauth' }
  );

  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const token = fbResponse.params?.access_token;
      if (!token) {
        Alert.alert('שגיאה', 'לא התקבל token מ-Facebook. נסה שוב.');
        return;
      }
      const credential = FacebookAuthProvider.credential(token);
      setSocialLoading('facebook');
      signInWithCredential(auth, credential)
        .then(async (res) => {
          await ensureUserProfile(res.user.uid, res.user.displayName || 'משתמש', res.user.email || '');
        })
        .catch((e: any) => {
          const msg = e?.code === 'auth/account-exists-with-different-credential'
            ? 'כתובת האימייל הזו כבר רשומה בשיטה אחרת'
            : 'כניסה עם Facebook נכשלה — נסה שוב';
          Alert.alert('שגיאה', msg);
        })
        .finally(() => setSocialLoading(null));
    } else if (fbResponse?.type === 'error') {
      Alert.alert('שגיאה', fbResponse.error?.message || 'כניסה עם Facebook נכשלה');
    }
  }, [fbResponse]);

  const handleGoogleLogin = async () => {
    await googlePrompt();
  };

  const handleFacebookLogin = async () => {
    await fbPrompt();
  };

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
        e.code === 'auth/user-not-found'     ? 'משתמש לא קיים' :
        e.code === 'auth/wrong-password'     ? 'סיסמה שגויה' :
        e.code === 'auth/invalid-email'      ? 'כתובת email לא תקינה' :
        e.code === 'auth/invalid-credential' ? 'פרטים שגויים' :
        'שגיאת כניסה, נסה שוב';
      Alert.alert(t.error, msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.wrap}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Hero */}
        <View style={s.hero}>
          <Image
            source={require('../assets/images/icon.png')}
            style={{ width: 200, height: 200, marginBottom: -25 }}
            resizeMode="contain"
          />
        </View>

        {/* Card */}
        <ScrollView style={s.card} contentContainerStyle={{ padding: 28, paddingTop: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Language button */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity style={s.langBtn} onPress={() => setShowLangMenu(true)}>
              <Text style={s.langBtnFlag}>{currentLang.flag}</Text>
              <Text style={s.langBtnLabel}>{currentLang.nativeName}</Text>
              <Text style={s.langBtnArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Social login buttons */}
          <View style={s.socialRow}>
            <TouchableOpacity
              style={[s.socialBtnGoogle, socialLoading === 'google' && { opacity: 0.7 }]}
              onPress={handleGoogleLogin}
              disabled={!!socialLoading}
            >
              {socialLoading === 'google'
                ? <ActivityIndicator size="small" color="#4285F4" />
                : <Text style={s.googleIcon}>G</Text>}
              <Text style={s.socialBtnTextGoogle}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.socialBtnFacebook, socialLoading === 'facebook' && { opacity: 0.7 }]}
              onPress={handleFacebookLogin}
              disabled={!!socialLoading}
            >
              {socialLoading === 'facebook'
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.facebookIcon}>f</Text>}
              <Text style={s.socialBtnTextFacebook}>Facebook</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{t.orDivider}</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.field}>
            <Text style={s.label}>{t.emailLabel}</Text>
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
            <Text style={s.label}>{t.passwordLabel}</Text>
            <TextInput
              style={s.input}
              placeholder={t.passwordHint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={C.sub}
              textAlign="right"
            />
          </View>

          {/* זכור אותי + שכחתי סיסמה */}
          <TouchableOpacity style={s.rememberRow} onPress={() => setRememberMe(v => !v)} activeOpacity={0.7}>
            <View style={[s.checkbox, rememberMe && s.checkboxChecked]}>
              {rememberMe && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.rememberText}>זכור אותי — כניסה מהירה בפעם הבאה</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={async () => {
            if (!email.trim()) return Alert.alert(t.error, 'הכנס את האימייל שלך קודם');
            try {
              await sendPasswordResetEmail(auth, email.trim());
              Alert.alert('✅ נשלח!', 'קישור לאיפוס סיסמה נשלח לאימייל שלך');
            } catch {
              Alert.alert(t.error, 'אימייל לא נמצא במערכת');
            }
          }} style={{ alignItems: 'flex-end', paddingVertical: 6, marginBottom: 4 }}>
            <Text style={{ color: C.blue, fontSize: 13, fontWeight: '600' }}>🔑 שכחתי סיסמה</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.registerBtn} onPress={() => router.push('/register')}>
            <Text style={s.registerBtnText}>{t.registerLink}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
            <Text style={s.btnText}>{loading ? t.loggingIn : t.loginBtn}</Text>
          </TouchableOpacity>

        </ScrollView>

      </KeyboardAvoidingView>

      {/* Language picker modal */}
      <Modal visible={showLangMenu} transparent animationType="fade">
        <TouchableOpacity style={s.langOverlay} activeOpacity={1} onPress={() => setShowLangMenu(false)}>
          <View style={s.langMenu}>
            <Text style={s.langMenuTitle}>{t.drawerLanguage}</Text>
            {LANGS.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[s.langMenuItem, lang === l.code && s.langMenuItemActive]}
                onPress={() => { setLang(l.code); setShowLangMenu(false); }}
              >
                <Text style={s.langMenuFlag}>{l.flag}</Text>
                <Text style={[s.langMenuName, lang === l.code && s.langMenuNameActive]}>{l.nativeName}</Text>
                {lang === l.code && <Text style={s.langMenuCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap:         { flex: 1, backgroundColor: C.white },
  hero:         { alignItems: 'center', paddingTop: 12, paddingBottom: 10, backgroundColor: C.white },
  logo:         { fontSize: 44, marginBottom: 6 },
  title:        { fontSize: 32, fontWeight: '900', color: C.white, letterSpacing: -1 },
  subtitle:     { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  langBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: C.blueLight, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5, borderColor: C.border },
  langBtnFlag:  { fontSize: 18 },
  langBtnLabel: { fontSize: 14, fontWeight: '700', color: C.blue },
  langBtnArrow: { fontSize: 10, color: C.sub, marginLeft: 2 },

  langOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  langMenu:         { backgroundColor: C.white, borderRadius: 20, width: '100%', maxWidth: 320, overflow: 'hidden' },
  langMenuTitle:    { fontSize: 15, fontWeight: '900', color: C.text, padding: 18, paddingBottom: 12, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  langMenuItem:     { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, gap: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  langMenuItemActive: { backgroundColor: C.blueLight },
  langMenuFlag:     { fontSize: 26 },
  langMenuName:     { flex: 1, fontSize: 16, fontWeight: '600', color: C.text },
  langMenuNameActive: { color: C.blue, fontWeight: '800' },
  langMenuCheck:    { fontSize: 18, color: C.blue, fontWeight: '900' },

  card:         { backgroundColor: C.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1 },
  cardTitle:    { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 20, textAlign: 'center' },
  field:        { marginBottom: 16 },
  label:        { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 8, textAlign: 'right' },
  input:        { backgroundColor: C.blueLight, borderRadius: 12, padding: 14, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
  btn:          { backgroundColor: C.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText:      { fontSize: 16, fontWeight: '800', color: C.white },
  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: C.border },
  dividerText:  { fontSize: 13, color: C.sub, fontWeight: '600' },
  rememberRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18, paddingHorizontal: 2 },
  checkbox:         { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.blue, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked:  { backgroundColor: C.blue, borderColor: C.blue },
  checkmark:        { color: C.white, fontSize: 13, fontWeight: '900', lineHeight: 16 },
  rememberText:     { fontSize: 13, color: C.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  registerBtn:  { borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.blue, marginBottom: 12 },
  registerBtnText: { fontSize: 16, fontWeight: '700', color: C.blue },

  socialRow:         { flexDirection: 'row', gap: 12, marginBottom: 16 },
  socialBtnGoogle:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 8, borderWidth: 1.5, borderColor: '#DADCE0', backgroundColor: C.white, elevation: 2 },
  socialBtnFacebook: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 8, backgroundColor: '#1877F2' },
  socialBtnTextGoogle:   { fontSize: 13, fontWeight: '700', color: '#3C4043' },
  socialBtnTextFacebook: { fontSize: 13, fontWeight: '700', color: C.white },
  googleIcon:   { fontSize: 16, fontWeight: '900', color: '#4285F4' },
  facebookIcon: { fontSize: 18, fontWeight: '900', color: C.white },
});

import React, { useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Application from 'expo-application';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useLanguage, T, useAppColors } from './LanguageContext';
import { logError } from './logError';
import { outdatedBuild, updateLinkFor, type AppVersionConfig } from './versionRule';

/**
 * "A new version is out — update to keep going." Covers every screen when this
 * build is older than the minimum the admin set in `settings/appVersion`
 * (lib/versionRule). Checked at launch and each time the app comes back to the
 * front. Not in development builds: they carry the app.json versionCode, not
 * the CI one, and would lock the developer out.
 *
 * The text lives here rather than in lib/translations: it is the one screen an
 * outdated build must be able to show, in every language, and nothing else.
 */
const TEXT: Record<string, { title: string; body: string; button: string; noLink: string }> = {
  he: { title: 'יש גרסה חדשה', body: 'הגרסה הזאת של האפליקציה כבר לא נתמכת — ההתראות וחלק מהפעולות לא יעבדו בה. צריך לעדכן כדי להמשיך.', button: 'לעדכון האפליקציה', noLink: 'הגרסה החדשה זמינה אצל צוות השירות — פנו אלינו לקבלת הקישור.' },
  en: { title: 'A new version is available', body: 'This version of the app is no longer supported — notifications and some actions will not work in it. Please update to continue.', button: 'Update the app', noLink: 'The new version is available from our team — contact us for the link.' },
  ru: { title: 'Доступна новая версия', body: 'Эта версия приложения больше не поддерживается — уведомления и некоторые действия в ней не работают. Обновите приложение, чтобы продолжить.', button: 'Обновить приложение', noLink: 'Новая версия доступна у нашей команды — свяжитесь с нами, чтобы получить ссылку.' },
  ar: { title: 'يتوفر إصدار جديد', body: 'هذا الإصدار من التطبيق لم يعد مدعومًا — لن تعمل فيه الإشعارات وبعض الإجراءات. يرجى التحديث للمتابعة.', button: 'تحديث التطبيق', noLink: 'الإصدار الجديد متاح لدى فريقنا — تواصلوا معنا للحصول على الرابط.' },
  fr: { title: 'Une nouvelle version est disponible', body: "Cette version de l'application n'est plus prise en charge — les notifications et certaines actions n'y fonctionnent plus. Mettez-la à jour pour continuer.", button: "Mettre à jour l'application", noLink: "La nouvelle version est disponible auprès de notre équipe — contactez-nous pour obtenir le lien." },
  hi: { title: 'नया संस्करण उपलब्ध है', body: 'ऐप का यह संस्करण अब समर्थित नहीं है — इसमें सूचनाएँ और कुछ काम नहीं चलेंगे। जारी रखने के लिए कृपया अपडेट करें।', button: 'ऐप अपडेट करें', noLink: 'नया संस्करण हमारी टीम के पास उपलब्ध है — लिंक के लिए हमसे संपर्क करें।' },
  uk: { title: 'Доступна нова версія', body: 'Ця версія застосунку більше не підтримується — сповіщення та деякі дії в ній не працюють. Оновіть застосунок, щоб продовжити.', button: 'Оновити застосунок', noLink: 'Нова версія доступна в нашої команди — зв’яжіться з нами, щоб отримати посилання.' },
};

export default function VersionGate() {
  const { lang } = useLanguage();
  const C = useAppColors();
  const [cfg, setCfg] = useState<AppVersionConfig | null>(null);

  useEffect(() => {
    if (__DEV__) return;
    let alive = true;
    const check = () => {
      getDoc(doc(db, 'settings', 'appVersion'))
        .then(snap => { if (alive) setCfg(snap.exists() ? (snap.data() as AppVersionConfig) : null); })
        // Fail open: an unreadable setting never locks anyone out.
        .catch(err => logError('VersionGate', err));
    };
    check();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') check(); });
    return () => { alive = false; sub.remove(); };
  }, []);

  if (!outdatedBuild(cfg, Platform.OS, Application.nativeBuildVersion)) return null;
  const tx = TEXT[lang] ?? TEXT.he;
  const link = updateLinkFor(cfg, Platform.OS);

  return (
    <View style={[s.overlay, { backgroundColor: C.white }]}>
      <T style={{ fontSize: 52, marginBottom: 10 }}>⬆️</T>
      <T style={[s.title, { color: C.textDark }]}>{tx.title}</T>
      <T style={[s.body, { color: C.textSub }]}>{tx.body}</T>
      {link ? (
        <TouchableOpacity style={[s.btn, { backgroundColor: C.blue }]}
                          onPress={() => { Linking.openURL(link).catch(err => logError('VersionGate/open', err)); }}>
          <T style={s.btnText}>{tx.button}</T>
        </TouchableOpacity>
      ) : (
        <T style={[s.body, { color: C.textSub }]}>{tx.noLink}</T>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, start: 0, end: 0, bottom: 0,
    // Above every other gate: an outdated build is the first thing to fix.
    zIndex: 10001, elevation: 10001,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  title:   { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  body:    { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 18 },
  btn:     { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, minWidth: 250, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

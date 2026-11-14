import React, { useEffect, useState } from 'react';
import { Alert, Platform, TouchableOpacity, View } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as Application from 'expo-application';
import { db } from './firebase';
import { T } from './LanguageContext';
import TextInput from './DirTextInput';

/**
 * Admin tool: the oldest app build still allowed on Android, and where to get a
 * new one. Older builds show an update screen (lib/VersionGate, rule in
 * lib/versionRule). Stored in the public `settings/appVersion` document —
 * firestore.rules lets everyone read that one document and only an admin write
 * it, numbers and an https link only. The website's admin has the same tool
 * (src/components/AppVersionAdmin.tsx).
 *
 * Android build numbers are 1000 + the CI run number: build 236 is 1236.
 * No iPhone field: the iOS build number is "1" on every build, so an iPhone
 * minimum would lock every iPhone out (review 13.11.2026). The gate ignores a
 * minimum more than 500 builds ahead (a typo), and saving asks first — the
 * admin's own app is behind the same gate.
 * Styles come from the admin screen, so the card matches its neighbours.
 */
// Hebrew only: the admin screens stay in Hebrew (Ofek, 12.11.2026).
const tx = {
  title: '⬆️ גרסה מינימלית של האפליקציה (אנדרואיד)',
  android: 'בילד מינימלי לאנדרואיד (למשל 1237 = בילד 237)',
  url: 'קישור להורדת הגרסה החדשה (https)',
  save: 'שמירה',
  saved: 'נשמר. גרסאות ישנות יותר יתבקשו לעדכן.',
  failed: 'השמירה נכשלה',
  bad: 'מספר בילד לא תקין או קישור שלא מתחיל ב-https://',
  confirmTitle: 'חסימת גרסאות ישנות',
  confirm: (n: number) => `כל אנדרואיד עם בילד נמוך מ-${n} (בילד ${n - 1001} ומטה ב-CI) יקבל מסך "יש גרסה חדשה" ולא יוכל להמשיך בלי לעדכן. להמשיך?`,
  yes: 'כן, לשמור',
  no: 'ביטול',
  hint: 'ריק = בלי חסימה. גרסאות עד בילד 236 לא מכירות את המסך הזה — להן שולחים התראה לכל המשתמשים.',
  mine: 'הבילד במכשיר הזה',
};

const toBuild = (v: string): number | null | false => {
  const x = v.trim();
  if (!x) return null;
  return /^\d{1,7}$/.test(x) ? Number(x) : false;
};

export default function AppVersionAdmin({ s, C }: { s: any; C: any }) {
  const [android, setAndroid] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'appVersion')).then(snap => {
      const d: any = snap.data() || {};
      if (typeof d.minAndroidBuild === 'number') setAndroid(String(d.minAndroidBuild));
      if (typeof d.updateUrl === 'string') setUrl(d.updateUrl);
    }).catch(() => { /* nothing set yet */ });
  }, []);

  const write = async (a: number | null, u: string) => {
    setBusy(true);
    setNote('');
    try {
      // Whole document, not merged: clearing a field removes the block.
      await setDoc(doc(db, 'settings', 'appVersion'), {
        ...(a !== null ? { minAndroidBuild: a } : {}),
        ...(u ? { updateUrl: u } : {}),
        updatedAt: new Date().toISOString(),
      });
      setNote(tx.saved);
    } catch {
      setNote(tx.failed);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const a = toBuild(android);
    const u = url.trim();
    if (a === false || (a !== null && a < 1000) || (u && !/^https:\/\/\S+$/i.test(u)) || u.length > 500) { setNote(tx.bad); return; }
    if (a === null) { void write(a, u); return; }
    Alert.alert(tx.confirmTitle, tx.confirm(a), [
      { text: tx.no, style: 'cancel' },
      { text: tx.yes, style: 'destructive', onPress: () => { void write(a, u); } },
    ]);
  };

  return (
    <View style={s.card}>
      <T style={s.cardTitle}>{tx.title}</T>
      <T style={s.fieldLabel}>{tx.android}</T>
      <TextInput style={[s.input, { textAlign: 'left' }]} value={android} onChangeText={setAndroid} keyboardType="number-pad" maxLength={7} />
      <T style={s.fieldLabel}>{tx.url}</T>
      <TextInput style={[s.input, { textAlign: 'left' }]} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={500} placeholder="https://" placeholderTextColor={C.sub} />
      <TouchableOpacity style={[s.bigBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
        <T style={s.bigBtnText}>{tx.save}</T>
      </TouchableOpacity>
      <T style={[s.fieldLabel, { marginTop: 10 }]}>{note || tx.hint}</T>
      {Platform.OS === 'android' && (
        <T style={[s.fieldLabel, { marginTop: 4 }]}>{tx.mine}: {Application.nativeBuildVersion ?? '—'}</T>
      )}
    </View>
  );
}

// The cleaner's work diary (Ofek, 18.11.2026): her jobs through the app and the
// private ones she adds herself, by day, with what the coming week holds — and
// her level, which only jobs through the app build (lib/retention).
//
// The private jobs are hers alone (users/{uid}/diary, firestore.rules). Their
// hours are published as busy by the home screen's listener (app/home.tsx
// syncBusySlots), so no client books her into one. The website has the same
// screen (src/pages/Diary.tsx); the logic both use is lib/workDiary.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, Modal, Alert, Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { logError } from '../lib/logError';
import { useLanguage, useAppColors, T, type AppColors } from '../lib/LanguageContext';
import { chevron } from '../lib/trNow';
import TextInput from '../lib/DirTextInput';
import { formatJobDate } from '../lib/jobUtils';
import {
  diaryAgenda, diaryEntryProblem, todayYmd, addDays, prunedSkip, type DiaryEntry, type DiaryItem, type DiaryRepeat,
} from '../lib/workDiary';
import { levelProgress, LEVELS } from '../lib/retention';

const AGENDA_DAYS = 14;
const SUMMARY_DAYS = 7;

type Form = {
  id: string; occurrence: string; clientName: string; phone: string; address: string;
  date: string; startTime: string; hours: number; price: string; notes: string; repeat: DiaryRepeat; skip: string[];
};

const blankForm = (date: string): Form => ({
  id: '', occurrence: '', clientName: '', phone: '', address: '', date, startTime: '09:00', hours: 3,
  price: '', notes: '', repeat: 'weekly', skip: [],
});

const shiftTime = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(23 * 60 + 30, Math.max(0, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const endTime = (start: string, hours: number) => {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function Totals({ C, label, v, color, hoursText, jobsText }: {
  C: AppColors; label: string; v: { count: number; hours: number; money: number }; color: string;
  hoursText: (h: number) => string; jobsText: (n: number) => string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bluePale, borderRadius: 12, padding: 10, gap: 2 }}>
      <T style={{ fontSize: 12, fontWeight: '800', color, textAlign: 'right' }}>{label}</T>
      <T style={{ fontSize: 15, fontWeight: '900', color: C.textDark, textAlign: 'right' }}>{jobsText(v.count)}</T>
      <T style={{ fontSize: 12, color: C.textSub, textAlign: 'right' }}>{hoursText(v.hours)} · ₪{Math.round(v.money).toLocaleString()}</T>
    </View>
  );
}

// − and + pinned left to right in every language, like the app's other steppers.
function Stepper({ C, value, onMinus, onPlus }: { C: AppColors; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={{ flexDirection: 'row', direction: 'ltr', alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder, borderRadius: 12, overflow: 'hidden' }}>
      <TouchableOpacity accessibilityRole="button" onPress={onMinus} style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.bluePale }}>
        <T style={{ fontSize: 18, fontWeight: '900', color: C.blue }}>−</T>
      </TouchableOpacity>
      <T style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', color: C.textDark }}>{value}</T>
      <TouchableOpacity accessibilityRole="button" onPress={onPlus} style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.bluePale }}>
        <T style={{ fontSize: 18, fontWeight: '900', color: C.blue }}>+</T>
      </TouchableOpacity>
    </View>
  );
}

function Label({ C, children }: { C: AppColors; children: React.ReactNode }) {
  return <T style={{ fontSize: 13, fontWeight: '800', color: C.textDark, textAlign: 'right', marginTop: 6 }}>{children}</T>;
}

export default function DiaryScreen() {
  const { t } = useLanguage();
  const tt = t as any;
  const C = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const uid = auth.currentUser?.uid || '';
  const today = todayYmd();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [appJobs, setAppJobs] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!uid) return;
    const unsubs = [
      onSnapshot(collection(db, 'users', uid, 'diary'),
        snap => { setLoadError(false); setEntries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))); },
        err => { logError('diary:entries', err); setLoadError(true); }),
      onSnapshot(query(collection(db, 'bookings'), where('cleanerId', '==', uid)),
        snap => setAppJobs(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
        err => logError('diary:bookings', err)),
      onSnapshot(doc(db, 'users', uid), snap => setMe(snap.data() || null), err => logError('diary:me', err)),
    ];
    return () => unsubs.forEach(u => u());
  }, [uid]);

  const agenda = useMemo(() => diaryAgenda(appJobs, entries, today, AGENDA_DAYS), [appJobs, entries, today]);
  const week = useMemo(() => diaryAgenda(appJobs, entries, today, SUMMARY_DAYS), [appJobs, entries, today]);
  const progress = levelProgress(me);

  const dayLabel = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    const names: string[] = tt.dayNames || ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const name = names[new Date(y, m - 1, d).getDay()] || '';
    const prefix = ymd === today ? `${tt.diaryToday ?? 'היום'} · ` : '';
    return `${prefix}${name} ${formatJobDate(ymd)}`;
  };
  const hoursText = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} ${t.hoursUnit || 'שעות'}`;
  const jobsText = (n: number) => n === 1 ? (tt.diaryJobsOne ?? 'עבודה אחת') : String(tt.diaryJobsCount ?? '{n} עבודות').replace('{n}', String(n));

  const openNew = () => { setFormError(''); setForm(blankForm(addDays(today, 1))); };
  const openEdit = (it: DiaryItem) => {
    const e = entries.find(x => x.id === it.visit?.entryId);
    if (!e) return;
    setFormError('');
    setForm({
      id: String(e.id), occurrence: it.date, clientName: e.clientName || '', phone: e.phone || '', address: e.address || '',
      date: e.date, startTime: e.startTime, hours: Number(e.hours) || 2, price: e.price == null ? '' : String(e.price),
      notes: e.notes || '', repeat: e.repeat, skip: Array.isArray(e.skip) ? e.skip : [],
    });
  };

  const problemText = (p: string) => ({
    name: tt.diaryErrName ?? 'כתבו את שם הלקוח',
    date: tt.diaryErrDate ?? 'התאריך לא תקין',
    time: tt.diaryErrTime ?? 'השעה לא תקינה',
    hours: tt.diaryErrHours ?? 'מספר השעות צריך להיות בין חצי שעה ל-12',
    price: tt.diaryErrPrice ?? 'המחיר לא תקין',
    end: tt.diaryErrEnd ?? 'העבודה צריכה להסתיים עד חצות',
    repeat: tt.diaryErrRepeat ?? 'בחרו תדירות',
    text: tt.diaryErrText ?? 'אחד השדות ארוך מדי',
  } as Record<string, string>)[p] || '';

  const save = async () => {
    if (!form || saving || !uid) return;
    const priceNum = form.price.trim() === '' ? null : Number(form.price.replace(/[^\d.]/g, ''));
    const entry: DiaryEntry = {
      clientName: form.clientName.trim(), phone: form.phone.trim(), address: form.address.trim(),
      date: form.date, startTime: form.startTime, hours: form.hours, price: priceNum,
      notes: form.notes.trim(), repeat: form.repeat, skip: prunedSkip(form.skip, today),
    };
    const problem = diaryEntryProblem(entry);
    if (problem) { setFormError(problemText(problem)); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (form.id) await updateDoc(doc(db, 'users', uid, 'diary', form.id), { ...entry, updatedAt: now } as any);
      else await addDoc(collection(db, 'users', uid, 'diary'), { ...entry, createdAt: now, updatedAt: now });
      setForm(null);
    } catch (err) {
      logError('diary:save', err);
      setFormError(tt.diarySaveFailed ?? 'השמירה נכשלה. בדקו את החיבור ונסו שוב.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!form?.id || !uid) return;
    Alert.alert('', tt.diaryDeleteConfirm ?? 'למחוק את העבודה הפרטית? אם היא קבועה — כל הביקורים שלה יימחקו.', [
      { text: t.cancel, style: 'cancel' },
      {
        text: tt.diaryDelete ?? 'מחיקה', style: 'destructive', onPress: async () => {
          try { await deleteDoc(doc(db, 'users', uid, 'diary', form.id)); setForm(null); }
          catch (err) { logError('diary:delete', err); setFormError(tt.diarySaveFailed ?? 'השמירה נכשלה. בדקו את החיבור ונסו שוב.'); }
        },
      },
    ]);
  };

  const skipOne = async () => {
    if (!form?.id || !form.occurrence || !uid) return;
    try {
      // The list written whole, past dates dropped — it never reaches the cap.
      await updateDoc(doc(db, 'users', uid, 'diary', form.id), { skip: prunedSkip(form.skip, today, form.occurrence), updatedAt: new Date().toISOString() });
      setForm(null);
    } catch (err) {
      logError('diary:skip', err);
      setFormError(tt.diarySaveFailed ?? 'השמירה נכשלה. בדקו את החיבור ונסו שוב.');
    }
  };

  const card = { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.blueBorder, padding: 14, gap: 8 } as const;
  const row = { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 } as const;
  const pill = (bg: string, fg: string) => ({ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, color: fg, fontSize: 11, fontWeight: '800' as const, overflow: 'hidden' as const });
  const levelName = (l: 'gold' | 'silver' | null) => l === 'gold' ? `🥇 ${tt.levelGold ?? 'זהב'}` : l === 'silver' ? `🥈 ${tt.levelSilver ?? 'כסף'}` : (tt.levelNone ?? 'עוד אין דרגה');

  const input = { borderWidth: 1, borderColor: C.blueBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.textDark, backgroundColor: C.white, textAlign: 'right' } as const;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? insets.top : (StatusBar.currentHeight || 0) }}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />
      <View style={{ backgroundColor: C.blueDark, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={tt.diaryBack ?? 'חזרה'} onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontSize: 26, color: '#fff', fontWeight: '700' }}>{chevron('›')}</T>
        </TouchableOpacity>
        <T style={{ flex: 1, fontSize: 18, fontWeight: '900', color: '#fff', textAlign: 'right' }}>📒 {tt.diaryTitle ?? 'יומן עבודה'}</T>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}>
        {/* Her level — earned by rated jobs through the app only. */}
        <View style={card}>
          <View style={row}>
            <T style={{ fontSize: 13, color: C.textSub, fontWeight: '700' }}>{tt.levelYours ?? 'הדרגה שלך'}</T>
            <T style={{ fontSize: 16, fontWeight: '900', color: C.textDark }}>{levelName(progress.level)}</T>
          </View>
          <T style={{ fontSize: 13, color: C.textDark, textAlign: 'right', lineHeight: 20 }}>
            {progress.next === null
              ? (tt.levelTop ?? 'הגעת לדרגה הגבוהה ביותר.')
              : [
                progress.reviewsToGo > 0
                  ? String(progress.next === 'gold' ? (tt.levelToGold ?? 'עוד {n} עבודות מדורגות לדרגת זהב') : (tt.levelToSilver ?? 'עוד {n} עבודות מדורגות לדרגת כסף')).replace('{n}', String(progress.reviewsToGo))
                  : String(progress.next === 'gold' ? (tt.levelGoldRating ?? 'לדרגת זהב חסר רק ממוצע של {r} ומעלה') : (tt.levelSilverRating ?? 'לדרגת כסף חסר רק ממוצע של {r} ומעלה')).replace('{r}', String(LEVELS[progress.next].rating)),
                progress.reviewsToGo > 0 && progress.ratingNeeded !== null
                  ? String(tt.levelAndRating ?? 'וממוצע של {r} ומעלה').replace('{r}', String(progress.ratingNeeded))
                  : '',
              ].filter(Boolean).join(' ')}
          </T>
          <T style={{ fontSize: 12, color: C.textSub, textAlign: 'right', lineHeight: 18 }}>
            {tt.levelExplain ?? 'הדרגה נבנית רק מעבודות שבוצעו ודורגו דרך האפליקציה. לקוחות רואים אותה בכרטיס שלך, והיא מקדמת אותך בחיפוש לפני נותני שירות בדירוג דומה.'}
          </T>
        </View>

        {/* The coming week, both kinds. */}
        <View style={card}>
          <T style={{ fontSize: 14, fontWeight: '900', color: C.textDark, textAlign: 'right' }}>{tt.diaryWeekSummary ?? '7 הימים הקרובים'}</T>
          <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
            <Totals C={C} label={tt.diaryAppJobs ?? 'דרך האפליקציה'} v={week.app} color={C.blue} hoursText={hoursText} jobsText={jobsText} />
            <Totals C={C} label={tt.diaryPrivateJobs ?? 'פרטי'} v={week.private} color={C.textMid} hoursText={hoursText} jobsText={jobsText} />
          </View>
        </View>

        <TouchableOpacity accessibilityRole="button" onPress={openNew} style={{ backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
          <T style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>＋ {tt.diaryAddBtn ?? 'עבודה פרטית'}</T>
        </TouchableOpacity>

        {loadError && (
          <T style={{ fontSize: 13, color: C.error, textAlign: 'right' }}>{tt.diaryLoadError ?? 'לא הצלחנו לטעון את העבודות הפרטיות. בדקו את החיבור ונסו שוב.'}</T>
        )}

        {agenda.days.length === 0 ? (
          <View style={[card, { alignItems: 'center' }]}>
            <T style={{ fontSize: 30 }}>🗓️</T>
            <T style={{ fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 21 }}>
              {tt.diaryEmpty ?? 'אין עבודות בשבועיים הקרובים. אפשר להוסיף כאן גם את הלקוחות הפרטיים שלך.'}
            </T>
          </View>
        ) : agenda.days.map(day => (
          <View key={day.date} style={{ gap: 8 }}>
            <T style={{ fontSize: 14, fontWeight: '900', color: C.textDark, textAlign: 'right' }}>{dayLabel(day.date)}</T>
            {day.items.map(it => {
              const tag = it.kind === 'private'
                ? pill(C.grayBg, C.textMid)
                : it.status === 'pending' ? pill(C.orangeBg, C.orange) : pill(C.bluePale, C.blue);
              const tagText = it.kind === 'private'
                ? (tt.diaryPrivateJobs ?? 'פרטי')
                : it.status === 'pending' ? (tt.diaryPending ?? 'ממתין לאישורך')
                : it.status === 'done' ? (tt.diaryDone ?? 'הושלם')
                : (tt.diaryAppJobs ?? 'דרך האפליקציה');
              return (
                <TouchableOpacity
                  key={it.kind + it.id}
                  accessibilityRole="button"
                  disabled={it.kind !== 'private'}
                  onPress={() => openEdit(it)}
                  style={[card, { padding: 12, gap: 4 }]}
                >
                  <View style={row}>
                    <T style={{ fontSize: 15, fontWeight: '900', color: C.textDark }}>{it.startTime}–{endTime(it.startTime, it.hours)}</T>
                    <T style={tag}>{tagText}</T>
                  </View>
                  <View style={row}>
                    <T style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.textDark, textAlign: 'right' }} numberOfLines={1}>
                      {it.title || '—'}{it.place ? ` · ${it.place}` : ''}
                    </T>
                    {it.price != null && <T style={{ fontSize: 14, fontWeight: '800', color: C.blue }}>₪{it.price}</T>}
                  </View>
                  {it.kind === 'private' && it.visit?.repeat !== 'once' && (
                    <T style={{ fontSize: 12, color: C.textSub, textAlign: 'right' }}>
                      🔁 {it.visit?.repeat === 'biweekly' ? (tt.diaryBiweekly ?? 'כל שבועיים') : (tt.diaryWeekly ?? 'כל שבוע')}
                    </T>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <T style={{ fontSize: 12, color: C.textSub, textAlign: 'right', lineHeight: 18 }}>
          {tt.diaryPrivateNote ?? 'עבודות פרטיות נראות רק לך. השעות שלהן נחסמות להזמנות חדשות באפליקציה, כדי שלא יזמינו אותך לשעה תפוסה.'}
        </T>
      </ScrollView>

      {/* Add or edit a private job. */}
      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.white, borderTopStartRadius: 24, borderTopEndRadius: 24, maxHeight: '92%' }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 6 }} keyboardShouldPersistTaps="handled">
              {form && (
                <>
                  <T style={{ fontSize: 18, fontWeight: '900', color: C.textDark, textAlign: 'center', marginBottom: 4 }}>
                    {form.id ? (tt.diaryFormEdit ?? 'עריכת עבודה פרטית') : (tt.diaryFormNew ?? 'עבודה פרטית חדשה')}
                  </T>
                  <Label C={C}>{tt.diaryClientName ?? 'שם הלקוח'}</Label>
                  <TextInput style={input} value={form.clientName} maxLength={80} onChangeText={v => setForm(f => f && { ...f, clientName: v })} />
                  <Label C={C}>{form.repeat === 'once' ? (t.dateLabel || 'תאריך') : (tt.diaryFirstDate ?? 'תאריך הביקור הראשון')}</Label>
                  <Stepper C={C} value={`${dayLabel(form.date)}`} onMinus={() => setForm(f => f && { ...f, date: addDays(f.date, -1) })} onPlus={() => setForm(f => f && { ...f, date: addDays(f.date, 1) })} />
                  <Label C={C}>{tt.diaryStart ?? 'שעת התחלה'}</Label>
                  <Stepper C={C} value={form.startTime} onMinus={() => setForm(f => f && { ...f, startTime: shiftTime(f.startTime, -30) })} onPlus={() => setForm(f => f && { ...f, startTime: shiftTime(f.startTime, 30) })} />
                  <Label C={C}>{t.hoursLabel || 'מספר שעות'}</Label>
                  <Stepper C={C} value={hoursText(form.hours)} onMinus={() => setForm(f => f && { ...f, hours: Math.max(0.5, f.hours - 0.5) })} onPlus={() => setForm(f => f && { ...f, hours: Math.min(12, (24 * 60 - minutesOf(f.startTime)) / 60, f.hours + 0.5) })} />
                  <Label C={C}>{tt.diaryRepeat ?? 'תדירות'}</Label>
                  <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                    {(['once', 'weekly', 'biweekly'] as DiaryRepeat[]).map(r => (
                      <TouchableOpacity key={r} accessibilityRole="button" accessibilityState={{ selected: form.repeat === r }} onPress={() => setForm(f => f && { ...f, repeat: r })}
                        style={{ flex: 1, borderRadius: 999, borderWidth: 1.5, borderColor: form.repeat === r ? C.blue : C.blueBorder, backgroundColor: form.repeat === r ? C.bluePale : C.white, paddingVertical: 9, alignItems: 'center' }}>
                        <T style={{ fontSize: 13, fontWeight: '800', color: form.repeat === r ? C.blue : C.textDark }}>
                          {r === 'once' ? (tt.diaryOnce ?? 'חד-פעמי') : r === 'weekly' ? (tt.diaryWeekly ?? 'כל שבוע') : (tt.diaryBiweekly ?? 'כל שבועיים')}
                        </T>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Label C={C}>{tt.diaryPrice ?? 'מחיר לביקור ₪ (לא חובה)'}</Label>
                  <TextInput style={input} value={form.price} keyboardType="numeric" maxLength={6} onChangeText={v => setForm(f => f && { ...f, price: v })} />
                  <Label C={C}>{tt.diaryAddress ?? 'כתובת (לא חובה)'}</Label>
                  <TextInput style={input} value={form.address} maxLength={200} onChangeText={v => setForm(f => f && { ...f, address: v })} />
                  <Label C={C}>{tt.diaryPhone ?? 'טלפון (לא חובה)'}</Label>
                  <TextInput style={input} value={form.phone} keyboardType="phone-pad" maxLength={30} onChangeText={v => setForm(f => f && { ...f, phone: v })} />
                  <Label C={C}>{tt.diaryNotes ?? 'הערות (לא חובה)'}</Label>
                  <TextInput style={[input, { minHeight: 64, textAlignVertical: 'top' }]} multiline value={form.notes} maxLength={500} onChangeText={v => setForm(f => f && { ...f, notes: v })} />
                  {!!formError && <T style={{ fontSize: 13, color: C.error, textAlign: 'right', marginTop: 6 }} accessibilityLiveRegion="polite">{formError}</T>}
                  <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={save} style={{ backgroundColor: saving ? C.textSub : C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 }}>
                    <T style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>{saving ? '…' : (tt.diarySave ?? 'שמירה')}</T>
                  </TouchableOpacity>
                  {!!form.id && form.repeat !== 'once' && !!form.occurrence && (
                    <TouchableOpacity accessibilityRole="button" onPress={skipOne} style={{ borderRadius: 14, borderWidth: 1.5, borderColor: C.blueBorder, paddingVertical: 12, alignItems: 'center', marginTop: 6 }}>
                      <T style={{ fontSize: 14, fontWeight: '800', color: C.textDark }}>
                        {String(tt.diarySkipOne ?? 'רק הביקור של {date} לא מתקיים').replace('{date}', formatJobDate(form.occurrence))}
                      </T>
                    </TouchableOpacity>
                  )}
                  {!!form.id && (
                    <TouchableOpacity accessibilityRole="button" onPress={remove} style={{ paddingVertical: 12, alignItems: 'center' }}>
                      <T style={{ fontSize: 14, fontWeight: '800', color: C.error }}>🗑️ {tt.diaryDelete ?? 'מחיקה'}</T>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity accessibilityRole="button" onPress={() => setForm(null)} style={{ paddingVertical: 10, alignItems: 'center' }}>
                    <T style={{ fontSize: 14, color: C.textSub, fontWeight: '700' }}>{t.cancel}</T>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

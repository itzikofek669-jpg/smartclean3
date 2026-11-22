// "התפנה לי מקום" — the cleaner's window for putting up room this week
// (Ofek, 21.11.2026). Two spots, each filled or empty, so the limit shows in
// the layout itself; a row of the coming seven days and two hour steppers to
// add or edit one; a pencil and a bin on each. The rules and the meaning of
// "taken" and "over" live in lib/freeSlots; the website has the same window
// (src/components/FreeSlotSheet.tsx).
import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isRtlNow } from './trNow';
import { logError } from './logError';
import { useLanguage, useAppColors, T } from './LanguageContext';
import {
  activeFreeSlots, freeSlotDays, freeSlotProblem, suggestFreeSlot, FREE_SLOT_MAX, hhmm, type FreeSlot,
} from './freeSlots';

/** The feature's own colour: the logo's turquoise, apart from the board's blue and urgent's purple. */
export const FREE_TEAL = '#0B8796';
export const FREE_TEAL_BG = '#E0F4F6';
export const FREE_TEAL_TEXT = '#075E69';

/** "ג׳ 24/11" in the current language. */
export function freeDayLabel(t: any, ymd: string, withDate = true): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const names: string[] = t.dayNamesShort || ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const name = names[new Date(y, m - 1, d).getDay()] || '';
  return withDate ? `${name} ${d}/${m}` : name;
}

/**
 * "ג׳ 24/11 · 09:00–13:00". The hours are isolated left to right: inside a
 * Hebrew line the range otherwise reads "13:00–09:00".
 */
export function freeWhen(t: any, f: FreeSlot): string {
  return `${freeDayLabel(t, f.date)} · \u2066${hhmm(f.s)}–${hhmm(f.e)}\u2069`;
}

type Mine = { freeSlots?: unknown; busySlots?: unknown; pendingSlots?: unknown; availability?: unknown; availabilitySet?: unknown } | null;

const newId = () => Math.random().toString(36).slice(2, 10);

/** Where a new window opens: the next whole hour today with three hours left, else tomorrow at nine. */
// Inside her working hours (lib/freeSlots suggestFreeSlot).
function defaultDraft(now: Date, mine: Mine): { date: string; s: number; e: number } {
  return suggestFreeSlot(now, { availability: mine?.availability, availabilitySet: mine?.availabilitySet });
}

function Stepper({ value, onMinus, onPlus, C, label }: { value: string; onMinus: () => void; onPlus: () => void; C: any; label: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', direction: 'ltr', alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder, borderRadius: 12, overflow: 'hidden' }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label} −`} onPress={onMinus} style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: FREE_TEAL_BG }}>
        <T style={{ fontSize: 18, fontWeight: '900', color: FREE_TEAL }}>−</T>
      </TouchableOpacity>
      <T style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.textDark }}>{value}</T>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label} +`} onPress={onPlus} style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: FREE_TEAL_BG }}>
        <T style={{ fontSize: 18, fontWeight: '900', color: FREE_TEAL }}>+</T>
      </TouchableOpacity>
    </View>
  );
}

export default function FreeSlotSheet({ visible, onClose, uid, mine }: {
  visible: boolean;
  onClose: () => void;
  uid: string;
  mine: Mine;
}) {
  const { t } = useLanguage();
  const tt = t as any;
  const C = useAppColors();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const active = useMemo(
    () => activeFreeSlots(mine?.freeSlots, mine?.busySlots, mine?.pendingSlots, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mine?.freeSlots, mine?.busySlots, mine?.pendingSlots, visible],
  );
  const days = freeSlotDays(now);

  // The window being added ('' id) or edited; null while none is open.
  const [draft, setDraft] = useState<{ id: string; date: string; s: number; e: number; createdAt?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Nothing up yet: the editor is simply open.
  const editing = draft ?? (active.length === 0 ? { id: '', ...defaultDraft(now, mine) } : null);

  const close = () => { setDraft(null); setError(''); onClose(); };
  const set = (patch: Partial<{ date: string; s: number; e: number }>) => {
    setError('');
    setDraft({ ...(editing as NonNullable<typeof editing>), ...patch });
  };

  const problemText: Record<string, string> = {
    full: tt.freeErrFull ?? 'כבר פרסמת 2 מקומות. כשאחד נתפס או עובר — אפשר לפרסם עוד.',
    day: tt.freeErrDay ?? 'אפשר לפרסם רק לשבוע הקרוב',
    time: tt.freeErrTime ?? 'בחרו לפחות שעה אחת',
    past: tt.freeErrPast ?? 'השעה הזאת כבר עברה',
    overlap: tt.freeErrOverlap ?? 'השעות האלה כבר מפורסמות',
    busy: tt.freeErrBusy ?? 'בשעות האלה כבר יש לך עבודה',
    dayOff: tt.freeErrDayOff ?? 'זה יום חופש לפי שעות העבודה שלך',
    offHours: tt.freeErrOffHours ?? 'השעות האלה מחוץ לשעות העבודה שלך',
  };

  const save = async () => {
    if (!editing || saving || !uid) return;
    const slot: FreeSlot = {
      id: editing.id || newId(), date: editing.date, s: editing.s, e: editing.e,
      createdAt: editing.createdAt || new Date().toISOString(),
    };
    const others = active.filter((f) => f.id !== slot.id);
    const problem = freeSlotProblem(slot, others, mine?.busySlots, mine?.pendingSlots, new Date(),
      { availability: mine?.availability, availabilitySet: mine?.availabilitySet });
    if (problem) { setError(problemText[problem]); return; }
    setSaving(true);
    try {
      // Written whole: what is taken or over drops out with this save.
      await updateDoc(doc(db, 'users', uid), { freeSlots: [...others, slot] });
      setDraft(null);
      setError('');
    } catch (err) {
      logError('freeSlots:save', err);
      setError(tt.freeSaveFailed ?? 'הפרסום נכשל. בדקו את החיבור ונסו שוב.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (f: FreeSlot) => {
    Alert.alert('', tt.freeDeleteConfirm ?? 'להסיר את המקום הפנוי מהפרסום?', [
      { text: t.cancel, style: 'cancel' },
      {
        text: tt.freeDelete ?? 'הסרה', style: 'destructive', onPress: async () => {
          try {
            await updateDoc(doc(db, 'users', uid), { freeSlots: active.filter((x) => x.id !== f.id) });
            if (draft?.id === f.id) setDraft(null);
          } catch (err) {
            logError('freeSlots:remove', err);
            setError(tt.freeSaveFailed ?? 'הפרסום נכשל. בדקו את החיבור ונסו שוב.');
          }
        },
      },
    ]);
  };

  const spot = (n: number) => {
    const f = active[n];
    if (f) {
      return (
        <View key={f.id} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: FREE_TEAL_BG, borderWidth: 1.5, borderColor: draft?.id === f.id ? FREE_TEAL_TEXT : FREE_TEAL }}>
          <T style={{ fontSize: 12, fontWeight: '900', color: FREE_TEAL_TEXT, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 7, overflow: 'hidden' }}>{n + 1}</T>
          <T style={{ flex: 1, fontSize: 14, fontWeight: '800', color: FREE_TEAL_TEXT, textAlign: 'right' }}>{freeWhen(t, f)}</T>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={tt.freeEdit ?? 'עריכה'} onPress={() => { setError(''); setDraft({ ...f }); }} hitSlop={8}>
            <MaterialIcons name="edit" size={20} color={FREE_TEAL_TEXT} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={tt.freeDelete ?? 'הסרה'} onPress={() => remove(f)} hitSlop={8}>
            <MaterialIcons name="delete-outline" size={21} color="#B91C1C" />
          </TouchableOpacity>
        </View>
      );
    }
    const isOpen = !!editing && !editing.id && (draft !== null || active.length === 0) && n === active.length;
    return (
      <TouchableOpacity
        key={`empty${n}`}
        accessibilityRole="button"
        disabled={n !== active.length}
        onPress={() => { setError(''); setDraft({ id: '', ...defaultDraft(new Date(), mine) }); }}
        style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: isOpen ? FREE_TEAL : C.blueBorder, opacity: n === active.length ? 1 : 0.5 }}
      >
        <T style={{ fontSize: 12, fontWeight: '900', color: C.textSub, backgroundColor: C.grayBg, borderRadius: 10, paddingHorizontal: 7, overflow: 'hidden' }}>{n + 1}</T>
        <MaterialIcons name="add" size={18} color={C.textSub} />
        <T style={{ fontSize: 14, fontWeight: '700', color: C.textSub }}>{tt.freeAddAnother ?? 'מקום פנוי נוסף'}</T>
      </TouchableOpacity>
    );
  };

  const spotNumber = editing ? (editing.id ? active.findIndex((f) => f.id === editing.id) + 1 : active.length + 1) : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.white, borderTopStartRadius: 24, borderTopEndRadius: 24, maxHeight: '92%' }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20, gap: 12 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="edit-calendar" size={24} color={FREE_TEAL} />
              <T style={{ flex: 1, fontSize: 18, fontWeight: '900', color: C.textDark, textAlign: 'right' }}>{tt.freeBtn ?? 'התפנה לי מקום'}</T>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t.closeBtn || 'סגור'} onPress={close} hitSlop={10}>
                <MaterialIcons name="close" size={24} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <T style={{ fontSize: 13, color: C.textSub, textAlign: 'right', lineHeight: 20 }}>
              {tt.freeSheetExplain ?? 'לקוחות באזור יראו שהתפנה לך מקום השבוע, ויוכלו להזמין אותך ישר לשעה הזאת.'}
            </T>

            {Array.from({ length: FREE_SLOT_MAX }, (_, n) => spot(n))}
            <T style={{ fontSize: 12, color: C.textSub, textAlign: 'right', lineHeight: 18 }}>
              {tt.freeLimitNote ?? 'אפשר לפרסם עד 2 מקומות. כשמקום נתפס, מתבטל או שהשעה עוברת — אפשר לפרסם מקום חדש.'}
            </T>

            {editing && (
              <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: C.grayBorder, paddingTop: 12 }}>
                <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
                  {days.map((d) => {
                    const on = editing.date === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => set({ date: d })}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, borderWidth: on ? 1.5 : 1, borderColor: on ? FREE_TEAL : C.blueBorder, backgroundColor: on ? FREE_TEAL_BG : C.white }}
                      >
                        <T style={{ fontSize: 11, color: on ? FREE_TEAL_TEXT : C.textSub }}>{freeDayLabel(t, d, false)}</T>
                        <T style={{ fontSize: 15, fontWeight: '800', color: on ? FREE_TEAL_TEXT : C.textDark }}>{Number(d.slice(8, 10))}</T>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <Stepper C={C} label={tt.freeStart ?? 'שעת התחלה'} value={hhmm(editing.s)}
                    onMinus={() => set({ s: Math.max(0, editing.s - 60) })}
                    onPlus={() => set({ s: Math.min(editing.e - 60, editing.s + 60) })} />
                  {/* From start to end: ← in he/ar, → where the steppers read left to right (audit 22.11.2026). */}
                  <MaterialIcons name={isRtlNow() ? 'arrow-back' : 'arrow-forward'} size={18} color={C.textSub} />
                  <Stepper C={C} label={tt.freeEnd ?? 'שעת סיום'} value={hhmm(editing.e)}
                    onMinus={() => set({ e: Math.max(editing.s + 60, editing.e - 60) })}
                    onPlus={() => set({ e: Math.min(24 * 60, editing.e + 60) })} />
                </View>
                {!!error && <T style={{ fontSize: 13, color: '#B91C1C', textAlign: 'right' }} accessibilityLiveRegion="polite">{error}</T>}
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={save}
                  style={{ backgroundColor: saving ? C.textSub : FREE_TEAL, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                >
                  <T style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>
                    {saving ? '…' : editing.id
                      ? (tt.freeSave ?? 'שמירה')
                      : String(tt.freePublish ?? 'פרסום מקום {n}').replace('{n}', String(spotNumber))}
                  </T>
                </TouchableOpacity>
                {draft !== null && active.length > 0 && (
                  <TouchableOpacity accessibilityRole="button" onPress={() => { setDraft(null); setError(''); }} style={{ alignItems: 'center', paddingVertical: 6 }}>
                    <T style={{ fontSize: 14, color: C.textSub, fontWeight: '700' }}>{t.cancel}</T>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {!editing && !!error && <T style={{ fontSize: 13, color: '#B91C1C', textAlign: 'right' }}>{error}</T>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


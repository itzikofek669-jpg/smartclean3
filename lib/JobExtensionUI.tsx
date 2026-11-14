import React, { useState } from 'react';
import { Alert, Modal, TouchableOpacity, View } from 'react-native';
import { T, useAppColors, useLanguage } from './LanguageContext';
import { trNow } from './trNow';
import { logError } from './logError';
import {
  EXTENSION_LIVE, canAskForExtension, extensionOptions, extensionTotal, lastExtensionAnswer,
  pendingExtension, type ExtensionRequest,
} from './bookingAmount';
import { answerExtension, ExtensionChangedError, requestExtension, withdrawExtension } from './jobExtension';

/**
 * More time, with the client's approval — what each side sees of it.
 *
 *   • On a job's card (app/profile.tsx renderBookingCard): the provider's
 *     "ask for more time" and her request while it waits, or the client's
 *     answer; the client's approve / decline; and on an extended job, what it
 *     was first agreed at.
 *   • On the home screen, the client's question as a sheet (ExtensionAskSheet)
 *     — the push may not arrive, and the card is a screen away.
 *
 * The rules of it are the shared lib/bookingAmount; the writes lib/jobExtension.
 * The website shows the same: src/components/JobExtension.tsx.
 *
 * Drawn right to left like the rest of the app (row-reverse, the mirrored root
 * turns it round for the left-to-right languages). Each line carries its
 * language's writing direction: a Hebrew name opening an English line would
 * otherwise turn the whole line right to left.
 */

const hoursText = (h: number) => String(Math.round(h * 100) / 100);

/** The client's question: who asks for how long, the new total, approve / decline. */
export function ExtensionAnswerBox({ b, req, onAnswered, onLater }: {
  b: any; req: ExtensionRequest; onAnswered?: () => void; onLater?: () => void;
}) {
  const C = useAppColors();
  const { isRTL } = useLanguage();
  const [busy, setBusy] = useState(false);
  const dir = { writingDirection: isRTL ? 'rtl' : 'ltr' } as const;
  const answer = async (approve: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await answerExtension(b.id, req, approve);
      onAnswered?.();
    } catch (err) {
      if (err instanceof ExtensionChangedError) {
        Alert.alert(trNow('extAskTitle'), trNow('extChanged'));
        onAnswered?.();
      } else {
        logError('extension:answer', err);
        Alert.alert(trNow('extAskTitle'), trNow('extAnswerFailed'));
      }
    } finally {
      setBusy(false);
    }
  };
  const btn = { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' as const, opacity: busy ? 0.6 : 1 };
  return (
    <View style={{ backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', borderRadius: 14, padding: 12, gap: 6 }}>
      <T style={{ fontSize: 14, fontWeight: '900', color: '#9A3412', ...dir }}>{trNow('extAskTitle')}</T>
      <T style={{ fontSize: 13, color: '#7C2D12', ...dir }}>
        {trNow('extAskBody', { name: b.cleanerName || trNow('extProviderWord'), h: hoursText(req.hours) })}
      </T>
      <T style={{ fontSize: 13, fontWeight: '800', color: '#7C2D12', ...dir }}>
        {trNow('extAskTotals', { total: req.total, was: Number(b.total) || 0 })}
      </T>
      <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 4 }}>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => answer(true)} style={[btn, { backgroundColor: C.green }]}>
          <T style={{ fontSize: 14, fontWeight: '800', color: '#fff', textAlign: 'center' }}>{trNow('extApproveBtn')}</T>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => answer(false)} style={[btn, { backgroundColor: C.white, borderWidth: 1, borderColor: '#FDBA74' }]}>
          <T style={{ fontSize: 14, fontWeight: '700', color: '#9A3412', textAlign: 'center' }}>{trNow('extDeclineBtn')}</T>
        </TouchableOpacity>
      </View>
      {onLater && (
        <TouchableOpacity accessibilityRole="button" onPress={onLater} style={{ alignItems: 'center', paddingVertical: 6 }}>
          <T style={{ fontSize: 13, color: C.textSub, textAlign: 'center' }}>{trNow('extLaterBtn')}</T>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** The provider's choice of how much more time, and "send to the client". */
function ExtensionPicker({ b, open, onClose }: { b: any; open: boolean; onClose: () => void }) {
  const C = useAppColors();
  const { isRTL } = useLanguage();
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const dir = { writingDirection: isRTL ? 'rtl' : 'ltr' } as const;
  const options = extensionOptions(b);
  const close = () => { setPick(null); onClose(); };
  const send = async () => {
    if (pick == null || busy) return;
    setBusy(true);
    try {
      const asked = await requestExtension(b.id, pick);
      Alert.alert(trNow('extPickTitle'), trNow(asked ? 'extSent' : 'extFailed'));
      if (asked) close();
    } catch (err) {
      logError('extension:request', err);
      Alert.alert(trNow('extPickTitle'), trNow('extFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.white, borderTopStartRadius: 24, borderTopEndRadius: 24, padding: 22, paddingBottom: 36, gap: 12 }}>
          <T style={{ fontSize: 18, fontWeight: '900', color: C.textDark, ...dir }}>{trNow('extPickTitle')}</T>
          <T style={{ fontSize: 13, color: C.textSub, ...dir }}>
            {trNow('extPickSub', { h: hoursText(Number(b.hours) || 0), total: Number(b.total) || 0 })}
          </T>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
            {options.map(h => {
              const on = pick === h;
              return (
                <TouchableOpacity
                  key={h}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setPick(h)}
                  style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5,
                    borderColor: on ? C.blue : C.blueBorder, backgroundColor: on ? C.blueLight : C.white }}
                >
                  <T style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? C.blue : C.textDark, ...dir }}>
                    {trNow('extOptionLabel', { h: hoursText(h), total: extensionTotal(b, h) })}
                  </T>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={pick == null || busy}
            onPress={send}
            style={{ backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: pick == null || busy ? 0.5 : 1 }}
          >
            <T style={{ fontSize: 15, fontWeight: '900', color: '#fff', textAlign: 'center' }}>{busy ? '…' : trNow('extSendBtn')}</T>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={close} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <T style={{ fontSize: 14, color: C.textSub, textAlign: 'center' }}>{trNow('cancel')}</T>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Everything of the extension on one job's card, for whichever side is looking.
 * `allowAsk`: the card's own judgement — no new request on a job from a day
 * that has already gone.
 */
export function ExtensionStrip({ b, forCleaner, allowAsk = true }: { b: any; forCleaner: boolean; allowAsk?: boolean }) {
  const C = useAppColors();
  const { isRTL } = useLanguage();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const dir = { writingDirection: isRTL ? 'rtl' : 'ltr' } as const;
  const pending = pendingExtension(b);
  const live = EXTENSION_LIVE.includes(String(b?.status));
  const answer = forCleaner && live ? lastExtensionAnswer(b) : null;
  // Extended: hours above the first agreed ones. Said on both sides, finished
  // jobs included — it explains a total above what was booked.
  const extraHours = typeof b?.origHours === 'number' && typeof b?.hours === 'number' ? b.hours - b.origHours : 0;
  const included = extraHours > 0 && typeof b?.origTotal === 'number' && !(answer?.status === 'approved');
  const canAsk = forCleaner && allowAsk && canAskForExtension(b);
  if (!pending && !answer && !included && !canAsk) return null;

  const note = (text: string, bg: string, fg: string) => (
    <View style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
      <T style={{ fontSize: 12, fontWeight: '700', color: fg, ...dir }}>{text}</T>
    </View>
  );
  const withdraw = async () => {
    if (busy) return;
    setBusy(true);
    try { await withdrawExtension(b.id); } catch (err) {
      logError('extension:withdraw', err);
      Alert.alert(trNow('extPickTitle'), trNow('extFailed'));
    } finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 8 }}>
      {included && note(trNow('extIncluded', { h: hoursText(extraHours), was: b.origTotal }), C.blueLight, C.blue)}
      {answer?.status === 'approved' && note(trNow('extApprovedNote', { h: hoursText(answer.hours), total: answer.total }), '#D1FAE5', '#065F46')}
      {answer?.status === 'declined' && note(trNow('extDeclinedNote', { total: answer.total }), '#FEE2E2', '#991B1B')}
      {pending && !forCleaner && <ExtensionAnswerBox b={b} req={pending} />}
      {pending && forCleaner && (
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
          <T style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#92400E', ...dir }}>
            {trNow('extPendingCleaner', { h: hoursText(pending.hours), total: pending.total })}
          </T>
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={withdraw}
            style={{ borderWidth: 1, borderColor: '#D97706', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, opacity: busy ? 0.5 : 1 }}>
            <T style={{ fontSize: 12, fontWeight: '700', color: '#92400E' }}>{trNow('extWithdrawBtn')}</T>
          </TouchableOpacity>
        </View>
      )}
      {canAsk && (
        <TouchableOpacity accessibilityRole="button" onPress={() => setPicking(true)}
          style={{ borderWidth: 1.5, borderColor: C.blue, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
          <T style={{ fontSize: 14, fontWeight: '800', color: C.blue, textAlign: 'center' }}>{trNow('extAskBtn')}</T>
        </TouchableOpacity>
      )}
      {canAsk && <ExtensionPicker b={b} open={picking} onClose={() => setPicking(false)} />}
    </View>
  );
}

/**
 * The client's question on the home screen: the first live booking of hers
 * with a request waiting. "Later" puts that request away for this session; a
 * new request (a new time stamp) asks again.
 */
export function ExtensionAskSheet({ bookings, suspended = false }: { bookings: any[]; suspended?: boolean }) {
  const C = useAppColors();
  const [later, setLater] = useState<string[]>([]);
  const keyOf = (b: any, r: ExtensionRequest) => `${b.id}:${r.at}`;
  const b = bookings.find(x => { const r = pendingExtension(x); return r && !later.includes(keyOf(x, r)); });
  const req = b ? pendingExtension(b) : null;
  const putAway = () => { if (b && req) setLater(l => [...l, keyOf(b, req)]); };
  // `suspended`: another sheet of the home screen is up — two modals at once
  // show only one on iOS. This one waits its turn.
  return (
    <Modal visible={!!(b && req) && !suspended} transparent animationType="slide" onRequestClose={putAway}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.white, borderTopStartRadius: 24, borderTopEndRadius: 24, padding: 20, paddingBottom: 36 }}>
          {b && req && <ExtensionAnswerBox b={b} req={req} onAnswered={putAway} onLater={putAway} />}
        </View>
      </View>
    </Modal>
  );
}

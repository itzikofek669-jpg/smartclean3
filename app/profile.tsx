import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Modal, Switch, Share, Linking,
  TextInput, KeyboardAvoidingView, Platform, BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, where, getDocs, orderBy, arrayRemove, arrayUnion, onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useLanguage } from '../lib/LanguageContext';
import { Lang } from '../lib/translations';
import { useTheme } from '../lib/ThemeContext';


const C = {
  blue:       '#185FA5',
  blueDark:   '#0D4F96',
  blueLight:  '#E6F1FB',
  bluePale:   '#F4F8FD',
  blueBorder: '#B5D4F4',
  textDark:   '#042C53',
  textMid:    '#378ADD',
  textSub:    '#6B9DC2',
  green:      '#10B981',
  greenBg:    '#D1FAE5',
  gold:       '#F59E0B',
  orange:     '#F97316',
  orangeBg:   '#FEF3C7',
  white:      '#FFFFFF',
  error:      '#EF4444',
};

const PAY_ICONS: Record<string, string> = { card: '💳', bit: '📱', cash: '💵' };

const DAYS_KEYS = ['sun','mon','tue','wed','thu','fri','sat'] as const;

async function sendPushNotification(token: string, title: string, body: string) {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token, title, body,
        sound: 'default',
        channelId: 'messages',
        priority: 'high',
      }),
    });
  } catch (_) {}
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function calcDuration(startIso: string, endIso: string): string {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMins = Math.round(diffMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m} דק'`;
  if (m === 0) return `${h} שע'`;
  return `${h}:${String(m).padStart(2,'0')} שע'`;
}

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1,2,3,4,5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange(i)}>
          <Text style={{ fontSize: 30, color: i <= value ? C.gold : C.blueBorder }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Rate Modal ───────────────────────────────────────────────────────────────
function RateModal({ booking, visible, isCleaner, onClose, onSubmit }: any) {
  const { t } = useLanguage();
  const [stars, setStars] = useState(0);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rm.backdrop}>
        <View style={rm.card}>
          <Text style={rm.title}>{isCleaner ? t.rateCleanerLbl : t.rateTitle}</Text>
          <Text style={rm.sub}>{isCleaner ? booking?.clientName : booking?.cleanerName}</Text>
          <StarPicker value={stars} onChange={setStars} />
          <View style={rm.btns}>
            <TouchableOpacity style={rm.skip} onPress={onClose}>
              <Text style={rm.skipTxt}>{t.rateSkip}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rm.submit, !stars && { opacity: 0.5 }]}
              disabled={!stars}
              onPress={() => { onSubmit(stars); setStars(0); }}
            >
              <Text style={rm.submitTxt}>{t.rateSubmit}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:     { backgroundColor: C.white, borderRadius: 20, padding: 24, width: '100%', alignItems: 'center', gap: 14 },
  title:    { fontSize: 18, fontWeight: '900', color: C.textDark },
  sub:      { fontSize: 14, color: C.textSub, marginBottom: 4 },
  btns:     { flexDirection: 'row', gap: 12, marginTop: 4, width: '100%' },
  skip:     { flex: 1, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: C.blueBorder, alignItems: 'center' },
  skipTxt:  { color: C.textSub, fontWeight: '600' },
  submit:   { flex: 2, padding: 13, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center' },
  submitTxt:{ color: C.white, fontWeight: '800' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { tab, requestId } = useLocalSearchParams<{ tab?: string; requestId?: string }>();
  const { t, setLang } = useLanguage();
  const { dark, toggleDark } = useTheme();

  const uid    = auth.currentUser?.uid || '';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, []);

  const [userName,     setUserName]     = useState('');
  const [userEmail,    setUserEmail]    = useState('');
  const [userRole,     setUserRole]     = useState('');
  const [photoB64,     setPhotoB64]     = useState<string | null>(null);
  const [workAreas,    setWorkAreas]    = useState<string[]>([]);
  const [areasSaved,   setAreasSaved]   = useState(false);
  const [availability, setAvailability] = useState<Record<string, { active: boolean; start: number; end: number }>>({});
  const [availSaved,   setAvailSaved]   = useState(false);
  const [showPhone,    setShowPhone]    = useState(true);
  const [bookings,     setBookings]     = useState<any[]>([]);
  const [incomingBks,  setIncomingBks]  = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [rateTarget,   setRateTarget]   = useState<any>(null);
  const [rateModal,    setRateModal]    = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [portfolio,    setPortfolio]    = useState<string[]>([]);
  const [idVerified,   setIdVerified]   = useState(false);
  const [prefLang,     setPrefLang]     = useState('he');
  const [userPhone,    setUserPhone]    = useState('');

  // Tabs (cleaner): 'bookings' | 'schedule' | 'profile' | 'urgent'
  const [activeTab,    setActiveTab]    = useState<'bookings' | 'schedule' | 'profile' | 'urgent'>('bookings');

  // פתח לשונית urgent אם הגיע מקישור וואצאפ
  useEffect(() => {
    if (tab === 'urgent') setActiveTab('urgent');
  }, [tab]);

  // Urgent requests
  const [urgentRequests, setUrgentRequests] = useState<any[]>([]);

  // Edit profile modal
  const [editOpen,         setEditOpen]         = useState(false);
  const [editName,         setEditName]         = useState('');
  const [editCity,         setEditCity]         = useState('');
  const [editPhone,        setEditPhone]        = useState('');
  const [editBio,          setEditBio]          = useState('');
  const [editPrice,        setEditPrice]        = useState('');
  const [editTypes,        setEditTypes]        = useState<string[]>([]);
  const [editPayment,      setEditPayment]      = useState<string[]>([]);
  const [editWorkAreas,    setEditWorkAreas]    = useState<string[]>([]);
  const [editBringSupplies,setEditBringSupplies]= useState(true);
  const [editIsMobile,     setEditIsMobile]     = useState(true);
  const [editMaxDistance,  setEditMaxDistance]  = useState('');
  const [editServicePricing,setEditServicePricing]= useState<Record<string,string>>({});
  const [editWhatsappGroupId,setEditWhatsappGroupId]= useState('');
  const [editSaving,       setEditSaving]       = useState(false);

  // Chat from cleaner side
  const [chatClientUid, setChatClientUid] = useState('');
  const [chatClientName,setChatClientName]= useState('');
  const [chatMessages,  setChatMessages]  = useState<any[]>([]);
  const [chatInput,     setChatInput]     = useState('');
  const [chatOpen,      setChatOpen]      = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const chatUnsubRef  = useRef<(() => void) | null>(null);

  // Photo viewer
  const [photoViewerUris, setPhotoViewerUris] = useState<string[]>([]);
  const [photoViewerIdx,  setPhotoViewerIdx]  = useState(0);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  // Report
  const [reportOpen,    setReportOpen]    = useState(false);
  const [reportType,    setReportType]    = useState<'bug' | 'cleaner' | 'client'>('bug');
  const [reportTarget,  setReportTarget]  = useState('');
  const [reportDesc,    setReportDesc]    = useState('');
  const [reportSending, setReportSending] = useState(false);

  const handleSendReport = async () => {
    if (!reportDesc.trim()) return;
    setReportSending(true);
    try {
      await addDoc(collection(db, 'reports'), {
        type: reportType,
        target: reportTarget.trim(),
        description: reportDesc.trim(),
        reportedBy: uid,
        createdAt: new Date().toISOString(),
      });
      Alert.alert('', t.reportSuccess);
      setReportOpen(false);
      setReportTarget('');
      setReportDesc('');
    } catch (_) {
      Alert.alert(t.error, 'שגיאה בשליחת הדיווח');
    } finally {
      setReportSending(false);
    }
  };

  const openEditProfile = async () => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const d = snap.data();
        setEditName(d.name        || '');
        setEditCity(d.city        || '');
        setEditPhone(d.phone      || '');
        setEditBio(d.bio          || '');
        setEditPrice(String(d.price || ''));
        setEditTypes(d.types      || []);
        setEditPayment(d.payment  || []);
        setEditWorkAreas(d.workAreas || []);
        setEditBringSupplies(d.bringSupplies !== false);
        setEditIsMobile(d.isMobile !== false);
        setEditMaxDistance(String(d.maxDistance || ''));
        const sp = d.servicePricing || {};
        const spStr: Record<string,string> = {};
        Object.entries(sp).forEach(([k,v]) => { spStr[k] = String(v); });
        setEditServicePricing(spStr);
        setEditWhatsappGroupId(d.whatsappGroupId || '');
      }
    } catch (_) {}
    setEditOpen(true);
  };

  const saveEditProfile = async () => {
    if (!editName.trim()) return Alert.alert(t.error, 'שם הוא שדה חובה');
    setEditSaving(true);
    try {
      const spNum: Record<string,number> = {};
      Object.entries(editServicePricing).forEach(([k,v]) => { if (v) spNum[k] = Number(v); });
      await updateDoc(doc(db, 'users', uid), {
        name:          editName.trim(),
        city:          editCity.trim(),
        phone:         editPhone.trim(),
        bio:           editBio.trim(),
        price:         Number(editPrice) || 0,
        types:         editTypes,
        payment:       editPayment,
        workAreas:     editWorkAreas,
        bringSupplies: editBringSupplies,
        isMobile:      editIsMobile,
        maxDistance:      Number(editMaxDistance) || 0,
        servicePricing:   spNum,
        whatsappGroupId:  editWhatsappGroupId.trim(),
      });
      setUserName(editName.trim());
      setUserPhone(editPhone.trim());
      setEditOpen(false);
      Alert.alert('✅', 'הפרופיל עודכן בהצלחה!');
    } catch (_) {
      Alert.alert(t.error, 'שגיאה בשמירה, נסה שוב');
    } finally {
      setEditSaving(false);
    }
  };

  const toggleEdit = (arr: string[], setArr: (v: string[]) => void, key: string) => {
    setArr(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key]);
  };

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserName(d.name        || '');
          setUserEmail(d.email      || '');
          setUserRole(d.role        || '');
          setPhotoB64(d.photoB64    || null);
          setWorkAreas(d.workAreas  || []);
          // Load availability — support both old boolean format and new {active,start,end}
          const rawAvail = d.availability || {};
          const parsedAvail: Record<string, { active: boolean; start: number; end: number }> = {};
          for (const key of ['sun','mon','tue','wed','thu','fri','sat']) {
            const v = rawAvail[key];
            if (v && typeof v === 'object') {
              parsedAvail[key] = { active: v.active ?? false, start: v.start ?? 9, end: v.end ?? 18 };
            } else {
              parsedAvail[key] = { active: !!v, start: 9, end: 18 };
            }
          }
          setAvailability(parsedAvail);
          setShowPhone(d.showPhone !== false);
          setPortfolio(d.portfolio || []);
          setIdVerified(d.identityVerified === true);
          const savedLang = (d.preferredLang || 'he') as Lang;
          setPrefLang(savedLang);
          setUserPhone(d.phone || '');
          // Referral code — generate if missing
          let code = d.referralCode || '';
          if (!code) {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
            try { await setDoc(doc(db, 'users', uid), { referralCode: code }, { merge: true }); } catch (_) {}
          }
          setReferralCode(code);
        }
        // Client bookings
        const qClient = query(
          collection(db, 'bookings'),
          where('clientUid', '==', uid),
          orderBy('createdAt', 'desc'),
        );
        const bSnap = await getDocs(qClient);
        setBookings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Cleaner incoming bookings
        const qCleaner = query(
          collection(db, 'bookings'),
          where('cleanerId', '==', uid),
          orderBy('createdAt', 'desc'),
        );
        const cSnap = await getDocs(qCleaner);
        setIncomingBks(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (_) {
      } finally {
        setLoading(false);
      }
    }
    load().then(() => {
      // Fallback: if referralCode still empty after load, generate locally
      setReferralCode(prev => {
        if (prev) return prev;
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        setDoc(doc(db, 'users', uid), { referralCode: code }, { merge: true }).catch(() => {});
        return code;
      });
    });

    // האזן לבקשות דחופות פתוחות (למנקים בלבד — נטענות בזמן אמת)
    let prevUrgentCount = -1; // -1 = first load (don't auto-switch on initial load)
    const urgentUnsub = onSnapshot(
      query(collection(db, 'urgentRequests'), where('status', '==', 'open')),
      snap => {
        const now = new Date();
        const reqs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((r: any) => r.expiresAt && new Date(r.expiresAt) > now);
        setUrgentRequests(reqs);
        // אם הגיעה בקשה חדשה (לא הטעינה הראשונה) — עבור ללשונית דחוף אוטומטית
        if (prevUrgentCount >= 0 && reqs.length > prevUrgentCount) {
          setActiveTab('urgent');
        }
        prevUrgentCount = reqs.length;
      },
    );
    return () => urgentUnsub();
  }, [uid]);

  const pickImage = () => {
    Alert.alert('תמונת פרופיל', 'בחר מקור', [
      {
        text: 'גלריה',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert('נדרשת הרשאה לגישה לגלריה');
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1,1], quality: 0.15, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) saveBase64(res.assets[0].base64);
        },
      },
      {
        text: 'מצלמה',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return Alert.alert('נדרשת הרשאה למצלמה');
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [1,1], quality: 0.15, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) saveBase64(res.assets[0].base64);
        },
      },
      { text: 'ביטול', style: 'cancel' },
    ]);
  };

  const saveBase64 = async (b64: string) => {
    setUploading(true);
    try {
      const dataUri = `data:image/jpeg;base64,${b64}`;
      await setDoc(doc(db, 'users', uid), { photoB64: dataUri }, { merge: true });
      setPhotoB64(dataUri);
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message || 'לא ניתן לשמור תמונה');
    } finally {
      setUploading(false);
    }
  };

  const toggleArea = async (area: string) => {
    const next = workAreas.includes(area)
      ? workAreas.filter(a => a !== area)
      : [...workAreas, area];
    setWorkAreas(next);
    await setDoc(doc(db, 'users', uid), { workAreas: next }, { merge: true });
    setAreasSaved(true);
    setTimeout(() => setAreasSaved(false), 2000);
  };

  const toggleDay = async (day: string) => {
    const cur = availability[day] || { active: false, start: 9, end: 18 };
    const next = { ...availability, [day]: { ...cur, active: !cur.active } };
    setAvailability(next);
    await setDoc(doc(db, 'users', uid), { availability: next }, { merge: true });
    setAvailSaved(true);
    setTimeout(() => setAvailSaved(false), 2000);
  };

  const updateDayHours = async (day: string, type: 'start' | 'end', delta: number) => {
    const cur = availability[day] || { active: true, start: 9, end: 18 };
    let val = (cur[type] ?? (type === 'start' ? 9 : 18)) + delta;
    val = Math.max(6, Math.min(23, val));
    if (type === 'start' && val >= cur.end) return;
    if (type === 'end'   && val <= cur.start) return;
    const next = { ...availability, [day]: { ...cur, [type]: val } };
    setAvailability(next);
    await setDoc(doc(db, 'users', uid), { availability: next }, { merge: true });
    setAvailSaved(true);
    setTimeout(() => setAvailSaved(false), 2000);
  };

  const toggleShowPhone = async (val: boolean) => {
    setShowPhone(val);
    await setDoc(doc(db, 'users', uid), { showPhone: val }, { merge: true });
  };

  // ─── Upload before/after photo ───────────────────────────────────────────────
  const uploadJobPhoto = (bookingId: string, type: 'before' | 'after') => {
    const field = type === 'before' ? 'beforePhotos' : 'afterPhotos';
    const doUpload = async (source: 'gallery' | 'camera') => {
      const picker = source === 'gallery'
        ? async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return Alert.alert('שגיאה', 'נדרשת הרשאה לגלריה');
            return ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4,3], quality: 0.1, base64: true });
          }
        : async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return Alert.alert('שגיאה', 'נדרשת הרשאה למצלמה');
            return ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4,3], quality: 0.1, base64: true });
          };
      const res = await picker();
      if (!res || res.canceled || !res.assets[0].base64) return;
      const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
      try {
        const bSnap = await getDoc(doc(db, 'bookings', bookingId));
        const current: string[] = bSnap.data()?.[field] || [];
        const updated = [...current, uri];
        await updateDoc(doc(db, 'bookings', bookingId), { [field]: updated });
        const upd = (prev: any[]) => prev.map(b => b.id === bookingId ? { ...b, [field]: updated } : b);
        setBookings(upd); setIncomingBks(upd);
      } catch (e: any) { Alert.alert('שגיאה', e?.message); }
    };
    Alert.alert(t.addPhotoBtn, '', [
      { text: '🖼️ גלריה',   onPress: () => doUpload('gallery') },
      { text: '📷 מצלמה',   onPress: () => doUpload('camera')  },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const handleShareReferral = async () => {
    try {
      await Share.share({ message: `${t.referralBonus}\n\nהקוד שלי: ${referralCode}` });
    } catch (_) {}
  };

  // ─── Portfolio ────────────────────────────────────────────────────────────────
  const pickPortfolioPhoto = () => {
    Alert.alert(t.portfolioAdd, '', [
      {
        text: '🖼️ גלריה',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, 'נדרשת הרשאה לגלריה');
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.2, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) savePortfolioPhoto(res.assets[0].base64);
        },
      },
      {
        text: '📷 מצלמה',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, 'נדרשת הרשאה למצלמה');
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.2, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) savePortfolioPhoto(res.assets[0].base64);
        },
      },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const savePortfolioPhoto = async (b64: string) => {
    const uri = `data:image/jpeg;base64,${b64}`;
    const updated = [...portfolio, uri];
    setPortfolio(updated);
    await setDoc(doc(db, 'users', uid), { portfolio: updated }, { merge: true });
  };

  const removePortfolioPhoto = (index: number) => {
    Alert.alert('מחק תמונה', 'האם למחוק תמונה זו מתיק העבודות?', [
      {
        text: 'מחק', style: 'destructive',
        onPress: async () => {
          const updated = portfolio.filter((_, i) => i !== index);
          setPortfolio(updated);
          await setDoc(doc(db, 'users', uid), { portfolio: updated }, { merge: true });
        },
      },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  // ─── ID Verification ─────────────────────────────────────────────────────────
  const pickIdPhoto = () => {
    Alert.alert(t.idVerifyTitle, t.idVerifyInfo, [
      {
        text: '🖼️ גלריה',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, 'נדרשת הרשאה לגלריה');
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false, quality: 0.3, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) saveIdPhoto(res.assets[0].base64);
        },
      },
      {
        text: '📷 מצלמה',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, 'נדרשת הרשאה למצלמה');
          const res = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.3, base64: true });
          if (!res.canceled && res.assets[0].base64) saveIdPhoto(res.assets[0].base64);
        },
      },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const saveIdPhoto = async (b64: string) => {
    const uri = `data:image/jpeg;base64,${b64}`;
    await setDoc(doc(db, 'users', uid), { idPhotoB64: uri, identityVerified: true }, { merge: true });
    setIdVerified(true);
    Alert.alert('✅', t.idVerifyDone);
  };

  // ─── Cleaner: "on my way" ─────────────────────────────────────────────────────
  const handleOnWay = async (b: any) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'bookings', b.id), { status: 'onway', onwayAt: now });
      setIncomingBks(prev => prev.map(x => x.id === b.id ? { ...x, status: 'onway', onwayAt: now } : x));
      try {
        const clientSnap = await getDoc(doc(db, 'users', b.clientUid));
        const clientData = clientSnap.data() || {};
        if (clientData.pushToken) {
          await sendPushNotification(clientData.pushToken, t.pushOnWayTitle, t.pushOnWayBody);
        }
        // Open Maps with client address
        if (b.address) {
          const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(b.address)}`;
          await Linking.openURL(mapsUrl);
        }
        // WhatsApp to client
        const rawPhone = (clientData.phone || '').replace(/\D/g, '').replace(/^0/, '');
        if (rawPhone) {
          const msg = encodeURIComponent(`שלום! ${t.onWayBtn} 🚗\nאני בדרך אליך לכתובת ${b.address || ''}`);
          setTimeout(() => Linking.openURL(`https://wa.me/972${rawPhone}?text=${msg}`), 500);
        }
      } catch (_) {}
    } catch (_) {
      Alert.alert(t.error, 'שגיאה בעדכון סטטוס');
    }
  };

  // ─── Cleaner: open chat with client ─────────────────────────────────────────
  const openCleanerChat = (b: any) => {
    const clientUid  = b.clientUid;
    const clientName = b.clientName || 'לקוח';
    setChatClientUid(clientUid);
    setChatClientName(clientName);
    setChatMessages([]);
    setChatOpen(true);
    // subscribe to messages
    if (chatUnsubRef.current) chatUnsubRef.current();
    const chatId = [uid, clientUid].sort().join('_');
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    chatUnsubRef.current = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChatMessages(msgs);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, () => {});
  };

  const sendCleanerMessage = async () => {
    if (!chatInput.trim() || !chatClientUid) return;
    const msg  = chatInput.trim();
    const chatId = [uid, chatClientUid].sort().join('_');
    setChatInput('');
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: msg, from: 'cleaner', fromUid: uid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        participants: [uid, chatClientUid].sort(),
        lastMessage: msg,
        lastMessageAt: new Date().toISOString(),
        participantNames: { [uid]: userName, [chatClientUid]: chatClientName },
        unreadBy: arrayUnion(chatClientUid),
      }, { merge: true });
      // push notification ללקוח
      try {
        const clientSnap = await getDoc(doc(db, 'users', chatClientUid));
        const pushToken  = clientSnap.data()?.pushToken;
        if (pushToken) {
          await sendPushNotification(pushToken, `💬 הודעה מ-${userName}`, msg);
        }
      } catch (_) {}
    } catch (_) {}
  };

  // ─── Cleaner: start cleaning ─────────────────────────────────────────────────
  const handleStartCleaning = async (b: any) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'bookings', b.id), { status: 'active', startedAt: now });
      setIncomingBks(prev => prev.map(x => x.id === b.id ? { ...x, status: 'active', startedAt: now } : x));
      // push to client
      try {
        const clientSnap = await getDoc(doc(db, 'users', b.clientUid));
        const token = clientSnap.data()?.pushToken;
        if (token) await sendPushNotification(token, t.pushCleaningStarted, t.pushCleaningStartedBody);
      } catch (_) {}
    } catch (_) {
      Alert.alert(t.error, 'שגיאה בעדכון סטטוס');
    }
  };

  // ─── Cleaner: mark payment received ──────────────────────────────────────────
  const handlePaymentReceived = async (b: any) => {
    try {
      await updateDoc(doc(db, 'bookings', b.id), {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
      });
      setBookings(prev => prev.map(bk => bk.id === b.id ? { ...bk, paymentStatus: 'paid' } : bk));
    } catch (e: any) {
      Alert.alert(t.error, e.message);
    }
  };

  // ─── Cleaner: end cleaning ────────────────────────────────────────────────────
  const handleEndCleaning = async (b: any) => {
    try {
      const now = new Date().toISOString();
      const duration = b.startedAt ? calcDuration(b.startedAt, now) : '';

      // חישוב שעות ותשלום אמיתיים
      let actualHours = b.hours;
      let actualTotal = b.total;
      if (b.startedAt) {
        const diffMs      = new Date(now).getTime() - new Date(b.startedAt).getTime();
        const diffHours   = diffMs / 3600000;
        actualHours       = Math.round(diffHours * 10) / 10; // עיגול לעשירית
        const pricePerHour = b.hours > 0 ? b.total / b.hours : 0;
        actualTotal       = Math.round(pricePerHour * diffHours);
      }

      await updateDoc(doc(db, 'bookings', b.id), {
        status: 'done', finishedAt: now, actualHours, actualTotal,
        reviewRequired: true,
        reviewDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setIncomingBks(prev => prev.map(x =>
        x.id === b.id ? { ...x, status: 'done', finishedAt: now, actualHours, actualTotal } : x
      ));
      // הסר את חלון הזמן מ-busySlots של המנקה
      if (b.busyFrom && b.busyUntil) {
        await updateDoc(doc(db, 'users', uid), {
          busySlots: arrayRemove({ from: b.busyFrom, until: b.busyUntil }),
        }).catch(() => {});
      }
      // שליחה ללקוח — push + וואטסאפ תשלום + תזכורת דירוג אחרי 30 דקות
      try {
        const clientSnap = await getDoc(doc(db, 'users', b.clientUid));
        const clientData = clientSnap.data() || {};
        // push
        if (clientData.pushToken) {
          const body = duration
            ? `${t.pushCleaningEndedBody} · ${t.durationLabel}: ${duration}`
            : t.pushCleaningEndedBody;
          await sendPushNotification(clientData.pushToken, t.pushCleaningEnded, body);
          // שלח התראת ביקורת חובה אחרי 5 דקות
          setTimeout(() => {
            sendPushNotification(clientData.pushToken, t.pushReviewRequired, t.pushReviewRequiredBody).catch(() => {});
          }, 5 * 60 * 1000);
        }
        // וואטסאפ — תשלום ביט
        const rawPhone = (clientData.phone || '').replace(/\D/g, '').replace(/^0/, '');
        if (rawPhone) {
          const waPayment = encodeURIComponent(
            `שלום! הניקיון הסתיים ✅\n\n` +
            `⏱ שעות עבודה: ${actualHours}\n` +
            `💙 לתשלום ₪${actualTotal} בביט:\n` +
            `שם המנקה: ${userName}\n` +
            `מספר ביט: ${userPhone}\n` +
            `סכום: ₪${actualTotal}`
          );
          await Linking.openURL(`https://wa.me/972${rawPhone}?text=${waPayment}`);

          // וואטסאפ — בקשת דירוג אחרי 30 דקות
          setTimeout(() => {
            const waReview = encodeURIComponent(
              `היי! 😊\n` +
              `רצינו לדעת — איך היה הניקיון עם ${userName}?\n\n` +
              `נשמח אם תדרגו את ${userName} ⭐⭐⭐⭐⭐\n` +
              `חוות דעת קצרה עוזרת לנו מאוד 🙏`
            );
            Alert.alert(
              '⭐ בקשת דירוג',
              'הגיע הזמן לשלוח ללקוח בקשת דירוג בוואטסאפ',
              [
                { text: 'דלג', style: 'cancel' },
                {
                  text: 'שלח בוואטסאפ',
                  onPress: () => Linking.openURL(`https://wa.me/972${rawPhone}?text=${waReview}`),
                },
              ]
            );
          }, 30 * 60 * 1000);
        }
      } catch (_) {}
    } catch (_) {
      Alert.alert(t.error, 'שגיאה בעדכון סטטוס');
    }
  };

  const handleRate = (booking: any) => {
    setRateTarget(booking);
    setRateModal(true);
  };

  const submitRating = async (stars: number) => {
    if (!rateTarget) return;
    setRateModal(false);
    try {
      await updateDoc(doc(db, 'bookings', rateTarget.id), { cleanerRating: stars });
      const cleanerRef = doc(db, 'users', rateTarget.cleanerId);
      const cleanerSnap = await getDoc(cleanerRef);
      if (cleanerSnap.exists()) {
        const d = cleanerSnap.data();
        const oldCount = d.reviewCount || 0;
        const oldRating = d.rating || 0;
        const newCount = oldCount + 1;
        const newRating = ((oldRating * oldCount) + stars) / newCount;
        await updateDoc(cleanerRef, { rating: newRating, reviewCount: newCount });
      }
      setBookings(prev => prev.map(b =>
        b.id === rateTarget.id ? { ...b, cleanerRating: stars } : b
      ));
    } catch (_) {}
    setRateTarget(null);
  };

  const submitCleanerRating = async (stars: number) => {
    if (!rateTarget) return;
    setRateModal(false);
    try {
      await updateDoc(doc(db, 'bookings', rateTarget.id), { clientRating: stars });
      setIncomingBks(prev => prev.map(b =>
        b.id === rateTarget.id ? { ...b, clientRating: stars } : b
      ));
    } catch (_) {}
    setRateTarget(null);
  };

  const totalSpent  = bookings.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalEarned = incomingBks.reduce((sum, b) => sum + (b.total || 0), 0);
  const isCleaner   = userRole === 'cleaner' || workAreas.length > 0;
  const DAYS_LABELS = [t.availSun, t.availMon, t.availTue, t.availWed, t.availThu, t.availFri, t.availSat];

  // Business dashboard stats
  const nowDate = new Date();
  const thisMonthBks    = incomingBks.filter(b => { const d = new Date(b.createdAt); return d.getMonth() === nowDate.getMonth() && d.getFullYear() === nowDate.getFullYear(); });
  const thisMonthEarned = thisMonthBks.reduce((sum, b) => sum + (b.total || 0), 0);
  const completedBks    = incomingBks.filter(b => b.status === 'done');
  const cancelledBks    = incomingBks.filter(b => b.status === 'cancelled');
  const cancelRate      = incomingBks.length > 0 ? Math.round((cancelledBks.length / incomingBks.length) * 100) : 0;
  const allTimeEarned   = incomingBks.reduce((sum, b) => sum + (b.actualTotal || b.total || 0), 0);
  const clientFreq: Record<string, number> = {};
  incomingBks.forEach(b => { if (b.clientUid) clientFreq[b.clientUid] = (clientFreq[b.clientUid] || 0) + 1; });
  const repeatClients   = Object.values(clientFreq).filter(n => n >= 2).length;
  const ratedBks        = completedBks.filter(b => b.clientRating);
  const dashAvgRating   = ratedBks.length > 0 ? (ratedBks.reduce((s, b) => s + b.clientRating, 0) / ratedBks.length).toFixed(1) : '-';

  // Bar chart — last 6 months earnings
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('he-IL', { month: 'short' }) };
  });
  const monthlyEarnings = last6Months.map(m =>
    incomingBks
      .filter(b => { const d = new Date(b.createdAt); return d.getMonth() === m.month && d.getFullYear() === m.year; })
      .reduce((sum, b) => sum + (b.actualTotal || b.total || 0), 0)
  );
  const maxMonthly = Math.max(...monthlyEarnings, 1);
  const bestMonthLabel = last6Months[monthlyEarnings.indexOf(Math.max(...monthlyEarnings))]?.label || '-';

  // Schedule — current week bookings for calendar view
  const weekStart = new Date(nowDate);
  weekStart.setDate(nowDate.getDate() - nowDate.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekBookings = incomingBks.filter(b => {
    const d = new Date(b.bookingDate || b.createdAt);
    return d >= weekStart && d < weekEnd && b.status !== 'cancelled';
  });

  // ─── Status display ───────────────────────────────────────────────────────────
  const getStatusLabel = (status: string) => {
    if (status === 'pending')   return t.pendingStatus;
    if (status === 'active')    return t.activeStatus;
    if (status === 'onway')     return t.onwayStatus;
    if (status === 'done')      return t.doneStatus;
    if (status === 'cancelled') return t.cancelledStatus;
    return status;
  };

  const getStatusStyle = (status: string) => {
    if (status === 'active')    return [s.detailPill, s.statusPillActive];
    if (status === 'onway')     return [s.detailPill, s.statusPillOnWay];
    if (status === 'done')      return [s.detailPill, s.statusPill];
    if (status === 'cancelled') return [s.detailPill, s.statusPillCancelled];
    return [s.detailPill, s.statusPillPending];
  };

  const getStatusTextStyle = (status: string) => {
    if (status === 'active')    return s.statusPillTextActive;
    if (status === 'onway')     return s.statusPillTextOnWay;
    if (status === 'done')      return s.statusPillText;
    if (status === 'cancelled') return s.statusPillTextCancelled;
    return s.statusPillTextPending;
  };

  // ─── Accept urgent request ───────────────────────────────────────────────────
  const handleAcceptUrgent = async (req: any) => {
    try {
      const reqRef = doc(db, 'urgentRequests', req.id);
      const snap = await getDoc(reqRef);
      if (!snap.exists() || snap.data()?.status !== 'open') {
        Alert.alert('', 'הבקשה כבר נלקחה על ידי מנקה אחר');
        return;
      }
      const cleanerSnap = await getDoc(doc(db, 'users', uid));
      const cleanerName = cleanerSnap.data()?.name || 'מנקה';
      // סמן כנלקח
      await updateDoc(reqRef, { status: 'taken', takenByUid: uid, takenByName: cleanerName, takenAt: new Date().toISOString() });
      // צור הזמנה
      await addDoc(collection(db, 'bookings'), {
        cleanerId: uid, cleanerName,
        clientUid: req.clientUid, clientName: req.clientName,
        hours: req.hours, payment: req.paymentMethod, paymentStatus: `awaiting_${req.paymentMethod}`,
        address: req.address, total: req.total,
        status: 'pending', createdAt: new Date().toISOString(),
        bookingDate: req.dateStr,
        startTime: req.startTime,
        recurring: 'once', serviceType: '',
        pricePerHour: Math.round(req.total / req.hours),
        source: 'urgent',
      });
      // Push ללקוח
      try {
        const clientSnap = await getDoc(doc(db, 'users', req.clientUid));
        const pushToken = clientSnap.data()?.pushToken;
        if (pushToken) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: pushToken, title: t.urgentFoundMsg, body: `${cleanerName} קיבל את הבקשה שלך!`, sound: 'default', channelId: 'messages', priority: 'high' }),
          });
        }
      } catch (_) {}
      Alert.alert('✅', `קיבלת את הבקשה של ${req.clientName}!\nכתובת: ${req.address}`);
    } catch (_) {
      Alert.alert(t.error, 'שגיאה בקבלת הבקשה');
    }
  };

  const handleCancelBooking = (b: any) => {
    Alert.alert(
      t.cancelConfirmTitle,
      t.cancelConfirmMsg + '\n\n' + t.cancelRefundPolicy,
      [
      { text: t.cancelKeepBooking, style: 'cancel' },
      {
        text: t.cancelConfirmBtn,
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'bookings', b.id), { status: 'cancelled' });
            setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'cancelled' } : x));
            setIncomingBks(prev => prev.map(x => x.id === b.id ? { ...x, status: 'cancelled' } : x));
            // הסר את חלון הזמן מ-busySlots של המנקה
            if (b.busyFrom && b.busyUntil) {
              await updateDoc(doc(db, 'users', b.cleanerId), {
                busySlots: arrayRemove({ from: b.busyFrom, until: b.busyUntil }),
              }).catch(() => {});
            }
          } catch (e: any) {
            Alert.alert(t.error, e?.message || 'שגיאה');
          }
        },
      },
    ]);
  };

  // ─── Booking Card ─────────────────────────────────────────────────────────────
  const renderBookingCard = (b: any, forCleaner = false) => {
    const alreadyRated = forCleaner ? !!b.clientRating : !!b.cleanerRating;
    const isDone   = b.status === 'done';
    const isActive = b.status === 'active';
    const hasTimes = b.startedAt || b.finishedAt;

    return (
      <View key={b.id} style={s.bookingCard}>
        <View style={s.bookingTop}>
          <View style={s.bookingAvatar}>
            <Text style={s.bookingAvatarText}>
              {((forCleaner ? b.clientName : b.cleanerName) || '?').charAt(0)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.bookingName}>{forCleaner ? (b.clientName || 'לקוח') : b.cleanerName}</Text>
              {b.recurring === 'weekly'  && <Text style={s.recurBadge}>{t.recurBadgeWeekly}</Text>}
              {b.recurring === 'monthly' && <Text style={s.recurBadge}>{t.recurBadgeMonthly}</Text>}
            </View>
            <Text style={s.bookingDate}>{formatDate(b.createdAt)}</Text>
          </View>
          <View style={s.totalBadge}>
            {isDone && b.actualTotal != null ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.totalBadgeText}>₪{b.actualTotal}</Text>
                <Text style={{ fontSize: 10, color: C.textSub, textDecorationLine: 'line-through' }}>₪{b.total}</Text>
              </View>
            ) : (
              <Text style={s.totalBadgeText}>₪{b.total}</Text>
            )}
          </View>
        </View>

        <View style={s.bookingDetails}>
          <View style={s.detailPill}>
            <Text style={s.detailPillText}>⏱ {isDone && b.actualHours != null ? b.actualHours : b.hours} {t.hoursUnit}</Text>
            {isDone && b.actualHours != null && b.actualHours !== b.hours && (
              <Text style={{ fontSize: 10, color: C.textSub, textDecorationLine: 'line-through' }}> ({b.hours})</Text>
            )}
          </View>
          <View style={s.detailPill}>
            <Text style={s.detailPillText}>{PAY_ICONS[b.payment] || '💳'} {b.payment === 'card' ? t.payCard : b.payment === 'bit' ? t.payBit : t.payCash}</Text>
          </View>
          <View style={getStatusStyle(b.status)}>
            <Text style={getStatusTextStyle(b.status)}>{getStatusLabel(b.status)}</Text>
          </View>
        </View>

        {b.address ? <Text style={s.addressText}>📍 {b.address}</Text> : null}

        {/* Start / End time row */}
        {hasTimes && (
          <View style={s.timesRow}>
            {b.startedAt && (
              <View style={s.timeChip}>
                <Text style={s.timeChipLabel}>{t.startedAtLabel}</Text>
                <Text style={s.timeChipVal}>{formatTime(b.startedAt)}</Text>
              </View>
            )}
            {b.finishedAt && (
              <View style={s.timeChip}>
                <Text style={s.timeChipLabel}>{t.finishedAtLabel}</Text>
                <Text style={s.timeChipVal}>{formatTime(b.finishedAt)}</Text>
              </View>
            )}
            {b.startedAt && b.finishedAt && (
              <View style={[s.timeChip, { backgroundColor: C.greenBg }]}>
                <Text style={s.timeChipLabel}>{t.durationLabel}</Text>
                <Text style={[s.timeChipVal, { color: C.green }]}>{calcDuration(b.startedAt, b.finishedAt)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Cancel button — pending only, both client and cleaner */}
        {b.status === 'pending' && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancelBooking(b)}>
            <Text style={s.cancelBtnText}>✕ {t.cancelBookingBtn}</Text>
          </TouchableOpacity>
        )}

        {/* Cleaner action buttons */}
        {forCleaner && b.status === 'pending' && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={s.onWayBtn} onPress={() => handleOnWay(b)}>
              <Text style={s.onWayBtnText}>{t.onWayBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.startBtn} onPress={() => handleStartCleaning(b)}>
              <Text style={s.startBtnText}>✨ {t.startCleaningBtn}</Text>
            </TouchableOpacity>
          </View>
        )}
        {forCleaner && b.status === 'onway' && (
          <TouchableOpacity style={s.startBtn} onPress={() => handleStartCleaning(b)}>
            <Text style={s.startBtnText}>✨ {t.startCleaningBtn}</Text>
          </TouchableOpacity>
        )}
        {forCleaner && isActive && (
          <TouchableOpacity style={s.endBtn} onPress={() => handleEndCleaning(b)}>
            <Text style={s.endBtnText}>✅ {t.endCleaningBtn}</Text>
          </TouchableOpacity>
        )}
        {/* Payment received button */}
        {forCleaner && b.paymentStatus && b.paymentStatus !== 'paid' && (
          <TouchableOpacity
            style={{ marginTop: 8, backgroundColor: '#10B981', borderRadius: 10, padding: 10, alignItems: 'center' }}
            onPress={() => handlePaymentReceived(b)}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
              {b.payment === 'bit' ? '💙 אישור תשלום ביט' : b.payment === 'card' ? '💳 אישור תשלום כרטיס' : '💵 קיבלתי מזומן'} ✓
            </Text>
          </TouchableOpacity>
        )}
        {forCleaner && b.paymentStatus === 'paid' && (
          <View style={{ marginTop: 8, backgroundColor: '#D1FAE5', borderRadius: 10, padding: 8, alignItems: 'center' }}>
            <Text style={{ color: '#065F46', fontWeight: '700', fontSize: 13 }}>✅ תשלום אושר</Text>
          </View>
        )}

        {/* Chat button */}
        {forCleaner && (
          <TouchableOpacity style={s.chatCardBtn} onPress={() => openCleanerChat(b)}>
            <Text style={s.chatCardBtnText}>💬 {t.chatBtnShort || "צ'אט"}</Text>
          </TouchableOpacity>
        )}

        {/* Before / After photos */}
        {isDone && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSub, marginBottom: 6 }}>{t.photosTitle}</Text>
            {forCleaner && (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity style={s.photoBtn} onPress={() => uploadJobPhoto(b.id, 'before')}>
                  <Text style={s.photoBtnText}>📸 {t.beforePhotosLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.photoBtn, { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' }]} onPress={() => uploadJobPhoto(b.id, 'after')}>
                  <Text style={[s.photoBtnText, { color: '#7C3AED' }]}>📸 {t.afterPhotosLabel}</Text>
                </TouchableOpacity>
              </View>
            )}
            {!forCleaner && ((b.beforePhotos?.length > 0) || (b.afterPhotos?.length > 0)) && (
              <TouchableOpacity style={s.photoBtn} onPress={() => {
                const all = [...(b.beforePhotos || []), ...(b.afterPhotos || [])];
                setPhotoViewerUris(all); setPhotoViewerIdx(0); setPhotoViewerOpen(true);
              }}>
                <Text style={s.photoBtnText}>📸 {t.viewPhotos} ({(b.beforePhotos?.length || 0) + (b.afterPhotos?.length || 0)})</Text>
              </TouchableOpacity>
            )}
            {b.beforePhotos?.length > 0 && (
              <ScrollView horizontal style={{ marginTop: 8 }} showsHorizontalScrollIndicator={false}>
                {b.beforePhotos.map((uri: string, i: number) => (
                  <TouchableOpacity key={i} onPress={() => { setPhotoViewerUris(b.beforePhotos); setPhotoViewerIdx(i); setPhotoViewerOpen(true); }}>
                    <Image source={{ uri }} style={{ width: 56, height: 56, borderRadius: 8, marginRight: 6 }} contentFit="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {b.afterPhotos?.length > 0 && (
              <ScrollView horizontal style={{ marginTop: 6 }} showsHorizontalScrollIndicator={false}>
                {b.afterPhotos.map((uri: string, i: number) => (
                  <TouchableOpacity key={i} onPress={() => { setPhotoViewerUris(b.afterPhotos); setPhotoViewerIdx(i); setPhotoViewerOpen(true); }}>
                    <Image source={{ uri }} style={{ width: 56, height: 56, borderRadius: 8, marginRight: 6, borderWidth: 2, borderColor: '#7C3AED' }} contentFit="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Review deadline countdown */}
        {isDone && !forCleaner && b.reviewRequired && !b.cleanerRating && b.reviewDeadline && (
          <Text style={{ color: '#EF4444', fontSize: 12, textAlign: 'right', marginTop: 4 }}>
            ⏰ {t.reviewDeadlineDays}: {Math.max(0, Math.ceil((new Date(b.reviewDeadline).getTime() - Date.now()) / 86400000))} ימים
          </Text>
        )}

        {/* Rating row */}
        {isDone && (
          alreadyRated ? (
            <View style={s.ratedRow}>
              <Text style={s.ratedLabel}>{t.ratedLabel}: </Text>
              {[1,2,3,4,5].map(i => (
                <Text key={i} style={{ color: i <= (forCleaner ? b.clientRating : b.cleanerRating) ? C.gold : C.blueBorder, fontSize: 14 }}>★</Text>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={s.rateBtn} onPress={() => handleRate(b)}>
              <Text style={s.rateBtnText}>⭐ {forCleaner ? t.rateCleanerLbl : t.rateTitle}</Text>
            </TouchableOpacity>
          )
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.wrap, dark && { backgroundColor: '#0F172A' }]}>
      <StatusBar barStyle="light-content" backgroundColor={dark ? '#0F172A' : C.blueDark} />

      <View style={[s.header, dark && { backgroundColor: '#0F172A' }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={{ color: C.white, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.myProfileTitle}</Text>
        <TouchableOpacity onPress={toggleDark} style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', width: 36 }}>
          <Text style={{ fontSize: 16 }}>{dark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={C.blue} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} style={dark ? { backgroundColor: '#0F172A' } : undefined}>

          {/* Hero */}
          <View style={s.hero}>
            <TouchableOpacity onPress={pickImage} disabled={uploading} style={s.avatarWrap}>
              {photoB64 ? (
                <Image source={{ uri: photoB64 }} style={s.avatarImg} contentFit="cover" />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarText}>{userName ? userName.charAt(0) : '?'}</Text>
                </View>
              )}
              <View style={s.cameraBtn}>
                {uploading ? <ActivityIndicator size="small" color={C.white} /> : <Text style={{ fontSize: 14 }}>📷</Text>}
              </View>
            </TouchableOpacity>
            <Text style={s.name}>{userName}</Text>
            <Text style={s.email}>{userEmail}</Text>
            {!!userPhone && (
              <Text style={s.email}>📱 {userPhone}</Text>
            )}
            <View style={s.roleBadge}>
              <Text style={s.roleBadgeText}>{isCleaner ? t.cleanerRole : t.clientRole}</Text>
            </View>
            <TouchableOpacity style={s.editProfileBtn} onPress={openEditProfile}>
              <Text style={s.editProfileBtnText}>✏️ ערוך פרופיל</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statVal}>{isCleaner ? incomingBks.length : bookings.length}</Text>
              <Text style={s.statLabel}>{t.bookingsLabel}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statVal}>₪{isCleaner ? totalEarned : totalSpent}</Text>
              <Text style={s.statLabel}>{isCleaner ? 'הכנסות' : t.totalSpentLabel}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statVal}>
                {isCleaner
                  ? incomingBks.filter(b => b.status === 'active').length
                  : bookings.filter(b => b.status === 'pending').length}
              </Text>
              <Text style={s.statLabel}>{isCleaner ? '🔄 פעיל' : t.pendingLabel}</Text>
            </View>
          </View>

          {/* ── CLEANER: לשוניות + תוכן ישיר מתחתן ─────────────────────────── */}
          {isCleaner && (
            <View style={s.section}>
              {/* כפתורי לשוניות */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['bookings', 'urgent', 'schedule', 'profile'] as const).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[s.tabBtn, activeTab === tab && s.tabBtnActive,
                      tab === 'urgent' && activeTab !== 'urgent' && urgentRequests.length > 0 && { borderColor: '#7C3AED', borderWidth: 2 }
                    ]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[s.tabBtnText, activeTab === tab && s.tabBtnTextActive]}>
                      {tab === 'bookings' ? `📥 ${t.incomingBookings}`
                        : tab === 'urgent' ? `${t.urgentTabLabel}${urgentRequests.length > 0 ? ` (${urgentRequests.length})` : ''}`
                        : tab === 'schedule' ? t.scheduleTitle
                        : `👤 ${t.myProfileTitle}`}
                    </Text>
                  </TouchableOpacity>
                ))}
                </View>
              </ScrollView>

              {/* ── לשונית: בקשות דחופות ── */}
              {activeTab === 'urgent' && (
                <>
                  {urgentRequests.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
                      <Text style={{ fontSize: 44 }}>⚡</Text>
                      <Text style={{ fontSize: 14, color: C.textSub, textAlign: 'center' }}>{t.urgentNoCleaner}</Text>
                    </View>
                  ) : (
                    urgentRequests.map((req: any) => {
                      const expiresIn = Math.max(0, Math.ceil((new Date(req.expiresAt).getTime() - Date.now()) / 60000));
                      return (
                        <View key={req.id} style={{ backgroundColor: '#F5F3FF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#7C3AED', gap: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#4C1D95' }}>{t.urgentCardTitle}</Text>
                            <Text style={{ fontSize: 11, color: '#6D28D9', fontWeight: '700' }}>⏳ {expiresIn} דק׳</Text>
                          </View>
                          <Text style={{ fontSize: 14, color: C.textDark, fontWeight: '700' }}>👤 {req.clientName}</Text>
                          <Text style={{ fontSize: 13, color: C.textDark }}>📍 {req.address}</Text>
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Text style={{ fontSize: 12, color: C.textSub }}>
                              📅 {req.date === 'today' ? t.urgentToday : t.urgentTomorrow} {req.startTime}
                            </Text>
                            <Text style={{ fontSize: 12, color: C.textSub }}>⏱️ {req.hours} {t.hoursUnit}</Text>
                            <Text style={{ fontSize: 12, color: C.textSub }}>₪{req.total}</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: C.textSub }}>
                            💳 {req.paymentMethod === 'cash' ? t.payCash : req.paymentMethod === 'bit' ? t.payBit : t.payCard}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
                              onPress={() => handleAcceptUrgent(req)}
                            >
                              <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>{t.urgentAcceptBtn}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </>
              )}

              {/* ── לשונית: הזמנות שקיבלתי ── */}
              {activeTab === 'bookings' && (
                <>
                  {/* Dashboard */}
                  <Text style={[s.sectionTitle, { marginBottom: 10 }]}>📊 {t.dashboardTitle}</Text>
                  <View style={s.dashRow}>
                    <View style={s.dashCard}>
                      <Text style={s.dashVal}>₪{thisMonthEarned}</Text>
                      <Text style={s.dashLabel}>{t.thisMonthLabel}</Text>
                    </View>
                    <View style={s.dashCard}>
                      <Text style={s.dashVal}>{completedBks.length}</Text>
                      <Text style={s.dashLabel}>{t.completedJobsLabel}</Text>
                    </View>
                    <View style={s.dashCard}>
                      <Text style={s.dashVal}>{repeatClients}</Text>
                      <Text style={s.dashLabel}>{t.repeatClientsLabel}</Text>
                    </View>
                    <View style={s.dashCard}>
                      <Text style={s.dashVal}>{dashAvgRating}</Text>
                      <Text style={s.dashLabel}>{t.avgRatingLabel}</Text>
                    </View>
                  </View>
                  <View style={[s.dashRow, { marginTop: 10 }]}>
                    <View style={s.dashCard}>
                      <Text style={s.dashVal}>₪{allTimeEarned}</Text>
                      <Text style={s.dashLabel}>{t.allTimeEarningsLabel}</Text>
                    </View>
                    <View style={s.dashCard}>
                      <Text style={s.dashVal}>{cancelRate}%</Text>
                      <Text style={s.dashLabel}>{t.cancelRateLabel}</Text>
                    </View>
                  </View>
                  {/* גרף עמודות */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={s.sectionTitle}>{t.earningsChartLabel}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100, marginTop: 8 }}>
                      {monthlyEarnings.map((val, i) => {
                        const pct = val / maxMonthly;
                        const barH = Math.max(pct * 80, val > 0 ? 4 : 0);
                        return (
                          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: 9, color: C.textSub }}>{val > 0 ? `₪${val}` : ''}</Text>
                            <View style={{ height: barH, backgroundColor: C.blue, borderRadius: 4, width: '100%' }} />
                            <Text style={{ fontSize: 9, color: C.textSub }}>{last6Months[i].label}</Text>
                          </View>
                        );
                      })}
                    </View>
                    {maxMonthly > 1 && (
                      <Text style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
                        🏆 {t.bestMonthLabel}: {bestMonthLabel}
                      </Text>
                    )}
                  </View>
                  {/* רשימת הזמנות */}
                  <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: C.blueBorder, paddingTop: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={s.sectionTitle}>📥 {t.incomingBookings}</Text>
                      {incomingBks.filter(b => b.status === 'active' || b.status === 'onway').length > 0 && (
                        <View style={s.activeBadge}>
                          <Text style={s.activeBadgeText}>🔄 {incomingBks.filter(b => b.status === 'active' || b.status === 'onway').length} פעיל</Text>
                        </View>
                      )}
                    </View>
                    {incomingBks.length === 0 ? (
                      <View style={s.emptyBox}>
                        <Text style={{ fontSize: 36, marginBottom: 8 }}>📭</Text>
                        <Text style={s.emptyText}>אין הזמנות עדיין</Text>
                      </View>
                    ) : (
                      incomingBks.map(b => renderBookingCard(b, true))
                    )}
                  </View>
                </>
              )}

              {/* ── לשונית: לוח זמנים ── */}
              {activeTab === 'schedule' && (
                <>
                  <Text style={s.sectionTitle}>{t.scheduleTitle}</Text>
                  {weekBookings.length === 0 ? (
                    <View style={s.emptyBox}>
                      <Text style={{ fontSize: 36, marginBottom: 8 }}>📅</Text>
                      <Text style={s.emptyText}>{t.scheduleEmpty}</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {[t.availSun, t.availMon, t.availTue, t.availWed, t.availThu, t.availFri, t.availSat].map((day, i) => {
                          const d = new Date(weekStart);
                          d.setDate(weekStart.getDate() + i);
                          const isToday = d.toDateString() === nowDate.toDateString();
                          const dayBks = weekBookings.filter(b => {
                            const bd = new Date(b.bookingDate || b.createdAt);
                            return bd.toDateString() === d.toDateString();
                          });
                          return (
                            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: isToday ? C.blue : C.textSub }}>{day}</Text>
                              <Text style={{ fontSize: 9, color: isToday ? C.blue : C.textSub }}>{d.getDate()}</Text>
                              {dayBks.map(b => (
                                <View key={b.id} style={[s.scheduleBlock, b.status === 'done' && { backgroundColor: C.greenBg }]}>
                                  <Text style={{ fontSize: 8, fontWeight: '700', color: C.textDark }} numberOfLines={1}>{b.clientName || 'לקוח'}</Text>
                                  <Text style={{ fontSize: 7, color: C.textSub }}>{b.startTime || '—'}</Text>
                                </View>
                              ))}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* ── לשונית: הפרופיל שלי ── */}
              {activeTab === 'profile' && (
                <>
                  {/* קוד הפניה */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.sectionTitle}>🎁 {t.referralTitle}</Text>
                    <View style={s.referralCard}>
                      <Text style={s.referralBonus}>{t.referralBonus}</Text>
                      <View style={s.referralCodeRow}>
                        <Text style={s.referralCodeText}>{referralCode || '...'}</Text>
                        <TouchableOpacity style={s.referralShareBtn} onPress={handleShareReferral}>
                          <Text style={s.referralShareBtnText}>{t.referralShare}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>


                  {/* אימות זהות */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.sectionTitle}>🪪 {t.idVerifyTitle}</Text>
                    <View style={[s.referralCard, { gap: 12 }]}>
                      <Text style={{ fontSize: 12, color: C.textSub, lineHeight: 18 }}>{t.idVerifyInfo}</Text>
                      {idVerified ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#DCFCE7', borderRadius: 12, padding: 12 }}>
                          <Text style={{ fontSize: 24 }}>🪪</Text>
                          <Text style={{ fontSize: 15, fontWeight: '900', color: '#15803D' }}>{t.idVerifyDone}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={s.startBtn} onPress={pickIdPhoto}>
                          <Text style={s.startBtnText}>{t.idVerifyUpload}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* פורטפוליו */}
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={s.sectionTitle}>📸 {t.portfolioTitle}</Text>
                      <TouchableOpacity onPress={pickPortfolioPhoto}>
                        <Text style={{ fontSize: 13, color: C.blue, fontWeight: '700' }}>+ {t.portfolioAdd}</Text>
                      </TouchableOpacity>
                    </View>
                    {portfolio.length === 0 ? (
                      <View style={s.emptyBox}>
                        <Text style={{ fontSize: 32, marginBottom: 6 }}>🖼️</Text>
                        <Text style={s.emptyText}>{t.portfolioEmpty}</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {portfolio.map((uri, i) => (
                          <TouchableOpacity key={i} onLongPress={() => removePortfolioPhoto(i)}>
                            <Image source={{ uri }} style={{ width: 88, height: 88, borderRadius: 14 }} contentFit="cover" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <Text style={{ fontSize: 10, color: C.textSub, marginTop: 6 }}>לחץ לחיצה ארוכה על תמונה כדי למחוק</Text>
                  </View>

                  {/* שפה מועדפת */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={s.sectionTitle}>🌐 שפה מועדפת</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {[
                        { key: 'he', label: 'עברית',    flag: '🇮🇱' },
                        { key: 'en', label: 'English',  flag: '🇬🇧' },
                        { key: 'ru', label: 'Русский',  flag: '🇷🇺' },
                        { key: 'ar', label: 'العربية',  flag: '🇸🇦' },
                        { key: 'fr', label: 'Français', flag: '🇫🇷' },
                        { key: 'hi', label: 'हिन्दी',  flag: '🇮🇳' },
                      ].map(l => (
                        <TouchableOpacity
                          key={l.key}
                          style={[s.langBtn, prefLang === l.key && s.langBtnActive]}
                          onPress={async () => {
                            setPrefLang(l.key);
                            setLang(l.key as Lang);
                            await setDoc(doc(db, 'users', uid), { preferredLang: l.key }, { merge: true });
                          }}
                        >
                          <Text style={[s.langBtnText, prefLang === l.key && s.langBtnTextActive, l.key === 'hi' && { fontFamily: 'NotoSansDevanagari_400Regular', fontWeight: '400' }]}>
                            {l.flag} {l.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* אזורי עבודה */}
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={s.sectionTitle}>{t.workAreasTitle}</Text>
                      {areasSaved && <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>{t.workAreasSaved}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['north', 'center', 'south'] as const).map(area => {
                        const active = workAreas.includes(area);
                        const label = area === 'north' ? t.regionNorth : area === 'center' ? t.regionCenter : t.regionSouth;
                        return (
                          <TouchableOpacity key={area} style={[s.areaBtn, active && s.areaBtnActive]} onPress={() => toggleArea(area)}>
                            <Text style={[s.areaBtnText, active && s.areaBtnTextActive]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* זמינות */}
                  <View style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={s.sectionTitle}>📅 {t.availTitle}</Text>
                      {availSaved && <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>{t.availSaved}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {DAYS_KEYS.map((day, i) => {
                        const d = availability[day] || { active: false, start: 9, end: 18 };
                        return (
                          <TouchableOpacity key={day} style={[s.dayBtn, d.active && s.dayBtnActive]} onPress={() => toggleDay(day)}>
                            <Text style={[s.dayBtnText, d.active && s.dayBtnTextActive]}>{DAYS_LABELS[i]}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {DAYS_KEYS.some(day => availability[day]?.active) && (
                      <View style={{ marginTop: 14, gap: 8 }}>
                        {DAYS_KEYS.map((day, i) => {
                          const d = availability[day];
                          if (!d?.active) return null;
                          return (
                            <View key={day} style={s.dayRow}>
                              <Text style={s.dayHourLabel}>{DAYS_LABELS[i]}</Text>
                              <View style={s.hoursRow}>
                                <View style={s.hourCtrl}>
                                  <TouchableOpacity onPress={() => updateDayHours(day, 'start', -1)} style={s.hourArrow}>
                                    <Text style={s.hourArrowText}>◀</Text>
                                  </TouchableOpacity>
                                  <Text style={s.hourVal}>{String(d.start).padStart(2,'0')}:00</Text>
                                  <TouchableOpacity onPress={() => updateDayHours(day, 'start', 1)} style={s.hourArrow}>
                                    <Text style={s.hourArrowText}>▶</Text>
                                  </TouchableOpacity>
                                </View>
                                <Text style={s.hourDash}>—</Text>
                                <View style={s.hourCtrl}>
                                  <TouchableOpacity onPress={() => updateDayHours(day, 'end', -1)} style={s.hourArrow}>
                                    <Text style={s.hourArrowText}>◀</Text>
                                  </TouchableOpacity>
                                  <Text style={s.hourVal}>{String(d.end).padStart(2,'0')}:00</Text>
                                  <TouchableOpacity onPress={() => updateDayHours(day, 'end', 1)} style={s.hourArrow}>
                                    <Text style={s.hourArrowText}>▶</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── לקוח: היסטוריית הזמנות ───────────────────────────────────── */}
          {!isCleaner && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t.historyTitle}</Text>
              {bookings.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
                  <Text style={s.emptyText}>{t.noBookingsText}</Text>
                  <Text style={s.emptySubText}>{t.noBookingsSub}</Text>
                </View>
              ) : (
                bookings.map(b => renderBookingCard(b, false))
              )}
            </View>
          )}

          {/* קוד הפניה (לקוח) */}
          {!isCleaner && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>🎁 {t.referralTitle}</Text>
              <View style={s.referralCard}>
                <Text style={s.referralBonus}>{t.referralBonus}</Text>
                <View style={s.referralCodeRow}>
                  <Text style={s.referralCodeText}>{referralCode || '...'}</Text>
                  <TouchableOpacity style={s.referralShareBtn} onPress={handleShareReferral}>
                    <Text style={s.referralShareBtnText}>{t.referralShare}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ביטוח (לקוח) */}
          {!isCleaner && (
            <View style={s.section}>
              <View style={s.insuranceCard}>
                <Text style={s.insuranceCardTitle}>{t.insuranceTitle}</Text>
                <Text style={s.insuranceCardSub}>{t.insuranceSub}</Text>
                <TouchableOpacity style={s.insuranceBtnLarge} onPress={() => Linking.openURL('https://www.bitui.co.il')}>
                  <Text style={s.insuranceBtnLargeText}>{t.insuranceBtn}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}



          {/* שפה מועדפת (לקוח) */}
          {!isCleaner && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>🌐 שפה מועדפת</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {[
                  { key: 'he', label: 'עברית',    flag: '🇮🇱' },
                  { key: 'en', label: 'English',  flag: '🇬🇧' },
                  { key: 'ru', label: 'Русский',  flag: '🇷🇺' },
                  { key: 'ar', label: 'العربية',  flag: '🇸🇦' },
                  { key: 'fr', label: 'Français', flag: '🇫🇷' },
                  { key: 'hi', label: 'हिन्दी',  flag: '🇮🇳' },
                ].map(l => (
                  <TouchableOpacity
                    key={l.key}
                    style={[s.langBtn, prefLang === l.key && s.langBtnActive]}
                    onPress={async () => {
                      setPrefLang(l.key);
                      setLang(l.key as Lang);
                      await setDoc(doc(db, 'users', uid), { preferredLang: l.key }, { merge: true });
                    }}
                  >
                    <Text style={[s.langBtnText, prefLang === l.key && s.langBtnTextActive, l.key === 'hi' && { fontFamily: 'NotoSansDevanagari_400Regular', fontWeight: '400' }]}>
                      {l.flag} {l.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* כפתור דיווח — סוף הדף */}
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}>
            <TouchableOpacity style={s.reportBtn} onPress={() => setReportOpen(true)}>
              <Text style={s.reportBtnText}>{t.reportBtn}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}

      <RateModal
        booking={rateTarget}
        visible={rateModal}
        isCleaner={isCleaner}
        onClose={() => { setRateModal(false); setRateTarget(null); }}
        onSubmit={isCleaner ? submitCleanerRating : submitRating}
      />

      {/* Cleaner Chat Modal */}
      <Modal visible={chatOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setChatOpen(false); if (chatUnsubRef.current) chatUnsubRef.current(); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => { setChatOpen(false); if (chatUnsubRef.current) chatUnsubRef.current(); }} style={s.backBtn}>
              <Text style={{ color: C.white, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>💬 {chatClientName}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView ref={chatScrollRef} contentContainerStyle={{ padding: 16, gap: 8 }}>
            {chatMessages.map(m => {
              const isMe = m.fromUid === uid;
              return (
                <View key={m.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <View style={[s.chatBubble, isMe ? s.chatBubbleMe : s.chatBubbleOther]}>
                    <Text style={{ color: isMe ? C.textDark : C.white, fontSize: 14 }}>{m.text}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <KeyboardAvoidingView behavior="padding">
            <View style={s.chatInputRow}>
              <TouchableOpacity style={s.chatSendBtn} onPress={sendCleanerMessage}>
                <Text style={{ color: C.white, fontSize: 18 }}>▶</Text>
              </TouchableOpacity>
              <TextInput
                style={s.chatTextInput}
                placeholder="כתוב הודעה..."
                value={chatInput}
                onChangeText={setChatInput}
                placeholderTextColor={C.textSub}
                textAlign="right"
                onSubmitEditing={sendCleanerMessage}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal visible={photoViewerOpen} transparent animationType="fade" onRequestClose={() => setPhotoViewerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 8 }}
            onPress={() => setPhotoViewerOpen(false)}
          >
            <Text style={{ color: C.white, fontSize: 18, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
          {photoViewerUris.length > 0 && (
            <Image
              source={{ uri: photoViewerUris[photoViewerIdx] }}
              style={{ width: '90%', height: '70%', borderRadius: 12 }}
              contentFit="contain"
            />
          )}
          {photoViewerUris.length > 1 && (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setPhotoViewerIdx(i => Math.max(0, i - 1))} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 10 }}>
                <Text style={{ color: C.white, fontSize: 16 }}>◀</Text>
              </TouchableOpacity>
              <Text style={{ color: C.white, alignSelf: 'center' }}>{photoViewerIdx + 1} / {photoViewerUris.length}</Text>
              <TouchableOpacity onPress={() => setPhotoViewerIdx(i => Math.min(photoViewerUris.length - 1, i + 1))} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 10 }}>
                <Text style={{ color: C.white, fontSize: 16 }}>▶</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── מודל עריכת פרופיל מנקה ── */}
      <Modal visible={editOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
          <View style={[s.header, { justifyContent: 'space-between' }]}>
            <TouchableOpacity onPress={() => setEditOpen(false)} style={s.backBtn}>
              <Text style={{ color: C.white, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>✏️ ערוך פרופיל</Text>
            <View style={{ width: 36 }} />
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>

              {/* שם */}
              <View>
                <Text style={ep.label}>👤 שם מלא</Text>
                <TextInput style={ep.input} value={editName} onChangeText={setEditName} placeholder="שם מלא" placeholderTextColor={C.textSub} textAlign="right" />
              </View>

              {/* עיר */}
              <View>
                <Text style={ep.label}>🏙️ עיר</Text>
                <TextInput style={ep.input} value={editCity} onChangeText={setEditCity} placeholder="תל אביב, חיפה..." placeholderTextColor={C.textSub} textAlign="right" />
              </View>

              {/* טלפון */}
              <View>
                <Text style={ep.label}>📱 טלפון</Text>
                <TextInput style={ep.input} value={editPhone} onChangeText={setEditPhone} placeholder="05X-XXXXXXX" keyboardType="phone-pad" placeholderTextColor={C.textSub} textAlign="right" />
              </View>

              {/* שדות מנקה בלבד */}
              {isCleaner && (<>

              {/* מחיר בסיס */}
              <View>
                <Text style={ep.label}>💰 מחיר לשעה (₪) — ניקוי רגיל</Text>
                <TextInput style={ep.input} value={editPrice} onChangeText={setEditPrice} placeholder="65" keyboardType="numeric" placeholderTextColor={C.textSub} textAlign="right" />
              </View>

              {/* תמחור לפי שירות */}
              <Text style={[ep.label, { marginBottom: 4 }]}>💲 מחיר לפי סוג שירות (אופציונלי)</Text>
              {[
                { key: 'ניקוי לפסח', icon: '🧹' },
                { key: 'שטיפת רכב',  icon: '🚗' },
                { key: 'חלונות',     icon: '🪟' },
                { key: 'לאחר שיפוץ',icon: '🔨' },
                { key: 'ניקיון אחרי אירוע', icon: '🎉' },
              ].map(svc => (
                <View key={svc.key} style={{ marginBottom: 8 }}>
                  <Text style={[ep.label, { fontSize: 12 }]}>{svc.icon} {svc.key} — ₪/שעה</Text>
                  <TextInput
                    style={ep.input}
                    value={editServicePricing[svc.key] || ''}
                    onChangeText={v => setEditServicePricing(prev => ({ ...prev, [svc.key]: v }))}
                    placeholder={editPrice || 'כמו מחיר בסיס'}
                    keyboardType="numeric"
                    placeholderTextColor={C.textSub}
                    textAlign="right"
                  />
                </View>
              ))}

              {/* תיאור */}
              <View>
                <Text style={ep.label}>
                  📝 תיאור ({editBio.trim().split(/\s+/).filter(Boolean).length}/30 מילים)
                </Text>
                <TextInput
                  style={[ep.input, { height: 90, textAlignVertical: 'top' }]}
                  value={editBio}
                  onChangeText={v => {
                    const words = v.trim().split(/\s+/).filter(Boolean);
                    if (words.length < 30) setEditBio(v);
                    else if (words.length === 30) setEditBio(words.join(' '));
                    else setEditBio(words.slice(0, 30).join(' '));
                  }}
                  placeholder="ספר על עצמך בקצרה..."
                  multiline
                  placeholderTextColor={C.textSub}
                  textAlign="right"
                />
              </View>

              {/* נייד */}
              <View>
                <Text style={ep.label}>🚗 מגיע/ה אליך?</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[{ v: true, label: 'כן, נייד/ת' }, { v: false, label: 'לא, לא נייד/ת' }].map(opt => (
                    <TouchableOpacity key={String(opt.v)} style={[ep.pill, editIsMobile === opt.v && ep.pillActive, { flex: 1, alignItems: 'center', paddingVertical: 12 }]} onPress={() => setEditIsMobile(opt.v)}>
                      <Text style={[ep.pillText, editIsMobile === opt.v && ep.pillTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* מרחק מקסימלי */}
              <View>
                <Text style={ep.label}>📍 מרחק מקסימלי (ק"מ)</Text>
                <TextInput style={ep.input} value={editMaxDistance} onChangeText={setEditMaxDistance} placeholder="20" keyboardType="numeric" placeholderTextColor={C.textSub} textAlign="right" />
              </View>

              {/* ציוד */}
              <View>
                <Text style={ep.label}>🧴 חומרי ניקוי</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[{ v: true, label: 'אני מביא/ה' }, { v: false, label: 'הלקוח מספק' }].map(opt => (
                    <TouchableOpacity key={String(opt.v)} style={[ep.pill, editBringSupplies === opt.v && ep.pillActive, { flex: 1, alignItems: 'center', paddingVertical: 12 }]} onPress={() => setEditBringSupplies(opt.v)}>
                      <Text style={[ep.pillText, editBringSupplies === opt.v && ep.pillTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* סוגי שירות */}
              <View>
                <Text style={ep.label}>🧹 סוגי שירות</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {[
                    { key: 'ניקוי לפסח', icon: '🧹' }, { key: 'חלונות', icon: '🪟' },
                    { key: 'שטיפת רכב', icon: '🚗' }, { key: 'לאחר שיפוץ', icon: '🔨' },
                    { key: 'ניקיון משרדים', icon: '🏢' }, { key: 'ניקיון אחרי אירוע', icon: '🎉' },
                    { key: 'מחסן ועליית גג', icon: '📦' },
                  ].map(svc => (
                    <TouchableOpacity key={svc.key} style={[ep.pill, editTypes.includes(svc.key) && ep.pillActive]} onPress={() => toggleEdit(editTypes, setEditTypes, svc.key)}>
                      <Text style={[ep.pillText, editTypes.includes(svc.key) && ep.pillTextActive]}>{svc.icon} {svc.key}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* אמצעי תשלום */}
              <View>
                <Text style={ep.label}>💳 אמצעי תשלום</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {[{ key: 'cash', label: '💵 מזומן' }, { key: 'bit', label: '📱 ביט' }, { key: 'card', label: '💳 אשראי' }].map(p => (
                    <TouchableOpacity key={p.key} style={[ep.pill, editPayment.includes(p.key) && ep.pillActive, { flex: 1, alignItems: 'center' }]} onPress={() => toggleEdit(editPayment, setEditPayment, p.key)}>
                      <Text style={[ep.pillText, editPayment.includes(p.key) && ep.pillTextActive]}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* אזורי עבודה */}
              <View>
                <Text style={ep.label}>📍 אזורי עבודה</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {[{ key: 'north', label: '🌿 צפון' }, { key: 'center', label: '🏙️ מרכז' }, { key: 'south', label: '☀️ דרום' }].map(a => (
                    <TouchableOpacity key={a.key} style={[ep.pill, editWorkAreas.includes(a.key) && ep.pillActive, { flex: 1, alignItems: 'center' }]} onPress={() => toggleEdit(editWorkAreas, setEditWorkAreas, a.key)}>
                      <Text style={[ep.pillText, editWorkAreas.includes(a.key) && ep.pillTextActive]}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* קבוצת וואצאפ */}
              <View style={{ backgroundColor: '#F0FFF4', borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: '#A7F3D0' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>💬 קבוצת וואצאפ לניקוי דחוף</Text>
                <Text style={{ fontSize: 12, color: '#047857', lineHeight: 18 }}>
                  {'הזן את ה-Group ID של הקבוצה שנפתחה עם מנהל האפליקציה.\nהפורמט: XXXXXXXXXX@g.us\n(ניתן לקבל מ-UltraMsg Dashboard → Contacts)'}
                </Text>
                <TextInput
                  style={[ep.input, { fontFamily: 'monospace', fontSize: 13, textAlign: 'left' }]}
                  value={editWhatsappGroupId}
                  onChangeText={setEditWhatsappGroupId}
                  placeholder="972XXXXXXXXX-XXXXXXXXXX@g.us"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="default"
                  textAlign="left"
                />
                {editWhatsappGroupId ? (
                  <Text style={{ fontSize: 11, color: '#10B981' }}>✅ בקשות דחופות ישלחו לקבוצה זו</Text>
                ) : (
                  <Text style={{ fontSize: 11, color: '#F59E0B' }}>⚠️ ללא Group ID — הבקשות ישלחו למספר הטלפון שלך</Text>
                )}
              </View>

              {/* סוף שדות מנקה */}
              </>)}

              {/* שמור */}
              <TouchableOpacity
                style={[ep.saveBtn, editSaving && { opacity: 0.6 }]}
                onPress={saveEditProfile}
                disabled={editSaving}
              >
                <Text style={ep.saveBtnText}>{editSaving ? 'שומר...' : '💾 שמור שינויים'}</Text>
              </TouchableOpacity>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── מודל דיווח ── */}
      <Modal visible={reportOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReportOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
          <View style={[s.header, { justifyContent: 'space-between' }]}>
            <TouchableOpacity onPress={() => setReportOpen(false)} style={s.backBtn}>
              <Text style={{ color: C.white, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>🚨 {t.reportTitle}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* סוג דיווח */}
            <View style={{ gap: 8 }}>
              {[
                { key: 'bug',     label: t.reportTypeBug },
                { key: 'cleaner', label: t.reportTypeCleaner },
                { key: 'client',  label: t.reportTypeClient },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setReportType(opt.key as any)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: reportType === opt.key ? C.blue : C.white,
                    borderRadius: 12, padding: 14,
                    borderWidth: 1.5, borderColor: reportType === opt.key ? C.blue : C.blueBorder,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{reportType === opt.key ? '🔵' : '⚪'}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: reportType === opt.key ? C.white : C.textDark }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* שם האדם */}
            {reportType !== 'bug' && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>
                  {reportType === 'cleaner' ? '🧹 שם המנקה' : '👤 שם הלקוח'}
                </Text>
                <TextInput
                  style={{ backgroundColor: C.white, borderRadius: 10, padding: 12, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder, textAlign: 'right' }}
                  placeholder={t.reportTargetPlaceholder}
                  placeholderTextColor={C.textSub}
                  value={reportTarget}
                  onChangeText={setReportTarget}
                />
              </View>
            )}

            {/* פירוט */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>📝 {t.reportDescLabel}</Text>
              <TextInput
                style={{ backgroundColor: C.white, borderRadius: 10, padding: 12, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder, minHeight: 110, textAlignVertical: 'top', textAlign: 'right' }}
                placeholder={t.reportDescPlaceholder}
                placeholderTextColor={C.textSub}
                value={reportDesc}
                onChangeText={setReportDesc}
                multiline
              />
            </View>

            {/* שליחה */}
            <TouchableOpacity
              style={{ backgroundColor: reportDesc.trim() ? C.error : C.blueBorder, borderRadius: 12, padding: 16, alignItems: 'center' }}
              onPress={handleSendReport}
              disabled={!reportDesc.trim() || reportSending}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.white }}>
                {reportSending ? '...' : t.reportSubmit}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>


    </SafeAreaView>
  );
}

// ── Edit Profile Styles ───────────────────────────────────────────────────────
const ep = StyleSheet.create({
  label:        { fontSize: 13, fontWeight: '700', color: C.textDark, marginBottom: 6, textAlign: 'right' },
  input:        { backgroundColor: C.white, borderRadius: 12, padding: 13, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder },
  pill:         { backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: C.blueBorder },
  pillActive:   { backgroundColor: C.blue, borderColor: C.blue },
  pillText:     { fontSize: 13, fontWeight: '600', color: C.textDark },
  pillTextActive:{ color: C.white, fontWeight: '700' },
  saveBtn:      { backgroundColor: C.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  saveBtnText:  { fontSize: 16, fontWeight: '800', color: C.white },
});

const s = StyleSheet.create({
  wrap:        { flex: 1, backgroundColor: C.bluePale },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.blueDark, padding: 16 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  loader:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero:           { backgroundColor: C.blue, padding: 28, alignItems: 'center', gap: 6 },
  avatarWrap:     { position: 'relative', marginBottom: 6 },
  avatarImg:      { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarFallback: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarText:     { fontSize: 32, fontWeight: '900', color: C.white },
  cameraBtn:      { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: C.blueDark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white },
  name:           { fontSize: 22, fontWeight: '900', color: C.white },
  email:          { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  roleBadge:          { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 4 },
  roleBadgeText:      { fontSize: 13, fontWeight: '700', color: C.white },
  editProfileBtn:     { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginTop: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  editProfileBtnText: { fontSize: 14, fontWeight: '700', color: C.white },

  statsRow:    { flexDirection: 'row', backgroundColor: C.white, marginHorizontal: 16, marginTop: 16, borderRadius: 16, paddingVertical: 18, borderWidth: 1, borderColor: C.blueBorder },
  statBox:     { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: C.blueBorder },
  statVal:     { fontSize: 22, fontWeight: '900', color: C.blue },
  statLabel:   { fontSize: 11, color: C.textSub, marginTop: 3 },

  section:      { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.textDark, marginBottom: 12 },

  emptyBox:     { backgroundColor: C.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder },
  emptyText:    { fontSize: 15, fontWeight: '700', color: C.textDark },
  emptySubText: { fontSize: 12, color: C.textSub, marginTop: 4 },

  // Phone Privacy
  phoneToggleRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.blueBorder },
  phoneToggleLabel: { fontSize: 14, fontWeight: '700', color: C.textDark, marginBottom: 3 },
  phoneToggleSub:   { fontSize: 12, color: C.textSub },

  // Active badge
  activeBadge:     { backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FCD34D' },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: C.orange },

  bookingCard:       { backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.blueBorder, elevation: 2 },
  bookingTop:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  bookingAvatar:     { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  bookingAvatarText: { color: C.white, fontWeight: '900', fontSize: 15 },
  bookingName:       { fontSize: 14, fontWeight: '700', color: C.textDark },
  bookingDate:       { fontSize: 11, color: C.textSub, marginTop: 2 },
  totalBadge:        { backgroundColor: C.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  totalBadgeText:    { fontSize: 15, fontWeight: '900', color: C.blue },
  bookingDetails:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  detailPill:        { backgroundColor: C.bluePale, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.blueBorder },
  detailPillText:    { fontSize: 11, fontWeight: '600', color: C.textDark },

  statusPill:        { backgroundColor: C.greenBg },
  statusPillText:    { fontSize: 11, fontWeight: '700', color: C.green },
  statusPillActive:  { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  statusPillTextActive: { fontSize: 11, fontWeight: '700', color: C.orange },
  statusPillPending: { backgroundColor: C.bluePale, borderColor: C.blueBorder },
  statusPillTextPending: { fontSize: 11, fontWeight: '600', color: C.textSub },
  statusPillCancelled: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  statusPillTextCancelled: { fontSize: 11, fontWeight: '700', color: '#DC2626' },

  addressText:       { fontSize: 11, color: C.textSub, marginTop: 8 },

  // Times row
  timesRow:      { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  timeChip:      { backgroundColor: C.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.blueBorder, alignItems: 'center' },
  timeChipLabel: { fontSize: 9, color: C.textSub, fontWeight: '600', marginBottom: 2 },
  timeChipVal:   { fontSize: 13, fontWeight: '900', color: C.blue },

  // Start / End buttons
  startBtn:     { marginTop: 10, backgroundColor: C.blue, borderRadius: 10, padding: 12, alignItems: 'center' },
  startBtnText: { fontSize: 14, fontWeight: '800', color: C.white },
  endBtn:       { marginTop: 10, backgroundColor: C.green, borderRadius: 10, padding: 12, alignItems: 'center' },
  endBtnText:   { fontSize: 14, fontWeight: '800', color: C.white },
  cancelBtn:     { marginTop: 10, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' },
  cancelBtnText: { fontSize: 14, fontWeight: '800', color: '#DC2626' },

  rateBtn:     { marginTop: 10, backgroundColor: C.blueLight, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder },
  rateBtnText: { fontSize: 13, fontWeight: '700', color: C.blue },
  ratedRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  ratedLabel:  { fontSize: 12, color: C.textSub },

  // Photos
  photoBtn:     { backgroundColor: C.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.blueBorder },
  photoBtnText: { fontSize: 11, fontWeight: '700', color: C.blue },

  // Dashboard
  dashRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dashCard: { flex: 1, minWidth: '44%', backgroundColor: C.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder },
  dashVal:  { fontSize: 22, fontWeight: '900', color: C.blue },
  dashLabel:{ fontSize: 11, color: C.textSub, marginTop: 4, textAlign: 'center' },

  // Referral
  referralCard:        { backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.blueBorder },
  referralBonus:       { fontSize: 13, color: C.textMid, marginBottom: 12, lineHeight: 20 },
  referralCodeRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  referralCodeText:    { fontSize: 24, fontWeight: '900', color: C.blue, letterSpacing: 3, flex: 1 },
  referralShareBtn:    { backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  referralShareBtnText:{ fontSize: 13, fontWeight: '800', color: C.white },

  // Insurance card
  insuranceCard:        { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#BFDBFE' },
  insuranceCardTitle:   { fontSize: 15, fontWeight: '800', color: '#1E3A8A', marginBottom: 4 },
  insuranceCardSub:     { fontSize: 13, color: '#3B82F6', marginBottom: 14, lineHeight: 20 },
  insuranceBtnLarge:    { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  insuranceBtnLargeText:{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  areaBtn:          { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.blueBorder, alignItems: 'center' },
  areaBtnActive:    { backgroundColor: C.blue, borderColor: C.blue },
  areaBtnText:      { fontSize: 13, fontWeight: '700', color: C.textDark },
  areaBtnTextActive:{ color: C.white },
  langBtn:          { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.blueBorder },
  langBtnActive:    { backgroundColor: C.blue, borderColor: C.blue },
  langBtnText:      { fontSize: 12, fontWeight: '700', color: C.textDark },
  langBtnTextActive:{ color: C.white },

  dayRow:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayHourLabel:     { fontSize: 13, fontWeight: '800', color: C.green, minWidth: 42, textAlign: 'right' },
  dayBtn:           { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.blueBorder, minWidth: 52, alignItems: 'center' },
  dayBtnActive:     { backgroundColor: C.green, borderColor: C.green },
  dayBtnText:       { fontSize: 12, fontWeight: '700', color: C.textDark },
  dayBtnTextActive: { color: C.white },
  hoursRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hourCtrl:         { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.blueLight, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderColor: C.blueBorder },
  hourArrow:        { padding: 4 },
  hourArrowText:    { fontSize: 12, color: C.blue, fontWeight: '700' },
  hourVal:          { fontSize: 13, fontWeight: '900', color: C.textDark, minWidth: 42, textAlign: 'center' },
  hourDash:         { fontSize: 14, color: C.textSub, fontWeight: '600' },

  // Recurring badge
  recurBadge: { backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '700', color: '#7C3AED' },

  // On-way button
  onWayBtn:         { backgroundColor: '#F97316', borderRadius: 10, padding: 12, alignItems: 'center' },
  onWayBtnText:     { fontSize: 14, fontWeight: '800', color: C.white },

  // Status pills new
  statusPillOnWay:       { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  statusPillTextOnWay:   { fontSize: 11, fontWeight: '700', color: '#D97706' },

  // Chat from cleaner side
  chatCardBtn:     { marginTop: 8, backgroundColor: C.blueLight, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder },
  chatCardBtnText: { fontSize: 13, fontWeight: '700', color: C.blue },
  chatBubble:      { maxWidth: '80%', padding: 12, borderRadius: 16 },
  chatBubbleMe:    { backgroundColor: C.white, borderWidth: 1, borderColor: C.blueBorder },
  chatBubbleOther: { backgroundColor: C.blue },
  chatInputRow:    { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.blueBorder },
  chatTextInput:   { flex: 1, backgroundColor: C.bluePale, borderRadius: 10, padding: 10, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder },
  chatSendBtn:     { width: 42, height: 42, backgroundColor: C.blue, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  // Schedule block
  scheduleBlock: { backgroundColor: C.blueLight, borderRadius: 6, padding: 4, width: '100%', borderWidth: 1, borderColor: C.blueBorder, marginBottom: 2 },

  // Tab buttons (cleaner)
  tabBtn:          { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.blueBorder, alignItems: 'center' },
  tabBtnActive:    { backgroundColor: C.blue, borderColor: C.blue },
  tabBtnText:      { fontSize: 10, fontWeight: '700', color: C.textDark },
  tabBtnTextActive:{ color: C.white },

  // Report button (bottom of page)
  reportBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#FCA5A5' },
  reportBtnText: { fontSize: 15, fontWeight: '800', color: '#DC2626' },
});

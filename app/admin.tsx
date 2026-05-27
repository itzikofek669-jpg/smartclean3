import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import {
  collection, onSnapshot, query, orderBy, limit,
  updateDoc, doc, addDoc, deleteDoc,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useRouter } from 'expo-router';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:        '#F0F4FF',
  card:      '#FFFFFF',
  blue:      '#2563EB',
  blueDark:  '#1E3A8A',
  blueLight: '#EFF6FF',
  green:     '#10B981',
  greenBg:   '#D1FAE5',
  red:       '#EF4444',
  redBg:     '#FEE2E2',
  orange:    '#F59E0B',
  orangeBg:  '#FEF3C7',
  purple:    '#8B5CF6',
  purpleBg:  '#EDE9FE',
  text:      '#1A1A2E',
  sub:       '#6B7280',
  border:    '#E5E7EB',
  white:     '#FFFFFF',
};

const TABS = ['📊 דשבורד', '✨ מנקים', '👤 לקוחות', '📋 הזמנות', '🛠️ כלים'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#92400E' },
  confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
  onway:     { bg: '#FEF3C7', text: '#B45309' },
  active:    { bg: '#D1FAE5', text: '#065F46' },
  done:      { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
};
const STATUS_LABELS: Record<string, string> = {
  pending:   '⏳ ממתין',
  confirmed: '✅ אושר',
  onway:     '🚗 בדרך',
  active:    '🔄 פעיל',
  done:      '✅ בוצע',
  cancelled: '❌ בוטל',
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AdminScreen() {
  const router = useRouter();
  const [tab, setTab]         = useState(0);
  const [loading, setLoading] = useState(true);

  // Data
  const [users,    setUsers]    = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  // Tools
  const [pushTitle,    setPushTitle]    = useState('');
  const [pushBody,     setPushBody]     = useState('');
  const [pushSending,  setPushSending]  = useState(false);
  const [promoCode,    setPromoCode]    = useState('');
  const [promoDiscount,setPromoDiscount]= useState('');
  const [promoCodes,   setPromoCodes]   = useState<any[]>([]);
  const [promoAdding,  setPromoAdding]  = useState(false);

  // Search
  const [cleanerSearch, setCleanerSearch] = useState('');
  const [clientSearch,  setClientSearch]  = useState('');
  const [bookingSearch, setBookingSearch] = useState('');

  useEffect(() => {
    // הגנה — רק אדמין מורשה
    const currentEmail = auth.currentUser?.email || '';
    const ADMIN_EMAILS = ['cleantouchapp@gmail.com', 'itzikofek669@gmail.com'];
    if (!ADMIN_EMAILS.includes(currentEmail)) {
      router.replace('/home');
      return;
    }
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubBookings = onSnapshot(
      query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(300)),
      snap => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubPromo = onSnapshot(collection(db, 'promoCodes'), snap => {
      setPromoCodes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubUsers(); unsubBookings(); unsubPromo(); };
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────
  const cleaners = users.filter(u => u.role === 'cleaner');
  const clients  = users.filter(u => u.role === 'client');

  const now = new Date();
  const thisMonthBookings = bookings.filter(b => {
    const d = new Date(b.createdAt || 0);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthRevenue = thisMonthBookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.total || 0), 0);

  const allTimeRevenue = bookings
    .filter(b => b.status === 'done')
    .reduce((sum, b) => sum + (b.total || 0), 0);

  // Revenue chart — last 6 months
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.getMonth(), y = d.getFullYear();
    const rev = bookings
      .filter(b => {
        const bd = new Date(b.createdAt || 0);
        return bd.getMonth() === m && bd.getFullYear() === y && b.status !== 'cancelled';
      })
      .reduce((sum, b) => sum + (b.total || 0), 0);
    return {
      label: d.toLocaleDateString('he-IL', { month: 'short' }),
      revenue: rev,
      count: bookings.filter(b => {
        const bd = new Date(b.createdAt || 0);
        return bd.getMonth() === m && bd.getFullYear() === y;
      }).length,
    };
  });
  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

  // Top 5 cleaners by rating
  const topCleaners = [...cleaners]
    .filter(c => !c.blocked && (c.rating || 0) > 0)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleBlock = (uid: string, name: string, currentlyBlocked: boolean) => {
    const action = currentlyBlocked ? 'לשחרר' : 'לחסום';
    Alert.alert(`${action} משתמש`, `האם ${action} את ${name}?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: action, style: 'destructive', onPress: async () => {
        await updateDoc(doc(db, 'users', uid), { blocked: !currentlyBlocked });
      }},
    ]);
  };

  const handleCancelBooking = (bookingId: string) => {
    Alert.alert('ביטול הזמנה', 'האם לבטל הזמנה זו?', [
      { text: 'לא', style: 'cancel' },
      { text: 'כן, בטל', style: 'destructive', onPress: async () => {
        await updateDoc(doc(db, 'bookings', bookingId), { status: 'cancelled' });
      }},
    ]);
  };

  const handleSendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim())
      return Alert.alert('שגיאה', 'מלא כותרת ותוכן');
    setPushSending(true);
    try {
      const tokens = users.map(u => u.pushToken).filter(Boolean);
      // TODO: call cloud function / FCM in production
      Alert.alert('✅ נשלח', `ההתראה נשלחה ל-${tokens.length} משתמשים`);
      setPushTitle(''); setPushBody('');
    } finally {
      setPushSending(false);
    }
  };

  const handleAddPromo = async () => {
    if (!promoCode.trim() || !promoDiscount.trim())
      return Alert.alert('שגיאה', 'מלא קוד ואחוז הנחה');
    const disc = parseInt(promoDiscount);
    if (isNaN(disc) || disc < 1 || disc > 100)
      return Alert.alert('שגיאה', 'הנחה חייבת להיות בין 1 ל-100');
    setPromoAdding(true);
    try {
      await addDoc(collection(db, 'promoCodes'), {
        code: promoCode.toUpperCase().trim(),
        discount: disc,
        createdAt: new Date().toISOString(),
        active: true,
      });
      setPromoCode(''); setPromoDiscount('');
    } finally {
      setPromoAdding(false);
    }
  };

  const handleDeletePromo = (id: string, code: string) => {
    Alert.alert('מחיקת קוד', `למחוק את הקוד "${code}"?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: async () => {
        await deleteDoc(doc(db, 'promoCodes', id));
      }},
    ]);
  };

  const handleLogout = () => {
    Alert.alert('התנתקות', 'להתנתק מחשבון המנהל?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'יציאה', style: 'destructive', onPress: async () => {
        await signOut(auth);
        router.replace('/');
      }},
    ]);
  };

  // ── Filtered lists ──────────────────────────────────────────────────────────
  const filteredCleaners = cleaners.filter(c =>
    !cleanerSearch || c.name?.includes(cleanerSearch) || c.city?.includes(cleanerSearch) || c.email?.includes(cleanerSearch)
  );
  const filteredClients = clients.filter(c =>
    !clientSearch || c.name?.includes(clientSearch) || c.email?.includes(clientSearch) || c.phone?.includes(clientSearch)
  );
  const filteredBookings = bookings.filter(b =>
    !bookingSearch ||
    b.clientName?.includes(bookingSearch) ||
    b.cleanerName?.includes(bookingSearch) ||
    b.address?.includes(bookingSearch)
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.blue} />
      <Text style={{ color: C.sub, marginTop: 12, fontSize: 15 }}>טוען נתוני מנהל...</Text>
    </View>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>🛡️ A&M Clean Admin</Text>
          <Text style={s.headerSub}>
            {users.length} משתמשים · {bookings.length} הזמנות
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Text style={s.logoutBtnText}>יציאה</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsWrap}
      >
        {TABS.map((name, i) => (
          <TouchableOpacity
            key={i}
            style={[s.tabBtn, tab === i && s.tabBtnActive]}
            onPress={() => setTab(i)}
          >
            <Text style={[s.tabBtnText, tab === i && s.tabBtnTextActive]}>{name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ══════════════════════════ TAB 0 — DASHBOARD ══════════════════════════ */}
        {tab === 0 && (
          <View style={s.tabContent}>

            {/* Stat cards row 1 */}
            <View style={s.statsGrid}>
              <StatCard icon="👥" label="סה״כ משתמשים"   value={users.length}    color={C.blue}   />
              <StatCard icon="✨" label="מנקים רשומים"    value={cleaners.length} color={C.green}  />
              <StatCard icon="👤" label="לקוחות רשומים"  value={clients.length}  color={C.purple} />
              <StatCard icon="🚫" label="חסומים"         value={users.filter(u => u.blocked).length} color={C.red} />
            </View>

            {/* Stat cards row 2 */}
            <View style={s.statsGrid}>
              <StatCard icon="📋" label="הזמנות החודש"   value={thisMonthBookings.length} color={C.orange} />
              <StatCard icon="₪"  label="הכנסה החודש"    value={`₪${thisMonthRevenue.toLocaleString()}`}  color={C.blue}   />
              <StatCard icon="✅" label="הזמנות בוצעו"   value={bookings.filter(b => b.status === 'done').length} color={C.green} />
              <StatCard icon="❌" label="הזמנות בוטלו"   value={bookings.filter(b => b.status === 'cancelled').length} color={C.red} />
            </View>

            {/* All-time revenue banner */}
            <View style={s.revenueBanner}>
              <Text style={s.revenueBannerLabel}>💰 הכנסה כוללת מאז השקה</Text>
              <Text style={s.revenueBannerValue}>₪{allTimeRevenue.toLocaleString()}</Text>
            </View>

            {/* Revenue chart */}
            <View style={s.card}>
              <Text style={s.cardTitle}>📊 הכנסות — 6 חודשים אחרונים</Text>
              <View style={s.chart}>
                {chartData.map((d, i) => (
                  <View key={i} style={s.chartCol}>
                    <Text style={s.chartVal}>
                      {d.revenue > 999
                        ? `₪${(d.revenue / 1000).toFixed(1)}k`
                        : d.revenue > 0 ? `₪${d.revenue}` : ''}
                    </Text>
                    <View style={s.chartBarWrap}>
                      <View style={[s.chartBar, { height: Math.max(4, (d.revenue / maxRevenue) * 90) }]} />
                    </View>
                    <Text style={s.chartLabel}>{d.label}</Text>
                    <Text style={s.chartCount}>{d.count} הז׳</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Top cleaners */}
            <View style={s.card}>
              <Text style={s.cardTitle}>🏆 מנקים מובילים (לפי דירוג)</Text>
              {topCleaners.length === 0
                ? <Text style={s.emptyText}>אין נתונים עדיין</Text>
                : topCleaners.map((c, i) => (
                  <View key={c.uid} style={s.topRow}>
                    <Text style={s.topRank}>#{i + 1}</Text>
                    <View style={s.topAvatar}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                        {c.name?.charAt(0) || '?'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.topName}>{c.name}</Text>
                      <Text style={s.topSub}>{c.city} · {c.reviewCount || 0} ביקורות</Text>
                    </View>
                    <Text style={s.topRating}>⭐ {c.rating?.toFixed(1) || '—'}</Text>
                  </View>
                ))}
            </View>

            {/* Recent bookings */}
            <View style={s.card}>
              <Text style={s.cardTitle}>🕐 הזמנות אחרונות</Text>
              {bookings.slice(0, 8).map(b => (
                <View key={b.id} style={s.recentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentName}>
                      {b.clientName || 'לקוח'} ← {b.cleanerName || 'מנקה'}
                    </Text>
                    <Text style={s.recentSub}>{b.date} · ₪{b.total || 0}</Text>
                  </View>
                  <StatusPill status={b.status} />
                </View>
              ))}
            </View>

          </View>
        )}

        {/* ══════════════════════════ TAB 1 — CLEANERS ══════════════════════════ */}
        {tab === 1 && (
          <View style={s.tabContent}>
            <TextInput
              style={s.searchInput}
              value={cleanerSearch}
              onChangeText={setCleanerSearch}
              placeholder="🔍 חפש לפי שם, עיר, אימייל..."
              placeholderTextColor={C.sub}
            />
            <Text style={s.listMeta}>
              {filteredCleaners.length} מנקים
              {cleaners.filter(c => c.blocked).length > 0
                ? ` · ${cleaners.filter(c => c.blocked).length} חסומים`
                : ''}
            </Text>
            {filteredCleaners.length === 0
              ? <Text style={s.emptyText}>לא נמצאו מנקים</Text>
              : filteredCleaners.map(c => (
                <UserCard
                  key={c.uid}
                  user={c}
                  isCleaner
                  onBlock={() => handleBlock(c.uid, c.name || 'מנקה', !!c.blocked)}
                  extraBookings={bookings.filter(b => b.cleanerUid === c.uid).length}
                />
              ))}
          </View>
        )}

        {/* ══════════════════════════ TAB 2 — CLIENTS ══════════════════════════ */}
        {tab === 2 && (
          <View style={s.tabContent}>
            <TextInput
              style={s.searchInput}
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder="🔍 חפש לפי שם, אימייל, טלפון..."
              placeholderTextColor={C.sub}
            />
            <Text style={s.listMeta}>{filteredClients.length} לקוחות</Text>
            {filteredClients.length === 0
              ? <Text style={s.emptyText}>לא נמצאו לקוחות</Text>
              : filteredClients.map(c => (
                <UserCard
                  key={c.uid}
                  user={c}
                  onBlock={() => handleBlock(c.uid, c.name || 'לקוח', !!c.blocked)}
                  extraBookings={bookings.filter(b => b.clientUid === c.uid).length}
                />
              ))}
          </View>
        )}

        {/* ══════════════════════════ TAB 3 — BOOKINGS ══════════════════════════ */}
        {tab === 3 && (
          <View style={s.tabContent}>
            <TextInput
              style={s.searchInput}
              value={bookingSearch}
              onChangeText={setBookingSearch}
              placeholder="🔍 חפש לפי לקוח, מנקה, כתובת..."
              placeholderTextColor={C.sub}
            />
            {/* Booking status filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {Object.entries(STATUS_LABELS).map(([key, label]) => {
                  const count = bookings.filter(b => b.status === key).length;
                  if (count === 0) return null;
                  return (
                    <View
                      key={key}
                      style={[s.filterPill, { backgroundColor: STATUS_COLORS[key]?.bg }]}
                    >
                      <Text style={[s.filterPillText, { color: STATUS_COLORS[key]?.text }]}>
                        {label} ({count})
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={s.listMeta}>{filteredBookings.length} הזמנות</Text>
            {filteredBookings.length === 0
              ? <Text style={s.emptyText}>לא נמצאו הזמנות</Text>
              : filteredBookings.map(b => (
                <View key={b.id} style={s.bookingCard}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <StatusPill status={b.status} />
                      <Text style={s.bookingDate}>{b.date} {b.startTime || ''}</Text>
                    </View>
                    <Text style={s.bookingParties}>
                      👤 {b.clientName || 'לקוח'} ← ✨ {b.cleanerName || 'מנקה'}
                    </Text>
                    <Text style={s.bookingSub}>📍 {b.address}</Text>
                    <Text style={s.bookingAmount}>
                      ₪{b.total || 0} · {b.hours} שע׳ · {b.paymentMethod}
                    </Text>
                  </View>
                  {b.status !== 'cancelled' && b.status !== 'done' && (
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => handleCancelBooking(b.id)}
                    >
                      <Text style={s.cancelBtnText}>❌ בטל</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
          </View>
        )}

        {/* ══════════════════════════ TAB 4 — TOOLS ══════════════════════════ */}
        {tab === 4 && (
          <View style={s.tabContent}>

            {/* Push notification */}
            <View style={s.card}>
              <Text style={s.cardTitle}>📢 שלח התראה לכל המשתמשים</Text>
              <Text style={s.fieldLabel}>כותרת</Text>
              <TextInput
                style={s.input}
                value={pushTitle}
                onChangeText={setPushTitle}
                placeholder="לדוגמה: עדכון חשוב מ-A&M Clean"
                placeholderTextColor={C.sub}
              />
              <Text style={s.fieldLabel}>תוכן ההודעה</Text>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                value={pushBody}
                onChangeText={setPushBody}
                placeholder="תוכן ההתראה..."
                placeholderTextColor={C.sub}
                multiline
              />
              <TouchableOpacity
                style={[s.bigBtn, pushSending && { opacity: 0.6 }]}
                onPress={handleSendPush}
                disabled={pushSending}
              >
                <Text style={s.bigBtnText}>
                  {pushSending
                    ? 'שולח...'
                    : `📢 שלח ל-${users.filter(u => u.pushToken).length} משתמשים`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Promo codes */}
            <View style={s.card}>
              <Text style={s.cardTitle}>🏷️ קודי הנחה</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                <TextInput
                  style={[s.input, { flex: 2, marginBottom: 0 }]}
                  value={promoCode}
                  onChangeText={setPromoCode}
                  placeholder="קוד (CLEAN20)"
                  placeholderTextColor={C.sub}
                  autoCapitalize="characters"
                />
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0, textAlign: 'center' }]}
                  value={promoDiscount}
                  onChangeText={setPromoDiscount}
                  placeholder="%"
                  placeholderTextColor={C.sub}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[s.addBtn, promoAdding && { opacity: 0.6 }]}
                  onPress={handleAddPromo}
                  disabled={promoAdding}
                >
                  <Text style={s.addBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              {promoCodes.length === 0
                ? <Text style={[s.emptyText, { marginTop: 12 }]}>אין קודים פעילים</Text>
                : promoCodes.map(p => (
                  <View key={p.id} style={s.promoRow}>
                    <View style={s.promoChip}>
                      <Text style={s.promoChipText}>{p.code}</Text>
                    </View>
                    <Text style={s.promoDiscount}>{p.discount}% הנחה</Text>
                    <TouchableOpacity
                      onPress={() => handleDeletePromo(p.id, p.code)}
                      style={{ padding: 6 }}
                    >
                      <Text style={{ fontSize: 18 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}
            </View>

            {/* App summary */}
            <View style={s.card}>
              <Text style={s.cardTitle}>📈 סיכום כולל האפליקציה</Text>
              <InfoRow label="סה״כ משתמשים"     value={users.length.toString()} />
              <InfoRow label="מנקים רשומים"      value={cleaners.length.toString()} />
              <InfoRow label="לקוחות רשומים"     value={clients.length.toString()} />
              <InfoRow label="משתמשים חסומים"    value={users.filter(u => u.blocked).length.toString()} />
              <InfoRow label="סה״כ הזמנות"       value={bookings.length.toString()} />
              <InfoRow label="הזמנות שבוצעו"     value={bookings.filter(b => b.status === 'done').length.toString()} />
              <InfoRow label="הזמנות בוטלו"      value={bookings.filter(b => b.status === 'cancelled').length.toString()} />
              <InfoRow label="הכנסה כוללת"
                value={`₪${allTimeRevenue.toLocaleString()}`}
                highlight
              />
            </View>

          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: any; color: string;
}) {
  return (
    <View style={[s.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={{ fontSize: 24, marginBottom: 4 }}>{icon}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function UserCard({ user, isCleaner, onBlock, extraBookings }: {
  user: any; isCleaner?: boolean; onBlock?: () => void; extraBookings?: number;
}) {
  return (
    <View style={[s.userCard, user.blocked && { borderColor: C.red, borderWidth: 1.5 }]}>
      {/* Left: avatar + info */}
      <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
        <View style={[s.userAvatar, { backgroundColor: isCleaner ? C.blue : C.green }]}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
            {user.name?.charAt(0) || '?'}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={s.userName}>{user.name || 'ללא שם'}</Text>
            {user.blocked && (
              <View style={s.blockedBadge}>
                <Text style={s.blockedBadgeText}>🚫 חסום</Text>
              </View>
            )}
          </View>
          <Text style={s.userSub}>✉️ {user.email}</Text>
          {user.phone ? <Text style={s.userSub}>📞 {user.phone}</Text> : null}
          {isCleaner && (
            <Text style={s.userSub}>
              📍 {user.city || '—'}{user.rating ? ` · ⭐ ${user.rating.toFixed(1)}` : ''}{user.reviewCount ? ` (${user.reviewCount})` : ''}
            </Text>
          )}
          {extraBookings !== undefined && (
            <Text style={s.userSub}>📋 {extraBookings} הזמנות</Text>
          )}
        </View>
      </View>
      {/* Block button */}
      {onBlock && (
        <TouchableOpacity
          style={[s.blockBtn, user.blocked && s.unblockBtn]}
          onPress={onBlock}
        >
          <Text style={[s.blockBtnText, user.blocked && s.unblockBtnText]}>
            {user.blocked ? '🔓 שחרר' : '🚫 חסום'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <View style={[s.statusPill, { backgroundColor: colors.bg }]}>
      <Text style={[s.statusPillText, { color: colors.text }]}>
        {STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
}

function InfoRow({ label, value, highlight }: {
  label: string; value: string; highlight?: boolean;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, highlight && { color: C.blue, fontSize: 16 }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: C.bg },

  // Header
  header:           { backgroundColor: C.blueDark, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:      { fontSize: 19, fontWeight: '900', color: '#fff' },
  headerSub:        { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  logoutBtn:        { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  logoutBtnText:    { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Tabs
  tabsScroll:       { backgroundColor: C.card, maxHeight: 54, borderBottomWidth: 1, borderBottomColor: C.border },
  tabsWrap:         { paddingHorizontal: 12, paddingVertical: 9, gap: 8, flexDirection: 'row', alignItems: 'center' },
  tabBtn:           { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg },
  tabBtnActive:     { backgroundColor: C.blue },
  tabBtnText:       { fontSize: 13, fontWeight: '700', color: C.sub },
  tabBtnTextActive: { color: '#fff' },

  // Layout
  body:             { flex: 1 },
  tabContent:       { padding: 16, gap: 14 },

  // Search
  searchInput:      { backgroundColor: C.card, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: C.text, textAlign: 'right' },
  listMeta:         { fontSize: 12, color: C.sub, textAlign: 'right', paddingHorizontal: 4 },

  // Stat cards
  statsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:         { backgroundColor: C.card, borderRadius: 14, padding: 14, flex: 1, minWidth: '44%', gap: 2, elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  statValue:        { fontSize: 24, fontWeight: '900', marginVertical: 2 },
  statLabel:        { fontSize: 11, color: C.sub, fontWeight: '600' },

  // Revenue banner
  revenueBanner:    { backgroundColor: C.blueDark, borderRadius: 16, padding: 20, alignItems: 'center' },
  revenueBannerLabel:{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6 },
  revenueBannerValue:{ fontSize: 32, fontWeight: '900', color: '#fff' },

  // Card
  card:             { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardTitle:        { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 2 },
  emptyText:        { color: C.sub, textAlign: 'center', paddingVertical: 20, fontSize: 14 },

  // Chart
  chart:            { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 150, paddingTop: 16 },
  chartCol:         { flex: 1, alignItems: 'center', gap: 3 },
  chartBarWrap:     { width: '100%', height: 95, justifyContent: 'flex-end', alignItems: 'center' },
  chartBar:         { width: '68%', backgroundColor: C.blue, borderRadius: 4 },
  chartLabel:       { fontSize: 10, color: C.sub, fontWeight: '600' },
  chartVal:         { fontSize: 9, color: C.blue, fontWeight: '700' },
  chartCount:       { fontSize: 9, color: C.sub },

  // Top cleaners
  topRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  topRank:          { fontSize: 14, fontWeight: '900', color: C.sub, width: 26 },
  topAvatar:        { width: 38, height: 38, borderRadius: 19, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  topName:          { fontSize: 14, fontWeight: '700', color: C.text },
  topSub:           { fontSize: 12, color: C.sub },
  topRating:        { fontSize: 15, fontWeight: '900', color: C.orange },

  // Recent bookings
  recentRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  recentName:       { fontSize: 13, fontWeight: '700', color: C.text },
  recentSub:        { fontSize: 12, color: C.sub },

  // Status pill
  statusPill:       { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText:   { fontSize: 11, fontWeight: '700' },

  // Filter pills
  filterPill:       { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  filterPillText:   { fontSize: 12, fontWeight: '700' },

  // User card
  userCard:         { backgroundColor: C.card, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  userAvatar:       { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  userName:         { fontSize: 15, fontWeight: '800', color: C.text },
  userSub:          { fontSize: 12, color: C.sub },
  blockedBadge:     { backgroundColor: C.redBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  blockedBadgeText: { fontSize: 11, fontWeight: '700', color: C.red },
  blockBtn:         { backgroundColor: C.redBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: C.red },
  blockBtnText:     { fontSize: 12, fontWeight: '800', color: C.red },
  unblockBtn:       { backgroundColor: C.greenBg, borderColor: C.green },
  unblockBtnText:   { color: C.green },

  // Booking card
  bookingCard:      { backgroundColor: C.card, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  bookingDate:      { fontSize: 12, color: C.sub, fontWeight: '600' },
  bookingParties:   { fontSize: 14, fontWeight: '700', color: C.text },
  bookingSub:       { fontSize: 12, color: C.sub },
  bookingAmount:    { fontSize: 13, color: C.blue, fontWeight: '700' },
  cancelBtn:        { backgroundColor: C.redBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: C.red },
  cancelBtnText:    { fontSize: 12, fontWeight: '800', color: C.red },

  // Tools
  fieldLabel:       { fontSize: 13, fontWeight: '700', color: C.text },
  input:            { backgroundColor: C.bg, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, marginBottom: 12, textAlign: 'right' },
  bigBtn:           { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  bigBtnText:       { color: '#fff', fontWeight: '900', fontSize: 15 },
  addBtn:           { backgroundColor: C.blue, borderRadius: 10, width: 48, alignItems: 'center', justifyContent: 'center' },
  addBtnText:       { color: '#fff', fontWeight: '900', fontSize: 24 },
  promoRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  promoChip:        { backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1.5, borderColor: C.blue },
  promoChipText:    { fontSize: 13, fontWeight: '900', color: C.blue, letterSpacing: 1 },
  promoDiscount:    { flex: 1, fontSize: 13, color: C.sub },

  // Info rows
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel:        { fontSize: 13, color: C.sub },
  infoValue:        { fontSize: 14, fontWeight: '800', color: C.text },
});

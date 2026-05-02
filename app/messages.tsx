import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, SafeAreaView, StatusBar, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useLanguage } from '../lib/LanguageContext';

const C = {
  blue:       '#185FA5',
  blueDark:   '#0D4F96',
  blueLight:  '#E6F1FB',
  bluePale:   '#F4F8FD',
  blueBorder: '#B5D4F4',
  textDark:   '#042C53',
  textSub:    '#6B9DC2',
  white:      '#FFFFFF',
};

// ─── Push helper ─────────────────────────────────────────────────────────────
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

// ─── Inline Chat Modal ────────────────────────────────────────────────────────
function InlineChatModal({ chatId, otherUid, otherName, visible, onClose }: any) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText]         = useState('');
  const scrollRef               = useRef<ScrollView>(null);
  const myUid                   = auth.currentUser?.uid || '';

  useEffect(() => {
    if (!chatId || !visible) return;
    // סמן הודעות כנקראו בעת פתיחת הצ'אט
    const myUid = auth.currentUser?.uid;
    if (myUid) {
      updateDoc(doc(db, 'chats', chatId), { unreadBy: arrayRemove(myUid) }).catch(() => {});
    }
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      // סמן כנקרא גם כשמגיעות הודעות חדשות בזמן שהצ'אט פתוח
      if (myUid) {
        updateDoc(doc(db, 'chats', chatId), { unreadBy: arrayRemove(myUid) }).catch(() => {});
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [chatId, visible]);

  const send = async () => {
    if (!text.trim() || !chatId) return;
    const msg = text.trim();
    setText('');
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: msg, fromUid: myUid, createdAt: new Date().toISOString(),
      });
      try {
        const myDoc = await getDoc(doc(db, 'users', myUid));
        const myName = myDoc.data()?.name || '...';
        // עדכן מטא-דאטה + סמן unread לצד השני
        await setDoc(doc(db, 'chats', chatId), {
          participants: [myUid, otherUid].sort(),
          lastMessage: msg,
          lastMessageAt: new Date().toISOString(),
          participantNames: { [myUid]: myName, [otherUid]: otherName },
          unreadBy: arrayUnion(otherUid),
        }, { merge: true });
        // שלח push notification לצד השני
        const otherDoc = await getDoc(doc(db, 'users', otherUid));
        const pushToken = otherDoc.data()?.pushToken;
        if (pushToken) {
          await sendPushNotification(pushToken, `💬 ${myName}`, msg);
        }
      } catch (_) {}
    } catch (_) {}
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
        <View style={cs.header}>
          <TouchableOpacity onPress={onClose} style={cs.closeBtn}>
            <Text style={{ color: C.white, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={cs.headerTitle}>{t.chatWithPrefix}{otherName}</Text>
          <View style={{ width: 36 }} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map(m => (
              <View key={m.id} style={{ alignItems: m.fromUid === myUid ? 'flex-end' : 'flex-start' }}>
                <View style={[cs.bubble, m.fromUid === myUid ? cs.bubbleMe : cs.bubbleOther]}>
                  <Text style={{ color: m.fromUid === myUid ? C.textDark : C.white, fontSize: 14 }}>{m.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={cs.inputRow}>
            <TouchableOpacity style={cs.sendBtn} onPress={send}>
              <Text style={{ color: C.white, fontSize: 18 }}>▶</Text>
            </TouchableOpacity>
            <TextInput
              style={cs.input}
              placeholder={t.chatPlaceholder}
              value={text}
              onChangeText={setText}
              placeholderTextColor={C.textSub}
              textAlign="right"
              onSubmitEditing={send}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const cs = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.blueDark, padding: 16 },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  bubble:      { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleMe:    { backgroundColor: C.white, borderWidth: 1, borderColor: C.blueBorder },
  bubbleOther: { backgroundColor: C.blue },
  inputRow:    { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.blueBorder },
  input:       { flex: 1, backgroundColor: C.bluePale, borderRadius: 10, padding: 10, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder },
  sendBtn:     { width: 42, height: 42, backgroundColor: C.blue, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});

// ─── Messages Screen ──────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const router = useRouter();
  const { t }  = useLanguage();
  const uid    = auth.currentUser?.uid || '';

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeChatId,  setActiveChatId]  = useState('');
  const [activeOtherUid,setActiveOtherUid]= useState('');
  const [activeOtherName,setActiveOtherName]= useState('');

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid),
    );
    const unsub = onSnapshot(q, snap => {
      const convs = snap.docs.map(d => {
        const data = d.data();
        const otherUid  = (data.participants || []).find((p: string) => p !== uid) || '';
        const otherName = data.participantNames?.[otherUid] || '?';
        return {
          chatId: d.id, otherUid, otherName,
          lastMessage:   data.lastMessage   || '',
          lastMessageAt: data.lastMessageAt || '',
        };
      }).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      setConversations(convs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  const openChat = (conv: any) => {
    setActiveChatId(conv.chatId);
    setActiveOtherUid(conv.otherUid);
    setActiveOtherName(conv.otherName);
  };

  const fmtTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const n = new Date();
    if (d.toDateString() === n.toDateString())
      return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  };

  return (
    <SafeAreaView style={s.wrap}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={{ color: C.white, fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.messagesTitle}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
      ) : conversations.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 52, marginBottom: 14 }}>💬</Text>
          <Text style={s.emptyTitle}>{t.noMessagesYet}</Text>
          <Text style={s.emptySub}>{t.noMessagesSub}</Text>
          <TouchableOpacity style={s.goHomeBtn} onPress={() => router.push('/home')}>
            <Text style={s.goHomeBtnText}>🗺️ {t.nearbyBtn}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.chatId}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.convRow} onPress={() => openChat(item)}>
              <View style={s.convAvatar}>
                <Text style={s.convAvatarText}>{(item.otherName || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.convName}>{item.otherName}</Text>
                <Text style={s.convLast} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              <Text style={s.convTime}>{fmtTime(item.lastMessageAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <InlineChatModal
        chatId={activeChatId}
        otherUid={activeOtherUid}
        otherName={activeOtherName}
        visible={!!activeChatId}
        onClose={() => setActiveChatId('')}
      />


    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap:        { flex: 1, backgroundColor: C.bluePale },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.blueDark, padding: 16 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: C.white },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: C.textDark, marginBottom: 8 },
  emptySub:    { fontSize: 14, color: C.textSub, textAlign: 'center', marginBottom: 24 },
  goHomeBtn:   { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  goHomeBtnText:{ color: C.white, fontWeight: '800', fontSize: 15 },
  convRow:     { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.blueBorder, elevation: 2 },
  convAvatar:  { width: 50, height: 50, borderRadius: 25, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  convAvatarText: { color: C.white, fontWeight: '900', fontSize: 20 },
  convName:    { fontSize: 15, fontWeight: '700', color: C.textDark },
  convLast:    { fontSize: 12, color: C.textSub, marginTop: 3 },
  convTime:    { fontSize: 11, color: C.textSub },
});

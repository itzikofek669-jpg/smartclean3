import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, StatusBar, ActivityIndicator, Alert,
  ScrollView, KeyboardAvoidingView, BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TAB_BAR_CONTENT_HEIGHT } from '../lib/BottomTabBar';
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
// Firebase Storage לא נדרש — תמונות ואודיו נשמרים כ-base64 ב-Firestore
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { useLanguage, T, useAppColors, AppColors } from '../lib/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';

// expo-av נטען דינמית — לא קורס ב-Expo Go
let Audio: typeof import('expo-av').Audio | null = null;
try { Audio = require('expo-av').Audio; } catch (_) {}


function createCS(c: AppColors) {
  return StyleSheet.create({
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.blueDark, padding: 16 },
    closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: c.white },
    bubble:      { maxWidth: '80%', padding: 12, borderRadius: 16 },
    bubbleMe:    { backgroundColor: c.white, borderWidth: 1, borderColor: c.blueBorder },
    bubbleOther: { backgroundColor: c.blue },
    inputRow:    { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: c.white, borderTopWidth: 1, borderColor: c.blueBorder },
    input:       { flex: 1, backgroundColor: c.bluePale, borderRadius: 10, padding: 10, fontSize: 14, color: c.textDark, borderWidth: 1, borderColor: c.blueBorder },
    sendBtn:     { width: 42, height: 42, backgroundColor: c.blue, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  });
}

function createS(c: AppColors) {
  return StyleSheet.create({
    wrap:        { flex: 1, backgroundColor: c.bluePale },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.blueDark, padding: 16 },
    backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '900', color: c.white },
    center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle:  { fontSize: 18, fontWeight: '800', color: c.textDark, marginBottom: 8 },
    emptySub:    { fontSize: 14, color: c.textSub, textAlign: 'center', marginBottom: 24 },
    goHomeBtn:   { backgroundColor: c.blue, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
    goHomeBtnText:{ color: c.white, fontWeight: '800', fontSize: 15, textAlign: 'center' },
    convRow:     { backgroundColor: c.white, borderRadius: 14, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: c.blueBorder, elevation: 2 },
    convAvatar:  { width: 50, height: 50, borderRadius: 25, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
    convAvatarText: { color: c.white, fontWeight: '900', fontSize: 20 },
    convName:    { fontSize: 15, fontWeight: '700', color: c.textDark, textAlign: 'right' },
    convLast:    { fontSize: 12, color: c.textSub, marginTop: 3, textAlign: 'right' },
    convTime:    { fontSize: 11, color: c.textSub },
  });
}

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
  const C = useAppColors();
  const cs = createCS(C);
  const insets = useSafeAreaInsets();
  const [messages, setMessages]       = useState<any[]>([]);
  const [text, setText]               = useState('');
  const [selectedMsgs, setSelectedMsgs] = useState<Set<string>>(new Set());
  const [msgSelecting, setMsgSelecting] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId]     = useState<string | null>(null);
  const [viewerUri, setViewerUri]     = useState<string | null>(null);
  const recordingRef                  = useRef<any>(null);
  const soundRef                      = useRef<any>(null);
  const scrollRef                     = useRef<ScrollView>(null);
  const myUid                         = auth.currentUser?.uid || '';

  useEffect(() => {
    if (!chatId || !visible) return;
    const myUid = auth.currentUser?.uid;
    if (myUid) {
      updateDoc(doc(db, 'chats', chatId), { unreadBy: arrayRemove(myUid) }).catch(() => {});
    }
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (myUid) {
        updateDoc(doc(db, 'chats', chatId), { unreadBy: arrayRemove(myUid) }).catch(() => {});
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [chatId, visible]);

  // איפוס מצב בחירה בסגירה
  useEffect(() => {
    if (!visible) { setMsgSelecting(false); setSelectedMsgs(new Set()); }
  }, [visible]);

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
        await setDoc(doc(db, 'chats', chatId), {
          participants: [myUid, otherUid].sort(),
          lastMessage: msg,
          lastMessageAt: new Date().toISOString(),
          participantNames: { [myUid]: myName, [otherUid]: otherName },
          unreadBy: arrayUnion(otherUid),
        }, { merge: true });
        const otherDoc = await getDoc(doc(db, 'users', otherUid));
        const pushToken = otherDoc.data()?.pushToken;
        if (pushToken) {
          await sendPushNotification(pushToken, `💬 ${myName}`, msg);
        }
      } catch (_) {}
    } catch (_) {}
  };

  const sendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('', t.galleryPermDenied);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.25,
      base64: true,
      exif: false,
    });
    if (res.canceled || !res.assets[0]) return;
    const base64Data = res.assets[0].base64;
    if (!base64Data) return Alert.alert(t.error, t.imageReadError);
    // בדוק גודל — Firestore מוגבל ל-~700KB base64
    if (base64Data.length > 700_000) {
      return Alert.alert(t.imageTooLargeTitle, t.imageTooLargeMsg);
    }
    try {
      const myDoc = await getDoc(doc(db, 'users', myUid));
      const myName = myDoc.data()?.name || '...';
      // שמור base64 ישירות בהודעה
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        type: 'image',
        imageBase64: `data:image/jpeg;base64,${base64Data}`,
        fromUid: myUid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        participants: [myUid, otherUid].sort(),
        lastMessage: t.chatImageMsg,
        lastMessageAt: new Date().toISOString(),
        participantNames: { [myUid]: myName, [otherUid]: otherName },
        unreadBy: arrayUnion(otherUid),
      }, { merge: true });
      try {
        const otherDoc = await getDoc(doc(db, 'users', otherUid));
        const pushToken = otherDoc.data()?.pushToken;
        if (pushToken) await sendPushNotification(pushToken, `📷 ${myName}`, t.chatImageMsg);
      } catch (_) {}
    } catch (err: any) {
      Alert.alert(t.imageSendError, err?.message || t.error);
    }
  };

  const startRecording = async () => {
    if (!Audio) return Alert.alert(t.error, t.audioUnavailableMsg);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert(t.error, t.micPermDenied);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (_) {}
  };

  const stopAndSendRecording = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri || !chatId) return;
      // קרא כ-base64 דרך expo-file-system
      const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      if (!base64Data) return;
      if (base64Data.length > 700_000) return Alert.alert(t.audioTooLongTitle, t.audioTooLongMsg);
      try {
        const myDoc = await getDoc(doc(db, 'users', myUid));
        const myName = myDoc.data()?.name || '...';
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          type: 'audio',
          audioBase64: `data:audio/m4a;base64,${base64Data}`,
          fromUid: myUid,
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'chats', chatId), {
          participants: [myUid, otherUid].sort(),
          lastMessage: t.chatVoiceMsg,
          lastMessageAt: new Date().toISOString(),
          participantNames: { [myUid]: myName, [otherUid]: otherName },
          unreadBy: arrayUnion(otherUid),
        }, { merge: true });
      } catch (err: any) {
        Alert.alert(t.error, err?.message || t.audioSendError);
      }
    } catch (err: any) {
      Alert.alert(t.error, t.audioSendError);
    }
  };

  const playAudio = async (audioBase64: string | undefined, audioUrl: string | undefined, msgId: string) => {
    if (!Audio) return;
    const src = audioBase64 || audioUrl;
    if (!src) return;
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    if (playingId === msgId) { setPlayingId(null); return; }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: src }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId(msgId);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
          soundRef.current = null;
        }
      });
    } catch (_) { Alert.alert(t.error, t.audioPlayError); }
  };

  // לחיצה ארוכה — כניסה למצב בחירה
  const handleLongPress = (msgId: string) => {
    setMsgSelecting(true);
    setSelectedMsgs(new Set([msgId]));
  };

  // לחיצה רגילה במצב בחירה — טוגל
  const handleTap = (msgId: string) => {
    if (!msgSelecting) return;
    setSelectedMsgs(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  };

  const cancelSelection = () => {
    setMsgSelecting(false);
    setSelectedMsgs(new Set());
  };

  // מחיקת ההודעות הנבחרות
  const deleteSelected = async () => {
    if (selectedMsgs.size === 0) return;
    Alert.alert(
      `מחק ${selectedMsgs.size} הודעות`,
      'הפעולה אינה הפיכה.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await Promise.all(
                [...selectedMsgs].map(id => deleteDoc(doc(db, 'chats', chatId, 'messages', id)))
              );
              // עדכן lastMessage אם נמחקה האחרונה
              const remaining = messages.filter(m => !selectedMsgs.has(m.id));
              const last = remaining[remaining.length - 1];
              await updateDoc(doc(db, 'chats', chatId), {
                lastMessage: last?.text || '',
                lastMessageAt: last?.createdAt || '',
              });
            } catch (_) {}
            setDeleting(false);
            cancelSelection();
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (msgSelecting) { cancelSelection(); return true; }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, msgSelecting]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>

        {/* ── Header ── */}
        {msgSelecting ? (
          <View style={[cs.header, { backgroundColor: '#1E293B' }]}>
            <TouchableOpacity onPress={cancelSelection} style={cs.closeBtn}>
              <T style={{ color: '#fff', fontSize: 18 }}>✕</T>
            </TouchableOpacity>
            <T style={cs.headerTitle}>{selectedMsgs.size} נבחרו</T>
            <TouchableOpacity
              onPress={deleteSelected}
              disabled={deleting || selectedMsgs.size === 0}
              style={[cs.closeBtn, { backgroundColor: selectedMsgs.size > 0 ? '#EF4444' : '#64748B' }]}
            >
              <T style={{ color: '#fff', fontSize: 16 }}>🗑</T>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={cs.header}>
            <TouchableOpacity onPress={onClose} style={cs.closeBtn}>
              <T style={{ color: C.white, fontSize: 18 }}>←</T>
            </TouchableOpacity>
            <T style={cs.headerTitle}>{t.chatWithPrefix}{otherName}</T>
            <View style={{ width: 36 }} />
          </View>
        )}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map(m => {
              const isMe       = m.fromUid === myUid;
              const isSelected = selectedMsgs.has(m.id);
              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={msgSelecting ? 0.6 : 1}
                  onLongPress={() => handleLongPress(m.id)}
                  onPress={() => handleTap(m.id)}
                  style={{
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    backgroundColor: isSelected ? 'rgba(239,68,68,0.12)' : 'transparent',
                    borderRadius: 12,
                    padding: isSelected ? 4 : 0,
                  }}
                >
                  {/* עיגול סימון */}
                  {msgSelecting && (
                    <View style={{
                      position: 'absolute', top: 8,
                      [isMe ? 'left' : 'right']: 4,
                      width: 20, height: 20, borderRadius: 10,
                      backgroundColor: isSelected ? '#EF4444' : 'transparent',
                      borderWidth: 2, borderColor: isSelected ? '#EF4444' : '#94A3B8',
                      alignItems: 'center', justifyContent: 'center', zIndex: 1,
                    }}>
                      {isSelected && <T style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</T>}
                    </View>
                  )}
                  {m.type === 'image' ? (
                    <TouchableOpacity onPress={() => { const u = m.imageBase64 || m.imageUrl; if (u) setViewerUri(u); }} activeOpacity={0.85}>
                      <Image
                        source={{ uri: m.imageBase64 || m.imageUrl }}
                        style={{ width: 200, height: 150, borderRadius: 12, borderWidth: 1, borderColor: C.blueBorder }}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                  ) : m.type === 'audio' ? (
                    <TouchableOpacity
                      style={[
                        cs.bubble,
                        isMe ? cs.bubbleMe : cs.bubbleOther,
                        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
                      ]}
                      onPress={() => playAudio(m.audioBase64, m.audioUrl, m.id)}
                    >
                      <T style={{ fontSize: 22 }}>{playingId === m.id ? '⏸' : '▶️'}</T>
                      <T style={{ color: isMe ? C.textDark : C.white, fontSize: 13 }}>
                        🎤 {playingId === m.id ? 'מנגן...' : 'הודעה קולית'}
                      </T>
                    </TouchableOpacity>
                  ) : (
                    <View style={[cs.bubble, isMe ? cs.bubbleMe : cs.bubbleOther]}>
                      <T style={{ color: isMe ? C.textDark : C.white, fontSize: 14 }}>{m.text}</T>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── שורת כתיבה / מחיקה ── */}
          {msgSelecting ? (
            <View style={[cs.inputRow, { justifyContent: 'space-between', backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
              <TouchableOpacity onPress={cancelSelection} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <T style={{ color: '#64748B', fontWeight: '700', fontSize: 14 }}>ביטול</T>
              </TouchableOpacity>
              <T style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>
                {selectedMsgs.size > 0 ? `${selectedMsgs.size} הודעות נבחרו` : 'לחץ לבחור הודעה'}
              </T>
              <TouchableOpacity
                onPress={deleteSelected}
                disabled={deleting || selectedMsgs.size === 0}
                style={{
                  backgroundColor: selectedMsgs.size > 0 ? '#EF4444' : '#E2E8F0',
                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
                }}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <T style={{ color: selectedMsgs.size > 0 ? '#fff' : '#94A3B8', fontWeight: '800', fontSize: 14 }}>🗑 מחק</T>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View style={cs.inputRow}>
              <TouchableOpacity style={cs.sendBtn} onPress={send}>
                <T style={{ color: C.white, fontSize: 18 }}>◀</T>
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
              <TouchableOpacity
                style={{ width: 42, height: 42, backgroundColor: C.blueLight, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.blueBorder }}
                onPress={sendImage}
              >
                <T style={{ fontSize: 20 }}>📷</T>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isRecording ? '#EF4444' : '#25D366',
                }}
                onPressIn={startRecording}
                onPressOut={stopAndSendRecording}
              >
                <MaterialIcons name="mic" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* מציג תמונה במסך מלא */}
        <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={1} onPress={() => setViewerUri(null)}>
            <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 10, zIndex: 10 }} onPress={() => setViewerUri(null)}>
              <T style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</T>
            </TouchableOpacity>
            {viewerUri && (
              <Image source={{ uri: viewerUri }} style={{ width: '92%', height: '75%' }} contentFit="contain" />
            )}
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}


// ─── Messages Screen ──────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const router = useRouter();
  const { t, lang }  = useLanguage();
  const LOCALE_MAP: Record<string, string> = { he: 'he-IL', en: 'en-GB', ru: 'ru-RU', ar: 'ar-SA', fr: 'fr-FR', hi: 'hi-IN' };
  const C = useAppColors();
  const s = createS(C);
  const insets = useSafeAreaInsets();
  const uid    = auth.currentUser?.uid || '';

  const [conversations,    setConversations]    = useState<any[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [activeChatId,     setActiveChatId]     = useState('');
  const [activeOtherUid,   setActiveOtherUid]   = useState('');
  const [activeOtherName,  setActiveOtherName]  = useState('');

  // ── מצב בחירת שיחות ──
  const [convSelecting,    setConvSelecting]    = useState(false);
  const [selectedConvs,    setSelectedConvs]    = useState<Set<string>>(new Set());
  const [convDeleting,     setConvDeleting]     = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (convSelecting) { cancelConvSelection(); return true; }
      if (activeChatId)  { setActiveChatId(''); return true; }
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [activeChatId, convSelecting]);

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
    if (convSelecting) {
      toggleConvSelect(conv.chatId);
      return;
    }
    setActiveChatId(conv.chatId);
    setActiveOtherUid(conv.otherUid);
    setActiveOtherName(conv.otherName);
  };

  const handleLongPressConv = (chatId: string) => {
    setConvSelecting(true);
    setSelectedConvs(new Set([chatId]));
  };

  const toggleConvSelect = (chatId: string) => {
    setSelectedConvs(prev => {
      const next = new Set(prev);
      next.has(chatId) ? next.delete(chatId) : next.add(chatId);
      return next;
    });
  };

  const cancelConvSelection = () => {
    setConvSelecting(false);
    setSelectedConvs(new Set());
  };

  const deleteSelectedConvs = () => {
    if (selectedConvs.size === 0) return;
    Alert.alert(
      t.deleteConvsTitle,
      t.deleteConvsMsg,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.portfolioDeleteBtn, style: 'destructive',
          onPress: async () => {
            setConvDeleting(true);
            try {
              await Promise.all(
                [...selectedConvs].map(id => deleteDoc(doc(db, 'chats', id)))
              );
            } catch (_) {}
            setConvDeleting(false);
            cancelConvSelection();
          },
        },
      ]
    );
  };

  const fmtTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const n = new Date();
    if (d.toDateString() === n.toDateString())
      return d.toLocaleTimeString(LOCALE_MAP[lang] || 'he-IL', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { day: '2-digit', month: '2-digit' });
  };

  return (
    <SafeAreaView style={s.wrap} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />

      {/* ── Header ── */}
      {convSelecting ? (
        <View style={[s.header, { paddingTop: (StatusBar.currentHeight || 0) + 12, backgroundColor: '#1E293B' }]}>
          <TouchableOpacity onPress={cancelConvSelection} style={s.backBtn}>
            <T style={{ color: C.white, fontSize: 18 }}>✕</T>
          </TouchableOpacity>
          <T style={s.headerTitle}>
            {selectedConvs.size > 0 ? `${selectedConvs.size} שיחות נבחרו` : 'בחר שיחות'}
          </T>
          <TouchableOpacity
            onPress={deleteSelectedConvs}
            disabled={convDeleting || selectedConvs.size === 0}
            style={[s.backBtn, { backgroundColor: selectedConvs.size > 0 ? '#EF4444' : 'rgba(255,255,255,0.15)' }]}
          >
            {convDeleting
              ? <ActivityIndicator size="small" color="#fff" />
              : <T style={{ color: '#fff', fontSize: 16 }}>🗑</T>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[s.header, { paddingTop: (StatusBar.currentHeight || 0) + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <T style={{ color: C.white, fontSize: 20 }}>←</T>
          </TouchableOpacity>
          <T style={s.headerTitle}>{t.messagesTitle}</T>
          <View style={{ width: 36 }} />
        </View>
      )}

      {/* ── תוכן ── */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
      ) : conversations.length === 0 ? (
        <View style={s.empty}>
          <T style={{ fontSize: 52, marginBottom: 14 }}>💬</T>
          <T style={s.emptyTitle}>{t.noMessagesYet}</T>
          <T style={s.emptySub}>{t.noMessagesSub}</T>
          <TouchableOpacity style={s.goHomeBtn} onPress={() => router.push('/home')}>
            <T style={s.goHomeBtnText}>🗺️ {t.nearbyBtn}</T>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* רצועת מידע במצב בחירה */}
          {convSelecting && (
            <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#FCA5A5' }}>
              <TouchableOpacity onPress={() => {
                if (selectedConvs.size === conversations.length) {
                  setSelectedConvs(new Set());
                } else {
                  setSelectedConvs(new Set(conversations.map(c => c.chatId)));
                }
              }}>
                <T style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>
                  {selectedConvs.size === conversations.length ? '✕ בטל הכל' : '✓ בחר הכל'}
                </T>
              </TouchableOpacity>
              <T style={{ color: '#64748B', fontSize: 12 }}>לחיצה ארוכה לבחירה</T>
            </View>
          )}

          <FlatList
            data={conversations}
            keyExtractor={item => item.chatId}
            contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 16 }}
            renderItem={({ item }) => {
              const isSelected = selectedConvs.has(item.chatId);
              return (
                <TouchableOpacity
                  style={[
                    s.convRow,
                    isSelected && { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
                  ]}
                  onPress={() => openChat(item)}
                  onLongPress={() => handleLongPressConv(item.chatId)}
                  delayLongPress={350}
                >
                  {/* עיגול סימון */}
                  {convSelecting && (
                    <View style={{
                      width: 24, height: 24, borderRadius: 12,
                      backgroundColor: isSelected ? '#EF4444' : 'transparent',
                      borderWidth: 2, borderColor: isSelected ? '#EF4444' : '#94A3B8',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <T style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</T>}
                    </View>
                  )}
                  <View style={[s.convAvatar, isSelected && { backgroundColor: '#EF4444' }]}>
                    <T style={s.convAvatarText}>{(item.otherName || '?').charAt(0).toUpperCase()}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T style={s.convName}>{item.otherName}</T>
                    <T style={s.convLast} numberOfLines={1}>{item.lastMessage}</T>
                  </View>
                  <T style={s.convTime}>{fmtTime(item.lastMessageAt)}</T>
                </TouchableOpacity>
              );
            }}
          />

          {/* כפתור מחיקה תחתון במצב בחירה */}
          {convSelecting && selectedConvs.size > 0 && (
            <View style={{ padding: 12, paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 8, backgroundColor: C.white, borderTopWidth: 1, borderColor: '#FCA5A5' }}>
              <TouchableOpacity
                onPress={deleteSelectedConvs}
                disabled={convDeleting}
                style={{ backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              >
                {convDeleting
                  ? <ActivityIndicator color="#fff" />
                  : <T style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>🗑 מחק {selectedConvs.size} שיחות</T>
                }
              </TouchableOpacity>
            </View>
          )}
        </>
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


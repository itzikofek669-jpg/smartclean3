import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, StatusBar, ActivityIndicator, Alert,
  ScrollView, KeyboardAvoidingView, BackHandler, Keyboard, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TAB_BAR_CONTENT_HEIGHT } from '../lib/BottomTabBar';
import {
  collection, query, where, onSnapshot, orderBy,
  addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { setActiveChat } from '../lib/chatPresence';
// Firebase Storage לא נדרש — תמונות ואודיו נשמרים כ-base64 ב-Firestore
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useLanguage, T, useAppColors, AppColors } from '../lib/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';

// expo-audio — הקלטה והשמעה של הודעות קוליות (SDK 54, מחליף את expo-av)
import { useAudioRecorder, createAudioPlayer, RecordingPresets, setAudioModeAsync, AudioModule } from 'expo-audio';


function createCS(c: AppColors) {
  return StyleSheet.create({
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.blueDark, padding: 16 },
    closeBtn:    { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
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
    backBtn:     { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
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
  const { t, flipSide } = useLanguage();
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
  const audioRecorder                 = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const micReadyRef                   = useRef(false);
  const playerRef                     = useRef<any>(null);

  // Pre-acquire mic permission + recording audio mode when the chat opens, so
  // the first press-and-hold doesn't lose its start to the permission dialog.
  useEffect(() => {
    (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) return;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        micReadyRef.current = true;
      } catch (_) {}
    })();
  }, []);
  const scrollRef                     = useRef<ScrollView>(null);
  const myUid                         = auth.currentUser?.uid || '';

  // גלילה לסוף הצ'אט כשהמקלדת נפתחת — שההודעה האחרונה תמיד גלויה
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!chatId || !visible) { setActiveChat(null); return; }
    setActiveChat(chatId);   // המשתמש נמצא בצ'אט הזה — לא להקפיץ פופ-אפ עליו
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
    return () => { unsub(); setActiveChat(null); };
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
          lastSenderUid: myUid,
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
      quality: 1,
      base64: false,
      exif: false,
    });
    if (res.canceled || !res.assets[0]) return;
    // Resize + compress so the image always fits Firestore's ~700KB base64 limit
    // (iOS photos are large; rejecting them was the "image too large" error).
    const srcUri = res.assets[0].uri;
    let base64Data: string | null | undefined;
    try {
      const steps: { width: number; compress: number }[] = [
        { width: 1080, compress: 0.5 },
        { width: 900, compress: 0.4 },
        { width: 720, compress: 0.35 },
      ];
      for (const st of steps) {
        const out = await ImageManipulator.manipulateAsync(
          srcUri,
          [{ resize: { width: st.width } }],
          { compress: st.compress, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        base64Data = out.base64;
        if (base64Data && base64Data.length <= 700_000) break;
      }
    } catch (_) {
      return Alert.alert(t.error, t.imageReadError);
    }
    if (!base64Data) return Alert.alert(t.error, t.imageReadError);
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
        lastSenderUid: myUid,
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
    setIsRecording(true);   // instant UI feedback (don't wait on async setup)
    try {
      if (!micReadyRef.current) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) { setIsRecording(false); return Alert.alert(t.error, t.micPermDenied); }
        micReadyRef.current = true;
      }
      // playback may have switched the session to playback mode — switch back
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (_) { setIsRecording(false); }
  };

  const stopAndSendRecording = async () => {
    if (!audioRecorder.isRecording) { setIsRecording(false); return; }
    setIsRecording(false);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
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
          lastSenderUid: myUid,
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
    const src = audioBase64 || audioUrl;
    if (!src) return;
    if (playerRef.current) {
      try { playerRef.current.remove(); } catch (_) {}
      playerRef.current = null;
    }
    if (playingId === msgId) { setPlayingId(null); return; }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      let playSrc = src;
      // data URI → כתוב לקובץ זמני להשמעה אמינה ב-Android
      if (src.startsWith('data:')) {
        const base64 = src.substring(src.indexOf(',') + 1);
        const path = (FileSystem.cacheDirectory || '') + `voice_${msgId}.m4a`;
        await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' as any });
        playSrc = path;
      }
      const player = createAudioPlayer({ uri: playSrc });
      playerRef.current = player;
      setPlayingId(msgId);
      let started = false;
      const startPlayback = () => {
        if (started || !player.isLoaded) return;
        started = true;
        try { player.volume = 1.0; player.play(); } catch (_) {}
      };
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.isLoaded) startPlayback();
        if (status?.didJustFinish) {
          setPlayingId(null);
          try { player.remove(); } catch (_) {}
          playerRef.current = null;
        }
      });
      startPlayback();
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
          <View style={[cs.header, { backgroundColor: '#1E293B' }, flipSide && { flexDirection: 'row-reverse' }]}>
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
          <View style={[cs.header, flipSide && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity onPress={onClose} style={cs.closeBtn}>
              <MaterialIcons name="arrow-back" size={24} color={C.white} />
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
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
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
                <T style={{ color: '#64748B', fontWeight: '700', fontSize: 14 }}>{t.cancel}</T>
              </TouchableOpacity>
              <T style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>
                {selectedMsgs.size > 0 ? `${selectedMsgs.size} ${t.msgsSelectedSuffix}` : t.tapToSelectMsg}
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
                  : <T style={{ color: selectedMsgs.size > 0 ? '#fff' : '#94A3B8', fontWeight: '800', fontSize: 14 }}>{t.deleteBtn}</T>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View style={cs.inputRow}>
              {isRecording && (
                <View style={{ position: 'absolute', top: -34, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ color: '#fff', fontWeight: '800', fontSize: 13, backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, overflow: 'hidden' }}>{t.recordingAudio}</T>
                </View>
              )}
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
  const { t, lang, flipSide }  = useLanguage();
  const LOCALE_MAP: Record<string, string> = { he: 'he-IL', en: 'en-GB', ru: 'ru-RU', ar: 'ar-SA', fr: 'fr-FR', hi: 'hi-IN' };
  const C = useAppColors();
  const s = createS(C);
  const insets = useSafeAreaInsets();
  const uid    = auth.currentUser?.uid || '';
  const params = useLocalSearchParams();

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
      if (router.canGoBack()) router.back(); else router.replace('/home');
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
    const nameCache: Record<string, string> = {};
    const unsub = onSnapshot(q, async snap => {
      const convs = snap.docs.map(d => {
        const data = d.data();
        // self-chat (participants are all the same uid) → fall back to own uid
        const otherUid  = (data.participants || []).find((p: string) => p !== uid) || uid;
        const stored    = data.participantNames?.[otherUid];
        const otherName = (stored && stored !== '?') ? stored : '';   // treat '?' as missing
        return {
          chatId: d.id, otherUid, otherName,
          lastMessage:   data.lastMessage   || '',
          lastMessageAt: data.lastMessageAt || '',
        };
      }).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      // Fill in any missing names from the users collection (some chat docs are
      // created by voice/image/confirm flows that don't write participantNames).
      await Promise.all(convs.map(async c => {
        if (c.otherName || !c.otherUid) return;
        if (nameCache[c.otherUid]) { c.otherName = nameCache[c.otherUid]; return; }
        try {
          const us = await getDoc(doc(db, 'users', c.otherUid));
          const d  = (us.data() as any) || {};
          const nm = d.name || d.fullName || d.displayName || d.cleanerName ||
                     (d.email ? String(d.email).split('@')[0] : '');
          if (nm) { nameCache[c.otherUid] = nm; c.otherName = nm; }
        } catch (_) {}
      }));
      convs.forEach(c => { if (!c.otherName) c.otherName = '?'; });
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

  // פתיחת צ'אט אוטומטית מתוך פופ-אפ "הודעה חדשה" (ניווט עם פרמטרים)
  useEffect(() => {
    const cid = String(params.openChatId || '');
    if (cid) {
      setActiveChatId(cid);
      setActiveOtherUid(String(params.openOtherUid || ''));
      setActiveOtherName(String(params.openOtherName || ''));
    }
  }, [params.openChatId]);

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
        <View style={[s.header, { paddingTop: (Platform.OS === 'ios' ? insets.top : (StatusBar.currentHeight || 0)) + 12, backgroundColor: '#1E293B' }, flipSide && { flexDirection: 'row-reverse' }]}>
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
        <View style={[s.header, { paddingTop: (Platform.OS === 'ios' ? insets.top : (StatusBar.currentHeight || 0)) + 12 }, flipSide && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }} style={s.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={C.white} />
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
                  {selectedConvs.size === conversations.length ? t.deselectAll : t.selectAll}
                </T>
              </TouchableOpacity>
              <T style={{ color: '#64748B', fontSize: 12 }}>{t.longPressSelect}</T>
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


import React, { useEffect, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, Modal, Switch, Share, Linking,
  TextInput, KeyboardAvoidingView, Platform, BackHandler, Clipboard, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, arrayRemove, arrayUnion, onSnapshot, runTransaction,
} from 'firebase/firestore';
import { auth, db , storage } from '../lib/firebase';
import { setActiveChat } from '../lib/chatPresence';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
// expo-audio — הקלטה והשמעה של הודעות קוליות (SDK 54, מחליף את expo-av)
import { useAudioRecorder, createAudioPlayer, RecordingPresets, setAudioModeAsync, AudioModule } from 'expo-audio';
import { useLanguage, T, useAppColors, AppColors } from '../lib/LanguageContext';
import ServiceInfoBtn from '../lib/ServiceInfoBtn';
import { Lang } from '../lib/translations';
import AccessibilityModal from '../lib/AccessibilityModal';
import { MaterialIcons } from '@expo/vector-icons';
import { TAB_BAR_CONTENT_HEIGHT } from '../lib/BottomTabBar';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';


function createRM(c: AppColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card:     { backgroundColor: c.white, borderRadius: 20, padding: 24, width: '100%', alignItems: 'center', gap: 14 },
    title:    { fontSize: 18, fontWeight: '900', color: c.textDark },
    sub:      { fontSize: 14, color: c.textSub, marginBottom: 4 },
    btns:     { flexDirection: 'row', gap: 12, marginTop: 4, width: '100%' },
    skip:     { flex: 1, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: c.blueBorder, alignItems: 'center' },
    skipTxt:  { color: c.textSub, fontWeight: '600' },
    submit:   { flex: 2, padding: 13, borderRadius: 12, backgroundColor: c.blue, alignItems: 'center' },
    submitTxt:{ color: c.white, fontWeight: '800' },
  });
}

function createEP(c: AppColors) {
  return StyleSheet.create({
    label:        { fontSize: 13, fontWeight: '700', color: c.textDark, marginBottom: 6, textAlign: 'right' },
    input:        { backgroundColor: c.white, borderRadius: 12, padding: 13, fontSize: 14, color: c.textDark, borderWidth: 1, borderColor: c.blueBorder },
    pill:         { backgroundColor: c.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: c.blueBorder },
    pillActive:   { backgroundColor: c.blue, borderColor: c.blue },
    pillText:     { fontSize: 13, fontWeight: '600', color: c.textDark },
    pillTextActive:{ color: c.white, fontWeight: '700' },
    saveBtn:      { backgroundColor: c.blue, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
    saveBtnText:  { fontSize: 16, fontWeight: '800', color: c.white },
  });
}

function createS(c: AppColors) {
  return StyleSheet.create({
    wrap:        { flex: 1, backgroundColor: c.bluePale },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.blueDark, padding: 16 },
    backBtn:     { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: c.white },
    loader:      { flex: 1, alignItems: 'center', justifyContent: 'center' },

    hero:           { backgroundColor: c.blue, padding: 28, alignItems: 'center', gap: 6 },
    avatarWrap:     { position: 'relative', marginBottom: 6 },
    avatarImg:      { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
    avatarFallback: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
    avatarText:     { fontSize: 32, fontWeight: '900', color: c.white },
    cameraBtn:      { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: c.blueDark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.white },
    name:           { fontSize: 22, fontWeight: '900', color: c.white },
    email:          { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
    roleBadge:          { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 4 },
    roleBadgeText:      { fontSize: 13, fontWeight: '700', color: c.white },
    editProfileBtn:     { backgroundColor: c.white, borderRadius: 24, paddingHorizontal: 32, paddingVertical: 12, marginTop: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, alignItems: 'center', justifyContent: 'center' },
    editProfileBtnText: { fontSize: 18, fontWeight: '900', color: c.blueDark, textAlign: 'center' },

    statsRow:    { flexDirection: 'row', backgroundColor: c.white, marginHorizontal: 16, marginTop: 16, borderRadius: 16, paddingVertical: 18, borderWidth: 1, borderColor: c.blueBorder },
    statBox:     { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: c.blueBorder },
    statVal:     { fontSize: 22, fontWeight: '900', color: c.blue },
    statLabel:   { fontSize: 11, color: c.textSub, marginTop: 3 },

    section:      { marginHorizontal: 16, marginTop: 20 },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: c.textDark, marginBottom: 12 },

    emptyBox:     { backgroundColor: c.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: c.blueBorder },
    emptyText:    { fontSize: 15, fontWeight: '700', color: c.textDark },
    emptySubText: { fontSize: 12, color: c.textSub, marginTop: 4 },

    // Phone Privacy
    phoneToggleRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: c.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.blueBorder },
    phoneToggleLabel: { fontSize: 14, fontWeight: '700', color: c.textDark, marginBottom: 3 },
    phoneToggleSub:   { fontSize: 12, color: c.textSub },

    // Active badge
    activeBadge:     { backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FCD34D' },
    activeBadgeText: { fontSize: 11, fontWeight: '700', color: c.orange },

    bookingCard:       { backgroundColor: c.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.blueBorder, elevation: 2 },
    bookingTop:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    bookingAvatar:     { width: 42, height: 42, borderRadius: 21, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
    bookingAvatarText: { color: c.white, fontWeight: '900', fontSize: 15 },
    bookingName:       { fontSize: 14, fontWeight: '700', color: c.textDark },
    bookingDate:       { fontSize: 11, color: c.textSub, marginTop: 2 },
    totalBadge:        { backgroundColor: c.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
    totalBadgeText:    { fontSize: 15, fontWeight: '900', color: c.blue },
    bookingDetails:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    detailPill:        { backgroundColor: c.bluePale, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: c.blueBorder },
    detailPillText:    { fontSize: 11, fontWeight: '600', color: c.textDark },

    statusPill:        { backgroundColor: c.greenBg },
    statusPillText:    { fontSize: 11, fontWeight: '700', color: c.green },
    statusPillActive:  { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
    statusPillTextActive: { fontSize: 11, fontWeight: '700', color: c.orange },
    statusPillPending: { backgroundColor: c.bluePale, borderColor: c.blueBorder },
    statusPillTextPending: { fontSize: 11, fontWeight: '600', color: c.textSub },
    statusPillCancelled: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
    statusPillTextCancelled: { fontSize: 11, fontWeight: '700', color: '#DC2626' },

    addressText:       { fontSize: 11, color: c.textSub, marginTop: 8 },

    // Times row
    timesRow:      { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
    timeChip:      { backgroundColor: c.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: c.blueBorder, alignItems: 'center' },
    timeChipLabel: { fontSize: 9, color: c.textSub, fontWeight: '600', marginBottom: 2 },
    timeChipVal:   { fontSize: 13, fontWeight: '900', color: c.blue },

    // Start / End buttons
    startBtn:     { marginTop: 10, backgroundColor: c.blue, borderRadius: 10, padding: 12, alignItems: 'center' },
    startBtnText: { fontSize: 14, fontWeight: '800', color: c.white },
    endBtn:       { marginTop: 10, backgroundColor: c.green, borderRadius: 10, padding: 12, alignItems: 'center' },
    endBtnText:   { fontSize: 14, fontWeight: '800', color: c.white },
    cancelBtn:     { marginTop: 10, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' },
    cancelBtnText: { fontSize: 14, fontWeight: '800', color: '#DC2626' },

    rateBtn:     { marginTop: 10, backgroundColor: c.blueLight, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: c.blueBorder },
    rateBtnText: { fontSize: 13, fontWeight: '700', color: c.blue },
    ratedRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    ratedLabel:  { fontSize: 12, color: c.textSub },

    // Photos
    photoBtn:     { backgroundColor: c.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: c.blueBorder, alignItems: 'center', justifyContent: 'center' },
    photoBtnText: { fontSize: 11, fontWeight: '700', color: c.blue },

    // Dashboard
    dashRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    dashCard: { flex: 1, minWidth: '44%', backgroundColor: c.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: c.blueBorder },
    dashVal:  { fontSize: 22, fontWeight: '900', color: c.blue },
    dashLabel:{ fontSize: 11, color: c.textSub, marginTop: 4, textAlign: 'center' },

    // Referral
    referralCard:        { backgroundColor: c.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.blueBorder },
    referralBonus:       { fontSize: 13, color: c.textMid, marginBottom: 12, lineHeight: 20 },
    referralCodeRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
    referralCodeText:    { fontSize: 24, fontWeight: '900', color: c.blue, letterSpacing: 3, flex: 1 },
    referralShareBtn:    { backgroundColor: c.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    referralShareBtnText:{ fontSize: 13, fontWeight: '800', color: c.white, textAlign: 'center' },

    // Booking history compact row + modal
    historyCompactRow:  { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: c.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.blueBorder, gap: 12 },
    historyCompactIcon: { fontSize: 26 },
    historyCompactTitle:{ fontSize: 15, fontWeight: '800', color: c.textDark, textAlign: 'right' },
    historyCompactSub:  { fontSize: 13, color: c.textSub, marginTop: 2, textAlign: 'right' },
    historyCompactArrow:{ fontSize: 26, color: c.textSub, fontWeight: '300' },
    historySheet:       { backgroundColor: c.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },

    // Insurance card
    insuranceCard:        { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#BFDBFE', alignItems: 'center' },
    insuranceCardTitle:   { fontSize: 15, fontWeight: '800', color: '#1E3A8A', marginBottom: 4, textAlign: 'center' },
    insuranceCardSub:     { fontSize: 13, color: '#3B82F6', marginBottom: 14, lineHeight: 20, textAlign: 'center' },
    insuranceBtnLarge:    { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 12, alignItems: 'center', width: '100%' },
    insuranceBtnLargeText:{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

    areaBtn:          { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: c.white, borderWidth: 1.5, borderColor: c.blueBorder, alignItems: 'center' },
    areaBtnActive:    { backgroundColor: c.blue, borderColor: c.blue },
    areaBtnText:      { fontSize: 13, fontWeight: '700', color: c.textDark },
    areaBtnTextActive:{ color: c.white },
    langBtn:          { width: '30%', paddingVertical: 10, borderRadius: 10, backgroundColor: c.white, borderWidth: 1.5, borderColor: c.blueBorder, alignItems: 'center' },
    langBtnActive:    { backgroundColor: c.blue, borderColor: c.blue },
    langBtnText:      { fontSize: 12, fontWeight: '700', color: c.textDark, textAlign: 'center' },
    langBtnTextActive:{ color: c.white },

    dayRow:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dayHourLabel:     { fontSize: 13, fontWeight: '800', color: c.green, minWidth: 42, textAlign: 'right' },
    dayBtn:           { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: c.white, borderWidth: 1.5, borderColor: c.blueBorder, minWidth: 52, alignItems: 'center' },
    dayBtnActive:     { backgroundColor: c.green, borderColor: c.green },
    dayBtnText:       { fontSize: 12, fontWeight: '700', color: c.textDark },
    dayBtnTextActive: { color: c.white },
    hoursRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
    hourCtrl:         { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: c.blueLight, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderColor: c.blueBorder },
    hourArrow:        { padding: 4 },
    hourArrowText:    { fontSize: 12, color: c.blue, fontWeight: '700' },
    hourVal:          { fontSize: 13, fontWeight: '900', color: c.textDark, minWidth: 42, textAlign: 'center' },
    hourDash:         { fontSize: 14, color: c.textSub, fontWeight: '600' },

    // Recurring badge
    recurBadge: { backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '700', color: '#7C3AED' },

    // On-way button
    onWayBtn:         { backgroundColor: '#F97316', borderRadius: 10, padding: 12, alignItems: 'center' },
    onWayBtnText:     { fontSize: 14, fontWeight: '800', color: c.white },

    // Status pills new
    statusPillOnWay:       { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
    statusPillTextOnWay:   { fontSize: 11, fontWeight: '700', color: '#D97706' },
    statusPillConfirmed:     { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD' },
    statusPillTextConfirmed: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },

    // Chat from cleaner side
    chatCardBtn:     { marginTop: 8, backgroundColor: c.blueLight, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: c.blueBorder },
    chatCardBtnText: { fontSize: 13, fontWeight: '700', color: c.blue },
    chatBubble:            { maxWidth: '80%', padding: 12, borderRadius: 16 },
    chatBubbleMe:          { backgroundColor: c.white, borderWidth: 1, borderColor: c.blueBorder },
    chatBubbleOther:       { backgroundColor: c.blue },
    chatAudioBubble:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: '80%' },
    chatAudioBubbleMe:     { backgroundColor: c.blueLight, borderWidth: 1, borderColor: c.blueBorder },
    chatAudioBubbleOther:  { backgroundColor: c.blue },
    chatInputRow:          { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: c.white, borderTopWidth: 1, borderColor: c.blueBorder },
    chatTextInput:         { flex: 1, backgroundColor: c.bluePale, borderRadius: 10, padding: 10, fontSize: 14, color: c.textDark, borderWidth: 1, borderColor: c.blueBorder },
    chatSendBtn:           { width: 42, height: 42, backgroundColor: c.blue, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    chatMicBtn:            { width: 42, height: 42, backgroundColor: c.blueLight, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.blueBorder },
    chatMicBtnRecording:   { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },

    // Schedule block
    scheduleBlock: { backgroundColor: c.blueLight, borderRadius: 6, padding: 4, width: '100%', borderWidth: 1, borderColor: c.blueBorder, marginBottom: 2 },

    // Tab buttons (cleaner)
    tabBtn:          { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: c.white, borderWidth: 1.5, borderColor: c.blueBorder, alignItems: 'center' },
    tabBtnActive:    { backgroundColor: c.blue, borderColor: c.blue },
    tabBtnText:      { fontSize: 10, fontWeight: '700', color: c.textDark },
    tabBtnTextActive:{ color: c.white },

    // Report button (bottom of page)
    reportBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#FCA5A5' },
    reportBtnText: { fontSize: 15, fontWeight: '800', color: '#DC2626' },
  });
}

const PAY_ICONS: Record<string, string> = { bit: '📱', cash: '💵', paybox: '🅿️', bank: '🏦' };
// מעקב הזמנות שכבר הוצגו לאישור — ברמת המודול כדי לשרוד טעינות-מחדש של הפרופיל (ניווט מפוש)
const SHOWN_PENDING = new Set<string>();
// מעקב הזמנות שכבר אושרו — מונע שליחת פוש/הודעת אישור פעמיים
const CONFIRM_SENT = new Set<string>();

const SERVICE_ICONS: Record<string, string> = {
  'ניקיון רגיל': '🏠', 'ניקוי לפסח': '🧹', 'חלונות': '🪟', 'לאחר שיפוץ': '🔨',
  'שטיפת רכב': '🚗', 'ניקיון משרדים': '🏢', 'ניקיון אחרי אירוע': '🎉',
  'מחסן ועליית גג': '📦', 'סידורי בגדים וארונות': '👔',
};

const SERVICE_DETAIL: Record<string, string[]> = {
  'ניקיון רגיל': [
    '🫧 שטיפת רצפות וניגוב בכל חדרי הבית',
    '🪣 ניקוי אבק ממשטחים, רהיטים ופריטי דקורציה',
    '🚿 ניקוי חדרי רחצה ושירותים — אריחים, כיורים ואסלות',
    '🛋️ סידור הבית — סדר כללי בחדרים',
  ],
  'ניקוי לפסח': [
    '🔍 ניקוי יסודי של כל פינות הבית',
    '🍞 בדיקה והסרת חמץ מכל הפינות',
    '🧴 חיטוי מגירות, מדפים וארונות',
    '✨ ניקוי תנור, כיריים ומכשירי חשמל',
  ],
  'חלונות': [
    '🪟 שטיפת זגוגיות מבפנים ומבחוץ',
    '🧹 ניקוי מסגרות, שולי חלון וסורגים',
    '💧 ייבוש ומיצוי ללא פסים',
  ],
  'שטיפת רכב': [
    '🚗 שטיפת חיצון הרכב בלחץ מים',
    '🧽 ניקוי פנים הרכב — ריפוד, שטיח ותא מטען',
    '✨ ניקוי חלונות ושמשות מבפנים',
  ],
  'לאחר שיפוץ': [
    '🔨 פינוי פסולת, אבק בנייה וחומרי שיפוץ',
    '🧴 שטיפה עמוקה של כל הרצפות — פרקט, אריחים ושיש',
    '🪟 ניקוי חלונות ומסגרות — הסרת סיד וכתמי צבע',
    '🚪 ניקוי דלתות, משקופים וידיות',
    '🪑 ניקוי ארונות ומדפים מבפנים ומבחוץ',
    '🚿 ניקוי חדרי רחצה ושירותים — אריחים, כיורים ואסלות',
    '🍳 ניקוי מטבח — משטחי עבודה, כיור ורצפות',
    '💡 ניקוי נקודות תאורה, שקעים ומתגים',
    '✅ ניקוי סופי יסודי — הדירה מוכנה למגורים',
  ],
  'ניקיון משרדים': [
    '🏢 שטיפת רצפות ומשטחי עבודה',
    '🗑️ פינוי פסולת ורענון פחים',
    '🪟 ניקוי חלונות וחלל המשרד',
    '🧴 חיטוי שירותים ומטבחון',
  ],
  'ניקיון אחרי אירוע': [
    '🎉 פינוי כלים, שיירי אוכל ופסולת',
    '🧹 שטיפת רצפות וניגוב משטחים',
    '🗑️ סידור ופינוי כסאות ושולחנות',
    '✨ החזרת הבית למצב רגיל',
  ],
  'מחסן ועליית גג': [
    '📦 מיון וסידור תכולת המחסן',
    '🧹 שטיפה וניקוי הרצפה והקירות',
    '🗑️ פינוי פסולת ופריטים ישנים לפי בחירת הלקוח',
  ],
  'סידורי בגדים וארונות': [
    '👔 מיון בגדים לפי קטגוריות — עליון, תחתון, עונות',
    '🗂️ סידור ארונות בצורה מסודרת ונגישה',
    '👗 קיפול וסידור חולצות, מכנסיים ושמלות',
    '🧦 סידור גרביים ותחתונים בתאים ייעודיים',
    '🧥 ארגון מעילים, סוודרים ובגדי עונות',
    '📦 מיון בגדים לתרומה / אחסון עונתי לפי בחירת הלקוח',
    '✨ סידור אחיד ומרשים שנוח לשימוש יומיומי',
  ],
};

const DAYS_KEYS = ['sun','mon','tue','wed','thu','fri','sat'] as const;

async function sendPushNotification(token: string, title: string, body: string, data?: any) {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token, title, body,
        sound: 'default',
        channelId: 'messages',
        priority: 'high',
        ...(data ? { data } : {}),
      }),
    });
  } catch (_) {}
}

const LOCALE_MAP: Record<string, string> = { he: 'he-IL', en: 'en-GB', ru: 'ru-RU', ar: 'ar-SA', fr: 'fr-FR', hi: 'hi-IN' };

function formatDate(iso: string, lang = 'he') {
  const d = new Date(iso);
  return d.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso: string, lang = 'he') {
  const d = new Date(iso);
  return d.toLocaleTimeString(LOCALE_MAP[lang] || 'he-IL', { hour: '2-digit', minute: '2-digit' });
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
  const C = useAppColors();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1,2,3,4,5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange(i)}>
          <T style={{ fontSize: 30, color: i <= value ? C.gold : C.blueBorder }}>★</T>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Rate Modal ───────────────────────────────────────────────────────────────
function RateModal({ booking, visible, isCleaner, onClose, onSubmit }: any) {
  const { t } = useLanguage();
  const C = useAppColors();
  const rm = createRM(C);
  const [stars, setStars] = useState(0);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={rm.backdrop}>
        <View style={rm.card}>
          <T style={rm.title}>{isCleaner ? t.rateCleanerLbl : t.rateTitle}</T>
          <T style={rm.sub}>{isCleaner ? booking?.clientName : booking?.cleanerName}</T>
          <StarPicker value={stars} onChange={setStars} />
          <View style={rm.btns}>
            <TouchableOpacity style={rm.skip} onPress={onClose}>
              <T style={rm.skipTxt}>{t.rateSkip}</T>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rm.submit, !stars && { opacity: 0.5 }]}
              disabled={!stars}
              onPress={() => { onSubmit(stars); setStars(0); }}
            >
              <T style={rm.submitTxt}>{t.rateSubmit}</T>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { tab, requestId, section, acceptReqId, confirmBookingId } = useLocalSearchParams<{ tab?: string; requestId?: string; section?: string; acceptReqId?: string; confirmBookingId?: string }>();
  const { t, lang, setLang, flipSide } = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const ep = createEP(C);
  const insets = useSafeAreaInsets();
  const [a11yOpen, setA11yOpen] = useState(false);

  const uid    = auth.currentUser?.uid || '';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) router.back(); else router.replace('/home');
      return true;
    });
    return () => sub.remove();
  }, []);

  // Auto-open section from drawer deep-link
  useEffect(() => {
    if (section === 'history') setHistoryOpen(true);
  }, [section]);

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
  const [portfolio,    setPortfolio]    = useState<string[]>([]);
  const [idVerified,   setIdVerified]   = useState(false);
  const [prefLang,     setPrefLang]     = useState('he');
  const [userPhone,    setUserPhone]    = useState('');
  const [hasPushToken,     setHasPushToken]     = useState(true); // האם יש pushToken — לאזהרת ניקוי דחוף
  const [pushToggleLoading, setPushToggleLoading] = useState(false);
  const [availOpen,        setAvailOpen]        = useState(false); // collapsible זמינות — סגור כברירת מחדל
  const [availableDates,   setAvailableDates]   = useState<string[]>([]); // תאריכים זמינים — YYYY-MM-DD
  const [calMonth,         setCalMonth]         = useState(new Date()); // חודש מוצג בלוח
  const [portfolioSaved,   setPortfolioSaved]   = useState(false); // סימן שמור אחרי העלאת תמונה

  // ── כתובות שמורות (לקוח) ───────────────────────────────────────────────
  type SavedAddr = { id: string; address: string; isPrimary: boolean; lastUsed: string };
  const ADDR_KEY = 'saved_addresses';
  const [savedAddrs, setSavedAddrs] = useState<SavedAddr[]>([]);
  const [newAddrInput, setNewAddrInput] = useState('');

  const loadAddrs = async () => {
    try {
      const raw = await import('expo-secure-store').then(m => m.getItemAsync(ADDR_KEY));
      setSavedAddrs(raw ? JSON.parse(raw) : []);
    } catch { setSavedAddrs([]); }
  };

  const saveAddrs = async (list: SavedAddr[]) => {
    const { setItemAsync } = await import('expo-secure-store');
    await setItemAsync(ADDR_KEY, JSON.stringify(list));
    setSavedAddrs(list);
  };

  const handleSetPrimary = async (id: string) => {
    const updated = savedAddrs.map(a => ({ ...a, isPrimary: a.id === id }));
    await saveAddrs(updated);
  };

  const handleDeleteAddr = async (id: string) => {
    const filtered = savedAddrs.filter(a => a.id !== id);
    if (savedAddrs.find(a => a.id === id)?.isPrimary && filtered.length > 0) filtered[0].isPrimary = true;
    await saveAddrs(filtered);
  };

  const handleAddAddr = async () => {
    const trimmed = newAddrInput.trim();
    if (!trimmed || trimmed.length < 5) return Alert.alert(t.error, t.addressTooShort);
    if (savedAddrs.length >= 5) return Alert.alert('', t.maxAddressesReached);
    const exists = savedAddrs.find(a => a.address === trimmed);
    if (exists) { setNewAddrInput(''); return; }
    const isFirst = savedAddrs.length === 0;
    const newList = [{ id: Date.now().toString(), address: trimmed, isPrimary: isFirst, lastUsed: new Date().toISOString() }, ...savedAddrs];
    await saveAddrs(newList);
    setNewAddrInput('');
  };

  // Tabs (cleaner): 'bookings' | 'schedule' | 'profile' | 'urgent'
  const [activeTab,    setActiveTab]    = useState<'bookings' | 'schedule' | 'profile' | 'urgent'>('bookings');

  // פתח לשונית urgent אם הגיע מקישור וואצאפ
  useEffect(() => {
    if (tab === 'urgent') setActiveTab('urgent');
  }, [tab]);

  // אישור אוטומטי של בקשה דחופה כשמגיעים מפופ-אפ "אשר ניקיון" (מסך הבית)
  // הערה: ה-effect עצמו מוגדר מתחת להכרזת urgentRequests (אחרת TDZ)
  const autoAcceptedRef = useRef<string>('');

  // הצג מודל אישור הזמנה — כולל הזמנות חדשות שמגיעות בזמן אמת
  useEffect(() => {
    if (!userRole || userRole !== 'cleaner') return;
    const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    const nowMs = Date.now();
    const pendingBks = incomingBks.filter((b: any) => b.status === 'pending' && (!b.bookingDate || b.bookingDate >= todayStr));
    // מסמנים את כל הממתינות כ"הוצגו" כדי שלא יקפצו שוב; קופצים אוטומטית רק להזמנה חדשה ממש (נוצרה ב-5 הדקות האחרונות)
    const fresh = pendingBks.filter((b: any) => !SHOWN_PENDING.has(b.id) && b.createdAt && (nowMs - new Date(b.createdAt).getTime()) < 5 * 60 * 1000);
    pendingBks.forEach((b: any) => SHOWN_PENDING.add(b.id));
    if (fresh.length > 0) {
      setPendingConfirmBooking(fresh.sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]);
    }
  }, [incomingBks, userRole]);

  // Tapped a "new booking" push → open the confirm modal for THAT booking,
  // regardless of how old it is (the auto-popup above only covers the last 5 min).
  const confirmFromPushRef = useRef<string>('');
  useEffect(() => {
    if (!confirmBookingId || confirmFromPushRef.current === confirmBookingId) return;
    const bk = incomingBks.find((b: any) => b.id === confirmBookingId);
    if (!bk) return;   // wait until the bookings list has loaded
    confirmFromPushRef.current = confirmBookingId as string;
    setActiveTab('bookings');
    if (bk.status === 'pending') setPendingConfirmBooking(bk);
  }, [confirmBookingId, incomingBks]);

  // Urgent requests
  const [urgentRequests, setUrgentRequests] = useState<any[]>([]);

  // פתיחת פרטי בקשה דחופה כשמגיעים מפוש — בדיקה ישירה של סטטוס הבקשה
  useEffect(() => {
    if (!acceptReqId || autoAcceptedRef.current === acceptReqId) return;
    autoAcceptedRef.current = acceptReqId as string;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'urgentRequests', acceptReqId as string));
        setAcceptOverlay(false);
        const data: any = snap.data();
        const st = data?.status;
        // הבקשה עדיין פתוחה — פותחים את פרטי ההזמנה (אישור/דחייה)
        if (snap.exists() && st === 'open') {
          setActiveTab('urgent');
          handleAcceptUrgent({ id: snap.id, ...data });
          return;
        }
        // אני זה שכבר תפס/תי — פשוט לפרופיל, בלי הודעת "נלקחה"
        if (snap.exists() && st === 'taken' && data?.takenByUid === uid) {
          setActiveTab('bookings');
          return;
        }
        // הבקשה אינה זמינה (נלקחה ע"י אחר/בוטלה/פגה) — הודעה בתוך האפליקציה
        Alert.alert('⚡', (t as any).urgentAlreadyTakenInApp ?? 'ההזמנה הדחופה כבר נלקחה על ידי מנקה אחר/ת 🙂 הישאר/י זמין/ה — הבאה בדרך!');
      } catch (_) { setAcceptOverlay(false); }
    })();
  }, [acceptReqId]);

  // מודאל אישור הזמנה — מוכרז כאן (לפני האפקטים שמשתמשים בו)
  const [pendingConfirmBooking, setPendingConfirmBooking] = useState<any>(null);

  // מסך טעינה שמכסה את הפרופיל כשמגיעים מפוש דחוף — עד שמסך האישור נפתח
  // אתחול מיידי מ-acceptReqId — מונע פלאש של פריים אחד לפני שה-overlay נדלק
  const [acceptOverlay, setAcceptOverlay] = useState(!!acceptReqId);
  useEffect(() => { if (acceptReqId) setAcceptOverlay(true); }, [acceptReqId]);
  useEffect(() => { if (pendingConfirmBooking) setAcceptOverlay(false); }, [pendingConfirmBooking]);
  useEffect(() => {
    if (!acceptOverlay) return;
    const tm = setTimeout(() => setAcceptOverlay(false), 7000); // בטיחות — אם הבקשה נתפסה/לא נמצאה
    return () => clearTimeout(tm);
  }, [acceptOverlay]);

  // מאזין בזמן-אמת: אם מנקה אחר תפס את הבקשה הדחופה בזמן שאני במסך האישור — סמן "נלקחה"
  const [urgentTakenByOther, setUrgentTakenByOther] = useState(false);
  useEffect(() => {
    const pcb = pendingConfirmBooking;
    setUrgentTakenByOther(false);
    // מנוי לכל הזמנה דחופה שעדיין לא אושרה על ידי המנקה (יש לה urgentRequestId)
    if (!pcb?.urgentRequestId || pcb?.status === 'confirmed') return;
    // באנר "נלקחה" רק אם מנקה אחר (לא אני) תפס. אם אני תפסתי — המסך ממילא נסגר.
    const unsub = onSnapshot(doc(db, 'urgentRequests', pcb.urgentRequestId), (snap) => {
      const d: any = snap.data();
      if (snap.exists() && d?.status && d.status !== 'open' && d.takenByUid && d.takenByUid !== uid) {
        setUrgentTakenByOther(true);
      }
    }, () => {});
    return () => unsub();
  }, [pendingConfirmBooking?.id, pendingConfirmBooking?.urgentRequestId]);

  // Active booking detail modal (client tap)
  const [activeBookingDetail, setActiveBookingDetail] = useState<any>(null);

  // Booking history modal (client)
  const [historyOpen, setHistoryOpen] = useState(false);

  // Pending booking confirmation modal (pendingConfirmBooking הוכרז למעלה, לפני האפקטים שמשתמשים בו)
  const [confirmedBookingView,  setConfirmedBookingView]  = useState<any>(null);
  const [confirmChatMsgs,       setConfirmChatMsgs]       = useState<any[]>([]);
  const [confirmChatInput,      setConfirmChatInput]      = useState('');
  const confirmChatScrollRef = useRef<FlatList>(null);
  const confirmChatUnsubRef  = useRef<(() => void) | null>(null);

  // צ'אט במסך הזמנה מאושרת
  useEffect(() => {
    if (confirmChatUnsubRef.current) { confirmChatUnsubRef.current(); confirmChatUnsubRef.current = null; }
    if (!confirmedBookingView) { setConfirmChatMsgs([]); return; }
    const myUid = uid;
    const clientUid = confirmedBookingView.clientUid;
    if (!myUid || !clientUid) return;
    const chatId = [myUid, clientUid].sort().join('_');
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    confirmChatUnsubRef.current = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setConfirmChatMsgs(msgs);
      setTimeout(() => confirmChatScrollRef.current?.scrollToEnd({ animated: true }), 80);
    }, () => {});
    return () => { if (confirmChatUnsubRef.current) confirmChatUnsubRef.current(); };
  }, [confirmedBookingView]);

  const sendConfirmChat = async () => {
    const msg = confirmChatInput.trim();
    if (!msg || !confirmedBookingView) return;
    const myUid = uid;
    const clientUid = confirmedBookingView.clientUid;
    const chatId = [myUid, clientUid].sort().join('_');
    setConfirmChatInput('');
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: msg, from: 'cleaner', fromUid: myUid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        participants: [myUid, clientUid],
        lastMessage: msg, lastMessageAt: new Date().toISOString(),
        lastSenderUid: myUid,
        unreadBy: [clientUid],
      }, { merge: true });
    } catch (_) {}
  };

  // ── תפריט נפתח: הזמנות שקיבלתי (מנקה) ──
  const [incomingOpen, setIncomingOpen] = useState(false);

  // ── מצב מקלדת (כדי לצמצם רווח מתחת לכפתורים כשהמקלדת פתוחה) ──
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const sh = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hd = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { sh.remove(); hd.remove(); };
  }, []);

  // ── צ'אט לפני אישור הזמנה ──
  const [pendingChatMsgs,      setPendingChatMsgs]      = useState<any[]>([]);
  const [pendingChatInput,     setPendingChatInput]      = useState('');
  const [showPendingTimeChange,setShowPendingTimeChange] = useState(false);
  const [pendingNewDate,       setPendingNewDate]        = useState('');
  const [pendingNewTime,       setPendingNewTime]        = useState('');
  const [pendingPickerDate,    setPendingPickerDate]     = useState(new Date());
  const [showDatePicker,       setShowDatePicker]        = useState(false);
  const [showTimePicker,       setShowTimePicker]        = useState(false);
  const pendingChatScrollRef   = useRef<FlatList>(null);
  const pendingChatUnsubRef    = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (pendingChatUnsubRef.current) { pendingChatUnsubRef.current(); pendingChatUnsubRef.current = null; }
    if (!pendingConfirmBooking) { setPendingChatMsgs([]); setShowPendingTimeChange(false); setActiveChat(null); return; }
    const clientUid = pendingConfirmBooking.clientUid;
    if (!uid || !clientUid) return;
    const chatId = [uid, clientUid].sort().join('_');
    // point the shared image/voice senders at this client so the modal's
    // 📷/🎤 buttons write to the same chat
    setChatClientUid(clientUid);
    setChatClientName(pendingConfirmBooking.clientName || 'לקוח');
    setActiveChat(chatId);   // המנקה בצ'אט ההזמנה הזה — לא להקפיץ פופ-אפ
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    pendingChatUnsubRef.current = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendingChatMsgs(msgs);
      setTimeout(() => pendingChatScrollRef.current?.scrollToEnd({ animated: true }), 80);
    }, () => {});
    return () => { if (pendingChatUnsubRef.current) pendingChatUnsubRef.current(); setActiveChat(null); };
  }, [pendingConfirmBooking]);

  const sendPendingChat = async (overrideText?: string) => {
    const msg = (overrideText ?? pendingChatInput).trim();
    if (!msg || !pendingConfirmBooking) return;
    const clientUid = pendingConfirmBooking.clientUid;
    const chatId = [uid, clientUid].sort().join('_');
    if (!overrideText) setPendingChatInput('');
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: msg, from: 'cleaner', fromUid: uid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        participants: [uid, clientUid],
        lastMessage: msg, lastMessageAt: new Date().toISOString(),
        lastSenderUid: uid,
        unreadBy: [clientUid],
      }, { merge: true });
    } catch (_) {}
  };

  const suggestTimeChange = async () => {
    const datePart = pendingNewDate || pendingPickerDate.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = pendingNewTime || pendingPickerDate.toLocaleTimeString(LOCALE_MAP[lang] || 'he-IL', { hour: '2-digit', minute: '2-digit' });
    const msg = `🔄 הצעה לשינוי זמן:\n📅 תאריך: ${datePart}\n🕐 שעה: ${timePart}\n\nהאם מתאים לך?`;
    await sendPendingChat(msg);
    setShowPendingTimeChange(false);
    setPendingNewDate('');
    setPendingNewTime('');
  };

  // Edit profile modal
  const [editOpen,         setEditOpen]         = useState(false);
  const [editName,         setEditName]         = useState('');
  const [editCity,         setEditCity]         = useState('');
  // כתובת מלאה ללקוח
  const [editStreet,       setEditStreet]       = useState('');
  const [editFloor,        setEditFloor]        = useState('');
  const [editApt,          setEditApt]          = useState('');
  const [editAddrPrivate,  setEditAddrPrivate]  = useState(false);
  const [editPhone,        setEditPhone]        = useState('');
  const [editBio,          setEditBio]          = useState('');
  const [editPrice,        setEditPrice]        = useState('');
  const [editTypes,        setEditTypes]        = useState<string[]>([]);
  const [editPayment,      setEditPayment]      = useState<string[]>([]);
  const [editWorkAreas,    setEditWorkAreas]    = useState<string[]>([]);
  const [editBringSupplies,setEditBringSupplies]= useState(true);
  const [editIsMobile,     setEditIsMobile]     = useState(true);
  // נתוני הרשמה נוספים — גיל, אזרחות, ניסיון, מרחק הגעה
  const [editAge,          setEditAge]          = useState('');
  const [editCitizenship,  setEditCitizenship]  = useState('');
  const [editExperience,   setEditExperience]   = useState('');
  const [editMaxDistance,  setEditMaxDistance]  = useState('');
  const [editCleanerAddress, setEditCleanerAddress] = useState('');
  const [editServicePricing,setEditServicePricing]= useState<Record<string,string>>({});
  const [editSaving,       setEditSaving]       = useState(false);
  // Payment details (cleaner)
  const [editBitPhone,        setEditBitPhone]        = useState('');
  const [editPayboxLink,      setEditPayboxLink]      = useState('');
  const [editWhatsappGroupId, setEditWhatsappGroupId] = useState('');
  const [editBankName,        setEditBankName]        = useState('');
  const [editBankNum,      setEditBankNum]      = useState('');
  const [editBankBranch,   setEditBankBranch]   = useState('');
  const [editBankAccount,  setEditBankAccount]  = useState('');
  // Cleaner saved payment details
  const [referralCode,       setReferralCode]       = useState('');
  const [cleanerBitPhone,    setCleanerBitPhone]    = useState('');
  const [cleanerPayboxLink,  setCleanerPayboxLink]  = useState('');
  const [cleanerBankName,    setCleanerBankName]    = useState('');
  const [cleanerBankNum,     setCleanerBankNum]     = useState('');
  const [cleanerBankBranch,  setCleanerBankBranch]  = useState('');
  const [cleanerBankAccount, setCleanerBankAccount] = useState('');
  // Payment sheet (after end cleaning)
  const [paySheetOpen,     setPaySheetOpen]     = useState(false);
  const [paySheetAmount,   setPaySheetAmount]   = useState(0);
  const [paySheetClientPhone, setPaySheetClientPhone] = useState('');
  const [paySheetClientName,  setPaySheetClientName]  = useState('');
  const [paySheetTab,      setPaySheetTab]      = useState<'bit'|'paybox'|'bank'>('bit');
  const [payCopied,        setPayCopied]        = useState('');

  // Chat from cleaner side
  const [chatClientUid, setChatClientUid] = useState('');
  const [chatClientName,setChatClientName]= useState('');
  const [chatMessages,  setChatMessages]  = useState<any[]>([]);
  const [chatInput,     setChatInput]     = useState('');
  const [chatOpen,      setChatOpen]      = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const chatUnsubRef  = useRef<(() => void) | null>(null);
  // Voice recording (cleaner chat)
  const [chatIsRecording,  setChatIsRecording]  = useState(false);
  const cleanerRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const cleanerMicReadyRef = useRef(false);
  // Pre-acquire mic permission + recording audio mode so press-and-hold starts
  // capturing instantly (otherwise the permission dialog eats the start on iOS).
  useEffect(() => {
    (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) return;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        cleanerMicReadyRef.current = true;
      } catch (_) {}
    })();
  }, []);
  const [chatPlayingId,    setChatPlayingId]    = useState<string | null>(null);
  const [chatViewerUri,    setChatViewerUri]    = useState<string | null>(null);
  const chatSoundRef = useRef<any>(null);

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

  // Insurance
  const [insuranceOpen,    setInsuranceOpen]    = useState(false);
  const [insuranceMsg,     setInsuranceMsg]     = useState('');
  const [insuranceSending, setInsuranceSending] = useState(false);
  const [insuranceSent,    setInsuranceSent]    = useState(false);

  const ADMIN_EMAIL = 'itzikofek669@gmail.com';

  const handleSendReport = async () => {
    if (!reportDesc.trim()) return;
    setReportSending(true);
    try {
      // שמירה ב-Firestore
      await addDoc(collection(db, 'reports'), {
        type: reportType,
        target: reportTarget.trim(),
        description: reportDesc.trim(),
        reportedBy: uid,
        createdAt: new Date().toISOString(),
        resolved: false,
      });

      // שליחת אימייל לאדמין
      const typeLabel = reportType === 'bug' ? 'באג' : reportType === 'cleaner' ? 'דיווח על מנקה' : 'דיווח על לקוח';
      const subject = encodeURIComponent(`🚨 דיווח חדש — ${typeLabel}`);
      const body = encodeURIComponent(
        `סוג: ${typeLabel}\nיעד: ${reportTarget.trim() || 'לא צוין'}\nתיאור: ${reportDesc.trim()}\n\nמשתמש: ${uid}\nתאריך: ${new Date().toLocaleString(LOCALE_MAP[lang] || 'he-IL')}`
      );
      Linking.openURL(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});

      Alert.alert('', t.reportSuccess);
      setReportOpen(false);
      setReportTarget('');
      setReportDesc('');
    } catch (_) {
      Alert.alert(t.error, t.reportSendError);
    } finally {
      setReportSending(false);
    }
  };

  const handleInsuranceSubmit = async () => {
    if (!insuranceMsg.trim()) return;
    setInsuranceSending(true);
    try {
      const lastBooking = bookings[0];
      await addDoc(collection(db, 'insuranceRequests'), {
        clientUid: uid,
        clientName: userName,
        clientPhone: userPhone,
        message: insuranceMsg.trim(),
        bookingId: lastBooking?.id || '',
        bookingDate: lastBooking?.bookingDate || '',
        cleanerName: lastBooking?.cleanerName || '',
        createdAt: new Date().toISOString(),
        status: 'pending',
      });
      setInsuranceSent(true);
    } catch (_) {
      Alert.alert(t.error, t.insuranceRequestError);
    } finally {
      setInsuranceSending(false);
    }
  };

  const openEditProfile = async () => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const d = snap.data();
        setEditName(d.name        || '');
        setEditCity(d.city        || '');
        setEditStreet(d.street    || '');
        setEditFloor(d.floor      || '');
        setEditApt(d.apt          || '');
        setEditAddrPrivate(d.isPrivate || false);
        setEditPhone(d.phone      || '');
        setEditBio(d.bio          || '');
        setEditPrice(String(d.price || ''));
        setEditTypes(d.types      || []);
        setEditPayment(d.payment  || []);
        setEditWorkAreas(d.workAreas || []);
        setEditBringSupplies(d.bringSupplies !== false);
        setEditIsMobile(d.isMobile !== false);
        setEditCleanerAddress(d.cleanerAddress || '');
        setEditAge(d.age ? String(d.age) : '');
        setEditCitizenship(d.citizenship || '');
        setEditExperience(d.experience != null ? String(d.experience) : '');
        setEditMaxDistance(d.maxDistance != null ? String(d.maxDistance) : '');
        const sp = d.servicePricing || {};
        const spStr: Record<string,string> = {};
        Object.entries(sp).forEach(([k,v]) => { spStr[k] = String(v); });
        // אם אין מחיר לניקיון רגיל — מלא מהמחיר הישן
        if (!spStr['ניקיון רגיל'] && d.price) spStr['ניקיון רגיל'] = String(d.price);
        setEditServicePricing(spStr);
        setEditWhatsappGroupId(d.whatsappGroupId || '');
        setEditBitPhone(d.bitPhone || '');
        setEditPayboxLink(d.payboxLink || '');
        setEditBankName(d.bankName || '');
        setEditBankNum(d.bankNum || '');
        setEditBankBranch(d.bankBranch || '');
        setEditBankAccount(d.bankAccount || '');
      }
    } catch (_) {}
    setEditOpen(true);
  };

  const saveEditProfile = async () => {
    if (!editName.trim()) return Alert.alert(t.error, t.editErrNameRequired);
    setEditSaving(true);
    try {
      const spNum: Record<string,number> = {};
      Object.entries(editServicePricing).forEach(([k,v]) => { if (v) spNum[k] = Number(v); });

      // מנקה: איתור מיקום לפי הכתובת (גיאוקודינג) — שמירת קואורדינטות + עיר מתוך הכתובת
      let geoExtra: { lat?: number; lng?: number; city?: string } = {};
      if (isCleaner && editCleanerAddress.trim()) {
        try {
          const Location = await import('expo-location');
          const res = await Location.geocodeAsync(editCleanerAddress.trim());
          if (res && res[0]) { geoExtra.lat = res[0].latitude; geoExtra.lng = res[0].longitude; }
        } catch (_) {}
        const parts = editCleanerAddress.trim().split(',');
        geoExtra.city = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim();
      }

      // לקוח: הרכבת כתובת מלאה (כמו בתצוגה המקדימה) — לשמירה והצגה
      const clientFullAddr = [
        editStreet.trim(),
        editCity.trim(),
        editAddrPrivate ? 'בית פרטי' : (editFloor.trim() ? `קומה ${editFloor.trim()}` : ''),
        (!editAddrPrivate && editApt.trim()) ? `דירה ${editApt.trim()}` : '',
      ].filter(Boolean).join(', ');

      await updateDoc(doc(db, 'users', uid), {
        name:          editName.trim(),
        city:          isCleaner ? (geoExtra.city || editCity.trim()) : editCity.trim(),
        ...(geoExtra.lat != null ? { lat: geoExtra.lat, lng: geoExtra.lng } : {}),
        ...(!isCleaner && clientFullAddr ? { address: clientFullAddr } : {}),
        street:        editStreet.trim(),
        floor:         editFloor.trim(),
        apt:           editApt.trim(),
        isPrivate:     editAddrPrivate,
        phone:         editPhone.trim(),
        bio:           editBio.trim(),
        price:         Number(editServicePricing['ניקיון רגיל']) || Number(Object.values(editServicePricing).find(v => v)) || 0,
        types:         editTypes,
        payment:       editPayment,
        workAreas:     editWorkAreas,
        bringSupplies: editBringSupplies,
        isMobile:      editIsMobile,
        age:           Number(editAge) || null,
        citizenship:   editCitizenship.trim(),
        experience:    Number(editExperience) || 0,
        maxDistance:   Number(editMaxDistance) || 10,
        cleanerAddress:   editCleanerAddress.trim(),
        servicePricing:   spNum,
        whatsappGroupId:  editWhatsappGroupId.trim(),
        availability,
        bitPhone:         editBitPhone.trim(),
        payboxLink:       editPayboxLink.trim(),
        bankName:         editBankName.trim(),
        bankNum:          editBankNum.trim(),
        bankBranch:       editBankBranch.trim(),
        bankAccount:      editBankAccount.trim(),
      });
      // לקוח: עדכן/הוסף את הכתובת הראשית ב"הכתובות שלי" כדי שתופיע מיד
      if (!isCleaner && clientFullAddr) {
        let list = [...savedAddrs];
        const primaryIdx = list.findIndex(a => a.isPrimary);
        if (primaryIdx >= 0) {
          list[primaryIdx] = { ...list[primaryIdx], address: clientFullAddr, lastUsed: new Date().toISOString() };
        } else {
          list = [{ id: Date.now().toString(), address: clientFullAddr, isPrimary: true, lastUsed: new Date().toISOString() }, ...list];
        }
        await saveAddrs(list);
      }

      // update local state
      setCleanerBitPhone(editBitPhone.trim());
      setCleanerPayboxLink(editPayboxLink.trim());
      setCleanerBankName(editBankName.trim());
      setCleanerBankNum(editBankNum.trim());
      setCleanerBankBranch(editBankBranch.trim());
      setCleanerBankAccount(editBankAccount.trim());
      setUserName(editName.trim());
      setUserPhone(editPhone.trim());
      setEditOpen(false);
      Alert.alert('✅', t.profileUpdateSuccess);
    } catch (_) {
      Alert.alert(t.error, t.profileSaveError);
    } finally {
      setEditSaving(false);
    }
  };

  const toggleEdit = (arr: string[], setArr: (v: string[]) => void, key: string) => {
    setArr(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key]);
  };

  useEffect(() => {
    if (!uid) return;
    // ── טעינת נתוני פרופיל (חד-פעמי) ──────────────────────────────────────
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserName(d.name        || '');
          setUserEmail(d.email      || '');
          setUserRole(d.role        || '');
          setHasPushToken(!!d.pushToken);
          setPhotoB64(d.photoB64    || null);
          setWorkAreas(d.workAreas  || []);
          const rawAvail = d.availability || {};
          const parsedAvail: Record<string, { active: boolean; start: number; end: number }> = {};
          for (const key of ['sun','mon','tue','wed','thu','fri','sat']) {
            const v = rawAvail[key];
            parsedAvail[key] = (v && typeof v === 'object')
              ? { active: v.active ?? false, start: v.start ?? 9, end: v.end ?? 18 }
              : { active: !!v, start: 9, end: 18 };
          }
          setAvailability(parsedAvail);
          setShowPhone(d.showPhone !== false);
          setPortfolio(d.portfolio || []);
          setIdVerified(d.identityVerified === true);
          setPrefLang((d.preferredLang || 'he') as Lang);
          setUserPhone(d.phone || '');
          let code = d.referralCode || '';
          if (!code) {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
            setDoc(doc(db, 'users', uid), { referralCode: code }, { merge: true }).catch(() => {});
          }
          setReferralCode(code);
          setCleanerBitPhone(d.bitPhone || '');
          setCleanerPayboxLink(d.payboxLink || '');
          setCleanerBankName(d.bankName || '');
          setCleanerBankNum(d.bankNum || '');
          setCleanerBankBranch(d.bankBranch || '');
          setCleanerBankAccount(d.bankAccount || '');
        }
      } catch (_) {}
      finally { setLoading(false); }
      // טען כתובות שמורות (לקוח)
      loadAddrs();
    })();

    // ── הזמנות לקוח — בזמן אמת ─────────────────────────────────────────────
    // הערה: orderBy מוסר מהקוורי כדי להימנע מדרישת composite index ב-Firestore
    // המיון נעשה ב-JS לאחר הקבלה
    const unsubClient = onSnapshot(
      query(collection(db, 'bookings'), where('clientUid', '==', uid)),
      snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setBookings(docs);
      },
      (err) => console.warn('bookings client query error:', err),
    );

    // ── הזמנות נכנסות למנקה — בזמן אמת ────────────────────────────────────
    const unsubCleaner = onSnapshot(
      query(collection(db, 'bookings'), where('cleanerId', '==', uid)),
      snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setIncomingBks(docs);
      },
      (err) => console.warn('bookings cleaner query error:', err),
    );

    // ── בקשות דחופות — בזמן אמת ────────────────────────────────────────────
    let prevUrgentCount = -1;
    const urgentUnsub = onSnapshot(
      query(collection(db, 'urgentRequests'), where('status', '==', 'open')),
      snap => {
        const now = new Date();
        const expired: any[] = [];
        const reqs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((r: any) => {
            if (!r.expiresAt || new Date(r.expiresAt) <= now) {
              expired.push(r);
              return false;
            }
            return true;
          });
        // מחק אוטומטית פניות שפג תוקפן
        expired.forEach(r => deleteDoc(doc(db, 'urgentRequests', r.id)).catch(() => {}));
        setUrgentRequests(reqs);
        if (prevUrgentCount >= 0 && reqs.length > prevUrgentCount) setActiveTab('urgent');
        prevUrgentCount = reqs.length;
      },
      (err) => { console.warn('[urgentRequests]', err); },
    );

    return () => { unsubClient(); unsubCleaner(); urgentUnsub(); };
  }, [uid]);

  // ── פופאפ ניקוי דחוף — מטופל ע"י המודל המותאם ב-home.tsx (שמרונדר מעל הכל).
  // כאן רק עוקבים אחרי הספירה כדי לפתוח את לשונית הדחוף (בלי Alert כפול).
  const prevUrgentPopupRef = useRef(-1);
  useEffect(() => {
    prevUrgentPopupRef.current = urgentRequests.length;
  }, [urgentRequests, userRole]);

  const pickImage = () => {
    Alert.alert(t.profilePhotoTitle, '', [
      {
        text: t.galleryOption,
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, t.galleryPermDenied);
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1,1], quality: 0.15, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) saveBase64(res.assets[0].base64);
        },
      },
      {
        text: t.cameraOption,
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, t.cameraPermDenied);
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [1,1], quality: 0.15, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) saveBase64(res.assets[0].base64);
        },
      },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  const saveBase64 = async (b64: string) => {
    setUploading(true);
    try {
      const dataUri = `data:image/jpeg;base64,${b64}`;
      await setDoc(doc(db, 'users', uid), { photoB64: dataUri }, { merge: true });
      setPhotoB64(dataUri);
    } catch (e: any) {
      Alert.alert(t.error, e?.message || t.saveImageError);
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

  // ─── Monthly availability calendar ──────────────────────────────────────────
  const toggleAvailableDate = async (dateStr: string) => {
    const updated = availableDates.includes(dateStr)
      ? availableDates.filter(d => d !== dateStr)
      : [...availableDates, dateStr];
    setAvailableDates(updated);
    await setDoc(doc(db, 'users', uid), { availableDates: updated }, { merge: true });
    setAvailSaved(true);
    setTimeout(() => setAvailSaved(false), 1500);
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
            if (!perm.granted) return Alert.alert(t.error, t.galleryPermDenied);
            return ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4,3], quality: 0.1, base64: true });
          }
        : async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) return Alert.alert(t.error, t.cameraPermDenied);
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
      } catch (e: any) { Alert.alert(t.error, e?.message); }
    };
    Alert.alert(t.addPhotoBtn, '', [
      { text: '🖼️ גלריה',   onPress: () => doUpload('gallery') },
      { text: '📷 מצלמה',   onPress: () => doUpload('camera')  },
      { text: t.cancel, style: 'cancel' },
    ]);
  };

  // ─── Portfolio ────────────────────────────────────────────────────────────────
  const pickPortfolioPhoto = () => {
    Alert.alert(t.portfolioAdd, '', [
      {
        text: '🖼️ גלריה',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, t.galleryPermDenied);
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.3, base64: true,
          });
          if (!res.canceled && res.assets[0].base64) savePortfolioPhoto(res.assets[0].base64);
        },
      },
      {
        text: '📷 מצלמה',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return Alert.alert(t.error, t.cameraPermDenied);
          const res = await ImagePicker.launchCameraAsync({
            quality: 0.3, base64: true,
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
    setPortfolioSaved(true);
    setTimeout(() => setPortfolioSaved(false), 2500);
  };

  const removePortfolioPhoto = (index: number) => {
    Alert.alert(t.portfolioDeleteTitle, t.portfolioDeleteMsg, [
      {
        text: t.portfolioDeleteBtn, style: 'destructive',
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
          if (!perm.granted) return Alert.alert(t.error, t.galleryPermDenied);
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
          if (!perm.granted) return Alert.alert(t.error, t.cameraPermDenied);
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
        // Build URLs first
        const mapsUrl  = b.address ? `https://maps.google.com/?q=${encodeURIComponent(b.address)}` : null;
        const rawPhone = (clientData.phone || '').replace(/\D/g, '').replace(/^0/, '');
        const waMsg    = encodeURIComponent(`שלום! 🚗 אני בדרך אליך לכתובת ${b.address || ''}`);
        const waUrl    = rawPhone ? `https://wa.me/972${rawPhone}?text=${waMsg}` : null;

        // Ask the cleaner what to open
        const buttons: any[] = [{ text: 'לא עכשיו', style: 'cancel' }];
        if (mapsUrl) buttons.push({ text: '📍 פתח מפות', onPress: () => Linking.openURL(mapsUrl) });
        if (waUrl)   buttons.push({ text: '💬 שלח WhatsApp', onPress: () => Linking.openURL(waUrl) });
        if (mapsUrl && waUrl) buttons.push({
          text: '📍 מפות + 💬 WhatsApp',
          onPress: () => { Linking.openURL(mapsUrl); setTimeout(() => Linking.openURL(waUrl!), 600); },
        });

        Alert.alert(t.onWayBtn, t.onWayConfirmMsg, buttons);
      } catch (_) {}
    } catch (_) {
      Alert.alert(t.error, t.updateStatusError);
    }
  };

  // ─── Cleaner: open chat with client ─────────────────────────────────────────
  // ה-subscription מנוהל ב-useEffect למטה — openCleanerChat רק מגדיר state
  const openCleanerChat = (b: any) => {
    setChatMessages([]);
    setChatClientUid(b.clientUid);
    setChatClientName(b.clientName || 'לקוח');
    setChatOpen(true);
  };

  // subscription אוטומטי — מופעל בכל פעם שנפתח צ'אט (גם מ-confirmedBookingView)
  useEffect(() => {
    if (!chatOpen || !chatClientUid || !uid) { setActiveChat(null); return; }
    if (chatUnsubRef.current) chatUnsubRef.current();
    const chatId = [uid, chatClientUid].sort().join('_');
    setActiveChat(chatId);   // המנקה בצ'אט הזה — לא להקפיץ פופ-אפ עליו
    // סמן כנקרא — הסר uid מ-unreadBy
    updateDoc(doc(db, 'chats', chatId), { unreadBy: arrayRemove(uid) }).catch(() => {});
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    chatUnsubRef.current = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChatMessages(msgs);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, () => {});
    return () => { if (chatUnsubRef.current) { chatUnsubRef.current(); chatUnsubRef.current = null; } setActiveChat(null); };
  }, [chatOpen, chatClientUid]);

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
        lastSenderUid: uid,
        participantNames: { [uid]: userName, [chatClientUid]: chatClientName },
        unreadBy: arrayUnion(chatClientUid),
      }, { merge: true });
      // push notification ללקוח
      try {
        const clientSnap = await getDoc(doc(db, 'users', chatClientUid));
        const pushToken  = clientSnap.data()?.pushToken;
        if (pushToken) {
          await sendPushNotification(pushToken, `💬 הודעה מ-${userName}`, msg, { type: 'message' });
        }
      } catch (_) {}
    } catch (_) {}
  };

  const sendCleanerImage = async () => {
    if (!chatClientUid) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(t.error, t.galleryPermDenied);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: false,
      exif: false,
    });
    if (res.canceled || !res.assets[0]) return;
    // Resize + compress so the image always fits Firestore's ~700KB base64 limit
    const srcUri = res.assets[0].uri;
    let base64Data: string | null | undefined;
    try {
      for (const st of [{ width: 1080, compress: 0.5 }, { width: 900, compress: 0.4 }, { width: 720, compress: 0.35 }]) {
        const out = await ImageManipulator.manipulateAsync(srcUri, [{ resize: { width: st.width } }], { compress: st.compress, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        base64Data = out.base64;
        if (base64Data && base64Data.length <= 700_000) break;
      }
    } catch (_) { return Alert.alert(t.error, t.imageReadError); }
    if (!base64Data) return Alert.alert(t.error, t.imageReadError);
    if (base64Data.length > 700_000) return Alert.alert(t.imageTooLargeTitle, t.imageTooLargeMsg);
    const chatId = [uid, chatClientUid].sort().join('_');
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        type: 'image',
        imageBase64: `data:image/jpeg;base64,${base64Data}`,
        from: 'cleaner',
        fromUid: uid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        participants: [uid, chatClientUid].sort(),
        lastMessage: t.chatImageMsg,
        lastMessageAt: new Date().toISOString(),
        lastSenderUid: uid,
        participantNames: { [uid]: userName, [chatClientUid]: chatClientName },
        unreadBy: arrayUnion(chatClientUid),
      }, { merge: true });
    } catch (err: any) {
      Alert.alert(t.imageSendError, err?.message || t.error);
    }
  };

  const startCleanerRecording = async () => {
    setChatIsRecording(true);   // instant feedback
    try {
      if (!cleanerMicReadyRef.current) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) { setChatIsRecording(false); return Alert.alert(t.error, t.micPermDenied); }
        cleanerMicReadyRef.current = true;
      }
      // playback may have switched the session to playback mode — switch back
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await cleanerRecorder.prepareToRecordAsync();
      cleanerRecorder.record();
    } catch (_) { setChatIsRecording(false); }
  };

  const stopAndSendCleanerRecording = async () => {
    if (!cleanerRecorder.isRecording) { setChatIsRecording(false); return; }
    setChatIsRecording(false);
    const chatId = [uid, chatClientUid].sort().join('_');
    try {
      await cleanerRecorder.stop();
      const uri = cleanerRecorder.uri;
      if (!uri || !chatId) return;
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const audioRef = storageRef(storage, `chats/${chatId}/audio_${Date.now()}.m4a`);
      await uploadBytes(audioRef, blob);
      const audioUrl = await getDownloadURL(audioRef);
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        type: 'audio', audioUrl,
        from: 'cleaner', fromUid: uid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        participants: [uid, chatClientUid].sort(),
        lastMessage: t.chatVoiceMsg,
        lastMessageAt: new Date().toISOString(),
        lastSenderUid: uid,
        unreadBy: arrayUnion(chatClientUid),
      }, { merge: true });
    } catch (_) { Alert.alert(t.error, t.audioSendError); }
  };

  const playCleanerAudio = async (audioUrl: string, msgId: string) => {
    if (chatSoundRef.current) {
      try { chatSoundRef.current.remove(); } catch (_) {}
      chatSoundRef.current = null;
    }
    if (chatPlayingId === msgId) { setChatPlayingId(null); return; }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer({ uri: audioUrl });
      chatSoundRef.current = player;
      setChatPlayingId(msgId);
      let started = false;
      const startPlayback = () => {
        if (started || !player.isLoaded) return;
        started = true;
        try { player.volume = 1.0; player.play(); } catch (_) {}
      };
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.isLoaded) startPlayback();
        if (status?.didJustFinish) {
          setChatPlayingId(null);
          try { player.remove(); } catch (_) {}
          chatSoundRef.current = null;
        }
      });
      startPlayback();
    } catch (_) { Alert.alert(t.error, t.audioPlayError); }
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
      Alert.alert(t.error, t.updateStatusError);
    }
  };

  // ─── Cleaner: mark payment received ──────────────────────────────────────────
  const handlePaymentReceived = async (b: any) => {
    try {
      await updateDoc(doc(db, 'bookings', b.id), {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
      });
      const upd = (prev: any[]) => prev.map(bk => bk.id === b.id ? { ...bk, paymentStatus: 'paid' } : bk);
      setBookings(upd); setIncomingBks(upd);
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
      // Auto-create next recurring booking
      if (b.recurring === 'weekly' || b.recurring === 'monthly') {
        try {
          const daysToAdd = b.recurring === 'weekly' ? 7 : 30;
          const currentDate = new Date(b.bookingDate || now);
          const nextDate = new Date(currentDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          const nextDateStr = nextDate.toISOString().split('T')[0];
          await addDoc(collection(db, 'bookings'), {
            cleanerId: uid,
            cleanerName: userName,
            clientUid: b.clientUid,
            clientName: b.clientName,
            hours: b.hours,
            payment: b.payment,
            paymentStatus: `awaiting_${b.payment}`,
            address: b.address,
            addrCity: b.addrCity || '',
            addrStreet: b.addrStreet || '',
            addrFloor: b.addrFloor || '',
            addrApt: b.addrApt || '',
            addrPrivate: b.addrPrivate || false,
            total: b.total,
            status: 'pending',
            createdAt: new Date().toISOString(),
            bookingDate: nextDateStr,
            startTime: b.startTime || '',
            busyFrom: (() => { const [h=8,m=0] = (b.startTime||'08:00').split(':').map(Number); const d=new Date(nextDate); d.setHours(h,m,0,0); return d.toISOString(); })(),
            busyUntil: (() => { const [h=8,m=0] = (b.startTime||'08:00').split(':').map(Number); const d=new Date(nextDate); d.setHours(h+(b.hours||2),m,0,0); return d.toISOString(); })(),
            recurring: b.recurring,
            serviceType: b.serviceType || '',
            pricePerHour: b.pricePerHour || (b.hours > 0 ? b.total / b.hours : 0),
            source: 'auto_recurring',
            parentBookingId: b.id,
          });
          // Notify client about next booking
          try {
            const clientSnap2 = await getDoc(doc(db, 'users', b.clientUid));
            const token2 = clientSnap2.data()?.pushToken;
            if (token2) {
              await sendPushNotification(token2, t.autoRecurCreated, `📅 ${nextDateStr}`);
            }
          } catch (_) {}
        } catch (_) {}
      }
      // הסר את חלון הזמן מ-busySlots של המנקה
      if (b.busyFrom && b.busyUntil) {
        await updateDoc(doc(db, 'users', uid), {
          busySlots: arrayRemove({ from: b.busyFrom, until: b.busyUntil }),
        }).catch(() => {});
      }
      // פתח PaymentSheet לגביית תשלום (לא עבור מזומן)
      if (b.payment === 'cash') {
        Alert.alert(t.cashPaymentTitle, `₪${actualTotal} ${b.clientName || ''}?`, [
          { text: t.cancel, style: 'cancel' },
          { text: '✅ ' + (t.closeBtn || 'אישור'), onPress: () => handlePaymentReceived(b) },
        ]);
      } else {
        try {
          const clientSnap0 = await getDoc(doc(db, 'users', b.clientUid));
          const rawPhone0 = ((clientSnap0.data()?.phone || '').replace(/\D/g, '').replace(/^0/, ''));
          setPaySheetAmount(actualTotal);
          setPaySheetClientPhone(rawPhone0);
          setPaySheetClientName(b.clientName || '');
          // Set default tab based on booking payment method
          const defaultTab = b.payment === 'paybox' ? 'paybox' : b.payment === 'bank' ? 'bank' : 'bit';
          setPaySheetTab(defaultTab);
          setPaySheetOpen(true);
        } catch (_) {}
      }

      // שליחה ללקוח — push + תזכורת דירוג אחרי 30 דקות
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
      } catch (_) {}
    } catch (_) {
      Alert.alert(t.error, t.updateStatusError);
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
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(cleanerRef);
          if (!snap.exists()) return;
          const d = snap.data();
          const oldCount = d.reviewCount || d.reviews || 0;
          const oldRating = d.rating || 0;
          const newCount = oldCount + 1;
          const newRating = Math.round(((oldRating * oldCount) + stars) / newCount * 10) / 10;
          tx.update(cleanerRef, { rating: newRating, reviewCount: newCount, reviews: newCount });
        });
      } catch (_) {}
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

  const totalSpent  = bookings.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + (b.total || 0), 0);
  const totalEarned = incomingBks.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + (b.total || 0), 0);
  const isCleaner   = userRole === 'cleaner';
  const DAYS_LABELS = [t.availSun, t.availMon, t.availTue, t.availWed, t.availThu, t.availFri, t.availSat];

  // Business dashboard stats
  const nowDate = new Date();
  // הזמנה שתאריכה עבר נחשבת כהושלמה (גם אם התשלום לא אושר) — למעט מבוטלות
  const isPastBooking = (b: any) => {
    if (!b.bookingDate) return false;
    const d = new Date(b.bookingDate); d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d < today;
  };
  const thisMonthBks    = incomingBks.filter(b => { const d = new Date(b.createdAt); return d.getMonth() === nowDate.getMonth() && d.getFullYear() === nowDate.getFullYear(); });
  const thisMonthEarned = thisMonthBks.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + (b.total || 0), 0);
  const completedBks    = incomingBks.filter(b => b.status === 'done' || (isPastBooking(b) && b.status !== 'cancelled'));
  const cancelledBks    = incomingBks.filter(b => b.status === 'cancelled');
  const cancelRate      = incomingBks.length > 0 ? Math.round((cancelledBks.length / incomingBks.length) * 100) : 0;
  const allTimeEarned   = incomingBks.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + (b.actualTotal || b.total || 0), 0);
  const clientFreq: Record<string, number> = {};
  incomingBks.forEach(b => { if (b.clientUid) clientFreq[b.clientUid] = (clientFreq[b.clientUid] || 0) + 1; });
  const repeatClients   = Object.values(clientFreq).filter(n => n >= 2).length;
  const ratedBks        = completedBks.filter(b => b.clientRating);
  const dashAvgRating   = ratedBks.length > 0 ? (ratedBks.reduce((s, b) => s + b.clientRating, 0) / ratedBks.length).toFixed(1) : '-';

  // Weekly schedule
  const weekStart = (() => { const d = new Date(nowDate); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; })();
  const weekBookings = incomingBks.filter(b => { if (b.status === 'cancelled') return false; const d = new Date(b.bookingDate || b.createdAt); return d >= weekStart && d < new Date(weekStart.getTime() + 7*24*60*60*1000); });

  // Bar chart — last 6 months earnings
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { month: 'short' }) };
  });
  const monthlyEarnings = last6Months.map(m =>
    incomingBks
      .filter(b => b.status !== 'cancelled' && (() => { const d = new Date(b.createdAt); return d.getMonth() === m.month && d.getFullYear() === m.year; })())
      .reduce((sum, b) => sum + (b.actualTotal || b.total || 0), 0)
  );
  const maxMonthly = Math.max(...monthlyEarnings, 1);
  const bestMonthLabel = last6Months[monthlyEarnings.indexOf(Math.max(...monthlyEarnings))]?.label || '-';

  // Schedule — current week bookings for calendar view


  const handleShareReferral = async () => {
    try {
      await Share.share({ message: `${t.referralShare || 'הצטרף/י ל-A&M Clean עם הקוד שלי:'} ${referralCode}` });
    } catch (_) {}
  };

  // ─── Status display ───────────────────────────────────────────────────────────
  const handleConfirmBooking = async (b: any) => {
    // הזמנה דחופה שעדיין לא נתפסה — תפיסה אטומית מתבצעת עכשיו, באישור בפועל
    if (b?.urgentUnclaimed && b?.urgentReq) {
      return claimAndConfirmUrgent(b.urgentReq);
    }
    // ── מניעת חפיפה: אסור לאשר שתי הזמנות לאותו תאריך+שעה ──
    {
      const changed = showPendingTimeChange && (pendingNewDate || pendingNewTime);
      const tDate = changed ? `${pendingPickerDate.getFullYear()}-${String(pendingPickerDate.getMonth()+1).padStart(2,'0')}-${String(pendingPickerDate.getDate()).padStart(2,'0')}` : b.bookingDate;
      const tTime = changed ? `${String(pendingPickerDate.getHours()).padStart(2,'0')}:${String(pendingPickerDate.getMinutes()).padStart(2,'0')}` : b.startTime;
      if (tDate && tTime) {
        const ns = new Date(`${tDate}T${tTime}`);
        const ne = new Date(ns.getTime() + (Number(b.hours) || 1) * 3600000);
        const overlap = incomingBks.some((x: any) => x.id !== b.id && ['confirmed','active','onway'].includes(x.status) && x.bookingDate === tDate && x.startTime && (() => {
          const [h, m] = String(x.startTime).split(':').map(Number);
          const xs = new Date(ns); xs.setHours(h || 0, m || 0, 0, 0);
          const xe = new Date(xs.getTime() + (Number(x.hours) || 1) * 3600000);
          return ns < xe && ne > xs;
        })());
        if (overlap) { Alert.alert(t.error, (t as any).overlapConfirmMsg ?? 'כבר יש לך הזמנה מאושרת בשעה זו — לא ניתן לאשר שתי הזמנות חופפות.'); return; }
      }
    }
    // נעילה — אישור (כולל פוש/הודעה) ירוץ פעם אחת בלבד לכל הזמנה
    if (CONFIRM_SENT.has(b.id)) { setPendingConfirmBooking(null); return; }
    CONFIRM_SENT.add(b.id);
    try {
      // אם בוצע שינוי זמן — עדכן בהזמנה
      const updates: any = { status: 'confirmed' };
      const dateChanged = showPendingTimeChange && (pendingNewDate || pendingNewTime);
      if (dateChanged) {
        // שמור בפורמט ISO עקבי — YYYY-MM-DD ו-HH:mm
        const y  = pendingPickerDate.getFullYear();
        const mm = String(pendingPickerDate.getMonth() + 1).padStart(2, '0');
        const dd = String(pendingPickerDate.getDate()).padStart(2, '0');
        const hh = String(pendingPickerDate.getHours()).padStart(2, '0');
        const mi = String(pendingPickerDate.getMinutes()).padStart(2, '0');
        updates.bookingDate = `${y}-${mm}-${dd}`;
        updates.startTime   = `${hh}:${mi}`;
      }
      SHOWN_PENDING.add(b.id); // לא להקפיץ שוב את אותה הזמנה
      await updateDoc(doc(db, 'bookings', b.id), updates);
      const confirmed = { ...b, ...updates };
      setIncomingBks(prev => prev.map(x => x.id === b.id ? confirmed : x));
      setPendingConfirmBooking(null);
      setShowPendingTimeChange(false);
      // אחרי אישור — חזרה לפרופיל (רשימת ההזמנות), בלי שיקפוץ מסך אישור נוסף.
      // מסמנים את כל ההזמנות הממתינות הנוכחיות כ"הוצגו" — אפשר לאשר אותן מרשימת ההזמנות.
      incomingBks.forEach((x: any) => { if (x.status === 'pending') SHOWN_PENDING.add(x.id); });
      setActiveTab('bookings');

      // שלח push + הודעת צ'אט ללקוח
      try {
        const clientSnap = await getDoc(doc(db, 'users', b.clientUid));
        const token = clientSnap.data()?.pushToken;
        const dateLabel = confirmed.bookingDate || b.bookingDate || '';
        const timeLabel = confirmed.startTime   || b.startTime   || '';
        const pushBody  = dateChanged
          ? `${userName} אישר עם שינוי זמן: ${dateLabel} ב-${timeLabel}`
          : `${userName} אישר את ההזמנה שלך — ${dateLabel} ב-${timeLabel}`;
        // בהזמנה דחופה הלקוח כבר קיבל פוש "נמצא מנקה" בקבלה — לא שולחים פוש אישור כפול
        if (token && b.source !== 'urgent') {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: token, title: '✅ ההזמנה אושרה!', body: pushBody, sound: 'default', priority: 'high', channelId: 'default', data: { type: 'booking_confirmed' } }),
          });
        }
        // שלח גם הודעת צ'אט אוטומטית ללקוח
        const chatId = [uid, b.clientUid].sort().join('_');
        const chatMsg = dateChanged
          ? `✅ אישרתי את ההזמנה עם שינוי זמן:\n📅 ${dateLabel}  🕐 ${timeLabel}\nנתראה בקרוב! תודה על ההזמנה 🧹`
          : `✅ אישרתי את ההזמנה!\n📅 ${dateLabel}  🕐 ${timeLabel}\nנתראה בקרוב! תודה על ההזמנה 🧹`;
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          text: chatMsg, from: 'cleaner', fromUid: uid,
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'chats', chatId), {
          participants: [uid, b.clientUid],
          lastMessage: chatMsg, lastMessageAt: new Date().toISOString(),
          lastSenderUid: uid,
          unreadBy: [b.clientUid],
        }, { merge: true });
      } catch (_) {}
    } catch (e: any) {
      Alert.alert(t.error, e?.message || 'שגיאה');
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'pending')   return t.pendingStatus;
    if (status === 'confirmed') return (t as any).confirmedStatus || '✅ אושרה';
    if (status === 'active')    return t.activeStatus;
    if (status === 'onway')     return t.onwayStatus;
    if (status === 'done')      return t.doneStatus;
    if (status === 'cancelled') return t.cancelledStatus;
    return status;
  };

  const getStatusStyle = (status: string) => {
    if (status === 'active')    return [s.detailPill, s.statusPillActive];
    if (status === 'onway')     return [s.detailPill, s.statusPillOnWay];
    if (status === 'confirmed') return [s.detailPill, s.statusPillConfirmed];
    if (status === 'done')      return [s.detailPill, s.statusPill];
    if (status === 'cancelled') return [s.detailPill, s.statusPillCancelled];
    return [s.detailPill, s.statusPillPending];
  };

  const getStatusTextStyle = (status: string) => {
    if (status === 'active')    return s.statusPillTextActive;
    if (status === 'onway')     return s.statusPillTextOnWay;
    if (status === 'confirmed') return s.statusPillTextConfirmed;
    if (status === 'done')      return s.statusPillText;
    if (status === 'cancelled') return s.statusPillTextCancelled;
    return s.statusPillTextPending;
  };

  // ─── Toggle Push Notifications ───────────────────────────────────────────────
  const handleTogglePush = async () => {
    if (!uid) { Alert.alert('שגיאה', 'לא מחובר'); return; }
    setPushToggleLoading(true);
    try {
      if (hasPushToken) {
        // ── כיבוי ─────────────────────────────────────────────────────────────
        await updateDoc(doc(db, 'users', uid), { pushToken: '' });
        setHasPushToken(false);
      } else {
        // ── הפעלה ─────────────────────────────────────────────────────────────
        // 1. בדוק/בקש הרשאה
        let finalStatus = 'undetermined';
        try {
          const { status: existing } = await Notifications.getPermissionsAsync();
          finalStatus = existing;
          if (existing !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
        } catch (_) { finalStatus = 'denied'; }

        if (finalStatus !== 'granted') {
          Alert.alert(
            '🔔 הפעלת התראות',
            'יש לאפשר התראות בהגדרות המכשיר.',
            [
              { text: 'ביטול', style: 'cancel' },
              { text: 'פתח הגדרות', onPress: () => {
                try { Linking.openSettings(); } catch (_) {}
              }},
            ]
          );
          setPushToggleLoading(false);
          return;
        }

        // 2. קבל טוקן
        let token = '';
        try {
          const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ??
            (Constants as any).easConfig?.projectId ??
            Constants.expoConfig?.slug ?? '';
          if (projectId && Constants.appOwnership !== 'expo') {
            const td = await Notifications.getExpoPushTokenAsync({ projectId });
            token = td?.data ?? '';
          }
        } catch (_) {
          // Expo Go — לא ניתן לקבל טוקן
          Alert.alert(
            '⚠️ גרסת פיתוח',
            'Push Notifications אינם זמינים ב-Expo Go.\nהם יפעלו לאחר בניית ה-APK הסופי.',
          );
          setPushToggleLoading(false);
          return;
        }

        if (token) {
          await updateDoc(doc(db, 'users', uid), { pushToken: token });
          setHasPushToken(true);
        } else {
          Alert.alert('שגיאה', 'לא ניתן לקבל טוקן להתראות.');
        }
      }
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message || 'פעולה נכשלה');
    }
    setPushToggleLoading(false);
  };

  // ─── Accept urgent request ───────────────────────────────────────────────────
  const acceptingUrgentRef = useRef(false);
  const handleAcceptUrgent = async (req: any) => {
    // מנע לחיצה כפולה מקומית
    if (acceptingUrgentRef.current) return;
    acceptingUrgentRef.current = true;
    try {
      // ⚠️ לא תופסים עדיין! ההקשה רק פותחת את פרטי ההזמנה.
      // התפיסה האטומית (כולל ההודעה לשאר המנקים) קורית רק באישור בפועל (handleConfirmBooking).
      const pseudo = {
        id: `urgent_${req.id}`,        // מזהה זמני — עדיין אין הזמנה אמיתית
        urgentUnclaimed: true,
        urgentReq: req,
        cleanerId: uid,
        clientUid: req.clientUid, clientName: req.clientName,
        hours: req.hours, payment: req.paymentMethod, paymentStatus: `awaiting_${req.paymentMethod}`,
        address: req.address, total: req.total,
        status: 'pending', createdAt: new Date().toISOString(),
        bookingDate: req.dateStr, startTime: req.startTime,
        recurring: 'once', serviceType: req.serviceType || '',
        pricePerHour: Math.round(req.total / req.hours),
        source: 'urgent', urgentRequestId: req.id,
      };
      setActiveTab('urgent');
      setPendingConfirmBooking(pseudo);
    } catch (_) {
      Alert.alert(t.error, t.acceptRequestError);
    } finally {
      acceptingUrgentRef.current = false;
    }
  };

  // תפיסה אטומית + אישור של בקשה דחופה — נקרא רק כשהמנקה לוחץ "אשר הזמנה"
  const claimAndConfirmUrgent = async (req: any) => {
    if (CONFIRM_SENT.has(req.id)) { setPendingConfirmBooking(null); return; }
    CONFIRM_SENT.add(req.id);
    try {
      const reqRef = doc(db, 'urgentRequests', req.id);
      const cleanerSnap = await getDoc(doc(db, 'users', uid));
      const cleanerName = cleanerSnap.data()?.name || 'מנקה';
      const bookingRef = doc(collection(db, 'bookings'));
      try {
        await runTransaction(db, async (tx) => {
          const fresh = await tx.get(reqRef);
          if (!fresh.exists() || fresh.data()?.status !== 'open') throw new Error('TAKEN');
          tx.update(reqRef, { status: 'taken', takenByUid: uid, takenByName: cleanerName, takenAt: new Date().toISOString() });
          tx.set(bookingRef, {
            cleanerId: uid, cleanerName,
            clientUid: req.clientUid, clientName: req.clientName,
            hours: req.hours, payment: req.paymentMethod, paymentStatus: `awaiting_${req.paymentMethod}`,
            address: req.address, total: req.total,
            status: 'confirmed', createdAt: new Date().toISOString(),
            bookingDate: req.dateStr, startTime: req.startTime,
            recurring: 'once', serviceType: req.serviceType || '',
            pricePerHour: Math.round(req.total / req.hours),
            source: 'urgent', urgentRequestId: req.id,
          });
        });
      } catch (txErr: any) {
        if (txErr?.message === 'TAKEN') {
          CONFIRM_SENT.delete(req.id);
          Alert.alert('', t.urgentAlreadyTaken);
          setPendingConfirmBooking(null);
          return;
        }
        throw txErr;
      }
      // נתפס בהצלחה ע"י המנקה הזה — פוש ללקוח
      try {
        const clientSnap = await getDoc(doc(db, 'users', req.clientUid));
        const pushToken = clientSnap.data()?.pushToken;
        if (pushToken) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: pushToken, title: t.urgentFoundMsg, body: `${cleanerName} קיבל את הבקשה שלך!`, sound: 'default', channelId: 'default', priority: 'high', data: { type: 'booking_confirmed' } }),
          });
        }
      } catch (_) {}
      // הערה: אין שולחים פוש "ההזמנה נתפסה" לשאר המנקים — מי שנמצא במסך האישור מקבל באנר באפליקציה.
      SHOWN_PENDING.add(bookingRef.id);
      incomingBks.forEach((x: any) => { if (x.status === 'pending') SHOWN_PENDING.add(x.id); });
      setActiveTab('bookings');
      setPendingConfirmBooking(null);
    } catch (_) {
      CONFIRM_SENT.delete(req.id);
      Alert.alert(t.error, t.acceptRequestError);
    }
  };

  const handleCancelBooking = (b: any) => {
    Alert.alert(
      t.cancelConfirmTitle,
      t.cancelConfirmMsg,
      [
      { text: t.cancelKeepBooking, style: 'cancel' },
      {
        text: t.cancelConfirmBtn,
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'bookings', b.id), { status: 'cancelled', cancelledBy: userRole || 'client', cancelledAt: new Date().toISOString() });
            setBookings(prev => prev.filter(x => x.id !== b.id));
            setIncomingBks(prev => prev.filter(x => x.id !== b.id));
            // הסר את חלון הזמן מ-busySlots של המנקה
            if (b.busyFrom && b.busyUntil) {
              await updateDoc(doc(db, 'users', b.cleanerId), {
                busySlots: arrayRemove({ from: b.busyFrom, until: b.busyUntil }),
              }).catch(() => {});
            }
            // שלח פוש לצד השני על הביטול
            try {
              const otherUid = userRole === 'cleaner' ? b.clientUid : b.cleanerId;
              if (otherUid) {
                const otherSnap = await getDoc(doc(db, 'users', otherUid));
                const token = otherSnap.data()?.pushToken;
                if (token) {
                  const byName = userRole === 'cleaner' ? (b.cleanerName || 'המנקה') : (b.clientName || 'הלקוח');
                  const dateLabel = `${b.bookingDate || ''}${b.startTime ? ' ' + b.startTime : ''}`.trim();
                  await sendPushNotification(
                    token,
                    (t as any).pushBookingCancelledTitle ?? '❌ הזמנה בוטלה',
                    ((t as any).pushBookingCancelledBody ?? 'ההזמנה בוטלה על ידי {who}').replace('{who}', byName) + (dateLabel ? ` · ${dateLabel}` : ''),
                    { type: 'booking_cancelled', bookingId: b.id },
                  );
                }
              }
            } catch (_) {}
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

    // צבע גבול שמאלי לפי סטטוס
    const statusBorderColor =
      b.status === 'done'      ? '#10B981' :
      b.status === 'active'    ? '#3B82F6' :
      b.status === 'onway'     ? '#F59E0B' :
      b.status === 'confirmed' ? '#8B5CF6' :
      b.status === 'cancelled' ? '#EF4444' : C.blueBorder;

    const personName = forCleaner ? (b.clientName || 'לקוח') : (b.cleanerName || 'מנקה');
    const hours = isDone && b.actualHours != null ? b.actualHours : b.hours;
    const total = isDone && b.actualTotal != null ? b.actualTotal : b.total;

    return (
      <View key={b.id} style={[s.bookingCard, { borderLeftWidth: 4, borderLeftColor: statusBorderColor, borderRadius: 16, padding: 0, overflow: 'hidden' }]}>

        {/* ── שורה עליונה: שם + מחיר ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={[s.bookingAvatar, { backgroundColor: statusBorderColor }]}>
              <T style={s.bookingAvatarText}>{personName.charAt(0)}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T style={[s.bookingName, { fontSize: 16 }]}>{personName}</T>
              <T style={[s.bookingDate, { fontSize: 11 }]}>{t.bookedOnLabel} {formatDate(b.createdAt, lang)}</T>
            </View>
          </View>
          {/* מחיר */}
          <View style={{ alignItems: 'flex-end' }}>
            <T style={{ fontSize: 20, fontWeight: '900', color: statusBorderColor }}>₪{total}</T>
            {isDone && b.actualTotal != null && b.actualTotal !== b.total && (
              <T style={{ fontSize: 11, color: C.textSub, textDecorationLine: 'line-through' }}>₪{b.total}</T>
            )}
          </View>
        </View>

        {/* ── קו הפרדה ── */}
        <View style={{ height: 1, backgroundColor: C.blueBorder, marginHorizontal: 14 }} />

        {/* ── פרטי הניקיון ── */}
        <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>

          {/* תאריך + שעה */}
          {(b.bookingDate || b.startTime) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T style={{ fontSize: 13, color: C.textDark, fontWeight: '700' }}>
                📅 {b.bookingDate ? new Date(b.bookingDate).toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}
                {b.startTime ? `  🕐 ${b.startTime}` : ''}
              </T>
            </View>
          )}

          {/* סוג ניקיון */}
          {(() => {
            const svc = (Array.isArray(b.serviceTypes) && b.serviceTypes.length
              ? b.serviceTypes.map((st: string) => t.types[st] || st).join(', ')
              : (b.serviceType ? String(b.serviceType).split(' + ').map((st: string) => t.types[st] || st).join(', ') : ''));
            return svc ? <T style={{ fontSize: 13, fontWeight: '800', color: C.blue }}>🧹 {svc}</T> : null;
          })()}

          {/* שעות + תשלום + סטטוס */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <View style={s.detailPill}>
              <T style={s.detailPillText}>⏱ {hours} {t.hoursUnit}</T>
              {isDone && b.actualHours != null && b.actualHours !== b.hours && (
                <T style={{ fontSize: 10, color: C.textSub, textDecorationLine: 'line-through' }}> ({b.hours})</T>
              )}
            </View>
            <View style={s.detailPill}>
              <T style={s.detailPillText}>{PAY_ICONS[b.payment] || '💳'} {b.payment === 'bit' ? t.payBit : b.payment === 'cash' ? t.payCash : b.payment === 'paybox' ? t.payPaybox : b.payment === 'bank' ? t.payBank : b.payment === 'card' ? t.payCard : b.payment}</T>
            </View>
            <View style={getStatusStyle(b.status)}>
              <T style={getStatusTextStyle(b.status)}>{getStatusLabel(b.status)}</T>
            </View>
            {b.recurring === 'weekly'  && <T style={s.recurBadge}>{t.recurBadgeWeekly}</T>}
            {b.recurring === 'monthly' && <T style={s.recurBadge}>{t.recurBadgeMonthly}</T>}
          </View>

          {/* Progress bar — cleaner side only */}
          {forCleaner && (() => {
            const steps = [
              { key: 'pending',   label: '📋 ממתין' },
              { key: 'confirmed', label: '✅ אושר' },
              { key: 'onway',     label: '🚗 בדרך' },
              { key: 'active',    label: '🧹 פעיל' },
              { key: 'done',      label: '✅ הסתיים' },
            ];
            const statusOrder: Record<string, number> = { pending: 0, confirmed: 1, onway: 2, active: 3, done: 4 };
            const currentIdx = statusOrder[b.status] ?? 0;
            return (
              <View style={{ marginTop: 10, marginBottom: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {steps.map((step, i) => (
                    <React.Fragment key={step.key}>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <View style={{
                          width: 22, height: 22, borderRadius: 11,
                          backgroundColor: i <= currentIdx ? C.blue : C.grayBorder,
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: i === currentIdx ? 2 : 0, borderColor: C.blueDark,
                        }}>
                          {i < currentIdx && <T style={{ fontSize: 11, color: C.white }}>✓</T>}
                          {i === currentIdx && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.white }} />}
                        </View>
                        <T style={{ fontSize: 8, color: i <= currentIdx ? C.textDark : C.textSub, marginTop: 3, textAlign: 'center' }}>{step.label}</T>
                      </View>
                      {i < steps.length - 1 && (
                        <View style={{ flex: 1, height: 2, backgroundColor: i < currentIdx ? C.blue : C.grayBorder, marginBottom: 14 }} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* סוג שירות + פירוט */}
          {b.serviceType && (
            <View style={{ gap: 4 }}>
              <T style={{ fontSize: 12, fontWeight: '700', color: C.textDark }}>{SERVICE_ICONS[b.serviceType] || '🧹'} {b.serviceType}</T>
              {SERVICE_DETAIL[b.serviceType] && (
                <View style={{ backgroundColor: C.bluePale, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.blueBorder }}>
                  {SERVICE_DETAIL[b.serviceType].map((line: string, i: number) => (
                    <T key={i} style={{ fontSize: 11, color: C.textDark, lineHeight: 18 }}>{line}</T>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* כתובת */}
          {b.address ? (
            <T style={[s.addressText, { fontSize: 13 }]}>📍 {b.address}</T>
          ) : null}

          {/* תשלום אושר */}
          {b.paymentStatus === 'paid' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
              <T style={{ fontSize: 12, fontWeight: '800', color: '#065F46' }}>{t.paymentApproved}</T>
            </View>
          )}
        </View>

        {/* Start / End time row */}
        {hasTimes && (
          <View style={s.timesRow}>
            {b.startedAt && (
              <View style={s.timeChip}>
                <T style={s.timeChipLabel}>{t.startedAtLabel}</T>
                <T style={s.timeChipVal}>{formatTime(b.startedAt, lang)}</T>
              </View>
            )}
            {b.finishedAt && (
              <View style={s.timeChip}>
                <T style={s.timeChipLabel}>{t.finishedAtLabel}</T>
                <T style={s.timeChipVal}>{formatTime(b.finishedAt, lang)}</T>
              </View>
            )}
            {b.startedAt && b.finishedAt && (
              <View style={[s.timeChip, { backgroundColor: C.greenBg }]}>
                <T style={s.timeChipLabel}>{t.durationLabel}</T>
                <T style={[s.timeChipVal, { color: C.green }]}>{calcDuration(b.startedAt, b.finishedAt)}</T>
              </View>
            )}
          </View>
        )}

        {/* Cancel button — pending/confirmed/onway, both client and cleaner (כולל דחוף) */}
        {(b.status === 'pending' || b.status === 'confirmed' || b.status === 'onway') && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancelBooking(b)}>
            <T style={s.cancelBtnText}>{t.cancelBookingBtn}</T>
          </TouchableOpacity>
        )}

        {/* Cleaner action buttons */}
        {forCleaner && b.status === 'pending' && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={s.onWayBtn} onPress={() => handleOnWay(b)}>
              <T style={s.onWayBtnText}>{t.onWayBtn}</T>
            </TouchableOpacity>
            <TouchableOpacity style={s.startBtn} onPress={() => handleStartCleaning(b)}>
              <T style={s.startBtnText}>✨ {t.startCleaningBtn}</T>
            </TouchableOpacity>
          </View>
        )}
        {forCleaner && b.status === 'onway' && (
          <TouchableOpacity style={s.startBtn} onPress={() => handleStartCleaning(b)}>
            <T style={s.startBtnText}>✨ {t.startCleaningBtn}</T>
          </TouchableOpacity>
        )}
        {forCleaner && isActive && (
          <TouchableOpacity
            style={s.endBtn}
            onPress={() => Alert.alert(
              '✅ סיום ניקיון',
              'האם לסמן את הניקיון כמושלם?\nפעולה זו תעדכן את הלקוח ותפתח את מסך התשלום.',
              [
                { text: 'ביטול', style: 'cancel' },
                { text: '✅ כן, סיים ניקיון', onPress: () => handleEndCleaning(b) },
              ]
            )}
          >
            <T style={s.endBtnText}>✅ {t.endCleaningBtn}</T>
          </TouchableOpacity>
        )}
        {/* Payment received button */}
        {forCleaner && b.paymentStatus && b.paymentStatus !== 'paid' && (
          <TouchableOpacity
            style={{ marginTop: 8, backgroundColor: '#10B981', borderRadius: 10, padding: 10, alignItems: 'center' }}
            onPress={() => handlePaymentReceived(b)}
          >
            <T style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
              {b.payment === 'bit' ? '💙 אישור תשלום Bit' : b.payment === 'card' ? '💳 אישור תשלום כרטיס' : '💵 קיבלתי מזומן'} ✓
            </T>
          </TouchableOpacity>
        )}
        {forCleaner && b.paymentStatus === 'paid' && (
          <View style={{ marginTop: 8, backgroundColor: '#D1FAE5', borderRadius: 10, padding: 8, alignItems: 'center' }}>
            <T style={{ color: '#065F46', fontWeight: '700', fontSize: 13 }}>{t.paymentApproved}</T>
          </View>
        )}

        {/* Chat button */}
        {forCleaner && (
          <TouchableOpacity style={s.chatCardBtn} onPress={() => openCleanerChat(b)}>
            <T style={s.chatCardBtnText}>{t.chatWithClient || "💬 צ'אט"}</T>
          </TouchableOpacity>
        )}

        {/* Before / After photos */}
        {isDone && (
          <View style={{ marginTop: 10 }}>
            <T style={{ fontSize: 11, fontWeight: '700', color: C.textSub, marginBottom: 6 }}>{t.photosTitle}</T>
            {forCleaner && (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity style={s.photoBtn} onPress={() => uploadJobPhoto(b.id, 'before')}>
                  <T style={s.photoBtnText}>📸 {t.beforePhotosLabel}</T>
                </TouchableOpacity>
                <TouchableOpacity style={[s.photoBtn, { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' }]} onPress={() => uploadJobPhoto(b.id, 'after')}>
                  <T style={[s.photoBtnText, { color: '#7C3AED' }]}>📸 {t.afterPhotosLabel}</T>
                </TouchableOpacity>
              </View>
            )}
            {!forCleaner && ((b.beforePhotos?.length > 0) || (b.afterPhotos?.length > 0)) && (
              <TouchableOpacity style={s.photoBtn} onPress={() => {
                const all = [...(b.beforePhotos || []), ...(b.afterPhotos || [])];
                setPhotoViewerUris(all); setPhotoViewerIdx(0); setPhotoViewerOpen(true);
              }}>
                <T style={s.photoBtnText}>📸 {t.viewPhotos} ({(b.beforePhotos?.length || 0) + (b.afterPhotos?.length || 0)})</T>
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
          <T style={{ color: '#EF4444', fontSize: 12, textAlign: 'right', marginTop: 4 }}>
            ⏰ {t.reviewDeadlineDays}: {Math.max(0, Math.ceil((new Date(b.reviewDeadline).getTime() - Date.now()) / 86400000))} ימים
          </T>
        )}

        {/* Rating row — רק הלקוח מדרג את המנקה (אין דירוג לקוח) */}
        {isDone && !forCleaner && (
          alreadyRated ? (
            <View style={s.ratedRow}>
              <T style={s.ratedLabel}>{t.ratedLabel}: </T>
              {[1,2,3,4,5].map(i => (
                <T key={i} style={{ color: i <= b.cleanerRating ? C.gold : C.blueBorder, fontSize: 14 }}>★</T>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={s.rateBtn} onPress={() => handleRate(b)}>
              <T style={s.rateBtnText}>⭐ {t.rateTitle}</T>
            </TouchableOpacity>
          )
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.wrap} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />

      <View style={[s.header, { paddingTop: (Platform.OS === 'ios' ? insets.top : (StatusBar.currentHeight || 0)) + 12 }, flipSide && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/home'); }} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={30} color="#FFFFFF" />
        </TouchableOpacity>
        <T style={s.headerTitle}>{t.myProfileTitle}</T>
        <TouchableOpacity
          onPress={() => setA11yOpen(true)}
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={t.accessibilityTitle || 'נגישות'}
        >
          <MaterialIcons name="accessibility" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <AccessibilityModal visible={a11yOpen} onClose={() => setA11yOpen(false)} />
      </View>

      {/* ── מסך טעינה כשמגיעים מפוש דחוף — מכסה את הפרופיל עד שמסך האישור נפתח ── */}
      <Modal visible={acceptOverlay && !pendingConfirmBooking} transparent={false} animationType="none">
        <View style={{ flex: 1, backgroundColor: C.blueDark, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <T style={{ fontSize: 44 }}>⚡</T>
          <ActivityIndicator size="large" color="#fff" />
          <T style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>מקבל/ת את ההזמנה הדחופה…</T>
        </View>
      </Modal>

      {/* ── מסך אישור הזמנה + צ'אט ── */}
      <Modal
        visible={!!pendingConfirmBooking}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setPendingConfirmBooking(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top','left','right']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>

            {/* ─── Header ─── (insets.top because SafeAreaView is 0 inside a Modal) */}
            <View style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: '#FED7AA' }}>
              <T style={{ fontSize: 16, fontWeight: '900', color: '#92400E', textAlign: 'center' }}>
                📥 הזמנה חדשה ממתינה לאישורך
              </T>
            </View>

            {pendingConfirmBooking && (
              <>
                {/* החלק העליון מוסתר כשהמקלדת פתוחה — כדי שהצ'אט יקבל את כל המקום */}
                {!keyboardOpen && (<>
                {/* ─── כרטיס הזמנה קומפקטי ─── */}
                <View style={{ backgroundColor: C.blueLight, marginHorizontal: 12, marginTop: 10, borderRadius: 16, padding: 14, gap: 6, borderWidth: 1.5, borderColor: C.blueBorder }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T style={{ fontSize: 15, fontWeight: '900', color: C.textDark }}>👤 {pendingConfirmBooking.clientName}</T>
                    <T style={{ fontSize: 16, fontWeight: '900', color: C.blue }}>₪{pendingConfirmBooking.total}</T>
                  </View>
                  <T style={{ fontSize: 13, color: C.textDark }}>📍 {pendingConfirmBooking.address}</T>
                  {(() => {
                    const svc = (Array.isArray(pendingConfirmBooking.serviceTypes) && pendingConfirmBooking.serviceTypes.length
                      ? pendingConfirmBooking.serviceTypes.map((st: string) => t.types[st] || st).join(', ')
                      : (pendingConfirmBooking.serviceType ? String(pendingConfirmBooking.serviceType).split(' + ').map((st: string) => t.types[st] || st).join(', ') : ''));
                    return svc ? <T style={{ fontSize: 13, fontWeight: '800', color: C.blue }}>🧹 {svc}</T> : null;
                  })()}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    <T style={{ fontSize: 12, color: C.textSub }}>📅 {pendingConfirmBooking.bookingDate}  🕐 {pendingConfirmBooking.startTime}</T>
                    <T style={{ fontSize: 12, color: C.textSub }}>⏱️ {pendingConfirmBooking.hours} {t.hoursUnit}</T>
                    <T style={{ fontSize: 12, color: C.textSub }}>
                      {PAY_ICONS[pendingConfirmBooking.payment] || '💳'} {pendingConfirmBooking.payment === 'bit' ? t.payBit : pendingConfirmBooking.payment === 'cash' ? t.payCash : pendingConfirmBooking.payment === 'paybox' ? t.payPaybox : pendingConfirmBooking.payment === 'bank' ? t.payBank : pendingConfirmBooking.payment === 'card' ? t.payCard : pendingConfirmBooking.payment}
                    </T>
                  </View>
                </View>

                {/* ─── כפתור שינוי שעה ─── */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 10, backgroundColor: '#F59E0B', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, alignSelf: 'flex-start', elevation: 3, shadowColor: '#92400E', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}
                  onPress={() => setShowPendingTimeChange(v => !v)}
                  activeOpacity={0.82}
                >
                  <T style={{ fontSize: 18 }}>🕐</T>
                  <T style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>{t.suggestTimeBtn}</T>
                  <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{showPendingTimeChange ? '▲' : '▼'}</T>
                </TouchableOpacity>

                {/* ─── פאנל שינוי שעה ─── */}
                {showPendingTimeChange && (
                  <View style={{ marginHorizontal: 12, marginTop: 6, backgroundColor: C.white, borderRadius: 16, padding: 14, gap: 12, borderWidth: 1.5, borderColor: '#FED7AA' }}>
                    <T style={{ fontSize: 13, fontWeight: '800', color: C.textDark, textAlign: 'center' }}>{t.altTimeForClient}</T>

                    {/* בחירת תאריך */}
                    <View style={{ gap: 4 }}>
                      <T style={{ fontSize: 12, fontWeight: '700', color: C.textSub }}>{t.dateShort}</T>
                      <TouchableOpacity
                        style={{ backgroundColor: C.bg, borderRadius: 10, borderWidth: 1.5, borderColor: C.blueBorder, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' }}
                        onPress={() => { setShowTimePicker(false); setShowDatePicker(true); }}
                      >
                        <T style={{ fontSize: 15, fontWeight: '700', color: C.blue }}>
                          {pendingPickerDate.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </T>
                      </TouchableOpacity>
                    </View>

                    {/* לוח שנה */}
                    {showDatePicker && (
                      <DateTimePicker
                        value={pendingPickerDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                        minimumDate={new Date()}
                        onChange={(_, date) => {
                          if (date) {
                            setPendingPickerDate(prev => {
                              const d = new Date(date);
                              d.setHours(prev.getHours(), prev.getMinutes());
                              return d;
                            });
                          }
                          if (Platform.OS === 'android') setShowDatePicker(false);
                        }}
                      />
                    )}

                    {/* בחירת שעה */}
                    <View style={{ gap: 4 }}>
                      <T style={{ fontSize: 12, fontWeight: '700', color: C.textSub }}>{t.timeShort}</T>
                      <TouchableOpacity
                        style={{ backgroundColor: C.bg, borderRadius: 10, borderWidth: 1.5, borderColor: C.blueBorder, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' }}
                        onPress={() => { setShowDatePicker(false); setShowTimePicker(true); }}
                      >
                        <T style={{ fontSize: 15, fontWeight: '700', color: C.blue }}>
                          {pendingPickerDate.toLocaleTimeString(LOCALE_MAP[lang] || 'he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </T>
                      </TouchableOpacity>
                    </View>

                    {/* גלגלת שעה */}
                    {showTimePicker && (
                      <DateTimePicker
                        value={pendingPickerDate}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                        is24Hour
                        onChange={(_, date) => {
                          if (date) {
                            setPendingPickerDate(prev => {
                              const d = new Date(prev);
                              d.setHours(date.getHours(), date.getMinutes());
                              return d;
                            });
                          }
                          if (Platform.OS === 'android') setShowTimePicker(false);
                        }}
                      />
                    )}

                    {/* כפתור שליחה */}
                    <TouchableOpacity
                      style={{ backgroundColor: '#F59E0B', borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                      onPress={suggestTimeChange}
                    >
                      <T style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{t.sendProposalToClient}</T>
                    </TouchableOpacity>
                  </View>
                )}
                </>)}

                {/* ─── צ'אט ─── */}
                <T style={{ fontSize: 12, fontWeight: '800', color: C.textSub, paddingHorizontal: 16, marginTop: 10, marginBottom: 2 }}>{t.chatWithClient}</T>
                <FlatList
                  ref={pendingChatScrollRef}
                  data={pendingChatMsgs}
                  keyExtractor={m => m.id}
                  style={{ flex: 1, paddingHorizontal: 12 }}
                  contentContainerStyle={{ paddingVertical: 6, gap: 8 }}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={() => pendingChatScrollRef.current?.scrollToEnd({ animated: true })}
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
                      <T style={{ fontSize: 28 }}>💬</T>
                      <T style={{ fontSize: 12, color: C.textSub, textAlign: 'center' }}>{t.msgBeforeApproval}</T>
                    </View>
                  }
                  renderItem={({ item }) => {
                    // identify "mine" by sender uid so it stays in sync with the
                    // main chat (which sends only fromUid, no `from` field)
                    const isMe = item.fromUid ? item.fromUid === uid : item.from === 'cleaner';
                    const timeLabel = item.createdAt ? new Date(item.createdAt).toLocaleTimeString(LOCALE_MAP[lang] || 'he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
                    // הודעה קולית
                    if (item.type === 'audio') {
                      const isPlaying = chatPlayingId === item.id;
                      return (
                        <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <TouchableOpacity
                            onPress={() => playCleanerAudio(item.audioUrl, item.id)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isMe ? C.blue : C.white, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '80%', borderWidth: isMe ? 0 : 1, borderColor: C.blueBorder, elevation: 1 }}
                          >
                            <T style={{ fontSize: 22 }}>{isPlaying ? '⏸' : '▶️'}</T>
                            <T style={{ color: isMe ? '#fff' : C.textDark, fontSize: 13 }}>🎤 {isPlaying ? t.recordingAudio ?? 'מנגן...' : 'הודעה קולית'}</T>
                          </TouchableOpacity>
                          <T style={{ fontSize: 10, color: C.textSub, marginTop: 2 }}>{timeLabel}</T>
                        </View>
                      );
                    }
                    // תמונה
                    if (item.type === 'image') {
                      const uri = item.imageBase64 || item.imageUrl;
                      return (
                        <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <TouchableOpacity onPress={() => uri && setChatViewerUri(uri)} activeOpacity={0.85}>
                            <Image source={{ uri }} style={{ width: 180, height: 135, borderRadius: 12, borderWidth: 1, borderColor: C.blueBorder }} contentFit="cover" />
                          </TouchableOpacity>
                          <T style={{ fontSize: 10, color: C.textSub, marginTop: 2 }}>{timeLabel}</T>
                        </View>
                      );
                    }
                    // טקסט
                    return (
                      <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        <View style={{ backgroundColor: isMe ? C.blue : C.white, borderRadius: 16, borderBottomRightRadius: isMe ? 3 : 16, borderBottomLeftRadius: isMe ? 16 : 3, paddingHorizontal: 13, paddingVertical: 9, maxWidth: '80%', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
                          <T style={{ fontSize: 14, color: isMe ? '#fff' : C.textDark, lineHeight: 20 }}>{item.text}</T>
                          <T style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.6)' : C.textSub, marginTop: 2 }}>{timeLabel}</T>
                        </View>
                      </View>
                    );
                  }}
                />

                {/* ─── שורת קלט ─── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: C.blueBorder }}>
                  {chatIsRecording && (
                    <View style={{ position: 'absolute', top: -30, left: 0, right: 0, alignItems: 'center' }}>
                      <T style={{ color: '#fff', fontWeight: '800', fontSize: 13, backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, overflow: 'hidden' }}>{t.recordingAudio}</T>
                    </View>
                  )}
                  <TextInput
                    style={{ flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder, textAlign: 'right', maxHeight: 70 }}
                    value={pendingChatInput}
                    onChangeText={setPendingChatInput}
                    placeholder={t.chatInputClientPh}
                    placeholderTextColor={C.textSub}
                    multiline
                    returnKeyType="send"
                    onSubmitEditing={() => sendPendingChat()}
                  />
                  {pendingChatInput.trim() ? (
                    <TouchableOpacity
                      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => sendPendingChat()}
                    >
                      <T style={{ fontSize: 16, color: '#fff' }}>➤</T>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' }}
                        onPress={sendCleanerImage}
                      >
                        <T style={{ fontSize: 20 }}>📷</T>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: chatIsRecording ? '#EF4444' : '#25D366', alignItems: 'center', justifyContent: 'center' }}
                        onPressIn={startCleanerRecording}
                        onPressOut={stopAndSendCleanerRecording}
                      >
                        <MaterialIcons name="mic" size={22} color="#fff" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* ─── כפתורים — אשר/דחה רק אם ההזמנה עדיין ממתינה; אחרת רק סגור ─── */}
                {(() => {
                  const live = incomingBks.find((x: any) => x.id === pendingConfirmBooking?.id);
                  const status = live?.status || pendingConfirmBooking?.status || 'pending';
                  // נלקחה ע"י מנקה אחר (תוך כדי שאני במסך), או כבר לא ממתינה — רק כפתור סגור + הודעה
                  if (urgentTakenByOther || status !== 'pending') {
                    return (
                      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: keyboardOpen ? 8 : insets.bottom + 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.blueBorder, gap: 8 }}>
                        {urgentTakenByOther && (
                          <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                            <T style={{ fontSize: 14, fontWeight: '900', color: '#DC2626' }}>⚡ ההזמנה נלקחה על ידי מנקה אחר/ת</T>
                          </View>
                        )}
                        <TouchableOpacity style={{ backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }} onPress={() => setPendingConfirmBooking(null)}>
                          <T style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>{(t as any).understoodClose ?? 'סגור'}</T>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return (
                <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: keyboardOpen ? 8 : insets.bottom + 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.blueBorder }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                    onPress={() => handleConfirmBooking(pendingConfirmBooking)}
                  >
                    <T style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>{t.approveBookingBtn}</T>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' }}
                    onPress={() => {
                      // דחוף שעדיין לא נתפס — סגירה מיידית בלי אישור כפול (אין מה לבטל)
                      if (pendingConfirmBooking?.urgentUnclaimed) { setPendingConfirmBooking(null); return; }
                      Alert.alert(t.cancelConfirmTitle, t.cancelConfirmMsg, [
                        { text: t.cancelKeepBooking, style: 'cancel' },
                        { text: t.cancelConfirmBtn, style: 'destructive', onPress: async () => {
                          try {
                            const pcb = pendingConfirmBooking;
                            // דחוף שעדיין לא נתפס — פשוט סוגרים; הבקשה נשארת פתוחה למנקים אחרים
                            if (pcb?.urgentUnclaimed) { setPendingConfirmBooking(null); return; }
                            SHOWN_PENDING.add(pcb.id); // לא להקפיץ שוב את אותה הזמנה
                            await updateDoc(doc(db, 'bookings', pcb.id), { status: 'cancelled', cancelledBy: 'cleaner', cancelledAt: new Date().toISOString() });
                            setIncomingBks(prev => prev.filter(x => x.id !== pcb.id));
                            // פוש ללקוח על הדחייה
                            try {
                              if (pcb.clientUid) {
                                const cs = await getDoc(doc(db, 'users', pcb.clientUid));
                                const tok = cs.data()?.pushToken;
                                if (tok) {
                                  const dl = `${pcb.bookingDate || ''}${pcb.startTime ? ' ' + pcb.startTime : ''}`.trim();
                                  await sendPushNotification(tok, (t as any).pushBookingCancelledTitle ?? '❌ הזמנה בוטלה', ((t as any).pushBookingCancelledBody ?? 'ההזמנה בוטלה על ידי {who}').replace('{who}', pcb.cleanerName || 'המנקה') + (dl ? ` · ${dl}` : ''), { type: 'booking_cancelled', bookingId: pcb.id });
                                }
                              }
                            } catch (_) {}
                          } catch (_) {}
                          incomingBks.forEach((x: any) => { if (x.status === 'pending') SHOWN_PENDING.add(x.id); });
                          setPendingConfirmBooking(null);
                        }},
                      ]);
                    }}
                  >
                    <T style={{ fontSize: 15, fontWeight: '900', color: '#EF4444' }}>{t.rejectBtn}</T>
                  </TouchableOpacity>
                </View>
                  );
                })()}
              </>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── מודל פרטי הזמנה פעילה (לקוח) ── */}
      <Modal
        visible={!!activeBookingDetail}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveBookingDetail(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, gap: 16 }}>

            {/* כותרת */}
            <T style={{ fontSize: 18, fontWeight: '900', color: C.textDark, textAlign: 'center' }}>
              📋 פרטי הזמנה
            </T>

            {activeBookingDetail && (() => {
              const b = activeBookingDetail;
              const statusColors: Record<string,string> = {
                pending: '#F59E0B', confirmed: '#8B5CF6', onway: '#F97316', active: '#3B82F6',
              };
              const statusColor = statusColors[b.status] || C.blue;
              const canCancel = ['pending','confirmed'].includes(b.status);
              return (
                <>
                  {/* כרטיס פרטים */}
                  <View style={{ backgroundColor: C.blueLight, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1.5, borderColor: C.blueBorder }}>

                    {/* שם מנקה + סטטוס */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <T style={{ fontSize: 17, fontWeight: '900', color: C.textDark }}>🧹 {b.cleanerName || 'מנקה'}</T>
                      <View style={{ backgroundColor: statusColor, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <T style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{getStatusLabel(b.status)}</T>
                      </View>
                    </View>

                    <View style={{ height: 1, backgroundColor: C.blueBorder }} />

                    {/* כתובת */}
                    <T style={{ fontSize: 15, color: C.textDark, lineHeight: 22 }}>📍 {b.address}</T>

                    {/* תאריך + שעה */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <T style={{ fontSize: 15, fontWeight: '700', color: C.textDark }}>
                        📅 {b.bookingDate ? new Date(b.bookingDate).toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { weekday: 'long', day: '2-digit', month: '2-digit', year: '2-digit' }) : b.bookingDate}
                      </T>
                      {b.startTime ? <T style={{ fontSize: 15, fontWeight: '700', color: C.textDark }}>🕐 {b.startTime}</T> : null}
                    </View>

                    {/* שעות + תשלום */}
                    <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                      <T style={{ fontSize: 15, fontWeight: '700', color: C.textDark }}>⏱️ {b.hours} {t.hoursUnit}</T>
                      <T style={{ fontSize: 15, fontWeight: '700', color: C.textDark }}>
                        {PAY_ICONS[b.payment] || '💳'} {b.payment === 'bit' ? t.payBit : b.payment === 'cash' ? t.payCash : b.payment === 'paybox' ? t.payPaybox : b.payment === 'bank' ? t.payBank : b.payment === 'card' ? t.payCard : b.payment}
                      </T>
                    </View>

                    {/* סה"כ */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.blueBorder, paddingTop: 10 }}>
                      <T style={{ fontSize: 14, color: C.textSub }}>{t.totalLabel}</T>
                      <T style={{ fontSize: 24, fontWeight: '900', color: C.blue }}>₪{b.total}</T>
                    </View>
                  </View>

                  {/* כפתור ביטול */}
                  {canCancel && (
                    <TouchableOpacity
                      style={{ backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' }}
                      onPress={() => {
                        setActiveBookingDetail(null);
                        setTimeout(() => handleCancelBooking(b), 300);
                      }}
                    >
                      <T style={{ fontSize: 15, fontWeight: '900', color: '#DC2626' }}>{t.cancelBookingBtn}</T>
                    </TouchableOpacity>
                  )}

                  {/* כפתור סגירה */}
                  <TouchableOpacity
                    style={{ backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                    onPress={() => setActiveBookingDetail(null)}
                  >
                    <T style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>{t.closeBtn}</T>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── מודל הזמנה מאושרת ── */}
      <Modal
        visible={!!confirmedBookingView}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmedBookingView(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 24, padding: 24, gap: 16 }}>

            {/* כותרת */}
            <T style={{ fontSize: 19, fontWeight: '900', color: C.textDark, textAlign: 'center' }}>
              ✅ ההזמנה אושרה!
            </T>

            {confirmedBookingView && (
              <>
                {/* כרטיס פרטים */}
                <View style={{ backgroundColor: C.blueLight, borderRadius: 16, padding: 18, gap: 13 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <T style={{ fontSize: 20 }}>👤</T>
                    <T style={{ fontSize: 18, fontWeight: '900', color: C.textDark }}>{confirmedBookingView.clientName}</T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <T style={{ fontSize: 18 }}>📍</T>
                    <T style={{ fontSize: 16, color: C.textDark, flex: 1, lineHeight: 22 }}>{confirmedBookingView.address}</T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <T style={{ fontSize: 18 }}>📅</T>
                    <T style={{ fontSize: 17, fontWeight: '700', color: C.textDark }}>{confirmedBookingView.bookingDate}</T>
                    <T style={{ fontSize: 18 }}>🕐</T>
                    <T style={{ fontSize: 17, fontWeight: '700', color: C.textDark }}>{confirmedBookingView.startTime}</T>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
                    <T style={{ fontSize: 16, fontWeight: '700', color: C.textDark }}>⏱️ {confirmedBookingView.hours} {t.hoursUnit}</T>
                    <T style={{ fontSize: 16, fontWeight: '700', color: C.textDark }}>
                      {PAY_ICONS[confirmedBookingView.payment] || '💳'} {confirmedBookingView.payment === 'bit' ? t.payBit : confirmedBookingView.payment === 'cash' ? t.payCash : confirmedBookingView.payment === 'paybox' ? t.payPaybox : confirmedBookingView.payment === 'bank' ? t.payBank : confirmedBookingView.payment === 'card' ? t.payCard : confirmedBookingView.payment}
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1.5, borderTopColor: C.blueBorder, paddingTop: 12, marginTop: 2 }}>
                    <T style={{ fontSize: 15, fontWeight: '700', color: C.textSub }}>{t.totalLabel}</T>
                    <T style={{ fontSize: 26, fontWeight: '900', color: C.blue }}>₪{confirmedBookingView.total}</T>
                  </View>
                </View>

                {/* כפתור סגירה */}
                <TouchableOpacity
                  style={{ backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                  onPress={() => setConfirmedBookingView(null)}
                >
                  <T style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>{t.understoodClose}</T>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={C.blue} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 16 }}>

          {/* Hero */}
          <View style={s.hero}>
            <TouchableOpacity onPress={pickImage} disabled={uploading} style={s.avatarWrap}>
              {photoB64 ? (
                <Image source={{ uri: photoB64 }} style={s.avatarImg} contentFit="cover" />
              ) : (
                <View style={s.avatarFallback}>
                  <T style={s.avatarText}>{userName ? userName.charAt(0) : '?'}</T>
                </View>
              )}
              <View style={s.cameraBtn}>
                {uploading ? <ActivityIndicator size="small" color={C.white} /> : <T style={{ fontSize: 14 }}>📷</T>}
              </View>
            </TouchableOpacity>
            <T style={s.name}>{userName}</T>
            <T style={s.email}>{userEmail}</T>
            {!!userPhone && (
              <T style={s.email}>📱 {userPhone}</T>
            )}
            <View style={s.roleBadge}>
              <T style={s.roleBadgeText}>{isCleaner ? t.cleanerRole : t.clientRole}</T>
            </View>
            <TouchableOpacity style={s.editProfileBtn} onPress={openEditProfile}>
              <T style={s.editProfileBtnText}>{t.editProfileTitle}</T>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <T style={s.statVal}>{(isCleaner ? incomingBks : bookings).filter(b => b.status !== 'cancelled').length}</T>
              <T style={s.statLabel}>{t.bookingsLabel}</T>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <T style={s.statVal}>₪{isCleaner ? totalEarned : totalSpent}</T>
              <T style={s.statLabel}>{isCleaner ? 'הכנסות' : t.totalSpentLabel}</T>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <T style={s.statVal}>
                {isCleaner
                  ? incomingBks.filter(b => b.status === 'active' && !isPastBooking(b)).length
                  : bookings.filter(b => b.status === 'pending' && !isPastBooking(b)).length}
              </T>
              <T style={s.statLabel}>{isCleaner ? '🔄 פעיל' : t.pendingLabel}</T>
            </View>
          </View>

          {/* ── ניקיונות פעילים (מנקה) — ראשון בדף ──────────────────────── */}
          {isCleaner && (() => {
            // הזמנות שתאריכן עבר עוברות ל"הושלמו" — לא מוצגות כפעילות
            const activeBookings = incomingBks.filter(b => ['confirmed','onway','active'].includes(b.status) && !isPastBooking(b));
            return (
              <View style={[s.section, { backgroundColor: '#F0FDF4', borderRadius: 20, borderWidth: 2, borderColor: '#10B981' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <T style={[s.sectionTitle, { color: '#065F46', marginBottom: 0, flex: 1, textAlign: 'center' }]}>{t.activeCleaningsTitle}</T>
                  {activeBookings.length > 0 && (
                    <View style={{ backgroundColor: '#10B981', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginRight: 'auto' }}>
                      <T style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>{activeBookings.length}</T>
                    </View>
                  )}
                </View>
                {activeBookings.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 18, gap: 6 }}>
                    <T style={{ fontSize: 32 }}>🧹</T>
                    <T style={{ fontSize: 14, fontWeight: '700', color: '#065F46' }}>{t.noActiveCleanings}</T>
                    <T style={{ fontSize: 12, color: '#6B9DC2' }}>{t.newBookingsWillAppear}</T>
                  </View>
                ) : (
                  activeBookings.map(b => renderBookingCard(b, true))
                )}
              </View>
            );
          })()}

          {/* ── הזמנות פעילות (לקוח) — ראשון בדף ───────────────────────── */}
          {!isCleaner && (() => {
            // כל הזמנה שתאריכה עבר — גם אם התשלום לא אושר — עוברת להיסטוריה
            const activeBookings = bookings.filter(b =>
              ['pending','confirmed','onway','active'].includes(b.status) && !isPastBooking(b));
            return (
              <View style={[s.section, { backgroundColor: '#F0FDF4', borderRadius: 20, borderWidth: 2, borderColor: '#10B981' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' }} />
                  <T style={[s.sectionTitle, { color: '#065F46', marginBottom: 0, flex: 1, textAlign: 'center' }]}>{t.activeBookingsTitle}</T>
                  {activeBookings.length > 0 && (
                    <View style={{ backgroundColor: '#10B981', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginRight: 'auto' }}>
                      <T style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>{activeBookings.length}</T>
                    </View>
                  )}
                </View>
                {activeBookings.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 18, gap: 6 }}>
                    <T style={{ fontSize: 32 }}>🧹</T>
                    <T style={{ fontSize: 14, fontWeight: '700', color: '#065F46' }}>{t.noActiveCleanings}</T>
                    <T style={{ fontSize: 12, color: '#6B9DC2' }}>{t.newBookingsWillAppear}</T>
                  </View>
                ) : (
                  activeBookings.map(b => (
                    <TouchableOpacity key={b.id} onPress={() => setActiveBookingDetail(b)} activeOpacity={0.85}>
                      {renderBookingCard(b, false)}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            );
          })()}

          {/* ── CLEANER: דף אחד ─────────────────────────────────────────────── */}
          {isCleaner && (
            <View style={s.section}>

              {/* התראות והודעות פוש */}
              <View style={{ backgroundColor: hasPushToken ? '#ECFDF5' : '#FEF2F2', borderRadius: 16, borderWidth: 1.5, borderColor: hasPushToken ? '#6EE7B7' : '#FCA5A5', padding: 14, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <T style={{ fontSize: 15, fontWeight: '800', color: C.textDark }}>{t.notifSectionTitle}</T>
                  <T style={{ fontSize: 13, fontWeight: '800', color: hasPushToken ? '#059669' : '#DC2626' }}>{hasPushToken ? t.notifStatusOn : t.notifStatusOff}</T>
                </View>
                <T style={{ fontSize: 12, color: C.textSub, textAlign: 'right', marginBottom: 12 }}>{t.notifHint}</T>
                <TouchableOpacity
                  onPress={handleTogglePush}
                  disabled={pushToggleLoading}
                  style={{ backgroundColor: hasPushToken ? '#EF4444' : '#10B981', borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: pushToggleLoading ? 0.6 : 1 }}
                >
                  {pushToggleLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <T style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>{hasPushToken ? t.notifDisableBtn : t.notifEnableBtn}</T>}
                </TouchableOpacity>
              </View>

              {/* 1. בקשות דחופות — רק אם יש */}
              {urgentRequests.length > 0 && (
                <>
                  <T style={[s.sectionTitle, { color: '#4C1D95', textAlign: 'center' }]}>⚡ {t.urgentTabLabel} ({urgentRequests.length})</T>
                  {urgentRequests.map((req: any) => {
                    const expiresIn = Math.max(0, Math.ceil((new Date(req.expiresAt).getTime() - Date.now()) / 60000));
                    const receivedAt = req.createdAt
                      ? new Date(req.createdAt).toLocaleTimeString(LOCALE_MAP[lang] || 'he-IL', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <View key={req.id} style={{ backgroundColor: '#F5F3FF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#7C3AED', gap: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <T style={{ fontSize: 16, fontWeight: '900', color: '#4C1D95' }}>{t.urgentCardTitle}</T>
                          <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <T style={{ fontSize: 11, color: '#6D28D9', fontWeight: '700' }}>⏳ {expiresIn} דק׳</T>
                            {receivedAt ? <T style={{ fontSize: 10, color: '#9CA3AF' }}>{t.receivedAtLabel}{receivedAt}</T> : null}
                          </View>
                        </View>
                        <T style={{ fontSize: 14, color: C.textDark, fontWeight: '700' }}>👤 {req.clientName}</T>
                        <T style={{ fontSize: 13, color: C.textDark }}>📍 {req.address}</T>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <T style={{ fontSize: 12, color: C.textSub }}>📅 {req.date === 'today' ? t.urgentToday : t.urgentTomorrow} {req.startTime}</T>
                          <T style={{ fontSize: 12, color: C.textSub }}>⏱️ {req.hours} {t.hoursUnit}</T>
                          <T style={{ fontSize: 12, color: C.textSub }}>₪{req.total}</T>
                        </View>
                        <T style={{ fontSize: 12, color: C.textSub }}>
                          {PAY_ICONS[req.paymentMethod] || '💳'} {req.paymentMethod === 'cash' ? t.payCash : req.paymentMethod === 'bit' ? t.payBit : req.paymentMethod === 'paybox' ? t.payPaybox : req.paymentMethod === 'bank' ? t.payBank : req.paymentMethod === 'card' ? t.payCard : req.paymentMethod}
                        </T>
                        <TouchableOpacity
                          style={{ backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
                          onPress={() => handleAcceptUrgent(req)}
                        >
                          <T style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>{t.urgentAcceptBtn}</T>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <View style={{ height: 1, backgroundColor: C.blueBorder, marginVertical: 20 }} />
                </>
              )}

              {/* 2. Dashboard */}
              <T style={[s.sectionTitle, { marginBottom: 10, textAlign: 'center' }]}>📊 {t.dashboardTitle}</T>
              <View style={s.dashRow}>
                <View style={s.dashCard}>
                  <T style={s.dashVal}>₪{thisMonthEarned}</T>
                  <T style={s.dashLabel}>{t.thisMonthLabel}</T>
                </View>
                <View style={s.dashCard}>
                  <T style={s.dashVal}>{completedBks.length}</T>
                  <T style={s.dashLabel}>{t.completedJobsLabel}</T>
                </View>
                <View style={s.dashCard}>
                  <T style={s.dashVal}>{repeatClients}</T>
                  <T style={s.dashLabel}>{t.repeatClientsLabel}</T>
                </View>
                <View style={s.dashCard}>
                  <T style={s.dashVal}>{dashAvgRating}</T>
                  <T style={s.dashLabel}>{t.avgRatingLabel}</T>
                </View>
              </View>
              <View style={[s.dashRow, { marginTop: 10 }]}>
                <View style={s.dashCard}>
                  <T style={s.dashVal}>₪{allTimeEarned}</T>
                  <T style={s.dashLabel}>{t.allTimeEarningsLabel}</T>
                </View>
                <View style={s.dashCard}>
                  <T style={s.dashVal}>{cancelRate}%</T>
                  <T style={s.dashLabel}>{t.cancelRateLabel}</T>
                </View>
              </View>
              <View style={{ marginTop: 16 }}>
                <T style={[s.sectionTitle, { textAlign: 'center' }]}>{t.earningsChartLabel}</T>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100, marginTop: 8 }}>
                  {monthlyEarnings.map((val, i) => {
                    const pct = val / maxMonthly;
                    const barH = Math.max(pct * 80, val > 0 ? 4 : 0);
                    return (
                      <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                        <T style={{ fontSize: 9, color: C.textSub }}>{val > 0 ? `₪${val}` : ''}</T>
                        <View style={{ height: barH, backgroundColor: C.blue, borderRadius: 4, width: '100%' }} />
                        <T style={{ fontSize: 9, color: C.textSub }}>{last6Months[i].label}</T>
                      </View>
                    );
                  })}
                </View>
                {maxMonthly > 1 && (
                  <T style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
                    🏆 {t.bestMonthLabel}: {bestMonthLabel}
                  </T>
                )}
              </View>

              <View style={{ height: 1, backgroundColor: C.blueBorder, marginVertical: 20 }} />

              {/* 3. הזמנות נכנסות — תפריט נפתח */}
              <TouchableOpacity
                onPress={() => setIncomingOpen(v => !v)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.blueLight, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: C.blueBorder, marginBottom: incomingOpen ? 12 : 0 }}
              >
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <T style={[s.sectionTitle, { textAlign: 'right', marginBottom: 0 }]}>📥 {t.incomingBookings}</T>
                  {incomingBks.length > 0 && (
                    <View style={{ backgroundColor: C.blue, borderRadius: 11, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
                      <T style={{ color: C.white, fontSize: 12, fontWeight: '800' }}>{incomingBks.length}</T>
                    </View>
                  )}
                  {incomingBks.filter(b => (b.status === 'active' || b.status === 'onway') && !isPastBooking(b)).length > 0 && (
                    <View style={s.activeBadge}>
                      <T style={s.activeBadgeText}>🔄 {incomingBks.filter(b => (b.status === 'active' || b.status === 'onway') && !isPastBooking(b)).length} פעיל</T>
                    </View>
                  )}
                </View>
                <T style={{ fontSize: 16, color: C.blue, fontWeight: '800' }}>{incomingOpen ? '▲' : '▼'}</T>
              </TouchableOpacity>
              {incomingOpen && (
                incomingBks.length === 0 ? (
                  <View style={s.emptyBox}>
                    <T style={{ fontSize: 36, marginBottom: 8 }}>📭</T>
                    <T style={s.emptyText}>{t.noBookingsText}</T>
                  </View>
                ) : (
                  incomingBks.map(b => renderBookingCard(b, true))
                )
              )}

              <View style={{ height: 1, backgroundColor: C.blueBorder, marginVertical: 20 }} />

              {/* 4. לוח שבועי */}
              <T style={[s.sectionTitle, { textAlign: 'center', marginBottom: 12 }]}>🗓 {t.scheduleWeekTitle}</T>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {['א','ב','ג','ד','ה','ו','ש'].map((day, di) => {
                  const dayDate = new Date(weekStart);
                  dayDate.setDate(weekStart.getDate() + di);
                  const dayBks = weekBookings.filter(b => {
                    const bd = new Date(b.bookingDate || b.createdAt);
                    return bd.getDate() === dayDate.getDate() && bd.getMonth() === dayDate.getMonth();
                  });
                  const isToday = dayDate.toDateString() === nowDate.toDateString();
                  return (
                    <View key={di} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                      <T style={{ fontSize: 11, fontWeight: '700', color: isToday ? C.blue : C.textSub }}>{day}</T>
                      <T style={{ fontSize: 10, color: C.textSub }}>{dayDate.getDate()}</T>
                      <View style={{ width: '100%', gap: 2, minHeight: 32 }}>
                        {dayBks.map((b: any, bi: number) => (
                          <View key={bi} style={[s.scheduleBlock, { backgroundColor: b.status === 'active' ? '#D1FAE5' : b.status === 'confirmed' ? '#EDE9FE' : C.blueLight }]}>
                            <T style={{ fontSize: 8, color: C.textDark, fontWeight: '700' }}>{b.startTime || '?'}</T>
                            <T style={{ fontSize: 7, color: C.textSub }} numberOfLines={1}>{(b.clientName || '').split(' ')[0]}</T>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
              {weekBookings.length === 0 && (
                <T style={{ textAlign: 'center', color: C.textSub, fontSize: 12, marginTop: 8 }}>{t.scheduleEmpty}</T>
              )}

              {/* פורטפוליו */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ alignItems: 'center', marginBottom: 12, gap: 4 }}>
                  <T style={[s.sectionTitle, { textAlign: 'center' }]}>📸 {t.portfolioTitle}</T>
                  <TouchableOpacity onPress={pickPortfolioPhoto}>
                    <T style={{ fontSize: 13, color: C.blue, fontWeight: '700' }}>+ {t.portfolioAdd}</T>
                  </TouchableOpacity>
                </View>
                {portfolio.length === 0 ? (
                  <View style={s.emptyBox}>
                    <T style={{ fontSize: 32, marginBottom: 6 }}>🖼️</T>
                    <T style={s.emptyText}>{t.portfolioEmpty}</T>
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
                <T style={{ fontSize: 10, color: C.textSub, marginTop: 6 }}>{t.longPressDeletePhoto}</T>
              </View>

            </View>
          )}

          {/* ── לקוח: היסטוריית הזמנות (compact row) ──────────────────── */}
          {!isCleaner && (() => {
            // היסטוריה כוללת גם הזמנות שתאריכן עבר (גם אם עדיין לא סומנו כהושלמו)
            const historyBookings = bookings.filter(b =>
              !['pending','confirmed','onway','active'].includes(b.status) || isPastBooking(b));
            const lastB = historyBookings[0];
            return (
              <View style={s.section}>
                {historyBookings.length === 0 ? (
                  <View style={s.emptyBox}>
                    <T style={{ fontSize: 40, marginBottom: 8 }}>📋</T>
                    <T style={s.emptyText}>{t.noBookingsText}</T>
                    <T style={s.emptySubText}>{t.noBookingsSub}</T>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={s.historyCompactRow}
                    onPress={() => setHistoryOpen(true)}
                    activeOpacity={0.75}
                  >
                    <T style={s.historyCompactIcon}>📋</T>
                    <View style={{ flex: 1 }}>
                      <T style={s.historyCompactTitle}>{t.historyTitle}</T>
                      <T style={s.historyCompactSub}>
                        {historyBookings.length} {t.historyTitle}{lastB ? ` · ${lastB.cleanerName || ''}` : ''}
                      </T>
                    </View>
                    <T style={s.historyCompactArrow}>‹</T>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          {/* History Modal */}
          <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
              <View style={[s.historySheet, { paddingBottom: insets.bottom + 16 }]}>
                {/* handle */}
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.grayBorder, alignSelf: 'center', marginTop: 10, marginBottom: 4 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderColor: C.grayBorder }}>
                  <TouchableOpacity onPress={() => setHistoryOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <T style={{ fontSize: 15, color: C.blue, fontWeight: '700' }}>{t.closeBtn || 'סגור'}</T>
                  </TouchableOpacity>
                  <T style={{ fontSize: 16, fontWeight: '800', color: C.textDark }}>{t.historyTitle}</T>
                  <View style={{ width: 48 }} />
                </View>
                <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
                  {bookings
                    .filter(b => !['pending','confirmed','onway','active'].includes(b.status))
                    .map(b => renderBookingCard(b, false))
                  }
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* שפה מועדפת (לקוח) */}
          {!isCleaner && (
            <View style={s.section}>
              <T style={[s.sectionTitle, { textAlign: 'center' }]}>🌐 {t.drawerLanguage}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 10 }}>
                {[
                  { key: 'he', label: 'עברית',    flag: '🇮🇱' },
                  { key: 'en', label: 'English',  flag: '🇬🇧' },
                  { key: 'ru', label: 'Русский',  flag: '🇷🇺' },
                  { key: 'ar', label: 'العربية',  flag: '🇸🇦' },
                  { key: 'fr', label: 'Français', flag: '🇫🇷' },
                  { key: 'hi', label: 'हिन्दी',  flag: '🇮🇳' },
                  { key: 'uk', label: 'Українська', flag: '🇺🇦' },
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
                    <T style={[s.langBtnText, prefLang === l.key && s.langBtnTextActive, l.key === 'hi' && { fontFamily: 'NotoSansDevanagari_400Regular', fontWeight: '400' }]}>
                      {l.flag} {l.label}
                    </T>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── הכתובות שלי (לקוח) ── */}
          {!isCleaner && (
            <View style={s.section}>
              <T style={[s.sectionTitle, { textAlign: 'center' }]}>{t.myAddressesTitle}</T>

              {savedAddrs.length === 0 ? (
                <View style={s.emptyBox}>
                  <T style={{ fontSize: 36, marginBottom: 6 }}>📍</T>
                  <T style={s.emptyText}>{t.noSavedAddrs}</T>
                  <T style={s.emptySubText}>{t.savedAddrsHint}</T>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {savedAddrs.map((a) => (
                    <View key={a.id} style={{
                      backgroundColor: a.isPrimary ? C.blueLight : C.white,
                      borderRadius: 14, padding: 14,
                      borderWidth: a.isPrimary ? 2 : 1,
                      borderColor: a.isPrimary ? C.blue : C.blueBorder,
                      flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
                    }}>
                      {/* כתובת + תווית ראשית */}
                      <View style={{ flex: 1, gap: 2 }}>
                        {a.isPrimary && (
                          <T style={{ fontSize: 10, fontWeight: '800', color: C.blue, textAlign: 'right' }}>{t.primaryAutoFill}</T>
                        )}
                        <T style={{ fontSize: 13, fontWeight: '700', color: C.textDark, textAlign: 'right' }}>{a.address}</T>
                        <T style={{ fontSize: 10, color: C.textSub, textAlign: 'right' }}>
                          {t.lastUsedLabel}: {new Date(a.lastUsed).toLocaleDateString(LOCALE_MAP[lang] || 'he-IL')}
                        </T>
                      </View>
                      {/* כפתורים */}
                      <View style={{ gap: 6 }}>
                        {!a.isPrimary && (
                          <TouchableOpacity
                            style={{ backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                            onPress={() => handleSetPrimary(a.id)}
                          >
                            <T style={{ fontSize: 11, fontWeight: '700', color: C.blue }}>{t.primaryShort}</T>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={{ backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                          onPress={() => Alert.alert(t.deleteAddressTitle, `${t.deleteAddressTitle} "${a.address}"?`, [
                            { text: t.cancel, style: 'cancel' },
                            { text: t.portfolioDeleteBtn, style: 'destructive', onPress: () => handleDeleteAddr(a.id) },
                          ])}
                        >
                          <T style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>{t.deleteX}</T>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* הוסף כתובת חדשה */}
              {savedAddrs.length < 5 && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <TextInput
                    style={{
                      backgroundColor: C.white, borderRadius: 12, padding: 12,
                      fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder,
                      textAlign: 'right',
                    }}
                    placeholder={t.addNewAddrPh}
                    placeholderTextColor={C.textSub}
                    value={newAddrInput}
                    onChangeText={setNewAddrInput}
                    returnKeyType="done"
                    onSubmitEditing={handleAddAddr}
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: C.blue, borderRadius: 12, padding: 12, alignItems: 'center' }}
                    onPress={handleAddAddr}
                  >
                    <T style={{ fontSize: 14, fontWeight: '800', color: C.white }}>{t.addAddressBtn}</T>
                  </TouchableOpacity>
                  <T style={{ fontSize: 11, color: C.textSub, textAlign: 'center' }}>
                    {savedAddrs.length}/5 כתובות שמורות
                  </T>
                </View>
              )}
              {savedAddrs.length >= 5 && (
                <T style={{ fontSize: 12, color: C.textSub, textAlign: 'center', marginTop: 8 }}>
                  הגעת למקסימום 5 כתובות — מחק כתובת ישנה כדי להוסיף חדשה
                </T>
              )}
            </View>
          )}


          {/* כפתור דיווח — סוף הדף */}
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}>
            <TouchableOpacity style={s.reportBtn} onPress={() => setReportOpen(true)}>
              <T style={s.reportBtnText}>{t.reportBtn}</T>
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}

      {/* ── Payment Sheet Modal ── */}
      <Modal visible={paySheetOpen} transparent animationType="slide" onRequestClose={() => setPaySheetOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 20 }}>

            {/* כותרת */}
            <T style={{ fontSize: 18, fontWeight: '900', color: C.textDark, textAlign: 'center', marginBottom: 4 }}>{t.paySheetTitle}</T>
            <View style={{ backgroundColor: C.blueLight, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 }}>
              <T style={{ fontSize: 13, color: C.textSub }}>{t.paySheetAmount}</T>
              <T style={{ fontSize: 36, fontWeight: '900', color: C.blue }}>₪{paySheetAmount}</T>
              {paySheetClientName ? <T style={{ fontSize: 13, color: C.textSub }}>👤 {paySheetClientName}</T> : null}
            </View>

            {/* טאבים */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['bit','paybox','bank'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                    backgroundColor: paySheetTab === tab ? C.blue : C.blueLight,
                    borderWidth: 1.5, borderColor: paySheetTab === tab ? C.blue : C.blueBorder }}
                  onPress={() => setPaySheetTab(tab)}
                >
                  <T style={{ fontSize: 12, fontWeight: '800', color: paySheetTab === tab ? C.white : C.textDark }}>
                    {tab === 'bit' ? t.paySheetBitTab : tab === 'paybox' ? t.paySheetPayboxTab : t.paySheetBankTab}
                  </T>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Bit ── */}
            {paySheetTab === 'bit' && (
              <View style={{ gap: 12 }}>
                {cleanerBitPhone ? (
                  <>
                    <TouchableOpacity
                      style={{ backgroundColor: C.blueLight, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.blueBorder }}
                      onPress={() => {
                        Clipboard.setString(cleanerBitPhone);
                        setPayCopied('bit');
                        setTimeout(() => setPayCopied(''), 2000);
                      }}
                    >
                      <T style={{ fontSize: 11, color: C.textSub, marginBottom: 2 }}>{t.paySheetCopyTooltip}</T>
                      <T style={{ fontSize: 26, fontWeight: '900', color: C.blue, letterSpacing: 2 }}>💙 {cleanerBitPhone}</T>
                      {payCopied === 'bit' && <T style={{ fontSize: 12, color: C.green, marginTop: 4 }}>{t.paySheetCopied}</T>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                      onPress={() => {
                        const phone = cleanerBitPhone.replace(/\D/g, '').replace(/^0/, '');
                        const msg = encodeURIComponent(
                          `שלום ${paySheetClientName}! 👋\nהניקיון הסתיים ✅\nלתשלום ₪${paySheetAmount} ב-Bit:\n💙 ${cleanerBitPhone}\nשם: ${userName}`
                        );
                        if (paySheetClientPhone) Linking.openURL(`https://wa.me/972${paySheetClientPhone}?text=${msg}`);
                        else Alert.alert('', t.noClientPhone);
                      }}
                    >
                      <T style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{t.paySheetBitSend} 📱</T>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: C.blueLight, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder }}
                      onPress={() => Linking.openURL('https://www.bitpay.co.il')}
                    >
                      <T style={{ color: C.blue, fontWeight: '700', fontSize: 14 }}>{t.paySheetBitOpen} →</T>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
                    <T style={{ fontSize: 32 }}>💙</T>
                    <T style={{ color: C.textSub, textAlign: 'center' }}>{t.paySheetBitNoPhone}</T>
                    <TouchableOpacity onPress={() => { setPaySheetOpen(false); openEditProfile(); }}
                      style={{ backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                      <T style={{ color: C.white, fontWeight: '700' }}>{t.setupNow}</T>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ── Paybox ── */}
            {paySheetTab === 'paybox' && (
              <View style={{ gap: 12 }}>
                {cleanerPayboxLink ? (
                  <>
                    <TouchableOpacity
                      style={{ backgroundColor: '#F3E8FF', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#C084FC' }}
                      onPress={() => {
                        Clipboard.setString(cleanerPayboxLink);
                        setPayCopied('paybox');
                        setTimeout(() => setPayCopied(''), 2000);
                      }}
                    >
                      <T style={{ fontSize: 11, color: '#9333EA', marginBottom: 4 }}>{t.paySheetCopyTooltip}</T>
                      <T style={{ fontSize: 13, fontWeight: '700', color: '#7C3AED', textAlign: 'center' }} numberOfLines={1}>💜 {cleanerPayboxLink}</T>
                      {payCopied === 'paybox' && <T style={{ fontSize: 12, color: C.green, marginTop: 4 }}>{t.paySheetCopied}</T>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                      onPress={() => {
                        const link = cleanerPayboxLink.includes('?')
                          ? `${cleanerPayboxLink}&amount=${paySheetAmount}`
                          : `${cleanerPayboxLink}?amount=${paySheetAmount}`;
                        const msg = encodeURIComponent(
                          `שלום ${paySheetClientName}! 👋\nהניקיון הסתיים ✅\nלתשלום ₪${paySheetAmount} ב-Paybox:\n💜 ${link}`
                        );
                        if (paySheetClientPhone) Linking.openURL(`https://wa.me/972${paySheetClientPhone}?text=${msg}`);
                        else Linking.openURL(link);
                      }}
                    >
                      <T style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{t.paySheetPayboxSend} 💜</T>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: '#F3E8FF', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C084FC' }}
                      onPress={() => Linking.openURL(cleanerPayboxLink)}
                    >
                      <T style={{ color: '#7C3AED', fontWeight: '700', fontSize: 14 }}>{t.openPaybox}</T>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
                    <T style={{ fontSize: 32 }}>💜</T>
                    <T style={{ color: C.textSub, textAlign: 'center' }}>{t.paySheetPayboxNoLink}</T>
                    <TouchableOpacity onPress={() => { setPaySheetOpen(false); openEditProfile(); }}
                      style={{ backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                      <T style={{ color: C.white, fontWeight: '700' }}>{t.setupNow}</T>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ── העברה בנקאית ── */}
            {paySheetTab === 'bank' && (
              <View style={{ gap: 10 }}>
                {(cleanerBankNum || cleanerBankAccount) ? (
                  <>
                    {[
                      { label: t.payBankNameLabel,    value: cleanerBankName,    key: 'name' },
                      { label: t.payBankNumLabel,      value: cleanerBankNum,     key: 'num' },
                      { label: t.payBankBranchLabel,   value: cleanerBankBranch,  key: 'branch' },
                      { label: t.payBankAccountLabel,  value: cleanerBankAccount, key: 'acc' },
                    ].filter(r => r.value).map(row => (
                      <TouchableOpacity
                        key={row.key}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.blueLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.blueBorder }}
                        onPress={() => {
                          Clipboard.setString(row.value);
                          setPayCopied(row.key);
                          setTimeout(() => setPayCopied(''), 2000);
                        }}
                      >
                        <View>
                          <T style={{ fontSize: 11, color: C.textSub }}>{row.label}</T>
                          <T style={{ fontSize: 16, fontWeight: '800', color: C.textDark }}>{row.value}</T>
                        </View>
                        <T style={{ fontSize: 14, color: payCopied === row.key ? C.green : C.textSub }}>
                          {payCopied === row.key ? '✅' : '📋'}
                        </T>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={{ backgroundColor: '#1E3A5F', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 }}
                      onPress={() => {
                        const details =
                          `שלום ${paySheetClientName}! 👋\nהניקיון הסתיים ✅\n\n` +
                          `💳 לתשלום ₪${paySheetAmount} בהעברה בנקאית:\n` +
                          (cleanerBankName    ? `שם: ${cleanerBankName}\n` : '') +
                          (cleanerBankNum     ? `בנק: ${cleanerBankNum}\n` : '') +
                          (cleanerBankBranch  ? `סניף: ${cleanerBankBranch}\n` : '') +
                          (cleanerBankAccount ? `חשבון: ${cleanerBankAccount}\n` : '') +
                          `\nתודה! 🙏`;
                        const msg = encodeURIComponent(details);
                        if (paySheetClientPhone) Linking.openURL(`https://wa.me/972${paySheetClientPhone}?text=${msg}`);
                        else Alert.alert('', t.noClientPhone);
                      }}
                    >
                      <T style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{t.paySheetBankSend} 🏦</T>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
                    <T style={{ fontSize: 32 }}>🏦</T>
                    <T style={{ color: C.textSub, textAlign: 'center' }}>{t.paySheetBankNoDetails}</T>
                    <TouchableOpacity onPress={() => { setPaySheetOpen(false); openEditProfile(); }}
                      style={{ backgroundColor: '#1E3A5F', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                      <T style={{ color: C.white, fontWeight: '700' }}>{t.setupNow}</T>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* כפתור דלג */}
            <TouchableOpacity
              style={{ marginTop: 16, paddingVertical: 12, alignItems: 'center' }}
              onPress={() => setPaySheetOpen(false)}
            >
              <T style={{ color: C.textSub, fontSize: 13, fontWeight: '600' }}>{t.paySheetSkip}</T>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <RateModal
        booking={rateTarget}
        visible={rateModal}
        isCleaner={isCleaner}
        onClose={() => { setRateModal(false); setRateTarget(null); }}
        onSubmit={isCleaner ? submitCleanerRating : submitRating}
      />

      {/* Cleaner Chat Modal */}
      <Modal visible={chatOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { setChatOpen(false); if (chatUnsubRef.current) chatUnsubRef.current(); }}>
        <View style={{ flex: 1, backgroundColor: C.bluePale }}>
          {/* safe-area-context insets are 0 inside a Modal, so use the screen's
              insets.top directly to clear the notch */}
          <View style={{ backgroundColor: C.blue, paddingTop: insets.top }}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => { setChatOpen(false); if (chatUnsubRef.current) chatUnsubRef.current(); }} style={s.backBtn}>
                <MaterialIcons name="arrow-back" size={24} color={C.white} />
              </TouchableOpacity>
              <T style={s.headerTitle}>💬 {chatClientName}</T>
              <View style={{ width: 36 }} />
            </View>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}>
          <ScrollView ref={chatScrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}>
            {chatMessages.map(m => {
              const isMe = m.fromUid === uid;
              if (m.type === 'audio') {
                const isPlaying = chatPlayingId === m.id;
                return (
                  <View key={m.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <TouchableOpacity
                      style={[s.chatAudioBubble, isMe ? s.chatAudioBubbleMe : s.chatAudioBubbleOther]}
                      onPress={() => playCleanerAudio(m.audioUrl, m.id)}
                    >
                      <T style={{ fontSize: 22 }}>{isPlaying ? '⏸' : '▶️'}</T>
                      <T style={{ color: isMe ? C.textDark : C.white, fontSize: 13, marginLeft: 6 }}>
                        🎤 {isPlaying ? 'מנגן...' : 'הודעה קולית'}
                      </T>
                    </TouchableOpacity>
                  </View>
                );
              }
              if (m.type === 'image') {
                const uri = m.imageBase64 || m.imageUrl;
                return (
                  <View key={m.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <TouchableOpacity onPress={() => uri && setChatViewerUri(uri)} activeOpacity={0.85}>
                      <Image
                        source={{ uri }}
                        style={{ width: 200, height: 150, borderRadius: 12, borderWidth: 1, borderColor: C.blueBorder, marginVertical: 2 }}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                  </View>
                );
              }
              return (
                <View key={m.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <View style={[s.chatBubble, isMe ? s.chatBubbleMe : s.chatBubbleOther]}>
                    <T style={{ color: isMe ? C.textDark : C.white, fontSize: 14 }}>{m.text}</T>
                  </View>
                </View>
              );
            })}
          </ScrollView>
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.white }}>
              <View style={[s.chatInputRow, { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8 }]}>
                {chatIsRecording && (
                  <View style={{ position: 'absolute', top: -34, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ color: '#fff', fontWeight: '800', fontSize: 13, backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, overflow: 'hidden' }}>{t.recordingAudio}</T>
                  </View>
                )}
                <TouchableOpacity style={s.chatSendBtn} onPress={sendCleanerMessage}>
                  <T style={{ color: C.white, fontSize: 18 }}>▶</T>
                </TouchableOpacity>
                <TextInput
                  style={s.chatTextInput}
                  placeholder={t.chatInputPh}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholderTextColor={C.textSub}
                  textAlign="right"
                  onSubmitEditing={sendCleanerMessage}
                />
                <TouchableOpacity
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 }}
                  onPress={sendCleanerImage}
                >
                  <T style={{ fontSize: 20 }}>📷</T>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.chatMicBtn, chatIsRecording && s.chatMicBtnRecording, { backgroundColor: chatIsRecording ? '#EF4444' : '#25D366', borderWidth: 0 }]}
                  onPressIn={startCleanerRecording}
                  onPressOut={stopAndSendCleanerRecording}
                >
                  <MaterialIcons name="mic" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* end cleaner chat */}

      {/* Chat Image Viewer */}
      <Modal visible={!!chatViewerUri} transparent animationType="fade" onRequestClose={() => setChatViewerUri(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={1} onPress={() => setChatViewerUri(null)}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 10, zIndex: 10 }} onPress={() => setChatViewerUri(null)}>
            <T style={{ color: C.white, fontSize: 18, fontWeight: '700' }}>✕</T>
          </TouchableOpacity>
          {chatViewerUri && (
            <Image source={{ uri: chatViewerUri }} style={{ width: '92%', height: '75%' }} contentFit="contain" />
          )}
        </TouchableOpacity>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal visible={photoViewerOpen} transparent animationType="fade" onRequestClose={() => setPhotoViewerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 8 }}
            onPress={() => setPhotoViewerOpen(false)}
          >
            <T style={{ color: C.white, fontSize: 18, fontWeight: '700' }}>✕</T>
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
                <T style={{ color: C.white, fontSize: 16 }}>◀</T>
              </TouchableOpacity>
              <T style={{ color: C.white, alignSelf: 'center' }}>{photoViewerIdx + 1} / {photoViewerUris.length}</T>
              <TouchableOpacity onPress={() => setPhotoViewerIdx(i => Math.min(photoViewerUris.length - 1, i + 1))} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 10 }}>
                <T style={{ color: C.white, fontSize: 16 }}>▶</T>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Insurance Modal */}
      <Modal visible={insuranceOpen} transparent animationType="slide" onRequestClose={() => setInsuranceOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16 }}>
              <View style={{ alignItems: 'center' }}>
                <T style={{ fontSize: 20, fontWeight: '900', color: '#1E3A8A', marginBottom: 4 }}>{t.insuranceFormTitle}</T>
              </View>
              {insuranceSent ? (
                <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
                  <T style={{ fontSize: 48 }}>✅</T>
                  <T style={{ fontSize: 16, fontWeight: '700', color: C.green, textAlign: 'center' }}>{t.insuranceSentMsg}</T>
                  <TouchableOpacity style={[s.insuranceBtnLarge, { marginTop: 8 }]} onPress={() => setInsuranceOpen(false)}>
                    <T style={s.insuranceBtnLargeText}>{t.closeBtn}</T>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={{ gap: 6 }}>
                    <T style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>{t.insuranceNameLabel}: {userName}</T>
                    <T style={{ fontSize: 13, color: C.textSub }}>{t.insurancePhoneLabel}: {userPhone || '—'}</T>
                    {bookings[0] && (
                      <T style={{ fontSize: 13, color: C.textSub }}>{t.insuranceBookingLabel}: {bookings[0].cleanerName} • {bookings[0].bookingDate}</T>
                    )}
                  </View>
                  <View style={{ gap: 6 }}>
                    <T style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>{t.insuranceMsgLabel}</T>
                    <TextInput
                      style={{ backgroundColor: C.bg, borderRadius: 12, padding: 13, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder, textAlign: 'right', minHeight: 90, textAlignVertical: 'top' }}
                      value={insuranceMsg}
                      onChangeText={setInsuranceMsg}
                      placeholder={t.insuranceMsgPlaceholder}
                      placeholderTextColor={C.textSub}
                      multiline
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: C.grayBg, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.grayBorder }}
                      onPress={() => setInsuranceOpen(false)}
                    >
                      <T style={{ fontWeight: '700', color: C.textSub }}>{t.cancel}</T>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[{ flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }, s.insuranceBtnLarge, (!insuranceMsg.trim() || insuranceSending) && { opacity: 0.5 }]}
                      onPress={handleInsuranceSubmit}
                      disabled={!insuranceMsg.trim() || insuranceSending}
                    >
                      <T style={s.insuranceBtnLargeText}>{insuranceSending ? t.insuranceSending : t.insuranceSubmitBtn}</T>
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: insets.bottom }} />
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── מודל עריכת פרופיל מנקה ── */}
      <Modal visible={editOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
          <View style={[s.header, { justifyContent: 'space-between' }]}>
            <TouchableOpacity onPress={() => setEditOpen(false)} style={s.backBtn}>
              <T style={{ color: C.white, fontSize: 18 }}>✕</T>
            </TouchableOpacity>
            <T style={s.headerTitle}>{t.editProfileTitle}</T>
            <View style={{ width: 36 }} />
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 16 }}>

              {/* שם */}
              <View>
                <T style={ep.label}>{t.editFullNameLabel}</T>
                <TextInput style={ep.input} value={editName} onChangeText={setEditName} placeholder={t.editFullNameLabel} placeholderTextColor={C.textSub} textAlign="right" />
              </View>

              {/* כתובת מלאה — לקוח בלבד */}
              {!isCleaner && (
                <View style={{ gap: 10 }}>
                  <T style={ep.label}>{t.homeAddressLabel}</T>

                  {/* עיר */}
                  <View>
                    <T style={[ep.label, { fontSize: 12, color: C.textSub }]}>{t.cityRequiredLabel}</T>
                    <TextInput
                      style={ep.input}
                      value={editCity}
                      onChangeText={setEditCity}
                      placeholder={t.cityExamplePh}
                      placeholderTextColor={C.textSub}
                      textAlign="right"
                    />
                  </View>

                  {/* רחוב + מספר בית */}
                  <View>
                    <T style={[ep.label, { fontSize: 12, color: C.textSub }]}>{t.streetNumLabel}</T>
                    <TextInput
                      style={ep.input}
                      value={editStreet}
                      onChangeText={setEditStreet}
                      placeholder={t.streetExamplePh}
                      placeholderTextColor={C.textSub}
                      textAlign="right"
                    />
                  </View>

                  {/* סוג דיור */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: !editAddrPrivate ? C.blue : C.bluePale, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: !editAddrPrivate ? C.blue : C.blueBorder }}
                      onPress={() => setEditAddrPrivate(false)}
                    >
                      <T style={{ fontSize: 16 }}>{!editAddrPrivate ? '🔵' : '⚪'}</T>
                      <T style={{ fontWeight: '700', color: !editAddrPrivate ? C.white : C.textDark, fontSize: 14 }}>{t.apartmentLabel}</T>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: editAddrPrivate ? C.blue : C.bluePale, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: editAddrPrivate ? C.blue : C.blueBorder }}
                      onPress={() => setEditAddrPrivate(true)}
                    >
                      <T style={{ fontSize: 16 }}>{editAddrPrivate ? '🔵' : '⚪'}</T>
                      <T style={{ fontWeight: '700', color: editAddrPrivate ? C.white : C.textDark, fontSize: 14 }}>{t.privateHouseLabel}</T>
                    </TouchableOpacity>
                  </View>

                  {/* קומה + דירה */}
                  {!editAddrPrivate && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <T style={[ep.label, { fontSize: 12, color: C.textSub }]}>{t.floorPh}</T>
                        <TextInput
                          style={ep.input}
                          value={editFloor}
                          onChangeText={setEditFloor}
                          placeholder="3"
                          keyboardType="numeric"
                          placeholderTextColor={C.textSub}
                          textAlign="right"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <T style={[ep.label, { fontSize: 12, color: C.textSub }]}>{t.aptNumberPh}</T>
                        <TextInput
                          style={ep.input}
                          value={editApt}
                          onChangeText={setEditApt}
                          placeholder="12"
                          keyboardType="numeric"
                          placeholderTextColor={C.textSub}
                          textAlign="right"
                        />
                      </View>
                    </View>
                  )}

                  {/* תצוגה מקדימה */}
                  {(editCity || editStreet) && (
                    <View style={{ backgroundColor: C.bluePale, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.blueBorder }}>
                      <T style={{ fontSize: 11, color: C.textSub, marginBottom: 2 }}>{t.fullAddrLabel}</T>
                      <T style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>
                        {[editStreet.trim(), editCity.trim(), editAddrPrivate ? 'בית פרטי' : (editFloor ? `קומה ${editFloor}` : ''), (!editAddrPrivate && editApt) ? `דירה ${editApt}` : ''].filter(Boolean).join(', ')}
                      </T>
                    </View>
                  )}
                </View>
              )}

              {/* טלפון */}
              <View>
                <T style={ep.label}>{t.editPhoneLabel}</T>
                <TextInput style={ep.input} value={editPhone} onChangeText={setEditPhone} placeholder="05X-XXXXXXX" keyboardType="phone-pad" placeholderTextColor={C.textSub} textAlign="right" />
              </View>

              {/* שדות מנקה בלבד */}
              {isCleaner && (<>

              {/* כתובת מנקה מלאה — מתחת לטלפון */}
              <View>
                <T style={ep.label}>{t.cleanerAddressLabel}</T>
                <TextInput style={ep.input} value={editCleanerAddress} onChangeText={setEditCleanerAddress} placeholder={t.cleanerAddressPlaceholder} placeholderTextColor={C.textSub} textAlign="right" />
              </View>

              {/* גיל + אזרחות — כמו בהרשמה */}
              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <T style={ep.label}>{t.ageLabel}</T>
                  <TextInput style={ep.input} value={editAge} onChangeText={setEditAge} placeholder={t.agePlaceholder} keyboardType="number-pad" placeholderTextColor={C.textSub} textAlign="center" />
                </View>
                <View style={{ flex: 1 }}>
                  <T style={ep.label}>{t.citizenshipLabel}</T>
                  <TextInput style={ep.input} value={editCitizenship} onChangeText={setEditCitizenship} placeholder={t.citizenshipPlaceholder} placeholderTextColor={C.textSub} textAlign="center" />
                </View>
              </View>

              {/* ניסיון + מרחק הגעה מקסימלי — כמו בהרשמה */}
              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <T style={ep.label}>{t.experienceLabel}</T>
                  <TextInput style={ep.input} value={editExperience} onChangeText={setEditExperience} placeholder={t.experiencePlaceholder} keyboardType="number-pad" placeholderTextColor={C.textSub} textAlign="center" />
                </View>
                <View style={{ flex: 1 }}>
                  <T style={ep.label}>{t.maxDistanceLabel}</T>
                  <TextInput style={ep.input} value={editMaxDistance} onChangeText={setEditMaxDistance} placeholder="10" keyboardType="number-pad" placeholderTextColor={C.textSub} textAlign="center" />
                </View>
              </View>

              {/* תיאור */}
              <View>
                <T style={ep.label}>
                  {t.editBioLabel} ({editBio.trim().split(/\s+/).filter(Boolean).length}/30)
                </T>
                <TextInput
                  style={[ep.input, { height: 90, textAlignVertical: 'top' }]}
                  value={editBio}
                  onChangeText={v => {
                    const words = v.trim().split(/\s+/).filter(Boolean);
                    if (words.length < 30) setEditBio(v);
                    else if (words.length === 30) setEditBio(words.join(' '));
                    else setEditBio(words.slice(0, 30).join(' '));
                  }}
                  placeholder={t.editBioShortPlaceholder}
                  multiline
                  placeholderTextColor={C.textSub}
                  textAlign="right"
                />
              </View>

              {/* נייד */}
              <View>
                <T style={ep.label}>{t.editMobileLabel}</T>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[{ v: true, label: t.editMobileYes }, { v: false, label: t.editMobileNo }].map(opt => (
                    <TouchableOpacity key={String(opt.v)} style={[ep.pill, editIsMobile === opt.v && ep.pillActive, { flex: 1, alignItems: 'center', paddingVertical: 12 }]} onPress={() => setEditIsMobile(opt.v)}>
                      <T style={[ep.pillText, editIsMobile === opt.v && ep.pillTextActive]}>{opt.label}</T>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ציוד */}
              <View>
                <T style={ep.label}>{t.suppliesLabel}</T>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[{ v: true, label: t.suppliesYesShort }, { v: false, label: t.suppliesNoShort }].map(opt => (
                    <TouchableOpacity key={String(opt.v)} style={[ep.pill, editBringSupplies === opt.v && ep.pillActive, { flex: 1, alignItems: 'center', paddingVertical: 12 }]} onPress={() => setEditBringSupplies(opt.v)}>
                      <T style={[ep.pillText, editBringSupplies === opt.v && ep.pillTextActive]}>{opt.label}</T>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* סוגי שירות + מחיר */}
              <View>
                <T style={ep.label}>{t.editServicePricingLabel}</T>
                <View style={{ gap: 8, marginTop: 6 }}>
                  {[
                    { key: 'ניקיון רגיל',           icon: '🏠' },
                    { key: 'ניקוי לפסח',           icon: '🧹' },
                    { key: 'חלונות',               icon: '🪟' },
                    { key: 'שטיפת רכב',            icon: '🚗' },
                    { key: 'לאחר שיפוץ',           icon: '🔨' },
                    { key: 'ניקיון משרדים',         icon: '🏢' },
                    { key: 'ניקיון אחרי אירוע',     icon: '🎉' },
                    { key: 'מחסן ועליית גג',        icon: '📦' },
                    { key: 'סידורי בגדים וארונות',  icon: '👔' },
                  ].map(svc => {
                    const active = editTypes.includes(svc.key);
                    return (
                      <View key={svc.key} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                        {/* כפתור בחירה */}
                        <TouchableOpacity
                          style={[ep.pill, active && ep.pillActive, { flex: 1, alignItems: 'flex-end' }]}
                          onPress={() => toggleEdit(editTypes, setEditTypes, svc.key)}
                        >
                          <T style={[ep.pillText, active && ep.pillTextActive, { textAlign: 'right' }]}>{svc.icon} {svc.key}</T>
                        </TouchableOpacity>
                        {/* שדה מחיר */}
                        <TextInput
                          style={[ep.input, { width: 72, marginBottom: 0, textAlign: 'center', opacity: active ? 1 : 0.4 }]}
                          value={editServicePricing[svc.key] || ''}
                          onChangeText={v => {
                            setEditServicePricing(prev => ({ ...prev, [svc.key]: v }));
                            if (v && !active) toggleEdit(editTypes, setEditTypes, svc.key);
                          }}
                          placeholder="₪"
                          keyboardType="numeric"
                          placeholderTextColor={C.textSub}
                          editable={active}
                        />
                        <ServiceInfoBtn serviceKey={svc.key} />
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* אמצעי תשלום */}
              <View>
                <T style={ep.label}>{t.editPaymentLabel}</T>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {[{ key: 'cash', label: '💵 ' + t.payCash }, { key: 'bit', label: '📱 ' + t.payBit }, { key: 'paybox', label: '💜 ' + t.payPaybox }, { key: 'bank', label: '🏦 ' + t.payBank }].map(p => (
                    <TouchableOpacity key={p.key} style={[ep.pill, editPayment.includes(p.key) && ep.pillActive, { flex: 1, alignItems: 'center' }]} onPress={() => toggleEdit(editPayment, setEditPayment, p.key)}>
                      <T style={[ep.pillText, editPayment.includes(p.key) && ep.pillTextActive]}>{p.label}</T>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* אימות זהות */}
              <View>
                <T style={[ep.label, { textAlign: 'center', fontSize: 15 }]}>🪪 {t.idVerifyTitle}</T>
                <View style={{ backgroundColor: C.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.blueBorder, gap: 10, marginTop: 6 }}>
                  <T style={{ fontSize: 12, color: C.textSub, lineHeight: 18 }}>{t.idVerifyInfo}</T>
                  {idVerified ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#DCFCE7', borderRadius: 12, padding: 12 }}>
                      <T style={{ fontSize: 22 }}>🪪</T>
                      <T style={{ fontSize: 14, fontWeight: '900', color: '#15803D' }}>{t.idVerifyDone}</T>
                    </View>
                  ) : (
                    <TouchableOpacity style={ep.saveBtn} onPress={pickIdPhoto}>
                      <T style={ep.saveBtnText}>{t.idVerifyUpload}</T>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* שפה מועדפת */}
              <View>
                <T style={[ep.label, { textAlign: 'center', fontSize: 15 }]}>🌐 {t.drawerLanguage}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 8 }}>
                  {[
                    { key: 'he', label: 'עברית',    flag: '🇮🇱' },
                    { key: 'en', label: 'English',  flag: '🇬🇧' },
                    { key: 'ru', label: 'Русский',  flag: '🇷🇺' },
                    { key: 'ar', label: 'العربية',  flag: '🇸🇦' },
                    { key: 'fr', label: 'Français', flag: '🇫🇷' },
                    { key: 'hi', label: 'हिन्दी',  flag: '🇮🇳' },
                  { key: 'uk', label: 'Українська', flag: '🇺🇦' },
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
                      <T style={[s.langBtnText, prefLang === l.key && s.langBtnTextActive]}>
                        {l.flag} {l.label}
                      </T>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ימים ושעות עבודה */}
              <View>
                <T style={[ep.label, { textAlign: 'center', fontSize: 15 }]}>📅 {t.availTitle}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {DAYS_KEYS.map((day, i) => {
                    const d = availability[day] || { active: false, start: 9, end: 18 };
                    return (
                      <TouchableOpacity key={day} style={[s.dayBtn, d.active && s.dayBtnActive]} onPress={() => toggleDay(day)}>
                        <T style={[s.dayBtnText, d.active && s.dayBtnTextActive]}>{DAYS_LABELS[i]}</T>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {DAYS_KEYS.some(day => availability[day]?.active) && (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {DAYS_KEYS.map((day, i) => {
                      const d = availability[day];
                      if (!d?.active) return null;
                      return (
                        <View key={day} style={s.dayRow}>
                          <T style={s.dayHourLabel}>{DAYS_LABELS[i]}</T>
                          <View style={s.hoursRow}>
                            <View style={s.hourCtrl}>
                              <TouchableOpacity onPress={() => updateDayHours(day, 'start', -1)} style={s.hourArrow}><T style={s.hourArrowText}>◀</T></TouchableOpacity>
                              <T style={s.hourVal}>{String(d.start).padStart(2,'0')}:00</T>
                              <TouchableOpacity onPress={() => updateDayHours(day, 'start', 1)} style={s.hourArrow}><T style={s.hourArrowText}>▶</T></TouchableOpacity>
                            </View>
                            <T style={s.hourDash}>—</T>
                            <View style={s.hourCtrl}>
                              <TouchableOpacity onPress={() => updateDayHours(day, 'end', -1)} style={s.hourArrow}><T style={s.hourArrowText}>◀</T></TouchableOpacity>
                              <T style={s.hourVal}>{String(d.end).padStart(2,'0')}:00</T>
                              <TouchableOpacity onPress={() => updateDayHours(day, 'end', 1)} style={s.hourArrow}><T style={s.hourArrowText}>▶</T></TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
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
                <T style={ep.saveBtnText}>{editSaving ? t.savingText : t.editSaveBtn}</T>
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
              <T style={{ color: C.white, fontSize: 18 }}>✕</T>
            </TouchableOpacity>
            <T style={s.headerTitle}>🚨 {t.reportTitle}</T>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 16 }}>
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
                  <T style={{ fontSize: 22 }}>{reportType === opt.key ? '🔵' : '⚪'}</T>
                  <T style={{ fontSize: 15, fontWeight: '700', color: reportType === opt.key ? C.white : C.textDark }}>{opt.label}</T>
                </TouchableOpacity>
              ))}
            </View>

            {/* שם האדם */}
            {reportType !== 'bug' && (
              <View style={{ gap: 6 }}>
                <T style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>
                  {reportType === 'cleaner' ? '🧹 שם המנקה' : '👤 שם הלקוח'}
                </T>
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
              <T style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>📝 {t.reportDescLabel}</T>
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
              <T style={{ fontSize: 15, fontWeight: '800', color: C.white }}>
                {reportSending ? '...' : t.reportSubmit}
              </T>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>


    </SafeAreaView>
  );
}


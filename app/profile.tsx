import React, { useEffect, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, Modal, Switch, Share, Linking,
  TextInput, KeyboardAvoidingView, Platform, BackHandler, Clipboard,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, arrayRemove, arrayUnion, onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { storage } from '../lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
// expo-av נטען דינמית — לא קורס ב-Expo Go
let Audio: typeof import('expo-av').Audio | null = null;
try { Audio = require('expo-av').Audio; } catch (_) {}
import { useLanguage, T, useAppColors, AppColors } from '../lib/LanguageContext';
import ServiceInfoBtn from '../lib/ServiceInfoBtn';
import { Lang } from '../lib/translations';
import AccessibilityModal from '../lib/AccessibilityModal';
import { MaterialIcons } from '@expo/vector-icons';
import { TAB_BAR_CONTENT_HEIGHT } from '../lib/BottomTabBar';


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
    backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
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
    historyCompactRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: c.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.blueBorder, gap: 12 },
    historyCompactIcon: { fontSize: 26 },
    historyCompactTitle:{ fontSize: 15, fontWeight: '800', color: c.textDark },
    historyCompactSub:  { fontSize: 13, color: c.textSub, marginTop: 2 },
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

const PAY_ICONS: Record<string, string> = { bit: '📱', cash: '💵', paybox: '💜', bank: '🏦' };

const SERVICE_ICONS: Record<string, string> = {
  'ניקוי כללי': '🏠', 'ניקוי לפסח': '🧹', 'חלונות': '🪟', 'לאחר שיפוץ': '🔨',
  'שטיפת רכב': '🚗', 'ניקיון משרדים': '🏢', 'ניקיון אחרי אירוע': '🎉',
  'מחסן ועליית גג': '📦', 'סידורי בגדים וארונות': '👔',
};

const SERVICE_DETAIL: Record<string, string[]> = {
  'ניקוי כללי': [
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
  const { tab, requestId, section } = useLocalSearchParams<{ tab?: string; requestId?: string; section?: string }>();
  const { t, lang, setLang, flipSide } = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const ep = createEP(C);
  const insets = useSafeAreaInsets();
  const [a11yOpen, setA11yOpen] = useState(false);

  const uid    = auth.currentUser?.uid || '';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
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
  const [referralCode, setReferralCode] = useState('');
  const [portfolio,    setPortfolio]    = useState<string[]>([]);
  const [idVerified,   setIdVerified]   = useState(false);
  const [prefLang,     setPrefLang]     = useState('he');
  const [userPhone,    setUserPhone]    = useState('');

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

  // הצג מודל אישור הזמנה — כולל הזמנות חדשות שמגיעות בזמן אמת
  useEffect(() => {
    if (!userRole || userRole !== 'cleaner') return;
    const pendingBks = incomingBks.filter((b: any) => b.status === 'pending');
    const newOnes = pendingBks.filter((b: any) => !shownPendingRef.current.has(b.id));
    if (newOnes.length > 0) {
      // הצג את החדשה ביותר
      setPendingConfirmBooking(newOnes[0]);
      newOnes.forEach((b: any) => shownPendingRef.current.add(b.id));
    }
  }, [incomingBks, userRole]);

  // Urgent requests
  const [urgentRequests, setUrgentRequests] = useState<any[]>([]);

  // Active booking detail modal (client tap)
  const [activeBookingDetail, setActiveBookingDetail] = useState<any>(null);

  // Booking history modal (client)
  const [historyOpen, setHistoryOpen] = useState(false);

  // Pending booking confirmation modal
  const [pendingConfirmBooking, setPendingConfirmBooking] = useState<any>(null);
  const [confirmedBookingView,  setConfirmedBookingView]  = useState<any>(null);
  const [confirmChatMsgs,       setConfirmChatMsgs]       = useState<any[]>([]);
  const [confirmChatInput,      setConfirmChatInput]      = useState('');
  const confirmChatScrollRef = useRef<FlatList>(null);
  const confirmChatUnsubRef  = useRef<(() => void) | null>(null);
  const shownPendingRef = useRef<Set<string>>(new Set());

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
        unreadBy: [clientUid],
      }, { merge: true });
    } catch (_) {}
  };

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
    if (!pendingConfirmBooking) { setPendingChatMsgs([]); setShowPendingTimeChange(false); return; }
    const clientUid = pendingConfirmBooking.clientUid;
    if (!uid || !clientUid) return;
    const chatId = [uid, clientUid].sort().join('_');
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    pendingChatUnsubRef.current = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendingChatMsgs(msgs);
      setTimeout(() => pendingChatScrollRef.current?.scrollToEnd({ animated: true }), 80);
    }, () => {});
    return () => { if (pendingChatUnsubRef.current) pendingChatUnsubRef.current(); };
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
  const [editCleanerAddress, setEditCleanerAddress] = useState('');
  const [editServicePricing,setEditServicePricing]= useState<Record<string,string>>({});
  const [editWhatsappGroupId,setEditWhatsappGroupId]= useState('');
  const [editSaving,       setEditSaving]       = useState(false);
  // Payment details (cleaner)
  const [editBitPhone,     setEditBitPhone]     = useState('');
  const [editPayboxLink,   setEditPayboxLink]   = useState('');
  const [editBankName,     setEditBankName]     = useState('');
  const [editBankNum,      setEditBankNum]      = useState('');
  const [editBankBranch,   setEditBankBranch]   = useState('');
  const [editBankAccount,  setEditBankAccount]  = useState('');
  // Cleaner saved payment details
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
  const [chatRecordingObj, setChatRecordingObj] = useState<any>(null);
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
        const sp = d.servicePricing || {};
        const spStr: Record<string,string> = {};
        Object.entries(sp).forEach(([k,v]) => { spStr[k] = String(v); });
        // אם אין מחיר לניקוי כללי — מלא מהמחיר הישן
        if (!spStr['ניקוי כללי'] && d.price) spStr['ניקוי כללי'] = String(d.price);
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
      await updateDoc(doc(db, 'users', uid), {
        name:          editName.trim(),
        city:          editCity.trim(),
        street:        editStreet.trim(),
        floor:         editFloor.trim(),
        apt:           editApt.trim(),
        isPrivate:     editAddrPrivate,
        phone:         editPhone.trim(),
        bio:           editBio.trim(),
        price:         Number(editServicePricing['ניקוי כללי']) || Number(Object.values(editServicePricing).find(v => v)) || 0,
        types:         editTypes,
        payment:       editPayment,
        workAreas:     editWorkAreas,
        bringSupplies: editBringSupplies,
        isMobile:      editIsMobile,
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
    // ── טעינת נתוני פרופיל (חד-פעמי) ──────────────────────────────────────
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserName(d.name        || '');
          setUserEmail(d.email      || '');
          setUserRole(d.role        || '');
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
          if (!perm.granted) return Alert.alert(t.error, t.galleryPermDenied);
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
          if (!perm.granted) return Alert.alert(t.error, t.cameraPermDenied);
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

  const sendCleanerImage = async () => {
    if (!chatClientUid) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(t.error, t.galleryPermDenied);
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
        participantNames: { [uid]: userName, [chatClientUid]: chatClientName },
        unreadBy: arrayUnion(chatClientUid),
      }, { merge: true });
    } catch (err: any) {
      Alert.alert(t.imageSendError, err?.message || t.error);
    }
  };

  const startCleanerRecording = async () => {
    if (!Audio) return Alert.alert(t.error, t.audioUnavailableMsg);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert(t.error, t.micPermDenied);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setChatRecordingObj(recording);
      setChatIsRecording(true);
    } catch (_) {}
  };

  const stopAndSendCleanerRecording = async () => {
    if (!chatRecordingObj) return;
    setChatIsRecording(false);
    const chatId = [uid, chatClientUid].sort().join('_');
    try {
      await chatRecordingObj.stopAndUnloadAsync();
      const uri = chatRecordingObj.getURI();
      setChatRecordingObj(null);
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
        unreadBy: arrayUnion(chatClientUid),
      }, { merge: true });
    } catch (_) { Alert.alert(t.error, t.audioSendError); }
  };

  const playCleanerAudio = async (audioUrl: string, msgId: string) => {
    if (!Audio) return;
    if (chatSoundRef.current) {
      await chatSoundRef.current.unloadAsync().catch(() => {});
      chatSoundRef.current = null;
    }
    if (chatPlayingId === msgId) { setChatPlayingId(null); return; }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
      chatSoundRef.current = sound;
      setChatPlayingId(msgId);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setChatPlayingId(null);
          chatSoundRef.current = null;
        }
      });
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
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { month: 'short' }) };
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
  const handleConfirmBooking = async (b: any) => {
    try {
      // אם בוצע שינוי זמן — עדכן בהזמנה
      const updates: any = { status: 'confirmed' };
      const dateChanged = showPendingTimeChange && (pendingNewDate || pendingNewTime);
      if (dateChanged) {
        const newDateStr = pendingPickerDate.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const newTimeStr = pendingPickerDate.toLocaleTimeString(LOCALE_MAP[lang] || 'he-IL', { hour: '2-digit', minute: '2-digit' });
        updates.bookingDate = newDateStr;
        updates.startTime   = newTimeStr;
      }
      await updateDoc(doc(db, 'bookings', b.id), updates);
      const confirmed = { ...b, ...updates };
      setIncomingBks(prev => prev.map(x => x.id === b.id ? confirmed : x));
      setPendingConfirmBooking(null);
      setShowPendingTimeChange(false);
      setConfirmedBookingView(confirmed);

      // שלח push + הודעת צ'אט ללקוח
      try {
        const clientSnap = await getDoc(doc(db, 'users', b.clientUid));
        const token = clientSnap.data()?.pushToken;
        const dateLabel = confirmed.bookingDate || b.bookingDate || '';
        const timeLabel = confirmed.startTime   || b.startTime   || '';
        const pushBody  = dateChanged
          ? `${userName} אישר עם שינוי זמן: ${dateLabel} ב-${timeLabel}`
          : `${userName} אישר את ההזמנה שלך — ${dateLabel} ב-${timeLabel}`;
        if (token) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: token, title: '✅ ההזמנה אושרה!', body: pushBody, sound: 'default', priority: 'high' }),
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
        Alert.alert('', t.urgentAlreadyTaken);
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
      Alert.alert('✅', `${req.clientName}\n${req.address}`);
    } catch (_) {
      Alert.alert(t.error, t.acceptRequestError);
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
            setBookings(prev => prev.filter(x => x.id !== b.id));
            setIncomingBks(prev => prev.filter(x => x.id !== b.id));
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
              { key: 'pending', label: '📋 ממתין' },
              { key: 'onway',   label: '🚗 בדרך' },
              { key: 'active',  label: '🧹 פעיל' },
              { key: 'done',    label: '✅ הסתיים' },
            ];
            const statusOrder: Record<string, number> = { pending: 0, onway: 1, active: 2, done: 3 };
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
              <T style={{ fontSize: 12, fontWeight: '800', color: '#065F46' }}>✅ תשלום אושר</T>
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

        {/* Cancel button — pending only, both client and cleaner */}
        {b.status === 'pending' && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancelBooking(b)}>
            <T style={s.cancelBtnText}>✕ {t.cancelBookingBtn}</T>
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
            <T style={{ color: '#065F46', fontWeight: '700', fontSize: 13 }}>✅ תשלום אושר</T>
          </View>
        )}

        {/* Chat button */}
        {forCleaner && (
          <TouchableOpacity style={s.chatCardBtn} onPress={() => openCleanerChat(b)}>
            <T style={s.chatCardBtnText}>💬 {t.chatBtnShort || "צ'אט"}</T>
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

        {/* Rating row */}
        {isDone && (
          alreadyRated ? (
            <View style={s.ratedRow}>
              <T style={s.ratedLabel}>{t.ratedLabel}: </T>
              {[1,2,3,4,5].map(i => (
                <T key={i} style={{ color: i <= (forCleaner ? b.clientRating : b.cleanerRating) ? C.gold : C.blueBorder, fontSize: 14 }}>★</T>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={s.rateBtn} onPress={() => handleRate(b)}>
              <T style={s.rateBtnText}>⭐ {forCleaner ? t.rateCleanerLbl : t.rateTitle}</T>
            </TouchableOpacity>
          )
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.wrap} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />

      <View style={[s.header, { paddingTop: (StatusBar.currentHeight || 0) + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <T style={{ color: C.white, fontSize: 20 }}>←</T>
        </TouchableOpacity>
        <T style={s.headerTitle}>{t.myProfileTitle}</T>
        <TouchableOpacity
          onPress={() => setA11yOpen(true)}
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, width: 36, height: 32, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={t.accessibilityTitle || 'נגישות'}
        >
          <MaterialIcons name="accessibility" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <AccessibilityModal visible={a11yOpen} onClose={() => setA11yOpen(false)} />
      </View>

      {/* ── מסך אישור הזמנה + צ'אט ── */}
      <Modal
        visible={!!pendingConfirmBooking}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setPendingConfirmBooking(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top','left','right']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>

            {/* ─── Header ─── */}
            <View style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: '#FED7AA' }}>
              <T style={{ fontSize: 16, fontWeight: '900', color: '#92400E', textAlign: 'center' }}>
                📥 הזמנה חדשה ממתינה לאישורך
              </T>
            </View>

            {pendingConfirmBooking && (
              <>
                {/* ─── כרטיס הזמנה קומפקטי ─── */}
                <View style={{ backgroundColor: C.blueLight, marginHorizontal: 12, marginTop: 10, borderRadius: 16, padding: 14, gap: 6, borderWidth: 1.5, borderColor: C.blueBorder }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T style={{ fontSize: 15, fontWeight: '900', color: C.textDark }}>👤 {pendingConfirmBooking.clientName}</T>
                    <T style={{ fontSize: 16, fontWeight: '900', color: C.blue }}>₪{pendingConfirmBooking.total}</T>
                  </View>
                  <T style={{ fontSize: 13, color: C.textDark }}>📍 {pendingConfirmBooking.address}</T>
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
                      <T style={{ fontSize: 12, fontWeight: '700', color: C.textSub }}>📅 תאריך</T>
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
                      <T style={{ fontSize: 12, fontWeight: '700', color: C.textSub }}>🕐 שעה</T>
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

                {/* ─── צ'אט ─── */}
                <T style={{ fontSize: 12, fontWeight: '800', color: C.textSub, paddingHorizontal: 16, marginTop: 10, marginBottom: 2 }}>💬 שיחה עם הלקוח</T>
                <FlatList
                  ref={pendingChatScrollRef}
                  data={pendingChatMsgs}
                  keyExtractor={m => m.id}
                  style={{ flex: 1, paddingHorizontal: 12 }}
                  contentContainerStyle={{ paddingVertical: 6, gap: 8 }}
                  onContentSizeChange={() => pendingChatScrollRef.current?.scrollToEnd({ animated: true })}
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
                      <T style={{ fontSize: 28 }}>💬</T>
                      <T style={{ fontSize: 12, color: C.textSub, textAlign: 'center' }}>{t.msgBeforeApproval}</T>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isMe = item.from === 'cleaner';
                    return (
                      <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        <View style={{ backgroundColor: isMe ? C.blue : C.white, borderRadius: 16, borderBottomRightRadius: isMe ? 3 : 16, borderBottomLeftRadius: isMe ? 16 : 3, paddingHorizontal: 13, paddingVertical: 9, maxWidth: '80%', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
                          <T style={{ fontSize: 14, color: isMe ? '#fff' : C.textDark, lineHeight: 20 }}>{item.text}</T>
                          <T style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.6)' : C.textSub, marginTop: 2 }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleTimeString(LOCALE_MAP[lang] || 'he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </T>
                        </View>
                      </View>
                    );
                  }}
                />

                {/* ─── שורת קלט ─── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: C.blueBorder }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder, textAlign: 'right', maxHeight: 70 }}
                    value={pendingChatInput}
                    onChangeText={setPendingChatInput}
                    placeholder="כתוב הודעה ללקוח..."
                    placeholderTextColor={C.textSub}
                    multiline
                    returnKeyType="send"
                    onSubmitEditing={() => sendPendingChat()}
                  />
                  <TouchableOpacity
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: pendingChatInput.trim() ? C.blue : C.grayBorder, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => sendPendingChat()}
                    disabled={!pendingChatInput.trim()}
                  >
                    <T style={{ fontSize: 16, color: '#fff' }}>➤</T>
                  </TouchableOpacity>
                </View>

                {/* ─── כפתורי אישור/דחייה ─── */}
                <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: insets.bottom + 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.blueBorder }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                    onPress={() => handleConfirmBooking(pendingConfirmBooking)}
                  >
                    <T style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>✅ אשר הזמנה</T>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' }}
                    onPress={() => {
                      Alert.alert(t.cancelConfirmTitle, t.cancelConfirmMsg, [
                        { text: t.cancelKeepBooking, style: 'cancel' },
                        { text: t.cancelConfirmBtn, style: 'destructive', onPress: async () => {
                          try {
                            await updateDoc(doc(db, 'bookings', pendingConfirmBooking.id), { status: 'cancelled' });
                            setIncomingBks(prev => prev.filter(x => x.id !== pendingConfirmBooking.id));
                          } catch (_) {}
                          setPendingConfirmBooking(null);
                        }},
                      ]);
                    }}
                  >
                    <T style={{ fontSize: 15, fontWeight: '900', color: '#EF4444' }}>❌ דחה</T>
                  </TouchableOpacity>
                </View>
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
                      <T style={{ fontSize: 15, fontWeight: '900', color: '#DC2626' }}>❌ {t.cancelBookingBtn}</T>
                    </TouchableOpacity>
                  )}

                  {/* כפתור סגירה */}
                  <TouchableOpacity
                    style={{ backgroundColor: C.blue, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                    onPress={() => setActiveBookingDetail(null)}
                  >
                    <T style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>סגור</T>
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

                {/* כפתור צ'אט */}
                <TouchableOpacity
                  style={{ backgroundColor: C.blueLight, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.blueBorder, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  onPress={() => {
                    setConfirmedBookingView(null);
                    // פתח את הצ'אט הקיים עם הלקוח
                    setChatOpen(true);
                    setChatClientUid(confirmedBookingView.clientUid);
                    setChatClientName(confirmedBookingView.clientName);
                  }}
                >
                  <T style={{ fontSize: 18 }}>💬</T>
                  <T style={{ fontSize: 15, fontWeight: '800', color: C.blue }}>{t.sendMsgToClient}</T>
                </TouchableOpacity>

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
              <T style={s.statVal}>{isCleaner ? incomingBks.length : bookings.length}</T>
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
                  ? incomingBks.filter(b => b.status === 'active').length
                  : bookings.filter(b => b.status === 'pending').length}
              </T>
              <T style={s.statLabel}>{isCleaner ? '🔄 פעיל' : t.pendingLabel}</T>
            </View>
          </View>

          {/* ── ניקיונות פעילים (מנקה) — ראשון בדף ──────────────────────── */}
          {isCleaner && (() => {
            const activeBookings = incomingBks.filter(b => ['confirmed','onway','active'].includes(b.status));
            return (
              <View style={[s.section, { backgroundColor: '#F0FDF4', borderRadius: 20, borderWidth: 2, borderColor: '#10B981' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' }} />
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
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const activeBookings = bookings.filter(b => {
              if (!['pending','confirmed','onway','active'].includes(b.status)) return false;
              if (['onway','active'].includes(b.status)) return true; // בעיצומן — תמיד הצג
              if (!b.bookingDate) return true;
              const d = new Date(b.bookingDate); d.setHours(0,0,0,0);
              return d >= todayStart; // הסר הזמנות שתאריכן עבר
            });
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

              {/* 3. הזמנות נכנסות */}
              <View style={{ alignItems: 'center', marginBottom: 12, gap: 6 }}>
                <T style={[s.sectionTitle, { textAlign: 'center' }]}>📥 {t.incomingBookings}</T>
                {incomingBks.filter(b => b.status === 'active' || b.status === 'onway').length > 0 && (
                  <View style={s.activeBadge}>
                    <T style={s.activeBadgeText}>🔄 {incomingBks.filter(b => b.status === 'active' || b.status === 'onway').length} פעיל</T>
                  </View>
                )}
              </View>
              {incomingBks.length === 0 ? (
                <View style={s.emptyBox}>
                  <T style={{ fontSize: 36, marginBottom: 8 }}>📭</T>
                  <T style={s.emptyText}>{t.noBookingsText}</T>
                </View>
              ) : (
                incomingBks.map(b => renderBookingCard(b, true))
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
            const historyBookings = bookings.filter(b => !['pending','confirmed','onway','active'].includes(b.status));
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
                    <T style={s.historyCompactArrow}>›</T>
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

          {/* ביטוח (לקוח) */}
          {!isCleaner && (
            <View style={s.section}>
              <View style={s.insuranceCard}>
                <T style={s.insuranceCardTitle}>{t.insuranceTitle}</T>
                <T style={s.insuranceCardSub}>{t.insuranceSub}</T>
                <TouchableOpacity style={s.insuranceBtnLarge} onPress={() => { setInsuranceOpen(true); setInsuranceSent(false); setInsuranceMsg(''); }}>
                  <T style={s.insuranceBtnLargeText}>{t.insuranceBtn}</T>
                </TouchableOpacity>
              </View>
            </View>
          )}

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
              <T style={[s.sectionTitle, { textAlign: 'center' }]}>📍 הכתובות שלי</T>

              {savedAddrs.length === 0 ? (
                <View style={s.emptyBox}>
                  <T style={{ fontSize: 36, marginBottom: 6 }}>📍</T>
                  <T style={s.emptyText}>אין כתובות שמורות</T>
                  <T style={s.emptySubText}>הכתובות שתזמין אליהן ישמרו כאן אוטומטית</T>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {savedAddrs.map((a) => (
                    <View key={a.id} style={{
                      backgroundColor: a.isPrimary ? C.blueLight : C.white,
                      borderRadius: 14, padding: 14,
                      borderWidth: a.isPrimary ? 2 : 1,
                      borderColor: a.isPrimary ? C.blue : C.blueBorder,
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                    }}>
                      {/* כתובת + תווית ראשית */}
                      <View style={{ flex: 1, gap: 2 }}>
                        {a.isPrimary && (
                          <T style={{ fontSize: 10, fontWeight: '800', color: C.blue }}>⭐ ראשית — תמולא אוטומטית</T>
                        )}
                        <T style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>{a.address}</T>
                        <T style={{ fontSize: 10, color: C.textSub }}>
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
                            <T style={{ fontSize: 11, fontWeight: '700', color: C.blue }}>⭐ ראשית</T>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={{ backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                          onPress={() => Alert.alert(t.deleteAddressTitle, `${t.deleteAddressTitle} "${a.address}"?`, [
                            { text: t.cancel, style: 'cancel' },
                            { text: t.portfolioDeleteBtn, style: 'destructive', onPress: () => handleDeleteAddr(a.id) },
                          ])}
                        >
                          <T style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>✕ מחק</T>
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
                    placeholder="הוסף כתובת חדשה (כולל מספר בית)"
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
                    <T style={{ fontSize: 14, fontWeight: '800', color: C.white }}>+ הוסף כתובת</T>
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

          {/* ספר לחברים (לקוח) — תחתית הדף */}
          {!isCleaner && (
            <View style={s.section}>
              <T style={[s.sectionTitle, { textAlign: 'center' }]}>🎁 {t.referralTitle}</T>
              <View style={s.referralCard}>
                <T style={s.referralBonus}>{t.referralBonus}</T>
                <View style={s.referralCodeRow}>
                  <T style={s.referralCodeText}>{referralCode || '...'}</T>
                  <TouchableOpacity style={s.referralShareBtn} onPress={handleShareReferral}>
                    <T style={s.referralShareBtnText}>{t.referralShare}</T>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ספר לחברים (מנקה) — תחתית הדף */}
          {isCleaner && (
            <View style={s.section}>
              <T style={[s.sectionTitle, { textAlign: 'center' }]}>🎁 {t.referralTitle}</T>
              <View style={s.referralCard}>
                <T style={s.referralBonus}>{t.referralBonus}</T>
                <View style={s.referralCodeRow}>
                  <T style={s.referralCodeText}>{referralCode || '...'}</T>
                  <TouchableOpacity style={s.referralShareBtn} onPress={handleShareReferral}>
                    <T style={s.referralShareBtnText}>{t.referralShare}</T>
                  </TouchableOpacity>
                </View>
              </View>
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
                      <T style={{ color: C.white, fontWeight: '700' }}>הגדר עכשיו</T>
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
                      <T style={{ color: '#7C3AED', fontWeight: '700', fontSize: 14 }}>פתח Paybox →</T>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
                    <T style={{ fontSize: 32 }}>💜</T>
                    <T style={{ color: C.textSub, textAlign: 'center' }}>{t.paySheetPayboxNoLink}</T>
                    <TouchableOpacity onPress={() => { setPaySheetOpen(false); openEditProfile(); }}
                      style={{ backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                      <T style={{ color: C.white, fontWeight: '700' }}>הגדר עכשיו</T>
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
                      <T style={{ color: C.white, fontWeight: '700' }}>הגדר עכשיו</T>
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
          <SafeAreaView edges={['top']} style={{ backgroundColor: C.blue }}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => { setChatOpen(false); if (chatUnsubRef.current) chatUnsubRef.current(); }} style={s.backBtn}>
                <T style={{ color: C.white, fontSize: 18 }}>✕</T>
              </TouchableOpacity>
              <T style={s.headerTitle}>💬 {chatClientName}</T>
              <View style={{ width: 36 }} />
            </View>
          </SafeAreaView>
          <ScrollView ref={chatScrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
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
          <KeyboardAvoidingView behavior="padding">
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.white }}>
              <View style={[s.chatInputRow, { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8 }]}>
                <TouchableOpacity style={s.chatSendBtn} onPress={sendCleanerMessage}>
                  <T style={{ color: C.white, fontSize: 18 }}>▶</T>
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
                    <T style={s.insuranceBtnLargeText}>סגור</T>
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

              {/* עיר — מנקה בלבד */}
              {isCleaner && (
                <View>
                  <T style={ep.label}>{t.editCityLabel}</T>
                  <TextInput style={ep.input} value={editCity} onChangeText={setEditCity} placeholder="תל אביב, חיפה..." placeholderTextColor={C.textSub} textAlign="right" />
                </View>
              )}

              {/* כתובת מלאה — לקוח בלבד */}
              {!isCleaner && (
                <View style={{ gap: 10 }}>
                  <T style={ep.label}>📍 כתובת מגורים</T>

                  {/* עיר */}
                  <View>
                    <T style={[ep.label, { fontSize: 12, color: C.textSub }]}>עיר *</T>
                    <TextInput
                      style={ep.input}
                      value={editCity}
                      onChangeText={setEditCity}
                      placeholder="תל אביב, חיפה, ירושלים..."
                      placeholderTextColor={C.textSub}
                      textAlign="right"
                    />
                  </View>

                  {/* רחוב + מספר בית */}
                  <View>
                    <T style={[ep.label, { fontSize: 12, color: C.textSub }]}>רחוב + מספר בית *</T>
                    <TextInput
                      style={ep.input}
                      value={editStreet}
                      onChangeText={setEditStreet}
                      placeholder="לדוג׳: הרצל 15"
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
                      <T style={{ fontWeight: '700', color: !editAddrPrivate ? C.white : C.textDark, fontSize: 14 }}>דירה</T>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: editAddrPrivate ? C.blue : C.bluePale, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: editAddrPrivate ? C.blue : C.blueBorder }}
                      onPress={() => setEditAddrPrivate(true)}
                    >
                      <T style={{ fontSize: 16 }}>{editAddrPrivate ? '🔵' : '⚪'}</T>
                      <T style={{ fontWeight: '700', color: editAddrPrivate ? C.white : C.textDark, fontSize: 14 }}>בית פרטי</T>
                    </TouchableOpacity>
                  </View>

                  {/* קומה + דירה */}
                  {!editAddrPrivate && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <T style={[ep.label, { fontSize: 12, color: C.textSub }]}>קומה *</T>
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
                        <T style={[ep.label, { fontSize: 12, color: C.textSub }]}>מספר דירה *</T>
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
                      <T style={{ fontSize: 11, color: C.textSub, marginBottom: 2 }}>כתובת מלאה:</T>
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

              {/* כתובת מגורים */}
              <View>
                <T style={ep.label}>{t.cleanerAddressLabel}</T>
                <TextInput style={ep.input} value={editCleanerAddress} onChangeText={setEditCleanerAddress} placeholder={t.cleanerAddressPlaceholder} placeholderTextColor={C.textSub} textAlign="right" />
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
                    { key: 'ניקוי כללי',           icon: '🏠' },
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

              {/* אזורי עבודה */}
              <View>
                <T style={ep.label}>{t.editWorkAreasLabel}</T>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {[{ key: 'north', label: t.regionNorth }, { key: 'center', label: t.regionCenter }, { key: 'south', label: t.regionSouth }].map(a => (
                    <TouchableOpacity key={a.key} style={[ep.pill, editWorkAreas.includes(a.key) && ep.pillActive, { flex: 1, alignItems: 'center' }]} onPress={() => toggleEdit(editWorkAreas, setEditWorkAreas, a.key)}>
                      <T style={[ep.pillText, editWorkAreas.includes(a.key) && ep.pillTextActive]}>{a.label}</T>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* קבוצת וואצאפ */}
              <View style={{ backgroundColor: '#F0FFF4', borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: '#A7F3D0' }}>
                <T style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>💬 קבוצת וואצאפ לניקוי דחוף</T>
                <T style={{ fontSize: 12, color: '#047857', lineHeight: 18 }}>
                  {'הזן את ה-Group ID של הקבוצה שנפתחה עם מנהל האפליקציה.\nהפורמט: XXXXXXXXXX@g.us\n(ניתן לקבל מ-UltraMsg Dashboard → Contacts)'}
                </T>
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
                  <T style={{ fontSize: 11, color: '#10B981' }}>✅ בקשות דחופות ישלחו לקבוצה זו</T>
                ) : (
                  <T style={{ fontSize: 11, color: '#F59E0B' }}>⚠️ ללא Group ID — הבקשות ישלחו למספר הטלפון שלך</T>
                )}
              </View>

              {/* ── פרטי תשלום ── */}
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#BFDBFE', gap: 14 }}>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <T style={{ fontSize: 16, fontWeight: '900', color: '#1E3A8A' }}>{t.payDetailsTitle}</T>
                  <T style={{ fontSize: 12, color: '#3B82F6', textAlign: 'center' }}>{t.payDetailsSub}</T>
                </View>

                {/* Bit */}
                <View style={{ backgroundColor: '#DBEAFE', borderRadius: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: '#93C5FD' }}>
                  <T style={{ fontSize: 13, fontWeight: '800', color: '#1D4ED8' }}>💙 Bit</T>
                  <TextInput
                    style={[ep.input, { backgroundColor: C.white }]}
                    value={editBitPhone}
                    onChangeText={setEditBitPhone}
                    placeholder={t.payBitPhonePlaceholder}
                    placeholderTextColor={C.textSub}
                    keyboardType="phone-pad"
                    textAlign="right"
                  />
                  <T style={{ fontSize: 11, color: '#3B82F6' }}>{t.payBitPhoneLabel}</T>
                </View>

                {/* Paybox */}
                <View style={{ backgroundColor: '#F3E8FF', borderRadius: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: '#C084FC' }}>
                  <T style={{ fontSize: 13, fontWeight: '800', color: '#7C3AED' }}>💜 Paybox</T>
                  <TextInput
                    style={[ep.input, { backgroundColor: C.white, textAlign: 'left' }]}
                    value={editPayboxLink}
                    onChangeText={setEditPayboxLink}
                    placeholder={t.payPayboxLinkPlaceholder}
                    placeholderTextColor={C.textSub}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <T style={{ fontSize: 11, color: '#9333EA' }}>{t.payPayboxLinkLabel}</T>
                </View>

                {/* העברה בנקאית */}
                <View style={{ backgroundColor: '#F0F9FF', borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: '#7DD3FC' }}>
                  <T style={{ fontSize: 13, fontWeight: '800', color: '#0369A1' }}>🏦 {t.paySheetBankTab}</T>
                  {[
                    { label: t.payBankNameLabel,    val: editBankName,    set: setEditBankName,    kbType: 'default' as const },
                    { label: t.payBankNumLabel,      val: editBankNum,     set: setEditBankNum,     kbType: 'number-pad' as const },
                    { label: t.payBankBranchLabel,   val: editBankBranch,  set: setEditBankBranch,  kbType: 'number-pad' as const },
                    { label: t.payBankAccountLabel,  val: editBankAccount, set: setEditBankAccount, kbType: 'number-pad' as const },
                  ].map(row => (
                    <View key={row.label}>
                      <T style={{ fontSize: 11, color: '#0369A1', marginBottom: 4 }}>{row.label}</T>
                      <TextInput
                        style={[ep.input, { backgroundColor: C.white }]}
                        value={row.val}
                        onChangeText={row.set}
                        placeholder={row.label}
                        placeholderTextColor={C.textSub}
                        keyboardType={row.kbType}
                        textAlign="right"
                      />
                    </View>
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


import React, { useState, useRef, useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets , SafeAreaView as SafeAreaViewCtx } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, Modal, SafeAreaView, StatusBar,
  Alert, Dimensions, Animated, Platform, Linking, Switch,
  KeyboardAvoidingView, ActivityIndicator, BackHandler, Keyboard,
} from 'react-native';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import MapView, { Marker, Callout, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { collection, addDoc, getDocs, query, where, doc, getDoc, setDoc, onSnapshot, orderBy, updateDoc, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { setActiveChat } from '../lib/chatPresence';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage, HC, T, useAppColors, AppColors } from '../lib/LanguageContext';
import ServiceInfoBtn from '../lib/ServiceInfoBtn';
import { Lang } from '../lib/translations';
import AccessibilityModal from '../lib/AccessibilityModal';
import { MaterialIcons } from '@expo/vector-icons';
import { TAB_BAR_CONTENT_HEIGHT } from '../lib/BottomTabBar';
// expo-audio — הקלטה והשמעה של הודעות קוליות (SDK 54, מחליף את expo-av)
import { useAudioRecorder, createAudioPlayer, RecordingPresets, setAudioModeAsync, AudioModule } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';


const W = Dimensions.get('window').width;
const H = Dimensions.get('window').height;
const NAV_BAR_HEIGHT = Platform.OS === 'android'
  ? Math.max(0, Dimensions.get('screen').height - Dimensions.get('window').height - (StatusBar.currentHeight || 0))
  : 0;

// Default palette (used as fallback in module-level contexts)
const C_DEFAULT = {
  blue:       '#185FA5',
  blueDark:   '#0D4F96',
  blueLight:  '#E6F1FB',
  bluePale:   '#E8F2FC',
  blueBorder: '#B5D4F4',
  textDark:   '#042C53',
  textMid:    '#378ADD',
  textSub:    '#6B9DC2',
  gold:       '#F59E0B',
  green:      '#10B981',
  greenBg:    '#D1FAE5',
  white:      '#FFFFFF',
  grayBg:     '#F1F5F9',
  grayBorder: '#E2EAF3',
};

const REGION_DEFAULTS: Record<string, { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }> = {
  all:    { latitude: 31.8,  longitude: 34.9,  latitudeDelta: 4.0, longitudeDelta: 4.0 },
  north:  { latitude: 32.8,  longitude: 35.2,  latitudeDelta: 0.9, longitudeDelta: 0.9 },
  center: { latitude: 32.0,  longitude: 34.85, latitudeDelta: 0.7, longitudeDelta: 0.7 },
  south:  { latitude: 31.0,  longitude: 34.8,  latitudeDelta: 1.5, longitudeDelta: 1.5 },
};

const RL = [
  { name: 'דנה ל.',  stars: 5, text: 'עבודה מצוינת! ממליצה בחום.' },
  { name: 'יוסי מ.', stars: 5, text: 'מקצועי מאוד, תמיד בזמן.' },
  { name: 'רחל כ.',  stars: 4, text: 'ממליצה, עבודה יסודית.' },
];

const CLEANERS = [
  { id:'1',  name:'מירה כהן',    initials:'מכ', city:'חיפה',         region:'north',  workAreas:['north'],  types:['ניקוי לפסח','חלונות'],      price:80,  rating:4.9, reviews:142, available:true,  payment:['cash','bit','paybox'], lat:32.794, lng:34.989, bio:'מנקה מקצועית.', reviewsList:RL },
  { id:'2',  name:'כרמל אבו',    initials:'כא', city:'חיפה',         region:'north',  workAreas:['north'],  types:['שטיפת רכב','חלונות'],       price:65,  rating:4.6, reviews:87,  available:false, payment:['cash','bit'],        lat:32.800, lng:34.995, bio:'מומחה לשטיפת רכב.', reviewsList:RL },
  { id:'3',  name:'נועה לוי',    initials:'נל', city:'חיפה',         region:'north',  workAreas:['north'],  types:['חלונות','לאחר שיפוץ'],      price:70,  rating:4.7, reviews:63,  available:true,  payment:['cash'],               lat:32.788, lng:34.980, bio:'מנקה אמינה ויסודית.', reviewsList:RL },
  { id:'4',  name:'סאמי חסן',    initials:'סח', city:'נצרת',         region:'north',  workAreas:['north'],  types:['חלונות','שטיפת רכב'],       price:60,  rating:4.5, reviews:44,  available:true,  payment:['cash','bit'],         lat:32.699, lng:35.303, bio:'מומחה לניקוי חלונות.', reviewsList:RL },
  { id:'5',  name:'רינה ברק',    initials:'רב', city:'נצרת',         region:'north',  workAreas:['north'],  types:['ניקוי לפסח','חלונות'],      price:75,  rating:4.8, reviews:91,  available:true,  payment:['paybox','cash'],        lat:32.705, lng:35.298, bio:'מנקה מקצועית.', reviewsList:RL },
  { id:'6',  name:'אמיר שלום',   initials:'אש', city:'עכו',          region:'north',  workAreas:['north'],  types:['שטיפת רכב','ניקוי לפסח'],  price:65,  rating:4.6, reviews:55,  available:true,  payment:['cash'],               lat:32.928, lng:35.082, bio:'מנקה סדיר ואמין.', reviewsList:RL },
  { id:'7',  name:'חאלד נאסר',   initials:'חנ', city:'טבריה',        region:'north',  workAreas:['north'],  types:['ניקוי לפסח','לאחר שיפוץ'], price:85,  rating:4.8, reviews:72,  available:true,  payment:['cash','bit'],         lat:32.795, lng:35.531, bio:'מומחה לניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'8',  name:'יואב גל',     initials:'יג', city:'חריש',         region:'north',  workAreas:['north','center'],  types:['ניקוי לפסח','שטיפת רכב'],  price:70,  rating:4.6, reviews:41,  available:true,  payment:['bit','cash'],         lat:32.458, lng:35.041, bio:'מנקה חריש ואזור השרון.', reviewsList:RL },
  { id:'9',  name:'שלי אדם',     initials:'שא', city:'חריש',         region:'north',  workAreas:['north','center'],  types:['חלונות','ניקיון משרדים'],   price:65,  rating:4.5, reviews:33,  available:true,  payment:['cash'],                lat:32.453, lng:35.036, bio:'ניקיון משרדים ובתים.', reviewsList:RL },
  { id:'10', name:'דנה שמיר',    initials:'דש', city:'חריש',         region:'north',  workAreas:['north','center'],  types:['לאחר שיפוץ','ניקוי לפסח'], price:90,  rating:4.9, reviews:28,  available:true,  payment:['paybox','cash'],        lat:32.462, lng:35.044, bio:'מתמחה בניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'11', name:'רחל גולדברג', initials:'רג', city:'תל אביב',      region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:95,  rating:4.9, reviews:211, available:true,  payment:['paybox','bit','cash'],  lat:32.087, lng:34.789, bio:'מנקה בכירה.', reviewsList:RL },
  { id:'12', name:'דוד אזולאי',  initials:'דא', city:'תל אביב',      region:'center', workAreas:['center'], types:['חלונות','ניקיון משרדים'],   price:85,  rating:4.7, reviews:166, available:true,  payment:['paybox','cash'],        lat:32.075, lng:34.775, bio:'מקצועי ומהיר.', reviewsList:RL },
  { id:'13', name:'ליאת שמש',    initials:'לש', city:'תל אביב',      region:'center', workAreas:['center'], types:['שטיפת רכב','ניקוי לפסח'],  price:75,  rating:4.6, reviews:88,  available:true,  payment:['bit','cash'],         lat:32.095, lng:34.800, bio:'אמינה ויסודית.', reviewsList:RL },
  { id:'14', name:'נועם לוי',    initials:'נל', city:'תל אביב',      region:'center', workAreas:['center'], types:['לאחר שיפוץ','ניקוי לפסח'], price:100, rating:4.9, reviews:97,  available:false, payment:['paybox','bit','cash'],  lat:32.080, lng:34.770, bio:'פרפקציוניסט מוחלט.', reviewsList:RL },
  { id:'15', name:'אנה פטרוב',   initials:'אפ', city:'ירושלים',      region:'center', workAreas:['center'], types:['חלונות','ניקוי לפסח'],      price:70,  rating:4.6, reviews:55,  available:true,  payment:['cash','bit'],         lat:31.782, lng:35.218, bio:'אמינה ותמיד בזמן.', reviewsList:RL },
  { id:'16', name:'יוסי מזרחי',  initials:'ימ', city:'ירושלים',      region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:75,  rating:4.7, reviews:82,  available:true,  payment:['cash'],                lat:31.790, lng:35.225, bio:'מנקה ירושלים ואזוריה.', reviewsList:RL },
  { id:'17', name:'לימור שפירא', initials:'לש', city:'נתניה',        region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:80,  rating:4.8, reviews:103, available:true,  payment:['bit','cash'],         lat:32.329, lng:34.857, bio:'מתמחה בניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'18', name:'מוחמד עבאס',  initials:'מע', city:'ראשון לציון',  region:'center', workAreas:['center','south'], types:['לאחר שיפוץ','חלונות'],      price:110, rating:5.0, reviews:87,  available:true,  payment:['paybox','bit','cash'],  lat:31.971, lng:34.789, bio:'פרפקציוניסט מוחלט.', reviewsList:RL },
  { id:'19', name:'שרית לוי',    initials:'של', city:'פתח תקוה',     region:'center', workAreas:['center'], types:['חלונות','ניקיון משרדים'],   price:65,  rating:4.5, reviews:44,  available:true,  payment:['cash'],                lat:32.089, lng:34.888, bio:'ניקיון משרדים ובתים.', reviewsList:RL },
  { id:'20', name:'דנה כץ',      initials:'דכ', city:'כפר סבא',      region:'center', workAreas:['center'], types:['שטיפת רכב','ניקוי לפסח'],  price:70,  rating:4.6, reviews:57,  available:true,  payment:['cash','bit'],         lat:32.175, lng:34.907, bio:'מנקה אמינה ומהירה.', reviewsList:RL },
  { id:'21', name:'מיה גולן',    initials:'מג', city:'הרצליה',       region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:90,  rating:4.8, reviews:79,  available:true,  payment:['paybox','bit','cash'],  lat:32.165, lng:34.843, bio:'מנקה הרצליה ואזוריה.', reviewsList:RL },
  { id:'22', name:"ג'ורג' נסר",  initials:'גנ', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['ניקוי לפסח','חלונות'],      price:65,  rating:4.7, reviews:83,  available:true,  payment:['cash','bit'],         lat:31.252, lng:34.791, bio:'מנקה מקצועי בדרום הארץ.', reviewsList:RL },
  { id:'23', name:'אורי מזרחי',  initials:'אמ', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['שטיפת רכב','חלונות'],       price:60,  rating:4.5, reviews:47,  available:true,  payment:['cash'],                lat:31.245, lng:34.800, bio:'מומחה לשטיפת רכב.', reviewsList:RL },
  { id:'24', name:'נעמי כהן',    initials:'נכ', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['לאחר שיפוץ','ניקוי לפסח'], price:80,  rating:4.8, reviews:61,  available:true,  payment:['paybox','cash'],        lat:31.255, lng:34.780, bio:'מתמחה בניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'25', name:'יעל שמש',     initials:'יש', city:'אשדוד',        region:'south',  workAreas:['south'],  types:['שטיפת רכב','ניקוי לפסח'],  price:70,  rating:4.8, reviews:129, available:false, payment:['paybox','bit','cash'],  lat:31.804, lng:34.655, bio:'מנקה מנוסה ואמינה.', reviewsList:RL },
  { id:'26', name:'רמי עמר',     initials:'רע', city:'אשדוד',        region:'south',  workAreas:['south'],  types:['לאחר שיפוץ','חלונות'],      price:90,  rating:4.9, reviews:96,  available:true,  payment:['paybox','cash'],        lat:31.810, lng:34.648, bio:'מתמחה בניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'27', name:'עמי נחום',    initials:'ענ', city:'אשקלון',       region:'south',  workAreas:['south'],  types:['ניקוי לפסח','חלונות'],      price:70,  rating:4.7, reviews:58,  available:true,  payment:['cash','bit'],         lat:31.668, lng:34.571, bio:'מנקה אשקלון ואזוריה.', reviewsList:RL },
  { id:'28', name:'פאטמה סאלח',  initials:'פס', city:'אילת',         region:'south',  workAreas:['south'],  types:['ניקוי לפסח','שטיפת רכב'],  price:85,  rating:5.0, reviews:64,  available:true,  payment:['cash','bit'],         lat:29.558, lng:34.952, bio:'הטובה ביותר באילת!', reviewsList:RL },
  { id:'29', name:'משה גבאי',    initials:'מג', city:'אילת',         region:'south',  workAreas:['south'],  types:['שטיפת רכב','חלונות'],       price:75,  rating:4.7, reviews:41,  available:true,  payment:['paybox','cash'],        lat:29.552, lng:34.948, bio:'מומחה לשטיפת רכב.', reviewsList:RL },
  // ── קריות (צפון) ──
  { id:'30', name:'תמר כץ',      initials:'תכ', city:'קריית אתא',    region:'north',  workAreas:['north'],  types:['ניקוי לפסח','חלונות'],      price:72,  rating:4.8, reviews:93,  available:true,  payment:['cash','bit'],         lat:32.804, lng:35.107, bio:'מנקה מקצועית בקריות.', reviewsList:RL },
  { id:'31', name:'אריאל דוד',   initials:'אד', city:'קריית ביאליק', region:'north',  workAreas:['north'],  types:['שטיפת רכב','ניקיון משרדים'],price:68,  rating:4.6, reviews:51,  available:true,  payment:['cash'],               lat:32.831, lng:35.090, bio:'שטיפת רכב מקצועית.', reviewsList:RL },
  { id:'32', name:'מיכל רוזן',   initials:'מר', city:'קריית מוצקין', region:'north',  workAreas:['north'],  types:['ניקיון אחרי אירוע','חלונות'],price:90, rating:4.9, reviews:77,  available:false, payment:['paybox','bit','cash'],  lat:32.836, lng:35.075, bio:'מומחית לניקיון אחרי אירועים.', reviewsList:RL },
  { id:'33', name:'יגאל שמעון',  initials:'יש', city:'קריית ים',     region:'north',  workAreas:['north'],  types:['לאחר שיפוץ','ניקוי לפסח'], price:80,  rating:4.7, reviews:44,  available:true,  payment:['cash','bit'],         lat:32.851, lng:35.068, bio:'מתמחה בשיפוצים וניקוי לפסח.', reviewsList:RL },
  // ── נהריה / כרמיאל (צפון) ──
  { id:'34', name:'לילה חדד',    initials:'לח', city:'נהריה',        region:'north',  workAreas:['north'],  types:['חלונות','ניקוי לפסח'],      price:65,  rating:4.6, reviews:38,  available:true,  payment:['cash'],               lat:33.005, lng:35.098, bio:'מנקה נהריה והסביבה.', reviewsList:RL },
  { id:'35', name:'רון אביב',    initials:'רא', city:'כרמיאל',       region:'north',  workAreas:['north'],  types:['שטיפת רכב','חלונות'],       price:60,  rating:4.5, reviews:29,  available:true,  payment:['cash','bit'],         lat:32.916, lng:35.298, bio:'מנקה כרמיאל.', reviewsList:RL },
  { id:'36', name:'סוזן נסאר',   initials:'סנ', city:'עפולה',        region:'north',  workAreas:['north'],  types:['ניקוי לפסח','ניקיון משרדים'],price:70, rating:4.7, reviews:56,  available:true,  payment:['cash','bit'],         lat:32.608, lng:35.289, bio:'מנקה מקצועית בעמק.', reviewsList:RL },
  { id:'37', name:'בנימין לוי',  initials:'בל', city:'צפת',          region:'north',  workAreas:['north'],  types:['לאחר שיפוץ','חלונות'],      price:75,  rating:4.8, reviews:33,  available:false, payment:['cash'],               lat:32.965, lng:35.497, bio:'מנקה צפת והסביבה.', reviewsList:RL },
  { id:'38', name:'חנה אורלוב',  initials:'חא', city:'בית שאן',      region:'north',  workAreas:['north'],  types:['ניקוי לפסח','שטיפת רכב'],  price:60,  rating:4.5, reviews:22,  available:true,  payment:['cash'],               lat:32.499, lng:35.499, bio:'מנקה אמינה ויסודית.', reviewsList:RL },
  { id:'39', name:'קרים חסן',    initials:'קח', city:'יוקנעם',       region:'north',  workAreas:['north'],  types:['ניקיון אחרי אירוע','חלונות'],price:85, rating:4.8, reviews:47,  available:true,  payment:['cash','bit'],         lat:32.658, lng:35.098, bio:'מומחה לניקיון אחרי אירועים.', reviewsList:RL },
  // ── רמת גן / גבעתיים (מרכז) ──
  { id:'40', name:'שירה כהן',    initials:'שכ', city:'רמת גן',       region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:88,  rating:4.9, reviews:134, available:true,  payment:['paybox','bit','cash'],  lat:32.082, lng:34.813, bio:'מנקה רמת גן ואזוריה.', reviewsList:RL },
  { id:'41', name:'אלון גרין',   initials:'אג', city:'רמת גן',       region:'center', workAreas:['center'], types:['שטיפת רכב','ניקיון משרדים'],price:80,  rating:4.7, reviews:61,  available:false, payment:['paybox','cash'],        lat:32.078, lng:34.820, bio:'מקצועי ומהיר.', reviewsList:RL },
  { id:'42', name:'נטע שפר',     initials:'נש', city:'גבעתיים',      region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','ניקוי לפסח'],price:95, rating:4.9, reviews:88, available:true, payment:['paybox','bit','cash'],  lat:32.071, lng:34.813, bio:'מנקה גבעתיים ורמת גן.', reviewsList:RL },
  // ── חולון / בת ים (מרכז) ──
  { id:'43', name:'אוסמה עבאס',  initials:'אע', city:'חולון',        region:'center', workAreas:['center'], types:['לאחר שיפוץ','ניקוי לפסח'], price:82,  rating:4.7, reviews:72,  available:true,  payment:['cash','bit'],         lat:32.011, lng:34.779, bio:'מנקה חולון ובת ים.', reviewsList:RL },
  { id:'44', name:'רינת אזולאי', initials:'רא', city:'בת ים',        region:'center', workAreas:['center'], types:['חלונות','ניקיון אחרי אירוע'],price:78,  rating:4.6, reviews:55,  available:true,  payment:['cash'],               lat:32.023, lng:34.752, bio:'מנקה בת ים וחולון.', reviewsList:RL },
  { id:'45', name:'יצחק פרץ',    initials:'יפ', city:'חולון',        region:'center', workAreas:['center'], types:['שטיפת רכב','חלונות'],       price:70,  rating:4.5, reviews:39,  available:false, payment:['cash','bit'],         lat:32.018, lng:34.772, bio:'שטיפת רכב מקצועית.', reviewsList:RL },
  // ── רחובות / נס ציונה (מרכז) ──
  { id:'46', name:'מרינה פדיה',  initials:'מפ', city:'רחובות',       region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:85,  rating:4.8, reviews:96,  available:true,  payment:['paybox','bit','cash'],  lat:31.895, lng:34.811, bio:'מנקה מקצועית ברחובות.', reviewsList:RL },
  { id:'47', name:'שמואל כהן',   initials:'שכ', city:'נס ציונה',     region:'center', workAreas:['center'], types:['שטיפת רכב','ניקיון משרדים'],price:72,  rating:4.6, reviews:44,  available:true,  payment:['cash'],               lat:31.929, lng:34.798, bio:'מנקה נס ציונה.', reviewsList:RL },
  { id:'48', name:'לאה גרוס',    initials:'לג', city:'רחובות',       region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','חלונות'],price:92,  rating:4.9, reviews:67,  available:true,  payment:['paybox','cash'],        lat:31.890, lng:34.817, bio:'מומחית לאירועים.', reviewsList:RL },
  // ── מודיעין (מרכז) ──
  { id:'49', name:'תומר שני',    initials:'תש', city:'מודיעין',      region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:90,  rating:4.8, reviews:81,  available:true,  payment:['paybox','bit','cash'],  lat:31.893, lng:35.010, bio:'מנקה מודיעין.', reviewsList:RL },
  { id:'50', name:'כלנית מור',   initials:'כמ', city:'מודיעין',      region:'center', workAreas:['center'], types:['לאחר שיפוץ','שטיפת רכב'],  price:85,  rating:4.7, reviews:53,  available:false, payment:['cash','bit'],         lat:31.898, lng:35.004, bio:'מתמחה בשיפוצים.', reviewsList:RL },
  // ── רמלה / לוד (מרכז) ──
  { id:'51', name:'חאלד יוסף',   initials:'חי', city:'רמלה',         region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:70, rating:4.6, reviews:48, available:true, payment:['cash'],              lat:31.929, lng:34.873, bio:'מנקה רמלה ולוד.', reviewsList:RL },
  { id:'52', name:'שושנה מזרחי', initials:'שמ', city:'לוד',          region:'center', workAreas:['center'], types:['חלונות','ניקוי לפסח'],      price:65,  rating:4.5, reviews:37,  available:true,  payment:['cash','bit'],         lat:31.951, lng:34.898, bio:'מנקה לוד ואזוריה.', reviewsList:RL },
  // ── רעננה / הוד השרון (מרכז) ──
  { id:'53', name:'אורית שמיר',  initials:'אש', city:'רעננה',        region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:95,  rating:4.9, reviews:118, available:true,  payment:['paybox','bit','cash'],  lat:32.184, lng:34.870, bio:'מנקה רעננה והסביבה.', reviewsList:RL },
  { id:'54', name:'גיל אלון',    initials:'גא', city:'הוד השרון',    region:'center', workAreas:['center'], types:['שטיפת רכב','ניקיון משרדים'],price:80,  rating:4.7, reviews:62,  available:true,  payment:['paybox','cash'],        lat:32.151, lng:34.888, bio:'מקצועי ומהיר.', reviewsList:RL },
  { id:'55', name:'מיכל עמית',   initials:'מע', city:'הוד השרון',    region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','ניקוי לפסח'],price:100, rating:4.9, reviews:74, available:false, payment:['paybox','bit','cash'],  lat:32.148, lng:34.892, bio:'מומחית לאירועים ופסח.', reviewsList:RL },
  // ── בני ברק (מרכז) ──
  { id:'56', name:'אסתר פרידמן', initials:'אפ', city:'בני ברק',      region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:82,  rating:4.8, reviews:107, available:true,  payment:['cash'],               lat:32.084, lng:34.833, bio:'מנקה בני ברק.', reviewsList:RL },
  { id:'57', name:'משה שטרן',    initials:'מש', city:'בני ברק',      region:'center', workAreas:['center'], types:['לאחר שיפוץ','מחסן ועליית גג'],price:75, rating:4.6, reviews:43, available:true, payment:['cash'],              lat:32.082, lng:34.837, bio:'מתמחה בשיפוצים ומחסנים.', reviewsList:RL },
  // ── פתח תקוה (מרכז) ──
  { id:'58', name:'דינה לוי',    initials:'דל', city:'פתח תקוה',     region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:87, rating:4.8, reviews:91, available:true, payment:['paybox','bit','cash'],  lat:32.094, lng:34.888, bio:'מנקה פתח תקוה.', reviewsList:RL },
  { id:'59', name:'עמנואל דסה',  initials:'עד', city:'פתח תקוה',     region:'center', workAreas:['center'], types:['שטיפת רכב','חלונות'],       price:70,  rating:4.5, reviews:35,  available:false, payment:['cash','bit'],         lat:32.089, lng:34.882, bio:'שטיפת רכב מהירה.', reviewsList:RL },
  // ── קריית אונו / אור יהודה (מרכז) ──
  { id:'60', name:'יעל ברק',     initials:'יב', city:'קריית אונו',   region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:88,  rating:4.8, reviews:66,  available:true,  payment:['paybox','cash'],        lat:32.058, lng:34.856, bio:'מנקה קריית אונו.', reviewsList:RL },
  { id:'61', name:'זיו שלום',    initials:'זש', city:'אור יהודה',    region:'center', workAreas:['center'], types:['ניקיון משרדים','לאחר שיפוץ'],price:78,  rating:4.7, reviews:49,  available:true,  payment:['cash','bit'],         lat:32.028, lng:34.857, bio:'מנקה אור יהודה.', reviewsList:RL },
  // ── ירושלים נוספים ──
  { id:'62', name:'רחל אברהם',   initials:'רא', city:'ירושלים',      region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:85, rating:4.9, reviews:122, available:true, payment:['cash','bit'],         lat:31.775, lng:35.230, bio:'מנקה ירושלים.', reviewsList:RL },
  { id:'63', name:'ג\'ראח נסר',  initials:'גנ', city:'ירושלים',      region:'center', workAreas:['center'], types:['שטיפת רכב','חלונות'],       price:72,  rating:4.6, reviews:58,  available:true,  payment:['cash'],               lat:31.787, lng:35.220, bio:'שטיפת רכב מקצועית.', reviewsList:RL },
  { id:'64', name:'שרה גולד',    initials:'שג', city:'ירושלים',      region:'center', workAreas:['center'], types:['מחסן ועליית גג','לאחר שיפוץ'],price:80, rating:4.7, reviews:41,  available:false, payment:['cash','bit'],         lat:31.793, lng:35.213, bio:'מתמחה במחסנים ושיפוצים.', reviewsList:RL },
  // ── נתניה נוספים ──
  { id:'65', name:'איריס לוי',   initials:'אל', city:'נתניה',        region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:82, rating:4.8, reviews:77, available:true, payment:['paybox','bit','cash'],  lat:32.321, lng:34.854, bio:'מנקה נתניה.', reviewsList:RL },
  { id:'66', name:'בוריס קוגן',  initials:'בק', city:'נתניה',        region:'center', workAreas:['center'], types:['שטיפת רכב','חלונות'],       price:68,  rating:4.5, reviews:34,  available:true,  payment:['cash'],               lat:32.335, lng:34.861, bio:'שטיפת רכב נתניה.', reviewsList:RL },
  // ── אשדוד נוספים ──
  { id:'67', name:'לימור אוחיון',initials:'לא', city:'אשדוד',        region:'south',  workAreas:['south'],  types:['ניקוי לפסח','חלונות'],      price:74,  rating:4.8, reviews:88,  available:true,  payment:['cash','bit'],         lat:31.800, lng:34.650, bio:'מנקה אשדוד.', reviewsList:RL },
  { id:'68', name:'מנשה חדד',    initials:'מח', city:'אשדוד',        region:'south',  workAreas:['south'],  types:['ניקיון אחרי אירוע','לאחר שיפוץ'],price:90, rating:4.7, reviews:52, available:false, payment:['paybox','cash'],       lat:31.807, lng:34.643, bio:'מתמחה באירועים ושיפוצים.', reviewsList:RL },
  // ── נתיבות / שדרות (דרום) ──
  { id:'69', name:'חיה אסולין',  initials:'חא', city:'נתיבות',       region:'south',  workAreas:['south'],  types:['ניקוי לפסח','חלונות'],      price:60,  rating:4.6, reviews:31,  available:true,  payment:['cash'],               lat:31.421, lng:34.589, bio:'מנקה נתיבות.', reviewsList:RL },
  { id:'70', name:'אריק בוסו',   initials:'אב', city:'שדרות',        region:'south',  workAreas:['south'],  types:['שטיפת רכב','ניקוי לפסח'],  price:65,  rating:4.5, reviews:28,  available:true,  payment:['cash','bit'],         lat:31.524, lng:34.596, bio:'מנקה שדרות.', reviewsList:RL },
  // ── קריית גת / קריית מלאכי (דרום) ──
  { id:'71', name:'שני ממן',     initials:'שמ', city:'קריית גת',     region:'south',  workAreas:['south'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:72, rating:4.7, reviews:45, available:true, payment:['cash','bit'],         lat:31.608, lng:34.770, bio:'מנקה קריית גת.', reviewsList:RL },
  { id:'72', name:'אורן פלד',    initials:'אפ', city:'קריית מלאכי',  region:'south',  workAreas:['south'],  types:['לאחר שיפוץ','חלונות'],      price:65,  rating:4.5, reviews:23,  available:true,  payment:['cash'],               lat:31.732, lng:34.743, bio:'מנקה קריית מלאכי.', reviewsList:RL },
  // ── דימונה (דרום) ──
  { id:'73', name:'שלמה גפני',   initials:'שג', city:'דימונה',       region:'south',  workAreas:['south'],  types:['ניקוי לפסח','שטיפת רכב'],  price:58,  rating:4.5, reviews:27,  available:true,  payment:['cash'],               lat:31.069, lng:35.033, bio:'מנקה דימונה והנגב.', reviewsList:RL },
  // ── באר שבע נוספים ──
  { id:'74', name:'ורד אזולאי',  initials:'וא', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:75, rating:4.8, reviews:67, available:true, payment:['paybox','bit','cash'],  lat:31.248, lng:34.795, bio:'מנקה ב״ש.', reviewsList:RL },
  { id:'75', name:'גדי שמש',     initials:'גש', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['מחסן ועליית גג','לאחר שיפוץ'],price:70, rating:4.6, reviews:38, available:false, payment:['cash'],              lat:31.260, lng:34.788, bio:'מתמחה במחסנים ושיפוצים.', reviewsList:RL },
  // ── תל אביב נוספים ──
  { id:'76', name:'יונתן לוי',   initials:'יל', city:'תל אביב',      region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון משרדים'],price:105, rating:5.0, reviews:189, available:true, payment:['paybox','bit','cash'],  lat:32.068, lng:34.780, bio:'מנקה בכיר ת״א.', reviewsList:RL },
  { id:'77', name:'דנית שרון',   initials:'דש', city:'תל אביב',      region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','חלונות'],price:98,  rating:4.9, reviews:143, available:true,  payment:['paybox','bit','cash'],  lat:32.077, lng:34.767, bio:'מומחית אירועים ת״א.', reviewsList:RL },
  { id:'78', name:'עמיר בן דוד', initials:'עב', city:'תל אביב',      region:'center', workAreas:['center'], types:['שטיפת רכב','מחסן ועליית גג'],price:88, rating:4.7, reviews:76, available:false, payment:['paybox','cash'],        lat:32.090, lng:34.793, bio:'מנקה ת״א.', reviewsList:RL },
  // ── חיפה נוספים ──
  { id:'79', name:'טל כהן',      initials:'טכ', city:'חיפה',         region:'north',  workAreas:['north'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:82, rating:4.8, reviews:99, available:true, payment:['paybox','bit','cash'],  lat:32.790, lng:34.994, bio:'מנקה חיפה.', reviewsList:RL },
  { id:'80', name:'נדיה פטרוב',  initials:'נפ', city:'חיפה',         region:'north',  workAreas:['north'],  types:['מחסן ועליית גג','לאחר שיפוץ'],price:75, rating:4.6, reviews:48, available:true, payment:['cash'],              lat:32.797, lng:34.982, bio:'מנקה חיפה והכרמל.', reviewsList:RL },
  { id:'81', name:'רמי כהן',     initials:'רכ', city:'חיפה',         region:'north',  workAreas:['north'],  types:['שטיפת רכב','חלונות'],       price:68,  rating:4.5, reviews:34,  available:false, payment:['cash','bit'],         lat:32.801, lng:34.987, bio:'שטיפת רכב חיפה.', reviewsList:RL },
  // ── כפר סבא / רמלה נוספים ──
  { id:'82', name:'אנה ברון',    initials:'אב', city:'כפר סבא',      region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:90, rating:4.9, reviews:83, available:true, payment:['paybox','bit','cash'],  lat:32.179, lng:34.911, bio:'מנקה כפר סבא.', reviewsList:RL },
  { id:'83', name:'מוחמד סעיד',  initials:'מס', city:'רמלה',         region:'center', workAreas:['center'], types:['לאחר שיפוץ','שטיפת רכב'],  price:72,  rating:4.6, reviews:41,  available:true,  payment:['cash','bit'],         lat:31.925, lng:34.869, bio:'מנקה רמלה.', reviewsList:RL },
  // ── הרצליה נוספים ──
  { id:'84', name:'גל ויס',      initials:'גו', city:'הרצליה',       region:'center', workAreas:['center'], types:['ניקיון משרדים','ניקוי לפסח'],price:100, rating:4.9, reviews:112, available:true, payment:['paybox','bit','cash'],  lat:32.162, lng:34.848, bio:'מנקה הרצליה.', reviewsList:RL },
  { id:'85', name:'ציפי חן',     initials:'צח', city:'הרצליה',       region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','חלונות'],price:95,  rating:4.8, reviews:68,  available:false, payment:['paybox','cash'],        lat:32.168, lng:34.841, bio:'מומחית אירועים הרצליה.', reviewsList:RL },
  // ── ראשון לציון נוספים ──
  { id:'86', name:'ניר שלום',    initials:'נש', city:'ראשון לציון',  region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:88,  rating:4.8, reviews:95,  available:true,  payment:['paybox','bit','cash'],  lat:31.967, lng:34.801, bio:'מנקה ראשל״צ.', reviewsList:RL },
  { id:'87', name:'פנינה אוחיון',initials:'פא', city:'ראשון לציון',  region:'center', workAreas:['center'], types:['חלונות','ניקיון אחרי אירוע'],price:82,  rating:4.7, reviews:59,  available:true,  payment:['cash','bit'],         lat:31.975, lng:34.794, bio:'מנקה ראשל״צ.', reviewsList:RL },
  { id:'88', name:'ג\'ורג סמיר', initials:'גס', city:'ראשון לציון',  region:'center', workAreas:['center'], types:['שטיפת רכב','מחסן ועליית גג'],price:75, rating:4.6, reviews:44, available:false, payment:['cash'],               lat:31.970, lng:34.808, bio:'שטיפת רכב ראשל״צ.', reviewsList:RL },
  // ── אשקלון נוספים ──
  { id:'89', name:'יפית דוד',    initials:'יד', city:'אשקלון',       region:'south',  workAreas:['south'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:76, rating:4.7, reviews:62, available:true, payment:['cash','bit'],         lat:31.672, lng:34.565, bio:'מנקה אשקלון.', reviewsList:RL },
  { id:'90', name:'אמנון ביטון', initials:'אב', city:'אשקלון',       region:'south',  workAreas:['south'],  types:['לאחר שיפוץ','חלונות'],      price:68,  rating:4.5, reviews:31,  available:true,  payment:['cash'],               lat:31.664, lng:34.575, bio:'מנקה אשקלון.', reviewsList:RL },
  // ── אילת נוספים ──
  { id:'91', name:'חן מזרחי',    initials:'חמ', city:'אילת',         region:'south',  workAreas:['south'],  types:['ניקיון אחרי אירוע','חלונות'],price:95,  rating:4.9, reviews:53,  available:true,  payment:['paybox','bit','cash'],  lat:29.560, lng:34.946, bio:'מנקה אילת.', reviewsList:RL },
  { id:'92', name:'עינב לוי',    initials:'על', city:'אילת',         region:'south',  workAreas:['south'],  types:['ניקוי לפסח','מחסן ועליית גג'],price:80, rating:4.7, reviews:37, available:false, payment:['cash'],              lat:29.555, lng:34.955, bio:'מנקה אילת.', reviewsList:RL },
  // ── נצרת / טבריה נוספים ──
  { id:'93', name:'אימן ח\'טיב', initials:'אח', city:'נצרת',         region:'north',  workAreas:['north'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:68, rating:4.7, reviews:54, available:true, payment:['cash','bit'],         lat:32.701, lng:35.297, bio:'מנקה נצרת.', reviewsList:RL },
  { id:'94', name:'שולה אבו',    initials:'שא', city:'טבריה',        region:'north',  workAreas:['north'],  types:['חלונות','שטיפת רכב'],       price:62,  rating:4.6, reviews:39,  available:true,  payment:['cash'],               lat:32.789, lng:35.524, bio:'מנקה טבריה.', reviewsList:RL },
  { id:'95', name:'קייס נסר',    initials:'קנ', city:'טבריה',        region:'north',  workAreas:['north'],  types:['לאחר שיפוץ','ניקוי לפסח'], price:72,  rating:4.7, reviews:46,  available:false, payment:['cash','bit'],         lat:32.793, lng:35.528, bio:'מנקה טבריה.', reviewsList:RL },
  // ── נוספים מרכז ──
  { id:'96', name:'איילת גל',    initials:'אג', city:'ראש העין',     region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון משרדים'],price:80,  rating:4.7, reviews:57,  available:true,  payment:['cash','bit'],         lat:32.095, lng:34.957, bio:'מנקה ראש העין.', reviewsList:RL },
  { id:'97', name:'עמית פורת',   initials:'עפ', city:'יהוד',         region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','חלונות'],price:85,  rating:4.8, reviews:63,  available:true,  payment:['paybox','cash'],        lat:32.032, lng:34.888, bio:'מנקה יהוד ואזוריה.', reviewsList:RL },
  { id:'98', name:'נעה שפירא',   initials:'נש', city:'מזכרת בתיה',   region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:74,  rating:4.6, reviews:33,  available:true,  payment:['cash'],               lat:31.856, lng:34.847, bio:'מנקה מזכרת בתיה.', reviewsList:RL },
  { id:'99', name:'איתי כהן',    initials:'אכ', city:'גדרה',         region:'center', workAreas:['center','south'], types:['שטיפת רכב','ניקיון אחרי אירוע'],price:76, rating:4.7, reviews:48, available:true, payment:['cash','bit'],         lat:31.812, lng:34.778, bio:'מנקה גדרה ואזוריה.', reviewsList:RL },
];

const TYPE_ICONS: Record<string, string> = {
  'ניקיון רגיל': '🏠', 'ניקוי לפסח': '🧹', 'חלונות': '🪟', 'לאחר שיפוץ': '🔨',
  'שטיפת רכב': '🚗', 'ניקיון משרדים': '🏢',
  'ניקיון אחרי אירוע': '🎉', 'מחסן ועליית גג': '📦',
  'סידורי בגדים וארונות': '👔',
};

const SERVICE_DESCRIPTIONS: Record<string, string[]> = {
  'ניקיון רגיל': [
    '🫧 שטיפת רצפות וניגוב (כל חדרי הבית)',
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

function getBadges(cleaner: any): string[] {
  const b: string[] = [];
  if (cleaner.identityVerified)                                      b.push('idVerified');
  if (cleaner.rating >= 4.8 && (cleaner.reviews || 0) >= 20)        b.push('superCleaner');
  if ((cleaner.reviews || 0) >= 50)                                  b.push('topRated');
  if (cleaner.phone && cleaner.bio && (cleaner.types?.length || 0) >= 3) b.push('verified');
  return b;
}

function badgeLabel(b: string, t: any): string {
  if (b === 'idVerified')    return t.badgeIdVerified;
  if (b === 'superCleaner')  return t.badgeSuperCleaner;
  if (b === 'topRated')      return t.badgeTopRated;
  return t.badgeVerified;
}

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  idVerified:   { bg: '#DCFCE7', color: '#15803D' },
  superCleaner: { bg: '#FEF3C7', color: '#D97706' },
  topRated:     { bg: '#EDE9FE', color: '#7C3AED' },
  verified:     { bg: '#D1FAE5', color: '#059669' },
};
const PAY_ICONS: Record<string, string> = { bit: '📱', cash: '💵', paybox: '🅿️', bank: '🏦' };
const PAYBOX_BLUE = '#11AEE8';

// סמל PayBox — דמות עם ידיים מורמות, בנוי מ-View (ניתן לצביעה, ללא תלות ב-svg/אמוג'י)
function PayboxIcon({ size = 16, color = PAYBOX_BLUE }: { size?: number; color?: string }) {
  const S = size;
  return (
    <View style={{ width: S, height: S, position: 'relative' }}>
      {/* ראש */}
      <View style={{ position: 'absolute', top: 0, left: S * 0.34, width: S * 0.32, height: S * 0.32, borderRadius: S * 0.16, backgroundColor: color }} />
      {/* יד שמאל */}
      <View style={{ position: 'absolute', top: S * 0.30, left: S * 0.02, width: S * 0.42, height: S * 0.13, borderRadius: S * 0.07, backgroundColor: color, transform: [{ rotate: '42deg' }] }} />
      {/* יד ימין */}
      <View style={{ position: 'absolute', top: S * 0.30, right: S * 0.02, width: S * 0.42, height: S * 0.13, borderRadius: S * 0.07, backgroundColor: color, transform: [{ rotate: '-42deg' }] }} />
      {/* גוף — צורת U פתוחה למעלה */}
      <View style={{ position: 'absolute', bottom: 0, left: S * 0.29, width: S * 0.42, height: S * 0.44, borderLeftWidth: S * 0.12, borderRightWidth: S * 0.12, borderBottomWidth: S * 0.12, borderColor: color, borderBottomLeftRadius: S * 0.12, borderBottomRightRadius: S * 0.12 }} />
    </View>
  );
}

const LANGS: { code: Lang; label: string; flag: string; nativeName: string }[] = [
  { code: 'he', label: 'עברית',    flag: '🇮🇱', nativeName: 'עברית' },
  { code: 'en', label: 'English',  flag: '🇬🇧', nativeName: 'English' },
  { code: 'ru', label: 'Русский',  flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'hi', label: 'हिन्दी',  flag: '🇮🇳', nativeName: 'हिन्दी' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦', nativeName: 'Українська' },
];

const NEARBY_KM = 30;

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'תל אביב':        { lat: 32.087, lng: 34.789 }, 'חיפה':           { lat: 32.794, lng: 34.989 },
  'ירושלים':        { lat: 31.782, lng: 35.218 }, 'באר שבע':        { lat: 31.252, lng: 34.791 },
  'נתניה':          { lat: 32.329, lng: 34.857 }, 'ראשון לציון':    { lat: 31.971, lng: 34.789 },
  'אשדוד':          { lat: 31.804, lng: 34.655 }, 'אשקלון':         { lat: 31.668, lng: 34.571 },
  'פתח תקוה':       { lat: 32.089, lng: 34.888 }, 'כפר סבא':        { lat: 32.175, lng: 34.907 },
  'הרצליה':         { lat: 32.165, lng: 34.843 }, 'נצרת':           { lat: 32.699, lng: 35.303 },
  'טבריה':          { lat: 32.795, lng: 35.531 }, 'אילת':           { lat: 29.558, lng: 34.952 },
  'עכו':            { lat: 32.928, lng: 35.082 }, 'חריש':           { lat: 32.458, lng: 35.041 },
  'רחובות':         { lat: 31.894, lng: 34.811 }, 'בת ים':          { lat: 32.022, lng: 34.750 },
  'רמת גן':         { lat: 32.082, lng: 34.813 }, 'הוד השרון':      { lat: 32.150, lng: 34.887 },
  'עפולה':          { lat: 32.607, lng: 35.290 }, 'קריית שמונה':    { lat: 33.207, lng: 35.570 },
  'מודיעין':        { lat: 31.898, lng: 35.010 }, 'מודיעין עילית':  { lat: 31.930, lng: 35.043 },
  'לוד':            { lat: 31.952, lng: 34.895 }, 'רמלה':           { lat: 31.929, lng: 34.874 },
  'גבעת שמואל':     { lat: 32.078, lng: 34.848 }, 'בני ברק':        { lat: 32.084, lng: 34.833 },
  'גבעתיים':        { lat: 32.073, lng: 34.813 }, 'חולון':          { lat: 32.010, lng: 34.779 },
  'אור יהודה':      { lat: 32.029, lng: 34.856 }, 'יבנה':           { lat: 31.877, lng: 34.741 },
  'קריית אתא':      { lat: 32.808, lng: 35.107 }, 'קריית גת':       { lat: 31.607, lng: 34.771 },
  'קריית מלאכי':   { lat: 31.730, lng: 34.737 }, 'קריית ביאליק':   { lat: 32.834, lng: 35.087 },
  'קריית מוצקין':  { lat: 32.835, lng: 35.074 }, 'קריית ים':       { lat: 32.854, lng: 35.066 },
  'נהריה':          { lat: 33.002, lng: 35.098 }, 'נצרת עילית':     { lat: 32.706, lng: 35.318 },
  'ראש העין':       { lat: 32.095, lng: 34.957 }, 'אלעד':           { lat: 32.053, lng: 34.952 },
  'יהוד':           { lat: 32.030, lng: 34.888 }, 'מזכרת בתיה':     { lat: 31.858, lng: 34.843 },
  'גדרה':           { lat: 31.812, lng: 34.779 }, 'נס ציונה':       { lat: 31.930, lng: 34.797 },
  'ראשל"צ':         { lat: 31.971, lng: 34.789 }, 'ת"א':            { lat: 32.087, lng: 34.789 },
  'פ"ת':            { lat: 32.089, lng: 34.888 }, 'ר"ג':            { lat: 32.082, lng: 34.813 },
  'ב"ב':            { lat: 32.084, lng: 34.833 }, 'כ"ס':            { lat: 32.175, lng: 34.907 },
  'טירת כרמל':      { lat: 32.759, lng: 34.970 }, 'דלית אל כרמל':  { lat: 32.703, lng: 35.034 },
  'עמק יזרעאל':    { lat: 32.600, lng: 35.200 }, 'בית שמש':        { lat: 31.743, lng: 34.988 },
  'מעלה אדומים':   { lat: 31.773, lng: 35.296 }, 'אריאל':          { lat: 32.106, lng: 35.167 },
  'זכרון יעקב':    { lat: 32.568, lng: 34.953 }, 'פרדס חנה':       { lat: 32.471, lng: 34.964 },
  'מגדל העמק':      { lat: 32.677, lng: 35.238 },
  'שדרות':          { lat: 31.524, lng: 34.596 }, 'נתיבות':         { lat: 31.421, lng: 34.594 },
  'דימונה':         { lat: 31.069, lng: 35.033 }, 'ערד':            { lat: 31.258, lng: 35.214 },
  'מצפה רמון':     { lat: 30.612, lng: 34.803 }, 'אופקים':         { lat: 31.312, lng: 34.620 },
  // ערים נוספות
  'נשר':            { lat: 32.772, lng: 35.031 }, 'נוף הגליל':      { lat: 32.706, lng: 35.318 },
  'שפרעם':          { lat: 32.804, lng: 35.169 }, 'צפת':            { lat: 32.965, lng: 35.497 },
  'בית שאן':        { lat: 32.498, lng: 35.499 }, 'יוקנעם':         { lat: 32.658, lng: 35.106 },
  'סח\'נין':        { lat: 32.856, lng: 35.302 }, 'טמרה':           { lat: 32.862, lng: 35.197 },
  'אום אל-פחם':     { lat: 32.526, lng: 35.152 }, 'מג\'ד אל-כרום': { lat: 32.908, lng: 35.255 },
  'באקה אל-גרביה':  { lat: 32.418, lng: 35.042 }, 'כפר קאסם':      { lat: 32.116, lng: 34.977 },
  'קלנסווה':        { lat: 32.284, lng: 34.978 }, 'טייבה':          { lat: 32.241, lng: 34.997 },
  'אור עקיבא':      { lat: 32.508, lng: 34.921 }, 'פרדס חנה-כרכור': { lat: 32.471, lng: 34.968 },
  'חדרה':           { lat: 32.435, lng: 34.919 }, 'כפר יונה':       { lat: 32.322, lng: 34.939 },
  'קדימה-צורן':     { lat: 32.274, lng: 34.923 }, 'רמת השרון':      { lat: 32.146, lng: 34.840 },
  'יהוד-מונוסון':   { lat: 32.030, lng: 34.888 }, 'גני תקווה':      { lat: 32.062, lng: 34.875 },
  'שוהם':           { lat: 31.998, lng: 34.942 }, 'אזור':           { lat: 32.020, lng: 34.818 },
  'מבשרת ציון':     { lat: 31.808, lng: 35.156 }, 'גבעת זאב':       { lat: 31.869, lng: 35.168 },
  'ביתר עלית':      { lat: 31.697, lng: 35.120 }, 'מודיעין עלית':   { lat: 31.930, lng: 35.043 },
  'רהט':            { lat: 31.393, lng: 34.754 }, 'ירוחם':          { lat: 30.987, lng: 34.930 },
};
const REGION_CENTER: Record<string, { lat: number; lng: number }> = {
  north:  { lat: 32.8,  lng: 35.2  },
  center: { lat: 32.0,  lng: 34.85 },
  south:  { lat: 31.0,  lng: 34.8  },
};

// ── 200 בוטים מפוזרים בכל הערים בארץ (לתצוגה/דמו) ──────────────────────────────
const BOT_FEMALE_NAMES = ['יעל כהן','דנה לוי','מירי אבני','רונית שגב','שירה דהן','נועה ברק','תמר גל','מיכל אזולאי','אורית פרץ','גלית מזרחי','ליאת שמש','רחל גולן','שרה כץ','לאה אדרי','חנה ביטון','אסתר נחום','רותי אשר','סיגל רון','ענת בר','מאיה לב','קרן שגיא','הילה נווה','אורלי מימון','שני דרור'];
const BOT_MALE_NAMES = ['אבי דוד','יוסי חזן','משה עמר','דוד שלום','עמית רז','איל נוי','רן הראל','גיא ספיר','ניר אלון','עומר טל','דור שביט','אלון מור','יובל סער','ליאור דגן','אסף יונה','עידן כרמי','נדב גבע','ארז שדה','חיים פרי','יעקב נסים','אהרון רחמים','מאיר אביב','שלמה בן דוד','אורי הדר','בני זיו','גד אוחיון','זיו שני','איתי כספי'];
const BOT_BIOS = ['מנקה מקצועית ואמינה.','שירות יסודי ומהיר.','ניקיון מושלם בכל פעם.','מנקה ותיקה ומנוסה.','דייקנית ואחראית.','שירות אדיב ומקצועי.','מומחית לניקיון בתים ומשרדים.','עבודה נקייה ומדויקת.'];
const BOT_PAYMENTS: string[][] = [['cash'],['cash','bit'],['cash','bit','paybox'],['paybox','cash'],['bit','cash'],['cash','bit','paybox','bank']];
function regionFromLat(lat: number): string { if (lat >= 32.4) return 'north'; if (lat <= 31.6) return 'south'; return 'center'; }
const BOTS: any[] = (() => {
  const cities = Object.entries(CITY_COORDS);
  const typeKeys = Object.keys(TYPE_ICONS);
  const out: any[] = [];
  let i = 0;
  while (out.length < 200 && cities.length > 0) {
    const [city, c] = cities[i % cities.length]; i++;
    const isFemale = Math.random() < 0.55;
    const pool = isFemale ? BOT_FEMALE_NAMES : BOT_MALE_NAMES;
    const name = pool[Math.floor(Math.random() * pool.length)];
    const photo = `https://randomuser.me/api/portraits/${isFemale ? 'women' : 'men'}/${Math.floor(Math.random() * 100)}.jpg`;
    const region = regionFromLat(c.lat);
    const t1 = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    let t2 = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    if (t2 === t1) t2 = typeKeys[(typeKeys.indexOf(t1) + 1) % typeKeys.length];
    out.push({
      id: 'bot_' + out.length,
      name,
      photo,
      initials: name.replace(/[^א-תA-Za-z ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 2),
      city,
      region,
      workAreas: [region],
      types: [t1, t2],
      price: 60 + Math.floor(Math.random() * 8) * 5,
      rating: Math.round((4.3 + Math.random() * 0.7) * 10) / 10,
      reviews: 10 + Math.floor(Math.random() * 200),
      available: Math.random() > 0.2,
      payment: BOT_PAYMENTS[Math.floor(Math.random() * BOT_PAYMENTS.length)],
      lat: c.lat + (Math.random() - 0.5) * 0.03,
      lng: c.lng + (Math.random() - 0.5) * 0.03,
      bio: BOT_BIOS[Math.floor(Math.random() * BOT_BIOS.length)],
      reviewsList: [],
      isBot: true,
    });
  }
  return out;
})();

// city names sorted longest-first so e.g. "קריית אתא" matches before "אתא"
const CITY_KEYS_BY_LEN = Object.keys(CITY_COORDS).sort((a, b) => b.length - a.length);

// cleaners whose address we've already geocoded this session (avoid re-hitting the geocoder)
const _geocodedCleaners = new Set<string>();

// Extract just the city name from a cleaner's city/address (e.g. "רקפת 50 חריש" → "חריש")
function cityNameOf(cleaner: any): string {
  const raw = String(cleaner?.city || cleaner?.cleanerAddress || cleaner?.address || '').trim();
  if (!raw) return '';
  if (CITY_COORDS[raw]) return raw;
  for (const key of CITY_KEYS_BY_LEN) { if (raw.includes(key)) return key; }
  const parts = raw.split(/[,]+/).map(p => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : raw;
}

function getCoordsForCleaner(d: any): { lat: number; lng: number } {
  // קואורדינטות מדויקות מהכתובת (גיאוקודינג שנשמר) — עדיפות עליונה
  if (typeof d.lat === 'number' && typeof d.lng === 'number' && !isNaN(d.lat) && !isNaN(d.lng)) return { lat: d.lat, lng: d.lng };
  const cityRaw = String(d.city || '').trim();
  if (cityRaw && CITY_COORDS[cityRaw]) return CITY_COORDS[cityRaw];
  // נסה למצוא שם עיר ידוע בתוך העיר/הכתובת המלאה (מנקה שומר כתובת ב-cleanerAddress)
  const hay = `${cityRaw} ${d.cleanerAddress || ''} ${d.address || ''}`;
  for (const key of CITY_KEYS_BY_LEN) {
    if (hay.includes(key)) return CITY_COORDS[key];
  }
  // נסה עיר ראשונה בworkAreas
  if (d.workAreas) {
    for (const area of d.workAreas) {
      if (CITY_COORDS[area]) return CITY_COORDS[area];
    }
  }
  const area = d.workAreas?.[0] || d.region;
  const base = REGION_CENTER[area] || REGION_CENTER.center;
  return { lat: base.lat, lng: base.lng };
}

// ─── WhatsApp via UltraMsg ────────────────────────────────────────────────────
// ⚠️ TODO: Move UM_INSTANCE / UM_TOKEN to Firebase Remote Config or env vars
const UM_INSTANCE = 'instance172639';
const UM_TOKEN    = 'e6v2dd4dayk5rhay';

// נרמל מספר טלפון לפורמט 972
function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s+\-().]/g, '');
  if (p.startsWith('0')) p = '972' + p.slice(1);
  if (!p.startsWith('972')) p = '972' + p;
  return p;
}

// שולח הודעת וואצאפ — תומך גם במספר טלפון וגם ב-Group ID (XXXX@g.us)
async function sendWhatsAppMessage(to: string, message: string) {
  if (!UM_TOKEN || !to) return;
  try {
    const recipient = to.includes('@') ? to.trim() : normalizePhone(to);
    const res = await fetch(`https://api.ultramsg.com/${UM_INSTANCE}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: UM_TOKEN, to: recipient, body: message, priority: 1 }),
    });
    const json = await res.json().catch(() => ({}));
    console.log('[WA →', recipient, ']', json);
  } catch (e) {
    console.warn('[WA error]', e);
  }
}

// יוצר קבוצת וואצאפ חדשה דרך UltraMsg ומחזיר את ה-Group ID
// נקרא אוטומטית כשמנקה חדש נרשם, או בבקשה דחופה ראשונה
async function createWhatsAppGroup(cleanerName: string, cleanerPhone: string, cleanerUid: string): Promise<string> {
  try {
    const normalized = normalizePhone(cleanerPhone);
    const res = await fetch(`https://api.ultramsg.com/${UM_INSTANCE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token:        UM_TOKEN,
        name:         `🧹 A&M Clean — ${cleanerName}`,
        participants: normalized,
      }),
    });
    const json = await res.json().catch(() => ({}));
    const groupId: string = json?.id || json?.gid || '';
    if (groupId) {
      // שמור ב-Firestore
      await setDoc(doc(db, 'users', cleanerUid), { whatsappGroupId: groupId }, { merge: true });
      console.log('[WA GROUP CREATED]', cleanerName, groupId);
    }
    return groupId;
  } catch (e) {
    console.warn('[WA GROUP CREATE ERROR]', e);
    return '';
  }
}

async function sendPushNotification(token: string, title: string, body: string, data?: Record<string, any>, opts?: { channelId?: string; color?: string }) {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token, title, body,
        sound: 'default',
        channelId: opts?.channelId || 'messages',
        priority: 'high',
        ...(opts?.color ? { color: opts.color } : {}),
        data: data || {},
      }),
    });
    const json = await res.json().catch(() => ({}));
    console.log('[PUSH result]', json);
    return json;
  } catch (e) {
    console.warn('[PUSH error]', e);
  }
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// סמן מנקה על המפה — עוקב פעם אחת קצרה כדי להצטייר, ואז מפסיק (חוסך זיכרון, מונע קריסה)
function CleanerMapMarker({ c, isSel, onPress }: { c: any; isSel: boolean; onPress: () => void }) {
  const C = useAppColors();
  const [track, setTrack] = React.useState(true);
  React.useEffect(() => {
    const id = setTimeout(() => setTrack(false), 900);
    return () => clearTimeout(id);
  }, []);
  const dotColor = !c.available ? '#EF4444' : C.blue;
  const dotSize  = isSel ? 18 : 13;
  return (
    <Marker
      coordinate={{ latitude: c.lat, longitude: c.lng }}
      tracksViewChanges={track || isSel}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: dotColor, borderWidth: 2, borderColor: C.white, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2 }} />
    </Marker>
  );
}

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  const C = useAppColors();
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <T key={i} style={{ color: i <= Math.round(rating) ? C.gold : C.grayBorder, fontSize: size }}>★</T>
      ))}
    </View>
  );
}

// ─── BackHandler בתוך Modal ───────────────────────────────────────────────────
function ModalBackHandler({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  return null;
}

// ─── Drawer ──────────────────────────────────────────────────────────────────
const PANEL_W = 270;

function DrawerMenu({ visible, onClose, onProfile, onLogout, onMessages, onReport, onSupport, onActiveBookings, onHistory, showHistory = true }: any) {
  const { t, lang, setLang, flipSide, setFlipSide } = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const ds = createDS(C);
  const [showLangs, setShowLangs] = useState(false);

  // ─── מיקום פיזי בפיקסלים — עוקף לגמרי את RTL right/left ───────────────────
  // flipSide=false → פאנל בצד ימין פיזי:  left = W - PANEL_W
  // flipSide=true  → פאנל בצד שמאל פיזי: left = 0
  const panelLeft = flipSide ? 0 : W - PANEL_W;
  // כיוון אנימציה: יוצא מחוץ למסך ואז נכנס ל-0
  const offscreen  = flipSide ? -PANEL_W : PANEL_W;

  const slideAnim = useRef(new Animated.Value(offscreen)).current;

  useEffect(() => {
    const off = flipSide ? -PANEL_W : PANEL_W;
    if (visible) {
      // תמיד נתחיל מחוץ למסך — מונע "תקיעות" אחרי החלפת שפה
      slideAnim.setValue(off);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: off, useNativeDriver: true, duration: 200 }).start();
      setShowLangs(false);
    }
  }, [visible, flipSide]);

  // Toggle row helper
  const ToggleRow = ({ icon, label, value, onToggle }: { icon: string; label: string; value: boolean; onToggle: () => void }) => (
    <TouchableOpacity
      style={ds.item}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <T style={ds.itemIcon}>{icon}</T>
      <T style={[ds.itemText, { flex: 1 }]}>{label}</T>
      <View style={[ds.toggle, value && ds.toggleOn]}>
        <View style={[ds.toggleThumb, value && ds.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <ModalBackHandler onBack={onClose} />
      <TouchableOpacity
        style={ds.backdrop}
        onPress={onClose}
        activeOpacity={1}
        accessibilityLabel="סגור תפריט"
        accessibilityRole="button"
      />
      {/* left מחושב בפיקסלים פיזיים — לא מושפע מ-RTL כלל */}
      <Animated.View style={[
        ds.panel,
        { left: panelLeft },
        { transform: [{ translateX: slideAnim }] },
      ]}>
        {/* header */}
        <View style={ds.panelHeader}>
          <Image
            source={require('../assets/images/logo-trimmed.png')}
            style={{ width: 160, height: 133, marginBottom: 6 }}
            contentFit="contain"
          />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: NAV_BAR_HEIGHT + 24 }} accessibilityLabel="תפריט ניווט">

          {/* ── קבוצה ראשית ── */}
          <TouchableOpacity
            style={ds.item}
            onPress={() => { onClose(); onProfile(); }}
            accessibilityRole="button"
            accessibilityLabel={t.drawerProfile}
          >
            <T style={ds.itemIcon}>👤</T>
            <T style={ds.itemText}>{t.drawerProfile}</T>
            <T style={ds.itemArrow}>‹</T>
          </TouchableOpacity>

          <TouchableOpacity
            style={ds.item}
            onPress={() => { onClose(); onActiveBookings(); }}
            accessibilityRole="button"
            accessibilityLabel={t.activeBookingsTitle}
          >
            <T style={ds.itemIcon}>📅</T>
            <T style={[ds.itemText, { flex: 1 }]}>{t.activeBookingsTitle}</T>
            <T style={ds.itemArrow}>‹</T>
          </TouchableOpacity>

          {showHistory && (
            <TouchableOpacity
              style={ds.item}
              onPress={() => { onClose(); onHistory(); }}
              accessibilityRole="button"
              accessibilityLabel={t.historyTitle}
            >
              <T style={ds.itemIcon}>📋</T>
              <T style={[ds.itemText, { flex: 1 }]}>{t.historyTitle}</T>
              <T style={ds.itemArrow}>‹</T>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={ds.item}
            onPress={() => setShowLangs(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={t.drawerLanguage}
            accessibilityState={{ expanded: showLangs }}
          >
            <T style={ds.itemIcon}>🌐</T>
            <T style={[ds.itemText, { flex: 1 }]}>{t.drawerLanguage}</T>
            <T style={ds.itemArrow}>{showLangs ? '▲' : '▼'}</T>
          </TouchableOpacity>

          {showLangs && (
            <View style={ds.langList}>
              {LANGS.map(l => (
                <TouchableOpacity
                  key={l.code}
                  style={[ds.langItem, lang === l.code && ds.langItemActive]}
                  onPress={() => { setLang(l.code); setShowLangs(false); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: lang === l.code }}
                  accessibilityLabel={l.label}
                >
                  <T style={ds.langFlag}>{l.flag}</T>
                  <T style={[ds.langLabel, lang === l.code && { color: C.blue, fontWeight: '700' }]}>{l.label}</T>
                  {lang === l.code && <T style={{ color: C.blue, fontSize: 16 }}>✓</T>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={ds.item}
            onPress={() => { onClose(); onMessages(); }}
            accessibilityRole="button"
            accessibilityLabel={t.drawerMessages}
          >
            <T style={ds.itemIcon}>💬</T>
            <T style={[ds.itemText, { flex: 1 }]}>{t.drawerMessages}</T>
            <T style={ds.itemArrow}>‹</T>
          </TouchableOpacity>

          <TouchableOpacity
            style={ds.item}
            onPress={() => { onClose(); onSupport(); }}
            accessibilityRole="button"
            accessibilityLabel="תמיכה"
          >
            <T style={ds.itemIcon}>👨‍💼</T>
            <T style={[ds.itemText, { flex: 1 }]}>{t.drawerSupport}</T>
            <T style={ds.itemArrow}>‹</T>
          </TouchableOpacity>

          {/* ── קבוצת פעולות רגישות ── */}
          <TouchableOpacity
            style={ds.item}
            onPress={onReport}
            accessibilityRole="button"
            accessibilityLabel={t.reportBtn}
          >
            <T style={[ds.itemText, { flex: 1, color: '#EF4444' }]}>{t.reportBtn}</T>
            <T style={ds.itemArrow}>‹</T>
          </TouchableOpacity>

          <TouchableOpacity
            style={ds.item}
            onPress={() => { onClose(); onLogout(); }}
            accessibilityRole="button"
            accessibilityLabel={t.drawerLogout}
          >
            <T style={ds.itemIcon}>🚪</T>
            <T style={[ds.itemText, { flex: 1, color: '#EF4444' }]}>{t.drawerLogout}</T>
          </TouchableOpacity>

          {/* זכויות יוצרים */}
          <View style={{ marginTop: 18, paddingTop: 14, alignItems: 'center', gap: 2 }}>
            <T style={{ fontSize: 11, color: C.textSub, fontWeight: '600', textAlign: 'center' }}>© {new Date().getFullYear()} A&M Clean</T>
            <T style={{ fontSize: 10, color: C.textSub, textAlign: 'center' }}>כל הזכויות שמורות</T>
          </View>

        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Reviews modal ────────────────────────────────────────────────────────────
function ReviewsModal({ cleaner, visible, onClose }: any) {
  const { t } = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const [loadedReviews, setLoadedReviews] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (!visible || !cleaner?.id) { setLoadedReviews([]); return; }
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users', cleaner.id, 'reviews'));
        const arr = snap.docs.map(d => d.data() as any)
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        if (alive) setLoadedReviews(arr);
      } catch (_) { if (alive) setLoadedReviews([]); }
    })();
    return () => { alive = false; };
  }, [visible, cleaner?.id]);
  if (!cleaner) return null;
  const reviewsToShow = loadedReviews.length > 0 ? loadedReviews : (cleaner.reviewsList || []);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}><T style={{ color: C.white, fontSize: 18 }}>✕</T></TouchableOpacity>
          <T style={s.modalTitle}>{t.reviewsSuffix} — {cleaner.name}</T>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View style={s.ratingBigCard}>
            <T style={s.ratingBigNum}>{cleaner.rating}</T>
            <Stars rating={cleaner.rating} size={24} />
            <T style={s.ratingBigCount}>{loadedReviews.length > 0 ? loadedReviews.length : cleaner.reviews} {t.reviewsSuffix}</T>
          </View>
          {reviewsToShow.map((r: any, i: number) => {
            const rName = r.name || r.clientName || t.clientWord || 'לקוח';
            const rDate = r.createdAt || r.date ? new Date(r.createdAt || r.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
            return (
            <View key={i} style={s.reviewCard}>
              <View style={s.reviewTop}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                    <T style={s.reviewName}>{rName}</T>
                    {!!rDate && <T style={{ fontSize: 11, color: C.textSub }}>{rDate}</T>}
                  </View>
                  <Stars rating={r.stars} size={12} />
                </View>
              </View>
              <T style={s.reviewText}>{r.text}</T>
            </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Cleaner profile modal ───────────────────────────────────────────────────
function CleanerProfile({ cleaner, visible, onClose, onBook, onChat, initialShowReviews }: any) {
  const { t } = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const insets = useSafeAreaInsets();
  const [showReviews, setShowReviews] = useState(false);
  const [loadedReviews, setLoadedReviews] = React.useState<any[]>([]);
  const scrollRef = React.useRef<ScrollView>(null);
  const reviewsY = React.useRef(0);
  // כשנפתח מלחיצה על ביקורת בכרטיס — לגלול אל חלק הביקורות
  React.useEffect(() => {
    if (visible && initialShowReviews) {
      const id = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, reviewsY.current - 12), animated: true });
      }, 450);
      return () => clearTimeout(id);
    }
  }, [visible, initialShowReviews, cleaner?.id]);
  React.useEffect(() => {
    if (!visible || !cleaner?.id) { setLoadedReviews([]); return; }
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users', cleaner.id, 'reviews'));
        const arr = snap.docs.map(d => d.data() as any)
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        if (alive) setLoadedReviews(arr);
      } catch (_) { if (alive) setLoadedReviews([]); }
    })();
    return () => { alive = false; };
  }, [visible, cleaner?.id]);
  if (!cleaner) return null;
  const reviewsToShow = loadedReviews.length > 0 ? loadedReviews : (cleaner.reviewsList || []);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
        <View style={s.profileHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}><MaterialIcons name="arrow-back" size={24} color={C.white} /></TouchableOpacity>
          <T style={s.profileHeaderTitle}>{t.cleanerProfileTitle}</T>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
          <View style={s.profileHero}>
            <View style={s.profileAvatar}>
              {(() => {
                const uri = cleaner.photoB64 || cleaner.photo ||
                  (!isNaN(parseInt(cleaner.id)) ? `https://i.pravatar.cc/150?img=${((parseInt(cleaner.id) - 1) % 70) + 1}` : null);
                return uri
                  ? <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 45 }} contentFit="cover" />
                  : <T style={s.profileAvatarText}>{cleaner.initials}</T>;
              })()}
            </View>
            <T style={s.profileName}>{cleaner.name}</T>
            <T style={s.profileCity}>📍 {t.cities[cleaner.city] || cleaner.city}</T>
            <View style={[s.availBadge, !cleaner.available && s.availBadgeOff]}>
              <T style={[s.availBadgeText, !cleaner.available && { color: C.textSub }]}>
                {cleaner.available ? t.availNow : t.notAvailNow}
              </T>
            </View>
            {(() => {
              const badges = getBadges(cleaner);
              return badges.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                  {badges.map(b => (
                    <View key={b} style={[s.badgePill, { backgroundColor: BADGE_COLORS[b]?.bg || '#F0F0F0' }]}>
                      <T style={[s.badgePillText, { color: BADGE_COLORS[b]?.color || '#666' }]}>
                        {badgeLabel(b, t)}
                      </T>
                    </View>
                  ))}
                </View>
              ) : null;
            })()}
            <View style={s.statsRow}>
              <View style={s.statBox}><T style={s.statVal}>{cleaner.rating}</T><T style={s.statLabel}>{t.ratingLabel}</T></View>
              <View style={s.statDivider} />
              <View style={s.statBox}><T style={s.statVal}>{cleaner.reviews}</T><T style={s.statLabel}>{t.reviewsSuffix}</T></View>
              <View style={s.statDivider} />
              <View style={s.statBox}><T style={s.statVal}>₪{cleaner.price}</T><T style={s.statLabel}>{t.perHour}</T></View>
            </View>
          </View>
          <View style={s.profileSection}>
            <T style={s.profileSectionTitle}>{t.aboutLabel}</T>
            <T style={s.profileBio} numberOfLines={4} ellipsizeMode="tail">
              {cleaner.bio
                ? cleaner.bio.split(/\s+/).slice(0, 30).join(' ') +
                  (cleaner.bio.split(/\s+/).length > 30 ? '...' : '')
                : ''}
            </T>
          </View>

          {/* Supplies badge */}
          {cleaner.bringSupplies !== null && cleaner.bringSupplies !== undefined && (
            <View style={s.profileSection}>
              <T style={s.profileSectionTitle}>{t.suppliesDisplay}</T>
              <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                <View style={{ backgroundColor: cleaner.bringSupplies ? '#D1FAE5' : '#FEF3C7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: cleaner.bringSupplies ? '#6EE7B7' : '#FCD34D' }}>
                  <T style={{ fontSize: 14, fontWeight: '700', color: cleaner.bringSupplies ? '#065F46' : '#92400E' }}>
                    {cleaner.bringSupplies ? t.suppliesCleaner : t.suppliesClient}
                  </T>
                </View>
              </View>
            </View>
          )}

          {/* Phone */}
          {(cleaner.phone || cleaner.isReal) && (
            <View style={s.profileSection}>
              <T style={s.profileSectionTitle}>{t.phoneLabel}</T>
              {cleaner.phone && cleaner.showPhone !== false ? (
                <View style={s.phonePill}>
                  <T style={s.phonePillText}>📞 {cleaner.phone}</T>
                </View>
              ) : (
                <View style={[s.phonePill, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
                  <T style={[s.phonePillText, { color: '#94A3B8' }]}>{t.phoneHiddenLabel}</T>
                </View>
              )}
            </View>
          )}

          <View style={s.profileSection}>
            <T style={s.profileSectionTitle}>{t.servicesLabel}</T>
            {/* תפריט אנכי במרווחים שווים — פירוט נפתח רק בלחיצה */}
            <View style={{ flexDirection: 'column', gap: 8, alignItems: 'stretch', width: '100%' }}>
              {cleaner.types.map((tp: string) => {
                const svcPrice = cleaner.servicePricing?.[tp] ?? cleaner.price;
                return (
                  <View key={tp} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch' }}>
                    <View style={{ flex: 1 }}>
                      <ServiceInfoBtn
                        serviceKey={tp}
                        inlinePill
                        pillStyle={[s.servicePill, { alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 11 }]}
                        pillTextStyle={s.servicePillText}
                        label={`${TYPE_ICONS[tp] || '🧹'} ${t.types[tp] || tp}`}
                      />
                    </View>
                    {svcPrice != null && (
                      <View style={{ backgroundColor: '#FFF4E5', borderWidth: 1, borderColor: '#FFD9A6', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 9, minWidth: 58, alignItems: 'center' }}>
                        <T style={{ fontSize: 13, fontWeight: '800', color: '#C2660A' }}>₪{svcPrice}</T>
                        <T style={{ fontSize: 9, color: '#C2660A', opacity: 0.8 }}>{(t as any).perHourShort ?? 'לשעה'}</T>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
          <View style={s.profileSection}>
            <T style={s.profileSectionTitle}>{t.paymentLabel}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {cleaner.payment.map((p: string) => <View key={p} style={[s.payPill, p === 'paybox' && { flexDirection: 'row', alignItems: 'center', gap: 3 }]}>{p === 'paybox' && <PayboxIcon size={13} />}<T style={s.payPillText}>{p === 'paybox' ? t.payPaybox : `${PAY_ICONS[p] || '💳'} ${p === 'bit' ? t.payBit : p === 'cash' ? t.payCash : p === 'bank' ? t.payBank : p === 'card' ? t.payCard : p === 'kochavit' ? ((t as any).payKochavit ?? 'כוכבית') : p}`}</T></View>)}
            </View>
          </View>
          <View style={s.profileSection} onLayout={e => { reviewsY.current = e.nativeEvent.layout.y; }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12, gap: 10 }}>
              <T style={s.profileSectionTitle}>{t.reviewsSuffix} ({loadedReviews.length > 0 ? loadedReviews.length : cleaner.reviews})</T>
              <TouchableOpacity onPress={() => setShowReviews(true)}><T style={s.seeAllBtn}>{t.seeAllBtn}</T></TouchableOpacity>
            </View>
            <Stars rating={cleaner.rating} size={20} />
            {reviewsToShow.slice(0, 3).map((r: any, i: number) => {
              const rName = r.name || r.clientName || t.clientWord || 'לקוח';
              const rDate = r.createdAt || r.date ? new Date(r.createdAt || r.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
              return (
              <View key={i} style={[s.reviewCard, { marginTop: 10 }]}>
                <View style={s.reviewTop}>
                    <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                      <T style={s.reviewName}>{rName}</T>
                      {!!rDate && <T style={{ fontSize: 11, color: C.textSub }}>{rDate}</T>}
                    </View>
                    <Stars rating={r.stars} size={12} />
                  </View>
                </View>
                <T style={s.reviewText}>{r.text}</T>
              </View>
              );
            })}
            {reviewsToShow.length > 3 && (
              <TouchableOpacity style={s.allReviewsBtn} onPress={() => setShowReviews(true)}>
                <T style={s.allReviewsBtnText}>{t.allReviewsPrefix} ({cleaner.reviews}) ›</T>
              </TouchableOpacity>
            )}
          </View>

          {/* Portfolio gallery */}
          {cleaner.portfolio?.length > 0 && (
            <View style={s.profileSection}>
              <T style={s.profileSectionTitle}>📸 {t.portfolioTitle}</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {cleaner.portfolio.map((uri: string, i: number) => (
                    <Image
                      key={i}
                      source={{ uri }}
                      style={{ width: 100, height: 100, borderRadius: 14 }}
                      contentFit="cover"
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </ScrollView>
        <View style={[s.profileFooter, { paddingBottom: insets.bottom + 6 }]}>
          <TouchableOpacity style={s.footerChat} onPress={() => { onClose(); onChat(cleaner); }}>
            <T style={s.footerChatText}>{t.chatBtn}</T>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.footerBook, !cleaner.available && { backgroundColor: C.blueBorder }]}
            disabled={!cleaner.available}
            onPress={() => { onClose(); onBook(cleaner); }}>
            <T style={s.footerBookText}>{cleaner.available ? t.bookNowBtn : t.notAvailBtn}</T>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ReviewsModal cleaner={cleaner} visible={showReviews} onClose={() => setShowReviews(false)} />
    </Modal>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, visible, type = 'success' }: { msg: string; visible: boolean; type?: 'success' | 'error' | 'info' }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(translateY,  { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY,  { toValue: 20, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const bg = type === 'error' ? '#EF4444' : type === 'info' ? '#2563EB' : '#10B981';
  const icon = type === 'error' ? '✕' : type === 'info' ? 'ℹ️' : '✓';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', bottom: insets.bottom + 70, left: 20, right: 20, zIndex: 9999,
        backgroundColor: bg, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
        flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 12,
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10,
        opacity, transform: [{ translateY }],
      }}
    >
      <T style={{ fontSize: 16, color: '#fff' }}>{icon}</T>
      <T style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#fff', textAlign: 'right' }}>{msg}</T>
    </Animated.View>
  );
}

// ─── Animated Star Picker ─────────────────────────────────────────────────────
function AnimatedStarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const C = useAppColors();
  const scales = useRef([...Array(5)].map(() => new Animated.Value(1))).current;
  const handlePress = (i: number) => {
    onChange(i + 1);
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 1.5, duration: 150, useNativeDriver: true }),
      Animated.spring(scales[i],  { toValue: 1,   useNativeDriver: true }),
    ]).start();
  };
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
      {[0,1,2,3,4].map(i => (
        <TouchableOpacity key={i} onPress={() => handlePress(i)}>
          <Animated.Text style={{ fontSize: 36, color: i < value ? C.gold : C.grayBorder, transform: [{ scale: scales[i] }] }}>★</Animated.Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Hourglass Animation ─────────────────────────────────────────────────────
function HourglassIcon() {
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setFlip(f => !f), 700);
    return () => clearInterval(t);
  }, []);
  return <T style={{ fontSize: 22 }}>{flip ? '⌛' : '⏳'}</T>;
}

// ─── Address Autocomplete (OpenStreetMap Nominatim — חינמי, ללא מפתח) ─────────
function AddressAutocomplete({ value, onChange, placeholder, onFocus, error }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onFocus?: () => void; error?: boolean;
}) {
  const C = useAppColors();
  const s = createS(C);
  const acStyles = StyleSheet.create({
    dropdown:  { position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.blueBorder, elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, zIndex: 9999 },
    row:       { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.grayBg },
    main:      { fontSize: 14, fontWeight: '700', color: C.textDark, textAlign: 'right' },
    secondary: { fontSize: 12, color: C.textSub, textAlign: 'right', marginTop: 2 },
  });
  const [suggestions, setSuggestions] = useState<{ id: string; main: string; secondary: string }[]>([]);
  const [showSugg,    setShowSugg]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&countrycodes=il&limit=6&addressdetails=1&accept-language=he`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'A&M CleanApp/1.0' },
        });
        const json = await res.json();
        if (json && json.length > 0) {
          setSuggestions(json.map((p: any, i: number) => {
            const addr = p.address || {};
            const road    = addr.road || addr.pedestrian || '';
            const houseNo = addr.house_number || '';
            const city    = addr.city || addr.town || addr.village || addr.municipality || '';
            const main    = road ? (houseNo ? `${road} ${houseNo}` : road) : p.display_name.split(',')[0];
            const secondary = city || p.display_name.split(',').slice(1, 3).join(',').trim();
            return { id: String(i), main, secondary };
          }));
          setShowSugg(true);
        } else {
          setSuggestions([]); setShowSugg(false);
        }
      } catch { setSuggestions([]); setShowSugg(false); }
    }, 500);
  };

  const handleChange = (text: string) => {
    onChange(text);
    fetchSuggestions(text);
  };

  const select = (item: { main: string; secondary: string }) => {
    const full = item.secondary ? `${item.main}, ${item.secondary}` : item.main;
    onChange(full);
    setSuggestions([]); setShowSugg(false);
  };

  return (
    <View style={{ position: 'relative', zIndex: 999 }}>
      <TextInput
        style={[s.input, { textAlign: 'right' }, error && { borderColor: '#DC2626', borderWidth: 1.5 }]}
        placeholder={placeholder ?? 'הכנס כתובת'}
        placeholderTextColor={C.textSub}
        value={value}
        onChangeText={handleChange}
        onFocus={onFocus}
        onBlur={() => setTimeout(() => { setSuggestions([]); setShowSugg(false); }, 200)}
      />
      {showSugg && suggestions.length > 0 && (
        <View style={acStyles.dropdown}>
          {suggestions.slice(0, 6).map(item => (
            <TouchableOpacity key={item.id} style={acStyles.row} onPress={() => select(item)}>
              <T style={acStyles.main}>{item.main}</T>
              {!!item.secondary && <T style={acStyles.secondary} numberOfLines={1}>{item.secondary}</T>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Booking modal ───────────────────────────────────────────────────────────
// ─── Calendar Picker ─────────────────────────────────────────────────────────
const DAYS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function CalendarPicker({ visible, value, onChange, onClose }: {
  visible: boolean; value: Date; onChange: (d: Date) => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const today = new Date(); today.setHours(0,0,0,0);
  const [viewYear,  setViewYear]  = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // build grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const selY = value.getFullYear(), selM = value.getMonth(), selD = value.getDate();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:20 }}>
        <TouchableOpacity style={{ position:'absolute', top:0, left:0, right:0, bottom:0 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor:'#fff', borderRadius:20, padding:20, width:'100%', maxWidth:360,
              shadowColor:'#000', shadowOpacity:0.2, shadowRadius:12, elevation:10 }}>

            {/* Header */}
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <TouchableOpacity onPress={prevMonth} style={{ padding:8 }}>
                <T style={{ fontSize:20, color:'#2563EB', fontWeight:'900' }}>‹</T>
              </TouchableOpacity>
              <T style={{ fontSize:17, fontWeight:'900', color:'#1E3A5F' }}>
                {MONTHS_HE[viewMonth]} {viewYear}
              </T>
              <TouchableOpacity onPress={nextMonth} style={{ padding:8 }}>
                <T style={{ fontSize:20, color:'#2563EB', fontWeight:'900' }}>›</T>
              </TouchableOpacity>
            </View>

            {/* Day names */}
            <View style={{ flexDirection:'row', marginBottom:6 }}>
              {DAYS_HE.map(d => (
                <View key={d} style={{ flex:1, alignItems:'center' }}>
                  <T style={{ fontSize:12, fontWeight:'700', color:'#94A3B8' }}>{d}</T>
                </View>
              ))}
            </View>

            {/* Grid */}
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} style={{ flexDirection:'row', marginBottom:4 }}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (!day) return <View key={col} style={{ flex:1 }} />;
                  const cellDate = new Date(viewYear, viewMonth, day);
                  cellDate.setHours(0,0,0,0);
                  const isPast     = cellDate < today;
                  const isSelected = day === selD && viewMonth === selM && viewYear === selY;
                  const isToday    = cellDate.getTime() === today.getTime();
                  return (
                    <TouchableOpacity key={col} disabled={isPast}
                      onPress={() => { onChange(new Date(viewYear, viewMonth, day)); onClose(); }}
                      style={{ flex:1, aspectRatio:1, alignItems:'center', justifyContent:'center',
                        borderRadius:100,
                        backgroundColor: isSelected ? '#2563EB' : isToday ? '#EFF6FF' : 'transparent' }}>
                      <T style={{ fontSize:14, fontWeight: isSelected || isToday ? '900' : '400',
                        color: isPast ? '#CBD5E1' : isSelected ? '#fff' : isToday ? '#2563EB' : '#1E3A5F' }}>
                        {day}
                      </T>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Close */}
            <TouchableOpacity onPress={onClose}
              style={{ marginTop:14, backgroundColor:'#F1F5F9', borderRadius:12, padding:12, alignItems:'center' }}>
              <T style={{ color:'#64748B', fontWeight:'700' }}>{t.closeBtn}</T>
            </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Multi-Date Calendar (בחירת מספר תאריכים להזמנה חוזרת) ──────────────────
function MultiCalendarPicker({ selected, onChange, label }: {
  selected: string[]; onChange: (dates: string[]) => void; label: string;
}) {
  const { t } = useLanguage();
  const today = new Date(); today.setHours(0,0,0,0);
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [open, setOpen] = useState(false);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDay   = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const toggle = (day: number) => {
    const key = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (selected.includes(key)) onChange(selected.filter(d => d !== key));
    else onChange([...selected, key].sort());
  };

  const fmtDateKey = (key: string) => {
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  };

  return (
    <View>
      {/* כפתור פתיחה */}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: open ? '#2563EB' : '#F1F5F9', borderRadius: 12, padding: 12,
          borderWidth: 1, borderColor: open ? '#2563EB' : '#B5D4F4' }}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: open ? '#fff' : '#042C53' }}>
          📅 {label}{selected.length > 0 ? ` (${selected.length})` : ''}
        </Text>
        <Text style={{ fontSize: 16, color: open ? '#fff' : '#6B9DC2' }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* תאריכים שנבחרו */}
      {selected.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selected.map(k => (
            <TouchableOpacity key={k}
              style={{ backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
                borderWidth: 1, borderColor: '#2563EB', flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={() => onChange(selected.filter(d => d !== k))}
            >
              <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '700' }}>{fmtDateKey(k)}</Text>
              <Text style={{ fontSize: 11, color: '#2563EB' }}>✕</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={{ backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}
            onPress={() => onChange([])}
          >
            <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700' }}>{t.clearAll}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* לוח שנה */}
      {open && (
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 8,
          borderWidth: 1, borderColor: '#E2EAF3',
          shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 }}>

          {/* ניווט חודש */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
              <Text style={{ fontSize: 22, color: '#2563EB', fontWeight: '900' }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#1E3A5F' }}>
              {MONTHS_HE[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
              <Text style={{ fontSize: 22, color: '#2563EB', fontWeight: '900' }}>›</Text>
            </TouchableOpacity>
          </View>

          {/* שמות ימים */}
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {DAYS_HE.map(d => (
              <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* גריד */}
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row', marginBottom: 2 }}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (!day) return <View key={col} style={{ flex: 1 }} />;
                const cellDate = new Date(viewYear, viewMonth, day);
                cellDate.setHours(0,0,0,0);
                const isPast = cellDate < today;
                const key = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const isSel  = selected.includes(key);
                const isToday2 = cellDate.getTime() === today.getTime();
                return (
                  <TouchableOpacity key={col} disabled={isPast}
                    onPress={() => toggle(day)}
                    style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
                      borderRadius: 100,
                      backgroundColor: isSel ? '#2563EB' : isToday2 ? '#EFF6FF' : 'transparent',
                      margin: 1 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: isSel || isToday2 ? '900' : '400',
                      color: isPast ? '#CBD5E1' : isSel ? '#fff' : isToday2 ? '#2563EB' : '#1E3A5F' }}>
                      {day}
                    </Text>
                    {isSel && (
                      <View style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: '#93C5FD' }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* כפתור סגירה */}
          <TouchableOpacity onPress={() => setOpen(false)}
            style={{ marginTop: 12, backgroundColor: '#2563EB', borderRadius: 12, padding: 11, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              {selected.length > 0 ? `✓ אישור (${selected.length} תאריכים)` : 'סגור'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Spinner Picker (+/−) ─────────────────────────────────────────────────────
function SpinnerPicker({ value, onChange, values, display }: {
  value: number; onChange: (v: number) => void; values: number[]; display?: (v: number) => string;
}) {
  const idx = values.indexOf(value);
  const dec = () => { if (idx > 0) onChange(values[idx - 1]); };
  const inc = () => { if (idx < values.length - 1) onChange(values[idx + 1]); };
  const label = display ? display(value) : String(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0, alignSelf: 'center',
      backgroundColor: '#F1F5F9', borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: '#2563EB' }}>
      <TouchableOpacity onPress={dec} disabled={idx === 0}
        style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: idx === 0 ? '#E2E8F0' : '#EDE9FE' }}>
        <T style={{ fontSize: 22, fontWeight: '900', color: idx === 0 ? '#CBD5E1' : '#7C3AED' }}>−</T>
      </TouchableOpacity>
      <View style={{ paddingHorizontal: 28, paddingVertical: 14, backgroundColor: '#fff', minWidth: 90, alignItems: 'center' }}>
        <T style={{ fontSize: 26, fontWeight: '900', color: '#2563EB' }}>{label}</T>
      </View>
      <TouchableOpacity onPress={inc} disabled={idx === values.length - 1}
        style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: idx === values.length - 1 ? '#E2E8F0' : '#EDE9FE' }}>
        <T style={{ fontSize: 22, fontWeight: '900', color: idx === values.length - 1 ? '#CBD5E1' : '#7C3AED' }}>+</T>
      </TouchableOpacity>
    </View>
  );
}

function TimeWheelPicker({ value, onChange, minHour = 7, maxHour = 23.5 }: { value: number; onChange: (v: number) => void; minHour?: number; maxHour?: number }) {
  const timeValues: number[] = Array.from({ length: 34 }, (_, i) => 7 + i * 0.5).filter(h => h >= minHour && h <= maxHour);
  const display = (v: number) => {
    const hh = String(Math.floor(v)).padStart(2, '0');
    const mm = v % 1 === 0.5 ? '30' : '00';
    return `${hh}:${mm}`;
  };
  return <SpinnerPicker value={value} onChange={onChange} values={timeValues} display={display} />;
}

function HoursWheelPicker({ value, onChange, values }: { value: number; onChange: (v: number) => void; values: number[] }) {
  return <SpinnerPicker value={value} onChange={onChange} values={values} display={v => `${v} ש'`} />;
}

// ─── InlineBookingChat — צ'אט מוטבע במסך המתנה / אישור ─────────────────────
function InlineBookingChat({ open, onToggle, messages, text, onChangeText, onSend, scrollRef, clientUid, accentColor, bgColor, borderColor, onSendImage, onStartRecording, onStopRecording, isRecording }: {
  open: boolean;
  onToggle: () => void;
  messages: any[];
  text: string;
  onChangeText: (v: string) => void;
  onSend: () => void;
  scrollRef: React.RefObject<ScrollView | null>;
  clientUid: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  onSendImage?: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecording?: boolean;
}) {
  const { t } = useLanguage();
  const unreadCount = messages.filter(m => m.fromUid !== clientUid).length;

  return (
    <View style={{ width: '100%', borderRadius: 18, borderWidth: 1.5, borderColor, overflow: 'hidden', marginBottom: 4 }}>
      {/* Header — toggle */}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: bgColor, paddingHorizontal: 16, paddingVertical: 13 }}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T style={{ fontSize: 20 }}>💬</T>
          <T style={{ fontSize: 15, fontWeight: '800', color: accentColor }}>{t.questionForCleaner}</T>
          {messages.length > 0 && (
            <View style={{ backgroundColor: accentColor, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
              <T style={{ fontSize: 11, color: '#fff', fontWeight: '800' }}>{messages.length}</T>
            </View>
          )}
        </View>
        <T style={{ fontSize: 18, color: accentColor }}>{open ? '▲' : '▼'}</T>
      </TouchableOpacity>

      {/* Chat body */}
      {open && (
        <View style={{ backgroundColor: '#FFFFFF' }}>
          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={{ maxHeight: 220 }}
            contentContainerStyle={{ padding: 12, gap: 6 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <T style={{ fontSize: 28, marginBottom: 6 }}>👋</T>
                <T style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
                  שלח הודעה למנקה — הוא/היא יענה בהקדם
                </T>
              </View>
            ) : (
              messages.map(m => {
                const isMe = m.fromUid === clientUid;
                if (m.type === 'bit_payment') return null;
                // תמונה
                if (m.type === 'image') {
                  const uri = m.imageBase64 || m.imageUrl;
                  return (
                    <View key={m.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      <Image source={{ uri }} style={{ width: 150, height: 112, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }} contentFit="cover" />
                    </View>
                  );
                }
                return (
                  <View key={m.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <View style={{
                      maxWidth: '78%',
                      backgroundColor: isMe ? accentColor : '#F3F4F6',
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}>
                      <T style={{ fontSize: 13, color: isMe ? '#fff' : '#1F2937', lineHeight: 18 }}>
                        {m.type === 'audio' ? '🎤 הודעה קולית' : m.text}
                      </T>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Input row */}
          <KeyboardAvoidingView behavior="padding">
            <View style={{ flexDirection: 'row', gap: 6, padding: 10, borderTopWidth: 1, borderColor: '#F3F4F6', alignItems: 'center' }}>
              <TouchableOpacity
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: accentColor, alignItems: 'center', justifyContent: 'center' }}
                onPress={onSend}
              >
                <T style={{ color: '#fff', fontSize: 16 }}>◀</T>
              </TouchableOpacity>
              <TextInput
                style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB' }}
                placeholder={t.chatInputPh}
                value={text}
                onChangeText={onChangeText}
                placeholderTextColor="#9CA3AF"
                textAlign="right"
                onSubmitEditing={onSend}
                returnKeyType="send"
              />
              {/* תמונה */}
              {onSendImage && (
                <TouchableOpacity
                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', alignItems: 'center', justifyContent: 'center' }}
                  onPress={onSendImage}
                >
                  <T style={{ fontSize: 18 }}>📷</T>
                </TouchableOpacity>
              )}
              {/* הקלטה קולית — לחיצה ארוכה */}
              {onStartRecording && onStopRecording && (
                <TouchableOpacity
                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isRecording ? '#EF4444' : '#25D366', alignItems: 'center', justifyContent: 'center' }}
                  onPressIn={onStartRecording}
                  onPressOut={onStopRecording}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="mic" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}

// ─── Address management helpers ──────────────────────────────────────────────
const ADDRESSES_KEY = 'saved_addresses';
const MAX_ADDRESSES = 5;

export type SavedAddress = {
  id: string;
  address: string;      // full formatted string (computed)
  city: string;
  street: string;       // רחוב + מספר בית
  floor: string;
  apt: string;
  isPrivate: boolean;   // בית פרטי
  isPrimary: boolean;
  lastUsed: string;
  lat?: number;
  lng?: number;
};

export function buildFullAddress(city: string, street: string, floor: string, apt: string, isPrivate: boolean): string {
  const parts: string[] = [];
  if (street.trim()) parts.push(street.trim());
  if (city.trim()) parts.push(city.trim());
  if (isPrivate) { parts.push('בית פרטי'); }
  else { if (floor.trim()) parts.push(`קומה ${floor.trim()}`); if (apt.trim()) parts.push(`דירה ${apt.trim()}`); }
  return parts.join(', ');
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  try {
    const raw = await SecureStore.getItemAsync(ADDRESSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function upsertStructuredAddress(fields: Omit<SavedAddress, 'id' | 'isPrimary' | 'lastUsed'>): Promise<void> {
  if (!fields.address.trim()) return;
  const addrs = await getSavedAddresses();
  const existing = addrs.find(a => a.address === fields.address);
  if (existing) {
    Object.assign(existing, fields, { lastUsed: new Date().toISOString() });
  } else {
    const isFirst = addrs.length === 0;
    addrs.unshift({ ...fields, id: Date.now().toString(), isPrimary: isFirst, lastUsed: new Date().toISOString() });
    if (addrs.length > MAX_ADDRESSES) addrs.pop();
  }
  await SecureStore.setItemAsync(ADDRESSES_KEY, JSON.stringify(addrs));
}

// backward-compat
export async function upsertAddress(address: string): Promise<void> {
  await upsertStructuredAddress({ address, city: '', street: address, floor: '', apt: '', isPrivate: false });
}

export async function setPrimaryAddress(id: string): Promise<void> {
  const addrs = await getSavedAddresses();
  addrs.forEach(a => { a.isPrimary = a.id === id; });
  await SecureStore.setItemAsync(ADDRESSES_KEY, JSON.stringify(addrs));
}

export async function deleteAddressById(id: string): Promise<void> {
  const addrs = await getSavedAddresses();
  const wasDefault = addrs.find(a => a.id === id)?.isPrimary ?? false;
  const filtered = addrs.filter(a => a.id !== id);
  if (wasDefault && filtered.length > 0) filtered[0].isPrimary = true;
  await SecureStore.setItemAsync(ADDRESSES_KEY, JSON.stringify(filtered));
}

// ─── AddressPicker component ──────────────────────────────────────────────────
function AddressPicker({ selectedId, onSelect, savedAddresses }: {
  selectedId: string;
  onSelect: (a: SavedAddress) => void;
  savedAddresses: SavedAddress[];
}) {
  const C = useAppColors();
  const { t } = useLanguage();
  if (savedAddresses.length === 0) return null;
  return (
    <View style={{ gap: 6, marginBottom: 8 }}>
      <T style={{ fontSize: 12, color: C.textSub, fontWeight: '600', textAlign: 'right' }}>{t.savedAddrLabel}</T>
      {/* רשימה אנכית ברוחב מלא — הכתובת המלאה נראית, בלי חיתוך */}
      <View style={{ gap: 6 }}>
        {savedAddresses.map(a => {
          const isSelected = selectedId === a.id;
          return (
            <TouchableOpacity
              key={a.id}
              onPress={() => onSelect(a)}
              style={{
                flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
                backgroundColor: isSelected ? C.blue : C.white,
                borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9,
                borderWidth: 1.5, borderColor: isSelected ? C.blue : C.blueBorder,
              }}
            >
              {a.isPrimary && <T style={{ fontSize: 12 }}>⭐</T>}
              <T style={{ flex: 1, fontSize: 12.5, fontWeight: '600', textAlign: 'right', color: isSelected ? C.white : C.textDark }} numberOfLines={2}>{a.address}</T>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function BookingModal({ cleaner, visible, onClose, onBookingCreated, prebookData }: any) {
  const { t, lang }  = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bookingScrollRef = useRef<ScrollView>(null);
  const [hours,          setHours]          = useState(2);
  const [payment,        setPayment]        = useState('cash');
  const [saving,         setSaving]         = useState(false);
  const bookingLock = useRef(false);   // מנעול סינכרוני נגד לחיצה כפולה מהירה (הזמנה כפולה)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  // ── שדות כתובת מובנים ───────────────────────────────────────────────────
  const [addrCity,       setAddrCity]       = useState('');
  const [addrStreet,     setAddrStreet]     = useState('');
  const [addrFloor,      setAddrFloor]      = useState('');
  const [addrApt,        setAddrApt]        = useState('');
  const [addrPrivate,    setAddrPrivate]    = useState(false);
  const [selectedAddrId, setSelectedAddrId] = useState('');
  const [addrEditMode,   setAddrEditMode]   = useState(false); // false = הצג סיכום כתובת ראשית; true = עריכה/בחירה
  const [detectingLoc,   setDetectingLoc]   = useState(false);

  const fillFromSaved = (a: SavedAddress) => {
    setSelectedAddrId(a.id);
    setAddrCity(a.city || '');
    setAddrStreet(a.street || a.address || '');
    setAddrFloor(a.floor || '');
    setAddrApt(a.apt || '');
    setAddrPrivate(a.isPrivate || false);
  };

  const detectMyLocation = async () => {
    setDetectingLoc(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { Alert.alert(t.error, t.locationPermDenied); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const addrs = await getSavedAddresses();
      // geocode any address that doesn't have coordinates yet
      for (const a of addrs) {
        if (!a.lat || !a.lng) {
          try {
            const geo = await Location.geocodeAsync(a.address);
            if (geo[0]) { a.lat = geo[0].latitude; a.lng = geo[0].longitude; }
          } catch (_) {}
        }
      }
      await SecureStore.setItemAsync(ADDRESSES_KEY, JSON.stringify(addrs));
      // find nearest saved address
      let nearest: SavedAddress | null = null;
      let minDist = Infinity;
      for (const a of addrs) {
        if (!a.lat || !a.lng) continue;
        const dist = getDistanceMeters(loc.coords.latitude, loc.coords.longitude, a.lat, a.lng);
        if (dist < minDist) { minDist = dist; nearest = a; }
      }
      if (nearest && minDist < 300) {
        fillFromSaved(nearest);
        Alert.alert(t.nearestAddressFound, nearest.address);
      } else {
        // reverse geocode → fill fields automatically
        const rev = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (rev[0]) {
          setAddrCity(rev[0].city || rev[0].subregion || '');
          setAddrStreet(`${rev[0].street || ''} ${rev[0].streetNumber || ''}`.trim());
          setSelectedAddrId('');
        } else {
          Alert.alert(t.error, t.locationNotFound);
        }
      }
    } catch (_) {
      Alert.alert(t.error, t.locationError);
    } finally {
      setDetectingLoc(false);
    }
  };

  // ── Load saved addresses + primary ───────────────────────────────────────
  useEffect(() => {
    getSavedAddresses().then(addrs => {
      setSavedAddresses(addrs);

      if (prebookData) {
        // הזמנה חוזרת — מלא מהנתונים הקיימים בהזמנה
        if (prebookData.addrCity || prebookData.addrStreet) {
          setAddrCity(prebookData.addrCity || '');
          setAddrStreet(prebookData.addrStreet || '');
          setAddrFloor(prebookData.addrFloor || '');
          setAddrApt(prebookData.addrApt || '');
          setAddrPrivate(prebookData.addrPrivate || false);
          setSelectedAddrId('');
        } else if (prebookData.address) {
          // הזמנה ישנה ללא שדות מבניים — נחפש בכתובות שמורות
          const matched = addrs.find(a => a.address === prebookData.address);
          if (matched) {
            fillFromSaved(matched);
          } else {
            // fallback — רחוב הוא כל מה שלפני הפסיק האחרון, עיר — מה שאחריו
            const parts = prebookData.address.split(', ');
            setAddrCity(parts.length > 1 ? parts[parts.length - 1] : '');
            setAddrStreet(parts.length > 1 ? parts.slice(0, -1).join(', ') : prebookData.address);
          }
        }
      } else {
        const primary = addrs.find(a => a.isPrimary) || addrs[0];
        if (primary) { fillFromSaved(primary); setAddrEditMode(false); }
        else setAddrEditMode(true);
      }

      SecureStore.getItemAsync('last_payment_method').then(p => { if (p) setPayment(p); }).catch(() => {});
    }).catch(() => {});
  }, [prebookData]);
  const [bookingDate,   setBookingDate]   = useState<Date>(new Date());
  const [showDatePicker,setShowDatePicker]= useState(false);
  const [startHour,     setStartHour]     = useState(9);
  const [recurring,     setRecurring]     = useState<'once' | 'weekly' | 'monthly'>('once');
  const [recurringDates, setRecurringDates] = useState<string[]>([]);
  const [serviceTypes,  setServiceTypes]  = useState<string[]>([]);
  const toggleServiceType = (tp: string) => setServiceTypes(prev => prev.includes(tp) ? prev.filter(x => x !== tp) : [...prev, tp]);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [showSuccess,   setShowSuccess]   = useState(false);
  const [bookedDetails, setBookedDetails] = useState<{ name: string; hours: number; total: number; cleanerUid: string; startTime: string; dateStr: string; address: string } | null>(null);
  const [showWaiting,   setShowWaiting]   = useState(false);

  // ── Inline chat (waiting / success screens) ──────────────────────────────
  const [inlineChatOpen,    setInlineChatOpen]    = useState(false);
  const [inlineChatMsgs,    setInlineChatMsgs]    = useState<any[]>([]);
  const [inlineChatText,    setInlineChatText]    = useState('');
  const inlineChatScroll    = useRef<ScrollView>(null);
  const inlineChatUnsubRef  = useRef<(() => void) | null>(null);
  const prevInlineMsgCount  = useRef(0);
  const inlineRecorder      = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [inlineRecording,   setInlineRecording]   = useState(false);

  // ── חישוב שעה מינימלית (היום בלבד) ──────────────────────────────────────
  const isToday = bookingDate.toDateString() === new Date().toDateString();
  const calcMinHour = () => {
    if (!isToday) return 7;
    const now = new Date();
    // עגל למעלה ל-30 הדקות הבאות + חצי שעה מרווח
    const mins = now.getHours() * 60 + now.getMinutes();
    const nextSlotMins = Math.ceil((mins + 30) / 30) * 30; // slot הבא עם 30 דקות קדימה
    return Math.max(7, nextSlotMins / 60);
  };
  const minHour = calcMinHour();

  // ── כשמשנים תאריך — עדכן שעה אם צריך ──────────────────────────────────
  useEffect(() => {
    const mh = calcMinHour();
    if (startHour < mh) setStartHour(mh);
  }, [bookingDate]);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const unsubBookingRef = useRef<(() => void) | null>(null);

  // Dynamic pricing: if cleaner has servicePricing, use it; else use cleaner.price
  const effectivePrice = cleaner
    ? (() => {
        const prices = serviceTypes.map(st => cleaner.servicePricing?.[st]).filter((p: any) => p != null) as number[];
        return prices.length ? Math.max(...prices) : cleaner.price;
      })()
    : 0;
  const total   = effectivePrice * hours;
  const LOCALE_MAP: Record<string, string> = { he: 'he-IL', en: 'en-GB', ru: 'ru-RU', ar: 'ar-SA', fr: 'fr-FR', hi: 'hi-IN' };
  const fmtDate = (d: Date) => d.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleBook = async () => {
    if (bookingLock.current || saving) return;   // כבר בתהליך — מנע הזמנה כפולה
    if (addrEditMode) {
      // עריכה ידנית — דרוש שדות מבניים מלאים
      if (!addrStreet.trim()) return Alert.alert(t.error, t.fillStreetRequired ?? 'יש למלא רחוב ומספר בית');
      if (!/\d/.test(addrStreet)) return Alert.alert(t.error, t.addressNoNumber);
      if (!addrPrivate && !addrFloor.trim()) return Alert.alert(t.error, t.fillFloorRequired ?? 'יש למלא קומה');
      if (!addrPrivate && !addrApt.trim()) return Alert.alert(t.error, t.fillAptRequired ?? 'יש למלא מספר דירה');
    } else {
      // כתובת שמורה (סיכום) — כבר מלאה, רק ודא שקיימת
      if (!addrStreet.trim() && !addrCity.trim()) return Alert.alert(t.error, t.fillStreetRequired ?? 'יש לבחור כתובת');
    }
    const address = buildFullAddress(addrCity, addrStreet, addrFloor, addrApt, addrPrivate);

    // ── ולידציה: חובה לבחור סוג ניקיון ──────────────────────────────────
    if (serviceTypes.length === 0) {
      return Alert.alert(t.error, (t as any).selectServiceTypeMulti ?? 'יש לבחור סוג ניקיון');
    }

    // ── ולידציה: שעה לא בעבר ─────────────────────────────────────────────
    const selectedDateTime = new Date(bookingDate);
    selectedDateTime.setHours(Math.floor(startHour), startHour % 1 === 0.5 ? 30 : 0, 0, 0);
    if (selectedDateTime <= new Date()) {
      return Alert.alert(t.error, t.pastHourError);
    }

    // תאריך מקומי (לא UTC) — חייב להיות זהה לפורמט שבו ההזמנה נשמרת, אחרת הבדיקה רצה על היום הלא נכון
    const localDateStr = `${bookingDate.getFullYear()}-${String(bookingDate.getMonth()+1).padStart(2,'0')}-${String(bookingDate.getDate()).padStart(2,'0')}`;

    // כל הוולידציות הסינכרוניות עברו — נעל מיד (לפני הבדיקות האסינכרוניות)
    // כדי שלחיצה כפולה מהירה לא תיצור שתי הזמנות
    bookingLock.current = true;

    // ── ולידציה: אין חפיפת הזמנות ────────────────────────────────────────
    {
      const clientUid = auth.currentUser?.uid || '';
      const newStart = selectedDateTime;
      const newEnd   = new Date(newStart.getTime() + hours * 3600000);
      const bookingDateStr = localDateStr;
      try {
        const existingSnap = await getDocs(query(
          collection(db, 'bookings'),
          where('clientUid', '==', clientUid),
          where('bookingDate', '==', bookingDateStr),
        ));
        const hasOverlap = existingSnap.docs.some(d => {
          const ex = d.data();
          if (['cancelled', 'done'].includes(ex.status)) return false;
          const [eh, em] = (ex.startTime || '00:00').split(':').map(Number);
          const exStart = new Date(bookingDate);
          exStart.setHours(eh, em, 0, 0);
          const exEnd = new Date(exStart.getTime() + (ex.hours || 1) * 3600000);
          return newStart < exEnd && newEnd > exStart;
        });
        if (hasOverlap) {
          bookingLock.current = false;
          return Alert.alert('❌ ' + t.overlapTitle, t.overlapMsg);
        }
      } catch (_) {}
    }

    // ── ולידציה: בדיקת חפיפה מצד המנקה ──────────────────────────────────
    {
      const cleanerUid = cleaner.uid || cleaner.id;
      const newStart = selectedDateTime;
      const newEnd   = new Date(newStart.getTime() + hours * 3600000);
      const bookingDateStr = localDateStr;
      try {
        const cleanerSnap = await getDocs(query(
          collection(db, 'bookings'),
          where('cleanerId', '==', cleanerUid),
          where('bookingDate', '==', bookingDateStr),
        ));
        const cleanerOverlap = cleanerSnap.docs.some(d => {
          const ex = d.data();
          if (['cancelled', 'done'].includes(ex.status)) return false;
          const [eh, em] = (ex.startTime || '00:00').split(':').map(Number);
          const exStart = new Date(bookingDate);
          exStart.setHours(eh, em, 0, 0);
          const exEnd = new Date(exStart.getTime() + (ex.hours || 1) * 3600000);
          return newStart < exEnd && newEnd > exStart;
        });
        if (cleanerOverlap) {
          bookingLock.current = false;
          return Alert.alert('❌ ' + t.overlapTitle, t.cleanerBusyMsg ?? 'המנקה תפוס/ה בשעות אלה — נסה שעה אחרת');
        }
      } catch (_) {}
    }

    // ── שמור כתובת ותשלום אחרונים ───────────────────────────────────────
    upsertStructuredAddress({ address, city: addrCity, street: addrStreet, floor: addrFloor, apt: addrApt, isPrivate: addrPrivate }).then(() =>
      getSavedAddresses().then(setSavedAddresses)
    ).catch(() => {});
    SecureStore.setItemAsync('last_payment_method', payment).catch(() => {});

    // ── עבור מיד למסך המתנה ──────────────────────────────────────────────
    const cleanerUid = cleaner.uid || cleaner.id;
    const stH = String(Math.floor(startHour)).padStart(2, '0');
    const stM = startHour % 1 === 0.5 ? '30' : '00';
    const startTimeStr = `${stH}:${stM}`;
    const dateStr = bookingDate.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
    setBookedDetails({ name: cleaner.name, hours, total, cleanerUid, startTime: startTimeStr, dateStr, address });
    setShowWaiting(true);

    setSaving(true);
    try {
      const clientUid = auth.currentUser?.uid || '';
      let clientName = 'לקוח';
      try {
        const cliSnap = await getDoc(doc(db, 'users', clientUid));
        clientName = cliSnap.data()?.name || 'לקוח';
      } catch (_) {}
      // חשב חלון עסוק
      const busyFrom = new Date(bookingDate);
      const startHourInt = Math.floor(startHour);
      const startMin = startHour % 1 === 0.5 ? 30 : 0;
      busyFrom.setHours(startHourInt, startMin, 0, 0);
      const busyUntil = new Date(busyFrom.getTime() + hours * 3600000);
      const busyFromISO  = busyFrom.toISOString();
      const busyUntilISO = busyUntil.toISOString();

      const startHH = String(startHourInt).padStart(2, '0');
      const startMM = startMin === 30 ? '30' : '00';

      const paymentStatus = payment === 'cash' ? 'awaiting_cash' : payment === 'bit' ? 'awaiting_bit' : 'awaiting_card';
      const bookingRef = await addDoc(collection(db, 'bookings'), {
        cleanerId: cleaner.id, cleanerName: cleaner.name,
        clientUid, clientName, hours, payment, paymentStatus, address, total,
        addrCity, addrStreet, addrFloor, addrApt, addrPrivate,
        status: 'pending', createdAt: new Date().toISOString(),
        bookingDate: `${bookingDate.getFullYear()}-${String(bookingDate.getMonth()+1).padStart(2,'0')}-${String(bookingDate.getDate()).padStart(2,'0')}`,
        startTime: `${startHH}:${startMM}`,
        recurring,
        recurringDates: recurring !== 'once' ? recurringDates : [],
        serviceType: serviceTypes.join(' + '),
        serviceTypes: serviceTypes,
        pricePerHour: effectivePrice,
        busyFrom: busyFromISO,
        busyUntil: busyUntilISO,
      });

      // ── שמור bookingId והאזן לשינוי סטטוס ───────────────────────────────
      setPendingBookingId(bookingRef.id);
      setSaving(false);
      bookingLock.current = false;
      // עדכן existingBookings כדי שבדיקת חפיפה תעבוד מיידית
      onBookingCreated?.(cleaner.id, {
        id: bookingRef.id, status: 'pending', cleanerName: cleaner.name,
        busyFrom: busyFromISO, busyUntil: busyUntilISO, hours,
        startTime: `${startHH}:${startMM}`,
      });

      // ── האזן לשינוי סטטוס (אישור מנקה) ──────────────────────────────────
      if (unsubBookingRef.current) unsubBookingRef.current();
      unsubBookingRef.current = onSnapshot(doc(db, 'bookings', bookingRef.id), (snap) => {
        const status = snap.data()?.status;
        if (status === 'confirmed' || status === 'active') {
          if (unsubBookingRef.current) { unsubBookingRef.current(); unsubBookingRef.current = null; }
          setShowWaiting(false);
          setShowSuccess(true);
        }
        if (status === 'cancelled') {
          if (unsubBookingRef.current) { unsubBookingRef.current(); unsubBookingRef.current = null; }
          setShowWaiting(false);
        }
      });
      // הוסף ל-busySlots של המנקה
      await setDoc(doc(db, 'users', cleaner.id), {
        busySlots: arrayUnion({ from: busyFromISO, until: busyUntilISO }),
      }, { merge: true }).catch(() => {});
      try {
        const cleanerUid = cleaner.uid || cleaner.id;
        const cleanerDoc = await getDoc(doc(db, 'users', cleanerUid));
        const pushToken = cleanerDoc.data()?.pushToken;
        const svcLabel = serviceTypes.map(st => String(t.types[st] || st).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '').trim()).filter(Boolean).join(', ');
        const timeLabel = `${String(Math.floor(startHour)).padStart(2,'0')}:${startHour % 1 === 0.5 ? '30' : '00'}`;
        if (pushToken) await sendPushNotification(
          pushToken,
          `📅 הזמנה חדשה מ-${clientName}!`,
          `${svcLabel ? svcLabel + ' · ' : ''}📅 ${bookingDate.toLocaleDateString(LOCALE_MAP[lang] || 'he-IL')} ${timeLabel} · ⏱️ ${hours} שעות · 📍 ${address}`,
          { type: 'new_booking', bookingId: bookingRef.id, tab: 'bookings' }
        );
      } catch (_) {}
      // ── Bit payment message in chat ────────────────────────────────────
      if (payment === 'bit') {
        try {
          const cleanerDoc = await getDoc(doc(db, 'users', cleaner.uid || cleaner.id));
          const cleanerPhone = (cleanerDoc.data()?.phone || '').replace(/[^0-9]/g, '');
          const bitChatId = [clientUid, cleaner.uid || cleaner.id].sort().join('_');
          const bitLink = cleanerPhone
            ? `https://bitpay.co.il/?amount=${total}&phone=${cleanerPhone}`
            : `https://bitpay.co.il/?amount=${total}`;
          await addDoc(collection(db, 'chats', bitChatId, 'messages'), {
            type: 'bit_payment',
            amount: total,
            bitLink,
            senderUid: clientUid,
            fromUid: clientUid,
            from: 'client',
            createdAt: new Date().toISOString(),
            bookingId: bookingRef.id,
          });
          await setDoc(doc(db, 'chats', bitChatId), {
            participants: [clientUid, cleaner.uid || cleaner.id],
            lastMessage: `💙 בקשת תשלום ₪${total} ב-Bit`,
            lastMessageAt: new Date().toISOString(),
          }, { merge: true });
        } catch (_) {}
      }
      // ── Schedule day-before local reminder ──────────────────────────────
      try {
         
        const Notifs = require('expo-notifications');
        Notifs.setNotificationHandler({
          handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
        });
        const { status } = await Notifs.requestPermissionsAsync();
        if (status === 'granted') {
          const reminderDate = new Date(bookingDate);
          reminderDate.setDate(reminderDate.getDate() - 1);
          reminderDate.setHours(10, 0, 0, 0);
          if (reminderDate > new Date()) {
            await Notifs.scheduleNotificationAsync({
              content: {
                title: `🧹 ניקיון מחר — ${cleaner.name}`,
                body:  `מחר ב-${startTimeStr} · ${address}`,
                sound: true,
              },
              trigger: { date: reminderDate } as any,
            });
          }
        }
      } catch (_) {}
      onBookingCreated?.(cleaner.id);
    } catch (err: any) {
      setSaving(false);
      bookingLock.current = false;
      setShowWaiting(false);
      setBookedDetails(null);
      Alert.alert(t.error, t.bookingCreateError ?? 'שגיאה ביצירת ההזמנה — נסה שוב');
    }
  };

  // ── Subscribe inline chat when waiting/success ──────────────────────────
  useEffect(() => {
    const shouldListen = (showWaiting || showSuccess) && bookedDetails?.cleanerUid;
    if (!shouldListen) return;
    const clientUid = auth.currentUser?.uid || '';
    const chatId = [clientUid, bookedDetails!.cleanerUid].sort().join('_');
    // סמן כנקרא — הסר uid מ-unreadBy
    updateDoc(doc(db, 'chats', chatId), { unreadBy: arrayRemove(clientUid) }).catch(() => {});
    if (inlineChatUnsubRef.current) inlineChatUnsubRef.current();
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    prevInlineMsgCount.current = 0;
    inlineChatUnsubRef.current = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setInlineChatMsgs(msgs);
      // פתח ורענן תמיד כשמגיעה הודעה חדשה (מכל צד)
      if (msgs.length > prevInlineMsgCount.current) {
        setInlineChatOpen(true);
        setTimeout(() => inlineChatScroll.current?.scrollToEnd({ animated: true }), 80);
      }
      prevInlineMsgCount.current = msgs.length;
    }, () => {});
    return () => { if (inlineChatUnsubRef.current) inlineChatUnsubRef.current(); };
  }, [showWaiting, showSuccess, bookedDetails?.cleanerUid]);

  const sendInlineChat = async () => {
    const msg = inlineChatText.trim();
    if (!msg || !bookedDetails?.cleanerUid) return;
    const clientUid = auth.currentUser?.uid || '';
    const chatId = [clientUid, bookedDetails.cleanerUid].sort().join('_');
    setInlineChatText('');
    setInlineChatOpen(true);   // פתח את הפאנל כדי שיראה את ההודעה
    setTimeout(() => inlineChatScroll.current?.scrollToEnd({ animated: true }), 150);
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: msg, from: 'client', fromUid: clientUid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        participants: [clientUid, bookedDetails.cleanerUid].sort(),
        lastMessage: msg,
        lastMessageAt: new Date().toISOString(),
        unreadBy: arrayUnion(bookedDetails.cleanerUid),
      }, { merge: true });
      setTimeout(() => inlineChatScroll.current?.scrollToEnd({ animated: true }), 200);
      try {
        const cleanerDoc = await getDoc(doc(db, 'users', bookedDetails.cleanerUid));
        const pushToken = cleanerDoc.data()?.pushToken;
        const clientDoc = await getDoc(doc(db, 'users', clientUid));
        const clientName = clientDoc.data()?.name || 'לקוח';
        if (pushToken) sendPushNotification(pushToken, `💬 הודעה מ-${clientName}`, msg, { type: 'message' });
      } catch (_) {}
    } catch (_) {}
  };

  // שליחת תמונה בצ'אט המוטמע
  const sendInlineImage = async () => {
    if (!bookedDetails?.cleanerUid) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(t.error, t.galleryPermDenied);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1, base64: false, exif: false });
    if (res.canceled || !res.assets[0]) return;
    let base64Data: string | null | undefined;
    try {
      for (const st of [{ width: 1080, compress: 0.5 }, { width: 900, compress: 0.4 }, { width: 720, compress: 0.35 }]) {
        const out = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: st.width } }], { compress: st.compress, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        base64Data = out.base64;
        if (base64Data && base64Data.length <= 700_000) break;
      }
    } catch (_) { return Alert.alert(t.error, t.imageReadError); }
    if (!base64Data) return Alert.alert(t.error, t.imageReadError);
    if (base64Data.length > 700_000) return Alert.alert(t.imageTooLargeTitle, t.imageTooLargeMsg);
    const clientUid = auth.currentUser?.uid || '';
    const otherUid = bookedDetails.cleanerUid;
    const chatId = [clientUid, otherUid].sort().join('_');
    setInlineChatOpen(true);
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), { type: 'image', imageBase64: `data:image/jpeg;base64,${base64Data}`, from: 'client', fromUid: clientUid, createdAt: new Date().toISOString() });
      await setDoc(doc(db, 'chats', chatId), { participants: [clientUid, otherUid].sort(), lastMessage: t.chatImageMsg, lastMessageAt: new Date().toISOString(), lastSenderUid: clientUid, unreadBy: arrayUnion(otherUid) }, { merge: true });
      setTimeout(() => inlineChatScroll.current?.scrollToEnd({ animated: true }), 200);
    } catch (err: any) { Alert.alert(t.imageSendError, err?.message || t.error); }
  };

  // הקלטה קולית בצ'אט המוטמע
  const startInlineRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return Alert.alert(t.error, t.micPermDenied);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await inlineRecorder.prepareToRecordAsync();
      inlineRecorder.record();
      setInlineRecording(true);
    } catch (_) {}
  };
  const stopInlineRecording = async () => {
    if (!inlineRecorder.isRecording) { setInlineRecording(false); return; }
    setInlineRecording(false);
    try {
      await inlineRecorder.stop();
      const uri = inlineRecorder.uri;
      if (!uri || !bookedDetails?.cleanerUid) return;
      const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      if (!base64Data) return;
      if (base64Data.length > 700_000) return Alert.alert(t.audioTooLongTitle, t.audioTooLongMsg);
      const clientUid = auth.currentUser?.uid || '';
      const otherUid = bookedDetails.cleanerUid;
      const chatId = [clientUid, otherUid].sort().join('_');
      setInlineChatOpen(true);
      await addDoc(collection(db, 'chats', chatId, 'messages'), { type: 'audio', audioBase64: `data:audio/m4a;base64,${base64Data}`, from: 'client', fromUid: clientUid, createdAt: new Date().toISOString() });
      await setDoc(doc(db, 'chats', chatId), { participants: [clientUid, otherUid].sort(), lastMessage: t.chatVoiceMsg, lastMessageAt: new Date().toISOString(), lastSenderUid: clientUid, unreadBy: arrayUnion(otherUid) }, { merge: true });
      setTimeout(() => inlineChatScroll.current?.scrollToEnd({ animated: true }), 200);
    } catch (_) { Alert.alert(t.error, t.audioSendError); }
  };

  const handleClose = () => {
    setAddrCity(''); setAddrStreet(''); setAddrFloor(''); setAddrApt(''); setAddrPrivate(false); setSelectedAddrId('');
    setHours(2);
    setBookingDate(new Date()); setStartHour(9); setRecurring('once');
    setRecurringDates([]);
    setServiceTypes([]); setShowSuccess(false); setBookedDetails(null);
    setShowWaiting(false); setPendingBookingId(null);
    setInlineChatOpen(false); setInlineChatMsgs([]); setInlineChatText('');
    prevInlineMsgCount.current = 0;
    if (inlineChatUnsubRef.current) { inlineChatUnsubRef.current(); inlineChatUnsubRef.current = null; }
    onClose();
  };

  // ── ביטול הזמנה ממסך המתנה ──────────────────────────────────────────────
  const handleCancelPending = async () => {
    if (!pendingBookingId) return;
    if (unsubBookingRef.current) { unsubBookingRef.current(); unsubBookingRef.current = null; }
    setCancellingBooking(true);
    try {
      await updateDoc(doc(db, 'bookings', pendingBookingId), { status: 'cancelled' });
      // הסר busySlot שנוסף בעת יצירת ההזמנה
      if (bookedDetails?.cleanerUid) {
        const bSnap = await getDoc(doc(db, 'bookings', pendingBookingId)).catch(() => null);
        const bData = bSnap?.data?.();
        if (bData?.busyFrom && bData?.busyUntil) {
          await updateDoc(doc(db, 'users', bookedDetails.cleanerUid), {
            busySlots: arrayRemove({ from: bData.busyFrom, until: bData.busyUntil }),
          }).catch(() => {});
        }
      }
    } catch (_) {}
    setCancellingBooking(false);
    setShowWaiting(false);
    setPendingBookingId(null);
    setBookedDetails(null);
    onClose();
  };
  if (!cleaner) return null;

  // ── מסך המתנה לאישור ──
  if (showWaiting && bookedDetails) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCancelPending}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF7ED' }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20, paddingBottom: insets.bottom + 32 }}>

            {/* אנימציית המתנה */}
            <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#FED7AA', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FB923C' }}>
              <T style={{ fontSize: 60 }}>⏳</T>
            </View>

            <T style={{ fontSize: 24, fontWeight: '900', color: '#92400E', textAlign: 'center' }}>
              {t.pendingTitle}
            </T>
            <T style={{ fontSize: 14, color: '#B45309', textAlign: 'center', lineHeight: 22 }}>
              {t.pendingSentMsg}
            </T>

            {/* כרטיס פרטי הזמנה */}
            <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', gap: 12, borderWidth: 1, borderColor: '#FED7AA', elevation: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={{ color: '#6B7280', fontSize: 14 }}>{t.cleanerLabel}</T>
                <T style={{ fontWeight: '800', color: '#1C1917', fontSize: 14 }}>🧹 {bookedDetails.name}</T>
              </View>
              <View style={{ height: 1, backgroundColor: '#FED7AA' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={{ color: '#6B7280', fontSize: 14 }}>{t.dateAndTimeLabel}</T>
                <T style={{ fontWeight: '800', color: '#1C1917', fontSize: 14 }}>📅 {bookedDetails.dateStr} · {bookedDetails.startTime}</T>
              </View>
              <View style={{ height: 1, backgroundColor: '#FED7AA' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={{ color: '#6B7280', fontSize: 14 }}>{t.hoursUnit}</T>
                <T style={{ fontWeight: '800', color: '#1C1917', fontSize: 14 }}>⏱️ {bookedDetails.hours} {t.hoursUnit}</T>
              </View>
              <View style={{ height: 1, backgroundColor: '#FED7AA' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={{ color: '#6B7280', fontSize: 14 }}>{t.totalLabel}</T>
                <T style={{ fontWeight: '900', color: '#EA580C', fontSize: 18 }}>₪{bookedDetails.total}</T>
              </View>
              <View style={{ height: 1, backgroundColor: '#FED7AA' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={{ color: '#6B7280', fontSize: 14 }}>{t.addressLabel}</T>
                <T style={{ fontWeight: '700', color: '#1C1917', fontSize: 13, maxWidth: '60%', textAlign: 'right' }}>{bookedDetails.address}</T>
              </View>
            </View>

            {/* ─── צ'אט עם המנקה ─── */}
            <InlineBookingChat
              open={inlineChatOpen}
              onToggle={() => setInlineChatOpen(v => !v)}
              messages={inlineChatMsgs}
              text={inlineChatText}
              onChangeText={setInlineChatText}
              onSend={sendInlineChat}
              onSendImage={sendInlineImage}
              onStartRecording={startInlineRecording}
              onStopRecording={stopInlineRecording}
              isRecording={inlineRecording}
              scrollRef={inlineChatScroll}
              clientUid={auth.currentUser?.uid || ''}
              accentColor="#F97316"
              bgColor="#FFF7ED"
              borderColor="#FED7AA"
            />

            {/* כפתור ביטול */}
            <TouchableOpacity
              style={{ backgroundColor: cancellingBooking ? '#D1D5DB' : '#FEE2E2', borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' }}
              onPress={handleCancelPending}
              disabled={cancellingBooking}
            >
              <T style={{ fontSize: 16, fontWeight: '800', color: cancellingBooking ? '#9CA3AF' : '#DC2626' }}>
                {cancellingBooking ? t.cancellingText : t.cancelBookingBtn}
              </T>
            </TouchableOpacity>

            {/* כפתור ההזמנות שלי */}
            <TouchableOpacity
              style={{ backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB' }}
              onPress={() => { handleClose(); router.push('/profile'); }}
            >
              <T style={{ fontSize: 14, fontWeight: '700', color: '#6B7280' }}>{t.viewMyBookings}</T>
            </TouchableOpacity>

            {/* כפתור חזרה למסך הבית */}
            <TouchableOpacity
              style={{ backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              onPress={handleClose}
            >
              <Text style={{ fontSize: 17 }}>🏠</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151' }}>{t.backToHome || 'חזור למסך הבית'}</Text>
            </TouchableOpacity>

          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── מסך הצלחה ──
  if (showSuccess && bookedDetails) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F0FDF4' }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20, paddingBottom: insets.bottom + 32 }}>
            {/* אנימציית צ'קמארק */}
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#10B981' }}>
              <T style={{ fontSize: 52 }}>✅</T>
            </View>

            <T style={{ fontSize: 26, fontWeight: '900', color: '#065F46', textAlign: 'center' }}>
              {t.confirmedTitle}
            </T>

            {/* כרטיס פרטים */}
            <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', gap: 12, borderWidth: 1, borderColor: '#A7F3D0', elevation: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T style={{ fontSize: 15, color: '#6B7280' }}>{t.cleanerLabel}</T>
                <T style={{ fontSize: 15, fontWeight: '800', color: '#065F46' }}>🧹 {bookedDetails.name}</T>
              </View>
              <View style={{ height: 1, backgroundColor: '#D1FAE5' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T style={{ fontSize: 15, color: '#6B7280' }}>{t.dateAndTimeLabel}</T>
                <T style={{ fontSize: 14, fontWeight: '800', color: '#065F46' }}>📅 {bookedDetails.dateStr} · {bookedDetails.startTime}</T>
              </View>
              <View style={{ height: 1, backgroundColor: '#D1FAE5' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T style={{ fontSize: 15, color: '#6B7280' }}>{t.hoursUnit}</T>
                <T style={{ fontSize: 15, fontWeight: '800', color: '#065F46' }}>⏱️ {bookedDetails.hours} {t.hoursUnit}</T>
              </View>
              <View style={{ height: 1, backgroundColor: '#D1FAE5' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T style={{ fontSize: 15, color: '#6B7280' }}>{t.totalLabel}</T>
                <T style={{ fontSize: 20, fontWeight: '900', color: '#059669' }}>₪{bookedDetails.total}</T>
              </View>
            </View>

            {/* מה הלאה */}
            <View style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: 18, width: '100%', gap: 10, borderWidth: 1, borderColor: '#BFDBFE' }}>
              <T style={{ fontSize: 15, fontWeight: '800', color: '#1D4ED8', marginBottom: 4 }}>📋 {t.whatsNextTitle}</T>
              <T style={{ fontSize: 14, color: '#1E40AF', lineHeight: 22 }}>1️⃣  {t.nextStep1}</T>
              <T style={{ fontSize: 14, color: '#1E40AF', lineHeight: 22 }}>2️⃣  {t.nextStep2}</T>
              <T style={{ fontSize: 14, color: '#1E40AF', lineHeight: 22 }}>3️⃣  {t.nextStep3}</T>
            </View>

            {/* ─── צ'אט עם המנקה ─── */}
            <InlineBookingChat
              open={inlineChatOpen}
              onToggle={() => setInlineChatOpen(v => !v)}
              messages={inlineChatMsgs}
              text={inlineChatText}
              onChangeText={setInlineChatText}
              onSend={sendInlineChat}
              onSendImage={sendInlineImage}
              onStartRecording={startInlineRecording}
              onStopRecording={stopInlineRecording}
              isRecording={inlineRecording}
              scrollRef={inlineChatScroll}
              clientUid={auth.currentUser?.uid || ''}
              accentColor="#059669"
              bgColor="#F0FDF4"
              borderColor="#A7F3D0"
            />

            {/* כפתור ההזמנות שלי */}
            <TouchableOpacity
              style={{ backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 32, width: '100%', alignItems: 'center' }}
              onPress={() => { handleClose(); router.push('/profile'); }}
            >
              <T style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>{t.viewMyBookings}</T>
            </TouchableOpacity>

            {/* כפתור חזרה למסך הבית */}
            <TouchableOpacity
              style={{ backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              onPress={handleClose}
            >
              <T style={{ fontSize: 15, fontWeight: '700', color: '#6B7280' }}>{t.closeBtn}</T>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}><T style={{ color: C.white, fontSize: 18 }}>✕</T></TouchableOpacity>
          <T style={s.modalTitle}>{t.newBookingTitle}</T>
          <View style={{ width: 36 }} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}>
        <ScrollView ref={bookingScrollRef} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
            {/* Cleaner info */}
            <View style={s.bookingCard}>
              <View style={s.bookingAvatar}>
                {(() => {
                  const uri = cleaner.photoB64 || cleaner.photo ||
                    (!isNaN(parseInt(cleaner.id)) ? `https://i.pravatar.cc/150?img=${((parseInt(cleaner.id) - 1) % 70) + 1}` : null);
                  return uri
                    ? <Image source={{ uri }} style={{ width: 48, height: 48, borderRadius: 24 }} contentFit="cover" />
                    : <T style={s.bookingAvatarText}>{cleaner.initials}</T>;
                })()}
              </View>
              <View style={{ flex: 1 }}>
                <T style={s.bookingName}>{cleaner.name}</T>
                <T style={s.bookingCity}>📍 {t.cities[cleaner.city] || cleaner.city} · ₪{cleaner.price}{t.perHour}</T>
              </View>
            </View>

            {/* Date */}
            <T style={s.fieldLabel}>📅 {t.dateLabel}</T>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
              <T style={s.dateBtnText}>{fmtDate(bookingDate)}</T>
              <T style={{ fontSize: 12, color: C.textSub }}>📅 {t.selectDate}</T>
            </TouchableOpacity>
            <CalendarPicker
              visible={showDatePicker}
              value={bookingDate}
              onChange={setBookingDate}
              onClose={() => setShowDatePicker(false)}
            />

            {/* Time */}
            <T style={s.fieldLabel}>🕐 {t.timeLabel}</T>
            {isToday && (
              <T style={{ fontSize: 12, color: '#EF4444', marginBottom: 4, textAlign: 'right' }}>
                ⚠️ ניתן להזמין מ-{String(Math.floor(minHour)).padStart(2,'0')}:{minHour % 1 === 0.5 ? '30' : '00'} ומעלה
              </T>
            )}
            <TimeWheelPicker value={startHour} onChange={setStartHour} minHour={minHour} maxHour={20} />

            {/* Recurring */}
            <T style={s.fieldLabel}>🔁 {t.recurringLabel}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['once', 'weekly', 'monthly'] as const).map(opt => (
                <TouchableOpacity key={opt} style={[s.recurBtn, recurring === opt && s.recurBtnActive]} onPress={() => setRecurring(opt)}>
                  <T style={[s.recurBtnText, recurring === opt && { color: C.white }]}>
                    {opt === 'once' ? t.recurOnce : opt === 'weekly' ? t.recurWeekly : t.recurMonthly}
                  </T>
                </TouchableOpacity>
              ))}
            </View>

            {/* Calendar for recurring dates */}
            {recurring !== 'once' && (
              <MultiCalendarPicker
                selected={recurringDates}
                onChange={setRecurringDates}
                label={recurring === 'weekly' ? (t.recurWeekly || 'שבועי') : (t.recurMonthly || 'חודשי')}
              />
            )}

            {/* Service Type (if cleaner has servicePricing) */}
            {cleaner?.types?.length > 0 && (
              <>
                <T style={s.fieldLabel}>{t.selectServiceType} <T style={{ color: '#DC2626' }}>*</T></T>
                {/* כפתור פתיחת התפריט */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderRadius: 12, borderWidth: serviceTypes.length === 0 ? 2 : 1.5, borderColor: serviceDropdownOpen ? C.blue : (serviceTypes.length === 0 ? '#DC2626' : C.blueBorder), paddingHorizontal: 14, paddingVertical: 13 }}
                  onPress={() => setServiceDropdownOpen(o => !o)}
                  activeOpacity={0.8}
                >
                  <T style={{ fontSize: 14, fontWeight: '700', color: serviceTypes.length ? C.textDark : '#DC2626' }} numberOfLines={2}>
                    {serviceTypes.length
                      ? serviceTypes.map(st => `${TYPE_ICONS[st] || ''} ${t.types[st] || st}`).join(' · ')
                      : ((t as any).selectServiceTypeMulti ?? 'בחר סוג שירות (אפשר כמה)')}
                  </T>
                  <T style={{ fontSize: 14, color: C.blue }}>{serviceDropdownOpen ? '▲' : '▼'}</T>
                </TouchableOpacity>
                {serviceTypes.length === 0 && (
                  <T style={{ fontSize: 11, color: '#DC2626', fontWeight: '700', textAlign: 'right' }}>⚠️ יש לבחור סוג ניקיון</T>
                )}
                {/* רשימת אפשרויות — בחירה מרובה */}
                {serviceDropdownOpen && (
                  <View style={{ backgroundColor: C.white, borderRadius: 12, borderWidth: 1.5, borderColor: C.blueBorder, marginTop: 4, overflow: 'hidden' }}>
                    {cleaner.types.map((tp: string, i: number) => {
                      const sel = serviceTypes.includes(tp);
                      return (
                      <View key={tp} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.blueBorder }}>
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: sel ? C.bluePale : C.white }}
                          onPress={() => toggleServiceType(tp)}
                        >
                          <T style={{ fontSize: 16, color: sel ? C.blue : C.blueBorder }}>{sel ? '☑' : '☐'}</T>
                          <T style={{ flex: 1, fontSize: 14, fontWeight: '700', color: sel ? C.blue : C.textDark, textAlign: 'right' }}>
                            {TYPE_ICONS[tp] || ''} {t.types[tp] || tp}
                            {cleaner.servicePricing?.[tp] ? ` · ₪${cleaner.servicePricing[tp]}` : ''}
                          </T>
                        </TouchableOpacity>
                        <View style={{ paddingHorizontal: 8 }}><ServiceInfoBtn serviceKey={tp} /></View>
                      </View>
                      );
                    })}
                  </View>
                )}
                {serviceTypes.length > 0 && (
                  <T style={{ fontSize: 11, color: C.textSub }}>{t.priceRangeLabel}: ₪{effectivePrice}{t.perHour}</T>
                )}
                {serviceTypes.filter(st => SERVICE_DESCRIPTIONS[st]).map(st => (
                  <View key={st} style={{ backgroundColor: C.bluePale, borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: C.blueBorder, marginTop: 4 }}>
                    <T style={{ fontSize: 12, fontWeight: '800', color: C.textDark, marginBottom: 4 }}>{TYPE_ICONS[st] || ''} {t.types[st] || st} — {t.serviceIncludesTitle}</T>
                    {SERVICE_DESCRIPTIONS[st].map((line, i) => (
                      <T key={i} style={{ fontSize: 12, color: C.textDark, lineHeight: 20 }}>{line}</T>
                    ))}
                  </View>
                ))}
              </>
            )}

            {/* Hours */}
            <T style={s.fieldLabel}>{t.hoursLabel}</T>
            <HoursWheelPicker value={hours} onChange={setHours} values={[1,2,3,4,5,6,7,8,9,10,11,12]} />

            {/* Address */}
            <T style={s.fieldLabel}>{t.addressLabel}</T>
            {!addrEditMode && (addrCity || addrStreet) ? (
              <View style={{ backgroundColor: C.bluePale, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.blueBorder, marginBottom: 10 }}>
                <T style={{ fontSize: 12, color: C.textSub, marginBottom: 4, textAlign: 'right' }}>{t.fullAddrLabel}</T>
                <T style={{ fontSize: 14, fontWeight: '800', color: C.textDark, textAlign: 'right' }}>📍 {buildFullAddress(addrCity, addrStreet, addrFloor, addrApt, addrPrivate)}</T>
                <TouchableOpacity onPress={() => setAddrEditMode(true)} style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: C.blue }}>
                  <T style={{ fontSize: 13, fontWeight: '800', color: C.blue }}>{t.changeAddressBtn}</T>
                </TouchableOpacity>
              </View>
            ) : (<>
            <AddressPicker selectedId={selectedAddrId} onSelect={fillFromSaved} savedAddresses={savedAddresses} />

            {/* שדות כתובת מובנים */}
            <View style={{ gap: 8 }}>
              {/* עיר */}
              <TextInput
                style={[s.input, { textAlign: 'right' }]}
                placeholder={t.cityOptionalPh}
                value={addrCity}
                onChangeText={t => { setAddrCity(t); setSelectedAddrId(''); }}
                placeholderTextColor={C.textSub}
              />
              {/* רחוב + מספר בית */}
              <TextInput
                style={[s.input, { textAlign: 'right' }]}
                placeholder={t.streetNumberPh}
                value={addrStreet}
                onChangeText={t => { setAddrStreet(t); setSelectedAddrId(''); }}
                placeholderTextColor={C.textSub}
              />
              {/* סוג דיור */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: !addrPrivate ? C.blue : C.bluePale, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: !addrPrivate ? C.blue : C.blueBorder }}
                  onPress={() => setAddrPrivate(false)}
                >
                  <T style={{ fontSize: 18 }}>{!addrPrivate ? '🔵' : '⚪'}</T>
                  <T style={{ fontWeight: '700', color: !addrPrivate ? C.white : C.textDark, fontSize: 14 }}>{t.apartmentLabel}</T>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: addrPrivate ? C.blue : C.bluePale, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: addrPrivate ? C.blue : C.blueBorder }}
                  onPress={() => setAddrPrivate(true)}
                >
                  <T style={{ fontSize: 18 }}>{addrPrivate ? '🔵' : '⚪'}</T>
                  <T style={{ fontWeight: '700', color: addrPrivate ? C.white : C.textDark, fontSize: 14 }}>{t.privateHouseLabel}</T>
                </TouchableOpacity>
              </View>
              {/* קומה + דירה (רק אם לא בית פרטי) */}
              {!addrPrivate && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={[s.input, { flex: 1, textAlign: 'right' }]}
                    placeholder={t.floorPh}
                    value={addrFloor}
                    onChangeText={t => { setAddrFloor(t); setSelectedAddrId(''); }}
                    keyboardType="numeric"
                    placeholderTextColor={C.textSub}
                  />
                  <TextInput
                    style={[s.input, { flex: 1, textAlign: 'right' }]}
                    placeholder={t.aptNumberPh}
                    value={addrApt}
                    onChangeText={t => { setAddrApt(t); setSelectedAddrId(''); }}
                    keyboardType="numeric"
                    placeholderTextColor={C.textSub}
                  />
                </View>
              )}
              {/* תצוגה מקדימה של הכתובת */}
              {(addrCity || addrStreet) && (
                <View style={{ backgroundColor: C.bluePale, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.blueBorder }}>
                  <T style={{ fontSize: 12, color: C.textSub, marginBottom: 2 }}>{t.fullAddrLabel}</T>
                  <T style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>
                    {buildFullAddress(addrCity, addrStreet, addrFloor, addrApt, addrPrivate) || '—'}
                  </T>
                </View>
              )}
            </View>
            </>)}

            {/* Payment */}
            <T style={s.fieldLabel}>{t.paymentMethodLabel}</T>
            <View style={s.payRow}>
              {(cleaner.payment || []).map((p: string) => {
                const PAY_LABEL: Record<string,string> = {
                  cash: t.payCash, bit: t.payBit, paybox: 'PayBox', bank: 'בנקאי', card: 'כרטיס'
                };
                return (
                  <TouchableOpacity key={p} style={[s.payBtn, payment === p && s.payBtnActive]} onPress={() => setPayment(p)}>
                    {p === 'paybox'
                      ? <View style={{ height: 22, justifyContent: 'center' }}><PayboxIcon size={20} /></View>
                      : <T style={s.payIcon}>{PAY_ICONS[p] || '💳'}</T>}
                    <T
                      style={[s.payLabel, payment === p && { color: C.blue }]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {PAY_LABEL[p] || p}
                    </T>
                  </TouchableOpacity>
                );
              })}
            </View>
            <T style={{ fontSize: 12, color: '#EF4444', fontWeight: '700', marginTop: 6, textAlign: 'center', lineHeight: 17 }}>{t.paymentDirectNote}</T>

            {/* Summary */}
            <View style={s.summaryCard}>
              <T style={s.summaryLabel}>{t.totalLabel}</T>
              <T style={s.summaryTotal}>₪{total}</T>
            </View>

            <TouchableOpacity style={[s.confirmBtn, saving && { opacity: 0.7 }]} onPress={handleBook} disabled={saving}>
              <T style={s.confirmBtnText}>{saving ? t.savingText : `✅ ${t.confirmBtnText} · ₪${total}`}</T>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Chat modal (real Firestore) ─────────────────────────────────────────────
function ChatModal({ cleaner, visible, onClose }: any) {
  const { t } = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const sh = Keyboard.addListener('keyboardWillShow', () => setKbOpen(true));
    const hd = Keyboard.addListener('keyboardWillHide', () => setKbOpen(false));
    return () => { sh.remove(); hd.remove(); };
  }, []);
  const scrollRef = useRef<ScrollView>(null);
  const clientUid = auth.currentUser?.uid || '';
  const prevMsgCount = useRef(0);

  // ── הקלטה קולית ──
  const [isRecording,  setIsRecording]  = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [playingId,    setPlayingId]    = useState<string | null>(null);
  const [viewerUri,    setViewerUri]    = useState<string | null>(null);
  const soundRef = useRef<any>(null);

  const chatId = cleaner
    ? [clientUid, cleaner.uid || cleaner.id].sort().join('_')
    : '';

  useEffect(() => {
    if (!cleaner || !chatId || !visible) return;
    setActiveChat(chatId);   // המשתמש בצ'אט הזה — לא להקפיץ פופ-אפ עליו
    prevMsgCount.current = 0;
    const msgsCol = collection(db, 'chats', chatId, 'messages');
    const q = query(msgsCol, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q,
      snap => {
        const newMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        prevMsgCount.current = newMsgs.length;
        setMessages(newMsgs);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      },
      _err => { /* permission error */ }
    );
    return () => { unsub(); setActiveChat(null); };
  }, [chatId, cleaner, visible]);

  const send = async () => {
    if (!text.trim() || !chatId) return;
    const msg = text.trim();
    setText('');
    const otherUid = cleaner.uid || cleaner.id;
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: msg, from: 'client', fromUid: clientUid,
        createdAt: new Date().toISOString(),
      });
      // Auto-reply — only for demo cleaners (numeric id '1'–'90'), real cleaners reply manually
      const isDemoCleaner = /^\d{1,2}$/.test(String(otherUid));
      if (isDemoCleaner) {
        const autoReplyText = 'תודה ששלחת הודעה, אחזור אלייך בהקדם האפשרי 🙏';
        setTimeout(async () => {
          try {
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
              text: autoReplyText, from: 'cleaner', fromUid: otherUid,
              createdAt: new Date().toISOString(), isAutoReply: true,
            });
          } catch (_) {}
        }, 1500);
      }
      // כתיבת metadata + unreadBy למנקה
      try {
        await setDoc(doc(db, 'chats', chatId), {
          participants: [clientUid, otherUid].sort(),
          lastMessage: msg,
          lastMessageAt: new Date().toISOString(),
          lastSenderUid: clientUid,
          participantNames: { [clientUid]: 'לקוח', [otherUid]: cleaner.name },
          unreadBy: arrayUnion(otherUid),
        }, { merge: true });
      } catch (_) {}
      // שם לקוח + פוש למנקה (אופציונלי)
      try {
        const clientDoc = await getDoc(doc(db, 'users', clientUid));
        const clientName = clientDoc.data()?.name || 'לקוח';
        await setDoc(doc(db, 'chats', chatId), {
          participantNames: { [clientUid]: clientName, [otherUid]: cleaner.name },
        }, { merge: true });
        const cleanerDoc = await getDoc(doc(db, 'users', otherUid));
        const pushToken = cleanerDoc.data()?.pushToken;
        if (pushToken) sendPushNotification(pushToken, `💬 הודעה מ-${clientName}`, msg, { type: 'message' });
      } catch (_) {}
    } catch (_) {}
  };

  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return Alert.alert(t.error, t.micPermDenied);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (_) {}
  };

  const stopAndSendRecording = async () => {
    if (!audioRecorder.isRecording) { setIsRecording(false); return; }
    setIsRecording(false);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri || !chatId) return;
      const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      if (!base64Data) return;
      if (base64Data.length > 700_000) return Alert.alert(t.audioTooLongTitle, t.audioTooLongMsg);
      const otherUid = cleaner.uid || cleaner.id;
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        type: 'audio',
        audioBase64: `data:audio/m4a;base64,${base64Data}`,
        from: 'client', fromUid: clientUid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        participants: [clientUid, otherUid].sort(),
        lastMessage: t.chatVoiceMsg,
        lastMessageAt: new Date().toISOString(),
        lastSenderUid: clientUid,
        unreadBy: arrayUnion(otherUid),
      }, { merge: true });
    } catch (_) { Alert.alert(t.error, t.audioSendError); }
  };

  const sendImage = async () => {
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
    // resize + compress so it always fits Firestore's ~700KB base64 limit
    let base64Data: string | null | undefined;
    try {
      for (const st of [{ width: 1080, compress: 0.5 }, { width: 900, compress: 0.4 }, { width: 720, compress: 0.35 }]) {
        const out = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: st.width } }], { compress: st.compress, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        base64Data = out.base64;
        if (base64Data && base64Data.length <= 700_000) break;
      }
    } catch (_) { return Alert.alert(t.error, t.imageReadError); }
    if (!base64Data) return Alert.alert(t.error, t.imageReadError);
    if (base64Data.length > 700_000) return Alert.alert(t.imageTooLargeTitle, t.imageTooLargeMsg);
    const otherUid = cleaner.uid || cleaner.id;
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        type: 'image',
        imageBase64: `data:image/jpeg;base64,${base64Data}`,
        from: 'client', fromUid: clientUid,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        participants: [clientUid, otherUid].sort(),
        lastMessage: t.chatImageMsg,
        lastMessageAt: new Date().toISOString(),
        lastSenderUid: clientUid,
        unreadBy: arrayUnion(otherUid),
      }, { merge: true });
    } catch (err: any) {
      Alert.alert(t.imageSendError, err?.message || t.error);
    }
  };

  const playAudio = async (src: string, msgId: string) => {
    if (!src) return;
    if (soundRef.current) {
      try { soundRef.current.remove(); } catch (_) {}
      soundRef.current = null;
    }
    if (playingId === msgId) { setPlayingId(null); return; }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      let playSrc = src;
      if (src.startsWith('data:')) {
        const base64 = src.substring(src.indexOf(',') + 1);
        const path = (FileSystem.cacheDirectory || '') + `voice_${msgId}.m4a`;
        await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' as any });
        playSrc = path;
      }
      const player = createAudioPlayer({ uri: playSrc });
      soundRef.current = player;
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
          soundRef.current = null;
        }
      });
      startPlayback();
    } catch (_) { Alert.alert(t.error, t.audioPlayError); }
  };

  if (!cleaner) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bluePale }}>
        {/* safe-area-context insets are 0 inside a Modal — use insets.top directly */}
        <View style={{ backgroundColor: C.blueDark, paddingTop: insets.top }}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}><T style={{ color: C.white, fontSize: 18 }}>✕</T></TouchableOpacity>
            <T style={s.modalTitle}>{t.chatWithPrefix}{cleaner.name}</T>
            <View style={{ width: 36 }} />
          </View>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}>
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 && (
              <View style={{ alignItems: 'flex-start' }}>
                <View style={[s.bubble, s.bubbleCleaner]}>
                  <T style={{ color: C.white, fontSize: 14 }}>{t.greetingPrefix}{cleaner.name}{t.greetingSuffix}</T>
                </View>
              </View>
            )}
            {messages.map(m => {
              if (m.type === 'bit_payment') {
                return (
                  <View key={m.id} style={{ alignItems: 'flex-start' }}>
                    <View style={s.bitCard}>
                      <T style={s.bitCardTitle}>{t.paymentRequestTitle}</T>
                      <T style={s.bitCardAmount}>₪{m.amount}</T>
                      <TouchableOpacity
                        style={s.bitBtn}
                        onPress={() => Linking.openURL(m.bitLink).catch(() =>
                          Alert.alert(t.payBit, t.payWithBit)
                        )}
                      >
                        <T style={s.bitBtnText}>{t.payWithBit}</T>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }
              if (m.type === 'image') {
                const isMe = m.fromUid === clientUid;
                const uri = m.imageBase64 || m.imageUrl;
                return (
                  <View key={m.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <TouchableOpacity onPress={() => uri && setViewerUri(uri)} activeOpacity={0.85}>
                      <Image
                        source={{ uri }}
                        style={{ width: 200, height: 150, borderRadius: 12, borderWidth: 1, borderColor: C.blueBorder, marginVertical: 2 }}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                  </View>
                );
              }
              if (m.type === 'audio') {
                const isMe = m.fromUid === clientUid;
                const isPlaying = playingId === m.id;
                const src = m.audioBase64 || m.audioUrl;
                return (
                  <View key={m.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <TouchableOpacity
                      style={[s.audioBubble, isMe ? s.audioBubbleClient : s.audioBubbleCleaner]}
                      onPress={() => src && playAudio(src, m.id)}
                    >
                      <T style={{ fontSize: 22 }}>{isPlaying ? '⏸' : '▶️'}</T>
                      <T style={{ color: isMe ? C.textDark : C.white, fontSize: 13, marginLeft: 6 }}>
                        🎤 {isPlaying ? 'מנגן...' : 'הודעה קולית'}
                      </T>
                    </TouchableOpacity>
                  </View>
                );
              }
              return (
                <View key={m.id} style={{ alignItems: m.fromUid === clientUid ? 'flex-end' : 'flex-start' }}>
                  <View style={[s.bubble, m.fromUid === clientUid ? s.bubbleClient : s.bubbleCleaner]}>
                    <T style={{ color: m.fromUid === clientUid ? C.textDark : C.white, fontSize: 14 }}>{m.text}</T>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={{ backgroundColor: C.white, paddingBottom: kbOpen ? 6 : insets.bottom }}>
            <View style={[s.chatRow, { paddingVertical: 8 }]}>
              {isRecording && (
                <View style={{ position: 'absolute', top: -34, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ color: '#fff', fontWeight: '800', fontSize: 13, backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, overflow: 'hidden' }}>{t.recordingAudio}</T>
                </View>
              )}
              <TouchableOpacity style={s.sendBtn} onPress={send}><T style={{ color: C.white, fontSize: 18 }}>◀</T></TouchableOpacity>
              <TextInput style={s.chatInput} placeholder={t.chatPlaceholder} value={text} onChangeText={setText} placeholderTextColor={C.textSub} textAlign="right" onSubmitEditing={send} />
              <TouchableOpacity
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.blueBorder }}
                onPress={sendImage}
              >
                <T style={{ fontSize: 20 }}>📷</T>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.micBtn, isRecording && s.micBtnRecording, { backgroundColor: isRecording ? '#EF4444' : '#25D366', borderWidth: 0 }]}
                onPressIn={startRecording}
                onPressOut={stopAndSendRecording}
              >
                <MaterialIcons name="mic" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
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
      </View>
    </Modal>
  );
}

// ─── Cleaner card ─────────────────────────────────────────────────────────────
function CleanerCardInner({ cleaner, isSel, onSelect, onProfile, onBook, onChat, isPending, onShowOnMap, onEnlarge, onReviews }: any) {
  const { t, flipSide, highContrast, textScale } = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const fs = (base: number) => Math.round(base * textScale);
  const photoUri = cleaner.photoB64 || cleaner.photo ||
    (!isNaN(parseInt(cleaner.id))
      ? `https://i.pravatar.cc/150?img=${((parseInt(cleaner.id) - 1) % 70) + 1}`
      : null);
  return (
    <TouchableOpacity
      style={[s.card, isSel && s.cardSel, highContrast && { backgroundColor: HC.card, borderColor: HC.border, borderWidth: 2 }]}
      onPress={() => { onShowOnMap?.(cleaner); onSelect(cleaner.id); }}
      onLongPress={() => onProfile(cleaner)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${cleaner.name}${cleaner.rating ? `, דירוג ${cleaner.rating.toFixed(1)}` : ''}${cleaner.available ? ', זמין' : ', לא זמין'}`}
      accessibilityHint="לחיצה להצגה במפה ולפרטים, לחיצה על השם להרחבה, לחיצה ארוכה לפרופיל"
    >
      <View style={{ gap: 8 }}>
        {/* top row: price pill (left) · identity (right) · gradient avatar (far right) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* price pill */}
          <LinearGradient colors={['#3E8DE3', '#1E6FB8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pricePill}>
            <T style={s.pricePillNum}>₪{cleaner.price}</T>
            <T style={s.pricePillSub}>{t.perHour}</T>
          </LinearGradient>
          {/* identity — right-aligned, fills the middle */}
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
            <TouchableOpacity onPress={() => onSelect(cleaner.id)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessibilityLabel={`הרחב כרטיס של ${cleaner.name}`}>
              {cleaner.identityVerified && (
                <View style={s.verifiedBadge}><MaterialIcons name="check" size={11} color="#fff" /></View>
              )}
              <T style={[s.cardName, { fontSize: fs(16), color: highContrast ? HC.blue : C.blue }]}>{cleaner.name}</T>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <T style={[s.cardCity, { fontSize: fs(12), color: highContrast ? HC.sub : C.textSub }]}>{(() => { const cn = cityNameOf(cleaner); return t.cities[cn] || cn; })()}</T>
            </View>
          </View>
          {/* gradient avatar */}
          <TouchableOpacity onPress={() => photoUri && onEnlarge?.(photoUri)} activeOpacity={0.8} accessibilityLabel={`הגדל תמונה של ${cleaner.name}`}>
            <View style={{ position: 'relative' }}>
              <LinearGradient colors={['#5BA8F0', '#1E6FB8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.avatarLg, !cleaner.available && { opacity: 0.75 }]}>
                {photoUri
                  ? <Image source={{ uri: photoUri }} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit="cover" />
                  : <T style={[s.avatarText, { fontSize: 18 }]}>{cleaner.initials}</T>}
              </LinearGradient>
              {cleaner.available && <View style={s.onlineDot} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* שירותים — פילים קומפקטיים אחד ליד השני, פירוט נפתח בלחיצה (בלי ℹ) */}
        {/* שירותים — תגיות קטנות לפי רוחב התוכן, בלי איקונים, נצמדות */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
          {cleaner.types.map((tp: string) => (
            <ServiceInfoBtn
              key={tp}
              serviceKey={tp}
              inlinePill
              pillStyle={[s.typePill, { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9 }]}
              pillTextStyle={{ fontSize: fs(10), fontWeight: '600', color: C.blue }}
              label={String(t.types[tp] || tp).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim()}
              hideInfo
              onPressOverride={!isSel ? () => { onShowOnMap?.(cleaner); onSelect(cleaner.id); } : undefined}
            />
          ))}
        </View>

        {/* status row — all tags in one evenly-spaced row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 4, borderTopWidth: 1, borderTopColor: C.blueBorder, paddingTop: 8, marginTop: 1 }}>
          <TouchableOpacity onPress={() => (onReviews ? onReviews(cleaner) : onProfile(cleaner))}><T style={s.reviewsLink} numberOfLines={1}>({cleaner.reviews})</T></TouchableOpacity>
          <View style={[s.availPill, !cleaner.available && s.availPillOff]}>
            <T style={[s.availPillText, !cleaner.available && { color: C.textSub }]} numberOfLines={1}>{(cleaner.available ? t.availPill : t.notAvailPill).replace(/[●○]\s*/g, '')}</T>
          </View>
          {getBadges(cleaner).map(b => (
            <View key={b} style={[s.badgePill, { backgroundColor: BADGE_COLORS[b]?.bg || '#F0F0F0' }]}>
              <T style={[s.badgePillText, { color: BADGE_COLORS[b]?.color || '#666' }]} numberOfLines={1}>{badgeLabel(b, t)}</T>
            </View>
          ))}
          <View style={s.freeCommissionBadge}>
            <T style={s.freeCommissionBadgeText} numberOfLines={1}>{t.freeCommissionBadge}</T>
          </View>
        </View>
      </View>
      {isSel && (
        <View style={s.cardExpanded}>
          <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
            {cleaner.payment.map((p: string) => <View key={p} style={[s.payChip, p === 'paybox' && { flexDirection: 'row', alignItems: 'center', gap: 3 }]}>{p === 'paybox' && <PayboxIcon size={12} />}<T style={s.payChipText}>{p === 'paybox' ? t.payPaybox : `${PAY_ICONS[p] || '💳'} ${p === 'bit' ? t.payBit : p === 'cash' ? t.payCash : p === 'bank' ? t.payBank : p === 'card' ? t.payCard : p === 'kochavit' ? ((t as any).payKochavit ?? 'כוכבית') : p}`}</T></View>)}
          </View>
          <View style={{ flexDirection: flipSide ? 'row-reverse' : 'row', gap: 8 }}>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => onProfile(cleaner)}
              accessibilityRole="button"
              accessibilityLabel={`פרופיל של ${cleaner.name}`}
            >
              <T style={[s.actionBtnText, { fontSize: fs(14), color: highContrast ? HC.blue : C.blue }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t.profileBtn}</T>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => onChat(cleaner)}
              accessibilityRole="button"
              accessibilityLabel={`פתח צ'אט עם ${cleaner.name}`}
            >
              <T style={{ fontSize: 26 }}>{t.chatBtnShort}</T>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnPrimary, !cleaner.available && { backgroundColor: '#94A3B8' }]}
              disabled={!cleaner.available}
              onPress={() => cleaner.available && onBook(cleaner)}
              accessibilityRole="button"
              accessibilityLabel={cleaner.available ? `הזמן את ${cleaner.name}` : 'לא זמין כרגע'}
              accessibilityState={{ disabled: !cleaner.available }}
            >
              <T style={s.actionBtnPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {cleaner.available ? t.bookBtnShort : t.notAvailBtn}
              </T>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}
const CleanerCard = React.memo(CleanerCardInner);

// ─── Quick Rebook Modal ───────────────────────────────────────────────────────
function QuickRebookModal({ visible, onClose, myBookings, allCleaners, onBook }: {
  visible: boolean;
  onClose: () => void;
  myBookings: any[];
  allCleaners: any[];
  onBook: (cleaner: any, prevBooking: any) => void;
}) {
  const { t } = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const insets = useSafeAreaInsets();

  // מזהים של הזמנות שהוסתרו מקומית (לפני עדכון Firestore)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const pastBookings = myBookings
    .filter((b: any) =>
      ['done', 'confirmed', 'active', 'pending'].includes(b.status) &&
      !b.hiddenFromRebook &&
      !hiddenIds.has(b.id)
    )
    .slice(0, 10);

  const handleRebook = (b: any) => {
    const cleaner = allCleaners.find((c: any) => c.id === b.cleanerId || c.uid === b.cleanerId);
    if (!cleaner) {
      Alert.alert('', t.cleanerNotFound);
      return;
    }
    onClose();
    onBook(cleaner, b);
  };

  const handleDelete = (b: any) => {
    Alert.alert(
      'הסרת הזמנה',
      `להסיר את ההזמנה עם ${b.cleanerName} מהרשימה?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר', style: 'destructive',
          onPress: async () => {
            // הסתר מיידית בממשק
            setHiddenIds(prev => new Set(prev).add(b.id));
            // שמור ב-Firestore
            try {
              await updateDoc(doc(db, 'bookings', b.id), { hiddenFromRebook: true });
            } catch (_) {}
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E5FA8', padding: 16 }}>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</T>
          </TouchableOpacity>
          <T style={{ fontSize: 17, fontWeight: '900', color: '#fff' }}>{t.prevBookingsTitle}</T>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 24 }}>
          {pastBookings.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 14 }}>
              <T style={{ fontSize: 52 }}>📋</T>
              <T style={{ fontSize: 18, fontWeight: '800', color: C.textDark, textAlign: 'center' }}>{t.noPrevBookings}</T>
              <T style={{ fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 22 }}>
                לאחר הזמנה ראשונה תוכל/י לחזור עליה בלחיצה אחת — אותו מנקה, אותה כתובת.
              </T>
            </View>
          ) : (
            <>
              <View style={{ backgroundColor: '#E8F1FB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#C7DEF5' }}>
                <T style={{ fontSize: 13, color: '#1E5FA8', textAlign: 'center', lineHeight: 20 }}>
                  ♻️ בחר הזמנה קודמת ← פתח טופס הזמנה עם אותו מנקה
                </T>
              </View>
              {pastBookings.map((b: any) => {
                const statusColor = b.status === 'done' ? '#065F46' : b.status === 'confirmed' ? '#1D4ED8' : '#92400E';
                const statusBg    = b.status === 'done' ? '#D1FAE5' : b.status === 'confirmed' ? '#DBEAFE' : '#FEF3C7';
                const statusLabel = b.status === 'done' ? '✅ הושלם' : b.status === 'confirmed' ? '✓ אושר' : b.status === 'active' ? '🔵 פעיל' : '⏳ ממתין';
                return (
                  <View key={b.id} style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: C.blueBorder, gap: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 }}>
                    {/* שורת כותרת + סטטוס + כפתור מחיקה */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <T style={{ fontSize: 16, fontWeight: '900', color: C.textDark, flex: 1 }}>🧹 {b.cleanerName}</T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ backgroundColor: statusBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <T style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</T>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDelete(b)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <T style={{ fontSize: 14, color: '#EF4444', fontWeight: '900', lineHeight: 16 }}>✕</T>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <T style={{ fontSize: 13, color: C.textSub }}>
                      📅 {b.bookingDate || b.createdAt?.split('T')[0]}
                      {b.startTime ? ` · 🕐 ${b.startTime}` : ''}
                      {b.hours ? ` · ⏱ ${b.hours} ${t.hoursUnit}` : ''}
                      {b.serviceType ? ` · ${b.serviceType}` : ''}
                    </T>
                    <T style={{ fontSize: 13, color: C.textSub }} numberOfLines={1}>📍 {b.address}</T>
                    {b.total ? <T style={{ fontSize: 13, color: C.blue, fontWeight: '700' }}>₪{b.total}</T> : null}
                    <TouchableOpacity
                      style={{ backgroundColor: '#1E6FB8', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 2 }}
                      onPress={() => handleRebook(b)}
                    >
                      <T style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>{t.rebookSameCleaner}</T>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router   = useRouter();
  const { t, setLang, flipSide } = useLanguage();
  const C = useAppColors();
  const s = createS(C);
  const ds = createDS(C);
  const [a11yOpen, setA11yOpen] = useState(false);
  const insets   = useSafeAreaInsets();
  const mapRef      = useRef<MapView>(null);
  const flatListRef = useRef<FlatList>(null);
  const handleSelectCleaner = React.useCallback((id: string) => setSelected(prev => prev === id ? null : id), []);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const handleShowOnMap = React.useCallback((c: any) => {
    if (mapRef.current && c?.lat && c?.lng) {
      mapRef.current.animateToRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 500);
    }
  }, []);
  // התמקדות במפה לפי שם עיר (חיפוש/סינון) — מחפש קואורדינטות ב-CITY_COORDS, בתרגום, או אצל מנקה
  const focusCityRef = useRef<(name: string) => void>(() => {});
  focusCityRef.current = (cityName: string) => {
    const name = String(cityName || '').trim();
    if (name.length < 2 || !mapRef.current) return;
    const low = name.toLowerCase();
    let coords: { lat: number; lng: number } | undefined = CITY_COORDS[name];
    // התאמה לפי תרגום (שם מתורגם → מפתח עברי)
    if (!coords) {
      const heKey = Object.keys((t as any).cities || {}).find(k => String((t as any).cities[k]).trim().toLowerCase() === low);
      if (heKey && CITY_COORDS[heKey]) coords = CITY_COORDS[heKey];
    }
    // התאמה חלקית — עיר שמכילה את מה שהוקלד (תחילית קודם)
    if (!coords) {
      const keys = Object.keys(CITY_COORDS);
      const hit = keys.find(k => k.toLowerCase().startsWith(low)) || keys.find(k => k.toLowerCase().includes(low));
      if (hit) coords = CITY_COORDS[hit];
    }
    // גיבוי — מנקה שעירו מכילה את מה שהוקלד
    if (!coords) {
      const cl = ALL_CLEANERS.find((c: any) => String(c.city || '').toLowerCase().includes(low));
      if (cl?.lat && cl?.lng) coords = { lat: cl.lat, lng: cl.lng };
    }
    if (coords) {
      mapRef.current.animateToRegion({ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.18, longitudeDelta: 0.18 }, 650);
    }
  };
  const [region,     setRegion]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [searchSugg, setSearchSugg] = useState<{label:string; icon:string}[]>([]);
  const [showSearchSugg, setShowSearchSugg] = useState(false);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [profile,    setProfile]    = useState<any>(null);
  const [profileReviews, setProfileReviews] = useState(false); // נפתח ישר על חלק הביקורות
  const openProfileReviews = (c: any) => { setProfileReviews(true); setProfile(c); };
  const [booking,    setBooking]    = useState<any>(null);
  const [prebookData, setPrebookData] = useState<any>(null); // הזמנה קודמת לחזרה
  const [chatWith,   setChatWith]   = useState<any>(null);
  const [drawer,     setDrawer]     = useState(false);
  const [userCoords,    setUserCoords]    = useState<{ lat: number; lng: number } | null>(null);
  // דגל רינדור לסמן המיקום — חייב להתחיל true כדי שה-View ייצויר ויופיע באנדרואיד
  const [dotTracks,     setDotTracks]     = useState(true);
  const [tracksMarkers, setTracksMarkers] = useState(true); // ביצועי מפה — מפסיק לעקוב אחרי טעינת הסמנים
  const [mapRegion,     setMapRegion]     = useState<any>(REGION_DEFAULTS.all); // אזור המפה הנוכחי — לרינדור סמנים בתצוגה בלבד
  const [nearbyMode,    setNearbyMode]    = useState(false);
  const [realCleaners,  setRealCleaners]  = useState<any[]>([]);
  // סדר ערבוב קבוע לכל הסשן — מחושב פעם אחת בפתיחת האפליקציה
  const staticCleanerOrderRef = useRef<any[]>([...CLEANERS].sort(() => Math.random() - 0.5));

  // Advanced filter
  const [filterVisible,  setFilterVisible]  = useState(false);
  const [filterMinRating,setFilterMinRating]= useState(0);
  const [filterMaxPrice, setFilterMaxPrice] = useState(999);
  const [filterAvailOnly,setFilterAvailOnly]= useState(false);
  const [filterTypes,    setFilterTypes]    = useState<string[]>([]);
  const [filterCity,     setFilterCity]     = useState('');
  const [filterCitySugg, setFilterCitySugg] = useState<string[]>([]);
  const [showFilterCitySugg, setShowFilterCitySugg] = useState(false);
  // התמקדות במפה כשבוחרים עיר בסינון
  useEffect(() => { if (filterCity.trim()) focusCityRef.current(filterCity.trim()); }, [filterCity]);
  // חישוב הצעות ערים לשדה הסינון
  const computeFilterCitySugg = (text: string) => {
    setFilterCity(text);
    const q = text.trim().toLowerCase();
    if (q.length < 1) { setFilterCitySugg([]); setShowFilterCitySugg(false); return; }
    const names = Array.from(new Set([
      ...ALL_CLEANERS.map((c: any) => String(c.city || '')),
      ...Object.keys(CITY_COORDS),
    ])).filter(Boolean);
    const matches = names.filter(c => c.toLowerCase().includes(q));
    matches.sort((a, b) => {
      const ap = a.toLowerCase().startsWith(q) ? 0 : 1;
      const bp = b.toLowerCase().startsWith(q) ? 0 : 1;
      return ap !== bp ? ap - bp : a.localeCompare(b, 'he');
    });
    setFilterCitySugg(matches.slice(0, 6));
    setShowFilterCitySugg(matches.length > 0);
  };

  // תפקיד המשתמש
  const [myRole,         setMyRole]         = useState<'client' | 'cleaner' | null>(null);
  const [cleanerPendingCount, setCleanerPendingCount] = useState(0);
  const [newBookingFlash, setNewBookingFlash] = useState(false);
  const prevCleanerPendingRef = useRef(-1);
  const cleanerPendingUnsubRef = useRef<(() => void) | null>(null);

  // Unread messages
  const [unreadCount,    setUnreadCount]    = useState(0);

  // Recurring rebook
  const [myBookings,     setMyBookings]     = useState<any[]>([]);
  const [pendingCleanerIds, setPendingCleanerIds] = useState<Set<string>>(new Set());
  const [rebookAlert,    setRebookAlert]    = useState<any | null>(null);

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

  // Urgent cleaning
  const urgentScrollRef = useRef<ScrollView>(null);
  const [urgentOpen,      setUrgentOpen]      = useState(false);
  const [urgentDate,      setUrgentDate]      = useState<'today'|'tomorrow'>('today');
  const [urgentHour,      setUrgentHour]      = useState(10);
  const [urgentHours,     setUrgentHours]     = useState(2);
  // שעת מינימום לדחוף: ל"היום" — מהשעה הנוכחית מעוגלת לחצי שעה הבא; ל"מחר" — 7:00
  const urgentMinHour = urgentDate === 'today'
    ? Math.min(23.5, Math.ceil((new Date().getHours() + new Date().getMinutes() / 60) * 2) / 2)
    : 7;
  // ודא שהשעה שנבחרה אינה בעבר (בפתיחת המודאל / החלפת תאריך)
  useEffect(() => {
    if (urgentOpen && urgentHour < urgentMinHour) setUrgentHour(urgentMinHour);
  }, [urgentOpen, urgentDate]);
  const [urgentServiceTypes,   setUrgentServiceTypes]   = useState<string[]>([]);
  const toggleUrgentServiceType = (tp: string) => setUrgentServiceTypes(prev => prev.includes(tp) ? prev.filter(x => x !== tp) : [...prev, tp]);
  const [urgentServiceDropOpen, setUrgentServiceDropOpen] = useState(false);
  const [urgentAddress,   setUrgentAddress]   = useState('');
  const [urgentPayment,   setUrgentPayment]   = useState('cash');
  const [urgentMaxPrice,  setUrgentMaxPrice]  = useState(80); // סכום מקסימלי לשעה — מסנן מנקים בטווח
  const [urgentSending,   setUrgentSending]   = useState(false);
  const [urgentWaiting,   setUrgentWaiting]   = useState(false);
  const [urgentRequestId, setUrgentRequestId] = useState<string|null>(null);
  const [urgentFoundName, setUrgentFoundName] = useState('');
  const [urgentSavedAddresses, setUrgentSavedAddresses] = useState<SavedAddress[]>([]);

  // ── הזמנות קודמות — חזרה על הזמנה קודמת ───────────────────────────────────
  const [quickRebookOpen, setQuickRebookOpen] = useState(false);


  // ── טען ברירות מחדל חכמות כשניקוי דחוף נפתח ─────────────────────────────
  useEffect(() => {
    if (!urgentOpen) return;
    // טען כתובות שמורות + כתובת ראשית
    getSavedAddresses().then(addrs => {
      setUrgentSavedAddresses(addrs);
      const primary = addrs.find(a => a.isPrimary) || addrs[0];
      if (primary) setUrgentAddress(primary.address);
    }).catch(() => {});
    // אמצעי תשלום אחרון
    SecureStore.getItemAsync('last_payment_method').then(pay => {
      if (pay) setUrgentPayment(pay as any);
    }).catch(() => {});
    // שעה הבאה הזמינה (עגול ל-30 דקות + 30 דקות קדימה)
    const now   = new Date();
    const mins  = now.getHours() * 60 + now.getMinutes();
    const nextSlot = Math.min(Math.ceil((mins + 30) / 30) * 30, 22 * 60);
    setUrgentHour(nextSlot / 60);
    setUrgentDate('today');
    setUrgentHours(2);
  }, [urgentOpen]);


  // ── כפתור חזרה אנדרואיד ──────────────────────────────────────────────────────
  const lastBackPress = useRef(0);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // סגור תפריט/מודל פתוח תחילה
      if (showSearchSugg || search.trim()) { setSearch(''); setSearchSugg([]); setShowSearchSugg(false); return true; }
      if (drawer)        { setDrawer(false);       return true; }
      if (profile)       { setProfile(null);        return true; }
      if (booking)       { setBooking(null);         return true; }
      if (chatWith)      { setChatWith(null);        return true; }
      if (filterVisible) { setFilterVisible(false); return true; }
      if (urgentOpen)       { setUrgentOpen(false);       return true; }
      if (quickRebookOpen)  { setQuickRebookOpen(false);  return true; }
      if (photoViewerOpen)  { setPhotoViewerOpen(false);   return true; }
      if (reportOpen)    { setReportOpen(false);    return true; }

      // שתי לחיצות לצאת
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        Alert.alert(
          t.exitTitle || 'יציאה מהאפליקציה',
          t.exitMsg   || 'האם אתה בטוח שברצונך לצאת?',
          [
            { text: t.cancelKeepBooking || 'ביטול', style: 'cancel' },
            { text: t.exitConfirm       || 'צא', style: 'destructive', onPress: () => BackHandler.exitApp() },
          ]
        );
      } else {
        lastBackPress.current = now;
      }
      return true;
    });
    return () => sub.remove();
  }, [drawer, profile, booking, chatWith, filterVisible, urgentOpen, quickRebookOpen, photoViewerOpen, reportOpen, search, showSearchSugg]);

  const handleSendUrgent = async () => {
    if (urgentServiceTypes.length === 0)
      return Alert.alert(t.error, (t as any).selectServiceTypeMulti ?? 'בחר/י סוג שירות');
    if (!urgentAddress.trim() || urgentAddress.trim().length < 5)
      return Alert.alert(t.error, t.addressTooShort);
    if (!/\d/.test(urgentAddress))
      return Alert.alert(t.error, t.addressNoNumber);
    if (!urgentPayment)
      return Alert.alert(t.error, (t as any).selectPaymentMethod ?? 'בחר/י אמצעי תשלום');
    // לא ניתן להזמין לשעה שכבר עברה (היום)
    if (urgentDate === 'today') {
      const nowH = new Date().getHours() + new Date().getMinutes() / 60;
      if (urgentHour < nowH) {
        return Alert.alert(t.error, (t as any).urgentPastTime ?? 'לא ניתן להזמין לשעה שכבר עברה. בחר/י שעה מאוחרת יותר ⏰');
      }
    }
    // שמור כתובת ותשלום לשימוש עתידי
    upsertAddress(urgentAddress.trim()).then(() =>
      getSavedAddresses().then(setUrgentSavedAddresses)
    ).catch(() => {});
    SecureStore.setItemAsync('last_payment_method', urgentPayment).catch(() => {});
    setUrgentSending(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      let clientName = 'לקוח';
      let clientLat = userCoords?.lat ?? 32.08;
      let clientLng = userCoords?.lng ?? 34.78;
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        clientName = snap.data()?.name || 'לקוח';
      } catch (_) {}

      const today = new Date();
      const targetDate = new Date(today);
      if (urgentDate === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
      // תאריך מקומי (לא UTC) — אחרת התאריך עלול לזוז ביום
      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;

      const hh = String(Math.floor(urgentHour)).padStart(2,'0');
      const mm = urgentHour % 1 === 0.5 ? '30' : '00';

      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      const reqRef = await addDoc(collection(db, 'urgentRequests'), {
        clientUid: uid, clientName,
        address: urgentAddress.trim(),
        lat: clientLat, lng: clientLng,
        date: urgentDate, dateStr,
        startTime: `${hh}:${mm}`,
        hours: urgentHours,
        serviceType: urgentServiceTypes.join(' + '),
        paymentMethod: urgentPayment,
        maxPrice: urgentMaxPrice,
        pricePerHour: urgentMaxPrice,
        total: urgentHours * urgentMaxPrice,
        status: 'open',
        createdAt: new Date().toISOString(),
        expiresAt,
        notifiedCleaners: [],
      });
      setUrgentRequestId(reqRef.id);

      // ניקיון דחוף זמין בכל שעה (הוסרה הגבלת השעה)
      try {
        const nowHour = new Date().getHours();
        if (nowHour >= 24) { // לעולם לא — ההגבלה בוטלה
          await updateDoc(doc(db,'urgentRequests', reqRef.id), { status: 'expired' });
          Alert.alert(t.urgentAfterHoursTitle, '');
          setUrgentSending(false);
          return;
        } else {
        const cleanersSnap = await getDocs(query(collection(db,'users'), where('role','==','cleaner')));
        const notified: string[] = [];
        const noLocation = !userCoords; // אין מיקום — שלח לכולם

        // ── מנקים שכבר תפוסים בניקיון אחר בשעות החופפות לדחוף — לא נשלח להם פוש ──
        const urgentStart = new Date(`${dateStr}T${hh}:${mm}`);
        const urgentEnd   = new Date(urgentStart.getTime() + urgentHours * 3600000);
        const busyByCleaner: Record<string, boolean> = {};
        try {
          const sameDaySnap = await getDocs(query(collection(db,'bookings'), where('bookingDate','==',dateStr)));
          sameDaySnap.docs.forEach(d => {
            const b: any = d.data();
            if (['cancelled','done'].includes(b.status)) return;     // בוטל/הסתיים — לא תופס
            if (!b.cleanerId || !b.startTime) return;
            const [bh, bm] = String(b.startTime).split(':').map(Number);
            const bStart = new Date(urgentStart); bStart.setHours(bh || 0, bm || 0, 0, 0);
            const bEnd   = new Date(bStart.getTime() + (Number(b.hours) || 1) * 3600000);
            if (urgentStart < bEnd && urgentEnd > bStart) busyByCleaner[b.cleanerId] = true; // חפיפה
          });
        } catch (_) {}

        for (const cd of cleanersSnap.docs) {
          const cData = cd.data();

          // מרחק ההגעה המקסימלי שהמנקה בחר/ה בהרשמה (ברירת מחדל 30 ק"מ אם לא הוגדר)
          const cleanerMaxKm = Number(cData.maxDistance) > 0 ? Number(cData.maxDistance) : 30;

          // בדוק מרחק — אם אין מיקום ללקוח או למנקה, שלח בכל מקרה
          let inRange = noLocation;
          if (!noLocation) {
            // נסה lat/lng מהפרופיל, fallback לפי עיר מהמערך הסטטי
            let cLat = cData.lat;
            let cLng = cData.lng;
            if (!cLat || !cLng) {
              const staticCleaner = CLEANERS.find(c =>
                c.id === cd.id ||
                (cData.city && c.city === cData.city)
              );
              if (staticCleaner) { cLat = staticCleaner.lat; cLng = staticCleaner.lng; }
            }
            if (cLat && cLng) {
              // שולחים רק אם הלקוח בתוך טווח ההגעה שהמנקה בחר/ה
              inRange = getDistanceKm(clientLat, clientLng, cLat, cLng) <= cleanerMaxKm;
            } else {
              inRange = true; // אין מיקום למנקה — שלח לו בכל מקרה
            }
          }

          if (!inRange) continue;

          // סינון לפי טווח מחיר — שולחים רק למנקה שמחירו לשעה ≤ הסכום המקסימלי שהלקוח בחר
          const cPrice = Number(cData.price || 0);
          if (cPrice > 0 && cPrice > urgentMaxPrice) continue;

          // מנקה תפוס בניקיון אחר בשעות החופפות — לא לשלוח לו פוש
          if (busyByCleaner[cd.id]) continue;

          notified.push(cd.id);

          // שלח Push Notification למנקה
          const pushToken = cData.pushToken || '';
          if (pushToken) {
            const dateLabel = urgentDate === 'today' ? 'היום' : 'מחר';
            const msgTotal  = urgentHours * urgentMaxPrice;
            await sendPushNotification(
              pushToken,
              `🚨 ניקוי דחוף! — ${dateLabel} ${hh}:${mm}`,
              `${urgentServiceTypes.length ? urgentServiceTypes.map(st => t.types[st] || st).join(', ') + ' · ' : ''}📍 ${urgentAddress.trim()} · ⏱️ ${urgentHours} שעות · ₪${msgTotal}`,
              { type: 'urgent', urgent: true, requestId: reqRef.id, tab: 'urgent' },
              { channelId: 'urgent', color: '#ff1744' }
            );
            console.log('[PUSH → urgent]', cData.name);
          } else {
            console.warn('[PUSH] אין pushToken למנקה:', cData.name);
          }
        }

        await updateDoc(doc(db,'urgentRequests', reqRef.id), { notifiedCleaners: notified });

        if (notified.length === 0) {
          Alert.alert('', t.urgentNoCleaners);
          await updateDoc(doc(db,'urgentRequests', reqRef.id), { status: 'expired' });
          setUrgentSending(false);
          return;
        }
        } // סוף else (אחרי 20:00 לא שולחים)
      } catch (_) {}

      setUrgentWaiting(true);
      setUrgentOpen(false); // סגור מודל מיד — חזור למסך הראשי
      const releaseTimer = setTimeout(() => {}, 0); // dummy

      // האזן לשינוי סטטוס — כשמנקה מקבל
      const unsub = onSnapshot(doc(db,'urgentRequests', reqRef.id), snap => {
        const d = snap.data();
        if (d?.status === 'taken') {
          setUrgentFoundName(d.takenByName || '');
          setUrgentWaiting(false);
          clearTimeout(releaseTimer);
          unsub();
          Alert.alert('🎉 ' + t.urgentFoundMsg, d.takenByName || '');
        } else if (d?.status === 'expired' || d?.status === 'cancelled') {
          setUrgentWaiting(false);
          setUrgentRequestId(null);
          clearTimeout(releaseTimer);
          unsub();
        }
      });
    } catch (_) {}
    setUrgentSending(false);
  };

  const handleCancelUrgent = async () => {
    if (!urgentRequestId) return;
    try { await updateDoc(doc(db,'urgentRequests',urgentRequestId), { status: 'cancelled' }); } catch(_) {}
    setUrgentWaiting(false);
    setUrgentRequestId(null);
    setUrgentFoundName('');
  };

  // ── פופאפ אישור הזמנה ──────────────────────────────────────────────────────
  const [confirmedPopup,       setConfirmedPopup]       = useState<any>(null);
  const seenConfirmedRef = useRef<Set<string>>(new Set());

  // Mandatory review
  const [isBlocked,            setIsBlocked]            = useState(false);
  const [pendingReviewBooking, setPendingReviewBooking] = useState<any>(null);
  const [showMandatoryReview,  setShowMandatoryReview]  = useState(false);
  const [mandatoryStars,       setMandatoryStars]       = useState(0);
  const [mandatoryComment,     setMandatoryComment]     = useState('');
  const [mandatorySubmitting,  setMandatorySubmitting]  = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastMsg,     setToastMsg]     = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType,    setToastType]    = useState<'success' | 'error' | 'info'>('success');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg); setToastType(type); setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2800);
  };

  const handleSendReport = async () => {
    if (!reportDesc.trim()) return;
    setReportSending(true);
    try {
      await addDoc(collection(db, 'reports'), {
        type: reportType,
        target: reportTarget.trim(),
        description: reportDesc.trim(),
        reportedBy: auth.currentUser?.uid || '',
        createdAt: new Date().toISOString(),
      });
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


  // מנקים אמיתיים ראשונים, ואחריהם 200 בוטים מפוזרים בכל הערים
  const ALL_CLEANERS = [
    ...realCleaners.filter(r => !CLEANERS.some(c => c.id === r.id)),
    ...BOTS,
  ];

  // ── Search autocomplete ────────────────────────────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (text.length < 1) { setSearchSugg([]); setShowSearchSugg(false); return; }
    const sq = text.toLowerCase();
    // הצעות ערים — מתוך כל ערי הארץ (CITY_COORDS) + ערים של מנקים, תחילית קודמת
    const cleanerCities = ALL_CLEANERS.map(c => String(c.city || ''));
    const allCityNames = Array.from(new Set([...cleanerCities, ...Object.keys(CITY_COORDS)])).filter(Boolean);
    const cityMatches = allCityNames.filter(c => c.toLowerCase().includes(sq));
    // תחילית (מתחיל ב-) קודם, אחר כך הכלה — כך "ראשי תיבות" של עיר מקפיצים אותה ראשונה
    cityMatches.sort((a, b) => {
      const ap = a.toLowerCase().startsWith(sq) ? 0 : 1;
      const bp = b.toLowerCase().startsWith(sq) ? 0 : 1;
      return ap !== bp ? ap - bp : a.localeCompare(b, 'he');
    });
    const cities = cityMatches.slice(0, 6).map(c => ({ label: c, icon: '📍' }));
    const names   = ALL_CLEANERS
      .filter(c => String(c.name || '').toLowerCase().includes(sq))
      .slice(0, 3)
      .map(c => ({ label: String(c.name), icon: '🧹' }));
    const types   = Array.from(new Set(ALL_CLEANERS.flatMap(c => Array.isArray(c.types) ? c.types : [])))
      .filter(tp => String(tp).toLowerCase().includes(sq))
      .slice(0, 3)
      .map(tp => ({ label: String(tp), icon: '🔧' }));
    const combined = [...cities, ...names, ...types].slice(0, 8);
    setSearchSugg(combined);
    setShowSearchSugg(combined.length > 0);
  };

  // ── פילטר ראשי ──────────────────────────────────────────────────────────────
  let filtered = [...ALL_CLEANERS];

  // 1. חיפוש חופשי — שם / עיר / סוג שירות (עדיפות ראשונה)
  if (search.trim()) {
    const sq = search.trim().toLowerCase();
    filtered = filtered.filter(c => {
      const nameMatch = String(c.name || '').toLowerCase().includes(sq);
      const cityHe    = String(c.city || '').toLowerCase();
      const cityTr    = String(t.cities[c.city] || '').toLowerCase();
      const cityMatch = cityHe.includes(sq) || cityTr.includes(sq);
      const typeMatch = (Array.isArray(c.types) ? c.types : []).some((tp: string) => {
        const tpTr = String(t.types[tp] || '').toLowerCase();
        return String(tp).toLowerCase().includes(sq) || tpTr.includes(sq);
      });
      return nameMatch || cityMatch || typeMatch;
    });
  }

  // 2. אזור (טאב) — מתעלמים ממנו כשמחפשים/מסננים לפי עיר (אחרת העיר "נעלמת" מהאזור)
  if (region !== 'all' && !search.trim() && !filterCity.trim()) {
    filtered = filtered.filter(c => {
      if (c.isReal) return true; // מנקים אמיתיים תמיד מוצגים, בכל לשונית אזור
      const cr = String(c.region || '');
      const ca = Array.isArray(c.workAreas) ? c.workAreas : [];
      return cr === region || ca.includes(region);
    });
  }

  // 3. עיר ממודאל (עצמאי מהאזור)
  if (filterCity.trim()) {
    const cq = filterCity.trim().toLowerCase();
    filtered = filtered.filter(c => {
      const cityHe = String(c.city || '').toLowerCase();
      const cityTr = String(t.cities[c.city] || '').toLowerCase();
      return cityHe.includes(cq) || cityTr.includes(cq);
    });
  }

  // 5. מחיר מקסימלי
  if (filterMaxPrice < 999) {
    filtered = filtered.filter(c => Number(c.price || 0) <= filterMaxPrice);
  }

  // 6. דירוג מינימלי
  if (filterMinRating > 0) {
    filtered = filtered.filter(c => Number(c.rating || 0) >= filterMinRating);
  }

  // 7. זמינים בלבד
  if (filterAvailOnly) {
    filtered = filtered.filter(c => !!c.available);
  }

  // 8. סוגי שירות
  if (filterTypes.length > 0) {
    filtered = filtered.filter(c =>
      filterTypes.some(ft => (Array.isArray(c.types) ? c.types : []).includes(ft))
    );
  }

  // המפה מציגה את כל המנקים (בכל הארץ) — לא מוגבלת ל-30 ק"מ
  const mapFiltered = filtered;
  // "קרוב אלי" מסנן רק את רשימת הכרטיסים (ל-30 ק"מ) — אך לא כשמחפשים/מסננים עיר
  if (nearbyMode && userCoords && !search.trim() && !filterCity.trim()) {
    const nearby = filtered.filter(c => getDistanceKm(userCoords.lat, userCoords.lng, c.lat, c.lng) <= NEARBY_KM);
    if (nearby.length > 0) filtered = nearby;
  }

  // Count active filters for badge
  const activeFilterCount = (filterMinRating > 0 ? 1 : 0) + (filterMaxPrice < 999 ? 1 : 0) + (filterAvailOnly ? 1 : 0) + filterTypes.length + (region !== 'all' ? 1 : 0) + (filterCity.trim() ? 1 : 0);

  useEffect(() => {
    if (!mapRef.current || !selected) return;
    const c = [...CLEANERS, ...realCleaners].find(x => x.id === selected);
    if (c) mapRef.current.animateToRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
  }, [selected, realCleaners]);

  // גלול לכרטיס הנבחר ברשימה
  useEffect(() => {
    if (!selected || !flatListRef.current) return;
    const idx = filtered.findIndex(x => x.id === selected);
    if (idx >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
      }, 100);
    }
  }, [selected]);

  useEffect(() => {
    if (!mapRef.current) return;
    const trimmed = search.trim().toLowerCase();
    if (trimmed.length < 2) return;
    // חיפוש בתוצאות המסוננות — גם בעברית וגם בשפה הנבחרת
    const exact   = filtered.find(c =>
      c.city.toLowerCase() === trimmed || String(t.cities[c.city] || '').toLowerCase() === trimmed
    );
    const partial = filtered.find(c =>
      c.city.toLowerCase().includes(trimmed) || String(t.cities[c.city] || '').toLowerCase().includes(trimmed)
    );
    const match   = exact || partial;
    if (match) {
      mapRef.current.animateToRegion(
        { latitude: match.lat, longitude: match.lng, latitudeDelta: 0.3, longitudeDelta: 0.3 },
        600,
      );
    }
  }, [search]);

  // Request location once on mount — auto-enable nearby mode
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setNearbyMode(true);
      // אפשר לסמן להצטלם פעם אחת, ואז לכבות tracking לחיסכון בביצועים
      setDotTracks(true);
      setTimeout(() => setDotTracks(false), 2500);
    })();
  }, []);

  // חזרה למיקום המשתמש (כפתור צף על המפה)
  const handleRecenter = async () => {
    try {
      let coords = userCoords;
      if (!coords) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { Alert.alert(t.error, t.locationPermDenied); return; }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
      }
      setNearbyMode(true);
      mapRef.current?.animateToRegion(
        { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.5, longitudeDelta: 0.58 },
        600,
      );
    } catch (_) { Alert.alert(t.error, t.locationError); }
  };

  // ביצועי מפה — אפשר מעקב סמנים לזמן קצר אחרי שינוי, ואז כבה (גלילה חלקה)
  useEffect(() => {
    setTracksMarkers(true);
    const id = setTimeout(() => setTracksMarkers(false), 1500);
    return () => clearTimeout(id);
  }, [region, nearbyMode, search, realCleaners.length, filterMinRating, filterMaxPrice, filterAvailOnly, filterTypes.length]);

  // Set Android navigation bar color
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#F4F8FD').catch(() => {});
      NavigationBar.setButtonStyleAsync('dark').catch(() => {});
    }
  }, []);

  // Load user data + my bookings from Firestore
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.blockedUntilReview) setIsBlocked(true);
        if (data?.role === 'cleaner') {
          setMyRole('cleaner');
          // האזן בזמן אמת להזמנות ממתינות עבור מנקה
          if (cleanerPendingUnsubRef.current) cleanerPendingUnsubRef.current();
          const pendingQ = query(collection(db, 'bookings'), where('cleanerId', '==', uid), where('status', '==', 'pending'));
          cleanerPendingUnsubRef.current = onSnapshot(pendingQ, snap => {
            const count = snap.size;
            if (prevCleanerPendingRef.current >= 0 && count > prevCleanerPendingRef.current) {
              setNewBookingFlash(true);
              setTimeout(() => setNewBookingFlash(false), 6000);
              // פופ-אפ באפליקציה: הזמנה חדשה (ללא תלות בהתראות פוש)
              const newest = snap.docs.map(d => d.data() as any)
                .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
              if (newest) {
                Alert.alert('🔔 ' + (t.newBookingTitle || 'הזמנה חדשה ממתינה לאישור'),
                  `${newest.clientName || ''}${newest.bookingDate ? ' · ' + newest.bookingDate : ''}${newest.startTime ? ' ' + newest.startTime : ''}${newest.address ? '\n📍 ' + newest.address : ''}`);
              }
            }
            prevCleanerPendingRef.current = count;
            setCleanerPendingCount(count);
          }, () => {});
        } else {
          setMyRole('client');
        }
      } else {
        // משתמש קיים אך ללא מסמך — סמן כלקוח
        setMyRole('client');
      }
    }).catch(() => { setMyRole('client'); });

    // Load client bookings for recurring rebook detection + mandatory review
    // ללא orderBy כדי להימנע מ-composite index — המיון נעשה ב-JS
    getDocs(query(collection(db, 'bookings'), where('clientUid', '==', uid)))
      .then(async snap => {
        const bks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        bks.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setMyBookings(bks);
        // סמן מנקים עם הזמנה ממתינה/מאושרת
        const pendingIds = new Set<string>(
          bks.filter((b: any) => ['pending','confirmed'].includes(b.status)).map((b: any) => b.cleanerId)
        );
        setPendingCleanerIds(pendingIds);
        // Show rebook card for any past done booking (most recent)
        const lastDone = bks.find((b: any) => b.status === 'done');
        if (lastDone) setRebookAlert(lastDone);

        // Check for pending mandatory reviews
        const nowD = new Date();
        const pastEndTime = (b: any) => {
          if (!b.bookingDate || !b.startTime) return false;
          const end = new Date(b.bookingDate + 'T' + b.startTime);
          if (isNaN(end.getTime())) return false;
          end.setHours(end.getHours() + (Number(b.hours) || 1));
          // רק הזמנות שהסתיימו לאחרונה (עד 3 ימים) — מונע "מפולת" ביקורות מנתוני בדיקה ישנים
          return end < nowD && end > new Date(nowD.getTime() - 3 * 86400000);
        };
        const pending = bks.filter((b: any) => {
          if (b.cleanerRating) return false;            // כבר דורג
          if (b.status === 'cancelled') return false;    // בוטל
          // 1) המנקה סימן סיום עבודה
          if (b.status === 'done' && b.reviewRequired === true) return true;
          // 2) זמן ההזמנה עבר (גם אם המנקה לא סימן סיום) — רק אם ההזמנה אושרה
          if (['confirmed','active','onway'].includes(b.status) && pastEndTime(b)) return true;
          return false;
        });
        const overdue = pending.filter((b: any) =>
          b.reviewDeadline && new Date(b.reviewDeadline) < new Date()
        );
        if (overdue.length > 0) {
          try { await updateDoc(doc(db, 'users', uid), { blockedUntilReview: true }); } catch (_) {}
          setIsBlocked(true);
          setPendingReviewBooking(overdue[0]);
          setShowMandatoryReview(true);
        } else if (pending.length > 0) {
          setPendingReviewBooking(pending[0]);
          setShowMandatoryReview(true);
        }
      }).catch(() => {});
    return () => {
      if (cleanerPendingUnsubRef.current) cleanerPendingUnsubRef.current();
    };
  }, []);

  // ── בקשת דירוג ללקוח בזמן אמת — פותח חלון דירוג מיד כשהזמנה מסתיימת ──────────
  useEffect(() => {
    if (myRole !== 'client') return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    // פילטר יחיד (clientUid) כדי להימנע מ-composite index — סינון status ב-JS
    const qDone = query(collection(db, 'bookings'), where('clientUid', '==', uid));
    // האם זמן ההזמנה הסתיים (גם אם המנקה שכח לסמן "סיום")
    const pastEnd = (b: any) => {
      if (!b.bookingDate || !b.startTime) return false;
      const end = new Date(b.bookingDate + 'T' + b.startTime);
      if (isNaN(end.getTime())) return false;
      end.setHours(end.getHours() + (Number(b.hours) || 1));
      const now = new Date();
      // רק הזמנות שהסתיימו לאחרונה (עד 3 ימים) — מונע "מפולת" ביקורות מנתוני בדיקה ישנים
      return end < now && end > new Date(now.getTime() - 3 * 86400000);
    };
    const unsub = onSnapshot(qDone, async snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // הערה: פופ-אפ אישור ההזמנה ללקוח מטופל אך ורק במאזין הייעודי (setConfirmedPopup)
      // כדי למנוע הקפצה כפולה. כאן מטפלים רק בדירוג חובה.
      const pend = all.filter((b: any) => {
        if (b.cleanerRating) return false;               // כבר דורג
        if (b.status === 'cancelled') return false;
        // 1) המנקה סימן סיום עבודה
        if (b.status === 'done' && b.reviewRequired === true) return true;
        // 2) המנקה שכח לסגור והזמן+השעה עברו — שלח דירוג אוטומטית
        if (['confirmed', 'active', 'onway'].includes(b.status) && pastEnd(b)) return true;
        return false;
      });
      if (pend.length === 0) return;
      // עבור הזמנות שהזמן עבר אך לא סומנו "done" — סמן אוטומטית done+reviewRequired
      for (const b of pend) {
        if (b.status !== 'done' || b.reviewRequired !== true) {
          try {
            await updateDoc(doc(db, 'bookings', b.id), {
              status: 'done', reviewRequired: true,
              reviewDeadline: b.reviewDeadline || new Date(Date.now() + 7 * 86400000).toISOString(),
              autoClosed: true,
            });
            b.status = 'done'; b.reviewRequired = true;
          } catch (_) {}
        }
      }
      // עדכן את ההזמנה ברשימה כדי שתופיע מעודכנת
      setMyBookings(prev => prev.map(b => {
        const m = pend.find((p: any) => p.id === b.id);
        return m ? { ...b, ...m } : b;
      }));
      setPendingReviewBooking((cur: any) => cur || pend[0]);
      setShowMandatoryReview(true);
    }, () => {});
    return () => unsub();
  }, [myRole]);

  // ── פופאפ ניקוי דחוף למנקה — גם במסך הראשי ────────────────────────────────
  const [urgentPopupReq, setUrgentPopupReq] = useState<any>(null);
  const shownUrgentRef = useRef<Set<string>>(new Set()); // בקשות שכבר הוצגו — לא להקפיץ שוב
  const urgentInitedRef = useRef(false);
  useEffect(() => {
    if (myRole !== 'cleaner') return;
    const q = query(collection(db, 'urgentRequests'), where('status', '==', 'open'));
    const unsub = onSnapshot(q, async snap => {
      const now = new Date();
      const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((r: any) => r.expiresAt && new Date(r.expiresAt) > now);
      // טעינה ראשונית — מסמנים את כל הקיימות כ"הוצגו" בלי להקפיץ (מונע הקפצת backlog)
      if (!urgentInitedRef.current) {
        reqs.forEach((r: any) => shownUrgentRef.current.add(r.id));
        urgentInitedRef.current = true;
        return;
      }
      // רק בקשות חדשות ממש (שעוד לא הוצגו)
      const fresh = reqs.filter((r: any) => !shownUrgentRef.current.has(r.id));
      if (fresh.length === 0) return;
      const newest = [...fresh].sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
      if (!newest) return;
      shownUrgentRef.current.add(newest.id); // סמן מיד — לא להקפיץ פעמיים
      const uid = auth.currentUser?.uid;
      if (!uid || !newest.dateStr || !newest.startTime) { setUrgentPopupReq(newest); return; }
      try {
        const us = new Date(`${newest.dateStr}T${newest.startTime}`);
        const ue = new Date(us.getTime() + (Number(newest.hours) || 1) * 3600000);
        const bsnap = await getDocs(query(collection(db, 'bookings'), where('cleanerId', '==', uid), where('bookingDate', '==', newest.dateStr)));
        let skip = false;
        bsnap.docs.forEach(d => {
          const b: any = d.data();
          if (b.urgentRequestId === newest.id) { skip = true; return; } // כבר תפסתי את הבקשה הזו
          if (['cancelled', 'done'].includes(b.status) || !b.startTime) return;
          const [bh, bm] = String(b.startTime).split(':').map(Number);
          const bs = new Date(us); bs.setHours(bh || 0, bm || 0, 0, 0);
          const be = new Date(bs.getTime() + (Number(b.hours) || 1) * 3600000);
          if (us < be && ue > bs) skip = true; // תפוס בשעה חופפת
        });
        if (!skip) setUrgentPopupReq(newest);
      } catch (_) { setUrgentPopupReq(newest); }
    }, () => {});
    return () => unsub();
  }, [myRole]);

  // ── מאזין לאישור הזמנה ע"י מנקה → פופאפ ללקוח ─────────────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'bookings'), where('clientUid', '==', uid), orderBy('createdAt', 'desc'));
    let initialLoad = true;
    const unsub = onSnapshot(q, snap => {
      snap.docs.forEach(d => {
        const data = d.data();
        // סימון ראשוני — לא מציגים פופאפ על הזמנות שכבר היו confirmed
        if (initialLoad) {
          if (data.status === 'confirmed') seenConfirmedRef.current.add(d.id);
          return;
        }
        // זיהוי מעבר חדש ל-confirmed
        if (data.status === 'confirmed' && !seenConfirmedRef.current.has(d.id)) {
          seenConfirmedRef.current.add(d.id);
          setConfirmedPopup({ id: d.id, ...data });
        }
      });
      initialLoad = false;
    }, () => {});
    return () => unsub();
  }, []);

  // Load real cleaners from Firestore — בזמן אמת (מנקה חדש מופיע מיד)
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'users'), where('role', '==', 'cleaner')), snap => {
      const list = snap.docs.map(d => {
        const data = d.data();
        const coords = getCoordsForCleaner(data);
        return {
          id: d.id,
          name:       data.name        || 'מנקה',
          initials:   (data.name || 'מ').split(' ').map((w: string) => w[0]).join('').slice(0, 2),
          city:       data.city        || '',
          region:     data.workAreas?.[0] || 'center',
          workAreas:  data.workAreas   || [],
          types:      data.types       || [],
          price:      data.price       || 0,
          rating:     data.rating      || 0,
          reviews:    data.reviewCount || 0,
          available:  (() => {
            const nowTs = new Date();
            const slots: { from: string; until: string }[] = data.busySlots || [];
            const isBusy = slots.some(s => new Date(s.from) <= nowTs && nowTs < new Date(s.until));
            return isBusy ? false : data.available !== false;
          })(),
          payment:    data.payment     || [],
          lat:        coords.lat,
          lng:        coords.lng,
          bio:        data.bio         || '',
          phone:            data.phone             || '',
          showPhone:        data.showPhone        !== false,
          portfolio:        data.portfolio         || [],
          identityVerified: data.identityVerified === true,
          photoB64:      data.photoB64      || null,
          bringSupplies: data.bringSupplies !== undefined ? data.bringSupplies : null,
          reviewsList:   [],
          isReal:        true,
          uid:           d.id,
        };
      });
      // סדר יציב: זמינים קודם, ואז לפי דירוג ושם (בלי ערבוב שקופץ בכל עדכון)
      list.sort((a, b) => (Number(b.available) - Number(a.available)) || (b.rating - a.rating) || String(a.name).localeCompare(String(b.name)));
      setRealCleaners(list);

      // One-time precise geocoding: cleaners with an address but no saved lat/lng
      // get their full address geocoded so the pin sits on the real street
      // address (not the city centre). Update the displayed coords locally, and
      // persist back to Firestore only for the current user's own doc (rules).
      const myUid = auth.currentUser?.uid;
      snap.docs.forEach(async d => {
        const data: any = d.data();
        const hasCoords = typeof data.lat === 'number' && typeof data.lng === 'number' && !isNaN(data.lat) && !isNaN(data.lng);
        const addr = data.cleanerAddress || data.address;
        if (hasCoords || !addr || _geocodedCleaners.has(d.id)) return;
        _geocodedCleaners.add(d.id);
        try {
          const results = await Location.geocodeAsync(String(addr));
          const r = results && results[0];
          if (r && typeof r.latitude === 'number') {
            setRealCleaners(prev => prev.map(c => c.id === d.id ? { ...c, lat: r.latitude, lng: r.longitude } : c));
            if (myUid && d.id === myUid) {
              await updateDoc(doc(db, 'users', d.id), { lat: r.latitude, lng: r.longitude });
            }
          }
        } catch (_) {}
      });
    }, () => {});
    return () => unsub();
  }, []);

  // Zoom to user location whenever nearbyMode turns on (or coords arrive while mode is on)
  // ── מאזין הודעות לא נקראות ────────────────────────────────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', uid));
    const unsub = onSnapshot(q, snap => {
      const count = snap.docs.filter(d => (d.data().unreadBy || []).includes(uid)).length;
      setUnreadCount(count);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (nearbyMode && userCoords && mapRef.current) {
      // תצוגה רחבה יותר סביב מיקום המשתמש (~45 ק"מ)
      mapRef.current.animateToRegion(
        { latitude: userCoords.lat, longitude: userCoords.lng, latitudeDelta: 0.5, longitudeDelta: 0.58 },
        700,
      );
    }
  }, [nearbyMode, userCoords]);

  const handleNearby = () => {
    if (!userCoords) {
      // Location not ready yet — try to fetch again
      Alert.alert(t.error, t.locationDenied);
      return;
    }
    const next = !nearbyMode;
    setNearbyMode(next);
    if (next) {
      setRegion('all');
      setSearch('');
    }
  };

  const handleRegion = (key: string) => {
    setRegion(key);
    setSelected(null);
    setNearbyMode(false);
    if (key === 'all') setSearch('');
    mapRef.current?.animateToRegion(REGION_DEFAULTS[key], 600);
  };

  const handleMandatoryReviewSubmit = async () => {
    if (!mandatoryStars || !pendingReviewBooking) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setMandatorySubmitting(true);
    try {
      // Save rating + comment to booking
      await updateDoc(doc(db, 'bookings', pendingReviewBooking.id), {
        cleanerRating: mandatoryStars,
        cleanerReviewText: mandatoryComment.trim(),
        reviewRequired: false,
        reviewedAt: new Date().toISOString(),
        status: 'done',
      });
      // עדכון ציון + מספר ביקורות של המנקה — טרנזקציה אטומית (נגד אובדן עדכון בתחרות)
      const cleanerRef = doc(db, 'users', pendingReviewBooking.cleanerId);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(cleanerRef);
          if (!snap.exists()) return;
          const d = snap.data();
          const oldRating = d.rating || 0;
          const oldCount  = d.reviewCount || d.reviews || 0;
          const newCount  = oldCount + 1;
          const newRating = Math.round(((oldRating * oldCount) + mandatoryStars) / newCount * 10) / 10;
          tx.update(cleanerRef, { rating: newRating, reviewCount: newCount, reviews: newCount });
        });
      } catch (_) {}
      // הוסף לתת-אוסף הביקורות (תמיד נשמר — גם אם עדכון הציון נכשל)
      try {
        let reviewerName = auth.currentUser?.displayName || '';
        if (!reviewerName) { try { const us = await getDoc(doc(db, 'users', auth.currentUser?.uid || '')); reviewerName = us.data()?.name || 'לקוח'; } catch (_) { reviewerName = 'לקוח'; } }
        await addDoc(collection(db, 'users', pendingReviewBooking.cleanerId, 'reviews'), {
          stars: mandatoryStars,
          text: mandatoryComment.trim(),
          clientName: reviewerName,
          createdAt: new Date().toISOString(),
        });
      } catch (_) {}
      // Check if any more pending reviews
      const remaining = myBookings.filter((b: any) =>
        b.id !== pendingReviewBooking.id && b.status === 'done' && b.reviewRequired === true && !b.cleanerRating
      );
      if (remaining.length === 0) {
        try { await updateDoc(doc(db, 'users', uid), { blockedUntilReview: false }); } catch (_) {}
        setIsBlocked(false);
      } else {
        setPendingReviewBooking(remaining[0]);
        setMandatoryStars(0);
        setMandatoryComment('');
        setMandatorySubmitting(false);
        return;
      }
      setShowMandatoryReview(false);
      setPendingReviewBooking(null);
      setMandatoryStars(0);
      setMandatoryComment('');
      showToast('✅ הביקורת נשלחה — תודה!');
    } catch (_) {
      showToast(t.error + ' — שגיאה בשליחת הביקורת', 'error');
    } finally {
      setMandatorySubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t.logoutConfirm, t.logoutMsg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.logoutConfirm, style: 'destructive', onPress: async () => {
          await SecureStore.deleteItemAsync('remember_email').catch(() => {});
          await SecureStore.deleteItemAsync('remember_pass').catch(() => {});
          await signOut(auth);
          router.replace('/');
        }
      },
    ]);
  };

  return (
    <SafeAreaViewCtx style={s.wrap} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={{ backgroundColor: '#FFFFFF', flexShrink: 0, paddingTop: Platform.OS === 'ios' ? insets.top : (StatusBar.currentHeight || 0) }}>
        <View style={s.header}>
          <View style={[s.headerLogoRow, flipSide && { flexDirection: 'row-reverse' }]}>
            {/* כפתור נגישות — צד שמאל (מוחלף לימין במצב שמאלי) */}
            <TouchableOpacity
              onPress={() => setA11yOpen(true)}
              style={s.a11yBtn}
              accessibilityRole="button"
              accessibilityLabel={t.accessibilityTitle || 'נגישות'}
            >
              <MaterialIcons name="accessibility" size={22} color={C.blueDark} />
            </TouchableOpacity>

            {/* כפתורי אמצע */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {/* הודעות */}
              <TouchableOpacity
                onPress={() => router.push('/messages')}
                style={s.msgIconBtn}
                accessibilityRole="button"
                accessibilityLabel={unreadCount > 0 ? `הודעות — ${unreadCount} חדשות` : 'הודעות'}
              >
                <T style={s.msgIconText}>💬</T>
                {unreadCount > 0 && (
                  <View style={s.msgBadge}>
                    <T style={s.msgBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</T>
                  </View>
                )}
              </TouchableOpacity>

              {myRole === 'client' && (
                <TouchableOpacity
                  onPress={() => setFilterVisible(true)}
                  style={[s.urgentHeaderBtn, { backgroundColor: activeFilterCount > 0 ? C.blue : '#EEF4FB' }]}
                  accessibilityRole="button"
                  accessibilityLabel={activeFilterCount > 0 ? `${t.filterBtn} — ${activeFilterCount} פילטרים פעילים` : t.filterBtn}
                >
                  <T style={[s.urgentHeaderBtnText, { color: activeFilterCount > 0 ? '#fff' : C.blueDark }]}>
                    {t.filterBtn}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </T>
                </TouchableOpacity>
              )}
              {myRole === 'client' && (
                <TouchableOpacity onPress={() => setUrgentOpen(true)} activeOpacity={0.85} style={{ borderRadius: 12, overflow: 'hidden', shadowColor: '#F43F5E', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
                  <LinearGradient colors={['#FF7A59', '#F43F5E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.urgentHeaderBtn}>
                    <T style={s.urgentHeaderBtnText}>{t.urgentBtn}</T>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* כפתור תפריט — צד ימין */}
            <TouchableOpacity
              onPress={() => setDrawer(true)}
              style={s.hamburgerBtn}
              accessibilityRole="button"
              accessibilityLabel="פתח תפריט"
              accessibilityHint="פותח תפריט ניווט"
            >
              <T style={s.hamburgerText}>≡</T>
            </TouchableOpacity>
          </View>

          {/* באנר הזמנה חדשה — מופיע רק כשמגיעה הזמנה בזמן שהמנקה מחובר */}
          {myRole === 'cleaner' && newBookingFlash && (
            <TouchableOpacity
              style={{ backgroundColor: '#059669', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
              onPress={() => { setNewBookingFlash(false); router.push('/profile'); }}
              activeOpacity={0.88}
            >
              <T style={{ fontSize: 28 }}>🔔</T>
              <View style={{ flex: 1 }}>
                <T style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>{t.newBookingArrived}</T>
                <T style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{t.tapToViewAndApprove}</T>
              </View>
              <T style={{ fontSize: 20 }}>←</T>
            </TouchableOpacity>
          )}

          {/* באנר הזמנות ממתינות למנקה */}
          {myRole === 'cleaner' && cleanerPendingCount > 0 && (
            <TouchableOpacity
              style={{ backgroundColor: '#F59E0B', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              onPress={() => router.push('/profile')}
            >
              <T style={{ fontSize: 20 }}>📋</T>
              <View style={{ flex: 1 }}>
                <T style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>
                  {cleanerPendingCount} {t.pendingBookingsMsg}
                </T>
                <T style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{t.tapToApprove}</T>
              </View>
              <T style={{ fontSize: 22, backgroundColor: '#DC2626', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, color: '#fff', fontWeight: '900' }}>
                {cleanerPendingCount}
              </T>
            </TouchableOpacity>
          )}

          <View style={{ zIndex: 999, elevation: 999 }}>
            <View style={[s.searchWrap, flipSide && { flexDirection: 'row-reverse' }]}>
              <T style={{ fontSize: 14, color: C.textSub }}>🔍</T>
              <TextInput
                style={s.searchInput}
                placeholder={t.searchPlaceholder}
                value={search}
                onChangeText={handleSearchChange}
                placeholderTextColor={C.textSub}
                textAlign="right"
                onBlur={() => setTimeout(() => setShowSearchSugg(false), 180)}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => { setSearch(''); setSearchSugg([]); setShowSearchSugg(false); }}>
                  <T style={{ color: C.textSub, fontSize: 16 }}>✕</T>
                </TouchableOpacity>
              )}
            </View>
            {showSearchSugg && searchSugg.length > 0 && (
              <View style={s.searchDropdown}>
                {searchSugg.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[s.searchSuggItem, idx < searchSugg.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.grayBorder }]}
                    onPress={() => { setSearch(item.label); setShowSearchSugg(false); if (item.icon === '📍') focusCityRef.current(item.label); }}
                  >
                    <T style={{ fontSize: 14, marginLeft: 6 }}>{item.icon}</T>
                    <T style={s.searchSuggText}>{item.label}</T>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

      </View>

      <View style={[s.body, { paddingBottom: insets.bottom }]}>
        <View style={s.mapWrap}>
          <MapView ref={mapRef} style={s.map}
            provider={(Platform.OS === 'ios' && Constants.appOwnership === 'expo') ? undefined : PROVIDER_GOOGLE}
            initialRegion={REGION_DEFAULTS.all} showsUserLocation={false} showsMyLocationButton={false} onRegionChangeComplete={setMapRegion}>
            {nearbyMode && userCoords && (
              <Circle
                center={{ latitude: userCoords.lat, longitude: userCoords.lng }}
                radius={NEARBY_KM * 1000}
                strokeColor="rgba(24,95,165,0.5)"
                fillColor="rgba(24,95,165,0.08)"
                strokeWidth={2}
              />
            )}
            {/* נקודת "המיקום שלי" — כתומה (מותאמת, במקום הנקודה הכחולה של המערכת) */}
            {userCoords && (
              <Marker
                coordinate={{ latitude: userCoords.lat, longitude: userCoords.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                flat
                tracksViewChanges={dotTracks}
                zIndex={999}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,138,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF8A00', borderWidth: 2, borderColor: '#fff' }} />
                </View>
              </Marker>
            )}
            {(() => {
              // ביצועים: מרנדרים רק סמנים בתוך התצוגה הנוכחית (עם שוליים), מוגבל ל-120
              const padLat = (mapRegion?.latitudeDelta  || 4) * 0.6;
              const padLng = (mapRegion?.longitudeDelta || 4) * 0.6;
              const cLat = mapRegion?.latitude  ?? REGION_DEFAULTS.all.latitude;
              const cLng = mapRegion?.longitude ?? REGION_DEFAULTS.all.longitude;
              return mapFiltered.filter((c: any) =>
                Math.abs(c.lat - cLat) <= padLat && Math.abs(c.lng - cLng) <= padLng
              ).slice(0, 80);
            })().map(c => (
              <CleanerMapMarker
                key={c.id}
                c={c}
                isSel={selected === c.id}
                onPress={() => { setSelected(c.id); const idx = filtered.findIndex((x: any) => x.id === c.id); if (idx >= 0) setTimeout(() => { try { flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.15 }); } catch (_) {} }, 60); }}
              />
            ))}
          </MapView>
          {/* כפתור חזרה למיקום שלי */}
          <TouchableOpacity
            onPress={handleRecenter}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t.myLocationBtn ?? 'המיקום שלי'}
            style={{
              position: 'absolute', bottom: 14, left: 14,
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: '#FF8A00', alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: '#fff',
              elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
            }}
          >
            <MaterialIcons name="my-location" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <FlatList
          ref={flatListRef}
          style={s.list} data={filtered} keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 10, gap: 10, paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 16 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={5}
          windowSize={7}
          updateCellsBatchingPeriod={60}
          removeClippedSubviews={true}
          onScrollToIndexFailed={(info) => {
            // גלילה משוערת ואז ניסיון חוזר (כרטיסים בגובה משתנה)
            flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => { try { flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.15 }); } catch (_) {} }, 200);
          }}
          ListHeaderComponent={myRole === 'client' ? (
            myBookings.length > 0 ? (
              <TouchableOpacity
                onPress={() => setQuickRebookOpen(true)}
                style={{ borderRadius: 16, marginBottom: 4, overflow: 'hidden', elevation: 4, shadowColor: '#1E6FB8', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#3E8DE3', '#1E5FA8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <T style={{ fontSize: 26 }}>♻️</T>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <T style={{ color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'center' }}>{t.prevBookingsShort}</T>
                    <T style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 1, textAlign: 'center' }}>{t.rebookSubtitle}</T>
                  </View>
                  <T style={{ color: 'rgba(255,255,255,0.75)', fontSize: 20 }}>›</T>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View
                style={{ backgroundColor: '#E8F1FB', borderRadius: 16, padding: 14, marginBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#C7DEF5' }}
              >
                <T style={{ fontSize: 26 }}>♻️</T>
                <View style={{ flex: 1 }}>
                  <T style={{ color: '#1E5FA8', fontSize: 13, fontWeight: '800' }}>{t.prevBookingsShort}</T>
                  <T style={{ color: '#2E7BC4', fontSize: 11, marginTop: 2, lineHeight: 16 }}>
                    זמין לאחר הזמנה ראשונה — לחוויה מהירה ונוחה 😊
                  </T>
                </View>
              </View>
            )
          ) : null}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 16 }}>
              <T style={{ fontSize: 40, marginBottom: 10 }}>🔍</T>
              <T style={[s.empty, { marginBottom: 12 }]}>{t.noCleaners}</T>
              {(() => {
                const reasons: string[] = [];
                if (search.trim())       reasons.push(`🔍 אין מנקים שתואמים ל"${search.trim()}"`);
                if (filterCity.trim())   reasons.push(`📍 אין מנקים בעיר "${filterCity.trim()}"`);
                if (filterMaxPrice < 999) reasons.push(`💰 המחיר המקסימלי שבחרת (₪${filterMaxPrice}) אולי נמוך מדי`);
                if (filterMinRating > 0)  reasons.push(`⭐ הדירוג המינימלי שבחרת (${filterMinRating}+) אולי גבוה מדי`);
                if (filterAvailOnly)      reasons.push(`🟢 סימנת "זמינים בלבד" — נסה/י לבטל`);
                if (filterTypes.length > 0) reasons.push(`🔧 אין מנקים לסוג השירות שבחרת`);
                if (reasons.length === 0) return <T style={{ fontSize: 12, color: C.textSub, textAlign: 'center' }}>נסה/י להרחיב את אזור החיפוש</T>;
                return (
                  <View style={{ backgroundColor: C.bluePale, borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: C.blueBorder, alignSelf: 'stretch' }}>
                    <T style={{ fontSize: 13, fontWeight: '800', color: C.textDark, textAlign: 'center', marginBottom: 2 }}>סיבות אפשריות:</T>
                    {reasons.map((r, i) => <T key={i} style={{ fontSize: 12, color: C.textDark, textAlign: 'right' }}>{r}</T>)}
                  </View>
                );
              })()}
            </View>
          }
          renderItem={({ item: c }) => (
            <CleanerCard
              cleaner={c} isSel={selected === c.id} onSelect={handleSelectCleaner}
              onProfile={(c: any) => { setProfileReviews(false); setProfile(c); }} onReviews={openProfileReviews} onBook={setBooking} onChat={setChatWith}
              isPending={pendingCleanerIds.has(c.id)}
              onShowOnMap={handleShowOnMap} onEnlarge={setEnlargedPhoto}
            />
          )}
        />
      </View>

      <CleanerProfile cleaner={profile}  visible={!!profile}  onClose={() => setProfile(null)}  onBook={setBooking} onChat={setChatWith} initialShowReviews={profileReviews} />
      <BookingModal
        cleaner={booking}
        visible={!!booking}
        onClose={() => { setBooking(null); setPrebookData(null); }}
        prebookData={prebookData}
        onBookingCreated={(cleanerId: string, nb?: any) => {
          setPendingCleanerIds(prev => new Set([...prev, cleanerId]));
          if (nb) setMyBookings(prev => [nb, ...prev]);
        }}
      />
      <ChatModal      cleaner={chatWith} visible={!!chatWith} onClose={() => setChatWith(null)} />
      <AccessibilityModal visible={a11yOpen} onClose={() => setA11yOpen(false)} />

      {/* מציג תמונת מנקה במסך מלא */}
      <Modal visible={!!enlargedPhoto} transparent animationType="fade" onRequestClose={() => setEnlargedPhoto(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={1} onPress={() => setEnlargedPhoto(null)}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 10, zIndex: 10 }} onPress={() => setEnlargedPhoto(null)}>
            <T style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</T>
          </TouchableOpacity>
          {enlargedPhoto && (
            <Image source={{ uri: enlargedPhoto }} style={{ width: '90%', height: '70%', borderRadius: 16 }} contentFit="contain" />
          )}
        </TouchableOpacity>
      </Modal>

      {/* ── הזמנות קודמות (חזרה על הזמנה קודמת) ── */}
      <QuickRebookModal
        visible={quickRebookOpen}
        onClose={() => setQuickRebookOpen(false)}
        myBookings={myBookings}
        allCleaners={[...staticCleanerOrderRef.current, ...realCleaners]}
        onBook={(cleaner, prevB) => { setQuickRebookOpen(false); setPrebookData(prevB || null); setBooking(cleaner); }}
      />

      <Toast msg={toastMsg} visible={toastVisible} type={toastType} />
      <DrawerMenu
        visible={drawer}
        onClose={() => setDrawer(false)}
        onProfile={() => router.push('/profile')}
        onActiveBookings={() => router.push('/profile')}
        onHistory={() => router.push({ pathname: '/profile', params: { section: 'history' } })}
        showHistory={myRole !== 'cleaner'}
        onLogout={handleLogout}
        onMessages={() => router.push('/messages')}
        onReport={() => { setDrawer(false); setReportOpen(true); }}
        onSupport={() => router.push('/support')}
      />

      {/* Advanced Filter Modal */}
      <Modal visible={filterVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFilterVisible(false)}>
        <ModalBackHandler onBack={() => setFilterVisible(false)} />
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setFilterVisible(false)} style={s.closeBtn}>
              <T style={{ color: C.white, fontSize: 18 }}>✕</T>
            </TouchableOpacity>
            <T style={s.modalTitle}>{t.filterTitle}</T>
            <TouchableOpacity
              onPress={() => { setFilterMinRating(0); setFilterMaxPrice(999); setFilterAvailOnly(false); setFilterTypes([]); setFilterCity(''); setRegion('all'); showToast(t.filterReset, 'info'); }}
              activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF8A00', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, elevation: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } }}>
              <T style={{ color: '#fff', fontSize: 14 }}>↺</T>
              <T style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{t.filterReset}</T>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: insets.bottom + 16 }} keyboardShouldPersistTaps="handled">

            {/* ── חיפוש לפי עיר ───────────────────────────────────────────── */}
            <View style={{ zIndex: 50 }}>
              <T style={[s.fieldLabel, { textAlign: 'right' }]}>{t.searchByCity}</T>
              <TextInput
                style={[s.input, { marginTop: 8, textAlign: 'right' }]}
                placeholder={t.citySearchPh}
                placeholderTextColor={C.textSub}
                value={filterCity}
                onChangeText={computeFilterCitySugg}
                onFocus={() => { if (filterCitySugg.length) setShowFilterCitySugg(true); }}
                onBlur={() => setTimeout(() => setShowFilterCitySugg(false), 180)}
              />
              {showFilterCitySugg && filterCitySugg.length > 0 && (
                <View style={[s.searchDropdown, { marginTop: 4 }]}>
                  {filterCitySugg.map((city, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[s.searchSuggItem, idx < filterCitySugg.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.grayBorder }]}
                      onPress={() => { setFilterCity(city); setShowFilterCitySugg(false); setFilterCitySugg([]); focusCityRef.current(city); }}
                    >
                      <T style={{ fontSize: 14, marginLeft: 6 }}>📍</T>
                      <T style={s.searchSuggText}>{city}</T>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Min rating */}
            <View>
              <T style={[s.fieldLabel, { textAlign: 'right' }]}>{t.filterRatingLabel}</T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[0,3,4,4.5,4.8].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.hourBtn, filterMinRating === r && s.hourBtnActive, { width: 'auto', paddingHorizontal: 12 }]}
                    onPress={() => setFilterMinRating(r)}
                  >
                    <T style={[{ fontSize: 12, fontWeight: '700', color: C.textDark }, filterMinRating === r && { color: C.white }]}>
                      {r === 0 ? t.filterReset : `⭐ ${r}+`}
                    </T>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Max price */}
            <View>
              <T style={[s.fieldLabel, { textAlign: 'right' }]}>{t.filterMaxPriceLabel}: ₪{filterMaxPrice === 999 ? '∞' : filterMaxPrice}</T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[999, 200, 150, 100, 80, 60].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[s.hourBtn, filterMaxPrice === p && s.hourBtnActive, { width: 'auto', paddingHorizontal: 12 }]}
                    onPress={() => setFilterMaxPrice(p)}
                  >
                    <T style={[{ fontSize: 12, fontWeight: '700', color: C.textDark }, filterMaxPrice === p && { color: C.white }]}>
                      {p === 999 ? t.filterReset : `≤₪${p}`}
                    </T>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Available only */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.blueBorder }}>
              <T style={[s.fieldLabel, { textAlign: 'right' }]}>{t.filterAvailLabel}</T>
              <Switch
                value={filterAvailOnly}
                onValueChange={setFilterAvailOnly}
                trackColor={{ false: C.blueBorder, true: C.blue }}
                thumbColor={C.white}
              />
            </View>

            {/* Service types */}
            <View>
              <T style={[s.fieldLabel, { textAlign: 'right' }]}>{t.filterTypesLabel}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' }}>
                {Object.keys(TYPE_ICONS).map(tp => {
                  const active = filterTypes.includes(tp);
                  return (
                    <TouchableOpacity
                      key={tp}
                      style={[s.typePill, active && { backgroundColor: C.blue }]}
                      onPress={() => setFilterTypes(prev => active ? prev.filter(x => x !== tp) : [...prev, tp])}
                    >
                      <T style={[s.typePillText, active && { color: C.white }]}>{TYPE_ICONS[tp]} {t.types[tp] || tp}</T>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ספירת תוצאות חיה */}
            <View style={{ backgroundColor: filtered.length > 0 ? '#D1FAE5' : '#FEE2E2', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <T style={{ fontWeight: '800', fontSize: 15, color: filtered.length > 0 ? '#065F46' : '#991B1B' }}>
                {filtered.length > 0
                  ? `✅ נמצאו ${filtered.length} מנקים`
                  : '❌ אין מנקים בסינון הנוכחי — נסה להרחיב'}
              </T>
            </View>

            <TouchableOpacity style={s.confirmBtn} onPress={() => setFilterVisible(false)}>
              <T style={s.confirmBtnText}>
                ✓ הצג {filtered.length} מנקים
              </T>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal visible={photoViewerOpen} transparent animationType="fade">
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

      {/* ── פופאפ ניקוי דחוף (מותאם) ── */}
      <Modal visible={!!urgentPopupReq} transparent animationType="fade" onRequestClose={() => setUrgentPopupReq(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 28 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 }}>
            {/* כותרת — ברק אחד בצד שמאל */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <T style={{ fontSize: 22 }}>⚡</T>
              <T style={{ fontSize: 18, fontWeight: '900', color: '#DC2626' }}>{String(t.urgentTabLabel || 'דחופות').replace(/⚡/g, '').trim()}</T>
            </View>
            {urgentPopupReq && (() => {
              const svc = urgentPopupReq.serviceType
                ? String(urgentPopupReq.serviceType).split(' + ').map((st: string) => t.types[st] || st).join(', ')
                : '';
              return (
                <T style={{ fontSize: 15, color: C.textDark, lineHeight: 24, textAlign: 'right', marginBottom: 18 }}>
                  {urgentPopupReq.dateStr || ''} {urgentPopupReq.startTime || ''}{svc ? `${'\n'}🧹 ${svc}` : ''}{'\n'}📍 {urgentPopupReq.address || ''}{'\n'}⏱️ {urgentPopupReq.hours || ''} {t.hoursUnit} · ₪{urgentPopupReq.total || ''}
                </T>
              );
            })()}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
                onPress={() => { const id = urgentPopupReq?.id; setUrgentPopupReq(null); if (id) router.push({ pathname: '/profile', params: { tab: 'urgent', acceptReqId: id } }); }}
              >
                <T style={{ color: '#fff', fontWeight: '900', fontSize: 14 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{"כניסה לצ'אט ואישור"}</T>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' }}
                onPress={() => setUrgentPopupReq(null)}
              >
                <T style={{ color: '#DC2626', fontWeight: '900', fontSize: 15 }}>דחה</T>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── ביקורת חובה ── */}
      <Modal visible={showMandatoryReview} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 }}>
            <T style={{ fontSize: 20, fontWeight: '900', color: C.textDark, textAlign: 'center', marginBottom: 6 }}>
              {t.reviewRequiredTitle}
            </T>
            <T style={{ fontSize: 13, color: C.textSub, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
              {t.reviewRequiredMsg}
            </T>
            {pendingReviewBooking && (
              <View style={{ backgroundColor: C.blueLight, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <T style={{ fontSize: 14, fontWeight: '700', color: C.textDark, textAlign: 'center' }}>
                  {pendingReviewBooking.cleanerName}
                </T>
                {pendingReviewBooking.reviewDeadline && (() => {
                  const days = Math.max(0, Math.ceil((new Date(pendingReviewBooking.reviewDeadline).getTime() - Date.now()) / 86400000));
                  return <T style={{ fontSize: 12, color: days <= 1 ? '#EF4444' : C.textSub, textAlign: 'center', marginTop: 4 }}>⏳ {days} {t.reviewDeadlineDays}</T>;
                })()}
              </View>
            )}
            {/* Star picker with animation */}
            <AnimatedStarPicker value={mandatoryStars} onChange={setMandatoryStars} />
            <T style={{ fontSize: 13, fontWeight: '700', color: C.textDark, marginBottom: 6, textAlign: 'right' }}>
              {t.reviewCommentLabel}
            </T>
            <TextInput
              style={{ backgroundColor: C.blueLight, borderRadius: 12, padding: 12, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder, minHeight: 80, textAlignVertical: 'top', textAlign: 'right', marginBottom: 16 }}
              placeholder={t.reviewCommentPlaceholder}
              placeholderTextColor={C.textSub}
              value={mandatoryComment}
              onChangeText={setMandatoryComment}
              multiline
            />
            <TouchableOpacity
              style={{ backgroundColor: mandatoryStars > 0 ? C.blue : C.grayBorder, borderRadius: 14, padding: 16, alignItems: 'center' }}
              onPress={handleMandatoryReviewSubmit}
              disabled={mandatoryStars === 0 || mandatorySubmitting}
            >
              <T style={{ fontSize: 16, fontWeight: '800', color: C.white }}>
                {mandatorySubmitting ? '...' : t.reviewSubmitNow}
              </T>
            </TouchableOpacity>
            {/* אחר כך — לא חוסם לחלוטין */}
            <TouchableOpacity
              style={{ paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
              onPress={() => { setShowMandatoryReview(false); setIsBlocked(false); setMandatoryStars(0); setMandatoryComment(''); }}
            >
              <T style={{ fontSize: 14, fontWeight: '700', color: C.textSub }}>אחר כך</T>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── פופאפ: הזמנה אושרה ── */}
      <Modal visible={!!confirmedPopup} transparent animationType="slide" onRequestClose={() => setConfirmedPopup(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40, alignItems: 'center', gap: 14 }}>
            {/* אייקון */}
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#10B981' }}>
              <Text style={{ fontSize: 40 }}>✅</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#065F46', textAlign: 'center' }}>
              {t.bookingConfirmedPopupTitle || '🎉 ההזמנה אושרה!'}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
              {t.bookingConfirmedPopupSub || 'המנקה אישר את הגעתו — ההזמנה מאושרת ומוכנה'}
            </Text>
            {/* כרטיס פרטים */}
            {confirmedPopup && (
              <View style={{ backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, width: '100%', gap: 10, borderWidth: 1, borderColor: '#A7F3D0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>🧹 {t.cleanerLabel || 'מנקה'}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#065F46' }}>{confirmedPopup.cleanerName}</Text>
                </View>
                {confirmedPopup.bookingDate ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>📅 {t.dateLabel || 'תאריך'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>{confirmedPopup.bookingDate}  {confirmedPopup.startTime || ''}</Text>
                  </View>
                ) : null}
                {confirmedPopup.hours ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>⏱️ {t.hoursLabel || 'שעות'}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>{confirmedPopup.hours} {t.hoursUnit}</Text>
                  </View>
                ) : null}
              </View>
            )}
            {/* כפתורים */}
            <TouchableOpacity
              style={{ backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center' }}
              onPress={() => { setConfirmedPopup(null); router.push('/profile'); }}
            >
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>{t.viewMyBookings || '📋 ההזמנות שלי'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 10, width: '100%', alignItems: 'center' }}
              onPress={() => setConfirmedPopup(null)}
            >
              <Text style={{ fontSize: 14, color: '#9CA3AF', fontWeight: '600' }}>{t.closeBtn || 'סגור'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── חסימה ── */}
      {isBlocked && !showMandatoryReview && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 32, zIndex: 999 }}>
          <T style={{ fontSize: 48, marginBottom: 12 }}>🔒</T>
          <T style={{ fontSize: 22, fontWeight: '900', color: C.white, textAlign: 'center', marginBottom: 10 }}>
            {t.blockedTitle}
          </T>
          <T style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
            {t.blockedMsg}
          </T>
          <TouchableOpacity
            style={{ backgroundColor: C.blue, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 }}
            onPress={() => setShowMandatoryReview(true)}
          >
            <T style={{ fontSize: 16, fontWeight: '800', color: C.white }}>{t.reviewSubmitNow}</T>
          </TouchableOpacity>
        </View>
      )}

      {/* ── מודל ניקוי דחוף ── */}
      <Modal visible={urgentOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setUrgentOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#DC2626', padding: 16 }}>
            {!urgentWaiting && !urgentFoundName ? (
              <TouchableOpacity onPress={() => setUrgentOpen(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ color: C.white, fontSize: 18, fontWeight: '700' }}>✕</T>
              </TouchableOpacity>
            ) : <View style={{ width: 36 }} />}
            <T style={{ fontSize: 17, fontWeight: '900', color: C.white }}>🚨 {t.urgentTitle}</T>
            <View style={{ width: 36 }} />
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          <ScrollView ref={urgentScrollRef} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">

            {/* ── מצב המתנה ── */}
            {urgentWaiting && (
              <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 28, alignItems: 'center', gap: 14, borderWidth: 2, borderColor: '#7C3AED' }}>
                <T style={{ fontSize: 48 }}>⏳</T>
                <T style={{ fontSize: 18, fontWeight: '900', color: C.textDark, textAlign: 'center' }}>{t.urgentWaitingMsg}</T>
                <TouchableOpacity
                  style={{ backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 6 }}
                  onPress={handleCancelUrgent}
                >
                  <T style={{ fontSize: 14, fontWeight: '800', color: '#EF4444' }}>{t.urgentCancelBtn}</T>
                </TouchableOpacity>
              </View>
            )}

            {/* ── נמצא מנקה ── */}
            {!urgentWaiting && urgentFoundName !== '' && (
              <View style={{ backgroundColor: '#D1FAE5', borderRadius: 20, padding: 28, alignItems: 'center', gap: 12, borderWidth: 2, borderColor: C.green }}>
                <T style={{ fontSize: 52 }}>🎉</T>
                <T style={{ fontSize: 20, fontWeight: '900', color: '#065F46', textAlign: 'center' }}>{t.urgentFoundMsg}</T>
                <T style={{ fontSize: 16, color: '#065F46', fontWeight: '700' }}>{urgentFoundName}</T>
                <TouchableOpacity
                  style={{ backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 36, marginTop: 6 }}
                  onPress={() => { setUrgentOpen(false); setUrgentFoundName(''); setUrgentRequestId(null); setUrgentAddress(''); setUrgentServiceTypes([]); setUrgentServiceDropOpen(false); }}
                >
                  <T style={{ fontSize: 15, fontWeight: '900', color: C.white }}>{t.closeBtn}</T>
                </TouchableOpacity>
              </View>
            )}

            {/* ── טופס ניקוי דחוף — היום בלבד ── */}
            {!urgentWaiting && urgentFoundName === '' && (
              <>
                <View style={{ backgroundColor: '#FEE2E2', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FECACA' }}>
                  <T style={{ fontSize: 13, color: '#991B1B', textAlign: 'center', lineHeight: 20 }}>
                    🚨 {t.urgentSubtitle}
                  </T>
                </View>

                {/* בחירת תאריך — היום / מחר */}
                <View style={{ gap: 8 }}>
                  <T style={[s.fieldLabel, { textAlign: 'right' }]}>📅 {t.dateLabel}</T>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {([
                      { key: 'today'    as const, icon: '🚨', label: 'היום' },
                      { key: 'tomorrow' as const, icon: '📅', label: 'מחר'  },
                    ]).map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={{ flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 4, backgroundColor: urgentDate === opt.key ? '#DC2626' : C.white, borderWidth: 1.5, borderColor: urgentDate === opt.key ? '#DC2626' : C.blueBorder }}
                        onPress={() => setUrgentDate(opt.key)}
                      >
                        <T style={{ fontSize: 22 }}>{opt.icon}</T>
                        <T style={{ fontSize: 13, fontWeight: '800', color: urgentDate === opt.key ? '#fff' : C.textDark }}>{opt.label}</T>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* סוג שירות — תפריט נפתח */}
                <View style={{ gap: 8, zIndex: 1000 }}>
                  <T style={[s.fieldLabel, { textAlign: 'right' }]}>{(t as any).serviceTypeLabel ?? 'סוג שירות'}</T>
                  <TouchableOpacity
                    onPress={() => setUrgentServiceDropOpen(v => !v)}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderRadius: 12, borderWidth: urgentServiceTypes.length === 0 ? 2 : 1.5, borderColor: (urgentServiceDropOpen || urgentServiceTypes.length === 0) ? '#DC2626' : C.blueBorder, paddingHorizontal: 14, paddingVertical: 13 }}
                  >
                    <T style={{ fontSize: 14, fontWeight: '700', color: urgentServiceTypes.length ? C.textDark : '#DC2626' }} numberOfLines={2}>
                      {urgentServiceTypes.length
                        ? urgentServiceTypes.map(st => `${TYPE_ICONS[st] || ''} ${t.types[st] || st}`).join(' · ')
                        : ((t as any).selectServiceTypeMulti ?? 'בחר סוג שירות (אפשר כמה)')}
                    </T>
                    <T style={{ fontSize: 14, color: '#DC2626' }}>{urgentServiceDropOpen ? '▲' : '▼'}</T>
                  </TouchableOpacity>
                  {urgentServiceTypes.length === 0 && (
                    <T style={{ fontSize: 11, color: '#DC2626', fontWeight: '700', textAlign: 'right' }}>⚠️ יש לבחור סוג שירות</T>
                  )}
                  {urgentServiceDropOpen && (
                    <View style={{ backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.blueBorder, overflow: 'hidden' }}>
                      {Object.keys(TYPE_ICONS).map(tp => {
                        const sel = urgentServiceTypes.includes(tp);
                        return (
                        <TouchableOpacity
                          key={tp}
                          onPress={() => toggleUrgentServiceType(tp)}
                          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bluePale, backgroundColor: sel ? C.bluePale : C.white }}
                        >
                          <T style={{ fontSize: 16, color: sel ? '#DC2626' : C.blueBorder }}>{sel ? '☑' : '☐'}</T>
                          <T style={{ flex: 1, fontSize: 14, fontWeight: sel ? '800' : '400', color: sel ? '#DC2626' : C.textDark, textAlign: 'right' }}>
                            {TYPE_ICONS[tp] || ''} {t.types[tp] || tp}
                          </T>
                        </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* שעת התחלה */}
                <View style={{ gap: 8 }}>
                  <T style={[s.fieldLabel, { textAlign: 'right' }]}>{t.timeLabel}</T>
                  <TimeWheelPicker value={urgentHour} onChange={setUrgentHour} minHour={urgentMinHour} maxHour={23.5} />
                </View>

                {/* שעות עבודה */}
                <View style={{ gap: 8 }}>
                  <T style={[s.fieldLabel, { textAlign: 'right' }]}>{t.hoursLabel}</T>
                  <HoursWheelPicker value={urgentHours} onChange={setUrgentHours} values={[1,2,3,4,5,6,7,8,9,10,11,12]} />
                </View>

                {/* סכום מקסימלי לשעה — שולח רק למנקים בטווח */}
                <View style={{ gap: 8 }}>
                  <T style={[s.fieldLabel, { textAlign: 'right' }]}>💰 {(t as any).urgentMaxPriceLabel ?? 'סכום מקסימלי לשעה'}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {[60, 70, 80, 90, 100, 120, 150].map(p => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setUrgentMaxPrice(p)}
                        activeOpacity={0.8}
                        style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, backgroundColor: urgentMaxPrice === p ? '#DC2626' : C.white, borderColor: urgentMaxPrice === p ? '#DC2626' : C.blueBorder }}
                      >
                        <T style={{ fontSize: 13, fontWeight: '800', color: urgentMaxPrice === p ? '#fff' : C.textDark }}>₪{p}</T>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <T style={{ fontSize: 11, color: C.textSub, textAlign: 'right' }}>{(t as any).urgentMaxPriceHint ?? 'ההתראה תישלח רק למנקים שמחירם לשעה עד הסכום שבחרת'}</T>
                </View>

                {/* כתובת */}
                <View style={{ gap: 8, zIndex: 999 }}>
                  <T style={[s.fieldLabel, { textAlign: 'right' }]}>{t.addressLabel}</T>
                  <AddressPicker selectedId="" onSelect={a => setUrgentAddress(a.address)} savedAddresses={urgentSavedAddresses} />
                  <AddressAutocomplete value={urgentAddress} onChange={setUrgentAddress} placeholder={t.addressPlaceholder}
                    onFocus={() => setTimeout(() => urgentScrollRef.current?.scrollToEnd({ animated: true }), 300)}
                    error={!urgentAddress.trim() || urgentAddress.trim().length < 5 || !/\d/.test(urgentAddress)}
                  />
                  {(!urgentAddress.trim() || urgentAddress.trim().length < 5 || !/\d/.test(urgentAddress)) && (
                    <T style={{ fontSize: 11, color: '#DC2626', fontWeight: '700', textAlign: 'right' }}>⚠️ יש להזין כתובת מלאה כולל מספר בית</T>
                  )}
                </View>

                {/* תשלום */}
                <View style={{ gap: 8 }}>
                  <T style={[s.fieldLabel, { textAlign: 'right' }]}>{t.paymentMethodLabel}</T>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['cash','bit','paybox','bank'] as const).map(p => (
                      <TouchableOpacity key={p} style={[s.hourBtn, { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }, urgentPayment === p && s.hourBtnActive]} onPress={() => setUrgentPayment(p)}>
                        {p === 'paybox' && <PayboxIcon size={16} color={urgentPayment === p ? '#fff' : PAYBOX_BLUE} />}
                        <T
                          style={[{ fontSize: 13, fontWeight: '700', color: C.textDark, textAlign: 'center' }, urgentPayment === p && { color: C.white }]}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                        >
                          {p === 'cash' ? t.payCash : p === 'bit' ? t.payBit : p === 'paybox' ? 'PayBox' : 'בנקאי'}
                        </T>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <T style={{ fontSize: 12, color: '#DC2626', fontWeight: '700', textAlign: 'center', marginTop: 2 }}>{t.paymentDirectNote}</T>
                </View>

                {/* סה"כ */}
                <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T style={{ fontSize: 14, color: '#991B1B' }}>{t.estimatedTotal}</T>
                  <T style={{ fontSize: 20, fontWeight: '900', color: '#DC2626' }}>₪{urgentHours * 80}</T>
                </View>

                {/* כפתור שליחה — חסום עד שכל השדות מלאים */}
                {(() => {
                  const urgentReady = urgentServiceTypes.length > 0 && urgentAddress.trim().length >= 5 && /\d/.test(urgentAddress) && !!urgentPayment;
                  return (
                    <TouchableOpacity
                      style={{ backgroundColor: (urgentSending || !urgentReady) ? '#94A3B8' : '#DC2626', borderRadius: 14, padding: 16, alignItems: 'center', elevation: 4, shadowColor: '#DC2626', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
                      onPress={handleSendUrgent}
                      disabled={urgentSending || !urgentReady}
                    >
                      {urgentSending
                        ? <ActivityIndicator color="#fff" />
                        : <T style={{ fontSize: 16, fontWeight: '900', color: C.white }}>🚨 {t.urgentSendBtn}</T>
                      }
                    </TouchableOpacity>
                  );
                })()}
              </>
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── מודל דיווח ── */}
      <Modal visible={reportOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReportOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.blueDark, padding: 16 }}>
            <TouchableOpacity onPress={() => setReportOpen(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ color: C.white, fontSize: 18 }}>✕</T>
            </TouchableOpacity>
            <T style={{ fontSize: 16, fontWeight: '800', color: C.white }}>🚨 {t.reportTitle}</T>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 16 }}>
            <View style={{ gap: 8 }}>
              {([
                { key: 'bug',     label: t.reportTypeBug },
                { key: 'cleaner', label: t.reportTypeCleaner },
                { key: 'client',  label: t.reportTypeClient },
              ] as const).map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setReportType(opt.key)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: reportType === opt.key ? C.blue : C.white, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: reportType === opt.key ? C.blue : C.grayBorder }}
                >
                  <T style={{ fontSize: 20 }}>{reportType === opt.key ? '🔵' : '⚪'}</T>
                  <T style={{ fontSize: 15, fontWeight: '700', color: reportType === opt.key ? C.white : C.textDark }}>{opt.label}</T>
                </TouchableOpacity>
              ))}
            </View>
            {reportType !== 'bug' && (
              <TextInput
                style={{ backgroundColor: C.white, borderRadius: 10, padding: 12, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.grayBorder, textAlign: 'right' }}
                placeholder={t.reportTargetPlaceholder}
                placeholderTextColor={C.textSub}
                value={reportTarget}
                onChangeText={setReportTarget}
              />
            )}
            <TextInput
              style={{ backgroundColor: C.white, borderRadius: 10, padding: 12, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.grayBorder, minHeight: 110, textAlignVertical: 'top', textAlign: 'right' }}
              placeholder={t.reportDescPlaceholder}
              placeholderTextColor={C.textSub}
              value={reportDesc}
              onChangeText={setReportDesc}
              multiline
            />
            <TouchableOpacity
              style={{ backgroundColor: reportDesc.trim() ? '#EF4444' : C.grayBorder, borderRadius: 12, padding: 16, alignItems: 'center' }}
              onPress={handleSendReport}
              disabled={!reportDesc.trim() || reportSending}
            >
              <T style={{ fontSize: 15, fontWeight: '800', color: C.white }}>{reportSending ? '...' : t.reportSubmit}</T>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>


    </SafeAreaViewCtx>
  );
}

// ─── Drawer styles ────────────────────────────────────────────────────────────
function createDS(c: AppColors) {
  return StyleSheet.create({
    backdrop:        { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    // left מחושב בפיקסלים פיזיים ב-inline style — אין right/left כאן בכלל
    panel:           { position: 'absolute', top: 0, bottom: 0, width: PANEL_W, backgroundColor: c.white, elevation: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12 },
    panelHeader:     { backgroundColor: c.white, padding: 28, paddingTop: 50, alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: c.grayBorder },
    panelLogo:       { fontSize: 40 },
    panelAppName:    { fontSize: 20, fontWeight: '900', color: c.blueDark },
    item:            { flexDirection: 'row-reverse', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: c.grayBorder },
    itemIcon:        { fontSize: 20, marginLeft: 14 },
    itemText:        { fontSize: 15, fontWeight: '600', color: c.textDark, flex: 1, textAlign: 'right' },
    itemArrow:       { fontSize: 16, color: c.textSub },
    langList:        { backgroundColor: c.bluePale, paddingVertical: 4 },
    langItem:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, gap: 12 },
    langItemActive:  { backgroundColor: c.blueLight },
    langFlag:        { fontSize: 22 },
    langLabel:       { fontSize: 14, fontWeight: '600', color: c.textDark, flex: 1 },
    divider:         { height: 1, backgroundColor: c.grayBorder, marginVertical: 6 },
    sectionDivider:  { height: 8, backgroundColor: c.bluePale, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.grayBorder, marginVertical: 0 },
    toggle:          { width: 44, height: 24, borderRadius: 12, backgroundColor: '#CBD5E1', justifyContent: 'center', paddingHorizontal: 3 },
    toggleOn:        { backgroundColor: c.blue },
    toggleThumb:     { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF', alignSelf: 'flex-start', elevation: 2 },
    toggleThumbOn:   { alignSelf: 'flex-end' },
  });
}

// ─── Main styles ──────────────────────────────────────────────────────────────
function createS(c: AppColors) {
  return StyleSheet.create({
  wrap:         { flex: 1, backgroundColor: c.bluePale },
  header:       { backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E6EEF7' },
  headerLogoRow:{ marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:  { fontSize: 24, fontWeight: '900', color: c.white, letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  headerSub:    { fontSize: 11, color: c.blueBorder, width: 48, textAlign: 'left' },
  hamburgerBtn: { backgroundColor: '#EEF4FB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  hamburgerText:{ fontSize: 20, color: c.blueDark, fontWeight: '700', lineHeight: 22 },
  // Messages icon
  msgIconBtn:   { backgroundColor: '#EEF4FB', borderRadius: 10, width: 38, height: 32, alignItems: 'center', justifyContent: 'center' },
  msgIconText:  { fontSize: 18 },
  msgBadge:     { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: c.blueDark },
  msgBadgeText: { color: c.white, fontSize: 10, fontWeight: '800' },
  nearbyBtn:         { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  nearbyBtnActive:   { backgroundColor: c.white },
  nearbyBtnText:     { fontSize: 14, color: c.white, fontWeight: '700', textAlign: 'center' },
  nearbyBtnTextActive: { color: c.blue },
  searchWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F6FC', borderWidth: 1, borderColor: '#E1EAF5', borderRadius: 14, paddingHorizontal: 12, height: 42, gap: 8 },
  searchInput:     { flex: 1, fontSize: 13, color: c.textDark, padding: 0 },
  searchDropdown:  { position: 'absolute', top: 44, left: 0, right: 0, backgroundColor: c.white, borderRadius: 14, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, zIndex: 9999, overflow: 'hidden' },
  searchSuggItem:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  searchSuggText:  { flex: 1, fontSize: 14, color: c.textDark, textAlign: 'right', fontWeight: '500' },
  tabsBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 6, height: 40, minWidth: '100%' },
  tab:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  tabActive:    { backgroundColor: c.white, borderColor: c.white },
  tabText:      { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  tabTextActive:{ color: c.blueDark, fontWeight: '700' },
  body:         { flex: 1, flexDirection: 'column' },
  mapWrap:      { width: '100%', height: H * 0.205, borderBottomWidth: 1, borderColor: c.blueBorder },
  map:          { flex: 1 },
  list:         { flex: 1 },
  pinHead:      { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: c.white, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  pinTail:      { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  pinText:      { color: c.white, fontWeight: '900', fontSize: 10 },
  callout:      { width: 140, padding: 8 },
  calloutName:  { fontSize: 13, fontWeight: '700', color: c.textDark, marginBottom: 2 },
  calloutSub:   { fontSize: 11, color: c.textSub, marginBottom: 3 },
  backToList:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.grayBorder },
  backToListText: { fontSize: 13, fontWeight: '700', color: c.blue },
  card:         { backgroundColor: c.white, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: c.blueBorder, shadowColor: '#185FA5', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  cardSel:      { borderColor: c.blue, borderWidth: 1.5, elevation: 6 },
  cardTop:      { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarLg:     { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  onlineDot:    { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#fff' },
  verifiedBadge:{ width: 17, height: 17, borderRadius: 9, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  pricePill:    { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', shadowColor: '#185FA5', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  pricePillNum: { color: '#fff', fontWeight: '900', fontSize: 16, lineHeight: 18 },
  pricePillSub: { color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 9, marginTop: 1 },
  avatarText:   { color: c.white, fontWeight: '900', fontSize: 15 },
  cardName:     { fontSize: 14, fontWeight: '700', color: c.blue },
  cardCity:     { fontSize: 11, color: c.textSub },
  priceTag:     { backgroundColor: c.blueLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  priceText:    { fontSize: 14, fontWeight: '900', color: c.blue },
  priceSub:     { fontSize: 9, color: c.textSub },
  ratingVal:    { fontSize: 12, fontWeight: '700', color: c.textDark },
  reviewsLink:  { fontSize: 11, color: c.blue, textDecorationLine: 'underline' },
  availPill:    { backgroundColor: c.greenBg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  availPillOff: { backgroundColor: c.grayBg, borderWidth: 1, borderColor: c.grayBorder },
  availPillText:{ fontSize: 10, fontWeight: '700', color: c.green },
  typePill:     { backgroundColor: c.blueLight, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  typePillText: { fontSize: 9, fontWeight: '600', color: c.blueDark },
  cardExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: c.blueBorder },
  payChip:      { backgroundColor: c.grayBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: c.grayBorder },
  payChipText:  { fontSize: 10, fontWeight: '600', color: c.textDark },
  actionBtn:         { flex: 1, backgroundColor: c.blueLight, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.blueBorder, minHeight: 40 },
  actionBtnText:     { fontSize: 14, fontWeight: '700', color: c.blue, textAlign: 'center' },
  actionBtnPrimary:  { flex: 1, backgroundColor: c.blue, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: c.white, textAlign: 'center' },
  urgentHeaderBtn:  { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  darkModeToggle:   { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  a11yBtn:          { backgroundColor: '#EEF4FB', borderRadius: 10, width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  urgentHeaderBtnText: { fontSize: 13, color: c.white, fontWeight: '900' },
  empty:        { textAlign: 'center', color: c.textSub, fontSize: 14, marginTop: 40 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.blueDark, padding: 16 },
  closeBtn:     { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: c.white },
  profileHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.blueDark, padding: 16 },
  profileHeaderTitle:{ fontSize: 16, fontWeight: '800', color: c.white },
  profileHero:       { backgroundColor: c.blue, padding: 24, alignItems: 'center', gap: 8 },
  profileAvatar:     { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  profileAvatarText: { color: c.white, fontWeight: '900', fontSize: 28 },
  profileName:       { fontSize: 22, fontWeight: '900', color: c.white },
  profileCity:       { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  statsRow:     { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20, marginTop: 8 },
  statBox:      { flex: 1, alignItems: 'center' },
  statDivider:  { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  statVal:      { fontSize: 20, fontWeight: '900', color: c.white },
  statLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  profileSection:     { backgroundColor: c.white, margin: 12, marginBottom: 0, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.blueBorder, alignItems: 'center' },
  profileSectionTitle:{ fontSize: 15, fontWeight: '800', color: c.textDark, marginBottom: 10, textAlign: 'center' },
  profileBio:         { fontSize: 14, color: c.textMid, lineHeight: 22, textAlign: 'center' },
  phonePill:          { backgroundColor: c.blueLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: c.blueBorder },
  phonePillText:      { fontSize: 14, fontWeight: '700', color: c.blue },
  servicePill:  { backgroundColor: c.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  servicePillText: { fontSize: 12, fontWeight: '600', color: c.blueDark },
  areaPill:     { backgroundColor: c.blueLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: c.blueBorder },
  areaPillText: { fontSize: 12, fontWeight: '700', color: c.blue },
  payPill:      { backgroundColor: c.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  payPillText:  { fontSize: 12, fontWeight: '600', color: c.white },
  seeAllBtn:    { fontSize: 13, color: c.blue, fontWeight: '700' },
  allReviewsBtn:     { backgroundColor: c.blueLight, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: c.blueBorder },
  allReviewsBtnText: { fontSize: 13, fontWeight: '700', color: c.blue },
  profileFooter:     { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, backgroundColor: c.bluePale, borderTopWidth: 1, borderColor: c.blueBorder },
  footerChat:   { flex: 1, backgroundColor: c.blueLight, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: c.blueBorder },
  footerChatText: { fontSize: 14, fontWeight: '700', color: c.blue },
  footerBook:   { flex: 2, backgroundColor: c.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  footerBookText: { fontSize: 14, fontWeight: '700', color: c.white },
  availBadge:   { backgroundColor: c.greenBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  availBadgeOff:{ backgroundColor: 'rgba(255,255,255,0.15)' },
  availBadgeText: { fontSize: 12, fontWeight: '700', color: c.green },
  ratingBigCard: { backgroundColor: c.white, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: c.blueBorder },
  ratingBigNum:  { fontSize: 48, fontWeight: '900', color: c.textDark },
  ratingBigCount:{ fontSize: 13, color: c.textSub },
  reviewCard:   { backgroundColor: c.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.blueBorder, elevation: 2, alignSelf: 'stretch', width: '100%' },
  reviewTop:    { flexDirection: 'row-reverse', gap: 10, alignItems: 'center', marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { color: c.white, fontWeight: '700', fontSize: 14 },
  reviewName:   { fontSize: 13, fontWeight: '700', color: c.textDark, marginBottom: 3, textAlign: 'right' },
  reviewText:   { fontSize: 13, color: c.textMid, lineHeight: 20, textAlign: 'right' },
  bookingCard:  { backgroundColor: c.white, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: c.blueBorder },
  bookingAvatar:{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center' },
  bookingAvatarText: { color: c.white, fontWeight: '900', fontSize: 16 },
  bookingName:  { fontSize: 15, fontWeight: '700', color: c.textDark },
  bookingCity:  { fontSize: 12, color: c.textSub },
  fieldLabel:   { fontSize: 13, fontWeight: '700', color: c.textDark, textAlign: 'right' },
  hoursRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hourBtn:      { width: 48, height: 48, borderRadius: 12, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.blueBorder },
  hourBtnActive:{ backgroundColor: c.blue, borderColor: c.blue },
  hourBtnText:  { fontSize: 16, fontWeight: '700', color: c.textDark },
  input:        { backgroundColor: c.white, borderRadius: 10, padding: 13, fontSize: 14, color: c.textDark, borderWidth: 1, borderColor: c.blueBorder },
  payRow:       { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  payBtn:       { flex: 1, minWidth: 60, backgroundColor: c.white, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: c.blueBorder },
  payBtnActive: { backgroundColor: c.blueLight, borderColor: c.blue },
  payIcon:      { fontSize: 20, marginBottom: 4 },
  payLabel:     { fontSize: 11, fontWeight: '600', color: c.textDark, textAlign: 'center' },
  summaryCard:  { backgroundColor: c.white, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: c.blueBorder },
  summaryLabel: { fontSize: 14, color: c.textMid },
  summaryTotal: { fontSize: 24, fontWeight: '900', color: c.blue },
  confirmBtn:   { backgroundColor: c.blue, borderRadius: 12, padding: 15, alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '800', color: c.white },
  successWrap:  { alignItems: 'center', padding: 32 },
  successTitle: { fontSize: 24, fontWeight: '900', color: c.textDark, marginBottom: 10, marginTop: 16 },
  successSub:   { fontSize: 15, color: c.textMid, textAlign: 'center', lineHeight: 26, marginBottom: 24 },
  nextStepsCard:   { backgroundColor: c.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.blueBorder, width: '100%', marginBottom: 20, gap: 10 },
  nextStepsTitle:  { fontSize: 15, fontWeight: '800', color: c.textDark, marginBottom: 4 },
  nextStepItem:    { fontSize: 14, color: c.textMid, lineHeight: 22 },
  myBookingsBtn:   { backgroundColor: c.blueLight, borderRadius: 12, padding: 14, alignItems: 'center', width: '100%', marginBottom: 0, borderWidth: 1.5, borderColor: c.blue },
  myBookingsBtnText: { fontSize: 15, fontWeight: '800', color: c.blue },
  bubble:       { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleClient: { backgroundColor: c.white, borderWidth: 1, borderColor: c.blueBorder },
  bubbleCleaner:{ backgroundColor: c.blue },
  bitCard:      { backgroundColor: '#EEF6FF', borderRadius: 14, padding: 14, marginVertical: 4, borderWidth: 1.5, borderColor: '#3B82F6', minWidth: 160, alignItems: 'center' },
  bitCardTitle: { fontSize: 13, fontWeight: '700', color: '#1D4ED8', marginBottom: 4 },
  bitCardAmount:{ fontSize: 24, fontWeight: '900', color: '#1D4ED8', marginBottom: 10 },
  bitBtn:       { backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  bitBtnText:   { fontSize: 14, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  chatRow:      { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: c.white, borderTopWidth: 1, borderColor: c.blueBorder, alignItems: 'center' },
  chatInput:    { flex: 1, backgroundColor: c.bluePale, borderRadius: 10, padding: 10, fontSize: 14, color: c.textDark, borderWidth: 1, borderColor: c.blueBorder },
  sendBtn:      { width: 42, height: 42, backgroundColor: c.blue, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  micBtn:       { width: 42, height: 42, backgroundColor: c.blueLight, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.blueBorder },
  micBtnRecording: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  audioBubble:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: W * 0.65 },
  audioBubbleClient: { backgroundColor: c.blueLight, borderWidth: 1, borderColor: c.blueBorder },
  audioBubbleCleaner: { backgroundColor: c.blue },
  // Date / Time / Recurring / Promo
  dateBtn:       { backgroundColor: c.white, borderRadius: 10, padding: 13, borderWidth: 1, borderColor: c.blueBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateBtnText:   { fontSize: 15, fontWeight: '700', color: c.textDark },
  timeSlotBtn:   { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: c.white, borderWidth: 1, borderColor: c.blueBorder, alignItems: 'center', justifyContent: 'center' },
  timeSlotBtnActive: { backgroundColor: c.blue, borderColor: c.blue },
  timeSlotText:  { fontSize: 12, fontWeight: '700', color: c.textDark },
  recurBtn:      { flex: 1, backgroundColor: c.white, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: c.blueBorder },
  recurBtnActive:{ backgroundColor: c.blue, borderColor: c.blue },
  recurBtnText:  { fontSize: 12, fontWeight: '700', color: c.textDark },
  promoRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  promoBtn:      { backgroundColor: c.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  promoBtnText:  { fontSize: 13, fontWeight: '800', color: c.white, textAlign: 'center' },
  // Badges
  badgePill:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgePillText: { fontSize: 10, fontWeight: '800' },
  freeCommissionBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#6EE7B7' },
  freeCommissionBadgeText: { fontSize: 10, fontWeight: '800', color: '#065F46' },
  freeBanner:      { backgroundColor: '#ECFDF5', borderRadius: 12, marginHorizontal: 0, marginBottom: 6, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#6EE7B7' },
  freeBannerTitle: { fontSize: 13, fontWeight: '900', color: '#065F46', textAlign: 'center' },
  freeBannerSub:   { fontSize: 11, color: '#047857', textAlign: 'center' },
  });
}


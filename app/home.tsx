import React, { useState, useRef, useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, Modal, SafeAreaView, StatusBar,
  Alert, Dimensions, Animated, Platform, Linking, Switch,
  KeyboardAvoidingView, ActivityIndicator, BackHandler,
} from 'react-native';
import { SafeAreaView as SafeAreaViewCtx } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { collection, addDoc, getDocs, query, where, doc, getDoc, setDoc, onSnapshot, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage } from '../lib/LanguageContext';
import { Lang } from '../lib/translations';
import { useTheme } from '../lib/ThemeContext';


const W = Dimensions.get('window').width;
const NAV_BAR_HEIGHT = Platform.OS === 'android'
  ? Math.max(0, Dimensions.get('screen').height - Dimensions.get('window').height - (StatusBar.currentHeight || 0))
  : 0;

const C = {
  blue:       '#185FA5',
  blueDark:   '#0D4F96',
  blueLight:  '#E6F1FB',
  bluePale:   '#F4F8FD',
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
  { id:'1',  name:'מירה כהן',    initials:'מכ', city:'חיפה',         region:'north',  workAreas:['north'],  types:['ניקוי לפסח','חלונות'],      price:80,  rating:4.9, reviews:142, available:true,  payment:['cash','bit','card'], lat:32.794, lng:34.989, bio:'מנקה מקצועית.', reviewsList:RL },
  { id:'2',  name:'כרמל אבו',    initials:'כא', city:'חיפה',         region:'north',  workAreas:['north'],  types:['שטיפת רכב','חלונות'],       price:65,  rating:4.6, reviews:87,  available:false, payment:['cash','bit'],        lat:32.800, lng:34.995, bio:'מומחה לשטיפת רכב.', reviewsList:RL },
  { id:'3',  name:'נועה לוי',    initials:'נל', city:'חיפה',         region:'north',  workAreas:['north'],  types:['חלונות','לאחר שיפוץ'],      price:70,  rating:4.7, reviews:63,  available:true,  payment:['cash'],               lat:32.788, lng:34.980, bio:'מנקה אמינה ויסודית.', reviewsList:RL },
  { id:'4',  name:'סאמי חסן',    initials:'סח', city:'נצרת',         region:'north',  workAreas:['north'],  types:['חלונות','שטיפת רכב'],       price:60,  rating:4.5, reviews:44,  available:true,  payment:['cash','bit'],         lat:32.699, lng:35.303, bio:'מומחה לניקוי חלונות.', reviewsList:RL },
  { id:'5',  name:'רינה ברק',    initials:'רב', city:'נצרת',         region:'north',  workAreas:['north'],  types:['ניקוי לפסח','חלונות'],      price:75,  rating:4.8, reviews:91,  available:true,  payment:['card','cash'],        lat:32.705, lng:35.298, bio:'מנקה מקצועית.', reviewsList:RL },
  { id:'6',  name:'אמיר שלום',   initials:'אש', city:'עכו',          region:'north',  workAreas:['north'],  types:['שטיפת רכב','ניקוי לפסח'],  price:65,  rating:4.6, reviews:55,  available:true,  payment:['cash'],               lat:32.928, lng:35.082, bio:'מנקה סדיר ואמין.', reviewsList:RL },
  { id:'7',  name:'חאלד נאסר',   initials:'חנ', city:'טבריה',        region:'north',  workAreas:['north'],  types:['ניקוי לפסח','לאחר שיפוץ'], price:85,  rating:4.8, reviews:72,  available:true,  payment:['cash','bit'],         lat:32.795, lng:35.531, bio:'מומחה לניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'8',  name:'יואב גל',     initials:'יג', city:'חריש',         region:'north',  workAreas:['north','center'],  types:['ניקוי לפסח','שטיפת רכב'],  price:70,  rating:4.6, reviews:41,  available:true,  payment:['bit','cash'],         lat:32.458, lng:35.041, bio:'מנקה חריש ואזור השרון.', reviewsList:RL },
  { id:'9',  name:'שלי אדם',     initials:'שא', city:'חריש',         region:'north',  workAreas:['north','center'],  types:['חלונות','ניקיון משרדים'],   price:65,  rating:4.5, reviews:33,  available:true,  payment:['cash'],                lat:32.453, lng:35.036, bio:'ניקיון משרדים ובתים.', reviewsList:RL },
  { id:'10', name:'דנה שמיר',    initials:'דש', city:'חריש',         region:'north',  workAreas:['north','center'],  types:['לאחר שיפוץ','ניקוי לפסח'], price:90,  rating:4.9, reviews:28,  available:true,  payment:['card','cash'],        lat:32.462, lng:35.044, bio:'מתמחה בניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'11', name:'רחל גולדברג', initials:'רג', city:'תל אביב',      region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:95,  rating:4.9, reviews:211, available:true,  payment:['card','bit','cash'],  lat:32.087, lng:34.789, bio:'מנקה בכירה.', reviewsList:RL },
  { id:'12', name:'דוד אזולאי',  initials:'דא', city:'תל אביב',      region:'center', workAreas:['center'], types:['חלונות','ניקיון משרדים'],   price:85,  rating:4.7, reviews:166, available:true,  payment:['card','cash'],        lat:32.075, lng:34.775, bio:'מקצועי ומהיר.', reviewsList:RL },
  { id:'13', name:'ליאת שמש',    initials:'לש', city:'תל אביב',      region:'center', workAreas:['center'], types:['שטיפת רכב','ניקוי לפסח'],  price:75,  rating:4.6, reviews:88,  available:true,  payment:['bit','cash'],         lat:32.095, lng:34.800, bio:'אמינה ויסודית.', reviewsList:RL },
  { id:'14', name:'נועם לוי',    initials:'נל', city:'תל אביב',      region:'center', workAreas:['center'], types:['לאחר שיפוץ','ניקוי לפסח'], price:100, rating:4.9, reviews:97,  available:false, payment:['card','bit','cash'],  lat:32.080, lng:34.770, bio:'פרפקציוניסט מוחלט.', reviewsList:RL },
  { id:'15', name:'אנה פטרוב',   initials:'אפ', city:'ירושלים',      region:'center', workAreas:['center'], types:['חלונות','ניקוי לפסח'],      price:70,  rating:4.6, reviews:55,  available:true,  payment:['cash','bit'],         lat:31.782, lng:35.218, bio:'אמינה ותמיד בזמן.', reviewsList:RL },
  { id:'16', name:'יוסי מזרחי',  initials:'ימ', city:'ירושלים',      region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:75,  rating:4.7, reviews:82,  available:true,  payment:['cash'],                lat:31.790, lng:35.225, bio:'מנקה ירושלים ואזוריה.', reviewsList:RL },
  { id:'17', name:'לימור שפירא', initials:'לש', city:'נתניה',        region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:80,  rating:4.8, reviews:103, available:true,  payment:['bit','cash'],         lat:32.329, lng:34.857, bio:'מתמחה בניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'18', name:'מוחמד עבאס',  initials:'מע', city:'ראשון לציון',  region:'center', workAreas:['center','south'], types:['לאחר שיפוץ','חלונות'],      price:110, rating:5.0, reviews:87,  available:true,  payment:['card','bit','cash'],  lat:31.971, lng:34.789, bio:'פרפקציוניסט מוחלט.', reviewsList:RL },
  { id:'19', name:'שרית לוי',    initials:'של', city:'פתח תקוה',     region:'center', workAreas:['center'], types:['חלונות','ניקיון משרדים'],   price:65,  rating:4.5, reviews:44,  available:true,  payment:['cash'],                lat:32.089, lng:34.888, bio:'ניקיון משרדים ובתים.', reviewsList:RL },
  { id:'20', name:'דנה כץ',      initials:'דכ', city:'כפר סבא',      region:'center', workAreas:['center'], types:['שטיפת רכב','ניקוי לפסח'],  price:70,  rating:4.6, reviews:57,  available:true,  payment:['cash','bit'],         lat:32.175, lng:34.907, bio:'מנקה אמינה ומהירה.', reviewsList:RL },
  { id:'21', name:'מיה גולן',    initials:'מג', city:'הרצליה',       region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:90,  rating:4.8, reviews:79,  available:true,  payment:['card','bit','cash'],  lat:32.165, lng:34.843, bio:'מנקה הרצליה ואזוריה.', reviewsList:RL },
  { id:'22', name:"ג'ורג' נסר",  initials:'גנ', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['ניקוי לפסח','חלונות'],      price:65,  rating:4.7, reviews:83,  available:true,  payment:['cash','bit'],         lat:31.252, lng:34.791, bio:'מנקה מקצועי בדרום הארץ.', reviewsList:RL },
  { id:'23', name:'אורי מזרחי',  initials:'אמ', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['שטיפת רכב','חלונות'],       price:60,  rating:4.5, reviews:47,  available:true,  payment:['cash'],                lat:31.245, lng:34.800, bio:'מומחה לשטיפת רכב.', reviewsList:RL },
  { id:'24', name:'נעמי כהן',    initials:'נכ', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['לאחר שיפוץ','ניקוי לפסח'], price:80,  rating:4.8, reviews:61,  available:true,  payment:['card','cash'],        lat:31.255, lng:34.780, bio:'מתמחה בניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'25', name:'יעל שמש',     initials:'יש', city:'אשדוד',        region:'south',  workAreas:['south'],  types:['שטיפת רכב','ניקוי לפסח'],  price:70,  rating:4.8, reviews:129, available:false, payment:['card','bit','cash'],  lat:31.804, lng:34.655, bio:'מנקה מנוסה ואמינה.', reviewsList:RL },
  { id:'26', name:'רמי עמר',     initials:'רע', city:'אשדוד',        region:'south',  workAreas:['south'],  types:['לאחר שיפוץ','חלונות'],      price:90,  rating:4.9, reviews:96,  available:true,  payment:['card','cash'],        lat:31.810, lng:34.648, bio:'מתמחה בניקוי לאחר שיפוצים.', reviewsList:RL },
  { id:'27', name:'עמי נחום',    initials:'ענ', city:'אשקלון',       region:'south',  workAreas:['south'],  types:['ניקוי לפסח','חלונות'],      price:70,  rating:4.7, reviews:58,  available:true,  payment:['cash','bit'],         lat:31.668, lng:34.571, bio:'מנקה אשקלון ואזוריה.', reviewsList:RL },
  { id:'28', name:'פאטמה סאלח',  initials:'פס', city:'אילת',         region:'south',  workAreas:['south'],  types:['ניקוי לפסח','שטיפת רכב'],  price:85,  rating:5.0, reviews:64,  available:true,  payment:['cash','bit'],         lat:29.558, lng:34.952, bio:'הטובה ביותר באילת!', reviewsList:RL },
  { id:'29', name:'משה גבאי',    initials:'מג', city:'אילת',         region:'south',  workAreas:['south'],  types:['שטיפת רכב','חלונות'],       price:75,  rating:4.7, reviews:41,  available:true,  payment:['card','cash'],        lat:29.552, lng:34.948, bio:'מומחה לשטיפת רכב.', reviewsList:RL },
  // ── קריות (צפון) ──
  { id:'30', name:'תמר כץ',      initials:'תכ', city:'קריית אתא',    region:'north',  workAreas:['north'],  types:['ניקוי לפסח','חלונות'],      price:72,  rating:4.8, reviews:93,  available:true,  payment:['cash','bit'],         lat:32.804, lng:35.107, bio:'מנקה מקצועית בקריות.', reviewsList:RL },
  { id:'31', name:'אריאל דוד',   initials:'אד', city:'קריית ביאליק', region:'north',  workAreas:['north'],  types:['שטיפת רכב','ניקיון משרדים'],price:68,  rating:4.6, reviews:51,  available:true,  payment:['cash'],               lat:32.831, lng:35.090, bio:'שטיפת רכב מקצועית.', reviewsList:RL },
  { id:'32', name:'מיכל רוזן',   initials:'מר', city:'קריית מוצקין', region:'north',  workAreas:['north'],  types:['ניקיון אחרי אירוע','חלונות'],price:90, rating:4.9, reviews:77,  available:false, payment:['card','bit','cash'],  lat:32.836, lng:35.075, bio:'מומחית לניקיון אחרי אירועים.', reviewsList:RL },
  { id:'33', name:'יגאל שמעון',  initials:'יש', city:'קריית ים',     region:'north',  workAreas:['north'],  types:['לאחר שיפוץ','ניקוי לפסח'], price:80,  rating:4.7, reviews:44,  available:true,  payment:['cash','bit'],         lat:32.851, lng:35.068, bio:'מתמחה בשיפוצים וניקוי לפסח.', reviewsList:RL },
  // ── נהריה / כרמיאל (צפון) ──
  { id:'34', name:'לילה חדד',    initials:'לח', city:'נהריה',        region:'north',  workAreas:['north'],  types:['חלונות','ניקוי לפסח'],      price:65,  rating:4.6, reviews:38,  available:true,  payment:['cash'],               lat:33.005, lng:35.098, bio:'מנקה נהריה והסביבה.', reviewsList:RL },
  { id:'35', name:'רון אביב',    initials:'רא', city:'כרמיאל',       region:'north',  workAreas:['north'],  types:['שטיפת רכב','חלונות'],       price:60,  rating:4.5, reviews:29,  available:true,  payment:['cash','bit'],         lat:32.916, lng:35.298, bio:'מנקה כרמיאל.', reviewsList:RL },
  { id:'36', name:'סוזן נסאר',   initials:'סנ', city:'עפולה',        region:'north',  workAreas:['north'],  types:['ניקוי לפסח','ניקיון משרדים'],price:70, rating:4.7, reviews:56,  available:true,  payment:['cash','bit'],         lat:32.608, lng:35.289, bio:'מנקה מקצועית בעמק.', reviewsList:RL },
  { id:'37', name:'בנימין לוי',  initials:'בל', city:'צפת',          region:'north',  workAreas:['north'],  types:['לאחר שיפוץ','חלונות'],      price:75,  rating:4.8, reviews:33,  available:false, payment:['cash'],               lat:32.965, lng:35.497, bio:'מנקה צפת והסביבה.', reviewsList:RL },
  { id:'38', name:'חנה אורלוב',  initials:'חא', city:'בית שאן',      region:'north',  workAreas:['north'],  types:['ניקוי לפסח','שטיפת רכב'],  price:60,  rating:4.5, reviews:22,  available:true,  payment:['cash'],               lat:32.499, lng:35.499, bio:'מנקה אמינה ויסודית.', reviewsList:RL },
  { id:'39', name:'קרים חסן',    initials:'קח', city:'יוקנעם',       region:'north',  workAreas:['north'],  types:['ניקיון אחרי אירוע','חלונות'],price:85, rating:4.8, reviews:47,  available:true,  payment:['cash','bit'],         lat:32.658, lng:35.098, bio:'מומחה לניקיון אחרי אירועים.', reviewsList:RL },
  // ── רמת גן / גבעתיים (מרכז) ──
  { id:'40', name:'שירה כהן',    initials:'שכ', city:'רמת גן',       region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:88,  rating:4.9, reviews:134, available:true,  payment:['card','bit','cash'],  lat:32.082, lng:34.813, bio:'מנקה רמת גן ואזוריה.', reviewsList:RL },
  { id:'41', name:'אלון גרין',   initials:'אג', city:'רמת גן',       region:'center', workAreas:['center'], types:['שטיפת רכב','ניקיון משרדים'],price:80,  rating:4.7, reviews:61,  available:false, payment:['card','cash'],        lat:32.078, lng:34.820, bio:'מקצועי ומהיר.', reviewsList:RL },
  { id:'42', name:'נטע שפר',     initials:'נש', city:'גבעתיים',      region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','ניקוי לפסח'],price:95, rating:4.9, reviews:88, available:true, payment:['card','bit','cash'],  lat:32.071, lng:34.813, bio:'מנקה גבעתיים ורמת גן.', reviewsList:RL },
  // ── חולון / בת ים (מרכז) ──
  { id:'43', name:'אוסמה עבאס',  initials:'אע', city:'חולון',        region:'center', workAreas:['center'], types:['לאחר שיפוץ','ניקוי לפסח'], price:82,  rating:4.7, reviews:72,  available:true,  payment:['cash','bit'],         lat:32.011, lng:34.779, bio:'מנקה חולון ובת ים.', reviewsList:RL },
  { id:'44', name:'רינת אזולאי', initials:'רא', city:'בת ים',        region:'center', workAreas:['center'], types:['חלונות','ניקיון אחרי אירוע'],price:78,  rating:4.6, reviews:55,  available:true,  payment:['cash'],               lat:32.023, lng:34.752, bio:'מנקה בת ים וחולון.', reviewsList:RL },
  { id:'45', name:'יצחק פרץ',    initials:'יפ', city:'חולון',        region:'center', workAreas:['center'], types:['שטיפת רכב','חלונות'],       price:70,  rating:4.5, reviews:39,  available:false, payment:['cash','bit'],         lat:32.018, lng:34.772, bio:'שטיפת רכב מקצועית.', reviewsList:RL },
  // ── רחובות / נס ציונה (מרכז) ──
  { id:'46', name:'מרינה פדיה',  initials:'מפ', city:'רחובות',       region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:85,  rating:4.8, reviews:96,  available:true,  payment:['card','bit','cash'],  lat:31.895, lng:34.811, bio:'מנקה מקצועית ברחובות.', reviewsList:RL },
  { id:'47', name:'שמואל כהן',   initials:'שכ', city:'נס ציונה',     region:'center', workAreas:['center'], types:['שטיפת רכב','ניקיון משרדים'],price:72,  rating:4.6, reviews:44,  available:true,  payment:['cash'],               lat:31.929, lng:34.798, bio:'מנקה נס ציונה.', reviewsList:RL },
  { id:'48', name:'לאה גרוס',    initials:'לג', city:'רחובות',       region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','חלונות'],price:92,  rating:4.9, reviews:67,  available:true,  payment:['card','cash'],        lat:31.890, lng:34.817, bio:'מומחית לאירועים.', reviewsList:RL },
  // ── מודיעין (מרכז) ──
  { id:'49', name:'תומר שני',    initials:'תש', city:'מודיעין',      region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:90,  rating:4.8, reviews:81,  available:true,  payment:['card','bit','cash'],  lat:31.893, lng:35.010, bio:'מנקה מודיעין.', reviewsList:RL },
  { id:'50', name:'כלנית מור',   initials:'כמ', city:'מודיעין',      region:'center', workAreas:['center'], types:['לאחר שיפוץ','שטיפת רכב'],  price:85,  rating:4.7, reviews:53,  available:false, payment:['cash','bit'],         lat:31.898, lng:35.004, bio:'מתמחה בשיפוצים.', reviewsList:RL },
  // ── רמלה / לוד (מרכז) ──
  { id:'51', name:'חאלד יוסף',   initials:'חי', city:'רמלה',         region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:70, rating:4.6, reviews:48, available:true, payment:['cash'],              lat:31.929, lng:34.873, bio:'מנקה רמלה ולוד.', reviewsList:RL },
  { id:'52', name:'שושנה מזרחי', initials:'שמ', city:'לוד',          region:'center', workAreas:['center'], types:['חלונות','ניקוי לפסח'],      price:65,  rating:4.5, reviews:37,  available:true,  payment:['cash','bit'],         lat:31.951, lng:34.898, bio:'מנקה לוד ואזוריה.', reviewsList:RL },
  // ── רעננה / הוד השרון (מרכז) ──
  { id:'53', name:'אורית שמיר',  initials:'אש', city:'רעננה',        region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:95,  rating:4.9, reviews:118, available:true,  payment:['card','bit','cash'],  lat:32.184, lng:34.870, bio:'מנקה רעננה והסביבה.', reviewsList:RL },
  { id:'54', name:'גיל אלון',    initials:'גא', city:'הוד השרון',    region:'center', workAreas:['center'], types:['שטיפת רכב','ניקיון משרדים'],price:80,  rating:4.7, reviews:62,  available:true,  payment:['card','cash'],        lat:32.151, lng:34.888, bio:'מקצועי ומהיר.', reviewsList:RL },
  { id:'55', name:'מיכל עמית',   initials:'מע', city:'הוד השרון',    region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','ניקוי לפסח'],price:100, rating:4.9, reviews:74, available:false, payment:['card','bit','cash'],  lat:32.148, lng:34.892, bio:'מומחית לאירועים ופסח.', reviewsList:RL },
  // ── בני ברק (מרכז) ──
  { id:'56', name:'אסתר פרידמן', initials:'אפ', city:'בני ברק',      region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:82,  rating:4.8, reviews:107, available:true,  payment:['cash'],               lat:32.084, lng:34.833, bio:'מנקה בני ברק.', reviewsList:RL },
  { id:'57', name:'משה שטרן',    initials:'מש', city:'בני ברק',      region:'center', workAreas:['center'], types:['לאחר שיפוץ','מחסן ועליית גג'],price:75, rating:4.6, reviews:43, available:true, payment:['cash'],              lat:32.082, lng:34.837, bio:'מתמחה בשיפוצים ומחסנים.', reviewsList:RL },
  // ── פתח תקוה (מרכז) ──
  { id:'58', name:'דינה לוי',    initials:'דל', city:'פתח תקוה',     region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:87, rating:4.8, reviews:91, available:true, payment:['card','bit','cash'],  lat:32.094, lng:34.888, bio:'מנקה פתח תקוה.', reviewsList:RL },
  { id:'59', name:'עמנואל דסה',  initials:'עד', city:'פתח תקוה',     region:'center', workAreas:['center'], types:['שטיפת רכב','חלונות'],       price:70,  rating:4.5, reviews:35,  available:false, payment:['cash','bit'],         lat:32.089, lng:34.882, bio:'שטיפת רכב מהירה.', reviewsList:RL },
  // ── קריית אונו / אור יהודה (מרכז) ──
  { id:'60', name:'יעל ברק',     initials:'יב', city:'קריית אונו',   region:'center', workAreas:['center'], types:['ניקוי לפסח','חלונות'],      price:88,  rating:4.8, reviews:66,  available:true,  payment:['card','cash'],        lat:32.058, lng:34.856, bio:'מנקה קריית אונו.', reviewsList:RL },
  { id:'61', name:'זיו שלום',    initials:'זש', city:'אור יהודה',    region:'center', workAreas:['center'], types:['ניקיון משרדים','לאחר שיפוץ'],price:78,  rating:4.7, reviews:49,  available:true,  payment:['cash','bit'],         lat:32.028, lng:34.857, bio:'מנקה אור יהודה.', reviewsList:RL },
  // ── ירושלים נוספים ──
  { id:'62', name:'רחל אברהם',   initials:'רא', city:'ירושלים',      region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:85, rating:4.9, reviews:122, available:true, payment:['cash','bit'],         lat:31.775, lng:35.230, bio:'מנקה ירושלים.', reviewsList:RL },
  { id:'63', name:'ג\'ראח נסר',  initials:'גנ', city:'ירושלים',      region:'center', workAreas:['center'], types:['שטיפת רכב','חלונות'],       price:72,  rating:4.6, reviews:58,  available:true,  payment:['cash'],               lat:31.787, lng:35.220, bio:'שטיפת רכב מקצועית.', reviewsList:RL },
  { id:'64', name:'שרה גולד',    initials:'שג', city:'ירושלים',      region:'center', workAreas:['center'], types:['מחסן ועליית גג','לאחר שיפוץ'],price:80, rating:4.7, reviews:41,  available:false, payment:['cash','bit'],         lat:31.793, lng:35.213, bio:'מתמחה במחסנים ושיפוצים.', reviewsList:RL },
  // ── נתניה נוספים ──
  { id:'65', name:'איריס לוי',   initials:'אל', city:'נתניה',        region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:82, rating:4.8, reviews:77, available:true, payment:['card','bit','cash'],  lat:32.321, lng:34.854, bio:'מנקה נתניה.', reviewsList:RL },
  { id:'66', name:'בוריס קוגן',  initials:'בק', city:'נתניה',        region:'center', workAreas:['center'], types:['שטיפת רכב','חלונות'],       price:68,  rating:4.5, reviews:34,  available:true,  payment:['cash'],               lat:32.335, lng:34.861, bio:'שטיפת רכב נתניה.', reviewsList:RL },
  // ── אשדוד נוספים ──
  { id:'67', name:'לימור אוחיון',initials:'לא', city:'אשדוד',        region:'south',  workAreas:['south'],  types:['ניקוי לפסח','חלונות'],      price:74,  rating:4.8, reviews:88,  available:true,  payment:['cash','bit'],         lat:31.800, lng:34.650, bio:'מנקה אשדוד.', reviewsList:RL },
  { id:'68', name:'מנשה חדד',    initials:'מח', city:'אשדוד',        region:'south',  workAreas:['south'],  types:['ניקיון אחרי אירוע','לאחר שיפוץ'],price:90, rating:4.7, reviews:52, available:false, payment:['card','cash'],       lat:31.807, lng:34.643, bio:'מתמחה באירועים ושיפוצים.', reviewsList:RL },
  // ── נתיבות / שדרות (דרום) ──
  { id:'69', name:'חיה אסולין',  initials:'חא', city:'נתיבות',       region:'south',  workAreas:['south'],  types:['ניקוי לפסח','חלונות'],      price:60,  rating:4.6, reviews:31,  available:true,  payment:['cash'],               lat:31.421, lng:34.589, bio:'מנקה נתיבות.', reviewsList:RL },
  { id:'70', name:'אריק בוסו',   initials:'אב', city:'שדרות',        region:'south',  workAreas:['south'],  types:['שטיפת רכב','ניקוי לפסח'],  price:65,  rating:4.5, reviews:28,  available:true,  payment:['cash','bit'],         lat:31.524, lng:34.596, bio:'מנקה שדרות.', reviewsList:RL },
  // ── קריית גת / קריית מלאכי (דרום) ──
  { id:'71', name:'שני ממן',     initials:'שמ', city:'קריית גת',     region:'south',  workAreas:['south'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:72, rating:4.7, reviews:45, available:true, payment:['cash','bit'],         lat:31.608, lng:34.770, bio:'מנקה קריית גת.', reviewsList:RL },
  { id:'72', name:'אורן פלד',    initials:'אפ', city:'קריית מלאכי',  region:'south',  workAreas:['south'],  types:['לאחר שיפוץ','חלונות'],      price:65,  rating:4.5, reviews:23,  available:true,  payment:['cash'],               lat:31.732, lng:34.743, bio:'מנקה קריית מלאכי.', reviewsList:RL },
  // ── דימונה (דרום) ──
  { id:'73', name:'שלמה גפני',   initials:'שג', city:'דימונה',       region:'south',  workAreas:['south'],  types:['ניקוי לפסח','שטיפת רכב'],  price:58,  rating:4.5, reviews:27,  available:true,  payment:['cash'],               lat:31.069, lng:35.033, bio:'מנקה דימונה והנגב.', reviewsList:RL },
  // ── באר שבע נוספים ──
  { id:'74', name:'ורד אזולאי',  initials:'וא', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:75, rating:4.8, reviews:67, available:true, payment:['card','bit','cash'],  lat:31.248, lng:34.795, bio:'מנקה ב״ש.', reviewsList:RL },
  { id:'75', name:'גדי שמש',     initials:'גש', city:'באר שבע',      region:'south',  workAreas:['south'],  types:['מחסן ועליית גג','לאחר שיפוץ'],price:70, rating:4.6, reviews:38, available:false, payment:['cash'],              lat:31.260, lng:34.788, bio:'מתמחה במחסנים ושיפוצים.', reviewsList:RL },
  // ── תל אביב נוספים ──
  { id:'76', name:'יונתן לוי',   initials:'יל', city:'תל אביב',      region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון משרדים'],price:105, rating:5.0, reviews:189, available:true, payment:['card','bit','cash'],  lat:32.068, lng:34.780, bio:'מנקה בכיר ת״א.', reviewsList:RL },
  { id:'77', name:'דנית שרון',   initials:'דש', city:'תל אביב',      region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','חלונות'],price:98,  rating:4.9, reviews:143, available:true,  payment:['card','bit','cash'],  lat:32.077, lng:34.767, bio:'מומחית אירועים ת״א.', reviewsList:RL },
  { id:'78', name:'עמיר בן דוד', initials:'עב', city:'תל אביב',      region:'center', workAreas:['center'], types:['שטיפת רכב','מחסן ועליית גג'],price:88, rating:4.7, reviews:76, available:false, payment:['card','cash'],        lat:32.090, lng:34.793, bio:'מנקה ת״א.', reviewsList:RL },
  // ── חיפה נוספים ──
  { id:'79', name:'טל כהן',      initials:'טכ', city:'חיפה',         region:'north',  workAreas:['north'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:82, rating:4.8, reviews:99, available:true, payment:['card','bit','cash'],  lat:32.790, lng:34.994, bio:'מנקה חיפה.', reviewsList:RL },
  { id:'80', name:'נדיה פטרוב',  initials:'נפ', city:'חיפה',         region:'north',  workAreas:['north'],  types:['מחסן ועליית גג','לאחר שיפוץ'],price:75, rating:4.6, reviews:48, available:true, payment:['cash'],              lat:32.797, lng:34.982, bio:'מנקה חיפה והכרמל.', reviewsList:RL },
  { id:'81', name:'רמי כהן',     initials:'רכ', city:'חיפה',         region:'north',  workAreas:['north'],  types:['שטיפת רכב','חלונות'],       price:68,  rating:4.5, reviews:34,  available:false, payment:['cash','bit'],         lat:32.801, lng:34.987, bio:'שטיפת רכב חיפה.', reviewsList:RL },
  // ── כפר סבא / רמלה נוספים ──
  { id:'82', name:'אנה ברון',    initials:'אב', city:'כפר סבא',      region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:90, rating:4.9, reviews:83, available:true, payment:['card','bit','cash'],  lat:32.179, lng:34.911, bio:'מנקה כפר סבא.', reviewsList:RL },
  { id:'83', name:'מוחמד סעיד',  initials:'מס', city:'רמלה',         region:'center', workAreas:['center'], types:['לאחר שיפוץ','שטיפת רכב'],  price:72,  rating:4.6, reviews:41,  available:true,  payment:['cash','bit'],         lat:31.925, lng:34.869, bio:'מנקה רמלה.', reviewsList:RL },
  // ── הרצליה נוספים ──
  { id:'84', name:'גל ויס',      initials:'גו', city:'הרצליה',       region:'center', workAreas:['center'], types:['ניקיון משרדים','ניקוי לפסח'],price:100, rating:4.9, reviews:112, available:true, payment:['card','bit','cash'],  lat:32.162, lng:34.848, bio:'מנקה הרצליה.', reviewsList:RL },
  { id:'85', name:'ציפי חן',     initials:'צח', city:'הרצליה',       region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','חלונות'],price:95,  rating:4.8, reviews:68,  available:false, payment:['card','cash'],        lat:32.168, lng:34.841, bio:'מומחית אירועים הרצליה.', reviewsList:RL },
  // ── ראשון לציון נוספים ──
  { id:'86', name:'ניר שלום',    initials:'נש', city:'ראשון לציון',  region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:88,  rating:4.8, reviews:95,  available:true,  payment:['card','bit','cash'],  lat:31.967, lng:34.801, bio:'מנקה ראשל״צ.', reviewsList:RL },
  { id:'87', name:'פנינה אוחיון',initials:'פא', city:'ראשון לציון',  region:'center', workAreas:['center'], types:['חלונות','ניקיון אחרי אירוע'],price:82,  rating:4.7, reviews:59,  available:true,  payment:['cash','bit'],         lat:31.975, lng:34.794, bio:'מנקה ראשל״צ.', reviewsList:RL },
  { id:'88', name:'ג\'ורג סמיר', initials:'גס', city:'ראשון לציון',  region:'center', workAreas:['center'], types:['שטיפת רכב','מחסן ועליית גג'],price:75, rating:4.6, reviews:44, available:false, payment:['cash'],               lat:31.970, lng:34.808, bio:'שטיפת רכב ראשל״צ.', reviewsList:RL },
  // ── אשקלון נוספים ──
  { id:'89', name:'יפית דוד',    initials:'יד', city:'אשקלון',       region:'south',  workAreas:['south'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:76, rating:4.7, reviews:62, available:true, payment:['cash','bit'],         lat:31.672, lng:34.565, bio:'מנקה אשקלון.', reviewsList:RL },
  { id:'90', name:'אמנון ביטון', initials:'אב', city:'אשקלון',       region:'south',  workAreas:['south'],  types:['לאחר שיפוץ','חלונות'],      price:68,  rating:4.5, reviews:31,  available:true,  payment:['cash'],               lat:31.664, lng:34.575, bio:'מנקה אשקלון.', reviewsList:RL },
  // ── אילת נוספים ──
  { id:'91', name:'חן מזרחי',    initials:'חמ', city:'אילת',         region:'south',  workAreas:['south'],  types:['ניקיון אחרי אירוע','חלונות'],price:95,  rating:4.9, reviews:53,  available:true,  payment:['card','bit','cash'],  lat:29.560, lng:34.946, bio:'מנקה אילת.', reviewsList:RL },
  { id:'92', name:'עינב לוי',    initials:'על', city:'אילת',         region:'south',  workAreas:['south'],  types:['ניקוי לפסח','מחסן ועליית גג'],price:80, rating:4.7, reviews:37, available:false, payment:['cash'],              lat:29.555, lng:34.955, bio:'מנקה אילת.', reviewsList:RL },
  // ── נצרת / טבריה נוספים ──
  { id:'93', name:'אימן ח\'טיב', initials:'אח', city:'נצרת',         region:'north',  workAreas:['north'],  types:['ניקוי לפסח','ניקיון אחרי אירוע'],price:68, rating:4.7, reviews:54, available:true, payment:['cash','bit'],         lat:32.701, lng:35.297, bio:'מנקה נצרת.', reviewsList:RL },
  { id:'94', name:'שולה אבו',    initials:'שא', city:'טבריה',        region:'north',  workAreas:['north'],  types:['חלונות','שטיפת רכב'],       price:62,  rating:4.6, reviews:39,  available:true,  payment:['cash'],               lat:32.789, lng:35.524, bio:'מנקה טבריה.', reviewsList:RL },
  { id:'95', name:'קייס נסר',    initials:'קנ', city:'טבריה',        region:'north',  workAreas:['north'],  types:['לאחר שיפוץ','ניקוי לפסח'], price:72,  rating:4.7, reviews:46,  available:false, payment:['cash','bit'],         lat:32.793, lng:35.528, bio:'מנקה טבריה.', reviewsList:RL },
  // ── נוספים מרכז ──
  { id:'96', name:'איילת גל',    initials:'אג', city:'ראש העין',     region:'center', workAreas:['center'], types:['ניקוי לפסח','ניקיון משרדים'],price:80,  rating:4.7, reviews:57,  available:true,  payment:['cash','bit'],         lat:32.095, lng:34.957, bio:'מנקה ראש העין.', reviewsList:RL },
  { id:'97', name:'עמית פורת',   initials:'עפ', city:'יהוד',         region:'center', workAreas:['center'], types:['ניקיון אחרי אירוע','חלונות'],price:85,  rating:4.8, reviews:63,  available:true,  payment:['card','cash'],        lat:32.032, lng:34.888, bio:'מנקה יהוד ואזוריה.', reviewsList:RL },
  { id:'98', name:'נעה שפירא',   initials:'נש', city:'מזכרת בתיה',   region:'center', workAreas:['center'], types:['ניקוי לפסח','לאחר שיפוץ'], price:74,  rating:4.6, reviews:33,  available:true,  payment:['cash'],               lat:31.856, lng:34.847, bio:'מנקה מזכרת בתיה.', reviewsList:RL },
  { id:'99', name:'איתי כהן',    initials:'אכ', city:'גדרה',         region:'center', workAreas:['center','south'], types:['שטיפת רכב','ניקיון אחרי אירוע'],price:76, rating:4.7, reviews:48, available:true, payment:['cash','bit'],         lat:31.812, lng:34.778, bio:'מנקה גדרה ואזוריה.', reviewsList:RL },
];

const TYPE_ICONS: Record<string, string> = {
  'ניקוי לפסח': '🧹', 'חלונות': '🪟', 'לאחר שיפוץ': '🔨',
  'שטיפת רכב': '🚗', 'ניקיון משרדים': '🏢',
  'ניקיון אחרי אירוע': '🎉', 'מחסן ועליית גג': '📦',
};

function getBadges(cleaner: any): string[] {
  const b: string[] = [];
  if (cleaner.identityVerified)                                      b.push('idVerified');
  if (cleaner.rating >= 4.8 && (cleaner.reviews || 0) >= 20)        b.push('superCleaner');
  if ((cleaner.reviews || 0) >= 50)                                  b.push('topRated');
  if (cleaner.phone && cleaner.bio && (cleaner.types?.length || 0) >= 3) b.push('verified');
  if ((cleaner.reviews || 0) < 5)                                    b.push('newCleaner');
  return b;
}

function badgeLabel(b: string, t: any): string {
  if (b === 'idVerified')    return t.badgeIdVerified;
  if (b === 'superCleaner')  return t.badgeSuperCleaner;
  if (b === 'topRated')      return t.badgeTopRated;
  if (b === 'verified')      return t.badgeVerified;
  return t.badgeNewCleaner;
}

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  idVerified:   { bg: '#DCFCE7', color: '#15803D' },
  superCleaner: { bg: '#FEF3C7', color: '#D97706' },
  topRated:     { bg: '#EDE9FE', color: '#7C3AED' },
  verified:     { bg: '#D1FAE5', color: '#059669' },
  newCleaner:   { bg: '#E0F2FE', color: '#0284C7' },
};
const PAY_ICONS: Record<string, string> = { card: '💳', bit: '📱', cash: '💵' };

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'he', label: 'עברית',    flag: '🇮🇱' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'ru', label: 'Русский',  flag: '🇷🇺' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'hi', label: 'हिन्दी',  flag: '🇮🇳' },
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
  'קריית שמונה':    { lat: 33.207, lng: 35.570 }, 'מגדל העמק':      { lat: 32.677, lng: 35.238 },
  'שדרות':          { lat: 31.524, lng: 34.596 }, 'נתיבות':         { lat: 31.421, lng: 34.594 },
  'דימונה':         { lat: 31.069, lng: 35.033 }, 'ערד':            { lat: 31.258, lng: 35.214 },
  'מצפה רמון':     { lat: 30.612, lng: 34.803 }, 'אופקים':         { lat: 31.312, lng: 34.620 },
};
const REGION_CENTER: Record<string, { lat: number; lng: number }> = {
  north:  { lat: 32.8,  lng: 35.2  },
  center: { lat: 32.0,  lng: 34.85 },
  south:  { lat: 31.0,  lng: 34.8  },
};

function getCoordsForCleaner(d: any): { lat: number; lng: number } {
  if (d.city && CITY_COORDS[d.city]) return CITY_COORDS[d.city];
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
        name:         `🧹 CleanTouch — ${cleanerName}`,
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

async function sendPushNotification(token: string, title: string, body: string, data?: Record<string, any>) {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token, title, body,
        sound: 'default',
        channelId: 'messages',
        priority: 'high',
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

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <Text key={i} style={{ color: i <= Math.round(rating) ? C.gold : C.grayBorder, fontSize: size }}>★</Text>
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
  }, []);
  return null;
}

// ─── Drawer ──────────────────────────────────────────────────────────────────
function DrawerMenu({ visible, onClose, onProfile, onLogout, onMessages, onReport, onSupport }: any) {
  const { t, lang, setLang } = useLanguage();
  const [showLangs, setShowLangs] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, useNativeDriver: true, duration: 200 }).start();
      setShowLangs(false);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <ModalBackHandler onBack={onClose} />
      <TouchableOpacity style={ds.backdrop} onPress={onClose} activeOpacity={1} />
      <Animated.View style={[ds.panel, { transform: [{ translateX: slideAnim }] }]}>
        {/* header */}
        <View style={ds.panelHeader}>
          <Image
            source={require('../assets/images/icon.png')}
            style={{ width: 200, height: 160, marginBottom: 4 }}
            contentFit="contain"
          />
        </View>

        <ScrollView style={{ flex: 1 }}>
          {/* profile */}
          <TouchableOpacity style={ds.item} onPress={() => { onClose(); onProfile(); }}>
            <Text style={ds.itemIcon}>👤</Text>
            <Text style={ds.itemText}>{t.drawerProfile}</Text>
            <Text style={ds.itemArrow}>›</Text>
          </TouchableOpacity>

          {/* language */}
          <TouchableOpacity style={ds.item} onPress={() => setShowLangs(v => !v)}>
            <Text style={ds.itemIcon}>🌐</Text>
            <Text style={[ds.itemText, { flex: 1 }]}>{t.drawerLanguage}</Text>
            <Text style={ds.itemArrow}>{showLangs ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showLangs && (
            <View style={ds.langList}>
              {LANGS.map(l => (
                <TouchableOpacity
                  key={l.code}
                  style={[ds.langItem, lang === l.code && ds.langItemActive]}
                  onPress={() => { setLang(l.code); setShowLangs(false); }}
                >
                  <Text style={ds.langFlag}>{l.flag}</Text>
                  <Text style={[ds.langLabel, lang === l.code && { color: C.blue, fontWeight: '700' }]}>{l.label}</Text>
                  {lang === l.code && <Text style={{ color: C.blue, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* messages */}
          <TouchableOpacity style={ds.item} onPress={() => { onClose(); onMessages(); }}>
            <Text style={ds.itemIcon}>💬</Text>
            <Text style={[ds.itemText, { flex: 1 }]}>{t.drawerMessages}</Text>
            <Text style={ds.itemArrow}>›</Text>
          </TouchableOpacity>

          {/* support chatbot */}
          <TouchableOpacity style={ds.item} onPress={() => { onClose(); onSupport(); }}>
            <Text style={ds.itemIcon}>👨‍💼</Text>
            <Text style={[ds.itemText, { flex: 1 }]}>תמיכה</Text>
            <Text style={ds.itemArrow}>›</Text>
          </TouchableOpacity>

          {/* report */}
          <TouchableOpacity style={ds.item} onPress={onReport}>
            <Text style={ds.itemIcon}>🚨</Text>
            <Text style={[ds.itemText, { flex: 1, color: '#EF4444' }]}>{t.reportBtn}</Text>
            <Text style={ds.itemArrow}>›</Text>
          </TouchableOpacity>

          {/* logout */}
          <TouchableOpacity style={[ds.item, { marginTop: 12 }]} onPress={() => { onClose(); onLogout(); }}>
            <Text style={ds.itemIcon}>🚪</Text>
            <Text style={[ds.itemText, { color: '#EF4444' }]}>{t.drawerLogout}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Reviews modal ────────────────────────────────────────────────────────────
function ReviewsModal({ cleaner, visible, onClose }: any) {
  const { t } = useLanguage();
  if (!cleaner) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}><Text style={{ color: C.white, fontSize: 18 }}>✕</Text></TouchableOpacity>
          <Text style={s.modalTitle}>{t.reviewsSuffix} — {cleaner.name}</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View style={s.ratingBigCard}>
            <Text style={s.ratingBigNum}>{cleaner.rating}</Text>
            <Stars rating={cleaner.rating} size={24} />
            <Text style={s.ratingBigCount}>{cleaner.reviews} {t.reviewsSuffix}</Text>
          </View>
          {cleaner.reviewsList.map((r: any, i: number) => (
            <View key={i} style={s.reviewCard}>
              <View style={s.reviewTop}>
                <View style={s.reviewAvatar}><Text style={s.reviewAvatarText}>{r.name.charAt(0)}</Text></View>
                <View style={{ flex: 1 }}><Text style={s.reviewName}>{r.name}</Text><Stars rating={r.stars} size={12} /></View>
              </View>
              <Text style={s.reviewText}>{r.text}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Cleaner profile modal ───────────────────────────────────────────────────
function CleanerProfile({ cleaner, visible, onClose, onBook, onChat }: any) {
  const { t } = useLanguage();
  const [showReviews, setShowReviews] = useState(false);
  if (!cleaner) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
        <View style={s.profileHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}><Text style={{ color: C.white, fontSize: 18 }}>←</Text></TouchableOpacity>
          <Text style={s.profileHeaderTitle}>{t.cleanerProfileTitle}</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={s.profileHero}>
            <View style={s.profileAvatar}>
              {(() => {
                const uri = cleaner.photoB64 || cleaner.photo ||
                  (!isNaN(parseInt(cleaner.id)) ? `https://i.pravatar.cc/150?img=${((parseInt(cleaner.id) - 1) % 70) + 1}` : null);
                return uri
                  ? <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 45 }} contentFit="cover" />
                  : <Text style={s.profileAvatarText}>{cleaner.initials}</Text>;
              })()}
            </View>
            <Text style={s.profileName}>{cleaner.name}</Text>
            <Text style={s.profileCity}>📍 {t.cities[cleaner.city] || cleaner.city}</Text>
            <View style={[s.availBadge, !cleaner.available && s.availBadgeOff]}>
              <Text style={[s.availBadgeText, !cleaner.available && { color: C.textSub }]}>
                {cleaner.available ? t.availNow : t.notAvailNow}
              </Text>
            </View>
            {(() => {
              const badges = getBadges(cleaner);
              return badges.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                  {badges.map(b => (
                    <View key={b} style={[s.badgePill, { backgroundColor: BADGE_COLORS[b]?.bg || '#F0F0F0' }]}>
                      <Text style={[s.badgePillText, { color: BADGE_COLORS[b]?.color || '#666' }]}>
                        {badgeLabel(b, t)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null;
            })()}
            <View style={s.statsRow}>
              <View style={s.statBox}><Text style={s.statVal}>{cleaner.rating}</Text><Text style={s.statLabel}>{t.ratingLabel}</Text></View>
              <View style={s.statDivider} />
              <View style={s.statBox}><Text style={s.statVal}>{cleaner.reviews}</Text><Text style={s.statLabel}>{t.reviewsSuffix}</Text></View>
              <View style={s.statDivider} />
              <View style={s.statBox}><Text style={s.statVal}>₪{cleaner.price}</Text><Text style={s.statLabel}>{t.perHour}</Text></View>
            </View>
          </View>
          <View style={s.profileSection}>
            <Text style={s.profileSectionTitle}>{t.aboutLabel}</Text>
            <Text style={s.profileBio} numberOfLines={4} ellipsizeMode="tail">
              {cleaner.bio
                ? cleaner.bio.split(/\s+/).slice(0, 30).join(' ') +
                  (cleaner.bio.split(/\s+/).length > 30 ? '...' : '')
                : ''}
            </Text>
          </View>

          {/* Supplies badge */}
          {cleaner.bringSupplies !== null && cleaner.bringSupplies !== undefined && (
            <View style={s.profileSection}>
              <Text style={s.profileSectionTitle}>{t.suppliesDisplay}</Text>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ backgroundColor: cleaner.bringSupplies ? '#D1FAE5' : '#FEF3C7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: cleaner.bringSupplies ? '#6EE7B7' : '#FCD34D' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: cleaner.bringSupplies ? '#065F46' : '#92400E' }}>
                    {cleaner.bringSupplies ? t.suppliesCleaner : t.suppliesClient}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Phone */}
          {(cleaner.phone || cleaner.isReal) && (
            <View style={s.profileSection}>
              <Text style={s.profileSectionTitle}>{t.phoneLabel}</Text>
              {cleaner.phone && cleaner.showPhone !== false ? (
                <View style={s.phonePill}>
                  <Text style={s.phonePillText}>📞 {cleaner.phone}</Text>
                </View>
              ) : (
                <View style={[s.phonePill, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
                  <Text style={[s.phonePillText, { color: '#94A3B8' }]}>{t.phoneHiddenLabel}</Text>
                </View>
              )}
            </View>
          )}

          <View style={s.profileSection}>
            <Text style={s.profileSectionTitle}>{t.servicesLabel}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cleaner.types.map((tp: string) => <View key={tp} style={s.servicePill}><Text style={s.servicePillText}>{TYPE_ICONS[tp]} {t.types[tp] || tp}</Text></View>)}
            </View>
          </View>
          <View style={s.profileSection}>
            <Text style={s.profileSectionTitle}>{t.workAreasTitle}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cleaner.workAreas && cleaner.workAreas.length > 0
                ? cleaner.workAreas.map((area: string) => (
                    <View key={area} style={s.areaPill}>
                      <Text style={s.areaPillText}>
                        {area === 'north' ? t.regionNorth : area === 'center' ? t.regionCenter : t.regionSouth}
                      </Text>
                    </View>
                  ))
                : <Text style={{ fontSize: 12, color: C.textSub }}>{t.workAreasNone}</Text>
              }
            </View>
          </View>
          <View style={s.profileSection}>
            <Text style={s.profileSectionTitle}>{t.paymentLabel}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cleaner.payment.map((p: string) => <View key={p} style={s.payPill}><Text style={s.payPillText}>{PAY_ICONS[p]} {p === 'card' ? t.payCard : p === 'bit' ? t.payBit : t.payCash}</Text></View>)}
            </View>
          </View>
          <View style={s.profileSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.profileSectionTitle}>{t.reviewsSuffix} ({cleaner.reviews})</Text>
              <TouchableOpacity onPress={() => setShowReviews(true)}><Text style={s.seeAllBtn}>{t.seeAllBtn}</Text></TouchableOpacity>
            </View>
            <Stars rating={cleaner.rating} size={20} />
            {cleaner.reviewsList.slice(0, 2).map((r: any, i: number) => (
              <View key={i} style={[s.reviewCard, { marginTop: 10 }]}>
                <View style={s.reviewTop}>
                  <View style={s.reviewAvatar}><Text style={s.reviewAvatarText}>{r.name.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}><Text style={s.reviewName}>{r.name}</Text><Stars rating={r.stars} size={12} /></View>
                </View>
                <Text style={s.reviewText}>{r.text}</Text>
              </View>
            ))}
            {cleaner.reviewsList.length > 2 && (
              <TouchableOpacity style={s.allReviewsBtn} onPress={() => setShowReviews(true)}>
                <Text style={s.allReviewsBtnText}>{t.allReviewsPrefix} ({cleaner.reviews}) ›</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Portfolio gallery */}
          {cleaner.portfolio?.length > 0 && (
            <View style={s.profileSection}>
              <Text style={s.profileSectionTitle}>📸 {t.portfolioTitle}</Text>
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
        <View style={s.profileFooter}>
          <TouchableOpacity style={s.footerChat} onPress={() => { onClose(); onChat(cleaner); }}>
            <Text style={s.footerChatText}>{t.chatBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.footerBook, !cleaner.available && { backgroundColor: C.blueBorder }]}
            disabled={!cleaner.available}
            onPress={() => { onClose(); onBook(cleaner); }}>
            <Text style={s.footerBookText}>{cleaner.available ? t.bookNowBtn : t.notAvailBtn}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ReviewsModal cleaner={cleaner} visible={showReviews} onClose={() => setShowReviews(false)} />
    </Modal>
  );
}

// ─── Animated Star Picker ─────────────────────────────────────────────────────
function AnimatedStarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
  return <Text style={{ fontSize: 22 }}>{flip ? '⌛' : '⏳'}</Text>;
}

// ─── Address Autocomplete (OpenStreetMap Nominatim — חינמי, ללא מפתח) ─────────
function AddressAutocomplete({ value, onChange, placeholder, onFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onFocus?: () => void;
}) {
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
          headers: { 'User-Agent': 'CleanTouchApp/1.0' },
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
        style={[s.input, { textAlign: 'right' }]}
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
              <Text style={acStyles.main}>{item.main}</Text>
              {!!item.secondary && <Text style={acStyles.secondary} numberOfLines={1}>{item.secondary}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
const acStyles = StyleSheet.create({
  dropdown:  { position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.blueBorder, elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, zIndex: 9999 },
  row:       { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  main:      { fontSize: 14, fontWeight: '700', color: C.textDark, textAlign: 'right' },
  secondary: { fontSize: 12, color: C.textSub, textAlign: 'right', marginTop: 2 },
});

// ─── Booking modal ───────────────────────────────────────────────────────────
// ─── Calendar Picker ─────────────────────────────────────────────────────────
const DAYS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function CalendarPicker({ visible, value, onChange, onClose }: {
  visible: boolean; value: Date; onChange: (d: Date) => void; onClose: () => void;
}) {
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
                <Text style={{ fontSize:20, color:'#2563EB', fontWeight:'900' }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontSize:17, fontWeight:'900', color:'#1E3A5F' }}>
                {MONTHS_HE[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={{ padding:8 }}>
                <Text style={{ fontSize:20, color:'#2563EB', fontWeight:'900' }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day names */}
            <View style={{ flexDirection:'row', marginBottom:6 }}>
              {DAYS_HE.map(d => (
                <View key={d} style={{ flex:1, alignItems:'center' }}>
                  <Text style={{ fontSize:12, fontWeight:'700', color:'#94A3B8' }}>{d}</Text>
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
                      <Text style={{ fontSize:14, fontWeight: isSelected || isToday ? '900' : '400',
                        color: isPast ? '#CBD5E1' : isSelected ? '#fff' : isToday ? '#2563EB' : '#1E3A5F' }}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Close */}
            <TouchableOpacity onPress={onClose}
              style={{ marginTop:14, backgroundColor:'#F1F5F9', borderRadius:12, padding:12, alignItems:'center' }}>
              <Text style={{ color:'#64748B', fontWeight:'700' }}>סגור</Text>
            </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
        <Text style={{ fontSize: 22, fontWeight: '900', color: idx === 0 ? '#CBD5E1' : '#7C3AED' }}>−</Text>
      </TouchableOpacity>
      <View style={{ paddingHorizontal: 28, paddingVertical: 14, backgroundColor: '#fff', minWidth: 90, alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: '#2563EB' }}>{label}</Text>
      </View>
      <TouchableOpacity onPress={inc} disabled={idx === values.length - 1}
        style={{ paddingHorizontal: 20, paddingVertical: 14, backgroundColor: idx === values.length - 1 ? '#E2E8F0' : '#EDE9FE' }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: idx === values.length - 1 ? '#CBD5E1' : '#7C3AED' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function TimeWheelPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const timeValues: number[] = Array.from({ length: 34 }, (_, i) => 7 + i * 0.5);
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

// ─────────────────────────────────────────────────────────────────────────────
function BookingModal({ cleaner, visible, onClose, onBookingCreated }: any) {
  const { t }  = useLanguage();
  const router = useRouter();
  const bookingScrollRef = useRef<ScrollView>(null);
  const [hours,         setHours]         = useState(2);
  const [payment,       setPayment]       = useState('cash');
  const [address,       setAddress]       = useState('');
  const [saving,        setSaving]        = useState(false);
  const [bookingDate,   setBookingDate]   = useState<Date>(new Date());
  const [showDatePicker,setShowDatePicker]= useState(false);
  const [startHour,     setStartHour]     = useState(9);
  const [recurring,     setRecurring]     = useState<'once' | 'weekly' | 'monthly'>('once');
  const [serviceType,   setServiceType]   = useState<string>('');
  const [showSuccess,   setShowSuccess]   = useState(false);
  const [bookedDetails, setBookedDetails] = useState<{ name: string; hours: number; total: number } | null>(null);

  // Dynamic pricing: if cleaner has servicePricing, use it; else use cleaner.price
  const effectivePrice = cleaner
    ? (serviceType && cleaner.servicePricing?.[serviceType]
        ? cleaner.servicePricing[serviceType]
        : cleaner.price)
    : 0;
  const total   = effectivePrice * hours;
  const fmtDate = (d: Date) => d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleBook = async () => {
    if (!address.trim() || address.trim().length < 5) return Alert.alert(t.error, t.addressTooShort);
    if (!/\d/.test(address)) return Alert.alert(t.error, t.addressNoNumber);
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
        status: 'pending', createdAt: new Date().toISOString(),
        bookingDate: bookingDate.toISOString().split('T')[0],
        startTime: `${startHH}:${startMM}`,
        recurring,
        serviceType: serviceType || '',
        pricePerHour: effectivePrice,
        busyFrom: busyFromISO,
        busyUntil: busyUntilISO,
      });
      // הוסף ל-busySlots של המנקה
      await setDoc(doc(db, 'users', cleaner.id), {
        busySlots: arrayUnion({ from: busyFromISO, until: busyUntilISO }),
      }, { merge: true }).catch(() => {});
      try {
        const cleanerUid = cleaner.uid || cleaner.id;
        const cleanerDoc = await getDoc(doc(db, 'users', cleanerUid));
        const pushToken = cleanerDoc.data()?.pushToken;
        if (pushToken) await sendPushNotification(
          pushToken,
          '📅 הזמנה חדשה!',
          `${clientName} הזמין/ה אותך ל-${hours} שעות ב-${bookingDate.toLocaleDateString('he-IL')}`,
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
            createdAt: new Date().toISOString(),
            bookingId: bookingRef.id,
          });
          await setDoc(doc(db, 'chats', bitChatId), {
            participants: [clientUid, cleaner.uid || cleaner.id],
            lastMessage: `💙 בקשת תשלום ₪${total} בביט`,
            lastMessageAt: new Date().toISOString(),
          }, { merge: true });
        } catch (_) {}
      }
      // ── Schedule day-before local reminder ──────────────────────────────
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
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
                body:  `מחר ב-${String(startHour).padStart(2,'0')}:00 · ${address}`,
                sound: true,
              },
              trigger: { date: reminderDate } as any,
            });
          }
        }
      } catch (_) {}
    } catch (_) {}
    setSaving(false);
    onBookingCreated?.(cleaner.id);
    setBookedDetails({ name: cleaner.name, hours, total });
    setShowSuccess(true);
  };

  const handleClose = () => {
    setAddress(''); setHours(2);
    setBookingDate(new Date()); setStartHour(9); setRecurring('once');
    setServiceType(''); setShowSuccess(false); setBookedDetails(null);
    onClose();
  };
  if (!cleaner) return null;

  // ── מסך הצלחה ──
  if (showSuccess && bookedDetails) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F0FDF4' }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 20 }}>
            {/* אנימציית צ'קמארק */}
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#10B981' }}>
              <Text style={{ fontSize: 52 }}>✅</Text>
            </View>

            <Text style={{ fontSize: 26, fontWeight: '900', color: '#065F46', textAlign: 'center' }}>
              {t.confirmedTitle}
            </Text>

            {/* כרטיס פרטים */}
            <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', gap: 12, borderWidth: 1, borderColor: '#A7F3D0', elevation: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, color: '#6B7280' }}>מנקה</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#065F46' }}>🧹 {bookedDetails.name}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: '#D1FAE5' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, color: '#6B7280' }}>שעות</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#065F46' }}>⏱️ {bookedDetails.hours} {t.hoursUnit}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: '#D1FAE5' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, color: '#6B7280' }}>סה"כ לתשלום</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#059669' }}>₪{bookedDetails.total}</Text>
              </View>
            </View>

            {/* מה הלאה */}
            <View style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: 18, width: '100%', gap: 10, borderWidth: 1, borderColor: '#BFDBFE' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#1D4ED8', marginBottom: 4 }}>📋 {t.whatsNextTitle}</Text>
              <Text style={{ fontSize: 14, color: '#1E40AF', lineHeight: 22 }}>1️⃣  {t.nextStep1}</Text>
              <Text style={{ fontSize: 14, color: '#1E40AF', lineHeight: 22 }}>2️⃣  {t.nextStep2}</Text>
              <Text style={{ fontSize: 14, color: '#1E40AF', lineHeight: 22 }}>3️⃣  {t.nextStep3}</Text>
            </View>

            {/* כפתור ההזמנות שלי */}
            <TouchableOpacity
              style={{ backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 32, width: '100%', alignItems: 'center' }}
              onPress={() => { handleClose(); router.push('/profile'); }}
            >
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>{t.viewMyBookings}</Text>
            </TouchableOpacity>

            {/* כפתור סגירה */}
            <TouchableOpacity
              style={{ backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB' }}
              onPress={handleClose}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#6B7280' }}>{t.closeBtn}</Text>
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
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}><Text style={{ color: C.white, fontSize: 18 }}>✕</Text></TouchableOpacity>
          <Text style={s.modalTitle}>{t.newBookingTitle}</Text>
          <View style={{ width: 36 }} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}>
        <ScrollView ref={bookingScrollRef} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Cleaner info */}
            <View style={s.bookingCard}>
              <View style={s.bookingAvatar}>
                {(() => {
                  const uri = cleaner.photoB64 || cleaner.photo ||
                    (!isNaN(parseInt(cleaner.id)) ? `https://i.pravatar.cc/150?img=${((parseInt(cleaner.id) - 1) % 70) + 1}` : null);
                  return uri
                    ? <Image source={{ uri }} style={{ width: 48, height: 48, borderRadius: 24 }} contentFit="cover" />
                    : <Text style={s.bookingAvatarText}>{cleaner.initials}</Text>;
                })()}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.bookingName}>{cleaner.name}</Text>
                <Text style={s.bookingCity}>📍 {t.cities[cleaner.city] || cleaner.city} · ₪{cleaner.price}{t.perHour}</Text>
              </View>
            </View>

            {/* Date */}
            <Text style={s.fieldLabel}>📅 {t.dateLabel}</Text>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={s.dateBtnText}>{fmtDate(bookingDate)}</Text>
              <Text style={{ fontSize: 12, color: C.textSub }}>📅 {t.selectDate}</Text>
            </TouchableOpacity>
            <CalendarPicker
              visible={showDatePicker}
              value={bookingDate}
              onChange={setBookingDate}
              onClose={() => setShowDatePicker(false)}
            />

            {/* Time */}
            <Text style={s.fieldLabel}>🕐 {t.timeLabel}</Text>
            <TimeWheelPicker value={startHour} onChange={setStartHour} />

            {/* Recurring */}
            <Text style={s.fieldLabel}>🔁 {t.recurringLabel}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['once', 'weekly', 'monthly'] as const).map(opt => (
                <TouchableOpacity key={opt} style={[s.recurBtn, recurring === opt && s.recurBtnActive]} onPress={() => setRecurring(opt)}>
                  <Text style={[s.recurBtnText, recurring === opt && { color: C.white }]}>
                    {opt === 'once' ? t.recurOnce : opt === 'weekly' ? t.recurWeekly : t.recurMonthly}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Service Type (if cleaner has servicePricing) */}
            {cleaner?.types?.length > 0 && (
              <>
                <Text style={s.fieldLabel}>{t.selectServiceType}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {cleaner.types.map((tp: string) => (
                      <TouchableOpacity
                        key={tp}
                        style={[s.recurBtn, serviceType === tp && s.recurBtnActive, { paddingHorizontal: 12 }]}
                        onPress={() => setServiceType(tp)}
                      >
                        <Text style={[s.recurBtnText, serviceType === tp && { color: C.white }]}>
                          {TYPE_ICONS[tp]} {t.types[tp] || tp}
                          {cleaner.servicePricing?.[tp] ? ` ₪${cleaner.servicePricing[tp]}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {serviceType && (
                  <Text style={{ fontSize: 11, color: C.textSub }}>{t.priceRangeLabel}: ₪{effectivePrice}{t.perHour}</Text>
                )}
              </>
            )}

            {/* Hours */}
            <Text style={s.fieldLabel}>{t.hoursLabel}</Text>
            <HoursWheelPicker value={hours} onChange={setHours} values={[1,2,3,4,5,6,7,8,9,10,11,12]} />

            {/* Address */}
            <Text style={s.fieldLabel}>{t.addressLabel}</Text>
            <AddressAutocomplete value={address} onChange={setAddress} placeholder={t.addressPlaceholder}
              onFocus={() => setTimeout(() => bookingScrollRef.current?.scrollToEnd({ animated: true }), 300)}
            />

            {/* Payment */}
            <Text style={s.fieldLabel}>{t.paymentMethodLabel}</Text>
            <View style={s.payRow}>
              {cleaner.payment.map((p: string) => (
                <TouchableOpacity key={p} style={[s.payBtn, payment === p && s.payBtnActive]} onPress={() => setPayment(p)}>
                  <Text style={s.payIcon}>{PAY_ICONS[p]}</Text>
                  <Text style={[s.payLabel, payment === p && { color: C.blue }]}>{p === 'card' ? t.payCard : p === 'bit' ? t.payBit : t.payCash}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Summary */}
            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>{t.totalLabel}</Text>
              <Text style={s.summaryTotal}>₪{total}</Text>
            </View>

            <TouchableOpacity style={[s.confirmBtn, saving && { opacity: 0.7 }]} onPress={handleBook} disabled={saving}>
              <Text style={s.confirmBtnText}>{saving ? t.savingText : `✅ ${t.confirmBtnText} · ₪${total}`}</Text>
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
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const clientUid = auth.currentUser?.uid || '';
  const prevMsgCount = useRef(0);

  const chatId = cleaner
    ? [clientUid, cleaner.uid || cleaner.id].sort().join('_')
    : '';

  useEffect(() => {
    if (!cleaner || !chatId) return;
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
    return unsub;
  }, [chatId, cleaner]);

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
      // Auto-reply — independent of metadata, always fires
      const autoReplyText = 'תודה ששלחת הודעה, אחזור אלייך בהקדם האפשרי 🙏';
      setTimeout(async () => {
        try {
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            text: autoReplyText, from: 'cleaner', fromUid: otherUid,
            createdAt: new Date().toISOString(), isAutoReply: true,
          });
        } catch (_) {}
      }, 1500);
      // כתיבת metadata + unreadBy למנקה
      try {
        await setDoc(doc(db, 'chats', chatId), {
          participants: [clientUid, otherUid].sort(),
          lastMessage: msg,
          lastMessageAt: new Date().toISOString(),
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
        if (pushToken) sendPushNotification(pushToken, `💬 הודעה מ-${clientName}`, msg);
      } catch (_) {}
    } catch (_) {}
  };

  if (!cleaner) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaViewCtx style={{ flex: 1, backgroundColor: C.bluePale }}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}><Text style={{ color: C.white, fontSize: 18 }}>✕</Text></TouchableOpacity>
          <Text style={s.modalTitle}>{t.chatWithPrefix}{cleaner.name}</Text>
          <View style={{ width: 36 }} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 8 }}>
            {messages.length === 0 && (
              <View style={{ alignItems: 'flex-start' }}>
                <View style={[s.bubble, s.bubbleCleaner]}>
                  <Text style={{ color: C.white, fontSize: 14 }}>{t.greetingPrefix}{cleaner.name}{t.greetingSuffix}</Text>
                </View>
              </View>
            )}
            {messages.map(m => {
              if (m.type === 'bit_payment') {
                return (
                  <View key={m.id} style={{ alignItems: 'flex-start' }}>
                    <View style={s.bitCard}>
                      <Text style={s.bitCardTitle}>💙 בקשת תשלום</Text>
                      <Text style={s.bitCardAmount}>₪{m.amount}</Text>
                      <TouchableOpacity
                        style={s.bitBtn}
                        onPress={() => Linking.openURL(m.bitLink).catch(() =>
                          Alert.alert('ביט', 'אפליקציית ביט לא מותקנת במכשיר')
                        )}
                      >
                        <Text style={s.bitBtnText}>שלם בביט 💙</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }
              return (
                <View key={m.id} style={{ alignItems: m.fromUid === clientUid ? 'flex-end' : 'flex-start' }}>
                  <View style={[s.bubble, m.fromUid === clientUid ? s.bubbleClient : s.bubbleCleaner]}>
                    <Text style={{ color: m.fromUid === clientUid ? C.textDark : C.white, fontSize: 14 }}>{m.text}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={s.chatRow}>
            <TouchableOpacity style={s.sendBtn} onPress={send}><Text style={{ color: C.white, fontSize: 18 }}>◀</Text></TouchableOpacity>
            <TextInput style={s.chatInput} placeholder={t.chatPlaceholder} value={text} onChangeText={setText} placeholderTextColor={C.textSub} textAlign="right" onSubmitEditing={send} />
          </View>
          <View style={{ height: NAV_BAR_HEIGHT, backgroundColor: C.white }} />
        </KeyboardAvoidingView>
      </SafeAreaViewCtx>
    </Modal>
  );
}

// ─── Cleaner card ─────────────────────────────────────────────────────────────
function CleanerCard({ cleaner, selected, onSelect, onProfile, onBook, onChat, isPending }: any) {
  const { t } = useLanguage();
  const { dark } = useTheme();
  const isSel = selected === cleaner.id;
  return (
    <TouchableOpacity style={[s.card, isSel && s.cardSel, dark && { backgroundColor: '#1E293B', borderColor: '#334155' }]} onPress={() => onSelect(isSel ? null : cleaner.id)} onLongPress={() => onProfile(cleaner)} activeOpacity={0.85}>
      <View style={s.cardTop}>
        <TouchableOpacity onPress={() => onProfile(cleaner)}>
          <View style={[s.avatar, !cleaner.available && { opacity: 0.75 }]}>
            {(() => {
              const uri = cleaner.photoB64 || cleaner.photo ||
                (!isNaN(parseInt(cleaner.id))
                  ? `https://i.pravatar.cc/150?img=${((parseInt(cleaner.id) - 1) % 70) + 1}`
                  : null);
              return uri
                ? <Image source={{ uri }} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit="cover" />
                : <Text style={s.avatarText}>{cleaner.initials}</Text>;
            })()}
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <TouchableOpacity onPress={() => onProfile(cleaner)}><Text style={[s.cardName, dark && { color: '#93C5FD' }]}>{cleaner.name} ›</Text></TouchableOpacity>
            <View style={[s.priceTag, dark && { backgroundColor: '#1E3A5F' }]}><Text style={[s.priceText, dark && { color: '#93C5FD' }]}>₪{cleaner.price}</Text><Text style={s.priceSub}>{t.perHour}</Text></View>
          </View>
          <Text style={[s.cardCity, dark && { color: '#94A3B8' }]}>📍 {t.cities[cleaner.city] || cleaner.city}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <Stars rating={cleaner.rating} size={11} />
            <Text style={[s.ratingVal, dark && { color: '#F1F5F9' }]}>{cleaner.rating}</Text>
            <TouchableOpacity onPress={() => onProfile(cleaner)}><Text style={s.reviewsLink}>({cleaner.reviews} {t.reviewsSuffix})</Text></TouchableOpacity>
            <View style={[s.availPill, !cleaner.available && s.availPillOff]}>
              <Text style={[s.availPillText, !cleaner.available && { color: C.textSub }]}>{cleaner.available ? t.availPill : t.notAvailPill}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
            {cleaner.types.map((tp: string) => <View key={tp} style={s.typePill}><Text style={s.typePillText}>{TYPE_ICONS[tp]} {t.types[tp] || tp}</Text></View>)}
          </View>
          {(() => {
            const badges = getBadges(cleaner);
            return (
              <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {/* Free commission badge — always shown */}
                <View style={s.freeCommissionBadge}>
                  <Text style={s.freeCommissionBadgeText}>{t.freeCommissionBadge}</Text>
                </View>
                {badges.map(b => (
                  <View key={b} style={[s.badgePill, { backgroundColor: BADGE_COLORS[b]?.bg || '#F0F0F0' }]}>
                    <Text style={[s.badgePillText, { color: BADGE_COLORS[b]?.color || '#666' }]}>
                      {badgeLabel(b, t)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>
      </View>
      {isSel && (
        <View style={s.cardExpanded}>
          <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {cleaner.payment.map((p: string) => <View key={p} style={s.payChip}><Text style={s.payChipText}>{PAY_ICONS[p]} {p === 'card' ? t.payCard : p === 'bit' ? t.payBit : t.payCash}</Text></View>)}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.actionBtn} onPress={() => onProfile(cleaner)}>
              <Text style={s.actionBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t.profileBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => onChat(cleaner)}>
              <Text style={{ fontSize: 26 }}>{t.chatBtnShort}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnPrimary, (isPending || !cleaner.available) && { backgroundColor: '#94A3B8' }]}
              disabled={isPending || !cleaner.available}
              onPress={() => !isPending && cleaner.available && onBook(cleaner)}
            >
              {isPending
                ? <HourglassIcon />
                : <Text style={s.actionBtnPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {cleaner.available ? t.bookBtnShort : t.notAvailBtn}
                  </Text>
              }
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.insuranceBtn} onPress={() => Linking.openURL('https://www.bitui.co.il')}>
            <Text style={s.insuranceBtnText}>{t.insuranceBtn}</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router   = useRouter();
  const { t, setLang } = useLanguage();
  const { dark, toggleDark } = useTheme();
  const insets   = useSafeAreaInsets();
  const mapRef      = useRef<MapView>(null);
  const flatListRef = useRef<FlatList>(null);
  const [region,     setRegion]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [searchSugg, setSearchSugg] = useState<{label:string; icon:string}[]>([]);
  const [showSearchSugg, setShowSearchSugg] = useState(false);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [profile,    setProfile]    = useState<any>(null);
  const [booking,    setBooking]    = useState<any>(null);
  const [chatWith,   setChatWith]   = useState<any>(null);
  const [drawer,     setDrawer]     = useState(false);
  const [userCoords,    setUserCoords]    = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyMode,    setNearbyMode]    = useState(false);
  const [realCleaners,  setRealCleaners]  = useState<any[]>([]);

  // Advanced filter
  const [filterVisible,  setFilterVisible]  = useState(false);
  const [filterMinRating,setFilterMinRating]= useState(0);
  const [filterMaxPrice, setFilterMaxPrice] = useState(999);
  const [filterAvailOnly,setFilterAvailOnly]= useState(false);
  const [filterTypes,    setFilterTypes]    = useState<string[]>([]);
  const [filterCity,     setFilterCity]     = useState('');

  // תפקיד המשתמש
  const [myRole,         setMyRole]         = useState<'client' | 'cleaner'>('client');
  const [cleanerPendingCount, setCleanerPendingCount] = useState(0);

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
  const [urgentAddress,   setUrgentAddress]   = useState('');
  const [urgentPayment,   setUrgentPayment]   = useState('cash');
  const [urgentSending,   setUrgentSending]   = useState(false);
  const [urgentWaiting,   setUrgentWaiting]   = useState(false);
  const [urgentRequestId, setUrgentRequestId] = useState<string|null>(null);
  const [urgentFoundName, setUrgentFoundName] = useState('');

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
      if (urgentOpen)    { setUrgentOpen(false);    return true; }
      if (photoViewerOpen){ setPhotoViewerOpen(false); return true; }
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
  }, [drawer, profile, booking, chatWith, filterVisible, urgentOpen, photoViewerOpen, reportOpen, search, showSearchSugg]);

  const handleSendUrgent = async () => {
    if (!urgentAddress.trim() || urgentAddress.trim().length < 5)
      return Alert.alert(t.error, t.addressTooShort);
    if (!/\d/.test(urgentAddress))
      return Alert.alert(t.error, t.addressNoNumber);
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
      const dateStr = targetDate.toISOString().split('T')[0];

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
        paymentMethod: urgentPayment,
        total: urgentHours * 80,
        status: 'open',
        createdAt: new Date().toISOString(),
        expiresAt,
        notifiedCleaners: [],
      });
      setUrgentRequestId(reqRef.id);

      // שלח Push לכל מנקה ברדיוס 30 קמ — רק עד 20:00
      try {
        const nowHour = new Date().getHours();
        if (nowHour >= 20) {
          // אחרי 8 בערב — לא שולחים התראות
          await updateDoc(doc(db,'urgentRequests', reqRef.id), { status: 'expired' });
          Alert.alert('🌙 שעות פעילות', 'שליחת בקשות דחופות אפשרית עד 20:00 בלבד.\nנסה שוב מחר.');
          setUrgentSending(false);
          return;
        } else {
        const cleanersSnap = await getDocs(query(collection(db,'users'), where('role','==','cleaner')));
        const URGENT_KM = 30;
        const notified: string[] = [];
        const noLocation = !userCoords; // אין מיקום — שלח לכולם

        for (const cd of cleanersSnap.docs) {
          const cData = cd.data();

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
              inRange = getDistanceKm(clientLat, clientLng, cLat, cLng) <= URGENT_KM;
            } else {
              inRange = true; // אין מיקום למנקה — שלח לו בכל מקרה
            }
          }

          if (!inRange) continue;

          notified.push(cd.id);

          // מצא או צור קבוצה פרטית למנקה
          const cleanerPhone = (cData.phone || cData.phoneNumber || cData.mobile || '').trim();
          let groupId = cData.whatsappGroupId || '';

          // אם אין Group ID ויש טלפון — צור קבוצה אוטומטית
          if (!groupId && cleanerPhone) {
            groupId = await createWhatsAppGroup(cData.name || 'מנקה', cleanerPhone, cd.id);
          }

          const waTarget = groupId || cleanerPhone;

          if (waTarget) {
            const dateLabel = urgentDate === 'today' ? 'היום' : 'מחר';
            const msgTotal  = urgentHours * 80;
            const waMsg =
`⚡ *בקשת ניקוי דחוף!*

👤 לקוח: ${clientName}
📅 תאריך: ${dateLabel} (${dateStr})
🕐 שעה: ${hh}:${mm}
⏱️ משך: ${urgentHours} שעות
📍 כתובת: ${urgentAddress.trim()}
💰 תשלום: ₪${msgTotal}

👇 *לאישור — פתח את האפליקציה ולחץ על "ניקיון דחוף"*`;
            await sendWhatsAppMessage(waTarget, waMsg);
            console.log('[WA →', groupId ? '🟢 קבוצה פרטית' : '📱 טלפון', cData.name, ']');
          } else {
            console.warn('[WA] אין קבוצה ואין טלפון למנקה:', cData.name);
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

  // Mandatory review
  const [isBlocked,            setIsBlocked]            = useState(false);
  const [pendingReviewBooking, setPendingReviewBooking] = useState<any>(null);
  const [showMandatoryReview,  setShowMandatoryReview]  = useState(false);
  const [mandatoryStars,       setMandatoryStars]       = useState(0);
  const [mandatoryComment,     setMandatoryComment]     = useState('');
  const [mandatorySubmitting,  setMandatorySubmitting]  = useState(false);

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
      Alert.alert(t.error, 'שגיאה בשליחת הדיווח');
    } finally {
      setReportSending(false);
    }
  };

  const REGIONS = [
    { key: 'all',    label: t.regionAll    },
    { key: 'north',  label: t.regionNorth  },
    { key: 'center', label: t.regionCenter },
    { key: 'south',  label: t.regionSouth  },
  ];

  const ALL_CLEANERS = [
    ...CLEANERS,
    ...realCleaners.filter(r => !CLEANERS.some(c => c.id === r.id)),
  ];

  // ── Search autocomplete ────────────────────────────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (text.length < 1) { setSearchSugg([]); setShowSearchSugg(false); return; }
    const sq = text.toLowerCase();
    const cities  = Array.from(new Set(ALL_CLEANERS.map(c => String(c.city || ''))))
      .filter(c => c.toLowerCase().includes(sq))
      .slice(0, 5)
      .map(c => ({ label: c, icon: '📍' }));
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

  // 2. אזור (טאב + מודאל — עובד תמיד, עצמאי מהחיפוש)
  if (region !== 'all') {
    filtered = filtered.filter(c => {
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

  // 4. קרוב אלי — פילטר נוסף, לא מבטל את השאר
  if (nearbyMode && userCoords) {
    const nearby = filtered.filter(c => {
      const dist = getDistanceKm(userCoords.lat, userCoords.lng, c.lat, c.lng);
      return dist <= NEARBY_KM;
    });
    // אם יש תוצאות בקרבה — השתמש בהן, אחרת השאר את כל התוצאות
    if (nearby.length > 0) filtered = nearby;
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
    })();
  }, []);

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
          // טען הזמנות ממתינות עבור מנקה
          getDocs(query(collection(db, 'bookings'), where('cleanerId', '==', uid), where('status', '==', 'pending')))
            .then(s => setCleanerPendingCount(s.size)).catch(() => {});
        }
      }
    }).catch(() => {});

    // Load client bookings for recurring rebook detection + mandatory review
    getDocs(query(collection(db, 'bookings'), where('clientUid', '==', uid), orderBy('createdAt', 'desc')))
      .then(async snap => {
        const bks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMyBookings(bks);
        // סמן מנקים עם הזמנה ממתינה/מאושרת
        const pendingIds = new Set<string>(
          bks.filter((b: any) => ['pending','confirmed'].includes(b.status)).map((b: any) => b.cleanerId)
        );
        setPendingCleanerIds(pendingIds);
        // Find bookings due for rebook
        const nowMs = Date.now();
        const dueRebook = bks.find((b: any) => {
          if (b.status !== 'done') return false;
          const finMs = new Date(b.finishedAt || b.createdAt).getTime();
          const daysSince = (nowMs - finMs) / 86400000;
          if (b.recurring === 'weekly'  && daysSince >= 6  && daysSince <= 9)  return true;
          if (b.recurring === 'monthly' && daysSince >= 28 && daysSince <= 35) return true;
          return false;
        });
        if (dueRebook) setRebookAlert(dueRebook);

        // Check for pending mandatory reviews
        const pending = bks.filter((b: any) =>
          b.status === 'done' && b.reviewRequired === true && !b.cleanerRating
        );
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
  }, []);

  // Load real cleaners from Firestore
  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', '==', 'cleaner'))).then(snap => {
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
      setRealCleaners(list);
    }).catch(() => {});
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
      // latitudeDelta ≈ 60km/111km ≈ 0.54, add 30% padding → 0.70
      // longitudeDelta ≈ 60km/94km (at 32°N) ≈ 0.64, add 30% → 0.83
      mapRef.current.animateToRegion(
        { latitude: userCoords.lat, longitude: userCoords.lng, latitudeDelta: 0.70, longitudeDelta: 0.83 },
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
      });
      // Update cleaner aggregate rating
      const cleanerRef = doc(db, 'users', pendingReviewBooking.cleanerId);
      const cleanerSnap = await getDoc(cleanerRef);
      if (cleanerSnap.exists()) {
        const d = cleanerSnap.data();
        const oldRating = d.rating || 0;
        const oldCount  = d.reviewCount || d.reviews || 0;
        const newCount  = oldCount + 1;
        const newRating = Math.round(((oldRating * oldCount) + mandatoryStars) / newCount * 10) / 10;
        await updateDoc(cleanerRef, { rating: newRating, reviewCount: newCount, reviews: newCount });
        // Add to reviews subcollection
        try {
          await addDoc(collection(db, 'users', pendingReviewBooking.cleanerId, 'reviews'), {
            stars: mandatoryStars,
            text: mandatoryComment.trim(),
            clientName: auth.currentUser?.displayName || 'לקוח',
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
      }
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
    } catch (_) {
      Alert.alert(t.error, 'שגיאה בשליחת הביקורת');
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
    <SafeAreaView style={[s.wrap, dark && { backgroundColor: '#0F172A' }]}>
      <StatusBar barStyle="light-content" backgroundColor={dark ? '#0F172A' : C.blueDark} />

      <View style={{ backgroundColor: dark ? '#0F172A' : C.blueDark, flexShrink: 0 }}>
        <View style={s.header}>
          <View style={s.headerLogoRow}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Text style={s.headerSub}>{filtered.filter(c => c.available).length} {t.availSuffix}</Text>

              {/* אייקון הודעות עם badge */}
              <TouchableOpacity
                onPress={() => router.push('/messages')}
                style={s.msgIconBtn}
              >
                <Text style={s.msgIconText}>💬</Text>
                {unreadCount > 0 && (
                  <View style={s.msgBadge}>
                    <Text style={s.msgBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {myRole === 'client' && (
                <TouchableOpacity onPress={() => setFilterVisible(true)} style={[s.urgentHeaderBtn, { backgroundColor: activeFilterCount > 0 ? C.white : 'rgba(255,255,255,0.15)' }]}>
                  <Text style={[s.urgentHeaderBtnText, { color: activeFilterCount > 0 ? C.blue : C.white }]}>
                    {t.filterBtn}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              {myRole === 'client' && (
                <TouchableOpacity
                  onPress={() => setUrgentOpen(true)}
                  style={s.urgentHeaderBtn}
                >
                  <Text style={s.urgentHeaderBtnText}>{t.urgentBtn}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={toggleDark} style={s.darkModeToggle}>
                <Text style={{ fontSize: 16 }}>{dark ? '☀️' : '🌙'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDrawer(true)} style={s.hamburgerBtn}>
                <Text style={s.hamburgerText}>≡</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Free platform banner */}
          <View style={s.freeBanner}>
            <Text style={s.freeBannerTitle}>{t.freeBannerTitle}</Text>
            <Text style={s.freeBannerSub}>{t.freeBannerSub}</Text>
          </View>

          {/* באנר הזמנות ממתינות למנקה */}
          {myRole === 'cleaner' && cleanerPendingCount > 0 && (
            <TouchableOpacity
              style={{ backgroundColor: '#F59E0B', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              onPress={() => router.push('/profile')}
            >
              <Text style={{ fontSize: 20 }}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>
                  יש לך {cleanerPendingCount} הזמנ{cleanerPendingCount === 1 ? 'ה' : 'ות'} ממתינ{cleanerPendingCount === 1 ? 'ה' : 'ות'} לאישור!
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>לחץ לאישור ›</Text>
              </View>
              <Text style={{ fontSize: 22, backgroundColor: '#DC2626', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, color: '#fff', fontWeight: '900' }}>
                {cleanerPendingCount}
              </Text>
            </TouchableOpacity>
          )}

          {/* Rebook alert */}
          {rebookAlert && (
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={() => {
                Alert.alert(t.recurRebookTitle, t.recurRebookMsg, [
                  { text: t.cancel, style: 'cancel', onPress: () => setRebookAlert(null) },
                  { text: t.recurRebookBtn, onPress: () => { setRebookAlert(null); setBooking(rebookAlert); } },
                ]);
              }}
            >
              <Text style={{ fontSize: 14 }}>🔄</Text>
              <Text style={{ color: C.white, fontSize: 12, fontWeight: '700', flex: 1 }}>{t.recurRebookTitle}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>›</Text>
            </TouchableOpacity>
          )}
          <View style={{ zIndex: 999, elevation: 999 }}>
            <View style={s.searchWrap}>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder={t.searchPlaceholder}
                value={search}
                onChangeText={handleSearchChange}
                placeholderTextColor="rgba(255,255,255,0.5)"
                textAlign="right"
                onBlur={() => setTimeout(() => setShowSearchSugg(false), 180)}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => { setSearch(''); setSearchSugg([]); setShowSearchSugg(false); }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {showSearchSugg && searchSugg.length > 0 && (
              <View style={s.searchDropdown}>
                {searchSugg.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[s.searchSuggItem, idx < searchSugg.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.grayBorder }]}
                    onPress={() => { setSearch(item.label); setShowSearchSugg(false); }}
                  >
                    <Text style={{ fontSize: 14, marginLeft: 6 }}>{item.icon}</Text>
                    <Text style={s.searchSuggText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 50 }} contentContainerStyle={s.tabsBar}>
        {REGIONS.map(r => (
          <TouchableOpacity key={r.key} style={[s.tab, region === r.key && s.tabActive]} onPress={() => handleRegion(r.key)}>
            <Text style={[s.tabText, region === r.key && s.tabTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      </View>

      <View style={[s.body, { paddingBottom: insets.bottom }]}>
        <View style={s.mapWrap}>
          <MapView ref={mapRef} style={s.map} initialRegion={REGION_DEFAULTS.all} showsUserLocation showsMyLocationButton={false}>
            {nearbyMode && userCoords && (
              <Circle
                center={{ latitude: userCoords.lat, longitude: userCoords.lng }}
                radius={NEARBY_KM * 1000}
                strokeColor="rgba(24,95,165,0.5)"
                fillColor="rgba(24,95,165,0.08)"
                strokeWidth={2}
              />
            )}
            {filtered.map(c => {
              const dotColor = !c.available ? '#EF4444' : C.blue;
              const dotSize  = selected === c.id ? 18 : 13;
              return (
                <Marker key={c.id} coordinate={{ latitude: c.lat, longitude: c.lng }} onPress={() => setSelected(c.id === selected ? null : c.id)} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: dotColor, borderWidth: 2, borderColor: C.white, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2 }} />
                </Marker>
              );
            })}
          </MapView>
        </View>
        <FlatList
          ref={flatListRef}
          style={[s.list, dark && { backgroundColor: '#1E293B' }]} data={filtered} keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 10, gap: 10 }}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => {}}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🔍</Text>
              <Text style={s.empty}>{nearbyMode ? t.noNearbyCleaners : t.noCleaners}</Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <CleanerCard
              cleaner={c} selected={selected} onSelect={setSelected}
              onProfile={setProfile} onBook={setBooking} onChat={setChatWith}
              isPending={pendingCleanerIds.has(c.id)}
            />
          )}
        />
      </View>

      <CleanerProfile cleaner={profile}  visible={!!profile}  onClose={() => setProfile(null)}  onBook={setBooking} onChat={setChatWith} />
      <BookingModal
        cleaner={booking}
        visible={!!booking}
        onClose={() => setBooking(null)}
        onBookingCreated={(cleanerId: string) => {
          setPendingCleanerIds(prev => new Set([...prev, cleanerId]));
          // לא סוגרים כאן — מסך ההצלחה יסגור בעצמו
        }}
      />
      <ChatModal      cleaner={chatWith} visible={!!chatWith} onClose={() => setChatWith(null)} />
      <DrawerMenu
        visible={drawer}
        onClose={() => setDrawer(false)}
        onProfile={() => router.push('/profile')}
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
              <Text style={{ color: C.white, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{t.filterTitle}</Text>
            <TouchableOpacity onPress={() => { setFilterMinRating(0); setFilterMaxPrice(999); setFilterAvailOnly(false); setFilterTypes([]); setFilterCity(''); setRegion('all'); }} style={s.closeBtn}>
              <Text style={{ color: C.white, fontSize: 11, fontWeight: '700' }}>{t.filterReset}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>

            {/* ── סינון לפי אזור ──────────────────────────────────────────── */}
            <View>
              <Text style={s.fieldLabel}>📍 סינון לפי אזור</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {[
                  { key: 'all',    label: t.regionAll    },
                  { key: 'north',  label: t.regionNorth  },
                  { key: 'center', label: t.regionCenter },
                  { key: 'south',  label: t.regionSouth  },
                ].map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[s.hourBtn, region === r.key && s.hourBtnActive, { width: 'auto', paddingHorizontal: 14 }]}
                    onPress={() => setRegion(r.key)}
                  >
                    <Text style={[{ fontSize: 13, fontWeight: '700', color: C.textDark }, region === r.key && { color: C.white }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── חיפוש לפי עיר ───────────────────────────────────────────── */}
            <View>
              <Text style={s.fieldLabel}>🏙️ חיפוש לפי עיר</Text>
              <TextInput
                style={[s.input, { marginTop: 8, textAlign: 'right' }]}
                placeholder="הקלד שם עיר... (חיפה, תל אביב...)"
                placeholderTextColor={C.textSub}
                value={filterCity}
                onChangeText={setFilterCity}
              />
            </View>

            {/* Min rating */}
            <View>
              <Text style={s.fieldLabel}>{t.filterRatingLabel}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {[0,3,4,4.5,4.8].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.hourBtn, filterMinRating === r && s.hourBtnActive, { width: 'auto', paddingHorizontal: 12 }]}
                    onPress={() => setFilterMinRating(r)}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '700', color: C.textDark }, filterMinRating === r && { color: C.white }]}>
                      {r === 0 ? t.filterReset : `⭐ ${r}+`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Max price */}
            <View>
              <Text style={s.fieldLabel}>{t.filterMaxPriceLabel}: ₪{filterMaxPrice === 999 ? '∞' : filterMaxPrice}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {[999, 200, 150, 100, 80, 60].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[s.hourBtn, filterMaxPrice === p && s.hourBtnActive, { width: 'auto', paddingHorizontal: 12 }]}
                    onPress={() => setFilterMaxPrice(p)}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '700', color: C.textDark }, filterMaxPrice === p && { color: C.white }]}>
                      {p === 999 ? t.filterReset : `≤₪${p}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Available only */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.blueBorder }}>
              <Text style={s.fieldLabel}>{t.filterAvailLabel}</Text>
              <Switch
                value={filterAvailOnly}
                onValueChange={setFilterAvailOnly}
                trackColor={{ false: C.blueBorder, true: C.blue }}
                thumbColor={C.white}
              />
            </View>

            {/* Service types */}
            <View>
              <Text style={s.fieldLabel}>{t.filterTypesLabel}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {Object.keys(TYPE_ICONS).map(tp => {
                  const active = filterTypes.includes(tp);
                  return (
                    <TouchableOpacity
                      key={tp}
                      style={[s.typePill, active && { backgroundColor: C.blue }]}
                      onPress={() => setFilterTypes(prev => active ? prev.filter(x => x !== tp) : [...prev, tp])}
                    >
                      <Text style={[s.typePillText, active && { color: C.white }]}>{TYPE_ICONS[tp]} {t.types[tp] || tp}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ספירת תוצאות חיה */}
            <View style={{ backgroundColor: filtered.length > 0 ? '#D1FAE5' : '#FEE2E2', borderRadius: 12, padding: 12, alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 15, color: filtered.length > 0 ? '#065F46' : '#991B1B' }}>
                {filtered.length > 0
                  ? `✅ נמצאו ${filtered.length} מנקים`
                  : '❌ אין מנקים בסינון הנוכחי — נסה להרחיב'}
              </Text>
            </View>

            <TouchableOpacity style={s.confirmBtn} onPress={() => setFilterVisible(false)}>
              <Text style={s.confirmBtnText}>
                ✓ הצג {filtered.length} מנקים
              </Text>
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

      {/* ── ביקורת חובה ── */}
      <Modal visible={showMandatoryReview} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: C.white, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.textDark, textAlign: 'center', marginBottom: 6 }}>
              {t.reviewRequiredTitle}
            </Text>
            <Text style={{ fontSize: 13, color: C.textSub, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
              {t.reviewRequiredMsg}
            </Text>
            {pendingReviewBooking && (
              <View style={{ backgroundColor: C.blueLight, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.textDark, textAlign: 'center' }}>
                  {pendingReviewBooking.cleanerName}
                </Text>
                {pendingReviewBooking.reviewDeadline && (() => {
                  const days = Math.max(0, Math.ceil((new Date(pendingReviewBooking.reviewDeadline).getTime() - Date.now()) / 86400000));
                  return <Text style={{ fontSize: 12, color: days <= 1 ? '#EF4444' : C.textSub, textAlign: 'center', marginTop: 4 }}>⏳ {days} {t.reviewDeadlineDays}</Text>;
                })()}
              </View>
            )}
            {/* Star picker with animation */}
            <AnimatedStarPicker value={mandatoryStars} onChange={setMandatoryStars} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.textDark, marginBottom: 6, textAlign: 'right' }}>
              {t.reviewCommentLabel}
            </Text>
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
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.white }}>
                {mandatorySubmitting ? '...' : t.reviewSubmitNow}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── חסימה ── */}
      {isBlocked && !showMandatoryReview && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 32, zIndex: 999 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔒</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.white, textAlign: 'center', marginBottom: 10 }}>
            {t.blockedTitle}
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
            {t.blockedMsg}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: C.blue, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 }}
            onPress={() => setShowMandatoryReview(true)}
          >
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.white }}>{t.reviewSubmitNow}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── מודל ניקוי דחוף ── */}
      <Modal visible={urgentOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setUrgentOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bluePale }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#7C3AED', padding: 16 }}>
            {!urgentWaiting && !urgentFoundName ? (
              <TouchableOpacity onPress={() => setUrgentOpen(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.white, fontSize: 18, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            ) : <View style={{ width: 36 }} />}
            <Text style={{ fontSize: 17, fontWeight: '900', color: C.white }}>⚡ {t.urgentTitle}</Text>
            <View style={{ width: 36 }} />
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          <ScrollView ref={urgentScrollRef} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

            {/* ── מצב המתנה ── */}
            {urgentWaiting && (
              <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 28, alignItems: 'center', gap: 14, borderWidth: 2, borderColor: '#7C3AED' }}>
                <Text style={{ fontSize: 48 }}>⏳</Text>
                <Text style={{ fontSize: 18, fontWeight: '900', color: C.textDark, textAlign: 'center' }}>{t.urgentWaitingMsg}</Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 6 }}
                  onPress={handleCancelUrgent}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#EF4444' }}>{t.urgentCancelBtn}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── נמצא מנקה ── */}
            {!urgentWaiting && urgentFoundName !== '' && (
              <View style={{ backgroundColor: '#D1FAE5', borderRadius: 20, padding: 28, alignItems: 'center', gap: 12, borderWidth: 2, borderColor: C.green }}>
                <Text style={{ fontSize: 52 }}>🎉</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#065F46', textAlign: 'center' }}>{t.urgentFoundMsg}</Text>
                <Text style={{ fontSize: 16, color: '#065F46', fontWeight: '700' }}>{urgentFoundName}</Text>
                <TouchableOpacity
                  style={{ backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 36, marginTop: 6 }}
                  onPress={() => { setUrgentOpen(false); setUrgentFoundName(''); setUrgentRequestId(null); setUrgentAddress(''); }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '900', color: C.white }}>סגור</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── טופס ── */}
            {!urgentWaiting && urgentFoundName === '' && (
              <>
                <View style={{ backgroundColor: '#EDE9FE', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#DDD6FE' }}>
                  <Text style={{ fontSize: 13, color: '#4C1D95', textAlign: 'center', lineHeight: 20 }}>⚡ {t.urgentSubtitle}</Text>
                </View>

                {/* תאריך */}
                <View style={{ gap: 8 }}>
                  <Text style={s.fieldLabel}>{t.urgentDateLabel}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['today','tomorrow'] as const).map(d => (
                      <TouchableOpacity
                        key={d}
                        style={[s.hourBtn, { flex: 1 }, urgentDate === d && s.hourBtnActive]}
                        onPress={() => setUrgentDate(d)}
                      >
                        <Text style={[{ fontSize: 14, fontWeight: '700', color: C.textDark, textAlign: 'center' }, urgentDate === d && { color: C.white }]}>
                          {d === 'today' ? `${t.urgentToday} 📅` : `${t.urgentTomorrow} 🌅`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* שעת התחלה */}
                <View style={{ gap: 8 }}>
                  <Text style={s.fieldLabel}>{t.timeLabel}</Text>
                  <TimeWheelPicker value={urgentHour} onChange={setUrgentHour} />
                </View>

                {/* שעות עבודה */}
                <View style={{ gap: 8 }}>
                  <Text style={s.fieldLabel}>{t.hoursLabel}</Text>
                  <HoursWheelPicker value={urgentHours} onChange={setUrgentHours} values={[1,2,3,4,5,6,7,8,9,10,11,12]} />
                </View>

                {/* כתובת */}
                <View style={{ gap: 8, zIndex: 999 }}>
                  <Text style={s.fieldLabel}>{t.addressLabel}</Text>
                  <AddressAutocomplete value={urgentAddress} onChange={setUrgentAddress} placeholder={t.addressPlaceholder}
                    onFocus={() => setTimeout(() => urgentScrollRef.current?.scrollToEnd({ animated: true }), 300)}
                  />
                </View>

                {/* תשלום */}
                <View style={{ gap: 8 }}>
                  <Text style={s.fieldLabel}>{t.paymentMethodLabel}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['cash','bit','card'] as const).map(p => (
                      <TouchableOpacity key={p} style={[s.hourBtn, { flex: 1 }, urgentPayment === p && s.hourBtnActive]} onPress={() => setUrgentPayment(p)}>
                        <Text style={[{ fontSize: 13, fontWeight: '700', color: C.textDark, textAlign: 'center' }, urgentPayment === p && { color: C.white }]}>
                          {p === 'cash' ? t.payCash : p === 'bit' ? t.payBit : t.payCard}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* כפתור שליחה */}
                <TouchableOpacity
                  style={{ backgroundColor: '#7C3AED', borderRadius: 14, padding: 16, alignItems: 'center', opacity: urgentSending ? 0.6 : 1 }}
                  onPress={handleSendUrgent}
                  disabled={urgentSending}
                >
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.white }}>
                    {urgentSending ? t.urgentSending : t.urgentSendBtn}
                  </Text>
                </TouchableOpacity>
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
              <Text style={{ color: C.white, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.white }}>🚨 {t.reportTitle}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
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
                  <Text style={{ fontSize: 20 }}>{reportType === opt.key ? '🔵' : '⚪'}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: reportType === opt.key ? C.white : C.textDark }}>{opt.label}</Text>
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
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.white }}>{reportSending ? '...' : t.reportSubmit}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>


    </SafeAreaView>
  );
}

// ─── Drawer styles ────────────────────────────────────────────────────────────
const ds = StyleSheet.create({
  backdrop:       { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel:          { position: 'absolute', top: 0, bottom: 0, right: 0, width: 270, backgroundColor: C.white, elevation: 20 },
  panelHeader:    { backgroundColor: C.white, padding: 28, paddingTop: 50, alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: C.grayBorder },
  panelLogo:      { fontSize: 40 },
  panelAppName:   { fontSize: 20, fontWeight: '900', color: C.blueDark },
  item:           { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: C.grayBorder },
  itemIcon:       { fontSize: 20, marginRight: 14 },
  itemText:       { fontSize: 15, fontWeight: '600', color: C.textDark },
  itemArrow:      { fontSize: 16, color: C.textSub, marginLeft: 'auto' },
  langList:       { backgroundColor: C.bluePale, paddingVertical: 4 },
  langItem:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, gap: 12 },
  langItemActive: { backgroundColor: C.blueLight },
  langFlag:       { fontSize: 22 },
  langLabel:      { fontSize: 14, fontWeight: '600', color: C.textDark, flex: 1 },
});

// ─── Main styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap:         { flex: 1, backgroundColor: C.bluePale, direction: 'ltr' },
  header:       { backgroundColor: C.blueDark, paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 6 : 14, paddingBottom: 10 },
  headerLogoRow:{ marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:  { fontSize: 24, fontWeight: '900', color: C.white, letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  headerSub:    { fontSize: 11, color: C.blueBorder, width: 48, textAlign: 'left' },
  hamburgerBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  hamburgerText:{ fontSize: 20, color: C.white, fontWeight: '700', lineHeight: 22 },
  // Messages icon
  msgIconBtn:   { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, width: 38, height: 32, alignItems: 'center', justifyContent: 'center' },
  msgIconText:  { fontSize: 18 },
  msgBadge:     { position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.blueDark },
  msgBadgeText: { color: C.white, fontSize: 10, fontWeight: '800' },
  nearbyBtn:         { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  nearbyBtnActive:   { backgroundColor: C.white },
  nearbyBtnText:     { fontSize: 14, color: C.white, fontWeight: '700' },
  nearbyBtnTextActive: { color: C.blue },
  searchWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 12, height: 40, gap: 8 },
  searchInput:     { flex: 1, fontSize: 13, color: C.white, padding: 0 },
  searchDropdown:  { position: 'absolute', top: 44, left: 0, right: 0, backgroundColor: C.white, borderRadius: 14, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, zIndex: 9999, overflow: 'hidden' },
  searchSuggItem:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  searchSuggText:  { flex: 1, fontSize: 14, color: C.textDark, textAlign: 'right', fontWeight: '500' },
  tabsBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 6, height: 50, minWidth: '100%' },
  tab:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  tabActive:    { backgroundColor: C.white, borderColor: C.white },
  tabText:      { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  tabTextActive:{ color: C.blueDark, fontWeight: '700' },
  body:         { flex: 1, flexDirection: 'row' },
  mapWrap:      { width: W * 0.42, borderRightWidth: 1, borderColor: C.blueBorder },
  map:          { flex: 1 },
  list:         { flex: 1 },
  pinHead:      { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: C.white, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  pinTail:      { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  pinText:      { color: C.white, fontWeight: '900', fontSize: 10 },
  callout:      { width: 140, padding: 8 },
  calloutName:  { fontSize: 13, fontWeight: '700', color: C.textDark, marginBottom: 2 },
  calloutSub:   { fontSize: 11, color: C.textSub, marginBottom: 3 },
  backToList:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.grayBorder },
  backToListText: { fontSize: 13, fontWeight: '700', color: C.blue },
  card:         { backgroundColor: C.white, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: C.blueBorder, shadowColor: '#185FA5', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  cardSel:      { borderColor: C.blue, borderWidth: 1.5, elevation: 6 },
  cardTop:      { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avatar:       { width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText:   { color: C.white, fontWeight: '900', fontSize: 15 },
  cardName:     { fontSize: 14, fontWeight: '700', color: C.blue },
  cardCity:     { fontSize: 11, color: C.textSub },
  priceTag:     { backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  priceText:    { fontSize: 14, fontWeight: '900', color: C.blue },
  priceSub:     { fontSize: 9, color: C.textSub },
  ratingVal:    { fontSize: 12, fontWeight: '700', color: C.textDark },
  reviewsLink:  { fontSize: 11, color: C.blue, textDecorationLine: 'underline' },
  availPill:    { backgroundColor: C.greenBg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  availPillOff: { backgroundColor: C.grayBg, borderWidth: 1, borderColor: C.grayBorder },
  availPillText:{ fontSize: 10, fontWeight: '700', color: C.green },
  typePill:     { backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  typePillText: { fontSize: 10, fontWeight: '600', color: C.blueDark },
  cardExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: C.blueBorder },
  payChip:      { backgroundColor: C.grayBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.grayBorder },
  payChipText:  { fontSize: 10, fontWeight: '600', color: C.textDark },
  actionBtn:         { flex: 1, backgroundColor: C.blueLight, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.blueBorder, minHeight: 40 },
  actionBtnText:     { fontSize: 14, fontWeight: '700', color: C.blue, textAlign: 'center' },
  actionBtnPrimary:  { flex: 1, backgroundColor: C.blue, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: C.white, textAlign: 'center' },
  insuranceBtn:     { marginTop: 8, backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  insuranceBtnText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  urgentHeaderBtn:  { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  darkModeToggle:   { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  urgentHeaderBtnText: { fontSize: 13, color: C.white, fontWeight: '900' },
  empty:        { textAlign: 'center', color: C.textSub, fontSize: 14, marginTop: 40 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.blueDark, padding: 16 },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: C.white },
  profileHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.blueDark, padding: 16 },
  profileHeaderTitle:{ fontSize: 16, fontWeight: '800', color: C.white },
  profileHero:       { backgroundColor: C.blue, padding: 24, alignItems: 'center', gap: 8 },
  profileAvatar:     { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  profileAvatarText: { color: C.white, fontWeight: '900', fontSize: 28 },
  profileName:       { fontSize: 22, fontWeight: '900', color: C.white },
  profileCity:       { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  statsRow:     { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20, marginTop: 8 },
  statBox:      { flex: 1, alignItems: 'center' },
  statDivider:  { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  statVal:      { fontSize: 20, fontWeight: '900', color: C.white },
  statLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  profileSection:     { backgroundColor: C.white, margin: 12, marginBottom: 0, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.blueBorder },
  profileSectionTitle:{ fontSize: 15, fontWeight: '800', color: C.textDark, marginBottom: 10 },
  profileBio:         { fontSize: 14, color: C.textMid, lineHeight: 22 },
  phonePill:          { backgroundColor: C.blueLight, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: C.blueBorder },
  phonePillText:      { fontSize: 14, fontWeight: '700', color: C.blue },
  servicePill:  { backgroundColor: C.blueLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  servicePillText: { fontSize: 12, fontWeight: '600', color: C.blueDark },
  areaPill:     { backgroundColor: C.blueLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.blueBorder },
  areaPillText: { fontSize: 12, fontWeight: '700', color: C.blue },
  payPill:      { backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  payPillText:  { fontSize: 12, fontWeight: '600', color: C.white },
  seeAllBtn:    { fontSize: 13, color: C.blue, fontWeight: '700' },
  allReviewsBtn:     { backgroundColor: C.blueLight, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: C.blueBorder },
  allReviewsBtnText: { fontSize: 13, fontWeight: '700', color: C.blue },
  profileFooter:     { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.blueBorder },
  footerChat:   { flex: 1, backgroundColor: C.blueLight, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder },
  footerChatText: { fontSize: 14, fontWeight: '700', color: C.blue },
  footerBook:   { flex: 2, backgroundColor: C.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  footerBookText: { fontSize: 14, fontWeight: '700', color: C.white },
  availBadge:   { backgroundColor: C.greenBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  availBadgeOff:{ backgroundColor: 'rgba(255,255,255,0.15)' },
  availBadgeText: { fontSize: 12, fontWeight: '700', color: C.green },
  ratingBigCard: { backgroundColor: C.white, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.blueBorder },
  ratingBigNum:  { fontSize: 48, fontWeight: '900', color: C.textDark },
  ratingBigCount:{ fontSize: 13, color: C.textSub },
  reviewCard:   { backgroundColor: C.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.blueBorder, elevation: 2 },
  reviewTop:    { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { color: C.white, fontWeight: '700', fontSize: 14 },
  reviewName:   { fontSize: 13, fontWeight: '700', color: C.textDark, marginBottom: 3 },
  reviewText:   { fontSize: 13, color: C.textMid, lineHeight: 20 },
  bookingCard:  { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: C.blueBorder },
  bookingAvatar:{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  bookingAvatarText: { color: C.white, fontWeight: '900', fontSize: 16 },
  bookingName:  { fontSize: 15, fontWeight: '700', color: C.textDark },
  bookingCity:  { fontSize: 12, color: C.textSub },
  fieldLabel:   { fontSize: 13, fontWeight: '700', color: C.textDark },
  hoursRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hourBtn:      { width: 48, height: 48, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.blueBorder },
  hourBtnActive:{ backgroundColor: C.blue, borderColor: C.blue },
  hourBtnText:  { fontSize: 16, fontWeight: '700', color: C.textDark },
  input:        { backgroundColor: C.white, borderRadius: 10, padding: 13, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder },
  payRow:       { flexDirection: 'row', gap: 8 },
  payBtn:       { flex: 1, backgroundColor: C.white, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder },
  payBtnActive: { backgroundColor: C.blueLight, borderColor: C.blue },
  payIcon:      { fontSize: 20, marginBottom: 4 },
  payLabel:     { fontSize: 11, fontWeight: '600', color: C.textDark },
  summaryCard:  { backgroundColor: C.white, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder },
  summaryLabel: { fontSize: 14, color: C.textMid },
  summaryTotal: { fontSize: 24, fontWeight: '900', color: C.blue },
  confirmBtn:   { backgroundColor: C.blue, borderRadius: 12, padding: 15, alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '800', color: C.white },
  successWrap:  { alignItems: 'center', padding: 32 },
  successTitle: { fontSize: 24, fontWeight: '900', color: C.textDark, marginBottom: 10, marginTop: 16 },
  successSub:   { fontSize: 15, color: C.textMid, textAlign: 'center', lineHeight: 26, marginBottom: 24 },
  nextStepsCard:   { backgroundColor: C.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.blueBorder, width: '100%', marginBottom: 20, gap: 10 },
  nextStepsTitle:  { fontSize: 15, fontWeight: '800', color: C.textDark, marginBottom: 4 },
  nextStepItem:    { fontSize: 14, color: C.textMid, lineHeight: 22 },
  myBookingsBtn:   { backgroundColor: C.blueLight, borderRadius: 12, padding: 14, alignItems: 'center', width: '100%', marginBottom: 0, borderWidth: 1.5, borderColor: C.blue },
  myBookingsBtnText: { fontSize: 15, fontWeight: '800', color: C.blue },
  bubble:       { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleClient: { backgroundColor: C.white, borderWidth: 1, borderColor: C.blueBorder },
  bubbleCleaner:{ backgroundColor: C.blue },
  bitCard:      { backgroundColor: '#EEF6FF', borderRadius: 14, padding: 14, marginVertical: 4, borderWidth: 1.5, borderColor: '#3B82F6', minWidth: 160, alignItems: 'center' },
  bitCardTitle: { fontSize: 13, fontWeight: '700', color: '#1D4ED8', marginBottom: 4 },
  bitCardAmount:{ fontSize: 24, fontWeight: '900', color: '#1D4ED8', marginBottom: 10 },
  bitBtn:       { backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  bitBtnText:   { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  chatRow:      { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.blueBorder },
  chatInput:    { flex: 1, backgroundColor: C.bluePale, borderRadius: 10, padding: 10, fontSize: 14, color: C.textDark, borderWidth: 1, borderColor: C.blueBorder },
  sendBtn:      { width: 42, height: 42, backgroundColor: C.blue, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  // Date / Time / Recurring / Promo
  dateBtn:       { backgroundColor: C.white, borderRadius: 10, padding: 13, borderWidth: 1, borderColor: C.blueBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateBtnText:   { fontSize: 15, fontWeight: '700', color: C.textDark },
  timeSlotBtn:   { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.blueBorder },
  timeSlotBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  timeSlotText:  { fontSize: 12, fontWeight: '700', color: C.textDark },
  recurBtn:      { flex: 1, backgroundColor: C.white, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: C.blueBorder },
  recurBtnActive:{ backgroundColor: C.blue, borderColor: C.blue },
  recurBtnText:  { fontSize: 12, fontWeight: '700', color: C.textDark },
  promoRow:      { flexDirection: 'row', gap: 8, alignItems: 'center' },
  promoBtn:      { backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13 },
  promoBtnText:  { fontSize: 13, fontWeight: '800', color: C.white },
  // Badges
  badgePill:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgePillText: { fontSize: 10, fontWeight: '800' },
  freeCommissionBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#6EE7B7' },
  freeCommissionBadgeText: { fontSize: 10, fontWeight: '800', color: '#065F46' },
  freeBanner:      { backgroundColor: '#ECFDF5', borderRadius: 12, marginHorizontal: 0, marginBottom: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#6EE7B7' },
  freeBannerTitle: { fontSize: 15, fontWeight: '900', color: '#065F46', textAlign: 'center' },
  freeBannerSub:   { fontSize: 13, color: '#047857', textAlign: 'center', marginTop: 2 },
});

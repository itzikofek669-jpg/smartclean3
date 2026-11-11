import React, { createContext, useContext, useEffect, useState } from 'react';
import { setTrLang } from './trNow';
import { useLangSync } from './langSync';
import { Text as RNText, TextProps, StyleSheet as RNStyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import translations, { Lang, Translations } from './translations';

export type TextScale = 1 | 1.15 | 1.3;

type LanguageContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
  isRTL: boolean;
  flipSide: boolean;
  setFlipSide: (v: boolean) => void;
  textScale: TextScale;
  setTextScale: (v: TextScale) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
};

const VALID_LANGS: Lang[] = ['he', 'en', 'ru', 'ar', 'fr', 'hi', 'uk'];
const STORAGE_KEY    = 'app_lang';
const FLIP_KEY       = 'flip_side';
const SCALE_KEY      = 'text_scale';
const CONTRAST_KEY   = 'high_contrast';

const LanguageContext = createContext<LanguageContextType>({
  lang: 'he',
  setLang: () => {},
  t: translations.he,
  isRTL: true,
  flipSide: false,
  setFlipSide: () => {},
  textScale: 1,
  setTextScale: () => {},
  highContrast: false,
  setHighContrast: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang,         setLangState]         = useState<Lang>('he');
  const [flipSide,     setFlipSideState]     = useState(false);
  const [textScale,    setTextScaleState]    = useState<TextScale>(1);
  const [highContrast, setHighContrastState] = useState(false);
  const [langLoaded,   setLangLoaded]          = useState(false);
  useLangSync(lang, langLoaded);

  useEffect(() => {
    (async () => {
      const savedLang = await SecureStore.getItemAsync(STORAGE_KEY).catch(() => null);
      if (savedLang && VALID_LANGS.includes(savedLang as Lang)) { setLangState(savedLang as Lang); setTrLang(savedLang as Lang); }

      const savedFlip = await SecureStore.getItemAsync(FLIP_KEY).catch(() => null);
      if (savedFlip === 'true') setFlipSideState(true);

      const savedScale = await SecureStore.getItemAsync(SCALE_KEY).catch(() => null);
      if (savedScale) setTextScaleState(parseFloat(savedScale) as TextScale);

      const savedContrast = await SecureStore.getItemAsync(CONTRAST_KEY).catch(() => null);
      if (savedContrast === 'true') setHighContrastState(true);
      setLangLoaded(true);
    })();
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    setTrLang(l);
    SecureStore.setItemAsync(STORAGE_KEY, l).catch(() => {});
  };

  const setFlipSide = (v: boolean) => {
    setFlipSideState(v);
    SecureStore.setItemAsync(FLIP_KEY, v ? 'true' : 'false').catch(() => {});
  };

  const setTextScale = (v: TextScale) => {
    setTextScaleState(v);
    SecureStore.setItemAsync(SCALE_KEY, String(v)).catch(() => {});
  };

  const setHighContrast = (v: boolean) => {
    setHighContrastState(v);
    SecureStore.setItemAsync(CONTRAST_KEY, v ? 'true' : 'false').catch(() => {});
  };

  return (
    <LanguageContext.Provider value={{
      lang, setLang,
      t: translations[lang],
      isRTL: lang === 'he' || lang === 'ar',
      flipSide, setFlipSide,
      textScale, setTextScale,
      highContrast, setHighContrast,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** מכפיל גודל גופן לפי הגדרת הנגישות */
export function useFS() {
  const { textScale } = useContext(LanguageContext);
  return (base: number) => Math.round(base * textScale);
}

/**
 * T — רכיב Text שמכפיל fontSize אוטומטית לפי textScale מהקונטקסט.
 * משמש במקום <Text> בכל האפליקציה — כל שאר ה-props עוברים ישירות.
 *
 * בעברית ובערבית טקסט בלי textAlign משלו מיושר לימין. האפליקציה לא קוראת ל-
 * I18nManager.forceRTL, ולכן ברירת המחדל של RN הייתה שמאל: כרטיסים שלמים
 * (תאריך, סוג הניקיון, פירוט, כתובת) נראו משמאל לימין. טקסט מקונן בתוך T אחר
 * לא מקבל יישור — ב-iOS היישור של התו הראשון בפסקה קובע לכל הפסקה, וכותרת
 * ממורכזת עם מילה מודגשת בתחילתה הייתה זזה לימין.
 */
const InsideText = createContext(false);

export function T({ style, children, ...props }: TextProps) {
  const { textScale, lang } = useContext(LanguageContext);
  const nested = useContext(InsideText);
  const needsDevanagari = lang === 'hi' &&
    typeof children === 'string' &&
    /[ऀ-ॿ]/.test(children);
  const hiFont = needsDevanagari ? { fontFamily: 'NotoSansDevanagari_400Regular' } : {};
  const flat: any = style ? RNStyleSheet.flatten(style) ?? {} : {};
  // Every language. In the five left-to-right ones the root is mirrored
  // (LayoutDirection in app/_layout.tsx) and Android swaps a Text's left and
  // right under it — so Hebrew's 'right' comes out left there, and text with
  // no alignment of its own (which would start from the mirrored right) is
  // given the same 'right' to land on the left.
  const rtlAlign = !nested && flat.textAlign == null ? { textAlign: 'right' as const } : null;

  // הינדי: הקטנת פונט אוטומטית אם הטקסט לא מתאים לכפתור
  const hiAdjust = needsDevanagari && !props.numberOfLines
    ? { adjustsFontSizeToFit: true, numberOfLines: 2, minimumFontScale: 0.65 }
    : {};

  const inner = nested ? children : <InsideText.Provider value>{children}</InsideText.Provider>;
  if (textScale === 1) return <RNText style={[hiFont, style, rtlAlign]} {...hiAdjust} {...props}>{inner}</RNText>;
  const scaled = flat.fontSize != null
    ? { ...flat, ...hiFont, ...rtlAlign, fontSize: Math.round(flat.fontSize * textScale) }
    : { ...flat, ...hiFont, ...rtlAlign };
  return <RNText style={scaled} {...hiAdjust} {...props}>{inner}</RNText>;
}

/**
 * שורות (flexDirection: 'row') בגיליון סגנונות — בעברית ובערבית הפוכות, כדי שהפריט
 * הראשון יעמוד מימין. האפליקציה לא מפעילה RTL של המערכת, ולכן כל שורה שלא הופכים
 * נשארת משמאל לימין. מקבלים רק את המפתחות שצריך: יש שורות שכבר נכתבו הפוכות.
 */
export function rtlRows<S extends Record<string, any>>(styles: S, _isRTL: boolean, keys: (keyof S)[]): S {
  // Always: the app is laid out right to left, and the five left-to-right
  // languages get the whole tree mirrored at the root (LayoutDirection in
  // app/_layout.tsx) — flipping here too would undo it.
  const out: any = { ...styles };
  for (const k of keys) {
    if (out[k] && out[k].flexDirection === 'row') out[k] = { ...out[k], flexDirection: 'row-reverse' };
  }
  return out;
}

/**
 * צבעי ניגודיות גבוהה — שחור על לבן (WCAG AAA ≥ 7:1)
 * לא "מצב לילה" — רקע בהיר עם טקסט כהה וגבולות שחורים בולטים
 */
export const HC = {
  bg:      '#FFFFFF',   // רקע לבן נקי
  card:    '#F0F0F0',   // כרטיסים — אפור בהיר
  text:    '#000000',   // טקסט שחור מלא
  sub:     '#1A1A1A',   // טקסט משני — כמעט שחור
  border:  '#000000',   // גבול שחור עבה
  blue:    '#0040CC',   // כחול כהה — ניגודיות גבוהה על לבן
  red:     '#B30000',   // אדום כהה
  green:   '#005C00',   // ירוק כהה
};

export function useHighContrast() {
  const { highContrast } = useContext(LanguageContext);
  return highContrast;
}

export type AppColors = {
  blue: string; blueDark: string; blueLight: string; bluePale: string;
  blueBorder: string; textDark: string; textMid: string; textSub: string;
  green: string; greenBg: string; gold: string; orange: string; orangeBg: string;
  white: string; grayBg: string; grayBorder: string; error: string;
  bg: string; card: string;
  // shorthand aliases
  text: string; sub: string;
};

const NORMAL_COLORS: AppColors = {
  blue:       '#185FA5',
  blueDark:   '#0D4F96',
  blueLight:  '#E6F1FB',
  bluePale:   '#FAF7F2',
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
  grayBg:     '#F1F5F9',
  grayBorder: '#E2EAF3',
  error:      '#EF4444',
  bg:         '#FAF7F2',
  card:       '#FFFFFF',
  text:       '#042C53',
  sub:        '#6B9DC2',
};

const HC_COLORS: AppColors = {
  blue:       '#0040CC',
  blueDark:   '#002080',
  blueLight:  '#FFFFFF',
  bluePale:   '#FFFFFF',
  blueBorder: '#000000',
  textDark:   '#000000',
  textMid:    '#000000',
  textSub:    '#1A1A1A',
  green:      '#005C00',
  greenBg:    '#CCFFCC',
  gold:       '#7A4800',
  orange:     '#7A2E00',
  orangeBg:   '#FFE0CC',
  white:      '#FFFFFF',
  grayBg:     '#FFFFFF',
  grayBorder: '#000000',
  error:      '#B30000',
  bg:         '#FFFFFF',
  card:       '#F0F0F0',
  text:       '#000000',
  sub:        '#1A1A1A',
};

export function useAppColors(): AppColors {
  const { highContrast } = useContext(LanguageContext);
  return highContrast ? HC_COLORS : NORMAL_COLORS;
}

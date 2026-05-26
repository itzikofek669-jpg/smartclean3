import React, { createContext, useContext, useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import translations, { Lang, Translations } from './translations';

// ─── Color Palette ───────────────────────────────────────────────────────────
export type AppColors = {
  blue: string; blueDark: string; blueLight: string; bluePale: string;
  blueBorder: string; textDark: string; textMid: string; textSub: string;
  gold: string; green: string; greenBg: string; white: string;
  grayBg: string; grayBorder: string;
  orange: string; bg: string; error: string;
};

const DEFAULT_COLORS: AppColors = {
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
  orange:     '#F97316',
  bg:         '#F8F9FA',
  error:      '#EF4444',
};

export function useAppColors(): AppColors {
  return DEFAULT_COLORS;
}

// ─── Scaled Text Component ────────────────────────────────────────────────────
export function T({ style, children, ...props }: TextProps) {
  const { textScale } = useLanguage();
  const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.map(s => s || {})) : (style || {});
  const baseFontSize = (flatStyle as any).fontSize ?? 14;
  return (
    <Text style={[style, { fontSize: baseFontSize * textScale }]} {...props}>
      {children}
    </Text>
  );
}

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

const VALID_LANGS: Lang[] = ['he', 'en', 'ru', 'ar', 'fr', 'hi'];
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

  useEffect(() => {
    (async () => {
      const savedLang = await SecureStore.getItemAsync(STORAGE_KEY).catch(() => null);
      if (savedLang && VALID_LANGS.includes(savedLang as Lang)) setLangState(savedLang as Lang);

      const savedFlip = await SecureStore.getItemAsync(FLIP_KEY).catch(() => null);
      if (savedFlip === 'true') setFlipSideState(true);

      const savedScale = await SecureStore.getItemAsync(SCALE_KEY).catch(() => null);
      if (savedScale) setTextScaleState(parseFloat(savedScale) as TextScale);

      const savedContrast = await SecureStore.getItemAsync(CONTRAST_KEY).catch(() => null);
      if (savedContrast === 'true') setHighContrastState(true);
    })();
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
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

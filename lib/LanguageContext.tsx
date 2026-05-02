import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import translations, { Lang, Translations } from './translations';

type LanguageContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
  isRTL: boolean;
};

const VALID_LANGS: Lang[] = ['he', 'en', 'ru', 'ar', 'fr', 'hi'];
const STORAGE_KEY = 'app_lang';

const LanguageContext = createContext<LanguageContextType>({
  lang: 'he',
  setLang: () => {},
  t: translations.he,
  isRTL: true,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('he');

  // Load persisted language on mount
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then(v => {
      if (v && VALID_LANGS.includes(v as Lang)) {
        setLangState(v as Lang);
      }
    }).catch(() => {});
  }, []);

  // Save + update state when language changes
  const setLang = (l: Lang) => {
    setLangState(l);
    SecureStore.setItemAsync(STORAGE_KEY, l).catch(() => {});
  };

  return (
    <LanguageContext.Provider value={{
      lang,
      setLang,
      t: translations[lang],
      isRTL: lang === 'he' || lang === 'ar',
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

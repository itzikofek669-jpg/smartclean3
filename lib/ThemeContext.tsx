import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export const LIGHT = {
  bg:       '#F4F8FD',
  card:     '#FFFFFF',
  text:     '#042C53',
  subtext:  '#6B9DC2',
  border:   '#B5D4F4',
  primary:  '#185FA5',
  accent:   '#10B981',
  danger:   '#EF4444',
  inputBg:  '#FFFFFF',
  header:   '#0D4F96',
  headerText: '#FFFFFF',
  statusBar: 'light-content' as 'light-content' | 'dark-content',
};

export const DARK = {
  bg:       '#0F172A',
  card:     '#1E293B',
  text:     '#F1F5F9',
  subtext:  '#94A3B8',
  border:   '#334155',
  primary:  '#3B82F6',
  accent:   '#34D399',
  danger:   '#F87171',
  inputBg:  '#1E293B',
  header:   '#0F172A',
  headerText: '#F1F5F9',
  statusBar: 'light-content' as 'light-content' | 'dark-content',
};

export type ThemeColors = typeof LIGHT;

type ThemeCtx = {
  colors: ThemeColors;
  dark: boolean;
  toggleDark: () => void;
};

const ThemeContext = createContext<ThemeCtx>({
  colors: LIGHT,
  dark: false,
  toggleDark: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('darkMode').then(v => {
      if (v === 'true') setDark(true);
    }).catch(() => {});
  }, []);

  const toggleDark = () => {
    setDark(prev => {
      const next = !prev;
      SecureStore.setItemAsync('darkMode', next ? 'true' : 'false').catch(() => {});
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ colors: dark ? DARK : LIGHT, dark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext);
}

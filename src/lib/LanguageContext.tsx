'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Language = 'en' | 'zh';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'amd:lang';

interface LanguageProviderProps {
  initial?: Language;
  children: ReactNode;
}

export function LanguageProvider({ initial = 'en', children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(initial);

  // One-shot hydration of stored preference. SSR renders `initial`, then the
  // client swaps in the persisted value if present. Intentional setState inside
  // effect — localStorage is not observable, so there's nothing to subscribe to.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const toggle = useCallback(() => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  }, [language, setLanguage]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, toggle }),
    [language, setLanguage, toggle],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}

export function pickLocalized(en: string, zh: string | null | undefined, lang: Language): string {
  if (lang === 'zh' && zh) return zh;
  return en;
}

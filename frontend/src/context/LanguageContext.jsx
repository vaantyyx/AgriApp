// @ts-check
import React, { createContext, useState, useEffect, useContext } from 'react';
import { translations } from '../i18n/translations';

/**
 * @typedef {Object} LanguageContextValue
 * @property {string} locale
 * @property {(lang: string) => void} setLocale
 * @property {(key: string, replacements?: Record<string, unknown>) => string} t
 * @property {'ltr'|'rtl'} dir
 */

/** @type {import('react').Context<LanguageContextValue|null>} */
const LanguageContext = createContext(null);

/** @param {{ children: import('react').ReactNode }} props */
export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    try {
      return localStorage.getItem('sougra_lang') || 'ar';
    } catch {
      return 'ar';
    }
  });

  const setLocale = (lang) => {
    if (translations[lang]) {
      setLocaleState(lang);
      try {
        localStorage.setItem('sougra_lang', lang);
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
    }
  };

  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key, replacements) => {
    let text = translations[locale]?.[key] || translations['ar']?.[key] || key;
    
    if (replacements && typeof replacements === 'object') {
      Object.entries(replacements).forEach(([k, val]) => {
        text = text.replace(new RegExp(`{${k}}`, 'g'), val);
      });
    }
    return text;
  };

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

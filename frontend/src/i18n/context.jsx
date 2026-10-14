import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, LOCALES, translations } from './translations.js';

const LOCALE_KEY = 'sumi.ui.idioma';
const LanguageContext = createContext(null);

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    return LOCALES.includes(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (vars[key] !== undefined ? String(vars[key]) : match));
}

const HTML_LANG = { pt: 'pt-BR', en: 'en', es: 'es' };

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(readStoredLocale);
  useEffect(() => { document.documentElement.lang = HTML_LANG[locale] || locale; }, [locale]);

  const value = useMemo(() => {
    function setLocale(next) {
      if (!LOCALES.includes(next)) return;
      setLocaleState(next);
      try { localStorage.setItem(LOCALE_KEY, next); } catch { /* armazenamento indisponível */ }
    }
    function t(key, vars) {
      const template = translations[locale]?.[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
      return interpolate(template, vars);
    }
    return { locale, setLocale, t };
  }, [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation deve ser usado dentro de LanguageProvider');
  return context;
}

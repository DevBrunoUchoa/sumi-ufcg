import { LOCALES, LOCALE_LABELS } from './translations.js';
import { useTranslation } from './context.jsx';

export function LanguageSelector({ className = '' }) {
  const { locale, setLocale, t } = useTranslation();
  return (
    <label className={`sumi-language-selector ${className}`}>
      <span className="sr-only">{t('shell.language.label')}</span>
      <select value={locale} onChange={(event) => setLocale(event.target.value)} aria-label={t('shell.language.label')}>
        {LOCALES.map((code) => <option key={code} value={code}>{LOCALE_LABELS[code]}</option>)}
      </select>
    </label>
  );
}

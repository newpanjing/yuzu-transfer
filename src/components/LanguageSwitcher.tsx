import { Languages } from 'lucide-react';
import { LANGUAGE_OPTIONS, useI18n, type LanguagePreference } from '../lib/i18n';

type Props = { className?: string };

export function LanguageSwitcher({ className }: Props) {
  const { language, setLanguage, t } = useI18n();

  return (
    <label className={className ?? 'language-switcher'}>
      <span className="language-switcher__label"><Languages size={16} /> {t('header.languageLabel')}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as LanguagePreference)} aria-label={t('header.languageLabel')}>
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option} value={option}>{t(`language.option.${option}` as const)}</option>
        ))}
      </select>
    </label>
  );
}

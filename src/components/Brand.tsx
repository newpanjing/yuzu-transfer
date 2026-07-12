import { Citrus } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export function Brand() {
  const { t } = useI18n();
  return <div className="brand"><span className="brand-mark"><Citrus size={20} /></span><strong>{t('brand.appName')}</strong><span className="mode-tag">{t('brand.mode')}</span></div>;
}

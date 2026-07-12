import { Citrus } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export function Brand() {
  const { t } = useI18n();
  return <div className="brand"><span className="brand-mark"><Citrus size={18} /></span><span className="brand-copy"><strong>{t('brand.appName')}</strong><small>{t('header.meta')}</small></span></div>;
}

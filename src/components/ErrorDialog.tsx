import { AlertCircle, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

type Props = { message: string; onClose: () => void };
export function ErrorDialog({ message, onClose }: Props) { const { t } = useI18n(); return <div className="dialog-backdrop" role="presentation"><section className="error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title"><button className="dialog-close" onClick={onClose} aria-label={t('dialog.error.close')}><X size={18} /></button><span className="dialog-icon"><AlertCircle size={25} /></span><h2 id="dialog-title">{t('dialog.error.title')}</h2><p>{message}</p><button className="primary-button" onClick={onClose}>{t('dialog.error.confirm')}</button></section></div>; }

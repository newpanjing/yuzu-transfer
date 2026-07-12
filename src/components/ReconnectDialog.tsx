import { AlertCircle, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

type Props = {
  connecting: boolean;
  message?: string;
  onClose: () => void;
  onRetry: () => void;
};

export function ReconnectDialog({ connecting, message, onClose, onRetry }: Props) {
  const { t } = useI18n();
  return <div className="dialog-backdrop reconnect-dialog-backdrop" role="presentation">
    <section className="reconnect-dialog" role="dialog" aria-modal="true" aria-live="polite">
      {connecting ? <LoaderCircle className="reconnect-dialog__spinner" size={30} /> : <AlertCircle className="reconnect-dialog__error" size={30} />}
      <h2>{t(connecting ? 'dialog.reconnect.connectingTitle' : 'dialog.reconnect.failedTitle')}</h2>
      <p>{connecting ? t('dialog.reconnect.connectingBody') : message ?? t('dialog.reconnect.failedBody')}</p>
      {!connecting && <div className="reconnect-dialog__actions"><button type="button" className="text-button" onClick={onClose}><X size={16} />{t('dialog.reconnect.close')}</button><button type="button" className="primary-button" onClick={onRetry}><RefreshCw size={16} />{t('dialog.reconnect.retry')}</button></div>}
    </section>
  </div>;
}

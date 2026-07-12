import { Pause, Play, RotateCw, X } from 'lucide-react';
import { TRANSFER_STATUS } from '../constants';
import { useI18n } from '../lib/i18n';
import type { TransferStatus } from '../types';

type Props = {
  status?: TransferStatus;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

export function TransferQueueActions({ status, onPause, onResume, onCancel, onRetry }: Props) {
  const { t } = useI18n();
  if (!status || status === TRANSFER_STATUS.completed || status === TRANSFER_STATUS.cancelled) return null;

  return <span className="transfer-actions">
    {status === TRANSFER_STATUS.transferring && <button type="button" onClick={onPause} aria-label={t('workspace.transfer.pause')} title={t('workspace.transfer.pause')}><Pause size={15} /></button>}
    {status === TRANSFER_STATUS.paused && <button type="button" onClick={onResume} aria-label={t('workspace.transfer.resume')} title={t('workspace.transfer.resume')}><Play size={15} /></button>}
    {status === TRANSFER_STATUS.failed && <button type="button" onClick={onRetry} aria-label={t('workspace.transfer.retry')} title={t('workspace.transfer.retry')}><RotateCw size={15} /></button>}
    {status !== TRANSFER_STATUS.failed && <button type="button" onClick={onCancel} aria-label={t('workspace.transfer.cancel')} title={t('workspace.transfer.cancel')}><X size={15} /></button>}
  </span>;
}

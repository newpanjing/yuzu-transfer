import { Download, FolderOpen, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { TransferItem } from '../types';

type Props = { item: TransferItem; onClose: () => void };
type FileSystemWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }> };

export async function saveTransferItem(item: TransferItem, onClose?: () => void) {
  try {
    if (!item.objectUrl) return;
    const blob = await fetch(item.objectUrl).then((response) => response.blob());
    const fileWindow = window as FileSystemWindow;
    if (fileWindow.showSaveFilePicker) {
      const handle = await fileWindow.showSaveFilePicker({ suggestedName: item.name });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      onClose?.();
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = item.objectUrl;
    anchor.download = item.name;
    anchor.click();
    onClose?.();
  } catch {
    return;
  }
}

export function FileSaveDialog({ item, onClose }: Props) {
  const { t } = useI18n();
  return <div className="dialog-backdrop"><section className="file-save-dialog" role="dialog" aria-modal="true"><button className="dialog-close" onClick={onClose} aria-label={t('dialog.file.close')}><X size={18} /></button><span className="dialog-icon"><Download size={25} /></span><h2>{t('dialog.file.title')}</h2><p>{item.name}</p><button className="primary-button" onClick={() => void saveTransferItem(item, onClose)}><FolderOpen size={17} /> {t('dialog.file.action')}</button></section></div>;
}

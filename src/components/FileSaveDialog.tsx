import { Download, FolderOpen, X } from 'lucide-react';
import type { TransferItem } from '../types';

type Props = { item: TransferItem; onClose: () => void };
type FileSystemWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }> };

export function FileSaveDialog({ item, onClose }: Props) {
  const save = async () => { try { if (!item.objectUrl) return; const blob = await fetch(item.objectUrl).then((response) => response.blob()); const fileWindow = window as FileSystemWindow; if (fileWindow.showSaveFilePicker) { const handle = await fileWindow.showSaveFilePicker({ suggestedName: item.name }); const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); onClose(); return; } const anchor = document.createElement('a'); anchor.href = item.objectUrl; anchor.download = item.name; anchor.click(); onClose(); } catch { return; } };
  return <div className="dialog-backdrop"><section className="file-save-dialog" role="dialog" aria-modal="true"><button className="dialog-close" onClick={onClose} aria-label="稍后保存"><X size={18} /></button><span className="dialog-icon"><Download size={25} /></span><h2>文件接收完成</h2><p>{item.name}</p><button className="primary-button" onClick={() => void save()}><FolderOpen size={17} /> 选择保存位置</button></section></div>;
}

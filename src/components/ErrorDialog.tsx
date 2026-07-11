import { AlertCircle, X } from 'lucide-react';

type Props = { message: string; onClose: () => void };
export function ErrorDialog({ message, onClose }: Props) { return <div className="dialog-backdrop" role="presentation"><section className="error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title"><button className="dialog-close" onClick={onClose} aria-label="关闭提示"><X size={18} /></button><span className="dialog-icon"><AlertCircle size={25} /></span><h2 id="dialog-title">无法连接设备</h2><p>{message}</p><button className="primary-button" onClick={onClose}>我知道了</button></section></div>; }

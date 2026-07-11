import { Citrus } from 'lucide-react';
import { APP_NAME } from '../constants';

export function Brand() { return <div className="brand"><span className="brand-mark"><Citrus size={20} /></span><strong>{APP_NAME}</strong><span className="mode-tag">无痕模式</span></div>; }

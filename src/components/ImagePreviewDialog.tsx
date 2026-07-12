import { Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../lib/i18n';

type Props = { src: string; alt: string; onClose: () => void };
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export function ImagePreviewDialog({ src, alt, onClose }: Props) { const [zoom, setZoom] = useState(1); const { t } = useI18n(); return <div className="image-preview-backdrop" onClick={onClose}><section className="image-preview-dialog" onClick={(event) => event.stopPropagation()}><div className="preview-toolbar"><button onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))} aria-label={t('dialog.preview.zoomOut')}><Minus size={19} /></button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))} aria-label={t('dialog.preview.zoomIn')}><Plus size={19} /></button><button onClick={onClose} aria-label={t('dialog.preview.close')}><X size={19} /></button></div><img src={src} alt={alt} style={{ transform: `scale(${zoom})` }} /></section></div>; }

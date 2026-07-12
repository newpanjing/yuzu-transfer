import { Check, Copy, MonitorSmartphone, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { PairingCode } from './PairingCode';
import { LanDeviceList } from './LanDeviceList';
import { VerificationCodeDisplay } from './VerificationCodeDisplay';
import type { LanDevice } from '../types';

type Props = { pairingCode: string; qrValue: string; invitationText: string; joinCode: string; lanDevices: LanDevice[]; onJoinCodeChange: (code: string) => void; onJoin: () => void; onConnectLanDevice: (device: LanDevice) => void; onRefresh: () => void; busy: boolean };
const QR_CODE_SIZE = 166;
const QR_EXPORT_DELAY_MS = 60;

export function ConnectionPanel({ pairingCode, qrValue, invitationText, joinCode, lanDevices, onJoinCodeChange, onJoin, onConnectLanDevice, onRefresh, busy }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [qrImage, setQrImage] = useState('');
  const qrHost = useRef<HTMLDivElement>(null);
  const copyInvitation = async () => { try { if (!navigator.clipboard) throw new Error('clipboard unavailable'); await navigator.clipboard.writeText(invitationText); } catch { const input = document.createElement('textarea'); input.value = invitationText; document.body.append(input); input.select(); document.execCommand('copy'); input.remove(); } setCopied(true); };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvas = qrHost.current?.querySelector('canvas');
      if (!canvas) return;
      setQrImage(canvas.toDataURL('image/png'));
    }, QR_EXPORT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [qrValue]);

  return <section className="connection-panel">{lanDevices.length > 0 && <><LanDeviceList devices={lanDevices} busy={busy} onConnect={onConnectLanDevice} /><div className="connection-divider" /></>}<div className="connection-section connection-section--code"><span className="connection-icon"><MonitorSmartphone size={21} /></span><div className="connection-copy"><h2>{t('connect.myCode.title')}</h2><p>{t('connect.myCode.subtitle')}</p></div><VerificationCodeDisplay code={pairingCode} /><div className="connection-actions connection-actions--stacked"><button className="text-button" onClick={() => void copyInvitation()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t('connect.copied') : t('connect.copy')}</button><button className="text-button refresh-button" onClick={onRefresh}><RefreshCw size={14} /> {t('connect.refresh')}</button></div></div><div className="connection-divider" /><div className="connection-section qr-section"><span className="connection-icon"><QrCode size={21} /></span><div className="connection-copy"><h2>{t('connect.qr.title')}</h2><p>{t('connect.qr.subtitle')}</p></div><div className="qr-frame">{qrImage ? <img className="qr-image" src={qrImage} alt={t('connect.qr.alt')} /> : <div className="qr-placeholder" />}<div ref={qrHost} className="qr-canvas-host" aria-hidden="true"><QRCodeCanvas value={qrValue} size={QR_CODE_SIZE} bgColor="#ffffff" fgColor="#161b20" level="M" includeMargin /></div></div><p className="qr-tip">{t('connect.qr.tip')}</p></div><div className="connection-divider" /><div className="connection-section join-section"><span className="connection-icon"><Smartphone size={21} /></span><div className="connection-copy"><h2>{t('connect.join.title')}</h2><p>{t('connect.join.subtitle')}</p></div><PairingCode value={joinCode} onChange={onJoinCodeChange} /><button className="primary-button" disabled={joinCode.length !== 4 || busy} onClick={onJoin}>{busy ? t('connect.join.busy') : t('connect.join.action')}</button></div></section>;
}

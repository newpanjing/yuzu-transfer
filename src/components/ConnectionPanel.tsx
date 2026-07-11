import { Check, Copy, MonitorSmartphone, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { PairingCode } from './PairingCode';
import { VerificationCodeDisplay } from './VerificationCodeDisplay';

type Props = { pairingCode: string; qrValue: string; invitationText: string; joinCode: string; onJoinCodeChange: (code: string) => void; onJoin: () => void; onRefresh: () => void; busy: boolean };
const COPY_LABEL = '复制邀请链接';
const COPIED_LABEL = '已复制';

export function ConnectionPanel({ pairingCode, qrValue, invitationText, joinCode, onJoinCodeChange, onJoin, onRefresh, busy }: Props) {
  const [copied, setCopied] = useState(false);
  const copyInvitation = async () => { try { if (!navigator.clipboard) throw new Error('clipboard unavailable'); await navigator.clipboard.writeText(invitationText); } catch { const input = document.createElement('textarea'); input.value = invitationText; document.body.append(input); input.select(); document.execCommand('copy'); input.remove(); } setCopied(true); };
  return <section className="connection-panel"><div className="connection-section"><span className="connection-icon"><MonitorSmartphone size={21} /></span><div className="connection-copy"><h2>我的验证码</h2><p>在另一台设备上输入此四位数</p></div><VerificationCodeDisplay code={pairingCode} /><button className="text-button" onClick={() => void copyInvitation()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? COPIED_LABEL : COPY_LABEL}</button><button className="text-button refresh-button" onClick={onRefresh}><RefreshCw size={14} /> 刷新</button></div><div className="connection-divider" /><div className="connection-section qr-section"><span className="connection-icon"><QrCode size={21} /></span><div className="connection-copy"><h2>扫描二维码</h2><p>使用手机相机扫描，自动开始连接</p></div><div className="qr-frame"><QRCodeSVG value={qrValue} size={166} bgColor="#ffffff" fgColor="#161b20" level="M" includeMargin /></div></div><div className="connection-divider" /><div className="connection-section join-section"><span className="connection-icon"><Smartphone size={21} /></span><div className="connection-copy"><h2>输入验证码</h2><p>输入另一台设备的四位验证码</p></div><PairingCode value={joinCode} onChange={onJoinCodeChange} /><button className="primary-button" disabled={joinCode.length !== 4 || busy} onClick={onJoin}>{busy ? '正在连接...' : '加入设备'}</button></div></section>;
}

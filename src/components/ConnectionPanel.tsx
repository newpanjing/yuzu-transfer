import { MonitorSmartphone, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PairingCode } from './PairingCode';

type Props = { pairingCode: string; qrValue: string; joinCode: string; onJoinCodeChange: (code: string) => void; onJoin: () => void; onRefresh: () => void; busy: boolean };

export function ConnectionPanel({ pairingCode, qrValue, joinCode, onJoinCodeChange, onJoin, onRefresh, busy }: Props) {
  return <section className="connection-panel"><div className="connection-section"><span className="connection-icon"><MonitorSmartphone size={21} /></span><div className="connection-copy"><h2>我的验证码</h2><p>在另一台设备上输入此四位数</p></div><PairingCode value={pairingCode} onChange={() => undefined} readOnly /><button className="text-button refresh-button" onClick={onRefresh}><RefreshCw size={14} /> 刷新</button></div><div className="connection-divider" /><div className="connection-section qr-section"><span className="connection-icon"><QrCode size={21} /></span><div className="connection-copy"><h2>扫描二维码</h2><p>使用手机相机扫描，自动开始连接</p></div><div className="qr-frame"><QRCodeSVG value={qrValue} size={166} bgColor="#ffffff" fgColor="#161b20" level="M" includeMargin /></div></div><div className="connection-divider" /><div className="connection-section join-section"><span className="connection-icon"><Smartphone size={21} /></span><div className="connection-copy"><h2>输入验证码</h2><p>输入另一台设备的四位验证码</p></div><PairingCode value={joinCode} onChange={onJoinCodeChange} /><button className="primary-button" disabled={joinCode.length !== 4 || busy} onClick={onJoin}>{busy ? '正在连接...' : '加入设备'}</button></div></section>;
}

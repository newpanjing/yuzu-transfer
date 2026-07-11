import { Smartphone } from 'lucide-react';
import { PairingCode } from './PairingCode';

type Props = { code: string; onChange: (code: string) => void; onJoin: () => void; busy: boolean };
export function JoinCard({ code, onChange, onJoin, busy }: Props) { return <section className="pairing-card"><div className="card-icon"><Smartphone size={25} /></div><h3>输入验证码</h3><p>输入另一台设备的<br />四位验证码</p><PairingCode value={code} onChange={onChange} /><button className="primary-button" disabled={code.length !== 4 || busy} onClick={onJoin}>{busy ? '正在连接...' : '连接设备'}</button></section>; }

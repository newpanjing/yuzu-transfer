import { MonitorSmartphone, RefreshCw } from 'lucide-react';
import { PairingCode } from './PairingCode';

type Props = { code: string; onRefresh: () => void };
export function PairingCard({ code, onRefresh }: Props) { return <section className="pairing-card"><div className="card-icon"><MonitorSmartphone size={25} /></div><h3>加入验证码</h3><p>在手机上输入此四位数<br />加入本设备</p><PairingCode value={code} onChange={() => undefined} readOnly /><button className="text-button" onClick={onRefresh}><RefreshCw size={14} /> 刷新验证码</button></section>; }

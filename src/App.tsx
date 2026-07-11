import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Monitor, ShieldCheck } from 'lucide-react';
import { Brand } from './components/Brand';
import { JoinCard } from './components/JoinCard';
import { PairingCard } from './components/PairingCard';
import { QrCard } from './components/QrCard';
import { Sidebar } from './components/Sidebar';
import { TransferWorkspace } from './components/TransferWorkspace';
import { createPairing, exchangePairing, getRelayLimit } from './lib/api';
import { getDeviceId, getNickname, saveNickname } from './lib/device';
import { DEFAULT_RELAY_LIMIT } from './constants';
import { PeerTransport, type IncomingTransfer } from './lib/peer';
import type { View } from './types';

export default function App() {
  const [view, setView] = useState<View>('connect'); const [deviceId] = useState(getDeviceId); const [nickname, setNickname] = useState(getNickname); const [peerNickname, setPeerNickname] = useState('新设备'); const [pairingCode, setPairingCode] = useState(''); const [joinCode, setJoinCode] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [relayLimit, setRelayLimit] = useState(DEFAULT_RELAY_LIMIT); const [transport, setTransport] = useState<PeerTransport>(); const [connected, setConnected] = useState(false); const [items, setItems] = useState<IncomingTransfer[]>([]); const autoJoinCode = useRef('');
  const refresh = async () => { try { setError(''); const pairing = await createPairing(deviceId); setPairingCode(pairing.code); } catch { setError('配对服务暂不可用，请确认 Go 服务已启动。'); } };
  useEffect(() => { void refresh(); void getRelayLimit().then((data) => setRelayLimit(data.relayMaxFileSize)).catch(() => undefined); }, []);
  useEffect(() => { const instance = new PeerTransport(deviceId, nickname, { onOpen: () => { setConnected(true); setView('transfer'); }, onClose: () => setConnected(false), onTransfer: (item) => setItems((current) => [...current, item]), onPeerName: setPeerNickname, onError: setError }); instance.connectSignaling(); setTransport(instance); return () => instance.close(); }, [deviceId]);
  useEffect(() => { const code = new URLSearchParams(location.search).get('code'); if (code && code.length === 4) { setJoinCode(code); autoJoinCode.current = code; } }, []);
  const join = async (code = joinCode) => { if (!transport) return; setBusy(true); setError(''); try { const result = await exchangePairing(code, deviceId); await transport.start(result.peerDeviceId); setView('transfer'); } catch { setError('验证码无效、已过期，或不能连接当前设备。'); } finally { setBusy(false); } };
  useEffect(() => { if (autoJoinCode.current && transport) { void join(autoJoinCode.current); autoJoinCode.current = ''; } }, [transport]);
  const changeNickname = (name: string) => { saveNickname(name); setNickname(name); };
  const qrValue = `${location.origin}?code=${pairingCode}`;
  return <div className="app-shell"><header><Brand /><div className="header-meta"><ShieldCheck size={17} /> 不登录 · 不存文件 · 不留记录</div></header><div className="app-body"><Sidebar active={view} onSelect={setView} />{view === 'connect' ? <main className="connect-view"><div className="view-heading"><span className="eyebrow"><BadgeCheck size={17} /> 安全直连</span><h1>连接新设备</h1><p>在手机上打开柚子快传，选择以下任一方式连接</p></div><div className="pairing-grid"><JoinCard code={joinCode} onChange={setJoinCode} onJoin={() => void join()} busy={busy} /><QrCard value={qrValue} /><PairingCard code={pairingCode} onRefresh={() => void refresh()} /></div>{error && <div className="error-banner">{error}</div>}<div className="privacy-banner"><ShieldCheck size={20} /><span><strong>无痕传输</strong> · 文件优先在设备间直连，不保存至服务器</span></div></main> : <TransferWorkspace nickname={peerNickname} onNicknameChange={changeNickname} relayLimit={relayLimit} transport={transport} connected={connected} items={items} onItemsChange={setItems} />}</div><footer><span>设备 ID：{deviceId.slice(0, 8)}</span><span><Monitor size={15} /> 当前设备已就绪</span><span><ShieldCheck size={16} /> 无痕模式已开启</span></footer></div>;
}

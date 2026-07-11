import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Monitor, ShieldCheck } from 'lucide-react';
import { Brand } from './components/Brand';
import { ConnectionPanel } from './components/ConnectionPanel';
import { Sidebar } from './components/Sidebar';
import { TransferWorkspace } from './components/TransferWorkspace';
import { DEFAULT_RELAY_LIMIT } from './constants';
import { createPairing, exchangePairing, getRelayLimit } from './lib/api';
import { loadConversations, saveConversations } from './lib/conversations';
import { getDeviceId, getNickname, saveNickname } from './lib/device';
import { PeerTransport } from './lib/peer';
import type { Conversation, TransferItem, View } from './types';

const DEFAULT_PEER_NICKNAME = '新设备';

export default function App() {
  const [view, setView] = useState<View>('connect');
  const [deviceId] = useState(getDeviceId);
  const [nickname, setNickname] = useState(getNickname);
  const [pairingCode, setPairingCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [relayLimit, setRelayLimit] = useState(DEFAULT_RELAY_LIMIT);
  const [transport, setTransport] = useState<PeerTransport>();
  const [connected, setConnected] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const activePeerRef = useRef<string | null>(null);
  const autoJoinCode = useRef('');

  const updateConversation = (deviceId: string, update: (conversation: Conversation) => Conversation) => {
    setConversations((current) => {
      const index = current.findIndex((conversation) => conversation.deviceId === deviceId);
      const base: Conversation = index < 0 ? { deviceId, nickname: DEFAULT_PEER_NICKNAME, messages: [], lastConnectedAt: new Date().toISOString() } : current[index];
      const next = update(base);
      return index < 0 ? [next, ...current] : [next, ...current.filter((conversation) => conversation.deviceId !== deviceId)];
    });
  };

  const addTransfer = (item: TransferItem) => {
    const deviceId = activePeerRef.current;
    if (deviceId) updateConversation(deviceId, (conversation) => ({ ...conversation, messages: [...conversation.messages, item], lastConnectedAt: new Date().toISOString() }));
  };

  const handlePeerId = (peerId: string) => {
    activePeerRef.current = peerId;
    setSelectedDeviceId(peerId);
    updateConversation(peerId, (conversation) => ({ ...conversation, lastConnectedAt: new Date().toISOString() }));
  };

  useEffect(() => { saveConversations(conversations); }, [conversations]);
  const refresh = async () => { try { setError(''); const pairing = await createPairing(deviceId); setPairingCode(pairing.code); } catch { setError('配对服务暂不可用，请确认 Go 服务已启动。'); } };
  useEffect(() => { void refresh(); void getRelayLimit().then((data) => setRelayLimit(data.relayMaxFileSize)).catch(() => undefined); }, []);
  useEffect(() => {
    const instance = new PeerTransport(deviceId, nickname, { onOpen: () => { setConnected(true); setView('transfer'); }, onClose: () => setConnected(false), onTransfer: addTransfer, onPeerId: handlePeerId, onPeerName: (name) => { const peerId = activePeerRef.current; if (peerId) updateConversation(peerId, (conversation) => ({ ...conversation, nickname: name })); }, onError: setError });
    instance.connectSignaling(); setTransport(instance); return () => instance.close();
  }, [deviceId]);
  useEffect(() => { const code = new URLSearchParams(location.search).get('code'); if (code?.length === 4) { setJoinCode(code); autoJoinCode.current = code; } }, []);
  const join = async (code = joinCode) => { if (!transport) return; setBusy(true); setError(''); try { const result = await exchangePairing(code, deviceId); await transport.start(result.peerDeviceId); setView('transfer'); } catch { setError('验证码无效、已过期，或不能连接当前设备。'); } finally { setBusy(false); } };
  useEffect(() => { if (autoJoinCode.current && transport) { void join(autoJoinCode.current); autoJoinCode.current = ''; } }, [transport]);
  const changeNickname = (name: string) => { saveNickname(name); setNickname(name); };
  const selectedConversation = conversations.find((conversation) => conversation.deviceId === selectedDeviceId);
  const selectedMessages = selectedConversation?.messages ?? [];
  const updateSelectedMessages = (next: TransferItem[] | ((current: TransferItem[]) => TransferItem[])) => { if (!selectedDeviceId) return; updateConversation(selectedDeviceId, (conversation) => ({ ...conversation, messages: typeof next === 'function' ? next(conversation.messages) : next })); };
  const isSelectedConnected = connected && activePeerRef.current === selectedDeviceId;
  const qrValue = `${location.origin}?code=${pairingCode}`;
  return <div className="app-shell"><header><Brand /><div className="header-meta"><ShieldCheck size={17} /> 不登录 · 不存文件 · 不留记录</div></header><div className="app-body"><Sidebar conversations={conversations} activeDeviceId={selectedDeviceId} onConnect={() => setView('connect')} onSelect={(deviceId) => { setSelectedDeviceId(deviceId); setView('transfer'); }} />{view === 'connect' ? <main className="connect-view"><div className="view-heading"><span className="eyebrow"><BadgeCheck size={17} /> 安全直连</span><h1>连接新设备</h1><p>在手机上打开柚子快传，扫描二维码或输入验证码连接</p></div><ConnectionPanel pairingCode={pairingCode} qrValue={qrValue} joinCode={joinCode} onJoinCodeChange={setJoinCode} onJoin={() => void join()} onRefresh={() => void refresh()} busy={busy} />{error && <div className="error-banner">{error}</div>}<div className="privacy-banner"><ShieldCheck size={20} /><span><strong>无痕传输</strong> · 文件优先在设备间直连，不保存至服务器</span></div></main> : <TransferWorkspace nickname={selectedConversation?.nickname ?? DEFAULT_PEER_NICKNAME} onNicknameChange={changeNickname} relayLimit={relayLimit} transport={transport} connected={isSelectedConnected} items={selectedMessages} onItemsChange={updateSelectedMessages} />}</div><footer><span>设备 ID：{deviceId.slice(0, 8)}</span><span><Monitor size={15} /> 当前设备已就绪</span><span><ShieldCheck size={16} /> 无痕模式已开启</span></footer></div>;
}

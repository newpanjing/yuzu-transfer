import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Monitor, ShieldCheck } from 'lucide-react';
import { Brand } from './components/Brand';
import { ConnectionPanel } from './components/ConnectionPanel';
import { ErrorDialog } from './components/ErrorDialog';
import { Sidebar } from './components/Sidebar';
import { TransferWorkspace } from './components/TransferWorkspace';
import { DEFAULT_PEER_AVATAR, DEFAULT_PEER_NICKNAME, DEFAULT_RELAY_LIMIT, PRESENCE_REFRESH_MS } from './constants';
import { createPairing, exchangePairing, getPresence, getRelayLimit } from './lib/api';
import { loadConversations, saveConversations } from './lib/conversations';
import { getAvatar, getDeviceId, getNickname, saveAvatar, saveNickname } from './lib/device';
import { PeerTransport } from './lib/peer';
import type { Conversation, DeviceProfile, TransferItem, View } from './types';

const PRESENCE_SYNC_ERROR = '在线状态刷新失败，请确认服务是否可用。';
const PAIRING_ERROR = '验证码不正确、已过期，或该设备当前不可连接。请确认后重试。';
const SIGNALING_REQUIRED_ERROR = '直连服务尚未就绪，请稍后重试。';
const BLOCKED_JOIN_ERROR = '该设备会话已被屏蔽，解除屏蔽后才能连接。';
const CONNECT_ERROR = '当前无法连接该设备，请稍后重试。';
const SERVER_ERROR = '配对服务暂不可用，请确认 Go 服务已启动。';

function createConversation(deviceId: string): Conversation {
  return { deviceId, nickname: DEFAULT_PEER_NICKNAME, avatar: DEFAULT_PEER_AVATAR, online: false, blocked: false, messages: [], lastConnectedAt: new Date().toISOString() };
}

export default function App() {
  const [view, setView] = useState<View>('connect');
  const [deviceId] = useState(getDeviceId);
  const [nickname, setNickname] = useState(getNickname);
  const [avatar, setAvatar] = useState(getAvatar);
  const [pairingCode, setPairingCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [relayLimit, setRelayLimit] = useState(DEFAULT_RELAY_LIMIT);
  const [transport, setTransport] = useState<PeerTransport>();
  const [connected, setConnected] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const activePeerRef = useRef<string | null>(null);
  const autoJoinCode = useRef('');
  const conversationsRef = useRef(conversations);

  const profile: DeviceProfile = { nickname, avatar };

  const updateConversation = (targetDeviceId: string, update: (conversation: Conversation) => Conversation) => {
    setConversations((current) => {
      const index = current.findIndex((conversation) => conversation.deviceId === targetDeviceId);
      const base = index < 0 ? createConversation(targetDeviceId) : current[index];
      const next = update(base);
      return index < 0 ? [next, ...current] : [next, ...current.filter((conversation) => conversation.deviceId !== targetDeviceId)];
    });
  };

  const findConversation = (targetDeviceId: string) => conversationsRef.current.find((conversation) => conversation.deviceId === targetDeviceId);

  const setPeerOnline = (targetDeviceId: string, online: boolean) => {
    updateConversation(targetDeviceId, (conversation) => ({ ...conversation, online }));
  };

  const addTransfer = (item: TransferItem) => {
    const peerDeviceId = activePeerRef.current;
    if (!peerDeviceId) return;
    updateConversation(peerDeviceId, (conversation) => ({
      ...conversation,
      online: true,
      messages: [...conversation.messages.filter((message) => message.id !== item.id), item],
      lastConnectedAt: new Date().toISOString(),
    }));
  };

  const handlePeerId = (peerId: string) => {
    activePeerRef.current = peerId;
    setSelectedDeviceId(peerId);
    updateConversation(peerId, (conversation) => ({ ...conversation, online: true, lastConnectedAt: new Date().toISOString() }));
  };

  const syncPresence = async () => {
    const deviceIds = conversationsRef.current.filter((conversation) => !conversation.blocked).map((conversation) => conversation.deviceId);
    if (deviceIds.length === 0) return;
    try {
      const response = await getPresence(deviceIds);
      setConversations((current) => current.map((conversation) => {
        if (conversation.blocked) return { ...conversation, online: false };
        const nextPresence = response.devices.find((device) => device.deviceId === conversation.deviceId);
        return nextPresence ? { ...conversation, online: nextPresence.online } : conversation;
      }));
    } catch {
      setError(PRESENCE_SYNC_ERROR);
    }
  };

  useEffect(() => { saveConversations(conversations); }, [conversations]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  const refreshPairingCode = async (forceRefresh = false) => {
    try {
      setError('');
      const pairing = await createPairing(deviceId, forceRefresh);
      setPairingCode(pairing.code);
    } catch {
      setError(SERVER_ERROR);
    }
  };

  useEffect(() => {
    void refreshPairingCode();
    void getRelayLimit().then((data) => setRelayLimit(data.relayMaxFileSize)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const instance = new PeerTransport(deviceId, profile, {
      onOpen: () => {
        setConnected(true);
        setView('transfer');
        const peerDeviceId = activePeerRef.current;
        if (peerDeviceId) setPeerOnline(peerDeviceId, true);
      },
      onClose: () => {
        setConnected(false);
        const peerDeviceId = activePeerRef.current;
        if (peerDeviceId) setPeerOnline(peerDeviceId, false);
      },
      onTransfer: addTransfer,
      onFileProgress: addTransfer,
      onPeerId: handlePeerId,
      onPeerProfile: (nextProfile) => {
        const peerDeviceId = activePeerRef.current;
        if (!peerDeviceId) return;
        updateConversation(peerDeviceId, (conversation) => ({
          ...conversation,
          nickname: nextProfile.nickname || conversation.nickname,
          avatar: nextProfile.avatar || conversation.avatar,
          online: true,
        }));
      },
      onError: setError,
    });
    instance.connectSignaling();
    setTransport(instance);
    return () => instance.close();
  }, [deviceId]);

  useEffect(() => {
    transport?.updateProfile(profile);
  }, [avatar, nickname, transport]);

  useEffect(() => {
    void syncPresence();
  }, [conversations.length]);

  useEffect(() => {
    const timer = window.setInterval(() => { void syncPresence(); }, PRESENCE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code');
    if (code?.length === 4) {
      setJoinCode(code);
      autoJoinCode.current = code;
    }
  }, []);

  const connectToPeer = async (peerDeviceId: string) => {
    if (!transport) {
      setError(SIGNALING_REQUIRED_ERROR);
      return;
    }
    if (findConversation(peerDeviceId)?.blocked) {
      setError(BLOCKED_JOIN_ERROR);
      return;
    }
    if (transport.isConnectedTo(peerDeviceId)) {
      activePeerRef.current = peerDeviceId;
      setSelectedDeviceId(peerDeviceId);
      setView('transfer');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await transport.start(peerDeviceId);
      setSelectedDeviceId(peerDeviceId);
      setView('transfer');
    } catch {
      setPeerOnline(peerDeviceId, false);
      setError(CONNECT_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const join = async (code = joinCode) => {
    if (!transport) return;
    setBusy(true);
    setError('');
    try {
      const result = await exchangePairing(code, deviceId);
      if (findConversation(result.peerDeviceId)?.blocked) {
        setPairingError(BLOCKED_JOIN_ERROR);
        return;
      }
      await transport.start(result.peerDeviceId);
      setView('transfer');
    } catch {
      setPairingError(PAIRING_ERROR);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (autoJoinCode.current && transport) {
      void join(autoJoinCode.current);
      autoJoinCode.current = '';
    }
  }, [transport]);

  const changeNickname = (name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    saveNickname(nextName);
    setNickname(nextName);
  };

  const changeAvatar = (value: string) => {
    const nextAvatar = value.trim().slice(0, 2);
    if (!nextAvatar) return;
    saveAvatar(nextAvatar);
    setAvatar(nextAvatar);
  };

  const deleteConversation = () => {
    if (!selectedDeviceId) return;
    const nextSelectedId = conversations.find((conversation) => conversation.deviceId !== selectedDeviceId)?.deviceId ?? null;
    setConversations((current) => current.filter((conversation) => conversation.deviceId !== selectedDeviceId));
    if (activePeerRef.current === selectedDeviceId) {
      activePeerRef.current = null;
      setConnected(false);
      transport?.disconnectPeer();
    }
    setSelectedDeviceId(nextSelectedId);
    setView(nextSelectedId ? 'transfer' : 'connect');
  };

  const toggleBlockedConversation = () => {
    if (!selectedDeviceId) return;
    updateConversation(selectedDeviceId, (conversation) => {
      const blocked = !conversation.blocked;
      if (blocked && activePeerRef.current === selectedDeviceId) {
        activePeerRef.current = null;
        setConnected(false);
        transport?.disconnectPeer();
      }
      return { ...conversation, blocked, online: blocked ? false : conversation.online };
    });
  };

  const selectedConversation = conversations.find((conversation) => conversation.deviceId === selectedDeviceId);
  const selectedMessages = selectedConversation?.messages ?? [];
  const isSelectedConnected = Boolean(selectedDeviceId && connected && activePeerRef.current === selectedDeviceId && !selectedConversation?.blocked);
  const qrValue = `${location.origin}?code=${pairingCode}`;
  const invitationText = `邀请您使用柚子快传：${qrValue}`;

  return <div className="app-shell"><header><Brand /><div className="header-meta"><ShieldCheck size={17} /> 不登录 · 不存文件 · 不留记录</div></header><div className="app-body"><Sidebar conversations={conversations} activeDeviceId={selectedDeviceId} onConnect={() => setView('connect')} onSelect={(targetDeviceId) => { setSelectedDeviceId(targetDeviceId); setView('transfer'); const targetConversation = conversations.find((conversation) => conversation.deviceId === targetDeviceId); if (targetConversation?.online && !targetConversation.blocked) void connectToPeer(targetDeviceId); }} />{view === 'connect' ? <main className="connect-view"><div className="view-heading"><span className="eyebrow"><BadgeCheck size={17} /> 安全直连</span><h1>连接新设备</h1><p>在手机上打开柚子快传，扫描二维码或输入验证码连接</p></div><ConnectionPanel pairingCode={pairingCode} qrValue={qrValue} invitationText={invitationText} joinCode={joinCode} onJoinCodeChange={setJoinCode} onJoin={() => void join()} onRefresh={() => void refreshPairingCode(true)} busy={busy} />{error && <div className="error-banner">{error}</div>}<div className="privacy-banner"><ShieldCheck size={20} /><span><strong>无痕传输</strong> · 文件优先在设备间直连，不保存至服务器</span></div></main> : <TransferWorkspace nickname={selectedConversation?.nickname ?? DEFAULT_PEER_NICKNAME} avatar={selectedConversation?.avatar ?? DEFAULT_PEER_AVATAR} selfNickname={nickname} selfAvatar={avatar} blocked={selectedConversation?.blocked ?? false} onNicknameChange={changeNickname} onAvatarChange={changeAvatar} onDeleteConversation={deleteConversation} onToggleBlocked={toggleBlockedConversation} relayLimit={relayLimit} transport={transport} connected={isSelectedConnected} items={selectedMessages} onItemsChange={(next) => { if (!selectedDeviceId) return; updateConversation(selectedDeviceId, (conversation) => ({ ...conversation, messages: typeof next === 'function' ? next(conversation.messages) : next })); }} />} </div><footer><span>设备 ID：{deviceId.slice(0, 8)}</span><span><Monitor size={15} /> 当前设备已就绪</span><span><ShieldCheck size={16} /> 无痕模式已开启</span></footer>{pairingError && <ErrorDialog message={pairingError} onClose={() => setPairingError('')} />}</div>;
}

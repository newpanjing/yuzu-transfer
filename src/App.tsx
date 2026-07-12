import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { AboutView } from './components/AboutView';
import { Brand } from './components/Brand';
import { ConnectionPanel } from './components/ConnectionPanel';
import { ConversationsView } from './components/ConversationsView';
import { ErrorDialog } from './components/ErrorDialog';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { TransferWorkspace } from './components/TransferWorkspace';
import { DEFAULT_PEER_AVATAR, DEFAULT_PEER_NICKNAME, DEFAULT_RELAY_LIMIT, PRESENCE_REFRESH_MS } from './constants';
import { createPairing, exchangePairing, getPresence, getRelayLimit } from './lib/api';
import { loadConversations, saveConversations } from './lib/conversations';
import { getAvatar, getDeviceId, getNickname, getStoredPairingCode, saveAvatar, saveNickname, savePairingCode } from './lib/device';
import { translateNow, useI18n } from './lib/i18n';
import { PeerTransport } from './lib/peer';
import type { Conversation, DeviceProfile, TransferItem, View } from './types';
const GITHUB_URL = 'https://github.com/newpanjing/yuzu-transfer';

function createConversation(deviceId: string): Conversation {
  return { deviceId, nickname: translateNow('conversation.defaultPeer'), avatar: DEFAULT_PEER_AVATAR, online: false, blocked: false, messages: [], lastConnectedAt: new Date().toISOString() };
}

function getConversationTitle(conversation?: Conversation, fallbackTitle = translateNow('conversation.defaultPeer')) {
  if (!conversation) return fallbackTitle;
  return conversation.remark ?? conversation.nickname;
}

export default function App() {
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [restoredSession] = useState(() => {
    const restoredConversations = loadConversations();
    return { conversations: restoredConversations, pairingCode: getStoredPairingCode(), selectedDeviceId: restoredConversations[0]?.deviceId ?? null, view: restoredConversations.length > 0 ? 'transfer' as View : 'connect' as View };
  });
  const [view, setView] = useState<View>(restoredSession.view);
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'back'>('forward');
  const [deviceId] = useState(getDeviceId);
  const [nickname, setNickname] = useState(getNickname);
  const [avatar, setAvatar] = useState<string>(getAvatar);
  const [pairingCode, setPairingCode] = useState(restoredSession.pairingCode);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [relayLimit, setRelayLimit] = useState(DEFAULT_RELAY_LIMIT);
  const [transport, setTransport] = useState<PeerTransport>();
  const [connected, setConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>(restoredSession.conversations);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(restoredSession.selectedDeviceId);
  const activePeerRef = useRef<string | null>(null);
  const autoJoinCode = useRef('');
  const conversationsRef = useRef(conversations);
  const incomingConnectionRef = useRef(false);

  const profile: DeviceProfile = { nickname, avatar };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

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
      setError(t('error.presence'));
    }
  };

  useEffect(() => { saveConversations(conversations); }, [conversations]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  const refreshPairingCode = async (forceRefresh = false) => {
    try {
      setError('');
      const pairing = await createPairing(deviceId, forceRefresh);
      setPairingCode(pairing.code);
      savePairingCode(pairing.code);
    } catch {
      setError(t('error.server'));
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
        if (incomingConnectionRef.current) {
          setToastMessage(t('error.incomingJoin'));
          incomingConnectionRef.current = false;
        }
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
      onIncomingConnection: () => {
        incomingConnectionRef.current = true;
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
    if (selectedDeviceId || conversations.length === 0) return;
    setSelectedDeviceId(conversations[0].deviceId);
  }, [conversations, selectedDeviceId]);

  useEffect(() => {
    const timer = window.setInterval(() => { void syncPresence(); }, PRESENCE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (code?.length === 4) {
      setJoinCode(code);
      autoJoinCode.current = code;
      url.searchParams.delete('code');
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, []);

  const connectToPeer = async (peerDeviceId: string) => {
    if (!transport) {
      setError(t('error.signalingRequired'));
      return;
    }
    if (findConversation(peerDeviceId)?.blocked) {
      setError(t('error.blockedJoin'));
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
      setError(t('error.connect'));
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
        setPairingError(t('error.blockedJoin'));
        return;
      }
      await transport.start(result.peerDeviceId);
      setView('transfer');
    } catch {
      setPairingError(t('error.pairing'));
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
    const nextAvatar = value.trim();
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

  const renameConversation = () => {
    if (!selectedDeviceId) return;
    const currentName = getConversationTitle(findConversation(selectedDeviceId), t('conversation.defaultPeer'));
    const nextName = window.prompt(t('conversation.renamePrompt'), currentName)?.trim();
    if (!nextName) return;
    updateConversation(selectedDeviceId, (conversation) => ({ ...conversation, remark: nextName }));
  };

  const selectedConversation = conversations.find((conversation) => conversation.deviceId === selectedDeviceId);
  const selectedMessages = selectedConversation?.messages ?? [];
  const isSelectedConnected = Boolean(selectedDeviceId && connected && activePeerRef.current === selectedDeviceId && !selectedConversation?.blocked);
  const qrValue = `${location.origin}?code=${pairingCode}`;
  const invitationText = `${t('invitation.prefix')}${qrValue}`;
  const openConversationView = () => {
    if (conversations.length === 0) {
      setTransitionDirection('back');
      setView('connect');
      return;
    }
    setTransitionDirection('forward');
    setView('conversations');
  };

  const openTransferView = (targetDeviceId: string) => {
    setTransitionDirection('forward');
    setSelectedDeviceId(targetDeviceId);
    setView('transfer');
    const targetConversation = conversations.find((conversation) => conversation.deviceId === targetDeviceId);
    if (targetConversation?.online && !targetConversation.blocked) void connectToPeer(targetDeviceId);
  };

  const backFromTransfer = () => {
    setTransitionDirection('back');
    setView('conversations');
  };

  const hideGlobalChrome = isMobile && view === 'transfer';

  return <div className="app-shell">{!hideGlobalChrome && <header><Brand /><div className="header-actions"><LanguageSwitcher /><div className="header-meta"><ShieldCheck size={17} /> {t('header.meta')}</div></div></header>}<div className="app-body">{!hideGlobalChrome && <Sidebar conversations={conversations} activeDeviceId={selectedDeviceId} activeView={view} onConnect={() => { setTransitionDirection('back'); setView('connect'); }} onSettings={() => { setTransitionDirection('forward'); setView('settings'); }} onAbout={() => { setTransitionDirection('forward'); setView('about'); }} onSelect={openTransferView} />}<div key={`${view}-${selectedDeviceId ?? 'none'}`} className={`view-frame view-frame--${transitionDirection}`}>{view === 'connect' ? <main className="connect-view"><div className="privacy-banner connect-privacy-banner"><ShieldCheck size={20} /><span><strong>{t('connect.privacyTitle')}</strong> · {t('connect.privacyBody')}</span></div><div className="view-heading"><span className="eyebrow"><BadgeCheck size={17} /> {t('connect.eyebrow')}</span><h1>{t('connect.title')}</h1><p>{t('connect.subtitle')}</p></div><ConnectionPanel pairingCode={pairingCode} qrValue={qrValue} invitationText={invitationText} joinCode={joinCode} onJoinCodeChange={setJoinCode} onJoin={() => void join()} onRefresh={() => void refreshPairingCode(true)} busy={busy} />{error && <div className="error-banner">{error}</div>}</main> : view === 'conversations' ? <ConversationsView conversations={conversations} activeDeviceId={selectedDeviceId} onSelect={openTransferView} /> : view === 'settings' ? <SettingsView nickname={nickname} avatar={avatar} onNicknameChange={changeNickname} onAvatarChange={changeAvatar} /> : view === 'about' ? <AboutView githubUrl={GITHUB_URL} /> : <TransferWorkspace title={getConversationTitle(selectedConversation, t('conversation.defaultPeer'))} avatar={selectedConversation?.avatar ?? DEFAULT_PEER_AVATAR} blocked={selectedConversation?.blocked ?? false} onRenameConversation={renameConversation} onDeleteConversation={deleteConversation} onToggleBlocked={toggleBlockedConversation} relayLimit={relayLimit} transport={transport} connected={isSelectedConnected} items={selectedMessages} onItemsChange={(next) => { if (!selectedDeviceId) return; updateConversation(selectedDeviceId, (conversation) => ({ ...conversation, messages: typeof next === 'function' ? next(conversation.messages) : next })); }} onBack={backFromTransfer} />}</div></div>{!hideGlobalChrome && <MobileBottomNav activeView={view} hasConversations={conversations.length > 0} onConnect={() => { setTransitionDirection('back'); setView('connect'); }} onConversation={openConversationView} onSettings={() => { setTransitionDirection('forward'); setView('settings'); }} onAbout={() => { setTransitionDirection('forward'); setView('about'); }} />}{!hideGlobalChrome && <footer><span>{t('footer.ready')}</span><span><ShieldCheck size={16} /> {t('footer.private')}</span></footer>}{toastMessage && <Toast message={toastMessage} />}{pairingError && <ErrorDialog message={pairingError} onClose={() => setPairingError('')} />}</div>;
}

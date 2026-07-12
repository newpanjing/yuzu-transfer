import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
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
import { TutorialView } from './components/TutorialView';
import { DEFAULT_ICE_SERVERS, DEFAULT_PEER_AVATAR, DEFAULT_PEER_NICKNAME, DEFAULT_RELAY_LIMIT } from './constants';
import { createPairing, exchangePairing, getPresence, getRtcConfig } from './lib/api';
import { loadConversations, saveConversations } from './lib/conversations';
import { getAvatar, getDeviceId, getNickname, getStoredPairingCode, saveAvatar, saveNickname, savePairingCode } from './lib/device';
import { translateNow, useI18n } from './lib/i18n';
import { PeerTransport } from './lib/peer';
import type { Conversation, DeviceProfile, TransferItem, View } from './types';

const GITHUB_URL = 'https://github.com/newpanjing/yuzu-transfer';
const AUTO_JOIN_RETRY_DELAY_MS = 600;
const NETWORK_RECOVERY_DELAY_MS = 900;
const SIGNALING_UNAVAILABLE_ERROR = 'signaling unavailable';
const PAIRING_CODE_LENGTH = 4;
type JoinOptions = { silentSignalError?: boolean };
type JoinResult = 'success' | 'signaling-unavailable' | 'blocked' | 'pairing-error';
type NavigatorConnectionLike = { addEventListener?: (type: 'change', listener: () => void) => void; removeEventListener?: (type: 'change', listener: () => void) => void };

function getPairingCodeFromLocation() {
  const code = new URL(window.location.href).searchParams.get('code');
  return code?.length === PAIRING_CODE_LENGTH ? code : '';
}

function createConversation(deviceId: string): Conversation {
  return { deviceId, nickname: translateNow('conversation.defaultPeer'), avatar: DEFAULT_PEER_AVATAR, online: false, blocked: false, messages: [], lastConnectedAt: new Date().toISOString() };
}

function getConversationTitle(conversation?: Conversation, fallbackTitle = translateNow('conversation.defaultPeer')) {
  if (!conversation) return fallbackTitle;
  return conversation.remark ?? conversation.nickname;
}

export default function App() {
  const { t } = useI18n();
  const [initialJoinCode] = useState(getPairingCodeFromLocation);
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
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [autoJoinRequestCode, setAutoJoinRequestCode] = useState(initialJoinCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [relayLimit, setRelayLimit] = useState(DEFAULT_RELAY_LIMIT);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const [rtcConfigReady, setRtcConfigReady] = useState(false);
  const [transport, setTransport] = useState<PeerTransport>();
  const [connected, setConnected] = useState(false);
  const [relayActive, setRelayActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>(restoredSession.conversations);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(restoredSession.selectedDeviceId);
  const activePeerRef = useRef<string | null>(null);
  const autoJoinCode = useRef(initialJoinCode);
  const autoJoinRetryTimer = useRef<number | undefined>(undefined);
  const autoJoinInProgress = useRef(false);
  const networkRecoveryTimer = useRef<number | undefined>(undefined);
  const conversationsRef = useRef(conversations);
  const incomingConnectionRef = useRef(false);

  const profile: DeviceProfile = { nickname, avatar };
  const presenceDeviceIds = useMemo(() => conversations.filter((conversation) => !conversation.blocked).map((conversation) => conversation.deviceId).sort(), [conversations]);
  const presenceSubscriptionKey = presenceDeviceIds.join(',');

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
        return { ...conversation, online: nextPresence?.online ?? false };
      }));
    } catch {
      if (view !== 'connect') setToastMessage(t('error.presence'));
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
    let active = true;
    void refreshPairingCode();
    void getRtcConfig().then((data) => {
      if (!active) return;
      setRelayLimit(data.relayMaxFileSize);
      setIceServers(data.iceServers.length > 0 ? data.iceServers : DEFAULT_ICE_SERVERS);
    }).catch(() => undefined).finally(() => {
      if (active) setRtcConfigReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!rtcConfigReady) return;
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
        setRelayActive(false);
        const peerDeviceId = activePeerRef.current;
        if (peerDeviceId) setPeerOnline(peerDeviceId, false);
      },
      onTransfer: addTransfer,
      onFileProgress: addTransfer,
      onPeerId: handlePeerId,
      onPresence: (peerDeviceId, online) => {
        if (peerDeviceId === deviceId || !findConversation(peerDeviceId)) return;
        setPeerOnline(peerDeviceId, online);
        if (!online || activePeerRef.current !== peerDeviceId || findConversation(peerDeviceId)?.blocked || instance.isConnectedTo(peerDeviceId)) return;
        void instance.start(peerDeviceId).catch(() => setPeerOnline(peerDeviceId, false));
      },
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
      onRelayChange: setRelayActive,
      onError: (message) => {
        if (autoJoinInProgress.current || autoJoinCode.current) return;
        setError(message);
      },
    }, iceServers);
    instance.connectSignaling();
    setTransport(instance);
    return () => instance.close();
  }, [deviceId, iceServers, rtcConfigReady]);

  useEffect(() => {
    transport?.updateProfile(profile);
  }, [avatar, nickname, transport]);

  useEffect(() => {
    transport?.watchPresence(presenceDeviceIds);
  }, [presenceSubscriptionKey, transport]);

  useEffect(() => {
    void syncPresence();
  }, [conversations.length]);

  useEffect(() => {
    if (selectedDeviceId || conversations.length === 0) return;
    setSelectedDeviceId(conversations[0].deviceId);
  }, [conversations, selectedDeviceId]);

  useEffect(() => {
    if (!selectedDeviceId) return;
    void syncPresence();
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!initialJoinCode) return;
    setView('connect');
    autoJoinInProgress.current = false;
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [initialJoinCode]);

  useEffect(() => () => {
    if (autoJoinRetryTimer.current) window.clearTimeout(autoJoinRetryTimer.current);
    if (networkRecoveryTimer.current) window.clearTimeout(networkRecoveryTimer.current);
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
    if (transport.isConnectingTo(peerDeviceId)) return;
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

  const join = async (code = joinCode, options: JoinOptions = {}): Promise<JoinResult> => {
    if (!transport) return 'signaling-unavailable';
    setBusy(true);
    setError('');
    setPairingError('');
    try {
      if (!await transport.waitForSignalingReady()) {
        if (!options.silentSignalError) setError(t('error.signalingRequired'));
        return 'signaling-unavailable';
      }
      const result = await exchangePairing(code, deviceId);
      if (findConversation(result.peerDeviceId)?.blocked) {
        setPairingError(t('error.blockedJoin'));
        return 'blocked';
      }
      await transport.start(result.peerDeviceId);
      setView('transfer');
      return 'success';
    } catch (error) {
      if (error instanceof Error && error.message === SIGNALING_UNAVAILABLE_ERROR) {
        if (!options.silentSignalError) setError(t('error.signalingRequired'));
        return 'signaling-unavailable';
      }
      setPairingError(t('error.pairing'));
      return 'pairing-error';
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoJoinRequestCode || !transport) return;
    let cancelled = false;
    autoJoinInProgress.current = true;
    setBusy(true);
    const code = autoJoinRequestCode;
    autoJoinCode.current = code;
    const attemptAutoJoin = async () => {
      const joinResult = await join(code, { silentSignalError: true });
      if (cancelled) return;
      if (joinResult === 'success') {
        autoJoinCode.current = '';
        setAutoJoinRequestCode('');
        autoJoinInProgress.current = false;
        setBusy(false);
        return;
      }
      if (joinResult === 'blocked' || joinResult === 'pairing-error') {
        autoJoinCode.current = '';
        setAutoJoinRequestCode('');
        autoJoinInProgress.current = false;
        setBusy(false);
        return;
      }
      autoJoinRetryTimer.current = window.setTimeout(() => {
        void attemptAutoJoin();
      }, AUTO_JOIN_RETRY_DELAY_MS);
    };
    void attemptAutoJoin();
    return () => {
      cancelled = true;
      if (autoJoinRetryTimer.current) window.clearTimeout(autoJoinRetryTimer.current);
    };
  }, [autoJoinRequestCode, transport]);

  useEffect(() => {
    if (!transport) return;
    const recoverNetworkState = () => {
      if (networkRecoveryTimer.current) window.clearTimeout(networkRecoveryTimer.current);
      networkRecoveryTimer.current = window.setTimeout(() => {
        transport.reconnectSignaling();
        void refreshPairingCode(false);
        void syncPresence();
        const activePeerId = activePeerRef.current;
        if (!activePeerId) return;
        const activeConversation = findConversation(activePeerId);
        if (activeConversation?.blocked) return;
        void transport.waitForSignalingReady().then((ready) => {
          if (!ready) return;
          void connectToPeer(activePeerId);
        });
      }, NETWORK_RECOVERY_DELAY_MS);
    };

    const connection = (navigator as Navigator & { connection?: NavigatorConnectionLike }).connection;
    window.addEventListener('online', recoverNetworkState);
    window.addEventListener('offline', recoverNetworkState);
    connection?.addEventListener?.('change', recoverNetworkState);
    return () => {
      window.removeEventListener('online', recoverNetworkState);
      window.removeEventListener('offline', recoverNetworkState);
      connection?.removeEventListener?.('change', recoverNetworkState);
    };
  }, [transport, selectedDeviceId]);

  const saveProfile = ({ nickname: nextNickname, avatar: nextAvatar }: { nickname: string; avatar: string }) => {
    const trimmedNickname = nextNickname.trim();
    const trimmedAvatar = nextAvatar.trim();
    if (!trimmedNickname || !trimmedAvatar) return;
    saveNickname(trimmedNickname);
    saveAvatar(trimmedAvatar);
    setNickname(trimmedNickname);
    setAvatar(trimmedAvatar);
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
  const isSelectedOnline = Boolean(selectedConversation?.online && !selectedConversation?.blocked);
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

  const showTopHeader = isMobile && !hideGlobalChrome;
  const appShellClassName = hideGlobalChrome ? 'app-shell app-shell--chat' : !isMobile ? 'app-shell app-shell--desktop' : 'app-shell';

  return <div className={appShellClassName}>{showTopHeader && <header><Brand /><div className="header-actions"><LanguageSwitcher /></div></header>}<div className={hideGlobalChrome ? 'app-body app-body--chat' : 'app-body'}>{!hideGlobalChrome && <Sidebar conversations={conversations} activeDeviceId={selectedDeviceId} activeView={view} onConnect={() => { setTransitionDirection('back'); setView('connect'); }} onTutorial={() => { setTransitionDirection('forward'); setView('tutorial'); }} onSettings={() => { setTransitionDirection('forward'); setView('settings'); }} onSelect={openTransferView} />}<div key={`${view}-${selectedDeviceId ?? 'none'}`} className={hideGlobalChrome ? `view-frame view-frame--chat view-frame--${transitionDirection}` : `view-frame view-frame--${transitionDirection}`}>{view === 'connect' ? <main className="connect-view connect-view--minimal"><ConnectionPanel pairingCode={pairingCode} qrValue={qrValue} invitationText={invitationText} joinCode={joinCode} onJoinCodeChange={setJoinCode} onJoin={() => void join()} onRefresh={() => void refreshPairingCode(true)} busy={busy} />{error && <div className="error-banner">{error}</div>}</main> : view === 'conversations' ? <ConversationsView conversations={conversations} activeDeviceId={selectedDeviceId} onSelect={openTransferView} /> : view === 'tutorial' ? <TutorialView /> : view === 'settings' ? <SettingsView nickname={nickname} avatar={avatar} onOpenAbout={() => { setTransitionDirection('forward'); setView('about'); }} onSave={saveProfile} /> : view === 'about' ? <AboutView githubUrl={GITHUB_URL} onBack={() => { setTransitionDirection('back'); setView('settings'); }} /> : <TransferWorkspace title={getConversationTitle(selectedConversation, t('conversation.defaultPeer'))} avatar={selectedConversation?.avatar ?? DEFAULT_PEER_AVATAR} blocked={selectedConversation?.blocked ?? false} onDeleteConversation={deleteConversation} onToggleBlocked={toggleBlockedConversation} relayLimit={relayLimit} relayActive={relayActive} transport={transport} connected={isSelectedConnected} online={isSelectedOnline} items={selectedMessages} onItemsChange={(next) => { if (!selectedDeviceId) return; updateConversation(selectedDeviceId, (conversation) => ({ ...conversation, messages: typeof next === 'function' ? next(conversation.messages) : next })); }} onBack={backFromTransfer} />}</div></div>{!hideGlobalChrome && <MobileBottomNav activeView={view} hasConversations={conversations.length > 0} onConnect={() => { setTransitionDirection('back'); setView('connect'); }} onConversation={openConversationView} onTutorial={() => { setTransitionDirection('forward'); setView('tutorial'); }} onSettings={() => { setTransitionDirection('forward'); setView('settings'); }} />}{toastMessage && <Toast message={toastMessage} />}{pairingError && <ErrorDialog message={pairingError} onClose={() => setPairingError('')} />}</div>;
}

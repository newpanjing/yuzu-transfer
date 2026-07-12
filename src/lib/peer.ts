import { TRANSFER_STATUS } from '../constants';
import type { DeviceProfile, TransferStatus } from '../types';
import {
  resolveFileChunkSize,
  shouldWaitForBufferedAmount,
  waitForDataChannelDrain,
} from './fileTransfer';
import { translateNow } from './i18n';
import { buildSignalingUrl } from './runtime';

const DATA_CHANNEL_NAME = 'yuzu-transfer';
const SIGNAL_TYPE = { offer: 'offer', answer: 'answer', candidate: 'candidate' } as const;
const DATA_TYPE = { profile: 'profile', text: 'text', fileStart: 'file-start', fileProgress: 'file-progress', fileEnd: 'file-end', filePause: 'file-pause', fileResume: 'file-resume', fileCancel: 'file-cancel' } as const;
const CONNECTION_STATE = { failed: 'failed', disconnected: 'disconnected', closed: 'closed' } as const;
const CANDIDATE_PAIR_TYPE = 'candidate-pair';
const TRANSPORT_STAT_TYPE = 'transport';
const RELAY_CANDIDATE_TYPE = 'relay';
const STATS_POLL_INTERVAL_MS = 2500;
const SIGNALING_RETRY_DELAY_MS = 1000;
const SIGNALING_ERROR = () => translateNow('peer.signaling');
const DATA_CHANNEL_ERROR = () => translateNow('peer.dataChannel');

export type IncomingTransfer = { id: string; name: string; size: number; type: 'file' | 'image'; sentAt: string; objectUrl?: string; direction: 'incoming' | 'outgoing'; text?: string; progress?: number; transferredBytes?: number; speedBytes?: number; remainingSeconds?: number; elapsedSeconds?: number; transferStatus?: TransferStatus };
type Callbacks = { onOpen: () => void; onClose: () => void; onTransfer: (item: IncomingTransfer) => void; onFileProgress: (item: IncomingTransfer) => void; onPeerProfile: (profile: DeviceProfile) => void; onPeerId: (deviceId: string) => void; onIncomingConnection: () => void; onRelayChange: (relayActive: boolean) => void; onError: (message: string) => void };
type Signal = { from: string; type: string; payload: RTCSessionDescriptionInit | RTCIceCandidateInit };
type ReceivedFile = { id: string; name: string; size: number; mime: string; chunks: ArrayBuffer[]; sentAt: string; startedAt: number; transferredBytes: number; transferStatus: TransferStatus };
type OutgoingTransfer = { id: string; file: File; name: string; size: number; type: 'file' | 'image'; sentAt: string; objectUrl?: string; startedAt: number; transferredBytes: number; transferStatus: TransferStatus; resume?: () => void };
type CandidateReport = RTCStats & { candidateType?: string };
type PairReport = RTCStats & { localCandidateId?: string; remoteCandidateId?: string; nominated?: boolean; selected?: boolean; state?: string };
type TransportReport = RTCStats & { selectedCandidatePairId?: string };

function buildTransferMetrics(transferredBytes: number, totalBytes: number, startedAt: number) {
  const progress = totalBytes === 0 ? 1 : Math.min(transferredBytes / totalBytes, 1);
  const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
  const speedBytes = transferredBytes / elapsedSeconds;
  const remainingBytes = Math.max(totalBytes - transferredBytes, 0);
  const remainingSeconds = speedBytes > 0 && remainingBytes > 0 ? remainingBytes / speedBytes : 0;
  return { progress, transferredBytes, speedBytes, remainingSeconds, elapsedSeconds };
}

export class PeerTransport {
  private socket?: WebSocket;
  private peer?: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private peerId = '';
  private receivedFile?: ReceivedFile;
  private signalingReady?: Promise<void>;
  private signalingFailed = false;
  private closed = false;
  private relayActive = false;
  private transportStatsTimer?: number;
  private signalingReconnectTimer?: number;
  private profile: DeviceProfile;
  private outgoingTransfers = new Map<string, OutgoingTransfer>();
  private outgoingQueue: OutgoingTransfer[] = [];
  private activeOutgoingTransfer?: OutgoingTransfer;
  private processingOutgoingQueue = false;

  constructor(private readonly deviceId: string, profile: DeviceProfile, private readonly callbacks: Callbacks, private readonly iceServers: RTCIceServer[]) {
    this.profile = profile;
  }

  connectSignaling() {
    this.openSignalingSocket();
  }

  reconnectSignaling() {
    this.openSignalingSocket(true);
  }

  async waitForSignalingReady() {
    this.openSignalingSocket();
    await this.signalingReady;
    if (!this.signalingFailed && this.socket?.readyState === WebSocket.OPEN) return true;
    if (this.closed) return false;
    this.openSignalingSocket(true);
    await this.signalingReady;
    return !this.signalingFailed && this.socket?.readyState === WebSocket.OPEN;
  }

  async start(peerId: string) {
    if (!await this.waitForSignalingReady()) throw new Error('signaling unavailable');
    this.disconnectPeer();
    this.peerId = peerId;
    this.callbacks.onPeerId(peerId);
    const peer = this.createPeer();
    this.channel = peer.createDataChannel(DATA_CHANNEL_NAME, { ordered: true });
    this.bindChannel(this.channel);
    void peer.createOffer().then(async (offer) => {
      await peer.setLocalDescription(offer);
      this.sendSignal(SIGNAL_TYPE.offer, offer);
    });
  }

  sendText(text: string) { this.sendJson({ type: DATA_TYPE.text, text, sentAt: new Date().toISOString() }); }

  queueFile(file: File, objectUrl?: string, transferId?: string) {
    if (!this.channel || this.channel.readyState !== 'open') throw new Error(DATA_CHANNEL_ERROR());
    const id = transferId ?? `${Date.now()}-${file.name}`;
    const type = file.type.startsWith('image/') ? 'image' : 'file';
    const sentAt = new Date().toISOString();
    const transfer: OutgoingTransfer = { id, file, name: file.name, size: file.size, type, sentAt, objectUrl, startedAt: Date.now(), transferredBytes: 0, transferStatus: TRANSFER_STATUS.queued };
    this.outgoingTransfers.set(id, transfer);
    this.outgoingQueue.push(transfer);
    this.reportOutgoingTransfer(transfer);
    void this.processFileQueue();
  }

  pauseFile(transferId: string) {
    const transfer = this.activeOutgoingTransfer;
    if (!transfer || transfer.id !== transferId || transfer.transferStatus !== TRANSFER_STATUS.transferring) return false;
    transfer.transferStatus = TRANSFER_STATUS.paused;
    this.sendJson({ type: DATA_TYPE.filePause, id: transfer.id });
    this.reportOutgoingTransfer(transfer);
    return true;
  }

  resumeFile(transferId: string) {
    const transfer = this.activeOutgoingTransfer;
    if (!transfer || transfer.id !== transferId || transfer.transferStatus !== TRANSFER_STATUS.paused) return false;
    transfer.transferStatus = TRANSFER_STATUS.transferring;
    transfer.resume?.();
    transfer.resume = undefined;
    this.sendJson({ type: DATA_TYPE.fileResume, id: transfer.id });
    this.reportOutgoingTransfer(transfer);
    return true;
  }

  cancelFile(transferId: string) {
    const activeTransfer = this.activeOutgoingTransfer;
    if (activeTransfer?.id === transferId) {
      activeTransfer.transferStatus = TRANSFER_STATUS.cancelled;
      activeTransfer.resume?.();
      activeTransfer.resume = undefined;
      this.sendJson({ type: DATA_TYPE.fileCancel, id: transferId });
      this.reportOutgoingTransfer(activeTransfer);
      return true;
    }
    const queueIndex = this.outgoingQueue.findIndex((transfer) => transfer.id === transferId);
    if (queueIndex < 0) return false;
    const [transfer] = this.outgoingQueue.splice(queueIndex, 1);
    transfer.transferStatus = TRANSFER_STATUS.cancelled;
    this.outgoingTransfers.delete(transferId);
    this.reportOutgoingTransfer(transfer);
    return true;
  }

  private async processFileQueue() {
    if (this.processingOutgoingQueue) return;
    this.processingOutgoingQueue = true;
    while (this.outgoingQueue.length > 0) {
      const transfer = this.outgoingQueue.shift();
      if (!transfer || transfer.transferStatus !== TRANSFER_STATUS.queued) continue;
      this.activeOutgoingTransfer = transfer;
      try {
        await this.sendQueuedFile(transfer);
      } catch {
        if (!this.isTransferCancelled(transfer)) {
          transfer.transferStatus = TRANSFER_STATUS.failed;
          this.reportOutgoingTransfer(transfer);
        }
      } finally {
        if (this.isTransferCancelled(transfer)) {
          this.outgoingTransfers.delete(transfer.id);
          this.reportOutgoingTransfer(transfer);
        }
        this.activeOutgoingTransfer = undefined;
      }
    }
    this.processingOutgoingQueue = false;
  }

  private async sendQueuedFile(transfer: OutgoingTransfer) {
    if (!this.channel || this.channel.readyState !== 'open') throw new Error(DATA_CHANNEL_ERROR());
    transfer.transferStatus = TRANSFER_STATUS.transferring;
    transfer.startedAt = Date.now();
    this.reportOutgoingTransfer(transfer);
    this.sendJson({ type: DATA_TYPE.fileStart, id: transfer.id, name: transfer.name, size: transfer.size, mime: transfer.file.type, sentAt: transfer.sentAt });
    const chunkSize = resolveFileChunkSize(this.relayActive);
    for (let offset = 0; offset < transfer.file.size; offset += chunkSize) {
      if (!await this.waitForFileResume(transfer)) return;
      if (!this.channel || this.channel.readyState !== 'open') throw new Error(DATA_CHANNEL_ERROR());
      const buffer = await transfer.file.slice(offset, offset + chunkSize).arrayBuffer();
      this.channel.send(buffer);
      if (shouldWaitForBufferedAmount(this.channel.bufferedAmount)) {
        await waitForDataChannelDrain(this.channel);
      }
    }
    if (this.canFinishTransfer(transfer)) this.sendJson({ type: DATA_TYPE.fileEnd, id: transfer.id });
  }

  private async waitForFileResume(transfer: OutgoingTransfer) {
    while (transfer.transferStatus === TRANSFER_STATUS.paused) {
      await new Promise<void>((resolve) => { transfer.resume = resolve; });
    }
    return transfer.transferStatus === TRANSFER_STATUS.transferring;
  }

  private isTransferCancelled(transfer: OutgoingTransfer) {
    return transfer.transferStatus === TRANSFER_STATUS.cancelled;
  }

  private canFinishTransfer(transfer: OutgoingTransfer) {
    return transfer.transferStatus === TRANSFER_STATUS.transferring;
  }

  private reportOutgoingTransfer(transfer: OutgoingTransfer, transferredBytes = transfer.transferredBytes) {
    this.callbacks.onFileProgress({
      id: transfer.id,
      name: transfer.name,
      size: transfer.size,
      type: transfer.type,
      sentAt: transfer.sentAt,
      objectUrl: transfer.objectUrl,
      direction: 'outgoing',
      transferStatus: transfer.transferStatus,
      ...buildTransferMetrics(transferredBytes, transfer.size, transfer.startedAt),
    });
  }

  private reportIncomingTransfer(file: ReceivedFile) {
    this.callbacks.onFileProgress({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.mime.startsWith('image/') ? 'image' : 'file',
      sentAt: file.sentAt,
      direction: 'incoming',
      transferStatus: file.transferStatus,
      ...buildTransferMetrics(file.transferredBytes, file.size, file.startedAt),
    });
  }

  updateProfile(profile: DeviceProfile) {
    this.profile = profile;
    this.sendJson({ type: DATA_TYPE.profile, ...this.profile });
  }

  isConnectedTo(deviceId: string) {
    return this.peerId === deviceId && this.channel?.readyState === 'open';
  }

  disconnectPeer() {
    this.stopTransportStats();
    this.updateRelayState(false);
    this.failPendingOutgoingTransfers();
    this.failPendingIncomingTransfer();
    this.channel?.close();
    this.channel = undefined;
    this.peer?.close();
    this.peer = undefined;
    this.receivedFile = undefined;
  }

  close() {
    this.closed = true;
    if (this.signalingReconnectTimer) window.clearTimeout(this.signalingReconnectTimer);
    this.disconnectPeer();
    this.socket?.close();
  }

  private openSignalingSocket(forceReconnect = false) {
    if (this.closed) return;
    const socketState = this.socket?.readyState;
    const isSocketActive = socketState === WebSocket.CONNECTING || socketState === WebSocket.OPEN;
    if (!forceReconnect && isSocketActive) return;
    if (forceReconnect && this.socket) {
      this.socket.onopen = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.close();
    }
    if (this.signalingReconnectTimer) {
      window.clearTimeout(this.signalingReconnectTimer);
      this.signalingReconnectTimer = undefined;
    }
    this.signalingFailed = false;
    const socket = new WebSocket(buildSignalingUrl(this.deviceId));
    this.socket = socket;
    this.signalingReady = new Promise((resolve) => {
      socket.onopen = () => resolve();
      socket.onerror = () => {
        this.signalingFailed = true;
        resolve();
        if (!this.closed) {
          this.callbacks.onError(SIGNALING_ERROR());
          this.scheduleSignalingReconnect();
        }
      };
    });
    socket.onclose = () => {
      if (!this.closed) this.scheduleSignalingReconnect();
    };
    socket.onmessage = (event) => void this.handleSignal(JSON.parse(event.data) as Signal);
  }

  private scheduleSignalingReconnect() {
    if (this.closed || this.signalingReconnectTimer) return;
    this.signalingReconnectTimer = window.setTimeout(() => {
      this.signalingReconnectTimer = undefined;
      this.openSignalingSocket(true);
    }, SIGNALING_RETRY_DELAY_MS);
  }

  private createPeer() {
    const peer = new RTCPeerConnection({ iceServers: this.iceServers });
    peer.onicecandidate = (event) => {
      if (event.candidate) this.sendSignal(SIGNAL_TYPE.candidate, event.candidate.toJSON());
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === CONNECTION_STATE.failed || peer.connectionState === CONNECTION_STATE.disconnected || peer.connectionState === CONNECTION_STATE.closed) {
        this.failPendingOutgoingTransfers();
        this.failPendingIncomingTransfer();
        this.callbacks.onClose();
      }
    };
    peer.ondatachannel = (event) => {
      this.channel = event.channel;
      this.bindChannel(event.channel);
    };
    this.peer = peer;
    return peer;
  }

  private bindChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.onopen = async () => {
      this.startTransportStats();
      await this.inspectTransportStats();
      this.callbacks.onOpen();
      this.sendJson({ type: DATA_TYPE.profile, ...this.profile });
    };
    channel.onmessage = (event) => void this.handleData(event.data);
    channel.onclose = () => {
      this.failPendingOutgoingTransfers();
      this.failPendingIncomingTransfer();
      this.callbacks.onClose();
    };
  }

  private failPendingOutgoingTransfers() {
    const transfers = [this.activeOutgoingTransfer, ...this.outgoingQueue];
    this.outgoingQueue = [];
    for (const transfer of transfers) {
      if (!transfer || transfer.transferStatus === TRANSFER_STATUS.completed || transfer.transferStatus === TRANSFER_STATUS.cancelled || transfer.transferStatus === TRANSFER_STATUS.failed) continue;
      transfer.transferStatus = TRANSFER_STATUS.failed;
      transfer.resume?.();
      transfer.resume = undefined;
      this.reportOutgoingTransfer(transfer);
    }
  }

  private failPendingIncomingTransfer() {
    if (!this.receivedFile || this.receivedFile.transferStatus === TRANSFER_STATUS.completed || this.receivedFile.transferStatus === TRANSFER_STATUS.cancelled) return;
    this.receivedFile.transferStatus = TRANSFER_STATUS.failed;
    this.reportIncomingTransfer(this.receivedFile);
    this.receivedFile = undefined;
  }

  private startTransportStats() {
    this.stopTransportStats();
    void this.inspectTransportStats();
    this.transportStatsTimer = window.setInterval(() => {
      void this.inspectTransportStats();
    }, STATS_POLL_INTERVAL_MS);
  }

  private stopTransportStats() {
    if (!this.transportStatsTimer) return;
    window.clearInterval(this.transportStatsTimer);
    this.transportStatsTimer = undefined;
  }

  private updateRelayState(relayActive: boolean) {
    if (this.relayActive === relayActive) return;
    this.relayActive = relayActive;
    this.callbacks.onRelayChange(relayActive);
  }

  private async inspectTransportStats() {
    if (!this.peer) return;
    try {
      const stats = await this.peer.getStats();
      const selectedPair = this.findSelectedCandidatePair(stats);
      if (!selectedPair) return;
      const localCandidate = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) as CandidateReport | undefined : undefined;
      const remoteCandidate = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) as CandidateReport | undefined : undefined;
      const relayActive = localCandidate?.candidateType === RELAY_CANDIDATE_TYPE || remoteCandidate?.candidateType === RELAY_CANDIDATE_TYPE;
      this.updateRelayState(Boolean(relayActive));
    } catch {
      return;
    }
  }

  private findSelectedCandidatePair(stats: RTCStatsReport) {
    for (const report of stats.values()) {
      if (report.type !== TRANSPORT_STAT_TYPE) continue;
      const transportReport = report as TransportReport;
      if (!transportReport.selectedCandidatePairId) continue;
      const selectedPair = stats.get(transportReport.selectedCandidatePairId);
      if (selectedPair) return selectedPair as PairReport;
    }
    for (const report of stats.values()) {
      if (report.type !== CANDIDATE_PAIR_TYPE) continue;
      const pairReport = report as PairReport;
      if (pairReport.nominated || pairReport.selected || pairReport.state === 'succeeded') return pairReport;
    }
    return undefined;
  }

  private async handleSignal(signal: Signal) {
    this.peerId = signal.from;
    this.callbacks.onPeerId(signal.from);
    if (signal.type === SIGNAL_TYPE.offer) {
      this.callbacks.onIncomingConnection();
      this.disconnectPeer();
      const peer = this.createPeer();
      await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.sendSignal(SIGNAL_TYPE.answer, answer);
      return;
    }
    if (!this.peer) return;
    if (signal.type === SIGNAL_TYPE.answer) await this.peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
    if (signal.type === SIGNAL_TYPE.candidate) await this.peer.addIceCandidate(signal.payload as RTCIceCandidateInit);
  }

  private async handleData(data: string | ArrayBuffer | Blob) {
    if (typeof data !== 'string') {
      if (!this.receivedFile) return;
      const chunk = data instanceof Blob ? await data.arrayBuffer() : data;
      this.receivedFile.chunks.push(chunk);
      this.receivedFile.transferredBytes += chunk.byteLength;
      if (this.receivedFile.transferStatus !== TRANSFER_STATUS.paused) this.receivedFile.transferStatus = TRANSFER_STATUS.transferring;
      this.reportIncomingTransfer(this.receivedFile);
      this.sendJson({ type: DATA_TYPE.fileProgress, id: this.receivedFile.id, transferredBytes: this.receivedFile.transferredBytes });
      return;
    }
    const message = JSON.parse(data) as Record<string, string | number>;
    if (message.type === DATA_TYPE.profile) {
      this.callbacks.onPeerProfile({ nickname: String(message.nickname), avatar: String(message.avatar ?? '') });
      return;
    }
    if (message.type === DATA_TYPE.text) {
      this.callbacks.onTransfer({ id: String(Date.now()), name: '', size: 0, type: 'file', sentAt: String(message.sentAt), direction: 'incoming', text: String(message.text) });
      return;
    }
    if (message.type === DATA_TYPE.fileStart) {
      this.receivedFile = { id: String(message.id), name: String(message.name), size: Number(message.size), mime: String(message.mime), chunks: [], sentAt: String(message.sentAt), startedAt: Date.now(), transferredBytes: 0, transferStatus: TRANSFER_STATUS.transferring };
      this.reportIncomingTransfer(this.receivedFile);
      return;
    }
    if (message.type === DATA_TYPE.fileProgress) {
      const transferId = String(message.id);
      const outgoingTransfer = this.outgoingTransfers.get(transferId);
      if (!outgoingTransfer) return;
      const transferredBytes = Math.min(Number(message.transferredBytes), outgoingTransfer.size);
      outgoingTransfer.transferredBytes = transferredBytes;
      if (transferredBytes === outgoingTransfer.size) outgoingTransfer.transferStatus = TRANSFER_STATUS.completed;
      this.reportOutgoingTransfer(outgoingTransfer, transferredBytes);
      if (outgoingTransfer.transferStatus === TRANSFER_STATUS.completed) this.outgoingTransfers.delete(transferId);
      return;
    }
    if (message.type === DATA_TYPE.filePause && this.receivedFile?.id === String(message.id)) {
      this.receivedFile.transferStatus = TRANSFER_STATUS.paused;
      this.reportIncomingTransfer(this.receivedFile);
      return;
    }
    if (message.type === DATA_TYPE.fileResume && this.receivedFile?.id === String(message.id)) {
      this.receivedFile.transferStatus = TRANSFER_STATUS.transferring;
      this.reportIncomingTransfer(this.receivedFile);
      return;
    }
    if (message.type === DATA_TYPE.fileCancel && this.receivedFile?.id === String(message.id)) {
      this.receivedFile.transferStatus = TRANSFER_STATUS.cancelled;
      this.reportIncomingTransfer(this.receivedFile);
      this.receivedFile = undefined;
      return;
    }
    if (message.type === DATA_TYPE.fileEnd && this.receivedFile) {
      const file = this.receivedFile;
      const blob = new Blob(file.chunks, { type: file.mime });
      file.transferStatus = TRANSFER_STATUS.completed;
      this.callbacks.onTransfer({ id: file.id, name: file.name, size: file.size, type: file.mime.startsWith('image/') ? 'image' : 'file', sentAt: file.sentAt, objectUrl: URL.createObjectURL(blob), direction: 'incoming', transferStatus: file.transferStatus, ...buildTransferMetrics(file.size, file.size, file.startedAt) });
      this.sendJson({ type: DATA_TYPE.fileProgress, id: file.id, transferredBytes: file.size });
      this.receivedFile = undefined;
      return;
    }
  }

  private sendJson(payload: object) {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(payload));
  }

  private sendSignal(type: string, payload: RTCSessionDescriptionInit | RTCIceCandidateInit) {
    if (this.socket?.readyState === WebSocket.OPEN && this.peerId) this.socket.send(JSON.stringify({ to: this.peerId, type, payload }));
  }
}

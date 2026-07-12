import type { DeviceProfile } from '../types';
import { translateNow } from './i18n';

const DATA_CHANNEL_NAME = 'yuzu-transfer';
const FILE_CHUNK_SIZE = 64 * 1024;
const SIGNAL_TYPE = { offer: 'offer', answer: 'answer', candidate: 'candidate' } as const;
const DATA_TYPE = { profile: 'profile', text: 'text', fileStart: 'file-start', fileEnd: 'file-end' } as const;
const CONNECTION_STATE = { failed: 'failed', disconnected: 'disconnected', closed: 'closed' } as const;
const DEVELOPMENT_PORT = '5173';
const SIGNALING_PORT = ':8080';
const SIGNALING_ERROR = () => translateNow('peer.signaling');
const DATA_CHANNEL_ERROR = () => translateNow('peer.dataChannel');

export type IncomingTransfer = { id: string; name: string; size: number; type: 'file' | 'image'; sentAt: string; objectUrl?: string; direction: 'incoming' | 'outgoing'; text?: string; progress?: number; transferredBytes?: number; speedBytes?: number; remainingSeconds?: number };
type Callbacks = { onOpen: () => void; onClose: () => void; onTransfer: (item: IncomingTransfer) => void; onFileProgress: (item: IncomingTransfer) => void; onPeerProfile: (profile: DeviceProfile) => void; onPeerId: (deviceId: string) => void; onIncomingConnection: () => void; onError: (message: string) => void };
type Signal = { from: string; type: string; payload: RTCSessionDescriptionInit | RTCIceCandidateInit };
type ReceivedFile = { id: string; name: string; size: number; mime: string; chunks: ArrayBuffer[]; sentAt: string; startedAt: number; transferredBytes: number };

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
  private profile: DeviceProfile;

  constructor(private readonly deviceId: string, profile: DeviceProfile, private readonly callbacks: Callbacks) {
    this.profile = profile;
  }

  connectSignaling() {
    const isDevelopment = location.port === DEVELOPMENT_PORT;
    const port = isDevelopment ? SIGNALING_PORT : location.port ? `:${location.port}` : '';
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${scheme}//${location.hostname}${port}/api/signaling?deviceId=${encodeURIComponent(this.deviceId)}`);
    this.signalingReady = new Promise((resolve) => {
      this.socket!.onopen = () => resolve();
      this.socket!.onerror = () => {
        this.signalingFailed = true;
        if (!this.closed) this.callbacks.onError(SIGNALING_ERROR());
        resolve();
      };
    });
    this.socket.onmessage = (event) => void this.handleSignal(JSON.parse(event.data) as Signal);
  }

  async start(peerId: string) {
    await this.signalingReady;
    if (this.signalingFailed || this.socket?.readyState !== WebSocket.OPEN) throw new Error('signaling unavailable');
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

  async sendFile(file: File, objectUrl?: string, transferId?: string) {
    if (!this.channel || this.channel.readyState !== 'open') throw new Error(DATA_CHANNEL_ERROR());
    const id = transferId ?? `${Date.now()}-${file.name}`;
    const type = file.type.startsWith('image/') ? 'image' : 'file';
    const sentAt = new Date().toISOString();
    const startedAt = Date.now();
    let sentBytes = 0;
    this.callbacks.onFileProgress({ id, name: file.name, size: file.size, type, sentAt, objectUrl, direction: 'outgoing', ...buildTransferMetrics(0, file.size, startedAt) });
    this.sendJson({ type: DATA_TYPE.fileStart, id, name: file.name, size: file.size, mime: file.type, sentAt });
    for (let offset = 0; offset < file.size; offset += FILE_CHUNK_SIZE) {
      const buffer = await file.slice(offset, offset + FILE_CHUNK_SIZE).arrayBuffer();
      this.channel.send(buffer);
      sentBytes += buffer.byteLength;
      this.callbacks.onFileProgress({ id, name: file.name, size: file.size, type, sentAt, objectUrl, direction: 'outgoing', ...buildTransferMetrics(sentBytes, file.size, startedAt) });
    }
    this.sendJson({ type: DATA_TYPE.fileEnd, id });
  }

  updateProfile(profile: DeviceProfile) {
    this.profile = profile;
    this.sendJson({ type: DATA_TYPE.profile, ...this.profile });
  }

  isConnectedTo(deviceId: string) {
    return this.peerId === deviceId && this.channel?.readyState === 'open';
  }

  disconnectPeer() {
    this.channel?.close();
    this.channel = undefined;
    this.peer?.close();
    this.peer = undefined;
    this.receivedFile = undefined;
  }

  close() {
    this.closed = true;
    this.disconnectPeer();
    this.socket?.close();
  }

  private createPeer() {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peer.onicecandidate = (event) => {
      if (event.candidate) this.sendSignal(SIGNAL_TYPE.candidate, event.candidate.toJSON());
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === CONNECTION_STATE.failed || peer.connectionState === CONNECTION_STATE.disconnected || peer.connectionState === CONNECTION_STATE.closed) {
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
    channel.onopen = () => {
      this.callbacks.onOpen();
      this.sendJson({ type: DATA_TYPE.profile, ...this.profile });
    };
    channel.onmessage = (event) => void this.handleData(event.data);
    channel.onclose = () => this.callbacks.onClose();
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
      this.callbacks.onFileProgress({ id: this.receivedFile.id, name: this.receivedFile.name, size: this.receivedFile.size, type: this.receivedFile.mime.startsWith('image/') ? 'image' : 'file', sentAt: this.receivedFile.sentAt, direction: 'incoming', ...buildTransferMetrics(this.receivedFile.transferredBytes, this.receivedFile.size, this.receivedFile.startedAt) });
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
      this.receivedFile = { id: String(message.id), name: String(message.name), size: Number(message.size), mime: String(message.mime), chunks: [], sentAt: String(message.sentAt), startedAt: Date.now(), transferredBytes: 0 };
      this.callbacks.onFileProgress({ id: this.receivedFile.id, name: this.receivedFile.name, size: this.receivedFile.size, type: this.receivedFile.mime.startsWith('image/') ? 'image' : 'file', sentAt: this.receivedFile.sentAt, direction: 'incoming', ...buildTransferMetrics(0, this.receivedFile.size, this.receivedFile.startedAt) });
      return;
    }
    if (message.type === DATA_TYPE.fileEnd && this.receivedFile) {
      const file = this.receivedFile;
      const blob = new Blob(file.chunks, { type: file.mime });
      this.callbacks.onTransfer({ id: file.id, name: file.name, size: file.size, type: file.mime.startsWith('image/') ? 'image' : 'file', sentAt: file.sentAt, objectUrl: URL.createObjectURL(blob), direction: 'incoming', ...buildTransferMetrics(file.size, file.size, file.startedAt) });
      this.receivedFile = undefined;
    }
  }

  private sendJson(payload: object) {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(payload));
  }

  private sendSignal(type: string, payload: RTCSessionDescriptionInit | RTCIceCandidateInit) {
    if (this.socket?.readyState === WebSocket.OPEN && this.peerId) this.socket.send(JSON.stringify({ to: this.peerId, type, payload }));
  }
}

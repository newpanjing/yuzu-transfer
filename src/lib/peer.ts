const DATA_CHANNEL_NAME = 'yuzu-transfer';
const FILE_CHUNK_SIZE = 64 * 1024;
const SIGNAL_TYPE = { offer: 'offer', answer: 'answer', candidate: 'candidate' } as const;
const DATA_TYPE = { profile: 'profile', text: 'text', fileStart: 'file-start', fileEnd: 'file-end' } as const;

export type IncomingTransfer = { id: string; name: string; size: number; type: 'file' | 'image'; sentAt: string; objectUrl?: string; direction: 'incoming' | 'outgoing'; text?: string; progress?: number };
type Callbacks = { onOpen: () => void; onClose: () => void; onTransfer: (item: IncomingTransfer) => void; onFileProgress: (item: IncomingTransfer) => void; onPeerName: (name: string) => void; onPeerId: (deviceId: string) => void; onError: (message: string) => void };
type Signal = { from: string; type: string; payload: RTCSessionDescriptionInit | RTCIceCandidateInit };
type ReceivedFile = { id: string; name: string; size: number; mime: string; chunks: ArrayBuffer[] };

export class PeerTransport {
  private socket?: WebSocket;
  private peer?: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private peerId = '';
  private receivedFile?: ReceivedFile;
  private signalingReady?: Promise<void>;
  private signalingFailed = false;
  private closed = false;

  constructor(private readonly deviceId: string, private readonly nickname: string, private readonly callbacks: Callbacks) {}

  connectSignaling() {
    const isDevelopment = location.port === '5173';
    const port = isDevelopment ? ':8080' : location.port ? `:${location.port}` : '';
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${scheme}//${location.hostname}${port}/api/signaling?deviceId=${encodeURIComponent(this.deviceId)}`);
    this.signalingReady = new Promise((resolve) => {
      this.socket!.onopen = () => resolve();
      this.socket!.onerror = () => {
        this.signalingFailed = true;
        if (!this.closed) this.callbacks.onError('信令连接失败，请检查服务是否可用。');
        resolve();
      };
    });
    this.socket.onmessage = (event) => void this.handleSignal(JSON.parse(event.data) as Signal);
  }

  async start(peerId: string) {
    await this.signalingReady;
    if (this.signalingFailed || this.socket?.readyState !== WebSocket.OPEN) throw new Error('signaling unavailable');
    this.peerId = peerId;
    this.callbacks.onPeerId(peerId);
    const peer = this.createPeer();
    this.channel = peer.createDataChannel(DATA_CHANNEL_NAME, { ordered: true });
    this.bindChannel(this.channel);
    void peer.createOffer().then(async (offer) => { await peer.setLocalDescription(offer); this.sendSignal(SIGNAL_TYPE.offer, offer); });
  }

  sendText(text: string) { this.sendJson({ type: DATA_TYPE.text, text, sentAt: new Date().toISOString() }); }

  async sendFile(file: File, objectUrl?: string) {
    if (!this.channel || this.channel.readyState !== 'open') throw new Error('数据通道尚未连接');
    const id = `${Date.now()}-${file.name}`;
    const type = file.type.startsWith('image/') ? 'image' : 'file';
    let sentBytes = 0;
    this.callbacks.onFileProgress({ id, name: file.name, size: file.size, type, sentAt: new Date().toISOString(), objectUrl, direction: 'outgoing', progress: 0 });
    this.sendJson({ type: DATA_TYPE.fileStart, id, name: file.name, size: file.size, mime: file.type, sentAt: new Date().toISOString() });
    for (let offset = 0; offset < file.size; offset += FILE_CHUNK_SIZE) {
      const buffer = await file.slice(offset, offset + FILE_CHUNK_SIZE).arrayBuffer();
      this.channel.send(buffer);
      sentBytes += buffer.byteLength;
      this.callbacks.onFileProgress({ id, name: file.name, size: file.size, type, sentAt: new Date().toISOString(), objectUrl, direction: 'outgoing', progress: sentBytes / file.size });
    }
    this.sendJson({ type: DATA_TYPE.fileEnd, id });
  }

  close() { this.closed = true; this.channel?.close(); this.peer?.close(); this.socket?.close(); }

  private createPeer() {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peer.onicecandidate = (event) => { if (event.candidate) this.sendSignal(SIGNAL_TYPE.candidate, event.candidate.toJSON()); };
    peer.onconnectionstatechange = () => { if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected' || peer.connectionState === 'closed') this.callbacks.onClose(); };
    peer.ondatachannel = (event) => { this.channel = event.channel; this.bindChannel(event.channel); };
    this.peer = peer;
    return peer;
  }

  private bindChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => { this.callbacks.onOpen(); this.sendJson({ type: DATA_TYPE.profile, nickname: this.nickname }); };
    channel.onmessage = (event) => void this.handleData(event.data);
    channel.onclose = () => this.callbacks.onClose();
  }

  private async handleSignal(signal: Signal) {
    this.peerId = signal.from;
    this.callbacks.onPeerId(signal.from);
    if (signal.type === SIGNAL_TYPE.offer) {
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
    if (typeof data !== 'string') { if (!this.receivedFile) return; const chunk = data instanceof Blob ? await data.arrayBuffer() : data; this.receivedFile.chunks.push(chunk); const loadedBytes = this.receivedFile.chunks.reduce((total, item) => total + item.byteLength, 0); this.callbacks.onFileProgress({ id: this.receivedFile.id, name: this.receivedFile.name, size: this.receivedFile.size, type: this.receivedFile.mime.startsWith('image/') ? 'image' : 'file', sentAt: new Date().toISOString(), direction: 'incoming', progress: Math.min(loadedBytes / this.receivedFile.size, 1) }); return; }
    const message = JSON.parse(data) as Record<string, string | number>;
    if (message.type === DATA_TYPE.profile) { this.callbacks.onPeerName(String(message.nickname)); return; }
    if (message.type === DATA_TYPE.text) { this.callbacks.onTransfer({ id: String(Date.now()), name: '', size: 0, type: 'file', sentAt: String(message.sentAt), direction: 'incoming', text: String(message.text) }); return; }
    if (message.type === DATA_TYPE.fileStart) { this.receivedFile = { id: String(message.id), name: String(message.name), size: Number(message.size), mime: String(message.mime), chunks: [] }; this.callbacks.onFileProgress({ id: this.receivedFile.id, name: this.receivedFile.name, size: this.receivedFile.size, type: this.receivedFile.mime.startsWith('image/') ? 'image' : 'file', sentAt: new Date().toISOString(), direction: 'incoming', progress: 0 }); return; }
    if (message.type === DATA_TYPE.fileEnd && this.receivedFile) { const file = this.receivedFile; const blob = new Blob(file.chunks, { type: file.mime }); this.callbacks.onTransfer({ id: file.id, name: file.name, size: file.size, type: file.mime.startsWith('image/') ? 'image' : 'file', sentAt: new Date().toISOString(), objectUrl: URL.createObjectURL(blob), direction: 'incoming', progress: 1 }); this.receivedFile = undefined; }
  }

  private sendJson(payload: object) { if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(payload)); }
  private sendSignal(type: string, payload: RTCSessionDescriptionInit | RTCIceCandidateInit) { if (this.socket?.readyState === WebSocket.OPEN && this.peerId) this.socket.send(JSON.stringify({ to: this.peerId, type, payload })); }
}

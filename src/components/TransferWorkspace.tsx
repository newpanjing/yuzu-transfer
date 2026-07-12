import { ArrowLeft, Download, File, Image, Paperclip, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PEER_AVATAR } from '../constants';
import { createId } from '../lib/id';
import { useI18n } from '../lib/i18n';
import { AvatarBadge } from './AvatarBadge';
import { ConversationMenu } from './ConversationMenu';
import { FileSaveDialog } from './FileSaveDialog';
import { ImagePreviewDialog } from './ImagePreviewDialog';
import { Toast } from './Toast';
import type { PeerTransport } from '../lib/peer';
import type { TransferItem } from '../types';

type Props = {
  title: string;
  avatar: string;
  blocked: boolean;
  onRenameConversation: () => void;
  onDeleteConversation: () => void;
  onToggleBlocked: () => void;
  relayLimit: number;
  transport?: PeerTransport;
  connected: boolean;
  items: TransferItem[];
  onItemsChange: (items: TransferItem[] | ((current: TransferItem[]) => TransferItem[])) => void;
  onBack?: () => void;
};

const MEBIBYTE = 1024 * 1024;
const formatSize = (size: number) => size < MEBIBYTE ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / MEBIBYTE).toFixed(1)} MB`;
const formatSpeed = (speedBytes = 0) => speedBytes < MEBIBYTE ? `${Math.max(1, Math.round(speedBytes / 1024))} KB/s` : `${(speedBytes / MEBIBYTE).toFixed(1)} MB/s`;

export function TransferWorkspace({ title, avatar, blocked, onRenameConversation, onDeleteConversation, onToggleBlocked, relayLimit, transport, connected, items, onItemsChange, onBack }: Props) {
  const { resolvedLanguage, t } = useI18n();
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<TransferItem>();
  const [pendingSave, setPendingSave] = useState<TransferItem>();
  const [animatedItemId, setAnimatedItemId] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const messageAreaRef = useRef<HTMLElement>(null);
  const latestItemIdRef = useRef('');

  useEffect(() => {
    const latestItem = items.at(-1);
    if (!latestItem || latestItem.id === latestItemIdRef.current) return;
    latestItemIdRef.current = latestItem.id;
    messageAreaRef.current?.scrollTo({ top: messageAreaRef.current.scrollHeight, behavior: 'smooth' });
    if (latestItem.direction !== 'incoming') return;
    setAnimatedItemId(latestItem.id);
    const timer = window.setTimeout(() => {
      setAnimatedItemId((current) => current === latestItem.id ? '' : current);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [items]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const append = (item: TransferItem) => onItemsChange((current) => [...current.filter((currentItem) => currentItem.id !== item.id), item]);
  const formatTime = (sentAt: string) => new Date(sentAt).toLocaleTimeString(resolvedLanguage, { hour: '2-digit', minute: '2-digit' });
  const formatDuration = (seconds = 0) => {
    const rounded = Math.max(0, Math.ceil(seconds));
    if (rounded < 60) return t('duration.seconds', { value: rounded });
    const minutes = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return t('duration.minutes', { minutes, seconds: remainder });
  };
  const formatElapsed = (seconds = 0) => formatDuration(seconds);

  const requirePeerAvailable = () => {
    if (blocked) {
      setNotice(t('error.blockedNotice'));
      return false;
    }
    if (connected && transport) return true;
    setNotice(t('error.offlineNotice'));
    return false;
  };

  const sendText = () => {
    const text = message.trim();
    if (!text || !requirePeerAvailable()) return;
    transport!.sendText(text);
    append({ id: createId(), name: '', size: 0, type: 'file', sentAt: new Date().toISOString(), direction: 'outgoing', text });
    setMessage('');
  };

  const addFiles = async (selected: FileList | null) => {
    if (!selected || !requirePeerAvailable()) return;
    for (const file of Array.from(selected)) {
      if (file.size > relayLimit) {
        setNotice(t('error.relayLimit', { limit: formatSize(relayLimit) }));
        continue;
      }
      const transferId = createId();
      const sentAt = new Date().toISOString();
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      const previewUrl = type === 'image' ? URL.createObjectURL(file) : undefined;
      append({ id: transferId, name: file.name, size: file.size, type, sentAt, direction: 'outgoing', objectUrl: previewUrl, progress: 0, transferredBytes: 0, speedBytes: 0, remainingSeconds: 0 });
      try {
        await transport!.sendFile(file, previewUrl, transferId);
      } catch {
        setNotice(t('error.fileSend'));
      }
    }
  };

  return (
    <main className="workspace">
      <section className="peer-panel">
        {onBack && <button className="chat-back-button" onClick={onBack} aria-label={t('nav.back')}><ArrowLeft size={18} /></button>}
        <AvatarBadge avatarId={avatar || DEFAULT_PEER_AVATAR} online={connected && !blocked} className="peer-avatar" alt={title} />
        <div className="peer-summary">
          <div className="peer-title">{title}</div>
          <div className="peer-subtitle">{t('workspace.sessionNotice')}</div>
        </div>
        <ConversationMenu onRename={onRenameConversation} onToggleBlocked={onToggleBlocked} onDelete={onDeleteConversation} blocked={blocked} />
      </section>

      <section
        ref={messageAreaRef}
        className={isDragging ? 'message-area dragging' : 'message-area'}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); void addFiles(event.dataTransfer.files); }}
      >
        <div className="date-separator">{t('workspace.today')}</div>
        {items.length === 0 && (
          <div className="empty-transfer">
            <Image size={36} />
            <strong>{blocked ? t('workspace.empty.blockedTitle') : connected ? t('workspace.empty.connectedTitle') : t('workspace.empty.offlineTitle')}</strong>
            <span>{blocked ? t('workspace.empty.blockedBody') : connected ? t('workspace.empty.connectedBody') : t('workspace.empty.offlineBody')}</span>
          </div>
        )}
        <div className="message-list">
          {items.map((item) => item.text ? (
            <article className={`text-message ${item.direction} ${animatedItemId === item.id ? 'message-pop' : ''}`} key={item.id}>{item.text}</article>
          ) : (
            <div className={`attachment-entry ${item.direction}`} key={item.id}>
              <article className={`file-message ${item.direction} ${item.expired ? 'file-message expired' : ''} ${animatedItemId === item.id ? 'message-pop' : ''}`}>
                {item.objectUrl && item.type === 'image' ? (
                  <button className="image-thumbnail" onClick={() => setPreview(item)}>
                    <img src={item.objectUrl} alt={item.name} />
                  </button>
                ) : (
                  <span className={item.type === 'image' ? 'file-type image' : 'file-type'}>
                    {item.type === 'image' ? <Image size={21} /> : <File size={21} />}
                  </span>
                )}
                <span>
                  <strong>{item.name}</strong>
                  <small>{formatSize(item.size)}</small>
                  {item.expired && <em className="expired-hint">{item.type === 'image' ? t('workspace.imageExpired') : t('workspace.fileExpired')}</em>}
                  {item.progress !== undefined && item.progress < 1 && <small className="transfer-meta">{formatSize(item.transferredBytes ?? 0)} / {formatSize(item.size)} · {formatSpeed(item.speedBytes)} · {formatElapsed(item.elapsedSeconds)}</small>}
                  {item.progress !== undefined && item.progress < 1 && <span className="transfer-progress"><i style={{ width: `${Math.round(item.progress * 100)}%` }} />{Math.round(item.progress * 100)}%</span>}
                </span>
                {item.direction === 'incoming' && item.objectUrl && !item.expired && (
                  <button className="attachment-download-button" onClick={() => setPendingSave(item)} aria-label={t('workspace.download')}>
                    <Download size={16} />
                  </button>
                )}
              </article>
              <time className={`attachment-time ${item.direction}`}>{formatTime(item.sentAt)}</time>
            </div>
          ))}
        </div>
      </section>

      <section className="composer">
        <input ref={input} hidden type="file" multiple onChange={(event) => void addFiles(event.target.files)} />
        <div className="composer-shell">
          <button className="icon-button" onClick={() => input.current?.click()} aria-label={t('workspace.pickFile')}><Paperclip size={20} /></button>
          <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendText(); }} placeholder={blocked ? t('workspace.input.blocked') : connected ? t('workspace.input.connected') : t('workspace.input.offline')} disabled={blocked} />
          <button className="send-button" onClick={sendText} aria-label={t('workspace.send')} disabled={blocked}><Send size={18} /></button>
        </div>
      </section>

      {notice && <Toast message={notice} />}
      {preview?.objectUrl && <ImagePreviewDialog src={preview.objectUrl} alt={preview.name} onClose={() => setPreview(undefined)} />}
      {pendingSave && <FileSaveDialog item={pendingSave} onClose={() => setPendingSave(undefined)} />}
    </main>
  );
}

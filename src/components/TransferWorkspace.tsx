import { File, Image, Paperclip, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PEER_AVATAR } from '../constants';
import { createId } from '../lib/id';
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
};

const MEBIBYTE = 1024 * 1024;
const OFFLINE_NOTICE = '对方不在线，暂时无法发送消息或文件。';
const BLOCKED_NOTICE = '该会话已屏蔽，解除屏蔽后才能发送或连接。';
const FILE_SEND_ERROR = '文件发送失败，请检查设备连接。';
const EXPIRED_FILE_TEXT = '已过期，无法下载';
const EXPIRED_IMAGE_TEXT = '已过期，无法预览';
const SESSION_NOTICE = '会话数据仅当前页面有效，关闭页面后将丢失。';

const formatSize = (size: number) => size < MEBIBYTE ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / MEBIBYTE).toFixed(1)} MB`;
const formatTime = (sentAt: string) => new Date(sentAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
const formatSpeed = (speedBytes = 0) => speedBytes < MEBIBYTE ? `${Math.max(1, Math.round(speedBytes / 1024))} KB/s` : `${(speedBytes / MEBIBYTE).toFixed(1)} MB/s`;
const formatDuration = (seconds = 0) => {
  const rounded = Math.max(0, Math.ceil(seconds));
  if (rounded < 60) return `${rounded} 秒`;
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes} 分 ${remainder} 秒`;
};

export function TransferWorkspace({ title, avatar, blocked, onRenameConversation, onDeleteConversation, onToggleBlocked, relayLimit, transport, connected, items, onItemsChange }: Props) {
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<TransferItem>();
  const [pendingSave, setPendingSave] = useState<TransferItem>();
  const input = useRef<HTMLInputElement>(null);
  const promptedFiles = useRef(new Set<string>());

  useEffect(() => {
    const received = items.find((item) => item.direction === 'incoming' && item.objectUrl && item.progress === 1 && !promptedFiles.current.has(item.id));
    if (received) {
      promptedFiles.current.add(received.id);
      setPendingSave(received);
    }
  }, [items]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const append = (item: TransferItem) => onItemsChange((current) => [...current.filter((currentItem) => currentItem.id !== item.id), item]);

  const requirePeerAvailable = () => {
    if (blocked) {
      setNotice(BLOCKED_NOTICE);
      return false;
    }
    if (connected && transport) return true;
    setNotice(OFFLINE_NOTICE);
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
        setNotice(`中转文件不可超过 ${formatSize(relayLimit)}`);
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
        setNotice(FILE_SEND_ERROR);
      }
    }
  };

  return (
    <main className="workspace">
      <section className="peer-panel">
        <AvatarBadge avatarId={avatar || DEFAULT_PEER_AVATAR} online={connected && !blocked} className="peer-avatar" alt={title} />
        <div className="peer-summary">
          <div className="peer-title">{title}</div>
          <div className="peer-subtitle">{SESSION_NOTICE}</div>
        </div>
        <ConversationMenu onRename={onRenameConversation} onToggleBlocked={onToggleBlocked} onDelete={onDeleteConversation} blocked={blocked} />
      </section>

      <section
        className={isDragging ? 'message-area dragging' : 'message-area'}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); void addFiles(event.dataTransfer.files); }}
      >
        <div className="date-separator">今天</div>
        {items.length === 0 && (
          <div className="empty-transfer">
            <Image size={36} />
            <strong>{blocked ? '该会话已屏蔽' : connected ? '已建立安全连接' : '对方当前不在线'}</strong>
            <span>{blocked ? '解除屏蔽后才能继续连接和发送' : connected ? '拖入文件、图片或发送消息' : '对方上线后即可发送消息和文件'}</span>
          </div>
        )}
        <div className="message-list">
          {items.map((item) => item.text ? (
            <article className={`text-message ${item.direction}`} key={item.id}>{item.text}</article>
          ) : (
            <article className={`file-message ${item.direction} ${item.expired ? 'file-message expired' : ''}`} key={item.id}>
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
                {item.expired && <em className="expired-hint">{item.type === 'image' ? EXPIRED_IMAGE_TEXT : EXPIRED_FILE_TEXT}</em>}
                {item.progress !== undefined && <small className="transfer-meta">{formatSize(item.transferredBytes ?? 0)} / {formatSize(item.size)} · {formatSpeed(item.speedBytes)} · {item.progress >= 1 ? '已完成' : `剩余 ${formatDuration(item.remainingSeconds)}`}</small>}
                {item.progress !== undefined && item.progress < 1 && <span className="transfer-progress"><i style={{ width: `${Math.round(item.progress * 100)}%` }} />{Math.round(item.progress * 100)}%</span>}
              </span>
              {item.objectUrl && item.type === 'file' && <a href={item.objectUrl} download={item.name}>下载</a>}
              <time>{formatTime(item.sentAt)}</time>
            </article>
          ))}
        </div>
      </section>

      <section className="composer">
        <input ref={input} hidden type="file" multiple onChange={(event) => void addFiles(event.target.files)} />
        <div className="composer-shell">
          <button className="icon-button" onClick={() => input.current?.click()} aria-label="选择文件"><Paperclip size={20} /></button>
          <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendText(); }} placeholder={blocked ? '该会话已屏蔽' : connected ? '输入消息或拖拽文件到此处' : '对方不在线，输入消息后将提示'} disabled={blocked} />
          <button className="send-button" onClick={sendText} aria-label="发送" disabled={blocked}><Send size={18} /></button>
        </div>
      </section>

      {notice && <Toast message={notice} />}
      {preview?.objectUrl && <ImagePreviewDialog src={preview.objectUrl} alt={preview.name} onClose={() => setPreview(undefined)} />}
      {pendingSave && <FileSaveDialog item={pendingSave} onClose={() => setPendingSave(undefined)} />}
    </main>
  );
}

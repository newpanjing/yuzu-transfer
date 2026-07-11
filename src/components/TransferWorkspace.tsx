import { CircleSlash, File, FolderOpen, Image, Paperclip, Pencil, Send, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PEER_AVATAR, ONLINE_STATUS_TEXT } from '../constants';
import { createId } from '../lib/id';
import { FileSaveDialog } from './FileSaveDialog';
import { ImagePreviewDialog } from './ImagePreviewDialog';
import { AvatarBadge } from './AvatarBadge';
import type { PeerTransport } from '../lib/peer';
import type { TransferItem } from '../types';

type Props = {
  nickname: string;
  avatar: string;
  selfNickname: string;
  selfAvatar: string;
  blocked: boolean;
  onNicknameChange: (name: string) => void;
  onAvatarChange: (avatar: string) => void;
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
const NICKNAME_PROMPT = '设置你的昵称';
const AVATAR_PROMPT = '设置你的头像文字（建议 1 到 2 个字）';
const EXPIRED_FILE_TEXT = '已过期，无法下载';
const EXPIRED_IMAGE_TEXT = '已过期，无法预览';
const BLOCKED_STATUS_TEXT = '该会话已屏蔽';

const formatSize = (size: number) => size < MEBIBYTE ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / MEBIBYTE).toFixed(1)} MB`;
const formatTime = (sentAt: string) => new Date(sentAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

export function TransferWorkspace({ nickname, avatar, selfNickname, selfAvatar, blocked, onNicknameChange, onAvatarChange, onDeleteConversation, onToggleBlocked, relayLimit, transport, connected, items, onItemsChange }: Props) {
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
    if (!text) return;
    if (!requirePeerAvailable()) return;
    transport!.sendText(text);
    append({ id: createId(), name: '', size: 0, type: 'file', sentAt: new Date().toISOString(), direction: 'outgoing', text });
    setMessage('');
  };

  const addFiles = async (selected: FileList | null) => {
    if (!selected) return;
    if (!requirePeerAvailable()) return;
    for (const file of Array.from(selected)) {
      if (file.size > relayLimit) {
        setNotice(`中转文件不可超过 ${formatSize(relayLimit)}`);
        continue;
      }
      const transferId = createId();
      const sentAt = new Date().toISOString();
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      const previewUrl = type === 'image' ? URL.createObjectURL(file) : undefined;
      append({ id: transferId, name: file.name, size: file.size, type, sentAt, direction: 'outgoing', objectUrl: previewUrl, progress: 0 });
      try {
        await transport!.sendFile(file, previewUrl, transferId);
      } catch {
        setNotice(FILE_SEND_ERROR);
      }
    }
  };

  const editNickname = () => {
    const next = window.prompt(NICKNAME_PROMPT, selfNickname);
    if (next) onNicknameChange(next);
  };

  const editAvatar = () => {
    const next = window.prompt(AVATAR_PROMPT, selfAvatar);
    if (next) onAvatarChange(next);
  };

  return (
    <main className="workspace">
      <section className="peer-panel">
        <AvatarBadge label={avatar || DEFAULT_PEER_AVATAR} online={connected && !blocked} className="peer-avatar" />
        <div>
          <div className="peer-title">
            与 {nickname} {blocked ? '已屏蔽' : connected ? '传输中' : '离线'}
            <button className="icon-button" onClick={editNickname} aria-label="修改昵称"><Pencil size={14} /></button>
            <button className="icon-button" onClick={editAvatar} aria-label="修改头像"><AvatarBadge label={selfAvatar} className="self-avatar-chip" /></button>
            <button className="icon-button" onClick={onToggleBlocked} aria-label={blocked ? '解除屏蔽会话' : '屏蔽会话'}><CircleSlash size={14} /></button>
            <button className="icon-button" onClick={onDeleteConversation} aria-label="删除会话"><Trash2 size={14} /></button>
          </div>
          <span className={blocked ? 'connection blocked' : connected ? 'connection online' : 'connection offline'}>
            {blocked ? <CircleSlash size={13} /> : connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            {' '}
            {blocked ? BLOCKED_STATUS_TEXT : connected ? ONLINE_STATUS_TEXT.online : ONLINE_STATUS_TEXT.offline}
          </span>
        </div>
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
                {item.progress !== undefined && item.progress < 1 && (
                  <span className="transfer-progress">
                    <i style={{ width: `${Math.round(item.progress * 100)}%` }} />
                    {Math.round(item.progress * 100)}%
                  </span>
                )}
              </span>
              {item.objectUrl && item.type === 'file' && <a href={item.objectUrl} download={item.name}>下载</a>}
              <time>{formatTime(item.sentAt)}</time>
            </article>
          ))}
        </div>
      </section>

      <section className="composer">
        {notice && <span className="notice">{notice}</span>}
        <input ref={input} hidden type="file" multiple onChange={(event) => void addFiles(event.target.files)} />
        <button className="icon-button" onClick={() => input.current?.click()} aria-label="选择文件"><Paperclip size={20} /></button>
        <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendText(); }} placeholder={blocked ? '该会话已屏蔽' : connected ? '输入消息或拖拽文件到此处' : '对方不在线，输入消息后将提示'} disabled={blocked} />
        <button className="icon-button" onClick={() => input.current?.click()} aria-label="文件夹"><FolderOpen size={20} /></button>
        <button className="send-button" onClick={sendText} aria-label="发送" disabled={blocked}><Send size={18} /></button>
      </section>

      {preview?.objectUrl && <ImagePreviewDialog src={preview.objectUrl} alt={preview.name} onClose={() => setPreview(undefined)} />}
      {pendingSave && <FileSaveDialog item={pendingSave} onClose={() => setPendingSave(undefined)} />}
    </main>
  );
}

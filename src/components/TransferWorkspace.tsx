import { File, FolderOpen, Image, Paperclip, Pencil, Send, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createId } from '../lib/id';
import { FileSaveDialog } from './FileSaveDialog';
import { ImagePreviewDialog } from './ImagePreviewDialog';
import type { PeerTransport } from '../lib/peer';
import type { TransferItem } from '../types';

type Props = { nickname: string; onNicknameChange: (name: string) => void; relayLimit: number; transport?: PeerTransport; connected: boolean; items: TransferItem[]; onItemsChange: (items: TransferItem[] | ((current: TransferItem[]) => TransferItem[])) => void };
const MEBIBYTE = 1024 * 1024;
const OFFLINE_NOTICE = '对方不在线，暂时无法发送消息或文件。';
const FILE_SEND_ERROR = '文件发送失败，请检查设备连接。';
const formatSize = (size: number) => size < MEBIBYTE ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / MEBIBYTE).toFixed(1)} MB`;
const time = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

export function TransferWorkspace({ nickname, onNicknameChange, relayLimit, transport, connected, items, onItemsChange }: Props) {
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<TransferItem>();
  const [pendingSave, setPendingSave] = useState<TransferItem>();
  const input = useRef<HTMLInputElement>(null);
  const promptedFiles = useRef(new Set<string>());
  useEffect(() => { const received = items.find((item) => item.direction === 'incoming' && item.objectUrl && item.progress === 1 && !promptedFiles.current.has(item.id)); if (received) { promptedFiles.current.add(received.id); setPendingSave(received); } }, [items]);
  const append = (item: TransferItem) => onItemsChange((current) => [...current, item]);
  const requirePeerOnline = () => { if (connected && transport) return true; setNotice(OFFLINE_NOTICE); return false; };
  const sendText = () => { const text = message.trim(); if (!text) return; if (!requirePeerOnline()) return; transport!.sendText(text); append({ id: createId(), name: '', size: 0, type: 'file', sentAt: new Date().toISOString(), direction: 'outgoing', text }); setMessage(''); };
  const addFiles = async (selected: FileList | null) => {
    if (!selected) return;
    if (!requirePeerOnline()) return;
    for (const file of Array.from(selected)) {
      if (file.size > relayLimit) { setNotice(`中转文件不可超过 ${formatSize(relayLimit)}`); continue; }
      try { await transport!.sendFile(file, file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined); }
      catch { setNotice(FILE_SEND_ERROR); }
    }
  };
  return <main className="workspace"><section className="peer-panel"><div className="peer-avatar">柚</div><div><div className="peer-title">与 {nickname} {connected ? '传输中' : '离线'} <button className="icon-button" onClick={() => { const next = window.prompt('设置你的昵称', nickname); if (next) onNicknameChange(next); }}><Pencil size={14} /></button></div><span className={connected ? 'connection online' : 'connection offline'}>{connected ? <Wifi size={13} /> : <WifiOff size={13} />} {connected ? '对方在线 · 局域网优先' : '对方不在线'}</span></div></section><section className={isDragging ? 'message-area dragging' : 'message-area'} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void addFiles(event.dataTransfer.files); }}><div className="date-separator">今天</div>{items.length === 0 && <div className="empty-transfer"><Image size={36} /><strong>{connected ? '已建立安全连接' : '对方当前不在线'}</strong><span>{connected ? '拖入文件、图片或发送消息' : '对方上线后即可发送消息和文件'}</span></div>}<div className="message-list">{items.map((item) => item.text ? <article className={`text-message ${item.direction}`} key={item.id}>{item.text}</article> : <article className={`file-message ${item.direction}`} key={item.id}>{item.objectUrl && item.type === 'image' ? <button className="image-thumbnail" onClick={() => setPreview(item)}><img src={item.objectUrl} alt={item.name} /></button> : <span className={item.type === 'image' ? 'file-type image' : 'file-type'}>{item.type === 'image' ? <Image size={21} /> : <File size={21} />}</span>}<span><strong>{item.name}</strong><small>{formatSize(item.size)}</small>{item.progress !== undefined && item.progress < 1 && <span className="transfer-progress"><i style={{ width: `${Math.round(item.progress * 100)}%` }} />{Math.round(item.progress * 100)}%</span>}</span>{item.objectUrl && item.type === 'file' && <a href={item.objectUrl} download={item.name}>下载</a>}<time>{time()}</time></article>)}</div></section><section className="composer">{notice && <span className="notice">{notice}</span>}<input ref={input} hidden type="file" multiple onChange={(event) => void addFiles(event.target.files)} /><button className="icon-button" onClick={() => input.current?.click()} aria-label="选择文件"><Paperclip size={20} /></button><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendText(); }} placeholder={connected ? '输入消息或拖拽文件到此处' : '对方不在线，输入消息后将提示'} /><button className="icon-button" onClick={() => input.current?.click()} aria-label="文件夹"><FolderOpen size={20} /></button><button className="send-button" onClick={sendText} aria-label="发送"><Send size={18} /></button></section>{preview?.objectUrl && <ImagePreviewDialog src={preview.objectUrl} alt={preview.name} onClose={() => setPreview(undefined)} />}{pendingSave && <FileSaveDialog item={pendingSave} onClose={() => setPendingSave(undefined)} />}</main>;
}

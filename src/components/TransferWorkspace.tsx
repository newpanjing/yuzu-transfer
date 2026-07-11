import { File, FolderOpen, Image, Paperclip, Pencil, Send, Smile, Wifi, WifiOff } from 'lucide-react';
import { useRef, useState } from 'react';
import { createId } from '../lib/id';
import type { PeerTransport } from '../lib/peer';
import type { TransferItem } from '../types';

type Props = { nickname: string; onNicknameChange: (name: string) => void; relayLimit: number; transport?: PeerTransport; connected: boolean; items: TransferItem[]; onItemsChange: (items: TransferItem[] | ((current: TransferItem[]) => TransferItem[])) => void };
const MEBIBYTE = 1024 * 1024;
const formatSize = (size: number) => size < MEBIBYTE ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / MEBIBYTE).toFixed(1)} MB`;
const time = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

export function TransferWorkspace({ nickname, onNicknameChange, relayLimit, transport, connected, items, onItemsChange }: Props) {
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const append = (item: TransferItem) => onItemsChange((current) => [...current, item]);
  const sendText = () => { const text = message.trim(); if (!text || !connected || !transport) return; transport.sendText(text); append({ id: createId(), name: '', size: 0, type: 'file', sentAt: new Date().toISOString(), direction: 'outgoing', text }); setMessage(''); };
  const addFiles = async (selected: FileList | null) => {
    if (!selected || !transport || !connected) return;
    for (const file of Array.from(selected)) {
      if (file.size > relayLimit) { setNotice(`中转文件不可超过 ${formatSize(relayLimit)}`); continue; }
      try { await transport.sendFile(file); append({ id: createId(), name: file.name, size: file.size, type: file.type.startsWith('image/') ? 'image' : 'file', sentAt: new Date().toISOString(), direction: 'outgoing' }); }
      catch { setNotice('文件发送失败，请检查设备连接。'); }
    }
  };
  return <main className="workspace"><section className="peer-panel"><div className="peer-avatar">柚</div><div><div className="peer-title">与 {nickname} {connected ? '传输中' : '连接中'} <button className="icon-button" onClick={() => { const next = window.prompt('设置你的昵称', nickname); if (next) onNicknameChange(next); }}><Pencil size={14} /></button></div><span className="connection">{connected ? <Wifi size={13} /> : <WifiOff size={13} />} {connected ? '已连接 · 局域网优先' : '正在建立安全连接'}</span></div></section><section className="message-area"><div className="date-separator">今天</div>{items.length === 0 && <div className="empty-transfer"><Image size={36} /><strong>{connected ? '已建立安全连接' : '等待对方接受连接'}</strong><span>拖入文件、图片或发送消息</span></div>}{items.map((item) => item.text ? <article className={`text-message ${item.direction}`} key={item.id}>{item.text}</article> : <article className={`file-message ${item.direction}`} key={item.id}>{item.objectUrl && item.type === 'image' ? <img className="image-preview" src={item.objectUrl} alt={item.name} /> : <span className={item.type === 'image' ? 'file-type image' : 'file-type'}>{item.type === 'image' ? <Image size={21} /> : <File size={21} />}</span>}<span><strong>{item.name}</strong><small>{formatSize(item.size)}</small></span>{item.objectUrl && <a href={item.objectUrl} download={item.name}>下载</a>}<time>{time()}</time></article>)}</section><section className="composer">{notice && <span className="notice">{notice}</span>}<input ref={input} hidden type="file" multiple onChange={(event) => void addFiles(event.target.files)} /><button className="icon-button" onClick={() => input.current?.click()} aria-label="选择文件" disabled={!connected}><Paperclip size={20} /></button><input value={message} disabled={!connected} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendText(); }} placeholder={connected ? '输入消息或拖拽文件到此处' : '正在连接设备...'} /><button className="icon-button" aria-label="表情" disabled={!connected}><Smile size={20} /></button><button className="icon-button" onClick={() => input.current?.click()} aria-label="文件夹" disabled={!connected}><FolderOpen size={20} /></button><button className="send-button" onClick={sendText} disabled={!connected} aria-label="发送"><Send size={18} /></button></section></main>;
}

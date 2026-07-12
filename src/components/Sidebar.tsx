import { CircleHelp, Link2, MessageCircle, Settings } from 'lucide-react';
import { AvatarBadge } from './AvatarBadge';
import type { Conversation, View } from '../types';

const BLOCKED_PREVIEW_TEXT = '该会话已屏蔽';
const DEFAULT_PREVIEW_TEXT = '已建立连接';

type Props = { conversations: Conversation[]; activeDeviceId: string | null; activeView: View; onConnect: () => void; onSettings: () => void; onAbout: () => void; onSelect: (deviceId: string) => void };

export function Sidebar({ conversations, activeDeviceId, activeView, onConnect, onSettings, onAbout, onSelect }: Props) {
  return <aside className="sidebar"><button className={activeView === 'connect' ? 'nav-item active' : 'nav-item'} onClick={onConnect}><Link2 size={18} />连接新设备</button><div className="conversation-label"><MessageCircle size={15} /> 会话</div><div className="conversation-list">{conversations.length === 0 ? <span className="empty-conversations">连接设备后，会话会显示在这里</span> : conversations.map((conversation) => <button key={conversation.deviceId} className={conversation.deviceId === activeDeviceId && activeView === 'transfer' ? 'conversation-item selected' : 'conversation-item'} onClick={() => onSelect(conversation.deviceId)}><AvatarBadge avatarId={conversation.avatar} online={conversation.online && !conversation.blocked} className="conversation-avatar" alt={conversation.remark ?? conversation.nickname} /><span><strong>{conversation.remark ?? conversation.nickname}</strong><small>{conversation.blocked ? BLOCKED_PREVIEW_TEXT : conversation.messages.at(-1)?.text ?? conversation.messages.at(-1)?.name ?? DEFAULT_PREVIEW_TEXT}</small></span></button>)}</div><div className="nav-spacer" /><button className={activeView === 'settings' ? 'nav-item active' : 'nav-item'} onClick={onSettings}><Settings size={18} />设置</button><button className={activeView === 'about' ? 'nav-item active' : 'nav-item'} onClick={onAbout}><CircleHelp size={18} />关于</button></aside>;
}

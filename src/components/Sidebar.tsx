import { CircleHelp, Link2, MessageCircle, Settings } from 'lucide-react';
import { AvatarBadge } from './AvatarBadge';
import type { Conversation } from '../types';

const BLOCKED_PREVIEW_TEXT = '该会话已屏蔽';
const DEFAULT_PREVIEW_TEXT = '已建立连接';

type Props = { conversations: Conversation[]; activeDeviceId: string | null; onConnect: () => void; onSelect: (deviceId: string) => void };

export function Sidebar({ conversations, activeDeviceId, onConnect, onSelect }: Props) {
  return <aside className="sidebar"><button className="nav-item active" onClick={onConnect}><Link2 size={18} />连接新设备</button><div className="conversation-label"><MessageCircle size={15} /> 会话</div><div className="conversation-list">{conversations.length === 0 ? <span className="empty-conversations">连接设备后，会话会显示在这里</span> : conversations.map((conversation) => <button key={conversation.deviceId} className={conversation.deviceId === activeDeviceId ? 'conversation-item selected' : 'conversation-item'} onClick={() => onSelect(conversation.deviceId)}><AvatarBadge label={conversation.avatar} online={conversation.online && !conversation.blocked} className="conversation-avatar" /><span><strong>{conversation.nickname}</strong><small>{conversation.blocked ? BLOCKED_PREVIEW_TEXT : conversation.messages.at(-1)?.text ?? conversation.messages.at(-1)?.name ?? DEFAULT_PREVIEW_TEXT}</small></span></button>)}</div><div className="nav-spacer" /><button className="nav-item"><Settings size={18} />设置</button><button className="nav-item"><CircleHelp size={18} />关于</button></aside>;
}

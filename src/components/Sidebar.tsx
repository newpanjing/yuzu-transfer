import { CircleHelp, Link2, MessageCircle, Settings } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { AvatarBadge } from './AvatarBadge';
import type { Conversation, View } from '../types';

type Props = { conversations: Conversation[]; activeDeviceId: string | null; activeView: View; onConnect: () => void; onSettings: () => void; onAbout: () => void; onSelect: (deviceId: string) => void };

export function Sidebar({ conversations, activeDeviceId, activeView, onConnect, onSettings, onAbout, onSelect }: Props) {
  const { t } = useI18n();
  return <aside className="sidebar"><button className={activeView === 'connect' ? 'nav-item active' : 'nav-item'} onClick={onConnect}><Link2 size={18} />{t('nav.connect')}</button><div className="conversation-label"><MessageCircle size={15} /> {t('nav.conversations')}</div><div className="conversation-list">{conversations.length === 0 ? <span className="empty-conversations">{t('sidebar.empty')}</span> : conversations.map((conversation) => <button key={conversation.deviceId} className={conversation.deviceId === activeDeviceId && activeView === 'transfer' ? 'conversation-item selected' : 'conversation-item'} onClick={() => onSelect(conversation.deviceId)}><AvatarBadge avatarId={conversation.avatar} online={conversation.online && !conversation.blocked} className="conversation-avatar" alt={conversation.remark ?? conversation.nickname} /><span><strong>{conversation.remark ?? conversation.nickname}</strong><small>{conversation.blocked ? t('sidebar.preview.blocked') : conversation.messages.at(-1)?.text ?? conversation.messages.at(-1)?.name ?? t('sidebar.preview.connected')}</small></span></button>)}</div><div className="nav-spacer" /><button className={activeView === 'settings' ? 'nav-item active' : 'nav-item'} onClick={onSettings}><Settings size={18} />{t('nav.settings')}</button><button className={activeView === 'about' ? 'nav-item active' : 'nav-item'} onClick={onAbout}><CircleHelp size={18} />{t('nav.about')}</button></aside>;
}

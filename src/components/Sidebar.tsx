import { CircleHelp, Link2, MessageCircle, Settings } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { ConversationList } from './ConversationList';
import type { Conversation, View } from '../types';

type Props = { conversations: Conversation[]; activeDeviceId: string | null; activeView: View; onConnect: () => void; onSettings: () => void; onAbout: () => void; onSelect: (deviceId: string) => void };

export function Sidebar({ conversations, activeDeviceId, activeView, onConnect, onSettings, onAbout, onSelect }: Props) {
  const { t } = useI18n();
  return <aside className="sidebar"><button className={activeView === 'connect' ? 'nav-item active' : 'nav-item'} onClick={onConnect}><Link2 size={18} />{t('nav.connect')}</button><div className="conversation-label"><MessageCircle size={15} /> {t('nav.conversations')}</div><ConversationList conversations={conversations} activeDeviceId={activeDeviceId} selected={activeView === 'transfer'} onSelect={onSelect} /><div className="nav-spacer" /><button className={activeView === 'settings' ? 'nav-item active' : 'nav-item'} onClick={onSettings}><Settings size={18} />{t('nav.settings')}</button><button className={activeView === 'about' ? 'nav-item active' : 'nav-item'} onClick={onAbout}><CircleHelp size={18} />{t('nav.about')}</button></aside>;
}

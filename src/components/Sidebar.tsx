import { BookOpenText, MessageCircle, Plus, Settings } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Brand } from './Brand';
import { ConversationList } from './ConversationList';
import type { Conversation, View } from '../types';

type Props = { conversations: Conversation[]; activeDeviceId: string | null; activeView: View; onConnect: () => void; onTutorial: () => void; onSettings: () => void; onSelect: (deviceId: string) => void };

export function Sidebar({ conversations, activeDeviceId, activeView, onConnect, onTutorial, onSettings, onSelect }: Props) {
  const { t } = useI18n();
  return <aside className="sidebar"><div className="sidebar-brand"><Brand /></div><button className={activeView === 'connect' ? 'nav-item nav-item--primary active' : 'nav-item nav-item--primary'} onClick={onConnect}><Plus size={18} />{t('nav.connect')}</button><div className="conversation-label"><MessageCircle size={15} /> {t('nav.conversations')}</div><ConversationList conversations={conversations} activeDeviceId={activeDeviceId} selected={activeView === 'transfer'} onSelect={onSelect} /><div className="nav-spacer" /><button className={activeView === 'tutorial' ? 'nav-item active' : 'nav-item'} onClick={onTutorial}><BookOpenText size={18} />{t('nav.tutorial')}</button><button className={activeView === 'settings' || activeView === 'about' ? 'nav-item active' : 'nav-item'} onClick={onSettings}><Settings size={18} />{t('nav.settings')}</button></aside>;
}

import { BookOpenText, MessageCircle, Plus, Settings } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { View } from '../types';

type Props = {
  activeView: View;
  hasConversations: boolean;
  onConnect: () => void;
  onConversation: () => void;
  onTutorial: () => void;
  onSettings: () => void;
};

export function MobileBottomNav({ activeView, hasConversations, onConnect, onConversation, onTutorial, onSettings }: Props) {
  const { t } = useI18n();
  return (
    <nav className="mobile-bottom-nav" aria-label={t('nav.conversations')}>
      <button className={activeView === 'connect' ? 'mobile-bottom-nav__item mobile-bottom-nav__item--primary active' : 'mobile-bottom-nav__item mobile-bottom-nav__item--primary'} onClick={onConnect}>
        <Plus size={18} />
        <span>{t('nav.connect')}</span>
      </button>
      <button className={activeView === 'transfer' || activeView === 'conversations' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onConversation}>
        <MessageCircle size={18} />
        <span>{hasConversations ? t('nav.conversations') : t('nav.noConversations')}</span>
      </button>
      <button className={activeView === 'tutorial' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onTutorial}>
        <BookOpenText size={18} />
        <span>{t('nav.tutorial')}</span>
      </button>
      <button className={activeView === 'settings' || activeView === 'about' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onSettings}>
        <Settings size={18} />
        <span>{t('nav.settings')}</span>
      </button>
    </nav>
  );
}

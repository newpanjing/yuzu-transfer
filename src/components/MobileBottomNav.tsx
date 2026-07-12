import { CircleHelp, Link2, MessageCircle, Settings } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { View } from '../types';

type Props = {
  activeView: View;
  hasConversations: boolean;
  onConnect: () => void;
  onConversation: () => void;
  onSettings: () => void;
  onAbout: () => void;
};

export function MobileBottomNav({ activeView, hasConversations, onConnect, onConversation, onSettings, onAbout }: Props) {
  const { t } = useI18n();
  return (
    <nav className="mobile-bottom-nav" aria-label={t('header.languageLabel')}>
      <button className={activeView === 'connect' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onConnect}>
        <Link2 size={18} />
        <span>{t('nav.connect')}</span>
      </button>
      <button className={activeView === 'transfer' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onConversation}>
        <MessageCircle size={18} />
        <span>{hasConversations ? t('nav.conversations') : t('nav.noConversations')}</span>
      </button>
      <button className={activeView === 'settings' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onSettings}>
        <Settings size={18} />
        <span>{t('nav.settings')}</span>
      </button>
      <button className={activeView === 'about' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onAbout}>
        <CircleHelp size={18} />
        <span>{t('nav.about')}</span>
      </button>
    </nav>
  );
}

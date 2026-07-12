import { CircleHelp, Link2, MessageCircle, Settings } from 'lucide-react';
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
  return (
    <nav className="mobile-bottom-nav" aria-label="主导航">
      <button className={activeView === 'connect' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onConnect}>
        <Link2 size={18} />
        <span>连接</span>
      </button>
      <button className={activeView === 'transfer' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onConversation}>
        <MessageCircle size={18} />
        <span>{hasConversations ? '会话' : '暂无会话'}</span>
      </button>
      <button className={activeView === 'settings' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onSettings}>
        <Settings size={18} />
        <span>设置</span>
      </button>
      <button className={activeView === 'about' ? 'mobile-bottom-nav__item active' : 'mobile-bottom-nav__item'} onClick={onAbout}>
        <CircleHelp size={18} />
        <span>关于</span>
      </button>
    </nav>
  );
}

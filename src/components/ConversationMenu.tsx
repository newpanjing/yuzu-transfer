import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';

type Props = {
  onToggleBlocked: () => void;
  onDelete: () => void;
  blocked: boolean;
};

export function ConversationMenu({ onToggleBlocked, onDelete, blocked }: Props) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (host.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  const handle = (action: () => void) => {
    setOpen(false);
    action();
  };

  return <div className="conversation-menu" ref={host}><button className="icon-button" onClick={() => setOpen((current) => !current)} aria-label={t('conversation.actions')}><MoreHorizontal size={16} /></button>{open && <div className="conversation-menu__dropdown"><button onClick={() => handle(onToggleBlocked)}>{blocked ? t('conversation.unblock') : t('conversation.block')}</button><button className="danger" onClick={() => handle(onDelete)}>{t('conversation.delete')}</button></div>}</div>;
}

import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  onRename: () => void;
  onToggleBlocked: () => void;
  onDelete: () => void;
  blocked: boolean;
};

export function ConversationMenu({ onRename, onToggleBlocked, onDelete, blocked }: Props) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);

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

  return <div className="conversation-menu" ref={host}><button className="icon-button" onClick={() => setOpen((current) => !current)} aria-label="会话操作"><MoreHorizontal size={16} /></button>{open && <div className="conversation-menu__dropdown"><button onClick={() => handle(onRename)}>改名</button><button onClick={() => handle(onToggleBlocked)}>{blocked ? '解除屏蔽' : '屏蔽会话'}</button><button className="danger" onClick={() => handle(onDelete)}>删除会话</button></div>}</div>;
}

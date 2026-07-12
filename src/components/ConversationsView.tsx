import { MessageCircle } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { ConversationList } from './ConversationList';
import type { Conversation } from '../types';

type Props = {
  conversations: Conversation[];
  activeDeviceId: string | null;
  onSelect: (deviceId: string) => void;
};

export function ConversationsView({ conversations, activeDeviceId, onSelect }: Props) {
  const { t } = useI18n();

  return (
    <main className="connect-view conversations-view">
      <div className="view-heading">
        <span className="eyebrow"><MessageCircle size={17} /> {t('nav.conversations')}</span>
        <h1>{t('nav.conversations')}</h1>
        <p>{t('sidebar.empty')}</p>
      </div>
      <section className="conversations-panel">
        <ConversationList conversations={conversations} activeDeviceId={activeDeviceId} selected onSelect={onSelect} />
      </section>
    </main>
  );
}

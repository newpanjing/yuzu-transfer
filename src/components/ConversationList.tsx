import { AvatarBadge } from './AvatarBadge';
import { useI18n } from '../lib/i18n';
import type { Conversation } from '../types';

type Props = {
  conversations: Conversation[];
  activeDeviceId: string | null;
  selected: boolean;
  onSelect: (deviceId: string) => void;
};

export function ConversationList({ conversations, activeDeviceId, selected, onSelect }: Props) {
  const { t } = useI18n();

  if (conversations.length === 0) {
    return <span className="empty-conversations">{t('sidebar.empty')}</span>;
  }

  return (
    <div className="conversation-list">
      {conversations.map((conversation) => (
        <button
          key={conversation.deviceId}
          className={conversation.deviceId === activeDeviceId && selected ? 'conversation-item selected' : 'conversation-item'}
          onClick={() => onSelect(conversation.deviceId)}
        >
          <AvatarBadge avatarId={conversation.avatar} online={conversation.online && !conversation.blocked} className="conversation-avatar" alt={conversation.remark ?? conversation.nickname} />
          <span>
            <strong>{conversation.remark ?? conversation.nickname}</strong>
            <small>{conversation.blocked ? t('sidebar.preview.blocked') : conversation.messages.at(-1)?.text ?? conversation.messages.at(-1)?.name ?? t('sidebar.preview.connected')}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

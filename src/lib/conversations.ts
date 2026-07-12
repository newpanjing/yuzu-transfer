import { DEFAULT_PEER_AVATAR, resolveAvatarId, STORAGE_KEYS } from '../constants';
import { translateNow } from './i18n';
import type { Conversation, TransferItem } from '../types';

function restoreTransferItem(item: TransferItem): TransferItem {
  if (!item.objectUrl) return item;
  return { ...item, objectUrl: undefined, expired: true, progress: item.progress === undefined ? undefined : 1 };
}

export function loadConversations(): Conversation[] {
  try {
    return (JSON.parse(sessionStorage.getItem(STORAGE_KEYS.conversations) ?? '[]') as Array<Partial<Conversation> & Pick<Conversation, 'deviceId'>>).map((conversation) => ({
      deviceId: conversation.deviceId,
      nickname: conversation.nickname ?? translateNow('conversation.defaultPeer'),
      remark: conversation.remark,
      avatar: resolveAvatarId(conversation.avatar ?? DEFAULT_PEER_AVATAR),
      online: conversation.online ?? false,
      blocked: conversation.blocked ?? false,
      messages: (conversation.messages ?? []).map((message) => restoreTransferItem(message)),
      lastConnectedAt: conversation.lastConnectedAt ?? new Date().toISOString(),
    }));
  }
  catch { return []; }
}

export function saveConversations(conversations: Conversation[]) {
  sessionStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
}

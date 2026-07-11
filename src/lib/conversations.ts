import { DEFAULT_PEER_AVATAR, DEFAULT_PEER_NICKNAME, STORAGE_KEYS } from '../constants';
import type { Conversation, TransferItem } from '../types';

function restoreTransferItem(item: TransferItem): TransferItem {
  if (!item.objectUrl) return item;
  return { ...item, objectUrl: undefined, expired: true, progress: item.progress === undefined ? undefined : 1 };
}

export function loadConversations(): Conversation[] {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEYS.conversations) ?? '[]') as Array<Partial<Conversation> & Pick<Conversation, 'deviceId'>>).map((conversation) => ({
      deviceId: conversation.deviceId,
      nickname: conversation.nickname ?? DEFAULT_PEER_NICKNAME,
      avatar: conversation.avatar ?? DEFAULT_PEER_AVATAR,
      online: conversation.online ?? false,
      messages: (conversation.messages ?? []).map((message) => restoreTransferItem(message)),
      lastConnectedAt: conversation.lastConnectedAt ?? new Date().toISOString(),
    }));
  }
  catch { return []; }
}

export function saveConversations(conversations: Conversation[]) {
  localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
}

import { DEFAULT_PEER_AVATAR, DEFAULT_PEER_NICKNAME, STORAGE_KEYS } from '../constants';
import type { Conversation } from '../types';

export function loadConversations(): Conversation[] {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEYS.conversations) ?? '[]') as Array<Partial<Conversation> & Pick<Conversation, 'deviceId'>>).map((conversation) => ({
      deviceId: conversation.deviceId,
      nickname: conversation.nickname ?? DEFAULT_PEER_NICKNAME,
      avatar: conversation.avatar ?? DEFAULT_PEER_AVATAR,
      online: conversation.online ?? false,
      messages: conversation.messages ?? [],
      lastConnectedAt: conversation.lastConnectedAt ?? new Date().toISOString(),
    }));
  }
  catch { return []; }
}

export function saveConversations(conversations: Conversation[]) {
  localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
}

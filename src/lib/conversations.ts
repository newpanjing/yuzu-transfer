import { STORAGE_KEYS } from '../constants';
import type { Conversation } from '../types';

export function loadConversations(): Conversation[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.conversations) ?? '[]') as Conversation[]; }
  catch { return []; }
}

export function saveConversations(conversations: Conversation[]) {
  localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations));
}

import type { ResolvedLanguage } from './i18n';

const MESSAGE_TIME_OPTIONS = { hour: '2-digit', minute: '2-digit' } as const;
const CONVERSATION_DATE_OPTIONS = { month: '2-digit', day: '2-digit' } as const;

function isSameDay(value: Date, target: Date) {
  return value.getFullYear() === target.getFullYear() && value.getMonth() === target.getMonth() && value.getDate() === target.getDate();
}

export function formatMessageTime(value: string, language: ResolvedLanguage) {
  return new Date(value).toLocaleTimeString(language, MESSAGE_TIME_OPTIONS);
}

export function formatConversationTime(value: string, language: ResolvedLanguage) {
  const target = new Date(value);
  const now = new Date();
  if (Number.isNaN(target.getTime())) return '';
  return isSameDay(target, now) ? formatMessageTime(value, language) : target.toLocaleDateString(language, CONVERSATION_DATE_OPTIONS);
}

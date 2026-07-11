import { AVATAR_LABELS, DEVICE_NAMES, STORAGE_KEYS } from '../constants';
import { createId } from './id';

export function getDeviceId() { const saved = localStorage.getItem(STORAGE_KEYS.deviceId); if (saved) return saved; const id = createId(); localStorage.setItem(STORAGE_KEYS.deviceId, id); return id; }
export function getNickname() { const saved = localStorage.getItem(STORAGE_KEYS.nickname); if (saved) return saved; const name = `${DEVICE_NAMES[Math.floor(Math.random() * DEVICE_NAMES.length)]}${Math.floor(100 + Math.random() * 900)}`; localStorage.setItem(STORAGE_KEYS.nickname, name); return name; }
export function saveNickname(name: string) { localStorage.setItem(STORAGE_KEYS.nickname, name.trim()); }
export function getAvatar() { const saved = localStorage.getItem(STORAGE_KEYS.avatar); if (saved) return saved; const avatar = AVATAR_LABELS[Math.floor(Math.random() * AVATAR_LABELS.length)]; localStorage.setItem(STORAGE_KEYS.avatar, avatar); return avatar; }
export function saveAvatar(avatar: string) { localStorage.setItem(STORAGE_KEYS.avatar, avatar.trim()); }

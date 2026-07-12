import { AVATAR_OPTIONS, DEVICE_NAMES, resolveAvatarId, STORAGE_KEYS } from '../constants';
import { createId } from './id';

export function getDeviceId() { const saved = sessionStorage.getItem(STORAGE_KEYS.deviceId); if (saved) return saved; const id = createId(); sessionStorage.setItem(STORAGE_KEYS.deviceId, id); return id; }
export function getNickname() { const saved = sessionStorage.getItem(STORAGE_KEYS.nickname); if (saved) return saved; const name = `${DEVICE_NAMES[Math.floor(Math.random() * DEVICE_NAMES.length)]}${Math.floor(100 + Math.random() * 900)}`; sessionStorage.setItem(STORAGE_KEYS.nickname, name); return name; }
export function saveNickname(name: string) { sessionStorage.setItem(STORAGE_KEYS.nickname, name.trim()); }
export function getAvatar() { const saved = sessionStorage.getItem(STORAGE_KEYS.avatar); if (saved) { const resolved = resolveAvatarId(saved); sessionStorage.setItem(STORAGE_KEYS.avatar, resolved); return resolved; } const avatar = AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)].id; sessionStorage.setItem(STORAGE_KEYS.avatar, avatar); return avatar; }
export function saveAvatar(avatar: string) { sessionStorage.setItem(STORAGE_KEYS.avatar, resolveAvatarId(avatar)); }
export function getStoredPairingCode() { return sessionStorage.getItem(STORAGE_KEYS.pairingCode) ?? ''; }
export function savePairingCode(code: string) { sessionStorage.setItem(STORAGE_KEYS.pairingCode, code); }

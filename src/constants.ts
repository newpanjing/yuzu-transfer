export const APP_NAME = '柚子快传';
export const API = { config: '/api/config', pairings: '/api/pairings', exchange: '/api/pairings/exchange', presence: '/api/presence' } as const;
export const STORAGE_KEYS = { deviceId: 'yuzu.device-id', nickname: 'yuzu.nickname', avatar: 'yuzu.avatar', pairingCode: 'yuzu.pairing-code', conversations: 'yuzu.conversations' } as const;
export const DEFAULT_RELAY_LIMIT = 20 * 1024 * 1024;
export const PAIRING_CODE_LENGTH = 4;
export const DEVICE_NAMES = ['青柚', '蜜柚', '柚柚', '小柚'];
export const AVATAR_OPTIONS = [
  { id: 'yuzu-classic', name: '经典柚子', src: '/avatars/yuzu-classic.svg' },
  { id: 'yuzu-leaf', name: '嫩叶柚子', src: '/avatars/yuzu-leaf.svg' },
  { id: 'yuzu-blush', name: '脸红柚子', src: '/avatars/yuzu-blush.svg' },
  { id: 'yuzu-cool', name: '墨镜柚子', src: '/avatars/yuzu-cool.svg' },
  { id: 'yuzu-spark', name: '星光柚子', src: '/avatars/yuzu-spark.svg' },
  { id: 'yuzu-night', name: '夜色柚子', src: '/avatars/yuzu-night.svg' },
] as const;
export const LEGACY_AVATAR_ID_MAP = { 柚: 'yuzu-classic', 传: 'yuzu-leaf', 连: 'yuzu-blush', 快: 'yuzu-cool', 云: 'yuzu-spark', 光: 'yuzu-night' } as const;
export const DEFAULT_PEER_NICKNAME = '新设备';
export const DEFAULT_PEER_AVATAR = AVATAR_OPTIONS[0].id;
export const ONLINE_STATUS_TEXT = { online: '对方在线 · 局域网优先', offline: '对方不在线' } as const;
export const PRESENCE_REFRESH_MS = 15000;

export function resolveAvatarId(value?: string) {
  if (!value) return DEFAULT_PEER_AVATAR;
  const directMatch = AVATAR_OPTIONS.find((option) => option.id === value);
  if (directMatch) return directMatch.id;
  const legacyMatch = LEGACY_AVATAR_ID_MAP[value as keyof typeof LEGACY_AVATAR_ID_MAP];
  return legacyMatch ?? DEFAULT_PEER_AVATAR;
}

export function getAvatarAsset(value?: string) {
  const resolvedId = resolveAvatarId(value);
  return AVATAR_OPTIONS.find((option) => option.id === resolvedId) ?? AVATAR_OPTIONS[0];
}

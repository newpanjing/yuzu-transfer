export const APP_NAME = '柚子快传';
export const API = { config: '/api/config', pairings: '/api/pairings', exchange: '/api/pairings/exchange' } as const;
export const STORAGE_KEYS = { deviceId: 'yuzu.device-id', nickname: 'yuzu.nickname' } as const;
export const DEFAULT_RELAY_LIMIT = 20 * 1024 * 1024;
export const PAIRING_CODE_LENGTH = 4;
export const DEVICE_NAMES = ['青柚', '蜜柚', '柚柚', '小柚'];

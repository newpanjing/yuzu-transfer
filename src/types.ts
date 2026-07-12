export type Pairing = { code: string; expiresAt: string };
export type Presence = { deviceId: string; online: boolean; nickname?: string; avatar?: string };
export type IceServerConfig = { urls: string[]; username?: string; credential?: string };
export type RtcConfig = { relayMaxFileSize: number; iceServers: IceServerConfig[] };
export type DeviceProfile = { nickname: string; avatar: string };
export type TransferItem = { id: string; name: string; size: number; type: 'file' | 'image'; sentAt: string; direction: 'incoming' | 'outgoing'; text?: string; objectUrl?: string; progress?: number; transferredBytes?: number; speedBytes?: number; remainingSeconds?: number; elapsedSeconds?: number; expired?: boolean };
export type View = 'connect' | 'conversations' | 'transfer' | 'settings' | 'about';
export type Conversation = { deviceId: string; nickname: string; remark?: string; avatar: string; online: boolean; blocked: boolean; messages: TransferItem[]; lastConnectedAt: string };

export type Pairing = { code: string; expiresAt: string };
export type Presence = { deviceId: string; online: boolean; nickname?: string; avatar?: string };
export type DeviceProfile = { nickname: string; avatar: string };
export type TransferItem = { id: string; name: string; size: number; type: 'file' | 'image'; sentAt: string; direction: 'incoming' | 'outgoing'; text?: string; objectUrl?: string; progress?: number; transferredBytes?: number; speedBytes?: number; remainingSeconds?: number; expired?: boolean };
export type View = 'connect' | 'transfer';
export type Conversation = { deviceId: string; nickname: string; avatar: string; online: boolean; blocked: boolean; messages: TransferItem[]; lastConnectedAt: string };

export type Pairing = { code: string; expiresAt: string };
export type TransferItem = { id: string; name: string; size: number; type: 'file' | 'image'; sentAt: string };
export type View = 'connect' | 'transfer';

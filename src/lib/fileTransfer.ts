const KIBIBYTE = 1024;
const MEBIBYTE = KIBIBYTE * KIBIBYTE;

export const P2P_FILE_CHUNK_SIZE = 128 * KIBIBYTE;
export const RELAY_FILE_CHUNK_SIZE = 64 * KIBIBYTE;
export const P2P_BUFFER_LOW_THRESHOLD = 4 * MEBIBYTE;
export const P2P_BUFFER_HIGH_WATER_MARK = 8 * MEBIBYTE;
export const RELAY_BUFFER_LOW_THRESHOLD = MEBIBYTE;
export const RELAY_BUFFER_HIGH_WATER_MARK = 2 * MEBIBYTE;
export const FILE_PROGRESS_UPDATE_INTERVAL_MS = 120;

export type FileTransferBufferLimits = {
  lowThreshold: number;
  highWaterMark: number;
};

export type BufferedDataChannelLike = {
  bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  addEventListener: (type: 'bufferedamountlow', listener: () => void, options?: { once?: boolean }) => void;
  send: (data: ArrayBuffer) => void;
};

export function resolveFileChunkSize(relayActive: boolean, maxMessageSize?: number) {
  const configuredSize = relayActive ? RELAY_FILE_CHUNK_SIZE : P2P_FILE_CHUNK_SIZE;
  if (!maxMessageSize || maxMessageSize <= 0) return configuredSize;
  return Math.min(configuredSize, maxMessageSize);
}

export function resolveDataChannelBufferLimits(relayActive: boolean): FileTransferBufferLimits {
  return relayActive
    ? { lowThreshold: RELAY_BUFFER_LOW_THRESHOLD, highWaterMark: RELAY_BUFFER_HIGH_WATER_MARK }
    : { lowThreshold: P2P_BUFFER_LOW_THRESHOLD, highWaterMark: P2P_BUFFER_HIGH_WATER_MARK };
}

export function shouldWaitForBufferedAmount(bufferedAmount: number, highWaterMark: number) {
  return bufferedAmount > highWaterMark;
}

export function waitForDataChannelDrain(channel: BufferedDataChannelLike, lowThreshold: number) {
  channel.bufferedAmountLowThreshold = lowThreshold;
  if (channel.bufferedAmount <= lowThreshold) return Promise.resolve();
  return new Promise<void>((resolve) => {
    channel.addEventListener('bufferedamountlow', () => resolve(), { once: true });
  });
}

export function shouldReportFileProgress(transferredBytes: number, totalBytes: number, lastReportedAt: number, now: number) {
  return transferredBytes >= totalBytes || now - lastReportedAt >= FILE_PROGRESS_UPDATE_INTERVAL_MS;
}

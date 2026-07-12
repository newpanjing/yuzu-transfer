export const P2P_FILE_CHUNK_SIZE = 64 * 1024;
export const RELAY_FILE_CHUNK_SIZE = 16 * 1024;
export const DATA_CHANNEL_BUFFER_LOW_THRESHOLD = 256 * 1024;
export const DATA_CHANNEL_BUFFER_HIGH_WATER_MARK = 512 * 1024;

export type BufferedDataChannelLike = {
  bufferedAmount: number;
  bufferedAmountLowThreshold: number;
  addEventListener: (type: 'bufferedamountlow', listener: () => void, options?: { once?: boolean }) => void;
  send: (data: ArrayBuffer) => void;
};

export function resolveFileChunkSize(relayActive: boolean) {
  return relayActive ? RELAY_FILE_CHUNK_SIZE : P2P_FILE_CHUNK_SIZE;
}

export function shouldWaitForBufferedAmount(bufferedAmount: number) {
  return bufferedAmount > DATA_CHANNEL_BUFFER_HIGH_WATER_MARK;
}

export function waitForDataChannelDrain(channel: BufferedDataChannelLike) {
  channel.bufferedAmountLowThreshold = DATA_CHANNEL_BUFFER_LOW_THRESHOLD;
  if (channel.bufferedAmount <= DATA_CHANNEL_BUFFER_LOW_THRESHOLD) return Promise.resolve();
  return new Promise<void>((resolve) => {
    channel.addEventListener('bufferedamountlow', () => resolve(), { once: true });
  });
}

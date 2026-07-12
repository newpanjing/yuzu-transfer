import {
  FILE_PROGRESS_UPDATE_INTERVAL_MS,
  P2P_FILE_CHUNK_SIZE,
  P2P_BUFFER_HIGH_WATER_MARK,
  P2P_BUFFER_LOW_THRESHOLD,
  RELAY_BUFFER_HIGH_WATER_MARK,
  RELAY_BUFFER_LOW_THRESHOLD,
  RELAY_FILE_CHUNK_SIZE,
  resolveDataChannelBufferLimits,
  resolveFileChunkSize,
  shouldReportFileProgress,
  shouldWaitForBufferedAmount,
  waitForDataChannelDrain,
  type BufferedDataChannelLike,
} from '../src/lib/fileTransfer.js';

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${String(expected)}, got ${String(actual)}`);
  }
}

class FakeBufferedChannel implements BufferedDataChannelLike {
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  private listeners = new Set<() => void>();

  addEventListener(_type: 'bufferedamountlow', listener: () => void) {
    this.listeners.add(listener);
  }

  send(data: ArrayBuffer) {
    this.bufferedAmount += data.byteLength;
  }

  flush(nextBufferedAmount: number) {
    this.bufferedAmount = nextBufferedAmount;
    const listeners = [...this.listeners];
    this.listeners.clear();
    listeners.forEach((listener) => listener());
  }
}

async function run() {
  assertEqual(resolveFileChunkSize(false), P2P_FILE_CHUNK_SIZE);
  assertEqual(resolveFileChunkSize(true), RELAY_FILE_CHUNK_SIZE);
  assertEqual(resolveDataChannelBufferLimits(false).highWaterMark, P2P_BUFFER_HIGH_WATER_MARK);
  assertEqual(resolveDataChannelBufferLimits(false).lowThreshold, P2P_BUFFER_LOW_THRESHOLD);
  assertEqual(resolveDataChannelBufferLimits(true).highWaterMark, RELAY_BUFFER_HIGH_WATER_MARK);
  assertEqual(resolveDataChannelBufferLimits(true).lowThreshold, RELAY_BUFFER_LOW_THRESHOLD);

  assertEqual(shouldWaitForBufferedAmount(P2P_BUFFER_HIGH_WATER_MARK, P2P_BUFFER_HIGH_WATER_MARK), false);
  assertEqual(shouldWaitForBufferedAmount(P2P_BUFFER_HIGH_WATER_MARK + 1, P2P_BUFFER_HIGH_WATER_MARK), true);
  assertEqual(shouldReportFileProgress(256, 1024, 0, FILE_PROGRESS_UPDATE_INTERVAL_MS - 1), false);
  assertEqual(shouldReportFileProgress(256, 1024, 0, FILE_PROGRESS_UPDATE_INTERVAL_MS), true);
  assertEqual(shouldReportFileProgress(1024, 1024, 0, 1), true);

  const channel = new FakeBufferedChannel();
  channel.bufferedAmount = RELAY_BUFFER_HIGH_WATER_MARK + RELAY_FILE_CHUNK_SIZE;

  let drained = false;
  const waitPromise = waitForDataChannelDrain(channel, RELAY_BUFFER_LOW_THRESHOLD).then(() => {
    drained = true;
  });

  assertEqual(channel.bufferedAmountLowThreshold, RELAY_BUFFER_LOW_THRESHOLD);
  assertEqual(drained, false);

  setTimeout(() => channel.flush(RELAY_BUFFER_LOW_THRESHOLD), 0);
  await waitPromise;

  assertEqual(drained, true);

  const buffer = new Uint8Array(RELAY_FILE_CHUNK_SIZE).buffer;
  channel.send(buffer);
  assertEqual(channel.bufferedAmount, RELAY_BUFFER_LOW_THRESHOLD + RELAY_FILE_CHUNK_SIZE);

  console.log('file transfer helpers: ok');
}

void run();

import {
  DATA_CHANNEL_BUFFER_HIGH_WATER_MARK,
  DATA_CHANNEL_BUFFER_LOW_THRESHOLD,
  P2P_FILE_CHUNK_SIZE,
  RELAY_FILE_CHUNK_SIZE,
  resolveFileChunkSize,
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

  flush(nextBufferedAmount = DATA_CHANNEL_BUFFER_LOW_THRESHOLD) {
    this.bufferedAmount = nextBufferedAmount;
    const listeners = [...this.listeners];
    this.listeners.clear();
    listeners.forEach((listener) => listener());
  }
}

async function run() {
  assertEqual(resolveFileChunkSize(false), P2P_FILE_CHUNK_SIZE);
  assertEqual(resolveFileChunkSize(true), RELAY_FILE_CHUNK_SIZE);

  assertEqual(shouldWaitForBufferedAmount(DATA_CHANNEL_BUFFER_HIGH_WATER_MARK), false);
  assertEqual(shouldWaitForBufferedAmount(DATA_CHANNEL_BUFFER_HIGH_WATER_MARK + 1), true);

  const channel = new FakeBufferedChannel();
  channel.bufferedAmount = DATA_CHANNEL_BUFFER_HIGH_WATER_MARK + RELAY_FILE_CHUNK_SIZE;

  let drained = false;
  const waitPromise = waitForDataChannelDrain(channel).then(() => {
    drained = true;
  });

  assertEqual(channel.bufferedAmountLowThreshold, DATA_CHANNEL_BUFFER_LOW_THRESHOLD);
  assertEqual(drained, false);

  setTimeout(() => channel.flush(), 0);
  await waitPromise;

  assertEqual(drained, true);

  const buffer = new Uint8Array(RELAY_FILE_CHUNK_SIZE).buffer;
  channel.send(buffer);
  assertEqual(channel.bufferedAmount, DATA_CHANNEL_BUFFER_LOW_THRESHOLD + RELAY_FILE_CHUNK_SIZE);

  console.log('file transfer helpers: ok');
}

void run();

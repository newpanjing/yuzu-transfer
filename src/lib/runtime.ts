const ENV_SERVER_ORIGIN = import.meta.env.VITE_SERVER_ORIGIN?.trim();
const API_PREFIX = '/api';
const SIGNALING_PATH = '/api/signaling';

function resolveServerOrigin() {
  if (!ENV_SERVER_ORIGIN || ENV_SERVER_ORIGIN === '/') return window.location.origin;
  return ENV_SERVER_ORIGIN;
}

export function buildApiUrl(path: string) {
  return new URL(path, resolveServerOrigin()).toString();
}

export function buildSignalingUrl(deviceId: string, profile: { nickname: string; avatar: string }) {
  const origin = new URL(resolveServerOrigin(), window.location.origin);
  const protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
  const search = new URLSearchParams({ deviceId, nickname: profile.nickname, avatar: profile.avatar });
  return `${protocol}//${origin.host}${SIGNALING_PATH}?${search.toString()}`;
}

export const API_BASE_PREFIX = API_PREFIX;

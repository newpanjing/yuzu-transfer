import { API } from '../constants';
import { buildApiUrl } from './runtime';
import type { Pairing, Presence, RtcConfig } from '../types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(url), init);
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}
export const createPairing = (deviceId: string, forceRefresh = false) => request<Pairing>(API.pairings, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId, forceRefresh }) });
export const exchangePairing = (code: string, deviceId: string) => request<{ peerDeviceId: string }>(API.exchange, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, deviceId }) });
export const getRtcConfig = () => request<RtcConfig>(API.config);
export const getPresence = (deviceIds: string[]) => request<{ devices: Presence[] }>(API.presence, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceIds }) });

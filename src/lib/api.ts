import { API } from '../constants';
import type { Pairing, Presence } from '../types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}
export const createPairing = (deviceId: string) => request<Pairing>(API.pairings, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId }) });
export const exchangePairing = (code: string, deviceId: string) => request<{ peerDeviceId: string }>(API.exchange, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, deviceId }) });
export const getRelayLimit = () => request<{ relayMaxFileSize: number }>(API.config);
export const getPresence = (deviceIds: string[]) => request<{ devices: Presence[] }>(API.presence, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceIds }) });

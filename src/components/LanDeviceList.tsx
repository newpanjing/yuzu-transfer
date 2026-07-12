import { Wifi } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { LanDevice } from '../types';
import { AvatarBadge } from './AvatarBadge';

type Props = { devices: LanDevice[]; busy: boolean; onConnect: (device: LanDevice) => void };

export function LanDeviceList({ devices, busy, onConnect }: Props) {
  const { t } = useI18n();
  if (devices.length === 0) return null;

  return <section className="connection-section connection-section--lan"><span className="connection-icon"><Wifi size={21} /></span><div className="connection-copy"><h2>{t('connect.lan.title')}</h2><p>{t('connect.lan.subtitle')}</p></div><div className="lan-device-list">{devices.map((device) => <button key={device.deviceId} className="lan-device-item" disabled={busy} onClick={() => onConnect(device)}><AvatarBadge avatarId={device.avatar} online={device.online} className="lan-device-avatar" alt={device.nickname} /><span>{device.nickname || t('conversation.defaultPeer')}</span></button>)}</div></section>;
}

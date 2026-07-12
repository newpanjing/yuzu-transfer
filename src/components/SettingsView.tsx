import { Save } from 'lucide-react';
import { AVATAR_OPTIONS } from '../constants';
import { useI18n } from '../lib/i18n';
import { AvatarBadge } from './AvatarBadge';
import { LanguageSwitcher } from './LanguageSwitcher';

type Props = {
  nickname: string;
  avatar: string;
  onNicknameChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
};

export function SettingsView({ nickname, avatar, onNicknameChange, onAvatarChange }: Props) {
  const { t } = useI18n();
  return <main className="connect-view settings-view"><div className="view-heading"><h1>{t('settings.title')}</h1><p>{t('settings.subtitle')}</p></div><section className="settings-panel"><label className="settings-field"><span>{t('settings.nickname')}</span><input value={nickname} onChange={(event) => onNicknameChange(event.target.value)} placeholder={t('settings.nicknamePlaceholder')} /></label><div className="settings-field"><span>{t('settings.avatar')}</span><div className="avatar-options">{AVATAR_OPTIONS.map((item) => <button key={item.id} className={avatar === item.id ? 'avatar-option selected' : 'avatar-option'} onClick={() => onAvatarChange(item.id)} aria-label={t(`avatar.${item.id}` as const)}><AvatarBadge avatarId={item.id} className="settings-avatar" alt={t(`avatar.${item.id}` as const)} /></button>)}</div></div><div className="settings-field"><span>{t('settings.language')}</span><LanguageSwitcher className="language-switcher language-switcher--settings" /></div><div className="settings-save"><Save size={16} /> {t('settings.saved')}</div></section></main>;
}

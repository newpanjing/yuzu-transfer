import { Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AVATAR_OPTIONS } from '../constants';
import { useI18n } from '../lib/i18n';
import { AvatarBadge } from './AvatarBadge';
import { LanguageSwitcher } from './LanguageSwitcher';

type Props = {
  nickname: string;
  avatar: string;
  onSave: (profile: { nickname: string; avatar: string }) => void;
};

export function SettingsView({ nickname, avatar, onSave }: Props) {
  const { t } = useI18n();
  const [draftNickname, setDraftNickname] = useState(nickname);
  const [draftAvatar, setDraftAvatar] = useState(avatar);

  useEffect(() => {
    setDraftNickname(nickname);
  }, [nickname]);

  useEffect(() => {
    setDraftAvatar(avatar);
  }, [avatar]);

  const trimmedNickname = useMemo(() => draftNickname.trim(), [draftNickname]);
  const hasChanges = trimmedNickname !== nickname || draftAvatar !== avatar;

  return <main className="connect-view settings-view"><div className="view-heading"><h1>{t('settings.title')}</h1><p>{t('settings.subtitle')}</p></div><section className="settings-panel"><label className="settings-field"><span>{t('settings.nickname')}</span><input value={draftNickname} onChange={(event) => setDraftNickname(event.target.value)} placeholder={t('settings.nicknamePlaceholder')} /></label><div className="settings-field"><span>{t('settings.avatar')}</span><div className="avatar-options">{AVATAR_OPTIONS.map((item) => <button key={item.id} type="button" className={draftAvatar === item.id ? 'avatar-option selected' : 'avatar-option'} onClick={() => setDraftAvatar(item.id)} aria-label={t(`avatar.${item.id}` as const)}><AvatarBadge avatarId={item.id} className="settings-avatar" alt={t(`avatar.${item.id}` as const)} /></button>)}</div></div><div className="settings-field"><span>{t('settings.language')}</span><LanguageSwitcher className="language-switcher language-switcher--settings" /></div><div className="settings-save"><button type="button" className="primary-button" disabled={!trimmedNickname || !hasChanges} onClick={() => onSave({ nickname: trimmedNickname, avatar: draftAvatar })}><Save size={16} /> {t('settings.save')}</button></div></section></main>;
}

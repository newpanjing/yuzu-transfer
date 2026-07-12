import { ChevronRight, ExternalLink, Mail, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AVATAR_OPTIONS } from '../constants';
import { useI18n } from '../lib/i18n';
import { AvatarBadge } from './AvatarBadge';
import { LanguageSwitcher } from './LanguageSwitcher';

type Props = {
  nickname: string;
  avatar: string;
  onOpenAbout: () => void;
  onSave: (profile: { nickname: string; avatar: string }) => void;
};

const FEEDBACK_EMAIL = 'mailto:newpanjing@icloud.com';

export function SettingsView({ nickname, avatar, onOpenAbout, onSave }: Props) {
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

  return <main className="connect-view settings-view"><div className="view-heading"><h1>{t('settings.title')}</h1><p>{t('settings.subtitle')}</p></div><div className="settings-layout"><section className="settings-panel settings-panel--primary"><div className="settings-section-title"><h2>{t('settings.profileTitle')}</h2><p>{t('settings.profileSubtitle')}</p></div><label className="settings-field"><span>{t('settings.nickname')}</span><input value={draftNickname} onChange={(event) => setDraftNickname(event.target.value)} placeholder={t('settings.nicknamePlaceholder')} /></label><div className="settings-divider" /><div className="settings-section-title"><h2>{t('settings.appearanceTitle')}</h2><p>{t('settings.appearanceSubtitle')}</p></div><div className="settings-field"><span>{t('settings.avatar')}</span><div className="avatar-options">{AVATAR_OPTIONS.map((item) => <button key={item.id} type="button" className={draftAvatar === item.id ? 'avatar-option selected' : 'avatar-option'} onClick={() => setDraftAvatar(item.id)} aria-label={t(`avatar.${item.id}` as const)}><AvatarBadge avatarId={item.id} className="settings-avatar" alt={t(`avatar.${item.id}` as const)} /></button>)}</div></div><div className="settings-divider" /><div className="settings-actions-row"><div className="settings-actions-copy"><strong>{t('settings.language')}</strong><span>{t('settings.appearanceSubtitle')}</span></div><div className="settings-actions-controls"><LanguageSwitcher className="language-switcher language-switcher--settings" /><button type="button" className="primary-button settings-save-button" disabled={!trimmedNickname || !hasChanges} onClick={() => onSave({ nickname: trimmedNickname, avatar: draftAvatar })}><Save size={16} /> {t('settings.save')}</button></div></div></section><aside className="settings-links"><div className="settings-links__header"><h2>{t('settings.moreTitle')}</h2><p>{t('settings.moreSubtitle')}</p></div><a className="about-link" href={FEEDBACK_EMAIL}><span><Mail size={18} /> {t('settings.feedback')}</span><span>newpanjing@icloud.com <ExternalLink size={14} /></span></a><button type="button" className="about-link about-link--button" onClick={onOpenAbout}><span>{t('about.title')}</span><span><ChevronRight size={16} /></span></button></aside></div></main>;
}

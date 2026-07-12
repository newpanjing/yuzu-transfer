import { Save } from 'lucide-react';
import { AVATAR_LABELS } from '../constants';
import { AvatarBadge } from './AvatarBadge';

type Props = {
  nickname: string;
  avatar: string;
  onNicknameChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
};

export function SettingsView({ nickname, avatar, onNicknameChange, onAvatarChange }: Props) {
  return <main className="connect-view settings-view"><div className="view-heading"><h1>设置</h1><p>当前会话仅在本次浏览器 Session 内生效。</p></div><section className="settings-panel"><label className="settings-field"><span>我的昵称</span><input value={nickname} onChange={(event) => onNicknameChange(event.target.value)} placeholder="请输入昵称" /></label><div className="settings-field"><span>我的头像</span><div className="avatar-options">{AVATAR_LABELS.map((item) => <button key={item} className={avatar === item ? 'avatar-option selected' : 'avatar-option'} onClick={() => onAvatarChange(item)}><AvatarBadge label={item} className="settings-avatar" /></button>)}</div></div><div className="settings-save"><Save size={16} /> 已自动保存到当前会话</div></section></main>;
}

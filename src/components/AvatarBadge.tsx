import { getAvatarAsset } from '../constants';

type Props = { avatarId: string; online?: boolean; className?: string; alt?: string };

export function AvatarBadge({ avatarId, online, className, alt }: Props) {
  const avatarClassName = className ? `avatar-badge ${className}` : 'avatar-badge';
  const statusClassName = online ? 'avatar-badge__status avatar-badge__status--online' : 'avatar-badge__status avatar-badge__status--offline';
  const avatarAsset = getAvatarAsset(avatarId);

  return <span className={avatarClassName}><img className="avatar-badge__image" src={avatarAsset.src} alt={alt ?? avatarAsset.name} />{online !== undefined && <span className={statusClassName} />}</span>;
}

type Props = { label: string; online?: boolean; className?: string };

export function AvatarBadge({ label, online, className }: Props) {
  const avatarClassName = className ? `avatar-badge ${className}` : 'avatar-badge';
  const statusClassName = online ? 'avatar-badge__status avatar-badge__status--online' : 'avatar-badge__status avatar-badge__status--offline';

  return <span className={avatarClassName}><span className="avatar-badge__label">{label.slice(0, 2)}</span>{online !== undefined && <span className={statusClassName} />}</span>;
}

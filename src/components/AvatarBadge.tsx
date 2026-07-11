type Props = { label: string; online?: boolean; className?: string };

export function AvatarBadge({ label, online, className }: Props) {
  return <span className={className ?? 'avatar-badge'}><span className="avatar-badge__label">{label.slice(0, 2)}</span>{online !== undefined && <span className={online ? 'avatar-badge__status avatar-badge__status--online' : 'avatar-badge__status avatar-badge__status--offline'} />}</span>;
}

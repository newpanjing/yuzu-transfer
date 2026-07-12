import { CircleHelp, X } from 'lucide-react';

type Props = {
  title: string;
  message: string;
  actionLabel: string;
  closeLabel: string;
  onClose: () => void;
};

export function ConnectionHelpDialog({ title, message, actionLabel, closeLabel, onClose }: Props) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="error-dialog" role="dialog" aria-modal="true" aria-labelledby="connection-help-title">
        <button className="dialog-close" onClick={onClose} aria-label={closeLabel}>
          <X size={18} />
        </button>
        <span className="dialog-icon">
          <CircleHelp size={25} />
        </span>
        <h2 id="connection-help-title">{title}</h2>
        <p>{message}</p>
        <button className="primary-button" onClick={onClose}>
          {actionLabel}
        </button>
      </section>
    </div>
  );
}

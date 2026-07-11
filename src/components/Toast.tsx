type Props = { message: string };

export function Toast({ message }: Props) {
  return <div className="toast" role="status" aria-live="polite">{message}</div>;
}

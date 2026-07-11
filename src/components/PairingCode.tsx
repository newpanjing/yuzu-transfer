import { PAIRING_CODE_LENGTH } from '../constants';

type Props = { value: string; onChange: (value: string) => void; readOnly?: boolean };
export function PairingCode({ value, onChange, readOnly = false }: Props) {
  const digits = Array.from({ length: PAIRING_CODE_LENGTH }, (_, index) => value[index] ?? '');
  return <div className="code-inputs">{digits.map((digit, index) => <input aria-label={`验证码第${index + 1}位`} key={index} readOnly={readOnly} value={digit} inputMode="numeric" maxLength={1} onChange={(event) => { const next = value.split(''); next[index] = event.target.value.replace(/\D/g, ''); onChange(next.join('').slice(0, PAIRING_CODE_LENGTH)); }} />)}</div>;
}

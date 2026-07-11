import { useRef } from 'react';
import { PAIRING_CODE_LENGTH } from '../constants';

type Props = { value: string; onChange: (value: string) => void; readOnly?: boolean };
export function PairingCode({ value, onChange, readOnly = false }: Props) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: PAIRING_CODE_LENGTH }, (_, index) => value[index] ?? '');
  const updateDigit = (index: number, digit: string) => { const next = digits; next[index] = digit; onChange(next.join('')); };
  const focusInput = (index: number) => inputRefs.current[index]?.focus();
  return <div className="code-inputs">{digits.map((digit, index) => <input aria-label={`验证码第${index + 1}位`} key={index} ref={(element) => { inputRefs.current[index] = element; }} readOnly={readOnly} value={digit} inputMode="numeric" maxLength={1} onChange={(event) => { const nextDigit = event.target.value.replace(/\D/g, '').slice(-1); updateDigit(index, nextDigit); if (nextDigit && index < PAIRING_CODE_LENGTH - 1) focusInput(index + 1); }} onKeyDown={(event) => { if (event.key !== 'Backspace') return; event.preventDefault(); updateDigit(index, ''); if (index > 0) focusInput(index - 1); }} onPaste={(event) => { const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, PAIRING_CODE_LENGTH - index); if (!pasted) return; event.preventDefault(); const next = [...digits]; pasted.split('').forEach((pastedDigit, offset) => { next[index + offset] = pastedDigit; }); onChange(next.join('')); focusInput(Math.min(index + pasted.length, PAIRING_CODE_LENGTH - 1)); }} />)}</div>;
}

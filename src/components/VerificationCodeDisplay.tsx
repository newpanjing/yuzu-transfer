import { PAIRING_CODE_LENGTH } from '../constants';

type Props = { code: string };
export function VerificationCodeDisplay({ code }: Props) { return <div className="verification-code-display" aria-label={`我的验证码 ${code}`}>{Array.from({ length: PAIRING_CODE_LENGTH }, (_, index) => <span key={index}>{code[index] ?? '-'}</span>)}</div>; }

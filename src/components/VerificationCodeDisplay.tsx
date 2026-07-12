import { PAIRING_CODE_LENGTH } from '../constants';

type Props = { code: string };
export function VerificationCodeDisplay({ code }: Props) { return <div className="verification-code-display" aria-label={`我的验证码 ${code}`}>{code || Array.from({ length: PAIRING_CODE_LENGTH }, () => '-').join('')}</div>; }

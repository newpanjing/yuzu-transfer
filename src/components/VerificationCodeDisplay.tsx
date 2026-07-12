import { PAIRING_CODE_LENGTH } from '../constants';
import { useI18n } from '../lib/i18n';

type Props = { code: string };
export function VerificationCodeDisplay({ code }: Props) { const { t } = useI18n(); return <div className="verification-code-display" aria-label={t('connect.codeAria', { code })}>{code || Array.from({ length: PAIRING_CODE_LENGTH }, () => '-').join('')}</div>; }

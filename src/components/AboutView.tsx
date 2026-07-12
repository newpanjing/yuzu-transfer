import { ArrowLeft, ExternalLink, GitBranch, Globe } from 'lucide-react';
import { useI18n } from '../lib/i18n';

type Props = {
  githubUrl: string;
  onBack: () => void;
};

const WEBSITE_URL = 'https://kc.noondot.com';

export function AboutView({ githubUrl, onBack }: Props) {
  const { t } = useI18n();

  return <main className="connect-view about-view"><div className="view-heading view-heading--subpage"><button type="button" className="subpage-back-button" onClick={onBack} aria-label={t('nav.back')}><ArrowLeft size={16} /></button><div><h1>{t('about.title')}</h1><p>{t('about.subtitle')}</p></div></div><section className="settings-panel settings-panel--about-page"><a className="about-link" href={WEBSITE_URL} target="_blank" rel="noreferrer"><span><Globe size={18} /> {t('about.website')}</span><span>kc.noondot.com <ExternalLink size={14} /></span></a><a className="about-link" href={githubUrl} target="_blank" rel="noreferrer"><span><GitBranch size={18} /> {t('about.github')}</span><span>{githubUrl.replace('https://', '')} <ExternalLink size={14} /></span></a></section></main>;
}

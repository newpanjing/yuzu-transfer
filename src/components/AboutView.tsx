import { ExternalLink, GitBranch, Globe } from 'lucide-react';
import { useI18n } from '../lib/i18n';

type Props = { githubUrl: string };

export function AboutView({ githubUrl }: Props) {
  const { t } = useI18n();
  return <main className="connect-view about-view"><div className="view-heading"><h1>{t('about.title')}</h1><p>{t('about.subtitle')}</p></div><section className="about-panel"><a className="about-link" href="https://file.noondot.com" target="_blank" rel="noreferrer"><span><Globe size={18} /> {t('about.website')}</span><span>file.noondot.com <ExternalLink size={14} /></span></a><a className="about-link" href={githubUrl} target="_blank" rel="noreferrer"><span><GitBranch size={18} /> {t('about.github')}</span><span>{githubUrl.replace('https://', '')} <ExternalLink size={14} /></span></a></section></main>;
}

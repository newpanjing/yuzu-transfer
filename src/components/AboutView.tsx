import { ExternalLink, GitBranch, Globe } from 'lucide-react';

type Props = { githubUrl: string };

export function AboutView({ githubUrl }: Props) {
  return <main className="connect-view about-view"><div className="view-heading"><h1>关于</h1><p>柚子快传是一个基于 WebRTC 的局域网优先直连传输工具。</p></div><section className="about-panel"><a className="about-link" href="https://file.noondot.com" target="_blank" rel="noreferrer"><span><Globe size={18} /> 官网</span><span>file.noondot.com <ExternalLink size={14} /></span></a><a className="about-link" href={githubUrl} target="_blank" rel="noreferrer"><span><GitBranch size={18} /> GitHub</span><span>{githubUrl.replace('https://', '')} <ExternalLink size={14} /></span></a></section></main>;
}

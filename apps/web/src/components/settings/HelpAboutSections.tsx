import { ChevronRight, CircleHelp, ExternalLink, Lightbulb, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { useT } from '../../i18n';
import { toast } from '../../stores/ui';
import { useTips } from '../../stores/tips';
import { AUTHOR, REPO_URL } from '../../config';

export function HelpSection() {
  const t = useT();

  return (
    <>
      <h2 className="section-title">{t('help.title')}</h2>
      <div className="panel">
        <Link href="/help" className="setting setting-link">
          <CircleHelp size={20} className="muted" />
          <div className="grow">
            <div>{t('settings.helpCenter')}</div>
            <div className="faint small">{t('settings.helpCenterHint')}</div>
          </div>
          <ChevronRight size={20} className="faint" />
        </Link>
        <Link href="/welcome" className="setting setting-link">
          <Sparkles size={20} className="muted" />
          <div className="grow">{t('settings.replayIntro')}</div>
          <ChevronRight size={20} className="faint" />
        </Link>
        <button
          className="setting setting-link link-btn"
          style={{ width: '100%', textAlign: 'left' }}
          onClick={() => {
            useTips.getState().resetAll();
            toast(t('settings.tipsReset'));
          }}
        >
          <Lightbulb size={20} className="muted" />
          <div className="grow">{t('settings.resetTips')}</div>
        </button>
      </div>
    </>
  );
}

export function AboutSection() {
  const t = useT();

  return (
    <>
      <h2 className="section-title">{t('settings.about')}</h2>
      <div className="panel">
        <p style={{ marginTop: 0 }}>{t('settings.aboutText')}</p>
        <p className="about-author">
          {t('settings.madeBy')}{' '}
          <a href={AUTHOR.website} target="_blank" rel="noreferrer">
            <strong>{AUTHOR.name}</strong>
          </a>
        </p>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="row">
          <ExternalLink size={16} /> {t('settings.source')}
        </a>
        <a
          href={AUTHOR.github}
          target="_blank"
          rel="noreferrer"
          className="row"
          style={{ marginTop: 8 }}
        >
          <ExternalLink size={16} /> {t('settings.authorGithub')}
        </a>
        <p className="faint small" style={{ marginBottom: 0 }}>
          v{__APP_VERSION__} · © {new Date().getFullYear()} {AUTHOR.name} · MIT
        </p>
      </div>
    </>
  );
}

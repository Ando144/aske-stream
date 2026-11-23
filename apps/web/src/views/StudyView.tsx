import { Link } from 'wouter';
import { useT } from '../i18n';
import { isNative } from '../native/platform';
import { useStudy } from '../stores/study';
import { StudyDone } from '../components/study/StudyDone';
import { StudyFocus } from '../components/study/StudyFocus';
import { StudySetup } from '../components/study/StudySetup';
import '../study.css';

export function StudyView() {
  const t = useT();
  const phase = useStudy((s) => s.phase);
  if (!isNative) {
    return (
      <div className="page">
        <h1>{t('study.title')}</h1>
        <p className="muted">{t('study.webOnly')}</p>
        <Link href="/help/study-mode" className="help-link">
          {t('study.help')}
        </Link>
      </div>
    );
  }
  if (phase === 'running') return <StudyFocus />;
  if (phase === 'done') return <StudyDone />;
  return <StudySetup />;
}

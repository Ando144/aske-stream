import { useT } from '../../i18n';
import { useStudy } from '../../stores/study';

export function StudyDone() {
  const t = useT();
  const minutes = useStudy((s) => s.lastResult?.minutes ?? 0);
  const lastChoice = useStudy((s) => s.lastChoice);
  return (
    <div className="page study-done">
      <h1>{t('study.done.title')}</h1>
      <p>{t('study.done.body', { minutes, count: minutes })}</p>
      <button
        className="btn primary study-big"
        onClick={() => {
          useStudy.getState().dismissDone();
          void useStudy.getState().start(lastChoice.minutes, lastChoice.source);
        }}
      >
        {t('study.done.again')}
      </button>
      <button className="btn study-big" onClick={() => useStudy.getState().dismissDone()}>
        {t('study.done.close')}
      </button>
    </div>
  );
}

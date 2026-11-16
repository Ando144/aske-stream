import { Check, X } from 'lucide-react';
import { Link } from 'wouter';
import { useT, type MessageKey } from '../i18n';
import { useLibrary } from '../stores/library';
import { useRadio } from '../stores/radio';
import { useTips } from '../stores/tips';

interface Step {
  key: MessageKey;
  done: boolean;
  href: string;
}

/** A small checklist at the top of the library until the basics are done. */
export function FirstSteps() {
  const t = useT();
  const hidden = useTips((s) => s.firstStepsHidden);
  const helpVisited = useTips((s) => s.helpVisited);
  const hasSongs = useLibrary((s) => s.order.length > 0);
  const hasPlaylist = useLibrary((s) => s.playlists.length > 0);
  const hasStation = useRadio((s) => s.stations.length > 0);

  const steps: Step[] = [
    { key: 'firstSteps.song', done: hasSongs, href: '/download' },
    { key: 'firstSteps.playlist', done: hasPlaylist, href: '/playlists' },
    { key: 'firstSteps.radio', done: hasStation, href: '/radio' },
    { key: 'firstSteps.help', done: helpVisited, href: '/help' },
  ];
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;

  return (
    <section className="panel first-steps">
      <div className="row">
        <strong className="grow">{t('firstSteps.title')}</strong>
        <span className="faint small">
          {t('firstSteps.progress', { done, total: steps.length })}
        </span>
        <button
          className="icon-btn"
          aria-label={t('firstSteps.hide')}
          onClick={() => useTips.getState().hideFirstSteps()}
        >
          <X size={18} />
        </button>
      </div>
      <ol>
        {steps.map((s) => (
          <li key={s.key} className={s.done ? 'done' : ''}>
            <span className="first-steps-check" aria-hidden>
              {s.done && <Check size={14} />}
            </span>
            {s.done ? (
              <span className="grow">{t(s.key)}</span>
            ) : (
              <Link href={s.href} className="grow">
                {t(s.key)}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

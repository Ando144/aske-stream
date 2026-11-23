import { useState } from 'react';
import { useT } from '../../i18n';
import { useStudy } from '../../stores/study';
import {
  clampStudyMinutes,
  STUDY_MAX_MIN,
  STUDY_MIN_MIN,
  STUDY_PRESETS_MIN,
  type StudySource,
} from '../../study/session';
import { HelpButton } from '../HelpSheet';
import { ScreenTip } from '../ScreenTip';
import { AmbientMixer } from './AmbientMixer';
import { SourcePicker } from './SourcePicker';
import { StudyStats } from './StudyStats';

export function StudySetup() {
  const t = useT();
  const lastChoice = useStudy((s) => s.lastChoice);
  const [minutes, setMinutes] = useState(lastChoice.minutes);
  const [source, setSource] = useState<StudySource>(lastChoice.source);
  const isPreset = (STUDY_PRESETS_MIN as readonly number[]).includes(minutes);

  return (
    <div className="page study-setup">
      <header className="page-header">
        <h1>{t('study.title')}</h1>
        <HelpButton id="study-mode" label={t('study.help')} />
      </header>
      <ScreenTip id="study-pin" text="study.tip" helpId="study-mode" />
      <p className="muted">{t('study.intro')}</p>

      <div className="study-section">
        <h2>{t('study.duration')}</h2>
        <div className="chips">
          {STUDY_PRESETS_MIN.map((m) => (
            <button
              key={m}
              className={`chip${minutes === m ? ' active' : ''}`}
              aria-pressed={minutes === m}
              onClick={() => setMinutes(m)}
            >
              {t('study.minutes', { minutes: m, count: m })}
            </button>
          ))}
        </div>
        <label className="study-custom">
          <span>{t('study.custom')}</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={STUDY_MIN_MIN}
            max={STUDY_MAX_MIN}
            value={isPreset ? '' : minutes}
            placeholder={`${STUDY_MIN_MIN}-${STUDY_MAX_MIN}`}
            onChange={(e) => setMinutes(Number(e.target.value))}
            onBlur={() => setMinutes(clampStudyMinutes(minutes))}
          />
        </label>
      </div>

      <div className="study-section">
        <h2>{t('study.source')}</h2>
        <SourcePicker value={source} onChange={setSource} />
      </div>

      <AmbientMixer />

      <p className="small muted">{t('study.pinExplain')}</p>
      <button
        className="btn primary study-big"
        onClick={() => void useStudy.getState().start(clampStudyMinutes(minutes), source)}
      >
        {t('study.start')}
      </button>

      <StudyStats />
    </div>
  );
}

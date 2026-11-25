import { useT, type MessageKey } from '../../i18n';
import { availableAmbient } from '../../study/ambient';
import { useStudy } from '../../stores/study';
import { KnobSlider } from './KnobSlider';

/** One slider per background sound; 0 means off. */
export function AmbientMixer() {
  const t = useT();
  const ambient = useStudy((s) => s.ambient);
  return (
    <div className="study-section">
      <h2>{t('study.ambient')}</h2>
      {availableAmbient().map((id) => {
        const label = t(`study.ambient.${id}` as MessageKey);
        const level = Math.round((ambient[id] ?? 0) * 100);
        return (
          <div key={id} className="study-slider">
            <span aria-hidden="true">{label}</span>
            <KnobSlider
              min={0}
              max={100}
              value={level}
              label={label}
              valueText={level === 0 ? t('study.ambient.off') : `${level}%`}
              onChange={(v) => useStudy.getState().setAmbient(id, v / 100)}
            />
          </div>
        );
      })}
    </div>
  );
}

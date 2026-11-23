import { useT, type MessageKey } from '../../i18n';
import { availableAmbient } from '../../study/ambient';
import { useStudy } from '../../stores/study';

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
          <label key={id} className="study-slider">
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={level}
              aria-label={label}
              aria-valuetext={level === 0 ? t('study.ambient.off') : `${level}%`}
              onChange={(e) => useStudy.getState().setAmbient(id, Number(e.target.value) / 100)}
            />
          </label>
        );
      })}
    </div>
  );
}

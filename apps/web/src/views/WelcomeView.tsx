import { useState } from 'react';
import { CloudDownload, Headphones, Music2, ShieldCheck } from 'lucide-react';
import { LanguagePicker } from '../components/LanguagePicker';
import { useT, type MessageKey } from '../i18n';

const SLIDES: { Icon: typeof Music2; title: MessageKey; text: MessageKey }[] = [
  { Icon: Music2, title: 'welcome.1.title', text: 'welcome.1.text' },
  { Icon: CloudDownload, title: 'welcome.2.title', text: 'welcome.2.text' },
  { Icon: Headphones, title: 'welcome.3.title', text: 'welcome.3.text' },
  { Icon: ShieldCheck, title: 'welcome.4.title', text: 'welcome.4.text' },
];

/**
 * First-run introduction: what the app is and what comes next, in four
 * short screens. Skippable; can be seen again from Settings → Help.
 */
export function WelcomeView({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step]!;
  const last = step === SLIDES.length - 1;

  return (
    <div className="center-screen welcome">
      <div className="welcome-card">
        <div className="welcome-icon">
          <slide.Icon size={44} />
        </div>
        <h1>{t(slide.title)}</h1>
        <p className="muted">{t(slide.text)}</p>

        <div
          className="welcome-dots"
          aria-label={t('welcome.step', { n: step + 1, total: SLIDES.length })}
        >
          {SLIDES.map((_, i) => (
            <button
              key={i}
              aria-label={t('welcome.step', { n: i + 1, total: SLIDES.length })}
              className={i === step ? 'active' : ''}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        <div className="row welcome-actions">
          {!last ? (
            <>
              <button className="btn" onClick={onDone}>
                {t('welcome.skip')}
              </button>
              <button className="btn primary" onClick={() => setStep(step + 1)}>
                {t('welcome.next')}
              </button>
            </>
          ) : (
            <button className="btn primary grow" onClick={onDone}>
              {t('welcome.start')}
            </button>
          )}
        </div>
        {step === 0 && <LanguagePicker />}
      </div>
    </div>
  );
}

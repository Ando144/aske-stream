import { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { formatJamCode, normalizeJamCode, normalizeNickname, parseHubLink } from '@aske/shared/hub';
import { useT } from '../../i18n';
import { loadValue, savePref } from '../../lib/storage';
import { isNative } from '../../native/platform';
import { scanQr } from '../../native/qrScanner';
import { useJam } from '../../stores/jam';

const NICKNAME_KEY = 'jam-nickname';

function jamPlaylistName(t: ReturnType<typeof useT>): string {
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  return t('jam.playlistName', { date });
}

/** Screen without a session: start a Jam (Android) or join one with a code or QR. */
export function JamStart({ initialCode }: { initialCode: string }) {
  const t = useT();
  const [nickname, setNickname] = useState(() => loadValue(NICKNAME_KEY, ''));
  const [code, setCode] = useState(initialCode ? formatJamCode(initialCode) : '');
  const [problem, setProblem] = useState<string | null>(null);

  const cleanNickname = (): string | null => {
    const clean = normalizeNickname(nickname);
    if (!clean) setProblem(t('jam.nicknameRequired'));
    else savePref(NICKNAME_KEY, clean);
    return clean;
  };

  const join = (raw: string) => {
    const normalized = normalizeJamCode(raw);
    if (!normalized) return setProblem(t('jam.invalidCode'));
    const clean = cleanNickname();
    if (clean) {
      setProblem(null);
      void useJam.getState().join(normalized, clean);
    }
  };

  const scan = async () => {
    try {
      const link = parseHubLink((await scanQr()) ?? '');
      if (link?.kind === 'jam') join(link.code);
      else setProblem(t('jam.invalidCode'));
    } catch {
      setProblem(t('jam.scannerUnavailable'));
    }
  };

  const create = () => {
    const clean = cleanNickname();
    if (clean) void useJam.getState().create({ nickname: clean, playlistName: jamPlaylistName(t) });
  };

  return (
    <>
      <p className="muted">{t('jam.intro')}</p>
      <input
        className="input jam-field"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder={t('jam.nicknamePlaceholder')}
        aria-label={t('jam.nickname')}
        maxLength={24}
      />
      {problem && <div className="error-text">{problem}</div>}
      <section className="jam-card">
        <h2>{t('jam.join.title')}</h2>
        <p className="muted small">{t('jam.join.text')}</p>
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            join(code);
          }}
        >
          <input
            className="input jam-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('jam.join.codePlaceholder')}
            aria-label={t('jam.join.codePlaceholder')}
            autoCapitalize="characters"
          />
          <button className="btn primary small" type="submit" disabled={!code.trim()}>
            {t('jam.join.go')}
          </button>
          {isNative && (
            <button className="btn small" type="button" onClick={() => void scan()}>
              <ScanLine size={16} /> {t('jam.scan')}
            </button>
          )}
        </form>
      </section>
      <section className="jam-card">
        <h2>{t('jam.create.title')}</h2>
        {isNative ? (
          <>
            <p className="muted small">{t('jam.create.text')}</p>
            <button className="btn primary" onClick={create}>
              {t('jam.create.go')}
            </button>
          </>
        ) : (
          <p className="muted small">{t('jam.create.webOnly')}</p>
        )}
      </section>
    </>
  );
}

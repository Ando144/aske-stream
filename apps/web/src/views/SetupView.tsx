import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Cloud,
  HardDrive,
  LoaderCircle,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import { HelpButton } from '../components/HelpSheet';
import { LanguagePicker } from '../components/LanguagePicker';
import { useT, type MessageKey } from '../i18n';
import { driveAvailable, driveProblem, type DriveProblem } from '../storage/drive/auth';
import { useSetup } from '../stores/setup';

/** Average song ≈ 4 MB (3.5 min of YouTube's Opus audio, stored without re-encoding). */
export const MB_PER_SONG = 4;
const SIZE_ROWS = [100, 500, 1000, 2500];

export function formatSongSize(songs: number): string {
  const mb = songs * MB_PER_SONG;
  return mb >= 1000
    ? `≈ ${(mb / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} GB`
    : `≈ ${mb} MB`;
}

interface Option {
  id: 'device' | 'drive' | 'cloudflare';
  Icon: typeof Smartphone;
  available: boolean;
  recommended?: boolean;
  onChoose: () => void;
}

/**
 * First-run choice of storage, written for people who have never heard of
 * "cloud storage": what it is, what is good, what to keep in mind, and how
 * much space music takes.
 */
export function SetupView() {
  const t = useT();
  const changing = useSetup((s) => s.changing);
  const current = useSetup((s) => s.config?.home);
  const [busy, setBusy] = useState<Option['id'] | null>(null);
  const [driveError, setDriveError] = useState<{ kind: DriveProblem; detail: string } | null>(null);
  const options: Option[] = [
    {
      id: 'device',
      Icon: Smartphone,
      available: true,
      recommended: true,
      onChoose: () => useSetup.getState().chooseDevice(),
    },
    {
      id: 'drive',
      Icon: HardDrive,
      available: driveAvailable(),
      onChoose: () => {
        setBusy('drive');
        setDriveError(null);
        useSetup
          .getState()
          .chooseDrive()
          .catch((err: unknown) =>
            setDriveError({
              kind: driveProblem(err),
              detail: String((err as Error).message ?? err),
            }),
          )
          .finally(() => setBusy(null));
      },
    },
    {
      id: 'cloudflare',
      Icon: Cloud,
      available: true,
      onChoose: () => {
        setBusy('cloudflare');
        void useSetup
          .getState()
          .chooseCloudflare()
          .finally(() => setBusy(null));
      },
    },
  ];

  const list = (key: MessageKey) => t(key).split('|');

  return (
    <div className="center-screen">
      <div className="setup">
        <img src="/icons/icon-192.png" alt="" width={64} height={64} />
        <h1>{changing ? t('setup.changeTitle') : t('setup.title')}</h1>
        <p className="muted">{changing ? t('setup.changeSubtitle') : t('setup.subtitle')}</p>
        <HelpButton id="storage-options" label={t('setup.helpChoose')} />
        {changing && (
          <button className="btn" onClick={() => useSetup.getState().cancelChange()}>
            <ArrowLeft size={16} /> {t('setup.cancel')}
          </button>
        )}

        <div className="setup-options">
          {options.map(({ id, Icon, available, recommended, onChoose }) => {
            const inUse = changing && current === id;
            return (
              <section
                key={id}
                className={`setup-option${available ? '' : ' disabled'}${inUse ? ' current' : ''}`}
              >
                <header className="row">
                  <Icon size={24} />
                  <h2 className="grow">{t(`setup.${id}.title` as MessageKey)}</h2>
                  {inUse ? (
                    <span className="pill auto">{t('setup.current')}</span>
                  ) : (
                    recommended &&
                    !changing && <span className="pill auto">{t('setup.recommended')}</span>
                  )}
                </header>
                <p>{t(`setup.${id}.desc` as MessageKey)}</p>
                {id === 'cloudflare' && <HelpButton id="cloudflare-what" />}
                {id === 'drive' && <HelpButton id="drive-what" />}
                <div className="setup-lists">
                  <div>
                    <strong className="small">{t('setup.pros')}</strong>
                    <ul>
                      {list(`setup.${id}.pros` as MessageKey).map((p) => (
                        <li key={p}>
                          <Check size={16} color="var(--accent)" /> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong className="small">{t('setup.cons')}</strong>
                    <ul>
                      {list(`setup.${id}.cons` as MessageKey).map((c) => (
                        <li key={c}>
                          <TriangleAlert size={16} color="var(--warn-text)" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <button
                  className={`btn ${inUse || (recommended && !changing) ? 'primary' : ''}`}
                  disabled={!available || busy !== null}
                  onClick={inUse ? () => useSetup.getState().cancelChange() : onChoose}
                >
                  {busy === id && <LoaderCircle size={16} className="spin" />}
                  {!available
                    ? t('setup.soon')
                    : inUse
                      ? t('setup.keep')
                      : id === 'drive'
                        ? t('setup.drive.connect')
                        : t('setup.choose')}
                </button>
                {id === 'drive' && available && !inUse && (
                  <p className="faint small">{t('setup.drive.whatHappens')}</p>
                )}
                {id === 'drive' && driveError && (
                  <div className="banner small" role="alert">
                    <TriangleAlert size={16} />
                    <div>
                      <div>{t(`setup.drive.err.${driveError.kind}` as MessageKey)}</div>
                      {driveError.kind === 'other' || driveError.kind === 'notRegistered' ? (
                        <details>
                          <summary>{t('pair.details')}</summary>
                          <code className="small">{driveError.detail}</code>
                        </details>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <section className="panel setup-sizes">
          <h2>{t('setup.sizeTitle')}</h2>
          <p className="muted">{t('setup.sizeIntro')}</p>
          <table>
            <tbody>
              {SIZE_ROWS.map((songs) => (
                <tr key={songs}>
                  <td>{t('setup.sizeSongs', { songs: songs.toLocaleString() })}</td>
                  <td>{formatSongSize(songs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="faint small">{t('setup.sizeNote')}</p>
        </section>

        <LanguagePicker />
      </div>
    </div>
  );
}

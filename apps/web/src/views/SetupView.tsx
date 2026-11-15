import { Check, Cloud, HardDrive, Smartphone, TriangleAlert } from 'lucide-react';
import { LanguagePicker } from '../components/LanguagePicker';
import { useT, type MessageKey } from '../i18n';
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
  const options: Option[] = [
    {
      id: 'device',
      Icon: Smartphone,
      available: true,
      recommended: true,
      onChoose: () => useSetup.getState().chooseDevice(),
    },
    { id: 'drive', Icon: HardDrive, available: false, onChoose: () => undefined },
    {
      id: 'cloudflare',
      Icon: Cloud,
      available: true,
      onChoose: () => useSetup.getState().startCloudflare(),
    },
  ];

  const list = (key: MessageKey) => t(key).split('|');

  return (
    <div className="center-screen">
      <div className="setup">
        <img src="/icons/icon-192.png" alt="" width={64} height={64} />
        <h1>{t('setup.title')}</h1>
        <p className="muted">{t('setup.subtitle')}</p>

        <div className="setup-options">
          {options.map(({ id, Icon, available, recommended, onChoose }) => (
            <section key={id} className={`setup-option${available ? '' : ' disabled'}`}>
              <header className="row">
                <Icon size={24} />
                <h2 className="grow">{t(`setup.${id}.title` as MessageKey)}</h2>
                {recommended && <span className="pill auto">{t('setup.recommended')}</span>}
              </header>
              <p>{t(`setup.${id}.desc` as MessageKey)}</p>
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
                        <TriangleAlert size={16} color="#f4d38b" /> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <button
                className={`btn ${recommended ? 'primary' : ''}`}
                disabled={!available}
                onClick={onChoose}
              >
                {available ? t('setup.choose') : t('setup.soon')}
              </button>
            </section>
          ))}
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

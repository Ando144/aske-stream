import { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { parseGroupInput } from '@aske/shared/groups';
import { useT } from '../../i18n';
import { isNative } from '../../native/platform';
import { scanQr } from '../../native/qrScanner';
import { useGroups } from '../../stores/groups';
import { Sheet } from '../Sheet';
import { AliasField, useAlias } from './AliasField';

export function JoinGroupSheet({
  initialCode,
  onClose,
  onJoined,
}: {
  initialCode: string;
  onClose: () => void;
  onJoined: (groupId: string) => void;
}) {
  const t = useT();
  const { alias, setAlias, clean } = useAlias();
  const [code, setCode] = useState(initialCode);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async (raw: string) => {
    const parsed = parseGroupInput(raw);
    const cleanAlias = clean();
    if (!parsed) return setProblem(t('groups.join.invalid'));
    if (!cleanAlias) return setProblem(t('groups.alias.required'));
    setProblem(null);
    setBusy(true);
    const detail = await useGroups.getState().join(parsed, cleanAlias);
    setBusy(false);
    if (detail) onJoined(detail.id);
  };

  const scan = async () => {
    try {
      const scanned = await scanQr();
      if (scanned && parseGroupInput(scanned)) setCode(scanned);
      else setProblem(t('groups.join.invalid'));
    } catch (err) {
      console.error('Could not open the QR scanner', err);
      setProblem(t('groups.join.scannerUnavailable'));
    }
  };

  return (
    <Sheet onClose={onClose} label={t('groups.join.title')}>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          void join(code);
        }}
      >
        <h2>{t('groups.join.title')}</h2>
        <p className="muted small">{t('groups.join.text')}</p>
        <input
          className="input groups-field groups-code-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('groups.join.code')}
          aria-label={t('groups.join.code')}
          autoCapitalize="characters"
        />
        <AliasField value={alias} onChange={setAlias} />
        {problem && <div className="error-text">{problem}</div>}
        <div className="row wrap">
          <button className="btn primary" type="submit" disabled={busy || !code.trim()}>
            {t('groups.join.go')}
          </button>
          {isNative && (
            <button className="btn" type="button" onClick={() => void scan()}>
              <ScanLine size={16} /> {t('groups.join.scan')}
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

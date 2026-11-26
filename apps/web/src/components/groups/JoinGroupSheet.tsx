import { useEffect, useState } from 'react';
import { LoaderCircle, ScanLine } from 'lucide-react';
import { parseGroupInput, type GroupPreview } from '@aske/shared/groups';
import { HubError } from '../../hub/client';
import { hubErrorText } from '../../hub/errors';
import { peekGroup } from '../../hub/groupsClient';
import { useT } from '../../i18n';
import { isNative } from '../../native/platform';
import { scanQr } from '../../native/qrScanner';
import { useGroups } from '../../stores/groups';
import { Sheet } from '../Sheet';
import { AliasField, useAlias } from './AliasField';
import { GroupPhoto } from './GroupPhoto';

/** Waits for the typing to settle: the Hub limits how often a code can be looked up. */
const PREVIEW_DELAY_MS = 400;
const PREVIEW_PHOTO_SIZE = 56;

type PreviewResult = { code: string } & ({ preview: GroupPreview } | { error: unknown });

/** The Hub's answer for this exact code, or null while there is none yet. */
function useInvitePreview(code: string | null): PreviewResult | null {
  const [result, setResult] = useState<PreviewResult | null>(null);

  useEffect(() => {
    if (!code) return;
    let active = true;
    const timer = setTimeout(() => {
      peekGroup(code).then(
        (preview) => active && setResult({ code, preview }),
        (error: unknown) => {
          console.error('Could not preview the group', error);
          if (active) setResult({ code, error });
        },
      );
    }, PREVIEW_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [code]);

  return result?.code === code ? result : null;
}

function InvitePreview({ code }: { code: string }) {
  const t = useT();
  const result = useInvitePreview(code);

  if (!result) {
    return (
      <p className="muted small" role="status">
        <LoaderCircle size={16} className="spin" /> {t('groups.join.checking')}
      </p>
    );
  }
  if ('error' in result) {
    const notFound = result.error instanceof HubError && result.error.code === 'group_not_found';
    return (
      <div className="error-text" role="status">
        {notFound ? t('groups.join.notFound') : hubErrorText(result.error)}
      </div>
    );
  }
  const { name, members, photoAt } = result.preview;
  return (
    <div className="groups-preview" role="status">
      <span className="muted small">{t('groups.join.preview')}</span>
      <div className="groups-card-line">
        <GroupPhoto inviteCode={code} name={name} photoAt={photoAt} size={PREVIEW_PHOTO_SIZE} />
        <div className="grow">
          <div className="groups-card-name">{name}</div>
          <div className="muted small">{t('groups.people', { count: members })}</div>
        </div>
      </div>
    </div>
  );
}

function useJoinForm(initialCode: string, onJoined: (groupId: string) => void) {
  const t = useT();
  const { alias, setAlias, clean } = useAlias();
  const [code, setCode] = useState(initialCode);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const parsed = parseGroupInput(code);
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

  return { alias, setAlias, code, setCode, problem, busy, join, scan };
}

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
  const form = useJoinForm(initialCode, onJoined);
  const parsed = parseGroupInput(form.code);

  return (
    <Sheet onClose={onClose} label={t('groups.join.title')}>
      <form
        className="sheet-body groups-sheet"
        onSubmit={(e) => {
          e.preventDefault();
          void form.join();
        }}
      >
        <h2 className="groups-sheet-title">{t('groups.join.title')}</h2>
        <p className="muted small">{t('groups.join.text')}</p>
        <input
          className="input groups-field groups-code-input"
          value={form.code}
          onChange={(e) => form.setCode(e.target.value)}
          placeholder={t('groups.join.code')}
          aria-label={t('groups.join.code')}
          autoCapitalize="characters"
        />
        {parsed && <InvitePreview code={parsed} />}
        <AliasField value={form.alias} onChange={form.setAlias} />
        {form.problem && <div className="error-text">{form.problem}</div>}
        <button
          className="btn primary groups-big-btn"
          type="submit"
          disabled={form.busy || !form.code.trim()}
        >
          {t('groups.join.go')}
        </button>
        {isNative && (
          <button className="btn groups-big-btn" type="button" onClick={() => void form.scan()}>
            <ScanLine size={18} /> {t('groups.join.scan')}
          </button>
        )}
      </form>
    </Sheet>
  );
}

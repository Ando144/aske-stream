import { useRef, useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { useT } from '../i18n';
import { importFiles } from '../storage/importFiles';
import { useLibrary } from '../stores/library';
import { useSetup } from '../stores/setup';
import { toast } from '../stores/ui';

/**
 * "Import files": adds songs the user already has, into this device's
 * storage or uploaded to their Google Drive.
 */
export function ImportButton() {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files: File[]) => {
    if (!files.length) return;
    const toDrive = useSetup.getState().config?.home === 'drive';
    if (toDrive && !navigator.onLine) {
      toast(t('toast.offline'), 'error');
      return;
    }
    setBusy(true);
    toast(t(toDrive ? 'toast.importingDrive' : 'toast.importing', { count: files.length }));
    const result = await importFiles(files, undefined, toDrive ? 'drive' : 'device');
    useLibrary.getState().upsertTracks(result.added);
    setBusy(false);
    if (result.added.length) toast(t('toast.imported', { count: result.added.length }));
    if (result.skipped) toast(t('toast.importSkipped', { count: result.skipped }));
    for (const name of result.failed.slice(0, 3)) toast(t('toast.importFailed', { name }), 'error');
  };

  return (
    <>
      <button
        className="btn primary small"
        onClick={() => input.current?.click()}
        disabled={busy}
        title={t(
          useSetup.getState().config?.home === 'drive'
            ? 'library.importHintDrive'
            : 'library.importHint',
        )}
      >
        {busy ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}
        {t('library.import')}
      </button>
      <input
        ref={input}
        type="file"
        accept="audio/*,.mp3,.m4a,.flac,.ogg,.opus,.wav,.webm"
        multiple
        hidden
        data-testid="import-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void onFiles(files);
        }}
      />
    </>
  );
}

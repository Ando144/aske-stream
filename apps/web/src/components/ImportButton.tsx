import { useRef, useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { useT } from '../i18n';
import { importFiles } from '../storage/importFiles';
import { useLibrary } from '../stores/library';
import { toast } from '../stores/ui';

/** "Import files": copies songs the user already has into this device's library. */
export function ImportButton() {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    toast(t('toast.importing', { count: files.length }));
    const result = await importFiles(files);
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
        title={t('library.importHint')}
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

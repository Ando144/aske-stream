import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, LoaderCircle } from 'lucide-react';
import { GROUP_LIMITS, sanitizeGroupName, type GroupDetail } from '@aske/shared/groups';
import { preparePhoto } from '../../groups/look';
import { useT } from '../../i18n';
import { useGroupEdit, type LookDraft } from '../../stores/groupEdit';
import { toast } from '../../stores/ui';
import { Sheet } from '../Sheet';
import { GroupPhoto } from './GroupPhoto';

const PHOTO_SIZE = 112;

interface Props {
  group: GroupDetail;
  onSaved: (name: string, photoAt: number | null) => void;
  /** Part of the changes may have reached the Hub before the failure. */
  onFailed: () => void;
  onClose: () => void;
}

/** What is typed and picked in the sheet; starts from the changes that could not be saved. */
function useLookForm({ group, onSaved, onFailed, onClose }: Props) {
  const t = useT();
  const [draft] = useState(() => useGroupEdit.getState().drafts[group.id]);
  const [name, setName] = useState(draft?.name ?? group.name);
  const [photo, setPhoto] = useState<LookDraft['photo']>(draft?.photo);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const saving = useGroupEdit((s) => s.saving === group.id);

  const pick = async (file: File) => {
    setError(null);
    setPreparing(true);
    const jpeg = await preparePhoto(file);
    setPreparing(false);
    if (jpeg) setPhoto(jpeg);
    else setError(t('groups.look.badPhoto'));
  };

  const remove = () => setPhoto(group.photoAt === null ? undefined : 'remove');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const clean = sanitizeGroupName(name);
    if (!clean) return setError(t('groups.look.nameRequired'));
    setError(null);
    const current = { name: group.name, photoAt: group.photoAt };
    const result = await useGroupEdit.getState().save(group.id, { name: clean, photo }, current);
    if (!result.ok) {
      setError(result.message);
      return onFailed();
    }
    toast(t('groups.look.saved'));
    onSaved(result.name, result.photoAt);
    onClose();
  };

  const cancel = () => {
    useGroupEdit.getState().discard(group.id);
    onClose();
  };

  const restored = draft !== undefined;
  return { name, setName, photo, error, preparing, saving, restored, pick, remove, save, cancel };
}

function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

function PhotoEditor({
  group,
  photo,
  busy,
  onPick,
  onRemove,
}: {
  group: GroupDetail;
  photo: LookDraft['photo'];
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const picked = photo instanceof Blob ? photo : null;
  const pickedUrl = useObjectUrl(picked);
  const photoAt = photo === 'remove' ? null : group.photoAt;
  const hasPhoto = picked !== null || photoAt !== null;
  return (
    <>
      <div className="group-look-photo">
        {pickedUrl ? (
          <img
            className="group-photo"
            src={pickedUrl}
            alt={t('groups.photo.alt', { name: group.name })}
            style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}
          />
        ) : (
          <GroupPhoto name={group.name} photoAt={photoAt} groupId={group.id} size={PHOTO_SIZE} />
        )}
      </div>
      <div className="group-pair">
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Camera size={18} /> {t(hasPhoto ? 'groups.look.pick' : 'groups.look.pickFirst')}
        </button>
        {hasPhoto && (
          <button type="button" className="btn danger" disabled={busy} onClick={onRemove}>
            {t('groups.look.remove')}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so that choosing the same file again is noticed.
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
    </>
  );
}

/** Any member can change the group's name and photo here. */
export function GroupLookSheet(props: Props) {
  const t = useT();
  const form = useLookForm(props);
  const busy = form.saving || form.preparing;
  return (
    <Sheet onClose={props.onClose} label={t('groups.look.title')}>
      <form className="sheet-body group-look" onSubmit={(e) => void form.save(e)}>
        <h2>{t('groups.look.title')}</h2>
        <p className="muted small">{t('groups.look.text')}</p>
        {form.restored && <p className="group-look-restored">{t('groups.look.draftRestored')}</p>}
        <PhotoEditor
          group={props.group}
          photo={form.photo}
          busy={busy}
          onPick={(file) => void form.pick(file)}
          onRemove={form.remove}
        />
        <p className="faint small">{t('groups.look.note')}</p>
        <label className="group-look-name">
          <strong className="small">{t('groups.look.name')}</strong>
          <input
            className="input"
            value={form.name}
            maxLength={GROUP_LIMITS.nameMax}
            onChange={(e) => form.setName(e.target.value)}
          />
        </label>
        {form.error && (
          <p className="error-text" role="alert">
            {form.error}
          </p>
        )}
        <button type="submit" className="btn primary group-look-save" disabled={busy}>
          {form.saving && <LoaderCircle size={18} className="spin" />}
          {t(form.saving ? 'groups.look.saving' : 'groups.look.save')}
        </button>
        <button type="button" className="btn group-look-cancel" onClick={form.cancel}>
          {t('common.cancel')}
        </button>
      </form>
    </Sheet>
  );
}

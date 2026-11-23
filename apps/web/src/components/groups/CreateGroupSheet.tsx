import { useState } from 'react';
import { sanitizeGroupName } from '@aske/shared/groups';
import { useT } from '../../i18n';
import { useGroups } from '../../stores/groups';
import { Sheet } from '../Sheet';
import { AliasField, useAlias } from './AliasField';

export function CreateGroupSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (groupId: string) => void;
}) {
  const t = useT();
  const { alias, setAlias, clean } = useAlias();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const groupName = sanitizeGroupName(name);
    const cleanAlias = clean();
    if (!groupName) return setProblem(t('groups.create.nameRequired'));
    if (!cleanAlias) return setProblem(t('groups.alias.required'));
    setProblem(null);
    setBusy(true);
    const detail = await useGroups.getState().create(groupName, cleanAlias);
    setBusy(false);
    if (detail) onCreated(detail.id);
  };

  return (
    <Sheet onClose={onClose} label={t('groups.create.title')}>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2>{t('groups.create.title')}</h2>
        <input
          className="input groups-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groups.create.namePlaceholder')}
          aria-label={t('groups.create.name')}
          maxLength={40}
        />
        <AliasField value={alias} onChange={setAlias} />
        {problem && <div className="error-text">{problem}</div>}
        <button className="btn primary" type="submit" disabled={busy}>
          {t('groups.create.go')}
        </button>
      </form>
    </Sheet>
  );
}

import { useState } from 'react';
import { normalizeNickname } from '@aske/shared/hub';
import { useT } from '../../i18n';
import { loadValue, savePref } from '../../lib/storage';

const ALIAS_KEY = 'groups-alias';

/** The name shown to friends. Starts from the Jam name so people type it only once. */
export function useAlias() {
  const [alias, setAlias] = useState(() => loadValue(ALIAS_KEY, loadValue('jam-nickname', '')));
  /** The cleaned name (and remembers it), or null when it is empty. */
  const clean = (): string | null => {
    const value = normalizeNickname(alias);
    if (value) savePref(ALIAS_KEY, value);
    return value;
  };
  return { alias, setAlias, clean };
}

export function AliasField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <input
      className="input groups-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('groups.alias.placeholder')}
      aria-label={t('groups.alias.label')}
      maxLength={24}
    />
  );
}

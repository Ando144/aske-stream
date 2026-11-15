import { LANGUAGES, useI18n, type Language } from '../i18n';

export function LanguagePicker() {
  const language = useI18n((s) => s.language);
  return (
    <select
      className="select"
      value={language}
      aria-label="language"
      onChange={(e) => useI18n.getState().setLanguage(e.target.value as Language)}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

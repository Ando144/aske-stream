import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { SettingsLink } from '../components/SettingsLink';
import { ARTICLES, articleById, SECTIONS } from '../help/articles';
import { HelpBody } from '../help/HelpBody';
import { searchHelp } from '../help/search';
import { useI18n, useT } from '../i18n';
import { useTips } from '../stores/tips';

/** Help centre: topics, search, and one article per page (/help/:id). */
export function HelpView({ id }: { id?: string }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const [, navigate] = useLocation();
  const [query, setQuery] = useState('');
  const article = id ? articleById(id) : undefined;
  const results = useMemo(() => searchHelp(query, language), [query, language]);
  useEffect(() => useTips.getState().markHelpVisited(), []);

  if (article) {
    const related = ARTICLES.filter((a) => a.section === article.section && a.id !== article.id);
    return (
      <div className="page help-page">
        <header className="page-header">
          <Link href="/help" className="btn small">
            <ArrowLeft size={16} /> {t('help.title')}
          </Link>
          <SettingsLink />
        </header>
        <article className="help-article">
          <h1>{article.title[language]}</h1>
          <HelpBody text={article.body[language]} onOpen={(to) => navigate(`/help/${to}`)} />
        </article>
        {related.length > 0 && (
          <>
            <h2 className="section-title">{t('help.related')}</h2>
            <div className="panel help-list">
              {related.map((a) => (
                <Link key={a.id} href={`/help/${a.id}`} className="help-item">
                  <span className="grow">{a.title[language]}</span>
                  <ChevronRight size={18} className="faint" />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="page help-page">
      <header className="page-header">
        <h1>{t('help.title')}</h1>
        <SettingsLink />
      </header>
      <p className="muted">{t('help.subtitle')}</p>
      <div className="search">
        <Search size={18} />
        <input
          className="input"
          type="search"
          value={query}
          placeholder={t('help.search')}
          aria-label={t('help.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {query.trim() ? (
        <div className="panel help-list" style={{ marginTop: 16 }}>
          {results.length === 0 && <p className="muted small">{t('help.noResults')}</p>}
          {results.map((a) => (
            <Link key={a.id} href={`/help/${a.id}`} className="help-item">
              <span className="grow">{a.title[language]}</span>
              <ChevronRight size={18} className="faint" />
            </Link>
          ))}
        </div>
      ) : (
        SECTIONS.map((section) => (
          <section key={section.id}>
            <h2 className="section-title">{section.title[language]}</h2>
            <div className="panel help-list">
              {ARTICLES.filter((a) => a.section === section.id).map((a) => (
                <Link key={a.id} href={`/help/${a.id}`} className="help-item">
                  <span className="grow">{a.title[language]}</span>
                  <ChevronRight size={18} className="faint" />
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

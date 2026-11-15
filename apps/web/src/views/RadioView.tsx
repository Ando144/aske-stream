import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, LoaderCircle, Plus, Radio as RadioIcon, Search, Trash2 } from 'lucide-react';
import type { CatalogCountry, CatalogStation, CatalogTag, Station } from '@aske/shared';
import { api } from '../api/client';
import { useT } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { usePlayer, type RadioItem } from '../stores/player';
import { catalogToItem, stationToItem, useRadio } from '../stores/radio';
import { confirmDialog, useUi } from '../stores/ui';
import { Sheet } from '../components/Sheet';

type Order = 'votes' | 'trend' | 'clickcount' | 'name';
const PAGE = 30;

function defaultCountry(): string {
  const saved = loadValue<string | null>('radio-country', null);
  if (saved !== null) return saved;
  const region = navigator.language.split('-')[1];
  return region && region.length === 2 ? region.toUpperCase() : '';
}

function StationLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="station-logo">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <RadioIcon size={22} />
      )}
    </div>
  );
}

export function RadioView() {
  const t = useT();
  const stations = useRadio((s) => s.stations);
  const loaded = useRadio((s) => s.loaded);
  const playingKey = usePlayer((s) => (s.mode === 'radio' ? s.station?.key : undefined));
  const [addOpen, setAddOpen] = useState(false);
  const myItems = useMemo(() => stations.map(stationToItem), [stations]);

  useEffect(() => {
    void useRadio.getState().load();
  }, []);

  const playMine = (station: Station) =>
    usePlayer.getState().playStation(stationToItem(station), myItems);

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('radio.title')}</h1>
        <button className="btn small" onClick={() => setAddOpen(true)}>
          <Plus size={16} /> {t('radio.addCustom')}
        </button>
      </header>

      <h2 className="section-title" style={{ marginTop: 0 }}>
        {t('radio.myStations')}
      </h2>
      {loaded && stations.length === 0 && (
        <p className="muted small">{t('radio.myStationsEmpty')}</p>
      )}
      <div className="card-list">
        {stations.map((st) => {
          const key = st.rbUuid ?? st.id;
          return (
            <div key={st.id} className={`card-row${playingKey === key ? ' playing' : ''}`}>
              <button
                className="row grow"
                style={{ textAlign: 'left', gap: 12 }}
                onClick={() => playMine(st)}
              >
                <StationLogo src={st.favicon} />
                <div className="grow">
                  <div className="card-title ellipsis">{st.name}</div>
                  <div className="muted small ellipsis">{stationToItem(st).subtitle}</div>
                </div>
              </button>
              <button
                className={`icon-btn${st.likedAt !== null ? ' on' : ''}`}
                onClick={() => void useRadio.getState().toggleLike(st)}
                aria-label={st.likedAt !== null ? t('radio.unlike') : t('radio.like')}
                aria-pressed={st.likedAt !== null}
              >
                <Heart size={18} fill={st.likedAt !== null ? 'currentColor' : 'none'} />
              </button>
              {st.isCustom && (
                <button
                  className="icon-btn"
                  aria-label={t('radio.remove')}
                  onClick={async () => {
                    if (
                      await confirmDialog(
                        t('radio.removeConfirm', { name: st.name }),
                        t('common.delete'),
                        true,
                      )
                    ) {
                      await useRadio.getState().remove(st.id);
                    }
                  }}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Catalog playingKey={playingKey} />
      {addOpen && <AddStationSheet onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function Catalog({ playingKey }: { playingKey?: string }) {
  const t = useT();
  const online = useUi((s) => s.online);
  const saved = useRadio((s) => s.stations);
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState(defaultCountry);
  const [tag, setTag] = useState('');
  const [order, setOrder] = useState<Order>('votes');
  const [results, setResults] = useState<CatalogStation[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [tags, setTags] = useState<CatalogTag[]>([]);
  const [countries, setCountries] = useState<CatalogCountry[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const likedUuids = useMemo(() => new Set(saved.map((s) => s.rbUuid).filter(Boolean)), [saved]);

  useEffect(() => {
    if (!online) return;
    api
      .catalogTags()
      .then(setTags)
      .catch(() => undefined);
    api
      .catalogCountries()
      .then(setCountries)
      .catch(() => undefined);
  }, [online]);

  const fetchPage = (nextOffset: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);
    api
      .catalog(
        { q: query.trim(), country, tag, order, offset: nextOffset, limit: PAGE },
        controller.signal,
      )
      .then((page) => {
        setResults((prev) => (nextOffset === 0 ? page : [...prev, ...page]));
        setOffset(nextOffset);
        setHasMore(page.length >= PAGE - 5);
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setError(true);
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
  };

  // Debounced search whenever a filter changes.
  useEffect(() => {
    if (!online) return;
    const timer = setTimeout(() => fetchPage(0), query ? 350 : 0);
    return () => clearTimeout(timer);
  }, [query, country, tag, order, online]);

  const items = useMemo(() => results.map(catalogToItem), [results]);
  const play = (item: RadioItem) => usePlayer.getState().playStation(item, items);

  return (
    <section>
      <h2 className="section-title">{t('radio.catalog')}</h2>
      {!online ? (
        <p className="muted">{t('radio.offline')}</p>
      ) : (
        <>
          <div className="search">
            <Search size={18} />
            <input
              className="input"
              type="search"
              value={query}
              placeholder={t('radio.search')}
              aria-label={t('radio.search')}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="row wrap" style={{ margin: '10px 0' }}>
            <select
              className="select grow"
              value={country}
              aria-label="country"
              onChange={(e) => {
                setCountry(e.target.value);
                savePref('radio-country', e.target.value);
              }}
            >
              <option value="">{t('radio.allCountries')}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.stationCount})
                </option>
              ))}
              {country && !countries.some((c) => c.code === country) && (
                <option value={country}>{country}</option>
              )}
            </select>
            <select
              className="select"
              value={order}
              aria-label="order"
              onChange={(e) => setOrder(e.target.value as Order)}
            >
              <option value="votes">{t('radio.orderVotes')}</option>
              <option value="trend">{t('radio.orderTrend')}</option>
              <option value="clickcount">{t('radio.orderClicks')}</option>
              <option value="name">{t('radio.orderName')}</option>
            </select>
          </div>
          <div className="chips">
            <button className={`chip${tag === '' ? ' active' : ''}`} onClick={() => setTag('')}>
              {t('radio.allGenres')}
            </button>
            {tags.map((tg) => (
              <button
                key={tg.name}
                className={`chip${tag === tg.name ? ' active' : ''}`}
                onClick={() => setTag(tag === tg.name ? '' : tg.name)}
              >
                {tg.name}
              </button>
            ))}
          </div>

          <div className="card-list" style={{ marginTop: 8 }}>
            {results.map((st, i) => {
              const liked = likedUuids.has(st.rbUuid);
              return (
                <div
                  key={st.rbUuid}
                  className={`card-row${playingKey === st.rbUuid ? ' playing' : ''}`}
                >
                  <button
                    className="row grow"
                    style={{ textAlign: 'left', gap: 12 }}
                    onClick={() => play(items[i]!)}
                  >
                    <StationLogo src={st.favicon} />
                    <div className="grow">
                      <div className="card-title ellipsis">{st.name}</div>
                      <div className="muted small ellipsis">{items[i]!.subtitle}</div>
                    </div>
                  </button>
                  <button
                    className={`icon-btn${liked ? ' on' : ''}`}
                    onClick={() => void useRadio.getState().toggleCatalogLike(st)}
                    aria-label={liked ? t('radio.unlike') : t('radio.like')}
                    aria-pressed={liked}
                  >
                    <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
                  </button>
                </div>
              );
            })}
          </div>

          {loading && (
            <div className="empty">
              <LoaderCircle className="spin" />
            </div>
          )}
          {error && (
            <div className="empty">
              <p>{t('radio.catalogError')}</p>
              <button className="btn small" onClick={() => fetchPage(0)}>
                {t('common.retry')}
              </button>
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="empty">{t('radio.noResults')}</p>
          )}
          {!loading && hasMore && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <button className="btn small" onClick={() => fetchPage(offset + PAGE)}>
                {t('radio.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AddStationSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && /^https:\/\/\S+$/.test(url.trim());

  return (
    <Sheet className="dialog" label={t('radio.addCustom')} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setBusy(true);
          const ok = await useRadio.getState().addCustom(name.trim(), url.trim());
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <h2>{t('radio.addCustom')}</h2>
        <label className="small muted" htmlFor="st-name">
          {t('radio.customName')}
        </label>
        <input
          id="st-name"
          className="input"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <label className="small muted" htmlFor="st-url" style={{ display: 'block', marginTop: 12 }}>
          {t('radio.customUrl')}
        </label>
        <input
          id="st-url"
          className="input"
          value={url}
          inputMode="url"
          placeholder="https://"
          onChange={(e) => setUrl(e.target.value)}
        />
        <p className="faint small">{t('radio.customUrlHint')}</p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn primary" disabled={!valid || busy}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

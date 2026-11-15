import { configureRadioBrowser } from '@aske/shared/radio-browser';

configureRadioBrowser({ userAgent: 'aske-stream/0.2 (+https://github.com/Ando144/aske-stream)' });

export {
  countClick,
  listCountries,
  listTags,
  mapStation,
  RadioBrowserUnavailable,
  searchStations,
  type CatalogQuery,
} from '@aske/shared/radio-browser';

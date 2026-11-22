# PLAN: playlists enteras de YouTube en «Enviar al móvil»

Fecha: 2026-11-22 · Estado: COMPLETADO

## Objetivo

El usuario pega el enlace de una playlist pública o no listada de YouTube, ve sus canciones con casillas
(todas marcadas, como mucho 1000), quita las que no quiera y la envía al móvil (código/QR del Hub) o,
si ya está en el móvil, la descarga. En el móvil se crea una playlist con el nombre de YouTube (las
canciones también salen en «Todo»). Las no disponibles se saltan y se avisa con un resumen sencillo;
Mix, «Me gusta», «Ver más tarde» y privadas dan un mensaje claro.

## Lo que ya existe (no rehacer)

- Móvil: `native/downloader.ts` `listPlaylistOnPhone` lee la playlist (InnerTube, 100 por página,
  respaldo yt-dlp) y `DownloadView.tsx` `PlaylistSheet` la enseña (sin casillas) y la descarga en una
  playlist con la pregunta «añadir a la existente / crear "Nombre (2)"» (`downloads/imports.ts`
  `resolvePlaylist`, `downloads/batch.ts` `uniquePlaylistName`).
- `stores/downloads.ts` `enqueue(items, { playlistName, playlistMode })` ya recorta a 1000 y crea la playlist.
- Ordenador sin Cloudflare: paquetes del Hub (`/hub/v1/parcels`, máx. 200 canciones, solo canciones
  sueltas; un enlace de playlist muestra «Desde aquí solo puedes enviar canciones»).
- Ordenador con Cloudflare: `stores/send.ts` manda el enlace entero a su Worker y el móvil lo baja
  entero (`enqueueUrl`), sin elegir canciones.
- El navegador del ordenador no puede hablar con YouTube (CORS): la búsqueda ya pasa por el Hub (`/hub/v1/search`).

## Decisiones de arquitectura

- El ordenador lee la playlist **a través del Hub, página a página** (`GET /hub/v1/playlists/:id`, 100
  canciones por llamada) — cada petición al Worker gasta poca CPU (plan gratuito) y la pantalla muestra
  el progreso. El Hub no guarda nada de la playlist.
- El móvil sigue leyendo YouTube directamente (`listPlaylistOnPhone`); el bucle de páginas se extrae a
  un módulo puro común (`downloads/playlistReader.ts`) usado por el móvil y por el ordenador.
- Una sola pantalla de elegir canciones (`components/downloads/PlaylistPicker.tsx`, sale de
  `DownloadView.tsx`, que está en 707 líneas) para móvil y ordenador.
- Envío desde el ordenador = un paquete del Hub con `name` y `unavailable` además de `songs`; límite
  `HUB_LIMITS.parcelMaxSongs = LIMITS.playlistMaxTracks` (1000). **No hace falta trocear el envío**:
  1000 canciones ocupan ~150 KB (tope del cuerpo subido a 1 MB); lo que se trocea es la lectura (páginas de 100).
- Ordenador con Cloudflare (y Hub disponible): la playlist con casillas también se envía con código/QR del
  Hub (duda 1, opción recomendada). Sin Hub: se mantiene el envío del enlace entero de hoy.
- Al recibir en el móvil: `enqueue(..., { playlistName: name, playlistMode: 'new' })` — si el nombre ya
  existe se crea «Nombre (2)» sin preguntar (duda 2, opción recomendada; igual que `enqueueUrl`).
- Playlists de más de 1000: se leen y muestran solo las primeras 1000 con un aviso (duda 3).
- No disponibles = vídeos con `isPlayable === false` en la página + los ocultos que YouTube no lista
  (`totalCount - leídas` cuando YouTube dice que no hay más). Las bloqueadas por país solo se saben al
  descargar: ya las cuenta el aviso final de descargas (`dl.notifDoneSomeFailed`).
- `downloads.ts` (650) y `player.ts` (745) **no se tocan**.

## Contratos (interfaces compartidas)

### C1 · `packages/shared/src/youtube.ts` (T1)

```ts
export interface PlaylistPage {
  title: string;
  author: string;
  entries: PlaylistEntry[];
  continuation: string | null;
  totalCount: number | null;
  /** Videos on this page that cannot be played (private, deleted): skipped, only counted. */
  unavailable: number;
}
export type PlaylistLink =
  | { kind: 'playlist'; id: string }
  | { kind: 'mix' } // list=RD… (automatic mixes)
  | { kind: 'personal' } // list=LL, LM or WL ("Liked", "Watch later")
  | { kind: 'none' }; // not YouTube or no list= at all
/** true for /^[\w-]{10,64}$/ that does not start with 'RD'. */
export function isPlaylistId(id: string): boolean;
export function classifyPlaylistLink(input: string): PlaylistLink;
/** exhausted && totalCount !== null ? Math.max(skipped, totalCount - readCount) : skipped (never < 0). */
export function countUnavailable(
  skipped: number,
  readCount: number,
  totalCount: number | null,
  exhausted: boolean,
): number;
```

`classifyPlaylistLink`: no YouTube (`isYoutubeUrl` false) o sin `list` → `none`; `list` empieza por
`RD` → `mix`; `list` es exactamente `LL`, `LM` o `WL` → `personal`; `isPlaylistId(list)` → `playlist`;
si no → `none`. Funciona también con `watch?v=…&list=…` (la UI decide qué hacer con el vídeo).
`youtubePlaylistId` pasa a usar `isPlaylistId` (mismo comportamiento).

### C2 · `packages/shared/src/hub.ts` (T1)

```ts
HUB_LIMITS.parcelMaxSongs = 1000; // = LIMITS.playlistMaxTracks (comentario como listMaxSongs)
HUB_LIMITS.parcelBodyMaxBytes = 1024 * 1024;
HUB_LIMITS.playlistMaxPages = 10; // 100 songs per page → 1000
HUB_LIMITS.continuationMax = 4096;
export interface ParcelRequest {
  songs: HubSong[];
  name?: string;
  unavailable?: number;
}
export interface ClaimedParcel {
  songs: HubSong[];
  name: string;
  unavailable: number;
} // name '' = no playlist
export type HubErrorCode = /* las de hoy */ 'playlist_unavailable';
/** Control chars stripped, trimmed, cut to LIMITS.nameMax; '' when not a string. */
export function sanitizeParcelName(raw: unknown): string;
```

### C3 · Hub (T3)

- `GET /hub/v1/playlists/:id?lang=es|en|eu&continuation=TOKEN` → 200 `PlaylistPage` (C1).
  - `:id` con `isPlaylistId` y `continuation` ≤ `HUB_LIMITS.continuationMax`; si no → 400 `invalid_request`.
  - Límite: `enforceRateLimit(c, c.env.DB, 'playlist', 120, 10 * 60 * 1000)`.
  - YouTube no responde o no da 200 → 502 `search_unavailable` (detalle con `console.error`).
  - Primera página (sin `continuation`) sin canciones, sin título y `unavailable === 0` → 404 `playlist_unavailable`.
- `POST /hub/v1/parcels` acepta `ParcelRequest`: `name` se limpia con `sanitizeParcelName`,
  `unavailable` entero 0-100000 (por defecto 0). Respuesta igual que hoy (`CreatedParcel`).
- `POST /hub/v1/parcels/:code/claim` → `ClaimedParcel` con `name` y `unavailable`.
- Migración `apps/hub/migrations/0003_parcel_playlist.sql`:
  ```sql
  ALTER TABLE parcels ADD COLUMN name TEXT NOT NULL DEFAULT '';
  ALTER TABLE parcels ADD COLUMN unavailable INTEGER NOT NULL DEFAULT 0;
  ```
  INSERT con columnas `(code, songs_json, sender_key_hash, created_at, expires_at, name, unavailable)`
  en ese orden; claim con `RETURNING songs_json, expires_at, name, unavailable`.

### C4 · Lectura de playlists en la web (T4)

`apps/web/src/downloads/playlistReader.ts` (puro, sin Capacitor ni fetch):

```ts
import type { PlaylistEntry, PlaylistPage } from '@aske/shared/youtube';
export interface PlaylistListing {
  title: string;
  author: string;
  entries: PlaylistEntry[];
  totalCount: number | null;
  complete: boolean;
  /** Songs that could not be listed (private/deleted); shown to the user, never sent. */
  unavailable: number;
}
/** null = YouTube refused this page (non-200). */
export type PageFetcher = (continuation: string | null) => Promise<PlaylistPage | null>;
export interface PlaylistRead {
  title: string;
  author: string;
  entries: PlaylistEntry[];
  totalCount: number | null;
  exhausted: boolean;
  skipped: number;
}
export function emptyRead(): PlaylistRead;
/** Fills `read` in place (a timeout keeps what was read). Title/author/totalCount from page 0;
 *  dedupes entries by id; adds page.unavailable to skipped; stops at maxPages, at maxSongs
 *  (entries cut to maxSongs), when there is no continuation (exhausted = true), when a page is
 *  null or brings no entries. Calls onPage(read) after each page. */
export async function readPages(
  fetchPage: PageFetcher,
  read: PlaylistRead,
  limits: { maxPages: number; maxSongs?: number; onPage?: (read: PlaylistRead) => void },
): Promise<void>;
/** complete = isPlaylistComplete(entries.length, totalCount, exhausted);
 *  unavailable = countUnavailable(skipped, entries.length, totalCount, exhausted). */
export function listingFromRead(read: PlaylistRead): PlaylistListing;
```

`apps/web/src/native/downloader.ts`: `export type { PlaylistListing } from '../downloads/playlistReader'`;
`listPlaylistOnPhone` (misma firma) usa `readPages` con un `PageFetcher` de `CapacitorHttp`
(`maxPages: 20`, como hoy) y devuelve `unavailable`; en la rama yt-dlp `unavailable = read.skipped`.

`apps/web/src/hub/client.ts`:

```ts
export function fetchPlaylistPage(
  id: string,
  continuation: string | null,
  lang: Language,
): Promise<PlaylistPage>;
// GET /playlists/{id}?lang=…[&continuation=…] (URLSearchParams)
export function createParcel(
  songs: HubSong[],
  meta?: { name: string; unavailable: number },
): Promise<CreatedParcel>;
// body = meta ? { songs, ...meta } : { songs }
```

`apps/web/src/downloads/playlistSource.ts`:

```ts
export type PlaylistProblem = 'mix' | 'personal' | 'none' | 'private';
export class PlaylistLinkError extends Error { constructor(readonly reason: PlaylistProblem); } // name 'PlaylistLinkError'
export const HUB_PLAYLIST_TIMEOUT_MS = 60_000;
/** Phone: YouTube directly (listPlaylistOnPhone); computer: through the Hub. */
export async function listPlaylist(
  url: string, lang: Language, onPartial?: (partial: PlaylistListing) => void,
): Promise<PlaylistListing>;
```

Reglas de `listPlaylist`: `classifyPlaylistLink(url)` distinto de `playlist` → `PlaylistLinkError(kind)`.
Móvil (`isNative`): `listPlaylistOnPhone(url, lang, onPartial)`; 0 canciones → `PlaylistLinkError('private')`;
si trae más de 1000, recorta `entries` a `LIMITS.playlistMaxTracks` (con `complete: false`).
Ordenador: `readPages((c) => fetchPlaylistPage(id, c, lang), read, { maxPages: HUB_LIMITS.playlistMaxPages,
maxSongs: LIMITS.playlistMaxTracks, onPage: (r) => onPartial?.(listingFromRead(r)) })` envuelto en
`withTimeout(…, HUB_PLAYLIST_TIMEOUT_MS)` (de `lib/timeout.ts`; si salta y ya hay canciones, devolver lo
leído); `HubError` con `code === 'playlist_unavailable'` → `PlaylistLinkError('private')`; resto de errores se propagan.

### C5 · Selección (T4) — `apps/web/src/downloads/pickSelection.ts` (puro)

```ts
/** The first `max` ids, in order. */
export function initialSelection(ids: readonly string[], max: number): Set<string>;
/** New set; refused = true (and set unchanged) when adding would go over max. */
export function toggleSelection(
  selected: ReadonlySet<string>,
  id: string,
  max: number,
): { selected: Set<string>; refused: boolean };
/** Entries whose id is selected, in playlist order. */
export function pickedEntries<T extends { id: string }>(
  entries: readonly T[],
  selected: ReadonlySet<string>,
): T[];
```

### C6 · Store de paquetes (T5) — `apps/web/src/stores/parcel.ts`

```ts
sendPlaylist: (playlist: { name: string; songs: HubSong[]; unavailable: number }) =>
  Promise<boolean>;
/** Pure: toast text after receiving a parcel. */
export function receivedMessage(
  queued: number,
  name: string,
  unavailable: number,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string;
```

- `sendPlaylist`: si `busy` → false; 0 canciones → toast `pick.noneSelected` (error), false; más de
  `HUB_LIMITS.parcelMaxSongs` → toast `parcel.full`; si no, `start(songs, { name, unavailable })`.
  `start` llama a `createParcel(songs)` sin segundo argumento cuando no hay meta (el test actual espera `[song(1)]`).
- `receive`: `enqueue(items, name ? { playlistName: name, playlistMode: 'new' } : {})` y toast con
  `receivedMessage(queued, name ?? '', unavailable ?? 0, t)`: base = `parcel.nothingNew` si queued = 0;
  si no, `pick.gotPlaylist` (`{count}`,`{name}`) cuando hay nombre o `parcel.gotSongs` cuando no;
  si `unavailable > 0` añade `' ' + pick.unavailableSummary` (`{count}` = unavailable). Plurales con `.one`
  como ya resuelve `t` (comprobar cómo lo hace `i18n/index.ts`).

### C7 · Textos nuevos (T2; los usan T5 y T6) — en `apps/web/src/i18n/pick.ts` (`pickEn`, `pickEs`, `pickEu`, mismo patrón que `parcel.ts`)

| Clave                         | es                                                                                                                                                                | en                                                                                                                                                             | eu                                                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pick.loading`                | Leyendo la playlist…                                                                                                                                              | Reading the playlist…                                                                                                                                          | Playlista irakurtzen…                                                                                                                                                                               |
| `pick.loadingMore`            | Leyendo la playlist: {count} de {total}…                                                                                                                          | Reading the playlist: {count} of {total}…                                                                                                                      | Playlista irakurtzen: {count}/{total}…                                                                                                                                                              |
| `pick.selected`               | {count} de {total} marcadas                                                                                                                                       | {count} of {total} selected                                                                                                                                    | {count}/{total} hautatuta                                                                                                                                                                           |
| `pick.all`                    | Marcar todas                                                                                                                                                      | Select all                                                                                                                                                     | Guztiak hautatu                                                                                                                                                                                     |
| `pick.none`                   | Quitar todas                                                                                                                                                      | Clear all                                                                                                                                                      | Guztiak kendu                                                                                                                                                                                       |
| `pick.max`                    | Puedes elegir hasta {count} canciones a la vez. Quita alguna para marcar otra.                                                                                    | You can pick up to {count} songs at once. Untick one to tick another.                                                                                          | Aldi berean {count} abesti arte aukera ditzakezu. Kendu bat beste bat hautatzeko.                                                                                                                   |
| `pick.overLimit`              | Esta playlist tiene {total} canciones. Solo se muestran las primeras {count}.                                                                                     | This playlist has {total} songs. Only the first {count} are shown.                                                                                             | Playlist honek {total} abesti ditu. Lehen {count}ak bakarrik erakusten dira.                                                                                                                        |
| `pick.unavailableNote`        | {count} canciones no están disponibles (privadas o borradas) y se saltarán.                                                                                       | {count} songs are not available (private or deleted) and will be skipped.                                                                                      | {count} abesti ez daude eskuragarri (pribatuak edo ezabatuak) eta saltatu egingo dira.                                                                                                              |
| `pick.unavailableNote.one`    | 1 canción no está disponible (privada o borrada) y se saltará.                                                                                                    | 1 song is not available (private or deleted) and will be skipped.                                                                                              | Abesti 1 ez dago eskuragarri (pribatua edo ezabatua) eta saltatu egingo da.                                                                                                                         |
| `pick.unavailableSummary`     | {count} canciones no estaban disponibles y se han saltado.                                                                                                        | {count} songs were not available and were skipped.                                                                                                             | {count} abesti ez zeuden eskuragarri eta saltatu dira.                                                                                                                                              |
| `pick.unavailableSummary.one` | 1 canción no estaba disponible y se ha saltado.                                                                                                                   | 1 song was not available and was skipped.                                                                                                                      | Abesti 1 ez zegoen eskuragarri eta saltatu da.                                                                                                                                                      |
| `pick.send`                   | Enviar {count} al móvil                                                                                                                                           | Send {count} to the phone                                                                                                                                      | Bidali {count} mugikorrera                                                                                                                                                                          |
| `pick.send.one`               | Enviar 1 al móvil                                                                                                                                                 | Send 1 to the phone                                                                                                                                            | Bidali 1 mugikorrera                                                                                                                                                                                |
| `pick.noneSelected`           | Marca al menos una canción.                                                                                                                                       | Tick at least one song.                                                                                                                                        | Hautatu abesti bat gutxienez.                                                                                                                                                                       |
| `pick.gotPlaylist`            | Llegan {count} canciones de «{name}». Se guardarán en esa playlist.                                                                                               | {count} songs from “{name}” are on their way. They will be saved in that playlist.                                                                             | «{name}» playlisteko {count} abesti datoz. Playlist horretan gordeko dira.                                                                                                                          |
| `pick.gotPlaylist.one`        | Llega 1 canción de «{name}». Se guardará en esa playlist.                                                                                                         | 1 song from “{name}” is on its way. It will be saved in that playlist.                                                                                         | «{name}» playlisteko abesti 1 dator. Playlist horretan gordeko da.                                                                                                                                  |
| `pick.mixSongOnly`            | Es un Mix automático de YouTube: solo se usará esta canción.                                                                                                      | This is an automatic YouTube Mix: only this song will be used.                                                                                                 | YouTubeko Mix automatiko bat da: abesti hau bakarrik erabiliko da.                                                                                                                                  |
| `pick.openPlaylist`           | Ver la playlist entera                                                                                                                                            | See the whole playlist                                                                                                                                         | Ikusi playlist osoa                                                                                                                                                                                 |
| `pick.err.mix`                | Los Mix de YouTube cambian solos y no se pueden enviar enteros. Abre una playlist normal o elige las canciones una a una.                                         | YouTube Mixes change by themselves and cannot be sent whole. Open a normal playlist or pick the songs one by one.                                              | YouTubeko Mixak beren kabuz aldatzen dira eta ezin dira osorik bidali. Ireki playlist arrunt bat edo aukeratu abestiak banan-banan.                                                                 |
| `pick.err.personal`           | «Me gusta» y «Ver más tarde» son privadas de tu cuenta de YouTube y no se pueden abrir. Copia las canciones a una playlist pública o no listada y pega su enlace. | “Liked videos” and “Watch later” are private to your YouTube account and cannot be opened. Copy the songs to a public or unlisted playlist and paste its link. | «Gustuko bideoak» eta «Ikusteko geroago» zure YouTube kontuko zerrenda pribatuak dira eta ezin dira ireki. Kopiatu abestiak playlist publiko edo zerrendatu gabeko batera eta itsatsi haren esteka. |
| `pick.err.private`            | No podemos abrir esta playlist: es privada o ya no existe. En YouTube, ponla como «Pública» o «No listada» y vuelve a pegar el enlace.                            | We cannot open this playlist: it is private or no longer exists. In YouTube, set it to “Public” or “Unlisted” and paste the link again.                        | Ezin dugu playlist hau ireki: pribatua da edo ez dago jada. YouTuben, jarri «Publikoa» edo «Zerrendatu gabea» eta itsatsi esteka berriro.                                                           |
| `pick.err.none`               | Este enlace no es de una playlist de YouTube.                                                                                                                     | This link is not a YouTube playlist.                                                                                                                           | Esteka hau ez da YouTubeko playlist batena.                                                                                                                                                         |

Se **borran** (es/en/eu): `parcel.playlistLink` y `dl.playlistEmpty` (T6 deja de usarlas).

## Tareas

### T1 · Shared: clasificar enlaces, contar no disponibles y contratos del Hub · Grupo A · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/youtube.ts`, `packages/shared/src/hub.ts`,
  `packages/shared/test/youtube.test.ts`, `packages/shared/test/hub.test.ts`
- Leer como contexto: contratos C1 y C2.
- Qué hacer:
  1. Tests primero (C1): `classifyPlaylistLink` con `playlist?list=PL…`, `music.youtube.com/playlist?list=OLAK5uy…`,
     `watch?v=…&list=PL…` (→ playlist), `list=RDxxxx` (→ mix), `list=LL`/`LM`/`WL` (→ personal), enlace no
     YouTube y `watch?v=` sin `list` (→ none); `isPlaylistId`; `countUnavailable` (no agotada → skipped;
     agotada 168 anunciadas y 160 leídas con 3 saltadas → 8; nunca negativo; totalCount null → skipped).
  2. `parsePlaylistPage` cuenta en `unavailable` los `playlistVideoRenderer` con `isPlayable === false` o
     sin `videoId` (siguen sin añadirse a `entries`). Ajustar los `toEqual` existentes con `unavailable: 0`
     y añadir un test con 2 no reproducibles.
  3. `hub.ts`: C2 (`HUB_LIMITS` nuevos/cambiados, `ParcelRequest`, `ClaimedParcel`, `playlist_unavailable`,
     `sanitizeParcelName` reutilizando `cleanText`). Test de `sanitizeParcelName` (control chars, recorte a 120, no string → '').
- TDD: sí.
- Criterios de aceptación:
  - [ ] Tests nuevos y existentes de `packages/shared` en verde.
  - [ ] `HUB_LIMITS.parcelMaxSongs === LIMITS.playlistMaxTracks` comprobado en un test.
- Verificación: `npx vitest run --root packages/shared`

### T2 · Textos (es/en/eu), ayuda y documentación del Hub · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/pick.ts` (nuevo), `apps/web/src/i18n/parcel.ts`,
  `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`,
  `apps/web/src/help/articles/music.ts`, `docs/hub.md`, `docs/PRIVACY.md`
- Leer como contexto: contrato C7; `apps/web/test/i18n.test.ts`; `apps/web/src/i18n/parcel.ts` (patrón).
- Qué hacer:
  1. Crear `pick.ts` con `pickEn`, `pickEs: Record<keyof typeof pickEn, string>`, `pickEu` y las claves
     de C7 tal cual; añadir `...pickEn/Es/Eu` en `en.ts`/`es.ts`/`eu.ts` junto a `...parcel*`.
  2. Borrar `parcel.playlistLink` (parcel.ts) y `dl.playlistEmpty` (es/en/eu).
  3. `music.ts`: en `send-with-code` añadir una sección «Enviar una playlist entera» (es/en/eu): pega el
     enlace de la playlist, se marcan todas, quita las que no quieras, «Enviar al móvil», escanea el
     código; en el móvil se crea una playlist con ese nombre (si ya tienes una igual, se llamará
     «Nombre (2)»); hasta 1000 canciones; las privadas o borradas se saltan y te avisamos; los Mix,
     «Me gusta» y «Ver más tarde» no se pueden. En `download-youtube` un párrafo corto: al pegar el
     enlace de una playlist en el móvil puedes quitar canciones antes de descargar. Lenguaje sencillo;
     enlaces `[[id|texto]]` solo a artículos que existan.
  4. `docs/hub.md`: documentar `GET /hub/v1/playlists/:id` (C3), los campos nuevos de los paquetes y
     la migración 0003. `docs/PRIVACY.md`: el Hub pide a YouTube la playlist pública que pegas para
     enseñártela y no guarda nada; el paquete guarda además el nombre de la playlist durante 24 h como mucho.
- TDD: no (lo cubren los tests de paridad y de enlaces).
- Criterios de aceptación:
  - [ ] Todas las claves de C7 en es/en/eu; las dos claves borradas ya no existen.
  - [ ] Pasan `i18n.test.ts` y `help.test.ts`.
- Verificación: `npx vitest run test/i18n.test.ts test/help.test.ts --root apps/web`
  (fallará el tipado de `DownloadView.tsx` hasta T6 por las claves borradas: es esperado).

### T3 · Hub: lectura de playlists y paquetes con nombre · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/hub/src/lib/playlist.ts` (nuevo), `apps/hub/src/routes/playlists.ts` (nuevo),
  `apps/hub/src/routes/parcels.ts`, `apps/hub/src/index.ts`, `apps/hub/migrations/0003_parcel_playlist.sql` (nuevo),
  `apps/hub/test/fakeDb.ts`, `apps/hub/test/parcels.test.ts`, `apps/hub/test/playlists.test.ts` (nuevo)
- Leer como contexto: contratos C1-C3; `apps/hub/src/lib/search.ts` y `routes/search.ts` (patrón);
  `apps/hub/test/search.test.ts` (cómo se simula `fetch`).
- Qué hacer:
  1. Tests primero: 400 con id inválido (`RDxx…`, `LL`, corto) y con `continuation` > 4096; 502 si
     `fetch` falla; 404 `playlist_unavailable` si la primera página viene vacía; 200 con `PlaylistPage`
     (usa un JSON mínimo con dos `playlistVideoRenderer`); con `continuation` el cuerpo enviado a YouTube
     lleva `continuation` y no `browseId`. Paquetes: acepta 1000 canciones, rechaza 1001 (413), guarda
     `name` limpio y `unavailable`, el claim los devuelve; sin `name` devuelve `name: ''`, `unavailable: 0`.
  2. `lib/playlist.ts`: `fetchPlaylistPage(id, continuation, lang): Promise<PlaylistPage>` con
     `buildBrowseRequest` + `parsePlaylistPage`; errores como `lib/search.ts`.
  3. `routes/playlists.ts` (C3) y montarlo en `index.ts` (`app.route('/hub/v1/playlists', playlistRoutes)`).
  4. `parcels.ts`: `CreateBody` con `name` y `unavailable` opcionales; INSERT/claim de C3. `fakeDb.ts`:
     7 argumentos en el INSERT y `name`/`unavailable` en la fila.
  5. Migración 0003 de C3.
- TDD: sí.
- Criterios de aceptación:
  - [ ] Tests de `apps/hub` en verde; funciones < 50 líneas.
  - [ ] Ningún dato de la playlist se guarda en D1 (solo el contador de límite).
- Verificación: `npx vitest run --root apps/hub`

### T4 · Web: lector de playlists común, fuente móvil/Hub y selección · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/playlistReader.ts` (nuevo), `apps/web/src/downloads/playlistSource.ts` (nuevo),
  `apps/web/src/downloads/pickSelection.ts` (nuevo), `apps/web/src/native/downloader.ts`, `apps/web/src/hub/client.ts`,
  `apps/web/test/fake-native/downloader.ts`, `apps/web/test/playlistReader.test.ts` (nuevo),
  `apps/web/test/playlistSource.test.ts` (nuevo), `apps/web/test/pickSelection.test.ts` (nuevo),
  `apps/web/test/hubClient.test.ts`
- Leer como contexto: contratos C1, C2, C4, C5; `apps/web/src/lib/timeout.ts`.
- Qué hacer:
  1. Tests primero de `readPages`/`listingFromRead` con un `PageFetcher` falso: varias páginas, duplicados,
     corte en `maxPages` y en `maxSongs`, página `null`, página vacía, `exhausted`, suma de `unavailable`,
     `onPage` llamado por página. Tests de `pickSelection` (C5). Tests de `listPlaylist` con
     `vi.mock` de `../src/native/platform`, `../src/native/downloader` y `../src/hub/client`: mix/personal/none
     lanzan `PlaylistLinkError`; Hub `playlist_unavailable` → `'private'`; móvil sin canciones → `'private'`;
     timeout con canciones devuelve lo leído. En `hubClient.test.ts`: URL de `fetchPlaylistPage` y cuerpo de `createParcel` con meta.
  2. Implementar C4 y C5. Mover el bucle de `readPlaylistPages` de `native/downloader.ts` a `readPages`
     (mismo comportamiento) y reexportar `PlaylistListing`.
  3. `test/fake-native/downloader.ts`: que su `listPlaylistOnPhone` devuelva `unavailable: 0` (o el valor
     que tenga sentido) para cumplir el tipo.
- TDD: sí.
- Criterios de aceptación:
  - [ ] Tests nuevos y `hubClient.test.ts` en verde; `native/downloader.ts` no crece (< 230 líneas).
  - [ ] Sin imports circulares nuevos (`playlistReader.ts` solo importa de `@aske/shared`).
- Verificación: `npx vitest run test/playlistReader.test.ts test/playlistSource.test.ts test/pickSelection.test.ts test/hubClient.test.ts --root apps/web`

### T5 · Store de paquetes: enviar playlist y recibirla como playlist · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/parcel.ts`, `apps/web/test/parcelStore.test.ts`
- Leer como contexto: contratos C2, C6, C7; `apps/web/src/i18n/index.ts` (cómo resuelve `.one`).
- Qué hacer:
  1. Tests primero: `sendPlaylist` (0 canciones, más de 1000, éxito llama a `createParcel(songs, { name, unavailable })`
     y deja `current` en `waiting`, `busy` impide doble envío); `receive` con `name` llama a `enqueue` con
     `{ playlistName: name, playlistMode: 'new' }` y sin `name` con `{}`; `receivedMessage` (con/sin nombre,
     con/sin no disponibles, queued 0). Los tests actuales de cesta siguen pasando (`createParcel([song(1)])`).
  2. Implementar C6. `hub/client.createParcel` ya acepta `meta` (T4): no tocar `hub/client.ts`.
- TDD: sí.
- Criterios de aceptación:
  - [ ] `parcelStore.test.ts` en verde; `parcel.ts` < 300 líneas, funciones < 50 líneas.
- Verificación: `npx vitest run test/parcelStore.test.ts --root apps/web`

### T6 · Pantalla de elegir canciones y enlaces de playlist · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/downloads/PlaylistPicker.tsx` (nuevo),
  `apps/web/src/components/downloads/PickList.tsx` (nuevo), `apps/web/src/views/DownloadView.tsx`,
  `apps/web/src/styles.css`, `docs/ESTADO.md`, `docs/v2/architecture.md`
- Leer como contexto: contratos C4-C7; `apps/web/src/stores/parcel.ts` (`parcelErrorText`, `sendPlaylist`);
  `apps/web/src/components/send/ParcelSheet.tsx` (el QR sale solo al crear el paquete).
- Qué hacer:
  1. Mover `PlaylistSheet`, `PlaylistCover`, `emptyListing` y `videoThumb` de `DownloadView.tsx` a
     `PlaylistPicker.tsx` (export `PlaylistPicker({ result, via, onClose })`, con `via: 'cloudflare' | 'hub' | null`
     exportado o redefinido igual). Cargar con `listPlaylist` (C4) en móvil **y** ordenador, con `onPartial`.
  2. `PickList.tsx`: lista de casillas (`<label>` con checkbox y «n. título · autor»), botones
     `pick.all`/`pick.none`, contador `pick.selected`; usa `initialSelection`/`toggleSelection` con
     `LIMITS.playlistMaxTracks`; si `refused` → `toast(t('pick.max', { count: 1000 }))`. Accesible con teclado.
  3. Avisos en el picker: `pick.loading`/`pick.loadingMore`; `pick.unavailableNote` si `unavailable > 0`;
     `pick.overLimit` si `totalCount > 1000`; `dl.playlistPartial` como hoy. Errores: `PlaylistLinkError` →
     `t('pick.err.' + reason)`; `HubError` → `parcelErrorText`; `'timeout'` → `dl.playlistSlow`.
  4. Botón: móvil → `dl.downloadAll` con las marcadas; `enqueue(pickedEntries(...), { playlistName, playlistMode })`
     (casilla «crear playlist» y pregunta añadir/nueva como hoy) y, si `unavailable > 0`,
     `toast(t('pick.unavailableSummary', { count }))`. Ordenador con Hub (`hubAvailable()`, sea `via` 'hub' o
     'cloudflare') → `pick.send` → `useParcel.getState().sendPlaylist({ name: title, songs, unavailable })`
     (canciones `{ videoId, title, artist, durationMs: duration * 1000 si > 0 }`); si devuelve true se cierra
     (el QR lo enseña `ParcelSheet`). Ordenador con Cloudflare **sin** Hub → comportamiento de hoy (envía el enlace entero).
     Deshabilitado si 0 marcadas.
  5. `DownloadView.tsx` `LinkCard`: usar `classifyPlaylistLink`. `playlist` sin vídeo → abrir el picker en
     móvil y ordenador (quitar `parcel.playlistLink`). `playlist` con vídeo → tarjeta de canción como hoy +
     botón secundario `pick.openPlaylist`. `mix` con vídeo → tarjeta de canción + nota `pick.mixSongOnly`;
     `mix`/`personal` sin vídeo → mensaje `pick.err.mix`/`pick.err.personal` sin botón. `DownloadView.tsx` debe
     quedar < 500 líneas; `PlaylistPicker.tsx` < 350; funciones < 50 líneas.
  6. `styles.css`: estilos mínimos de la lista con casillas (reutilizar `.dl-entries`; altura máxima con scroll). Paleta ámbar.
  7. Docs: `docs/ESTADO.md` (en «Hecho»/«En curso»: playlists enteras en Enviar al móvil, pendiente de
     `hub:migrate:remote` + `deploy:hub` + `deploy`; decisiones de este plan en una línea cada una) y fila
     nueva en la tabla de fases de `docs/v2/architecture.md` («Send whole YouTube playlists to the phone»,
     estado en blanco hasta que Andoni lo pruebe).
- TDD: no (UI; la lógica tiene tests en T1, T4 y T5).
- Criterios de aceptación:
  - [ ] `npm run check` en verde (formato, tipos, tests, build).
  - [ ] No queda ninguna referencia a `parcel.playlistLink` ni `dl.playlistEmpty`.
  - [ ] Tamaños de archivo y funciones dentro de los límites del punto 5.
- Verificación: `npm run check`; después `npm run build -w @aske/web` y `npm run test:e2e` (cerrar wrangler/workerd colgados).

## Orden

Grupo A (en paralelo): T1, T2 → Grupo B (en paralelo): T3 (usa T1), T4 (usa T1), T5 (usa T1, T2 y la
firma de `createParcel` de C4) → Grupo C: T6 (usa todo). Al final `npm run check` y `npm run test:e2e`.
Publicar: `hub:migrate:remote` antes de `deploy:hub` (la migración añade columnas), luego `deploy`.

## Riesgos / dudas abiertas

1. **Ordenador con biblioteca en Cloudflare: ¿cómo se envía una playlist con casillas?** (el plan usa la A)
   - A (Recomendada): con casillas y código/QR del Hub, igual que sin Cloudflare. Poco trabajo y misma
     pantalla para todos; inconveniente: hay que escanear el código en vez de que el móvil lo recoja solo.
   - B: dejarlo como hoy (se manda el enlace entero sin elegir canciones y el móvil lo baja solo). Cero
     trabajo; inconveniente: no cumple «quitar las que no quiera» en este caso.
   - C: ampliar el Worker propio de Cloudflare (leer playlist + cola de envío con canciones elegidas). Lo más
     redondo y automático; inconveniente: migración en la API, más tareas y más riesgo.
   - Recomiendo A porque cumple lo pedido (casillas + QR/código) sin tocar la API de Cloudflare.
2. **Nombre repetido al recibir en el móvil** (el plan usa la A)
   - A (Recomendada): se crea «Nombre (2)» sin preguntar, como ya hace hoy el envío por Cloudflare. Simple
     y nunca mezcla; inconveniente: reenviar la misma playlist crea otra copia.
   - B: añadir a la playlist que ya existe (las repetidas se saltan). Útil para «actualizar» una playlist;
     inconveniente: puede mezclar dos playlists distintas con el mismo nombre.
   - C: preguntar en el móvil al recibir (añadir / crear nueva). Lo más flexible; inconveniente: un paso
     más en `ReceiveSheet` y más trabajo.
   - Recomiendo A por sencillez y coherencia con lo que ya existe.
3. **Playlists de más de 1000 canciones** (el plan usa la A)
   - A (Recomendada): se leen y muestran solo las primeras 1000, con aviso. Rápido y barato para el Hub;
     inconveniente: no se pueden elegir canciones de más allá de la 1000.
   - B: leer hasta 2000 y dejar marcar cualquier combinación de 1000. Más libertad; inconveniente: el doble de
     llamadas a YouTube y una lista enorme en pantalla.
   - Recomiendo A porque el límite de 1000 por playlist ya existe y es raro pasarlo.
4. Riesgo: el plan gratuito del Worker del Hub tiene poca CPU por petición; analizar una página de
   YouTube (~0,5-1 MB) cabe como en la búsqueda actual, pero si falla habría que adelgazar el análisis.
5. Riesgo: las playlists `RDCLAK5uy…` de YouTube Music son listas fijas pero empiezan por `RD` y hoy se
   tratan como Mix (mensaje «no se puede»). Se deja así; revisarlo si algún amigo lo pide.
6. Riesgo: las canciones bloqueadas por país solo se descubren al descargar; las cuenta el aviso final de
   descargas («No se pudieron bajar: N»), no el resumen de «no disponibles».
7. Riesgo: si se despliega la web antes que el Hub, enviar más de 200 canciones da «Demasiadas canciones»;
   respetar el orden de publicación.

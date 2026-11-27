# PLAN: v0.9.5 (fase 9.3): portadas en todas partes, deslizar más bonito, carga solo con logo, «Compartir → Aske Stream» y «Cargar más»

Fecha: 2026-11-27 · Estado: COMPLETADO · Decisiones: DEFINITIVAS (salvo «Dudas abiertas»)

## Historial (resumen)

- **v0.9.3** (`ff1905d`): descargas cancelables por carriles, `local-extras`, podcasts por serie, aleatorio de orden fijo, gestos del mini reproductor.
- **v0.9.4** (`7f879b5`, hub con migración 0005): Jam como mando a distancia y barra de la Jam, Grupos (boceto A) con «Nombre y foto», arreglos (huérfanos al cancelar, Ordenar con teclado, «Seleccionar» en carpetas, «zerrenda»). Detalle en `docs/releases/v0.9.4.md`.
- El borrador antiguo de la «Fase 3» queda sustituido por este plan.

## Objetivo

Publicar **v0.9.5** con: (1) portada o dibujo al lado de **cada** nombre de canción o playlist en listas, menús, hojas, cola, descargas, búsqueda, grupos y reproductores; (2) deslizar con estilo «A en reproductores (carrusel), B en listas (círculo)» según `docs/plan/bocetos/deslizar.html`; (3) pantalla de carga solo con el logo, que palpita si tarda más de 1 s; (4) «Compartir → Aske Stream» en Android y (5) «Cargar más» en la búsqueda de YouTube.

## Decisiones de Andoni (vigentes)

| Tema                      | Decisión                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin portada real          | Dibujo ámbar propio, sin conexión: tonos ámbar + icono (nota = canción, lista = playlist, micrófono = podcast); varía según el nombre                                                                     |
| Playlist sin foto elegida | Mosaico de 4 portadas de sus canciones; una sola si tiene menos de 4. La foto elegida manda                                                                                                               |
| Canciones que no tienes   | Miniatura pública de YouTube si hay id; si no, dibujo ámbar. No se suben portadas al Hub                                                                                                                  |
| Deslizar                  | A (carrusel) en mini reproductor, pantalla grande y barra de la Jam; B (círculo ámbar con icono) en filas de listas. Mismo gesto y misma acción que hoy. Desaparece el botón/texto «Siguiente»/«Anterior» |
| Carga                     | Solo el logo, sin letras ni botones; palpita suave si tarda más de 1 s; misma lógica de sin conexión que hoy                                                                                              |
| Compartir                 | Vídeos y playlists de YouTube / YouTube Music; otros textos → aviso claro. Ficha con portada, título y «Descargar». App cerrada y abierta                                                                 |
| Cargar más                | Botón al final de los resultados (continuación de InnerTube); si falla, mensaje claro                                                                                                                     |
| TDD                       | Por tarea (sí en lógica, no en interfaz simple)                                                                                                                                                           |
| Publicar                  | Tras aprobar la revisión, todo sin volver a preguntar                                                                                                                                                     |

## Diagnóstico (con archivo y línea)

- **Portadas hoy:** `Cover.tsx:38-44` y `SongThumb.tsx:14-19` caen a un icono gris de nota; `PlaylistArt.tsx:40-51` solo hace mosaico si hay 4 canciones **con** portada y, si no, un icono `ListMusic`. `PlaylistPicker.tsx:43-62` (icono), `DownloadQueue.tsx:147-153` y `DownloadView.tsx:332-338` (`<img>` sin plan B).
- **Sitios con nombre y SIN imagen (inventario):** `AddToPlaylistSheet.tsx:53-56` (icono `ListMusic`), `Nav.tsx:95-102` (playlists del menú lateral), `study/SourcePicker.tsx:35-47` (`<select>`, no admite imágenes), `downloads/PickList.tsx:47-52` (canciones de una playlist de YouTube), `send/ParcelPanel.tsx:17-20` (cesta de «Enviar»), `send/ParcelSheet.tsx:43` (nombre del paquete), `SharedListView.tsx:68` (cabecera de lista compartida), `groups/GroupShares.tsx:62-69` (playlists y Jams compartidas), `groups/GroupRanking.tsx:22`, `groups/MemberTops.tsx:20-21`, `groups/MonthSummary.tsx:131-137`, `stats/RecapCards.tsx:27-31`, `PodcastsView.tsx:93-101` (episodios), `podcasts/ShowPickSheet.tsx:100` (series).
- **Sitios que ya tienen imagen (heredan el dibujo ámbar al cambiar `Cover`/`SongThumb`/`PlaylistArt`):** `TrackList`, `TrackMenu`, `QueuePanel`, `OfflineView`, `PlaylistView` (cabecera y filas), `PlaylistsView`, `PlaylistMenu`, `PlaylistMenuParts:133`, `GroupShares` (selector), `JamAddSheet`, `JamQueue`, `JamBar`, `Outbox`, `ParcelSheet` (`SongRows`), `MiniPlayer`, `PlayerBar`, `NowPlaying`, `PodcastsView` (cabecera de serie).
- **Fuera del alcance (supuesto):** carpetas (`FolderView`, `FolderMenu`, `PlaylistMenuParts:103`) porque no son playlists (siguen con su icono); nombres dentro de frases (avisos, confirmaciones, ayuda) y `<title>` de hojas (`aria-label`).
- **Qué ids transmite el Hub:** Jam (`JamItemView.song.videoId`), listas compartidas (`SharedList.songs[].videoId`) y «Enviar» (`HubSong.videoId`) **sí**. **No:** estadísticas de grupos (`MonthTopTrack`, `RankedTrack` en `packages/shared/src/groups.ts:77-105`, solo título y artista) ni `GroupShare` (`groups.ts:118-128`, solo `title` y `ref`). Para ellas: portada de **tu** biblioteca si coincide título + artista; si no, dibujo ámbar (ver Dudas).
- **Recap local:** `stats/recap.ts:18-23` (`TopTrack`) no guarda `trackId`; se usa la misma búsqueda por título + artista.
- **Deslizar hoy:** `useSwipe` y `SwipeHint` viven en `components/jam/JamBar.tsx:17-89` y los usan `MiniPlayer.tsx:32-35,60` y `JamBar.tsx:98-140`; la etiqueta «Siguiente/Anterior» es `.mini-swipe-hint` (`gestures.css:11-34`). Filas: `TrackList.tsx:99-177` (texto «Añadir a la cola» en `.swipe-hint`). La pantalla grande (`NowPlaying.tsx`) **no** tiene gesto; la barra de progreso (`SeekBar`) está fuera de la portada, así que el gesto va solo en portada + título.
- **Vecina para el carrusel:** el orden está en `stores/player.ts` (`step` 242-258, `previous` 395-411) con `nextIndex`/`previousIndex` de `player/queue.ts`; la radio usa `stationAt` (`player/radioEngine.ts:21`); la Jam, `snapshot.queue[0]`.
- **Carga:** `BootSplash.tsx:70-72` muestra «Buscando conexión…» a los 1,5 s; el logo se dibuja y palpita desde 1,8 s (`boot.css:16-20`). `index.html:18` tiene un `div.boot-splash` vacío sin estilos hasta que carga el JS. **No hay ningún botón de escape** en la carga: tras `BOOT_MAX_WAIT_MS` (5 s) entra igualmente en modo sin conexión (`lib/boot.ts:17-27`), así que quitar textos no deja a nadie atascado. El splash nativo de Android 12+ ya es solo el logo (`styles.xml:20-25`, `ic_launcher_foreground.png`, sin letras).
- **Compartir:** el manifiesto solo tiene `MAIN/LAUNCHER` (`AndroidManifest.xml:21-24`); `@capacitor/app` no entrega `ACTION_SEND`, así que hace falta un plugin propio. `MainActivity` es `singleTask` (llega `onNewIntent` con la app abierta).
- **Buscar:** tres caminos: móvil (`native/downloader.ts:80-115`, InnerTube directo con plan B yt-dlp), Hub (`hub/client.ts:157-165` → `apps/hub/src/routes/search.ts` → `lib/search.ts`) y Cloudflare del amigo (`api/client.ts:208` → `apps/api/src/routes/youtube.ts:71-84`). Ninguno devuelve token de continuación. `parsePlaylistPage` ya sabe leer tokens (`youtube.ts:438-483`).
- **Archivos grandes:** `DownloadView.tsx` (545 líneas) → «Cargar más» saca la búsqueda a archivos propios.

## Decisiones de arquitectura

- **Un único componente de dibujo** `GeneratedArt` (SVG/CSS, sin red) con colores deterministas por semilla dentro de la gama ámbar (no es un tema nuevo). `Cover`, `SongThumb` y `PlaylistArt` lo usan como plan B, así casi todo hereda el cambio sin tocar cada pantalla.
- **Estadísticas y Recap sin id:** `StatTrackArt` busca en la biblioteca propia por título + artista normalizados (índice cacheado por objeto `tracks`) — sin cambiar el Hub ni compartir más datos.
- **Miniaturas de YouTube** siempre con `referrerPolicy="no-referrer"`, `loading="lazy"` y caída al dibujo si fallan o no hay red. Se documenta en `PRIVACY.md`.
- **Deslizar:** la lógica pura (umbral, progreso, desplazamiento de la vecina) va en `lib/swipe.ts`; el gancho `useSwipe` se mueve a `components/gestures/useSwipe.ts` y gana fase de «confirmar» (la tarjeta sale y entra la vecina, 200 ms; 0 ms con reduced-motion) y flechas del teclado. `SwipeTrack` dibuja la actual y la vecina; `SwipeRing` el círculo de las listas.
- **Vecina pura** en `player/neighbours.ts`, que imita `step(true)` y `previous({ skipRestart: true })`; si no se puede saber (fin de lista con aleatorio que se rebaraja) devuelve `null` y el gesto se permite igual, sin vecina dibujada.
- **Carga:** sin animación de trazo; el mismo logo estático en `index.html` (CSS en línea, permitido por la CSP), en `BootSplash` y en el splash nativo, para que no haya saltos. Clase `pulsing` a partir de 1 s.
- **Compartir:** plugin nuevo `ShareTarget` (Java) que guarda el texto pendiente (app cerrada) y lo emite con `notifyListeners(..., true)` (app abierta). El análisis del texto es puro (`share/sharedLink.ts`). La ficha se monta en `Shell` (`App.tsx`), así que si la app aún no está configurada el enlace espera. El título del vídeo se pide al oEmbed público de YouTube con `CapacitorHttp`; si falla, se descarga igual. Las playlists reutilizan `PlaylistPicker`.
- **Cargar más:** `buildSearchRequest(..., continuation?)` y `parseSearchPage` en `packages/shared`; el Hub y la API devuelven `{ results, continuation }`. Servidores viejos no mandan `continuation` → no se ve el botón (compatible). El plan B yt-dlp no tiene continuación.
- **Textos:** un módulo i18n nuevo `i18n/youtubeMore.ts` (T1). Las claves que dejan de usarse se borran al final (T13) para no romper tareas en paralelo.
- **Despliegue:** cambia el Hub (búsqueda) → `npm run deploy:hub` sin migración. Cambia `apps/api` (búsqueda) → cada amigo actualiza su servidor con el aviso de siempre; sin migraciones D1.

## Contratos (interfaces compartidas)

### Portadas (T2 escribe; T4, T5, T6, T10, T11 usan)

```ts
// apps/web/src/lib/generatedArt.ts (pure)
export type ArtKind = 'song' | 'playlist' | 'podcast';
export function hashSeed(seed: string): number; // stable 32-bit, same input → same number
export function artColors(seed: string): { from: string; to: string; angle: number; ink: string };
  // hsl() strings; hue always 24-44 (amber), lightness varies; ink readable on both stops
// apps/web/src/components/art/GeneratedArt.tsx
export function GeneratedArt(props: { seed: string; kind: ArtKind; size?: number; className?: string }): JSX.Element;
  // aria-hidden; icon Music | ListMusic | Mic at 42 % of size; size 0/undefined = fills parent
// apps/web/src/lib/playlistMosaic.ts (pure)
export function mosaicTrackIds(trackIds: readonly string[], tracks: Record<string, Track>): string[];
  // 0 songs → []; 1-3 → [first with cover ?? first]; ≥4 → 4 ids: those with cover first (in order), then the rest
// apps/web/src/lib/trackLookup.ts (pure)
export function findTrackByTitle(tracks: Record<string, LocalTrack>, title: string, artist: string): LocalTrack | null;
  // normalizeText on both; exact title+artist first, then title only if unique; index cached in a WeakMap per `tracks`
// Changed components (props stay backwards compatible)
Cover({ trackId, hasCover, size?, className? }) // fallback = GeneratedArt(seed `${title}|${artist}`, kind podcast if track.kind === 'podcast')
SongThumb({ videoId?: string | null; src?: string; title?: string; artist?: string; kind?: ArtKind; size?: number; className?: string })
  // tries src, then youtubeThumb(videoId), then GeneratedArt(seed title|artist or videoId)
PlaylistArt({ playlist, tracks, size? }) // photo > mosaicTrackIds (1 or 4 Covers) > GeneratedArt(seed playlist.name, 'playlist')
// apps/web/src/components/art/StatTrackArt.tsx
export function StatTrackArt(props: { title: string; artist: string; size?: number }): JSX.Element; // own cover if found, else GeneratedArt
// apps/web/src/components/art/SongMosaic.tsx
export function SongMosaic(props: { songs: readonly HubSong[]; seed: string; size?: number }): JSX.Element;
  // ≥4 songs → 2×2 SongThumb; 1-3 → one SongThumb; 0 → GeneratedArt('playlist')
// CSS: apps/web/src/art.css (classes .gen-art, .song-mosaic)
```

### Deslizar (T3 escribe; T6 usa)

```ts
// apps/web/src/lib/swipe.ts (adds, swipeDecision unchanged)
export function swipeThreshold(width: number): number; // min(LONG_PX, width * LONG_WIDTH_SHARE)
export function swipeProgress(dx: number, width: number): number; // 0..1 = |dx| / threshold, capped
export function neighbourOffset(dx: number, width: number): number; // dx < 0 ? dx + width : dx - width
// apps/web/src/player/neighbours.ts (pure)
export interface QueueView {
  currentId: string | null;
  queue: readonly string[];
  context: readonly string[];
  index: number;
  fromQueue: boolean;
  repeat: RepeatMode;
  contextShuffled: boolean;
}
export function nextTrackId(s: QueueView): string | null; // = what step(true) would pick; null if nothing or unknown (reshuffle)
export function previousTrackId(s: QueueView): string | null; // = previous({ skipRestart: true }); null if it would stay on the same song
// apps/web/src/components/gestures/useSwipe.ts
export type SwipePhase = 'idle' | 'drag' | 'commit' | 'return';
export function useSwipe(opts: {
  onSwipe(d: SwipeDirection): void;
  allows(d: SwipeDirection): boolean;
  maxDrag?: number; /* px, default = element width */
}): {
  dx: number;
  phase: SwipePhase;
  width: number;
  handlers: { onPointerDown; onPointerMove; onPointerUp; onPointerCancel; onKeyDown }; // ArrowLeft/Right = swipe
  consumeSwipe(): boolean;
};
// touch only for dragging; commit = animate to ±width (200 ms, 0 with prefers-reduced-motion), then onSwipe, then dx 0 without transition
// apps/web/src/components/gestures/SwipeTrack.tsx
export function SwipeTrack(props: {
  dx: number;
  phase: SwipePhase;
  width: number;
  neighbour: (d: SwipeDirection) => ReactNode | null;
  children: ReactNode;
}): JSX.Element;
// current content translateX(dx) and opacity 1 - progress*0.5; neighbour (aria-hidden) at neighbourOffset
// apps/web/src/components/gestures/SwipeRing.tsx
export function SwipeRing(props: { progress: number; icon: 'queue' | 'jam' }): JSX.Element | null;
// null at 0; conic-gradient amber; .full when progress >= 1 (accent fill, ink icon); aria-hidden
// CSS: apps/web/src/swipe.css
```

### Compartir (T9 escribe; T11 usa)

```ts
// apps/web/src/share/sharedLink.ts (pure)
export type SharedLink =
  | { kind: 'video'; videoId: string; url: string }
  | { kind: 'playlist'; playlistId: string; url: string }
  | { kind: 'blocked'; reason: 'mix' | 'personal' }
  | { kind: 'invalid' };
export function parseSharedText(text: string): SharedLink;
// first http(s) URL in the text that isYoutubeUrl (youtube.com, m., music., youtu.be, shorts);
// video id wins over list; list only → classifyPlaylistLink (mix/personal → blocked); else invalid. Max 2000 chars read.
// apps/web/src/native/shareTarget.ts (+ apps/web/test/fake-native/shareTarget.ts, alias in vite.config.ts)
export function takeSharedText(): Promise<string | null>; // pending text from a cold start; clears it
export function onSharedText(cb: (text: string) => void): Promise<() => void>; // app already open
export function fetchVideoInfo(videoId: string): Promise<{ title: string; author: string } | null>;
// GET https://www.youtube.com/oembed?format=json&url=<watch url> with CapacitorHttp, 8 s; null on any error
// Fake: window.__askeFakeShare(text) triggers the listener; takeSharedText reads ?share= once.
```

```java
// ShareTargetPlugin.java  @CapacitorPlugin(name = "ShareTarget")
// load(): read getActivity().getIntent(); if ACTION_SEND + text/plain → pending = EXTRA_TEXT (≤ 2000 chars), then intent.setAction(ACTION_MAIN) so a recreate does not repeat it.
// handleOnNewIntent(Intent): same reading, then notifyListeners("shared", { text }, true).
// @PluginMethod takePending(call): resolve { text: pending | null } and clear it.
```

### Cargar más (T8 escribe; T10 usa)

```ts
// packages/shared/src/youtube.ts
export interface SearchPage {
  results: SearchResult[];
  continuation: string | null;
}
export const SEARCH_CONTINUATION_MAX = 4096;
export function buildSearchRequest(
  query: string,
  kind: SearchKind,
  lang?: string,
  continuation?: string,
): InnerTubeRequest;
// with continuation: body { context, continuation } (no query/params). VERIFICAR music: if body-only fails, add ?ctoken=&continuation=&type=next
export function parseSearchPage(json: unknown): SearchPage; // first and next pages; token from continuationItemRenderer / nextContinuationData
export function isContinuationToken(s: string): boolean; // 1..SEARCH_CONTINUATION_MAX, /^[A-Za-z0-9_\-%=]+$/
// parseSearchResponse stays (= parseSearchPage(json).results)
```

| Endpoint                                                       | Cambio                                                                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| API amigo `GET /api/youtube/search?q&kind&lang[&continuation]` | → `{ results, continuation: string \| null }`; token inválido → 400 `validation_error`; YouTube falla → 502 `search_unavailable` |
| Hub `GET /hub/v1/search?q&kind&lang[&continuation]`            | igual; `searchYoutube` devuelve `SearchPage`; `jam/routes.ts:62` sigue enviando solo `results`                                   |

```ts
// web
api.youtubeSearch(q, kind, lang, continuation?): Promise<{ results: SearchResult[]; continuation?: string | null }>
searchViaHub(q, kind, lang, continuation?): Promise<SearchPage> // missing continuation → null
searchOnPhone(q, kind, lang, continuation?): Promise<SearchPage> // yt-dlp fallback → continuation null
// apps/web/src/downloads/searchPages.ts (pure)
export function appendResults(prev: readonly SearchResult[], next: readonly SearchResult[]): SearchResult[]; // dedupe kind+id, keep order
```

### Claves i18n nuevas (T1 en es, en y eu; aquí en español) — `i18n/youtubeMore.ts` (`youtubeMoreEn/Es/Eu`)

- `dl.loadMore` «Cargar más» · `dl.loadingMore` «Cargando más resultados…» · `dl.noMore` «No hay más resultados.»
- `dl.loadMoreFailed` «YouTube no ha dado más resultados ahora mismo. Prueba otra vez en un momento o cambia la búsqueda.»
- `shareIn.title` «Desde YouTube» · `shareIn.loading` «Buscando el título…» · `shareIn.unknownTitle` «Canción de YouTube»
- `shareIn.download` «Descargar» · `shareIn.added` «Añadida a las descargas. La verás en Descargar.»
- `shareIn.infoFailed` «No hemos podido ver el título, pero puedes descargarla igual.»
- `shareIn.notYoutube` «Esto no es un enlace de YouTube ni de YouTube Music. Para descargar, abre la canción en YouTube y pulsa Compartir → Aske Stream.»
- `shareIn.ok` «Entendido»

## Fase 1 (portadas y deslizar)

### T1 · Textos nuevos (es/en/eu) · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/youtubeMore.ts` (nuevo), `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/eu.ts`
- Leer como contexto: `apps/web/src/i18n/jamRemote.ts` (patrón de módulo), `apps/web/test/i18n.test.ts`
- Qué hacer: comprobar con Grep que ninguna clave de «Claves i18n nuevas» existe; crear el módulo con las claves en los 3 idiomas (euskera natural, «zerrenda» para playlist) y registrarlo en `en.ts`, `es.ts` y `eu.ts`. **No borrar** ninguna clave (lo hace T13).
- TDD: no (lo cubre el test de paridad)
- Criterios de aceptación:
  - [ ] Paridad i18n en verde; las claves existen en los 3 idiomas.
- Verificación: `npx vitest run test/i18n.test.ts --root apps/web` y `npm run check`

### T2 · Portadas: dibujo ámbar, mosaico y planes B · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/lib/generatedArt.ts` (nuevo), `apps/web/src/lib/playlistMosaic.ts` (nuevo), `apps/web/src/lib/trackLookup.ts` (nuevo), `apps/web/src/components/art/GeneratedArt.tsx` (nuevo), `apps/web/src/components/art/StatTrackArt.tsx` (nuevo), `apps/web/src/components/art/SongMosaic.tsx` (nuevo), `apps/web/src/art.css` (nuevo), `apps/web/src/components/Cover.tsx`, `apps/web/src/components/SongThumb.tsx`, `apps/web/src/components/PlaylistArt.tsx`, `apps/web/test/generatedArt.test.ts` (nuevo), `apps/web/test/playlistMosaic.test.ts` (nuevo), `apps/web/test/trackLookup.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/lib/format.ts` (`normalizeText`), `apps/web/src/storage/types.ts` (`LocalTrack`), `apps/web/src/styles.css` (clases `.cover`, `.collection-art`), `packages/shared/src/hub.ts` (`HubSong`)
- Qué hacer: todo lo de «Portadas» en Contratos. `GeneratedArt`: degradado lineal con `artColors`, icono lucide centrado, esquinas iguales que `.cover`; respeta `className` para encajar donde hoy va `.cover` o dentro de `.collection-art`. `SongThumb`: recordar qué `src`/`videoId` falló (como hoy) para pasar al siguiente plan. `PlaylistArt`: mosaico de 4 aunque alguna no tenga portada (esa casilla muestra su dibujo). Importar `art.css` desde `GeneratedArt.tsx`.
- TDD: sí (`generatedArt`, `playlistMosaic`, `trackLookup`)
- Criterios de aceptación (tests):
  - [ ] `artColors`: misma semilla → mismos colores; tono siempre entre 24 y 44; 50 semillas distintas dan al menos 10 combinaciones diferentes.
  - [ ] `mosaicTrackIds`: 0 → `[]`; 2 canciones sin portada → 1 id; 5 canciones con 2 portadas → 4 ids empezando por las 2 con portada.
  - [ ] `findTrackByTitle`: acentos y mayúsculas iguales; artista distinto con título único → la encuentra; dos con el mismo título y artista distinto → `null`.
- Verificación: `npx vitest run test/generatedArt.test.ts test/playlistMosaic.test.ts test/trackLookup.test.ts --root apps/web` y `npm run check`

### T3 · Deslizar: lógica, gancho, carrusel y círculo · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/lib/swipe.ts`, `apps/web/test/swipe.test.ts`, `apps/web/src/player/neighbours.ts` (nuevo), `apps/web/test/neighbours.test.ts` (nuevo), `apps/web/src/components/gestures/useSwipe.ts` (nuevo), `apps/web/src/components/gestures/SwipeTrack.tsx` (nuevo), `apps/web/src/components/gestures/SwipeRing.tsx` (nuevo), `apps/web/src/swipe.css` (nuevo)
- Leer como contexto: `docs/plan/bocetos/deslizar.html` (estilos A y B), `apps/web/src/components/jam/JamBar.tsx:12-89` (gancho actual), `apps/web/src/stores/player.ts:238-258` y `395-411`, `apps/web/src/player/queue.ts`
- Qué hacer: todo lo de «Deslizar» en Contratos. `useSwipe` parte del actual (umbral de arranque 12 px, eje horizontal, borde de 24 px vía `swipeDecision`, `setPointerCapture`) pero sin tope de 120 px por defecto, con fases y teclado (flecha = deslizar medio ancho y confirmar). Lee `prefers-reduced-motion` una vez. `SwipeTrack` y `SwipeRing` según el boceto (A: la vecina entra pegada al dedo; B: círculo de 46 px que crece de 0,6 a 1 y se rellena al superar el umbral). `SwipeRing` usa los iconos `ListEnd` / `Users` de lucide. CSS en `swipe.css`, con `@media (prefers-reduced-motion: reduce)` sin transiciones.
- TDD: sí (`swipe.ts`, `neighbours.ts`); los componentes, no
- Criterios de aceptación (tests):
  - [ ] `swipeProgress` 0 en 0, 1 en el umbral y más allá; `neighbourOffset` correcto a ambos lados.
  - [ ] `nextTrackId`: con cola → `queue[0]`; fin de lista con repetir apagado → `null`; repetir todo → vuelve a la primera; aleatorio que se rebaraja → `null`.
  - [ ] `previousTrackId`: desde una canción de la cola → `context[index]`; primera canción sin repetir → `null`.
  - [ ] Los tests existentes de `swipeDecision` siguen pasando.
- Verificación: `npx vitest run test/swipe.test.ts test/neighbours.test.ts test/queue.test.ts --root apps/web` y `npm run check`

### T4 · Portadas en pantallas de la biblioteca, estudio, podcasts, grupos y Recap · Grupo B · Estado: HECHA

- Depende de: T2
- Archivos (exclusivos): `apps/web/src/components/AddToPlaylistSheet.tsx`, `apps/web/src/components/Nav.tsx`, `apps/web/src/components/study/SourcePicker.tsx`, `apps/web/src/views/PodcastsView.tsx`, `apps/web/src/components/podcasts/ShowPickSheet.tsx`, `apps/web/src/components/stats/RecapCards.tsx`, `apps/web/src/components/groups/GroupRanking.tsx`, `apps/web/src/components/groups/MemberTops.tsx`, `apps/web/src/components/groups/MonthSummary.tsx`, `apps/web/src/components/groups/GroupShares.tsx`, `apps/web/src/components/SharePlaylistSheet.tsx`, `apps/web/src/art.css`
- Leer como contexto: los componentes de `apps/web/src/components/art/`, `apps/web/src/components/PlaylistArt.tsx`, `apps/web/src/components/Cover.tsx`
- Qué hacer:
  1. `AddToPlaylistSheet`: `PlaylistArt` 40 px en lugar del icono `ListMusic`.
  2. `Nav` (escritorio): `PlaylistArt` 24 px delante de cada nombre (fila con `ellipsis` en el texto).
  3. `SourcePicker`: cambiar el `<select>` por una lista de opciones tipo radio (`role="radiogroup"`, botones con `aria-checked`, `PlaylistArt` 32 px + nombre), con la misma etiqueta `study.source.playlist` y el mismo `onChange`; manejable con teclado (Tab/Enter/Espacio).
  4. `PodcastsView` (episodios): `Cover` 40 px del episodio; `ShowPickSheet`: `Cover` del primer episodio de cada serie.
  5. `RecapCards` (solo «Canciones»), `GroupRanking` (canciones), `MemberTops`, `MonthSummary`: `StatTrackArt` 36-40 px. Los artistas no llevan imagen.
  6. `GroupShares` (`ShareRow`): `GeneratedArt` 44 px con semilla `share.title`, `kind 'playlist'` (lista y Jam).
  7. `SharePlaylistSheet`: si la cabecera muestra el nombre de la playlist, añadir `PlaylistArt` 48 px.
  8. Estilos que falten, en `art.css`.
- TDD: no
- Criterios de aceptación:
  - [ ] En todos esos sitios hay imagen al lado del nombre (o dibujo ámbar); el modo estudio se elige igual que antes, también con teclado.
  - [ ] `npm run check` en verde y los tests de estudio, estadísticas y grupos siguen pasando.
- Verificación: `npm run check`

### T5 · Portadas en YouTube, «Enviar», paquetes y listas compartidas · Grupo B · Estado: HECHA

- Depende de: T2
- Archivos (exclusivos): `apps/web/src/components/downloads/PickList.tsx`, `apps/web/src/components/downloads/PlaylistPicker.tsx`, `apps/web/src/components/downloads/DownloadQueue.tsx`, `apps/web/src/components/send/Outbox.tsx`, `apps/web/src/components/send/ParcelPanel.tsx`, `apps/web/src/components/send/ParcelSheet.tsx`, `apps/web/src/views/SharedListView.tsx`, `apps/web/src/components/jam/JamQueue.tsx`, `apps/web/src/components/jam/JamAddSheet.tsx`, `apps/web/src/socialCovers.css`
- Leer como contexto: `apps/web/src/components/SongThumb.tsx`, `apps/web/src/components/art/SongMosaic.tsx`, `apps/web/src/components/art/GeneratedArt.tsx`
- Qué hacer:
  1. `PickList`: `SongThumb` 32 px (`videoId = e.id`, `title`, `artist = e.author`) en cada fila, sin romper el checkbox ni la etiqueta.
  2. `PlaylistPicker`: `PlaylistCover` cae a `GeneratedArt` (`kind 'playlist'`, semilla el título) en lugar del icono.
  3. `DownloadQueue`: la miniatura usa `SongThumb` (`src = job.thumbnail`, `videoId = job.videoId`, `title`).
  4. `Outbox`: el plan B pasa a `SongThumb`/`GeneratedArt` (no el icono de radio).
  5. `ParcelPanel` (cesta): `SongThumb` 40 px. `ParcelSheet`: `SongMosaic` 48 px al lado del nombre del paquete; pasar `title`/`artist` a los `SongThumb` de `SongRows`.
  6. `SharedListView`: `SongMosaic` 120 px en la cabecera junto al nombre.
  7. `JamQueue` y `JamAddSheet`: pasar `title`/`artist` a `SongThumb` (mejor semilla del dibujo).
- TDD: no
- Criterios de aceptación:
  - [ ] Sin conexión, cada fila muestra dibujo ámbar en lugar de una imagen rota.
  - [ ] `npm run check` en verde.
- Verificación: `npm run check`

### T6 · Deslizar en reproductores (carrusel) y listas (círculo) · Grupo B · Estado: HECHA

- Depende de: T3 (y T2 solo por el aspecto de `Cover`)
- Archivos (exclusivos): `apps/web/src/components/player/MiniPlayer.tsx`, `apps/web/src/components/player/NowPlaying.tsx`, `apps/web/src/components/player/Neighbour.tsx` (nuevo), `apps/web/src/components/jam/JamBar.tsx`, `apps/web/src/components/TrackList.tsx`, `apps/web/src/gestures.css`, `apps/web/src/swipe.css`
- Leer como contexto: `apps/web/src/components/gestures/*`, `apps/web/src/player/neighbours.ts`, `apps/web/src/hub/jamFromLibrary.ts` (`jamSongPlaying`), `apps/web/src/player/radioEngine.ts` (`stationAt`), `docs/plan/bocetos/deslizar.html`
- Qué hacer:
  1. `Neighbour.tsx`: `useNeighbour(direction)` → lo que hay que dibujar: canción de la biblioteca (`nextTrackId`/`previousTrackId` con el estado del reproductor), emisora (`stationAt` ±1), o en una Jam de este móvil la siguiente de `snapshot.queue[0]` (sin «anterior»). Componente `NeighbourCard({ direction, variant: 'mini' | 'big' })` con la misma maqueta que la tarjeta actual (portada + título + subtítulo), `aria-hidden`.
  2. `MiniPlayer`: el área que abre la pantalla grande usa `useSwipe` + `SwipeTrack` con `NeighbourCard 'mini'`; `changeSong` igual que hoy (Jam: no hay derecha). Quitar `SwipeHint`. Al pulsar sin deslizar se abre la pantalla grande como siempre.
  3. `NowPlaying`: el gesto envuelve **solo** portada + título/artista (el corazón va dentro pero con `onPointerDown` que no inicia el arrastre); `SeekBar`, controles, volumen y cola quedan fuera. Misma acción que el mini reproductor (exportar `changeSong` desde `MiniPlayer.tsx` o moverla a `Neighbour.tsx`). `touch-action: pan-y`.
  4. `JamBar`: usar el nuevo `useSwipe`/`SwipeTrack` (izquierda = `requestSkip`, la vecina es `snapshot.queue[0]`); borrar el `useSwipe` y `SwipeHint` viejos de este archivo.
  5. `TrackList`: sustituir el texto `.swipe-hint` por `SwipeRing` (`icon 'jam'` si `jamIsActive()`, si no `'queue'`), con `progress = dx / SWIPE_TRIGGER`; el gesto, el umbral y la acción no cambian.
  6. `gestures.css`: borrar los estilos `.mini-swipe-hint`; en `swipe.css` lo que falte. Vibración de 15 ms como hoy.
- TDD: no (la lógica la cubren T3 y sus tests)
- Criterios de aceptación:
  - [ ] Ya no existe ningún texto/botón «Siguiente»/«Anterior» al deslizar (Grep de `player.swipe.next|player.swipe.prev|mini-swipe-hint` sin usos en `src`).
  - [ ] Mini reproductor y pantalla grande: la vecina entra pegada al dedo; al soltar pasado el umbral cambia de canción; si no, vuelve. La barra de progreso de la pantalla grande se arrastra sin cambiar de canción.
  - [ ] Barra de la Jam: izquierda salta; derecha no se mueve. Filas: círculo que crece y se rellena; «Añadir a la cola» funciona igual.
  - [ ] Con reduced-motion no hay animación de salida; las flechas del teclado cambian de canción en el mini reproductor.
- Verificación: `npm run check` (tests de `swipe`, `neighbours`, `jamRemote`, `jamStore` en verde)

## Fase 2 (carga, Compartir y Cargar más) — después de la Fase 1

### T7 · Carga solo con el logo · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/BootSplash.tsx`, `apps/web/src/lib/boot.ts`, `apps/web/src/boot.css`, `apps/web/index.html`, `apps/web/test/boot.test.ts`, `apps/mobile/android/app/src/main/res/values/styles.xml` (solo si hiciera falta)
- Leer como contexto: `apps/web/src/App.tsx:94-146` (no se toca: mantener exportadas `BOOT_MAX_WAIT_MS`, `bootReady`, `splashTimings`), `apps/web/public/_headers` (CSP)
- Qué hacer:
  1. `boot.ts`: `BOOT_MIN_SPLASH_MS = 400`, `SPLASH_EXIT_MS = 300`, nuevo `BOOT_PULSE_AFTER_MS = 1000` y `shouldPulse(elapsedMs, reducedMotion): boolean`; quitar `BOOT_CONNECTING_HINT_MS`. `splashTimings(true)` → `{ minMs: 400, exitMs: 150 }`. `bootReady` no cambia (sigue entrando a los 5 s en modo sin conexión).
  2. `BootSplash`: solo el logo (barras rellenas, sin trazo ni destello), sin `<p>`; `role="status"` y `aria-label={t('boot.loading')}` (no visible). A los 1000 ms añade la clase `pulsing` (no con reduced-motion).
  3. `boot.css`: borrar trazo, relleno, destello y `.boot-hint`; `.boot-splash.pulsing .boot-pulse` con latido suave (escala 1 → 1,04 y brillo ámbar, 2,4 s, `ease-in-out`, infinito); salida con fundido.
  4. `index.html`: dentro de `div.boot-splash`, el mismo SVG estático y un `<style>` en línea mínimo (fondo `#14110f`, centrado, 96 px) para que no haya pantalla vacía antes del JS. Sin texto.
  5. Android: comprobar que el splash nativo sigue siendo solo el logo (ya lo es); no añadir texto.
- TDD: sí (`boot.ts`)
- Criterios de aceptación:
  - [ ] Tests: `shouldPulse` falso antes de 1 s y con reduced-motion; `bootReady` igual que antes (online, offline y 5 s).
  - [ ] Grep: `BootSplash.tsx` e `index.html` no muestran ningún texto visible; no hay botones.
- Verificación: `npx vitest run test/boot.test.ts --root apps/web` y `npm run check`

### T8 · Búsqueda con continuación (shared, Hub y API) · Grupo C · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/youtube.ts`, `packages/shared/test/youtube.test.ts`, `apps/hub/src/lib/search.ts`, `apps/hub/src/routes/search.ts`, `apps/hub/src/jam/routes.ts`, `apps/hub/test/search.test.ts`, `apps/api/src/routes/youtube.ts`, `apps/api/test/youtubeSearch.test.ts` (nuevo)
- Leer como contexto: `packages/shared/src/youtube.ts:400-483` (tokens de playlists), `apps/hub/test/jamRoutes.test.ts`, un test existente de rutas de `apps/api/test/` (patrón con `fetch` simulado)
- Qué hacer: todo lo de «Cargar más» en Contratos. `parseSearchPage` busca el token en `continuationItemRenderer.continuationEndpoint.continuationCommand.token` (web, también dentro de `appendContinuationItemsAction`) y en `nextContinuationData.continuation` / `continuations[].nextContinuationData` (YouTube Music); los resultados de páginas siguientes salen con el mismo `parseSearchResponse`. Validación de `continuation` con zod (`isContinuationToken`). Los errores de YouTube siguen siendo 502 `search_unavailable` y el detalle solo en el registro del servidor.
- TDD: sí
- Criterios de aceptación (tests):
  - [ ] Primera página web y de Music con token → `continuation` correcto; sin token → `null`; página siguiente (formato `appendContinuationItemsAction` y `musicShelfContinuation`) → resultados y nuevo token.
  - [ ] `buildSearchRequest` con token → cuerpo con `continuation` y sin `query`.
  - [ ] Hub y API: `?continuation=` válido se reenvía; uno con caracteres raros o > 4096 → 400; respuesta con `{ results, continuation }`; la búsqueda de la Jam sigue devolviendo `{ results }`.
- Verificación: `npx vitest run test/youtube.test.ts --root packages/shared`, `npx vitest run test/search.test.ts test/jamRoutes.test.ts --root apps/hub`, `npx vitest run test/youtubeSearch.test.ts --root apps/api` y `npm run check`

### T9 · Compartir → Aske Stream: parte nativa y análisis del enlace · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/ShareTargetPlugin.java` (nuevo), `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/MainActivity.java`, `apps/mobile/android/app/src/main/AndroidManifest.xml`, `apps/web/src/native/shareTarget.ts` (nuevo), `apps/web/test/fake-native/shareTarget.ts` (nuevo), `apps/web/vite.config.ts`, `apps/web/src/share/sharedLink.ts` (nuevo), `apps/web/test/sharedLink.test.ts` (nuevo)
- Leer como contexto: `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/QrScannerPlugin.java` (plugin pequeño de patrón), `apps/web/src/native/askeNative.ts`, `apps/web/test/fake-native/qrScanner.ts`, `packages/shared/src/youtube.ts:91-138` (`youtubeVideoId`, `classifyPlaylistLink`, `isYoutubeUrl`)
- Qué hacer: todo lo de «Compartir» en Contratos.
  - Manifiesto: en `MainActivity`, nuevo `intent-filter` con `android.intent.action.SEND`, `android.intent.category.DEFAULT` y `<data android:mimeType="text/plain" />`, con un comentario de para qué sirve (como los permisos).
  - `MainActivity`: `registerPlugin(ShareTargetPlugin.class)` antes de `super.onCreate`.
  - `vite.config.ts`: alias `fakenative` de `native/shareTarget` a `test/fake-native/shareTarget.ts`.
  - `native/shareTarget.ts`: con `isNative` falso, `takeSharedText` → `null` y `onSharedText` no hace nada.
- TDD: sí (`sharedLink.ts`); Java y puente, no
- Criterios de aceptación (tests):
  - [ ] «Mira esto https://youtu.be/abc123def45?si=x» → vídeo; `music.youtube.com/watch?v=…&list=…` → vídeo; `youtube.com/playlist?list=PL…` → playlist; mix (`RD…`) → `blocked mix`; «hola», `https://example.com` y texto vacío → `invalid`; texto de 10 000 caracteres no se cuelga.
  - [ ] `npm run check` en verde; el APK compila (`.\gradlew.bat assembleRelease` en `apps/mobile/android`, si hay JDK 21; si no, anotar «VERIFICAR en CI»).
- Verificación: `npx vitest run test/sharedLink.test.ts --root apps/web` y `npm run check`

### T10 · «Cargar más» en la pantalla de búsqueda · Grupo D · Estado: HECHA

- Depende de: T1, T2, T8
- Archivos (exclusivos): `apps/web/src/views/DownloadView.tsx`, `apps/web/src/components/downloads/SearchPanel.tsx` (nuevo), `apps/web/src/components/downloads/SearchResultRow.tsx` (nuevo), `apps/web/src/downloads/searchPages.ts` (nuevo), `apps/web/test/searchPages.test.ts` (nuevo), `apps/web/src/native/downloader.ts`, `apps/web/test/fake-native/downloader.ts`, `apps/web/src/hub/client.ts`, `apps/web/src/api/client.ts`
- Leer como contexto: `packages/shared/src/youtube.ts` (`SearchPage`), `apps/web/src/components/SongThumb.tsx`, `apps/web/src/components/art/GeneratedArt.tsx`
- Qué hacer:
  1. Sacar `SearchPanel`, `searchFor` y `ResultRow` (con `useInLibrary`, `actionLabel`, `actionIcon`) de `DownloadView.tsx` a los dos archivos nuevos, sin cambiar su comportamiento; `DownloadView` baja de 400 líneas.
  2. `searchFor` devuelve `SearchPage`; los tres clientes aceptan `continuation` según Contratos.
  3. Estado de la búsqueda: `continuation`, `loadingMore`, `moreError`. Al final de la lista, si hay `continuation`: botón «Cargar más» (`dl.loadMore`; mientras carga, `dl.loadingMore` con spinner y botón desactivado). Al añadir, `appendResults`. Si una página llega vacía o sin token → `dl.noMore`. Error → `dl.loadMoreFailed` (los resultados ya vistos se quedan). Cambiar de búsqueda o de tipo invalida la carga en curso (como `searchSeq`).
  4. `SearchResultRow`: miniatura con `SongThumb` (`src = result.thumbnail`, `videoId` si es vídeo, `title`, `artist`); en playlists, plan B `GeneratedArt 'playlist'`.
- TDD: sí (`searchPages.ts`); la UI, no
- Criterios de aceptación:
  - [ ] Test: `appendResults` quita duplicados y mantiene el orden.
  - [ ] Con un servidor viejo (sin `continuation`) no aparece el botón y nada falla.
  - [ ] En `fakenative`, la falsa `searchOnPhone` devuelve un token en la primera página y ninguno en la segunda (para T12).
- Verificación: `npx vitest run test/searchPages.test.ts --root apps/web` y `npm run check`

### T11 · Ficha «Compartido desde YouTube» · Grupo D · Estado: HECHA

- Depende de: T1, T2, T9
- Archivos (exclusivos): `apps/web/src/stores/shareIn.ts` (nuevo), `apps/web/test/shareInStore.test.ts` (nuevo), `apps/web/src/components/share/ShareInSheet.tsx` (nuevo), `apps/web/src/shareIn.css` (nuevo), `apps/web/src/App.tsx`
- Leer como contexto: `apps/web/src/share/sharedLink.ts`, `apps/web/src/native/shareTarget.ts`, `apps/web/src/components/downloads/PlaylistPicker.tsx` (props), `apps/web/src/stores/downloads.ts:345-395` (`enqueue`), `apps/web/src/components/Sheet.tsx`, `apps/web/src/views/DownloadView.tsx:277-281` (`useInLibrary`: escribir el mismo selector dentro de la hoja, no importarlo, porque T10 lo mueve en paralelo)
- Qué hacer:
  1. `stores/shareIn.ts`: `{ pending: SharedLink | null; receive(text: string): void; clear(): void }` y `startShareIn(): () => void` (llama a `takeSharedText` una vez y se suscribe a `onSharedText`; cada texto → `receive(parseSharedText(text))`; un enlace nuevo sustituye al anterior).
  2. `App.tsx` (`Shell`): `useEffect(() => startShareIn(), [])` solo si `isNative`; montar `<ShareInSheet />` junto a las otras hojas.
  3. `ShareInSheet`:
     - vídeo: `SongThumb` grande (`videoId`), título de `fetchVideoInfo` (mientras, `shareIn.loading`; si `null`, `shareIn.unknownTitle` y debajo `shareIn.infoFailed`), autor; si ya está en la biblioteca, `dl.inLibrary` y sin botón; si no, «Descargar» (`shareIn.download`) → `useDownloads.getState().enqueue([{ videoId, title, author, thumbnail: youtubeThumb(videoId) }])`, `toast(shareIn.added)` y cerrar; y «Cancelar»;
     - playlist: `<PlaylistPicker result={{ kind: 'playlist', id, title: '', author: '', thumbnail: '', url }} via={null} onClose={clear} />`;
     - `blocked`: `pick.err.mix` / `pick.err.personal`; `invalid`: `shareIn.notYoutube`; las dos con botón `shareIn.ok`.
  4. Errores de `enqueue`: `toast(t('dl.linkFailed'), 'error')` y `console.error` del detalle.
- TDD: sí (`shareIn` store: recibe, sustituye, limpia, arranque en frío con texto pendiente); la hoja, no
- Criterios de aceptación:
  - [ ] Tests del store en verde (con `shareTarget` simulado).
  - [ ] En `fakenative`, `window.__askeFakeShare('https://youtu.be/…')` abre la ficha con portada y «Descargar», y la descarga aparece en la cola.
- Verificación: `npx vitest run test/shareInStore.test.ts --root apps/web` y `npm run check`

### T12 · Tests de navegador de la v0.9.5 · Grupo E · Estado: HECHA

- Depende de: T1-T11
- Archivos (exclusivos): `apps/web/test/browser/v9_095.py` (nuevo), `apps/web/test/browser/README.md`
- Leer como contexto: `apps/web/test/browser/v5_fakenative.py`, `apps/web/test/fake-native/shareTarget.ts`, `apps/web/test/fake-native/downloader.ts`
- Qué hacer: un test Playwright (build `fakenative`, móvil 390 px con `has_touch`) que compruebe: la carga no muestra texto visible; en la lista de canciones cada fila tiene imagen (`img` o `.gen-art`); un deslizamiento táctil a la derecha en una fila dibuja el círculo y añade a la cola; un deslizamiento a la izquierda en el mini reproductor cambia de canción sin texto «Siguiente»; buscar → «Cargar más» añade resultados y después sale `dl.noMore`; `__askeFakeShare` con un vídeo abre la ficha y «Descargar» lo pone en la cola; con texto no válido sale el aviso. Añadir la fila a la tabla del README. Tras las pruebas, reconstruir el `dist` normal y cerrar wrangler/workerd.
- TDD: no
- Criterios de aceptación:
  - [ ] `python apps/web/test/browser/v9_095.py` pasa contra `wrangler dev` con el build `fakenative`.
- Verificación: el propio test (ver README) y `npm run check`

### T13 · Ayuda, documentación, notas, limpieza de textos y versión 0.9.5 · Grupo E · Estado: HECHA

- Depende de: T1-T11
- Archivos (exclusivos): `apps/web/src/help/articles/*.ts`, `apps/web/src/i18n/*.ts` (solo borrar claves sin uso), `docs/ESTADO.md`, `docs/v2/architecture.md`, `docs/PRIVACY.md`, `docs/hub.md`, `docs/android.md`, `docs/releases/v0.9.5.md` (nuevo), los 7 `package.json` (raíz, `apps/web`, `apps/api`, `apps/hub`, `apps/mobile`, `packages/shared`, `tools/ingest`) y `package-lock.json`
- Leer como contexto: `apps/web/test/help.test.ts`, `docs/releases/v0.9.4.md`, este plan
- Qué hacer (eu/es/en, lenguaje sencillo):
  1. Ayuda: `listen.ts` (deslizar: la siguiente o la anterior entra con el dedo; en listas, el círculo = añadir a la cola), `music.ts` o el artículo de descargas (Compartir → Aske Stream desde YouTube / YouTube Music, qué enlaces vale, «Cargar más» y que puede fallar porque YouTube cambia), `privacy.ts` (miniaturas de YouTube). Consejo de pantalla si hace falta.
  2. Borrar las claves que ya no se usan, comprobándolo con Grep en `src` y en la ayuda: `boot.connecting`, `player.swipe.next`, `player.swipe.prev`, `swipe.queue`, `swipe.jam` (si alguna sigue usándose, dejarla).
  3. `PRIVACY.md` (en y es): las miniaturas de canciones que no están en tu biblioteca (Jam, listas compartidas, «Enviar», búsqueda, ficha de Compartir) se piden directamente a YouTube (`i.ytimg.com`) desde tu aparato, sin referer: YouTube/Google ve tu IP y qué vídeo se muestra, como al ver una miniatura en su web; el título al compartir se pide al oEmbed público de YouTube; las portadas de tu biblioteca y los dibujos ámbar no salen de tu aparato; las estadísticas de grupos no envían ids de YouTube.
  4. `hub.md` (`?continuation=` en `/search`), `android.md` (intent `SEND` `text/plain` y para qué sirve), `ESTADO.md`, tabla de fases (v0.9.5 = fase 9.3) y `docs/releases/v0.9.5.md`.
  5. Versión 0.9.5 en los 7 `package.json` y en las 8 entradas de `package-lock.json` (con `node`, no con `sed`).
- TDD: no
- Criterios de aceptación:
  - [ ] `help.test.ts` e `i18n.test.ts` pasan; `ESTADO.md` al día; versión 0.9.5 en todos los sitios.
- Verificación: `npm run check` y después `npm run test:e2e` (cerrar wrangler/workerd colgados)

## Paso final del orquestador (tras aprobar la revisión, sin volver a preguntar)

1. `npm run check`, `npm run test:e2e` (en Windows vale si dice que pasan todas las comprobaciones) y `v9_095.py`; reconstruir el `dist` normal y cerrar wrangler/workerd.
2. `npm run deploy:hub` (búsqueda con continuación; **sin** migración) — antes que la web.
3. `npm run deploy` (web y API; sin `db:migrate:remote`: no hay migraciones). Los amigos con Cloudflare verán el aviso de actualizar su servidor; hasta entonces no ven «Cargar más» en el ordenador.
4. Commits en Conventional Commits (uno por cambio lógico) con autor `Andoni Ortiz de Zarate Urruela <Ando144@users.noreply.github.com>` y sin ninguna mención a Claude; `git push`.
5. Tag `v0.9.5` y `git push` del tag: CI construye y publica los APK.

## Riesgos / dudas abiertas

- **Duda 1 — Portadas en las estadísticas de grupos** (el Hub solo tiene título y artista):
  - **(Recomendada) A. Portada de tu biblioteca si tienes esa canción; si no, dibujo ámbar.** Sin tocar el Hub ni compartir más datos. Inconveniente: las canciones que tú no tienes salen con dibujo.
  - **B. Subir también el id de YouTube en las estadísticas compartidas** (campo opcional nuevo en `MonthTopTrack`/`RankedTrack`). Se ve la miniatura real, pero cambia el Hub, la política de privacidad (RGPD: más datos por persona) y solo funciona con estadísticas nuevas.
  - Recomiendo A: cumple «nunca sin imagen» sin ampliar lo que se comparte.
- **Duda 2 — Elegir playlist en el modo estudio:** hoy es un desplegable del sistema, que no admite imágenes.
  - **(Recomendada) A. Cambiarlo por una lista con portada y nombre** (tipo botones de opción). Coherente con «nunca sin portada»; ocupa algo más de pantalla.
  - **B. Dejar el desplegable** como excepción. Cero cambios, pero rompe la regla.
  - Recomiendo A (está así en T4).
- **PWA en Android (Chrome):** la pantalla de arranque que dibuja el propio navegador al abrir la PWA instalada muestra el nombre de la app debajo del icono; no se puede quitar sin quitar el nombre del manifiesto. La app Android (APK) y la web sí quedan sin letras.
- **Salto entre el splash nativo y el web:** tamaños distintos (el de Android 12 lo fija el sistema). Se aproxima; VERIFICAR en el APK.
- **InnerTube (API no oficial):** el formato de continuación puede cambiar; YouTube Music puede exigir `ctoken` en la URL (VERIFICAR en T8 con una respuesta real si hay red). Si falla, mensaje claro y se conservan los resultados.
- **oEmbed** no funciona con vídeos privados o con restricción de edad: la ficha dice «Canción de YouTube» y se descarga igual (yt-dlp decidirá).
- **Rendimiento:** listas largas con `GeneratedArt` son SVG/CSS ligeros; `findTrackByTitle` usa índice cacheado. Las miniaturas de YouTube van con `loading="lazy"`.
- **Pendientes que siguen:** `stores/library.ts` (557 líneas) sin partir; VERIFICAR memoria con audios de 120-200 MB y subidas de 80-95 MB; descargas atascadas y podcasts de más de 2 h sin conexión (de `ESTADO.md`).

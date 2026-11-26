# PLAN: v0.9.3 — Arreglos de uso diario: descargas atascadas, audios grandes solo en el móvil, podcasts por serie, aleatorio de orden fijo, Jam desde la biblioteca, gestos y portadas

Fecha: 2026-11-26 · Estado: v0.9.3 COMPLETADA (fases 2 y 3 en borrador) · Decisiones: DEFINITIVAS (todas las dudas respondidas por Andoni)

## Objetivo

Publicar todo junto en **v0.9.3** (sin versión rápida aparte):

- las descargas atascadas en «Guardando» se pueden quitar y no bloquean la cola;
- los audios de más de 95 MB con Cloudflare se guardan **solo en este móvil**, con una explicación clara;
- el QR sale centrado y «Seleccionar» tiene aire;
- podcasts por serie y ordenados;
- aleatorio de orden fijo con «Barajar de nuevo» en Ajustes;
- Jam desde la biblioteca, portadas en los menús sociales y en «Enviar», y deslizar el mini reproductor.

Después: **v0.9.4** con la Jam como mando a distancia y Grupos (bocetos primero), y **v0.9.5** con
«Compartir → Aske Stream» y «Cargar más».

## Decisiones de Andoni (definitivas)

| Tema                                   | Decisión                                                                                                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cancelar con la subida ya en la nube   | Se borra la canción (1A)                                                                                                                                              |
| Serie del podcast                      | Canal guardado en `album`; las antiguas se arreglan a mano (2A)                                                                                                       |
| Orden de las series                    | A-Z (3A)                                                                                                                                                              |
| Orden de los episodios                 | Por número del título, de menor a mayor; los que no tienen número, por fecha de descarga (4A)                                                                         |
| Aleatorio                              | Orden fijo hasta acabar la ronda + «Barajar de nuevo» en Ajustes (5C). El interruptor **no** baraja                                                                   |
| Memoria del aleatorio                  | Una sola para toda la biblioteca (6A)                                                                                                                                 |
| Mini reproductor                       | Izquierda = siguiente, derecha = anterior (7B). Deslizar a la derecha una canción de la biblioteca sigue añadiéndola a la cola (o a la de la Jam)                     |
| Jam                                    | Mando a distancia para todos en **v0.9.4** (8, N1A). En v0.9.3 solo salta quien la creó                                                                               |
| Canción que no es de YouTube en la Jam | Se avisa y no se hace nada (9A)                                                                                                                                       |
| Portadas                               | En los menús sociales **y** en «Enviar» (10B)                                                                                                                         |
| Grupos                                 | Cualquier miembro cambia nombre y foto (11B). Foto recortada al centro automáticamente (12A). 2 bocetos antes de programar (13C). No se muestra quién lo cambió (N5B) |
| YouTube                                | «Compartir → Aske Stream» + «Cargar más» (14A)                                                                                                                        |
| Versiones                              | Tres: v0.9.3, v0.9.4 y v0.9.5 (15A)                                                                                                                                   |
| «Barajar de nuevo»                     | Orden nuevo, con lo oído al final (N2A)                                                                                                                               |
| Más de 95 MB con Cloudflare            | Se guarda solo en este móvil (N3B)                                                                                                                                    |
| Tiempo límite de subida                | Se suponen 64 KB/s, con tope de 30 min (N4A)                                                                                                                          |
| Saltos en la Jam                       | Sin aviso cuando alguien salta (N6B)                                                                                                                                  |

## Diagnóstico (con archivo y línea)

### 1. Descargas atascadas en «Guardando» en Cloudflare (podcasts de más de 1 h)

CONFIRMADO:

- **La X no hace nada en `saving`:** `cancelOne` sale sin hacer nada (`apps/web/src/stores/downloads.ts:167`), aunque la cola dibuja la X (`components/downloads/DownloadQueue.tsx:8`, `:118`, `:140-147`).
- **No hay forma de abortar:** `saveJob` no pasa ningún `AbortSignal` (`downloads.ts:234-259`, `downloads/save.ts:221`).
- **Bloquean la cola:** Cloudflare guarda 2 a la vez (`downloads/pipeline.ts:6`) y `pump` solo empieza otra si hay hueco (`downloads.ts:202`). Dos podcasts atascados la bloquean.
- **No se pueden quitar:** «Borrar terminados» conserva los activos (`downloads.ts:409`).
- **Al reabrir vuelve a empezar:** `restore` convierte `saving` en `downloaded` (`pipeline.ts:51-52`) y `pump` lo coge enseguida.
- **Tiempo límite enorme:** `uploadTimeoutMs` supone solo 16 KB/s y no tiene tope (`save.ts:22-24`): 90 MB ≈ 1 h 34 min por intento.
- **Los errores del servidor reintentan:** un 5xx o un tiempo agotado cuenta como fallo de red (`downloads/retry.ts:16`, `:26`) y se reintenta hasta 6 veces (`retry.ts:3-4`).
- **El tope de 95 MB se mira tarde:** el cliente no lo comprueba aunque ya sabe el tamaño (`downloads/types.ts:18`, `file.bytes`). Además, lee el audio entero en memoria antes (`save.ts:32-36`, `:79-85`). El Worker solo lo comprueba después de leer todo el formulario (`apps/api/src/routes/ingest.ts:54`, `:80`).
- **Cálculo:** con Opus a ~128 kbit/s, un podcast ocupa ~58 MB por hora, así que pasa de 95 MB a partir de ~1 h 40 min.

SUPUESTO (VERIFICAR): el Worker (128 MB de memoria; el plan gratuito corta las peticiones de más de 100 MB) puede fallar con 5xx al leer con `formData()` audios de 80-95 MB.

### 2. El modelo permite «solo en este móvil» con Cloudflare (CONFIRMADO)

- `LocalTrack.locations` admite `device` junto a `cloudflare` y `drive`, también sin ninguno de los dos (`storage/types.ts:8-16`).
- La reproducción y la portada ya prefieren el archivo del móvil (`storage/media.ts:24-27`, `:50-57`).
- La rotación sin conexión excluye lo que está en el móvil y los podcasts (`stores/offline.ts:171-179`).
- «Descargar» en la selección también lo excluye (`components/SelectionBar.tsx:28`, `PlaylistView.tsx:62`).
- **Falta:** la biblioteca se carga de **un solo** hogar (`stores/library.ts:151-161`, `getHome()`), con una caché por hogar (`library.ts:66`, `:78-85`). El almacén `tracks` de IndexedDB es el del hogar «dispositivo» (`offline/db.ts:42`, `storage/homes.ts:131-136`), así que no sirve: podría tener una biblioteca antigua de «dispositivo».
- **Solución:** un almacén nuevo `local-extras` que se mezcla con la biblioteca del hogar.
- **Copiar** (`storage/copy/run.ts:213`) usa `home.load()` y `deviceHome.load()` (`copy/endpoints.ts:59`): los extras no entran, así que no se suben ni se duplican.

### 3. Podcasts separados (CONFIRMADO)

- `PodcastsView` agrupa por `artist || album` (`views/PodcastsView.tsx:33`).
- El `artist` sale del título del vídeo (`packages/shared/src/youtube.ts:79-85`) y el canal no se guarda (`youtube.ts:87`).

### 4. QR descentrado (CONFIRMADO)

`.sheet-body` (`styles.css:2339-2345`) gana a `.groups-invite` (`groups.css:56-59`): misma especificidad y se carga después (`main.tsx:3` frente a `:7`).

### 5. «Seleccionar» pegado (CONFIRMADO)

`views/PlaylistsView.tsx:89-96`: un `div.row` sin margen justo después de `FriendsRow`.

### 6. Aleatorio hoy (CONFIRMADO)

- Cada Play baraja de nuevo, aunque pone primero las no oídas (`player/shuffleCycle.ts:53-61`, `stores/player.ts:107-110`, `:295`).
- Con «Ahorro de datos» se ignora la ronda (`player.ts:292-293`, `player/queue.ts:112-113`).
- Buscar o filtrar usa otra ronda (`views/LibraryView.tsx:76`).
- Encender Aleatorio también baraja (`player.ts:373-375`).

## Decisiones de arquitectura

- **Descargas que no se atascan:**
  - La X cancela en cualquier estado activo, también en `saving`, con un `AbortController` por trabajo. Abortar cuenta como `canceled`, nunca como red.
  - Si el guardado termina a pesar de cancelar, se borra la canción.
  - Un vigilante pasa a error lo que lleve en `saving` más que su tiempo límite + 2 min (`savingSince`).
  - Tiempo límite: `max(2 min, min(30 min, bytes / 64 KB/s))`.
- **Carriles de guardado:**
  - «nube»: con Cloudflare y Drive, hasta 2 a la vez y como mucho 1 grande (> 30 MB);
  - «móvil»: los que van solo al móvil, 1 a la vez, independiente de la nube.
  - Así un audio largo nunca para a las canciones normales.
- **Más de 95 MB con Cloudflare → solo en este móvil:**
  - Se decide **antes** de leer el archivo, con `file.bytes`. El audio y la portada se escriben en OPFS como en el hogar «dispositivo» (`saveDeviceFile`).
  - La canción se guarda con `locations: { device: true }` en el almacén nuevo `local-extras` y la biblioteca la mezcla.
  - Nunca se intenta subir: no hay ningún proceso que suba más tarde lo que está en el móvil.
  - Lo mismo ocurre si un audio grande (> 30 MB) falla 2 veces en Cloudflare con un error del servidor o un tiempo agotado. Sin conexión no: se espera a la red como ahora.
- **Drive** no tiene tope de 95 MB: allí solo cambian el tiempo límite, los reintentos y los carriles.
- **«Solo en este móvil» en la biblioteca:**
  - `isOnlyOnDevice(track, home)` = `home !== 'device' && locations.device && !locations.cloudflare && !locations.drive`.
  - Se marca con el aviso «Solo en este móvil» en las listas y en Podcasts, y el ⋮ lo explica.
  - Me gusta, Mover a podcasts, Cambiar de serie y Borrar funcionan (van al almacén local).
  - No se pueden meter en playlists de la nube: se filtran y se avisa.
  - En la web y en otros aparatos no aparecen.
  - Copiar, la caché sin conexión y la rotación no los tocan.
- **Serie = `album`:** las descargas nuevas guardan el canal si `album` viene vacío. Hay «Cambiar de serie» y «Renombrar serie» (si el nombre ya existe, se juntan). No hace falta migrar nada.
- **Aleatorio de orden fijo:** semilla por ronda, con un orden por hash estable de `(semilla, id)`. La biblioteca es una sola ronda (`library`). Funcionamiento exacto en «Contratos».
- **Jam desde la biblioteca:** solo canciones de YouTube y como mucho 10 tuyas esperando (`packages/shared/src/hub.ts:10`, `apps/hub/src/jam/state.ts:84-85`).
- **Portadas de canciones del hub:** miniatura pública de YouTube; la CSP ya lo permite (`apps/web/public/_headers:2`).
- **Textos y estilos:** los textos van en módulos i18n nuevos registrados en T1 (`es.ts` ya tiene 727 líneas). El CSS va en archivos propios (`styles.css` ya tiene 2540 líneas).
- **Dos fases dentro de v0.9.3** (1A con 5 tareas, 1B con 4), para no pasar de 7 por fase. Se publica todo junto. El hub no cambia en v0.9.3.

## Contratos (interfaces compartidas)

### Aleatorio: funcionamiento exacto (T2)

- **Ronda:** `{ seed, played[] }` por lista. La biblioteca entera es la ronda `library`, con cualquier filtro o búsqueda.
- **Con Aleatorio activo, la lista suena así:** canción elegida (si la hay) → no oídas por `rankBySeed(seed)` → oídas en el mismo orden. Igual en cada Play, en cada canción tocada y con ahorro de datos (en ese caso, dentro de las no oídas, primero las que están sin conexión).
- **Oída:** cuenta al empezar a sonar en aleatorio, como ahora.
- **Interruptor encendido:** sigue la ronda guardada con la misma semilla y **no baraja**. Si no hay ronda, la crea.
- **Interruptor apagado:** la lista sigue su orden normal desde la canción actual. La ronda se conserva tal cual y lo que suena no cuenta como oído.
- **Fin de la ronda:** semilla nueva, `played` vacío y la última canción no abre la ronda nueva.
- **«Barajar de nuevo»** (Ajustes → Reproducción): semilla nueva en todas las rondas y lo oído sigue al final. Si suena una lista en aleatorio, lo que viene después se reordena al momento. Aviso `toast.reshuffled`.

```ts
// apps/web/src/player/shuffleCycle.ts
export interface ShuffleCycle { key: string; played: string[]; usedAt: number; seed?: number }
export function newSeed(random?: () => number): number;
export function rankBySeed(ids: readonly string[], seed: number): string[];   // FNV-1a of `${seed}:${id}`
export function roundOrder(ids: readonly string[], firstId: string | null,
  played: ReadonlySet<string>, seed: number): string[];
export function reseedAll(cycles: ShuffleCycles, random?: () => number): ShuffleCycles;
// PlayerState
previous(opts?: { skipRestart?: boolean }): void;
reshuffle(): void;
```

### Solo en este móvil (T1 crea el almacén; T3 lo mezcla en la biblioteca; T4 guarda)

```ts
// apps/web/src/offline/db.ts: new store 'local-extras' (keyPath 'id'), DB version +1
// apps/web/src/storage/localExtras.ts
export function listLocalExtras(): Promise<LocalTrack[]>;
export function putLocalExtra(track: LocalTrack): Promise<void>;
export function updateLocalExtra(id: string, patch: TrackPatch): Promise<LocalTrack>; // same rules as deviceHome.updateTrack
export function deleteLocalExtra(id: string): Promise<void>; // also deletes OPFS audio + cover
export function isOnlyOnDevice(track: LocalTrack, home: HomeKind | undefined): boolean;
// apps/web/src/components/OnlyHereBadge.tsx
export function OnlyHereBadge(props: { size?: number }): JSX.Element; // Smartphone icon + aria-label local.badge
```

### Biblioteca (T3)

```ts
// stores/library.ts
setKindMany(trackIds: string[], kind: TrackKind): Promise<void>;
setAlbumMany(trackIds: string[], album: string): Promise<void>;
// Internal rule: every per-track write (like, likeMany, setKind*, setAlbumMany, deleteTrack)
// goes to localExtras when isOnlyOnDevice, otherwise to getHome().
// load(): after each set(fromSnapshot(...)) merge listLocalExtras() (only when home !== 'device').
// persist(): never writes extras into the home cache.
// createPlaylist / addToPlaylist: drop extras ids and toast local.notInPlaylists (count).
```

### UI y piezas comunes (T1)

```ts
// stores/ui.ts
showPicker: string[] | null; openShowPicker(trackIds: string[]): void; closeShowPicker(): void;
// components/SongThumb.tsx
export function youtubeThumb(videoId: string): string; // https://i.ytimg.com/vi/<id>/mqdefault.jpg
export function SongThumb(props: { videoId: string; size?: number }): JSX.Element;
```

### Descargas (T4)

```ts
// downloads/types.ts → DownloadJob
savingSince?: number;
target?: 'home' | 'device-only';    // set before saving; persisted
// downloads/pipeline.ts (pure)
export const BIG_AUDIO_BYTES = 30 * 1024 * 1024;
export function saveTarget(home: HomeKind, bytes: number): 'home' | 'device-only'; // cloudflare && bytes > LIMITS.audioMaxBytes
export function nextToSave(jobs, now, busy: ReadonlySet<string>, home: HomeKind): DownloadJob | undefined;
  // cloud lane: ≤ saveConcurrency(home) and ≤ 1 big; device lane: ≤ 1, independent
export function stuckSaving(jobs, now): string[];
// downloads/save.ts
export function uploadTimeoutMs(bytes: number): number;  // max(120 s, min(30 min, bytes / 65 536 s))
export function saveDownloaded(job, file, home, signal?: AbortSignal): Promise<SaveOutcome>;
export function saveDeviceOnly(job, file, signal?: AbortSignal): Promise<SaveOutcome>; // OPFS + putLocalExtra
// downloads/retry.ts
export function planRetry(attempts, now, online, bytes?: number): RetryPlan; // big: give-up after 2
// storage/drive/api.ts
upload(meta, blob, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<DriveFile>;
```

### Jam desde la biblioteca (T7)

```ts
// apps/web/src/hub/jamFromLibrary.ts
export function toHubSong(track: LocalTrack): HubSong | null;
export interface JamSendPlan {
  songs: HubSong[];
  notYoutube: number;
  overLimit: number;
}
export function planJamSend(tracks: LocalTrack[], room: number): JamSendPlan;
export function jamRoom(): number;
export function jamIsActive(): boolean; // session !== null && connection === 'open'
export function jamSongPlaying(): boolean; // host and the player is on the Jam's current song
export function addTracksToJam(trackIds: string[]): void;
export function filterLibrarySongs(tracks: LocalTrack[], query: string, max: number): LocalTrack[];
```

### Podcasts (T6) y Enviar (T5)

```ts
// apps/web/src/podcasts/shows.ts
export interface Show { key: string; name: string; episodes: LocalTrack[] }
export function showNameOf(track: LocalTrack): string;
export function episodeNumber(title: string): number | null;
export function groupShows(tracks: LocalTrack[], unknownName: string): Show[];
// stores/parcel.ts → ActiveParcel (client only)
songs: HubSong[]; name?: string;
```

### Claves i18n nuevas (T1 las escribe en es, en y eu; aquí el texto en español)

`i18n/podcasts.ts` (`podcastsEn/Es/Eu`):

- `select.toPodcasts` «Mover a podcasts»
- `toast.movedToPodcastsMany` «{count} episodios movidos a Podcasts» · `.one` «1 episodio movido a Podcasts»
- `podcasts.changeShow` «Cambiar de serie» · `podcasts.renameShow` «Renombrar serie» · `podcasts.showMenu` «Opciones de la serie»
- `podcasts.showSheet.title` «¿De qué serie es?»
- `podcasts.showSheet.text` «Elige una serie que ya tengas o escribe un nombre nuevo. Los episodios de la misma serie salen juntos y en orden.»
- `podcasts.showSheet.placeholder` «Nombre de la serie» · `podcasts.showSheet.existing` «Tus series» · `podcasts.showSheet.save` «Guardar»
- `podcasts.toast.showChanged` «{count} episodios están ahora en «{name}»» · `.one` «El episodio está ahora en «{name}»»

`i18n/playback.ts` (`playbackEn/Es/Eu`):

- `swipe.jam` «Añadir a la Jam» · `jamSend.action` «Enviar a la Jam»
- `jamSend.done` «{count} canciones enviadas a la Jam» · `.one` «Canción enviada a la Jam»
- `jamSend.notYoutube` «{count} canciones no se han enviado: en una Jam solo pueden sonar canciones que vienen de YouTube.» · `.one` «Esta canción no se puede enviar: en una Jam solo pueden sonar canciones que vienen de YouTube.»
- `jamSend.limit` «Solo puedes tener {max} canciones tuyas esperando en la Jam. Se han quedado fuera {count}; envíalas cuando suene alguna.»
- `jamSend.offline` «Ahora mismo no estás conectado a la Jam. Comprueba tu conexión y vuelve a probar.»
- `player.swipe.next` «Siguiente» · `player.swipe.prev` «Anterior»
- `player.swipeLabel` «Desliza a la izquierda para pasar a la siguiente y a la derecha para volver a la anterior»
- `settings.reshuffle` «Barajar de nuevo»
- `settings.reshuffleHint` «El aleatorio sigue el mismo orden hasta que suenan todas las canciones. Pulsa aquí si quieres un orden nuevo; lo que ya has oído seguirá esperando al final.»
- `toast.reshuffled` «Listo: el aleatorio tiene un orden nuevo»

`i18n/downloads.ts` (`downloadsEn/Es/Eu`):

- `dl.st.canceling` «Cancelando…»
- `dl.toast.canceledSaving` «Cancelado. Esa descarga no se ha guardado en tu biblioteca.»
- `dl.st.savingBig` «Guardando {size} en tu biblioteca. Los audios largos tardan varios minutos; puedes seguir usando la app.»
- `dl.st.savingLocal` «Guardando en este móvil ({size})…»
- `dl.st.savedLocal` «Guardado solo en este móvil»
- `dl.toast.savedLocal` ««{title}» pesa {size} y no cabe en tu Cloudflare (máximo 95 MB). Lo hemos guardado solo en este móvil.» (un aviso por audio)
- `dl.err.saveTooSlow` «La subida iba demasiado lenta y la hemos parado. Prueba con wifi y pulsa Reintentar.»
- `dl.err.localFailed` «No hemos podido guardarlo en este móvil. Mira si te queda espacio libre y pulsa Reintentar.»
- `dl.remove` «Quitar de la lista»
- `local.badge` «Solo en este móvil»
- `local.explain` «Este audio es demasiado grande para tu Cloudflare (más de 95 MB), así que está guardado solo en este móvil. Lo puedes escuchar aquí, también sin conexión, pero no aparece en tus otros aparatos ni en la web. Si desinstalas la app o borras sus datos, se pierde.»
- `local.notInPlaylists` «{count} canciones están solo en este móvil y no se pueden poner en playlists de la nube.» · `.one` «Esta canción está solo en este móvil y no se puede poner en playlists de la nube.»

## Fase 1A (v0.9.3)

### T1 · Base: textos, piezas comunes, almacén «solo en este móvil» y CSS · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/src/i18n/podcasts.ts` (nuevo), `apps/web/src/i18n/playback.ts` (nuevo), `apps/web/src/i18n/downloads.ts` (nuevo), `apps/web/src/stores/ui.ts`, `apps/web/src/components/SongThumb.tsx` (nuevo), `apps/web/src/components/OnlyHereBadge.tsx` (nuevo), `apps/web/src/offline/db.ts`, `apps/web/src/storage/localExtras.ts` (nuevo), `apps/web/test/localExtras.test.ts` (nuevo), `apps/web/src/groups.css`, `apps/web/src/playlistSelect.css`, `apps/web/src/views/PlaylistsView.tsx`
- Leer como contexto: `apps/web/src/i18n/groups.ts`, `apps/web/src/storage/homes.ts:211-245` (`deviceHome` addTrack/updateTrack/deleteTrack), `apps/web/src/storage/deviceFiles.ts`, `apps/web/test/offlineDb.test.ts`
- Qué hacer:
  1. Los 3 módulos i18n con todas las claves, registrados en en/es/eu. Antes, comprobar con Grep que ninguna clave existe ya.
  2. `ui.ts`: `showPicker`, `openShowPicker` y `closeShowPicker`.
  3. `SongThumb` y `youtubeThumb` (lazy, `referrerPolicy="no-referrer"`, icono `Music` si falla) y `OnlyHereBadge`.
  4. `db.ts`: almacén `local-extras`, subiendo la versión de la base sin tocar los demás almacenes.
  5. `localExtras.ts` según «Contratos». `deleteLocalExtra` borra también `audio/<id>` y `covers/<id>` de OPFS.
  6. CSS: `.sheet-body.groups-invite` centrado; clase `playlists-select-row` (`margin: 12px 0 8px`) en `PlaylistsView.tsx:92`.
- TDD: sí (`localExtras`, `isOnlyOnDevice`)
- Criterios de aceptación:
  - [ ] Tests: guardar, leer, cambiar y borrar extras; `isOnlyOnDevice` es falso con `home === 'device'` o si tiene `cloudflare`/`drive`.
  - [ ] Paridad i18n; QR centrado; «Seleccionar» separado.
- Verificación: `npx vitest run test/localExtras.test.ts test/offlineDb.test.ts test/i18n.test.ts --root apps/web` y `npm run check`

### T2 · Aleatorio de orden fijo y «Barajar de nuevo» en Ajustes · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/player/shuffleCycle.ts`, `apps/web/src/stores/player.ts`, `apps/web/src/player/types.ts`, `apps/web/src/views/LibraryView.tsx`, `apps/web/src/components/settings/GeneralSections.tsx`, `apps/web/test/shuffleCycle.test.ts`, `apps/web/test/playerShuffle.test.ts`, `apps/web/test/shufflePreference.test.ts`
- Leer como contexto: `apps/web/src/player/queue.ts`, `docs/ESTADO.md`
- Qué hacer:
  1. Aplicar exactamente «Aleatorio: funcionamiento exacto». `toggleShuffle` ya no baraja.
  2. Ahorro de datos con la ronda (partición estable: primero las que están sin conexión).
  3. `previous({ skipRestart })` y `reshuffle()`.
  4. `LibraryView.tsx:76` → `cycleKey: 'library'`.
  5. `PlaybackSection`: botón «Barajar de nuevo» con su explicación. Las claves las crea T1; si T1 aún no está, se usan igualmente porque van en el mismo grupo y se integran juntas.
  6. Las rondas guardadas sin `seed` siguen funcionando. Quitar `shuffledCycleOrder` si queda sin uso.
- TDD: sí
- Criterios de aceptación (tests):
  - [ ] Escenario de Andoni: aleatorio, Play, 3 canciones, un podcast, Play → ninguna de las 3 y el mismo orden de antes.
  - [ ] Tocar una canción la pone primera y después sigue la ronda.
  - [ ] Apagar y encender Aleatorio **no** cambia el orden.
  - [ ] `reshuffle()` cambia el orden de lo que falta y deja lo oído al final.
  - [ ] Añadir una canción no altera el orden relativo; buscar o filtrar usa la misma ronda; con ahorro de datos se respeta la ronda.
  - [ ] `previous({ skipRestart: true })` va a la anterior pasados los 3 s.
- Verificación: `npx vitest run test/shuffleCycle.test.ts test/playerShuffle.test.ts test/shufflePreference.test.ts test/playerPauseDuringLoad.test.ts --root apps/web` y `npm run check`

> Nota de integración: T2 usa claves de T1. Si se ejecutan a la vez sobre la misma copia, `npm run check` de T2 se repite después de terminar T1.

### T3 · Biblioteca: acciones en bloque y canciones «solo en este móvil» · Grupo B · Estado: HECHA

- Depende de: T1
- Archivos (exclusivos): `apps/web/src/stores/library.ts`, `apps/web/test/libraryBulk.test.ts` (nuevo), `apps/web/test/libraryLocalExtras.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/storage/localExtras.ts`, `apps/web/src/stores/setup.ts` (`getHome`), `apps/web/test/storage.test.ts`
- Qué hacer:
  1. `setKindMany` y `setAlbumMany` (patrón de `likeMany`, optimistas y con vuelta atrás si fallan).
  2. Una función interna `storeFor(id)`: los extras van a `localExtras` y el resto a `getHome()`. Se usa en like, likeMany, setKind, setKindMany, setAlbumMany y deleteTrack.
  3. `load()`: mezclar `listLocalExtras()` después de cada `set(fromSnapshot(...))` (líneas 155 y 160), solo si `home !== 'device'`, en orden por `createdAt` y sin duplicar ids.
  4. `persist()`: no escribir los extras en la caché del hogar.
  5. `createPlaylist` y `addToPlaylist`: quitar los ids de extras y avisar con `local.notInPlaylists`. Si no queda ninguno, no llamar al hogar.
  6. Si `library.ts` pasa de ~450 líneas, sacar la mezcla a `storage/libraryMerge.ts` (función pura con test).
- TDD: sí
- Criterios de aceptación (tests):
  - [ ] Con hogar Cloudflare, un extra aparece en `tracks` tras `load()` (también si la recarga viene de la red) y no se guarda en la caché del hogar.
  - [ ] Like y borrar un extra van a `localExtras`, nunca a `api`.
  - [ ] `addToPlaylist` con un extra no lo manda al hogar y avisa.
  - [ ] `setKindMany` y `setAlbumMany` cambian todo y revierten todo si falla.
- Verificación: `npx vitest run test/libraryBulk.test.ts test/libraryLocalExtras.test.ts --root apps/web` y `npm run check`

### T4 · Descargas: quitar las atascadas, carriles, solo en el móvil si pasa de 95 MB · Grupo B · Estado: HECHA

- Depende de: T1 (`localExtras`, claves)
- Archivos (exclusivos): `apps/web/src/stores/downloads.ts`, `apps/web/src/downloads/save.ts`, `apps/web/src/downloads/pipeline.ts`, `apps/web/src/downloads/retry.ts`, `apps/web/src/downloads/types.ts`, `apps/web/src/downloads/errors.ts`, `apps/web/src/downloads/jobsStore.ts`, `apps/web/src/downloads/cancel.ts` (nuevo si hace falta), `apps/web/src/storage/drive/api.ts`, `apps/web/src/storage/drive/home.ts`, `apps/web/src/components/downloads/DownloadQueue.tsx`, `apps/web/test/downloadsStore.test.ts`, `apps/web/test/downloadSave.test.ts`, `apps/web/test/downloadPipeline.test.ts`, `apps/web/test/downloadRetry.test.ts`, `apps/web/test/downloadErrors.test.ts`
- Leer como contexto: `apps/web/src/api/client.ts` (`uploadTrack`), `apps/api/src/routes/ingest.ts:51-82`, `apps/web/src/storage/localExtras.ts`, `apps/web/src/storage/deviceFiles.ts`
- Qué hacer:
  1. **Cancelar en `saving`:**
     - un `Map<jobId, AbortController>`; `saveJob` pone `savingSince` y pasa el `signal`;
     - `cancelOne` aborta, marca `canceled`, hace `Downloader.ack`, avisa con `dl.toast.canceledSaving` y llama a `reportSend`;
     - si el guardado acaba después de cancelar, el estado sigue `canceled` y se borra la canción creada (de la nube o de los extras);
     - comprobar `signal.aborted` antes de `classifyFailure`.
  2. **Destino:** antes de leer el archivo, `job.target = saveTarget(home, file.bytes)`. Con `device-only`, `saveDeviceOnly`:
     - escribe en OPFS el audio y la portada (con `saveDeviceFile`; si falla, se borran los dos);
     - crea la `LocalTrack` con `locations: { device: true }`, `kind: 'music'` y `album` = canal;
     - `putLocalExtra` y `useLibrary.getState().upsertTracks([track])`;
     - sin `adopt` en la caché sin conexión: ya está en el móvil;
     - estado `done` con `dl.st.savedLocal` en la cola y un aviso `dl.toast.savedLocal`.
  3. **Fallo de un audio grande en Cloudflare:** si es > 30 MB y fallan 2 intentos por servidor o tiempo (no por falta de red), se pasa a `target = 'device-only'` y se guarda en el móvil.
  4. **Carriles:**
     - `nextToSave` con `home`: nube hasta `saveConcurrency` y como mucho 1 grande; móvil, 1 aparte;
     - el bloqueo por falta de red (`saveBlocked`) solo afecta al carril de la nube.
  5. **Vigilante:** en cada `pump` y cada 60 s, `stuckSaving()` aborta y pasa a `error` (`dl.err.saveTooSlow`).
  6. **Tiempo límite y reintentos:** `uploadTimeoutMs` en Cloudflare (`AbortSignal.any` con el `signal`) y en Drive (`opts.timeoutMs`); `planRetry` con `bytes`.
  7. **Atascados al actualizar:**
     - `init` y `reconcile` aplican `saveTarget` a los trabajos persistidos en `saving` o `downloaded` antes de guardarlos. Los de más de 95 MB con Cloudflare van al carril del móvil y ya no ocupan la nube.
     - Si falta el archivo del móvil, `error` con texto claro.
     - La X funciona en cualquier estado.
  8. **Cola:**
     - X en todo estado activo; en `error` y `canceled`, Reintentar y «Quitar de la lista» (borra el trabajo y su archivo);
     - textos `dl.st.savingBig`, `dl.st.savingLocal` y `dl.st.canceling`;
     - `errors.ts`: un fallo de cuota o espacio al guardar en el móvil da `dl.err.localFailed` (o `dl.err.phoneFull` si ya se reconoce).
  9. **Serie:** en `prepare`, si `meta.album` está vacío, `file.info.channel || file.info.uploader || job.author`.
  10. `downloads.ts` por debajo de ~500 líneas y funciones de menos de 50: sacar cancelar y el vigilante a `downloads/cancel.ts`.
- TDD: sí
- Criterios de aceptación (tests):
  - [ ] Cancelar en `saving` → `canceled`, `ack` y `signal` abortado; el aborto no programa reintento.
  - [ ] Guardado que acaba después de cancelar → sigue `canceled` y se borra la canción.
  - [ ] Cloudflare con 96 MB → `saveDeviceOnly`; nunca llama a `api.uploadTrack`; queda `done` con `locations.device` y se llama a `putLocalExtra`.
  - [ ] Dos podcasts grandes + una canción pequeña → la pequeña se guarda sin esperar.
  - [ ] Un trabajo persistido en `saving` con 100 MB → tras `init` se guarda en el móvil.
  - [ ] Audio de 40 MB con dos 5xx seguidos → acaba en el móvil; con `navigator.onLine` falso → espera a la red.
  - [ ] `uploadTimeoutMs(90 MB)` ≤ 30 min; `stuckSaving` detecta un `saving` vencido; sin `album` se guarda el canal.
- Verificación: `npx vitest run test/downloadsStore.test.ts test/downloadSave.test.ts test/downloadPipeline.test.ts test/downloadRetry.test.ts test/downloadErrors.test.ts --root apps/web`, `npm run check`. Manual en APK con Cloudflare:
  - un podcast de más de 2 h se guarda en el móvil con su aviso, suena sin conexión y las demás descargas siguen;
  - instalar encima de la v0.9.2 con los podcasts atascados → se resuelven solos o se quitan con la X.

### T5 · Portadas en menús sociales y en «Enviar» · Grupo B · Estado: HECHA

- Depende de: T1 (`SongThumb`)
- Archivos (exclusivos): `apps/web/src/components/groups/GroupShares.tsx`, `apps/web/src/views/SharedListView.tsx`, `apps/web/src/components/send/ParcelSheet.tsx`, `apps/web/src/components/send/Outbox.tsx`, `apps/web/src/stores/parcel.ts`, `apps/web/src/i18n/parcel.ts`, `apps/web/src/socialCovers.css` (nuevo), `apps/web/test/parcelStore.test.ts`
- Leer como contexto: `apps/web/src/components/PlaylistArt.tsx`, `apps/web/src/components/SongThumb.tsx`
- Qué hacer:
  1. `GroupShares` → `PlaylistPicker`: `PlaylistArt` (44 px), nombre y nº de canciones.
  2. `SharedListView` y `Outbox`: `SongThumb` en cada canción.
  3. `parcel.ts`: `current.songs` y `current.name` (solo en el cliente), rellenos en `start`, `sendTracks`, `sendPlaylist` y `create`.
  4. `ParcelSheet`, debajo del QR, sección «Lo que envías»:
     - nombre de la playlist si la hay y el número de canciones;
     - empieza plegada con 4 filas (`SongThumb` de 40 px, título y artista) y «Ver todas» despliega hasta 30, más «y {count} más».
     - Claves nuevas: `parcel.contents` «Lo que envías», `parcel.more` «y {count} más», `parcel.showAll` «Ver todas», `parcel.showLess` «Ver menos».
- TDD: sí (`current.songs` y `current.name`); el resto, manual
- Criterios de aceptación:
  - [ ] Test: `sendPlaylist` deja `name` y `songs` en `current`.
  - [ ] Las 5 pantallas muestran portadas; una miniatura rota muestra el icono.
- Verificación: `npx vitest run test/parcelStore.test.ts --root apps/web` y `npm run check`

## Fase 1B (v0.9.3, después de 1A)

### T6 · Podcasts agrupados por serie y ordenados · Grupo C · Estado: HECHA

- Depende de: T1, T3
- Archivos (exclusivos): `apps/web/src/podcasts/shows.ts` (nuevo), `apps/web/test/podcastShows.test.ts` (nuevo), `apps/web/src/views/PodcastsView.tsx`, `apps/web/src/components/podcasts/ShowPickSheet.tsx` (nuevo), `apps/web/src/podcasts.css` (nuevo), `apps/web/src/App.tsx`
- Leer como contexto: `apps/web/src/lib/format.ts` (`normalizeText`), `apps/web/src/components/Sheet.tsx`, `apps/web/src/components/AddToPlaylistSheet.tsx`, `apps/web/src/storage/localExtras.ts`
- Qué hacer:
  1. `shows.ts`:
     - la clave de la serie es `normalizeText(name)` y el nombre mostrado, la grafía más frecuente;
     - series A-Z (`localeCompare`, numérico);
     - episodios por `episodeNumber` de menor a mayor, y después los que no tienen número, por `createdAt` del más antiguo al más nuevo;
     - `episodeNumber` reconoce `ep`, `ep.`, `episodio`, `episode`, `capítulo`, `cap.`, `chapter`, `part`, `parte`, `atala`, `#` y `E` + número, e ignora años (1900-2099).
  2. `PodcastsView`:
     - usa `groupShows`; la reproducción sigue el orden mostrado (`fixedOrder`);
     - en cada cabecera, un ⋮ (`podcasts.showMenu`) llama a `openShowPicker(ids de la serie)`;
     - fila de episodio en su propio componente, con `OnlyHereBadge` si `isOnlyOnDevice`.
  3. `ShowPickSheet`, montado en `App.tsx` junto a `TrackMenu`: «Tus series» y un nombre nuevo. Guardar → `setAlbumMany`; sin nombre, no deja guardar.
  4. `podcasts.css`: cabecera con portada de 56 px, nombre en 2 líneas como mucho y contador.
- TDD: sí
- Criterios de aceptación:
  - [ ] «Episodio 3» va antes que «Episodio 12»; «Mi Serie» y «mi serie» se juntan; sin `album`, por `artist`; sin ninguno, «Artista desconocido».
  - [ ] Renombrar una serie con el nombre de otra las junta; un episodio solo en el móvil muestra el aviso.
- Verificación: `npx vitest run test/podcastShows.test.ts --root apps/web` y `npm run check`

### T7 · Jam: buscador único con portadas y envío desde la biblioteca · Grupo C · Estado: HECHA

- Depende de: T1
- Archivos (exclusivos): `apps/web/src/hub/jamFromLibrary.ts` (nuevo), `apps/web/test/jamFromLibrary.test.ts` (nuevo), `apps/web/src/components/jam/JamAddSheet.tsx`, `apps/web/src/components/jam/JamQueue.tsx`, `apps/web/src/i18n/jam.ts`, `apps/web/src/jamPick.css` (nuevo)
- Leer como contexto: `apps/web/src/stores/jam.ts`, `packages/shared/src/hub.ts`, `apps/web/test/jamStore.test.ts`
- Qué hacer:
  1. `jamFromLibrary.ts` según «Contratos».
     - `addTracksToJam`: sin Jam abierta, aviso `jamSend.offline`. Si no, plan con `jamRoom()`, `useJam.getState().add` por canción y un aviso de cada tipo (`max` = `HUB_LIMITS.jamMaxPendingPerMember`).
     - `jamSongPlaying()`: `snapshot.nowPlaying` y la canción de `usePlayer.currentId` tienen el mismo `videoId`, y eres el anfitrión.
  2. `JamAddSheet` sin pestañas:
     - una búsqueda (`jam.add.placeholder` «Busca en tu biblioteca o en YouTube») filtra «En tu biblioteca» (`filterLibrarySongs`, con `Cover`; sin texto, las 200 más recientes);
     - con 2 letras o más, «En YouTube» por el hub, con `SongThumb`;
     - sin biblioteca, solo YouTube.
     - Claves en `i18n/jam.ts`: `jam.add.placeholder`, `jam.add.fromLibrary` «En tu biblioteca», `jam.add.fromYoutube` «En YouTube», `jam.add.typeMore` «Escribe al menos 2 letras para buscar también en YouTube.». Quitar `jam.tab.*` si dejan de usarse.
  3. `JamQueue`: `SongThumb` en las filas y en «Ahora suena».
- TDD: sí
- Criterios de aceptación:
  - [ ] `planJamSend` con 12 de YouTube y `room` 10 → 10 y `overLimit` 2; las que no son de YouTube cuentan en `notYoutube`.
  - [ ] `filterLibrarySongs` sin distinguir acentos ni mayúsculas, solo canciones de YouTube, como mucho `max`.
  - [ ] Sin pestañas y con portadas.
- Verificación: `npx vitest run test/jamFromLibrary.test.ts --root apps/web` y `npm run check`

### T8 · Gestos y menús · Grupo D · Estado: HECHA

- Depende de: T1, T2, T3, T6, T7
- Archivos (exclusivos): `apps/web/src/components/player/MiniPlayer.tsx`, `apps/web/src/components/TrackList.tsx`, `apps/web/src/components/SelectionBar.tsx`, `apps/web/src/components/TrackMenu.tsx`, `apps/web/src/lib/swipe.ts` (nuevo), `apps/web/test/swipe.test.ts` (nuevo), `apps/web/src/gestures.css` (nuevo)
- Leer como contexto: `apps/web/src/hub/jamFromLibrary.ts`, `apps/web/src/stores/jam.ts`, `apps/web/src/stores/player.ts`, `apps/web/src/storage/localExtras.ts`
- Qué hacer:
  1. `swipeDecision({ dx, dy, ms, width, startX }): 'left' | 'right' | null`:
     - horizontal si `|dx| > 1.6·|dy|`;
     - se dispara con `|dx| ≥ min(96, width·0.25)`, o con `|dx| ≥ 40` y más de 0,5 px/ms;
     - `null` si el dedo empieza a menos de 24 px del borde.
  2. `MiniPlayer`:
     - sigue al dedo (máx. ±120 px) con la pista «Siguiente» o «Anterior»;
     - **izquierda → `next()`**; **derecha → `previous({ skipRestart: true })`**;
     - vibra 15 ms; un toque abre el reproductor; el corazón y el Play no empiezan gesto;
     - solo con dedo; `aria-label` con `player.swipeLabel`;
     - si `jamSongPlaying()`: izquierda → `useJam.getState().skip()` y derecha no hace nada.
  3. `TrackList`:
     - deslizar a la derecha sigue igual, pero con `jamIsActive()` llama a `addTracksToJam([id])` y la pista dice `swipe.jam`;
     - con `isOnlyOnDevice`, `OnlyHereBadge` en lugar del icono de descargada.
  4. `SelectionBar`:
     - «Enviar a la Jam» (solo con `jamIsActive()`) y «Mover a podcasts» (`setKindMany`); los dos cierran la selección;
     - «Descargar» ya excluye lo que está en el móvil (`SelectionBar.tsx:28`).
  5. `TrackMenu`:
     - «Enviar a la Jam» con `jamIsActive()` y si no es podcast;
     - en podcasts, «Cambiar de serie» → `openShowPicker([id])`;
     - con `isOnlyOnDevice`, la línea «En este dispositivo» pasa a ser `local.badge` y al tocarla muestra `local.explain`.
- TDD: sí (`swipeDecision`); el resto, manual
- Criterios de aceptación:
  - [ ] Tests de `swipeDecision`: vertical, corto y lento, corto y rápido, desde el borde.
  - [ ] Móvil: izquierda = siguiente, derecha = anterior, tocar abre; con Jam, deslizar en la biblioteca añade a la Jam; «Mover a podcasts» en bloque; el ⋮ de un audio solo en el móvil lo explica.
- Verificación: `npx vitest run test/swipe.test.ts --root apps/web`, `npm run check` y prueba en el móvil (o `--mode fakenative`)

### T9 · Ayuda, documentación y notas de versión · Grupo E · Estado: HECHA

- Depende de: T1-T8
- Archivos (exclusivos): `apps/web/src/help/articles/listen.ts`, `apps/web/src/help/articles/friends.ts`, `apps/web/src/help/articles/music.ts`, `apps/web/src/help/articles/cloudflare.ts`, `docs/ESTADO.md`, `docs/v2/architecture.md`, `docs/releases/v0.9.3.md` (nuevo)
- Leer como contexto: `apps/web/test/help.test.ts`, `docs/releases/v0.9.2.md`, este plan
- Qué hacer (eu/es/en, lenguaje sencillo):
  1. `listen.ts`:
     - «queue»: aleatorio de orden fijo y «Barajar de nuevo» en Ajustes; gesto del mini reproductor;
     - «podcasts»: series, «Cambiar de serie» y «Renombrar serie», «Mover a podcasts».
  2. `friends.ts` («jam»): añadir desde la biblioteca, la selección y deslizando; el límite de 10; solo canciones de YouTube.
  3. `music.ts` («download-youtube»): cancelar mientras guarda, «Quitar de la lista» y por qué tardan los audios largos.
  4. `cloudflare.ts` («cloudflare-full» o una sección nueva):
     - el tope de 95 MB (≈ 1 h 40 min);
     - qué significa «Solo en este móvil»: se escucha aquí, también sin conexión, pero no en la web ni en otros aparatos, y se pierde si borras la app;
     - no entra en playlists de la nube ni en «Copiar».
  5. `ESTADO.md` (semilla, `album` = serie, carriles, `local-extras`), tabla de fases y `v0.9.3.md`. El hub no cambia.
- TDD: no
- Criterios de aceptación:
  - [ ] `help.test.ts` pasa; ESTADO.md al día.
- Verificación: `npm run check` y después `npm run test:e2e` (cerrar wrangler/workerd colgados)

## Fase 2 (v0.9.4) · Jam como mando a distancia + Grupos (borrador; se detalla al empezar)

### Jam como mando a distancia

- **Comportamiento:**
  - Todos los de la Jam pueden saltar canción; el sonido sale solo del móvil del creador; los invitados no pausan.
  - Un invitado ve la **barra de la Jam** (portada, título, «Suena en el móvil de {host}», Saltar; deslizar a la izquierda también salta) cuando su reproductor no suena. Si está escuchando su música, ve su reproductor.
  - **Sin aviso** cuando alguien salta (N6B).
- **Protocolo:**
  - `{ type: 'skip', itemId }` en `apps/hub/src/jam/protocol.ts`.
  - En `state.ts`, si `nowPlaying?.id !== itemId` se ignora sin error ni difusión. Así, si dos pulsan a la vez, solo se salta una.
  - Si coincide: `nowPlaying = null` y `lastSkipItemId = itemId`, y se difunde.
  - Límite: 1 salto cada 2 s por miembro.
  - El anfitrión, al recibir un `state` con `lastSkipItemId` igual a la canción que suena, ejecuta su `skip()` actual (`apps/web/src/stores/jam.ts:301-314`).
- **Compatibilidad:**
  - `hello` gana `features?: ['remoteSkip']` opcional (`z.object` ignora lo que sobra). La instantánea gana `canSkip`.
  - Anfitrión con v0.9.2 → Saltar desactivado con «Quien creó la Jam tiene que actualizar la app para que podáis saltar canciones».
  - Invitados con v0.9.2: sin cambios (`hub/jamSocket.ts:105` no valida).
  - Hub viejo → `canSkip` llega `undefined`, se trata como `false` y no se envía nada.
  - Código de error nuevo `host_outdated`.
- **Despliegue:** sin migración D1 (es estado del Durable Object). `npm run deploy:hub` antes de `npm run deploy` y del tag. Tests puros en `apps/hub/test`.

### Grupos

- Primero **2 bocetos** (`docs/plan/bocetos/grupos-a.html` y `grupos-b.html`, con capturas a 390 px).
- **Migración `0005_group_photos.sql`:** `ALTER TABLE groups ADD COLUMN photo_at INTEGER;` y `CREATE TABLE group_photos (group_id TEXT PRIMARY KEY, data BLOB NOT NULL, updated_at INTEGER NOT NULL);`.
- **API:**
  - `PUT /hub/v1/groups/:id/name` `{ name }` → `GroupDetail`;
  - `PUT`, `GET` y `DELETE` de `/hub/v1/groups/:id/photo`, con JPEG ≤ 100 KB, firma comprobada y solo para miembros;
  - sin PATCH porque CORS no lo permite (`apps/hub/src/index.ts:24`);
  - límite `group_edit`: 20 por hora y grupo.
- **Permisos:** cualquier miembro; no se guarda ni se muestra quién lo cambió (N5B).
- **Foto:** `squareJpeg(blob, 256)` (`apps/web/src/lib/cover.ts:5`). `photoAt` en `GroupSummary` y `GroupDetail`; `deleteGroup` y la limpieza de grupos inactivos borran la foto.
- **Despliegue:** `hub:migrate:remote` → `deploy:hub` → `deploy`. Actualizar `docs/PRIVACY.md` y la ayuda (dónde se guarda la foto, cuánto dura y «no subas fotos de otras personas sin su permiso»).

## Fase 3 (v0.9.5) · YouTube más cómodo

- **«Compartir → Aske Stream»:** `intent-filter` `ACTION_SEND` `text/plain` (`AndroidManifest.xml:21-24`) más Java, y `useDownloads.enqueueUrl` (`stores/downloads.ts:369`). VERIFICAR si `@capacitor/app` entrega `ACTION_SEND`; si no, plugin propio en `AskeNative`.
- **«Cargar más»** con la continuación de InnerTube (API no oficial; puede romperse).
- **Términos de uso:** el riesgo es el mismo que ya tiene la descarga actual.

## Riesgos / dudas abiertas

- **Sin dudas abiertas para v0.9.3:** todas las decisiones son definitivas.
- **VERIFICAR en el APK:** leer y escribir en OPFS un audio de 120-200 MB (se lee entero en memoria, `save.ts:32-36`). Si el WebView se queda sin memoria, pasar a una copia nativa (archivo a archivo) en una fase posterior. El vigilante y la X evitan que vuelva a quedarse atascado.
- **VERIFICAR:** la memoria del Worker con audios de 80-95 MB. Si fallan, el respaldo de T4 (2 fallos → al móvil) ya lo cubre.
- `downloads.ts` (449 líneas) y `library.ts`: sacar lógica a módulos aparte para respetar los límites de tamaño.
- El gesto del mini reproductor no debe chocar con el gesto «atrás» de Android (se empieza a más de 24 px del borde).
- Un audio «solo en este móvil» se pierde si se desinstala la app; se explica en la ayuda y en el ⋮.

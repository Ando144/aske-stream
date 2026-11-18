# PLAN: Aviso de Google sin verificar + Fase 5.2 (copia entre almacenamientos)

Fecha: 2026-11-18 · Estado: COMPLETADO

## Objetivo

1. Que el aviso de Google («Aske Stream no ha completado el proceso de verificación» o «Google no ha
   verificado esta aplicación») se pueda saltar con claridad. Andoni pasa la app a producción sin
   pedir la verificación oficial, y la app explica el paso «Avanzado → Ir a Aske Stream (no seguro) →
   Continuar» en la pantalla de Drive, en un artículo de ayuda (eu/es/en) y en `docs/google-drive.md`.
2. Fase 5.2: copiar la música (canciones con portada y «me gusta», playlists y radios favoritas)
   entre dispositivo, Drive y Cloudflare, en las 6 direcciones. Al cambiar de almacenamiento la app
   pregunta; nunca borra el origen; salta lo que ya existe; barra «45 de 168»; cancelar y reanudar.

## Decisiones de arquitectura

- `stores/copyToDrive.ts` y `components/CopyToDrivePanel.tsx` se sustituyen por un motor general. Ya
  cubren dispositivo → Drive (mapa de ids en `kv`, reanudación, playlists por nombre). Su lógica se
  generaliza y después se borran. Así no quedan dos caminos que mantener.
- La lógica pura va en `storage/copy/plan.ts` (duplicados, formatos, playlists, espacio) y el bucle en
  `storage/copy/run.ts`, con los almacenamientos inyectados. Los dos se prueban sin navegador.
- Cada almacenamiento se ve a través de un adaptador `CopyEndpoint` (`storage/copy/endpoints.ts`).
  Hace falta porque el origen ya no es el almacenamiento activo: hay que leer Drive con la casa en
  «dispositivo», o Cloudflare con la casa en Drive.
- `api/client.ts` gana `apiFor(conn)`: un cliente con su propia URL y token, que usa la conexión
  guardada `savedCloudflare`. No se toca el `target` global, que lo usa el reproductor a la vez.
- Duplicados: primero el mapa guardado (origen → destino), luego `source + sourceRef` y, si no hay,
  título + artista normalizados con una duración que difiera como mucho 2 s. Si un duplicado se
  descubre tarde (409 de Cloudflare), cuenta como «ya estaba».
- Cloudflare solo acepta Opus (Ogg/WebM): los MP3, M4A, FLAC… se saltan y se cuentan como «no
  compatibles». La copia sigue con las demás y al final dice cuántas no se copiaron porque Cloudflare
  solo admite Opus. No se toca la API ni se recodifica nada (decidido por Andoni).
- Las radios favoritas se copian siempre junto con la música (decidido por Andoni).
- Botones de Google en euskera: los textos `eu` los citan solo en euskera, sin el castellano entre
  paréntesis. Nombres que se usan (los más probables, sin comprobar): «Aurreratuak», «Joan Aske
  Stream-era (ez da segurua)» y «Jarraitu». En `docs/google-drive.md` queda una nota para que Andoni
  los compruebe con un móvil en euskera.
- Playlists: si en el destino hay una con el mismo nombre (sin distinguir mayúsculas y quitando
  espacios), se le añaden las canciones que faltan; si no, se crea. Nunca se pasa de 1000: lo que no
  cabe se cuenta y se dice.
- Si el destino se llena (`storage_full` 507 o `drive_full`), se para y se dice. Antes de empezar se
  avisa si no cabe todo (espacio libre comparado con el tamaño pendiente).
- La pregunta se lanza solo: `stores/copy.ts` se suscribe a `useSetup`. Cuando `config.home` cambia
  de A a B (y A existía), ofrece copiar de A a B. Así `setup.ts` no se toca y no hay importaciones
  circulares.
- Estado persistente en `kv`, para reanudar tras cerrar la app: `copy-job` y
  `copy-map:<from>><to>`. El mapa antiguo `copy-to-drive-map` se migra a `copy-map:device>drive`.
- Textos con lugares: en euskera las declinaciones (Drive-ra / Drive-tik) no funcionan con un hueco
  `{to}`. Por eso los mensajes usan dos líneas fijas, «De: {from}» y «A: {to}», con nombres sin
  declinar (`copy.place.*`).
- `help/articles.ts` ya pasa de 800 líneas (~1250). Se parte en un archivo por sección antes de añadir
  artículos. `help/articles.ts` sigue exportando `SECTIONS` y `ARTICLES`, así que el test no cambia.
- Ningún archivo lleva el correo personal de Andoni: la documentación dice «tu correo de soporte».

## Contratos (interfaces compartidas)

### `apps/web/src/api/client.ts` (T3)

```ts
export interface ApiTarget {
  baseUrl: string;
  token: string | null;
}
export type ApiClient = typeof api; // the same methods as today, plus:
//   ingestExists(source: 'youtube' | 'file', ref: string): Promise<{ exists: boolean; id: string | null }>
//   fetchMedia(kind: 'audio' | 'cover', remoteId: string): Promise<Blob>   // GET /media/<kind>/<id>
export const api: ApiClient; // uses the global target, as today
export function apiFor(conn: ApiTarget): ApiClient; // own baseUrl/token; does NOT fire onUnauthorized
```

### `apps/web/src/storage/copy/plan.ts` (T2, pura, sin imports del navegador)

```ts
import type { Playlist, Station } from '@aske/shared';
import type { Destination, LocalTrack } from '../types';

export type IdMap = Record<string, string>; // source track id -> destination track id
export function sameSong(a: LocalTrack, b: LocalTrack): boolean;
export function findInDestination(t: LocalTrack, dest: LocalTrack[], map: IdMap): string | null;
export function canStore(to: Destination, t: LocalTrack): 'ok' | 'format'; // cloudflare: only audio/ogg|audio/webm (ignore ";codecs")
export interface CopyPlan {
  todo: LocalTrack[]; // oldest first (createdAt asc)
  already: IdMap; // found in destination (includes valid map entries)
  unsupported: LocalTrack[]; // canStore !== 'ok'
  todoBytes: number;
}
export function buildCopyPlan(
  src: LocalTrack[],
  dest: LocalTrack[],
  map: IdMap,
  to: Destination,
): CopyPlan;
export type PlaylistAction =
  | { kind: 'create'; name: string; trackIds: string[] }
  | { kind: 'add'; playlistId: string; name: string; trackIds: string[] };
export function planPlaylists(
  src: Playlist[],
  dest: Playlist[],
  idMap: IdMap,
  max?: number, // default LIMITS.playlistMaxTracks
): { actions: PlaylistAction[]; overflow: { name: string; count: number }[] };
export function planStations(src: Station[], dest: Station[]): Station[]; // not in dest by rbUuid, else by streamUrl
export function spaceCheck(
  todoBytes: number,
  freeBytes: number | null,
): { fits: boolean; missingBytes: number };
```

### `apps/web/src/storage/copy/run.ts` y `endpoints.ts` (T5)

```ts
export interface CopyEndpoint {
  kind: Destination;
  load(): Promise<{ tracks: LocalTrack[]; playlists: Playlist[]; stations: Station[] }>;
  readAudio(t: LocalTrack): Promise<Blob>;
  readCover(t: LocalTrack): Promise<Blob | null>;
  /** Keeps likedAt (and createdAt where the storage allows it). */
  writeTrack(
    t: LocalTrack,
    audio: Blob,
    cover: Blob | null,
  ): Promise<{ track: LocalTrack; existed: boolean }>;
  createPlaylist(name: string, trackIds: string[]): Promise<unknown>;
  addToPlaylist(id: string, trackIds: string[]): Promise<unknown>;
  saveStation(s: Station): Promise<unknown>;
  /** null = unknown / unlimited. */
  freeBytes(): Promise<number | null>;
}
export type CopyStop = 'cancelled' | 'offline' | 'auth' | 'full' | null;
export interface CopyProgress {
  total: number; // all source songs (copied + already + unsupported + pending)
  done: number; // processed so far, shown as "done of total"
  copied: number;
  already: number;
  unsupported: number;
  failed: string[]; // song titles
  playlistOverflow: { name: string; count: number }[];
}
export interface RunDeps {
  from: CopyEndpoint;
  to: CopyEndpoint;
  getMap(): Promise<IdMap>;
  saveMap(m: IdMap): Promise<void>;
  shouldStop(): boolean;
  onProgress(p: CopyProgress): void;
  onTrackCopied?(t: LocalTrack): void;
}
export function classifyCopyError(err: unknown): 'offline' | 'auth' | 'full' | 'other';
export async function runCopy(
  deps: RunDeps,
): Promise<{ progress: CopyProgress; stopped: CopyStop }>;
// endpoints.ts
export function endpointFor(
  kind: Destination,
  cloudflare: { baseUrl: string; token: string | null } | null,
): CopyEndpoint;
```

`classifyCopyError`: `DriveAuthRequired` o `ApiError` 401 → `auth`; `ApiError` 507/`storage_full` o
`code === 'drive_full'` → `full`; `!navigator.onLine`, `ApiError` status 0 o `network_error` → `offline`;
el resto → `other` (se apunta en `failed` y se sigue).

### `apps/web/src/stores/copy.ts` (T6)

```ts
export interface CopyJob {
  from: Destination;
  to: Destination;
  status: 'offered' | 'running' | 'paused' | 'done' | 'dismissed';
  progress: CopyProgress;
  stopped: CopyStop;
  pendingCount: number;
  missingBytes: number;
}
interface CopyState {
  job: CopyJob | null;
  running: boolean;
  restore(): Promise<void>; // reads kv 'copy-job' (and legacy device->drive offer)
  offer(from: Destination, to: Destination): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  dismiss(): Promise<void>;
  availableSources(): Destination[]; // others than current home that this device can read
}
export const useCopy: UseBoundStore<StoreApi<CopyState>>;
```

### Claves i18n nuevas (es, en, eu; las `copyDrive.*` se borran)

T4: `setup.drive.unverified`, `setup.drive.unverifiedHelp`.
T6: `copy.title`, `copy.from`, `copy.to`, `copy.place.device`, `copy.place.drive`,
`copy.place.cloudflare`, `copy.offer` + `copy.offer.one`, `copy.explain`, `copy.start`, `copy.later`,
`copy.resume`, `copy.cancel`, `copy.progress` («{done} de {total}»), `copy.keepOpen`,
`copy.notEnoughSpace`, `copy.stopped.cancelled|offline|auth|full`, `copy.reconnectGoogle`,
`copy.done` («{copied} copiadas, {already} ya estaban»), `copy.unsupported` + `.one`,
`copy.failed` + `.one`, `copy.playlistFull`, `copy.close`, `copy.fromOther`, `copy.nothing`.

### Artículos de ayuda (ids)

`drive-warning` (T4, sección drive) y `storage-copy` (T7, sección start; sustituye a `drive-copy`).

## Tareas

### T1 · Partir el centro de ayuda en un archivo por sección · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/help/articles.ts`, `apps/web/src/help/articles/*.ts` (nuevos)
- Leer como contexto: `apps/web/test/help.test.ts`, `apps/web/src/help/search.ts`
- Qué hacer:
  - Mover los tipos (`SectionId`, `HelpSection`, `HelpArticle`, `Text`) a `help/articles/types.ts`.
  - Mover los artículos de cada sección a `help/articles/<seccion>.ts` (`start`, `music`, `listen`,
    `offline`, `drive`, `cloudflare`, `android`, `problems`, `privacy`). Cada archivo exporta un array
    `HelpArticle[]`.
  - `help/articles.ts` queda como índice: reexporta los tipos, define `SECTIONS` y
    `ARTICLES = [...start, ...music, ...]` en el mismo orden que hoy.
  - Copiar el texto sin cambiar ni una coma, y conservar el comentario de cabecera sobre el marcado.
- TDD: no (es un refactor; ya lo cubre `help.test.ts`)
- Criterios de aceptación:
  - [ ] Ningún archivo de `help/` pasa de 400 líneas y `ARTICLES` tiene los mismos ids en el mismo orden.
  - [ ] Ningún import de fuera de `help/` cambia.
- Verificación: `npx vitest run test/help.test.ts --root apps/web` y `npm run check`

### T2 · Planificador de copia (lógica pura) · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/storage/copy/plan.ts`, `apps/web/test/copyPlan.test.ts`
- Leer como contexto: `apps/web/src/storage/types.ts`, `packages/shared/src/index.ts` (`Track`,
  `Playlist`, `Station`, `LIMITS`), `apps/web/src/stores/copyToDrive.ts` (reglas actuales de playlists)
- Qué hacer: implementar exactamente el contrato `plan.ts`. Reglas:
  - `sameSong` es cierto si coinciden `source` y `sourceRef` (y no son null). Si alguna canción no
    tiene `sourceRef`, compara título y artista normalizados (minúsculas, sin acentos, espacios
    colapsados) con una duración que difiera como mucho 2000 ms.
  - `findInDestination`: una entrada del mapa solo vale si ese id sigue existiendo en `dest`.
  - `buildCopyPlan`: `todo` va del más antiguo al más nuevo. Las no compatibles no entran en `todo`
    ni en `todoBytes`: van solo a `unsupported` (nunca lanzan error). Una canción que ya está en el
    destino cuenta como `already` aunque su formato no sea compatible.
  - `planPlaylists`: la búsqueda por nombre no distingue mayúsculas e ignora espacios. Ids
    traducidos con `idMap`, sin repetidos. Al añadir, solo las que faltan y como mucho
    `max - existentes`; al crear, como mucho `max`. El resto va a `overflow`. No se crea una playlist
    si ninguna de sus canciones se copió, salvo que en el origen ya estuviera vacía (como hoy).
  - `spaceCheck`: si `freeBytes` es null, `fits` es true.
  - Funciones de menos de 50 líneas.
- TDD: sí
- Criterios de aceptación:
  - [ ] Tests de: duplicado por `sourceRef`, por metadatos (±2 s sí, 3 s no), mapa con id borrado en
        destino, orden de `todo`, MP3/M4A/FLAC a Cloudflare → `unsupported` y fuera de `todo` y de
        `todoBytes` (a Drive y a dispositivo → ok), `audio/webm;codecs=opus` → ok, playlist con
        el mismo nombre en distinto caso, tope de 1000 con `overflow`, radios por `rbUuid` y
        `streamUrl`, `spaceCheck` con null.
- Verificación: `npx vitest run test/copyPlan.test.ts --root apps/web`

### T3 · Cliente de Cloudflare con conexión propia · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/api/client.ts`, `apps/web/test/apiClient.test.ts` (nuevo)
- Leer como contexto: `apps/api/src/routes/ingest.ts` (`GET /api/ingest/exists`),
  `apps/api/src/routes/media.ts`
- Qué hacer:
  - Convertir `api` en `createApi(getTarget, { notifyUnauthorized })`, con
    `export const api = createApi(() => target, { notifyUnauthorized: true })` y
    `apiFor(conn) = createApi(() => normalized(conn), { notifyUnauthorized: false })`.
  - `request` recibe el target como parámetro.
  - Añadir `ingestExists` y `fetchMedia`. `fetchMedia` usa los mismos headers y credenciales que
    `request` y lanza `ApiError` si la respuesta no es ok.
  - `mediaUrl` y `mediaCredentials` siguen igual.
- TDD: sí (con `fetch` simulado con `vi.stubGlobal`)
- Criterios de aceptación:
  - [ ] `apiFor({baseUrl:'https://x', token:'T'}).library()` llama a `https://x/api/library` con
        `Authorization: Bearer T` aunque el target global sea otro.
  - [ ] Un 401 con `apiFor` no avisa a los listeners de `onUnauthorized`; con `api`, sí.
  - [ ] `fetchMedia('audio','id')` devuelve un Blob y un 404 lanza `ApiError`.
- Verificación: `npx vitest run test/apiClient.test.ts --root apps/web` y `npm run check`

### T4 · Guiar el aviso de Google (pantalla y ayuda) · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/SetupView.tsx`, `apps/web/src/help/articles/drive.ts`,
  `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`
- Leer como contexto: `apps/web/src/components/HelpSheet.tsx` (HelpButton), `apps/web/src/storage/drive/auth.ts` (`driveProblem`)
- Qué hacer:
  - En SetupView, en la opción Drive (si `available && !inUse`), añadir bajo `setup.drive.whatHappens`
    un aviso corto (`setup.drive.unverified`). Ejemplo en es: «Google puede avisarte de que la app no
    está verificada. Es normal en apps gratuitas como esta: pulsa «Configuración avanzada», luego «Ir
    a Aske Stream (no seguro)» y «Continuar».» En eu, los botones solo en euskera (sin castellano
    entre paréntesis): «Aurreratuak», «Joan Aske Stream-era (ez da segurua)» y «Jarraitu». En en:
    «Advanced», «Go to Aske Stream (unsafe)» y «Continue». Debajo, `<HelpButton id="drive-warning"
label={t('setup.drive.unverifiedHelp')} />`.
  - Cuando el error sea `canceled` o `blocked`, mostrar también ese HelpButton dentro del banner.
  - Nuevo artículo `drive-warning` (sección drive) en es/en/eu, con:
    - qué pantalla sale (citar los dos textos que pone Google);
    - por qué sale (verificar cuesta trámites y la app es gratuita y de código abierto);
    - por qué es seguro (solo el permiso `drive.file`, la app solo ve lo que ella crea) y cómo
      quitar el acceso;
    - los 3 pasos numerados con los nombres de los botones en el idioma del artículo (en eu, los
      mismos nombres en euskera que el aviso de la pantalla, sin castellano);
    - qué hacer si sale «Error 403: access_denied» o «la app está en pruebas»: no es culpa del
      usuario, avisa a quien te pasó la app.
  - En `drive-connect`, añadir el enlace `[[drive-warning|…]]` en los 3 idiomas.
  - Claves i18n nuevas en los 3 idiomas.
- TDD: no
- Criterios de aceptación:
  - [ ] El aviso y el botón de ayuda se ven en la opción Drive y en los errores `canceled`/`blocked`.
  - [ ] En `eu.ts` y en el artículo eu, los botones salen solo en euskera («Aurreratuak», «Joan Aske
        Stream-era (ez da segurua)», «Jarraitu»), sin ningún texto en castellano entre paréntesis.
  - [ ] Pasan los tests de paridad de i18n y de enlaces de ayuda.
  - [ ] SetupView sigue por debajo de 250 líneas.
- Verificación: `npm run check`; a mano: `npm run dev`, pantalla de almacenamiento → Google Drive → ver el aviso y abrir la ayuda.

### T5 · Adaptadores de almacenamiento y bucle de copia · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/storage/copy/endpoints.ts`, `apps/web/src/storage/copy/run.ts`,
  `apps/web/test/copyRun.test.ts`
- Leer como contexto: `apps/web/src/storage/copy/plan.ts`, `apps/web/src/api/client.ts`,
  `apps/web/src/stores/copyToDrive.ts`, `apps/web/src/storage/homes.ts`, `apps/web/src/storage/deviceFiles.ts`,
  `apps/web/src/storage/drive/home.ts`, `apps/web/src/storage/drive/api.ts`,
  `apps/web/src/stores/downloads.ts` (líneas 380-416: cómo se sube a Cloudflare)
- Qué hacer:
  - `run.ts`: implementar `runCopy` y `classifyCopyError` según el contrato:
    1. Cargar el origen y el destino, y llamar a `buildCopyPlan`.
    2. Guardar en el mapa lo que ya estaba y emitir el progreso inicial (`done = already + unsupported`).
       Las no compatibles (`unsupported`) nunca se leen ni se escriben, no paran la copia y no van a
       `failed`: solo se cuentan en `progress.unsupported`.
    3. Copiar `todo` de una en una:
       - antes de cada canción mira `shouldStop()` y, si toca, para con `cancelled`;
       - después de cada canción guarda el mapa;
       - un error `offline`, `auth` o `full` para el bucle con ese motivo; `other` lo apunta en
         `failed` y sigue;
       - si `writeTrack` responde `existed`, cuenta como `already`.
    4. Si no se paró, hacer las playlists (`planPlaylists`) y las radios favoritas (`planStations`,
       siempre; se copian las que no estén ya). Un fallo en una playlist o una radio no para la copia.
    - Funciones de menos de 50 líneas (separar `copyTracks`, `copyPlaylists`, `copyStations`).
  - `endpoints.ts` (sin tests unitarios: navegador):
    - device:
      - `load` usa `deviceHome.load()` y `listStations()`;
      - `readAudio` usa `getDeviceFile` y lanza un error si falta;
      - `writeTrack` crea el id con `newLocalId()`, guarda los archivos con `saveDeviceFile` y llama
        a `deviceHome.addTrack` con `locations:{device:true}`, manteniendo `likedAt` y `createdAt`;
      - `freeBytes` sale de `navigator.storage.estimate()`.
    - drive:
      - `load` usa `driveHome.load()` y `listStations()`;
      - el audio se lee con `driveAudio(locations.drive)` y la portada con
        `driveApi.download(locations.driveCover)`;
      - `writeTrack` llama a `driveHome.addTrack(meta, audio, cover, {likedAt, createdAt})`;
      - `freeBytes` es `limit - usage` de `driveQuota()` (null si `limit` es null).
    - cloudflare (con `apiFor(conn)`):
      - `load` usa `library()` con `fromRemote` y `stations()`;
      - audio y portada con `fetchMedia`;
      - `writeTrack` monta el formulario como en `downloads.ts`, con `source: t.source ?? 'file'`;
      - si la respuesta es 409, `ingestExists` da el id y se devuelve `existed: true`;
      - después de subir, si `likedAt`, llama a `updateTrack(id,{liked:true})`;
      - `freeBytes` es `uploadLimitBytes - usedBytes` de `storage()`.
    - `saveStation` en las tres pasa `liked: !!likedAt`.
    - `endpointFor('cloudflare', null)` lanza `Error('cloudflare_not_connected')`.
- TDD: sí (para `run.ts`, con dos `CopyEndpoint` falsos en memoria)
- Criterios de aceptación:
  - [ ] Test: copia 3 de 5 (2 ya estaban), con «X copiadas, Y ya estaban» correcto en el progreso.
  - [ ] Test: parar a mitad y volver a ejecutar con el mismo mapa no copia nada dos veces y termina.
  - [ ] Test: un error `full` en la canción 2 para con `stopped:'full'` y deja guardado el mapa de la 1.
  - [ ] Test: un error `other` apunta el título en `failed` y sigue.
  - [ ] Test: `existed:true` cuenta como ya estaba; las playlists se crean con los ids de destino.
  - [ ] Test: hacia Cloudflare con 2 MP3 y 3 Opus se copian las 3 Opus, `unsupported` = 2, no se
        llama a `readAudio`/`writeTrack` para los MP3 y `stopped` es null.
  - [ ] Test: las radios del origen que no están en el destino se guardan con `saveStation`; las que
        ya estaban (por `rbUuid` o `streamUrl`) no.
- Verificación: `npx vitest run test/copyRun.test.ts --root apps/web` y `npm run check`

### T6 · Pregunta, barra y reanudación en la app · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/copy.ts` (nuevo), `apps/web/src/components/CopyPanel.tsx`
  (nuevo), borrar `apps/web/src/stores/copyToDrive.ts` y `apps/web/src/components/CopyToDrivePanel.tsx`,
  `apps/web/src/views/LibraryView.tsx`, `apps/web/src/views/SettingsView.tsx`, `apps/web/src/i18n/es.ts`,
  `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`
- Leer como contexto: `apps/web/src/storage/copy/run.ts`, `apps/web/src/storage/copy/endpoints.ts`,
  `apps/web/src/stores/setup.ts`, `apps/web/src/storage/drive/auth.ts`, el `CopyToDrivePanel.tsx` actual (estilo y clases CSS)
- Qué hacer:
  - `stores/copy.ts`, según el contrato:
    - al cargar el módulo se suscribe a `useSetup`; cuando `config.home` pasa de A a B (A no null,
      A ≠ B), llama a `offer(A, B)`;
    - `offer` calcula cuántas canciones faltan y el espacio que falta, y guarda `status:'offered'`
      en kv `copy-job`. Si no falta ninguna, no ofrece nada. Si el origen no se puede leer (sin
      conexión o sin cuenta), no ofrece y lo registra con `console.warn` (no es depuración, es el
      registro del error);
    - `start` llama a `runCopy` con el mapa `copy-map:<from>><to>` (migrando `copy-to-drive-map` la
      primera vez), va guardando el progreso en kv, y al acabar recarga `useLibrary` y actualiza
      las canciones copiadas con `upsertTracks` si el destino es la casa activa;
    - `restore` se llama desde `CopyPanel` al montar: si había una copia `running`, la deja en
      `paused` para que el usuario pulse «Seguir»; si no hay ninguna, la casa es Drive y el
      dispositivo tiene canciones sin copiar, ofrece device → drive (para los usuarios de la v0.5);
    - `availableSources` devuelve: device si hay canciones locales; drive si hay cuenta de Google
      guardada (`DRIVE_EMAIL_KEY`); cloudflare si existe `savedCloudflare`. Nunca la casa actual.
  - `CopyPanel.tsx` (menos de 250 líneas), con estos estados:
    - ofrecido: título, líneas «De: X» y «A: Y», «¿Copiamos N canciones…?», `copy.explain` («no se
      borra nada de X»), el aviso de espacio si no cabe, y los botones [Copiar] [Ahora no];
    - copiando: «45 de 168», barra, `copy.keepOpen` y [Cancelar];
    - parado: el mensaje del motivo y [Seguir copiando]. Si el motivo es `auth` con Drive, primero
      [Volver a conectar con Google], que llama a `getDriveToken(true)`;
    - hecho: «X copiadas, Y ya estaban», más las líneas de no compatibles, fallidas y playlists
      llenas, y [Cerrar].
    - Cada estado lleva `HelpButton id="storage-copy"`.
    - Prop `compact` como hoy: en la Biblioteca solo se ve si hay algo ofrecido o en marcha.
  - LibraryView y SettingsView: cambiar `CopyToDrivePanel` por `CopyPanel`. En Settings, junto a
    «Cambiar» almacenamiento, poner el botón `copy.fromOther` («Copiar música de otro sitio»). Elige el
    origen entre `availableSources()` (con una sola opción, directo; si no hay, `copy.nothing`) y
    llama a `offer(origen, casaActual)`.
  - i18n: borrar las claves `copyDrive.*` y añadir las `copy.*` del contrato en es/en/eu. Los
    mensajes deben decir en lenguaje sencillo qué pasa y qué hacer, por ejemplo:
    - `full`: «Tu Cloudflare/Drive está lleno: libera espacio y pulsa Seguir copiando»;
    - `copy.unsupported` (en el estado «hecho», solo si `unsupported > 0`): «N canciones no se
      copiaron porque Cloudflare solo admite el formato Opus (el de YouTube). Siguen donde estaban.»
      Con su `.one`. No se ofrece recodificar ni ninguna otra acción.
  - En el estado «ofrecido», N (canciones a copiar) no incluye las no compatibles; si hay, se añade
    una línea corta con `copy.unsupported` para que no sea una sorpresa al final.
- TDD: no (es interfaz y una capa fina; la lógica ya tiene tests en T2 y T5)
- Criterios de aceptación:
  - [ ] Cambiar de almacenamiento con música en el anterior muestra la pregunta en la Biblioteca.
  - [ ] La barra avanza «n de total»; Cancelar para; Seguir continúa sin repetir; al recargar la
        página a mitad, aparece «Seguir copiando».
  - [ ] El mensaje final dice «X copiadas, Y ya estaban». No queda ninguna referencia a `copyToDrive`.
  - [ ] Copiando hacia Cloudflare con algún MP3, la copia termina y el mensaje final dice cuántas no se
        copiaron porque Cloudflare solo admite Opus.
  - [ ] Las radios favoritas aparecen en el destino tras la copia.
  - [ ] Pasa la paridad de i18n. Ningún archivo pasa de 800 líneas y `DownloadView.tsx` no se toca.
- Verificación: `npm run check`; a mano con `npm run dev`:
  - dispositivo con 3 canciones → cambiar a Cloudflare local → copiar → cancelar → seguir;
  - cambiar a dispositivo y comprobar que sale «ya estaban»;
  - con un MP3 en el dispositivo, copiar a Cloudflare y ver el aviso de «no se copiaron»;
  - marcar una radio como favorita antes de copiar y verla en el destino.

### T7 · Documentación, ayuda de la copia y estado · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/help/articles/start.ts`, `apps/web/src/help/articles/drive.ts`,
  `docs/google-drive.md`, `docs/ESTADO.md`, `docs/v2/architecture.md`
- Leer como contexto: `docs/plan/PLAN.md` (este archivo, sección Contratos)
- Qué hacer:
  - Ayuda: sustituir el artículo `drive-copy` por `storage-copy` en `start.ts`, en es/en/eu. Debe
    explicar:
    - cuándo pregunta la app;
    - las 6 direcciones;
    - que no se borra nada;
    - que lo que ya está se salta;
    - Cancelar y Seguir;
    - Wi-Fi y pantalla encendida;
    - el límite de 10 GB de Cloudflare y que solo admite Opus (el formato de YouTube): las MP3,
      M4A, FLAC… se saltan, siguen donde estaban y al final se dice cuántas;
    - que también se copian las radios favoritas;
    - las playlists de como mucho 1000;
    - «Copiar música de otro sitio» en Ajustes.
      Actualizar todos los enlaces `[[drive-copy|` (por ejemplo en `drive-connect`) a `storage-copy`.
  - `docs/google-drive.md`:
    - nueva sección «The "unverified app" warning», con qué ve el usuario, los 3 botones (en
      inglés, castellano y euskera) y por qué se acepta no verificar;
    - dentro de esa sección, una nota «To check» para Andoni: los nombres en euskera («Aurreratuak»,
      «Joan Aske Stream-era (ez da segurua)», «Jarraitu») no se han comprobado; hay que abrir la
      conexión con Google en un móvil en euskera y, si difieren, corregirlos en `i18n/eu.ts` y en
      `help/articles/drive.ts`;
    - reescribir el paso 3 de «Setting up Google» como lista de pasos manuales para Andoni: Audience
      External → Publish app (In production); Branding con el nombre `Aske Stream`, un correo de
      soporte y un correo del desarrollador (sin poner ninguno real), sin logo (subir logo obliga a
      verificar la marca), página de inicio y política de privacidad opcionales y dominio autorizado
      solo si se añaden; Data access solo con `drive.file`; NO pulsar «Prepare for verification»;
    - nota: los usuarios que conectaron en Testing pueden tener que volver a conectar una vez;
    - cambiar la fila «Moving music» para que apunte a `stores/copy.ts` + `storage/copy/`.
  - `docs/ESTADO.md`: mover 5.2 a Hecho, poner como «Ahora» probar en el móvil y dejar las decisiones
    de este plan (las 2-3 más importantes, una línea cada una).
  - `docs/v2/architecture.md`: en la tabla de fases, poner 5.2 a ✅ y añadir «Phase 5.2 notes» (de 3
    a 5 líneas).
- TDD: no
- Criterios de aceptación:
  - [ ] Pasa `help.test.ts` (enlaces válidos e iguales en los 3 idiomas) y no queda ningún `drive-copy`.
  - [ ] Ningún archivo contiene un correo real (busca `@gmail`, `@` en docs).
  - [ ] `docs/google-drive.md` tiene la nota «To check» de los botones en euskera.
  - [ ] El artículo `storage-copy` menciona en los 3 idiomas lo de Opus y las radios favoritas.
- Verificación: `npx vitest run test/help.test.ts --root apps/web`, `npm run check` y, al final,
  `npm run test:e2e`

## Riesgos

- Riesgo: los nombres de los botones de Google en euskera no están comprobados. Si Google los
  muestra distinto, Andoni los corrige tras probar con un móvil en euskera (nota en
  `docs/google-drive.md`).
- Riesgo: con un solo permiso no sensible (`drive.file`) y en producción, es posible que Google ya
  no muestre el aviso. La guía se queda igual, por si aparece.
- Riesgo: copiar desde Drive en el navegador necesita un token que dura una hora. Si caduca a mitad,
  la copia se para con `auth` y pide «Volver a conectar con Google». Está previsto en T6.
- Riesgo: la copia se hace en primer plano (no hay servicio Android). Si el móvil se bloquea, se para
  y se reanuda; el texto `copy.keepOpen` lo avisa.

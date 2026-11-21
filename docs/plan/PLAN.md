# PLAN: Pulido v0.8.2, buscador de descargas y «Enviar al móvil» vía Hub

Fecha: 2026-11-21 · Estado: COMPLETADO

## Objetivo

1. Cerrar el pulido MEDIO del revisor de v0.8.2 (`pruneImports`, `.catch` vacío de `runThrottle`,
   espacios en Java) y el bug del buscador de Descargas (al vaciar el texto deben irse los resultados).
2. Nueva función «Enviar al móvil» a través del Hub: quien envía (ordenador sin Cloudflare **o
   cualquier móvil**) elige canciones, se crea un código de un solo uso (6 símbolos + QR) que se
   muestra en su pantalla, y el móvil que recibe lo escanea o lo teclea; las canciones van directas
   a su cola de descargas (sin bandeja). El Hub solo guarda referencias (id de YouTube + título +
   artista) y las borra al recibirlas o a las 24 h. Solo canciones sueltas (no playlists de YouTube).
   - Ordenador → móvil: buscar en Descargas, añadir a una cesta, «Enviar al móvil».
   - Móvil → móvil: seleccionar canciones de la biblioteca (barra de selección) o enviar la cola de
     reproducción; el móvil emisor muestra el QR y el código en pantalla.
3. La velocidad de descargas NO se toca (decisión del usuario).

## Decisiones de arquitectura

- **«Paquete» (parcel) creado por quien envía** — el ordenador muestra el QR y el móvil lo escanea con
  el escáner nativo que ya existe (`native/qrScanner.ts`); el móvil no tiene que quedarse esperando
  ni consultar el Hub cada X minutos. (Alternativa en «Dudas».)
- **Un solo uso real:** reclamar = `DELETE … RETURNING` en D1 (atómico: dos móviles no pueden recibir
  el mismo paquete).
- **Código de 6 símbolos** del alfabeto de emparejamiento (`PAIRING_CODE_ALPHABET`, sin 0/O/1/I),
  formato `ABC-DEF`; contra fuerza bruta, tope por IP de reclamaciones (20 cada 10 min) y TTL de 24 h.
- **Clave de remitente** (`senderKey`, como el `deleteKey` de las playlists): solo quien creó el
  paquete puede consultar si sigue esperando o cancelarlo. Viaja en la cabecera `X-Delete-Key`
  (ya permitida por CORS del Hub). En D1 solo su hash SHA-256.
- **Sin datos personales:** la tabla `parcels` no guarda IP, nombre ni dispositivo. Los topes usan
  la tabla `rate_limits` existente (IP con hash y sal diaria).
- **Borrado:** al reclamar (inmediato); los caducados responden 410 y se borran en la limpieza, que
  pasa de diaria a **cada hora** (cron `17 * * * *`), así nada vive más de ~25 h.
- **Búsqueda en el Hub para el ordenador** (`GET /hub/v1/search`, solo `songs` y `videos`): sin
  Cloudflare el navegador no puede buscar en YouTube. Se extrae `searchYoutube` de `jam/routes.ts` a
  `lib/search.ts` y lo usan las dos rutas.
- **Cloudflare sigue como está:** quien tiene casa Cloudflare mantiene el envío por D1
  (`stores/send.ts` + `Outbox`), que ya tiene lista de estado. En Descargas del navegador el Hub se usa
  cuando la casa es `device` o `drive`; enviar desde la selección o la cola usa el Hub siempre.
- **Store nuevo `stores/parcel.ts`** en vez de ampliar `stores/send.ts`: `send.ts` está atado a la API
  de Cloudflare (`api.send*`) y a su lista persistente; mezclarlos complicaría ambos. Se reutilizan
  `components/QrCode.tsx`, `native/qrScanner.ts`, `hub/client.ts` (`hubFetch`) y `hub/errors.ts`.
- **Móvil → móvil sin cambios en el Hub:** el móvil emisor usa los mismos endpoints. Solo se pueden
  enviar canciones de la biblioteca que vienen de YouTube (`source === 'youtube'` y `sourceRef`);
  las demás se saltan con aviso (igual que al compartir playlists).
- **Hoja del código global:** `ParcelSheet` se monta en `App.tsx` cuando `useParcel.current` no es
  nulo, así se puede crear un paquete desde Descargas, la barra de selección o la cola.
- **Lo recibido va a la cola de descargas** con `useDownloads.getState().enqueue(...)`: acaba en la
  biblioteca del móvil sin pantalla intermedia. No se crea playlist.
- **`DownloadView.tsx` (673 líneas) no debe pasar de 800:** se saca `Outbox` a
  `components/send/Outbox.tsx` y la UI nueva va en `components/send/`.

## Contratos (interfaces compartidas)

### `packages/shared/src/hub.ts` (añadir)

```ts
// dentro de HUB_LIMITS
parcelMaxSongs: 200,
parcelTtlMs: 24 * 3600 * 1000,
parcelCodeLength: 6,
parcelBodyMaxBytes: 128 * 1024,

export interface CreatedParcel { code: string; senderKey: string; expiresAt: number; count: number }
export interface ParcelStatus { code: string; count: number; expiresAt: number }
export interface ClaimedParcel { songs: HubSong[] }

export type HubLink =
  | { kind: 'list'; id: string } | { kind: 'jam'; code: string } | { kind: 'send'; code: string };

/** Uppercases, strips spaces/dashes; null unless parcelCodeLength symbols of the alphabet. */
export function normalizeParcelCode(input: string): string | null;
/** `${base}/#send=CODE` */
export function hubSendLink(hubUrl: string, code: string): string;
/** Bare code ('abc-def', 'ABCDEF') or an https link (http only for local hosts) with #send=CODE. */
export function parseParcelInput(text: string): string | null;
// parseHubHash: además de list y jam, reconoce 'send' → { kind: 'send', code }
```

`formatJamCode` sirve también para mostrar el código del paquete (`ABC-DEF`).

### Hub: tabla (migración `apps/hub/migrations/0002_parcels.sql`)

```sql
CREATE TABLE parcels (
  code TEXT PRIMARY KEY,
  songs_json TEXT NOT NULL,
  sender_key_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX parcels_expires ON parcels (expires_at);
```

### Hub: endpoints (`/hub/v1/*`, errores `{ error: HubErrorCode, message }`)

| Método y ruta                                       | Entrada                                                              | Respuesta                                                                                | Tope por IP                                |
| --------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| `POST /parcels`                                     | `{ songs: HubSong[] }` (1..200, cuerpo ≤128 KB)                      | 201 `CreatedParcel`; 400 `invalid_request`; 413 `too_many_songs`                         | `parcel` 30/hora                           |
| `GET /parcels/:code`                                | cabecera `X-Delete-Key: senderKey`                                   | 200 `ParcelStatus`; 404 `not_found` (no existe, ya recibido o clave mala); 410 `expired` | —                                          |
| `POST /parcels/:code/claim`                         | —                                                                    | 200 `ClaimedParcel` y queda borrado; 404 `not_found`; 410 `expired`                      | `parcel-claim` 20/10 min (antes de buscar) |
| `DELETE /parcels/:code`                             | cabecera `X-Delete-Key`                                              | 204; 404 si no existe; 403 `invalid_request` si la clave no coincide                     | —                                          |
| `GET /search?q=&kind=songs\|videos&lang=es\|en\|eu` | zod: `q` 1..200, `kind` por defecto `songs`, `lang` por defecto `es` | 200 `{ results: SearchResult[] }`; 502 `search_unavailable`                              | `search` 60/10 min                         |

Reglas: canciones con `sanitizeHubSong`; si una no vale → 400; duplicados por `videoId` se quitan
(se queda la primera); `count` = canciones guardadas. Código con `randomCode(parcelCodeLength)` y
5 intentos `ON CONFLICT DO NOTHING` como `insertList`. Caducado (`expires_at < now`) → 410 y se borra.

### Web: `apps/web/src/hub/client.ts` (añadir)

```ts
createParcel(songs: HubSong[]): Promise<CreatedParcel>                 // POST /parcels
getParcelStatus(code: string, senderKey: string): Promise<ParcelStatus> // GET, X-Delete-Key
claimParcel(code: string): Promise<ClaimedParcel>                      // POST /parcels/:code/claim
cancelParcel(code: string, senderKey: string): Promise<void>           // DELETE, X-Delete-Key
searchViaHub(q: string, kind: 'songs' | 'videos', lang: Language): Promise<SearchResult[]>
```

### Web: `apps/web/src/stores/parcel.ts`

```ts
export type ParcelPhase = 'waiting' | 'received' | 'expired';
export interface ActiveParcel extends CreatedParcel {
  phase: ParcelPhase;
}
export type ReceiveOutcome = 'ok' | 'invalid' | 'error';

interface ParcelState {
  basket: HubSong[]; // ordenador: canciones elegidas (solo en memoria)
  current: ActiveParcel | null; // paquete creado y mostrado con su QR
  busy: boolean;
  pendingCode: string | null; // código llegado por enlace #send= (App.tsx)
  add(song: HubSong): boolean; // false si ya estaba o se llega a parcelMaxSongs (toast)
  remove(videoId: string): void;
  clear(): void;
  create(): Promise<boolean>; // cesta → Hub; ok: current={...,phase:'waiting'} y vacía la cesta
  /** Móvil (o web) desde biblioteca/cola: crea el paquete directamente, sin tocar la cesta.
   *  0 canciones de YouTube → toast parcel.noYoutube y false; >200 → toast parcel.full y false;
   *  si se saltan algunas → toast parcel.skipped {count}. */
  sendTracks(trackIds: readonly string[]): Promise<boolean>;
  poll(): Promise<void>; // GET estado; 404 antes de expiresAt → 'received'; 410 o pasado → 'expired'
  cancel(): Promise<void>; // DELETE y current=null; toast parcel.canceled
  dismiss(): void; // current=null (no borra en el Hub)
  setPendingCode(code: string | null): void;
  receive(input: string): Promise<ReceiveOutcome>; // móvil: parse → claim → enqueue
}
export const useParcel: UseBoundStore<StoreApi<ParcelState>>;

// helpers puros exportados (con test)
export function songFromResult(r: Pick<SearchResult, 'id' | 'title' | 'author'>): HubSong;
/** Canciones enviables (YouTube) sin duplicados por videoId, en orden; skipped = no enviables. */
export function songsFromTracks(tracks: readonly LocalTrack[]): {
  songs: HubSong[];
  skipped: number;
};
export function phaseWhenMissing(expiresAt: number, now: number): ParcelPhase; // now<expiresAt ? 'received' : 'expired'
export function parcelErrorText(err: unknown): string; // parcel.err.<code> si existe, si no hubErrorText(err)
```

`receive`: `parseParcelInput` null → `'invalid'` (sin llamar al Hub). Si no: `claimParcel`, luego
`useDownloads.getState().enqueue(songs.map(s => ({ videoId: s.videoId, title: s.title, author: s.artist })))`;
si devuelve 0 → toast `parcel.nothingNew`, si no toast `parcel.gotSongs` con `{count}`. Error → toast
`parcelErrorText(err)` tipo `'error'` y `'error'`.

### Textos (`apps/web/src/i18n/parcel.ts`: `parcelEn`, `parcelEs`, `parcelEu`)

Claves exactas (texto inglés orientativo; el programador de T3 lo pule y traduce a es/eu):

| Clave                         | Inglés                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `parcel.introTitle`           | Send songs to your phone                                                                                                         |
| `parcel.introText`            | Browsers cannot download from YouTube, but the phone app can. Pick songs here, then scan the code with your phone.               |
| `parcel.add`                  | Add to the list to send                                                                                                          |
| `parcel.added`                | Added to the list to send                                                                                                        |
| `parcel.already`              | That song is already in the list                                                                                                 |
| `parcel.full`                 | You can send up to {count} songs at once                                                                                         |
| `parcel.basketTitle`          | Songs to send                                                                                                                    |
| `parcel.basketCount` / `.one` | {count} songs ready to send / 1 song ready to send                                                                               |
| `parcel.remove`               | Remove from the list                                                                                                             |
| `parcel.clear`                | Empty the list                                                                                                                   |
| `parcel.create`               | Send to phone                                                                                                                    |
| `parcel.creating`             | Preparing the code…                                                                                                              |
| `parcel.codeTitle`            | Scan this with your phone                                                                                                        |
| `parcel.codeText`             | On the phone that will get the songs, open Aske Stream, go to Download and tap "Receive". Scan the QR or type the code.          |
| `parcel.sendSelected`         | Send to another phone                                                                                                            |
| `parcel.sendQueue`            | Send the queue to another phone                                                                                                  |
| `parcel.noYoutube`            | None of these songs come from YouTube, so there is nothing to send. Only songs downloaded from YouTube can be sent.              |
| `parcel.skipped` / `.one`     | {count} songs were left out because they do not come from YouTube / 1 song was left out because it does not come from YouTube    |
| `parcel.qrLabel`              | QR code to receive the songs                                                                                                     |
| `parcel.codeLabel`            | Code                                                                                                                             |
| `parcel.expires`              | It works only once and expires at {time}                                                                                         |
| `parcel.waiting`              | Waiting for the phone…                                                                                                           |
| `parcel.received`             | Done! The phone got the songs and is downloading them.                                                                           |
| `parcel.expired`              | This code has expired. Create a new one.                                                                                         |
| `parcel.cancel`               | Cancel sending                                                                                                                   |
| `parcel.canceled`             | Sending canceled                                                                                                                 |
| `parcel.privacy`              | Only the list of songs goes through the Aske Hub, never the music. It is deleted when your phone receives it, or after 24 hours. |
| `parcel.receive`              | Receive                                                                                                                          |
| `parcel.receiveTitle`         | Receive songs                                                                                                                    |
| `parcel.receiveText`          | Scan the QR shown on the other screen, or type its code.                                                                         |
| `parcel.scan`                 | Scan QR                                                                                                                          |
| `parcel.codePlaceholder`      | Code, e.g. ABC-DEF                                                                                                               |
| `parcel.receiveButton`        | Receive                                                                                                                          |
| `parcel.receiving`            | Receiving…                                                                                                                       |
| `parcel.gotSongs` / `.one`    | {count} songs added to your downloads / 1 song added to your downloads                                                           |
| `parcel.nothingNew`           | You already had all these songs                                                                                                  |
| `parcel.invalidCode`          | That code is not right. It has 6 letters and numbers, like ABC-DEF.                                                              |
| `parcel.openInApp`            | To receive these songs, open Aske Stream on your Android phone, go to Download → Receive and scan the code.                      |
| `parcel.playlistLink`         | From here you can only send songs. Search for them by name.                                                                      |
| `parcel.err.not_found`        | That code does not exist or has already been used. Ask for a new one.                                                            |
| `parcel.err.expired`          | That code has expired (codes last 24 hours). Ask for a new one.                                                                  |
| `parcel.err.too_many_songs`   | Too many songs at once. Remove some and try again.                                                                               |

Artículo de ayuda nuevo: id **`send-with-code`** (sección `music`).

## Tareas

### T1 · Pulido de imports y runThrottle · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/imports.ts`, `apps/web/test/downloadImports.test.ts`,
  `apps/web/src/offline/runThrottle.ts`, `apps/web/test/runThrottle.test.ts`
- Leer como contexto: `apps/web/src/downloads/batch.ts` (`importsToKeep`), uso de
  `createRunThrottle` en `apps/web/src/stores/player.ts` (línea ~114)
- Qué hacer:
  1. `imports.ts`: añadir un `Set` `flushingVideoIds`. En `runFlush`, pasar los ids de
     `pendingVideoIds` a `flushingVideoIds` (y vaciar `pendingVideoIds`); en `finally` quitarlos de
     `flushingVideoIds`. `pruneImports` debe **conservar** cualquier import que mantenga
     `importsToKeep` **o** que tenga algún `videoId` en `pendingVideoIds` o `flushingVideoIds`
     (evita borrar un import mientras su sincronización está pendiente o en marcha). Mantener la
     firma pública.
  2. `runThrottle.ts`: el `.catch` vacío no puede ocultar errores de `run()`. Separar fases: si
     `mayRun()` rechaza → `console.warn('Run throttle check failed', err)` y no se ejecuta; si
     `run()` lanza (o su promesa rechaza; permitir `run: () => void | Promise<void>` y esperarla) →
     `console.error('Throttled run failed', err)`. `checking` vuelve a `false` siempre; `lastRun` se
     fija antes de `run()` (no reintentar en bucle).
- TDD: sí
- Criterios de aceptación:
  - [ ] Test: con una canción en `scheduleImportSync` aún sin vaciar, `pruneImports` con todos los
        trabajos `done` NO borra su import; tras `flushImportSync()` sí.
  - [ ] Test: durante un `runFlush` en curso (syncImport bloqueado con una promesa), `pruneImports`
        no borra el import afectado.
  - [ ] Tests existentes de `pruneImports` siguen en verde.
  - [ ] Test: `run` que lanza → `console.error` llamado, y la siguiente llamada tras `minGapMs`
        vuelve a ejecutar. `mayRun` que rechaza → `console.warn`, `run` no se llama.
- Verificación: `npx vitest run test/downloadImports.test.ts test/runThrottle.test.ts --root apps/web`

### T2 · Buscador de Descargas que se vacía + espacios Java · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/DownloadView.tsx`,
  `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/DownloadQueue.java`,
  `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/DownloaderPlugin.java`
- Qué hacer:
  1. En `SearchPanel`: cuando el texto queda vacío (`e.target.value.trim() === ''`, cubre la X del
     `type="search"` y borrar a mano) → `setResults(null)`, `setError(null)`, `setOpenPlaylist(null)`.
     Evitar que una búsqueda que llega tarde vuelva a pintar resultados: contador de petición con
     `useRef` (`const searchSeq = useRef(0)`), se incrementa en cada `run` y al vaciar; al resolver
     solo se aplica si coincide. La cola de descargas (`children`) no se toca.
  2. Java: falta un espacio en `DownloadQueue.java:180` (`readFile()throws` → `readFile() throws`)
     y en `DownloaderPlugin.java:230` (`q =DownloadQueue` → `q = DownloadQueue`). Nada más.
- TDD: no
- Criterios de aceptación:
  - [ ] Buscar algo, pulsar la X: los resultados, el error y el «Buscando…» desaparecen al momento.
  - [ ] Borrar el texto a mano: igual. Escribir de nuevo y buscar: funciona.
  - [ ] Buscar y vaciar antes de que llegue la respuesta: no aparecen resultados.
  - [ ] Las descargas en marcha siguen en la cola.
- Verificación: `npm run check`; prueba manual en `npm run dev` (en el navegador con Cloudflare, o
  build `fakenative`).

### T3 · Contrato compartido + Hub (paquetes y búsqueda) · Grupo B · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/hub.ts`, `packages/shared/test/hub.test.ts`,
  `apps/hub/migrations/0002_parcels.sql`, `apps/hub/src/routes/parcels.ts` (nuevo),
  `apps/hub/src/routes/search.ts` (nuevo), `apps/hub/src/lib/search.ts` (nuevo),
  `apps/hub/src/jam/routes.ts`, `apps/hub/src/index.ts`, `apps/hub/src/cleanup.ts`,
  `apps/hub/wrangler.jsonc`, `apps/hub/test/fakeDb.ts`, `apps/hub/test/parcels.test.ts` (nuevo),
  `apps/hub/test/search.test.ts` (nuevo)
- Leer como contexto: `apps/hub/src/routes/lists.ts` (patrón a copiar), `apps/hub/src/lib/rateLimit.ts`,
  `apps/hub/src/lib/crypto.ts`, `apps/hub/src/lib/ids.ts`, `apps/hub/test/lists.test.ts`,
  `apps/hub/test/jamRoutes.test.ts`
- Qué hacer:
  1. Shared: todo lo de «Contratos → packages/shared/src/hub.ts» con tests.
  2. Hub: `parcels.ts` con los 4 endpoints de la tabla de contratos (zod para el cuerpo y la query;
     cuerpo leído como texto con tope `parcelBodyMaxBytes` igual que `readBody` de lists). Reclamar
     con `DELETE FROM parcels WHERE code = ? RETURNING songs_json, expires_at` (`.first()`).
  3. Mover `searchYoutube` de `jam/routes.ts` a `lib/search.ts` con firma
     `searchYoutube(q: string, kind: 'songs' | 'videos', lang: string): Promise<SearchResult[]>`;
     la Jam lo llama con `'songs'`. `routes/search.ts` = `GET /hub/v1/search`.
  4. `index.ts`: `app.route('/hub/v1/parcels', parcelRoutes)` y `app.route('/hub/v1/search', searchRoutes)`.
  5. `cleanup.ts`: borrar `parcels` con `expires_at < now`. `wrangler.jsonc`: cron `17 * * * *`.
  6. `fakeDb.ts`: soportar las sentencias nuevas de `parcels` (sin romper las de lists).
- TDD: sí
- Criterios de aceptación:
  - [ ] Crear: 201 con `code` de 6 símbolos válidos, `senderKey`, `expiresAt = now + 24 h`, `count`
        sin duplicados. 0 canciones o canción inválida → 400; 201 canciones → 413.
  - [ ] Reclamar: devuelve las canciones y la segunda reclamación da 404. Caducado → 410 y borrado.
        Código con formato malo → 404. Pasado el tope de 20 en 10 min → 429 `rate_limited`.
  - [ ] Estado: con clave buena 200; clave mala o ya reclamado → 404; caducado → 410.
  - [ ] Cancelar: clave mala 403; buena 204 y luego reclamar da 404.
  - [ ] Búsqueda: query inválida → 400; `fetch` falla → 502 `search_unavailable` (mock de `fetch`).
  - [ ] `cleanup` borra paquetes caducados. Tests de Jam y lists siguen en verde.
  - [ ] Ni IP ni datos personales en `parcels`.
- Verificación: `npx vitest run --root apps/hub`, `npx vitest run --root packages/shared`, `npm run check`

### T4 · Textos, ayuda y documentación · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/parcel.ts` (nuevo), `apps/web/src/i18n/en.ts`,
  `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/src/help/articles/music.ts`,
  `docs/hub.md`, `docs/PRIVACY.md`, `docs/android.md`
- Leer como contexto: `apps/web/src/i18n/share.ts` (patrón En/Es/Eu), `apps/web/src/help/articles/types.ts`
- Qué hacer:
  1. `i18n/parcel.ts` con TODAS las claves de la tabla de contratos en en/es/eu (lenguaje sencillo,
     sin jerga; «Hub» solo en `parcel.privacy`). Plurales con `.one`. Añadir `...parcelEn`,
     `...parcelEs`, `...parcelEu` igual que `share`.
  2. Ayuda: artículo nuevo `send-with-code` en `music.ts` (es/en/eu): para quién es (ordenador con
     Google Drive o este dispositivo, y cualquier móvil para enviar a otro móvil, p. ej. de un
     amigo), pasos para enviar desde el ordenador (buscar, añadir, «Enviar al móvil», QR), pasos para
     enviar desde el móvil (seleccionar canciones → «Enviar a otro móvil», o desde la cola; solo
     canciones que vienen de YouTube), pasos para recibir
     (Descargar → Recibir → escanear o teclear), que el código vale una vez y 24 h, que solo viajan
     los nombres de las canciones, y qué hacer si dice «no existe» o «caducado». En `send-to-phone`
     añadir una línea enlazando `[[send-with-code|…]]` para quien no usa Cloudflare.
  3. Docs: `hub.md` (fila «Lista de canciones para enviar al móvil | hasta 24 h o hasta recibirla»,
     topes nuevos, `routes/parcels.ts`, `routes/search.ts`, limpieza cada hora); `PRIVACY.md`
     (secciones Hub en inglés y español: qué se guarda y cuánto); `android.md` (párrafo «Send to
     phone through the Hub», incluido móvil → móvil).
- TDD: no
- Criterios de aceptación:
  - [ ] Test de paridad i18n y test de enlaces de ayuda en verde.
  - [ ] Ningún texto menciona D1, código interno ni jerga técnica.
- Verificación: `npx vitest run --root apps/web` y `npm run check`

### T5 · Cliente y store de paquetes · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/hub/client.ts`, `apps/web/src/stores/parcel.ts` (nuevo),
  `apps/web/test/parcelStore.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/hub/errors.ts`, `apps/web/src/stores/send.ts`,
  `apps/web/src/stores/downloads.ts` (firma de `enqueue`), `apps/web/src/stores/ui.ts` (`toast`),
  `apps/web/src/i18n/parcel.ts`, `packages/shared/src/hub.ts`, `apps/web/src/storage/types.ts`
  (`LocalTrack`), `apps/web/src/stores/library.ts` (`tracks` por id)
- Qué hacer: implementar exactamente «Web: client.ts» y «Web: stores/parcel.ts» de Contratos. Los
  errores se muestran con `parcelErrorText` (que delega en `hubErrorText`, que ya registra los
  inesperados). `add` comprueba duplicado por `videoId` y tope `HUB_LIMITS.parcelMaxSongs`.
  `poll` solo actúa si `current?.phase === 'waiting'`; un `HubError` 404 → `phaseWhenMissing`;
  410 → `'expired'`; error de red → no cambia nada (reintenta en el siguiente poll).
- TDD: sí
- Criterios de aceptación (tests con `vi.mock` de `../src/hub/client`, `../src/stores/downloads`,
  `../src/stores/ui`):
  - [ ] `add`: duplicado → false; al llegar a 200 → false y toast `parcel.full`.
  - [ ] `create`: llama a `createParcel` con la cesta, vacía la cesta y deja `phase: 'waiting'`; si
        falla, la cesta se conserva y hay toast de error.
  - [ ] `poll`: 404 antes de caducar → `'received'`; 404 después → `'expired'`; 410 → `'expired'`.
  - [ ] `receive('xx')` → `'invalid'` sin llamar a `claimParcel`; código bueno → `enqueue` con
        `{ videoId, title, author: artist }` y toast `parcel.gotSongs`; `enqueue` 0 → `parcel.nothingNew`;
        404 → `'error'` y toast con `parcel.err.not_found`.
  - [ ] `songFromResult` y `phaseWhenMissing` con tests propios.
  - [ ] `songsFromTracks`: salta pistas sin `source === 'youtube'` o sin `sourceRef` válido
        (`isVideoId`), quita duplicados, mapea `{ videoId: sourceRef, title, artist, durationMs }`.
  - [ ] `sendTracks`: ids → pistas de `useLibrary.getState().tracks` (ids desconocidos se ignoran);
        0 enviables → false + `parcel.noYoutube` sin llamar al Hub; 201 → false + `parcel.full`;
        con saltadas → toast `parcel.skipped`; ok → `current.phase === 'waiting'` y la cesta intacta.
- Verificación: `npx vitest run test/parcelStore.test.ts --root apps/web`

### T6 · Descargas: cesta del ordenador y «Recibir» del móvil · Grupo D · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/DownloadView.tsx`,
  `apps/web/src/components/send/Outbox.tsx` (nuevo, movido), `apps/web/src/components/send/ParcelPanel.tsx`
  (nuevo), `apps/web/src/components/send/ReceiveSheet.tsx` (nuevo)
- Leer como contexto: `apps/web/src/stores/parcel.ts`, `apps/web/src/components/jam/JamStart.tsx`
  (escanear/teclear código), `apps/web/src/native/qrScanner.ts`, `apps/web/src/hub/client.ts`
- Qué hacer:
  1. Mover `Outbox` y `sendStatus` tal cual a `components/send/Outbox.tsx`.
  2. `DownloadView`: modo de envío `const sendVia = isNative ? null : home === 'cloudflare' ? 'cloudflare' : hubAvailable() ? 'hub' : null`.
     Con `'hub'`: intro con `parcel.introTitle/introText` y ayuda `send-with-code`; búsqueda con
     `searchViaHub` y solo tipos `songs` y `videos`; el botón de cada resultado añade a la cesta
     (`useParcel.add(songFromResult(r))`, icono `Plus`/`Check` si ya está); enlace pegado de una
     canción → añade con `title = videoId`; enlace de playlist → muestra `parcel.playlistLink`;
     debajo, `<ParcelPanel />`. Con `'cloudflare'` todo como hoy (`<Outbox />`). Sin modo → el panel
     `send.needsApp` de hoy. Mantener el arreglo de T2 (vaciar resultados).
  3. `ParcelPanel` (solo la cesta): lista (quitar, vaciar, contador `parcel.basketCount`) y botón
     `parcel.create` que llama a `useParcel.create()`. La hoja con el QR NO va aquí (es T7, global).
  4. `ReceiveSheet` (solo `isNative` y `hubAvailable()`): botón `parcel.receive` en el
     `DownloadView` nativo (junto a la búsqueda); sheet con `parcel.scan` (usa `scanQr`, si
     `qr_unavailable` toast genérico traducido existente) y campo de código + `parcel.receiveButton`.
     `'invalid'` → texto `parcel.invalidCode` bajo el campo. `'ok'` → cierra el sheet. Si
     `useParcel.pendingCode` no es nulo al montar `DownloadView`, abrir el sheet con el código
     relleno y luego `setPendingCode(null)`.
  5. `DownloadView.tsx` debe quedar < 800 líneas; funciones < 50 líneas.
- TDD: no
- Criterios de aceptación:
  - [ ] Navegador con casa «este dispositivo» o Drive: buscar, añadir 2 canciones, «Enviar al
        móvil» → `useParcel.current` queda en `waiting` (la hoja la pinta T7).
  - [ ] Casa Cloudflare en navegador: igual que antes (Outbox).
  - [ ] Build `fakenative`: «Recibir» → código válido → canciones en la cola; código malo → aviso.
  - [ ] Todos los textos visibles salen de i18n.
- Verificación: `npm run check`; `npm run dev` + `npm run dev:hub` (con `VITE_HUB_URL=http://localhost:8788`);
  `npm run build -w @aske/web -- --mode fakenative` y después reconstruir el dist normal.

### T7 · Hoja del código global y envío desde el móvil · Grupo D · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/send/ParcelSheet.tsx` (nuevo),
  `apps/web/src/App.tsx`, `apps/web/src/components/SelectionBar.tsx`,
  `apps/web/src/components/player/QueuePanel.tsx`
- Leer como contexto: `apps/web/src/stores/parcel.ts`, `apps/web/src/components/QrCode.tsx`,
  `apps/web/src/components/SharePlaylistSheet.tsx` (sheet + QR), `apps/web/src/stores/ui.ts`
  (selección), `apps/web/src/stores/player.ts` (cola), `apps/web/src/hub/client.ts`
- Qué hacer:
  1. `ParcelSheet`: portal en `body`, visible si `useParcel.current` no es nulo. Muestra `QrCode`
     de `hubSendLink(HUB_URL, code)`, el código `formatJamCode(code)` en grande (legible desde otro
     móvil), `parcel.codeTitle`, `parcel.codeText`, `parcel.expires` (hora local), estado
     (`waiting`/`received`/`expired`), `parcel.privacy`, botones `parcel.cancel` y cerrar (`dismiss`).
     `poll()` cada 4 s mientras `phase === 'waiting'` y la página esté visible
     (`document.visibilityState`); en el móvil mantener la pantalla tal cual (sin wakelock nuevo).
  2. `App.tsx`: montar `<ParcelSheet />` una vez a nivel global. Enlace `#send=CODE`
     (`parseHubHash` → `kind: 'send'`): limpiar el hash; en nativo `setPendingCode(code)` y navegar
     a la vista de Descargas; en navegador toast `parcel.openInApp`.
  3. `SelectionBar`: botón `parcel.sendSelected` (icono `Send`) si `hubAvailable()`, que llama a
     `useParcel.getState().sendTracks(ids)` y sale del modo selección si devuelve `true`. Disponible
     en móvil y navegador (cualquier casa).
  4. `QueuePanel`: botón `parcel.sendQueue` si `hubAvailable()` y la cola tiene canciones; llama a
     `sendTracks` con los ids de la cola (sin la canción actual duplicada).
- TDD: no
- Criterios de aceptación:
  - [ ] Ordenador: tras `create()` aparece la hoja con QR + código; al reclamarlo (curl
        `POST /hub/v1/parcels/<code>/claim`) pasa a «¡Hecho!» en ≤ 4 s.
  - [ ] Móvil (fakenative): seleccionar 3 canciones de YouTube + 1 importada → hoja con código y
        aviso `parcel.skipped` (1); solo importadas → aviso `parcel.noYoutube` y sin hoja.
  - [ ] Desde la cola: «Enviar la cola a otro móvil» abre la hoja.
  - [ ] Otro móvil (o curl) que recibe el código: el emisor pasa a «¡Hecho!».
  - [ ] Todos los textos visibles salen de i18n; funciones < 50 líneas.
- Verificación: `npm run check`; `npm run dev` + `npm run dev:hub`; build `fakenative` y después
  reconstruir el dist normal.

### T8 · Estado, fases y verificación final · Grupo E · Estado: HECHA

- Archivos (exclusivos): `docs/ESTADO.md`, `docs/v2/architecture.md`
- Qué hacer:
  1. `docs/v2/architecture.md`: en la tabla de fases añadir la fila `7.1 | Send to phone through the
Hub: computer → phone and phone → phone (one-time code/QR, 24 h, no music stored) | ✅`; en
     «Aske Hub» cambiar «Send to phone relay…» por una frase breve que diga que existe (código de un
     uso, 24 h, también entre móviles).
  2. `docs/ESTADO.md`: fecha, en «Hecho» el pulido de v0.8.2 (pruneImports, runThrottle, Java),
     el arreglo del buscador y «Enviar al móvil» vía Hub; quitar esos puntos de «En curso»; en
     «Decisiones» añadir: velocidad de descargas sin cambios (decisión de Andoni) y paquete de un
     uso borrado al recibir o a las 24 h. En «En curso»: Andoni debe `npm run hub:migrate:remote`
     (migración 0002) y `npm run deploy:hub` antes de `npm run deploy`.
  3. Ejecutar `npm run check` y `npm run test:e2e` (cerrar wrangler/workerd colgados después).
- TDD: no
- Criterios de aceptación:
  - [ ] `npm run check` en verde y smoke test en verde.
  - [ ] ESTADO y tabla de fases reflejan lo hecho.
- Verificación: `npm run check`, `npm run test:e2e`

## Riesgos / dudas abiertas

Decisiones de Andoni (2026-11-21), ya aplicadas al plan:

1. Quien envía muestra el código/QR y el móvil que recibe lo escanea.
2. Cloudflare conserva su envío actual (D1 + Outbox).
3. También móvil → móvil: el móvil crea el paquete desde la biblioteca (selección) o la cola.
4. Solo canciones sueltas por ahora (nada de playlists de YouTube enteras).

Notas:

- Son 8 tareas (una más de lo habitual): la interfaz se partió en T6 y T7 para que dos programadores
  trabajen en paralelo sin tocar los mismos archivos.
- Desde el móvil solo se envían canciones que vienen de YouTube; las importadas (MP3 propios) no
  tienen referencia pública y se saltan con aviso.
- Riesgo: código de 6 símbolos (~1.000 millones de combinaciones). Con el tope de 20 intentos por IP
  cada 10 min y 24 h de vida, adivinar uno es prácticamente imposible; si se quiere más margen, 8.
- Riesgo: despliegue en orden (`hub:migrate:remote` → `deploy:hub` → `deploy`); si la web sale antes
  que el Hub, «Enviar» dará «algo ha fallado» hasta desplegar el Hub.

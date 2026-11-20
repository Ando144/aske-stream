# PLAN: Botón de Radios, parpadeo de la guía y descargas fiables y más rápidas

Fecha: 2026-11-20 · Estado: COMPLETADO

## Objetivo

1. Radios: el botón «Añadir emisora» muestra solo el icono (como en Playlists) para que el título no se recorte.
2. Guía de primeros pasos: que no aparezca un instante al abrir la app cuando ya está completa.
3. Descargas: que sobrevivan a cerrar la app arrastrando y a la mala cobertura (reintentos con espera creciente y reanudación sola), y que guardar en la biblioteca sea más rápido (medir, guardar mientras baja la siguiente, menos escrituras por canción).

## Diagnóstico (lo que se ha encontrado en el código)

- **Guía (causa):** `FirstSteps` se pinta en cuanto la biblioteca sale de la caché (`LibraryView` solo espera `useLibrary.loaded`), pero las emisoras (`useRadio.load()`, llamada en `App.tsx`) llegan después, y en Cloudflare vienen de la red. Durante ese rato «Añadir una radio» cuenta como no hecho → se ve 3/4 y al llegar las emisoras pasa a 4/4 y desaparece. Además «completa» no se guarda nunca: se recalcula en cada arranque. Por eso es «a veces» (depende de lo que tarde la red).
- **Descargas que no siguen tras el tren:**
  - La cola vive en el JavaScript del WebView. Al cerrar arrastrando, Capacitor destruye la actividad: `DownloaderPlugin.handleOnDestroy()` hace `shutdownNow()` y yt-dlp se corta; el servicio en primer plano queda con su aviso y el wake lock (hasta 3 h) sin hacer nada.
  - `api.uploadTrack` (Cloudflare) no tiene tiempo máximo y yt-dlp no tiene `--socket-timeout`: con cobertura mala una subida o descarga puede quedarse colgada para siempre; `run()` queda con `running: true` y `retry()`/`retryFailed()` no hacen nada hasta reiniciar la app. Es la causa más probable de «hubo que reiniciar».
  - Sin cobertura, cada canción falla al momento (`navigator.onLine` o yt-dlp) y pasa a `error` sin reintento: la cola se «vacía» fallando todas.
  - `init()` llama a `Downloader.clearAll()` y borra cualquier audio ya descargado que estuviera pendiente de guardar.
- **Lentitud al guardar:**
  - Todo en serie: no empieza la siguiente descarga hasta terminar de guardar la anterior.
  - Drive: `driveHome.addTrack` hace `serialized(() => ensureFolders(st))`, que espera detrás del `sync()` diferido (descarga + fusión + subida de `library.json` entero). Como cada canción tarda más de 3 s (`PUSH_DELAY_MS`), entre canción y canción hay un sync completo y la siguiente subida espera a que acabe.
  - Por canción hay 3 cambios de biblioteca (`upsertTracks`, `addToPlaylist`, `reorderPlaylist` en `syncImport`): cada uno escribe la biblioteca entera en IndexedDB (`persist` de `library.ts`) y, en Drive, el documento entero (`save()` de `home.ts`); en Cloudflare son 2 llamadas extra a la API.
  - `findInLibrary` recorre todas las canciones por cada vídeo de la playlist importada (coste cuadrático en `syncImport`).
  - La portada (dos descargas nativas + recorte en canvas) va antes de subir, en serie con la lectura del audio.

## Decisiones de arquitectura

- **La descarga del audio pasa al servicio Android** (cola nativa persistente en `filesDir`); el **guardado en la biblioteca sigue en JavaScript** — así las descargas siguen con la app cerrada y no hay que reescribir Drive/Cloudflare/dispositivo en Java. Lo descargado con la app cerrada se guarda al volver a abrirla (el aviso lo dice).
- **Tubería de 2 etapas:** el servicio baja canciones de una en una; JS guarda en paralelo lo ya bajado (1 a la vez en dispositivo, 2 en Drive/Cloudflare) — se solapan bajar y guardar sin forzar a YouTube.
- **Reintentos en dos sitios con la misma tabla:** el servicio reintenta la descarga (esperando sin contar intentos mientras no haya red, `ConnectivityManager.NetworkCallback`); JS reintenta el guardado (subidas). Esperas: 15 s, 30 s, 1 min, 2 min, 5 min, 10 min; 6 intentos — tabla única en el contrato para que Java y TS coincidan.
- **Tiempos máximos en todo lo que usa la red:** yt-dlp `--socket-timeout 30 --retries 3`; subida a Cloudflare con `AbortSignal` proporcional al tamaño — nada puede volver a colgar la cola.
- **Lógica pura en `apps/web/src/downloads/`** (`types.ts`, `retry.ts`, `pipeline.ts`) con tests; la tienda solo orquesta — cumple «lógica pura con tests» y mantiene `stores/downloads.ts` < 800 líneas.
- **Guardado extraído** a `downloads/save.ts` y la sincronización de playlists importadas a `downloads/imports.ts`, agrupada (una vez cada 4 s o al vaciarse la cola) con un índice `videoId → track` — de 3 escrituras por canción a 1 + 1 por grupo.
- **Drive:** `ensureFolders` sin pasar por la cadena `serialized` cuando las carpetas ya se conocen — la subida no espera al sync de `library.json`.
- **Medir solo internamente:** cada trabajo guarda sus tiempos por etapa (`timings`) dentro del propio trabajo (se persiste con la cola en `aske:downloads-v1`, visible con `chrome://inspect`). Sin UI ni textos nuevos (decisión de Andoni) — sirve para decidir la siguiente optimización sin ensuciar pantallas.
- **Textos de la notificación nativa:** JS pasa plantillas ya traducidas con `{done}`, `{total}`, `{count}` sin rellenar (el `t()` actual deja intactas las variables que no recibe) — sin cadenas en `strings.xml` en 3 idiomas.
- **Guía:** nuevo flag persistido `firstStepsDone` y no pintar hasta que biblioteca **y** emisoras estén cargadas.
- **`DownloadView.tsx` (876 líneas)**: se extraen cola, fila, aviso de batería y panel del motor a `components/downloads/` — la vista baja de 800.

## Contratos (interfaces compartidas)

### 1. Tipos de trabajo — `apps/web/src/downloads/types.ts` (T3; `stores/downloads.ts` los reexporta)

```ts
import type { YtInfo } from '@aske/shared/youtube';

export type JobStatus =
  | 'queued' // waiting for the phone's downloader (native queue)
  | 'downloading' // native is downloading it (progress 0-100)
  | 'downloaded' // audio file ready on the phone, waiting to be saved to the library
  | 'saving'
  | 'done'
  | 'skipped'
  | 'error'
  | 'canceled';

export type NativeInfo = YtInfo & { duration?: number; abr?: number; acodec?: string };

export interface DownloadedFile {
  path: string;
  bytes: number;
  ext: string;
  info: NativeInfo;
}

export interface JobTimings {
  downloadMs?: number; // native, from start to file ready
  readMs?: number; // reading the file into the WebView
  coverMs?: number;
  uploadMs?: number; // Drive/Cloudflare upload or device write
  libraryMs?: number; // upsert + playlist sync
}

export interface DownloadJob {
  // fields that already exist (id, videoId, title, author, thumbnail, status, progress, error,
  // playlistId, batchId, sendId, keepOffline, trackId, createdAt, finishedAt) — unchanged
  attempts?: number; // save attempts already failed (network)
  retryAt?: number; // epoch ms; do not try to save before this
  file?: DownloadedFile; // set when status becomes 'downloaded'
  timings?: JobTimings;
}
```

`downloads/batch.ts`: `BatchJobStatus` = `JobStatus`; `'downloaded'` cuenta como ACTIVO y como CONTADO.

### 2. Reintentos — `apps/web/src/downloads/retry.ts` (T3)

```ts
export const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000, 600_000] as const;
export const MAX_ATTEMPTS = 6;
export type FailureKind = 'network' | 'canceled' | 'fatal';
/** Duck typing only (no imports from api/ or storage/): code, status, name, message. */
export function classifyFailure(err: unknown): FailureKind;
export type RetryPlan =
  | { action: 'wait-network' } // offline: does not count an attempt
  | { action: 'retry'; attempts: number; retryAt: number }
  | { action: 'give-up' };
export function planRetry(attempts: number, now: number, online: boolean): RetryPlan;
```

Reglas de `classifyFailure`: `code === 'canceled'` → canceled; `code` `network` → network; `code` `drive_full`/`storage_full`/`drive_auth`, `DriveAuthRequired` (por `name`), `status` 4xx salvo 408/429 → fatal; `status === 0`, `status` 408/429/5xx, `name` `TypeError` (fetch), `TimeoutError`, `AbortError` → network; mensaje con `network`, `timed out`, `timeout`, `connection`, `unable to resolve host`, `failed to fetch`, `no connection` → network; resto → fatal.
`planRetry`: offline → wait-network; `attempts >= MAX_ATTEMPTS` → give-up; si no → `{ attempts: attempts + 1, retryAt: now + RETRY_DELAYS_MS[attempts] }`.

### 3. Tubería — `apps/web/src/downloads/pipeline.ts` (T3)

```ts
export type HomeKind = 'device' | 'drive' | 'cloudflare';
export function saveConcurrency(home: HomeKind): number; // device 1, drive 2, cloudflare 2
export function nextToSave(
  jobs: readonly DownloadJob[],
  now: number,
  busy: ReadonlySet<string>,
): DownloadJob | undefined;
// 'downloaded', not in busy, (retryAt ?? 0) <= now; oldest createdAt first
export function nextWakeAt(jobs: readonly DownloadJob[], now: number): number | null; // earliest future retryAt of 'downloaded'
export function jobsForNative(
  jobs: readonly DownloadJob[],
  known: ReadonlySet<string>,
): NativeJob[];
// status 'queued' and jobId not in known (native queue + current + results)
export function reconcile(
  saved: readonly DownloadJob[],
  native: NativePending,
): {
  jobs: DownloadJob[];
  finished: NativeResult[]; // results for active jobs, to apply like a 'finished' event
  orphans: string[]; // jobIds native has results for but JS does not want (unknown/canceled/done): ack them
};
```

Reglas de `reconcile`: `saving` → `downloaded` si tiene `file`, si no `queued`; `downloading` que no está en `native.queued` ni es `native.current` y no tiene resultado → `queued` con progress 0; resultados nativos de trabajos activos → van a `finished` (no se aplican aquí); resto igual.

### 4. Plugin nativo — `apps/web/src/native/downloader.ts` (T4 añade; T6 quita lo marcado)

```ts
export interface NativeJob { jobId: string; videoId: string }
export interface NativeResult {
  jobId: string;
  ok: boolean;
  path?: string; bytes?: number; ext?: string; info?: NativeInfo; // when ok
  elapsedMs?: number;                                              // when ok
  error?: string;                                                  // when !ok (short yt-dlp line)
  code?: 'download_failed' | 'network' | 'canceled' | 'init_failed';
}
export interface NativePending {
  queued: string[];        // jobIds waiting in the native queue, in order
  current: string | null;  // jobId being downloaded now
  results: NativeResult[]; // finished and not yet acknowledged (also those done while the app was closed)
  waitingNetwork: boolean;
}
export interface NotificationTemplates {
  progress: string;    // e.g. 'Descargando {done} de {total}'  ({done}, {total} filled natively)
  waiting: string;     // 'Sin conexión: seguirá sola cuando vuelva la cobertura'
  openToSave: string;  // '{count} canciones descargadas. Abre Aske Stream para guardarlas' ({count})
  openToSaveOne: string;
}
// New plugin methods:
queue(o: { jobs: NativeJob[]; texts: NotificationTemplates }): Promise<void>; // appends (dedupe by jobId), starts the service
pending(): Promise<NativePending>;
ack(o: { jobId: string }): Promise<void>;   // forgets the result and deletes its folder
cancel(o: { jobId: string }): Promise<{ canceled: boolean }>; // removes from queue or kills the process
// New events:
addListener('finished', (r: NativeResult) => void)
addListener('network', (p: { waiting: boolean }) => void)
// Unchanged: init, updateEngine, list, fetchImage, deleteFile, setNotification, requestNotifications, 'progress'
// Deprecated (kept by T4 only so the app still compiles; T6 removes them): download(), clearAll()
```

Comportamiento nativo: archivos en `filesDir/yt-downloads/<jobId>/`; estado en `filesDir/downloads-queue.json` (`queue`, `results`, `texts`, `attempts` por trabajo). Un solo hilo de descarga dentro del servicio (no del plugin). Sin red validada → `waitingNetwork = true`, evento `network`, aviso con `texts.waiting`, espera al `NetworkCallback` sin contar intentos. Error con red → reintenta con `RETRY_DELAYS_MS`/`MAX_ATTEMPTS` (mismos valores); al agotarlos → resultado `ok:false, code:'network'` (o `download_failed` si el error no es de red). El servicio sigue vivo mientras la cola nativa no esté vacía **o** JS haya pedido `setNotification({active:true})`; si el plugin se destruye (app cerrada) se olvida lo de JS y usa las plantillas; al vaciarse sin JS deja un aviso normal (no fijo) con `openToSave[One]` y se para.

### 5. Guardado — `apps/web/src/downloads/save.ts` y `imports.ts` (T5)

```ts
// save.ts
export type SaveOutcome =
  | { kind: 'saved'; track: LocalTrack; timings: JobTimings }
  | { kind: 'duplicate'; trackId: string | undefined }; // Cloudflare 409
export function saveDownloaded(
  job: DownloadJob,
  file: DownloadedFile,
  home: HomeKind,
): Promise<SaveOutcome>;
// Throws on failure (the store classifies with classifyFailure). Does NOT delete the native file (the store calls ack).
export function uploadTimeoutMs(bytes: number): number; // max(120_000, bytes / 16_384 * 1000)

// imports.ts
export function resolvePlaylist(rawName: string, mode: 'merge' | 'new'): Promise<string | null>;
export function rememberImport(playlistId: string, videoIds: string[]): void;
export function syncImport(playlistId: string): Promise<void>;
export function scheduleImportSync(videoId: string): void; // debounced 4 s, groups videoIds
export function flushImportSync(): Promise<void>; // runs the pending sync now
export function pruneImports(jobs: readonly { videoId: string; status: JobStatus }[]): void;
export function findInLibrary(videoId: string): LocalTrack | undefined; // uses an index rebuilt when useLibrary.tracks changes
```

`api/client.ts`: `uploadTrack(form: FormData, signal?: AbortSignal)`.

### 6. Tienda — `useDownloads` (T6), lo que usa la UI (T7)

```ts
interface DownloadsState {
  jobs: DownloadJob[];
  engine: ...;            // unchanged
  keepOffline: boolean;   // unchanged
  /** true while the phone or the app is waiting for internet to come back. */
  waitingNetwork: boolean;
  /** jobIds being saved right now. */
  saving: string[];
  init, enqueue, enqueueUrl, cancel, cancelAll, retry, retryFailed, clearFinished,
  setKeepOffline, updateEngine,   // same signatures as today
  /** Re-sends queued jobs to the phone and saves what is ready (app reopened / internet back). */
  resume: () => Promise<void>;
}
```

`running` y `run()` desaparecen. `JobRow` deja de usar `s.running` (el «preparando» pasa a: `engine.status` starting/updating y el trabajo es el primero `queued`).

### 7. Claves i18n nuevas (T6 las añade en `es.ts`, `en.ts`, `eu.ts`; T7 solo las usa)

| Clave                                           | es (orientativo; en/eu equivalentes)                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `dl.st.downloaded`                              | Descargada · se guardará en tu biblioteca enseguida                                                                      |
| `dl.st.retrying`                                | La conexión falló al guardar. Lo intentará de nuevo sola en un momento                                                   |
| `dl.st.waitingNetwork`                          | Esperando cobertura                                                                                                      |
| `dl.waitingNetwork`                             | No hay conexión. Las descargas están en pausa y seguirán solas cuando vuelva la cobertura. No hace falta que hagas nada. |
| `dl.resumed`                                    | Ha vuelto la conexión: las descargas siguen                                                                              |
| `dl.closeOk`                                    | Puedes cerrar la app: las canciones seguirán bajando. Se guardarán en tu biblioteca cuando vuelvas a abrirla.            |
| `dl.savedAfterClose` / `.one`                   | {count} canciones descargadas mientras la app estaba cerrada ya están en tu biblioteca                                   |
| `dl.notifWaiting`                               | Sin conexión · seguirá sola cuando vuelva la cobertura                                                                   |
| `dl.notifOpenToSave` / `dl.notifOpenToSave.one` | {count} canciones descargadas. Abre Aske Stream para guardarlas / 1 canción descargada. Abre Aske Stream para guardarla  |
| `dl.err.network` (cambia el texto)              | No se pudo descargar por falta de conexión, ni tras varios intentos. Pulsa «Reintentar» cuando tengas buena cobertura.   |

## Tareas

### T1 · Botón de Radios solo con icono · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/RadioView.tsx`
- Leer como contexto: `apps/web/src/views/PlaylistsView.tsx` (líneas 57-91, botones solo icono)
- Qué hacer: en la cabecera (línea ~56) el botón `radio.addCustom` pasa a mostrar solo `<Plus size={16} />`, con `aria-label={t('radio.addCustom')}` y `title={t('radio.addCustom')}`, clase `btn primary small` como «Nueva playlist». Cambiar el contenedor `className="row"` por `className="header-actions"` como en Playlists. No tocar el diálogo (su `<h2>` sigue con el texto).
- TDD: no
- Criterios de aceptación:
  - [ ] El título «Radios» no se recorta en un móvil de 360 px de ancho.
  - [ ] El botón tiene nombre accesible y tooltip traducidos.
- Verificación: `npm run check`; comprobación visual en `npm run dev` con el navegador a 360 px.

### T2 · La guía no parpadea al abrir · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/FirstSteps.tsx`, `apps/web/src/stores/tips.ts`, `apps/web/src/lib/firstSteps.ts` (nuevo), `apps/web/test/firstSteps.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/stores/radio.ts` (campo `loaded`), `apps/web/src/views/LibraryView.tsx` línea 91, `apps/web/src/views/HelpView.tsx` línea 19
- Qué hacer:
  - `lib/firstSteps.ts`: función pura `firstStepsView(input: { hidden: boolean; completed: boolean; libraryLoaded: boolean; radioLoaded: boolean; steps: boolean[] }): 'none' | 'wait' | 'complete' | 'show'`. Orden: `hidden || completed` → `'none'`; `!libraryLoaded || !radioLoaded` → `'wait'`; todos los pasos hechos → `'complete'`; si no → `'show'`.
  - `tips.ts`: nuevo campo persistido `firstStepsDone: boolean` (en `Saved`, `DEFAULTS` = false, en `save`), acción `markFirstStepsDone()` (solo guarda si no lo estaba). `resetAll` lo vuelve a false (ya pasa al usar `DEFAULTS`). Guardados antiguos sin el campo → false.
  - `FirstSteps.tsx`: leer `useRadio((s) => s.loaded)` y `useLibrary((s) => s.loaded)`; usar `firstStepsView`; `'none'`/`'wait'`/`'complete'` → `null`; en `'complete'` llamar a `markFirstStepsDone()` en un `useEffect` (no durante el render).
- TDD: sí
- Criterios de aceptación:
  - [ ] Test: con radio sin cargar devuelve `'wait'` aunque falten pasos.
  - [ ] Test: completa → `'complete'`; con `completed: true` → `'none'` aunque los datos aún no hayan cargado.
  - [ ] Test de la tienda: `markFirstStepsDone()` persiste en `localStorage` (`aske:tips-v1`) y `resetAll()` lo vuelve a false.
  - [ ] Reactivar la guía, completar todo y reabrir la app: no se ve la guía ni un instante.
- Verificación: `npx vitest run test/firstSteps.test.ts --root apps/web` y `npm run check`.

### T3 · Lógica pura de la cola: tipos, reintentos y tubería · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/types.ts` (nuevo), `apps/web/src/downloads/retry.ts` (nuevo), `apps/web/src/downloads/pipeline.ts` (nuevo), `apps/web/src/downloads/batch.ts`, `apps/web/test/downloadRetry.test.ts` (nuevo), `apps/web/test/downloadPipeline.test.ts` (nuevo), `apps/web/test/batch.test.ts`
- Leer como contexto: `apps/web/src/stores/downloads.ts` (líneas 39-70, tipos actuales; `friendlyError` para los patrones de red), `apps/web/src/native/downloader.ts`
- Qué hacer: implementar exactamente los contratos 1, 2 y 3. `types.ts` define también `NativeJob`, `NativeResult`, `NativePending` (contrato 4) para que `pipeline.ts` no importe Capacitor; T4 los importará desde aquí. Sin imports de stores, api ni Capacitor en estos tres archivos. En `batch.ts`, `BatchJobStatus` pasa a ser `JobStatus` y `'downloaded'` entra en `ACTIVE` y `COUNTED`.
- TDD: sí
- Criterios de aceptación:
  - [ ] `classifyFailure`: casos de cada regla (status 0, 503, 429, 404, `TypeError`, `TimeoutError`, `code: 'canceled'`, `code: 'drive_full'`, `name: 'DriveAuthRequired'`, mensaje yt-dlp «Unable to resolve host», «Private video» → fatal).
  - [ ] `planRetry`: offline → wait-network sin sumar; intentos 0..5 dan las esperas de la tabla; 6 → give-up.
  - [ ] `nextToSave` respeta `retryAt`, `busy` y el orden; `nextWakeAt` devuelve el menor `retryAt` futuro o null.
  - [ ] `reconcile`: los 4 casos de la regla + huérfanos (resultado de trabajo cancelado o desconocido).
  - [ ] `batch.test.ts` cubre `'downloaded'` en `notificationCounts` e `importsToKeep`.
- Verificación: `npx vitest run test/downloadRetry.test.ts test/downloadPipeline.test.ts test/batch.test.ts --root apps/web`; `npx tsc -p apps/web --noEmit`.

### T4 · Servicio Android con cola propia que sobrevive al cierre · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/DownloadService.java`, `.../DownloadQueue.java` (nuevo), `.../DownloadWorker.java` (nuevo), `.../NetworkWatcher.java` (nuevo), `.../DownloaderPlugin.java`, `apps/mobile/android/app/src/main/AndroidManifest.xml`, `apps/web/src/native/downloader.ts`, `apps/web/test/fake-native/downloader.ts`
- Leer como contexto: contrato 4 de este plan; `apps/web/src/downloads/types.ts` (lo crea T3: si aún no existe, declara los tipos `NativeJob`/`NativeResult`/`NativePending`/`NotificationTemplates` en `native/downloader.ts` con la forma exacta del contrato y T6 unificará el import)
- Qué hacer:
  - `DownloadQueue.java`: estado sincronizado (cola, actual, resultados, plantillas, intentos) guardado en `filesDir/downloads-queue.json` tras cada cambio; métodos `add`, `takeNext`, `finish(result)`, `ack`, `remove`, `snapshot`.
  - `DownloadWorker.java`: el código de yt-dlp que hoy está en `DownloaderPlugin.download()` (mismas opciones) + `--socket-timeout 30` y `--retries 3`, escribiendo en `filesDir/yt-downloads/<jobId>/`; mide `elapsedMs`; clasifica el error como red (`UnknownHost`, `timed out`, `Connection`, `Unable to download`, `network`) o no. Un único `ExecutorService` estático compartido con `updateEngine` (que no corran a la vez).
  - `NetworkWatcher.java`: `ConnectivityManager.registerDefaultNetworkCallback`; `hasValidatedInternet()` y aviso al volver la red.
  - `DownloadService.java`: arranca el bucle de la cola; sin red → espera (evento `network`, aviso con `texts.waiting`); con fallo de red → reintento con `RETRY_DELAYS_MS = {15s,30s,60s,120s,300s,600s}`, `MAX_ATTEMPTS = 6`; `START_STICKY` y al reiniciarse con `intent == null` recarga la cola del archivo; `onTaskRemoved` no para nada; mantiene wake lock y Wi-Fi lock solo mientras descarga o espera reintento; al vaciarse la cola: si JS no está, aviso normal `openToSave[One]` y `stopSelf()`; si JS está y no pidió mantenerlo, `stopSelf()`. Comunica progreso/fin/red al plugin mediante un listener estático (nulo si la app está cerrada).
  - `DownloaderPlugin.java`: métodos `queue`, `pending`, `ack`; `cancel` quita de la cola o mata el proceso; `download()` se elimina en Java (lo hace el servicio) pero `download`/`clearAll` se mantienen en el tipo TS con `/** @deprecated removed in T6 */`; `clearAll` solo borra la carpeta antigua `cacheDir/downloads` (nunca `yt-downloads`). `deleteFile` acepta rutas bajo `cacheDir/downloads` y `filesDir/yt-downloads`. `handleOnDestroy` ya no para descargas: solo quita el listener y avisa al servicio de que JS se ha ido.
  - Manifest: permiso `ACCESS_NETWORK_STATE`; el servicio sigue `dataSync`.
  - `native/downloader.ts` y `fake-native/downloader.ts`: nuevos métodos y eventos del contrato 4; el falso simula una cola que termina cada trabajo tras un pequeño retraso.
- TDD: no (nativo; lo prueba Andoni en el móvil)
- Criterios de aceptación:
  - [ ] Compila: `.\gradlew.bat compileReleaseJavaWithJavac` en `apps/mobile/android` (JAVA_HOME = jbr de Android Studio).
  - [ ] `npm run check` verde (la app web sigue usando los métodos antiguos del tipo hasta T6).
  - [ ] Manual (Andoni): encolar 5 canciones, cerrar la app arrastrando → el aviso sigue avanzando; al acabar dice «Abre Aske Stream para guardarlas».
  - [ ] Manual: modo avión a mitad → aviso «Sin conexión…»; quitarlo → sigue solo.
- Verificación: los dos comandos de arriba y `npm run build -w @aske/web -- --mode fakenative` (después reconstruir el dist normal).

### T5 · Guardado extraído y más rápido · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/save.ts` (nuevo), `apps/web/src/downloads/imports.ts` (nuevo), `apps/web/src/api/client.ts`, `apps/web/src/storage/drive/home.ts`, `apps/web/test/downloadSave.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/stores/downloads.ts` (funciones `process`, `fetchCover`, `readNativeFile`, `mimeFor`, `syncImport`, `syncImportsFor`, `resolvePlaylist`, `rememberImport`, `pruneImports`, `findInLibrary`), `apps/web/src/downloads/batch.ts`, contrato 5
- Qué hacer:
  - `save.ts`: mover la parte de guardado de `process()` (desde «leer el archivo» hasta `upsertTracks` y `adopt`) a `saveDownloaded`, partida en funciones < 50 líneas por destino (`saveToCloudflare`, `saveToDrive`, `saveToDevice`). Leer el audio y preparar la portada **en paralelo** (`Promise.all`). Medir `readMs`, `coverMs`, `uploadMs`. Cloudflare: `api.uploadTrack(form, AbortSignal.timeout(uploadTimeoutMs(audio.size)))`. No borrar archivos nativos (lo hará la tienda con `ack`), salvo los de la portada (`Downloader.deleteFile`). Tipos desde `downloads/types.ts` (T3); si aún no existe, impórtalos igualmente con esas rutas: el grupo A se integra junto.
  - `imports.ts`: mover la lógica de playlists importadas tal cual, más: índice `Map<videoId, LocalTrack>` reconstruido solo cuando cambia la referencia `useLibrary.getState().tracks`; `scheduleImportSync(videoId)` agrupa y ejecuta `syncImport` de las importaciones afectadas tras 4 s sin novedades; `flushImportSync()` lo hace ya. `pruneImports` recibe los trabajos por parámetro (no importa la tienda de descargas: evita ciclos).
  - `api/client.ts`: `uploadTrack(form, signal?)` pasa `signal` a `json(...)` (ya admite `signal`).
  - `drive/home.ts`: en `addTrack` y `setPlaylistCover`, si `st.rootId && st.audioId && st.coversId` no llamar a `serialized(...)` (sin cambiar el resto).
  - No tocar `stores/downloads.ts` (lo hace T6).
- TDD: sí (para `uploadTimeoutMs` y la agrupación de `scheduleImportSync` con temporizadores falsos de Vitest y `syncImport` simulado); el resto se cubre con `npm run check`.
- Criterios de aceptación:
  - [ ] Test: `uploadTimeoutMs(1 MB) === 120 000`; `uploadTimeoutMs(10 MB)` > 120 000.
  - [ ] Test: 5 llamadas a `scheduleImportSync` en 3 s → una sola sincronización por importación; `flushImportSync` la adelanta.
  - [ ] `npm run check` verde (los tests de Drive existentes siguen pasando).
- Verificación: `npx vitest run test/downloadSave.test.ts test/driveDoc.test.ts --root apps/web`; `npm run check`.

### T6 · Tienda de descargas con tubería, reintentos y reanudación · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/downloads.ts`, `apps/web/src/App.tsx`, `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/src/native/downloader.ts`, `apps/web/test/fake-native/downloader.ts`, `apps/web/src/views/DownloadView.tsx` (solo adaptar a la tienda nueva, sin añadir líneas netas), `apps/web/test/downloadsStore.test.ts` (nuevo)
- Leer como contexto: contratos 1-7; `apps/web/src/downloads/{types,retry,pipeline,save,imports,batch}.ts`
- Qué hacer:
  - Reescribir `stores/downloads.ts` como orquestador (< 500 líneas, funciones < 50): quitar el código movido a `save.ts`/`imports.ts` y reexportar los tipos de `downloads/types.ts`.
  - `init()`: cargar trabajos; `Downloader.pending()` → `reconcile`; aplicar `finished`; `ack` de `orphans`; escuchar `progress`, `finished`, `network`; enviar `jobsForNative` con `queue({ jobs, texts })` (plantillas: `t('dl.notifTitle', { done: '{done}', total: '{total}' })`, `t('dl.notifWaiting')`, `t('dl.notifOpenToSave')`, `t('dl.notifOpenToSave.one')`); `pump()`. Si hubo resultados hechos con la app cerrada, al terminar de guardarlos toast `dl.savedAfterClose`. Ya **no** llama a `clearAll`.
  - Evento `finished`: ok → `downloaded` con `file` y `timings.downloadMs = elapsedMs`; `code: 'canceled'` → `canceled` + `ack`; otro → `error` con `friendlyError` + `ack`.
  - `pump()`: mientras `saving.length < saveConcurrency(home)` y haya `nextToSave` → `saveJob` sin esperar. `saveJob`: `saving` → `saveDownloaded` → `done` (+ `libraryMs`), `ack`, `scheduleImportSync`, `reportSend`. Si falla: `classifyFailure` + `planRetry(job.attempts ?? 0, now, navigator.onLine)` → `retry` (vuelve a `downloaded` con `attempts`/`retryAt`), `wait-network` (vuelve a `downloaded`, `waitingNetwork = true`), `give-up`/`fatal` → `error` + `ack`. Programar un único `setTimeout` a `nextWakeAt`. Al quedar la cola vacía: `flushImportSync()` y toast `dl.allDone` como hoy.
  - `resume()`: reenvía `jobsForNative`, pone `waitingNetwork` según `navigator.onLine` y el último evento nativo, `pump()`. En `App.tsx` llamar a `useDownloads.getState().resume()` en los manejadores `online` y `visibilitychange` (visible) que ya existen; en `online`, si estaba esperando, toast `dl.resumed`.
  - `enqueue`: igual que hoy pero enviando a la cola nativa (`queue`) mientras la app está visible; `cancel` llama a `Downloader.cancel` y, si estaba `downloaded`, a `ack`. `retry`/`retryFailed`: `queued`, `attempts: 0`, sin `retryAt`, y `resume()`.
  - `notify()` sigue llamando a `setNotification` mientras haya trabajos activos (incluido guardar).
  - Quitar `download` y `clearAll` de `native/downloader.ts` y `fake-native/downloader.ts`, y los imports de esos tipos pasan a `downloads/types.ts`. Quitar el método Java `clearAll` de `DownloaderPlugin.java` **no** (es de T4 y ya solo limpia la carpeta antigua: dejarlo es inofensivo; anotarlo en Riesgos si molesta).
  - `DownloadView.tsx`: solo los cambios mínimos para compilar (p. ej. `JobRow` deja de usar `running`, `statusText` cubre `downloaded`). No añadir UI nueva aquí (es T7).
  - i18n: añadir todas las claves del contrato 7 en es, en y eu (con `.one` donde haya `{count}`).
- TDD: sí (test de la tienda con `vi.mock` de `../native/downloader`, `../native/platform` (`isNative: true`), `../downloads/save` e `../downloads/imports`)
- Criterios de aceptación:
  - [ ] Test: un `finished` ok pasa el trabajo a `downloaded` y `pump` lo guarda → `done` y llama a `ack`.
  - [ ] Test: guardado que falla con `status: 0` estando offline → sigue `downloaded`, `waitingNetwork` true; `resume()` online → se guarda.
  - [ ] Test: fallo de red online → `attempts` 1 y `retryAt` = ahora + 15 s; con temporizadores falsos se reintenta solo.
  - [ ] Test: con 3 `downloaded` en Cloudflare se guardan como máximo 2 a la vez.
  - [ ] Test: un error que no es de red pasa a `error` sin reintentar.
  - [ ] Test de paridad i18n verde; `npm run check` verde.
- Verificación: `npx vitest run test/downloadsStore.test.ts test/i18n.test.ts --root apps/web`; `npm run check`; `npm run test:e2e` (cerrar wrangler/workerd colgados después).

### T7 · UI de Descargas: extraer y aviso de cobertura · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/DownloadView.tsx`, `apps/web/src/components/downloads/DownloadQueue.tsx` (nuevo: `Queue`, `JobRow`, `statusText`), `apps/web/src/components/downloads/BatteryHint.tsx` (nuevo), `apps/web/src/components/downloads/EnginePanel.tsx` (nuevo), `apps/web/src/components/downloads/NetworkBanner.tsx` (nuevo), `apps/web/src/help/articles/music.ts`, `docs/ESTADO.md`
- Leer como contexto: `apps/web/src/stores/downloads.ts` (contrato 6), `apps/web/src/i18n/es.ts` (claves `dl.*`), `apps/web/src/views/DownloadView.tsx` líneas 559-810
- Qué hacer:
  - Mover `statusText`, `Queue`, `JobRow`, `BatteryHint` y `EnginePanel` de `DownloadView.tsx` a los archivos nuevos sin cambiar su comportamiento y luego:
  - `statusText`: `downloaded` → `dl.st.downloaded`; `downloaded` con `retryAt` futuro → `dl.st.retrying`; activo con `waitingNetwork` → `dl.st.waitingNetwork`. `downloaded` cuenta como activo en la cola (con botón cancelar).
  - `NetworkBanner`: si `waitingNetwork` y hay activos, panel ámbar con `dl.waitingNetwork` (`role="status"`).
  - `BatteryHint`: añadir la línea `dl.closeOk` cuando hay activos.
  - `EnginePanel`: solo se mueve, sin cambios. No mostrar tiempos medidos en ninguna pantalla (decisión de Andoni).
  - Ayuda (`music.ts`, artículos `download-youtube` y `download-playlist`, en es/en/eu): explicar en lenguaje sencillo que se puede cerrar la app, que sin cobertura se pausa y sigue sola, y que lo bajado con la app cerrada se guarda al abrirla. Respetar el formato de enlaces entre artículos.
  - `DownloadView.tsx` debe quedar < 800 líneas (objetivo < 600).
  - `docs/ESTADO.md`: quitar «`DownloadView.tsx` 876 líneas» de problemas conocidos y anotar lo que queda por probar en el móvil.
- TDD: no
- Criterios de aceptación:
  - [ ] `DownloadView.tsx` < 800 líneas y cada componente nuevo < 200.
  - [ ] Con el modo avión en `fakenative` (o `navigator.onLine` falso) se ve el aviso de cobertura.
  - [ ] Test de ayuda (enlaces) y de i18n verdes.
- Verificación: `npm run check`; `npm run build -w @aske/web -- --mode fakenative`, mirar la pantalla Descargas, y reconstruir el dist normal; `npm run test:e2e`.

## Decisiones de Andoni (dudas cerradas)

- Lo descargado con la app cerrada se guarda en la biblioteca **al volver a abrir la app** (nada de guardar desde Java).
- **Una descarga a la vez**; el guardado va en paralelo (1 en dispositivo, 2 en Drive/Cloudflare).
- Los tiempos medidos **no se muestran en ninguna pantalla** ni tienen textos: solo se guardan dentro de cada trabajo (`timings`) para consultarlos con `chrome://inspect`.

## Riesgos

- Riesgo: `START_STICKY` y arrancar el servicio en segundo plano tienen límites en Android 12+ (y 6 h/día de `dataSync` en Android 15, ya gestionado con `onTimeout`). Si Android no deja reiniciarlo, lo pendiente se reanuda al abrir la app (T6).
- Riesgo: si yt-dlp devuelve un `.m4a` y la biblioteca es Cloudflare, el guardado falla como hoy (fatal); no cambia con este plan.
- Riesgo: la siguiente optimización (p. ej. no reescribir la biblioteca entera en IndexedDB en cada `upsertTracks`) queda para cuando se consulten los `timings` internos en el móvil.
- Nota: el método Java `clearAll` queda limpiando solo la carpeta antigua; se puede quitar en una versión posterior.

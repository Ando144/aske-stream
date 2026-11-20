# PLAN: Pulir las descargas (v0.8.2)

Fecha: 2026-11-20 · Estado: EN CURSO

## Objetivo

Cerrar los 3 pendientes de las descargas: (1) cancelar o limpiar sin perder canciones que ya
deberían estar en su playlist importada; (2) un `jobId` vacío no puede borrar la carpeta de
descargas entera en el móvil; (3) cuando Android corta el servicio por tiempo (`onTimeout`, límite
de 6 h/día de Android 15), parar limpio, guardar la cola, avisar y seguir al reabrir la app.
Añadir los tests que faltan (imports, cola, throttle de `player.ts`, `blocking` de `db.ts`).

## Decisiones de arquitectura

- `flushImportSync()` se serializa (una cadena de promesas) — hoy, si dos flush se solapan, el
  segundo vuelve enseguida y el `pruneImports` posterior borra la importación que el primero aún
  está sincronizando (las canciones no llegan a la playlist).
- Nueva `settleImports(getJobs)` en `downloads/imports.ts` = flush y después prune. La usan
  `cancel`, `cancelAll` y `clearFinished` — un solo sitio con el orden correcto.
- `clearFinished()` pasa a ser `async` y hace el flush ANTES de olvidar las importaciones.
  Lo pendiente se descarta; lo que ya está guardado se coloca en su playlist.
- Java: un `jobId` vacío se ignora en todas partes (plugin, cola, borrado de carpetas) — hoy
  `ack("")` → `jobDir(ctx, "")` = la carpeta raíz `downloads/` y la borra entera.
- `onTimeout`: el servicio para el yt-dlp en curso, devuelve la canción al principio de la cola
  (sin contar intento), suelta los bloqueos, muestra un aviso «Descargas en pausa. Abre Aske Stream
  para seguir» y se detiene. Ignora el resultado tardío del worker (flag `stopping`).
- Reanudar al reabrir: `sendToNative()` llama a `Downloader.queue({ jobs: [] , texts })` también
  cuando no hay trabajos nuevos pero el móvil aún tiene cola (`queued`/`current`). Así se vuelve a
  arrancar el servicio. Llamarlo con el servicio ya en marcha es inofensivo.
- El texto del aviso viaja como los demás textos de notificación (`NotificationTemplates.paused`);
  en Java hay un texto de reserva en inglés en `strings.xml` por si la cola guardada es antigua.
- El throttle de `player.ts` se extrae a una función pura `createRunThrottle` para poder probarlo
  (y de paso evita dos comprobaciones a la vez y no deja promesas rechazadas sin manejar).
- Nada de dependencias nuevas (`npm ci` solamente): el test de `db.ts` simula `idb` con `vi.mock`.

## Contratos (interfaces compartidas)

`apps/web/src/downloads/imports.ts` (T1):

```ts
/** Same as before, but calls never overlap: a call waits for the one in progress. */
export async function flushImportSync(): Promise<void>;
/** Flushes pending playlist syncs, then prunes imports using the jobs read AFTER the flush. */
export async function settleImports(
  getJobs: () => readonly { videoId: string; status: JobStatus }[],
): Promise<void>;
```

`apps/web/src/downloads/types.ts` (T3):

```ts
export interface NotificationTemplates {
  progress: string;
  waiting: string;
  openToSave: string;
  openToSaveOne: string;
  /** Shown by the phone when Android stops the downloads for time (onTimeout). */
  paused: string;
}
```

i18n (T5): clave nueva `dl.notifPaused` (sin variables) en es, en y eu.

- es: `Descargas en pausa. Abre Aske Stream para seguir`
- en: `Downloads paused. Open Aske Stream to carry on`
- eu: `Deskargak pausan. Ireki Aske Stream jarraitzeko`

Java (T4): la cola guardada (`texts`) trae la clave `"paused"`; recurso nuevo
`R.string.downloads_paused` = `Downloads paused. Open Aske Stream to carry on` como reserva.

`apps/web/src/offline/runThrottle.ts` (T6):

```ts
export function createRunThrottle(opts: {
  minGapMs: number;
  mayRun: () => Promise<boolean>;
  run: () => void;
  now?: () => number; // default Date.now
}): () => void;
```

Reglas: si desde el último `run` pasaron menos de `minGapMs`, no hace nada; si ya hay una
comprobación `mayRun` en curso, no hace nada; si `mayRun` resuelve `true`, guarda la hora de la
llamada como último run y llama a `run()`; si resuelve `false` o rechaza, no guarda nada (la
siguiente llamada vuelve a intentarlo) y no deja promesas rechazadas sin manejar.

## Tareas

### T1 · Imports: flush serializado y `settleImports` · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/imports.ts`, `apps/web/test/downloadImports.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/downloads/batch.ts` (`importsToKeep`), `apps/web/test/downloadsStore.test.ts` (estilo de mocks)
- Qué hacer:
  - Serializar `flushImportSync`: guardar en una variable de módulo la promesa del flush en curso
    y encadenar el nuevo detrás (`chain = chain.then(run, run)`), de modo que cada llamada espera a
    las anteriores y luego procesa los `pendingVideoIds` que haya en ese momento. Un error en un
    flush no debe romper la cadena para los siguientes (pero sí se propaga a quien lo llamó).
  - Añadir `settleImports(getJobs)` según el contrato: `await flushImportSync()` y después
    `pruneImports(getJobs())`.
  - Tests nuevos (mockear `../src/stores/library` con `useLibrary.getState()` devolviendo
    `tracks`, `playlists`, `addToPlaylist`, `reorderPlaylist`, `createPlaylist` simulados, y
    `../src/lib/storage` con un `Map` en memoria):
    - dos `flushImportSync()` solapados: el segundo no termina antes que el primero; después de
      `settleImports` la playlist tiene las canciones aunque `addToPlaylist` tarde (promesa con
      retardo) y la importación ya terminada se olvida;
    - `scheduleImportSync` agrupa: con fake timers, dos llamadas seguidas → un solo sync a los 4 s;
    - `settleImports` llama a `getJobs` después del flush (no antes);
    - `pruneImports` conserva importaciones con canciones activas, con error o canceladas.
- TDD: sí
- Criterios de aceptación:
  - [ ] Los tests nuevos fallan con el código actual en el caso de flush solapado y pasan tras el cambio.
  - [ ] Firmas exactamente como en Contratos; `flushImportSync` mantiene su nombre y uso actual.
- Verificación: `npx vitest run test/downloadImports.test.ts --root apps/web`

### T2 · Java: `jobId` vacío nunca borra ni toca nada · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/DownloadQueue.java`, `.../DownloadWorker.java`, `.../DownloaderPlugin.java`
- Leer como contexto: nada más
- Qué hacer:
  - `DownloadWorker.jobDir` / `deleteJobFolder`: si el id saneado (`replaceAll("[^\\w-]", "")`)
    queda vacío, `deleteJobFolder` no hace nada (nunca borrar `rootDir`). Añadir un helper
    `static boolean isValidJobId(String id)` (no nulo y no vacío tras sanear) en `DownloadWorker`.
  - `DownloaderPlugin.ack` y `cancel`: si `jobId` no es válido → `call.reject("jobId is required")`.
    En `queue()` usar el mismo helper en lugar de `jobId.isEmpty()`.
  - `DownloadQueue`: `ack`, `remove`, `isCurrent` ignoran ids no válidos (devuelven sin tocar
    nada / `false`); `load()` descarta trabajos guardados con `jobId` o `videoId` vacíos y
    resultados sin `jobId` (registrar con `Log.w`); `add()` también los salta.
  - Sin cambiar el formato del JSON guardado. Funciones < 50 líneas.
- TDD: no (Java sin tests de unidad en el proyecto)
- Criterios de aceptación:
  - [ ] Ningún camino llama a `deleteRecursive(rootDir)` con un id vacío.
  - [ ] `ack`/`cancel` desde JS con id vacío se rechazan con mensaje claro.
  - [ ] Compila: `.\gradlew.bat assembleRelease` en `apps/mobile/android` (si hay JDK 21 y SDK; si no, anotarlo en el informe).
- Verificación: compilación del APK (ver CLAUDE.md) + revisión de código.

### T3 · Store: cancelar/limpiar con flush y reanudar el servicio · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/downloads.ts`, `apps/web/src/downloads/types.ts`, `apps/web/src/components/downloads/DownloadQueue.tsx`, `apps/web/test/downloadsStore.test.ts`, `apps/web/test/fake-native/downloader.ts` (solo si hace falta)
- Leer como contexto: `apps/web/src/downloads/imports.ts` (tras T1), `apps/web/src/downloads/pipeline.ts`, `apps/web/src/native/downloader.ts`
- Qué hacer:
  - `types.ts`: añadir `paused: string` a `NotificationTemplates` (contrato).
  - `notificationTemplates()`: añadir `paused: t('dl.notifPaused')`.
  - Extraer `cancelOne(jobId)` interno (lo que hoy hace `cancel` sin el `pruneImports`).
    `cancel(jobId)` = `cancelOne` + `await settleImports(() => get().jobs)`.
    `cancelAll()` = `cancelOne` de cada activo + un solo `settleImports` al final.
  - `clearFinished()` → `async` (`Promise<void>` en la interfaz): primero `set`/`persist` con solo
    los activos, después `await settleImports(() => get().jobs)`. Si falla: `toast(t('dl.err.generic'), 'error')`
    (igual que `finishQueue`), sin tragarse el error en silencio.
  - `DownloadQueue.tsx`: `onClick={() => void useDownloads.getState().clearFinished()}`.
  - `sendToNative()`: si no hay trabajos nuevos pero `pending` (no nulo) tiene `queued.length > 0`
    o `current`, llamar igualmente a `Downloader.queue({ jobs: [], texts: notificationTemplates() })`
    (rearranca el servicio tras `onTimeout`). Sin `pending` → no hacer nada.
  - `finishQueue` puede seguir con su flush+prune o usar `settleImports`; el orden no debe cambiar.
  - Actualizar el mock de `../src/downloads/imports` en `downloadsStore.test.ts` con `settleImports`.
  - Tests nuevos en `downloadsStore.test.ts`:
    - `clearFinished` llama a `settleImports` y deja solo los activos;
    - `cancelAll` con 3 trabajos → `Downloader.cancel` 3 veces y `settleImports` una sola vez;
    - `cancel` de un trabajo `downloaded` hace `ack`, no `cancel`;
    - `resume()` con `pending` = `{ queued: ['x'], ... }` y sin trabajos nuevos → `Downloader.queue`
      llamado con `jobs: []`; con `pending` vacío → no se llama;
    - `notificationTemplates` envía `paused` (comprobar el argumento `texts` de `Downloader.queue`).
  - Revisar que `fake-native/downloader.ts` acepta `jobs: []` sin romper (no debe dar error).
- TDD: sí
- Criterios de aceptación:
  - [ ] Todos los tests de `downloadsStore.test.ts` pasan (los antiguos y los nuevos).
  - [ ] `downloads.ts` sigue < 800 líneas y cada función < 50.
- Verificación: `npx vitest run test/downloadsStore.test.ts --root apps/web`

### T4 · Java: `onTimeout` limpio con aviso · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/DownloadService.java`, `apps/mobile/android/app/src/main/res/values/strings.xml`
- Leer como contexto: `.../DownloadQueue.java` (`requeueCurrent`), `.../DownloaderPlugin.java` (`cancel`, cómo usa `destroyProcessById`)
- Qué hacer:
  - Campos nuevos: `private String currentJobId;` y `private boolean stopping;` (solo en el hilo principal).
  - `startNext`: guardar `currentJobId = job.jobId`. `onResult`: poner `currentJobId = null`; si
    `stopping`, salir sin tocar la cola. `pump`: si `stopping`, salir.
  - `onTimeout(int startId, int fgsType)`: `stopping = true`; `main.removeCallbacks(pumpTask)`;
    si había descarga, `queue.requeueCurrent(false)` (no cuenta intento) y
    `YoutubeDL.getInstance().destroyProcessById(currentJobId)` dentro de try/catch con `Log.w`;
    `releaseLocks()`; `stopForeground(STOP_FOREGROUND_REMOVE)` (o `true` en API < 24 según el
    estilo actual); `showPaused()`; `stopSelf()`. Debe ser rápido (Android da pocos segundos).
  - `showPaused()`: notificación con `DONE_ID` (así `clearDoneNotice` la quita al abrir la app),
    texto `queue.texts().optString("paused")` o, si está vacío, `getString(R.string.downloads_paused)`;
    `setAutoCancel(true)` y `openAppIntent`. Reutilizar el builder de `showOpenToSave` si se puede
    (extraer helper `showNotice(String text)`).
  - `strings.xml`: `<string name="downloads_paused">Downloads paused. Open Aske Stream to carry on</string>`.
  - Comentario corto del porqué (límite de 6 h/día de Android 15 para `dataSync`).
- TDD: no (servicio Android, se prueba en el Pixel)
- Criterios de aceptación:
  - [ ] Tras `onTimeout` la canción en curso vuelve al principio de la cola guardada sin sumar intentos.
  - [ ] El resultado tardío del worker no marca la canción como fallida/cancelada.
  - [ ] No quedan wake lock ni Wi-Fi lock retenidos; se ve el aviso traducido.
  - [ ] Compila (`.\gradlew.bat assembleRelease`; si no hay entorno, anotarlo).
- Verificación: compilación + prueba manual en el Pixel (ver Riesgos: cómo forzar el timeout).

### T5 · Textos: aviso de pausa y ayuda · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/src/help/articles/music.ts`
- Leer como contexto: líneas de `dl.notifWaiting` en los tres i18n
- Qué hacer:
  - Añadir `dl.notifPaused` en los tres idiomas, junto a `dl.notifOpenToSave`, con los textos de Contratos.
  - En `help/articles/music.ts`, en los párrafos que explican cerrar la app (líneas ~19 y ~62 en
    español, y sus equivalentes en en/eu), añadir una frase sencilla: «Si descargas durante muchas
    horas seguidas con la app cerrada, Android puede pausarlas; verás un aviso y seguirán solas
    al abrir Aske Stream.» (traducida a en y eu, mismo tono, sin jerga).
- TDD: no
- Criterios de aceptación:
  - [ ] Test de paridad i18n y test de ayuda pasan.
- Verificación: `npx vitest run test/i18n.test.ts test/help.test.ts --root apps/web`

### T6 · Tests de throttle de `player.ts` y `blocking` de `db.ts` · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/offline/runThrottle.ts` (nuevo), `apps/web/src/stores/player.ts`, `apps/web/test/runThrottle.test.ts` (nuevo), `apps/web/test/offlineDb.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/offline/db.ts`, `apps/web/src/lib/power.ts` (`mayRotateOfflineNow`)
- Qué hacer:
  - Crear `createRunThrottle` según el contrato (con su test primero).
  - `player.ts`: sustituir `lastScheduledRun` y la función `scheduleRunThrottled` por
    `const scheduleRunThrottled = createRunThrottle({ minGapMs: RUN_MIN_GAP_MS, mayRun: () => mayRotateOfflineNow(usePlayer.getState().isPlaying), run: () => useOffline.getState().scheduleRun(5000) })`.
    Dejar `audio.preload = 'auto'` justo debajo de `const audio` (ahora está separado por la función).
    Ningún otro cambio en `player.ts`.
  - `runThrottle.test.ts`: primera llamada ejecuta; segunda antes de 10 min no; después de 10 min sí;
    `mayRun` false → no ejecuta y la siguiente vuelve a comprobar; dos llamadas mientras `mayRun`
    está pendiente → una sola comprobación; `mayRun` que rechaza → no ejecuta y no hay rechazo sin manejar.
  - `offlineDb.test.ts`: `vi.mock('idb')` con `openDB` que guarda las opciones y devuelve un db
    falso con `close: vi.fn()`. Comprobar: `getDb()` dos veces → un solo `openDB`; llamar a
    `blocking()` → `close` llamado y el siguiente `getDb()` vuelve a abrir; `upgrade(db, 0)` crea
    los 7 almacenes y el índice `by-startedAt`; `upgrade(db, 3)` solo crea `plays`.
    Usar `vi.resetModules()` + import dinámico para aislar el estado del módulo entre tests.
    No tocar `db.ts` salvo que un test destape un fallo real (en ese caso, arreglo mínimo y anotarlo).
- TDD: sí (runThrottle); no (offlineDb, es test de caracterización)
- Criterios de aceptación:
  - [ ] Ambos tests nuevos pasan; el comportamiento del reproductor no cambia.
- Verificación: `npx vitest run test/runThrottle.test.ts test/offlineDb.test.ts --root apps/web`

### T7 · Docs y comprobación final · Grupo C · Estado: HECHA

- Archivos (exclusivos): `docs/ESTADO.md`
- Qué hacer: quitar el pendiente «Pulir descargas» y el problema «Sin test del throttle…» de
  ESTADO.md; anotar lo hecho (máx. 2 líneas) y «probar onTimeout en el Pixel» para Andoni.
  Ejecutar `npm run check` y después `npm run test:e2e` (cerrar wrangler/workerd colgados en Windows).
- TDD: no
- Criterios de aceptación:
  - [ ] `npm run check` verde; smoke e2e sin fallos nuevos.
- Verificación: `npm run check` ; `npm run test:e2e`

## Riesgos / dudas abiertas

- Probar `onTimeout` en el Pixel es difícil (6 h reales). Se puede forzar con
  `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000` (1 min) en
  Android 15; luego restaurar con `adb shell device_config delete activity_manager data_sync_fgs_timeout_duration`.
- Tras el timeout, Android no deja volver a arrancar el servicio `dataSync` hasta que el usuario
  abra la app; por eso la reanudación solo ocurre al abrirla (lo pedido). Si la app estaba abierta
  en segundo plano, se reanuda al volver a verla (`visibilitychange` → `resume()`).
- Dudas abiertas para Andoni:
  1. ¿Avisar también dentro de la app al reabrir tras una pausa por tiempo (un toast «Seguimos con
     tus descargas»)?
     - No, basta la notificación (Recomendada): menos texto y menos código; la cola ya se ve en Descargas.
     - Sí, un toast al reabrir: más claro, pero requiere que el móvil informe de la pausa (cambio extra en Java y JS).
       Recomiendo la primera porque la notificación ya explica qué hacer y la reanudación es automática.
  2. ¿Subir versión (v0.8.2) y publicar release al terminar?
     - Sí, v0.8.2 tras probar en el Pixel (Recomendada): los arreglos de Java solo llegan con APK nuevo.
     - Esperar a juntarlo con F8b/F9: menos releases, pero el fallo de `jobId` vacío sigue en la calle.
       Recomiendo la primera porque el fallo de borrar la carpeta de descargas puede perder canciones.

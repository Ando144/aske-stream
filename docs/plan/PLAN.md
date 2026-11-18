# PLAN: Fase 5.1 — arreglos de uso real, temporizador y cierre de la fase 5

Fecha: 2026-11-18 · Estado: COMPLETADO (T1-T7 hechas; pruebas manuales en el móvil pendientes en T3, T4 y T7)

## Objetivo

Arreglar los 5 fallos que Andoni ha visto usando la app (vista previa de playlists, borrar la canción
que suena, descargas en segundo plano, playlists importadas incompletas, contador «20/30»), podar las
marcas de borrado de `library.json` (límite conocido de la fase 5) y añadir el temporizador de apagado.
La «copia en cualquier dirección» (último punto de la fase 5) se planifica aparte (ver «Fases siguientes»).
Incluye la pregunta «Juntar / Crear otra» al importar una playlist con nombre repetido.

## Decisiones de arquitectura

- Lógica nueva de descargas en un módulo puro `apps/web/src/downloads/batch.ts` — se prueba sin Android y `stores/downloads.ts` ya pasa de 500 líneas.
- Cada envío a la cola lleva un `batchId`; el contador de la notificación solo cuenta las tandas activas y no cuenta las «ya la tenías» — arregla «20/30» (reintentos con `createdAt` viejo y saltadas contadas como hechas).
- Las playlists importadas guardan el orden de YouTube (`PlaylistImport`) y se recolocan tras cada canción — así entran también las que ya tenías o estaban en la cola por otra playlist, y en su orden.
- Canciones que ya están en la biblioteca: se meten en la playlist en el momento de encolar y quedan como `skipped` — nunca se descargan dos veces.
- Borrar la canción que suena: el reproductor escucha a `useLibrary` y salta a la siguiente; la lógica de índices va pura en `player/queue.ts` — `player.ts` está en 735 líneas, no cabe más lógica ahí.
- Descargas en segundo plano: se mantiene la cola en JS (arreglo ligero): el renderer del WebView pasa a prioridad importante sin rebaja al ocultarse y el servicio en primer plano arranca al encolar (con la app visible) — Android rebaja y congela el proceso del WebView oculto si no suena audio.
- Temporizador de apagado en un store propio `stores/sleepTimer.ts` que solo llama a `usePlayer.pause()` y al volumen — no engorda `player.ts`.
- Poda de marcas de borrado: se olvidan las de más de 180 días al fusionar — un dispositivo sin conectar medio año podría resucitar algo borrado, riesgo asumible.
- Vista previa vacía (causa principal encontrada): `.dl-entries` es una columna flex con `max-height: 40vh` y cada fila lleva `.ellipsis` (`overflow: hidden`), así que su altura mínima es 0 y las filas se encogen hasta desaparecer cuando hay muchas → rectángulo gris vacío con 100 filas; con 40 aún se ven. Arreglo: filas con `flex-shrink: 0`.
- El tope de 100 NO es intencionado (`MAX_PAGES = 20` permite 2 000): es el tamaño de la primera página de InnerTube; la segunda no llega (token de continuación mal elegido o respuesta de continuación no reconocida) y el código devuelve las 100 sin avisar. Arreglo en el parser + aviso si se leen menos de las que dice YouTube.
- Nombre repetido al importar: se pregunta en la vista previa «Juntar» o «Crear nueva»; la nueva recibe el primer «Nombre (n)» libre (n ≥ 1, estilo Windows) — función pura `uniquePlaylistName`.
- Los enlaces de playlist pegados abren la misma vista previa que la búsqueda — un único sitio donde preguntar y avisar.

## Contratos (interfaces compartidas)

### `apps/web/src/downloads/batch.ts` (nuevo, puro, sin imports de stores)

```ts
export type BatchJobStatus =
  'queued' | 'downloading' | 'saving' | 'done' | 'skipped' | 'error' | 'canceled';
export interface BatchJob {
  status: BatchJobStatus;
  batchId?: string;
  createdAt: number;
}

/** Número mostrado en la notificación: «Descargando {position} de {total}». null si no hay nada activo. */
export function notificationCounts(
  jobs: readonly BatchJob[],
): { position: number; total: number } | null;
// Reglas: tandas activas = batchIds con algún job queued/downloading/saving (job sin batchId = tanda 'legacy').
// Dentro de las tandas activas: total = jobs con estado queued|downloading|saving|done|error;
// position = (done + error) + 1, nunca mayor que total. 'skipped' y 'canceled' no cuentan.

/** Tanda a la que se une un job que se reintenta: la tanda activa más reciente o una nueva. */
export function batchForRetry(jobs: readonly BatchJob[], now: number): string;
// Sin tandas activas → `b${now.toString(36)}`.

export interface PlaylistImport {
  playlistId: string;
  videoIds: string[];
} // orden de YouTube

/** Nuevo orden de la playlist: primero las importadas (orden YouTube, solo las que existen),
 *  después las que el usuario tenía/añadió y no son de la importación, en su orden actual.
 *  Sin duplicados, recortado a `max`. */
export function arrangeImportedPlaylist(
  videoIds: readonly string[],
  currentTrackIds: readonly string[],
  trackIdOf: (videoId: string) => string | undefined,
  max: number,
): string[];

/** Primer nombre libre estilo Windows: «Nombre (1)», «Nombre (2)»… sin repetir números usados.
 *  Compara sin distinguir mayúsculas y recortando espacios; respeta `maxLength` recortando la base
 *  (nunca el sufijo). Ej.: existentes ["Mix", "Mix (1)", "Mix (3)"] → "Mix (2)". */
export function uniquePlaylistName(
  name: string,
  existingNames: readonly string[],
  maxLength: number,
): string;
```

### `useDownloads.enqueue` (opciones nuevas, T6; las usa la vista previa)

```ts
enqueue(items: NewDownload[], opts?: {
  playlistName?: string;
  /** Si ya existe una playlist con ese nombre: 'merge' (juntar, por defecto) o 'new' (crear «Nombre (n)»). */
  playlistMode?: 'merge' | 'new';
  sendId?: string | null;
}): Promise<number>;
```

- «Enviar al móvil» (sin nadie mirando el móvil) usa siempre `'new'`: si el nombre existe, crea «Nombre (n)» (decisión A de Andoni).

### `DownloadJob` (en `stores/downloads.ts`)

- Campo nuevo `batchId?: string` (opcional: los jobs guardados de versiones anteriores no lo tienen).
- Pref nueva `downloads-imports-v1`: `PlaylistImport[]`; la importación se quita cuando no queda ningún
  job activo, en error o cancelado cuyo `videoId` esté en su lista (se compara por `videoId`, no por `playlistId`).

### `apps/web/src/player/queue.ts` (función pura nueva)

```ts
export interface PlaybackLists {
  currentId: string | null;
  context: string[];
  original: string[];
  index: number;
  queue: string[];
}
/** Quita canciones borradas de la reproducción. Si se borra la actual (de la lista), `index` queda
 *  en la anterior para que `step()` pase a la que venía después. */
export function withoutTracks(
  s: PlaybackLists,
  removed: ReadonlySet<string>,
): Omit<PlaybackLists, 'currentId'> & { currentRemoved: boolean };
```

### `apps/web/src/stores/sleepTimer.ts` (nuevo)

```ts
/** Minutos (entero de 1 a 480 = 8 h) o «al acabar la canción». */
export type SleepChoice = { minutes: number } | 'endOfTrack';
export const SLEEP_PRESETS_MIN = [15, 30, 45, 60, 90, 120, 180, 240] as const;
export const SLEEP_MAX_MIN = 480;
interface SleepTimerState {
  endsAt: number | null; // ms epoch; null si no hay temporizador o es 'endOfTrack'
  endOfTrack: boolean;
  start: (choice: SleepChoice) => void; // minutos fuera de 1..480 → se ajustan al límite
  cancel: () => void;
}
export const useSleepTimer: UseBoundStore<StoreApi<SleepTimerState>>;
```

### Recuento de la playlist (T3, `packages/shared/src/youtube.ts`)

- `PlaylistPage` gana `totalCount: number | null` (número de vídeos que dice la cabecera de YouTube).
- `PlaylistListing` (`native/downloader.ts`) gana `totalCount: number | null` y `complete: boolean`
  (`false` si se leyeron menos entradas que `totalCount` y el respaldo con yt-dlp tampoco llegó).

### Android (sin cambio de interfaz JS)

- `Downloader.setNotification({ active: true, ... })` además sube la prioridad del renderer;
  `{ active: false }` la devuelve a la normal. El JS no cambia de firma.

### Claves i18n nuevas (es, en, eu). Cada grupo tiene un único dueño de los archivos i18n: A → T3, B → T6, C → T7

- T3: `dl.playlistPartial` («Solo hemos podido leer {count} de {total} canciones. Puedes descargar
  estas ahora y volver a intentarlo luego para el resto.»), `dl.playlistLoadingMore` («Cargando el resto
  de la playlist… {count} de {total}»).
- T6: `dl.alreadyHad` («{count} ya las tenías: están en la playlist, no se descargan otra vez»),
  `dl.alreadyHad.one`, `dl.notifTitle` se mantiene («Descargando {done} de {total}»),
  `dl.playlistExists` («Ya tienes una playlist llamada «{name}». ¿Qué hacemos?»),
  `dl.playlistMerge` («Juntarlas: añadir las canciones a la que ya tienes»),
  `dl.playlistNew` («Crear otra: «{name}»»).
- T7: `sleep.title`, `sleep.minutes` («{count} min»), `sleep.hours` («{count} h»),
  `sleep.custom` («Otro tiempo»), `sleep.customHint` («Hasta 8 horas»), `sleep.endOfTrack`,
  `sleep.cancel`, `sleep.remaining` («Se apaga en {time}»), `sleep.set` (toast «La música se parará
  en {time}»), `sleep.setEndOfTrack`, `sleep.stopped` (toast «Temporizador: música parada»).

## Tareas

### T1 · Lógica pura de tandas y playlists importadas · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/batch.ts` (nuevo), `apps/web/test/batch.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/stores/downloads.ts` (solo tipos y `notify()`), `apps/web/test/planner.test.ts` (estilo de tests)
- Qué hacer: implementar exactamente las 4 funciones y tipos de «Contratos → batch.ts». Sin imports de
  stores, i18n ni Capacitor. Comentarios en inglés.
- TDD: sí
- Criterios de aceptación:
  - [ ] Tanda de 30 donde 19 son `skipped` y 0 hechas → `{ position: 1, total: 11 }`.
  - [ ] Un job viejo reintentado con `batchId` de la tanda activa no mete en la cuenta los terminados de tandas antiguas (caso «20/30» → «1/…»).
  - [ ] Dos tandas activas a la vez se suman; `canceled` resta del total.
  - [ ] Jobs sin `batchId` se tratan como una tanda `legacy`.
  - [ ] `arrangeImportedPlaylist` respeta el orden de YouTube, deja al final las canciones ajenas a la importación, no duplica y recorta a `max`.
  - [ ] `batchForRetry` devuelve la tanda activa más reciente (por `createdAt`) o una nueva.
  - [ ] `uniquePlaylistName`: `"Mix"` con `["Mix"]` → `"Mix (1)"`; con `["Mix","Mix (1)","Mix (3)"]` → `"Mix (2)"`; con `["mix "]` también cuenta como repetido; con un nombre largo recorta la base y conserva « (n)» dentro de `maxLength`; sin repetidos devuelve el nombre tal cual.
- Verificación: `npx vitest run apps/web/test/batch.test.ts -w @aske/web` (o `npm test -w @aske/web`)

### T2 · Borrar la canción que suena salta a la siguiente · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/player/queue.ts`, `apps/web/test/queue.test.ts`, `apps/web/src/stores/player.ts`
- Leer como contexto: `apps/web/src/stores/library.ts` (`deleteTrack`, `load`)
- Qué hacer:
  1. Añadir `withoutTracks` (contrato) a `player/queue.ts` con tests: borrar antes del índice baja el índice; borrar la actual deja `index` en la anterior; quita de `queue` y `original`; con todo borrado, listas vacías.
  2. En `player.ts` añadir una función interna `forgetTracks(removed: Set<string>)`: aplica `withoutTracks`; si `currentRemoved` y el modo es `track`: si `step(false)` encuentra siguiente → `loadCurrent(estabaSonando)`; si no → `audio.pause()`, `resetSource()`, `set({ mode: 'idle', currentId: null, isPlaying: false })`. Siempre `persist()`.
  3. Registrar `useLibrary.subscribe((s, prev) => …)`: si `s.tracks !== prev.tracks`, calcular ids que estaban en `prev.tracks` y ya no están; si alguno está en `currentId/context/queue`, llamar a `forgetTracks`.
  4. Evitar doble salto: en el listener `error` del `<audio>`, guardar `audio.currentSrc` al fallar y, dentro del `setTimeout` de 1200 ms, no avanzar si `audio.currentSrc` ya cambió.
  5. `player.ts` debe seguir por debajo de 800 líneas; funciones < 50 líneas.
- TDD: sí (la parte pura)
- Criterios de aceptación:
  - [ ] Tests de `withoutTracks` en verde.
  - [ ] Manual: sonando una canción con más en la cola, borrarla desde su menú → empieza la siguiente (primero la cola «A continuación», luego la lista) sin cerrar el reproductor.
  - [ ] Si era la última y repetir está apagado, el reproductor se para sin errores en consola.
  - [ ] No se salta una canción de más (el error del audio borrado no provoca un segundo salto).
- Verificación: `npm run check`; manual con `npm run dev` (biblioteca «Este dispositivo», importar 3 canciones, reproducir y borrar la que suena).

### T3 · Vista previa de playlists de YouTube (panel vacío y tope de 100) · Grupo A · Estado: HECHA (falta prueba de navegador y en el móvil)

- Archivos (exclusivos): `packages/shared/src/youtube.ts`, `packages/shared/test/youtube.test.ts`, `packages/shared/test/fixtures/` (nuevos), `apps/web/src/native/downloader.ts`, `apps/web/test/fake-native/downloader.ts`, `apps/web/src/views/DownloadView.tsx`, `apps/web/src/styles.css`, `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`
- Leer como contexto: `apps/web/test/browser/v5_fakenative.py`, `apps/web/test/browser/README.md`
- Hechos de partida (capturas de Andoni): «EUSKAL MUSIKA 2026» (168 canciones) → panel entero gris, sin filas, y botón «Descargar 100 canciones». Otra de 40 → la lista sí se ve. Así que hay dos fallos: (1) la lista no se ve con muchas filas; (2) solo se leen 100.
- Qué hacer:
  1. **Panel vacío (CSS, causa casi segura):** `.dl-entries` es `display:flex; flex-direction:column; max-height:40vh; overflow-y:auto` y cada fila tiene `.ellipsis` (`overflow:hidden`) → su altura mínima automática es 0 y las 100 filas se encogen hasta no verse. Añadir `.dl-entries > * { flex-shrink: 0; }` (o pasar `.dl-entries` a `display:block` con margen entre filas). Comprobar también que `.dl-entries` no se encoge dentro de `.dl-sheet` (columna flex con `max-height: 82vh`): darle `flex-shrink: 0` o `min-height` razonable.
  2. **Tope de 100 (no es intencionado; `MAX_PAGES = 20` permite 2 000):** es el tamaño de la primera página. Capturar con red, desde un script en el scratchpad (no en el repo), la página 1 y la 2 de una playlist pública de más de 100 vídeos usando `buildBrowseRequest` (si es posible, la propia «EUSKAL MUSIKA 2026»; buscarla con `buildSearchRequest(..., 'playlists')`). Guardar versiones recortadas en `packages/shared/test/fixtures/` (pocas entradas, pero con la estructura real de continuación). Corregir `parsePlaylistPage`:
     - el token debe salir del `continuationItemRenderer` que está **al final de la lista de vídeos** (`continuationEndpoint.continuationCommand.token`), no del primer `continuationCommand` del árbol (puede ser de otra sección);
     - las respuestas de continuación (`onResponseReceivedActions[].appendContinuationItemsAction.continuationItems`) deben dar entradas (tanto `playlistVideoRenderer` como `lockupViewModel`);
     - añadir `totalCount` (contrato) leyendo el número de vídeos de la cabecera (`playlistHeaderRenderer.numVideosText` / `stats`, o los `metadataRows` de `pageHeaderViewModel`); `null` si no aparece.
       Si sin red no se puede capturar, construir los fixtures a mano con esa estructura y dejarlo anotado en el resumen de la tarea.
  3. `listPlaylistOnPhone`: si tras paginar hay menos entradas que `totalCount`, probar el respaldo de yt-dlp (`Downloader.list`) y quedarse con la lista más larga (manteniendo el orden de YouTube); devolver `totalCount` y `complete` (contrato). No cortar en silencio. Actualizar el falso `apps/web/test/fake-native/downloader.ts` para devolver los campos nuevos (y una playlist falsa de más de 100 para probar el panel).
  4. Miniatura (fallo secundario): en `parseSearchResponse`, para `lockupViewModel` tomar el primer `image` con `sources` no vacío; si una playlist no tiene, usar `https://i.ytimg.com/vi/<videoId>/hqdefault.jpg` del primer `watchEndpoint.videoId` del lockup. Álbumes (`contentId` tipo `MPRE…`): usar el `playlistId` (`OLAK5uy…`) de `watchEndpoint`/`watchPlaylistEndpoint`; si no hay, descartar el resultado.
  5. `PlaylistSheet` — el panel nunca queda vacío; estados exactos:
     - cargando: texto de carga existente (y `dl.playlistLoadingMore` si ya hay entradas y falta el respaldo);
     - error: mensaje existente;
     - lista vacía sin error: `dl.playlistEmpty`;
     - lista incompleta (`complete === false`): mostrar las filas y `dl.playlistPartial`; el botón descarga las leídas;
     - miniatura vacía o rota (`onError`): la del primer vídeo listado o un icono `ListMusic` centrado;
     - tope total de 30 s para la vía InnerTube (el respaldo yt-dlp mantiene sus 120 s), al vencer `dl.playlistSlow`.
  6. i18n: añadir `dl.playlistPartial` y `dl.playlistLoadingMore` en es/en/eu (este grupo, solo T3 toca i18n).
- TDD: sí (parser y `listPlaylistOnPhone` con fixtures); el CSS se comprueba en navegador.
- Criterios de aceptación:
  - [ ] Test: con los fixtures de página 1 + página 2, `parsePlaylistPage` devuelve el token correcto de la página 1, las entradas de la página 2 y `totalCount`.
  - [ ] Test: si la paginación da menos que `totalCount` y el respaldo da más, se usa el respaldo; si ninguno llega, `complete: false`.
  - [ ] Tests de miniatura y de álbum (`OLAK5uy…`) en verde.
  - [ ] En navegador (fakenative, playlist falsa de 150): se ven todas las filas con desplazamiento dentro del panel y el botón dice «Descargar 150 canciones».
  - [ ] `apps/web/test/browser/v5_fakenative.py` sigue pasando (ampliarlo con el caso de 150 si es sencillo).
  - [ ] Informe al final de la tarea: confirmar si la causa del panel gris era el CSS y qué rompía la página 2.
- Verificación: `npm run check`; `npx vite build --mode fakenative -w @aske/web` + test de navegador; manual en el móvil con «EUSKAL MUSIKA 2026» (deben salir 168).

### T4 · Android: descargas con la app en segundo plano · Grupo A · Estado: HECHA (falta prueba manual en el móvil)

- Archivos (exclusivos): `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/DownloaderPlugin.java`, `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/MainActivity.java`, `docs/android.md`
- Leer como contexto: `.../DownloadService.java`, `.../AskeNativePlugin.java` (`keepAwake`), `node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/Bridge.java` y `BridgeActivity.java` (ver si pausan el WebView en `onPause/onStop`)
- Qué hacer:
  1. En `setNotification`: con `active=true` (API ≥ 26), en el hilo principal, `getBridge().getWebView().setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)`; con `active=false`, volver a `(RENDERER_PRIORITY_IMPORTANT, true)` (el valor por defecto). Comentario en inglés con el porqué (el renderer oculto se rebaja y Android lo congela/mata).
  2. Si `Bridge`/`BridgeActivity` llaman a `webView.onPause()` o `pauseTimers()`, en `MainActivity.onPause/onStop` (después de `super`) deshacerlo solo si `DownloadService.running`. Si no lo llaman, no tocar `MainActivity`.
  3. Si `startForegroundService` falla desde segundo plano, registrar el motivo con `Log.w` (hoy se traga en silencio).
  4. Añadir a `docs/android.md` una sección corta «Descargas en segundo plano» con el porqué.
- TDD: no (nativo, se comprueba en el móvil)
- Criterios de aceptación:
  - [ ] `npm run android:apk` compila.
  - [ ] Manual en el móvil: encolar 10 canciones, salir al inicio sin música sonando y apagar la pantalla 5 min → al volver han avanzado (la notificación también).
- Verificación: `npm run android:apk` + prueba manual descrita.

### T5 · Podar marcas de borrado de `library.json` · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/storage/drive/doc.ts`, `apps/web/test/driveDoc.test.ts`
- Qué hacer: exportar `pruneDeleted(deleted: Record<string, number>, now: number, maxAgeMs = 180 * 24 * 3600 * 1000)` que quita las marcas más antiguas que `maxAgeMs`; `mergeDocs(a, b, now = Date.now())` la aplica al resultado **después** de filtrar tracks/playlists/emisoras (para que lo borrado recientemente siga sin volver). Comentario en inglés con el riesgo asumido.
- TDD: sí
- Criterios de aceptación:
  - [ ] Marca de hace 200 días desaparece; de hace 10 días se mantiene.
  - [ ] Los tests existentes de `driveDoc.test.ts` siguen en verde.
- Verificación: `npm test -w @aske/web`

### T6 · Integrar tandas y playlists completas en la cola de descargas · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/downloads.ts`, `apps/web/src/views/DownloadView.tsx` (después de T3), `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/src/help/articles.ts`
- Leer como contexto: `apps/web/src/downloads/batch.ts` (T1), `apps/web/src/stores/library.ts` (`addToPlaylist`, `reorderPlaylist`, `createPlaylist`), `apps/web/src/stores/send.ts`
- Qué hacer: 0. **Nombre repetido (decisión de Andoni: preguntar).** En `PlaylistSheet`, si la casilla «Crear la playlist» está marcada y ya existe una playlist con ese nombre (sin distinguir mayúsculas ni espacios), mostrar `dl.playlistExists` con dos opciones de radio: `dl.playlistMerge` (marcada por defecto) y `dl.playlistNew` con el nombre que saldría (`uniquePlaylistName(nombre, nombresExistentes, LIMITS.nameMax)`). Pasar la elección a `enqueue` como `playlistMode`. `LinkCard`: los enlaces de playlist dejan de encolar directamente y abren `PlaylistSheet` (construir un `SearchResult` mínimo con `kind: 'playlist'`, la URL, título vacío y miniatura vacía), así la pregunta sale en los dos caminos. `enqueueUrl` (usado por «Enviar al móvil», `send.ts`) pasa `'new'`: con nombre repetido crea siempre «Nombre (n)».
  1. `enqueue`: generar un `batchId` por llamada (`b${Date.now().toString(36)}`) y ponerlo en cada job nuevo. Con `playlistName`: recortar la lista a `LIMITS.playlistMaxTracks`; si `playlistMode === 'new'` y el nombre existe, crear la playlist con `uniquePlaylistName(...)`; si `'merge'` (por defecto), usar la existente o crearla; guardar `PlaylistImport { playlistId, videoIds }` (todas, en orden de YouTube) en `downloads-imports-v1`, y llamar a `syncImport(playlistId)` al final.
  2. Canciones ya en la biblioteca (`findInLibrary`): crear el job directamente como `skipped` (con `trackId`, `finishedAt`) en vez de `queued`. Las que ya están en cola activa por otra playlist no se duplican, pero cuentan para esta importación vía `PlaylistImport`. Si hubo saltadas, toast `dl.alreadyHad` (con `.one`). Si hay `sendId` y no queda nada activo de ese envío, llamar a `reportSend`.
  3. `syncImport(playlistId)` (función interna < 50 líneas): `arrangeImportedPlaylist(videoIds, playlist.trackIds, (v) => findInLibrary(v)?.id, LIMITS.playlistMaxTracks)`; añadir con `addToPlaylist(id, faltan, true)` y, si el orden difiere, `reorderPlaylist(id, deseado)`. Si la playlist ya no existe, borrar la importación.
  4. En `process`: tras `done` o `skipped`, llamar a `syncImport` para **cada** importación cuyo `videoIds` contenga el `videoId` (en vez del `addToPlaylist` directo actual con `job.playlistId`). Al quedar sin jobs activos de una importación, quitarla de la pref.
  5. `notify()`: usar `notificationCounts(get().jobs)` para el título; `retry`/`retryFailed`: asignar `batchId: batchForRetry(get().jobs, Date.now())`.
  6. Arrancar el servicio en primer plano al encolar: al final de `enqueue` (con jobs nuevos) llamar a `notify()` **antes** de `run()`, para que Android lo permita con la app visible.
  7. i18n: claves de T6 del contrato (`dl.alreadyHad`, `dl.alreadyHad.one`, `dl.playlistExists`, `dl.playlistMerge`, `dl.playlistNew`) en es/en/eu. Revisar el artículo de ayuda de descargas/playlists en `help/articles.ts` y añadir una frase en los 3 idiomas: «Si ya tenías alguna canción, no se descarga otra vez, pero sí aparece en la playlist, en el mismo orden que en YouTube».
  8. `downloads.ts` < 800 líneas, funciones < 50.
- TDD: no (la lógica está probada en T1); los tests de paridad i18n y de ayuda deben pasar.
- Criterios de aceptación:
  - [ ] Importar una playlist de 30 con 19 ya en la biblioteca: la playlist acaba con las 30 en el orden de YouTube; solo se descargan 11; la notificación va «1 de 11 … 11 de 11».
  - [ ] Importar dos playlists que comparten canción mientras la primera sigue en cola: la canción acaba en las dos y se descarga una vez.
  - [ ] Reintentar un fallo antiguo muestra «Descargando 1 de 1», no «20 de 30».
  - [ ] Importar una playlist cuyo nombre ya existe pregunta; «Crear otra» da «Nombre (1)», la siguiente vez «Nombre (2)» (sin repetir números); «Juntarlas» no crea ninguna nueva.
  - [ ] Pegar un enlace de playlist abre la misma vista previa (con la pregunta si hace falta).
  - [ ] «Enviar al móvil» de una playlist con nombre repetido crea «Nombre (n)» sin preguntar.
  - [ ] `npm run check` en verde (paridad i18n incluida).
- Verificación: `npm run check`; manual en fakenative (`npx vite build --mode fakenative -w @aske/web`) o en el móvil.

### T7 · Temporizador de apagado · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/sleepTimer.ts` (nuevo), `apps/web/test/sleepTimer.test.ts` (nuevo), `apps/web/src/components/player/NowPlaying.tsx`, `apps/web/src/components/SleepTimerSheet.tsx` (nuevo), `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/src/help/articles.ts`
- Leer como contexto: `apps/web/src/stores/player.ts` (`pause`, `setVolume`, `currentId`), `apps/web/src/components/AddToPlaylistSheet.tsx` (estilo de hoja), `apps/web/src/components/player/Controls.tsx`
- Qué hacer:
  1. Store según contrato. Minutos: comprobar cada segundo con `setInterval` comparando con `endsAt` (no un único `setTimeout` largo, que Android retrasa en segundo plano). En los últimos 20 s bajar el volumen poco a poco; al llegar: `usePlayer.getState().pause()`, restaurar el volumen anterior, toast `sleep.stopped`, limpiar. `endOfTrack`: suscribirse a `usePlayer` y pausar cuando cambie `currentId` o termine la canción (si no hay siguiente). `cancel` restaura el volumen. Pasar a radio también cuenta (solo minutos; `endOfTrack` no aplica a radio: ocultarlo).
  2. Extraer la lógica de tiempo en una función pura exportada `sleepVolumeFactor(now, endsAt, fadeMs = 20000): number` (1 → 0) y probarla.
  3. UI: botón con icono `Moon` (lucide) en `NowPlaying.tsx` que abre `SleepTimerSheet`: los presets `SLEEP_PRESETS_MIN` (15, 30, 45 min, 1 h, 1 h 30, 2 h, 3 h, 4 h; mostrar con `sleep.minutes`/`sleep.hours`), «Al acabar la canción» y «Otro tiempo» (`sleep.custom`): dos selectores sencillos de horas (0–8) y minutos (0, 5, 10 … 55), máximo 8 h (`sleep.customHint`), botón deshabilitado si suma 0. Si hay uno activo, muestra `sleep.remaining` (formato «1 h 20 min» / «12 min» / «45 s» en el último minuto) y `sleep.cancel`. El icono se ve en ámbar mientras está activo.
     3b. Sesiones largas: guardar `endsAt` en `savePref('sleep-timer', …)` y recuperarlo al abrir la app (si ya pasó, no hacer nada), para que un temporizador de 3 h sobreviva a que Android recargue la app.
  4. i18n en los 3 idiomas (claves del contrato) y un artículo corto de ayuda «Temporizador para dormir» en `help/articles.ts` (3 idiomas, enlaces válidos).
- TDD: sí (`sleepVolumeFactor` y el paso de estados del store con temporizadores falsos de Vitest)
- Criterios de aceptación:
  - [ ] Test: `start({ minutes: 600 })` se ajusta a 480; `{ minutes: 0 }` a 1.
  - [ ] Con «Otro tiempo» de 2 min (prueba manual), la música baja el volumen al final y se para; el volumen vuelve a su valor.
  - [ ] Con «Al acabar la canción», se para al terminar la actual.
  - [ ] Cancelar deja todo como estaba.
  - [ ] `npm run check` en verde.
- Verificación: `npm run check`; manual con `npm run dev`.

## Fases siguientes (no son tareas de este plan; se planificarán después)

- **Fase 5.2 · Cierre de la fase 5:** copiar música en cualquier dirección (generalizar `stores/copyToDrive.ts` a «origen → destino» con adaptadores por almacenamiento; hoy `api/client.ts` solo apunta a un Cloudflare a la vez, habrá que crear un cliente por conexión) y meter en CI los tests de navegador. **Decidido:** todas las direcciones (dispositivo, Drive y Cloudflare entre sí), ofrecida al cambiar de almacenamiento («de donde estaba a donde estoy ahora»), reanudable y sin borrar nada. Si el arreglo ligero de T4 no basta, aquí entra también la cola de descargas nativa.
- **Fase 5.3 · Organizar playlists:** ordenar (nombre, reciente, manual), carpetas **de un solo nivel** (decidido), portada propia y **juntar playlists** (especificación abajo). Toca D1 (migración: `folder_id`, `cover_key` en playlists y tabla `playlist_folders`), `library.json` de Drive e IndexedDB. Juntar va aquí porque vive en la misma pantalla de gestión de playlists y comparte el menú «…» con carpetas y portada; no necesita cambios de esquema.

### Tarea futura (Fase 5.3) · Juntar dos playlists · Estado: PLANIFICADA (no se ejecuta en este plan)

- Archivos previstos: `apps/web/src/library/mergePlaylists.ts` (nuevo, puro) + test, `apps/web/src/stores/library.ts` (acción `mergePlaylists`), `apps/web/src/components/MergePlaylistsSheet.tsx` (nuevo), `apps/web/src/views/PlaylistsView.tsx`/`PlaylistView.tsx` (entrada en el menú «…»), i18n es/en/eu y un artículo de ayuda.
- Contrato puro:
  ```ts
  /** Canciones de `target` en su orden y después las de `source` que no estén ya, en su orden. */
  export function mergeTrackLists(
    target: readonly string[],
    source: readonly string[],
    max: number,
  ): { trackIds: string[]; added: number; duplicates: number; overflow: number };
  ```
- Comportamiento:
  - Flujo: menú «…» de una playlist → «Juntar con otra playlist…» → elegir la otra de una lista (buscador). La playlist desde la que empiezas es la **principal** (la que se queda); la otra es la **que se une**.
  - **Nombre:** el de la principal, editable en la hoja antes de confirmar (campo con el nombre ya puesto). Si el nombre escrito coincide con otra playlist distinta, se aplica `uniquePlaylistName`.
  - **Orden:** primero las canciones de la principal en su orden; después las de la otra que no estaban, en su orden. Ninguna canción sale dos veces (se comparan por id de canción).
  - **Portada y carpeta (cuando existan en 5.3):** se quedan las de la principal.
  - **Límite de 1000:** si el resultado pasaría de 1000, no se junta nada y se explica cuántas no caben («Juntas tendrían 1 120 canciones y el máximo es 1 000. Quita 120 o elige otra»).
  - **Playlist sobrante:** casilla «Borrar «{otra}» después de juntar», **marcada por defecto** (como borrar la rama tras fusionarla). Si se desmarca, se queda tal cual.
  - Resumen antes de confirmar: «Se añadirán {added} canciones a «{nombre}» ({duplicates} ya estaban)».
  - Implementación: `addToPlaylist(principal, nuevas, true)` + `renamePlaylist` si cambió + `deletePlaylist(otra)` si está marcada; optimista y revierte si falla (convención de `stores/library.ts`). Si la otra tenía una importación de YouTube pendiente (`downloads-imports-v1`), su `playlistId` pasa a ser el de la principal.
- TDD: sí (`mergeTrackLists`: orden, sin duplicados, recuentos, desbordamiento).
- **Fase 8 (ampliada) · Estadísticas:** 8a estadísticas privadas guardadas en tu propio almacenamiento + Recap anual (no salen del usuario, no necesitan el consentimiento de telemetría); 8b grupos de amigos **a través del Hub** (decidido), con rankings («el que más escucha», «el que más descarga»…) y eligiendo en cada grupo qué métricas compartes (consentimiento explícito y borrado, RGPD); 8c la telemetría anónima y el panel ya previstos. Depende de la fase 7 (Hub).
- **Fase 9 (nueva) · Modo estudio (solo Android). Decidido:** usa «fijar app» de Android (`startLockTask()` sin ser propietario del dispositivo: Android pide confirmación la primera vez y avisa de cómo salir; no es un bloqueo total) + una pantalla propia muy simple: canción actual, anterior/siguiente, pausa y un menú mínimo para elegir una playlist o «Todas las canciones». Duración configurable; durante ese tiempo solo se sale manteniendo pulsado un botón 45 s (con anillo de progreso que se reinicia si sueltas).
  **Al acabar el tiempo (decisión C):** el modo **no** se desbloquea solo.
  1. La música sigue; suena un aviso corto y suave (campanilla de ~1 s; la música baja un momento de volumen mientras suena y luego vuelve) y vibra una vez.
  2. En la pantalla de concentración aparece una tarjeta discreta «Tiempo cumplido · {duración}» con dos botones: **«Terminar»** (sale al momento, ya sin los 45 s, y quita el «fijar app») y **«Seguir {n} min»** (amplía con la misma duración de la sesión; también «+15 min»).
  3. Si no tocas nada, el modo sigue igual y el aviso se repite cada 10 min, como mucho 3 veces; después solo queda la tarjeta, en silencio.
  4. Antes de que acabe el tiempo, la única salida de la app sigue siendo el botón de 45 s; una vez cumplido, basta con «Terminar».

## Decisiones de Andoni (18-11-2026)

1. Modo estudio: «fijar app» + pantalla propia muy simple (cambiar canción, menú mínimo de playlist o «Todas las canciones»), salida con botón de 45 s, duración configurable → Fase 9.
2. Copia de música en todas las direcciones al cambiar de almacenamiento → Fase 5.2.
3. Descargas en segundo plano: arreglo ligero ahora (T4).
4. Notificación: «1 de 11» (solo las que hay que bajar) y aviso de cuántas ya tenía (T1 + T6).
5. Nombre repetido al importar: preguntar «Juntar» / «Crear otra»; la nueva se llama «Nombre (1)», «(2)»… sin repetir números (T1 + T6).
6. Temporizador: presets de 15 min a 4 h + tiempo a medida hasta 8 h + «al acabar la canción», con bajada suave (T7).
7. Carpetas de playlists de un solo nivel → Fase 5.3.
8. Grupos de amigos a través del Hub, eligiendo qué se comparte en cada grupo → Fase 8b.
9. Vista previa: capturas recibidas; el panel entero sale vacío con la playlist de 168 y solo se leen 100 → T3 reescrita (causa CSS identificada + paginación).
10. (A) «Enviar al móvil» con nombre repetido: crear siempre «Nombre (n)» (T6). Nueva función «Juntar playlists» → Fase 5.3 (especificada arriba).
11. (B) Playlists grandes: enseñar las leídas y leer el resto con yt-dlp con «Cargando el resto…» (T3, ya escrita así).
12. (C) Modo estudio al acabar: la música sigue, aviso sonoro suave y tarjeta «Terminar / Seguir»; no se desbloquea solo (Fase 9, especificado arriba).

## Riesgos / dudas abiertas

- **Duda D · Al juntar playlists, ¿qué se hace por defecto con la que se une?**
  - **Borrarla, con la casilla marcada que se puede desmarcar (Recomendada):** como al fusionar ramas en GitHub; no deja dos playlists casi iguales. Inconveniente: si se borra sin querer, no hay deshacer (las canciones siguen en la biblioteca).
  - **Conservarla, casilla desmarcada:** nunca se pierde nada, pero la biblioteca se llena de playlists repetidas.
  - Por qué: «juntar» suele significar «quedarme con una»; la casilla da la salida a quien quiera conservarla. (Es para la fase 5.3; no bloquea este plan.)
- **Sin reproducir aquí:** el bug de playlists incompletas no se ha podido reproducir leyendo el código (el caso «ya en la biblioteca» sí llama a `addToPlaylist`); las causas probables son canciones que estaban en la cola por otra importación (se saltaban sin añadirse) y el orden. T6 cubre ambas; conviene que Andoni lo pruebe con la playlist real.
- Al terminar, el orquestador debe actualizar `docs/ESTADO.md` y la tabla de fases de `docs/v2/architecture.md` (añadir 5.2, 5.3, ampliar 8 y la nueva 9) y preparar `docs/releases/v0.5.1.md`.

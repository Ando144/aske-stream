# PLAN: v0.9.6, arreglar todos los problemas conocidos

Fecha: 2026-11-27 · Estado: COMPLETADO

## Objetivo

Arreglar los fallos de «Problemas conocidos» de `docs/ESTADO.md` y publicar la v0.9.6:
3 visibles (dos avisos al compartir, flechas en `SourcePicker`, título de Biblioteca a 390 px),
4 de datos (cancelar borra solo lo propio, también si la subida acaba tarde; foto sin
`Content-Length` en el hub; fotos pedidas a un hub viejo) y limpieza (partir `stores/library.ts`,
quitar el import circular, `.pyc`, `smoke.mjs` y `gradle.mjs` en Windows).
Fuera de alcance: la verificación de memoria pendiente de la v0.9.3.

## Decisiones de arquitectura

- Cloudflare: cada subida lleva un `uploadId` (= `job.id`) y el Worker guarda una «lápida» al
  cancelar. Así se borra solo la canción creada por esa descarga y una subida que llega tarde se
  descarta sola, sin barridos por vídeo — el barrido actual compara por `videoId` y puede borrar
  lo de otro aparato (fallo A) y no ve lo que llega después de 60 s (fallo B).
- La lápida y el `INSERT` van en `db.batch` (transacción de D1): o la canción se inserta antes y
  la cancelación la borra, o la lápida llega antes y el `INSERT` no ocurre. Sin carreras.
- Worker viejo (sin el endpoint): no se borra nada (nunca tocar lo ajeno) y se marca el servidor
  como desactualizado (`useServerUpdate.markOutdated()`), que ya invita a actualizarlo. El Worker
  viejo ignora el campo `uploadId` (zod quita las claves desconocidas): subir sigue funcionando.
- Las cancelaciones que no llegan al Worker (sin internet) se guardan en `localStorage` y se
  reintentan al abrir la app y al volver internet, durante 30 días.
- Drive: se elimina el barrido. La ficha de la biblioteca la escribe el propio móvil y solo si
  no se canceló; si se escribió, `discardSaved` borra exactamente esa id. Para el archivo de audio
  que Google pudo completar tras cancelar, se cancela la sesión de subida (DELETE) y, si ya estaba
  completa, se borra ese archivo concreto.
- Al quitar el barrido, `downloads/cancel.ts` ya no necesita `stores/downloads` y desaparece el
  import circular. Se borra `downloads/orphans.ts`.
- `stores/library.ts` se parte en módulos con fábricas de acciones; la ruta pública
  (`useLibrary`, `useAllTracks`) no cambia, para no tocar a los que la usan ni los `vi.mock`.
- Al compartir un vídeo se queda solo el aviso de la hoja: `enqueue` gana la opción `quiet`.
- Flechas en `SourcePicker`: patrón ARIA de radio (tabindex móvil, la flecha mueve el foco y
  elige), con una función pura nueva en `lib/radioKeys.ts`.
- Migración: SÍ, `apps/api/migrations/0008_upload_cancels.sql`. El hub cambia código pero no
  tiene migración.

## Contratos (interfaces compartidas)

### Base de datos (API, migración 0008)

```sql
ALTER TABLE tracks ADD COLUMN upload_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tracks_upload_id ON tracks(upload_id);
CREATE TABLE IF NOT EXISTS canceled_uploads (
  upload_id   TEXT PRIMARY KEY,
  canceled_at INTEGER NOT NULL
);
```

### API (Worker `apps/api`)

- `POST /api/ingest/tracks`: el JSON `meta` acepta `uploadId?: string`, validado con
  `/^[A-Za-z0-9_-]{1,100}$/`, opcional (sin él = `null`, la CLI y la copia no cambian). Se guarda
  en `tracks.upload_id`. No se devuelve en `Track`.
  El `INSERT` pasa a `INSERT INTO tracks (...) SELECT ... WHERE NOT EXISTS (SELECT 1 FROM
canceled_uploads WHERE upload_id = ?)` con `RETURNING *`. Si no vuelve ninguna fila: se borran
  los objetos de R2 y se responde **410** `{ error: 'upload_canceled' }`.
- `DELETE /api/ingest/uploads/:uploadId` (misma autenticación que el resto de `/api`). En un
  `db.batch`:
  1. `INSERT OR IGNORE INTO canceled_uploads VALUES (?, now)`;
  2. `DELETE FROM tracks WHERE upload_id = ? RETURNING id`;
  3. `DELETE FROM canceled_uploads WHERE canceled_at < now - 30 días`;
  4. `bumpVersion`.

  Después borra de R2 el audio y la portada de cada id borrada. Responde **200**
  `{ deletedIds: string[] }`. Un `uploadId` inválido da 400 `validation_error`.

- Worker viejo: responde 404 `{ error: 'not_found', message: 'Unknown endpoint' }`.

### Cliente web

- `apps/web/src/api/client.ts`:
  `cancelUpload(uploadId: string): Promise<{ deletedIds: string[] }>`, que hace
  `DELETE /api/ingest/uploads/${encodeURIComponent(uploadId)}`.
- `apps/web/src/downloads/uploadCancels.ts`:
  - `cancelCloudUpload(uploadId: string): Promise<void>`: apunta la cancelación pendiente, la
    intenta ya y, si falla, la reintenta a los 5 s y a los 60 s.
  - `retryPendingCancels(): Promise<void>`: reintenta todas las pendientes.
  - Clave de `localStorage`: `aske.uploadCancels.v1`, con `{ id: string; at: number }[]`.
- `apps/web/src/downloads/jobsStore.ts`: las opciones de `enqueue` ganan `quiet?: boolean`
  (sin el aviso `dl.queued`).
- `apps/web/src/lib/radioKeys.ts`:
  `nextRadioIndex(key: string, index: number, count: number): number | null`.
  `ArrowDown` y `ArrowRight` suman 1, `ArrowUp` y `ArrowLeft` restan 1 (las dos dan la vuelta);
  `Home` da 0 y `End` da `count - 1`. Cualquier otra tecla, o `count <= 0`, da `null`.

### Estado de la biblioteca (partición de `stores/library.ts`)

- `stores/library.ts` sigue exportando `useLibrary`, `useAllTracks` y `type LibraryState`.
- Módulos nuevos (todos en `apps/web/src/stores/`):
  - `libraryState.ts`: `LibraryState` y `LibraryCtx`, que contiene
    `{ get, set, mutate, replacePlaylist, isExtra, storeFor, forPlaylist, reload }`;
  - `libraryCache.ts`: `cacheKey`, `homeKind`, `extrasStore`, `readExtras`,
    `fromSnapshotWithExtras`, `persist`;
  - `libraryErrors.ts`: `reportError(err, reload)`, `reportPinError` e `isStorageFull`;
  - `libraryTrackActions.ts`: `createTrackActions(ctx)`, con `upsertTracks`, likes, kind, album,
    `deleteTrack` y `reorderPlaylist`;
  - `libraryPlaylistActions.ts`: `createPlaylistActions(ctx)`, con
    create/rename/delete/add/remove, pin, order, merge y cover;
  - `libraryFolderActions.ts`: `createFolderActions(ctx)`, con
    create/rename/delete/move/reorder y `setFolderPinned`.

## Tareas

Reglas para todas:

- Commits en español, Conventional Commits, autor
  `Andoni Ortiz de Zarate Urruela <Ando144@users.noreply.github.com>`, sin ninguna mención a
  Claude ni a la IA.
- **Nunca `npm install`.** Nada de push, tag ni despliegues: eso lo hace el orquestador.
- Tests sueltos con `npx vitest run <archivo> --root apps/<app>`, nunca en modo watch.
- Textos nuevos en es, en y eu.

### T1 · API: cancelar una subida por `uploadId` · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/api/migrations/0008_upload_cancels.sql` (nuevo),
  `apps/api/src/routes/ingest.ts`, `apps/api/src/lib/uploads.ts` (nuevo, si hace falta para que
  `ingest.ts` no pase de 300 líneas), `apps/api/test/uploads.test.ts` (nuevo), `scripts/smoke.mjs`
  (solo añadir un `step`).
- Leer como contexto: `apps/api/src/routes/tracks.ts` (cómo se borra una canción y R2),
  `apps/api/src/lib/db.ts`, `apps/api/src/lib/http.ts`.
- Qué hacer:
  - escribir la migración y los dos cambios de «Contratos > API»;
  - extraer el esquema `Metadata` y el validador de `uploadId` a algo exportable y probarlo con
    tests unitarios (las pruebas de la API no tienen D1: lo que necesita base de datos se prueba
    en el smoke);
  - en `scripts/smoke.mjs`, añadir un `step` «canceled uploads: delete own track, block late
    arrival» antes de «storage stats»:
    - subir con `uploadId: 'smoke-up-1'` y comprobar 201;
    - hacer `DELETE /api/ingest/uploads/smoke-up-1` y comprobar 200 con `deletedIds` = [esa id];
    - comprobar que `/api/library` ya no la tiene;
    - subir otra vez con el mismo `uploadId` y comprobar 410 `upload_canceled`;
    - subir con `uploadId` distinto y el mismo `sourceRef` que otra canción existente: 409,
      sin tocar la existente;
    - cancelar un `uploadId` que no existe: 200 con `deletedIds: []`, y la otra canción sigue.

    Cuidado con el límite de 2 MB del smoke: usar audios pequeños y borrar lo que sobre.
- TDD: sí (validación de `meta`/`uploadId`; el comportamiento con D1, en el smoke).
- Criterios de aceptación:
  - [ ] `uploadId` válido o ausente se acepta; con espacios, `/` o más de 100 caracteres, 400;
  - [ ] cancelar borra solo la canción con ese `upload_id` (y su R2) y nunca otra del mismo vídeo;
  - [ ] una subida que llega después de cancelar responde 410 y no deja nada en D1 ni en R2;
  - [ ] el smoke pasa entero.
- Verificación:
  - `npx vitest run test/uploads.test.ts --root apps/api`;
  - `npm run db:migrate:local`;
  - `npm run build -w @aske/web` y luego `npm run test:e2e`. En Windows sale con código 1 por el
    EPERM conocido (lo arregla T6): vale si dice que pasan todas las comprobaciones. Al acabar,
    cerrar wrangler/workerd.
- Commit: `feat: permite cancelar una subida a Cloudflare sin tocar otras canciones`.

### T2 · Hub: foto sin `Content-Length` y fotos de un hub viejo · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/hub/src/groups/lookRoutes.ts`, `apps/hub/test/groupLook.test.ts`,
  `apps/web/src/groups/photoCache.ts`, `apps/web/test/photoCache.test.ts` (nuevo).
- Leer como contexto: `packages/shared/src/groups*` (`GROUP_LIMITS.photoMaxBytes`),
  `apps/web/src/hub/groupsClient.ts`.
- Qué hacer:
  1. En `readPhoto`, leer `req.body` por trozos con un lector y sumar bytes. En cuanto pase de
     `photoMaxBytes`: `reader.cancel()` y lanzar `photoTooBig()`. Sin cuerpo: `notJpeg()`. Se
     mantiene la comprobación previa del `Content-Length` si viene. Nunca usar
     `req.arrayBuffer()` sin límite.
  2. En `photoCache.ts`, un `photoAt` que no sea número (un hub viejo no manda el campo, llega
     `undefined`) cuenta como `null`: no se pide nada. Normalizarlo al principio de
     `loadGroupPhoto` y de `useGroupPhotoUrl`.
- TDD: sí.
- Criterios de aceptación:
  - [ ] hub: una foto de más de `photoMaxBytes` enviada como stream sin `Content-Length` da 413
        sin leerla entera; una válida sin `Content-Length` se guarda;
  - [ ] web: `loadGroupPhoto({ groupId: 'g', photoAt: undefined as never })` devuelve `null` sin
        llamar a `fetchGroupPhoto` (mock);
  - [ ] web: con `photoAt` numérico se descarga como antes.
- Verificación:
  - `npx vitest run test/groupLook.test.ts --root apps/hub`;
  - `npx vitest run test/photoCache.test.ts --root apps/web`.
- Commits:
  - `fix: limita la foto del grupo aunque no traiga Content-Length`;
  - `fix: no pide fotos de grupo a un hub antiguo`.

### T3 · Partir `stores/library.ts` · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/library.ts`, `apps/web/src/stores/libraryState.ts`,
  `apps/web/src/stores/libraryCache.ts`, `apps/web/src/stores/libraryErrors.ts`,
  `apps/web/src/stores/libraryTrackActions.ts`, `apps/web/src/stores/libraryPlaylistActions.ts`,
  `apps/web/src/stores/libraryFolderActions.ts` (todos nuevos salvo el primero).
- Leer como contexto: `apps/web/test/` (buscar con Grep `stores/library` para ver qué mockean los
  tests y no romperlos).
- Qué hacer:
  - refactor sin cambiar comportamiento, según «Contratos > Estado de la biblioteca»;
  - `create((set, get) => ({ ...base, ...createTrackActions(ctx), ...createPlaylistActions(ctx),
...createFolderActions(ctx) }))`;
  - `reportError` recibe `reload` en vez de llamar a `useLibrary`, para que no haya imports
    circulares;
  - de paso, mover el `import` de `./setup` que hoy está debajo de `LOAD_TIMEOUT_MS` al bloque de
    imports.
- TDD: no (refactor; lo cubren los tests que ya hay).
- Criterios de aceptación:
  - [ ] ningún archivo pasa de 300 líneas, ninguna función de 50 ni de 4 niveles de anidación;
  - [ ] la API pública de `useLibrary` es idéntica (mismo `LibraryState`) y compila sin tocar a
        los que la usan;
  - [ ] ningún import circular entre los módulos nuevos;
  - [ ] todos los tests de `apps/web` pasan sin cambiarlos.
- Verificación: `npm run check`.
- Commit: `refactor: parte el estado de la biblioteca en módulos más pequeños`.

### T4 · Fallos visibles: un solo aviso al compartir, flechas y título · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/share/ShareInSheet.tsx`,
  `apps/web/src/stores/downloads.ts` (solo `enqueue`), `apps/web/src/downloads/jobsStore.ts`
  (solo el tipo de las opciones), `apps/web/src/components/study/SourcePicker.tsx`,
  `apps/web/src/lib/radioKeys.ts` (nuevo), `apps/web/test/radioKeys.test.ts` (nuevo),
  `apps/web/src/views/LibraryView.tsx`, `apps/web/src/styles.css`,
  `apps/web/test/browser/v10_096.py` (nuevo).
- Leer como contexto: `apps/web/src/lib/menuKeys.ts` (estilo), `apps/web/test/browser/README.md`,
  `apps/web/test/browser/v9_095.py` (cómo se escriben estas pruebas).
- Qué hacer:
  1. **Compartir.**
     - `enqueue(items, { quiet: true })` no muestra `dl.queued`.
     - `ShareInSheet` llama con `quiet: true` y muestra `shareIn.added` solo si `enqueue`
       devuelve más de 0. Si devuelve 0 (ya estaba en la biblioteca), muestra
       `t('dl.alreadyHad', { count: 1 })`.
     - El resto de llamadas a `enqueue` no cambian.
  2. **`SourcePicker`.** En el `radiogroup` de playlists:
     - tabindex móvil: `tabIndex={0}` en la marcada (o en la primera si no hay ninguna) y `-1` en
       el resto;
     - `onKeyDown` con `nextRadioIndex`: enfoca el botón nuevo (refs) y lo elige con `onPick`;
       `preventDefault` solo si la función no da `null`.
  3. **Título de Biblioteca a 390 px.** En la cabecera, a ≤ 480 px los botones (Estudio,
     Importar, Ajustes) se quedan en solo icono: el texto va en `span.hide-narrow` y el botón
     lleva `aria-label`. «Biblioteca», «Library» y «Liburutegia» se ven enteros, sin «…». Si
     `ImportButton` está en otro archivo y hay que tocarlo, añadirlo a esta tarea (ninguna otra
     tarea lo toca).
  4. **Prueba de navegador** `v10_096.py` según el README:
     - a 390 px, el `h1` no está cortado (`scrollWidth <= clientWidth`) en es, en y eu;
     - en `/study`, las flechas cambian la playlist marcada y el foco;
     - en modo fakenative, al compartir un vídeo sale un solo aviso.

       Si el modo fakenative no permite simular «Compartir», cubrirlo con un test de Vitest de
       `ShareInSheet` (con `enqueue` en mock: se llama con `quiet: true` y hay un solo `toast`) y
       apuntarlo en el informe.
- TDD: sí para `radioKeys` y el aviso único; no para CSS.
- Criterios de aceptación:
  - [ ] `nextRadioIndex` cubre las 6 teclas, la vuelta en los extremos, una tecla desconocida y
        `count` 0;
  - [ ] al compartir un vídeo aparece un único aviso;
  - [ ] Tab entra en el grupo una vez y las flechas recorren las playlists;
  - [ ] título entero a 390 px en los 3 idiomas.
- Verificación:
  - `npx vitest run test/radioKeys.test.ts --root apps/web`;
  - `npm run check`;
  - la prueba de navegador del README (y después reconstruir el dist normal).
- Commits:
  - `fix: muestra un solo aviso al compartir desde YouTube`;
  - `fix: permite elegir la playlist del modo estudio con las flechas`;
  - `fix: muestra entero el título de Biblioteca en pantallas estrechas`;
  - `test: añade las pruebas de navegador de la v0.9.6`.

### T5 · Cancelar borra solo lo propio (Cloudflare y Drive) · Grupo B · Estado: HECHA

- Depende de: T1 (contrato del Worker) y T4 (comparte `stores/downloads.ts`).
- Archivos (exclusivos): `apps/web/src/downloads/cancel.ts`, `apps/web/src/downloads/orphans.ts`
  (borrar), `apps/web/src/downloads/uploadCancels.ts` (nuevo), `apps/web/src/downloads/save.ts`,
  `apps/web/src/api/client.ts`, `apps/web/src/stores/downloads.ts` (solo `init`),
  `apps/web/src/storage/drive/api.ts`, `apps/web/test/downloadOrphans.test.ts` (borrar),
  `apps/web/test/uploadCancels.test.ts` (nuevo), `apps/web/test/downloadCancel.test.ts` (nuevo),
  `apps/web/test/driveUploadAbort.test.ts` (nuevo), `apps/web/test/downloadSave.test.ts`,
  `apps/web/src/help/articles/music.ts`.
- Leer como contexto: `apps/web/src/stores/serverUpdate.ts`, `apps/web/src/storage/homes.ts`
  (`orOutdated`), `apps/web/src/storage/drive/home.ts` (`addTrack`, líneas 288-334),
  `apps/web/test/downloadOrphans.test.ts` (los mocks que ya funcionan, antes de borrarlo).
- Qué hacer:
  1. `save.ts`: en `uploadForm`, añadir `uploadId: job.id` al JSON `meta`.
  2. `client.ts`: `cancelUpload` según el contrato.
  3. `uploadCancels.ts`:
     - lista pendiente en `localStorage` según el contrato;
     - cada intento: si sale bien, se quita de la lista y, si `deletedIds.length`, se llama a
       `useLibrary.getState().load()`;
     - si es un Worker viejo (`ApiError` 404, `not_found`, «Unknown endpoint»): se quita y se
       llama a `useServerUpdate.getState().markOutdated()`;
     - si es otro error: se queda en la lista y se hace `console.error` con el detalle;
     - si la biblioteca ya no está en `cloudflare`, se descarta la pendiente;
     - las de más de 30 días se descartan.
  4. `cancel.ts`:
     - quitar `snapshotKnownIds`, `sweepAfterCancel`, `watchJobs` y el import de
       `../stores/downloads`;
     - si `wasSaving`, `job.target !== 'device-only'` y la biblioteca está en `cloudflare`:
       `void cancelCloudUpload(job.id)`.
  5. `stores/downloads.ts`: en `init`, `void retryPendingCancels()` y un `window` `online` que
     lo vuelva a llamar (registrado una sola vez).
  6. `storage/drive/api.ts`: si el PUT de bytes se cancela con la señal del que llama
     (`opts.signal.aborted`), antes de relanzar el error, sin esperar al que llama
     (`void`, con `console.error` si falla):
     - `DELETE` a la URL de la sesión, que la anula;
     - después `PUT` vacío con `Content-Range: bytes */<size>`;
     - si responde 200/201 con `id`, `driveApi.remove(id)`.

     Así nunca se borra nada que no sea ese archivo.

  7. Ayuda (`music.ts`, en es, en y eu): una frase en «Cancelar o quitar»: «Si tu biblioteca está
     en Cloudflare y la app te pide actualizar el servidor, hazlo para que una canción cancelada
     no se quede guardada».
  8. Borrar `orphans.ts` y su test; pasar los casos que sigan valiendo a `downloadCancel.test.ts`.
- Cambio de contrato (corrección posterior): el `uploadId` ya no es siempre `job.id`.
  `DownloadJob` gana `uploadId?: string`, que `requeuePatch` renueva (`crypto.randomUUID()`) al
  reintentar; al subir (`save.ts`) y al cancelar (`cancel.ts`) se usa `job.uploadId ?? job.id`.
  Motivo: el Worker rechaza con 410 durante 30 días un `uploadId` ya cancelado. Donde esta
  sección y «Decisiones de arquitectura» dicen `job.id`, vale esta regla.
- TDD: sí.
- Criterios de aceptación:
  - [ ] cancelar un guardado en Cloudflare llama a `cancelUpload(job.id)` y nunca a
        `deleteTrack` de otra canción del mismo vídeo;
  - [ ] cancelar en Drive o en el móvil no llama a `cancelUpload` ni recarga la biblioteca;
  - [ ] sin red, la cancelación queda pendiente y se envía al reintentar;
  - [ ] con 404 «Unknown endpoint» se marca el servidor como desactualizado y se olvida la
        pendiente;
  - [ ] con `deletedIds` no vacío se recarga la biblioteca;
  - [ ] Drive: al cancelar el PUT se anula la sesión y, si Google responde con un archivo
        terminado, se borra solo esa id (fetch en mock);
  - [ ] `downloads/cancel.ts` ya no importa `stores/downloads` (comprobar con Grep);
  - [ ] el formulario de subida lleva `uploadId`.
- Verificación:
  - `npx vitest run test/uploadCancels.test.ts test/downloadCancel.test.ts test/driveUploadAbort.test.ts test/downloadSave.test.ts --root apps/web`;
  - `npm run check`.
- Commits:
  - `fix: al cancelar borra solo la canción de esa descarga, aunque la subida acabe tarde`;
  - `fix: borra en Drive el archivo de una subida cancelada`;
  - `refactor: quita el import circular de downloads/cancel.ts`, si se puede separar; si no,
    va en el primero.

### T6 · Windows: `smoke.mjs`, `gradle.mjs` y `.pyc` · Grupo B · Estado: HECHA

- Depende de: T1 (comparte `scripts/smoke.mjs`).
- Archivos (exclusivos): `scripts/smoke.mjs` (solo `stop()`, el final de `main()` y el arranque),
  `apps/mobile/scripts/gradle.mjs`, `.gitignore`,
  `apps/web/test/browser/__pycache__/*.pyc` (quitar del repo).
- Qué hacer:
  1. **`smoke.mjs`.** En Windows, `child.kill()` con `shell: true` mata solo `cmd.exe`: workerd
     sigue vivo, bloquea `persistDir` y `rmSync` lanza EPERM.
     - Hacer `stop()` asíncrono. En win32:
       `spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })`;
       en el resto, `child.kill()`.
     - Esperar al evento `exit` del hijo, con tope de 5 s.
     - Luego `rmSync(persistDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })`
       dentro de `try/catch`. Si falla, avisar con `console.warn` de qué carpeta queda, sin
       cambiar el código de salida.
     - El código de salida depende solo de las comprobaciones fallidas.
     - Instalar `process.on('SIGINT')` para parar también con Ctrl+C.
  2. **`gradle.mjs`.**
     - Ruta absoluta con `join(androidDir, 'gradlew.bat' | 'gradlew')`. Si no existe: mensaje
       claro («Falta …; ejecuta `npx cap sync android`») y salir con 1.
     - En win32:
       `spawnSync('cmd.exe', ['/d', '/s', '/c', `"${abs}" ${args}`], { cwd, stdio: 'inherit', windowsVerbatimArguments: true })`;
       en el resto, `spawnSync(abs, args, { cwd, stdio: 'inherit' })` sin shell.
     - Si `result.error` existe, mostrarlo.
  3. **`.pyc`.**
     - `git rm -r --cached apps/web/test/browser/__pycache__`;
     - añadir `__pycache__/` y `*.pyc` a `.gitignore`.
- TDD: no (scripts de herramientas; se comprueban ejecutándolos).
- Criterios de aceptación:
  - [ ] en Windows, `npm run test:e2e` termina con código 0 si pasan todas las comprobaciones;
  - [ ] después no queda ningún `workerd.exe` ni wrangler colgado
        (`Get-Process workerd -ErrorAction SilentlyContinue` vacío);
  - [ ] `npm run android:apk` arranca Gradle en Windows sin «gradlew.bat no se reconoce» (con
        `JAVA_HOME` y `ANDROID_HOME` como en `CLAUDE.md`);
  - [ ] `git ls-files apps/web/test/browser/__pycache__` no devuelve nada.
- Verificación: `npm run build -w @aske/web`, `npm run test:e2e` (mirar `$LASTEXITCODE`),
  `npm run android:apk`.
- Commits:
  - `fix: para bien wrangler y workerd al acabar el smoke test en Windows`;
  - `fix: ejecuta gradlew.bat en Windows desde gradle.mjs`;
  - `chore: quita los .pyc del repositorio y los ignora`.

### T7 · Publicación v0.9.6 y documentación · Grupo C · Estado: HECHA

- Depende de: T1 a T6.
- Archivos (exclusivos):
  - los 7 `package.json` (raíz, `apps/web`, `apps/api`, `apps/hub`, `apps/mobile`,
    `packages/shared`, `tools/ingest`) y `package-lock.json`;
  - lo que tenga la versión fija (buscarlo con Grep `0\.9\.5`: `apps/api/src/version.ts` si no
    se deriva, Android `versionCode`/`versionName` si no se derivan);
  - `docs/releases/v0.9.6.md` (nuevo), `docs/ESTADO.md`, `docs/v2/architecture.md`
    (tabla de fases), `docs/PRIVACY.md` (solo si procede), `CLAUDE.md` (las notas de Windows de
    `smoke.mjs` y `gradle.mjs`, que ya no aplican).
- Leer como contexto: `docs/releases/v0.9.5.md` (formato).
- Qué hacer:
  1. Subir la versión a 0.9.6 con un script `node` (nunca `sed` ni `npm install`), incluidas las
     entradas de los workspaces en `package-lock.json`.
  2. Notas de la versión en lenguaje sencillo:
     - qué se arregla;
     - «quien tenga la música en Cloudflare debe actualizar su servidor desde la app»
       (migración 0008).
  3. `ESTADO.md`: vaciar «Problemas conocidos» de lo arreglado (dejar la verificación de memoria
     de la v0.9.3) y apuntar la v0.9.6.
  4. `PRIVACY.md`: solo si procede. La tabla nueva guarda en el Cloudflare del propio usuario el
     id de la descarga cancelada, que incluye el id del vídeo, durante 30 días. Si la política
     detalla qué guarda el Worker, añadir una línea; si no, no tocarla.
  5. Ejecutar la batería completa:
     - `npm run check`;
     - `npm run build -w @aske/web` y `npm run test:e2e`;
     - las pruebas de navegador del README (v4 a v10, también la build `--mode fakenative`, y
       después reconstruir el dist normal);
     - `npm run android:apk`.

     Informar del resultado de cada una.
- TDD: no.
- Criterios de aceptación:
  - [ ] `git grep 0.9.5` solo aparece en notas o documentación histórica;
  - [ ] todo lo de «Verificación» en verde y el APK generado;
  - [ ] sin push ni tag (lo hace el orquestador).
- Verificación: la batería del paso 5.
- Commits:
  - `chore: sube la versión a 0.9.6`;
  - `docs: añade las notas de la versión 0.9.6 y actualiza el estado`.

## Publicación (la hace el orquestador, no los programadores)

1. `npm run db:migrate:remote`: hay migración **0008** en la API.
2. Hub: no tiene migración, pero sí código nuevo. Va antes que la web: `npm run deploy:hub`.
3. `npm run deploy`.
4. `git push`, después el tag `v0.9.6`. CI publica los APK.

## Riesgos / dudas abiertas

- Worker viejo (cada amigo actualiza el suyo desde la app): hasta que lo actualice, una canción
  cancelada mientras se guardaba puede quedarse en su biblioteca. El plan avisa con «actualiza el
  servidor» y no borra nada, siguiendo la regla «nunca tocar lo ajeno». Si Andoni prefiere
  mantener el barrido antiguo solo para Workers viejos, habría que decirlo antes de T5 (no
  recomendado: es justo el que puede borrar lo de otro aparato).
- Drive: anular la sesión de subida es «lo mejor posible». Si Google ya había terminado y el
  móvil se queda sin red justo en ese momento, el archivo de audio puede quedar en la carpeta de
  Drive. No sale en la biblioteca, pero ocupa espacio. Se registra con `console.error`.
- T4: si fakenative no permite simular «Compartir» en el navegador, el aviso único se cubre con
  Vitest.

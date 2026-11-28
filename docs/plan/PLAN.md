# PLAN: v0.9.7, animación del logo al arrancar y arreglo de los cuatro fallos conocidos

Fecha: 2026-11-28 · Estado: COMPLETADO

## Objetivo

1. Recuperar la animación de arranque quitada en `e6edc43` (barras que se trazan, se rellenan y destello), pulida y sin texto. Dura 1,4 s como mínimo. Si la app sigue cargando, las barras se mueven como un ecualizador. Cuando la app está lista, vuelven suavemente a su forma y la pantalla se funde. Igual en web/PWA y Android, sin parpadeos.
2. Arreglar los 4 problemas conocidos de `docs/ESTADO.md`: archivos que quedan tras cancelar (Worker antiguo y Drive), error falso al cancelar justo al terminar, migración 0008 a medias y la prueba v5 que no verifica la reanudación.
3. Dejar preparadas las notas de la v0.9.7, la ayuda y los documentos. **Se publica solo cuando Andoni apruebe la animación.**

## Decisiones de arquitectura

- **La pantalla de arranque es una sola, la de `index.html`, y queda FUERA de `#root`** (hermana de `#root`). React ya no la vuelve a dibujar: se borran `components/BootSplash.tsx` y `src/boot.css`. Así la animación empieza antes de que cargue el JavaScript y no se reinicia ni salta cuando React toma el control.
- **Todo el movimiento va en CSS dentro de `index.html`**, incluido el ecualizador, que arranca solo a los 1400 ms gracias a `animation-delay`. Si el JS tarda o no carga, el logo sigue moviéndose. El JS solo decide cuándo parar.
- **Cada barra son tres piezas:** un cuerpo recto y dos medias lunas (círculos `r=3`). Se mueven con la propiedad registrada `@property --s` (factor de escala). Así los extremos redondos nunca se deforman, cosa que sí pasaría con `scaleY` sobre un `rect rx=3`. Todas las barras están centradas en `y=32`.
- **El regreso suave usa una transición sobre `--s`.** Se lee el valor actual, se fija en línea, se quita la animación y en el fotograma siguiente se pone `--s: 1`. Da igual en qué punto del ciclo esté: no hay saltos.
- **`lib/bootSplash.ts` es un controlador pequeño sin React** que gestiona `settle()` y `leave()`, con temporizadores de respaldo para que nunca se quede colgado. Las fases las expone en `data-phase`, para las pruebas.
- **El contenido de la app se monta después de que las barras se hayan asentado**, y el fundido es de `opacity` sobre un `div`, que va por el compositor. Así el montaje de React no da tirones en la animación SVG.
- **«Reducir movimiento»: la animación es igual para todos** (lo eligió Andoni). Se quitan los `@media (prefers-reduced-motion)`.
- **Android: la pantalla de arranque nativa queda solo con el fondo `#14110F`.** El icono del SplashScreen de Android 12+ pasa a ser transparente.
- **Borrado pendiente en Cloudflare con un Worker antiguo:** la cancelación ya no se olvida. Queda guardada hasta que el servidor esté actualizado. Como el Worker antiguo no guardaba `upload_id`, el nuevo acepta una pista opcional (`ref` = vídeo de YouTube y `since`) y solo borra pistas con `upload_id IS NULL`, de ese vídeo y creadas después de `since`. Si después se guarda o aparece como duplicada esa misma canción, la pista se descarta. **Aprobado por Andoni.**
- **Borrado pendiente en Drive:** cada archivo subido lleva `appProperties.askeUploadId`. Al cancelar mientras se guarda, se apunta una limpieza persistente que busca por esa propiedad y borra solo esos archivos, y nunca uno que use la biblioteca.
- **Error falso al cancelar:** `discardSaved` deja de mostrar el aviso «Borrada» y, en Cloudflare, un 404 al borrar cuenta como «ya no estaba».
- **Migraciones tolerantes:** se ejecuta sentencia a sentencia y se salta `ALTER TABLE … ADD COLUMN` si la columna ya existe (se mira con `PRAGMA table_info`). No se toca `0008_upload_cancels.sql`, que ya está aplicada en producción.

## Contratos (interfaces compartidas)

### Worker (`apps/api`)

`DELETE /api/ingest/uploads/:uploadId?ref=<videoId>&since=<ms>`. Los dos parámetros son opcionales y van juntos.

- `ref`: `^[A-Za-z0-9_-]{1,64}$`. `since`: entero ≥ 0. Si llega solo uno, o alguno no es válido: 400 `validation_error`.
- Igual que ahora, más una sentencia en el mismo `batch`:
  `DELETE FROM tracks WHERE upload_id IS NULL AND source = 'youtube' AND source_ref = ? AND created_at >= ? RETURNING id`.
- Respuesta: `{ deletedIds: string[] }`, que reúne los dos borrados. También se borran sus objetos de R2.

```ts
// apps/api/src/lib/uploads.ts
export interface LegacyHint {
  ref: string;
  since: number;
}
export function cancelUpload(
  db: D1Database,
  bucket: R2Bucket,
  uploadId: string,
  legacy?: LegacyHint,
): Promise<string[]>;
```

### Cliente (`apps/web`)

```ts
// api/client.ts
cancelUpload(uploadId: string, legacy?: { ref: string; since: number }): Promise<{ deletedIds: string[] }>;

// downloads/uploadCancels.ts (Cloudflare), localStorage 'aske.uploadCancels.v1'
interface PendingCancel { id: string; at: number; ref?: string; since?: number }
export function cancelCloudUpload(uploadId: string, legacy?: { ref: string; since: number }): Promise<void>;
export function retryPendingCancels(): Promise<void>;          // Cloudflare + Drive
export function forgetCancelsFor(videoId: string): void;      // quita la pista `ref` de ese vídeo

// downloads/driveCleanups.ts (Drive, NUEVO), localStorage 'aske.driveCleanups.v1'
interface PendingDriveCleanup { id: string; at: number }  // id = uploadId
export function registerDriveCleanup(uploadId: string): void; // guarda y programa un intento a los 2 min
export function retryDriveCleanups(): Promise<void>;

// storage/drive/api.ts
export interface UploadOptions { signal?: AbortSignal; timeoutMs?: number; uploadId?: string }
driveApi.findByUploadId(uploadId: string): Promise<DriveFile[]>;
// query: appProperties has { key='askeUploadId' and value='<id>' } and trashed=false

// storage/drive/home.ts
driveHome.referencedFileIds(): Promise<Set<string>>;  // audioFileId y coverFileId del doc

// lib/bootSplash.ts (NUEVO)
export const BOOT_INTRO_MS = 1400;
export const SETTLE_MS = 480;
export const SETTLE_HOLD_MS = 120;
export const LEAVE_MS = 360;
export type SplashPhase = 'intro' | 'eq' | 'settling' | 'leaving' | 'gone';
export function attachBootSplash(ariaLabel: string): void;  // pone el aria-label traducido
export function settleBootSplash(): Promise<void>;  // espera a que acabe la intro; si hay ecualizador, asienta
export function leaveBootSplash(): Promise<void>;   // fundido y retirada del nodo
export function splashPhaseAt(elapsedMs: number): 'intro' | 'eq'; // pura, con test
```

Si no existe `#boot-splash`, las tres funciones devuelven una promesa ya resuelta (tests y jsdom).

### DOM de `index.html` (lo usan T4 y T5)

```html
<div id="boot-splash" class="boot-splash" role="status" aria-label="Aske Stream" data-phase="intro">
  <svg class="boot-logo" viewBox="0 0 64 64" aria-hidden="true">…</svg>
</div>
<div id="root"></div>
```

### Especificación visual (valores exactos)

- **Fondo:** `#14110f`. **Barras:** `#f2a93b`. **Logo:** 96×96 px, centrado. Geometría (viewBox 64): x = 13/23/33/43, ancho 6, y/alto = 26/12, 18/28, 12/40, 22/20. Todas centradas en y = 32.
- **Por barra:**
  - `<g class="bar b1..b4" style="--half: (h-6)/2">` con:
    - `rect.body` (x, y+3, 6, h−6), sin rx, con `transform: scaleY(var(--s))`, `transform-box: view-box` y `transform-origin: 0 32px`;
    - `circle.cap-top` (cx = x+3, cy = y+3, r = 3), con `translateY(calc((1 - var(--s)) * var(--half) * 1px))`;
    - `circle.cap-bottom` (cy = y+h−3), con `translateY(calc((var(--s) - 1) * var(--half) * 1px))`.
  - `@property --s { syntax: '<number>'; inherits: true; initial-value: 1 }`.
- **Capa del trazo:** cuatro `rect` con rx = 3, `fill: none`, `stroke: #f2a93b` y `stroke-width: 1.25`. `stroke-dasharray`/`dashoffset` = perímetro: 30.85 / 62.85 / 86.85 / 46.85.
- **Destello:** `<g clip-path="url(#boot-clip)">`, con el clip formado por los 4 `rect` rx = 3. Dentro, un `rect` de 24×64 en x = −24 relleno con un `linearGradient` (x2 = 1, y2 = 0.35; paradas 0 % `#fff3dc` con opacidad 0, 50 % `#fff3dc` con opacidad 0.38 y 100 % con opacidad 0). Se mueve con `translateX` de 0 a 88.

**Línea de tiempo** (ms desde que se pinta la página; `i` = 0..3 es el índice de la barra):

| Pieza                      | Inicio     | Duración | Curva                                   | Cambio            |
| -------------------------- | ---------- | -------- | --------------------------------------- | ----------------- |
| Logo entero (`svg`)        | 0          | 1200     | `cubic-bezier(0.22,1,0.36,1)`           | scale 0.96 → 1    |
| Trazo, barra i             | 60 + 90·i  | 620      | `cubic-bezier(0.65,0,0.35,1)`           | dashoffset P → 0  |
| Relleno, barra i (`g.bar`) | 460 + 90·i | 380      | `cubic-bezier(0.33,1,0.68,1)`           | opacity 0 → 1     |
| Trazo se apaga, barra i    | 700 + 90·i | 300      | `ease-out`                              | opacity 1 → 0     |
| Destello                   | 900        | 460      | `cubic-bezier(0.37,0,0.63,1)`           | translateX 0 → 88 |
| Ecualizador                | delay 1400 | infinito | por tramo `cubic-bezier(0.37,0,0.63,1)` | `--s`, ver abajo  |

Usar `animation-fill-mode: both` en todo.

**Ecualizador:** todas las barras empiezan y acaban en `--s: 1`, la forma del logo, así que entran sin salto. Las duraciones no coinciden entre sí para que parezca natural:

- b1: 1100 ms · 0 % 1 · 35 % 2.6 · 70 % 0.8 · 100 % 1
- b2: 1300 ms · 0 % 1 · 40 % 0.55 · 75 % 1.3 · 100 % 1
- b3: 1200 ms · 0 % 1 · 30 % 1.1 · 65 % 0.6 · 100 % 1
- b4: 1000 ms · 0 % 1 · 45 % 1.75 · 80 % 0.6 · 100 % 1

**Asentar** (`settleBootSplash`):

1. Esperar a que acabe la intro. La fase se mide con `currentTime` de la animación CSS `boot-eq-1`, que incluye el delay; si no existe, se usa `document.timeline.currentTime`.
2. Si ya está en fase de ecualizador:
   - leer `--s` de cada `g.bar` y fijarlo en línea;
   - añadir la clase `settling` (`animation: none; transition: --s 480ms cubic-bezier(0.33,1,0.68,1)`);
   - forzar el estilo y, en el siguiente `requestAnimationFrame`, poner `--s: 1`;
   - esperar 480 ms y después 120 ms de pausa.
3. Si todavía estaba en la intro, añadir al momento la clase `calm` (el ecualizador se cancela y no llega a empezar) y salir 100 ms después de que termine (a los 1500 ms). Ver T5, paso 4.

**Salir** (`leaveBootSplash`):

- El `div` pasa de opacity 1 a 0 en 360 ms con `cubic-bezier(0.4,0,0.2,1)`. A la vez, el `svg` pasa de scale 1 a 1.03.
- Al terminar (`transitionend`, o un `setTimeout` de respaldo de 360 + 150 ms) se quita el nodo.

`data-phase` va tomando los valores `intro`, `eq`, `settling`, `leaving` y `gone`. El paso a `eq` lo pone un `setTimeout` en `attach`.

## Tareas

### T1 · Servidor: borrado heredado y migraciones tolerantes · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/api/src/lib/uploads.ts`, `apps/api/src/routes/ingest.ts`, `apps/api/test/uploads.test.ts`, `apps/web/src/cloudflare/migrations.ts`, `apps/web/test/cloudflare/migrations.test.ts`.
- Leer como contexto: `apps/api/migrations/0001_init.sql`, `apps/api/migrations/0008_upload_cancels.sql` y la sección «Contratos · Worker».
- Decisión aprobada por Andoni: pista extra `ref`/`since` (ver «Contratos · Worker»).
- Qué hacer:
  1. **`cancelUpload`.** Añadir el parámetro opcional `legacy`: la sentencia `DELETE … upload_id IS NULL AND source='youtube' AND source_ref=? AND created_at>=? RETURNING id` va dentro del mismo `db.batch`. Unir los ids de los dos borrados, sin repetidos, y borrar sus objetos de R2.
  2. **Ruta.** Validar con zod `ref` y `since` (los dos o ninguno; si no, 400 `validation_error`).
  3. **`applyMigrations`.**
     - Crear dos funciones puras exportadas:
       - `splitSql(sql): string[]`, que quita las líneas `--`, parte por `;`, recorta los espacios y descarta las vacías;
       - `addedColumn(stmt): { table: string; column: string } | null`, que reconoce `ALTER TABLE x ADD COLUMN y …` sin importar mayúsculas.
     - Ejecutar sentencia a sentencia. Antes de un `ADD COLUMN`, consultar `PRAGMA table_info(<table>)` y saltarlo si la columna ya existe. Al final, registrar el nombre en `d1_migrations`, como ahora.
     - Si falla una sentencia, lanzar un `Error` con el nombre de la migración en el mensaje y la causa en `cause`.
- TDD: sí.
- Criterios de aceptación:
  - [ ] Con `ref`/`since`, se borra la pista con `upload_id NULL` de ese vídeo creada después de `since`, y NO se borran: una anterior a `since`, otra de otro vídeo ni una con `upload_id` distinto.
  - [ ] Si llega solo `ref` o solo `since`: 400.
  - [ ] Sin parámetros, se comporta exactamente igual que antes (los tests existentes siguen en verde).
  - [ ] Si se aplica 0008 cuando `upload_id` ya existe (migración a medias), no da error y queda registrada. Una base ya migrada no ejecuta nada.
  - [ ] Hay tests de `splitSql` y `addedColumn`, con comentarios, varias sentencias y mayúsculas y minúsculas.
- Verificación: `npx vitest run test/uploads.test.ts --root apps/api` y `npx vitest run test/cloudflare/migrations.test.ts --root apps/web`.

### T2 · Cancelaciones de Cloudflare en la app y error falso · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/uploadCancels.ts`, `apps/web/src/downloads/cancel.ts`, `apps/web/src/api/client.ts`, `apps/web/src/storage/homes.ts`, `apps/web/src/stores/downloads.ts`, `apps/web/test/uploadCancels.test.ts`, `apps/web/test/downloadCancel.test.ts`.
- Leer como contexto: `apps/web/src/stores/serverUpdate.ts`, `apps/web/src/downloads/types.ts`, `apps/web/src/stores/libraryTrackActions.ts` y la sección «Contratos · Cliente».
- Decisión aprobada por Andoni: pista extra con 10 min de margen; se descarta si la canción se vuelve a guardar o sale como duplicada (`forgetCancelsFor`).
- Qué hacer:
  1. **`api.cancelUpload(uploadId, legacy?)`:** añade `?ref=&since=` cuando llega `legacy`.
  2. **`uploadCancels.ts`:**
     - Con un Worker antiguo (`isOldWorker`), llamar a `markOutdated()` y **NO olvidar** la cancelación: queda pendiente.
     - `cancelCloudUpload(uploadId, legacy)` guarda `ref`/`since` y los envía en cada intento.
     - Añadir `forgetCancelsFor(videoId)`, que quita `ref`/`since` de las pendientes con ese `ref` y mantiene el `id`.
     - `retryPendingCancels()` también llama a `retryDriveCleanups()` de `./driveCleanups`, que hace T3; importarlo según el contrato.
  3. **`cancel.ts`:**
     - Al cancelar mientras se guarda en Cloudflare, pasar `legacy = { ref: job.videoId, since: (job.savingSince ?? Date.now()) - 10 * 60_000 }`.
     - Si se guarda en Drive (`config.home === 'drive'` y `target !== 'device-only'`), llamar a `registerDriveCleanup(job.uploadId ?? job.id)`.
  4. **Error falso.** `discardSaved` borra en silencio, sin el aviso «toast.deleted», por ejemplo con una opción `silent` en `deleteTrack` o con un borrado interno. La parte de Cloudflare de `homes.ts`, en `deleteTrack`, trata un `ApiError` 404 como éxito: esa ruta existe en todas las versiones, así que un 404 significa que la pista ya no estaba. No debe aparecer ningún aviso de error.
  5. **`stores/downloads.ts`:**
     - Cuando un trabajo termina como `saved` o `duplicate`, llamar a `forgetCancelsFor(job.videoId)`.
     - En `init`, suscribirse a `useServerUpdate`: cuando `behind` pase de `true` a `false`, llamar a `retryPendingCancels()`, una sola suscripción, como `watchingOnline`.
- TDD: sí.
- Criterios de aceptación:
  - [ ] Ante un 404 «Unknown endpoint», la cancelación sigue en localStorage y se marca el servidor como desactualizado. Con el servidor ya actualizado, el reintento la envía con `ref`/`since` y después la borra.
  - [ ] `forgetCancelsFor` quita la pista de ese vídeo sin borrar la cancelación por `uploadId`.
  - [ ] Si se cancela a la vez que la subida responde 201 y el servidor ya borró la pista (el DELETE devuelve 404), no aparece ningún aviso de error ni el de «Borrada». La pista desaparece de la biblioteca.
  - [ ] Al cancelar en Drive mientras se guarda, se llama a `registerDriveCleanup` (con un mock).
  - [ ] Todos los tests de descargas siguen en verde.
- Verificación: `npx vitest run test/uploadCancels.test.ts test/downloadCancel.test.ts test/downloadSave.test.ts --root apps/web`.

### T3 · Limpieza pendiente en Drive · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/driveCleanups.ts` (nuevo), `apps/web/src/storage/drive/api.ts`, `apps/web/src/storage/drive/home.ts`, `apps/web/src/downloads/save.ts`, `apps/web/test/driveCleanups.test.ts` (nuevo).
- Leer como contexto: `apps/web/src/downloads/uploadCancels.ts`, que tiene el mismo patrón de localStorage, y la sección «Contratos · Cliente».
- Qué hacer:
  1. **`driveApi.upload`:** si `opts.uploadId` existe, añadir `appProperties: { askeUploadId }` a los metadatos del POST inicial.
  2. **`driveApi.findByUploadId`:** usar `call` con la consulta del contrato y escapar con `q()`.
  3. **`driveHome.addTrack`** pasa `upload` tal cual: ya lo hace, solo comprobarlo. En `save.ts` (`saveToDrive`), añadir `uploadId: job.uploadId ?? job.id` a las opciones.
  4. **`driveHome.referencedFileIds()`.**
  5. **`driveCleanups.ts`:**
     - Lista persistente con caducidad de 30 días.
     - `registerDriveCleanup` guarda la entrada y programa un intento a los 2 min.
     - Cada intento hace lo siguiente:
       - si la biblioteca ya no está en Drive, olvida la entrada;
       - si no hay red, no hace nada;
       - si hay red, busca los archivos y borra con `driveApi.remove` los que no estén en `referencedFileIds()`.
     - La entrada se olvida cuando un intento sale bien, han pasado al menos 2 min desde `at` y no queda ningún archivo.
     - Los errores se registran con `console.error` y no se muestran al usuario: es una limpieza silenciosa.
- TDD: sí, con mocks de `driveApi`, `driveHome` y `useSetup`.
- Criterios de aceptación:
  - [ ] La subida con `uploadId` envía `appProperties.askeUploadId`.
  - [ ] La limpieza borra solo los archivos de ese `uploadId` y nunca uno que use la biblioteca.
  - [ ] Sin red o si Drive falla, la entrada se mantiene. Se olvida si han pasado más de 30 días o si la biblioteca ya no está en Drive.
  - [ ] Antes de 2 min no se olvida aunque no se encuentre nada.
- Verificación: `npx vitest run test/driveCleanups.test.ts test/downloadSave.test.ts --root apps/web`.

### T4 · Animación de arranque: HTML, CSS y controlador · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/index.html`, `apps/web/src/lib/bootSplash.ts` (nuevo), `apps/web/test/bootSplash.test.ts` (nuevo).
- Leer como contexto: la sección «Especificación visual» completa, el `index.html` actual y, como referencia de la animación antigua, `git show e6edc43`.
- Qué hacer:
  1. **`index.html`:** sustituir el contenido de `#root` por el DOM del contrato. `#boot-splash` va fuera de `#root` y `#root` queda vacío. Todo el CSS va en línea en un `<style>` del `<head>`, para que se vea antes de cualquier JS:
     - `.boot-splash { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; background: #14110f }`;
     - las keyframes `boot-trace-*`, `boot-fill`, `boot-trace-out`, `boot-glint`, `boot-logo-in` y `boot-eq-1..4`, con los valores EXACTOS de la tabla;
     - la clase `.settling` y el estado `[data-phase="leaving"]` (transición de opacity 360 ms y scale 1.03 en el svg).
     - Sin ningún texto visible. No poner `@media (prefers-reduced-motion)`.
  2. **`lib/bootSplash.ts`:** implementar el contrato.
     - `splashPhaseAt` es una función pura.
     - `settle` y `leave` funcionan como se describe en «Asentar» y «Salir», con temporizadores de respaldo.
     - Cada función de menos de 50 líneas.
  3. **Tests:** `splashPhaseAt(0|1399|1400|5000)`. Sin `#boot-splash`, las funciones se resuelven al momento.
- TDD: sí solo para `splashPhaseAt` y la ausencia del nodo. Lo visual se comprueba en T5.
- Criterios de aceptación:
  - [ ] Abriendo `dist/index.html` sin JS, se ve la intro y después el ecualizador en bucle.
  - [ ] Los valores, curvas y tiempos son los de la tabla.
  - [ ] `npx prettier --check apps/web/index.html` en verde.
- Verificación: `npx vitest run test/bootSplash.test.ts --root apps/web` y `npm run build -w @aske/web`.

### T5 · Integración en la app, Android sin logo nativo y capturas · Grupo B · Estado: HECHA

- Archivos (exclusivos):
  - web: `apps/web/src/App.tsx`, `apps/web/src/lib/boot.ts`, `apps/web/test/boot.test.ts`;
  - borrar `apps/web/src/components/BootSplash.tsx` y `apps/web/src/boot.css`;
  - pruebas de navegador: `apps/web/test/browser/v9_095.py`, `apps/web/test/browser/v10_096.py` y `apps/web/test/browser/v11_097.py` (nuevo);
  - Android: `apps/mobile/android/app/src/main/res/values/styles.xml`, `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/MainActivity.java` (solo si hace falta).
- Leer como contexto: `apps/web/src/lib/bootSplash.ts` (de T4), `apps/web/test/browser/README.md`, `apps/web/src/main.tsx` y `apps/mobile/android/app/src/main/res/drawable/splash.xml`.
- Qué hacer:
  1. **`boot.ts`:** quitar `BOOT_MIN_SPLASH_MS`, `SPLASH_EXIT_MS`, `BOOT_PULSE_AFTER_MS`, `splashTimings` y `shouldPulse`. `bootReady` ya no lleva mínimo: el mínimo lo garantiza el controlador. Mantener `BOOT_MAX_WAIT_MS`. Actualizar `boot.test.ts`.
  2. **`App.tsx`:**
     - Al montar, llamar a `attachBootSplash(t('boot.loading'))`.
     - Mientras no esté lista, devolver `null`.
     - Cuando esté lista: `await settleBootSplash()`, luego `setShowApp(true)`; tras montar `AppScreens` (en un `useEffect` y dos `requestAnimationFrame`), llamar a `leaveBootSplash()`.
     - Quitar los `matchMedia('(prefers-reduced-motion…)')`.
     - Comprobar que `main.tsx` monta en `#root`.
  3. **Android:**
     - En `AppTheme.NoActionBarLaunch`, poner `windowSplashScreenAnimatedIcon` = `@android:color/transparent`, o un drawable transparente nuevo si Gradle no lo acepta, y quitar el icono del launcher.
     - Mantener `windowSplashScreenBackground` `#14110F`.
     - Revisar si `MainActivity` necesita `SplashScreen.installSplashScreen(this)` para que se aplique `postSplashScreenTheme`. Si ya funciona con Capacitor, no tocarla.
  4. **Corrección de la animación (puede tocar `apps/web/index.html` y `apps/web/src/lib/bootSplash.ts`, de T4, ya HECHA).** Problema: si la app está lista durante la intro, el ecualizador arranca igualmente a los 1400 ms y sigue moviéndose durante el montaje y el fundido. Regla: las barras SIEMPRE tienen su altura original (`--s` = 1) antes del fundido, y en una carga rápida el ecualizador no llega a verse.
     - **DOM:** separar las animaciones en dos elementos.
       - `g.bar` (exterior) solo lleva el relleno (`boot-fill`, opacity).
       - Dentro, un `<g class="eq">` envuelve el cuerpo y los dos extremos, y solo lleva `boot-eq-N` (`--s`, con delay 1400, `fill-mode: both`).
       - Así se puede quitar el ecualizador sin perder el relleno.
     - **CSS:** añadir `.boot-splash.calm .eq { animation: none; }`. Durante el delay, `--s` ya vale 1 (keyframe 0 %), así que quitarlo antes de los 1400 ms no produce ningún salto.
     - **`settleBootSplash()`:**
       1. **Si la intro no ha terminado** (`currentTime` de `boot-eq-1` < 1400): añadir en ese mismo momento la clase `calm`, esperar a que acabe la intro y añadir 100 ms de pausa. El ecualizador nunca empieza.
       2. **Si ya ha empezado:** usar el camino de asentar que ya existe, leyendo y fijando `--s` en cada `g.eq` (no en `g.bar`). Al final de la transición, añadir también `calm` para que no vuelva a arrancar.
     - **`leaveBootSplash()`:** solo empieza el fundido después de que `settleBootSplash()` se haya resuelto. Si alguien lo llama antes, primero espera a `settle`.
     - **Test (vitest, jsdom):** el contrato no cambia. Añadir un caso con un `#boot-splash` falso donde la fase es intro: `settle` añade `calm` al momento y no cambia `--s`.
     - **v11 (a) carga normal:** comprobar que `data-phase` nunca pasa por `eq` y que todos los `--s` están a ±0,01 de 1 en cada captura, incluida la del fundido.
  5. **Pruebas de navegador:**
     - v9/v10: cambiar `.pulsing` por `[data-phase="eq"]` y seguir comprobando que no hay texto y que al final `.boot-splash` desaparece.
     - `v11_097.py`, con Playwright, `record_video_dir` y las capturas en la carpeta que ya usa `shot()`:
       - (a) **carga normal:** capturas a 100, 450, 800, 1100, 1350 y 1600 ms;
       - (b) **JS lento:** retrasar 3 s los `/assets/*.js` con `page.route`; capturas a 1800 y 2600 ms; comprobar que algún `--s` ≠ 1 (ecualizador activo) y que, cuando `data-phase` pasa a `leaving`, todos los `--s` están a ±0,01 de 1;
       - (c) **sin saltos:** el `boundingBox` del svg es el mismo antes y después de cargar el JS;
       - (d) el splash dura ≥ 1400 ms y no contiene texto.
- TDD: no, salvo actualizar `boot.test.ts`.
- Criterios de aceptación:
  - [ ] `npm run check` en verde.
  - [ ] v9, v10 y v11 pasan; los vídeos y capturas se generan.
  - [ ] En el APK no aparece ningún logo nativo: fondo oscuro y después el logo dibujándose. Comprobado con `adb shell screenrecord` en Android 12 o superior.
  - [ ] No hay imports de `BootSplash` ni `boot.css`.
- Verificación: `npm run check`, `npm run test:e2e`, `python apps/web/test/browser/v11_097.py` (ver README) y `npm run android:apk`.

### T6 · La prueba v5 verifica de verdad la reanudación · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/test/browser/v5_fakenative.py` y `apps/web/test/fake-native/*` (si hace falta).
- Leer como contexto: `apps/web/test/browser/README.md` y `apps/web/src/stores/downloads.ts` (solo lectura).
- Qué hacer:
  - En el bloque «resume after the app is closed mid-download» (líneas 67-72), sustituir los `print` por `assert`:
    - antes de recargar, al menos un trabajo `resume*` sigue activo (`queued`/`downloading`/`saving`), porque si no la prueba no demuestra nada; si hace falta, ajustar la espera o la velocidad del fake;
    - después de recargar, la cantidad de trabajos `resume*` es la misma que da el fake para `PLRESUME0001`;
    - todos están en `done`, sin duplicados (`videoId` único) y sin errores.
  - Si destapa un bug en `src/`, NO editar archivos de otras tareas: describirlo con su causa en el informe al orquestador para hacer una tarea de arreglo.
- TDD: no.
- Criterios de aceptación:
  - [ ] La prueba falla si se rompe la reanudación (comprobado una vez a mano, por ejemplo cambiando temporalmente el assert esperado) y pasa con el código actual.
- Verificación: build `fakenative` y `python apps/web/test/browser/v5_fakenative.py` según el README. Después, reconstruir el dist normal.

### T7 · Ayuda, notas de versión, documentos y versión 0.9.7 · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/help/articles/music.ts`, `apps/web/src/i18n/downloads.ts` (si hace falta), `docs/releases/v0.9.7.md` (nuevo), `docs/ESTADO.md`, `docs/v2/architecture.md`, los 7 `package.json` y `package-lock.json`.
- Qué hacer:
  1. **Ayuda «Cancelar o quitar», en es, en y eu:** contar en lenguaje sencillo que, si se cancela mientras se guarda y no hay internet, o el servidor está sin actualizar, la app lo apunta y lo borra sola al volver internet o al actualizar el servidor; y que nunca toca otra música.
  2. **Notas `v0.9.7.md`:** animación nueva; los cuatro arreglos.
  3. **`ESTADO.md`:** vaciar «Problemas conocidos» de lo resuelto, añadir «Andoni, probar v0.9.7» (arranque normal y lento en el móvil, cancelar sin red en Drive, cancelar con un Worker antiguo y después actualizar) y la decisión de la pista `ref/since`. Tabla de fases en `architecture.md`.
  4. **Versión:** subir a 0.9.7 con `node` (nunca `sed`) en los 7 `package.json` y en el lock. **Solo cuando el orquestador confirme que Andoni ha aprobado la animación.**
- TDD: no (los tests de paridad de i18n y de enlaces de la ayuda deben seguir en verde).
- Criterios de aceptación:
  - [ ] `npm run check` en verde.
  - [ ] Los textos son los mismos en las tres lenguas y no usan jerga.
- Verificación: `npm run check`.

## Riesgos / dudas abiertas

- **RESUELTO (Andoni, 2026-11-28): se usa la pista extra (`ref`/`since`) para el Worker antiguo.** Se busca el mismo vídeo de YouTube, sin `upload_id` y creado después de que empezara a guardarse, con 10 min de margen. La pista se descarta si esa canción se vuelve a guardar o aparece como duplicada. Lo implementan T1 (Worker) y T2 (app). Riesgo residual mínimo: que otro dispositivo suba ese mismo vídeo en esos minutos con un Worker antiguo.
- **Safari/iPhone:** `@property` necesita Safari 16.4 o superior. En versiones anteriores, el ecualizador no se mueve (el logo se queda quieto), pero la intro y el fundido sí funcionan. No requiere decisión salvo que Andoni quiera dar soporte a iPhones antiguos.
- **PWA instalada en Android:** Chrome muestra su propia pantalla con el icono del manifiesto antes de cargar la página. No se puede quitar desde la web; solo se garantiza que no haya saltos después.
- **Rendimiento en móviles lentos:** las animaciones SVG van por el hilo principal. Por eso el contenido de la app se monta después de asentar las barras. Si en el APK se ven tirones, se puede simplificar el destello.
- **Aprobación:** la publicación (T7, paso 4, y el tag) depende de que Andoni vea los vídeos y capturas de T5 y diga que sí.

# PLAN: arreglos de v0.8.6 (progreso de descargas, botones, animación de entrada y pulido de playlists)

Fecha: 2026-11-23 · Estado: COMPLETADO

## Objetivo

Que la barra de la notificación de descargas avance de forma continua y nunca retroceda; arreglar
el botón «Jam» (texto cortado) y el botón «Recibir» (pegado al buscador); una animación de entrada
más elaborada (logo dibujado trazo a trazo, relleno, destello ámbar y fundido); y cerrar el pulido de
v0.8.5 (aviso falso de «incompleta», `PlaylistPicker` < 50 líneas con tests, claves sobrantes y
sonda de `PairView` sin Google). NO se sube la versión.

## Decisiones de arquitectura

- Causa del salto a 0: `buildNotification` cuenta como «terminada» solo `done`/`error`; mientras la
  canción 1 está en `saving` y la 2 ya en `downloading`, elige la 2 (fracción 0) y la 1 deja de
  contar → barra a 0. Se arregla contando `downloaded`/`saving` como terminadas — fórmula decidida.
- Suelo de progreso en dos sitios: en JS (`buildNotification(..., floor)` con el último valor
  enviado) y en el servicio Java (`shownPct`) — el servicio es quien publica y además cambia de
  escritor (JS ↔ nativo) al abrir/cerrar la app; sin suelo nativo el relevo podría bajar la barra.
- Al añadir canciones al lote, el total crece y el cálculo baja: el suelo la deja quieta hasta que
  el progreso real la alcanza — «sin bajar bruscamente», sin animaciones raras.
- Corte en 1000 canciones: nuevo campo `capped` en `PlaylistRead` en vez de poner `exhausted=true`
  — si se marcase `exhausted`, `countUnavailable` contaría las canciones 1001+ como «no
  disponibles» (falso). Con `capped`, `complete=true` y el aviso `pick.overLimit` (ya existe) lo explica.
- Diagnóstico de `PairView` en un módulo puro `lib/networkDiagnosis.ts` con la sonda inyectada —
  testeable; orden: servidor del amigo → Hub propio (`/hub/v1/health`) → `navigator.onLine`. Nada de terceros.
- No hay librería de tests de DOM: los «tests de la pantalla» de playlists se hacen sobre helpers
  puros extraídos de `PlaylistPicker` (`downloads/pickerView.ts`).
- Animación: SVG en línea + CSS en un archivo nuevo `apps/web/src/boot.css` (no engordar
  `styles.css`); salida con fundido cruzado (el splash queda 300 ms encima de la app).
- Bug del botón Jam: `.header-actions .btn.small { width: 32px; padding: 0 }` (pensado para botones
  solo-icono) aplasta el que lleva texto. Se añade un modificador `.with-label`.

## Contratos (interfaces compartidas)

```ts
// apps/web/src/downloads/batch.ts  (NUEVA función, notificationCounts NO cambia)
/** Songs of the active batches already downloaded: done, error, downloaded or saving. */
export function batchCompleted(jobs: readonly BatchJob[]): number;

// apps/web/src/downloads/notification.ts  (firma ampliada, 4º parámetro opcional)
export function buildNotification(
  jobs: readonly DownloadJob[],
  waitingNetwork: boolean,
  t: Translate,
  floor?: number, // default 0
): NotificationContent | null; // progress = max(floor, cálculo), nunca > 100

// apps/web/src/downloads/playlistReader.ts
export interface PlaylistRead {
  /* …campos actuales… */ capped: boolean;
} // cortada en maxSongs
// emptyRead() devuelve capped: false

// apps/web/src/lib/networkDiagnosis.ts  (NUEVO)
export type ConnectionProblem = 'noInternet' | 'unreachable' | 'blocked';
export type UrlProbe = (url: string) => Promise<boolean>;
export function diagnoseConnection(
  baseUrl: string,
  deps: { probe: UrlProbe; hubUrl: string | null; online: boolean },
): Promise<ConnectionProblem>;

// apps/web/src/downloads/pickerView.ts  (NUEVO, puro, sin React)
export function pickerSubtitle(
  author: string | undefined,
  total: number | null,
  t: Translate,
): string;
export function pickerActionText(
  t: Translate,
  sendsLink: boolean,
  count: number,
  native: boolean,
): string;
export function pickerNotices(
  listing: PlaylistListing | null,
  loading: boolean,
  max: number,
): { partial: boolean; overLimit: boolean };
export function addFreshSelection(
  prev: ReadonlySet<string>,
  seen: Set<string>,
  ids: readonly string[],
  max: number,
): Set<string> | null; // null = nada nuevo (no re-render)

// apps/web/src/lib/boot.ts
export const BOOT_MIN_SPLASH_MS = 1200; // antes 1000: deja terminar dibujo+relleno+destello
export const SPLASH_EXIT_MS = 300; // fundido hacia la app
```

Java (`DownloadService.java`): campo `private int shownPct = 0;`, método
`private int rising(int progress)` → si `progress < 0` devuelve `progress` (indeterminado);
si no, `shownPct = Math.max(shownPct, Math.min(progress, 100))` y lo devuelve. Se pone a 0 en
`onQueueEmpty()`.

## Tareas

### T1 · Progreso continuo del lote (JS) · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/batch.ts`, `apps/web/src/downloads/notification.ts`,
  `apps/web/src/stores/downloads.ts` (solo la función `notify()`), `apps/web/test/notification.test.ts`,
  `apps/web/test/batch.test.ts`
- Leer como contexto: `apps/web/src/downloads/types.ts`
- Qué hacer:
  1. Tests primero. En `batch.test.ts`: `batchCompleted` cuenta `done`, `error`, `downloaded` y
     `saving` solo de los lotes activos (mismo filtro que `notificationCounts`); 0 si no hay activos.
  2. En `notification.test.ts`:
     - el caso «prefers the downloading song over the saving one» (`[saving, downloading 20]`) da
       `progress` 60 y título con `done=2`;
     - secuencia de 5 canciones sin retroceso: canción 1 al 100 % → 1 en `saving` y 2 en
       `downloading 0` → 1 `done` y 2 al 30 %; cada paso ≥ el anterior;
     - `floor`: con `floor=70` y cálculo 40 da 70; con `floor=0` igual que antes; nunca > 100;
     - lote que crece (5 → 10 canciones) con `floor` = último valor: no baja.
     - Los tests actuales deben seguir pasando (25 %, 30 %, waiting, etc.).
  3. Implementar `batchCompleted` en `batch.ts`.
  4. En `buildNotification`: `completed = batchCompleted(jobs)`; `excl = completed - (current es
saving/downloaded ? 1 : 0)`; `position = min(excl + 1, total)`;
     `progress = max(floor, batchProgress(excl, fractionOf(current, waiting), total))`.
     `total` sigue saliendo de `notificationCounts` (fallback actual si es null).
  5. En `stores/downloads.ts`, dentro de `notify()`, pasar `lastSent?.content.progress ?? 0` como
     `floor`. `endNotification()` ya pone `lastSent = null`, así el lote siguiente empieza en 0.
     No tocar nada más del archivo.
- TDD: sí
- Criterios de aceptación:
  - [ ] Con 5 canciones, la secuencia de estados nunca da un `progress` menor que el anterior.
  - [ ] Añadir canciones a un lote en curso no baja la barra.
  - [ ] Tests de `notification` y `batch` en verde; funciones < 50 líneas.
- Verificación: `npx vitest run test/notification.test.ts test/batch.test.ts --root apps/web`

### T2 · Suelo de progreso en el servicio nativo · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/DownloadService.java`
- Leer como contexto: `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/DownloadQueue.java`
  (`pendingCount` incluye el trabajo en curso)
- Qué hacer (ver «Contratos», parte Java):
  - Añadir `shownPct` y `rising(int)`.
  - Aplicar `rising(...)` a la barra en los tres sitios donde se construye la notificación de
    progreso: `submitFromJs` (progreso que manda la app), `onStartCommand` cuando `fromJs`
    (antes de `build`), y `nativeNotification` (sobre `overall`). No aplicarlo a `showNotice`.
  - Poner `shownPct = 0` al principio de `onQueueEmpty()` (junto a `done = 0`).
  - Comentario breve en inglés del porqué: el escritor cambia entre la app y el servicio y el total
    puede crecer; Android no debe ver la barra retroceder.
  - No cambiar el throttle ni la lógica de cola.
- TDD: no (no hay tests Java en el proyecto)
- Criterios de aceptación:
  - [ ] Compila.
  - [ ] Con la app cerrada y 5 canciones, la barra sube sin volver a 0 entre canciones.
  - [ ] Al terminar un lote y empezar otro, el nuevo empieza desde 0.
- Verificación: en `apps/mobile/android`, `.\gradlew.bat compileReleaseJavaWithJavac` (JDK 21, ver
  CLAUDE.md). Prueba manual en el móvil (la hará Andoni con el APK).

### T3 · Playlist cortada en 1000 y claves sobrantes · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/playlistReader.ts`, `apps/web/test/playlistReader.test.ts`,
  `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`
- Leer como contexto: `packages/shared/src/youtube.ts` (`isPlaylistComplete`, `countUnavailable`),
  `apps/web/src/downloads/playlistSource.ts`
- Qué hacer:
  1. Tests primero en `playlistReader.test.ts`:
     - «cuts the entries at maxSongs» además comprueba `capped === true` y `exhausted === false`;
     - `listingFromRead` de una lectura `capped` con `totalCount: 1500` y 1000 entradas da
       `complete: true` y `unavailable` = solo `skipped` (no 500);
     - lectura no cortada: `capped === false`.
  2. Añadir `capped: boolean` a `PlaylistRead` y a `emptyRead()`; en `readPages`, al cortar por
     `maxSongs`, poner `read.capped = true`.
  3. `listingFromRead`: `complete = read.capped || isPlaylistComplete(...)`; `unavailable` igual
     que ahora (con `exhausted`, que sigue en false al cortar).
  4. Borrar `dl.loadingPlaylist` y `dl.playlistLoadingMore` de es, en y eu (antes, confirmar con
     Grep que nadie las usa en `apps/web/src`).
  5. Si algún otro test crea `PlaylistRead` a mano y falla por tipos, añadir `capped: false` solo
     dentro de este archivo de test; si está en otro archivo, avisar en el informe.
- TDD: sí
- Criterios de aceptación:
  - [ ] Playlist de 1500 → 1000 canciones, sin aviso de «incompleta» y sin «500 no disponibles».
  - [ ] Las dos claves ya no existen en ningún idioma; el test de paridad pasa.
- Verificación: `npx vitest run test/playlistReader.test.ts test/playlistSource.test.ts --root apps/web`
  y `npm run typecheck -w @aske/web` (o `npm run check` si no existe ese script)

### T4 · PlaylistPicker en piezas pequeñas + tests · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/downloads/PlaylistPicker.tsx`,
  `apps/web/src/downloads/pickerView.ts` (nuevo), `apps/web/test/pickerView.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/downloads/playlistReader.ts` (tipo `PlaylistListing`),
  `apps/web/test/pickSelection.test.ts` (estilo de tests y `t` falso)
- Qué hacer:
  1. Tests primero (`pickerView.test.ts`) para las 4 funciones de «Contratos»:
     - `pickerSubtitle`: autor + «N canciones»; sin total solo autor; sin nada cadena vacía.
     - `pickerActionText`: `sendsLink` → `send.sendPlaylist`; nativo → `dl.downloadAll`; si no `pick.send`.
     - `pickerNotices`: `partial` solo si no carga, `!complete` y hay total; `overLimit` si total > max.
     - `addFreshSelection`: marca nuevas hasta `max`, respeta lo que el usuario desmarcó, null si
       no hay nuevas.
  2. Mover esa lógica desde `PlaylistPicker.tsx` (subtítulo, `actionText`, condiciones de
     `PickerNotices`, el cuerpo de `useSelection.onEntries`) a `pickerView.ts`.
  3. Dejar `PlaylistPicker` < 50 líneas: extraer un hook `usePickerState(result, via)` (selección,
     modo, listing, título, nombre, `picked`, subtítulo, portada, submit) y un componente
     `PickerSheet` (el JSX del portal) en el mismo archivo. Todas las funciones < 50 líneas.
  4. Mismo comportamiento y mismas claves de texto; nada visual cambia.
- TDD: sí
- Criterios de aceptación:
  - [ ] `PlaylistPicker` < 50 líneas y ninguna función del archivo ≥ 50.
  - [ ] Tests nuevos en verde; typecheck sin errores.
- Verificación: `npx vitest run test/pickerView.test.ts test/pickSelection.test.ts --root apps/web`

### T5 · Diagnóstico de conexión de PairView sin Google · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/lib/networkDiagnosis.ts` (nuevo),
  `apps/web/test/networkDiagnosis.test.ts` (nuevo), `apps/web/src/views/PairView.tsx`
- Leer como contexto: `apps/web/src/stores/connectivity.ts` (`defaultProbe`, uso de `HUB_URL` y
  `hubAvailable`), `docs/hub.md`, `apps/web/test/pairView.test.ts`
- Qué hacer:
  1. Tests primero, con `probe` falso que registra las URLs:
     - `online: false` → `noInternet` sin llamar a `probe`;
     - el servidor responde (`${baseUrl}/favicon.svg`) → `blocked`;
     - servidor no, Hub sí (`${hub}/hub/v1/health`, sin barras dobles) → `unreachable`;
     - servidor no, Hub no → `noInternet`;
     - servidor no y sin Hub (`hubUrl: null`) → `unreachable`;
     - nunca se llama a ninguna URL de Google/gstatic.
  2. Implementar `diagnoseConnection` (orden: online → servidor → Hub).
  3. En `PairView.tsx`, `diagnose()` pasa a usar `diagnoseConnection(baseUrl, { probe,
hubUrl: hubAvailable() ? HUB_URL : null, online: navigator.onLine })`. La sonda sigue con
     `mode: 'no-cors'`, `cache: 'no-store'`, `credentials: 'omit'` y se añade
     `signal: AbortSignal.timeout(BOOT_TIMEOUT_MS)` (de `lib/timeout`). Borrar `generate_204`.
     Mantener el comentario del favicon. Tipo `Problem` = `ConnectionProblem`.
- TDD: sí
- Criterios de aceptación:
  - [ ] `Grep generate_204` en `apps/` no encuentra nada.
  - [ ] Tests nuevos y `pairView.test.ts` en verde.
- Verificación: `npx vitest run test/networkDiagnosis.test.ts test/pairView.test.ts --root apps/web`

### T6 · Botones Jam y Recibir · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/PlaylistsView.tsx`, `apps/web/src/views/DownloadView.tsx`,
  `apps/web/src/styles.css`
- Qué hacer:
  - Jam: en `PlaylistsView.tsx` el `Link` a `/jam` pasa a `className="btn small with-label"`. En
    `styles.css`, junto a `.header-actions .btn.small`, añadir
    `.header-actions .btn.small.with-label { width: auto; padding: 0 12px; gap: 6px; }`.
  - Recibir: en `DownloadView.tsx` (`ReceiveButton`) el botón pasa a
    `className="btn small receive-btn"`; en `styles.css` `.receive-btn { margin-bottom: 12px; }`
    (cerca de `.dl-search`). Comprobar que en pantallas estrechas sigue bien.
  - Sin textos nuevos.
- TDD: no
- Criterios de aceptación:
  - [ ] «Jam» cabe entero dentro del botón en es/en/eu y en un móvil de 360 px de ancho.
  - [ ] Hay separación visible entre «Recibir» y el buscador.
- Verificación: `npm run dev` y mirar Playlists y Descargar (modo móvil del navegador, 360 px).
  Para ver «Recibir» hace falta el build `--mode fakenative` (ver CLAUDE.md).

### T7 · Animación de entrada del logo · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/BootSplash.tsx`, `apps/web/src/boot.css` (nuevo),
  `apps/web/src/App.tsx`, `apps/web/src/lib/boot.ts`, `apps/web/index.html`, `apps/web/src/styles.css`
  (solo borrar el bloque «Boot screen»: `.boot-splash`, `.boot-logo`, `.boot-hint`, `boot-pulse` y
  su `prefers-reduced-motion`)
- Leer como contexto: `apps/web/public/favicon.svg` (geometría del logo), `apps/web/test/boot.test.ts`
- Qué hacer:
  1. `BootSplash.tsx`: sustituir el `<img>` por un SVG en línea (`viewBox 0 0 64 64`) con el
     fondo redondeado `#14110f` y las 4 barras del favicon; cada barra con `pathLength="1"`,
     `stroke` ámbar (`var(--accent)`, fallback `#f2a93b`), `fill` transparente al inicio.
     Prop `leaving?: boolean` que añade la clase `leaving`. Importar `../boot.css`.
  2. `boot.css` (mover aquí los estilos del splash que había en `styles.css`). Línea de tiempo
     (~1,5 s): 0–0,6 s trazo con `stroke-dashoffset` 1→0, barras escalonadas 80 ms; 0,6–0,9 s
     relleno ámbar; 0,9–1,2 s destello: banda de gradiente ámbar claro semitransparente que
     cruza el logo (máscara/clip al contorno, `transform` animado); después, si la app aún no está
     lista, un pulso suave infinito (como el actual). `.leaving`: el splash pasa a `opacity 0` y el
     logo a `scale(1.08)` en `SPLASH_EXIT_MS`. Solo `opacity`/`transform`/`stroke-dashoffset`
     (ligero). Solo tonos ámbar del tema.
  3. `@media (prefers-reduced-motion: reduce)`: logo relleno y quieto desde el principio, sin
     trazo, destello ni pulso; salida con fundido simple o inmediata.
  4. `lib/boot.ts`: `BOOT_MIN_SPLASH_MS = 1200` y exportar `SPLASH_EXIT_MS = 300`.
  5. `App.tsx`: renombrar el cuerpo actual de `App` (sin la línea del splash y sin
     `useBootReady`) a `AppScreens`; el nuevo `App` hace `ready = useBootReady(...)`, usa un hook
     pequeño `useSplashExit(ready)` (true durante `SPLASH_EXIT_MS` tras pasar a listo) y devuelve
     `<BootSplash />` si no está listo, o `<><AppScreens />{leaving && <BootSplash leaving />}</>`
     (el splash es `position: fixed`, queda encima mientras se desvanece; `pointer-events: none`
     al salir). Ojo: `useBootReady` necesita `status === 'loading'` de `useSetup`.
  6. `index.html`: el splash estático deja solo el fondo oscuro (quitar el `<img>`) para que la
     animación no arranque dos veces.
  7. Sin textos nuevos (se usa `boot.loading` existente).
- TDD: no (visual). `boot.test.ts` debe seguir pasando.
- Criterios de aceptación:
  - [ ] Al abrir la app: trazo → relleno → destello → fundido hacia la app, ~1,5 s en total.
  - [ ] Con «reducir movimiento» activado en el sistema no hay animación de trazo ni destello.
  - [ ] Si la conexión tarda, el logo sigue visible con pulso suave y aparece el aviso
        `boot.connecting` igual que antes.
  - [ ] Ninguna función > 50 líneas; sin colores fuera de la paleta ámbar.
- Verificación: `npx vitest run test/boot.test.ts --root apps/web`, `npm run dev` y mirar el
  arranque (también con DevTools → Rendering → `prefers-reduced-motion: reduce`).

## Cierre (orquestador, tras T1–T7)

- `npm run check` completo; después `npm run test:e2e` (cerrar wrangler/workerd colgados en Windows).
- Actualizar `docs/ESTADO.md`: quitar de «Pulir v0.8.5» y de «Problemas conocidos» lo resuelto
  (exhausted, PlaylistPicker, claves, tests, `generate_204`); anotar la decisión del suelo de progreso.
- NO subir la versión a 0.8.6 hasta que Andoni lo pida.

## Riesgos / dudas abiertas

- Salida de la animación cuando la app tarda en estar lista (red lenta, hasta 5 s):
  - **Pulso suave hasta que esté lista y luego fundido (Recomendada)**: nunca se queda una
    pantalla vacía; el arranque rápido sigue siendo ~1,5 s. Inconveniente: en red lenta la
    animación no es «una sola pieza».
  - **Repetir el dibujo en bucle**: más vistoso, pero con 5 s de espera se ve repetitivo y gasta
    algo más de batería.
  - Recomendada porque mantiene el aviso «Conectando…» actual y es lo más ligero.
- `BOOT_MIN_SPLASH_MS` sube de 1000 a 1200 ms (más los 300 ms de fundido): el arranque mínimo
  pasa de 1 s a ~1,5 s, como se pidió. Si se quiere que el fundido empiece antes, bajar a 1000.
- `index.html` sin logo: en móviles muy lentos, durante la carga del JS se verá solo el fondo oscuro
  (antes salía el logo quieto). Alternativa: dejar el logo estático ahí y aceptar un pequeño salto
  al empezar la animación.
- La prueba real de la notificación (app cerrada, abierta y relevo entre ambas) solo puede hacerse
  en el móvil con el APK: queda para Andoni.

# PLAN: Vigilante contra cortes de música, menores del revisor y v0.9.1

Fecha: 2026-11-25 · Estado: COMPLETADO

## Objetivo

Que la música de Cloudflare no se quede muda a mitad de canción con la pantalla apagada: un
vigilante en la capa web detecta que el audio no avanza y lo reanuda solo, en el mismo punto y sin
cambiar de canción. Que la notificación no mienta mientras el audio está parado. Arreglar 4 menores
del revisor y dejar lista la v0.9.1 (versión, notas y documentación).

## Diagnóstico (datos de Andoni: a mitad de canción, Cloudflare, Pixel 8, batería sin restricciones)

- **Por qué la notificación sigue avanzando.** El plugin `@capgo/capacitor-media-session` llama a
  `PlaybackStateCompat.setState(STATE_PLAYING, position, speed)` y **Android calcula él solo** la
  posición a partir de la última que recibió, la hora y la velocidad. Nuestro JS solo envía
  «paused» con el evento `pause`. Cuando el stream se queda sin datos, el `<audio>` lanza
  `waiting`/`stalled` pero **no** `pause` (`audio.paused` sigue en `false`), y en `player.ts` el
  `waiting` solo pone `buffering: true`. La notificación se queda en PLAYING y avanza sola.
  Mandar `playbackRate: 0` no sirve: el plugin cambia 0 por 1.0 (`MediaSessionPlugin.java:159`).
  La única forma sin tocar Java es enviar la posición real y el estado «paused» mientras dura el
  atasco, y «playing» cuando vuelve a avanzar.
- **Por qué se corta el audio.** Lo más probable es que la conexión HTTP del stream (petición con
  Range a la API/R2) se quede muerta en segundo plano (Doze, cambio de red o la conexión inactiva
  mientras el búfer está lleno) y Chromium no la reintente hasta que la app vuelve al frente.
  Encaja con que «al abrir la app vuelve a sonar en el mismo minuto». La API ya acepta `Range`
  (`apps/api/src/routes/media.ts`), así que volver a pedir el audio desde el segundo actual es
  barato.
- **Hipótesis que el vigilante no arregla:** que Android congele todo el proceso del WebView
  (renderer). En ese caso tampoco corre el JS. Para saberlo, el vigilante deja trazas en logcat
  (ver T2) y la prueba de Andoni (T6) lo distingue. Si es eso, el siguiente paso es nativo (opción
  B o C del plan anterior), en otra fase.
- **No hace falta tocar Java.** Todo se resuelve con lo que ya expone el plugin (estado y
  posición).

## Decisiones de arquitectura

- Vigilante en `apps/web/src/player/stallWatchdog.ts` (nuevo): función pura `decideStall` + un
  pequeño «runner» con reloj y temporizador inyectados — testeable sin `<audio>` y `player.ts`
  (745 líneas) no pasa de 800.
- Solo vigila si `mode === 'track'`, hay `src`, `!audio.paused` y `!audio.ended` — así nunca pelea
  con pausas del usuario, del sistema (llamadas, foco de audio), del fin del modo estudio
  (`pause()`) ni con «fin de la lista».
- «Avanza» = `currentTime` cambia al menos 0,25 s (en cualquier sentido, así un seek del usuario
  cuenta como avance y reinicia los tiempos). Cambio de canción (`trackId` distinto) = reinicio
  total.
- Escalera de intentos: a los 3 s sin avanzar, notificación honesta («paused» con la posición
  real); a los 6 s, primer intento suave (`nudge`: seek en el mismo punto + `play()`, solo si ya hay
  metadatos); después, `reload` (volver a resolver la fuente de la misma canción y
  `pendingSeek` = segundo actual) con espera creciente 5, 10, 20, 30, 60 s. Máximo 8 intentos o
  10 min atascado → `give-up`: `audio.pause()` en silencio (la notificación queda en pausa, sin
  aviso).
- Sin conexión (`navigator.onLine === false`) no gasta intentos; al volver la red (evento
  `online`) reintenta en el acto.
- Error de red a mitad de canción (`MediaError.code === 2` con `currentTime > 0`): en vez de
  aviso + saltar a la siguiente (lo de hoy), recarga en el mismo punto con el vigilante. El resto de
  errores siguen como ahora.
- Los atascos no dan aviso visible (decisión de Andoni). Solo trazas `console.warn('[aske-stall]
…')` en atasco, recuperación, rendición y «hueco» del temporizador > 15 s (señal de JS
  congelado). Son registro de servidor/diagnóstico, no `console.log` de depuración, y salen en
  `adb logcat`.
- Mientras está atascado, el botón «play» de la notificación (que se ve porque el estado es
  «paused») fuerza un reintento inmediato en vez de no hacer nada.
- Radio fuera de alcance: tiene su propio reintento y no hay datos de cortes.
- Menores (B): `SendHowSheet` y también `ReceiveSheet` (tiene el mismo fallo) pasan a `<Sheet>`
  dentro de su `createPortal`.

## Contratos (interfaces compartidas)

### `apps/web/src/player/stallWatchdog.ts` (lo crea T1, lo usa T2)

```ts
export const STALL_TIMING = {
  progressEpsilon: 0.25, // seconds
  notifyAfterMs: 3_000,
  firstAttemptAfterMs: 6_000,
  backoffMs: [5_000, 10_000, 20_000, 30_000, 60_000], // wait after attempt n (last one repeats)
  maxAttempts: 8,
  giveUpAfterMs: 10 * 60_000,
  freezeGapMs: 15_000,
} as const;

export type StallAction = 'none' | 'nudge' | 'reload' | 'give-up';

export interface StallSample {
  now: number; // ms, monotonic (performance.now())
  active: boolean; // mode==='track' && !!audio.src && !audio.paused && !audio.ended
  trackId: string | null;
  currentTime: number;
  readyState: number; // HTMLMediaElement.readyState
  online: boolean;
}

export interface StallState {
  trackId: string | null;
  lastTime: number;
  lastProgressAt: number;
  stalledSince: number | null; // set once stuck >= notifyAfterMs
  attempts: number;
  nextAttemptAt: number;
}

export function initialStallState(now: number): StallState;
export function decideStall(
  state: StallState,
  sample: StallSample,
): { state: StallState; action: StallAction };
/** Immediate reload (network error, notification play, back online). */
export function forceAttempt(
  state: StallState,
  now: number,
): { state: StallState; action: 'reload' | 'give-up' };
export function isMidSongNetworkError(e: {
  code: number | null;
  mode: 'idle' | 'track' | 'radio';
  currentTime: number;
}): boolean; // code === 2 && mode === 'track' && currentTime > 0

export interface StallWatchdogDeps {
  sample: () => Omit<StallSample, 'now'>;
  now: () => number;
  onAction: (action: Exclude<StallAction, 'none'>) => void;
  onStalledChange: (stalled: boolean) => void;
  log: (
    event: 'stall' | 'recovered' | 'retry' | 'give-up' | 'freeze-gap',
    detail: Record<string, number | string | null>,
  ) => void;
  setInterval: (fn: () => void, ms: number) => unknown;
}
export function createStallWatchdog(
  deps: StallWatchdogDeps,
  intervalMs?: number, // default 1000
): {
  check: () => void; // sample + decide + apply; also called from media events
  retryNow: () => void; // forceAttempt + onAction
  isStalled: () => boolean;
};
```

Reglas de `decideStall` (en este orden):

1. `trackId` distinto del guardado → estado nuevo (`attempts` 0, sin atasco), acción `none`.
2. `!active` → `stalledSince = null`, `lastTime = currentTime`, `lastProgressAt = now`; **conserva**
   `attempts` (para que un bucle error→recarga→error no sea infinito); acción `none`.
3. `|currentTime − lastTime| ≥ progressEpsilon` → avance: `lastTime`, `lastProgressAt = now`,
   `attempts = 0`, `stalledSince = null`, `nextAttemptAt = 0`; acción `none`.
4. `stuck = now − lastProgressAt`. Si `stuck ≥ giveUpAfterMs`, o `attempts ≥ maxAttempts` y
   `now ≥ nextAttemptAt` → `give-up` y estado reiniciado (`initialStallState(now)` con el mismo
   `trackId`).
5. Si `stuck ≥ notifyAfterMs` y `stalledSince === null` → `stalledSince = now`.
6. Si `!online` → `none` (no gasta intentos).
7. Si `stuck ≥ firstAttemptAfterMs` y `now ≥ nextAttemptAt` → intento: `nudge` si
   `attempts === 0 && readyState >= 1`, si no `reload`; `attempts++`;
   `nextAttemptAt = now + backoffMs[min(attempts − 1, backoffMs.length − 1)]`.
8. Si no, `none`.

`forceAttempt`: si `attempts ≥ maxAttempts` → `give-up` (y estado reiniciado); si no,
`stalledSince ??= now`, `attempts = attempts + 1`, `nextAttemptAt` con la misma tabla y acción
`reload`.

Runner: en cada `check()` calcula `now`, si el hueco desde el `check` anterior supera
`freezeGapMs` y la muestra anterior estaba activa → `log('freeze-gap', { gapMs })`. Llama a
`onStalledChange` solo cuando cambia `stalledSince !== null` (y `log('stall' | 'recovered')`).
Cada acción ≠ `none` → `log('retry' | 'give-up', { attempts, action, trackId })` + `onAction`.
El temporizador se arranca una vez en `createStallWatchdog` con `deps.setInterval(check, intervalMs)`.

### `apps/web/src/player/mediaSession.ts` (lo cambia T2)

- `createMediaSession` devuelve además `setStalled(stalled: boolean)` y
  `setRetryHandler(fn: () => void)`.
- `setStalled(true)`: `controls.setPositionState` con la posición real (sin el freno de 1 s) y
  `controls.setPlaybackState('paused')` **sin** llamar a `keepAwake` (los wake/wifi locks se
  mantienen durante el reintento). `setStalled(false)`: si `!audio.paused`, posición real +
  `controls.setPlaybackState('playing')`.
- Acción `play` de la notificación: si `!player().isPlaying` → `togglePlay()` (como hoy); si está
  atascado → el `retryHandler`.

## Tareas

### T1 · Lógica pura del vigilante · Grupo A · Estado: PENDIENTE

- Archivos (exclusivos): `apps/web/src/player/stallWatchdog.ts` (nuevo),
  `apps/web/test/stallWatchdog.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/player/queue.ts` y `apps/web/test/playerShuffle.test.ts` (estilo
  de módulo puro y de tests).
- Qué hacer (primero los tests, en rojo; luego el código):
  - Implementa exactamente el contrato de `stallWatchdog.ts` y sus reglas. Sin imports de la app
    (ni `audio`, ni stores, ni `window`): todo entra por parámetros o `deps`.
  - Tests de `decideStall` como mínimo: avance normal → `none`; 2,9 s parado → sin atasco; 3 s →
    `stalledSince` puesto y `none`; 6 s con `readyState ≥ 1` → `nudge`; 6 s con `readyState 0` →
    `reload`; tras `nudge`, nada hasta pasar 5 s y después `reload`; escalera 5/10/20/30/60/60;
    al 9.º intento → `give-up`; 10 min parado → `give-up` aunque queden intentos; `online: false`
    → nunca intento pero sí `stalledSince`; al volver `online` con `now ≥ nextAttemptAt` →
    intento; `active: false` (pausa del usuario) → `none`, sin atasco, conserva `attempts`; un seek
    hacia atrás cuenta como avance; cambio de `trackId` → reinicio total.
  - Tests de `forceAttempt` (incrementa, `reload`, y `give-up` al llegar al máximo) y de
    `isMidSongNetworkError` (código 2 a mitad → true; código 2 con `currentTime` 0, código 4, modo
    radio → false).
  - Tests del runner con reloj y `setInterval` falsos: `onStalledChange(true)` una sola vez al
    atascarse y `(false)` al volver a avanzar; `onAction` recibe las acciones; `retryNow` llama a
    `onAction('reload')`; `log('freeze-gap')` si entre dos `check` pasan más de 15 s.
  - Funciones < 50 líneas, comentarios en inglés (el porqué).
- TDD: sí
- Criterios de aceptación:
  - [ ] Todos los casos de arriba pasan.
  - [ ] El módulo no importa nada de `stores/`, `native/` ni del DOM.
- Verificación: `npx vitest run test/stallWatchdog.test.ts --root apps/web`

### T3 · Menores del revisor · Grupo A · Estado: PENDIENTE

- Archivos (exclusivos): `apps/web/src/components/send/SendHowSheet.tsx`,
  `apps/web/src/components/send/ReceiveSheet.tsx`, `apps/web/src/styles.css`,
  `apps/web/src/views/LibraryView.tsx`, `apps/web/src/i18n/parcel.ts`
- Leer como contexto: `apps/web/src/components/Sheet.tsx`, `apps/web/src/App.tsx` (efecto de las
  líneas ~309-315), `apps/web/src/i18n/share.ts` (`share.friendsTitle`, `share.button`),
  `apps/web/src/i18n/eu.ts` (`nav.playlists`)
- Qué hacer:
  1. `SendHowSheet` y `ReceiveSheet`: cambia el `<div className="backdrop">…<div className="sheet
dl-sheet" role="dialog">` por `<Sheet label={t('parcel.sendHowTitle')} className="sheet
dl-sheet" onClose={onClose}>` (en `ReceiveSheet`, `label` = la clave de su título actual),
     **dentro** del `createPortal(…, document.body)` que ya tienen. Mismo contenido. Así ganan
     Escape y nombre accesible.
  2. `styles.css`: dentro de un `@media (hover: hover) and (pointer: fine)` (junto al de
     `.btn:hover`, línea ~371) añade `.btn.on:hover:not(:disabled) { background:
var(--accent-soft); color: var(--accent); }` para que el aleatorio grande y Seleccionar
     activos sigan en ámbar con el ratón encima.
  3. `LibraryView.tsx`: en el efecto de `?select=1`, tras `startSelection()`, quita el parámetro
     con `navigate('/', { replace: true })` (`const [, navigate] = useLocation()` de wouter).
     Comprueba que no rompe la excepción de `App.tsx`: allí el efecto depende de `location`
     (solo la ruta, sin `?…`), así que pasar de `/?select=1` a `/` no lo vuelve a ejecutar y la
     selección sigue. Compruébalo a mano (abajo); si en esta versión de wouter `location`
     incluyera el `?`, no toques `App.tsx`: avisa en la entrega.
  4. `parcel.ts`, `parcel.sendHowPlaylist`: es «Para compartir una playlist entera, ve a Playlists
     → Con amigos → Compartir.»; en «To share a whole playlist, go to Playlists → With friends →
     Share.»; eu con los nombres reales de la interfaz: «Playlist oso bat partekatzeko, joan
     Zerrendak → Lagunekin → Partekatu atalera.» (hoy pone «Playlistak», que no es el nombre de la
     pestaña, `nav.playlists` = «Zerrendak»).
- TDD: no
- Criterios de aceptación:
  - [ ] Con la hoja «Enviar» o «Recibir» abierta, Escape la cierra y el diálogo tiene nombre.
  - [ ] En ordenador, con el aleatorio grande activo, el ratón encima no le quita el ámbar.
  - [ ] Enviar → «Elegir canciones» abre la Biblioteca en modo selección, la URL queda en `/` y la
        selección sigue activa; ir a otra pantalla y volver ya no la reactiva.
  - [ ] Test de paridad i18n en verde.
- Verificación: `npm run check`; manual en `npm run dev` (y en Descargas con
  `npm run build -w @aske/web -- --mode fakenative`; después reconstruye el dist normal).

### T2 · Conectar el vigilante al reproductor y notificación honesta · Grupo B · Estado: PENDIENTE

- Depende de: T1.
- Archivos (exclusivos): `apps/web/src/stores/player.ts`, `apps/web/src/player/mediaSession.ts`
- Leer como contexto: `apps/web/src/player/stallWatchdog.ts`, `apps/web/src/native/mediaControls.ts`
- Qué hacer:
  - `mediaSession.ts`: añade `setStalled` y `setRetryHandler` según el contrato. La acción `play`
    usa el `retryHandler` si está atascado. Función de posición forzada sin el freno de 1 s.
  - `player.ts`, dentro de `create(...)`: nueva `async function reloadCurrent()` (< 25 líneas):
    solo si `mode === 'track'` y hay `currentId`; `at = pendingSeek ?? audio.currentTime`;
    `seq = ++loadSeq`; `src = await sourceFor(id)`; si cambió `loadSeq` o `currentId`, revoca el
    `blob:` y sale; si `src` es null, sale (el vigilante lo reintentará); si no, `resetSource()`,
    `objectUrl` si es blob, `pendingSeek = at > 0 ? at : null`, `audio.src = src`,
    `audio.playbackRate = audio.defaultPlaybackRate = get().rate`, `audio.play().catch(() =>
undefined)`. **No** llama a `step`, ni a `recordShufflePlay`, ni cambia `listenedMarked`.
    Regístrala como `engine.reloadCurrent`.
  - Tras crear la media session, crea el vigilante con `createStallWatchdog({ sample, now:
() => performance.now(), onAction, onStalledChange: setStalled, log, setInterval: (f, ms) =>
setInterval(f, ms) })`:
    - `sample`: `active` según el contrato, `trackId: currentId`, `currentTime`, `readyState`,
      `online: navigator.onLine`.
    - `onAction`: `nudge` → `audio.currentTime = audio.currentTime; void audio.play().catch(() =>
undefined)`; `reload` → `void engine.reloadCurrent()`; `give-up` → `audio.pause()` y
      `buffering: false` (sin toast).
    - `log`: `console.warn('[aske-stall]', event, detail)`.
    - `setRetryHandler(() => watchdog.retryNow())`.
  - Eventos: `stalled` y `waiting` → además `watchdog.check()`; `playing` → además
    `setPlaybackState('playing')` (vuelve a decirle a la notificación que suena);
    `window` `online` → `if (watchdog.isStalled()) watchdog.retryNow()`.
  - `error`: al principio de la rama de canciones, si `isMidSongNetworkError({ code:
audio.error?.code ?? null, mode: s.mode, currentTime: audio.currentTime })` →
    `watchdog.retryNow()` y `return` (sin toast ni salto). El resto, igual que hoy.
  - `player.ts` debe quedar < 800 líneas; si te pasas, mueve el cableado (crear el vigilante y
    los listeners nuevos) a `apps/web/src/player/stallRecovery.ts` (nuevo, también exclusivo de
    esta tarea) con `attachStallRecovery(audio, deps)`.
- TDD: no (la lógica la cubren los tests de T1; esto es cableado). Los tests existentes deben
  seguir en verde.
- Criterios de aceptación:
  - [ ] En `npm run dev` (Chrome), con una canción de Cloudflare larga sonando: DevTools → Network
        → Offline hasta que se acabe el búfer (o «Slow 3G» + seek lejos). La notificación del
        navegador/lockscreen pasa a pausa con la posición real a los ~3 s; al quitar Offline, la
        música vuelve en ≤ 6 s en el mismo segundo y en la misma canción, sin avisos.
  - [ ] Pausar a mano, cambiar de canción, terminar la lista o terminar el modo estudio nunca
        provocan reanudaciones.
  - [ ] En consola salen `[aske-stall] stall`, `retry` y `recovered`.
  - [ ] `npm run check` y `npm run test:e2e` en verde.
- Verificación: `npm run check`; `npm run test:e2e` (cierra wrangler/workerd colgados después).

### T4 · Subida a v0.9.1 y notas de release · Grupo C · Estado: PENDIENTE

- Depende de: T1, T2, T3.
- Archivos (exclusivos): `package.json`, `apps/api/package.json`, `apps/hub/package.json`,
  `apps/mobile/package.json`, `apps/web/package.json`, `packages/shared/package.json`,
  `tools/ingest/package.json`, `package-lock.json`, `docs/releases/v0.9.1.md` (nuevo)
- Leer como contexto: `docs/releases/v0.9.0.md` (formato y tono)
- Qué hacer:
  - Con un script de node (no sed ni a mano, no `npm install`) pon `"version": "0.9.1"` en los 7
    `package.json` y en las 8 entradas del lock: `version` de la raíz, `packages[""]` y
    `packages["apps/api"|"apps/hub"|"apps/mobile"|"apps/web"|"packages/shared"|"tools/ingest"]`.
    Conserva el formato (JSON con 2 espacios y salto de línea final).
  - `docs/releases/v0.9.1.md` en lenguaje sencillo: la música de la nube ya no se queda muda con
    la pantalla apagada (se reanuda sola en el mismo punto) y la notificación ya no avanza si la
    música está parada; arreglos menores (botones táctiles, tema, Seleccionar, modo estudio,
    Enviar/Recibir, entrada a Grupos desde Playlists).
  - No hagas push, tag ni deploy (lo hace Andoni).
- TDD: no
- Criterios de aceptación:
  - [ ] `git diff` muestra 0.9.1 en 7 `package.json` y 8 líneas del lock, nada más.
- Verificación: `npm ci` sin cambios en el lock y `npm run check`.

### T5 · Documentación y nota de prueba en el móvil · Grupo C · Estado: HECHA

- Depende de: T1, T2, T3.
- Archivos (exclusivos): `docs/ESTADO.md`, `docs/v2/architecture.md`, `docs/plan/PLAN.md`
- Qué hacer:
  - `ESTADO.md` en **≤ 30 líneas**: resume «Hecho» (junta v0.8.x y arreglos tras v0.9.0 en pocas
    líneas); v0.9.1 lista para publicar (pasos: push, tag `v0.9.1`, `npm run deploy`). En
    «Problemas conocidos», sustituye el bloque largo del corte por 2-3 líneas: vigilante en web,
    causa de la notificación, y que si sigue pasando el siguiente paso es nativo.
  - Añade en «En curso» la **prueba para Andoni** (APK v0.9.1): (1) escuchar canciones de
    Cloudflare 30-60 min con la pantalla apagada, mejor moviéndose entre Wi-Fi y datos; (2) prueba
    forzada: canción larga de Cloudflare, pantalla apagada, modo avión ~1-2 min hasta que se
    corte, quitar modo avión → debe volver sola en ≤ 10 s en el mismo segundo y en la misma
    canción; mientras está parada, la notificación debe estar en pausa y no avanzar; (3) si aun así
    se corta, conectar USB y mirar `adb logcat | findstr aske-stall`: si sale `freeze-gap` o no
    sale nada en el momento del corte, Android está congelando la app → hace falta la vía nativa.
  - `architecture.md`: solo una nota en la fila de F9 o en «arreglos» si la tabla lo necesita (no
    hay fase nueva).
  - Marca este PLAN como COMPLETADO.
- TDD: no
- Criterios de aceptación:
  - [ ] ESTADO.md ≤ 30 líneas y con la prueba para Andoni.
- Verificación: lectura.

## Entrega (la hace Andoni, no es tarea)

Tras T4 y T5: commits separados (`feat:` vigilante, `fix:` menores, `chore:` versión, `docs:`),
`git push`, tag `v0.9.1` (el CI construye el APK) y `npm run deploy` para la web.

## Riesgos / dudas abiertas

1. **Si es el sistema (no el usuario) el que pausa el audio, ¿se reanuda?**
   - **No reanudar (Recomendada):** el vigilante solo actúa si el audio dice «sonando» y no avanza.
     Nunca pelea con llamadas ni con otras apps; pero si Android pausa sin motivo, no se arregla.
   - **Reanudar pausas no pedidas por la app:** cubre más casos, pero no se puede distinguir una
     llamada de un fallo y podría sonar música encima de una llamada.
   - La recomiendo porque los síntomas (notificación avanzando) indican que no hubo `pause`.
2. **¿Qué muestra la notificación mientras se reintenta?**
   - **«En pausa» con la posición real (Recomendada):** honesta y sin tocar Java; el botón play
     fuerza un reintento. Durante unos segundos la notificación se puede deslizar para quitarla.
   - **Seguir en «reproduciendo» pero quieta:** haría falta cambiar el plugin nativo (no acepta
     velocidad 0). Más trabajo y otro APK.
   - La recomiendo porque cumple «que no mienta» sin código nativo.
3. **Cuando se rinde (8 intentos o 10 min), ¿avisa?**
   - **Pausa en silencio (Recomendada):** respeta «sin aviso visible»; al abrir la app se ve en
     pausa en el punto exacto.
   - **Pausa + aviso «No se pudo seguir reproduciendo»:** más claro, pero rompe la decisión.
4. **Riesgo:** si el corte viene de que Android congela el WebView entero, este arreglo no basta
   (el JS tampoco corre). Las trazas `[aske-stall]` y la prueba de T5 lo dirán; entonces tocará
   la opción nativa (latido en `AskeNative` o reproductor Media3), en una fase propia.
5. **Riesgo menor:** `player.ts` queda cerca de 800 líneas; T2 tiene permiso para sacar el cableado
   a `player/stallRecovery.ts`.

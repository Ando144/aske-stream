# PLAN: Pendientes de F6/F7 + F8a (estadísticas locales y Recap)

Fecha: 2026-11-20 · Estado: COMPLETADO

## Objetivo

1. Cerrar los pendientes MEDIO de la F6 (asistente de Cloudflare) y la F7 (Jams), y revisar el euskera de `share.ts` y `jam.ts`.
2. F8a: registrar en este dispositivo (IndexedDB) qué canciones se escuchan, solo con consentimiento explícito, y mostrar una pantalla «Recap» con tarjetas por mes o por año. Los datos nunca salen del dispositivo. Nada de 8b (grupos).

## Decisiones de arquitectura

- Pendiente F7: el cierre 4001 (`replaced`) pasa a ser final en `JamSocket` y se muestra un aviso «La Jam está abierta en otra pestaña» con un botón «Usar aquí» — así dos pestañas no se echan en bucle y el usuario sabe qué pasa.
- Pendiente F7: en `room.ts` cada `send()`/`close()` del broadcast va en try/catch con `console.error` — un socket roto no debe tumbar el aviso al resto.
- Pendiente F6: tras `subdomain_taken` se conserva el token en memoria (variable de módulo, como ahora) y «Intentarlo de nuevo» vuelve a «Elige un nombre»; solo ese error lo conserva.
- Pendiente F6: `RunningStep` exporta su lista de pasos y un test la compara con el orden real de `runSetup`/`runUpdate` (hoy en `setup` el orden de `storage`/`database` está cambiado y en `update` falta `database`).
- F8a: nuevo módulo `apps/web/src/stats/` (lógica pura + repositorio) en vez de tocar `stores/player.ts` (ya tiene ~790 líneas): un «tracker» se suscribe a `usePlayer` y lee `position`, `isPlaying`, `currentId`.
- F8a: cada escucha guarda una foto de título/artista/álbum, no solo el `trackId` — los ids cambian entre almacenamientos (dispositivo, Drive, Cloudflare) y el Recap debe sobrevivir a borrar canciones o cambiar de almacenamiento.
- F8a: se guardan las escuchas que llegan al umbral y también las saltadas antes del umbral (`skipped: true`, decisión de Andoni). Las saltadas quedan fuera de minutos, tops y rachas; solo se cuentan aparte en una tarjeta «Saltadas».
- F8a: el consentimiento se guarda con `loadPref/savePref` (`lib/storage`, síncrono) con tres estados `unset | on | off`; por defecto `unset` = no se registra nada.
- F8a: DESACTIVAR borra todo el historial (decisión de Andoni), con confirmación previa «Se borrará tu historial». Sigue existiendo «Borrar historial» sin desactivar.
- F8a: IndexedDB `aske` pasa a versión 4 con el almacén `plays` (índice por fecha). Los tests usan un repositorio en memoria (no hay `fake-indexeddb` en el proyecto).
- F8a: radio y podcasts NO cuentan, solo música (solo `mode === 'track'` y `kind !== 'podcast'`).
- F8a: umbral = el menor entre 30 s y la mitad de la canción.
- F8a: nombres de meses con `Intl.DateTimeFormat` en el idioma actual, sin claves nuevas.

## Contratos (interfaces compartidas)

### F7 · `apps/web/src/hub/jamSocket.ts`

```ts
export type JamSocketStatus = 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'closed';
/** Another tab/device of the same member took over this seat. Final: never reconnect. */
export const JAM_CLOSE_REPLACED = 4001;
```

### F7 · `apps/web/src/stores/jam.ts`

```ts
export type JamConnection = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'ended';
// new action in JamState:
takeOver(): void; // reconnects the current session in this tab (the other one gets 4001)
```

Claves nuevas en `i18n/jam.ts` (es/en/eu): `jam.replaced.text`, `jam.replaced.useHere`.

### F6 · `apps/web/src/components/cloudflareSetup/RunningStep.tsx`

```ts
export const RUNNING_STEPS: Record<SetupMode, SetupStep[]>;
// setup:  ['account','subdomain','storage','database','migrations','files','worker','publish','waiting']
// update: ['account','database','migrations','files','worker','waiting']
```

Clave nueva en `i18n/cloudflareSetup.ts` (es/en/eu): `cfsetup.error.otherName` («Elegir otro nombre»).

### F8a · `apps/web/src/stats/listen.ts` (lógica pura, sin imports de stores)

```ts
export const MIN_LISTEN_SEC = 30;
/** Forward jumps bigger than this between two samples are seeks, not listening. */
export const MAX_STEP_SEC = 3;

export interface PlayerSample {
  trackId: string | null; // null = nothing countable is playing
  isPlaying: boolean;
  position: number; // seconds
  durationSec: number; // 0 when unknown
  now: number; // epoch ms
}
export interface ListenSession {
  trackId: string;
  startedAt: number; // epoch ms of the first sample
  lastPosition: number;
  listenedSec: number; // real listened time, seeks excluded
  durationSec: number;
  counted: boolean; // threshold already reached
}
/** min(30, duration / 2); 30 when the duration is unknown. */
export function countThreshold(durationSec: number): number;
export function startSession(sample: PlayerSample & { trackId: string }): ListenSession;
/** Adds `position - lastPosition` only when playing and 0 < delta <= MAX_STEP_SEC. */
export function advanceSession(
  s: ListenSession,
  sample: PlayerSample,
): { session: ListenSession; justCounted: boolean };
/** Same track restarted from the start after reaching the end (repeat one): a new listen. */
export function isRestart(s: ListenSession, sample: PlayerSample): boolean;
// isRestart: sample.position < 2 && s.durationSec > 0 && s.lastPosition >= s.durationSec - 3
```

### F8a · `apps/web/src/stats/recap.ts` (lógica pura)

```ts
export interface PlayRecord {
  id: string; // crypto.randomUUID()
  trackId: string;
  title: string;
  artist: string; // '' when unknown
  album: string;
  startedAt: number; // epoch ms
  listenedSec: number;
  durationSec: number;
  /** true = ended before the threshold (skipped). Excluded from minutes, tops and streaks. */
  skipped: boolean;
}
export type RecapPeriod =
  | { kind: 'month'; year: number; month: number } // month 1-12
  | { kind: 'year'; year: number };
/** Local time, half-open range [from, to) in epoch ms. */
export function periodRange(p: RecapPeriod): { from: number; to: number };
/** Moves the period by `delta` months or years. */
export function shiftPeriod(p: RecapPeriod, delta: number): RecapPeriod;
export function currentPeriod(kind: RecapPeriod['kind'], now: number): RecapPeriod;

export interface TopTrack {
  title: string;
  artist: string;
  plays: number;
  minutes: number;
}
export interface TopArtist {
  artist: string;
  plays: number;
  minutes: number;
}
export interface RecapSummary {
  plays: number; // only skipped === false
  skipped: number; // only skipped === true; nothing else uses them
  minutes: number; // Math.round(sum(listenedSec of non-skipped) / 60)
  distinctTracks: number; // non-skipped
  distinctArtists: number; // non-skipped; '' does not count as an artist
  activeDays: number; // days with >= 1 non-skipped play
  longestStreakDays: number; // consecutive local days with >= 1 non-skipped play, inside the period
  topTracks: TopTrack[]; // max 5
  topArtists: TopArtist[]; // max 5, '' excluded
}
/** Only records inside the period are used. */
export function buildRecap(records: PlayRecord[], period: RecapPeriod): RecapSummary;
```

- Agrupar canciones por `title.trim().toLowerCase() + '|' + artist.trim().toLowerCase()`; artistas por `artist.trim().toLowerCase()`. Mostrar el texto tal como aparece en la primera escucha.
- Orden de los tops: más escuchas, luego más minutos, luego título/artista alfabético.

### F8a · `apps/web/src/stats/repo.ts`

```ts
export interface StatsRepo {
  put(record: PlayRecord): Promise<void>; // insert or update by id
  listBetween(from: number, to: number): Promise<PlayRecord[]>;
  clear(): Promise<void>;
}
export const idbStatsRepo: StatsRepo; // uses getDb() from offline/db.ts
export function memoryStatsRepo(): StatsRepo; // for tests
```

### F8a · `apps/web/src/offline/db.ts` (versión 4)

```ts
plays: { key: string; value: PlayRecord; indexes: { 'by-startedAt': number } };
// upgrade: if (oldVersion < 4) createObjectStore('plays', { keyPath: 'id' }).createIndex('by-startedAt', 'startedAt')
```

### F8a · `apps/web/src/stores/stats.ts`

```ts
export type StatsConsent = 'unset' | 'on' | 'off';
interface StatsState {
  consent: StatsConsent; // persisted with savePref('stats-consent', …)
  /** on → 'on'. off → 'off' at once (stops recording) and then clears the whole history;
   *  returns false if clearing failed (console.error + toast t('stats.err.clear')). */
  setEnabled(on: boolean): Promise<boolean>;
  clearHistory(): Promise<boolean>; // keeps consent; true = ok; on error console.error + toast t('stats.err.clear')
  loadRecap(period: RecapPeriod): Promise<RecapSummary>; // throws; the view shows t('stats.err.load')
}
export const useStats: UseBoundStore<StoreApi<StatsState>>;
export function setStatsRepo(repo: StatsRepo): void; // tests only
export function getStatsRepo(): StatsRepo;
```

### F8a · `apps/web/src/stats/tracker.ts`

```ts
export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  durationSec: number;
}
export interface ListenTrackerDeps {
  repo: StatsRepo;
  isEnabled(): boolean; // useStats.getState().consent === 'on'
  lookupTrack(id: string): TrackInfo | null; // null for podcasts or unknown tracks
  newId(): string;
}
export interface ListenTracker {
  onSample(sample: PlayerSample): void;
  flush(): void; // writes the open session if counted
}
export function createListenTracker(deps: ListenTrackerDeps): ListenTracker;
/** Wires the tracker to usePlayer, useLibrary and pagehide. Returns an unsubscribe. */
export function startListeningTracker(): () => void;
```

Reglas del tracker: cambia el `trackId` o `isRestart` → se cierra la sesión y empieza otra; `justCounted` → `repo.put` del registro con `skipped: false`; después vuelve a hacer `put` (mismo `id`) cada 15 s de escucha añadida, al pausar, al cambiar de canción y en `pagehide`. Al CERRAR una sesión (cambio de canción, repetir-una, `mode` deja de ser `track`) que no llegó al umbral y tiene `listenedSec >= 1`, se guarda con `skipped: true` (por debajo de 1 s no es una escucha: pasar canciones rápido no llena el historial). `pagehide` NO guarda sesiones sin contar (la app se cerró, no se saltó). Si `isEnabled()` es false no guarda nada y descarta la sesión. Errores de `put` → `console.warn`, sin toast (no molestar en cada canción).

### F8a · Claves i18n (archivo nuevo `apps/web/src/i18n/stats.ts`, exporta `statsEn`, `statsEs`, `statsEu`)

`nav.recap`, `stats.title`, `stats.help`,
`stats.consent.title`, `stats.consent.body`, `stats.consent.accept`, `stats.consent.decline`,
`stats.off.text`, `stats.off.enable`,
`stats.period.month`, `stats.period.year`, `stats.period.prev`, `stats.period.next`,
`stats.empty`,
`stats.card.minutes`, `stats.card.plays`, `stats.card.skipped`, `stats.card.tracks`, `stats.card.artists`, `stats.card.activeDays`, `stats.card.streak`, `stats.card.topTracks`, `stats.card.topArtists`,
`stats.days` + `stats.days.one` (`{count} días`), `stats.playsCount` + `stats.playsCount.one` (`{count} escuchas`), `stats.minutesCount` + `stats.minutesCount.one` (`{count} min`), `stats.unknownArtist`,
`stats.settings.section`, `stats.settings.open`, `stats.settings.openHint`, `stats.settings.enable`, `stats.settings.enableHint`, `stats.settings.clear`, `stats.settings.clearHint`, `stats.settings.clearConfirm`, `stats.settings.clearButton`, `stats.settings.disableConfirm`, `stats.settings.disableButton`, `stats.cleared`,
`stats.err.load`, `stats.err.clear`.

### F8a · Ayuda y rutas

- Artículo id `listening-stats`, sección `listen`, archivo `apps/web/src/help/articles/stats.ts` (exporta `statsArticles`).
- Ruta `/recap` → `RecapView`. Barra lateral: `{ to: '/recap', key: 'nav.recap', Icon: BarChart3 }`. En móvil se llega desde Ajustes.

## Tareas

### T1 · Jam: cierre 4001 final y broadcast a prueba de fallos · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/hub/jamSocket.ts`, `apps/web/src/stores/jam.ts`, `apps/web/src/components/jam/JamRoom.tsx`, `apps/web/src/i18n/jam.ts`, `apps/web/test/jamSocket.test.ts`, `apps/web/test/jamStore.test.ts`, `apps/hub/src/jam/room.ts`, `apps/hub/test/jamRoom.test.ts`
- Leer como contexto: `apps/web/src/views/JamView.tsx`
- Qué hacer:
  1. `jamSocket.ts`: añadir `JAM_CLOSE_REPLACED = 4001` y el estado `'replaced'` (ver Contratos). En `handleClose`, si `code === 4001`: `stopped = true`, `onStatus('replaced')`, sin programar reconexión.
  2. `stores/jam.ts`: `JamConnection` incluye `'replaced'`; `connectionOf.replaced = 'replaced'`. Al llegar `'replaced'`: si es anfitrión, `stopWatching()` (deja de mandar en el reproductor); NO borrar la sesión guardada (`SESSION_KEY` es compartida con la otra pestaña). Nueva acción `takeOver()`: si hay `session`, `connect(session)`.
  3. `JamRoom.tsx`: si `connection === 'replaced'`, mostrar `jam.replaced.text` y un botón primario `jam.replaced.useHere` que llama a `takeOver()` (en vez de la sala). Mantener funciones < 50 líneas.
  4. `i18n/jam.ts`: añadir las 2 claves en en/es/eu. Textos: es «Esta Jam está abierta en otra pestaña o ventana. Solo puede estar activa en una.» / «Usar aquí»; en «This Jam is open in another tab or window. It can only be active in one.» / «Use it here»; eu «Jam hau beste fitxa edo leiho batean irekita dago. Bakar batean bakarrik egon daiteke aktibo.» / «Erabili hemen».
  5. `apps/hub/src/jam/room.ts`: en `broadcast`, `endJam` y `webSocketClose`, envolver cada `send()`/`ws.close()` en try/catch; en el catch `console.error('jam: send failed', err)` y seguir con el resto de sockets. Si queda una función > 50 líneas, extraer un helper `safeSend(ws, msg)`.
- TDD: sí
- Criterios de aceptación:
  - [ ] Test: un cierre 4001 emite `'replaced'` y no se vuelve a abrir el socket aunque avancen los timers.
  - [ ] Test: un cierre 1006 sigue reconectando (no se rompe lo que ya había).
  - [ ] Test del store: tras `'replaced'`, `connection === 'replaced'` y la sesión sigue en memoria; `takeOver()` vuelve a conectar.
  - [ ] Test del Hub: si `send()` de un socket lanza error, `webSocketClose` termina sin lanzar y los demás sockets reciben el estado.
- Verificación: `npx vitest run test/jamSocket.test.ts test/jamStore.test.ts test/i18n.test.ts --root apps/web` y `npx vitest run test/jamRoom.test.ts --root apps/hub`

### T2 · Asistente de Cloudflare: reintento, pasos y limpieza · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/cloudflareSetup.ts`, `apps/web/src/components/cloudflareSetup/RunningStep.tsx`, `apps/web/src/components/cloudflareSetup/ErrorStep.tsx`, `apps/web/src/views/CloudflareSetupView.tsx`, `apps/web/src/views/PairView.tsx`, `apps/web/src/i18n/cloudflareSetup.ts`, `apps/web/test/cloudflareSetup.test.ts`
- Leer como contexto: `apps/web/src/cloudflare/setup.ts`, `apps/web/src/lib/` (busca `takeFromHash` con Grep)
- Qué hacer:
  1. `stores/cloudflareSetup.ts`: en `run()`, si el error es `subdomain_taken` NO borrar `token` (en el resto de casos se sigue borrando). En `retry()`: si `error === 'subdomain_taken' && token`, ir a `phase: 'chooseSubdomain'` con un `suggestedSubdomain` nuevo y `error: null`. Actualizar el comentario «The token was already discarded» para que siga siendo cierto. `cancel()` ya borra los secretos.
  2. `ErrorStep.tsx`: para `subdomain_taken` el botón usa la clave nueva `cfsetup.error.otherName` (es «Elegir otro nombre», en «Choose another name», eu «Aukeratu beste izen bat»). Añadirla en `i18n/cloudflareSetup.ts` en los 3 idiomas.
  3. `RunningStep.tsx`: exportar `RUNNING_STEPS` con el orden de Contratos (corrige `storage`/`database` en `setup` y añade `database` en `update`).
  4. `CloudflareSetupView.tsx`: bajar la función de 52 a < 50 líneas extrayendo el `useEffect` + `exit` a un hook `useSetupLifecycle(mode, onExit)` en el mismo archivo. Sin cambiar comportamiento.
  5. `PairView.tsx`: comentar el porqué de `useHashCredentials` (por qué las dependencias vacías son intencionadas y por qué se lee del hash y se quita: no dejar la clave en la URL/historial). Comprueba qué hace `takeFromHash` antes de escribirlo.
- TDD: sí (puntos 1 y 3)
- Criterios de aceptación:
  - [ ] Test: tras `subdomain_taken`, `retry()` lleva a `chooseSubdomain` sin pedir token, y `chooseSubdomain('otro')` despliega hasta `done` con la API simulada.
  - [ ] Test: `expectNoSecret` sigue pasando en el estado de zustand (el token solo vive en la variable de módulo).
  - [ ] Test: `RUNNING_STEPS.setup` es `['account', ...pasos emitidos por runSetup]` y `RUNNING_STEPS.update` es igual a los pasos de `runUpdate`.
  - [ ] Ninguna función de `CloudflareSetupView.tsx` pasa de 50 líneas.
- Verificación: `npx vitest run test/cloudflareSetup.test.ts test/i18n.test.ts --root apps/web`

### T3 · Lógica pura de escuchas y Recap · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stats/listen.ts`, `apps/web/src/stats/recap.ts`, `apps/web/test/statsListen.test.ts`, `apps/web/test/statsRecap.test.ts`
- Leer como contexto: `apps/web/src/offline/planner.ts` y `apps/web/test/planner.test.ts` (estilo de lógica pura + tests)
- Qué hacer: implementar exactamente las firmas de Contratos para `listen.ts` y `recap.ts`. Sin imports de stores, React ni IndexedDB. Fechas en hora local (`new Date(year, month - 1, 1)`). Racha: días locales consecutivos con al menos una escucha dentro del periodo. Funciones < 50 líneas.
- TDD: sí
- Criterios de aceptación:
  - [ ] `countThreshold(200) === 30`, `countThreshold(40) === 20`, `countThreshold(0) === 30`.
  - [ ] Muestras cada 0,25 s sumando hasta 30 s → `justCounted` true una sola vez; en pausa no suma; un salto de +60 s (seek) no suma; un salto atrás no resta.
  - [ ] `isRestart` detecta repetir-una y no confunde un seek atrás a mitad de canción.
  - [ ] `buildRecap`: los registros `skipped: true` solo suman en `skipped` (no en `plays`, minutos, tops, canciones/artistas distintos, días activos ni racha); un día con solo saltadas rompe la racha.
  - [ ] `buildRecap`: ignora registros fuera del periodo; agrupa «Song»/«song » del mismo artista; excluye artista vacío del top y del recuento; minutos redondeados; racha correcta con huecos y con cambio de mes; tops limitados a 5 con el orden de Contratos.
  - [ ] `periodRange`/`shiftPeriod` cruzan bien diciembre → enero y años.
- Verificación: `npx vitest run test/statsListen.test.ts test/statsRecap.test.ts --root apps/web`

### T4 · Revisión del euskera de share.ts y jam.ts · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/share.ts`, `apps/web/src/i18n/jam.ts`, `docs/eu-revision-share-jam.md` (nuevo)
- Leer como contexto: `apps/web/src/i18n/eu.ts` (tono y vocabulario ya usados: «abestia», «zerrenda», «Saiatu berriro»…)
- Qué hacer: revisar SOLO los objetos `shareEu` y `jamEu` (incluidas las 2 claves nuevas de T1). Corregir únicamente lo evidente: erratas, concordancia, palabras en castellano/inglés sin traducir, inconsistencias con `eu.ts`. NO inventar ni reescribir por estilo. Todo lo dudoso se deja como está y se apunta en `docs/eu-revision-share-jam.md` con una tabla: clave · texto actual · propuesta · por qué hay duda. Al principio del archivo, lista breve de lo que SÍ se cambió.
- TDD: no
- Criterios de aceptación:
  - [ ] Solo cambian valores en euskera; ninguna clave nueva ni borrada.
  - [ ] Existe `docs/eu-revision-share-jam.md` con «Cambios hechos» y «Dudas para Andoni».
  - [ ] El test de paridad sigue verde.
- Verificación: `npx vitest run test/i18n.test.ts --root apps/web`

### T5 · Guardar escuchas: IndexedDB, store y tracker · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/offline/db.ts`, `apps/web/src/stats/repo.ts`, `apps/web/src/stats/tracker.ts`, `apps/web/src/stores/stats.ts`, `apps/web/test/statsTracker.test.ts`, `apps/web/test/statsStore.test.ts`
- Leer como contexto: `apps/web/src/stats/listen.ts`, `apps/web/src/stats/recap.ts` (de T3), `apps/web/src/stores/player.ts` (líneas 57-110 y 564-620: estado y eventos), `apps/web/src/stores/prefs.ts`, `apps/web/src/lib/storage.ts`, `apps/web/src/stores/library.ts` (forma de `tracks`), `apps/web/src/stores/ui.ts` (busca `toast`)
- Qué hacer:
  1. `offline/db.ts`: subir a versión 4 y crear `plays` con índice `by-startedAt` (Contratos). No tocar las migraciones anteriores.
  2. `stats/repo.ts`: `idbStatsRepo` (`listBetween` con `IDBKeyRange.bound(from, to, false, true)` sobre el índice) y `memoryStatsRepo()`.
  3. `stores/stats.ts`: según Contratos. `consent` se lee con `loadPref('stats-consent', 'unset')`. `loadRecap` = `repo.listBetween(periodRange)` + `buildRecap`.
  4. `stats/tracker.ts`: `createListenTracker` (lógica testeable con dependencias inyectadas) y `startListeningTracker()` que: se suscribe a `usePlayer` y construye el `PlayerSample` (`trackId` null si `mode !== 'track'`); `lookupTrack` usa `useLibrary.getState().tracks[id]` y devuelve null si `kind === 'podcast'`; `durationSec` = `track.durationMs / 1000` o, si es 0, `usePlayer.getState().duration`; añade `pagehide` → `flush()`; al pasar el consentimiento a `off` descarta la sesión abierta. No modificar `stores/player.ts`.
- TDD: sí
- Criterios de aceptación:
  - [ ] Test tracker: con consentimiento `unset` u `off` no se llama a `repo.put` aunque se escuche 5 min.
  - [ ] Test tracker: con `on`, una canción de 3 min escuchada 40 s guarda 1 registro con título/artista, `skipped: false` y `listenedSec ≈ 40`.
  - [ ] Test tracker: escuchada 10 s y pasar a otra canción guarda 1 registro con `skipped: true` y `listenedSec ≈ 10`; escuchada 0,5 s no guarda nada; cerrar la app (`flush` por `pagehide`) a los 10 s no guarda nada.
  - [ ] Test tracker: repetir-una produce 2 registros; un podcast o la radio (lookup null / `trackId` null) ninguno.
  - [ ] Test store: `setEnabled(true)` persiste `'on'`; `setEnabled(false)` persiste `'off'` y deja el repo vacío; `clearHistory()` vacía el repo sin cambiar `consent`; si el repo falla, ambos devuelven false y `consent` queda en `'off'` igualmente al desactivar.
  - [ ] Funciona igual con los tres almacenamientos porque solo depende de `usePlayer`/`useLibrary` (comprobar que no hay nada específico de un almacenamiento).
- Verificación: `npx vitest run test/statsTracker.test.ts test/statsStore.test.ts --root apps/web` y `npm run typecheck -w @aske/web` (si no existe ese script, `npx tsc -p apps/web --noEmit`)

### T6 · Textos, ayuda y documentación de la F8a · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/stats.ts` (nuevo), `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/src/help/articles/stats.ts` (nuevo), `apps/web/src/help/articles.ts`, `docs/v2/architecture.md`, `docs/PRIVACY.md`
- Leer como contexto: `apps/web/src/i18n/jam.ts` (patrón de archivo por función), `apps/web/src/help/articles/listen.ts` y `privacy.ts` (estilo e ids para enlazar), `apps/web/test/help.test.ts`
- Qué hacer:
  1. `i18n/stats.ts` con todas las claves de Contratos en en/es/eu (`statsEs`/`statsEu` tipados como `Record<keyof typeof statsEn, string>`), y añadir `...statsEn` / `...statsEs` / `...statsEu` en `en.ts`, `es.ts`, `eu.ts`. Lenguaje sencillo, sin jerga. El texto de consentimiento debe decir: qué se guarda (qué canciones escuchas, cuánto tiempo, y también las que saltas antes de tiempo), que la radio y los podcasts no se guardan, dónde (solo en este móvil u ordenador), que nunca se envía a nadie, que está apagado hasta que aceptes, y que **si lo desactivas se borra todo tu historial** (también puedes borrarlo sin desactivarlo en Ajustes). `stats.settings.disableConfirm` es «Si lo desactivas, se borrará tu historial de escuchas y no se podrá recuperar.» y `stats.settings.disableButton` «Desactivar y borrar». `stats.card.skipped` es «Saltadas». `stats.empty` explica que una canción cuenta a los 30 segundos (o a la mitad si es muy corta). Errores: `stats.err.load` «No se ha podido abrir tu resumen. Cierra la app y vuelve a abrirla.»; `stats.err.clear` «No se ha podido borrar el historial. Inténtalo de nuevo.» (traducir igual a en/eu).
  2. `help/articles/stats.ts`: artículo `listening-stats` (sección `listen`) en es/en/eu: qué es el Recap, cómo activarlo, que **desactivarlo borra todo el historial**, cuándo cuenta una escucha (30 s o la mitad si la canción es corta), que también se guardan las canciones saltadas antes pero no suman minutos ni salen en los tops (solo en «Saltadas»), que la radio y los podcasts no cuentan, que los datos solo están en este dispositivo (no pasan a otro móvil ni al cambiar de almacenamiento; si borras los datos de la app se pierden) y cómo borrar el historial. Enlazar a algún artículo de privacidad existente con `[[id|texto]]`. Registrarlo en `articles.ts`.
  3. `docs/v2/architecture.md`: en la tabla de fases, la fila 7 pasa a «✅» (el Hub ya está desplegado) y la fila 8 se divide en «8a Local listening stats (opt-in, on this device only) and monthly/yearly Recap» (estado «🚧 in progress») y dejar 8b como está.
  4. `docs/PRIVACY.md` (aprobado por Andoni): añadir un párrafo corto: las estadísticas de escucha son opcionales y están apagadas por defecto; si se activan, se guarda qué canciones escuchas, cuánto tiempo y cuáles saltas (no radio ni podcasts); se guardan solo en el dispositivo y no se envían a nadie (ni a Andoni ni a Google ni a Cloudflare); desactivarlas borra todo el historial y también se puede borrar desde Ajustes.
- TDD: no
- Criterios de aceptación:
  - [ ] Test de paridad i18n verde (incluidas las `.one`).
  - [ ] Test de ayuda verde (enlaces entre artículos válidos).
  - [ ] Tabla de fases actualizada.
- Verificación: `npx vitest run test/i18n.test.ts test/help.test.ts --root apps/web`

### T7 · Pantalla Recap, consentimiento y ajustes · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/RecapView.tsx` (nuevo), `apps/web/src/components/stats/ConsentSheet.tsx` (nuevo), `apps/web/src/components/stats/RecapCards.tsx` (nuevo), `apps/web/src/components/stats/PeriodPicker.tsx` (nuevo), `apps/web/src/components/stats/StatsSettingsPanel.tsx` (nuevo), `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/src/components/Nav.tsx`, `apps/web/src/views/SettingsView.tsx`, `apps/web/src/styles.css`
- Leer como contexto: `apps/web/src/stores/stats.ts`, `apps/web/src/stats/recap.ts`, `apps/web/src/i18n/stats.ts`, `apps/web/src/components/Sheet.tsx`, `apps/web/src/components/HelpSheet.tsx` (`HelpButton`), `apps/web/src/views/OfflineView.tsx` (estructura de página), `apps/web/src/stores/ui.ts` (`confirmDialog`, `toast`)
- Qué hacer:
  1. `main.tsx`: llamar una vez a `startListeningTracker()`.
  2. `App.tsx`: ruta `/recap` → `RecapView`. `Nav.tsx`: añadir el elemento de barra lateral de Contratos (después de `/jam`).
  3. `RecapView`: cabecera con `stats.title` y `HelpButton id="listening-stats"`. Si `consent === 'unset'` abre `ConsentSheet` (Aceptar → `setEnabled(true)`; No, gracias → `setEnabled(false)`). Si `'off'`: texto `stats.off.text` + botón `stats.off.enable`. Si `'on'`: `PeriodPicker` (conmutador Mes/Año y flechas anterior/siguiente; no dejar ir más allá del periodo actual; nombre del mes con `Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' })`) y `RecapCards` con el resultado de `loadRecap`. Estado vacío `stats.empty`; error → `stats.err.load` en `error-text`.
  4. `RecapCards`: tarjetas de minutos, escuchas, saltadas (`stats.card.skipped`, más discreta), canciones distintas, artistas distintos, días con música y racha más larga; listas Top 5 canciones y Top 5 artistas (artista vacío → `stats.unknownArtist`). Plurales con `{count}` y `.one`.
  5. `StatsSettingsPanel` en `SettingsView` (nueva sección `stats.settings.section` tras «Reproducción»): enlace a `/recap`, interruptor `stats.settings.enable` (mismo patrón `toggle` que «Ahorro de datos»); al APAGARLO, primero `confirmDialog(t('stats.settings.disableConfirm'), t('stats.settings.disableButton'), true)` y solo si acepta `setEnabled(false)` (si cancela, el interruptor sigue encendido); y botón «Borrar historial» con `confirmDialog(t('stats.settings.clearConfirm'), t('stats.settings.clearButton'), true)`; si va bien, toast `stats.cleared`.
  6. `styles.css`: estilos de tarjetas en rejilla usando solo variables existentes (`--accent`, etc.). Sin colores nuevos fuera de la paleta ámbar.
- TDD: no
- Criterios de aceptación:
  - [ ] Primera visita a `/recap`: aparece el diálogo; hasta aceptar no se guarda nada (comprobar en DevTools → IndexedDB → `aske` → `plays` vacío).
  - [ ] Tras aceptar y escuchar > 30 s una canción, el Recap del mes muestra 1 escucha; en Año también.
  - [ ] Desactivar en Ajustes pide confirmación, deja de registrar y deja `plays` vacío; cancelar la confirmación no cambia nada; «Borrar historial» deja el Recap vacío y sigue activado.
  - [ ] Saltar una canción a los 10 s suma 1 en «Saltadas» y no cambia minutos ni tops.
  - [ ] Probado con almacenamiento «Este dispositivo» y con Cloudflare en `npm run dev` (Drive comparte el mismo camino de reproductor).
  - [ ] Todas las funciones < 50 líneas; ningún texto sin traducir.
- Verificación: `npm run check`, después `npm run test:e2e` (reiniciar wrangler tras el build) y prueba manual en `npm run dev`.

## Riesgos / dudas abiertas

- `player.ts` está cerca de 800 líneas: por eso el tracker va aparte; si `position` dejara de actualizarse cada 250 ms el cálculo seguiría funcionando, pero con más error.
- Pueden quedar procesos wrangler/workerd colgados tras `test:e2e` en Windows (ver CLAUDE.md).
- `docs/ESTADO.md` (incluida la batería v0.7.0 medida en el Pixel) lo actualiza el orquestador al cerrar.
- Desactivar borra el historial: un toque sin querer lo perdería todo; por eso hay confirmación obligatoria antes de desactivar.
- Las dudas de euskera que deje T4 en `docs/eu-revision-share-jam.md` necesitan la validación de Andoni.
- Decisiones de Andoni ya aplicadas (2026-11-20): solo música; desactivar borra; las saltadas se guardan aparte; aviso Jam con «Usar aquí»; párrafo en PRIVACY.md; umbral = menor entre 30 s y la mitad.

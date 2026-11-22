# PLAN: v0.8.4 · notificación de descargas, arranque con mala cobertura y aleatorio de verdad

Fecha: 2026-11-22 · Estado: COMPLETADO

## Objetivo

1. Que la notificación de descargas refleje siempre el estado real: contador «3 de 12», canción actual,
   barra de progreso, fase «guardando» y aviso final, sin gastar batería.
2. Que con red «conectada pero que no funciona» la app abra en ≤ ~5 s (pantalla de arranque con logo
   animado, mínimo 1 s), pase a modo sin conexión con un banner suave y se recupere sola.
3. Que el aleatorio no repita canciones hasta acabar el ciclo, incluya las canciones nuevas y al empezar
   un ciclo nuevo no repita la última.

## Causas encontradas (diagnóstico)

**Notificación**

- Android descarta en silencio las actualizaciones de una notificación si una app manda más de ~5 por
  segundo («Shedding» en logcat). Hoy se manda una por cada 1 % de progreso
  (`stores/downloads.ts` → listener `progress` → `notify()` → `Downloader.setNotification` →
  `DownloadService.update` → `nm.notify`), más 2-3 extra por cada canción (`finished`, inicio y fin de
  `saveJob`). Con una canción que baja en 2-4 s son 25-50 actualizaciones/s: las últimas (100 %,
  «guardando», la siguiente canción) caen en la ráfaga y se pierden, y la notificación se queda congelada.
- Hay dos escritores del mismo ID (4242): JS cuando `jsKeepAlive` es true y el servicio cuando no.
  Si la WebView queda congelada en segundo plano con `jsKeepAlive` true, nadie actualiza.
- Al terminar se llama a `setNotification({active:false})` y el servicio hace `stopForeground(true)`:
  la notificación desaparece sin decir «terminado». La fase «guardando» no tiene texto propio.
- Con la app cerrada, el servicio no conoce el título de la canción (el `Job` solo guarda `videoId`).

**Arranque lento**

- `stores/setup.ts` `init()` espera `api.status()` (Cloudflare) y `hasSameOriginApi()` (todos los
  hogares) **sin tiempo máximo**: mientras, `App` enseña el spinner (`status === 'loading'`).
  `fetch` con red rota puede tardar minutos.
- `App.tsx` `useBackgroundSync` encadena `await sync()` (red sin tiempo máximo) antes de
  `useDownloads.init()` y `checkInbox()`: una llamada colgada bloquea todo lo que va detrás.
- `stores/library.ts` `load()` deja `loading: true` mientras la llamada cuelga, así que las
  sincronizaciones siguientes se ignoran.
- `storage/media.ts` usa `navigator.onLine` (true en el tren) para decidir si puede usar la nube:
  intenta Drive/Cloudflare y se queda esperando en vez de saltar a lo descargado.

**Aleatorio**

- `shuffled()` (`offline/planner.ts`) ya es Fisher-Yates correcto y no hay `sort(() => Math.random()…)`.
  El problema no es el barajado sino la memoria:
  - Cada vez que se pulsa «Aleatorio» (o se activa/desactiva) se baraja de cero: no se recuerda qué
    ha sonado ya, así que en días de uso se repiten canciones mucho antes de oír las 80 h.
  - Las canciones que se descargan después de empezar el aleatorio nunca entran en la cola
    (`context`/`original` se congelan al pulsar play).
  - Con el ahorro de datos (`orderForDataSaver`) y sin conexión, las no descargadas se saltan; no es
    un sesgo, pero hace que «suene lo mismo» si el ciclo se reinicia a menudo.

## Decisiones de arquitectura

- El servicio nativo es el **único que llama a `nm.notify(4242)`**, siempre a través de un
  `NotificationThrottle` (máx. 1 actualización/s de progreso; cambios de fase con ≥ 250 ms; la última
  gana) — evita el descarte de Android y ahorra batería.
- JS sigue componiendo el contenido mientras la app vive (sabe títulos, contador y fase «guardando»),
  pero solo lo envía si cambia y, para cambios solo de progreso, como mucho 1 vez/s — menos tráfico por el puente.
- Si JS lleva > 10 s sin enviar nada mientras el servicio descarga, el servicio escribe su propia
  notificación — por si la WebView está congelada.
- Aviso final con `setNotification({active:false, doneText})`: notificación aparte (ID 4243),
  **siempre** (app abierta o en segundo plano); se quita al tocarla o al abrir/volver a la app
  (`Downloader.clearDoneNotice()` al arrancar y en cada `visibilitychange` a visible) — decidido por Andoni.
- Barra = **progreso total del lote** (decidido por Andoni): `floor((terminadas + fracción de la actual)
/ total × 100)`; nunca retrocede dentro de un lote. Contador en el título; «guardando» y «esperando
  red» mantienen la barra total (sin barra indeterminada, para que no parpadee).
- Arranque: `withTimeout` común y un store `connectivity` con sonda ligera (4 s) y reintento
  automático con espera creciente (5 s → 60 s) — un solo sitio decide «hay red útil».
- Sonda de red **sin terceros** (decidido por Andoni): Cloudflare → su propio Worker; resto de hogares
  («Este dispositivo» y Drive) → el Hub propio (`/hub/v1/health`). Nada de `generate_204` de Google.
- Pantalla de arranque igual en `index.html` (antes de cargar JS) y en React — sin parpadeo; fondo
  `#14110F` como el splash de Android; logo `/favicon.svg` con animación ámbar; respeta
  `prefers-reduced-motion`.
- Aleatorio: **una memoria de ciclo por lista** (decidido por Andoni): «Biblioteca» (cada filtro y
  búsqueda cuenta como lista propia, p. ej. buscar un artista), cada playlist, «Me gusta», etc. Se
  guardan las 20 listas usadas más recientemente; volver a una lista retoma su ciclo. Orden = no oídas
  barajadas + oídas barajadas; al completar, nuevo ciclo sin empezar por la última — no repite hasta agotar.
- La lista «Biblioteca → Todo» queda «viva»: canciones nuevas se insertan en posiciones aleatorias
  por delante de la actual.

## Contratos (interfaces compartidas)

### C1 · Puente de notificación (T1 Java ↔ T5 TS)

`apps/web/src/native/downloader.ts`:

```ts
setNotification(options: {
  active: boolean;
  title?: string;     // p. ej. "Descargando 3 de 12"
  text?: string;      // p. ej. "Canción · quedan 9 en la cola"
  progress?: number;  // 0-100, progreso TOTAL del lote; -1 = barra indeterminada (JS ya no lo usa)
  doneText?: string;  // solo con active:false; si no está vacío, el móvil muestra el aviso final
}): Promise<void>;
/** Removes the final "downloads finished" notice (ID 4243) if present. No-op on web. */
clearDoneNotice(): Promise<void>;
```

`apps/web/src/downloads/types.ts`:

```ts
export interface NativeJob {
  jobId: string;
  videoId: string;
  title?: string;
} // title ≤ 200 chars
```

Java: `DownloadQueue.Job` añade `final String title` (puede ser ""), se guarda/lee en el JSON
(`"title"`), y `DownloaderPlugin.queue` lo lee con `optString("title")` recortado a 200.
Notificación nativa (app cerrada o JS congelado): título = `texts.progress` con `{done}`/`{total}`,
texto = título de la canción actual (o `texts.waiting` si espera red),
barra = progreso total = `(done * 100 + pctActual) / total` (con `pctActual` = 0 si espera red).
Plugin: método nuevo `clearDoneNotice` → `DownloadService.clearDone(Context)` (cancela ID 4243).
`NotificationTemplates` no cambia.

### C2 · Contenido de la notificación en JS (T5)

`apps/web/src/downloads/notification.ts` (puro, sin stores ni Capacitor):

```ts
import type { DownloadJob } from './types';
export type Translate = (key: string, params?: Record<string, string | number>) => string;
export interface NotificationContent {
  title: string;
  text: string;
  progress: number;
}
export interface SentNotification {
  content: NotificationContent;
  at: number;
}
export const PROGRESS_MIN_GAP_MS = 1000;
/** null when nothing is active. */
export function buildNotification(
  jobs: readonly DownloadJob[],
  waitingNetwork: boolean,
  t: Translate,
): NotificationContent | null;
/** true if title/text changed, or progress changed and ≥ PROGRESS_MIN_GAP_MS since last send. */
export function shouldSend(
  prev: SentNotification | null,
  next: NotificationContent,
  now: number,
): boolean;
/** Final notice for the jobs that finished in the batch that just ended; null if none ok and none failed. */
export function doneNotice(finished: readonly DownloadJob[], t: Translate): string | null;
```

Reglas de `buildNotification`:

- Canción actual = la primera `downloading`; si no hay, la primera `saving`; si no, la primera activa.
- Contador = `notificationCounts(jobs)` (de `downloads/batch.ts`) o `{position:1,total:activos}`.
- Barra (todas las fases) = `batchProgress(position - 1, fraction, total)` =
  `Math.min(100, Math.floor(((position - 1) + fraction) / total * 100))`, exportada también:
  `export function batchProgress(finished: number, fraction: number, total: number): number;`
  `fraction` = `progress / 100` (acotado 0-1) si la actual está `downloading`/`queued`; 1 si está
  `saving`/`downloaded`; 0 si `waitingNetwork`.
- Si la actual está `downloading`/`queued`: título `dl.notifTitle`.
- Si está `saving`/`downloaded` (y no hay ninguna `downloading`): título `dl.notifSavingTitle`.
- Texto: `dl.notifText` (`{title}`,`{count}` = activos-1) o `dl.notifTextLast` si es la última.
- Si `waitingNetwork`: texto `dl.notifWaiting` (la barra sigue siendo la total).
  Reglas de `doneNotice`: ok = `done`, failed = `error`. failed = 0 → `dl.notifDone` (`{count}`, con
  `.one`); failed > 0 → `dl.notifDoneSomeFailed` (`{count}`, `{failed}`).

### C3 · Claves i18n nuevas o cambiadas (T2; las usan T5 y T7)

| Clave                           | es                                                                                      | en                                                                               | eu                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `dl.notifSavingTitle`           | Guardando {done} de {total}                                                             | Saving {done} of {total}                                                         | Gordetzen {done}/{total}                                                                   |
| `dl.notifDone`                  | {count} canciones guardadas en tu biblioteca                                            | {count} songs saved to your library                                              | {count} abesti gorde dira zure liburutegian                                                |
| `dl.notifDone.one`              | 1 canción guardada en tu biblioteca                                                     | 1 song saved to your library                                                     | Abesti 1 gorde da zure liburutegian                                                        |
| `dl.notifDoneSomeFailed`        | Guardadas: {count}. No se pudieron bajar: {failed}. Abre Aske Stream para reintentarlas | Saved: {count}. Could not download: {failed}. Open Aske Stream to try them again | Gordeta: {count}. Ezin izan dira deskargatu: {failed}. Ireki Aske Stream berriro saiatzeko |
| `boot.loading`                  | Abriendo Aske Stream…                                                                   | Opening Aske Stream…                                                             | Aske Stream irekitzen…                                                                     |
| `boot.connecting`               | Buscando conexión…                                                                      | Looking for a connection…                                                        | Konexioa bilatzen…                                                                         |
| `common.offlineBanner` (cambia) | Sin buena conexión: mostrando tu música descargada                                      | No good connection: showing your downloaded music                                | Konexio onik ez: deskargatutako musika erakusten                                           |
| `common.offlineBannerHint`      | Lo volveremos a intentar solos; no tienes que hacer nada.                               | We will try again by ourselves; you do not need to do anything.                  | Berriro saiatuko gara geure kabuz; ez duzu ezer egin behar.                                |

### C4 · Tiempos máximos y conectividad (T4; los usa T7)

`apps/web/src/lib/timeout.ts`:

```ts
export const BOOT_TIMEOUT_MS = 4000;
export class TimeoutError extends Error {} // name = 'TimeoutError', message = 'timeout'
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>; // rejects TimeoutError
export function isTimeout(err: unknown): boolean;
```

`apps/web/src/lib/boot.ts`:

```ts
export const BOOT_MIN_SPLASH_MS = 1000;
export const BOOT_MAX_WAIT_MS = 5000;
export const BOOT_CONNECTING_HINT_MS = 1500;
/** true when the splash can go away. */
export function bootReady(s: {
  setupLoading: boolean;
  elapsedMs: number;
  connection: ConnectionStatus;
}): boolean;
// = !setupLoading && elapsedMs >= BOOT_MIN_SPLASH_MS && (connection !== 'checking' || elapsedMs >= BOOT_MAX_WAIT_MS)
// setupLoading still wins: setup.init is itself bounded by BOOT_TIMEOUT_MS (T7).
```

`apps/web/src/stores/connectivity.ts`:

```ts
export type ConnectionStatus = 'checking' | 'online' | 'offline';
export const RETRY_DELAYS_MS = [5000, 10000, 20000, 30000, 60000]; // the last one repeats
export function nextRetryDelay(attempt: number): number;
export interface ConnectivityDeps {
  probe: (timeoutMs: number) => Promise<boolean>;
  schedule: (fn: () => void, ms: number) => () => void; // returns cancel
}
export interface ConnectivityState {
  status: ConnectionStatus; // starts 'checking'
  check(): Promise<boolean>; // one probe at a time (re-entrant calls share the promise)
  reportTrouble(): void; // a request timed out: if 'online', run check()
}
export function createConnectivityStore(
  deps: ConnectivityDeps,
): UseBoundStore<StoreApi<ConnectivityState>>;
export const useConnectivity: ReturnType<typeof createConnectivityStore>;
export function canUseNetwork(): boolean; // navigator.onLine && status !== 'offline'
export function onReconnect(listener: () => void): () => void; // fired on offline → online only
export function startConnectivityWatch(): () => void; // window online/offline + visibilitychange; idempotent
```

Comportamiento: éxito → `online`, reinicia intentos, cancela reintento; si venía de `offline`
→ avisa a `onReconnect`. Fallo → `offline` y programa `check()` con `nextRetryDelay(intento++)`.
Mientras reintenta, el estado sigue en `offline` (el banner no parpadea). `offline` del navegador
→ `offline` al momento + reintento. `online` del navegador o volver a la app estando offline → `check()`.
Sonda por defecto (timeout `BOOT_TIMEOUT_MS`): si `!navigator.onLine` → false. Hogar `cloudflare` →
`api.health()` (cualquier respuesta HTTP = alcanzable; `ApiError` con status 0 o timeout = no).
Cualquier otro hogar (`device`, `drive`) → `fetch(HUB_URL + '/hub/v1/health', {cache:'no-store'})`
si `hubAvailable()` (cualquier respuesta HTTP = alcanzable); si no, `navigator.onLine`.
**Prohibido** contactar con terceros (nada de `generate_204` ni otras URLs de Google/otros).
Todas con `AbortSignal.timeout`.

### C5 · Aleatorio (T3; lo usa T6)

`apps/web/src/player/shuffleCycle.ts`:

```ts
export interface ShuffleCycle {
  key: string;
  played: string[];
  usedAt: number;
}
export type ShuffleCycles = Record<string, ShuffleCycle>; // one per list
export const MAX_REMEMBERED_CYCLES = 20;
/** cycleKey ?? path ?? label ?? 'none' */
export function cycleKey(
  context: { cycleKey?: string; path?: string; label: string } | null,
): string;
/** Cycle stored for `key`, or a fresh empty one. */
export function cycleFor(cycles: ShuffleCycles, key: string, now: number): ShuffleCycle;
/** Stores `cycle` (usedAt = now) and drops the least recently used beyond MAX_REMEMBERED_CYCLES. */
export function rememberCycle(
  cycles: ShuffleCycles,
  cycle: ShuffleCycle,
  now: number,
): ShuffleCycles;
/** Unplayed songs first (shuffled), then the played ones (shuffled); firstId (if in ids) goes first.
 *  If every id was played: fresh Fisher-Yates whose first song is not lastPlayed (unless firstId says so). */
export function shuffledCycleOrder(
  ids: readonly string[],
  firstId: string | null,
  played: ReadonlySet<string>,
  lastPlayed: string | null,
  random?: () => number,
): string[];
/** Adds id; when every id in `ids` has been played, starts a new cycle: { key, played: [], usedAt }. */
export function recordPlayed(cycle: ShuffleCycle, id: string, ids: readonly string[]): ShuffleCycle;
/** Inserts each new id at a uniformly random position after `index`. */
export function insertShuffled(
  context: readonly string[],
  index: number,
  newIds: readonly string[],
  random?: () => number,
): string[];
```

`PlayContext` (en `stores/player.ts`) añade `live?: 'library'` y `cycleKey?: string`. `LibraryView`
pone `live` solo con filtro «todo», sin búsqueda (las podcasts ya están fuera de esa lista), y siempre
`cycleKey = 'library:' + filter + ':' + normalizeText(query.trim())` (así «Me gusta», «Descargadas» o
buscar un artista tienen su propia memoria). `PlaylistView` ya usa un `path` único por playlist/«Me gusta».
No existe vista de artista: si se añade, su contexto debe llevar `cycleKey = 'artist:' + nombre`.

## Tareas

### T1 · Notificación nativa con un solo escritor y límite de frecuencia · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/DownloadService.java`,
  `.../DownloaderPlugin.java`, `.../DownloadQueue.java`, `.../NotificationThrottle.java` (nuevo)
- Leer como contexto: sección «Causas encontradas» y contrato C1 de este plan.
- Qué hacer:
  1. `NotificationThrottle` (clase final, en inglés, < 100 líneas): constructor
     `(Handler main, NotificationManager nm, int id)`. `submit(Notification n, boolean phaseChange)`:
     guarda `n` como pendiente; publica ya si han pasado ≥ 1000 ms desde la última publicación (o
     ≥ 250 ms si `phaseChange`); si no, programa con `postDelayed` una sola publicación para cuando
     toque (la última pendiente gana). `cancelPending()` quita lo programado. Todo en el hilo principal.
  2. `DownloadService`: crea el throttle en `onCreate`; **todas** las llamadas a `nm.notify(ID, …)`
     pasan por él. El `static update(...)` pasa a hacer `instance.main.post(() -> instance.submitFromJs(...))`
     (si `instance` es null, no hace nada: el plugin ya arranca el servicio). `submitFromJs` guarda
     `lastJsUpdateAt` y marca `phaseChange` cuando cambian título o texto respecto al último de JS.
  3. `refreshNotification()`: escribe la notificación nativa si `!jsKeepAlive` **o** si
     `busy && now - lastJsUpdateAt > 10_000` (JS congelado). `onProgress` llama a refresh solo si
     cambia el % entero (como hoy); el throttle se encarga del resto. Cambios de espera de red,
     inicio de canción y fin de canción → `phaseChange = true`.
  4. `nativeNotification`: título = `texts.progress` con `{done}`/`{total}`; texto = título de la
     canción actual (`Job.title`, vacío → nombre de la app) o `texts.waiting` si espera red; barra
     = progreso total del lote `(done * 100 + pctActual) / total` (C1; `pctActual` = 0 si espera red;
     nunca indeterminada). Guarda el `Job` actual en un campo para tener su título.
  5. `DownloadQueue.Job`: añade `title` (C1), en `readJob`/`writeJob`. `DownloaderPlugin.queue` lo lee
     con `optString("title", "")`, recortado a 200 caracteres.
  6. Aviso final: `DownloaderPlugin.setNotification` con `active=false` lee `doneText`; si no está
     vacío llama a un nuevo `DownloadService.showDone(Context, String)` (static; reutiliza la lógica de
     `showNotice`: ID 4243, `setAutoCancel(true)`, silenciosa) **antes** de `appStateChanged()`.
     Se muestra siempre, esté la app abierta o no. Nuevo `@PluginMethod clearDoneNotice` →
     `DownloadService.clearDone(Context)` (static, `nm.cancel(4243)`; no pasa por el throttle, que es del ID 4242).
  7. `onQueueEmpty`/`onDestroy`/`onTimeout`: `throttle.cancelPending()` antes de `stopForeground`.
  8. Funciones < 50 líneas, comentarios en inglés, sin logs de depuración.
- TDD: no (código Android; se prueba en el móvil).
- Criterios de aceptación:
  - [ ] Ninguna llamada a `notify(ID, …)` fuera de `NotificationThrottle`.
  - [ ] Compila: `.\gradlew.bat compileReleaseJavaWithJavac` en `apps/mobile/android`.
  - [ ] En el móvil (tras T5): bajando 10 canciones, `adb logcat | findstr /i "shedding"` no muestra
        nada de `io.github.ando144.askestream`; la notificación avanza «1 de 10 … 10 de 10».
  - [ ] Con la app cerrada, la notificación muestra contador, título de la canción y barra total del lote
        (no vuelve a 0 al cambiar de canción).
  - [ ] El aviso final aparece también con la app abierta y desaparece al llamar a `clearDoneNotice`.
- Verificación: en PowerShell con `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr` y
  `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`: `cd apps/mobile/android; .\gradlew.bat compileReleaseJavaWithJavac`.

### T2 · Textos (es/en/eu) y ayuda · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`,
  `apps/web/src/help/articles/offline.ts`, `apps/web/src/help/articles/listen.ts`
- Leer como contexto: contrato C3; `apps/web/test/i18n.test.ts`.
- Qué hacer:
  1. Añadir/cambiar exactamente las claves de C3 en los tres idiomas (junto a las `dl.notif*` y
     `common.*` existentes; `boot.*` en un bloque nuevo cerca de `common.*`).
  2. `offline.ts`, artículo `offline-how`: un párrafo en es/en/eu: «Si la cobertura es mala (por
     ejemplo, en el tren), la app espera unos segundos y abre con tu música descargada. Verás un aviso
     arriba; cuando vuelva la conexión desaparece solo y vuelve toda tu música.»
  3. `listen.ts`, artículo `queue`: párrafo sobre aleatorio: «El aleatorio no repite ninguna canción
     hasta que han sonado todas las de esa lista. Cada lista (tu biblioteca, cada playlist…) recuerda
     por dónde ibas. Las canciones nuevas que añadas entran en el aleatorio. Al empezar otra vuelta,
     la primera nunca es la última que sonó.»
  4. Lenguaje sencillo, sin jerga, sin enlaces nuevos (si añades alguno, que exista).
- TDD: no (lo cubre el test de paridad y el de enlaces).
- Criterios de aceptación:
  - [ ] Las 8 claves existen en es, en y eu con los textos de C3.
  - [ ] Pasan `apps/web/test/i18n.test.ts` y el test de enlaces de ayuda.
- Verificación: `npx vitest run test/i18n.test.ts test/help.test.ts --root apps/web`

### T3 · Lógica pura del ciclo aleatorio · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/player/shuffleCycle.ts` (nuevo), `apps/web/test/shuffleCycle.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/player/queue.ts`, `apps/web/src/offline/planner.ts` (`shuffled`), contrato C5.
- Qué hacer: implementar C5 (incluidos `cycleFor` y `rememberCycle`, memoria por lista) usando
  `shuffled()` de `offline/planner.ts` (no reescribir Fisher-Yates; nunca `sort` con aleatorio).
  Escribir primero los tests con un `random` determinista (semilla tipo LCG o secuencia fija).
- TDD: sí.
- Criterios de aceptación (tests):
  - [ ] `shuffledCycleOrder` devuelve una permutación de `ids` (mismo tamaño, sin duplicados).
  - [ ] Todas las no oídas van antes que cualquier oída; `firstId` va primero.
  - [ ] Si todas estaban oídas, la primera ≠ `lastPlayed` (probar 200 semillas, `ids.length` 2 y 50).
  - [ ] `recordPlayed` no duplica; al completar todas devuelve `played: []`.
  - [ ] `insertShuffled` conserva `context[0..index]` intacto y todas las nuevas quedan detrás de `index`.
  - [ ] `cycleKey` prioriza `cycleKey` > `path` > `label`; `cycleFor` devuelve el guardado o uno vacío.
  - [ ] `rememberCycle` con 21 listas conserva 20 y descarta la de `usedAt` más antiguo; no muta la entrada.
  - [ ] Uniformidad aproximada: con 4 ids y 40 000 barajados con `Math.random`, cada id aparece en
        primera posición entre el 22 % y el 28 %.
- Verificación: `npx vitest run test/shuffleCycle.test.ts --root apps/web`

### T4 · Tiempos máximos, conectividad y uso en audio y biblioteca · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/lib/timeout.ts` (nuevo), `apps/web/src/lib/boot.ts` (nuevo),
  `apps/web/src/stores/connectivity.ts` (nuevo), `apps/web/src/storage/media.ts`, `apps/web/src/stores/library.ts`,
  `apps/web/test/timeout.test.ts` (nuevo), `apps/web/test/connectivity.test.ts` (nuevo), `apps/web/test/boot.test.ts` (nuevo)
- Leer como contexto: contrato C4; `apps/web/src/api/client.ts` (`api.health`, `ApiError`),
  `apps/web/src/hub/client.ts` (`HUB_URL`, `hubAvailable`), `apps/web/src/stores/setup.ts` (`config.home`).
- Qué hacer:
  1. Tests primero para `withTimeout`/`isTimeout`, `bootReady`, `nextRetryDelay` y el store creado con
     `createConnectivityStore` usando `probe` y `schedule` falsos (`vi.useFakeTimers`): estado inicial
     `checking`; fallo → `offline` + reintento programado con 5 s, 10 s…; éxito tras fallo → `online` y
     `onReconnect` llamado una vez; `check()` re-entrante = una sola sonda.
  2. Implementar C4. `startConnectivityWatch` registra los eventos una sola vez y devuelve la función de limpieza.
     La sonda por defecto solo contacta con el Worker propio (Cloudflare) o el Hub propio; ninguna URL de terceros.
  3. `storage/media.ts`: cambiar las dos condiciones `navigator.onLine` de `resolveAudio` y la de
     `driveCoverBlob` por `canUseNetwork()`.
  4. `stores/library.ts` `load()`: envolver `getHome().load(...)` en `withTimeout(…, 20_000)` (la
     biblioteca grande puede tardar más que la sonda) para que `loading` vuelva a false; en el `catch`,
     si `isTimeout(err)` llamar a `useConnectivity.getState().reportTrouble()`. El resto igual.
  5. Errores: nunca tragarlos sin más; si se ignoran, `console.warn` con el motivo (patrón existente).
- TDD: sí.
- Criterios de aceptación:
  - [ ] Tests nuevos en verde; `npm run check` sin errores de tipos.
  - [ ] Ninguna referencia a `navigator.onLine` queda en `storage/media.ts`.
  - [ ] `grep generate_204 apps/web/src` no encuentra nada.
  - [ ] Ningún import circular nuevo (connectivity importa setup/api/hub; ninguno de ellos importa connectivity).
- Verificación: `npx vitest run test/timeout.test.ts test/connectivity.test.ts test/boot.test.ts --root apps/web`

### T5 · Notificación desde JS: contenido, frecuencia y aviso final · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/notification.ts` (nuevo), `apps/web/test/notification.test.ts` (nuevo),
  `apps/web/src/stores/downloads.ts`, `apps/web/src/native/downloader.ts`, `apps/web/src/downloads/types.ts`,
  `apps/web/src/downloads/pipeline.ts`, `apps/web/test/downloadsStore.test.ts` (solo si hay que ajustarlo)
- Leer como contexto: contratos C1, C2, C3; `apps/web/src/downloads/batch.ts`; `apps/web/test/fake-native/` (si existe un falso de `Downloader`, añadir allí `doneText`/`title` solo si su tipo lo exige — en ese caso ese archivo también es de esta tarea).
- Qué hacer:
  1. Tests primero de `buildNotification`, `shouldSend` y `doneNotice` (con un `t` falso que devuelva
     `clave|param=valor`): fases descargando/guardando/esperando red, contador, última canción,
     dedupe, progreso limitado a 1/s, cambio de título enviado al momento, aviso con y sin fallos,
     `batchProgress` (3 de 10 al 50 % → 25; guardando la 3.ª → 30; la barra nunca baja al pasar de
     «guardando» a la siguiente canción ni con «esperando red»).
  2. Implementar C2 en `downloads/notification.ts`.
  3. `native/downloader.ts`: añadir `doneText?` a `setNotification` y el método `clearDoneNotice()`
     (C1; en web/sin plugin no hace nada) y sustituir su `withTimeout` local por el de `lib/timeout.ts`
     (el mensaje sigue siendo `'timeout'`).
  4. `downloads/types.ts` + `pipeline.ts`: `NativeJob.title` y `jobsForNative` lo rellena con
     `j.title.slice(0, 200)`.
  5. `stores/downloads.ts`: reescribir `notify()` (< 30 líneas) para usar `buildNotification` y
     `shouldSend`, guardando `lastSent`; si hay un envío pendiente por frecuencia, programar uno
     solo con `setTimeout` para cuando toque (la última gana). Cuando no hay activos:
     `setNotification({ active: false, doneText })`, con `doneText = doneNotice(...)` calculado con los
     trabajos terminados en el lote que acaba (mismos que usa `finishQueue`: `finishedAt` en el último
     minuto o el `batchId` activo); reiniciar `lastSent`. Pasar `get().waitingNetwork` a `buildNotification`.
  6. Las llamadas actuales a `notify()` (listener `progress`, `finished`, `saveJob`…) se quedan como
     están: el límite lo pone `shouldSend`. No añadir llamadas nuevas.
  7. Aviso final siempre (también con la app abierta). Quitarlo al abrir la app: en `init()` del store
     llamar a `clearDoneNotice()` y registrar un `visibilitychange` que lo llame al volver a visible
     (una sola vez, idempotente); errores → `console.warn`, sin bloquear.
- TDD: sí (lógica pura de `notification.ts`).
- Criterios de aceptación:
  - [ ] Tests nuevos en verde y `downloadsStore.test.ts` en verde.
  - [ ] `stores/downloads.ts` < 650 líneas y todas sus funciones < 50 líneas.
  - [ ] Con 10 canciones en el móvil (tras T1): título «Descargando N de 10», texto con la canción y
        «quedan…», barra total que solo avanza, «Guardando N de 10» al guardar, y al acabar aviso
        «10 canciones guardadas en tu biblioteca» (también con la app abierta), que desaparece al
        volver a abrir la app.
- Verificación: `npx vitest run test/notification.test.ts test/downloadsStore.test.ts --root apps/web` y después `npm run check`.

### T6 · Aleatorio con ciclo en el reproductor, lista viva y docs · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/player.ts`, `apps/web/src/views/LibraryView.tsx`,
  `docs/ESTADO.md`, `docs/v2/architecture.md`
- Leer como contexto: contrato C5, `apps/web/src/player/shuffleCycle.ts` (T3), `apps/web/src/player/queue.ts`.
- Qué hacer:
  1. `PlayContext` añade `live?: 'library'` y `cycleKey?: string`. Estado nuevo
     `shuffleCycles: ShuffleCycles` (memoria por lista), guardado en `Saved` (`player-v2`, campo
     opcional; si falta, `{}`).
  2. `playTracks` con aleatorio (rama no-ahorro-de-datos) y `toggleShuffle` al activar: usar
     `shuffledCycleOrder(ids, first, played, lastPlayed)` con
     `played = cycleFor(shuffleCycles, cycleKey(contexto), Date.now()).played`; `lastPlayed` = `currentId` actual.
  3. En `loadCurrent`, tras obtener `src` con éxito y si `shuffle && !fromQueue`: `recordPlayed` sobre el
     ciclo de la lista actual y guardarlo con `rememberCycle` (máx. 20 listas).
  4. En `step`, el cambio de vuelta (`ni === 0 && shuffle`) usa `shuffledCycleOrder(original, null,
new Set(cicloDeLaListaActual.played), últimoQueSonó)` en lugar de `reshuffleForNextLap` (quita el import si queda sin uso;
     si `reshuffleForNextLap` queda sin uso en todo `src`, no lo borres de `queue.ts`: avisa en el informe).
  5. Lista viva: suscripción a `useLibrary` (fuera del `create`, junto a los listeners del audio) que,
     si `contextInfo?.live === 'library'` y cambia `order`, calcula ids nuevos (en `order`, no en
     `original`, `kind !== 'podcast'`), los añade al final de `original` y al `context` con
     `insertShuffled` (aleatorio) o al final (sin aleatorio); persiste. Los borrados ya los quita `forgetTracks`.
  6. `LibraryView`: pasar `live: 'library'` en `context` solo si `filter === 'all'` y la búsqueda está
     vacía, y siempre `cycleKey: \`library:${filter}:${normalizeText(deferredQuery.trim())}\``(C5). Quitar el banner`!online` de esta vista (lo sustituye el banner global de T7) y los imports
     que queden sin uso.
  7. Docs: en `docs/ESTADO.md` añadir «v0.8.4 (en curso)» con los tres arreglos y en «Decisiones» una
     línea por cada decisión de este plan; en `docs/v2/architecture.md` añadir la fila
     `| 7.2 | Reliability: download notification, slow-network start (splash + offline mode), shuffle cycles | ✅ |`
     tras la 7.1 (con el estado vacío hasta que Andoni lo pruebe: déjalo en blanco).
- TDD: no (integración en el store; la lógica tiene tests en T3). Ejecutar los tests existentes.
- Criterios de aceptación:
  - [ ] Pulsar «Aleatorio» dos veces seguidas en la biblioteca no vuelve a poner primero canciones ya oídas en el ciclo.
  - [ ] Escuchar en aleatorio una playlist, pasar a la biblioteca y volver a la playlist retoma su ciclo
        (no repite las ya oídas en esa playlist).
  - [ ] Una canción descargada mientras suena el aleatorio de «Todo» aparece después en «A continuación».
  - [ ] `npm run check` en verde; `player.ts` < 800 líneas; funciones < 50 líneas.
- Verificación: `npx vitest run test/queue.test.ts test/shuffleCycle.test.ts --root apps/web` y `npm run check`.

### T7 · Pantalla de arranque, setup con tiempo máximo y banner sin conexión · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/App.tsx`, `apps/web/src/stores/setup.ts`,
  `apps/web/src/components/BootSplash.tsx` (nuevo), `apps/web/src/components/ConnectionBanner.tsx` (nuevo),
  `apps/web/src/styles.css`, `apps/web/index.html`
- Leer como contexto: contratos C3 y C4; `apps/web/src/components/ServerUpdateBanner.tsx` (estilo de banner);
  `apps/mobile/android/app/src/main/res/values/styles.xml` (fondo `#14110F`).
- Qué hacer:
  1. `setup.ts` `init()`: hogar guardado distinto de Cloudflare → `status: 'ready'` al momento y
     `sameOriginApi` después con `withTimeout(hasSameOriginApi(), BOOT_TIMEOUT_MS)` (timeout → false).
     Cloudflare → `withTimeout(api.status(), BOOT_TIMEOUT_MS)`; timeout o `ApiError` status 0 → `ready`
     (como hoy sin conexión). Primera vez: `hasSameOriginApi` y `api.status` también con timeout.
  2. `BootSplash.tsx`: pantalla completa, fondo `#14110F`, `<img src="/favicon.svg">` con clase
     `boot-logo` (pulso suave de escala + brillo ámbar con `var(--accent)`), `aria-label={t('boot.loading')}`,
     y tras `BOOT_CONNECTING_HINT_MS` el texto `boot.connecting` (aria-live polite).
  3. `index.html`: dentro de `#root`, el mismo marcado estático (logo + clases) para que se vea
     antes de cargar el JS; React lo sustituye. Sin texto (aún no hay idioma).
  4. `styles.css`: estilos `.boot-splash`, `.boot-logo` con `@keyframes`, y
     `@media (prefers-reduced-motion: reduce)` sin animación; estilos de `.connection-banner` en ámbar
     suave (reutilizar `.banner` si encaja). Una sola paleta ámbar.
  5. `App.tsx`:
     - En el efecto de arranque: `useSetup.getState().init()` primero (su parte síncrona fija el hogar),
       luego `startConnectivityWatch()` y `void useConnectivity.getState().check()`; limpiar al desmontar.
     - Guardar el instante de arranque; un temporizador fuerza re-render a los 1000 ms y a los 5000 ms.
       Mientras `!bootReady(...)` → `<BootSplash />` (sustituye al `LoaderCircle`).
     - `useBackgroundSync`: ningún paso bloquea al siguiente: `await withTimeout(sync(), BOOT_TIMEOUT_MS)`
       con `catch` → si `isTimeout`, `useConnectivity.getState().reportTrouble()`; `checkInbox()` solo si
       `canUseNetwork()`. Registrar `onReconnect(...)` que hace lo mismo que `onOnline` (sync,
       `downloads.resume()`, `checkInbox()`, `useServerUpdate.getState().check()`); devolver su limpieza.
     - En `Shell`, `useServerUpdate.check()` y `useJam.resume()` envueltos en `withTimeout(…, BOOT_TIMEOUT_MS)`
       con `catch` que registre con `console.warn` (no bloquean nada).
     - Montar `<ConnectionBanner />` junto a `<ServerUpdateBanner />`.
  6. `ConnectionBanner.tsx`: si `useConnectivity(s => s.status) === 'offline'` muestra icono `WifiOff`,
     `common.offlineBanner` y debajo `common.offlineBannerHint` en pequeño; `role="status"`. Sin botón
     (se reintenta solo). Se oculta solo al volver a `online`.
- TDD: no (UI y cableado; la lógica de tiempos está probada en T4).
- Criterios de aceptación:
  - [ ] La pantalla de arranque se ve siempre ≥ 1 s y nunca más de ~5 s salvo que el setup local tarde.
  - [ ] Con Chrome DevTools → Network → «Offline» o una regla que deje colgadas las peticiones
        (p. ej. bloquear el dominio del Worker), la app abre en ≤ 5 s con la biblioteca guardada,
        el banner y reproduce lo descargado; al quitar el bloqueo el banner desaparece solo (≤ 60 s).
  - [ ] `App.tsx` < 400 líneas, funciones < 50 líneas; `npm run check` en verde.
- Verificación: `npm run check`; después `npm run build -w @aske/web` + `npm run test:e2e` (cerrar wrangler/workerd colgados) y prueba manual en `npm run dev`.

## Orden

Grupo A (en paralelo): T1, T2, T3, T4 → Grupo B (en paralelo): T5 (necesita T1 y T2), T6 (necesita T3),
T7 (necesita T2 y T4). Al final: `npm run check`, `npm run test:e2e` y APK de prueba
(`.\gradlew.bat assembleRelease`) para probar en el Pixel.

## Decisiones tomadas por Andoni (2026-11-22)

1. Barra de la notificación: progreso **total del lote** (C2 `batchProgress`, C1, T1 paso 4, T5).
2. Red útil sin terceros: Worker propio en Cloudflare y **Hub propio** en el resto de hogares; nada de
   `generate_204` de Google (C4, T4).
3. Memoria del aleatorio: **una por lista** (biblioteca por filtro/búsqueda, cada playlist, «Me gusta»;
   artista cuando exista vista), hasta 20 listas (C5, T3, T6).
4. Aviso final «Descargas terminadas»: **siempre**, y se quita al abrir la app (C1 `clearDoneNotice`, T1, T5).

## Riesgos

1. Riesgo: con la barra total, una canción muy larga hace avanzar la barra despacio (cada canción pesa
   lo mismo en el total); el contador «N de M» lo compensa.
2. Riesgo: si el Hub propio cae, los hogares «Este dispositivo» y Drive creerán que no hay red y
   mostrarán el banner (se reintenta solo; la música descargada sigue sonando).
3. Riesgo: no hay vista de artista; «cada artista» se cubre hoy buscando el artista en la biblioteca
   (cada búsqueda tiene su propia memoria).
4. Riesgo: Android puede seguir congelando la WebView en segundo plano; el respaldo de 10 s del servicio
   (T1) cubre la notificación, pero el guardado en la biblioteca sigue dependiendo de JS (como hoy).
5. Riesgo: `insertShuffled` en la lista viva solo aplica a «Biblioteca → Todo»; playlists y filtros no se actualizan solos (igual que hoy).

# PLAN: F9 · Modo estudio (Pomodoro con música y pantalla fijada)

Fecha: 2026-11-23 · Estado: COMPLETADO

## Objetivo

Una sesión de estudio de X minutos (sin descansos) en la app Android: la app se queda fijada
(«fijar pantalla» de Android), solo se puede manejar la música, el volumen y el sonido ambiente
(y coger llamadas). Al acabar, la música baja, suena una campanilla 3 veces, se suelta la
fijación y aparece «¡Bien hecho!». Salir antes = mantener pulsado 30 s. Historial local solo
con el permiso del Recap. En web/PWA no hay modo estudio (solo un aviso).

## Decisiones de arquitectura

- **Plugin nativo nuevo `StudyLock`** (no ampliar AskeNative) — AskeNative ya tiene 300+ líneas
  y otro propósito; así el puente, el falso de tests y los archivos Java quedan aislados y se
  pueden hacer en paralelo.
- **Fijar = `Activity.startLockTask()` sin ser propietario del dispositivo** → Android muestra
  su diálogo «¿Fijar app?». Estado leído con `ActivityManager.getLockTaskModeState()`. La sesión
  empieza aunque el usuario no acepte: se muestra un aviso con botón «Fijar pantalla» (honesto y
  sin bloquear al usuario).
- **Campanilla solo nativa** (`ChimePlayer.java`, sintetizada con `AudioTrack`, sin archivos):
  - Si la app está viva (la música suena → JS activo), el JS llama `chimeNow` justo a la hora.
  - Si el JS está dormido (música en pausa y pantalla apagada), suena por una alarma
    `AlarmManager.setExactAndAllowWhileIdle` → `StudyChimeReceiver`.
  - Ambas rutas comprueban `lastChimedEndsAt` en SharedPreferences: nunca suena dos veces.
  - Uso `USAGE_MEDIA`/`SONIFICATION`: sale por los cascos si los hay (no por el altavoz en
    una biblioteca). Sin pedir foco de audio, para que el WebView no pause la música.
- **Permisos de alarma exacta:** `USE_EXACT_ALARM` (API 33+, concedido solo; caso
  «temporizador» permitido) y `SCHEDULE_EXACT_ALARM` con `maxSdkVersion="32"`. Si aun así no
  se puede, `setAndAllowWhileIdle` (inexacta) como respaldo.
- **Sesión persistida** en pref `study-session` (`endsAt` absoluto, mismo patrón que
  `sleepTimer.ts`): al reabrir se reanuda o se cierra como terminada. Tick con `setInterval`
  de 1 s (Android retrasa los timeouts largos).
- **Modo foco = pantalla completa:** mientras `phase !== 'idle'`, `Shell` (App.tsx) pinta solo
  la vista de estudio (sin menú, sin TabBar, sin MiniPlayer) y el botón Atrás no hace nada.
  Así «durante el bloqueo solo se puede…» se cumple también dentro de la app.
- **Mezcla «Tranquila / sin letra»** heurística con datos que ya existen: palabras en
  título/artista/álbum (instrumental, lofi, piano, ambient, study, classical, OST…) o duración
  ≥ 6 min. Si salen menos de 10 canciones se usa toda la biblioteca y se avisa. No se añaden
  etiquetas ni se analiza audio (caro y fuera de alcance).
- **Solo música:** la cola excluye podcasts (`kind === 'podcast'`); radio no se ofrece.
- **Ruido blanco/gris/marrón generado con Web Audio** (búfer de 10 s en bucle sin corte). Lluvia
  y olas: archivos opcionales en `apps/web/src/study/sounds/*.ogg` cargados con
  `import.meta.glob`; si no están, esas opciones no aparecen y todo compila. Andoni consigue los
  archivos CC0 (ver Riesgos). Cada sonido tiene su propio nivel (mezcla).
- **Estadísticas de estudio** en un almacén IndexedDB nuevo `study` (DB versión 5), solo si
  `useStats.consent === 'on'`. Borrar el historial o apagar el Recap borra también el estudio.
  Nunca se suben al Hub ni a grupos.
- **Al terminar:** la música baja al 25 % en los últimos 8 s, campanilla (~6,6 s), después se
  pausa la música y se devuelve el volumen original; el sonido ambiente se apaga con fundido.
- **Al empezar** se cancela el temporizador de apagado (`useSleepTimer.cancel()`) para que no se
  peleen por el volumen.
- **Entrada:** ruta `/study`; enlace en la barra lateral y botón en la cabecera de Biblioteca,
  ambos solo si `isNative`. En web, `/study` muestra un aviso «solo en la app de Android».

## Contratos (interfaces compartidas)

### Puente nativo — `apps/web/src/native/studyLock.ts` (plugin `'StudyLock'`)

```ts
export type PinState = 'none' | 'pinned' | 'locked'; // pinned = screen pinning, locked = kiosk
export interface StudyLockPlugin {
  /** startLockTask(); Android shows its own "Pin app?" dialog. Resolves at once. */
  pin(): Promise<void>;
  /** stopLockTask(); no error if it was not pinned. */
  unpin(): Promise<void>;
  status(): Promise<{ pin: PinState; lastChimedEndsAt: number | null }>;
  /** Exact alarm at endsAt that plays the chime if JS has not done it. */
  scheduleChime(o: { endsAt: number }): Promise<{ exact: boolean }>;
  cancelChime(): Promise<void>;
  /** Plays the 3 bells now, unless lastChimedEndsAt === endsAt. Cancels the alarm. */
  chimeNow(o: { endsAt: number }): Promise<void>;
  /** Opens Android Security settings (where "App pinning" lives). */
  openPinSettings(): Promise<void>;
}
export const StudyLock = registerPlugin<StudyLockPlugin>('StudyLock');
```

Falso: `apps/web/test/fake-native/studyLock.ts` (mismo tipo, estado `pin` en memoria; `pin()`
pone `'pinned'`, `unpin()` pone `'none'`, el resto no hace nada). Alias en `vite.config.ts`
como los otros (`/^.*\/native\/studyLock$/`).

### Lógica pura — `apps/web/src/study/`

```ts
// session.ts
export type StudySource = { kind: 'library' } | { kind: 'calm' } | { kind: 'playlist'; id: string };
export interface StudySession {
  id: string;
  startedAt: number;
  endsAt: number;
  plannedMin: number;
  source: StudySource;
}
export const STUDY_PRESETS_MIN = [15, 25, 45, 60, 90] as const;
export const STUDY_MIN_MIN = 5,
  STUDY_MAX_MIN = 240,
  FADE_MS = 8000,
  DUCK_LEVEL = 0.25;
export const CHIME_TOTAL_MS = 6600;
export function clampStudyMinutes(m: number): number; // round, [5,240], NaN → 25
export function createSession(
  now: number,
  minutes: number,
  source: StudySource,
  id: string,
): StudySession;
export function remainingMs(s: StudySession, now: number): number; // >= 0
export function musicFactor(s: StudySession, now: number): number; // 1 → DUCK_LEVEL in last FADE_MS; DUCK_LEVEL after end
export function studiedMinutes(s: StudySession, endedAt: number): number; // floor(min(endedAt,endsAt)-startedAt)/60000, >= 0
export type RestoreDecision =
  | { kind: 'none' }
  | { kind: 'resume'; session: StudySession }
  | { kind: 'ended'; session: StudySession };
export function restoreDecision(saved: unknown, now: number): RestoreDecision; // validates shape; invalid → none
export function formatClock(ms: number): string; // "1:05:09" / "24:59" / "0:07"

// hold.ts — hold-to-exit
export const HOLD_MS = 30_000;
export interface HoldState {
  pressedAt: number | null;
}
export function press(s: HoldState, now: number): HoldState; // ignores if already pressed
export function release(): HoldState; // back to { pressedAt: null }
export function holdProgress(s: HoldState, now: number, holdMs?: number): number; // 0..1
export function holdDone(s: HoldState, now: number, holdMs?: number): boolean;

// queue.ts
export const CALM_MIN_TRACKS = 10,
  LONG_TRACK_MS = 6 * 60_000;
export function isCalmTrack(t: Pick<Track, 'title' | 'artist' | 'album' | 'durationMs'>): boolean;
export function buildStudyQueue(
  tracks: Pick<Track, 'id' | 'title' | 'artist' | 'album' | 'durationMs' | 'kind'>[],
  playlists: Pick<Playlist, 'id' | 'trackIds'>[],
  source: StudySource,
): { ids: string[]; fellBack: boolean }; // only kind 'music'; playlist missing/empty or calm < 10 → library + fellBack
```

### Datos de estudio — `apps/web/src/study/records.ts` y `repo.ts`

```ts
export interface StudyRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  plannedMin: number;
  studiedMin: number;
  completed: boolean;
}
export interface StudySummary {
  todayMin: number;
  weekMin: number;
  sessions: number;
  completed: number;
  streakDays: number;
}
export function summarizeStudy(records: StudyRecord[], now: number): StudySummary; // local time; week = last 7 days incl. today; streak = consecutive days ending today (or yesterday) with studiedMin > 0
export interface StudyRepo {
  put(r: StudyRecord): Promise<void>;
  listBetween(from: number, to: number): Promise<StudyRecord[]>;
  clear(): Promise<void>;
}
export const idbStudyRepo: StudyRepo;
export function memoryStudyRepo(): StudyRepo;
export function setStudyRepo(r: StudyRepo): void;
export function getStudyRepo(): StudyRepo;
```

IndexedDB: `offline/db.ts` versión 5, almacén `study` (`keyPath: 'id'`, índice `by-startedAt`).

### Sonido ambiente — `apps/web/src/study/noise.ts` y `ambient.ts`

```ts
// noise.ts (pure, rng injectable)
export function whiteNoise(length: number, rng?: () => number): Float32Array; // [-1,1]
export function brownNoise(length: number, rng?: () => number): Float32Array; // integrated, leaky, normalised to peak 0.9
export function makeSeamless(data: Float32Array, fadeSamples: number): Float32Array; // crossfade tail into head
// ambient.ts (Web Audio, lazy AudioContext)
export type AmbientId = 'white' | 'gray' | 'brown' | 'rain' | 'waves';
export function availableAmbient(): AmbientId[]; // generated always; rain/waves only if the .ogg exists
export function setAmbientLevel(id: AmbientId, level: number): Promise<void>; // 0 = stop that sound; 0..1
export function stopAllAmbient(fadeMs?: number): void;
```

### Store — `apps/web/src/stores/study.ts`

```ts
export type StudyPhase = 'idle' | 'running' | 'done';
interface StudyState {
  phase: StudyPhase;
  session: StudySession | null;
  pin: PinState; // refreshed every 2 s while running
  lastResult: { minutes: number; completed: boolean } | null;
  fellBack: boolean; // the chosen mix was replaced by the whole library
  ambient: Partial<Record<AmbientId, number>>; // saved in pref 'study-ambient'
  lastChoice: { minutes: number; source: StudySource }; // pref 'study-last'
  start(minutes: number, source: StudySource): Promise<void>;
  changeSource(source: StudySource): void; // new queue, same session
  setAmbient(id: AmbientId, level: number): void;
  repin(): Promise<void>;
  giveUp(): Promise<void>; // after the 30 s hold
  dismissDone(): void; // done → idle
}
export const useStudy;
export function restoreStudySession(): void; // called once at module load
```

Pref de sesión: `study-session` = `StudySession | null`.

### Textos — `apps/web/src/i18n/study.ts` (`studyEn`, `studyEs`, `studyEu`)

Claves mínimas (T4 las crea; si a T6 le falta alguna, la añade en los 3 idiomas):
`nav.study`, `study.title`, `study.intro`, `study.webOnly`, `study.duration`, `study.minutes`,
`study.minutes.one`, `study.custom`, `study.source`, `study.source.library`,
`study.source.calm`, `study.source.calmHint`, `study.source.playlist`, `study.fellBack`,
`study.ambient`, `study.ambient.white`, `.gray`, `.brown`, `.rain`, `.waves`, `study.ambient.off`,
`study.pinExplain` (qué hará Android y que hay que pulsar «Fijar»), `study.start`,
`study.remaining`, `study.notPinned`, `study.pinAgain`, `study.pinSettings`,
`study.pinSettingsHint`, `study.hold` («Mantén pulsado 30 s para salir»), `study.holdKeep`,
`study.holdReleased`, `study.volume`, `study.change`, `study.done.title` («¡Bien hecho!»),
`study.done.body` (`{minutes}`), `study.done.again`, `study.done.close`, `study.gaveUp`
(`{minutes}`), `study.stats.title`, `study.stats.today`, `study.stats.week`,
`study.stats.sessions`, `study.stats.streak`, `study.stats.off` (sin permiso no se guarda),
`study.stats.enable`, `study.queueLabel`, `study.tip`, `study.help`, `study.err.noMusic`,
`study.err.pin`, `study.err.save`.

Ayuda: artículo `id: 'study-mode'`, sección `listen`, en `apps/web/src/help/articles/study.ts`.
Consejo de pantalla: `<ScreenTip id="study-pin" text="study.tip" helpId="study-mode" />`.

## Tareas

### T1 · Plugin nativo StudyLock + puente + falso · Grupo A · Estado: HECHA

- Archivos (exclusivos):
  `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/StudyLockPlugin.java`,
  `.../askestream/StudyChimeReceiver.java`, `.../askestream/ChimePlayer.java`,
  `.../askestream/MainActivity.java`, `apps/mobile/android/app/src/main/AndroidManifest.xml`,
  `apps/web/src/native/studyLock.ts`, `apps/web/test/fake-native/studyLock.ts`,
  `apps/web/vite.config.ts`
- Leer como contexto: `AskeNativePlugin.java` (estilo de plugin), `apps/web/src/native/askeNative.ts`,
  `apps/web/test/fake-native/askeNative.ts`
- Qué hacer:
  - Puente TS y falso exactamente como en Contratos; alias en `vite.config.ts`.
  - `StudyLockPlugin` (`@CapacitorPlugin(name = "StudyLock")`):
    - `pin`/`unpin` en el hilo de UI (`getActivity().runOnUiThread`).
    - `status` con `getLockTaskModeState()` (NONE/PINNED/LOCKED → 'none'/'pinned'/'locked').
    - `scheduleChime`: `PendingIntent.getBroadcast` (FLAG_IMMUTABLE | UPDATE_CURRENT) con
      extra `endsAt`. En API ≥ 31 y `!canScheduleExactAlarms()` usar
      `setAndAllowWhileIdle` y devolver `exact:false`.
    - `cancelChime`, `chimeNow`, `openPinSettings` (`Settings.ACTION_SECURITY_SETTINGS`).
  - `ChimePlayer.playOnce(Context, long endsAt)`:
    - Sincronizado; lee y escribe `lastChimedEndsAt` en SharedPreferences `aske-study`.
    - Si ya sonó para ese `endsAt`, no hace nada.
    - Sintetiza 3 golpes de campana (PCM 16 bit, 44,1 kHz, mono) con 880 Hz (0,6),
      1318,5 Hz (0,25) y 2637 Hz (0,1), caída exponencial τ = 0,9 s, pico 0,35.
      Cada golpe dura 2,2 s: unos 6,6 s en total.
    - `AudioTrack` MODE_STATIC con `USAGE_MEDIA` + `CONTENT_TYPE_SONIFICATION`, sin foco de
      audio; se libera con `Handler.postDelayed` al terminar.
  - `StudyChimeReceiver` (exported=false): `goAsync()`, llama `ChimePlayer.playOnce` y termina.
  - Manifest:
    - `<receiver>`;
    - `USE_EXACT_ALARM`;
    - `SCHEDULE_EXACT_ALARM` con `android:maxSdkVersion="32"`.
  - `MainActivity`: `registerPlugin(StudyLockPlugin.class)`.
  - Métodos Java de menos de 50 líneas; comentarios en inglés.
- TDD: no (código nativo sin tests en el repo; el falso se prueba vía T5)
- Criterios de aceptación:
  - [ ] `npm run check` pasa; `npm run build -w @aske/web -- --mode fakenative` compila
        (después reconstruir el dist normal).
  - [ ] `.\gradlew.bat assembleDebug` en `apps/mobile/android` compila.
  - [ ] En el móvil: `pin()` muestra el diálogo de Android; `status()` devuelve 'pinned'
        tras aceptar; `chimeNow` suena 3 veces y una segunda llamada con el mismo `endsAt`
        no suena.
- Verificación: `npm run check`; `cd apps/mobile/android; .\gradlew.bat assembleDebug`

### T2 · Lógica pura: sesión, mantener-para-salir y cola · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/study/session.ts`, `apps/web/src/study/hold.ts`,
  `apps/web/src/study/queue.ts`, `apps/web/test/studySession.test.ts`,
  `apps/web/test/studyHold.test.ts`, `apps/web/test/studyQueue.test.ts`
- Leer como contexto: `apps/web/src/stores/sleepTimer.ts` (patrón endsAt),
  `packages/shared/src/index.ts` (Track, Playlist)
- Qué hacer:
  - Implementar las firmas de Contratos (session, hold, queue). Sin imports de stores ni de
    `i18n`: funciones puras.
  - `restoreDecision` exige `id` string, números finitos, `endsAt > startedAt` y un `source`
    válido.
  - `isCalmTrack`:
    - Regex sin distinguir mayúsculas sobre título+artista+álbum: `instrumental`, `lo-?fi`,
      `piano`, `ambient`, `study|estudio|ikas`, `classical|clásica|klasiko`, `chill`, `relax`,
      `focus`, `soundtrack|\bost\b|banda sonora`, `no vocals|sin letra|letrarik gabe`,
      `beats`, `meditation|meditación`.
    - O bien `durationMs >= LONG_TRACK_MS`.
  - La cola respeta el orden de la playlist y no repite ids; el aleatorio lo pone el
    reproductor.
- TDD: sí
- Criterios de aceptación:
  - [ ] Tests: - clamp (NaN, 0, 300); - `musicFactor` (antes, mitad y después del fundido); - `restoreDecision` (none/resume/ended/basura); - `studiedMinutes` al rendirse a mitad; - `formatClock`.
  - [ ] Tests de hold: progreso 0 → 0,5 → 1; `release` reinicia; `press` doble no reinicia.
  - [ ] Tests de cola: - excluye podcasts; - playlist inexistente → biblioteca + `fellBack`; - calm con < 10 → `fellBack`; - calm por palabra y por duración.
- Verificación: `npx vitest run test/studySession.test.ts test/studyHold.test.ts test/studyQueue.test.ts --root apps/web`

### T3 · Datos de estudio (IndexedDB) y motor de sonido ambiente · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/study/records.ts`, `apps/web/src/study/repo.ts`,
  `apps/web/src/offline/db.ts`, `apps/web/src/stores/stats.ts`, `apps/web/src/study/noise.ts`,
  `apps/web/src/study/ambient.ts`, `apps/web/src/study/sounds/README.md`,
  `apps/web/test/studyRecords.test.ts`, `apps/web/test/studyNoise.test.ts`,
  `apps/web/test/statsStore.test.ts`, `apps/web/test/offlineDb.test.ts`
- Leer como contexto: `apps/web/src/stats/repo.ts`, `apps/web/src/stats/recap.ts` (cálculo de
  rachas y días locales)
- Qué hacer:
  - Datos:
    - `records.ts` y `repo.ts` según Contratos (copiar el patrón de `stats/repo.ts`).
    - `db.ts` pasa a la versión 5 y crea el almacén `study` con su índice.
    - En `stores/stats.ts`, `clearHistory()` borra también `getStudyRepo().clear()`.
      Si cualquiera falla: mismo toast y `false`.
  - Sonido:
    - `noise.ts` con las funciones puras de Contratos. Marrón: integración con fuga
      `y = 0.98 * y + 0.02 * white`, después normalizada a pico 0,9.
    - `ambient.ts`:
      - un `AudioContext` perezoso (`resume()` en cada `setAmbientLevel`) y un `GainNode` por
        sonido;
      - buffer mono de 10 s con `makeSeamless(…, 0.5 s)` en `loop`;
      - el gris es blanco + `lowshelf` +10 dB a 250 Hz + `peaking` −6 dB a 3 kHz (Q 1) +
        `highshelf` +4 dB a 10 kHz;
      - los cambios de nivel con `setTargetAtTime` (0,3 s);
      - `stopAllAmbient` hace un fundido y para las fuentes.
    - Archivos de lluvia y olas: `import.meta.glob('./sounds/*.ogg', { query: '?url', import:
'default', eager: true })`, se decodifican con `decodeAudioData` la primera vez. Si falla
      la carga: `console.error` y ese sonido no suena (sin romper los demás).
    - `sounds/README.md` (en inglés):
      - nombres esperados `rain.ogg` y `waves.ogg`;
      - requisitos: CC0, Opus mono 48 kbps, 60-120 s, bucle sin corte, ≤ 600 KB cada uno;
      - fuentes recomendadas: Freesound con filtro CC0, BigSoundBank y OpenGameArt con
        filtro CC0;
      - poner aquí autor y enlace de cada archivo.
- TDD: sí (records y noise); el motor Web Audio sin test
- Criterios de aceptación:
  - [ ] `summarizeStudy`: hoy/semana en hora local, sesiones y completadas, racha que
        termina hoy o ayer, 0 con lista vacía.
  - [ ] Ruido: - valores en [−1, 1] y deterministas con un rng fijo; - el marrón tiene menos diferencia media entre muestras que el blanco; - tras `makeSeamless`, |último − primero| es pequeño.
  - [ ] `statsStore.test.ts`: `clearHistory` también vacía el repo de estudio (con
        `memoryStudyRepo`).
  - [ ] `offlineDb.test.ts` sigue en verde con la versión 5.
  - [ ] `npm run check` pasa sin archivos `.ogg`.
- Verificación: `npx vitest run test/studyRecords.test.ts test/studyNoise.test.ts test/statsStore.test.ts test/offlineDb.test.ts --root apps/web`

### T4 · Textos (es/en/eu) y artículo de ayuda · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/study.ts`, `apps/web/src/i18n/en.ts`,
  `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/src/help/articles/study.ts`,
  `apps/web/src/help/articles.ts`
- Leer como contexto: `apps/web/src/i18n/stats.ts`, `apps/web/src/help/articles/stats.ts`,
  `apps/web/src/help/articles/types.ts`
- Qué hacer:
  - Textos:
    - Crear todas las claves de Contratos en los 3 idiomas (inglés = fuente) y registrarlas
      con `...studyEn` / `...studyEs` / `...studyEu`.
    - Singulares en `.one`; usar `{minutes}` y `{count}`.
    - Lenguaje sencillo, sin «lock task», «pinning» ni otra jerga.
  - `study.pinExplain`: Android preguntará «¿Fijar la app?»; pulsa «Fijar» o «Aceptar».
    Mientras esté fijada no podrás abrir otras apps ni ver notificaciones, pero sí coger
    llamadas.
  - Artículo `study-mode` (sección `listen`), con:
    - qué es;
    - cómo empezar;
    - qué se puede hacer durante la sesión;
    - cómo salir antes (30 s);
    - qué pasa al acabar;
    - que la sesión sigue aunque Android cierre la app;
    - **honestidad:** Android siempre deja salir con su combinación de botones
      (p. ej. mantener Atrás + Recientes; depende del móvil), porque es una ayuda para
      concentrarse y no un candado;
    - qué hacer si no aparece el aviso de fijar («Fijar aplicaciones» en Ajustes →
      Seguridad);
    - mezcla tranquila: se elige por el nombre y la duración, así que puede fallar;
    - sonidos ambiente;
    - historial: solo con el Recap y solo en el móvil; enlaces `[[listening-stats|…]]` y
      `[[privacy|…]]`.
  - `study.tip`: una frase («Pulsa Empezar; Android te pedirá permiso para fijar la
    pantalla»).
- TDD: no (lo cubren los tests de paridad y de enlaces que ya existen)
- Criterios de aceptación:
  - [ ] `npx vitest run test/i18n.test.ts test/help.test.ts --root apps/web` en verde.
  - [ ] Todas las claves de Contratos existen.
- Verificación: `npx vitest run test/i18n.test.ts test/help.test.ts --root apps/web`

### T5 · Store `useStudy` (orquestación) y botón Atrás · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/study.ts`, `apps/web/src/native/shell.ts`,
  `apps/web/test/studyStore.test.ts`
- Leer como contexto: los archivos de T1–T3, `apps/web/src/stores/sleepTimer.ts`,
  `apps/web/src/stores/player.ts` (solo la interfaz `PlayerState`),
  `apps/web/src/stores/library.ts` (`tracks`, `playlists`), `apps/web/src/stores/stats.ts`,
  `apps/web/test/sleepTimer.test.ts` (cómo mockear)
- Qué hacer: implementar el store de Contratos.
  - `start`:
    - `buildStudyQueue`; si `ids` vacío → toast `study.err.noMusic` y no empieza.
    - `useSleepTimer.cancel()`.
    - `playTracks(ids, null, { shuffle: true, context: { label: t('study.queueLabel'),
cycleKey: 'study:' + kind } })`.
    - `createSession(Date.now(), …, crypto.randomUUID())`, guardar la pref
      `study-session` y `lastChoice`.
    - `StudyLock.scheduleChime` y `StudyLock.pin()`.
    - Volver a aplicar los niveles de `ambient` y arrancar el tick.
  - Tick cada 1 s:
    - volumen = base × `musicFactor` (guardar la base la primera vez que el factor sea < 1,
      igual que `sleepTimer`);
    - cada 2 s, `status()` → `pin`;
    - al llegar a `endsAt` → `finish(true)`.
  - `finish(completed)`:
    - si `completed`: `chimeNow({endsAt})` y esperar `CHIME_TOTAL_MS` antes de `pause()`;
    - devolver el volumen, `stopAllAmbient()`, `cancelChime()`, `unpin()`;
    - guardar el `StudyRecord` solo si `useStats.getState().consent === 'on'` (si falla:
      `console.error` + toast `study.err.save`; la sesión termina igual);
    - borrar la pref; `phase` = 'done' si completada y 'idle' + toast `study.gaveUp` si te
      rindes;
    - `lastResult` lleno.
  - `giveUp` = `finish(false)` sin campanilla (la música sigue).
  - `restoreStudySession`:
    - `resume` → `phase` 'running', tick y `pin` (Android vuelve a preguntar);
    - `ended` → guardar el registro (si hay permiso), `phase` 'done' y `unpin()`, sin
      campanilla (ya sonó la nativa o llegó tarde).
  - Errores del plugin (`pin`, `scheduleChime`): `console.error` + toast `study.err.pin`; la
    sesión sigue.
  - `shell.ts`: al principio del listener de Atrás,
    `if (useStudy.getState().phase !== 'idle') return;`.
  - Funciones de menos de 50 líneas; partir en helpers si hace falta.
- TDD: sí
- Criterios de aceptación (con `vi.useFakeTimers`, `memoryStudyRepo`, mocks de `StudyLock`,
  `usePlayer` y `ambient`):
  - [ ] `start` con la biblioteca vacía no empieza y avisa.
  - [ ] `start` llama a `pin`, `scheduleChime` y `playTracks` y guarda `study-session`.
  - [ ] En el minuto final el volumen baja; al final suena `chimeNow` una vez, el volumen
        vuelve, `unpin`, `phase` 'done'.
  - [ ] `giveUp` guarda `completed:false` con los minutos estudiados; sin permiso no
        guarda nada.
  - [ ] `restoreStudySession`: pasado → 'done' sin `chimeNow`; futuro → 'running'.
- Verificación: `npx vitest run test/studyStore.test.ts --root apps/web`; `npm run check`

### T6 · Pantalla «Estudio» y modo foco · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/StudyView.tsx`,
  `apps/web/src/components/study/StudySetup.tsx`,
  `apps/web/src/components/study/StudyFocus.tsx`,
  `apps/web/src/components/study/HoldToExit.tsx`,
  `apps/web/src/components/study/AmbientMixer.tsx`,
  `apps/web/src/components/study/StudyDone.tsx`,
  `apps/web/src/components/study/StudyStats.tsx`, `apps/web/src/study.css`,
  `apps/web/src/App.tsx`, `apps/web/src/components/Nav.tsx`,
  `apps/web/src/views/LibraryView.tsx`, `apps/web/src/i18n/study.ts` (solo para añadir claves
  que falten)
- Leer como contexto: `apps/web/src/stores/study.ts`, `apps/web/src/study/*.ts`,
  `apps/web/src/views/RecapView.tsx` y `components/stats/ConsentSheet.tsx` (pedir permiso),
  `components/ScreenTip.tsx`, `apps/web/src/groups.css` (cómo se importa un CSS propio),
  `apps/web/src/styles.css` (variables; solo ámbar)
- Qué hacer:
  - `App.tsx`:
    - ruta `/study` → `StudyView`;
    - en `Shell`, después de todos los hooks, si `useStudy(phase) !== 'idle'` devolver
      `<div className="app study-mode"><StudyView /><Dialogs /><Toasts /></div>`.
  - `Nav.tsx`: item `/study` (`nav.study`, icono `Timer` de lucide) en `SIDEBAR_ITEMS` solo
    si `isNative`.
  - `LibraryView.tsx`: botón en la cabecera (icono + «Estudiar») que va a `/study`, solo si
    `isNative`.
  - `StudyView`:
    - si `!isNative` → aviso `study.webOnly` con enlace a `/help/study-mode`;
    - si no, según `phase`: `idle` → `StudySetup`; `running` → `StudyFocus`; `done` →
      `StudyDone`.
  - `StudySetup`:
    - presets + campo de minutos (5-240);
    - fuente: biblioteca / tranquila (con su nota) / lista de playlists;
    - `AmbientMixer`;
    - `study.pinExplain`, `ScreenTip id="study-pin"`;
    - botón grande «Empezar»;
    - `StudyStats` (si el permiso está apagado, texto `study.stats.off` + botón que abre
      `ConsentSheet`).
  - `StudyFocus`:
    - reloj grande (`formatClock`);
    - pausa/play y siguiente grandes (≥ 64 px);
    - deslizador de volumen de la música;
    - botón «Cambiar música» (hoja con las fuentes → `changeSource`) y `AmbientMixer`;
    - si `pin !== 'pinned' && pin !== 'locked'`: banner `study.notPinned` con botones
      «Fijar pantalla» (`repin`) y `study.pinSettings`;
    - aviso `fellBack` si toca;
    - `HoldToExit` abajo.
  - `HoldToExit`:
    - usa `hold.ts` con pointerdown/up/cancel/leave y requestAnimationFrame;
    - barra de progreso ámbar con `role="progressbar"`;
    - al soltar antes: texto `study.holdReleased`;
    - al completar → `giveUp()`;
    - también vale mantener la tecla Espacio o Intro.
  - `AmbientMixer`: un deslizador 0-100 por cada `availableAmbient()` → `setAmbient`.
  - `StudyDone`: «¡Bien hecho!», minutos, «Otra sesión» (`start(lastChoice)`) y «Cerrar»
    (`dismissDone`).
  - Lenguaje sencillo, controles grandes, solo variables de color existentes (ámbar).
- TDD: no
- Criterios de aceptación:
  - [ ] `npm run check` pasa.
  - [ ] Con `npm run build -w @aske/web -- --mode fakenative` y el navegador: empezar 5 min
        muestra el modo foco sin menú; mantener 30 s sale; soltar antes reinicia la barra.
  - [ ] En web normal no hay entrada en el menú y `/study` muestra el aviso.
  - [ ] En el APK: diálogo de fijar, aviso si se rechaza, campanilla con la pantalla
        apagada y música en pausa, «¡Bien hecho!» y desbloqueo al acabar.
- Verificación: `npm run check`; prueba manual en fakenative y en el móvil

### T7 · Documentación y privacidad · Grupo D · Estado: HECHA

- Archivos (exclusivos): `docs/ESTADO.md`, `docs/v2/architecture.md`, `docs/PRIVACY.md`,
  `docs/android.md`, `docs/plan/PLAN.md` (solo los estados)
- Leer como contexto: este plan
- Qué hacer:
  - `PRIVACY.md` (y su resumen si hay versiones en otros idiomas):
    - las sesiones de estudio se guardan solo en el dispositivo y solo con el Recap
      activado;
    - se borran con el historial;
    - nunca se envían.
  - `android.md`:
    - plugin `StudyLock`;
    - permisos `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` y por qué;
    - fijar pantalla y su limitación.
  - Arquitectura: fila 9 a ✅ cuando T1–T6 estén hechas.
  - `ESTADO.md`:
    - F9 hecha;
    - pendientes de Andoni: archivos CC0 de lluvia y olas, prueba en el móvil (llamada
      entrante con la app fijada, campanilla con la pantalla apagada, reinicio de la app a
      mitad de sesión).
- TDD: no
- Criterios de aceptación:
  - [ ] `npm run check` (Prettier sobre los .md) pasa.
- Verificación: `npm run check`

## Riesgos / dudas abiertas

- **Archivos de lluvia y olas (pendiente de Andoni):** no se descarga nada. Hay que conseguir
  `rain.ogg` y `waves.ogg` con licencia CC0 y dejarlos en `apps/web/src/study/sounds/`. Fuentes
  recomendadas: freesound.org (filtro «Creative Commons 0»), bigsoundbank.com y
  opengameart.org (filtro CC0). Hasta entonces solo salen los tres ruidos generados.
- **Llamadas con la app fijada:** en la mayoría de móviles la llamada entrante se ve y se puede
  coger, pero algunos fabricantes lo cambian. Hay que comprobarlo en el móvil (T6/T7).
- **Android antiguo (7-8):** si «Fijar aplicaciones» está apagado en Ajustes, puede que no salga
  el diálogo. La UI ofrece abrir Ajustes y lo explica la ayuda.
- **Sonido ambiente con la pantalla apagada y la música en pausa:** el WebView podría
  silenciarlo. Con música sonando funciona igual que el reproductor. Hay que comprobarlo en el
  móvil.
- **Al acabar se pausa la música** (después de la campanilla). Es una decisión del plan, no
  bloquea: si Andoni prefiere que siga sonando bajita, basta con quitar el `pause()` en T5.
- **Peso del APK:** el código añade ~0 KB de audio. Con los dos .ogg, ≤ 1,2 MB en total.

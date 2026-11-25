# PLAN: v0.9.2 — Enviar en menús y selección, Ordenar compacto, interruptor Aleatorio, Grupos en Ajustes y deuda técnica

Fecha: 2026-11-25 · Estado: COMPLETADO

## Objetivo

Pulir la interfaz pedida por Andoni (Enviar desde el menú ⋮ y la selección, botón «Ordenar» que no se
corta, interruptor Aleatorio global junto al Play, opciones de privacidad de Grupos en Ajustes) y pagar
la deuda conocida: `player.ts` y `downloads.ts` más pequeños, el bug de `play()` tras pausar durante una
recarga y tests de `D1GroupRepo`. Sin subir versión ni hacer commit.

## Decisiones de arquitectura

- **Refactor de `player.ts` antes de tocar Aleatorio** (T1 → T4) — está en 799 líneas; objetivo < 450.
- **Aleatorio = una preferencia global (`shuffle`) separada del orden de la lista que suena
  (`contextShuffled`)** — así los podcasts (siempre en orden) y el modo estudio (siempre aleatorio) no
  cambian el interruptor del usuario, y la UI muestra siempre lo mismo en Biblioteca, Playlist y reproductor.
- **La preferencia se guarda en su propia clave `shuffle`** (no dentro de `player-v2`) — `persist()`
  no guarda nada en modo radio; con clave propia el interruptor se recuerda siempre.
- **Pausa del usuario con contador (`rt.userPauseSeq`)** — `loadCurrent`/`reloadCurrent` comparan el
  contador antes y después del `await`; si cambió, no llaman a `audio.play()`.
- **Enviar reutiliza el flujo «paquete con código» (`useParcel`)** — ya existe y funciona; una playlist
  viaja con su nombre (`sendPlaylist`), varias se envían como canciones sueltas (el paquete solo admite
  un nombre).
- **Selección de playlists = estado nuevo en `ui.ts` (`playlistSelection`) y barra propia** — no mezcla
  ids de canciones con ids de playlists; empezar una selección cierra la otra.
- **«Ordenar» = componente genérico `SortMenu` (botón + menú desplegable propio)** — el `<select>`
  nativo no se puede acortar; el botón muestra icono + criterio corto con elipsis.
- **CSS nuevo en archivos propios** (`collection.css`, `playlistSelect.css`) y `groups.css` — `styles.css`
  ya pasa de 2500 líneas; así las tareas paralelas no chocan.
- **Tests de `D1GroupRepo` con SQLite real (`node:sqlite`) y las migraciones del Hub** — sin dependencias
  nuevas (prohibido `npm install`); un adaptador mínimo imita la API de D1.

### Cómo funciona Aleatorio (para T4 y T6)

- **Estado:** `usePlayer.shuffle` (preferencia global, lo que pinta el icono) y
  `usePlayer.contextShuffled` (si la lista actual está barajada). Al arrancar:
  `shuffle = loadValue('shuffle', saved?.shuffle ?? false)` (los usuarios actuales conservan lo último que
  tenían); `contextShuffled = saved?.shuffle ?? false` (el campo `shuffle` de `player-v2` pasa a significar
  `contextShuffled`; se mantiene el nombre del campo guardado por compatibilidad).
- **Play / tocar una canción:** `playTracks(ids, startId, { context })` sin `shuffle` → usa la preferencia.
  ON y sin `startId`: la primera canción es al azar (ciclo de `shuffleCycle`, como hoy). ON y con `startId`:
  empieza por esa canción y el resto al azar. OFF: en orden. `opts.shuffle` (podcasts `false`, estudio
  `true`) solo afecta a esa lista y **nunca cambia la preferencia**.
- **Interruptor (`toggleShuffle`)**: invierte `shuffle`, lo guarda (`savePref('shuffle', …)`) y, si suena
  una lista (`mode === 'track'`), no es de orden fijo (`!contextInfo?.fixedOrder`) y
  `contextShuffled !== nuevoValor`, reordena lo que queda con la lógica actual (la canción actual sigue
  sonando; con ON se baraja lo pendiente; con OFF se vuelve al orden original desde la canción actual).
- **Siguiente / Anterior / cola:** sin cambios de comportamiento. La cola del usuario («Añadir a la cola»,
  «Reproducir después») nunca se baraja y suena primero. «Siguiente» avanza por `context` (barajado o no);
  «Anterior» retrocede por ese mismo `context`, o sea, vuelve a la canción que sonó antes también en
  aleatorio. Con repetir todo y aleatorio, cada vuelta nueva se rebaraja (como hoy). Las canciones nuevas
  de una lista «viva» entran barajadas si `contextShuffled`.
- Todo lo que hoy lee `s.shuffle` para decidir el orden (`step`, `loadCurrent`→`recordShufflePlay`,
  `moveUpcoming`, suscripción de biblioteca viva, `persist`) pasa a leer `contextShuffled`.

## Contratos (interfaces compartidas)

### Player (T1 crea, T4 amplía)

```ts
// apps/web/src/player/types.ts  (se mueven aquí; stores/player.ts los re-exporta)
export interface RadioItem { key; name; streamUrl; favicon; hls; rbUuid; subtitle } // igual que hoy
export interface PlayContext {
  label: string; path?: string; live?: 'library'; cycleKey?: string;
  fixedOrder?: boolean; // T4: true = nunca se baraja (podcasts)
}

// apps/web/src/player/runtime.ts  (T1)
export const audio: HTMLAudioElement;            // el único <audio>
export const rt: {
  hls: Hls | null; objectUrl: string | null; loadSeq: number; pendingSeek: number | null;
  reloading: boolean; listenedMarked: boolean; consecutiveErrors: number;
  triedHttpsUpgrade: boolean; userPauseSeq: number;
};
export function resetSource(): void;
export function userPause(): void;               // rt.userPauseSeq++ y audio.pause()

// apps/web/src/player/radioEngine.ts  (T1)
export function stationAt(list: RadioItem[], currentKey: string | undefined, dir: 1 | -1): RadioItem | null; // pura
export function startRadio(item: RadioItem, deps: RadioDeps, forceUrl?: string): Promise<void>;

// apps/web/src/player/audioEvents.ts  (T1) — listeners del <audio> (timeupdate … error)
export function attachAudioEvents(deps: AudioEventDeps): void;

// apps/web/src/player/libraryLinks.ts  (T1) — 2 suscripciones a useLibrary + setProtectedProvider
export function linkPlayerToLibrary(deps: LibraryLinkDeps): void;

// stores/player.ts (T4) — cambios en PlayerState
shuffle: boolean;          // preferencia global (UI)
contextShuffled: boolean;  // orden de la lista que suena
toggleShuffle(): void;     // ver «Cómo funciona Aleatorio»
```

`RadioDeps`, `AudioEventDeps` y `LibraryLinkDeps` los define T1 (objetos con `getState`/`setState` de
`usePlayer`, `engine`, funciones de media session y del vigilante). Ningún módulo de `player/` importa
`stores/player.ts` en tiempo de ejecución (solo `import type`), para evitar ciclos.

### Selección de playlists (T5)

```ts
// apps/web/src/stores/ui.ts
playlistSelection: string[] | null;
startPlaylistSelection: (firstId?: string) => void;   // también pone selection = null
togglePlaylistSelected: (id: string) => void;
selectAllPlaylists: (ids: string[]) => void;          // si ya están todas, vacía
endPlaylistSelection: () => void;
// startSelection (canciones) pasa a poner también playlistSelection = null
```

### Enviar (T5)

```ts
// apps/web/src/stores/parcel.ts
sendPlaylists: (playlistIds: readonly string[]) => Promise<boolean>;
// 1 id  → songsFromTracks(tracks de la playlist) → sendPlaylist({ name, songs, unavailable: skipped })
// 2+ ids → ids de canciones de todas, en orden y sin repetir → sendTracks(ids)
// 0 ids o playlist inexistente → false sin llamar al Hub
```

Etiqueta de «Enviar» en menús y barras: clave existente `parcel.sendSelected` («Enviar a otro móvil»).
Solo se muestra si `hubAvailable()`.

### UI compartida (T6)

```ts
// apps/web/src/components/ShuffleToggle.tsx
export function ShuffleToggle({ size }: { size?: number }): JSX.Element;
// icon-btn con clase `on` (ámbar) si usePlayer.shuffle; aria-pressed; aria-label t('player.shuffle');
// onClick: toggleShuffle() + toast player.shuffleOn / player.shuffleOff
// apps/web/src/components/SortMenu.tsx
export function SortMenu<T extends string>(props: {
  value: T;
  options: { value: T; label: string; short: string }[];
  label: string;
  onChange: (value: T) => void;
}): JSX.Element;
```

### i18n: qué archivo toca cada tarea (para no chocar)

- T3 → `i18n/groups.ts` · T5 → `i18n/parcel.ts` y `i18n/share.ts` · T6 → `i18n/en.ts`, `es.ts`, `eu.ts`.
- T1, T2 y T4 no añaden textos.

## Tareas

### T1 · Refactor de player.ts + bug de pausa durante la carga · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/player.ts`, `apps/web/src/player/types.ts` (nuevo),
  `apps/web/src/player/runtime.ts` (nuevo), `apps/web/src/player/radioEngine.ts` (nuevo),
  `apps/web/src/player/audioEvents.ts` (nuevo), `apps/web/src/player/libraryLinks.ts` (nuevo),
  `apps/web/test/playerPauseDuringLoad.test.ts` (nuevo), `apps/web/test/radioEngine.test.ts` (nuevo),
  `apps/web/test/playerShuffle.test.ts` (solo si hay que ajustar mocks por los módulos nuevos).
- Leer como contexto: `apps/web/src/player/mediaSession.ts`, `apps/web/src/player/stallRecovery.ts`,
  `apps/web/test/playerShuffle.test.ts` (copiar su arnés de `FakeAudio` y mocks).
- Qué hacer:
  1. **Primero el refactor sin cambiar comportamiento** (los tests actuales deben seguir en verde):
     mover `RadioItem`/`PlayContext` a `player/types.ts` (re-exportar desde `stores/player.ts`); el
     `<audio>`, las variables sueltas (`hls`, `objectUrl`, `loadSeq`, `pendingSeek`, `reloading`,
     `listenedMarked`, `consecutiveErrors`, `triedHttpsUpgrade`) y `resetSource` a `player/runtime.ts` (objeto
     `rt`); `startRadio` y el cálculo de emisora anterior/siguiente a `player/radioEngine.ts` (quitar el
     truco `engine as … retryRadio`: que sea un campo normal de `engine`); los listeners del `<audio>` a
     `player/audioEvents.ts`; las dos suscripciones a `useLibrary` y `setProtectedProvider` a
     `player/libraryLinks.ts`. `stores/player.ts` debe quedar < 450 líneas y todas las funciones < 50.
  2. **Después el bug (TDD):** añadir `rt.userPauseSeq`; `pause()` del store y la rama de pausa de
     `togglePlay()` llaman a `userPause()`. En `loadCurrent` y `reloadCurrent`, guardar el contador antes
     del `await sourceFor(...)` y, si cambió al volver, no llamar a `audio.play()` (en `loadCurrent` dejar
     `isPlaying: false`). El vigilante (`stallRecovery`) y el evento `pause` del sistema no tocan el
     contador.
- TDD: sí (el refactor se apoya en los tests existentes; el bug y `stationAt` con tests nuevos primero).
- Criterios de aceptación:
  - [ ] `stores/player.ts` < 450 líneas; ningún archivo nuevo > 300; funciones < 50 líneas.
  - [ ] `playerShuffle.test.ts` pasa sin cambiar ninguna expectativa.
  - [ ] Test: con `resolveAudio` diferido, `reloadCurrent` + `pause()` antes de resolver → `audio.play` no se llama.
  - [ ] Test: lo mismo con `playTracks` (carga de canción nueva) → no suena y `isPlaying === false`.
  - [ ] Test: sin pausa del usuario, `reloadCurrent` sí vuelve a llamar a `play()` si estaba sonando.
  - [ ] Test de `stationAt`: avanza, retrocede y da la vuelta; `null` con lista de 0 o 1.
- Verificación: `npx vitest run test/playerShuffle.test.ts test/playerPauseDuringLoad.test.ts test/radioEngine.test.ts --root apps/web` y `npm run check`.

### T2 · Deuda: refactor de downloads.ts + tests de D1GroupRepo · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/downloads.ts`, `apps/web/src/downloads/errors.ts` (nuevo),
  `apps/web/src/downloads/notifier.ts` (nuevo), `apps/web/src/downloads/jobsStore.ts` (nuevo),
  `apps/web/test/downloadErrors.test.ts` (nuevo), `apps/hub/test/sqliteD1.ts` (nuevo),
  `apps/hub/test/node-sqlite.d.ts` (nuevo), `apps/hub/test/d1GroupRepo.test.ts` (nuevo).
- Leer como contexto: `apps/web/test/downloadsStore.test.ts`, `apps/web/src/downloads/notification.ts`,
  `apps/web/src/stores/send.ts` (importa `friendlyError`), `apps/hub/src/groups/repo.ts`,
  `apps/hub/migrations/*.sql`, `apps/hub/test/memoryGroupRepo.ts`, `apps/hub/tsconfig.json`.
- Qué hacer:
  1. **downloads.ts** (sin cambiar comportamiento): `friendlyError` y `saveErrorText` → `downloads/errors.ts`
     (re-exportar `friendlyError` desde `stores/downloads.ts` para no tocar `send.ts`); `persist` con
     temporizador, `requeuePatch`, `knownToNative`, `isActive`/`isFinished` → `downloads/jobsStore.ts`;
     la parte de notificación (`lastSent`, `sendTimer`, `batches`, `notify`, `endNotification`,
     `notificationTemplates`) → `downloads/notifier.ts` como fábrica
     `createDownloadNotifier({ getJobs, getWaitingNetwork })` que devuelve `{ notify, templates }`.
     Objetivo: `stores/downloads.ts` < 450 líneas. Añadir tests unitarios de `friendlyError`
     (un caso por rama).
  2. **D1GroupRepo:** `test/sqliteD1.ts` = adaptador mínimo sobre `DatabaseSync` de `node:sqlite` con la
     forma de D1: `prepare(sql).bind(...args)` → `first<T>()` (null si no hay fila), `all<T>()` →
     `{ results }`, `run()` → `{ meta: { changes } }`; `batch(stmts)` dentro de `BEGIN`/`COMMIT` con
     `ROLLBACK` y re-lanzar si falla; convertir `boolean`→0/1 y `undefined`→`null`. Función
     `createTestD1()` que aplica en orden todos los `apps/hub/migrations/*.sql` (`exec`). `node-sqlite.d.ts`
     declara solo los tipos usados de `node:sqlite` (el `tsconfig` del Hub solo carga workers-types).
     `d1GroupRepo.test.ts`: un `describe` por grupo de métodos (grupos, invitación única, miembros, alias,
     baneos, estadísticas por mes, compartidos con caducidad y `trimShares`, `deleteGroup` borra todo,
     `createGroup` devuelve `false` con código de invitación repetido y no deja filas a medias).
- TDD: sí (tests de errores y del repositorio; el refactor se apoya en `downloadsStore.test.ts`).
- Criterios de aceptación:
  - [ ] `stores/downloads.ts` < 450 líneas, funciones < 50; `downloadsStore.test.ts` pasa sin cambiar expectativas.
  - [ ] `friendlyError` cubierto por test en cada rama.
  - [ ] Cada método público de `D1GroupRepo` tiene al menos un test contra SQLite real.
  - [ ] `npm run typecheck -w @aske/hub` sin errores.
- Verificación: `npx vitest run --root apps/hub` y `npx vitest run test/downloadsStore.test.ts test/downloadErrors.test.ts --root apps/web`; después `npm run check`.

### T3 · Grupos: opciones a Ajustes y pantalla limpia · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/GroupsView.tsx`, `apps/web/src/views/SettingsView.tsx`,
  `apps/web/src/components/settings/GroupsSection.tsx` (nuevo),
  `apps/web/src/components/groups/GroupsConsent.tsx`, `apps/web/src/groups.css`,
  `apps/web/src/i18n/groups.ts`, `apps/web/src/help/articles/groups.ts`.
- Leer como contexto: `apps/web/src/components/settings/GeneralSections.tsx` (estilo de secciones),
  `apps/web/src/components/HelpSheet.tsx`, `apps/web/src/views/PlaylistsView.tsx` (clases `card-list`/`card-row`).
- Qué hacer:
  - `GroupsSection` en Ajustes (solo si `hubAvailable()`), después de la sección de Recap: título
    «Grupos» (clave nueva `groups.settings.section`), el interruptor `GroupsConsent` y `WipeGroupsSection`
    (importar `../../groups.css`).
  - `GroupsView`: quitar `GroupsConsent` y `WipeGroupsSection`. Cabecera: el `h1` con `min-width: 0` y
    elipsis/ajuste de línea, y la ayuda como botón de icono (`CircleHelp`, `icon-btn`, aria-label
    `groups.help`) que abre `HelpSheet` con `friend-groups`, para que no se pisen en euskera ni en
    pantallas de 320 px. Lista de grupos como tarjetas (`card-list` + `card-row`: icono `Users` en
    cuadrado ámbar suave, nombre, «N personas · Eres admin», chevron). Botones Crear/Unirse en una fila.
  - Aviso al final (texto pequeño + enlace «Ir a Ajustes» a `/settings`): claves nuevas
    `groups.settingsNote` («Compartir tus escuchas y borrar tus datos de grupos está en Ajustes → Grupos.»)
    y `groups.settingsLink`. En es, en y eu.
  - Artículo `friend-groups` (`help/articles/groups.ts`, 3 idiomas): el interruptor y «Borrar todos mis
    datos de grupos» están en **Ajustes → Grupos**.
  - Quitar de `groups.css` las reglas que queden sin uso (`.groups-consent`, `.groups-wipe` si se mueven, etc.).
- TDD: no (interfaz).
- Criterios de aceptación:
  - [ ] En Ajustes hay sección «Grupos» con el interruptor y el borrado; funcionan igual que antes.
  - [ ] La pantalla Grupos no muestra ninguna de las dos opciones y enseña el aviso con enlace a Ajustes.
  - [ ] El título no se corta ni se solapa con la ayuda a 320 px en eu/es/en.
  - [ ] Test de paridad i18n y test de enlaces de ayuda en verde.
- Verificación: `npm run check`; manual en `npm run dev` con ventana de 320 px y idioma euskera.

### T4 · Motor de Aleatorio: preferencia global · Grupo B (tras T1) · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/player.ts`, `apps/web/src/player/types.ts`,
  `apps/web/src/player/libraryLinks.ts`, `apps/web/src/views/PodcastsView.tsx`,
  `apps/web/test/playerShuffle.test.ts`, `apps/web/test/shufflePreference.test.ts` (nuevo).
- Leer como contexto: sección «Cómo funciona Aleatorio» de este plan, `apps/web/src/player/shuffleCycle.ts`,
  `apps/web/src/player/queue.ts`, `apps/web/src/stores/study.ts`.
- Qué hacer: implementar exactamente lo descrito en «Cómo funciona Aleatorio»: estado `contextShuffled`,
  preferencia `shuffle` con clave propia, `playTracks` sin tocar la preferencia, `toggleShuffle` nuevo,
  `PlayContext.fixedOrder`, y en `PodcastsView` pasar `fixedOrder: true` en el contexto. Adaptar las
  pruebas de `playerShuffle.test.ts` que dependían de que `playTracks({ shuffle })` cambiase la
  preferencia (p. ej. poner `usePlayer.setState({ shuffle: true })` o usar `contextShuffled`), sin perder
  ningún caso. `stores/player.ts` debe seguir < 500 líneas.
- TDD: sí.
- Criterios de aceptación (tests en `shufflePreference.test.ts`):
  - [ ] Con preferencia ON, `playTracks(ids, null)` empieza por una canción al azar y «siguiente» sigue al azar sin repetir hasta acabar la vuelta.
  - [ ] Con OFF, suena en orden; `playTracks(ids, 't3')` empieza en t3 y sigue t4…
  - [ ] `playTracks(..., { shuffle: false })` (podcast) y `{ shuffle: true }` (estudio) no cambian `shuffle`.
  - [ ] `toggleShuffle` cambia `shuffle`, llama a `savePref('shuffle', …)` también en modo radio e idle, y reordena lo pendiente sin cortar la canción actual.
  - [ ] Con `fixedOrder` el interruptor cambia la preferencia pero no reordena.
  - [ ] «Anterior» en aleatorio vuelve a la canción que sonó justo antes.
  - [ ] Valor inicial: `loadValue('shuffle')` si existe; si no, el `shuffle` guardado en `player-v2`.
- Verificación: `npx vitest run test/playerShuffle.test.ts test/shufflePreference.test.ts --root apps/web` y `npm run check`.

### T5 · Enviar desde menús y selección (canciones y playlists) · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/parcel.ts`, `apps/web/src/stores/ui.ts`,
  `apps/web/src/components/TrackMenu.tsx`, `apps/web/src/components/PlaylistMenu.tsx`,
  `apps/web/src/components/PlaylistSelectionBar.tsx` (nuevo), `apps/web/src/playlistSelect.css` (nuevo),
  `apps/web/src/views/PlaylistsView.tsx`, `apps/web/src/components/playlists/FriendsRow.tsx`,
  `apps/web/src/components/playlists/SharePickSheet.tsx` (borrar si queda sin uso),
  `apps/web/src/views/DownloadView.tsx`, `apps/web/src/components/send/SendHowSheet.tsx` (borrar),
  `apps/web/src/App.tsx`, `apps/web/src/i18n/parcel.ts`, `apps/web/src/i18n/share.ts`,
  `apps/web/src/help/articles/music.ts`, `apps/web/test/parcelStore.test.ts`, `apps/web/test/uiSelection.test.ts` (nuevo).
- Leer como contexto: `apps/web/src/components/SelectionBar.tsx` (copiar estructura y clases
  `selection-bar`/`selection-actions`), `apps/web/src/components/TrackList.tsx` (pulsación larga, `LONG_PRESS_MS`),
  `apps/web/src/components/PlaylistDnd.tsx`, `apps/web/src/components/SharePlaylistSheet.tsx`.
- Qué hacer:
  - `parcel.ts`: `sendPlaylists` según el contrato (TDD en `parcelStore.test.ts`).
  - `ui.ts`: estado y acciones de `playlistSelection` según el contrato (TDD en `uiSelection.test.ts`).
  - `TrackMenu`: opción «Enviar a otro móvil» (`Send`) → `useParcel.getState().sendTracks([track.id])`,
    solo si `hubAvailable()` y la canción no es podcast.
  - `PlaylistMenu`: opciones «Enviar a otro móvil» → `sendPlaylists([playlist.id])` y «Compartir»
    (`Share2`) → abre `SharePlaylistSheet` (ambas solo si `hubAvailable()`).
  - `PlaylistsView`/`PlaylistRow`: pulsación larga (500 ms, cancelada si el dedo se mueve > 8 px; el
    arrastre va por el asa y no choca) → `startPlaylistSelection(id)`; botón «Seleccionar»
    (`select.start`, `CircleCheck`) encima de la lista; en modo selección tocar una fila marca/desmarca
    (círculo con check ámbar, `aria-pressed`) en vez de navegar. «Me gusta» y carpetas no se seleccionan.
  - `PlaylistSelectionBar` (montada en `App.tsx` junto a `SelectionBar`): contador «N playlists»,
    Cancelar, «Todas», y acciones Enviar (`sendPlaylists`, solo con Hub), Añadir a la cola (canciones de
    todas, en orden, sin repetir) y Descargar (`useOffline.pin` de las que no están en el dispositivo).
    Al terminar una acción, `endPlaylistSelection()`.
  - `App.tsx`: al cambiar de pantalla termina también `playlistSelection`; quitar la excepción
    `?select=1` (ya nadie navega ahí) y actualizar el comentario.
  - `FriendsRow`: quitar «Compartir» (queda Recibir, Jam, Grupos); borrar `SharePickSheet` si no se usa.
  - `DownloadView`: quitar el botón «Enviar» y `SendHowSheet` (borrar archivo y sus claves
    `parcel.sendHow*`, `parcel.sendPick`, `parcel.sendGoPlaylists` en los 3 idiomas). Se queda «Recibir»
    con el efecto de `pendingCode`. Cambiar el id del consejo a `dl-send-2` y su texto `parcel.tipSend`:
    «Para enviar, abre el menú ⋮ de una canción o playlist, o mantén pulsado para elegir varias.»
  - Claves nuevas en `share.ts` (es/en/eu, con `.one`): `plsel.count`, `plsel.count.one`, `plsel.queue`,
    `plsel.download`.
  - Artículo `send-with-code` (`music.ts`, 3 idiomas): nuevo «Enviar desde el móvil» (menú ⋮ de canción
    o playlist, selección con pulsación larga, la cola) y «Recibir» sigue en **Descargar → Recibir**.
    Revisar también el texto «Playlists → Con amigos → Compartir» si aparece.
- TDD: sí en `sendPlaylists` y en el estado de selección de `ui.ts`; no en los componentes.
- Criterios de aceptación:
  - [ ] Tests: `sendPlaylists` con 1 playlist llama a `createParcel` con su nombre y `unavailable`; con 2 une canciones sin repetir; con 0 devuelve `false` sin llamar al Hub.
  - [ ] Tests: empezar selección de playlists cierra la de canciones y al revés; `toggle` y `selectAll` funcionan.
  - [ ] No queda ningún botón «Enviar» en Descargar ni en Playlists; «Recibir» sigue en Descargar y los enlaces `#send=` siguen abriéndolo.
  - [ ] Menú ⋮ de canción y de playlist tienen «Enviar a otro móvil»; la barra de selección de canciones (ya lo tenía) y la nueva de playlists también.
  - [ ] Paridad i18n y enlaces de ayuda en verde; sin código ni claves muertas.
- Verificación: `npx vitest run test/parcelStore.test.ts test/uiSelection.test.ts --root apps/web` y `npm run check`; manual en `npm run dev`.

### T6 · Interruptor Aleatorio y botón «Ordenar» compacto · Grupo C (tras T4) · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/ShuffleToggle.tsx` (nuevo),
  `apps/web/src/components/SortMenu.tsx` (nuevo), `apps/web/src/collection.css` (nuevo),
  `apps/web/src/views/LibraryView.tsx`, `apps/web/src/views/PlaylistView.tsx`,
  `apps/web/src/components/player/Controls.tsx`, `apps/web/src/styles.css` (solo quitar reglas
  sin uso como `.collection-actions .select.compact`), `apps/web/src/i18n/en.ts`, `es.ts`, `eu.ts`,
  `apps/web/src/help/articles/listen.ts`.
- Leer como contexto: «Cómo funciona Aleatorio» y contratos de UI de este plan; `apps/web/src/stores/player.ts`
  (tras T4); `apps/web/src/components/Sheet.tsx`.
- Qué hacer:
  - `ShuffleToggle` según contrato (icono `Shuffle`, ámbar con `on`). Usarlo en `LibraryView` y
    `PlaylistView` justo a la derecha del Play, y en `Controls.tsx` en lugar del botón actual (mismo
    icono y estado). Quitar los botones «Aleatorio» actuales y los selectores `shuffling`; el Play
    llama a `playTracks(ids, null, { context })` sin `shuffle` (usa la preferencia).
  - `SortMenu`: botón `btn small` con `ArrowUpDown` + texto corto del criterio (elipsis, `max-width`),
    `aria-haspopup="menu"`, `aria-expanded`, `aria-label` «Ordenar: {criterio}». Menú desplegable
    alineado a la derecha con opciones `role="menuitemradio"` y check en la activa; se cierra al elegir,
    con Escape o tocando fuera. En `LibraryView` sustituye al `<select>`, guardando en `library-sort` igual
    que hoy. Estilos en `collection.css` (importado desde `SortMenu.tsx`).
  - Claves nuevas (es/en/eu): `library.sort` («Ordenar»), `library.sortLabel` («Ordenar: {criterion}»),
    `library.sortShortRecent` («Recientes»), `library.sortShortTitle` («Título»),
    `library.sortShortArtist` («Artista»). Quitar `common.shuffle` si queda sin uso.
  - `LibraryView`: borrar el efecto `?select=1` (T5 retiró `SendHowSheet`, que era quien lo usaba).
  - Artículo de `listen.ts` con el párrafo **Aleatorio** (3 idiomas): es un interruptor junto al Play
    (y el mismo en el reproductor), ámbar = activo, se recuerda, y qué hace Play con ON/OFF. Mencionar
    el botón **Ordenar** si el artículo habla de la biblioteca.
- TDD: no (interfaz; la lógica la cubre T4).
- Criterios de aceptación:
  - [ ] Biblioteca y Playlist: Play + interruptor; el reproductor muestra el mismo estado; cambiarlo en un sitio se ve en los demás y sobrevive a recargar.
  - [ ] Con ON, Play empieza por una canción al azar; con OFF, por la primera.
  - [ ] «Ordenar» muestra el criterio actual y no se corta a 320 px en eu/es/en; se usa con teclado.
  - [ ] Paridad i18n y enlaces de ayuda en verde.
- Verificación: `npm run check`; manual en `npm run dev` (320 px, euskera, recargar la página).

### T7 · Documentación · Grupo D (tras todas) · Estado: HECHA

- Archivos (exclusivos): `docs/ESTADO.md`, `docs/v2/architecture.md`, `docs/plan/PLAN.md` (solo estados).
- Leer como contexto: este plan y el resumen de cada tarea.
- Qué hacer: en `ESTADO.md` añadir «v0.9.2 (sin publicar)» en Hecho con lo entregado; quitar de
  «Problemas conocidos» y de «En curso» el bug de `reloadCurrent`, el refactor de `player.ts`/`downloads.ts`
  y la falta de tests de `D1GroupRepo` (anotar los tamaños finales); añadir decisiones nuevas (Aleatorio
  como preferencia global separada del orden de la lista; selección de playlists; Grupos en Ajustes).
  En `docs/v2/architecture.md` no hay fase nueva: solo actualizar la tabla si alguna fila cambia de
  estado. Marcar las tareas como HECHO y el plan como COMPLETADO.
- TDD: no.
- Criterios de aceptación:
  - [ ] `ESTADO.md` refleja v0.9.2 y no lista problemas ya resueltos.
  - [ ] `npm run check` (incluye Prettier sobre los `.md`) en verde.
- Verificación: `npm run check`.

## Riesgos / dudas abiertas

1. **«Enviar» en Playlists:** en esa pantalla no hay un botón «Enviar»; lo que hay es «Compartir» en la
   fila «Con amigos» (enlace a una playlist compartida, distinto de enviar canciones con código). ¿Qué hacemos?
   - **Quitar «Compartir» de la fila y ponerlo en el menú ⋮ de cada playlist junto a «Enviar» (Recomendada)**:
     la fila queda en Recibir, Jam y Grupos; todo lo de una playlist está en su menú. Inconveniente: quien
     ya conocía el botón tendrá que buscarlo en el ⋮.
   - Dejar la fila como está y solo añadir «Enviar» al menú ⋮: cero cambios para quien ya lo usa, pero
     «Compartir» y «Enviar» quedan en sitios distintos y se confunden.
   - Quitar la fila «Con amigos» entera (Jam y Grupos solo desde el menú lateral): más limpio, pero esconde
     Jam y Grupos en el móvil.
     Recomiendo la primera porque cumple «quitar el botón de Playlists» y deja cada acción en su sitio.
     (El plan T5 ya está escrito así.)
2. **Enviar varias playlists a la vez:** un paquete solo puede llevar un nombre de playlist.
   - **Un solo código con todas las canciones sueltas (Recomendada)**: un único QR que escanear; el otro
     móvil recibe canciones, no playlists.
   - Un código por playlist, uno detrás de otro: llegan como playlists con su nombre, pero hay que escanear
     varios QR.
     Recomiendo la primera porque es lo más sencillo para gente no técnica.
3. **Acciones de la barra de selección de playlists:**
   - **Enviar, Añadir a la cola y Descargar (Recomendada)**: útil y parecido a la barra de canciones.
   - Solo Enviar: menos trabajo, pero la selección se queda corta.
   - Además Borrar playlists: práctico, pero borrar en lote es peligroso para usuarios no técnicos.
     Recomiendo la primera: es coherente con la barra de canciones sin riesgos.
4. **Valor inicial del interruptor Aleatorio para quien ya usa la app:**
   - **El último estado que tenía (Recomendada)**: nadie nota un cambio raro al actualizar.
   - Apagado para todos: comportamiento predecible, pero a quien lo tenía encendido le cambia solo.
     Recomiendo la primera para no sorprender.

- **Riesgo técnico (T2):** `node:sqlite` funciona sin opciones desde Node 22.13. CI usa la última 22
  (`.nvmrc`); si el Node local es más antiguo, el programador debe avisar (no saltarse los tests) y valorar
  subir `engines` a `>=22.13.0`.
- **Riesgo (T1):** refactor grande del reproductor; por eso va solo y primero, con los tests de aleatorio
  como red. Tras T1 y T4 conviene una prueba manual de radio, cola, vigilante y podcasts.

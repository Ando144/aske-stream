# PLAN: Fase 5.5 — Ordenar y fijar playlists/carpetas, botones de cabecera y batería

Fecha: 2026-11-19 · Estado: COMPLETADO

## Objetivo

Arreglar cuatro problemas encontrados en uso real (v0.5.4): las playlists no se pueden ordenar;
poder fijar playlists y carpetas arriba del todo; quitar el texto de los botones de la cabecera de
Playlists (nunca se ve en el móvil); y reducir el consumo de batería en Android.

## Encaje en las fases (docs/v2/architecture.md)

- Nueva fila **5.5 "Playlist order & pin, header buttons, battery"**, entre 5.4 (✅) y 6. Son
  arreglos de uso real, como 5.1. **Es la siguiente fase que toca** (antes de la 6, Cloudflare guiado).
- Los cuatro problemas van en la 5.5. Si Andoni prefiere salir antes con la batería, se puede
  publicar T2 + T3 solos como v0.5.5 y el resto como v0.5.6 (ver dudas).

## Decisiones de arquitectura

- Orden de playlists con `Playlist.position`, igual que `Folder.position` — una sola forma de ordenar, ya probada en 5.4.
- El orden de playlists es **por contenedor** (sueltas = `folderId null`, o dentro de cada carpeta) — mover a otra carpeta la deja al final.
- Fijar = campo `pinnedAt` (fecha) en `Playlist` y `Folder`; null = no fijada — se sincroniza como cualquier cambio (last-writer-wins por `updatedAt`).
- Fijadas arriba, la última fijada primero (como Spotify); entre fijadas no se arrastra — evita mezclar dos órdenes.
- Una playlist fijada dentro de una carpeta queda arriba **de esa carpeta** (no sale a la lista principal).
- Las filas fijadas muestran un icono de chincheta en lugar del asa de arrastre.
- Toda la regla de orden vive en `@aske/shared` (pura y con tests) y la usan API, Drive, dispositivo y UI.
- Cabecera de Playlists: solo iconos (con `title` y `aria-label`); se borra la versión con texto y su container query.
- Batería: sin `WIFI_MODE_FULL_LOW_LATENCY`, Wi-Fi lock solo si el audio viene de internet, liberación con retardo en Java (no depende de timers JS que Android congela) y nada de sondeos de red con la app oculta y sin sonar.

## Contratos (interfaces compartidas)

### Tipos (`packages/shared/src/index.ts`)

```ts
interface Playlist {
  /* …campos actuales… */
  /** Order inside its container (top level or its folder). null/undefined = not ordered yet. */
  position?: number | null;
  /** When it was pinned; null/undefined = not pinned. */
  pinnedAt?: EpochMs | null;
}
interface Folder {
  /* …campos actuales… */ pinnedAt?: EpochMs | null;
}
```

### Funciones puras (`packages/shared/src/folders.ts` y nuevo `packages/shared/src/playlistOrder.ts`)

```ts
// folders.ts (cambia sortFolders): pinned first (pinnedAt desc), then the current rule.
export function sortFolders(folders: readonly Folder[]): Folder[];
// playlistOrder.ts
/** Pinned first (pinnedAt desc); then unordered (position null) by createdAt asc; then position asc (tie: createdAt). New array. */
export function sortPlaylists(playlists: readonly Playlist[]): Playlist[];
/** Max position + 1 among playlists whose (folderId ?? null) === folderId; 0 if none. */
export function nextPlaylistPosition(
  playlists: readonly Playlist[],
  folderId: string | null,
): number;
export interface PlaylistReorder {
  playlists: Playlist[];
  changed: Playlist[];
}
/** Only touches playlists of that container: orderedIds first, the rest in sortPlaylists order;
 *  position = index, changed ones get updatedAt = now. `playlists` returned = ALL input playlists
 *  (other containers untouched), in sortPlaylists order. Unknown/repeated/other-container ids ignored. */
export function reorderPlaylists(
  playlists: readonly Playlist[],
  folderId: string | null,
  orderedIds: readonly string[],
  now: EpochMs,
): PlaylistReorder;
```

Exportar todo desde `packages/shared/src/index.ts`.

### Base de datos (D1) — `apps/api/migrations/0006_playlist_order_pin.sql`

```sql
ALTER TABLE playlists ADD COLUMN position INTEGER;
ALTER TABLE playlists ADD COLUMN pinned_at INTEGER;
ALTER TABLE folders ADD COLUMN pinned_at INTEGER;
```

### API (Worker)

- `PATCH /api/playlists/:id` acepta además `pinned?: boolean` (true → `pinned_at = now`, false → null).
  Si cambia `folderId`, `position = nextPlaylistPosition(destino)`. Devuelve `Playlist`.
- `POST /api/playlists`: la nueva va al final de las sueltas (`position = max + 1`).
- `PUT /api/playlists/order` body `{ folderId: string | null, ids: string[] }` (zod, `ids` máx. 1000)
  → `200 { playlists: Playlist[] }` (todas, en orden `sortPlaylists`). Declarar antes de `/:id`.
- `PATCH /api/folders/:id` acepta además `pinned?: boolean`. Devuelve `Folder`.
- `GET /api/library` devuelve `position` y `pinnedAt` en playlists y `pinnedAt` en carpetas.
- Worker antiguo (sin estas rutas): el cliente usa `orOutdated(...)` como ya hace con carpetas.

### `LibraryHome` (`apps/web/src/storage/types.ts`) — métodos nuevos

```ts
setPlaylistPinned(id: string, pinned: boolean): Promise<Playlist>;
setFolderPinned(id: string, pinned: boolean): Promise<Folder>;
/** Saves the order of one container. Returns ALL playlists in sortPlaylists order. */
orderPlaylists(folderId: string | null, ids: string[]): Promise<Playlist[]>;
```

`createPlaylist` y `movePlaylist` asignan `position` al final del contenedor en los tres almacenamientos.

### Cliente API (`apps/web/src/api/client.ts`)

`updatePlaylist(id, { …, pinned?: boolean })`, `updateFolder(id, { …, pinned?: boolean })`,
`orderPlaylists(folderId: string | null, ids: string[]): Promise<{ playlists: Playlist[] }>`.

### Store (`apps/web/src/stores/library.ts`) — acciones nuevas (optimistas, revierten si falla)

```ts
setPlaylistPinned(id: string, pinned: boolean): Promise<void>;
setFolderPinned(id: string, pinned: boolean): Promise<void>;
orderPlaylists(folderId: string | null, ids: string[]): Promise<void>;
```

### Drag & drop (`apps/web/src/storage/playlistOps.ts`)

```ts
export type DropResult =
  | { kind: 'move'; playlistId: string; folderId: string | null }
  | { kind: 'reorderFolders'; folderIds: string[] }
  | { kind: 'reorderPlaylists'; folderId: string | null; playlistIds: string[] }
  | null;
```

Soltar `pl:A` sobre `pl:B` del mismo contenedor (ninguna fijada) → `reorderPlaylists`. Sobre una
carpeta → `move` (como ahora). Ids fijados nunca entran en el reordenado.

### Puente nativo (`apps/web/src/native/askeNative.ts`)

```ts
/** streaming = the audio comes from the internet (needs the Wi-Fi lock). */
keepAwake(options: { playing: boolean; streaming?: boolean }): Promise<void>;
```

### i18n (es, en, eu) — claves nuevas

`pin.pin` ("Fijar arriba"), `pin.unpin` ("Quitar de arriba"), `pin.pinned` ("Fijada arriba", para
`aria-label` del icono), `toast.pinFailed` (error en lenguaje sencillo). Textos en/eu equivalentes.

## Tareas

### T1 · Reglas de orden y fijado en @aske/shared · Grupo A · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/index.ts`, `packages/shared/src/folders.ts`,
  `packages/shared/src/playlistOrder.ts` (nuevo), `packages/shared/test/folders.test.ts`,
  `packages/shared/test/playlistOrder.test.ts` (nuevo)
- Leer como contexto: este plan (Contratos: Tipos y Funciones puras)
- Qué hacer: añadir `position` y `pinnedAt` a `Playlist`, `pinnedAt` a `Folder`; cambiar
  `sortFolders` para poner primero las fijadas (pinnedAt desc); crear `sortPlaylists`,
  `nextPlaylistPosition`, `reorderPlaylists` según contrato; exportarlas.
- TDD: sí
- Criterios de aceptación:
  - [ ] Carpetas y playlists fijadas salen primero; la fijada más reciente, arriba.
  - [ ] Sin `position`: van primero por fecha de creación (igual que hoy); con `position`, después.
  - [ ] `reorderPlaylists` solo cambia el contenedor indicado y solo marca `changed` las que se movieron.
  - [ ] `nextPlaylistPosition` cuenta solo el contenedor pedido.
  - [ ] Tests existentes de `sortFolders`/`reorderFolders` siguen pasando.
- Verificación: `npx vitest run --root packages/shared` y `npm run typecheck -w @aske/shared` (o `npm run check`)

### T2 · Batería: wake/Wi-Fi lock en Android · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/AskeNativePlugin.java`
- Leer como contexto: `apps/web/src/stores/player.ts` (líneas 660-682)
- Qué hacer:
  - `keepAwake` lee `streaming` (por defecto `true` por compatibilidad). Wi-Fi lock solo si
    `playing && streaming`; si `playing && !streaming`, suelta el Wi-Fi lock y mantiene el wake lock.
  - Usar `WifiManager.WIFI_MODE_FULL_HIGH_PERF` (quitar `FULL_LOW_LATENCY`, pensado para juegos).
  - `playing:false` → soltar con un `Handler(Looper.getMainLooper()).postDelayed` de 10 s
    (cancelable si llega `playing:true` antes). Así no depende de timers JS congelados.
  - Red de seguridad del wake lock: 30 min en vez de 6 h, renovada en cada `keepAwake(playing:true)`.
  - Mantener `handleOnDestroy` liberando todo y cancelando el Handler.
- TDD: no (código nativo; no hay tests Java en el repo)
- Criterios de aceptación:
  - [ ] No queda ninguna referencia a `WIFI_MODE_FULL_LOW_LATENCY`.
  - [ ] Pausar y esperar 15 s: `adb shell dumpsys power` no lista `AskeStream:playback` y
        `adb shell dumpsys wifi` no lista `AskeStream:streaming`.
  - [ ] Con música del dispositivo sonando no hay Wi-Fi lock; la música sigue con pantalla apagada.
- Verificación: `npm run android:apk` (si hay ANDROID_HOME) y prueba manual en el Pixel con los
  comandos `adb` de arriba. Si no se puede compilar en local, lo compila el CI.

### T3 · Batería: menos trabajo en segundo plano (web) · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/player.ts`, `apps/web/src/App.tsx`,
  `apps/web/src/native/askeNative.ts`, `apps/web/test/fake-native/askeNative.ts`,
  `apps/web/src/lib/power.ts` (nuevo), `apps/web/test/power.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/stores/offline.ts` (función `run`), `apps/web/src/stores/send.ts`
- Qué hacer:
  - `lib/power.ts`: `isStreamingSource(src: string): boolean` (false para `blob:`, `file:`,
    `capacitor://`, `http(s)://localhost/_capacitor_file_`; true para http(s) remoto) y
    `mayDoBackgroundWork(s: { hidden: boolean; playing: boolean }): boolean` (= `!hidden || playing`).
  - `player.ts`: pasar `streaming: isStreamingSource(audio.currentSrc)` a `AskeNative.keepAwake`;
    volver a llamarlo si cambia de local a remoto entre canciones aunque ya esté `awake`. Quitar el
    `setTimeout` de 10 s del lado JS y mandar `playing:false` directamente (el retardo lo hace Java, T2).
  - `App.tsx`: los `setInterval` de rotación offline (30 min) y `checkInbox` (5 min) no hacen nada si
    `!mayDoBackgroundWork(...)`; al volver a primer plano ya existe el `onVisible`.
  - `player.ts`: `scheduleRun(5000)` al cargar cada canción solo si `mayDoBackgroundWork` y como
    mucho una vez cada 10 min (evita descargar en cada cambio de canción).
  - Actualizar firma en `askeNative.ts` y el fake.
- TDD: sí (para `lib/power.ts`)
- Criterios de aceptación:
  - [ ] Tests de `isStreamingSource` y `mayDoBackgroundWork` cubren los casos anteriores.
  - [ ] No hay `setTimeout` de liberación en `player.ts`.
  - [ ] Con la app oculta y en pausa, los intervalos no lanzan peticiones de red.
- Verificación: `npx vitest run test/power.test.ts --root apps/web`, `npm run check`,
  `npx vite build --mode fakenative -w @aske/web`

### T4 · Cabecera de Playlists solo con iconos · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/PlaylistsView.tsx` (solo la cabecera), `apps/web/src/styles.css`
- Qué hacer: quitar los `<span className="btn-label">` de "Nueva carpeta" y "Nueva playlist" (dejar
  icono + `title` + `aria-label`); borrar `.btn-label` y el bloque `@container page-header (max-width: 520px)`
  y darles el estilo de botón cuadrado de 32 px siempre (`.header-actions .btn.small`). Comprobar con
  Grep que `btn-label` no se usa en ningún otro sitio. No tocar las claves i18n (se siguen usando en `title`).
- TDD: no
- Criterios de aceptación:
  - [ ] En móvil y escritorio se ven dos botones cuadrados con icono; al pasar el ratón sale el texto.
  - [ ] No queda `btn-label` en el código.
- Verificación: `npm run check` y revisión visual con `npm run dev` a 360 px y 1280 px en es/en/eu.

### T5 · API: orden y fijado en Cloudflare · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/api/migrations/0006_playlist_order_pin.sql` (nuevo),
  `apps/api/src/lib/db.ts`, `apps/api/src/routes/playlists.ts`, `apps/api/src/routes/folders.ts`,
  `apps/api/src/routes/library.ts`, `apps/api/test/unit.test.ts`
- Leer como contexto: `apps/api/migrations/0005_folder_order.sql`, `apps/api/src/routes/folders.ts`
  (ruta `PUT /order`, es el modelo a copiar), Contratos de este plan
- Qué hacer: migración; mapear `position`/`pinned_at` en `PlaylistRow`/`toPlaylist` y `pinned_at` en
  `FolderRow`/`toFolder`; rutas según "API"; ordenar con `sortPlaylists`/`sortFolders` en
  `GET /api/library`; validar con zod; consultas parametrizadas y escrituras con `db.batch`.
- TDD: sí
- Criterios de aceptación:
  - [ ] `PUT /api/playlists/order` reordena solo el contenedor y responde todas las playlists ordenadas.
  - [ ] `PATCH … { pinned: true|false }` pone/quita `pinnedAt` en playlists y carpetas.
  - [ ] Mover una playlist a otra carpeta la deja al final; crearla la deja al final.
  - [ ] Body inválido → 400; id inexistente → 404.
- Verificación: `npx vitest run --root apps/api`, `npm run db:migrate:local`, `npm run test:e2e`

### T6 · Almacenamientos web: dispositivo, Cloudflare y Drive · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/storage/types.ts`, `apps/web/src/storage/homes.ts`,
  `apps/web/src/storage/drive/home.ts`, `apps/web/src/api/client.ts`, `apps/web/test/apiClient.test.ts`
- Leer como contexto: `apps/web/src/storage/drive/doc.ts`, implementación actual de `reorderFolders`
  en `homes.ts` y `drive/home.ts` (copiar el patrón), Contratos (LibraryHome y Cliente API)
- Qué hacer: añadir los 3 métodos de `LibraryHome` en dispositivo (IndexedDB, en una transacción),
  Cloudflare (vía cliente API con `orOutdated`) y Drive (mutando el doc con `updatedAt = now`);
  `createPlaylist`/`movePlaylist` ponen `position` al final del contenedor; devolver playlists con
  `sortPlaylists` donde hoy se devuelven sin orden. Si `copy/endpoints.ts` deja de compilar por la
  interfaz, avisar en el informe (no tocarlo: no implementa `LibraryHome`, verificar).
- TDD: sí (cliente API en `apiClient.test.ts`)
- Criterios de aceptación:
  - [ ] Los tres almacenamientos guardan y devuelven `position` y `pinnedAt`.
  - [ ] Worker antiguo → aviso `cloudflareOutdated`, sin romper la app.
  - [ ] `npm run typecheck` pasa (si falla solo por `stores/library.ts`, es esperado hasta T7).
- Verificación: `npx vitest run test/apiClient.test.ts --root apps/web`, `npm run check`

### T7 · Store, arrastre y pantalla: ordenar y fijar · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/library.ts`, `apps/web/src/storage/playlistOps.ts`,
  `apps/web/test/playlistOps.test.ts`, `apps/web/src/components/PlaylistDnd.tsx`,
  `apps/web/src/views/PlaylistsView.tsx`, `apps/web/src/views/FolderView.tsx`,
  `apps/web/src/components/PlaylistMenu.tsx`, `apps/web/src/components/FolderMenu.tsx`,
  `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`,
  `apps/web/src/help/articles/listen.ts`, `docs/v2/architecture.md`, `docs/ESTADO.md`
- Leer como contexto: Contratos (Store, Drag & drop, i18n), `apps/web/src/stores/library.ts`
  (`reorderFolders`, patrón optimista)
- Qué hacer:
  - Store: 3 acciones optimistas que revierten y muestran `toast.pinFailed` si fallan.
  - `groupPlaylists` usa `sortPlaylists` (en vez de `createdAt`) para sueltas y por carpeta.
  - `dropAction` añade `reorderPlaylists`; `PlaylistDnd` hace las playlists ordenables
    (`useSortable`, ids `pl:<id>`) sin perder "soltar en carpeta"; las fijadas no tienen asa.
  - Menús "…": opción Fijar arriba / Quitar de arriba (icono `Pin`/`PinOff` de lucide).
  - Filas fijadas: icono chincheta en lugar del asa. `FolderView` también ordena y fija.
  - i18n en es/en/eu; párrafo en el artículo de ayuda de playlists (cómo ordenar y fijar).
  - Docs: fila 5.5 en la tabla de fases y entrada en ESTADO.md.
- TDD: sí (`playlistOps.test.ts`)
- Criterios de aceptación:
  - [ ] Arrastrar una playlist sobre otra del mismo sitio cambia el orden y se mantiene al recargar.
  - [ ] Arrastrar una playlist sobre una carpeta la mete dentro (como antes).
  - [ ] Fijar una carpeta o playlist la sube arriba del todo (debajo de "Me gusta") y se mantiene.
  - [ ] Test de paridad i18n y test de enlaces de ayuda pasan.
- Verificación: `npx vitest run test/playlistOps.test.ts --root apps/web`, `npm run check`,
  `npm run test:e2e`, prueba manual en dispositivo, Drive y Cloudflare.

## Riesgos / dudas abiertas

- **Batería: el % del Pixel puede no ser el que parece.** En Ajustes → Batería → Uso, el % de cada
  app es su parte del gasto de ese rato, no lo que bajó la batería. Hay que saber cuánto bajó en
  total de 12 a 14 y si sonaba música. T2-T3 arreglan lo más probable (Wi-Fi lock en modo "juegos"
  y locks que se quedan cogidos), pero sin medir con `adb` no hay certeza.
- La copia entre almacenamientos (`storage/copy/plan.ts`) aún no copia orden ni fijados; queda como
  problema conocido para una fase posterior.
- Móviles con v0.5.4 que sincronicen Drive verán el orden antiguo y podrían pisar `pinnedAt` al
  editar una playlist (pasó lo mismo con carpetas en 5.4). Avisar a los amigos de que actualicen.
- En producción: `db:migrate:remote` **antes** de `deploy` (al revés da 500).
- Las 4 dudas para Andoni van en el resumen al orquestador.

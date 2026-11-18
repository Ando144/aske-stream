# PLAN: Fase 5.3 · Carpetas, portadas y juntar playlists (+ mejora del temporizador)

Fecha: 2026-11-18 · Estado: COMPLETADO

## Objetivo

1. **Carpetas** de un solo nivel que solo contienen playlists (sin canciones sueltas ni subcarpetas,
   sin foto: icono de carpeta en ámbar).
2. **Portadas** de playlist: mosaico automático por defecto (ya existe) o foto propia reducida a
   300 px, guardada en el almacenamiento de la biblioteca (dispositivo, Drive o Cloudflare) y copiada
   por la copia entre almacenamientos (fase 5.2). Cloudflare respeta el tope de 10 GB.
3. **Juntar** dos playlists: una se queda con todas las canciones sin repetidas; casilla «borrar la
   otra» marcada por defecto; tope de 1000 canciones con error en lenguaje sencillo.
4. Mover a carpeta y juntar desde el menú **«…»** y también **arrastrando** (dedo y ratón).
5. **Temporizador**: botón con borde «Quitar temporizador» junto a la cuenta atrás; el enlace ámbar
   solo sirve para cambiar el tiempo.

El trabajo va en **dos fases**: Fase 1 = datos y lógica (grupos A, B, C); Fase 2 = interfaz,
ayuda y documentos (grupo D). La Fase 2 no empieza hasta que la Fase 1 pase `npm run check`.

## Decisiones de arquitectura

- Una carpeta es una entidad propia (`Folder`) y la playlist guarda `folderId` — un solo nivel por
  diseño: las carpetas no tienen `folderId`.
- Borrar una carpeta **no borra** sus playlists: vuelven a la lista principal — más seguro para gente
  no técnica.
- «Juntar» se compone en el store con `addToPlaylist` + `deletePlaylist` (ya existentes) — no hace
  falta endpoint nuevo; la lógica pura (`planMerge`) calcula el resultado y el tope.
- Se queda la playlist **destino**: en el menú, la que abrió el menú; al arrastrar, aquella sobre la
  que se suelta. El diálogo tiene «Cambiar cuál se queda». El destino conserva su nombre, carpeta y
  portada.
- Portada propia: `squareJpeg(file, 300)` (ya existe en `lib/cover.ts`) en el cliente; se marca con
  `coverAt` (fecha) que sirve también para romper la caché del navegador (`?v=coverAt`).
- Dispositivo: IndexedDB pasa a versión 3 con almacén `folders`; las portadas en OPFS, carpeta
  `playlist-covers`, nombre = id de la playlist.
- Drive: `library.json` gana `folders` (se fusiona igual que las playlists, con `updatedAt` y marcas
  de borrado); la portada es un archivo en `covers/` y su id va en `playlist.coverFileId`.
- Cloudflare: **migración D1 `0004_folders.sql`** (tabla `folders`, columnas `folder_id` y
  `cover_at` en `playlists`), portada en R2 `playlists/{id}/cover.jpg`, contada en el tope de 10 GB
  (80 KB estimados por portada, como las de canciones) y 507 `storage_full` si no cabe.
- Sin claves foráneas nuevas en D1 (ALTER TABLE con REFERENCES da problemas en SQLite): la ruta que
  borra una carpeta pone `folder_id = NULL` en la misma `batch`.
- Arrastrar con `@dnd-kit/core` (ya instalado): solo el asa ⠿ inicia el arrastre (la lista sigue
  haciendo scroll con el dedo), con TouchSensor + PointerSensor + KeyboardSensor. El menú «…» es la
  vía fiable.
- Worker de Cloudflare antiguo (sin 0004): solo aviso sencillo `toast.cloudflareOutdated` en
  es/en/eu (T4 lanza `cloudflare_outdated`, T7 lo traduce); sin artículo con comandos y sin ocultar
  funciones — decisión de Andoni; la actualización guiada llega con la F6.
- Copia: carpetas emparejadas por nombre (sin distinguir mayúsculas); nunca cambia la carpeta ni la
  portada de una playlist que ya tenga una en el destino (regla 5.2: no pisar nada).

## Contratos (interfaces compartidas)

### `packages/shared/src/index.ts`

```ts
export interface Folder {
  id: string;
  name: string;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface Playlist {
  // ...campos actuales...
  /** Folder that holds it; null/undefined = top level. */
  folderId?: string | null;
  /** When the custom cover was set; null/undefined = automatic mosaic. */
  coverAt?: EpochMs | null;
  /** Google Drive only: file id of the custom cover. */
  coverFileId?: string | null;
}

export interface Library {
  version: number;
  tracks: Track[];
  playlists: Playlist[];
  folders: Folder[];
}

LIMITS.playlistCoverPx = 300; // nuevo campo dentro de LIMITS
```

### `apps/web/src/storage/types.ts`

```ts
export interface LibrarySnapshot {
  tracks: LocalTrack[];
  playlists: Playlist[];
  /** Optional: copies cached by older versions have none. */
  folders?: Folder[];
  etag: string;
}

// Métodos nuevos en LibraryHome (los tres homes los implementan):
createFolder(name: string): Promise<Folder>;
renameFolder(id: string, name: string): Promise<Folder>;
/** Its playlists go back to the top level; no playlist is deleted. */
deleteFolder(id: string): Promise<void>;
/** folderId null = top level. Throws Error('folder_not_found') if the folder does not exist. */
movePlaylist(id: string, folderId: string | null): Promise<Playlist>;
/** jpeg: square JPEG already resized (≤ 300 px). null = back to the automatic mosaic. */
setPlaylistCover(id: string, jpeg: Blob | null): Promise<Playlist>;
// deletePlaylist(id) debe borrar también la portada propia, si la hay.
```

### `apps/web/src/storage/playlistOps.ts` (lógica pura, nueva)

```ts
export type MergePlan =
  | { ok: true; trackIds: string[]; added: number }
  | { ok: false; reason: 'same' | 'too_many'; total: number; max: number };
/** Target order first, then the source songs not already in it (no repeats). */
export function planMerge(target: Playlist, source: Playlist, max?: number): MergePlan;

export interface PlaylistGroups {
  /** Sorted by name (localeCompare, sensitivity 'base'). */
  folders: { folder: Folder; playlists: Playlist[] }[];
  /** Playlists without a folder or whose folder no longer exists. */
  loose: Playlist[];
}
export function groupPlaylists(playlists: Playlist[], folders: Folder[]): PlaylistGroups;
export function applyMove(playlists: Playlist[], id: string, folderId: string | null): Playlist[];
export function applyFolderDelete(playlists: Playlist[], folderId: string): Playlist[];

/** Drag & drop ids: 'pl:<id>', 'folder:<id>', 'root'. */
export type DropResult =
  | { kind: 'move'; playlistId: string; folderId: string | null }
  | { kind: 'merge'; targetId: string; sourceId: string }
  | null;
export function dropAction(
  activeId: string,
  overId: string | null,
  playlists: Playlist[],
): DropResult;
```

`dropAction`: arrastrar `pl:A` sobre `folder:F` → move (null si A ya está en F); sobre `pl:B`
(B ≠ A) → merge {target: B, source: A}; sobre `root` → move a null (null si ya está fuera);
cualquier otro caso → null.

### API Cloudflare (`apps/api`)

| Método y ruta                     | Cuerpo                                   | Respuesta                                                      |
| --------------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| `GET /api/library`                | —                                        | `Library` con `folders` (orden por nombre)                     |
| `POST /api/folders`               | `{ name }`                               | `201 Folder`                                                   |
| `PATCH /api/folders/:id`          | `{ name }`                               | `Folder` · 404                                                 |
| `DELETE /api/folders/:id`         | —                                        | `204` (sus playlists quedan con null)                          |
| `PATCH /api/playlists/:id`        | además acepta `folderId: string \| null` | `Playlist` · 400 `folder_not_found`                            |
| `PUT /api/playlists/:id/cover`    | multipart, campo `cover` (JPEG ≤ 2 MB)   | `Playlist` · 415 `unsupported_cover` · 507 `storage_full`      |
| `DELETE /api/playlists/:id/cover` | —                                        | `Playlist` (coverAt null)                                      |
| `GET /media/playlist-cover/:id`   | —                                        | JPEG (`Cache-Control` inmutable; el cliente añade `v=coverAt`) |

Migración `apps/api/migrations/0004_folders.sql`:

```sql
CREATE TABLE folders (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
ALTER TABLE playlists ADD COLUMN folder_id TEXT;
ALTER TABLE playlists ADD COLUMN cover_at INTEGER;
CREATE INDEX idx_playlists_folder ON playlists (folder_id) WHERE folder_id IS NOT NULL;
```

### Cliente web (`apps/web/src/api/client.ts`) — métodos nuevos

```ts
createFolder(name: string): Promise<Folder>;
updateFolder(id: string, patch: { name: string }): Promise<Folder>;
deleteFolder(id: string): Promise<void>;
updatePlaylist(id, patch: { name?; description?; folderId?: string | null }): Promise<Playlist>;
setPlaylistCover(id: string, jpeg: Blob): Promise<Playlist>;   // PUT form 'cover'
removePlaylistCover(id: string): Promise<Playlist>;
fetchPlaylistCover(id: string): Promise<Blob>;                  // GET /media/playlist-cover/:id
export function playlistCoverUrl(id: string, coverAt: number): string; // une bien ?v= y &t=
```

### Portadas en pantalla (`apps/web/src/storage/media.ts`)

```ts
/** null when the playlist uses the mosaic or the image is unreachable. */
export function resolvePlaylistCoverUrl(pl: Playlist): Promise<string | null> | string | null;
```

### Store (`apps/web/src/stores/library.ts`) — estado y acciones nuevas

```ts
folders: Folder[];
createFolder(name: string): Promise<Folder | null>;
renameFolder(id: string, name: string): Promise<void>;
deleteFolder(id: string): Promise<void>;                       // optimista
movePlaylist(id: string, folderId: string | null): Promise<void>; // optimista
/** Returns true when merged. Toast with the reason when not. */
mergePlaylists(targetId: string, sourceId: string, deleteSource: boolean): Promise<boolean>;
/** file: any image chosen by the user (null = back to mosaic). Resizes to 300 px. */
setPlaylistCover(id: string, file: Blob | null): Promise<void>;
```

### Componentes (Fase 2)

```tsx
// components/PlaylistArt.tsx (se mueve aquí desde PlaylistsView.tsx)
export function PlaylistArt(props: {
  playlist: Playlist;
  tracks: Record<string, Track>;
  size?: number;
}): JSX.Element;
// components/PlaylistMenu.tsx — hoja «…» de una playlist
export function PlaylistMenu(props: { playlist: Playlist; onClose: () => void }): JSX.Element;
// components/MergeSheet.tsx — confirmación de juntar (casilla «borrar la otra» marcada)
export function MergeSheet(props: {
  targetId: string;
  sourceId: string;
  onClose: () => void;
}): JSX.Element;
// components/FolderMenu.tsx — hoja «…» de una carpeta (cambiar nombre, eliminar)
export function FolderMenu(props: { folder: Folder; onClose: () => void }): JSX.Element;
```

Ruta nueva en `App.tsx`: `/folder/:id` → `FolderView`.

### Claves i18n nuevas (las añade T7 en es/en/eu; la Fase 2 solo las usa)

`folders.new`, `folders.namePlaceholder`, `folders.rename`, `folders.delete`,
`folders.deleteConfirm` ({name}), `folders.empty`, `folders.notFound`, `folders.playlistCount`
y `folders.playlistCount.one` ({count}), `playlists.menu`, `playlists.moveToFolder`,
`playlists.moveOut`, `playlists.pickFolder`, `playlists.newFolderHere`, `playlists.merge`,
`playlists.mergePick`, `playlists.coverPick`, `playlists.coverRemove`, `merge.title`,
`merge.explain` ({source}, {target}), `merge.deleteOther` ({source}), `merge.deleteOtherHint`,
`merge.swap`, `merge.confirm`, `drag.handle`, `drag.dropRoot`, `toast.merged` ({count}, {name}),
`toast.mergeTooBig` ({total}, {max}), `toast.movedToFolder` ({name}), `toast.movedOut`,
`toast.folderCreated`, `toast.coverSaved`, `toast.coverBadImage`, `toast.coverStorageFull`,
`toast.cloudflareOutdated`. Se cambian `tips.playlists` y `copy.explain` para mencionar carpetas y
portadas.

## Tareas

### T1 · Tipos compartidos y lógica pura de playlists · Grupo A · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/index.ts`, `apps/web/src/storage/types.ts`,
  `apps/web/src/storage/playlistOps.ts` (nuevo), `apps/web/test/playlistOps.test.ts` (nuevo)
- Leer como contexto: `apps/web/src/storage/homes.ts`, `apps/web/test/copyPlan.test.ts` (estilo)
- Qué hacer:
  1. Añadir `Folder`, los campos opcionales de `Playlist`, `Library.folders` y
     `LIMITS.playlistCoverPx = 300` tal como en Contratos.
  2. Añadir `folders?` a `LibrarySnapshot` y los 5 métodos nuevos a `LibraryHome` (con sus
     comentarios). Es normal que `npm run typecheck` falle hasta que acabe el grupo B.
  3. Crear `playlistOps.ts` con `planMerge`, `groupPlaylists`, `applyMove`, `applyFolderDelete` y
     `dropAction` (funciones puras, sin imports de stores ni de React).
- TDD: sí
- Criterios de aceptación:
  - [ ] `planMerge`: mantiene el orden del destino y añade al final las del origen que faltan; sin
        repetidas aunque el origen tenga duplicados; `added` correcto; `same` si son la misma;
        `too_many` si el total sin repetidas supera 1000 (y `ok` con exactamente 1000).
  - [ ] `groupPlaylists`: carpetas por nombre, playlists por `createdAt`, carpetas vacías incluidas,
        playlist con `folderId` inexistente va a `loose`.
  - [ ] `applyMove` / `applyFolderDelete` no mutan la entrada.
  - [ ] `dropAction` cubre los casos del contrato (incluidos soltar sobre sí misma y sobre su
        propia carpeta → null).
- Verificación: `npx vitest run test/playlistOps.test.ts --root apps/web`

### T2 · Temporizador: botón «Quitar temporizador» · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/SleepTimerSheet.tsx`, `apps/web/src/i18n/es.ts`,
  `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/src/help/articles/listen.ts`
- Leer como contexto: `apps/web/src/stores/sleepTimer.ts`, `apps/web/test/i18n.test.ts`
- Qué hacer:
  1. Con temporizador activo, mostrar en una fila: la cuenta atrás en ámbar («Se apaga en …» o «al
     acabar esta canción») y a su lado un botón con borde (`btn small`, icono `TimerOff`) con texto
     `sleep.remove` = «Quitar temporizador» / «Remove timer» / «Kendu tenporizadorea». Al pulsarlo:
     `cancel()` y cerrar la hoja.
  2. Debajo, un enlace ámbar (botón con estilo de enlace) `sleep.change` = «Cambiar el tiempo» /
     «Change the time» / «Aldatu denbora». Mientras hay temporizador, los tiempos (chips, «Al acabar
     la canción», «Otro tiempo») están ocultos y este enlace los muestra; elegir uno sustituye al
     actual. Sin temporizador, la hoja se ve como ahora.
  3. Quitar el antiguo `menu-item` de cancelar y la clave `sleep.cancel` de los tres idiomas si ya
     no se usa (comprobar con Grep).
  4. Actualizar el artículo `sleep-timer` de `listen.ts` (es/en/eu): «pulsa la luna, verás cuánto
     falta; **Quitar temporizador** lo apaga y **Cambiar el tiempo** pone otro». No tocar el
     artículo `playlists` (lo hace T9).
- TDD: no
- Criterios de aceptación:
  - [ ] Test de paridad i18n y test de ayuda en verde.
  - [ ] Manual: con temporizador activo se ven la cuenta atrás y el botón con borde; el enlace
        ámbar solo despliega los tiempos y no quita nada.
- Verificación: `npx vitest run test/i18n.test.ts test/help.test.ts test/sleepTimer.test.ts --root apps/web`
  y `npm run dev` (probar en el reproductor grande, icono luna).

### T3 · API Cloudflare: carpetas, portadas y migración 0004 · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/api/migrations/0004_folders.sql` (nuevo),
  `apps/api/src/routes/folders.ts` (nuevo), `apps/api/src/routes/playlists.ts`,
  `apps/api/src/routes/library.ts`, `apps/api/src/routes/media.ts`,
  `apps/api/src/routes/ingest.ts`, `apps/api/src/lib/db.ts`, `apps/api/src/lib/storage.ts`,
  `apps/api/src/lib/image.ts` (nuevo), `apps/api/src/index.ts`, `apps/api/test/unit.test.ts`,
  `scripts/smoke.mjs`
- Leer como contexto: `apps/api/src/lib/http.ts`, `apps/api/migrations/0001_init.sql`
- Qué hacer:
  1. Migración tal como en Contratos.
  2. `db.ts`: `FolderRow`, `toFolder`, `PlaylistRow` con `folder_id` y `cover_at`, `toPlaylist`
     devuelve `folderId` y `coverAt` (null si no hay), `playlistCoverKey(id) = playlists/{id}/cover.jpg`.
  3. `folders.ts`: POST/PATCH/DELETE según Contratos, con zod (`name` trim 1..`LIMITS.nameMax`),
     `bumpVersion` en cada escritura; DELETE hace en una `batch`
     `UPDATE playlists SET folder_id = NULL WHERE folder_id = ?` + `DELETE FROM folders` + bump.
     Registrar en `index.ts` en `/api/folders`.
  4. `playlists.ts`: `PatchPlaylist` acepta `folderId` (id válido o null); si no existe la carpeta →
     400 `folder_not_found`. `PUT /:id/cover` (multipart `cover`, JPEG por bytes mágicos, ≤
     `LIMITS.coverMaxBytes`, comprobar `storageStats` antes de subir → 507 `storage_full`), guarda en
     R2 y pone `cover_at = now`. `DELETE /:id/cover` borra el objeto y pone null. Borrar una playlist
     borra también su portada en R2. Mantener funciones < 50 líneas (sacar ayudantes).
  5. Mover la comprobación JPEG (`startsWith` + firma) de `ingest.ts` a `lib/image.ts` y usarla en
     los dos sitios.
  6. `storage.ts`: sumar `COUNT(playlists con cover_at)` × `COVER_ESTIMATE` a `usedBytes`.
  7. `library.ts`: añadir la consulta de carpetas a la misma `batch` y `folders` al JSON.
  8. `media.ts`: `GET /media/playlist-cover/:id` con `serveObject`.
  9. `scripts/smoke.mjs`: si tiene pasos de playlists, añadir crear carpeta → mover playlist →
     comprobar `library.folders` y `folderId` → borrar carpeta.
- TDD: sí (tests unitarios de `toFolder`, `toPlaylist` con columnas nuevas, `playlistCoverKey`, la
  comprobación JPEG y el esquema `PatchPlaylist` con `folderId: null` válido y id inválido
  rechazado; exportar lo necesario para testear)
- Criterios de aceptación:
  - [ ] `npx vitest run --root apps/api` en verde.
  - [ ] `npm run db:migrate:local` aplica 0004 sin errores.
  - [ ] `npm run test:e2e` en verde (con wrangler reiniciado tras el build).
- Verificación: `npx vitest run --root apps/api`, `npm run db:migrate:local`, `npm run test:e2e`

### T4 · Homes dispositivo y Cloudflare, cliente API y portadas en pantalla · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/storage/homes.ts`, `apps/web/src/offline/db.ts`,
  `apps/web/src/storage/deviceFiles.ts`, `apps/web/src/api/client.ts`,
  `apps/web/src/storage/media.ts`, `apps/web/test/apiClient.test.ts`
- Leer como contexto: `apps/web/src/storage/types.ts`, `apps/web/src/storage/playlistOps.ts`
- Qué hacer:
  1. `offline/db.ts`: versión 3, almacén `folders` (`keyPath: 'id'`, valor `Folder`).
  2. `deviceFiles.ts`: `Kind` admite `'playlist-covers'`.
  3. `client.ts`: métodos nuevos del contrato y `playlistCoverUrl(id, coverAt)` (que añada
     `v=coverAt` y el token `t=` sin romper la URL). Los métodos van dentro de `createApi`; si con
     ellos `createApi` supera mucho las 50 líneas, agruparlos en un objeto auxiliar
     `folderMethods(json, call)` fuera de la función.
  4. `cloudflareHome`: `load` devuelve `folders: res.library.folders ?? []` (un Worker sin la
     migración no los manda); los 5 métodos con el cliente. Si una llamada de carpetas/portada
     responde 404 con `error: 'not_found'` y mensaje `Unknown endpoint`, lanzar
     `Error('cloudflare_outdated')`.
  5. `deviceHome`: `load` devuelve `folders` (por nombre); `createFolder`, `renameFolder`,
     `deleteFolder` (pone `folderId: null` en sus playlists), `movePlaylist` (valida que la carpeta
     existe → `Error('folder_not_found')`), `setPlaylistCover` (guarda/borra en
     `playlist-covers` y pone `coverAt`), `deletePlaylist` borra también la portada.
  6. `media.ts`: `resolvePlaylistCoverUrl(pl)` — dispositivo: archivo OPFS con caché de object URL
     por `${id}:${coverAt}`; Cloudflare: `playlistCoverUrl`; Drive: descarga `coverFileId` con la
     misma caché que las portadas de canciones (`driveCoverBlob`). Elegir según
     `useSetup.getState().config?.home` o, más simple, según `coverFileId` (Drive) / home activo.
- TDD: sí en el cliente (test de `playlistCoverUrl` y de que `setPlaylistCover` manda multipart
  `cover`); no en IndexedDB/OPFS (se prueban a mano)
- Criterios de aceptación:
  - [ ] `npx vitest run test/apiClient.test.ts --root apps/web` en verde.
  - [ ] Una base de datos de la versión 2 se abre sin perder datos (el `upgrade` solo añade).
- Verificación: `npx vitest run test/apiClient.test.ts test/storage.test.ts --root apps/web`

### T5 · Home Google Drive: carpetas y portadas en library.json · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/storage/drive/doc.ts`, `apps/web/src/storage/drive/home.ts`,
  `apps/web/test/driveDoc.test.ts`
- Leer como contexto: `apps/web/src/storage/types.ts`, `apps/web/src/storage/drive/api.ts`
- Qué hacer:
  1. `doc.ts`: `LibraryDoc.folders: Record<string, Folder>`; `emptyDoc`, `parseDoc` (sin
     `folders` → `{}`), `mergeDocs` (fusiona con `mergeMap` y las marcas `deleted`; después, toda
     playlist cuyo `folderId` no exista pasa a `folderId: null`), `docFingerprint` incluye carpetas.
     `version` sigue siendo 1 (campo nuevo opcional, compatible).
  2. `home.ts`: `change()` copia también `folders`; `snapshot` devuelve `folders` por nombre; los 5
     métodos nuevos. `deleteFolder` deja marca en `deleted` y pone `folderId: null` (con
     `updatedAt`) en sus playlists. `setPlaylistCover` sube el JPEG a `covers/` con nombre
     `playlist-{id}-{Date.now()}.jpg`, guarda `coverFileId` y `coverAt`, y manda a la papelera el
     archivo anterior (igual que `deleteTrack`, sin esperar). `deletePlaylist` también borra su
     portada. Usar `editPlaylist`.
- TDD: sí
- Criterios de aceptación:
  - [ ] Fusionar dos documentos donde uno borró una carpeta: la carpeta no vuelve y sus playlists
        quedan sin carpeta.
  - [ ] Carpeta creada en un dispositivo y renombrada en otro: gana el `updatedAt` mayor.
  - [ ] Un `library.json` antiguo sin `folders` se lee bien.
  - [ ] El fingerprint cambia al renombrar una carpeta.
- Verificación: `npx vitest run test/driveDoc.test.ts --root apps/web`; al final del grupo B,
  `npm run typecheck`.

### T6 · Copia entre almacenamientos con carpetas y portadas · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/storage/copy/plan.ts`, `apps/web/src/storage/copy/run.ts`,
  `apps/web/src/storage/copy/endpoints.ts`, `apps/web/test/copyPlan.test.ts`,
  `apps/web/test/copyRun.test.ts`
- Leer como contexto: `apps/web/src/storage/types.ts`, `apps/web/src/storage/homes.ts`,
  `apps/web/src/storage/drive/home.ts`, `apps/web/src/api/client.ts`
- Qué hacer:
  1. `CopyEndpoint`: `load()` devuelve también `folders`; `createPlaylist` devuelve
     `Promise<Playlist>`; nuevos `createFolder(name): Promise<Folder>`,
     `movePlaylist(id, folderId)`, `readPlaylistCover(pl): Promise<Blob | null>`,
     `setPlaylistCover(id, jpeg)`.
  2. `plan.ts`: `planFolders(src, dest): string[]` (nombres a crear, emparejando sin distinguir
     mayúsculas ni espacios de los lados). `PlaylistAction` gana `folderName: string | null` y
     `copyCover: boolean`. Para una playlist que ya existe en destino: `folderName` solo si la del
     destino no tiene carpeta; `copyCover` solo si el origen tiene `coverAt` y el destino no. Una
     acción `add` puede llevar `trackIds` vacío si aún hay carpeta o portada que poner; si no hay
     nada que hacer, no hay acción.
  3. `run.ts`: crear antes las carpetas que faltan (mapa nombre → id de destino); para cada acción:
     crear/añadir, mover a la carpeta y copiar la portada (`readPlaylistCover` del origen →
     `setPlaylistCover` del destino). Cada fallo de playlist, carpeta o portada se registra con
     `console.warn('Copy: …', err)` y no para la copia (arregla el problema conocido de errores
     tragados); un 507 de portada tampoco para la copia. Funciones < 50 líneas.
  4. `endpoints.ts`: implementar lo nuevo en dispositivo (`getDeviceFile('playlist-covers', id)`),
     Drive (`driveApi.download(pl.coverFileId)`) y Cloudflare (`api.fetchPlaylistCover`).
- TDD: sí
- Criterios de aceptación:
  - [ ] `planFolders` no duplica carpetas con el mismo nombre en distinto formato.
  - [ ] Una playlist en carpeta «Rock» del origen se crea en la carpeta «Rock» del destino.
  - [ ] No se cambia la carpeta ni la portada de una playlist que ya las tiene en destino.
  - [ ] `copyRun`: la portada se lee del origen y se escribe en destino; si falla, la copia sigue y
        acaba sin `stopped`.
- Verificación: `npx vitest run test/copyPlan.test.ts test/copyRun.test.ts --root apps/web`

### T7 · Store de la biblioteca y textos nuevos · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/library.ts`, `apps/web/src/i18n/es.ts`,
  `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`
- Leer como contexto: `apps/web/src/storage/playlistOps.ts`, `apps/web/src/lib/cover.ts`,
  `apps/web/src/stores/downloads.ts` (cómo traduce `storage_full`)
- Qué hacer:
  1. Estado `folders` (cargar de `snapshot.folders ?? []`, guardarlo en `persist` y en el snapshot
     de `mutate` para poder revertir).
  2. Acciones del contrato. Optimistas con `mutate`: `deleteFolder` (`applyFolderDelete`),
     `movePlaylist` (`applyMove`, toast `toast.movedToFolder`/`toast.movedOut`), `mergePlaylists`.
     No optimistas (necesitan respuesta): `createFolder`, `renameFolder`, `setPlaylistCover`.
  3. `mergePlaylists(target, source, deleteSource)`: `planMerge`; si `too_many` → toast
     `toast.mergeTooBig` y `false`; si `same` → `false`. Si ok: cambio optimista (target con
     `trackIds` juntados; quitar source si `deleteSource`) y llamada `addToPlaylist(target,
source.trackIds)` y luego, si toca, `deletePlaylist(source)`. Si algo falla, revertir y llamar a
     `load()` para volver a sincronizar (puede que la primera llamada sí llegara). Toast
     `toast.merged`.
  4. `setPlaylistCover(id, file)`: `squareJpeg(file, LIMITS.playlistCoverPx)`; si devuelve null →
     `toast.coverBadImage`. Errores: `storage_full`/507 → `toast.coverStorageFull`;
     `cloudflare_outdated` → `toast.cloudflareOutdated`; el resto, `reportError`.
  5. `reportError` traduce también `cloudflare_outdated` y `folder_not_found` (este último:
     recargar con `load()` y toast genérico).
  6. Añadir **todas** las claves i18n de Contratos en es, en y eu (singulares en `.one`), con textos
     para gente no técnica. Ejemplos es: `toast.mergeTooBig` = «No caben: juntas tendrían {total}
     canciones y una playlist admite hasta {max}. Quita algunas de una de las dos y vuelve a
     probar.»; `folders.deleteConfirm` = «¿Eliminar la carpeta «{name}»? Sus playlists no se
     borran: vuelven a la lista principal.»; `merge.deleteOtherHint` = «Las canciones no se borran:
     siguen en tu biblioteca.»; `toast.cloudflareOutdated` = «Tu Cloudflare tiene una versión
     antigua y todavía no admite carpetas ni portadas. Tu música y tus playlists siguen bien.»
     (sin comandos ni enlace a la ayuda; la actualización guiada llegará con la F6). Cambiar
     `tips.playlists` (mencionar «…» y el asa para arrastrar) y `copy.explain` (incluye carpetas y
     portadas).
- TDD: no (la lógica importante ya está probada en `playlistOps`); los tests de paridad i18n deben
  pasar
- Criterios de aceptación:
  - [ ] `npx vitest run test/i18n.test.ts --root apps/web` en verde.
  - [ ] Ninguna función nueva supera 50 líneas; `library.ts` < 800 líneas (si se acerca, sacar las
        acciones de carpetas a `stores/libraryFolders.ts` y combinarlas en el store).
  - [ ] Fin de la Fase 1: `npm run check` en verde.
- Verificación: `npx vitest run test/i18n.test.ts --root apps/web` y `npm run check`

### T8 · Lista de playlists con carpetas y arrastrar y soltar · Grupo D (Fase 2) · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/PlaylistsView.tsx`,
  `apps/web/src/views/FolderView.tsx` (nuevo), `apps/web/src/components/PlaylistDnd.tsx` (nuevo),
  `apps/web/src/App.tsx`, `apps/web/src/styles.css` (o el CSS global que use la app; buscar
  `.collection-art`)
- Leer como contexto: `apps/web/src/components/Sortable.tsx`, `apps/web/src/storage/playlistOps.ts`,
  `apps/web/src/stores/library.ts`, Contratos (componentes de T9)
- Qué hacer:
  1. Quitar `PlaylistArt` de `PlaylistsView.tsx` e importarlo de `components/PlaylistArt` (lo crea
     T9).
  2. `PlaylistsView`: botones «Nueva playlist» y «Nueva carpeta» (`promptDialog`); lista: «Canciones
     que te gustan», carpetas (icono `Folder` de lucide en ámbar, nombre, `folders.playlistCount`,
     enlace a `/folder/:id`, botón «…» → `FolderMenu`) y playlists sueltas (botón «…» →
     `PlaylistMenu`). Usar `groupPlaylists`.
  3. `FolderView` (`/folder/:id`): volver atrás, nombre, «…» de carpeta, sus playlists con «…» y
     arrastre, `folders.empty` si no tiene, `folders.notFound` si no existe. Zona «Suelta aquí para
     sacarla de la carpeta» (`drag.dropRoot`, id `root`) visible solo mientras se arrastra.
  4. `PlaylistDnd.tsx`: envoltorio `DndContext` + `useDraggable`/`useDroppable` con ids del contrato,
     sensores como `Sortable.tsx` (TouchSensor con `delay: 200, tolerance: 8`), detección
     `pointerWithin`, `DragOverlay` con el nombre. Asa ⠿ (`drag.handle`) que es lo único que inicia
     el arrastre. Al soltar, `dropAction(...)`: `move` → `movePlaylist`; `merge` → abrir
     `MergeSheet`. Resaltar en ámbar el destino bajo el dedo.
  5. Registrar la ruta en `App.tsx`.
- TDD: no (la decisión de soltar ya está probada en `dropAction`)
- Criterios de aceptación:
  - [ ] Manual con ratón y con el modo táctil de DevTools: arrastrar una playlist a una carpeta la
        mueve; soltarla sobre otra abre «Juntar playlists»; la lista sigue haciendo scroll con el
        dedo fuera del asa.
  - [ ] Teclado: el asa se puede mover con espacio + flechas.
- Verificación: `npm run dev` y `npm run check`

### T9 · Menú «…», juntar, portada propia, ayuda y documentos · Grupo D (Fase 2) · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/PlaylistArt.tsx` (nuevo),
  `apps/web/src/components/PlaylistMenu.tsx` (nuevo), `apps/web/src/components/MergeSheet.tsx`
  (nuevo), `apps/web/src/components/FolderMenu.tsx` (nuevo), `apps/web/src/views/PlaylistView.tsx`,
  `apps/web/src/help/articles/listen.ts`, `apps/web/src/help/articles/drive.ts` (u otro artículo
  donde se explique la copia; buscar con Grep «copia»/«copy»), `docs/ESTADO.md`,
  `docs/v2/architecture.md`
- Leer como contexto: `apps/web/src/components/Sheet.tsx`, `apps/web/src/components/TrackMenu.tsx`,
  `apps/web/src/components/Cover.tsx`, `apps/web/src/storage/media.ts`
- Qué hacer:
  1. `PlaylistArt.tsx`: copiar el mosaico actual; si `playlist.coverAt` hay foto propia
     (`resolvePlaylistCoverUrl`), con el mosaico como respaldo si falla.
  2. `PlaylistMenu`: hoja con «Cambiar nombre», «Mover a una carpeta…» (lista de carpetas + «Carpeta
     nueva…» + «Sacar de la carpeta» si está en una), «Juntar con otra playlist…» (lista de las
     demás → `MergeSheet` con target = esta), «Poner foto propia…» (`<input type="file"
accept="image/*">`) y «Volver al mosaico automático» si tiene foto, «Eliminar playlist».
  3. `MergeSheet`: explica qué pasa (`merge.explain`), casilla `merge.deleteOther` **marcada por
     defecto** con `merge.deleteOtherHint`, botón `merge.swap`, botón `merge.confirm` →
     `mergePlaylists`; si se borró la playlist abierta, navegar a la que queda.
  4. `FolderMenu`: «Cambiar nombre» y «Eliminar carpeta» (con `folders.deleteConfirm`).
  5. `PlaylistView.tsx`: importar `PlaylistArt` del componente nuevo; sustituir los botones de
     lápiz y papelera por un botón «…» (`playlists.menu`) que abre `PlaylistMenu`; si la playlist
     está en carpeta, el «volver» lleva a `/folder/:id`.
  6. Ayuda (`listen.ts`, es/en/eu): ampliar `playlists` con enlace a un artículo nuevo
     `playlist-folders` «Carpetas, portadas y juntar playlists»: crear carpeta, mover (menú «…» o
     arrastrar por el asa ⠿), borrar carpeta no borra playlists, foto propia y volver al mosaico,
     juntar (qué playlist se queda, sin repetidas, casilla «borrar la otra», tope de 1000 y qué hacer
     si no caben). En el artículo de la copia, añadir que viajan carpetas y portadas. Enlaces con
     `[[id|texto]]`.
  7. `docs/ESTADO.md`: 5.3 a «Hecho» (sin publicar), y en «Problemas conocidos» quitar «run.ts traga
     errores…» si T6 lo arregló. `docs/v2/architecture.md`: fila 5.3 con ✅.
- TDD: no
- Criterios de aceptación:
  - [ ] `npx vitest run test/help.test.ts test/i18n.test.ts --root apps/web` en verde.
  - [ ] Manual en los tres almacenamientos: foto propia visible tras recargar; juntar con 1000+
        muestra el error sencillo; la casilla desmarcada conserva la otra playlist.
- Verificación: `npm run check`; después `npm run build` y `npm run test:e2e`

## Riesgos / dudas abiertas

- **Migración en producción:** antes de publicar, `npm run db:migrate:remote` (0004). Sin ella, el
  Worker nuevo falla al leer la biblioteca. Orden: migrar, después `npm run deploy`.
- **Drive con dispositivos sin actualizar:** una app 0.5.2 que sincronice `library.json` descarta
  `folders` (no conoce el campo); las playlists quedarían fuera de carpeta (no se pierde música).
  Conviene actualizar todos los dispositivos a la vez. Se explica en las notas de la versión.
- **Cloudflare con Worker antiguo:** decidido por Andoni (opción 1): solo un aviso sencillo
  (`toast.cloudflareOutdated`); la actualización guiada llega con la F6. No hay dudas abiertas.

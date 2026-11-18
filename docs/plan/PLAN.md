# PLAN: Fase 5.4 · Ajustes tras la v0.5.3 (ancho de pantalla, orden de carpetas, arrastre y limpieza)

Fecha: 2026-11-19 · Estado: COMPLETADO

> Plan anterior (Fase 5.3: carpetas, portadas y juntar playlists) COMPLETADO y publicado en v0.5.3; está en el historial de git.

## Objetivo

1. La pantalla de Playlists (y la de una carpeta) cabe siempre: **ningún scroll horizontal**. Los
   botones «Nueva carpeta» y «Nueva playlist» llevan texto si cabe y, si no, solo icono.
2. **Ordenar carpetas arrastrando** por su asa ⠿, con desplazamiento automático de la lista al
   acercarse a los bordes. El orden se guarda en los tres almacenamientos y viaja con la copia.
3. **Arrastrar playlists**: se quita «juntar arrastrando una sobre otra» (juntar sigue en «…»). Se
   mantiene arrastrar a una carpeta y la zona «sacar de la carpeta». Las playlists NO se reordenan.
4. **Limpieza**: smoke test de portadas y orden; partir `PlaylistMenu` y `SleepTimerSheet`;
   actualizar `docs/ESTADO.md` y la tabla de fases.

## Decisiones de arquitectura

- El orden es un campo por carpeta, `Folder.position` (número; null/ausente = sin ordenar) — una app
  v0.5.3 conserva los campos que no conoce dentro de cada carpeta de `library.json` (guarda el objeto
  entero), así que no borra el orden; con una lista aparte (`folderOrder`) sí lo perdería.
- Una sola regla de orden para todos (`sortFolders`, en `@aske/shared`): primero las carpetas sin
  `position` por nombre, después las ordenadas por `position` (empate → nombre) — mientras nadie
  ordena se ve igual que ahora (alfabético) y lo nuevo va al final.
- Crear una carpeta la pone **al final** (`position = máximo + 1`) en los tres almacenamientos.
- Reordenar manda la lista completa de ids en el orden nuevo; `reorderFolders` (pura, compartida
  por web y Worker) da `position` 0..n-1, deja detrás las carpetas que no venían en la lista (creadas
  en otro dispositivo mientras tanto) e ignora ids desconocidos o repetidos. Solo cambia `updatedAt`
  de las que cambian de sitio — en Drive la fusión es por carpeta y por `updatedAt`.
- Copia entre almacenamientos: las carpetas se siguen emparejando por nombre; las que faltan se crean
  **en el orden del origen** y, como crear añade al final, quedan detrás de las que ya había. Las
  carpetas existentes del destino **no se mueven** (regla 5.2: no pisar nada). No hace falta tocar
  `CopyEndpoint` ni `run.ts`.
- Cloudflare: migración `0005_folder_order.sql` (columna `position`) y `PUT /api/folders/order`.
  Worker antiguo → 404 «Unknown endpoint» → `cloudflare_outdated` → toast `toast.cloudflareOutdated`
  (ya existe) y el store revierte.
- Dispositivo: IndexedDB **no** cambia de versión (el objeto `Folder` admite el campo nuevo).
- Arrastre: un solo `DndContext` en la lista principal. Carpetas = `useSortable` (id `folder:<id>`,
  que sirve a la vez de destino para soltar playlists). Playlists = `useDraggable` y **dejan de ser
  destino**. Detección de colisión según lo que se arrastra (carpeta → `closestCenter` solo entre
  carpetas; playlist → `pointerWithin` entre carpetas y `root`). Solo el asa inicia el arrastre.
- Autodesplazamiento: el `autoScroll` de `@dnd-kit/core` (velocidad proporcional a lo cerca que esté
  el dedo del borde), solo vertical (`threshold.x = 0`), y medición `MeasuringStrategy.Always` para
  que las carpetas se midan bien tras desplazarse.
- Ancho: causa raíz arreglada en las cabeceras (h1 que encoge con puntos suspensivos, botones que no
  encogen) + container query que oculta la etiqueta de los botones cuando no cabe + red de seguridad
  `overflow-x: hidden` en `.main` (hoy `overflow-y: auto` hace que el eje x también sea desplazable).

## Contratos (interfaces compartidas)

### `packages/shared` (T1)

```ts
// src/index.ts — Folder gana un campo opcional y se reexporta la lógica
export interface Folder {
  id: string;
  name: string;
  createdAt: EpochMs;
  updatedAt: EpochMs;
  /** Order chosen by the user (ascending). null/undefined = not ordered yet. */
  position?: number | null;
}
export { sortFolders, nextFolderPosition, reorderFolders, type FolderReorder } from './folders';

// src/folders.ts (nuevo, funciones puras)
/** Unordered folders first (by name, localeCompare sensitivity 'base'), then by position (tie → name). New array. */
export function sortFolders(folders: readonly Folder[]): Folder[];
/** Max position + 1; 0 when no folder has a position. */
export function nextFolderPosition(folders: readonly Folder[]): number;
export interface FolderReorder {
  /** All folders in the new order, position = index. */
  folders: Folder[];
  /** Only those whose position changed (with updatedAt = now). */
  changed: Folder[];
}
/** orderedIds first (unknown/duplicated ids ignored), then the rest in their sortFolders order. */
export function reorderFolders(
  folders: readonly Folder[],
  orderedIds: readonly string[],
  now: EpochMs,
): FolderReorder;
```

### `apps/web/src/storage/playlistOps.ts` (T1)

```ts
// groupPlaylists: las carpetas salen en orden sortFolders (antes: por nombre). Lo demás igual.
/** Drag & drop ids: 'pl:<id>', 'folder:<id>', 'root'. */
export type DropResult =
  | { kind: 'move'; playlistId: string; folderId: string | null }
  | { kind: 'reorderFolders'; folderIds: string[] }
  | null;
export function dropAction(
  activeId: string,
  overId: string | null,
  playlists: Playlist[],
  folders: Folder[],
): DropResult;
```

Reglas de `dropAction`: `pl:A` sobre `folder:F` → move (null si A ya está en F o F no existe);
`pl:A` sobre `root` → move a null (null si ya está fuera); `pl:A` sobre `pl:B` o cualquier otra cosa
→ **null** (ya no hay juntar). `folder:A` sobre `folder:B` (B ≠ A, ambas existen) →
`reorderFolders` con los ids de `sortFolders(folders)` tras mover A a la posición de B (como
`arrayMove`); `folder:A` sobre cualquier otra cosa → null. El tipo `merge` desaparece.

### `apps/web/src/storage/copy/plan.ts` (T1)

`planFolders(src, dest)` devuelve los nombres a crear **en el orden `sortFolders(src)`** (misma
firma).

### API Cloudflare (T4)

| Método y ruta            | Cuerpo                                              | Respuesta                                                          |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------ |
| `POST /api/folders`      | `{ name }`                                          | `201 Folder` con `position` = máximo + 1                           |
| `PUT /api/folders/order` | `{ ids: string[] }` (≤ 1000, cada uno `ID_PATTERN`) | `200 Folder[]` (todas, en el orden nuevo) · 400 `validation_error` |
| `GET /api/library`       | —                                                   | `folders` en orden `sortFolders`, cada una con `position` (o null) |

```sql
-- apps/api/migrations/0005_folder_order.sql
ALTER TABLE folders ADD COLUMN position INTEGER;
```

### Web: almacenamiento y cliente (T5)

```ts
// storage/types.ts — método nuevo en LibraryHome
/** Saves the folder order. Folders not in `ids` go after. Returns all folders in the new order. */
reorderFolders(ids: string[]): Promise<Folder[]>;
// load()/snapshot devuelven folders en orden sortFolders; createFolder pone position = nextFolderPosition.

// api/client.ts — dentro de folderMethods
reorderFolders: (ids: string[]) => Promise<Folder[]>; // PUT /api/folders/order, json { ids }
```

### Store (`stores/library.ts`, T6)

```ts
/** Optimistic: reorders at once and rolls back (with the usual toast) if saving fails. */
reorderFolders: (folderIds: string[]) => Promise<void>;
```

### Textos i18n (T7; la T6 solo los usa)

- Cambia `drag.handle`: es «Arrastra para llevarla a una carpeta» · en "Drag to move it into a
  folder" · eu «Arrastatu karpeta batera eramateko».
- Nueva `drag.folderHandle`: es «Arrastra para cambiar el orden de la carpeta» · en "Drag to change
  the folder's place in the list" · eu «Arrastatu karpetaren lekua aldatzeko».
- Cambia `tips.playlists` (sin «juntarla con otra»; menciona ordenar carpetas con el asa ⠿).

## Tareas

### T1 · Lógica pura: orden de carpetas, arrastre sin juntar y orden en la copia · Grupo A · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/index.ts`, `packages/shared/src/folders.ts` (nuevo),
  `packages/shared/test/folders.test.ts` (nuevo), `apps/web/src/storage/playlistOps.ts`,
  `apps/web/test/playlistOps.test.ts`, `apps/web/src/storage/copy/plan.ts`,
  `apps/web/test/copyPlan.test.ts`
- Leer como contexto: `packages/shared/test/youtube.test.ts` (estilo), Contratos de este plan
- Qué hacer:
  1. Añadir `position?` a `Folder` y crear `folders.ts` con `sortFolders`, `nextFolderPosition` y
     `reorderFolders` tal como en Contratos (`import type` desde `./index`; reexportarlas en
     `index.ts`). Sin mutar la entrada.
  2. `playlistOps.ts`: `groupPlaylists` usa `sortFolders`; reescribir `dropAction` con la firma y
     reglas de Contratos (quitar la rama `merge` y su tipo; para mover dentro del array, una función
     local pequeña tipo `arrayMove`, sin importar `@dnd-kit` en lógica pura). `planMerge` se queda (lo
     usa el menú «…»).
  3. `playlistOps.test.ts`: borrar los tests de soltar una playlist sobre otra (merge) y añadir los
     nuevos; nada de tests huérfanos.
  4. `plan.ts`: `planFolders` recorre `sortFolders(src)`.
- TDD: sí
- Criterios de aceptación:
  - [ ] `sortFolders`: sin `position` primero y por nombre (sin distinguir mayúsculas); después por
        `position`; empate → nombre; no muta.
  - [ ] `nextFolderPosition`: 0 sin posiciones; máximo + 1 con huecos o mezcla con null.
  - [ ] `reorderFolders`: posiciones 0..n-1; las no listadas van detrás en su orden previo; ids
        desconocidos y repetidos ignorados; `changed` solo trae las que cambian, con `updatedAt = now`;
        las demás conservan su `updatedAt`.
  - [ ] `dropAction`: playlist sobre otra playlist → null; sobre carpeta/root como antes; carpeta
        sobre carpeta → orden correcto hacia arriba y hacia abajo; carpeta sobre sí misma, sobre
        `root` o sobre una playlist → null.
  - [ ] `groupPlaylists` respeta `position`; `planFolders` devuelve nombres en orden del origen.
- Verificación: `npx vitest run test/folders.test.ts --root packages/shared` y
  `npx vitest run test/playlistOps.test.ts test/copyPlan.test.ts --root apps/web`.
  Aviso: `npm run typecheck` fallará en `components/PlaylistDnd.tsx` (usa `merge`) hasta la T6; es
  esperado.

### T2 · Que la pantalla quepa siempre (CSS y cabeceras) · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/styles.css`, `apps/web/src/views/PlaylistsView.tsx`,
  `apps/web/src/views/FolderView.tsx`
- Leer como contexto: `apps/web/src/components/SettingsLink.tsx`, `apps/web/src/components/PlaylistDnd.tsx`
- Qué hacer (sin tocar la lógica de arrastre; eso es la T6):
  1. `.main`: añadir `overflow-x: hidden` con comentario en inglés del porqué (con `overflow-y: auto`
     el eje x también se vuelve desplazable; es la red de seguridad).
  2. `.page-header`: el `h1` con `min-width: 0` y puntos suspensivos; el resto de hijos
     `flex-shrink: 0`. Nueva clase `.header-actions` (flex, gap 8px, sin encoger) para el grupo de
     botones de `PlaylistsView`.
  3. Botones «Nueva carpeta» / «Nueva playlist»: texto dentro de `<span className="btn-label">`,
     y `aria-label` + `title` con el mismo texto en el botón. Ocultar la etiqueta con container
     query: `.page-header` con `container: page-header / inline-size` y
     `@container page-header (max-width: 520px)` → `.btn-label { display: none }` y el botón queda
     cuadrado (32 × 32, centrado). Ajustar el umbral midiendo en DevTools el idioma más largo
     (es/en/eu). Además, `.btn-label` con `min-width: 0` + puntos suspensivos por si el umbral se
     queda corto.
  4. `FolderView`: el nombre de la carpeta en un `<span className="ellipsis">` dentro del `h1`
     (`min-width: 0`), el botón «…» sin encoger; nombres larguísimos sin espacios no desbordan.
  5. Filas: comprobar que `.icon-btn` y `.drag-handle` no encogen, que `.drop-root` y
     `.drag-overlay` no superan el ancho (`.drag-overlay { max-width: min(80vw, 360px) }` con
     puntos suspensivos).
- TDD: no
- Criterios de aceptación:
  - [ ] Manual en DevTools (320, 360, 412 y 768 px) en es, en y eu: en Playlists y en una carpeta
        `document.querySelector('.main').scrollWidth === clientWidth` (sin `overflow-x` ayudando:
        comprobarlo quitando temporalmente la regla del punto 1).
  - [ ] En 768 px los botones muestran texto; en 360 px solo icono y el lector de pantalla dice el
        nombre.
  - [ ] Una carpeta y una playlist con nombre de 120 caracteres sin espacios no desbordan.
- Verificación: `npm run dev` y `npm run check` (salvo el fallo de tipos esperado por la T1)

### T3 · Limpieza: partir PlaylistMenu y SleepTimerSheet + documentos · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/PlaylistMenu.tsx`,
  `apps/web/src/components/PlaylistMenuParts.tsx` (nuevo),
  `apps/web/src/components/SleepTimerSheet.tsx`, `docs/ESTADO.md`, `docs/v2/architecture.md`
- Leer como contexto: `apps/web/src/components/MergeSheet.tsx`, `apps/web/src/components/Sheet.tsx`
- Qué hacer (sin cambiar comportamiento ni textos):
  1. `PlaylistMenu`: mover a `PlaylistMenuParts.tsx` las hojas `FolderPickSheet` (elegir carpeta +
     «Carpeta nueva…») y `MergePickSheet` (elegir con cuál juntar), y las acciones con diálogo como
     funciones de módulo (`renamePlaylistFlow`, `deletePlaylistFlow`, `newFolderFlow`) que reciben
     lo que necesiten (`playlist`, `t`, `navigate`). En `PlaylistMenu.tsx` quedan `PlaylistMenu`
     (elige paso) y `PlaylistMainSheet` (la hoja principal). Toda función < 50 líneas.
  2. `SleepTimerSheet`: extraer `TimerStatus` (cuenta atrás + «Quitar temporizador») y `TimeChoices`
     (chips, «Al acabar la canción» y `CustomTime`) en el mismo archivo; `SleepTimerSheet` < 50
     líneas.
  3. `docs/ESTADO.md` (máx. ~30 líneas, mismo estilo): F5.3 publicada en **v0.5.3**; pruebas en el
     móvil casi todas bien, falta repetirlas con Drive y con Cloudflare; «En curso»: Fase 5.4 (este
     plan) y lo que sigue pendiente de Andoni; quitar lo ya hecho; recordar migración remota 0005
     antes del próximo deploy. Mantener «Problemas conocidos» vigentes (quitar los resueltos).
  4. `docs/v2/architecture.md`: añadir la fila `5.4 | Folder order, screen-width fixes, drag clean-up`
     con estado vacío (en curso).
- TDD: no
- Criterios de aceptación:
  - [ ] Grep: ninguna función de los dos componentes supera 50 líneas.
  - [ ] Manual: el menú «…» (renombrar, mover, sacar, juntar, foto, quitar foto, eliminar) y el
        temporizador funcionan igual que antes.
  - [ ] `ESTADO.md` ≤ ~30 líneas.
- Verificación: `npx vitest run test/sleepTimer.test.ts --root apps/web`, `npm run dev`

### T7 · Textos y ayuda: sin «juntar arrastrando», con ordenar carpetas · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/en.ts`,
  `apps/web/src/i18n/eu.ts`, `apps/web/src/help/articles/listen.ts`
- Leer como contexto: `apps/web/test/i18n.test.ts`, `apps/web/test/help.test.ts`
- Qué hacer:
  1. Claves de Contratos (`drag.handle` cambiada, `drag.folderHandle` nueva, `tips.playlists`) en
     es/en/eu. Ejemplo es de `tips.playlists`: «Crea playlists para ordenar tu música y agrúpalas en
     carpetas. Pulsa «…» para más opciones. Con el asa ⠿ llevas una playlist a una carpeta o cambias
     el orden de las carpetas. «Canciones que te gustan» se llena sola cuando pulsas el corazón.»
  2. Buscar con Grep otros textos que digan juntar arrastrando (es «arrastr», en «drag», eu
     «arrastat») y corregirlos.
  3. Artículo `playlist-folders` (es/en/eu): quitar «También puedes arrastrar una playlist sobre
     otra»; añadir un apartado **Ordenar las carpetas**: «arrastra el asa ⠿ de una carpeta hacia
     arriba o abajo; si llegas al borde de la pantalla, la lista se mueve sola. El orden se guarda
     donde está tu música. Al copiar a otro almacenamiento, las carpetas que no existían allí se
     añaden al final, sin mover las que ya había.» Las playlists no se reordenan (no prometerlo).
- TDD: no
- Criterios de aceptación:
  - [ ] Tests de paridad i18n y de ayuda en verde.
  - [ ] Ningún texto ni artículo menciona juntar arrastrando.
- Verificación: `npx vitest run test/i18n.test.ts test/help.test.ts --root apps/web`

### T4 · API Cloudflare: migración 0005, orden de carpetas y smoke (portadas + orden) · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/api/migrations/0005_folder_order.sql` (nuevo),
  `apps/api/src/lib/db.ts`, `apps/api/src/routes/folders.ts`, `apps/api/src/routes/library.ts`,
  `apps/api/test/unit.test.ts`, `scripts/smoke.mjs`
- Leer como contexto: `apps/api/src/lib/http.ts`, `apps/api/src/routes/playlists.ts` (portadas),
  `packages/shared/src/folders.ts`
- Qué hacer:
  1. Migración de Contratos.
  2. `db.ts`: `FolderRow.position: number | null`; `toFolder` devuelve `position` (null si no hay).
  3. `folders.ts`: `POST` inserta con `position = (SELECT COALESCE(MAX(position), -1) + 1 FROM
folders)` y devuelve la fila leída en la misma `batch`. Nuevo `PUT /order` con esquema zod
     exportado `FolderOrderBody` (`ids`: array ≤ 1000 de `ID_PATTERN`): lee todas las carpetas,
     `reorderFolders(..., Date.now())`, en una `batch` un `UPDATE folders SET position = ?,
updated_at = ? WHERE id = ?` por cada `changed` + `bumpVersion` (solo si hay cambios); responde
     `folders` ordenadas. Funciones < 50 líneas.
  4. `library.ts`: `folders: sortFolders(rows.map(toFolder))`.
  5. `smoke.mjs`, pasos nuevos (antes de «storage stats»):
     - **Portadas** (sobre `state.playlistId`): `PUT /api/playlists/:id/cover` (multipart `cover`)
       con un JPEG válido (bytes `FF D8 FF E0 …`) → 200 y `coverAt` numérico; con un PNG (`89 50 4E
47 0D 0A 1A 0A …`) → 415 `unsupported_cover`; `GET /media/playlist-cover/:id` → 200 e
       `image/jpeg`; `DELETE /api/playlists/:id/cover` → `coverAt` null y el GET → 404.
     - **Orden de carpetas**: crear «A», «B», «C» → `position` 0, 1, 2 y `library.folders` en ese
       orden; `PUT /api/folders/order` con `[C, A, 'doesNotExist1234']` → `[C, A, B]`; la biblioteca
       lo confirma; cuerpo inválido → 400; borrar las tres al final.
- TDD: sí (unit: `toFolder` con y sin `position`; `FolderOrderBody` acepta ids válidos y rechaza
  inválidos o más de 1000; smoke como test de integración)
- Criterios de aceptación:
  - [ ] `npx vitest run --root apps/api` en verde.
  - [ ] `npm run db:migrate:local` aplica 0005 sin errores.
  - [ ] `npm run test:e2e` en verde con los pasos nuevos (build reciente y wrangler reiniciado).
- Verificación: `npx vitest run --root apps/api`, `npm run db:migrate:local`, `npm run build`,
  `npm run test:e2e`

### T5 · Orden de carpetas en los tres almacenamientos y en el cliente · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/storage/types.ts`, `apps/web/src/storage/homes.ts`,
  `apps/web/src/storage/drive/home.ts`, `apps/web/src/api/client.ts`,
  `apps/web/test/apiClient.test.ts`, `apps/web/test/driveDoc.test.ts`
- Leer como contexto: `packages/shared/src/folders.ts`, `apps/web/src/storage/drive/doc.ts`
- Qué hacer:
  1. `types.ts`: método `reorderFolders` de Contratos en `LibraryHome`.
  2. `client.ts`: `reorderFolders(ids)` dentro de `folderMethods` (no alargar `createApi`).
  3. `cloudflareHome`: `reorderFolders: (ids) => orOutdated(api.reorderFolders(ids))`; `load`
     devuelve `sortFolders(res.library.folders ?? [])` (un Worker viejo no manda `position`).
  4. `deviceHome`: `load` usa `sortFolders`; `createFolder` pone `position:
nextFolderPosition(todas)`; `reorderFolders` lee todas, aplica `reorderFolders` y guarda solo
     `changed` (en una transacción `readwrite` de `folders`); devuelve `folders`.
  5. `driveHome`: `snapshot` usa `sortFolders`; `createFolder` calcula la posición dentro de
     `change()` con `Object.values(doc.folders)`; `reorderFolders` dentro de `change()` escribe solo
     `changed` en `doc.folders` y devuelve el orden nuevo. `doc.ts` no cambia.
- TDD: sí (cliente: `reorderFolders` hace `PUT /api/folders/order` con `{ ids }`; `driveDoc.test.ts`:
  `position` sobrevive a `parseDoc` y en `mergeDocs` gana la carpeta con `updatedAt` mayor, con su
  `position`; el fingerprint cambia tras un reordenado). IndexedDB y Drive real: a mano.
- Criterios de aceptación:
  - [ ] Tests en verde.
  - [ ] Una carpeta guardada sin `position` (v0.5.3) se lee y se ordena bien.
- Verificación: `npx vitest run test/apiClient.test.ts test/driveDoc.test.ts --root apps/web`;
  al final del grupo B, `npm run typecheck` (solo debe fallar `PlaylistDnd.tsx`, que arregla la T6).

### T6 · Store y arrastre: ordenar carpetas con autodesplazamiento, quitar juntar arrastrando · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/library.ts`, `apps/web/src/components/PlaylistDnd.tsx`,
  `apps/web/src/views/PlaylistsView.tsx`, `apps/web/src/styles.css`, `docs/ESTADO.md`,
  `docs/v2/architecture.md`
- Leer como contexto: `apps/web/src/components/Sortable.tsx`, `apps/web/src/storage/playlistOps.ts`,
  `apps/web/src/views/FolderView.tsx`, `apps/web/src/components/MergeSheet.tsx`
- Qué hacer:
  1. Store: acción `reorderFolders(folderIds)` optimista con `mutate` (estado = `reorderFolders(
get().folders, folderIds, Date.now()).folders` de `@aske/shared`; la llamada guarda con
     `getHome().reorderFolders` y pone el resultado en `folders`); `.catch(() => undefined)` como
     `movePlaylist` (el revertido y el toast, incluido `cloudflare_outdated`, ya los hace `mutate`).
     Donde el store ordene carpetas (p. ej. `createFolder`), respetar `sortFolders`.
  2. `PlaylistDnd`: nueva prop opcional `folders?: Folder[]` (por defecto `[]`, así `FolderView` no
     cambia). Quitar `MergeSheet`, el estado `merge` y `useDroppable` de `DraggablePlaylist`.
     Colisión según lo arrastrado (ver Decisiones). `SortableContext` con ids `folder:<id>` en orden
     `sortFolders`, `verticalListSortingStrategy`. Nuevo `SortableFolder` (sustituye a
     `DroppableFolder`): `useSortable`, asa ⠿ con `drag.folderHandle`, `transform`/`transition`,
     resalte ámbar `drop-over` solo si lo arrastrado es una playlist. `onDragEnd`: `dropAction(...,
folders)` → `move` → `movePlaylist`; `reorderFolders` → store. `DndContext` con
     `autoScroll={{ threshold: { x: 0, y: 0.2 }, acceleration: 20 }}` y `measuring={{ droppable: {
strategy: MeasuringStrategy.Always } }}`. `KeyboardSensor` con `sortableKeyboardCoordinates`.
     `DragOverlay` muestra el nombre de la carpeta o playlist. Funciones < 50 líneas.
  3. `PlaylistsView`: pasar `folders` ordenadas a `PlaylistDnd`; `FolderRow` usa `SortableFolder` y
     pinta el asa al final de la fila (como en playlists).
  4. `styles.css`: solo lo necesario para la fila de carpeta que se arrastra (como `.sortable-row`).
  5. Comprobar con Grep que `MergeSheet` sigue usándose (desde `PlaylistMenuParts`/`PlaylistMenu`)
     y que no queda código muerto (`DroppableFolder`, tipo `merge`).
  6. Al terminar: fila 5.4 con ✅ en `docs/v2/architecture.md` y 5.4 a «Hecho (sin publicar)» en
     `docs/ESTADO.md`, con el recordatorio de la migración remota 0005.
- TDD: no (la decisión al soltar y el orden ya están probados en T1)
- Criterios de aceptación:
  - [ ] Ratón y modo táctil de DevTools: arrastrar una carpeta por su asa la cambia de sitio; con
        muchas carpetas, acercar el dedo al borde superior/inferior desplaza la lista y más rápido
        cuanto más cerca; la lista sigue desplazándose con el dedo fuera del asa; nunca hay scroll
        horizontal.
  - [ ] Soltar una playlist sobre otra no hace nada; sobre una carpeta la mueve; en una carpeta, la
        zona «sacar de la carpeta» funciona.
  - [ ] Teclado: el asa de carpeta se mueve con espacio + flechas.
  - [ ] Orden guardado tras recargar en dispositivo, Drive y Cloudflare; con un Worker sin 0005 (o
        v0.5.3) sale `toast.cloudflareOutdated` y el orden vuelve atrás.
  - [ ] `npm run check` en verde.
- Verificación: `npm run check`; después `npm run build`, reiniciar wrangler y `npm run test:e2e`;
  `npm run dev` para lo manual.

## Riesgos / dudas abiertas

- **Migración remota antes de publicar:** `npm run db:migrate:remote` (aplica 0005) y **después**
  `npm run deploy`. Sin la migración, el Worker nuevo falla al crear carpetas (columna `position`
  inexistente). Cada amigo con su propio Cloudflare necesitará lo mismo; hasta entonces verá
  `toast.cloudflareOutdated` al reordenar y sus carpetas en orden alfabético (no pierde nada).
- **Móviles con la v0.5.3 sincronizando Drive:** con el diseño elegido (campo dentro de cada
  carpeta) la v0.5.3 conserva el orden al guardar `library.json`. Lo único que pasa: una carpeta
  creada desde la v0.5.3 no tiene posición y sale arriba (entre las no ordenadas, por nombre) hasta
  que se reordene. Si en el futuro se añadiera el orden como lista aparte, la v0.5.3 sí lo borraría:
  no hacerlo. Explicarlo en las notas de la versión y recomendar actualizar todos los dispositivos.
- **Comportamiento nuevo visible:** una carpeta nueva aparece al final (antes, por orden alfabético).
  Está alineado con «ordenar a mano»; si Andoni prefiere otra cosa, se cambia solo `nextFolderPosition`.
- No hay dudas abiertas para Andoni.

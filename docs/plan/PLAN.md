# PLAN: v0.9.4 — Jam como mando a distancia, Grupos con nombre y foto (boceto A) y arreglos pendientes

Fecha: 2026-11-26 · Estado: v0.9.4 COMPLETADO (Fase 3 = v0.9.5 en borrador) · Decisiones: DEFINITIVAS

## v0.9.3 (COMPLETADA y publicada: `ff1905d`, tag, web y APK)

Resumen: descargas cancelables que no bloquean la cola (carriles «nube» y «móvil», vigilante,
64 KB/s con tope de 30 min); audios de más de 95 MB con Cloudflare solo en este móvil
(`local-extras`); podcasts por serie (`album`) y ordenados; aleatorio de orden fijo por semilla con
«Barajar de nuevo»; Jam desde la biblioteca; portadas en menús sociales y «Enviar»; gestos del mini
reproductor; arreglos del QR y de «Seleccionar». El hub no cambió. Detalle en `docs/ESTADO.md` y
`docs/releases/v0.9.3.md`. Si aparecen fallos del APK v0.9.3, se añaden como tareas nuevas aquí.

## Objetivo

Publicar **v0.9.4** con:

- **Jam como mando a distancia:** cualquiera de la Jam salta la canción (1 salto cada 2 s por
  persona, sin confirmación y sin aviso); el sonido sigue saliendo solo del móvil de quien la creó.
  El invitado ve una **barra de la Jam** cuando su móvil no suena.
- **Grupos (boceto A):** lista con tarjetas, detalle con foto grande, «Nombre y foto» (cualquier
  miembro), hojas de crear y unirse con el mismo estilo, y vista previa (nombre, personas y foto)
  para quien tenga un código de invitación válido.
- **Pendientes de `ESTADO.md`:** cancelar cuando la nube ya recibió el audio, «Seleccionar» dentro
  de las carpetas, eu solo con «zerrenda», menú Ordenar con teclado y selección de playlists que se
  limpia al cambiar de pantalla.

## Decisiones de Andoni (vigentes)

| Tema                  | Decisión                                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jam                   | Mando a distancia para todos (N1A). Sin aviso cuando alguien salta (N6B)                                                                                                                             |
| Quién salta           | Todos; quien crea la Jam **no** puede impedirlo. Límite: 1 salto cada 2 s por persona                                                                                                                |
| Botón Saltar          | Sin confirmación; se bloquea 2 s contra dobles toques                                                                                                                                                |
| Invitado              | Barra de la Jam si su móvil no suena (portada, título, «Suena en el móvil de X», Saltar, deslizar a la izquierda salta). Si escucha su música, ve su reproductor y salta desde la pantalla de la Jam |
| Grupos: permisos      | Cualquier miembro cambia nombre y foto (11B); no se guarda ni se muestra quién (N5B)                                                                                                                 |
| Foto                  | Recortada al centro automáticamente (12A); desde el selector de archivos o galería, sin permiso de cámara                                                                                            |
| Ver la foto           | Miembros y quien tenga un código de invitación válido; nunca pública sin código                                                                                                                      |
| Error al guardar      | Aviso en lenguaje sencillo; se conserva lo escrito y la foto para reintentar; gana el último cambio                                                                                                  |
| Rediseño              | Fiel al boceto A (`docs/plan/bocetos/grupos.html`), **también la lista**: cada tarjeta con iniciales de los miembros, minutos del mes, quién más escucha o «todavía nadie ha compartido»             |
| Datos de las tarjetas | Solo cuentan quienes comparten sus escuchas (RGPD); compatible con clientes y hub antiguos                                                                                                           |
| Euskera               | «zerrenda» en todas partes (confirmado por Andoni)                                                                                                                                                   |
| TDD                   | Por tarea: sí en lógica importante, no en interfaz simple                                                                                                                                            |
| Publicar              | Tras aprobar la revisión, publicar directamente sin volver a preguntar                                                                                                                               |

## Diagnóstico (con archivo y línea)

- **Saltar hoy:** solo el anfitrión (`apps/web/src/stores/jam.ts:301-314`, `components/jam/JamRoom.tsx:62-66`). El servidor rechaza `start`/`finish` de invitados (`apps/hub/src/jam/state.ts:141-144`). `hello` no anuncia capacidades (`apps/hub/src/jam/protocol.ts:15-19`).
- **Anfitrión antiguo:** el servidor sabe qué socket es el anfitrión (`room.ts:153-156`); el adjunto del socket puede guardar más campos (`room.ts:156`), pero `you` se envía tal cual (`room.ts:179`): hay que quitar los campos internos.
- **Grupos:** la lista solo recibe `id`, `name`, `members`, `isOwner` (`packages/shared/src/groups.ts:29-34`, `apps/hub/src/groups/service.ts:34-42`), así que el hub tiene que enviar más para las tarjetas del boceto A. Las escuchas solo existen en `device_stats` de quien dio permiso (se borran al quitarlo: `stores/groups.ts:77-89`), y `statsForGroup` ya une miembros con escuchas (`repo.ts:296-308`). El detalle ya trae los miembros y las estadísticas del mes (`GroupStats`, `groups.ts:79-84`): hay datos para el podio, «Canciones del mes» y las iniciales. No hay vista previa antes de unirse (`apps/hub/src/groups/routes.ts:66-80`).
- **Límite por IP:** `enforceRateLimit` usa la IP (`apps/hub/src/lib/rateLimit.ts:31-35`); para «20 cambios por hora y grupo» se usa `checkRateLimit` con la clave `group_edit:<groupId>`.
- **Subidas binarias:** `hubFetch` solo envía JSON y lee JSON (`apps/web/src/hub/client.ts:47-68`).
- **Cancelar con la nube ya servida:** `cancel` aborta la petición (`downloads/cancel.ts:69-85`), pero si el Worker ya guardó el audio la respuesta se pierde y la canción queda en la nube; `discardSaved` solo cubre el caso en que el cliente sí recibió la respuesta (`cancel.ts:21-23`).
- **«Seleccionar» en carpetas:** solo aparece si hay playlists sueltas (`views/PlaylistsView.tsx:91-97`); `FolderView.tsx` no tiene botón (solo pulsación larga).
- **Selección de playlists:** se limpia en `App.tsx:310-316` al cambiar `location`, pero el botón Atrás de Android no la cierra (`native/shell.ts:38`) y la barra no comprueba en qué pantalla empezó (`components/PlaylistSelectionBar.tsx:14-16`). SUPUESTO (VERIFICAR al reproducir): la barra queda viva en algún paso entre pantallas.
- **Ordenar sin teclado:** `SortMenu.tsx:56-73` no mueve el foco al abrir, no responde a flechas ni devuelve el foco al botón.
- **Euskera:** textos con «playlist» en `i18n/eu.ts:671-672` y en módulos y artículos de ayuda; la mayoría usa «zerrenda».
- **`stores/library.ts` (557 líneas):** ninguna tarea de v0.9.4 necesita tocarlo, así que no se parte ahora (queda en riesgos).

## Decisiones de arquitectura

- **Salto remoto sin quitar el control al anfitrión:** el invitado envía `{ type: 'skip', itemId }`; el servidor solo apunta `skipRequested = itemId` y lo difunde. Quien ejecuta el salto es el móvil del anfitrión con su `skip()` de siempre (que envía `start` o `finish`), así la descarga y el reproductor siguen en un solo sitio. `start` y `finish` borran `skipRequested`.
- **Dos pulsan a la vez:** si `itemId` no es lo que suena o ya está pedido, se ignora sin error ni difusión; el anfitrión recuerda el último `itemId` atendido y nunca salta dos veces la misma.
- **Límite 1 cada 2 s por persona** en el servidor (`lastSkipAt` en el adjunto del socket; si se pasa, se ignora en silencio) y en el cliente (botón bloqueado 2 s).
- **Compatibilidad:** `hello.features = ['remoteSkip']` (opcional). La instantánea gana `canSkip` (hay un anfitrión conectado que lo anunció) y `skipRequested`. Anfitrión v0.9.3 → error `host_outdated`; sin anfitrión conectado → `host_away`. Hub viejo → `canSkip` llega `undefined` = no se puede. Invitados v0.9.3 no cambian.
- **Barra de la Jam:** se dibuja en el hueco del mini reproductor (y de la barra de escritorio) cuando eres invitado, la Jam está abierta, suena algo en ella y tu reproductor no está sonando.
- **Fotos en D1:** tabla `group_photos` (BLOB ≤ 100 KB, JPEG 256 px) y `groups.photo_at` como versión; cambio = sobrescribir (gana el último). Sin R2: el hub no guarda música ni ficheros grandes.
- **Acceso a la foto:** `GET /groups/:id/photo` solo miembros (cabecera `X-Device-Key`); vista previa con código por **POST** (`/groups/peek` y `/groups/peek/photo`, el código va en el cuerpo, nunca en la URL ni en registros). Código renovado = el viejo deja de servir. Expulsados → `kicked`.
- **Validación en el servidor:** nombre con `sanitizeGroupName`; foto con `Content-Type: image/jpeg`, tamaño ≤ 100 KB (mirando `Content-Length` antes de leer y el tamaño real después) y firma JPEG (`FF D8 FF` al principio y `FF D9` al final).
- **Tarjetas de la lista:** `GET /groups?month=YYYY-MM` (mes local del móvil; un hub viejo ignora el parámetro) añade a cada `GroupSummary` dos campos **opcionales**: `people` (alias de los 4 miembros más antiguos) y `month` (minutos, cuántos comparten y quién más escucha). Se calculan con `statsForGroup`, así que solo cuentan quienes comparten sus escuchas, igual que en el detalle; no se expone nada que un miembro no vea ya dentro del grupo. Mes inválido o fuera de rango → mes UTC actual. Clientes viejos ignoran los campos nuevos; un cliente nuevo con hub viejo recibe `undefined` y la tarjeta se dibuja sin pila ni resumen.
- **Texto del mes en la tarjeta:** «Este mes» en lugar del nombre del mes, porque en euskera «azaroan» necesita declinación y `Intl` no la da.
- **Rutas nuevas en su propio archivo** (`groups/lookRoutes.ts`), montadas antes de `/:id` en `routes.ts`.
- **Cliente:** caché en memoria de URLs `blob:` por `groupId` + `photoAt` (la CSP ya permite `blob:` en `img-src`, `apps/web/public/_headers:2`). Borradores de «Nombre y foto» en un store propio para reintentar.
- **Textos:** módulos i18n nuevos `jamRemote.ts`, `groupList.ts` y `groupLook.ts`, creados y registrados en T1; después cada uno lo amplía solo su tarea dueña. CSS en archivos propios.
- **Huérfanos al cancelar:** tras cancelar un `saving` en Cloudflare o Drive, se recarga la biblioteca a los 5 s y a los 60 s y se borra la canción nueva de ese `videoId` que no estaba antes (sin depender de relojes).
- **Dos fases** (2A con 6 tareas, 2B con 3) para no pasar de 7 por fase. Se publica todo junto.
- **Despliegue:** migración D1 del hub `0005`; la API de cada amigo (`apps/api`) no cambia.

## Contratos (interfaces compartidas)

### Hub: Jam (T2 escribe; T4 usa)

```ts
// packages/shared/src/hub.ts
HUB_LIMITS.jamSkipEveryMs = 2000;
export const JAM_FEATURES = ['remoteSkip'] as const;
export type JamFeature = (typeof JAM_FEATURES)[number];
// JamClientMessage
| { type: 'hello'; memberId: string; nickname: string; hostKey?: string; features?: JamFeature[] }
| { type: 'skip'; itemId: string } // anyone: asks the host's phone to skip that song
// JamSnapshot (both optional: an old hub does not send them)
canSkip?: boolean;            // a connected host announced 'remoteSkip'
skipRequested?: string | null; // itemId waiting for the host to skip
// HubErrorCode += 'host_outdated' | 'host_away'
```

```ts
// apps/hub/src/jam/protocol.ts: hello.features = z.array(z.string().max(32)).max(8).optional()
//   (unknown names are dropped), new message 'skip' with itemId.
// apps/hub/src/jam/state.ts
JamData.skipRequested?: string | null;          // cleared by 'start' and 'finish'
export type HostReadiness = 'ready' | 'outdated' | 'away';
export type SkipResult = { data: JamData } | { error: HubErrorCode } | { ignored: true };
export function requestSkip(data: JamData, itemId: string,
  ctx: { now: number; lastSkipAt?: number; host: HostReadiness }): SkipResult;
  // host 'outdated' → error host_outdated; 'away' → error host_away;
  // now - lastSkipAt < jamSkipEveryMs → ignored; nowPlaying?.id !== itemId → ignored;
  // skipRequested === itemId → ignored; otherwise data with skipRequested = itemId.
export function toSnapshot(data: JamData, members: JamMember[], viewerId: string,
  canSkip: boolean): JamSnapshot;
// apps/hub/src/jam/room.ts: attachment = JamMember & { features?: JamFeature[]; lastSkipAt?: number };
//   `you` and `members` only expose { memberId, nickname, isHost } / { nickname, isHost }.
```

### Web: Jam (T4)

```ts
// apps/web/src/hub/jamRemote.ts (pure + one hook)
export type SkipAvailability = 'ok' | 'outdated' | 'away' | 'nothing';
export function skipAvailability(snapshot: JamSnapshot | null): SkipAvailability;
  // nothing: no nowPlaying; ok: canSkip === true; outdated: a host is in members; else away
export function hostSkipTarget(snapshot: JamSnapshot, lastHandled: string | null): string | null;
  // skipRequested && skipRequested === nowPlaying?.id && !== lastHandled
export function jamBarVisible(s: { role?: 'host' | 'guest'; connection: JamConnection;
  snapshot: JamSnapshot | null; playerPlaying: boolean }): boolean;
  // guest && connection === 'open' && snapshot?.nowPlaying && !playerPlaying
export function useJamBarVisible(): boolean;
// apps/web/src/stores/jam.ts → JamState
skipLocked: boolean;          // true for jamSkipEveryMs after a skip request
requestSkip(): void;          // host → skip(); guest with availability 'ok' → send skip
// hello always carries features: ['remoteSkip']; on 'state', if host and hostSkipTarget(...)
// returns an id, remember it and call skip().
// apps/web/src/components/jam/JamBar.tsx
export function JamBar(props: { variant: 'mini' | 'desktop' }): JSX.Element | null;
```

### Hub: Grupos (T3 escribe; T5 usa)

```sql
-- apps/hub/migrations/0005_group_photos.sql
ALTER TABLE groups ADD COLUMN photo_at INTEGER;
CREATE TABLE group_photos (group_id TEXT PRIMARY KEY, data BLOB NOT NULL, updated_at INTEGER NOT NULL);
```

```ts
// packages/shared/src/groups.ts
GROUP_LIMITS.photoMaxBytes = 100 * 1024; GROUP_LIMITS.photoSide = 256;
GROUP_LIMITS.editsPerHour = 20; GROUP_LIMITS.peekPer10Min = 30;
GroupSummary.photoAt: number | null;  GroupDetail.photoAt: number | null;
GROUP_LIMITS.cardPeople = 4;
export interface GroupCardMonth {
  month: string;          // 'YYYY-MM' actually used
  minutes: number;        // sum of the sharing members (rounded)
  sharing: number;        // members with stats that month
  topAlias: string | null; // most minutes (> 0); tie → who joined first; null if nobody
}
// GroupSummary (optional: an old hub does not send them)
people?: string[];        // aliases, oldest member first, at most cardPeople
month?: GroupCardMonth;
// apps/hub/src/groups/service.ts
export function cardMonth(rows: Array<{ memberId: string; alias: string; statsJson: string }>,
  month: string): GroupCardMonth; // pure; invalid statsJson rows are skipped (sanitizeMonthStats)
export function listSummaries(repo: GroupRepo, deviceHash: string, month: string): Promise<GroupSummary[]>;
export interface GroupPreview { name: string; members: number; photoAt: number | null }
export function isJpeg(bytes: Uint8Array): boolean; // FF D8 FF ... FF D9
// apps/hub/src/groups/repo.ts → GroupRow.photoAt: number | null; GroupRepo +=
renameGroup(groupId: string, name: string, now: number): Promise<void>; // also last_active_at
putPhoto(groupId: string, data: Uint8Array, now: number): Promise<void>; // upsert + photo_at = now
getPhoto(groupId: string): Promise<Uint8Array | null>; // normalise: new Uint8Array(row.data)
deletePhoto(groupId: string, now: number): Promise<void>; // photo_at = NULL
// deleteGroup and cleanupGroups also delete group_photos.
```

| Método y ruta (`/hub/v1/groups`) | Quién                 | Cuerpo / respuesta                                                         | Límite                        |
| -------------------------------- | --------------------- | -------------------------------------------------------------------------- | ----------------------------- |
| `GET /?month=YYYY-MM`            | el propio dispositivo | `{ groups: GroupSummary[] }` con `photoAt`, `people` y `month`             | `group_read` (sin cambios)    |
| `PUT /:id/name`                  | miembro               | `{ name }` → `GroupDetail`                                                 | `group_edit:<id>` 20/h        |
| `PUT /:id/photo`                 | miembro               | `image/jpeg` ≤ 100 KB → `{ photoAt }`; 413 si es grande, 400 si no es JPEG | `group_edit:<id>` 20/h        |
| `DELETE /:id/photo`              | miembro               | → 204                                                                      | `group_edit:<id>` 20/h        |
| `GET /:id/photo`                 | miembro               | `image/jpeg`, `Cache-Control: private, max-age=86400`; 404 `not_found`     | `group_read`                  |
| `POST /peek`                     | cualquiera con código | `{ code }` → `GroupPreview`; 404 `group_not_found`; 403 `kicked`           | `group_peek` 30/10 min por IP |
| `POST /peek/photo`               | cualquiera con código | `{ code }` → `image/jpeg`; 404 `not_found` si no hay foto                  | `group_peek` 30/10 min por IP |

Todas exigen `X-Device-Key` válida. Ninguna devuelve quién cambió algo.

### Web: Grupos (T5 escribe; T7 y T8 usan)

```ts
// apps/web/src/hub/client.ts
interface HubRequest { method?: string; json?: unknown; headers?: Record<string, string>; body?: Blob }
export function hubFetchBlob(path: string, opts?: HubRequest): Promise<Blob | null>; // 404 → null
// apps/web/src/hub/groupsClient.ts
listMyGroups(month?: string): Promise<GroupSummary[]>; // adds ?month= when given
renameGroup(id: string, name: string): Promise<GroupDetail>;
uploadGroupPhoto(id: string, jpeg: Blob): Promise<{ photoAt: number }>;
deleteGroupPhoto(id: string): Promise<void>;
fetchGroupPhoto(id: string): Promise<Blob | null>;
peekGroup(code: string): Promise<GroupPreview>;
fetchInvitePhoto(code: string): Promise<Blob | null>;
// apps/web/src/groups/look.ts (pure)
export function groupInitials(name: string): string; // 'Cuadrilla del pueblo' → 'CP', 'Viajes' → 'VI'
export function personInitials(alias: string): string; // 'leire' → 'Le' (2 first letters, emoji-safe)
export function cardMoreCount(members: number, shown: number): number; // '+N' bubble, 0 = none
export function preparePhoto(file: Blob): Promise<Blob | null>; // squareJpeg(file, 256); null if > photoMaxBytes
export function isOfflineError(err: unknown): boolean; // !navigator.onLine or HubError 'network'
// apps/web/src/groups/photoCache.ts
export function useGroupPhotoUrl(src: { groupId?: string; inviteCode?: string; photoAt: number | null }): string | null;
export function forgetGroupPhoto(groupId: string): void; // revokes the blob: URL
// apps/web/src/components/groups/GroupPhoto.tsx
export function GroupPhoto(props: { name: string; photoAt: number | null; groupId?: string;
  inviteCode?: string; size: number }): JSX.Element; // <img> or initials; alt groups.photo.alt
// apps/web/src/stores/groupEdit.ts
export interface LookDraft { name: string; photo?: Blob | 'remove' } // undefined = unchanged
export type SaveLookResult = { ok: true; name: string; photoAt: number | null } | { ok: false; message: string };
interface GroupEditState {
  drafts: Record<string, LookDraft>; saving: string | null;
  save(groupId: string, draft: LookDraft, current: { name: string; photoAt: number | null }): Promise<SaveLookResult>;
  discard(groupId: string): void;
}
// apps/web/src/stores/groups.ts
patchSummary(id: string, patch: Partial<Pick<GroupSummary, 'name' | 'photoAt'>>): void;
// refresh() asks for the phone's current local month: monthKeyOfPeriod(currentPeriod('month', now))
```

`save`: primero el nombre (si cambió) y después la foto (subir o quitar). Si algo falla, en
`drafts[groupId]` queda solo lo que falta por guardar y el mensaje es `groups.look.offline` (sin
conexión) o el de `hubErrorText` (si no, `groups.look.failed`). Si va bien: borra el borrador,
`forgetGroupPhoto`, `patchSummary` y devuelve los datos nuevos.

### Claves i18n nuevas (T1 las escribe en es, en y eu; aquí en español)

`i18n/jamRemote.ts` (`jamRemoteEn/Es/Eu`; después dueño T4):

- `jam.bar.playingOn` «Suena en el móvil de {name}» · `jam.bar.open` «Abrir la Jam»
- `jam.bar.label` «Canción de la Jam. Desliza a la izquierda para saltarla o toca para abrir la Jam»
- `jam.skip.label` «Saltar esta canción» (el botón usa la clave existente `jam.next`)
- `jam.skip.guestHint` «Cualquiera de la Jam puede saltar la canción que suena. Solo se oye en el móvil de {name}.»
- `jam.skip.outdated` y `hub.err.host_outdated` «Quien creó la Jam tiene que actualizar la app para que podáis saltar canciones.»
- `jam.skip.away` y `hub.err.host_away` «Quien creó la Jam no está conectado ahora mismo. Cuando vuelva, podréis saltar canciones.»

`i18n/groupList.ts` (`groupListEn/Es/Eu`; después dueño T7):

- `groups.tiles.create` «Crear un grupo» · `groups.tiles.createHint` «E invita a tus amigos»
- `groups.tiles.join` «Entrar con un código» · `groups.tiles.joinHintScan` «O escanea el código QR» · `groups.tiles.joinHint` «Escribe el código que te ha pasado tu amigo»
- `groups.photo.alt` «Foto del grupo «{name}»»
- `groups.join.checking` «Buscando el grupo…» · `groups.join.preview` «Vas a entrar en este grupo:»
- `groups.join.notFound` «No hay ningún grupo con ese código. Revisa que esté bien escrito o pide a tu amigo uno nuevo.»
- `groups.create.photoHint` «Cuando lo hayas creado podrás ponerle una foto en «Nombre y foto».»
- `groups.card.month` «Este mes:» · `groups.card.minutes` «{count} minutos» · `.one` «1 minuto»
- `groups.card.top` «Quien más escucha: {name}»
- `groups.card.nobody` «Este mes todavía nadie ha compartido lo que escucha.»
- `groups.card.more` «+{count}» · `groups.card.peopleLabel` «Personas del grupo: {names}»

`i18n/groupLook.ts` (`groupLookEn/Es/Eu`; después dueño T8):

- `groups.look.button` / `groups.look.title` «Nombre y foto» · `groups.look.text` «Cualquier persona del grupo puede cambiarlos.»
- `groups.look.pick` «Elegir otra foto» · `groups.look.pickFirst` «Elegir una foto» · `groups.look.remove` «Quitar la foto»
- `groups.look.note` «La foto se recorta sola por el centro. No subas fotos de otras personas sin su permiso.»
- `groups.look.name` «Nombre del grupo» · `groups.look.nameRequired` «Escribe un nombre para el grupo.»
- `groups.look.save` «Guardar cambios» · `groups.look.saving` «Guardando…» · `groups.look.saved` «Cambios guardados»
- `groups.look.offline` «No hay conexión. Lo que has escrito y la foto siguen aquí: pulsa «Guardar cambios» cuando vuelvas a tener internet.»
- `groups.look.failed` «No se han podido guardar los cambios. Lo que has escrito y la foto siguen aquí: prueba otra vez en un momento.»
- `groups.look.badPhoto` «No hemos podido usar esa imagen. Prueba con otra foto.»
- `groups.look.draftRestored` «Hemos recuperado los cambios que no se pudieron guardar.»
- `groups.summary.title` «Resumen del mes» · `groups.summary.minutes` «minutos entre todos»
- `groups.summary.sharing` «{count} de {total}» · `groups.summary.sharingLabel` «comparten lo que escuchan»
- `groups.summary.place` «{n}º» (en «#{n}», eu «{n}.») · `groups.summary.you` «{name} (tú)» · `groups.summary.min` «{count} min»
- `groups.summary.songs` «Canciones del mes» · `groups.summary.times` «{count} veces» · `.one` «1 vez»
- `groups.summary.empty` «Este mes todavía nadie ha compartido lo que escucha.»
- `groups.summary.fullRanking` «Ver todo el ranking» · `groups.summary.eachPerson` «Ver cada persona»
- `groups.section.shared` «Compartido» · `groups.section.people` «Personas»

## Fase 2A (v0.9.4)

### T1 · Textos nuevos y euskera con «zerrenda» · Grupo A · Estado: HECHA

- Archivos (exclusivos): todos los `apps/web/src/i18n/*.ts` (incluidos `jamRemote.ts`, `groupList.ts` y `groupLook.ts`, nuevos), y los textos en euskera que haya fuera de `i18n` y no sean ayuda (comprobar con Grep, p. ej. `apps/web/src/downloads/batch.ts`, `apps/web/src/stores/parcel.ts`)
- Leer como contexto: `apps/web/src/i18n/podcasts.ts` (patrón de módulo), `apps/web/test/i18n.test.ts`
- Qué hacer:
  1. Antes, comprobar con Grep que ninguna clave de «Contratos» existe ya. Crear los 3 módulos con todas las claves en en, es y eu (euskera natural y sencillo) y registrarlos en `en.ts`, `es.ts` y `eu.ts`.
  2. Euskera: cambiar «playlist» por «zerrenda» (con su declinación correcta: zerrenda, zerrendak, zerrendan, zerrendara…) en todos los valores en euskera de `i18n/*.ts`. Las claves (`playlist.*`) no se tocan. La ayuda (`help/articles`) la hace T9.
- TDD: no (lo cubre el test de paridad)
- Criterios de aceptación:
  - [ ] Paridad i18n en verde; las claves de «Contratos» existen en los 3 idiomas.
  - [ ] `Grep -i "playlist"` en los bloques eu de `i18n/*.ts` solo encuentra claves, no textos.
- Verificación: `npx vitest run test/i18n.test.ts --root apps/web` y `npm run check`

### T2 · Hub: salto remoto en la Jam · Grupo A · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/hub.ts`, `apps/hub/src/jam/protocol.ts`, `apps/hub/src/jam/state.ts`, `apps/hub/src/jam/room.ts`, `apps/hub/test/jamProtocol.test.ts`, `apps/hub/test/jamState.test.ts`, `apps/hub/test/jamRoom.test.ts`, `apps/hub/test/fakeRoom.ts`
- Leer como contexto: `apps/web/src/stores/jam.ts:301-314`, `apps/hub/test/jamRoutes.test.ts`
- Qué hacer:
  1. Tipos y límites de «Hub: Jam» en `hub.ts`.
  2. `protocol.ts`: `features` opcional (filtrar a `JAM_FEATURES`) y el mensaje `skip`.
  3. `state.ts`: `requestSkip` exacto según «Contratos»; `startItem` y `finish` dejan `skipRequested = null`; `toSnapshot` con `canSkip` y `skipRequested`.
  4. `room.ts`: guardar `features` en el adjunto en `hello`; en `skip`, calcular `HostReadiness` con los sockets (anfitrión con `remoteSkip` → `ready`; anfitrión sin él → `outdated`; ninguno → `away`), pasar `lastSkipAt` del adjunto y, si se acepta, actualizarlo, guardar y difundir. `ignored` → nada. `you` y `members` sin campos internos.
- TDD: sí
- Criterios de aceptación (tests):
  - [ ] Un invitado pide saltar lo que suena → `skipRequested` = ese id y se difunde.
  - [ ] Dos peticiones con el mismo `itemId` → la segunda se ignora; un `itemId` que no suena se ignora.
  - [ ] Dos peticiones de la misma persona en menos de 2 s → la segunda se ignora; otra persona sí puede.
  - [ ] Anfitrión sin `remoteSkip` → `host_outdated`; sin anfitrión conectado → `host_away`.
  - [ ] `start` y `finish` borran `skipRequested`; `you` no incluye `features` ni `lastSkipAt`.
  - [ ] Un `hello` sin `features` (v0.9.3) sigue funcionando.
- Verificación: `npx vitest run test/jamProtocol.test.ts test/jamState.test.ts test/jamRoom.test.ts --root apps/hub` y `npm run check`

### T3 · Hub: nombre, foto, vista previa y datos de las tarjetas de grupos · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/hub/migrations/0005_group_photos.sql` (nuevo), `packages/shared/src/groups.ts`, `apps/hub/src/groups/repo.ts`, `apps/hub/src/groups/service.ts`, `apps/hub/src/groups/routes.ts`, `apps/hub/src/groups/lookRoutes.ts` (nuevo), `apps/hub/src/groups/cleanup.ts`, `apps/hub/test/memoryGroupRepo.ts`, `apps/hub/test/groupLook.test.ts` (nuevo), `apps/hub/test/d1GroupRepo.test.ts`, `apps/hub/test/groups.test.ts`
- Leer como contexto: `apps/hub/src/groups/auth.ts`, `apps/hub/src/lib/rateLimit.ts`, `apps/hub/src/groups/shareRoutes.ts` (patrón de subrutas), `apps/hub/test/sqliteD1.ts`
- Qué hacer:
  1. Migración, tipos y repo según «Hub: Grupos». `toGroup` mapea `photo_at`; `listSummaries` y `toDetail` devuelven `photoAt`. `deleteGroup` y `cleanupGroups` borran `group_photos`.
  2. `lookRoutes.ts` (`createLookRoutes(repoFor)`) con las 6 rutas de la tabla, montada en `routes.ts` **antes** de `app.get('/:id')`.
     - Límite por grupo: `checkRateLimit(c.env.DB, 'group_edit:' + id, 20, HOUR_MS)` → 429 `rate_limited`.
     - Foto: rechazar `Content-Length` > 100 KB sin leer el cuerpo (413); leer con `arrayBuffer()`, volver a medir y comprobar `isJpeg` (400 `invalid_request`).
     - `peek`: `normalizeInviteCode`; código mal escrito o inexistente → 404 `group_not_found`; dispositivo expulsado → 403 `kicked`. Cuerpo JSON ≤ 2 KB (`readJsonBody`).
     - Respuesta de foto: `Content-Type: image/jpeg` y `Cache-Control: private, max-age=86400`.
  3. Renombrar y cambiar foto tocan `last_active_at`. No se guarda quién lo hizo.
  4. **Tarjetas de la lista:** `GET /` lee `?month=` (si falta o no pasa `isAcceptableMonth`, `utcMonthKey(now)`). `listSummaries(repo, deviceHash, month)` añade a cada grupo `people` (de `listMembers`, como mucho `cardPeople`) y `month` (con `cardMonth` sobre `statsForGroup(group.id, month)`). Como mucho son 10 grupos por dispositivo (`maxGroupsPerDevice`), así que basta con un bucle. Solo entran las escuchas de quien las comparte (las filas de `device_stats`); nunca se cuentan ni se nombran otros.
- TDD: sí
- Criterios de aceptación (tests):
  - [ ] `cardMonth`: sin filas → `minutes 0`, `sharing 0`, `topAlias null`; empate → el que entró antes; una fila con JSON roto se salta.
  - [ ] `GET /?month=…` devuelve `people` (4 como mucho, del más antiguo al más nuevo) y `month`; un miembro que no comparte aparece en `people` pero no suma minutos ni puede ser `topAlias`; sin `month` en la URL usa el mes UTC actual; un mes inválido no da error.
  - [ ] Un miembro cambia el nombre y la foto; un no miembro recibe 403 `not_member`; el último cambio gana.
  - [ ] Foto de 101 KB → 413; un PNG o datos sin firma JPEG → 400; sin foto → `GET` 404.
  - [ ] `peek` con código válido → `GroupPreview` y foto; con código viejo tras renovar → 404; expulsado → 403.
  - [ ] Borrar el grupo (o la limpieza por inactividad) borra su foto (test con `sqliteD1`).
  - [ ] La 21.ª edición en una hora en el mismo grupo → 429.
- Verificación: `npx vitest run test/groupLook.test.ts test/d1GroupRepo.test.ts test/groups.test.ts --root apps/hub`, `npm run hub:migrate:local` y `npm run check`

### T6 · Arreglos pendientes: huérfanos al cancelar, Ordenar con teclado y selección de playlists · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/downloads/cancel.ts`, `apps/web/src/downloads/orphans.ts` (nuevo), `apps/web/test/downloadOrphans.test.ts` (nuevo), `apps/web/src/components/SortMenu.tsx`, `apps/web/src/lib/menuKeys.ts` (nuevo), `apps/web/test/menuKeys.test.ts` (nuevo), `apps/web/src/views/FolderView.tsx`, `apps/web/src/stores/ui.ts`, `apps/web/src/components/PlaylistSelectionBar.tsx`, `apps/web/src/native/shell.ts`, `apps/web/test/uiSelection.test.ts`
- Leer como contexto: `apps/web/src/downloads/save.ts:153-199`, `apps/web/src/stores/library.ts` (`load`, `deleteTrack`), `apps/web/src/stores/setup.ts`, `apps/web/src/views/PlaylistsView.tsx:91-97`, `apps/web/src/App.tsx:310-316`
- Qué hacer:
  1. **Huérfanos** (`orphans.ts`):
     - `idsForVideo(tracks, videoId): string[]` y `findOrphans(tracks, videoId, knownIds): LocalTrack[]` (puras);
     - `sweepAfterCancel(job, knownIds)`: solo si el hogar es `cloudflare` o `drive`; a los 5 s y a los 60 s recarga la biblioteca y borra con `deleteTrack` las canciones nuevas de ese `videoId`. No hace nada si en ese momento hay otro trabajo activo del mismo `videoId`. Errores: `console.error` y seguir (sin aviso al usuario).
     - En `cancel.ts`, cuando se cancela un `saving`, guardar `knownIds` **antes** de abortar y lanzar `sweepAfterCancel`.
  2. **Ordenar con teclado** (`menuKeys.ts`: `nextMenuIndex(key, index, count): number | 'close' | null` para ArrowDown/ArrowUp con vuelta, Home, End, Escape y Tab): al abrir, foco en la opción marcada; flechas mueven el foco; Enter/Espacio eligen (botones); Escape o Tab cierran y devuelven el foco al botón; `tabIndex` -1 en las opciones salvo la activa.
  3. **«Seleccionar» en carpetas:** botón igual que `PlaylistsView.tsx:91-97` (clase `playlists-select-row`) en `FolderView` cuando la carpeta tiene playlists.
  4. **Selección de playlists ligada a su pantalla:**
     - `ui.ts`: `playlistSelectionPath: string | null`, que se guarda en `startPlaylistSelection` (`location.pathname`); `setPlaylistVisibleIds` quita de la selección lo que ya no se ve.
     - `PlaylistSelectionBar`: si la ruta actual no es `playlistSelectionPath`, llama a `endPlaylistSelection` y no se dibuja.
     - `shell.ts`: Atrás cierra la selección de playlists antes de navegar.
     - Reproducir primero el fallo y anotar la causa real en el informe.
- TDD: sí (`orphans`, `menuKeys`, selección en `ui.ts`); `FolderView` manual
- Criterios de aceptación:
  - [ ] Tests: cancelar en `saving` con Cloudflare y la canción apareciendo después en la nube → se borra; si ya estaba antes (mismo `videoId`), no se borra; con hogar `device`, no se recarga nada.
  - [ ] Tests de `nextMenuIndex` (vuelta arriba y abajo, Home, End, Escape, Tab).
  - [ ] Test: empezar la selección en `/playlists` y cambiar la ruta → la selección termina; `setPlaylistVisibleIds` recorta la selección.
  - [ ] Manual: «Seleccionar» dentro de una carpeta; Ordenar se usa solo con teclado.
- Verificación: `npx vitest run test/downloadOrphans.test.ts test/menuKeys.test.ts test/uiSelection.test.ts test/downloadsStore.test.ts --root apps/web` y `npm run check`

### T4 · Web: Jam como mando a distancia y barra de la Jam · Grupo B · Estado: HECHA

- Depende de: T1 (claves), T2 (tipos de `hub.ts`)
- Archivos (exclusivos): `apps/web/src/hub/jamRemote.ts` (nuevo), `apps/web/test/jamRemote.test.ts` (nuevo), `apps/web/src/stores/jam.ts`, `apps/web/test/jamStore.test.ts`, `apps/web/src/components/jam/JamBar.tsx` (nuevo), `apps/web/src/components/jam/JamRoom.tsx`, `apps/web/src/components/player/MiniPlayer.tsx`, `apps/web/src/App.tsx`, `apps/web/src/jamRemote.css` (nuevo), `apps/web/src/i18n/jamRemote.ts`
- Leer como contexto: `apps/web/src/hub/jamSocket.ts`, `apps/web/src/hub/jamFromLibrary.ts`, `apps/web/src/lib/swipe.ts`, `apps/web/src/components/SongThumb.tsx`, `apps/web/src/gestures.css`
- Qué hacer:
  1. `jamRemote.ts` según «Web: Jam».
  2. `jam.ts`:
     - `hello` con `features: ['remoteSkip']`;
     - `requestSkip()`: si `skipLocked`, nada; anfitrión → `skip()`; invitado con `skipAvailability === 'ok'` → `socket.send({ type: 'skip', itemId: nowPlaying.id })`. En los dos casos, `skipLocked = true` durante `HUB_LIMITS.jamSkipEveryMs`;
     - en cada `state`, si eres anfitrión y `hostSkipTarget(snapshot, lastHandledSkip)` da un id: guardarlo en `lastHandledSkip` y llamar a `skip()` (después de `set`, antes de `hostTick`);
     - el error `host_outdated`/`host_away` se guarda en `error` como los demás.
  3. `JamBar` (variante `mini` en el hueco del mini reproductor y `desktop` en el de `PlayerBar`): `SongThumb` 46 px, título, `jam.bar.playingOn` con `snapshot.hostName`, botón Saltar (`jam.next`, `aria-label` `jam.skip.label`, desactivado con `skipLocked` o si no está disponible). Tocar la barra abre `/jam`. Deslizar a la izquierda (`swipeDecision`) → `requestSkip()` y vibra 15 ms; a la derecha no hace nada.
  4. `MiniPlayer.tsx`: `MiniPlayer` y `PlayerBar` devuelven `<JamBar …/>` cuando `useJamBarVisible()`. `App.tsx`: `hasPlayer` también es verdadero con la barra visible.
  5. `JamRoom.tsx`: Saltar para todos con `requestSkip()`; si no está disponible, botón desactivado y debajo `jam.skip.outdated` o `jam.skip.away`; para invitados, `jam.skip.guestHint`. Sin confirmación y sin aviso al saltar.
- TDD: sí (`jamRemote`, `requestSkip`, salto del anfitrión); la barra, manual
- Criterios de aceptación:
  - [ ] Tests: `skipAvailability` para `ok`, `outdated`, `away`, `nothing` y hub viejo (`canSkip` ausente).
  - [ ] Test: el anfitrión recibe `skipRequested` = lo que suena → llama a `skip()` una sola vez aunque lleguen dos `state` iguales.
  - [ ] Test: el invitado envía `skip` con el id que suena; un segundo `requestSkip` antes de 2 s no envía nada.
  - [ ] Test: `jamBarVisible` falso para el anfitrión, sin Jam abierta, sin canción o con el reproductor sonando.
  - [ ] Manual (dos móviles o `--mode fakenative` + navegador): el invitado salta desde la barra y desde la pantalla de la Jam; la canción cambia en el móvil del anfitrión.
- Verificación: `npx vitest run test/jamRemote.test.ts test/jamStore.test.ts test/jamSocket.test.ts --root apps/web` y `npm run check`

### T5 · Web: datos de grupos (cliente, foto, borradores) · Grupo B · Estado: HECHA

- Depende de: T1, T3 (tipos de `groups.ts`)
- Archivos (exclusivos): `apps/web/src/hub/client.ts`, `apps/web/src/hub/groupsClient.ts`, `apps/web/test/hubClient.test.ts`, `apps/web/src/groups/look.ts` (nuevo), `apps/web/src/groups/photoCache.ts` (nuevo), `apps/web/src/stores/groupEdit.ts` (nuevo), `apps/web/src/stores/groups.ts`, `apps/web/src/components/groups/GroupPhoto.tsx` (nuevo), `apps/web/test/groupLook.test.ts` (nuevo), `apps/web/test/groupEditStore.test.ts` (nuevo), `apps/web/test/groupsStore.test.ts`, `apps/web/test/groupsSync.test.ts` (añadir `photoAt` a los datos de prueba)
- Leer como contexto: `apps/web/src/lib/cover.ts`, `apps/web/src/hub/errors.ts`, `apps/web/src/groups/deviceKey.ts`, `apps/web/src/groups/snapshot.ts` (`monthKeyOfPeriod`), `apps/web/src/stats/recap.ts` (`currentPeriod`)
- Qué hacer:
  1. `hubFetch` acepta `body: Blob` (pone `Content-Type` del blob) y `hubFetchBlob` (404 → `null`; otros errores como `hubFetch`).
  2. Funciones de `groupsClient.ts`, `look.ts`, `photoCache.ts`, `GroupPhoto`, `groupEdit.ts` y `patchSummary` exactamente según «Web: Grupos».
     - `photoCache`: una URL por `groupId` (o por código) y `photoAt`; si cambia `photoAt`, revoca la anterior; `photoAt === null` → `null` sin pedir nada.
     - `GroupPhoto`: cuadrado redondeado, `object-fit: cover`, iniciales sobre fondo ámbar oscuro si no hay foto o falla la carga (estilos en línea mínimos o clase `group-photo` que T7 define en `groups.css`).
  3. `listMyGroups(month)` y `refresh()` con el mes local actual. `personInitials` y `cardMoreCount` en `look.ts`.
- TDD: sí
- Criterios de aceptación (tests):
  - [ ] `refresh()` pide `/groups?month=<mes local>`; con una respuesta sin `people` ni `month` (hub viejo), `groups` se guarda igual.
  - [ ] `personInitials`: «leire» → «Le», emoji y alias de 1 letra; `cardMoreCount(5, 4)` → 1 y `cardMoreCount(3, 3)` → 0.
  - [ ] `groupInitials`: dos palabras, una palabra, espacios de más, emoji.
  - [ ] `save` con nombre y foto → llama a `renameGroup` y a `uploadGroupPhoto`; con `'remove'` → `deleteGroupPhoto`.
  - [ ] Sin conexión → `ok: false`, `groups.look.offline` y el borrador conserva nombre y foto; si falla solo la foto, el borrador conserva solo la foto.
  - [ ] Tras guardar, `useGroups.groups` tiene el nombre y `photoAt` nuevos.
  - [ ] `hubFetchBlob` devuelve `null` con 404 y lanza `HubError` con 500.
- Verificación: `npx vitest run test/groupLook.test.ts test/groupEditStore.test.ts test/groupsStore.test.ts test/hubClient.test.ts --root apps/web` y `npm run check`

## Fase 2B (v0.9.4, después de 2A)

### T7 · Grupos (boceto A): lista con tarjetas y hojas de crear y unirse · Grupo C · Estado: HECHA

- Depende de: T1, T5
- Archivos (exclusivos): `apps/web/src/views/GroupsView.tsx`, `apps/web/src/components/groups/CreateGroupSheet.tsx`, `apps/web/src/components/groups/JoinGroupSheet.tsx`, `apps/web/src/groups.css`, `apps/web/src/i18n/groupList.ts`
- Leer como contexto: `docs/plan/bocetos/grupos.html` (opción A, «A · 1»; el archivo es enorme: leer a partir de `<body>`, líneas ~648-906, y los estilos `.tiles`, `.tile`, `.card`, `.avatar` con Grep), `apps/web/src/components/groups/GroupPhoto.tsx`, `apps/web/src/hub/groupsClient.ts`, `apps/web/src/components/groups/AliasField.tsx`
- Qué hacer:
  1. `GroupsView`: cabecera «Grupos de amigos» con ayuda; dos baldosas grandes (`groups.tiles.*`; en la web sin escáner, `joinHint`). Una tarjeta por grupo, como «A · 1»:
     - línea principal: `GroupPhoto` 56 px, nombre, `groups.people` (+ ` · groups.owner`), la pila de iniciales (`personInitials` de `people`, burbuja `groups.card.more` con `cardMoreCount`, `aria-label` `groups.card.peopleLabel`) y la flecha;
     - debajo, resumen: si `month.sharing > 0` y `month.minutes > 0`, «Este mes:» + minutos (`toLocaleString` del idioma) + «Quien más escucha: X»; si no, `groups.card.nobody`;
     - sin `people` o sin `month` (hub viejo) no se dibuja esa parte. Se mantienen consejo, carga, vacío y nota de Ajustes.
  2. `CreateGroupSheet` y `JoinGroupSheet` con el mismo estilo (título grande, texto de ayuda, campos anchos, botón principal ancho). Crear muestra `groups.create.photoHint`.
  3. `JoinGroupSheet`: con un código válido (`parseGroupInput`), a los 400 ms `peekGroup` → tarjeta «Vas a entrar en este grupo:» con `GroupPhoto` (`inviteCode`), nombre y personas; `groups.join.checking` mientras busca; 404 → `groups.join.notFound`; otros errores con `hubErrorText`. Si la vista previa falla, se puede unir igualmente.
  4. CSS en `groups.css` (paleta ámbar, sin temas nuevos), incluida la clase `group-photo`.
- TDD: no
- Criterios de aceptación:
  - [ ] Se parece a «A · 1» a 390 px: tarjetas con foto o iniciales, pila de personas y resumen del mes (o «todavía nadie ha compartido»); las baldosas abren las hojas.
  - [ ] Con un hub sin los campos nuevos, la lista se ve sin la pila ni el resumen y sin errores.
  - [ ] Con un código válido se ve la foto y el nombre antes de unirse; con uno inventado, el aviso claro.
- Verificación: `npm run check` y prueba manual en `npm run dev` a 390 px

### T8 · Grupos (boceto A): detalle, resumen del mes y «Nombre y foto» · Grupo C · Estado: HECHA

- Depende de: T1, T5
- Archivos (exclusivos): `apps/web/src/views/GroupView.tsx`, `apps/web/src/components/groups/GroupHero.tsx` (nuevo), `apps/web/src/components/groups/MonthSummary.tsx` (nuevo), `apps/web/src/components/groups/GroupLookSheet.tsx` (nuevo), `apps/web/src/components/groups/GroupMembers.tsx`, `apps/web/src/components/groups/GroupShares.tsx`, `apps/web/src/groups/summary.ts` (nuevo), `apps/web/test/groupSummary.test.ts` (nuevo), `apps/web/src/groupDetail.css` (nuevo), `apps/web/src/i18n/groupLook.ts`
- Leer como contexto: `docs/plan/bocetos/grupos.html` («A · 2» líneas ~907-1202 y la hoja «Nombre y foto» ~1290-1366), `apps/web/src/stores/groupEdit.ts`, `apps/web/src/groups/look.ts`, `apps/web/src/components/groups/GroupRanking.tsx`, `apps/web/src/components/groups/MemberTops.tsx`, `apps/web/src/components/groups/InviteSheet.tsx`
- Qué hacer:
  1. `summary.ts` (pura): `monthSummary(stats, totalMembers, youId)` → `{ minutes, sharing, total, podium: [{ alias, minutes, place, isYou }] (hasta 3), topTracks (3) }`.
  2. `GroupHero`: `GroupPhoto` grande (96 px), nombre, iniciales de los miembros (hasta 5 y «+N»), botones «Invitar» (abre `InviteSheet`) y «Nombre y foto».
  3. `MonthSummary`: el selector de mes que ya existe, las dos cifras, el podio (2º-1º-3º) y «Canciones del mes»; «Ver todo el ranking» y «Ver cada persona» abren una hoja con `GroupRanking` o `MemberTops`. Mantener `SharingNotice` y los avisos de carga y error.
  4. Orden de `GroupView`: cabecera con volver y ayuda → héroe → resumen → «Compartido» (`GroupShares`) → «Personas» (`GroupMembers`) → «Salir del grupo». En `GroupShares` y `GroupMembers` solo títulos de sección y clases; sin cambiar su lógica.
  5. `GroupLookSheet`:
     - foto grande, «Elegir otra foto» (`<input type="file" accept="image/*">`, sin `capture`) y «Quitar la foto»; nombre; «Guardar cambios» y «Cancelar»;
     - la foto elegida pasa por `preparePhoto` y se ve al momento; si falla, `groups.look.badPhoto`;
     - al guardar, `useGroupEdit.save`; con error, el mensaje se muestra en la hoja, que sigue abierta con todo lo escrito;
     - si existe `drafts[groupId]` al abrir, se rellena con él y se avisa con `groups.look.draftRestored`;
     - si va bien, `toast(groups.look.saved)`, se cierra y `GroupView` actualiza nombre y `photoAt`.
- TDD: sí (`summary.ts`); el resto, manual
- Criterios de aceptación:
  - [ ] Tests de `monthSummary`: sin datos, 1 persona, empate, «(tú)» marcado.
  - [ ] Se parece a «A · 2» y a la hoja «Nombre y foto»; otro miembro (no el creador) cambia nombre y foto.
  - [ ] En modo avión, guardar avisa y conserva todo; al volver la conexión, «Guardar cambios» funciona.
- Verificación: `npx vitest run test/groupSummary.test.ts --root apps/web`, `npm run check` y prueba manual con dos dispositivos (o dos navegadores)

### T9 · Ayuda, documentación, notas y versión 0.9.4 · Grupo D · Estado: HECHA

- Depende de: T1-T8
- Archivos (exclusivos): `apps/web/src/help/articles/*.ts`, `docs/ESTADO.md`, `docs/v2/architecture.md`, `docs/hub.md`, `docs/PRIVACY.md`, `docs/releases/v0.9.4.md` (nuevo), los 7 `package.json` (raíz, `apps/web`, `apps/api`, `apps/hub`, `apps/mobile`, `packages/shared`, `tools/ingest`) y `package-lock.json`
- Leer como contexto: `apps/web/test/help.test.ts`, `docs/releases/v0.9.3.md`, este plan
- Qué hacer (eu/es/en, lenguaje sencillo):
  1. `friends.ts` («jam»): todos pueden saltar, sin aviso, 1 cada 2 s; solo suena en el móvil de quien la creó; la barra de la Jam; qué hacer si sale «tiene que actualizar la app».
  2. `groups.ts`: «Nombre y foto» (cualquiera del grupo, no se dice quién lo cambió), la foto se recorta sola, quién la ve (el grupo y quien tenga un código de invitación válido), dónde se guarda y cuánto dura (en el Hub, hasta que se quita, se borra el grupo o pasan 180 días sin actividad), «no subas fotos de otras personas sin su permiso» y la vista previa al unirse. Explicar también que la tarjeta de cada grupo muestra los minutos del mes y quién más escucha, contando **solo** a quien comparte sus escuchas, y cómo dejar de compartir (Ajustes → Grupos).
  3. Euskera de la ayuda: «playlist» → «zerrenda» en todos los artículos.
  4. `PRIVACY.md` (foto de grupo; los minutos del mes y «quien más escucha» en la lista salen solo de quien comparte) y `hub.md` (rutas nuevas, `?month=` en la lista, `skip`, `features`, migración 0005).
  5. `ESTADO.md` y tabla de fases (v0.9.4), `docs/releases/v0.9.4.md`.
  6. Versión 0.9.4 en los 7 `package.json` y en las 8 entradas de `package-lock.json` (con node, no con sed).
- TDD: no
- Criterios de aceptación:
  - [ ] `help.test.ts` pasa (enlaces válidos, 3 idiomas); `ESTADO.md` al día; versión 0.9.4 en todos los sitios.
- Verificación: `npm run check` y después `npm run test:e2e` (cerrar wrangler/workerd colgados)

## Paso final del orquestador (tras aprobar la revisión, sin volver a preguntar)

1. `npm run check` y `npm run test:e2e` en verde.
2. `npm run hub:migrate:remote` (migración `0005_group_photos.sql`).
3. `npm run deploy:hub` (antes que la web: así ningún cliente nuevo habla con un hub viejo).
4. `npm run deploy` (la API de los amigos no tiene migraciones nuevas: no hace falta `db:migrate:remote`).
5. Commits en Conventional Commits con el autor de Andoni y sin menciones a Claude; `git push`.
6. Tag `v0.9.4` y `git push` del tag: CI construye y publica los APK.

## Fase 3 (v0.9.5) · YouTube más cómodo (borrador; se detalla al empezar)

- **«Compartir → Aske Stream»:** `intent-filter` `ACTION_SEND` `text/plain` (`AndroidManifest.xml:21-24`) más Java, y `useDownloads.enqueueUrl` (`stores/downloads.ts`). VERIFICAR si `@capacitor/app` entrega `ACTION_SEND`; si no, plugin propio en `AskeNative`.
- **«Cargar más»** con la continuación de InnerTube (API no oficial; puede romperse).
- **Términos de uso:** el riesgo es el mismo que ya tiene la descarga actual.

## Riesgos / dudas abiertas

- **Sin dudas abiertas para v0.9.4** (plan aprobado; «zerrenda» confirmado).
- **Coste de la lista:** `GET /groups` hace ahora 2 consultas por grupo (como mucho 10 grupos, es decir 20 consultas D1). Es asumible en el plan gratuito; si se notara lento, se juntaría en una sola consulta con `IN (...)`.
- **Mes local frente a UTC:** las escuchas se guardan por mes local del móvil y la tarjeta pide ese mes; en los primeros o últimos minutos del mes, dos amigos en husos distintos pueden ver meses diferentes (igual que hoy en el detalle).
- **Cliente nuevo con hub viejo:** solo pasa si se publica la web antes que el hub; el orden del paso final lo evita, y aun así la lista se ve sin la pila ni el resumen.
- **VERIFICAR:** cómo devuelve D1 una columna BLOB (`ArrayBuffer` o lista de números); `getPhoto` normaliza con `new Uint8Array(...)` y lo prueba con `sqliteD1`.
- **VERIFICAR en dos móviles:** salto remoto con anfitrión con la pantalla apagada (el WebSocket puede dormirse); si el anfitrión no recibe el `state`, el salto se hace al reconectar porque `skipRequested` sigue guardado.
- **Huérfanos:** si la subida tarda más de 60 s en completarse en el Worker después de cancelar, la canción puede quedarse; es raro y se puede borrar a mano.
- `stores/library.ts` (557 líneas) sigue pendiente de partir; ninguna tarea de v0.9.4 lo toca.
- Sigue en pie del APK v0.9.3: VERIFICAR memoria con audios de 120-200 MB (WebView) y subidas de 80-95 MB (Worker).

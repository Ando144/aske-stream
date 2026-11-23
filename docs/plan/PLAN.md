# PLAN: Animación de arranque más pausada + F8b grupos de amigos (Hub)

Fecha: 2026-11-23 · Estado: HECHO

## Objetivo

(1) Que la animación de arranque deje ver el logo completo ~0,6 s y salga con un fundido + zoom
suave (~0,5 s), respetando reduced-motion y sin alargar la espera si la app tarda en estar lista.
(2) F8b: grupos de amigos a través del Hub (hasta 20 personas, código/QR de invitación) con
estadísticas del mes compartidas (ranking del grupo y top de cada miembro) y playlists/Jams
compartidas, con consentimiento explícito (RGPD), alias + clave anónima de dispositivo y sin música.

Las dos partes son independientes: **T1 = animación**; **T2-T7 = F8b**.

## Decisiones de arquitectura

### Parte 1 · Animación

- El logo termina de dibujarse a 1,2 s (trazo 0,6 + relleno 0,3 + destello 0,3) → el mínimo pasa
  de 1200 a 1800 ms (1,2 + 0,6 de pausa) y la salida de 300 a 500 ms — es justo lo pedido.
- El pulso empieza a 1,8 s (no a 1,2 s) para que la pausa sea con el logo quieto.
- Si la app no está lista a 1,8 s, sigue el pulso y sale en cuanto lo esté, sin pausa extra.
- Reduced-motion: logo completo desde el principio, mínimo 600 ms y solo fundido de 200 ms sin
  zoom; los tiempos salen de una función pura `splashTimings(reducedMotion)` con test.

### Parte 2 · F8b

- **Un interruptor global** «Compartir mis escuchas con mis grupos» (pref `groups-consent`,
  apagado por defecto) controla **SOLO las estadísticas** (decisión D2). Crear grupos, unirse,
  compartir playlists y Jams funciona con él apagado. Apagarlo borra del Hub tus estadísticas
  (`DELETE /groups/stats`), pero sigues en tus grupos. Para salir de todo y borrar también tu
  pertenencia y alias está «Borrar todos mis datos de grupos» (`DELETE /groups/me`, que además
  genera una clave de dispositivo nueva).
- **Encenderlo enciende también el Recap local (8a)** si estaba apagado (decisión D1). El aviso de
  consentimiento lo dice explícitamente. Apagar el interruptor de grupos **no** apaga el Recap.
  Las escuchas salen del historial local del Recap. Si alguien apaga luego el Recap a mano, no se
  sube nada y la pantalla del grupo lo avisa.
- **Identidad:** el móvil genera una clave aleatoria secreta (`X-Device-Key`, 64 hex). El Hub solo
  guarda su SHA-256 (`device_hash`). En cada grupo el miembro tiene un `memberId` público aleatorio
  y un alias (1-24 caracteres, `normalizeNickname`). Nada de email ni datos reales.
- **Estadísticas por dispositivo y mes**, no por grupo (`device_stats`): una sola subida sirve
  para todos tus grupos; cada grupo solo ve las de sus miembros. **Se guardan 12 meses** (el mes
  UTC actual y los 11 anteriores, decisión D3); lo más viejo lo borra la limpieza. Top 10
  canciones + top 10 artistas + minutos y escuchas por mes.
- **El ranking del grupo lo calcula el Hub** (función pura `buildGroupRanking`), sumando escuchas
  y contando oyentes — así la app no repite la lógica.
- **Expulsar = borrar al miembro y vetar su `device_hash`** en ese grupo (`group_bans`); el
  creador puede renovar el código de invitación.
- Si el creador sale, el grupo pasa al miembro más antiguo; si no queda nadie, se borra entero.
- **Repositorio con interfaz** (`GroupRepo`) en el Hub: D1 en producción y una versión en memoria
  para los tests (el `FakeD1` actual no entiende SQL nuevo y no merece la pena ampliarlo).
- La limpieza de grupos va en `groups/cleanup.ts` aparte (no en `cleanup.ts`, para no romper los
  tests que usan `FakeD1.batch`).
- Compartir playlist en el grupo reutiliza los enlaces de playlist actuales (`/hub/v1/lists`): el
  grupo guarda solo el id del enlace y el nombre. Una Jam se comparte con su código (12 h).
- Sincronización: al arrancar la app y al abrir un grupo, como mucho cada 6 h (forzada al abrir si
  pasaron más de 15 min). La primera vez tras encender el interruptor sube los últimos 12 meses
  del historial local. Después sube el mes actual y, los primeros 7 días del mes, también el
  anterior.
- Enlace/QR de invitación: `HUB_URL/#group=CODIGO` (helpers nuevos en `shared/groups.ts`; NO se
  toca la unión `HubLink` para no romper a quien hace `switch` sobre ella).

## Contratos (interfaces compartidas)

### `packages/shared/src/groups.ts` (export `@aske/shared/groups`)

```ts
export const GROUP_LIMITS = {
  maxMembers: 20,
  maxGroupsPerDevice: 10,
  nameMax: 40,
  groupIdLength: 10, // alfabeto PAIRING_CODE_ALPHABET
  inviteCodeLength: 8, // idem
  memberIdLength: 10,
  shareIdLength: 10,
  topSize: 10,
  maxShares: 50, // se conservan los 50 más nuevos
  inactiveTtlMs: 180 * 24 * 3600 * 1000,
  deviceKeyHexLength: 64,
  statsKeepMonths: 12, // mes UTC actual + 11 anteriores
  statsMaxMonthsPerUpload: 12,
  statsBodyMaxBytes: 64 * 1024,
  syncEveryMs: 6 * 3600 * 1000,
} as const;

export interface GroupMember {
  memberId: string;
  alias: string;
  isOwner: boolean;
  joinedAt: number;
}
export interface GroupSummary {
  id: string;
  name: string;
  members: number;
  isOwner: boolean;
}
export interface GroupDetail {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  you: string; // tu memberId en este grupo
  members: GroupMember[]; // por joinedAt ascendente
}
export interface MonthTopTrack {
  title: string;
  artist: string;
  plays: number;
  minutes: number;
}
export interface MonthTopArtist {
  artist: string;
  plays: number;
  minutes: number;
}
export interface MonthStats {
  month: string; // 'YYYY-MM' (mes local del móvil)
  minutes: number;
  plays: number;
  topTracks: MonthTopTrack[]; // <= topSize
  topArtists: MonthTopArtist[]; // <= topSize
}
export interface MemberMonthStats extends MonthStats {
  memberId: string;
  alias: string;
}
export interface RankedTrack {
  title: string;
  artist: string;
  plays: number;
  listeners: number;
}
export interface RankedArtist {
  artist: string;
  plays: number;
  listeners: number;
}
export interface GroupStats {
  month: string;
  members: MemberMonthStats[]; // solo quien ha subido ese mes; minutos desc
  ranking: { tracks: RankedTrack[]; artists: RankedArtist[] }; // <= topSize cada uno
}
export type GroupShareKind = 'list' | 'jam';
export interface GroupShare {
  id: string;
  kind: GroupShareKind;
  ref: string; // id de lista (10) o código de Jam (6)
  title: string;
  memberId: string;
  alias: string;
  createdAt: number;
  expiresAt: number;
}
export interface StatsUpload {
  months: MonthStats[];
} // 1..statsMaxMonthsPerUpload, sin meses repetidos

export function isMonthKey(s: string): boolean; // /^\d{4}-(0[1-9]|1[0-2])$/
export function utcMonthKey(epochMs: number): string;
export function shiftMonthKey(month: string, delta: number): string; // '2026-01', -1 → '2025-12'
export function oldestKeptMonth(now: number): string; // shiftMonthKey(utcMonthKey(now), -(statsKeepMonths - 1))
export function isAcceptableMonth(month: string, now: number): boolean; // oldestKeptMonth(now) <= month <= mes UTC siguiente (margen de zona horaria)
export function sanitizeMonthStats(raw: unknown): MonthStats | null; // recorta textos (LIMITS), enteros >= 0, tops <= topSize
export function sanitizeGroupName(raw: unknown): string | null; // 1..nameMax, sin control chars
export function normalizeInviteCode(input: string): string | null; // mayúsculas, sin espacios/guiones, 8 símbolos
export function isGroupId(id: string): boolean;
export function hubGroupLink(hubUrl: string, code: string): string; // `${base}/#group=CODE`
export function parseGroupInput(text: string): string | null; // código suelto o enlace https (http local) con #group=
```

En `packages/shared/src/hub.ts`: añadir a `HubErrorCode` `'group_not_found' | 'group_full' |
'not_member' | 'not_owner' | 'kicked' | 'too_many_groups'` y exportar `isAllowedOrigin`.

### Migración `apps/hub/migrations/0004_groups.sql`

```sql
-- Friend groups. No email, no IP, no music: an alias and the hash of a random device key.
CREATE TABLE groups (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL UNIQUE,
  owner_member_id TEXT NOT NULL, created_at INTEGER NOT NULL, last_active_at INTEGER NOT NULL);
CREATE INDEX groups_active ON groups (last_active_at);
CREATE TABLE group_members (
  group_id TEXT NOT NULL, member_id TEXT NOT NULL, device_hash TEXT NOT NULL,
  alias TEXT NOT NULL, joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, member_id), UNIQUE (group_id, device_hash));
CREATE INDEX group_members_device ON group_members (device_hash);
CREATE TABLE group_bans (group_id TEXT NOT NULL, device_hash TEXT NOT NULL,
  PRIMARY KEY (group_id, device_hash));
CREATE TABLE device_stats (device_hash TEXT NOT NULL, month TEXT NOT NULL,
  stats_json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (device_hash, month));
-- Up to 12 months per device; the hourly cleanup drops older months by this index.
CREATE INDEX device_stats_month ON device_stats (month);
CREATE TABLE group_shares (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL, member_id TEXT NOT NULL, kind TEXT NOT NULL,
  ref TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX group_shares_group ON group_shares (group_id, created_at);
```

### Hub: `apps/hub/src/groups/repo.ts`

```ts
export interface GroupRow {
  id: string;
  name: string;
  inviteCode: string;
  ownerMemberId: string;
  createdAt: number;
  lastActiveAt: number;
}
export interface MemberRow {
  groupId: string;
  memberId: string;
  deviceHash: string;
  alias: string;
  joinedAt: number;
}
export interface ShareRow {
  id: string;
  groupId: string;
  memberId: string;
  kind: GroupShareKind;
  ref: string;
  title: string;
  createdAt: number;
  expiresAt: number;
}
export interface GroupRepo {
  createGroup(group: GroupRow, owner: MemberRow): Promise<boolean>; // false si choca id o código
  findGroup(id: string): Promise<GroupRow | null>;
  findGroupByInvite(code: string): Promise<GroupRow | null>;
  setInviteCode(groupId: string, code: string): Promise<boolean>; // false si choca
  setOwner(groupId: string, memberId: string): Promise<void>;
  touchGroup(groupId: string, now: number): Promise<void>;
  deleteGroup(groupId: string): Promise<void>; // + miembros, vetos y compartidos
  listMembers(groupId: string): Promise<MemberRow[]>; // joinedAt asc
  findMemberByDevice(groupId: string, deviceHash: string): Promise<MemberRow | null>;
  groupsOfDevice(
    deviceHash: string,
  ): Promise<Array<{ group: GroupRow; memberId: string; members: number }>>;
  addMember(member: MemberRow): Promise<void>;
  updateAlias(groupId: string, memberId: string, alias: string): Promise<void>;
  removeMember(groupId: string, memberId: string): Promise<void>; // + sus compartidos
  isBanned(groupId: string, deviceHash: string): Promise<boolean>;
  ban(groupId: string, deviceHash: string): Promise<void>;
  putStats(deviceHash: string, month: string, statsJson: string, now: number): Promise<void>;
  deleteStats(deviceHash: string): Promise<void>;
  statsForGroup(
    groupId: string,
    month: string,
  ): Promise<Array<{ memberId: string; alias: string; statsJson: string }>>;
  listExpiry(listId: string): Promise<number | null>; // expires_at de shared_lists o null
  addShare(share: ShareRow): Promise<void>;
  listShares(groupId: string, now: number): Promise<ShareRow[]>; // no caducados, más nuevos primero
  findShare(groupId: string, shareId: string): Promise<ShareRow | null>;
  deleteShare(shareId: string): Promise<void>;
  trimShares(groupId: string, keep: number): Promise<void>;
}
export class D1GroupRepo implements GroupRepo {
  constructor(db: D1Database);
}
```

`apps/hub/src/groups/ranking.ts`: `buildGroupRanking(stats: MonthStats[], topSize: number):
GroupStats['ranking']` — agrupa por `title|artist` y por `artist` en minúsculas y sin espacios
extremos; suma `plays`, `listeners` = cuántos miembros lo tienen; orden plays desc, listeners
desc, nombre (`localeCompare`); muestra el texto de la primera aparición.

### Hub: API `/hub/v1/groups` (todas exigen cabecera `X-Device-Key`, 64 hex; si falta o es inválida → 400 `invalid_request`)

| Método y ruta                   | Cuerpo                 | Respuesta                    | Errores / reglas                                                                                                                                        | Límite por IP               |
| ------------------------------- | ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `GET /`                         | —                      | `{ groups: GroupSummary[] }` |                                                                                                                                                         | 300 / 10 min (`group_read`) |
| `POST /`                        | `{ name, alias }`      | 201 `GroupDetail`            | 409 `too_many_groups` (>10 por dispositivo)                                                                                                             | 10 / h (`group_create`)     |
| `POST /join`                    | `{ code, alias }`      | 200 `GroupDetail`            | 404 `group_not_found`, 403 `kicked`, 409 `group_full`, 409 `too_many_groups`; si ya es miembro, actualiza alias                                         | 20 / 10 min (`group_join`)  |
| `GET /:id`                      | —                      | `GroupDetail`                | 404 `group_not_found`, 403 `not_member`                                                                                                                 | `group_read`                |
| `POST /:id/invite`              | —                      | `{ inviteCode }`             | 403 `not_owner`                                                                                                                                         | 10 / h                      |
| `DELETE /:id/members/:memberId` | —                      | 204                          | propio = salir; ajeno = solo creador (403 `not_owner`), expulsa y veta                                                                                  | `group_read`                |
| `DELETE /me`                    | —                      | 204                          | «borrar todos mis datos de grupos»: sale de todos los grupos y borra `device_stats`                                                                     | 20 / 10 min                 |
| `PUT /stats`                    | `StatsUpload`          | 204                          | algún mes inválido o con `isAcceptableMonth` false → 400; más de 12 meses → 400; reemplaza cada mes enviado; si no está en ningún grupo, no guarda nada | 30 / h (`group_stats`)      |
| `DELETE /stats`                 | —                      | 204                          | interruptor apagado: borra todas las `device_stats` del dispositivo; **no** toca grupos                                                                 | 20 / 10 min                 |
| `GET /:id/stats?month=YYYY-MM`  | —                      | `GroupStats`                 | 403 `not_member`; 400 si mes inválido o anterior a `oldestKeptMonth`                                                                                    | `group_read`                |
| `GET /:id/shares`               | —                      | `{ shares: GroupShare[] }`   | 403 `not_member`                                                                                                                                        | `group_read`                |
| `POST /:id/shares`              | `{ kind, ref, title }` | 201 `GroupShare`             | `list`: el enlace debe existir y no caducar (404 `not_found`), caduca con él; `jam`: código válido, caduca a 12 h; deja solo 50                         | 30 / h (`group_share`)      |
| `DELETE /:id/shares/:shareId`   | —                      | 204                          | autor o creador (403 `not_owner`)                                                                                                                       | `group_read`                |

Cada escritura de un miembro hace `touchGroup`. `index.ts`: `app.route('/hub/v1/groups',
createGroupRoutes((env) => new D1GroupRepo(env.DB)))`, añadir `'X-Device-Key'` a `allowHeaders`
y `'PUT'` a `allowMethods`; en `scheduled`, además `cleanupGroups(env.DB, now)`.
`cleanupGroups` borra: grupos con `last_active_at < now - inactiveTtlMs` (y sus filas),
`group_shares` caducados, `device_stats` con `month < oldestKeptMonth(now)` (más de 12 meses) y
`device_stats` de dispositivos sin ningún grupo.

### Web

- `apps/web/src/hub/client.ts`: se exporta `hubFetch` (sin más cambios).
- `apps/web/src/hub/groupsClient.ts`: una función por fila de la tabla (`listMyGroups`,
  `createGroup(name, alias)`, `joinGroup(code, alias)`, `getGroup(id)`, `renewInvite(id)`,
  `removeMember(id, memberId)`, `deleteMyGroupData()` (`DELETE /me`),
  `deleteMyStats(deviceKey?)` (`DELETE /stats`), `uploadStats(months)`,
  `getGroupStats(id, month)`, `listShares(id)`, `addShare(id, {kind, ref, title})`,
  `deleteShare(id, shareId)`), todas con `X-Device-Key: getDeviceKey()`.
- `apps/web/src/groups/deviceKey.ts`: `getDeviceKey(): string`, `resetDeviceKey(): string`
  (pref `groups-device-key`, `crypto.getRandomValues`).
- `apps/web/src/groups/snapshot.ts`: `monthKeyOfPeriod(p): string`,
  `buildMonthStats(records: PlayRecord[], period): MonthStats` (usa `buildRecap(..., topSize)`),
  `monthsToUpload(now, firstSync: boolean): RecapPeriod[]` (primera vez: los 12 meses locales
  desde el actual hacia atrás; después: actual + anterior si día <= 7). Los meses sin escuchas no
  se suben.
- `apps/web/src/stats/recap.ts`: `buildRecap(records, period, topSize = TOP_SIZE)`.
- `apps/web/src/stores/groups.ts` (zustand `useGroups`):
  ```ts
  consent: 'off' | 'on';            // pref 'groups-consent': SOLO estadísticas
  groups: GroupSummary[];           // independiente de consent
  // on: si useStats.consent !== 'on' llama a useStats.getState().setEnabled(true); consent on;
  //     borra 'groups-last-sync' y lanza syncGroupStats({ force: true }) (primera subida = 12 meses).
  // off: consent off YA (nunca toca el Recap), deleteMyStats(); si falla la red guarda pref
  //      'groups-stats-wipe-pending' = true y reintenta en retryPendingWipe(). Sigue en sus grupos.
  setSharing(on: boolean): Promise<boolean>;
  retryPendingWipe(): Promise<void>;
  // «Borrar todos mis datos de grupos»: deleteMyGroupData(), resetDeviceKey(), groups = [],
  // consent off. Con confirmación en la UI. Si falla, toast y no cambia nada.
  wipeAll(): Promise<boolean>;
  refresh(): Promise<void>;
  create(name: string, alias: string): Promise<GroupDetail | null>;
  join(code: string, alias: string): Promise<GroupDetail | null>;
  leave(groupId: string, memberId: string): Promise<boolean>;
  kick(groupId: string, memberId: string): Promise<boolean>;
  ```
  Los errores se muestran con `toast(hubErrorText(err), 'error')` y se devuelve null/false.
- `apps/web/src/groups/sync.ts`: `syncGroupStats(opts?: { force?: boolean }): Promise<void>` —
  solo si `groups-consent` on, hay grupos y `useStats.consent === 'on'`; throttle 6 h (pref
  `groups-last-sync`; `force` = si han pasado >15 min; sin `groups-last-sync` = primera subida
  de 12 meses). Errores: `console.error`, sin toast.
- `apps/web/src/groups/shareActions.ts`: `shareListToGroup(groupId, playlist): Promise<GroupShare | null>`
  (reutiliza `useSharedLists.forPlaylist` o crea el enlace con `createSharedList` +
  `songsFromPlaylist`, y luego `addShare`); `shareJamToGroup(groupId): Promise<GroupShare | null>`
  (solo si `useJam` tiene sesión de anfitrión).
- `apps/web/src/i18n/groups.ts`: `groupsEn`, `groupsEs`, `groupsEu` (inglés es la fuente),
  esparcidos en `en.ts`, `es.ts`, `eu.ts`. Incluye los `hub.err.<código>` nuevos; `hub/errors.ts`
  buscará la clave en `shareEn` **o** `groupsEn`.
- Rutas: `/groups` (`GroupsView`) y `/groups/:id` (`GroupView`). Nav: «Grupos» / «Groups» /
  «Taldeak» con el icono `Users`, después de Recap.
- Ayuda: artículo `friend-groups` (`help/articles/groups.ts`); la UI enlaza a `/help/friend-groups`.

## Tareas

### T1 · Animación de arranque con pausa y salida suave · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/lib/boot.ts`, `apps/web/src/boot.css`,
  `apps/web/test/boot.test.ts`, `apps/web/src/App.tsx`
- Leer como contexto: `apps/web/src/components/BootSplash.tsx`
- Qué hacer:
  - En `boot.ts`: `BOOT_MIN_SPLASH_MS = 1800`, `SPLASH_EXIT_MS = 500`; nueva función pura
    `splashTimings(reducedMotion: boolean): { minMs: number; exitMs: number }` →
    `{1800, 500}` o `{600, 200}`. `bootReady` recibe `minMs` opcional (por defecto
    `BOOT_MIN_SPLASH_MS`). Comentario corto del porqué (1,2 s de dibujo + 0,6 s de pausa).
  - En `App.tsx`: leer una vez `matchMedia('(prefers-reduced-motion: reduce)').matches`, pasar
    `minMs` a `bootReady` y a los temporizadores de `useBootReady`, y `exitMs` a `useSplashExit`.
    No añadir ninguna espera cuando la app esté lista después del mínimo.
  - En `boot.css`: el pulso empieza a 1,8 s (`animation-delay`); salida 500 ms: el contenedor
    hace fundido (`opacity` a 0) y `.boot-pulse` zoom de 1 a 1.15 con `ease-in-out`. En
    reduced-motion, salida 200 ms solo con fundido y sin zoom (ya existe el bloque; ajustarlo).
- TDD: sí (solo `splashTimings`/`bootReady`)
- Criterios de aceptación:
  - [ ] Tests: `splashTimings(false)` = 1800/500, `splashTimings(true)` = 600/200; `bootReady`
        devuelve false antes de `minMs` y true justo en `minMs` con conexión online.
  - [ ] A mano (`npm run dev`): el logo completo se queda quieto ~0,6 s y sale con fundido + zoom;
        con «reducir movimiento» del sistema, aparece fijo y solo se funde.
  - [ ] Con red lenta, el logo late hasta que la app está lista y entonces sale sin pausa extra.
- Verificación: `npx vitest run test/boot.test.ts --root apps/web` y `npm run check`

### T2 · F8b · Tipos compartidos, migración y capa de datos del Hub · Grupo A · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/groups.ts`, `packages/shared/src/hub.ts`,
  `packages/shared/package.json`, `packages/shared/test/groups.test.ts`,
  `apps/hub/migrations/0004_groups.sql`, `apps/hub/src/groups/repo.ts`,
  `apps/hub/src/groups/ranking.ts`, `apps/hub/test/memoryGroupRepo.ts`,
  `apps/hub/test/groupRanking.test.ts`
- Leer como contexto: `packages/shared/src/hub.ts`, `apps/hub/src/routes/lists.ts`,
  `apps/hub/migrations/0002_parcels.sql`, `apps/web/src/stats/recap.ts`
- Qué hacer: implementar exactamente los contratos «shared/groups.ts», «Migración», «repo.ts» y
  «ranking.ts» de arriba. `D1GroupRepo` con consultas parametrizadas (`prepare().bind()`), los
  borrados en cascada con `db.batch`. `MemoryGroupRepo` (test) implementa `GroupRepo` con `Map`s y
  el mismo comportamiento (orden, colisiones, cascadas). Añadir `"./groups": "./src/groups.ts"` a
  `exports`. Comentarios en inglés.
- TDD: sí
- Criterios de aceptación:
  - [ ] Tests de `sanitizeMonthStats` (recorta tops a 10, rechaza números negativos o no enteros,
        mes inválido), `normalizeInviteCode`, `parseGroupInput` (código, enlace https, http solo
        local, otros hash → null), `shiftMonthKey` (cruce de año en ambos sentidos),
        `oldestKeptMonth` (12 meses incluido el actual) e `isAcceptableMonth` (rechaza el mes 13
        hacia atrás y el que va 2 meses por delante; acepta el siguiente).
  - [ ] Tests de `buildGroupRanking`: suma escuchas, cuenta oyentes, agrupa sin distinguir
        mayúsculas, desempate estable, corta en `topSize`, lista vacía.
  - [ ] Ningún archivo > 400 líneas ni función > 50.
- Verificación: `npx vitest run --root packages/shared`, `npx vitest run test/groupRanking.test.ts --root apps/hub`, `npm run check`

### T3 · F8b · Rutas de grupos del Hub · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/hub/src/groups/routes.ts`, `apps/hub/src/groups/statsRoutes.ts`,
  `apps/hub/src/groups/shareRoutes.ts`, `apps/hub/src/groups/service.ts`,
  `apps/hub/src/groups/auth.ts`, `apps/hub/src/groups/cleanup.ts`, `apps/hub/src/index.ts`,
  `apps/hub/test/groups.test.ts`, `apps/hub/test/groupStats.test.ts`,
  `apps/hub/test/groupShares.test.ts`
- Leer como contexto: `apps/hub/src/routes/lists.ts`, `apps/hub/src/lib/*.ts`,
  `apps/hub/test/parcels.test.ts`, `apps/hub/test/fakeDb.ts`, `apps/hub/test/memoryGroupRepo.ts`,
  `apps/hub/src/groups/repo.ts`, `apps/hub/src/groups/ranking.ts`, `packages/shared/src/groups.ts`
- Qué hacer: implementar la tabla de la API. `createGroupRoutes(repoFor: (env: HubEnv) => GroupRepo)`
  monta las tres sub-rutas (registrar `/join`, `/me` y `/stats` antes de `/:id`). Crear, unirse
  y compartir NO dependen de ningún consentimiento: eso solo lo controla la app al subir
  estadísticas. `auth.ts`:
  `deviceHashOf(c)` (valida `X-Device-Key` y devuelve SHA-256) y `requireMember(repo, groupId,
deviceHash)` (404/403). `service.ts`: reglas puras sobre el repo (crear con id/código sin
  colisión, unirse con tope 20/10 grupos/veto, salir con traspaso al más antiguo o borrado,
  expulsar + vetar, `leaveAll`). Validar cuerpos con zod y tamaño máximo (`statsBodyMaxBytes`).
  Límites con `enforceRateLimit`. `index.ts` según «Contratos». Tests con `MemoryGroupRepo` +
  `FakeD1` (para los límites), estilo `parcels.test.ts`.
- TDD: sí
- Criterios de aceptación:
  - [ ] Crear, unirse, ver, renovar código, salir y expulsar funcionan; el 21.º miembro recibe
        409 `group_full`; el expulsado recibe 403 `kicked` al volver a unirse.
  - [ ] Si el creador sale, el más antiguo pasa a ser creador; si sale el último, el grupo
        desaparece (404).
  - [ ] Un no miembro recibe 403 `not_member` en detalle, estadísticas y compartidos.
  - [ ] `PUT /stats` acepta hasta 12 meses en una subida y rechaza meses fuera de rango o más de
        12; `GET /:id/stats` solo devuelve miembros del grupo y el ranking correcto, y rechaza
        meses de hace más de 12; `DELETE /stats` borra solo las estadísticas (el dispositivo sigue
        en sus grupos y `GET /` los devuelve); `DELETE /me` lo deja sin grupos ni estadísticas.
  - [ ] `cleanupGroups` (test con `MemoryGroupRepo` o comprobando el SQL generado) borra meses
        anteriores a `oldestKeptMonth` y conserva los 12 últimos.
  - [ ] Compartir una lista inexistente → 404; una Jam caduca a 12 h; nunca más de 50.
  - [ ] Sin `X-Device-Key` válido → 400. Tests existentes del Hub siguen en verde.
- Verificación: `npx vitest run --root apps/hub`, y a mano: `npm run hub:migrate:local`,
  `npm run dev:hub`, `curl` de crear y unirse con dos claves distintas. `npm run check`

### T4 · F8b · Datos de grupos en la app (cliente, store, sincronización) · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/hub/client.ts`, `apps/web/src/hub/errors.ts`,
  `apps/web/src/hub/groupsClient.ts`, `apps/web/src/groups/deviceKey.ts`,
  `apps/web/src/groups/snapshot.ts`, `apps/web/src/groups/sync.ts`,
  `apps/web/src/groups/shareActions.ts`, `apps/web/src/stores/groups.ts`,
  `apps/web/src/stats/recap.ts`, `apps/web/src/i18n/groups.ts`, `apps/web/src/i18n/es.ts`,
  `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/eu.ts`, `apps/web/test/groupsSnapshot.test.ts`,
  `apps/web/test/groupsStore.test.ts`, `apps/web/test/groupsSync.test.ts`
- Leer como contexto: `apps/web/src/stores/stats.ts`, `apps/web/src/stats/repo.ts`,
  `apps/web/src/stores/sharedLists.ts`, `apps/web/src/components/SharePlaylistSheet.tsx`,
  `apps/web/src/hub/sharedList.ts`, `apps/web/src/stores/jam.ts`, `apps/web/src/i18n/stats.ts`,
  `apps/web/src/i18n/share.ts`, `apps/web/src/lib/storage.ts`, `packages/shared/src/groups.ts`
- Qué hacer: implementar la parte «Web» de los contratos (todo menos rutas, nav, vistas y ayuda).
  En `i18n/groups.ts` crear `groupsEn/Es/Eu` solo con: los 6 `hub.err.*` nuevos (lenguaje
  sencillo: qué pasa y qué hacer, p. ej. `group_full` → «Este grupo ya tiene 20 personas. Pide
  que alguien salga para hacerte sitio.») y los toasts del store (`groups.toast.statsDeleted`,
  `groups.toast.wiped`, `groups.toast.left`, `groups.toast.kicked`, `groups.toast.recapOn` =
  «También hemos activado tu Recap, porque tus escuchas salen de ahí.», `groups.err.wipe` =
  «No hemos podido borrar tus escuchas de los grupos ahora. Lo intentaremos solo en cuanto haya
  conexión.»). Mismas claves en los tres idiomas.
- TDD: sí
- Criterios de aceptación:
  - [ ] `buildMonthStats` da 'YYYY-MM' local, tops de 10 y excluye saltadas; `monthsToUpload`
        con `firstSync` = 12 meses (cruzando el año); si no, el mes anterior solo los días 1-7;
        no incluye meses sin escuchas.
  - [ ] Store (con `groupsClient` mockeado con `vi.mock`): `setSharing(true)` activa el Recap si
        estaba apagado (y no lo toca si ya estaba encendido) y fuerza la primera subida;
        `setSharing(false)` pone consent off aunque falle la red, **no** apaga el Recap, **no**
        sale de los grupos ni cambia la clave, guarda `groups-stats-wipe-pending` y
        `retryPendingWipe` lo borra al funcionar; `wipeAll` vacía los grupos y cambia la clave;
        crear/unirse funcionan con consent off; errores → toast traducido.
  - [ ] `syncGroupStats` no sube nada con consent off, sin grupos o con Recap apagado, y respeta
        las 6 h / 15 min.
  - [ ] El test de paridad de i18n pasa; `hubErrorText` traduce los códigos nuevos.
- Verificación: `npx vitest run test/groupsSnapshot.test.ts test/groupsStore.test.ts test/groupsSync.test.ts --root apps/web`, `npm run check`

### T5 · F8b · Pantallas de grupos · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/GroupsView.tsx`, `apps/web/src/views/GroupView.tsx`,
  `apps/web/src/components/groups/*.tsx` (nuevos: `GroupsConsent`, `CreateGroupSheet`,
  `JoinGroupSheet`, `InviteSheet`, `GroupRanking`, `MemberTops`, `GroupShares`, `GroupMembers`),
  `apps/web/src/groups.css`, `apps/web/src/components/Nav.tsx`, `apps/web/src/App.tsx`,
  `apps/web/src/i18n/groups.ts`
- Leer como contexto: `apps/web/src/views/RecapView.tsx`, `apps/web/src/components/stats/*.tsx`,
  `apps/web/src/components/jam/JamStart.tsx`, `apps/web/src/components/QrCode.tsx`,
  `apps/web/src/components/Sheet.tsx`, `apps/web/src/stores/groups.ts`,
  `apps/web/src/groups/*.ts`, `apps/web/src/hub/groupsClient.ts`
- Qué hacer:
  - `GroupsView` (`/groups`): siempre muestra la lista de grupos, «Crear grupo» y «Unirme»
    (código o escanear QR con `scanQr` + `parseGroupInput`); NO dependen del interruptor. Arriba,
    el bloque `GroupsConsent` con el interruptor «Compartir mis escuchas con mis grupos». Al
    encenderlo, hoja de consentimiento con aviso claro: qué se envía (tu alias y, por cada mes,
    tus minutos y tu top de canciones y artistas), a quién (solo a la gente de tus grupos),
    dónde (el Hub de Aske Stream), cuánto tiempo (hasta 12 meses), **que activa también tu Recap
    en este dispositivo** si estaba apagado, y que al apagarlo se borran del Hub tus escuchas,
    pero sigues en tus grupos y el Recap sigue como esté. Botones «Sí, activar» / «No, gracias»
    - enlace a la ayuda. Al apagarlo, confirmación con ese mismo texto. Al final de la pantalla,
      «Borrar todos mis datos de grupos» (sale de todos, con confirmación → `wipeAll`).
  - `GroupView` (`/groups/:id`): nombre, botón «Invitar» (código formateado + QR de
    `hubGroupLink`; el creador puede renovarlo), pestañas «Ranking del grupo» / «Cada persona»
    con selector de mes (anterior/siguiente, hasta 12 meses atrás), aviso «Tú no compartes tus
    escuchas» + botón para activarlo si consent off, sección «Compartido» (abrir lista → `/shared/:ref`; Jam →
    `useJam.join(ref, alias)` y `/jam`; compartir una playlist o tu Jam con `shareActions`),
    miembros (expulsar solo el creador, con confirmación) y «Salir del grupo». Llama a
    `syncGroupStats({ force: true })` al abrir. Si el interruptor está encendido pero el Recap se
    apagó a mano, aviso: «No se comparten tus escuchas porque el Recap está apagado. Puedes
    activarlo en Ajustes → Recap.»
  - `App.tsx`: rutas; enlace `#group=CODE` al abrir la app (como `takePendingJamCode`) → abre
    `/groups` con la hoja de unirse rellena; tras el arranque, `retryPendingWipe()` y
    `syncGroupStats()`.
  - `Nav.tsx`: entrada Grupos. Añadir todas las claves de UI a `i18n/groups.ts` (es/en/eu).
  - Componentes < 50 líneas por función; estados vacíos y de carga con texto claro.
- TDD: no
- Criterios de aceptación:
  - [ ] Dos navegadores con `npm run dev` + `npm run dev:hub`: crear grupo, unirse por código,
        ver ranking y top de cada uno (con Recap activado y alguna escucha), compartir playlist,
        expulsar, salir. Encender el interruptor con el Recap apagado lo enciende (y lo avisa);
        apagarlo hace desaparecer tus escuchas del grupo, pero sigues en él y el Recap sigue
        encendido. «Borrar todos mis datos de grupos» te saca de todos.
  - [ ] Se ve bien a 360 px; solo color ámbar; paridad i18n en verde.
- Verificación: `npm run check` y prueba manual descrita

### T6 · F8b · Ayuda, privacidad y documentación del Hub · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/help/articles/groups.ts`, `apps/web/src/help/articles.ts`,
  `apps/web/src/help/articles/stats.ts`, `apps/web/src/help/articles/privacy.ts`,
  `docs/hub.md`, `docs/PRIVACY.md`
- Leer como contexto: `apps/web/src/help/articles/types.ts`, `apps/web/src/help/articles/friends.ts`,
  esta sección «Decisiones» y «Contratos»
- Qué hacer: artículo `friend-groups` (es/en/eu, sección de amigos) en lenguaje sencillo: qué es
  un grupo, cómo crear/unirse/invitar, qué se comparte y qué no (nunca música, ni email, ni
  escuchas saltadas, radio o podcasts), el interruptor (solo escuchas; activa también el Recap;
  al apagarlo se borran tus escuchas del Hub pero sigues en tus grupos y el Recap no se apaga),
  cuánto se guardan (12 meses), «Borrar todos mis datos de grupos», expulsar y salir, límites
  (20 personas, 10 grupos). En `stats.ts` matizar «no se envían a nadie» → salvo que actives
  «Compartir mis escuchas con mis grupos» (y que activar eso enciende el Recap), con enlace
  `[[friend-groups|…]]`. Actualizar el artículo de
  privacidad. `docs/hub.md`: nueva sección «Grupos» (API, límites, migración 0004 y
  `hub:migrate:remote` antes de desplegar), filas nuevas en la tabla «Qué guarda» y quitar «No hay
  estadísticas de uso» por una frase exacta. `docs/PRIVACY.md`: qué datos de grupos se guardan,
  base legal (consentimiento), plazos y cómo borrarlos.
- TDD: no
- Criterios de aceptación:
  - [ ] Test de enlaces entre artículos y paridad en verde.
  - [ ] Los textos dicen qué pasa, qué hacer y sin jerga.
- Verificación: `npm run check`

### T7 · F8b · Cierre: comprobación completa y estado · Grupo D · Estado: HECHA

- Archivos (exclusivos): `docs/v2/architecture.md`, `docs/ESTADO.md`, `docs/plan/PLAN.md`
- Leer como contexto: este plan
- Qué hacer: ejecutar `npm run check` y `npm run test:e2e` (cerrar wrangler/workerd colgados);
  marcar la fila 8b con ✅ en la tabla de fases y añadir una nota corta de fase 8b; actualizar
  `ESTADO.md` (hecho: animación con pausa y F8b; pendiente: `hub:migrate:remote` +
  `deploy:hub` + `deploy` y prueba en dos móviles; decisiones: el interruptor solo controla las
  escuchas y enciende el Recap, apagarlo borra tus escuchas del Hub pero no te saca de los grupos,
  12 meses por dispositivo, expulsar = veto). Marcar las tareas como HECHAS en este plan.
- TDD: no
- Criterios de aceptación:
  - [ ] `npm run check` y `npm run test:e2e` en verde.
  - [ ] Tabla de fases y `ESTADO.md` al día.
- Verificación: `npm run check`

## Riesgos / dudas abiertas

- `D1GroupRepo` no tiene tests automáticos (no hay D1 en Vitest); se prueba a mano con wrangler.
- T5 es la tarea más grande; si el programador se atasca, partir en «GroupsView + consentimiento»
  y «GroupView».

- RGPD: el alias y la pertenencia a grupos quedan en el Hub aunque el interruptor esté apagado
  (decisión D2). Se cubre con: texto claro al crear/unirse («tu alias lo verá la gente del
  grupo»), «Salir del grupo», «Borrar todos mis datos de grupos» y el borrado de grupos inactivos
  a los 180 días. T6 debe explicarlo en `PRIVACY.md`.
- Encender grupos enciende el Recap (D1): la hoja de consentimiento tiene que decirlo sin letra
  pequeña; si alguien apaga luego el Recap, su historial local se borra (comportamiento de 8a) y
  deja de subir escuchas, aunque las ya subidas siguen en el Hub hasta que apague el interruptor.
- 12 meses (D3) multiplican los datos guardados: unas 12 filas de ~3 KB por persona, sin problema
  para el plan gratuito de D1.

### Dudas resueltas por Andoni (2026-11-23)

- **D1:** al activar «compartir con grupos» se activa también el Recap local; apagar grupos no
  apaga el Recap.
- **D2:** el interruptor controla solo las estadísticas; apagarlo borra del Hub tus escuchas,
  pero sigues en tus grupos y Jams.
- **D3:** el Hub guarda 12 meses de estadísticas por persona; la limpieza borra lo más antiguo.

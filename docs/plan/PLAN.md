# PLAN: F7 · Hub con playlists compartidas y Jams en persona (+ arreglo visual previo)

Fecha: 2026-11-20 · Estado: COMPLETADO

## Objetivo

1. Arreglar un fallo visual: en Ajustes, en «Vincular otro dispositivo», el botón se monta sobre la línea divisoria.
2. Crear **Aske Hub**, un Worker aparte en el Cloudflare de Andoni, común para todos los usuarios. **Nunca guarda música.**
   - **Playlists compartidas:** un enlace corto que solo lleva ids de YouTube y títulos. La app de cada amigo descarga las canciones. El enlace caduca a los 90 días.
   - **Jams en persona:** un Durable Object por Jam. Los amigos entran con un QR, añaden canciones y votan. Solo suena el móvil del anfitrión. La Jam caduca a las 12 h. Cada uno pone un apodo, sin cuentas.

## Decisiones de arquitectura

- **Nuevo workspace `apps/hub` (`@aske/hub`)**, con Hono, zod, D1 y Durable Objects. Va aparte de `apps/api` porque `apps/api` es el Worker personal de cada usuario y el Hub es uno solo, el de Andoni.
- **La API del Hub va en `/hub/v1/*`, no en `/api/*`.** Si el Hub sirve la web, `setup.ts` llama a `/api/health` en su mismo origen y no debe confundir el Hub con un servidor de música propio.
- **El Hub también sirve la web ya construida** (`assets` con `../web/dist`). Así un amigo sin la app, o con iPhone, escanea el QR con la cámara y entra a la Jam desde el navegador. Los archivos estáticos no gastan invocaciones del Worker. _Pendiente de confirmar: duda 1._
- **Formato de los enlaces:** `${HUB_URL}/#list=<id>` y `${HUB_URL}/#jam=<código>`. Van en el hash, igual que la vinculación (`#code=`), así que el servidor nunca ve el id en las peticiones de archivos.
- **Playlists compartidas en D1 del Hub** (tabla `shared_lists`, con las canciones en JSON). Un cron diario borra las caducadas. D1 cabe de sobra en el plan gratuito.
- **Jams con un Durable Object SQLite por Jam** (`new_sqlite_classes`, lo único que permite el plan gratuito). Usa la API de _WebSocket Hibernation_ (`ctx.acceptWebSocket`) para no gastar tiempo de ejecución, y una alarma a las 12 h borra todo.
- **El código de la Jam tiene 6 símbolos** del alfabeto `PAIRING_CODE_ALPHABET` (sin 0/1/I/O) y se muestra como `ABC-DEF`. El id de una playlist compartida tiene 10 símbolos del mismo alfabeto.
- **Cómo se reconoce al anfitrión:** al crear la Jam recibe un `hostKey` secreto, y el DO solo guarda su SHA-256. Para borrar una playlist compartida se usa una `deleteKey` que funciona igual.
- **Votos:** solo «me gusta» (+1), y se puede quitar. La cola se ordena por votos (de más a menos) y, si empatan, por hora en que se añadió. Si alguien añade una canción que ya está en la cola, cuenta como su voto.
- **Anfitrión solo en la app Android**, porque necesita yt-dlp para bajar las canciones que no tiene. En la web solo se puede entrar como invitado. Las canciones que se bajan van a una playlist «Jam dd/mm» de su biblioteca.
- **Los invitados buscan canciones con el buscador del Hub** (`/hub/v1/jams/:code/search`), que solo funciona si la Jam existe. También pueden añadir canciones de YouTube de su propia biblioteca.
- **Límites para no pasarse del plan gratuito:** se limitan las creaciones y búsquedas por IP con una tabla D1. Se guarda el hash de la IP con sal diaria, nunca la IP en claro.
- **`HUB_URL` va en `config.ts`, es público** y se puede cambiar con `VITE_HUB_URL`. Si está vacío, la web enseña estas funciones como «próximamente», igual que hace con `GOOGLE_WEB_CLIENT_ID`.
- **En el Hub no hay estadísticas de uso.** Solo se guardan los apodos (en la Jam, como mucho 12 h) y las referencias de las canciones.

## Contratos (interfaces compartidas)

### `packages/shared/src/hub.ts` (export `@aske/shared/hub`) — T2

```ts
export const HUB_LIMITS = {
  listMaxSongs: 1000, // = LIMITS.playlistMaxTracks
  listTtlMs: 90 * 24 * 3600 * 1000,
  jamTtlMs: 12 * 3600 * 1000,
  jamMaxMembers: 30, // conexiones simultáneas
  jamMaxQueue: 200,
  jamMaxPendingPerMember: 10,
  nicknameMax: 24,
  jamCodeLength: 6,
  listIdLength: 10,
  wsMessageMaxBytes: 8 * 1024,
  listBodyMaxBytes: 512 * 1024,
} as const;

export interface HubSong {
  videoId: string;
  title: string;
  artist: string;
  durationMs?: number;
}
export interface SharedList {
  id: string;
  name: string;
  songs: HubSong[];
  createdAt: number;
  expiresAt: number;
}
export interface CreatedList {
  id: string;
  deleteKey: string;
  expiresAt: number;
}
export interface CreatedJam {
  code: string;
  hostKey: string;
  expiresAt: number;
}
export interface JamInfo {
  code: string;
  hostName: string;
  expiresAt: number;
  members: number;
}

export interface JamMember {
  memberId: string;
  nickname: string;
  isHost: boolean;
}
export interface JamItemView {
  id: string;
  song: HubSong;
  addedBy: string; // apodo
  votes: number;
  votedByMe: boolean;
  mine: boolean;
  addedAt: number;
}
export interface JamSnapshot {
  code: string;
  hostName: string;
  expiresAt: number;
  nowPlaying: JamItemView | null;
  queue: JamItemView[]; // ya ordenada
  members: JamMember[];
}

export type HubErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'expired'
  | 'rate_limited'
  | 'too_many_songs'
  | 'jam_full'
  | 'queue_full'
  | 'member_limit'
  | 'not_host'
  | 'search_unavailable'
  | 'internal_error';

// WebSocket, cliente → servidor (JSON)
export type JamClientMessage =
  | { type: 'hello'; memberId: string; nickname: string; hostKey?: string }
  | { type: 'add'; song: HubSong }
  | { type: 'vote'; itemId: string } // alterna poner/quitar el voto
  | { type: 'remove'; itemId: string } // solo anfitrión (o quien la añadió)
  | { type: 'start'; itemId: string } // solo anfitrión: pasa a nowPlaying
  | { type: 'finish' } // solo anfitrión: nowPlaying = null
  | { type: 'end' }; // solo anfitrión: cierra la Jam

// WebSocket, servidor → cliente
export type JamServerMessage =
  | { type: 'state'; jam: JamSnapshot; you: JamMember }
  | { type: 'error'; code: HubErrorCode }
  | { type: 'ended'; reason: 'host' | 'expired' };

export function isVideoId(v: string): boolean; // /^[A-Za-z0-9_-]{11}$/
export function sanitizeHubSong(raw: unknown): HubSong | null; // recorta a LIMITS.titleMax / nameMax, quita caracteres de control
export function normalizeNickname(raw: string): string | null; // trim, espacios colapsados, sin control, 1..24
export function normalizeJamCode(input: string): string | null; // mayúsculas, sin espacios ni guiones, 6 del alfabeto
export function formatJamCode(code: string): string; // 'ABCDEF' → 'ABC-DEF'
export function isListId(id: string): boolean; // 10 del alfabeto
export function hubListLink(hubUrl: string, id: string): string; // `${hub sin / final}/#list=${id}`
export function hubJamLink(hubUrl: string, code: string): string; // `${hub}/#jam=${code}`
export type HubLink = { kind: 'list'; id: string } | { kind: 'jam'; code: string };
export function parseHubLink(text: string): HubLink | null; // URL https (o http local) con #list= o #jam=; también un código de Jam suelto
export function parseHubHash(hash: string): HubLink | null; // para location.hash
```

### API HTTP del Hub (`/hub/v1`, CORS `*`, sin cookies) — T3 y T4

Los errores van como `{ error: HubErrorCode, message: string }`, igual que en `apps/api`.

| Método y ruta                   | Cuerpo / query                         | Respuesta                                                                        |
| ------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /hub/v1/health`            | —                                      | `{ ok: true, hub: true, version }`                                               |
| `POST /hub/v1/lists`            | `{ name, songs: HubSong[] }` (1..1000) | 201 `CreatedList` · 400 · 413 `too_many_songs` · 429                             |
| `GET /hub/v1/lists/:id`         | —                                      | `SharedList` · 404 `not_found` · 410 `expired`                                   |
| `DELETE /hub/v1/lists/:id`      | cabecera `X-Delete-Key`                | 204 · 403 `invalid_request` · 404                                                |
| `POST /hub/v1/jams`             | `{ hostName }`                         | 201 `CreatedJam` · 429                                                           |
| `GET /hub/v1/jams/:code`        | —                                      | `JamInfo` · 404 `not_found`                                                      |
| `GET /hub/v1/jams/:code/search` | `?q=&lang=es\|en\|eu`                  | `{ results: SearchResult[] }` (tipo de `@aske/shared/youtube`) · 404 · 429 · 502 |
| `GET /hub/v1/jams/:code/ws`     | Upgrade websocket                      | se pasa al DO                                                                    |

Límites por IP (hash): crear listas 20/h, crear Jams 10/h, búsquedas 60 cada 10 min.

### D1 del Hub (`apps/hub/migrations/0001_init.sql`) — T3

```sql
CREATE TABLE shared_lists (id TEXT PRIMARY KEY, name TEXT NOT NULL, songs_json TEXT NOT NULL,
  delete_key_hash TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX shared_lists_expires ON shared_lists (expires_at);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
```

### Durable Object `JamRoom` (`apps/hub/src/jam/room.ts`) — T4 (T3 lo conecta)

```ts
export class JamRoom extends DurableObject<HubEnv> {
  init(p: {
    code: string;
    hostName: string;
    hostKeyHash: string;
    expiresAt: number;
  }): Promise<boolean>; // false si ya hay una Jam viva
  info(): Promise<JamInfo | null>; // null si no existe o ha caducado
  fetch(req: Request): Promise<Response>; // solo upgrade a WebSocket
}
// apps/hub/src/jam/routes.ts
export const jamRoutes: Hono<HubAppEnv>; // POST /, GET /:code, GET /:code/search, GET /:code/ws
```

`apps/hub/src/env.ts` (T3): `interface HubEnv { DB: D1Database; JAM: DurableObjectNamespace<JamRoom>; ASSETS: Fetcher }` y `type HubAppEnv = { Bindings: HubEnv }`.

T3 escribe `src/lib/rateLimit.ts` con `checkRateLimit(db, key, limit, windowMs): Promise<boolean>` y `src/lib/http.ts` con `HubHttpError(status, code: HubErrorCode, message)`. T4 los importa.

### Cliente web del Hub (`apps/web/src/hub/client.ts`) — T2

```ts
export class HubError extends Error {
  code: HubErrorCode | 'network' | 'unavailable';
  status: number;
}
export function hubAvailable(): boolean; // HUB_URL !== ''
export function createSharedList(name: string, songs: HubSong[]): Promise<CreatedList>;
export function getSharedList(id: string): Promise<SharedList>;
export function deleteSharedList(id: string, deleteKey: string): Promise<void>;
export function createJam(hostName: string): Promise<CreatedJam>;
export function getJam(code: string): Promise<JamInfo>;
export function searchInJam(code: string, q: string, lang: Language): Promise<SearchResult[]>;
export function jamSocketUrl(code: string): string; // https→wss, http→ws
```

Las claves i18n de errores las comparten T5 y T7: `hub.err.<code>` para cada `HubErrorCode`, más `network` y `unavailable`. Las crea T5 en `i18n/share.ts`. La función `hubErrorText(err: unknown): string` va en `apps/web/src/hub/errors.ts` (T5).

### Store de la Jam (`apps/web/src/stores/jam.ts`) — T6 (lo usa T7)

```ts
type JamConnection = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'ended';
interface JamSession {
  code: string;
  role: 'host' | 'guest';
  memberId: string;
  nickname: string;
  hostKey?: string;
}
interface JamState {
  session: JamSession | null;
  snapshot: JamSnapshot | null;
  you: JamMember | null;
  connection: JamConnection;
  error: HubErrorCode | 'network' | 'unavailable' | null; // la UI lo traduce
  endedReason: 'host' | 'expired' | null;
  preparing: Record<string, 'downloading' | 'ready' | 'error'>; // anfitrión, por videoId
  create(o: { nickname: string; playlistName: string }): Promise<void>; // solo nativo
  join(code: string, nickname: string): Promise<void>;
  resume(): Promise<void>; // al arrancar, desde localStorage 'jam-session-v1'
  leave(): void; // invitado; el anfitrión debe usar end()
  add(song: HubSong): void;
  vote(itemId: string): void;
  remove(itemId: string): void;
  skip(): void; // anfitrión: empieza la siguiente que esté lista
  playItem(itemId: string): void; // anfitrión
  end(): void; // anfitrión
  clearError(): void;
}
export const useJam: UseBoundStore<StoreApi<JamState>>;
```

## Tareas

### T1 · Arreglar el botón encima de la línea en «Vincular otro dispositivo» · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/styles.css`, `apps/web/src/components/LinkDevicePanel.tsx` (solo si hace falta)
- Leer como contexto: `apps/web/src/views/SettingsView.tsx` (dónde se usa el panel)
- Qué hacer:
  - Causa: el panel `.panel.link-device` empieza con un `.setting`, que lleva `border-bottom` y `padding: 12px 0`. Justo debajo van el botón, el texto de caducado o el de error, y ninguno tiene margen superior. Por eso el botón queda pegado a la línea o encima de ella.
  - Arreglo: añade espacio entre los hijos de `.link-device`. Por ejemplo, `.link-device { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }` y `.link-device > .setting, .link-device > .link-device-code { align-self: stretch; }`. También vale un `margin-top` en `.link-device > .btn` y `.link-device > .error-text`.
  - Que el QR siga centrado y que no cambie ningún otro `.setting` de la app.
  - Mira si otros paneles de `SettingsView.tsx` tienen el mismo patrón (un `.setting` seguido de un botón suelto) y arréglalos igual solo si se ve el mismo fallo.
- TDD: no
- Criterios de aceptación:
  - [ ] En los estados inicial, de código caducado y de error, el botón y los textos quedan por debajo de la línea, separados unos 12 px.
  - [ ] Con el código visible, el QR, el código y el botón «Compartir enlace» se ven igual que antes.
  - [ ] Se ve bien a 360 px de ancho y en escritorio.
- Verificación: `npm run dev` → Ajustes → Cloudflare → «Vincular otro dispositivo» (con DevTools a 360 px), y después `npm run format:check`

### T2 · Contratos del Hub en shared y cliente web del Hub · Grupo A · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/hub.ts`, `packages/shared/test/hub.test.ts`, `packages/shared/package.json` (añadir `"./hub": "./src/hub.ts"` a `exports`), `apps/web/src/config.ts`, `apps/web/src/hub/client.ts`, `apps/web/test/hubClient.test.ts`
- Leer como contexto: `packages/shared/src/pairing.ts` (alfabeto y estilo de los enlaces), `packages/shared/src/index.ts` (`LIMITS`), `packages/shared/src/youtube.ts` (`SearchResult`), `apps/web/src/api/client.ts` (cómo hace fetch y maneja errores)
- Qué hacer:
  - Implementa en `hub.ts` todo lo de «Contratos → packages/shared/src/hub.ts» tal cual. Reutiliza `PAIRING_CODE_ALPHABET`. `parseHubLink` acepta https, o http solo para hosts locales (copia la regla de `pairing.ts`), y también un código de Jam suelto (`abc-def`).
  - En `config.ts` añade `export const HUB_URL: string = import.meta.env.VITE_HUB_URL || '';`, con un comentario igual que el de `GOOGLE_WEB_CLIENT_ID`: es público y, si está vacío, la función sale como «próximamente». Andoni pondrá la URL cuando despliegue el Hub.
  - Crea `client.ts` según «Contratos → Cliente web del Hub»:
    - un `hubFetch` interno que añade `/hub/v1`, manda y lee JSON y convierte las respuestas no-ok en `HubError` con el `code` del cuerpo;
    - si falla la red, `code: 'network'` y `status: 0`;
    - si `HUB_URL` está vacío, `HubError('unavailable')` sin llamar a fetch.
    - Las funciones de menos de 50 líneas.
- TDD: sí
- Criterios de aceptación:
  - [ ] Hay tests de `normalizeNickname` (vacío, solo espacios, más de 24, emojis y caracteres de control), `sanitizeHubSong` (videoId malo, título largo recortado, campos que faltan), `normalizeJamCode`, `parseHubLink` (list, jam, código suelto, http no local rechazado, URL de otra cosa → null) y `hubListLink`/`hubJamLink` (con y sin `/` final).
  - [ ] Hay tests del cliente con `fetch` simulado (`vi.stubGlobal`): éxito, error con `{error:'expired'}` y 410, red caída → `network`, `HUB_URL` vacío → `unavailable`, y `jamSocketUrl` con https→wss y http→ws.
- Verificación: `npx vitest run test/hub.test.ts --root packages/shared` · `npx vitest run test/hubClient.test.ts --root apps/web` · `npm run typecheck`

### T3 · Worker del Hub: esqueleto, playlists compartidas, límites y documentación · Grupo B · Estado: HECHA

- Archivos (exclusivos): todo `apps/hub/**` **excepto** `apps/hub/src/jam/**` y `apps/hub/test/jam*.test.ts`. En concreto: `package.json`, `wrangler.jsonc`, `tsconfig.json`, `src/index.ts`, `src/env.ts`, `src/version.ts`, `src/lib/http.ts`, `src/lib/rateLimit.ts`, `src/lib/ids.ts`, `src/lib/crypto.ts`, `src/routes/lists.ts`, `src/cleanup.ts`, `migrations/0001_init.sql`, `test/lists.test.ts`, `test/rateLimit.test.ts`. Además, el `package.json` raíz (scripts), `package-lock.json`, `docs/hub.md` (nuevo) y `docs/PRIVACY.md`.
- Leer como contexto: `apps/api/package.json`, `apps/api/wrangler.jsonc`, `apps/api/src/index.ts`, `apps/api/src/lib/http.ts`, `apps/api/src/lib/crypto.ts`, `apps/api/src/lib/ids.ts`, `apps/api/src/version.ts`, `apps/api/tsconfig.json`, `packages/shared/src/hub.ts` (T2)
- Qué hacer:
  - **`package.json`:** `@aske/hub` 0.6.0, con las mismas dependencias y scripts que `apps/api` (`dev` = `wrangler dev --port 8788`, `deploy`, `typecheck`, `test`, `db:migrate:local/remote`).
  - **`wrangler.jsonc`:**
    - `name: "aske-hub"`, sin R2;
    - `d1_databases` con binding `DB`, `database_name` `aske-hub` y `database_id` de relleno (`"REPLACE_WITH_HUB_D1_ID"`, con un comentario que explique que Andoni lo pone tras `wrangler d1 create aske-hub`);
    - `durable_objects.bindings: [{ name: "JAM", class_name: "JamRoom" }]` y `migrations: [{ tag: "v1", new_sqlite_classes: ["JamRoom"] }]`;
    - `triggers.crons: ["17 3 * * *"]`;
    - `assets` con `directory: "../web/dist"`, SPA y `run_worker_first: ["/hub/*"]`;
    - `observability` activado.
  - **`src/index.ts`:**
    - `app.use('/hub/*', cors({ origin: '*', allowHeaders: ['Content-Type','X-Delete-Key'], allowMethods: [...] }))`, `secureHeaders` y `no-store`;
    - las rutas `GET /hub/v1/health`, `app.route('/hub/v1/lists', listRoutes)` y `app.route('/hub/v1/jams', jamRoutes)` (importado de `./jam/routes`, que hace T4);
    - un 404 para `/hub/*`, el resto a `ASSETS`;
    - `onError` como en el api, con `HubHttpError`;
    - `export { JamRoom } from './jam/room'`;
    - `export default { fetch: app.fetch, scheduled }`. `scheduled` llama a `cleanup(env, Date.now())`, que borra las listas caducadas y las filas de `rate_limits` con más de un día.
  - **`routes/lists.ts`:**
    - zod con `sanitizeHubSong` y nombre de 1..`LIMITS.nameMax`;
    - cuerpo de como mucho `listBodyMaxBytes` (léelo como texto y comprueba la longitud);
    - id con `isListId` (genéralo con `crypto.getRandomValues` sobre el alfabeto y reintenta si choca);
    - `deleteKey` de 32 hex, y en la tabla solo su SHA-256;
    - `GET` devuelve 410 `expired` si `expires_at < now`;
    - `DELETE` compara el hash en tiempo constante.
    - Todo con consultas parametrizadas (`.bind`).
  - **`lib/rateLimit.ts`:** ventana fija con `INSERT … ON CONFLICT DO UPDATE`. La clave es `${acción}:${sha256(ip + díaUTC)}`, con la IP de `CF-Connecting-IP`. Devuelve `false` si se pasa del límite y la ruta responde 429 `rate_limited`.
  - **`package.json` raíz:** scripts `dev:hub`, `deploy:hub` (`npm run build && npm run deploy -w @aske/hub`), `hub:migrate:local` y `hub:migrate:remote`.
  - **`package-lock.json`:** hay que registrar el workspace nuevo. Ejecuta **una sola vez** `npm install --package-lock-only --ignore-scripts` y revisa `git diff --stat package-lock.json`. Solo deben aparecer las entradas `apps/hub` y `node_modules/@aske/hub`. Si cambia algo más, deshazlo con `git checkout package-lock.json` y avisa (ver riesgos).
  - **`docs/hub.md`** (español, sencillo): qué es el Hub, qué guarda y cuánto tiempo, y cómo desplegarlo:
    1. `wrangler d1 create aske-hub`;
    2. poner el id en `wrangler.jsonc`;
    3. `npm run hub:migrate:remote`;
    4. `npm run deploy:hub`;
    5. poner la URL en `HUB_URL`.
  - **`docs/PRIVACY.md`:** añade una sección Hub (es y en). Guarda las referencias de canciones y el nombre de la playlist 90 días, los apodos solo mientras dura la Jam (12 h) y la IP solo como hash con sal diaria para limitar abusos. No hay estadísticas.
- TDD: sí (validación, ids, límite de uso y caducidad)
- Criterios de aceptación:
  - [ ] Tests de `lists`: con `app.request()` y un D1 simulado en memoria (un objeto mínimo con `prepare().bind().first()/run()/all()`, o funciones puras separadas de la ruta). POST válido → 201 con `deleteKey`; más de 1000 canciones → 413; videoId malo → 400; GET caducado → 410; DELETE con la clave mala → 403.
  - [ ] Test de `rateLimit`: el número 21 dentro de la misma hora devuelve `false` y en la ventana siguiente vuelve a dejar.
  - [ ] `GET /hub/v1/health` devuelve `hub: true`, y `/api/health` en el Hub **no** devuelve JSON (va a la SPA).
  - [ ] `npm run typecheck -w @aske/hub` pasa cuando también está T4.
- Verificación: `npx vitest run --root apps/hub` · después de T4, `npm run hub:migrate:local` y `npm run dev:hub`, y luego `curl -X POST http://localhost:8788/hub/v1/lists -H "Content-Type: application/json" -d '{"name":"x","songs":[{"videoId":"dQw4w9WgXcQ","title":"t","artist":"a"}]}'`

### T4 · Durable Object de la Jam (cola, votos y WebSocket) · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/hub/src/jam/state.ts`, `apps/hub/src/jam/protocol.ts`, `apps/hub/src/jam/room.ts`, `apps/hub/src/jam/routes.ts`, `apps/hub/test/jamState.test.ts`, `apps/hub/test/jamProtocol.test.ts`
- Leer como contexto: `packages/shared/src/hub.ts` (T2), «Contratos» de este plan, `apps/api/src/routes/youtube.ts` (búsqueda con InnerTube, para copiarla en `/search`)
- Qué hacer:
  - **`state.ts` (puro, sin Cloudflare):**
    - `interface JamItem { id; song; addedById; addedBy; addedAt; voterIds: string[] }`, `interface JamData { code; hostName; hostKeyHash; expiresAt; nowPlaying: JamItem | null; queue: JamItem[] }`;
    - `applyAction(data, actor: JamMember, msg, now, newId) → { data } | { error: HubErrorCode }`, con estas reglas:
      - `add` valida con `sanitizeHubSong`. Si ese videoId ya está en la cola, cuenta como voto de quien lo añade. Si la cola está llena → `queue_full`. Si esa persona ya tiene 10 canciones pendientes → `member_limit`. Quien añade una canción la vota automáticamente.
      - `vote` pone o quita el voto.
      - `remove` lo puede hacer el anfitrión o quien la añadió.
      - `start`, `finish` y `end` solo el anfitrión; si no, → `not_host`.
    - `sortQueue` ordena por votos (de más a menos) y, si empatan, por `addedAt` (de antes a después);
    - `toSnapshot(data, members, viewerId)` calcula `votes`, `votedByMe` y `mine`.
  - **`protocol.ts`:** esquemas zod de `JamClientMessage` y `parseClientMessage(raw: string): JamClientMessage | null`, que rechaza lo que pase de `wsMessageMaxBytes`.
  - **`room.ts`:** `JamRoom extends DurableObject`.
    - Guarda `JamData` en `ctx.storage` (clave `jam`).
    - `init()` comprueba si ya hay una Jam viva y, si no, guarda los datos y pone `setAlarm(expiresAt)`.
    - `fetch()` acepta el WebSocket con `this.ctx.acceptWebSocket(server)`. Si ya hay `jamMaxMembers` sockets, cierra con el error `jam_full`.
    - `webSocketMessage` hace lo siguiente:
      - El primer mensaje debe ser `hello`, con apodo `normalizeNickname`. Si trae `hostKey`, se compara su hash y se pone `isHost`. Guarda el miembro con `ws.serializeAttachment`.
      - Si llega otra cosa antes del `hello` → `error invalid_request`.
      - Tras cada cambio, manda a cada socket su `state` personalizado.
    - `webSocketClose` vuelve a enviar el estado (cambia la lista de conectados).
    - `alarm()` y `end` mandan `{type:'ended'}`, cierran los sockets con 4000 y llaman a `ctx.storage.deleteAll()`.
    - Funciones de menos de 50 líneas: separa `broadcast`, `membersOf` y `handleHello`.
  - **`routes.ts` (`jamRoutes`):**
    - `POST /` aplica el límite y valida `hostName`. Genera un código y un `hostKey` (32 hex) y llama a `stub.init`; si devuelve `false`, reintenta con otro código (máximo 5). Responde 201 `CreatedJam`.
    - `GET /:code` normaliza el código y llama a `stub.info()`; si no hay Jam → 404.
    - `GET /:code/search` comprueba la Jam y el límite y hace la búsqueda InnerTube con `buildSearchRequest`/`parseSearchResponse`. Si falla → 502 `search_unavailable`.
    - `GET /:code/ws` exige `Upgrade: websocket` y devuelve `stub.fetch(c.req.raw)`.
    - Se usa `c.env.JAM.idFromName(code)`.
- TDD: sí (`state.ts` y `protocol.ts`)
- Criterios de aceptación:
  - [ ] Tests de `applyAction`:
    - orden por votos y desempate por hora;
    - añadir algo repetido = votar;
    - quitar el voto;
    - `queue_full` y `member_limit`;
    - un invitado no puede `start`, `finish`, `end` ni borrar canciones de otros;
    - `start` pasa el item a `nowPlaying` y lo quita de la cola.
  - [ ] Tests de `parseClientMessage`: JSON roto → null, tipo desconocido → null, mensaje demasiado grande → null y `add` válido → objeto.
  - [ ] Prueba manual con `npm run dev:hub`: crear una Jam con curl, conectar dos clientes (por ejemplo `npx wscat -c ws://localhost:8788/hub/v1/jams/<code>/ws`), mandar `hello`, `add` y `vote`, y ver que los dos reciben `state`.
- Verificación: `npx vitest run --root apps/hub` · `npm run typecheck -w @aske/hub`

### T5 · Web: compartir una playlist y abrir un enlace compartido · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/hub/sharedList.ts`, `apps/web/src/hub/errors.ts`, `apps/web/test/sharedList.test.ts`, `apps/web/src/stores/sharedLists.ts`, `apps/web/src/components/SharePlaylistSheet.tsx`, `apps/web/src/views/SharedListView.tsx`, `apps/web/src/views/PlaylistView.tsx`, `apps/web/src/views/PlaylistsView.tsx`, `apps/web/src/App.tsx`, `apps/web/src/i18n/share.ts`, `apps/web/src/i18n/{en,es,eu}.ts`, `apps/web/src/help/articles/friends.ts`, `apps/web/src/help/articles.ts`, `apps/web/src/help/articles/types.ts`, `apps/web/src/styles.css`
- Leer como contexto: `apps/web/src/hub/client.ts` (T2), `packages/shared/src/hub.ts` (T2), `apps/web/src/components/LinkDevicePanel.tsx` (QR y compartir), `apps/web/src/components/QrCode.tsx`, `apps/web/src/stores/downloads.ts` (`enqueue` con `playlistName`), `apps/web/src/stores/library.ts`, `apps/web/src/native/platform.ts`, `apps/web/src/native/qrScanner.ts`, `apps/web/src/i18n/pairing.ts` (cómo se organiza un archivo i18n), `apps/web/src/help/articles/cloudflareSetup.ts` (formato de los artículos)
- Qué hacer:
  - **`sharedList.ts` (puro):**
    - `songsFromPlaylist(trackIds, tracks: Record<string, LocalTrack>) → { songs: HubSong[]; skipped: number }`. Solo cuentan las pistas con `source === 'youtube'` y un `sourceRef` válido; las demás suman en `skipped`. Mantiene el orden y quita duplicados.
    - `splitByLibrary(songs, tracks) → { have: string[] /*trackIds*/; missing: HubSong[] }`, comparando por `sourceRef`.
  - **`errors.ts`:** `hubErrorText(err)` traduce un `HubError` o cualquier error a la clave `hub.err.<code>`. Si no lo reconoce, usa `hub.err.internal_error` y lo registra con `console.error` (es un error real, no depuración).
  - **`stores/sharedLists.ts`** (zustand y `savePref`, clave `hub-shares-v1`): guarda `{ playlistId, id, deleteKey, expiresAt }[]` para que el creador pueda «Dejar de compartir». Quita solo las caducadas.
  - **`SharePlaylistSheet`:** se abre con un botón «Compartir» nuevo en la cabecera de `PlaylistView` (solo en playlists normales, no en «Me gusta»).
    - Si no hay ninguna canción de YouTube, lo explica.
    - Si no, crea el enlace y enseña el QR, el enlace, «Compartir» (`navigator.share` o copiar), «Caduca el {fecha}» y, si alguna no se puede compartir, «{n} canciones no se pueden compartir porque no vienen de YouTube».
    - Si ya existe un enlace guardado y vigente para esa playlist, lo reutiliza y ofrece «Dejar de compartir».
    - Si `!hubAvailable()`, sale «Próximamente».
  - **`SharedListView` (ruta `/shared/:id`):**
    - Carga la lista y enseña el nombre, el número de canciones, cuántas ya tienes y la fecha de caducidad.
    - En Android, «Descargar en mi biblioteca» llama a `useDownloads.getState().enqueue(missing, { playlistName: name })`; las canciones que ya tienes se añaden a esa playlist (mira cómo lo hace `enqueue` con `playlistMode` y, si hace falta, usa `useLibrary` para añadir las que tienes).
    - En la web lo explica: «Para descargarlas abre este enlace en la app de Android».
    - Los errores se muestran con `hubErrorText`: caducado, no existe, sin conexión.
  - **`App.tsx`:**
    - Al arrancar, si `parseHubHash(location.hash)` es un `list`, guarda el id en `sessionStorage` (`pending-hub-link`) y limpia el hash con `history.replaceState`. Cuando el Shell esté listo, navega a `/shared/:id`.
    - Si la app aún no está configurada (`status` `choose` o `pair`), muestra `SharedListView` en modo solo lectura en lugar de la bienvenida, con un botón «Empezar a usar Aske Stream» que sigue el flujo normal.
    - Añade la ruta `/shared/:id`.
    - **No** toques el caso `#jam=`, es de T7.
  - **`PlaylistsView`:** botón «Abrir enlace compartido». Abre un diálogo para pegar el enlace y, en Android, también deja escanear el QR con `qrScanner`. Usa `parseHubLink` y navega.
  - **i18n:**
    - Crea `i18n/share.ts` con `shareEn`, `shareEs` y `shareEu`, y añádelos a `en.ts`, `es.ts` y `eu.ts`.
    - Incluye todas las claves `hub.err.*` del contrato, escritas para gente no técnica. Por ejemplo, `expired`: «Este enlace ha caducado. Los enlaces duran 90 días: pide a tu amigo uno nuevo.»
    - Los singulares van con `.one`.
  - **Ayuda:**
    - Sección nueva `friends` («Con amigos» / «With friends» / «Lagunekin») en `types.ts` y en `SECTIONS`.
    - Artículo `share-playlist` en `articles/friends.ts`: qué se comparte (solo los nombres, no la música), los 90 días, que las canciones que no vienen de YouTube no se comparten, y qué hacer si el enlace caduca. Copia literalmente los textos de error que se ven en pantalla.
- TDD: sí en `sharedList.ts` · no en la interfaz
- Criterios de aceptación:
  - [ ] Tests de `songsFromPlaylist` (salta los archivos importados, quita duplicados y mantiene el orden) y de `splitByLibrary`.
  - [ ] Pasa el test de paridad de i18n (es/en/eu) y el de enlaces de ayuda.
  - [ ] A mano, con `VITE_HUB_URL=http://localhost:8788` y el Hub en marcha: compartir una playlist enseña el QR y el enlace; abrir `http://localhost:5173/#list=<id>` lleva a la vista; «Dejar de compartir» hace que el enlace dé «no existe».
- Verificación: `npx vitest run test/sharedList.test.ts --root apps/web` · `npm run check`

### T6 · Web: store de la Jam (conexión, anfitrión y descargas) · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/stores/jam.ts`, `apps/web/src/hub/jamSocket.ts`, `apps/web/src/hub/jamHost.ts`, `apps/web/test/jamHost.test.ts`, `apps/web/test/jamSocket.test.ts`
- Leer como contexto: «Contratos → Store de la Jam» y «WebSocket», `apps/web/src/hub/client.ts` (T2), `apps/web/src/stores/player.ts` (`playTracks` y cómo detectar que una canción acaba o que la cola se queda vacía), `apps/web/src/stores/downloads.ts` (`enqueue` y `jobs` con `videoId`/`trackId`/`status`), `apps/web/src/stores/library.ts` (`tracks`), `apps/web/src/native/platform.ts`, `apps/web/src/lib/storage.ts`
- Qué hacer:
  - **`jamSocket.ts`:**
    - `class JamSocket` con `connect(url, hello)`, `send(msg)`, `close()` y los callbacks `onMessage`, `onStatus`;
    - al abrir manda `hello`;
    - si se cae (y no ha sido con el código 4000 ni por un `ended`), reconecta con espera exponencial (1, 2, 4… hasta 30 s);
    - los `send` sin conexión se guardan en una cola corta (como mucho 20) y se envían al reconectar.
    - Recibe la fábrica de `WebSocket` por parámetro, para poder probarla.
  - **`jamHost.ts` (puro):**
    - `libraryByVideoId(tracks) → Map<videoId, trackId>`;
    - `nextReadyItem(snapshot, ready: Map) → JamItemView | null`: la primera canción de la cola que ya está en la biblioteca;
    - `songsToPrepare(snapshot, ready, inFlight: Set<videoId>) → HubSong[]`.
  - **`stores/jam.ts`:** implementa el contrato.
    - `memberId` con `crypto.randomUUID()`. La sesión se guarda en `localStorage` (`jam-session-v1`) para que `resume()` vuelva a entrar.
    - `create` solo funciona en nativo (si no, `error: 'unavailable'`): llama a `createJam`, guarda `hostKey` y `playlistName` y conecta.
    - `join` llama a `getJam` para comprobar el código (`not_found` → error) y conecta.
    - Al recibir `state`, actualiza el snapshot y, si es el anfitrión, llama a `hostTick()`:
      - `songsToPrepare` → `useDownloads.getState().enqueue(songs, { playlistName })`;
      - con `preparing` sigue las descargas (suscríbete a `useDownloads` y marca `ready` cuando el job con ese `videoId` pase a `done`);
      - si `nowPlaying` es null y no suena nada, `nextReadyItem` → manda `start` y llama a `usePlayer.getState().playTracks([trackId], trackId)`.
    - Suscríbete a `usePlayer` para notar cuando acaba la canción de la Jam (o el anfitrión pasa a otra). Entonces manda `finish` y vuelve a llamar a `hostTick()`.
    - `skip` hace `finish` y luego `hostTick()`.
    - `ended` → `connection: 'ended'`, `endedReason`, borra la sesión guardada y no reconecta.
    - Los errores del servidor van a `error`. **No hay textos en el store**: la UI traduce.
    - Funciones de menos de 50 líneas: separa `hostTick`, `trackPreparing` y `handleServerMessage`.
- TDD: sí (`jamHost.ts` y `jamSocket.ts` con un WebSocket simulado)
- Criterios de aceptación:
  - [ ] Tests de `nextReadyItem`: salta las que no están listas y respeta el orden del snapshot.
  - [ ] Tests de `songsToPrepare`: no repite ni las que están en curso ni las que ya tienes.
  - [ ] Tests de `JamSocket`: manda `hello` al abrir, reconecta tras un cierre anormal, no reconecta con 4000 y envía la cola al reconectar (usa `vi.useFakeTimers`).
  - [ ] `npm run typecheck` pasa.
- Verificación: `npx vitest run test/jamHost.test.ts test/jamSocket.test.ts --root apps/web` · `npm run typecheck -w @aske/web`

### T7 · Web: pantallas de la Jam, entrada por QR, textos y ayuda · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/JamView.tsx`, `apps/web/src/components/jam/*.tsx` (por ejemplo `JamStart.tsx`, `JamRoom.tsx`, `JamQueue.tsx`, `JamAddSheet.tsx` y `JamBanner.tsx`), `apps/web/src/App.tsx`, `apps/web/src/components/Nav.tsx`, `apps/web/src/views/PlaylistsView.tsx` (solo el botón «Jam»), `apps/web/src/i18n/jam.ts`, `apps/web/src/i18n/{en,es,eu}.ts`, `apps/web/src/help/articles/friends.ts`, `apps/web/src/styles.css`
- Leer como contexto: «Contratos → Store de la Jam», `apps/web/src/stores/jam.ts` (T6), `apps/web/src/hub/client.ts` (`searchInJam`), `apps/web/src/hub/errors.ts` (`hubErrorText`, T5), `apps/web/src/components/QrCode.tsx`, `apps/web/src/native/qrScanner.ts`, `apps/web/src/components/ServerUpdateBanner.tsx` (estilo del banner), `apps/web/src/views/SharedListView.tsx` (estilo, T5)
- Qué hacer:
  - **Ruta `/jam` (`JamView`).**
    - Sin sesión (`JamStart`):
      - «Crear una Jam» (solo en Android; en la web, la explicación de que hace falta la app de Android) pide un apodo y llama a `create` con `playlistName` = `t('jam.playlistName', { date })`;
      - «Unirme» pide el código (`normalizeJamCode`) y el apodo, o deja escanear el QR en Android (`parseHubLink`);
      - el apodo se guarda en `localStorage` y se rellena solo la próxima vez.
    - Con sesión (`JamRoom`):
      - el anfitrión ve un QR grande con `hubJamLink(HUB_URL, code)`, el código `formatJamCode`, cuántos hay conectados y cuánto falta para que caduque;
      - todos ven «Sonando ahora» y la cola (`JamQueue`), con el botón de voto (corazón o pulgar, que se marca si `votedByMe`) y el número de votos;
      - el anfitrión además tiene «Quitar», «Poner ahora» y «Siguiente», y ve el estado de preparación (`preparing[videoId]`: «Descargando…» / «Lista» / «No se pudo descargar»);
      - botones «Añadir canción», «Salir» (invitado) y «Terminar la Jam» (anfitrión, con confirmación).
    - `JamAddSheet` tiene dos pestañas:
      1. «Buscar»: `searchInJam` con espera de 400 ms y `hubErrorText` si falla;
      2. «De mi biblioteca»: las pistas de `useLibrary` con `source === 'youtube'` (si la app está configurada).
    - Al terminar (`endedReason`), sale un texto claro: «El anfitrión ha terminado la Jam» o «La Jam ha caducado (duran 12 horas)», con un botón para volver.
  - **`App.tsx`:**
    - Si `parseHubHash(location.hash)` es un `jam`, guarda el código en `sessionStorage` (`pending-jam`) y limpia el hash.
    - Si la app **no** está lista (`choose`/`pair`), muestra `JamView` como invitado a pantalla completa, sin la bienvenida, para que un amigo sin configurar entre directamente.
    - Si está lista, navega a `/jam` con el código ya puesto.
    - Añade la ruta `/jam`, `<JamBanner/>` en el Shell (solo si hay sesión y no estás en `/jam`: «Estás en la Jam ABC-DEF · Abrir») y una llamada a `useJam.getState().resume()` al montar el Shell.
  - **`Nav.tsx`:** añade `{ to: '/jam', key: 'nav.jam', Icon: PartyPopper }` solo en `SIDEBAR_ITEMS`. En el móvil se entra con el botón «Jam» nuevo de la cabecera de `PlaylistsView` y con el banner.
  - **i18n:** `i18n/jam.ts` con `jamEn`, `jamEs` y `jamEu`, añadidos a `en.ts`, `es.ts` y `eu.ts`, incluida `nav.jam`. Errores en lenguaje sencillo, por ejemplo `member_limit`: «Ya tienes 10 canciones esperando. Cuando suene alguna podrás añadir más.»
  - **Ayuda:** artículo `jam` en `articles/friends.ts` (regístralo en `ARTICLES` si T5 no lo dejó automático). Explica qué es una Jam, que solo suena el móvil del anfitrión, cómo entrar con QR o código, cómo votar, que dura 12 horas, que las canciones se quedan en la playlist «Jam dd/mm» del anfitrión y qué hacer si no se conecta.
  - Ningún componente de más de 50 líneas por función ni archivo de más de 400 líneas. Divide en `components/jam/`.
- TDD: no (interfaz). Los tests de paridad de i18n y de enlaces de ayuda deben pasar.
- Criterios de aceptación:
  - [ ] Con el Hub local (`npm run dev:hub` + `VITE_HUB_URL=http://localhost:8788`), en dos pestañas: una crea la Jam en modo `fakenative`, la otra entra con `http://localhost:5173/#jam=<code>` sin configurar nada, añade una canción y vota, y el anfitrión lo ve al momento.
  - [ ] Terminar la Jam muestra el mensaje de fin en las dos pestañas.
  - [ ] Todo está traducido a es, en y eu, y hay artículo `jam` enlazado desde la pantalla de la Jam (icono de ayuda).
  - [ ] `npm run check` pasa.
- Verificación: `npm run check` · prueba manual descrita · build `npm run build -w @aske/web -- --mode fakenative` y luego reconstruir el dist normal

## Orden de ejecución

- **Grupo A:** T1 y T2 en paralelo.
- **Grupo B:** T3, T4, T5 y T6 en paralelo. Necesitan T2. T3 y T4 comparten el workspace `apps/hub`, pero no tocan los mismos archivos, y el typecheck del hub solo pasa con los dos terminados.
- **Grupo C:** T7. Necesita T5 (`App.tsx`, i18n, ayuda, `hubErrorText`) y T6 (store).
- **Al final, el orquestador:** actualiza `docs/ESTADO.md` y la fila 7 de la tabla de fases de `docs/v2/architecture.md`, y ejecuta `npm run check` y `npm run test:e2e`.

## Riesgos / dudas abiertas

1. **¿El Hub sirve también la web, para entrar a una Jam desde el navegador sin la app?**
   - **Sí (Recomendada):** un amigo con iPhone o sin la app escanea el QR con la cámara y entra al momento. Los estáticos son gratis, pero el Hub sirve la versión de la web que Andoni haya desplegado la última vez.
   - **No:** el QR solo funciona dentro de la app (Android o la web de cada uno). Es más sencillo, pero quien no tenga la app no puede entrar.
   - Por qué la recomiendo: las Jams son en persona y lo normal es que alguien no tenga la app instalada.
2. **¿Cómo añaden canciones los invitados?**
   - **Buscador del Hub + su propia biblioteca (Recomendada):** funciona en cualquier móvil, incluido iPhone. Cuesta peticiones al Hub, limitadas por IP y solo con una Jam viva.
   - **Solo de su biblioteca:** no gasta nada en el Hub, pero un amigo sin música de YouTube no puede añadir nada.
   - **Además, pegar un enlace de YouTube:** más flexible, pero el título habría que sacarlo de YouTube desde el Hub (más trabajo); mejor dejarlo para después.
   - Por qué la recomiendo: es la única que sirve a todos sin complicar el MVP.
3. **¿Quién puede ser anfitrión?**
   - **Solo la app Android (Recomendada):** puede descargar con yt-dlp las canciones que le falten.
   - **También la web:** solo podría poner canciones que ya tiene en su biblioteca, así que muchas de la cola no sonarían.
   - Por qué la recomiendo: el anfitrión necesita poder bajar lo que piden los demás.
4. **Votos.**
   - **Solo «me gusta», que se puede quitar (Recomendada):** sencillo y amable.
   - **A favor y en contra:** se pueden hundir canciones, pero es más lioso y puede sentar mal.
   - Por qué la recomiendo: encaja con un grupo de amigos y es más fácil de entender.
5. **Por dónde se entra a la Jam en el móvil.**
   - **Botón «Jam» en Playlists + banner mientras estás en una + barra lateral en escritorio (Recomendada):** no cambia las 5 pestañas, pero está un poco escondido.
   - **Sustituir una pestaña de abajo (por ejemplo Podcasts) por Jam:** se ve más, pero mueve algo que ya se usa.
   - Por qué la recomiendo: no rompe la costumbre de quien ya usa la app.
6. **Despliegue del Hub (lo hace Andoni):** crear el D1 `aske-hub`, poner su id en `apps/hub/wrangler.jsonc`, migrar, desplegar y pasar la URL para `HUB_URL` (`https://aske-hub.<su-subdominio>.workers.dev`). Hasta entonces, la app enseña «Próximamente».
7. **`package-lock.json` y regla de publicación:** el workspace nuevo obliga a actualizar el lockfile una vez (T3 usa `npm install --package-lock-only`, con revisión del diff). La regla de release pasa de «6 `package.json`» a 7 (se añade `apps/hub`): Andoni tiene que aprobar el cambio en `CLAUDE.md`.
8. **Límites de uso** (20 listas/h, 10 Jams/h y 60 búsquedas cada 10 min por IP; 30 personas y 200 canciones por Jam; 10 pendientes por persona): son una propuesta; confirmar o ajustar.
9. **Plan gratuito:** los Durable Objects gratis exigen el backend SQLite (`new_sqlite_classes`) y conviene la hibernación de WebSocket. Si Cloudflare cambiara esto, habría que revisar `wrangler.jsonc`. Sin probar en una cuenta real.
10. **El «Enviar al móvil» a través del Hub** (para quien no usa Cloudflare) sale en `architecture.md`, pero queda **fuera** de esta F7. ¿Va en otra fase?

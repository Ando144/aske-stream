# PLAN: Fase 6 — Asistente de Cloudflare, emparejar por QR/código y actualización guiada del Worker

Fecha: 2026-11-20 · Estado: COMPLETADO

## Objetivo

Que un amigo sin perfil técnico monte su propio Cloudflare (Worker + D1 + R2) desde la app Android
pegando un token, que cualquier dispositivo ya vinculado pueda vincular otro con un QR (o un código
corto para el ordenador) y que el servidor se actualice con un botón «Actualizar» cuando la app sea
más nueva. Se hace en dos fases: **6.1 (emparejar)** y **6.2 (montar y actualizar)**. La 6.2 no
empieza hasta que la 6.1 pase `npm run check` y `npm run test:e2e`.

## Decisiones de arquitectura

Decididas por Andoni (2026-11-20):

- **QR dibujado con la librería `uqr`** — pequeña, sin dependencias y MIT; el lockfile se revisa en T5.
- **Aviso de servidor desactualizado**: siempre en Ajustes y un banner cerrable **una vez por versión**; aviso fuerte (toast) solo si algo falla por servidor antiguo — informa sin agobiar.
- **La `ACCESS_KEY` que crea el asistente no se guarda ni se muestra** — se vincula con QR o código; solo vive en memoria hasta emparejar.
- **Dirección `workers.dev`**: si la cuenta no tiene, se propone `aske-` + 4 caracteres y se puede cambiar — menos pasos.

Del arquitecto:

- **Código de emparejamiento corto, de un solo uso, guardado en D1** (8 caracteres, 10 min, se guarda su SHA-256) — el QR no lleva la clave ni un token de larga duración, y el código se puede teclear en un ordenador.
- **El QR es un enlace normal** `https://<worker>/#code=ABCD2345` — si se escanea con la cámara del móvil abre la web y empareja igual; el fragmento `#` no llega a los logs del servidor.
- **El código de texto no es opcional**: es la única forma de vincular el ordenador (la web no puede escanear y, tras el asistente, nadie conoce la clave). Por eso se incluye sin preguntar.
- **QR en Android con Google Code Scanner** (`play-services-code-scanner`) — no pide permiso de cámara y ya usamos Play services; si no está disponible, se teclea el código.
- **Toda la lógica de Cloudflare en TypeScript; el plugin Java solo hace HTTP** a `https://api.cloudflare.com/client/v4` — así se prueba con Vitest y una API simulada; el plugin evita CORS y no registra nada.
- **Todo el multipart es texto** (`?base64=true` en la subida de archivos y el módulo JS como texto) — el plugin no necesita manejar binarios.
- **El APK lleva un paquete `cf-bundle/`** (Worker ya empaquetado por `wrangler deploy --dry-run`, copia de `apps/web/dist` sin `.map` y `manifest.json` con versión, migraciones y hashes) — la web que sirve el Worker del amigo es la build PWA normal, no la de Android.
- **Migraciones compatibles con wrangler**: se usa la misma tabla `d1_migrations` — Andoni puede seguir usando `npm run db:migrate:remote` sin conflictos.
- **Montaje y actualización comparten pasos idempotentes** (reutilizan D1, R2 y subdominio si existen); el montaje crea una `ACCESS_KEY` nueva; la actualización la conserva con `keep_bindings`.
- **El token de Cloudflare vive solo en una variable de módulo** (no en zustand, ni en localStorage, ni en errores) y se borra en `finally` — cumple «nunca se guarda ni se registra».
- **Versión del Worker en `GET /api/health`** (`{ ok, version }`); sin `version` = Worker antiguo — permite comparar con `__APP_VERSION__` y sustituye `toast.cloudflareOutdated`.
- **Textos de cada fase en un módulo i18n propio** (`i18n/pairing.ts`, `i18n/cloudflareSetup.ts`) que se mezclan en `en/es/eu.ts` — `en.ts` ya tiene 668 líneas y así no pasa de 800.

## Contratos (interfaces compartidas)

### Worker (Fase 6.1, T3)

- `GET /api/health` (público) → `{ ok: true, version: string }` (versión de `apps/api/package.json`).
- `POST /api/auth/pairing-codes` (requiere estar vinculado o la clave) → `201 { code: string, expiresAt: number }`.
  `code` = 8 caracteres sin guion. Borra los códigos anteriores (solo hay uno activo). Caduca en 10 min.
- `POST /api/auth/pair` acepta `{ key }` **o** `{ code }`. Con `code`: si es válido, no ha caducado y
  tiene menos de 5 intentos fallidos, se borra (un solo uso) y responde igual que con la clave
  (`{ paired: true, token }` + cookie). Si no: suma 1 a `attempts` de los códigos activos, borra los que
  lleguen a 5 o hayan caducado y responde `401 { error: 'invalid_code' }`.
- Migración `apps/api/migrations/0007_pairing_codes.sql`:
  `CREATE TABLE pairing_codes (code_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);`

### `@aske/shared` (Fase 6.1, T1) — subrutas nuevas, sin tocar `index.ts`

`packages/shared/package.json` → `exports`: `"./pairing": "./src/pairing.ts"`, `"./version": "./src/version.ts"`.

```ts
// @aske/shared/pairing
export const PAIRING_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 símbolos, sin 0/1/I/O
export const PAIRING_CODE_LENGTH = 8;
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
export const PAIRING_MAX_ATTEMPTS = 5;
/** Mayúsculas, quita espacios y guiones; null si no son 8 símbolos del alfabeto. */
export function normalizePairingCode(input: string): string | null;
/** 'ABCD2345' → 'ABCD-2345' */
export function formatPairingCode(code: string): string;
/** `${baseUrl}/#code=${code}` (baseUrl sin barra final). */
export function pairingLink(baseUrl: string, code: string): string;
/** Acepta https:// (o http:// solo para localhost, 127.0.0.1 y 10.0.2.2). Devuelve el origin y el código normalizado. */
export function parsePairingLink(text: string): { baseUrl: string; code: string } | null;
// @aske/shared/version
/** Compara x.y.z numéricamente (ignora sufijos tipo -beta). Texto no válido cuenta como 0.0.0. */
export function compareVersions(a: string, b: string): -1 | 0 | 1;
/** true si `server` es undefined/vacío o menor que `app`. */
export function isServerOutdated(server: string | undefined, app: string): boolean;
```

### Puentes nativos (TypeScript)

```ts
// apps/web/src/native/qrScanner.ts (Fase 6.1, T2) — plugin Java 'QrScanner'
export interface QrScannerPlugin {
  scan(): Promise<{ text: string }>;
}
// Rechaza con code 'cancelled' (el usuario cerró) o 'unavailable' (sin Play services / módulo).
export const QrScanner: QrScannerPlugin;
export function scanQr(): Promise<string | null>; // null = cancelado; lanza Error('qr_unavailable')

// apps/web/src/native/cloudflareApi.ts (Fase 6.2, T7) — plugin Java 'CloudflareApi'
export interface FormPart {
  name: string;
  value: string;
  filename?: string;
  contentType?: string;
}
export interface CfRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string; // empieza por '/', relativo a https://api.cloudflare.com/client/v4
  bearer: string; // token de API o JWT de subida de archivos
  json?: unknown; // cuerpo JSON (excluyente con form)
  form?: FormPart[]; // multipart/form-data, solo partes de texto
}
export interface CfResponse {
  status: number;
  body: string;
}
export type CfTransport = (req: CfRequest) => Promise<CfResponse>;
export const nativeCfTransport: CfTransport; // rechaza Error('network') si no hay conexión
```

### Cliente de API web (Fase 6.1, T4) — `apps/web/src/api/client.ts`

- `health: () => json<{ ok: boolean; version?: string }>('/api/health')`
- `pairWithCode(code: string) → { paired: boolean; token: string }` (POST `/api/auth/pair` con `{ code }`)
- `createPairingCode() → { code: string; expiresAt: number }`
- `useSetup.getState().connectWithCode(code: string, baseUrl = '')`: igual que `connectCloudflare` pero con código.

### Paquete del Worker dentro del APK (Fase 6.2, T8)

Archivos servidos por la WebView de Android (`https://localhost`):
`/cf-bundle/manifest.json`, `/cf-bundle/index.js`, `/cf-bundle/site/<ruta>` (copia de `apps/web/dist` sin `*.map`).

```ts
export interface WorkerBundleManifest {
  version: string; // versión de package.json raíz
  compatibilityDate: string; // de apps/api/wrangler.jsonc
  mainModule: 'index.js';
  migrations: { name: string; sql: string }[]; // apps/api/migrations/*.sql ordenadas por nombre
  assets: Record<string, { hash: string; size: number }>; // claves '/index.html', '/assets/x.js'…
}
// hash = sha256(base64(contenido) + extensión sin punto).hex().slice(0, 32)  (ejemplo de la doc de Cloudflare)
```

### Cliente de Cloudflare (Fase 6.2, T9) — `apps/web/src/cloudflare/`

```ts
// types.ts
export const SCRIPT_NAME = 'aske-stream', D1_NAME = 'aske-stream', BUCKET_NAME = 'aske-stream-media';
export const TOKEN_CREATE_URL: string; // enlace a dash.cloudflare.com/profile/api-tokens con permisos precargados
export type CfErrorCode = 'invalid_token' | 'missing_permission' | 'r2_not_enabled' | 'subdomain_taken'
  | 'subdomain_invalid' | 'network' | 'rate_limited' | 'not_found' | 'unknown';
export class CfError extends Error { constructor(code: CfErrorCode, status: number, cfCodes: number[]) }
// api.ts
export interface CfApi {
  call<T>(method: CfRequest['method'], path: string, body?: { json?: unknown; form?: FormPart[] }, bearer?: string): Promise<T>;
}
export function createCfApi(transport: CfTransport, token: string): CfApi; // desempaqueta { success, errors, result }
// resources.ts
verifyToken(api): Promise<void>;
listAccounts(api): Promise<{ id: string; name: string }[]>;
getSubdomain(api, accountId): Promise<string | null>;
createSubdomain(api, accountId, name): Promise<string>;
scriptExists(api, accountId): Promise<boolean>;
ensureD1(api, accountId): Promise<string>;      // uuid
ensureR2(api, accountId): Promise<void>;
// migrations.ts
pendingMigrations(applied: string[], all: Migration[]): Migration[];
applyMigrations(api, accountId, dbId, all, onProgress?: (done: number, total: number) => void): Promise<number>;
// deploy.ts
uploadAssets(api, accountId, manifest, readAsset: (path: string) => Promise<string /*base64*/>, onProgress?): Promise<string /*jwt final*/>;
uploadScript(api, accountId, o: { code: string; manifest: WorkerBundleManifest; assetsJwt: string; d1Id: string; accessKey?: string }): Promise<void>;
enableWorkersDev(api, accountId): Promise<void>;
workerUrl(subdomain: string): string; // https://aske-stream.<subdomain>.workers.dev
```

### Orquestación y estado (Fase 6.2, T10)

```ts
// cloudflare/bundle.ts
export interface WorkerBundle { manifest: WorkerBundleManifest; code: string; readAsset(path: string): Promise<string> }
export function loadBundle(fetchFn?: typeof fetch): Promise<WorkerBundle>; // Error('bundle_missing') si no existe
// cloudflare/setup.ts
export type SetupStep = 'account' | 'subdomain' | 'database' | 'storage' | 'migrations' | 'files' | 'worker' | 'publish' | 'waiting';
export type SetupErrorCode = CfErrorCode | 'no_account' | 'wrong_account' | 'bundle_missing' | 'not_live_yet';
runSetup(o: { api; bundle; accountId; subdomain: string; onStep(s: SetupStep): void }): Promise<{ baseUrl: string; accessKey: string }>;
runUpdate(o: { api; bundle; accountId; onStep }): Promise<{ baseUrl: string }>;
waitUntilLive(baseUrl, version, o?: { fetchFn?; tries?: number; delayMs?: number }): Promise<void>; // por defecto 36 × 5 s
// stores/cloudflareSetup.ts (zustand; el token NO está en el estado)
mode: 'setup' | 'update'; phase: 'intro' | 'account' | 'r2' | 'token' | 'chooseAccount' | 'chooseSubdomain' | 'confirmExisting' | 'running' | 'done' | 'error';
step: SetupStep | null; error: SetupErrorCode | null; accounts; suggestedSubdomain;
start(mode), next(), back(), submitToken(token), pickAccount(id), chooseSubdomain(name), confirmExisting(), retry(), cancel()
// stores/serverUpdate.ts
serverVersion: string | null; outdated: boolean; dismissedVersion: string | null;
check(): Promise<void>; markOutdated(): void; dismiss(): void;
// stores/setup.ts: nuevo Status 'cloudflareSetup' + openCloudflareSetup() + closeCloudflareSetup()
```

Claves i18n de error: `cfsetup.error.<SetupErrorCode>` (las escribe T11).

## Tareas

## Fase 6.1 — Vincular dispositivos con QR o código

### T1 · Utilidades compartidas de emparejamiento y versiones · Grupo A · Estado: HECHA

- Archivos (exclusivos): `packages/shared/src/pairing.ts`, `packages/shared/src/version.ts`, `packages/shared/package.json` (solo `exports`), `packages/shared/test/pairing.test.ts`, `packages/shared/test/version.test.ts`
- Leer como contexto: `packages/shared/src/folders.ts` (estilo), `apps/web/src/lib/url.ts`
- Qué hacer: implementar exactamente las funciones de «@aske/shared» de Contratos. Tests primero. Casos: minúsculas, espacios y guiones aceptados; `O`, `0`, `1`, `I` rechazados; longitud distinta de 8 rechazada; `parsePairingLink` rechaza `javascript:`, `http://` en dominios públicos, enlaces sin `#code`, códigos no válidos; acepta `https://aske-stream.x.workers.dev/#code=abcd-2345` y quita ruta y barra final. `compareVersions('0.10.0','0.9.9') === 1`, `isServerOutdated(undefined,'0.6.0') === true`.
- TDD: sí
- Criterios de aceptación:
  - [ ] Todas las funciones del contrato existen con esas firmas y se importan como `@aske/shared/pairing` y `@aske/shared/version`.
  - [ ] Tests cubren los casos anteriores y pasan.
- Verificación: `npx vitest run --root packages/shared` y `npm run typecheck`

### T2 · Escáner de QR nativo (Android) · Grupo A · Estado: HECHA

- Archivos (exclusivos): `apps/mobile/android/app/src/main/java/io/github/ando144/askestream/QrScannerPlugin.java` (nuevo), `.../MainActivity.java`, `apps/mobile/android/app/build.gradle`, `apps/mobile/android/variables.gradle`, `apps/web/src/native/qrScanner.ts` (nuevo), `apps/web/test/fake-native/qrScanner.ts` (nuevo), `apps/web/vite.config.ts`
- Leer como contexto: `GoogleDrivePlugin.java` (patrón de plugin), `apps/web/src/native/askeNative.ts`, `apps/web/test/fake-native/askeNative.ts`
- Qué hacer: plugin Capacitor `QrScanner` con método `scan()` usando `GmsBarcodeScanning` (`com.google.android.gms:play-services-code-scanner`, versión en `variables.gradle`, formato `FORMAT_QR_CODE`). Éxito → `{ text: rawValue }`; cancelado → `call.reject(..., "cancelled")`; fallo o sin módulo → `"unavailable"`. Registrar en `MainActivity`. Puente TS según Contratos (`scanQr` traduce los códigos). Fake: devuelve `window.__askeFakeQr` si existe, si no `null`. Añadir el alias `/native\/qrScanner$/` en `vite.config.ts` (modo fakenative). No pedir permiso de cámara.
- TDD: no
- Criterios de aceptación:
  - [ ] `npm run typecheck` pasa; `npx vite build --mode fakenative -w @aske/web` usa el fake.
  - [ ] El Java compila con el mismo estilo que los demás plugins y no registra el contenido escaneado.
- Verificación: `npm run check` (el APK lo compila la CI; si hay ANDROID_HOME, `npm run android:apk`)

### T3 · Worker: códigos de emparejamiento y versión · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/api/migrations/0007_pairing_codes.sql`, `apps/api/src/lib/pairing.ts` (nuevo), `apps/api/src/routes/auth.ts`, `apps/api/src/version.ts` (nuevo), `apps/api/src/index.ts` (solo `/api/health`), `apps/api/tsconfig.json` (si hace falta `resolveJsonModule`), `apps/api/test/pairing.test.ts` (nuevo), `scripts/smoke.mjs`
- Leer como contexto: `apps/api/src/lib/auth.ts`, `apps/api/src/lib/crypto.ts`, `apps/api/src/lib/http.ts`, `packages/shared/src/pairing.ts`
- Qué hacer: según Contratos/Worker. `version.ts` exporta `WORKER_VERSION` importando `../package.json`. `lib/pairing.ts`: `generatePairingCode()` con `crypto.getRandomValues` sobre `PAIRING_CODE_ALPHABET`, `hashPairingCode(code)` (SHA-256 hex), `claimPairingCode(db, code, now)` (DELETE … RETURNING atómico; si falla, sube intentos y limpia). En `/pair`, el cuerpo es `z.union([{key},{code}])`; llamar a `getAccessKey` antes de tocar la BD (falla cerrado). `/pairing-codes` usa `requireAuth` en la propia ruta (el router de auth se monta antes del middleware global). Errores en JSON `{ error, message }`. Smoke: pasos «health devuelve versión», «crear código con la clave», «emparejar con el código», «el código no sirve dos veces», «código erróneo → 401».
- TDD: sí (unitarios de generación/normalización/hash; flujo con BD en smoke)
- Criterios de aceptación:
  - [ ] Un código vale una sola vez y caduca a los 10 min; 5 fallos lo invalidan.
  - [ ] `/api/health` devuelve `version` igual a `apps/api/package.json`.
  - [ ] Emparejar con `key` sigue igual (smoke existente pasa).
- Verificación: `npx vitest run --root apps/api`, `npm run db:migrate:local`, `npm run check`, `npm run test:e2e`

### T4 · Web: lógica de emparejar con código · Grupo B · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/api/client.ts`, `apps/web/src/stores/setup.ts`, `apps/web/test/pairing.test.ts` (nuevo)
- Leer como contexto: `apps/web/test/homesPinOutdated.test.ts` (cómo se simula `api`), `packages/shared/src/pairing.ts`
- Qué hacer: añadir al cliente `health` con `version?`, `pairWithCode`, `createPairingCode` (Contratos). En `setup.ts`, `connectWithCode(code, baseUrl = '')`, que normaliza con `normalizePairingCode` (si es null lanza `ApiError` 401 `invalid_code` sin llamar a la red), reutiliza la misma lógica que `connectCloudflare` (extraer una función común para no duplicar y mantener <50 líneas).
- TDD: sí
- Criterios de aceptación:
  - [ ] Con código válido guarda `{ baseUrl, token }` igual que con clave (token solo si hay `baseUrl`).
  - [ ] Si falla, vuelve a la configuración anterior (como `connectCloudflare`).
- Verificación: `npx vitest run test/pairing.test.ts --root apps/web`, `npm run typecheck`

### T5 · Web: pantallas de vincular (QR, código y escáner) · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/components/LinkDevicePanel.tsx` (nuevo), `apps/web/src/components/QrCode.tsx` (nuevo), `apps/web/src/views/PairView.tsx`, `apps/web/src/views/SettingsView.tsx` (solo insertar el panel), `apps/web/src/i18n/pairing.ts` (nuevo), `apps/web/src/i18n/{en,es,eu}.ts` (solo el spread del módulo), `apps/web/package.json` + `package-lock.json` (dependencia `uqr`), estilos en el CSS existente si hace falta
- Leer como contexto: `apps/web/src/components/AppUpdatePanel.tsx`, `apps/web/src/native/qrScanner.ts`, `apps/web/src/native/platform.ts`, `apps/web/test/i18n.test.ts`
- Qué hacer:
  - `QrCode.tsx`: usa `encode()` de `uqr` y pinta `<svg>` con `<rect>` (sin `dangerouslySetInnerHTML`). Añadir `uqr` con `npm install uqr -w @aske/web` y comprobar con `git diff package-lock.json` que SOLO se añaden entradas de `uqr`; si se reescribe más, revertir el lockfile, no seguir con `QrCode.tsx` y avisar al orquestador (decisión de Andoni: usar `uqr`, no copiar un generador).
  - `LinkDevicePanel` (en Ajustes, solo si `home === 'cloudflare'`, web y Android): botón «Vincular otro dispositivo» → `createPairingCode()` → muestra QR de `pairingLink(base, code)` (base = `config.cloudflare.baseUrl || location.origin`), el código con `formatPairingCode`, la dirección, cuenta atrás y «Compartir enlace» (`navigator.share`, si no, copiar). Al caducar: «Crear otro código».
  - `PairView`: en Android, botón principal «Escanear código QR» (`scanQr` → `parsePairingLink` → `connectWithCode`); debajo, dirección + código. En la web del propio servidor, solo el campo de código. La clave de acceso pasa a «Otras formas de entrar» (plegado). Leer `#code=` del hash igual que `#key=` y emparejar solo.
  - Textos en `i18n/pairing.ts` (`pairingEn` como objeto, `pairingEs/Eu: Record<keyof typeof pairingEn, string>`), sin jerga; errores: código mal escrito, caducado o ya usado, QR que no es de Aske Stream, escáner no disponible («escribe el código»).
- TDD: no
- Criterios de aceptación:
  - [ ] Test de paridad i18n pasa; ningún texto fijo en los componentes.
  - [ ] Los errores 401 `invalid_code` se muestran como «El código no es correcto o ha caducado. Pide uno nuevo».
  - [ ] Funciones de menos de 50 líneas; `PairView.tsx` < 300 líneas (extraer subcomponentes si hace falta).
- Verificación: `npm run check`, `npm run test:e2e`, `npx vite build --mode fakenative -w @aske/web`

### T6 · Ayuda y documentación de la 6.1 · Grupo C · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/help/articles/cloudflare.ts`, `docs/architecture.md`, `docs/adr/0003-single-owner-auth.md`
- Leer como contexto: `apps/web/src/help/articles/types.ts`, `apps/web/test/help.test.ts`, este PLAN (Contratos)
- Qué hacer: artículo nuevo `link-device` (eu/es/en): cómo vincular el móvil con el QR y el ordenador con el código, que caduca en 10 minutos y sirve una vez, qué hacer si el escáner no se abre. Actualizar `cloudflare-connect` para mencionar el QR. En `architecture.md`: tabla de API (`/api/auth/pairing-codes`, `pair` con `code`, `health` con `version`) y diagrama. ADR 0003: nota breve del código de un solo uso.
- TDD: no
- Criterios de aceptación:
  - [ ] `help.test.ts` pasa (enlaces válidos y tres idiomas).
- Verificación: `npx vitest run test/help.test.ts --root apps/web`, `npm run format:check`

## Fase 6.2 — Montar Cloudflare desde la app y actualizar el Worker (solo Android)

### T7 · Plugin nativo de la API de Cloudflare · Grupo D · Estado: HECHA

- Archivos (exclusivos): `.../askestream/CloudflareApiPlugin.java` (nuevo), `.../MainActivity.java`, `apps/web/src/native/cloudflareApi.ts` (nuevo), `apps/web/test/fake-native/cloudflareApi.ts` (nuevo), `apps/web/vite.config.ts`
- Leer como contexto: `DownloaderPlugin.java` (hilos en segundo plano), `apps/web/src/native/googleDrive.ts`
- Qué hacer: método `request(CfRequest)` → `{ status, body }` con `HttpURLConnection` en un `ExecutorService`. URL = `https://api.cloudflare.com/client/v4` + `path`; rechazar `path` que no empiece por `/` o contenga `..`, `://` o `@`. Cabecera `Authorization: Bearer <bearer>`. `json` → `application/json`; `form` → multipart con boundary aleatorio (partes de texto con `filename` y `Content-Type` opcionales). Timeouts: 30 s conexión, 120 s lectura. Sin conexión → `reject("network")`. **Nunca** registrar URL con datos, cabeceras ni cuerpo. Puente TS `nativeCfTransport` (Contratos). Fake: responde con un manejador `window.__askeFakeCf?.(req)` o rechaza `network`. Alias en `vite.config.ts`.
- TDD: no
- Criterios de aceptación:
  - [ ] No hay `Log.*` con el token ni con cuerpos; solo dominio fijo de Cloudflare.
  - [ ] `npm run typecheck` y build fakenative pasan.
- Verificación: `npm run check`; APK en la CI (`workflow_dispatch` de `android.yml`)

### T8 · Paquete del Worker dentro del APK · Grupo D · Estado: HECHA

- Archivos (exclusivos): `scripts/bundle-worker.mjs` (nuevo), `scripts/lib/worker-bundle.mjs` (nuevo, funciones puras), `scripts/lib/worker-bundle.test.mjs` (nuevo), `apps/mobile/package.json` (script `build:web`), `package.json` raíz (script `test:scripts` y añadirlo a `check`), `.gitignore` si hace falta
- Leer como contexto: `apps/api/wrangler.jsonc`, `apps/web/vite.config.ts`, `.github/workflows/android.yml`, `scripts/cf-setup.mjs`
- Qué hacer: `build:web` de mobile pasa a `npm run build -w @aske/web && npm run build:android -w @aske/web && node ../../scripts/bundle-worker.mjs`. El script: ejecuta `npx wrangler deploy --dry-run --outdir <temp>` en `apps/api` (sin login), copia el `index.js` resultante a `apps/web/dist-android/cf-bundle/index.js`, copia `apps/web/dist` (sin `*.map`) a `cf-bundle/site/`, y escribe `manifest.json` (Contratos) con versión del `package.json` raíz, `compatibility_date` leída de `wrangler.jsonc` (quitar comentarios antes de parsear) y migraciones ordenadas. Puras y probadas con `node --test`: `assetHash(buffer, path)`, `buildAssetManifest(files)`, `readCompatibilityDate(jsoncText)`, `sortMigrations(names)`. Mensajes de error claros si falta `apps/web/dist`. Borrar el temporal con reintento (en Windows da EPERM).
- TDD: sí (funciones puras)
- Criterios de aceptación:
  - [ ] Tras `npm run build:web -w @aske/mobile`, existen `dist-android/cf-bundle/{index.js,manifest.json,site/index.html}`.
  - [ ] `manifest.json` lista las 7 migraciones y todos los archivos de `site/` con hash de 32 hex.
  - [ ] `npm run test:scripts` pasa y está dentro de `npm run check`.
- Verificación: `npm run test:scripts`, `npm run build:web -w @aske/mobile`, `npm run check`

### T9 · Cliente de la API de Cloudflare · Grupo D · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/cloudflare/types.ts`, `apps/web/src/cloudflare/api.ts`, `apps/web/src/cloudflare/resources.ts`, `apps/web/src/cloudflare/migrations.ts`, `apps/web/src/cloudflare/deploy.ts`, `apps/web/test/cloudflare/*.test.ts`, `apps/web/test/cloudflare/fakeCloudflare.ts` (API simulada)
- Leer como contexto: este PLAN (Contratos y Riesgos). Importar `CfTransport`, `FormPart` solo como tipos de `native/cloudflareApi.ts`; si T7 aún no existe, declarar los tipos en `types.ts` y que T7 los reexporte (avisar en el informe).
- Qué hacer (llamadas a la API v4):
  - `api.ts`: parsea `{ success, errors[{code,message}], result }`; mapea a `CfError`: 401/403 con código 10000/9109 → `invalid_token` o `missing_permission`; 10042 → `r2_not_enabled`; 429 → `rate_limited`; 404 → `not_found`; transporte rechazado → `network`. El mensaje del error **nunca** incluye el token.
  - `resources.ts`: `GET /user/tokens/verify` (status `active`), `GET /accounts`, `GET|PUT /accounts/{id}/workers/subdomain`, `GET /accounts/{id}/workers/scripts/aske-stream/settings` (existe o 404), `GET /accounts/{id}/d1/database?name=aske-stream` → si no, `POST …/d1/database {name}`, `GET /accounts/{id}/r2/buckets/aske-stream-media` → si 404, `POST …/r2/buckets {name}`. Validar subdominio `^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$` → `subdomain_invalid`.
  - `migrations.ts`: `POST /accounts/{id}/d1/database/{db}/query` con `CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`, leer `SELECT name FROM d1_migrations`, aplicar pendientes en orden (una llamada con el SQL del archivo) y después `INSERT INTO d1_migrations (name) VALUES (?)` con `params`.
  - `deploy.ts`: `POST /accounts/{id}/workers/scripts/aske-stream/assets-upload-session { manifest }` → `{ jwt, buckets }`; por cada bucket `POST /accounts/{id}/workers/assets/upload?base64=true` con `bearer = jwt` de sesión y partes `name=hash, value=base64, filename=hash, contentType` por extensión; jwt final = el de la última respuesta (o el de la sesión si no hay buckets). `PUT /accounts/{id}/workers/scripts/aske-stream` multipart: parte `metadata` (JSON: `main_module: 'index.js'`, `compatibility_date`, `bindings` D1 `DB`, R2 `BUCKET`, assets `ASSETS` y, si hay `accessKey`, `secret_text ACCESS_KEY`; `keep_bindings: ['secret_text','plain_text']` cuando no hay `accessKey`; `assets: { jwt, config: { not_found_handling: 'single-page-application', run_worker_first: ['/api/*','/media/*'] } }`; `observability: { enabled: true }`) y parte `index.js` con `contentType: 'application/javascript+module'`. `POST …/scripts/aske-stream/subdomain { enabled: true, previews_enabled: false }`.
  - `TOKEN_CREATE_URL`: `https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=` + JSON codificado `[{"key":"workers_scripts","type":"edit"},{"key":"d1","type":"edit"},{"key":"workers_r2","type":"edit"},{"key":"account_settings","type":"read"}]` + `&name=Aske%20Stream&accountId=*&zoneId=all`.
  - Funciones <50 líneas; cada archivo <300.
- TDD: sí (API simulada que guarda las peticiones y responde con fixtures)
- Criterios de aceptación:
  - [ ] Tests de cada mapeo de error, de idempotencia (D1/R2 existentes no se recrean), de migraciones pendientes y de la forma exacta del multipart y de `metadata`.
  - [ ] Ningún test ni error contiene el token en mensajes.
- Verificación: `npx vitest run test/cloudflare --root apps/web`, `npm run typecheck`

### T10 · Orquestación del montaje/actualización y estado · Grupo E · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/cloudflare/bundle.ts`, `apps/web/src/cloudflare/setup.ts`, `apps/web/src/stores/cloudflareSetup.ts`, `apps/web/src/stores/serverUpdate.ts`, `apps/web/src/stores/setup.ts`, `apps/web/test/cloudflareSetup.test.ts`, `apps/web/test/serverUpdate.test.ts`
- Leer como contexto: `apps/web/src/cloudflare/*` (T9), `apps/web/src/native/cloudflareApi.ts`, `packages/shared/src/version.ts`, este PLAN (Contratos)
- Qué hacer:
  - `bundle.ts`: carga `/cf-bundle/manifest.json` e `index.js`; `readAsset` → base64 por trozos (sin `btoa` de golpe sobre cadenas enormes).
  - `setup.ts`: `runSetup` = subdominio (crear si falta) → `ensureD1` → `ensureR2` → migraciones → archivos → script con `accessKey` nueva (32 bytes aleatorios, base64url) → `enableWorkersDev` → `waitUntilLive` (espera `version === manifest.version`). `runUpdate` = localizar cuenta cuyo `workerUrl` coincida con `config.cloudflare.baseUrl` (si ninguna → `wrong_account`) → migraciones **antes** del script → archivos → script sin `accessKey` → `waitUntilLive`. Avisar de cada paso con `onStep`.
  - `stores/cloudflareSetup.ts`: máquina de estados del Contrato. Token en una variable de módulo, borrado en `finally` y en `cancel()`. Si hay varias cuentas → `chooseAccount`; si no hay subdominio → `chooseSubdomain` con sugerencia `aske-` + 4 caracteres aleatorios; si `scriptExists` en modo montaje → `confirmExisting`. Al acabar el montaje: `useSetup.getState().connectCloudflare(accessKey, baseUrl)` y borrar la clave de memoria. La `accessKey` nunca va al estado de zustand ni a `localStorage`, y nunca se devuelve a la interfaz. Si `not_live_yet`, `retry()` solo vuelve a esperar y emparejar (sin token).
  - `stores/serverUpdate.ts`: `check()` llama a `api.health()` si el almacenamiento es Cloudflare; `outdated = isServerOutdated(version, __APP_VERSION__)`; `dismiss()` guarda la versión descartada con `savePref`.
  - `stores/setup.ts`: añadir status `'cloudflareSetup'`, `openCloudflareSetup()` y `closeCloudflareSetup()` (vuelve a `'pair'` o `'ready'`).
- TDD: sí
- Criterios de aceptación:
  - [ ] Con la API simulada, `runSetup` y `runUpdate` hacen las llamadas en el orden indicado y devuelven la URL correcta.
  - [ ] Tras éxito, error o cancelación, ni el estado de zustand ni `localStorage` contienen el token (test lo comprueba).
  - [ ] `isServerOutdated` decide el aviso; descartar dura hasta la siguiente versión.
- Verificación: `npx vitest run test/cloudflareSetup.test.ts test/serverUpdate.test.ts --root apps/web`, `npm run typecheck`

### T11 · Pantallas del asistente y del botón «Actualizar» · Grupo F · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/views/CloudflareSetupView.tsx` (nuevo), `apps/web/src/components/cloudflareSetup/*.tsx` (nuevos, un paso por archivo), `apps/web/src/components/ServerUpdatePanel.tsx` (nuevo), `apps/web/src/components/ServerUpdateBanner.tsx` (nuevo), `apps/web/src/App.tsx`, `apps/web/src/views/PairView.tsx`, `apps/web/src/views/SettingsView.tsx`, `apps/web/src/stores/library.ts` (solo `reportError`/`reportPinError`), `apps/web/src/i18n/cloudflareSetup.ts` (nuevo), `apps/web/src/i18n/{en,es,eu}.ts` (spread y borrar `toast.cloudflareOutdated`), CSS existente si hace falta
- Leer como contexto: `apps/web/src/stores/cloudflareSetup.ts`, `apps/web/src/stores/serverUpdate.ts`, `apps/web/src/cloudflare/types.ts`, `apps/web/src/components/AppUpdatePanel.tsx`, `apps/web/src/components/HelpSheet.tsx`
- Qué hacer:
  - Asistente (solo `isNative`): Intro (qué es, gratis hasta 10 GB, Cloudflare pide tarjeta pero no cobra, ~10 min) → Crear cuenta (`https://dash.cloudflare.com/sign-up`, «Ya tengo cuenta») → Activar R2 (`https://dash.cloudflare.com/?to=/:account/r2/overview`) → Crear token (botón a `TOKEN_CREATE_URL` con 3 pasos explicados: «Continuar al resumen», «Crear token», «Copiar») → Pegar token (`type="password"`, `autoComplete="off"`, botón deshabilitado si < 30 caracteres) → elegir cuenta / nombre de dirección / aviso «ya existe» → progreso con la lista de pasos → Listo («ya puedes borrar el token», enlace a `https://dash.cloudflare.com/profile/api-tokens`). Error → texto `cfsetup.error.<código>` + botón para volver al paso que lo arregla (`r2_not_enabled` → paso R2; `missing_permission` → paso token).
  - `App.tsx`: status `'cloudflareSetup'` → `CloudflareSetupView` modo montaje; ruta `/server-update` → modo actualización. Al estar `ready` con Cloudflare, llamar a `useServerUpdate.getState().check()` una vez.
  - `PairView`: en Android, enlace «¿Aún no tienes tu Cloudflare? Móntalo ahora» → `openCloudflareSetup()`; en la web, texto «Para montarlo necesitas la app Android».
  - `ServerUpdatePanel` (Ajustes, Cloudflare): versión del servidor y de la app; si está desactualizado, botón «Actualizar» (Android) o texto «Actualízalo desde la app Android» (web). `ServerUpdateBanner`: arriba, descartable, una vez por versión.
  - `library.ts`: `cloudflare_outdated` → `useServerUpdate.getState().markOutdated()` + toast con texto nuevo que lleva a Ajustes; borrar `toast.cloudflareOutdated` de los tres idiomas.
  - Textos en `i18n/cloudflareSetup.ts` (mismo patrón que `i18n/pairing.ts`), sin jerga («token» se explica como «una llave temporal que da permiso a la app para montar tu servidor»).
- TDD: no
- Criterios de aceptación:
  - [ ] Paridad i18n pasa; todos los `SetupErrorCode` tienen texto.
  - [ ] Ni el token ni la `ACCESS_KEY` aparecen en ninguna pantalla (tampoco en «Listo»), `detail`, toast o log.
  - [ ] El banner se puede cerrar y no vuelve a salir hasta la siguiente versión; el panel de Ajustes avisa siempre.
  - [ ] En «Elegir dirección» el campo viene relleno con la sugerencia `aske-xxxx` y se puede cambiar.
  - [ ] Archivos < 300 líneas y funciones < 50.
- Verificación: `npm run check`, `npm run test:e2e`, `npx vite build --mode fakenative -w @aske/web`

### T12 · Ayuda y documentación de la fase 6 · Grupo F · Estado: HECHA

- Archivos (exclusivos): `apps/web/src/help/articles/cloudflareSetup.ts` (nuevo), `apps/web/src/help/articles.ts` (registrar artículos), `docs/ESTADO.md`, `docs/v2/architecture.md`, `docs/android.md`, `docs/deployment.md`
- Leer como contexto: `apps/web/src/help/articles/cloudflare.ts`, `apps/web/test/help.test.ts`, este PLAN
- Qué hacer: artículos (eu/es/en) `cloudflare-setup` (paso a paso con capturas descritas en texto), `cloudflare-token` (qué es, permisos, que la app no lo guarda, cómo borrarlo), `cloudflare-update` (cuándo y cómo actualizar). Las pantallas de T11 enlazan estos ids (ya fijados aquí). `docs/v2/architecture.md`: fase 5.5 ✅, fase 6 ✅ y «Phase 6 notes». `docs/android.md`: plugins `QrScanner` y `CloudflareApi`, paquete `cf-bundle`. `docs/deployment.md`: la vía de la app para no técnicos y que `db:migrate:remote` sigue funcionando. `ESTADO.md`: F6 hecha, decisiones (código de un solo uso, token no guardado), problemas conocidos (no probado contra Cloudflare real).
- TDD: no
- Criterios de aceptación:
  - [ ] `help.test.ts` pasa; los ids `cloudflare-setup`, `cloudflare-token`, `cloudflare-update`, `link-device` existen.
- Verificación: `npx vitest run test/help.test.ts --root apps/web`, `npm run format:check`

## Riesgos / dudas abiertas

### Riesgos técnicos

- **API de subida de Workers con archivos estáticos** (`assets-upload-session`, `assets/upload?base64=true`, `keep_bindings`, `run_worker_first` como lista): los nombres de campos salen de la documentación y no se prueban contra Cloudflare real (solo simulada). Andoni debería hacer una prueba real con una cuenta de pruebas antes de publicar.
- **Hash de los archivos**: wrangler usa blake3; la doc de subida directa usa SHA-256 truncado. Si Cloudflare lo rechazara, cambiar `assetHash` (T8) es local.
- **Migraciones por `/d1/database/{id}/query`**: varias sentencias en una llamada no son una transacción. Si una falla a medias, al reintentar puede fallar por «la tabla ya existe». Las migraciones nuevas deben escribirse con `IF NOT EXISTS` cuando se pueda.
- **Subdominio `workers.dev` recién creado**: puede tardar minutos en funcionar (DNS). Por eso hay `not_live_yet` y «Reintentar» sin volver a subir nada.
- **R2 hay que activarlo a mano** en el panel (pide tarjeta): no se puede automatizar; el asistente lo guía y detecta el error 10042.
- **Permisos del token**: claves `workers_scripts`, `d1`, `workers_r2`, `account_settings` del enlace precargado; si alguna cambia de nombre, el enlace abre el formulario vacío y el asistente lo explica (`missing_permission`).
- **Capacitor en builds de depuración** puede mostrar en logcat las llamadas a plugins; las builds de release no. El token nunca se guarda en disco.
- **Escáner de QR** necesita Google Play services (descarga un módulo la primera vez); sin él, se escribe el código.
- **Volver a montar en una cuenta que ya tiene Aske Stream** crea una clave nueva: los demás dispositivos tendrán que volver a vincularse (la música no se borra). Se avisa en `confirmExisting`.
- **APK más grande** (~2-4 MB por la copia de la web y el Worker).
- **Actualizar el servidor de Andoni desde su móvil** sobrescribe su Worker con el del APK; es compatible (mismos nombres y `keep_bindings` conserva `ACCESS_KEY`, `CORS_ORIGINS` y `STORAGE_LIMIT_GB`).

### Dudas abiertas

Ninguna. Andoni eligió las cuatro opciones recomendadas el 2026-11-20 (ver «Decisiones de arquitectura»).

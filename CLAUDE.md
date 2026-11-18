# Aske Stream

App de música tipo Spotify, de código abierto (MIT), de Andoni Ortiz de Zarate Urruela (GitHub `Ando144`).
Es para amigos sin perfil técnico. Cada uno elige dónde se guarda su música: **este dispositivo**,
**su Google Drive** o **su propio Cloudflare** (Worker + D1 + R2, plan gratuito).
Incluye app web/PWA y app Android (APK por GitHub Releases), descarga de YouTube en el móvil,
radio en directo, podcasts y caché sin conexión que se renueva sola.

## Stack

- Monorepo npm workspaces, Node ≥ 22.12, TypeScript estricto, Prettier.
- `apps/web`: React 19 + Vite 8 + zustand + wouter + idb. Vitest.
- `apps/api`: Cloudflare Worker con Hono + zod, D1 (SQL) y R2 (audio). Vitest.
- `apps/mobile`: Capacitor 8 (Android). Plugins Java propios en
  `android/app/src/main/java/io/github/ando144/askestream/`:
  - `AskeNative`: actualizaciones, almacenamiento y batería.
  - `Downloader`: yt-dlp vía youtubedl-android, servicio en primer plano.
  - `GoogleDrive`: Play services Identity, permiso `drive.file`.
- `packages/shared`: tipos, límites (`LIMITS`) y parser de YouTube InnerTube.
- `tools/ingest`: CLI para subir música a Cloudflare.

## Comandos (en Windows usar PowerShell)

- Instalar: `npm ci`. **Nunca `npm install`**: en Windows reescribe `package-lock.json`.
- Desarrollo: `npm run dev` (Worker en :8787 y Vite en :5173; crea `apps/api/.dev.vars`).
  La primera vez, `npm run db:migrate:local`.
- Comprobar todo antes de entregar: `npm run check` (formato, tipos, tests, build).
  Después `npm run test:e2e`, el smoke test contra wrangler dev con un dist recién construido;
  reinicia wrangler tras cada build.
- Tests de navegador: ver `apps/web/test/browser/README.md`. Build como si fuera Android: `npx vite build --mode fakenative -w @aske/web`.
  Cambia `src/native/*` por `apps/web/test/fake-native/*`.
- APK: `npm run android:apk` (necesita ANDROID_HOME y `.secrets/keystore.properties`).
- Publicar web: `npm run deploy`. Migraciones en producción: `npm run db:migrate:remote`.
- Release Android: subir la versión en los 6 `package.json` y en `package-lock.json`, añadir
  `docs/releases/vX.Y.Z.md`, hacer `git push` y después el tag `vX.Y.Z`. CI construye y publica los APK.

## Estructura

```
apps/web/src/
  storage/        homes (device, cloudflare, drive/) + types.ts (LibraryHome, LocalTrack.locations)
  stores/         estado zustand: library, player, offline, downloads, setup, send, copyToDrive, tips…
  views/ components/  pantallas y piezas de UI
  native/         puentes a plugins nativos (sustituidos en modo fakenative)
  offline/        IndexedDB (db.ts), Cache Storage de audio, planner de rotación
  help/articles.ts  centro de ayuda (eu/es/en)   i18n/{es,en,eu}.ts  textos
  config.ts       repo, autor, GOOGLE_WEB_CLIENT_ID (público)
apps/api/src/     routes/ + lib/ ; migrations/000N_*.sql
docs/             architecture.md, android.md, google-drive.md, v2/architecture.md (fases), releases/
```

## Convenciones de código

- Prettier: 100 columnas, comillas simples, `trailingComma: all`. Comentarios y código en inglés.
- Toda la UI va traducida: cada clave existe en es, en y eu (hay un test de paridad). Los singulares van en `clave.one`.
- Toda funcionalidad visible necesita:
  - texto claro para gente no técnica, que diga qué pasa, qué hacer y sin jerga;
  - consejo de pantalla o artículo de ayuda si hace falta;
  - errores traducidos a lenguaje sencillo.
    Los enlaces entre artículos se validan en un test.
- Lógica pura con tests unitarios, por ejemplo `storage/drive/doc.ts`, `offline/planner.ts` o `shared/youtube.ts`.
- Cambios optimistas en `stores/library.ts`, que revierte si falla.
- Una sola paleta de color: ámbar. No añadir temas.

## Reglas acordadas (obligatorias)

- **Commits:** autor `Andoni Ortiz de Zarate Urruela <Ando144@users.noreply.github.com>`.
  **Sin** `Co-Authored-By` ni ninguna línea que mencione a Claude, en ningún proyecto de Andoni.
- **Nunca subir al repo:**
  - `.secrets/` (keystore y contraseñas), `.env`, `.dev.vars` ni la `ACCESS_KEY`;
  - el email personal de Andoni.
- Las estadísticas de uso (fase 8) solo con consentimiento explícito (RGPD) y desactivadas por defecto.
- No hay límite de canciones, salvo:
  - playlists de hasta 1000 canciones;
  - Cloudflare con tope de 10 GB (`STORAGE_LIMIT_GB`), y al 95 % la API responde 507 `storage_full`.
- El audio de YouTube se guarda en Opus tal cual, sin recodificar.
- Antes de implementar algo grande, hacer a Andoni muchas preguntas de aclaración, cada una con
  la opción recomendada marcada y una explicación breve de las opciones.
- Mantener al día `docs/ESTADO.md` y la tabla de fases de `docs/v2/architecture.md`.

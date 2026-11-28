# PLAN: Documentación profesional del proyecto

Fecha: 2026-11-28 · Estado: COMPLETADO · Rama: `docs/documentacion-profesional`

## Objetivo

Dejar el repositorio con documentación profesional y vistosa para empresas: README en inglés (con
versiones en español y euskera) centrado primero en el producto y después en la ingeniería; capturas
y GIFs generados automáticamente con música ficticia; arquitectura con diagramas Mermaid,
referencia de API (Worker y Hub), ADRs, guías, archivos de comunidad, CHANGELOG, plantillas de
GitHub, cobertura en CI, Dependabot y una comprobación automática de enlaces, imágenes y comandos.
Nada se publica (push, merge, `gh repo edit`) sin permiso de Andoni.

## Decisiones de arquitectura

- **No se mueve ningún documento que la app, Android, Google Cloud o CI enlacen** — la app
  enlaza `docs/deployment.md` (y su apartado **Updating**), `docs/google-drive.md`; Google Cloud
  enlaza `docs/PRIVACY.md`; CI usa `docs/releases/vX.Y.Z.md`; `docs/android.md` y `docs/hub.md`
  los citan `build.gradle`, `AndroidManifest.xml`, `.gitignore` y `CLAUDE.md`. Se mejoran en su
  sitio y los nuevos se añaden alrededor.
- **Idioma:** documentos técnicos solo en inglés. `docs/hub.md` (hoy en español) se reescribe en
  inglés en el mismo archivo. `docs/PRIVACY.md` y `docs/releases/*.md` no se tocan.
- **Comprobador propio sin dependencias** (`scripts/check-docs.mjs`, Node puro) en lugar de
  `markdown-link-check`/`lychee` — no añade dependencias al lock y corre igual en Windows y CI.
  Comprueba enlaces relativos, imágenes, anclas `#...` y que cada `npm run <script>` citado exista.
  Entra en `npm run check` y en CI. Los enlaces externos solo con `--external` (manual, no en CI).
- **Cobertura sin tocar `package-lock.json`:** en CI (Linux), tras `npm ci`, se instala
  `@vitest/coverage-v8` con `npm install --no-save` en la misma versión exacta que `vitest`
  (hoy 5.1.0, leída con `node -p`). El paso «Unit tests» pasa a ejecutarse con cobertura; el
  resumen va al _job summary_ de GitHub y el HTML como artefacto. Sin servicios externos.
- **Dependabot** mensual y agrupado (npm, github-actions, gradle) para no llenar de PRs.
  Dependabot actualiza el lock en Linux, así que no sufre el problema de Windows.
- **Imágenes reproducibles con un solo comando** `npm run docs:media`: un Worker local aislado
  (como `scripts/smoke.mjs`), música inventada generada con ffmpeg (tonos Opus y portadas de
  degradados), Playwright (Python, como los tests de `apps/web/test/browser`) para capturas y
  vídeos, y ffmpeg para pasar los vídeos a GIF. Interfaz en inglés. La parte de Android se graba
  con la build `fakenative`. Al terminar reconstruye el `dist` normal.
- **Banner e imagen social** salen de una plantilla HTML (`scripts/docs-media/banner.html`)
  renderizada por el mismo script: así se pueden regenerar y usan el logo real (`favicon.svg`) y
  la paleta ámbar.
- **Sin botón «Try it»:** no hay URL pública de la app web en el repo (la del Hub es solo API y
  `ando144.github.io` es la web personal, excluida). Siempre enlace a
  `https://github.com/Ando144/aske-stream/releases/latest` para el APK.
- **Sin emojis en los documentos**; lo vistoso son el banner, capturas, GIFs, insignias, tablas
  y diagramas Mermaid (GitHub los dibuja solo).
- **Insignias solo reales:** CI, Android app (workflow), última release, licencia, descargas,
  Node ≥ 22.12, TypeScript strict. Nada de insignias de cobertura (ver dudas).

## Contratos (interfaces compartidas)

### Rutas de archivos nuevos (fijas: todas las tareas enlazan a estas)

```
README.md  README.es.md  README.eu.md  CHANGELOG.md  CONTRIBUTING.md  CODE_OF_CONDUCT.md  SECURITY.md
.github/ISSUE_TEMPLATE/{bug_report.yml,feature_request.yml,config.yml}
.github/pull_request_template.md   .github/dependabot.yml
docs/README.md                 índice de toda la documentación
docs/development.md            instalación y desarrollo local
docs/testing.md                estrategia de pruebas y cómo ejecutarlas
docs/api/worker.md             referencia de la API del Worker (/api/*)
docs/api/hub.md                referencia de la API del Hub (/hub/v1/* y protocolo Jam)
docs/adr/0006-…md … 0013-…md   nuevos ADRs (títulos en T5)
docs/media/screenshots/*.png   docs/media/gifs/*.gif
docs/media/banner.png (1280x400)   docs/media/social-preview.png (1280x640)
```

### Imágenes que produce T2 (nombres exactos; T7 los usa)

| Archivo                                 | Tamaño de viewport              | Contenido                                          |
| --------------------------------------- | ------------------------------- | -------------------------------------------------- |
| `screenshots/mobile-library.png`        | 390x844, deviceScaleFactor 2    | Biblioteca con playlists y canciones               |
| `screenshots/mobile-now-playing.png`    | igual                           | Reproductor a pantalla completa                    |
| `screenshots/mobile-playlist.png`       | igual                           | Una playlist abierta                               |
| `screenshots/mobile-storage-choice.png` | igual                           | Pantalla de elegir dónde guardar la música         |
| `screenshots/mobile-offline.png`        | igual                           | Ajustes → Música sin conexión                      |
| `screenshots/mobile-radio.png`          | igual                           | Radio con emisoras ficticias                       |
| `screenshots/mobile-help.png`           | igual                           | Centro de ayuda                                    |
| `screenshots/android-download.png`      | igual, build `fakenative`       | Pestaña Descargar con resultados ficticios         |
| `screenshots/android-study.png`         | igual, build `fakenative`       | Modo estudio                                       |
| `screenshots/desktop.png`               | 1440x900, deviceScaleFactor 1   | Biblioteca + reproductor en escritorio             |
| `gifs/start.gif`                        | 390 px de ancho, 15 fps, ≤ 3 MB | Animación de arranque y aparición de la biblioteca |
| `gifs/player.gif`                       | igual                           | Abrir el reproductor y deslizar a la siguiente     |
| `banner.png` / `social-preview.png`     | 1280x400 / 1280x640             | Logo, «Aske Stream», lema en inglés, fondo oscuro  |

Total de `docs/media/` ≤ 8 MB.

### Scripts npm (los añade T1 en el `package.json` raíz)

- `"docs:check": "node scripts/check-docs.mjs"` y se añade a `check`:
  `format:check && typecheck && test && test:scripts && docs:check && build`.
- `"docs:media": "node scripts/docs-media/run.mjs"` (el archivo lo crea T2).
- `test:scripts` ejecuta también `scripts/lib/doc-links.test.mjs` y
  `scripts/lib/coverage-table.mjs` test (listar los archivos explícitamente).

### `scripts/lib/doc-links.mjs` (T1)

```js
/** GitHub-style heading slug: lower case, spaces -> '-', drops punctuation except '-' and '_'. */
export function slugify(heading) {}
/** Links and images in a Markdown text: [{ kind: 'link'|'image', target, line }]. Covers
 *  [t](x), ![a](x), <img src="x">, <a href="x">, reference links; ignores fenced code. */
export function extractLinks(markdown) {}
/** Headings of a Markdown text as slugs (with GitHub's -1, -2 suffixes for repeats). */
export function headingSlugs(markdown) {}
/** `npm run <name>` (optionally `-w <workspace>`) found anywhere, including code blocks. */
export function extractNpmScripts(markdown) {} // -> [{ name, workspace, line }]
```

`check-docs.mjs` recorre todos los `*.md` del repo salvo `node_modules`, `dist*`, `.wrangler`,
`apps/mobile/android`, `docs/plan/` y `docs/releases/`. Errores: archivo destino que no existe,
ancla que no existe en el destino, `npm run X` que no está en el `package.json` correspondiente.
Sale con código 1 y lista `archivo:línea motivo`. `--external` además hace `HEAD` (o `GET`) a los
`http(s)` y avisa de los que fallan.

### `scripts/docs-media/run.mjs` → `capture.py` (T2, interno)

`run.mjs` ejecuta `python scripts/docs-media/capture.py` con las variables `BASE` (URL del Worker
local), `ACCESS_KEY`, `MODE` (`web` | `native`), `OUT` (ruta absoluta a `docs/media`) y, si
existe, `CHROME_PATH`. `capture.py` deja los vídeos en una carpeta temporal y `run.mjs` los
convierte a GIF.

## Tareas

### T1 · Comprobador de documentación, cobertura en CI y Dependabot · Grupo A · Estado: HECHA

- Archivos (exclusivos): `scripts/lib/doc-links.mjs`, `scripts/lib/doc-links.test.mjs`,
  `scripts/check-docs.mjs`, `scripts/lib/coverage-table.mjs`,
  `scripts/lib/coverage-table.test.mjs`, `scripts/coverage-summary.mjs`, `package.json` (raíz),
  `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitignore`, `.prettierignore`.
- Leer como contexto: `scripts/lib/worker-bundle.test.mjs` (estilo de test con `node --test`),
  `apps/*/package.json`, `packages/shared/package.json`, `tools/ingest/package.json`.
- Qué hacer:
  1. `doc-links.mjs` con las 4 funciones del contrato y `check-docs.mjs` (lee archivos, resuelve
     rutas relativas al `.md`, decodifica `%20`, ignora `mailto:`, valida anclas solo en `.md`,
     resuelve `-w @aske/x` al `package.json` de ese workspace). Funciones < 50 líneas.
  2. `coverage-table.mjs`: `export function coverageTable(summaries)` donde `summaries` es
     `[{ workspace, total }]` (`total` = objeto `total` de `coverage-summary.json` de Vitest) y
     devuelve una tabla Markdown (Workspace | Statements | Branches | Functions | Lines, en %
     con 1 decimal). `coverage-summary.mjs` busca `apps/*/coverage/coverage-summary.json`,
     `packages/*/…`, `tools/*/…` y escribe la tabla en `process.env.GITHUB_STEP_SUMMARY` si
     existe, si no por la salida estándar.
  3. `package.json` raíz: scripts del contrato (`docs:check`, `docs:media`, `check`,
     `test:scripts`). No cambiar dependencias.
  4. `ci.yml`: tras `npm ci`, paso «Coverage tool» con
     `npm install --no-save --no-audit --no-fund @vitest/coverage-v8@$(node -p "require('vitest/package.json').version")`;
     el paso «Unit tests» pasa a
     `npm test -- --coverage.enabled --coverage.provider=v8 --coverage.include='src/**' --coverage.reporter=text-summary --coverage.reporter=json-summary --coverage.reporter=html`
     (comprobar que Vitest 5 acepta esas opciones; ajustar si no); después `node scripts/coverage-summary.mjs`
     y `actions/upload-artifact@v7` con `*/*/coverage/` (retention 14 días, `if: always()`).
     Añadir paso «Docs links» con `npm run docs:check` y `npm run test:scripts` si no estaba.
  5. `dependabot.yml`: ecosistemas `npm` (`/`), `github-actions` (`/`), `gradle`
     (`/apps/mobile/android`); `schedule.interval: monthly`; un grupo por ecosistema con
     `update-types: [minor, patch]`; `open-pull-requests-limit: 5`; prefijo de commit
     `chore` (Conventional Commits).
  6. `.gitignore` y `.prettierignore`: añadir `coverage/`.
- TDD: sí (escribir antes `doc-links.test.mjs` y `coverage-table.test.mjs`: slugs con acentos,
  puntuación y repetidos; enlaces dentro de bloques de código ignorados; `<img src>`; `npm run`
  con y sin `-w`; tabla con valores y con un workspace sin datos).
- Criterios de aceptación:
  - [ ] `npm run test:scripts` pasa con los tests nuevos.
  - [ ] `npm run docs:check` se ejecuta y lista los fallos actuales del repo (es normal que falle
        por archivos que crean T3–T7; anotar en el informe qué fallos quedan y por qué).
  - [ ] Probado en local que la cobertura funciona sin tocar el lock:
        `npm install --no-save @vitest/coverage-v8@5.1.0`, ejecutar el comando de test con
        cobertura, comprobar `git status` (el `package-lock.json` NO debe cambiar) y volver a
        dejar todo con `npm ci`.
  - [ ] `npx prettier --check .github scripts package.json` pasa.
- Verificación: `npm run test:scripts`, `npm run docs:check`, `npm run format:check`, `git diff --stat package-lock.json` (vacío).

### T2 · Generador de capturas, GIFs, banner e imagen social · Grupo A · Estado: HECHA

- Archivos (exclusivos): `scripts/docs-media/run.mjs`, `scripts/docs-media/catalog.mjs`,
  `scripts/docs-media/capture.py`, `scripts/docs-media/banner.html`,
  `scripts/docs-media/README.md`, todo `docs/media/**` (generado).
- Leer como contexto: `scripts/smoke.mjs` (arrancar Worker aislado con `--persist-to`, migrar,
  subir con `POST /api/ingest/tracks` multipart `meta`/`audio`/`cover`, crear playlists con
  `/api/playlists`), `apps/web/test/browser/README.md`, `v9_095.py` (clase `Network`, `Finger`,
  respuestas falsas del Hub), `v6_onboarding.py` (saltar la introducción), `v11_097.py`
  (grabar vídeo del arranque), `apps/web/public/favicon.svg`, `apps/web/src/i18n/en.ts`.
- Qué hacer:
  1. `catalog.mjs`: ~12 canciones y 3 playlists **inventadas** (títulos y artistas ficticios,
     nada real; un par de episodios de podcast opcional), con `source: 'file'` o el valor que
     acepte el Worker sin `sourceRef` real de YouTube. Exporta los datos; sin lógica.
  2. `run.mjs` (Node, sin dependencias nuevas): comprueba que existen `ffmpeg` y `python` con
     Playwright (mensaje claro si faltan); genera en `os.tmpdir()` audio Opus (tonos suaves de
     ~3 min a 16 kbps) y portadas JPEG 600x600 con degradados ámbar distintos (filtros `lavfi`
     de ffmpeg); `npm run build -w @aske/web`; arranca un Worker aislado (puerto libre,
     `ACCESS_KEY` aleatoria, `--persist-to` temporal), migra, siembra el catálogo por la API,
     ejecuta `capture.py` con `MODE=web`; para el Worker; `npm run build -w @aske/web -- --mode fakenative`;
     reinicia el Worker (mismo persist) y ejecuta `MODE=native`; pasa los vídeos a GIF con
     paleta (`fps=15,scale=390:-1:flags=lanczos,split…palettegen…paletteuse`); **al final, pase
     lo que pase (`finally`), reconstruye el `dist` normal** y borra temporales. En Windows,
     matar el árbol de procesos como hace `smoke.mjs`. Nunca `vite build -w` ni modo watch.
  3. `capture.py`: contexto con `locale='en-US'`, sin red externa (todo lo que no sea `BASE`
     se responde con datos falsos o se aborta, como `Network` en `v9_095.py`); radio con
     emisoras ficticias interceptando las peticiones de la app a `/api/radio/*`; en `native`,
     resultados de YouTube ficticios con miniaturas generadas (nunca imágenes reales). Vincula
     el navegador con la clave, salta la introducción, cierra los consejos que tapen la pantalla
     y produce exactamente los archivos de la tabla del contrato. Comprueba antes de cada
     captura que no hay errores en pantalla.
  4. `banner.html`: HTML+CSS en línea, fondo `#14110F`, logo de `favicon.svg` en línea, título
     «Aske Stream» y lema «Your music, wherever you choose to keep it.»; tipografía del sistema;
     `capture.py` lo renderiza a 1280x400 y 1280x640 (en `MODE=web`).
  5. `scripts/docs-media/README.md` (inglés): requisitos, comando, qué genera, que todo es
     ficticio y que reconstruye el dist normal.
  6. Ejecutarlo de verdad y dejar las imágenes en `docs/media/`. Revisar cada imagen a ojo
     (abrirlas) y descartar las que tengan textos cortados o errores.
- TDD: no (script de generación; se verifica ejecutándolo y mirando el resultado).
- Criterios de aceptación:
  - [ ] `npm run docs:media` termina sin errores en Windows y crea todos los archivos de la tabla.
  - [ ] Ningún dato personal, ningún nombre de artista real, ninguna miniatura real de YouTube.
  - [ ] Cada canción o playlist visible tiene imagen al lado (regla del proyecto).
  - [ ] `docs/media/` ≤ 8 MB y cada GIF ≤ 3 MB.
  - [ ] Al terminar, `apps/web/dist` es la build normal (no `fakenative`) y no quedan procesos
        `wrangler`/`workerd` vivos.
- Verificación: `npm run docs:media`; después `npm run build` y `npm run format:check`.
  Si Python no tiene Playwright: venv temporal en el scratchpad y `CHROME_PATH` al Chrome instalado.

### T3 · Archivos de comunidad, plantillas y CHANGELOG · Grupo A · Estado: HECHA

- Archivos (exclusivos): `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  `CHANGELOG.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`,
  `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml`,
  `.github/pull_request_template.md`.
- Leer como contexto: `CLAUDE.md` (convenciones, comandos, reglas), `docs/releases/*.md`,
  `git tag --sort=creatordate` y `git log -1 --format=%as <tag>` para las fechas, `LICENSE`.
- Qué hacer (todo en inglés):
  1. `CONTRIBUTING.md`: cómo proponer cambios (issue antes de algo grande), requisitos, `npm ci`
     (y por qué no `npm install` en Windows), `npm run dev`, `npm run check` y `npm run test:e2e`
     antes del PR, Conventional Commits, Prettier (100 col, comillas simples), traducciones en
     es/en/eu obligatorias (test de paridad), textos para gente no técnica, una sola paleta
     ámbar, imagen junto a cada canción/playlist. Enlaza `docs/development.md` y
     `docs/testing.md` (los crea T6).
  2. `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1 (texto oficial). Canal de aviso: el de la
     opción recomendada en «Dudas» (si el orquestador no indica otra, usar la recomendada). Sin
     email personal.
  3. `SECURITY.md`: versiones soportadas (solo la última release), avisar por **GitHub private
     vulnerability reporting** (`Security → Report a vulnerability`), qué no hacer (issues
     públicos), plazos orientativos sin prometer SLA, alcance (Worker, Hub, app, APK) y modelo
     de seguridad en una línea con enlace a `docs/adr/0003-single-owner-auth.md`.
  4. Plantillas de issue en formulario YAML: bug (versión de la app, dónde se guarda la música
     — dispositivo / Google Drive / Cloudflare —, plataforma web/Android, pasos, esperado,
     capturas, aviso de no pegar claves ni enlaces de emparejado); feature; `config.yml` con
     `blank_issues_enabled: false` y enlace a «Security» para vulnerabilidades. PR template con
     checklist (`npm run check`, `test:e2e`, traducciones, ayuda, capturas si es visual).
  5. `CHANGELOG.md` formato _Keep a Changelog_, versiones de la más nueva a la más antigua desde
     las notas de `docs/releases/`, **traducidas al inglés y resumidas** (3-6 viñetas por
     versión, en categorías Added/Changed/Fixed), con fecha del tag. Al final, enlace a las
     notas completas en GitHub Releases y explicación de que `docs/releases/` son las notas que
     ve el usuario en la app. No inventar: solo lo que dicen las notas.
- TDD: no.
- Criterios de aceptación:
  - [ ] Ninguna dirección de email; autor como «Andoni Ortiz de Zarate Urruela (@Ando144)».
  - [ ] Todas las versiones de `docs/releases/` aparecen en el CHANGELOG con su fecha real.
  - [ ] Los comandos citados existen (`npm run docs:check` solo puede fallar por
        `docs/development.md` y `docs/testing.md`, que crea T6).
- Verificación: `npx prettier --check CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md CHANGELOG.md .github`, `npm run docs:check`.

### T4 · Referencia de API del Worker y del Hub · Grupo B · Estado: HECHA

- Archivos (exclusivos): `docs/api/worker.md`, `docs/api/hub.md`, `docs/hub.md`.
- Leer como contexto: `apps/api/src/index.ts`, `apps/api/src/routes/*.ts`, `apps/api/src/lib/`
  (auth, errores), `apps/api/migrations/*.sql`, `apps/hub/src/index.ts`, `apps/hub/src/routes/`,
  `apps/hub/src/groups/*Routes.ts`, `apps/hub/src/groups/routes.ts`, `apps/hub/src/jam/`
  (`protocol.ts`, `routes.ts`, `room.ts`), `apps/hub/src/lib/rateLimit.ts`,
  `apps/hub/migrations/*.sql`, `packages/shared/src` (tipos y `LIMITS`), `docs/hub.md` actual.
- Qué hacer (inglés):
  1. `docs/api/worker.md`: base URL y autenticación (Bearer `ACCESS_KEY`, cookie de sesión,
     códigos de emparejado), formato de error común, tabla resumen de endpoints y después una
     sección por grupo de rutas (auth, library, tracks, playlists, folders, stations, radio,
     media/streaming con Range, ingest, youtube, health): método, ruta, auth, parámetros y
     cuerpo (de los esquemas zod), respuestas y códigos (incluido 507 `storage_full`, 304 con
     ETag). Diagrama Mermaid `erDiagram` de D1 a partir de las migraciones.
  2. `docs/api/hub.md`: lo mismo para `/hub/v1/*` (playlists compartidas, parcels/Enviar,
     búsqueda y listas de YouTube, grupos, estadísticas, fotos, Jam), límites de ritmo, CORS,
     protocolo WebSocket del Jam (mensajes de `protocol.ts`) con un `sequenceDiagram` del salto
     de canción (invitado → Hub → anfitrión ejecuta), y `erDiagram` del D1 del Hub.
  3. `docs/hub.md`: reescribir en inglés (mismo contenido, mismas secciones, sin perder datos) y
     enlazar a `docs/api/hub.md` para el detalle de endpoints.
  - **Todo sale del código**: si algo no se puede confirmar leyendo el código, no se escribe.
- TDD: no.
- Criterios de aceptación:
  - [ ] Cada ruta registrada en `apps/api/src` y `apps/hub/src` aparece exactamente una vez
        (comprobarlo con `Grep` de `.get(`/`.post(`/`.put(`/`.patch(`/`.delete(`).
  - [ ] Los diagramas Mermaid son válidos (sintaxis `erDiagram`/`sequenceDiagram` correcta;
        probar en https://mermaid.live si hay duda).
- Verificación: `npm run docs:check`, `npx prettier --check docs/api docs/hub.md`.

### T5 · Arquitectura con diagramas y ADRs · Grupo B · Estado: HECHA

- Archivos (exclusivos): `docs/architecture.md`, `docs/adr/README.md`, `docs/adr/0001-pwa-first.md`
  … `docs/adr/0005-offline-audio-in-cache-storage.md` (revisión), `docs/adr/0006-*.md` …
  `docs/adr/0013-*.md` (nuevos).
- Leer como contexto: `docs/v2/architecture.md` (notas de fases: fuente principal),
  `docs/android.md`, `docs/google-drive.md`, `docs/offline-cache.md`, `docs/ESTADO.md`
  (decisiones), `apps/web/src/storage/types.ts`, `apps/web/src/storage/` (homes, copy),
  `apps/web/src/offline/planner.ts`, `apps/web/src/lib/bootSplash.ts`, ADRs actuales.
- Qué hacer (inglés):
  1. `docs/architecture.md`: reescribir conservando lo que sigue siendo cierto. Diagramas
     Mermaid: contexto del sistema (app web/PWA, app Android con plugins, las tres «homes»,
     Hub, Radio Browser, YouTube solo desde el móvil), capas de la app web (views/components →
     stores zustand → storage homes / offline / native), `sequenceDiagram` de emparejado con
     código, de «descargar de YouTube en el móvil → guardar en la home» con `uploadId` y
     cancelación segura, y de rotación de la caché sin conexión. Secciones: módulos del
     monorepo, modelo de datos (enlazar `docs/api/worker.md`), seguridad, offline, Android,
     arranque (`index.html` + `bootSplash.ts`), límites (10 GB y 95 % → 507, playlists de 1000).
  2. ADRs 0001–0005: añadir/actualizar `Status` (p. ej. 0001 «Accepted; native Android shipped
     in vX» con la versión verificada en `docs/releases/`), sin reescribir su historia.
  3. ADRs nuevos con el mismo formato (Status, Context, Options, Decision, Consequences, y
     «Introduced in: vX.Y.Z» verificado en `docs/releases/`):
     0006 storage homes (device / Google Drive / own Cloudflare: one home, many destinations);
     0007 Google Drive with `drive.file` and a merged `library.json` (newest change wins,
     tombstones); 0008 YouTube download on the phone with yt-dlp (residential IP, Opus without
     re-encoding); 0009 Capacitor WebView + own native plugins, playback in the WebView
     `<audio>`; 0010 Aske Hub as a separate Worker that never stores music, Jam on a Durable
     Object where the host executes skips; 0011 seeded shuffle order; 0012 upload ids and safe
     cancellation (never delete someone else's music, pending cancels for old Workers);
     0013 usage stats opt-in only (GDPR), local Recap. `README.md` de ADRs con la tabla completa.
- TDD: no.
- Criterios de aceptación:
  - [ ] Cada afirmación técnica se puede encontrar en el código o en los documentos citados.
  - [ ] Diagramas Mermaid válidos; ningún enlace roto.
- Verificación: `npm run docs:check`, `npx prettier --check docs/architecture.md docs/adr`.

### T6 · Guías, índice de docs y limpieza de notas obsoletas · Grupo B · Estado: HECHA

- Archivos (exclusivos): `docs/README.md`, `docs/development.md`, `docs/testing.md`,
  `docs/deployment.md`, `apps/web/test/browser/README.md`; borrar
  `docs/eu-revision-share-jam.md`, `docs/plan/bocetos/` y `.github/modernize/`.
- Leer como contexto: `CLAUDE.md` (comandos y trucos de Windows), `package.json` raíz y de cada
  workspace, `scripts/dev.mjs`, `scripts/smoke.mjs`, `scripts/cf-setup.mjs`, `.env.example`,
  `apps/api/.dev.vars.example`, `.github/workflows/*.yml`, `docs/android.md`,
  `apps/web/test/browser/*.py` (cabeceras), `scripts/docs-media/README.md` (de T2).
- Qué hacer (inglés):
  1. `docs/development.md`: requisitos (Node ≥ 22.12 de `.nvmrc`, ffmpeg opcional, JDK 21 y
     Android SDK solo para el APK, Python + Playwright para tests de navegador), `npm ci` y por
     qué nunca `npm install` en Windows, `npm run db:migrate:local`, `npm run dev` (puertos
     8787/5173, `.dev.vars`), Hub en local, build `fakenative`, APK local, estructura del
     monorepo, variables de entorno (sin valores reales), proceso de release (7 `package.json`
     - lock con `node`, notas, tag), y `npm run docs:media`.
  2. `docs/testing.md`: pirámide de pruebas con un diagrama Mermaid; unitarias por workspace
     (Vitest, qué se prueba: ejemplos reales de `test/`), paridad de traducciones y enlaces de
     ayuda, smoke E2E (`npm run test:e2e`), tests de navegador Playwright (enlace al README),
     comprobador de docs, cobertura en CI, gitleaks, y un `flowchart` del pipeline de CI sacado
     de `ci.yml` y `android.yml`. No poner números de tests que caduquen.
  3. `docs/deployment.md`: revisar contra `scripts/cf-setup.mjs` y `package.json`; corregir solo
     lo que no coincida y añadir una sección «Deploying the Hub (optional)». **Mantener todos los
     títulos actuales, sobre todo `## Updating`** (la app lo enlaza).
  4. `apps/web/test/browser/README.md`: corregir los comandos de build a
     `npm run build -w @aske/web -- --mode fakenative` (CLAUDE.md avisa de que `npx vite build`
     con `-w` se cuelga) y añadir una línea sobre `scripts/docs-media`.
  5. `docs/README.md`: índice por público (usuarios: deployment, google-drive, android, privacy;
     desarrolladores: development, testing, architecture, api, adr, ingest, offline-cache, hub;
     proyecto: CHANGELOG, CONTRIBUTING, SECURITY, v2/architecture como roadmap, releases).
  6. Borrar las notas obsoletas listadas (antes `Grep` de su nombre en todo el repo para
     confirmar que nadie las enlaza; si alguien las enlaza, no borrar y avisar).
- TDD: no.
- Criterios de aceptación:
  - [ ] Cada comando citado existe (`npm run docs:check` sin errores en los archivos de T6).
  - [ ] `docs/deployment.md` conserva todos sus títulos originales.
  - [ ] En el informe, lista de archivos borrados.
- Verificación: `npm run docs:check`, `npx prettier --check docs apps/web/test/browser/README.md`.

### T7 · README en inglés, español y euskera, y verificación final · Grupo C · Estado: HECHA

- Archivos (exclusivos): `README.md`, `README.es.md`, `README.eu.md`; borrar `docs/screenshots/`.
- Leer como contexto: este plan, `docs/media/` (de T2), `docs/README.md`, `docs/architecture.md`,
  `docs/adr/README.md`, `docs/testing.md`, `docs/v2/architecture.md` (tabla «Storage guide»),
  `docs/ingest.md` (nota legal), `apps/web/src/i18n/eu.ts` y `es.ts` (vocabulario de la app),
  `package.json` raíz.
- Qué hacer:
  1. `README.md` (inglés), en este orden: banner (`docs/media/banner.png`); lema; selector de
     idioma `English · Español · Euskara`; insignias reales (CI, Android app, última release,
     licencia MIT, descargas, Node ≥ 22.12, TypeScript strict); fila de enlaces (Download the
     Android app → `releases/latest`, Documentation, Architecture, Contributing). **Sin botón
     «Try it».** Galería: capturas móviles en fila, los dos GIFs, escritorio. «What it is»
     (para amigos sin perfil técnico, cada uno elige dónde vive su música) + tabla de las tres
     opciones de almacenamiento. Features agrupadas (biblioteca y reproductor, sin conexión,
     radio y podcasts, Android, Hub: playlists compartidas, Jam, grupos, Enviar; modo estudio;
     ayuda en 3 idiomas). YouTube como una función más del móvil, con una nota legal corta de
     uso personal y respeto a los derechos de autor y a las condiciones de YouTube. «Get
     started» (APK, tu propio Cloudflare → `docs/deployment.md`, desarrollo local con `npm ci`
     → `docs/development.md`). Ingeniería: diagrama Mermaid de visión general, tabla de stack,
     decisiones clave (enlaces a ADRs), «Engineering challenges solved» (solo cosas
     documentadas: audio en segundo plano en WebView, rotación offline, fusión de Drive sin
     servidor, cancelación segura, yt-dlp en el móvil por la IP residencial, Opus sin
     recodificar, plan gratuito con tope de 10 GB y 507), calidad (tests, CI, cobertura,
     gitleaks, Dependabot → `docs/testing.md`), estructura del proyecto, documentación
     (`docs/README.md`), contribuir/seguridad/código de conducta, privacidad
     (`docs/PRIVACY.md`), autor (nombre y GitHub, **sin web personal ni email**), licencia.
     Sin emojis.
  2. `README.es.md` y `README.eu.md`: traducción de la parte de producto completa y versión
     corta de la de ingeniería con enlaces a los documentos en inglés (avisándolo). Mismas
     imágenes e insignias. En euskera usar el vocabulario de `i18n/eu.ts`.
  3. Borrar `docs/screenshots/` tras confirmar con `Grep` que nada más lo enlaza.
  4. Verificación final de todo el plan: `npm run docs:check` sin errores, `node
scripts/check-docs.mjs --external` (anotar en el informe los externos que fallen),
     `npm run check` y `npm run test:e2e` con un dist recién construido.
  5. En el informe, recordar al orquestador las acciones que solo se hacen tras aprobación de
     Andoni (sección «Página de GitHub»).
- TDD: no.
- Criterios de aceptación:
  - [ ] Todas las imágenes del README existen y se ven en la vista previa de Markdown.
  - [ ] Ningún dato inventado: cada función citada existe en la app o en los documentos.
  - [ ] `npm run check` pasa.
- Verificación: `npm run docs:check`, `npm run check`, `npm run test:e2e`.

## Página de GitHub (propuesta; se aplica con `gh` SOLO tras aprobación de Andoni, lo hace el orquestador)

- **Descripción:** «Open-source, Spotify-style music app where each listener chooses where the
  music lives: on the phone, in their Google Drive or on their own free Cloudflare. Web/PWA and
  Android, offline cache, live radio, podcasts, shared playlists and Jams.»
- **Topics:** `music-player`, `music-streaming`, `pwa`, `react`, `typescript`, `vite`,
  `zustand`, `cloudflare-workers`, `cloudflare-d1`, `cloudflare-r2`, `hono`, `durable-objects`,
  `capacitor`, `android`, `offline-first`, `google-drive`, `self-hosted`, `opus`, `monorepo`.
- **Homepage:** `https://github.com/Ando144/aske-stream/releases/latest` (no hay web pública).
- **Comandos:** `gh repo edit Ando144/aske-stream --description "…" --homepage "…" --add-topic …`
  y activar el aviso privado de vulnerabilidades:
  `gh api -X PUT repos/Ando144/aske-stream/private-vulnerability-reporting`.
- **Imagen social:** `docs/media/social-preview.png`, Andoni la sube a mano en
  Settings → General → Social preview.

## Riesgos / dudas abiertas

- **Canal para avisos del código de conducta** (no hay email público):
  1. (Recomendada) Mensaje a @Ando144 por GitHub: abrir un issue mínimo sin detalles pidiendo un
     canal privado, o la función «Report content» de GitHub si es grave. Ventaja: sin email.
     Inconveniente: el primer contacto es público.
  2. Crear un email solo para el proyecto (p. ej. un alias nuevo). Ventaja: privado y estándar.
     Inconveniente: Andoni tiene que crearlo y vigilarlo.
  3. Activar GitHub Discussions y usar una categoría de moderación. Ventaja: todo en GitHub.
     Inconveniente: más mantenimiento y no es privado.
     Recomiendo la 1 porque cumple la regla de no publicar el email y no añade trabajo.
- **Insignia de cobertura:**
  1. (Recomendada) Sin insignia; resumen en cada ejecución de CI y artefacto HTML. Ventaja: sin
     cuentas externas ni secretos. Inconveniente: no se ve el porcentaje en el README.
  2. Codecov. Ventaja: insignia y comentarios en los PR. Inconveniente: cuenta externa y token.
  3. Insignia generada en un gist con una Action. Ventaja: sin servicio externo de pago.
     Inconveniente: necesita un token personal como secreto.
     Recomiendo la 1 porque es la más sencilla y segura; se puede pasar a Codecov más adelante.
- La pantalla «Acerca de» de la app enlaza `https://ando144.github.io` (`apps/web/src/config.ts`).
  Fuera del alcance de este plan (es código de la app); preguntar a Andoni si quiere quitarlo
  en otra tarea, ya que no quiere web personal por ahora.
- El euskera del `README.eu.md` debería revisarlo Andoni.
- La app enlaza `docs/deployment.md` en la rama `main`: los cambios de ese archivo se verán en la
  app en cuanto se fusione la rama.
- Si `docs:check` encuentra enlaces rotos en documentos que no toca ninguna tarea (p. ej.
  `docs/android.md`, `docs/ingest.md`), T7 los corrige solo si es una ruta mal escrita y lo
  anota en el informe.

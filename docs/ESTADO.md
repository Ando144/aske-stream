# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F6 (hasta v0.6.0, publicada y probada):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos; carpetas y playlists; vinculación por QR; asistente de Cloudflare. El CI compila el APK y el euskera nuevo está bien. La app ya está publicada en Google Cloud.
- **F7 (Hub desplegado en `https://aske-hub.andoni-otzdezarate.workers.dev`, D1 `aske-hub` migrado, probado en real con dos clientes; falta commit y release de la app con `HUB_URL`):** nuevo workspace `apps/hub` (Worker aparte, API `/hub/v1/*`, también sirve la web). Playlists compartidas con enlace `#list=` (90 días, D1, cron de limpieza). Jams con Durable Object SQLite, WebSocket y QR `#jam=` (12 h, apodo sin cuentas, «me gusta», solo suena el móvil anfitrión, solo Android). Arreglado el botón que pisaba la línea en «Vincular otro dispositivo». Revisor: APROBADO (`npm run check` verde).

## En curso / siguiente

- **F7 por hacer:** versión 0.7.0 preparada (7 `package.json`, lock y `docs/releases/v0.7.0.md`, con commit). Falta: `npm run deploy` (web y API), `npm run deploy:hub` (para que el Hub diga 0.7.0), `git push` y el tag `v0.7.0` para que el CI publique el APK.
- **F7 sin probar:** la interfaz en dos móviles reales (el anfitrión en Android descargando con yt-dlp); revisar el euskera de `share.ts` y `jam.ts`.
- **MEDIO de la F7:** `jamSocket.ts` debería tratar el cierre 4001 como final (dos pestañas del mismo invitado se echan entre sí); en `room.ts` `webSocketClose` puede fallar al hacer `broadcast` (envolver `send()` en try/catch).
- **MEDIO de la F6:** «Intentarlo de nuevo» tras `subdomain_taken` pide el token otra vez; falta el paso `'database'` en `RunningStep.tsx`; `CloudflareSetupView` 52 líneas; comentar `useHashCredentials`.
- **Pendiente de Andoni:** medir la batería con v0.5.5 en el Pixel.
- **Siguientes fases:** F8 estadísticas y Recap (8b grupos); F9 modo estudio; «Enviar al móvil» vía Hub (fuera de la F7).

## Decisiones tomadas (y por qué)

- Drive con `drive.file`, yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000. Copia: nunca borra el origen.
- Código de vinculación: 8 caracteres, 10 min, 5 intentos; el servidor solo guarda su hash.
- Publicar: `db:migrate:remote`, luego `deploy` (al revés da 500), después push y tag. La versión del Worker sale de `package.json`: subirla antes del deploy. Desde la F7 hay 7 `package.json` (con `apps/hub`).
- Hub: uno solo de Andoni, nunca guarda música. Límites por IP con hash y sal diaria; 30 personas y 200 canciones por Jam.

## Problemas conocidos

- Los tests de F6 usan una API de Cloudflare simulada; los del Hub, un D1 y una sala simulados.
- `scripts/smoke.mjs` sale con EPERM en Windows y deja wrangler/workerd colgados.
- La copia entre almacenamientos no copia el orden ni lo fijado.
- `DownloadView.tsx` 876 líneas. Tests de navegador sin ejecutar; APK local sin generar.

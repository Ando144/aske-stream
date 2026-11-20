# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F6 (hasta v0.6.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos; carpetas y playlists; vinculación por QR; asistente de Cloudflare. App publicada en Google Cloud.
- **F7 (v0.7.0, publicada: web, API y Hub desplegados, push y tag `v0.7.0`):** workspace `apps/hub` (Worker aparte en `https://aske-hub.andoni-otzdezarate.workers.dev`, D1 `aske-hub`, API `/hub/v1/*`, sirve también la web). Playlists compartidas con enlace `#list=` (90 días). Jams con Durable Object SQLite, WebSocket y QR `#jam=` (12 h, apodo sin cuentas, «me gusta», solo suena el móvil anfitrión, solo Android). Arreglado el botón que pisaba la línea en «Vincular otro dispositivo». Revisor APROBADO, `npm run check` y smoke verdes, Hub real probado con dos clientes.

## En curso / siguiente

- **F7:** comprobar en GitHub → Actions que el CI construye el APK v0.7.0 (no se pudo mirar: falta `gh`); probar la Jam en dos móviles reales (anfitrión Android descargando con yt-dlp); revisar el euskera de `share.ts` y `jam.ts`.
- **MEDIO de la F7:** `jamSocket.ts` debe tratar el cierre 4001 como final (dos pestañas del mismo invitado se echan entre sí); en `room.ts` `webSocketClose` puede fallar al hacer `broadcast` (envolver `send()` en try/catch).
- **MEDIO de la F6:** «Intentarlo de nuevo» tras `subdomain_taken` pide el token otra vez; falta el paso `'database'` en `RunningStep.tsx`; `CloudflareSetupView` 52 líneas; comentar `useHashCredentials`.
- **Pendiente de Andoni:** medir la batería con v0.5.5 en el Pixel.
- **Siguientes fases:** F8 estadísticas y Recap (8b grupos); F9 modo estudio; «Enviar al móvil» vía Hub (fuera de la F7).

## Decisiones tomadas (y por qué)

- Drive con `drive.file`, yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000. Copia: nunca borra el origen.
- Publicar: `db:migrate:remote`, luego `deploy` (al revés da 500), `deploy:hub`, push y tag. La versión sale de `package.json`: subirla antes. Hay 7 `package.json` (con `apps/hub`).
- Hub único de Andoni, nunca guarda música; límites por IP con hash y sal diaria; 30 personas y 200 canciones por Jam.
- Se deja el subdominio `andoni-otzdezarate.workers.dev`: cambiarlo rompería la URL del servidor actual y los móviles vinculados.

## Problemas conocidos

- Los tests de F6 usan una API de Cloudflare simulada; los del Hub, un D1 y una sala simulados.
- `scripts/smoke.mjs` sale con EPERM al borrar el temporal en Windows y puede dejar wrangler/workerd colgados (matarlos a mano).
- La copia entre almacenamientos no copia el orden ni lo fijado.
- `DownloadView.tsx` 876 líneas. Tests de navegador sin ejecutar; APK local sin generar.

# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F6 (hasta v0.6.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos; carpetas y playlists; vinculación por QR; asistente de Cloudflare. App publicada en Google Cloud.
- **F7 (v0.7.0):** `apps/hub` (Worker aparte en `https://aske-hub.andoni-otzdezarate.workers.dev`, D1 `aske-hub`, API `/hub/v1/*`). Playlists compartidas con enlace `#list=` (90 días). Jams con Durable Object, WebSocket y QR `#jam=` (12 h, solo suena el móvil anfitrión, solo Android).
- **v0.8.0 (publicada):** F8a estadísticas y Recap personales (solo en el dispositivo, con permiso, desactivar borra todo, mes y año; IndexedDB v4). Arreglos: Jam con aviso «Usar aquí», deja de reintentar a los 5 min con botones de reconectar y salir; Cloudflare conserva el token si el nombre está ocupado; ahorro de batería en segundo plano (rotación solo cargando o con Wi-Fi sin ahorro, wake lock renovado); Ajustes por secciones; euskera corregido.

## Pendiente de Andoni

- Medir la batería en el Pixel con el APK nuevo (`adb shell dumpsys batterystats --reset`, 1 h con música en pausa, luego `dumpsys batterystats` y `dumpsys power`, sin ninguna Jam abierta).
- Probar a mano el Recap y los Ajustes reorganizados.
- Probar la Jam en dos móviles reales.
- Validar las 6 dudas de euskera de `docs/eu-revision-share-jam.md`.

## Siguiente

- F8b grupos (Recap compartido, con consentimiento aparte); F9 modo estudio; «Enviar al móvil» vía Hub.
- Deuda: `openDB` sin `blocking`/`blocked` (una pestaña con la v3 bloquea la subida a v4); reformular la frase de «Estadísticas» en `PRIVACY.md` (ES); quitar «private yearly Recap» de la fila 8 de `docs/v2/architecture.md`.

## Decisiones tomadas

- Drive con `drive.file`, yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000. Copia: nunca borra el origen.
- Publicar: `db:migrate:remote`, luego `deploy` (al revés da 500), `deploy:hub`, push y tag. Hay 7 `package.json`.
- Hub único de Andoni, nunca guarda música; 30 personas y 200 canciones por Jam.
- Subdominio `andoni-otzdezarate.workers.dev` fijo: cambiarlo rompería los móviles vinculados.

## Problemas conocidos

- `scripts/smoke.mjs` sale con EPERM en Windows y puede dejar wrangler/workerd colgados.
- La copia entre almacenamientos no copia el orden ni lo fijado.
- `DownloadView.tsx` 876 líneas. Tests de navegador sin ejecutar.

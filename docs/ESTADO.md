# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F6 (hasta v0.6.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos; carpetas y playlists; vinculación por QR; asistente de Cloudflare. App publicada en Google Cloud.
- **F7 (v0.7.0):** `apps/hub` (Worker aparte en `https://aske-hub.andoni-otzdezarate.workers.dev`, D1 `aske-hub`, API `/hub/v1/*`). Playlists compartidas con `#list=` (90 días). Jams con Durable Object, WebSocket y QR `#jam=` (12 h, solo suena el móvil anfitrión, solo Android).
- **v0.8.0 (publicada: migraciones, web, API y Hub desplegados, push y tag `v0.8.0`):** F8a estadísticas y Recap personales (solo en el dispositivo, con permiso, desactivar borra todo, solo música, mes y año; IndexedDB v4). Jam con «Usar aquí», deja de reintentar a los 5 min y permite reconectar o salir. Cloudflare conserva el token si el nombre está ocupado. Ahorro de batería en segundo plano (rotación offline solo cargando o con Wi-Fi sin ahorro, wake lock renovado mientras suena). Ajustes por secciones. Euskera validado por Andoni. Revisor APROBADO, `npm run check` y smoke 23/23 verdes; APK compila.

## Pendiente de Andoni

- Mirar en GitHub → Actions que el CI construye el APK v0.8.0 (falta `gh`).
- Medir la batería en el Pixel con el APK nuevo: `adb shell dumpsys batterystats --reset`, 1 h con música en pausa y sin Jam, luego `dumpsys batterystats` y `dumpsys power`. Medida previa: ~9 %/h en segundo plano (versión sin confirmar).
- Probar a mano el Recap y los Ajustes; probar la Jam en dos móviles reales.

## Siguiente

- F8b grupos (Recap compartido, con consentimiento aparte); F9 modo estudio; «Enviar al móvil» vía Hub.
- Si la batería sigue alta: Wi-Fi lock en alto rendimiento con radio/streaming, descargas atascadas que mantienen vivo el servicio.

## Decisiones tomadas (y por qué)

- Drive con `drive.file`, yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000. Copia: nunca borra el origen.
- Publicar: `db:migrate:remote`, luego `deploy` (al revés da 500), `deploy:hub`, push y tag. Hay 7 `package.json`.
- Estadísticas solo locales y con permiso (RGPD); la F8b necesitará consentimiento aparte.
- Hub único de Andoni, nunca guarda música; 30 personas y 200 canciones por Jam.
- Subdominio `andoni-otzdezarate.workers.dev` fijo: cambiarlo rompería los móviles vinculados.

## Problemas conocidos

- `scripts/smoke.mjs` sale con EPERM al limpiar el temporal en Windows (las pruebas sí pasan) y deja wrangler/workerd colgados.
- `apps/mobile/scripts/gradle.mjs` falla en Windows («gradlew.bat no se reconoce»): lanzar `.\gradlew.bat assembleRelease` desde `apps/mobile/android`.
- La copia entre almacenamientos no copia el orden ni lo fijado.
- `DownloadView.tsx` 876 líneas. Tests de navegador sin ejecutar. Sin test del throttle de `player.ts` ni de `blocking` en `db.ts`.

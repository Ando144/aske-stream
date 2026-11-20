# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F6 (hasta v0.6.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos; carpetas y playlists; QR; asistente de Cloudflare. App publicada en Google Cloud.
- **F7 (v0.7.0):** `apps/hub` (`https://aske-hub.andoni-otzdezarate.workers.dev`, API `/hub/v1/*`). Playlists compartidas `#list=` y Jams `#jam=` (Durable Object, solo Android).
- **v0.8.0:** F8a estadísticas y Recap personales (solo locales, con permiso), Jam más fiable, ahorro de batería, Ajustes por secciones.
- **v0.8.1:** cola de descargas nativa (el servicio sigue con la app cerrada, se guarda al reabrir), reintentos con espera, espera sin red, tiempos máximos, guardado en paralelo, botón de Radios solo icono, guía sin parpadeo. Revisor APROBADO, 392 tests y smoke 23/23.

## Pendiente de Andoni

- Mirar en GitHub → Actions que el CI construye los APK v0.8.0 y v0.8.1 (falta `gh`).
- Probar las descargas en el Pixel: cerrar arrastrando con la cola en marcha, modo avión y vuelta de la cobertura, playlist grande.
- Medir la batería (`adb shell dumpsys batterystats --reset`, 1 h con música en pausa). Medida previa ~9 %/h.
- Probar a mano el Recap, los Ajustes y la Jam en dos móviles.

## Siguiente

- F8b grupos (Recap compartido, consentimiento aparte); F9 modo estudio; «Enviar al móvil» vía Hub.
- Pulir descargas: `cancel()`/`clearFinished()` sin flush previo de importaciones; `jobId` vacío en `DownloadQueue.java`; `onTimeout` del servicio.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000. Copia: nunca borra el origen.
- Publicar: `db:migrate:remote`, `deploy`, `deploy:hub`, push y tag. Hay 7 `package.json`.
- Descargas: una a la vez desde YouTube, guardado en paralelo; tiempos solo internos, sin UI.
- Estadísticas solo locales y con permiso; subdominio `andoni-otzdezarate.workers.dev` fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados.
- `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease` en `apps/mobile/android`.
- La copia entre almacenamientos no copia el orden ni lo fijado.
- Tests de navegador sin ejecutar; sin test del throttle de `player.ts` ni de `blocking` en `db.ts`.

# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0:** estadísticas y Recap personales (solo locales, con permiso), Jam más fiable, ahorro de batería, Ajustes por secciones.
- **v0.8.1:** cola de descargas nativa (sigue con la app cerrada), reintentos con espera, espera sin red, tiempos máximos, guardado en paralelo.
- **v0.8.2 (push y tag hechos; web sin desplegar):** pulido de descargas. Cancelar y limpiar guardan antes lo ya descargado (flush en serie, `settleImports`); un `jobId` vacío ya no puede borrar `downloads/`; `onTimeout` para limpio, avisa y reanuda al reabrir; tests nuevos (cola, throttle de `player.ts`, `db.ts`). Revisor APROBADO, `npm run check` OK, smoke 23/23.

## En curso / siguiente

- Andoni: `npm run deploy` (web v0.8.2) y mirar en GitHub → Actions los APK v0.8.0, v0.8.1 y v0.8.2.
- Andoni: probar en el Pixel: descargas (cerrar arrastrando, modo avión, playlist grande), batería (~9 %/h antes), Recap, Ajustes y Jam en dos móviles.
- Andoni: probar `onTimeout`: `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000`; restaurar con `delete`.
- Pulido MEDIO del revisor: `pruneImports` debería conservar importaciones con ids en `pendingVideoIds` (carrera al limpiar con descargas en marcha); `.catch` vacío en `runThrottle.ts:25` oculta errores de `run()`; 2 espacios en Java (`DownloadQueue.java:180`, `DownloaderPlugin.java:230`).
- F8b grupos (consentimiento aparte); F9 modo estudio; «Enviar al móvil» vía Hub.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `db:migrate:remote`, `deploy`, `deploy:hub`, push y tag (7 `package.json`).
- Descargas: una a la vez de YouTube, guardado en paralelo, tiempos solo internos — estabilidad y batería.
- `onTimeout`: parar limpio y reanudar al reabrir, solo notificación (sin aviso en la app) — lo que pide Android y menos textos.
- Estadísticas solo locales y con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados.
- `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`; no se ha hecho `assembleRelease` completo de v0.8.2 en local.
- La copia no copia orden ni fijado; tests de navegador sin ejecutar.
- Al subir versión, `sed` sobre `package-lock.json` toca dependencias con la misma versión: revisar el diff.

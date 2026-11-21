# Estado del proyecto

Actualizado: 2026-11-21

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0:** estadísticas y Recap personales (solo locales, con permiso), Jam más fiable, ahorro de batería, Ajustes por secciones.
- **v0.8.1:** cola de descargas nativa (sigue con la app cerrada), reintentos con espera, espera sin red, tiempos máximos, guardado en paralelo.
- **v0.8.2 (push y tag hechos; web sin desplegar):** pulido de descargas. Cancelar y limpiar guardan antes lo ya descargado (flush en serie, `settleImports`); un `jobId` vacío ya no puede borrar `downloads/`; `onTimeout` para limpio, avisa y reanuda al reabrir; tests nuevos (cola, throttle de `player.ts`, `db.ts`). Revisor APROBADO, `npm run check` OK, smoke 23/23.
- **Pulido posterior a v0.8.2:** `pruneImports` conserva importaciones con ids pendientes, `runThrottle` ya no oculta errores de `run()`, espacios sobrantes en Java corregidos.
- **Buscador de Descargas:** se vacía correctamente al terminar.
- **Enviar al móvil vía Hub:** del ordenador al móvil y de móvil a móvil, con código de un uso o QR (24 h); el Hub no guarda música.

## En curso / siguiente

- Andoni: `npm run hub:migrate:remote` (migración 0002) y `npm run deploy:hub` antes de `npm run deploy`.

- Andoni: `npm run deploy` (web v0.8.2) y mirar en GitHub → Actions los APK v0.8.0, v0.8.1 y v0.8.2.
- Andoni: probar en el Pixel: descargas (cerrar arrastrando, modo avión, playlist grande), batería (~9 %/h antes), Recap, Ajustes y Jam en dos móviles.
- Andoni: probar `onTimeout`: `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000`; restaurar con `delete`.
- F8b grupos (consentimiento aparte); F9 modo estudio.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `db:migrate:remote`, `deploy`, `deploy:hub`, push y tag (7 `package.json`).
- Descargas: una a la vez de YouTube, guardado en paralelo, tiempos solo internos — estabilidad y batería.
- `onTimeout`: parar limpio y reanudar al reabrir, solo notificación (sin aviso en la app) — lo que pide Android y menos textos.
- Velocidad de descargas sin cambios (decisión de Andoni).
- Paquete de un uso: se borra al recibirlo o a las 24 h — el Hub nunca guarda música.
- Estadísticas solo locales y con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados.
- `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`; no se ha hecho `assembleRelease` completo de v0.8.2 en local.
- La copia no copia orden ni fijado; tests de navegador sin ejecutar.
- Al subir versión, `sed` sobre `package-lock.json` toca dependencias con la misma versión: revisar el diff.

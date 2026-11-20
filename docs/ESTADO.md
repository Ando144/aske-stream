# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0:** estadísticas y Recap personales (solo locales, con permiso), Jam más fiable, ahorro de batería, Ajustes por secciones.
- **v0.8.1 (push y tag hechos; web sin desplegar):** cola de descargas nativa (sigue con la app cerrada, se guarda al reabrir), reintentos con espera, espera sin red, tiempos máximos, guardado en paralelo, Radios solo icono, guía sin parpadeo. Revisor APROBADO, 392 tests y smoke 23/23.

## En curso / siguiente

- Andoni: `npm run deploy` (web v0.8.1) y mirar en GitHub → Actions los APK v0.8.0 y v0.8.1.
- Andoni: probar descargas en el Pixel (cerrar arrastrando, modo avión, playlist grande), medir batería (~9 %/h antes), probar Recap, Ajustes y Jam en dos móviles.
- Andoni: probar `onTimeout` en el Pixel (forzar con `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000`; restaurar con `delete`).
- Hecho al pulir descargas: flush de importaciones en `cancel()`/`clearFinished()`, `jobId` vacío, `onTimeout` con aviso y reanudación, y tests del throttle y de `db.ts`.
- F8b grupos (consentimiento aparte); F9 modo estudio; «Enviar al móvil» vía Hub.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `db:migrate:remote`, `deploy`, `deploy:hub`, push y tag (7 `package.json`).
- Descargas: una a la vez de YouTube, guardado en paralelo, tiempos solo internos — estabilidad y batería.
- Estadísticas solo locales y con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados.
- `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- La copia no copia orden ni fijado; tests de navegador sin ejecutar.

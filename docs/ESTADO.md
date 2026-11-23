# Estado del proyecto

Actualizado: 2026-11-22

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0-v0.8.4:** estadísticas y Recap locales, Jam fiable, batería, cola de descargas nativa, Enviar al móvil por código o QR, notificación de descargas, arranque sin red, aleatorio sin repeticiones.
- **v0.8.5 (publicada: migración 0003, Hub, web, push y tag; el APK lo construye el CI):** playlists enteras de YouTube en Enviar al móvil.
  - Enlace de playlist → lista con casillas (hasta 1000); el móvil lee YouTube directo y el ordenador por el Hub (`GET /hub/v1/playlists/:id`, no guarda nada).
  - El móvil receptor crea una playlist con el nombre de YouTube («Nombre (2)» si existe); privadas o borradas se saltan y se avisa.
  - Mix y «Me gusta»/«Ver más tarde» no se abren enteros. Ordenador con Cloudflare sin Hub: envía el enlace entero.

## En curso / siguiente

- Andoni: mirar en GitHub → Actions los APK v0.8.0 a v0.8.5.
- Andoni: probar en el Pixel v0.8.4 (notificación, arranque sin red, aleatorio con 80 h) y v0.8.5 (playlist real pegada en el móvil y por código/QR desde el ordenador).
- Pendiente de v0.8.3: Jam en dos móviles y `onTimeout` con `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000` (restaurar con `delete`).
- Pulir v0.8.5: `playlistReader.ts` no marca `exhausted` al cortar en 1000 (aviso falso de «incompleta»); `PlaylistPicker` tiene 70 líneas; borrar `dl.loadingPlaylist` y `dl.playlistLoadingMore`; tests de la pantalla; `test:e2e` sin ejecutar.
- Después: F8b grupos (consentimiento aparte); F9 modo estudio.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json` y 8 entradas propias del lock, editadas con node, no sed).
- Playlists por el Hub en lectura de 100 en 100, sin guardar nada — privacidad y poca CPU en el plan gratuito.
- Notificación: solo el servicio nativo escribe — Android descarta ráfagas y se congelaba.
- Sonda de red sin terceros: Cloudflare → su Worker; resto → el Hub propio — privacidad.
- Estadísticas solo locales y con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- `PairView.tsx` sigue usando `generate_204` de Google (decidir si se cambia por el Hub).
- `downloads.ts` en 650 líneas y `player.ts` en 745: extraer antes de crecer.
- La copia no copia orden ni fijado; tests de navegador sin ejecutar.

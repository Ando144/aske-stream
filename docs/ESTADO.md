# Estado del proyecto

Actualizado: 2026-11-23

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0-v0.8.5 (publicadas):** estadísticas y Recap locales, Jam fiable, batería, cola de descargas nativa, Enviar al móvil por código, QR o playlist entera de YouTube (hasta 1000), notificación de descargas, arranque sin red, aleatorio sin repeticiones.
- **Mejoras sin versión (aún no 0.8.6, sin publicar):**
  - Notificación de descargas con progreso continuo que nunca baja (app y `DownloadService.java`).
  - Botones Jam y Recibir arreglados.
  - Nueva animación de arranque del logo: trazo, relleno, destello ámbar, pulso y fundido; respeta reduced-motion.
  - `capped` en `playlistReader` (corte en 1000 sin aviso falso de «incompleta»).
  - `PlaylistPicker` por debajo de 50 líneas, con tests; claves `dl.loadingPlaylist` y `dl.playlistLoadingMore` borradas.
  - `PairView` sin `generate_204`: sonda al Hub propio en `lib/networkDiagnosis.ts`.

## En curso / siguiente

- Andoni: probar el APK: notificación con la app cerrada y abierta; un lote nuevo con el anterior al 100 % deja la barra en 100 hasta alcanzarla (riesgo aceptado).
- Andoni: comprobar a ojo Jam y Recibir a 360 px y la animación de arranque.
- Andoni: mirar en GitHub → Actions los APK v0.8.0 a v0.8.5.
- Pendiente de v0.8.3: Jam en dos móviles y `onTimeout` con `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000` (restaurar con `delete`).
- Siguiente: F8b grupos (consentimiento aparte); después F9 modo estudio.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json` y 8 entradas propias del lock, editadas con node, no sed).
- Playlists por el Hub en lectura de 100 en 100, sin guardar nada — privacidad y poca CPU gratuita.
- Notificación: solo el servicio nativo escribe (Android descarta ráfagas). Progreso = (terminadas + % actual)/total con suelo que nunca baja.
- `capped` en vez de `exhausted`: exhausted marcaría las canciones 1001+ como no disponibles.
- Sonda de red sin terceros: Cloudflare → su Worker; resto → el Hub propio — privacidad.
- Estadísticas solo locales y con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- `downloads.ts` (650 líneas) y `player.ts` (745) sin refactorizar, por decisión.
- La copia no copia orden ni fijado (por decisión); tests de navegador sin ejecutar.

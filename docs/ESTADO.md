# Estado del proyecto

Actualizado: 2026-11-23

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0-v0.8.5:** estadísticas y Recap locales, Jam fiable, batería, cola de descargas nativa, Enviar al móvil (código, QR o playlist entera de YouTube, hasta 1000), notificación, arranque sin red, aleatorio sin repeticiones.
- **v0.8.6 (publicada: web, push y tag; el APK lo construye el CI; el Hub no cambia):** progreso de la notificación continuo y sin bajar; botones Jam y Recibir arreglados; animación de arranque nueva (reduced-motion respetado); `capped` en `playlistReader`; `PlaylistPicker` <50 líneas con tests; `PairView` sin Google (`lib/networkDiagnosis.ts`).

## En curso / siguiente

- Andoni: mirar en GitHub → Actions los APK v0.8.0 a v0.8.6.
- Andoni: probar el APK v0.8.6 (notificación con la app abierta y cerrada; Jam y Recibir a 360 px; animación de arranque).
- Pendiente de v0.8.3: Jam en dos móviles y `onTimeout` con `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000` (restaurar con `delete`).
- Siguiente: F8b grupos (consentimiento aparte); después F9 modo estudio.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json` y 8 entradas del lock, con node, no sed).
- Notificación: solo el servicio nativo escribe; progreso = (terminadas + % actual)/total con suelo que nunca baja — Android descarta ráfagas. Un lote nuevo con el anterior al 100 % deja la barra en 100 (aceptado).
- `capped` en vez de `exhausted` — exhausted marcaría las canciones 1001+ como no disponibles.
- Sonda de red sin terceros (Cloudflare → su Worker; resto → Hub propio) — privacidad.
- Estadísticas solo locales y con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- `downloads.ts` (650 líneas) y `player.ts` (745) sin refactorizar, por decisión.
- La copia no copia orden ni fijado (por decisión); tests de navegador sin ejecutar.

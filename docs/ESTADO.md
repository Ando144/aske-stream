# Estado del proyecto

Actualizado: 2026-11-22

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0-v0.8.3:** estadísticas y Recap locales, Jam fiable, batería, cola de descargas nativa con reintentos, Enviar al móvil por código o QR vía Hub.
- **v0.8.4 (publicada: push y tag `v0.8.4`; el APK lo construye el CI; `npm run check` y `test:e2e` OK):**
  - Notificación de descargas: contador, barra del lote, fase «guardando» y aviso final; un solo escritor nativo (máx. 1 actualización/s) y latido del JS cada 5 s.
  - Arranque con mala cobertura: pantalla con logo (1-5 s), tiempos máximos de 4 s, modo sin conexión con banner y reintento automático.
  - Aleatorio: memoria de ciclo por lista, sin repetir hasta agotar; «Todo» es viva y recibe canciones nuevas.

## En curso / siguiente

- Andoni: mirar en GitHub → Actions los APK v0.8.0 a v0.8.4.
- Andoni: probar v0.8.4 en el Pixel: notificación de descargas, arranque sin red (modo avión y red mala), aleatorio con 80 h.
- Pendiente de v0.8.3: Enviar al móvil (QR y código), Jam en dos móviles, `onTimeout` con `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000` (restaurar con `delete`).
- Siguiente: playlists enteras de YouTube en Enviar al móvil; F8b grupos (consentimiento aparte); F9 modo estudio.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json` y 8 entradas propias del lock).
- Notificación: solo el servicio nativo escribe — Android descarta ráfagas y se congelaba. Barra = progreso total del lote.
- Sonda de red sin terceros: Cloudflare → su Worker; resto → el Hub propio — privacidad.
- Aleatorio: una memoria por lista (las 20 más recientes); cada filtro o búsqueda cuenta como lista.
- Estadísticas solo locales y con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- `PairView.tsx` sigue usando `generate_204` de Google (anterior a v0.8.4; decidir si se cambia).
- `downloads.ts` está justo en 650 líneas y `player.ts` en 745: extraer antes de crecer.
- La copia no copia orden ni fijado; tests de navegador sin ejecutar.
- Al subir versión, `sed` sobre `package-lock.json` puede tocar dependencias: revisar el diff.

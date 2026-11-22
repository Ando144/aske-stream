# Estado del proyecto

Actualizado: 2026-11-22

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0:** estadísticas y Recap personales (solo locales, con permiso), Jam más fiable, ahorro de batería, Ajustes por secciones.
- **v0.8.1-v0.8.2:** cola de descargas nativa con reintentos y espera sin red; cancelar y limpiar guardan lo ya descargado; `onTimeout` para limpio y reanuda al reabrir.
- **v0.8.3 (publicada: migración 0002, Hub, web, push y tag; el APK lo construye el CI):**
  - Pulido: `pruneImports` conserva importaciones pendientes, `runThrottle` registra errores, espacios en Java.
  - Buscador de Descargas: al vaciar el texto desaparecen los resultados.
  - **Enviar al móvil vía Hub:** del ordenador al móvil y de móvil a móvil, con código de 6 símbolos o QR. Solo canciones sueltas de YouTube; el código vale una vez y caduca a las 24 h. Cloudflare conserva su envío.
  - Revisor APROBADO, `npm run check` OK, smoke 23/23 (antes de las últimas correcciones).
- **v0.8.4 (programada y revisada, sin commit ni publicar; `npm run check` OK, revisor APROBADO en 2.ª ronda):**
  - Notificación de descargas: contador, barra del lote, fase «guardando» y aviso final; un solo escritor con límite de frecuencia.
  - Arranque con mala cobertura: pantalla de arranque, tiempos máximos, modo sin conexión con banner y reintento automático.
  - Aleatorio de verdad: memoria de ciclo por lista, sin repetir hasta agotar y con las canciones nuevas.

## En curso / siguiente

- v0.8.4: hacer commit, `test:e2e`, probar en el Pixel (notificación, tren/sin red, aleatorio) y publicar. Pendientes MEDIO: la notificación nativa puede parpadear al inicio (`lastJsUpdateAt` en `onStartCommand`); falta test del store con `active:false`; `PairView.tsx` sigue usando `generate_204`.
- Andoni: mirar en GitHub → Actions los APK v0.8.0 a v0.8.3.
- Andoni: probar en el Pixel: Enviar al móvil (QR y código, ordenador→móvil y móvil→móvil), buscador con la X, descargas, batería, Recap, Ajustes, Jam en dos móviles.
- Andoni: probar `onTimeout`: `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000`; restaurar con `delete`.
- Siguiente: playlists enteras de YouTube en Enviar al móvil; F8b grupos (consentimiento aparte); F9 modo estudio.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json`).
- Descargas: una a la vez de YouTube, guardado en paralelo; velocidad sin cambios (decisión de Andoni) — estabilidad y batería.
- Paquete de Enviar: un solo uso, solo hash de la clave, sin IP ni datos; topes por IP (GET 300, reclamar y borrar 20 por 10 min) — privacidad y que el sondeo cada 4 s no dé 429.
- Notificación: solo el servicio nativo escribe (máx. 1 actualización/s) — Android descarta las ráfagas y la notificación se congelaba.
- Barra de la notificación = progreso total del lote; aviso final aparte que se quita al tocarlo o al abrir la app.
- Sonda de red sin terceros: Cloudflare → su Worker; resto → el Hub propio. Nada de servicios de Google.
- Aleatorio: una memoria de ciclo por lista (las 20 más recientes); cada filtro o búsqueda cuenta como lista; «Todo» es viva y recibe canciones nuevas.
- Estadísticas solo locales y con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados.
- `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`; no se ha hecho `assembleRelease` local desde v0.8.2.
- La copia no copia orden ni fijado; tests de navegador sin ejecutar.
- Al subir versión, `sed` sobre `package-lock.json` puede tocar dependencias con la misma versión: revisar el diff.
- Enviar al móvil: si falla añadir a la cola tras reclamar, hay que pedir un código nuevo (ya avisa).

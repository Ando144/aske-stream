# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F5.5 (hasta v0.5.5, publicada):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos; carpetas y playlists ordenables y fijables; menos batería. Pruebas con Drive y Cloudflare, app publicada, botones de Google en euskera y prueba con un amigo: confirmado por Andoni.
- **F6 (hecha, sin commit ni publicar):** vincular otro dispositivo con QR o código de un solo uso (migración 0007, `/api/health` con versión); asistente para montar y actualizar Cloudflare desde la app Android (plugins `CloudflareApi` y `QrScanner`, Worker empaquetado en `cf-bundle`); aviso de servidor antiguo en Ajustes y banner; artículos de ayuda `link-device`, `cloudflare-setup`, `cloudflare-token`, `cloudflare-update`. Revisada y aprobada; `npm run check` en verde.
- **Privacidad:** `docs/PRIVACY.md` (es/en) enlazada desde Google Cloud.

## En curso / siguiente

- **Antes de publicar la F6:** probar el asistente y la actualización con una cuenta de Cloudflare real; revisar el euskera nuevo; compilar el Java (plugins nuevos) en CI. Orden: `db:migrate:remote`, `deploy`, push y tag.
- **Pendiente de Andoni:** medir la batería con v0.5.5 en el Pixel; Google Cloud → **Publicar aplicación** (sigue en Testing).
- **Siguientes:** F7 Playlists compartidas y Jams; F8 Estadísticas y Recap (8b grupos); F9 Modo estudio.

## Decisiones tomadas (y por qué)

- Drive con `drive.file`, yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000. Copia: nunca borra el origen.
- Código de vinculación: 8 caracteres, 10 min, 5 intentos; en el servidor solo se guarda su hash.
- El token de Cloudflare y la clave de acceso que crea el asistente no se guardan ni se muestran.
- Montar y actualizar solo en Android (la API de Cloudflare bloquea el navegador); la web solo se vincula.

## Problemas conocidos

- F6 no está probada contra Cloudflare real: nombres de campos de la subida, hash SHA-256 en vez de blake3, migraciones sin transacción y códigos de error supuestos (p. ej. nombre de dirección ocupado).
- `scripts/smoke.mjs` sale con EPERM en Windows y deja wrangler/workerd colgados (arreglo: matar el árbol de procesos en `stop()`).
- La copia entre almacenamientos no copia el orden ni lo fijado. Móviles con v0.5.4 o anterior pueden perder lo fijado al sincronizar Drive.
- `DownloadView.tsx` 876 líneas. Tests de navegador sin ejecutar; APK local sin generar (faltan ANDROID_HOME y JAVA_HOME).

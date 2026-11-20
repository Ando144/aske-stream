# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F5.5 (hasta v0.5.5, publicada):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos; carpetas y playlists ordenables y fijables; menos batería. Pruebas con Drive y Cloudflare, app publicada, botones de Google en euskera y prueba con un amigo: confirmado por Andoni.
- **F6 (v0.6.0, publicada: migración 0007, deploy, push y tag; el CI construye el APK; Andoni la probó antes de publicar):** vincular otro dispositivo con QR o código de un solo uso (migración 0007, `/api/health` con versión); asistente para montar y actualizar Cloudflare desde la app Android (plugins `CloudflareApi` y `QrScanner`, Worker empaquetado en `cf-bundle`); aviso de servidor antiguo en Ajustes y banner; artículos de ayuda `link-device`, `cloudflare-setup`, `cloudflare-token`, `cloudflare-update`. Revisada y aprobada; `npm run check` en verde.
- **Privacidad:** `docs/PRIVACY.md` (es/en) enlazada desde Google Cloud.

## En curso / siguiente

- **F6:** comprobar que el CI compila el APK (el Java de `CloudflareApiPlugin` y `QrScannerPlugin` no se había compilado en local); revisar el euskera nuevo (hay botones que siguen en inglés: «Continue to summary», «Create token», «Copy»).
- **Sugerencias MEDIO de la F6 sin hacer:** «Intentarlo de nuevo» tras `subdomain_taken` pide el token otra vez; falta el paso `'database'` en la lista de actualización de `RunningStep.tsx`; `CloudflareSetupView` tiene 52 líneas; comentar `useHashCredentials`; los errores de los artículos de ayuda no copian el texto exacto de la pantalla.
- **Pendiente de Andoni:** medir la batería con v0.5.5 en el Pixel; Google Cloud → **Publicar aplicación** (sigue en Testing).
- **Siguientes:** F7 Playlists compartidas y Jams; F8 Estadísticas y Recap (8b grupos); F9 Modo estudio.

## Decisiones tomadas (y por qué)

- Drive con `drive.file`, yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000. Copia: nunca borra el origen.
- Código de vinculación: 8 caracteres, 10 min, 5 intentos; en el servidor solo se guarda su hash.
- El token de Cloudflare y la clave de acceso que crea el asistente no se guardan ni se muestran.
- Montar y actualizar solo en Android (la API de Cloudflare bloquea el navegador); la web solo se vincula.

## Problemas conocidos

- F6: los tests usan una API de Cloudflare simulada. Si falla con una cuenta nueva, mirar primero los nombres de campos de la subida, el hash SHA-256 (en vez de blake3), las migraciones sin transacción y los códigos de error supuestos (p. ej. nombre de dirección ocupado).
- `scripts/smoke.mjs` sale con EPERM en Windows y deja wrangler/workerd colgados (arreglo: matar el árbol de procesos en `stop()`).
- La copia entre almacenamientos no copia el orden ni lo fijado. Móviles con v0.5.4 o anterior pueden perder lo fijado al sincronizar Drive.
- `DownloadView.tsx` 876 líneas. Tests de navegador sin ejecutar; APK local sin generar (faltan ANDROID_HOME y JAVA_HOME).

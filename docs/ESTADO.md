# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F5.5 (hasta v0.5.5):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos; carpetas y playlists ordenables y fijables; menos batería. Todo probado y publicado.
- **F6 (v0.6.0, publicada: migración 0007, deploy, push y tag; el CI construye el APK; Andoni la probó):** vincular otro dispositivo con QR o código de un solo uso; asistente para montar y actualizar Cloudflare desde la app Android (plugins `CloudflareApi` y `QrScanner`, Worker empaquetado en `cf-bundle`); aviso de servidor antiguo en Ajustes y banner; artículos de ayuda `link-device`, `cloudflare-setup`, `cloudflare-token`, `cloudflare-update`.
- **Privacidad:** `docs/PRIVACY.md` (es/en) enlazada desde Google Cloud.

## En curso / siguiente

- **F6:** comprobar que el CI compila el APK (el Java de los plugins nuevos no se compiló en local); revisar el euskera nuevo (siguen en inglés «Continue to summary», «Create token», «Copy»).
- **MEDIO de la F6 sin hacer:** «Intentarlo de nuevo» tras `subdomain_taken` pide el token otra vez; falta el paso `'database'` en `RunningStep.tsx`; `CloudflareSetupView` tiene 52 líneas; comentar `useHashCredentials`; los errores de los artículos no copian el texto exacto de la pantalla.
- **Pendiente de Andoni:** medir la batería con v0.5.5 en el Pixel; Google Cloud → **Publicar aplicación** (sigue en Testing).
- **Siguientes fases:** F7 playlists compartidas y Jams; F8 estadísticas y Recap (8b grupos); F9 modo estudio.

## Decisiones tomadas (y por qué)

- Drive con `drive.file`, yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000. Copia: nunca borra el origen.
- Código de vinculación: 8 caracteres, 10 min, 5 intentos; el servidor solo guarda su hash.
- El token de Cloudflare y la clave de acceso del asistente no se guardan ni se muestran.
- Montar y actualizar solo en Android — la API de Cloudflare bloquea el navegador; la web solo se vincula.
- Publicar: `db:migrate:remote`, luego `deploy` (al revés da 500), después push y tag. La versión del Worker sale de `package.json`: subirla antes del deploy.

## Problemas conocidos

- F6: los tests usan una API de Cloudflare simulada. Si falla con una cuenta nueva, mirar los nombres de campos de la subida, el hash SHA-256 (en vez de blake3), las migraciones sin transacción y los códigos de error supuestos.
- `scripts/smoke.mjs` sale con EPERM en Windows y deja wrangler/workerd colgados (arreglo: matar el árbol de procesos en `stop()`).
- La copia entre almacenamientos no copia el orden ni lo fijado. Móviles con v0.5.4 o anterior pueden perder lo fijado al sincronizar Drive.
- `DownloadView.tsx` 876 líneas. Tests de navegador sin ejecutar; APK local sin generar (faltan ANDROID_HOME y JAVA_HOME).

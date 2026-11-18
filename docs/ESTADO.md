# Estado del proyecto

Actualizado: 2026-11-19

## Hecho

- **F1-F5.2 (v0.5.2):** biblioteca en dispositivo, Cloudflare o Drive; app Android; descarga de YouTube y playlists completas; ayuda eu/es/en; temporizador de apagado; copia en las 6 direcciones entre almacenamientos, reanudable y sin borrar nada.
- **F5.3 (publicada en v0.5.3):** carpetas de un nivel, portada propia y juntar playlists. Pruebas en el móvil casi todas bien.
- **Política de privacidad:** `docs/PRIVACY.md` (es/en), con enlace desde Google Cloud. En Branding está `github.com` como dominio autorizado.

## En curso / siguiente

- **Fase 5.4 (Hecho, sin publicar):** pantalla sin scroll horizontal, ordenar carpetas arrastrando (con migración 0005), quitar «juntar arrastrando» y limpieza de código. **Antes del próximo deploy:** `npm run db:migrate:remote` (migración 0005) y después `npm run deploy`.
- **Pendiente de Andoni:** repetir las pruebas de F5.3 con Drive y con Cloudflare; en Google Cloud, Público → **Publicar aplicación** (sigue en Testing); botones de Google en euskera (`docs/google-drive.md`); probar con un amigo; lo pendiente de la v0.5.1 (playlist de 168, descargas con pantalla apagada).
- **F6** Asistente Cloudflare y QR. **F7** Playlists compartidas y Jams. **F8** Estadísticas y Recap anual (privadas); **8b** grupos de amigos. **F9** Modo estudio.

## Decisiones tomadas (y por qué)

- Drive con permiso `drive.file` y sin verificación oficial — no es sensible; se explica el aviso. Google exige igualmente página principal y política de privacidad para publicar.
- yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Copia: nunca borra el origen y salta lo que ya está — es seguro repetirla o reanudarla.
- Cloudflare solo admite Opus: MP3/M4A/FLAC se saltan en la copia y se cuenta cuántas.
- Cloudflare con tope de 10 GB; playlists de hasta 1000.

## Problemas conocidos

- Cerrar la app deslizándola sigue parando las descargas.
- `isPlaylistComplete` falla si el token de YouTube se rompe: vuelve el tope de 100.
- `DownloadView.tsx` tiene 876 líneas: extraer `PlaylistSheet`.
- `createApi` (`api/client.ts`) mide ~100 líneas.
- Copia: si falla al abrir origen o destino queda en pausa sin explicar; `copy.notEnoughSpace` aconseja copiar solo una parte y no se puede.
- Temporizador: «Al acabar la canción» deja sonar un instante la siguiente.
- Tests de navegador sin ejecutar; APK no generado en local (faltan ANDROID_HOME y JAVA_HOME).

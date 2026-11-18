# Estado del proyecto

Actualizado: 2026-11-18

## Hecho

- **F1-F5.1 (v0.5.1):** biblioteca en dispositivo, Cloudflare o Drive; app Android; descarga de YouTube y playlists completas; ayuda eu/es/en; temporizador de apagado.
- **F5.2 (v0.5.2 publicada: push, web desplegada y tag `v0.5.2`, el CI construye el APK):** copia en las 6 direcciones entre dispositivo, Drive y Cloudflare (canciones, «me gusta», playlists y radios), reanudable y sin borrar nada; guía en pantalla y en la ayuda para el aviso de Google «app no verificada».
- **Política de privacidad:** `docs/PRIVACY.md` (es/en), con enlace desde Google Cloud. En Branding está `github.com` como dominio autorizado.

- **F5.3 (hecho, sin publicar):** carpetas de un nivel, portada propia y juntar playlists (borra la otra por defecto, casilla desmarcable). Antes de publicar: `npm run db:migrate:remote` y después `npm run deploy`.

## En curso / siguiente

- **Ahora (lo hace Andoni):** en Google Cloud, Público → **Publicar aplicación** (sigue en Testing); comprobar el APK v0.5.2 en Actions/Releases; probar la copia en el móvil (6 direcciones, cancelar y seguir); comprobar los botones de Google en euskera (`docs/google-drive.md`); probar con un amigo; lo pendiente de la v0.5.1 (playlist de 168, descargas con pantalla apagada, temporizador).
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

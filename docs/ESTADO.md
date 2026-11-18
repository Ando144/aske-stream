# Estado del proyecto

Actualizado: 2026-11-18

## Hecho

- **F1-F5.1 (v0.5.1 publicada):** biblioteca en dispositivo, Cloudflare o Drive; app Android; descarga de YouTube y playlists completas; ayuda eu/es/en; temporizador de apagado; descargas en segundo plano.
- **F5.2 (sin publicar):** copia en las 6 direcciones entre dispositivo, Drive y Cloudflare (canciones, «me gusta», playlists y radios), reanudable y sin borrar nada; guía para el aviso de Google «app no verificada».

## En curso / siguiente

- **Ahora:** probar en el móvil la copia (6 direcciones, cancelar y seguir) y el aviso de Google; comprobar los botones en euskera (ver `docs/google-drive.md`); pasar la pantalla de Google Cloud a producción; lo pendiente de la v0.5.1 (playlist de 168, descargas con pantalla apagada, temporizador).
- **5.3** Carpetas de un nivel, portadas y juntar playlists. **F6** Asistente Cloudflare y QR. **F7** Playlists compartidas y Jams.
- **F8** Estadísticas y Recap anual (privadas); **8b** grupos de amigos. **F9** Modo estudio.

## Decisiones tomadas (y por qué)

- Drive con permiso `drive.file` y sin verificar la app — no es sensible; se explica el aviso en pantalla y en la ayuda.
- yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Copia: nunca borra el origen y salta lo que ya está — es seguro repetirla o reanudarla.
- Cloudflare solo admite Opus: MP3/M4A/FLAC se saltan en la copia y se cuenta cuántas.
- Cloudflare con tope de 10 GB; playlists de hasta 1000.

## Problemas conocidos

- Cerrar la app deslizándola sigue parando las descargas.
- `isPlaylistComplete` falla si el token de YouTube se rompe: vuelve el tope de 100.
- `DownloadView.tsx` tiene 876 líneas: extraer `PlaylistSheet`.
- `createApi` en `api/client.ts` mide unas 100 líneas (>50); `run.ts` traga errores de playlists y radios sin registrarlos.
- Si la copia falla al abrir origen o destino, queda en pausa sin explicación; `copy.notEnoughSpace` aconseja copiar solo una parte, y no se puede.
- Temporizador: «Al acabar la canción» deja sonar un instante la siguiente.
- Tests de navegador sin ejecutar; APK no generado en local (faltan ANDROID_HOME y JAVA_HOME).

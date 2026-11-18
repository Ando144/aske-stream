# Estado del proyecto
Actualizado: 2026-11-18

## Hecho
- **F1-F5:** biblioteca en dispositivo, Cloudflare o Drive; app Android; descarga de YouTube; ayuda eu/es/en; Google Drive.
- **F5.1 (v0.5.1, publicada: push y tag `v0.5.1` subidos, el CI construye el APK):** contador «1 de N»; playlists importadas completas y en el orden de YouTube, con «Nombre (n)» o juntar; borrar la canción que suena salta a la siguiente; vista previa arreglada y playlists grandes leídas enteras (antes tope de 100); descargas en segundo plano en Android (arreglo ligero); poda de borrados a 180 días; temporizador de apagado.

## En curso / siguiente
- **Ahora:** probar la v0.5.1 en el móvil: playlist de 168, descargas con pantalla apagada, playlist importada, temporizador.
- **5.2** Copia en todas las direcciones al cambiar de almacenamiento.
- **5.3** Carpetas de un nivel, portadas y juntar playlists (borra la otra por defecto, casilla desmarcable).
- **F6** Asistente Cloudflare y QR. **F7** Playlists compartidas y Jams.
- **F8** Estadísticas (+ Recap anual, privadas); **8b** grupos de amigos por el Hub.
- **F9** Modo estudio: fijar app + pantalla simple. Al acabar suena campanilla, vibra y sale «Tiempo cumplido» con «Terminar» o «Seguir».

## Decisiones tomadas (y por qué)
- Drive con permiso `drive.file` — no exige revisión de Google.
- yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis, sin bloqueos y sin perder calidad.
- Descargas en segundo plano: arreglo ligero — la cola en Java solo si no basta.
- Nombre de playlist repetido: preguntar al importar y «Nombre (n)» al enviar desde el ordenador — en el móvil no hay quién responda.
- Cloudflare con tope de 10 GB; playlists de hasta 1000.

## Problemas conocidos
- Cerrar la app deslizándola sigue parando las descargas.
- `isPlaylistComplete` da por completa una playlist si YouTube dice que no hay más páginas: si el token se rompe, vuelve el tope de 100.
- `DownloadView.tsx` tiene 876 líneas (>800): extraer `PlaylistSheet` a `components/PlaylistSheet.tsx`.
- Al juntar con una playlist casi llena (1000) se pueden perder canciones propias del final.
- Temporizador: «Al acabar la canción» deja sonar una fracción de segundo la siguiente; con repetir «una» puede fallar en casos raros.
- Tests de navegador (Playwright Python) sin ejecutar; APK no generado en local (faltan ANDROID_HOME y JAVA_HOME).
- Pueden quedar procesos `vitest` en modo watch abiertos: cerrarlos con `Stop-Process`.

# Estado del proyecto (v0.5.1 pendiente de publicar, noviembre 2026)

## Hecho

- **F1-F5:** biblioteca en dispositivo, Cloudflare o Drive; app Android; descarga de YouTube; ayuda eu/es/en; Google Drive.
- **F5.1:** tandas con contador «1 de N»; playlists importadas completas (orden de YouTube, «Nombre (n)» o juntar); borrar la canción que suena salta a la siguiente; vista previa arreglada y lectura completa de playlists grandes (antes tope de 100); descargas en segundo plano en Android (arreglo ligero); poda de borrados a 180 días; temporizador de apagado.

## Siguientes pasos (en orden)

1. **5.2** Copia en todas las direcciones al cambiar de almacenamiento.
2. **5.3** Carpetas de un nivel, portadas y juntar playlists (borra la otra por defecto, casilla desmarcable).
3. **F6** Asistente Cloudflare y QR. **F7** Playlists compartidas y Jams.
4. **F8** Estadísticas (+ Recap anual, privadas); **8b** grupos de amigos por el Hub.
5. **F9** Modo estudio (fijar app + pantalla de concentración). Al acabar: campanilla suave, vibración y tarjeta «Tiempo cumplido» con «Terminar» o «Seguir», sin desbloqueo brusco.

## Decisiones vigentes

- Drive con permiso `drive.file`; yt-dlp en el móvil; APK por GitHub Releases; Opus sin recodificar.
- Cloudflare con tope de 10 GB; playlists de hasta 1000.

## Pendientes y riesgos

- Probar en el móvil: descargas con pantalla apagada, vista previa gris y playlist de 168.
- Cerrar la app deslizándola sigue parando las descargas.
- `isPlaylistComplete` da por completa una playlist si YouTube dice que no hay más páginas (si el token se rompe volvería el tope de 100).
- `DownloadView.tsx` tiene 876 líneas: extraer `PlaylistSheet` a `components/PlaylistSheet.tsx`.
- Al juntar con una playlist casi llena (1000), `arrangeImportedPlaylist` puede perder canciones propias del final.
- «Al acabar la canción» deja sonar una fracción de segundo la siguiente; con repetir «una» el temporizador puede fallar en casos raros.
- Tests de navegador (Playwright Python) sin ejecutar.

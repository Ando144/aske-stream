# Estado del proyecto
Actualizado: 2026-11-19

## Hecho
- **F1-F5.2:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos.
- **F5.3 (v0.5.3) y F5.4 (v0.5.4, push y tag hechos; el CI construye el APK):** carpetas de un nivel (solo playlists), portada propia, juntar desde «…», «Quitar temporizador», sin scroll horizontal, carpetas ordenables arrastrando (`Folder.position`, migración 0005).
- **5.4 en producción:** migración 0005 y deploy hechos (primero `db:migrate:remote`, luego `deploy`; al revés da 500).
- **Privacidad:** `docs/PRIVACY.md` (es/en) enlazada desde Google Cloud.

## En curso / siguiente
- **Pendiente de Andoni:** probar arrastre de carpetas y ancho en es/en/eu (umbral 520 px sin medir); repetir pruebas de 5.3 con Drive y Cloudflare; Google Cloud → **Publicar aplicación** (sigue en Testing); botones de Google en euskera; probar con un amigo.
- **F6** Asistente Cloudflare y QR (con actualización guiada del Worker). **F7** Playlists compartidas y Jams. **F8** Estadísticas y Recap; **8b** grupos. **F9** Modo estudio.

## Decisiones tomadas (y por qué)
- Drive con `drive.file` sin verificación oficial — no es sensible; se explica el aviso.
- yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Copia: nunca borra el origen; carpetas por nombre, playlists y portadas por id.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000.
- Worker antiguo: solo aviso (`toast.cloudflareOutdated`) hasta la F6.
- Orden de carpetas: `position` + regla única `sortFolders` (`@aske/shared`); carpeta nueva al final; playlists no se reordenan.

## Problemas conocidos
- `scripts/smoke.mjs` sale con código 1 en Windows (EPERM al borrar el temporal) aunque pasen los 21 pasos.
- Móvil con v0.5.3 que sincronice Drive conserva el orden pero no puede cambiarlo.
- Cerrar la app deslizándola para las descargas; `isPlaylistComplete` vuelve al tope de 100 si falla el token.
- `DownloadView.tsx` 876 líneas; `createApi` ~100. Temporizador: «Al acabar la canción» deja sonar un instante la siguiente.
- Copia: si falla al abrir origen o destino queda en pausa sin explicar. Tests de navegador sin ejecutar; APK local sin generar (faltan ANDROID_HOME y JAVA_HOME).

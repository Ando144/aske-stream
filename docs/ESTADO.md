# Estado del proyecto

Actualizado: 2026-11-25

## Hecho

- **F1-F7 (hasta v0.7.0) y v0.8.x:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams; estadísticas y Recap locales; Enviar al móvil; grupos de amigos.
- **v0.9.0:** F9 modo estudio solo en Android (pantalla fijada, campanilla nativa, ruidos y ambientes).
- **v0.9.1 (publicada: commit `6d7e865`, push, tag y web desplegada; el CI construye el APK):** vigilante contra cortes de música, notificación honesta, botones táctiles sin gris pegado, selector de tema con iconos, Seleccionar en cuadrícula, volumen del estudio solo arrastrando, Enviar junto a Recibir en Descargas y fila «Con amigos» (Compartir, Recibir, Jam, Grupos) en Playlists.

## En curso / siguiente

- **Andoni: comprobar en GitHub → Actions que el APK v0.9.1 se ha construido, e instalarlo.**
- **Prueba del corte de música con el APK v0.9.1:**
  1. Escuchar canciones de Cloudflare 30-60 min con la pantalla apagada, mejor moviéndote entre Wi-Fi y datos.
  2. Forzado: canción larga, pantalla apagada, modo avión 1-2 min y quitarlo. Debe volver sola en ≤ 10 s, en la misma canción y segundo; la notificación en pausa mientras tanto.
  3. Si falla: USB y `adb logcat | findstr aske-stall`. Si sale `freeze-gap` o nada, Android congela la app y hace falta la vía nativa (latido o Media3), en otra fase.
- Andoni: probar el modo estudio y los grupos en dos móviles; Jam en dos móviles (pendiente de v0.8.3).
- Menor sin arreglar: si el usuario pausa mientras `reloadCurrent` resuelve la fuente, el `play()` posterior arranca la música (casi no pasa con Cloudflare; sí con Drive o archivos locales).
- Siguiente fase: por definir.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json` y 8 entradas del lock, con node, no sed).
- Vigilante web, sin aviso visible: no reanuda pausas del usuario ni de Android, la notificación pasa a pausa con la posición real mientras reintenta y al rendirse (8 intentos o 10 min) pausa en silencio — evita ruido y sorpresas.
- El gris pegado era `:hover` en táctil: ahora solo con puntero fino (`@media (hover: hover) and (pointer: fine)`).

## Problemas conocidos

- `smoke.mjs` da EPERM en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- `downloads.ts` (650 líneas) y `player.ts` (799, al límite de 800: sacar código antes de añadir más) sin refactorizar; `D1GroupRepo` sin tests.

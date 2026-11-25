# Estado del proyecto

Actualizado: 2026-11-25

## Hecho

- **F1-F7 (hasta v0.7.0) y v0.8.x:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams; estadísticas y Recap locales; Enviar al móvil; grupos de amigos.
- **v0.9.0:** F9 modo estudio solo en Android (pantalla fijada, campanilla nativa, ruidos y ambientes).
- **v0.9.1 (publicada: commit `6d7e865`, push, tag y web desplegada; el CI construye el APK):** vigilante contra cortes de música, notificación honesta, botones táctiles sin gris pegado, selector de tema con iconos, Seleccionar en cuadrícula, volumen del estudio solo arrastrando, Enviar junto a Recibir en Descargas y fila «Con amigos» (Compartir, Recibir, Jam, Grupos) en Playlists.
- **v0.9.2 (sin publicar):** Enviar desde el menú ⋮ y la selección (canciones y playlists), botón «Ordenar» compacto, interruptor Aleatorio junto al Play (Biblioteca, Playlist y reproductor), selección de playlists, opciones de privacidad de Grupos en Ajustes, arreglo del `play()` tras pausar durante una recarga, refactor de `player.ts` (444 líneas) y `downloads.ts` (449) y tests de `D1GroupRepo` (SQLite real, 229 líneas).

## En curso / siguiente

- **Andoni: comprobar en GitHub → Actions que el APK v0.9.1 se ha construido, e instalarlo.**
- **Prueba del corte de música con el APK v0.9.1:**
  1. Escuchar canciones de Cloudflare 30-60 min con la pantalla apagada, mejor moviéndote entre Wi-Fi y datos.
  2. Forzado: canción larga, pantalla apagada, modo avión 1-2 min y quitarlo. Debe volver sola en ≤ 10 s, en la misma canción y segundo; la notificación en pausa mientras tanto.
  3. Si falla: USB y `adb logcat | findstr aske-stall`. Si sale `freeze-gap` o nada, Android congela la app y hace falta la vía nativa (latido o Media3), en otra fase.
- Andoni: probar el modo estudio y los grupos en dos móviles; Jam en dos móviles (pendiente de v0.8.3).
- Siguiente fase: por definir.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json` y 8 entradas del lock, con node, no sed).
- Vigilante web, sin aviso visible: no reanuda pausas del usuario ni de Android, la notificación pasa a pausa con la posición real mientras reintenta y al rendirse (8 intentos o 10 min) pausa en silencio — evita ruido y sorpresas.
- El gris pegado era `:hover` en táctil: ahora solo con puntero fino (`@media (hover: hover) and (pointer: fine)`).
- Aleatorio es una preferencia global (`shuffle`, clave propia) separada del orden de la lista que suena (`contextShuffled`): podcasts y modo estudio no cambian el interruptor.
- Selección de playlists: estado propio en `ui.ts` (`playlistSelection`), separado de la de canciones; empezar una cierra la otra.
- Las opciones de Grupos viven en Ajustes (`GroupsSection`); la pantalla de Grupos queda limpia.

## Problemas conocidos

- `smoke.mjs` da EPERM en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.

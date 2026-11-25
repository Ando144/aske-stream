# Estado del proyecto

Actualizado: 2026-11-25

## Hecho

- **F1-F7 (hasta v0.7.0) y v0.8.x:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams; estadísticas y Recap locales; Enviar al móvil; grupos de amigos.
- **v0.9.0 (publicada):** F9 modo estudio solo en Android (pantalla fijada, campanilla nativa, ruidos y ambientes).
- **v0.9.1 (lista, sin publicar):** vigilante contra cortes de música, notificación honesta, botones táctiles, tema, Seleccionar, modo estudio, Enviar/Recibir y entrada a Grupos desde Playlists.
- Publicar v0.9.1: `git push`, tag `v0.9.1` (el CI construye el APK) y `npm run deploy`.

## En curso / siguiente

- **Prueba de Andoni con el APK v0.9.1 (corte de música):**
  1. Escuchar canciones de Cloudflare 30-60 min con la pantalla apagada, mejor moviéndote entre Wi-Fi y datos.
  2. Prueba forzada: canción larga de Cloudflare, pantalla apagada, modo avión 1-2 min hasta que se corte y quitarlo. Debe volver sola en ≤ 10 s, en el mismo segundo y en la misma canción. Mientras está parada, la notificación debe estar en pausa y no avanzar.
  3. Si aun así se corta: USB y `adb logcat | findstr aske-stall`. Si sale `freeze-gap` o no sale nada en el momento del corte, Android congela la app y hace falta la vía nativa.
- Andoni: probar el modo estudio y los grupos en dos móviles; Jam en dos móviles (pendiente de v0.8.3).

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json` y 8 entradas del lock, con node, no sed).
- Notificación: solo el servicio nativo escribe; el vigilante web le manda estado y posición reales.

## Problemas conocidos

- **Corte de música con la pantalla apagada:** un vigilante en la web (`player/stallWatchdog.ts`) detecta que el audio no avanza y recarga la canción en el mismo punto, sin avisos. La notificación avanzaba sola porque Android calcula la posición; ahora pasa a pausa mientras dura el atasco. Si sigue pasando, el siguiente paso es nativo (latido o Media3), en otra fase.
- `smoke.mjs` da EPERM en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- `downloads.ts` (650 líneas) y `player.ts` sin refactorizar, por decisión; `D1GroupRepo` sin tests.

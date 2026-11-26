# Estado del proyecto

Actualizado: 2026-11-26

## Hecho

- **F1-F7 (hasta v0.7.0) y v0.8.x:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams; estadísticas y Recap locales; Enviar al móvil; grupos de amigos.
- **v0.9.0:** F9 modo estudio solo en Android (pantalla fijada, campanilla nativa, ruidos y ambientes).
- **v0.9.1:** vigilante contra cortes de música, notificación honesta, botones táctiles sin gris pegado, selector de tema con iconos, Seleccionar en cuadrícula.
- **v0.9.2 (publicada: commit `d6d0e15`, push, tag y web desplegada; el CI construye el APK):** Enviar desde el menú ⋮ y la selección (canciones y playlists), «Compartir» en el ⋮ de la playlist, botón «Ordenar» compacto, interruptor Aleatorio junto al Play y en el reproductor, opciones de privacidad de Grupos en Ajustes, arreglo del `play()` tras pausar durante una recarga, refactor de `player.ts` (444 líneas) y `downloads.ts` (449), tests de `D1GroupRepo` (SQLite real). El hub no cambió: no se redesplegó.

- **v0.9.3 (publicada: commit `ff1905d`, push, tag, web desplegada y APK en la release):** descargas que se pueden cancelar al guardar y no bloquean la cola, audios de más de 95 MB con Cloudflare solo en el móvil, podcasts por serie, aleatorio de orden fijo con «Barajar de nuevo», deslizar el mini reproductor, Jam desde la biblioteca, portadas en menús sociales y «Enviar», QR y «Seleccionar» arreglados, ayuda y notas de versión. El hub no cambia.

## En curso / siguiente

- **Andoni: elegir boceto de Grupos** (A o B) en `docs/plan/bocetos/grupos.html`.
- **Probar en el APK (v0.9.3):** con Cloudflare, un podcast de más de 2 h se guarda en el móvil, suena sin conexión y las demás descargas siguen; instalar encima de la v0.9.2 con descargas atascadas (se resuelven solas o se quitan con la X); gestos del mini reproductor; Jam desde la biblioteca.
- **VERIFICAR:** que el WebView aguante leer y escribir en OPFS un audio de 120-200 MB, y que el Worker aguante subidas de 80-95 MB (si fallan dos veces, el audio acaba en el móvil).
- Andoni: comprobar en el móvil lo de la v0.9.2 si aún no se ha mirado (menú ⋮, Ordenar en pantalla estrecha, Grupos y Ajustes → Grupos).
- Después: v0.9.4 (Jam como mando a distancia y Grupos, bocetos primero) y v0.9.5 («Compartir → Aske Stream» y «Cargar más»).
- **Prueba del corte de música (v0.9.1 en adelante):**
  1. Escuchar canciones de Cloudflare 30-60 min con la pantalla apagada, mejor moviéndote entre Wi-Fi y datos.
  2. Forzado: canción larga, pantalla apagada, modo avión 1-2 min y quitarlo. Debe volver sola en ≤ 10 s, en la misma canción y segundo.
  3. Si falla: USB y `adb logcat | findstr aske-stall`. Si sale `freeze-gap` o nada, hace falta la vía nativa (latido o Media3), en otra fase.
- Andoni: probar el modo estudio y los grupos en dos móviles; Jam en dos móviles (pendiente de v0.8.3).

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Publicar: `hub:migrate:remote`, `deploy:hub` (solo si el hub cambió), `deploy`, push y tag (7 `package.json` y 8 entradas del lock, con node, no sed).
- Vigilante web, sin aviso visible: no reanuda pausas del usuario ni de Android; al rendirse (8 intentos o 10 min) pausa en silencio.
- El gris pegado era `:hover` en táctil: ahora solo con puntero fino (`@media (hover: hover) and (pointer: fine)`).
- Aleatorio es una preferencia global (`shuffle`, clave propia) separada del orden de la lista que suena (`contextShuffled`): podcasts y modo estudio no cambian el interruptor.
- Selección de playlists: estado propio en `ui.ts` (`playlistSelection`, `playlistVisibleIds`), separado de la de canciones; «Todas» actúa solo sobre las playlists visibles (pantalla o carpeta).
- Las opciones de Grupos viven en Ajustes (`GroupsSection`); la pantalla de Grupos queda limpia.
- Aleatorio de orden fijo: cada ronda guarda una semilla (`seed`) y el orden sale de un hash estable de `(seed, id)`, así añadir canciones no lo revuelve. Toda la biblioteca es la ronda `library`. El interruptor no baraja; para eso está «Barajar de nuevo».
- Serie de podcast = `album` (sin migración); las descargas nuevas guardan el canal si no hay álbum.
- Carriles de guardado: «nube» (hasta 2, como mucho 1 de más de 30 MB) y «móvil» (1, independiente). Tiempo límite de subida a 64 KB/s con tope de 30 min, y un vigilante para los guardados vencidos.
- Audios que no caben en Cloudflare: almacén IndexedDB `local-extras`, mezclado con la biblioteca del hogar; nunca se suben, ni entran en playlists de la nube, «Copiar» o la caché sin conexión.

## Problemas conocidos

- `smoke.mjs` da EPERM en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- Sin arreglar (MEDIO, v0.9.3): cancelar justo cuando Cloudflare ya ha recibido el audio puede dejar la canción en la nube (`downloads/save.ts`); `stores/library.ts` (557 líneas) conviene partirlo.
- Sin arreglar (MEDIO): «Seleccionar» no aparece si todas las playlists están en carpetas; textos eu mezclan «playlist» y «zerrenda» y conviene revisarlos; el menú de Ordenar no se maneja bien con teclado (flechas, Escape); al cambiar de pantalla con playlists seleccionadas la selección no se limpia.

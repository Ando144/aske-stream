# Estado del proyecto

Actualizado: 2026-11-26

## Hecho

- **Hasta v0.9.2:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub (playlists compartidas, Jams, grupos, Enviar); estadísticas y Recap; modo estudio; vigilante de cortes de música.
- **v0.9.3 (publicada: `ff1905d`, tag, web y APK):** descargas cancelables que no bloquean la cola, audios grandes solo en el móvil, podcasts por serie, aleatorio de orden fijo, gestos, Jam desde la biblioteca, portadas en menús sociales y «Enviar», arreglos de QR y «Seleccionar». El hub no cambió.
- **v0.9.4 (publicada: `7f879b5`, tag, hub con migración 0005, web; APK por CI):** Jam como mando a distancia (todos saltan, barra de la Jam), Grupos según el boceto A con «Nombre y foto» y vista previa, canciones huérfanas al cancelar, Ordenar con teclado, «Seleccionar» en carpetas, selección de playlists ligada a su pantalla, eu con «zerrenda», ayuda, privacidad y notas.

## En curso / siguiente

- **Comprobar que CI publica los APK de v0.9.4** en GitHub Releases.
- **Probar v0.9.4 en dos móviles:** salto remoto (también con el móvil anfitrión con la pantalla apagada), barra de la Jam, «Nombre y foto» desde un miembro que no creó el grupo, guardar en modo avión, vista previa al unirse; también modo estudio.
- **Andoni, probar el APK (instalar encima, sin desinstalar), pendiente desde v0.9.3:** descargas atascadas, podcast de más de 2 h en el móvil y sin conexión, gestos y Jam desde la biblioteca. VERIFICAR memoria con audios de 120-200 MB (WebView) y subidas de 80-95 MB (Worker).
- **v0.9.5** (borrador en `docs/plan/PLAN.md`): «Compartir → Aske Stream» y «Cargar más».
- **Prueba del corte de música:** 30-60 min con pantalla apagada y modo avión 1-2 min (debe volver en ≤ 10 s). Si falla, `adb logcat | findstr aske-stall`; con `freeze-gap` o nada, vía nativa.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Publicar: `hub:migrate:remote` y `deploy:hub` (solo si el hub cambió), `deploy`, push y tag; versión en 7 `package.json` y 8 entradas del lock, con node, no sed.
- Aleatorio: orden fijo por semilla (hash de `seed` e `id`), toda la biblioteca es la ronda `library`; el interruptor no baraja, solo «Barajar de nuevo» en Ajustes — así lo eligió Andoni.
- Serie de podcast = `album` — evita migrar el Worker de cada amigo, Drive y el dispositivo.
- Guardado: carril «nube» (2, máx. 1 de más de 30 MB) y «móvil» (1); 64 KB/s con tope de 30 min — que nada bloquee la cola.
- Más de 95 MB (o 30-95 MB tras 2 fallos del servidor) van a `local-extras`: nunca se suben ni entran en playlists de la nube, «Copiar» o la caché — Cloudflare no los admite.
- Jam: saltan todos, sin confirmación ni aviso, 1 cada 2 s; el salto lo ejecuta el móvil anfitrión — así lo eligió Andoni.
- Grupos: cualquier miembro cambia nombre y foto sin que se diga quién; fotos pequeñas en D1 (el hub no usa R2); las tarjetas solo cuentan a quien comparte y «No comparte» solo se ve para uno mismo (RGPD).

## Problemas conocidos

- Windows: `smoke.mjs` da EPERM y deja wrangler/workerd colgados; `gradle.mjs` falla (usar `.\gradlew.bat assembleRelease`).
- BAJO: si una subida cancelada tarda más de 60 s en completarse en la nube, la canción puede quedarse (se borra a mano).
- MEDIO: `stores/library.ts` (557 líneas) conviene partirlo.

# Estado del proyecto

Actualizado: 2026-11-27

## Hecho

- **Hasta v0.9.3:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub (playlists compartidas, Jams, grupos, Enviar); estadísticas y Recap; modo estudio; audios grandes solo en el móvil; podcasts por serie; aleatorio de orden fijo; gestos.
- **v0.9.4 (publicada: `7f879b5`, tag, hub con migración 0005, web y APK en Releases):** Jam como mando a distancia, Grupos según el boceto A con «Nombre y foto» y vista previa, y los fallos pendientes (canciones huérfanas al cancelar, Ordenar con teclado, «Seleccionar» en carpetas, selección de playlists, eu con «zerrenda»).

## En curso / siguiente

- **Andoni, probar v0.9.4 (APK encima, sin desinstalar) en dos móviles:** salto remoto (también con el anfitrión con la pantalla apagada), barra de la Jam, deslizar el mini reproductor, «Nombre y foto» desde un miembro que no creó el grupo, guardar en modo avión, vista previa al unirse, «Seleccionar» en carpetas, Ordenar con teclado y modo estudio.
- **Pendiente de la v0.9.3:** descargas atascadas y podcast de más de 2 h sin conexión; VERIFICAR memoria con audios de 120-200 MB (WebView) y subidas de 80-95 MB (Worker).
- **v0.9.5** (borrador en `docs/plan/PLAN.md`, estimada en 30-60 min): «Compartir → Aske Stream» y «Cargar más». Antes, preguntas a Andoni.
- **Prueba del corte de música:** 30-60 min con pantalla apagada y modo avión 1-2 min (debe volver en ≤ 10 s). Si falla, `adb logcat | findstr aske-stall`.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Aleatorio: orden fijo por semilla, la biblioteca es la ronda `library`; solo «Barajar de nuevo» cambia el orden — así lo eligió Andoni.
- Serie de podcast = `album` — evita migrar el Worker de cada amigo, Drive y el dispositivo.
- Más de 95 MB (o 30-95 MB tras 2 fallos) van a `local-extras`, sin subirse; carriles «nube» y «móvil» — Cloudflare no los admite y nada debe bloquear la cola.
- Jam: saltan todos, sin confirmación ni aviso, 1 cada 2 s; el salto lo ejecuta el anfitrión — así lo eligió Andoni.
- Grupos: cualquiera cambia nombre y foto; fotos en D1; las tarjetas solo cuentan a quien comparte y «No comparte» solo se ve para uno mismo (RGPD). La tarjeta dice «Este mes» (en euskera el mes habría que declinarlo).

## Problemas conocidos

- Windows: `smoke.mjs` da EPERM y deja wrangler/workerd colgados; `gradle.mjs` falla (usar `.\gradlew.bat assembleRelease`).
- MEDIO: al cancelar, una canción del mismo vídeo añadida desde otro aparato en ese minuto puede borrarse (y sale «Canción borrada»); si la subida tarda más de 60 s, queda en la nube.
- MEDIO: `hub/src/groups/lookRoutes.ts` lee entera una foto sin `Content-Length`; con hub viejo `photoCache.ts` pide fotos inexistentes.
- MEDIO: `stores/library.ts` (557 líneas) conviene partirlo; quitar el import circular de `downloads/cancel.ts` y testear su suscripción.

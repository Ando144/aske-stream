# Estado del proyecto

Actualizado: 2026-11-27

## Hecho

- **Hasta v0.9.4:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub (playlists compartidas, Jam como mando a distancia, grupos con nombre y foto, Enviar); estadísticas y Recap; modo estudio; podcasts; aleatorio fijo; gestos.
- **v0.9.5 (publicada: `73c6e1a` + docs, tag, hub sin migración, web y 2 APK en Releases):** portadas o dibujo ámbar en todas partes, carrusel en los reproductores y círculo en las listas, arranque solo con el logo, «Compartir → Aske Stream» y «Cargar más».

## En curso / siguiente

- **Andoni, probar v0.9.5 (APK encima):** Compartir desde YouTube y YouTube Music (app cerrada y abierta), «Cargar más», deslizar reproductores y filas, y el paso del arranque de Android al de la web.
- **Andoni, probar v0.9.4 en dos móviles:** salto remoto (también con el anfitrión con la pantalla apagada), barra de la Jam, «Nombre y foto» desde quien no creó el grupo, guardar en modo avión, vista previa al unirse, «Seleccionar» en carpetas, Ordenar con teclado y modo estudio.
- **Pendiente de la v0.9.3:** descargas atascadas y podcast de más de 2 h sin conexión; VERIFICAR memoria con audios de 120-200 MB y subidas de 80-95 MB. Prueba del corte de música: 30-60 min con pantalla apagada y modo avión 1-2 min (debe volver en ≤ 10 s). Si falla, `adb logcat | findstr aske-stall`.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Aleatorio: orden fijo por semilla; solo «Barajar de nuevo» lo cambia. Serie de podcast = `album` (evita migraciones). Más de 95 MB (o 30-95 MB tras 2 fallos) van a `local-extras`; nada debe bloquear la cola.
- Jam: saltan todos, sin confirmación, 1 cada 2 s; ejecuta el anfitrión — así lo eligió Andoni. Grupos: cualquiera cambia nombre y foto; las tarjetas solo cuentan a quien comparte (RGPD).
- Portadas que faltan: miniatura de YouTube si hay id; en estadísticas de grupos, la de tu biblioteca o dibujo ámbar (sin compartir más datos).

## Problemas conocidos

- Windows: `smoke.mjs` da EPERM y deja wrangler/workerd colgados; `gradle.mjs` falla (usar `.\gradlew.bat assembleRelease`).
- MEDIO (v0.9.5): al compartir salen dos avisos (`ShareInSheet.tsx` y la cola); `SourcePicker.tsx` no se mueve con flechas; título de Biblioteca cortado a 390 px (ya pasaba); hay `.pyc` subidos en `test/browser/__pycache__`.
- MEDIO: al cancelar, una canción del mismo vídeo añadida desde otro aparato puede borrarse; si la subida tarda más de 60 s, queda en la nube.
- MEDIO: `hub/src/groups/lookRoutes.ts` lee entera una foto sin `Content-Length`; con hub viejo `photoCache.ts` pide fotos inexistentes.
- MEDIO: partir `stores/library.ts` (557 líneas) y quitar el import circular de `downloads/cancel.ts`.

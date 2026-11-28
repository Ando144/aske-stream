# Estado del proyecto

Actualizado: 2026-11-28

## Hecho

- **Hasta v0.9.4:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub (playlists compartidas, Jam como mando a distancia, grupos con nombre y foto, Enviar); estadísticas y Recap; modo estudio; podcasts; aleatorio fijo; gestos.
- **v0.9.5 (publicada: `73c6e1a` + docs, tag, hub sin migración, web y 2 APK en Releases):** portadas o dibujo ámbar en todas partes, carrusel en los reproductores y círculo en las listas, arranque solo con el logo, «Compartir → Aske Stream» y «Cargar más».
- **v0.9.6 (preparada en local, sin publicar):** cancelar borra solo lo propio (Cloudflare y Drive, también si la subida acaba tarde), un solo aviso al compartir, flechas en el modo estudio, título de Biblioteca entero a 390 px, límite de foto en el Hub, `stores/library.ts` partido, `smoke.mjs` y `gradle.mjs` arreglados en Windows.

## En curso / siguiente

- **Publicar v0.9.6:** `db:migrate:remote` (migración 0008), `deploy:hub` (sin migración), `deploy`, `git push` y tag `v0.9.6`. Quien use Cloudflare debe actualizar su servidor desde la app.
- **Andoni, probar v0.9.6:** cancelar descargas mientras se guardan (Cloudflare y Drive) y compartir desde YouTube.
- **Andoni, probar v0.9.5 (APK encima):** Compartir desde YouTube y YouTube Music (app cerrada y abierta), «Cargar más», deslizar reproductores y filas, y el paso del arranque de Android al de la web.
- **Andoni, probar v0.9.4 en dos móviles:** salto remoto (también con el anfitrión con la pantalla apagada), barra de la Jam, «Nombre y foto» desde quien no creó el grupo, guardar en modo avión, vista previa al unirse, «Seleccionar» en carpetas, Ordenar con teclado y modo estudio.
- **Pendiente de la v0.9.3:** descargas atascadas y podcast de más de 2 h sin conexión; VERIFICAR memoria con audios de 120-200 MB y subidas de 80-95 MB. Prueba del corte de música: 30-60 min con pantalla apagada y modo avión 1-2 min (debe volver en ≤ 10 s). Si falla, `adb logcat | findstr aske-stall`.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Aleatorio: orden fijo por semilla; solo «Barajar de nuevo» lo cambia. Serie de podcast = `album` (evita migraciones). Más de 95 MB (o 30-95 MB tras 2 fallos) van a `local-extras`; nada debe bloquear la cola.
- Jam: saltan todos, sin confirmación, 1 cada 2 s; ejecuta el anfitrión — así lo eligió Andoni. Grupos: cualquiera cambia nombre y foto; las tarjetas solo cuentan a quien comparte (RGPD).
- Portadas que faltan: miniatura de YouTube si hay id; en estadísticas de grupos, la de tu biblioteca o dibujo ámbar (sin compartir más datos).

## Problemas conocidos

- Con un Worker sin actualizar, una canción cancelada mientras se guardaba puede quedarse en la biblioteca (la app pide actualizar el servidor).
- Drive: si Google termina la subida justo cuando el móvil se queda sin red, el archivo cancelado puede quedar en la carpeta (no sale en la biblioteca, pero ocupa espacio).
- MEDIO: cancelar justo al acabar de subir (Cloudflare) puede mostrar un aviso de error falso (`discardSaved` + `cancelCloudUpload`); no se pierde nada.
- MEDIO: si la migración 0008 fallara a medias, la actualización desde la app se quedaría bloqueada; vigilar la primera real. v5 de navegador imprime la comprobación de reanudar sin verificarla.

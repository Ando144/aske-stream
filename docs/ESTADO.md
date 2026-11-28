# Estado del proyecto

Actualizado: 2026-11-28

## Hecho

- **Hasta v0.9.5:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube y «Compartir → Aske Stream»; ayuda eu/es/en; copia; QR; Hub (playlists compartidas, Jam, grupos, Enviar); estadísticas y Recap; modo estudio; podcasts; aleatorio fijo; gestos; portadas en todas partes.
- **v0.9.6 (publicada: migración 0008, hub, web, tag, CI en verde y 2 APK en Releases):** cancelar borra solo lo propio, un solo aviso al compartir, flechas en el modo estudio, título de Biblioteca entero a 390 px, límite de foto en el Hub, `stores/library.ts` partido, `smoke.mjs` y `gradle.mjs` arreglados en Windows. Pasaron check, e2e, navegador, APK y revisión.

## En curso / siguiente

- **Amigos con Cloudflare:** deben actualizar su servidor desde la app.
- **Andoni, probar v0.9.6 (APK encima):** cancelar descargas mientras se guardan (Cloudflare y Drive), «Reintentar» después y compartir desde YouTube.
- **Andoni, probar v0.9.5:** Compartir desde YouTube y YouTube Music (app cerrada y abierta), «Cargar más», deslizar reproductores y filas, y el arranque.
- **Andoni, probar v0.9.4 en dos móviles:** salto remoto (también con la pantalla del anfitrión apagada), barra de la Jam, «Nombre y foto» desde quien no creó el grupo, guardar en modo avión, vista previa al unirse, «Seleccionar» en carpetas, Ordenar con teclado y modo estudio.
- **Pendiente de la v0.9.3:** descargas atascadas y podcast de más de 2 h sin conexión; VERIFICAR memoria con audios de 120-200 MB y subidas de 80-95 MB. Corte de música: 30-60 min con pantalla apagada y modo avión 1-2 min (debe volver en ≤ 10 s); si falla, `adb logcat | findstr aske-stall`.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Aleatorio: orden fijo por semilla; solo «Barajar de nuevo» lo cambia. Serie de podcast = `album` (evita migraciones). Más de 95 MB (o 30-95 MB tras 2 fallos) van a `local-extras`; nada debe bloquear la cola.
- Jam: saltan todos, sin confirmación, 1 cada 2 s; ejecuta el anfitrión — así lo eligió Andoni. Grupos: cualquiera cambia nombre y foto; las tarjetas solo cuentan a quien comparte (RGPD).
- Cada subida a Cloudflare lleva un `uploadId` (se renueva al reintentar) y cancelar borra solo ese — nunca tocar música ajena. Con un Worker antiguo no se borra nada y se pide actualizarlo — elegido por Andoni.

## Problemas conocidos

- Puede quedar un archivo cancelado con un Worker sin actualizar, o en Drive si termina de subir justo al perder la red.
- MEDIO: cancelar justo al acabar de subir (Cloudflare) puede mostrar un error falso (`discardSaved` + `cancelCloudUpload`); no se pierde nada.
- MEDIO: si la migración 0008 fallara a medias, la actualización desde la app se bloquearía; vigilar la primera real.
- La prueba de navegador v5 imprime la comprobación de reanudar sin verificarla.

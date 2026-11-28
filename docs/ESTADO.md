# Estado del proyecto
Actualizado: 2026-11-28

## Hecho

- **Hasta v0.9.5:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube y «Compartir → Aske Stream»; ayuda eu/es/en; copia; QR; Hub (playlists compartidas, Jam, grupos, Enviar); estadísticas y Recap; modo estudio; podcasts; aleatorio fijo; gestos; portadas en todas partes.
- **v0.9.6 (publicada):** cancelar borra solo lo propio, un solo aviso al compartir, flechas en el modo estudio, título de Biblioteca entero a 390 px, límite de foto en el Hub.
- **v0.9.7 (publicada):** animación del logo al arrancar (web y Android), aprobada por Andoni, y arreglados los cuatro fallos de la v0.9.6. Notas en `docs/releases/v0.9.7.md`.

## En curso / siguiente

- **Andoni, probar v0.9.7** (los amigos con Cloudflare deben actualizar su servidor desde la app): la animación en un móvil real (arranque normal y lento, sin icono nativo antes en el APK, sin tirones); cancelar mientras se guarda en Drive sin internet y volver a conectar; cancelar con un servidor de Cloudflare antiguo y actualizarlo después.
- **Andoni, probar v0.9.6:** cancelar descargas mientras se guardan (Cloudflare y Drive), «Reintentar» después y compartir desde YouTube.
- **Andoni, probar v0.9.5:** Compartir desde YouTube y YouTube Music (app cerrada y abierta), «Cargar más», deslizar reproductores y filas.
- **Andoni, probar v0.9.4 en dos móviles:** salto remoto (también con la pantalla del anfitrión apagada), barra de la Jam, «Nombre y foto» desde quien no creó el grupo, guardar en modo avión, vista previa al unirse, «Seleccionar» en carpetas, Ordenar con teclado y modo estudio.
- **De la v0.9.3:** descargas atascadas y podcast de más de 2 h sin conexión; VERIFICAR memoria con audios de 120-200 MB y subidas de 80-95 MB. Corte de música: 30-60 min con pantalla apagada y modo avión 1-2 min (debe volver en ≤ 10 s); si falla, `adb logcat | findstr aske-stall`.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD). Aleatorio: orden fijo por semilla; solo «Barajar de nuevo» lo cambia. Serie de podcast = `album` (evita migraciones). Más de 95 MB (o 30-95 MB tras 2 fallos) van a `local-extras`; nada debe bloquear la cola.
- Jam: saltan todos, sin confirmación, 1 cada 2 s; ejecuta el anfitrión — así lo eligió Andoni. Grupos: cualquiera cambia nombre y foto; las tarjetas solo cuentan a quien comparte (RGPD).
- Cada subida a Cloudflare lleva un `uploadId` (se renueva al reintentar) y cancelar borra solo ese — nunca tocar música ajena. Con un Worker antiguo la cancelación queda pendiente y, al actualizarlo, lleva la pista `ref`/`since` (mismo vídeo de YouTube, sin `uploadId`, creado desde 10 min antes de empezar a guardar); se descarta si esa canción se vuelve a guardar o sale repetida — aprobado por Andoni.
- La animación de arranque es igual aunque el móvil tenga «Reducir movimiento» — elegido por Andoni.

## Problemas conocidos

- Riesgo asumido de la pista `ref`/`since`: con el margen de 10 min puede borrar una canción sin `upload_id` del mismo vídeo creada por otra vía (copia a Cloudflare, `tools/ingest` o una app antigua).
- En Safari anterior a 16.4 la animación no tiene ecualizador (el logo se queda quieto mientras carga).
- La PWA instalada en Android muestra antes su propio icono; no se puede quitar desde la web.
- MEDIO (revisión v0.9.7): sin test de la suscripción a `useServerUpdate` ni de `forgetCancelsFor` en `completeSave`; `dropFromLibrary` (`downloads/cancel.ts`) repite `deleteTrack` (mejor una opción `silent`); `downloadCancel.test.ts` no deshace su `stubGlobal`.

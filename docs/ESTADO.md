# Estado del proyecto

Actualizado: 2026-11-25

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0-v0.8.7:** estadísticas y Recap locales, Jam fiable, batería, cola de descargas nativa, Enviar al móvil, grupos de amigos (20 personas, ranking mensual, playlists y Jams compartidas), animación de arranque.
- **Arreglos tras v0.8.7:** `setSharing(false)` espera a la subida en curso antes de borrar; el Hub descarta en silencio los meses de más de 12 (ya no da 400 en UTC−x).
- **v0.9.0 (push y tag hechos; el APK lo construye el CI; web sin desplegar):** F9 modo estudio solo en Android: pantalla fijada, sesión de X minutos, salir con 30 s pulsado, campanilla nativa, mezcla tranquila, ruidos blanco/gris/marrón + lluvia y olas (CC0, créditos en `apps/web/src/study/sounds/README.md`), historial solo con el Recap activado.

- **Arreglos tras v0.9.0 (sin publicar):** botones táctiles sin gris pegado (`:hover` solo con ratón); selector de tema con iconos y texto; Seleccionar en cuadrícula con texto; modo estudio (control deslizante propio y arreglos menores de `study.ts`); Enviar/Recibir con hoja explicativa; entrada a Grupos desde Playlists («Con amigos»).

## En curso / siguiente

- Andoni: mirar en GitHub → Actions los APK v0.8.x y v0.9.0 y probar el modo estudio: confirmación de fijar pantalla, llamada con la app fijada, campanilla con pantalla apagada, reinicio a mitad de sesión, Android 7-8 sin «Fijar aplicaciones».
- Andoni: probar grupos en dos móviles y la animación de arranque.
- Pendiente de v0.8.3: Jam en dos móviles y `onTimeout` con `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000` (restaurar con `delete`).
- Decidir si desplegar la web (`npm run deploy`). Siguiente fase: por definir.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json` y 8 entradas del lock, con node, no sed).
- Notificación: solo el servicio nativo escribe; progreso con suelo que nunca baja — Android descarta ráfagas.
- Grupos: el interruptor solo controla las escuchas; apagarlo las borra del Hub pero no te saca de los grupos; expulsar = veto.
- Estudio: plugin nativo aparte `StudyLock`; la campanilla la da Android (alarma exacta) y no suena dos veces; sin sesiones en web; la música se pausa al acabar — simple y sin sorpresas.
- Los `.ogg` están ignorados en git salvo `apps/web/src/study/sounds/` — son parte de la app, no música de usuario.
- Estadísticas solo con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- **Corte de música con la pantalla apagada (solo investigado, sin cambios de código; PENDIENTE DE DECISIÓN DE ANDONI).**
  Causa probable: Android congela o frena el JS del WebView en segundo plano (12-14, o Samsung/Xiaomi). El audio sigue, pero al acabar la canción nadie procesa `ended` y no empieza la siguiente; al abrir la app se descongela y suena. Menos probables: Doze sin servicio en primer plano, WakeLock caducado, foco de audio.
  Opciones: **A (Recomendada)** pedir exención de batería también para reproducir y precargar la siguiente canción en un segundo `<audio>` (barato, no resuelve del todo un JS congelado); **B** latido JS→`AskeNative` que pone la notificación en «En pausa» si JS no responde (trabajo medio, no evita el corte); **C** reproductor nativo Media3/ExoPlayer (lo más fiable, fase propia, hay que duplicar la lógica de fuentes).
  Para decidir, Andoni debe decir: ¿pasa al cambiar de canción o a mitad?, ¿canciones del móvil o de la nube?, ¿marca y Android?, ¿batería «sin restricciones»? Confirmar con `adb shell dumpsys activity services io.github.ando144.askestream` (`isForeground`) y `adb logcat`.

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- `downloads.ts` (650 líneas) y `player.ts` (745) sin refactorizar, por decisión.
- `D1GroupRepo` sin tests (no hay D1 en Vitest); `stores/groups.ts` y `groups/sync.ts` se importan en ciclo (funciona).
- La lluvia dura 24 s y las olas 55 s (con algún canto de charrán); se repiten en bucle.
- La copia no copia orden ni fijado (por decisión); tests de navegador sin ejecutar.

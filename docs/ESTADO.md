# Estado del proyecto

Actualizado: 2026-11-26

## Hecho

- **Hasta v0.9.2:** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub (playlists compartidas, Jams, grupos, Enviar); estadísticas y Recap; modo estudio; vigilante de cortes de música.
- **v0.9.3 (publicada: `ff1905d`, tag, web y APK):** descargas cancelables que no bloquean la cola, audios grandes solo en el móvil, podcasts por serie, aleatorio de orden fijo, gestos, Jam desde la biblioteca, portadas en menús sociales y «Enviar», arreglos de QR y «Seleccionar». El hub no cambió.

## En curso / siguiente

- **Andoni, probar el APK v0.9.3 (instalar encima, sin desinstalar):** descargas atascadas (se resuelven o se quitan con la X), podcast de más de 2 h en el móvil y sin conexión, gestos y Jam desde la biblioteca. VERIFICAR memoria con audios de 120-200 MB (WebView) y subidas de 80-95 MB (Worker).
- **Andoni, elegir boceto de Grupos** (A recomendada, o B) en `docs/plan/bocetos/grupos.html`.
- **v0.9.4** (borrador en `docs/plan/PLAN.md`): Jam como mando a distancia (invitados saltan, sin aviso) y Grupos (rediseño, foto y nombre por cualquier miembro, sin decir quién). Toca el hub y su API. **v0.9.5:** «Compartir → Aske Stream» y «Cargar más».
- **Prueba del corte de música:** 30-60 min con pantalla apagada y modo avión 1-2 min (debe volver en ≤ 10 s). Si falla, `adb logcat | findstr aske-stall`; con `freeze-gap` o nada, vía nativa.
- Pendiente de probar en dos móviles: modo estudio, grupos y Jam.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar; Cloudflare tope 10 GB, playlists de 1000; estadísticas solo con permiso (RGPD).
- Publicar: `hub:migrate:remote` y `deploy:hub` (solo si el hub cambió), `deploy`, push y tag; versión en 7 `package.json` y 8 entradas del lock, con node, no sed.
- Aleatorio: orden fijo por semilla (hash de `seed` e `id`), toda la biblioteca es la ronda `library`; el interruptor no baraja, solo «Barajar de nuevo» en Ajustes — así lo eligió Andoni.
- Serie de podcast = `album` — evita migrar el Worker de cada amigo, Drive y el dispositivo.
- Guardado: carril «nube» (2, máx. 1 de más de 30 MB) y «móvil» (1); 64 KB/s con tope de 30 min — que nada bloquee la cola.
- Más de 95 MB (o 30-95 MB tras 2 fallos del servidor) van a `local-extras`: nunca se suben ni entran en playlists de la nube, «Copiar» o la caché — Cloudflare no los admite.
- Vigilante de cortes sin aviso y sin reanudar pausas; Aleatorio global (`shuffle`) separado de `contextShuffled`; opciones de Grupos en Ajustes.

## Problemas conocidos

- Windows: `smoke.mjs` da EPERM y deja wrangler/workerd colgados; `gradle.mjs` falla (usar `.\gradlew.bat assembleRelease`).
- MEDIO: cancelar justo cuando Cloudflare ya recibió el audio puede dejarlo en la nube (`downloads/save.ts`); `stores/library.ts` (557 líneas) conviene partirlo.
- MEDIO: «Seleccionar» no aparece con todas las playlists en carpetas; eu mezcla «playlist» y «zerrenda»; menú Ordenar sin teclado; la selección de playlists no se limpia al cambiar de pantalla.

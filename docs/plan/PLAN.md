# PLAN: Arreglos de uso tras v0.9.0 (botones, Seleccionar, estudio, enviar y grupos)

Fecha: 2026-11-25 · Estado: EN CURSO

## Objetivo

Arreglar lo que Andoni ha visto usando la app: botones que se quedan grises al tocarlos, selector
de tema poco claro, barra de Seleccionar descuadrada, deslizadores del modo estudio que saltan con
un toque, título del modo estudio cortado, «enviar» y «grupos» escondidos, y tres flecos de
`stores/study.ts`. Además, responder dudas (aleatorio, enviar, grupos) e investigar sin tocar
código por qué se para la música con la pantalla apagada.

## Respuestas a las dudas de Andoni

### (4) ¿El aleatorio hace un orden nuevo cada vez?

Sí, los dos, y son coherentes entre sí (no hace falta tarea):

- **Aleatorio grande** (Biblioteca y playlist): `playTracks(ids, null, { shuffle: true, context })`
  en `stores/player.ts`. Cada pulsación crea un orden **nuevo** con `shuffledCycleOrder`
  (`player/shuffleCycle.ts`): primero, mezcladas, las canciones de esa lista que aún no han sonado
  en la «ronda» actual y después, también mezcladas, las ya oídas. Empieza por la primera del orden
  nuevo, así que corta la canción que sonaba. Con «Ahorro de datos» y conexión, usa
  `orderForDataSaver`: primero las que hay sin conexión y luego el resto, las dos partes mezcladas.
- **Aleatorio pequeño** del reproductor: `toggleShuffle()`. Al encenderlo, mezcla de nuevo la
  lista con la misma memoria de ronda, pero **la canción actual sigue sonando** y el resto se
  reordena. Al apagarlo vuelve al orden original. Apagar y encender otra vez = otro orden nuevo.
- La memoria de ronda es por lista (`cycleKey`, la Biblioteca incluye filtro y búsqueda) y se
  guarda para las últimas 20 listas. No se repite ninguna canción hasta que suenan todas.

Única diferencia, que es a propósito: el grande empieza de cero y el pequeño no corta la canción.

### (8) ¿Dónde se envía hoy?

- **Playlists:** «Recibir» es el botón del icono de enlace (sin texto) junto a «Jam»: abre
  «Abrir enlace compartido» (pegar enlace o escanear QR). Para **enviar** hay que entrar en una
  playlist y pulsar el icono «Compartir» (`Share2`, sin texto), que abre `SharePlaylistSheet`
  (enlace + QR por el Hub). No hay nada en la pantalla de Playlists que lo diga.
- **Descargas (móvil):** «Recibir» abre `ReceiveSheet` (código/QR de «Enviar al móvil»). Para
  **enviar** desde el móvil ya existe, pero escondido: Seleccionar canciones → «Enviar a otro
  móvil» (`SelectionBar`) o en la cola → «Enviar la cola a otro móvil» (`QueuePanel`). Desde el
  ordenador, la pantalla «Enviar» tiene `ParcelPanel`. Solo valen canciones que vienen de YouTube.
- Arreglo: T3 (Playlists) y T4 (Descargas) ponen un botón con texto junto a «Recibir», consejo de
  pantalla y ayuda.

### (9) ¿Dónde se crean los grupos de amigos?

En la pantalla `/groups` (`views/GroupsView.tsx`): botones «Crear un grupo» y «Unirme». Pero en el
**móvil no hay ningún enlace**: solo sale en la barra lateral (pantallas de 900 px o más) y al
abrir un enlace de invitación (`#group=`). Arreglo: T3 añade la entrada «Grupos» en Playlists
(fila «Con amigos») y un consejo de pantalla en Grupos.

### (10) La música se para con la pantalla apagada (solo análisis, sin cambiar código)

Lo que hay hoy:

- El audio es un `<audio>` del WebView (`stores/player.ts`). El cambio a la siguiente canción lo
  hace JavaScript en el evento `ended` → `advance()` → `loadCurrent()` (async: IndexedDB, Drive o
  Cloudflare) → `audio.src = …` → `play()`.
- El servicio en primer plano lo pone el plugin `@capgo/capacitor-media-session`
  (`MediaSessionService`, tipo `mediaPlayback`, `startForeground` en `onCreate`). `AskeNative`
  añade `WakeLock` parcial (caduca a los 30 min; JS lo renueva cada 10 min desde `timeupdate`) y
  `WifiLock` solo si es streaming. La exención de batería solo se pide para descargas.
- No hay gestión propia del foco de audio ni vigilancia de que JS siga vivo.

Causa probable (de más a menos):

1. **JS congelado o muy frenado en segundo plano** (Android 12-14 congela procesos «en caché» y
   algunos fabricantes, como Samsung o Xiaomi, duermen apps aunque tengan notificación). El audio
   en curso puede seguir, pero **al acabar la canción** nadie procesa `ended`, así que no empieza la
   siguiente. La interfaz no se actualiza (por eso «sigue reproduciendo») y, al abrir la app, JS se
   descongela, procesa los eventos pendientes y suena la siguiente. Encaja con todos los síntomas.
2. **Reposo profundo (Doze) con el móvil quieto**: si en ese momento el proceso no cuenta como
   servicio en primer plano (servicio desligado o degradado por el fabricante), se ignoran los wake
   locks y se corta la red. Si la canción venía de Drive o Cloudflare, el búfer se vacía y para.
   Con canciones del propio móvil afecta menos.
3. **WakeLock caducado**: si JS no renovó a tiempo, a los 30 min la CPU puede dormir. Es menos
   probable porque el servicio en primer plano debería bastar.
4. **Foco de audio**: el WebView no gestiona el foco como una app nativa. Una notificación o un
   asistente puede silenciarlo sin lanzar `pause`. Es poco probable si no hubo ningún aviso.

Cómo confirmarlo (cuando pase, con USB y `adb`):

- `adb shell dumpsys activity services io.github.ando144.askestream` → ¿`isForeground=true`?
- `adb logcat | findstr /i "freez ForegroundService askestream chromium"` en el momento del corte.
- Preguntar a Andoni: ¿se para **al cambiar de canción** o a mitad? ¿Canción del móvil o de la
  nube? ¿Marca del móvil y versión de Android? ¿La app tiene «Batería sin restricciones»?

Opciones de arreglo (para decidir después):

- **A (Recomendada como primer paso):** pedir también la exención de batería para reproducir (con
  el mismo aviso de `BatteryHint`) y **precargar la siguiente canción** en un segundo `<audio>`, de
  forma que el cambio no dependa de red ni de async. Es barato, pero no resuelve del todo un JS
  congelado.
- **B:** vigilancia nativa: `AskeNative` recibe un «latido» de JS. Si deja de llegar mientras dice
  «reproduciendo», actualiza la notificación a «En pausa» para que la interfaz no mienta y se pueda
  reanudar desde la pantalla de bloqueo. Es un trabajo medio y no evita el corte.
- **C:** pasar la reproducción a un reproductor nativo (Media3/ExoPlayer en un servicio) con la
  cola en Java. Es lo que hace Spotify y lo más fiable, pero es un cambio grande (fase propia) y
  hay que duplicar la lógica de fuentes (Drive, Cloudflare, caché).

## Decisiones de arquitectura

- El gris pegado es `:hover` en táctil: `.icon-btn:hover:not(:disabled)` (especificidad 0,3,0)
  gana a `.icon-btn.on` (0,2,0) y pinta gris encima del ámbar, así que parece que no se activó y
  se pulsa otra vez. Arreglo: hover solo con `@media (hover: hover) and (pointer: fine)` y `.on`
  siempre gana. Así se corrige en toda la app.
- El botón de la derecha del todo, junto al aleatorio, se interpreta como **Repetir** del
  reproductor (está en la misma fila y tiene el mismo fallo). Se explica con un aviso al pulsar y
  en la ayuda. El botón ✓ de la Biblioteca (Seleccionar) también pasa a tener texto, por si se
  refería a ese.
- Los aleatorios grandes se ponen en ámbar mientras esa lista suena en aleatorio, para que se vea
  que está activo.
- Cuadrícula de Seleccionar: 3 columnas (2 si mide menos de 340 px). Si un botón se queda solo en
  la última fila, ocupa todo el ancho.
- Deslizador del estudio propio (`KnobSlider`, `role="slider"`): solo se mueve arrastrando el pomo
  o con el teclado. El `<input type=range>` nativo salta al tocar la barra y no se puede impedir de
  forma fiable.
- La entrada a Grupos va en Playlists, en una fila «Con amigos» (Compartir, Recibir, Jam, Grupos),
  sin añadir una sexta pestaña.
- Sin CSS nuevo en T3 y T4 (usan clases existentes) para no chocar con T1 en `styles.css`.

## Contratos (interfaces compartidas)

### CSS (lo crea T1 en `apps/web/src/styles.css`)

- `.btn.on`: estado activo ámbar → `background: var(--accent-soft); color: var(--accent);`.
- `.icon-btn.on` se queda en `color: var(--accent)` también con hover, focus o active.
- Los `:hover` solo dentro de `@media (hover: hover) and (pointer: fine)`. Respuesta al toque con
  `:active` (fondo `var(--bg-hover)` mientras se pulsa).

### Claves i18n nuevas en `en.ts`, `es.ts` y `eu.ts` (las añade T2; T6 las usa)

| Clave                  | es                                                     | en                                                      | eu                                                                          |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `player.shuffleOn`     | Aleatorio activado: las canciones suenan mezcladas     | Shuffle on: songs play in a mixed order                 | Ausazkoa aktibatuta: abestiak nahastuta entzungo dira                       |
| `player.shuffleOff`    | Aleatorio desactivado: suenan en el orden de la lista  | Shuffle off: songs play in list order                   | Ausazkoa desaktibatuta: zerrendaren ordenan entzungo dira                   |
| `player.repeatOffHint` | Sin repetir: al acabar la lista, la música para        | No repeat: music stops at the end of the list           | Errepikatu gabe: zerrenda bukatzean, musika gelditu egingo da               |
| `player.repeatAllHint` | Repetir lista: al acabar, vuelve a empezar             | Repeat list: starts again when it ends                  | Errepikatu zerrenda: bukatzean, berriro hasiko da                           |
| `player.repeatOneHint` | Repetir canción: suena esta una y otra vez             | Repeat song: this one plays again and again             | Errepikatu abestia: hau behin eta berriz entzungo da                        |
| `settings.themeAuto`   | Automático                                             | Automatic                                               | Automatikoa                                                                 |
| `settings.themeHint`   | Automático usa el mismo modo que tu móvil u ordenador. | Automatic uses the same mode as your phone or computer. | Automatikoak zure mugikorraren edo ordenagailuaren modu bera erabiltzen du. |

### Claves nuevas en archivos de función (cada tarea, las suyas)

- T3 en `i18n/share.ts` (es/en/eu): `share.friendsTitle` («Con amigos»), `share.receive`
  («Recibir»), `share.pickTitle` («¿Qué playlist quieres compartir?»), `share.pickEmpty` («Aún no
  tienes playlists. Crea una con el botón +.»), `share.tipFriends` («Aquí compartes tus playlists
  con un enlace o QR, recibes las de tus amigos, haces una Jam o entras en tus grupos.»).
- T3 en `i18n/groups.ts`: `groups.tip` («Crea un grupo y comparte el enlace con tus amigos. Veréis
  quién escucha más cada mes y podréis compartir playlists y Jams.»).
- T4 en `i18n/parcel.ts`: `parcel.send` («Enviar»), `parcel.sendHowTitle` («Enviar canciones a otro
  móvil»), `parcel.sendHowSelect` («Elige canciones de tu biblioteca y pulsa «Enviar a otro
  móvil». Saldrá un QR para que el otro móvil lo escanee.»), `parcel.sendPick` («Elegir
  canciones»), `parcel.sendHowQueue` («También puedes enviar la cola: abre el reproductor → Cola →
  «Enviar la cola a otro móvil».»), `parcel.sendHowPlaylist` («Para compartir una playlist
  entera, ve a Playlists → Compartir.»), `parcel.sendGoPlaylists` («Ir a Playlists»),
  `parcel.sendHowNote` («Solo se pueden enviar canciones que vienen de YouTube.»),
  `parcel.tipSend` («Con «Recibir» coges canciones que te envía otro móvil; con «Enviar» se las
  mandas tú.»).
- Traducciones en/eu: las hace cada programador, con frases cortas y sin jerga.

### Lógica del deslizador (T5, `apps/web/src/study/slider.ts`)

```ts
export function valueFromX(
  x: number,
  left: number,
  width: number,
  min: number,
  max: number,
  step?: number,
): number; // clamp + redondeo a step (por defecto 1)
export function valueForKey(
  key: string,
  value: number,
  min: number,
  max: number,
  step?: number,
): number | null; // ArrowLeft/Down −step, ArrowRight/Up +step, PageDown/PageUp ±10*step, Home=min, End=max; otra tecla → null
```

`KnobSlider` (`components/study/KnobSlider.tsx`):
`{ value: number; min: number; max: number; label: string; valueText: string; onChange: (v: number) => void }`.

## Tareas

### T1 · Botones sin gris pegado y cuadrícula de Seleccionar · Grupo A · Estado: PENDIENTE

- Archivos (exclusivos): `apps/web/src/styles.css`
- Leer como contexto: `apps/web/src/components/SelectionBar.tsx`,
  `apps/web/src/components/player/Controls.tsx`
- Qué hacer:
  - Mete en `@media (hover: hover) and (pointer: fine) { … }` todas las reglas `:hover` de
    `styles.css` que cambian fondo o color de botones, chips, pestañas o filas (como mínimo
    `.btn:hover`, `.btn.primary:hover`, `.icon-btn:hover`, `.selection-actions button…:hover`).
  - Añade `.icon-btn.on, .icon-btn.on:hover, .icon-btn.on:active { color: var(--accent); }` para
    que el ámbar gane siempre. Añade `.btn.on` según el contrato.
  - Respuesta al toque: `.icon-btn:active:not(:disabled)` y `.btn:active:not(:disabled)` con fondo
    `var(--bg-hover)` (fuera del media query).
  - `.selection-actions`: `grid-template-columns: repeat(3, 1fr)` y, con
    `@media (max-width: 339px)`, `repeat(2, 1fr)`. Botones con `min-height: 56px`, texto que puede
    ir en 2 líneas (`white-space: normal; line-height: 1.2; text-align: center`). El último botón
    que queda solo en su fila ocupa todo el ancho: con 3 columnas,
    `button:last-child:nth-child(3n+1)`; con 2 columnas, `button:last-child:nth-child(odd)` →
    `grid-column: 1 / -1`.
  - No toques `.segmented` (lo hace T6).
- TDD: no
- Criterios de aceptación:
  - [ ] En el móvil (o DevTools con modo táctil), tras tocar aleatorio o repetir, el icono queda
        ámbar sin fondo gris.
  - [ ] En ordenador, el hover sigue funcionando.
  - [ ] Seleccionar con 5 acciones = 3 + 2; con 4 = 3 + 1 a todo el ancho. Todo visible a 360 px.
- Verificación: `npm run check`; prueba manual en `npm run dev` con DevTools en móvil 360 px.

### T2 · Reproductor y botones de lista que se explican solos · Grupo A · Estado: PENDIENTE

- Archivos (exclusivos): `apps/web/src/components/player/Controls.tsx`,
  `apps/web/src/views/LibraryView.tsx`, `apps/web/src/views/PlaylistView.tsx`,
  `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/es.ts`, `apps/web/src/i18n/eu.ts`,
  `apps/web/src/help/articles/listen.ts`
- Leer como contexto: `apps/web/src/stores/player.ts` (solo `toggleShuffle`, `cycleRepeat`,
  `contextInfo`), `apps/web/src/stores/ui.ts` (`toast`)
- Qué hacer:
  - Añade a `en.ts`, `es.ts` y `eu.ts` **todas** las claves de la tabla del contrato, también las
    `settings.theme*`, que usará T6.
  - `Controls.tsx` (`TransportControls`): al pulsar aleatorio, después de `toggleShuffle()`, haz
    `toast(t(shuffle ? 'player.shuffleOn' : 'player.shuffleOff'))` con el estado nuevo. Al pulsar
    repetir, después de `cycleRepeat()`, muestra un aviso con `repeat*Hint` según el modo nuevo.
    Añade `title={t('player.shuffle')}` al aleatorio. Para repetir, usa `aria-pressed` con
    `repeat !== 'off'`.
  - `LibraryView.tsx`: el botón ✓ pasa a `btn small` con icono y texto `t('select.start')`, clase
    `on` y `aria-pressed` cuando `selecting`. El botón «Aleatorio» lleva la clase `on` y
    `aria-pressed` cuando suena esta lista en aleatorio:
    `usePlayer(s => s.mode === 'track' && s.shuffle && s.contextInfo?.path === '/')`.
  - `PlaylistView.tsx`: el aleatorio (`icon-btn`) lleva `on` y `aria-pressed` con la misma
    condición, pero con `context.path`, y añade `title`.
  - `help/articles/listen.ts`, artículo `queue`: añade un párrafo corto (es/en/eu) que explique el
    botón Repetir (sin repetir → repetir lista → repetir canción, y que el icono con un «1» es
    repetir canción) y que el aleatorio queda en ámbar cuando está activo.
- TDD: no
- Criterios de aceptación:
  - [ ] Al pulsar repetir sale un aviso que dice qué hará en palabras sencillas (en es, en y eu).
  - [ ] El aleatorio grande de Biblioteca y playlist se ve ámbar mientras esa lista suena en
        aleatorio.
  - [ ] El botón Seleccionar de la Biblioteca tiene texto.
  - [ ] El test de paridad i18n y el de enlaces de ayuda pasan.
- Verificación: `npm run check`

### T3 · Playlists: fila «Con amigos» y Grupos visibles · Grupo A · Estado: PENDIENTE

- Archivos (exclusivos): `apps/web/src/views/PlaylistsView.tsx`,
  `apps/web/src/components/playlists/FriendsRow.tsx` (nuevo),
  `apps/web/src/components/playlists/SharePickSheet.tsx` (nuevo),
  `apps/web/src/views/GroupsView.tsx`, `apps/web/src/i18n/share.ts`,
  `apps/web/src/i18n/groups.ts`, `apps/web/src/help/articles/friends.ts`,
  `apps/web/src/help/articles/groups.ts`
- Leer como contexto: `apps/web/src/components/SharePlaylistSheet.tsx` (props
  `{ playlist, onClose }`), `apps/web/src/components/Sheet.tsx`,
  `apps/web/src/components/ScreenTip.tsx`, `apps/web/src/hub/client.ts` (`hubAvailable`)
- Qué hacer:
  - `FriendsRow`: título pequeño `share.friendsTitle` y una fila `row wrap` con 4 `btn small` con
    icono y texto: Compartir (`Share2`, `share.button`, abre `SharePickSheet`), Recibir
    (`ScanLine`, `share.receive`, llama a `onReceive` que abre el `OpenLinkSheet` existente), Jam
    (`PartyPopper`, enlace a `/jam`) y Grupos (`Users`, `nav.groups`, enlace a `/groups`).
    Compartir y Grupos solo si `hubAvailable()`.
  - `SharePickSheet`: lista de playlists (nombre + número de canciones). Al tocar una, se cierra y
    se abre `SharePlaylistSheet` de esa playlist. Si no hay playlists, `share.pickEmpty`.
  - `PlaylistsView`: quita del encabezado los botones Jam y enlace (`Link2`) y pon `<FriendsRow />`
    bajo el `ScreenTip` actual, más un `ScreenTip id="playlists-friends"
text="share.tipFriends" helpId="share-playlist"`. Sin CSS nuevo (usa `row wrap`, `btn small`,
    `card-row`…).
  - `GroupsView`: `ScreenTip id="groups" text="groups.tip" helpId="friend-groups"` bajo el
    encabezado.
  - Ayuda: en `share-playlist` (friends.ts), explica en es/en/eu que se comparte desde
    Playlists → Con amigos → Compartir (o con el botón Compartir dentro de la playlist) y se recibe
    con Recibir. En `friend-groups` (groups.ts), di que se entra desde Playlists → Con amigos →
    Grupos.
- TDD: no
- Criterios de aceptación:
  - [ ] En el móvil, desde Playlists se llega a Grupos en un toque.
  - [ ] «Compartir» y «Recibir» se ven con texto, uno al lado del otro.
  - [ ] Compartir → elegir playlist → sale el QR o enlace de esa playlist.
  - [ ] Paridad i18n y enlaces de ayuda en verde.
- Verificación: `npm run check`; manual en `npm run dev` a 360 px.

### T4 · Descargas: botón «Enviar» junto a «Recibir» · Grupo A · Estado: COMPLETADO

- Archivos (exclusivos): `apps/web/src/views/DownloadView.tsx`,
  `apps/web/src/components/send/SendHowSheet.tsx` (nuevo), `apps/web/src/i18n/parcel.ts`,
  `apps/web/src/help/articles/music.ts`
- Leer como contexto: `apps/web/src/components/send/ReceiveSheet.tsx`,
  `apps/web/src/components/Sheet.tsx`, `apps/web/src/stores/ui.ts` (`startSelection`),
  `apps/web/src/components/ScreenTip.tsx`
- Qué hacer:
  - En `DownloadView`, donde está `ReceiveButton` (solo `isNative && hubAvailable()`), pon los dos
    botones en una fila `row wrap`: Recibir (como ahora) y Enviar (`Send`, `parcel.send`), que abre
    `SendHowSheet`. Debajo, `ScreenTip id="dl-send" text="parcel.tipSend" helpId="send-with-code"`
    con la misma condición.
  - `SendHowSheet({ onClose })`: título `parcel.sendHowTitle`. Tres bloques cortos: (1)
    `parcel.sendHowSelect` + botón primario `parcel.sendPick` → `onClose()`, `navigate('/')` y
    `useUi.getState().startSelection()`; (2) `parcel.sendHowQueue`; (3) `parcel.sendHowPlaylist` +
    botón `parcel.sendGoPlaylists` → `/playlists`. Al final, en pequeño, `parcel.sendHowNote` y un
    `HelpButton id="send-with-code"`.
  - Ayuda `send-with-code` (music.ts): añade en es/en/eu un apartado «Enviar desde el móvil» con
    esos tres caminos.
- TDD: no
- Criterios de aceptación:
  - [ ] En el móvil, Descargas muestra «Recibir» y «Enviar» juntos.
  - [ ] «Elegir canciones» abre la Biblioteca en modo selección.
  - [ ] Paridad i18n y enlaces de ayuda en verde.
- Verificación: `npm run check`; manual con `npm run build -w @aske/web -- --mode fakenative`
  (después, reconstruir el dist normal).

### T5 · Modo estudio: pomo, título y flecos de study.ts · Grupo A · Estado: PENDIENTE

- Archivos (exclusivos): `apps/web/src/stores/study.ts`, `apps/web/src/study/slider.ts` (nuevo),
  `apps/web/src/components/study/KnobSlider.tsx` (nuevo),
  `apps/web/src/components/study/AmbientMixer.tsx`,
  `apps/web/src/components/study/StudySetup.tsx`, `apps/web/src/study.css`,
  `apps/web/test/studySlider.test.ts` (nuevo), `apps/web/test/studyStoreEdge.test.ts`
- Leer como contexto: `apps/web/test/studyStore.test.ts` (cómo se simulan StudyLock y el player),
  `apps/web/src/study/session.ts`, `apps/web/src/lib/storage.ts`
- Qué hacer (primero los tests):
  - `study/slider.ts` según el contrato, con tests en `studySlider.test.ts` (límites, redondeo,
    teclas y tecla desconocida → null).
  - `KnobSlider`: pista con relleno y pomo de 28 px (área táctil de 44 px), `role="slider"`,
    `tabIndex=0`, `aria-valuemin/max/now`, `aria-valuetext`, `aria-label`. `onPointerDown`
    **solo en el pomo**: `setPointerCapture` y modo arrastre. `pointermove` → `onChange(valueFromX
(...))` con el rectángulo de la pista. `pointerup` o `pointercancel` → fin. Tocar la pista no
    hace nada. `touch-action: none` solo en el pomo, para que la página siga desplazándose.
    `onKeyDown` con `valueForKey`. Funciones de menos de 50 líneas.
  - `AmbientMixer`: cambia el `<input type=range>` por `KnobSlider` (mismos label y valueText).
  - Título: en `StudySetup`, el encabezado pasa a dos líneas (h1 arriba y enlace de ayuda debajo)
    con una clase `study-header`. En `study.css`: `.study-header { flex-direction: column;
align-items: flex-start; gap: 4px }` y `.study-header h1 { white-space: normal; }`. Estilos
    del deslizador también en `study.css`, en ámbar.
  - `stores/study.ts`:
    - `releasePin`: `cancelChime` y `unpin` en dos `try/catch` separados (cada uno con su
      `reportError`), para que el fallo de uno no impida el otro.
    - `finish`: el cuerpo, desde `finishing = true`, va en `try { … } finally { finishing =
false; }`.
    - Volumen: nueva clave `'study-base-volume'`. Cuando `applyVolume` fija `baseVolume` por
      primera vez → `savePref(clave, baseVolume)`. `restoreVolume` → `savePref(clave, null)`. En
      `restoreStudySession`, antes de mirar la decisión, se lee el guardado: si es `resume`,
      `baseVolume = guardado`; en cualquier otro caso (también `none`), si hay valor,
      `usePlayer.getState().setVolume(guardado)` y se borra la clave.
  - Tests en `studyStoreEdge.test.ts`: (a) si `cancelChime` falla, `unpin` se llama igual; (b) si
    algo dentro de `finish` lanza un error, una segunda `giveUp` funciona; (c) con
    `'study-base-volume'` guardado y sin sesión, `restoreStudySession()` restaura el volumen y
    borra la clave; (d) con sesión `resume`, no lo restaura de golpe.
- TDD: sí
- Criterios de aceptación:
  - [ ] Tocar la barra de lluvia, olas o ruido no cambia el volumen; arrastrar el pomo sí.
  - [ ] «Modo estudio» se ve entero en 360 px y la ayuda queda debajo.
  - [ ] Los tests nuevos pasan y los antiguos del estudio siguen en verde.
- Verificación: `npx vitest run test/studySlider.test.ts test/studyStoreEdge.test.ts
test/studyStore.test.ts --root apps/web` y `npm run check`

### T6 · Selector de tema con iconos · Grupo B · Estado: PENDIENTE

- Depende de: T1 (`styles.css`) y T2 (claves `settings.themeAuto` y `settings.themeHint`).
- Archivos (exclusivos): `apps/web/src/components/settings/GeneralSections.tsx`,
  `apps/web/src/styles.css`
- Qué hacer:
  - `AppearanceSection`: control segmentado a todo el ancho, debajo del título «Claro u oscuro»,
    con 3 botones en este orden: Claro (`Sun`, `settings.themeLight`), Oscuro (`Moon`,
    `settings.themeDark`) y Automático (`Smartphone`, `settings.themeAuto`). Cada botón tiene el
    icono arriba y la etiqueta debajo, y se mantienen `role="radiogroup"`, `role="radio"` y
    `aria-checked`. Debajo, `settings.themeHint` en `faint small`. `settings.themeSystem` ya no se
    usa aquí: si no se usa en ningún otro sitio, bórrala de en, es y eu.
  - CSS: nueva variante `.segmented.theme-picker` (no cambies la `.segmented` base, que usan
    PeriodPicker, GroupView y DownloadView): `display: grid; grid-template-columns: repeat(3,
1fr); width: 100%`. Botones en columna con `min-height: 64px`. El elegido:
    `background: var(--accent); color: var(--accent-ink)`. Sin colores nuevos.
- TDD: no
- Criterios de aceptación:
  - [ ] Los 3 modos se ven con icono y texto, y el elegido en ámbar, en claro y en oscuro.
  - [ ] Ajustes → tema sigue cambiando y guardándose (`v4_test.py` busca `.segmented`: se mantiene).
- Verificación: `npm run check`; manual en `npm run dev`.

### T7 · Documentación · Grupo C · Estado: PENDIENTE

- Archivos (exclusivos): `docs/ESTADO.md`, `docs/v2/architecture.md`
- Qué hacer: en ESTADO.md, añade «Arreglos tras v0.9.0» (botones táctiles, tema, Seleccionar,
  estudio, Enviar/Recibir, entrada a Grupos) y quita de «En curso» los menores de `study.ts`. En
  «Problemas conocidos», resume en 2-3 líneas el corte de música con la pantalla apagada
  (pendiente de decidir las opciones A, B o C de este plan). En `architecture.md`, solo si la tabla
  de fases lo necesita (no hay fase nueva: como mucho, una nota en F9). Marca este PLAN como
  COMPLETADO.
- TDD: no
- Criterios de aceptación:
  - [ ] ESTADO.md al día, en menos de 60 líneas.
- Verificación: lectura.

## Riesgos / dudas abiertas

1. **¿Qué botón es «el de la derecha del todo junto al aleatorio»?**
   - **Repetir del reproductor (Recomendada):** está en la misma fila que el aleatorio y tiene el
     mismo gris pegado. T2 añade aviso y ayuda.
   - **✓ Seleccionar de la Biblioteca:** T2 también le pone texto, así que queda cubierto.
   - Lo recomiendo porque cuadra con «no sé qué hace» y con el mismo fallo de estilo. Con este plan
     se arreglan los dos, así que solo hay que confirmarlo.
2. **¿Dónde va la entrada a Grupos en el móvil?**
   - **Fila «Con amigos» en Playlists (Recomendada):** junta Compartir, Recibir, Jam y Grupos. Se
     descubre fácil, pero añade una fila más a Playlists.
   - **Enlace en Ajustes:** limpio, pero escondido para gente no técnica.
   - **Sexta pestaña:** muy visible, pero aprieta la barra de abajo en móviles pequeños.
   - La recomiendo porque todo lo «social» queda en un sitio y sin tocar la barra.
3. **¿El aleatorio grande se queda en ámbar mientras suena esa lista mezclada?**
   - **Sí (Recomendada):** se ve que está activo, como pedía Andoni («naranja de seleccionado»).
   - **No:** es solo un botón de acción y no muestra estado. Es más simple, pero confunde.
4. **Corte de música (punto 10):** hace falta que Andoni diga si pasa al cambiar de canción o a
   mitad, si eran canciones del móvil o de la nube, qué móvil y qué Android tiene y si la batería
   está «sin restricciones». Con eso se elige entre A, B o C.
5. **Cuadrícula de Seleccionar:** 3 por fila (Recomendada, 5 acciones = 3 + 2) o 2 por fila (botones
   más grandes, pero ocupa 3 filas y tapa más lista).

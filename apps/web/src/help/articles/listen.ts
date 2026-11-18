import type { HelpArticle } from './types';

export const listenArticles: HelpArticle[] = [
  {
    id: 'queue',
    section: 'listen',
    title: {
      es: 'La cola y «A continuación»',
      en: 'The queue and “Up next”',
      eu: 'Ilara eta «Jarraian»',
    },
    body: {
      es: `Abre el reproductor en grande y baja: verás dos listas.

- **Cola**: las canciones que añades tú con «Añadir a la cola» o deslizando una canción hacia la derecha. Siempre suenan primero.
- **A continuación**: el resto de la lista que estabas escuchando (tu biblioteca, una playlist…).

Arrastra el asa **⠿** para cambiar el orden y pulsa la **X** para quitar una canción.

**Reproducir a continuación** (en el menú ⋮) pone la canción la primera de la cola.`,
      en: `Open the player full screen and scroll down: you see two lists.

- **Queue**: songs you add with “Add to queue” or by swiping a song to the right. They always play first.
- **Up next**: the rest of the list you were playing (your library, a playlist…).

Drag the **⠿** handle to reorder and tap **X** to remove a song.

**Play next** (in the ⋮ menu) puts the song first in the queue.`,
      eu: `Ireki erreproduzitzailea handian eta jaitsi: bi zerrenda ikusiko dituzu.

- **Ilara**: zuk «Gehitu ilarara» erabiliz edo abesti bat eskuinera irristatuz gehitzen dituzunak. Beti lehenik entzuten dira.
- **Jarraian**: entzuten ari zinen zerrendaren gainerakoa (zure liburutegia, zerrenda bat…).

Arrastatu **⠿** heldulekua ordena aldatzeko eta sakatu **X** abesti bat kentzeko.

**Erreproduzitu hurrengoa** (⋮ menuan) abestia ilarako lehena jartzen du.`,
    },
  },
  {
    id: 'playlists',
    section: 'listen',
    title: {
      es: 'Playlists: crear, añadir muchas a la vez y ordenar',
      en: 'Playlists: create, add many at once and reorder',
      eu: 'Zerrendak: sortu, asko batera gehitu eta ordenatu',
    },
    body: {
      es: `- **Crear**: en **Playlists**, pulsa **Nueva playlist**.
- **Añadir una canción**: menú **⋮** de la canción → «Añadir a una playlist…».
- **Añadir muchas**: mantén pulsada una canción, toca las demás y pulsa **Playlist** abajo. O dentro de una playlist, pulsa **Añadir canciones**.
- **Cambiar el orden**: dentro de la playlist, pulsa **Cambiar orden** y arrastra.
- **Quitar**: menú ⋮ → «Quitar de esta playlist». La canción sigue en tu biblioteca.

Cada playlist admite hasta 1.000 canciones. «Canciones que te gustan» se llena sola con tus «Me gusta».`,
      en: `- **Create**: in **Playlists**, tap **New playlist**.
- **Add one song**: song **⋮** menu → “Add to a playlist…”.
- **Add many**: press and hold a song, tap the others and tap **Playlist** at the bottom. Or inside a playlist, tap **Add songs**.
- **Reorder**: inside the playlist, tap **Reorder** and drag.
- **Remove**: ⋮ menu → “Remove from this playlist”. The song stays in your library.

Each playlist holds up to 1,000 songs. “Liked songs” fills itself with your likes.`,
      eu: `- **Sortu**: **Zerrendak** atalean, sakatu **Zerrenda berria**.
- **Abesti bat gehitu**: abestiaren **⋮** menua → «Gehitu zerrenda batera…».
- **Asko gehitu**: eutsi sakatuta abesti bat, ukitu besteak eta sakatu behean **Zerrenda**. Edo zerrenda baten barruan, sakatu **Gehitu abestiak**.
- **Ordena aldatu**: zerrendaren barruan, sakatu **Ordena aldatu** eta arrastatu.
- **Kendu**: ⋮ menua → «Kendu zerrenda honetatik». Abestiak zure liburutegian jarraitzen du.

Zerrenda bakoitzak 1.000 abesti arte onartzen ditu. «Gogoko abestiak» bere kabuz betetzen da zure «Gogokoetara» gehitutakoekin.`,
    },
  },
  {
    id: 'sleep-timer',
    section: 'listen',
    title: {
      es: 'Temporizador para dormir',
      en: 'Sleep timer',
      eu: 'Lo egiteko tenporizadorea',
    },
    body: {
      es: `Para quedarte dormido con música sin que suene toda la noche:

1. Abre el reproductor en grande.
2. Pulsa la **luna** de arriba.
3. Elige un tiempo (15 min, 1 h…), **Al acabar la canción** u **Otro tiempo**.

En los últimos 20 segundos la música baja poco a poco y se para. La luna se ve en ámbar mientras el temporizador está activo; púlsala otra vez para ver cuánto falta o para **Cancelar temporizador**.

«Al acabar la canción» no está disponible con la radio. Mira también [[queue|la cola]].`,
      en: `To fall asleep to music without it playing all night:

1. Open the player full screen.
2. Tap the **moon** at the top.
3. Pick a time (15 min, 1 h…), **When the song ends** or **Other time**.

In the last 20 seconds the music fades out and stops. The moon is amber while the timer is on; tap it again to see the time left or to **Cancel timer**.

“When the song ends” is not available with radio. See also [[queue|the queue]].`,
      eu: `Musikarekin lokartzeko, gau osoan jotzen egon gabe:

1. Ireki erreproduzitzailea handian.
2. Sakatu goiko **ilargia**.
3. Aukeratu denbora bat (15 min, 1 h…), **Abestia amaitzean** edo **Beste denbora bat**.

Azken 20 segundoetan musika apurka-apurka jaisten da eta gelditu egiten da. Ilargia anbar kolorekoa da tenporizadorea aktibo dagoen bitartean; sakatu berriro zenbat falta den ikusteko edo **Utzi tenporizadorea** egiteko.

«Abestia amaitzean» ez dago erabilgarri irratiarekin. Ikusi baita ere [[queue|ilara]].`,
    },
  },
  {
    id: 'podcasts',
    section: 'listen',
    title: { es: 'Podcasts', en: 'Podcasts', eu: 'Podcastak' },
    body: {
      es: `Las charlas, entrevistas o vídeos largos van aparte, en **Podcasts**, para que no se mezclen con tu música.

- Para mover algo allí: menú **⋮** → «Mover a Podcasts» (y al revés, «Mover a Música»).
- La app recuerda por dónde ibas en cada episodio.
- En el reproductor puedes cambiar la velocidad y saltar 15 segundos atrás o 30 adelante.`,
      en: `Talks, interviews or long videos go apart, in **Podcasts**, so they do not mix with your music.

- To move something there: **⋮** menu → “Move to Podcasts” (and back with “Move to Music”).
- The app remembers where you were in each episode.
- In the player you can change the speed and jump 15 seconds back or 30 forward.`,
      eu: `Hitzaldiak, elkarrizketak edo bideo luzeak bereiz doaz, **Podcastak** atalean, zure musikarekin nahas ez daitezen.

- Zerbait hara eramateko: **⋮** menua → «Eraman Podcastetara» (eta alderantziz, «Eraman Musikara»).
- Aplikazioak gogoratzen du atal bakoitzean non zinen.
- Erreproduzitzailean abiadura alda dezakezu eta 15 segundo atzera edo 30 aurrera salto egin.`,
    },
  },
  {
    id: 'radio',
    section: 'listen',
    title: {
      es: 'Radio: buscar, guardar y añadir emisoras',
      en: 'Radio: find, save and add stations',
      eu: 'Irratia: bilatu, gorde eta gehitu irratiak',
    },
    body: {
      es: `En **Radio** tienes decenas de miles de emisoras de todo el mundo. Filtra por país o género, o búscalas por nombre (por ejemplo «Gaztea» o «EITB»).

- Pulsa el **corazón** para guardarla en **Tus emisoras**, siempre arriba.
- Si una emisora no aparece, pulsa **Añadir una emisora con su enlace** y pega el enlace de su web.

La radio necesita internet. Algunas emisoras antiguas (enlaces que empiezan por http://) solo suenan en la app de Android: mira [[radio-no-sound|si una emisora no suena]].`,
      en: `**Radio** has tens of thousands of stations from all over the world. Filter by country or genre, or search by name (for example “Gaztea” or “EITB”).

- Tap the **heart** to save it in **Your stations**, always at the top.
- If a station is missing, tap **Add a station by its link** and paste the link from its website.

Radio needs internet. Some old stations (links starting with http://) only play in the Android app: see [[radio-no-sound|if a station does not play]].`,
      eu: `**Irratia** atalean mundu osoko hamarnaka mila irrati dituzu. Iragazi herrialdearen edo generoaren arabera, edo bilatu izenez (adibidez «Gaztea» edo «EITB»).

- Sakatu **bihotza** **Zure irratiak** atalean gordetzeko, beti goian.
- Irrati bat agertzen ez bada, sakatu **Gehitu irrati bat bere estekarekin** eta itsatsi bere webguneko esteka.

Irratiak Internet behar du. Irrati zahar batzuk (http:// hasten diren estekak) Android aplikazioan bakarrik entzuten dira: ikusi [[radio-no-sound|irrati bat entzuten ez bada]].`,
    },
  },
  {
    id: 'data-saver',
    section: 'listen',
    title: { es: 'Ahorro de datos', en: 'Data saver', eu: 'Datu-aurrezpena' },
    body: {
      es: `Con **Ajustes → Ahorro de datos** activado, cuando pulsas **Reproducir** en una lista suenan primero las canciones que ya están guardadas en el móvil y después las que necesitan internet. Así gastas menos datos móviles.

Si tocas una canción concreta, suena esa, esté donde esté.`,
      en: `With **Settings → Data saver** on, when you tap **Play** on a list, songs already stored on the phone play first and the ones needing internet come after. You use less mobile data.

If you tap a specific song, that one plays wherever it is.`,
      eu: `**Ezarpenak → Datu-aurrezpena** aktibatuta, zerrenda batean **Erreproduzitu** sakatzean, mugikorrean gordeta dauden abestiak entzuten dira lehenik eta Internet behar dutenak gero. Horrela datu mugikor gutxiago gastatzen dituzu.

Abesti zehatz bat ukitzen baduzu, hori entzuten da, dagoen tokian dagoela.`,
    },
  },
];

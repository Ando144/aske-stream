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

**Reproducir a continuación** (en el menú ⋮) pone la canción la primera de la cola.

**Aleatorio**: no repite ninguna canción hasta que han sonado todas las de esa lista. Cada lista (tu biblioteca, cada playlist…) recuerda por dónde ibas. Las canciones nuevas que añadas entran en el aleatorio. Al empezar otra vuelta, la primera nunca es la última que sonó.`,
      en: `Open the player full screen and scroll down: you see two lists.

- **Queue**: songs you add with “Add to queue” or by swiping a song to the right. They always play first.
- **Up next**: the rest of the list you were playing (your library, a playlist…).

Drag the **⠿** handle to reorder and tap **X** to remove a song.

**Play next** (in the ⋮ menu) puts the song first in the queue.

**Shuffle**: it does not repeat any song until all the songs in that list have played. Each list (your library, each playlist…) remembers where you were. New songs you add join the shuffle. When a new round starts, the first song is never the last one that played.`,
      eu: `Ireki erreproduzitzailea handian eta jaitsi: bi zerrenda ikusiko dituzu.

- **Ilara**: zuk «Gehitu ilarara» erabiliz edo abesti bat eskuinera irristatuz gehitzen dituzunak. Beti lehenik entzuten dira.
- **Jarraian**: entzuten ari zinen zerrendaren gainerakoa (zure liburutegia, zerrenda bat…).

Arrastatu **⠿** heldulekua ordena aldatzeko eta sakatu **X** abesti bat kentzeko.

**Erreproduzitu hurrengoa** (⋮ menuan) abestia ilarako lehena jartzen du.

**Ausazkoa**: ez du abesti bat ere errepikatzen zerrenda horretako guztiak entzun arte. Zerrenda bakoitzak (zure liburutegia, zerrenda bakoitza…) gogoratzen du non gelditu zinen. Gehitzen dituzun abesti berriak ausazkoan sartzen dira. Itzuli berri bat hasten denean, lehena ez da inoiz entzundako azkena.`,
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
- **Ordenar tus playlists**: en la lista de **Playlists**, arrastra una por su asa y suéltala sobre otra para cambiarla de sitio. Si la sueltas sobre una carpeta, entra en ella.
- **Fijar arriba**: menú **…** de una playlist o carpeta → «Fijar arriba». Se queda la primera de la lista, debajo de «Canciones que te gustan».

Cada playlist admite hasta 1.000 canciones. «Canciones que te gustan» se llena sola con tus «Me gusta».

Para ordenarlas en carpetas, ponerles foto o juntar dos, mira [[playlist-folders|Carpetas, portadas y juntar playlists]].`,
      en: `- **Create**: in **Playlists**, tap **New playlist**.
- **Add one song**: song **⋮** menu → “Add to a playlist…”.
- **Add many**: press and hold a song, tap the others and tap **Playlist** at the bottom. Or inside a playlist, tap **Add songs**.
- **Reorder**: inside the playlist, tap **Reorder** and drag.
- **Remove**: ⋮ menu → “Remove from this playlist”. The song stays in your library.
- **Sort your playlists**: in the **Playlists** list, drag one by its handle and drop it on another to change its place. Drop it on a folder to put it inside.
- **Pin to the top**: **…** menu of a playlist or folder → “Pin to top”. It stays first in the list, below “Liked songs”.

Each playlist holds up to 1,000 songs. “Liked songs” fills itself with your likes.

To sort them into folders, give them a photo or merge two, see [[playlist-folders|Folders, covers and merging playlists]].`,
      eu: `- **Sortu**: **Zerrendak** atalean, sakatu **Zerrenda berria**.
- **Abesti bat gehitu**: abestiaren **⋮** menua → «Gehitu zerrenda batera…».
- **Asko gehitu**: eutsi sakatuta abesti bat, ukitu besteak eta sakatu behean **Zerrenda**. Edo zerrenda baten barruan, sakatu **Gehitu abestiak**.
- **Ordena aldatu**: zerrendaren barruan, sakatu **Ordena aldatu** eta arrastatu.
- **Kendu**: ⋮ menua → «Kendu zerrenda honetatik». Abestiak zure liburutegian jarraitzen du.
- **Zerrendak ordenatu**: **Zerrendak** atalean, arrastatu bat heldulekutik eta askatu beste baten gainean lekua aldatzeko. Karpeta baten gainean askatzen baduzu, barrura sartzen da.
- **Goian finkatu**: zerrenda edo karpeta baten **…** menua → «Finkatu goian». Zerrendako lehena izaten da, «Gogoko abestiak» azpian.

Zerrenda bakoitzak 1.000 abesti arte onartzen ditu. «Gogoko abestiak» bere kabuz betetzen da zure «Gogokoetara» gehitutakoekin.

Karpetetan antolatzeko, argazkia jartzeko edo bi batu nahi badituzu, ikusi [[playlist-folders|Karpetak, azalak eta zerrendak batzea]].`,
    },
  },
  {
    id: 'playlist-folders',
    section: 'listen',
    title: {
      es: 'Carpetas, portadas y juntar playlists',
      en: 'Folders, covers and merging playlists',
      eu: 'Karpetak, azalak eta zerrendak batzea',
    },
    body: {
      es: `**Crear una carpeta**: en **Playlists**, pulsa **Nueva carpeta**. Las carpetas son de un solo nivel.

**Mover una playlist a una carpeta**:
- Abre la playlist, pulsa **…** → «Mover a una carpeta» y elige una (o crea una nueva).
- O en la lista, arrastra el asa **⠿** de la playlist y suéltala sobre la carpeta. Para sacarla, suéltala en la zona «sacar de la carpeta».

**Ordenar las carpetas**: arrastra el asa **⠿** de una carpeta hacia arriba o abajo. Si llegas al borde de la pantalla, la lista se mueve sola. El orden se guarda donde está tu música. Al copiar a otro almacenamiento, las carpetas que no existían allí se añaden al final, sin mover las que ya había.

**Borrar una carpeta no borra las playlists**: vuelven a la lista principal y todas las canciones siguen donde estaban.

**Foto propia**: en **…** → «Elegir portada» y escoge una imagen de tu móvil. Para volver al mosaico automático, **…** → «Quitar portada».

**Juntar dos playlists**: en **…** → «Juntar con otra playlist» y elige la otra.
- La playlist desde la que empiezas es la que se queda. Con **Cambiar el orden** eliges cuál se queda.
- Las canciones de la otra se añaden al final, **sin repetir** las que ya estén.
- La casilla **Borrar la otra** viene marcada: la otra playlist desaparece, pero **sus canciones no se borran** de tu biblioteca. Desmárcala si quieres conservarla.
- Una playlist admite hasta **1.000 canciones**. Si al juntarlas no caben, la app te lo dice y no cambia nada: quita algunas canciones de una de ellas e inténtalo otra vez.

Si cambias de almacenamiento, las carpetas y las fotos viajan con la copia: mira [[storage-copy|copiar tu música a otro sitio]]. Más sobre playlists en [[playlists|Playlists]].`,
      en: `**Create a folder**: in **Playlists**, tap **New folder**. Folders have a single level.

**Move a playlist into a folder**:
- Open the playlist, tap **…** → “Move to a folder” and pick one (or create a new one).
- Or in the list, drag the playlist's **⠿** handle and drop it on the folder. To take it out, drop it on the “take out of the folder” area.

**Sort the folders**: drag a folder's **⠿** handle up or down. If you reach the edge of the screen, the list scrolls by itself. The order is saved wherever your music is. When you copy to another storage, folders that were not there are added at the end, without moving the ones already there.

**Deleting a folder does not delete the playlists**: they go back to the main list and every song stays where it was.

**Your own photo**: **…** → “Choose cover” and pick an image from your phone. To go back to the automatic mosaic, **…** → “Remove cover”.

**Merge two playlists**: **…** → “Merge with another playlist” and pick the other one.
- The playlist you start from is the one that stays. **Swap the order** lets you choose which one stays.
- Songs from the other one are added at the end, **without repeats**.
- The **Delete the other one** box is ticked: the other playlist disappears, but **its songs are not deleted** from your library. Untick it to keep it.
- A playlist holds up to **1,000 songs**. If they do not fit when merged, the app tells you and changes nothing: remove some songs from one of them and try again.

If you change storage, folders and photos travel with the copy: see [[storage-copy|copying your music to another place]]. More about playlists in [[playlists|Playlists]].`,
      eu: `**Karpeta bat sortu**: **Zerrendak** atalean, sakatu **Karpeta berria**. Karpetek maila bakarra dute.

**Zerrenda bat karpeta batera eraman**:
- Ireki zerrenda, sakatu **…** → «Eraman karpeta batera» eta aukeratu bat (edo sortu berri bat).
- Edo zerrendan, arrastatu zerrendaren **⠿** heldulekua eta jaregin karpetaren gainean. Ateratzeko, jaregin «atera karpetatik» eremuan.

**Karpetak ordenatu**: arrastatu karpeta baten **⠿** heldulekua gora edo behera. Pantailaren ertzera iristen bazara, zerrenda bere kabuz mugitzen da. Ordena zure musika dagoen lekuan gordetzen da. Beste biltegiratze batera kopiatzean, han ez zeuden karpetak amaieran gehitzen dira, lehendik zeudenak mugitu gabe.

**Karpeta bat ezabatzeak ez ditu zerrendak ezabatzen**: zerrenda nagusira itzultzen dira eta abesti guztiak dauden tokian jarraitzen dute.

**Zure argazkia**: **…** → «Aukeratu azala» eta hautatu irudi bat zure mugikorretik. Mosaiko automatikora itzultzeko, **…** → «Kendu azala».

**Bi zerrenda batu**: **…** → «Batu beste zerrenda batekin» eta aukeratu bestea.
- Hasten zaren zerrenda geratzen da. **Aldatu ordena** botoiarekin zein geratzen den aukeratzen duzu.
- Besteko abestiak amaieran gehitzen dira, **errepikatu gabe**.
- **Ezabatu bestea** laukia markatuta dator: beste zerrenda desagertzen da, baina **bere abestiak ez dira ezabatzen** zure liburutegitik. Desmarkatu gordetzeko.
- Zerrenda batek **1.000 abesti** onartzen ditu. Batzean ez badira sartzen, aplikazioak esango dizu eta ez du ezer aldatuko: kendu abesti batzuk haietako batetik eta saiatu berriro.

Biltegiratzea aldatzen baduzu, karpetak eta argazkiak kopiarekin doaz: ikusi [[storage-copy|zure musika beste leku batera kopiatu]]. Zerrendei buruz gehiago: [[playlists|Zerrendak]].`,
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

En los últimos 20 segundos la música baja poco a poco y se para. La luna se ve en ámbar mientras el temporizador está activo; púlsala otra vez y verás cuánto falta. **Quitar temporizador** lo apaga y **Cambiar el tiempo** pone otro.

«Al acabar la canción» no está disponible con la radio. Mira también [[queue|la cola]].`,
      en: `To fall asleep to music without it playing all night:

1. Open the player full screen.
2. Tap the **moon** at the top.
3. Pick a time (15 min, 1 h…), **When the song ends** or **Other time**.

In the last 20 seconds the music fades out and stops. The moon is amber while the timer is on; tap it again to see the time left. **Remove timer** turns it off and **Change the time** sets a different one.

“When the song ends” is not available with radio. See also [[queue|the queue]].`,
      eu: `Musikarekin lokartzeko, gau osoan jotzen egon gabe:

1. Ireki erreproduzitzailea handian.
2. Sakatu goiko **ilargia**.
3. Aukeratu denbora bat (15 min, 1 h…), **Abestia amaitzean** edo **Beste denbora bat**.

Azken 20 segundoetan musika apurka-apurka jaisten da eta gelditu egiten da. Ilargia anbar kolorekoa da tenporizadorea aktibo dagoen bitartean; sakatu berriro eta zenbat falta den ikusiko duzu. **Kendu tenporizadorea** botoiak itzali egiten du eta **Aldatu denbora** botoiak beste bat jartzen du.

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

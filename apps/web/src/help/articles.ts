import type { Language } from '../i18n';

/**
 * Help centre. Written for people who have never set up a server: short
 * sentences, no jargon, the exact names of buttons, and what to do next.
 *
 * Markup (see HelpBody): blank line = new paragraph, "- " = bullet,
 * "1. " = numbered step, **bold**, [[article-id|text]] = link to another
 * article, [text](https://…) = link to a web page.
 */

export type SectionId =
  | 'start'
  | 'music'
  | 'listen'
  | 'offline'
  | 'drive'
  | 'cloudflare'
  | 'android'
  | 'problems'
  | 'privacy';

type Text = Record<Language, string>;

export interface HelpSection {
  id: SectionId;
  title: Text;
}

export interface HelpArticle {
  id: string;
  section: SectionId;
  title: Text;
  body: Text;
}

export const SECTIONS: HelpSection[] = [
  { id: 'start', title: { es: 'Primeros pasos', en: 'Getting started', eu: 'Lehen urratsak' } },
  { id: 'music', title: { es: 'Añadir música', en: 'Adding music', eu: 'Musika gehitu' } },
  { id: 'listen', title: { es: 'Escuchar', en: 'Listening', eu: 'Entzun' } },
  {
    id: 'offline',
    title: {
      es: 'Sin conexión y espacio',
      en: 'Offline and space',
      eu: 'Konexiorik gabe eta lekua',
    },
  },
  {
    id: 'drive',
    title: { es: 'Tu Google Drive', en: 'Your Google Drive', eu: 'Zure Google Drive' },
  },
  {
    id: 'cloudflare',
    title: { es: 'Tu Cloudflare', en: 'Your Cloudflare', eu: 'Zure Cloudflare' },
  },
  { id: 'android', title: { es: 'App de Android', en: 'Android app', eu: 'Android aplikazioa' } },
  {
    id: 'problems',
    title: { es: 'Si algo falla', en: 'If something goes wrong', eu: 'Zerbaitek huts egiten badu' },
  },
  {
    id: 'privacy',
    title: {
      es: 'Privacidad y derechos',
      en: 'Privacy and rights',
      eu: 'Pribatutasuna eta eskubideak',
    },
  },
];

export const ARTICLES: HelpArticle[] = [
  /* ------------------------------- start ------------------------------- */
  {
    id: 'what-is',
    section: 'start',
    title: {
      es: '¿Qué es Aske Stream?',
      en: 'What is Aske Stream?',
      eu: 'Zer da Aske Stream?',
    },
    body: {
      es: `Aske Stream es una app para escuchar música, parecida a Spotify, con una gran diferencia: **la música es tuya**. La descargas una vez y la escuchas cuando quieras, sin anuncios, sin suscripción y sin que nadie te la quite.

- Busca canciones o playlists de YouTube y descárgalas con un toque (en la app de Android).
- Organízalas en playlists, dale a «Me gusta» y escúchalas en orden o al azar.
- Escucha sin internet, con la pantalla apagada y desde la pantalla de bloqueo.
- Escucha radios de todo el mundo y separa tus podcasts de la música.

«Aske» significa «libre» en euskera. La app la ha creado **Andoni Ortiz de Zarate Urruela** y su código es abierto.`,
      en: `Aske Stream is an app for listening to music, a bit like Spotify, with one big difference: **the music is yours**. You download it once and listen whenever you like, with no ads, no subscription and nobody taking it away.

- Search YouTube for songs or playlists and download them with one tap (in the Android app).
- Organise them in playlists, “like” them and play them in order or shuffled.
- Listen without internet, with the screen off and from the lock screen.
- Listen to radio stations from all over the world and keep podcasts apart from music.

“Aske” means “free” in Basque. The app was created by **Andoni Ortiz de Zarate Urruela** and its code is open source.`,
      eu: `Aske Stream musika entzuteko aplikazio bat da, Spotifyren antzekoa, alde handi batekin: **musika zurea da**. Behin deskargatzen duzu eta nahi duzunean entzuten duzu, iragarkirik gabe, harpidetzarik gabe eta inork kendu gabe.

- Bilatu YouTubeko abestiak edo zerrendak eta deskargatu ukitu batekin (Android aplikazioan).
- Antolatu zerrendetan, gehitu gogokoetara eta entzun ordenan edo ausaz.
- Entzun Internetik gabe, pantaila itzalita eta blokeo-pantailatik.
- Entzun mundu osoko irratiak eta bereizi podcastak musikatik.

«Aske» hitzak «libre» esan nahi du. Aplikazioa **Andoni Ortiz de Zarate Urruela**k sortu du eta bere kodea irekia da.`,
    },
  },
  {
    id: 'storage-options',
    section: 'start',
    title: {
      es: '¿Dónde se guarda mi música?',
      en: 'Where is my music stored?',
      eu: 'Non gordetzen da nire musika?',
    },
    body: {
      es: `La primera vez que abres la app eliges dónde guardarla. Puedes cambiarlo cuando quieras en **Ajustes → Dónde se guarda tu música**, y al cambiar no se borra nada.

**En este dispositivo** (recomendado para empezar)
- No hay que configurar nada ni crear cuentas.
- Suena siempre sin internet.
- La música solo está en ese móvil: si lo pierdes o desinstalas la app, se pierde.

**En tu Cloudflare** (avanzado)
- Es tu propio servidor de música privado, gratis hasta 10 GB (unas 2.500 canciones).
- Tienes la misma biblioteca en el móvil y en el ordenador.
- Montarlo lleva unos 10 minutos con un ordenador. Mira [[cloudflare-what|qué es Cloudflare]].

**En tu Google Drive**
- Solo hay que iniciar sesión con tu cuenta de Google.
- Si pierdes el móvil no pierdes la música, y también la escuchas en el ordenador.
- Usa el espacio gratis de Google (15 GB, compartidos con Gmail y Google Fotos). Mira [[drive-what|cómo funciona]].

Una canción normal ocupa unos 4 MB: 1.000 canciones son unos 4 GB.`,
      en: `The first time you open the app you choose where to keep it. You can change it any time in **Settings → Where your music is stored**, and nothing is deleted when you do.

**On this device** (recommended to start)
- Nothing to set up and no accounts.
- Always plays without internet.
- The music is only on that phone: if you lose it or uninstall the app, the music is gone.

**In your Cloudflare** (advanced)
- Your own private music server, free up to 10 GB (about 2,500 songs).
- The same library on your phone and your computer.
- Setting it up takes about 10 minutes with a computer. See [[cloudflare-what|what Cloudflare is]].

**In your Google Drive**
- Just sign in with your Google account.
- Losing your phone does not lose your music, and you can also listen on your computer.
- It uses Google's free space (15 GB, shared with Gmail and Google Photos). See [[drive-what|how it works]].

A normal song takes about 4 MB: 1,000 songs are about 4 GB.`,
      eu: `Aplikazioa lehen aldiz irekitzean non gorde aukeratzen duzu. Nahi duzunean alda dezakezu **Ezarpenak → Non gordetzen den zure musika** atalean, eta aldatzean ez da ezer ezabatzen.

**Gailu honetan** (hasteko gomendatua)
- Ez dago ezer konfiguratu beharrik ezta konturik sortu beharrik ere.
- Beti entzuten da Internetik gabe.
- Musika mugikor horretan bakarrik dago: galtzen baduzu edo aplikazioa desinstalatzen baduzu, musika galtzen da.

**Zure Cloudflaren** (aurreratua)
- Zure musika-zerbitzari pribatua da, doan 10 GB arte (2.500 abesti inguru).
- Liburutegi bera duzu mugikorrean eta ordenagailuan.
- Prestatzeak 10 minutu inguru behar ditu ordenagailu batekin. Ikusi [[cloudflare-what|zer den Cloudflare]].

**Zure Google Drive-n**
- Zure Google kontuarekin saioa hastea besterik ez.
- Mugikorra galtzen baduzu ez duzu musika galtzen, eta ordenagailuan ere entzun dezakezu.
- Google-ren doako lekua erabiltzen du (15 GB, Gmail eta Google Argazkiak-ekin partekatuak). Ikusi [[drive-what|nola dabilen]].

Abesti arrunt batek 4 MB inguru hartzen ditu: 1.000 abesti 4 GB inguru dira.`,
    },
  },
  {
    id: 'first-steps',
    section: 'start',
    title: {
      es: 'Primeros pasos en 2 minutos',
      en: 'First steps in 2 minutes',
      eu: 'Lehen urratsak 2 minututan',
    },
    body: {
      es: `1. Ve a **Descargar**, escribe el nombre de una canción y pulsa el botón de descarga. En unos segundos estará en tu **Biblioteca**.
2. Toca una canción para escucharla. Abajo verás el reproductor: tócalo para verlo en grande.
3. En el menú **⋮** de una canción puedes añadirla a una playlist, a la cola o darle a «Me gusta».
4. Para elegir muchas a la vez, **mantén pulsada** una canción.
5. En **Radio** pulsa el corazón de tus emisoras favoritas para tenerlas siempre arriba.

¿Quieres ver de nuevo la presentación? En **Ajustes → Ayuda** está «Ver la introducción otra vez».`,
      en: `1. Go to **Download**, type the name of a song and tap the download button. In a few seconds it is in your **Library**.
2. Tap a song to play it. The player appears at the bottom: tap it to see it full screen.
3. In a song’s **⋮** menu you can add it to a playlist or the queue, or “like” it.
4. To pick many songs at once, **press and hold** a song.
5. In **Radio**, tap the heart of your favourite stations to keep them at the top.

Want to see the introduction again? In **Settings → Help** there is “Show the introduction again”.`,
      eu: `1. Joan **Deskargatu** atalera, idatzi abesti baten izena eta sakatu deskargatzeko botoia. Segundo gutxitan zure **Liburutegian** egongo da.
2. Ukitu abesti bat entzuteko. Behean erreproduzitzailea agertuko da: ukitu handian ikusteko.
3. Abesti baten **⋮** menuan zerrenda batera edo ilarara gehi dezakezu, edo gogokoetara gehitu.
4. Asko batera aukeratzeko, **eutsi sakatuta** abesti bat.
5. **Irratia** atalean, sakatu zure irrati gogokoenen bihotza beti goian edukitzeko.

Aurkezpena berriro ikusi nahi duzu? **Ezarpenak → Laguntza** atalean «Erakutsi sarrera berriro» dago.`,
    },
  },

  /* ------------------------------- music ------------------------------- */
  {
    id: 'download-youtube',
    section: 'music',
    title: {
      es: 'Descargar canciones de YouTube',
      en: 'Downloading songs from YouTube',
      eu: 'YouTubeko abestiak deskargatu',
    },
    body: {
      es: `Se hace desde la **app de Android**, en la pestaña **Descargar**.

1. Escribe una canción, un artista o una playlist. También puedes **pegar un enlace** de YouTube o YouTube Music.
2. Elige qué buscar: **Canciones** (de YouTube Music, con mejores títulos y carátulas), **Vídeos** o **Playlists**.
3. Pulsa el botón de descarga. La canción entra en la cola y, al terminar, aparece en tu Biblioteca con su título, artista y carátula.

Puedes salir de la app mientras descarga: verás el progreso en las notificaciones. Si cierras la app a medias, la cola sigue sola la próxima vez que la abras.

La primera descarga tarda un poco más porque la app prepara el descargador.

Las canciones que ya tienes aparecen como «Ya la tienes» y no se descargan dos veces.`,
      en: `You do it in the **Android app**, in the **Download** tab.

1. Type a song, an artist or a playlist. You can also **paste a link** from YouTube or YouTube Music.
2. Choose what to search: **Songs** (from YouTube Music, with better titles and covers), **Videos** or **Playlists**.
3. Tap the download button. The song joins the queue and, when it finishes, appears in your Library with its title, artist and cover.

You can leave the app while it downloads: progress shows in your notifications. If you close the app halfway, the queue carries on next time you open it.

The first download takes a bit longer because the app gets the downloader ready.

Songs you already have show “In library” and are never downloaded twice.`,
      eu: `**Android aplikazioan** egiten da, **Deskargatu** fitxan.

1. Idatzi abesti bat, artista bat edo zerrenda bat. YouTube edo YouTube Musiceko **esteka bat itsatsi** ere egin dezakezu.
2. Aukeratu zer bilatu: **Abestiak** (YouTube Musicetik, izenburu eta azal hobeekin), **Bideoak** edo **Zerrendak**.
3. Sakatu deskargatzeko botoia. Abestia ilarara sartzen da eta, amaitzean, zure Liburutegian agertzen da bere izenburu, artista eta azalarekin.

Deskargatzen ari den bitartean aplikaziotik irten zaitezke: aurrerapena jakinarazpenetan ikusiko duzu. Aplikazioa erdibidean ixten baduzu, ilarak bere kabuz jarraituko du hurrengoan irekitzean.

Lehen deskargak pixka bat gehiago irauten du, aplikazioak deskargatzailea prestatzen duelako.

Dagoeneko dituzun abestiek «Baduzu» jartzen dute eta ez dira bi aldiz deskargatzen.`,
    },
  },
  {
    id: 'download-playlist',
    section: 'music',
    title: {
      es: 'Descargar una playlist entera',
      en: 'Downloading a whole playlist',
      eu: 'Zerrenda oso bat deskargatu',
    },
    body: {
      es: `1. En **Descargar**, elige **Playlists** y busca, o pega el enlace de una playlist de YouTube o YouTube Music.
2. Toca la playlist: verás la lista de canciones.
3. Deja marcada la casilla **«Crear también la playlist en tu biblioteca»** si quieres tenerla igual que en YouTube.
4. Pulsa **Descargar N canciones**.

Se descargan de una en una. Una playlist de 100 canciones ocupa unos 400 MB y tarda un rato: puedes apagar la pantalla.

Si el móvil para las descargas al apagar la pantalla, mira [[background|este artículo]].

Las playlists de Aske Stream admiten hasta 1.000 canciones.`,
      en: `1. In **Download**, choose **Playlists** and search, or paste the link of a YouTube or YouTube Music playlist.
2. Tap the playlist: you see its songs.
3. Leave **“Also create the playlist in your library”** ticked if you want it just like on YouTube.
4. Tap **Download N songs**.

They download one by one. A 100-song playlist takes about 400 MB and a while: you can switch the screen off.

If your phone stops downloads when the screen is off, see [[background|this article]].

Aske Stream playlists hold up to 1,000 songs.`,
      eu: `1. **Deskargatu** atalean, aukeratu **Zerrendak** eta bilatu, edo itsatsi YouTube edo YouTube Musiceko zerrenda baten esteka.
2. Ukitu zerrenda: bere abestiak ikusiko dituzu.
3. Utzi markatuta **«Sortu zerrenda ere zure liburutegian»** YouTuben bezala izan nahi baduzu.
4. Sakatu **Deskargatu N abesti**.

Banan-banan deskargatzen dira. 100 abestiko zerrenda batek 400 MB inguru hartzen ditu eta denbora pixka bat behar du: pantaila itzal dezakezu.

Pantaila itzaltzean mugikorrak deskargak gelditzen baditu, ikusi [[background|artikulu hau]].

Aske Streameko zerrendek 1.000 abesti arte onartzen dituzte.`,
    },
  },
  {
    id: 'send-to-phone',
    section: 'music',
    title: {
      es: 'Enviar canciones desde el ordenador',
      en: 'Sending songs from the computer',
      eu: 'Abestiak ordenagailutik bidali',
    },
    body: {
      es: `Si usas **tu Cloudflare**, puedes elegir música en el ordenador y que la descargue el móvil. (Los navegadores no pueden descargar de YouTube; la app del móvil sí.)

1. En el ordenador, abre Aske Stream y ve a **Descargar**.
2. Busca o pega un enlace de YouTube y pulsa **Enviar al móvil**.
3. La próxima vez que abras la app en el móvil (o en menos de 5 minutos si ya está abierta), la descargará y la subirá a tu biblioteca.

En la lista **Enviado al móvil** del ordenador ves cómo va cada envío: «Esperando al móvil», «Descargando» o «Hecho».`,
      en: `If you use **your Cloudflare**, you can pick music on the computer and have the phone download it. (Browsers cannot download from YouTube; the phone app can.)

1. On the computer, open Aske Stream and go to **Download**.
2. Search or paste a YouTube link and tap **Send to phone**.
3. Next time you open the app on your phone (or within 5 minutes if it is already open), it downloads it and uploads it to your library.

The **Sent to phone** list on the computer shows how each one is going: “Waiting for phone”, “Downloading” or “Done”.`,
      eu: `**Zure Cloudflare** erabiltzen baduzu, ordenagailuan musika aukeratu eta mugikorrak deskarga dezake. (Nabigatzaileek ezin dute YouTubetik deskargatu; mugikorreko aplikazioak bai.)

1. Ordenagailuan, ireki Aske Stream eta joan **Deskargatu** atalera.
2. Bilatu edo itsatsi YouTubeko esteka bat eta sakatu **Bidali mugikorrera**.
3. Mugikorrean aplikazioa irekitzen duzun hurrengoan (edo 5 minutu baino lehen irekita badago), deskargatu eta zure liburutegira igoko du.

Ordenagailuko **Mugikorrera bidalita** zerrendan bidalketa bakoitza nola doan ikusten duzu: «Mugikorraren zain», «Deskargatzen» edo «Eginda».`,
    },
  },
  {
    id: 'import-files',
    section: 'music',
    title: {
      es: 'Importar canciones que ya tienes',
      en: 'Importing songs you already have',
      eu: 'Dagoeneko dituzun abestiak inportatu',
    },
    body: {
      es: `Si guardas la música **en este dispositivo**, en **Biblioteca** tienes el botón **Importar archivos**. Elige canciones del móvil o del ordenador (MP3, M4A, FLAC, OGG…) y se copian a la app.

La app lee el título, el artista, el álbum y la carátula que lleve cada archivo. Si no los lleva, usa el nombre del archivo (por ejemplo «Mikel Laboa - Txoria txori.mp3»).

Si importas dos veces el mismo archivo, no se duplica.`,
      en: `If you keep music **on this device**, **Library** has an **Import files** button. Pick songs from the phone or computer (MP3, M4A, FLAC, OGG…) and they are copied into the app.

The app reads the title, artist, album and cover inside each file. If a file has none, it uses the file name (for example “Mikel Laboa - Txoria txori.mp3”).

Importing the same file twice never duplicates it.`,
      eu: `Musika **gailu honetan** gordetzen baduzu, **Liburutegian** **Inportatu fitxategiak** botoia duzu. Aukeratu mugikorreko edo ordenagailuko abestiak (MP3, M4A, FLAC, OGG…) eta aplikaziora kopiatzen dira.

Aplikazioak fitxategi bakoitzak daraman izenburua, artista, albuma eta azala irakurtzen ditu. Ez badaramatza, fitxategiaren izena erabiltzen du (adibidez «Mikel Laboa - Txoria txori.mp3»).

Fitxategi bera bi aldiz inportatuz gero, ez da bikoizten.`,
    },
  },
  {
    id: 'downloader-update',
    section: 'music',
    title: {
      es: 'Si las descargas fallan: actualizar el descargador',
      en: 'If downloads fail: updating the downloader',
      eu: 'Deskargek huts egiten badute: deskargatzailea eguneratu',
    },
    body: {
      es: `YouTube cambia a menudo y, a veces, el descargador deja de funcionar hasta que se actualiza. La app lo actualiza sola cada semana, sin tener que instalar nada.

Si una descarga falla, abajo del todo en **Descargar** está el apartado **Descargador** con el botón **Actualizar**. Púlsalo con internet y vuelve a intentarlo con **Reintentar**.

Mensajes que puedes ver:
- **«YouTube ha pedido comprobar que no eres un robot»**: espera un rato (a veces horas), actualiza y reintenta. Pasa más con algunas redes Wi-Fi públicas.
- **«Este vídeo ya no está disponible o es privado»**: el vídeo se borró o es privado; no se puede descargar.
- **«Bloqueado en tu país»**: YouTube no deja verlo aquí.`,
      en: `YouTube changes often and sometimes the downloader stops working until it is updated. The app updates it by itself every week, without installing anything.

If a download fails, at the very bottom of **Download** there is the **Downloader** section with an **Update** button. Tap it with internet and try again with **Retry**.

Messages you may see:
- **“YouTube asked to check you are not a robot”**: wait a while (sometimes hours), update and retry. It happens more on some public Wi-Fi networks.
- **“This video is no longer available or is private”**: it was deleted or is private; it cannot be downloaded.
- **“Blocked in your country”**: YouTube does not show it here.`,
      eu: `YouTube maiz aldatzen da eta, batzuetan, deskargatzaileak funtzionatzeari uzten dio eguneratu arte. Aplikazioak bere kabuz eguneratzen du astero, ezer instalatu gabe.

Deskarga batek huts egiten badu, **Deskargatu** atalaren behealdean **Deskargatzailea** atala dago **Eguneratu** botoiarekin. Sakatu Internetekin eta saiatu berriro **Saiatu berriro** botoiarekin.

Ikus ditzakezun mezuak:
- **«YouTubek robota ez zarela egiaztatzeko eskatu du»**: itxaron pixka bat (batzuetan orduak), eguneratu eta saiatu berriro. Wi-Fi publiko batzuetan gehiagotan gertatzen da.
- **«Bideo hau ez dago eskuragarri edo pribatua da»**: ezabatu egin zuten edo pribatua da; ezin da deskargatu.
- **«Zure herrialdean blokeatuta»**: YouTubek ez du hemen erakusten.`,
    },
  },

  /* ------------------------------- listen ------------------------------ */
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

  /* ------------------------------ offline ------------------------------ */
  {
    id: 'offline-how',
    section: 'offline',
    title: {
      es: 'Cómo funciona la música sin conexión',
      en: 'How offline music works',
      eu: 'Nola dabilen konexiorik gabeko musika',
    },
    body: {
      es: `**Si guardas la música en este dispositivo**, toda suena sin internet. No hay que hacer nada.

**Si usas Google Drive o tu Cloudflare**, el móvil guarda una copia de una parte de tu música para cuando no tengas internet (en el metro, de viaje…). Lo ajustas en **Ajustes → Música sin conexión**:
- **Cuánta música** guardar, en minutos u horas.
- **Rellenar automáticamente**: la app elige canciones al azar hasta llegar al límite.
- **Cambiar las ya escuchadas**: pasado un tiempo, las que ya has escuchado se cambian por otras, para que siempre tengas música «nueva» sin conexión.
- Las que tú descargas a mano (**Elegidas por ti**) nunca se cambian.
- **Descargar con datos móviles**: si está apagado, espera al Wi-Fi.`,
      en: `**If you keep music on this device**, all of it plays without internet. Nothing to do.

**If you use Google Drive or your Cloudflare**, the phone keeps a copy of part of your music for when you have no internet (underground, travelling…). Set it in **Settings → Offline music**:
- **How much music** to keep, in minutes or hours.
- **Fill automatically**: the app picks random songs up to the limit.
- **Swap songs you have heard**: after a while, songs you have already heard are swapped for others, so you always have “new” music offline.
- Songs you download by hand (**Picked by you**) are never swapped.
- **Download with mobile data**: when off, it waits for Wi-Fi.`,
      eu: `**Musika gailu honetan gordetzen baduzu**, guztia entzuten da Internetik gabe. Ez dago ezer egin beharrik.

**Google Drive edo zure Cloudflare erabiltzen badituzu**, mugikorrak zure musikaren zati baten kopia gordetzen du Internetik ez duzunerako (metroan, bidaian…). **Ezarpenak → Konexiorik gabeko musika** atalean doitzen da:
- **Zenbat musika** gorde, minututan edo ordutan.
- **Automatikoki bete**: aplikazioak ausaz aukeratzen ditu abestiak mugara iritsi arte.
- **Aldatu entzundakoak**: denbora pixka bat igarotakoan, entzun dituzunak beste batzuengatik aldatzen dira, konexiorik gabe beti musika «berria» izateko.
- Zuk eskuz deskargatzen dituzunak (**Zuk aukeratuak**) ez dira inoiz aldatzen.
- **Deskargatu datu mugikorrekin**: desaktibatuta badago, Wi-Fiaren zain geratzen da.`,
    },
  },
  {
    id: 'storage-space',
    section: 'offline',
    title: {
      es: 'Cuánto espacio ocupa y cómo verlo',
      en: 'How much space it takes and how to check',
      eu: 'Zenbat leku hartzen duen eta nola ikusi',
    },
    body: {
      es: `En **Ajustes → Almacenamiento** ves:
- Lo que ocupan las canciones guardadas en el móvil.
- Lo que ocupan las copias para escuchar sin conexión.
- El espacio libre del móvil y cuántas canciones caben más.
- Con tu Cloudflare: cuánto llevas de los 10 GB gratis.

En **Biblioteca**, encima de la lista, aparece el total: canciones, horas y espacio.

Para hacer sitio: borra canciones (menú ⋮ → «Eliminar de la biblioteca») o baja la cantidad de música sin conexión.`,
      en: `**Settings → Storage** shows:
- The space used by songs stored on the phone.
- The space used by copies for offline listening.
- The phone’s free space and how many more songs fit.
- With your Cloudflare: how much of the free 10 GB you use.

In **Library**, above the list, you see the total: songs, hours and space.

To make room: delete songs (⋮ menu → “Delete from library”) or lower the amount of offline music.`,
      eu: `**Ezarpenak → Biltegiratzea** atalean ikusten duzu:
- Mugikorrean gordetako abestiek hartzen dutena.
- Konexiorik gabe entzuteko kopiek hartzen dutena.
- Mugikorreko leku librea eta zenbat abesti gehiago sartzen diren.
- Zure Cloudflarerekin: doako 10 GBetatik zenbat daramazun.

**Liburutegian**, zerrendaren gainean, guztizkoa agertzen da: abestiak, orduak eta lekua.

Lekua egiteko: ezabatu abestiak (⋮ menua → «Ezabatu liburutegitik») edo jaitsi konexiorik gabeko musika kopurua.`,
    },
  },

  /* ------------------------------- drive ------------------------------- */
  {
    id: 'drive-what',
    section: 'drive',
    title: {
      es: '¿Cómo funciona con Google Drive?',
      en: 'How does it work with Google Drive?',
      eu: 'Nola dabil Google Drive-rekin?',
    },
    body: {
      es: `Google Drive es el «disco duro en internet» que viene con cualquier cuenta de Google (la de Gmail o la del móvil Android). Si eliges guardar ahí tu música:

- La app crea en tu Drive una carpeta llamada **Aske Stream**. Dentro van tus canciones (carpeta **audio**), las portadas (**covers**) y un archivo **library.json** con tus playlists, tus «me gusta» y tus radios.
- Todo lo que descargas o importas se sube a esa carpeta.
- Si abres la app en otro móvil o en el ordenador con la misma cuenta de Google, ves la misma biblioteca.
- El móvil guarda una selección de canciones para escuchar sin internet, igual que con Cloudflare. Mira [[offline-how|cómo funciona sin conexión]].

**Cuánto cabe:** Google regala 15 GB, compartidos con Gmail y Google Fotos. Si no usas mucho esos servicios, caben unas 3.000 canciones. Lo ves en **Ajustes → Almacenamiento**.

**Qué hace falta:** solo tu cuenta de Google. Mira [[drive-connect|cómo conectarla]].`,
      en: `Google Drive is the "hard drive on the internet" that comes with every Google account (your Gmail or Android phone account). If you choose to keep your music there:

- The app creates a folder called **Aske Stream** in your Drive. Inside go your songs (**audio** folder), the covers (**covers**) and a **library.json** file with your playlists, likes and radios.
- Everything you download or import is uploaded to that folder.
- If you open the app on another phone or on your computer with the same Google account, you see the same library.
- The phone keeps a selection of songs to play without internet, just like with Cloudflare. See [[offline-how|how offline works]].

**How much fits:** Google gives you 15 GB free, shared with Gmail and Google Photos. If you do not use those much, about 3,000 songs fit. You can see it in **Settings → Storage**.

**What you need:** just your Google account. See [[drive-connect|how to connect it]].`,
      eu: `Google Drive edozein Google konturekin (Gmail-ekoa edo Android mugikorrekoa) datorren «Interneteko disko gogorra» da. Zure musika bertan gordetzea aukeratzen baduzu:

- Aplikazioak **Aske Stream** izeneko karpeta bat sortzen du zure Drive-n. Barruan zure abestiak (**audio** karpeta), azalak (**covers**) eta zure playlistak, «gustuko»ak eta irratiak dituen **library.json** fitxategia daude.
- Deskargatzen edo inportatzen duzun guztia karpeta horretara igotzen da.
- Aplikazioa beste mugikor batean edo ordenagailuan Google kontu berarekin irekitzen baduzu, liburutegi bera ikusten duzu.
- Mugikorrak abesti-hautaketa bat gordetzen du Internetik gabe entzuteko, Cloudflarerekin bezala. Ikusi [[offline-how|nola dabilen konexiorik gabe]].

**Zenbat sartzen da:** Google-k 15 GB oparitzen ditu, Gmail eta Google Argazkiak-ekin partekatuak. Zerbitzu horiek asko erabiltzen ez badituzu, 3.000 abesti inguru sartzen dira. **Ezarpenak → Biltegiratzea** atalean ikusten da.

**Zer behar da:** zure Google kontua besterik ez. Ikusi [[drive-connect|nola konektatu]].`,
    },
  },
  {
    id: 'drive-connect',
    section: 'drive',
    title: {
      es: 'Conectar tu Google Drive',
      en: 'Connecting your Google Drive',
      eu: 'Zure Google Drive konektatu',
    },
    body: {
      es: `1. En la pantalla **¿Dónde guardamos tu música?** (o en **Ajustes → Dónde se guarda tu música → Cambiar**), pulsa **Conectar con Google** en la opción Google Drive.
2. Se abre una ventana de Google. Elige tu cuenta (o escribe tu correo y contraseña si no aparece).
3. Google te dice que Aske Stream quiere **ver, editar, crear y eliminar solo los archivos de Google Drive que use con esta app**. Pulsa **Continuar** o **Permitir**.
4. Listo: vuelves a la app y ya puedes descargar o importar música.

**En la app de Android** solo se pide una vez. **En el navegador del ordenador**, Google da permiso por una hora; cuando caduca, arriba aparece **Volver a conectar**: púlsalo y sigue escuchando.

**Si algo falla:**
- «Has cerrado la ventana…»: vuelve a pulsar Conectar con Google y termina los pasos.
- El navegador bloquea la ventana: permite las ventanas emergentes para esta página (suele aparecer un aviso en la barra de direcciones).
- «Esta copia de la app no está dada de alta en Google»: no es culpa tuya; avisa a quien te pasó la app.

Si ya tenías música guardada en este dispositivo, mira [[drive-copy|cómo pasarla a Drive]].`,
      en: `1. On the **Where shall we keep your music?** screen (or in **Settings → Where your music is stored → Change**), tap **Connect with Google** on the Google Drive option.
2. A Google window opens. Pick your account (or type your email and password if it is not listed).
3. Google tells you Aske Stream wants to **see, edit, create and delete only the specific Google Drive files you use with this app**. Tap **Continue** or **Allow**.
4. Done: you are back in the app and can download or import music.

**In the Android app** you are asked only once. **In the computer's browser**, Google gives permission for one hour; when it runs out, **Reconnect** appears at the top: tap it and keep listening.

**If something goes wrong:**
- "You closed the Google window…": tap Connect with Google again and finish the steps.
- The browser blocks the window: allow pop-ups for this page (there is usually a notice in the address bar).
- "This copy of the app is not registered with Google": it is not your fault; tell whoever gave you the app.

If you already had music saved on this device, see [[drive-copy|how to move it to Drive]].`,
      eu: `1. **Non gordeko dugu zure musika?** pantailan (edo **Ezarpenak → Non gordetzen den zure musika → Aldatu** atalean), sakatu **Google-ekin konektatu** Google Drive aukeran.
2. Google-ren leiho bat irekiko da. Aukeratu zure kontua (edo idatzi zure posta eta pasahitza agertzen ez bada).
3. Google-k esango dizu Aske Streamek **aplikazio honekin erabiltzen dituzun Google Drive-ko fitxategiak bakarrik ikusi, editatu, sortu eta ezabatu** nahi dituela. Sakatu **Jarraitu** edo **Baimendu**.
4. Eginda: aplikaziora itzultzen zara eta musika deskargatu edo inportatu dezakezu.

**Android aplikazioan** behin bakarrik eskatzen da. **Ordenagailuko nabigatzailean**, Google-k ordubeteko baimena ematen du; amaitzean, goian **Berriro konektatu** agertzen da: sakatu eta jarraitu entzuten.

**Zerbaitek huts egiten badu:**
- «Google-ren leihoa itxi duzu…»: sakatu berriro Google-ekin konektatu eta amaitu urratsak.
- Nabigatzaileak leihoa blokeatzen du: baimendu leiho gainerakorrak orri honetan (helbide-barran abisu bat agertu ohi da).
- «Aplikazioaren kopia hau ez dago Google-n erregistratuta»: ez da zure errua; esan aplikazioa eman dizunari.

Gailu honetan musika gordeta bazenuen, ikusi [[drive-copy|nola eraman Drive-ra]].`,
    },
  },
  {
    id: 'drive-copy',
    section: 'drive',
    title: {
      es: 'Pasar a Drive la música de este dispositivo',
      en: 'Moving this device’s music to Drive',
      eu: 'Gailu honetako musika Drive-ra eraman',
    },
    body: {
      es: `Si antes guardabas la música **en este dispositivo** y ahora usas Google Drive, en la Biblioteca y en **Ajustes → Almacenamiento** aparece **Pasar tu música a Google Drive**.

1. Conéctate a un Wi-Fi (son muchos megas).
2. Pulsa **Subir a Google Drive**.
3. Deja la app abierta con la pantalla encendida. Verás cuántas canciones lleva.

Se suben las canciones con sus portadas y tus «me gusta», y después tus playlists (si en Drive ya hay una con el mismo nombre, se le añaden las canciones que falten).

- **No se borra nada del dispositivo.** Si vuelves a elegir «Este dispositivo», todo sigue ahí.
- Puedes pulsar **Parar** cuando quieras. Al volver a pulsar, sigue por donde iba y no sube nada dos veces.
- Si alguna canción falla (por ejemplo, se cortó internet), pulsa **Seguir subiendo** para reintentarla.`,
      en: `If you used to keep your music **on this device** and now use Google Drive, **Move your music to Google Drive** appears in the Library and in **Settings → Storage**.

1. Connect to Wi-Fi (it is a lot of data).
2. Tap **Upload to Google Drive**.
3. Keep the app open with the screen on. You will see how many songs are done.

Songs are uploaded with their covers and your likes, then your playlists (if Drive already has one with the same name, the missing songs are added to it).

- **Nothing is deleted from the device.** If you choose "This device" again, everything is still there.
- You can tap **Stop** at any time. When you tap again it continues where it left off and never uploads anything twice.
- If a song fails (for example, the internet dropped), tap **Continue uploading** to retry it.`,
      eu: `Lehen musika **gailu honetan** gordetzen bazenuen eta orain Google Drive erabiltzen baduzu, Liburutegian eta **Ezarpenak → Biltegiratzea** atalean **Eraman zure musika Google Drive-ra** agertzen da.

1. Konektatu Wi-Fi batera (datu asko dira).
2. Sakatu **Google Drive-ra igo**.
3. Utzi aplikazioa irekita pantaila piztuta duela. Zenbat abesti doazen ikusiko duzu.

Abestiak azalekin eta zure «gustuko»ekin igotzen dira, eta gero zure playlistak (Drive-n izen bereko bat badago, falta diren abestiak gehitzen zaizkio).

- **Ez da ezer ezabatzen gailutik.** Berriro «Gailu hau» aukeratzen baduzu, dena hor dago.
- Nahi duzunean sakatu dezakezu **Gelditu**. Berriro sakatzean, utzitako lekutik jarraitzen du eta ez du ezer bi aldiz igotzen.
- Abestiren batek huts egiten badu (adibidez, Internet moztu bada), sakatu **Igotzen jarraitu** berriro saiatzeko.`,
    },
  },
  {
    id: 'drive-full',
    section: 'drive',
    title: {
      es: 'Mi Google Drive está lleno',
      en: 'My Google Drive is full',
      eu: 'Nire Google Drive beteta dago',
    },
    body: {
      es: `Los 15 GB gratis de Google se reparten entre **Drive, Gmail y Google Fotos**. Cuando se llenan, no se pueden subir más canciones (y tampoco te llegarán correos nuevos a Gmail).

Para hacer sitio:
- Borra en la app canciones que ya no escuches (menú ⋮ → **Eliminar de la biblioteca**). Se van a la papelera de Drive, que se vacía sola a los 30 días; si la vacías tú, el espacio vuelve al momento.
- Libera espacio en Gmail (correos con archivos grandes) o en Google Fotos.
- Mira qué ocupa más en [Almacenamiento de Google](https://one.google.com/storage).

Si quieres mucha más música, Google vende más espacio (Google One), o puedes usar [[cloudflare-what|tu propio Cloudflare]], que da 10 GB solo para música.`,
      en: `Google's free 15 GB are shared by **Drive, Gmail and Google Photos**. When they are full, no more songs can be uploaded (and Gmail stops receiving new email too).

To make room:
- Delete songs you no longer listen to in the app (⋮ menu → **Delete from library**). They go to Drive's bin, which empties itself after 30 days; if you empty it yourself, the space comes back at once.
- Free up space in Gmail (emails with large attachments) or in Google Photos.
- See what takes most in [Google storage](https://one.google.com/storage).

If you want much more music, Google sells more space (Google One), or you can use [[cloudflare-what|your own Cloudflare]], which gives 10 GB just for music.`,
      eu: `Google-ren doako 15 GBak **Drive, Gmail eta Google Argazkiak** artean banatzen dira. Betetzen direnean, ezin da abesti gehiago igo (eta Gmail-era ere ez zaizu posta berririk iritsiko).

Lekua egiteko:
- Ezabatu aplikazioan entzuten ez dituzun abestiak (⋮ menua → **Ezabatu liburutegitik**). Drive-ko zakarrontzira doaz, 30 egunetan bere kabuz husten dena; zuk husten baduzu, lekua berehala itzultzen da.
- Egin lekua Gmail-en (fitxategi handiak dituzten mezuak) edo Google Argazkiak-en.
- Ikusi zerk hartzen duen gehien [Google biltegiratzea](https://one.google.com/storage) orrian.

Musika askoz gehiago nahi baduzu, Google-k leku gehiago saltzen du (Google One), edo [[cloudflare-what|zure Cloudflare propioa]] erabil dezakezu, musikarentzat bakarrik 10 GB ematen dituena.`,
    },
  },
  {
    id: 'drive-privacy',
    section: 'drive',
    title: {
      es: '¿Qué puede ver la app de mi Google Drive?',
      en: 'What can the app see in my Google Drive?',
      eu: 'Zer ikus dezake aplikazioak nire Google Drive-n?',
    },
    body: {
      es: `**Solo los archivos que ha creado ella misma** (la carpeta Aske Stream y lo que hay dentro). No puede ver tus documentos, fotos ni ningún otro archivo de tu Drive: Google no se lo permite.

- La carpeta es privada: no se comparte con nadie, ni siquiera con quien hizo la app.
- La app no tiene servidor propio: habla directamente con Google desde tu móvil u ordenador.
- No muevas ni cambies el nombre de los archivos de la carpeta a mano: la app podría dejar de encontrarlos. Si borras la carpeta entera, la app empieza con una biblioteca vacía.

**Quitar el permiso:**
1. En la app: **Ajustes → Desconectar de Google Drive** (en ese dispositivo).
2. Para todos los dispositivos: entra en [Aplicaciones con acceso a tu cuenta](https://myaccount.google.com/connections), elige Aske Stream y pulsa **Eliminar todas las conexiones**.

Quitar el permiso no borra tu música. Si quieres borrarla, borra la carpeta **Aske Stream** de tu Drive.`,
      en: `**Only the files it created itself** (the Aske Stream folder and what is inside). It cannot see your documents, photos or any other file in your Drive: Google does not allow it.

- The folder is private: it is shared with nobody, not even whoever made the app.
- The app has no server of its own: it talks to Google directly from your phone or computer.
- Do not move or rename the files in the folder by hand: the app might stop finding them. If you delete the whole folder, the app starts with an empty library.

**Removing the permission:**
1. In the app: **Settings → Disconnect Google Drive** (on that device).
2. For every device: go to [Apps with access to your account](https://myaccount.google.com/connections), pick Aske Stream and tap **Delete all connections**.

Removing the permission does not delete your music. If you want to delete it, delete the **Aske Stream** folder from your Drive.`,
      eu: `**Berak sortutako fitxategiak bakarrik** (Aske Stream karpeta eta barruan dagoena). Ezin ditu zure dokumentuak, argazkiak edo zure Drive-ko beste fitxategirik ikusi: Google-k ez dio uzten.

- Karpeta pribatua da: ez da inorekin partekatzen, ezta aplikazioa egin zuenarekin ere.
- Aplikazioak ez du zerbitzari propiorik: zure mugikor edo ordenagailutik zuzenean hitz egiten du Google-rekin.
- Ez mugitu edo berrizendatu karpetako fitxategiak eskuz: aplikazioak aurkitzeari utz liezaieke. Karpeta osoa ezabatzen baduzu, aplikazioa liburutegi huts batekin hasten da.

**Baimena kentzeko:**
1. Aplikazioan: **Ezarpenak → Google Drive-tik deskonektatu** (gailu horretan).
2. Gailu guztietarako: sartu [Zure kontura sarbidea duten aplikazioak](https://myaccount.google.com/connections) orrian, aukeratu Aske Stream eta sakatu **Ezabatu konexio guztiak**.

Baimena kentzeak ez du zure musika ezabatzen. Ezabatu nahi baduzu, ezabatu **Aske Stream** karpeta zure Drive-tik.`,
    },
  },
  /* ----------------------------- cloudflare ---------------------------- */
  {
    id: 'cloudflare-what',
    section: 'cloudflare',
    title: {
      es: '¿Qué es Cloudflare y cuánto cuesta?',
      en: 'What is Cloudflare and what does it cost?',
      eu: 'Zer da Cloudflare eta zenbat balio du?',
    },
    body: {
      es: `Cloudflare es una empresa que alquila espacio y servidores en internet. Su **plan gratuito** basta para tener tu propio Aske Stream privado: tu música, tus playlists y tus emisoras quedan guardadas allí, y las ves igual en el móvil y en el ordenador.

- **Gratis hasta 10 GB** de música (unas 2.500 canciones). La app nunca sube más de eso, para que no te cobren.
- Cloudflare pide una tarjeta para activar el plan gratuito, pero no cobra nada dentro de ese límite.
- Solo tú (y quien tenga tu clave) puede entrar. Nada es público.

Montarlo lleva unos 10 minutos con un ordenador. Hay una [guía paso a paso](https://github.com/Ando144/aske-stream/blob/main/docs/deployment.md); si no te ves con ello, pide ayuda a alguien que ya lo tenga.`,
      en: `Cloudflare is a company that rents space and servers on the internet. Its **free plan** is enough for your own private Aske Stream: your music, playlists and stations are stored there, and you see the same on your phone and your computer.

- **Free up to 10 GB** of music (about 2,500 songs). The app never uploads more than that, so you are not charged.
- Cloudflare asks for a card to activate the free plan, but charges nothing within that limit.
- Only you (and whoever has your key) can get in. Nothing is public.

Setting it up takes about 10 minutes with a computer. There is a [step-by-step guide](https://github.com/Ando144/aske-stream/blob/main/docs/deployment.md); if you do not feel up to it, ask someone who already has one.`,
      eu: `Cloudflare Interneten lekua eta zerbitzariak alokatzen dituen enpresa bat da. Bere **doako plana** nahikoa da zure Aske Stream pribatua izateko: zure musika, zerrendak eta irratiak han gordetzen dira, eta berdin ikusten dituzu mugikorrean eta ordenagailuan.

- **Doan 10 GB arte** musika (2.500 abesti inguru). Aplikazioak ez du inoiz horren gainetik igotzen, kobra ez diezazuten.
- Cloudflarek txartel bat eskatzen du doako plana aktibatzeko, baina ez du ezer kobratzen muga horren barruan.
- Zuk bakarrik (eta zure gakoa duenak) sar daiteke. Ezer ez da publikoa.

Prestatzeak 10 minutu inguru behar ditu ordenagailu batekin. Badago [urratsez urratseko gida](https://github.com/Ando144/aske-stream/blob/main/docs/deployment.md); gai ikusten ez bazara, eskatu laguntza dagoeneko duen norbaiti.`,
    },
  },
  {
    id: 'cloudflare-connect',
    section: 'cloudflare',
    title: {
      es: 'Conectar un móvil u ordenador a tu Cloudflare',
      en: 'Connecting a phone or computer to your Cloudflare',
      eu: 'Mugikor edo ordenagailu bat zure Cloudflarera konektatu',
    },
    body: {
      es: `Necesitas dos cosas, y solo se piden una vez en cada móvil u ordenador:

1. **La dirección** de tu Aske Stream. Tiene esta forma: **https://aske-stream.tu-nombre.workers.dev**. Es la que se ve al final de la instalación.
2. **La clave**: una frase larga y secreta que se crea al instalarlo.

¿Dónde están? Las tiene quien montó tu Cloudflare. Si fuiste tú, en la carpeta del proyecto hay un archivo llamado **.env**: ábrelo con el Bloc de notas y busca las líneas **ASKE_URL** (la dirección) y **ASKE_ACCESS_KEY** (la clave).

Consejo: mándate la clave a ti mismo por un medio privado y cópiala y pégala en el móvil, en vez de escribirla.

Para desconectar un dispositivo: **Ajustes → Desconectar de Cloudflare**.`,
      en: `You need two things, and they are only asked once on each phone or computer:

1. **The address** of your Aske Stream. It looks like **https://aske-stream.your-name.workers.dev**. It is shown at the end of the setup.
2. **The key**: a long secret phrase created during setup.

Where are they? Whoever set up your Cloudflare has them. If it was you, the project folder has a file called **.env**: open it with Notepad and look for the **ASKE_URL** (address) and **ASKE_ACCESS_KEY** (key) lines.

Tip: send the key to yourself privately and copy-paste it on the phone instead of typing it.

To disconnect a device: **Settings → Disconnect from Cloudflare**.`,
      eu: `Bi gauza behar dituzu, eta behin bakarrik eskatzen dira mugikor edo ordenagailu bakoitzean:

1. Zure Aske Streamen **helbidea**. Itxura hau du: **https://aske-stream.zure-izena.workers.dev**. Instalazioaren amaieran agertzen da.
2. **Gakoa**: instalatzean sortzen den esaldi luze eta sekretu bat.

Non daude? Zure Cloudflare prestatu zuenak ditu. Zu izan bazinen, proiektuaren karpetan **.env** izeneko fitxategi bat dago: ireki Ohar-blokearekin eta bilatu **ASKE_URL** (helbidea) eta **ASKE_ACCESS_KEY** (gakoa) lerroak.

Aholkua: bidali gakoa zeure buruari bide pribatu batetik eta kopiatu eta itsatsi mugikorrean, idatzi beharrean.

Gailu bat deskonektatzeko: **Ezarpenak → Deskonektatu Cloudflaretik**.`,
    },
  },
  {
    id: 'cloudflare-full',
    section: 'cloudflare',
    title: {
      es: 'Cuando tu Cloudflare se llena (10 GB)',
      en: 'When your Cloudflare is full (10 GB)',
      eu: 'Zure Cloudflare betetzen denean (10 GB)',
    },
    body: {
      es: `Para que nunca te cobren, la app deja de subir canciones cuando llegas al límite gratis (deja un pequeño margen de seguridad). Lo ves en **Ajustes → Almacenamiento**, que avisa cuando estás cerca.

Si se llena, las descargas fallan con el mensaje «Tu Cloudflare está lleno». Para hacer sitio, borra canciones que ya no escuches (menú ⋮ → «Eliminar de la biblioteca»).

Quien sepa lo que hace puede cambiar el límite con la variable STORAGE_LIMIT_GB del servidor, sabiendo que por encima de 10 GB Cloudflare cobra.`,
      en: `So you are never charged, the app stops uploading songs when you reach the free limit (it keeps a small safety margin). You see it in **Settings → Storage**, which warns you when you are close.

When it is full, downloads fail with “Your Cloudflare is full”. To make room, delete songs you no longer listen to (⋮ menu → “Delete from library”).

Someone who knows what they are doing can change the limit with the server’s STORAGE_LIMIT_GB variable, knowing that Cloudflare charges above 10 GB.`,
      eu: `Inoiz kobra ez diezazuten, aplikazioak abestiak igotzeari uzten dio doako mugara iristean (segurtasun-tarte txiki bat uzten du). **Ezarpenak → Biltegiratzea** atalean ikusten da, eta gertu zaudenean abisatzen dizu.

Betetzen bada, deskargek huts egiten dute «Zure Cloudflare beteta dago» mezuarekin. Lekua egiteko, ezabatu jada entzuten ez dituzun abestiak (⋮ menua → «Ezabatu liburutegitik»).

Zer egiten duen dakienak muga alda dezake zerbitzariko STORAGE_LIMIT_GB aldagaiarekin, jakinda 10 GBetik gora Cloudflarek kobratzen duela.`,
    },
  },

  /* ------------------------------ android ------------------------------ */
  {
    id: 'install-android',
    section: 'android',
    title: {
      es: 'Instalar la app en Android',
      en: 'Installing the app on Android',
      eu: 'Aplikazioa Androiden instalatu',
    },
    body: {
      es: `La app no está en Play Store: se instala con un archivo (APK).

1. En el móvil, abre la [página de versiones](https://github.com/Ando144/aske-stream/releases) y descarga **aske-stream-X.apk** (el que no pone «armv7»; ese es solo para móviles muy antiguos).
2. Abre el archivo descargado.
3. Android te pedirá permitir instalar apps desde el navegador o la app de archivos. Acepta (solo esa vez).
4. Si **Play Protect** avisa de que la app es desconocida, pulsa **Más detalles → Instalar de todas formas**. Avisa porque no viene de Play Store.

Después las actualizaciones se hacen desde la propia app.`,
      en: `The app is not on the Play Store: you install it with a file (APK).

1. On the phone, open the [releases page](https://github.com/Ando144/aske-stream/releases) and download **aske-stream-X.apk** (the one without “armv7”; that one is only for very old phones).
2. Open the downloaded file.
3. Android asks to allow installing apps from the browser or the files app. Accept (only that time).
4. If **Play Protect** warns that the app is unknown, tap **More details → Install anyway**. It warns because it does not come from the Play Store.

From then on, updates happen from inside the app.`,
      eu: `Aplikazioa ez dago Play Storen: fitxategi batekin (APK) instalatzen da.

1. Mugikorrean, ireki [bertsioen orria](https://github.com/Ando144/aske-stream/releases) eta deskargatu **aske-stream-X.apk** («armv7» jartzen ez duena; hori mugikor oso zaharrentzat bakarrik da).
2. Ireki deskargatutako fitxategia.
3. Androidek nabigatzailetik edo fitxategien aplikaziotik aplikazioak instalatzeko baimena eskatuko dizu. Onartu (behin bakarrik).
4. **Play Protect**ek aplikazioa ezezaguna dela abisatzen badu, sakatu **Xehetasun gehiago → Instalatu hala ere**. Play Storetik ez datorrelako abisatzen du.

Hortik aurrera eguneraketak aplikaziotik bertatik egiten dira.`,
    },
  },
  {
    id: 'update-app',
    section: 'android',
    title: { es: 'Actualizar la app', en: 'Updating the app', eu: 'Aplikazioa eguneratu' },
    body: {
      es: `La app mira sola cada día si hay una versión nueva y te avisa. También puedes ir a **Ajustes → Aplicación → Buscar actualizaciones**.

1. Pulsa **Actualizar ahora**: se descarga la versión nueva.
2. La primera vez, Android pide un permiso: pulsa **Dar permiso**, activa **Permitir de esta fuente** y vuelve con el botón Atrás.
3. Android pregunta si quieres actualizar: pulsa **Actualizar**.

Tu música, tus playlists y tus ajustes se mantienen.`,
      en: `The app checks for a new version every day and tells you. You can also go to **Settings → App → Check for updates**.

1. Tap **Update now**: the new version downloads.
2. The first time, Android asks for a permission: tap **Give permission**, turn on **Allow from this source** and come back with the Back button.
3. Android asks whether to update: tap **Update**.

Your music, playlists and settings are kept.`,
      eu: `Aplikazioak egunero begiratzen du bertsio berririk dagoen eta abisatzen dizu. **Ezarpenak → Aplikazioa → Bilatu eguneraketak** atalera ere joan zaitezke.

1. Sakatu **Eguneratu orain**: bertsio berria deskargatzen da.
2. Lehen aldian, Androidek baimen bat eskatzen du: sakatu **Eman baimena**, aktibatu **Baimendu iturburu honetatik** eta itzuli Atzera botoiarekin.
3. Androidek eguneratu nahi duzun galdetzen du: sakatu **Eguneratu**.

Zure musika, zerrendak eta ezarpenak mantentzen dira.`,
    },
  },
  {
    id: 'permissions',
    section: 'android',
    title: {
      es: 'Qué permisos pide la app y para qué',
      en: 'Which permissions the app asks for, and why',
      eu: 'Zein baimen eskatzen dituen aplikazioak eta zertarako',
    },
    body: {
      es: `- **Notificaciones**: para ver cómo van las descargas. Los controles de la música salen igualmente.
- **Instalar apps de esta fuente**: solo para instalar las actualizaciones de la propia app. Android pregunta siempre antes de instalar.
- **Funcionar en segundo plano sin restricciones de batería** (opcional): para que las descargas sigan con la pantalla apagada en móviles que ahorran batería de forma agresiva.

La app **no** pide acceso a tus contactos, ubicación, micrófono, cámara ni a tus fotos.`,
      en: `- **Notifications**: to see how downloads are going. Music controls appear anyway.
- **Install apps from this source**: only to install the app’s own updates. Android always asks before installing.
- **Run in the background without battery restrictions** (optional): so downloads go on with the screen off on phones that save battery aggressively.

The app does **not** ask for your contacts, location, microphone, camera or photos.`,
      eu: `- **Jakinarazpenak**: deskargak nola doazen ikusteko. Musikaren kontrolak hala ere agertzen dira.
- **Iturburu honetako aplikazioak instalatu**: aplikazioaren beraren eguneraketak instalatzeko bakarrik. Androidek beti galdetzen du instalatu aurretik.
- **Atzeko planoan bateria-murrizketarik gabe funtzionatu** (aukerakoa): bateria modu oldarkorrean aurrezten duten mugikorretan pantaila itzalita deskargek jarrai dezaten.

Aplikazioak **ez** du eskatzen zure kontaktuak, kokapena, mikrofonoa, kamera edo argazkiak ikusteko baimenik.`,
    },
  },
  {
    id: 'background',
    section: 'android',
    title: {
      es: 'La música o las descargas se paran con la pantalla apagada',
      en: 'Music or downloads stop with the screen off',
      eu: 'Musika edo deskargak gelditzen dira pantaila itzalita',
    },
    body: {
      es: `Algunos móviles (sobre todo Xiaomi, Huawei, Samsung y OnePlus) cierran las apps en segundo plano para ahorrar batería.

1. En **Descargar**, si aparece el aviso de batería, pulsa **Permitir** y acepta.
2. Si sigue pasando, en los Ajustes del móvil busca **Batería → Aske Stream** y elige **Sin restricciones**.
3. En Xiaomi, además, activa **Inicio automático** para Aske Stream.

En la web [dontkillmyapp.com](https://dontkillmyapp.com) explican los pasos exactos para cada marca.`,
      en: `Some phones (especially Xiaomi, Huawei, Samsung and OnePlus) close apps in the background to save battery.

1. In **Download**, if the battery notice appears, tap **Allow** and accept.
2. If it keeps happening, in the phone’s Settings look for **Battery → Aske Stream** and choose **Unrestricted**.
3. On Xiaomi, also turn on **Autostart** for Aske Stream.

The website [dontkillmyapp.com](https://dontkillmyapp.com) explains the exact steps for each brand.`,
      eu: `Mugikor batzuek (batez ere Xiaomi, Huawei, Samsung eta OnePlus) atzeko planoko aplikazioak ixten dituzte bateria aurrezteko.

1. **Deskargatu** atalean, bateriaren abisua agertzen bada, sakatu **Baimendu** eta onartu.
2. Gertatzen jarraitzen badu, mugikorraren Ezarpenetan bilatu **Bateria → Aske Stream** eta aukeratu **Murrizketarik gabe**.
3. Xiaomin, gainera, aktibatu **Abiarazte automatikoa** Aske Streamentzat.

[dontkillmyapp.com](https://dontkillmyapp.com) webgunean marka bakoitzeko urrats zehatzak azaltzen dituzte.`,
    },
  },
  {
    id: 'iphone',
    section: 'android',
    title: { es: '¿Y en iPhone?', en: 'What about iPhone?', eu: 'Eta iPhonean?' },
    body: {
      es: `No hay app de iPhone: Apple solo deja instalar apps desde su tienda. En iPhone puedes usar la **versión web** con tu Cloudflare: ábrela en Safari y pulsa **Compartir → Añadir a pantalla de inicio**.

En iPhone no se puede descargar de YouTube, pero sí escuchar tu biblioteca, tus playlists y la radio. La música puede pararse al bloquear la pantalla: es una limitación de Safari.`,
      en: `There is no iPhone app: Apple only allows apps from its store. On iPhone you can use the **web version** with your Cloudflare: open it in Safari and tap **Share → Add to Home Screen**.

On iPhone you cannot download from YouTube, but you can listen to your library, playlists and radio. Music may stop when you lock the screen: that is a Safari limitation.`,
      eu: `Ez dago iPhone aplikaziorik: Applek bere dendako aplikazioak bakarrik uzten ditu instalatzen. iPhonean **web bertsioa** erabil dezakezu zure Cloudflarerekin: ireki Safarin eta sakatu **Partekatu → Gehitu hasierako pantailan**.

iPhonean ezin da YouTubetik deskargatu, baina zure liburutegia, zerrendak eta irratia entzun ditzakezu. Pantaila blokeatzean musika gelditu daiteke: Safariren muga bat da.`,
    },
  },

  /* ------------------------------ problems ----------------------------- */
  {
    id: 'cant-connect',
    section: 'problems',
    title: {
      es: 'No consigo conectar con mi Cloudflare',
      en: 'I cannot connect to my Cloudflare',
      eu: 'Ezin naiz nire Cloudflarera konektatu',
    },
    body: {
      es: `La app te dice qué ha pasado:
- **«No hay conexión a internet»**: revisa el Wi-Fi o los datos.
- **«No se encuentra tu servidor en esa dirección»**: la dirección está mal escrita. Ábrela en el navegador del móvil: si ves Aske Stream, es buena. Debe empezar por https://.
- **«Esa clave no es válida»**: cópiala y pégala de nuevo, sin espacios al principio ni al final.
- **«Tu servidor responde, pero no deja entrar a la app»**: el servidor tiene una versión antigua; quien lo montó tiene que actualizarlo.

Mira también [[cloudflare-connect|dónde encontrar la dirección y la clave]].`,
      en: `The app tells you what happened:
- **“There is no internet connection”**: check Wi-Fi or mobile data.
- **“Your server could not be found at that address”**: the address is mistyped. Open it in the phone browser: if you see Aske Stream, it is right. It must start with https://.
- **“That key is not valid”**: copy and paste it again, with no spaces at the start or end.
- **“Your server answers but does not let the app in”**: the server runs an old version; whoever set it up needs to update it.

See also [[cloudflare-connect|where to find the address and the key]].`,
      eu: `Aplikazioak zer gertatu den esaten dizu:
- **«Ez dago Interneteko konexiorik»**: begiratu Wi-Fia edo datuak.
- **«Ez da zure zerbitzaria aurkitu helbide horretan»**: helbidea gaizki idatzita dago. Ireki mugikorreko nabigatzailean: Aske Stream ikusten baduzu, ona da. https:// hasi behar da.
- **«Gako hori ez da baliozkoa»**: kopiatu eta itsatsi berriro, hasieran edo amaieran zuriunerik gabe.
- **«Zure zerbitzariak erantzuten du, baina ez dio aplikazioari sartzen uzten»**: zerbitzariak bertsio zaharra du; prestatu zuenak eguneratu behar du.

Ikusi baita ere [[cloudflare-connect|non aurkitu helbidea eta gakoa]].`,
    },
  },
  {
    id: 'radio-no-sound',
    section: 'problems',
    title: {
      es: 'Una emisora no suena',
      en: 'A station does not play',
      eu: 'Irrati batek ez du jotzen',
    },
    body: {
      es: `- La radio necesita internet.
- Algunas emisoras dejan de emitir o cambian de dirección: prueba otra con el mismo nombre en la lista.
- Las emisoras con conexión antigua (http://) **no suenan en el navegador**, pero sí en la app de Android.
- Si la añadiste tú con un enlace, comprueba que es el enlace del sonido y no el de la página web de la emisora.`,
      en: `- Radio needs internet.
- Some stations stop broadcasting or change address: try another one with the same name in the list.
- Stations with an old kind of connection (http://) **do not play in the browser**, but they do in the Android app.
- If you added it yourself with a link, check it is the audio link and not the station’s web page.`,
      eu: `- Irratiak Internet behar du.
- Irrati batzuek emititzeari uzten diote edo helbidez aldatzen dira: probatu zerrendako izen bereko beste bat.
- Konexio zaharra duten irratiak (http://) **ez dira nabigatzailean entzuten**, baina Android aplikazioan bai.
- Zuk gehitu bazenuen esteka batekin, egiaztatu soinuaren esteka dela eta ez irratiaren webgunearena.`,
    },
  },
  {
    id: 'app-not-installed',
    section: 'problems',
    title: {
      es: '«Aplicación no instalada»',
      en: '“App not installed”',
      eu: '«Aplikazioa ez da instalatu»',
    },
    body: {
      es: `Android muestra este mensaje cuando no puede instalar el archivo. Lo más común:
- **Descargaste el archivo «armv7»**, que es para móviles antiguos de 32 bits. Descarga el que no lo lleva.
- **La app la instalaste desde otro sitio** (por ejemplo, una versión hecha por otra persona). Desinstálala e instala la oficial. Ojo: se borra la música guardada en el móvil.
- **No queda espacio** en el móvil.`,
      en: `Android shows this when it cannot install the file. Most often:
- **You downloaded the “armv7” file**, which is for old 32-bit phones. Download the one without it.
- **You installed the app from somewhere else** (for example, a version built by someone else). Uninstall it and install the official one. Careful: music stored on the phone is deleted.
- **There is no space left** on the phone.`,
      eu: `Androidek mezu hau erakusten du fitxategia ezin duenean instalatu. Ohikoenak:
- **«armv7» fitxategia deskargatu duzu**, 32 biteko mugikor zaharrentzat dena. Deskargatu hori ez daramana.
- **Aplikazioa beste nonbaitetik instalatu zenuen** (adibidez, beste norbaitek egindako bertsio bat). Desinstalatu eta instalatu ofiziala. Kontuz: mugikorrean gordetako musika ezabatzen da.
- **Ez dago lekurik** mugikorrean.`,
    },
  },

  /* ------------------------------ privacy ------------------------------ */
  {
    id: 'privacy',
    section: 'privacy',
    title: {
      es: '¿Quién puede ver mi música?',
      en: 'Who can see my music?',
      eu: 'Nork ikus dezake nire musika?',
    },
    body: {
      es: `Solo tú.
- **En este dispositivo**: la música no sale del móvil.
- **En tu Google Drive**: está en tu propia cuenta de Google, en una carpeta privada que no se comparte con nadie. La app solo puede ver los archivos que ella misma ha creado. Mira [[drive-privacy|qué puede ver la app]].
- **En tu Cloudflare**: está en tu propia cuenta, en un almacén privado. Solo entran los móviles u ordenadores que tienen tu clave. Nada es público.

Aske Stream no tiene anuncios, no vende datos y no envía tu música a nadie. La app solo habla con tu Google Drive o tu Cloudflare, con YouTube (para buscar y descargar), con el catálogo de radios y con GitHub (para buscar actualizaciones).

Si crees que alguien tiene tu clave, quien montó el servidor puede cambiarla: todos los dispositivos tendrán que conectarse otra vez.`,
      en: `Only you.
- **On this device**: the music never leaves the phone.
- **In your Google Drive**: it is in your own Google account, in a private folder shared with nobody. The app can only see the files it created itself. See [[drive-privacy|what the app can see]].
- **In your Cloudflare**: it is in your own account, in private storage. Only phones or computers with your key get in. Nothing is public.

Aske Stream has no ads, sells no data and sends your music to nobody. The app only talks to your Google Drive or your Cloudflare, to YouTube (to search and download), to the radio catalogue and to GitHub (to check for updates).

If you think someone has your key, whoever set up the server can change it: every device will have to connect again.`,
      eu: `Zuk bakarrik.
- **Gailu honetan**: musika ez da mugikorretik ateratzen.
- **Zure Google Drive-n**: zure Google kontu propioan dago, inorekin partekatzen ez den karpeta pribatu batean. Aplikazioak berak sortutako fitxategiak bakarrik ikus ditzake. Ikusi [[drive-privacy|zer ikus dezakeen aplikazioak]].
- **Zure Cloudflaren**: zure kontu propioan dago, biltegi pribatu batean. Zure gakoa duten mugikor edo ordenagailuak bakarrik sartzen dira. Ezer ez da publikoa.

Aske Streamek ez du iragarkirik, ez du daturik saltzen eta ez dio inori zure musika bidaltzen. Aplikazioak zure Google Drive edo Cloudflarerekin, YouTuberekin (bilatu eta deskargatzeko), irrati-katalogoarekin eta GitHubekin (eguneraketak bilatzeko) bakarrik hitz egiten du.

Norbaitek zure gakoa duela uste baduzu, zerbitzaria prestatu zuenak alda dezake: gailu guztiek berriro konektatu beharko dute.`,
    },
  },
  {
    id: 'legal',
    section: 'privacy',
    title: {
      es: '¿Puedo descargar cualquier cosa de YouTube?',
      en: 'Can I download anything from YouTube?',
      eu: 'YouTubeko edozer deskarga dezaket?',
    },
    body: {
      es: `Aske Stream está pensada para **uso personal**. Las condiciones de YouTube no permiten descargar vídeos salvo donde YouTube ofrece un botón para ello, y las leyes sobre copias privadas cambian de un país a otro.

Recomendaciones:
- Descarga música para escucharla tú, no para compartirla ni venderla.
- Si te gusta un artista, apóyale: conciertos, discos, Bandcamp…
- No subas a internet canciones descargadas.

Esto no es asesoramiento legal: si tienes dudas, consulta las leyes de tu país.`,
      en: `Aske Stream is meant for **personal use**. YouTube’s terms do not allow downloading videos except where YouTube offers a button for it, and laws on private copies differ from country to country.

Recommendations:
- Download music for yourself to listen to, not to share or sell.
- If you like an artist, support them: concerts, records, Bandcamp…
- Do not upload downloaded songs to the internet.

This is not legal advice: if in doubt, check the laws of your country.`,
      eu: `Aske Stream **erabilera pertsonalerako** pentsatuta dago. YouTuberen baldintzek ez dute bideoak deskargatzen uzten, YouTubek horretarako botoia eskaintzen duen kasuetan izan ezik, eta kopia pribatuei buruzko legeak herrialde batetik bestera aldatzen dira.

Gomendioak:
- Deskargatu musika zuk entzuteko, ez partekatzeko edo saltzeko.
- Artista bat gustuko baduzu, lagundu: kontzertuak, diskoak, Bandcamp…
- Ez igo Internetera deskargatutako abestirik.

Hau ez da aholkularitza juridikoa: zalantzarik baduzu, kontsultatu zure herrialdeko legeak.`,
    },
  },
];

export const articleById = (id: string) => ARTICLES.find((a) => a.id === id);

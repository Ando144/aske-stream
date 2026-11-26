import type { HelpArticle } from './types';

export const musicArticles: HelpArticle[] = [
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

Puedes cerrar la app mientras descarga: las canciones seguirán bajando y verás el progreso en las notificaciones. Si te quedas sin cobertura, las descargas se pausan y siguen solas cuando vuelva; no tienes que hacer nada. Si descargas durante muchas horas seguidas con la app cerrada, Android puede pausarlas; verás un aviso y seguirán solas al abrir Aske Stream. Lo que se baje con la app cerrada se guarda en tu biblioteca cuando la vuelvas a abrir.

La primera descarga tarda un poco más porque la app prepara el descargador.

**Cancelar o quitar:** la **X** cancela una descarga en cualquier momento, también mientras se está guardando; en ese caso no queda en tu biblioteca. Las que han fallado o has cancelado tienen dos botones: **Reintentar** y **Quitar de la lista** (la papelera).

**Audios largos:** un audio de una hora o más ocupa mucho y guardarlo en la nube puede tardar varios minutos; depende de tu conexión. Mientras tanto, las canciones normales se siguen guardando. Si la subida va demasiado lenta, la app la para: prueba con wifi y pulsa **Reintentar**. Con Cloudflare, los muy grandes se quedan solo en el móvil: mira [[cloudflare-big|audios de más de 95 MB]].

Las canciones que ya tienes aparecen como «Ya la tienes» y no se descargan dos veces.

Si pegas el enlace de una playlist en el móvil, puedes quitar canciones antes de descargar.`,
      en: `You do it in the **Android app**, in the **Download** tab.

1. Type a song, an artist or a playlist. You can also **paste a link** from YouTube or YouTube Music.
2. Choose what to search: **Songs** (from YouTube Music, with better titles and covers), **Videos** or **Playlists**.
3. Tap the download button. The song joins the queue and, when it finishes, appears in your Library with its title, artist and cover.

You can close the app while it downloads: the songs keep coming and progress shows in your notifications. If you lose signal, downloads pause and carry on by themselves when it comes back; you do not need to do anything. If you download for many hours in a row with the app closed, Android may pause them; you will see a notice and they will carry on by themselves when you open Aske Stream. Whatever downloads while the app is closed is saved to your library when you open it again.

The first download takes a bit longer because the app gets the downloader ready.

**Cancel or remove:** the **X** cancels a download at any moment, also while it is being saved; in that case it does not stay in your library. Failed or cancelled ones have two buttons: **Retry** and **Remove from the list** (the bin).

**Long audio:** audio lasting an hour or more is large, and saving it to the cloud can take several minutes; it depends on your connection. Meanwhile, normal songs keep being saved. If the upload is too slow, the app stops it: try on Wi-Fi and tap **Retry**. With Cloudflare, very large ones stay only on the phone: see [[cloudflare-big|audio over 95 MB]].

Songs you already have show “In library” and are never downloaded twice.

If you paste a playlist link on the phone, you can untick songs before downloading.`,
      eu: `**Android aplikazioan** egiten da, **Deskargatu** fitxan.

1. Idatzi abesti bat, artista bat edo zerrenda bat. YouTube edo YouTube Musiceko **esteka bat itsatsi** ere egin dezakezu.
2. Aukeratu zer bilatu: **Abestiak** (YouTube Musicetik, izenburu eta azal hobeekin), **Bideoak** edo **Zerrendak**.
3. Sakatu deskargatzeko botoia. Abestia ilarara sartzen da eta, amaitzean, zure Liburutegian agertzen da bere izenburu, artista eta azalarekin.

Deskargatzen ari den bitartean aplikazioa itxi dezakezu: abestiak jaisten jarraituko dute eta aurrerapena jakinarazpenetan ikusiko duzu. Estaldurarik gabe geratzen bazara, deskargak pausatu egiten dira eta bere kabuz jarraitzen dute estaldura itzultzean; ez duzu ezer egin beharrik. Aplikazioa itxita ordu askotan jarraian deskargatzen baduzu, Androidek pausatu ditzake; abisu bat ikusiko duzu eta bere kabuz jarraituko dute Aske Stream irekitzean. Aplikazioa itxita deskargatutakoa zure liburutegian gordetzen da berriro irekitzean.

Lehen deskargak pixka bat gehiago irauten du, aplikazioak deskargatzailea prestatzen duelako.

**Utzi edo kendu:** **X** botoiak deskarga bat edozein unetan uzten du, baita gordetzen ari den bitartean ere; orduan ez da zure liburutegian geratzen. Huts egin dutenek edo utzi dituzunek bi botoi dituzte: **Saiatu berriro** eta **Kendu zerrendatik** (zakarrontzia).

**Audio luzeak:** ordubeteko edo gehiagoko audio batek leku handia hartzen du, eta hodeian gordetzeak hainbat minutu behar ditzake; zure konexioaren araberakoa da. Bitartean, abesti arruntak gordetzen jarraitzen dute. Igoera motelegia bada, aplikazioak gelditu egiten du: saiatu wifiarekin eta sakatu **Saiatu berriro**. Cloudflarerekin, oso handiak mugikorrean bakarrik geratzen dira: ikusi [[cloudflare-big|95 MB baino gehiagoko audioak]].

Dagoeneko dituzun abestiek «Baduzu» jartzen dute eta ez dira bi aldiz deskargatzen.

Mugikorrean playlist baten esteka itsatsiz gero, abesti batzuk kendu ditzakezu deskargatu aurretik.`,
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

Se descargan de una en una. Una playlist de 100 canciones ocupa unos 400 MB y tarda un rato: puedes apagar la pantalla o cerrar la app. Si se va la cobertura, se pausan y siguen solas. Si descargas durante muchas horas seguidas con la app cerrada, Android puede pausarlas; verás un aviso y seguirán solas al abrir Aske Stream. Lo bajado con la app cerrada se guarda al abrirla.

Si ya tenías alguna canción, no se descarga otra vez, pero sí aparece en la playlist, en el mismo orden que en YouTube. Si ya tienes una playlist con ese nombre, la app te pregunta si prefieres juntarlas o crear otra.

Si el móvil para las descargas al apagar la pantalla, mira [[background|este artículo]].

Las playlists de Aske Stream admiten hasta 1.000 canciones.`,
      en: `1. In **Download**, choose **Playlists** and search, or paste the link of a YouTube or YouTube Music playlist.
2. Tap the playlist: you see its songs.
3. Leave **“Also create the playlist in your library”** ticked if you want it just like on YouTube.
4. Tap **Download N songs**.

They download one by one. A 100-song playlist takes about 400 MB and a while: you can switch the screen off or close the app. If signal drops, they pause and resume by themselves. If you download for many hours in a row with the app closed, Android may pause them; you will see a notice and they will carry on by themselves when you open Aske Stream. What downloads while the app is closed is saved when you open it.

If you already had some songs, they are not downloaded again, but they do appear in the playlist, in the same order as on YouTube. If you already have a playlist with that name, the app asks whether to merge them or create another one.

If your phone stops downloads when the screen is off, see [[background|this article]].

Aske Stream playlists hold up to 1,000 songs.`,
      eu: `1. **Deskargatu** atalean, aukeratu **Zerrendak** eta bilatu, edo itsatsi YouTube edo YouTube Musiceko zerrenda baten esteka.
2. Ukitu zerrenda: bere abestiak ikusiko dituzu.
3. Utzi markatuta **«Sortu zerrenda ere zure liburutegian»** YouTuben bezala izan nahi baduzu.
4. Sakatu **Deskargatu N abesti**.

Banan-banan deskargatzen dira. 100 abestiko zerrenda batek 400 MB inguru hartzen ditu eta denbora pixka bat behar du: pantaila itzali edo aplikazioa itxi dezakezu. Estaldura galtzen bada, pausatu egiten dira eta bere kabuz jarraitzen dute. Aplikazioa itxita ordu askotan jarraian deskargatzen baduzu, Androidek pausatu ditzake; abisu bat ikusiko duzu eta bere kabuz jarraituko dute Aske Stream irekitzean. Aplikazioa itxita deskargatutakoa irekitzean gordetzen da.

Abesti batzuk bazenituen jada, ez dira berriro deskargatzen, baina zerrendan agertzen dira, YouTuben duten ordena berean. Izen bereko zerrenda bat baduzu, aplikazioak galdetuko dizu batu nahi dituzun edo beste bat sortu.

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

En la lista **Enviado al móvil** del ordenador ves cómo va cada envío: «Esperando al móvil», «Descargando» o «Hecho».

¿No usas Cloudflare? Mira [[send-with-code|Enviar canciones al móvil con un código]].`,
      en: `If you use **your Cloudflare**, you can pick music on the computer and have the phone download it. (Browsers cannot download from YouTube; the phone app can.)

1. On the computer, open Aske Stream and go to **Download**.
2. Search or paste a YouTube link and tap **Send to phone**.
3. Next time you open the app on your phone (or within 5 minutes if it is already open), it downloads it and uploads it to your library.

The **Sent to phone** list on the computer shows how each one is going: “Waiting for phone”, “Downloading” or “Done”.

Do not use Cloudflare? See [[send-with-code|Sending songs to a phone with a code]].`,
      eu: `**Zure Cloudflare** erabiltzen baduzu, ordenagailuan musika aukeratu eta mugikorrak deskarga dezake. (Nabigatzaileek ezin dute YouTubetik deskargatu; mugikorreko aplikazioak bai.)

1. Ordenagailuan, ireki Aske Stream eta joan **Deskargatu** atalera.
2. Bilatu edo itsatsi YouTubeko esteka bat eta sakatu **Bidali mugikorrera**.
3. Mugikorrean aplikazioa irekitzen duzun hurrengoan (edo 5 minutu baino lehen irekita badago), deskargatu eta zure liburutegira igoko du.

Ordenagailuko **Mugikorrera bidalita** zerrendan bidalketa bakoitza nola doan ikusten duzu: «Mugikorraren zain», «Deskargatzen» edo «Eginda».

Ez duzu Cloudflare erabiltzen? Ikusi [[send-with-code|Abestiak mugikorrera kode batekin bidali]].`,
    },
  },
  {
    id: 'send-with-code',
    section: 'music',
    title: {
      es: 'Enviar canciones al móvil con un código',
      en: 'Sending songs to a phone with a code',
      eu: 'Abestiak mugikorrera kode batekin bidali',
    },
    body: {
      es: `Sirve para pasar canciones de YouTube a un móvil sin cables ni cuentas. Lo puedes usar:

- desde un **ordenador** con Google Drive o con «Este dispositivo» (con Cloudflare, mira [[send-to-phone|este artículo]]);
- desde **cualquier móvil** hacia otro móvil, por ejemplo el de un amigo.

Solo viajan los nombres de las canciones, nunca la música: el móvil que recibe las descarga por su cuenta.

**Enviar desde el ordenador**
1. Ve a **Descargar** y busca la canción.
2. Pulsa **Añadir a la lista para enviar** en cada canción que quieras.
3. Pulsa **Enviar al móvil**. Aparece un código QR y un código de 6 símbolos, como ABC-DEF.

**Enviar desde el móvil**
Elige uno de estos caminos:
1. **Una canción:** pulsa el menú ⋮ de la canción y elige **Enviar a otro móvil**. Saldrá un QR para que el otro móvil lo escanee.
2. **Varias canciones o playlists:** mantén pulsada una canción (o una playlist en **Playlists**) para elegir varias y pulsa **Enviar a otro móvil**.
3. **Una playlist entera:** pulsa el menú ⋮ de la playlist y elige **Enviar a otro móvil**.
4. **La cola:** abre el reproductor, entra en **Cola** y pulsa **Enviar la cola a otro móvil**.

Solo se envían las canciones que vienen de YouTube; las demás se dejan fuera y la app te avisa.

**Enviar una playlist entera**
1. En **Descargar**, pega el enlace de la playlist de YouTube.
2. Se marcan todas las canciones. Quita las que no quieras.
3. Pulsa **Enviar al móvil** y escanea el código.
4. En el móvil se crea una playlist con ese nombre. Si ya tienes una igual, se llamará «Nombre (2)».

Caben hasta 1.000 canciones. Las privadas o borradas se saltan y te avisamos. Los Mix de YouTube, «Me gusta» y «Ver más tarde» no se pueden enviar.

**Recibir**
1. En el móvil que recibe, ve a **Descargar** y pulsa **Recibir**.
2. Escanea el QR o escribe el código.
3. Las canciones pasan a tus descargas y acaban en tu biblioteca.

El código vale **una sola vez** y dura **24 horas**. Cuando el móvil recibe las canciones, el código se borra.

Si dice que el código **no existe**, ya lo ha usado alguien o está mal escrito: pide uno nuevo. Si dice que ha **caducado**, han pasado más de 24 horas: crea otro.`,
      en: `Use it to move YouTube songs to a phone with no cables and no accounts. You can use it:

- from a **computer** with Google Drive or “This device” (with Cloudflare, see [[send-to-phone|this article]]);
- from **any phone** to another phone, for example a friend's.

Only the names of the songs travel, never the music: the phone that receives them downloads them by itself.

**Sending from the computer**
1. Go to **Download** and search for the song.
2. Tap **Add to the list to send** on each song you want.
3. Tap **Send to phone**. A QR code and a 6-symbol code, like ABC-DEF, appear.

**Sending from a phone**
Pick one of these ways:
1. **One song:** tap the ⋮ menu of the song and choose **Send to another phone**. A QR appears for the other phone to scan.
2. **Several songs or playlists:** press and hold a song (or a playlist in **Playlists**) to pick several, then tap **Send to another phone**.
3. **A whole playlist:** tap the ⋮ menu of the playlist and choose **Send to another phone**.
4. **The queue:** open the player, go to **Queue** and tap **Send the queue to another phone**.

Only songs that come from YouTube are sent; the others are left out and the app tells you.

**Sending a whole playlist**
1. In **Download**, paste the link of the YouTube playlist.
2. All songs are ticked. Untick the ones you do not want.
3. Tap **Send to phone** and scan the code.
4. The phone creates a playlist with that name. If you already have one, it will be called “Name (2)”.

Up to 1,000 songs fit. Private or deleted ones are skipped and we tell you. YouTube Mixes, “Liked videos” and “Watch later” cannot be sent.

**Receiving**
1. On the phone that receives, go to **Download** and tap **Receive**.
2. Scan the QR or type the code.
3. The songs go to your downloads and end up in your library.

The code works **only once** and lasts **24 hours**. When the phone receives the songs, the code is deleted.

If it says the code **does not exist**, someone already used it or it is mistyped: ask for a new one. If it says it has **expired**, more than 24 hours have passed: create another.`,
      eu: `YouTubeko abestiak mugikor batera pasatzeko balio du, kablerik eta konturik gabe. Hauek erabil dezakete:

- Google Drive edo «Gailu hau» duen **ordenagailu** batek (Cloudflarerekin, ikusi [[send-to-phone|artikulu hau]]);
- **edozein mugikorrek** beste mugikor batera, adibidez lagun batenera.

Abestien izenak bakarrik bidaiatzen dute, inoiz ez musika: jasotzen duen mugikorrak bere kabuz deskargatzen ditu.

**Ordenagailutik bidali**
1. Joan **Deskargatu** atalera eta bilatu abestia.
2. Sakatu **Gehitu bidaltzeko zerrendara** nahi duzun abesti bakoitzean.
3. Sakatu **Bidali mugikorrera**. QR kode bat eta 6 ikurreko kode bat agertzen dira, ABC-DEF bezala.

**Mugikorretik bidali**
Aukeratu bideetako bat:
1. **Abesti bat:** sakatu abestiaren ⋮ menua eta aukeratu **Bidali beste mugikor batera**. QR bat agertuko da beste mugikorrak eskaneatzeko.
2. **Hainbat abesti edo playlist:** eutsi sakatuta abesti bati (edo **Playlistak** atalean playlist bati) hainbat aukeratzeko, eta sakatu **Bidali beste mugikor batera**.
3. **Playlist oso bat:** sakatu playlistaren ⋮ menua eta aukeratu **Bidali beste mugikor batera**.
4. **Ilara:** ireki erreproduzitzailea, sartu **Ilara** atalean eta sakatu **Bidali ilara beste mugikor batera**.

YouTubetik datozen abestiak bakarrik bidaltzen dira; besteak kanpoan geratzen dira eta aplikazioak abisatzen dizu.

**Playlist oso bat bidali**
1. **Deskargatu** atalean, itsatsi YouTubeko playlistaren esteka.
2. Abesti guztiak markatuta agertzen dira. Kendu nahi ez dituzunak.
3. Sakatu **Bidali mugikorrera** eta eskaneatu kodea.
4. Mugikorrean izen horrekin playlist bat sortzen da. Berdin bat baduzu, «Izena (2)» izango da.

1.000 abesti arte sartzen dira. Pribatuak edo ezabatuak saltatu egiten dira eta abisatuko dizugu. YouTubeko Mixak, «Gustuko bideoak» eta «Ikusteko geroago» ezin dira bidali.

**Jaso**
1. Jasotzen duen mugikorrean, joan **Deskargatu** atalera eta sakatu **Jaso**.
2. Eskaneatu QRa edo idatzi kodea.
3. Abestiak zure deskargetara pasatzen dira eta zure liburutegian amaitzen dute.

Kodeak **behin bakarrik** balio du eta **24 ordu** irauten ditu. Mugikorrak abestiak jasotzean, kodea ezabatzen da.

**Ez dagoela** esaten badu, norbaitek erabili du jada edo gaizki idatzita dago: eskatu berri bat. **Iraungi dela** esaten badu, 24 ordu baino gehiago pasa dira: sortu beste bat.`,
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
];

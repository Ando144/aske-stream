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

Las canciones que ya tienes aparecen como «Ya la tienes» y no se descargan dos veces.`,
      en: `You do it in the **Android app**, in the **Download** tab.

1. Type a song, an artist or a playlist. You can also **paste a link** from YouTube or YouTube Music.
2. Choose what to search: **Songs** (from YouTube Music, with better titles and covers), **Videos** or **Playlists**.
3. Tap the download button. The song joins the queue and, when it finishes, appears in your Library with its title, artist and cover.

You can close the app while it downloads: the songs keep coming and progress shows in your notifications. If you lose signal, downloads pause and carry on by themselves when it comes back; you do not need to do anything. If you download for many hours in a row with the app closed, Android may pause them; you will see a notice and they will carry on by themselves when you open Aske Stream. Whatever downloads while the app is closed is saved to your library when you open it again.

The first download takes a bit longer because the app gets the downloader ready.

Songs you already have show “In library” and are never downloaded twice.`,
      eu: `**Android aplikazioan** egiten da, **Deskargatu** fitxan.

1. Idatzi abesti bat, artista bat edo zerrenda bat. YouTube edo YouTube Musiceko **esteka bat itsatsi** ere egin dezakezu.
2. Aukeratu zer bilatu: **Abestiak** (YouTube Musicetik, izenburu eta azal hobeekin), **Bideoak** edo **Zerrendak**.
3. Sakatu deskargatzeko botoia. Abestia ilarara sartzen da eta, amaitzean, zure Liburutegian agertzen da bere izenburu, artista eta azalarekin.

Deskargatzen ari den bitartean aplikazioa itxi dezakezu: abestiak jaisten jarraituko dute eta aurrerapena jakinarazpenetan ikusiko duzu. Estaldurarik gabe geratzen bazara, deskargak pausatu egiten dira eta bere kabuz jarraitzen dute estaldura itzultzean; ez duzu ezer egin beharrik. Aplikazioa itxita ordu askotan jarraian deskargatzen baduzu, Androidek pausatu ditzake; abisu bat ikusiko duzu eta bere kabuz jarraituko dute Aske Stream irekitzean. Aplikazioa itxita deskargatutakoa zure liburutegian gordetzen da berriro irekitzean.

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
];

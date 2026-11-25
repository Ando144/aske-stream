import type { HelpArticle } from './types';

export const friendsArticles: HelpArticle[] = [
  {
    id: 'share-playlist',
    section: 'friends',
    title: {
      es: 'Compartir una playlist con un amigo',
      en: 'Sharing a playlist with a friend',
      eu: 'Zerrenda bat lagun batekin partekatu',
    },
    body: {
      es: `Puedes mandar una playlist a un amigo con un enlace o un código QR. Él la abre en su Aske Stream y descarga las canciones.

**Qué se comparte:** solo la lista de canciones (los nombres), no la música. Tu amigo descarga cada canción de YouTube en su propio móvil.

1. En **Playlists**, pulsa **⋮** en la playlist que quieras y elige **Compartir** (también puedes abrir la playlist y pulsar **Compartir**).
2. Enseña el código QR a tu amigo o pulsa **Compartir enlace** para mandárselo.
3. Tu amigo abre el enlace, o en **Playlists → Con amigos** pulsa **Recibir** y pega el enlace o escanea el QR.
4. En la app de Android, él pulsa **Descargar en mi biblioteca**. En la web solo puede ver la lista: para descargar hay que abrir el enlace en la app de Android.

**Cuánto dura:** el enlace funciona 90 días. Si quieres que deje de funcionar antes, abre **Compartir** otra vez y pulsa **Dejar de compartir**.

**Qué no se comparte:** las canciones que no vienen de YouTube (por ejemplo, archivos que subiste desde tu ordenador). La pantalla te avisa con un mensaje como «2 canciones no se pueden compartir porque no vienen de YouTube».

**Si el enlace caduca:** si ves «Este enlace ha caducado. Los enlaces duran 90 días: pide a tu amigo uno nuevo.», pide a tu amigo que comparta la playlist otra vez. Si ves «Este enlace no existe. Quizá lo han borrado. Pide a tu amigo uno nuevo.», es que dejó de compartirla.`,
      en: `You can send a playlist to a friend with a link or a QR code. They open it in their Aske Stream and download the songs.

**What is shared:** only the list of songs (the names), not the music. Your friend downloads each song from YouTube onto their own phone.

1. In **Playlists**, tap **⋮** on the playlist you want and choose **Share** (you can also open the playlist and tap **Share**).
2. Show the QR code to your friend, or tap **Share link** to send it.
3. Your friend opens the link, or in **Playlists → With friends** taps **Receive** and pastes the link or scans the QR.
4. In the Android app, they tap **Download to my library**. On the web they can only see the list: to download, the link has to be opened in the Android app.

**How long it lasts:** the link works for 90 days. If you want it to stop working sooner, open **Share** again and tap **Stop sharing**.

**What is not shared:** songs that do not come from YouTube (for example, files you uploaded from your computer). The screen tells you with a message like “2 songs cannot be shared because they do not come from YouTube”.

**If the link expires:** if you see “This link has expired. Links last 90 days: ask your friend for a new one.”, ask your friend to share the playlist again. If you see “This link does not exist. Maybe it was deleted. Ask your friend for a new one.”, they stopped sharing it.`,
      eu: `Zerrenda bat lagun bati bidal diezaiokezu esteka edo QR kode batekin. Berak bere Aske Stream-en irekitzen du eta abestiak deskargatzen ditu.

**Zer partekatzen da:** abesti-zerrenda bakarrik (izenak), ez musika. Zure lagunak abesti bakoitza YouTubetik deskargatzen du bere telefonoan.

1. **Zerrendak** atalean, sakatu **⋮** nahi duzun zerrendan eta aukeratu **Partekatu** (zerrenda ireki eta **Partekatu** ere sakatu dezakezu).
2. Erakutsi QR kodea zure lagunari, edo sakatu **Partekatu esteka** bidaltzeko.
3. Zure lagunak esteka irekitzen du, edo **Zerrendak → Lagunekin** atalean **Jaso** sakatzen du eta esteka itsasten du edo QR kodea eskaneatzen du.
4. Android aplikazioan, **Deskargatu nire liburutegian** sakatzen du. Webean zerrenda ikus dezake bakarrik: deskargatzeko, esteka Android aplikazioan ireki behar da.

**Zenbat irauten du:** estekak 90 egun irauten du. Lehenago geldiarazi nahi baduzu, ireki **Partekatu** berriro eta sakatu **Utzi partekatzeari**.

**Zer ez da partekatzen:** YouTubetik ez datozen abestiak (adibidez, zure ordenagailutik igotako fitxategiak). Pantailak abisatzen dizu honelako mezu batekin: «2 abesti ezin dira partekatu YouTubetik ez datozelako».

**Esteka iraungitzen bada:** «Esteka hau iraungi da. Estekek 90 egun irauten dute: eskatu zure lagunari berri bat.» ikusten baduzu, eskatu zure lagunari zerrenda berriro partekatzeko. «Esteka hau ez da existitzen. Agian ezabatu dute. Eskatu zure lagunari berri bat.» ikusten baduzu, partekatzeari utzi dio.`,
    },
  },
  {
    id: 'jam',
    section: 'friends',
    title: {
      es: 'Jam: escuchar música juntos',
      en: 'Jam: listening together',
      eu: 'Jam: musika elkarrekin entzun',
    },
    body: {
      es: `Una Jam es una cola de canciones compartida. Cada amigo añade y vota canciones desde su móvil, y suenan en el móvil del anfitrión.

**Quién la pone a sonar:** solo suena el móvil del anfitrión. Los demás no oyen nada en su móvil: ponen canciones y votan. Las canciones con más votos suenan antes.

**Para ser anfitrión** (solo en la app de Android):
1. Ve a **Jam** (en el móvil, desde **Playlists** pulsa **Jam**) y escribe tu nombre.
2. Pulsa **Empezar una Jam**.
3. Enseña el código QR o el código de 6 letras a tus amigos.

**Para entrar:**
1. Escanea el código QR con la cámara o con el botón **Escanear código QR**, o abre el enlace que te manden. No hace falta configurar nada.
2. Si te dan un código, escríbelo en **Unirme a una Jam**.
3. Pulsa **Añadir canción**, busca una y listo. Con el corazón votas las que te gustan.

**Cuánto dura:** una Jam dura 12 horas. Después caduca sola.

**Dónde quedan las canciones:** las canciones que se añaden se descargan en el móvil del anfitrión y se guardan en una playlist suya llamada «Jam dd/mm» (con la fecha).

**Límites:** cada persona puede tener hasta 10 canciones esperando a la vez. Cuando suene alguna, podrá añadir más.

**Si no se conecta:** revisa que tengas internet y vuelve a entrar. Si ves «Esta Jam no existe», revisa el código. Si dice que ha terminado, el anfitrión la cerró o pasaron 12 horas: pídele que empiece otra.`,
      en: `A Jam is a shared song queue. Each friend adds and votes for songs from their own phone, and they play on the host's phone.

**Who plays the music:** only the host's phone plays. Everyone else hears nothing on their phone: they add songs and vote. The songs with more votes play first.

**To be the host** (Android app only):
1. Go to **Jam** (on a phone, tap **Jam** inside **Playlists**) and write your name.
2. Tap **Start a Jam**.
3. Show the QR code or the 6-letter code to your friends.

**To join:**
1. Scan the QR code with the camera or with the **Scan QR code** button, or open the link you were sent. You do not need to set anything up.
2. If you were given a code, type it in **Join a Jam**.
3. Tap **Add a song**, find one and that is it. Use the heart to vote for the ones you like.

**How long it lasts:** a Jam lasts 12 hours. After that it expires by itself.

**Where the songs end up:** the songs people add are downloaded to the host's phone and saved in a playlist of theirs called “Jam dd/mm” (with the date).

**Limits:** each person can have up to 10 songs waiting at once. When one plays, they can add more.

**If it does not connect:** check your internet and join again. If you see “This Jam does not exist”, check the code. If it says it has ended, the host closed it or 12 hours went by: ask them to start another.`,
      eu: `Jam bat abesti-ilara partekatu bat da. Lagun bakoitzak bere telefonotik abestiak gehitu eta bozkatzen ditu, eta antolatzailearen telefonoan jotzen dira.

**Nork jotzen duen:** antolatzailearen telefonoak bakarrik jotzen du. Besteek ez dute ezer entzuten beren telefonoan: abestiak jarri eta bozkatzen dituzte. Boto gehien dituzten abestiak lehenago jotzen dira.

**Antolatzailea izateko** (Android aplikazioan bakarrik):
1. Joan **Jam** atalera (telefonoan, **Zerrendak** atalean sakatu **Jam**) eta idatzi zure izena.
2. Sakatu **Hasi Jam bat**.
3. Erakutsi QR kodea edo 6 letrako kodea zure lagunei.

**Sartzeko:**
1. Eskaneatu QR kodea kamerarekin edo **Eskaneatu QR kodea** botoiarekin, edo ireki bidali dizuten esteka. Ez duzu ezer konfiguratu behar.
2. Kode bat eman badizute, idatzi **Sartu Jam batean** atalean.
3. Sakatu **Gehitu abestia**, bilatu bat eta listo. Bihotzarekin gustuko dituzunak bozkatzen dituzu.

**Zenbat irauten du:** Jam batek 12 ordu irauten du. Gero berez iraungitzen da.

**Non geratzen diren abestiak:** gehitzen diren abestiak antolatzailearen telefonora deskargatzen dira eta bere «Jam ee/hh» (dataz) zerrenda batean gordetzen dira.

**Mugak:** pertsona bakoitzak 10 abesti izan ditzake zain aldi berean. Bat jotzen denean, gehiago gehitu ahalko ditu.

**Konektatzen ez bada:** egiaztatu zure internet eta sartu berriro. «Jam hau ez da existitzen» ikusten baduzu, egiaztatu kodea. Amaitu dela badio, antolatzaileak itxi du edo 12 ordu pasa dira: eskatu beste bat hasteko.`,
    },
  },
];

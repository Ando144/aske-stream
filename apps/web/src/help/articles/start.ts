import type { HelpArticle } from './types';

export const startArticles: HelpArticle[] = [
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
    id: 'storage-copy',
    section: 'start',
    title: {
      es: 'Copiar tu música a otro sitio',
      en: 'Copying your music to another place',
      eu: 'Zure musika beste leku batera kopiatu',
    },
    body: {
      es: `Cuando cambias de almacenamiento (por ejemplo, de **Este dispositivo** a **Google Drive**) y en el sitio anterior había música, la app te pregunta si quieres copiarla al nuevo. También puedes hacerlo cuando quieras en **Ajustes → Copiar música de otro sitio**.

**Se puede copiar en las 6 direcciones:** de Este dispositivo a Google Drive o a Cloudflare, de Google Drive a Este dispositivo o a Cloudflare, y de Cloudflare a Este dispositivo o a Google Drive.

**Qué se copia:** las canciones con sus portadas y tus «me gusta», tus playlists (de como mucho 1.000 canciones) con sus carpetas y sus fotos, y tus radios favoritas.

**Qué no pasa:**
- **No se borra nada** del sitio de origen. Si vuelves a elegirlo, todo sigue ahí.
- **Lo que ya está se salta.** Si una canción ya existe en el sitio nuevo, no se copia dos veces.

**Mientras copia:**
1. Conéctate a un Wi-Fi (son muchos megas).
2. Deja la app abierta con la pantalla encendida. Verás «X de Y».
3. Pulsa **Cancelar** cuando quieras. Al pulsar **Seguir**, continúa por donde iba.

**Cloudflare:** tiene un límite de 10 GB y **solo admite Opus** (el formato de las canciones de YouTube). Las canciones en MP3, M4A, FLAC… no se copian a Cloudflare: siguen donde estaban y al final la app te dice cuántas se han saltado. Si no hay espacio suficiente, te avisa antes de empezar.

Si algo se corta (internet, o Google te pide volver a conectar), la copia se pausa y puedes seguir después. Mira también [[drive-connect|cómo conectar tu Drive]].`,
      en: `When you switch storage (for example, from **This device** to **Google Drive**) and the previous place had music, the app asks whether you want to copy it to the new one. You can also do it any time in **Settings → Copy music from another place**.

**It works in all 6 directions:** from This device to Google Drive or Cloudflare, from Google Drive to This device or Cloudflare, and from Cloudflare to This device or Google Drive.

**What is copied:** songs with their covers and your likes, your playlists (up to 1,000 songs each) with their folders and photos, and your favourite radio stations.

**What does not happen:**
- **Nothing is deleted** from the place you copy from. If you choose it again, everything is still there.
- **What is already there is skipped.** If a song already exists in the new place, it is not copied twice.

**While it copies:**
1. Connect to Wi-Fi (it is a lot of data).
2. Keep the app open with the screen on. You will see "X of Y".
3. Tap **Cancel** at any time. When you tap **Continue**, it picks up where it left off.

**Cloudflare:** it has a 10 GB limit and **only accepts Opus** (the format of YouTube songs). MP3, M4A, FLAC… songs are not copied to Cloudflare: they stay where they were and at the end the app tells you how many were skipped. If there is not enough space, it warns you before starting.

If something is interrupted (internet, or Google asks you to reconnect), the copy pauses and you can continue later. See also [[drive-connect|how to connect your Drive]].`,
      eu: `Biltegiratzea aldatzen duzunean (adibidez, **Gailu hau** aukeratik **Google Drive**-ra) eta aurreko lekuan musika bazegoen, aplikazioak galdetzen dizu berrira kopiatu nahi duzun. Nahi duzunean ere egin dezakezu **Ezarpenak → Kopiatu musika beste leku batetik** atalean.

**6 norabidetan kopia daiteke:** Gailu hautik Google Drive-ra edo Cloudflare-ra, Google Drive-tik Gailu hautara edo Cloudflare-ra, eta Cloudflare-tik Gailu hautara edo Google Drive-ra.

**Zer kopiatzen den:** abestiak azalekin eta zure «gustuko»ekin, zure zerrendak (gehienez 1.000 abestikoak) karpeta eta argazkiekin, eta zure irrati gogokoenak.

**Zer ez den gertatzen:**
- **Ez da ezer ezabatzen** jatorrizko lekutik. Berriro aukeratzen baduzu, dena hor dago.
- **Dagoena saltatu egiten da.** Abesti bat leku berrian badago, ez da bi aldiz kopiatzen.

**Kopiatzen ari den bitartean:**
1. Konektatu Wi-Fi batera (datu asko dira).
2. Utzi aplikazioa irekita pantaila piztuta duela. «X / Y» ikusiko duzu.
3. Sakatu **Utzi** nahi duzunean. **Jarraitu** sakatzean, utzitako lekutik segitzen du.

**Cloudflare:** 10 GBko muga du eta **Opus soilik onartzen du** (YouTubeko abestien formatua). MP3, M4A, FLAC… abestiak ez dira Cloudflare-ra kopiatzen: dauden lekuan geratzen dira, eta amaieran aplikazioak zenbat saltatu diren esaten dizu. Leku nahikorik ez badago, hasi aurretik abisatzen du.

Zerbait eten bada (Internet, edo Google-k berriro konektatzeko eskatzen badu), kopia pausatu egiten da eta gero jarraitu dezakezu. Ikusi ere [[drive-connect|nola konektatu zure Drive]].`,
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
];

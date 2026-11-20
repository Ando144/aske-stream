import type { HelpArticle } from './types';

export const cloudflareArticles: HelpArticle[] = [
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

Más fácil: si ya tienes un dispositivo vinculado, no necesitas la clave. Mira [[link-device|Vincular otro dispositivo con un QR o un código]].

Consejo: mándate la clave a ti mismo por un medio privado y cópiala y pégala en el móvil, en vez de escribirla.

Para desconectar un dispositivo: **Ajustes → Desconectar de Cloudflare**.`,
      en: `You need two things, and they are only asked once on each phone or computer:

1. **The address** of your Aske Stream. It looks like **https://aske-stream.your-name.workers.dev**. It is shown at the end of the setup.
2. **The key**: a long secret phrase created during setup.

Where are they? Whoever set up your Cloudflare has them. If it was you, the project folder has a file called **.env**: open it with Notepad and look for the **ASKE_URL** (address) and **ASKE_ACCESS_KEY** (key) lines.

Easier: if you already have a linked device, you do not need the key. See [[link-device|Linking another device with a QR or a code]].

Tip: send the key to yourself privately and copy-paste it on the phone instead of typing it.

To disconnect a device: **Settings → Disconnect from Cloudflare**.`,
      eu: `Bi gauza behar dituzu, eta behin bakarrik eskatzen dira mugikor edo ordenagailu bakoitzean:

1. Zure Aske Streamen **helbidea**. Itxura hau du: **https://aske-stream.zure-izena.workers.dev**. Instalazioaren amaieran agertzen da.
2. **Gakoa**: instalatzean sortzen den esaldi luze eta sekretu bat.

Non daude? Zure Cloudflare prestatu zuenak ditu. Zu izan bazinen, proiektuaren karpetan **.env** izeneko fitxategi bat dago: ireki Ohar-blokearekin eta bilatu **ASKE_URL** (helbidea) eta **ASKE_ACCESS_KEY** (gakoa) lerroak.

Errazagoa: dagoeneko gailu bat lotuta baduzu, ez duzu gakorik behar. Ikusi [[link-device|Beste gailu bat QR edo kode batekin lotu]].

Aholkua: bidali gakoa zeure buruari bide pribatu batetik eta kopiatu eta itsatsi mugikorrean, idatzi beharrean.

Gailu bat deskonektatzeko: **Ezarpenak → Deskonektatu Cloudflaretik**.`,
    },
  },
  {
    id: 'link-device',
    section: 'cloudflare',
    title: {
      es: 'Vincular otro dispositivo con un QR o un código',
      en: 'Linking another device with a QR or a code',
      eu: 'Beste gailu bat QR edo kode batekin lotu',
    },
    body: {
      es: `Si ya tienes tu Aske Stream en un dispositivo, puedes vincular otro sin buscar la clave.

**En el dispositivo que ya funciona:** ve a **Ajustes → Vincular otro dispositivo**. Verás un código QR y un código corto de 8 letras y números.

- **Móvil Android:** en la pantalla de entrada pulsa **Escanear código QR** y apunta al QR. También puedes escanearlo con la cámara del móvil: abre la web y se vincula sola.
- **Ordenador:** escribe el código corto en la pantalla de entrada (da igual si usas mayúsculas, minúsculas o guion).

El código **caduca a los 10 minutos** y **sirve una sola vez**. Si caduca o falla, crea otro. Tras 5 intentos fallidos también deja de valer.

**Si el escáner no se abre:** en algunos móviles falta una actualización de Google Play. Escribe el código corto, o pega el enlace que te da el botón **Compartir enlace**.

No compartas el QR ni el código con nadie que no quieras que entre en tu música.`,
      en: `If you already have your Aske Stream on one device, you can link another one without looking for the key.

**On the device that already works:** go to **Settings → Link another device**. You will see a QR code and a short code of 8 letters and numbers.

- **Android phone:** on the entry screen tap **Scan QR code** and point at the QR. You can also scan it with the phone camera: it opens the web and links by itself.
- **Computer:** type the short code on the entry screen (capitals, lower case or dashes do not matter).

The code **expires after 10 minutes** and **works only once**. If it expires or fails, create another one. After 5 wrong tries it stops working too.

**If the scanner does not open:** some phones are missing a Google Play update. Type the short code, or paste the link given by the **Share link** button.

Do not share the QR or the code with anyone you do not want inside your music.`,
      eu: `Zure Aske Stream gailu batean badaukazu, beste bat lot dezakezu gakoa bilatu gabe.

**Dagoeneko dabilen gailuan:** joan **Ezarpenak → Lotu beste gailu bat** atalera. QR kode bat eta 8 letra eta zenbakiko kode labur bat ikusiko dituzu.

- **Android mugikorra:** sarrera-pantailan sakatu **Eskaneatu QR kodea** eta zuzendu QRra. Mugikorreko kamerarekin ere eskaneatu dezakezu: webgunea irekitzen da eta berez lotzen da.
- **Ordenagailua:** idatzi kode laburra sarrera-pantailan (berdin dio maiuskulak, minuskulak edo gidoia erabiltzen badituzu).

Kodeak **10 minutuan iraungitzen da** eta **behin bakarrik balio du**. Iraungitzen bada edo huts egiten badu, sortu beste bat. 5 saiakera okerren ondoren ere ez du balio.

**Eskanerra irekitzen ez bada:** mugikor batzuek Google Playren eguneraketa bat falta dute. Idatzi kode laburra, edo itsatsi **Partekatu esteka** botoiak ematen duen esteka.

Ez partekatu QRa edo kodea zure musikan sartzea nahi ez duzun inorekin.`,
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
];

import type { HelpArticle } from './types';

export const androidArticles: HelpArticle[] = [
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
];

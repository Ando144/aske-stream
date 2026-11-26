import type { HelpArticle } from './types';

export const driveArticles: HelpArticle[] = [
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

- Aplikazioak **Aske Stream** izeneko karpeta bat sortzen du zure Drive-n. Barruan zure abestiak (**audio** karpeta), azalak (**covers**) eta zure zerrendak, «gustuko»ak eta irratiak dituen **library.json** fitxategia daude.
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

- Google dice que la app no está verificada: es normal, mira [[drive-warning|qué hacer con el aviso de Google]].

Si ya tenías música guardada en este dispositivo, mira [[storage-copy|cómo copiarla a Drive]].`,
      en: `1. On the **Where shall we keep your music?** screen (or in **Settings → Where your music is stored → Change**), tap **Connect with Google** on the Google Drive option.
2. A Google window opens. Pick your account (or type your email and password if it is not listed).
3. Google tells you Aske Stream wants to **see, edit, create and delete only the specific Google Drive files you use with this app**. Tap **Continue** or **Allow**.
4. Done: you are back in the app and can download or import music.

**In the Android app** you are asked only once. **In the computer's browser**, Google gives permission for one hour; when it runs out, **Reconnect** appears at the top: tap it and keep listening.

**If something goes wrong:**
- "You closed the Google window…": tap Connect with Google again and finish the steps.
- The browser blocks the window: allow pop-ups for this page (there is usually a notice in the address bar).
- "This copy of the app is not registered with Google": it is not your fault; tell whoever gave you the app.

- Google says the app is not verified: this is normal, see [[drive-warning|what to do about Google's warning]].

If you already had music saved on this device, see [[storage-copy|how to copy it to Drive]].`,
      eu: `1. **Non gordeko dugu zure musika?** pantailan (edo **Ezarpenak → Non gordetzen den zure musika → Aldatu** atalean), sakatu **Google-ekin konektatu** Google Drive aukeran.
2. Google-ren leiho bat irekiko da. Aukeratu zure kontua (edo idatzi zure posta eta pasahitza agertzen ez bada).
3. Google-k esango dizu Aske Streamek **aplikazio honekin erabiltzen dituzun Google Drive-ko fitxategiak bakarrik ikusi, editatu, sortu eta ezabatu** nahi dituela. Sakatu **Jarraitu** edo **Baimendu**.
4. Eginda: aplikaziora itzultzen zara eta musika deskargatu edo inportatu dezakezu.

**Android aplikazioan** behin bakarrik eskatzen da. **Ordenagailuko nabigatzailean**, Google-k ordubeteko baimena ematen du; amaitzean, goian **Berriro konektatu** agertzen da: sakatu eta jarraitu entzuten.

**Zerbaitek huts egiten badu:**
- «Google-ren leihoa itxi duzu…»: sakatu berriro Google-ekin konektatu eta amaitu urratsak.
- Nabigatzaileak leihoa blokeatzen du: baimendu leiho gainerakorrak orri honetan (helbide-barran abisu bat agertu ohi da).
- «Aplikazioaren kopia hau ez dago Google-n erregistratuta»: ez da zure errua; esan aplikazioa eman dizunari.

- Google-k aplikazioa egiaztatu gabe dagoela dio: normala da, ikusi [[drive-warning|zer egin Google-ren abisuarekin]].

Gailu honetan musika gordeta bazenuen, ikusi [[storage-copy|nola kopiatu Drive-ra]].`,
    },
  },
  {
    id: 'drive-warning',
    section: 'drive',
    title: {
      es: 'Google dice que la app no está verificada',
      en: 'Google says the app is not verified',
      eu: 'Google-k dio aplikazioa ez dagoela egiaztatuta',
    },
    body: {
      es: `**Qué pantalla sale.** Al conectar tu Drive, Google puede mostrar un aviso que dice **«Aske Stream no ha completado el proceso de verificación»** o **«Google no ha verificado esta aplicación»**.

**Por qué sale.** Que Google verifique una app cuesta trámites y dinero, y Aske Stream es gratuita y de código abierto. El aviso aparece con cualquier app que no ha pasado ese trámite.

**Por qué es seguro.** La app solo pide el permiso **drive.file**: únicamente ve los archivos que ella misma crea (la carpeta Aske Stream). No puede ver tus documentos ni tus fotos. Puedes quitarlo cuando quieras en [Aplicaciones con acceso a tu cuenta](https://myaccount.google.com/connections).

**Cómo seguir:**
1. Pulsa **Configuración avanzada**.
2. Pulsa **Ir a Aske Stream (no seguro)**.
3. Pulsa **Continuar**.

**Si sale «Error 403: access_denied» o dice que la app está en pruebas:** no es culpa tuya. Avisa a quien te pasó la app para que lo arregle.

Después mira [[drive-connect|cómo conectar tu Drive]].`,
      en: `**Which screen appears.** When you connect your Drive, Google may show a warning that says **"Aske Stream hasn't completed the verification process"** or **"Google hasn't verified this app"**.

**Why it appears.** Having Google verify an app takes paperwork and money, and Aske Stream is free and open source. The warning shows up for any app that has not gone through that process.

**Why it is safe.** The app only asks for the **drive.file** permission: it only sees the files it creates itself (the Aske Stream folder). It cannot see your documents or photos. You can remove it at any time in [Apps with access to your account](https://myaccount.google.com/connections).

**How to continue:**
1. Tap **Advanced**.
2. Tap **Go to Aske Stream (unsafe)**.
3. Tap **Continue**.

**If you see "Error 403: access_denied" or it says the app is in testing:** it is not your fault. Tell whoever gave you the app so they can fix it.

Then see [[drive-connect|how to connect your Drive]].`,
      eu: `**Zer pantaila ateratzen den.** Zure Drive konektatzean, Google-k abisu bat erakutsi dezake: **«Aske Stream-ek ez du egiaztapen-prozesua osatu»** edo **«Google-k ez du aplikazio hau egiaztatu»**.

**Zergatik ateratzen den.** Google-k aplikazio bat egiaztatzeak izapideak eta dirua eskatzen ditu, eta Aske Stream doakoa eta kode irekikoa da. Abisua izapide hori pasatu ez duen edozein aplikaziorekin ateratzen da.

**Zergatik den segurua.** Aplikazioak **drive.file** baimena bakarrik eskatzen du: berak sortzen dituen fitxategiak bakarrik ikusten ditu (Aske Stream karpeta). Ezin ditu zure dokumentuak edo argazkiak ikusi. Nahi duzunean kendu dezakezu [Zure kontura sarbidea duten aplikazioak](https://myaccount.google.com/connections) orrian.

**Nola jarraitu:**
1. Sakatu **Aurreratuak**.
2. Sakatu **Joan Aske Stream-era (ez da segurua)**.
3. Sakatu **Jarraitu**.

**«Error 403: access_denied» ateratzen bada edo aplikazioa probetan dagoela esaten badu:** ez da zure errua. Esan aplikazioa eman dizunari, konpon dezan.

Gero ikusi [[drive-connect|nola konektatu zure Drive]].`,
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
];

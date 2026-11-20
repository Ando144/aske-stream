/** Texts for the Cloudflare setup assistant and the server update. English is the source. */
export const cloudflareSetupEn = {
  'cfsetup.title': 'Set up your own server',
  'cfsetup.updateTitle': 'Update your server',
  'cfsetup.back': 'Back',
  'cfsetup.next': 'Continue',
  'cfsetup.cancel': 'Cancel',
  'cfsetup.help': 'Need help?',
  'cfsetup.pairLink': 'Do not have your Cloudflare yet? Set it up now',
  'cfsetup.pairWebOnly': 'To set it up you need the Android app.',
  'cfsetup.intro.what':
    'We will set up your own private server on Cloudflare. Your music is stored in your own space and only you decide who can use it.',
  'cfsetup.intro.free': 'It is free up to 10 GB of music.',
  'cfsetup.intro.card':
    'Cloudflare asks for a card to create the account, but it does not charge you.',
  'cfsetup.intro.time':
    'It takes about 10 minutes. You will go to the Cloudflare website and come back here.',
  'cfsetup.intro.start': 'Start',
  'cfsetup.updateIntro.what':
    'Your server will get the latest version. Your music and playlists are not touched.',
  'cfsetup.updateIntro.time':
    'You will need to create a temporary key, like the first time. It takes about 3 minutes.',
  'cfsetup.account.title': 'Create your Cloudflare account',
  'cfsetup.account.text':
    'Open Cloudflare, create a free account and confirm your email. Then come back to this app.',
  'cfsetup.account.open': 'Open Cloudflare',
  'cfsetup.account.have': 'I already have an account',
  'cfsetup.r2.title': 'Turn on file storage',
  'cfsetup.r2.text':
    'Your songs are saved in a Cloudflare space called "R2". Open the page, press the button to turn it on and come back. It is not charged within the free limit.',
  'cfsetup.r2.open': 'Open Cloudflare storage',
  'cfsetup.r2.done': 'Done, continue',
  'cfsetup.token.title': 'Create a temporary key',
  'cfsetup.token.what':
    'A "token" is a temporary key that gives the app permission to set up your server. The app does not save it and you can delete it afterwards.',
  'cfsetup.token.open': 'Open the key page',
  'cfsetup.token.step1': 'Press "Continue to summary".',
  'cfsetup.token.step2': 'Press "Create token".',
  'cfsetup.token.step3': 'Press "Copy" and come back here.',
  'cfsetup.token.label': 'Paste the key here',
  'cfsetup.token.submit': 'Check and continue',
  'cfsetup.chooseAccount.title': 'Which account?',
  'cfsetup.chooseAccount.text':
    'Your key can use several Cloudflare accounts. Choose where to set up your server.',
  'cfsetup.subdomain.title': 'Choose your server name',
  'cfsetup.subdomain.text':
    'This name will be part of your server address. We suggest one, but you can change it. Use lowercase letters, numbers and hyphens.',
  'cfsetup.subdomain.label': 'Name',
  'cfsetup.subdomain.preview': 'Your address will be {address}',
  'cfsetup.subdomain.submit': 'Create my server',
  'cfsetup.existing.title': 'You already have a server',
  'cfsetup.existing.text':
    'There is already an Aske Stream server in this account. We can set it up again with this version. Your music is not deleted, but you will get a new access key, so your other devices (phone, tablet, computer) will have to be linked again. If you only want to update it, go back and use the "Update" button in Settings → "Your server".',
  'cfsetup.existing.confirm': 'Set it up again',
  'cfsetup.running.title': 'Setting up your server',
  'cfsetup.running.updateTitle': 'Updating your server',
  'cfsetup.running.text': 'Do not close the app. This can take a few minutes.',
  'cfsetup.step.account': 'Checking your account',
  'cfsetup.step.subdomain': 'Creating your address',
  'cfsetup.step.database': 'Creating the database',
  'cfsetup.step.storage': 'Preparing the file storage',
  'cfsetup.step.migrations': 'Updating the database',
  'cfsetup.step.files': 'Uploading the app files',
  'cfsetup.step.worker': 'Installing the server',
  'cfsetup.step.publish': 'Publishing it',
  'cfsetup.step.waiting': 'Waiting for it to start',
  'cfsetup.done.title': 'All ready',
  'cfsetup.done.updateTitle': 'Server updated',
  'cfsetup.done.text':
    'Your server is ready and this phone is already connected. You can delete the temporary key now.',
  'cfsetup.done.updateText':
    'Your server has the latest version. You can delete the temporary key.',
  'cfsetup.done.deleteToken': 'Delete the temporary key',
  'cfsetup.done.finish': 'Finish',
  'cfsetup.error.title': 'Something went wrong',
  'cfsetup.error.retry': 'Try again',
  'cfsetup.error.waitRetry': 'Check again',
  'cfsetup.error.goR2': 'Turn on storage',
  'cfsetup.error.goToken': 'Create the key again',
  'cfsetup.error.otherName': 'Choose another name',
  'cfsetup.error.invalid_token':
    'Cloudflare did not accept that key. Copy it again and make sure it is complete.',
  'cfsetup.error.missing_permission':
    'The key does not have all the permissions. Create it again following the steps.',
  'cfsetup.error.r2_not_enabled': 'File storage (R2) is not turned on in your account yet.',
  'cfsetup.error.subdomain_taken': 'That name is taken. Choose another one.',
  'cfsetup.error.subdomain_invalid':
    'That name is not valid. Use lowercase letters, numbers and hyphens.',
  'cfsetup.error.network': 'There is no connection. Check your internet and try again.',
  'cfsetup.error.rate_limited': 'Cloudflare is busy. Wait a minute and try again.',
  'cfsetup.error.not_found': 'Cloudflare did not find something it needs. Try again.',
  'cfsetup.error.unknown': 'Something unexpected happened. Try again in a few minutes.',
  'cfsetup.error.no_account': 'That key does not give access to any Cloudflare account.',
  'cfsetup.error.wrong_account':
    'That key belongs to another account, not the one that hosts your server.',
  'cfsetup.error.bundle_missing':
    'This app version does not include the server files. Install the latest app version.',
  'cfsetup.error.not_live_yet':
    'Your server is installed but is not responding yet. It can take a few minutes: check again.',
  'serverUpdate.title': 'Your server',
  'serverUpdate.versions': 'Server {server} · App {app}',
  'serverUpdate.unknownVersion': 'old version',
  'serverUpdate.outdated': 'Your server is out of date. Update it so everything works.',
  'serverUpdate.upToDate': 'Your server is up to date.',
  'serverUpdate.button': 'Update',
  'serverUpdate.webOnly': 'Update it from the Android app.',
  'serverUpdate.banner': 'Your server has an old version. Update it from Settings.',
  'serverUpdate.bannerOpen': 'Open Settings',
  'serverUpdate.dismiss': 'Close',
  'toast.serverOutdated':
    'Your server has an old version and does not support this yet. Your music is fine. Update it in Settings > Your server.',
} as const;

export const cloudflareSetupEs: Record<keyof typeof cloudflareSetupEn, string> = {
  'cfsetup.title': 'Monta tu propio servidor',
  'cfsetup.updateTitle': 'Actualiza tu servidor',
  'cfsetup.back': 'Atrás',
  'cfsetup.next': 'Continuar',
  'cfsetup.cancel': 'Cancelar',
  'cfsetup.help': '¿Necesitas ayuda?',
  'cfsetup.pairLink': '¿Aún no tienes tu Cloudflare? Móntalo ahora',
  'cfsetup.pairWebOnly': 'Para montarlo necesitas la app Android.',
  'cfsetup.intro.what':
    'Vamos a montar tu servidor privado en Cloudflare. Tu música se guarda en tu propio espacio y solo tú decides quién la usa.',
  'cfsetup.intro.free': 'Es gratis hasta 10 GB de música.',
  'cfsetup.intro.card': 'Cloudflare pide una tarjeta para crear la cuenta, pero no te cobra.',
  'cfsetup.intro.time': 'Se tarda unos 10 minutos. Irás a la web de Cloudflare y volverás aquí.',
  'cfsetup.intro.start': 'Empezar',
  'cfsetup.updateIntro.what':
    'Tu servidor recibirá la última versión. Tu música y tus playlists no se tocan.',
  'cfsetup.updateIntro.time':
    'Tendrás que crear una llave temporal, como la primera vez. Se tarda unos 3 minutos.',
  'cfsetup.account.title': 'Crea tu cuenta de Cloudflare',
  'cfsetup.account.text':
    'Abre Cloudflare, crea una cuenta gratis y confirma tu correo. Luego vuelve a esta app.',
  'cfsetup.account.open': 'Abrir Cloudflare',
  'cfsetup.account.have': 'Ya tengo cuenta',
  'cfsetup.r2.title': 'Activa el almacenamiento de archivos',
  'cfsetup.r2.text':
    'Tus canciones se guardan en un espacio de Cloudflare llamado "R2". Abre la página, pulsa el botón para activarlo y vuelve. Dentro del límite gratuito no se cobra.',
  'cfsetup.r2.open': 'Abrir almacenamiento de Cloudflare',
  'cfsetup.r2.done': 'Hecho, continuar',
  'cfsetup.token.title': 'Crea una llave temporal',
  'cfsetup.token.what':
    'Un "token" es una llave temporal que da permiso a la app para montar tu servidor. La app no la guarda y puedes borrarla después.',
  'cfsetup.token.open': 'Abrir la página de la llave',
  'cfsetup.token.step1': 'Pulsa "Continuar al resumen".',
  'cfsetup.token.step2': 'Pulsa "Crear token".',
  'cfsetup.token.step3': 'Pulsa "Copiar" y vuelve aquí.',
  'cfsetup.token.label': 'Pega aquí la llave',
  'cfsetup.token.submit': 'Comprobar y continuar',
  'cfsetup.chooseAccount.title': '¿Qué cuenta?',
  'cfsetup.chooseAccount.text':
    'Tu llave puede usar varias cuentas de Cloudflare. Elige dónde montar tu servidor.',
  'cfsetup.subdomain.title': 'Elige el nombre de tu servidor',
  'cfsetup.subdomain.text':
    'Este nombre formará parte de la dirección de tu servidor. Te sugerimos uno, pero puedes cambiarlo. Usa minúsculas, números y guiones.',
  'cfsetup.subdomain.label': 'Nombre',
  'cfsetup.subdomain.preview': 'Tu dirección será {address}',
  'cfsetup.subdomain.submit': 'Crear mi servidor',
  'cfsetup.existing.title': 'Ya tienes un servidor',
  'cfsetup.existing.text':
    'En esta cuenta ya hay un servidor de Aske Stream. Podemos montarlo de nuevo con esta versión. Tu música no se borra, pero tendrá una clave de acceso nueva, así que tus otros dispositivos (móvil, tablet, ordenador) tendrán que volver a vincularse. Si solo quieres actualizarlo, vuelve atrás y usa el botón «Actualizar» de Ajustes → «Tu servidor».',
  'cfsetup.existing.confirm': 'Montarlo de nuevo',
  'cfsetup.running.title': 'Montando tu servidor',
  'cfsetup.running.updateTitle': 'Actualizando tu servidor',
  'cfsetup.running.text': 'No cierres la app. Puede tardar unos minutos.',
  'cfsetup.step.account': 'Comprobando tu cuenta',
  'cfsetup.step.subdomain': 'Creando tu dirección',
  'cfsetup.step.database': 'Creando la base de datos',
  'cfsetup.step.storage': 'Preparando el almacenamiento',
  'cfsetup.step.migrations': 'Actualizando la base de datos',
  'cfsetup.step.files': 'Subiendo los archivos de la app',
  'cfsetup.step.worker': 'Instalando el servidor',
  'cfsetup.step.publish': 'Publicándolo',
  'cfsetup.step.waiting': 'Esperando a que arranque',
  'cfsetup.done.title': 'Todo listo',
  'cfsetup.done.updateTitle': 'Servidor actualizado',
  'cfsetup.done.text':
    'Tu servidor está listo y este móvil ya está conectado. Ya puedes borrar la llave temporal.',
  'cfsetup.done.updateText':
    'Tu servidor tiene la última versión. Puedes borrar la llave temporal.',
  'cfsetup.done.deleteToken': 'Borrar la llave temporal',
  'cfsetup.done.finish': 'Terminar',
  'cfsetup.error.title': 'Algo ha salido mal',
  'cfsetup.error.retry': 'Intentarlo de nuevo',
  'cfsetup.error.waitRetry': 'Comprobar otra vez',
  'cfsetup.error.goR2': 'Activar el almacenamiento',
  'cfsetup.error.goToken': 'Crear la llave otra vez',
  'cfsetup.error.otherName': 'Elegir otro nombre',
  'cfsetup.error.invalid_token':
    'Cloudflare no ha aceptado esa llave. Cópiala de nuevo y comprueba que está completa.',
  'cfsetup.error.missing_permission':
    'La llave no tiene todos los permisos. Créala de nuevo siguiendo los pasos.',
  'cfsetup.error.r2_not_enabled':
    'El almacenamiento de archivos (R2) todavía no está activado en tu cuenta.',
  'cfsetup.error.subdomain_taken': 'Ese nombre ya está en uso. Elige otro.',
  'cfsetup.error.subdomain_invalid': 'Ese nombre no es válido. Usa minúsculas, números y guiones.',
  'cfsetup.error.network': 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
  'cfsetup.error.rate_limited': 'Cloudflare está saturado. Espera un minuto e inténtalo de nuevo.',
  'cfsetup.error.not_found': 'Cloudflare no ha encontrado algo que necesita. Inténtalo de nuevo.',
  'cfsetup.error.unknown': 'Ha pasado algo inesperado. Inténtalo de nuevo en unos minutos.',
  'cfsetup.error.no_account': 'Esa llave no da acceso a ninguna cuenta de Cloudflare.',
  'cfsetup.error.wrong_account': 'Esa llave es de otra cuenta, no de la que aloja tu servidor.',
  'cfsetup.error.bundle_missing':
    'Esta versión de la app no incluye los archivos del servidor. Instala la última versión de la app.',
  'cfsetup.error.not_live_yet':
    'Tu servidor está instalado pero todavía no responde. Puede tardar unos minutos: vuelve a comprobar.',
  'serverUpdate.title': 'Tu servidor',
  'serverUpdate.versions': 'Servidor {server} · App {app}',
  'serverUpdate.unknownVersion': 'versión antigua',
  'serverUpdate.outdated': 'Tu servidor está desactualizado. Actualízalo para que todo funcione.',
  'serverUpdate.upToDate': 'Tu servidor está al día.',
  'serverUpdate.button': 'Actualizar',
  'serverUpdate.webOnly': 'Actualízalo desde la app Android.',
  'serverUpdate.banner': 'Tu servidor tiene una versión antigua. Actualízalo en Ajustes.',
  'serverUpdate.bannerOpen': 'Abrir Ajustes',
  'serverUpdate.dismiss': 'Cerrar',
  'toast.serverOutdated':
    'Tu servidor tiene una versión antigua y todavía no admite esto. Tu música está bien. Actualízalo en Ajustes > Tu servidor.',
};

export const cloudflareSetupEu: Record<keyof typeof cloudflareSetupEn, string> = {
  'cfsetup.title': 'Ezarri zure zerbitzari propioa',
  'cfsetup.updateTitle': 'Eguneratu zure zerbitzaria',
  'cfsetup.back': 'Atzera',
  'cfsetup.next': 'Jarraitu',
  'cfsetup.cancel': 'Utzi',
  'cfsetup.help': 'Laguntza behar duzu?',
  'cfsetup.pairLink': 'Oraindik ez duzu zure Cloudflare? Ezarri orain',
  'cfsetup.pairWebOnly': 'Ezartzeko Android aplikazioa behar duzu.',
  'cfsetup.intro.what':
    'Zure zerbitzari pribatua ezarriko dugu Cloudflare-n. Zure musika zure espazioan gordetzen da eta zuk bakarrik erabakitzen duzu nork erabil dezakeen.',
  'cfsetup.intro.free': 'Doakoa da 10 GB musikara arte.',
  'cfsetup.intro.card':
    'Cloudflare-k txartela eskatzen du kontua sortzeko, baina ez dizu kobratzen.',
  'cfsetup.intro.time':
    'Hamar minutu inguru behar dira. Cloudflare-ren webgunera joango zara eta hona itzuliko zara.',
  'cfsetup.intro.start': 'Hasi',
  'cfsetup.updateIntro.what':
    'Zure zerbitzariak azken bertsioa jasoko du. Zure musika eta zerrendak ez dira ukitzen.',
  'cfsetup.updateIntro.time':
    'Aldi baterako gako bat sortu beharko duzu, lehen aldian bezala. 3 minutu inguru behar dira.',
  'cfsetup.account.title': 'Sortu zure Cloudflare kontua',
  'cfsetup.account.text':
    'Ireki Cloudflare, sortu doako kontu bat eta berretsi zure posta. Gero itzuli aplikazio honetara.',
  'cfsetup.account.open': 'Ireki Cloudflare',
  'cfsetup.account.have': 'Badut kontua',
  'cfsetup.r2.title': 'Aktibatu fitxategien biltegiratzea',
  'cfsetup.r2.text':
    'Zure abestiak Cloudflare-ren "R2" izeneko espazioan gordetzen dira. Ireki orria, sakatu botoia aktibatzeko eta itzuli. Doako mugaren barruan ez da kobratzen.',
  'cfsetup.r2.open': 'Ireki Cloudflare-ren biltegiratzea',
  'cfsetup.r2.done': 'Eginda, jarraitu',
  'cfsetup.token.title': 'Sortu aldi baterako gako bat',
  'cfsetup.token.what':
    '"Token" bat aldi baterako gako bat da, aplikazioari zure zerbitzaria ezartzeko baimena ematen diona. Aplikazioak ez du gordetzen eta gero ezaba dezakezu.',
  'cfsetup.token.open': 'Ireki gakoaren orria',
  'cfsetup.token.step1': 'Sakatu "Continue to summary".',
  'cfsetup.token.step2': 'Sakatu "Create token".',
  'cfsetup.token.step3': 'Sakatu "Copy" eta itzuli hona.',
  'cfsetup.token.label': 'Itsatsi gakoa hemen',
  'cfsetup.token.submit': 'Egiaztatu eta jarraitu',
  'cfsetup.chooseAccount.title': 'Zein kontu?',
  'cfsetup.chooseAccount.text':
    'Zure gakoak Cloudflare kontu bat baino gehiago erabil ditzake. Aukeratu non ezarri zure zerbitzaria.',
  'cfsetup.subdomain.title': 'Aukeratu zure zerbitzariaren izena',
  'cfsetup.subdomain.text':
    'Izen hau zure zerbitzariaren helbidearen parte izango da. Bat proposatzen dugu, baina alda dezakezu. Erabili letra xeheak, zenbakiak eta gidoiak.',
  'cfsetup.subdomain.label': 'Izena',
  'cfsetup.subdomain.preview': 'Zure helbidea {address} izango da',
  'cfsetup.subdomain.submit': 'Sortu nire zerbitzaria',
  'cfsetup.existing.title': 'Badaukazu zerbitzari bat',
  'cfsetup.existing.text':
    'Kontu honetan Aske Stream zerbitzari bat dago jada. Bertsio honekin berriro ezar dezakegu. Zure musika ez da ezabatzen, baina sarbide-gako berri bat izango du, beraz zure beste gailuak (telefonoa, tableta, ordenagailua) berriro lotu beharko dituzu. Eguneratu besterik ez baduzu nahi, itzuli atzera eta erabili «Eguneratu» botoia Ezarpenak → «Zure zerbitzaria» atalean.',
  'cfsetup.existing.confirm': 'Berriro ezarri',
  'cfsetup.running.title': 'Zure zerbitzaria ezartzen',
  'cfsetup.running.updateTitle': 'Zure zerbitzaria eguneratzen',
  'cfsetup.running.text': 'Ez itxi aplikazioa. Minutu batzuk behar ditzake.',
  'cfsetup.step.account': 'Zure kontua egiaztatzen',
  'cfsetup.step.subdomain': 'Zure helbidea sortzen',
  'cfsetup.step.database': 'Datu-basea sortzen',
  'cfsetup.step.storage': 'Biltegiratzea prestatzen',
  'cfsetup.step.migrations': 'Datu-basea eguneratzen',
  'cfsetup.step.files': 'Aplikazioaren fitxategiak igotzen',
  'cfsetup.step.worker': 'Zerbitzaria instalatzen',
  'cfsetup.step.publish': 'Argitaratzen',
  'cfsetup.step.waiting': 'Abiatzeko zain',
  'cfsetup.done.title': 'Dena prest',
  'cfsetup.done.updateTitle': 'Zerbitzaria eguneratuta',
  'cfsetup.done.text':
    'Zure zerbitzaria prest dago eta telefono hau konektatuta dago jada. Aldi baterako gakoa ezaba dezakezu.',
  'cfsetup.done.updateText':
    'Zure zerbitzariak azken bertsioa du. Aldi baterako gakoa ezaba dezakezu.',
  'cfsetup.done.deleteToken': 'Ezabatu aldi baterako gakoa',
  'cfsetup.done.finish': 'Amaitu',
  'cfsetup.error.title': 'Zerbait gaizki atera da',
  'cfsetup.error.retry': 'Saiatu berriro',
  'cfsetup.error.waitRetry': 'Egiaztatu berriro',
  'cfsetup.error.goR2': 'Aktibatu biltegiratzea',
  'cfsetup.error.goToken': 'Sortu gakoa berriro',
  'cfsetup.error.otherName': 'Aukeratu beste izen bat',
  'cfsetup.error.invalid_token':
    'Cloudflare-k ez du gako hori onartu. Kopiatu berriro eta egiaztatu osorik dagoela.',
  'cfsetup.error.missing_permission':
    'Gakoak ez ditu baimen guztiak. Sortu berriro urratsak jarraituz.',
  'cfsetup.error.r2_not_enabled':
    'Fitxategien biltegiratzea (R2) ez dago aktibatuta zure kontuan oraindik.',
  'cfsetup.error.subdomain_taken': 'Izen hori hartuta dago. Aukeratu beste bat.',
  'cfsetup.error.subdomain_invalid':
    'Izen hori ez da baliozkoa. Erabili letra xeheak, zenbakiak eta gidoiak.',
  'cfsetup.error.network': 'Ez dago konexiorik. Begiratu internet eta saiatu berriro.',
  'cfsetup.error.rate_limited': 'Cloudflare lanpetuta dago. Itxaron minutu bat eta saiatu berriro.',
  'cfsetup.error.not_found': 'Cloudflare-k ez du behar duen zerbait aurkitu. Saiatu berriro.',
  'cfsetup.error.unknown': 'Ustekabeko zerbait gertatu da. Saiatu berriro minutu batzuen buruan.',
  'cfsetup.error.no_account': 'Gako horrek ez dio Cloudflare konturik irekitzen.',
  'cfsetup.error.wrong_account': 'Gako hori beste kontu batena da, ez zure zerbitzaria duenarena.',
  'cfsetup.error.bundle_missing':
    'Aplikazio-bertsio honek ez ditu zerbitzariaren fitxategiak. Instalatu aplikazioaren azken bertsioa.',
  'cfsetup.error.not_live_yet':
    'Zure zerbitzaria instalatuta dago baina ez du oraindik erantzuten. Minutu batzuk behar ditzake: egiaztatu berriro.',
  'serverUpdate.title': 'Zure zerbitzaria',
  'serverUpdate.versions': 'Zerbitzaria {server} · Aplikazioa {app}',
  'serverUpdate.unknownVersion': 'bertsio zaharra',
  'serverUpdate.outdated': 'Zure zerbitzaria zaharkituta dago. Eguneratu dena ondo ibil dadin.',
  'serverUpdate.upToDate': 'Zure zerbitzaria eguneratuta dago.',
  'serverUpdate.button': 'Eguneratu',
  'serverUpdate.webOnly': 'Eguneratu ezazu Android aplikaziotik.',
  'serverUpdate.banner': 'Zure zerbitzariak bertsio zaharra du. Eguneratu Ezarpenetan.',
  'serverUpdate.bannerOpen': 'Ireki Ezarpenak',
  'serverUpdate.dismiss': 'Itxi',
  'toast.serverOutdated':
    'Zure zerbitzariak bertsio zaharra du eta oraindik ez du hau onartzen. Zure musika ondo dago. Eguneratu Ezarpenak > Zure zerbitzaria atalean.',
};

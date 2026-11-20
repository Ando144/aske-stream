import type { HelpArticle } from './types';

export const cloudflareSetupArticles: HelpArticle[] = [
  {
    id: 'cloudflare-setup',
    section: 'cloudflare',
    title: {
      es: 'Montar tu Cloudflare desde la app, paso a paso',
      en: 'Setting up your Cloudflare from the app, step by step',
      eu: 'Zure Cloudflare aplikaziotik prestatu, urratsez urrats',
    },
    body: {
      es: `La app puede montar tu Aske Stream en Cloudflare por ti, sin ordenador y sin escribir comandos. Dura unos 10 minutos y solo se hace una vez.

1. **Empieza el asistente.** En la pantalla de vincular tu dispositivo, pulsa el enlace **¿Aún no tienes tu Cloudflare? Móntalo ahora** y luego **Empezar**.
2. **Crea tu cuenta gratis.** Pulsa **Abrir Cloudflare**, crea la cuenta y confirma el correo que te mandan. Al volver a la app, pulsa **Ya tengo cuenta**.
3. **Activa el almacenamiento (R2).** Pulsa **Abrir almacenamiento de Cloudflare** y activa R2 en la página que se abre. Pide una tarjeta, pero no cobra nada dentro del plan gratuito. Al volver, pulsa **Hecho, continuar**.
4. **Crea la llave temporal (el token).** Pulsa **Abrir la página de la llave**. Se abre Cloudflare con los permisos ya marcados. Pulsa **Continuar al resumen**, después **Crear token** y **Copiar**.
5. Vuelve a la app, **pega la llave** y pulsa **Comprobar y continuar**. Mira [[cloudflare-token|El token de Cloudflare: qué es y cómo borrarlo]]. Si tu llave sirve para varias cuentas, la app te pregunta cuál usar.
6. **Elige el nombre** de tu servidor. La app propone uno como **aske-xxxx**; puedes cambiarlo. Pulsa **Crear mi servidor**.
7. Espera mientras la app lo monta todo y no la cierres. Cuando salga **Todo listo**, ya estás dentro; pulsa **Terminar**.

Si el servidor tarda en responder tras crearlo, es normal (puede tardar unos minutos). Pulsa **Comprobar otra vez**: no se vuelve a subir nada.

**Si ya tenías un Aske Stream** en esa cuenta, la app te avisa antes de seguir: montarlo de nuevo crea una clave nueva y los demás dispositivos tendrán que vincularse otra vez (la música no se borra). Mira [[link-device|Vincular otro dispositivo con un QR o un código]].

**Errores frecuentes:** «R2 no está activado» (haz el paso 3 o pulsa **Activar el almacenamiento**), «falta un permiso» (crea el token con el botón de la app, sin quitar permisos), «esa dirección ya existe» (prueba otra).`,
      en: `The app can set up your Aske Stream on Cloudflare for you, with no computer and no commands. It takes about 10 minutes and is done only once.

1. **Start the assistant.** On the screen for linking your device, tap the link **Do not have your Cloudflare yet? Set it up now** and then **Start**.
2. **Create your free account.** Tap **Open Cloudflare**, create the account and confirm the email they send you. When you are back in the app, tap **I already have an account**.
3. **Turn on storage (R2).** Tap **Open Cloudflare storage** and turn on R2 on the page that opens. It asks for a card but charges nothing within the free plan. When you are back, tap **Done, continue**.
4. **Create the temporary key (the token).** Tap **Open the key page**. Cloudflare opens with the permissions already ticked. Tap **Continue to summary**, then **Create token** and **Copy**.
5. Go back to the app, **paste the key** and tap **Check and continue**. See [[cloudflare-token|The Cloudflare token: what it is and how to delete it]]. If your key works for several accounts, the app asks which one to use.
6. **Choose the name** of your server. The app suggests one like **aske-xxxx**; you can change it. Tap **Create my server**.
7. Wait while the app sets everything up and do not close it. When **All ready** appears, you are in; tap **Finish**.

If the server is slow to answer after creation, that is normal (it can take a few minutes). Tap **Check again**: nothing is uploaded again.

**If you already had an Aske Stream** in that account, the app warns you before going on: setting it up again creates a new key and your other devices will have to link again (the music is not deleted). See [[link-device|Linking another device with a QR or a code]].

**Common errors:** “R2 is not enabled” (do step 3 or tap **Turn on storage**), “a permission is missing” (create the token with the app’s button, without removing permissions), “that address already exists” (try another).`,
      eu: `Aplikazioak zure Aske Stream Cloudflaren prestatu dezake zuretzat, ordenagailurik eta komandorik gabe. 10 minutu inguru behar ditu eta behin bakarrik egiten da.

1. **Hasi laguntzailea.** Zure gailua lotzeko pantailan, sakatu **Oraindik ez duzu zure Cloudflare? Ezarri orain** esteka eta gero **Hasi**.
2. **Sortu doako kontua.** Sakatu **Ireki Cloudflare**, sortu kontua eta berretsi bidaltzen dizuten posta. Aplikaziora itzultzean, sakatu **Badut kontua**.
3. **Aktibatu biltegiratzea (R2).** Sakatu **Ireki Cloudflare-ren biltegiratzea** eta aktibatu R2 irekitzen den orrian. Txartel bat eskatzen du, baina ez du ezer kobratzen doako planaren barruan. Itzultzean, sakatu **Eginda, jarraitu**.
4. **Sortu aldi baterako gakoa (tokena).** Sakatu **Ireki gakoaren orria**. Cloudflare irekitzen da baimenak dagoeneko markatuta dituela. Sakatu **Continue to summary**, gero **Create token** eta **Copy**.
5. Itzuli aplikaziora, **itsatsi gakoa** eta sakatu **Egiaztatu eta jarraitu**. Ikusi [[cloudflare-token|Cloudflareren tokena: zer den eta nola ezabatu]]. Zure gakoak kontu bat baino gehiagorekin balio badu, aplikazioak galdetuko dizu zein erabili.
6. **Aukeratu izena** zure zerbitzariarentzat. Aplikazioak **aske-xxxx** bezalako bat proposatzen du; alda dezakezu. Sakatu **Sortu nire zerbitzaria**.
7. Itxaron aplikazioak dena ezartzen duen bitartean eta ez itxi. **Dena prest** agertzen denean, barruan zaude; sakatu **Amaitu**.

Zerbitzariak sortu ondoren erantzuteko denbora hartzen badu, normala da (minutu batzuk behar ditzake). Sakatu **Egiaztatu berriro**: ez da ezer berriz igotzen.

**Kontu horretan dagoeneko Aske Stream bat bazenuen**, aplikazioak abisatzen dizu jarraitu aurretik: berriz prestatzeak gako berri bat sortzen du eta gainerako gailuak berriz lotu beharko dira (musika ez da ezabatzen). Ikusi [[link-device|Beste gailu bat QR edo kode batekin lotu]].

**Ohiko akatsak:** «R2 ez dago aktibatuta» (egin 3. urratsa edo sakatu **Aktibatu biltegiratzea**), «baimen bat falta da» (sortu tokena aplikazioaren botoiarekin, baimenak kendu gabe), «helbide hori badago» (probatu beste bat).`,
    },
  },
  {
    id: 'cloudflare-token',
    section: 'cloudflare',
    title: {
      es: 'El token de Cloudflare: qué es y cómo borrarlo',
      en: 'The Cloudflare token: what it is and how to delete it',
      eu: 'Cloudflareren tokena: zer den eta nola ezabatu',
    },
    body: {
      es: `El token es una contraseña especial que deja a la app preparar cosas en tu cuenta de Cloudflare sin darle tu contraseña de verdad.

**Qué permisos tiene** (los marca solo el enlace de la app):
- Editar **Workers** (para subir tu servidor).
- Editar **D1** (la base de datos de tu biblioteca).
- Editar **R2** (donde se guarda la música).
- Leer los datos de la cuenta (para saber cuál es tu cuenta).

**La app no lo guarda.** Solo lo usa mientras montas o actualizas tu servidor y se olvida al cerrar la pantalla. No sale de tu móvil salvo hacia Cloudflare. Cada vez que quieras actualizar, tendrás que crear o pegar uno.

**Cómo borrarlo cuando termines:**
1. Entra en dash.cloudflare.com y ve a **Mi perfil → Tokens de API**.
2. Busca el token (lleva el nombre que le diste al crearlo) y pulsa **Eliminar**.

Borrarlo es seguro: tu música y tu Aske Stream siguen funcionando. Solo hará falta uno nuevo para la próxima actualización. Mira [[cloudflare-update|Actualizar tu Cloudflare]].

Si crees que alguien lo ha visto, bórralo ya.`,
      en: `The token is a special password that lets the app prepare things in your Cloudflare account without giving it your real password.

**What permissions it has** (the app’s link ticks them for you):
- Edit **Workers** (to upload your server).
- Edit **D1** (your library’s database).
- Edit **R2** (where the music is stored).
- Read account details (to know which account is yours).

**The app does not save it.** It only uses it while you set up or update your server and forgets it when you close the screen. It never leaves your phone except to go to Cloudflare. Each time you want to update, you will need to create or paste one.

**How to delete it when you finish:**
1. Go to dash.cloudflare.com and open **My Profile → API Tokens**.
2. Find the token (it has the name you gave it) and tap **Delete**.

Deleting it is safe: your music and your Aske Stream keep working. You will just need a new one for the next update. See [[cloudflare-update|Updating your Cloudflare]].

If you think someone has seen it, delete it right away.`,
      eu: `Tokena pasahitz berezi bat da: aplikazioari uzten dio zure Cloudflare kontuan gauzak prestatzen, zure benetako pasahitza eman gabe.

**Zer baimen dituen** (aplikazioaren estekak berak markatzen ditu):
- **Workers** editatu (zure zerbitzaria igotzeko).
- **D1** editatu (zure liburutegiaren datu-basea).
- **R2** editatu (musika gordetzen den lekua).
- Kontuaren datuak irakurri (zein den zure kontua jakiteko).

**Aplikazioak ez du gordetzen.** Zerbitzaria prestatzen edo eguneratzen duzun bitartean bakarrik erabiltzen du, eta pantaila ixten duzunean ahazten du. Ez da zure mugikorretik ateratzen, Cloudflarera joateko ez bada. Eguneratu nahi duzun bakoitzean, bat sortu edo itsatsi beharko duzu.

**Nola ezabatu amaitzean:**
1. Sartu dash.cloudflare.com webgunean eta ireki **My Profile → API Tokens**.
2. Bilatu tokena (sortzean eman diozun izena du) eta sakatu **Delete**.

Ezabatzea segurua da: zure musikak eta Aske Streamek funtzionatzen jarraitzen dute. Hurrengo eguneraketarako berri bat behar duzu bakarrik. Ikusi [[cloudflare-update|Zure Cloudflare eguneratu]].

Norbaitek ikusi duela uste baduzu, ezabatu berehala.`,
    },
  },
  {
    id: 'cloudflare-update',
    section: 'cloudflare',
    title: {
      es: 'Actualizar tu Cloudflare',
      en: 'Updating your Cloudflare',
      eu: 'Zure Cloudflare eguneratu',
    },
    body: {
      es: `Cuando sale una versión nueva de la app, tu servidor de Cloudflare puede quedarse con la versión antigua. Algunas funciones nuevas (por ejemplo, fijar playlists) no funcionan hasta que lo actualices.

**Cuándo hace falta:** cuando la app te lo avisa con un cartel («Tu servidor tiene una versión antigua. Actualízalo en Ajustes.») o en **Ajustes → Tu servidor**, donde siempre se ve si está al día. El cartel se puede cerrar con **Cerrar** y no vuelve hasta la siguiente versión.

**Cómo se hace:**
1. Pulsa **Abrir Ajustes** en el cartel y, en **Tu servidor**, pulsa **Actualizar**.
2. Crea y pega una llave temporal de Cloudflare (mira [[cloudflare-token|El token de Cloudflare: qué es y cómo borrarlo]]).
3. Espera a que termine. Tu música, playlists y claves no se tocan, y los demás dispositivos siguen conectados.

Si prefieres hacerlo desde un ordenador, sigue la [guía de instalación](https://github.com/Ando144/aske-stream/blob/main/docs/deployment.md): el apartado **Updating** sigue valiendo.

Si algo falla, no pierdes nada: pulsa **Intentarlo de nuevo** (o **Crear la llave otra vez** si el problema es la llave).`,
      en: `When a new version of the app comes out, your Cloudflare server may stay on the old version. Some new features (for example, pinning playlists) do not work until you update it.

**When it is needed:** when the app tells you with a banner (“Your server has an old version. Update it from Settings.”) or in **Settings → Your server**, where you can always see whether it is up to date. The banner can be closed with **Close** and does not come back until the next version.

**How to do it:**
1. Tap **Open Settings** on the banner and, under **Your server**, tap **Update**.
2. Create and paste a temporary Cloudflare key (see [[cloudflare-token|The Cloudflare token: what it is and how to delete it]]).
3. Wait until it finishes. Your music, playlists and keys are untouched, and your other devices stay connected.

If you prefer to do it from a computer, follow the [installation guide](https://github.com/Ando144/aske-stream/blob/main/docs/deployment.md): its **Updating** section still works.

If something fails you lose nothing: tap **Try again** (or **Create the key again** if the problem is the key).`,
      eu: `Aplikazioaren bertsio berri bat ateratzen denean, zure Cloudflare zerbitzariak bertsio zaharrean gera daiteke. Funtzio berri batzuek (adibidez, zerrendak finkatzeak) ez dute funtzionatzen eguneratu arte.

**Noiz behar den:** aplikazioak kartel batekin abisatzen dizunean («Zure zerbitzariak bertsio zaharra du. Eguneratu Ezarpenetan.») edo **Ezarpenak → Zure zerbitzaria** atalean, non beti ikusten den eguneratuta dagoen. Kartela **Itxi** botoiarekin itxi daiteke eta ez da itzultzen hurrengo bertsioa arte.

**Nola egiten den:**
1. Sakatu **Ireki Ezarpenak** kartelean eta, **Zure zerbitzaria** atalean, sakatu **Eguneratu**.
2. Sortu eta itsatsi Cloudflareren aldi baterako gako bat (ikusi [[cloudflare-token|Cloudflareren tokena: zer den eta nola ezabatu]]).
3. Itxaron amaitu arte. Zure musika, zerrendak eta gakoak ez dira ukitzen, eta gainerako gailuak konektatuta jarraitzen dute.

Ordenagailu batetik egitea nahiago baduzu, jarraitu [instalazio-gida](https://github.com/Ando144/aske-stream/blob/main/docs/deployment.md): **Updating** atalak balio du oraindik.

Zerbaitek huts egiten badu, ez duzu ezer galtzen: sakatu **Saiatu berriro** (edo **Sortu gakoa berriro**, arazoa gakoa bada).`,
    },
  },
];

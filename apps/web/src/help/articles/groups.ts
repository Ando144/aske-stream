import type { HelpArticle } from './types';

export const groupsArticles: HelpArticle[] = [
  {
    id: 'friend-groups',
    section: 'friends',
    title: {
      es: 'Grupos de amigos',
      en: 'Friend groups',
      eu: 'Lagunen taldeak',
    },
    body: {
      es: `Un grupo es un sitio para ti y tus amigos: veis el ranking de lo que escucháis y os pasáis playlists y Jams. Cabe hasta **20 personas** y tú puedes estar en hasta **10 grupos**.

**Dónde está:** en **Playlists → Con amigos → Grupos**.

**Crear un grupo:** abre **Grupos**, pulsa **Crear un grupo**, ponle un nombre y escribe cómo quieres que te llamen los demás (tu apodo). No hace falta cuenta ni email.

**Invitar:** dentro del grupo pulsa **Invitar**. Enseña el código QR o manda el código o el enlace a tus amigos. Quien creó el grupo puede renovar el código si ya no quiere que se use el anterior.

**Unirte a un grupo:** en **Grupos** pulsa **Entrar con un código**, escribe el código o escanea el QR. Si te mandan un enlace, ábrelo y la app te lo rellena. Antes de entrar verás el nombre del grupo, su foto y cuántas personas hay, para comprobar que es el tuyo.

**La lista de grupos:** cada tarjeta muestra la foto del grupo, las iniciales de algunas personas y un resumen. Pone «Este mes», los minutos escuchados y quién más escucha, contando **solo** a quienes comparten sus escuchas. Si nadie ha compartido, la tarjeta lo dice.

**Dentro del grupo:** en **Resumen del mes** ves los minutos entre todos, cuántas personas comparten, las que más escuchan y las canciones del mes. Con **Ver todo el ranking** y **Ver cada persona** tienes el detalle. Más abajo están **Compartido** y **Personas**.

**Nombre y foto:** dentro del grupo pulsa **Nombre y foto**. Cualquier persona del grupo puede cambiarlos, y la app no dice quién lo ha hecho. Si cambian dos a la vez, se queda el último cambio.
1. Pulsa **Elegir una foto** (o **Elegir otra foto**) y escoge una imagen de tu móvil u ordenador. Se recorta sola por el centro. Para dejar el grupo sin foto, pulsa **Quitar la foto**.
2. Si quieres, cambia el nombre. Después pulsa **Guardar cambios**.
3. Si no se puede guardar (por ejemplo, sin internet), la pantalla te avisa. Si cierras la hoja tocando fuera, lo escrito y la foto siguen ahí cuando la vuelvas a abrir, mientras no cierres la app. Si pulsas **Cancelar**, se descartan.

**Sobre la foto:**
- No subas fotos de otras personas sin su permiso.
- La ven las personas del grupo y quien tenga un código de invitación que siga valiendo. Sin código no la ve nadie más.
- Se guarda en el Hub, el servidor común de Aske Stream, hasta que alguien la quita o la cambia, se borra el grupo o el grupo pasa 180 días sin actividad.

**Qué se comparte con tu grupo:**
- Tu apodo.
- Si activas el interruptor, tus escuchas de cada mes: minutos, y tus canciones y artistas más escuchados.
- Las playlists y Jams que tú elijas compartir en el grupo.

**Qué no se comparte nunca:** tu música, tu email, las canciones que saltas, ni la radio ni los podcasts.

**El interruptor «Compartir mis escuchas con mis grupos»:** está en **Ajustes → Grupos**. Está apagado hasta que tú lo enciendas.
- Solo controla tus escuchas. Puedes crear grupos, entrar y compartir playlists sin encenderlo.
- Al encenderlo se activa también tu [[listening-stats|Recap]] en este móvil, porque las escuchas salen de ahí.
- Al apagarlo se borran tus escuchas del Hub. Sigues dentro de tus grupos y el Recap sigue como estaba.
- Para **dejar de compartir**, ve a **Ajustes → Grupos** y apágalo. Dejas de sumar minutos y de poder salir como quien más escucha. Tu apodo sigue a la vista en el grupo.
- En **Personas**, el aviso «No comparte lo que escucha» solo aparece debajo de tu propio nombre y solo lo ves tú (si creaste el grupo, ahí pone «Creaste el grupo»).

**Cuánto tiempo se guarda:** tus escuchas de los últimos 12 meses. Lo más antiguo se borra solo. Un grupo sin actividad durante unos 6 meses también se borra.

**Salir, expulsar y borrar:**
- Para salir de un grupo, ábrelo y pulsa **Salir del grupo**.
- Solo quien creó el grupo puede expulsar a alguien. Una persona expulsada no puede volver a entrar.
- Para irte de todos los grupos y borrar todo lo tuyo, pulsa **Borrar todos mis datos de grupos** en **Ajustes → Grupos**.

**Si algo falla:** si ves que el grupo está lleno, que ya estás en 10 grupos o que tu invitación no vale, lo dice la propia pantalla: pide a tu amigo un código nuevo o sal de algún grupo.

Más sobre tus datos en [[privacy|Privacidad]].`,
      en: `A group is a place for you and your friends: you see the ranking of what you listen to and you pass playlists and Jams to each other. It holds up to **20 people** and you can be in up to **10 groups**.

**Where it is:** in **Playlists → With friends → Groups**.

**Create a group:** open **Groups**, tap **Create a group**, give it a name and type how you want others to call you (your nickname). No account or email is needed.

**Invite:** inside the group tap **Invite**. Show the QR code or send the code or the link to your friends. The person who created the group can renew the code if they no longer want the old one to work.

**Join a group:** in **Groups** tap **Join with a code**, type the code or scan the QR. If someone sends you a link, open it and the app fills it in for you. Before joining you see the group’s name, its photo and how many people are in it, so you can check that it is the right one.

**The list of groups:** each card shows the group photo, the initials of some people and a summary. It says “This month”, the minutes listened and the top listener, counting **only** the people who share their listening. If nobody has shared, the card says so.

**Inside the group:** **Monthly summary** shows the minutes all together, how many people share, who listens the most and the songs of the month. **See the full ranking** and **See each person** give you the detail. Further down are **Shared** and **People**.

**Name and photo:** inside the group tap **Name and photo**. Anyone in the group can change them, and the app does not say who did it. If two people change them at once, the last change stays.
1. Tap **Choose a photo** (or **Choose another photo**) and pick an image from your phone or computer. It is cropped to the centre automatically. To leave the group without a photo, tap **Remove the photo**.
2. Change the name if you like. Then tap **Save changes**.
3. If it cannot be saved (with no internet, for example), the screen tells you. If you close the sheet by tapping outside it, what you typed and the photo are still there when you open it again, as long as you do not close the app. If you tap **Cancel**, they are discarded.

**About the photo:**
- Do not upload photos of other people without their permission.
- The people in the group and anyone with an invitation code that still works can see it. Without a code, nobody else can.
- It is stored on the Hub, the shared Aske Stream server, until someone removes or changes it, the group is deleted or the group has no activity for 180 days.

**What is shared with your group:**
- Your nickname.
- If you turn the switch on, your listening for each month: minutes, and your most played songs and artists.
- The playlists and Jams you choose to share in the group.

**What is never shared:** your music, your email, the songs you skip, or radio and podcasts.

**The “Share my listening with my groups” switch:** it is in **Settings → Groups**. It is off until you turn it on.
- It only controls your listening. You can create groups, join and share playlists without turning it on.
- Turning it on also turns on your [[listening-stats|Recap]] on this phone, because the listening comes from there.
- Turning it off deletes your listening from the Hub. You stay in your groups and the Recap stays as it was.
- To **stop sharing**, go to **Settings → Groups** and turn it off. You stop adding minutes and can no longer appear as the top listener. Your nickname stays visible in the group.
- In **People**, the note “Not sharing what they listen to” only appears under your own name and only you see it (if you created the group, it says “You created the group” there).

**How long it is kept:** your listening for the last 12 months. Anything older is deleted by itself. A group with no activity for about 6 months is also deleted.

**Leave, remove and delete:**
- To leave a group, open it and tap **Leave the group**.
- Only the person who created the group can remove someone. A removed person cannot join again.
- To leave every group and delete everything of yours, tap **Delete all my group data** in **Settings → Groups**.

**If something goes wrong:** if the group is full, you are already in 10 groups or your invitation does not work, the screen says so: ask your friend for a new code or leave a group.

More about your data in [[privacy|Privacy]].`,
      eu: `Talde bat zuretzat eta zure lagunentzako lekua da: zer entzuten duzuen ikusten duzue rankingean eta zerrendak eta Jam-ak elkarri pasatzen dizkiozue. **20 lagun** arte kabitzen dira eta zu **10 taldetan** egon zaitezke gehienez.

**Non dagoen:** **Zerrendak → Lagunekin → Taldeak** atalean.

**Taldea sortu:** ireki **Taldeak**, sakatu **Sortu talde bat**, jarri izen bat eta idatzi besteek nola deitzea nahi duzun (zure ezizena). Ez da konturik edo posta elektronikorik behar.

**Gonbidatu:** taldearen barruan sakatu **Gonbidatu**. Erakutsi QR kodea edo bidali kodea edo esteka zure lagunei. Taldea sortu duenak kodea berritu dezake, aurrekoak ez funtzionatzea nahi badu.

**Talde batean sartu:** **Taldeak** atalean sakatu **Sartu kode batekin**, idatzi kodea edo eskaneatu QR kodea. Esteka bat bidaltzen badizute, ireki eta aplikazioak berak betetzen du. Sartu aurretik taldearen izena, argazkia eta zenbat pertsona dauden ikusiko duzu, zure taldea dela egiaztatzeko.

**Taldeen zerrenda:** txartel bakoitzak taldearen argazkia, pertsona batzuen inizialak eta laburpen bat erakusten ditu. «Hilabete honetan», entzundako minutuak eta gehien entzuten duena jartzen du, entzunaldiak partekatzen dituztenak **bakarrik** zenbatuta. Inork partekatu ez badu, txartelak esaten du.

**Taldearen barruan:** **Hilabeteko laburpena** atalean ikusten dituzu denon arteko minutuak, zenbat pertsonak partekatzen duten, gehien entzuten dutenak eta hilabeteko abestiak. Xehetasunak ikusteko, sakatu **Ikusi sailkapen osoa** edo **Ikusi pertsona bakoitza**. Beherago **Partekatuta** eta **Pertsonak** daude.

**Izena eta argazkia:** taldearen barruan sakatu **Izena eta argazkia**. Taldeko edonork alda ditzake, eta aplikazioak ez du esaten nork egin duen. Bik aldi berean aldatzen badituzte, azken aldaketa geratzen da.
1. Sakatu **Aukeratu argazki bat** (edo **Aukeratu beste argazki bat**) eta hartu irudi bat zure mugikorretik edo ordenagailutik. Bere kabuz mozten da erditik. Taldea argazkirik gabe uzteko, sakatu **Kendu argazkia**.
2. Nahi baduzu, aldatu izena. Gero sakatu **Gorde aldaketak**.
3. Ezin bada gorde (internetik gabe, adibidez), pantailak abisatzen dizu. Leihoa kanpoan ukituta ixten baduzu, idatzitakoa eta argazkia hor egongo dira berriro irekitzean, aplikazioa ixten ez duzun bitartean. **Utzi** sakatzen baduzu, baztertu egiten dira.

**Argazkiari buruz:**
- Ez igo beste pertsonen argazkirik haien baimenik gabe.
- Taldeko jendeak eta oraindik balio duen gonbidapen-kode bat duenak ikus dezake. Koderik gabe, beste inork ez.
- Hub-ean gordetzen da, Aske Stream-en zerbitzari komunean, norbaitek kendu edo aldatu arte, taldea ezabatu arte edo taldeak 180 egun jarduerarik gabe eman arte.

**Zer partekatzen da zure taldearekin:**
- Zure ezizena.
- Etengailua aktibatzen baduzu, hilabete bakoitzeko entzunaldiak: minutuak, eta gehien entzundako abesti eta artistak.
- Taldean partekatzea aukeratzen dituzun zerrendak eta Jam-ak.

**Zer ez den inoiz partekatzen:** zure musika, zure posta elektronikoa, saltatzen dituzun abestiak, irratia eta podcastak.

**«Partekatu nire entzunaldiak nire taldeekin» etengailua:** **Ezarpenak → Taldeak** atalean dago. Zuk aktibatu arte itzalita dago.
- Zure entzunaldiak bakarrik kontrolatzen ditu. Taldeak sor ditzakezu, sartu eta zerrendak partekatu aktibatu gabe.
- Aktibatzean, mugikor honetako [[listening-stats|Recap]]-a ere aktibatzen da, entzunaldiak hortik ateratzen direlako.
- Itzaltzean, zure entzunaldiak Hub-etik ezabatzen dira. Zure taldeetan jarraitzen duzu eta Recap-a lehen bezala geratzen da.
- **Partekatzeari uzteko**, joan **Ezarpenak → Taldeak** atalera eta itzali. Ez duzu minutu gehiago gehitzen eta ezin zara gehien entzuten duen gisa agertu. Zure ezizena taldean ikusgai geratzen da.
- **Pertsonak** atalean, «Ez du entzuten duena partekatzen» oharra zure izenaren azpian bakarrik agertzen da eta zuk bakarrik ikusten duzu (taldea zuk sortu baduzu, hor «Zuk sortu duzu taldea» jartzen du).

**Zenbat denbora gordetzen den:** azken 12 hilabeteetako entzunaldiak. Zaharragoa berez ezabatzen da. 6 hilabete inguruz jarduerarik gabeko talde bat ere ezabatzen da.

**Atera, kendu eta ezabatu:**
- Talde bat uzteko, ireki eta sakatu **Utzi taldea**.
- Taldea sortu duenak bakarrik kendu dezake norbait. Kendutako pertsona ezin da berriro sartu.
- Talde guztiak utzi eta zure datu guztiak ezabatzeko, sakatu **Ezabatu nire taldeen datu guztiak** **Ezarpenak → Taldeak** atalean.

**Zerbaitek huts egiten badu:** taldea beteta badago, jada 10 taldetan bazaude edo zure gonbidapenak ez badu balio, pantailak berak esaten du: eskatu kode berri bat zure lagunari edo utzi talde bat.

Zure datuei buruz gehiago: [[privacy|Pribatutasuna]].`,
    },
  },
];

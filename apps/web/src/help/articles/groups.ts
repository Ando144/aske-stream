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

**Unirte a un grupo:** en **Grupos** pulsa **Entrar con un código**, escribe el código o escanea el QR. Si te mandan un enlace, ábrelo y la app te lo rellena.

**Qué se comparte con tu grupo:**
- Tu apodo.
- Si activas el interruptor, tus escuchas de cada mes: minutos, y tus canciones y artistas más escuchados.
- Las playlists y Jams que tú elijas compartir en el grupo.

**Qué no se comparte nunca:** tu música, tu email, las canciones que saltas, ni la radio ni los podcasts.

**El interruptor «Compartir mis escuchas con mis grupos»:** está en **Grupos**, arriba. Está apagado hasta que tú lo enciendas.
- Solo controla tus escuchas. Puedes crear grupos, entrar y compartir playlists sin encenderlo.
- Al encenderlo se activa también tu [[listening-stats|Recap]] en este móvil, porque las escuchas salen de ahí.
- Al apagarlo se borran tus escuchas del Hub. Sigues dentro de tus grupos y el Recap sigue como estaba.

**Cuánto tiempo se guarda:** tus escuchas de los últimos 12 meses. Lo más antiguo se borra solo. Un grupo sin actividad durante unos 6 meses también se borra.

**Salir, expulsar y borrar:**
- Para salir de un grupo, ábrelo y pulsa **Salir del grupo**.
- Solo quien creó el grupo puede expulsar a alguien. Una persona expulsada no puede volver a entrar.
- Para irte de todos los grupos y borrar todo lo tuyo, pulsa **Borrar todos mis datos de grupos** al final de **Grupos**.

**Si algo falla:** si ves que el grupo está lleno, que ya estás en 10 grupos o que tu invitación no vale, lo dice la propia pantalla: pide a tu amigo un código nuevo o sal de algún grupo.

Más sobre tus datos en [[privacy|Privacidad]].`,
      en: `A group is a place for you and your friends: you see the ranking of what you listen to and you pass playlists and Jams to each other. It holds up to **20 people** and you can be in up to **10 groups**.

**Where it is:** in **Playlists → With friends → Groups**.

**Create a group:** open **Groups**, tap **Create a group**, give it a name and type how you want others to call you (your nickname). No account or email is needed.

**Invite:** inside the group tap **Invite**. Show the QR code or send the code or the link to your friends. The person who created the group can renew the code if they no longer want the old one to work.

**Join a group:** in **Groups** tap **Join with a code**, type the code or scan the QR. If someone sends you a link, open it and the app fills it in for you.

**What is shared with your group:**
- Your nickname.
- If you turn the switch on, your listening for each month: minutes, and your most played songs and artists.
- The playlists and Jams you choose to share in the group.

**What is never shared:** your music, your email, the songs you skip, or radio and podcasts.

**The “Share my listening with my groups” switch:** it is at the top of **Groups**. It is off until you turn it on.
- It only controls your listening. You can create groups, join and share playlists without turning it on.
- Turning it on also turns on your [[listening-stats|Recap]] on this phone, because the listening comes from there.
- Turning it off deletes your listening from the Hub. You stay in your groups and the Recap stays as it was.

**How long it is kept:** your listening for the last 12 months. Anything older is deleted by itself. A group with no activity for about 6 months is also deleted.

**Leave, remove and delete:**
- To leave a group, open it and tap **Leave the group**.
- Only the person who created the group can remove someone. A removed person cannot join again.
- To leave every group and delete everything of yours, tap **Delete all my group data** at the bottom of **Groups**.

**If something goes wrong:** if the group is full, you are already in 10 groups or your invitation does not work, the screen says so: ask your friend for a new code or leave a group.

More about your data in [[privacy|Privacy]].`,
      eu: `Talde bat zuretzat eta zure lagunentzako lekua da: zer entzuten duzuen ikusten duzue rankingean eta zerrendak eta Jam-ak elkarri pasatzen dizkiozue. **20 lagun** arte kabitzen dira eta zu **10 taldetan** egon zaitezke gehienez.

**Non dagoen:** **Zerrendak → Lagunekin → Taldeak** atalean.

**Taldea sortu:** ireki **Taldeak**, sakatu **Sortu talde bat**, jarri izen bat eta idatzi besteek nola deitzea nahi duzun (zure ezizena). Ez da konturik edo posta elektronikorik behar.

**Gonbidatu:** taldearen barruan sakatu **Gonbidatu**. Erakutsi QR kodea edo bidali kodea edo esteka zure lagunei. Taldea sortu duenak kodea berritu dezake, aurrekoak ez funtzionatzea nahi badu.

**Talde batean sartu:** **Taldeak** atalean sakatu **Sartu kode batekin**, idatzi kodea edo eskaneatu QR kodea. Esteka bat bidaltzen badizute, ireki eta aplikazioak berak betetzen du.

**Zer partekatzen da zure taldearekin:**
- Zure ezizena.
- Etengailua aktibatzen baduzu, hilabete bakoitzeko entzunaldiak: minutuak, eta gehien entzundako abesti eta artistak.
- Taldean partekatzea aukeratzen dituzun zerrendak eta Jam-ak.

**Zer ez den inoiz partekatzen:** zure musika, zure posta elektronikoa, saltatzen dituzun abestiak, irratia eta podcastak.

**«Partekatu nire entzunaldiak nire taldeekin» etengailua:** **Taldeak** atalaren goialdean dago. Zuk aktibatu arte itzalita dago.
- Zure entzunaldiak bakarrik kontrolatzen ditu. Taldeak sor ditzakezu, sartu eta zerrendak partekatu aktibatu gabe.
- Aktibatzean, mugikor honetako [[listening-stats|Recap]]-a ere aktibatzen da, entzunaldiak hortik ateratzen direlako.
- Itzaltzean, zure entzunaldiak Hub-etik ezabatzen dira. Zure taldeetan jarraitzen duzu eta Recap-a lehen bezala geratzen da.

**Zenbat denbora gordetzen den:** azken 12 hilabeteetako entzunaldiak. Zaharragoa berez ezabatzen da. 6 hilabete inguruz jarduerarik gabeko talde bat ere ezabatzen da.

**Atera, kendu eta ezabatu:**
- Talde bat uzteko, ireki eta sakatu **Utzi taldea**.
- Taldea sortu duenak bakarrik kendu dezake norbait. Kendutako pertsona ezin da berriro sartu.
- Talde guztiak utzi eta zure datu guztiak ezabatzeko, sakatu **Ezabatu nire taldeen datu guztiak** **Taldeak** atalaren amaieran.

**Zerbaitek huts egiten badu:** taldea beteta badago, jada 10 taldetan bazaude edo zure gonbidapenak ez badu balio, pantailak berak esaten du: eskatu kode berri bat zure lagunari edo utzi talde bat.

Zure datuei buruz gehiago: [[privacy|Pribatutasuna]].`,
    },
  },
];

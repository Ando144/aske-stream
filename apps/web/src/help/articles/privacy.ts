import type { HelpArticle } from './types';

export const privacyArticles: HelpArticle[] = [
  {
    id: 'privacy',
    section: 'privacy',
    title: {
      es: '¿Quién puede ver mi música?',
      en: 'Who can see my music?',
      eu: 'Nork ikus dezake nire musika?',
    },
    body: {
      es: `Solo tú.
- **En este dispositivo**: la música no sale del móvil.
- **En tu Google Drive**: está en tu propia cuenta de Google, en una carpeta privada que no se comparte con nadie. La app solo puede ver los archivos que ella misma ha creado. Mira [[drive-privacy|qué puede ver la app]].
- **En tu Cloudflare**: está en tu propia cuenta, en un almacén privado. Solo entran los móviles u ordenadores que tienen tu clave. Nada es público.

Aske Stream no tiene anuncios, no vende datos y no envía tu música a nadie. La app solo habla con tu Google Drive o tu Cloudflare, con YouTube (para buscar y descargar), con el catálogo de radios y con GitHub (para buscar actualizaciones).

**Grupos de amigos:** si entras en un grupo, el Hub guarda tu apodo. Si además activas «Compartir mis escuchas con mis grupos», guarda tus minutos y tus tops de cada mes durante 12 meses, y solo los ve la gente de tus grupos. Nunca guarda música, email, canciones saltadas, radio ni podcasts. Puedes apagarlo o usar **Borrar todos mis datos de grupos** cuando quieras. Mira [[friend-groups|Grupos de amigos]].

Si crees que alguien tiene tu clave, quien montó el servidor puede cambiarla: todos los dispositivos tendrán que conectarse otra vez.`,
      en: `Only you.
- **On this device**: the music never leaves the phone.
- **In your Google Drive**: it is in your own Google account, in a private folder shared with nobody. The app can only see the files it created itself. See [[drive-privacy|what the app can see]].
- **In your Cloudflare**: it is in your own account, in private storage. Only phones or computers with your key get in. Nothing is public.

Aske Stream has no ads, sells no data and sends your music to nobody. The app only talks to your Google Drive or your Cloudflare, to YouTube (to search and download), to the radio catalogue and to GitHub (to check for updates).

**Friend groups:** if you join a group, the Hub keeps your nickname. If you also turn on “Share my listening with my groups”, it keeps your minutes and monthly tops for 12 months, and only the people in your groups see them. It never stores music, email, skipped songs, radio or podcasts. You can turn it off or use **Delete all my group data** whenever you want. See [[friend-groups|Friend groups]].

If you think someone has your key, whoever set up the server can change it: every device will have to connect again.`,
      eu: `Zuk bakarrik.
- **Gailu honetan**: musika ez da mugikorretik ateratzen.
- **Zure Google Drive-n**: zure Google kontu propioan dago, inorekin partekatzen ez den karpeta pribatu batean. Aplikazioak berak sortutako fitxategiak bakarrik ikus ditzake. Ikusi [[drive-privacy|zer ikus dezakeen aplikazioak]].
- **Zure Cloudflaren**: zure kontu propioan dago, biltegi pribatu batean. Zure gakoa duten mugikor edo ordenagailuak bakarrik sartzen dira. Ezer ez da publikoa.

Aske Streamek ez du iragarkirik, ez du daturik saltzen eta ez dio inori zure musika bidaltzen. Aplikazioak zure Google Drive edo Cloudflarerekin, YouTuberekin (bilatu eta deskargatzeko), irrati-katalogoarekin eta GitHubekin (eguneraketak bilatzeko) bakarrik hitz egiten du.

**Lagunen taldeak:** talde batean sartzen bazara, Hub-ak zure ezizena gordetzen du. Gainera «Partekatu nire entzunaldiak nire taldeekin» aktibatzen baduzu, hilabete bakoitzeko minutuak eta goiko zerrendak gordetzen ditu 12 hilabetez, eta zure taldeetako lagunek bakarrik ikusten dituzte. Ez ditu inoiz gordetzen musika, posta elektronikoa, saltatutako abestiak, irratia edo podcastak. Itzali dezakezu edo **Ezabatu nire taldeen datu guztiak** erabil dezakezu nahi duzunean. Ikusi [[friend-groups|Lagunen taldeak]].

Norbaitek zure gakoa duela uste baduzu, zerbitzaria prestatu zuenak alda dezake: gailu guztiek berriro konektatu beharko dute.`,
    },
  },
  {
    id: 'legal',
    section: 'privacy',
    title: {
      es: '¿Puedo descargar cualquier cosa de YouTube?',
      en: 'Can I download anything from YouTube?',
      eu: 'YouTubeko edozer deskarga dezaket?',
    },
    body: {
      es: `Aske Stream está pensada para **uso personal**. Las condiciones de YouTube no permiten descargar vídeos salvo donde YouTube ofrece un botón para ello, y las leyes sobre copias privadas cambian de un país a otro.

Recomendaciones:
- Descarga música para escucharla tú, no para compartirla ni venderla.
- Si te gusta un artista, apóyale: conciertos, discos, Bandcamp…
- No subas a internet canciones descargadas.

Esto no es asesoramiento legal: si tienes dudas, consulta las leyes de tu país.`,
      en: `Aske Stream is meant for **personal use**. YouTube’s terms do not allow downloading videos except where YouTube offers a button for it, and laws on private copies differ from country to country.

Recommendations:
- Download music for yourself to listen to, not to share or sell.
- If you like an artist, support them: concerts, records, Bandcamp…
- Do not upload downloaded songs to the internet.

This is not legal advice: if in doubt, check the laws of your country.`,
      eu: `Aske Stream **erabilera pertsonalerako** pentsatuta dago. YouTuberen baldintzek ez dute bideoak deskargatzen uzten, YouTubek horretarako botoia eskaintzen duen kasuetan izan ezik, eta kopia pribatuei buruzko legeak herrialde batetik bestera aldatzen dira.

Gomendioak:
- Deskargatu musika zuk entzuteko, ez partekatzeko edo saltzeko.
- Artista bat gustuko baduzu, lagundu: kontzertuak, diskoak, Bandcamp…
- Ez igo Internetera deskargatutako abestirik.

Hau ez da aholkularitza juridikoa: zalantzarik baduzu, kontsultatu zure herrialdeko legeak.`,
    },
  },
];

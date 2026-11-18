import type { HelpArticle } from './types';

export const offlineArticles: HelpArticle[] = [
  {
    id: 'offline-how',
    section: 'offline',
    title: {
      es: 'Cómo funciona la música sin conexión',
      en: 'How offline music works',
      eu: 'Nola dabilen konexiorik gabeko musika',
    },
    body: {
      es: `**Si guardas la música en este dispositivo**, toda suena sin internet. No hay que hacer nada.

**Si usas Google Drive o tu Cloudflare**, el móvil guarda una copia de una parte de tu música para cuando no tengas internet (en el metro, de viaje…). Lo ajustas en **Ajustes → Música sin conexión**:
- **Cuánta música** guardar, en minutos u horas.
- **Rellenar automáticamente**: la app elige canciones al azar hasta llegar al límite.
- **Cambiar las ya escuchadas**: pasado un tiempo, las que ya has escuchado se cambian por otras, para que siempre tengas música «nueva» sin conexión.
- Las que tú descargas a mano (**Elegidas por ti**) nunca se cambian.
- **Descargar con datos móviles**: si está apagado, espera al Wi-Fi.`,
      en: `**If you keep music on this device**, all of it plays without internet. Nothing to do.

**If you use Google Drive or your Cloudflare**, the phone keeps a copy of part of your music for when you have no internet (underground, travelling…). Set it in **Settings → Offline music**:
- **How much music** to keep, in minutes or hours.
- **Fill automatically**: the app picks random songs up to the limit.
- **Swap songs you have heard**: after a while, songs you have already heard are swapped for others, so you always have “new” music offline.
- Songs you download by hand (**Picked by you**) are never swapped.
- **Download with mobile data**: when off, it waits for Wi-Fi.`,
      eu: `**Musika gailu honetan gordetzen baduzu**, guztia entzuten da Internetik gabe. Ez dago ezer egin beharrik.

**Google Drive edo zure Cloudflare erabiltzen badituzu**, mugikorrak zure musikaren zati baten kopia gordetzen du Internetik ez duzunerako (metroan, bidaian…). **Ezarpenak → Konexiorik gabeko musika** atalean doitzen da:
- **Zenbat musika** gorde, minututan edo ordutan.
- **Automatikoki bete**: aplikazioak ausaz aukeratzen ditu abestiak mugara iritsi arte.
- **Aldatu entzundakoak**: denbora pixka bat igarotakoan, entzun dituzunak beste batzuengatik aldatzen dira, konexiorik gabe beti musika «berria» izateko.
- Zuk eskuz deskargatzen dituzunak (**Zuk aukeratuak**) ez dira inoiz aldatzen.
- **Deskargatu datu mugikorrekin**: desaktibatuta badago, Wi-Fiaren zain geratzen da.`,
    },
  },
  {
    id: 'storage-space',
    section: 'offline',
    title: {
      es: 'Cuánto espacio ocupa y cómo verlo',
      en: 'How much space it takes and how to check',
      eu: 'Zenbat leku hartzen duen eta nola ikusi',
    },
    body: {
      es: `En **Ajustes → Almacenamiento** ves:
- Lo que ocupan las canciones guardadas en el móvil.
- Lo que ocupan las copias para escuchar sin conexión.
- El espacio libre del móvil y cuántas canciones caben más.
- Con tu Cloudflare: cuánto llevas de los 10 GB gratis.

En **Biblioteca**, encima de la lista, aparece el total: canciones, horas y espacio.

Para hacer sitio: borra canciones (menú ⋮ → «Eliminar de la biblioteca») o baja la cantidad de música sin conexión.`,
      en: `**Settings → Storage** shows:
- The space used by songs stored on the phone.
- The space used by copies for offline listening.
- The phone’s free space and how many more songs fit.
- With your Cloudflare: how much of the free 10 GB you use.

In **Library**, above the list, you see the total: songs, hours and space.

To make room: delete songs (⋮ menu → “Delete from library”) or lower the amount of offline music.`,
      eu: `**Ezarpenak → Biltegiratzea** atalean ikusten duzu:
- Mugikorrean gordetako abestiek hartzen dutena.
- Konexiorik gabe entzuteko kopiek hartzen dutena.
- Mugikorreko leku librea eta zenbat abesti gehiago sartzen diren.
- Zure Cloudflarerekin: doako 10 GBetatik zenbat daramazun.

**Liburutegian**, zerrendaren gainean, guztizkoa agertzen da: abestiak, orduak eta lekua.

Lekua egiteko: ezabatu abestiak (⋮ menua → «Ezabatu liburutegitik») edo jaitsi konexiorik gabeko musika kopurua.`,
    },
  },
];

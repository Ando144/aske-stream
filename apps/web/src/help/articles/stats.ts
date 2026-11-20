import type { HelpArticle } from './types';

export const statsArticles: HelpArticle[] = [
  {
    id: 'listening-stats',
    section: 'listen',
    title: {
      es: 'Recap: tus estadísticas de escucha',
      en: 'Recap: your listening stats',
      eu: 'Recap: zure entzuteen estatistikak',
    },
    body: {
      es: `El **Recap** es un resumen de lo que escuchas: cuántos minutos, qué canciones y artistas y cuántos días seguidos has puesto música. Puedes verlo por mes o por año.

**Cómo activarlo**: abre **Recap** y pulsa «Sí, activarlo», o ve a **Ajustes → Recap**. Hasta que lo actives no se guarda nada.

**Cuándo cuenta una escucha**: cuando una canción suena 30 segundos (o la mitad, si es muy corta).

- Las canciones que saltas antes de tiempo también se guardan, pero no suman minutos ni salen en los tops: solo aparecen en «Saltadas».
- La radio y los podcasts no cuentan.

**Tus datos son solo tuyos**: se guardan únicamente en este dispositivo y no se envían a nadie. No pasan a otro móvil ni al cambiar de almacenamiento, y si borras los datos de la app se pierden.

**Borrar el historial**: en **Ajustes → Recap**, pulsa «Borrar mi historial» (el Recap sigue activado). **Si desactivas el Recap, se borra todo el historial** y no se puede recuperar.

Más sobre tus datos en [[privacy|Privacidad]].`,
      en: `The **Recap** is a summary of what you listen to: how many minutes, which songs and artists, and how many days in a row you played music. You can see it by month or by year.

**How to turn it on**: open **Recap** and tap “Yes, turn it on”, or go to **Settings → Recap**. Nothing is saved until you turn it on.

**When a listen counts**: when a song plays for 30 seconds (or halfway, if it is very short).

- Songs you skip early are also saved, but they add no minutes and do not appear in the tops: they only show in “Skipped”.
- Radio and podcasts do not count.

**Your data is only yours**: it is stored only on this device and is not sent to anyone. It does not move to another phone or when you change storage, and if you clear the app's data it is lost.

**Delete the history**: in **Settings → Recap**, tap “Delete my history” (the Recap stays on). **If you turn the Recap off, the whole history is deleted** and cannot be recovered.

More about your data in [[privacy|Privacy]].`,
      eu: `**Recap**-a zuk entzundakoaren laburpena da: zenbat minutu, zer abesti eta artista, eta zenbat egun jarraian jarri duzun musika. Hilabeteka edo urteka ikus dezakezu.

**Nola aktibatu**: ireki **Recap** eta sakatu «Bai, aktibatu», edo joan **Ezarpenak → Recap** atalera. Aktibatu arte ez da ezer gordetzen.

**Noiz zenbatzen den entzunaldi bat**: abesti batek 30 segundo jotzen duenean (edo erdia, oso laburra bada).

- Garaiz baino lehen saltatzen dituzun abestiak ere gordetzen dira, baina ez dute minutuak gehitzen eta ez dira goiko zerrendetan agertzen: «Saltatuak» atalean bakarrik.
- Irratia eta podcastak ez dira zenbatzen.

**Zure datuak zureak dira**: gailu honetan bakarrik gordetzen dira eta ez zaizkio inori bidaltzen. Ez dira beste mugikor batera pasatzen, ezta biltegiratzea aldatzean ere, eta aplikazioaren datuak ezabatzen badituzu galdu egiten dira.

**Historiala ezabatu**: **Ezarpenak → Recap** atalean, sakatu «Ezabatu nire historiala» (Recap-a aktibo jarraitzen du). **Recap-a desaktibatzen baduzu, historial osoa ezabatzen da** eta ezin da berreskuratu.

Zure datuei buruz gehiago: [[privacy|Pribatutasuna]].`,
    },
  },
];

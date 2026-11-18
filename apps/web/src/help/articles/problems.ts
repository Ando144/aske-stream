import type { HelpArticle } from './types';

export const problemsArticles: HelpArticle[] = [
  {
    id: 'cant-connect',
    section: 'problems',
    title: {
      es: 'No consigo conectar con mi Cloudflare',
      en: 'I cannot connect to my Cloudflare',
      eu: 'Ezin naiz nire Cloudflarera konektatu',
    },
    body: {
      es: `La app te dice qué ha pasado:
- **«No hay conexión a internet»**: revisa el Wi-Fi o los datos.
- **«No se encuentra tu servidor en esa dirección»**: la dirección está mal escrita. Ábrela en el navegador del móvil: si ves Aske Stream, es buena. Debe empezar por https://.
- **«Esa clave no es válida»**: cópiala y pégala de nuevo, sin espacios al principio ni al final.
- **«Tu servidor responde, pero no deja entrar a la app»**: el servidor tiene una versión antigua; quien lo montó tiene que actualizarlo.

Mira también [[cloudflare-connect|dónde encontrar la dirección y la clave]].`,
      en: `The app tells you what happened:
- **“There is no internet connection”**: check Wi-Fi or mobile data.
- **“Your server could not be found at that address”**: the address is mistyped. Open it in the phone browser: if you see Aske Stream, it is right. It must start with https://.
- **“That key is not valid”**: copy and paste it again, with no spaces at the start or end.
- **“Your server answers but does not let the app in”**: the server runs an old version; whoever set it up needs to update it.

See also [[cloudflare-connect|where to find the address and the key]].`,
      eu: `Aplikazioak zer gertatu den esaten dizu:
- **«Ez dago Interneteko konexiorik»**: begiratu Wi-Fia edo datuak.
- **«Ez da zure zerbitzaria aurkitu helbide horretan»**: helbidea gaizki idatzita dago. Ireki mugikorreko nabigatzailean: Aske Stream ikusten baduzu, ona da. https:// hasi behar da.
- **«Gako hori ez da baliozkoa»**: kopiatu eta itsatsi berriro, hasieran edo amaieran zuriunerik gabe.
- **«Zure zerbitzariak erantzuten du, baina ez dio aplikazioari sartzen uzten»**: zerbitzariak bertsio zaharra du; prestatu zuenak eguneratu behar du.

Ikusi baita ere [[cloudflare-connect|non aurkitu helbidea eta gakoa]].`,
    },
  },
  {
    id: 'radio-no-sound',
    section: 'problems',
    title: {
      es: 'Una emisora no suena',
      en: 'A station does not play',
      eu: 'Irrati batek ez du jotzen',
    },
    body: {
      es: `- La radio necesita internet.
- Algunas emisoras dejan de emitir o cambian de dirección: prueba otra con el mismo nombre en la lista.
- Las emisoras con conexión antigua (http://) **no suenan en el navegador**, pero sí en la app de Android.
- Si la añadiste tú con un enlace, comprueba que es el enlace del sonido y no el de la página web de la emisora.`,
      en: `- Radio needs internet.
- Some stations stop broadcasting or change address: try another one with the same name in the list.
- Stations with an old kind of connection (http://) **do not play in the browser**, but they do in the Android app.
- If you added it yourself with a link, check it is the audio link and not the station’s web page.`,
      eu: `- Irratiak Internet behar du.
- Irrati batzuek emititzeari uzten diote edo helbidez aldatzen dira: probatu zerrendako izen bereko beste bat.
- Konexio zaharra duten irratiak (http://) **ez dira nabigatzailean entzuten**, baina Android aplikazioan bai.
- Zuk gehitu bazenuen esteka batekin, egiaztatu soinuaren esteka dela eta ez irratiaren webgunearena.`,
    },
  },
  {
    id: 'app-not-installed',
    section: 'problems',
    title: {
      es: '«Aplicación no instalada»',
      en: '“App not installed”',
      eu: '«Aplikazioa ez da instalatu»',
    },
    body: {
      es: `Android muestra este mensaje cuando no puede instalar el archivo. Lo más común:
- **Descargaste el archivo «armv7»**, que es para móviles antiguos de 32 bits. Descarga el que no lo lleva.
- **La app la instalaste desde otro sitio** (por ejemplo, una versión hecha por otra persona). Desinstálala e instala la oficial. Ojo: se borra la música guardada en el móvil.
- **No queda espacio** en el móvil.`,
      en: `Android shows this when it cannot install the file. Most often:
- **You downloaded the “armv7” file**, which is for old 32-bit phones. Download the one without it.
- **You installed the app from somewhere else** (for example, a version built by someone else). Uninstall it and install the official one. Careful: music stored on the phone is deleted.
- **There is no space left** on the phone.`,
      eu: `Androidek mezu hau erakusten du fitxategia ezin duenean instalatu. Ohikoenak:
- **«armv7» fitxategia deskargatu duzu**, 32 biteko mugikor zaharrentzat dena. Deskargatu hori ez daramana.
- **Aplikazioa beste nonbaitetik instalatu zenuen** (adibidez, beste norbaitek egindako bertsio bat). Desinstalatu eta instalatu ofiziala. Kontuz: mugikorrean gordetako musika ezabatzen da.
- **Ez dago lekurik** mugikorrean.`,
    },
  },
];

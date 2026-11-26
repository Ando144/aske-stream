/** Texts for picking songs from a whole YouTube playlist before sending them. English is the source. */
export const pickEn = {
  'pick.loading': 'Reading the playlist…',
  'pick.loadingMore': 'Reading the playlist: {count} of {total}…',
  'pick.selected': '{count} of {total} selected',
  'pick.all': 'Select all',
  'pick.none': 'Clear all',
  'pick.max': 'You can pick up to {count} songs at once. Untick one to tick another.',
  'pick.overLimit': 'This playlist has {total} songs. Only the first {count} are shown.',
  'pick.unavailableNote':
    '{count} songs are not available (private or deleted) and will be skipped.',
  'pick.unavailableNote.one': '1 song is not available (private or deleted) and will be skipped.',
  'pick.unavailableSummary': '{count} songs were not available and were skipped.',
  'pick.unavailableSummary.one': '1 song was not available and was skipped.',
  'pick.send': 'Send {count} to the phone',
  'pick.send.one': 'Send 1 to the phone',
  'pick.noneSelected': 'Tick at least one song.',
  'pick.gotPlaylist':
    '{count} songs from “{name}” are on their way. They will be saved in that playlist.',
  'pick.gotPlaylist.one': '1 song from “{name}” is on its way. It will be saved in that playlist.',
  'pick.mixSongOnly': 'This is an automatic YouTube Mix: only this song will be used.',
  'pick.openPlaylist': 'See the whole playlist',
  'pick.err.mix':
    'YouTube Mixes change by themselves and cannot be sent whole. Open a normal playlist or pick the songs one by one.',
  'pick.err.personal':
    '“Liked videos” and “Watch later” are private to your YouTube account and cannot be opened. Copy the songs to a public or unlisted playlist and paste its link.',
  'pick.err.private':
    'We cannot open this playlist: it is private or no longer exists. In YouTube, set it to “Public” or “Unlisted” and paste the link again.',
  'pick.err.none': 'This link is not a YouTube playlist.',
} as const;

export const pickEs: Record<keyof typeof pickEn, string> = {
  'pick.loading': 'Leyendo la playlist…',
  'pick.loadingMore': 'Leyendo la playlist: {count} de {total}…',
  'pick.selected': '{count} de {total} marcadas',
  'pick.all': 'Marcar todas',
  'pick.none': 'Quitar todas',
  'pick.max': 'Puedes elegir hasta {count} canciones a la vez. Quita alguna para marcar otra.',
  'pick.overLimit': 'Esta playlist tiene {total} canciones. Solo se muestran las primeras {count}.',
  'pick.unavailableNote':
    '{count} canciones no están disponibles (privadas o borradas) y se saltarán.',
  'pick.unavailableNote.one': '1 canción no está disponible (privada o borrada) y se saltará.',
  'pick.unavailableSummary': '{count} canciones no estaban disponibles y se han saltado.',
  'pick.unavailableSummary.one': '1 canción no estaba disponible y se ha saltado.',
  'pick.send': 'Enviar {count} al móvil',
  'pick.send.one': 'Enviar 1 al móvil',
  'pick.noneSelected': 'Marca al menos una canción.',
  'pick.gotPlaylist': 'Llegan {count} canciones de «{name}». Se guardarán en esa playlist.',
  'pick.gotPlaylist.one': 'Llega 1 canción de «{name}». Se guardará en esa playlist.',
  'pick.mixSongOnly': 'Es un Mix automático de YouTube: solo se usará esta canción.',
  'pick.openPlaylist': 'Ver la playlist entera',
  'pick.err.mix':
    'Los Mix de YouTube cambian solos y no se pueden enviar enteros. Abre una playlist normal o elige las canciones una a una.',
  'pick.err.personal':
    '«Me gusta» y «Ver más tarde» son privadas de tu cuenta de YouTube y no se pueden abrir. Copia las canciones a una playlist pública o no listada y pega su enlace.',
  'pick.err.private':
    'No podemos abrir esta playlist: es privada o ya no existe. En YouTube, ponla como «Pública» o «No listada» y vuelve a pegar el enlace.',
  'pick.err.none': 'Este enlace no es de una playlist de YouTube.',
};

export const pickEu: Record<keyof typeof pickEn, string> = {
  'pick.loading': 'Zerrenda irakurtzen…',
  'pick.loadingMore': 'Zerrenda irakurtzen: {count}/{total}…',
  'pick.selected': '{count}/{total} hautatuta',
  'pick.all': 'Guztiak hautatu',
  'pick.none': 'Guztiak kendu',
  'pick.max': 'Aldi berean {count} abesti arte aukera ditzakezu. Kendu bat beste bat hautatzeko.',
  'pick.overLimit': 'Zerrenda honek {total} abesti ditu. Lehen {count}ak bakarrik erakusten dira.',
  'pick.unavailableNote':
    '{count} abesti ez daude eskuragarri (pribatuak edo ezabatuak) eta saltatu egingo dira.',
  'pick.unavailableNote.one':
    'Abesti 1 ez dago eskuragarri (pribatua edo ezabatua) eta saltatu egingo da.',
  'pick.unavailableSummary': '{count} abesti ez zeuden eskuragarri eta saltatu dira.',
  'pick.unavailableSummary.one': 'Abesti 1 ez zegoen eskuragarri eta saltatu da.',
  'pick.send': 'Bidali {count} mugikorrera',
  'pick.send.one': 'Bidali 1 mugikorrera',
  'pick.noneSelected': 'Hautatu abesti bat gutxienez.',
  'pick.gotPlaylist': '«{name}» zerrendako {count} abesti datoz. Zerrenda horretan gordeko dira.',
  'pick.gotPlaylist.one': '«{name}» zerrendako abesti 1 dator. Zerrenda horretan gordeko da.',
  'pick.mixSongOnly': 'YouTubeko Mix automatiko bat da: abesti hau bakarrik erabiliko da.',
  'pick.openPlaylist': 'Ikusi zerrenda osoa',
  'pick.err.mix':
    'YouTubeko Mixak beren kabuz aldatzen dira eta ezin dira osorik bidali. Ireki zerrenda arrunt bat edo aukeratu abestiak banan-banan.',
  'pick.err.personal':
    '«Gustuko bideoak» eta «Ikusteko geroago» zure YouTube kontuko zerrenda pribatuak dira eta ezin dira ireki. Kopiatu abestiak zerrenda publiko edo zerrendatu gabeko batera eta itsatsi haren esteka.',
  'pick.err.private':
    'Ezin dugu zerrenda hau ireki: pribatua da edo ez dago jada. YouTuben, jarri «Publikoa» edo «Zerrendatu gabea» eta itsatsi esteka berriro.',
  'pick.err.none': 'Esteka hau ez da YouTubeko zerrenda batena.',
};

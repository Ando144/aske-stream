/** Texts for shuffle, player gestures and sending songs to a Jam. English is the source. */
export const playbackEn = {
  'swipe.jam': 'Add to the Jam',
  'jamSend.action': 'Send to the Jam',
  'jamSend.done': '{count} songs sent to the Jam',
  'jamSend.done.one': 'Song sent to the Jam',
  'jamSend.notYoutube':
    '{count} songs were not sent: only songs that come from YouTube can play in a Jam.',
  'jamSend.notYoutube.one':
    'This song cannot be sent: only songs that come from YouTube can play in a Jam.',
  'jamSend.limit':
    'You can only have {max} of your songs waiting in the Jam. {count} were left out; send them once some have played.',
  'jamSend.offline':
    'You are not connected to the Jam right now. Check your connection and try again.',
  'player.swipe.next': 'Next',
  'player.swipe.prev': 'Previous',
  'player.swipeLabel': 'Swipe left to go to the next one and right to go back to the previous one',
  'settings.reshuffle': 'Shuffle again',
  'settings.reshuffleHint':
    'Shuffle keeps the same order until every song has played. Tap here if you want a new order; what you have already heard will still wait at the end.',
  'toast.reshuffled': 'Done: shuffle has a new order',
};

export const playbackEs: Record<keyof typeof playbackEn, string> = {
  'swipe.jam': 'Añadir a la Jam',
  'jamSend.action': 'Enviar a la Jam',
  'jamSend.done': '{count} canciones enviadas a la Jam',
  'jamSend.done.one': 'Canción enviada a la Jam',
  'jamSend.notYoutube':
    '{count} canciones no se han enviado: en una Jam solo pueden sonar canciones que vienen de YouTube.',
  'jamSend.notYoutube.one':
    'Esta canción no se puede enviar: en una Jam solo pueden sonar canciones que vienen de YouTube.',
  'jamSend.limit':
    'Solo puedes tener {max} canciones tuyas esperando en la Jam. Se han quedado fuera {count}; envíalas cuando suene alguna.',
  'jamSend.offline':
    'Ahora mismo no estás conectado a la Jam. Comprueba tu conexión y vuelve a probar.',
  'player.swipe.next': 'Siguiente',
  'player.swipe.prev': 'Anterior',
  'player.swipeLabel':
    'Desliza a la izquierda para pasar a la siguiente y a la derecha para volver a la anterior',
  'settings.reshuffle': 'Barajar de nuevo',
  'settings.reshuffleHint':
    'El aleatorio sigue el mismo orden hasta que suenan todas las canciones. Pulsa aquí si quieres un orden nuevo; lo que ya has oído seguirá esperando al final.',
  'toast.reshuffled': 'Listo: el aleatorio tiene un orden nuevo',
};

export const playbackEu: Record<keyof typeof playbackEn, string> = {
  'swipe.jam': 'Gehitu Jam-era',
  'jamSend.action': 'Bidali Jam-era',
  'jamSend.done': '{count} abesti Jam-era bidalita',
  'jamSend.done.one': 'Abestia Jam-era bidalita',
  'jamSend.notYoutube':
    '{count} abesti ez dira bidali: Jam batean YouTubetik datozen abestiak bakarrik entzun daitezke.',
  'jamSend.notYoutube.one':
    'Abesti hau ezin da bidali: Jam batean YouTubetik datozen abestiak bakarrik entzun daitezke.',
  'jamSend.limit':
    'Zure {max} abesti bakarrik eduki ditzakezu Jam-ean zain. Kanpoan geratu direnak: {count}. Bidali batzuk entzun ondoren.',
  'jamSend.offline': 'Orain ez zaude Jam-era konektatuta. Begiratu konexioa eta saiatu berriro.',
  'player.swipe.next': 'Hurrengoa',
  'player.swipe.prev': 'Aurrekoa',
  'player.swipeLabel':
    'Irristatu ezkerrera hurrengora pasatzeko eta eskuinera aurrekora itzultzeko',
  'settings.reshuffle': 'Nahastu berriro',
  'settings.reshuffleHint':
    'Ausazkoak ordena bera jarraitzen du abesti guztiak entzun arte. Sakatu hemen ordena berri bat nahi baduzu; entzun dituzunak amaieran zain jarraituko dute.',
  'toast.reshuffled': 'Eginda: ausazkoak ordena berria du',
};

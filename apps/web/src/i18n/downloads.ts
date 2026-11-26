/** Texts for long downloads and songs kept only on this phone. English is the source. */
export const downloadsEn = {
  'dl.st.canceling': 'Cancelling…',
  'dl.toast.canceledSaving': 'Cancelled. That download has not been saved to your library.',
  'dl.st.savingBig':
    'Saving {size} to your library. Long audio takes several minutes; you can keep using the app.',
  'dl.st.savingLocal': 'Saving on this phone ({size})…',
  'dl.st.savedLocal': 'Saved only on this phone',
  'dl.toast.savedLocal':
    '“{title}” is {size} and does not fit in your Cloudflare (95 MB at most). We saved it only on this phone.',
  'dl.toast.savedLocalFailed':
    'We could not upload “{title}” to your Cloudflare after several tries, so we saved it only on this phone.',
  'dl.err.saveTooSlow': 'The upload was too slow and we stopped it. Try on Wi-Fi and tap Retry.',
  'dl.err.localFailed':
    'We could not save it on this phone. Check that you have free space and tap Retry.',
  'dl.remove': 'Remove from the list',
  'local.badge': 'Only on this phone',
  'local.explain':
    'This audio is saved only on this phone, because it is too big for your Cloudflare (more than 95 MB) or it could not be uploaded. You can listen to it here, also offline, but it does not appear on your other devices or on the web. If you uninstall the app or clear its data, it is lost.',
  'local.notInPlaylists':
    '{count} songs are only on this phone and cannot be added to cloud playlists.',
  'local.notInPlaylists.one':
    'This song is only on this phone and cannot be added to cloud playlists.',
};

export const downloadsEs: Record<keyof typeof downloadsEn, string> = {
  'dl.st.canceling': 'Cancelando…',
  'dl.toast.canceledSaving': 'Cancelado. Esa descarga no se ha guardado en tu biblioteca.',
  'dl.st.savingBig':
    'Guardando {size} en tu biblioteca. Los audios largos tardan varios minutos; puedes seguir usando la app.',
  'dl.st.savingLocal': 'Guardando en este móvil ({size})…',
  'dl.st.savedLocal': 'Guardado solo en este móvil',
  'dl.toast.savedLocal':
    '«{title}» pesa {size} y no cabe en tu Cloudflare (máximo 95 MB). Lo hemos guardado solo en este móvil.',
  'dl.toast.savedLocalFailed':
    'No hemos podido subir «{title}» a tu Cloudflare después de varios intentos, así que lo hemos guardado solo en este móvil.',
  'dl.err.saveTooSlow':
    'La subida iba demasiado lenta y la hemos parado. Prueba con wifi y pulsa Reintentar.',
  'dl.err.localFailed':
    'No hemos podido guardarlo en este móvil. Mira si te queda espacio libre y pulsa Reintentar.',
  'dl.remove': 'Quitar de la lista',
  'local.badge': 'Solo en este móvil',
  'local.explain':
    'Este audio está guardado solo en este móvil porque es demasiado grande para tu Cloudflare (más de 95 MB) o porque no se ha podido subir. Lo puedes escuchar aquí, también sin conexión, pero no aparece en tus otros aparatos ni en la web. Si desinstalas la app o borras sus datos, se pierde.',
  'local.notInPlaylists':
    '{count} canciones están solo en este móvil y no se pueden poner en playlists de la nube.',
  'local.notInPlaylists.one':
    'Esta canción está solo en este móvil y no se puede poner en playlists de la nube.',
};

export const downloadsEu: Record<keyof typeof downloadsEn, string> = {
  'dl.st.canceling': 'Uzten…',
  'dl.toast.canceledSaving': 'Utzita. Deskarga hori ez da zure liburutegian gorde.',
  'dl.st.savingBig':
    '{size} zure liburutegian gordetzen. Audio luzeek hainbat minutu behar dituzte; aplikazioa erabiltzen jarrai dezakezu.',
  'dl.st.savingLocal': 'Mugikor honetan gordetzen ({size})…',
  'dl.st.savedLocal': 'Mugikor honetan bakarrik gordeta',
  'dl.toast.savedLocal':
    '«{title}» fitxategiak {size} hartzen du eta ez da zure Cloudflaren sartzen (gehienez 95 MB). Mugikor honetan bakarrik gorde dugu.',
  'dl.toast.savedLocalFailed':
    'Hainbat aldiz saiatu arren, ezin izan dugu «{title}» zure Cloudflarera igo, eta mugikor honetan bakarrik gorde dugu.',
  'dl.err.saveTooSlow':
    'Igoera motelegia zen eta gelditu egin dugu. Saiatu wifiarekin eta sakatu «Saiatu berriro».',
  'dl.err.localFailed':
    'Ezin izan dugu mugikor honetan gorde. Begiratu lekurik geratzen zaizun eta sakatu «Saiatu berriro».',
  'dl.remove': 'Kendu zerrendatik',
  'local.badge': 'Mugikor honetan bakarrik',
  'local.explain':
    'Audio hau mugikor honetan bakarrik dago gordeta, zure Cloudflarerako handiegia delako (95 MB baino gehiago) edo ezin izan delako igo. Hemen entzun dezakezu, baita konexiorik gabe ere, baina ez da zure beste gailuetan ez webean agertzen. Aplikazioa desinstalatzen baduzu edo haren datuak ezabatzen badituzu, galdu egingo da.',
  'local.notInPlaylists':
    '{count} abesti mugikor honetan bakarrik daude eta ezin dira hodeiko zerrendetan jarri.',
  'local.notInPlaylists.one':
    'Abesti hau mugikor honetan bakarrik dago eta ezin da hodeiko zerrendetan jarri.',
};

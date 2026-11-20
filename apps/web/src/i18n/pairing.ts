/** Texts for linking another device (QR and one-time code). English is the source. */
export const pairingEn = {
  'pairing.title': 'Link another device',
  'pairing.intro':
    'Show a code on this device and enter it, or scan its QR, on the other one. You will not need your key.',
  'pairing.create': 'Link another device',
  'pairing.createAnother': 'Create another code',
  'pairing.qrLabel': 'QR code to link another device',
  'pairing.codeLabel': 'Code',
  'pairing.addressLabel': 'Address',
  'pairing.expiresIn': 'Valid for {time}. It works only once.',
  'pairing.expired': 'The code has expired.',
  'pairing.share': 'Share link',
  'pairing.shareText': 'Open this link to connect to my Aske Stream',
  'pairing.copied': 'Link copied',
  'pairing.createFailed': 'Could not create the code. Check your connection and try again.',
  'pairing.createUnauthorized': 'Your session has expired. Reconnect this device and try again.',
  'pairing.scan': 'Scan QR code',
  'pairing.subtitleCode': 'Enter the code shown on a device that is already connected.',
  'pairing.codeInputLabel': 'Code from the other device',
  'pairing.connect': 'Connect',
  'pairing.otherWays': 'Other ways to enter',
  'pairing.invalidCode': 'The code is not correct or has expired. Ask for a new one.',
  'pairing.notAskeQr':
    'That QR is not from Aske Stream. Scan the one in Settings > Link another device.',
  'pairing.scannerUnavailable': 'The scanner cannot open on this phone. Type the code instead.',
} as const;

export const pairingEs: Record<keyof typeof pairingEn, string> = {
  'pairing.title': 'Vincular otro dispositivo',
  'pairing.intro':
    'Muestra un código en este dispositivo y escríbelo, o escanea su QR, en el otro. No hará falta tu clave.',
  'pairing.create': 'Vincular otro dispositivo',
  'pairing.createAnother': 'Crear otro código',
  'pairing.qrLabel': 'Código QR para vincular otro dispositivo',
  'pairing.codeLabel': 'Código',
  'pairing.addressLabel': 'Dirección',
  'pairing.expiresIn': 'Vale durante {time}. Solo sirve una vez.',
  'pairing.expired': 'El código ha caducado.',
  'pairing.share': 'Compartir enlace',
  'pairing.shareText': 'Abre este enlace para conectarte a mi Aske Stream',
  'pairing.copied': 'Enlace copiado',
  'pairing.createFailed':
    'No se ha podido crear el código. Revisa tu conexión e inténtalo de nuevo.',
  'pairing.createUnauthorized':
    'Tu sesión ha caducado. Vuelve a conectar este dispositivo e inténtalo de nuevo.',
  'pairing.scan': 'Escanear código QR',
  'pairing.subtitleCode': 'Escribe el código que aparece en un dispositivo ya conectado.',
  'pairing.codeInputLabel': 'Código del otro dispositivo',
  'pairing.connect': 'Conectar',
  'pairing.otherWays': 'Otras formas de entrar',
  'pairing.invalidCode': 'El código no es correcto o ha caducado. Pide uno nuevo.',
  'pairing.notAskeQr':
    'Ese QR no es de Aske Stream. Escanea el de Ajustes > Vincular otro dispositivo.',
  'pairing.scannerUnavailable': 'El escáner no se puede abrir en este móvil. Escribe el código.',
};

export const pairingEu: Record<keyof typeof pairingEn, string> = {
  'pairing.title': 'Lotu beste gailu bat',
  'pairing.intro':
    'Erakutsi kode bat gailu honetan eta idatzi ezazu (edo eskaneatu bere QR-a) bestean. Ez duzu zure gakorik beharko.',
  'pairing.create': 'Lotu beste gailu bat',
  'pairing.createAnother': 'Sortu beste kode bat',
  'pairing.qrLabel': 'Beste gailu bat lotzeko QR kodea',
  'pairing.codeLabel': 'Kodea',
  'pairing.addressLabel': 'Helbidea',
  'pairing.expiresIn': '{time} balio du. Behin bakarrik balio du.',
  'pairing.expired': 'Kodea iraungi da.',
  'pairing.share': 'Partekatu esteka',
  'pairing.shareText': 'Ireki esteka hau nire Aske Stream-era konektatzeko',
  'pairing.copied': 'Esteka kopiatuta',
  'pairing.createFailed': 'Ezin izan da kodea sortu. Begiratu konexioa eta saiatu berriro.',
  'pairing.createUnauthorized':
    'Zure saioa iraungi da. Konektatu berriro gailu hau eta saiatu berriro.',
  'pairing.scan': 'Eskaneatu QR kodea',
  'pairing.subtitleCode': 'Idatzi dagoeneko konektatuta dagoen gailuan agertzen den kodea.',
  'pairing.codeInputLabel': 'Beste gailuko kodea',
  'pairing.connect': 'Konektatu',
  'pairing.otherWays': 'Sartzeko beste moduak',
  'pairing.invalidCode': 'Kodea ez da zuzena edo iraungi da. Eskatu beste bat.',
  'pairing.notAskeQr':
    'QR hori ez da Aske Stream-ena. Eskaneatu Ezarpenak > Lotu beste gailu bat atalekoa.',
  'pairing.scannerUnavailable': 'Eskanerra ezin da ireki telefono honetan. Idatzi kodea.',
};

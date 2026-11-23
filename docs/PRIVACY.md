# Aske Stream: Privacy Policy / Política de privacidad

Last updated / Última actualización: 2026-11-18

Aske Stream is a free, open-source (MIT) music app. Source code:
<https://github.com/Ando144/aske-stream>

## English

**In short: your music and your data stay with you. Aske Stream has no servers of its own that
receive your information, no ads, no tracking, and it sells nothing.**

### Where your music is stored

You choose, and you can change it later:

- **This device**: the music never leaves your phone or browser.
- **Your Google Drive**: the music is saved in your own Google account, in a private folder that
  is not shared with anyone.
- **Your own Cloudflare account**: the music is saved in private storage in your own account.
  Only devices that have your key can access it.

### Google user data

If you choose Google Drive, the app asks for a single permission:
`https://www.googleapis.com/auth/drive.file`.

- It lets the app see and manage **only the files and folders the app itself created**. It cannot
  see the rest of your Drive.
- The app uses it only to save, read, rename and delete your own music and library data in that
  folder, so you can listen to it.
- Your Google data is sent only between your device and Google. It is **not** sent to us or to
  any other server, **not** shared, sold or used for advertising, and **not** used to train AI
  models. No human reads it.
- The use of information received from Google APIs adheres to the
  [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
  including the Limited Use requirements.
- You can remove the app's access at any time at <https://myaccount.google.com/permissions>.

### Other services the app talks to

Only to do what you ask: YouTube (to search and download), the public radio catalogue, GitHub (to
check for updates), and your own Google Drive or Cloudflare account.

### Aske Hub (shared playlists and Jams)

Only if you use these optional features, the app talks to the Aske Hub, a small server that
**never stores music**:

- **Shared playlists:** the playlist name and the song references (YouTube ids, titles, artists)
  are kept for 90 days and then deleted. Anyone with the link can read them.
- **Jams:** the nicknames you type and the queue are kept only while the Jam lasts (at most 12
  hours). No accounts are needed.
- **Send to phone:** the list of songs (YouTube ids, titles, artists) is kept until the other
  phone receives it, and at most 24 hours. If you send a whole playlist, its name is kept too, for
  the same time. Then it is deleted. It holds no personal name, IP or device data.
- **Reading a YouTube playlist:** when you paste the link of a public playlist, the Hub asks YouTube
  for it to show you its songs. It stores nothing about this.
- **Abuse limits:** your IP address is used only as a hash with a daily salt, to limit abuse, and
  is never stored in the clear.
- **Friend groups:** see the next section.
- No usage statistics are collected, except the listening you choose to share with your groups.

### Friend groups (optional)

If you create or join a group, the Hub stores the group name, your nickname and a hash of a random
key generated on your device. It does not store your email, your name, your IP in the clear or any
music. Other members of the group can see your nickname.

If you also turn on **Share my listening with my groups** (off by default), the app sends, for each
month, your minutes, plays and your top songs and artists. Only the people in your groups can see
them. Skipped songs, radio and podcasts are never sent. Turning this on also turns on your Recap on
that device.

- **Legal basis:** your explicit consent (GDPR art. 6.1.a). You can withdraw it at any time.
- **Retention:** listening data for the last 12 months; older months are deleted automatically. A
  group with no activity for about 180 days is deleted with its members and shared items. Shared
  playlists and Jams disappear when their link or Jam expires.
- **How to delete it:** turn the switch off (deletes your listening from the Hub and keeps you in
  your groups), leave a group from its screen, or use **Delete all my group data** (leaves every
  group and deletes your listening). A person removed by the group's creator is kept on a ban list
  by key hash until the group is deleted.

### Usage statistics

Aske Stream does not send usage statistics to anyone, apart from the listening you choose to share
with your groups (above). If that ever changes, it will happen only with your explicit permission
and will be off by default.

The app has an optional listening Recap, off by default. If you turn it on, it saves which songs
you listen to, for how long and which ones you skip (not radio or podcasts). This history is
stored on your device and is not sent to anyone (not to us, nor to Google or Cloudflare), unless
you turn on sharing with friend groups (above). Turning the Recap off deletes the whole history, and you can also delete it from Settings.

Study mode saves, only if the Recap is on, which study sessions you finished and for how long. They
stay on your device, are deleted with the history and are never sent to anyone, not even to your groups.

### Your control

Everything is stored on your device or in your own accounts, so you can delete it whenever you
want. Removing the app, or its access in your Google account, ends all access.

### Contact

Open an issue at <https://github.com/Ando144/aske-stream/issues>.

## Español

**En resumen: tu música y tus datos se quedan contigo. Aske Stream no tiene servidores propios
que reciban tu información, no tiene anuncios ni rastreo, y no vende nada.**

- **Dónde se guarda tu música:** tú eliges. En este dispositivo, en tu propio Google Drive (en una
  carpeta privada que no se comparte) o en tu propia cuenta de Cloudflare.
- **Datos de Google:** si eliges Drive, la app pide un único permiso (`drive.file`): ver y
  gestionar **solo los archivos que ella misma ha creado**. No puede ver el resto de tu Drive.
  Los datos van solo entre tu dispositivo y Google: no se envían a nosotros ni a nadie, no se
  comparten, no se venden, no se usan para publicidad ni para entrenar modelos de IA. Puedes
  quitar el acceso cuando quieras en <https://myaccount.google.com/permissions>.
- **Otros servicios:** YouTube (para buscar y descargar), el catálogo público de radios, GitHub
  (para buscar actualizaciones) y tu propio Drive o Cloudflare.
- **Aske Hub (playlists compartidas y Jams):** solo si usas estas funciones opcionales. Es un
  servidor pequeño que **nunca guarda música**. El nombre de la playlist y las referencias de las
  canciones se guardan 90 días y luego se borran; los apodos y la cola de una Jam, solo mientras
  dura (12 horas como mucho). Al enviar canciones a un móvil, la lista (ids de YouTube, títulos y
  artistas) se guarda hasta que el otro móvil la recibe, y 24 horas como mucho; si envías una
  playlist entera, su nombre se guarda el mismo tiempo; luego se borra, y no lleva nombre de
  persona, IP ni datos del dispositivo. Al pegar el enlace de una playlist pública, el Hub se la
  pide a YouTube para enseñarte sus canciones y no guarda nada de eso. Tu IP se usa únicamente como hash con sal diaria para limitar
  abusos, nunca en claro. No hay estadísticas, salvo las escuchas que tú decidas compartir con tus
  grupos (ver abajo).
- **Grupos de amigos (opcional):** si creas un grupo o entras en uno, el Hub guarda el nombre del
  grupo, tu apodo y un hash de una clave aleatoria de tu dispositivo (no tu email, ni tu nombre, ni
  tu IP en claro, ni música); los demás miembros ven tu apodo. Si además activas «Compartir mis
  escuchas con mis grupos» (apagado por defecto), se envían, por cada mes, tus minutos, tus
  reproducciones y tus tops de canciones y artistas, y solo los ve la gente de tus grupos. Nunca se
  envían canciones saltadas, radio ni podcasts. Activarlo también enciende tu Recap en ese
  dispositivo. **Base legal:** tu consentimiento explícito, que puedes retirar cuando quieras.
  **Plazos:** escuchas de los últimos 12 meses (lo anterior se borra solo); un grupo sin actividad
  durante unos 180 días se borra con sus miembros y lo compartido. **Cómo borrarlo:** apaga el
  interruptor (borra tus escuchas del Hub y sigues en tus grupos), sal del grupo, o pulsa «Borrar
  todos mis datos de grupos» (sales de todos y se borran tus escuchas). A quien expulsa el creador
  se le guarda un veto (hash de la clave) hasta que se borra el grupo.
- **Estadísticas:** no se envían estadísticas de uso a nadie, salvo las escuchas que decidas
  compartir con tus grupos. Si algún día se envían otras, será solo con tu permiso explícito y
  estarán desactivadas por defecto.
- **Recap de escuchas (opcional, apagado por defecto):** si lo activas, se guarda qué canciones
  escuchas, cuánto tiempo y cuáles saltas (no radio ni podcasts). Se guarda solo en tu dispositivo
  y no se envía a nadie (ni a nosotros ni a Google ni a Cloudflare), salvo que actives compartirlo
  con tus grupos. Desactivarlo borra todo el
  historial, y también puedes borrarlo desde Ajustes.
- **Modo estudio:** solo si el Recap está activado, se guardan las sesiones de estudio que
  terminas y cuánto duraron. Se quedan en tu dispositivo, se borran con el historial y nunca se
  envían a nadie, tampoco a tus grupos.
- **Contacto:** abre una incidencia en <https://github.com/Ando144/aske-stream/issues>.

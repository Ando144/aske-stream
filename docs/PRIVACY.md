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
- **Abuse limits:** your IP address is used only as a hash with a daily salt, to limit abuse, and
  is never stored in the clear.
- No usage statistics are collected.

### Usage statistics

Aske Stream does not send usage statistics to anyone. If that ever changes, it will happen only
with your explicit permission and will be off by default.

The app has an optional listening Recap, off by default. If you turn it on, it saves which songs
you listen to, for how long and which ones you skip (not radio or podcasts). This history is
stored only on your device and is not sent to anyone (not to us, nor to Google or Cloudflare).
Turning the Recap off deletes the whole history, and you can also delete it from Settings.

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
  dura (12 horas como mucho). Tu IP se usa únicamente como hash con sal diaria para limitar
  abusos, nunca en claro. No hay estadísticas.
- **Estadísticas:** no se envían estadísticas de uso a nadie. Si algún día se envían, será solo
  con tu permiso explícito y estarán desactivadas por defecto.
- **Recap de escuchas (opcional, apagado por defecto):** si lo activas, se guarda qué canciones
  escuchas, cuánto tiempo y cuáles saltas (no radio ni podcasts). Se guarda solo en tu dispositivo
  y no se envía a nadie (ni a nosotros ni a Google ni a Cloudflare). Desactivarlo borra todo el
  historial, y también puedes borrarlo desde Ajustes.
- **Contacto:** abre una incidencia en <https://github.com/Ando144/aske-stream/issues>.

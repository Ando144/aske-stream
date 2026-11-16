# Google Drive

Google Drive is one of the three places where a library can live (with "This
device" and Cloudflare). It needs nothing but a Google account, and the app
never sees anything in that account except the files it created itself.

## What ends up in the user's Drive

```
Aske Stream/
├─ library.json   songs, playlists, likes and radios (one small JSON file)
├─ audio/         one file per song: "Artist - Title.webm" (or .m4a, .mp3…)
└─ covers/        square JPEG covers, named after the song id
```

Everything is a normal file: people can see their music in drive.google.com,
and nothing breaks if they stop using the app.

## How it works

| Part             | Where                    | What it does                                                                                                                                                                                                     |
| ---------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission       | `drive.file` scope       | Access only to files the app created or the user opened with it. It is a _non-sensitive_ scope, so the app needs no Google security review.                                                                      |
| Sign-in, Android | `GoogleDrivePlugin.java` | Google Play services Identity `AuthorizationClient`. First time: account picker + "Allow". Afterwards a fresh token is returned silently every time.                                                             |
| Sign-in, web     | `storage/drive/auth.ts`  | Google Identity Services token client (pop-up). Tokens last one hour and browsers block pop-ups nobody tapped, so when one expires a "Reconnect" bar asks for a tap. The token is kept in `sessionStorage` only. |
| Drive client     | `storage/drive/api.ts`   | `fetch` against Drive v3: find/create folders, resumable uploads, downloads, quota. Retries once with a new token after a 401; every request has a timeout.                                                      |
| Library file     | `storage/drive/doc.ts`   | Every song, playlist and radio carries `updatedAt`; deletions leave a dated mark. Merging two copies keeps the newest version of each item; a deletion is final. Pure functions with unit tests.                 |
| Home             | `storage/drive/home.ts`  | Implements `LibraryHome`. Changes are applied to a local copy (IndexedDB) at once and sent to Drive 3 s later (merging with whatever another device wrote meanwhile). Offline changes are sent when back online. |
| Playback         | `storage/media.ts`       | Drive only accepts the token in a header, which `<audio>` cannot send, so the song is fetched and played from a `blob:` URL. Covers are cached on the device after the first time.                               |
| Offline          | `stores/offline.ts`      | Drive songs rotate in the offline cache exactly like Cloudflare songs.                                                                                                                                           |
| Moving music     | `stores/copyToDrive.ts`  | After switching from "This device", offers to upload songs, likes and playlists. Resumable, never uploads twice, deletes nothing.                                                                                |

Tests: `apps/web/test/driveDoc.test.ts` (merge rules) and two browser tests
that run the whole flow against an in-memory fake of the Drive API (Android
build with a fake Google plugin, and the web build with a fake Google script).

## Setting up Google (once, by whoever publishes the app)

Google has to know the app before it lets anyone sign in. This is free and
takes about 15 minutes in [Google Cloud Console](https://console.cloud.google.com/).

1. **Create a project**: project picker → _New project_ → name it `Aske Stream` → _Create_.
2. **Turn on the Drive API**: _APIs & Services → Library_ → search "Google Drive API" → _Enable_.
3. **Consent screen** (_Google Auth Platform_):
   - _Branding_: app name `Aske Stream`, your support email, logo optional, developer email.
   - _Audience_: **External**. Then **Publish app** (status "In production"). While it says
     "Testing", only the test users you list can sign in.
   - _Data access_: _Add or remove scopes_ → tick `.../auth/drive.file` → _Update_ → _Save_.
     Because `drive.file` is not sensitive, Google does not ask for verification.
4. **Web client** (_Clients → Create client_):
   - Type **Web application**, name `Aske Stream web`.
   - _Authorised JavaScript origins_: your Worker address, e.g.
     `https://aske-stream.<you>.workers.dev` (add `http://localhost:5173` to try it locally).
   - _Create_, copy the **Client ID** (`…apps.googleusercontent.com`) and paste it in
     `GOOGLE_WEB_CLIENT_ID` in `apps/web/src/config.ts`. It is public by design (it is in
     every page Google serves); there is no client secret to keep.
5. **Android client** (_Clients → Create client_):
   - Type **Android**, package name `io.github.ando144.askestream`.
   - _SHA-1 certificate fingerprint_ of the key that signs the APKs. For the release key:
     `keytool -list -v -keystore .secrets/aske-release.keystore -alias <alias>` and copy the
     `SHA1:` line.
   - _Create_. Nothing to copy: Google recognises the app by package name + signature.
6. `npm run deploy` (web) and publish a new APK. Done.

A fork signed with another key, or a debug build, needs its own Android client
(step 5 with that key's SHA-1); otherwise sign-in fails with `DEVELOPER_ERROR 10`,
which the app explains in plain words.

## Privacy

- Only `drive.file`: the app cannot list, read or change anything else in the Drive.
- No server in between: the phone or browser talks to Google directly.
- Revoking access: in the app (_Settings → Disconnect Google Drive_) or for every
  device at [myaccount.google.com/connections](https://myaccount.google.com/connections).
  Revoking does not delete the music; deleting the "Aske Stream" folder does.

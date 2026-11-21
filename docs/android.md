# Android app

The Android app is the same React app as the web version, wrapped in
[Capacitor 8](https://capacitorjs.com/) with a few native pieces. It is
distributed as an APK through GitHub Releases (not the Play Store) and updates
itself from inside the app.

```
apps/mobile/
├─ capacitor.config.json      app id, web folder, mixed content, safe-area insets
├─ scripts/gradle.mjs         runs the Gradle wrapper on any OS
└─ android/                   native project (committed; build output is ignored)
   └─ app/src/main/java/io/github/ando144/askestream/
      ├─ MainActivity.java     registers our plugins
      ├─ AskeNativePlugin.java keep-awake + in-app updates
      ├─ DownloaderPlugin.java YouTube downloads with yt-dlp (search fallback, playlists, engine updates)
      ├─ GoogleDrivePlugin.java Google sign-in for Drive (Play services Identity, drive.file only)
      └─ DownloadService.java  foreground service + progress notification while downloading
```

## How playback works in the background

Playback stays in the WebView's `<audio>` element, so the queue, offline cache,
device files, podcasts and radio share one code path with the web app.

| Problem on Android                                       | Solution                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| WebViews have no system media notification               | `@capgo/capacitor-media-session`: native media session + notification + lock-screen controls                              |
| The OS may kill a background app                         | That plugin runs a `mediaPlayback` foreground service while something is playing or paused                                |
| Streaming can stall with the screen off                  | `AskeNative.keepAwake` holds a partial wake lock + Wi-Fi lock only while playing (renewed every 10 min, expires after 30) |
| `http://` radio streams are blocked inside an https page | `allowMixedContent` + `usesCleartextTraffic` (only audio streams are http)                                                |
| Back button would close the app and stop the music       | Back closes what is open, goes back, and on the home screen moves the app to the background                               |

`apps/web/src/native/mediaControls.ts` hides the difference: the browser uses
the standard Media Session API, the app uses the native plugin.

## YouTube downloads

The phone downloads; the Worker never touches YouTube audio (datacenter IPs
are blocked and it would not be the owner's own traffic).

| Piece          | How                                                                                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine         | [youtubedl-android](https://github.com/yausername/youtubedl-android) 0.18: Python 3.12 + yt-dlp + **QuickJS** (yt-dlp needs a JavaScript runtime for YouTube since 2025.11). No ffmpeg: audio is kept as downloaded (Opus in WebM), nothing is re-encoded |
| Engine updates | `YoutubeDL.updateYoutubeDL(STABLE)` fetches the latest yt-dlp from its GitHub releases: automatically once a week and before the first download, or by hand (Download → Downloader → Update). No app update needed when YouTube changes                   |
| Search         | YouTube's own search API (InnerTube, `packages/shared/src/youtube.ts`) through `CapacitorHttp` (no CORS in the app); YouTube Music for "Songs". If it ever returns nothing, falls back to `yt-dlp ytsearch20:`                                            |
| Queue          | `apps/web/src/stores/downloads.ts`: one song at a time, persisted (survives closing the app), duplicates skipped by YouTube id, playlists optionally recreated in the library                                                                             |
| Where songs go | Library on the phone → OPFS like imported files. Cloudflare library → uploaded through `/api/ingest/tracks` (WebM accepted), optionally kept on the phone in the offline cache without downloading it again                                               |
| Covers         | Video thumbnail (maxres, then hq), centre-cropped to a square JPEG in a canvas                                                                                                                                                                            |
| Metadata       | Same cleanup rules as the CLI (`metadataFromYoutube`: "Artist - Title (Official Video)" → artist + title; YouTube Music fields when present)                                                                                                              |
| Background     | `DownloadService` (`dataSync` foreground service) with a progress notification whose texts come from the web side (user's language)                                                                                                                       |
| Size           | One APK per processor type (Python is ~15 MB each): `aske-stream-X.apk` (arm64, nearly all phones), `aske-stream-armv7-X.apk` (old 32-bit phones). The updater picks the right one                                                                        |

"Send to phone": on the computer (Cloudflare library) the Download screen
searches through the Worker (`/api/youtube/search`) and stores picks in D1
(`send_queue`, migration 0003). The app checks that list on start, when it
comes back to the foreground and every 5 minutes while open, downloads, and
marks each item done (with a count) or failed (with the reason).

Browser tests of these flows run against fake native plugins:
`vite build --mode fakenative` swaps `src/native/{platform,downloader,askeNative,googleDrive}`
for `apps/web/test/fake-native/*`.

### Downloads in the background

The queue runs in JavaScript, so it only advances while the WebView renderer is alive. Android
demotes (and can freeze or kill) the renderer of a hidden WebView that is not playing audio.
While the queue is active, `Downloader.setNotification({ active: true })` starts the foreground
service and sets the renderer priority to "important" without lowering it when hidden; with
`active: false` it returns to the default. Capacitor keeps the WebView timers running on pause
(`KeepRunning` defaults to true), so `MainActivity` needs no changes. If Android refuses to start
the service from the background, the reason is logged (`Log.w`) and downloads go on without it.
A fully native queue would be the next step if this is not enough.

## Google Drive sign-in

`GoogleDrivePlugin` asks Google Play services for a Drive token with the
`drive.file` permission (`Identity.getAuthorizationClient`). The first time,
Google shows its account picker and "Allow" screen; after that every call
returns a fresh token silently. Google recognises the app by its package name
and the SHA-1 of the signing key, so a build signed with another key (a debug
build, or a fork) gets `DEVELOPER_ERROR 10` until its own Android OAuth
client exists. Setup: [google-drive.md](google-drive.md).

## Cloudflare setup and QR plugins

- `CloudflareApiPlugin` (`CloudflareApi`): makes the HTTPS calls to `api.cloudflare.com/client/v4`
  for the in-app Cloudflare wizard (the WebView cannot, because of CORS). It takes a bearer token,
  JSON or text multipart parts, and returns status and body. The token is never saved or logged.
- `QrScannerPlugin` (`QrScanner`): opens the Google Play services code scanner to read a
  pairing QR. It rejects with `cancelled` or `unavailable` (no Play services).
- `cf-bundle`: the build copies the Worker (`index.js`), a `manifest.json` (version,
  migrations, asset hashes) and the web files (`site/`) into the APK assets, served at
  `https://localhost/cf-bundle/…`. Generated by `scripts/bundle-worker.mjs`; it adds about 2-4 MB.

## Permissions

| Permission                                                | Why                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `INTERNET`                                                | Streaming, Google Drive, your Cloudflare, radio catalogue, update check   |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Keep playing with the screen off, with the playback notification          |
| `WAKE_LOCK`                                               | Keep CPU and Wi-Fi awake while (and only while) music plays               |
| `REQUEST_INSTALL_PACKAGES`                                | In-app updates. Android still asks the user to confirm every installation |

No contacts, location, microphone or storage-wide permission is requested. `allowBackup` is off so the device token never ends up in a cloud backup.

## Send to phone through the Hub

Browsers cannot download from YouTube, so people without Cloudflare (a computer using Drive or
"This device") can send songs to a phone through the Aske Hub. The sender picks songs, the Hub
stores only the references (YouTube id, title, artist) under a one-time 6-symbol code, and the
sender's screen shows it with a QR. On the phone, **Download → Receive** scans the QR (or takes the
typed code), claims the list (which deletes it) and queues the songs in the downloader. Any phone
can also send to another phone: select songs in the library, or use the play queue, and the
sending phone shows the QR. Only songs that come from YouTube can be sent. The list expires after
24 hours. See `docs/hub.md`.

## In-app updates

1. Once a day (and from **Settings → App → Check for updates**) the app asks
   `api.github.com/repos/Ando144/aske-stream/releases/latest`.
2. If the release is newer than the installed version and has an `.apk`
   asset, Settings shows it with its notes; a toast announces it once.
3. **Update now** downloads the APK natively into the app's private cache
   (https only, redirects followed, size-capped, progress shown).
4. The first time, Android requires "Install unknown apps" for Aske Stream.
   The app explains it in plain words, opens that screen, and continues by
   itself when the user comes back.
5. Android's installer asks for confirmation and only accepts the update if
   it is signed with **the same key** as the installed app. Data is kept.

Versions come from the root `package.json` (`0.2.0` → `versionCode` 200).

## Releasing a new version

1. Bump `"version"` in the root `package.json` (and the workspaces) and add
   `docs/releases/v<version>.md` with the notes users will see.
2. Commit, then `git tag v<version>` and `git push --follow-tags`.
3. The **Android app** workflow builds the signed APK, checks the tag matches
   the version and publishes the GitHub Release. Every installed app offers
   the update within a day.

Running the workflow by hand ("Run workflow") builds a test APK as a
downloadable artifact without publishing anything.

## Signing key

The release key lives **outside git**, in `.secrets/` at the repository root
(ignored), with a Spanish read-me explaining what each file is. GitHub Actions
gets it from four repository secrets:

| Secret                      | Value                                     |
| --------------------------- | ----------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | `aske-release.keystore` encoded as base64 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password                         |
| `ANDROID_KEY_ALIAS`         | `aske-stream`                             |
| `ANDROID_KEY_PASSWORD`      | key password                              |

**Back up `.secrets/`.** Losing the key means existing installs can no longer
be updated (users would have to uninstall, losing music stored on the phone).

## Building locally (optional)

Needs JDK 21 and the Android SDK (platform 36). With `ANDROID_HOME` set:

```bash
npm run android:apk          # signed release APK if .secrets/ exists, else unsigned
npm run apk:debug -w @aske/mobile
```

Output: `apps/mobile/android/app/build/outputs/apk/`.

## Known limits

- **Offline rotation with the app fully closed** is not done yet. Android's
  background workers (WorkManager) cannot reach the WebView's storage where the
  offline songs live, so this needs the cache to move to native storage first.
  It needs the offline cache to move to native storage first. Today the
  rotation runs whenever the app is open or playing, which covers normal use.
- iPhone: no app; the web version works in Safari (background playback there
  depends on WebKit).
- YouTube sometimes asks downloaders to prove they are not a robot ("Sign in
  to confirm you're not a bot"). It depends on YouTube and the network; the app
  explains it and the fix is usually waiting and updating the downloader.
- Only download what you have the right to, for personal use.

## Storage budget

`GET /api/library/storage` sums the audio sizes (plus ~80 KB per cover) and
returns the budget, 10 GB by default (`STORAGE_LIMIT_GB` var): Cloudflare R2's
free allowance. Uploads stop at 95 % of it with `507 storage_full`, so the
bill stays at zero. Settings → Storage shows it, together with the songs on
the phone, the offline copies and the phone's free space.

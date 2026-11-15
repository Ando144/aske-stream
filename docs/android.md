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
      ├─ MainActivity.java     registers our plugin
      └─ AskeNativePlugin.java keep-awake + in-app updates
```

## How playback works in the background

Playback stays in the WebView's `<audio>` element, so the queue, offline cache,
device files, podcasts and radio share one code path with the web app.

| Problem on Android                                       | Solution                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| WebViews have no system media notification               | `@capgo/capacitor-media-session`: native media session + notification + lock-screen controls |
| The OS may kill a background app                         | That plugin runs a `mediaPlayback` foreground service while something is playing or paused   |
| Streaming can stall with the screen off                  | `AskeNative.keepAwake` holds a partial wake lock + Wi-Fi lock only while playing             |
| `http://` radio streams are blocked inside an https page | `allowMixedContent` + `usesCleartextTraffic` (only audio streams are http)                   |
| Back button would close the app and stop the music       | Back closes what is open, goes back, and on the home screen moves the app to the background  |

`apps/web/src/native/mediaControls.ts` hides the difference: the browser uses
the standard Media Session API, the app uses the native plugin.

## Permissions

| Permission                                                | Why                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `INTERNET`                                                | Streaming, your Cloudflare, radio catalogue, update check                 |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Keep playing with the screen off, with the playback notification          |
| `WAKE_LOCK`                                               | Keep CPU and Wi-Fi awake while (and only while) music plays               |
| `REQUEST_INSTALL_PACKAGES`                                | In-app updates. Android still asks the user to confirm every installation |

No contacts, location, microphone, storage-wide or notification permission is
requested. `allowBackup` is off so the device token never ends up in a cloud backup.

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
  It is planned together with phase 3 (native YouTube downloads). Today the
  rotation runs whenever the app is open or playing, which covers normal use.
- iPhone: no app; the web version works in Safari (background playback there
  depends on WebKit).

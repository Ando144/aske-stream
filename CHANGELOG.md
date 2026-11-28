# Changelog

All notable changes to Aske Stream are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.7] - 2026-11-28

### Changed

- New opening animation: the logo bars draw themselves and shine, and move like an equalizer while
  the app is slow to load. Android no longer shows another icon first.

### Fixed

- Cancelling a song that is being saved while offline, or with an outdated server, is remembered and
  the song is deleted once the connection returns or the server is updated. On Google Drive this can
  take a few minutes.
- Cancelling just as a download finishes no longer shows an error or a "Deleted" notice.
- Repeating a server update that stopped halfway no longer gets stuck.

## [0.9.6] - 2026-11-28

### Fixed

- Cancelling a download deletes only what belongs to that download, including slow uploads and
  half-uploaded files on Google Drive.
- "Share to Aske Stream" shows a single notice and says when the song is already in your library or
  being downloaded.
- Study mode: the arrow keys change playlist when using a keyboard.
- Narrow phones show the whole library title; the top buttons show icons only.
- Groups: oversized photos are always rejected, and the app no longer requests photos that an older
  server does not have.

## [0.9.5] - 2026-11-27

### Added

- Share from YouTube or YouTube Music to Aske Stream to download a song or pick songs from a
  playlist (Android).
- "Load more" at the end of the YouTube search results.

### Changed

- Every song and playlist has an image: its cover, the YouTube thumbnail or an amber drawing. Study
  mode picks the playlist from a list with covers.
- Swiping in the player brings the next or previous song along with your finger, and lists show a
  filling circle when a song is about to be queued.
- The startup screen shows only the logo.
- Thumbnails for songs outside your library, and the title when sharing, are requested directly from
  YouTube, as explained in the privacy policy.

## [0.9.4] - 2026-11-26

### Added

- Anyone in a Jam can skip the current song, once every 2 seconds. The host must update the app.
- A bar with the current song and a Next button for Jam guests whose phone is not playing.
- Groups: any member can change the name and photo, and an invite code shows both, plus the number of
  members, before you join.

### Changed

- New Groups design, with the minutes of the month, who else is listening (only those who share) and
  a monthly summary per group.

### Fixed

- Cancelling while saving to Cloudflare or Drive deletes the song if it reached the cloud.
- "Select" also appears inside folders, the Sort menu works with a keyboard and playlist selection
  closes when you change screen.

## [0.9.3] - 2026-11-26

### Added

- Podcasts grouped by series with episodes in order; move episodes, rename series and move several
  tracks to Podcasts at once.
- Swipe the mini player to go to the next or previous song.
- Jam: send songs from your library and search them in a single search box.
- Covers when sending songs and in shared lists.

### Changed

- Shuffle keeps the same order until every song has played; reshuffle from Settings.
- With Cloudflare, audio over 95 MB is kept only on the phone.

### Fixed

- Downloads no longer get stuck: you can cancel while saving and remove failed items, and long audio
  no longer blocks the other songs.
- The invite QR code is centred and the Select button has more room.

## [0.9.2] - 2026-11-25

### Added

- A shuffle switch next to Play.

### Changed

- Send is in the menu of every song and playlist; long press to select several and send them.
- Sharing your listening and deleting your data moved to Settings, leaving a cleaner Groups screen.

### Fixed

- The Sort button is no longer cut off on small screens.
- Pausing while a song loads no longer lets it start on its own.

## [0.9.1] - 2026-11-25

### Changed

- Clearer Send and Receive screens, easier-to-press touch buttons and a better theme selector.
- Groups can be opened from Playlists.

### Fixed

- Cloud music that stopped when the screen turned off now resumes by itself at the same point.
- The notification no longer keeps advancing while the music is stopped.
- Small fixes in shuffle, selection and study mode.

## [0.9.0] - 2026-11-23

### Added

- Study mode (Android): pins the app for the minutes you choose, with limited controls and a
  30-second long press to leave early.
- Calm music mix, or a playlist of your choice.
- Ambient sounds (white, grey and brown noise, rain and waves) with their own volume.
- Gentle ending with a soft chime, and a study history stored only on the phone when Recap is on.

## [0.8.7] - 2026-11-23

### Added

- Friend groups of up to 20 people: invite by code or QR and share playlists and Jams.
- Optional group statistics covering the last 12 months, off by default, asked for first and deleted
  from the server when turned off.

### Changed

- Smoother opening animation; with reduced motion it only fades.

## [0.8.6] - 2026-11-23

### Changed

- New opening animation, shown still when reduced motion is on.
- The connection diagnostic used when pairing phones asks your own server instead of Google.

### Fixed

- The download progress bar advances continuously across the whole batch.
- The Jam button fits its label and Receive is separated from the YouTube search box.
- No more false "incomplete list" notice when a playlist is cut at 1000 songs.

## [0.8.5] - 2026-11-22

### Added

- "Send to phone" accepts a YouTube playlist link: untick songs and send up to 1000.
- The songs arrive as a playlist with the same name.

### Changed

- Private, deleted or blocked songs are skipped and counted at the end.
- Automatic Mixes, "Liked" and "Watch later" lists show a clear message explaining why they cannot be
  opened.

## [0.8.4] - 2026-11-22

### Changed

- The download notification shows the count, batch progress and saving state, followed by a separate
  summary when it finishes.
- With a bad connection, the app opens your downloaded music instead of waiting.
- Shuffle remembers what you have heard in each list, plays everything once before repeating and
  includes newly downloaded songs.

### Fixed

- The download notification no longer freezes or flickers.

## [0.8.3] - 2026-11-21

### Added

- Send songs to another device with a 6-character code or a QR, valid once and for 24 hours. No audio
  or personal data is sent.
- Send the whole playback queue to another phone.

### Fixed

- Clearing the YouTube search box also clears the results.
- Clearing the list with downloads in progress no longer loses songs.

## [0.8.2] - 2026-11-20

### Changed

- When Android pauses the download service after a long run, the queue is saved, you are notified and
  it resumes when you open the app.
- The downloads help article explains this pause.

### Fixed

- Cancelling and clearing saves already downloaded songs to your playlist first.
- A rare Android failure can no longer delete the whole downloads folder.

## [0.8.1] - 2026-11-20

### Changed

- Android downloads continue after you swipe the app away.
- Without a connection, downloads wait and resume by themselves; failed songs are retried with
  increasing delays.
- Downloads and uploads have a time limit, so a bad connection no longer blocks the queue.
- Faster saving to the library, especially on Google Drive.

### Fixed

- The add radio button is icon only and the title is no longer cut off.
- The getting started guide no longer flashes when it was already completed.

## [0.8.0] - 2026-11-20

### Added

- Personal statistics and monthly and yearly Recap, opt-in, stored only on your device and deleted
  when turned off.

### Changed

- A Jam open in another tab can be taken over, and after 5 minutes without a connection it offers to
  reconnect or leave.
- The Cloudflare wizard keeps your token when the chosen name is taken.
- Offline cache rotation only runs while charging, or on Wi-Fi without battery saver.
- Settings are organised into sections.

### Fixed

- Several Basque texts in sharing and Jams.

## [0.7.0] - 2026-11-20

### Added

- Shared playlists through a short link that lasts 90 days and can be revoked.
- Jams: guests join by QR, also from the browser, add and like songs with just a nickname, while an
  Android host plays the music. A Jam lasts up to 12 hours.
- New help articles in Basque, Spanish and English.

### Fixed

- The button on the device linking screen no longer overlaps the divider.

## [0.6.0] - 2026-11-20

### Added

- Link another device with a QR or a single-use code valid for 10 minutes, or by sharing the link.
- Guided assistant in the Android app that creates your Cloudflare server without storing the key.
- One-tap server update that keeps your music.
- New help articles in Basque, Spanish and English.

## [0.5.5] - 2026-11-19

### Added

- Drag to reorder playlists, also inside folders.
- Pin playlists and folders to the top.

### Changed

- Playlist header buttons are always icons only.
- Lower battery use: no high-power Wi-Fi and no background work while nothing is playing.
- Ordering and pinning on Cloudflare require updating your server.

## [0.5.4] - 2026-11-19

### Added

- Drag to reorder folders; the order is stored with your music and copied with it.

### Changed

- Dragging one playlist onto another no longer merges them; use "Merge with…" in the menu.
- New folders appear at the end of the list.
- Ordering folders on Cloudflare requires updating your server.

### Fixed

- The Playlists screen no longer scrolls sideways.

## [0.5.3] - 2026-11-18

### Added

- Folders for playlists, with drag and drop.
- Playlist covers: a mosaic by default or your own picture.
- "Merge with…" to combine two playlists without duplicates.
- Folders and covers are included when copying between storage locations.

### Changed

- The sleep timer has a clear button to remove it.
- The app warns when your Cloudflare server is too old for folders and covers.

## [0.5.2] - 2026-11-18

### Added

- Copy music, likes, playlists and radios between this device, Google Drive and Cloudflare, with
  progress, cancel and resume. Nothing is deleted from the source.
- An offer to copy your music when you change storage location.
- An explanation of the Google "unverified app" notice, plus new help articles.

### Changed

- Only Opus audio is copied to Cloudflare; the app says how many songs are left out.

## [0.5.1] - 2026-11-18

### Added

- Sleep timer: stop after a chosen time or at the end of the song.
- Choose between merging or creating a new playlist when importing one with an existing name.

### Changed

- The Google Drive library stays lighter by forgetting deletions older than 180 days.

### Fixed

- YouTube playlists are read in full and keep their order, and large previews are no longer empty.
- Correct download counter and more reliable background downloads on Android.
- Deleting the current song skips to the next one.

## [0.5.0] - 2026-11-16

### Added

- Google Drive storage: the app only sees the folder it creates. Changes made offline are sent when
  the connection returns.
- Rotating offline selection for Drive music on the phone.
- Move music stored on the device to Drive, keeping likes and playlists.
- Drive usage and free space in Settings, and five new help articles.
- "Reconnect" prompt in the browser when Google asks for confirmation.
- The author's name in About, the sidebar and the introduction.

## [0.4.0] - 2026-11-16

### Added

- First-run introduction and a getting started checklist in the Library.
- A tip on each screen the first time you open it.
- Help centre with 28 searchable articles in Basque, Spanish and English.

### Changed

- Clearer texts for the Cloudflare connection, radio, offline music and the empty library.

## [0.3.1] - 2026-11-16

### Added

- Settings → Storage shows song size, free phone space and Cloudflare usage; the app never uploads
  beyond the free 10 GB.

### Changed

- Downloads continue with the screen off, with help if battery saving stops them.
- The notification shows how many songs are done and left.
- Playlist previews load faster (up to 2,000 songs) and explain failures.
- Search results appear right below the search box.

## [0.3.0] - 2026-11-15

### Added

- Download tab: search or paste YouTube and YouTube Music links, with background downloads and
  playlist import.
- Weekly self-update of the downloader.
- With Cloudflare, upload downloads and send songs from the computer to the phone.
- Imported files keep their title, artist, album and cover.
- Separate APK for old 32-bit phones.

### Changed

- Offline settings moved to Settings → Offline music.

## [0.2.1] - 2026-11-15

### Changed

- Connection errors explain the cause: no internet, mistyped address or outdated server.
- The server address is corrected automatically.
- The keyboard no longer autocorrects the address.

## 0.2.0 - 2026-11-15

### Added

- First version of the Android app.
- Playback with the screen off, with notification and lock screen controls.
- Radio stations that only broadcast over `http://` also play in the app.
- In-app updates from Settings.
- The Back button closes what is open and, on the main screen, keeps music playing in the background.

## Full release notes

Complete notes for each published version are on
[GitHub Releases](https://github.com/Ando144/aske-stream/releases). The files in `docs/releases/`
are the notes that users read inside the app, written in Spanish; this changelog is their English
summary.

[0.9.7]: https://github.com/Ando144/aske-stream/releases/tag/v0.9.7
[0.9.6]: https://github.com/Ando144/aske-stream/releases/tag/v0.9.6
[0.9.5]: https://github.com/Ando144/aske-stream/releases/tag/v0.9.5
[0.9.4]: https://github.com/Ando144/aske-stream/releases/tag/v0.9.4
[0.9.3]: https://github.com/Ando144/aske-stream/releases/tag/v0.9.3
[0.9.2]: https://github.com/Ando144/aske-stream/releases/tag/v0.9.2
[0.9.1]: https://github.com/Ando144/aske-stream/releases/tag/v0.9.1
[0.9.0]: https://github.com/Ando144/aske-stream/releases/tag/v0.9.0
[0.8.7]: https://github.com/Ando144/aske-stream/releases/tag/v0.8.7
[0.8.6]: https://github.com/Ando144/aske-stream/releases/tag/v0.8.6
[0.8.5]: https://github.com/Ando144/aske-stream/releases/tag/v0.8.5
[0.8.4]: https://github.com/Ando144/aske-stream/releases/tag/v0.8.4
[0.8.3]: https://github.com/Ando144/aske-stream/releases/tag/v0.8.3
[0.8.2]: https://github.com/Ando144/aske-stream/releases/tag/v0.8.2
[0.8.1]: https://github.com/Ando144/aske-stream/releases/tag/v0.8.1
[0.8.0]: https://github.com/Ando144/aske-stream/releases/tag/v0.8.0
[0.7.0]: https://github.com/Ando144/aske-stream/releases/tag/v0.7.0
[0.6.0]: https://github.com/Ando144/aske-stream/releases/tag/v0.6.0
[0.5.5]: https://github.com/Ando144/aske-stream/releases/tag/v0.5.5
[0.5.4]: https://github.com/Ando144/aske-stream/releases/tag/v0.5.4
[0.5.3]: https://github.com/Ando144/aske-stream/releases/tag/v0.5.3
[0.5.2]: https://github.com/Ando144/aske-stream/releases/tag/v0.5.2
[0.5.1]: https://github.com/Ando144/aske-stream/releases/tag/v0.5.1
[0.5.0]: https://github.com/Ando144/aske-stream/releases/tag/v0.5.0
[0.4.0]: https://github.com/Ando144/aske-stream/releases/tag/v0.4.0
[0.3.1]: https://github.com/Ando144/aske-stream/releases/tag/v0.3.1
[0.3.0]: https://github.com/Ando144/aske-stream/releases/tag/v0.3.0
[0.2.1]: https://github.com/Ando144/aske-stream/releases/tag/v0.2.1

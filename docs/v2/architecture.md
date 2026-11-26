# Aske Stream v2 — architecture

v2 turns aske-stream from "a cloud you deploy" into **an app non-technical friends can install**,
while keeping every v1 feature. This document is the reference for all v2 work.

## Goals (agreed with the owner)

- Everything v1 does keeps working (library, likes, playlists, radio, smart offline cache, web app, CLI).
- **Android app (APK, no Play Store)** with an in-app **YouTube search & download** (songs and playlists).
- **Choose where music is stored**: this device, Google Drive or Cloudflare — **per song and per playlist**.
- **Downloads from the laptop**: technical users keep the CLI; everyone else uses
  **"Send to phone"** — search on the desktop web app, the phone downloads it.
- Downloader and app **update from inside the app** (no reinstall).
- **In-person Jams**: one phone plays, friends join with a QR and add/vote songs.
- **Admin panel**: anonymous install/active counts; per-person listening stats **only for those who opt in**.
- iPhone: web app only (streaming from Drive/Cloudflare, joining Jams). No native iOS app.
- **Everything explained in plain language** inside the app (eu/es/en): onboarding, help, empty states.

## Core model: one _home_, many _destinations_

```mermaid
flowchart LR
  subgraph App["App (web or Android)"]
    L[("Local library<br/>IndexedDB")]
  end
  L <-- "metadata sync" --> H{{"Home<br/>(one per user)"}}
  L -- "audio files" --> D1["📱 Device"]
  L -- "audio files" --> D2["☁️ Google Drive"]
  L -- "audio files" --> D3["🟠 Cloudflare R2"]
```

- **Home** = where the _library metadata_ lives (tracks, playlists, likes, saved stations).
  One per user, chosen at onboarding: `device` (IndexedDB only), `drive` (a `library.json`
  in the app's private Drive folder) or `cloudflare` (the v1 Worker + D1).
- **Destinations** = where _audio files_ live. A song can be in one or several:
  `track.locations = { device?, drive?, cloudflare? }`. "Save this playlist in Drive" just copies
  the files of its songs there.
- The app always works from the **local library** (instant, offline) and syncs with the home.
- Playback source priority: device file → Cloudflare stream → Drive stream → offline cache.
- The v1 **smart offline cache** keeps working for songs that are _not_ stored on the device.

Why not mix _metadata_ across homes: keeping playlists consistent across three backends would need
a conflict-resolving sync engine; one home + many file destinations gives the same user-visible
flexibility with a fraction of the risk.

## Platforms

|                  | Web (desktop, iPhone)                                   | Android app                                                       |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Tech             | React PWA (v1)                                          | Same React code inside **Capacitor** + native plugins             |
| YouTube download | ❌ → "Send to phone" queue                              | ✅ yt-dlp on the phone (`youtubedl-android`)                      |
| Device storage   | Browser storage (OPFS) — import files from the computer | App storage (OPFS inside the app, never evicted)                  |
| Background audio | Browser                                                 | Native media service (lock screen, notification)                  |
| Offline rotation | While open                                              | While open or playing (with the app closed: planned)              |
| Updates          | Automatic (service worker)                              | In-app: app APK from GitHub Releases, yt-dlp engine from Settings |

## Connecting to Cloudflare from other origins

The Android app runs on its own origin, so v2 adds **device tokens**: pairing returns a signed
token (same HMAC scheme as the cookie) that the app sends as `Authorization: Bearer …`. Media URLs
accept `?t=<token>` because `<audio>` cannot send headers. CORS is enabled for the app origins.
Pairing is done by **scanning a QR code** shown on the web app — nobody types a key.

## Aske Hub (owner's Cloudflare)

A small Worker on the owner's account that **never stores music**:

- **Jams** — one Durable Object per Jam: queue, votes, who is connected (WebSocket).
- **Shared playlists** — short links containing only song references (YouTube ids + titles); each
  friend's app downloads the songs itself.
- **Send to phone** — available: a one-time code (24 h), also between phones; no music is stored.
- **Telemetry** — anonymous install/active pings; opt-in listening stats; admin dashboard.

## Storage guide (shown in the app)

Average song ≈ 3.5 min ≈ **4 MB** (YouTube's Opus audio, stored without re-encoding).

| Songs | Space    |
| ----- | -------- |
| 100   | ≈ 0.4 GB |
| 500   | ≈ 2 GB   |
| 1 000 | ≈ 4 GB   |
| 2 500 | ≈ 10 GB  |

|                  | 📱 This device     | ☁️ Google Drive                                         | 🟠 Cloudflare                              |
| ---------------- | ------------------ | ------------------------------------------------------- | ------------------------------------------ |
| Setup            | None               | Sign in with Google                                     | Guided, ~10 min, card required (free tier) |
| Free space       | Phone's free space | 15 GB shared with Gmail/Photos (≈ 3 500 songs if empty) | 10 GB (≈ 2 500 songs)                      |
| Listen on laptop | No                 | Yes                                                     | Yes (fastest)                              |
| Lost phone       | Music lost         | Kept                                                    | Kept                                       |
| Works offline    | Always             | Only cached songs                                       | Only cached songs                          |

## Phases

| #   | Phase                                                                                                       | Status |
| --- | ----------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Storage layer: local library, home + destinations, device mode, device tokens                               | ✅     |
| 2   | Android app (Capacitor): native audio, device files, in-app updater, CI APK builds                          | ✅     |
| 3   | YouTube search & download (songs, playlists, queue, engine updates) + Send to phone                         | ✅     |
| 4   | Onboarding, tutorial, help centre, plain-language explanations everywhere                                   | ✅     |
| 5   | Google Drive home & destination                                                                             | ✅     |
| 5.1 | Real-use fixes: batch counter, full imported playlists, sleep timer, tombstone prune                        | ✅     |
| 5.2 | Copy in every direction when switching storage                                                              | ✅     |
| 5.3 | One-level folders, covers, merge playlists                                                                  | ✅     |
| 5.4 | Folder order, screen-width fixes, drag clean-up                                                             | ✅     |
| 5.5 | Playlist order & pin, header buttons, battery                                                               | ✅     |
| 6   | Cloudflare guided setup inside the app (+ QR pairing)                                                       | ✅     |
| 7   | Hub: shared playlists and in-person Jams                                                                    | ✅     |
| 7.1 | Send to phone through the Hub: computer → phone and phone → phone (one-time code/QR, 24 h, no music stored) | ✅     |
| 7.2 | Reliability: download notification, slow-network start (splash + offline mode), shuffle cycles              |        |
| 7.3 | Send whole YouTube playlists to the phone (pick songs, Hub reads the list, parcel with a name)              |        |
| 8a  | Local listening stats (opt-in, on this device only) and monthly/yearly Recap                                | ✅     |
| 8   | Telemetry (opt-in) and admin dashboard                                                                      |        |
| 8b  | Friend groups through the Hub                                                                               | ✅     |
| 9   | Study mode: pin the app + focus screen, soft bell and "Time's up" card at the end                           | ✅     |
| 9.1 | v0.9.3 daily use: unstuck downloads, phone-only big audio, podcast shows, fixed shuffle, gestures, Jam      | ✅     |
| 9.2 | v0.9.4: Jam as a remote control for everyone, group name and photo                                          |        |
| 9.3 | v0.9.5: "Share → Aske Stream" and "Load more" in YouTube search                                             |        |

Done between phases 1 and 2 (owner feedback): bulk selection and "Add songs" picker, queue with
two sections and drag & drop, swipe to queue, playlist reordering, Podcasts section (resume,
speed, back 15 / forward 30 s), data saver, http radio stations, a warm theme with a single
amber accent (light and dark), Settings reachable from every screen, switching storage without
re-entering the Cloudflare key, playlists of up to 1 000 songs.

Phase 2 notes: playback stays in the WebView's `<audio>` (one code path with the web app);
a native media session + `mediaPlayback` foreground service keeps it alive and provides the
notification and lock-screen controls. Rotating the offline cache while the app is fully closed
is not done yet: Android's background workers cannot reach the WebView's storage, so it needs
the cache to move to native storage first (planned together with phase 3's native downloads).
Details in [../android.md](../android.md).

Phase 3 notes: yt-dlp runs on the phone (youtubedl-android, with QuickJS), searches use
YouTube's own search API with yt-dlp as fallback, downloads go to the current library
(phone or Cloudflare), "Send to phone" goes through a D1 queue, and imported files now
keep their tags and embedded cover. The "Offline" tab became "Download"; offline settings
moved to Settings → Offline music (the sidebar keeps both).

Phase 4 notes: a four-screen introduction before the storage choice, a first-steps checklist
in the library, one dismissible tip per screen, and a help centre (`apps/web/src/help`) with
28 articles in Basque, Spanish and English, searchable, linked from the setup and connection
screens through a sheet that works before the app is set up. Unit tests keep the three
languages complete and the links between articles valid. Technical wording (pairing, stream
URLs, sync, CLI hints) was rewritten in plain language.

Phase 5 notes: Google Drive is a full home (see [google-drive.md](../google-drive.md)). Only
the non-sensitive `drive.file` permission is requested, so the app sees nothing but its own
"Aske Stream" folder and needs no Google security review. Songs and covers are plain files;
the library is one `library.json` that each device merges with its local copy (newest change
per item wins, deletions are final), so phone and laptop can both edit it, also offline.
Android gets tokens from Google Play services (silent after the first "Allow"); the web uses
Google Identity Services, whose one-hour tokens are renewed with a tap on a "Reconnect" bar.
Drive songs play from a fetched blob (Drive only accepts the token in a header) and rotate
in the offline cache like Cloudflare songs. Switching from "This device" offers to copy the
music, likes and playlists across, resumable and without deleting anything.

Phase 5.2 notes: copying works between any two of device, Drive and Cloudflare. The pure
planner (`storage/copy/plan.ts`) decides what is missing, `run.ts` copies oldest first through a
`CopyEndpoint` per storage, and `stores/copy.ts` keeps the job so it can be resumed. Nothing is
deleted at the source and songs already present (same id map, or same song) are skipped.
Cloudflare only accepts Opus, so other formats are skipped and counted; playlists are capped at
1 000 songs. Radios are copied too. The Google "unverified app" warning is guided in the setup
screen and the help centre.

Phase 6 notes: the Android app can create the whole Cloudflare backend by itself. The user
pastes an API token (never stored, only held in memory) and the app calls the Cloudflare API
through the native `CloudflareApi` plugin (the WebView cannot, CORS): creates D1 and R2, runs
the migrations, uploads the Worker plus the web files from the `cf-bundle` shipped inside the
APK, and enables the `workers.dev` address. The same flow updates an old Worker
(`keep_bindings` keeps `ACCESS_KEY`). Linking more devices uses a one-use pairing code (8
characters, 10 minutes, 5 attempts) shown as a QR and a short code; Android scans it with the
`QrScanner` plugin. `GET /api/health` reports the Worker version so the app can warn when it
is older than the app. Not tested against a real Cloudflare account yet.

Phase 8b notes: friend groups live in the Hub (up to 20 people per group, 10 groups per person),
with no account: a random member id plus a nickname. Groups show a monthly ranking and each
person's top songs and artists, and members share playlists and Jams. The switch "Share my
listening with my groups" only controls listening stats, is off by default and turns on the local
Recap; turning it off deletes your stats from the Hub but keeps you in your groups. Stats are kept
12 months per device, the creator can remove people (a veto, they cannot rejoin) and groups with
no activity for 180 days are deleted. Pending: `hub:migrate:remote`, `deploy:hub`, `deploy` and a
test on two phones.

Phase 9.1 notes: every active download can be cancelled, also while saving, and a watchdog stops
stuck saves. Saving has two independent lanes (cloud, with at most one file over 30 MB, and
phone). With Cloudflare, audio over 95 MB (or over 30 MB after two server or timeout failures) is
kept only on that phone, in the IndexedDB store `local-extras`, merged into the library and never
uploaded. A podcast show is the track's `album` (new downloads fall back to the channel name).
Shuffle keeps one seeded order per round, and the whole library is a single round. The Hub did not
change. Pending: a test of the APK on a real phone.

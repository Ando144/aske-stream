# Architecture decision records

Short records of the decisions that shaped the project, with the alternatives considered. For the
overall picture see [architecture.md](../architecture.md).

| #                                                | Decision                                                       | Introduced in |
| ------------------------------------------------ | -------------------------------------------------------------- | ------------- |
| [0001](0001-pwa-first.md)                        | PWA first, native Android later                                | before v0.2.0 |
| [0002](0002-d1-for-metadata.md)                  | D1 for metadata instead of a `library.json` in R2              | before v0.2.0 |
| [0003](0003-single-owner-auth.md)                | Single-owner device pairing instead of accounts or an open API | before v0.2.0 |
| [0004](0004-opus-remux.md)                       | Ogg Opus, remuxed from YouTube by default                      | before v0.2.0 |
| [0005](0005-offline-audio-in-cache-storage.md)   | Offline audio in Cache Storage, played through blob: URLs      | before v0.2.0 |
| [0006](0006-storage-homes.md)                    | Storage homes: one home, many destinations                     | v0.5.0        |
| [0007](0007-google-drive-home.md)                | Google Drive with `drive.file` and a merged `library.json`     | v0.5.0        |
| [0008](0008-youtube-download-on-the-phone.md)    | YouTube downloads on the phone with yt-dlp                     | v0.3.0        |
| [0009](0009-capacitor-webview-native-plugins.md) | Capacitor WebView with our own native plugins                  | v0.2.0        |
| [0010](0010-aske-hub-and-jam.md)                 | Aske Hub as a separate Worker, Jam on a Durable Object         | v0.7.0        |
| [0011](0011-seeded-shuffle.md)                   | Seeded shuffle order                                           | v0.9.3        |
| [0012](0012-upload-ids-safe-cancel.md)           | Upload ids and safe cancellation                               | v0.9.6        |
| [0013](0013-opt-in-listening-stats.md)           | Opt-in listening statistics and a local Recap                  | v0.8.0        |

The first release notes in [`docs/releases/`](../releases/v0.2.0.md) are those of v0.2.0.

# Ingest CLI

`npm run ingest -- <inputs…> [options]` converts audio into the library format and uploads it.

| Input                          | Example                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| YouTube video / Music / Shorts | `https://www.youtube.com/watch?v=…`, `https://music.youtube.com/watch?v=…` |
| YouTube playlist               | `https://www.youtube.com/playlist?list=…` (every video)                    |
| File                           | `song.mp3`, `track.flac`, `audio.m4a`, …                                   |
| Folder                         | `D:\Music\Album` (recursive)                                               |

| Option                | Effect                                                       |
| --------------------- | ------------------------------------------------------------ |
| `--bitrate <kbps>`    | Re-encode to Opus at this bitrate (e.g. `96`) to save space  |
| `--artist`, `--album` | Override tags (handy for folders of files)                   |
| `--dry-run`           | Convert only, write files to `./.ingest-out`, upload nothing |

## Pipeline

1. **Expand** inputs (playlists → videos, folders → audio files).
2. **Skip duplicates** before downloading: YouTube videos by id, files by SHA-256.
3. **Download** (YouTube) the best audio-only stream, preferring Opus, plus the thumbnail.
4. **Convert** to Ogg Opus with ffmpeg:
   - Opus source → **remux** (`-c:a copy`): the audio is copied bit-for-bit into an Ogg container.
   - Anything else → one transcode to Opus 128 kbps VBR.
   - `--bitrate N` → always transcode at N kbps.
5. **Metadata**: YouTube Music fields when present; otherwise “Artist - Title” is parsed and noise
   such as “(Official Video)”, “[Lyrics]”, “(Videoclip Oficial)” is stripped. Files use their tags.
6. **Cover**: thumbnail or embedded picture, cropped to a 512×512 JPEG.
7. **Upload** with the access key (multipart). The server checks the Ogg signature, stores the
   objects in R2, and only then creates the database row.

## Remux vs 96 kbps — why remux is the default

YouTube already serves Opus at roughly 130–160 kbps. Re-encoding it to 96 kbps means compressing
**already compressed** audio a second time (generation loss) to save about 35–40 % of space.

|                 | Remux (default)       | `--bitrate 96`                     |
| --------------- | --------------------- | ---------------------------------- |
| Quality         | Identical to YouTube  | Slightly lower (second lossy pass) |
| Size            | ~1.1 MB/min           | ~0.7 MB/min                        |
| 10 GB free tier | ~150 h ≈ 2 200 songs  | ~230 h ≈ 3 400 songs               |
| Speed           | Instant (no encoding) | Needs CPU time                     |

Start with remux; if you approach the 10 GB limit, use `--bitrate 96` for new music.

## Why it runs on your PC and not on the server

YouTube blocks most datacenter IP ranges (“Sign in to confirm you're not a bot”), and Workers
cannot run ffmpeg or yt-dlp anyway. On a home connection it works reliably. Keep yt-dlp updated
(`yt-dlp -U` or `winget upgrade yt-dlp.yt-dlp`) and install Deno, which current yt-dlp versions use
to solve YouTube's JavaScript challenges.

## Legal note

Downloading from YouTube may breach YouTube's Terms of Service, and copyrighted music must not be
redistributed. This tool is meant for content you own or that is freely licensed (e.g. Creative
Commons), and your instance is private by design (no public access, single owner). You are
responsible for what you upload. This is not legal advice.

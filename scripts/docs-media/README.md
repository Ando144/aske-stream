# Documentation pictures

One command regenerates the screenshots, GIFs, banner and social preview in `docs/media/`:

```
npm run docs:media
```

## Requirements

- Dependencies installed with `npm ci`, and the Node version of the project.
- `ffmpeg` on the `PATH`, with the `libopus` encoder.
- Python 3.9 or newer with Playwright:

```
pip install playwright
python -m playwright install chromium ffmpeg
```

Playwright needs its own `ffmpeg` to record videos, even when it drives an installed browser.

Optional environment variables:

| Variable      | Use                                                                     |
| ------------- | ----------------------------------------------------------------------- |
| `PYTHON`      | Path to the Python interpreter that has Playwright (a virtualenv, say)  |
| `CHROME_PATH` | Use an installed Chrome instead of the Chromium bundled with Playwright |

## What it does

1. Generates invented songs (soft tones), covers and station logos with `ffmpeg`.
2. Builds the web app and starts an isolated local Worker (random port and access key, temporary
   storage), then fills it through the API.
3. Takes the web screenshots, renders `banner.html` and records two videos.
4. Builds the app in `fakenative` mode (fake Android plugins) and takes the Android screenshots.
5. Turns the videos into GIFs and checks the size limits: 3 MB per GIF, 8 MB in total.
6. Always, even after a failure, rebuilds the normal `apps/web/dist` and deletes the temporary
   files. Do not run other builds at the same time.

## What it produces

| Folder or file                                | Content                                  |
| --------------------------------------------- | ---------------------------------------- |
| `docs/media/screenshots/mobile-*.png`         | Phone screens of the web app             |
| `docs/media/screenshots/android-*.png`        | Download tab and study mode (Android)    |
| `docs/media/screenshots/desktop.png`          | Library and player on a wide screen      |
| `docs/media/gifs/start.gif`, `player.gif`     | Opening animation and full screen player |
| `docs/media/banner.png`, `social-preview.png` | 1280x400 and 1280x640                    |

## Everything is fictitious

Song, artist, playlist, station and video names are invented (`catalog.mjs`), and every picture is
a generated gradient. The browser gets no network access: requests that are not for the local
Worker are answered with generated data or blocked. The interface is in English.

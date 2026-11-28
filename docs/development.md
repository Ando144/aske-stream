# Development guide

How to set up Aske Stream on your computer, run it, build the Android app and publish a release.
To run your own instance instead of working on the code, see the
[deployment guide](deployment.md).

## Requirements

| Tool                       | Needed for                                                                 |
| -------------------------- | -------------------------------------------------------------------------- |
| Node.js 22.12 or newer     | Everything. [`.nvmrc`](../.nvmrc) selects Node 22                          |
| Git                        | Getting the code                                                           |
| ffmpeg (optional)          | The [ingest CLI](ingest.md), documentation pictures and some browser tests |
| yt-dlp and Deno (optional) | Adding YouTube links with the ingest CLI                                   |
| JDK 21 and Android SDK     | Building the APK only (platform 36)                                        |
| Python 3 and Playwright    | Browser tests and documentation pictures (3.9 or newer for the pictures)   |

A Cloudflare account is not needed for local development: Wrangler runs the Worker, D1 and R2 on
your computer. The commands work in PowerShell, macOS and Linux unless noted.

## Install

```bash
git clone https://github.com/Ando144/aske-stream.git
cd aske-stream
npm ci
```

Use `npm ci`, never `npm install`: on Windows, `npm install` rewrites `package-lock.json` and
breaks it for the Linux builds in CI.

## Run the app locally

```bash
npm run db:migrate:local   # first time, and after adding a migration
npm run dev
```

`npm run dev` ([`scripts/dev.mjs`](../scripts/dev.mjs)):

1. copies `apps/api/.dev.vars.example` to `apps/api/.dev.vars` if it is missing (it holds a
   development `ACCESS_KEY`);
2. applies pending migrations to the local D1 database;
3. starts the Worker with `wrangler dev` on <http://localhost:8787> and Vite on
   <http://localhost:5173>, which forwards `/api` and `/media` to the Worker.

It prints a pairing link. Open it once to connect the web app to the local Worker.

Each part can also run on its own with `npm run dev:api` (needs `apps/api/.dev.vars`) and
`npm run dev:web`.

## Run the Hub locally

The [Aske Hub](hub.md) (shared playlists, groups and Jams) is a separate Worker. It also serves the
web build as static files, so build the web app first.

```bash
npm run build
npm run hub:migrate:local
npm run dev:hub            # http://localhost:8788
```

Check it with `curl http://localhost:8788/hub/v1/health`.

The web app uses the public Hub URL from [`config.ts`](../apps/web/src/config.ts) unless
`VITE_HUB_URL` says otherwise. To point it at your local Hub:

```bash
VITE_HUB_URL=http://localhost:8788 npm run dev
```

```powershell
$env:VITE_HUB_URL = 'http://localhost:8788'; npm run dev
```

## Build the Android flavour in a browser

The `fakenative` mode builds the web app as if it were the Android app, replacing the native
plugins in `apps/web/src/native/` with the fakes in `apps/web/test/fake-native/`:

```bash
npm run build -w @aske/web -- --mode fakenative
```

Do not call `npx vite build` with `-w`: Vite reads it as "watch" and the command never ends. The
build overwrites `apps/web/dist`, so run `npm run build` afterwards. See the
[browser tests](../apps/web/test/browser/README.md).

## Build the APK locally

Set `ANDROID_HOME` to your Android SDK and make sure the build uses JDK 21. On Windows the JDK
bundled with Android Studio works:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm run android:apk
```

```bash
npm run android:apk                  # release APK
npm run apk:debug -w @aske/mobile    # debug APK
```

The release APK is signed when `.secrets/keystore.properties` or the signing environment variables
exist, and unsigned otherwise. Output goes to `apps/mobile/android/app/build/outputs/apk/`. The
first build is much slower than the following ones. See [android.md](android.md) for the native
plugins and the signing key.

## Repository layout

| Path              | Contents                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `apps/web`        | Web app and PWA: React, Vite, zustand, wouter, idb                |
| `apps/api`        | Cloudflare Worker (Hono, zod), D1 migrations, R2 audio            |
| `apps/hub`        | Aske Hub: Worker with D1 and a Durable Object, never stores music |
| `apps/mobile`     | Capacitor Android app and its Java plugins                        |
| `packages/shared` | Types, limits and the YouTube parser shared by the other packages |
| `tools/ingest`    | CLI that uploads music to a Cloudflare instance                   |
| `scripts`         | Development, setup, smoke test and documentation scripts          |
| `docs`            | Documentation ([index](README.md))                                |

How the pieces fit together is explained in [architecture.md](architecture.md).

## Configuration and environment variables

Never commit real values. `.env` and `.dev.vars` files are ignored by git; the `.example` files
next to them list what to set.

| Variable                                                                 | Where                          | Purpose                                |
| ------------------------------------------------------------------------ | ------------------------------ | -------------------------------------- |
| `ACCESS_KEY`                                                             | `apps/api/.dev.vars` or secret | Key that pairs devices with a Worker   |
| `STORAGE_LIMIT_GB`                                                       | Worker variable                | Storage budget (10 GB by default)      |
| `ASKE_URL`                                                               | `.env`                         | Instance the ingest CLI uploads to     |
| `ASKE_ACCESS_KEY`                                                        | `.env`                         | Access key used by the ingest CLI      |
| `ASKE_API_URL`                                                           | Shell, Vite dev server         | Worker that Vite forwards to           |
| `VITE_HUB_URL`                                                           | Shell, web build               | Replaces the Hub URL                   |
| `VITE_GOOGLE_CLIENT_ID`                                                  | Shell, web build               | Replaces the Google web client id      |
| `ANDROID_HOME`                                                           | Shell                          | Android SDK location                   |
| `JAVA_HOME`                                                              | Shell                          | JDK 21 location                        |
| `ANDROID_KEYSTORE_FILE`                                                  | Shell or CI                    | Signing key file                       |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Shell or CI secrets            | Signing credentials                    |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`                          | GitHub secrets                 | Used by the manual **Deploy** workflow |

`npm run gen-key` prints a new random access key.

## Before you push

```bash
npm run check       # formatting, types, tests, script tests, docs links, build
npm run test:e2e    # smoke test against a local Worker
```

`npm run format` fixes formatting. The [testing guide](testing.md) explains each step, and
[CONTRIBUTING.md](../CONTRIBUTING.md) the conventions.

## Documentation pictures

```bash
npm run docs:media
```

It regenerates the screenshots, GIFs, banner and social preview in `docs/media/` with invented
music. It needs `ffmpeg` with the `libopus` encoder, and Playwright for Python:

```bash
pip install playwright
python -m playwright install chromium ffmpeg
```

Set `PYTHON` to use a specific interpreter (a virtualenv, for example) and `CHROME_PATH` to use an
installed Chrome. Details in [scripts/docs-media](../scripts/docs-media/README.md).

## Releasing

One version number is shared by the whole repository.

1. Write the same new version in the seven `package.json` files and in `package-lock.json`. Use
   Node, not `sed` or `npm install`. Save this as a temporary `bump.mjs` outside the repository and
   run `node <path>/bump.mjs 1.2.3` from the repository root:

   ```js
   import { readFileSync, writeFileSync } from 'node:fs';

   const version = process.argv[2];
   if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('Usage: node bump.mjs x.y.z');

   const folders = ['apps/web', 'apps/api', 'apps/hub', 'apps/mobile'];
   folders.push('packages/shared', 'tools/ingest');
   const update = (file, change) => {
     const json = JSON.parse(readFileSync(file, 'utf8'));
     change(json);
     writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
   };

   for (const folder of ['.', ...folders]) {
     update(`${folder}/package.json`, (json) => (json.version = version));
   }
   update('package-lock.json', (lock) => {
     lock.version = version;
     for (const key of ['', ...folders]) lock.packages[key].version = version;
   });
   ```

2. Add `docs/releases/v<version>.md` with the notes users will read in the app, and update
   [CHANGELOG.md](../CHANGELOG.md).
3. Run `npm run check` and `npm run test:e2e`, then commit and `git push`.
4. Create and push the tag:

   ```bash
   git tag v<version>
   git push origin v<version>
   ```

The **Android app** workflow checks that the tag matches the version, builds the signed APKs and
publishes the GitHub Release. Publishing the web app is a separate step: see
[Updating](deployment.md#updating) and
[Deploying the Hub](deployment.md#deploying-the-hub-optional).

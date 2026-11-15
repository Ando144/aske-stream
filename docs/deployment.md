# Deployment guide

This deploys **your own private instance** on Cloudflare's free tier. Commands work in
PowerShell (Windows), macOS and Linux. Budget: ~15 minutes the first time.

## 0. What it costs

| Resource      | Free tier (per month)     | What aske-stream uses                                                         |
| ------------- | ------------------------- | ----------------------------------------------------------------------------- |
| Workers       | 100 000 requests / day    | API calls and media requests (static files are free)                          |
| D1            | 5 GB, 5 M rows read / day | A few MB of metadata                                                          |
| R2 storage    | 10 GB                     | ~1 MB per minute of music → about **150–170 hours** at YouTube's Opus quality |
| R2 operations | 1 M writes, 10 M reads    | One write per song; one read per stream/seek                                  |
| R2 egress     | **Free, always**          | Streaming costs nothing                                                       |

R2 requires a payment method on file to be enabled, even if you stay within the free tier.
Beyond 10 GB it costs $0.015 per GB-month.

## 1. Prerequisites

- **Node.js 22+** — <https://nodejs.org> (or `winget install OpenJS.NodeJS.LTS`)
- **Git** — `winget install Git.Git`
- A free **Cloudflare account** — <https://dash.cloudflare.com/sign-up>
- For adding music: **ffmpeg** and **yt-dlp** (+ Deno, which yt-dlp now uses for YouTube's JavaScript challenges)

  ```powershell
  winget install Gyan.FFmpeg yt-dlp.yt-dlp DenoLand.Deno
  ```

  Close and reopen the terminal afterwards so the new commands are on your PATH.

## 2. Get the code

```powershell
git clone https://github.com/<you>/aske-stream.git
cd aske-stream
npm install
```

(Fork the repository first if you want to keep your configuration on GitHub.)

## 3. Enable R2 once

Cloudflare dashboard → **R2 Object Storage** → _Enable / Purchase R2 Plan_ (free plan, card required).
You do **not** need to create a bucket or API tokens by hand.

## 4. Log in and run the setup

```powershell
npx wrangler login
npm run cf:setup
```

The script:

1. creates the D1 database `aske-stream` and writes its id into `apps/api/wrangler.jsonc`;
2. creates the private R2 bucket `aske-stream-media`;
3. applies the SQL migrations;
4. builds the PWA and deploys the Worker to `https://aske-stream.<your-subdomain>.workers.dev`;
5. generates a random `ACCESS_KEY`, stores it as an encrypted Worker secret and writes it with the URL into `.env` (git-ignored).

At the end it prints a pairing link like:

```
https://aske-stream.<you>.workers.dev/#key=Xr4…
```

Commit the updated `apps/api/wrangler.jsonc` if you use a fork (the database id is not a secret).

## 5. Pair your phone and install the app

1. Open the pairing link **once** in Chrome on your Android phone. The key travels in the URL
   fragment, which is never sent to the server or written to logs, and is removed from the address bar.
2. Chrome menu → **Add to Home screen / Install app**.
3. Open the app, play a song, lock the screen: playback continues and the controls appear on the lock screen.

Repeat on any other device (desktop browsers work too). To log every device out, rotate the key:

```powershell
npm run gen-key                       # prints a new key
npx wrangler secret put ACCESS_KEY    # paste it (run inside apps/api)
```

and update `ASKE_ACCESS_KEY` in `.env`.

## 6. Add music

```powershell
npm run ingest -- "https://www.youtube.com/watch?v=..."
npm run ingest -- "https://www.youtube.com/playlist?list=..."
npm run ingest -- "D:\Music\Some Album"
```

See [ingest.md](ingest.md) for options.

## Updating

```powershell
git pull
npm install
npm run db:migrate:remote
npm run deploy
```

Or use the **Deploy** GitHub Action (manual trigger) after adding the `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Create the token from the
_Edit Cloudflare Workers_ template and add **D1: Edit** and **Workers R2 Storage: Edit** permissions.

## Manual setup (if you prefer not to use the script)

```powershell
cd apps/api
npx wrangler d1 create aske-stream            # copy database_id into wrangler.jsonc
npx wrangler r2 bucket create aske-stream-media
npx wrangler d1 migrations apply DB --remote
cd ../..
npm run deploy
cd apps/api
npx wrangler secret put ACCESS_KEY            # paste the output of `npm run gen-key`
```

## Troubleshooting

| Symptom                                           | Fix                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Pairing screen says the server has no ACCESS_KEY  | Run `npx wrangler secret put ACCESS_KEY` inside `apps/api`. Keys must be at least 24 characters.                                           |
| `cf:setup` fails on the bucket                    | R2 is not enabled yet (step 3).                                                                                                            |
| Ingest says _Sign in to confirm you're not a bot_ | Update yt-dlp (`yt-dlp -U` or `winget upgrade yt-dlp.yt-dlp`), make sure Deno is installed, and do not run it behind a VPN or on a server. |
| No sound with the screen locked                   | Install the app (step 5) and allow Chrome to run in the background in Android's battery settings.                                          |
| A radio station does not play                     | It may be HTTP-only or offline. The catalog only lists HTTPS streams; custom URLs must be HTTPS.                                           |
| Downloads disappear                               | Settings shows whether the browser granted _persistent storage_; installing the PWA usually grants it.                                     |

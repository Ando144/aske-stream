# Browser tests (Playwright, Python)

End-to-end tests that drive the real app in Chromium against `wrangler dev` (port 8787).
Not in CI yet.

```
pip install playwright && python -m playwright install chromium
npm run db:migrate:local
```

| Test                                    | Build to serve (then copy `media/` to `apps/web/dist/test-media/` and restart wrangler dev) |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `v4_test.py`, `v6_onboarding.py`        | `npm run build -w @aske/web`                                                                |
| `v5_fakenative.py`, `v7_drive.py`       | `npx vite build --mode fakenative` in `apps/web` (Android app with fake plugins)            |
| `v8_drive_web.py`                       | `VITE_GOOGLE_CLIENT_ID=test npx vite build` in `apps/web`                                   |
| `v9_095.py`, `v10_096.py`, `v11_097.py` | `npx vite build --mode fakenative` in `apps/web` (no `media/` copy: the test serves it)     |

`v9_095.py` makes its own test song with `ffmpeg` when `media/song.webm` is missing, and answers
the Hub and YouTube thumbnails itself, so it needs no network. `v10_096.py` and `v11_097.py` reuse
its helpers. `v11_097.py` checks the opening animation and saves videos and screenshots to
`shots/shots97/`.
Rebuild the normal `dist` afterwards.

`fakedrive.py` is an in-memory Google Drive v3 answered through Playwright request
interception: the test must keep calling Playwright (`page.wait_for_timeout`, not
`time.sleep`) while the app talks to it. Env vars: `BASE`, `CHROME_PATH`. Screenshots go to `shots/`.

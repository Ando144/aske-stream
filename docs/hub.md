# Aske Hub

The Hub is a small server (a Cloudflare Worker) that is **shared by all users**. It serves three
purposes and **never stores music**:

- **Shared playlists:** a short link with the YouTube identifiers and the titles. Each friend's app
  downloads the songs on its own.
- **In-person Jams:** friends join with a QR code, add songs and vote. Only the host's phone plays.
- **Send to phone:** a list of songs with a single-use code (6 symbols and a QR). It moves songs from
  the computer to a phone, or from one phone to another. The receiving phone downloads them on its
  own.

It also serves the web app, so someone without the Android app (or with an iPhone) can join a Jam
from the browser.

Every endpoint, parameter and error is detailed in the [Hub API reference](api/hub.md).

## What it stores, and for how long

| Data                                             | How long                                               |
| ------------------------------------------------ | ------------------------------------------------------ |
| Playlist name and song references                | 90 days (then deleted automatically)                   |
| Nicknames and queue of a Jam                     | 12 hours at most                                       |
| List of songs to send to a phone                 | up to 24 h or until received                           |
| Name of the playlist sent to a phone             | up to 24 h or until received                           |
| IP (only as a daily salted hash, for the limits) | One day                                                |
| Group: name, invite code, members                | Up to 180 days without activity                        |
| Group photo (optional JPEG, 100 KB at most)      | Until removed or replaced, or the group is deleted     |
| Member: nickname and hash of the device key      | While in the group                                     |
| Bans of removed people (hash of the key)         | While the group exists                                 |
| Plays per month (only with the switch on)        | The last 12 months                                     |
| Playlists and Jams shared in a group             | Until their link or Jam expires (50 per group at most) |

No app usage statistics are collected. The only exception is the listening data you choose to share
with your groups (switch off by default, see [Groups](#groups)). The details are in
[PRIVACY.md](PRIVACY.md).

To stay within the free plan there are limits per IP: 20 playlists per hour, 10 Jams per hour, 60
searches every 10 minutes, 30 sends to a phone per hour and 20 attempts to receive or cancel a code
every 10 minutes (checking the status of a send allows 300 every 10 minutes). A send holds up to
1000 songs and can carry the name of a playlist. The sender gets a secret key (only its hash is
stored) to see whether the send is still waiting or to cancel it.

## Reading a YouTube playlist

`GET /hub/v1/playlists/:id?lang=es|en|eu&continuation=TOKEN` reads one page of a public or unlisted
YouTube playlist and returns its songs, the title and how many are unavailable. It stores nothing. To
read more pages, repeat the call with the `continuation` received.

- `:id` must be a valid playlist identifier and `continuation` has a maximum size; otherwise, 400
  `invalid_request`.
- Limit per IP: 120 reads every 10 minutes.
- If YouTube does not respond, 502 `search_unavailable`. If the first page brings no songs and no
  title (private or deleted playlist), 404 `playlist_unavailable`.

## Searching YouTube

`GET /hub/v1/search?q=TEXT&kind=songs|videos&lang=es|en|eu&continuation=TOKEN` searches YouTube for
people without Cloudflare and responds `{ results, continuation }`. It stores nothing.

- For the next page, repeat the call with the `continuation` received; `null` means there are no more
  results.
- A `continuation` with disallowed characters or longer than 4096 characters gives 400
  `invalid_request`.
- If YouTube does not respond, 502 `search_unavailable`.
- Search inside a Jam still responds only `{ results }`.

## Sends with a playlist name

`POST /hub/v1/parcels` also accepts `name` (playlist name, cleaned and cut to 120 characters) and
`unavailable` (how many songs were skipped because they were unavailable, 0 by default).
`POST /hub/v1/parcels/:code/claim` returns them to the receiving phone. Older sends remain valid:
without a name they are treated as loose songs.

The migration `apps/hub/migrations/0003_parcel_playlist.sql` adds the `name` and `unavailable`
columns to `parcels`. Apply it with `npm run hub:migrate:remote` before deploying.

## Groups

A group brings together up to 20 people (and each device can be in 10) to see a listening ranking and
pass each other playlists and Jams. There are no accounts or email: each device generates a random
key of 64 hex characters, sends it in the `X-Device-Key` header and the Hub only stores its hash.

API under `/hub/v1/groups` (all require `X-Device-Key`; if it is missing or invalid, 400
`invalid_request`):

| Method and route                                      | Purpose                                                 |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `GET /?month=YYYY-MM`                                 | My groups, with the data of each card                   |
| `POST /`                                              | Create a group (`name`, `alias`)                        |
| `POST /join`                                          | Join with a code (`code`, `alias`)                      |
| `GET /:id`                                            | Detail and members                                      |
| `POST /:id/invite`                                    | Renew the code (creator only)                           |
| `DELETE /:id/members/:memberId`                       | Leave (oneself) or remove and ban (creator only)        |
| `DELETE /me`                                          | Leave every group and delete my listening data          |
| `PUT /stats`                                          | Upload up to 12 months of listening data                |
| `DELETE /stats`                                       | Delete my listening data from the Hub (stays in groups) |
| `GET /:id/stats?month=YYYY-MM`                        | Group ranking and each person's listening               |
| `GET/POST /:id/shares`, `DELETE /:id/shares/:shareId` | Playlists and Jams shared in the group                  |
| `PUT /:id/name`                                       | Change the name (any member; `name`)                    |
| `PUT /:id/photo`                                      | Upload the photo (any member; `image/jpeg`)             |
| `DELETE /:id/photo`                                   | Remove the photo (any member)                           |
| `GET /:id/photo`                                      | See the photo (members only)                            |
| `POST /peek`                                          | Preview with an invite code (`code`)                    |
| `POST /peek/photo`                                    | Group photo with an invite code (`code`)                |

Limits: 20 people per group, 10 groups per device, names of up to 40 characters, 50 shared items per
group and listening data of the last 12 months (the current UTC month and the 11 before it). Per IP:
10 groups created per hour, 20 join attempts every 10 minutes, 30 listening uploads per hour and 300
reads every 10 minutes. Specific errors: `group_not_found`, `group_full`, `not_member`, `not_owner`,
`kicked` and `too_many_groups`.

### Data of the list cards

`GET /?month=YYYY-MM` (the phone's local month) adds to each group `photoAt` (photo version or
`null`), `people` (nicknames of the 4 oldest members) and `month` (`month`, `minutes`, `sharing` and
`topAlias`). The minutes and the top listener come **only** from those who share their listening; in
a tie, whoever joined first wins. If the month is missing or invalid, the current UTC month is used.
`people` and `month` are optional for clients: an older Hub does not send them and older clients
ignore them.

### Name, photo and preview

- Any member can change the name and the photo. Who did it is not stored and the last change wins. At
  most 20 changes per hour and group (429 `rate_limited`). `PUT /:id/name` returns the group detail
  and `PUT /:id/photo`, `{ photoAt }`.
- The photo is stored in D1 (table `group_photos`): a JPEG of 100 KB at most; the app crops it and
  shrinks it to 256 px before uploading. If it is larger, 413; if it is not a JPEG, 400.
- `GET /:id/photo` responds `image/jpeg` with `Cache-Control: private, max-age=86400`, or 404
  `not_found` if there is no photo.
- The preview returns `{ name, members, photoAt }`. It uses `POST` so that the code does not stay in
  the URL or in the logs. Unknown or renewed code: 404 `group_not_found`; removed person: 403
  `kicked`. Both routes share a limit of 30 requests every 10 minutes per IP.
- The photo is deleted when removed, when the group is deleted and in the inactivity cleanup.

Listening data is sent only if the person turns on «Share my listening with my groups» (which also
turns on Recap on their phone). Turning it off deletes it from the Hub, but the person stays in their
groups. The hourly cleanup deletes groups with no activity for 180 days and months of listening data
older than 12.

The migration `apps/hub/migrations/0004_groups.sql` creates the tables `groups`, `group_members`,
`group_bans`, `device_stats` and `group_shares`. Apply it with `npm run hub:migrate:remote`
**before** `npm run deploy:hub`.

The migration `apps/hub/migrations/0005_group_photos.sql` creates `group_photos` and adds the
`photo_at` column to `groups`. Apply it the same way, **before** deploying the Hub and the web app.

## Skipping songs in a Jam

Anyone in the Jam can ask to skip the song that is playing. The Hub neither plays nor skips anything:
it records the request and the phone of whoever created the Jam performs the skip.

- The `hello` greeting accepts `features` (optional). The app sends `['remoteSkip']`; names the Hub
  does not know are discarded.
- Any connected person sends `{ "type": "skip", "itemId": "…" }`. If accepted, the Jam state carries
  `skipRequested` with that identifier until the next `start` or `finish`.
- The state includes `canSkip`: there is a connected host that announced `remoteSkip`. An older Hub
  does not send it and the app treats it as "not possible".
- Errors: `host_outdated` (the host uses a version without this feature) and `host_away` (not
  connected).
- Requests for a song that is no longer playing, repeated ones and those arriving less than 2 seconds
  after the previous one from the same person are ignored without an error.

## How to deploy it

You need a Cloudflare account and to be logged in with `npx wrangler login`.

1. Create the database: `npx wrangler d1 create aske-hub`.
2. Copy the `database_id` it shows into `apps/hub/wrangler.jsonc` (replace the `database_id` that is
   there).
3. Create the tables: `npm run hub:migrate:remote`.
4. Publish: `npm run deploy:hub` (builds the web app and deploys the Worker).
5. Put the URL Cloudflare gives you in `HUB_URL` in `apps/web/src/config.ts` (or in the
   `VITE_HUB_URL` variable when building) and build the app again.

## Testing it locally

1. `npm run hub:migrate:local`
2. `npm run dev:hub` (it runs at <http://localhost:8788>).
3. Check that it responds: `curl http://localhost:8788/hub/v1/health`.

## Where everything is

- `apps/hub/src/routes/lists.ts`: shared playlists.
- `apps/hub/src/routes/parcels.ts`: sends to a phone with a code.
- `apps/hub/src/routes/playlists.ts`: reading YouTube playlists to choose songs.
- `apps/hub/src/routes/search.ts`: YouTube search for people without Cloudflare (computer).
- `apps/hub/src/groups/`: friend groups (routes, D1 access, ranking and cleanup); `lookRoutes.ts`
  has the name, the photo and the preview.
- `apps/hub/src/jam/`: the Jam (one Durable Object per Jam).
- `apps/hub/src/cleanup.ts`: hourly cleanup (cron `17 * * * *`), so that nothing lives longer than
  about 25 hours.
- `packages/shared/src/hub.ts`: types and limits shared with the app.

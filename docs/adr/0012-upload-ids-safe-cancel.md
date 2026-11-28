# 0012 — Upload ids and safe cancellation

**Status:** accepted

**Introduced in:** v0.9.6 (retrying pending cancellations: v0.9.7)

## Context

A download can be cancelled while it is being saved. The upload may still finish in the cloud, and
looking the song up by its YouTube id could delete a copy added by another device. Servers run by
users may be older than the app.

## Options

- **Delete by video id** — can remove music the user wants.
- **Only abort the request** — may leave an unwanted song in the cloud.
- **Tag every upload with its own id** — cancellation targets exactly that upload.

## Decision

Each job gets an `uploadId`, renewed on retry. Cloudflare stores it with the track, and
`DELETE /api/ingest/uploads/:uploadId` deletes only that upload and remembers the id for 30 days, so
a late arrival is rejected with `410 upload_canceled`. The check is part of the insert statement.
In Drive the id is a file property, and files carrying it that no song uses are removed, checking
again until some minutes have passed. Cancellations that cannot be completed are kept on the device
and retried, for up to 30 days.

For a Worker too old to know upload ids, the pending cancel carries a hint (`ref`, `since`) used
once the server is updated: it matches songs from the same YouTube video, without `upload_id`,
created since 10 minutes before the save started. The hint is dropped if that song is saved again or
turns out to be in the library already.

## Consequences

A cancellation does not touch other uploads, with one accepted risk: the legacy hint can delete a
song of the same video without `upload_id` created another way after that point (a copy to
Cloudflare, the CLI or an older app).

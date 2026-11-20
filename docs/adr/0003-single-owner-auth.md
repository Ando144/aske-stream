# 0003 — Single-owner device pairing

**Status:** accepted

## Context

The app has one user who wants no accounts and no password prompts. But the deployment is on a
public `workers.dev` URL from a public repository: an open API would let anyone stream (i.e.
redistribute) the music, upload files at the owner's expense, or delete the library.

## Options

- **Open API** — rejected for the reasons above.
- **User accounts** — unnecessary complexity for one person.
- **Cloudflare Access** in front of the Worker — strong, but adds an identity provider and an email
  login, and is harder for others to reproduce.
- **One secret key, exchanged once per device for a signed cookie** — no accounts, no recurring
  login, nothing public.

## Decision

`ACCESS_KEY` Worker secret. The CLI sends it as a Bearer token. A browser opens `/#key=…` once; the
key is exchanged for an `HttpOnly; Secure; SameSite=Strict` cookie signed with HMAC-SHA-256 that
lasts about a year. Constant-time comparisons; fail closed when the secret is missing or short.

Addendum (phase 6): an already paired device can create a pairing code (8 characters, valid 10
minutes, single use, only its SHA-256 stored in D1, invalidated after 5 wrong attempts). It is shown
as a QR (`/#code=…`) or typed, so new devices are linked without ever handling the key.

## Consequences

Rotating the key logs out every device. Losing the key only requires setting a new one. Cloudflare
Access can still be added on top without code changes.

# Security policy

## Supported versions

Only the [latest release](https://github.com/Ando144/aske-stream/releases/latest) receives security
fixes. Please update the app and your server before reporting a problem.

## Reporting a vulnerability

Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose
[**Report a vulnerability**](https://github.com/Ando144/aske-stream/security/advisories/new). Only
the maintainer, Andoni Ortiz de Zarate Urruela ([@Ando144](https://github.com/Ando144)), can see the
report.

If that button is not available, open an issue that only asks for a private channel, with no
technical details.

Please include the affected component and version, the steps to reproduce the problem and its likely
impact.

## What not to do

- Do not describe vulnerabilities in public issues, pull requests or discussions.
- Do not paste access keys, tokens, pairing links, pairing codes or QR codes anywhere.
- Do not access, change or delete data that is not yours, and do not run load tests against servers
  you do not own, including the public Hub.

## What to expect

This is a personal open-source project, so these are goals rather than a service level agreement:
a first reply within about a week, and a fix or a plan as soon as the severity justifies it. Please
allow time for a release before disclosing the problem publicly. Reporters are credited if they wish.

## Scope

- The Cloudflare Worker (`apps/api`).
- The Hub for shared playlists, Jams and groups (`apps/hub`).
- The web app / PWA (`apps/web`).
- The Android app and its published APK (`apps/mobile`).

Vulnerabilities in third-party services (Cloudflare, Google, YouTube) should be reported to their
owners.

## Security model

Each self-hosted Worker has a single owner: one secret access key, exchanged once per device for a
signed credential, with no user accounts. See
[ADR 0003](docs/adr/0003-single-owner-auth.md).

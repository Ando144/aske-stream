# Contributing to Aske Stream

Thank you for helping. Aske Stream is maintained by Andoni Ortiz de Zarate Urruela
([@Ando144](https://github.com/Ando144)) and is released under the [MIT license](LICENSE). By
contributing you agree that your work is published under that license, and that you will follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Proposing changes

- Small fixes (typos, obvious bugs) can go straight to a pull request.
- For anything large (a new feature, a change in storage or in an API, a new dependency), open an
  issue first so the approach can be agreed before you write code.
- Do not report vulnerabilities in public issues. See the [security policy](SECURITY.md).

## Requirements

- Node.js 22.12 or newer (`.nvmrc` selects the major version).
- Git.
- For the Android app: JDK 21 and the Android SDK.

## Getting started

```sh
npm ci
npm run db:migrate:local
npm run dev
```

`npm run dev` starts the Worker on port 8787 and Vite on port 5173, and creates
`apps/api/.dev.vars`. The database migration is only needed the first time.

Use `npm ci`, not `npm install`: on Windows, `npm install` rewrites `package-lock.json` and breaks
the lock file for everyone else.

The full setup is described in the [development guide](docs/development.md).

## Before opening a pull request

```sh
npm run check
npm run test:e2e
```

`npm run check` verifies formatting, types, tests and the build. `npm run test:e2e` runs the smoke
test against a local Worker and needs a freshly built `dist`, which `check` produces. See the
[testing guide](docs/testing.md) for single test files and browser tests, and never run tests in
watch mode in scripts or automation.

## Code conventions

- Strict TypeScript. Code and comments in English.
- Prettier with 100 columns and single quotes (`npm run format`).
- Short functions, descriptive names, no dead code and no debugging output.
- Handle errors: show the user a clear message and never swallow them.
- Never commit secrets, `.env` files, `.dev.vars`, signing keys or personal data.
- Cover pure logic with unit tests.

## Product rules

Aske Stream is made for people without a technical background.

- **Translations are mandatory.** Every interface text exists in Spanish, English and Basque
  (`apps/web/src/i18n/{es,en,eu}.ts`). A parity test fails when a key is missing. Singular forms use
  `key.one`.
- **Plain language.** Texts say what is happening and what to do, without jargon. Errors are
  translated into everyday language.
- **Help.** Visible features need an on-screen tip or a help article when it is not obvious how they
  work. Links between articles are validated by a test.
- **One colour palette:** amber. Do not add themes.
- **An image next to every song and playlist:** its cover, the YouTube thumbnail or an amber drawing.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
`refactor:`, `test:`, `chore:`) with a short description in the imperative mood. The project history
is written in Spanish; English is also accepted from contributors. Keep one logical change per
commit.

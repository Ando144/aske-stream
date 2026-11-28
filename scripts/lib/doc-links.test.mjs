import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractLinks, extractNpmScripts, headingSlugs, slugify } from './doc-links.mjs';

const targets = (markdown) => extractLinks(markdown).map((link) => link.target);

test('slugify lower-cases and keeps accented letters', () => {
  assert.equal(slugify('Instalación en Móvil'), 'instalación-en-móvil');
  assert.equal(slugify('Euskara eta Español'), 'euskara-eta-español');
});

test('slugify drops punctuation but keeps hyphens and underscores', () => {
  assert.equal(slugify("What's new? (v0.9.7)"), 'whats-new-v097');
  assert.equal(slugify('Self-hosted STORAGE_LIMIT_GB'), 'self-hosted-storage_limit_gb');
  assert.equal(slugify('Build & deploy'), 'build--deploy');
});

test('headingSlugs numbers repeated headings like GitHub', () => {
  const markdown = '# Setup\n## Setup\n### Setup\n## Setup-1\n';
  assert.deepEqual(headingSlugs(markdown), ['setup', 'setup-1', 'setup-2', 'setup-1-1']);
});

test('headingSlugs uses the visible text of inline markup', () => {
  const markdown = [
    '## The `npm ci` step ##',
    '## See [the guide](docs/guide.md)',
    '## **Bold** and _soft_ `a_b`',
    '## Tag `<img>` here',
    '<h2 align="center">Centered title</h2>',
  ].join('\n');
  assert.deepEqual(headingSlugs(markdown), [
    'the-npm-ci-step',
    'see-the-guide',
    'bold-and-soft-a_b',
    'tag-img-here',
    'centered-title',
  ]);
});

test('headingSlugs reads setext headings and skips fenced code and rules', () => {
  const markdown = [
    'Main title',
    '==========',
    '',
    '```sh',
    '# not a heading',
    '```',
    '- item',
    '---',
    'Second',
    '------',
  ].join('\n');
  assert.deepEqual(headingSlugs(markdown), ['main-title', 'second']);
});

test('extractLinks finds links and images with their line', () => {
  const markdown = 'Intro [guide](docs/a.md#top "Title")\n\n![logo](<my logo.png>)\n';
  assert.deepEqual(extractLinks(markdown), [
    { kind: 'link', target: 'docs/a.md#top', line: 1 },
    { kind: 'image', target: 'my logo.png', line: 3 },
  ]);
});

test('extractLinks reports both targets of a linked image', () => {
  assert.deepEqual(extractLinks('[![CI](badge.svg)](ci.yml)'), [
    { kind: 'image', target: 'badge.svg', line: 1 },
    { kind: 'link', target: 'ci.yml', line: 1 },
  ]);
});

test('extractLinks keeps balanced parentheses in a target', () => {
  assert.deepEqual(targets('[w](https://x.org/A_(b)) and (see [c](c.md))'), [
    'https://x.org/A_(b)',
    'c.md',
  ]);
});

test('extractLinks ignores fenced code, inline code and comments', () => {
  const markdown = [
    '````md',
    '```',
    '[a](fenced.md)',
    '```',
    '````',
    '~~~',
    '<img src="tilde.png">',
    '~~~',
    'Use `[b](inline.md)` like this',
    '<!-- [c](comment.md) -->',
    '[d](real.md)',
  ].join('\n');
  assert.deepEqual(extractLinks(markdown), [{ kind: 'link', target: 'real.md', line: 11 }]);
});

test('extractLinks reads HTML img, a and source tags, also across lines', () => {
  const markdown = [
    '<p align="center">',
    '  <a href="docs/a.md"><img src="docs/media/a.png" alt="a"></a>',
    '  <img',
    "    width='200'",
    "    src='b.png'>",
    '  <source srcset="dark.png">',
    '</p>',
  ].join('\n');
  assert.deepEqual(extractLinks(markdown), [
    { kind: 'link', target: 'docs/a.md', line: 2 },
    { kind: 'image', target: 'docs/media/a.png', line: 2 },
    { kind: 'image', target: 'b.png', line: 3 },
    { kind: 'image', target: 'dark.png', line: 6 },
  ]);
});

test('extractLinks reads reference definitions but not footnotes', () => {
  const markdown = [
    '[Guide][g] and ![Shot][s]',
    '',
    '[g]: docs/guide.md "Guide"',
    '[s]: <shot.png>',
    '[^1]: A footnote',
  ].join('\n');
  assert.deepEqual(extractLinks(markdown), [
    { kind: 'link', target: 'docs/guide.md', line: 3 },
    { kind: 'image', target: 'shot.png', line: 4 },
  ]);
});

test('extractNpmScripts finds scripts with and without a workspace', () => {
  const markdown = [
    'Run `npm run dev`.',
    '```sh',
    'npm run build -w @aske/web -- --mode fakenative',
    'npm run -w @aske/api db:migrate:local && npm run check',
    'npm run start --silent --workspace=@aske/ingest -- file.mp3',
    '```',
  ].join('\n');
  assert.deepEqual(extractNpmScripts(markdown), [
    { name: 'dev', workspace: null, line: 1 },
    { name: 'build', workspace: '@aske/web', line: 3 },
    { name: 'db:migrate:local', workspace: '@aske/api', line: 4 },
    { name: 'check', workspace: null, line: 4 },
    { name: 'start', workspace: '@aske/ingest', line: 5 },
  ]);
});

test('extractNpmScripts ignores placeholders and words after the script', () => {
  const markdown = 'npm run <script>\nnpm run hub:*\nThen npm run test:e2e: it uses -w nothing.';
  assert.deepEqual(extractNpmScripts(markdown), [{ name: 'test:e2e', workspace: null, line: 3 }]);
});

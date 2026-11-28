// Checks that the Markdown files point to things that exist: relative links, images, `#anchors`
// and `npm run` scripts. `--external` also requests the http(s) links (warnings only).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractLinks, extractNpmScripts, headingSlugs } from './lib/doc-links.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SKIPPED_NAMES = /^(node_modules|dist.*|\.wrangler|\.git|coverage)$/;
// Release notes and plans are historical records, not living documentation.
const SKIPPED_PATHS = new Set(['apps/mobile/android', 'docs/plan', 'docs/releases']);
const WORKSPACE_GROUPS = ['packages', 'apps', 'tools'];
const TIMEOUT_MS = 10_000;
const PARALLEL_REQUESTS = 8;

const toRepoPath = (path) => relative(root, path).split(sep).join('/');
const read = (path) => readFileSync(path, 'utf8');

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const skipped = SKIPPED_NAMES.test(entry.name) || SKIPPED_PATHS.has(toRepoPath(path));
      return skipped ? [] : markdownFiles(path);
    }
    return entry.name.toLowerCase().endsWith('.md') ? [path] : [];
  });
}

/** Case-sensitive even on Windows, because GitHub and CI are. */
function existsExactly(path) {
  const inside = relative(root, path);
  if (inside.startsWith('..') || !existsSync(path)) return false;
  let current = root;
  return inside
    .split(sep)
    .filter(Boolean)
    .every((segment) => {
      const found = readdirSync(current).includes(segment);
      current = join(current, segment);
      return found;
    });
}

function decode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text; // A literal '%' in a file name: keep it as written.
  }
}

/** Why a relative link is broken, or null when it is fine. */
function linkProblem(file, target) {
  const [beforeHash, ...hash] = target.split('#');
  const path = decode(beforeHash.split('?')[0]);
  const anchor = decode(hash.join('#'));
  let destination = file;
  if (path.startsWith('/')) destination = join(root, path);
  else if (path) destination = resolve(dirname(file), path);
  if (!existsExactly(destination)) return `missing file: ${target}`;
  const checkable = anchor && destination.endsWith('.md') && statSync(destination).isFile();
  if (checkable && !headingSlugs(read(destination)).includes(anchor)) {
    return `missing anchor: ${target}`;
  }
  return null;
}

/** Scripts of the root package ('' key) and of each workspace, by name and by folder. */
function loadScripts() {
  const scriptsIn = (folder) => JSON.parse(read(join(root, folder, 'package.json')));
  const scripts = new Map([['', scriptsIn('.').scripts ?? {}]]);
  for (const group of WORKSPACE_GROUPS) {
    for (const name of readdirSync(join(root, group))) {
      const folder = `${group}/${name}`;
      if (!existsSync(join(root, folder, 'package.json'))) continue;
      const manifest = scriptsIn(folder);
      scripts.set(manifest.name, manifest.scripts ?? {});
      scripts.set(folder, manifest.scripts ?? {});
    }
  }
  return scripts;
}

function scriptProblem({ name, workspace }, scripts) {
  const available = scripts.get(workspace?.replace(/^\.\//, '') ?? '');
  if (!available) return `unknown workspace: ${workspace}`;
  if (Object.hasOwn(available, name)) return null;
  return `unknown npm script: ${name}${workspace ? ` (-w ${workspace})` : ''}`;
}

function checkFile(file, scripts) {
  const markdown = read(file);
  const broken = extractLinks(markdown)
    // Anything with a scheme (http:, mailto:) or protocol-relative is not a file of the repo.
    .filter(({ target }) => target && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(target))
    .map(({ target, line }) => ({ line, reason: linkProblem(file, target) }));
  const unknown = extractNpmScripts(markdown).map((script) => ({
    line: script.line,
    reason: scriptProblem(script, scripts),
  }));
  return [...broken, ...unknown]
    .filter(({ reason }) => reason)
    .sort((a, b) => a.line - b.line)
    .map(({ line, reason }) => `${toRepoPath(file)}:${line} ${reason}`);
}

function externalLinks(files) {
  const found = new Map();
  for (const file of files) {
    for (const { target, line } of extractLinks(read(file))) {
      const local = /^https?:\/\/(localhost|127\.0\.0\.1)\b/i.test(target);
      if (!/^https?:\/\//i.test(target) || local || found.has(target)) continue;
      found.set(target, `${toRepoPath(file)}:${line}`);
    }
  }
  return [...found];
}

async function requestProblem(url) {
  const request = (method) =>
    fetch(url, {
      method,
      headers: { 'user-agent': 'docs-link-checker' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  try {
    let response = await request('HEAD');
    // Some servers reject HEAD but answer GET.
    if (!response.ok) response = await request('GET');
    await response.body?.cancel();
    return response.ok ? null : `HTTP ${response.status}`;
  } catch (error) {
    return error.cause?.code ?? error.message;
  }
}

async function warnExternal(files) {
  const links = externalLinks(files);
  console.log(`Requesting ${links.length} external links...`);
  for (let start = 0; start < links.length; start += PARALLEL_REQUESTS) {
    const batch = links.slice(start, start + PARALLEL_REQUESTS);
    await Promise.all(
      batch.map(async ([url, where]) => {
        const problem = await requestProblem(url);
        if (problem) console.warn(`warning ${where} ${url} (${problem})`);
      }),
    );
  }
}

const files = markdownFiles(root).sort();
const scripts = loadScripts();
const problems = files.flatMap((file) => checkFile(file, scripts));
if (process.argv.includes('--external')) await warnExternal(files);

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} documentation problem(s) in ${files.length} files.`);
  process.exitCode = 1;
} else {
  console.log(`Documentation OK (${files.length} files).`);
}

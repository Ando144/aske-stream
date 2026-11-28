// Pure Markdown parsing used by scripts/check-docs.mjs. A few regular expressions are enough
// for the Markdown of this repository and avoid adding a parser dependency.

const FENCE = /^[ \t>]*(`{3,}(?=[^`]*$)|~{3,})/;
const CODE_OR_COMMENT = /(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)|<!--[\s\S]*?-->/g;
const HEADING = new RegExp(
  [
    /^ {0,3}#{1,6}(?:[ \t]+(.*?))??(?:[ \t]+#+)?[ \t]*$/.source,
    // Setext: a paragraph line underlined with = or -.
    /^(?![ \t]*(?:[#>|<]|[-*+][ \t]|\d+[.)][ \t])) {0,3}(\S.*)\n {0,3}(?:=+|-+)[ \t]*$/.source,
    /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/.source,
  ].join('|'),
  'gm',
);
const INLINE_TARGET =
  /\]\(\s*(<[^<>\n]*>|(?:[^()\s]|\([^()\s]*\))+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?\s*\)/g;
const REFERENCE = /^ {0,3}\[(?!\^)([^\]\n]+)\]:[ \t]*(<[^<>\n]*>|\S+)/gm;
const IMAGE_REFERENCE = /!\[([^\]]*)\]\[([^\]]*)\]/g;
const HTML_TAG = /<(a|img|source)\b((?:"[^"]*"|'[^']*'|[^'"<>])*)>/gi;
const HTML_ATTRIBUTE = /\s(href|src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const NPM_RUN = /\bnpm run(?=[ \t])/g;
const SCRIPT_NAME = /^[A-Za-z0-9](?:[\w:.-]*\w)?$/;

const blank = (text) => text.replace(/[^\n]/g, ' ');

function blankFences(markdown) {
  let open = null;
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  return lines
    .map((line) => {
      const fence = FENCE.exec(line)?.[1];
      if (!open) {
        open = fence ?? null;
        return open ? '' : line;
      }
      const closes = fence?.startsWith(open) && line.trim().endsWith(fence);
      if (closes) open = null;
      return '';
    })
    .join('\n');
}

/** Removes everything GitHub does not render as Markdown, keeping line numbers. */
function prose(markdown, { keepInlineCode }) {
  return blankFences(markdown).replace(CODE_OR_COMMENT, (match) =>
    keepInlineCode && match.startsWith('`') ? match : blank(match),
  );
}

/** GitHub-style heading slug: lower case, spaces -> '-', drops punctuation except '-' and '_'. */
export function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

function stripMarkup(text) {
  return text
    .replace(/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/g, '')
    .replace(/\[([^\]]*)\](?:\([^)]*\)|\[[^\]]*\])/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#?\w+;/g, '')
    .replace(/(?<![\p{L}\p{N}])(_{1,2})(?=\S)(.+?)(?<=\S)\1(?![\p{L}\p{N}])/gu, '$2');
}

/** The text a reader sees: inline markup is removed, but the content of code spans is literal. */
function visibleText(heading) {
  return heading
    .split(/(`[^`]*`)/)
    .map((part) => (part.startsWith('`') ? part : stripMarkup(part)))
    .join('');
}

/** Headings of a Markdown text as slugs (with GitHub's -1, -2 suffixes for repeats). */
export function headingSlugs(markdown) {
  const used = new Set();
  const text = prose(markdown, { keepInlineCode: true });
  return [...text.matchAll(HEADING)].map(([, atx, setext, html]) => {
    const base = slugify(visibleText(atx ?? setext ?? html ?? ''));
    let slug = base;
    for (let n = 1; used.has(slug); n += 1) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  });
}

const unwrap = (target) => target.replace(/^<(.*)>$/, '$1');

/** Whether the `]` at `end` closes a bracket that is preceded by `!`. */
function closesImage(text, end) {
  let depth = 0;
  for (let i = end; i >= 0; i -= 1) {
    if (text[i] === ']') depth += 1;
    if (text[i] === '[') depth -= 1;
    if (depth === 0) return text[i - 1] === '!';
  }
  return false;
}

function inlineLinks(text) {
  return [...text.matchAll(INLINE_TARGET)].map((match) => ({
    index: match.index,
    kind: closesImage(text, match.index) ? 'image' : 'link',
    target: unwrap(match[1]),
  }));
}

function referenceLinks(text) {
  const images = new Set(
    [...text.matchAll(IMAGE_REFERENCE)].map(([, alt, label]) => (label || alt).toLowerCase()),
  );
  return [...text.matchAll(REFERENCE)].map((match) => ({
    index: match.index,
    kind: images.has(match[1].toLowerCase()) ? 'image' : 'link',
    target: unwrap(match[2]),
  }));
}

function htmlLinks(text) {
  return [...text.matchAll(HTML_TAG)].flatMap((tag) => {
    const isAnchor = tag[1].toLowerCase() === 'a';
    return [...tag[2].matchAll(HTML_ATTRIBUTE)]
      .filter(([, name]) => (name.toLowerCase() === 'href') === isAnchor)
      .map(([, name, double, single]) => {
        const value = (double ?? single).trim();
        const target = name.toLowerCase() === 'srcset' ? value.split(/[\s,]+/)[0] : value;
        return { index: tag.index, kind: isAnchor ? 'link' : 'image', target };
      });
  });
}

/** Links and images in a Markdown text: [{ kind: 'link'|'image', target, line }]. Covers
 *  [t](x), ![a](x), <img src="x">, <a href="x">, reference links; ignores fenced code. */
export function extractLinks(markdown) {
  const text = prose(markdown, { keepInlineCode: false });
  const lineOf = (index) => text.slice(0, index).split('\n').length;
  return [...inlineLinks(text), ...referenceLinks(text), ...htmlLinks(text)]
    .sort((a, b) => a.index - b.index)
    .map(({ kind, target, index }) => ({ kind, target, line: lineOf(index) }));
}

/** Reads the script name and workspace from the words that follow `npm run`. */
function parseRunArguments(args) {
  const words = args.trim().split(/\s+/);
  let name = null;
  let workspace = null;
  for (let i = 0; i < words.length && words[i] !== '--'; i += 1) {
    const [flag, inline] = words[i].split('=');
    if (flag === '-w' || flag === '--workspace') {
      const value = inline ?? words[(i += 1)] ?? '';
      workspace = value.replace(/^["']|["'.,:]+$/g, '') || null;
    } else if (!words[i].startsWith('-')) {
      if (name) break;
      name = words[i].replace(/["'.,:\]]+$/, '');
      if (!SCRIPT_NAME.test(name)) return null;
    }
  }
  return name ? { name, workspace } : null;
}

/** `npm run <name>` (optionally `-w <workspace>`) found anywhere, including code blocks. */
export function extractNpmScripts(markdown) {
  return markdown.split(/\r?\n/).flatMap((text, index) =>
    [...text.matchAll(NPM_RUN)].flatMap((match) => {
      const rest = text.slice(match.index + match[0].length);
      const script = parseRunArguments(rest.split(/[`|;#()]|&&/)[0]);
      return script ? [{ ...script, line: index + 1 }] : [];
    }),
  );
}

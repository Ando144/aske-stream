import { createHash } from 'node:crypto';
import { extname } from 'node:path';

/** Hash format required by Cloudflare's assets-upload-session. */
export function assetHash(buffer, path) {
  const ext = extname(path).replace(/^\./, '');
  return createHash('sha256')
    .update(buffer.toString('base64') + ext)
    .digest('hex')
    .slice(0, 32);
}

export function buildAssetManifest(files) {
  const manifest = {};
  for (const { path, content } of files) {
    manifest[path] = { hash: assetHash(content, path), size: content.length };
  }
  return manifest;
}

// Removes // and /* */ comments and trailing commas, leaving strings untouched.
function stripJsonc(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (text.startsWith('//', i)) {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += ch;
      i++;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function readCompatibilityDate(jsoncText) {
  const config = JSON.parse(stripJsonc(jsoncText));
  if (typeof config.compatibility_date !== 'string') {
    throw new Error('wrangler.jsonc has no compatibility_date');
  }
  return config.compatibility_date;
}

export function sortMigrations(names) {
  return names.filter((n) => n.endsWith('.sql')).sort();
}

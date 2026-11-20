function parseVersion(text: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text.trim());
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Compares x.y.z numerically (ignores suffixes like -beta). Invalid text counts as 0.0.0. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (left[i]! > right[i]!) return 1;
    if (left[i]! < right[i]!) return -1;
  }
  return 0;
}

/** True when `server` is missing/empty or older than `app`. */
export function isServerOutdated(server: string | undefined, app: string): boolean {
  if (!server) return true;
  return compareVersions(server, app) < 0;
}

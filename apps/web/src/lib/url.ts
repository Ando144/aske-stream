/** "aske-stream.x.workers.dev/settings " → "https://aske-stream.x.workers.dev" (null if not a web address). */
export function normalizeServerUrl(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.origin;
  } catch {
    return null;
  }
}

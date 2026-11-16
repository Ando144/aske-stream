/** 3:07, 1:02:45 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export const formatDuration = (ms: number) => formatTime(ms / 1000);

/** 47 min, 3 h 12 min */
export function formatLongDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Decimal units, like Android's own storage screen and Cloudflare's free tier (10 GB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / 1_000_000;
  if (mb >= 1000) {
    const gb = mb / 1000;
    return `${gb.toLocaleString(undefined, { maximumFractionDigits: gb < 10 ? 2 : 1 })} GB`;
  }
  return `${mb.toLocaleString(undefined, { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}

/** Accent/case-insensitive matching for search boxes ("Pablo Alboran" finds "Pablo Alborán"). */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

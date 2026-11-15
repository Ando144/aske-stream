import { deleteDeviceFile, saveDeviceFile } from './deviceFiles';
import { deviceHome, newLocalId } from './homes';
import type { LocalTrack } from './types';

const AUDIO_EXT = /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|webm|weba)$/i;

/** "03 - Berri Txarrak - Lemak, aingurak.mp3" → { artist: "Berri Txarrak", title: "Lemak, aingurak" } */
export function titleFromFileName(name: string): { title: string; artist: string } {
  const base = name
    .replace(AUDIO_EXT, '')
    .replace(/_/g, ' ')
    .replace(/^\s*\d{1,3}\s*[-.)]?\s+/, '')
    .trim();
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2)
    return { artist: parts[0]!.trim(), title: parts.slice(1).join(' - ').trim() };
  return { title: base || name, artist: '' };
}

export const isAudioFile = (file: File) =>
  file.type.startsWith('audio/') || AUDIO_EXT.test(file.name);

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lets the browser decode the header: also tells us whether this device can play it. */
function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (fn: () => void) => {
      URL.revokeObjectURL(url);
      audio.removeAttribute('src');
      fn();
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () =>
      done(() =>
        Number.isFinite(audio.duration) && audio.duration > 0
          ? resolve(Math.round(audio.duration * 1000))
          : reject(new Error('Unknown duration')),
      );
    audio.onerror = () => done(() => reject(new Error('This format cannot be played here')));
    audio.src = url;
  });
}

export interface ImportResult {
  added: LocalTrack[];
  skipped: number;
  failed: string[];
}

/** Copies audio files into this device's storage and adds them to the library. */
export async function importFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { added: [], skipped: 0, failed: [] };
  let done = 0;
  for (const file of files) {
    onProgress?.(done++, files.length);
    if (!isAudioFile(file)) {
      result.failed.push(file.name);
      continue;
    }
    let id: string | null = null;
    try {
      const hash = await sha256(file);
      if (await deviceHome.findBySource('file', hash)) {
        result.skipped++;
        continue;
      }
      const durationMs = await probeDuration(file);
      id = newLocalId();
      await saveDeviceFile('audio', id, file);
      const track: LocalTrack = {
        id,
        ...titleFromFileName(file.name),
        album: '',
        durationMs,
        sizeBytes: file.size,
        bitrateKbps: Math.round((file.size * 8) / durationMs) || null,
        hasCover: false,
        kind: 'music',
        source: 'file',
        sourceRef: hash,
        likedAt: null,
        createdAt: Date.now(),
        locations: { device: true },
        mime: file.type || 'audio/mpeg',
      };
      result.added.push(await deviceHome.addTrack(track));
    } catch {
      if (id) await deleteDeviceFile('audio', id);
      result.failed.push(file.name);
    }
  }
  onProgress?.(files.length, files.length);
  return result;
}

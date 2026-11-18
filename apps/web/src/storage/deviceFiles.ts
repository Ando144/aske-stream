/**
 * Audio and covers stored on this device, in the browser's Origin Private
 * File System (OPFS). Files there are private to the app, not visible in the
 * gallery, and survive app updates. The Android app uses the same API inside
 * its WebView.
 */
type Kind = 'audio' | 'covers' | 'playlist-covers';

export const deviceStorageSupported = () =>
  typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';

async function folder(kind: Kind): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(kind, { create: true });
}

export async function saveDeviceFile(kind: Kind, id: string, data: Blob): Promise<void> {
  const handle = await (await folder(kind)).getFileHandle(id, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function getDeviceFile(kind: Kind, id: string): Promise<File | null> {
  try {
    return await (await (await folder(kind)).getFileHandle(id)).getFile();
  } catch {
    return null;
  }
}

export async function deleteDeviceFile(kind: Kind, id: string): Promise<void> {
  try {
    await (await folder(kind)).removeEntry(id);
  } catch {
    // already gone
  }
}

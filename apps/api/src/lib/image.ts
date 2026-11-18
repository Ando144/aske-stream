/** True when the file starts with any of the given byte signatures. */
export async function startsWith(file: Blob, signatures: number[][]): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return signatures.some((sig) => sig.every((byte, i) => head[i] === byte));
}

const JPEG = [[0xff, 0xd8, 0xff]];

export const isJpeg = (file: Blob) => startsWith(file, JPEG);

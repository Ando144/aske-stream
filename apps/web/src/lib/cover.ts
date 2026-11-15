/**
 * Turns any picture (e.g. a 16:9 YouTube thumbnail) into the square JPEG the
 * library uses for covers: centre crop, at most `size` pixels per side.
 */
export async function squareJpeg(source: Blob, size = 512): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(source);
    const side = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(size, side);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      out,
      out,
    );
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.86));
  } catch {
    return null;
  }
}

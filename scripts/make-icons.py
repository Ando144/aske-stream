"""Generates the PWA icons (equalizer bars logo) with Pillow.

Usage: python scripts/make-icons.py apps/web/public
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

BG = (20, 17, 15, 255)
ACCENT = (242, 169, 59, 255)
# (x, y, height) of each bar on a 64x64 grid, matching favicon.svg
BARS = [(13, 26, 12), (23, 18, 28), (33, 12, 40), (43, 22, 20)]


def draw(size: int, maskable: bool) -> Image.Image:
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, s, s], fill=BG)
        content, offset = s * 0.62, s * 0.19  # keep inside the 80% safe zone
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 14 // 64, fill=BG)
        content, offset = s, 0
    unit = content / 64
    for x, y, h in BARS:
        x0, y0 = offset + x * unit, offset + y * unit
        d.rounded_rectangle([x0, y0, x0 + 6 * unit, y0 + h * unit], radius=3 * unit, fill=ACCENT)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "apps/web/public") / "icons"
    out.mkdir(parents=True, exist_ok=True)
    draw(192, False).save(out / "icon-192.png")
    draw(512, False).save(out / "icon-512.png")
    draw(512, True).save(out / "icon-maskable-512.png")
    draw(180, True).convert("RGB").save(out / "apple-touch-icon.png")
    print(f"Icons written to {out}")


if __name__ == "__main__":
    main()

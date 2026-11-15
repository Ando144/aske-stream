"""Generates the Android launcher icons (equalizer bars logo) with Pillow.

Usage: python scripts/make-android-icons.py apps/mobile/android/app/src/main/res
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

BG = (20, 17, 15, 255)
ACCENT = (242, 169, 59, 255)
# (x, y, height) of each bar on a 64x64 grid, matching favicon.svg
BARS = [(13, 26, 12), (23, 18, 28), (33, 12, 40), (43, 22, 20)]
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def bars(d: ImageDraw.ImageDraw, offset: float, content: float) -> None:
    unit = content / 64
    for x, y, h in BARS:
        x0, y0 = offset + x * unit, offset + y * unit
        d.rounded_rectangle([x0, y0, x0 + 6 * unit, y0 + h * unit], radius=3 * unit, fill=ACCENT)


def legacy(size: int, round_icon: bool) -> Image.Image:
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if round_icon:
        d.ellipse([0, 0, s - 1, s - 1], fill=BG)
        bars(d, s * 0.14, s * 0.72)
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 14 // 64, fill=BG)
        bars(d, 0, s)
    return img.resize((size, size), Image.LANCZOS)


def foreground(size: int) -> Image.Image:
    """Adaptive icon layer: 108dp canvas, logo kept inside the 66dp safe circle."""
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    content = s * 62 / 108
    bars(ImageDraw.Draw(img), (s - content) / 2, content)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    res = Path(sys.argv[1] if len(sys.argv) > 1 else "apps/mobile/android/app/src/main/res")
    for name, scale in DENSITIES.items():
        out = res / f"mipmap-{name}"
        out.mkdir(parents=True, exist_ok=True)
        legacy(round(48 * scale), False).save(out / "ic_launcher.png")
        legacy(round(48 * scale), True).save(out / "ic_launcher_round.png")
        foreground(round(108 * scale)).save(out / "ic_launcher_foreground.png")
    print(f"Android icons written to {res}")


if __name__ == "__main__":
    main()

"""Copy photos into dist with a faint corner watermark and fresh copyright metadata.

usage: python -I watermark.py <src_dir> <out_dir> <mark> <copyright> <file> [<file> ...]

The original EXIF is dropped on purpose (it can hold GPS location and phone
details); only Artist and Copyright are written back.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

src, out, mark, notice = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], sys.argv[4]
files = sys.argv[5:]
out.mkdir(parents=True, exist_ok=True)


def font(size):
    for name in ("arialbd.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


for name in files:
    im = ImageOps.exif_transpose(Image.open(src / name)).convert("RGB")
    W, H = im.size
    f = font(max(12, round(H * 0.021)))
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    l, t, r, b = d.textbbox((0, 0), mark, font=f)
    # the strip crops the bottom ~12% of 4:3 photos, so sit above that
    x = round(W * 0.935) - (r - l)
    y = round(H * 0.84) - (b - t)
    d.text((x + 1, y + 1), mark, font=f, fill=(0, 0, 0, 70))
    d.text((x, y), mark, font=f, fill=(255, 255, 255, 105))
    im = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")

    exif = Image.Exif()
    exif[0x013B] = "Michie Archive"   # Artist
    exif[0x8298] = notice.replace("©", "(c)")   # Copyright (EXIF text is ASCII only)
    im.save(out / name, "JPEG", quality=88, optimize=True, progressive=True, exif=exif.tobytes())
    print("watermarked", name)

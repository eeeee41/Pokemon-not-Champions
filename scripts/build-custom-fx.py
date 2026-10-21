"""Draws the effect images for the site's own moves (original art).

public/assets/fx-custom/*.png, used by src/ui/fx/custom.js:
  glitchshard, glitchblock, bit, pixelburst, noise, tearbars   (MissingNo.)
  antimatter, beam, beamcore, spark, shockwave, sigil, darkflame (Megatron)

Usage: python3 scripts/build-custom-fx.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'fx-custom'
CYAN = (120, 236, 255)
MAGENTA = (255, 70, 196)
WHITE = (250, 250, 255)
VIOLET = (168, 92, 255)
DEEP = (60, 10, 120)


def save(img, name):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f'{name}.png', optimize=True)


def glow(img, radius, strength=1.0):
    """Adds a soft glow under an image."""
    blurred = img.filter(ImageFilter.GaussianBlur(radius))
    if strength != 1.0:
        a = blurred.split()[3].point(lambda v: min(255, int(v * strength)))
        blurred.putalpha(a)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.alpha_composite(blurred)
    out.alpha_composite(img)
    return out


def glitchshard():
    img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(8, 30), (26, 6), (40, 18), (58, 10), (48, 36), (56, 56), (30, 46), (14, 58)]
    d.polygon([(x + 3, y) for x, y in pts], fill=MAGENTA + (200,))
    d.polygon([(x - 3, y) for x, y in pts], fill=CYAN + (200,))
    d.polygon(pts, fill=WHITE + (235,))
    for y in range(4, 60, 6):
        d.line((0, y, 64, y), fill=(0, 0, 0, 0), width=1)
    save(img, 'glitchshard')


def glitchblock():
    rng = random.Random(7)
    img = Image.new('RGBA', (64, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for x in range(0, 64, 4):
        for y in range(0, 24, 4):
            if rng.random() < 0.82:
                c = rng.choice([CYAN, MAGENTA, WHITE, (30, 34, 60), VIOLET])
                d.rectangle((x, y, x + 3, y + 3), fill=c + (rng.choice([200, 235, 255]),))
    save(img, 'glitchblock')


def bit():
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((5, 3, 13, 11), fill=MAGENTA + (220,))
    d.rectangle((2, 5, 10, 13), fill=CYAN + (220,))
    d.rectangle((4, 4, 11, 12), fill=WHITE + (255,))
    save(img, 'bit')


def pixelburst():
    rng = random.Random(11)
    img = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(90):
        a = rng.random() * math.tau
        r = abs(rng.gauss(0, 22))
        x, y = 48 + math.cos(a) * r, 48 + math.sin(a) * r
        s = rng.choice([2, 3, 4, 5])
        d.rectangle((x, y, x + s, y + s), fill=rng.choice([CYAN, MAGENTA, WHITE, VIOLET]) + (255,))
    save(img, 'pixelburst')


def noise():
    rng = random.Random(3)
    img = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    px = img.load()
    for y in range(0, 160, 2):
        for x in range(0, 160, 2):
            v = rng.randint(0, 255)
            a = rng.choice([0, 0, 40, 90, 140])
            for dx in (0, 1):
                for dy in (0, 1):
                    px[x + dx, y + dy] = (v, v, v, a)
    save(img, 'noise')


def tearbars():
    rng = random.Random(5)
    img = Image.new('RGBA', (320, 180), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y = 0
    while y < 180:
        h = rng.choice([2, 3, 5, 8, 12])
        if rng.random() < 0.45:
            x0 = rng.randint(-40, 200)
            c = rng.choice([CYAN, MAGENTA, WHITE, (20, 22, 40)])
            d.rectangle((x0, y, x0 + rng.randint(60, 320), y + h), fill=c + (rng.choice([60, 110, 170]),))
        y += h + rng.randint(1, 10)
    save(img, 'tearbars')


def antimatter():
    size = 128
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = img.load()
    c = size / 2
    for y in range(size):
        for x in range(size):
            r = math.hypot(x - c + 0.5, y - c + 0.5) / c
            if r > 1:
                continue
            if r < 0.34:
                col, a = (8, 0, 20), 255
            elif r < 0.46:
                t = (r - 0.34) / 0.12
                col, a = tuple(int(WHITE[i] * (1 - t) + VIOLET[i] * t) for i in range(3)), 255
            else:
                t = (r - 0.46) / 0.54
                col, a = tuple(int(VIOLET[i] * (1 - t) + DEEP[i] * t) for i in range(3)), int(230 * (1 - t) ** 1.6)
            px[x, y] = col + (a,)
    d = ImageDraw.Draw(img)
    rng = random.Random(9)
    for _ in range(14):
        ang = rng.random() * math.tau
        r0, r1 = 0.5 * c, (0.75 + rng.random() * 0.22) * c
        d.line((c + math.cos(ang) * r0, c + math.sin(ang) * r0, c + math.cos(ang) * r1, c + math.sin(ang) * r1), fill=WHITE + (180,), width=2)
    save(glow(img, 4, 0.8), 'antimatter')


def beam():
    w, h = 256, 64
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    for y in range(h):
        t = abs(y - h / 2 + 0.5) / (h / 2)
        for x in range(w):
            ripple = 0.08 * math.sin(x / 9.0) + 0.05 * math.sin(x / 3.7)
            tt = min(1, max(0, t + ripple))
            if tt < 0.22:
                col, a = WHITE, 255
            elif tt < 0.5:
                k = (tt - 0.22) / 0.28
                col, a = tuple(int(WHITE[i] * (1 - k) + VIOLET[i] * k) for i in range(3)), 245
            else:
                k = (tt - 0.5) / 0.5
                col, a = VIOLET, int(200 * (1 - k) ** 2)
            px[x, y] = col + (a,)
    save(img, 'beam')
    core = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(core)
    for i, (r, col, a) in enumerate([(46, VIOLET, 90), (36, VIOLET, 170), (26, (220, 190, 255), 230), (16, WHITE, 255)]):
        d.ellipse((48 - r, 48 - r, 48 + r, 48 + r), fill=col + (a,))
    save(glow(core, 5), 'beamcore')


def spark():
    img = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(12, 1), (15, 12), (12, 23), (9, 12)], fill=WHITE + (255,))
    d.polygon([(1, 12), (12, 9), (23, 12), (12, 15)], fill=(220, 190, 255, 230))
    save(glow(img, 2), 'spark')


def shockwave():
    size = 192
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((10, 10, size - 10, size - 10), outline=VIOLET + (210,), width=10)
    d.ellipse((18, 18, size - 18, size - 18), outline=WHITE + (230,), width=4)
    save(glow(img, 5), 'shockwave')


def sigil():
    # An original crest: rings, a hexagon and eight angular spikes.
    size = 192
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    red = (230, 40, 70)
    d.ellipse((14, 14, size - 14, size - 14), outline=red + (220,), width=5)
    d.ellipse((34, 34, size - 34, size - 34), outline=VIOLET + (200,), width=3)
    hexagon = [(c + 46 * math.cos(math.pi / 6 + k * math.pi / 3), c + 46 * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
    d.polygon(hexagon, outline=red + (230,), width=4)
    for k in range(8):
        a = k * math.pi / 4
        tip = (c + 88 * math.cos(a), c + 88 * math.sin(a))
        left = (c + 64 * math.cos(a - 0.12), c + 64 * math.sin(a - 0.12))
        right = (c + 64 * math.cos(a + 0.12), c + 64 * math.sin(a + 0.12))
        d.polygon([left, tip, right], fill=red + (230,))
    d.ellipse((c - 12, c - 12, c + 12, c + 12), fill=VIOLET + (240,))
    save(glow(img, 4, 0.9), 'sigil')


def darkflame():
    w, h = 64, 96
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = img.load()
    for y in range(h):
        t = y / h  # 0 top (tip) → 1 bottom (base)
        half = (w / 2 - 4) * (t ** 0.7) * (1 - 0.15 * math.sin(y / 6))
        for x in range(w):
            dx = abs(x - w / 2 + 0.5 + 4 * math.sin(y / 11))
            if dx > half:
                continue
            k = dx / max(half, 1)
            if k < 0.35 and t > 0.45:
                col = (230, 200, 255)
            elif k < 0.7:
                col = VIOLET
            else:
                col = DEEP
            px[x, y] = col + (int(255 * min(1, t * 1.6) * (1 - k * 0.5)),)
    save(glow(img, 3, 0.8), 'darkflame')


def main():
    for fn in (glitchshard, glitchblock, bit, pixelburst, noise, tearbars, antimatter, beam, spark, shockwave, sigil, darkflame):
        fn()
    print('\n'.join(sorted(p.name for p in OUT.glob('*.png'))))


if __name__ == '__main__':
    main()

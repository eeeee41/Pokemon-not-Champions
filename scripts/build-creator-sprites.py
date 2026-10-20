"""Draws the creator's MissingNo. sprites: an original glitch design.

One sheet, public/assets/creator.webp: columns are normal / Mega / Gigantamax,
rows are front, back, shiny front, shiny back. 96x96 frames, pixel art.

Usage: python3 scripts/build-creator-sprites.py
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets' / 'creator.webp'
F = 96  # frame size
PALETTES = {
    'normal': {'body': (36, 40, 66), 'edge': (120, 236, 255), 'hot': (255, 70, 196), 'core': (250, 250, 255), 'dark': (14, 16, 30)},
    'shiny': {'body': (66, 48, 14), 'edge': (255, 214, 92), 'hot': (110, 255, 160), 'core': (255, 252, 230), 'dark': (30, 22, 6)},
}


def crystal(draw, cx, cy, w, h, color):
    draw.polygon([(cx, cy - h), (cx + w, cy), (cx, cy + h), (cx - w, cy)], fill=color)


def glitch_slices(img, rng, count, max_shift):
    """Tears horizontal bands sideways, like a broken signal."""
    for _ in range(count):
        y = rng.randrange(0, F - 4)
        hgt = rng.randrange(1, 4)
        shift = rng.randrange(-max_shift, max_shift + 1)
        band = img.crop((0, y, F, y + hgt))
        img.paste((0, 0, 0, 0), (0, y, F, y + hgt))
        img.paste(band, (shift, y), band)


def rgb_split(img, offset):
    r, g, b, a = img.split()
    red = Image.merge('RGBA', (r, g.point(lambda v: 0), b.point(lambda v: 0), a.point(lambda v: v // 2)))
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.alpha_composite(red, (offset, 0))
    out.alpha_composite(img)
    return out


def frame(kind, view, pal, seed):
    rng = random.Random(seed)
    img = Image.new('RGBA', (F, F), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = 48, 50
    if kind == 'gmax':
        # A storm of static around a huge crystal.
        for _ in range(260):
            x, y = rng.randrange(4, 92), rng.randrange(8, 94)
            if (x - cx) ** 2 / 44 ** 2 + (y - cy) ** 2 / 42 ** 2 > 1:
                continue
            s = rng.choice((2, 3, 4))
            d.rectangle((x, y, x + s, y + s), fill=rng.choice((pal['dark'], pal['body'], pal['hot'], (200, 20, 40))))
        crystal(d, cx, cy, 26, 36, pal['edge'])
        crystal(d, cx, cy, 22, 31, pal['body'])
    else:
        big = kind == 'mega'
        w, h = (22, 34) if big else (17, 27)
        crystal(d, cx, cy, w + 3, h + 4, pal['edge'])
        crystal(d, cx, cy, w, h, pal['body'])
        # Facets
        d.line((cx, cy - h, cx, cy + h), fill=pal['dark'], width=1)
        d.line((cx - w, cy, cx + w, cy), fill=pal['dark'], width=1)
        if big:
            # A ring of glitch shards.
            for k in range(14):
                ang = k / 14 * 6.283
                import math
                x = cx + math.cos(ang) * 40
                y = cy + math.sin(ang) * 18
                s = 3 if k % 2 else 5
                d.rectangle((x - s, y - s, x + s, y + s // 2), fill=pal['hot'] if k % 3 else pal['edge'])
    if view == 'front':
        # The core: a bright square with a missing pixel pattern.
        core = 9 if kind != 'normal' else 7
        d.rectangle((cx - core, cy - core, cx + core, cy + core), fill=pal['core'])
        for _ in range(18):
            x, y = rng.randrange(cx - core, cx + core), rng.randrange(cy - core, cy + core)
            d.point((x, y), fill=pal['hot'])
    else:
        d.rectangle((cx - 4, cy - 10, cx + 4, cy + 10), fill=pal['dark'])
    # Loose pixels drifting off it.
    for _ in range(40 if kind == 'normal' else 70):
        x, y = rng.randrange(6, 90), rng.randrange(6, 92)
        d.rectangle((x, y, x + 1, y + 1), fill=rng.choice((pal['edge'], pal['hot'], pal['core'])))
    glitch_slices(img, rng, 9 if kind == 'normal' else 14, 6 if kind == 'normal' else 9)
    return rgb_split(img, 2)


def main():
    kinds = ['normal', 'mega', 'gmax']
    rows = [('front', 'normal'), ('back', 'normal'), ('front', 'shiny'), ('back', 'shiny')]
    sheet = Image.new('RGBA', (F * len(kinds), F * len(rows)), (0, 0, 0, 0))
    rects = {}
    for r, (view, palname) in enumerate(rows):
        sheet_name = view if palname == 'normal' else f'{view}-shiny'
        rects[sheet_name] = {}
        for c, kind in enumerate(kinds):
            img = frame(kind, view, PALETTES[palname], seed=1000 + c * 10 + (1 if view == 'back' else 0))
            sheet.alpha_composite(img, (c * F, r * F))
            sprite_id = {'normal': 'missingno', 'mega': 'missingnomega', 'gmax': 'missingnogmax'}[kind]
            rects[sheet_name][sprite_id] = [c * F, r * F, F, F]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, 'WEBP', lossless=True)
    print(json.dumps({'file': OUT.name, 'size': list(sheet.size), 'sheets': rects}))


if __name__ == '__main__':
    main()

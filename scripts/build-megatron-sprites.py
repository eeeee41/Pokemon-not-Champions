"""Draws Megatron's sprites and the six hidden parts: an original war-machine design.

public/assets/megatron.webp: one row of 96x96 frames (front, back, shiny front,
shiny back) and one row of 48x48 part icons. Drawn on a half-size pixel grid
and doubled, for crisp pixel art.

Usage: python3 scripts/build-megatron-sprites.py > src/generated/megatron-sprites.json
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets' / 'megatron.webp'
PAL = {
    'normal': {'body': (78, 84, 102), 'dark': (34, 36, 48), 'light': (150, 158, 180), 'glow': (168, 92, 255), 'visor': (96, 236, 255), 'line': (16, 16, 24)},
    'shiny': {'body': (128, 34, 44), 'dark': (60, 14, 22), 'light': (214, 92, 96), 'glow': (255, 206, 72), 'visor': (255, 244, 170), 'line': (20, 8, 10)},
}


def poly(d, pts, fill, outline):
    d.polygon(pts, fill=fill, outline=outline)


def head(d, p, cx, top, front=True):
    poly(d, [(cx - 5, top + 2), (cx - 3, top), (cx + 3, top), (cx + 5, top + 2), (cx + 4, top + 8), (cx - 4, top + 8)], p['body'], p['line'])
    # Swept horns
    poly(d, [(cx - 5, top + 2), (cx - 9, top - 3), (cx - 6, top + 4)], p['light'], p['line'])
    poly(d, [(cx + 5, top + 2), (cx + 9, top - 3), (cx + 6, top + 4)], p['light'], p['line'])
    if front:
        d.rectangle((cx - 3, top + 3, cx + 3, top + 4), fill=p['visor'])
        d.line((cx - 2, top + 7, cx + 2, top + 7), fill=p['dark'])
    else:
        d.rectangle((cx - 2, top + 3, cx + 2, top + 6), fill=p['dark'])


def torso(d, p, cx, top, front=True):
    # Shoulder pylons
    poly(d, [(cx - 16, top + 1), (cx - 9, top - 2), (cx - 7, top + 5), (cx - 15, top + 7)], p['light'], p['line'])
    poly(d, [(cx + 16, top + 1), (cx + 9, top - 2), (cx + 7, top + 5), (cx + 15, top + 7)], p['light'], p['line'])
    poly(d, [(cx - 9, top), (cx + 9, top), (cx + 7, top + 14), (cx - 7, top + 14)], p['body'], p['line'])
    if front:
        # Reactor core
        poly(d, [(cx, top + 3), (cx + 4, top + 6), (cx, top + 10), (cx - 4, top + 6)], p['dark'], p['line'])
        d.rectangle((cx - 1, top + 5, cx + 1, top + 7), fill=p['glow'])
        d.line((cx - 6, top + 2, cx - 6, top + 12), fill=p['light'])
        d.line((cx + 6, top + 2, cx + 6, top + 12), fill=p['light'])
    else:
        for y in (top + 3, top + 6, top + 9):
            d.line((cx - 4, y, cx + 4, y), fill=p['dark'])
        d.rectangle((cx - 1, top + 11, cx + 1, top + 13), fill=p['glow'])


def arm(d, p, x, top, side):
    s = -1 if side == 'left' else 1
    poly(d, [(x, top), (x + 4 * s, top), (x + 5 * s, top + 10), (x + 1 * s, top + 10)], p['body'], p['line'])
    # Gauntlet with claws
    poly(d, [(x - 1 * s, top + 10), (x + 6 * s, top + 10), (x + 6 * s, top + 15), (x - 1 * s, top + 15)], p['dark'], p['line'])
    for k in range(3):
        d.line((x + (k * 2) * s, top + 15, x + (k * 2) * s, top + 17), fill=p['light'])
    d.point((x + 2 * s, top + 4), fill=p['glow'])


def legs(d, p, cx, top):
    for s in (-1, 1):
        x = cx + 3 * s
        poly(d, [(x, top), (x + 5 * s, top), (x + 6 * s, top + 9), (x + 1 * s, top + 9)], p['body'], p['line'])
        poly(d, [(x - 1 * s, top + 9), (x + 8 * s, top + 9), (x + 8 * s, top + 13), (x - 1 * s, top + 13)], p['dark'], p['line'])
        d.point((x + 3 * s, top + 4), fill=p['light'])
    d.rectangle((cx - 3, top - 1, cx + 3, top + 2), fill=p['dark'], outline=p['line'])


def megatron(pal, front=True):
    img = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    p = PAL[pal]
    cx = 24
    legs(d, p, cx, 31)
    arm(d, p, cx - 10, 17, 'left')
    arm(d, p, cx + 10, 17, 'right')
    torso(d, p, cx, 16, front)
    head(d, p, cx, 6, front)
    return img.resize((96, 96), Image.NEAREST)


def part(kind):
    img = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    p = PAL['normal']
    if kind == 'helm':
        head(d, p, 24, 16)
    elif kind == 'core':
        poly(d, [(24, 12), (33, 18), (33, 30), (24, 36), (15, 30), (15, 18)], p['dark'], p['line'])
        d.ellipse((19, 19, 29, 29), fill=p['glow'], outline=p['line'])
        d.ellipse((22, 22, 25, 25), fill=(240, 220, 255))
    elif kind == 'leftarm':
        arm(d, p, 26, 14, 'left')
    elif kind == 'rightarm':
        arm(d, p, 22, 14, 'right')
    elif kind == 'chassis':
        torso(d, p, 24, 16)
    elif kind == 'legs':
        legs(d, p, 24, 16)
    # A faint glow so it can be spotted on any background.
    halo = Image.new('RGBA', img.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((6, 6, 42, 42), fill=(168, 92, 255, 40))
    halo.alpha_composite(img)
    return halo


def main():
    frames = [('front', 'normal', True), ('back', 'normal', False), ('front-shiny', 'shiny', True), ('back-shiny', 'shiny', False)]
    parts = ['helm', 'core', 'leftarm', 'rightarm', 'chassis', 'legs']
    sheet = Image.new('RGBA', (96 * 4, 96 + 48), (0, 0, 0, 0))
    sheets = {}
    for i, (name, pal, front) in enumerate(frames):
        sheet.alpha_composite(megatron(pal, front), (i * 96, 0))
        sheets[name] = {'megatron': [i * 96, 0, 96, 96]}
    rects = {}
    for i, kind in enumerate(parts):
        sheet.alpha_composite(part(kind), (i * 48, 96))
        rects[kind] = [i * 48, 96, 48, 48]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, 'WEBP', lossless=True)
    print(json.dumps({'file': OUT.name, 'size': list(sheet.size), 'sheets': sheets, 'parts': rects}))


if __name__ == '__main__':
    main()

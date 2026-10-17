#!/usr/bin/env python3
"""Builds the sprite sheets the site uses, from Smogon's sprite project
(https://github.com/smogon/sprites, the same art Pokémon Showdown serves).

Outputs:
  public/assets/pokemon-front.webp  front sprites for every species and battle forme
  public/assets/pokemon-back.webp   back sprites
  public/assets/items.webp          held-item icons
  src/generated/sprites.json        where each sprite sits in its sheet

Run `npm run data` first (it writes scripts/.cache/sprite-request.json), then:
  python3 scripts/build-sprites.py
Needs git and Pillow. Only the needed images are downloaded (sparse checkout).
"""
import json
import os
import re
import subprocess
import sys
import unicodedata

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'scripts', '.cache')
REPO = os.path.join(CACHE, 'smogon-sprites')
REPO_URL = 'https://github.com/smogon/sprites.git'

# Sprites from different sets are drawn at different sizes. Scale everything
# to Black/White sprite size so a sheet looks like one set.
SCALE = {'gen5': 1.0, 'champions': 0.62, 'models': 0.62, 'dex': 1.0}


def run(*args, cwd=None):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout


def ensure_repo():
    if not os.path.isdir(os.path.join(REPO, '.git')):
        os.makedirs(CACHE, exist_ok=True)
        print('Cloning sprite index (no images yet)...')
        run('git', 'clone', '--filter=blob:none', '--no-checkout', '--depth', '1', REPO_URL, REPO)


def list_files(*dirs):
    out = run('git', 'ls-tree', '-r', '--name-only', 'HEAD', '--', *dirs, cwd=REPO)
    return [l for l in out.split('\n') if l]


def psid(e):
    return e.replace('_', '')


def encode(s):
    """Smogon's filename encoding: word breaks become _, other punctuation vanishes."""
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]+', lambda m: '_' if re.search(r'[ _-]', m.group(0)) else '', s)


def species_index(paths):
    """Maps showdown ids (plus ':b' for back sprites) to sprite paths."""
    index = {}
    for path in paths:
        fn = path.rsplit('/', 1)[-1]
        m = re.match(r'^s(.+)\.(png|gif)$', fn)
        if not m:
            continue
        parts = m.group(1).split('-')
        name = parts[0]
        extra = {p[0]: p[1:] for p in parts[1:]}
        if any(k in extra for k in 'sacv'):
            continue  # shiny, asymmetric, slot, vendor variants
        if 'g' in extra and extra['g'] != '':
            continue  # -g<game>
        key = psid(name) + (psid(extra['o']) if extra.get('o') else '') + ('gmax' if 'g' in extra else '')
        if 'f' in extra:
            key += 'f'
        if 'b' in extra:
            key += ':b'
        prev = index.get(key)
        if prev is None or (path.endswith('.png') and prev.endswith('.gif')):
            index[key] = path
    return index


def checkout(paths):
    paths = sorted(set(p for p in paths if not os.path.exists(os.path.join(REPO, p))))
    for i in range(0, len(paths), 250):
        chunk = paths[i:i + 250]
        print(f'  downloading {i + len(chunk)}/{len(paths)}')
        run('git', 'checkout', 'HEAD', '--', *chunk, cwd=REPO)


def load(path, scale):
    im = Image.open(os.path.join(REPO, path))
    im.seek(0)
    im = im.convert('RGBA')
    box = im.getbbox()
    if box:
        im = im.crop(box)
    if scale != 1.0:
        w = max(1, round(im.width * scale))
        h = max(1, round(im.height * scale))
        im = im.resize((w, h), Image.LANCZOS)
    return im


def pack(images, width=2048, pad=2):
    """Shelf packing. images: {key: Image}. Returns (sheet, {key: [x, y, w, h]})."""
    order = sorted(images, key=lambda k: (-images[k].height, -images[k].width, k))
    x = y = shelf = 0
    places = {}
    for key in order:
        im = images[key]
        if x + im.width + pad > width:
            x = 0
            y += shelf + pad
            shelf = 0
        places[key] = [x, y, im.width, im.height]
        x += im.width + pad
        shelf = max(shelf, im.height)
    height = y + shelf
    sheet = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    for key, (px, py, w, h) in places.items():
        sheet.paste(images[key], (px, py))
    return sheet, places


def main():
    with open(os.path.join(CACHE, 'sprite-request.json')) as f:
        request = json.load(f)
    ensure_repo()
    print('Reading sprite index...')
    sets = {
        'gen5': species_index(list_files('src/sprites/gen5')),
        'champions': species_index(list_files('src/champions')),
        'models': species_index(list_files('src/models')),
        'dex': species_index(list_files('src/dex')),
    }
    item_files = set(list_files('src/minisprites/items'))

    front, back, missing_front = {}, {}, []
    for s in request['species']:
        sid = s['id']
        for src in ('gen5', 'champions', 'models', 'dex'):
            if sid in sets[src]:
                front[sid] = (sets[src][sid], src)
                break
        else:
            missing_front.append(s['name'])
        for src in ('gen5', 'models'):
            if sid + ':b' in sets[src]:
                back[sid] = (sets[src][sid + ':b'], src)
                break

    items = {}
    for it in request['items']:
        path = f"src/minisprites/items/i{encode(it['name'])}.png"
        if path in item_files:
            items[it['id']] = path

    print(f'Front sprites: {len(front)} found, {len(missing_front)} use their base forme')
    print(f'Back sprites: {len(back)} found; the rest are mirrored fronts')
    print(f'Item icons: {len(items)} of {len(request["items"])}')
    if missing_front:
        print('  base forme used for: ' + ', '.join(missing_front))

    checkout([p for p, _ in front.values()] + [p for p, _ in back.values()] + list(items.values()))

    out_dir = os.path.join(ROOT, 'public', 'assets')
    os.makedirs(out_dir, exist_ok=True)
    manifest = {}
    for name, table in (('front', front), ('back', back)):
        images, kinds = {}, {}
        for sid, (path, src) in table.items():
            try:
                images[sid] = load(path, SCALE[src])
                kinds[sid] = src
            except Exception as e:  # a broken file shouldn't stop the build
                print(f'  skipped {path}: {e}')
        sheet, places = pack(images)
        file = f'pokemon-{name}.webp'
        sheet.save(os.path.join(out_dir, file), 'WEBP', lossless=True, quality=100, method=6)
        manifest[name] = {
            'file': file, 'size': [sheet.width, sheet.height],
            'sprites': {sid: places[sid] + ([1] if kinds[sid] != 'gen5' else []) for sid in places},
        }
        print(f'{file}: {sheet.width}x{sheet.height}, {os.path.getsize(os.path.join(out_dir, file)) // 1024} KB')

    item_images = {}
    for iid, path in items.items():
        try:
            item_images[iid] = load(path, 1.0)
        except Exception as e:
            print(f'  skipped {path}: {e}')
    sheet, places = pack(item_images, width=1024, pad=1)
    sheet.save(os.path.join(out_dir, 'items.webp'), 'WEBP', lossless=True, quality=100, method=6)
    manifest['items'] = {'file': 'items.webp', 'size': [sheet.width, sheet.height], 'sprites': places}
    print(f'items.webp: {sheet.width}x{sheet.height}, {os.path.getsize(os.path.join(out_dir, "items.webp")) // 1024} KB')

    gen_dir = os.path.join(ROOT, 'src', 'generated')
    os.makedirs(gen_dir, exist_ok=True)
    with open(os.path.join(gen_dir, 'sprites.json'), 'w') as f:
        json.dump(manifest, f, separators=(',', ':'))
    print('Wrote src/generated/sprites.json')


if __name__ == '__main__':
    sys.exit(main())

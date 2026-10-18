#!/usr/bin/env python3
"""Builds the sprite sheets the site uses, from Smogon's sprite project
(https://github.com/smogon/sprites, the same art Pokémon Showdown serves),
with PokéAPI's sprites (https://github.com/PokeAPI/sprites) filling in formes
Smogon hasn't drawn yet, like most of the Legends: Z-A Megas.

Outputs:
  public/assets/pokemon-front.webp        front sprites for every species and battle forme
  public/assets/pokemon-back.webp         back sprites
  public/assets/pokemon-front-shiny.webp  shiny front sprites
  public/assets/pokemon-back-shiny.webp   shiny back sprites
  public/assets/items.webp                held-item icons
  src/generated/sprites.json              where each sprite sits in its sheet

Run `npm run data` first (it writes scripts/.cache/sprite-request.json), then:
  python3 scripts/build-sprites.py
Needs git, curl and Pillow. Only the images that are used get downloaded.
"""
import csv
import json
import os
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'scripts', '.cache')
REPO = os.path.join(CACHE, 'smogon-sprites')
REPO_URL = 'https://github.com/smogon/sprites.git'
SMOGON_RAW = 'https://raw.githubusercontent.com/smogon/sprites'

POKEAPI_SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
POKEAPI_CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv'

# Sprites from different sets are drawn at different sizes. Scale everything
# to Black/White sprite size so a sheet looks like one set.
SCALE = {'gen5': 1.0, 'pokeapi': 1.0, 'champions': 0.62, 'models': 0.62, 'dex': 1.0, 'pokeapi-home': 0.22}
FRONT_ORDER = ('gen5', 'pokeapi', 'champions', 'models', 'dex', 'pokeapi-home')
BACK_ORDER = ('gen5', 'pokeapi', 'models')
SMOGON_DIRS = {'gen5': 'src/sprites/gen5', 'champions': 'src/champions', 'models': 'src/models', 'dex': 'src/dex'}

# name -> (back view?, shiny?)
SHEETS = {
    'front': (False, False),
    'back': (True, False),
    'front-shiny': (False, True),
    'back-shiny': (True, True),
}


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


def species_index(paths, shiny):
    """Maps showdown ids (plus ':b' for back sprites) to sprite paths, for shiny or normal art."""
    index = {}
    for path in paths:
        fn = path.rsplit('/', 1)[-1]
        m = re.match(r'^s(.+)\.(png|gif)$', fn)
        if not m:
            continue
        parts = m.group(1).split('-')
        name = parts[0]
        extra = {p[0]: p[1:] for p in parts[1:] if p}
        if ('s' in extra) != shiny:
            continue
        if any(k in extra for k in 'acv'):
            continue  # asymmetrical, slot and vendor variants
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


def fetch_all(jobs, label, workers=16):
    """Downloads (url, dest) pairs that aren't cached yet, in parallel.
    A 404 is remembered as dest + '.missing'. Returns the jobs that failed for other reasons."""
    todo = [(u, d) for u, d in dict.fromkeys(jobs) if not os.path.exists(d) and not os.path.exists(d + '.missing')]
    if not todo:
        return []
    print(f'Downloading {len(todo)} {label}...')
    failed = []

    def one(job):
        url, dest = job
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        tmp = dest + '.part'
        r = subprocess.run(['curl', '-sSfL', '--retry', '3', '-o', tmp, url], capture_output=True)
        if r.returncode == 0:
            os.replace(tmp, dest)
            return None
        if os.path.exists(tmp):
            os.remove(tmp)
        if b'404' in r.stderr:
            open(dest + '.missing', 'w').close()
            return None
        return job

    with ThreadPoolExecutor(workers) as pool:
        for i, bad in enumerate(pool.map(one, todo), 1):
            if bad:
                failed.append(bad)
            if i % 500 == 0:
                print(f'  {i}/{len(todo)}')
    return failed


def pokeapi_ids():
    """Maps showdown-style ids to PokéAPI pokemon ids."""
    path = os.path.join(CACHE, 'pokeapi-pokemon.csv')
    if not os.path.exists(path):
        subprocess.run(['curl', '-sSf', '-o', path, POKEAPI_CSV], check=True)
    ids = {}
    with open(path, newline='') as f:
        for row in csv.DictReader(f):
            ident = row['identifier'].replace('-male', '-m').replace('-female', '-f')
            ids.setdefault(re.sub(r'[^a-z0-9]', '', ident), int(row['id']))
    return ids


def pokeapi_job(pid, kind, shiny):
    """(url, local path) for one PokéAPI sprite. kind: front, back or home."""
    sub = {'front': '', 'back': 'back/', 'home': 'other/home/'}[kind] + ('shiny/' if shiny else '') + f'{pid}.png'
    folder = kind + ('-shiny' if shiny else '')
    return f'{POKEAPI_SPRITES}/{sub}', os.path.join(CACHE, 'pokeapi', folder, f'{pid}.png')


def load(path, scale):
    im = Image.open(path if os.path.isabs(path) else os.path.join(REPO, path))
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
    sheet = Image.new('RGBA', (width, max(1, height)), (0, 0, 0, 0))
    for key, (px, py, w, h) in places.items():
        sheet.paste(images[key], (px, py))
    return sheet, places


def main():
    with open(os.path.join(CACHE, 'sprite-request.json')) as f:
        request = json.load(f)
    species = request['species']
    ensure_repo()
    rev = run('git', 'rev-parse', 'HEAD', cwd=REPO).strip()

    print('Reading sprite index...')
    listings = {src: list_files(d) for src, d in SMOGON_DIRS.items()}
    sets = {shiny: {src: species_index(paths, shiny) for src, paths in listings.items()} for shiny in (False, True)}
    item_files = set(list_files('src/minisprites/items'))
    api_ids = pokeapi_ids()

    # PokéAPI fills in formes the Black/White-style set doesn't cover yet.
    api_jobs = []
    for s in species:
        pid = api_ids.get(s['id'])
        if pid is None:
            continue
        for shiny in (False, True):
            gen5 = sets[shiny]['gen5']
            if s['id'] not in gen5:
                api_jobs.append(pokeapi_job(pid, 'front', shiny))
            if s['id'] + ':b' not in gen5:
                api_jobs.append(pokeapi_job(pid, 'back', shiny))
    fetch_all(api_jobs, 'PokéAPI sprites')

    def find(sid, back, shiny):
        for src in BACK_ORDER if back else FRONT_ORDER:
            if src.startswith('pokeapi'):
                pid = api_ids.get(sid)
                if pid is None:
                    continue
                kind = 'back' if back else ('home' if src == 'pokeapi-home' else 'front')
                job = pokeapi_job(pid, kind, shiny)
                if kind == 'home':
                    fetch_all([job], 'HOME renders')
                if os.path.exists(job[1]):
                    return job[1], src
                continue
            table = sets[shiny][src]
            key = sid + (':b' if back else '')
            if key in table:
                return table[key], src
        return None

    chosen = {name: {} for name in SHEETS}
    for s in species:
        for name, (back, shiny) in SHEETS.items():
            found = find(s['id'], back, shiny)
            if found:
                chosen[name][s['id']] = found

    items = {}
    for it in request['items']:
        path = f"src/minisprites/items/i{encode(it['name'])}.png"
        if path in item_files:
            items[it['id']] = path

    for name, table in chosen.items():
        print(f'{name}: {len(table)} of {len(species)} formes', dict(Counter(src for _, src in table.values())))
    no_front = [s['name'] for s in species if s['id'] not in chosen['front']]
    if no_front:
        print('  no art of their own (a related forme is shown): ' + ', '.join(no_front))
    print(f'Item icons: {len(items)} of {len(request["items"])}')

    smogon_paths = [p for table in chosen.values() for p, _ in table.values() if not os.path.isabs(p)]
    smogon_paths += list(items.values())
    failed = fetch_all([(f'{SMOGON_RAW}/{rev}/{p}', os.path.join(REPO, p)) for p in smogon_paths], 'Smogon sprites')
    if failed:
        # Fall back to git for anything the raw host wouldn't serve.
        paths = [os.path.relpath(dest, REPO) for _, dest in failed]
        print(f'Retrying {len(paths)} through git...')
        for i in range(0, len(paths), 250):
            run('git', 'checkout', 'HEAD', '--', *paths[i:i + 250], cwd=REPO)

    out_dir = os.path.join(ROOT, 'public', 'assets')
    os.makedirs(out_dir, exist_ok=True)
    manifest = {}
    for name, table in chosen.items():
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
            'sprites': {sid: places[sid] + ([1] if kinds[sid] not in ('gen5', 'pokeapi') else []) for sid in places},
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

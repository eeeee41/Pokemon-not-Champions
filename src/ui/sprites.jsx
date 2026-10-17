// Sprite sheets built by scripts/build-sprites.py.
import manifest from '../generated/sprites.json';
import {dex, toID} from '../engine/dex.js';

export const ASSET_BASE = 'assets/';

// Formes drawn with another forme's art.
const ALIASES = {
  toxtricitylowkeygmax: 'toxtricitygmax',
  greninjabond: 'greninja',
  pichuspikyeared: 'pichu',
};

const resolved = {front: new Map(), back: new Map(), items: new Map()};

function resolve(sheet, name) {
  const cache = resolved[sheet];
  if (cache.has(name)) return cache.get(name);
  const table = manifest[sheet]?.sprites || {};
  let id = toID(name);
  let found = null;
  if (table[id]) found = id;
  else if (ALIASES[id] && table[ALIASES[id]]) found = ALIASES[id];
  else if (sheet !== 'items') {
    const s = dex.species.get(name);
    if (s.exists) {
      const candidates = [s.id, toID(s.baseSpecies + (s.forme && /Gmax$/.test(s.forme) ? 'gmax' : '')), toID(s.baseSpecies)];
      if (s.battleOnly && typeof s.battleOnly === 'string') candidates.push(toID(s.battleOnly));
      found = candidates.find(c => table[c]) || null;
    }
  }
  cache.set(name, found);
  return found;
}

/** Where a Pokémon's sprite lives. Back sprites fall back to a mirrored front. */
export function spriteInfo(name, back = false) {
  if (back) {
    const id = resolve('back', name);
    if (id) return {sheet: 'back', rect: manifest.back.sprites[id]};
  }
  const id = resolve('front', name);
  if (!id) return null;
  return {sheet: 'front', rect: manifest.front.sprites[id], flip: back};
}

export function spriteSize(name, back = false) {
  const info = spriteInfo(name, back);
  return info ? {w: info.rect[2], h: info.rect[3]} : {w: 40, h: 40};
}

/** Inline style that draws a sprite from its sheet; mask=true gives a mask in the sprite's shape. */
export function spriteStyle(name, back = false, scale = 1, mask = false) {
  const info = spriteInfo(name, back);
  if (!info) return null;
  const [x, y, w, h] = info.rect;
  const sheet = manifest[info.sheet];
  const [W, H] = sheet.size;
  const url = `url(${ASSET_BASE}${sheet.file})`;
  const pos = `${-x * scale}px ${-y * scale}px`;
  const size = `${W * scale}px ${H * scale}px`;
  const style = {width: `${w * scale}px`, height: `${h * scale}px`};
  if (mask) {
    Object.assign(style, {
      maskImage: url, maskPosition: pos, maskSize: size, maskRepeat: 'no-repeat',
      WebkitMaskImage: url, WebkitMaskPosition: pos, WebkitMaskSize: size, WebkitMaskRepeat: 'no-repeat',
    });
  } else {
    Object.assign(style, {backgroundImage: url, backgroundPosition: pos, backgroundSize: size});
  }
  if (info.flip) style.transform = 'scaleX(-1)';
  return style;
}

/** A Pokémon sprite at a given scale. */
export function Sprite({name, back = false, scale = 1, class: cls = '', style, title}) {
  const drawn = spriteStyle(name, back, scale);
  if (!drawn) {
    return <span class={`sprite ${cls}`} style={{width: 40 * scale, height: 40 * scale, ...style}} role="img" aria-label={name} title={title} />;
  }
  return <span class={`sprite ${cls}`} role="img" aria-label={name} title={title} style={{...drawn, ...style}} />;
}

/** A sprite scaled to fit a box, bottom-aligned. */
export function FitSprite({name, width = 56, height = 52, maxScale = 1, back = false, class: cls = '', title}) {
  const {w, h} = spriteSize(name, back);
  const scale = Math.min(maxScale, width / w, height / h);
  return (
    <span class={`sprite-box ${cls}`} style={{width: `${width}px`, height: `${height}px`}} title={title}>
      <Sprite name={name} back={back} scale={scale} />
    </span>
  );
}

export function ItemIcon({item, size = 24}) {
  const id = resolve('items', toID(item));
  if (!id) return <span class="item-icon" style={{width: size, height: size}} aria-hidden="true" />;
  const [x, y, w, h] = manifest.items.sprites[id];
  const [W, H] = manifest.items.size;
  const scale = Math.min(1.5, size / Math.max(w, h));
  return (
    <span
      class="item-icon"
      aria-hidden="true"
      style={{
        width: `${w * scale}px`,
        height: `${h * scale}px`,
        backgroundImage: `url(${ASSET_BASE}${manifest.items.file})`,
        backgroundPosition: `${-x * scale}px ${-y * scale}px`,
        backgroundSize: `${W * scale}px ${H * scale}px`,
      }}
    />
  );
}

export function TypeBadge({type, small = false}) {
  if (!type) return null;
  return <span class={`type t-${toID(type)}${small ? ' type-sm' : ''}`}>{type}</span>;
}

export function Types({types, small = false}) {
  return <span style={{display: 'inline-flex', gap: '4px'}}>{types.map(t => <TypeBadge key={t} type={t} small={small} />)}</span>;
}

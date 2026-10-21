// Sprite sheets built by scripts/build-sprites.py.
import manifest from '../generated/sprites.json';
import creatorSprites from '../generated/creator-sprites.json';
import {dex, toID} from '../engine/dex.js';
import {isCreatorSpecies} from '../engine/creator.js';
import megatronSprites from '../generated/megatron-sprites.json';
import {isMegatron} from '../engine/megatron.js';

export const ASSET_BASE = 'assets/';

// The one-file offline copy carries its sprite sheets inside the page and hands
// them over as blob URLs; the hosted site loads them from assets/.
export function assetUrl(file) {
  const offline = typeof window !== 'undefined' && window.CHAMPIONS_ASSETS;
  return (offline && offline[file]) || ASSET_BASE + file;
}

// Formes drawn with another forme's art.
const ALIASES = {
  toxtricitylowkeygmax: 'toxtricitygmax',
  greninjabond: 'greninja',
  pichuspikyeared: 'pichu',
};

const resolved = new Map();

/**
 * Finds a sprite id in one sheet. exact=true only accepts the forme itself (or
 * an alias drawn the same); exact=false also accepts related formes.
 */
function resolve(sheet, name, exact = true) {
  const key = `${sheet}|${exact ? 1 : 0}|${name}`;
  if (resolved.has(key)) return resolved.get(key);
  const table = manifest[sheet]?.sprites || {};
  const id = toID(name);
  let found = null;
  if (table[id]) found = id;
  else if (ALIASES[id] && table[ALIASES[id]]) found = ALIASES[id];
  else if (!exact && sheet !== 'items') {
    const s = dex.species.get(name);
    if (s.exists) {
      const candidates = [toID(s.baseSpecies + (s.forme && /Gmax$/.test(s.forme) ? 'gmax' : '')), toID(s.baseSpecies)];
      if (s.battleOnly && typeof s.battleOnly === 'string') candidates.unshift(toID(s.battleOnly));
      found = candidates.find(c => table[c]) || null;
    }
  }
  resolved.set(key, found);
  return found;
}

/**
 * Where a Pokémon's sprite lives. The forme's own art always wins over a
 * related forme's (a Mega with no back sprite shows its mirrored front, not
 * the regular Pokémon's back). For a shiny, shiny art wins over the view: a
 * mirrored shiny front beats a normal-colored back.
 */
export function spriteInfo(name, back = false, shiny = false) {
  if (isMegatron(name)) {
    const sheet = `${back ? 'back' : 'front'}${shiny ? '-shiny' : ''}`;
    return {sheet, file: megatronSprites.file, size: megatronSprites.size, rect: megatronSprites.sheets[sheet].megatron, flip: false};
  }
  if (isCreatorSpecies(name)) {
    const id = toID(name);
    const sheet = `${back ? 'back' : 'front'}${shiny ? '-shiny' : ''}`;
    const table = creatorSprites.sheets[sheet];
    const rect = table[id] || table.missingno;
    return {sheet, file: creatorSprites.file, size: creatorSprites.size, rect, flip: false};
  }
  const shines = shiny ? [['back-shiny', 'front-shiny'], ['back', 'front']] : [['back', 'front']];
  for (const exact of [true, false]) {
    for (const [backSheet, frontSheet] of shines) {
      const steps = back ? [[backSheet, false], [frontSheet, true]] : [[frontSheet, false]];
      for (const [sheet, flip] of steps) {
        const id = resolve(sheet, name, exact);
        if (id) return {sheet, file: manifest[sheet].file, size: manifest[sheet].size, rect: manifest[sheet].sprites[id], flip};
      }
    }
  }
  return null;
}

export function spriteSize(name, back = false, shiny = false) {
  const info = spriteInfo(name, back, shiny);
  return info ? {w: info.rect[2], h: info.rect[3]} : {w: 40, h: 40};
}

/** Is this a shiny, going by a battle "details" string like "Garchomp, L50, M, shiny"? */
export function detailsShiny(details = '') {
  return String(details).split(', ').includes('shiny');
}

/** Inline style that draws a sprite from its sheet; mask=true gives a mask in the sprite's shape. */
export function spriteStyle(name, back = false, scale = 1, mask = false, shiny = false) {
  const info = spriteInfo(name, back, shiny);
  if (!info) return null;
  const [x, y, w, h] = info.rect;
  const [W, H] = info.size;
  const url = `url(${assetUrl(info.file)})`;
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
export function Sprite({name, back = false, shiny = false, scale = 1, class: cls = '', style, title}) {
  const drawn = spriteStyle(name, back, scale, false, shiny);
  if (!drawn) {
    return <span class={`sprite ${cls}`} style={{width: 40 * scale, height: 40 * scale, ...style}} role="img" aria-label={name} title={title} />;
  }
  return <span class={`sprite ${cls}`} role="img" aria-label={name} title={title} style={{...drawn, ...style}} />;
}

/** A sprite scaled to fit a box, bottom-aligned. */
export function FitSprite({name, width = 56, height = 52, maxScale = 1, back = false, shiny = false, class: cls = '', title}) {
  const {w, h} = spriteSize(name, back, shiny);
  const scale = Math.min(maxScale, width / w, height / h);
  return (
    <span class={`sprite-box ${cls}`} style={{width: `${width}px`, height: `${height}px`}} title={title}>
      <Sprite name={name} back={back} shiny={shiny} scale={scale} />
    </span>
  );
}

/** One of Megatron's hidden parts. */
export function PartIcon({part, size = 48}) {
  const [x, y, w, h] = megatronSprites.parts[part];
  const [W, H] = megatronSprites.size;
  const scale = size / w;
  return (
    <span class="part-icon" aria-hidden="true" style={{
      width: `${size}px`, height: `${h * scale}px`,
      backgroundImage: `url(${assetUrl(megatronSprites.file)})`,
      backgroundPosition: `${-x * scale}px ${-y * scale}px`,
      backgroundSize: `${W * scale}px ${H * scale}px`,
    }} />
  );
}

/** The little star shown next to a shiny Pokémon's name. */
export function ShinyMark() {
  return <span class="shiny-mark" title="Shiny" aria-label="Shiny">★</span>;
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
        backgroundImage: `url(${assetUrl(manifest.items.file)})`,
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
  return <span class="types">{types.map(t => <TypeBadge key={t} type={t} small={small} />)}</span>;
}

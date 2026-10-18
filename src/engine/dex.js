// Pokémon data: species, moves, items, natures from Pokémon Showdown's simulator data.
import {Dex, toID} from '@pkmn/sim';
import {STATS, SP_MAX} from './constants.js';

export const dex = Dex.forGen(9);
export {toID};

const BANNED_TAGS = new Set(['CAP', 'Custom', 'LGPE']);

/** Real, released (or announced) Pokémon content from any generation. */
export function inGame(entry) {
  return !!entry && !!entry.exists && !BANNED_TAGS.has(entry.isNonstandard);
}

/**
 * Species a player can put on a team. Megas, Primals, Gigantamax and other
 * battle-only formes happen during battle, so they are not picked directly.
 */
export function isSelectableSpecies(s) {
  if (!inGame(s)) return false;
  if (s.battleOnly || s.isMega || s.isPrimal) return false;
  if (/(^|-)(Mega|Primal|Gmax|Totem|Eternamax)(-|$)/.test(s.forme)) return false;
  return true;
}

let speciesCache = null;
export function selectableSpecies() {
  if (!speciesCache) {
    speciesCache = dex.species.all()
      .filter(isSelectableSpecies)
      .sort((a, b) => a.num - b.num || (a.forme ? 1 : 0) - (b.forme ? 1 : 0) || a.name.localeCompare(b.name));
  }
  return speciesCache;
}

let itemCache = null;
export function selectableItems() {
  if (!itemCache) {
    const usable = dex.items.all()
      .filter(i => inGame(i) && !i.isPokeball && i.id !== 'pokeball' && !/^TR\d/.test(i.name) && i.desc);
    // Gen 2 names (Gold Berry, Pink Bow, Stick...) share a number with a modern
    // item; keep the newest so every item has its own number (save codes rely on it).
    const newest = new Map();
    for (const i of usable) {
      const prev = newest.get(i.num);
      if (!prev || i.gen > prev.gen) newest.set(i.num, i);
    }
    itemCache = usable.filter(i => newest.get(i.num) === i).sort((a, b) => a.name.localeCompare(b.name));
  }
  return itemCache;
}

let natureCache = null;
export function natures() {
  if (!natureCache) {
    natureCache = dex.natures.all().sort((a, b) => a.name.localeCompare(b.name));
  }
  return natureCache;
}

export function speciesAbilities(species) {
  const s = typeof species === 'string' ? dex.species.get(species) : species;
  const out = [];
  for (const slot of ['0', '1', 'H', 'S']) {
    const a = s.abilities[slot];
    if (a && !out.includes(a)) out.push(a);
  }
  return out;
}

/** What a held item does in battle, for badges in the UI. */
export function itemGimmick(itemName, speciesName) {
  const item = dex.items.get(itemName);
  if (!item.exists) return null;
  const species = dex.species.get(speciesName);
  if (item.megaStone) {
    const target = Object.entries(item.megaStone).find(([from]) => from === species.name || from === species.baseSpecies);
    return target ? {kind: 'mega', into: target[1]} : {kind: 'mega-wrong'};
  }
  if (item.zMove) {
    if (item.itemUser && !item.itemUser.includes(species.name)) return {kind: 'z-wrong'};
    return {kind: 'z', move: item.zMove === true ? null : item.zMove, type: item.zMoveType};
  }
  if (item.isPrimalOrb) return {kind: 'primal'};
  return null;
}

/**
 * Pokémon Champions stat formula (level 50, IVs 31): each stat point adds
 * exactly 1 to the stat before the nature is applied.
 *   HP    = base + points + 75
 *   other = floor((base + points + 20) * nature)
 */
export function calcStat(baseStats, stat, sp, natureName) {
  const base = baseStats[stat];
  if (stat === 'hp') return base + sp + 75;
  let value = base + sp + 20;
  const nature = dex.natures.get(natureName || 'Hardy');
  if (nature.plus === stat) value = Math.floor(value * 110 / 100);
  else if (nature.minus === stat) value = Math.floor(value * 90 / 100);
  return value;
}

export function calcStats(speciesName, sp, natureName) {
  const species = dex.species.get(speciesName);
  const out = {};
  for (const stat of STATS) out[stat] = calcStat(species.baseStats, stat, sp?.[stat] || 0, natureName);
  if (species.maxHP) out.hp = species.maxHP; // Shedinja
  return out;
}

export function emptySP() {
  return {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
}

export function clampSP(v) {
  return Math.max(0, Math.min(SP_MAX, Math.round(Number(v) || 0)));
}

let megaIndex = null;
/**
 * Every way a species can Mega Evolve: [{item, mega}] for Mega Stones, or
 * [{move, mega}] for Rayquaza, which needs Dragon Ascent instead of a stone.
 */
export function megaOptions(speciesName) {
  if (!megaIndex) {
    megaIndex = new Map();
    const add = (base, option) => {
      if (!megaIndex.has(base)) megaIndex.set(base, []);
      megaIndex.get(base).push(option);
    };
    for (const item of dex.items.all()) {
      if (!inGame(item) || !item.megaStone) continue;
      for (const [base, mega] of Object.entries(item.megaStone)) {
        if (inGame(dex.species.get(mega))) add(base, {item: item.name, mega});
      }
    }
    for (const s of dex.species.all()) {
      if (s.isMega && s.requiredMove && inGame(s)) add(s.baseSpecies, {move: s.requiredMove, mega: s.name});
    }
    for (const list of megaIndex.values()) list.sort((a, b) => a.mega.localeCompare(b.mega));
  }
  const s = dex.species.get(speciesName);
  return megaIndex.get(s.name) || [];
}

/** "Charizard-Mega-X" → "Mega Charizard X". */
export function megaName(formeName) {
  return String(formeName).replace(/^(.*?)-Mega(?:-([A-Z]))?$/, (_, base, v) => `Mega ${base}${v ? ` ${v}` : ''}`);
}

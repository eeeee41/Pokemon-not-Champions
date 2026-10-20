// The site creator's secret Pokémon: MissingNo.
//
// Unlocked in the team builder with a secret phrase (only its SHA-256 hash is
// stored here). Teams with MissingNo. are legal everywhere, online included,
// so other players' pages accept them.
//
//   Every type at once. Takes 2x from Rock; immune to Normal, Fighting,
//   Electric, Ground, Poison, Psychic and Ghost; neutral or resisted otherwise.
//   Base 255 in every stat (Mega: 300), 32 stat points in every stat, any move.
//   Ability Infinity: STAB on every move, that type chart, and only direct
//   attacks can hurt it. Mega ability Limitless: all that, its attacks never
//   miss, and its stats can't be lowered. It can Mega Evolve and Gigantamax
//   (G-Max Glitch) in the same battle.
import {Dex} from '@pkmn/sim';

export const CREATOR_SPECIES = 'MissingNo.';
export const CREATOR_ID = 'missingno';
const CODE_HASH = '0b8cdf286e6529a5e2d7a92fc0ef8fdc39e399f154b848d94a52c4c43aab0651';
const UNLOCK_KEY = 'champions-pvp.creator.v1';

const ALL_TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
const IMMUNE = new Set(['Normal', 'Fighting', 'Electric', 'Ground', 'Poison', 'Psychic', 'Ghost']);

/** Is this MissingNo. (or its Mega)? */
export function isCreatorSpecies(species) {
  const name = typeof species === 'string' ? species : species?.baseSpecies || species?.name || '';
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(CREATOR_ID);
}

/** Its own type chart, applied once per hit (on the first of its types). */
function infinityEffectiveness(typeMod, target, type, move) {
  if (!target || !move) return typeMod;
  const types = target.getTypes();
  if (type !== types[0]) return 0;
  if (move.type === 'Rock') return 1;
  let total = 0;
  for (const t of types) total += this.dex.getEffectiveness(move, t);
  return Math.min(0, total);
}

const infinityHandlers = {
  onModifyMove(move) {
    move.forceSTAB = true;
  },
  // All 18 types would also make it immune to Dragon (through Fairy). It isn't.
  onNegateImmunity(pokemon, type) {
    if (type === 'Dragon') return false;
  },
  onEffectiveness: infinityEffectiveness,
  onDamage(damage, target, source, effect) {
    if (effect && effect.effectType !== 'Move') return false;
  },
};

const UNTOUCHABLE = {
  breakable: 0, cantsuppress: 1, failroleplay: 1, noreceiver: 1, noentrain: 1, notrace: 1, failskillswap: 1, notransform: 1,
};

function install() {
  const data = Dex.data;
  if (data.Abilities.infinity) return;
  const base = Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(s => [s, 255]));
  const mega = Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(s => [s, 300]));
  data.Pokedex.missingno = {
    num: 0,
    name: 'MissingNo.',
    types: [...ALL_TYPES],
    baseStats: base,
    abilities: {0: 'Infinity'},
    heightm: 3,
    weightkg: 1590.8,
    color: 'Gray',
    eggGroups: ['Undiscovered'],
    otherFormes: ['MissingNo.-Mega', 'MissingNo.-Gmax'],
    formeOrder: ['MissingNo.', 'MissingNo.-Mega', 'MissingNo.-Gmax'],
    canGigantamax: 'G-Max Glitch',
    gen: 1,
  };
  data.Pokedex.missingnomega = {
    num: 0,
    name: 'MissingNo.-Mega',
    baseSpecies: 'MissingNo.',
    forme: 'Mega',
    types: [...ALL_TYPES],
    baseStats: mega,
    abilities: {0: 'Limitless'},
    heightm: 4.4,
    weightkg: 1590.8,
    color: 'Gray',
    eggGroups: ['Undiscovered'],
    requiredItem: 'MissingNite',
    gen: 1,
  };
  data.Pokedex.missingnogmax = {
    num: 0,
    name: 'MissingNo.-Gmax',
    baseSpecies: 'MissingNo.',
    forme: 'Gmax',
    types: [...ALL_TYPES],
    baseStats: base,
    abilities: {0: 'Infinity'},
    heightm: 99.9,
    weightkg: 0,
    color: 'Gray',
    eggGroups: ['Undiscovered'],
    changesFrom: 'MissingNo.',
    gen: 1,
  };
  data.FormatsData.missingnogmax = {isNonstandard: 'Gigantamax', tier: 'Illegal'};
  data.FormatsData.missingno = {tier: 'OU', isNonstandard: null};
  data.FormatsData.missingnomega = {tier: 'OU', isNonstandard: null};

  data.Abilities.infinity = {
    ...infinityHandlers,
    flags: {...UNTOUCHABLE},
    name: 'Infinity',
    desc: 'Every move gets STAB. Weak only to Rock; immune to Normal, Fighting, Electric, Ground, Poison, Psychic and Ghost; neutral or better against the rest. Only direct attacks can hurt it.',
    shortDesc: 'All moves STAB; weak only to Rock, immune to 7 types; only direct attacks hurt it.',
    rating: 5,
    num: 9001,
  };
  data.Abilities.limitless = {
    ...infinityHandlers,
    onModifyMove(move) {
      move.forceSTAB = true;
      move.accuracy = true;
    },
    onTryBoost(boost, target, source, effect) {
      if (source && target === source) return;
      let showMsg = false;
      for (const stat of Object.keys(boost)) {
        if (boost[stat] < 0) {
          delete boost[stat];
          showMsg = true;
        }
      }
      if (showMsg && !effect.secondaries && effect.id !== 'octolock') {
        this.add('-fail', target, 'unboost', '[from] ability: Limitless', `[of] ${target}`);
      }
    },
    flags: {...UNTOUCHABLE},
    name: 'Limitless',
    desc: 'Everything Infinity does, and its moves never miss and its stats can\'t be lowered by others.',
    shortDesc: 'Infinity + moves never miss + stats can\'t be lowered.',
    rating: 5,
    num: 9002,
  };
  data.Items.missingnite = {
    name: 'MissingNite',
    spritenum: 0,
    megaStone: {'MissingNo.': 'MissingNo.-Mega'},
    itemUser: ['MissingNo.'],
    onTakeItem(item, source) {
      return !item.megaStone?.[source.baseSpecies.baseSpecies];
    },
    num: 4000,
    gen: 9,
    desc: 'If held by MissingNo., this item allows it to Mega Evolve in battle.',
    shortDesc: 'MissingNo.: Mega Evolves.',
  };
  data.Moves.gmaxglitch = {
    num: 9001,
    accuracy: true,
    basePower: 10,
    category: 'Physical',
    isNonstandard: 'Gigantamax',
    name: 'G-Max Glitch',
    pp: 5,
    priority: 0,
    flags: {},
    isMax: 'MissingNo.',
    self: {
      onHit(source) {
        this.boost({atk: 1, def: 1, spa: 1, spd: 1, spe: 1}, source);
      },
    },
    onHit(target, source) {
      if (target !== source) this.boost({atk: -1, def: -1, spa: -1, spd: -1, spe: -1}, target, source);
    },
    secondary: null,
    target: 'adjacentFoe',
    type: 'Normal',
    desc: 'Raises all of the user\'s stats and lowers all of the target\'s stats by 1.',
    shortDesc: 'Raises user\'s stats, lowers target\'s stats.',
    contestType: 'Cool',
  };
}
install();

// ---------- unlocking ----------

function normalize(text) {
  // "[secret phrase]" works as well as the phrase alone.
  return String(text || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/ missing ?no$/, '');
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function creatorUnlocked() {
  try {
    return localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

/** Resolves true (and remembers it in this browser) when `text` is the secret phrase. */
export async function tryCreatorCode(text) {
  const clean = normalize(text);
  if (clean.split(' ').length < 6) return false;
  if ((await sha256(clean)) !== CODE_HASH) return false;
  try {
    localStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    // Unlocked for this visit only.
  }
  return true;
}

export const CREATOR_SP_TOTAL = 192; // 32 in every stat

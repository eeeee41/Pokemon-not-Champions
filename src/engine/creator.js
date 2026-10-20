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
//   Signature move Glitched Power (behind a second phrase, typed into the move
//   search): 1 PP, raises every stat, accuracy and evasion by 6.
import {Dex} from '@pkmn/sim';

export const CREATOR_SPECIES = 'MissingNo.';
export const CREATOR_ID = 'missingno';
const CODE_HASH = '0b8cdf286e6529a5e2d7a92fc0ef8fdc39e399f154b848d94a52c4c43aab0651'; // MissingNo.'s phrase

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
  // Its signature move, behind a second secret phrase.
  data.Moves.glitchedpower = {
    num: 1020, // save codes store move numbers in 10 bits, so it must stay under 1023
    accuracy: 100,
    basePower: 0,
    category: 'Status',
    name: 'Glitched Power',
    pp: 1,
    noPPBoosts: true,
    priority: 0,
    flags: {},
    boosts: {atk: 6, def: 6, spa: 6, spd: 6, spe: 6, accuracy: 6, evasion: 6},
    secondary: null,
    target: 'self',
    type: 'Normal',
    gen: 9,
    desc: 'MissingNo.\'s signature move. Raises every stat, accuracy and evasiveness by 6 stages. 1 PP.',
    shortDesc: 'Raises every stat, accuracy and evasion by 6.',
    contestType: 'Cool',
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
//
// Typing a secret phrase stores a token made from the phrase itself. Only a
// hash of each token is kept here, so a token can't be read out of the code or
// faked by editing the browser's saved data: it takes the phrase.

export const GLITCHED_POWER = 'glitchedpower';
const LOCKS = {
  [CREATOR_ID]: {
    code: CODE_HASH,
    prefix: 'champions-pvp creator token|',
    check: '6ea042fe204b1d008f75be6077d66c5dad29a7b2ef34252a08b060109c65515f',
    key: 'champions-pvp.creator.v2',
  },
  [GLITCHED_POWER]: {
    code: 'cdf1e7e40125a2e306656760ed029347a28250a7bf0476690213667fab386a1c',
    prefix: 'champions-pvp glitched power token|',
    check: '68a0e9fdf450ca3bfae44b363f4fa68b0079bcc1aa824f11e3cade8fab2ac036',
    key: 'champions-pvp.glitch.v1',
  },
};

function normalize(text) {
  // The phrase works with or without "Missing No." on the end.
  return String(text || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/ missing ?no$/, '');
}

import {sha256} from './sha256.js';
import {sealedIds, recordSealed, clearSealed} from './seal.js';
export {sha256};

const session = new Set(); // unlocked this visit, even if the browser won't save it
const checked = new Map();

/** Has this browser unlocked `name` (MissingNo. or Glitched Power) with its phrase? */
export function isUnlocked(name) {
  const lock = LOCKS[name];
  if (!lock) return false;
  if (session.has(name)) return true;
  let token = null;
  try {
    token = globalThis.localStorage?.getItem(lock.key) ?? null;
  } catch {
    token = null;
  }
  if (!token) return false;
  if (checked.get(name)?.token !== token) checked.set(name, {token, ok: sha256(token) === lock.check});
  return checked.get(name).ok;
}

// The other way to get MissingNo.: beat every rival on Champion difficulty.
// Wins are sealed when a battle ends (see seal.js), so editing the saved wins
// doesn't count.
const RIVAL_WINS_KEY = 'champions-pvp.rivalwins.v1';
const RIVAL_KIND = 'rival-champion';
let rivalIds = [];

/** rivals.js says which rivals there are. */
export function setRivalIds(ids) {
  rivalIds = [...ids];
}

/** Records a Champion-difficulty win against a rival. */
export function recordChampionWin(id) {
  if (rivalIds.includes(id)) recordSealed(RIVAL_KIND, RIVAL_WINS_KEY, id);
}

/** Rivals beaten on Champion in this browser (the sealed record). */
export function championWins() {
  const won = new Set(sealedIds(RIVAL_KIND, RIVAL_WINS_KEY));
  return rivalIds.filter(id => won.has(id));
}

function unlockedByRivals() {
  return rivalIds.length > 0 && championWins().length === rivalIds.length;
}

/** Forgets the sealed Champion wins (for tests). */
export function resetChampionWins() {
  clearSealed(RIVAL_WINS_KEY);
}

export function creatorUnlocked() {
  return isUnlocked(CREATOR_ID) || unlockedByRivals();
}

export function glitchedPowerUnlocked() {
  return isUnlocked(GLITCHED_POWER);
}

/** Unlocks whatever `text` is the phrase for, and says which ('missingno', 'glitchedpower') or null. */
export async function tryUnlock(text) {
  const clean = normalize(text);
  if (clean.split(' ').length < 6) return null;
  const hash = sha256(clean);
  for (const [name, lock] of Object.entries(LOCKS)) {
    if (hash !== lock.code) continue;
    const token = sha256(lock.prefix + clean);
    if (sha256(token) !== lock.check) return null;
    session.add(name);
    try {
      globalThis.localStorage?.setItem(lock.key, token);
      if (name === CREATOR_ID) globalThis.localStorage?.removeItem('champions-pvp.creator.v1');
    } catch {
      // Unlocked for this visit only.
    }
    return name;
  }
  return null;
}

/** True when `text` is MissingNo.'s phrase (and unlocks it). */
export async function tryCreatorCode(text) {
  return (await tryUnlock(text)) === CREATOR_ID;
}

/** Forgets every unlock made this visit (for tests). */
export function lockCreator() {
  session.clear();
  checked.clear();
}

/** Does this team have MissingNo. in it? */
export function hasCreatorMon(team) {
  return (team?.mons || []).some(m => isCreatorSpecies(m.species));
}

export const CREATOR_SP_TOTAL = 192; // 32 in every stat

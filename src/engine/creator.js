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
  // "[secret phrase]" works as well as the phrase alone.
  return String(text || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/ missing ?no$/, '');
}

// A small synchronous SHA-256, so the unlock can be checked while drawing.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(len / 0x20000000));
  view.setUint32(total - 4, (len << 3) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rot = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += k;
  }
  return [...h].map(x => x.toString(16).padStart(8, '0')).join('');
}

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

export function creatorUnlocked() {
  return isUnlocked(CREATOR_ID);
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

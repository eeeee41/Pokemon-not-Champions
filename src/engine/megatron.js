// Megatron, the second secret Pokémon (#-1, Steel / Dark).
//
// His six parts are hidden around the site, one on each page. Clicking a part
// collects it; with all six, Megatron can be put on teams. Teams with him are
// legal everywhere, online included, so other players' pages accept them.
//
//   Base stats 106 / 135 / 110 / 125 / 90 / 60 (BST 626).
//   Ability Decepticon Leader: his Dark and Steel moves get 1.5x power at half
//   HP or less, and allied Steel-types' Attack and Sp. Atk get 1.3x in Doubles.
//   Signature moves Fusion Cannon and Peace Through Tyranny.
import {Dex} from '@pkmn/sim';
import {sealedIds, recordSealed, clearSealed} from './seal.js';

export const MEGATRON = 'Megatron';
export const MEGATRON_ID = 'megatron';
export const MEGATRON_MOVES = [
  'fusioncannon', 'peacethroughtyranny', 'ironhead', 'nightslash', 'heavyslam', 'flashcannon',
  'darkpulse', 'hyperbeam', 'nastyplot', 'taunt', 'kingsshield',
];
export const MEGATRON_SIGNATURES = ['fusioncannon', 'peacethroughtyranny'];

export function isMegatron(species) {
  const name = typeof species === 'string' ? species : species?.baseSpecies || species?.name || '';
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '') === MEGATRON_ID;
}

function boostsDarkSteel(value, attacker, defender, move) {
  if ((move.type === 'Dark' || move.type === 'Steel') && attacker.hp <= attacker.maxhp / 2) {
    this.debug('Decepticon Leader boost');
    return this.chainModify(1.5);
  }
}

function boostsSteelAllies(value, pokemon) {
  if (pokemon === this.effectState.target || !pokemon.hasType('Steel')) return;
  return this.chainModify([5325, 4096]); // 1.3x
}

function install() {
  const data = Dex.data;
  if (data.Pokedex.megatron) return;
  data.Pokedex.megatron = {
    num: -1,
    name: 'Megatron',
    types: ['Steel', 'Dark'],
    gender: 'N',
    baseStats: {hp: 106, atk: 135, def: 110, spa: 125, spd: 90, spe: 60},
    abilities: {0: 'Decepticon Leader'},
    heightm: 8,
    weightkg: 999.9,
    color: 'Gray',
    eggGroups: ['Undiscovered'],
    gen: 9,
  };
  data.FormatsData.megatron = {tier: 'OU', isNonstandard: null};

  data.Abilities.decepticonleader = {
    onModifyAtkPriority: 5,
    onModifyAtk: boostsDarkSteel,
    onModifySpAPriority: 5,
    onModifySpA: boostsDarkSteel,
    onAllyModifyAtkPriority: 4,
    onAllyModifyAtk: boostsSteelAllies,
    onAllyModifySpAPriority: 4,
    onAllyModifySpA: boostsSteelAllies,
    flags: {},
    name: 'Decepticon Leader',
    desc: 'At 1/2 HP or less, this Pokémon\'s Dark- and Steel-type moves have 1.5x power. Its allied Steel-types have 1.3x Attack and Sp. Atk.',
    shortDesc: 'Dark/Steel moves 1.5x at half HP; allied Steel-types 1.3x Atk and Sp. Atk.',
    rating: 4,
    num: 9003,
  };

  // Save codes store move numbers in 10 bits, so these must stay under 1023.
  data.Moves.fusioncannon = {
    num: 1021,
    accuracy: 90,
    basePower: 130,
    category: 'Special',
    name: 'Fusion Cannon',
    pp: 5,
    priority: 0,
    flags: {protect: 1, mirror: 1, metronome: 1},
    self: {boosts: {spa: -2}},
    secondary: null,
    target: 'normal',
    type: 'Steel',
    gen: 9,
    desc: 'Megatron\'s signature move: a devastating blast of antimatter. Lowers the user\'s Special Attack by 2 stages.',
    shortDesc: 'Lowers the user\'s Sp. Atk by 2.',
    contestType: 'Cool',
  };
  data.Moves.peacethroughtyranny = {
    num: 1022,
    accuracy: true,
    basePower: 0,
    category: 'Status',
    name: 'Peace Through Tyranny',
    pp: 10,
    priority: 0,
    flags: {snatch: 1, metronome: 1},
    boosts: {atk: 2, spa: 2, def: -1, spd: -1},
    secondary: null,
    target: 'self',
    type: 'Dark',
    gen: 9,
    desc: 'Megatron\'s ultimate command. Raises the user\'s Attack and Sp. Atk by 2 stages and lowers its Defense and Sp. Def by 1 stage.',
    shortDesc: 'Raises Atk, Sp. Atk by 2; lowers Def, Sp. Def by 1.',
    contestType: 'Tough',
  };
}
install();

// ---------- the parts hunt ----------

/** One part on each page; `page` is the app's route name. */
export const PARTS = [
  {id: 'helm', name: 'Helm', page: 'home'},
  {id: 'core', name: 'Spark Core', page: 'setup'},
  {id: 'leftarm', name: 'Left Arm', page: 'rivals'},
  {id: 'rightarm', name: 'Right Arm', page: 'online'},
  {id: 'chassis', name: 'Chassis', page: 'teams'},
  {id: 'legs', name: 'Legs', page: 'editor'},
];
// Found parts are sealed (see seal.js): editing the saved list doesn't add any.
const PARTS_KEY = 'champions-pvp.megatron.v2';
const KIND = 'megatron-part';
const listeners = new Set();

/** Ids of the parts found in this browser. */
export function collectedParts() {
  return sealedIds(KIND, PARTS_KEY).filter(id => PARTS.some(p => p.id === id));
}

export function megatronUnlocked() {
  return collectedParts().length === PARTS.length;
}

/** Collects a part. Returns how many are found now. */
export function collectPart(id) {
  if (!PARTS.some(p => p.id === id)) return collectedParts().length;
  recordSealed(KIND, PARTS_KEY, id);
  const count = collectedParts().length;
  for (const fn of listeners) fn(count, id);
  return count;
}

/** Calls fn(count, partId) whenever a part is collected; returns an unsubscribe function. */
export function onPartsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Forgets the parts (for tests). */
export function resetParts() {
  clearSealed(PARTS_KEY);
}

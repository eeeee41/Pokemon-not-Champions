// The Champions-style battle formats, built on Pokémon Showdown's simulator.
//
// Base: Gen 9 Custom Game (Singles) / Doubles Custom Game, so every species,
// move, item and ability from any generation works. On top of that:
//   - Champions stat formula: the team's "EVs" field carries stat points (0-32)
//   - Mega Evolution, Z-Moves, Dynamax/Gigantamax and Terastallization, each once per battle
//   - A Pokémon that has Terastallized can't Dynamax, and a Dynamaxed one can't Terastallize
import {Dex, Side, Pokemon} from '@pkmn/sim';
import {MODES} from './constants.js';

const BASE_FORMATS = {
  singles: 'gen9customgame',
  doubles: 'gen9doublescustomgame',
};

/** Battle-script override: Champions stats, where set.evs holds stat points. */
function championsStatModify(baseStats, set, statName) {
  const tr = this.trunc;
  const points = set.evs[statName] || 0;
  if (statName === 'hp') return baseStats.hp + points + 75;
  let stat = baseStats[statName] + points + 20;
  const nature = this.dex.natures.get(set.nature);
  if (nature.plus === statName) stat = tr(tr(stat * 110, 16) / 100);
  else if (nature.minus === statName) stat = tr(tr(stat * 90, 16) / 100);
  return stat;
}

let patched = false;
/** Lets Dynamax run outside Gen 8 and keeps Dynamax and Tera on separate Pokémon. */
export function applySimPatches() {
  if (patched) return;
  patched = true;

  Side.prototype.canDynamaxNow = function () {
    if (this.battle.gameType === 'multi' && this.battle.turn % 2 !== [1, 1, 0, 0][this.n]) return false;
    return !this.dynamaxUsed;
  };

  const getDynamaxRequest = Pokemon.prototype.getDynamaxRequest;
  Pokemon.prototype.getDynamaxRequest = function (skipChecks) {
    if (!skipChecks && this.terastallized) return undefined;
    // The creator's MissingNo. may Mega Evolve and Gigantamax in the same battle.
    if (!skipChecks && this.baseSpecies.baseSpecies === 'MissingNo.') {
      if (!this.side.canDynamaxNow()) return undefined;
      return getDynamaxRequest.call(this, true);
    }
    return getDynamaxRequest.call(this, skipChecks);
  };

  const getMoveRequestData = Pokemon.prototype.getMoveRequestData;
  Pokemon.prototype.getMoveRequestData = function () {
    const data = getMoveRequestData.call(this);
    if (this.volatiles['dynamax']) delete data.canTerastallize;
    return data;
  };
}

const formatCache = {};
export function getFormat(mode) {
  if (!MODES[mode]) throw new Error(`Unknown mode ${mode}`);
  if (formatCache[mode]) return formatCache[mode];
  const base = Dex.formats.get(BASE_FORMATS[mode], true);
  const format = Object.assign(Object.create(Object.getPrototypeOf(base)), base);
  format.id = `gen9champions${mode}`;
  format.name = `[Gen 9] Champions ${MODES[mode].label}`;
  format.ruleset = ['Team Preview', 'Cancel Mod', 'Endless Battle Clause'];
  format.banlist = [];
  // Past/Future content is allowed; the simulator also reads this to allow Mega Rayquaza.
  format.unbanlist = ['Past', 'Future'];
  format.restricted = [];
  format.customRules = null;
  format.ruleTable = null;
  // Custom Game is a debug format (exact HP for everyone, debug lines). Ours isn't.
  format.debug = false;
  format.battle = {statModify: championsStatModify};
  formatCache[mode] = format;
  return format;
}

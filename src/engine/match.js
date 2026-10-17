// A battle between two players, run by Pokémon Showdown's simulator.
//
// The same class drives local two-player games and (later) online games: both
// players' browsers create a Match with the same seed and teams, then feed it
// the same choices in the same order, so they stay in lockstep.
import {Battle, PRNG} from '@pkmn/sim';
import {getFormat, applySimPatches} from './format.js';
import {toSimTeam} from './team.js';

const SIDE_IDS = ['p1', 'p2'];

/** Splits Showdown's omniscient log into what one player is allowed to see. */
export function channelLines(lines, perspective) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('|split|')) {
      const who = line.slice(7);
      const secret = lines[i + 1];
      const shared = lines[i + 2];
      i += 2;
      out.push(who === perspective ? secret : shared);
    } else {
      out.push(line);
    }
  }
  return out;
}

export class Match {
  /**
   * @param {object} opts
   * @param {'singles'|'doubles'} opts.mode
   * @param {string|number[]} [opts.seed]
   * @param {{name: string, team: object}[]} opts.players
   */
  constructor({mode, seed, players}) {
    applySimPatches();
    this.mode = mode;
    this.seed = seed || PRNG.generateSeed();
    this.names = players.map(p => p.name);
    this.raw = [];
    this.views = {p1: [], p2: [], spectator: []};
    this.requests = [null, null];
    this.errors = [null, null];
    this.choiceLog = [[], []];
    this.listeners = new Set();

    this.battle = new Battle({
      format: getFormat(mode),
      seed: this.seed,
      send: (type, data) => this.receive(type, data),
    });
    this.battle.setPlayer('p1', {name: players[0].name, team: toSimTeam(players[0].team)});
    this.battle.setPlayer('p2', {name: players[1].name, team: toSimTeam(players[1].team)});
    // Dynamax is switched off outside Gen 8 when a side is created; turn it back on.
    for (const side of this.battle.sides) side.dynamaxUsed = false;
    this.battle.sendUpdates();
  }

  receive(type, data) {
    if (type === 'update') {
      const lines = [];
      for (const chunk of data) lines.push(...String(chunk).split('\n'));
      this.raw.push(...lines);
      this.views.p1.push(...channelLines(lines, 'p1'));
      this.views.p2.push(...channelLines(lines, 'p2'));
      this.views.spectator.push(...channelLines(lines, ''));
    } else if (type === 'sideupdate') {
      const nl = data.indexOf('\n');
      const i = SIDE_IDS.indexOf(data.slice(0, nl));
      const msg = data.slice(nl + 1);
      if (msg.startsWith('|request|')) {
        this.requests[i] = JSON.parse(msg.slice(9));
        this.errors[i] = null;
      } else if (msg.startsWith('|error|')) {
        this.errors[i] = msg.slice(7);
      }
    }
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this);
  }

  get ended() {
    return this.battle.ended;
  }

  /** 0 or 1 for the winner, null for a tie or an unfinished battle. */
  get winnerIndex() {
    if (!this.battle.ended || !this.battle.winner) return null;
    const index = this.battle.sides.findIndex(s => s.name === this.battle.winner);
    return index >= 0 ? index : null;
  }

  /** Does player i have a decision to make right now? */
  needsChoice(i) {
    if (this.battle.ended) return false;
    const side = this.battle.sides[i];
    const req = this.requests[i];
    return !!req && !req.wait && !!side.requestState && !side.isChoiceDone();
  }

  /** Submit player i's choice, e.g. "move 1 2 mega, switch 4". Returns false with errors[i] set if invalid. */
  choose(i, choice) {
    this.errors[i] = null;
    const ok = this.battle.choose(SIDE_IDS[i], choice);
    if (ok) this.choiceLog[i].push(choice);
    this.battle.sendUpdates();
    this.emit();
    return ok;
  }

  /** Undo a choice made this turn (only before the other player has chosen). */
  undo(i) {
    this.battle.undoChoice(SIDE_IDS[i]);
    if (this.choiceLog[i].length) this.choiceLog[i].pop();
    this.battle.sendUpdates();
    this.emit();
  }

  forfeit(i) {
    if (this.battle.ended) return;
    this.battle.lose(SIDE_IDS[i]);
    this.battle.sendUpdates();
    this.emit();
  }
}

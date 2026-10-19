// Computer opponents for Singles.
//
// The bot copies the battle and plays possible turns forward with the real
// simulator, then scores where each line leaves it. Like the in-game AI it
// knows your team's moves and items, but not the future: every simulated turn
// gets fresh luck, and it decides before seeing your choice for the turn.
//
//   Normal    picks strong moves with some randomness; only switches when it must
//   Hard      tries every option against every reply you could make, and plays
//             the one that holds up best if you answer well (with the odd slip)
//   Champion  the same, but thinks harder: plays each line out several times
//             to see past luck, re-checks its best options against everything
//             you could do, and picks its lead from your team
//   (Hard and Champion both save Mega / Tera / Z-Moves / Dynamax for when they matter.)
import {Battle, Dex, PRNG} from '@pkmn/sim';
import {getFormat, applySimPatches} from './format.js';

export const LEVELS = {
  normal: {label: 'Normal', blurb: 'A fair fight'},
  hard: {label: 'Hard', blurb: 'Plays every option out'},
  champion: {label: 'Champion', blurb: 'Thinks the hardest'},
};

const SIDE_IDS = ['p1', 'p2'];
const GIMMICKS = ['mega', 'zmove', 'dynamax', 'terastallize'];

// Let a copied battle find our custom Champions formats by name.
let registered = false;
function registerFormats() {
  if (registered) return;
  registered = true;
  applySimPatches();
  const get = Dex.formats.get.bind(Dex.formats);
  Dex.formats.get = (name, strict) => {
    const id = typeof name === 'string' ? name.replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
    if (id === 'gen9championssingles') return getFormat('singles');
    if (id === 'gen9championsdoubles') return getFormat('doubles');
    return get(name, strict);
  };
}

/** A playable copy of a battle snapshot, with its own luck. */
function restore(json, seedRng) {
  const b = Battle.fromJSON({...json, log: []});
  b.send = () => {};
  b.sendUpdates();
  b.prng = new PRNG(seedRng ? [0, 0, 0, 0].map(() => Math.floor(seedRng() * 65536)) : PRNG.generateSeed());
  // A new Battle switches Dynamax off outside Gen 8; keep what the snapshot says.
  for (const side of b.sides) {
    const saved = json.sides?.[side.n]?.dynamaxUsed;
    if (saved !== undefined) side.dynamaxUsed = saved;
    // Never act on a choice already made in the real battle: each copy decides afresh.
    if (side.requestState) side.clearChoice();
  }
  return b;
}

/** Snapshot of a battle that a bot can explore. Take it before the human's choice is in. */
export function snapshot(battle) {
  registerFormats();
  // The simulator's snapshot shares the live battle's log; never let copies write to it.
  return {...battle.toJSON(), log: []};
}

// ---------- the options in a request ----------

function isFainted(p) {
  return /\bfnt\b/.test(p.condition) || p.condition.startsWith('0');
}

/** Every distinct thing a player could do with a Singles request, as choice strings. */
export function options(request, {gimmicks = true} = {}) {
  if (!request || request.wait) return [];
  const team = request.side.pokemon;
  const bench = team.map((p, i) => ({p, i})).filter(({p}) => !p.active && !isFainted(p));
  if (request.forceSwitch) {
    if (!request.forceSwitch[0]) return ['pass'];
    const revive = team.some(p => p.reviving);
    const pool = revive ? team.map((p, i) => ({p, i})).filter(({p}) => isFainted(p)) : bench;
    return pool.length ? pool.map(({i}) => `switch ${i + 1}`) : ['pass'];
  }
  const active = request.active?.[0];
  if (!active) return ['pass'];
  const out = [];
  active.moves.forEach((m, i) => {
    if (m.disabled || m.pp === 0) return;
    out.push(`move ${i + 1}`);
    if (!gimmicks) return;
    if (active.canMegaEvo) out.push(`move ${i + 1} mega`);
    if (active.canTerastallize) out.push(`move ${i + 1} terastallize`);
    if (active.canZMove?.[i]) out.push(`move ${i + 1} zmove`);
    if (active.canDynamax) out.push(`move ${i + 1} dynamax`);
  });
  if (!out.length) out.push('move 1'); // Struggle
  if (!active.trapped && !active.maybeTrapped) for (const {i} of bench) out.push(`switch ${i + 1}`);
  return out;
}

// ---------- judging a position ----------

const STATUS_COST = {slp: 0.28, frz: 0.32, par: 0.16, brn: 0.14, psn: 0.08, tox: 0.15};

function sideValue(side) {
  let v = 0;
  for (const p of side.pokemon) {
    if (p.fainted || p.hp <= 0) continue;
    v += 0.55 + p.hp / p.maxhp;
    if (p.status) {
      let cost = STATUS_COST[p.status] || 0.1;
      if (p.status === 'brn' && p.storedStats.atk > p.storedStats.spa) cost = 0.3;
      v -= cost;
    }
  }
  // Mega, Tera, Z-Move and Dynamax are worth keeping until they matter.
  const alive = side.pokemon.filter(p => !p.fainted && p.hp > 0);
  if (alive.some(p => p.canMegaEvo)) v += 0.15;
  if (!side.zMoveUsed && alive.some(p => p.item && Dex.items.get(p.item).zMove)) v += 0.12;
  if (!side.dynamaxUsed) v += 0.1;
  if (alive.some(p => p.canTerastallize)) v += 0.12;
  const active = side.active[0];
  if (active && !active.fainted) {
    const best = active.storedStats.atk >= active.storedStats.spa ? 'atk' : 'spa';
    for (const [stat, n] of Object.entries(active.boosts)) {
      if (!n) continue;
      const weight = stat === best ? 0.09 : stat === 'spe' ? 0.07 : stat === 'def' || stat === 'spd' ? 0.04 : 0.02;
      v += weight * Math.max(-4, Math.min(4, n));
    }
    if (active.volatiles.substitute) v += 0.12;
    if (active.volatiles.leechseed) v -= 0.08;
    if (active.volatiles.confusion) v -= 0.08;
    if (active.volatiles.perishsong) v -= 0.4;
  }
  return v;
}

function hazardCost(side) {
  const alive = side.pokemon.filter(p => !p.fainted && p.hp > 0 && !p.isActive).length;
  const c = side.sideConditions;
  let cost = 0;
  if (c.stealthrock) cost += 0.06 * alive;
  if (c.spikes) cost += 0.035 * (c.spikes.layers || 1) * alive;
  if (c.toxicspikes) cost += 0.04 * alive;
  if (c.stickyweb) cost += 0.04 * alive;
  let bonus = 0;
  if (c.reflect) bonus += 0.1;
  if (c.lightscreen) bonus += 0.1;
  if (c.auroraveil) bonus += 0.15;
  if (c.tailwind) bonus += 0.1;
  return bonus - cost;
}

/** Roughly how much of the target's current HP the attacker's best move takes (0..1+). */
function threat(b, attacker, target) {
  if (!attacker || !target || attacker.fainted || target.fainted || target.hp <= 0) return 0;
  let best = 0;
  for (const slot of attacker.moveSlots) {
    if (slot.disabled || slot.pp <= 0) continue;
    const move = b.dex.getActiveMove(slot.id);
    if (move.category === 'Status') continue;
    let dmg;
    try {
      dmg = b.actions.getDamage(attacker, target, move, true);
    } catch {
      dmg = 0;
    }
    if (typeof dmg === 'number' && dmg > 0) {
      const hits = move.multihit ? (Array.isArray(move.multihit) ? 3 : move.multihit) : 1;
      best = Math.max(best, (dmg * hits) / target.hp);
    }
  }
  return Math.min(1.2, best);
}

/** The position from `me`'s side: positive is good for me. */
export function evaluate(b, me) {
  const mine = b.sides[me];
  const theirs = b.sides[1 - me];
  if (b.ended) {
    if (!b.winner) return 0;
    return b.winner === mine.name ? 100 : -100;
  }
  let v = sideValue(mine) - sideValue(theirs) + hazardCost(mine) - hazardCost(theirs);
  // Who threatens whom right now, and who moves first.
  const a = mine.active[0];
  const d = theirs.active[0];
  if (a && d && !a.fainted && !d.fainted) {
    const mineHits = threat(b, a, d);
    const theirsHit = threat(b, d, a);
    let faster = a.getStat('spe') - d.getStat('spe');
    if (b.field.pseudoWeather.trickroom) faster = -faster;
    const lead = faster > 0 ? 1 : faster < 0 ? -1 : 0;
    v += 0.45 * (mineHits * (lead >= 0 ? 1 : 0.7) - theirsHit * (lead <= 0 ? 1 : 0.7));
  }
  return v;
}

// ---------- choosing ----------

const yieldToPage = () => new Promise(r => setTimeout(r, 0));

/** Average score of one turn: my choice vs theirs, over `samples` rolls of luck. */
function playTurn(json, me, mine, theirs, samples, rng) {
  let total = 0;
  let n = 0;
  for (let k = 0; k < samples; k++) {
    const b = restore(json, rng);
    const ok1 = b.choose(SIDE_IDS[me], mine);
    const ok2 = theirs === null ? true : b.choose(SIDE_IDS[1 - me], theirs);
    if (!ok1 || !ok2) return null;
    total += evaluate(b, me);
    n++;
  }
  return total / n;
}

function softmin(values, temperature) {
  const lo = Math.min(...values);
  const w = values.map(v => Math.exp(-(v - lo) / temperature));
  const sum = w.reduce((a, x) => a + x, 0);
  return w.map(x => x / sum);
}

export class Bot {
  /**
   * @param {{side?: 0|1, level?: 'normal'|'hard'|'champion', rng?: () => number}} opts
   */
  constructor({side = 1, level = 'champion', rng = Math.random} = {}) {
    this.me = side;
    this.level = LEVELS[level] ? level : 'champion';
    this.rng = rng;
    registerFormats();
  }

  /**
   * Picks a choice string for the bot's request.
   * @param {object} json   snapshot(battle), taken before the human chose this turn
   * @param {object[]} requests  [p1 request, p2 request] from the Match
   */
  async choose(json, requests) {
    const mine = requests[this.me];
    if (!mine || mine.wait) return null;
    if (mine.teamPreview) return this.lead(json, mine);
    const myOptions = options(mine, {gimmicks: true});
    if (myOptions.length === 1) return myOptions[0];
    if (this.level === 'normal') return this.normal(json, mine, myOptions);

    const theirRequest = requests[1 - this.me];
    const theyChoose = theirRequest && !theirRequest.wait && !theirRequest.teamPreview &&
      (theirRequest.forceSwitch ? theirRequest.forceSwitch[0] : true);
    const theirOptions = theyChoose ? options(theirRequest, {gimmicks: true}) : [null];

    // The payoff table: every option of mine against every reply of theirs.
    const samples = this.level === 'champion' ? 2 : 1;
    const table = [];
    let done = 0;
    for (const a of myOptions) {
      const row = [];
      for (const d of theirOptions) {
        row.push(playTurn(json, this.me, a, d, samples, this.rng));
        if (++done % 24 === 0) await yieldToPage();
      }
      table.push(row);
    }
    const valid = table.map(row => row.map(v => (v === null ? NaN : v)));
    const columns = theirOptions.map((_, j) => valid.some(row => !Number.isNaN(row[j])));

    // What they're likely to do: replies that are bad for me are more likely.
    const theirWeights = (() => {
      const col = theirOptions.map((_, j) => {
        if (!columns[j]) return Infinity;
        const vals = valid.map(row => row[j]).filter(v => !Number.isNaN(v));
        return Math.max(...vals); // how well I can do against it
      });
      const live = col.map(v => (Number.isFinite(v) ? v : 1e9));
      const temperature = 0.08;
      return softmin(live, temperature).map((w, j) => (columns[j] ? w : 0));
    })();

    const score = row => {
      let expected = 0;
      let worst = Infinity;
      let weight = 0;
      row.forEach((v, j) => {
        if (Number.isNaN(v) || !columns[j]) return;
        expected += v * theirWeights[j];
        weight += theirWeights[j];
        worst = Math.min(worst, v);
      });
      if (!weight) return -Infinity;
      expected /= weight;
      // Mostly "what if they answer well": a careful player beats a hopeful one.
      return 0.3 * expected + 0.7 * worst;
    };
    let ranked = myOptions.map((a, i) => ({a, i, s: score(valid[i])})).filter(x => Number.isFinite(x.s));
    ranked.sort((x, y) => y.s - x.s);
    if (!ranked.length) return myOptions[0];

    if (this.level === 'champion' && ranked.length > 1) {
      // Re-check the best few against every reply, with more rolls of luck.
      const top = ranked.slice(0, 3);
      for (const t of top) {
        const row = valid[t.i].map((v, j) => {
          if (Number.isNaN(v) || !columns[j]) return v;
          const more = playTurn(json, this.me, t.a, theirOptions[j], 3, this.rng);
          return more === null ? v : (v * samples + more * 3) / (samples + 3);
        });
        t.s = score(row);
        await yieldToPage();
      }
      top.sort((x, y) => y.s - x.s);
      ranked = top;
    }
    // Hard has the occasional off moment: now and then it plays its second choice.
    if (this.level === 'hard' && ranked.length > 1 && this.rng() < 0.2) return ranked[1].a;
    // Don't be perfectly predictable between near-equal options.
    const close = ranked.filter(x => x.s >= ranked[0].s - 0.03);
    return close[Math.floor(this.rng() * close.length)].a;
  }

  /** Normal: hit hard, sometimes pick something else, switch only when forced. */
  normal(json, request, opts) {
    if (request.forceSwitch) return opts[Math.floor(this.rng() * opts.length)];
    const plain = opts.filter(o => o.startsWith('move') && o.split(' ').length === 2);
    if (this.rng() < 0.25) return plain[Math.floor(this.rng() * plain.length)] || opts[0];
    const b = restore(json, this.rng);
    const me = b.sides[this.me].active[0];
    const foe = b.sides[1 - this.me].active[0];
    let best = plain[0];
    let bestDmg = -1;
    for (const o of plain) {
      const slot = me.moveSlots[Number(o.split(' ')[1]) - 1];
      const move = b.dex.getActiveMove(slot.id);
      let dmg = move.category === 'Status' ? 0.15 * foe.maxhp * this.rng() : 0;
      try {
        if (move.category !== 'Status') dmg = Number(b.actions.getDamage(me, foe, move, true)) || 0;
      } catch {
        dmg = 0;
      }
      if (dmg > bestDmg) {
        bestDmg = dmg;
        best = o;
      }
    }
    // Uses its gimmick the first chance it gets.
    const fancy = opts.find(o => o.startsWith(`${best} `));
    return fancy && this.rng() < 0.7 ? fancy : best;
  }

  /** Team preview: lead with the Pokémon that fares best against their whole team. */
  lead(json, request) {
    const n = request.side.pokemon.length;
    const order = Array.from({length: n}, (_, i) => i);
    if (this.level === 'normal') return `team ${order.map(i => i + 1).join('')}`;
    let b;
    try {
      b = restore(json, this.rng);
    } catch {
      return `team ${order.map(i => i + 1).join('')}`;
    }
    const mine = b.sides[this.me].pokemon;
    const theirs = b.sides[1 - this.me].pokemon;
    const scores = mine.map(p => {
      let s = 0;
      for (const q of theirs) {
        const hit = threat(b, p, q);
        const hurt = threat(b, q, p);
        const faster = p.getStat('spe') > q.getStat('spe');
        s += hit * (faster ? 1 : 0.7) - hurt * (faster ? 0.7 : 1);
      }
      return s + this.rng() * 0.3;
    });
    order.sort((x, y) => scores[y] - scores[x]);
    // Keep the rest in team order after the lead.
    const lead = order[0];
    const rest = Array.from({length: n}, (_, i) => i).filter(i => i !== lead);
    return `team ${[lead, ...rest].map(i => i + 1).join('')}`;
  }
}

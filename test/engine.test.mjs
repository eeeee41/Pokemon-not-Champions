// Engine tests: stats, learnsets, teams, and many full random battles in both
// modes, checked from both players' perspectives.
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {PRNG} from '@pkmn/sim';
import {calcStats, dex} from '../src/engine/dex.js';
import {canLearn, learnableMoveIds} from '../src/engine/learnsets.js';
import {sampleTeams} from '../src/engine/samples.js';
import {validateTeam, importTeams, exportTeam, newMon, toSimSet} from '../src/engine/team.js';
import {Match} from '../src/engine/match.js';
import {randomChoice} from '../src/engine/choices.js';
import {Tracker} from '../src/client/tracker.js';

test('Champions stat formula', () => {
  // Garchomp 108/130/95/80/85/102, Jolly, 2 HP / 32 Atk / 32 Spe
  assert.deepEqual(calcStats('Garchomp', {hp: 2, atk: 32, spe: 32}, 'Jolly'),
    {hp: 185, atk: 182, def: 115, spa: 90, spd: 105, spe: 169});
  assert.equal(calcStats('Shedinja', {hp: 32}, 'Hardy').hp, 1);
});

test('battle uses the same stats as the team builder', () => {
  const [team] = sampleTeams();
  const match = new Match({mode: 'singles', seed: [1, 2, 3, 4], players: [
    {name: 'A', team}, {name: 'B', team},
  ]});
  for (const [i, mon] of team.mons.entries()) {
    const p = match.battle.sides[0].pokemon[i];
    const want = calcStats(mon.species, mon.sp, mon.nature);
    assert.equal(p.maxhp, want.hp, `${mon.species} HP`);
    for (const stat of ['atk', 'def', 'spa', 'spd', 'spe']) assert.equal(p.storedStats[stat], want[stat], `${mon.species} ${stat}`);
  }
});

test('learnsets', () => {
  assert.ok(canLearn('Garchomp', 'Earthquake'));
  assert.ok(canLearn('Charizard', 'Solar Beam'));
  assert.ok(canLearn('Pikachu', 'Volt Tackle'), 'egg move via evolution line');
  assert.ok(canLearn('Raichu', 'Volt Tackle'), 'pre-evolution egg move');
  assert.ok(canLearn('Rotom-Wash', 'Hydro Pump'), 'forme move');
  assert.ok(canLearn('Rotom-Wash', 'Volt Switch'), 'base forme move');
  assert.ok(!canLearn('Garchomp', 'Spore'));
  assert.ok(learnableMoveIds('Smeargle').length > 700, 'Sketch');
});

test('sample teams are legal and survive export/import', () => {
  for (const team of sampleTeams()) {
    const result = validateTeam(team);
    assert.ok(result.ok, `${team.name}: ${result.problems.map(p => p.text).join('; ')}`);
    const again = importTeams(exportTeam(team))[0];
    assert.deepEqual(again.mons, team.mons);
  }
});

test('validation catches Champions rule breaks', () => {
  const team = sampleTeams()[0];
  team.mons[0].sp = {hp: 33, atk: 32, def: 10, spa: 0, spd: 0, spe: 0};
  team.mons[1].moves = ['Flamethrower', 'Spore', '', ''];
  team.mons[2].item = team.mons[3].item;
  const {ok, problems} = validateTeam(team);
  assert.ok(!ok);
  const text = problems.map(p => p.text).join('\n');
  assert.match(text, /from 0 to 32/);
  assert.match(text, /75 stat points; the limit is 66/);
  assert.match(text, /can't learn Spore/);
  assert.match(text, /Item Clause/);
});

test('importing Showdown EVs converts to stat points', () => {
  const [team] = importTeams(`Garchomp @ Life Orb
Ability: Rough Skin
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Earthquake`);
  assert.deepEqual(team.mons[0].sp, {hp: 1, atk: 32, def: 0, spa: 0, spd: 0, spe: 32});
});

test('battle-only formes in a paste become their base forme', () => {
  const [team] = importTeams('Charizard-Mega-Y @ Charizardite Y\nAbility: Blaze\n- Flamethrower');
  assert.equal(team.mons[0].species, 'Charizard');
});

test('Gigantamax sets reach the simulator', () => {
  const mon = newMon('Charizard');
  mon.gmax = true;
  assert.equal(toSimSet(mon).gigantamax, true);
  const mon2 = newMon('Garchomp');
  mon2.gmax = true;
  assert.equal(toSimSet(mon2).gigantamax, false);
});

function playOut(mode, seedNum, teams, {trackers = true} = {}) {
  const rng = (() => {
    let s = seedNum * 7919 + 13;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  const match = new Match({mode, seed: [seedNum, seedNum + 1, seedNum + 2, seedNum + 3], players: [
    {name: 'Ace', team: teams[0]}, {name: 'Rival', team: teams[1]},
  ]});
  const t = trackers ? [new Tracker('p1'), new Tracker('p2')] : null;
  const seen = {mega: 0, zmove: 0, dynamax: 0, gmax: 0, tera: 0};
  let guard = 0;
  while (!match.ended && guard++ < 600) {
    let progressed = false;
    for (const i of [0, 1]) {
      if (!match.needsChoice(i)) continue;
      const choice = randomChoice(match.requests[i], rng);
      const ok = match.choose(i, choice);
      assert.ok(ok, `invalid choice "${choice}" (${match.errors[i]}) turn ${match.battle.turn}`);
      progressed = true;
    }
    if (!progressed) assert.fail(`stuck at turn ${match.battle.turn}`);
  }
  if (t) {
    for (const [i, side] of ['p1', 'p2'].entries()) {
      for (const line of match.views[side]) t[i].step(line);
      if (!match.ended) t[i].setRequest(match.requests[i]);
    }
  }
  for (const line of match.raw) {
    if (line.startsWith('|-mega|')) seen.mega++;
    if (line.startsWith('|-zpower|')) seen.zmove++;
    if (/^\|-start\|[^|]+\|Dynamax/.test(line)) seen.dynamax++;
    if (/^\|-start\|[^|]+\|Dynamax\|Gmax/.test(line)) seen.gmax++;
    if (line.startsWith('|-terastallize|')) seen.tera++;
  }
  return {match, seen, trackers: t};
}

test('random battles finish in both modes, with every gimmick', () => {
  const teams = sampleTeams();
  const totals = {mega: 0, zmove: 0, dynamax: 0, gmax: 0, tera: 0};
  let finished = 0;
  for (const mode of ['singles', 'doubles']) {
    for (let n = 1; n <= 30; n++) {
      const a = teams[n % 3];
      const b = teams[(n + 1) % 3];
      const {match, seen} = playOut(mode, n, [a, b], {trackers: n <= 6});
      if (match.ended) finished++;
      for (const k in totals) totals[k] += seen[k];
    }
  }
  assert.equal(finished, 60);
  for (const k in totals) assert.ok(totals[k] > 0, `never saw ${k}`);
});

test('clients tracking the battle agree with the simulator', () => {
  const teams = sampleTeams();
  const {match, trackers} = playOut('doubles', 99, [teams[1], teams[0]]);
  for (const [i, tr] of trackers.entries()) {
    const simSide = match.battle.sides[i];
    const mine = tr.battle.sides[i];
    // Every Pokémon that entered battle has exactly the right HP from its own trainer's view.
    const entered = mine.team.filter(x => x.originalIdent);
    assert.ok(entered.length >= 2, `${simSide.id} saw too few Pokémon`);
    for (const seen of entered) {
      const p = simSide.pokemon.find(x => x.name === seen.name);
      assert.ok(p, `${seen.name} not on ${simSide.id}'s team`);
      assert.equal(seen.hp, p.hp, `${p.name} HP`);
      assert.equal(seen.fainted, p.fainted, `${p.name} fainted`);
    }
  }
});

test('two copies of a match given the same choices stay in lockstep', () => {
  const teams = sampleTeams();
  const seed = PRNG.generateSeed();
  const players = [{name: 'Ace', team: teams[0]}, {name: 'Rival', team: teams[2]}];
  const a = new Match({mode: 'doubles', seed, players});
  const b = new Match({mode: 'doubles', seed, players});
  const rng = (() => {
    let s = 42;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  let guard = 0;
  while (!a.ended && guard++ < 600) {
    for (const i of [0, 1]) {
      if (!a.needsChoice(i)) continue;
      assert.ok(b.needsChoice(i));
      const choice = randomChoice(a.requests[i], rng);
      assert.ok(a.choose(i, choice));
      assert.ok(b.choose(i, choice));
    }
  }
  const strip = lines => lines.filter(l => !l.startsWith('|t:|'));
  assert.deepEqual(strip(b.raw), strip(a.raw));
  assert.ok(b.ended);
});

test("each player sees only percentages for the opponent's HP", () => {
  const teams = sampleTeams();
  const {match} = playOut('singles', 7, [teams[0], teams[1]], {trackers: false});
  for (const [mine, theirs] of [['p1', 'p2'], ['p2', 'p1']]) {
    for (const line of match.views[mine]) {
      const m = line.match(new RegExp(`^\\|(?:switch|drag|-damage|-heal)\\|${theirs}[ab]?: [^|]*\\|[^|]*?\\|?(\\d+)/(\\d+)`));
      if (m) assert.equal(m[2], '100', line);
    }
  }
});

test('every Mega Stone (and Mega Rayquaza) Mega Evolves in battle', async () => {
  const {megaOptions, selectableSpecies} = await import('../src/engine/dex.js');
  const filler = ['Pikachu', 'Eevee', 'Snorlax', 'Lapras', 'Ditto'].map(s => {
    const m = newMon(s);
    m.moves = [s === 'Ditto' ? 'Transform' : s === 'Pikachu' ? 'Thunder Shock' : 'Tackle', '', '', ''];
    return m;
  });
  let checked = 0;
  for (const s of selectableSpecies()) {
    for (const o of megaOptions(s.name)) {
      const mon = newMon(s.name);
      mon.item = o.item || '';
      mon.moves = [o.move || 'Protect', 'Protect', '', ''].filter((m, i, a) => a.indexOf(m) === i).concat(['', '']).slice(0, 4);
      const match = new Match({mode: 'singles', seed: [1, 2, 3, 4], players: [
        {name: 'A', team: {mons: [mon, ...filler]}}, {name: 'B', team: {mons: [...filler, filler[0]]}},
      ]});
      match.choose(0, 'team 123456');
      match.choose(1, 'team 123456');
      assert.ok(match.requests[0].active[0].canMegaEvo, `${s.name} with ${o.item || o.move}: no Mega option`);
      assert.ok(match.choose(0, `move ${o.move ? 1 : 1} mega`));
      match.choose(1, 'move 1');
      assert.equal(match.battle.sides[0].active[0].species.name, o.mega, `${s.name} → ${o.mega}`);
      checked++;
    }
  }
  assert.ok(checked >= 95, `only ${checked} Megas checked`);
});

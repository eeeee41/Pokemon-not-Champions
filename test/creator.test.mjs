// The creator's secret Pokémon, MissingNo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {dex} from '../src/engine/dex.js';
import {importTeams, validateTeam} from '../src/engine/team.js';
import {encodeTeam, decodeTeam} from '../src/engine/savecode.js';
import {Match} from '../src/engine/match.js';
import {sampleTeams} from '../src/engine/samples.js';
import {canLearn, learnableMoveIds} from '../src/engine/learnsets.js';
import {tryCreatorCode, creatorUnlocked, isCreatorSpecies} from '../src/engine/creator.js';
import fs from 'node:fs';

const SET = `MissingNo. @ MissingNite
Ability: Infinity
Tera Type: Stellar
Gigantamax: Yes
SPs: 32 HP / 32 Atk / 32 Def / 32 SpA / 32 SpD / 32 Spe
Adamant Nature
- V-create
- Spore
- Shell Smash
- Extreme Speed`;

function teamWithMissingNo() {
  const team = sampleTeams()[0];
  team.mons[0] = importTeams(SET)[0].mons[0];
  return team;
}

function start() {
  const m = new Match({mode: 'singles', seed: '1,2,3,4', players: [{name: 'Me', team: teamWithMissingNo()}, {name: 'Foe', team: sampleTeams()[2]}]});
  m.choose(0, 'team 123456');
  m.choose(1, 'team 123456');
  return m;
}

test('the secret phrase unlocks it; other text does not', async () => {
  const store = new Map();
  globalThis.localStorage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v))};
  try {
    assert.equal(creatorUnlocked(), false);
    assert.equal(await tryCreatorCode('MissingNo'), false);
    assert.equal(await tryCreatorCode('[secret phrase]'), false);
    assert.equal(await tryCreatorCode('[secret phrase]'), false);
    assert.equal(creatorUnlocked(), false);
    assert.equal(await tryCreatorCode('  [secret phrase]'), true);
    assert.equal(creatorUnlocked(), true);
    store.clear();
    assert.equal(await tryCreatorCode('[secret phrase]'), true);
    store.clear();
    assert.equal(await tryCreatorCode('[secret phrase]'), true);
  } finally {
    delete globalThis.localStorage;
  }
});

test('every type, huge stats, any move, and a legal team', () => {
  const s = dex.species.get('MissingNo.');
  assert.equal(s.types.length, 18);
  assert.ok(Object.values(s.baseStats).every(v => v === 255));
  assert.ok(Object.values(dex.species.get('MissingNo.-Mega').baseStats).every(v => v === 300));
  assert.equal(s.canGigantamax, 'G-Max Glitch');
  assert.ok(isCreatorSpecies('MissingNo.-Mega') && !isCreatorSpecies('Mew'));
  assert.ok(learnableMoveIds('MissingNo.').length > 800);
  assert.ok(canLearn('MissingNo.', 'Spore') && canLearn('MissingNo.', 'V-create'));
  const team = teamWithMissingNo();
  const v = validateTeam(team);
  assert.ok(v.ok, v.problems.map(p => p.text).join('; '));
  const back = decodeTeam(encodeTeam(team)).mons[0];
  assert.equal(back.species, 'MissingNo.');
  assert.equal(back.item, 'MissingNite');
  assert.ok(back.gmax);
  assert.deepEqual(Object.values(back.sp), [32, 32, 32, 32, 32, 32]);
});

test('its type chart: weak to Rock, immune to seven types, nothing else above neutral', () => {
  const m = start();
  const mn = m.battle.p1.active[0];
  const moves = {Rock: 'Stone Edge', Normal: 'Body Slam', Fighting: 'Close Combat', Electric: 'Thunderbolt', Ground: 'Earthquake',
    Poison: 'Sludge Bomb', Psychic: 'Psychic', Ghost: 'Shadow Ball', Dragon: 'Dragon Claw', Fire: 'Flamethrower', Water: 'Surf',
    Grass: 'Energy Ball', Ice: 'Ice Beam', Flying: 'Brave Bird', Bug: 'X-Scissor', Dark: 'Crunch', Steel: 'Iron Head', Fairy: 'Moonblast'};
  const immune = ['Normal', 'Fighting', 'Electric', 'Ground', 'Poison', 'Psychic', 'Ghost'];
  for (const [type, name] of Object.entries(moves)) {
    const move = m.battle.dex.getActiveMove(dex.moves.get(name).id);
    const hits = mn.runImmunity(move);
    const mult = 2 ** mn.runEffectiveness(move);
    if (immune.includes(type)) assert.equal(hits, false, type);
    else if (type === 'Rock') assert.ok(hits && mult === 2, type);
    else assert.ok(hits && mult <= 1, `${type}: ${mult}`);
  }
});

test('it can Mega Evolve and then Gigantamax in the same battle', () => {
  const m = start();
  assert.ok(m.requests[0].active[0].canMegaEvo);
  m.choose(0, 'move 4 mega');
  m.choose(1, 'move 1');
  if (m.requests[1].forceSwitch) m.choose(1, 'switch 2');
  const mn = m.battle.p1.active[0];
  assert.equal(mn.species.name, 'MissingNo.-Mega');
  assert.equal(mn.ability, 'limitless');
  const req = m.requests[0].active?.[0];
  assert.ok(req?.canDynamax, 'can still Dynamax');
  assert.equal(req.maxMoves.gigantamax, 'G-Max Glitch');
  m.choose(0, 'move 4 max'); // Extreme Speed is Normal-type, so it becomes G-Max Glitch
  m.choose(1, 'move 1');
  assert.ok(m.battle.log.some(l => l.includes('G-Max Glitch')));
  assert.ok(mn.volatiles.dynamax);
});

test('it has its own sprites', () => {
  const sprites = JSON.parse(fs.readFileSync(new URL('../src/generated/creator-sprites.json', import.meta.url)));
  assert.ok(fs.existsSync(new URL(`../public/assets/${sprites.file}`, import.meta.url)));
  for (const sheet of ['front', 'back', 'front-shiny', 'back-shiny']) {
    for (const id of ['missingno', 'missingnomega', 'missingnogmax']) assert.equal(sprites.sheets[sheet][id]?.length, 4, `${sheet} ${id}`);
  }
  assert.notDeepEqual(sprites.sheets.front.missingno, sprites.sheets.front.missingnomega);
});

test('a team may have any number of MissingNo., but still only one of anything else', () => {
  const mn = importTeams(SET)[0].mons[0];
  const six = {name: 'All MissingNo.', mons: Array.from({length: 6}, () => structuredClone(mn))};
  const v = validateTeam(six);
  assert.ok(v.ok, v.problems.map(p => p.text).join('; '));

  const twoOthers = sampleTeams()[0];
  twoOthers.mons[0] = mn;
  twoOthers.mons[2] = structuredClone(twoOthers.mons[1]);
  const texts = validateTeam(twoOthers).problems.map(p => p.text);
  assert.ok(texts.some(t => t.startsWith('Species Clause')), texts.join('; '));
  assert.ok(texts.some(t => t.startsWith('Item Clause')), texts.join('; '));

  const m = new Match({mode: 'singles', seed: '1,2,3,4', players: [{name: 'Me', team: six}, {name: 'Foe', team: sampleTeams()[2]}]});
  const names = m.battle.p1.pokemon.map(p => p.name);
  assert.equal(new Set(names).size, 6, names.join(', '));
  assert.deepEqual(names.slice(0, 3), ['MissingNo.', 'MissingNo. 2', 'MissingNo. 3']);
  m.choose(0, 'team 123456');
  m.choose(1, 'team 123456');
  m.choose(0, 'switch 3');
  m.choose(1, 'move 1');
  assert.equal(m.battle.p1.active[0].name, 'MissingNo. 3');
});

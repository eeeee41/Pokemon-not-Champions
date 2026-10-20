// The creator's secret Pokémon, MissingNo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {dex} from '../src/engine/dex.js';
import {importTeams, validateTeam} from '../src/engine/team.js';
import {encodeTeam, decodeTeam} from '../src/engine/savecode.js';
import {Match} from '../src/engine/match.js';
import {sampleTeams} from '../src/engine/samples.js';
import {canLearn, learnableMoveIds} from '../src/engine/learnsets.js';
import {tryCreatorCode, creatorUnlocked, isCreatorSpecies, lockCreator, sha256, tryUnlock, glitchedPowerUnlocked} from '../src/engine/creator.js';
import crypto from 'node:crypto';
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

const PHRASE = '[secret phrase]';

function fakeStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k),
  };
  return store;
}

test('the built-in SHA-256 matches the standard one', () => {
  for (const text of ['', 'abc', 'x'.repeat(55), 'y'.repeat(64), 'é ✓ 🎮'.repeat(30)]) {
    assert.equal(sha256(text), crypto.createHash('sha256').update(text).digest('hex'));
  }
});

test('the secret phrase unlocks it; other text and hand-edited saves do not', async () => {
  const store = fakeStorage();
  lockCreator();
  try {
    assert.equal(creatorUnlocked(), false);
    assert.equal(await tryCreatorCode('MissingNo'), false);
    assert.equal(await tryCreatorCode('[secret phrase]'), false);
    assert.equal(await tryCreatorCode('[secret phrase]'), false);
    assert.equal(creatorUnlocked(), false);
    // Faking the saved unlock doesn't work.
    for (const fake of ['1', 'true', '0b8cdf286e6529a5e2d7a92fc0ef8fdc39e399f154b848d94a52c4c43aab0651',
      '6ea042fe204b1d008f75be6077d66c5dad29a7b2ef34252a08b060109c65515f']) {
      store.set('champions-pvp.creator.v2', fake);
      store.set('champions-pvp.creator.v1', '1');
      assert.equal(creatorUnlocked(), false, fake);
    }
    store.clear();
    assert.equal(await tryCreatorCode('  [secret phrase]'), true);
    assert.equal(creatorUnlocked(), true);
    // It is remembered: a fresh visit with the saved token is still unlocked.
    lockCreator();
    assert.equal(creatorUnlocked(), true);
    for (const phrase of ['[secret phrase]', '[secret phrase]']) {
      store.clear();
      lockCreator();
      assert.equal(await tryCreatorCode(phrase), true, phrase);
    }
  } finally {
    lockCreator();
    delete globalThis.localStorage;
  }
});

test('while locked, teams with MissingNo. are not usable (opponents\' teams still are)', () => {
  lockCreator();
  const team = teamWithMissingNo();
  const v = validateTeam(team);
  assert.equal(v.ok, false);
  assert.deepEqual(v.problems.map(p => [p.index, p.text]), [[0, 'This Pokémon is locked.']]);
  assert.ok(validateTeam(team, {creator: true}).ok);
  assert.ok(validateTeam(sampleTeams()[0]).ok);
});

test('unlock for the rest of these tests', async () => {
  fakeStorage();
  assert.equal(await tryCreatorCode(PHRASE), true);
  delete globalThis.localStorage; // the unlock lasts for this visit
  assert.equal(creatorUnlocked(), true);
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

const GLITCH_PHRASE = '[secret phrase]';

test('Glitched Power: its own phrase, only MissingNo. learns it, and it is locked until then', async () => {
  const store = fakeStorage();
  lockCreator();
  try {
    assert.ok(canLearn('MissingNo.', 'Glitched Power'));
    assert.ok(!canLearn('Smeargle', 'Glitched Power') && !canLearn('Mew', 'Glitched Power'));
    const team = teamWithMissingNo();
    team.mons[0].moves[0] = 'Glitched Power';
    assert.equal(await tryUnlock(PHRASE), 'missingno');
    assert.equal(glitchedPowerUnlocked(), false);
    assert.deepEqual(validateTeam(team).problems.map(p => p.text), ['Glitched Power is locked.']);
    assert.ok(validateTeam(team, {creator: true}).ok, 'an opponent\'s team is still accepted');
    // The MissingNo. phrase doesn't unlock it, and neither does a faked save.
    store.set('champions-pvp.glitch.v1', '68a0e9fdf450ca3bfae44b363f4fa68b0079bcc1aa824f11e3cade8fab2ac036');
    assert.equal(glitchedPowerUnlocked(), false);
    assert.equal(await tryUnlock('[secret phrase]'), null);
    assert.equal(await tryUnlock('[secret phrase]'), 'glitchedpower');
    assert.equal(glitchedPowerUnlocked(), true);
    lockCreator();
    assert.equal(glitchedPowerUnlocked(), true, 'remembered in this browser');
    assert.ok(validateTeam(team).ok);
  } finally {
    lockCreator();
    delete globalThis.localStorage;
  }
  // Leave both unlocked for the battle test below.
  assert.equal(await tryUnlock(PHRASE), 'missingno');
  assert.equal(await tryUnlock(GLITCH_PHRASE), 'glitchedpower');
});

test('Glitched Power raises every stat, accuracy and evasion by 6, and has 1 PP', () => {
  const team = teamWithMissingNo();
  team.mons[0].moves[1] = 'Glitched Power';
  const m = new Match({mode: 'singles', seed: '1,2,3,4', players: [{name: 'Me', team}, {name: 'Foe', team: sampleTeams()[2]}]});
  m.choose(0, 'team 123456');
  m.choose(1, 'team 123456');
  const req = m.requests[0].active[0];
  const slot = req.moves.find(x => x.id === 'glitchedpower');
  assert.equal(slot.pp, 1);
  assert.equal(slot.maxpp, 1);
  m.choose(0, 'move 2');
  m.choose(1, 'move 1');
  const mn = m.battle.p1.active[0];
  assert.deepEqual(mn.boosts, {atk: 6, def: 6, spa: 6, spd: 6, spe: 6, accuracy: 6, evasion: 6});
  assert.ok(m.requests[0].active[0].moves.find(x => x.id === 'glitchedpower').disabled, 'out of PP');
});

test('every move MissingNo. knows fits in a save code and comes back', () => {
  const ids = learnableMoveIds('MissingNo.');
  assert.ok(ids.includes('glitchedpower'));
  const base = importTeams(SET)[0].mons[0];
  for (let i = 0; i < ids.length; i += 24) {
    const chunk = ids.slice(i, i + 24).map(id => dex.moves.get(id).name);
    const mons = Array.from({length: 6}, (_, k) => ({...structuredClone(base), moves: [0, 1, 2, 3].map(j => chunk[k * 4 + j] || '')}));
    const team = {name: 'Moves', mons};
    const back = decodeTeam(encodeTeam(team));
    assert.deepEqual(back.mons.map(m => m.moves), mons.map(m => m.moves), `moves ${i}–${i + 23}`);
  }
});

test('beating every rival on Champion unlocks MissingNo. (but not Glitched Power); faked wins do not', async () => {
  const {RIVALS, beatEveryRival} = await import('../src/engine/rivals.js');
  const {recordChampionWin, championWins, resetChampionWins} = await import('../src/engine/creator.js');
  const all = Object.fromEntries(RIVALS.map(r => [r.id, ['normal', 'champion']]));
  assert.equal(beatEveryRival(all), true);
  assert.equal(beatEveryRival({...all, [RIVALS[5].id]: ['hard']}), false);

  const store = fakeStorage();
  lockCreator();
  try {
    assert.equal(creatorUnlocked(), false);
    // Faked saves: wins in the settings, a made-up win list, the old flag.
    store.set('champions-pvp.settings.v1', JSON.stringify({rivalWins: all}));
    store.set('champions-pvp.rivalwins.v1', JSON.stringify(Object.fromEntries(RIVALS.map(r => [r.id, 'x'.repeat(64)]))));
    store.set('champions-pvp.creator.rivals.v1', 'beat every rival on champion');
    assert.equal(creatorUnlocked(), false);
    assert.deepEqual(championWins(), []);
    resetChampionWins();
    for (const r of RIVALS.slice(0, -1)) recordChampionWin(r.id);
    recordChampionWin('not-a-rival');
    assert.equal(championWins().length, RIVALS.length - 1);
    assert.equal(creatorUnlocked(), false);
    recordChampionWin(RIVALS.at(-1).id);
    assert.equal(creatorUnlocked(), true);
    lockCreator();
    assert.equal(creatorUnlocked(), true, 'remembered in this browser');
    assert.ok(validateTeam(teamWithMissingNo()).ok);
    assert.equal(glitchedPowerUnlocked(), false);
    // Copying the wins to another browser (a different device id) doesn't carry them over.
    const wins = store.get('champions-pvp.rivalwins.v1');
    store.clear();
    store.set('champions-pvp.rivalwins.v1', wins);
    assert.equal(creatorUnlocked(), false);
  } finally {
    lockCreator();
    delete globalThis.localStorage;
  }
});

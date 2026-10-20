// Megatron, the second secret Pokémon, and the hunt for his parts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dex} from '../src/engine/dex.js';
import {importTeams, validateTeam} from '../src/engine/team.js';
import {encodeTeam, decodeTeam} from '../src/engine/savecode.js';
import {Match} from '../src/engine/match.js';
import {sampleTeams} from '../src/engine/samples.js';
import {canLearn, learnableMoveIds} from '../src/engine/learnsets.js';
import {PARTS, collectPart, collectedParts, megatronUnlocked, resetParts, onPartsChange} from '../src/engine/megatron.js';

const SET = `Megatron @ Sitrus Berry
Ability: Decepticon Leader
Tera Type: Dark
SPs: 32 HP / 32 SpA / 2 Spe
Modest Nature
- Fusion Cannon
- Peace Through Tyranny
- Dark Pulse
- King's Shield`;

function team() {
  const t = sampleTeams()[0];
  t.mons[0] = importTeams(SET)[0].mons[0];
  return t;
}

function start(t = team()) {
  const m = new Match({mode: 'singles', seed: '1,2,3,4', players: [{name: 'Me', team: t}, {name: 'Foe', team: sampleTeams()[2]}]});
  m.choose(0, 'team 123456');
  m.choose(1, 'team 123456');
  return m;
}

test('Megatron: #-1, Steel/Dark, the base stats behind those max stats', () => {
  const s = dex.species.get('Megatron');
  assert.ok(s.exists);
  assert.equal(s.num, -1);
  assert.deepEqual(s.types, ['Steel', 'Dark']);
  assert.deepEqual(s.baseStats, {hp: 106, atk: 135, def: 110, spa: 125, spd: 90, spe: 60});
  // Level-100 max stats (31 IVs, 252 EVs, helpful nature): 416 / 405 / 350 / 383 / 306 / 240.
  const max = (b, hp) => (hp ? 2 * b + 31 + 63 + 110 : Math.floor((2 * b + 31 + 63 + 5) * 1.1));
  assert.deepEqual(Object.entries(s.baseStats).map(([k, b]) => max(b, k === 'hp')), [416, 405, 350, 383, 306, 240]);
  assert.equal(s.abilities[0], 'Decepticon Leader');
});

test('he learns exactly his eleven moves, and his two signatures are his alone', () => {
  assert.deepEqual(learnableMoveIds('Megatron'), ['darkpulse', 'flashcannon', 'fusioncannon', 'heavyslam', 'hyperbeam',
    'ironhead', 'kingsshield', 'nastyplot', 'nightslash', 'peacethroughtyranny', 'taunt']);
  for (const other of ['MissingNo.', 'Smeargle', 'Aegislash']) {
    assert.ok(!canLearn(other, 'Fusion Cannon') && !canLearn(other, 'Peace Through Tyranny'), other);
  }
  const fc = dex.moves.get('Fusion Cannon');
  assert.equal(fc.type, 'Steel');
  assert.equal(fc.category, 'Special');
  assert.equal(fc.basePower, 130);
});

test('locked until all six parts are found, one per page', () => {
  resetParts();
  assert.equal(new Set(PARTS.map(p => p.page)).size, 6);
  assert.equal(megatronUnlocked(), false);
  assert.deepEqual(validateTeam(team()).problems.map(p => p.text), ['This Pokémon is locked.']);
  assert.ok(validateTeam(team(), {creator: true}).ok, 'an opponent\'s team is still accepted');
  const seen = [];
  const stop = onPartsChange(n => seen.push(n));
  for (const p of PARTS.slice(0, 5)) collectPart(p.id);
  collectPart(PARTS[0].id); // collecting twice counts once
  assert.equal(collectedParts().length, 5);
  assert.equal(megatronUnlocked(), false);
  collectPart(PARTS[5].id);
  stop();
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 5, 6]);
  assert.equal(megatronUnlocked(), true);
  assert.ok(validateTeam(team()).ok, validateTeam(team()).problems.map(p => p.text).join('; '));
});

test('his moves work as described, and his team survives a save code', () => {
  const back = decodeTeam(encodeTeam(team())).mons[0];
  assert.equal(back.species, 'Megatron');
  assert.deepEqual(back.moves, ['Fusion Cannon', 'Peace Through Tyranny', 'Dark Pulse', "King's Shield"]);
  const m = start();
  m.choose(0, 'move 2');
  m.choose(1, 'move 1');
  const log = () => m.battle.log.join('\n');
  for (const line of ['-boost|p1a: Megatron|atk|2', '-boost|p1a: Megatron|spa|2', '-unboost|p1a: Megatron|def|1', '-unboost|p1a: Megatron|spd|1']) {
    assert.ok(log().includes(line), line);
  }
  m.choose(0, 'move 1');
  m.choose(1, 'move 1');
  const after = log().split('|move|p1a: Megatron|Fusion Cannon')[1];
  assert.ok(after?.includes('-unboost|p1a: Megatron|spa|2'), 'Fusion Cannon lowers Sp. Atk by 2');
});

test('Decepticon Leader: 1.5x Dark and Steel moves at half HP or less', () => {
  const m = start();
  const mt = m.battle.p1.active[0];
  const foe = m.battle.p2.active[0];
  const boost = (name, stat) => {
    const move = m.battle.dex.getActiveMove(dex.moves.get(name).id);
    return m.battle.runEvent(stat, mt, foe, move, 1000);
  };
  const cases = [['Dark Pulse', 'ModifySpA'], ['Flash Cannon', 'ModifySpA'], ['Night Slash', 'ModifyAtk'], ['Iron Head', 'ModifyAtk'], ['Hyper Beam', 'ModifySpA']];
  assert.deepEqual(cases.map(([n, s]) => boost(n, s)), [1000, 1000, 1000, 1000, 1000], 'no boost at full HP');
  mt.hp = Math.floor(mt.maxhp / 2);
  assert.deepEqual(cases.map(([n, s]) => boost(n, s)), [1500, 1500, 1500, 1500, 1000], 'Dark and Steel only');
});

test('his sprites and the six part icons exist', () => {
  const sprites = JSON.parse(fs.readFileSync(new URL('../src/generated/megatron-sprites.json', import.meta.url)));
  assert.ok(fs.existsSync(new URL(`../public/assets/${sprites.file}`, import.meta.url)));
  for (const sheet of ['front', 'back', 'front-shiny', 'back-shiny']) assert.equal(sprites.sheets[sheet].megatron.length, 4);
  for (const p of PARTS) assert.equal(sprites.parts[p.id]?.length, 4, p.id);
});

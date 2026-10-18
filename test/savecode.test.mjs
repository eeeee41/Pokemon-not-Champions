import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeTeam, decodeTeam, findSaveCodes, SaveCodeError} from '../src/engine/savecode.js';
import {sampleTeams} from '../src/engine/samples.js';
import {newMon, newTeam} from '../src/engine/team.js';

const strip = t => ({name: t.name, mons: t.mons});

test('save codes round-trip every starter team exactly', () => {
  for (const team of sampleTeams()) {
    const code = encodeTeam(team);
    assert.match(code, /^CPV1\.[A-Za-z0-9_-]+$/);
    assert.ok(code.length < 260, `code is ${code.length} characters`);
    assert.deepEqual(strip(decodeTeam(code)), strip(team));
  }
});

test('nicknames, shiny, gender, Gigantamax and empty move slots survive', () => {
  const team = newTeam('Ace’s team ★');
  const a = newMon('Charizard');
  Object.assign(a, {nickname: 'Blaze Kid', shiny: true, gender: 'F', gmax: true, item: 'Charizardite Y', nature: 'Timid', teraType: 'Stellar',
    moves: ['Flamethrower', '', 'Solar Beam', ''], sp: {hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32}});
  const b = newMon('Rayquaza');
  b.moves = ['Dragon Ascent', 'Extreme Speed', 'Earthquake', 'Protect'];
  team.mons = [a, b];
  assert.deepEqual(strip(decodeTeam(encodeTeam(team))), strip(team));
});

test('broken codes give a clear message instead of a bad team', () => {
  const code = encodeTeam(sampleTeams()[0]);
  assert.throws(() => decodeTeam(code.slice(0, -6)), SaveCodeError);
  const typo = code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21);
  assert.throws(() => decodeTeam(typo), SaveCodeError);
  assert.throws(() => decodeTeam('hello'), /start with CPV1/);
});

test('codes are found inside pasted text', () => {
  const [a, b] = sampleTeams().map(encodeTeam);
  assert.deepEqual(findSaveCodes(`my teams:\n${a}\n\nand ${b} ok`), [a, b]);
  assert.deepEqual(decodeTeam(` ${a.slice(0, 30)}\n${a.slice(30)} `).mons.length, 6);
});

// Which animation each battle-log line plays (src/ui/fx/triggers.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Protocol} from '@pkmn/protocol';
import {Match} from '../src/engine/match.js';
import {sampleTeams} from '../src/engine/samples.js';
import {animFor} from '../src/ui/fx/triggers.js';

const field = [{slot: 'p1a'}, {slot: 'p2a'}];
const doubles = [{slot: 'p1a'}, {slot: 'p1b'}, {slot: 'p2a'}, {slot: 'p2b'}];
const at = (line, f = field) => {
  const {args, kwArgs} = Protocol.parseBattleLine(line);
  return animFor({args, kwArgs}, f);
};

test('moves: user and target, misses, spread moves, charging turns, [still]', () => {
  assert.deepEqual(at('|move|p1a: Gengar|Shadow Ball|p2a: Alakazam'), {kind: 'move', id: 'shadowball', slots: ['p1a', 'p2a']});
  assert.deepEqual(at('|move|p2a: Gengar|Shadow Ball|p1a: Alakazam|[miss]'), {kind: 'move', id: 'shadowball', slots: ['p2a', 'miss:p1a']});
  assert.deepEqual(at('|move|p1a: Garchomp|Earthquake|p2a: X|[spread] p2a,p2b,p1b', doubles), {kind: 'move', id: 'earthquake', slots: ['p1a', 'p2a', 'p2b', 'p1b']});
  assert.deepEqual(at('|move|p1a: Garchomp|Rock Slide|p2a: X|[spread] .', doubles), {kind: 'move', id: 'rockslide', slots: ['p1a', 'miss:p2a']});
  assert.deepEqual(at('|move|p1a: Charizard|Solar Beam||[still]'), null);
  assert.deepEqual(at('|move|p1a: Charizard|Solar Beam|p2a: X|[prepare]'), {kind: 'prepare', id: 'solarbeam', slots: ['p1a', 'p2a']});
  assert.deepEqual(at('|-prepare|p1a: Charizard|Solar Beam'), {kind: 'prepare', id: 'solarbeam', slots: ['p1a', 'p2a']});
  assert.deepEqual(at('|move|p1a: X|Splash|p1a: X'), {kind: 'move', id: 'splash', slots: ['p1a', 'p1a']});
  assert.deepEqual(at('|move|p1a: X|Protect|'), {kind: 'move', id: 'protect', slots: ['p1a', 'p2a']}, 'no target: the first foe');
  assert.deepEqual(at('|move|p1a: X|Tackle|p2a: Y|[notarget]'), null);
  assert.deepEqual(at('|-anim|p1a: X|Fusion Cannon|p2a: Y'), {kind: 'move', id: 'fusioncannon', slots: ['p1a', 'p2a']});
});

test('status, residual damage and other effects follow Showdown', () => {
  assert.deepEqual(at('|-status|p2a: Y|brn'), {kind: 'status', id: 'brn', slots: ['p2a']});
  assert.deepEqual(at('|-status|p2a: Y|tox'), {kind: 'status', id: 'psn', slots: ['p2a']});
  assert.deepEqual(at('|-status|p2a: Y|slp'), null);
  assert.deepEqual(at('|-damage|p2a: Y|50/100|[from] brn'), {kind: 'status', id: 'brn', slots: ['p2a']});
  assert.deepEqual(at('|-damage|p2a: Y|50/100|[from] Leech Seed|[of] p1a: X'), {kind: 'other', id: 'leech', slots: ['p1a', 'p2a']});
  assert.deepEqual(at('|-damage|p2a: Y|50/100|[from] item: Life Orb'), null);
  assert.deepEqual(at('|-damage|p2a: Y|50/100'), null);
  assert.deepEqual(at('|cant|p1a: X|par'), {kind: 'status', id: 'par', slots: ['p1a']});
  assert.deepEqual(at('|cant|p1a: X|recharge'), {kind: 'other', id: 'selfstatus', slots: ['p1a']});
  assert.deepEqual(at('|cant|p1a: X|Truant'), null);
  assert.deepEqual(at('|-start|p1a: X|confusion'), {kind: 'status', id: 'confused', slots: ['p1a']});
  assert.deepEqual(at('|-start|p1a: X|confusion|[already]'), null);
  assert.deepEqual(at('|-heal|p1a: X|80/100|[from] item: Leftovers'), {kind: 'other', id: 'heal', slots: ['p1a']});
  assert.deepEqual(at('|-zpower|p1a: X'), {kind: 'other', id: 'zpower', slots: ['p1a']});
  assert.deepEqual(at('|turn|2'), null);
});

test('a real battle\'s moves all get an animation', () => {
  const m = new Match({mode: 'singles', seed: '1,2,3,4', players: [{name: 'A', team: sampleTeams()[0]}, {name: 'B', team: sampleTeams()[2]}]});
  m.choose(0, 'team 123456');
  m.choose(1, 'team 123456');
  for (let turn = 0; turn < 4 && !m.battle.ended; turn++) {
    if (m.requests[0]?.active) m.choose(0, 'move 1');
    if (m.requests[1]?.active) m.choose(1, 'move 1');
    if (m.requests[0]?.forceSwitch) m.choose(0, 'switch 2');
    if (m.requests[1]?.forceSwitch) m.choose(1, 'switch 2');
  }
  const moves = m.battle.log.filter(l => l.startsWith('|move|') && !l.includes('[still]') && !l.includes('[notarget]'));
  assert.ok(moves.length >= 2);
  for (const line of moves) assert.equal(at(line)?.kind, 'move', line);
});

test('the vendored animations keep their licence notes, and their images are all there', () => {
  const moves = fs.readFileSync(new URL('../vendor/showdown/battle-animations-moves.ts', import.meta.url), 'utf8');
  const tables = fs.readFileSync(new URL('../vendor/showdown/battle-animations.ts', import.meta.url), 'utf8');
  assert.match(moves, /@license CC0-1\.0/);
  assert.match(tables, /@license MIT/);
  assert.doesNotMatch(moves + tables, /routes\.client/, 'no images loaded from Showdown\'s own server');
  const files = JSON.parse(fs.readFileSync(new URL('../vendor/showdown/fx-files.json', import.meta.url), 'utf8'));
  for (const f of files) assert.ok(fs.existsSync(new URL(`../public/assets/showdown-fx/${f}`, import.meta.url)), f);
  for (const f of ['glitchshard', 'antimatter', 'beamcore', 'sigil', 'darkflame', 'noise', 'tearbars']) {
    assert.ok(fs.existsSync(new URL(`../public/assets/fx-custom/${f}.png`, import.meta.url)), f);
  }
});

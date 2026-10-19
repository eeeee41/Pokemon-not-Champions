// Computer rivals: their teams, and bots that always play legal moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/engine/match.js';
import {validateTeam} from '../src/engine/team.js';
import {randomChoice} from '../src/engine/choices.js';
import {sampleTeams} from '../src/engine/samples.js';
import {RIVALS, rivalTeams} from '../src/engine/rivals.js';
import {Bot, snapshot, options} from '../src/engine/bot.js';
import {BotGame} from '../src/ui/bot-game.js';

const teams = rivalTeams();

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

test('every rival has a unique id and a legal team of six', () => {
  assert.equal(RIVALS.length, 21);
  assert.equal(new Set(RIVALS.map(r => r.id)).size, RIVALS.length);
  for (const r of RIVALS) {
    const v = validateTeam(teams[r.id]);
    assert.ok(v.ok, `${r.name}: ${v.problems.map(p => p.text).join('; ')}`);
    assert.ok(r.line && r.game && r.ace, r.name);
  }
});

test('options list moves, gimmicks and switches', () => {
  const m = new Match({mode: 'singles', seed: '1,2,3,4', players: [{name: 'A', team: teams.blue}, {name: 'B', team: teams.may}]});
  m.choose(0, 'team 123456');
  m.choose(1, 'team 123456');
  const opts = options(m.requests[1]);
  assert.ok(opts.includes('move 1'));
  assert.ok(opts.some(o => o.endsWith('terastallize')));
  assert.ok(opts.some(o => o.startsWith('switch')));
});

async function play(level, rivalId, playerTeam, seed) {
  const m = new Match({mode: 'singles', seed, players: [{name: 'You', team: playerTeam}, {name: 'Rival', team: teams[rivalId]}]});
  const bot = new Bot({side: 1, level, rng: rng(seed.length * 97)});
  const random = rng(7);
  for (let i = 0; i < 400 && !m.ended; i++) {
    let json = snapshot(m.battle);
    let requests = [...m.requests];
    // The player chooses first; when both choose this turn, the bot only gets the snapshot from before.
    const both = m.needsChoice(0) && m.needsChoice(1);
    if (m.needsChoice(0)) assert.ok(m.choose(0, randomChoice(requests[0], random)));
    if (m.needsChoice(1)) {
      if (!both) {
        json = snapshot(m.battle);
        requests = [...m.requests];
      }
      const choice = await bot.choose(json, requests);
      assert.ok(m.choose(1, choice), `${level} bot chose "${choice}": ${m.errors[1]}`);
    }
  }
  assert.ok(m.ended, 'battle finished');
  return m.winnerIndex;
}

test('Normal, Hard and Champion bots play whole battles with legal choices', {timeout: 240000}, async () => {
  const mine = sampleTeams()[0];
  const results = [];
  results.push(await play('normal', 'barry', mine, '1,1,1,1'));
  results.push(await play('hard', 'taunie', mine, '2,2,2,2'));
  results.push(await play('champion', 'kieran', mine, '3,3,3,3'));
  // Against random moves, the bots should win nearly always.
  assert.ok(results.filter(w => w === 1).length >= 2, `bot wins: ${results}`);
});

test('a bot battle runs start to finish on the battle screen\'s game', {timeout: 120000}, async () => {
  const rival = RIVALS.find(r => r.id === 'hop');
  const game = new BotGame({rival, level: 'hard', team: sampleTeams()[2], rivalTeam: teams.hop});
  assert.equal(game.logs[0][0].kind, 'major');
  const random = rng(11);
  const t0 = Date.now();
  while (game.phase.type !== 'over') {
    if (Date.now() - t0 > 110000) throw new Error(`stuck in ${game.phase.type}`);
    if (game.phase.type === 'playback') {
      game.skipStage();
      game.advance();
    } else if (game.phase.type === 'choose') {
      assert.equal(game.submit(0, randomChoice(game.match.requests[0], random)), null);
    } else {
      await new Promise(r => setTimeout(r, 5));
    }
  }
  assert.ok(game.match.ended);
  game.dispose();
});

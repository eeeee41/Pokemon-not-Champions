// Online play, end to end: real Lobby and OnlineGame code, two or more
// "browsers" talking through an in-memory database that enforces the real
// database.rules.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MemoryServer, MemoryBackend} from '../src/online/memory-backend.js';
import {Lobby, normalizeCode} from '../src/online/lobby.js';
import {OnlineGame} from '../src/online/online-game.js';
import {sampleTeams} from '../src/engine/samples.js';
import {encodeTeam} from '../src/engine/savecode.js';
import {randomChoice} from '../src/engine/choices.js';

const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url)));
const teams = sampleTeams();
const codes = teams.map(encodeTeam);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function until(cond, label, ms = 20000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error(`Timed out waiting for: ${label}`);
    await sleep(3);
  }
}

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

async function player(server, uid, name, lobbyOptions = {}) {
  const b = new MemoryBackend(server, {uid});
  const lobby = new Lobby(b, lobbyOptions);
  await lobby.start(name);
  return {b, lobby, uid, name};
}

function quick(p, mode, code) {
  return new Promise((resolve, reject) => p.lobby.quickMatch(mode, code, {onMatch: resolve, onError: reject}));
}

async function open(p, info, code, opts = {}) {
  const game = new OnlineGame({backend: p.b, matchId: info.id, side: info.side, teamCode: code, ...opts});
  await game.start();
  return game;
}

/** What the battle screen does: finish any playback, and (unless idle) pick a move. */
function drive(g, random, idle = false) {
  if (g.disposed) return;
  if (g.phase.type === 'playback') {
    g.skipStage();
    g.advance();
  }
  if (g.phase.type === 'choose' && !idle) {
    const err = g.submit(g.me, randomChoice(g.match.requests[g.me], random));
    assert.equal(err, null, `choice refused: ${err}`);
  }
  assert.notEqual(g.phase.type, 'error', g.error);
}

/** Plays every live game with random legal moves until all are over (or `stop` says so). */
async function play(games, random, {stop = () => false, idle = new Set()} = {}) {
  await until(() => {
    for (const g of games) drive(g, random, idle.has(g));
    return stop() || games.every(g => g.disposed || g.phase.type === 'over');
  }, 'battle to finish', 60000);
}

const strip = lines => lines.filter(l => !l.startsWith('|t:|'));

for (const mode of ['singles', 'doubles']) {
  test(`Quick Match pairs two players and their ${mode} battle stays in lockstep`, async () => {
    const server = new MemoryServer({rules});
    const ace = await player(server, 'ace', 'Ace');
    const rival = await player(server, 'rival', 'Rival');
    const [a, r] = await Promise.all([quick(ace, mode, codes[0]), quick(rival, mode, codes[1])]);
    assert.equal(a.id, r.id);
    assert.notEqual(a.side, r.side);
    const ga = await open(ace, a, codes[0]);
    const gr = await open(rival, r, codes[1]);
    await play([ga, gr], rng(mode === 'singles' ? 11 : 29));
    // Both browsers ran exactly the same battle.
    assert.deepEqual(strip(gr.match.raw), strip(ga.match.raw));
    assert.equal(ga.phase.winner, gr.phase.winner);
    // Results and records are saved once.
    await until(() => server.value(`matches/${a.id}/result`), 'result saved');
  const result = server.value(`matches/${a.id}/result`);
    assert.equal(result.reason, 'battle');
    await until(() => !server.value('users/ace/match') && !server.value('users/rival/match'), 'records saved');
    const recA = server.value('users/ace');
    const recR = server.value('users/rival');
    assert.equal((recA.wins || 0) + (recR.wins || 0), result.winner === 'tie' ? 0 : 1);
    assert.equal((recA.losses || 0) + (recR.losses || 0), result.winner === 'tie' ? 0 : 1);
    ga.dispose();
    gr.dispose();
  });
}

test('four players arriving together are paired up, each exactly once', async () => {
  const server = new MemoryServer({rules});
  const ps = await Promise.all(['a', 'b', 'c', 'd'].map(id => player(server, id, id.toUpperCase())));
  const results = await Promise.all(ps.map((p, i) => quick(p, 'singles', codes[i % 3])));
  const byMatch = new Map();
  results.forEach((info, i) => {
    if (!byMatch.has(info.id)) byMatch.set(info.id, []);
    byMatch.get(info.id).push({uid: ps[i].uid, side: info.side});
  });
  assert.equal(byMatch.size, 2);
  for (const [id, pair] of byMatch) {
    assert.equal(pair.length, 2);
    assert.deepEqual(pair.map(p => p.side).sort(), ['p1', 'p2']);
    const m = server.value(`matches/${id}`);
    assert.deepEqual([m.p1.uid, m.p2.uid].sort(), pair.map(p => p.uid).sort());
  }
});

test('a player who leaves the queue is not matched', async () => {
  const server = new MemoryServer({rules});
  const a = await player(server, 'a', 'A');
  const b = await player(server, 'b', 'B');
  const c = await player(server, 'c', 'C');
  let aMatched = false;
  const task = a.lobby.quickMatch('doubles', codes[0], {onMatch: () => (aMatched = true), onError: e => assert.fail(e)});
  await until(() => server.value('queue/doubles-dev')?.uid === 'a', 'a waiting');
  await task.cancel();
  assert.equal(server.value('queue/doubles-dev'), null);
  const [mb, mc] = await Promise.all([quick(b, 'doubles', codes[1]), quick(c, 'doubles', codes[2])]);
  assert.equal(mb.id, mc.id);
  await sleep(30);
  assert.equal(aMatched, false);
});

test('private battle with a code, and clear errors for bad codes', async () => {
  const server = new MemoryServer({rules});
  const host = await player(server, 'host', 'Host');
  const guest = await player(server, 'guest', 'Guest');
  const late = await player(server, 'late', 'Late');
  let hostInfo = null;
  const room = await host.lobby.hostRoom('doubles', codes[2], {onMatch: i => (hostInfo = i), onError: e => assert.fail(e)});
  assert.match(room.code, /^[A-HJ-NP-Z2-9]{5}$/);
  await assert.rejects(host.lobby.joinRoom(room.code, codes[2]), /your own code/);
  await assert.rejects(guest.lobby.joinRoom('ZZZZZ', codes[0]), /no battle with the code ZZZZZ/);
  await assert.rejects(guest.lobby.joinRoom('hi', codes[0]), /5 letters and numbers/);
  const joined = await guest.lobby.joinRoom(room.code.toLowerCase().split('').join(' '), codes[0]);
  assert.equal(joined.mode, 'doubles');
  await until(() => hostInfo, 'host told about the match');
  assert.equal(hostInfo.id, joined.id);
  await assert.rejects(late.lobby.joinRoom(room.code, codes[1]), /already joined/);
  assert.equal(normalizeCode(' k7q-2m '), 'K7Q2M');
});

test('challenging an online player sends them an invite they can accept', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  const misty = await player(server, 'misty', 'Misty');
  let seenPlayers = [];
  const stopPlayers = ace.lobby.watchPlayers(list => (seenPlayers = list));
  await until(() => seenPlayers.some(p => p.uid === 'misty'), 'Ace sees Misty online');
  let invites = [];
  const stopInv = misty.lobby.watchInvites(list => (invites = list));
  let aceInfo = null;
  await ace.lobby.challenge('misty', 'singles', codes[0], {onMatch: i => (aceInfo = i), onError: e => assert.fail(e)});
  await until(() => invites.length === 1, 'Misty gets the invite');
  assert.equal(invites[0].name, 'Ace');
  const info = await misty.lobby.joinRoom(invites[0].code, codes[1]);
  await until(() => aceInfo && invites.length === 0, 'match starts and the invite clears');
  assert.equal(aceInfo.id, info.id);
  stopPlayers();
  stopInv();
});

test('a player who refreshes mid-battle rejoins exactly where they were', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  const rival = await player(server, 'rival', 'Rival');
  const [a, r] = await Promise.all([quick(ace, 'doubles', codes[1]), quick(rival, 'doubles', codes[2])]);
  const ga = await open(ace, a, codes[1]);
  let gr = await open(rival, r, codes[2]);
  const random = rng(5);
  await play([ga, gr], random, {stop: () => ga.match && ga.match.battle.turn >= 3});
  // Rival's tab closes.
  rival.b.close();
  gr.dispose();
  await until(() => !ga.opponentOnline, 'Ace sees Rival go offline');
  // Rival opens the site again: same player id, finds the battle from their record.
  const again = await player(server, 'rival', 'Rival');
  const matchId = await again.b.get('users/rival/match');
  assert.equal(matchId, a.id);
  gr = await open(again, {id: matchId, side: r.side}, null);
  await until(() => gr.match && gr.phase.type !== 'loading', 'rejoined');
  assert.deepEqual(strip(gr.match.raw), strip(ga.match.raw).slice(0, strip(gr.match.raw).length));
  await until(() => ga.opponentOnline, 'Ace sees Rival back');
  await play([ga, gr], random);
  assert.deepEqual(strip(gr.match.raw), strip(ga.match.raw));
  ga.dispose();
  gr.dispose();
});

test('the turn timer moves for an idle player, and a vanished player can be beaten by claim', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  const rival = await player(server, 'rival', 'Rival');
  const [a, r] = await Promise.all([quick(ace, 'singles', codes[0]), quick(rival, 'singles', codes[1])]);
  const fast = {turnMs: 60, claimMs: 150};
  const ga = await open(ace, a, codes[0], fast);
  const gr = await open(rival, r, codes[1], fast);
  // Rival never touches the controls; their own clock picks moves for them.
  await play([ga, gr], rng(3), {idle: new Set([gr]), stop: () => ga.match && ga.match.battle.turn >= 2});
  assert.ok(gr.autoMoved || gr.applied[gr.me] > 0, 'idle player was moved for');
  // Now Rival disappears completely.
  rival.b.close();
  gr.dispose();
  const random = rng(4);
  await until(() => {
    drive(ga, random);
    return ga.canClaimWin() || ga.phase.type === 'over';
  }, 'claim button');
  if (ga.phase.type !== 'over') {
    assert.equal(ga.opponentOnline, false);
    ga.claimWin();
    await until(() => {
      drive(ga, random);
      return ga.phase.type === 'over';
    }, 'claimed');
    assert.equal(ga.phase.winner, ga.me);
    assert.equal(ga.phase.reason, 'timeout');
    assert.ok(ga.match.ended, 'the battle log ends too');
    await until(() => server.value('users/ace')?.wins === 1, 'win recorded');
  }
  ga.dispose();
});

test('forfeiting ends the battle for both players', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  const rival = await player(server, 'rival', 'Rival');
  const [a, r] = await Promise.all([quick(ace, 'singles', codes[2]), quick(rival, 'singles', codes[0])]);
  const ga = await open(ace, a, codes[2]);
  const gr = await open(rival, r, codes[0]);
  await play([ga, gr], rng(8), {stop: () => ga.match && ga.match.battle.turn >= 1});
  gr.forfeit(gr.me);
  await play([ga, gr], rng(8));
  assert.equal(ga.phase.winner, ga.me);
  assert.equal(gr.phase.winner, ga.me);
  assert.equal(ga.phase.reason, 'forfeit');
  assert.ok(ga.match.ended && gr.match.ended);
  ga.dispose();
  gr.dispose();
});

test('the rules stop players from cheating', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  const rival = await player(server, 'rival', 'Rival');
  const snoop = await player(server, 'snoop', 'Snoop');
  const [a, r] = await Promise.all([quick(ace, 'singles', codes[0]), quick(rival, 'singles', codes[1])]);
  const opp = r.side;
  await assert.rejects(ace.b.set(`matches/${a.id}/choices/${opp}/0`, 'team 123456'), /PERMISSION_DENIED/);
  await assert.rejects(ace.b.set(`matches/${a.id}/teams/${opp}`, codes[2]), /PERMISSION_DENIED/);
  await assert.rejects(snoop.b.get(`matches/${a.id}`), /PERMISSION_DENIED/);
  await assert.rejects(snoop.b.set(`matches/${a.id}/result`, {winner: 'p1', reason: 'forfeit', at: 1}), /PERMISSION_DENIED/);
  await assert.rejects(snoop.b.set('users/ace/wins', 99), /PERMISSION_DENIED/);
  await assert.rejects(snoop.b.set('presence/ace', {name: 'Ace', state: 'idle', at: 1}), /PERMISSION_DENIED/);
  await assert.rejects(snoop.b.get('invites/ace'), /PERMISSION_DENIED/);
});

test('an illegal team sent by a hacked client loses automatically', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  const cheat = await player(server, 'cheat', 'Cheat');
  const bad = JSON.parse(JSON.stringify(teams[0]));
  bad.mons[0].sp = {hp: 32, atk: 32, def: 32, spa: 32, spd: 32, spe: 32};
  const [a, c] = await Promise.all([quick(ace, 'singles', codes[1]), quick(cheat, 'singles', encodeTeam(bad))]);
  const ga = await open(ace, a, codes[1]);
  const gc = await open(cheat, c, encodeTeam(bad));
  await until(() => ga.phase.type === 'over', 'illegal team caught');
  assert.equal(ga.phase.winner, ga.me);
  assert.equal(ga.phase.reason, 'illegal');
  ga.dispose();
  gc.dispose();
});

test('players on different versions of the site are kept apart', async () => {
  const server = new MemoryServer({rules});
  const old = await player(server, 'old', 'Old', {version: 'aaa'});
  const b = await player(server, 'b', 'B', {version: 'bbb'});
  const c = await player(server, 'c', 'C', {version: 'bbb'});
  let oldMatched = false;
  old.lobby.quickMatch('singles', codes[0], {onMatch: () => (oldMatched = true), onError: e => assert.fail(e)});
  await until(() => server.value('queue/singles-aaa'), 'old page waiting');
  const [mb, mc] = await Promise.all([quick(b, 'singles', codes[1]), quick(c, 'singles', codes[2])]);
  assert.equal(mb.id, mc.id);
  await sleep(20);
  assert.equal(oldMatched, false);
  old.lobby.stop();
  // A code from an older page explains what to do.
  const room = await old.lobby.hostRoom('doubles', codes[0], {onMatch: () => {}, onError: () => {}});
  await assert.rejects(b.lobby.joinRoom(room.code, codes[1]), /different version of the site/);
  await room.cancel();
  // A battle started on another version can't be continued here, but can be forfeited.
  const gc = await open(c, mc, codes[2], {version: 'bbb'});
  const stale = await open(b, mb, codes[1], {version: 'ccc'});
  assert.equal(stale.phase.type, 'error');
  assert.equal(stale.phase.kind, 'outdated');
  await stale.forfeit(stale.me);
  assert.equal(stale.phase.type, 'over');
  assert.equal(stale.phase.winner, stale.opp);
  await until(() => gc.phase.type === 'over', 'opponent sees the forfeit');
  assert.equal(gc.phase.reason, 'forfeit');
  gc.dispose();
  stale.dispose();
});

test('a challenger hears back when their challenge is declined or goes unanswered', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  const brock = await player(server, 'brock', 'Brock', {inviteMaxAge: 400});
  const misty = await player(server, 'misty', 'Misty');
  let invites = [];
  const stop = misty.lobby.watchInvites(list => (invites = list));
  const handlers = resolve => ({onMatch: () => assert.fail('no match expected'), onError: e => assert.fail(e), onDeclined: resolve});
  const declined = new Promise(resolve => ace.lobby.challenge('misty', 'doubles', codes[0], handlers(resolve)));
  await until(() => invites.length === 1, 'the challenge arrives');
  await misty.lobby.declineInvite('ace');
  assert.equal(await declined, 'declined');
  assert.equal(server.value('rooms'), null, 'the private room is closed');
  assert.equal(ace.lobby.task, null);
  const lapsed = new Promise(resolve => brock.lobby.challenge('misty', 'singles', codes[0], handlers(resolve)));
  await until(() => invites.length === 1, 'the second challenge arrives');
  assert.equal(await lapsed, 'expired');
  await until(() => invites.length === 0, 'the lapsed challenge disappears');
  assert.equal(brock.lobby.task, null);
  stop();
});

test('after a dropped connection, presence and the online flag come back and the battle carries on', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  const rival = await player(server, 'rival', 'Rival');
  const [a, r] = await Promise.all([quick(ace, 'singles', codes[0]), quick(rival, 'singles', codes[1])]);
  const ga = await open(ace, a, codes[0]);
  const gr = await open(rival, r, codes[1]);
  const random = rng(21);
  await play([ga, gr], random, {stop: () => ga.match && ga.match.battle.turn >= 2});
  rival.b.drop();
  await until(() => !ga.opponentOnline && !server.value('presence/rival'), 'Rival shows as offline');
  // Rival keeps playing while offline; the move is sent when the connection returns.
  for (let i = 0; i < 20; i++) {
    drive(gr, random);
    await sleep(2);
  }
  rival.b.restore();
  await until(() => ga.opponentOnline && server.value('presence/rival')?.state === 'battling', 'Rival is back');
  await play([ga, gr], random);
  assert.deepEqual(strip(gr.match.raw), strip(ga.match.raw));
  ga.dispose();
  gr.dispose();
});

test('a move the battle does not allow (a tampered page) ends it as a tie', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  const rival = await player(server, 'rival', 'Rival');
  const [a, r] = await Promise.all([quick(ace, 'doubles', codes[1]), quick(rival, 'doubles', codes[2])]);
  const ga = await open(ace, a, codes[1]);
  const gr = await open(rival, r, codes[2]);
  const random = rng(17);
  await play([ga, gr], random, {stop: () => ga.match && ga.match.battle.turn >= 2 && ga.match.needsChoice(ga.opp)});
  // Rival's page is swapped for one that sends nonsense. Its real page may
  // already have answered this turn (choices can't be overwritten), so play on
  // to the first turn it hasn't answered.
  gr.dispose();
  const slot = () => `matches/${r.id}/choices/${r.side}/${ga.applied[ga.opp]}`;
  await until(() => {
    if (ga.phase.type === 'playback') {
      ga.skipStage();
      ga.advance();
    }
    if (ga.match.needsChoice(ga.opp) && server.value(slot()) == null) return true;
    drive(ga, random);
    return false;
  }, 'a turn Rival has not answered');
  await rival.b.set(slot(), 'move 9, move 9');
  await until(() => {
    if (ga.phase.type === 'playback') {
      ga.skipStage();
      ga.advance();
    }
    return ga.phase.type === 'over';
  }, 'the battle ends');
  assert.equal(ga.phase.reason, 'sync');
  assert.equal(ga.phase.winner, null);
  assert.equal(server.value(`matches/${a.id}/result/winner`), 'tie');
  await until(() => !server.value('users/ace/match'), 'cleared from the record');
  assert.equal(server.value('users/ace/wins') || 0, 0);
  ga.dispose();
});

test('coming back to the lobby after leaving a battle: rejoin info, forfeit, and results counted', async () => {
  const server = new MemoryServer({rules});
  const ace = await player(server, 'ace', 'Ace');
  let rival = await player(server, 'rival', 'Rival');
  const random = rng(33);

  // 1. Rival leaves mid-battle and gives it up from the lobby later.
  let [a, r] = await Promise.all([quick(ace, 'singles', codes[0]), quick(rival, 'singles', codes[1])]);
  let ga = await open(ace, a, codes[0]);
  let gr = await open(rival, r, codes[1]);
  await play([ga, gr], random, {stop: () => ga.match && ga.match.battle.turn >= 1});
  rival.b.close();
  gr.dispose();
  rival = await player(server, 'rival', 'Rival');
  let rec = null;
  let stopRec = rival.lobby.watchRecord(x => (rec = x));
  await until(() => rec?.match === a.id, 'Rival\'s record points at the battle');
  const info = await rival.lobby.checkBattle(rec.match);
  assert.deepEqual({...info, id: null}, {id: null, side: r.side, mode: 'singles', opponent: 'Ace', result: null});
  await rival.lobby.forfeitBattle(info);
  await until(() => {
    drive(ga, random);
    return ga.phase.type === 'over';
  }, 'Ace sees the forfeit');
  assert.equal(ga.phase.winner, ga.me);
  await until(() => rec.match === null && rec.losses === 1, 'Rival\'s loss is counted');
  ga.dispose();

  // 2. Rival leaves, Ace forfeits while Rival is away; Rival's win counts when they come back.
  [a, r] = await Promise.all([quick(ace, 'doubles', codes[0]), quick(rival, 'doubles', codes[1])]);
  ga = await open(ace, a, codes[0]);
  gr = await open(rival, r, codes[1]);
  await play([ga, gr], random, {stop: () => ga.match && ga.match.battle.turn >= 1});
  stopRec();
  rival.b.close();
  gr.dispose();
  await ga.forfeit(ga.me);
  rival = await player(server, 'rival', 'Rival');
  rec = null;
  stopRec = rival.lobby.watchRecord(x => (rec = x));
  await until(() => rec?.match === a.id, 'the finished battle is still in Rival\'s record');
  const done = await rival.lobby.checkBattle(rec.match);
  assert.equal(done.result.reason, 'forfeit');
  await until(() => rec.match === null && rec.wins === 1 && rec.losses === 1, 'Rival\'s win is counted');
  assert.equal(server.value('users/ace/losses'), 1);
  assert.equal(server.value('users/ace/wins'), 1);
  stopRec();
  ga.dispose();
});

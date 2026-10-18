// The production Firebase backend (src/online/backend.js) and the real Firebase
// JS SDK, against a local stand-in for Firebase (test/support/fake-firebase.mjs)
// that enforces the real database.rules.json. This catches mistakes in how we
// use the SDK that the in-memory backend can't (transactions, listeners,
// onDisconnect, reconnecting).

// The SDK would send local test traffic through this machine's web proxy.
for (const key of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy']) delete process.env[key];

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ref, runTransaction, goOffline, goOnline, onValue} from 'firebase/database';
import {FirebaseBackend} from '../src/online/backend.js';
import {Lobby, friendlyError} from '../src/online/lobby.js';
import {OnlineGame} from '../src/online/online-game.js';
import {sampleTeams} from '../src/engine/samples.js';
import {encodeTeam} from '../src/engine/savecode.js';
import {randomChoice} from '../src/engine/choices.js';
import {startFakeFirebase, firebaseHash} from './support/fake-firebase.mjs';

const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url)));
const codes = sampleTeams().map(encodeTeam);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = lines => lines.filter(l => !l.startsWith('|t:|'));

async function until(cond, label, ms = 30000) {
  const t0 = Date.now();
  while (!(await cond())) {
    if (Date.now() - t0 > ms) throw new Error(`Timed out waiting for: ${label}`);
    await sleep(5);
  }
}

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const fake = await startFakeFirebase({rules});
const config = {
  apiKey: 'test-api-key',
  projectId: 'demo-champions',
  appId: '1:000000000000:web:0000000000000000',
  databaseURL: 'https://demo-champions-default-rtdb.firebaseio.com',
};
const open = [];
let apps = 0;

function backend() {
  const b = new FirebaseBackend(config, {
    appName: `test-${++apps}`,
    emulators: {auth: `http://127.0.0.1:${fake.port}`, database: {host: '127.0.0.1', port: fake.port}},
  });
  open.push(b);
  return b;
}

async function player(name) {
  const b = backend();
  const lobby = new Lobby(b);
  await lobby.start(name);
  return {b, lobby, name};
}

function quick(p, mode, code) {
  return new Promise((resolve, reject) => p.lobby.quickMatch(mode, code, {onMatch: resolve, onError: reject}));
}

function drive(g, random) {
  if (g.phase.type === 'playback') {
    g.skipStage();
    g.advance();
  }
  if (g.phase.type === 'choose') assert.equal(g.submit(g.me, randomChoice(g.match.requests[g.me], random)), null);
  assert.notEqual(g.phase.type, 'error', g.error);
}

test.after(async () => {
  for (const b of open) await b.close().catch(() => {});
  await fake.close();
});

test('the test server computes the same data hash as the SDK', async () => {
  // Transactions only work if these agree. The SDK hashes its copy of the
  // data (snapshot._node.hash() is what it sends with a transaction).
  const b = backend();
  await b.connect();
  const values = [
    'text', 42, 1.5, -0.25, 1e21, true, false, {a: 1, b: {c: 'x'}},
    {10: 'ten', 9: 'nine', a: 'a', '-1': 'neg', '007': 'bond', 2147483648: 'big'}, {0: 'team 123', 1: 'move 1', 2: 'switch 3'},
  ];
  const canonical = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).sort()) : x));
  for (const value of values) {
    fake.db.apply('presence/hash-check', value);
    const node = await new Promise(resolve => {
      const stop = onValue(ref(b.db, 'presence/hash-check'), snap => {
        if (canonical(snap.exportVal()) === canonical(value)) {
          stop();
          resolve(snap._node);
        }
      });
    });
    assert.equal(firebaseHash(value), node.hash(), JSON.stringify(value));
  }
  fake.db.apply('presence/hash-check', null);
});

test('Firebase gives up on a transaction it runs on data it has not loaded; our backend does not', async () => {
  const host = await player('Host');
  const guest = await player('Guest');
  const room = await host.lobby.hostRoom('singles', codes[0], {onMatch: () => {}, onError: () => {}});
  // Straight SDK call, the way the code worked before: aborts without asking the server.
  const raw = await runTransaction(ref(guest.b.db, `rooms/${room.code}`), cur => (cur ? {...cur, claimedBy: guest.b.uid, claimedName: 'Guest'} : undefined), {applyLocally: false});
  assert.equal(raw.committed, false);
  assert.equal(raw.snapshot.val(), null, 'the SDK never saw the room');
  // Through the backend, the guest joins.
  const info = await guest.lobby.joinRoom(room.code, codes[1]);
  assert.equal(info.mode, 'singles');
  await room.cancel();
});

test('two players find each other with Quick Match and play a whole doubles battle', async () => {
  const ace = await player('Ace');
  const rival = await player('Rival');
  const [a, r] = await Promise.all([quick(ace, 'doubles', codes[0]), quick(rival, 'doubles', codes[1])]);
  assert.equal(a.id, r.id);
  const ga = new OnlineGame({backend: ace.b, matchId: a.id, side: a.side, teamCode: codes[0]});
  const gr = new OnlineGame({backend: rival.b, matchId: r.id, side: r.side, teamCode: codes[1]});
  await Promise.all([ga.start(), gr.start()]);
  const random = rng(77);
  await until(() => {
    drive(ga, random);
    drive(gr, random);
    return ga.phase.type === 'over' && gr.phase.type === 'over';
  }, 'battle over', 120000);
  assert.deepEqual(strip(gr.match.raw), strip(ga.match.raw));
  assert.equal(ga.phase.winner, gr.phase.winner);
  const result = fake.db.value(`matches/${a.id}/result`);
  assert.equal(result.reason, 'battle');
  await until(() => !fake.db.value(`users/${ace.b.uid}/match`) && !fake.db.value(`users/${rival.b.uid}/match`), 'records saved');
  const wins = (fake.db.value(`users/${ace.b.uid}/wins`) || 0) + (fake.db.value(`users/${rival.b.uid}/wins`) || 0);
  assert.equal(wins, result.winner === 'tie' ? 0 : 1);
  ga.dispose();
  gr.dispose();
  // Both are free again.
  await until(() => fake.db.value(`matches/${a.id}/online`) === null, 'online flags cleared');
});

test('leaving the queue really removes you, even though nothing was listening there', async () => {
  const p = await player('Leaver');
  const task = p.lobby.quickMatch('singles', codes[0], {onMatch: () => assert.fail('no match'), onError: e => assert.fail(e)});
  await until(() => fake.db.value('queue/singles-dev')?.uid === p.b.uid, 'waiting in the queue');
  await task.cancel();
  assert.equal(fake.db.value('queue/singles-dev'), null);
});

test('a dropped connection: the other player sees it, and presence comes back after', async () => {
  const ace = await player('Ace');
  const rival = await player('Rival');
  const [a, r] = await Promise.all([quick(ace, 'singles', codes[2]), quick(rival, 'singles', codes[0])]);
  const ga = new OnlineGame({backend: ace.b, matchId: a.id, side: a.side, teamCode: codes[2]});
  const gr = new OnlineGame({backend: rival.b, matchId: r.id, side: r.side, teamCode: codes[0]});
  await Promise.all([ga.start(), gr.start()]);
  const random = rng(5);
  await until(() => {
    drive(ga, random);
    drive(gr, random);
    return ga.match && ga.match.battle.turn >= 2;
  }, 'a couple of turns');
  goOffline(rival.b.db);
  await until(() => !ga.opponentOnline && !fake.db.value(`presence/${rival.b.uid}`), 'Rival shows as offline');
  goOnline(rival.b.db);
  await until(() => ga.opponentOnline && fake.db.value(`presence/${rival.b.uid}`)?.state === 'battling', 'Rival is back');
  // A tab closing for good forfeits nothing, but marks them offline.
  await gr.forfeit(gr.me);
  await until(() => {
    drive(ga, random);
    return ga.phase.type === 'over';
  }, 'forfeit seen');
  assert.equal(ga.phase.winner, ga.me);
  ga.dispose();
  gr.dispose();
});

test('the database refuses what the rules forbid, with a helpful message', async () => {
  const p = await player('Snoop');
  const other = await player('Other');
  await assert.rejects(p.b.set(`users/${other.b.uid}/wins`, 99), err => {
    assert.match(friendlyError(err), /database refused/);
    return true;
  });
  await assert.rejects(p.b.get(`invites/${other.b.uid}`), /permission/i);
});

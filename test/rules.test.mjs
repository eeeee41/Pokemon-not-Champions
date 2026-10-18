// The Realtime Database security rules (database.rules.json), checked case by
// case with targaryen, which evaluates rules the way Firebase does.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import targaryen from 'targaryen';

const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url)));
const now = 1_000_000;
const A = {uid: 'alice', provider: 'anonymous'};
const B = {uid: 'bob', provider: 'anonymous'};
const C = {uid: 'carl', provider: 'anonymous'};

function allowed(data, auth, op, path, value) {
  const db = targaryen.database(rules, data).as(auth);
  const r = op === 'read' ? db.read(path, {now}) : op === 'update' ? db.update(path, value, {now}) : db.write(path, value, {now});
  return r;
}

const Q = '/queue/singles-dev';
const waiting = {uid: 'alice', name: 'Alice', match: 'm1', at: now - 1000};
const match = {mode: 'singles', seed: '1,2,3,4', v: 'dev', at: now, p1: {uid: 'alice', name: 'Alice'}, p2: {uid: 'bob', name: 'Bob'}, teams: {p2: 'CPV1.xyz'}};
const invite = {name: 'Alice', mode: 'singles', code: 'K7Q2M', at: now};
const room = {uid: 'alice', name: 'Alice', mode: 'doubles', match: 'm5', v: 'dev', at: now};

const cases = [
  // Quick Match queue
  ['a waiter joins an empty queue', {}, A, 'write', Q, waiting, true],
  ['queues are per mode and version', {}, A, 'write', '/queue/doubles-0a1b2c3d4e', waiting, true],
  ['unknown modes are rejected', {}, A, 'write', '/queue/triples-dev', waiting, false],
  ['a queue key needs a version', {}, A, 'write', '/queue/singles', waiting, false],
  ['a claimer claims a waiter', {queue: {'singles-dev': waiting}}, B, 'write', Q, {...waiting, claimedBy: 'bob', claimedName: 'Bob'}, true],
  ['a claimer cannot change the match id', {queue: {'singles-dev': waiting}}, B, 'write', Q, {...waiting, match: 'evil', claimedBy: 'bob'}, false],
  ['nobody claims on behalf of someone else', {queue: {'singles-dev': waiting}}, B, 'write', Q, {...waiting, claimedBy: 'carl'}, false],
  ['a live waiter cannot be pushed out', {queue: {'singles-dev': waiting}}, B, 'write', Q, {uid: 'bob', name: 'Bob', match: 'm2', at: now}, false],
  ['a stale waiter can be replaced', {queue: {'singles-dev': {...waiting, at: now - 60000}}}, B, 'write', Q, {uid: 'bob', name: 'Bob', match: 'm2', at: now}, true],
  ['a stale waiter cannot be claimed', {queue: {'singles-dev': {...waiting, at: now - 60000}}}, B, 'write', Q, {...waiting, at: now - 60000, claimedBy: 'bob'}, false],
  ['a claimed spot can be reused', {queue: {'singles-dev': {...waiting, claimedBy: 'bob'}}}, C, 'write', Q, {uid: 'carl', name: 'Carl', match: 'm3', at: now}, true],
  ['the waiter can leave', {queue: {'singles-dev': waiting}}, A, 'write', Q, null, true],
  ['others cannot clear the queue', {queue: {'singles-dev': waiting}}, B, 'write', Q, null, false],
  ['signed-out visitors cannot read the queue', {queue: {'singles-dev': waiting}}, null, 'read', Q, null, false],
  ['queue entries reject extra fields', {}, A, 'write', Q, {...waiting, extra: 1}, false],
  // Matches
  ['the claimer (p2) creates the match', {}, B, 'write', '/matches/m1', match, true],
  ['nobody creates a match for others', {}, C, 'write', '/matches/m1', match, false],
  ['p1 cannot create the match as p2', {}, A, 'write', '/matches/m1', match, false],
  ['the creator cannot plant the other team', {}, B, 'write', '/matches/m1', {...match, teams: {p1: 'x', p2: 'y'}}, false],
  ['the creator cannot plant choices', {}, B, 'write', '/matches/m1', {...match, choices: {p1: {0: 'move 1'}}}, false],
  ['a match cannot be overwritten', {matches: {m1: match}}, B, 'write', '/matches/m1', {...match, seed: '9,9,9,9'}, false],
  ['p1 brings their own team', {matches: {m1: match}}, A, 'write', '/matches/m1/teams/p1', 'CPV1.abc', true],
  ['p2 cannot write p1\'s team', {matches: {m1: match}}, B, 'write', '/matches/m1/teams/p1', 'CPV1.abc', false],
  ['a team cannot be swapped later', {matches: {m1: {...match, teams: {p1: 'a', p2: 'b'}}}}, B, 'write', '/matches/m1/teams/p2', 'CPV1.new', false],
  ['p1 makes a choice', {matches: {m1: match}}, A, 'write', '/matches/m1/choices/p1/0', 'team 123456', true],
  ['a choice cannot be changed', {matches: {m1: {...match, choices: {p1: {0: 'x'}}}}}, A, 'write', '/matches/m1/choices/p1/0', 'y', false],
  ['nobody chooses for the other side', {matches: {m1: match}}, B, 'write', '/matches/m1/choices/p1/0', 'move 1', false],
  ['no choices after the result', {matches: {m1: {...match, result: {winner: 'p1', reason: 'forfeit', at: now}}}}, A, 'write', '/matches/m1/choices/p1/3', 'move 1', false],
  ['outsiders cannot read a match', {matches: {m1: match}}, C, 'read', '/matches/m1', null, false],
  ['players read their match', {matches: {m1: match}}, A, 'read', '/matches/m1', null, true],
  ['a waiter can watch for a match not made yet', {}, A, 'read', '/matches/m9', null, true],
  ['a result is written once', {matches: {m1: match}}, A, 'write', '/matches/m1/result', {winner: 'p2', reason: 'forfeit', by: 'p1', at: now}, true],
  ['outsiders cannot write a result', {matches: {m1: match}}, C, 'write', '/matches/m1/result', {winner: 'p2', reason: 'forfeit', at: now}, false],
  ['there is no second result', {matches: {m1: {...match, result: {winner: 'p1', reason: 'battle', at: now}}}}, B, 'write', '/matches/m1/result', {winner: 'p2', reason: 'battle', at: now}, false],
  ['a tie is a valid result', {matches: {m1: match}}, B, 'write', '/matches/m1/result', {winner: 'tie', reason: 'sync', at: now}, true],
  ['a player marks themselves online', {matches: {m1: match}}, A, 'write', '/matches/m1/online/p1', true, true],
  ['nobody marks the other player online', {matches: {m1: match}}, A, 'write', '/matches/m1/online/p2', true, false],
  // Presence
  ['a player shows themselves online', {}, A, 'write', '/presence/alice', {name: 'Alice', state: 'idle', at: now}, true],
  ['nobody writes someone else\'s presence', {}, B, 'write', '/presence/alice', {name: 'X', state: 'idle', at: now}, false],
  ['presence states are limited', {}, A, 'write', '/presence/alice', {name: 'Alice', state: 'hacking', at: now}, false],
  ['names are 1-16 characters', {}, A, 'write', '/presence/alice', {name: 'A'.repeat(17), state: 'idle', at: now}, false],
  // Private rooms
  ['a host reserves a code', {}, A, 'write', '/rooms/K7Q2M', room, true],
  ['codes use the room alphabet', {}, A, 'write', '/rooms/k7q2m', room, false],
  ['codes have no 0/O/1/I', {}, A, 'write', '/rooms/K0Q1M', room, false],
  ['a friend claims the room', {rooms: {K7Q2M: room}}, B, 'write', '/rooms/K7Q2M', {...room, claimedBy: 'bob', claimedName: 'Bob'}, true],
  ['a claim cannot change the mode', {rooms: {K7Q2M: room}}, B, 'write', '/rooms/K7Q2M', {...room, mode: 'singles', claimedBy: 'bob'}, false],
  ['a live room cannot be taken over', {rooms: {K7Q2M: room}}, B, 'write', '/rooms/K7Q2M', {...room, uid: 'bob', name: 'Bob'}, false],
  // Challenges
  ['a player sends a challenge', {}, A, 'write', '/invites/bob/alice', invite, true],
  ['nobody sends a challenge in someone else\'s name', {}, C, 'write', '/invites/bob/alice', invite, false],
  ['only the target sees their challenges', {invites: {bob: {alice: invite}}}, C, 'read', '/invites/bob', null, false],
  ['the target sees their challenges', {invites: {bob: {alice: invite}}}, B, 'read', '/invites/bob', null, true],
  ['the sender can see their own challenge', {invites: {bob: {alice: invite}}}, A, 'read', '/invites/bob/alice', null, true],
  ['the sender cannot see other challenges', {invites: {bob: {carl: {...invite, name: 'Carl'}}}}, A, 'read', '/invites/bob/carl', null, false],
  ['the target declines', {invites: {bob: {alice: invite}}}, B, 'write', '/invites/bob/alice', null, true],
  ['the target cannot edit a challenge', {invites: {bob: {alice: invite}}}, B, 'write', '/invites/bob/alice', {...invite, code: 'ZZZZZ'}, false],
  // Records
  ['a player keeps their own record', {}, A, 'write', '/users/alice', {name: 'Alice', wins: 1, losses: 0}, true],
  ['nobody edits someone else\'s record', {}, B, 'write', '/users/alice', {name: 'Alice', wins: 99, losses: 0}, false],
  ['records cannot be read by others', {users: {alice: {name: 'Alice', wins: 3}}}, B, 'read', '/users/alice', null, false],
  ['records reject negative numbers', {}, A, 'write', '/users/alice', {name: 'Alice', wins: -1}, false],
  // Everything else
  ['nothing else can be written', {}, A, 'write', '/anything', {x: 1}, false],
  ['nothing else can be read', {}, A, 'read', '/', null, false],
];

for (const [label, data, auth, op, path, value, want] of cases) {
  test(label, () => {
    const r = allowed(data, auth, op, path, value);
    assert.equal(r.allowed, want, r.info);
  });
}

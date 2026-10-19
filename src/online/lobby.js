// Finding opponents: who's online, Quick Match, private battles with a code,
// and challenges. Works with any backend from ./backend.js.
//
// Quick Match keeps one waiting spot per mode (/queue/<mode>-<version>). A
// player who arrives either claims the waiting player (in a transaction, so two
// people can't claim the same one) or takes the spot and waits. The claimer
// creates the match. Waiting players refresh their spot every few seconds; a
// spot that stops being refreshed is up for grabs.
//
// Players are only matched with others running the same battle engine
// (./version.js), since both browsers must simulate the battle identically.
import {BATTLE_VERSION} from './version.js';

export const QUEUE_CLAIM_MAX_AGE = 40000; // claim waiting players seen in the last 40s
export const QUEUE_TAKEOVER_AGE = 50000; // replace spots not refreshed for 50s (rules allow 45s)
export const QUEUE_HEARTBEAT = 12000;
export const ROOM_CLAIM_MAX_AGE = 110000;
export const ROOM_TAKEOVER_AGE = 130000; // rules allow 120s
export const ROOM_HEARTBEAT = 30000;
export const MATCH_WAIT = 15000; // how long a claimed player waits for the match to appear
export const INVITE_MAX_AGE = 120000; // a challenge nobody answers lapses after 2 minutes

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I

function randomString(chars, n) {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += chars[b % chars.length];
  return s;
}

export const newMatchId = () => randomString(ID_CHARS, 20);
export const newRoomCode = () => randomString(CODE_CHARS, 5);

/** A battle seed in the simulator's format: four 16-bit numbers. */
export function newSeed() {
  const words = new Uint16Array(4);
  globalThis.crypto.getRandomValues(words);
  return [...words].join(',');
}

export function cleanPlayerName(name) {
  return String(name || '').replace(/[|\n\r\t<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

/** "k7q 2m" → "K7Q2M". Returns '' if it can't be a room code. */
export function normalizeCode(text) {
  const code = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === 5 && [...code].every(c => CODE_CHARS.includes(c)) ? code : '';
}

export class LobbyError extends Error {}

/** Turns backend errors into something a player can act on. */
export function friendlyError(err) {
  const code = err?.code || '';
  const text = String(err?.message || err || '');
  if (/operation-not-allowed|admin-restricted/.test(code + text)) {
    return 'Anonymous sign-in is turned off. In the Firebase console: Authentication → Sign-in method → Anonymous → Enable.';
  }
  if (/PERMISSION_DENIED|permission/i.test(code + text)) {
    return 'The database refused. Check that the rules from database.rules.json are published (Realtime Database → Rules).';
  }
  if (/network|offline|unavailable/i.test(code + text)) return 'Lost connection to the server. Check your internet and try again.';
  if (err instanceof LobbyError) return err.message;
  return text || 'Something went wrong.';
}

const VERSION_MISMATCH = "Your friend's page is on a different version of the site. Both of you refresh the page, then make a new code.";

/**
 * Counts a finished battle in a player's record (once) and clears it as their
 * current battle. Safe to call from several places: only the first one counts.
 */
export async function recordResult(b, uid, matchId, side, result) {
  const won = result.winner === side;
  const lost = result.winner !== side && result.winner !== 'tie';
  try {
    await b.transaction(`users/${uid}`, cur => {
      if (!cur || cur.match !== matchId) return undefined;
      const next = {...cur};
      delete next.match;
      if (won) next.wins = (cur.wins || 0) + 1;
      if (lost) next.losses = (cur.losses || 0) + 1;
      return next;
    });
  } catch {
    // The record is a nice-to-have; the battle result itself is saved.
  }
}

export class Lobby {
  /** @param {object} backend @param {{version?: string, inviteMaxAge?: number}} [options] */
  constructor(backend, {version = BATTLE_VERSION, inviteMaxAge = INVITE_MAX_AGE} = {}) {
    this.b = backend;
    this.version = version;
    this.inviteMaxAge = inviteMaxAge;
    this.uid = null;
    this.name = '';
    this.state = 'idle';
    this.task = null; // the current search or hosted room
    this.stopConnection = null;
  }

  async start(name) {
    this.uid = await this.b.connect();
    this.name = cleanPlayerName(name) || `Trainer ${this.uid.slice(0, 4)}`;
    await this.b.update(`users/${this.uid}`, {name: this.name});
    await this.b.removeOnDisconnect(`presence/${this.uid}`);
    await this.setState(this.state);
    // After a dropped connection the server has already removed our presence
    // (that's what removeOnDisconnect does), so put it back.
    let wasOffline = false;
    if (this.stopConnection) this.stopConnection();
    this.stopConnection = this.b.watchConnection(connected => {
      if (!connected) {
        wasOffline = true;
        return;
      }
      if (!wasOffline) return;
      wasOffline = false;
      this.b.removeOnDisconnect(`presence/${this.uid}`)
        .then(() => this.setState(this.state))
        .catch(() => {});
    });
    return this.uid;
  }

  /** Stops listening for reconnects and cancels any search or room. */
  stop() {
    this.cancelTask();
    if (this.stopConnection) this.stopConnection();
    this.stopConnection = null;
  }

  async setName(name) {
    const clean = cleanPlayerName(name);
    if (!clean) throw new LobbyError('Pick a name with at least one letter or number.');
    this.name = clean;
    await this.b.update(`users/${this.uid}`, {name: clean});
    await this.setState(this.state);
  }

  async setState(state) {
    this.state = state;
    if (!this.uid) return;
    await this.b.set(`presence/${this.uid}`, {name: this.name, state, at: this.b.now()});
  }

  /** Like setState, for places that don't wait for it. */
  noteState(state) {
    this.setState(state).catch(() => {});
  }

  /** cb(players): everyone online except you; free players first. */
  watchPlayers(cb, onError) {
    return this.b.watch('presence', all => {
      const list = Object.entries(all || {})
        .filter(([uid]) => uid !== this.uid)
        .map(([uid, p]) => ({uid, name: p.name, state: p.state, at: p.at}))
        .sort((a, b) => (a.state === 'idle' ? 0 : 1) - (b.state === 'idle' ? 0 : 1) || b.at - a.at);
      cb(list);
    }, onError);
  }

  /** cb({wins, losses, match}): your record, and the battle you're in (if any). */
  watchRecord(cb, onError) {
    return this.b.watch(`users/${this.uid}`, rec => cb({wins: rec?.wins || 0, losses: rec?.losses || 0, match: rec?.match || null}), onError);
  }

  /** cb(invites): challenges sent to you that haven't lapsed, newest first. */
  watchInvites(cb, onError) {
    let all = null;
    let timer = null;
    const emit = () => {
      clearTimeout(timer);
      const now = this.b.now();
      const list = Object.entries(all || {})
        .map(([from, inv]) => ({from, ...inv}))
        .filter(inv => now - inv.at < this.inviteMaxAge)
        .sort((a, b) => b.at - a.at);
      // Check again when the oldest one lapses.
      if (list.length) timer = setTimeout(emit, this.inviteMaxAge - (now - list[list.length - 1].at) + 50);
      cb(list);
    };
    const stop = this.b.watch(`invites/${this.uid}`, value => {
      all = value;
      emit();
    }, onError);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }

  /**
   * Looks at the battle your record says you're in. A finished one is counted
   * and cleared. Resolves {id, side, mode, opponent, result} or null if there's
   * nothing to rejoin.
   */
  async checkBattle(matchId) {
    let m = null;
    try {
      m = await this.b.get(`matches/${matchId}`);
    } catch {
      m = null;
    }
    const side = m?.p1?.uid === this.uid ? 'p1' : m?.p2?.uid === this.uid ? 'p2' : null;
    if (!side) {
      // Gone or not ours: just clear it.
      await this.b.transaction(`users/${this.uid}`, cur => {
        if (!cur || cur.match !== matchId) return undefined;
        const next = {...cur};
        delete next.match;
        return next;
      }).catch(() => {});
      return null;
    }
    const info = {id: matchId, side, mode: m.mode, opponent: m[side === 'p1' ? 'p2' : 'p1'].name, result: m.result || null};
    if (m.result) await recordResult(this.b, this.uid, matchId, side, m.result);
    return info;
  }

  /** Gives up a battle without opening it. */
  async forfeitBattle({id, side}) {
    const value = {winner: side === 'p1' ? 'p2' : 'p1', reason: 'forfeit', by: side, at: this.b.now()};
    const res = await this.b.transaction(`matches/${id}/result`, cur => (cur ? undefined : value));
    await recordResult(this.b, this.uid, id, side, res.value || value);
  }

  async createMatch(id, mode, p1, p2, teamCode) {
    await this.b.set(`matches/${id}`, {
      mode, seed: newSeed(), v: this.version, at: this.b.now(), p1, p2, teams: {p2: teamCode},
    });
    await this.b.update(`users/${this.uid}`, {match: id});
  }

  cancelTask() {
    if (this.task) this.task.cancel();
    this.task = null;
  }

  /**
   * Quick Match. Calls onMatch({id, side, mode}) once paired.
   * Returns {cancel()}. onStatus(text) reports progress.
   */
  quickMatch(mode, teamCode, {onMatch, onError, onStatus = () => {}}) {
    this.cancelTask();
    const b = this.b;
    const me = this.uid;
    const path = `queue/${mode}-${this.version}`;
    let cancelled = false;
    let beat = null;
    let stopWatch = null;
    let retry = null;
    const finish = () => {
      cancelled = true;
      clearInterval(beat);
      clearTimeout(retry);
      if (stopWatch) stopWatch();
      stopWatch = null;
    };
    const matched = info => {
      if (cancelled) return;
      finish();
      this.task = null;
      this.noteState('battling');
      onMatch(info);
    };
    const fail = err => {
      if (cancelled) return;
      finish();
      this.task = null;
      this.noteState('idle');
      onError(err);
    };

    const attempt = async () => {
      if (cancelled) return;
      const id = newMatchId();
      const res = await b.transaction(path, cur => {
        const age = cur ? b.now() - cur.at : Infinity;
        if (cur && cur.uid !== me && !cur.claimedBy && age < QUEUE_CLAIM_MAX_AGE) {
          return {...cur, claimedBy: me, claimedName: this.name};
        }
        if (cur && cur.uid === me && !cur.claimedBy) return {...cur, name: this.name, at: b.now()};
        if (!cur || cur.claimedBy || age > QUEUE_TAKEOVER_AGE) return {uid: me, name: this.name, match: id, at: b.now()};
        return undefined; // someone is waiting but might be gone: look again shortly
      });
      if (cancelled) {
        if (res.committed && res.value?.uid === me && !res.value.claimedBy) await b.transaction(path, cur => (cur && cur.uid === me && !cur.claimedBy ? null : undefined));
        return;
      }
      if (!res.committed) {
        retry = setTimeout(() => attempt().catch(fail), 3000);
        return;
      }
      const spot = res.value;
      if (spot.claimedBy === me) {
        onStatus(`Found ${spot.name}!`);
        await this.createMatch(spot.match, mode, {uid: spot.uid, name: spot.name}, {uid: me, name: this.name}, teamCode);
        matched({id: spot.match, side: 'p2', mode});
        return;
      }
      // We're the one waiting.
      onStatus('Waiting for an opponent…');
      if (stopWatch) stopWatch();
      stopWatch = b.watch(`matches/${spot.match}`, m => {
        if (m && m.p1 && m.p1.uid === me) matched({id: spot.match, side: 'p1', mode});
      }, fail);
      clearInterval(beat);
      let lostAt = null;
      beat = setInterval(async () => {
        try {
          const r = await b.transaction(path, cur => (cur && cur.uid === me && !cur.claimedBy && cur.match === spot.match ? {...cur, at: b.now()} : undefined));
          if (cancelled || r.committed) return;
          // The spot isn't ours any more: someone claimed us (a match is coming) or it was taken over.
          lostAt = lostAt || Date.now();
          if (Date.now() - lostAt > MATCH_WAIT) {
            lostAt = null;
            clearInterval(beat);
            if (stopWatch) stopWatch();
            stopWatch = null;
            onStatus('Looking again…');
            await attempt();
          }
        } catch (err) {
          fail(err);
        }
      }, QUEUE_HEARTBEAT);
    };

    const task = {
      kind: 'search',
      mode,
      startedAt: Date.now(),
      cancel: async () => {
        if (cancelled) return;
        finish();
        if (this.task === task) this.task = null;
        this.noteState('idle');
        try {
          await b.transaction(path, cur => (cur && cur.uid === me && !cur.claimedBy ? null : undefined));
        } catch {
          // Leaving the queue failed: the spot goes stale on its own.
        }
      },
    };
    this.task = task;
    this.noteState('searching');
    onStatus('Looking for an opponent…');
    attempt().catch(fail);
    return task;
  }

  /** Private battle: reserves a code and waits for a friend. Returns {code, cancel()}. */
  async hostRoom(mode, teamCode, {onMatch, onError}) {
    this.cancelTask();
    const b = this.b;
    const me = this.uid;
    let spot = null;
    let code = '';
    for (let tries = 0; tries < 6 && !spot; tries++) {
      code = newRoomCode();
      const id = newMatchId();
      const res = await b.transaction(`rooms/${code}`, cur => {
        const age = cur ? b.now() - cur.at : Infinity;
        if (!cur || cur.claimedBy || age > ROOM_TAKEOVER_AGE) return {uid: me, name: this.name, mode, match: id, v: this.version, at: b.now()};
        return undefined;
      });
      if (res.committed) spot = res.value;
    }
    if (!spot) throw new LobbyError("Couldn't make a battle code. Try again.");
    const hooks = [];
    const task = {
      kind: 'room',
      code,
      mode,
      invited: new Set(),
      startedAt: Date.now(),
      done: false,
      /** Runs fn when the room closes (matched or cancelled), or now if it already has. */
      onClose: fn => (task.done ? fn() : hooks.push(fn)),
      cancel: async () => {
        if (task.done) return;
        cleanup();
        if (this.task === task) this.task = null;
        this.noteState('idle');
        await Promise.allSettled([
          b.transaction(`rooms/${code}`, cur => (cur && cur.uid === me && !cur.claimedBy ? null : undefined)),
          ...[...task.invited].map(to => b.remove(`invites/${to}/${me}`)),
        ]);
      },
    };
    const cleanup = () => {
      task.done = true;
      stop();
      clearInterval(beat);
      for (const fn of hooks.splice(0)) fn();
    };
    const stop = b.watch(`matches/${spot.match}`, m => {
      if (task.done || !m || !m.p1 || m.p1.uid !== me) return;
      cleanup();
      if (this.task === task) this.task = null;
      this.noteState('battling');
      onMatch({id: spot.match, side: 'p1', mode});
    }, err => {
      if (task.done) return;
      cleanup();
      if (this.task === task) this.task = null;
      this.noteState('idle');
      onError(err);
    });
    const beat = setInterval(() => {
      b.transaction(`rooms/${code}`, cur => (cur && cur.uid === me && !cur.claimedBy ? {...cur, at: b.now()} : undefined)).catch(() => {});
    }, ROOM_HEARTBEAT);
    this.task = task;
    this.noteState('hosting');
    return task;
  }

  /** Joins a friend's private battle. Resolves {id, side: 'p2', mode}. */
  async joinRoom(codeText, teamCode) {
    const code = normalizeCode(codeText);
    if (!code) throw new LobbyError('Battle codes are 5 letters and numbers, like K7Q2M.');
    const b = this.b;
    const me = this.uid;
    const res = await b.transaction(`rooms/${code}`, cur => {
      if (cur && cur.uid !== me && !cur.claimedBy && cur.v === this.version && b.now() - cur.at < ROOM_CLAIM_MAX_AGE) {
        return {...cur, claimedBy: me, claimedName: this.name};
      }
      return undefined;
    });
    if (!res.committed) {
      const room = res.value;
      if (!room) throw new LobbyError(`There's no battle with the code ${code}. Check it with your friend.`);
      if (room.uid === me) throw new LobbyError("That's your own code. Send it to a friend so they can join.");
      if (room.claimedBy) throw new LobbyError('Someone already joined that battle.');
      if (room.v !== this.version) throw new LobbyError(VERSION_MISMATCH);
      throw new LobbyError('That code has expired. Ask your friend for a new one.');
    }
    const room = res.value;
    this.cancelTask();
    await this.createMatch(room.match, room.mode, {uid: room.uid, name: room.name}, {uid: me, name: this.name}, teamCode);
    this.noteState('battling');
    // Clear the host's challenge to us, if they sent one.
    b.remove(`invites/${me}/${room.uid}`).catch(() => {});
    return {id: room.match, side: 'p2', mode: room.mode};
  }

  /**
   * Challenges another online player: hosts a room and sends them its code.
   * onDeclined(reason) runs if they say no ('declined') or don't answer ('expired').
   */
  async challenge(toUid, mode, teamCode, {onMatch, onError, onDeclined = () => {}}) {
    const task = await this.hostRoom(mode, teamCode, {onMatch, onError});
    const path = `invites/${toUid}/${this.uid}`;
    try {
      await this.b.set(path, {name: this.name, mode, code: task.code, at: this.b.now()});
    } catch (err) {
      await task.cancel();
      throw err;
    }
    task.invited.add(toUid);
    task.challenged = toUid;
    const end = async reason => {
      if (task.done) return;
      await task.cancel();
      onDeclined(reason);
    };
    // When they accept, the match appears (and the room closes) before the
    // challenge is cleared, so a cleared challenge with no match means "no".
    let seen = false;
    let wait = null;
    const stop = this.b.watch(path, inv => {
      if (inv) seen = true;
      else if (seen && !wait) wait = setTimeout(() => end('declined'), 1500);
    }, () => {});
    const lapse = setTimeout(() => end('expired'), this.inviteMaxAge);
    task.onClose(() => {
      stop();
      clearTimeout(wait);
      clearTimeout(lapse);
    });
    return task;
  }

  declineInvite(fromUid) {
    return this.b.remove(`invites/${this.uid}/${fromUid}`);
  }
}

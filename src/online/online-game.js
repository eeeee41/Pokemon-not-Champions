// One online battle, seen from one player's browser.
//
// Lockstep: both browsers build the same Match from the same seed and teams,
// then apply the same choices. Each player writes only their own choices to
// /matches/<id>/choices/<side>/<n>; both browsers read both lists and apply
// them in order. Reloading the page rebuilds the battle by replaying the
// saved choices, which is how rejoining works.
//
// Has the same shape as LocalGame (phase, trackers, stage, logs, submit, ...)
// so the battle screen can show either.
import {Match} from '../engine/match.js';
import {Tracker} from '../client/tracker.js';
import {formatEntries} from '../ui/local-game.js';
import {decodeTeam} from '../engine/savecode.js';
import {validateTeam} from '../engine/team.js';
import {randomChoice} from '../engine/choices.js';
import {friendlyError, recordResult} from './lobby.js';
import {BATTLE_VERSION} from './version.js';

export const TURN_MS = 90000; // your time to choose; then a random legal move is made for you
// Waiting this long for the opponent lets you claim the win. Longer than their
// turn timer plus the time they may spend watching the turn play out.
export const CLAIM_MS = 150000;
export const NO_SHOW_MS = 25000;
const SIDES = ['p1', 'p2'];

export class OnlineGame {
  /**
   * @param {{backend: object, matchId: string, side: 'p1'|'p2', teamCode?: string,
   *   turnMs?: number, claimMs?: number, noShowMs?: number, version?: string}} opts
   */
  constructor({backend, matchId, side, teamCode, turnMs = TURN_MS, claimMs = CLAIM_MS, noShowMs = NO_SHOW_MS, version = BATTLE_VERSION}) {
    this.turnMs = turnMs;
    this.claimMs = claimMs;
    this.noShowMs = noShowMs;
    this.version = version;
    this.online = true;
    this.b = backend;
    this.id = matchId;
    this.side = side;
    this.oppSide = side === 'p1' ? 'p2' : 'p1';
    this.me = side === 'p1' ? 0 : 1;
    this.opp = 1 - this.me;
    this.teamCode = teamCode || null;
    this.stagePerspective = side;
    this.listeners = new Set();
    this.reset();
  }

  reset() {
    for (const stop of this.stops || []) stop();
    clearTimeout(this.timer);
    clearTimeout(this.noShowTimer);
    this.stops = [];
    this.phase = {type: 'loading', text: 'Connecting to the battle…'};
    this.header = null;
    this.mode = null;
    this.match = null;
    this.players = null;
    this.trackers = [new Tracker('p1'), new Tracker('p2')];
    this.stage = new Tracker(this.side);
    this.logs = [[], []];
    this.stageLog = [];
    this.lastText = '';
    this.fedMine = 0;
    this.fedStage = 0;
    this.pending = [[], []];
    this.applied = [0, 0];
    this.result = null;
    this.recorded = false;
    this.opponentOnline = true;
    this.error = null;
    this.errorKind = null;
    this.deadline = null;
    this.timer = null;
    this.disposed = false;
    this.building = false;
    this.autoMoved = false;
    this.broken = false;
    this.syncNote = '';
    this.teamCodes = null;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn();
  }

  path(rest = '') {
    return `matches/${this.id}${rest ? `/${rest}` : ''}`;
  }

  async start() {
    try {
      const header = await this.b.get(this.path());
      if (!header) throw new Error("That battle doesn't exist any more.");
      this.header = header;
      this.mode = header.mode;
      this.opponentName = header[this.oppSide]?.name || 'Opponent';
      this.opponentUid = header[this.oppSide]?.uid || null;
      if (header.v && header.v !== this.version) {
        // Started on another version of the site: this page can't replay it.
        if (header.result) {
          this.onResult(header.result);
          return;
        }
        this.errorKind = 'outdated';
        this.fail('The site was updated after this battle started, so this page can\'t continue it. ' +
          'You can forfeit it, or leave and your opponent can claim the win.');
        return;
      }
      if (!header.teams?.[this.side]) {
        if (!this.teamCode) throw new Error('Your team for this battle is missing.');
        await this.b.set(this.path(`teams/${this.side}`), this.teamCode);
      }
      await this.b.update(`users/${this.b.uid}`, {match: this.id});
      const flag = this.path(`online/${this.side}`);
      await this.b.removeOnDisconnect(flag);
      await this.b.set(flag, true);
      // A dropped connection clears the flag on the server; put it back after.
      let wasOffline = false;
      this.stops.push(this.b.watchConnection(connected => {
        if (!connected) {
          wasOffline = true;
          return;
        }
        if (!wasOffline || this.disposed) return;
        wasOffline = false;
        this.b.removeOnDisconnect(flag).then(() => this.b.set(flag, true)).catch(() => {});
      }));
      const onError = err => this.fail(friendlyError(err));
      this.stops.push(this.b.watch(this.path('online'), v => {
        this.opponentOnline = !!(v && v[this.oppSide]);
        this.emit();
      }, onError));
      this.stops.push(this.b.watch(this.path('result'), r => {
        if (r) this.onResult(r);
      }, onError));
      this.stops.push(this.b.watch(this.path('teams'), t => {
        this.onTeams(t).catch(err => this.fail(friendlyError(err)));
      }, onError));
      this.phase = {type: 'loading', text: `Waiting for ${this.opponentName} to bring their team…`};
      this.noShowTimer = setTimeout(() => {
        if (!this.match && !this.result) {
          this.writeResult({winner: 'tie', reason: 'noshow'});
        }
      }, this.noShowMs);
      this.emit();
    } catch (err) {
      this.fail(friendlyError(err));
    }
  }

  async onTeams(teams) {
    if (this.match || this.building || !teams?.p1 || !teams?.p2) return;
    this.building = true;
    clearTimeout(this.noShowTimer);
    const decoded = [];
    for (const [i, side] of SIDES.entries()) {
      let team = null;
      try {
        team = decodeTeam(teams[side]);
      } catch {
        team = null;
      }
      if (!team || !validateTeam(team, {creator: true}).ok) {
        if (i === this.opp) {
          await this.writeResult({winner: this.side, reason: 'illegal'});
          return;
        }
        this.fail("Your team isn't legal for this battle.");
        return;
      }
      decoded.push(team);
    }
    const n1 = this.header.p1.name || 'Player 1';
    let n2 = this.header.p2.name || 'Player 2';
    if (n2 === n1) n2 = `${n2} (2)`;
    this.players = [
      {name: n1, team: decoded[0], uid: this.header.p1.uid},
      {name: n2, team: decoded[1], uid: this.header.p2.uid},
    ];
    this.teamCodes = {p1: teams.p1, p2: teams.p2};
    this.match = new Match({mode: this.mode, seed: this.header.seed, players: this.players});

    // Everything chosen so far (when rejoining), applied in one go...
    const existing = await this.b.get(this.path('choices'));
    for (const [i, side] of SIDES.entries()) {
      for (const [k, v] of Object.entries(existing?.[side] || {})) this.pending[i][Number(k)] = v;
    }
    const rejoining = this.pending[0].length + this.pending[1].length > 0;
    this.pump(false);
    this.feed();
    // ...shown at once rather than replayed. A fresh battle replays from the start.
    if (rejoining) this.skipStage();
    else this.stepSetup();
    // Then live.
    for (const [i, side] of SIDES.entries()) {
      this.stops.push(this.b.watchChildren(this.path(`choices/${side}`), (k, v) => {
        this.pending[i][Number(k)] = v;
        this.pump(true);
      }, err => this.fail(friendlyError(err))));
    }
    this.advance();
  }

  stepSetup() {
    const lines = this.match.views[this.side];
    while (this.fedStage < lines.length && !lines[this.fedStage].startsWith('|start')) this.stepStage();
  }

  /** Applies every pending choice the battle is ready for, in order. */
  pump(live) {
    if (!this.match || this.error || this.broken) return;
    if (this.result && this.result.reason !== 'battle') return;
    let changed = false;
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const i of [0, 1]) {
        const choice = this.pending[i][this.applied[i]];
        if (choice === undefined || !this.match.needsChoice(i)) continue;
        if (!this.match.choose(i, choice)) {
          this.desync(i, choice);
          return;
        }
        this.applied[i]++;
        progressed = changed = true;
      }
    }
    if (changed && live) {
      this.feed();
      this.advance();
    }
    if (this.match.ended && !this.result) this.reportEnd();
  }

  /**
   * A saved choice doesn't fit the battle in this browser: a bug, or a
   * tampered page on the other side. Nobody can play on, so it's a tie.
   */
  desync(i, choice) {
    if (this.broken) return;
    this.broken = true;
    this.syncNote = `${SIDES[i]} chose "${choice}": ${this.match.errors[i] || 'not allowed'}`;
    clearTimeout(this.timer);
    this.writeResult({winner: 'tie', reason: 'sync'});
    this.advance();
  }

  feed() {
    const lines = this.match.views[this.side];
    const tracker = this.trackers[this.me];
    while (this.fedMine < lines.length) {
      const r = tracker.step(lines[this.fedMine++]);
      if (r.text) this.logs[this.me].push(...formatEntries(r.text));
    }
    const request = this.match.requests[this.me];
    if (this.match.needsChoice(this.me) && !request.teamPreview) tracker.setRequest(request);
  }

  pendingStage() {
    return this.match ? this.match.views[this.side].length - this.fedStage : 0;
  }

  stepStage() {
    if (!this.match) return null;
    const lines = this.match.views[this.side];
    if (this.fedStage >= lines.length) return null;
    const r = this.stage.step(lines[this.fedStage++]);
    if (r.text) {
      const entries = formatEntries(r.text);
      this.stageLog.push(...entries);
      const major = entries.filter(e => e.kind !== 'turn').pop();
      if (major) this.lastText = major.html;
    }
    return r;
  }

  skipStage() {
    while (this.stepStage());
  }

  advance() {
    if (this.disposed) return;
    if (this.error) {
      this.phase = {type: 'error', text: this.error, kind: this.errorKind};
    } else if (!this.match) {
      if (this.result) this.phase = this.overPhase();
      // otherwise keep the loading text
    } else if (this.broken && !this.result) {
      this.phase = {type: 'loading', text: 'The battle got out of sync. Ending it…'};
    } else if (this.pendingStage() > 0) {
      this.phase = {type: 'playback'};
    } else if (this.result || this.match.ended) {
      this.phase = this.overPhase();
    } else if (this.match.needsChoice(this.me)) {
      this.phase = {type: 'choose', player: this.me};
      this.arm('me');
    } else {
      this.phase = {type: 'waiting', player: this.opp};
      this.arm('opp');
    }
    if (this.phase.type !== 'choose' && this.phase.type !== 'waiting') {
      clearTimeout(this.timer);
      this.deadline = null;
    }
    this.emit();
  }

  overPhase() {
    const r = this.result;
    let winner = null;
    if (r) winner = r.winner === 'p1' ? 0 : r.winner === 'p2' ? 1 : null;
    else if (this.match) winner = this.match.winnerIndex;
    return {type: 'over', winner, reason: r ? r.reason : 'battle'};
  }

  arm(who) {
    const key = `${who}:${this.applied[0]}:${this.applied[1]}`;
    if (this.deadline && this.deadline.key === key) return;
    clearTimeout(this.timer);
    const ms = who === 'me' ? this.turnMs : this.claimMs;
    this.deadline = {who, key, at: Date.now() + ms};
    this.timer = setTimeout(() => (who === 'me' ? this.autoMove(key) : this.emit()), ms);
  }

  /** Milliseconds left on the current clock (yours, or the opponent's). */
  timeLeft() {
    return this.deadline ? Math.max(0, this.deadline.at - Date.now()) : null;
  }

  canClaimWin() {
    return this.phase.type === 'waiting' && this.deadline?.who === 'opp' && this.timeLeft() === 0 && !this.result;
  }

  autoMove(key) {
    if (this.deadline?.key !== key || this.phase.type !== 'choose' || this.result) return;
    const choice = randomChoice(this.match.requests[this.me], Math.random, {gimmicks: false});
    if (choice) this.submit(this.me, choice, true);
  }

  /** Returns an error message, or null if the choice went through. */
  submit(i, choice, auto = false) {
    if (i !== this.me) return 'You can only choose for your own side.';
    if (this.result || !this.match || this.broken) return 'This battle is over.';
    const n = this.applied[i];
    if (!this.match.choose(i, choice)) {
      this.emit();
      return this.match.errors[i] || 'That choice is not allowed.';
    }
    this.applied[i]++;
    this.pending[i][n] = choice;
    this.autoMoved = auto;
    this.b.set(this.path(`choices/${this.side}/${n}`), choice).catch(err => {
      if (!this.result) this.fail(`Your move couldn't be sent. ${friendlyError(err)}`);
    });
    this.feed();
    this.pump(true);
    this.advance();
    return null;
  }

  /** Saves the result unless one is already saved. Resolves to the saved result (or null). */
  async writeResult(result) {
    const value = {...result, at: this.b.now()};
    try {
      const res = await this.b.transaction(this.path('result'), cur => (cur ? undefined : value));
      return res.value;
    } catch (err) {
      this.fail(friendlyError(err));
      return null;
    }
  }

  reportEnd() {
    const w = this.match.winnerIndex;
    this.writeResult({winner: w === null ? 'tie' : SIDES[w], reason: 'battle'});
  }

  async forfeit(i) {
    if (i !== this.me || this.result) return;
    const r = await this.writeResult({winner: this.oppSide, reason: 'forfeit', by: this.side});
    if (r) this.onResult(r);
  }

  async claimWin() {
    if (!this.canClaimWin()) return;
    const r = await this.writeResult({winner: this.side, reason: 'timeout', by: this.oppSide});
    if (r) this.onResult(r);
  }

  onResult(r) {
    if (this.result || this.disposed) return;
    this.result = r;
    // The result is final, so any earlier trouble no longer matters.
    this.error = null;
    this.errorKind = null;
    clearTimeout(this.timer);
    clearTimeout(this.noShowTimer);
    if (this.match && !this.match.ended && r.reason !== 'battle') {
      const loser = r.winner === 'p1' ? 1 : r.winner === 'p2' ? 0 : null;
      if (loser !== null) this.match.forfeit(loser);
      this.feed();
    }
    this.record(r);
    this.advance();
  }

  async record(r) {
    if (this.recorded) return;
    this.recorded = true;
    await recordResult(this.b, this.b.uid, this.id, this.side, r);
  }

  fail(message) {
    if (this.error || this.disposed) return;
    this.error = message;
    clearTimeout(this.timer);
    clearTimeout(this.noShowTimer);
    this.advance();
  }

  /** Rebuilds the battle from what's saved online (the fix for "out of sync"). */
  async reload() {
    this.reset();
    this.emit();
    await this.start();
  }

  dispose() {
    this.disposed = true;
    for (const stop of this.stops) stop();
    this.stops = [];
    clearTimeout(this.timer);
    clearTimeout(this.noShowTimer);
    this.b.remove(this.path(`online/${this.side}`)).catch(() => {});
  }
}

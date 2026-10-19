// A Singles battle against a computer rival on this device. Same shape as
// LocalGame (phase, trackers, stage, logs, submit, ...) for the battle screen.
//
// The bot starts thinking as soon as a turn begins, from a snapshot taken
// before you choose, so it never sees your choice.
import {Match} from '../engine/match.js';
import {Tracker} from '../client/tracker.js';
import {Bot, snapshot, LEVELS} from '../engine/bot.js';
import {formatEntries} from './local-game.js';

const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
const escape = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
const MIN_THINK_MS = 450; // so a bot's turn doesn't feel instant

export class BotGame {
  /**
   * @param {{rival: object, level: string, team: object, rivalTeam: object, playerName?: string}} opts
   */
  constructor({rival, level, team, rivalTeam, playerName = 'You'}) {
    this.bot = {rival, level, levelLabel: LEVELS[level]?.label || level};
    this.mode = 'singles';
    this.me = 0;
    this.opp = 1;
    this.stagePerspective = 'p1';
    this.players = [
      {name: playerName, team: JSON.parse(JSON.stringify(team))},
      {name: rival.name === playerName ? `${rival.name} (rival)` : rival.name, team: JSON.parse(JSON.stringify(rivalTeam))},
    ];
    this.match = new Match({mode: 'singles', players: this.players});
    this.ai = new Bot({side: 1, level});
    this.trackers = [new Tracker('p1'), new Tracker('p2')];
    this.stage = new Tracker('p1');
    this.logs = [[], []];
    this.stageLog = [];
    this.lastText = '';
    this.fed = 0;
    this.fedStage = 0;
    this.listeners = new Set();
    this.thinking = null; // {key, promise, choice}
    this.disposed = false;
    const hello = {kind: 'major', html: `<strong>${escape(rival.name)}:</strong> “${escape(rival.line)}”`};
    this.logs[0].push(hello);
    this.stageLog.push(hello);
    this.feed();
    const lines = this.match.views.p1;
    while (this.fedStage < lines.length && !lines[this.fedStage].startsWith('|start')) this.stepStage();
    this.advance();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn();
  }

  feed() {
    const lines = this.match.views.p1;
    while (this.fed < lines.length) {
      const r = this.trackers[0].step(lines[this.fed++]);
      if (r.text) this.logs[0].push(...formatEntries(r.text));
    }
    const request = this.match.requests[0];
    if (this.match.needsChoice(0) && !request.teamPreview) this.trackers[0].setRequest(request);
  }

  pendingStage() {
    return this.match.views.p1.length - this.fedStage;
  }

  stepStage() {
    const lines = this.match.views.p1;
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

  /** Starts the bot on this decision, once. */
  think() {
    if (!this.match.needsChoice(1)) return;
    const key = `${this.match.choiceLog[1].length}:${this.match.requests[1]?.rqid}`;
    if (this.thinking?.key === key) return;
    const json = snapshot(this.match.battle);
    const requests = [...this.match.requests];
    const started = Date.now();
    const entry = {key, choice: null, done: false};
    this.thinking = entry;
    entry.promise = this.ai.choose(json, requests)
      .catch(() => null)
      .then(async choice => {
        const wait = MIN_THINK_MS - (Date.now() - started);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        entry.choice = choice;
        entry.done = true;
        if (!this.disposed && this.thinking === entry) this.botReady();
      });
  }

  botReady() {
    const entry = this.thinking;
    if (!entry || !this.match.needsChoice(1)) return;
    // Wait for the player's choice first if they're still deciding (so the turn resolves together).
    if (this.match.needsChoice(0)) return;
    this.thinking = null;
    let ok = entry.choice && this.match.choose(1, entry.choice);
    if (!ok) {
      // Shouldn't happen; fall back to the simplest legal option.
      const req = this.match.requests[1];
      const fallback = req?.forceSwitch ? `switch ${req.side.pokemon.findIndex(p => !p.active && !/fnt/.test(p.condition)) + 1}` : 'move 1';
      ok = this.match.choose(1, fallback) || this.match.choose(1, 'default');
    }
    this.feed();
    this.advance();
  }

  advance() {
    if (this.disposed) return;
    if (this.pendingStage() > 0) {
      this.phase = {type: 'playback'};
    } else if (this.match.ended) {
      this.phase = {type: 'over', winner: this.match.winnerIndex};
    } else if (this.match.needsChoice(0)) {
      this.think(); // decide in parallel with the player
      this.phase = {type: 'choose', player: 0};
    } else if (this.match.needsChoice(1)) {
      this.think();
      this.phase = {type: 'thinking', player: 1};
      if (this.thinking?.done) queueMicrotask(() => this.botReady());
    } else {
      this.phase = {type: 'over', winner: null};
    }
    this.emit();
  }

  /** Returns an error message, or null if the choice went through. */
  submit(i, choice) {
    if (i !== 0) return 'You can only choose for your own side.';
    if (!this.match.choose(0, choice)) {
      this.emit();
      return this.match.errors[0] || 'That choice is not allowed.';
    }
    this.feed();
    if (this.thinking?.done) {
      this.botReady();
    } else {
      this.advance();
    }
    return null;
  }

  forfeit(i) {
    if (i !== 0) return;
    this.thinking = null;
    this.match.forfeit(0);
    this.feed();
    this.skipStage();
    this.advance();
  }

  dispose() {
    this.disposed = true;
    this.thinking = null;
  }
}

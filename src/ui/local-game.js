// Two players on one device. Owns the Match, what each player knows (Trackers),
// and the shared "stage" that replays each turn for both players to watch.
import {Match} from '../engine/match.js';
import {Tracker} from '../client/tracker.js';

const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
const escape = s => s.replace(/[&<>"']/g, c => ESC[c]);

/** Turns @pkmn/view's battle text into log entries. */
export function formatEntries(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    if (/fallen\d/.test(raw)) continue; // internal counter for Supreme Overlord
    let line = raw;
    // ||exact||percent|| HP markup: show the percentage.
    line = line.replace(/\|\|([^|]*)\|\|([^|]*)\|\|/g, (_, exact, pct) => pct);
    let kind = 'major';
    if (/^== Turn \d+ ==$/.test(line.trim())) kind = 'turn';
    else if (line.startsWith('[')) kind = 'ability';
    else if (line.startsWith('  ')) kind = 'minor';
    let html = escape(line.trim());
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (kind === 'turn') html = html.replace(/^== (Turn \d+) ==$/, '$1');
    out.push({kind, html});
  }
  return out;
}

export class LocalGame {
  /**
   * @param {{mode: 'singles'|'doubles', players: {name: string, team: object}[], hideChoices: boolean}} opts
   */
  constructor({mode, players, hideChoices}) {
    this.mode = mode;
    this.players = players;
    this.hideChoices = hideChoices;
    this.match = new Match({mode, players});
    this.trackers = [new Tracker('p1'), new Tracker('p2')];
    this.stage = new Tracker('p1');
    this.logs = [[], []];
    this.stageLog = [];
    this.lastText = '';
    this.fed = {p1: 0, p2: 0, spectator: 0};
    this.listeners = new Set();
    this.phase = {type: 'pass', player: 0};
    this.feedPlayers();
    // Setup lines (rules, team preview) appear at once; the battle itself is replayed.
    const spectator = this.match.views.spectator;
    while (this.fed.spectator < spectator.length && !spectator[this.fed.spectator].startsWith('|start')) this.stepStage();
    this.advance();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn();
  }

  feedPlayers() {
    for (const [i, side] of ['p1', 'p2'].entries()) {
      const lines = this.match.views[side];
      while (this.fed[side] < lines.length) {
        const r = this.trackers[i].step(lines[this.fed[side]++]);
        if (r.text) this.logs[i].push(...formatEntries(r.text));
      }
      const request = this.match.requests[i];
      if (this.match.needsChoice(i) && !request.teamPreview) this.trackers[i].setRequest(request);
    }
  }

  pendingStage() {
    return this.match.views.spectator.length - this.fed.spectator;
  }

  /** Replays one more line on the shared stage. Returns the parsed line, or null when caught up. */
  stepStage() {
    const lines = this.match.views.spectator;
    if (this.fed.spectator >= lines.length) return null;
    const r = this.stage.step(lines[this.fed.spectator++]);
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
    if (this.pendingStage() > 0) {
      this.phase = {type: 'playback'};
    } else if (this.match.ended) {
      this.phase = {type: 'over', winner: this.match.winnerIndex};
    } else {
      const who = [0, 1].find(i => this.match.needsChoice(i));
      if (who === undefined) this.phase = {type: 'over', winner: null};
      else this.phase = this.hideChoices ? {type: 'pass', player: who} : {type: 'choose', player: who};
    }
    this.emit();
  }

  reveal() {
    if (this.phase.type === 'pass') {
      this.phase = {type: 'choose', player: this.phase.player};
      this.emit();
    }
  }

  /** Returns an error message, or null if the choice went through. */
  submit(i, choice) {
    const ok = this.match.choose(i, choice);
    if (!ok) {
      this.emit();
      return this.match.errors[i] || 'That choice is not allowed.';
    }
    this.feedPlayers();
    this.advance();
    return null;
  }

  forfeit(i) {
    this.match.forfeit(i);
    this.feedPlayers();
    this.skipStage();
    this.advance();
  }
}

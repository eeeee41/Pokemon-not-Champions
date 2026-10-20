// Online play for this page: signs in, keeps the lobby (who's online, your
// record, challenges sent to you), runs one search or private room at a time,
// and tells the app when a battle is ready. The Online page and the app's
// challenge banner both read its state.
import {createBackend} from '../online/backend.js';
import {Lobby, friendlyError} from '../online/lobby.js';
import {encodeTeam} from '../engine/savecode.js';

const codeFor = team => (typeof team === 'string' ? team : encodeTeam(team));

export class OnlineSession {
  /** @param {{createBackend?: () => Promise<object|null>}} [options] */
  constructor({createBackend: make = createBackend} = {}) {
    this.make = make;
    this.state = {
      status: 'off', // off | connecting | ready | unavailable | error
      error: '',
      connected: true,
      uid: null,
      name: '',
      players: [],
      record: {wins: 0, losses: 0, match: null},
      invites: [],
      task: null, // {kind: 'search' | 'room' | 'challenge', mode, code?, to?, toName?, status?, startedAt}
      taskError: '',
      notice: '', // one line of news: a declined challenge, a battle that ended while you were away
      rejoin: null, // {id, side, mode, opponent}: a battle you left before it ended
      busy: false,
    };
    this.listeners = new Set();
    this.backend = null;
    this.lobby = null;
    this.onMatch = null; // set by the app: info => open the battle
    this.currentMatch = null; // the battle open on this page, so it isn't offered as a rejoin
    this.checked = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  set(patch) {
    this.state = {...this.state, ...patch};
    for (const fn of this.listeners) fn(this.state);
  }

  get ready() {
    return this.state.status === 'ready';
  }

  async connect(name) {
    if (this.state.status === 'connecting' || this.state.status === 'ready') return;
    this.set({status: 'connecting', error: ''});
    try {
      if (!this.backend) this.backend = await this.make();
      if (!this.backend) {
        this.set({status: 'unavailable'});
        return;
      }
      if (!this.lobby) this.lobby = new Lobby(this.backend);
      const lobby = this.lobby;
      await lobby.start(name);
      if (!this.watching) {
        this.watching = true;
        const fail = err => this.set({error: friendlyError(err)});
        lobby.watchPlayers(players => this.set({players}), fail);
        lobby.watchRecord(record => {
          this.set({record});
          this.checkRejoin(record);
        }, fail);
        lobby.watchInvites(invites => this.set({invites}), fail);
        this.backend.watchConnection(connected => this.set({connected}));
      }
      this.set({status: 'ready', uid: lobby.uid, name: lobby.name, error: ''});
    } catch (err) {
      this.set({status: 'error', error: friendlyError(err)});
    }
  }

  async setName(name) {
    if (!this.ready) return;
    try {
      await this.lobby.setName(name);
      this.set({name: this.lobby.name, taskError: ''});
    } catch (err) {
      this.set({taskError: friendlyError(err)});
    }
  }

  dismissNotice() {
    this.set({notice: ''});
  }

  // ---- finding a battle ----

  matched(info, teamCode) {
    this.set({task: null, taskError: '', rejoin: null});
    this.currentMatch = info.id;
    this.lobby.noteState('battling');
    if (this.onMatch) this.onMatch({...info, teamCode});
  }

  failed(err) {
    this.set({task: null, taskError: friendlyError(err)});
  }

  /** The team's save code, or null (with the reason shown) if it can't be made. */
  teamCode(team) {
    try {
      return codeFor(team);
    } catch (err) {
      console.error('Could not make a save code for this team', err);
      this.set({taskError: "This team couldn't be sent. Try another team, or edit this one and try again."});
      return null;
    }
  }

  quickMatch(mode, team) {
    if (!this.ready) return;
    const teamCode = this.teamCode(team);
    if (!teamCode) return;
    this.set({taskError: '', notice: ''});
    const handle = this.lobby.quickMatch(mode, teamCode, {
      onMatch: info => this.matched(info, teamCode),
      onError: err => this.failed(err),
      onStatus: status => {
        if (this.state.task?.kind === 'search') this.set({task: {...this.state.task, status}});
      },
    });
    this.set({task: {kind: 'search', mode, status: 'Looking for an opponent…', startedAt: Date.now(), handle}});
  }

  async hostRoom(mode, team) {
    if (!this.ready || this.state.busy) return;
    const teamCode = this.teamCode(team);
    if (!teamCode) return;
    this.set({busy: true, taskError: '', notice: ''});
    try {
      const handle = await this.lobby.hostRoom(mode, teamCode, {
        onMatch: info => this.matched(info, teamCode),
        onError: err => this.failed(err),
      });
      this.set({task: {kind: 'room', mode, code: handle.code, startedAt: Date.now(), handle}});
    } catch (err) {
      this.failed(err);
    } finally {
      this.set({busy: false});
    }
  }

  async joinRoom(text, team) {
    if (!this.ready || this.state.busy) return false;
    const teamCode = this.teamCode(team);
    if (!teamCode) return false;
    this.set({busy: true, taskError: '', notice: ''});
    try {
      const info = await this.lobby.joinRoom(text, teamCode);
      this.matched(info, teamCode);
      return true;
    } catch (err) {
      this.set({taskError: friendlyError(err)});
      return false;
    } finally {
      this.set({busy: false});
    }
  }

  async challenge(player, mode, team) {
    if (!this.ready || this.state.busy) return;
    const teamCode = this.teamCode(team);
    if (!teamCode) return;
    this.set({busy: true, taskError: '', notice: ''});
    try {
      const handle = await this.lobby.challenge(player.uid, mode, teamCode, {
        onMatch: info => this.matched(info, teamCode),
        onError: err => this.failed(err),
        onDeclined: reason => {
          if (this.state.task?.handle !== handle) return;
          this.set({task: null, notice: reason === 'declined' ? `${player.name} said no thanks.` : `${player.name} didn't answer.`});
        },
      });
      this.set({task: {kind: 'challenge', mode, code: handle.code, to: player.uid, toName: player.name, startedAt: Date.now(), handle}});
    } catch (err) {
      this.failed(err);
    } finally {
      this.set({busy: false});
    }
  }

  accept(invite, team) {
    return this.joinRoom(invite.code, team);
  }

  decline(invite) {
    if (!this.ready) return;
    this.set({invites: this.state.invites.filter(i => i.from !== invite.from)});
    this.lobby.declineInvite(invite.from).catch(() => {});
  }

  async cancel() {
    const task = this.state.task;
    this.set({task: null});
    if (task?.handle) await task.handle.cancel().catch(() => {});
  }

  // ---- battles you left ----

  async checkRejoin(record) {
    const id = record.match;
    if (!id) {
      if (this.state.rejoin) this.set({rejoin: null});
      return;
    }
    if (id === this.currentMatch || this.checked.has(id)) return;
    this.checked.add(id);
    const info = await this.lobby.checkBattle(id);
    if (!info || id === this.currentMatch) return;
    if (info.result) {
      const r = info.result;
      const outcome = r.winner === 'tie' ? 'it was a draw' : r.winner === info.side ? 'you won' : 'you lost';
      this.set({notice: `Your battle with ${info.opponent} ended while you were away: ${outcome}.`});
    } else {
      this.set({rejoin: info});
    }
  }

  rejoin(team) {
    const info = this.state.rejoin;
    if (!info || !this.ready) return;
    const teamCode = team ? this.teamCode(team) : null;
    if (team && !teamCode) return;
    this.matched(info, teamCode);
  }

  async forfeitRejoin() {
    const info = this.state.rejoin;
    if (!info) return;
    this.set({rejoin: null, busy: true});
    try {
      await this.lobby.forfeitBattle(info);
    } catch (err) {
      this.set({taskError: friendlyError(err)});
    } finally {
      this.set({busy: false});
    }
  }

  /** The app closed this battle's screen. If it isn't over, it can be rejoined. */
  leftBattle(id) {
    if (this.currentMatch === id) this.currentMatch = null;
    this.checked.delete(id);
    if (this.ready) {
      this.lobby.noteState('idle');
      this.checkRejoin(this.state.record);
    }
  }
}

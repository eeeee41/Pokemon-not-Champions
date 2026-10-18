// An in-memory stand-in for Firebase Realtime Database, for tests. It keeps one
// shared JSON tree (the "server"), checks every read and write against the real
// database.rules.json (via targaryen), runs transactions atomically, delivers
// listener updates asynchronously like a network would, and runs onDisconnect
// cleanups when a test "closes" a client.
import targaryen from 'targaryen';

const split = path => String(path).split('/').filter(Boolean);
const clone = v => (v === undefined || v === null ? null : JSON.parse(JSON.stringify(v)));

/** Firebase never stores empty objects or nulls, and stores arrays as keyed objects. */
function normalize(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) value = Object.fromEntries(value.map((v, i) => [String(i), v]));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const n = normalize(v);
    if (n !== null) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

function getAt(tree, parts) {
  let node = tree;
  for (const p of parts) {
    if (node === null || typeof node !== 'object' || !(p in node)) return null;
    node = node[p];
  }
  return node === undefined ? null : node;
}

function setAt(tree, parts, value) {
  if (!parts.length) return normalize(value);
  const root = tree && typeof tree === 'object' ? {...tree} : {};
  const [head, ...rest] = parts;
  const child = setAt(root[head] ?? null, rest, value);
  if (child === null) delete root[head];
  else root[head] = child;
  return Object.keys(root).length ? root : null;
}

const related = (a, b) => {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
};

export class PermissionDenied extends Error {
  constructor(op, path) {
    super(`PERMISSION_DENIED: ${op} ${path}`);
    this.code = 'PERMISSION_DENIED';
  }
}

export class MemoryServer {
  /** @param {{rules: object, clock?: () => number, latency?: number}} opts */
  constructor({rules, clock, latency = 1}) {
    this.rules = rules;
    this.data = null;
    this.clock = clock || (() => Date.now());
    this.latency = latency;
    this.watchers = new Set();
    this.writes = 0;
  }

  now() {
    return this.clock();
  }

  db(auth) {
    return targaryen.database(this.rules, this.data || {}).as(auth);
  }

  canRead(auth, path) {
    return this.db(auth).read(`/${split(path).join('/')}`, {now: this.now()}).allowed;
  }

  canWrite(auth, path, value) {
    return this.db(auth).write(`/${split(path).join('/')}`, normalize(clone(value)), {now: this.now()}).allowed;
  }

  canUpdate(auth, path, patch) {
    return this.db(auth).update(`/${split(path).join('/')}`, clone(patch), {now: this.now()}).allowed;
  }

  apply(path, value) {
    this.data = setAt(this.data, split(path), clone(value));
    this.writes++;
    this.changed(split(path));
  }

  applyUpdate(path, patch) {
    const base = split(path);
    for (const [k, v] of Object.entries(patch)) this.data = setAt(this.data, [...base, ...split(k)], clone(v));
    this.writes++;
    this.changed(base);
  }

  changed(parts) {
    for (const w of this.watchers) {
      if (related(w.parts, parts)) w.poke();
    }
  }

  value(path) {
    return clone(getAt(this.data, split(path)));
  }
}

export class MemoryBackend {
  /** @param {MemoryServer} server @param {{uid: string}} opts */
  constructor(server, {uid}) {
    this.server = server;
    this.uid = null;
    this.wantUid = uid;
    this.connected = false;
    this.closed = false;
    this.dropped = null; // a promise while the connection is down (see drop())
    this.cleanups = [];
    this.connectionWatchers = new Set();
    this.mine = new Set();
  }

  get auth() {
    return this.uid ? {uid: this.uid, provider: 'anonymous'} : null;
  }

  later(fn) {
    setTimeout(() => {
      if (!this.closed) fn();
    }, this.server.latency);
  }

  async round() {
    if (this.closed) throw new Error('This client is closed');
    // Like Firebase, requests made while offline wait for the connection.
    while (this.dropped) await this.dropped;
    await new Promise(r => setTimeout(r, this.server.latency));
    if (this.closed) throw new Error('This client is closed');
    while (this.dropped) await this.dropped;
  }

  async connect() {
    await this.round();
    this.uid = this.wantUid;
    this.connected = true;
    for (const cb of this.connectionWatchers) cb(true);
    return this.uid;
  }

  now() {
    return this.server.now();
  }

  async get(path) {
    await this.round();
    if (!this.server.canRead(this.auth, path)) throw new PermissionDenied('read', path);
    return this.server.value(path);
  }

  async set(path, value) {
    await this.round();
    if (!this.server.canWrite(this.auth, path, value)) throw new PermissionDenied('set', path);
    this.server.apply(path, value);
  }

  async update(path, patch) {
    await this.round();
    if (!this.server.canUpdate(this.auth, path, patch)) throw new PermissionDenied('update', path);
    this.server.applyUpdate(path, patch);
  }

  async remove(path) {
    return this.set(path, null);
  }

  async transaction(path, fn) {
    await this.round();
    // Atomic: nothing else runs between reading and writing here.
    if (!this.server.canRead(this.auth, path)) throw new PermissionDenied('transaction read', path);
    const current = this.server.value(path);
    const next = fn(clone(current));
    if (next === undefined) return {committed: false, value: current};
    if (!this.server.canWrite(this.auth, path, next)) throw new PermissionDenied('transaction', path);
    this.server.apply(path, next);
    return {committed: true, value: this.server.value(path)};
  }

  watchRaw(path, deliver, onError) {
    const auth = () => this.auth;
    const server = this.server;
    const w = {
      parts: split(path),
      last: undefined,
      stopped: false,
      poke: () => {
        if (w.stopped || w.pending) return;
        w.pending = true;
        this.later(() => {
          w.pending = false;
          if (w.stopped) return;
          if (this.dropped) {
            // Offline: nothing arrives. restore() catches up.
            w.missed = true;
            return;
          }
          if (!server.canRead(auth(), path)) {
            w.stop();
            if (onError) onError(new PermissionDenied('watch', path));
            return;
          }
          deliver(server.value(path), w);
        });
      },
      stop: () => {
        w.stopped = true;
        server.watchers.delete(w);
        this.mine.delete(w);
      },
    };
    server.watchers.add(w);
    this.mine.add(w);
    w.poke();
    return () => w.stop();
  }

  watch(path, cb, onError) {
    return this.watchRaw(path, (value, w) => {
      const text = JSON.stringify(value);
      if (text === w.last) return;
      w.last = text;
      cb(value);
    }, onError);
  }

  watchChildren(path, cb, onError) {
    const seen = new Set();
    return this.watchRaw(path, value => {
      if (!value || typeof value !== 'object') return;
      for (const [k, v] of Object.entries(value)) {
        if (seen.has(k)) continue;
        seen.add(k);
        cb(k, clone(v));
      }
    }, onError);
  }

  async removeOnDisconnect(path) {
    await this.round();
    if (!this.server.canWrite(this.auth, path, null)) throw new PermissionDenied('onDisconnect', path);
    this.cleanups.push(path);
  }

  watchConnection(cb) {
    this.connectionWatchers.add(cb);
    this.later(() => cb(this.connected));
    return () => this.connectionWatchers.delete(cb);
  }

  /** Test helper: the browser tab closes. Its onDisconnect cleanups run on the server. */
  close() {
    if (this.closed) return;
    this.closed = true;
    this.connected = false;
    for (const w of [...this.mine]) w.stop();
    this.runCleanups();
    const resume = this.resume;
    this.dropped = null;
    if (resume) resume();
  }

  runCleanups() {
    for (const path of this.cleanups) this.server.apply(path, null);
    // Firebase forgets these once they've run; the page must set them up again.
    this.cleanups = [];
  }

  /** Test helper: the connection drops (a Wi-Fi blip). The page stays open. */
  drop() {
    if (this.closed || this.dropped) return;
    this.connected = false;
    this.dropped = new Promise(resolve => {
      this.resume = resolve;
    });
    this.runCleanups();
    for (const cb of this.connectionWatchers) setTimeout(() => cb(false), this.server.latency);
  }

  /** Test helper: the connection comes back after drop(). */
  restore() {
    if (this.closed || !this.dropped) return;
    this.connected = true;
    const resume = this.resume;
    this.dropped = null;
    this.resume = null;
    resume();
    for (const w of this.mine) w.poke();
    for (const cb of this.connectionWatchers) setTimeout(() => cb(true), this.server.latency);
  }
}

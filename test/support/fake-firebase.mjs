// A stand-in for Firebase that the real Firebase JS SDK can talk to, so tests
// can run the production backend (src/online/backend.js) end to end without
// Google's servers or the (Java) Firebase emulator.
//
// It speaks the Realtime Database wire protocol (v5) over a WebSocket, and
// answers the Identity Toolkit calls that anonymous sign-in makes over HTTP.
// Data and security rules come from MemoryServer, so the real
// database.rules.json is enforced.
//
// Connect with FirebaseBackend's `emulators` option:
//   {auth: `http://127.0.0.1:${port}`, database: {host: '127.0.0.1', port}}
import http from 'node:http';
import crypto from 'node:crypto';
import {WebSocketServer} from 'ws';
import {MemoryServer} from '../../src/online/memory-backend.js';

const split = path => String(path || '').split('/').filter(Boolean);
const related = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return false;
  return true;
};
const under = (path, base) => related(split(base), split(path)) && split(path).length >= split(base).length;

// ---- Firebase's hash of a value (the SDK sends it with transactions) ----
const sha1 = text => crypto.createHash('sha1').update(text, 'utf8').digest('base64');

function intKey(key) {
  if (!/^-?(0*)\d{1,10}$/.test(key)) return null;
  const n = Number(key);
  return n >= -2147483648 && n <= 2147483647 ? n : null;
}

function nameCompare(a, b) {
  if (a === b) return 0;
  const ai = intKey(a);
  const bi = intKey(b);
  if (ai !== null && bi !== null) return ai - bi === 0 ? a.length - b.length : ai - bi;
  if (ai !== null) return -1;
  if (bi !== null) return 1;
  return a < b ? -1 : 1;
}

export function firebaseHash(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') {
    let text = `${typeof value}:`;
    if (typeof value === 'number') {
      const view = new DataView(new ArrayBuffer(8));
      view.setFloat64(0, value);
      text += [...new Uint8Array(view.buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      text += value;
    }
    return sha1(text);
  }
  let text = '';
  for (const key of Object.keys(value).sort(nameCompare)) {
    const h = firebaseHash(value[key]);
    if (h !== '') text += `:${key}:${h}`;
  }
  return text === '' ? '' : sha1(text);
}

// ---- Tokens: unsigned JWTs, as the Firebase emulators use ----
const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');

function decodeToken(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

class Session {
  constructor(fake, ws, id) {
    this.fake = fake;
    this.db = fake.db;
    this.ws = ws;
    this.auth = null;
    this.listens = new Map(); // path → MemoryServer watcher
    this.onDisconnect = [];
    this.frames = 0;
    this.buffer = [];
    this.log = [];
    ws.on('message', data => this.receive(String(data)));
    ws.on('close', () => this.closed());
    this.send({t: 'c', d: {t: 'h', d: {ts: Date.now(), v: '5', h: fake.host, s: `session-${id}`}}});
  }

  send(msg) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  receive(text) {
    if (this.frames > 0) {
      this.buffer.push(text);
      if (this.buffer.length < this.frames) return;
      text = this.buffer.join('');
      this.frames = 0;
      this.buffer = [];
    } else if (text.length <= 6 && /^\d+$/.test(text)) {
      // "0" is a keep-alive; any other number says how many frames follow.
      this.frames = Number(text);
      return;
    }
    const msg = JSON.parse(text);
    if (msg.t === 'c' && msg.d?.t === 'p') this.send({t: 'c', d: {t: 'o', d: {}}});
    if (msg.t === 'd') this.request(msg.d);
  }

  request({r, a, b = {}}) {
    this.log.push(a);
    this.fake.requests.push(a);
    const reply = (s = 'ok', d = {}) => {
      if (r !== undefined) this.send({t: 'd', d: {r, b: {s, d}}});
    };
    const denied = () => reply('permission_denied', 'Permission denied');
    const db = this.db;
    switch (a) {
      case 's': // usage stats
      case 'echo':
        return reply('ok', b.d ?? {});
      case 'auth':
      case 'gauth': {
        const claims = decodeToken(b.cred);
        if (!claims) return reply('invalid_token', 'Could not parse auth token.');
        this.auth = {uid: claims.user_id || claims.sub, provider: claims.firebase?.sign_in_provider || 'anonymous', token: claims};
        this.recheck();
        return reply('ok', {auth: claims, expires: claims.exp});
      }
      case 'unauth':
        this.auth = null;
        this.recheck();
        return reply();
      case 'q':
      case 'l':
        return this.listen(b.p, b.t, reply, denied);
      case 'n':
        this.unlisten(b.p);
        return reply();
      case 'g':
        if (!db.canRead(this.auth, b.p)) return denied();
        return reply('ok', db.value(b.p));
      case 'p':
        if (b.h !== undefined && firebaseHash(db.value(b.p)) !== b.h) {
          return reply('datastale', 'Transaction hash does not match');
        }
        if (!db.canWrite(this.auth, b.p, b.d)) return denied();
        db.apply(b.p, b.d);
        return reply();
      case 'm':
        if (!db.canUpdate(this.auth, b.p, b.d)) return denied();
        db.applyUpdate(b.p, b.d);
        return reply();
      case 'o':
      case 'om': {
        const ok = a === 'o' ? db.canWrite(this.auth, b.p, b.d) : db.canUpdate(this.auth, b.p, b.d);
        if (!ok) return denied();
        this.onDisconnect.push({a, p: b.p, d: b.d});
        return reply();
      }
      case 'oc':
        this.onDisconnect = this.onDisconnect.filter(op => !under(op.p, b.p));
        return reply();
      default:
        return reply('error', `The test server doesn't support "${a}".`);
    }
  }

  listen(path, tag, reply, denied) {
    if (!this.db.canRead(this.auth, path)) return denied();
    this.unlisten(path);
    const w = {
      parts: split(path),
      poke: () => this.push(path, tag, w),
    };
    this.listens.set(split(path).join('/'), w);
    this.db.watchers.add(w);
    this.push(path, tag, w);
    return reply();
  }

  unlisten(path) {
    const key = split(path).join('/');
    const w = this.listens.get(key);
    if (w) this.db.watchers.delete(w);
    this.listens.delete(key);
  }

  push(path, tag, w) {
    if (!this.db.canRead(this.auth, path)) {
      // Not allowed any more: tell the client its listener was cancelled.
      this.unlisten(path);
      this.send({t: 'd', d: {a: 'c', b: {p: path}}});
      return;
    }
    if (w && !this.listens.has(split(path).join('/'))) return;
    const body = {p: path, d: this.db.value(path)};
    if (tag !== undefined) body.t = tag;
    this.send({t: 'd', d: {a: 'd', b: body}});
  }

  recheck() {
    for (const [key, w] of [...this.listens]) w.poke(key);
  }

  closed() {
    for (const w of this.listens.values()) this.db.watchers.delete(w);
    this.listens.clear();
    for (const op of this.onDisconnect) {
      if (op.a === 'o') this.db.apply(op.p, op.d);
      else this.db.applyUpdate(op.p, op.d);
    }
    this.onDisconnect = [];
    this.fake.sessions.delete(this);
  }
}

/**
 * Starts the fake on a free port. Returns {port, db, sessions, requests, close()}.
 * db is the MemoryServer holding the data (db.value(path) to inspect it).
 */
export async function startFakeFirebase({rules, projectId = 'demo-champions'}) {
  const fake = {
    db: new MemoryServer({rules}),
    sessions: new Set(),
    requests: [],
    host: '',
    port: 0,
    users: 0,
  };

  const token = uid => {
    const now = Math.floor(Date.now() / 1000);
    return `${b64url({alg: 'none', typ: 'JWT'})}.${b64url({
      iss: `https://securetoken.google.com/${projectId}`, aud: projectId, auth_time: now, user_id: uid, sub: uid,
      iat: now, exp: now + 3600, provider_id: 'anonymous', firebase: {identities: {}, sign_in_provider: 'anonymous'},
    })}.`;
  };

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const send = (status, json) => {
        res.writeHead(status, {'content-type': 'application/json'});
        res.end(JSON.stringify(json));
      };
      const path = new URL(req.url, 'http://local').pathname;
      if (path.endsWith('/accounts:signUp')) {
        const uid = `anon${String(++fake.users).padStart(4, '0')}${crypto.randomBytes(8).toString('hex')}`;
        return send(200, {kind: 'identitytoolkit#SignupNewUserResponse', idToken: token(uid), refreshToken: `refresh-${uid}`, expiresIn: '3600', localId: uid});
      }
      if (path.endsWith('/accounts:lookup')) {
        const claims = decodeToken(JSON.parse(body || '{}').idToken);
        if (!claims) return send(400, {error: {code: 400, message: 'INVALID_ID_TOKEN'}});
        const at = String(claims.iat * 1000);
        return send(200, {kind: 'identitytoolkit#GetAccountInfoResponse', users: [{localId: claims.user_id, createdAt: at, lastLoginAt: at, providerUserInfo: []}]});
      }
      if (path.endsWith('/token')) {
        const uid = (new URLSearchParams(body).get('refresh_token') || '').replace(/^refresh-/, '');
        return send(200, {access_token: token(uid), expires_in: '3600', token_type: 'Bearer', refresh_token: `refresh-${uid}`, id_token: token(uid), user_id: uid, project_id: projectId});
      }
      return send(404, {error: {code: 404, message: `The test server doesn't know ${path}`}});
    });
  });

  const wss = new WebSocketServer({server});
  let ids = 0;
  wss.on('connection', ws => fake.sessions.add(new Session(fake, ws, ++ids)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  fake.port = server.address().port;
  fake.host = `127.0.0.1:${fake.port}`;
  fake.close = async () => {
    for (const s of fake.sessions) s.ws.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  };
  return fake;
}

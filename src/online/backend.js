// The small database interface the online code uses, and its Firebase version.
//
// Every backend provides:
//   connect() → uid                  sign in (anonymously); resolves to this player's id
//   now() → ms                       the server's clock, estimated
//   get(path) → value | null
//   set(path, value), update(path, patch), remove(path)
//   transaction(path, fn) → {committed, value}
//                                    fn(current) returns the new value, null to delete,
//                                    or undefined to leave it alone (abort)
//   watch(path, cb, onError?) → stop       cb(value) now and after every change
//   watchChildren(path, cb, onError?) → stop   cb(key, value) for each child as it appears
//   removeOnDisconnect(path)         delete this path if this browser drops off; like
//                                    Firebase, this has to be set up again after a reconnect
//   watchConnection(cb) → stop       cb(true/false) as the connection comes and goes
//
// Callbacks never run synchronously inside watch()/watchChildren()/watchConnection(),
// so the returned stop function always exists by the time a callback runs.
//
// src/online/memory-backend.js implements the same thing in memory for tests.
import {initializeApp, deleteApp} from 'firebase/app';
import {getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator} from 'firebase/auth';
import {
  getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, runTransaction, onValue, onChildAdded,
  onDisconnect,
} from 'firebase/database';
import bundledConfig from '../firebase-config.json' with {type: 'json'};

function usable(config) {
  return !!(config && config.apiKey && config.projectId);
}

/**
 * Finds this site's Firebase settings. On Firebase Hosting they come from the
 * reserved /__/firebase/init.json address, so nothing needs pasting in.
 * Elsewhere, fill in src/firebase-config.json. Returns null if there are none.
 */
export async function loadFirebaseConfig() {
  let config = null;
  if (typeof window !== 'undefined' && usable(window.CHAMPIONS_FIREBASE_CONFIG)) config = window.CHAMPIONS_FIREBASE_CONFIG;
  else if (usable(bundledConfig)) config = bundledConfig;
  else if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
    try {
      const res = await fetch('/__/firebase/init.json', {cache: 'no-store'});
      if (res.ok) {
        const json = await res.json();
        if (usable(json)) config = json;
      }
    } catch {
      // Not on Firebase Hosting (or this page can't make requests): no online play.
    }
  }
  if (!config) return null;
  config = {...config};
  if (!config.databaseURL) config.databaseURL = `https://${config.projectId}-default-rtdb.firebaseio.com`;
  return config;
}

/** Wraps a callback so it runs a moment later, and never after stop(). */
function deferred(fn) {
  let live = true;
  const call = (...args) => {
    queueMicrotask(() => {
      if (live && fn) fn(...args);
    });
  };
  call.stop = () => {
    live = false;
  };
  return call;
}

export class FirebaseBackend {
  /**
   * @param {object} config  the Firebase web app settings
   * @param {{appName?: string, emulators?: {auth: string, database: {host: string, port: number}}}} [options]
   *   emulators: talk to local stand-ins (the Firebase Emulator Suite, or the
   *   test server in test/support) instead of Google's servers.
   */
  constructor(config, {appName, emulators} = {}) {
    this.config = config;
    this.app = initializeApp(config, appName || `champions-${config.projectId}`);
    this.auth = getAuth(this.app);
    this.db = getDatabase(this.app, config.databaseURL);
    if (emulators?.auth) connectAuthEmulator(this.auth, emulators.auth, {disableWarnings: true});
    if (emulators?.database) connectDatabaseEmulator(this.db, emulators.database.host, emulators.database.port);
    this.offset = 0;
    this.uid = null;
    onValue(ref(this.db, '.info/serverTimeOffset'), snap => {
      this.offset = Number(snap.val()) || 0;
    });
  }

  async connect() {
    if (this.uid) return this.uid;
    // A returning player keeps their id: Firebase remembers the anonymous
    // account in this browser, and signInAnonymously reuses it.
    const user = await new Promise((resolve, reject) => {
      const stop = onAuthStateChanged(this.auth, u => {
        if (u) {
          stop();
          resolve(u);
        }
      }, reject);
      signInAnonymously(this.auth).catch(err => {
        stop();
        reject(err);
      });
    });
    this.uid = user.uid;
    return this.uid;
  }

  now() {
    return Date.now() + this.offset;
  }

  async get(path) {
    return (await get(ref(this.db, path))).val();
  }

  set(path, value) {
    return set(ref(this.db, path), value);
  }

  update(path, patch) {
    return update(ref(this.db, path), patch);
  }

  remove(path) {
    return remove(ref(this.db, path));
  }

  async transaction(path, fn) {
    const target = ref(this.db, path);
    // Firebase first runs fn on its local copy of the data, which is empty for
    // a place nobody is listening to. If fn returns undefined for "empty"
    // (e.g. "no room with that code"), Firebase gives up without ever asking
    // the server. Listening first makes fn start from the real value.
    let stop = null;
    await new Promise((resolve, reject) => {
      stop = onValue(target, () => resolve(), reject);
    });
    try {
      const result = await runTransaction(target, cur => fn(cur === undefined ? null : cur), {applyLocally: false});
      return {committed: result.committed, value: result.snapshot.val()};
    } finally {
      stop();
    }
  }

  watch(path, cb, onError) {
    const onData = deferred(snap => cb(snap.val()));
    const onFail = deferred(onError);
    const stop = onValue(ref(this.db, path), onData, onFail);
    return () => {
      onData.stop();
      onFail.stop();
      stop();
    };
  }

  watchChildren(path, cb, onError) {
    const onData = deferred(snap => cb(snap.key, snap.val()));
    const onFail = deferred(onError);
    const stop = onChildAdded(ref(this.db, path), onData, onFail);
    return () => {
      onData.stop();
      onFail.stop();
      stop();
    };
  }

  removeOnDisconnect(path) {
    return onDisconnect(ref(this.db, path)).remove();
  }

  watchConnection(cb) {
    const onData = deferred(snap => cb(!!snap.val()));
    const stop = onValue(ref(this.db, '.info/connected'), onData);
    return () => {
      onData.stop();
      stop();
    };
  }

  /** Closes this page's connection to Firebase (used by tests). */
  close() {
    // Firebase Auth keeps a token-refresh timer even after the app is deleted,
    // which would keep a test process running.
    this.auth.currentUser?._stopProactiveRefresh?.();
    return deleteApp(this.app);
  }
}

/** Creates the backend for this site, or null when Firebase isn't set up here. */
export async function createBackend() {
  const config = await loadFirebaseConfig();
  return config ? new FirebaseBackend(config) : null;
}

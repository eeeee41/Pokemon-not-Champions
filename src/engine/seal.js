// Seals for unlock progress kept in the browser (Megatron's parts, Champion
// wins against rivals). Each entry is stored with a seal made from this
// browser's own random id, so a hand-edited or copied list doesn't count:
// only progress the site itself recorded does.
import {sha256} from './sha256.js';

const DEVICE_KEY = 'champions-pvp.device.v1';
const PEPPER = 'cpvp|9f3c1a77e2b54d08|seal';
let deviceMemory = null;
const memory = new Map(); // store key → entries, when the browser won't save

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function randomId() {
  return [...globalThis.crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
}

function deviceId() {
  const ls = storage();
  try {
    if (ls) {
      let id = ls.getItem(DEVICE_KEY);
      if (!id || !/^[0-9a-f]{32}$/.test(id)) {
        id = randomId();
        ls.setItem(DEVICE_KEY, id);
      }
      return id;
    }
  } catch {
    // fall through to this visit's id
  }
  return (deviceMemory ??= randomId());
}

function sealFor(kind, id) {
  return sha256(`${PEPPER}|${deviceId()}|${kind}|${id}`);
}

function read(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = JSON.parse(storage()?.getItem(key) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** Ids recorded under `kind` whose seals check out. */
export function sealedIds(kind, key) {
  const entries = read(key);
  return Object.keys(entries).filter(id => entries[id] === sealFor(kind, id));
}

/** Records `id` under `kind`, sealed. */
export function recordSealed(kind, key, id) {
  const entries = {...read(key)};
  entries[id] = sealFor(kind, id);
  memory.set(key, entries);
  try {
    const ls = storage();
    if (ls) {
      ls.setItem(key, JSON.stringify(entries));
      memory.delete(key);
    }
  } catch {
    // Kept for this visit only.
  }
}

/** Forgets everything under `key` (for tests). */
export function clearSealed(key) {
  memory.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {
    // nothing saved
  }
}

/** Forgets this browser's id (for tests). */
export function resetDevice() {
  deviceMemory = null;
  memory.clear();
}

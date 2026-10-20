// Save codes: a whole team packed into one short line of text.
//
//   CPV1.<base64url>
//
// The payload is a bit stream: team name, then per Pokémon its species id,
// nickname, item, ability slot, nature, Tera Type, flags, moves and stat
// points, then a checksum so a mistyped or cut-off code is caught. Items and
// moves are stored by their official numbers, so codes keep working when new
// Pokémon data is added.
import {dex, toID, selectableItems, speciesAbilities, inGame} from './dex.js';
import {learnableMoveIds} from './learnsets.js';
import {newTeam, newMon, cleanName} from './team.js';
import {STATS, TERA_TYPES, TEAM_SIZE, MAX_MOVES, SP_MAX} from './constants.js';

export const SAVE_CODE_PREFIX = 'CPV1.';
const VERSION = 1;

// Fixed lists, so their order never changes under a code.
const NATURES = [
  'Adamant', 'Bashful', 'Bold', 'Brave', 'Calm', 'Careful', 'Docile', 'Gentle', 'Hardy', 'Hasty',
  'Impish', 'Jolly', 'Lax', 'Lonely', 'Mild', 'Modest', 'Naive', 'Naughty', 'Quiet', 'Quirky',
  'Rash', 'Relaxed', 'Sassy', 'Serious', 'Timid',
];
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

class BitWriter {
  constructor() {
    this.bits = [];
  }
  write(value, width) {
    if (value < 0 || value >= 2 ** width) throw new Error(`Value ${value} doesn't fit in ${width} bits`);
    for (let i = width - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  id(text) {
    const id = toID(text).slice(0, 31);
    this.write(id.length, 5);
    for (const ch of id) this.write(ID_CHARS.indexOf(ch), 6);
  }
  text(value, maxBytes) {
    let bytes = new TextEncoder().encode(value);
    while (bytes.length > maxBytes) bytes = new TextEncoder().encode(value = [...value].slice(0, -1).join(''));
    this.write(bytes.length, 6);
    for (const b of bytes) this.write(b, 8);
  }
  bytes() {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, i) => {
      if (bit) out[i >> 3] |= 0x80 >> (i & 7);
    });
    return out;
  }
}

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.pos = 0;
  }
  read(width) {
    let v = 0;
    for (let i = 0; i < width; i++) {
      const at = this.pos++;
      if (at >= this.bytes.length * 8) throw new Error('short');
      v = v * 2 + ((this.bytes[at >> 3] >> (7 - (at & 7))) & 1);
    }
    return v;
  }
  id() {
    const n = this.read(5);
    let s = '';
    for (let i = 0; i < n; i++) s += ID_CHARS[this.read(6)] || '';
    return s;
  }
  text() {
    const n = this.read(6);
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = this.read(8);
    return new TextDecoder().decode(b);
  }
}

function checksum(bytes) {
  let h = 0x5a;
  for (const b of bytes) h = ((h * 31) + b) & 0xff;
  return h;
}

function toBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    const chars = i + 1 >= bytes.length ? 2 : i + 2 >= bytes.length ? 3 : 4;
    for (let k = 0; k < chars; k++) out += B64[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

function fromBase64(text) {
  const vals = [];
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('char');
    vals.push(v);
  }
  const out = [];
  for (let i = 0; i < vals.length; i += 4) {
    const n = (vals[i] << 18) | ((vals[i + 1] || 0) << 12) | ((vals[i + 2] || 0) << 6) | (vals[i + 3] || 0);
    const count = Math.min(3, Math.floor(((vals.length - i) * 6) / 8));
    for (let k = 0; k < count; k++) out.push((n >> (16 - 8 * k)) & 0xff);
  }
  return new Uint8Array(out);
}

let tables = null;
function getTables() {
  if (tables) return tables;
  const itemByNum = new Map(selectableItems().map(i => [i.num, i]));
  const moveByNum = new Map();
  // MissingNo.'s moves first (it knows a few no one else does), then Smeargle's,
  // which win wherever two moves share a number.
  for (const id of learnableMoveIds('MissingNo.')) {
    const m = dex.moves.get(id);
    if (m.num > 0) moveByNum.set(m.num, m);
  }
  for (const id of learnableMoveIds('Smeargle')) {
    const m = dex.moves.get(id);
    moveByNum.set(m.num, m);
  }
  tables = {itemByNum, moveByNum};
  return tables;
}

/** A team → its save code. */
export function encodeTeam(team) {
  const w = new BitWriter();
  w.write(VERSION, 4);
  w.text(String(team.name || ''), 48);
  const mons = (team.mons || []).slice(0, TEAM_SIZE);
  w.write(mons.length, 3);
  for (const mon of mons) {
    const species = dex.species.get(mon.species);
    w.id(species.exists ? species.id : mon.species);
    w.text(cleanName(mon.nickname || ''), 36);
    const item = mon.item ? dex.items.get(mon.item) : null;
    w.write(item && item.exists ? item.num + 1 : 0, 12);
    const slot = Math.max(0, speciesAbilities(species).indexOf(mon.ability));
    w.write(slot, 2);
    w.write(Math.max(0, NATURES.indexOf(dex.natures.get(mon.nature).name)), 5);
    w.write(Math.max(0, TERA_TYPES.indexOf(mon.teraType)), 5);
    w.write(mon.gmax ? 1 : 0, 1);
    w.write(mon.shiny ? 1 : 0, 1);
    w.write(mon.gender === 'M' ? 1 : mon.gender === 'F' ? 2 : 0, 2);
    for (let i = 0; i < MAX_MOVES; i++) {
      const move = mon.moves?.[i] ? dex.moves.get(mon.moves[i]) : null;
      w.write(move && move.exists ? move.num + 1 : 0, 10);
    }
    for (const stat of STATS) w.write(Math.max(0, Math.min(SP_MAX, mon.sp?.[stat] || 0)), 6);
  }
  const body = w.bytes();
  const all = new Uint8Array(body.length + 1);
  all.set(body);
  all[body.length] = checksum(body);
  return SAVE_CODE_PREFIX + toBase64(all);
}

export class SaveCodeError extends Error {}

/** A save code → a team. Throws SaveCodeError with a plain message if the code is broken. */
export function decodeTeam(code) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!clean.startsWith(SAVE_CODE_PREFIX)) throw new SaveCodeError("That isn't a Champions PvP save code. Codes start with CPV1.");
  let bytes;
  try {
    bytes = fromBase64(clean.slice(SAVE_CODE_PREFIX.length));
  } catch {
    throw new SaveCodeError('That save code has characters that don\'t belong in it. Copy it again, all in one piece.');
  }
  if (bytes.length < 2 || checksum(bytes.subarray(0, bytes.length - 1)) !== bytes[bytes.length - 1]) {
    throw new SaveCodeError('That save code is incomplete or has a typo. Copy the whole code again.');
  }
  const {itemByNum, moveByNum} = getTables();
  try {
    const r = new BitReader(bytes.subarray(0, bytes.length - 1));
    const version = r.read(4);
    if (version !== VERSION) throw new SaveCodeError('That save code is from a newer version of the site. Reload the page and try again.');
    const team = newTeam(r.text() || 'Loaded team');
    const count = r.read(3);
    for (let n = 0; n < count; n++) {
      const species = dex.species.get(r.id());
      const nickname = r.text();
      const itemNum = r.read(12);
      const slot = r.read(2);
      const nature = NATURES[r.read(5)] || 'Hardy';
      const tera = TERA_TYPES[r.read(5)];
      const gmax = !!r.read(1);
      const shiny = !!r.read(1);
      const gender = ['', 'M', 'F', ''][r.read(2)];
      const moves = [];
      for (let i = 0; i < MAX_MOVES; i++) {
        const num = r.read(10);
        moves.push(num ? moveByNum.get(num - 1)?.name || '' : '');
      }
      const sp = {};
      for (const stat of STATS) sp[stat] = Math.min(SP_MAX, r.read(6));
      if (!species.exists || !inGame(species)) continue;
      const mon = newMon(species.name);
      mon.nickname = cleanName(nickname);
      mon.item = itemNum ? itemByNum.get(itemNum - 1)?.name || '' : '';
      mon.ability = speciesAbilities(species)[slot] || mon.ability;
      mon.nature = nature;
      if (tera) mon.teraType = tera;
      mon.gmax = gmax && !!species.canGigantamax;
      mon.shiny = shiny;
      mon.gender = species.gender ? '' : gender;
      mon.moves = moves;
      mon.sp = sp;
      team.mons.push(mon);
    }
    if (!team.mons.length) throw new SaveCodeError('That save code has no Pokémon in it.');
    return team;
  } catch (e) {
    if (e instanceof SaveCodeError) throw e;
    throw new SaveCodeError('That save code is incomplete or has a typo. Copy the whole code again.');
  }
}

/** Finds every save code in a block of text (one or many, any spacing). */
export function findSaveCodes(text) {
  return String(text || '').match(/CPV1\.[A-Za-z0-9_-]+/g) || [];
}

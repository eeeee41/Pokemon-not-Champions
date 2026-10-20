// Decodes the compact learnsets built by scripts/build-data.mjs.
import data from '../generated/learnsets.json' with {type: 'json'};
import {dex, toID, inGame} from './dex.js';
import {CREATOR_ID} from './creator.js';
import {MEGATRON_ID, MEGATRON_MOVES, MEGATRON_SIGNATURES} from './megatron.js';

const cache = new Map();

function decode(speciesId) {
  let entry = data.sets[speciesId];
  if (entry === undefined) return null;
  if (entry.startsWith('=')) return learnableMoveIds(entry.slice(1));
  const bin = typeof atob === 'function' ? atob(entry) : Buffer.from(entry, 'base64').toString('binary');
  const ids = [];
  for (let byte = 0; byte < bin.length; byte++) {
    const bits = bin.charCodeAt(byte);
    if (!bits) continue;
    for (let bit = 0; bit < 8; bit++) {
      if (bits & (1 << bit)) ids.push(data.moves[byte * 8 + bit]);
    }
  }
  return ids;
}

/** Move ids a selectable species can learn (sorted by id). Unknown species → []. */
export function learnableMoveIds(species) {
  const id = toID(species);
  if (id === CREATOR_ID && !cache.has(id)) {
    // MissingNo. learns everything (except Megatron's own two moves).
    cache.set(id, dex.moves.all()
      .filter(m => inGame(m) && !m.isZ && !m.isMax && m.id !== 'struggle' && !m.realMove && !MEGATRON_SIGNATURES.includes(m.id))
      .map(m => m.id).sort());
  }
  if (id === MEGATRON_ID && !cache.has(id)) cache.set(id, [...MEGATRON_MOVES].sort());
  if (!cache.has(id)) cache.set(id, decode(id) || []);
  return cache.get(id);
}

export function canLearn(species, move) {
  return learnableMoveIds(species).includes(dex.moves.get(move).id);
}

/** Move objects, sorted by name, for the move picker. */
export function learnableMoves(species) {
  return learnableMoveIds(species)
    .map(id => dex.moves.get(id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Builds compact data files the browser needs that the simulator's runtime data doesn't cover:
//   src/generated/learnsets.json  every move each selectable Pokémon can learn, in any generation
//   scripts/.cache/sprite-request.json  the species and items the sprite builder should fetch
//
// Run with: npm run data
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Dex} from '@pkmn/sim';
import {isSelectableSpecies, inGame} from '../src/engine/dex.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dex = Dex.forGen(9);

// ---------- Learnsets ----------
// A Pokémon can use any move it, its pre-evolutions, or (for formes without a
// learnset of their own, like Megas) its base forme could learn in any game.
const movePool = dex.moves.all()
  .filter(m => inGame(m) && !m.isZ && !m.isMax && !m.realMove && m.id !== 'struggle')
  .map(m => m.id)
  .sort();
const moveIndex = new Map(movePool.map((id, i) => [id, i]));

function learnsetFor(species) {
  const moves = new Set();
  const seen = new Set();
  const queue = [species];
  while (queue.length) {
    const s = queue.shift();
    if (!s || !s.exists || seen.has(s.id)) continue;
    seen.add(s.id);
    const data = dex.species.getLearnsetData(s.id);
    const own = data && data.learnset;
    if (own) for (const id of Object.keys(own)) moves.add(id);
    if (s.changesFrom) queue.push(dex.species.get(s.changesFrom));
    if (!own && s.baseSpecies !== s.name) queue.push(dex.species.get(s.baseSpecies));
    if (s.prevo) queue.push(dex.species.get(s.prevo));
  }
  if (moves.has('sketch')) for (const id of movePool) moves.add(id); // Smeargle
  return [...moves].filter(id => moveIndex.has(id));
}

function encode(ids) {
  const bytes = new Uint8Array(Math.ceil(movePool.length / 8));
  for (const id of ids) {
    const i = moveIndex.get(id);
    bytes[i >> 3] |= 1 << (i & 7);
  }
  return Buffer.from(bytes).toString('base64');
}

const sets = {};
const seenBits = new Map();
let empty = [];
for (const s of dex.species.all().filter(isSelectableSpecies)) {
  const ids = learnsetFor(s);
  if (!ids.length) empty.push(s.name);
  const bits = encode(ids);
  if (seenBits.has(bits)) sets[s.id] = '=' + seenBits.get(bits);
  else {
    seenBits.set(bits, s.id);
    sets[s.id] = bits;
  }
}

fs.mkdirSync(path.join(root, 'src/generated'), {recursive: true});
const out = {moves: movePool, sets};
fs.writeFileSync(path.join(root, 'src/generated/learnsets.json'), JSON.stringify(out));
console.log(`learnsets: ${Object.keys(sets).length} species, ${movePool.length} moves, ` +
  `${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
if (empty.length) console.log(`  no moves found for: ${empty.join(', ')}`);

// ---------- Sprite request ----------
// Every species that can appear in battle (including Megas, Gigantamax and
// other battle formes), plus every item, for scripts/build-sprites.py.
const battleSpecies = dex.species.all()
  .filter(s => inGame(s) && !/Totem/.test(s.forme))
  .map(s => ({id: s.id, name: s.name, base: dex.species.get(s.baseSpecies).id, num: s.num}));
const items = dex.items.all().filter(inGame).map(i => ({id: i.id, name: i.name}));
fs.mkdirSync(path.join(root, 'scripts/.cache'), {recursive: true});
fs.writeFileSync(path.join(root, 'scripts/.cache/sprite-request.json'), JSON.stringify({species: battleSpecies, items}));
console.log(`sprite request: ${battleSpecies.length} species, ${items.length} items`);

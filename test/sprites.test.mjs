// Every Mega and Gigantamax forme needs its own art, front and back, or the
// player's own Pokémon would look unchanged after transforming.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {toID, megaOptions, selectableSpecies, dex} from '../src/engine/dex.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../src/generated/sprites.json', import.meta.url)));

test('every Mega has its own front and back sprite', () => {
  const missing = [];
  for (const s of selectableSpecies()) {
    if (s.id === 'missingno') continue; // drawn from its own sheet (see creator.test.mjs)
    for (const o of megaOptions(s.name)) {
      const id = toID(o.mega);
      if (!manifest.front.sprites[id]) missing.push(`${o.mega} (front)`);
      if (!manifest.back.sprites[id]) missing.push(`${o.mega} (back)`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every Gigantamax forme has its own front sprite', () => {
  const missing = selectableSpecies()
    .filter(s => s.id !== 'missingno')
    .filter(s => s.canGigantamax)
    .map(s => dex.species.get(`${s.name}-Gmax`))
    .filter(g => g.exists && !manifest.front.sprites[g.id] && g.id !== 'toxtricitylowkeygmax')
    .map(g => g.name);
  assert.deepEqual(missing, []);
});

test('every forme with normal art also has shiny art', () => {
  const front = Object.keys(manifest.front.sprites).filter(id => !manifest['front-shiny']?.sprites[id]);
  const back = Object.keys(manifest.back.sprites).filter(id => !manifest['back-shiny']?.sprites[id]);
  assert.deepEqual({front, back}, {front: [], back: []});
});

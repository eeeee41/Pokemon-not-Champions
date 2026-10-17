// The browser bundle swaps out learnsets and older-generation data. Make sure
// battles still run with exactly that build.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import fs from 'node:fs';
import * as esbuild from 'esbuild';
import {slimSim} from '../scripts/slim-sim.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('battles run with the slimmed browser build of the simulator', async () => {
  const outfile = path.join(root, 'scripts', '.cache', 'bundle-test.mjs');
  await esbuild.build({
    entryPoints: [path.join(root, 'test', 'fixtures', 'bundle-entry.js')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['import'],
    loader: {'.json': 'json'},
    plugins: [slimSim],
    logLevel: 'silent',
  });
  assert.ok(fs.statSync(outfile).size > 1e6);
  const {playMany} = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  const results = playMany(10);
  assert.equal(results.filter(r => r.ended).length, 10);
});

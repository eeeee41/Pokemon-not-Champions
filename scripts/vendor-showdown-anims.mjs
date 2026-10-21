// Copies Pokémon Showdown's move animations into vendor/showdown/, and the
// effect images they use into public/assets/showdown-fx/.
//
//   node scripts/vendor-showdown-anims.mjs <path to a pokemon-showdown-client checkout>
//
// battle-animations-moves.ts (CC0-1.0) is copied whole. From battle-animations.ts
// (MIT) only the animation tables are taken: the easings, BattleEffects,
// BattleOtherAnims and BattleStatusAnims. The only edits: where they import
// from, and image URLs pointing at this site instead of Showdown's server.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const client = path.resolve(process.argv[2] || '');
const src = path.join(client, 'play.pokemonshowdown.com', 'src');
if (!fs.existsSync(path.join(src, 'battle-animations.ts'))) {
  console.error('Usage: node scripts/vendor-showdown-anims.mjs <pokemon-showdown-client checkout>');
  process.exit(1);
}
const commit = execFileSync('git', ['-C', client, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const out = path.join(root, 'vendor', 'showdown');
fs.mkdirSync(out, {recursive: true});
const note = edits => `/*
 * Vendored from https://github.com/smogon/pokemon-showdown-client
 * (commit ${commit}) by scripts/vendor-showdown-anims.mjs.
 * Changes: ${edits}
 */
`;

// --- battle-animations.ts: the tables only ---
const full = fs.readFileSync(path.join(src, 'battle-animations.ts'), 'utf8');
const header = full.slice(0, full.indexOf('*/') + 2);
const start = full.indexOf('Object.assign($.easing');
if (start < 0) throw new Error('Could not find the easings in battle-animations.ts');
let tables = full.slice(start);
// Showdown prefixes image URLs here from its own data library; the scene does it instead.
tables = tables.replace(/\(\(\) => \{\n\tif \(!window\.Dex[\s\S]*?\n\}\)\(\);\n/, '');
if (tables.includes('window.Dex')) throw new Error('The URL-prefixing block changed; update this script');
tables = tables.replace(/https:\/\/\$\{Config\.routes\.client\}\//g, '${Config.root}');
fs.writeFileSync(path.join(out, 'battle-animations.ts'), `${header}
${note('kept only the animation tables (from the easings on); imports below; BattleEffects exported; removed the block that prefixed image URLs from Showdown\'s data library; image URLs point at this site.')}
import $ from 'jquery';
import { Config } from './config';

type BattleScene = any;
type PokemonSprite = any;
type SpriteData = any;

${tables}
export { BattleEffects };
`);

// --- battle-animations-moves.ts: whole ---
let moves = fs.readFileSync(path.join(src, 'battle-animations-moves.ts'), 'utf8');
moves = moves.replace("import { Config } from './client-main';", "import { Config } from './config';");
moves = moves.replace(/https:\/\/\$\{Config\.routes\.client\}\//g, '${Config.root}');
if (moves.includes('routes.client')) throw new Error('An image URL was not rewritten');
const mhead = moves.indexOf('*/') + 2;
moves = `${moves.slice(0, mhead)}
${note('imports Config from ./config; image URLs point at this site.')}${moves.slice(mhead)}`;
fs.writeFileSync(path.join(out, 'battle-animations-moves.ts'), moves);

// --- the effect images they use ---
const names = new Set();
for (const m of tables.matchAll(/url: '([^']+)'/g)) names.add(m[1]);
for (const text of [tables, moves]) for (const m of text.matchAll(/\bfx\/([A-Za-z0-9_.-]+\.(?:png|jpg|gif))/g)) names.add(m[1]);
const fxOut = path.join(root, 'public', 'assets', 'showdown-fx');
fs.rmSync(fxOut, {recursive: true, force: true});
fs.mkdirSync(fxOut, {recursive: true});
let bytes = 0;
for (const name of [...names].sort()) {
  const from = path.join(client, 'play.pokemonshowdown.com', 'fx', name);
  if (!fs.existsSync(from)) throw new Error(`Missing effect image ${name}`);
  fs.copyFileSync(from, path.join(fxOut, name));
  bytes += fs.statSync(from).size;
}
fs.writeFileSync(path.join(out, 'fx-files.json'), JSON.stringify([...names].sort(), null, 1) + '\n');
console.log(`Vendored animations from ${commit.slice(0, 7)}; ${names.size} effect images (${Math.round(bytes / 1024)} KB).`);

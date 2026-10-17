// Bundles the site into dist/:
//   dist/index.html       full page (for Firebase Hosting or any static host)
//   dist/artifact.html    page body only, for publishing as a Claude artifact
//   dist/app.js           the app, battle engine and Pokémon data
//   dist/assets/*         sprite sheets
//
// Usage: node scripts/build.mjs [--watch] [--dev]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';
import {slimSim} from './slim-sim.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const watch = process.argv.includes('--watch');
const dev = process.argv.includes('--dev') || watch;

function copyAssets() {
  const from = path.join(root, 'public');
  fs.cpSync(from, dist, {recursive: true});
}

function writeHtml() {
  const css = fs.readFileSync(path.join(dist, 'app.css'), 'utf8');
  const head = fs.readFileSync(path.join(root, 'src', 'head.html'), 'utf8');
  const body = '<div id="app"></div>\n<script src="app.js"></script>\n';
  // Full document for normal hosting.
  fs.writeFileSync(path.join(dist, 'index.html'),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n` +
    `${head}<link rel="stylesheet" href="app.css">\n</head>\n<body>\n${body}</body>\n</html>\n`);
  // Body-only page for a Claude artifact (styles inlined).
  fs.writeFileSync(path.join(dist, 'artifact.html'), `${head}<style>\n${css}\n</style>\n${body}`);
}

const options = {
  entryPoints: {app: path.join(root, 'src', 'main.jsx')},
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: {'.json': 'json'},
  define: {'process.env.NODE_ENV': dev ? '"development"' : '"production"'},
  metafile: true,
  logLevel: 'info',
  plugins: [slimSim, {
    name: 'html',
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length) return;
        copyAssets();
        writeHtml();
        if (result.metafile) {
          const js = result.metafile.outputs[path.relative(process.cwd(), path.join(dist, 'app.js'))] ||
            Object.entries(result.metafile.outputs).find(([k]) => k.endsWith('app.js'))?.[1];
          if (js) console.log(`app.js: ${(js.bytes / 1024 / 1024).toFixed(2)} MB`);
          fs.writeFileSync(path.join(root, 'scripts', '.cache', 'meta.json'), JSON.stringify(result.metafile));
        }
      });
    },
  }],
};

fs.mkdirSync(dist, {recursive: true});
fs.mkdirSync(path.join(root, 'scripts', '.cache'), {recursive: true});
if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(options);
}

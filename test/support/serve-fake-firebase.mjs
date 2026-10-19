// Runs the fake Firebase server (fake-firebase.mjs) until stopped, for trying
// online play in real browsers without a Firebase project:
//
//   node test/support/serve-fake-firebase.mjs [port]
//
// Then, in each browser tab, before the app loads (e.g. a script in index.html):
//   window.CHAMPIONS_FIREBASE_CONFIG = {apiKey: 'fake', projectId: 'demo-champions', appId: '1:0:web:0'};
//   window.CHAMPIONS_FIREBASE_EMULATORS = {auth: 'http://127.0.0.1:PORT', database: {host: '127.0.0.1', port: PORT}};
import fs from 'node:fs';
import {startFakeFirebase} from './fake-firebase.mjs';

const rules = JSON.parse(fs.readFileSync(new URL('../../database.rules.json', import.meta.url)));
const fake = await startFakeFirebase({rules, port: Number(process.argv[2]) || 0});
console.log(`fake firebase listening on ${fake.port}`);
process.on('SIGTERM', () => fake.close().then(() => process.exit(0)));
process.on('SIGINT', () => fake.close().then(() => process.exit(0)));

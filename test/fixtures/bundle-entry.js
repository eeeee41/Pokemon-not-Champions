// Bundled with the same slimmed simulator the browser gets, then run in Node.
import {sampleTeams} from '../../src/engine/samples.js';
import {Match} from '../../src/engine/match.js';
import {randomChoice} from '../../src/engine/choices.js';
import {Tracker} from '../../src/client/tracker.js';

export function playMany(n) {
  const teams = sampleTeams();
  const results = [];
  for (let k = 1; k <= n; k++) {
    let s = k * 7919;
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const mode = k % 2 ? 'singles' : 'doubles';
    const match = new Match({mode, seed: [k, k + 1, k + 2, k + 3], players: [
      {name: 'A', team: teams[k % 3]}, {name: 'B', team: teams[(k + 1) % 3]},
    ]});
    let guard = 0;
    while (!match.ended && guard++ < 600) {
      for (const i of [0, 1]) {
        if (match.needsChoice(i) && !match.choose(i, randomChoice(match.requests[i], rng))) {
          throw new Error(`bad choice: ${match.errors[i]}`);
        }
      }
    }
    const t = new Tracker('p1');
    for (const line of match.views.p1) t.step(line);
    results.push({mode, ended: match.ended, turns: match.battle.turn});
  }
  return results;
}

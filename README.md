# Champions PvP

Pokémon battles between real players, on Pokémon Champions stat rules.

- **Singles** and **Doubles**, both one player against one player (one or two Pokémon out each)
- **Every generation**: all species and formes, moves, abilities and items, including the Legends: Z-A Megas
- **Mega Evolution, Z-Moves, Dynamax / Gigantamax and Terastallization**, each once per battle
- **Champions stats**: level 50, IVs 31, 66 stat points per Pokémon (max 32 in one stat), 25 natures
- **Team builder** with legal-move checking, Showdown import/export, and three starter teams
- **Local two-player battles** on one device today; online Quick Match is the next milestone

The battle engine is [Pokémon Showdown's simulator](https://github.com/smogon/pokemon-showdown) (via [`@pkmn/sim`](https://github.com/pkmn/ps)), so mechanics match Showdown.

## Quick start

Needs Node 20+.

```sh
npm install
npm test          # engine tests: stats, learnsets, teams, 70 full random battles
npm run build     # writes dist/
npx serve dist    # or any static server, then open the printed URL
```

`npm run dev` rebuilds on every change.

The build also writes `dist/champions-pvp-offline.html`: the whole game, sprites included, in one
file (about 8 MB). Copy it to any computer and double-click it to play, with no server or
internet needed. Teams save in that browser.

## Rules, in code

| Rule | Where |
| --- | --- |
| Stat points: HP = base + points + 75; other stats = (base + points + 20) × nature | `src/engine/dex.js` (`calcStat`) and `src/engine/format.js` (battle) |
| 66 points, 32 max per stat, level 50, IVs 31 | `src/engine/constants.js` |
| Species Clause and Item Clause | `RULES` in `src/engine/constants.js` |
| Dynamax enabled outside Gen 8; a Pokémon can't both Dynamax and Terastallize | `applySimPatches()` in `src/engine/format.js` |
| Formats: Gen 9 Custom Game base, Team Preview, Endless Battle Clause | `getFormat()` in `src/engine/format.js` |

## Project layout

```
src/
  engine/            battle rules and data (no UI; runs in Node and the browser)
    constants.js     Champions numbers, modes, clauses
    dex.js           species/items/natures, stat formula
    format.js        Singles/Doubles formats + simulator patches
    learnsets.js     decodes the compact learnsets
    team.js          team model, validation, Showdown import/export
    match.js         one battle: seeds, choices, per-player protocol streams
    choices.js       targeting rules, random legal choices (tests, timeouts)
    samples.js       starter teams
  client/tracker.js  what one player knows (@pkmn/client) + battle text (@pkmn/view)
  ui/                Preact screens: home, teams, editor, setup, battle
  generated/         learnsets.json, sprites.json (built by scripts/)
public/assets/       sprite sheets
scripts/
  build.mjs          bundles the site
  build-data.mjs     regenerates learnsets (npm run data)
  build-sprites.py   regenerates sprite sheets (npm run sprites; needs git + Pillow)
test/                node --test suites
```

## How online play will work

`Match` is deterministic: two copies created with the same seed and teams, fed the same choices in
the same order, produce identical battles (there's a test for this). The online version uses that:

1. Players sign in (Firebase Auth) and queue for Singles or Doubles (Realtime Database).
2. A match record holds the seed and both teams.
3. Each turn, each player writes their choice; both browsers apply both choices to their own `Match`.
4. Each browser shows only its own player's view of the battle (`match.views.p1` / `p2`).

A determined player could read hidden information from their own browser in this lockstep model.
If that becomes a problem, the same `Match` class can run inside a Cloud Function instead, sending
each player only their own view.

## Deploying to Firebase Hosting

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. `npm install -g firebase-tools`, then `firebase login`.
3. `firebase use --add` and pick the project.
4. `npm run build && firebase deploy --only hosting`.

To deploy on every push to `main` with GitHub Actions, add two things to the GitHub repo:
the secret `FIREBASE_SERVICE_ACCOUNT` (a service-account JSON key, from
`firebase init hosting:github` or the Firebase console) and the variable `FIREBASE_PROJECT_ID`.
The workflow is `.github/workflows/deploy.yml`.

## Credits

A fan project, not affiliated with Nintendo, Game Freak, Creatures or The Pokémon Company.
Battle engine: Pokémon Showdown (MIT), via the pkmn packages (MIT). Sprites: Smogon's sprite
project. Pokémon and all related names are trademarks of their owners.

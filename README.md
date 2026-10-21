# Champions PvP

Pokémon battles between real players, on Pokémon Champions stat rules.

- **Singles** and **Doubles**, both one player against one player (one or two Pokémon out each)
- **Every generation**: all species and formes, moves, abilities and items, including the Legends: Z-A Megas
- **Mega Evolution, Z-Moves, Dynamax / Gigantamax and Terastallization**, each once per battle
- **Champions stats**: level 50, IVs 31, 66 stat points per Pokémon (max 32 in one stat), 25 natures
- **Team builder** with legal-move checking, Showdown import/export, and three starter teams
- **Online battles**: Quick Match, private battle codes, challenges, turn timer, rejoining, records
- **Rivals**: 21 rivals from every generation (Blue to Taunie) in Singles vs the computer, on Normal, Hard or Champion
- **Local two-player battles** on one device, which work anywhere (even offline)

The battle engine is [Pokémon Showdown's simulator](https://github.com/smogon/pokemon-showdown) (via [`@pkmn/sim`](https://github.com/pkmn/ps)), so mechanics match Showdown.

## Quick start

Needs Node 20+.

```sh
npm install
npm test          # engine, save codes, database rules, online play (in memory and via the real Firebase SDK)
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
    bot.js           the computer opponent: plays turns forward with the simulator
    rivals.js        the rivals and their teams
    samples.js       starter teams
  client/tracker.js  what one player knows (@pkmn/client) + battle text (@pkmn/view)
  online/            online play: Firebase backend, lobby, lockstep games, version stamp
  ui/                Preact screens: home, teams, editor, setup, online, battle
  generated/         learnsets.json, sprites.json (built by scripts/)
public/assets/       sprite sheets
scripts/
  build.mjs          bundles the site
  build-data.mjs     regenerates learnsets (npm run data)
  build-sprites.py   regenerates sprite sheets (npm run sprites; needs git + Pillow)
test/                node --test suites
```

## How the computer opponents think

`src/engine/bot.js` copies the battle (the simulator can snapshot itself) and plays possible turns
forward with fresh luck each time. Hard and Champion try every option they have, including Mega,
Tera, Z-Move and Dynamax variants, against every reply the player could make. They score where
each line leaves them (HP, faints, status, stat changes, hazards, who threatens whom and who's
faster, and gimmicks still in hand), then pick the option that holds up best if the player
answers well. Champion plays each line out more times and re-checks its best options; Hard
occasionally takes its second choice; Normal just picks strong moves. The bot decides from a
snapshot taken before the player's choice, so it never sees it.

## How online play works

`Match` is deterministic: two copies created with the same seed and teams, fed the same choices in
the same order, produce identical battles. Online play (`src/online/`) uses that, over Firebase
Realtime Database with anonymous sign-in:

1. `lobby.js`: presence, Quick Match (one waiting spot per mode, claimed in a transaction),
   private rooms with 5-letter codes, and challenges.
2. A match record holds the seed and both teams (as save codes).
3. `online-game.js`: each player writes only their own choices; both browsers apply both lists to
   their own `Match`. Reloading rebuilds the battle from the saved choices, which is how rejoining
   works. 90-second turn timer, claim-a-win after 2½ minutes, forfeits, records.
4. `database.rules.json` makes each player able to write only their own team, choices and record.

Players are only matched with others on the same battle-engine version (`version.js`, stamped
by the build). A determined player could still read hidden information from their own browser in
this lockstep model; the same `Match` class could run in a Cloud Function instead.

`test/support/fake-firebase.mjs` is a small local stand-in for Firebase that the real SDK can talk
to; `node test/support/serve-fake-firebase.mjs 9799` runs it for trying online play in two
browser windows (see the comment at the top of that file).

## Deploying to Firebase

Every push to `main` runs `.github/workflows/deploy.yml`: tests, build, then it publishes the
database rules and the site. It needs, in the GitHub repo:

- the secret `FIREBASE_SERVICE_ACCOUNT`: a service-account JSON key with the roles Firebase Hosting
  Admin, Firebase Authentication Admin, Firebase Realtime Database Admin, API Keys Viewer and
  Cloud Run Viewer
- the variable `FIREBASE_PROJECT_ID`

In the Firebase project: register a web app with Hosting, enable Anonymous sign-in, and create the
Realtime Database. The site reads its Firebase settings from Hosting's `/__/firebase/init.json`, so
nothing needs to be pasted into the code.

## Credits and licence

A fan project, not affiliated with Nintendo, Game Freak, Creatures or The Pokémon Company.
Battle engine: Pokémon Showdown (MIT), via the pkmn packages (MIT). Move animations: Pokémon
Showdown's (MIT / CC0, with their effect images), in `vendor/showdown/`; the site's own moves have
original effects. Sprites: Smogon's sprite project. Pokémon and all related names are trademarks
of their owners.

This project is licensed under the GNU AGPL v3.0 (`LICENSE`). Details and credits for everything
it includes: `THIRD-PARTY-NOTICES.md`.

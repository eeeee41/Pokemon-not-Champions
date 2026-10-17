// Starter teams so new players can battle right away. Showdown text format.
import {importTeams} from './team.js';

const SINGLES = `=== [gen9] Starter Singles ===

Garchomp @ Garchompite
Ability: Rough Skin
Tera Type: Ground
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Fire Fang

Charizard @ Heavy-Duty Boots
Ability: Solar Power
Tera Type: Fire
Gigantamax: Yes
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Flamethrower
- Air Slash
- Focus Blast
- Solar Beam

Mimikyu @ Mimikium Z
Ability: Disguise
Tera Type: Ghost
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Play Rough
- Shadow Claw
- Swords Dance
- Shadow Sneak

Dragonite @ Choice Band
Ability: Multiscale
Tera Type: Normal
SPs: 32 HP / 32 Atk / 2 Spe
Adamant Nature
- Extreme Speed
- Earthquake
- Fire Punch
- Outrage

Rotom-Wash @ Leftovers
Ability: Levitate
Tera Type: Steel
SPs: 32 HP / 2 Def / 32 SpD
Calm Nature
- Hydro Pump
- Volt Switch
- Will-O-Wisp
- Protect

Kingambit @ Black Glasses
Ability: Supreme Overlord
Tera Type: Dark
SPs: 32 HP / 32 Atk / 2 Spe
Adamant Nature
- Sucker Punch
- Kowtow Cleave
- Iron Head
- Swords Dance

=== [gen9] Starter Doubles ===

Incineroar @ Sitrus Berry
Ability: Intimidate
Tera Type: Ghost
SPs: 32 HP / 2 Atk / 32 SpD
Careful Nature
- Fake Out
- Flare Blitz
- Knock Off
- Parting Shot

Kangaskhan @ Kangaskhanite
Ability: Inner Focus
Tera Type: Normal
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Fake Out
- Double-Edge
- Sucker Punch
- Protect

Urshifu-Rapid-Strike @ Focus Sash
Ability: Unseen Fist
Tera Type: Water
Gigantamax: Yes
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Surging Strikes
- Close Combat
- Aqua Jet
- Protect

Amoonguss @ Rocky Helmet
Ability: Regenerator
Tera Type: Water
SPs: 32 HP / 32 Def / 2 SpD
Relaxed Nature
- Spore
- Rage Powder
- Pollen Puff
- Protect

Flutter Mane @ Booster Energy
Ability: Protosynthesis
Tera Type: Fairy
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Moonblast
- Shadow Ball
- Dazzling Gleam
- Protect

Tapu Koko @ Electrium Z
Ability: Electric Surge
Tera Type: Electric
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Thunderbolt
- Dazzling Gleam
- Volt Switch
- Protect

=== [gen9] Mega Dimension ===

Clefable @ Clefablite
Ability: Magic Guard
Tera Type: Fairy
SPs: 32 HP / 2 SpA / 32 SpD
Calm Nature
- Moonblast
- Flamethrower
- Calm Mind
- Moonlight

Starmie @ Starminite
Ability: Analytic
Tera Type: Water
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Hydro Pump
- Psychic
- Ice Beam
- Rapid Spin

Dragonite @ Dragoninite
Ability: Multiscale
Tera Type: Normal
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Dragon Dance
- Extreme Speed
- Earthquake
- Dragon Claw

Skarmory @ Skarmorite
Ability: Sturdy
Tera Type: Steel
SPs: 32 HP / 32 Def / 2 SpD
Impish Nature
- Brave Bird
- Spikes
- Roost
- Whirlwind

Froslass @ Froslassite
Ability: Cursed Body
Tera Type: Ice
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Ice Beam
- Shadow Ball
- Will-O-Wisp
- Destiny Bond

Excadrill @ Excadrite
Ability: Mold Breaker
Tera Type: Ground
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake
- Iron Head
- Rock Slide
- Swords Dance
`;

let cached = null;
export function sampleTeams() {
  if (!cached) cached = importTeams(SINGLES);
  // Fresh copies so edits never touch the originals.
  return cached.map(t => JSON.parse(JSON.stringify(t)));
}

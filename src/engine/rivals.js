// The rivals you can battle against the computer: each one's Pokémon from
// their strongest battle in the games (filled out to six from their other
// battles where needed), on competitive sets for Champions rules.
import {importTeams} from './team.js';

export const RIVALS = [
  {
    id: 'blue', name: 'Blue', aka: 'Gary', game: 'Pokémon Red & Blue', region: 'Kanto', ace: 'Blastoise-Mega',
    line: 'Smell ya later? Not this time. I\'m the Champion, remember?',
    team: `
Pidgeot @ Life Orb
Ability: Keen Eye
Tera Type: Normal
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Hurricane
- Heat Wave
- Roost
- U-turn

Alakazam @ Focus Sash
Ability: Magic Guard
Tera Type: Psychic
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Psychic
- Focus Blast
- Shadow Ball
- Nasty Plot

Rhydon @ Eviolite
Ability: Lightning Rod
Tera Type: Ground
SPs: 32 HP / 32 Atk / 2 Def
Adamant Nature
- Earthquake
- Stone Edge
- Megahorn
- Stealth Rock

Exeggutor @ Sitrus Berry
Ability: Harvest
Tera Type: Grass
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Giga Drain
- Psychic
- Sleep Powder
- Leech Seed

Arcanine @ Choice Band
Ability: Intimidate
Tera Type: Normal
SPs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Flare Blitz
- Extreme Speed
- Wild Charge
- Close Combat

Blastoise @ Blastoisinite
Ability: Torrent
Tera Type: Water
SPs: 32 HP / 32 SpA / 2 Spe
Modest Nature
- Water Pulse
- Aura Sphere
- Dark Pulse
- Ice Beam`,
  },
  {
    id: 'silver', name: 'Silver', game: 'HeartGold & SoulSilver', region: 'Johto', ace: 'Feraligatr',
    line: 'Strength is everything. I\'ll prove it with Pokémon I raised myself.',
    team: `
Weavile @ Choice Band
Ability: Pressure
Tera Type: Dark
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Knock Off
- Triple Axel
- Ice Shard
- Low Kick

Crobat @ Heavy-Duty Boots
Ability: Inner Focus
Tera Type: Flying
SPs: 32 HP / 2 Def / 32 Spe
Jolly Nature
- Brave Bird
- Cross Poison
- U-turn
- Roost

Magnezone @ Choice Specs
Ability: Magnet Pull
Tera Type: Electric
SPs: 32 HP / 32 SpA / 2 Spe
Modest Nature
- Thunderbolt
- Flash Cannon
- Volt Switch
- Body Press

Gengar @ Gengarite
Ability: Cursed Body
Tera Type: Ghost
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Shadow Ball
- Sludge Bomb
- Focus Blast
- Destiny Bond

Alakazam @ Life Orb
Ability: Magic Guard
Tera Type: Fairy
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Psychic
- Focus Blast
- Dazzling Gleam
- Calm Mind

Feraligatr @ Leftovers
Ability: Sheer Force
Tera Type: Water
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Dragon Dance
- Liquidation
- Ice Punch
- Crunch`,
  },
  {
    id: 'may', name: 'May', game: 'Omega Ruby & Alpha Sapphire', region: 'Hoenn', ace: 'Blaziken-Mega',
    line: 'Dad always said you\'d be tough. Let\'s find out how tough!',
    team: `
Swellow @ Flame Orb
Ability: Guts
Tera Type: Normal
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Facade
- Brave Bird
- U-turn
- Quick Attack

Breloom @ Focus Sash
Ability: Technician
Tera Type: Fighting
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Spore
- Mach Punch
- Bullet Seed
- Rock Tomb

Magcargo @ White Herb
Ability: Weak Armor
Tera Type: Grass
SPs: 32 HP / 32 SpA / 2 Def
Modest Nature
- Shell Smash
- Fire Blast
- Earth Power
- Ancient Power

Wailord @ Sitrus Berry
Ability: Water Veil
Tera Type: Water
SPs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Scald
- Ice Beam
- Rest
- Heavy Slam

Sceptile @ Life Orb
Ability: Unburden
Tera Type: Grass
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Leaf Storm
- Dragon Pulse
- Focus Blast
- Giga Drain

Blaziken @ Blazikenite
Ability: Speed Boost
Tera Type: Fire
SPs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Flare Blitz
- Close Combat
- Knock Off
- Swords Dance`,
  },
  {
    id: 'brendan', name: 'Brendan', game: 'Omega Ruby & Alpha Sapphire', region: 'Hoenn', ace: 'Swampert-Mega',
    line: 'Fieldwork taught me plenty. Now let me show you what my team learned.',
    team: `
Swellow @ Choice Scarf
Ability: Scrappy
Tera Type: Normal
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Brave Bird
- Double-Edge
- U-turn
- Quick Attack

Breloom @ Life Orb
Ability: Technician
Tera Type: Grass
SPs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Spore
- Mach Punch
- Bullet Seed
- Swords Dance

Magcargo @ Leftovers
Ability: Flame Body
Tera Type: Fire
SPs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Lava Plume
- Stealth Rock
- Recover
- Earth Power

Wailord @ Choice Specs
Ability: Pressure
Tera Type: Water
SPs: 32 HP / 32 SpA / 2 Spe
Modest Nature
- Water Spout
- Hydro Pump
- Ice Beam
- Hyper Voice

Sceptile @ Focus Sash
Ability: Overgrow
Tera Type: Dragon
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Leaf Storm
- Dragon Pulse
- Focus Blast
- Earthquake

Swampert @ Swampertite
Ability: Torrent
Tera Type: Water
SPs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Waterfall
- Earthquake
- Ice Punch
- Superpower`,
  },
  {
    id: 'wally', name: 'Wally', game: 'Omega Ruby & Alpha Sapphire', region: 'Hoenn', ace: 'Gallade-Mega',
    line: 'I\'m not the kid who caught a Ralts with your help anymore. Watch me.',
    team: `
Altaria @ Leftovers
Ability: Natural Cure
Tera Type: Steel
SPs: 32 HP / 2 Atk / 32 Spe
Jolly Nature
- Dragon Dance
- Earthquake
- Roost
- Dragon Claw

Delcatty @ Sitrus Berry
Ability: Wonder Skin
Tera Type: Normal
SPs: 32 HP / 32 Spe / 2 SpD
Jolly Nature
- Fake Out
- Double-Edge
- Thunder Wave
- Sucker Punch

Roserade @ Focus Sash
Ability: Natural Cure
Tera Type: Grass
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Leaf Storm
- Sludge Bomb
- Spikes
- Shadow Ball

Magnezone @ Assault Vest
Ability: Sturdy
Tera Type: Flying
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Thunderbolt
- Flash Cannon
- Volt Switch
- Tri Attack

Gardevoir @ Choice Specs
Ability: Trace
Tera Type: Fairy
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Moonblast
- Psychic
- Mystical Fire
- Trick

Gallade @ Galladite
Ability: Sharpness
Tera Type: Fighting
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Sacred Sword
- Psycho Cut
- Leaf Blade
- Swords Dance`,
  },
  {
    id: 'barry', name: 'Barry', game: 'Pokémon Platinum', region: 'Sinnoh', ace: 'Infernape',
    line: 'I\'m gonna fine you a million dollars if you lose... wait, I mean if I lose!',
    team: `
Staraptor @ Choice Band
Ability: Reckless
Tera Type: Flying
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Brave Bird
- Close Combat
- Double-Edge
- U-turn

Floatzel @ Life Orb
Ability: Water Veil
Tera Type: Water
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Wave Crash
- Ice Spinner
- Bulk Up
- Aqua Jet

Roserade @ Black Sludge
Ability: Natural Cure
Tera Type: Poison
SPs: 32 HP / 32 SpA / 2 Spe
Modest Nature
- Giga Drain
- Sludge Bomb
- Toxic Spikes
- Synthesis

Snorlax @ Leftovers
Ability: Thick Fat
Tera Type: Normal
SPs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Body Slam
- Heavy Slam
- Curse
- Rest

Heracross @ Heracronite
Ability: Guts
Tera Type: Bug
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Close Combat
- Pin Missile
- Rock Blast
- Swords Dance

Infernape @ Focus Sash
Ability: Iron Fist
Tera Type: Fire
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Flare Blitz
- Close Combat
- Mach Punch
- Thunder Punch`,
  },
  {
    id: 'cheren', name: 'Cheren', game: 'Pokémon Black & White', region: 'Unova', ace: 'Samurott',
    line: 'Being strong isn\'t enough. I want to know what it means to be a Champion.',
    team: `
Unfezant @ Life Orb
Ability: Super Luck
Tera Type: Flying
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Brave Bird
- Night Slash
- U-turn
- Quick Attack

Liepard @ Focus Sash
Ability: Prankster
Tera Type: Dark
SPs: 32 HP / 2 Def / 32 Spe
Jolly Nature
- Foul Play
- Thunder Wave
- Encore
- Knock Off

Simisear @ Choice Specs
Ability: Blaze
Tera Type: Fire
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Fire Blast
- Flamethrower
- Focus Blast
- Grass Knot

Gigalith @ Leftovers
Ability: Sand Stream
Tera Type: Rock
SPs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Stone Edge
- Earthquake
- Stealth Rock
- Heavy Slam

Stoutland @ Silk Scarf
Ability: Scrappy
Tera Type: Normal
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Return
- Crunch
- Play Rough
- Wild Charge

Samurott @ Choice Band
Ability: Torrent
Tera Type: Water
SPs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Liquidation
- Megahorn
- Knock Off
- Aqua Jet`,
  },
  {
    id: 'hugh', name: 'Hugh', game: 'Black 2 & White 2', region: 'Unova', ace: 'Emboar',
    line: 'I fight for the people who can\'t. Don\'t hold anything back.',
    team: `
Unfezant @ Sharp Beak
Ability: Super Luck
Tera Type: Normal
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Brave Bird
- Return
- U-turn
- Roost

Simipour @ Life Orb
Ability: Torrent
Tera Type: Water
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Hydro Pump
- Ice Beam
- Focus Blast
- Nasty Plot

Bouffalant @ Choice Band
Ability: Reckless
Tera Type: Normal
SPs: 32 HP / 32 Atk / 2 Spe
Adamant Nature
- Head Charge
- Earthquake
- Megahorn
- Close Combat

Flygon @ Choice Scarf
Ability: Levitate
Tera Type: Ground
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Earthquake
- Outrage
- U-turn
- Stone Edge

Eelektross @ Assault Vest
Ability: Levitate
Tera Type: Electric
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Thunderbolt
- Flamethrower
- Giga Drain
- Knock Off

Emboar @ Fightinium Z
Ability: Blaze
Tera Type: Fire
SPs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Flare Blitz
- Close Combat
- Wild Charge
- Bulk Up`,
  },
  {
    id: 'calem', name: 'Calem', game: 'Pokémon X & Y', region: 'Kalos', ace: 'Greninja',
    line: 'I wanted to surpass my parents. Now I just want to beat you.',
    team: `
Meowstic @ Light Clay
Ability: Prankster
Tera Type: Psychic
SPs: 32 HP / 2 Def / 32 Spe
Timid Nature
- Reflect
- Light Screen
- Psychic
- Thunder Wave

Flareon @ Choice Band
Ability: Guts
Tera Type: Normal
SPs: 32 HP / 32 Atk / 2 Spe
Adamant Nature
- Flare Blitz
- Facade
- Quick Attack
- Superpower

Altaria @ Altarianite
Ability: Natural Cure
Tera Type: Dragon
SPs: 32 HP / 2 Atk / 32 Spe
Jolly Nature
- Dragon Dance
- Return
- Earthquake
- Roost

Clefable @ Leftovers
Ability: Magic Guard
Tera Type: Fairy
SPs: 32 HP / 32 SpA / 2 Def
Modest Nature
- Moonblast
- Flamethrower
- Calm Mind
- Moonlight

Absol @ Focus Sash
Ability: Super Luck
Tera Type: Dark
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Sucker Punch
- Knock Off
- Swords Dance
- Play Rough

Greninja @ Life Orb
Ability: Protean
Tera Type: Water
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Hydro Pump
- Dark Pulse
- Ice Beam
- Water Shuriken`,
  },
  {
    id: 'serena', name: 'Serena', game: 'Pokémon X & Y', region: 'Kalos', ace: 'Delphox',
    line: 'I finally know what I want. Right now, it\'s to win this battle.',
    team: `
Meowstic @ Leftovers
Ability: Prankster
Tera Type: Fairy
SPs: 32 HP / 2 Def / 32 Spe
Timid Nature
- Yawn
- Psyshock
- Thunder Wave
- Reflect

Jolteon @ Choice Specs
Ability: Volt Absorb
Tera Type: Electric
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Thunderbolt
- Volt Switch
- Shadow Ball
- Alluring Voice

Altaria @ Altarianite
Ability: Natural Cure
Tera Type: Fairy
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Hyper Voice
- Fire Blast
- Roost
- Draco Meteor

Clefable @ Sitrus Berry
Ability: Unaware
Tera Type: Steel
SPs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Moonblast
- Moonlight
- Knock Off
- Stealth Rock

Absol @ Life Orb
Ability: Justified
Tera Type: Dark
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Knock Off
- Sucker Punch
- Close Combat
- Swords Dance

Delphox @ Firium Z
Ability: Blaze
Tera Type: Fire
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Fire Blast
- Psyshock
- Nasty Plot
- Grass Knot`,
  },
  {
    id: 'hau', name: 'Hau', game: 'Ultra Sun & Ultra Moon', region: 'Alola', ace: 'Primarina',
    line: 'Malasadas after this, win or lose. But I\'m playing to win!',
    team: `
Raichu-Alola @ Aloraichium Z
Ability: Surge Surfer
Tera Type: Electric
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Thunderbolt
- Psyshock
- Focus Blast
- Nasty Plot

Tauros @ Choice Band
Ability: Intimidate
Tera Type: Normal
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Double-Edge
- Close Combat
- Earthquake
- Zen Headbutt

Noivern @ Choice Specs
Ability: Infiltrator
Tera Type: Dragon
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Draco Meteor
- Hurricane
- Flamethrower
- U-turn

Crabominable @ Assault Vest
Ability: Iron Fist
Tera Type: Fighting
SPs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Drain Punch
- Ice Hammer
- Earthquake
- Thunder Punch

Leafeon @ Life Orb
Ability: Chlorophyll
Tera Type: Grass
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Leaf Blade
- Knock Off
- Swords Dance
- X-Scissor

Primarina @ Leftovers
Ability: Liquid Voice
Tera Type: Water
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Hyper Voice
- Moonblast
- Psychic
- Calm Mind`,
  },
  {
    id: 'gladion', name: 'Gladion', game: 'Ultra Sun & Ultra Moon', region: 'Alola', ace: 'Silvally',
    line: 'Lucky you. You get to see what Silvally and I can really do.',
    team: `
Crobat @ Choice Band
Ability: Infiltrator
Tera Type: Flying
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Brave Bird
- Cross Poison
- U-turn
- Super Fang

Zoroark @ Choice Specs
Ability: Illusion
Tera Type: Dark
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Dark Pulse
- Focus Blast
- Flamethrower
- Sludge Bomb

Weavile @ Focus Sash
Ability: Pressure
Tera Type: Ice
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Knock Off
- Triple Axel
- Ice Shard
- Swords Dance

Porygon-Z @ Choice Scarf
Ability: Adaptability
Tera Type: Normal
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Tri Attack
- Shadow Ball
- Ice Beam
- Thunderbolt

Lucario @ Steelium Z
Ability: Inner Focus
Tera Type: Steel
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Swords Dance
- Meteor Mash
- Close Combat
- Extreme Speed

Silvally-Fire @ Fire Memory
Ability: RKS System
Tera Type: Fire
SPs: 32 HP / 32 Atk / 2 Spe
Adamant Nature
- Multi-Attack
- Crunch
- Swords Dance
- Parting Shot`,
  },
  {
    id: 'hop', name: 'Hop', game: 'Pokémon Sword & Shield', region: 'Galar', ace: 'Cinderace-Gmax',
    line: 'My brother\'s the greatest. So beating you is the next best thing!',
    team: `
Dubwool @ Leftovers
Ability: Fluffy
Tera Type: Normal
SPs: 32 HP / 32 Def / 2 SpD
Impish Nature
- Body Press
- Cotton Guard
- Double-Edge
- Rest

Corviknight @ Rocky Helmet
Ability: Pressure
Tera Type: Dragon
SPs: 32 HP / 32 Def / 2 SpD
Impish Nature
- Brave Bird
- Body Press
- Roost
- Bulk Up

Snorlax @ Assault Vest
Ability: Thick Fat
Tera Type: Ghost
SPs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Double-Edge
- Heavy Slam
- Crunch
- Earthquake

Cramorant @ Choice Specs
Ability: Gulp Missile
Tera Type: Water
SPs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Surf
- Hurricane
- Ice Beam
- Roost

Pincurchin @ Sitrus Berry
Ability: Electric Surge
Tera Type: Electric
SPs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Zing Zap
- Spikes
- Liquidation
- Sucker Punch

Cinderace @ Life Orb
Ability: Libero
Tera Type: Fire
Gigantamax: Yes
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Pyro Ball
- High Jump Kick
- Gunk Shot
- U-turn`,
  },
  {
    id: 'bede', name: 'Bede', game: 'Pokémon Sword & Shield', region: 'Galar', ace: 'Hatterene-Gmax',
    line: 'Fairies are elegant. Losing to one should feel like an honor.',
    team: `
Mawile @ Mawilite
Ability: Intimidate
Tera Type: Fairy
SPs: 32 HP / 32 Atk / 2 Def
Adamant Nature
- Play Rough
- Iron Head
- Sucker Punch
- Swords Dance

Gardevoir @ Choice Specs
Ability: Trace
Tera Type: Fairy
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Moonblast
- Psychic
- Mystical Fire
- Trick

Rapidash-Galar @ Life Orb
Ability: Pastel Veil
Tera Type: Psychic
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Psycho Cut
- Play Rough
- Swords Dance
- High Horsepower

Hatterene @ Leftovers
Ability: Magic Bounce
Tera Type: Psychic
Gigantamax: Yes
SPs: 32 HP / 32 SpA / 2 Def
Quiet Nature
- Psyshock
- Draining Kiss
- Calm Mind
- Mystical Fire

Reuniclus @ Rocky Helmet
Ability: Magic Guard
Tera Type: Fighting
SPs: 32 HP / 32 SpA / 2 Def
Modest Nature
- Psyshock
- Focus Blast
- Recover
- Calm Mind

Gothitelle @ Sitrus Berry
Ability: Shadow Tag
Tera Type: Dark
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Psychic
- Thunderbolt
- Thunder Wave
- Shadow Ball`,
  },
  {
    id: 'marnie', name: 'Marnie', game: 'Pokémon Sword & Shield', region: 'Galar', ace: 'Grimmsnarl-Gmax',
    line: 'Team Yell can cheer all they want. This one\'s between you and me.',
    team: `
Liepard @ Focus Sash
Ability: Prankster
Tera Type: Dark
SPs: 32 HP / 2 Def / 32 Spe
Jolly Nature
- Foul Play
- Thunder Wave
- Fake Out
- Encore

Toxicroak @ Life Orb
Ability: Dry Skin
Tera Type: Poison
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Drain Punch
- Gunk Shot
- Sucker Punch
- Swords Dance

Scrafty @ Assault Vest
Ability: Intimidate
Tera Type: Fighting
SPs: 32 HP / 32 Atk / 2 SpD
Careful Nature
- Drain Punch
- Knock Off
- Fake Out
- Ice Punch

Morpeko @ Choice Band
Ability: Hunger Switch
Tera Type: Electric
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Aura Wheel
- Knock Off
- Psychic Fangs
- Fake Out

Obstagoon @ Flame Orb
Ability: Guts
Tera Type: Normal
SPs: 32 HP / 32 Atk / 2 Spe
Adamant Nature
- Facade
- Knock Off
- Close Combat
- Obstruct

Grimmsnarl @ Light Clay
Ability: Prankster
Tera Type: Dark
Gigantamax: Yes
SPs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Spirit Break
- Darkest Lariat
- Reflect
- Light Screen`,
  },
  {
    id: 'nemona', name: 'Nemona', game: 'Pokémon Scarlet & Violet', region: 'Paldea', ace: 'Quaquaval',
    line: 'This is the battle I\'ve been waiting for since the day we met!',
    team: `
Lycanroc @ Choice Band
Ability: Sand Rush
Tera Type: Rock
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Stone Edge
- Accelerock
- Close Combat
- Psychic Fangs

Goodra @ Assault Vest
Ability: Sap Sipper
Tera Type: Dragon
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Draco Meteor
- Fire Blast
- Sludge Bomb
- Thunderbolt

Dudunsparce @ Leftovers
Ability: Serene Grace
Tera Type: Normal
SPs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Hyper Drill
- Glare
- Roost
- Earthquake

Orthworm @ Sitrus Berry
Ability: Earth Eater
Tera Type: Steel
SPs: 32 HP / 32 Def / 2 SpD
Impish Nature
- Shed Tail
- Iron Head
- Stealth Rock
- Body Press

Pawmot @ Focus Sash
Ability: Iron Fist
Tera Type: Electric
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Double Shock
- Close Combat
- Ice Punch
- Mach Punch

Quaquaval @ Life Orb
Ability: Moxie
Tera Type: Water
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Aqua Step
- Close Combat
- Ice Spinner
- Swords Dance`,
  },
  {
    id: 'arven', name: 'Arven', game: 'Pokémon Scarlet & Violet', region: 'Paldea', ace: 'Mabosstiff',
    line: 'Cooking and battling are the same: get the ingredients right and you win.',
    team: `
Greedent @ Sitrus Berry
Ability: Cheek Pouch
Tera Type: Normal
SPs: 32 HP / 32 Atk / 2 Def
Adamant Nature
- Body Slam
- Earthquake
- Swords Dance
- Payback

Cloyster @ White Herb
Ability: Skill Link
Tera Type: Ice
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Shell Smash
- Icicle Spear
- Rock Blast
- Ice Shard

Scovillain @ Choice Specs
Ability: Chlorophyll
Tera Type: Fire
SPs: 2 HP / 32 SpA / 32 Spe
Modest Nature
- Fire Blast
- Energy Ball
- Overheat
- Grass Knot

Toedscruel @ Heavy-Duty Boots
Ability: Mycelium Might
Tera Type: Ground
SPs: 32 HP / 32 SpD / 2 Def
Calm Nature
- Earth Power
- Giga Drain
- Spikes
- Rapid Spin

Garganacl @ Leftovers
Ability: Purifying Salt
Tera Type: Rock
SPs: 32 HP / 32 Def / 2 SpD
Impish Nature
- Salt Cure
- Recover
- Stealth Rock
- Body Press

Mabosstiff @ Choice Band
Ability: Intimidate
Tera Type: Dark
SPs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Crunch
- Psychic Fangs
- Play Rough
- Fire Fang`,
  },
  {
    id: 'penny', name: 'Penny', game: 'Pokémon Scarlet & Violet', region: 'Paldea', ace: 'Sylveon',
    line: '...Fine. One battle. But my Eevee family doesn\'t lose.',
    team: `
Vaporeon @ Leftovers
Ability: Water Absorb
Tera Type: Fairy
SPs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Scald
- Wish
- Protect
- Ice Beam

Jolteon @ Choice Specs
Ability: Volt Absorb
Tera Type: Electric
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Thunderbolt
- Volt Switch
- Shadow Ball
- Hyper Voice

Flareon @ Flame Orb
Ability: Guts
Tera Type: Normal
SPs: 32 HP / 32 Atk / 2 Spe
Adamant Nature
- Flare Blitz
- Facade
- Quick Attack
- Superpower

Leafeon @ Life Orb
Ability: Chlorophyll
Tera Type: Grass
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Leaf Blade
- Knock Off
- Swords Dance
- Double-Edge

Umbreon @ Black Glasses
Ability: Synchronize
Tera Type: Poison
SPs: 32 HP / 2 Def / 32 SpD
Careful Nature
- Foul Play
- Wish
- Protect
- Yawn

Sylveon @ Choice Band
Ability: Pixilate
Tera Type: Fairy
SPs: 32 HP / 32 SpA / 2 Spe
Modest Nature
- Hyper Voice
- Psyshock
- Shadow Ball
- Mystical Fire`,
  },
  {
    id: 'kieran', name: 'Kieran', game: 'The Indigo Disk', region: 'Blueberry Academy', ace: 'Hydrapple',
    line: 'I trained until it hurt. I\'m not losing to you again.',
    team: `
Politoed @ Damp Rock
Ability: Drizzle
Tera Type: Water
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Weather Ball
- Ice Beam
- Encore
- Hypnosis

Dragonite @ Choice Band
Ability: Multiscale
Tera Type: Normal
SPs: 32 HP / 32 Atk / 2 Spe
Adamant Nature
- Extreme Speed
- Dragon Claw
- Earthquake
- Fire Punch

Grimmsnarl @ Light Clay
Ability: Prankster
Tera Type: Fairy
SPs: 32 HP / 32 Atk / 2 Def
Adamant Nature
- Spirit Break
- Sucker Punch
- Reflect
- Light Screen

Porygon-Z @ Life Orb
Ability: Adaptability
Tera Type: Normal
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Tri Attack
- Shadow Ball
- Nasty Plot
- Ice Beam

Incineroar @ Sitrus Berry
Ability: Intimidate
Tera Type: Fire
SPs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Flare Blitz
- Knock Off
- Fake Out
- Parting Shot

Hydrapple @ Assault Vest
Ability: Regenerator
Tera Type: Fighting
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Fickle Beam
- Giga Drain
- Earth Power
- Draco Meteor`,
  },
  {
    id: 'taunie', name: 'Taunie', game: 'Pokémon Legends: Z-A', region: 'Lumiose City', ace: 'Meganium-Mega',
    line: 'We\'ve battled all over Lumiose. This is the one that settles it.',
    team: `
Meowstic @ Meowsticite
Ability: Prankster
Tera Type: Psychic
SPs: 32 HP / 32 SpA / 2 Spe
Modest Nature
- Psychic
- Thunder Wave
- Reflect
- Light Screen

Goodra @ Assault Vest
Ability: Sap Sipper
Tera Type: Dragon
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Draco Meteor
- Sludge Bomb
- Fire Blast
- Thunderbolt

Avalugg @ Leftovers
Ability: Sturdy
Tera Type: Ice
SPs: 32 HP / 32 Def / 2 Atk
Impish Nature
- Avalanche
- Body Press
- Recover
- Rapid Spin

Meganium @ Meganiumite
Ability: Overgrow
Tera Type: Grass
SPs: 32 HP / 32 SpA / 2 Spe
Modest Nature
- Giga Drain
- Energy Ball
- Synthesis
- Leech Seed

Manectric @ Manectite
Ability: Lightning Rod
Tera Type: Electric
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Thunderbolt
- Overheat
- Volt Switch
- Hidden Power

Feraligatr @ Feraligite
Ability: Sheer Force
Tera Type: Water
SPs: 2 HP / 32 Atk / 32 Spe
Jolly Nature
- Liquidation
- Ice Punch
- Crunch
- Dragon Dance`,
  },
  {
    id: 'urbain', name: 'Urbain', game: 'Pokémon Legends: Z-A', region: 'Lumiose City', ace: 'Emboar-Mega',
    line: 'Lumiose made us both stronger. Let\'s see who it made strongest.',
    team: `
Meowstic @ Meowsticite
Ability: Prankster
Tera Type: Fairy
SPs: 32 HP / 32 SpA / 2 Spe
Timid Nature
- Psyshock
- Thunder Wave
- Yawn
- Light Screen

Goodra @ Assault Vest
Ability: Gooey
Tera Type: Dragon
SPs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Draco Meteor
- Hydro Pump
- Fire Blast
- Sludge Bomb

Avalugg @ Rocky Helmet
Ability: Own Tempo
Tera Type: Ice
SPs: 32 HP / 32 Def / 2 Atk
Impish Nature
- Avalanche
- Body Press
- Recover
- Earthquake

Emboar @ Emboarite
Ability: Reckless
Tera Type: Fire
SPs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Flare Blitz
- Close Combat
- Head Smash
- Wild Charge

Manectric @ Manectite
Ability: Static
Tera Type: Electric
SPs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Thunderbolt
- Flamethrower
- Volt Switch
- Snarl

Meganium @ Meganiumite
Ability: Leaf Guard
Tera Type: Grass
SPs: 32 HP / 32 Def / 2 SpD
Bold Nature
- Giga Drain
- Leech Seed
- Synthesis
- Toxic`,
  },
];

let built = null;
/** {id: team} for every rival, built once. */
export function rivalTeams() {
  if (!built) {
    built = {};
    for (const r of RIVALS) {
      const [team] = importTeams(r.team, `${r.name}'s team`);
      team.id = `rival-${r.id}`;
      team.name = `${r.name}'s team`;
      built[r.id] = team;
    }
  }
  return built;
}

/** Has every rival been beaten on this difficulty? `wins` is {rivalId: [levels]}. */
export function beatEveryRival(wins, level = 'champion') {
  return RIVALS.every(r => wins?.[r.id]?.includes(level));
}

export function rivalById(id) {
  return RIVALS.find(r => r.id === id) || null;
}

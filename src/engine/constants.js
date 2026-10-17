// Champions-style rules shared by the team builder, the validator and the battle engine.

export const LEVEL = 50;
export const IV = 31;
export const SP_TOTAL = 66; // stat points per Pokémon
export const SP_MAX = 32; // stat points in any one stat
export const TEAM_SIZE = 6;
export const MAX_MOVES = 4;

export const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABELS = {hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'};
export const STAT_NAMES = {
  hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed',
};

export const TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];
export const TERA_TYPES = [...TYPES, 'Stellar'];

// Both modes are one player against one player; the mode only changes how many
// Pokémon each player has out at once.
export const MODES = {
  singles: {id: 'singles', label: 'Singles', active: 1, blurb: '1 Pokémon out each'},
  doubles: {id: 'doubles', label: 'Doubles', active: 2, blurb: '2 Pokémon out each'},
};

// Team clauses, as in Pokémon Champions / VGC. Species Clause also keeps names
// unique, which the battle protocol relies on.
export const RULES = {
  speciesClause: true,
  itemClause: true,
};

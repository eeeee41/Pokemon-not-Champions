// Which version of the battle engine this page runs. Two browsers only play
// each other when it matches, because both must simulate the battle in exactly
// the same way. The build stamps it with a hash of the engine, the online code
// and the Pokémon data (see scripts/build.mjs); in tests it is 'dev'.
/* global __BATTLE_VERSION__ */
export const BATTLE_VERSION = typeof __BATTLE_VERSION__ === 'string' ? __BATTLE_VERSION__ : 'dev';

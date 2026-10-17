// The simulator ships every generation's learnsets and older-generation data.
// Battles only need Gen 9 data, and the team builder uses our compact
// learnsets, so those modules are swapped for empty stand-ins in the browser.
const STUBS = [
  {re: /[\\/]data[\\/](mods[\\/][^\\/]+[\\/])?learnsets\.m?js$/, code: 'export const Learnsets = {};'},
  {re: /[\\/]data[\\/](mods[\\/][^\\/]+[\\/])?legality\.m?js$/, code: 'export const Legality = {};'},
  {re: /[\\/]data[\\/]pokemongo\.m?js$/, code: 'export const PokemonGoData = {};'},
  {re: /[\\/]data[\\/]mods[\\/]gen[1-8][a-z]*[\\/]index\.m?js$/, code: 'export const Scripts = {};'},
];
export const slimSim = {
  name: 'slim-sim',
  setup(build) {
    build.onLoad({filter: /@pkmn[\\/]sim[\\/]build[\\/]esm[\\/]data[\\/].*\.m?js$/}, args => {
      const stub = STUBS.find(s => s.re.test(args.path));
      return stub ? {contents: stub.code, loader: 'js'} : undefined;
    });
  },
};

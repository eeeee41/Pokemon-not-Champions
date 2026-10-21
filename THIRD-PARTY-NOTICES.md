# Third-party notices

This site's own code is licensed under the GNU Affero General Public License v3.0 (see `LICENSE`).
It includes or uses the following.

## Pokémon Showdown move animations (`vendor/showdown/`)

From [smogon/pokemon-showdown-client](https://github.com/smogon/pokemon-showdown-client), commit
`0de26d2ef7258e5619057f63b3774240b45cecbd`, copied by `scripts/vendor-showdown-anims.mjs`. By Guangcong Luo and the Pokémon
Showdown contributors.

- `battle-animations.ts` (the animation tables): MIT License, as its header says.
- `battle-animations-moves.ts`: CC0-1.0 (public domain), as its header says.

MIT License, for `battle-animations.ts`:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions: The above copyright notice and this
> permission notice shall be included in all copies or substantial portions of the Software.
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
> OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Pokémon Showdown effect images (`public/assets/showdown-fx/`)

The 65 images those animations use, from the same repository's `play.pokemonshowdown.com/fx/`.
Pokémon Showdown's client as a whole is licensed under AGPL-3.0, and these files carry no other
licence. Credits, as noted in Showdown's source:

- `icicle.png`: http://opengameart.org/content/icicle-spell
- `icicle-pink.png`: http://opengameart.org/content/icicle-spell, recolored by Kalalokki
- `lightning.png`: by Pokemon Showdown user SailorCosmos
- `rocks.png`: Pokemon Online - Gilad
- `rock1.png`: Pokemon Online - Gilad
- `rock2.png`: Pokemon Online - Gilad
- `rock3.png`: by Pokemon Showdown user SailorCosmos
- `caltrop.png`: by Pokemon Showdown user SailorCosmos
- `greenmetal1.png`: by Pokemon Showdown user Kalalokki
- `greenmetal2.png`: by Pokemon Showdown user Kalalokki
- `poisoncaltrop.png`: by Pokemon Showdown user SailorCosmos
- `moon.png`: by Kalalokki
- `fist.png`: by Pokemon Showdown user SailorCosmos
- `foot.png`: by Pokemon Showdown user SailorCosmos
- `web.png`: by Pokemon Showdown user SailorCosmos
- `leftslash.png`: by Pokemon Showdown user Modeling Clay
- `rightslash.png`: by Pokemon Showdown user Modeling Clay
- `leftchop.png`: by Pokemon Showdown user SailorCosmos
- `rightchop.png`: by Pokemon Showdown user SailorCosmos
- `angry.png`: by Pokemon Showdown user SailorCosmos
- `heart.png`: by Pokemon Showdown user SailorCosmos
- `pointer.png`: by Pokemon Showdown user SailorCosmos
- `sword.png`: by Pokemon Showdown user SailorCosmos
- `impact.png`: by Pokemon Showdown user SailorCosmos
- `shine.png`: by Smogon user Jajoken
- `feather.png`: Ripped from http://www.clker.com/clipart-black-and-white-feather.html
- `shell.png`: by Smogon user Jajoken
- `petal.png`: by Smogon user Jajoken
- `gear.png`: by Smogon user Jajoken
- `alpha.png`: Ripped from Pokemon Global Link
- `omega.png`: Ripped from Pokemon Global Link
- `z-symbol.png`: From http://froggybutt.deviantart.com/art/Pokemon-Z-Move-symbol-633125033
- `ultra.png`: by Pokemon Showdown user Modeling Clay
- `hitmarker.png`: by Pokemon Showdown user Ridaz

## Other libraries

- [@pkmn/sim, @pkmn/client, @pkmn/data, @pkmn/protocol, @pkmn/view](https://github.com/pkmn): MIT
  (the battle engine, from Pokémon Showdown).
- [Preact](https://preactjs.com/): MIT. [jQuery](https://jquery.com/): MIT (used by the move
  animations). [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk): Apache-2.0.
- Pokémon sprites: [Smogon's sprite project](https://www.smogon.com/forums/forums/smeargles-studio.312/).

The site's own art (MissingNo.'s and Megatron's sprites and parts, and the effects for their moves in
`public/assets/fx-custom/`) is original, drawn by `scripts/build-*.py`.

Pokémon and all related names are trademarks of Nintendo, Game Freak, Creatures and The Pokémon
Company. This is a fan project, not affiliated with any of them.

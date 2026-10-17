// What one player knows about a battle, built from the protocol lines they're
// allowed to see. Wraps @pkmn/client's Battle (state) and @pkmn/view's
// LogFormatter (battle text, from that player's perspective).
import {Battle as ClientBattle} from '@pkmn/client';
import {Generations} from '@pkmn/data';
import {Protocol} from '@pkmn/protocol';
import {LogFormatter} from '@pkmn/view';
import {Dex} from '@pkmn/sim';

const BANNED_TAGS = new Set(['CAP', 'Custom', 'LGPE']);
// Megas, Gigantamax and other past-gen content all exist in our formats.
export const gens = new Generations(Dex, d => !!d.exists && !BANNED_TAGS.has(d.isNonstandard) &&
  !(d.kind === 'Ability' && d.id === 'noability'));

export class Tracker {
  /** @param {'p1'|'p2'} perspective */
  constructor(perspective) {
    this.perspective = perspective;
    this.battle = new ClientBattle(gens, perspective);
    this.formatter = new LogFormatter(perspective, this.battle);
    this.consumed = 0;
    // The client doesn't record which Dynamax is a Gigantamax; the sprite needs it.
    this.gmax = new Set();
  }

  /** Applies one protocol line. Returns the parsed line and its battle text ('' if none). */
  step(line) {
    this.consumed++;
    const {args, kwArgs} = Protocol.parseBattleLine(line);
    let text = '';
    try {
      text = this.formatter.formatText(args, kwArgs);
    } catch (e) {
      text = '';
    }
    this.battle.add(args, kwArgs);
    const cmd = args[0];
    if ((cmd === '-start' || cmd === '-end') && String(args[2]).replace(/\W/g, '').toLowerCase() === 'dynamax') {
      const p = this.battle.getPokemon(args[1]);
      if (p) {
        if (cmd === '-start' && args[3] === 'Gmax') this.gmax.add(p);
        if (cmd === '-end') this.gmax.delete(p);
      }
    }
    return {args, kwArgs, text, line};
  }

  /** The sprite to draw for an active Pokémon (its Gigantamax form while Gigantamaxed). */
  spriteName(pokemon) {
    if (pokemon.volatiles && pokemon.volatiles.dynamax && this.gmax.has(pokemon)) return `${pokemon.speciesForme}-Gmax`;
    return pokemon.speciesForme;
  }

  /** Applies the current request (own team details, move PP, choices). */
  setRequest(request) {
    if (!request) return;
    this.battle.update(Protocol.parseRequest(typeof request === "string" ? request : JSON.stringify(request)));
  }
}

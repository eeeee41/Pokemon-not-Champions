// Helpers for turning a simulator request into choice strings.

// Move targets that need the player to pick a specific Pokémon in Doubles.
const PICK_TARGET = new Set(['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe']);

export function needsTarget(target, activeCount) {
  return activeCount > 1 && PICK_TARGET.has(target);
}

/**
 * Legal target locations for a move used by the Pokémon in slot `slot` (0-based).
 * Foes are 1..n (their slot + 1); allies are -1..-n. Returns [] if no pick is needed.
 */
export function targetOptions(target, slot, activeCount, foeAlive = [true, true], allyAlive = [true, true]) {
  if (!needsTarget(target, activeCount)) return [];
  const out = [];
  const foes = [];
  for (let i = 0; i < activeCount; i++) if (foeAlive[i]) foes.push(i + 1);
  const allies = [];
  for (let i = 0; i < activeCount; i++) {
    if (i === slot) continue;
    if (allyAlive[i]) allies.push(-(i + 1));
  }
  switch (target) {
  case 'adjacentAlly':
    out.push(...allies);
    break;
  case 'adjacentAllyOrSelf':
    out.push(-(slot + 1), ...allies);
    break;
  case 'adjacentFoe':
    out.push(...foes);
    break;
  default: // normal, any
    out.push(...foes, ...allies);
  }
  // If everything targetable is gone, the simulator still wants a location.
  if (!out.length) out.push(target === 'adjacentAlly' ? -((slot === 0 ? 1 : 0) + 1) : 1);
  return out;
}

/** A random legal choice for a request. Used by tests and for running out of time. */
export function randomChoice(request, rng = Math.random, {gimmicks = true} = {}) {
  if (!request || request.wait) return null;
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const team = request.side.pokemon;

  if (request.teamPreview) {
    const order = team.map((_, i) => i + 1);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return `team ${order.join('')}`;
  }

  const benchAvailable = () => team
    .map((p, i) => ({p, i}))
    .filter(({p}) => !p.active && !p.condition.endsWith(' fnt') && !p.commanding);
  const used = new Set();

  if (request.forceSwitch) {
    const parts = request.forceSwitch.map(must => {
      if (!must) return 'pass';
      const options = benchAvailable().filter(({i}) => !used.has(i));
      if (!options.length) return 'pass';
      const {i} = pick(options);
      used.add(i);
      return `switch ${i + 1}`;
    });
    return parts.join(', ');
  }

  if (request.active) {
    const activeCount = request.active.length;
    let gimmickUsed = {mega: false, zmove: false, dynamax: false, terastallize: false};
    const parts = request.active.map((active, slot) => {
      const me = team[slot];
      if (!me || me.condition.endsWith(' fnt') || me.commanding) return 'pass';
      const canSwitch = !active.trapped && !active.maybeTrapped;
      const switches = canSwitch ? benchAvailable().filter(({i}) => !used.has(i)) : [];
      if (switches.length && rng() < 0.15) {
        const {i} = pick(switches);
        used.add(i);
        return `switch ${i + 1}`;
      }
      let gimmick = '';
      let moveList = active.moves;
      if (gimmicks) {
        if (active.canMegaEvo && !gimmickUsed.mega && rng() < 0.6) gimmick = 'mega';
        else if (active.canDynamax && !gimmickUsed.dynamax && rng() < 0.4) gimmick = 'dynamax';
        else if (active.canTerastallize && !gimmickUsed.terastallize && rng() < 0.4) gimmick = 'terastallize';
        else if (active.canZMove && !gimmickUsed.zmove && rng() < 0.5) gimmick = 'zmove';
      }
      let options = moveList.map((m, i) => ({m, i})).filter(({m}) => !m.disabled && (m.pp === undefined || m.pp > 0 || moveList.length === 1));
      let targetOf = ({m}) => m.target;
      const isDynamaxed = !!active.maxMoves && !active.canDynamax;
      if (gimmick === 'dynamax' || isDynamaxed) {
        // Already Dynamaxed (or about to): use the Max Move targets.
        const max = active.maxMoves?.maxMoves || [];
        options = max.map((m, i) => ({m, i})).filter(({m}) => !m.disabled);
        targetOf = ({m}) => m.target;
      }
      if (gimmick === 'zmove') {
        const z = (active.canZMove || []).map((m, i) => ({m, i})).filter(({m}) => m);
        if (z.length) {
          options = z;
        } else {
          gimmick = '';
        }
      }
      if (!options.length) return active.moves.length ? 'move 1' : 'pass';
      const choice = pick(options);
      if (gimmick) gimmickUsed[gimmick] = true;
      const targets = targetOptions(targetOf(choice), slot, activeCount);
      const target = targets.length ? ` ${pick(targets)}` : '';
      return `move ${choice.i + 1}${target}${gimmick ? ' ' + gimmick : ''}`;
    });
    return parts.join(', ');
  }
  return 'default';
}

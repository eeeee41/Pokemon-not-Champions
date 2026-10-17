// The battle screen: stadium, command deck, team preview, turn replays and the log.
import {useEffect, useLayoutEffect, useReducer, useRef, useState} from 'preact/hooks';
import {dex, toID, megaOptions, megaName, itemGimmick} from '../engine/dex.js';
import {targetOptions} from '../engine/choices.js';
import {MODES, STAT_LABELS} from '../engine/constants.js';
import {FitSprite, Sprite, TypeBadge, spriteStyle} from './sprites.jsx';

// ---------- helpers ----------

function parseCondition(condition = '') {
  const [hp, status] = condition.split(' ');
  if (hp === '0') return {hp: 0, maxhp: 1, fainted: true, status: ''};
  const [cur, max] = hp.split('/').map(Number);
  return {hp: cur || 0, maxhp: max || 1, fainted: status === 'fnt', status: status && status !== 'fnt' ? status : ''};
}

function speciesOf(details = '') {
  return details.split(',')[0];
}

function hpClass(fraction) {
  if (fraction > 0.5) return '';
  if (fraction > 0.2) return 'y';
  return 'r';
}

function effectiveness(moveType, types) {
  if (!moveType || !types?.length) return null;
  if (!dex.getImmunity(moveType, types)) return 0;
  return 2 ** dex.getEffectiveness(moveType, types);
}

function effLabel(mult) {
  if (mult === null || mult === undefined) return '';
  if (mult === 0) return 'No effect';
  if (mult >= 4) return '4× effective';
  if (mult >= 2) return 'Super effective';
  if (mult <= 0.25) return '¼× effective';
  if (mult < 1) return 'Not very effective';
  return '';
}

const WEATHER_CLASS = {
  Rain: 'wx-raindance', Sun: 'wx-sunnyday', Sand: 'wx-sandstorm', Hail: 'wx-hail', Snow: 'wx-snow',
  'Heavy Rain': 'wx-primordialsea', 'Harsh Sunshine': 'wx-desolateland', 'Strong Winds': 'wx-deltastream',
};
const WEATHER_NAME = {
  Rain: 'Rain', Sun: 'Harsh sunlight', Sand: 'Sandstorm', Hail: 'Hail', Snow: 'Snow',
  'Heavy Rain': 'Heavy rain', 'Harsh Sunshine': 'Extremely harsh sunlight', 'Strong Winds': 'Strong winds',
};

// Where sprites stand, in % of the stadium. Foe slot 1 is on the right: the
// opponent faces you, so their left is your right.
const POSITIONS = {
  singles: {own: [{x: 27, y: 94}], foe: [{x: 71, y: 57}]},
  doubles: {own: [{x: 19, y: 93}, {x: 42, y: 96}], foe: [{x: 82, y: 55}, {x: 61, y: 58}]},
};

const DELAYS = {
  move: 900, switch: 750, drag: 750, replace: 650, '-damage': 600, '-heal': 500, faint: 800,
  '-mega': 1100, '-primal': 1000, '-burst': 1000, '-terastallize': 1100, '-zpower': 900,
  '-start': 600, '-end': 450, '-boost': 450, '-unboost': 450, '-status': 550, '-weather': 650,
  '-fieldstart': 650, '-sidestart': 550, '-ability': 550, '-item': 500, '-enditem': 500,
  turn: 300, win: 300, cant: 600, '-fail': 500, '-miss': 500, '-immune': 500,
};
const FX = {'-damage': 'hit', '-mega': 'flash', '-primal': 'flash', '-burst': 'flash', '-terastallize': 'flash', '-zpower': 'flash'};

function useElementWidth(ref) {
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const update = () => setWidth(ref.current ? ref.current.clientWidth : 640);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return width;
}

// ---------- stadium ----------

function FieldMon({pokemon, tracker, own, pos, unit, fx}) {
  const [anim, setAnim] = useState('enter');
  useEffect(() => {
    const t = setTimeout(() => setAnim(''), 520);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!fx) return undefined;
    setAnim(fx.type);
    const t = setTimeout(() => setAnim(''), fx.type === 'flash' ? 900 : 440);
    return () => clearTimeout(t);
  }, [fx?.n]);
  const name = tracker.spriteName(pokemon);
  const dynamax = !!pokemon.volatiles?.dynamax;
  const scale = (own ? 2.05 : 1.5) * unit * (dynamax ? 1.4 : 1);
  const tera = pokemon.terastallized;
  const classes = ['mon-body', anim, pokemon.fainted ? 'fainted' : '', dynamax ? 'dynamax' : ''].filter(Boolean).join(' ');
  return (
    <div class={`mon ${own ? 'own' : 'foe'}`} style={{left: `${pos.x}%`, top: `${pos.y}%`}}>
      <div class={classes}>
        <Sprite name={name} back={own} scale={scale} />
        {tera && <span class={`tera-crystal t-${toID(tera)}`} style={spriteStyle(name, own, scale, true)} />}
        {tera && <span class={`tera-jewel t-${toID(tera)}`} />}
      </div>
    </div>
  );
}

function InfoBox({pokemon, exact, style, compact}) {
  const fraction = pokemon.maxhp ? pokemon.hp / pokemon.maxhp : 0;
  const pct = pokemon.fainted ? 0 : Math.max(pokemon.hp > 0 ? 1 : 0, Math.round(fraction * 100));
  const boosts = Object.entries(pokemon.boosts || {}).filter(([, v]) => v);
  const isMega = /-Mega|-Primal/.test(pokemon.speciesForme);
  const gender = pokemon.gender === 'M' ? '♂' : pokemon.gender === 'F' ? '♀' : '';
  return (
    <div class={`infobox${compact ? ' compact' : ''}${pokemon.fainted ? ' fainted' : ''}`} style={style}>
      <div class="ib-top">
        <span class="ib-name">{pokemon.name}{gender && <span style={{color: gender === '♂' ? '#2563eb' : '#db2777', marginLeft: '4px'}}>{gender}</span>}</span>
        {isMega && <span class="gimmick-badge g-mega">Mega</span>}
        {pokemon.volatiles?.dynamax && <span class="gimmick-badge g-gmax">Dyna</span>}
        {pokemon.terastallized && <TypeBadge type={pokemon.terastallized} small />}
        <span class="ib-lv">Lv{pokemon.level}</span>
      </div>
      <div class="hpbar" role="meter" aria-label={`${pokemon.name} HP`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct}>
        <span class={hpClass(fraction)} style={{width: `${pokemon.fainted ? 0 : Math.max(fraction > 0 ? 1 : 0, fraction * 100)}%`}} />
      </div>
      <div class="ib-bottom">
        <span class="ib-tags">
          {pokemon.status && <span class={`status st-${pokemon.status}`}>{pokemon.status}</span>}
          {boosts.map(([stat, v]) => (
            <span key={stat} class={`boost${v < 0 ? ' neg' : ''}`}>{v > 0 ? '+' : ''}{v} {STAT_LABELS[stat] || stat}</span>
          ))}
          {pokemon.volatiles?.confusion && <span class="boost neg">Confused</span>}
          {pokemon.volatiles?.substitute && <span class="boost">Substitute</span>}
        </span>
        <span class="ib-hp num">{pokemon.fainted ? 'Fainted' : exact ? `${pokemon.hp}/${pokemon.maxhp}` : `${pct}%`}</span>
      </div>
    </div>
  );
}

function sideTags(side) {
  return Object.values(side.sideConditions || {}).map(c => (c.level > 1 ? `${c.name} ×${c.level}` : c.name));
}

export function Stadium({tracker, perspective, mode, exactOwn, fx = {}, message}) {
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const compact = width < 560;
  const unit = Math.max(0.55, Math.min(1.35, width / 640));
  const battle = tracker.battle;
  const own = perspective === 'p2' ? battle.p2 : battle.p1;
  const foe = perspective === 'p2' ? battle.p1 : battle.p2;
  const pos = POSITIONS[mode];
  const field = battle.field;
  const weather = field.weather;
  const terrain = field.terrain;
  const pseudo = Object.values(field.pseudoWeather || {}).map(p => dex.conditions.get(p.id).name || p.id);
  const fieldTags = [
    weather && (WEATHER_NAME[weather] || weather),
    terrain && `${terrain} Terrain`,
    ...pseudo,
  ].filter(Boolean);
  const count = MODES[mode].active;
  const ownActive = own.active.slice(0, count);
  const foeActive = foe.active.slice(0, count);
  // Foe boxes in the order their sprites stand (slot 2 on the left), own boxes slot 1 first.
  const foeBoxes = [...foeActive].map((p, i) => ({p, i})).reverse().filter(({p}) => p);
  const ownBoxes = ownActive.map((p, i) => ({p, i})).filter(({p}) => p);
  const hud = (boxes, exact, key) => (
    <div class="hud" style={{'--n': count}} key={key}>
      {boxes.map(({p, i}) => <InfoBox key={i} pokemon={p} exact={exact} compact />)}
    </div>
  );
  return (
    <div class="stadium" ref={ref}>
      {compact && foeBoxes.length > 0 && hud(foeBoxes, false, 'foe')}
      <div class="arena">
        <div class="arena-stands" />
        <div class="arena-lights" />
        <svg class="arena-court" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <g fill="none" stroke="rgba(255,255,255,.28)" strokeWidth=".35">
            <path d="M8 99 L28 44 L72 44 L92 99" />
            <line x1="16.5" y1="70" x2="83.5" y2="70" />
            <ellipse cx="50" cy="70" rx="9" ry="3.2" />
          </g>
        </svg>
        <div class={`arena-overlay ${weather ? WEATHER_CLASS[weather] || '' : ''}`} />
        <div class={`arena-overlay ${terrain ? `tr-${toID(terrain)}terrain` : ''}`} />
        <div class={`arena-overlay ${field.pseudoWeather?.trickroom ? 'pw-trickroom' : ''}`} />
        <div class="platform" style={{left: '72%', top: '56%', width: '42%', height: '11%'}} />
        <div class="platform" style={{left: '30%', top: '92%', width: '62%', height: '15%'}} />
        {fieldTags.length > 0 && <div class="field-tags">{fieldTags.map(t => <span key={t} class="field-tag">{t}</span>)}</div>}
        {sideTags(foe).length > 0 && <div class="side-tags foe">{sideTags(foe).map(t => <span key={t} class="field-tag">{t}</span>)}</div>}
        {sideTags(own).length > 0 && <div class="side-tags own">{sideTags(own).map(t => <span key={t} class="field-tag">{t}</span>)}</div>}
        {foeActive.map((p, i) => p && (
          <FieldMon key={`f${i}-${p.originalIdent}`} pokemon={p} tracker={tracker} own={false} pos={pos.foe[i]} unit={unit} fx={fx[`${foe.id}${'abc'[i]}`]} />
        ))}
        {ownActive.map((p, i) => p && (
          <FieldMon key={`o${i}-${p.originalIdent}`} pokemon={p} tracker={tracker} own pos={pos.own[i]} unit={unit} fx={fx[`${own.id}${'abc'[i]}`]} />
        ))}
        {!compact && foeBoxes.map(({p, i}, k) => (
          <InfoBox key={`fi${i}`} pokemon={p} exact={false} style={{left: '10px', top: `${10 + k * 64}px`}} />
        ))}
        {!compact && ownBoxes.map(({p, i}, k) => (
          <InfoBox key={`oi${i}`} pokemon={p} exact={exactOwn} style={{right: '10px', bottom: `${10 + (ownBoxes.length - 1 - k) * 64}px`}} />
        ))}
        {message && <div class="battle-msg" aria-live="polite" dangerouslySetInnerHTML={{__html: message}} />}
      </div>
      {compact && ownBoxes.length > 0 && hud(ownBoxes, exactOwn, 'own')}
    </div>
  );
}

// ---------- team preview ----------

function TeamPreview({game, player}) {
  const request = game.match.requests[player];
  const tracker = game.trackers[player];
  const team = request.side.pokemon;
  const foeSide = player === 0 ? tracker.battle.p2 : tracker.battle.p1;
  const leads = MODES[game.mode].active;
  const [order, setOrder] = useState([]);
  const [error, setError] = useState('');
  const toggle = i => setOrder(order.includes(i) ? order.filter(x => x !== i) : [...order, i]);
  const confirm = () => {
    const full = [...order, ...team.map((_, i) => i).filter(i => !order.includes(i))];
    const err = game.submit(player, `team ${full.map(i => i + 1).join('')}`);
    if (err) setError(err);
  };
  return (
    <div class="card preview">
      <div class="deck-head">
        <h3>Team preview</h3>
        <span class="muted">Tap Pokémon in the order you want them. The first {leads === 1 ? 'one leads' : 'two lead'}.</span>
      </div>
      <div class="preview-teams">
        <div class="preview-team">
          <p class="eyebrow">Your team</p>
          {team.map((p, i) => {
            const n = order.indexOf(i);
            const species = speciesOf(p.details);
            const set = game.players[player].team.mons[i];
            return (
              <button key={p.ident} class={`preview-mon${n >= 0 ? ' picked' : ''}`} onClick={() => toggle(i)} aria-pressed={n >= 0}>
                <FitSprite name={set?.gmax ? `${species}-Gmax` : species} width={56} height={48} />
                <span style={{minWidth: 0}}>
                  <span class="pm-name" style={{display: 'block'}}>{p.ident.split(': ')[1]}</span>
                  <span class="pm-sub" style={{display: 'block'}}>{dex.items.get(p.item).name || 'No item'} · {dex.abilities.get(p.baseAbility).name}</span>
                  <span style={{display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap'}}>
                    {itemGimmick(p.item, species)?.kind === 'mega' && <span class="gimmick-badge g-mega">Mega</span>}
                    {species === 'Rayquaza' && set?.moves?.some(m => toID(m) === 'dragonascent') && <span class="gimmick-badge g-mega">Mega</span>}
                    {itemGimmick(p.item, species)?.kind === 'z' && <span class="gimmick-badge g-z">Z-Move</span>}
                    {set?.gmax && <span class="gimmick-badge g-gmax">G-Max</span>}
                    {set?.teraType && <span class="gimmick-badge g-tera">Tera {set.teraType}</span>}
                  </span>
                </span>
                <span class={`order-num${n >= 0 && n < leads ? ' lead' : ''}`}>{n >= 0 ? n + 1 : ''}</span>
              </button>
            );
          })}
        </div>
        <div class="preview-team">
          <p class="eyebrow">Opponent</p>
          {foeSide.team.map((p, i) => (
            <div key={i} class="preview-mon">
              <FitSprite name={p.speciesForme.replace(/-\*$/, '')} width={56} height={48} />
              <span style={{minWidth: 0}}>
                <span class="pm-name" style={{display: 'block'}}>{p.speciesForme.replace(/-\*$/, '')}</span>
                <span class="pm-sub" style={{display: 'block'}}>{/-\*$/.test(p.speciesForme) ? 'Forme shown when it switches in' : (p.species?.types || []).join(' / ')}</span>
              </span>
              <span />
            </div>
          ))}
        </div>
      </div>
      {error && <p class="error-list" style={{listStyle: 'none', paddingLeft: 0}}>{error}</p>}
      <div class="deck-foot">
        <button class="btn btn-ghost" onClick={() => setOrder([])} disabled={!order.length}>Clear order</button>
        <button class="btn btn-primary btn-lg" onClick={confirm}>{order.length ? 'Lock in this order' : 'Use team order'}</button>
      </div>
    </div>
  );
}

// ---------- command deck ----------

const GIMMICK_LABELS = {mega: 'Mega Evolve', zmove: 'Z-Power', dynamax: 'Dynamax', terastallize: 'Terastallize'};
const GIMMICK_HINTS = {
  mega: 'It Mega Evolves before anyone moves.',
  zmove: 'Your move becomes its Z-Move.',
  dynamax: 'It Dynamaxes for 3 turns, and its moves become Max Moves.',
  terastallize: 'Its type changes to its Tera Type for the rest of the battle.',
};

function SwitchButton({p, index, disabled, onClick}) {
  const c = parseCondition(p.condition);
  const species = speciesOf(p.details);
  const fraction = c.hp / c.maxhp;
  return (
    <button class="switch-btn" disabled={disabled} onClick={() => onClick(index)} title={`${species} — ${c.fainted ? 'fainted' : `${c.hp}/${c.maxhp} HP`}`}>
      <FitSprite name={species} width={44} height={40} />
      <span style={{minWidth: 0, display: 'grid', gap: '3px'}}>
        <span class="sw-name">{p.ident.split(': ')[1]}</span>
        <span class="hpbar"><span class={hpClass(fraction)} style={{width: `${c.fainted ? 0 : fraction * 100}%`}} /></span>
        <span class="dim num" style={{fontSize: '.72rem'}}>{c.fainted ? 'Fainted' : `${c.hp}/${c.maxhp}`}{c.status ? ` · ${c.status.toUpperCase()}` : ''}</span>
      </span>
    </button>
  );
}

function CommandDeck({game, player}) {
  const request = game.match.requests[player];
  const tracker = game.trackers[player];
  const mode = game.mode;
  const team = request.side.pokemon;
  const own = player === 0 ? tracker.battle.p1 : tracker.battle.p2;
  const foe = player === 0 ? tracker.battle.p2 : tracker.battle.p1;
  const forceSwitch = request.forceSwitch;
  const actives = request.active || [];
  const slotCount = forceSwitch ? forceSwitch.length : actives.length;
  const [choices, setChoices] = useState([]);
  const [gimmick, setGimmick] = useState(null);
  const [targeting, setTargeting] = useState(null);
  const [error, setError] = useState('');

  const isOut = i => {
    const p = team[i];
    if (!p) return true;
    const c = parseCondition(p.condition);
    return c.fainted || p.commanding;
  };
  const needsDecision = i => (forceSwitch ? !!forceSwitch[i] : !!actives[i] && !isOut(i));
  const chosenSwitches = choices.filter(c => c.startsWith('switch ')).map(c => Number(c.split(' ')[1]) - 1);
  // Revival Blessing asks for a fainted Pokémon instead of a healthy one.
  const reviving = !!forceSwitch && team.some(p => p.reviving);
  const canPick = (p, i) => !p.active && !chosenSwitches.includes(i) &&
    (reviving ? parseCondition(p.condition).fainted : !parseCondition(p.condition).fainted);
  const benchFor = () => team.map((p, i) => ({p, i})).filter(({p, i}) => canPick(p, i));

  // Fill in slots that need no decision ("pass") and find the current slot.
  let slot = choices.length;
  const filled = [...choices];
  while (slot < slotCount && (!needsDecision(slot) || (forceSwitch && !benchFor().length))) {
    filled.push('pass');
    slot++;
  }

  const finish = list => {
    let all = [...list];
    let s = all.length;
    while (s < slotCount && (!needsDecision(s) || (forceSwitch && !benchFor().length))) {
      all.push('pass');
      s++;
    }
    if (all.length < slotCount) {
      setChoices(all);
      setGimmick(null);
      setTargeting(null);
      return;
    }
    const err = game.submit(player, all.join(', '));
    if (err) {
      setError(err.replace(/^\[(Invalid|Unavailable) choice\]\s*/, ''));
      setChoices([]);
      setGimmick(null);
      setTargeting(null);
    }
  };

  useEffect(() => {
    // Nothing to decide at all (e.g. a forced switch with no one left): submit passes.
    if (slot >= slotCount && choices.length < slotCount) finish(choices);
  }, [slot, slotCount]);

  const usedGimmicks = filled.map(c => c.split(' ').pop()).filter(w => GIMMICK_LABELS[w]);
  const back = () => {
    const list = [...choices];
    // Drop trailing auto-passes and the last real decision.
    while (list.length && list[list.length - 1] === 'pass') list.pop();
    list.pop();
    setChoices(list);
    setGimmick(null);
    setTargeting(null);
    setError('');
  };

  if (slot >= slotCount) return <div class="card deck"><p class="muted">Sending your choice…</p></div>;

  const currentMon = team[slot];
  const currentName = currentMon ? currentMon.ident.split(': ')[1] : '';
  const header = (
    <div class="deck-head">
      <h3>{reviving ? 'Choose a fainted Pokémon to revive' : forceSwitch ? `Send in a Pokémon${slotCount > 1 ? ` for slot ${slot + 1}` : ''}` : `What will ${currentName} do?`}</h3>
      <div class="deck-slots">
        <span class="chip chip-gold">{game.players[player].name}</span>
        {slotCount > 1 && Array.from({length: slotCount}, (_, i) => (
          <span key={i} class={`deck-slot-pill${i === slot ? ' current' : i < slot ? ' done' : ''}`}>{team[i] ? team[i].ident.split(': ')[1] : `Slot ${i + 1}`}</span>
        ))}
      </div>
    </div>
  );

  const errorLine = error && <p class="error-list" style={{listStyle: 'none', paddingLeft: 0}} role="alert">{error}</p>;
  const footer = choices.length > 0 ? (
    <div class="deck-foot">
      <button class="btn btn-ghost btn-sm" onClick={back}>← Back</button>
    </div>
  ) : null;

  if (forceSwitch) {
    return (
      <div class="card deck">
        {header}
        <div class="switch-grid">
          {team.map((p, i) => (p.active ? null : (
            <SwitchButton key={p.ident} p={p} index={i} disabled={!canPick(p, i)} onClick={idx => finish([...filled, `switch ${idx + 1}`])} />
          )))}
        </div>
        {errorLine}
        {footer}
      </div>
    );
  }

  const active = actives[slot];
  const dynamaxed = !!active.maxMoves && !active.canDynamax;
  const showMax = dynamaxed || gimmick === 'dynamax';
  const showZ = gimmick === 'zmove';
  const available = {
    mega: !!active.canMegaEvo,
    zmove: !!active.canZMove && active.canZMove.some(Boolean),
    dynamax: !!active.canDynamax,
    terastallize: !!active.canTerastallize,
  };
  const foeActive = foe.active.slice(0, slotCount);
  const foeAlive = foeActive.map(p => !!p && !p.fainted);
  const allyAlive = team.slice(0, slotCount).map((p, i) => !!p && !isOut(i));

  const moves = active.moves.map((m, i) => {
    let id = m.id;
    let name = m.move;
    let target = m.target;
    let disabled = !!m.disabled || (m.pp === 0 && active.moves.length > 1);
    let kind = '';
    if (showMax && active.maxMoves?.maxMoves?.[i]) {
      const mm = active.maxMoves.maxMoves[i];
      const maxMove = dex.moves.get(mm.move);
      id = maxMove.id;
      name = maxMove.name;
      target = mm.target;
      disabled = !!mm.disabled;
      kind = 'max';
    } else if (showZ) {
      const z = active.canZMove[i];
      if (!z) return {i, hidden: true};
      name = z.move;
      target = z.target;
      kind = 'z';
    }
    const base = dex.moves.get(m.id);
    const shown = dex.moves.get(name);
    const type = shown.exists ? shown.type : base.type;
    // Max Moves and Z-Moves keep the base move's category (Max Guard is the status one).
    const category = kind && shown.exists && shown.category === 'Status' ? 'Status' : base.category;
    let eff = null;
    if (category !== 'Status' && slotCount === 1 && foeActive[0] && !foeActive[0].fainted) {
      eff = effectiveness(type, foeActive[0].types);
    }
    return {i, id, name, target, disabled, kind, type, category, pp: m.pp, maxpp: m.maxpp, base, eff};
  });

  const pickMove = mv => {
    const opts = targetOptions(mv.target, slot, slotCount, foeAlive, allyAlive)
      .sort((a, b) => b - a);
    if (opts.length > 1) {
      setTargeting({mv, opts});
      return;
    }
    const target = opts.length === 1 ? ` ${opts[0]}` : '';
    finish([...filled, `move ${mv.i + 1}${target}${gimmick ? ` ${gimmick}` : ''}`]);
  };

  if (targeting) {
    const {mv, opts} = targeting;
    return (
      <div class="card deck">
        <div class="deck-head">
          <h3>Target for {mv.name}</h3>
          <button class="btn btn-ghost btn-sm" onClick={() => setTargeting(null)}>Cancel</button>
        </div>
        <div class="target-grid">
          {opts.map(loc => {
            const isFoe = loc > 0;
            const idx = Math.abs(loc) - 1;
            const mon = isFoe ? foeActive[idx] : own.active[idx];
            const eff = isFoe && mon && mv.category !== 'Status' ? effLabel(effectiveness(mv.type, mon.types)) : '';
            return (
              <button key={loc} class="target-btn" onClick={() => finish([...filled, `move ${mv.i + 1} ${loc}${gimmick ? ` ${gimmick}` : ''}`])}>
                {mon ? <FitSprite name={tracker.spriteName(mon)} width={52} height={46} /> : <span />}
                <span style={{minWidth: 0, display: 'grid'}}>
                  <span class="side-lbl">{isFoe ? 'Opponent' : idx === slot ? 'Itself' : 'Ally'}</span>
                  <strong>{mon ? mon.name : 'Empty'}</strong>
                  {eff && <span class="dim" style={{fontSize: '.8rem'}}>{eff}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const canSwitch = !active.trapped && !active.maybeTrapped;
  const currentSpecies = speciesOf(currentMon?.details);
  const megaInto = active.canMegaEvo ?
    (megaOptions(currentSpecies).find(o => o.item && toID(o.item) === currentMon.item) ||
      megaOptions(currentSpecies).find(o => o.move))?.mega : null;
  const gmaxInto = active.maxMoves?.gigantamax ? `${currentSpecies}-Gmax` : null;
  return (
    <div class="card deck">
      {header}
      {(Object.values(available).some(Boolean)) && (
        <div class="gimmick-bar">
          <div class="gimmicks">
            {Object.entries(available).filter(([, ok]) => ok).map(([key]) => {
              const blocked = usedGimmicks.includes(key);
              const label = key === 'dynamax' && gmaxInto ? 'Gigantamax' :
                key === 'terastallize' ? `Tera ${active.canTerastallize}` : GIMMICK_LABELS[key];
              const preview = key === 'mega' ? megaInto : key === 'dynamax' ? gmaxInto : null;
              return (
                <button key={key} class={`gimmick-toggle ${key}`} aria-pressed={gimmick === key} disabled={blocked}
                  title={blocked ? 'Already chosen for another Pokémon this turn' : GIMMICK_HINTS[key]}
                  onClick={() => setGimmick(gimmick === key ? null : key)}>
                  {preview ? <FitSprite name={preview} width={36} height={30} /> : <span class="dot" />}
                  <span class="gt-text">
                    <span>{label}</span>
                    {key === 'mega' && megaInto && <span class="gt-sub">into {megaName(megaInto)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p class="gimmick-hint">{gimmick ? `${GIMMICK_HINTS[gimmick]} Now pick a move.` : 'Turn one on, then pick a move. Each can be used once per battle.'}</p>
        </div>
      )}
      <div class="move-grid">
        {moves.filter(m => !m.hidden).map(m => (
          <button key={m.i} class={`move-btn t-${toID(m.type)} ${m.kind}`} disabled={m.disabled} onClick={() => pickMove(m)}
            title={`${m.name} — ${m.category}${m.base.basePower ? `, ${m.base.basePower} power` : ''}${m.base.accuracy !== true ? `, ${m.base.accuracy}% accuracy` : ''}. ${m.base.shortDesc || ''}`}>
            <span class="mv-name">{m.name}</span>
            <span class="mv-pp">{m.pp ?? '–'}/{m.maxpp ?? '–'}</span>
            <span class="mv-meta">
              <span>{m.type}</span>
              <span>{m.category}</span>
              {effLabel(m.eff) && <span class="eff">{effLabel(m.eff)}</span>}
            </span>
          </button>
        ))}
      </div>
      {canSwitch && (
        <>
          <p class="eyebrow">Switch</p>
          <div class="switch-grid">
            {team.map((p, i) => (p.active ? null : (
              <SwitchButton key={p.ident} p={p} index={i} disabled={parseCondition(p.condition).fainted || chosenSwitches.includes(i)} onClick={idx => finish([...filled, `switch ${idx + 1}`])} />
            )))}
          </div>
        </>
      )}
      {!canSwitch && <p class="dim">{currentName} can't switch out right now.</p>}
      {errorLine}
      {footer}
    </div>
  );
}

// ---------- screen ----------

function Log({entries, title}) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries.length]);
  return (
    <aside class="card log" aria-label="Battle log">
      <div class="log-head"><h3>{title}</h3></div>
      <div class="log-body" ref={ref}>
        {entries.map((e, i) => <div key={i} class={`log-line ${e.kind}`} dangerouslySetInnerHTML={{__html: e.html}} />)}
        {!entries.length && <p class="dim">The battle log fills in as the battle goes.</p>}
      </div>
    </aside>
  );
}

const SPEEDS = {slow: 1.5, normal: 1, fast: 0.45};

export function BattleScreen({game, speed = 'normal', onSpeed, onLeave, onRematch}) {
  const [, force] = useReducer(x => x + 1, 0);
  const [fx, setFx] = useState({});
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  useEffect(() => game.subscribe(force), [game]);
  const phase = game.phase;

  useEffect(() => {
    if (phase.type !== 'playback') return undefined;
    let cancelled = false;
    let timer = null;
    const tick = () => {
      if (cancelled) return;
      let wait = 0;
      const effects = {};
      while (!wait) {
        const r = game.stepStage();
        if (!r) {
          game.advance();
          return;
        }
        const cmd = r.args[0];
        if (FX[cmd] && typeof r.args[1] === 'string') {
          effects[r.args[1].slice(0, 3)] = {type: FX[cmd], n: Math.random()};
        }
        if (cmd === '-start' && toID(r.args[2]) === 'dynamax' && typeof r.args[1] === 'string') {
          effects[r.args[1].slice(0, 3)] = {type: 'flash', n: Math.random()};
        }
        if ((cmd === 'switch' || cmd === 'drag' || cmd === 'replace') && typeof r.args[1] === 'string') {
          effects[r.args[1].slice(0, 3)] = null; // a new Pokémon in this spot starts fresh
        }
        wait = r.text || cmd === '-damage' ? (DELAYS[cmd] ?? 450) : 0;
      }
      if (Object.keys(effects).length) setFx(prev => ({...prev, ...effects}));
      force();
      timer = setTimeout(tick, wait * (SPEEDS[speed] || 1));
    };
    timer = setTimeout(tick, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, game, speed]);

  const names = game.players.map(p => p.name);
  const turn = game.stage.battle.turn;
  const modeLabel = MODES[game.mode].label;

  let stadium;
  let deck = null;
  let log = game.stageLog;
  let logTitle = 'Battle log';
  if (phase.type === 'choose') {
    const i = phase.player;
    const request = game.match.requests[i];
    stadium = request?.teamPreview ? null : <Stadium tracker={game.trackers[i]} perspective={i === 0 ? 'p1' : 'p2'} mode={game.mode} exactOwn />;
    deck = request?.teamPreview ? <TeamPreview key={`tp${i}`} game={game} player={i} /> : <CommandDeck key={`${i}-${request?.rqid}`} game={game} player={i} />;
    log = game.logs[i];
    logTitle = `${names[i]}'s log`;
  } else {
    const started = game.stage.battle.turn > 0 || game.stage.battle.p1.active.some(Boolean);
    stadium = started ? <Stadium tracker={game.stage} perspective="p1" mode={game.mode} exactOwn={false} fx={fx} message={phase.type === 'playback' ? game.lastText : ''} /> : null;
    if (phase.type === 'pass') {
      const name = names[phase.player];
      const other = names[1 - phase.player];
      const preview = game.match.requests[phase.player]?.teamPreview;
      deck = (
        <div class="card pass-screen">
          <p class="eyebrow">{preview ? 'Team preview' : `Turn ${turn}`}</p>
          <h2>{name}'s turn</h2>
          <p class="muted">Hand the device to {name}. {other}, no peeking until it's your turn.</p>
          <button class="btn btn-primary btn-lg" onClick={() => game.reveal()}>I'm {name}. Show my turn</button>
        </div>
      );
    } else if (phase.type === 'playback') {
      deck = (
        <div class="card deck" style={{gridTemplateColumns: '1fr auto', alignItems: 'center'}}>
          <p class="muted">Turn {turn || 1} is playing out…</p>
          <div class="btn-row">
            <div class="seg" role="group" aria-label="Replay speed">
              {Object.keys(SPEEDS).map(s => (
                <button key={s} aria-pressed={speed === s} onClick={() => onSpeed?.(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
              ))}
            </div>
            <button class="btn btn-sm" onClick={() => {
              game.skipStage();
              game.advance();
            }}>Skip</button>
          </div>
        </div>
      );
    } else if (phase.type === 'over') {
      const w = phase.winner;
      deck = (
        <div class="card result">
          <p class="trophy">Battle over · {turn} {turn === 1 ? 'turn' : 'turns'}</p>
          <h2>{w === null || w === undefined ? "It's a draw" : `${names[w]} wins!`}</h2>
          <div class="btn-row" style={{justifyContent: 'center'}}>
            <button class="btn btn-primary" onClick={onRematch}>Rematch</button>
            <button class="btn" onClick={onLeave}>New battle</button>
          </div>
        </div>
      );
    }
  }

  const chooser = phase.type === 'choose' ? phase.player : null;
  return (
    <section class="battle">
      <div class="battle-main">
        <div class="battle-bar">
          <div class="who">
            <span class="turn-badge">{modeLabel}{turn ? ` · Turn ${turn}` : ''}</span>
            <span>{names[0]} <span class="dim">vs</span> {names[1]}</span>
          </div>
          <div class="btn-row">
            {chooser !== null && !game.match.ended && (confirmForfeit ? (
              <span class="confirm-inline">
                <span>Forfeit as {names[chooser]}?</span>
                <button class="btn btn-sm btn-danger" onClick={() => {
                  setConfirmForfeit(false);
                  game.forfeit(chooser);
                }}>Forfeit</button>
                <button class="btn btn-sm btn-ghost" onClick={() => setConfirmForfeit(false)}>Keep playing</button>
              </span>
            ) : <button class="btn btn-sm btn-ghost" onClick={() => setConfirmForfeit(true)}>Forfeit</button>)}
            {phase.type !== 'over' && (confirmLeave ? (
              <span class="confirm-inline">
                <span>Leave this battle?</span>
                <button class="btn btn-sm btn-danger" onClick={onLeave}>Leave</button>
                <button class="btn btn-sm btn-ghost" onClick={() => setConfirmLeave(false)}>Stay</button>
              </span>
            ) : <button class="btn btn-sm btn-ghost" onClick={() => setConfirmLeave(true)}>Leave</button>)}
          </div>
        </div>
        {stadium}
        {deck}
      </div>
      <Log entries={log} title={logTitle} />
    </section>
  );
}

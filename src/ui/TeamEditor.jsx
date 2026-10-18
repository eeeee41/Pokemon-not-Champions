// Editing one team: six slots, and a full editor for the selected Pokémon.
import {useState} from 'preact/hooks';
import {
  dex, toID, natures, speciesAbilities, calcStats, itemGimmick, clampSP, megaOptions, megaName,
} from '../engine/dex.js';
import {canLearn} from '../engine/learnsets.js';
import {
  validateTeam, validateMon, newMon, spUsed, requiredItems, cleanName,
} from '../engine/team.js';
import {STATS, STAT_LABELS, STAT_NAMES, SP_TOTAL, SP_MAX, TEAM_SIZE, TERA_TYPES, MAX_MOVES} from '../engine/constants.js';
import {FitSprite, Sprite, ItemIcon, TypeBadge, Types, ShinyMark} from './sprites.jsx';
import {SpeciesPicker, ItemPicker, MovePicker} from './pickers.jsx';
import {StatusChip} from './Teams.jsx';

function natureLabel(n) {
  if (!n.plus) return `${n.name} (no change)`;
  return `${n.name} (+${STAT_LABELS[n.plus]}, −${STAT_LABELS[n.minus]})`;
}

function baseColor(v) {
  if (v < 50) return '#e4572e';
  if (v < 80) return '#f0a020';
  if (v < 100) return '#d6c21c';
  if (v < 120) return '#5bbf3a';
  return '#1fae9a';
}

/** Applies a pick like "Mega Charizard X" (base Pokémon + Mega Stone) or "Gigantamax Lapras". */
function applyExtra(mon, extra) {
  if (!extra) return mon;
  const out = {...mon};
  if (extra.item) out.item = extra.item;
  if (extra.gmax) out.gmax = true;
  if (extra.move) {
    const moves = [...out.moves];
    while (moves.length < MAX_MOVES) moves.push('');
    if (!moves.some(m => toID(m) === toID(extra.move))) {
      const empty = moves.findIndex(m => !m);
      moves[empty >= 0 ? empty : 0] = extra.move;
    }
    out.moves = moves;
    // A Z-Crystal stops Mega Rayquaza, so make room for it.
    if (out.item && dex.items.get(out.item).zMove) out.item = '';
  }
  return out;
}

function MegaPicker({mon, onChange}) {
  const options = megaOptions(mon.species);
  if (!options.length) return null;
  const heldItem = mon.item ? dex.items.get(mon.item).name : '';
  const isOn = o => (o.item ? heldItem === o.item : mon.moves.some(m => toID(m) === toID(o.move)));
  const anyOn = options.some(isOn);
  return (
    <div class="label">
      <span>Mega Evolution</span>
      <div class="mega-options" role="group" aria-label="Mega Evolution">
        {options.map(o => (
          <button
            key={o.mega}
            class="mega-option"
            aria-pressed={isOn(o)}
            onClick={() => {
              if (isOn(o)) {
                if (o.item) onChange({item: ''});
                return;
              }
              const next = applyExtra(mon, o.item ? {item: o.item} : {move: o.move});
              onChange({item: next.item, moves: next.moves});
            }}
          >
            <FitSprite name={o.mega} shiny={mon.shiny} width={56} height={48} />
            <span style={{minWidth: 0, display: 'grid'}}>
              <strong>{megaName(o.mega)}</strong>
              <span class="dim">{o.item ? `Holds ${o.item}` : `Knows ${o.move}`}</span>
            </span>
          </button>
        ))}
      </div>
      <span class="dim" style={{fontWeight: 400, fontSize: '.85rem'}}>
        {anyOn ? 'Ready. In battle, turn on Mega Evolve before picking a move. One Mega per battle.' :
          'Tap one to give it the Mega Stone. The Mega Evolve button only shows up in battle when the stone is held.'}
      </span>
    </div>
  );
}

function GimmickBadges({mon}) {
  const species = dex.species.get(mon.species);
  const g = mon.item ? itemGimmick(mon.item, mon.species) : null;
  return (
    <span style={{display: 'inline-flex', gap: '4px', flexWrap: 'wrap'}}>
      {g?.kind === 'mega' && <span class="gimmick-badge g-mega">Mega</span>}
      {g?.kind === 'z' && <span class="gimmick-badge g-z">Z-Move</span>}
      {g?.kind === 'primal' && <span class="gimmick-badge g-primal">Primal</span>}
      {mon.gmax && species.canGigantamax && <span class="gimmick-badge g-gmax">G-Max</span>}
      <span class="gimmick-badge g-tera">Tera {mon.teraType}</span>
    </span>
  );
}

function StatsCard({mon, onChange}) {
  const species = dex.species.get(mon.species);
  const stats = calcStats(mon.species, mon.sp, mon.nature);
  const nature = dex.natures.get(mon.nature);
  const used = spUsed(mon);
  const left = SP_TOTAL - used;
  const setSP = (stat, raw) => {
    const current = mon.sp[stat] || 0;
    let v = clampSP(raw);
    v = Math.min(v, current + Math.max(0, left));
    onChange({sp: {...mon.sp, [stat]: v}});
  };
  return (
    <div class="card panel">
      <div style={{display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
        <h3>Stats</h3>
        <span class="dim" style={{fontSize: '.85rem'}}>Level 50 · IVs 31</span>
      </div>
      <label class="label">
        <span>Nature</span>
        <select id="nature" class="select" value={mon.nature} onChange={e => onChange({nature: e.currentTarget.value})}>
          {natures().map(n => <option key={n.name} value={n.name}>{natureLabel(n)}</option>)}
        </select>
      </label>
      <div class="sp-meter" aria-live="polite">
        <span class="eyebrow" style={{whiteSpace: 'nowrap'}}>Stat points</span>
        <div class={`sp-meter-bar${used > SP_TOTAL ? ' over' : ''}`}><span style={{width: `${Math.min(100, (used / SP_TOTAL) * 100)}%`}} /></div>
        <b class="num">{left}</b><span class="muted" style={{fontSize: '.85rem'}}>left of {SP_TOTAL}</span>
      </div>
      <div style={{overflowX: 'auto'}}>
        <table class="stats-table">
          <thead>
            <tr><th>Stat</th><th style={{textAlign: 'right'}}>Base</th><th class="bar-cell" /><th>Points (0–{SP_MAX})</th><th style={{textAlign: 'right'}}>Total</th></tr>
          </thead>
          <tbody>
            {STATS.map(stat => {
              const mark = nature.plus === stat ? 'plus' : nature.minus === stat ? 'minus' : '';
              const base = species.baseStats[stat];
              return (
                <tr key={stat}>
                  <td class={`stat-name ${mark}`} title={STAT_NAMES[stat]}>{STAT_LABELS[stat]}{mark === 'plus' ? ' +' : mark === 'minus' ? ' −' : ''}</td>
                  <td class="base">{base}</td>
                  <td class="bar-cell"><div class="basebar"><span style={{width: `${Math.min(100, base / 1.8)}%`, background: baseColor(base)}} /></div></td>
                  <td>
                    <div class="sp-cell">
                      <input
                        id={`sp-range-${stat}`}
                        type="range" min="0" max={SP_MAX} step="1"
                        value={mon.sp[stat] || 0}
                        aria-label={`${STAT_NAMES[stat]} points`}
                        onInput={e => setSP(stat, e.currentTarget.value)}
                      />
                      <input
                        id={`sp-num-${stat}`}
                        class="input num" type="number" min="0" max={SP_MAX}
                        value={mon.sp[stat] || 0}
                        aria-label={`${STAT_NAMES[stat]} points`}
                        onChange={e => setSP(stat, e.currentTarget.value)}
                      />
                    </div>
                  </td>
                  <td class={`final num ${mark}`}>{stats[stat]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div class="btn-row">
        <button class="btn btn-sm btn-ghost" onClick={() => onChange({sp: {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0}})}>Reset points</button>
        <span class="dim" style={{fontSize: '.85rem'}}>Each point adds 1 to the stat before the nature. HP = base + points + 75.</span>
      </div>
    </div>
  );
}

function MonEditor({mon, index, onChange, onRemove, takenItems}) {
  const [picker, setPicker] = useState(null);
  const species = dex.species.get(mon.species);
  const abilities = speciesAbilities(species);
  const problems = validateMon(mon);
  const required = requiredItems(species);
  const item = mon.item ? dex.items.get(mon.item) : null;

  const changeSpecies = (name, extra) => {
    const fresh = newMon(name);
    const s = dex.species.get(name);
    const keepItem = mon.item && !requiredItems(s).length && !itemGimmick(mon.item, mon.species)?.kind?.startsWith('mega') ?
      mon.item : fresh.item;
    onChange(applyExtra({
      ...fresh,
      nickname: '',
      sp: mon.sp,
      nature: mon.nature,
      item: keepItem,
      moves: mon.moves.map(m => (m && canLearn(name, m) ? m : '')),
    }, extra), true);
    setPicker(null);
  };

  const setMove = (slot, name) => {
    const moves = [...mon.moves];
    while (moves.length < MAX_MOVES) moves.push('');
    moves[slot] = name;
    onChange({moves});
    setPicker(null);
  };

  return (
    <div class="mon-editor">
      <div style={{display: 'grid', gap: '16px', minWidth: 0}}>
        <div class="card panel">
          <div class="mon-identity">
            <div class="mon-portrait">
              <Sprite name={mon.gmax && species.canGigantamax ? `${species.name}-Gmax` : species.name} shiny={mon.shiny} scale={1.25} />
            </div>
            <div style={{display: 'grid', gap: '8px', minWidth: 0}}>
              <span class="eyebrow">Slot {index + 1}</span>
              <button class="picker-btn" onClick={() => setPicker({kind: 'species'})}>
                <span class="grow" style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem'}}>{species.name}</span>
                <span class="muted">Change</span>
              </button>
              <Types types={species.types} />
              <GimmickBadges mon={mon} />
            </div>
          </div>
          <div class="field-grid">
            <label class="label">
              <span>Nickname</span>
              <input id={`nickname-${index}`} class="input" maxLength={18} placeholder={species.baseSpecies} value={mon.nickname} onInput={e => onChange({nickname: cleanName(e.currentTarget.value)})} />
            </label>
            <label class="label">
              <span>Gender</span>
              <select id={`gender-${index}`} class="select" value={mon.gender} disabled={!!species.gender} onChange={e => onChange({gender: e.currentTarget.value})}>
                {species.gender ? <option value="">{species.gender === 'N' ? 'Genderless' : species.gender === 'M' ? 'Male only' : 'Female only'}</option> : <>
                  <option value="">Random</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </>}
              </select>
            </label>
          </div>
          <div class="btn-row">
            <label class="switch"><input id={`shiny-${index}`} type="checkbox" checked={mon.shiny} onChange={e => onChange({shiny: e.currentTarget.checked})} /> Shiny <ShinyMark /></label>
            {species.canGigantamax && (
              <label class="switch"><input id={`gmax-${index}`} type="checkbox" checked={mon.gmax} onChange={e => onChange({gmax: e.currentTarget.checked})} /> Gigantamax ({species.canGigantamax})</label>
            )}
          </div>
        </div>

        <div class="card panel">
          <div class="label">
            <span>Ability</span>
            <div class="choice-row" role="group" aria-label="Ability">
              {abilities.map(a => (
                <button key={a} class="choice" aria-pressed={mon.ability === a} title={dex.abilities.get(a).shortDesc} onClick={() => onChange({ability: a})}>{a}</button>
              ))}
            </div>
            {mon.ability && <span class="dim" style={{fontWeight: 400, fontSize: '.85rem'}}>{dex.abilities.get(mon.ability).shortDesc}</span>}
          </div>
          <div class="label">
            <span>Held item</span>
            <button class="picker-btn" onClick={() => setPicker({kind: 'item'})}>
              {item ? <ItemIcon item={item.id} size={26} /> : null}
              <span class={`grow${item ? '' : ' placeholder'}`}>{item ? item.name : 'No item'}</span>
              <span class="muted">{required.length ? 'Required' : 'Change'}</span>
            </button>
            {item && <span class="dim" style={{fontWeight: 400, fontSize: '.85rem'}}>{item.shortDesc || item.desc}</span>}
            {item && takenItems.includes(item.id) && <span style={{color: 'var(--bad)', fontSize: '.85rem'}}>Another Pokémon on this team holds {item.name}.</span>}
          </div>
          <MegaPicker mon={mon} onChange={onChange} />
          <div class="label">
            <span>Tera Type</span>
            <div class="tera-grid" role="group" aria-label="Tera Type">
              {TERA_TYPES.map(t => (
                <button key={t} aria-pressed={mon.teraType === t} title={`Tera ${t}`} onClick={() => onChange({teraType: t})}><TypeBadge type={t} /></button>
              ))}
            </div>
          </div>
        </div>

        <div class="card panel">
          <h3>Moves</h3>
          <div class="moves-grid">
            {Array.from({length: MAX_MOVES}, (_, slot) => {
              const name = mon.moves[slot];
              const move = name ? dex.moves.get(name) : null;
              return (
                <button key={slot} class="picker-btn move-slot" onClick={() => setPicker({kind: 'move', slot})} title={move?.desc}>
                  {move ? <TypeBadge type={move.type} small /> : null}
                  <span class={`grow${move ? '' : ' placeholder'}`}>{move ? move.name : `Move ${slot + 1}`}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{display: 'grid', gap: '16px', minWidth: 0}}>
        <StatsCard mon={mon} onChange={patch => onChange(patch)} />
        {problems.length > 0 && (
          <div class="card panel">
            <h3>Fix before battling</h3>
            <ul class="error-list">{problems.map(p => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        <div class="btn-row">
          <button class="btn btn-danger" onClick={onRemove}>Remove {mon.nickname || species.baseSpecies}</button>
        </div>
      </div>

      {picker?.kind === 'species' && <SpeciesPicker current={species.name} onPick={changeSpecies} onClose={() => setPicker(null)} />}
      {picker?.kind === 'item' && <ItemPicker species={species.name} current={item?.name} onPick={name => { onChange({item: name}); setPicker(null); }} onClose={() => setPicker(null)} />}
      {picker?.kind === 'move' && (
        <MovePicker
          species={species.name}
          taken={mon.moves.filter(Boolean)}
          current={mon.moves[picker.slot]}
          onPick={name => setMove(picker.slot, name)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

export function TeamEditor({team, onChange, onBack, onBattle}) {
  const [slot, setSlot] = useState(team.mons.length ? 0 : -1);
  const [adding, setAdding] = useState(!team.mons.length);
  const validation = validateTeam(team);
  const problemSlots = new Set(validation.problems.filter(p => p.index !== null).map(p => p.index));
  const teamProblems = validation.problems.filter(p => p.index === null);

  const save = mons => onChange({...team, mons, updated: Date.now()});
  const updateMon = (i, patch, replace = false) => {
    const mons = team.mons.map((m, j) => (j === i ? (replace ? patch : {...m, ...patch}) : m));
    save(mons);
  };
  const addMon = (name, extra) => {
    const mons = [...team.mons, applyExtra(newMon(name), extra)];
    save(mons);
    setSlot(mons.length - 1);
    setAdding(false);
  };
  const removeMon = i => {
    const mons = team.mons.filter((_, j) => j !== i);
    save(mons);
    setSlot(Math.min(i, mons.length - 1));
  };

  const mon = slot >= 0 ? team.mons[slot] : null;
  const takenItems = mon ? team.mons.filter((m, j) => j !== slot && m.item).map(m => dex.items.get(m.item).id) : [];

  return (
    <section class="editor">
      <div class="editor-head">
        <button class="btn btn-ghost" onClick={onBack}>← All teams</button>
        <label class="visually-hidden" for="team-name">Team name</label>
        <input id="team-name" class="input" value={team.name} maxLength={40} onInput={e => onChange({...team, name: e.currentTarget.value, updated: Date.now()})} />
        <StatusChip team={team} />
        <span style={{flex: 1}} />
        <button class="btn btn-primary" disabled={!validation.ok} onClick={onBattle} title={validation.ok ? '' : 'Fix the problems first'}>Battle with this team</button>
      </div>
      {teamProblems.length > 0 && <ul class="error-list">{teamProblems.map(p => <li key={p.text}>{p.text}</li>)}</ul>}

      <div class="slots" role="tablist" aria-label="Team slots">
        {team.mons.map((m, i) => (
          <button key={i} class="slot" role="tab" aria-pressed={i === slot} aria-selected={i === slot} onClick={() => setSlot(i)}>
            {problemSlots.has(i) && <span class="slot-warn" title="Has problems" />}
            <FitSprite name={m.gmax ? `${m.species}-Gmax` : m.species} shiny={m.shiny} width={80} height={56} />
            <span class="slot-name">{m.nickname || m.species}{m.shiny && <ShinyMark />}</span>
          </button>
        ))}
        {team.mons.length < TEAM_SIZE && (
          <button class="slot slot-add" onClick={() => setAdding(true)}>+ Add Pokémon</button>
        )}
      </div>

      {mon ? (
        <MonEditor
          key={`${slot}-${mon.species}`}
          mon={mon}
          index={slot}
          takenItems={takenItems}
          onChange={(patch, replace) => updateMon(slot, patch, replace)}
          onRemove={() => removeMon(slot)}
        />
      ) : (
        <div class="card panel" style={{justifyItems: 'start'}}>
          <h3>Pick your first Pokémon</h3>
          <p class="muted">Any Pokémon from any generation. Search "Mega" to find Mega Evolutions: you get the Pokémon holding its Mega Stone, and Mega Evolve shows up in battle.</p>
          <button class="btn btn-primary" onClick={() => setAdding(true)}>Choose a Pokémon</button>
        </div>
      )}
      {adding && <SpeciesPicker onPick={addMon} onClose={() => setAdding(false)} />}
    </section>
  );
}

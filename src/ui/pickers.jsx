// Searchable pickers for species, items and moves, shown in a sheet.
import {useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {dex, toID, selectableSpecies, selectableItems, itemGimmick} from '../engine/dex.js';
import {learnableMoves} from '../engine/learnsets.js';
import {TYPES, STATS} from '../engine/constants.js';
import {requiredItems} from '../engine/team.js';
import {FitSprite, ItemIcon, Types, TypeBadge} from './sprites.jsx';

export function Sheet({title, onClose, tools, foot, children, wide}) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div class="sheet-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={wide ? {width: 'min(920px, 100%)'} : undefined}>
        <div class="sheet-head">
          <h3>{title}</h3>
          <button class="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        {tools && <div class="sheet-tools">{tools}</div>}
        <div class="sheet-body">{children}</div>
        {foot && <div class="sheet-foot">{foot}</div>}
      </div>
    </div>
  );
}

function useSearchInput() {
  const ref = useRef(null);
  useEffect(() => {
    // Phones pop the keyboard over the list; only autofocus on wider screens.
    if (ref.current && window.matchMedia('(min-width: 700px)').matches) ref.current.focus();
  }, []);
  return ref;
}

const LIMIT = 150;

function bst(s) {
  return STATS.reduce((a, k) => a + s.baseStats[k], 0);
}

export function SpeciesPicker({onPick, onClose, current}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const input = useSearchInput();
  const all = selectableSpecies();
  const results = useMemo(() => {
    const id = toID(q);
    let list = all;
    if (type) list = list.filter(s => s.types.includes(type));
    if (id) {
      const starts = [];
      const contains = [];
      for (const s of list) {
        if (s.id.startsWith(id)) starts.push(s);
        else if (s.id.includes(id) || String(s.num) === q.trim()) contains.push(s);
      }
      list = [...starts, ...contains];
    }
    return list;
  }, [q, type]);
  return (
    <Sheet
      title="Choose a Pokémon"
      onClose={onClose}
      tools={<>
        <input ref={input} id="species-search" class="input" placeholder="Search by name or Pokédex number" value={q} onInput={e => setQ(e.currentTarget.value)} />
        <select id="species-type" class="select" style={{flex: '0 1 160px'}} value={type} onChange={e => setType(e.currentTarget.value)}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </>}
    >
      <div class="pick-list" role="listbox" aria-label="Pokémon">
        {results.slice(0, LIMIT).map(s => (
          <button key={s.id} class={`pick-row${current === s.name ? ' active' : ''}`} role="option" aria-selected={current === s.name} onClick={() => onPick(s.name)}>
            <FitSprite name={s.name} width={52} height={44} />
            <span class="pick-main">
              <span class="pick-title">{s.name} <Types types={s.types} small /></span>
              <span class="pick-sub">#{s.num} · {Object.values(s.abilities).filter(Boolean).join(' / ')}</span>
            </span>
            <span class="pick-side">
              {s.canGigantamax && <span class="gimmick-badge g-gmax" title="Can Gigantamax">G-Max</span>}
              <span class="bst" title="Base stat total">{bst(s)}</span>
            </span>
          </button>
        ))}
        {results.length > LIMIT && <p class="pick-more">Showing {LIMIT} of {results.length}. Keep typing to narrow it down.</p>}
        {!results.length && <p class="pick-more">No Pokémon match "{q}".</p>}
      </div>
    </Sheet>
  );
}

function itemBadge(item, species) {
  const g = itemGimmick(item.name, species);
  if (!g) return null;
  if (g.kind === 'mega') return <span class="gimmick-badge g-mega">Mega</span>;
  if (g.kind === 'z') return <span class="gimmick-badge g-z">Z</span>;
  if (g.kind === 'primal') return <span class="gimmick-badge g-primal">Primal</span>;
  return null;
}

export function ItemPicker({species, onPick, onClose, current}) {
  const [q, setQ] = useState('');
  const input = useSearchInput();
  const s = dex.species.get(species);
  const required = requiredItems(s);
  const all = selectableItems();
  const featured = useMemo(() => {
    if (required.length) return required.map(n => dex.items.get(n));
    return all.filter(item => {
      const g = itemGimmick(item.name, s.name);
      if (g && (g.kind === 'mega' || g.kind === 'primal')) return true;
      if (g && g.kind === 'z' && item.itemUser) return true;
      return false;
    });
  }, [species]);
  const results = useMemo(() => {
    const id = toID(q);
    if (required.length) return [];
    if (!id) return all;
    return all.filter(i => i.id.includes(id));
  }, [q, species]);
  const row = item => (
    <button key={item.id} class={`pick-row${current === item.name ? ' active' : ''}`} onClick={() => onPick(item.name)} title={item.desc}>
      <span style={{display: 'grid', placeItems: 'center'}}><ItemIcon item={item.id} size={28} /></span>
      <span class="pick-main">
        <span class="pick-title">{item.name} {itemBadge(item, s.name)}</span>
        <span class="pick-sub">{item.shortDesc || item.desc}</span>
      </span>
      <span />
    </button>
  );
  return (
    <Sheet
      title={`Held item for ${s.name}`}
      onClose={onClose}
      tools={required.length ? <p class="muted">{s.name} must hold {required.join(' or ')}.</p> :
        <input ref={input} id="item-search" class="input" placeholder="Search items" value={q} onInput={e => setQ(e.currentTarget.value)} />}
    >
      <div class="pick-list">
        {!required.length && !q && (
          <button class={`pick-row${!current ? ' active' : ''}`} onClick={() => onPick('')}>
            <span />
            <span class="pick-main"><span class="pick-title">No item</span></span>
            <span />
          </button>
        )}
        {featured.length > 0 && !q && <p class="eyebrow pick-group">For {s.name}</p>}
        {!q && featured.map(row)}
        {!required.length && !q && <p class="eyebrow pick-group">All items</p>}
        {results.slice(0, q ? LIMIT : 400).map(row)}
        {!required.length && q && !results.length && <p class="pick-more">No items match "{q}".</p>}
      </div>
    </Sheet>
  );
}

export function categoryClass(cat) {
  return `cat cat-${toID(cat)}`;
}

export function MovePicker({species, taken = [], onPick, onClose, current}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const input = useSearchInput();
  const moves = useMemo(() => learnableMoves(species), [species]);
  const results = useMemo(() => {
    const id = toID(q);
    let list = moves;
    if (type) list = list.filter(m => m.type === type);
    if (id) list = list.filter(m => m.id.includes(id));
    return list;
  }, [q, type, species]);
  const takenIds = taken.map(t => toID(t));
  return (
    <Sheet
      title={`Moves ${dex.species.get(species).name} can learn`}
      wide
      onClose={onClose}
      tools={<>
        <input ref={input} id="move-search" class="input" placeholder={`Search ${moves.length} moves`} value={q} onInput={e => setQ(e.currentTarget.value)} />
        <select id="move-type" class="select" style={{flex: '0 1 160px'}} value={type} onChange={e => setType(e.currentTarget.value)}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </>}
    >
      <div class="pick-list">
        {current && !q && (
          <button class="pick-row move-row" onClick={() => onPick('')}>
            <span />
            <span class="pick-main"><span class="pick-title">Remove {current}</span></span>
            <span />
          </button>
        )}
        {results.length > 0 && (
          <div class="pick-row move-row pick-header" aria-hidden="true">
            <span class="eyebrow">Type</span>
            <span class="eyebrow">Move</span>
            <span class="move-stats eyebrow"><span>Pow</span><span>Acc</span><span>PP</span></span>
          </div>
        )}
        {results.map(m => {
          const isTaken = takenIds.includes(m.id) && toID(current) !== m.id;
          return (
            <button key={m.id} class={`pick-row move-row${toID(current) === m.id ? ' active' : ''}`} disabled={isTaken} style={isTaken ? {opacity: .45} : undefined} onClick={() => onPick(m.name)} title={m.desc}>
              <span><TypeBadge type={m.type} /></span>
              <span class="pick-main">
                <span class="pick-title">{m.name} <span class={categoryClass(m.category)}>{m.category}</span></span>
                <span class="pick-sub">{m.shortDesc || m.desc}</span>
              </span>
              <span class="move-stats">
                <span title="Power">{m.basePower || '—'}</span>
                <span title="Accuracy">{m.accuracy === true ? '—' : `${m.accuracy}%`}</span>
                <span title="PP">{m.pp}</span>
              </span>
            </button>
          );
        })}
        {!results.length && <p class="pick-more">No moves match.</p>}
      </div>
    </Sheet>
  );
}

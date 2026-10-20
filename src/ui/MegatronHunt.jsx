// The Megatron parts hunt: one part hidden on each page, a counter once the
// first is found, and a message as each one is collected.
import {useEffect, useState} from 'preact/hooks';
import {PARTS, collectedParts, collectPart, onPartsChange, megatronUnlocked} from '../engine/megatron.js';
import {PartIcon} from './sprites.jsx';

function useParts() {
  const [found, setFound] = useState(collectedParts);
  useEffect(() => onPartsChange(() => setFound(collectedParts())), []);
  return found;
}

/** The part hidden on this page, if it hasn't been found yet. */
export function HiddenPart({page}) {
  const found = useParts();
  const part = PARTS.find(p => p.page === page);
  if (!part || found.includes(part.id)) return null;
  return (
    <button class={`hidden-part hp-${page} hp-${PARTS.indexOf(part) % 2 ? 'left' : 'right'}`} title="A strange machine part" aria-label="A strange machine part" onClick={() => collectPart(part.id)}>
      <PartIcon part={part.id} size={72} />
    </button>
  );
}

/** "3 / 6" in the header while the hunt is on. */
export function PartsCounter() {
  const found = useParts();
  if (!found.length || found.length === PARTS.length) return null;
  return (
    <span class="parts-counter" title="Machine parts found">
      <PartIcon part="core" size={22} />
      <span class="num">{found.length} / {PARTS.length}</span>
    </span>
  );
}

/** A short message each time a part is collected. */
export function PartsToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => onPartsChange((count, id) => {
    const part = PARTS.find(p => p.id === id);
    setToast(megatronUnlocked() ?
      {id, done: true, text: 'All 6 parts found! Megatron has assembled. Find him in the team builder.'} :
      {id, done: false, text: `Found Megatron's ${part.name}! ${count} / ${PARTS.length} parts.`});
  }), []);
  useEffect(() => {
    if (!toast || toast.done) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div class={`card parts-toast${toast.done ? ' done' : ''}`} role="status">
      <PartIcon part={toast.id} size={36} />
      <span>{toast.text}</span>
      <button class="btn btn-sm btn-ghost" onClick={() => setToast(null)}>{toast.done ? 'Got it' : 'Close'}</button>
    </div>
  );
}

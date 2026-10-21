// Which animation a battle-log line plays, following Pokémon Showdown's client
// (battle.ts: animateMove, cantUseMove, -status, -damage [from], -start, ...).
// Pure: no screen code, so it can be tested on its own.
//
// Returns {kind, id, slots} or null. kind: 'move' | 'prepare' | 'other' | 'status'.
// slots: participants as 'p1a'-style slots; 'miss:p2a' is "just past p2a".
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slotOf = ident => (typeof ident === 'string' && /^p[1-4][a-c]/.test(ident) ? ident.slice(0, 3) : null);
const from = kw => toID(String(kw?.from || '').replace(/^(item|ability|move):\s*/i, ''));

/** The first Pokémon standing on the other side. field: [{slot}] */
function firstFoe(slot, field) {
  const side = slot.slice(0, 2);
  return field.find(m => m.slot.slice(0, 2) !== side)?.slot || null;
}

function moveAnim(args, kw, field) {
  if (kw.still || kw.notarget) return null;
  const user = slotOf(args[1]);
  if (!user) return null;
  let target = slotOf(args[3]) || firstFoe(user, field);
  if (!target) return null;
  if (kw.prepare || kw.anim === 'prepare') return {kind: 'prepare', id: toID(args[2]), slots: [user, target]};
  const id = kw.anim ? toID(kw.anim) : toID(args[2]);
  if (kw.miss) target = `miss:${target}`;
  if (!kw.spread) return {kind: 'move', id, slots: [user, target]};
  if (kw.spread === '.' || kw.spread === true) return {kind: 'move', id, slots: [user, `miss:${slotOf(args[3]) || firstFoe(user, field)}`]};
  const hit = String(kw.spread).split(',').map(s => s.trim()).filter(s => /^p[1-4][a-c]$/.test(s));
  return {kind: 'move', id, slots: [user, ...hit]};
}

const STATUS_ANIMS = {brn: 'brn', tox: 'psn', psn: 'psn', par: 'par', frz: 'frz'};
const CANT_STATUS = new Set(['brn', 'psn', 'slp', 'par', 'frz', 'flinch', 'attracted', 'cursed', 'confused', 'confusedselfhit', 'focuspunch']);

/**
 * @param {{args: string[], kwArgs: object}} r a parsed log line
 * @param {{slot: string}[]} field the Pokémon on the field
 */
export function animFor(r, field = []) {
  const [cmd] = r.args;
  const kw = r.kwArgs || {};
  const poke = slotOf(r.args[1]);
  switch (cmd) {
  case 'move':
    return moveAnim(r.args, kw, field);
  case '-anim':
    return moveAnim(r.args, kw, field);
  case '-prepare': {
    const target = slotOf(r.args[3]) || (poke && firstFoe(poke, field));
    return poke && target ? {kind: 'prepare', id: toID(r.args[2]), slots: [poke, target]} : null;
  }
  case 'cant': {
    if (!poke) return null;
    const why = toID(r.args[2]);
    if (why === 'recharge') return {kind: 'other', id: 'selfstatus', slots: [poke]};
    return CANT_STATUS.has(why) ? {kind: 'status', id: why, slots: [poke]} : null;
  }
  case '-status':
    return poke && STATUS_ANIMS[toID(r.args[2])] ? {kind: 'status', id: STATUS_ANIMS[toID(r.args[2])], slots: [poke]} : null;
  case '-damage': {
    if (!poke || !kw.from) return null;
    const f = from(kw);
    if (f === 'brn') return {kind: 'status', id: 'brn', slots: [poke]};
    if (f === 'psn' || f === 'tox') return {kind: 'status', id: 'psn', slots: [poke]};
    if (f === 'baddreams' || f === 'curse') return {kind: 'status', id: 'cursed', slots: [poke]};
    if (f === 'confusion') return {kind: 'status', id: 'confusedselfhit', slots: [poke]};
    if (f === 'leechseed') {
      const of = slotOf(kw.of);
      return of ? {kind: 'other', id: 'leech', slots: [of, poke]} : null;
    }
    if (f === 'bind' || f === 'wrap') return {kind: 'other', id: 'bound', slots: [poke]};
    return null;
  }
  case '-heal':
    return poke && !kw.silent ? {kind: 'other', id: 'heal', slots: [poke]} : null;
  case '-start': {
    const what = toID(String(r.args[2] || '').replace(/^move:\s*/i, ''));
    if (poke && what === 'confusion' && !kw.already) return {kind: 'status', id: 'confused', slots: [poke]};
    return null;
  }
  case '-activate': {
    const what = toID(String(r.args[2] || '').replace(/^move:\s*/i, ''));
    if (poke && what === 'attract') return {kind: 'status', id: 'attracted', slots: [poke]};
    return null;
  }
  case '-zpower':
    return poke ? {kind: 'other', id: 'zpower', slots: [poke]} : null;
  default:
    return null;
  }
}

// Teams: the saved format, validation against the Champions rules, conversion to
// simulator sets, and import/export in Pokémon Showdown's text format.
import {
  dex, toID, isSelectableSpecies, speciesAbilities, inGame, emptySP, clampSP, spLimit,
} from './dex.js';
import {canLearn} from './learnsets.js';
import {isCreatorSpecies} from './creator.js';
import {
  STATS, STAT_LABELS, SP_TOTAL, SP_MAX, TEAM_SIZE, MAX_MOVES, LEVEL, IV, RULES, TERA_TYPES,
} from './constants.js';

/*
 * A saved team:
 *   {id, name, mons: Mon[], updated}
 * A Mon:
 *   {species, nickname, item, ability, nature, teraType, gmax, shiny, gender, moves: string[4], sp: {hp..spe}}
 */

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function requiredItems(species) {
  const s = dex.species.get(species);
  if (s.requiredItems) return s.requiredItems;
  if (s.requiredItem) return [s.requiredItem];
  return [];
}

export function newMon(speciesName) {
  const s = dex.species.get(speciesName);
  return {
    species: s.name,
    nickname: '',
    item: requiredItems(s)[0] || '',
    ability: speciesAbilities(s)[0] || '',
    nature: 'Hardy',
    teraType: s.types[0],
    gmax: false,
    shiny: false,
    gender: '',
    moves: ['', '', '', ''],
    // MissingNo. starts with every stat maxed.
    sp: isCreatorSpecies(s) ? {hp: 32, atk: 32, def: 32, spa: 32, spd: 32, spe: 32} : emptySP(),
  };
}

export function newTeam(name = 'New team') {
  return {id: uid(), name, mons: [], updated: Date.now()};
}

export function spUsed(mon) {
  return STATS.reduce((sum, s) => sum + (mon.sp?.[s] || 0), 0);
}

export function cleanName(name) {
  return String(name || '').replace(/[|,\[\]\n\r]/g, '').trim().slice(0, 18);
}

/** Problems with one Pokémon, as plain sentences. */
export function validateMon(mon) {
  const problems = [];
  const species = dex.species.get(mon.species);
  const label = mon.nickname || species.name || mon.species || 'This Pokémon';
  if (!species.exists) return [`"${mon.species}" isn't a Pokémon we know.`];
  if (!isSelectableSpecies(species)) {
    problems.push(`${species.name} can't be picked directly; choose ${species.battleOnly || species.baseSpecies} instead.`);
  }

  const abilities = speciesAbilities(species);
  if (!abilities.includes(mon.ability)) {
    problems.push(`${label} can't have the ability ${mon.ability || '(none)'}. Options: ${abilities.join(', ')}.`);
  }

  if (mon.item) {
    const item = dex.items.get(mon.item);
    if (!inGame(item)) problems.push(`${label}'s item "${mon.item}" doesn't exist.`);
  }
  const required = requiredItems(species);
  if (required.length && !required.includes(dex.items.get(mon.item).name)) {
    problems.push(`${species.name} must hold ${required.join(' or ')}.`);
  }

  if (!dex.natures.get(mon.nature).exists) problems.push(`${label} needs a nature.`);
  if (!TERA_TYPES.includes(mon.teraType)) problems.push(`${label} needs a Tera Type.`);
  if (mon.gmax && !species.canGigantamax) problems.push(`${species.name} can't Gigantamax.`);

  const moves = (mon.moves || []).filter(Boolean);
  if (!moves.length) problems.push(`${label} needs at least one move.`);
  if (moves.length > MAX_MOVES) problems.push(`${label} has more than ${MAX_MOVES} moves.`);
  const seen = new Set();
  for (const m of moves) {
    const move = dex.moves.get(m);
    if (!inGame(move)) {
      problems.push(`${label}'s move "${m}" doesn't exist.`);
      continue;
    }
    if (seen.has(move.id)) problems.push(`${label} has ${move.name} twice.`);
    seen.add(move.id);
    if (!canLearn(species.name, move.id)) problems.push(`${species.name} can't learn ${move.name}.`);
  }

  let total = 0;
  for (const stat of STATS) {
    const v = mon.sp?.[stat] ?? 0;
    if (!Number.isInteger(v) || v < 0 || v > SP_MAX) {
      problems.push(`${label}'s ${STAT_LABELS[stat]} points must be a whole number from 0 to ${SP_MAX}.`);
    }
    total += v;
  }
  const limit = spLimit(species);
  if (total > limit) problems.push(`${label} uses ${total} stat points; the limit is ${limit}.`);
  return problems;
}

/** {ok, problems: [{index, text}]} where index is the team slot or null for team-wide problems. */
export function validateTeam(team) {
  const problems = [];
  const mons = team?.mons || [];
  if (mons.length !== TEAM_SIZE) {
    problems.push({index: null, text: `A team needs ${TEAM_SIZE} Pokémon; this one has ${mons.length}.`});
  }
  mons.forEach((mon, index) => {
    for (const text of validateMon(mon)) problems.push({index, text});
  });
  if (RULES.speciesClause) {
    const byNum = new Map();
    mons.forEach((mon, index) => {
      const s = dex.species.get(mon.species);
      if (!s.exists) return;
      if (byNum.has(s.num)) {
        problems.push({index, text: `Species Clause: only one ${s.baseSpecies} per team.`});
      } else byNum.set(s.num, index);
    });
  }
  if (RULES.itemClause) {
    const items = new Map();
    mons.forEach((mon, index) => {
      if (!mon.item) return;
      const id = toID(mon.item);
      if (items.has(id)) {
        problems.push({index, text: `Item Clause: only one ${dex.items.get(id).name} per team.`});
      } else items.set(id, index);
    });
  }
  return {ok: problems.length === 0, problems};
}

/** The set the simulator expects. The "evs" field carries Champions stat points. */
export function toSimSet(mon) {
  const species = dex.species.get(mon.species);
  const ivs = {};
  const evs = {};
  for (const stat of STATS) {
    ivs[stat] = IV;
    evs[stat] = clampSP(mon.sp?.[stat]);
  }
  return {
    name: cleanName(mon.nickname) || species.baseSpecies,
    species: species.name,
    item: mon.item || '',
    ability: mon.ability,
    nature: mon.nature || 'Hardy',
    gender: mon.gender || '',
    shiny: !!mon.shiny,
    level: LEVEL,
    moves: (mon.moves || []).filter(Boolean).map(m => dex.moves.get(m).name),
    evs,
    ivs,
    teraType: mon.teraType,
    gigantamax: !!(mon.gmax && species.canGigantamax),
    happiness: 255,
  };
}

export function toSimTeam(team) {
  return team.mons.map(toSimSet);
}

// ---------- Showdown text format ----------

export function exportMon(mon) {
  const species = dex.species.get(mon.species);
  let head = mon.nickname && cleanName(mon.nickname) !== species.name ?
    `${cleanName(mon.nickname)} (${species.name})` : species.name;
  if (mon.gender === 'M' || mon.gender === 'F') head += ` (${mon.gender})`;
  if (mon.item) head += ` @ ${dex.items.get(mon.item).name}`;
  const lines = [head];
  if (mon.ability) lines.push(`Ability: ${mon.ability}`);
  if (mon.shiny) lines.push('Shiny: Yes');
  if (mon.teraType) lines.push(`Tera Type: ${mon.teraType}`);
  if (mon.gmax) lines.push('Gigantamax: Yes');
  const sp = STATS.filter(s => mon.sp?.[s]).map(s => `${mon.sp[s]} ${STAT_LABELS[s]}`);
  if (sp.length) lines.push(`SPs: ${sp.join(' / ')}`);
  if (mon.nature) lines.push(`${mon.nature} Nature`);
  for (const m of (mon.moves || []).filter(Boolean)) lines.push(`- ${dex.moves.get(m).name}`);
  return lines.join('\n');
}

export function exportTeam(team) {
  return team.mons.map(exportMon).join('\n\n') + '\n';
}

const STAT_ALIASES = {
  hp: 'hp', atk: 'atk', attack: 'atk', def: 'def', defense: 'def',
  spa: 'spa', satk: 'spa', spatk: 'spa', spattack: 'spa', spd: 'spd', sdef: 'spd', spdef: 'spd', spdefense: 'spd',
  spe: 'spe', speed: 'spe',
};

function parseSpread(text, fromEVs, limit = SP_TOTAL) {
  const sp = emptySP();
  for (const part of text.split('/')) {
    const m = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const stat = STAT_ALIASES[toID(m[2])];
    if (!stat) continue;
    const n = parseInt(m[1], 10);
    sp[stat] = clampSP(fromEVs ? Math.round(n / 8) : n);
  }
  // EV spreads can round up past the limit; trim the largest stats back.
  let over = STATS.reduce((a, s) => a + sp[s], 0) - limit;
  while (over > 0) {
    const biggest = STATS.reduce((a, s) => (sp[s] > sp[a] ? s : a), 'hp');
    sp[biggest]--;
    over--;
  }
  return sp;
}

function parseMonBlock(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  let head = lines[0];
  let item = '';
  const at = head.lastIndexOf(' @ ');
  if (at >= 0) {
    item = head.slice(at + 3).trim();
    head = head.slice(0, at).trim();
  }
  let gender = '';
  const g = head.match(/\s\((M|F)\)$/);
  if (g) {
    gender = g[1];
    head = head.slice(0, -4).trim();
  }
  let nickname = '';
  let speciesName = head;
  const paren = head.match(/^(.*)\s\(([^()]+)\)$/);
  if (paren) {
    nickname = paren[1].trim();
    speciesName = paren[2].trim();
  }
  let species = dex.species.get(speciesName);
  if (!species.exists && nickname) {
    // "Species (Nickname)" written backwards
    const alt = dex.species.get(nickname);
    if (alt.exists) [species, nickname] = [alt, speciesName];
  }
  if (species.exists && !isSelectableSpecies(species)) {
    const base = typeof species.battleOnly === 'string' ? species.battleOnly :
      Array.isArray(species.battleOnly) ? species.battleOnly[0] : species.baseSpecies;
    species = dex.species.get(base);
  }
  const mon = newMon(species.exists ? species.name : speciesName);
  if (!species.exists) mon.species = speciesName;
  mon.nickname = nickname && nickname !== mon.species ? cleanName(nickname) : '';
  mon.gender = gender;
  if (item) mon.item = dex.items.get(item).exists ? dex.items.get(item).name : item;
  const moves = [];
  for (const line of lines.slice(1)) {
    let m;
    if ((m = line.match(/^Ability:\s*(.+)$/i))) {
      const a = dex.abilities.get(m[1]);
      mon.ability = a.exists ? a.name : m[1];
    } else if ((m = line.match(/^Tera Type:\s*(.+)$/i))) {
      const t = TERA_TYPES.find(x => toID(x) === toID(m[1]));
      if (t) mon.teraType = t;
    } else if ((m = line.match(/^Gigantamax:\s*(.+)$/i))) {
      mon.gmax = /^y/i.test(m[1]);
    } else if ((m = line.match(/^Shiny:\s*(.+)$/i))) {
      mon.shiny = /^y/i.test(m[1]);
    } else if ((m = line.match(/^SPs?:\s*(.+)$/i))) {
      mon.sp = parseSpread(m[1], false, spLimit(species.exists ? species.name : speciesName));
    } else if ((m = line.match(/^EVs:\s*(.+)$/i))) {
      mon.sp = parseSpread(m[1], true, spLimit(species.exists ? species.name : speciesName));
    } else if ((m = line.match(/^(\w+)\s+Nature$/i))) {
      const n = dex.natures.get(m[1]);
      if (n.exists) mon.nature = n.name;
    } else if ((m = line.match(/^[-~]\s*(.+)$/))) {
      let name = m[1].trim();
      if (/^Hidden Power/i.test(name)) name = 'Hidden Power';
      const move = dex.moves.get(name);
      moves.push(move.exists ? move.name : name);
    }
  }
  mon.moves = [...moves.slice(0, MAX_MOVES), '', '', '', ''].slice(0, MAX_MOVES);
  if (!species.canGigantamax) mon.gmax = false;
  return mon;
}

/**
 * Parses Showdown text. Returns an array of teams: a backup with
 * "=== [format] Name ===" headers gives several; plain text gives one.
 */
export function importTeams(text, fallbackName = 'Imported team') {
  const src = String(text || '').replace(/\r\n?/g, '\n');
  const chunks = [];
  const headerRe = /^===\s*(?:\[[^\]]*\]\s*)?(.*?)\s*===\s*$/gm;
  const headers = [...src.matchAll(headerRe)];
  if (headers.length) {
    headers.forEach((h, i) => {
      const start = h.index + h[0].length;
      const end = i + 1 < headers.length ? headers[i + 1].index : src.length;
      chunks.push({name: h[1] || `${fallbackName} ${i + 1}`, body: src.slice(start, end)});
    });
  } else {
    chunks.push({name: fallbackName, body: src});
  }
  const teams = [];
  for (const chunk of chunks) {
    const mons = chunk.body.split(/\n\s*\n/).map(parseMonBlock).filter(Boolean).slice(0, TEAM_SIZE);
    if (!mons.length) continue;
    const team = newTeam(chunk.name.trim().slice(0, 40) || fallbackName);
    team.mons = mons;
    teams.push(team);
  }
  return teams;
}

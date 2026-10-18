// The team list: create, import, export, duplicate and delete teams.
import {useState} from 'preact/hooks';
import {validateTeam, newTeam, importTeams, exportTeam, uid} from '../engine/team.js';
import {sampleTeams} from '../engine/samples.js';
import {encodeTeam, decodeTeam, findSaveCodes} from '../engine/savecode.js';
import {TEAM_SIZE} from '../engine/constants.js';
import {FitSprite} from './sprites.jsx';
import {Sheet} from './pickers.jsx';

export function TeamStrip({team, height = 52}) {
  const cells = [];
  for (let i = 0; i < TEAM_SIZE; i++) {
    const mon = team.mons[i];
    cells.push(mon ?
      <FitSprite key={i} name={mon.gmax ? `${mon.species}-Gmax` : mon.species} shiny={mon.shiny} width={48} height={height} title={mon.nickname || mon.species} /> :
      <span key={i} class="empty-slot" />);
  }
  return <div class="team-strip">{cells}</div>;
}

export function StatusChip({team}) {
  const {ok, problems} = validateTeam(team);
  if (ok) return <span class="chip chip-good">Ready to battle</span>;
  return <span class="chip chip-bad">{problems.length} {problems.length === 1 ? 'problem' : 'problems'}</span>;
}

function CopyButton({text, target = 'export-text', label = 'Copy'}) {
  const [state, setState] = useState(label);
  const copy = () => {
    const done = () => setState('Copied');
    const fail = () => {
      const area = document.getElementById(target);
      if (area) {
        area.focus();
        area.select();
      }
      setState('Press Ctrl+C to copy');
    };
    try {
      navigator.clipboard.writeText(text).then(done, fail);
    } catch {
      fail();
    }
  };
  return <button class="btn btn-primary" onClick={copy}>{state}</button>;
}

function ExportSheet({team, onClose}) {
  const text = exportTeam(team);
  return (
    <Sheet title={`Export "${team.name}"`} onClose={onClose} foot={<CopyButton text={text} />}>
      <div style={{padding: '8px'}}>
        <p class="muted" style={{marginBottom: '8px'}}>Showdown text format. Stat points are written as "SPs".</p>
        <textarea id="export-text" class="textarea" readOnly value={text} onFocus={e => e.currentTarget.select()} />
      </div>
    </Sheet>
  );
}

export function SaveCodeSheet({team, onClose}) {
  const code = encodeTeam(team);
  return (
    <Sheet title={`Save code for "${team.name}"`} onClose={onClose} foot={<CopyButton text={code} target="save-code-text" label="Copy save code" />}>
      <div style={{padding: '8px', display: 'grid', gap: '10px'}}>
        <p class="muted">This code is the whole team: Pokémon, moves, items, natures, stat points, Tera Types and nicknames. Keep it somewhere safe, like a note or a message to yourself. On any device, go to Teams, then Load a team, and paste it to get this team back.</p>
        <textarea id="save-code-text" class="textarea code-box" readOnly value={code} onFocus={e => e.currentTarget.select()} />
      </div>
    </Sheet>
  );
}

function ImportSheet({onImport, onClose}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const codes = findSaveCodes(text);
    const teams = [];
    const problems = [];
    for (const code of codes) {
      try {
        teams.push(decodeTeam(code));
      } catch (e) {
        problems.push(e.message);
      }
    }
    // Anything that isn't a save code is read as Showdown text.
    const rest = codes.reduce((t, c) => t.replace(c, ''), text);
    if (rest.trim()) teams.push(...importTeams(rest));
    if (!teams.length) {
      setError(problems[0] || 'No team found. Paste a save code (it starts with CPV1.) or a team in Showdown text format.');
      return;
    }
    onImport(teams, problems);
  };
  return (
    <Sheet
      title="Load a team"
      onClose={onClose}
      foot={<>
        <button class="btn" onClick={onClose}>Cancel</button>
        <button class="btn btn-primary" onClick={submit} disabled={!text.trim()}>Load</button>
      </>}
    >
      <div style={{padding: '8px', display: 'grid', gap: '8px'}}>
        <p class="muted">Paste a save code (it starts with CPV1.) or a team from Pokémon Showdown. You can paste several at once. Showdown EVs become stat points (8 EVs ≈ 1 point).</p>
        <textarea
          id="import-text"
          class="textarea"
          value={text}
          onInput={e => {
            setText(e.currentTarget.value);
            setError('');
          }}
          placeholder={'CPV1.E9TdGFydGVyIFNpbmdsZXPIGARCHOMP…\n\nor Showdown text:\n\nGarchomp @ Garchompite\nAbility: Rough Skin\nTera Type: Ground\nSPs: 2 HP / 32 Atk / 32 Spe\nJolly Nature\n- Earthquake\n- Dragon Claw\n- Swords Dance\n- Protect'}
        />
        {error && <p class="error-list" style={{listStyle: 'none', paddingLeft: 0}}>{error}</p>}
      </div>
    </Sheet>
  );
}

export function TeamsPage({teams, setTeams, onEdit}) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [coding, setCoding] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [message, setMessage] = useState('');

  const create = () => {
    const team = newTeam(`Team ${teams.length + 1}`);
    setTeams([...teams, team]);
    onEdit(team.id);
  };
  const duplicate = team => {
    const copy = {...JSON.parse(JSON.stringify(team)), id: uid(), name: `${team.name} (copy)`, updated: Date.now()};
    const i = teams.findIndex(t => t.id === team.id);
    setTeams([...teams.slice(0, i + 1), copy, ...teams.slice(i + 1)]);
  };
  const remove = team => {
    setTeams(teams.filter(t => t.id !== team.id));
    setConfirming(null);
    setMessage(`Deleted "${team.name}".`);
  };
  const addStarters = () => {
    const names = new Set(teams.map(t => t.name));
    const add = sampleTeams().filter(t => !names.has(t.name));
    setTeams([...teams, ...add]);
    setMessage(add.length ? `Added ${add.length} starter ${add.length === 1 ? 'team' : 'teams'}.` : 'The starter teams are already here.');
  };

  return (
    <section>
      <div class="page-head">
        <div>
          <p class="eyebrow">Team builder</p>
          <h1>Your teams</h1>
          <p class="muted">Six Pokémon at level 50. Every Pokémon gets 66 stat points, up to 32 in one stat.</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onClick={create}>New team</button>
          <button class="btn" onClick={() => setImporting(true)}>Load a team</button>
          <button class="btn btn-ghost" onClick={addStarters}>Add starter teams</button>
        </div>
      </div>
      {message && <p class="notice" role="status" style={{marginBottom: '14px'}}>{message}</p>}
      {!teams.length && (
        <div class="card panel" style={{justifyItems: 'start'}}>
          <h3>No teams yet</h3>
          <p class="muted">Start a new team, paste one from Pokémon Showdown, or add the three starter teams to battle right away.</p>
          <div class="btn-row">
            <button class="btn btn-primary" onClick={create}>New team</button>
            <button class="btn" onClick={addStarters}>Add starter teams</button>
          </div>
        </div>
      )}
      <div class="team-grid">
        {teams.map(team => (
          <article key={team.id} class="card team-card">
            <div class="team-card-head">
              <div style={{minWidth: 0, display: 'grid', gap: '6px'}}>
                <h3>{team.name}</h3>
                <div><StatusChip team={team} /></div>
              </div>
              <button class="btn btn-sm" onClick={() => onEdit(team.id)}>Edit</button>
            </div>
            <TeamStrip team={team} />
            {confirming === team.id ? (
              <div class="confirm-inline">
                <span>Delete this team for good?</span>
                <button class="btn btn-sm btn-danger" onClick={() => remove(team)}>Delete</button>
                <button class="btn btn-sm btn-ghost" onClick={() => setConfirming(null)}>Keep it</button>
              </div>
            ) : (
              <div class="btn-row">
                <button class="btn btn-sm btn-ghost" onClick={() => setCoding(team)}>Save code</button>
                <button class="btn btn-sm btn-ghost" onClick={() => setExporting(team)}>Export</button>
                <button class="btn btn-sm btn-ghost" onClick={() => duplicate(team)}>Duplicate</button>
                <button class="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirming(team.id)}>Delete</button>
              </div>
            )}
          </article>
        ))}
      </div>
      {importing && (
        <ImportSheet
          onClose={() => setImporting(false)}
          onImport={(imported, problems = []) => {
            setTeams([...teams, ...imported]);
            setImporting(false);
            setMessage(`Loaded ${imported.length} ${imported.length === 1 ? 'team' : 'teams'}: ${imported.map(t => t.name).join(', ')}.` +
              (problems.length ? ` ${problems.length} code${problems.length === 1 ? '' : 's'} couldn't be read: ${problems[0]}` : ''));
          }}
        />
      )}
      {exporting && <ExportSheet team={exporting} onClose={() => setExporting(null)} />}
      {coding && <SaveCodeSheet team={coding} onClose={() => setCoding(null)} />}
    </section>
  );
}

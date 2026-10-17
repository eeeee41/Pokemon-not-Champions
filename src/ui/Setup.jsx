// Setting up a battle between two players on this device.
import {useState} from 'preact/hooks';
import {validateTeam} from '../engine/team.js';
import {MODES} from '../engine/constants.js';
import {FitSprite} from './sprites.jsx';

function TeamOption({team, selected, onSelect}) {
  const {ok, problems} = validateTeam(team);
  return (
    <button class="team-option" aria-pressed={selected} disabled={!ok} onClick={onSelect}
      title={ok ? '' : problems.map(p => p.text).join('\n')}>
      <span class="row">
        <strong style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{team.name}</strong>
        {ok ? null : <span class="chip chip-bad">Needs fixes</span>}
      </span>
      <span class="mini-strip">
        {team.mons.map((m, i) => <FitSprite key={i} name={m.gmax ? `${m.species}-Gmax` : m.species} width={40} height={34} />)}
      </span>
    </button>
  );
}

export function SetupPage({teams, settings, onStart, onTeams}) {
  const ready = teams.filter(t => validateTeam(t).ok);
  const [mode, setMode] = useState(settings.mode);
  const [names, setNames] = useState(settings.names);
  const [hide, setHide] = useState(settings.hideChoices);
  const [picks, setPicks] = useState(() => {
    const has = id => ready.some(t => t.id === id);
    const a = has(settings.lastTeams?.[0]) ? settings.lastTeams[0] : ready[0]?.id;
    const b = has(settings.lastTeams?.[1]) ? settings.lastTeams[1] : (ready[1] || ready[0])?.id;
    return [a, b];
  });

  const setName = (i, v) => setNames(names.map((n, j) => (j === i ? v.slice(0, 18) : n)));
  const setPick = (i, id) => setPicks(picks.map((p, j) => (j === i ? id : p)));
  const canStart = picks[0] && picks[1] && ready.length > 0;

  const start = () => {
    let clean = names.map((n, i) => n.trim() || `Player ${i + 1}`);
    if (clean[0] === clean[1]) clean = [clean[0], `${clean[1]} (2)`];
    onStart({
      mode,
      hideChoices: hide,
      players: picks.map((id, i) => ({name: clean[i], team: teams.find(t => t.id === id)})),
      names: clean,
    });
  };

  return (
    <section class="setup">
      <div class="page-head" style={{marginBottom: 0}}>
        <div>
          <p class="eyebrow">Local battle</p>
          <h1>Two players, one device</h1>
          <p class="muted">Take turns on this screen. Online Quick Match comes next, once the site is connected to Firebase.</p>
        </div>
      </div>

      <div class="card panel">
        <div style={{display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between'}}>
          <div style={{display: 'grid', gap: '6px'}}>
            <span class="eyebrow">Format</span>
            <div class="seg" role="group" aria-label="Format">
              {Object.values(MODES).map(m => (
                <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label} · {m.blurb}</button>
              ))}
            </div>
          </div>
          <label class="switch">
            <input id="hide-choices" type="checkbox" checked={hide} onChange={e => setHide(e.currentTarget.checked)} />
            Hide each player's turn from the other
          </label>
        </div>
      </div>

      {!ready.length ? (
        <div class="card panel" style={{justifyItems: 'start'}}>
          <h3>No team is ready yet</h3>
          <p class="muted">Each player needs a legal team of six. Finish a team or add the starter teams.</p>
          <button class="btn btn-primary" onClick={onTeams}>Go to teams</button>
        </div>
      ) : (
        <div class="setup-grid">
          {[0, 1].map(i => (
            <div key={i} class="card player-card">
              <h3><span class={`player-tag${i ? ' p2' : ''}`}>P{i + 1}</span> Player {i + 1}</h3>
              <label class="label">
                <span>Name</span>
                <input id={`player-name-${i}`} class="input" value={names[i]} maxLength={18} onInput={e => setName(i, e.currentTarget.value)} />
              </label>
              <div class="label">
                <span>Team</span>
                <div class="team-options" role="group" aria-label={`Player ${i + 1} team`}>
                  {teams.map(t => <TeamOption key={t.id} team={t} selected={picks[i] === t.id} onSelect={() => setPick(i, t.id)} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div class="btn-row">
        <button class="btn btn-primary btn-lg" disabled={!canStart} onClick={start}>Start {MODES[mode].label} battle</button>
        <button class="btn btn-ghost" onClick={onTeams}>Edit teams</button>
      </div>
    </section>
  );
}

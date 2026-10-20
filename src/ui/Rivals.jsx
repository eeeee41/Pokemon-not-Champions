// Battle the rivals from every generation against the computer (Singles).
import {validateTeam} from '../engine/team.js';
import {RIVALS, rivalTeams} from '../engine/rivals.js';
import {creatorUnlocked, championWins} from '../engine/creator.js';
import {LEVELS} from '../engine/bot.js';
import {TeamOption} from './Setup.jsx';
import {FitSprite} from './sprites.jsx';

/** The team picked for rival battles, or the first legal one. */
export function rivalPlayerTeam(teams, settings) {
  const ready = teams.filter(t => validateTeam(t).ok);
  return ready.find(t => t.id === settings.rivalTeam) || ready[0] || null;
}

function spriteName(mon) {
  return mon.gmax ? `${mon.species}-Gmax` : mon.species;
}

export function RivalsPage({teams, settings, setSettings, onBattle, onTeams}) {
  const level = LEVELS[settings.rivalLevel] ? settings.rivalLevel : 'hard';
  const team = rivalPlayerTeam(teams, settings);
  const readyTeams = teams.filter(t => validateTeam(t).ok);
  const wins = settings.rivalWins || {};
  const rivalTeam = rivalTeams();
  const beaten = RIVALS.filter(r => wins[r.id]?.includes(level)).length;

  return (
    <section class="rivals">
      <div class="page-head" style={{marginBottom: 0}}>
        <div>
          <p class="eyebrow">Rivals · Singles vs the computer</p>
          <h1>Beat every rival</h1>
          <p class="muted">The rivals from every generation, with their teams from their toughest battles, on competitive sets.</p>
          {!creatorUnlocked() && (
            <p class="muted secret-hint">Beat all {RIVALS.length} on Champion difficulty to unlock a secret ({championWins().length} / {RIVALS.length} so far).</p>
          )}
        </div>
        <span class="chip chip-gold" title="Rivals beaten on this difficulty">{beaten} / {RIVALS.length} beaten on {LEVELS[level].label}</span>
      </div>

      <div class="card panel rivals-setup">
        <div style={{display: 'grid', gap: '6px'}}>
          <span class="eyebrow">Difficulty</span>
          <div class="seg seg-full seg-3" role="group" aria-label="Difficulty">
            {Object.entries(LEVELS).map(([id, l]) => (
              <button key={id} aria-pressed={level === id} onClick={() => setSettings({...settings, rivalLevel: id})}>
                <span>{l.label}</span>
                <span class="seg-sub">{l.blurb}</span>
              </button>
            ))}
          </div>
        </div>
        <div class="label">
          <span>Your team</span>
          {readyTeams.length ? (
            <div class="team-options team-options-row" role="group" aria-label="Your team">
              {teams.map(t => (
                <TeamOption key={t.id} team={t} selected={team?.id === t.id} onSelect={() => setSettings({...settings, rivalTeam: t.id})} />
              ))}
            </div>
          ) : (
            <div class="notice">You need a legal team of six first. <button class="btn btn-sm" onClick={onTeams}>Go to teams</button></div>
          )}
        </div>
      </div>

      <div class="rival-grid">
        {RIVALS.map(r => {
          const done = wins[r.id] || [];
          return (
            <article key={r.id} class={`card rival-card${done.includes(level) ? ' beaten' : ''}`}>
              <div class="rival-ace" aria-hidden="true"><FitSprite name={r.ace} width={96} height={86} /></div>
              <div class="rival-info">
                <h3>{r.name}{r.aka && <span class="muted"> ({r.aka})</span>}</h3>
                <p class="muted rival-game">{r.game} · {r.region}</p>
                <div class="rival-pips" title="Beaten on">
                  {Object.entries(LEVELS).map(([id, l]) => (
                    <span key={id} class={`rival-pip${done.includes(id) ? ' on' : ''}`} title={`${l.label}: ${done.includes(id) ? 'beaten' : 'not yet'}`}>{l.label[0]}</span>
                  ))}
                </div>
              </div>
              <div class="mini-strip rival-team" aria-label={`${r.name}'s team`}>
                {rivalTeam[r.id].mons.map((m, i) => <FitSprite key={i} name={spriteName(m)} width={40} height={34} />)}
              </div>
              <button class="btn btn-primary" disabled={!team} onClick={() => onBattle(r, level, team)}>
                Battle {r.name}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

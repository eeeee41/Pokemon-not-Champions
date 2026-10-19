// Online battles: Quick Match, private battle codes, challenges, and who's online.
import {useEffect, useState} from 'preact/hooks';
import {validateTeam} from '../engine/team.js';
import {MODES} from '../engine/constants.js';
import {normalizeCode} from '../online/lobby.js';
import {TeamOption} from './Setup.jsx';
import {CopyButton} from './Teams.jsx';

/** 75000 → "1:15" */
export function clock(ms) {
  const s = Math.max(0, Math.ceil((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Re-renders once a second while `active`. */
export function useTicker(active) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const iv = setInterval(() => setN(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, [active]);
}

/** The team chosen for online battles, or the first legal one. */
export function onlineTeam(teams, settings) {
  const ready = teams.filter(t => validateTeam(t).ok);
  return ready.find(t => t.id === settings.onlineTeam) || ready[0] || null;
}

const STATE_LABELS = {idle: 'Ready to battle', searching: 'In Quick Match', hosting: 'Waiting for a friend', battling: 'In a battle'};

function Spinner() {
  return <span class="spinner" aria-hidden="true" />;
}

function Waiting({children, onCancel}) {
  return (
    <div class="waiting" role="status">
      <Spinner />
      <span class="grow">{children}</span>
      {onCancel && <button class="btn btn-sm" onClick={onCancel}>Cancel</button>}
    </div>
  );
}

function Unavailable({onLocal}) {
  return (
    <section class="online">
      <div class="card panel online-unavailable">
        <p class="eyebrow">Online battles</p>
        <h1>Online play needs the hosted site</h1>
        <p class="muted">
          This copy of Champions PvP can't reach the online server. That's expected for the preview and for the
          offline file. Online battles work on the version hosted with Firebase, at your project's
          <strong> .web.app</strong> address. Two players on one device works everywhere.
        </p>
        <div class="btn-row">
          <button class="btn btn-primary" onClick={onLocal}>Battle on this device</button>
        </div>
      </div>
    </section>
  );
}

export function OnlinePage({online, session, teams, settings, setSettings, onTeams, onLocal}) {
  useEffect(() => {
    session.connect(settings.onlineName);
  }, [session]);
  const [codeText, setCodeText] = useState('');
  const [nameText, setNameText] = useState(settings.onlineName || '');
  useTicker(!!online.task);

  if (online.status === 'unavailable') return <Unavailable onLocal={onLocal} />;
  if (online.status === 'error') {
    return (
      <section class="online">
        <div class="card panel online-unavailable">
          <p class="eyebrow">Online battles</p>
          <h1>Couldn't connect</h1>
          <p role="alert">{online.error}</p>
          <div class="btn-row">
            <button class="btn btn-primary" onClick={() => session.connect(settings.onlineName)}>Try again</button>
            <button class="btn" onClick={onLocal}>Battle on this device</button>
          </div>
        </div>
      </section>
    );
  }
  if (online.status !== 'ready') {
    return (
      <section class="online">
        <div class="card panel online-unavailable"><Waiting>Connecting to the online lobby…</Waiting></div>
      </section>
    );
  }

  const mode = settings.onlineMode || 'singles';
  const team = onlineTeam(teams, settings);
  const readyTeams = teams.filter(t => validateTeam(t).ok);
  const task = online.task;
  const busy = online.busy || !!task;
  const elapsed = task ? clock(Date.now() - task.startedAt) : '';
  const setMode = m => setSettings({...settings, onlineMode: m});
  const setTeam = id => setSettings({...settings, onlineTeam: id});
  const saveName = e => {
    e.preventDefault();
    const clean = nameText.trim();
    setSettings({...settings, onlineName: clean});
    if (clean) session.setName(clean);
  };
  const join = async e => {
    e.preventDefault();
    if (await session.joinRoom(codeText, team)) setCodeText('');
  };
  const {wins, losses} = online.record;

  return (
    <section class="online">
      <div class="page-head" style={{marginBottom: 0}}>
        <div>
          <p class="eyebrow">Online battles</p>
          <h1>Battle someone anywhere</h1>
          <p class="muted">Quick Match pairs you with the next player who's looking. For a friend, make a private code.</p>
        </div>
        <div class="card online-id">
          <form class="name-form" onSubmit={saveName}>
            <label class="label">
              <span>Your name</span>
              <input id="online-name" class="input" maxLength={16} value={nameText} placeholder={online.name}
                onInput={e => setNameText(e.currentTarget.value)} />
            </label>
            <button class="btn btn-sm" disabled={!nameText.trim() || nameText.trim() === online.name}>Save</button>
          </form>
          <div class="online-id-foot">
            <span class={`online-dot${online.connected ? ' live' : ''}`} aria-hidden="true" />
            <span class="muted">{online.connected ? `Online as ${online.name}` : 'Reconnecting…'}</span>
            <span class="record" title="Your online record in this browser">{wins}W–{losses}L</span>
          </div>
        </div>
      </div>

      {online.notice && (
        <div class="notice row-between" role="status">
          <span>{online.notice}</span>
          <button class="btn btn-ghost btn-sm" onClick={() => session.dismissNotice()}>OK</button>
        </div>
      )}
      {online.taskError && <p class="error-list" role="alert" style={{listStyle: 'none', paddingLeft: 0, margin: 0}}>{online.taskError}</p>}

      {online.rejoin && (
        <div class="card online-banner">
          <div>
            <strong>You're still in a battle with {online.rejoin.opponent}.</strong>
            <span class="muted"> {MODES[online.rejoin.mode]?.label || ''}. If you don't come back, they can claim the win.</span>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" disabled={online.busy} onClick={() => session.rejoin(team)}>Rejoin</button>
            <button class="btn btn-ghost btn-danger" disabled={online.busy} onClick={() => session.forfeitRejoin()}>Forfeit it</button>
          </div>
        </div>
      )}

      {online.invites.length > 0 && (
        <div class="card panel">
          <h3>Challenges for you</h3>
          {online.invites.map(inv => (
            <div key={inv.from} class="invite-row">
              <span><strong>{inv.name}</strong> wants a {MODES[inv.mode]?.label || ''} battle.</span>
              <div class="btn-row">
                <button class="btn btn-primary btn-sm" disabled={!team || online.busy} onClick={() => session.accept(inv, team)}>
                  {team ? `Accept with ${team.name}` : 'Accept'}
                </button>
                <button class="btn btn-ghost btn-sm" onClick={() => session.decline(inv)}>No thanks</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div class="online-grid">
        <div class="card panel">
          <div style={{display: 'grid', gap: '6px'}}>
            <span class="eyebrow">Format</span>
            <div class="seg seg-full" role="group" aria-label="Format">
              {Object.values(MODES).map(m => (
                <button key={m.id} aria-pressed={mode === m.id} disabled={busy} onClick={() => setMode(m.id)}>
                  <span>{m.label}</span>
                  <span class="seg-sub">{m.blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <div class="label">
            <span>Your team</span>
            {readyTeams.length ? (
              <div class="team-options" role="group" aria-label="Your team">
                {teams.map(t => <TeamOption key={t.id} team={t} selected={team?.id === t.id} disabled={busy} onSelect={() => setTeam(t.id)} />)}
              </div>
            ) : (
              <div class="notice">
                You need a legal team of six to battle online. <button class="btn btn-sm" onClick={onTeams}>Go to teams</button>
              </div>
            )}
          </div>
        </div>

        <div class="online-actions">
          <article class="card panel online-card">
            <div>
              <p class="eyebrow">Quick Match</p>
              <h2>Find an opponent</h2>
            </div>
            <p class="muted">You'll be paired with the next player looking for a {MODES[mode].label} battle.</p>
            {task?.kind === 'search' ? (
              <Waiting onCancel={() => session.cancel()}>{task.status} <span class="num">{elapsed}</span></Waiting>
            ) : (
              <button class="btn btn-primary btn-lg" disabled={busy || !team} onClick={() => session.quickMatch(mode, team)}>
                Find a {MODES[mode].label} battle
              </button>
            )}
          </article>

          <article class="card panel online-card">
            <div>
              <p class="eyebrow">Private battle</p>
              <h2>Battle a friend</h2>
            </div>
            {task?.kind === 'room' ? (
              <div class="room-box">
                <span class="muted">Send your friend this code. It works for one {MODES[task.mode].label} battle.</span>
                <input id="room-code" class="room-code" readOnly value={task.code} aria-label="Battle code"
                  onFocus={e => e.currentTarget.select()} />
                <Waiting onCancel={() => session.cancel()}>Waiting for your friend to join… <span class="num">{elapsed}</span></Waiting>
                <CopyButton text={task.code} target="room-code" label="Copy code" className="btn btn-sm" />
              </div>
            ) : (
              <>
                <button class="btn" disabled={busy || !team} onClick={() => session.hostRoom(mode, team)}>Create a {MODES[mode].label} code</button>
                <form class="join-form" onSubmit={join}>
                  <label class="label">
                    <span>Got a code from a friend?</span>
                    <input id="join-code" class="input code-input" placeholder="K7Q2M" maxLength={9} autoComplete="off"
                      autoCapitalize="characters" spellcheck={false} value={codeText} onInput={e => setCodeText(e.currentTarget.value)} />
                  </label>
                  <button class="btn btn-primary" disabled={busy || !team || !normalizeCode(codeText)}>Join</button>
                </form>
              </>
            )}
          </article>
        </div>
      </div>

      <div class="card panel">
        <div class="row-between">
          <h3>Online now</h3>
          <span class="chip">{online.players.length} other {online.players.length === 1 ? 'player' : 'players'}</span>
        </div>
        {task?.kind === 'challenge' && (
          <Waiting onCancel={() => session.cancel()}>
            Waiting for {task.toName} to answer your {MODES[task.mode].label} challenge… <span class="num">{elapsed}</span>
          </Waiting>
        )}
        {online.players.length ? (
          <ul class="player-list">
            {online.players.map(p => (
              <li key={p.uid} class="player-row">
                <span class={`presence-dot${p.state === 'idle' ? '' : ' busy'}`} aria-hidden="true" />
                <span class="player-who">
                  <strong>{p.name}</strong>
                  <span class="muted">{STATE_LABELS[p.state] || ''}</span>
                </span>
                <button class="btn btn-sm" disabled={busy || p.state !== 'idle' || !team} onClick={() => session.challenge(p, mode, team)}>
                  Challenge
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">Nobody else is here right now. Send a friend this site's link, or start Quick Match and wait for someone.</p>
        )}
      </div>
    </section>
  );
}

/** A challenge banner shown on other pages. */
export function InviteBanner({invite, team, busy, onAccept, onDecline, onOpen}) {
  return (
    <div class="card invite-banner" role="status">
      <span><strong>{invite.name}</strong> challenges you to a {MODES[invite.mode]?.label || ''} battle!</span>
      <div class="btn-row">
        {team ? (
          <button class="btn btn-primary btn-sm" disabled={busy} onClick={onAccept}>Accept with {team.name}</button>
        ) : (
          <button class="btn btn-primary btn-sm" onClick={onOpen}>Pick a team</button>
        )}
        <button class="btn btn-ghost btn-sm" onClick={onDecline}>No thanks</button>
      </div>
    </div>
  );
}

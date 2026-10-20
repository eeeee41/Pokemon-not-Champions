// App shell and navigation.
import {useEffect, useRef, useState} from 'preact/hooks';
import {validateTeam} from '../engine/team.js';
import {loadTeams, saveTeams, loadSettings, saveSettings} from './store.js';
import {HomePage} from './Home.jsx';
import {TeamsPage} from './Teams.jsx';
import {TeamEditor} from './TeamEditor.jsx';
import {SetupPage} from './Setup.jsx';
import {BattleScreen} from './Battle.jsx';
import {OnlinePage, InviteBanner, onlineTeam} from './Online.jsx';
import {RivalsPage} from './Rivals.jsx';
import {BotGame} from './bot-game.js';
import {rivalTeams, beatEveryRival} from '../engine/rivals.js';
import {creatorUnlocked, unlockByRivals} from '../engine/creator.js';
import {LocalGame} from './local-game.js';
import {OnlineSession} from './online-session.js';
import {OnlineGame} from '../online/online-game.js';

function BrandMark() {
  return (
    <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M2.5 16h9.2a4.4 4.4 0 0 1 8.6 0h9.2" fill="none" stroke="currentColor" stroke-width="2.5" />
      <circle cx="16" cy="16" r="2.6" fill="#f0ab2a" />
    </svg>
  );
}

const TITLE = typeof document !== 'undefined' ? document.title : '';

/** While this tab is in the background, shows `text` in its title. */
function flagTitle(text) {
  if (typeof document === 'undefined' || !document.hidden) return;
  document.title = `${text} · Champions PvP`;
  const back = () => {
    if (document.hidden) return;
    document.title = TITLE;
    document.removeEventListener('visibilitychange', back);
  };
  document.addEventListener('visibilitychange', back);
}

export function App() {
  const [teams, setTeams] = useState(loadTeams);
  const [settings, setSettings] = useState(loadSettings);
  const [route, setRoute] = useState({name: 'home'});
  const [game, setGame] = useState(null);
  const [session] = useState(() => new OnlineSession());
  const [online, setOnline] = useState(session.state);
  const gameRef = useRef(null);
  gameRef.current = game;

  useEffect(() => {
    saveTeams(teams);
  }, [teams]);
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  // Beating every rival on Champion unlocks MissingNo.
  const [secret, setSecret] = useState(false);
  useEffect(() => {
    if (beatEveryRival(settings.rivalWins) && !creatorUnlocked()) {
      unlockByRivals();
      setSecret(true);
    }
  }, [settings.rivalWins]);

  const go = r => {
    setRoute(r);
    window.scrollTo(0, 0);
  };

  // Online: the session tells us when a battle is ready, wherever we are.
  useEffect(() => {
    const stop = session.subscribe(setOnline);
    session.onMatch = info => {
      const old = gameRef.current;
      if (old?.dispose) old.dispose();
      const next = new OnlineGame({backend: session.backend, matchId: info.id, side: info.side, teamCode: info.teamCode});
      next.start();
      setGame(next);
      go({name: 'battle'});
      flagTitle('⚔ Battle found!');
    };
    return stop;
  }, [session]);
  const invitesSeen = useRef(0);
  useEffect(() => {
    if (online.invites.length > invitesSeen.current) flagTitle(`⚔ ${online.invites[0].name} challenges you`);
    invitesSeen.current = online.invites.length;
  }, [online.invites]);

  const readyTeams = teams.filter(t => validateTeam(t).ok).length;

  const closeGame = () => {
    if (game?.online) {
      session.leftBattle(game.id);
      game.dispose();
    }
    setGame(null);
  };

  const startBot = (rival, level, team) => {
    if (game?.online) closeGame();
    setSettings(prev => ({...prev, rivalLevel: level, rivalTeam: team.id}));
    const next = new BotGame({rival, level, team, rivalTeam: rivalTeams()[rival.id]});
    // Remember each rival beaten, per difficulty.
    let counted = false;
    next.subscribe(() => {
      if (counted || next.phase.type !== 'over' || next.phase.winner !== 0) return;
      counted = true;
      setSettings(prev => {
        const wins = {...(prev.rivalWins || {})};
        wins[rival.id] = [...new Set([...(wins[rival.id] || []), level])];
        return {...prev, rivalWins: wins};
      });
    });
    setGame(next);
    go({name: 'battle'});
  };

  const startGame = ({mode, players, hideChoices, names}) => {
    // An online battle left open carries on without this page; it can be rejoined.
    if (game?.online) closeGame();
    setSettings({...settings, mode, hideChoices, names, lastTeams: players.map(p => p.team.id)});
    setGame(new LocalGame({mode, players: players.map(p => ({name: p.name, team: JSON.parse(JSON.stringify(p.team))})), hideChoices}));
    go({name: 'battle'});
  };

  let page;
  if (route.name === 'teams') {
    page = <TeamsPage teams={teams} setTeams={setTeams} onEdit={id => go({name: 'editor', id})} />;
  } else if (route.name === 'editor') {
    const team = teams.find(t => t.id === route.id);
    page = team ? (
      <TeamEditor
        team={team}
        onChange={next => setTeams(teams.map(t => (t.id === next.id ? next : t)))}
        onBack={() => go({name: 'teams'})}
        onBattle={() => {
          setSettings({...settings, lastTeams: [team.id, settings.lastTeams?.[1] || team.id]});
          go({name: 'setup'});
        }}
      />
    ) : <TeamsPage teams={teams} setTeams={setTeams} onEdit={id => go({name: 'editor', id})} />;
  } else if (route.name === 'setup') {
    page = <SetupPage key={JSON.stringify(settings.lastTeams)} teams={teams} settings={settings} onStart={startGame} onTeams={() => go({name: 'teams'})} />;
  } else if (route.name === 'rivals') {
    page = <RivalsPage teams={teams} settings={settings} setSettings={setSettings} onBattle={startBot} onTeams={() => go({name: 'teams'})} />;
  } else if (route.name === 'online') {
    page = (
      <OnlinePage online={online} session={session} teams={teams} settings={settings} setSettings={setSettings}
        onTeams={() => go({name: 'teams'})} onLocal={() => go({name: 'setup'})} />
    );
  } else if (route.name === 'battle' && game) {
    const opponent = game.online ? {uid: game.opponentUid, name: game.opponentName} : null;
    const myCode = game.online ? game.teamCodes?.[game.side] : null;
    const rematch = game.online ? {
      invite: online.invites.find(i => i.from === game.opponentUid) || null,
      waiting: online.task?.kind === 'challenge' && online.task.to === game.opponentUid,
      notice: online.notice,
      busy: online.busy,
      available: online.status === 'ready' && !!game.opponentUid && !!myCode,
    } : null;
    page = (
      <BattleScreen
        game={game}
        speed={settings.speed}
        onSpeed={speed => setSettings({...settings, speed})}
        onLeave={() => {
          const back = game.online ? 'online' : game.bot ? 'rivals' : 'setup';
          if (game.bot) game.dispose();
          closeGame();
          go({name: back});
        }}
        onRematch={() => {
          if (game.online) {
            session.challenge(opponent, game.mode, myCode);
            return;
          }
          if (game.bot) {
            game.dispose();
            startBot(game.bot.rival, game.bot.level, game.players[0].team);
            window.scrollTo(0, 0);
            return;
          }
          setGame(new LocalGame({mode: game.mode, players: game.players, hideChoices: game.hideChoices}));
          window.scrollTo(0, 0);
        }}
        rematch={rematch}
        onAcceptRematch={() => rematch?.invite && session.accept(rematch.invite, myCode)}
        onDeclineRematch={() => rematch?.invite && session.decline(rematch.invite)}
        onCancelRematch={() => session.cancel()}
      />
    );
  } else {
    page = (
      <HomePage readyTeams={readyTeams} onTeams={() => go({name: 'teams'})} onRivals={() => go({name: 'rivals'})}
        onOnline={mode => {
          if (mode) setSettings({...settings, onlineMode: mode});
          go({name: 'online'});
        }}
        onPlay={mode => {
          setSettings({...settings, mode});
          go({name: 'setup'});
        }} />
    );
  }

  // A challenge reaches you on any page, except mid-battle (and rematch offers,
  // which the battle's result card shows).
  const inBattle = route.name === 'battle' && game?.online && game.phase.type !== 'over';
  const banner = route.name !== 'online' && !inBattle ?
    online.invites.find(i => !(route.name === 'battle' && game?.online && i.from === game.opponentUid)) : null;
  const team = onlineTeam(teams, settings);

  const section = route.name === 'teams' || route.name === 'editor' ? 'teams' : route.name === 'home' ? 'home' :
    route.name === 'online' || (route.name === 'battle' && game?.online) ? 'online' :
    route.name === 'rivals' || (route.name === 'battle' && game?.bot) ? 'rivals' : 'play';
  const localGame = game && !game.online && !game.bot ? game : null;
  const botGame = game?.bot ? game : null;
  const onlineGame = game?.online ? game : null;
  return (
    <div class="app">
      <header class="topbar">
        <div class="topbar-inner">
          <button class="brand" onClick={() => go({name: 'home'})}>
            <BrandMark />
            <span>Champions PvP</span>
            <small>Beta</small>
          </button>
          <nav class="nav" aria-label="Main">
            <button aria-current={section === 'play' ? 'page' : undefined} onClick={() => go(localGame ? {name: 'battle'} : {name: 'setup'})}>
              {localGame ? 'Battle' : 'Play'}
            </button>
            <button aria-current={section === 'rivals' ? 'page' : undefined} onClick={() => go(botGame ? {name: 'battle'} : {name: 'rivals'})}>
              Rivals
            </button>
            <button aria-current={section === 'online' ? 'page' : undefined} onClick={() => go(onlineGame ? {name: 'battle'} : {name: 'online'})}>
              Online{online.invites.length > 0 && <span class="nav-badge" aria-label={`${online.invites.length} challenge`}>{online.invites.length}</span>}
            </button>
            <button aria-current={section === 'teams' ? 'page' : undefined} onClick={() => go({name: 'teams'})}>Teams</button>
          </nav>
        </div>
      </header>
      <main class="main">
        {secret && (
          <div class="card notice creator-notice secret-unlock" role="status">
            <span>You beat every rival on Champion difficulty. <strong>MissingNo. is unlocked</strong>: search for it in the team builder.</span>
            <button class="btn btn-sm" onClick={() => setSecret(false)}>Got it</button>
          </div>
        )}
        {banner && (
          <InviteBanner invite={banner} team={team} busy={online.busy}
            onAccept={() => session.accept(banner, team)}
            onDecline={() => session.decline(banner)}
            onOpen={() => go({name: 'online'})} />
        )}
        {page}
      </main>
      <footer class="footer">
        <div class="footer-inner">
          A fan project. Battle engine: Pokémon Showdown (MIT). Sprites: Smogon's sprite project. Pokémon © Nintendo, Game Freak and Creatures.
        </div>
      </footer>
    </div>
  );
}

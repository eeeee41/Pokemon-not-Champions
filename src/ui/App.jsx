// App shell and navigation.
import {useEffect, useState} from 'preact/hooks';
import {validateTeam} from '../engine/team.js';
import {loadTeams, saveTeams, loadSettings, saveSettings} from './store.js';
import {HomePage} from './Home.jsx';
import {TeamsPage} from './Teams.jsx';
import {TeamEditor} from './TeamEditor.jsx';
import {SetupPage} from './Setup.jsx';
import {BattleScreen} from './Battle.jsx';
import {LocalGame} from './local-game.js';

function BrandMark() {
  return (
    <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2.5" />
      <path d="M2.5 16h9.2a4.4 4.4 0 0 1 8.6 0h9.2" fill="none" stroke="currentColor" stroke-width="2.5" />
      <circle cx="16" cy="16" r="2.6" fill="#f0ab2a" />
    </svg>
  );
}

export function App() {
  const [teams, setTeams] = useState(loadTeams);
  const [settings, setSettings] = useState(loadSettings);
  const [route, setRoute] = useState({name: 'home'});
  const [game, setGame] = useState(null);

  useEffect(() => {
    saveTeams(teams);
  }, [teams]);
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const go = r => {
    setRoute(r);
    window.scrollTo(0, 0);
  };
  const readyTeams = teams.filter(t => validateTeam(t).ok).length;

  const startGame = ({mode, players, hideChoices, names}) => {
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
  } else if (route.name === 'battle' && game) {
    page = (
      <BattleScreen
        game={game}
        speed={settings.speed}
        onSpeed={speed => setSettings({...settings, speed})}
        onLeave={() => {
          setGame(null);
          go({name: 'setup'});
        }}
        onRematch={() => {
          setGame(new LocalGame({mode: game.mode, players: game.players, hideChoices: game.hideChoices}));
          window.scrollTo(0, 0);
        }}
      />
    );
  } else {
    page = <HomePage readyTeams={readyTeams} onTeams={() => go({name: 'teams'})} onPlay={mode => {
      setSettings({...settings, mode});
      go({name: 'setup'});
    }} />;
  }

  const section = route.name === 'teams' || route.name === 'editor' ? 'teams' : route.name === 'home' ? 'home' : 'play';
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
            <button aria-current={section === 'play' ? 'page' : undefined} onClick={() => go(game ? {name: 'battle'} : {name: 'setup'})}>{game ? 'Battle' : 'Play'}</button>
            <button aria-current={section === 'teams' ? 'page' : undefined} onClick={() => go({name: 'teams'})}>Teams</button>
          </nav>
        </div>
      </header>
      <main class="main">{page}</main>
      <footer class="footer">
        <div class="footer-inner">
          A fan project. Battle engine: Pokémon Showdown (MIT). Sprites: Smogon's sprite project. Pokémon © Nintendo, Game Freak and Creatures.
        </div>
      </footer>
    </div>
  );
}

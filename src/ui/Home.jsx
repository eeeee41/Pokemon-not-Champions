// The landing page.
import {MODES, SP_TOTAL, SP_MAX, LEVEL} from '../engine/constants.js';
import {Sprite} from './sprites.jsx';

const LINEUP = ['Garchomp-Mega', 'Charizard-Gmax', 'Kingambit', 'Flutter Mane', 'Clefable-Mega'];

export function HomePage({onPlay, onOnline, onRivals, onTeams, readyTeams}) {
  return (
    <div class="home">
      <section class="hero">
        <div style={{position: 'relative', zIndex: 1}}>
          <p class="eyebrow" style={{color: 'var(--gold)'}}>Pokémon battles · real players</p>
          <h1>Build six. <em>Battle a friend.</em></h1>
          <p>Every Pokémon from every generation, with Mega Evolution, Z-Moves, Gigantamax and Terastallization, on Pokémon Champions stat rules.</p>
          <div class="btn-row">
            <button class="btn btn-primary btn-lg" onClick={() => onOnline()}>Battle online</button>
            <button class="btn btn-lg" onClick={onRivals}>Fight the rivals</button>
            <button class="btn btn-lg btn-ghost" onClick={onTeams}>Build a team</button>
          </div>
        </div>
        <div class="hero-lineup" aria-hidden="true">
          {LINEUP.map((name, i) => (
            <span key={name} class="sprite-box" style={{zIndex: i === 2 ? 3 : i === 1 || i === 3 ? 2 : 1}}>
              <Sprite name={name} scale={i === 2 ? 1.5 : 1.2} />
            </span>
          ))}
        </div>
      </section>

      <section style={{display: 'grid', gap: '12px'}}>
        <p class="eyebrow">Champions rules</p>
        <div class="rules">
          <span class="rule-chip"><b>Lv {LEVEL}</b><span class="muted">every Pokémon</span></span>
          <span class="rule-chip"><b>31</b><span class="muted">IVs in every stat</span></span>
          <span class="rule-chip"><b>{SP_TOTAL}</b><span class="muted">stat points each, max {SP_MAX} per stat</span></span>
          <span class="rule-chip"><b>25</b><span class="muted">natures</span></span>
          <span class="rule-chip"><b>6</b><span class="muted">Pokémon per team</span></span>
          <span class="rule-chip"><span class="gimmick-badge g-mega">Mega</span><span class="gimmick-badge g-z">Z-Move</span><span class="gimmick-badge g-gmax">G-Max</span><span class="gimmick-badge g-tera">Tera</span><span class="muted">once each per battle</span></span>
        </div>
      </section>

      <section class="modes">
        {Object.values(MODES).map(m => (
          <article key={m.id} class="card mode-card">
            <div class="mode-pips" aria-hidden="true">
              {Array.from({length: m.active}, (_, i) => <span key={`a${i}`} class="pip" />)}
              <span style={{margin: '0 6px'}}>vs</span>
              {Array.from({length: m.active}, (_, i) => <span key={`b${i}`} class="pip foe" />)}
            </div>
            <h2>{m.label}</h2>
            <p class="muted">One player against one player, {m.active === 1 ? 'one Pokémon out each. Pure head-to-head.' : 'two Pokémon out each. Targeting, spread moves and partners matter.'}</p>
            <div class="btn-row">
              <button class="btn btn-primary" onClick={() => onOnline(m.id)} disabled={!readyTeams}>{m.label} online</button>
              <button class="btn" onClick={() => onPlay(m.id)} disabled={!readyTeams}>On this device</button>
            </div>
          </article>
        ))}
      </section>

      <section class="card online-note rivals-note">
        <span class="online-dot live" aria-hidden="true" />
        <div>
          <strong>21 rivals, three difficulties.</strong>
          <span class="muted"> Blue, Silver, May, Barry, Hop, Nemona, Kieran, Taunie and more, with the teams from their toughest
            battles. On Champion, they read your moves and save their Mega or Tera for the right moment.</span>
        </div>
        <button class="btn" onClick={onRivals}>See the rivals</button>
      </section>

      <section class="card online-note">
        <span class="online-dot live" aria-hidden="true" />
        <div>
          <strong>Three ways to find a battle online.</strong>
          <span class="muted"> Quick Match pairs you with the next player who's looking. A private code is for a friend.
            And anyone in the lobby can be challenged directly. Online play works on the hosted site.</span>
        </div>
      </section>
    </div>
  );
}

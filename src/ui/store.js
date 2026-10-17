// Saved teams and settings live in this browser (localStorage). When the site
// moves to Firebase, signed-in players' teams will sync to their account.
import {sampleTeams} from '../engine/samples.js';

const TEAMS_KEY = 'champions-pvp.teams.v1';
const SETTINGS_KEY = 'champions-pvp.settings.v1';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadTeams() {
  const teams = read(TEAMS_KEY);
  if (Array.isArray(teams)) return teams;
  return sampleTeams();
}

export function saveTeams(teams) {
  return write(TEAMS_KEY, teams);
}

export const DEFAULT_SETTINGS = {
  names: ['Player 1', 'Player 2'],
  mode: 'singles',
  hideChoices: true,
  speed: 'normal',
};

export function loadSettings() {
  return {...DEFAULT_SETTINGS, ...(read(SETTINGS_KEY) || {})};
}

export function saveSettings(settings) {
  return write(SETTINGS_KEY, settings);
}

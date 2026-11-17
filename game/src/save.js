// Saving to this browser's localStorage: cash, story progress, where the
// player stands and what time it is in Solmaris. Nothing leaves the machine.
import { SAVE_KEY } from './config.js';

/** The small snapshot the pause menu and mission rewards write out. */
export function saveGame(state) {
  const data = {
    version: 1,
    cash: Math.floor(state.player.cash),
    health: Math.floor(state.player.health),
    missionIndex: state.missions.index,
    missionStep: state.missions.step,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    timeOfDay: state.timeOfDay,
    carsStolen: state.stats.carsStolen,
    missionsDone: state.stats.missionsDone,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** The saved snapshot, or null when there is none or it does not parse. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

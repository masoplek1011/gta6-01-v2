// The game itself: the state object, one fixed step that advances every
// system, and the save/load wiring. main.js runs the loop; shots.js stages
// scenes through the same step, so a screenshot is a real game mid-play.
import {
  AVENUES, DAY_LENGTH_SEC, HEAT_HIT_PED, HEAT_KILL_PED, HEAT_RAM_COP,
  HEAT_SHOOT, HEAT_STEAL_CAR, STREETS, VIEW_H, VIEW_W,
} from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { createPlayer, enterCar, exitCar, hurtPlayer, nearestEnterableCar, updatePlayerOnFoot } from './player.js';
import { driveCar, resolveCarCollisions, spawnParkedCars, updateParticles } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { addHeat, clearPolice, resolveCopShot, updateFootCops, updatePoliceCars, updatePoliceSpawns, updateWanted } from './police.js';
import { playerShoot, updateBullets, updateGuards } from './combat.js';
import { createMissions, updateMissions } from './missions.js';
import { drawHud } from './hud.js';
import { ACTION_INTERACT, ACTION_SAVE } from './input.js';
import { loadSave, saveGame } from './save.js';

/** A fresh Solmaris: the city, the people, the cars, and the player at Rico's. */
export function createGameState(seed) {
  const rng = makeRng(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    cityAvenues: AVENUES,
    cityStreets: STREETS,
    time: 0,
    timeOfDay: 10.0,
    player: createPlayer(city.landmarks.garage.x - 60, city.landmarks.garage.y + 90),
    cars: [],
    peds: [],
    cops: [],
    guards: [],
    bullets: [],
    particles: [],
    wanted: { heat: 0, stars: 0, lastCrime: 99 },
    missions: createMissions(),
    camera: { x: 0, y: 0 },
    stats: { carsStolen: 0, missionsDone: 0 },
    events: [],
    spawnTimer: 0,
    audio: createAudio(),
    hudDraw: drawHud,
    aim: { active: false, worldX: 0, worldY: 0, mouse: { x: 0, y: 0 } },
    view: { scale: 1, ox: 0, oy: 0 },
    over: null,
    savedFlash: 0,
  };
  spawnTraffic(state, rng);
  spawnPedestrians(state, rng);
  spawnParkedCars(state, rng, 10);
  centreCamera(state);
  return state;
}

/** The camera sits on the player, clamped so it never shows past the world edge. */
export function centreCamera(state) {
  const focus = state.player.inCar || state.player;
  const targetX = focus.x - VIEW_W / 2;
  const targetY = focus.y - VIEW_H / 2;
  state.camera.x = Math.max(0, Math.min(3200 - VIEW_W, targetX));
  state.camera.y = Math.max(0, Math.min(2400 - VIEW_H, targetY));
}

function easeCamera(state, dt) {
  const focus = state.player.inCar || state.player;
  const targetX = Math.max(0, Math.min(3200 - VIEW_W, focus.x - VIEW_W / 2));
  const targetY = Math.max(0, Math.min(2400 - VIEW_H, focus.y - VIEW_H / 2));
  const k = Math.min(1, dt * 5);
  state.camera.x += (targetX - state.camera.x) * k;
  state.camera.y += (targetY - state.camera.y) * k;
}

/** Where the mouse points in the world, for aiming the pistol. */
export function updateAim(state, input) {
  const mouse = input.mouse();
  state.aim.mouse = mouse;
  state.aim.worldX = state.camera.x + (mouse.x - state.view.ox) / state.view.scale;
  state.aim.worldY = state.camera.y + (mouse.y - state.view.oy) / state.view.scale;
}

/** Apply a saved snapshot onto a fresh state (Continue from the title screen). */
export function applySave(state, data) {
  state.player.cash = data.cash || 0;
  state.player.health = data.health || 100;
  state.missions.index = data.missionIndex || 0;
  state.missions.step = data.missionStep || 0;
  state.player.x = data.x || state.player.x;
  state.player.y = data.y || state.player.y;
  state.timeOfDay = data.timeOfDay || 10;
  state.stats.carsStolen = data.carsStolen || 0;
  state.stats.missionsDone = data.missionsDone || 0;
  clearPolice(state);
  centreCamera(state);
}

/** One fixed step: input, the player, the city, the police, the story. */
export function stepGame(state, input, dt, actions) {
  state.time += dt;
  state.timeOfDay = (state.timeOfDay + dt * (24 / DAY_LENGTH_SEC)) % 24;
  if (state.savedFlash > 0) state.savedFlash -= dt;

  const player = state.player;
  if (input) updateAim(state, input);

  if (actions & ACTION_INTERACT) {
    if (player.inCar) exitCar(state);
    else {
      const car = nearestEnterableCar(state);
      if (car) enterCar(state, car);
    }
  }
  if (actions & ACTION_SAVE) {
    if (saveGame(state)) state.savedFlash = 2;
  }

  if (input) {
    if (player.inCar) {
      const throttle = input.throttle() ? 1 : input.brake() ? -1 : 0;
      driveCar(state, player.inCar, throttle, input.steer(), dt);
      player.x = player.inCar.x;
      player.y = player.inCar.y;
      player.angle = player.inCar.angle;
    } else {
      updatePlayerOnFoot(state, input, dt);
      if (input.shooting()) playerShoot(state, input);
    }
  }

  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  updateWanted(state, dt);
  updatePoliceSpawns(state, dt);
  updatePoliceCars(state, dt);
  updateFootCops(state, dt);
  updateGuards(state, dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  resolveCarCollisions(state);
  updateMissions(state, dt);
  drainEvents(state);
  easeCamera(state, dt);

  // Sound follows the action: the engine, the sirens, the bass line.
  const audio = state.audio;
  const driving = player.inCar && !player.inCar.wrecked;
  audio.engine(driving ? Math.abs(player.inCar.speed) / 560 : 0, driving);
  audio.siren(state.wanted.stars > 0, dt);
  audio.music(dt);
}

/** The events the systems raised this step, handled here so they stay in one place. */
function drainEvents(state) {
  const events = state.events.splice(0);
  for (const event of events) {
    if (event.type === 'car-stolen') {
      addHeat(state, HEAT_STEAL_CAR, 'stole a car');
      state.missions.message = 'Stolen! The owner called it in — the police are looking.';
      state.missions.messageTime = 3;
    } else if (event.type === 'ped-down') {
      addHeat(state, event.cause === 'shot' ? HEAT_SHOOT + HEAT_KILL_PED : HEAT_HIT_PED, event.cause);
    } else if (event.type === 'cop-shot') {
      resolveCopShot(state, event);
    } else if (event.type === 'cop-down') {
      addHeat(state, 120, 'shot an officer');
    } else if (event.type === 'rammed-cop') {
      addHeat(state, HEAT_RAM_COP, 'rammed a patrol car');
    } else if (event.type === 'busted') {
      state.over = 'busted';
      state.audio.busted();
    } else if (event.type === 'wasted') {
      state.over = 'wasted';
    } else if (event.type === 'mission-complete') {
      saveGame(state);
    } else if (event.type === 'story-complete') {
      state.over = 'complete';
      saveGame(state);
    }
  }
}

/** The saved game, if this browser has one. */
export function readSave() {
  return loadSave();
}

export { hurtPlayer };

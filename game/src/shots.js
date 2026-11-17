// The screenshot scenes behind ?shot=chase|onfoot|mission|night. Each one
// builds a real game from a fixed seed, puts the player mid-action with the
// systems running (a chase, a walk, a job, a night drive), then plays it
// forward with a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { createGameState, stepGame } from './game.js';
import { addHeat } from './police.js';
import { enterCar } from './player.js';
import { spawnCar } from './vehicles.js';
import { SCREEN_PLAY } from './render.js';

/** A fake input that drives toward a point: throttle on, steer at the target. */
function drivingInput(state, target) {
  const player = state.player;
  const car = player.inCar;
  const focus = car || player;
  const desired = Math.atan2(target.y - focus.y, target.x - focus.x);
  let diff = desired - focus.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.5));
  return {
    moveVector: () => ({ x: 0, y: -1 }),
    steer: () => steer,
    throttle: () => true,
    brake: () => false,
    running: () => false,
    shooting: () => false,
    mouse: () => ({ x: 640, y: 360 }),
    takeActions: () => 0,
  };
}

/** A fake input that walks toward a point on foot. */
function walkingInput(state, target) {
  return {
    moveVector: () => {
      const player = state.player;
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      return { x: dx / dist, y: dy / dist };
    },
    steer: () => 0,
    throttle: () => false,
    brake: () => false,
    running: () => false,
    shooting: () => false,
    mouse: () => ({ x: 640, y: 360 }),
    takeActions: () => 0,
  };
}

/** Run the game forward `seconds` with the autopilot input. */
function playForward(state, input, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepGame(state, input, STEP, 0);
}

/** Put the player in a car of `kind` at (x, y) facing `angle`, already moving. */
function putPlayerInCar(state, kind, x, y, angle, speed) {
  const car = spawnCar(kind, x, y, angle, null);
  car.speed = speed;
  state.cars.push(car);
  enterCar(state, car);
  return car;
}

/** A few patrol cars behind the player, lights on, closing in. */
function addChasers(state, count, gap) {
  const player = state.player;
  const car = player.inCar;
  const backX = Math.cos(car.angle + Math.PI);
  const backY = Math.sin(car.angle + Math.PI);
  for (let i = 0; i < count; i += 1) {
    const cop = spawnCar('cop', car.x + backX * gap * (i + 1) + (i % 2 ? 30 : -30), car.y + backY * gap * (i + 1), car.angle, 'police');
    cop.speed = car.speed * 0.9;
    cop.cruiseSpeed = 460;
    cop.sirenOn = true;
    state.cars.push(cop);
  }
}

/**
 * Stage the named scene and return the screen to draw over it.
 * chase: a three-star chase down an avenue, job 2 mid-delivery.
 * onfoot: a morning walk past the plaza, job 1 waiting.
 * mission: the pickup at Marina Market, one star already earned.
 * night: a night drive along the south streets, one star, a patrol behind.
 */
export function stageShot(name, seed) {
  const state = createGameState(seed);
  state.audio = silentAudio(state.audio);
  const lm = state.city.landmarks;

  if (name === 'onfoot') {
    // A morning walk south down the avenue, traffic passing on the left.
    state.timeOfDay = 10.0;
    state.player.x = 1420;
    state.player.y = 1150;
    state.player.angle = Math.PI / 2;
    playForward(state, walkingInput(state, { x: 1420, y: 1650 }), 2.5);
    return { state, screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    // Rolling south down the avenue toward Marina Market, one star earned.
    state.timeOfDay = 16.5;
    state.missions.index = 1;
    state.missions.step = 0;
    putPlayerInCar(state, 'sedan', 2220, 800, Math.PI / 2, 300);
    addHeat(state, 45, 'staged');
    playForward(state, drivingInput(state, lm.market), 0.7);
    return { state, screen: SCREEN_PLAY };
  }

  if (name === 'night') {
    state.timeOfDay = 22.4;
    state.missions.index = 2;
    state.missions.step = 0;
    putPlayerInCar(state, 'sport', 1820, 1500, Math.PI / 2, 320);
    addHeat(state, 45, 'staged');
    addChasers(state, 1, 260);
    playForward(state, drivingInput(state, { x: 1820, y: 2050 }), 1.2);
    return { state, screen: SCREEN_PLAY };
  }

  // chase (the cover): job 2, package in hand, three stars, three patrol
  // cars on the tail, running straight south down the avenue through traffic.
  state.timeOfDay = 14.5;
  state.missions.index = 1;
  state.missions.step = 2;
  putPlayerInCar(state, 'sport', 1420, 900, Math.PI / 2, 380);
  addHeat(state, 210, 'staged');
  addChasers(state, 3, 160);
  playForward(state, drivingInput(state, { x: 1420, y: 2100 }), 1.8);
  return { state, screen: SCREEN_PLAY };
}

/** Swap the audio object for one that does nothing: screenshots stay silent. */
function silentAudio(real) {
  const quiet = {};
  for (const key of Object.keys(real)) quiet[key] = () => {};
  quiet.isMuted = () => true;
  return quiet;
}

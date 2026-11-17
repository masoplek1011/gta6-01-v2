// The player on foot: walking, running, facing the mouse, getting in and out
// of cars. Driving itself lives in vehicles.js; this file is the person.
import {
  CAR_LENGTH, PLAYER_MAX_HEALTH, PLAYER_RADIUS, PLAYER_RUN, PLAYER_WALK,
} from './config.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';

/** A fresh player standing at (x, y), unarmed trouble not yet started. */
export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER_MAX_HEALTH,
    cash: 0,
    inCar: null, // the car object when driving, null on foot
    speed: 0,
    fireCooldown: 0,
    hurtFlash: 0,
    bustProgress: 0,
  };
}

/**
 * Move the player on foot from the input vector, facing the mouse when the
 * pointer has moved, otherwise facing the walk direction.
 */
export function updatePlayerOnFoot(state, input, dt) {
  const player = state.player;
  const move = input.moveVector();
  const length = Math.hypot(move.x, move.y);
  const speed = input.running() ? PLAYER_RUN : PLAYER_WALK;
  if (length > 0) {
    const nx = move.x / length;
    const ny = move.y / length;
    player.x += nx * speed * dt;
    player.y += ny * speed * dt;
    player.speed = speed;
    // Face the mouse when aiming, else face where the feet are going.
    const aim = state.aim;
    if (aim.active) {
      player.angle = Math.atan2(aim.worldY - player.y, aim.worldX - player.x);
    } else {
      player.angle = Math.atan2(ny, nx);
    }
  } else {
    player.speed = 0;
  }
  resolveBuildingCollision(state.city, player, PLAYER_RADIUS);
  clampToWorld(player, 20);
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

/** The nearest car the player could steal, within reach and not wrecked. */
export function nearestEnterableCar(state) {
  const player = state.player;
  let best = null;
  let bestDist = 70;
  for (const car of state.cars) {
    if (car.wrecked || car.driver === 'police') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

/** Step into a car: the player rides in it and the car answers to the player. */
export function enterCar(state, car) {
  const player = state.player;
  // Any car that had another driver — parked, or cruising with one — counts
  // as stolen when the player takes it.
  const wasParked = car.driver !== 'player';
  car.driver = 'player';
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  if (wasParked) {
    state.stats.carsStolen += 1;
    state.events.push({ type: 'car-stolen', car });
  }
  state.audio.doorSlam();
}

/** Step out beside the car, back on foot. */
export function exitCar(state) {
  const player = state.player;
  const car = player.inCar;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  player.inCar = null;
  // Step out on the driver's side so the player never lands inside a wall.
  const sideX = car.x + Math.cos(car.angle + Math.PI / 2) * (CAR_LENGTH / 2 + 22);
  const sideY = car.y + Math.sin(car.angle + Math.PI / 2) * (CAR_LENGTH / 2 + 22);
  player.x = sideX;
  player.y = sideY;
  player.angle = car.angle;
  resolveBuildingCollision(state.city, player, PLAYER_RADIUS);
  clampToWorld(player, 20);
  state.audio.doorSlam();
}

/** Hurt the player; returns true when the damage killed them. */
export function hurtPlayer(state, amount) {
  const player = state.player;
  if (player.health <= 0) return true;
  player.health -= amount;
  player.hurtFlash = 0.25;
  state.audio.hit();
  if (player.health <= 0) {
    player.health = 0;
    return true;
  }
  return false;
}

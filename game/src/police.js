// The Solmaris Police Department: the wanted level, the patrol cars that
// chase the player, the officers on foot, and getting busted.
import {
  HEAT_DECAY_PER_SEC, WANTED_MAX, WANTED_THRESHOLDS,
} from './config.js';
import { clampToWorld, nearestRoadPoint, resolveBuildingCollision } from './city.js';
import { damageCar, driveCar, spawnCar } from './vehicles.js';

/** Stars from heat: each threshold crossed earns another star. */
export function starsFromHeat(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED_THRESHOLDS.length; i += 1) {
    if (heat >= WANTED_THRESHOLDS[i]) stars = i;
  }
  return Math.min(WANTED_MAX, stars);
}

/** Add heat for a crime, and remember it just happened so it does not fade yet. */
export function addHeat(state, amount, reason) {
  state.wanted.heat = Math.min(520, state.wanted.heat + amount);
  state.wanted.lastCrime = 0;
  state.wanted.stars = starsFromHeat(state.wanted.heat);
  state.events.push({ type: 'crime', reason, heat: state.wanted.heat });
}

/** Heat fades when the player has been clean for a while and no cop is close. */
export function updateWanted(state, dt) {
  const wanted = state.wanted;
  wanted.lastCrime += dt;
  const copNear = state.cars.some((car) => car.driver === 'police'
    && Math.hypot(car.x - state.player.x, car.y - state.player.y) < 500);
  if (wanted.lastCrime > 6 && !copNear && wanted.heat > 0) {
    wanted.heat = Math.max(0, wanted.heat - HEAT_DECAY_PER_SEC * dt);
    wanted.stars = starsFromHeat(wanted.heat);
  }
}

/** How many patrol cars the current wanted level calls for. */
function wantedCopCars(stars) {
  return [0, 2, 3, 4, 5, 6][stars] || 0;
}

/** Spawn patrol cars and foot officers until the streets hold what the stars demand. */
export function updatePoliceSpawns(state, dt) {
  const stars = state.wanted.stars;
  const player = state.player;
  const cops = state.cars.filter((car) => car.driver === 'police' && !car.wrecked);
  state.spawnTimer -= dt;
  if (cops.length < wantedCopCars(stars) && state.spawnTimer <= 0) {
    state.spawnTimer = 1.2;
    // Appear on a road a little way off, never on top of the player.
    let spot = null;
    for (let tries = 0; tries < 8; tries += 1) {
      const angle = state.rng.range(0, Math.PI * 2);
      const dist = state.rng.range(650, 900);
      const raw = { x: player.x + Math.cos(angle) * dist, y: player.y + Math.sin(angle) * dist };
      const point = nearestRoadPoint(raw.x, raw.y);
      if (Math.hypot(point.x - player.x, point.y - player.y) > 500) {
        spot = point;
        break;
      }
    }
    if (spot) {
      const car = spawnCar('cop', spot.x, spot.y, state.rng.range(0, Math.PI * 2), 'police');
      car.cruiseSpeed = 380 + stars * 30;
      car.sirenOn = true;
      state.cars.push(car);
      state.events.push({ type: 'cop-arrived', car });
    }
  }
  // Foot officers join the chase from two stars up.
  if (stars >= 2 && state.cops.length < stars - 1 && state.spawnTimer <= 0) {
    state.spawnTimer = 1.5;
    const angle = state.rng.range(0, Math.PI * 2);
    const x = player.x + Math.cos(angle) * 320;
    const y = player.y + Math.sin(angle) * 320;
    state.cops.push({
      x, y, angle, health: 50, speed: 205,
      shootCooldown: state.rng.range(0.5, 1.2),
    });
  }
}

/** Steer a patrol car at the player, ramming when it gets close. */
export function updatePoliceCars(state, dt) {
  const player = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    const targetX = player.inCar ? player.inCar.x : player.x;
    const targetY = player.inCar ? player.inCar.y : player.y;
    const desired = Math.atan2(targetY - car.y, targetX - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const dist = Math.hypot(targetX - car.x, targetY - car.y);
    const throttle = dist > 60 ? 1 : 0.4;
    driveCar(state, car, throttle, steer, dt);
    // A patrol car that touches the player's car rams it, grinding its health down.
    if (player.inCar && dist < 58) {
      damageCar(state, player.inCar, 4 * dt);
      car.speed *= 0.6;
      if (state.rng.chance(dt * 2)) {
        addHeat(state, 0, 'rammed a patrol car');
        state.events.push({ type: 'rammed-cop', car });
      }
    }
    // A patrol car that catches the player on foot starts the bust.
    if (!player.inCar && dist < 46) {
      player.bustProgress += dt / 1.2;
    }
    // Patrol cars shoot at the player from three stars up.
    if (state.wanted.stars >= 3 && dist < 420 && dist > 90) {
      car.shootCooldown = (car.shootCooldown || 0) - dt;
      if (car.shootCooldown <= 0) {
        car.shootCooldown = state.rng.range(0.9, 1.6);
        state.events.push({
          type: 'cop-shot', from: { x: car.x, y: car.y }, target: { x: targetX, y: targetY },
        });
      }
    }
    clampToWorld(car, 30);
  }
}

/** Officers on foot run the player down; caught on foot, the player is busted. */
export function updateFootCops(state, dt) {
  const player = state.player;
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    const cop = state.cops[i];
    if (cop.health <= 0) {
      state.cops.splice(i, 1);
      continue;
    }
    const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (dist > 1100) {
      state.cops.splice(i, 1);
      continue;
    }
    const angle = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = angle;
    if (dist > 26) {
      cop.x += Math.cos(angle) * cop.speed * dt;
      cop.y += Math.sin(angle) * cop.speed * dt;
    }
    resolveBuildingCollision(state.city, cop, 13);
    clampToWorld(cop, 16);
    if (!player.inCar && dist < 30) {
      player.bustProgress += dt / 0.9;
    }
    if (state.wanted.stars >= 3 && dist < 380 && dist > 60) {
      cop.shootCooldown -= dt;
      if (cop.shootCooldown <= 0) {
        cop.shootCooldown = state.rng.range(1.1, 1.9);
        state.events.push({
          type: 'cop-shot', from: { x: cop.x, y: cop.y }, target: { x: player.x, y: player.y },
        });
      }
    }
  }
  // The bust completes: the run ends, the player keeps half their cash.
  if (player.bustProgress >= 1) {
    player.bustProgress = 0;
    player.cash = Math.floor(player.cash / 2);
    state.events.push({ type: 'busted' });
  }
}

/** A cop's bullet: inaccurate, but it hurts when it lands. */
export function resolveCopShot(state, shot) {
  const player = state.player;
  const spread = state.rng.range(-0.22, 0.22);
  const angle = Math.atan2(shot.target.y - shot.from.y, shot.target.x - shot.from.x) + spread;
  const dist = Math.hypot(shot.target.x - shot.from.x, shot.target.y - shot.from.y);
  // The shot lands near the player: close enough counts as a hit.
  const landingX = shot.from.x + Math.cos(angle) * dist;
  const landingY = shot.from.y + Math.sin(angle) * dist;
  const miss = Math.hypot(landingX - shot.target.x, landingY - shot.target.y);
  state.bullets.push({
    x: shot.from.x, y: shot.from.y,
    vx: Math.cos(angle) * 700, vy: Math.sin(angle) * 700,
    life: dist / 700 + 0.1, friendly: false, damage: 7,
  });
  void miss;
  state.audio.enemyShot();
}

/** Clear every cop and drop the heat: what a new game, or a bribe, does. */
export function clearPolice(state) {
  state.cars = state.cars.filter((car) => car.driver !== 'police');
  state.cops = [];
  state.wanted.heat = 0;
  state.wanted.stars = 0;
}

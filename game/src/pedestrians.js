// Pedestrians: the people of Solmaris, strolling the sidewalks, crossing at
// corners, and running when a gun goes off or a car comes at them.
import { AVENUES, PED_COUNT, ROAD_W, STREETS, WORLD_H, WORLD_W } from './config.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';

const SHIRT_COLORS = ['#e8e8e8', '#f2a541', '#7fb069', '#e07a5f', '#81b29a', '#f4d35e', '#6d9dc5', '#c77dff'];
const SKIN_COLORS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/** Scatter walkers on the sidewalks across the city. */
export function spawnPedestrians(state, rng) {
  for (let i = 0; i < PED_COUNT; i += 1) {
    const ped = makePedestrian(state, rng);
    state.peds.push(ped);
  }
}

function makePedestrian(state, rng) {
  const onAvenue = rng.chance(0.5);
  let x;
  let y;
  if (onAvenue) {
    x = rng.pick(AVENUES) + (rng.chance(0.5) ? 1 : -1) * (ROAD_W / 2 + 16);
    y = rng.range(80, WORLD_H - 80);
  } else {
    x = rng.range(80, WORLD_W - 80);
    y = rng.pick(STREETS) + (rng.chance(0.5) ? 1 : -1) * (ROAD_W / 2 + 16);
  }
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(38, 62),
    shirt: rng.pick(SHIRT_COLORS),
    skin: rng.pick(SKIN_COLORS),
    walkPhase: rng.range(0, Math.PI * 2),
    state: 'walk', // 'walk' | 'flee' | 'dead'
    stateTime: 0,
    target: pickSidewalkTarget(state.rng),
    alive: true,
    fade: 0,
  };
}

/** A new sidewalk waypoint: a point beside a random road. */
function pickSidewalkTarget(rng) {
  if (rng.chance(0.5)) {
    return {
      x: rng.pick(AVENUES) + (rng.chance(0.5) ? 1 : -1) * (ROAD_W / 2 + 16),
      y: rng.range(80, WORLD_H - 80),
    };
  }
  return {
    x: rng.range(80, WORLD_W - 80),
    y: rng.pick(STREETS) + (rng.chance(0.5) ? 1 : -1) * (ROAD_W / 2 + 16),
  };
}

/** Scare every walker near (x, y): they run away from the noise. */
export function scarePedestrians(state, x, y, radius) {
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.stateTime = 0;
      ped.fleeFrom = { x, y };
    }
  }
}

/** Walk, flee, or lie still: advance every pedestrian one step. */
export function updatePedestrians(state, dt) {
  const player = state.player;
  const playerCar = player.inCar;
  for (const ped of state.peds) {
    if (!ped.alive) {
      ped.fade += dt;
      continue;
    }
    ped.stateTime += dt;
    if (ped.state === 'dead') continue;
    // A car barrelling at a walker scares them off the road.
    if (playerCar && Math.abs(playerCar.speed) > 120) {
      const d = Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y);
      if (d < 90) {
        ped.state = 'flee';
        ped.stateTime = 0;
        ped.fleeFrom = { x: playerCar.x, y: playerCar.y };
      }
    }
    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
      ped.walkPhase += dt * 14;
      if (ped.stateTime > 2.5) {
        ped.state = 'walk';
        ped.target = pickSidewalkTarget(state.rng);
      }
    } else {
      const dx = ped.target.x - ped.x;
      const dy = ped.target.y - ped.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 24) {
        ped.target = pickSidewalkTarget(state.rng);
      } else {
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        ped.walkPhase += dt * 8;
      }
    }
    resolveBuildingCollision(state.city, ped, 12);
    clampToWorld(ped, 16);
    // A fast car that touches a walker knocks them down, hard.
    if (playerCar && Math.abs(playerCar.speed) > 60) {
      const d = Math.hypot(ped.x - playerCar.x, ped.y - playerCar.y);
      if (d < 30) {
        killPedestrian(state, ped, 'hit by a car');
      }
    }
  }
  // The dead fade away after a while; the living are topped back up.
  state.peds = state.peds.filter((ped) => ped.alive || ped.fade < 12);
  const alive = state.peds.filter((ped) => ped.alive).length;
  for (let i = alive; i < PED_COUNT; i += 1) {
    const ped = makePedestrian(state, state.rng);
    // New walkers arrive away from the player so they never pop into view.
    if (Math.hypot(ped.x - player.x, ped.y - player.y) < 700) {
      ped.x = (ped.x + 1600) % WORLD_W;
      ped.y = (ped.y + 1200) % WORLD_H;
    }
    state.peds.push(ped);
  }
}

/** A walker goes down: bloodless, but the city notices. */
export function killPedestrian(state, ped, cause) {
  if (!ped.alive) return;
  ped.alive = false;
  ped.state = 'dead';
  ped.fade = 0;
  state.events.push({ type: 'ped-down', ped, cause });
  for (let i = 0; i < 8; i += 1) {
    state.particles.push({
      x: ped.x, y: ped.y,
      vx: state.rng.range(-70, 70), vy: state.rng.range(-70, 70),
      life: 0.4, maxLife: 0.4, size: 3, color: '#e5534b',
    });
  }
}

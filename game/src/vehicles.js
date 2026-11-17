// Cars: their kinds and colours, how they drive, how they crash into
// buildings and each other, and what happens when one is wrecked.
import {
  CAR_ACCEL, CAR_BRAKE, CAR_LENGTH, CAR_MAX_HEALTH, CAR_REVERSE_SPEED,
  CAR_TOP_SPEED, CAR_WIDTH,
} from './config.js';
import { clampToWorld, resolveBuildingCollision } from './city.js';

export const CAR_KINDS = {
  sedan: { color: '#c94f4f', topSpeed: 480, label: 'Sedan' },
  taxi: { color: '#f2c94c', topSpeed: 460, label: 'Taxi' },
  sport: { color: '#4f8ef7', topSpeed: 580, label: 'Sport' },
  van: { color: '#8a8f98', topSpeed: 400, label: 'Van' },
  cop: { color: '#2b3a55', topSpeed: 540, label: 'Patrol' },
  truck: { color: '#7a5a3a', topSpeed: 380, label: 'Truck' },
};

let nextCarId = 1;

/** A car at (x, y) facing `angle`, owned by nobody until a driver takes it. */
export function spawnCar(kind, x, y, angle, driver) {
  const spec = CAR_KINDS[kind] || CAR_KINDS.sedan;
  return {
    id: nextCarId++,
    kind,
    color: spec.color,
    topSpeed: spec.topSpeed,
    label: spec.label,
    x, y, angle,
    speed: 0,
    health: CAR_MAX_HEALTH,
    driver: driver || null, // 'player' | 'traffic' | 'police' | 'parked' | null
    wrecked: false,
    smoke: 0,
    siren: kind === 'cop',
    honkCooldown: 0,
  };
}

/** Park a few cars in the city's lots and along the roads, ready to be stolen. */
export function spawnParkedCars(state, rng, count) {
  const kinds = ['sedan', 'taxi', 'sport', 'van', 'sedan', 'truck'];
  for (let i = 0; i < count; i += 1) {
    const lot = rng.pick(state.city.lots);
    const x = rng.range(lot.x + 30, lot.x + lot.w - 30);
    const y = rng.range(lot.y + 30, lot.y + lot.h - 30);
    const car = spawnCar(rng.pick(kinds), x, y, rng.range(0, Math.PI * 2), 'parked');
    state.cars.push(car);
  }
}

/**
 * Drive a car from raw controls: throttle -1..1 (reverse to forward) and
 * steer -1..1. Speed falls off-road, steering bites harder at low speed.
 */
export function driveCar(state, car, throttle, steer, dt) {
  if (car.wrecked) return;
  const accel = throttle > 0 ? CAR_ACCEL : CAR_BRAKE;
  car.speed += throttle * accel * dt;
  if (throttle === 0) {
    const drag = 260 * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  const top = car.topSpeed || CAR_TOP_SPEED;
  if (car.speed > top) car.speed = top;
  if (car.speed < -CAR_REVERSE_SPEED) car.speed = -CAR_REVERSE_SPEED;
  // Steering only works while rolling, and reverses when backing up.
  const grip = Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.angle += steer * 2.4 * grip * dt * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const hitWall = resolveBuildingCollision(state.city, car, CAR_LENGTH / 2 - 4);
  if (hitWall && Math.abs(car.speed) > 140) {
    damageCar(state, car, Math.abs(car.speed) * 0.06);
    car.speed *= -0.25;
    state.events.push({ type: 'crash', car, hard: true });
  } else if (hitWall) {
    car.speed *= 0.4;
  }
  clampToWorld(car, 30);
  if (car.health < 40) car.smoke += dt;
}

/** Push two cars apart when they overlap, and trade a little damage on a hard hit. */
export function resolveCarCollisions(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.wrecked) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = CAR_LENGTH * 0.62;
      if (dist >= minDist || dist < 0.01) continue;
      const push = (minDist - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 260) {
        damageCar(state, a, impact * 0.02);
        damageCar(state, b, impact * 0.02);
        if ((a.driver === 'player' || b.driver === 'player')) {
          state.events.push({ type: 'crash', car: a.driver === 'player' ? a : b, hard: impact > 320 });
        }
        const slower = Math.abs(a.speed) < Math.abs(b.speed) ? a : b;
        slower.speed *= 0.5;
      }
    }
  }
}

/** Damage a car; at zero health it wrecks and throws the driver out in a blast. */
export function damageCar(state, car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health > 0) return;
  car.health = 0;
  car.wrecked = true;
  car.speed = 0;
  state.audio.explosion();
  spawnExplosion(state, car.x, car.y);
  if (car.driver === 'player') {
    const player = state.player;
    player.inCar = null;
    player.x = car.x + 60;
    player.y = car.y;
    hurtPlayerByBlast(state);
  }
  car.driver = null;
  state.events.push({ type: 'car-wrecked', car });
}

function hurtPlayerByBlast(state) {
  const player = state.player;
  player.health = Math.max(1, player.health - 25);
  player.hurtFlash = 0.4;
}

/** A burst of fire and smoke particles at (x, y). */
export function spawnExplosion(state, x, y) {
  for (let i = 0; i < 26; i += 1) {
    const angle = (i / 26) * Math.PI * 2;
    const speed = 60 + (i % 5) * 55;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + (i % 4) * 0.15,
      maxLife: 0.9,
      size: 5 + (i % 4) * 3,
      color: i % 3 === 0 ? '#f2c94c' : i % 3 === 1 ? '#e5534b' : '#5a5a5a',
    });
  }
}

/** Tick particles: drift, fade, and drop the dead ones. */
export function updateParticles(state, dt) {
  const parts = state.particles;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = parts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}

export { CAR_LENGTH, CAR_WIDTH };

// Combat: the player's pistol, the bullets it fires, what they hit, and the
// dock guards who shoot back during the harbor mission.
import { BULLET_DAMAGE, BULLET_SPEED, FIRE_COOLDOWN } from './config.js';
import { damageCar } from './vehicles.js';
import { hurtPlayer } from './player.js';
import { killPedestrian, scarePedestrians } from './pedestrians.js';

/** Fire one pistol round from (x, y) along `angle`. */
export function fireBullet(state, x, y, angle, friendly) {
  state.bullets.push({
    x: x + Math.cos(angle) * 22,
    y: y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: 1.1,
    friendly,
    damage: BULLET_DAMAGE,
  });
  // A muzzle flash and a little smoke.
  state.particles.push({
    x: x + Math.cos(angle) * 26, y: y + Math.sin(angle) * 26,
    vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40,
    life: 0.08, maxLife: 0.08, size: 9, color: '#ffd76a',
  });
  if (friendly) {
    state.audio.shot();
    scarePedestrians(state, x, y, 320);
  }
}

/** The player pulls the trigger: cooldown, aim and one new bullet. */
export function playerShoot(state, input) {
  const player = state.player;
  if (player.inCar || player.fireCooldown > 0 || player.health <= 0) return;
  player.fireCooldown = FIRE_COOLDOWN;
  const aim = state.aim;
  const angle = aim.active
    ? Math.atan2(aim.worldY - player.y, aim.worldX - player.x)
    : player.angle;
  player.angle = angle;
  fireBullet(state, player.x, player.y, angle, true);
}

/** Move every bullet and resolve what it hits: people, guards, cops and cars. */
export function updateBullets(state, dt) {
  const player = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0;
    if (!dead && bullet.friendly) {
      dead = hitFriendlies(state, bullet);
    } else if (!dead && !bullet.friendly) {
      // An enemy round only ever threatens the player.
      if (!player.inCar && Math.hypot(bullet.x - player.x, bullet.y - player.y) < 15) {
        if (hurtPlayer(state, bullet.damage)) state.events.push({ type: 'wasted' });
        dead = true;
      } else if (player.inCar && Math.hypot(bullet.x - player.inCar.x, bullet.y - player.inCar.y) < 26) {
        damageCar(state, player.inCar, bullet.damage * 0.5);
        dead = true;
      }
    }
    // Bullets stop at buildings.
    if (!dead) {
      for (const b of state.city.buildings) {
        if (bullet.x > b.x && bullet.x < b.x + b.w && bullet.y > b.y && bullet.y < b.y + b.h) {
          dead = true;
          spark(state, bullet.x, bullet.y);
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

function hitFriendlies(state, bullet) {
  // Guards first: they are the mission's targets.
  for (const guard of state.guards) {
    if (guard.health <= 0) continue;
    if (Math.hypot(bullet.x - guard.x, bullet.y - guard.y) < 16) {
      guard.health -= bullet.damage;
      spark(state, bullet.x, bullet.y);
      if (guard.health <= 0) state.events.push({ type: 'guard-down', guard });
      return true;
    }
  }
  // Foot cops can be shot too, at a price in heat.
  for (const cop of state.cops) {
    if (Math.hypot(bullet.x - cop.x, bullet.y - cop.y) < 15) {
      cop.health -= bullet.damage;
      spark(state, bullet.x, bullet.y);
      if (cop.health <= 0) state.events.push({ type: 'cop-down', cop });
      return true;
    }
  }
  // Pedestrians: hitting one is a crime, killing one a bigger one.
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    if (Math.hypot(bullet.x - ped.x, bullet.y - ped.y) < 14) {
      killPedestrian(state, ped, 'shot');
      return true;
    }
  }
  // Cars take body damage from rounds.
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const dx = bullet.x - car.x;
    const dy = bullet.y - car.y;
    const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
    const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along < 30 && across < 18) {
      damageCar(state, car, bullet.damage * 0.6);
      spark(state, bullet.x, bullet.y);
      return true;
    }
  }
  return false;
}

function spark(state, x, y) {
  for (let i = 0; i < 4; i += 1) {
    state.particles.push({
      x, y,
      vx: state.rng.range(-90, 90), vy: state.rng.range(-90, 90),
      life: 0.18, maxLife: 0.18, size: 2, color: '#ffd76a',
    });
  }
}

/** Dock guards for the harbor mission: armed men who hold the pier. */
export function spawnGuards(state, count) {
  const harbor = state.city.landmarks.harbor;
  for (let i = 0; i < count; i += 1) {
    state.guards.push({
      x: harbor.x - 160 + i * 90 + state.rng.range(-20, 20),
      y: harbor.y - 90 + state.rng.range(-40, 40),
      angle: Math.PI,
      health: 60,
      shootCooldown: state.rng.range(0.6, 1.4),
    });
  }
}

/** Guards hold their ground and shoot at the player when they see them. */
export function updateGuards(state, dt) {
  const player = state.player;
  for (const guard of state.guards) {
    if (guard.health <= 0) continue;
    const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (dist > 560) continue;
    guard.angle = Math.atan2(player.y - guard.y, player.x - guard.x);
    guard.shootCooldown -= dt;
    if (guard.shootCooldown <= 0 && dist < 460) {
      guard.shootCooldown = state.rng.range(1.0, 1.7);
      const spread = state.rng.range(-0.14, 0.14);
      const angle = guard.angle + spread;
      state.bullets.push({
        x: guard.x + Math.cos(angle) * 22,
        y: guard.y + Math.sin(angle) * 22,
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        life: 1.0, friendly: false, damage: 8,
      });
      state.audio.enemyShot();
    }
  }
}

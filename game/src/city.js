// The city of Solmaris: a road grid, the blocks between the roads, the
// buildings, parks and parking lots inside them, and the named places the
// story visits. Everything is laid out from a seeded generator, so the same
// seed always builds the same city.
import { AVENUES, ROAD_W, STREETS, WORLD_H, WORLD_W } from './config.js';

const BUILDING_COLORS = ['#c98f5f', '#b7a99a', '#8fa3b8', '#d9c08a', '#a8b89a', '#c77b6b', '#9a8fb5', '#7fa3a0'];
const ROOF_COLORS = ['#6b5a4a', '#54504a', '#4a5a66', '#7a6a55'];
const PARK_GREENS = ['#5d8a4a', '#6f9a55', '#4f7d43'];

// Named places the missions point at. Each sits beside a road so a car can reach it.
export const LANDMARKS = {
  garage: { x: 1420, y: 700, label: "Rico's Garage", color: '#f2c94c' },
  market: { x: 2220, y: 1100, label: 'Marina Market', color: '#f2c94c' },
  motel: { x: 620, y: 1900, label: 'Sunset Motel', color: '#f2c94c' },
  harbor: { x: 2620, y: 2280, label: 'Pier 9 Harbor', color: '#f2c94c' },
  safehouse: { x: 1020, y: 1900, label: 'Casa Verde Safehouse', color: '#7ee787' },
  plaza: { x: 1620, y: 1220, label: 'Solmaris Plaza', color: '#8ab4f8' },
  tower: { x: 1820, y: 420, label: 'Solmaris Tower', color: '#8ab4f8' },
  beach: { x: 400, y: 2280, label: 'South Beach', color: '#8ab4f8' },
};

/** True when the point is on asphalt (inside a road's width). */
export function isOnRoad(x, y) {
  for (const avenue of AVENUES) {
    if (Math.abs(x - avenue) <= ROAD_W / 2 && y >= 0 && y <= WORLD_H) return true;
  }
  for (const street of STREETS) {
    if (Math.abs(y - street) <= ROAD_W / 2 && x >= 0 && x <= WORLD_W) return true;
  }
  return false;
}

/** The nearest point on any road centre line, for snapping spawns onto streets. */
export function nearestRoadPoint(x, y) {
  let bestX = x;
  let bestY = y;
  let best = Infinity;
  for (const avenue of AVENUES) {
    const d = Math.abs(x - avenue);
    if (d < best) {
      best = d;
      bestX = avenue;
      bestY = y;
    }
  }
  for (const street of STREETS) {
    const d = Math.abs(y - street);
    if (d < best) {
      best = d;
      bestX = x;
      bestY = street;
    }
  }
  return { x: bestX, y: bestY };
}

/** A random point on a random road, for spawning traffic and parked cars. */
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(AVENUES), y: rng.range(60, WORLD_H - 60), axis: 'v' };
  }
  return { x: rng.range(60, WORLD_W - 60), y: rng.pick(STREETS), axis: 'h' };
}

/** Build the whole city from the seed: buildings, parks, trees and parking lots. */
export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const lots = [];

  const avenueEdges = [0, ...AVENUES, WORLD_W];
  const streetEdges = [0, ...STREETS, WORLD_H];

  for (let col = 0; col < avenueEdges.length - 1; col += 1) {
    for (let row = 0; row < streetEdges.length - 1; row += 1) {
      const left = avenueEdges[col] + ROAD_W / 2 + 14;
      const right = avenueEdges[col + 1] - ROAD_W / 2 - 14;
      const top = streetEdges[row] + ROAD_W / 2 + 14;
      const bottom = streetEdges[row + 1] - ROAD_W / 2 - 14;
      const width = right - left;
      const height = bottom - top;
      if (width < 60 || height < 60) continue;
      // The southern strip is the harbor and beach, not blocks.
      if (top > WORLD_H - 260) continue;
      const roll = rng.next();
      if (roll < 0.16) {
        parks.push({ x: left, y: top, w: width, h: height, green: rng.pick(PARK_GREENS) });
        const count = Math.floor((width * height) / 9000);
        for (let t = 0; t < count; t += 1) {
          trees.push({ x: rng.range(left + 16, right - 16), y: rng.range(top + 16, bottom - 16), r: rng.range(9, 15) });
        }
        continue;
      }
      if (roll < 0.26) {
        lots.push({ x: left, y: top, w: width, h: height });
        continue;
      }
      // A block of buildings: one big one, or a row of two to four smaller ones.
      const tall = rng.chance(0.22);
      if (tall) {
        buildings.push(makeBuilding(rng, left + 8, top + 8, width - 16, height - 16, true));
      } else {
        const across = width > height ? 2 : 1;
        const down = height > width ? 2 : 1;
        const cellW = width / across;
        const cellH = height / down;
        for (let a = 0; a < across; a += 1) {
          for (let b = 0; b < down; b += 1) {
            if (rng.chance(0.15)) continue;
            buildings.push(makeBuilding(
              rng,
              left + a * cellW + 6,
              top + b * cellH + 6,
              cellW - 12,
              cellH - 12,
              false,
            ));
          }
        }
      }
    }
  }

  // The tower landmark gets a tall building of its own, drawn over the block.
  buildings.push({
    x: 1640, y: 280, w: 120, h: 200, color: '#8fa3b8', roof: '#3a4552',
    tall: true, height: 3, label: 'Solmaris Tower',
  });
  buildings.push({
    x: 1260, y: 690, w: 90, h: 60, color: '#c98f5f', roof: '#6b5a4a',
    tall: false, height: 1, label: "Rico's Garage",
  });

  return { buildings, parks, trees, lots, landmarks: LANDMARKS };
}

function makeBuilding(rng, x, y, w, h, tall) {
  return {
    x, y, w, h,
    color: rng.pick(BUILDING_COLORS),
    roof: rng.pick(ROOF_COLORS),
    tall,
    height: tall ? rng.int(2, 3) : 1,
    label: null,
  };
}

/**
 * Push a circle (x, y, radius) out of every building it overlaps. Returns true
 * when a push happened. Used for the player on foot, cars and pedestrians.
 */
export function resolveBuildingCollision(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nearX = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nearX;
    const dy = body.y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    hit = true;
    if (distSq > 0.01) {
      const dist = Math.sqrt(distSq);
      body.x = nearX + (dx / dist) * radius;
      body.y = nearY + (dy / dist) * radius;
    } else {
      // Dead centre inside the building: push out along the shallowest side.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const up = body.y - b.y;
      const down = b.y + b.h - body.y;
      const min = Math.min(left, right, up, down);
      if (min === left) body.x = b.x - radius;
      else if (min === right) body.x = b.x + b.w + radius;
      else if (min === up) body.y = b.y - radius;
      else body.y = b.y + b.h + radius;
    }
  }
  return hit;
}

/** Keep a point inside the world, with a margin. */
export function clampToWorld(body, margin) {
  body.x = Math.max(margin, Math.min(WORLD_W - margin, body.x));
  body.y = Math.max(margin, Math.min(WORLD_H - margin, body.y));
}

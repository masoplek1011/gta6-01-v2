// Traffic: civilian cars that cruise the road grid, turn at intersections,
// slow for the car ahead and keep the streets feeling alive.
import { AVENUES, LANE_OFFSET, ROAD_W, STREETS, TRAFFIC_COUNT, WORLD_H, WORLD_W } from './config.js';
import { randomRoadPoint } from './city.js';
import { driveCar, spawnCar } from './vehicles.js';

const TRAFFIC_KINDS = ['sedan', 'taxi', 'van', 'sedan', 'truck', 'sport'];

/** Fill the streets with cruising cars, spread over the whole city. */
export function spawnTraffic(state, rng) {
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const point = randomRoadPoint(rng);
    const car = spawnCar(rng.pick(TRAFFIC_KINDS), point.x, point.y, 0, 'traffic');
    placeOnRoad(car, point, rng);
    car.cruiseSpeed = rng.range(120, 185);
    car.turnChance = 0.3;
    state.cars.push(car);
  }
}

/** Put a traffic car on its road, in the right-hand lane, facing its direction. */
function placeOnRoad(car, point, rng) {
  car.axis = point.axis;
  car.direction = rng.chance(0.5) ? 1 : -1;
  if (point.axis === 'v') {
    car.x = point.x + LANE_OFFSET * car.direction;
    car.angle = car.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.road = point.x;
  } else {
    car.y = point.y + LANE_OFFSET * car.direction;
    car.angle = car.direction > 0 ? 0 : Math.PI;
    car.road = point.y;
  }
  car.speed = car.cruiseSpeed || 150;
}

/** The nearest road centre line the car is about to cross, if any. */
function crossingAhead(car) {
  if (car.axis === 'v') {
    for (const street of STREETS) {
      const d = street - car.y;
      if (car.direction > 0 && d > 0 && d < 90) return { coord: street, axis: 'h' };
      if (car.direction < 0 && d < 0 && d > -90) return { coord: street, axis: 'h' };
    }
  } else {
    for (const avenue of AVENUES) {
      const d = avenue - car.x;
      if (car.direction > 0 && d > 0 && d < 90) return { coord: avenue, axis: 'v' };
      if (car.direction < 0 && d < 0 && d > -90) return { coord: avenue, axis: 'v' };
    }
  }
  return null;
}

/** Keep traffic moving: cruise, turn at intersections, brake for the car ahead. */
export function updateTraffic(state, dt) {
  const player = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    // A car far from the player is recycled to a road near them, so the
    // streets around the player are never empty.
    const distToPlayer = Math.hypot(car.x - player.x, car.y - player.y);
    if (distToPlayer > 1600) {
      const point = randomRoadPoint(state.rng);
      placeOnRoad(car, point, state.rng);
      car.x = Math.max(60, Math.min(WORLD_W - 60, car.x));
      car.y = Math.max(60, Math.min(WORLD_H - 60, car.y));
      continue;
    }
    // Brake when something is right ahead in the same lane.
    let blocked = false;
    const aheadX = car.x + Math.cos(car.angle) * 70;
    const aheadY = car.y + Math.sin(car.angle) * 70;
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      if (Math.hypot(other.x - aheadX, other.y - aheadY) < 42) {
        blocked = true;
        break;
      }
    }
    const peds = state.peds;
    for (let i = 0; i < peds.length && !blocked; i += 1) {
      const ped = peds[i];
      if (!ped.alive) continue;
      if (Math.hypot(ped.x - aheadX, ped.y - aheadY) < 34) blocked = true;
    }
    const target = blocked ? 0 : car.cruiseSpeed;
    const throttle = target > car.speed ? 0.6 : -0.8;
    driveCar(state, car, throttle, 0, dt);
    // A blocked car stops instead of creeping into the car ahead.
    if (blocked) car.speed = Math.max(0, car.speed - 420 * dt);
    else car.speed = Math.min(car.speed, target + 40);

    // At an intersection, sometimes turn onto the crossing road.
    const cross = crossingAhead(car);
    if (cross && state.rng.chance(car.turnChance * dt * 8)) {
      const wasV = car.axis === 'v';
      car.axis = cross.axis;
      car.road = cross.coord;
      car.direction = state.rng.chance(0.5) ? 1 : -1;
      if (wasV) {
        car.y = cross.coord + LANE_OFFSET * car.direction;
        car.angle = car.direction > 0 ? 0 : Math.PI;
      } else {
        car.x = cross.coord + LANE_OFFSET * car.direction;
        car.angle = car.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    // Nudge back onto the lane centre so cars do not drift off the road.
    if (car.axis === 'v') {
      const laneX = car.road + LANE_OFFSET * car.direction;
      car.x += (laneX - car.x) * Math.min(1, dt * 2);
    } else {
      const laneY = car.road + LANE_OFFSET * car.direction;
      car.y += (laneY - car.y) * Math.min(1, dt * 2);
    }
    void ROAD_W;
  }
}

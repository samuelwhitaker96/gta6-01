// Traffic cars that follow the road grid and pedestrians who walk the sidewalks. Traffic
// keeps to its lane, slows for the car ahead, and turns at intersections; pedestrians stroll,
// scatter when a car or a gunshot comes close, and wave down taxis when they want a ride.
import { ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { nearestRoadX, nearestRoadY } from './world.js';

const TRAFFIC_SPEED = 150;
const LANE = 22;

/** Keep every traffic car rolling along its road, turning at intersections. */
export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    // Slow down for the car directly ahead.
    let ahead = Infinity;
    for (const other of G.cars) {
      if (other === car || other.kind === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 130 && side < 40) ahead = Math.min(ahead, along);
    }
    const target = ahead < 130 ? 40 : TRAFFIC_SPEED + (car.speed % 40);
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    const onX = Math.abs(car.x - nearestRoadX(car.x)) < 6;
    const onY = Math.abs(car.y - nearestRoadY(car.y)) < 6;
    if (onX && onY && G.random() < dt * 0.35) {
      const horizontal = Math.abs(Math.sin(car.angle)) < 0.5;
      if (horizontal) {
        car.angle = G.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.x = nearestRoadX(car.x) + (car.angle > 0 ? LANE : -LANE);
      } else {
        car.angle = G.random() < 0.5 ? 0 : Math.PI;
        car.y = nearestRoadY(car.y) + (car.angle === 0 ? LANE : -LANE);
      }
    }
    // Off the edge of the city: turn around and come back.
    if (car.x < 80 || car.x > WORLD.width - 80 || car.y < 80 || car.y > WORLD.height - 160) {
      car.angle += Math.PI;
      car.x = Math.max(100, Math.min(WORLD.width - 100, car.x));
      car.y = Math.max(100, Math.min(WORLD.height - 200, car.y));
    }
    if (car.honk > 0) car.honk -= dt;
  }
}

/** Walk every pedestrian along a sidewalk; the scared ones run away from danger. */
export function updatePedestrians(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (!ped.walking) continue;
    if (ped.down > 0) {
      ped.down -= dt;
      if (ped.down <= 0) { ped.scared = 2; }
      continue;
    }
    if (ped.scared > 0) ped.scared -= dt;
    // A nearby speeding car, a gunshot, or the player sprinting scares them off.
    let threat = null;
    const pd = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (pd < 120 && !p.onFoot) threat = { x: p.x, y: p.y };
    if (pd < 90 && p.onFoot && ped.scared <= 0 && G.crimeFlash > 0) threat = { x: p.x, y: p.y };
    if (!threat) {
      for (const car of G.cars) {
        if (car.kind === 'traffic' && Math.abs(car.speed) > 100 && Math.hypot(car.x - ped.x, car.y - ped.y) < 130) {
          threat = { x: car.x, y: car.y };
          break;
        }
      }
    }
    const speed = ped.scared > 0 || threat ? 170 : ped.speed;
    if (threat) {
      ped.angle = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.scared = Math.max(ped.scared, 1.5);
    }
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    // Stay on the sidewalks: drift back toward the nearest road edge.
    const rx = nearestRoadX(ped.x);
    const ry = nearestRoadY(ped.y);
    const onRoadX = Math.abs(ped.x - rx) < ROAD_WIDTH / 2 + 70;
    const onRoadY = Math.abs(ped.y - ry) < ROAD_WIDTH / 2 + 70;
    if (!onRoadX && !onRoadY) {
      ped.angle = Math.atan2(ry - ped.y, rx - ped.x);
    }
    // At an intersection, sometimes turn a corner.
    if (Math.abs(ped.x - rx) < 8 && Math.abs(ped.y - ry) < 8 && G.random() < dt * 0.3) {
      ped.angle = G.random() * Math.PI * 2;
    }
    ped.x = Math.max(40, Math.min(WORLD.width - 40, ped.x));
    ped.y = Math.max(40, Math.min(WORLD.height - 120, ped.y));
  }
}

/** A pedestrian near the player raises a hand for a taxi (T to accept). */
export function spawnTaxiFare(G) {
  if (G.taxi || G.fares.length > 0) return;
  const candidates = G.peds.filter((ped) => ped.walking && ped.down <= 0 && Math.hypot(ped.x - G.player.x, ped.y - G.player.y) < 700);
  if (candidates.length === 0) return;
  const ped = candidates[Math.floor(G.random() * candidates.length)];
  ped.fare = true;
  const dest = {
    x: ROADS_X[Math.floor(G.random() * ROADS_X.length)],
    y: ROADS_Y[Math.floor(G.random() * ROADS_Y.length)],
  };
  G.fares.push({ ped, dest, timer: 120 });
}

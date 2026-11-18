// The city of Solmarina and the shared game state. This file builds the road grid, the
// buildings, the park and the beach, owns the whole state object, and holds the geometry and
// mechanics every other system shares: road tests, building collision, bullets, particles,
// wanted level and pickups. It draws nothing and knows nothing about screens or keys.
import {
  BEACH_TOP, CAR_COLORS, CAR_NAMES, CASH_BAG_COUNT, DISTRICTS, MISSIONS,
  PARK, PLAYER, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD,
} from './config.js';
import { createRandom, pickRandom, rangeRandom } from './random.js';

export const EVENT_MISSION_DONE = 1;
export const EVENT_MISSION_FAIL = 2;
export const EVENT_GAME_OVER = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WIN = 16;
export const EVENT_CRIME = 32;

/** True when the point sits on a road (within half the road width of a road centre line). */
export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_WIDTH / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_WIDTH / 2) return true;
  return false;
}

/** The nearest road centre line on one axis, for snapping traffic and pedestrians to lanes. */
export function nearestRoadX(x) {
  let best = ROADS_X[0];
  for (const rx of ROADS_X) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
export function nearestRoadY(y) {
  let best = ROADS_Y[0];
  for (const ry of ROADS_Y) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

/** Which district a point belongs to, for the ground tint and the location name. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[0];
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function buildCity(random) {
  const buildings = [];
  const trees = [];
  const palette = ['#c98f5f', '#b57a4e', '#d9a066', '#a9713f', '#c4b49a', '#9fb3c8', '#b8c4b0'];
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const bx = ROADS_X[ix] + ROAD_WIDTH / 2 + 14;
      const by = ROADS_Y[iy] + ROAD_WIDTH / 2 + 14;
      const bw = ROADS_X[ix + 1] - ROADS_X[ix] - ROAD_WIDTH - 28;
      const bh = ROADS_Y[iy + 1] - ROADS_Y[iy] - ROAD_WIDTH - 28;
      // The park block stays green; the beach strip stays sand.
      if (bx < PARK.x + PARK.w && bx + bw > PARK.x && by < PARK.y + PARK.h && by + bh > PARK.y) {
        for (let t = 0; t < 26; t += 1) {
          trees.push({ x: PARK.x + 30 + random() * (PARK.w - 60), y: PARK.y + 30 + random() * (PARK.h - 60), r: 10 + random() * 9 });
        }
        continue;
      }
      if (by + bh > BEACH_TOP - 40) continue;
      const downtown = bx > 800 && bx < 2000;
      const count = downtown ? 4 : 2 + Math.floor(random() * 2);
      for (let b = 0; b < count; b += 1) {
        const w = downtown ? 70 + random() * 60 : 90 + random() * 90;
        const h = downtown ? 70 + random() * 60 : 80 + random() * 80;
        const x = bx + random() * Math.max(1, bw - w);
        const y = by + random() * Math.max(1, bh - h);
        buildings.push({
          x, y, w, h, color: pickRandom(random, palette),
          tall: downtown && random() < 0.55, windows: 2 + Math.floor(random() * 3),
        });
      }
    }
  }
  return { buildings, trees };
}

function makeCar(random, x, y, angle, kind, color) {
  return {
    x, y, angle, speed: 0, kind, color: color || pickRandom(random, CAR_COLORS),
    name: pickRandom(random, CAR_NAMES), occupied: kind === 'traffic',
    driver: null, health: 100, brakeLight: false, honk: 0,
  };
}

/** A free parking spot on the road itself, for parked cars the player can steal. */
function parkedSpot(random) {
  const horizontal = random() < 0.5;
  if (horizontal) {
    return { x: rangeRandom(random, 300, WORLD.width - 300), y: pickRandom(random, ROADS_Y) + (random() < 0.5 ? -30 : 30), angle: random() < 0.5 ? 0 : Math.PI };
  }
  return { x: pickRandom(random, ROADS_X) + (random() < 0.5 ? -30 : 30), y: rangeRandom(random, 300, WORLD.height - 500), angle: random() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
}

export function createGame(seed) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const state = {
    seed, random, time: 0, paused: false,
    city,
    player: {
      x: 600, y: 660, angle: -Math.PI / 2, health: PLAYER.health, money: 0,
      wanted: 0, ammo: PLAYER.startAmmo, weapon: 'pistol', onFoot: true, car: null,
      invulnerable: 0, punchCooldown: 0, shootCooldown: 0, lastHurt: -99,
      bustedTimer: 0, dead: false, busted: false, carsStolen: 0, pedsHit: 0,
    },
    cars: [], peds: [], cops: [], bullets: [], effects: [], enemies: [],
    pickups: [], fares: [], taxi: null,
    mission: { index: 0, stage: 0, timer: 0, text: '', target: null, passenger: false, done: false },
    stats: { missionsDone: 0, earned: 0, arrests: 0 },
    wantedTimer: 0, crimeFlash: 0, message: '', messageTimer: 0,
    banner: '', bannerTimer: 0, shake: 0, won: false, over: false,
  };
  resetGame(state);
  return state;
}

/** Put the player, cars, pedestrians and pickups back at their starting places. */
export function resetGame(G) {
  const random = G.random;
  const p = G.player;
  p.x = 600; p.y = 660; p.angle = -Math.PI / 2; p.health = PLAYER.health;
  p.money = 0; p.wanted = 0; p.ammo = PLAYER.startAmmo; p.onFoot = true; p.car = null;
  p.invulnerable = 0; p.dead = false; p.busted = false; p.bustedTimer = 0;
  p.carsStolen = 0; p.pedsHit = 0;
  G.cars.length = 0; G.peds.length = 0; G.cops.length = 0;
  G.bullets.length = 0; G.effects.length = 0; G.enemies.length = 0;
  G.pickups.length = 0; G.fares.length = 0; G.taxi = null;
  G.time = 0; G.wantedTimer = 0; G.message = ''; G.banner = ''; G.won = false; G.over = false;
  // Parked cars near the start, so the first thing the player can do is steal one.
  for (let i = 0; i < 10; i += 1) {
    const spot = parkedSpot(random);
    const car = makeCar(random, spot.x, spot.y, spot.angle, 'parked');
    G.cars.push(car);
  }
  const starter = makeCar(random, 700, 600, 0, 'parked', '#e67e22');
  starter.name = 'Solmarina Coupe';
  G.cars.push(starter);
  // Traffic cars rolling on the roads.
  for (let i = 0; i < 14; i += 1) {
    const horizontal = random() < 0.5;
    const car = horizontal
      ? makeCar(random, rangeRandom(random, 100, WORLD.width - 100), pickRandom(random, ROADS_Y) + (random() < 0.5 ? -22 : 22), random() < 0.5 ? 0 : Math.PI, 'traffic')
      : makeCar(random, pickRandom(random, ROADS_X) + (random() < 0.5 ? -22 : 22), rangeRandom(random, 100, WORLD.height - 300), random() < 0.5 ? Math.PI / 2 : -Math.PI / 2, 'traffic');
    car.speed = rangeRandom(random, 120, 210);
    G.cars.push(car);
  }
  // Pedestrians on the sidewalks.
  for (let i = 0; i < 26; i += 1) {
    const horizontal = random() < 0.5;
    G.peds.push({
      x: horizontal ? rangeRandom(random, 100, WORLD.width - 100) : pickRandom(random, ROADS_X) + (random() < 0.5 ? -58 : 58),
      y: horizontal ? pickRandom(random, ROADS_Y) + (random() < 0.5 ? -58 : 58) : rangeRandom(random, 100, WORLD.height - 300),
      angle: horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: rangeRandom(random, 45, 80), color: pickRandom(random, CAR_COLORS),
      walking: true, scared: 0, down: 0, fare: false,
    });
  }
  // Cash bags hidden around the city, and three ammo crates.
  const bagSpots = [[1500, 250], [250, 1500], [2900, 700], [700, 2100], [2100, 1900], [2700, 2100], [250, 250], [1900, 1100]];
  for (const [x, y] of bagSpots) G.pickups.push({ x, y, kind: 'cash', taken: false });
  for (const [x, y] of [[620, 700], [2600, 1500], [1500, 1900]]) G.pickups.push({ x, y, kind: 'ammo', taken: false });
  startMission(G, 0);
}

/** Begin mission `index` (0-based) at its first stage and point the player at the target. */
export function startMission(G, index) {
  const def = MISSIONS[index];
  const m = G.mission;
  m.index = index; m.stage = 0; m.done = false; m.passenger = false;
  m.timer = def.timeLimit;
  if (index === 0) {
    m.text = 'Get a car, then reach the pickup at Marina Bay';
    m.target = { x: 1500, y: 2200, label: 'Pickup — Marina Bay' };
  } else if (index === 1) {
    m.text = 'Collect the package at Portside docks';
    m.target = { x: 2900, y: 300, label: 'Package — Portside' };
  } else {
    m.text = 'Reach the harbor and face the Coral Crew';
    m.target = { x: 2900, y: 1500, label: 'Harbor — Coral Crew' };
  }
  showBanner(G, `Mission ${def.id}: ${def.title}`, def.intro);
}

/** Raise the wanted level, capped at 5, and restart the decay clock. */
export function addWanted(G, amount, reason) {
  const p = G.player;
  const before = p.wanted;
  p.wanted = Math.min(5, p.wanted + amount);
  G.wantedTimer = 0;
  if (p.wanted > before) {
    G.crimeFlash = 1;
    showMessage(G, reason || 'The police are on to you!');
  }
}

export function showMessage(G, text) {
  G.message = text;
  G.messageTimer = 3.5;
}

export function showBanner(G, title, subtitle) {
  G.banner = subtitle ? `${title} — ${subtitle}` : title;
  G.bannerTimer = 5;
}

/** True when the point is inside a building, the park pond, or the sea. */
export function blockedAt(G, x, y, radius) {
  if (y > BEACH_TOP + 60) return true; // the sea
  if (x < radius || y < radius || x > WORLD.width - radius || y > WORLD.height - radius) return true;
  for (const b of G.city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
  }
  return false;
}

/** Push a circle out of buildings; returns true when it was pushed. */
export function resolveBuildingCollision(G, obj, radius) {
  let pushed = false;
  for (const b of G.city.buildings) {
    if (obj.x + radius > b.x && obj.x - radius < b.x + b.w && obj.y + radius > b.y && obj.y - radius < b.y + b.h) {
      const left = obj.x + radius - b.x;
      const right = b.x + b.w - (obj.x - radius);
      const top = obj.y + radius - b.y;
      const bottom = b.y + b.h - (obj.y - radius);
      const min = Math.min(left, right, top, bottom);
      if (min === left) obj.x = b.x - radius;
      else if (min === right) obj.x = b.x + b.w + radius;
      else if (min === top) obj.y = b.y - radius;
      else obj.y = b.y + b.h + radius;
      pushed = true;
    }
  }
  return pushed;
}

/** Fire a pistol bullet from (x, y) along angle; returns the bullet. */
export function fireBullet(G, x, y, angle, fromPlayer, damage) {
  const bullet = { x, y, vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed, life: 1.1, fromPlayer, damage };
  G.bullets.push(bullet);
  spawnSparks(G, x, y, '#ffe14d', 4);
  return bullet;
}

/** A short-lived burst of particles (sparks, dust, blood-free impact puffs). */
export function spawnSparks(G, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = G.random() * Math.PI * 2;
    const s = 60 + G.random() * 160;
    G.effects.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + G.random() * 0.3, max: 0.6, color, size: 2 + G.random() * 3 });
  }
}

export function spawnSmoke(G, x, y) {
  G.effects.push({ x, y, vx: 0, vy: -30, life: 0.9, max: 0.9, color: '#888888', size: 9 });
}

/** Hurt the player; returns true when it kills them. */
export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.invulnerable > 0 || p.dead) return false;
  p.health -= amount;
  p.invulnerable = 0.35;
  p.lastHurt = G.time;
  G.shake = Math.min(10, G.shake + 4);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    return true;
  }
  return false;
}

/** The nearest car to a point, within maxDist, or null. */
export function nearestCar(G, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** The nearest police unit (car or foot cop) to a point, for the wanted decay check. */
export function nearestPoliceDistance(G, x, y) {
  let best = Infinity;
  for (const car of G.cars) if (car.kind === 'police') best = Math.min(best, Math.hypot(car.x - x, car.y - y));
  for (const cop of G.cops) best = Math.min(best, Math.hypot(cop.x - x, cop.y - y));
  return best;
}

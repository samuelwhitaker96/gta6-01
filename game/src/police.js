// The Solmarina police: patrol cars that chase, ram and shoot, and foot cops who chase the
// player down and arrest him. Their numbers grow with the wanted level, and they give up —
// letting the wanted level decay — once the player stays out of sight and out of trouble.
import { MAX_WANTED, PLAYER, ROADS_X, ROADS_Y, WORLD } from './config.js';
import { addWanted, blockedAt, hurtPlayer, nearestPoliceDistance, spawnSparks } from './world.js';
import { explodeCar } from './player.js';

const POLICE_TOP_SPEED = 560;
const COP_SPEED = 265;
const ARREST_RANGE = 34;

/** How many police cars the wanted level calls for. */
export function wantedPoliceCount(wanted) {
  return Math.min(MAX_WANTED, wanted);
}

/** Spawn police cars and foot cops to match the wanted level, and update the chase. */
export function updatePolice(G, dt) {
  const p = G.player;
  // Wanted decay: stay clean and unseen for a while and a star drops off.
  if (p.wanted > 0) {
    G.wantedTimer += dt;
    const nearest = nearestPoliceDistance(G, p.x, p.y);
    if (G.wantedTimer > 14 && nearest > 520) {
      p.wanted -= 1;
      G.wantedTimer = 0;
      if (p.wanted === 0) {
        // The heat is off: the remaining units drive away.
        for (const car of G.cars) if (car.kind === 'police') car.kind = 'traffic';
        G.cops.length = 0;
      }
    }
  }
  const wantCars = wantedPoliceCount(p.wanted);
  const haveCars = G.cars.filter((c) => c.kind === 'police').length;
  for (let i = haveCars; i < wantCars; i += 1) spawnPoliceCar(G);
  const wantCops = p.onFoot && p.wanted >= 2 ? Math.min(3, p.wanted - 1) : 0;
  for (let i = G.cops.length; i < wantCops; i += 1) spawnFootCop(G);
  if (p.wanted === 0) return;

  for (const car of G.cars) {
    if (car.kind !== 'police') continue;
    chaseCar(G, car, dt);
  }
  for (const cop of G.cops) chaseCop(G, cop, dt);
}

/** A patrol car appears on a road a little way from the player, siren on. */
function spawnPoliceCar(G) {
  const p = G.player;
  const angle = G.random() * Math.PI * 2;
  const dist = 650 + G.random() * 350;
  let x = p.x + Math.cos(angle) * dist;
  let y = p.y + Math.sin(angle) * dist;
  x = Math.max(120, Math.min(WORLD.width - 120, x));
  y = Math.max(120, Math.min(WORLD.height - 200, y));
  // Snap onto the nearest road so the chase starts on tarmac.
  const rx = ROADS_X.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const ry = ROADS_Y.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  if (Math.abs(x - rx) < Math.abs(y - ry)) x = rx + 22;
  else y = ry + 22;
  const car = {
    x, y, angle: Math.atan2(p.y - y, p.x - x), speed: 200, kind: 'police',
    color: '#1a3a8f', name: 'Interceptor', occupied: true, driver: 'police',
    health: 120, brakeLight: false, honk: 0, ramCooldown: 0,
  };
  G.cars.push(car);
}

/** A foot cop appears on the sidewalk near the player. */
function spawnFootCop(G) {
  const p = G.player;
  const angle = G.random() * Math.PI * 2;
  const cop = {
    x: p.x + Math.cos(angle) * 320, y: p.y + Math.sin(angle) * 320,
    angle: 0, health: 40, arrest: 0, shootCooldown: 1 + G.random(),
  };
  G.cops.push(cop);
}

/** Steer a patrol car at the player and ram them; a wrecked patrol car is done. */
function chaseCar(G, car, dt) {
  const p = G.player;
  const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  car.speed += ((POLICE_TOP_SPEED - car.speed) * Math.min(1, dt * 0.8));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (blockedAt(G, nx, ny, 26)) {
    // A building is in the way: turn aside and slow down instead of driving through it.
    car.angle += 0.9 * dt * 4;
    car.speed *= 0.5;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.height - 140, car.y));
  const d = Math.hypot(p.x - car.x, p.y - car.y);
  if (car.ramCooldown > 0) car.ramCooldown -= dt;
  if (d < 58 && car.ramCooldown <= 0) {
    // Ram: shove the player's car and hurt the player (at most once a second).
    car.ramCooldown = 0.9;
    if (p.car) {
      p.car.speed *= 0.6;
      p.car.health -= 3;
      if (p.car.health <= 0) explodeCar(G, p.car);
    }
    hurtPlayer(G, 5);
    car.speed *= 0.4;
    car.health -= 4;
    spawnSparks(G, car.x, car.y, '#ffd24d', 6);
    G.shake = Math.min(10, G.shake + 4);
    if (car.health <= 0) {
      const idx = G.cars.indexOf(car);
      if (idx !== -1) G.cars.splice(idx, 1);
      spawnSparks(G, car.x, car.y, '#ff7b2f', 20);
      addWanted(G, 1, 'You wrecked a patrol car!');
    }
  }
}

/** A foot cop runs the player down; held close for a second, the player is busted. */
function chaseCop(G, cop, dt) {
  const p = G.player;
  const d = Math.hypot(p.x - cop.x, p.y - cop.y);
  if (p.onFoot && !p.dead) {
    cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.x += Math.cos(cop.angle) * COP_SPEED * dt;
    cop.y += Math.sin(cop.angle) * COP_SPEED * dt;
    if (d < ARREST_RANGE) {
      cop.arrest += dt;
      if (cop.arrest > 1.1) {
        p.busted = true;
        G.stats.arrests += 1;
      }
    } else {
      cop.arrest = Math.max(0, cop.arrest - dt);
    }
    // At high wanted levels the cops open fire.
    if (p.wanted >= 4 && d < 420 && d > 60) {
      cop.shootCooldown -= dt;
      if (cop.shootCooldown <= 0) {
        cop.shootCooldown = 1.4 + G.random() * 0.8;
        const a = Math.atan2(p.y - cop.y, p.x - cop.x) + (G.random() - 0.5) * 0.25;
        G.bullets.push({ x: cop.x, y: cop.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 1.0, fromPlayer: false, damage: 8 });
        spawnSparks(G, cop.x, cop.y, '#ffe14d', 3);
      }
    }
  }
}

/** Bullets fly, hit buildings, cars, cops, rivals and the player. Returns true on a kill. */
export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
    if (!dead) {
      for (const bd of G.city.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { dead = true; break; }
      }
    }
    if (!dead && b.fromPlayer) {
      for (const cop of G.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 18) {
          cop.health -= b.damage;
          spawnSparks(G, b.x, b.y, '#ff5a4e', 6);
          if (cop.health <= 0) {
            const idx = G.cops.indexOf(cop);
            if (idx !== -1) G.cops.splice(idx, 1);
            addWanted(G, 1, 'You shot a police officer!');
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.fromPlayer) {
      for (const e of G.enemies) {
        if (e.health > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 20) {
          e.health -= b.damage;
          spawnSparks(G, b.x, b.y, '#ff5a4e', 6);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.fromPlayer) {
      for (const car of G.cars) {
        if (car.kind === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 34) {
          car.health -= b.damage;
          spawnSparks(G, b.x, b.y, '#ffd24d', 5);
          dead = true;
          break;
        }
      }
    }
    if (!dead && !b.fromPlayer) {
      const p = G.player;
      const px = p.onFoot ? p.x : p.car ? p.car.x : p.x;
      const py = p.onFoot ? p.y : p.car ? p.car.y : p.y;
      if (Math.hypot(px - b.x, py - b.y) < (p.onFoot ? 16 : 34)) {
        hurtPlayer(G, b.damage);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

// Marco Solis on foot and behind the wheel: walking and running, getting in and out of cars,
// stealing them, driving with acceleration, braking and steering, punching and shooting.
// The camera and the HUD read the player's position and speed from here.
import { CAR, PLAYER, WORLD } from './config.js';
import {
  addWanted, blockedAt, fireBullet, hurtPlayer, nearestCar, nearestPoliceDistance,
  resolveBuildingCollision, showMessage, spawnSmoke, spawnSparks,
} from './world.js';

/** The closest car the player could get into, or null. */
export function carInReach(G) {
  return nearestCar(G, G.player.x, G.player.y, 70);
}

/** Step the player on foot: WASD movement, building collision, punching and shooting. */
export function updatePlayerOnFoot(G, input, dt, aimAngle) {
  const p = G.player;
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const mx = input.moveX();
  const my = input.moveY();
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    if (!blockedAt(G, nx, p.y, PLAYER.radius)) p.x = nx;
    if (!blockedAt(G, p.x, ny, PLAYER.radius)) p.y = ny;
    p.angle = Math.atan2(my, mx);
  }
  resolveBuildingCollision(G, p, PLAYER.radius);
  p.x = Math.max(PLAYER.radius, Math.min(WORLD.width - PLAYER.radius, p.x));
  p.y = Math.max(PLAYER.radius, Math.min(WORLD.height - PLAYER.radius, p.y));
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  // Regenerate a little health once the heat is off and nobody has hurt him lately.
  if (p.wanted === 0 && G.time - p.lastHurt > 8 && p.health > 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + 2 * dt);
  }
  // Peds who walk into a sprinting player get knocked down — and the law notices.
  for (const ped of G.peds) {
    if (ped.down > 0 || !ped.walking) continue;
    if (Math.hypot(ped.x - p.x, ped.y - p.y) < 26 && (mx !== 0 || my !== 0) && input.running()) {
      ped.down = 2.5;
      ped.scared = 4;
      p.pedsHit += 1;
      addWanted(G, 1, 'You knocked a pedestrian down!');
      spawnSparks(G, ped.x, ped.y, '#ffffff', 5);
    }
  }
  // Walking over a pickup collects it.
  collectPickups(G);
  return aimAngle;
}

/** Punch whatever hostile is closest in front of the player. */
export function playerPunch(G) {
  const p = G.player;
  if (p.punchCooldown > 0 || !p.onFoot) return false;
  p.punchCooldown = PLAYER.punchCooldown;
  const targets = [];
  for (const e of G.enemies) if (e.health > 0) targets.push({ x: e.x, y: e.y, kind: 'enemy', ref: e });
  for (const c of G.cops) targets.push({ x: c.x, y: c.y, kind: 'cop', ref: c });
  let best = null;
  let bestD = PLAYER.punchRange;
  for (const t of targets) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  if (!best) return false;
  if (best.kind === 'enemy') {
    best.ref.health -= PLAYER.punchDamage;
    spawnSparks(G, best.x, best.y, '#ffd24d', 6);
    if (best.ref.health <= 0) showMessage(G, 'Rival down!');
  } else {
    best.ref.health -= PLAYER.punchDamage;
    addWanted(G, 1, 'You hit a police officer!');
    spawnSparks(G, best.x, best.y, '#ffd24d', 6);
  }
  return true;
}

/** Fire the pistol toward the mouse aim; returns true when a shot went off. */
export function playerShoot(G, aimAngle) {
  const p = G.player;
  if (p.shootCooldown > 0 || p.ammo <= 0 || !p.onFoot) return false;
  p.shootCooldown = PLAYER.shootCooldown;
  p.ammo -= 1;
  const bx = p.x + Math.cos(aimAngle) * 20;
  const by = p.y + Math.sin(aimAngle) * 20;
  fireBullet(G, bx, by, aimAngle, true, PLAYER.pistolDamage);
  if (p.wanted < 1) addWanted(G, 1, 'Shots fired — police alerted!');
  G.shake = Math.min(8, G.shake + 2);
  return true;
}

/** Get into the nearest car (stealing it), or get out of the car being driven. */
export function toggleEnterCar(G) {
  const p = G.player;
  if (!p.onFoot) {
    // Get out beside the car.
    const car = p.car;
    car.speed = 0;
    car.kind = 'parked';
    car.occupied = false;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    if (blockedAt(G, p.x, p.y, PLAYER.radius)) {
      p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 44;
      p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 44;
    }
    return 'out';
  }
  const car = carInReach(G);
  if (!car) return null;
  const wasOccupied = car.kind === 'traffic';
  const wasParked = car.kind === 'parked';
  car.kind = 'player';
  car.occupied = true;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (wasOccupied) {
    p.carsStolen += 1;
    addWanted(G, 1, `You stole a ${car.name}!`);
    showMessage(G, `Stole the ${car.name} — the owner called it in!`);
  } else if (wasParked) {
    p.carsStolen += 1;
    // A parked car only draws heat when a cop sees it happen.
    if (nearestPoliceDistance(G, p.x, p.y) < 450) addWanted(G, 1, 'A cop saw you steal that car!');
    else showMessage(G, `Took the ${car.name}.`);
  }
  return 'in';
}

/** Drive the player's car: throttle, steering that bites harder at speed, drag and crashes. */
export function updatePlayerDriving(G, input, dt) {
  const p = G.player;
  const car = p.car;
  if (!car) { p.onFoot = true; return; }
  const throttle = input.throttle();
  const steer = input.steer();
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) {
    car.speed -= (car.speed > 20 ? CAR.brake : CAR.reverse) * dt;
    if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  const grip = CAR.grip * Math.min(1, Math.abs(car.speed) / 160 + 0.25);
  car.angle += steer * grip * (car.speed / CAR.maxSpeed) * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (car.crashCooldown > 0) car.crashCooldown -= dt;
  if (blockedAt(G, nx, ny, 26)) {
    // Slide along the wall when only one axis is blocked; a dead-on crash bounces
    // and only hurts the car when it hits hard, and at most twice a second.
    if (!blockedAt(G, nx, car.y, 26)) {
      car.x = nx;
      car.speed *= 0.92;
    } else if (!blockedAt(G, car.x, ny, 26)) {
      car.y = ny;
      car.speed *= 0.92;
    } else {
      if (Math.abs(car.speed) > 120 && (car.crashCooldown || 0) <= 0) {
        car.health -= Math.min(10, Math.abs(car.speed) * 0.015);
        car.crashCooldown = 0.5;
        G.shake = Math.min(10, G.shake + 3);
        spawnSparks(G, nx, ny, '#ffb347', 5);
        if (car.health <= 0) explodeCar(G, car);
      }
      car.speed *= -0.25;
    }
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  car.brakeLight = throttle < 0;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  // Running over a pedestrian is a crime, and it slows the car.
  for (const ped of G.peds) {
    if (ped.down > 0 || !ped.walking) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 60) {
      ped.down = 3;
      ped.scared = 5;
      p.pedsHit += 1;
      car.speed *= 0.55;
      addWanted(G, 1, 'You hit a pedestrian!');
      spawnSparks(G, ped.x, ped.y, '#ffffff', 6);
    }
  }
  collectPickups(G);
}

/** A wrecked car bursts into smoke and dumps the player out on foot. */
export function explodeCar(G, car) {
  spawnSparks(G, car.x, car.y, '#ff7b2f', 24);
  spawnSmoke(G, car.x, car.y);
  G.shake = 12;
  const idx = G.cars.indexOf(car);
  if (idx !== -1) G.cars.splice(idx, 1);
  const p = G.player;
  if (p.car === car) {
    p.car = null;
    p.onFoot = true;
    p.x = car.x + 50;
    p.y = car.y + 50;
    hurtPlayer(G, 25);
    showMessage(G, 'Your car is wrecked!');
  }
}

/** Pick up cash bags and ammo crates the player walks or drives over. */
export function collectPickups(G) {
  const p = G.player;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 40) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        p.money += 100;
        G.stats.earned += 100;
        showMessage(G, 'Found a cash stash: +$100');
      } else {
        p.ammo += 24;
        showMessage(G, 'Ammo crate: +24 rounds');
      }
      spawnSparks(G, pk.x, pk.y, '#f2c94c', 8);
    }
  }
}

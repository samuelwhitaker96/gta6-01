// The story: three missions for Marco Solis, plus the taxi side work. Each mission moves
// through stages with a target marker and a timer; finishing one pays out, starts the next,
// and saves progress. The final mission ends with a win screen.
import { MISSIONS, TAXI_FARE_MAX, TAXI_FARE_MIN } from './config.js';
import {
  addWanted, fireBullet, showBanner, showMessage, spawnSparks, startMission,
} from './world.js';

const PICKUP_RANGE = 70;
const ENEMY_COUNT = 4;

/** Advance the current mission: arrivals, timers, passenger pickups and the final showdown. */
export function updateMissions(G, dt) {
  const m = G.mission;
  const p = G.player;
  if (m.done || G.won || p.dead || p.busted) return;
  const def = MISSIONS[m.index];
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(G, 'Out of time!');
      return;
    }
  }
  const target = m.target;
  const d = target ? Math.hypot(target.x - p.x, target.y - p.y) : Infinity;

  if (m.index === 0) {
    if (m.stage === 0 && d < PICKUP_RANGE) {
      m.stage = 1;
      m.text = 'Cousin aboard — drive him to the Old Town safehouse';
      m.target = { x: 300, y: 1500, label: 'Safehouse — Old Town' };
      m.timer = def.timeLimit;
      m.passenger = true;
      showMessage(G, 'Cousin: "Drive, Marco — they are watching the Marina!"');
      p.ammo = Math.max(p.ammo, 12);
    } else if (m.stage === 1 && d < PICKUP_RANGE) {
      completeMission(G);
    }
  } else if (m.index === 1) {
    if (m.stage === 0 && d < PICKUP_RANGE) {
      m.stage = 1;
      m.text = 'Package secured — deliver it to the North Hills drop';
      m.target = { x: 2500, y: 1300, label: 'Drop — North Hills' };
      m.timer = def.timeLimit;
      addWanted(G, 2, 'The harbour police spotted the handoff!');
      showMessage(G, 'Package in hand. The police are on you — lose them or outrun them.');
    } else if (m.stage === 1 && d < PICKUP_RANGE) {
      completeMission(G);
    }
  } else if (m.index === 2) {
    if (m.stage === 0 && d < PICKUP_RANGE) {
      m.stage = 1;
      m.text = 'Take down the four Coral Crew enforcers';
      m.target = null;
      spawnRivals(G);
      showMessage(G, 'Rosa: "Four of them. Make it count, Marco."');
    } else if (m.stage === 1) {
      updateRivals(G, dt);
      const alive = G.enemies.filter((e) => e.health > 0).length;
      m.text = `Take down the Coral Crew — ${alive} left`;
      if (alive === 0) {
        m.stage = 2;
        m.text = 'Crew down — escape to the safehouse in Old Town';
        m.target = { x: 300, y: 1500, label: 'Safehouse — Old Town' };
        addWanted(G, 2, 'The crew called the police before they went down!');
      }
    } else if (m.stage === 2 && d < PICKUP_RANGE) {
      completeMission(G);
      G.won = true;
    }
  }
  updateTaxi(G, dt);
}

/** The four rival enforcers appear around the harbor and shoot at the player. */
function spawnRivals(G) {
  const spots = [[2820, 1420], [2960, 1580], [2760, 1620], [2900, 1380]];
  for (const [x, y] of spots) {
    G.enemies.push({ x, y, angle: 0, health: 60, shootCooldown: 1 + G.random() * 1.5, speed: 120 });
  }
}

function updateRivals(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.health <= 0) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (d > 260) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (d < 140) {
      e.x -= Math.cos(e.angle) * e.speed * 0.5 * dt;
      e.y -= Math.sin(e.angle) * e.speed * 0.5 * dt;
    }
    if (d < 480 && p.health > 0) {
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0) {
        e.shootCooldown = 1.1 + G.random() * 0.9;
        const a = e.angle + (G.random() - 0.5) * 0.2;
        fireBullet(G, e.x, e.y, a, false, 7);
      }
    }
  }
}

/** Pay out, save, and start the next mission (or the win screen after the last). */
export function completeMission(G) {
  const def = MISSIONS[G.mission.index];
  const p = G.player;
  p.money += def.reward;
  G.stats.earned += def.reward;
  G.stats.missionsDone += 1;
  p.ammo += 12;
  G.mission.done = true;
  showBanner(G, 'Mission complete', `+$${def.reward} — ${def.title}`);
  spawnSparks(G, p.x, p.y, '#f2c94c', 16);
  saveProgress(G);
  if (G.mission.index + 1 < MISSIONS.length) {
    startMission(G, G.mission.index + 1);
  }
}

/** The mission failed: restart it from its first stage, with the player kept alive. */
export function failMission(G, reason) {
  const def = MISSIONS[G.mission.index];
  G.mission.done = false;
  showBanner(G, 'Mission failed', `${reason} — ${def.title} restarts`);
  const p = G.player;
  p.health = Math.max(p.health, 50);
  if (p.wanted > 2) p.wanted = 2;
  startMission(G, G.mission.index);
}

/** Taxi side work: accept a fare with T, drive the passenger to the green marker, get paid. */
export function updateTaxi(G, dt) {
  const p = G.player;
  if (G.taxi) {
    const t = G.taxi;
    t.timer -= dt;
    if (t.timer <= 0) {
      showMessage(G, 'The passenger gave up waiting — fare lost.');
      t.ped.fare = false;
      G.taxi = null;
      return;
    }
    const d = Math.hypot(t.dest.x - p.x, t.dest.y - p.y);
    if (d < 80) {
      const pay = t.pay;
      p.money += pay;
      G.stats.earned += pay;
      showMessage(G, `Fare complete: +$${pay}`);
      spawnSparks(G, p.x, p.y, '#2ecc71', 10);
      t.ped.fare = false;
      G.taxi = null;
      saveProgress(G);
    }
    return;
  }
  for (const fare of G.fares) {
    fare.timer -= dt;
    if (fare.timer <= 0) {
      fare.ped.fare = false;
      G.fares.splice(G.fares.indexOf(fare), 1);
    }
  }
}

/** Accept the nearest waiting fare (only while driving). Returns true when one starts. */
export function acceptTaxiFare(G) {
  const p = G.player;
  if (!p.car || G.taxi) return false;
  for (const fare of G.fares) {
    if (Math.hypot(fare.ped.x - p.x, fare.ped.y - p.y) < 160) {
      const pay = TAXI_FARE_MIN + Math.floor(G.random() * (TAXI_FARE_MAX - TAXI_FARE_MIN));
      G.taxi = { ped: fare.ped, dest: fare.dest, pay, timer: 150 };
      G.fares.splice(G.fares.indexOf(fare), 1);
      fare.ped.fare = false;
      showMessage(G, `Fare accepted — take them to the green marker ($${pay})`);
      return true;
    }
  }
  return false;
}

/** Save money, mission progress and health to this browser's local storage. */
export function saveProgress(G) {
  try {
    window.localStorage.setItem('solmarina.save.v1', JSON.stringify({
      money: G.player.money, mission: G.mission.index, health: G.player.health,
      earned: G.stats.earned, missionsDone: G.stats.missionsDone,
    }));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

/** Load a saved game, if one exists; returns the save object or null. */
export function loadProgress() {
  try {
    const raw = window.localStorage.getItem('solmarina.save.v1');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Apply a loaded save to a fresh game state. */
export function applySave(G, save) {
  G.player.money = save.money || 0;
  G.stats.earned = save.earned || 0;
  G.stats.missionsDone = save.missionsDone || 0;
  if (save.mission > 0 && save.mission < MISSIONS.length) startMission(G, save.mission);
}

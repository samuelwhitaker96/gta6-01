// The screenshot scenes behind ?shot=start|foot|mission|chase. Each one plays the real game
// forward from a fresh world for a fixed number of steps, steered by a small autopilot that
// follows waypoints along the roads, so the frame is what real play looks like and the same
// seed always gives the same frame.
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './world.js';

const SAMPLE = 1 / 60;

/** A fake input object the autopilot steers with, shaped like the real one. */
function fakeInput() {
  const f = { _steer: 0, _throttle: 0, _mx: 0, _my: 0 };
  f.steer = () => f._steer;
  f.throttle = () => f._throttle;
  f.moveX = () => f._mx;
  f.moveY = () => f._my;
  f.running = () => false;
  return f;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steer the player's car toward the next waypoint; returns true when all are reached. */
function driveToward(G, waypoints, input, dt) {
  const p = G.player;
  if (!p.car || waypoints.length === 0) {
    input._steer = 0;
    // Brake to a stop instead of coasting off the end of the road.
    input._throttle = p.car && Math.abs(p.car.speed) > 60 ? -1 : 0;
    return true;
  }
  const wp = waypoints[0];
  const d = Math.hypot(wp.x - p.x, wp.y - p.y);
  if (d < 70) {
    waypoints.shift();
    return waypoints.length === 0;
  }
  const want = Math.atan2(wp.y - p.y, wp.x - p.x);
  const diff = angleDiff(want, p.car.angle);
  input._steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Brake hard for a sharp turn, ease off near the waypoint, otherwise floor it.
  if (Math.abs(diff) > 0.9) input._throttle = Math.abs(p.car.speed) > 200 ? -1 : 0.3;
  else if (d < 260) input._throttle = 0.5;
  else input._throttle = 1;
  return false;
}

/** Walk the player toward the next waypoint along the roads. */
function walkToward(G, waypoints, input) {
  const p = G.player;
  if (waypoints.length === 0) {
    input._mx = 0;
    input._my = 0;
    return true;
  }
  const wp = waypoints[0];
  const d = Math.hypot(wp.x - p.x, wp.y - p.y);
  if (d < 40) {
    waypoints.shift();
    return waypoints.length === 0;
  }
  const want = Math.atan2(wp.y - p.y, wp.x - p.x);
  input._mx = Math.abs(Math.cos(want)) > 0.4 ? Math.sign(Math.cos(want)) : 0;
  input._my = Math.abs(Math.sin(want)) > 0.4 ? Math.sign(Math.sin(want)) : 0;
  return false;
}

/** Put the player in a car at (x, y) facing angle, ready to drive. */
function putPlayerInCar(G, x, y, angle, color) {
  const p = G.player;
  const car = G.cars.find((c) => c.kind === 'parked' && Math.hypot(c.x - x, c.y - y) < 400) || G.cars[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  car.kind = 'player';
  car.occupied = true;
  if (color) car.color = color;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.y = y;
  p.angle = angle;
  return car;
}

function stepAmbient(G, stepGame, seconds) {
  const input = fakeInput();
  for (let i = 0; i < seconds / SAMPLE; i += 1) stepGame(G, input, SAMPLE, null);
}

/**
 * Set `G` to the named scene (start, foot, mission or chase; any other name is start) and
 * return the screen to draw over it. `stepGame` is the same per-frame update the live loop
 * uses, so every scene is genuine play.
 */
export function stageShot(name, G, stepGame) {
  if (name === 'foot') {
    const p = G.player;
    p.x = 1400;
    p.y = 1800;
    p.angle = Math.PI / 2;
    const input = fakeInput();
    const waypoints = [{ x: 1400, y: 2200 }, { x: 1500, y: 2200 }];
    for (let i = 0; i < 4 / SAMPLE; i += 1) {
      walkToward(G, waypoints, input);
      stepGame(G, input, SAMPLE, null);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    startMission(G, 0);
    G.mission.stage = 1;
    G.mission.text = 'Cousin aboard — drive him to the Old Town safehouse';
    G.mission.target = { x: 300, y: 1500, label: 'Safehouse — Old Town' };
    G.mission.timer = 132;
    G.mission.passenger = true;
    G.player.wanted = 1;
    putPlayerInCar(G, 1800, 1400, Math.PI, '#e67e22');
    const input = fakeInput();
    const waypoints = [{ x: 300, y: 1400 }];
    for (let i = 0; i < 6 / SAMPLE; i += 1) {
      driveToward(G, waypoints, input, SAMPLE);
      stepGame(G, input, SAMPLE, null);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    startMission(G, 1);
    G.mission.stage = 1;
    G.mission.text = 'Package secured — deliver it to the North Hills drop';
    G.mission.target = { x: 2500, y: 1300, label: 'Drop — North Hills' };
    G.mission.timer = 154;
    G.player.wanted = 3;
    putPlayerInCar(G, 800, 1800, 0, '#c0392b');
    G.player.car.speed = 420;
    const input = fakeInput();
    const waypoints = [{ x: 2400, y: 1800 }];
    for (let i = 0; i < 5 / SAMPLE; i += 1) {
      driveToward(G, waypoints, input, SAMPLE);
      stepGame(G, input, SAMPLE, null);
    }
    return { screen: SCREEN_PLAY };
  }
  // start: the title screen over a living city.
  stepAmbient(G, stepGame, 5);
  return { screen: SCREEN_TITLE };
}

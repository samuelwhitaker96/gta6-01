// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, paused, mission failed, game over and win.
//
// ?seed=N fixes the city. ?shot=start|foot|mission|chase (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createGame, resetGame } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, ACTION_TAXI, createInput } from './input.js';
import { playerPunch, playerShoot, toggleEnterCar, updatePlayerDriving, updatePlayerOnFoot } from './player.js';
import { spawnTaxiFare, updatePedestrians, updateTraffic } from './traffic.js';
import { updateBullets, updatePolice } from './police.js';
import { acceptTaxiFare, applySave, loadProgress, saveProgress, updateMissions } from './missions.js';
import { createRenderer, SCREEN_FAILED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { drawHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
// Exposed for automated playtesting (and for curious players): the live game state.
window.__solmarina = game;
const renderer = createRenderer(canvas);
const audio = createAudio();
const save = loadProgress();

/** The mouse aim in world coordinates, from the pointer's position on the canvas. */
function aimAngle(G, input, cam) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / 1280, rect.height / 720);
  const offsetX = (rect.width - 1280 * scale) / 2;
  const offsetY = (rect.height - 720 * scale) / 2;
  const viewX = (input.mouse.screenX - offsetX) / scale;
  const viewY = (input.mouse.screenY - offsetY) / scale;
  return Math.atan2(viewY - (G.player.y - cam.y), viewX - (G.player.x - cam.x));
}

/**
 * One fixed step of the whole game: the player, traffic, pedestrians, police, missions,
 * bullets and particles, plus the timers that make messages and banners fade.
 */
export function stepGame(G, input, dt, audioOut) {
  const p = G.player;
  G.time += dt;
  if (G.messageTimer > 0) G.messageTimer -= dt;
  if (G.bannerTimer > 0) G.bannerTimer -= dt;
  if (G.crimeFlash > 0) G.crimeFlash -= dt * 2;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 22);
  if (p.dead || p.busted || G.won) return;
  const cam = { x: p.x - 640, y: p.y - 360 };
  // The screenshot autopilot has no mouse: aim along the player's facing instead.
  const aim = input.mouse ? aimAngle(G, input, cam) : p.angle;
  if (p.onFoot) updatePlayerOnFoot(G, input, dt, aim);
  else updatePlayerDriving(G, input, dt);
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateBullets(G, dt);
  for (let i = G.effects.length - 1; i >= 0; i -= 1) {
    const e = G.effects[i];
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.life -= dt;
    if (e.life <= 0) G.effects.splice(i, 1);
  }
  // A fare waves every so often while the player drives around with no job on.
  if (!G.taxi && G.fares.length === 0 && p.car && G.random() < dt * 0.02) spawnTaxiFare(G);
  if (audioOut) {
    const speed = p.car ? p.car.speed : 0;
    audioOut.update(speed, p.wanted);
  }
}

function runShot(name) {
  const scene = stageShot(name, game, stepGame);
  let painted = 0;
  function paint() {
    const ctx = canvas.getContext('2d');
    const cam = renderer.draw(game, scene.screen, save);
    if (scene.screen === SCREEN_PLAY) drawHud(ctx, game, cam);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) resetGame(game);
    else if (save) applySave(game, save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Marco Solis, driver for hire. Reach the yellow marker.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.busted();
    saveProgress(game);
    announce(game.player.busted ? 'Busted. Game over.' : 'Wasted. Game over.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startGame(false);
      else if (screen === SCREEN_OVER || screen === SCREEN_WIN) startGame(true);
      else if (screen === SCREEN_FAILED) {
        screen = SCREEN_PLAY;
        announce('Mission restarted.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER) {
      const result = toggleEnterCar(game);
      if (result) audio.door();
      else announce('No car close enough.');
    }
    if (actions & ACTION_PUNCH) {
      if (playerPunch(game)) audio.punch();
    }
    if (actions & ACTION_SHOOT) {
      const cam = renderer.camera(game);
      if (playerShoot(game, aimAngle(game, input, cam))) audio.gunshot();
      else if (game.player.ammo <= 0) announce('Out of ammo — find an ammo crate.');
    }
    if (actions & ACTION_TAXI) {
      if (acceptTaxiFare(game)) audio.cash();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen plays over a living city.
      updateTraffic(game, STEP);
      updatePedestrians(game, STEP);
      game.time += STEP;
      return;
    }
    const before = game.stats.missionsDone;
    const wasWon = game.won;
    stepGame(game, input, STEP, audio);
    if (game.stats.missionsDone > before) audio.missionComplete();
    if (game.won && !wasWon) {
      screen = SCREEN_WIN;
      audio.missionComplete();
      saveProgress(game);
      announce('All three missions done. Solmarina is yours.');
    } else if (game.player.dead || game.player.busted) {
      endGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const ctx = canvas.getContext('2d');
    const cam = renderer.draw(game, screen, save);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(ctx, game, cam);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmarina. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

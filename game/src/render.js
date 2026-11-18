// Drawing only: the city, the cars, the people and the screens, from the state. The camera
// follows the player and never leaves the city; the HUD is drawn by hud.js on top of this.
import { BEACH_TOP, DISTRICTS, FONT, PALETTE, PARK, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { districtAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_FAILED = 'failed';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: 0, h: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.w = canvas.width;
    view.h = canvas.height;
    view.x = (canvas.width - VIEW_W * view.scale) / 2;
    view.y = (canvas.height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    const key = `${size}`;
    if (!fonts.has(key)) fonts.set(key, `bold ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  /** The camera rectangle in world coordinates, centred on the player. */
  function camera(G) {
    const p = G.player;
    const w = VIEW_W;
    const h = VIEW_H;
    let x = p.x - w / 2;
    let y = p.y - h / 2;
    if (G.shake > 0) {
      x += (Math.random() - 0.5) * G.shake;
      y += (Math.random() - 0.5) * G.shake;
    }
    x = Math.max(0, Math.min(WORLD.width - w, x));
    y = Math.max(0, Math.min(WORLD.height - h, y));
    return { x, y, w, h };
  }

  function drawGround(G, cam) {
    const { x: cx, y: cy } = cam;
    // District ground tints.
    for (const d of DISTRICTS) {
      context.fillStyle = d.tint;
      context.fillRect(d.x - cx, d.y - cy, d.w, d.h);
    }
    // Beach sand and sea along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH_TOP - cy, WORLD.width, WORLD.height - BEACH_TOP);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, BEACH_TOP + 62 - cy, WORLD.width, WORLD.height - BEACH_TOP);
    context.fillStyle = PALETTE.seaDeep;
    for (let wx = 0; wx < WORLD.width; wx += 180) {
      context.fillRect(wx + ((G.time * 20) % 180) - 90, BEACH_TOP + 90 - cy, 90, 6);
    }
    // Park grass, pond and trees.
    context.fillStyle = PALETTE.parkGreen;
    context.fillRect(PARK.x - cx, PARK.y - cy, PARK.w, PARK.h);
    context.fillStyle = '#7ec8e3';
    context.beginPath();
    context.ellipse(PARK.x + 200 - cx, PARK.y + 210 - cy, 70, 44, 0, 0, Math.PI * 2);
    context.fill();
    for (const t of G.city.trees) {
      context.fillStyle = '#3e7d32';
      context.beginPath();
      context.arc(t.x - cx, t.y - cy, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#5a3d24';
      context.fillRect(t.x - cx - 2, t.y - cy + t.r - 4, 4, 8);
    }
    // Sidewalks: pale strips along every road.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_WIDTH / 2 - 14 - cx, 0, ROAD_WIDTH + 28, WORLD.height);
    for (const ry of ROADS_Y) context.fillRect(0, ry - ROAD_WIDTH / 2 - 14 - cy, WORLD.width, ROAD_WIDTH + 28);
    // Roads with centre dashes.
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_WIDTH / 2 - cx, 0, ROAD_WIDTH, WORLD.height);
    for (const ry of ROADS_Y) context.fillRect(0, ry - ROAD_WIDTH / 2 - cy, WORLD.width, ROAD_WIDTH);
    context.fillStyle = PALETTE.lane;
    for (const rx of ROADS_X) {
      for (let y = 0; y < WORLD.height; y += 64) context.fillRect(rx - 2 - cx, y - cy, 4, 30);
    }
    for (const ry of ROADS_Y) {
      for (let x = 0; x < WORLD.width; x += 64) context.fillRect(x - cx, ry - 2 - cy, 30, 4);
    }
    // Crosswalks at intersections.
    context.fillStyle = '#e8e8e8';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(rx + i * 12 - 4 - cx, ry - ROAD_WIDTH / 2 - 4 - cy, 8, 10);
          context.fillRect(rx + i * 12 - 4 - cx, ry + ROAD_WIDTH / 2 - 6 - cy, 8, 10);
        }
      }
    }
  }

  function drawBuildings(G, cam) {
    const { x: cx, y: cy } = cam;
    for (const b of G.city.buildings) {
      if (b.x + b.w < cx - 50 || b.x > cx + VIEW_W + 50 || b.y + b.h < cy - 50 || b.y > cy + VIEW_H + 50) continue;
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x - cx + 6, b.y - cy + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x - cx, b.y - cy, b.w, b.h);
      context.fillStyle = b.tall ? '#7a4a2b' : PALETTE.roof;
      context.fillRect(b.x - cx + 5, b.y - cy + 5, b.w - 10, b.h - 10);
      context.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 7 + j * 3) % 4 === 0) continue;
          context.fillRect(b.x - cx + 10 + i * 32, b.y - cy + 10 + j * 32, 16, 12);
        }
      }
      if (b.tall) {
        context.fillStyle = '#5d3a22';
        context.fillRect(b.x - cx + b.w / 2 - 8, b.y - cy - 14, 16, 16);
      }
    }
    // Landmark labels, drawn over the city.
    text('SOLMARINA', 1500 - cx, 120 - cy, 34, 'rgba(60,50,30,0.55)', 'center');
    text('MARINA BAY', 1500 - cx, 2190 - cy, 30, 'rgba(255,255,255,0.8)', 'center');
    text('OLD TOWN', 400 - cx, 120 - cy, 26, 'rgba(60,50,30,0.5)', 'center');
    text('PORTSIDE', 2500 - cx, 120 - cy, 26, 'rgba(60,50,30,0.5)', 'center');
    text('PALM PARK', PARK.x + 200 - cx, PARK.y + 90 - cy, 24, 'rgba(255,255,255,0.85)', 'center');
  }

  function drawCar(G, cam, car) {
    const { x: cx, y: cy } = cam;
    const x = car.x - cx;
    const y = car.y - cy;
    context.save();
    context.translate(x, y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-34, -16 + 4, 68, 32);
    context.fillStyle = car.color;
    roundRect(-34, -16, 68, 32, 9);
    context.fill();
    context.fillStyle = '#222d3a';
    roundRect(-8, -13, 22, 26, 4);
    context.fill();
    context.fillStyle = '#dfe9f2';
    context.fillRect(14, -12, 8, 24);
    if (car.kind === 'police') {
      context.fillStyle = '#ffffff';
      context.fillRect(-30, -14, 60, 6);
      const flash = Math.floor(G.time * 6) % 2 === 0;
      context.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
      context.beginPath();
      context.arc(-20, 0, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = flash ? '#2d7dff' : '#ff2d2d';
      context.beginPath();
      context.arc(20, 0, 5, 0, Math.PI * 2);
      context.fill();
    }
    if (car.brakeLight) {
      context.fillStyle = '#ff2222';
      context.fillRect(-36, -13, 4, 8);
      context.fillRect(-36, 5, 4, 8);
    }
    context.restore();
    if (car.kind === 'player') {
      context.fillStyle = '#ffffff';
      context.font = `bold 11px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(car.name.toUpperCase(), x, y - 26);
    }
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawPerson(G, cam, px, py, angle, color, down, isCop, isEnemy) {
    const { x: cx, y: cy } = cam;
    const x = px - cx;
    const y = py - cy;
    context.save();
    context.translate(x, y);
    if (down > 0) context.rotate(Math.PI / 2);
    else context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.2)';
    context.beginPath();
    context.ellipse(0, 6, 11, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = isCop ? '#1a3a8f' : isEnemy ? '#7b241c' : color;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f1c27d';
    context.beginPath();
    context.arc(7, 0, 5, 0, Math.PI * 2);
    context.fill();
    if (isCop) {
      context.fillStyle = '#ffd700';
      context.fillRect(-2, -14, 4, 4);
    }
    context.restore();
  }

  function drawMarkers(G, cam) {
    const { x: cx, y: cy } = cam;
    const pulse = 1 + Math.sin(G.time * 5) * 0.15;
    function beacon(x, y, color, label) {
      const sx = x - cx;
      const sy = y - cy;
      context.fillStyle = color;
      context.globalAlpha = 0.25;
      context.fillRect(sx - 3, sy - 260, 6, 260);
      context.globalAlpha = 1;
      context.save();
      context.translate(sx, sy);
      context.rotate(Math.PI / 4);
      context.fillRect(-11 * pulse, -11 * pulse, 22 * pulse, 22 * pulse);
      context.restore();
      context.fillStyle = '#111111';
      context.font = `bold 13px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(label, sx, sy - 34);
    }
    const m = G.mission;
    if (m.target && !m.done) beacon(m.target.x, m.target.y, PALETTE.marker, m.target.label || 'OBJECTIVE');
    if (G.taxi) beacon(G.taxi.dest.x, G.taxi.dest.y, PALETTE.markerGreen, 'DROP-OFF');
    for (const fare of G.fares) beacon(fare.ped.x, fare.ped.y, PALETTE.markerGreen, 'TAXI $');
    for (const pk of G.pickups) {
      if (pk.taken) continue;
      const sx = pk.x - cx;
      const sy = pk.y - cy;
      context.fillStyle = pk.kind === 'cash' ? '#2ecc71' : '#f39c12';
      context.beginPath();
      context.arc(sx, sy, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = `bold 11px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(pk.kind === 'cash' ? '$' : 'A', sx, sy + 4);
    }
  }

  function drawEffects(G, cam) {
    const { x: cx, y: cy } = cam;
    for (const b of G.bullets) {
      context.strokeStyle = '#ffe14d';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - cx - b.vx * 0.02, b.y - cy - b.vy * 0.02);
      context.lineTo(b.x - cx, b.y - cy);
      context.stroke();
    }
    for (const e of G.effects) {
      context.globalAlpha = Math.max(0, e.life / e.max);
      context.fillStyle = e.color;
      context.beginPath();
      context.arc(e.x - cx, e.y - cy, e.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt, accent) {
    context.fillStyle = 'rgba(8,12,20,0.55)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 780;
    const h = 150 + lines.length * 34 + 70;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    context.fillStyle = PALETTE.panel;
    roundRectPanel(x, y, w, h);
    context.fill();
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    context.stroke();
    text(title, VIEW_W / 2, y + 72, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 128 + i * 34, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW_W / 2, y + h - 32, 22, PALETTE.gold, 'center');
  }

  function roundRectPanel(x, y, w, h) {
    context.beginPath();
    context.moveTo(x + 16, y);
    context.arcTo(x + w, y, x + w, y + h, 16);
    context.arcTo(x + w, y + h, x, y + h, 16);
    context.arcTo(x, y + h, x, y, 16);
    context.arcTo(x, y, x + w, y, 16);
    context.closePath();
  }

  /** Paint one frame: the world through the camera, then the screen's overlay. */
  function draw(G, screen, save) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0e1420';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cam = camera(G);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawGround(G, cam);
    drawBuildings(G, cam);
    drawMarkers(G, cam);
    for (const car of G.cars) drawCar(G, cam, car);
    for (const ped of G.peds) {
      if (!ped.walking) continue;
      drawPerson(G, cam, ped.x, ped.y, ped.angle, ped.color, ped.down, false, false);
    }
    for (const e of G.enemies) {
      if (e.health <= 0) continue;
      drawPerson(G, cam, e.x, e.y, e.angle, '#7b241c', 0, false, true);
      context.fillStyle = '#e74c3c';
      context.fillRect(e.x - cam.x - 16, e.y - cam.y - 26, 32 * (e.health / 60), 4);
    }
    for (const cop of G.cops) drawPerson(G, cam, cop.x, cop.y, cop.angle, '#1a3a8f', 0, true, false);
    const p = G.player;
    if (p.onFoot && !p.dead) {
      const blink = p.invulnerable > 0 && Math.floor(G.time * 10) % 2 === 0;
      if (!blink) drawPerson(G, cam, p.x, p.y, p.angle, '#e67e22', 0, false, false);
    }
    drawEffects(G, cam);
    if (G.bannerTimer > 0) {
      const parts = G.banner.split(' — ');
      context.fillStyle = 'rgba(8,12,20,0.75)';
      context.fillRect(0, 88, VIEW_W, parts.length > 1 ? 84 : 56);
      text(parts[0], VIEW_W / 2, 122, 24, PALETTE.text, 'center');
      if (parts.length > 1) text(parts.slice(1).join(' — '), VIEW_W / 2, 152, 18, PALETTE.muted, 'center');
    }
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMARINA', [
        'A sun-soaked coastal city. Marco Solis, driver for hire,',
        'owes Rosa Delgado three jobs — and the Coral Crew wants him gone.',
        'Steal cars, outrun the police, finish all three missions.',
        'WASD drive & walk  •  E enter car  •  Mouse aim, click to shoot',
        save ? `Saved game found: $${save.money} — press Enter to continue it` : '',
      ].filter(Boolean), 'Press Space or click to start');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one — except right now.', `Money $${p.money}  •  Missions done ${G.stats.missionsDone}/3`], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const busted = p.busted;
      drawPanel(busted ? 'BUSTED' : 'WASTED', [
        busted ? 'The Solmarina police took you in.' : 'Marco went down in the streets of Solmarina.',
        `Money $${p.money}  •  Missions done ${G.stats.missionsDone}/3  •  Cars stolen ${p.carsStolen}`,
      ], 'Press Space to try again');
    } else if (screen === SCREEN_FAILED) {
      drawPanel('Mission failed', [G.mission.text, 'The job restarts — Rosa is not patient.'], 'Press Space to retry the mission');
    } else if (screen === SCREEN_WIN) {
      drawPanel('SOLMARINA IS YOURS', [
        'All three jobs done. The Coral Crew is finished, Rosa is paid,',
        `and Marco Solis owns the streets. Final take: $${p.money}.`,
        `Cars stolen ${p.carsStolen}  •  Pedestrians hit ${p.pedsHit}  •  Missions ${G.stats.missionsDone}/3`,
      ], 'Press Space to keep roaming the city');
    }
    return cam;
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, camera };
}

// The HUD: health bar, money, wanted stars, mission objective, speed and ammo, and the
// canvas-drawn minimap — roads, the player arrow, the mission marker and police dots.
// It draws on top of the world, in screen space (1280 x 720).
import { FONT, PALETTE, ROADS_X, ROADS_Y, WORLD } from './config.js';
import { districtAt } from './world.js';

const VIEW_W = 1280;
const VIEW_H = 720;
const MAP_W = 220;
const MAP_H = 165;
const MAP_X = VIEW_W - MAP_W - 16;
const MAP_Y = VIEW_H - MAP_H - 16;

export function drawHud(context, G, cam) {
  const p = G.player;
  context.textBaseline = 'alphabetic';
  // Health bar, top left.
  context.fillStyle = 'rgba(8,12,20,0.6)';
  context.fillRect(14, 14, 220, 30);
  context.fillStyle = '#222';
  context.fillRect(20, 20, 150, 18);
  context.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
  context.fillRect(20, 20, Math.max(0, 150 * (p.health / 100)), 18);
  context.fillStyle = PALETTE.text;
  context.font = `bold 15px ${FONT}`;
  context.textAlign = 'left';
  context.fillText(`HP ${Math.ceil(p.health)}`, 178, 35);
  // Money, under the health bar.
  context.fillStyle = PALETTE.gold;
  context.font = `bold 22px ${FONT}`;
  context.fillText(`$${p.money}`, 16, 74);
  // Wanted stars, top right.
  context.textAlign = 'right';
  for (let i = 0; i < 5; i += 1) {
    context.fillStyle = i < p.wanted ? PALETTE.wanted : 'rgba(255,255,255,0.25)';
    drawStar(context, VIEW_W - 24 - i * 34, 34, i < p.wanted ? 15 : 12);
  }
  context.font = `bold 13px ${FONT}`;
  context.fillStyle = p.wanted > 0 ? '#ff8a7a' : PALETTE.muted;
  context.fillText(p.wanted > 0 ? 'WANTED — LOSE THE HEAT' : districtAt(p.x, p.y).name.toUpperCase(), VIEW_W - 20, 62);
  // Mission objective, top centre.
  const m = G.mission;
  context.textAlign = 'center';
  context.fillStyle = 'rgba(8,12,20,0.6)';
  const objText = m.done ? 'Mission complete!' : m.text;
  const tw = context.measureText(objText).width;
  context.fillRect(VIEW_W / 2 - tw / 2 - 90, 12, tw + 180, 30);
  context.fillStyle = PALETTE.marker;
  context.font = `bold 16px ${FONT}`;
  context.fillText(`★ ${objText}`, VIEW_W / 2, 33);
  if (m.timer > 0 && !m.done) {
    context.fillStyle = m.timer < 30 ? '#ff8a7a' : PALETTE.text;
    context.font = `bold 16px ${FONT}`;
    context.fillText(`⏱ ${Math.ceil(m.timer)}s`, VIEW_W / 2, 58);
  }
  // Message line under the objective — dropped below the mission banner while it is up.
  if (G.messageTimer > 0) {
    context.fillStyle = PALETTE.text;
    context.font = `16px ${FONT}`;
    context.fillText(G.message, VIEW_W / 2, G.bannerTimer > 0 ? 200 : 84);
  }
  // Bottom-left controls and status.
  context.textAlign = 'left';
  context.fillStyle = 'rgba(8,12,20,0.55)';
  context.fillRect(14, VIEW_H - 92, 330, 78);
  context.fillStyle = PALETTE.muted;
  context.font = `14px ${FONT}`;
  if (p.onFoot) {
    context.fillText('WASD walk • Shift run • E enter car', 24, VIEW_H - 66);
    context.fillText('Mouse aim • Click / F shoot • J punch', 24, VIEW_H - 44);
    context.fillText(`Pistol ${p.ammo} rounds • T taxi when a fare waves`, 24, VIEW_H - 22);
  } else {
    const speed = Math.abs(Math.round((p.car ? p.car.speed : 0) * 0.18));
    context.fillStyle = PALETTE.text;
    context.font = `bold 20px ${FONT}`;
    context.fillText(`${speed} km/h  •  ${p.car ? p.car.name : ''}`, 24, VIEW_H - 62);
    context.fillStyle = PALETTE.muted;
    context.font = `14px ${FONT}`;
    context.fillText('W/S drive • A/D steer • E exit car • T taxi fare', 24, VIEW_H - 38);
    context.fillText(`Car condition ${Math.max(0, Math.round(p.car ? p.car.health : 0))}%`, 24, VIEW_H - 18);
  }
  drawMinimap(context, G);
}

/** A five-pointed star, for the wanted level. */
function drawStar(context, x, y, r) {
  context.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
}

/** The minimap: roads, park, beach, player arrow, mission marker, police and taxi dots. */
function drawMinimap(context, G) {
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  const X = (x) => MAP_X + x * sx;
  const Y = (y) => MAP_Y + y * sy;
  context.fillStyle = 'rgba(8,12,20,0.72)';
  context.fillRect(MAP_X - 4, MAP_Y - 4, MAP_W + 8, MAP_H + 8);
  context.fillStyle = '#20262e';
  context.fillRect(MAP_X, MAP_Y, MAP_W, MAP_H);
  context.fillStyle = '#3e7d32';
  context.fillRect(X(1000), Y(1000), 400 * sx, 400 * sy);
  context.fillStyle = '#2e86c1';
  context.fillRect(MAP_X, Y(2340), MAP_W, MAP_H - (2340 * sy));
  context.strokeStyle = '#8a929e';
  context.lineWidth = 2;
  for (const rx of ROADS_X) {
    context.beginPath();
    context.moveTo(X(rx), MAP_Y);
    context.lineTo(X(rx), MAP_Y + MAP_H);
    context.stroke();
  }
  for (const ry of ROADS_Y) {
    context.beginPath();
    context.moveTo(MAP_X, Y(ry));
    context.lineTo(MAP_X + MAP_W, Y(ry));
    context.stroke();
  }
  const m = G.mission;
  if (m.target && !m.done) {
    context.fillStyle = PALETTE.marker;
    const pulse = 4 + Math.sin(G.time * 5) * 1.5;
    context.beginPath();
    context.arc(X(m.target.x), Y(m.target.y), pulse, 0, Math.PI * 2);
    context.fill();
  }
  if (G.taxi) {
    context.fillStyle = '#2ecc71';
    context.beginPath();
    context.arc(X(G.taxi.dest.x), Y(G.taxi.dest.y), 4, 0, Math.PI * 2);
    context.fill();
  }
  for (const car of G.cars) {
    if (car.kind !== 'police') continue;
    context.fillStyle = '#3b6cff';
    context.beginPath();
    context.arc(X(car.x), Y(car.y), 3.5, 0, Math.PI * 2);
    context.fill();
  }
  for (const cop of G.cops) {
    context.fillStyle = '#3b6cff';
    context.beginPath();
    context.arc(X(cop.x), Y(cop.y), 2.5, 0, Math.PI * 2);
    context.fill();
  }
  // The player arrow, pointing where Marco faces.
  const p = G.player;
  context.save();
  context.translate(X(p.x), Y(p.y));
  context.rotate(p.angle);
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.moveTo(8, 0);
  context.lineTo(-6, -5);
  context.lineTo(-6, 5);
  context.closePath();
  context.fill();
  context.restore();
  context.strokeStyle = 'rgba(255,255,255,0.6)';
  context.lineWidth = 1;
  context.strokeRect(MAP_X - 4, MAP_Y - 4, MAP_W + 8, MAP_H + 8);
}

// The HUD: cash and health, the wanted stars, the clock, the mission
// objective, the minimap, the speedometer and the toasts. Drawn over the
// world every frame, in screen space.
import { VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { missionObjectiveText, missionTarget } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAP_W = 176;
const MAP_H = 132;
const MAP_X = 18;
const MAP_Y = VIEW_H - MAP_H - 18;

function text(ctx, value, x, y, size, color, align, weight) {
  ctx.font = `${weight || 600} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

/** The clock reads like a time of day: 14.5 becomes 14:30. */
export function clockLabel(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The minimap: the road grid, the player, the police, the guards and the job marker. */
export function drawMinimap(ctx, state) {
  const scaleX = MAP_W / WORLD_W;
  const scaleY = MAP_H / WORLD_H;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#10141c';
  ctx.fillRect(MAP_X - 4, MAP_Y - 4, MAP_W + 8, MAP_H + 8);
  ctx.fillStyle = '#1d2b1d';
  ctx.fillRect(MAP_X, MAP_Y, MAP_W, MAP_H);
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 2;
  for (const avenue of state.cityAvenues) {
    ctx.beginPath();
    ctx.moveTo(MAP_X + avenue * scaleX, MAP_Y);
    ctx.lineTo(MAP_X + avenue * scaleX, MAP_Y + MAP_H);
    ctx.stroke();
  }
  for (const street of state.cityStreets) {
    ctx.beginPath();
    ctx.moveTo(MAP_X, MAP_Y + street * scaleY);
    ctx.lineTo(MAP_X + MAP_W, MAP_Y + street * scaleY);
    ctx.stroke();
  }
  // The harbor water at the bottom edge.
  ctx.fillStyle = '#274b6d';
  ctx.fillRect(MAP_X, MAP_Y + MAP_H - 8, MAP_W, 8);
  // The mission marker pulses.
  const target = missionTarget(state);
  if (target) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(MAP_X + target.x * scaleX, MAP_Y + target.y * scaleY, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Guards as red dots, patrol cars as blue dots, the player as a white one.
  ctx.fillStyle = '#e5534b';
  for (const guard of state.guards) {
    if (guard.health > 0) {
      ctx.fillRect(MAP_X + guard.x * scaleX - 2, MAP_Y + guard.y * scaleY - 2, 4, 4);
    }
  }
  ctx.fillStyle = '#4f8ef7';
  for (const car of state.cars) {
    if (car.driver === 'police' && !car.wrecked) {
      ctx.fillRect(MAP_X + car.x * scaleX - 2, MAP_Y + car.y * scaleY - 2, 4, 4);
    }
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(MAP_X + state.player.x * scaleX, MAP_Y + state.player.y * scaleY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // The camera's view rectangle, faint.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    MAP_X + state.camera.x * scaleX,
    MAP_Y + state.camera.y * scaleY,
    VIEW_W * scaleX,
    VIEW_H * scaleY,
  );
  ctx.restore();
}

/** Everything the HUD draws, in screen space, over the world. */
export function drawHud(ctx, state) {
  const player = state.player;
  // Cash and health, top left.
  ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
  ctx.fillRect(14, 12, 250, 64);
  text(ctx, `$${Math.floor(player.cash).toLocaleString('en-US')}`, 26, 42, 26, '#7ee787', 'left', 800);
  const healthW = 200;
  ctx.fillStyle = '#3a2020';
  ctx.fillRect(26, 52, healthW, 12);
  ctx.fillStyle = player.health > 30 ? '#7ee787' : '#e5534b';
  ctx.fillRect(26, 52, healthW * (player.health / 100), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 52, healthW, 12);

  // Wanted stars and the clock, top right.
  const stars = state.wanted.stars;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
  ctx.fillRect(VIEW_W - 250, 12, 236, 64);
  for (let i = 0; i < 5; i += 1) {
    text(ctx, i < stars ? '★' : '☆', VIEW_W - 228 + i * 30, 44, 26, i < stars ? '#f2c94c' : '#5a6270');
  }
  text(ctx, clockLabel(state.timeOfDay), VIEW_W - 26, 70, 16, '#eef1f5', 'right');
  text(ctx, state.timeOfDay >= 6 && state.timeOfDay < 18 ? 'DAY' : 'NIGHT', VIEW_W - 96, 70, 16, '#8b93a3', 'right');

  // The mission objective, centred at the top.
  const objective = missionObjectiveText(state);
  ctx.font = `600 17px ${FONT}`;
  const objW = ctx.measureText(objective).width;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
  ctx.fillRect((VIEW_W - objW) / 2 - 14, 12, objW + 28, 34);
  text(ctx, objective, VIEW_W / 2, 35, 17, '#f2c94c', 'center');

  // Toast messages under the objective.
  if (state.missions.messageTime > 0) {
    ctx.globalAlpha = Math.min(1, state.missions.messageTime);
    ctx.font = `600 18px ${FONT}`;
    const msgW = ctx.measureText(state.missions.message).width;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.7)';
    ctx.fillRect((VIEW_W - msgW) / 2 - 12, 54, msgW + 24, 30);
    text(ctx, state.missions.message, VIEW_W / 2, 75, 18, '#eef1f5', 'center');
    ctx.globalAlpha = 1;
  }

  // The minimap, bottom left.
  drawMinimap(ctx, state);

  // Speed and the car, bottom right.
  if (player.inCar) {
    const mph = Math.round(Math.abs(player.inCar.speed) * 0.12);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    ctx.fillRect(VIEW_W - 190, VIEW_H - 66, 176, 52);
    text(ctx, `${mph} mph`, VIEW_W - 28, VIEW_H - 34, 24, '#eef1f5', 'right', 800);
    text(ctx, player.inCar.label, VIEW_W - 28, VIEW_H - 52, 13, '#8b93a3', 'right');
  } else {
    text(ctx, 'WASD move · Shift run · E enter car · Click / Space shoot · P pause · Q save', VIEW_W - 18, VIEW_H - 20, 13, 'rgba(238,241,245,0.65)', 'right');
  }

  // A bust in progress: the cuffs are closing in.
  if (player.bustProgress > 0) {
    const w = 260;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.7)';
    ctx.fillRect((VIEW_W - w) / 2, 100, w, 40);
    text(ctx, 'BUSTED INCOMING — RUN!', VIEW_W / 2, 126, 18, '#e5534b', 'center', 800);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect((VIEW_W - w) / 2 + 10, 132, (w - 20) * player.bustProgress, 4);
  }

  // The crosshair, where the mouse aims on foot.
  if (!player.inCar && state.aim.active) {
    const mouse = state.aim.mouse;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouse.x - 13, mouse.y);
    ctx.lineTo(mouse.x - 5, mouse.y);
    ctx.moveTo(mouse.x + 5, mouse.y);
    ctx.lineTo(mouse.x + 13, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 13);
    ctx.lineTo(mouse.x, mouse.y - 5);
    ctx.moveTo(mouse.x, mouse.y + 5);
    ctx.lineTo(mouse.x, mouse.y + 13);
    ctx.stroke();
  }
}

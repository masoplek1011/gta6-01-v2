// Drawing only: the city, the people and cars in it, the day/night light and
// the title, pause and end screens. The 1280x720 view is scaled to fit the
// window and centred, the margin filled dark.
import { AVENUES, ROAD_W, STREETS, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { clockLabel } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SKY_DAY = '#7ec8e3';
const SKY_DUSK = '#e8927c';
const SKY_NIGHT = '#0d1526';

/** How dark the world is at this hour: 0 at noon, up to 0.62 at midnight. */
export function nightFactor(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 7 && h < 17) return 0;
  if (h >= 17 && h < 19) return (h - 17) / 2 * 0.35;
  if (h >= 19 || h < 5) return 0.62;
  if (h >= 5 && h < 7) return (7 - h) / 2 * 0.62;
  return 0;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    ctx.font = `${weight || 600} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  /** The ground: grass, then the harbor water along the south edge. */
  function drawGround(state) {
    const night = nightFactor(state.timeOfDay);
    ctx.fillStyle = night > 0.3 ? '#2c3d24' : '#5d8a4a';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Beach sand, then the water.
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(0, WORLD_H - 150, WORLD_W, 60);
    ctx.fillStyle = '#274b6d';
    ctx.fillRect(0, WORLD_H - 90, WORLD_W, 90);
    // The pier at Pier 9.
    ctx.fillStyle = '#6b5a4a';
    ctx.fillRect(2560, WORLD_H - 260, 120, 180);
    ctx.fillStyle = '#8a7a68';
    for (let i = 0; i < 6; i += 1) ctx.fillRect(2572, WORLD_H - 250 + i * 28, 96, 8);
  }

  function drawBlocks(state) {
    const city = state.city;
    for (const park of city.parks) {
      ctx.fillStyle = park.green;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(park.x, park.y, park.w, 6);
    }
    for (const lot of city.lots) {
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 20; x < lot.x + lot.w - 20; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 10);
        ctx.lineTo(x, lot.y + 34);
        ctx.stroke();
      }
    }
    for (const tree of city.trees) {
      ctx.fillStyle = '#2f5d23';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4f7d43';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRoads() {
    ctx.fillStyle = '#33363d';
    for (const avenue of AVENUES) ctx.fillRect(avenue - ROAD_W / 2, 0, ROAD_W, WORLD_H);
    for (const street of STREETS) ctx.fillRect(0, street - ROAD_W / 2, WORLD_W, ROAD_W);
    // Sidewalk edges.
    ctx.fillStyle = '#8f959e';
    for (const avenue of AVENUES) {
      ctx.fillRect(avenue - ROAD_W / 2 - 8, 0, 8, WORLD_H);
      ctx.fillRect(avenue + ROAD_W / 2, 0, 8, WORLD_H);
    }
    for (const street of STREETS) {
      ctx.fillRect(0, street - ROAD_W / 2 - 8, WORLD_W, 8);
      ctx.fillRect(0, street + ROAD_W / 2, WORLD_W, 8);
    }
    // Centre dashes.
    ctx.fillStyle = '#e8c94a';
    for (const avenue of AVENUES) {
      for (let y = 40; y < WORLD_H; y += 80) ctx.fillRect(avenue - 3, y, 6, 40);
    }
    for (const street of STREETS) {
      for (let x = 40; x < WORLD_W; x += 80) ctx.fillRect(x, street - 3, 40, 6);
    }
  }

  function drawBuildings(state) {
    const night = nightFactor(state.timeOfDay);
    for (const b of state.city.buildings) {
      // A soft shadow to the south-east gives the block its height.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8 * b.height, b.y + 8 * b.height, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      // Lit windows after dark.
      if (night > 0.2) {
        ctx.fillStyle = '#ffd76a';
        const cols = Math.max(1, Math.floor(b.w / 26));
        const rows = Math.max(1, Math.floor(b.h / 26));
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            if (((c * 7 + r * 3 + b.x) % 5) < 2) {
              ctx.fillRect(b.x + 12 + c * 26, b.y + 12 + r * 26, 10, 12);
            }
          }
        }
      }
      if (b.label) {
        ctx.font = `700 13px ${FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
  }

  function drawCarShape(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (car.wrecked) {
      ctx.fillStyle = '#22242a';
      ctx.fillRect(-26, -13, 52, 26);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(-10, -8, 20, 16);
      ctx.restore();
      return;
    }
    // Wheels.
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-18, -15, 12, 6);
    ctx.fillRect(8, -15, 12, 6);
    ctx.fillRect(-18, 9, 12, 6);
    ctx.fillRect(8, 9, 12, 6);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-26, -13, 52, 26, 7);
    ctx.fill();
    // Windshield and roof.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    ctx.fillRect(6, -10, 10, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-12, -10, 14, 20);
    // Police livery and light bar.
    if (car.kind === 'cop') {
      ctx.fillStyle = '#eef1f5';
      ctx.fillRect(-26, -13, 52, 7);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(-4, -17, 8, 5);
      ctx.fillStyle = '#4f8ef7';
      ctx.fillRect(4, -17, 8, 5);
      ctx.fillStyle = '#eef1f5';
      ctx.font = `700 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SPPD', 0, 3);
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#14161a';
      ctx.font = `700 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    ctx.restore();
  }

  function drawCars(state) {
    for (const car of state.cars) {
      if (car.smoke > 0.2 && !car.wrecked) {
        ctx.fillStyle = 'rgba(90,90,90,0.5)';
        ctx.beginPath();
        ctx.arc(car.x - 18, car.y - 8, 8 + (car.smoke % 1) * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      drawCarShape(car);
    }
  }

  function drawPedestrian(ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (!ped.alive) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.shirt;
      ctx.fillRect(-11, -6, 22, 12);
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(14, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.rotate(ped.angle);
    // Legs swing with the walk.
    ctx.strokeStyle = '#2b2f38';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-6 + bob, 5);
    ctx.moveTo(0, 0);
    ctx.lineTo(-6 - bob, -5);
    ctx.stroke();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(9, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.inCar) return;
    if (player.hurtFlash > 0 && Math.floor(player.hurtFlash * 12) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(2, -4, 12, 8);
    // The pistol in hand.
    ctx.fillStyle = '#14161a';
    ctx.fillRect(10, -2, 10, 4);
    ctx.restore();
    // A ring under the player so they are easy to find in a crowd.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 19, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      if (guard.health <= 0) continue;
      ctx.save();
      ctx.translate(guard.x, guard.y);
      ctx.rotate(guard.angle);
      ctx.fillStyle = '#3f3a35';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(2, -3, 12, 6);
      ctx.restore();
      ctx.fillStyle = '#3a2020';
      ctx.fillRect(guard.x - 14, guard.y - 24, 28, 5);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(guard.x - 14, guard.y - 24, 28 * (guard.health / 60), 5);
    }
  }

  function drawBullets(state) {
    ctx.fillStyle = '#ffd76a';
    for (const bullet of state.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The pulsing mission ring and the off-screen arrow that points at it. */
  function drawMissionMarker(state, camera) {
    const marker = missionMarkerFor(state);
    if (!marker) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.save();
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(242,201,76,0.15)';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Off-screen: an arrow at the view edge.
    const viewLeft = camera.x;
    const viewTop = camera.y;
    if (marker.x < viewLeft || marker.x > viewLeft + VIEW_W || marker.y < viewTop || marker.y > viewTop + VIEW_H) {
      const cx = Math.max(viewLeft + 40, Math.min(viewLeft + VIEW_W - 40, marker.x));
      const cy = Math.max(viewTop + 40, Math.min(viewTop + VIEW_H - 40, marker.y));
      const angle = Math.atan2(marker.y - state.player.y, marker.x - state.player.x);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** Which landmark the current mission step points at, or null. */
  function missionMarkerFor(state) {
    const lm = state.city.landmarks;
    const idx = state.missions.index;
    const step = state.missions.step;
    if (idx === 0) {
      if (step === 0) return lm.garage;
      if (step === 2) return lm.motel;
      return null;
    }
    if (idx === 1) {
      if (step === 0 || step === 1) return lm.market;
      if (step === 2) return lm.safehouse;
      return null;
    }
    if (idx === 2) {
      if (step === 0 || step === 1 || step === 2) return lm.harbor;
      if (step === 3) return lm.safehouse;
      return null;
    }
    return null;
  }

  /** Night: a dark wash, cut by headlight cones and the glow of street lamps. */
  function drawNight(state, camera) {
    const night = nightFactor(state.timeOfDay);
    if (night <= 0.02) return;
    ctx.fillStyle = `rgba(8, 12, 28, ${night})`;
    ctx.fillRect(camera.x - 20, camera.y - 20, VIEW_W + 40, VIEW_H + 40);
    // Headlight cones for the player's car and the patrol cars.
    const cars = state.cars.filter((car) => (car.driver === 'player' || car.driver === 'police') && !car.wrecked);
    for (const car of cars) {
      const gx = car.x + Math.cos(car.angle) * 26;
      const gy = car.y + Math.sin(car.angle) * 26;
      const grad = ctx.createRadialGradient(gx, gy, 10, gx, gy, 260);
      grad.addColorStop(0, 'rgba(255, 240, 180, 0.28)');
      grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, 260, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const width = 640;
    const height = 150 + lines.length * 34 + 70;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    ctx.fillStyle = '#141a26';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent || '#f2c94c';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW_W / 2, y + 74, 46, '#eef1f5', 'center', 800);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 128 + i * 34, 20, '#aab2c0', 'center');
    }
    text(prompt, VIEW_W / 2, y + height - 34, 22, accent || '#f2c94c', 'center', 700);
  }

  /** Paint one frame: the world through the camera, then the screen on top. */
  function draw(state, screen, saveName) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const camera = state.camera;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x - camera.x * view.scale, view.y - camera.y * view.scale);
    drawGround(state);
    drawBlocks(state);
    drawRoads(state);
    drawBuildings(state);
    drawMissionMarker(state, camera);
    drawCars(state);
    for (const ped of state.peds) drawPedestrian(ped);
    drawGuards(state);
    drawPlayer(state);
    drawBullets(state);
    drawParticles(state);
    drawNight(state, camera);

    // Back to screen space for the HUD and the panels.
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      const hud = state.hudDraw;
      if (hud) hud(ctx, state);
    }
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMARIS', [
        'A sun-soaked city. Three jobs. One way out clean.',
        'Steal cars, outrun the Solmaris PD, run Rico\u2019s jobs.',
        'WASD / arrows to move and drive · E to enter a car',
        'Mouse to aim · Click or Space to shoot · Shift to run',
        'P to pause · Q to save · M to mute',
        saveName ? `Saved game found — press Enter to continue (${saveName})` : 'No saved game yet — press Enter to start',
      ], 'Press Enter to play', '#f2c94c');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', [
        'The city waits for no one — except right now.',
        `Cash $${Math.floor(state.player.cash).toLocaleString('en-US')} · ${clockLabel(state.timeOfDay)}`,
        'Q saves your progress · M mutes the sound',
      ], 'Press P or Enter to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [
        'The Solmaris PD hauled you in. Half your cash is gone.',
        'The jobs are still waiting, if you still want them.',
      ], 'Press Enter to get back out there', '#4f8ef7');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', [
        'Solmaris keeps what it takes.',
        'The jobs are still waiting, if you still want them.',
      ], 'Press Enter to try again', '#e5534b');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('STORY COMPLETE', [
        'All three of Rico\u2019s jobs are done. Solmaris is yours.',
        `Final cash: $${Math.floor(state.player.cash).toLocaleString('en-US')} · Cars stolen: ${state.stats.carsStolen}`,
        'Free roam continues — keep the city, or start over.',
      ], 'Press Enter to keep playing', '#7ee787');
    }
    // A red flash while the player is hurt.
    if (state.player.hurtFlash > 0 && screen === SCREEN_PLAY) {
      ctx.fillStyle = `rgba(229,83,75,${state.player.hurtFlash * 0.5})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    void SKY_DAY;
    void SKY_DUSK;
    void SKY_NIGHT;
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

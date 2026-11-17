// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between title, play, paused,
// busted, wasted and story-complete screens.
//
// ?seed=N fixes the city. ?shot=chase|onfoot|mission|night (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, VIEW_H, VIEW_W } from './config.js';
import { applySave, createGameState, readSave, stepGame } from './game.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { hasSave } from './save.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

/** An input that presses nothing: the title screen's city idles on it. */
const idleInput = {
  moveVector: () => ({ x: 0, y: 0 }),
  steer: () => 0,
  throttle: () => false,
  brake: () => false,
  running: () => false,
  shooting: () => false,
  mouse: () => ({ x: VIEW_W / 2, y: VIEW_H / 2 }),
  takeActions: () => 0,
};

function runShot(name) {
  const { state, screen } = stageShot(name, seed);
  let painted = 0;
  function paint() {
    renderer.draw(state, screen, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let state = createGameState(seed);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let lastMouse = { x: -1, y: -1 };
  let saveLabel = hasSave() ? 'saved game' : null;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  /** The view transform the aim math needs: scale and offset of the 1280x720 view. */
  function updateView() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    state.view.scale = scale;
    state.view.ox = (window.innerWidth - VIEW_W * scale) / 2;
    state.view.oy = (window.innerHeight - VIEW_H * scale) / 2;
  }

  function startGame(fresh) {
    state.audio.ensure();
    if (fresh) {
      state = createGameState(seed);
    } else {
      const data = readSave();
      state = createGameState(seed);
      if (data) applySave(state, data);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing in Solmaris. Follow the yellow marker.');
  }

  function handleActions() {
    const actions = input.takeActions();
    const mouse = input.mouse();
    if (mouse.x !== lastMouse.x || mouse.y !== lastMouse.y) {
      state.aim.active = true;
      lastMouse = { x: mouse.x, y: mouse.y };
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startGame(!hasSave());
      else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) startGame(true);
      else if (screen === SCREEN_COMPLETE) {
        state.over = null;
        screen = SCREEN_PLAY;
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
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      stepGame(state, idleInput, STEP, 0);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    stepGame(state, input, STEP, actions);
    if (state.over === 'busted') {
      screen = SCREEN_BUSTED;
      announce('Busted by the Solmaris PD.');
    } else if (state.over === 'wasted') {
      screen = SCREEN_WASTED;
      announce('Wasted.');
    } else if (state.over === 'complete') {
      screen = SCREEN_COMPLETE;
      announce('Story complete. Solmaris is yours.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    updateView();
    const actions = handleActions();
    // One-shot presses belong to the first step only: replaying them in every
    // catch-up step would enter and exit the same car in one frame.
    let firstStep = true;
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step(firstStep ? actions : 0);
      firstStep = false;
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(state, screen, saveLabel);
    if (state.savedFlash > 0) {
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillStyle = '#7ee787';
      ctx.textAlign = 'center';
      ctx.fillText('Game saved', window.innerWidth / 2, 110);
      ctx.restore();
    }
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmaris. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

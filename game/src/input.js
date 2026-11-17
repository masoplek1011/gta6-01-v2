// Keyboard and pointer input. Held keys give a move vector; one-shot presses
// (confirm, pause, interact, save) are queued as flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_SAVE = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const SAVE = new Set(['KeyQ']);
const MUTE = new Set(['KeyM']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const SHOOT_KEY = new Set(['Space']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;

  function onKeyDown(event) {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || RUN.has(event.code) || SHOOT_KEY.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (SAVE.has(event.code)) actions |= ACTION_SAVE;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    onMouse(event);
  });
  canvas.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('pointermove', onMouse);

  function hasAny(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Move vector, -1..1 on each axis, from WASD or the arrow keys. */
    moveVector() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      return { x, y };
    },
    /** Steering for a car: -1 left, 1 right, from A/D or the arrow keys. */
    steer() {
      return (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
    },
    /** True while W / Up (accelerate) is held. */
    throttle() { return hasAny(UP); },
    /** True while S / Down (brake / reverse) is held. */
    brake() { return hasAny(DOWN); },
    /** True while Shift is held (run on foot). */
    running() { return hasAny(RUN); },
    /** True while Space or the mouse button is held (fire the pistol). */
    shooting() { return hasAny(SHOOT_KEY) || mouseDown; },
    /** The mouse position in canvas CSS pixels, for aiming. */
    mouse() { return { x: mouseX, y: mouseY }; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

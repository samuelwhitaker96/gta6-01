// Keyboard and mouse input. Held keys are read every frame; one-shot presses (start, pause,
// enter car, shoot, punch, taxi) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The mouse aims the pistol.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_TAXI = 32;
export const ACTION_MUTE = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyJ', 'KeyF']);
const TAXI = new Set(['KeyT']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  const mouse = { x: 0, y: 0, screenX: 0, screenY: 0, down: false };

  function mark(code, value) {
    if (UP.has(code)) keys.up = value;
    else if (DOWN.has(code)) keys.down = value;
    else if (LEFT.has(code)) keys.left = value;
    else if (RIGHT.has(code)) keys.right = value;
    else if (RUN.has(code)) keys.run = value;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code)) {
      mark(event.code, true);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (TAXI.has(event.code)) {
      if (!event.repeat) actions |= ACTION_TAXI;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => mark(event.code, false));
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.run = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.screenX = event.clientX - rect.left;
    mouse.screenY = event.clientY - rect.top;
    mouse.x = mouse.screenX;
    mouse.y = mouse.screenY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      actions |= ACTION_SHOOT;
      mouse.down = true;
    }
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys, mouse,
    /** Steering: -1 left, 1 right. Throttle: -1 brake/reverse, 1 accelerate. */
    steer() { return (keys.right ? 1 : 0) - (keys.left ? 1 : 0); },
    throttle() { return (keys.up ? 1 : 0) - (keys.down ? 1 : 0); },
    /** -1/0/1 on each axis for walking on foot. */
    moveX() { return (keys.right ? 1 : 0) - (keys.left ? 1 : 0); },
    moveY() { return (keys.down ? 1 : 0) - (keys.up ? 1 : 0); },
    running() { return keys.run; },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}

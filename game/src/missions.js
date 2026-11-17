// The story of Solmaris: three chained jobs for Rico, the garage owner who
// runs the city's quiet side. Each mission is a chain of steps; a step is
// done by reaching a place, stealing a car, picking something up, or clearing
// the guards. Finishing a mission pays cash and unlocks the next.
import { addHeat } from './police.js';
import { spawnGuards } from './combat.js';

export const MISSIONS = [
  {
    title: 'Job 1 — First Wheels',
    intro: 'Rico needs a driver. Get to his garage, take a car, bring it to the Sunset Motel.',
    reward: 400,
    steps: [
      { kind: 'goto', target: 'garage', text: 'Go to Rico\u2019s Garage' },
      { kind: 'steal', text: 'Steal any car (press E beside one)' },
      { kind: 'goto', target: 'motel', text: 'Drive the car to the Sunset Motel', needsCar: true },
    ],
  },
  {
    title: 'Job 2 — The Pickup',
    intro: 'A package waits at Marina Market. Collect it and run it to Casa Verde — the police will notice.',
    reward: 1200,
    steps: [
      { kind: 'goto', target: 'market', text: 'Drive to Marina Market', needsCar: true },
      { kind: 'pickup', target: 'market', text: 'Pick up the package', holdSeconds: 2 },
      { kind: 'goto', target: 'safehouse', text: 'Deliver the package to Casa Verde', needsCar: true },
    ],
  },
  {
    title: 'Job 3 — Harbor Heat',
    intro: 'One crate on Pier 9, four guards between you and it. Take the crate and lose the heat at Casa Verde.',
    reward: 3000,
    steps: [
      { kind: 'goto', target: 'harbor', text: 'Get to Pier 9 Harbor' },
      { kind: 'eliminate', text: 'Clear the dock guards (4 left)' },
      { kind: 'pickup', target: 'harbor', text: 'Grab the crate', holdSeconds: 2.5 },
      { kind: 'goto', target: 'safehouse', text: 'Escape to Casa Verde Safehouse' },
    ],
  },
];

/** Mission progress: which job, which step, and the per-step timer. */
export function createMissions() {
  return {
    index: 0,
    step: 0,
    holdTime: 0,
    guardsLeft: 0,
    done: false,
    message: '',
    messageTime: 0,
  };
}

export function currentMission(state) {
  if (state.missions.index >= MISSIONS.length) return null;
  return MISSIONS[state.missions.index];
}

export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.missions.step] || null;
}

/** Where the player has to be right now, or null when the step has no place. */
export function missionTarget(state) {
  const step = currentStep(state);
  if (!step || !step.target) return null;
  return state.city.landmarks[step.target];
}

/** The objective line the HUD shows: job title, step text and distance. */
export function missionObjectiveText(state) {
  const mission = currentMission(state);
  const step = currentStep(state);
  if (!mission || !step) return 'Story complete — Solmaris is yours.';
  const target = missionTarget(state);
  let suffix = '';
  if (target) {
    const dist = Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y));
    suffix = `  ·  ${dist}m`;
  }
  if (step.kind === 'eliminate') {
    return `${mission.title} — ${step.text.replace('(4 left)', `(${state.missions.guardsLeft} left)`)}`;
  }
  return `${mission.title} — ${step.text}${suffix}`;
}

/** Flash a message above the HUD for a few seconds. */
export function flashMessage(state, text) {
  state.missions.message = text;
  state.missions.messageTime = 4;
}

/** Advance the story one step when the player did what the step asked. */
export function updateMissions(state, dt) {
  const missions = state.missions;
  if (missions.messageTime > 0) missions.messageTime -= dt;
  const mission = currentMission(state);
  if (!mission) return;
  const step = currentStep(state);
  if (!step) return;
  const player = state.player;

  if (step.kind === 'goto' || step.kind === 'pickup') {
    const target = missionTarget(state);
    if (!target) return;
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    if (step.kind === 'goto') {
      if (dist < 70) advanceStep(state, mission);
    } else if (dist < 70) {
      missions.holdTime += dt;
      if (missions.holdTime >= (step.holdSeconds || 2)) {
        missions.holdTime = 0;
        if (missions.index === 1 && missions.step === 1) {
          addHeat(state, 110, 'spotted at the pickup');
          flashMessage(state, 'The package is hot — the police are coming!');
        }
        if (missions.index === 2 && missions.step === 2) {
          addHeat(state, 200, 'crate grabbed at the harbor');
          flashMessage(state, 'Crate secured — lose the heat at Casa Verde!');
        }
        advanceStep(state, mission);
      }
    } else {
      missions.holdTime = 0;
    }
  } else if (step.kind === 'steal') {
    if (player.inCar) advanceStep(state, mission);
  } else if (step.kind === 'eliminate') {
    const alive = state.guards.filter((guard) => guard.health > 0).length;
    missions.guardsLeft = alive;
    if (alive === 0) advanceStep(state, mission);
  }
}

function advanceStep(state, mission) {
  const missions = state.missions;
  missions.step += 1;
  missions.holdTime = 0;
  const step = mission.steps[missions.step];
  if (step && step.kind === 'eliminate') {
    spawnGuards(state, 4);
    missions.guardsLeft = 4;
    flashMessage(state, 'Dock guards on the pier — clear them out!');
  }
  if (missions.step >= mission.steps.length) {
    // The job is done: pay up and open the next one.
    state.player.cash += mission.reward;
    state.stats.missionsDone += 1;
    state.audio.cash();
    flashMessage(state, `${mission.title} complete — $${mission.reward} earned!`);
    state.events.push({ type: 'mission-complete', mission });
    missions.index += 1;
    missions.step = 0;
    missions.holdTime = 0;
    if (missions.index >= MISSIONS.length) {
      missions.done = true;
      state.events.push({ type: 'story-complete' });
    } else {
      flashMessage(state, `${MISSIONS[missions.index].title}: ${MISSIONS[missions.index].intro}`);
    }
  }
}

/** Wall-clock projection for the coach demo. It does not certify physical effort. */
export type RunState = {
  status: 'ready' | 'running' | 'paused' | 'completed' | 'interrupted';
  elapsedMs: number;
  startedAt: number | null;
};

export type Timing = { workSeconds: number; restSeconds: number };
export type RunProjection = {
  status: RunState['status'];
  elapsedMs: number;
  totalMs: number;
  round: number;
  phase: 'ready' | 'work' | 'rest' | 'completed' | 'interrupted';
  phaseRemainingMs: number;
};
export type RunAction = 'start' | 'pause' | 'resume' | 'interrupt';

export function createRunState(): RunState {
  return { status: 'ready', elapsedMs: 0, startedAt: null };
}

export class RunError extends Error {
  code: 'INVALID_INPUT' | 'INVALID_TRANSITION';

  constructor(code: RunError['code'], message: string) {
    super(message);
    this.name = 'RunError';
    this.code = code;
  }
}

export function validateTiming(value: unknown): Timing {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RunError('INVALID_INPUT', 'Timing must contain workSeconds and restSeconds.');
  }
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length !== 2 || !keys.includes('workSeconds') || !keys.includes('restSeconds') ||
    typeof input.workSeconds !== 'number' || !Number.isInteger(input.workSeconds) || input.workSeconds < 5 || input.workSeconds > 300 ||
    typeof input.restSeconds !== 'number' || !Number.isInteger(input.restSeconds) || input.restSeconds < 0 || input.restSeconds > 120) {
    throw new RunError('INVALID_INPUT', 'Work must be 5–300 seconds and rest 0–120 seconds, as whole numbers.');
  }
  return { workSeconds: input.workSeconds, restSeconds: input.restSeconds };
}

export function durationMs(timing: Timing): number {
  const valid = validateTiming(timing);
  return (12 * valid.workSeconds + 11 * valid.restSeconds) * 1000;
}

/** Callers supply trusted server time; elapsed time is never supplied by a command. */
export function projectRun(state: RunState, timing: Timing, now: number): RunProjection {
  const totalMs = durationMs(timing);
  if (!Number.isFinite(now) || now < 0 || !Number.isFinite(state.elapsedMs) || state.elapsedMs < 0 ||
    !['ready', 'running', 'paused', 'completed', 'interrupted'].includes(state.status) ||
    (state.status === 'running' ? (typeof state.startedAt !== 'number' || !Number.isFinite(state.startedAt) || state.startedAt < 0) : state.startedAt !== null)) {
    throw new RunError('INVALID_INPUT', 'Invalid persisted run state or server time.');
  }
  const delta = state.status === 'running' ? Math.max(0, now - state.startedAt!) : 0;
  const elapsedMs = state.status === 'completed' ? totalMs : Math.min(totalMs, state.elapsedMs + delta);
  const status = state.status === 'running' && elapsedMs >= totalMs ? 'completed' : state.status;
  const base = { status, elapsedMs, totalMs };
  if (status === 'ready') return { ...base, round: 1, phase: 'ready', phaseRemainingMs: timing.workSeconds * 1000 };
  if (status === 'completed') return { ...base, round: 12, phase: 'completed', phaseRemainingMs: 0 };
  const cycleMs = (timing.workSeconds + timing.restSeconds) * 1000;
  const round = Math.min(12, Math.floor(elapsedMs / cycleMs) + 1);
  if (status === 'interrupted') return { ...base, round, phase: 'interrupted', phaseRemainingMs: 0 };
  const offsetMs = elapsedMs - (round - 1) * cycleMs;
  const workMs = timing.workSeconds * 1000;
  const phase = offsetMs < workMs ? 'work' : 'rest';
  return { ...base, round, phase, phaseRemainingMs: Math.max(0, (phase === 'work' ? workMs : cycleMs) - offsetMs) };
}

export function transitionRun(state: RunState, timing: Timing, action: RunAction, now: number): RunState {
  const current = projectRun(state, timing, now);
  if (current.status === 'completed' || current.status === 'interrupted') {
    throw new RunError('INVALID_TRANSITION', 'This run has ended.');
  }
  if (action === 'start' && current.status === 'ready') return { status: 'running', elapsedMs: 0, startedAt: now };
  if (action === 'pause' && current.status === 'running') return { status: 'paused', elapsedMs: current.elapsedMs, startedAt: null };
  if (action === 'resume' && current.status === 'paused') return { status: 'running', elapsedMs: current.elapsedMs, startedAt: now };
  if (action === 'interrupt') return { status: 'interrupted', elapsedMs: current.elapsedMs, startedAt: null };
  throw new RunError('INVALID_TRANSITION', `Cannot ${action} a ${current.status} run.`);
}

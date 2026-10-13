import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { RunError, durationMs, projectRun, transitionRun, validateTiming } from '../lib/class-run.ts';
import type { RunAction, RunState } from '../lib/class-run';

const timing = { workSeconds: 10, restSeconds: 5 };
const ready: RunState = { status: 'ready', elapsedMs: 0, startedAt: null };
const started: RunState = { status: 'running', elapsedMs: 0, startedAt: 1000 };
function rejects(action: () => unknown, code: RunError['code']) {
  assert.throws(action, (error: unknown) => error instanceof RunError && error.code === code);
}

test('12 work rounds include only 11 rests, with precise work/rest/next-round boundaries', () => {
  assert.equal(durationMs(timing), 175000);
  assert.deepEqual(projectRun(ready, timing, 0), { status: 'ready', elapsedMs: 0, totalMs: 175000, round: 1, phase: 'ready', phaseRemainingMs: 10000 });
  assert.deepEqual(projectRun(started, timing, 10999), { status: 'running', elapsedMs: 9999, totalMs: 175000, round: 1, phase: 'work', phaseRemainingMs: 1 });
  assert.deepEqual(projectRun(started, timing, 11000), { status: 'running', elapsedMs: 10000, totalMs: 175000, round: 1, phase: 'rest', phaseRemainingMs: 5000 });
  assert.deepEqual(projectRun(started, timing, 16000), { status: 'running', elapsedMs: 15000, totalMs: 175000, round: 2, phase: 'work', phaseRemainingMs: 10000 });
  assert.equal(projectRun(started, timing, 175999).phaseRemainingMs, 1);
  assert.deepEqual(projectRun(started, timing, 176000), { status: 'completed', elapsedMs: 175000, totalMs: 175000, round: 12, phase: 'completed', phaseRemainingMs: 0 });
});

test('zero rest moves directly to the next round without a phantom rest', () => {
  const continuous = { workSeconds: 5, restSeconds: 0 };
  assert.equal(durationMs(continuous), 60000);
  const next = projectRun(started, continuous, 6000);
  assert.equal(next.phase, 'work'); assert.equal(next.round, 2); assert.equal(next.phaseRemainingMs, 5000);
  assert.equal(projectRun(started, continuous, 61000).phase, 'completed');
});

test('pause freezes elapsed time and resume preserves it while anchoring a new server time', () => {
  const state = transitionRun(ready, timing, 'start', 1000);
  const paused = transitionRun(state, timing, 'pause', 13000);
  assert.deepEqual(paused, { status: 'paused', elapsedMs: 12000, startedAt: null });
  assert.deepEqual(projectRun(paused, timing, 13000), projectRun(paused, timing, 900000));
  const resumed = transitionRun(paused, timing, 'resume', 900000);
  assert.deepEqual(resumed, { status: 'running', elapsedMs: 12000, startedAt: 900000 });
  assert.equal(projectRun(resumed, timing, 903000).round, 2);
  assert.deepEqual(ready, { status: 'ready', elapsedMs: 0, startedAt: null });
});

test('reloads and forward time jumps recover progress from persisted anchors', () => {
  const reloaded = JSON.parse(JSON.stringify(started)) as RunState;
  assert.equal(projectRun(reloaded, timing, 91000).round, 7);
  assert.equal(projectRun(reloaded, timing, 100000000).elapsedMs, durationMs(timing));
  assert.equal(projectRun(reloaded, timing, 0).elapsedMs, 0);
  assert.equal(projectRun({ ...started, elapsedMs: 4000 }, timing, 0).elapsedMs, 4000);
});

test('interrupt freezes current progress for all nonterminal states', () => {
  for (const state of [ready, started, { status: 'paused', elapsedMs: 11000, startedAt: null } as RunState]) {
    const interrupted = transitionRun(state, timing, 'interrupt', 15000);
    assert.equal(interrupted.status, 'interrupted');
    assert.equal(interrupted.startedAt, null);
    assert.deepEqual(projectRun(interrupted, timing, 15000), projectRun(interrupted, timing, 900000));
    assert.equal(projectRun(interrupted, timing, 900000).phaseRemainingMs, 0);
  }
});

test('terminal and wall-clock-completed runs reject all commands', () => {
  const actions: RunAction[] = ['start', 'pause', 'resume', 'interrupt'];
  const states: RunState[] = [
    started,
    { status: 'completed', elapsedMs: durationMs(timing), startedAt: null },
    { status: 'interrupted', elapsedMs: 12000, startedAt: null },
  ];
  for (const state of states) for (const action of actions) rejects(() => transitionRun(state, timing, action, 176000), 'INVALID_TRANSITION');
});

test('invalid state transitions cannot start twice, resume running, or pause ready', () => {
  for (const action of ['pause', 'resume'] as RunAction[]) rejects(() => transitionRun(ready, timing, action, 1000), 'INVALID_TRANSITION');
  for (const action of ['start', 'resume'] as RunAction[]) rejects(() => transitionRun(started, timing, action, 2000), 'INVALID_TRANSITION');
  const paused = transitionRun(started, timing, 'pause', 2000);
  for (const action of ['start', 'pause'] as RunAction[]) rejects(() => transitionRun(paused, timing, action, 3000), 'INVALID_TRANSITION');
  rejects(() => transitionRun(ready, timing, 'other' as RunAction, 1000), 'INVALID_TRANSITION');
});

test('timing validation accepts bounds and rejects malformed values and unknown fields', () => {
  for (const value of [{ workSeconds: 5, restSeconds: 0 }, { workSeconds: 300, restSeconds: 120 }]) {
    assert.deepEqual(validateTiming(value), value); assert.notEqual(validateTiming(value), value);
  }
  const invalid: unknown[] = [null, [], {}, { workSeconds: 10 }, { ...timing, rounds: 10 }];
  for (const workSeconds of [4, 301, 5.5, NaN, Infinity, '10', null]) invalid.push({ ...timing, workSeconds });
  for (const restSeconds of [-1, 121, 0.5, NaN, Infinity, '5', null]) invalid.push({ ...timing, restSeconds });
  for (const value of invalid) rejects(() => validateTiming(value), 'INVALID_INPUT');
});

test('invalid persisted anchors or server time fail instead of returning NaN projections', () => {
  for (const now of [NaN, Infinity, -1]) rejects(() => projectRun(started, timing, now), 'INVALID_INPUT');
  for (const patch of [{ elapsedMs: -1 }, { elapsedMs: NaN }, { startedAt: null }, { startedAt: Infinity }, { status: 'invented' }]) {
    rejects(() => projectRun({ ...started, ...patch } as RunState, timing, 2000), 'INVALID_INPUT');
  }
  rejects(() => projectRun({ ...ready, startedAt: 1000 }, timing, 2000), 'INVALID_INPUT');
});

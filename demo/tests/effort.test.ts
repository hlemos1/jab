import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { generateSession, isSessionId, validateSession, STATIONS } from '../lib/effort.ts';

test('synthetic session is deterministic with an illustrative nonuniform journey', () => {
  const input = generateSession('test-session', 123);
  assert.deepEqual(input, generateSession('test-session', 123));
  const visits = STATIONS.map((station: string) => input.rounds.filter((round: { station: string }) => round.station === station).length);
  assert.deepEqual(visits, [3, 3, 3, 1, 1, 1]);
  assert.equal(input.rounds.at(-1)?.endMs, 72_000);
  const result = validateSession(input);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.score > 0 && result.score <= 100);
  assert.equal(result.reward, Math.floor(result.score / 5));
  assert.equal(result.rulesVersion, 'demo-1.1.0');
});

test('accepts a different nonuniform journey without requiring all-station coverage', () => {
  const input = generateSession('alternate-journey');
  for (const round of input.rounds) round.station = round.id % 2 ? 'volume' : 'technique';
  for (const event of input.events) event.station = input.rounds[event.roundId - 1].station;
  assert.equal(validateSession(input).valid, true);
});

test('rejects consecutive identical stations even when their events match', () => {
  rejected((input) => {
    input.rounds[1].station = input.rounds[0].station;
    for (const event of input.events) if (event.roundId === 2) event.station = input.rounds[1].station;
  });
});

function rejected(mutate: (input: ReturnType<typeof generateSession>) => unknown) {
  const input = generateSession('test-session');
  mutate(input);
  const result = validateSession(input);
  assert.equal(result.valid, false);
  assert.equal(result.reward, 0);
  assert.equal(result.score, 0);
  assert.ok(result.errors.length > 0);
}

test('rejects malformed and extra-field inputs without throwing', () => {
  for (const input of [null, undefined, 1, 'session', [], {}, { rounds: [], events: [] }]) assert.equal(validateSession(input).valid, false);
  assert.equal(validateSession({ ...generateSession('test-session'), reward: 1000 }).valid, false);
});
test('rejects all nonfinite and out-of-range numeric values', () => {
  for (const bad of [NaN, Infinity, -Infinity, -0.1, 1.01]) rejected((input) => { input.events[0].accuracy = bad; });
  rejected((input) => { input.events[0].intensity = NaN; });
  rejected((input) => { input.events[0].roundId = NaN; });
});
test('rejects wrong round, station, source and cross-session events', () => {
  rejected((input) => { input.events[0].roundId = 2; });
  rejected((input) => { input.events[0].station = 'vr'; });
  rejected((input) => { input.events[0].sessionId = 'another-session'; });
  rejected((input) => { input.rounds[0].station = 'reflex'; });
  assert.equal(validateSession({ ...generateSession('test-session'), source: 'sensor' }).valid, false);
});
test('rejects duplicate event identifiers and equal or reversed timestamps', () => {
  rejected((input) => { input.events[1].id = input.events[0].id; });
  rejected((input) => { input.events[1].timestampMs = input.events[0].timestampMs; });
  rejected((input) => { [input.events[0], input.events[1]] = [input.events[1], input.events[0]]; });
});
test('round windows are half-open; invalid times and gaps cannot claim rewards', () => {
  for (const bad of [-1, 6000, NaN, Infinity, 0.5]) rejected((input) => { input.events[0].timestampMs = bad; });
  rejected((input) => { input.events = input.events.filter((event: { roundId: number }) => event.roundId !== 12); });
  rejected((input) => { input.rounds[1].startMs = 6001; });
});
test('score is bounded and stable across replay seeds', () => {
  for (let seed = 0; seed < 100; seed++) {
    const result = validateSession(generateSession('seed-session', seed));
    assert.equal(result.valid, true);
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.ok(result.reward >= 0 && result.reward <= 20);
  }
});
test('maximum supported session identifier remains valid in generated events', () => {
  assert.equal(validateSession(generateSession('a'.repeat(100))).valid, true);
  assert.throws(() => generateSession('a'.repeat(101)));
  assert.throws(() => generateSession('test-session', Infinity));
});

test('session identifiers use the same bounded public contract as persistence', () => {
  for (const id of ['a'.repeat(8), 'a'.repeat(100), '_session-01']) {
    assert.equal(isSessionId(id), true);
    const input = generateSession(id);
    assert.equal(validateSession(input).valid, true);
    assert.ok(input.events.every((event: { id: string }) => event.id.includes(':')));
  }
  for (const id of ['a'.repeat(7), 'a'.repeat(101), 'session:01']) {
    assert.equal(isSessionId(id), false);
    assert.throws(() => generateSession(id));
    const input = generateSession('test-session');
    input.sessionId = id;
    for (const event of input.events) event.sessionId = id;
    const result = validateSession(input);
    assert.equal(result.valid, false);
    assert.equal(result.score, 0);
    assert.equal(result.reward, 0);
    assert.ok(result.errors.includes('Invalid session identifier.'));
  }
  for (const value of [null, undefined, 12345678, {}]) assert.equal(isSessionId(value), false);
});

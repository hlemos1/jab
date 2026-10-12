import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Native TypeScript runner requires the extension.
import { availableRounds, buildReport, canonicalReportJSON, ReportError, validateParticipants, verifyReport } from '../lib/class-report.ts';
// @ts-expect-error Native TypeScript runner requires the extension.
import { planClass } from '../lib/class-planner.ts';
// @ts-expect-error Native TypeScript runner requires the extension.
import { durationMs } from '../lib/class-run.ts';
import type { ParticipantInput, ReportRun } from '../lib/class-report';
import type { RunState } from '../lib/class-run';
const timing = { workSeconds: 10, restSeconds: 5 };
const timestamp = '2026-10-12T20:00:00.000Z';
const input = { name: 'Turma teste', athletes: [{ id: 'ana', name: 'Ana', excludedStations: [] }, { id: 'bruno', name: 'Bruno', excludedStations: [] }] };
function run(elapsedMs = durationMs(timing), status: RunState['status'] = 'completed'): ReportRun {
  return { id: 'run-id', planId: 'plan-id', createdAt: timestamp, updatedAt: timestamp, revision: 4, input: structuredClone(input), plan: planClass(input, 42), timing: { ...timing }, state: { status, elapsedMs, startedAt: null } };
}
const declared: ParticipantInput[] = [{ athleteId: 'ana', status: 'completed', roundsCompleted: 12 }, { athleteId: 'bruno', status: 'partial', roundsCompleted: 5 }];
function rejects(value: unknown, fixture = run(), code = 'INVALID_INPUT') { assert.throws(() => validateParticipants(value, fixture), (error: unknown) => error instanceof ReportError && error.code === code); }

test('available rounds count completed work, not rest or a partly elapsed work interval', () => {
  const state = (elapsedMs: number): RunState => ({ status: 'interrupted', elapsedMs, startedAt: null });
  for (const [elapsed, expected] of [[0, 0], [9999, 0], [10000, 1], [14999, 1], [15000, 1], [24999, 1], [25000, 2], [174999, 11], [175000, 12]]) assert.equal(availableRounds(state(elapsed), timing), expected);
  assert.equal(availableRounds(state(5000), { workSeconds: 5, restSeconds: 0 }), 1);
  assert.equal(availableRounds(state(60000), { workSeconds: 5, restSeconds: 0 }), 12);
});

test('an interruption before starting permits only absence', () => {
  const fixture = run(0, 'interrupted');
  const absent = input.athletes.map(athlete => ({ athleteId: athlete.id, status: 'absent', roundsCompleted: 0 }));
  assert.deepEqual(validateParticipants(absent, fixture), absent);
  rejects([{ ...absent[0], status: 'partial', roundsCompleted: 0 }, absent[1]], fixture);
  rejects([{ ...absent[0], status: 'partial', roundsCompleted: 1 }, absent[1]], fixture);
  rejects(declared, fixture);
});

test('partial participation can declare zero completed rounds after any elapsed class time', async () => {
  const participants: ParticipantInput[] = [{ athleteId: 'ana', status: 'partial', roundsCompleted: 0 }, { athleteId: 'bruno', status: 'absent', roundsCompleted: 0 }];
  for (const elapsed of [1, 9999, 10000]) {
    const fixture = run(elapsed, 'interrupted');
    assert.deepEqual(validateParticipants(participants, fixture), participants);
    const report = await buildReport(fixture, participants, timestamp);
    assert.equal(report.payload.participants[0].status, 'partial');
    assert.equal(report.payload.participants[0].roundsCompleted, 0);
    assert.equal(await verifyReport(report), true);
  }
  rejects([{ ...participants[0], roundsCompleted: 1 }, participants[1]], run(9999, 'interrupted'));
  assert.deepEqual(validateParticipants(participants, run()), participants);
});

test('declared participation respects elapsed bounds and canonical roster order', () => {
  assert.deepEqual(validateParticipants([...declared].reverse(), run()), declared);
  const partial = [{ athleteId: 'ana', status: 'partial', roundsCompleted: 2 }, { athleteId: 'bruno', status: 'absent', roundsCompleted: 0 }];
  assert.deepEqual(validateParticipants(partial, run(25000, 'interrupted')), partial);
  rejects([{ ...partial[0], roundsCompleted: 3 }, partial[1]], run(25000, 'interrupted'));
  for (const patch of [{ status: 'completed', roundsCompleted: 11 }, { status: 'partial', roundsCompleted: -1 }, { status: 'partial', roundsCompleted: 12 }, { status: 'absent', roundsCompleted: 1 }, { status: 'invented', roundsCompleted: 1 }, { roundsCompleted: 1.5 }, { roundsCompleted: NaN }, { roundsCompleted: '12' }]) rejects([{ ...declared[0], ...patch }, declared[1]]);
});

test('roster must be exact, known, unique and have no undeclared input fields', () => {
  for (const value of [null, {}, [], [declared[0]], [declared[0], declared[0]], [declared[0], { ...declared[1], athleteId: 'unknown' }], [declared[0], { ...declared[1], name: 'Injected name' }], [declared[0], { athleteId: 'bruno', status: 'absent' }]]) rejects(value);
  for (const status of ['ready', 'paused', 'running'] as RunState['status'][]) rejects(declared, run(0, status), 'RUN_NOT_ENDED');
});

test('reports hash canonical payloads independently of submitted order and snapshot original run', async () => {
  const fixture = run();
  const first = await buildReport(fixture, declared, timestamp);
  const second = await buildReport(fixture, [...declared].reverse(), timestamp);
  assert.deepEqual(first, second);
  assert.equal(first.id, fixture.id); assert.equal(first.payload.source, 'demo_declared'); assert.equal(first.payload.availableRounds, 12);
  assert.equal(first.payload.participants[0].name, 'Ana'); assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(await verifyReport(first), true);
  fixture.input.athletes[0].name = 'Changed'; fixture.plan.rounds[0].assignments[0].station = 'vr';
  assert.equal(first.payload.run.input.athletes[0].name, 'Ana'); assert.equal(await verifyReport(first), true);
  assert.equal(await verifyReport(JSON.parse(JSON.stringify(first))), true);
});

test('canonical JSON sorts nested object keys while preserving array order', () => {
  assert.equal(canonicalReportJSON({ z: [{ b: 2, a: 1 }, 3], a: true }), '{"a":true,"z":[{"a":1,"b":2},3]}');
  assert.notEqual(canonicalReportJSON([1, 2]), canonicalReportJSON([2, 1]));
  for (const value of [undefined, NaN, Infinity, BigInt(1), new Date(), { a: undefined }, [, 1]]) assert.throws(() => canonicalReportJSON(value), ReportError);
});

test('verification rejects tampered data, hashes, envelope, provenance and extra fields', async () => {
  const original = await buildReport(run(), declared, timestamp);
  const mutations: ((report: any) => void)[] = [
    report => { report.payload.participants[0].roundsCompleted = 11; },
    report => { report.hash = '0'.repeat(64); },
    report => { report.id = 'other'; },
    report => { report.createdAt = '2026-10-13T20:00:00.000Z'; },
    report => { report.payload.availableRounds = 11; },
    report => { report.payload.source = 'sensor'; },
    report => { report.payload.participants[0].name = 'Other name'; },
    report => { report.payload.participants.reverse(); },
    report => { report.verified = true; },
    report => { report.payload.run.state.status = 'running'; },
  ];
  for (const mutate of mutations) { const altered = structuredClone(original); mutate(altered); assert.equal(await verifyReport(altered), false); }
  for (const malformed of [null, {}, [], { ...original, payload: null }]) assert.equal(await verifyReport(malformed), false);
});

test('recomputed hashes cannot make malformed or inconsistent report snapshots valid', async () => {
  const original = await buildReport(run(), declared, timestamp);
  for (const mutate of [
    (report: any) => { report.payload.run.plan.rounds[0].assignments[0].athleteId = 'unknown'; },
    (report: any) => { report.payload.run.state.elapsedMs = 0; },
    (report: any) => { report.payload.participants[0].name = 'Forgery'; },
    (report: any) => { report.payload.run.plan.capacities.volume = 99; },
    (report: any) => { report.payload.run.unknownField = 'ignored?'; },
  ]) {
    const altered = structuredClone(original); mutate(altered);
    altered.hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalReportJSON(altered.payload)))).toString('hex');
    assert.equal(await verifyReport(altered), false);
  }
});

test('report timestamps and terminal clocks must be consistent with saved run', async () => {
  await assert.rejects(buildReport(run(), declared, 'yesterday'), ReportError);
  await assert.rejects(buildReport(run(), declared, '2026-10-11T20:00:00.000Z'), ReportError);
  await assert.rejects(buildReport(run(0), declared, timestamp), ReportError);
  const absent = input.athletes.map(athlete => ({ athleteId: athlete.id, status: 'absent', roundsCompleted: 0 }));
  const report = await buildReport(run(0, 'interrupted'), absent, timestamp);
  assert.equal(report.payload.availableRounds, 0); assert.equal(await verifyReport(report), true);
});

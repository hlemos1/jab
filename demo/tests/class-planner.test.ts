import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { CAPACITIES, PLANNER_VERSION, PlannerError, validateClassInput, planClass } from '../lib/class-planner.ts';
import type { ClassInput, ClassPlan } from '../lib/class-planner';
import type { StationId } from '../lib/effort';

const stations = Object.keys(CAPACITIES) as StationId[];
function roster(size: number): ClassInput {
  return { name: 'Morning class', athletes: Array.from({ length: size }, (_, index) => ({ id: `athlete-${index}`, name: `Athlete ${index + 1}`, excludedStations: [] })) };
}
function check(input: ClassInput, plan: ClassPlan) {
  assert.equal(plan.rulesVersion, PLANNER_VERSION);
  assert.deepEqual(plan.capacities, CAPACITIES);
  assert.equal(plan.rounds.length, 12);
  const previous = new Map<string, StationId>();
  plan.rounds.forEach((round, index) => {
    assert.equal(round.round, index + 1);
    assert.equal(round.assignments.length, input.athletes.length);
    assert.deepEqual(round.assignments.map((entry) => entry.athleteId).sort(), input.athletes.map((athlete) => athlete.id).sort());
    for (const station of stations) assert.ok(round.assignments.filter((entry) => entry.station === station).length <= CAPACITIES[station], `Capacity exceeded at ${station}, round ${round.round}`);
    for (const entry of round.assignments) {
      assert.ok(stations.includes(entry.station));
      const athlete = input.athletes.find((athlete) => athlete.id === entry.athleteId)!;
      assert.ok(!athlete.excludedStations.includes(entry.station));
      assert.notEqual(entry.station, previous.get(entry.athleteId), `Consecutive repeat for ${entry.athleteId}`);
      previous.set(entry.athleteId, entry.station);
    }
  });
}
function failure(action: () => unknown, code: PlannerError['code']) {
  assert.throws(action, (error: unknown) => error instanceof PlannerError && error.code === code);
}

test('every supported roster size respects capacities and no consecutive repeats across seeds', () => {
  for (let size = 1; size <= 11; size++) for (const seed of [0, 1, 7, 42, 1234, 0xffffffff]) check(roster(size), planClass(roster(size), seed));
});

test('planning is deterministic and does not mutate the input or global capacities', () => {
  const input = roster(11);
  const original = structuredClone(input);
  const first = planClass(input, 42);
  assert.deepEqual(first, planClass(input, 42));
  assert.deepEqual(input, original);
  assert.notDeepEqual(first, planClass(input, 81));
  first.capacities.volume = 999;
  assert.equal(CAPACITIES.volume, 3);
});

test('manual exclusions are honored without requiring every athlete to visit every station', () => {
  const input = roster(6);
  for (const athlete of input.athletes) athlete.excludedStations = ['power', 'speed', 'vr', 'reflex'];
  for (let seed = 0; seed < 20; seed++) {
    const plan = planClass(input, seed);
    check(input, plan);
    assert.ok(plan.rounds.every((round) => round.assignments.every((entry) => entry.station === 'volume' || entry.station === 'technique')));
  }
});

test('full class can plan through heterogeneous tight exclusions', () => {
  const input = roster(11);
  // Construct a feasible pair: each station appears according to capacity;
  // the shifted second round avoids repeats. Restrict everyone to that pair.
  const first: StationId[] = ['volume', 'volume', 'volume', 'technique', 'technique', 'technique', 'power', 'power', 'speed', 'vr', 'reflex'];
  input.athletes.forEach((athlete, index) => {
    const second = first[(index + 3) % first.length];
    athlete.excludedStations = stations.filter((station) => station !== first[index] && station !== second);
  });
  for (let seed = 0; seed < 30; seed++) check(input, planClass(input, seed));
});

test('infeasibility is proven for zero/one eligible station and aggregate capacity bottlenecks', () => {
  for (const exclusions of [stations, stations.filter((station) => station !== 'volume')]) {
    const input = roster(1);
    input.athletes[0].excludedStations = exclusions;
    failure(() => planClass(input, 42), 'INFEASIBLE');
  }
  const blocked = roster(3);
  blocked.athletes.forEach((athlete) => { athlete.excludedStations = stations.filter((station) => station !== 'vr' && station !== 'reflex'); });
  failure(() => planClass(blocked, 42), 'INFEASIBLE');
  const alternatingBottleneck = roster(5);
  alternatingBottleneck.athletes.forEach((athlete) => { athlete.excludedStations = stations.filter((station) => station !== 'volume' && station !== 'power'); });
  // One round can fit five, but five athletes cannot all alternate into power
  // across two rounds because it has only four total available positions.
  failure(() => planClass(alternatingBottleneck, 42), 'INFEASIBLE');
});

test('validator normalizes names and exclusion ordering into independent data', () => {
  const input = roster(1);
  input.name = '  Class  ';
  input.athletes[0].name = '  Ana  ';
  input.athletes[0].excludedStations = ['reflex', 'power'];
  const normalized = validateClassInput(input);
  assert.equal(normalized.name, 'Class');
  assert.equal(normalized.athletes[0].name, 'Ana');
  assert.deepEqual(normalized.athletes[0].excludedStations, ['power', 'reflex']);
  normalized.athletes[0].excludedStations.push('speed');
  assert.deepEqual(input.athletes[0].excludedStations, ['reflex', 'power']);
});

test('rejects malformed, oversized, duplicate, forged and unknown input fields', () => {
  const invalid: unknown[] = [null, [], {}, roster(0), roster(12), { ...roster(1), name: '' }, { ...roster(1), name: 'x'.repeat(81) }, { ...roster(1), reward: 999 }, { ...roster(1), name: 'bad\nname' }];
  const duplicate = roster(2); duplicate.athletes[1].id = duplicate.athletes[0].id; invalid.push(duplicate);
  for (const patch of [{ id: '../../admin' }, { name: '' }, { name: 'x'.repeat(61) }, { excludedStations: ['unknown'] }, { excludedStations: ['vr', 'vr'] }, { excludedStations: 'vr' }, { role: 'coach' }]) invalid.push({ ...roster(1), athletes: [{ ...roster(1).athletes[0], ...patch }] });
  for (const input of invalid) failure(() => validateClassInput(input), 'INVALID_INPUT');
  for (const seed of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) failure(() => planClass(roster(1), seed), 'INVALID_INPUT');
});

test('small eligibility cases agree with an independent exhaustive two-round oracle', () => {
  const choices: StationId[][] = [['speed', 'vr'], ['speed', 'vr', 'reflex'], ['volume', 'speed'], ['volume', 'vr'], ['volume', 'technique']];
  function feasible(input: ClassInput): boolean {
    const allocations: StationId[][] = [];
    function visit(current: StationId[]) {
      if (current.length === input.athletes.length) { allocations.push(current.slice()); return; }
      for (const station of stations) {
        if (!input.athletes[current.length].excludedStations.includes(station) && current.filter((entry) => entry === station).length < CAPACITIES[station]) visit([...current, station]);
      }
    }
    visit([]);
    return allocations.some((a) => allocations.some((b) => a.every((station, index) => station !== b[index])));
  }
  for (let scenario = 0; scenario < 125; scenario++) {
    const input = roster(3);
    input.athletes.forEach((athlete, index) => { const eligible = choices[Math.floor(scenario / 5 ** index) % 5]; athlete.excludedStations = stations.filter((station) => !eligible.includes(station)); });
    if (feasible(input)) check(input, planClass(input, scenario));
    else failure(() => planClass(input, scenario), 'INFEASIBLE');
  }
});

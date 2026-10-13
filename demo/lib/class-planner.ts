/**
 * Public class-planning demonstration, not StrikeX's proprietary Solver.
 * Implements capacity, manual exclusions and no consecutive station repeats.
 * Variety is a preference, never a promise of universal station coverage.
 */
import type { StationId } from './effort';

const STATIONS: readonly StationId[] = ['volume', 'technique', 'power', 'speed', 'vr', 'reflex'];
export const PLANNER_VERSION = 'class-demo-1.0.0';
export const CAPACITIES: Readonly<Record<StationId, number>> = Object.freeze({
  volume: 3, technique: 3, power: 2, speed: 1, vr: 1, reflex: 1,
});
export type Athlete = { id: string; name: string; excludedStations: StationId[] };
export type ClassInput = { name: string; athletes: Athlete[] };
export type ClassPlan = {
  rulesVersion: string;
  capacities: Record<StationId, number>;
  rounds: { round: number; assignments: { athleteId: string; station: StationId }[] }[];
};
export class PlannerError extends Error {
  code: 'INVALID_INPUT' | 'INFEASIBLE' | 'SEARCH_LIMIT';
  constructor(code: PlannerError['code'], message: string) {
    super(message);
    this.name = 'PlannerError';
    this.code = code;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}
function invalid(message: string): never {
  throw new PlannerError('INVALID_INPUT', message);
}
function name(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > max || /[\u0000-\u001f\u007f]/u.test(value)) {
    return invalid(`Names must contain 1–${max} characters without control characters.`);
  }
  return value.trim();
}
export function validateClassInput(value: unknown): ClassInput {
  if (!record(value) || !keys(value, ['name', 'athletes'])) invalid('Expected class name and athletes.');
  const className = name(value.name, 80);
  if (!Array.isArray(value.athletes) || value.athletes.length < 1 || value.athletes.length > 11) invalid('A class needs 1–11 athletes.');
  const identifiers = new Set<string>();
  const athletes = value.athletes.map((athlete): Athlete => {
    if (!record(athlete) || !keys(athlete, ['id', 'name', 'excludedStations'])) invalid('Invalid athlete fields.');
    const id = athlete.id;
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id) || identifiers.has(id)) invalid('Athlete identifiers must be unique and valid.');
    identifiers.add(id);
    const exclusions = athlete.excludedStations;
    if (!Array.isArray(exclusions) || exclusions.length > STATIONS.length || exclusions.some((station) => !STATIONS.includes(station)) || new Set(exclusions).size !== exclusions.length) invalid('Exclusions must be distinct known stations.');
    return { id, name: name(athlete.name, 60), excludedStations: STATIONS.filter((station) => exclusions.includes(station)) };
  });
  return { name: className, athletes };
}

type Edge = { to: number; reverse: number; remaining: number; cost: number };
/** Exact integral min-cost flow; at most 22 augmentations on 19 vertices. */
function allocate(
  athletes: Athlete[], count: 1 | 2, previous: StationId[] | undefined,
  exposure: number[][], random: () => number,
): StationId[][] | null {
  const firstStation = athletes.length + 1;
  const sink = firstStation + STATIONS.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const add = (from: number, to: number, capacity: number, cost: number): Edge => {
    const forward = { to, reverse: graph[to].length, remaining: capacity, cost };
    graph[from].push(forward);
    graph[to].push({ to: from, reverse: graph[from].length - 1, remaining: 0, cost: -cost });
    return forward;
  };
  const choices = athletes.map((athlete, index) => {
    add(0, index + 1, count, 0);
    return STATIONS.map((station, stationIndex) => {
      if (athlete.excludedStations.includes(station) || previous?.[index] === station) return null;
      return add(index + 1, firstStation + stationIndex, 1, exposure[index][stationIndex] * 100 + Math.floor(random() * 32));
    });
  });
  STATIONS.forEach((station, index) => add(firstStation + index, sink, CAPACITIES[station] * count, 0));
  for (let sent = 0; sent < athletes.length * count; sent++) {
    const distance = Array<number>(graph.length).fill(Infinity);
    const path = Array<{ from: number; edgeIndex: number } | undefined>(graph.length);
    distance[0] = 0;
    // Bellman–Ford handles reverse edges' negative costs without assumptions
    // about heuristic weights. All iteration counts depend only on roster size.
    for (let pass = 0; pass < graph.length - 1; pass++) {
      let changed = false;
      graph.forEach((edges, from) => edges.forEach((edge, edgeIndex) => {
        if (edge.remaining > 0 && distance[from] + edge.cost < distance[edge.to]) {
          distance[edge.to] = distance[from] + edge.cost;
          path[edge.to] = { from, edgeIndex };
          changed = true;
        }
      }));
      if (!changed) break;
    }
    if (!path[sink]) return null;
    for (let at = sink; at !== 0;) {
      const step = path[at]!;
      const edge = graph[step.from][step.edgeIndex];
      edge.remaining--;
      graph[at][edge.reverse].remaining++;
      at = step.from;
    }
  }
  return choices.map((edges) => STATIONS.filter((_, index) => edges[index]?.remaining === 0));
}

/**
 * Each athlete is an edge joining their two distinct selected stations.
 * Euler orientation balances each station's incoming/outgoing athletes, so
 * each of the two rounds uses at most ceil(degree/2) <= station capacity.
 * Dummy edges make odd degrees even and are omitted from the assignments.
 */
function splitPair(pairs: StationId[][]): [StationId[], StationId[]] {
  const dummy = STATIONS.length;
  const graph: { other: number; edge: number }[][] = Array.from({ length: dummy + 1 }, () => []);
  let edgeCount = 0;
  const add = (a: number, b: number) => {
    graph[a].push({ other: b, edge: edgeCount });
    graph[b].push({ other: a, edge: edgeCount++ });
  };
  pairs.forEach(([a, b]) => add(STATIONS.indexOf(a), STATIONS.indexOf(b)));
  STATIONS.forEach((_, index) => { if (graph[index].length % 2) add(index, dummy); });
  const used = new Set<number>();
  const first: StationId[] = [];
  const second: StationId[] = [];
  for (let start = 0; start < graph.length; start++) {
    const stack = [start];
    while (stack.length) {
      const at = stack[stack.length - 1];
      const next = graph[at].pop();
      if (!next) { stack.pop(); continue; }
      if (used.has(next.edge)) continue;
      used.add(next.edge);
      if (next.edge < pairs.length) {
        first[next.edge] = STATIONS[at];
        second[next.edge] = STATIONS[next.other];
      }
      stack.push(next.other);
    }
  }
  return [first, second];
}

export function planClass(input: ClassInput, seed: number): ClassPlan {
  const { athletes } = validateClassInput(input);
  if (!Number.isSafeInteger(seed)) invalid('Seed must be a finite safe integer.');
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const exposure = athletes.map(() => STATIONS.map(() => 0));
  const pairs = allocate(athletes, 2, undefined, exposure, random);
  if (!pairs) throw new PlannerError('INFEASIBLE', 'These exclusions cannot fit the station capacities without consecutive repeats. Adjust the roster or exclusions.');
  const schedule = splitPair(pairs);
  const rounds: ClassPlan['rounds'] = [];
  for (let round = 0; round < 12; round++) {
    let stations: StationId[];
    if (round < 2) stations = schedule[round];
    else {
      const varied = allocate(athletes, 1, schedule[round - 1], exposure, random);
      // The allocation two rounds ago is always valid against the preceding
      // round. A failed variety attempt can never invalidate the entire class.
      stations = varied ? varied.map(([station]) => station) : schedule[round - 2].slice();
      schedule[round] = stations;
    }
    rounds.push({ round: round + 1, assignments: athletes.map((athlete, index) => {
      exposure[index][STATIONS.indexOf(stations[index])]++;
      return { athleteId: athlete.id, station: stations[index] };
    }) });
  }
  return { rulesVersion: PLANNER_VERSION, capacities: { ...CAPACITIES }, rounds };
}

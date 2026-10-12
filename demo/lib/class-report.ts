/** A checksum of declared demo participation; neither physical proof nor a signature. */
// @ts-expect-error Node's native TypeScript tests require explicit extensions.
import { CAPACITIES, validateClassInput } from './class-planner.ts';
import type { ClassInput, ClassPlan } from './class-planner';
// @ts-expect-error Node's native TypeScript tests require explicit extensions.
import { durationMs, projectRun, validateTiming } from './class-run.ts';
import type { RunState, Timing } from './class-run';

export type ParticipantInput = { athleteId: string; status: 'completed' | 'partial' | 'absent'; roundsCompleted: number };
export type ReportRun = { id: string; planId: string; createdAt: string; updatedAt: string; revision: number; input: ClassInput; plan: ClassPlan; timing: Timing; state: RunState };
export type ReportPayload = { version: 'demo-closeout-1'; source: 'demo_declared'; run: ReportRun; closedAt: string; availableRounds: number; participants: (ParticipantInput & { name: string })[] };
export type SavedReport = { id: string; createdAt: string; payload: ReportPayload; hash: string };

export class ReportError extends Error {
  code: 'INVALID_INPUT' | 'RUN_NOT_ENDED';
  constructor(code: ReportError['code'], message: string) { super(message); this.name = 'ReportError'; this.code = code; }
}
function invalid(message: string): never { throw new ReportError('INVALID_INPUT', message); }
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function keys(value: Record<string, unknown>, expected: string[]): boolean { return Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key)); }
function iso(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }

/** Only wholly elapsed work intervals count; rests never add a round. */
export function availableRounds(state: RunState, timing: Timing): number {
  try {
    const elapsed = projectRun(state, timing, 0).elapsedMs;
    return Math.max(0, Math.min(12, Math.floor((elapsed + timing.restSeconds * 1000) / ((timing.workSeconds + timing.restSeconds) * 1000))));
  } catch { return invalid('Invalid run clock.'); }
}

export function validateParticipants(value: unknown, run: ReportRun): ParticipantInput[] {
  if (!run?.state || !['completed', 'interrupted'].includes(run.state.status)) throw new ReportError('RUN_NOT_ENDED', 'End the class before declaring participation.');
  let input: ClassInput;
  try { input = validateClassInput(run.input); } catch { return invalid('Invalid class roster.'); }
  const limit = availableRounds(run.state, run.timing);
  if (!Array.isArray(value) || value.length !== input.athletes.length) invalid('Declare every athlete exactly once.');
  const known = new Set(input.athletes.map(athlete => athlete.id));
  const participants = new Map<string, ParticipantInput>();
  for (const item of value) {
    if (!record(item) || !keys(item, ['athleteId', 'status', 'roundsCompleted']) || typeof item.athleteId !== 'string' || !known.has(item.athleteId) || participants.has(item.athleteId)) invalid('Unknown, duplicate or malformed athlete.');
    const rounds = item.roundsCompleted;
    if (typeof rounds !== 'number' || !Number.isInteger(rounds)) invalid('Rounds must be whole numbers.');
    if (item.status === 'completed') { if (rounds !== 12 || limit !== 12) invalid('Completion requires 12 elapsed rounds.'); }
    else if (item.status === 'partial') { if (run.state.elapsedMs <= 0 || rounds < 0 || rounds > Math.min(11, limit)) invalid('Partial participation requires elapsed class time and must fit the completed rounds.'); }
    else if (item.status === 'absent') { if (rounds !== 0) invalid('Absent athletes must have zero rounds.'); }
    else invalid('Unknown participation status.');
    participants.set(item.athleteId, { athleteId: item.athleteId, status: item.status, roundsCompleted: rounds });
  }
  return input.athletes.map(athlete => participants.get(athlete.id)!);
}

/** Stable JSON with sorted object keys and preserved array order. */
export function canonicalReportJSON(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + Array.from(value, entry => canonicalReportJSON(entry)).join(',') + ']';
  if (record(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalReportJSON(value[key])).join(',') + '}';
  }
  return invalid('Report contains a non-JSON value.');
}

function validateRun(run: ReportRun): void {
  if (!record(run) || !keys(run, ['id', 'planId', 'createdAt', 'updatedAt', 'revision', 'input', 'plan', 'timing', 'state']) ||
    typeof run.id !== 'string' || !run.id.length || run.id.length > 128 || typeof run.planId !== 'string' || !run.planId.length || run.planId.length > 128 ||
    !iso(run.createdAt) || !iso(run.updatedAt) || Date.parse(run.updatedAt) < Date.parse(run.createdAt) || !Number.isSafeInteger(run.revision) || run.revision < 0) invalid('Invalid run snapshot.');
  try { validateClassInput(run.input); validateTiming(run.timing); } catch { invalid('Invalid roster or timing.'); }
  if (!record(run.state) || !keys(run.state, ['status', 'elapsedMs', 'startedAt']) || !['completed', 'interrupted'].includes(run.state.status) || run.state.startedAt !== null ||
    !Number.isFinite(run.state.elapsedMs) || run.state.elapsedMs < 0 || run.state.elapsedMs > durationMs(run.timing) ||
    (run.state.status === 'completed' && run.state.elapsedMs !== durationMs(run.timing))) invalid('Invalid terminal clock snapshot.');
  const plan = run.plan;
  if (!record(plan) || !keys(plan, ['rulesVersion', 'capacities', 'rounds']) || typeof plan.rulesVersion !== 'string' || !plan.rulesVersion.length ||
    canonicalReportJSON(plan.capacities) !== canonicalReportJSON(CAPACITIES) || !Array.isArray(plan.rounds) || plan.rounds.length !== 12) invalid('Invalid plan snapshot.');
  const previous = new Map<string, string>();
  for (let index = 0; index < plan.rounds.length; index++) {
    const round = plan.rounds[index];
    if (!record(round) || !keys(round, ['round', 'assignments']) || round.round !== index + 1 || !Array.isArray(round.assignments) || round.assignments.length !== run.input.athletes.length) invalid('Invalid plan round.');
    const seen = new Set<string>();
    const occupancy: Record<string, number> = {};
    for (const assignment of round.assignments) {
      if (!record(assignment) || !keys(assignment, ['athleteId', 'station'])) invalid('Invalid assignment.');
      const athlete = run.input.athletes.find(candidate => candidate.id === assignment.athleteId);
      if (!athlete || seen.has(assignment.athleteId) || !Object.hasOwn(CAPACITIES, assignment.station) || athlete.excludedStations.includes(assignment.station) || previous.get(assignment.athleteId) === assignment.station) invalid('Invalid athlete station.');
      seen.add(assignment.athleteId); previous.set(assignment.athleteId, assignment.station);
      occupancy[assignment.station] = (occupancy[assignment.station] ?? 0) + 1;
      if (occupancy[assignment.station] > CAPACITIES[assignment.station]) invalid('Station capacity exceeded.');
    }
  }
}
async function hashPayload(payload: ReportPayload): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalReportJSON(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
export async function buildReport(run: ReportRun, participants: unknown, closedAt: string): Promise<SavedReport> {
  const declared = validateParticipants(participants, run);
  const snapshot: ReportRun = JSON.parse(canonicalReportJSON({ id: run.id, planId: run.planId, createdAt: run.createdAt, updatedAt: run.updatedAt, revision: run.revision, input: run.input, plan: run.plan, timing: run.timing, state: run.state }));
  validateRun(snapshot);
  if (!iso(closedAt) || Date.parse(closedAt) < Date.parse(snapshot.updatedAt)) invalid('Invalid closeout timestamp.');
  const payload: ReportPayload = { version: 'demo-closeout-1', source: 'demo_declared', run: snapshot, closedAt, availableRounds: availableRounds(snapshot.state, snapshot.timing), participants: declared.map(participant => ({ ...participant, name: snapshot.input.athletes.find(athlete => athlete.id === participant.athleteId)!.name })) };
  return { id: snapshot.id, createdAt: closedAt, payload, hash: await hashPayload(payload) };
}
/** Checks integrity and format, not issuer authenticity or physical attendance. */
export async function verifyReport(report: unknown): Promise<boolean> {
  try {
    if (!record(report) || !keys(report, ['id', 'createdAt', 'payload', 'hash']) || typeof report.hash !== 'string' || !/^[a-f0-9]{64}$/.test(report.hash)) return false;
    const payload = report.payload;
    if (!record(payload) || !keys(payload, ['version', 'source', 'run', 'closedAt', 'availableRounds', 'participants']) || payload.version !== 'demo-closeout-1' || payload.source !== 'demo_declared' || !Array.isArray(payload.participants)) return false;
    if (!record(payload.run)) return false;
    validateRun(payload.run as ReportRun);
    const participants = payload.participants.map(item => {
      if (!record(item) || !keys(item, ['athleteId', 'status', 'roundsCompleted', 'name'])) invalid('Invalid participant snapshot.');
      return { athleteId: item.athleteId, status: item.status, roundsCompleted: item.roundsCompleted };
    });
    const rebuilt = await buildReport(payload.run as ReportRun, participants, payload.closedAt as string);
    return canonicalReportJSON(rebuilt) === canonicalReportJSON(report);
  } catch { return false; }
}

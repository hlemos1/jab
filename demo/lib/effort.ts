/**
 * Synthetic Proof of Effort demonstration, not a physical-proof or biometric model.
 * All times are offsets within an accelerated 72-second replay. Scores and rewards
 * are illustrative, uncalibrated rules, not StrikeX's production STRIKE score.
 * Duplicate SESSION claims must additionally be prevented atomically by storage.
 */
export const RULES_VERSION = 'demo-1.1.0';
export const STATIONS = ['volume', 'technique', 'power', 'speed', 'vr', 'reflex'] as const;
export const ROUND_DURATION_MS = 6_000;
export const SESSION_DURATION_MS = 72_000;
export type StationId = (typeof STATIONS)[number];

/** Public session IDs share the persistence and receipt contract; event IDs are separate. */
export function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value);
}

export interface Round {
  id: number;
  station: StationId;
  startMs: number;
  endMs: number;
}
export interface EffortEvent {
  id: string;
  sessionId: string;
  roundId: number;
  station: StationId;
  timestampMs: number;
  accuracy: number;
  intensity: number;
}
export interface SessionInput {
  sessionId: string;
  source: 'simulator';
  rounds: Round[];
  events: EffortEvent[];
}
export interface SessionResult {
  valid: boolean;
  errors: string[];
  score: number;
  reward: number;
  rounds: Round[];
  metrics: { events: number; consistency: number; accuracy: number; volume: number };
  rulesVersion: string;
}

/**
 * One illustrative, nonuniform athlete journey, not the production Solver.
 * Whole-class capacity and athlete compatibility require a roster assignment
 * matrix and cannot be established from this single-athlete demonstration.
 */
export function generateSession(sessionId: string, seed = 42): SessionInput {
  if (!isSessionId(sessionId)) throw new Error('Invalid session identifier.');
  if (!Number.isFinite(seed)) throw new Error('Seed must be finite.');
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const journey: StationId[] = ['volume', 'technique', 'power', 'volume', 'speed', 'technique', 'power', 'volume', 'vr', 'technique', 'reflex', 'power'];
  const rounds = journey.map((station, index): Round => ({
    id: index + 1,
    station,
    startMs: index * ROUND_DURATION_MS,
    endMs: (index + 1) * ROUND_DURATION_MS,
  }));
  const events: EffortEvent[] = [];
  for (const round of rounds) {
    const count = 7 + Math.floor(random() * 4);
    for (let index = 0; index < count; index++) {
      events.push({
        id: `r${round.id}:e${index + 1}`,
        sessionId,
        roundId: round.id,
        station: round.station,
        timestampMs: round.startMs + Math.round(((index + 1) / (count + 1)) * ROUND_DURATION_MS),
        accuracy: Math.round((0.65 + random() * 0.34) * 1000) / 1000,
        intensity: Math.round((0.5 + random() * 0.49) * 1000) / 1000,
      });
    }
  }
  return { sessionId, source: 'simulator', rounds, events };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(value);
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function unit(value: unknown): value is number {
  return finite(value) && value >= 0 && value <= 1;
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function station(value: unknown): value is StationId {
  return typeof value === 'string' && (STATIONS as readonly string[]).includes(value);
}

/** Validate untrusted JSON; invalid data can never earn a score or reward. */
export function validateSession(input: unknown): SessionResult {
  const errors: string[] = [];
  const fail = (message: string) => { if (errors.length < 24) errors.push(message); };
  const invalid = (): SessionResult => ({
    valid: false, errors, score: 0, reward: 0, rounds: [],
    metrics: { events: 0, consistency: 0, accuracy: 0, volume: 0 }, rulesVersion: RULES_VERSION,
  });
  if (!isRecord(input)) { fail('Session must be an object.'); return invalid(); }
  if (!exactKeys(input, ['sessionId', 'source', 'rounds', 'events'])) fail('Session schema contains missing or unknown fields.');
  if (!isSessionId(input.sessionId)) fail('Invalid session identifier.');
  if (input.source !== 'simulator') fail('Only explicitly synthetic simulator data is supported.');
  if (!Array.isArray(input.rounds) || input.rounds.length !== 12) fail('Exactly 12 rounds are required.');
  if (!Array.isArray(input.events) || input.events.length < 12 || input.events.length > 2400) fail('Session requires 12–2400 events.');
  if (errors.length) return invalid();

  const rawRounds = input.rounds as unknown[];
  const rawEvents = input.events as unknown[];
  const rounds: Round[] = [];
  rawRounds.forEach((item, index) => {
    if (!isRecord(item) || !exactKeys(item, ['id', 'station', 'startMs', 'endMs'])) {
      fail(`Round ${index + 1}: invalid schema.`); return;
    }
    if (item.id !== index + 1 || !station(item.station)
      || item.startMs !== index * ROUND_DURATION_MS || item.endMs !== (index + 1) * ROUND_DURATION_MS) {
      fail(`Round ${index + 1}: invalid station, sequence or time window.`); return;
    }
    if (index > 0 && rounds[index - 1]?.station === item.station) {
      fail(`Round ${index + 1}: consecutive rounds cannot repeat the same station.`); return;
    }
    rounds.push({ id: item.id as number, station: item.station, startMs: item.startMs as number, endMs: item.endMs as number });
  });
  if (errors.length) return invalid();

  const ids = new Set<string>();
  const counts = Array<number>(12).fill(0);
  const accepted: EffortEvent[] = [];
  let previousTimestamp = -1;
  for (let index = 0; index < rawEvents.length; index++) {
    const item = rawEvents[index];
    if (!isRecord(item) || !exactKeys(item, ['id', 'sessionId', 'roundId', 'station', 'timestampMs', 'accuracy', 'intensity'])) {
      fail(`Event ${index + 1}: invalid schema.`); continue;
    }
    if (!validIdentifier(item.id) || item.sessionId !== input.sessionId || !station(item.station)
      || !finite(item.roundId) || !Number.isInteger(item.roundId) || item.roundId < 1 || item.roundId > 12
      || !finite(item.timestampMs) || !Number.isInteger(item.timestampMs) || !unit(item.accuracy) || !unit(item.intensity)) {
      fail(`Event ${index + 1}: invalid identifier, session, round or numeric values.`); continue;
    }
    const round = rounds[item.roundId - 1];
    if (ids.has(item.id)) fail(`Event ${index + 1}: duplicate event identifier.`);
    ids.add(item.id);
    if (item.station !== round.station) fail(`Event ${index + 1}: station does not match round.`);
    if (item.timestampMs < round.startMs || item.timestampMs >= round.endMs) fail(`Event ${index + 1}: timestamp outside round window.`);
    if (item.timestampMs <= previousTimestamp) fail(`Event ${index + 1}: timestamps must increase strictly.`);
    previousTimestamp = item.timestampMs;
    counts[item.roundId - 1]++;
    accepted.push(item as unknown as EffortEvent);
  }
  counts.forEach((count, index) => { if (count === 0) fail(`Round ${index + 1}: missing events.`); });
  if (errors.length) return invalid();

  const accuracy = Math.round(100 * accepted.reduce((sum, event) => sum + event.accuracy, 0) / accepted.length);
  // Consistency measures balance of synthetic event counts, not athletic technique.
  const consistency = Math.round(100 * Math.min(...counts) / Math.max(...counts));
  const volumeScore = Math.min(100, 100 * accepted.length / 96);
  const score = Math.round(0.5 * accuracy + 0.3 * consistency + 0.2 * volumeScore);
  return {
    valid: true, errors: [], score, reward: Math.floor(score / 5), rounds,
    metrics: { events: accepted.length, consistency, accuracy, volume: accepted.length }, rulesVersion: RULES_VERSION,
  };
}

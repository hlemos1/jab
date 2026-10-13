import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { demoGuestId, resolveDemoIdentity } from '@/lib/identity';
import type { ClassInput, ClassPlan } from '@/lib/class-planner';
import { createRunState, projectRun, transitionRun, validateTiming, RunError, type Timing, type RunState, type RunProjection } from '@/lib/class-run';

export const dynamic = 'force-dynamic';
const COOKIE = 'strikex_demo_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 20_000;
type Row = {id: string; plan_id: string; created_at: string; updated_at: string; revision: number; input: string; plan: string; timing: string; state: string; active: number; last_command_id: string | null; last_command_json: string | null};
type SavedRun = {id: string; planId: string; createdAt: string; updatedAt: string; revision: number; input: ClassInput; plan: ClassPlan; timing: Timing; state: RunState; clock: RunProjection};
function guest(request: Request): string {
  const value = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return demoGuestId(value);
}
function reply(data: unknown, guestId: string, status = 200): Response {
  return Response.json(data, {status, headers: {
    'Cache-Control': 'no-store',
    'Set-Cookie': `${COOKIE}=${guestId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
  }});
}
function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJSON((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
function database(): D1Database {
  if (!env.DB) throw new Error('Database unavailable');
  return env.DB;
}
// Enforce the limit while reading, including requests without Content-Length.
async function readBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', {fatal: true}).decode(joined);
}


class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); }
}
function bad(message: string): never { throw new ApiError('INVALID_INPUT', message, 400); }
function conflict(message = 'This run changed. Reload it before trying again.'): never { throw new ApiError('CONFLICT', message, 409); }
function exact(body: Record<string, unknown>, keys: string[]) {
  if (Object.keys(body).some(key => !keys.includes(key)) || keys.some(key => !(key in body))) bad('Unexpected or missing request fields.');
}
function uuid(value: unknown): string { if (typeof value !== 'string' || !UUID.test(value)) bad('A valid ID is required.'); return value.toLowerCase(); }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) bad('A valid revision is required.'); return value as number; }
async function readRun(db: D1Database, scope: string, id: string): Promise<Row | null> {
  return db.prepare('SELECT id,plan_id,created_at,updated_at,revision,input,plan,timing,state,active,last_command_id,last_command_json FROM demo_class_runs WHERE scope_id=? AND id=?').bind(scope, id).first<Row>();
}
function expose(row: Row, now: number): SavedRun {
  const state = JSON.parse(row.state) as RunState;
  const timing = JSON.parse(row.timing) as Timing;
  return {id: row.id, planId: row.plan_id, createdAt: row.created_at, updatedAt: row.updated_at, revision: row.revision, input: JSON.parse(row.input), plan: JSON.parse(row.plan), timing, state, clock: projectRun(state, timing, now)};
}
// Materialize elapsed completion before mutations or a new run. Revision CAS
// prevents a simultaneous pause/interrupt from being overwritten by this read.
async function settle(db: D1Database, scope: string, original: Row, now: number): Promise<Row | null> {
  let row: Row | null = original;
  for (let attempt = 0; attempt < 3 && row; attempt++) {
    const run = expose(row, now);
    if (run.state.status !== 'running' || run.clock.status !== 'completed') return row;
    const completed: RunState = {status: 'completed', elapsedMs: run.clock.totalMs, startedAt: null};
    await db.prepare('UPDATE demo_class_runs SET state=?,active=0,updated_at=?,revision=revision+1 WHERE scope_id=? AND id=? AND revision=? AND active=1').bind(JSON.stringify(completed), new Date(now).toISOString(), scope, row.id, row.revision).run();
    row = await readRun(db, scope, row.id);
  }
  return row;
}
async function settleActive(db: D1Database, scope: string, now: number): Promise<void> {
  const active = await db.prepare('SELECT id,plan_id,created_at,updated_at,revision,input,plan,timing,state,active,last_command_id,last_command_json FROM demo_class_runs WHERE scope_id=? AND active=1').bind(scope).first<Row>();
  if (active) await settle(db, scope, active, now);
}
export async function GET(request: Request): Promise<Response> {
  const guestId = guest(request);
  try {
    const {scopeId} = await resolveDemoIdentity(await getChatGPTUser(), guestId);
    const db = database();
    const now = Date.now();
    await settleActive(db, scopeId, now);
    const rows = await db.prepare('SELECT id,plan_id,created_at,updated_at,revision,input,plan,timing,state,active,last_command_id,last_command_json FROM demo_class_runs WHERE scope_id=? ORDER BY created_at DESC,id DESC LIMIT 20').bind(scopeId).all<Row>();
    return reply({runs: rows.results.map(row => expose(row, now)), serverNow: now}, guestId);
  } catch (error) {
    console.error('class_runs_read_failed', String(error));
    return reply({error: 'Could not load your runs. Please try again.', code: 'UNAVAILABLE'}, guestId, 503);
  }
}
export async function POST(request: Request): Promise<Response> {
  const guestId = guest(request);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply({error: 'Origin not allowed.', code: 'ORIGIN'}, guestId, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply({error: 'JSON required.', code: 'CONTENT_TYPE'}, guestId, 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return reply({error: 'Request too large.', code: 'BODY_TOO_LARGE'}, guestId, 413);
  try {
    const raw = await readBody(request);
    if (raw === null) return reply({error: 'Request too large.', code: 'BODY_TOO_LARGE'}, guestId, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { bad('Invalid JSON.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) bad('Invalid request.');
    const {scopeId} = await resolveDemoIdentity(await getChatGPTUser(), guestId);
    const db = database();
    const now = Date.now();
    if (body.action === 'create') {
      exact(body, ['action', 'requestId', 'planId', 'timing']);
      const id = uuid(body.requestId);
      const planId = uuid(body.planId);
      const timing = validateTiming(body.timing);
      const existing = await readRun(db, scopeId, id);
      if (existing) {
        if (existing.plan_id !== planId || canonicalJSON(JSON.parse(existing.timing)) !== canonicalJSON(timing)) conflict('This request ID already has different input.');
        const current = await settle(db, scopeId, existing, now);
        if (!current) conflict();
        return reply({run: expose(current, now), serverNow: now, duplicate: true}, guestId);
      }
      await settleActive(db, scopeId, now);
      const snapshot = await db.prepare('SELECT input,plan FROM demo_class_plans WHERE scope_id=? AND id=?').bind(scopeId, planId).first<{input: string; plan: string}>();
      if (!snapshot) throw new ApiError('NOT_FOUND', 'Saved class plan not found.', 404);
      const timestamp = new Date(now).toISOString();
      const inserted = await db.prepare('INSERT OR IGNORE INTO demo_class_runs(scope_id,id,plan_id,created_at,updated_at,revision,input,plan,timing,state,active) SELECT ?,?,?,?,?,0,?,?,?,?,1 WHERE (SELECT COUNT(*) FROM demo_class_runs WHERE scope_id=?)<20').bind(scopeId, id, planId, timestamp, timestamp, snapshot.input, snapshot.plan, JSON.stringify(timing), JSON.stringify(createRunState()), scopeId).run();
      const saved = await readRun(db, scopeId, id);
      if (!saved) {
        const active = await db.prepare('SELECT id FROM demo_class_runs WHERE scope_id=? AND active=1').bind(scopeId).first<{id: string}>();
        if (active) throw new ApiError('ACTIVE_RUN', 'End your current run before creating another.', 409);
        throw new ApiError('RUN_LIMIT', 'You have 20 saved runs. Delete a finished run before creating another.', 429);
      }
      if (saved.plan_id !== planId || canonicalJSON(JSON.parse(saved.timing)) !== canonicalJSON(timing)) conflict('This request ID already has different input.');
      return reply({run: expose(saved, now), serverNow: now, duplicate: inserted.meta.changes === 0}, guestId);
    }
    if (body.action === 'delete') {
      exact(body, ['action', 'id', 'expectedRevision']);
      const id = uuid(body.id), expectedRevision = revision(body.expectedRevision);
      const found = await readRun(db, scopeId, id);
      if (!found) throw new ApiError('NOT_FOUND', 'Run not found.', 404);
      const row = await settle(db, scopeId, found, now);
      if (!row || row.revision !== expectedRevision) conflict();
      if (row.active) throw new ApiError('ACTIVE_RUN', 'Only finished or interrupted runs can be deleted.', 409);
      const deleted = await db.prepare('DELETE FROM demo_class_runs WHERE scope_id=? AND id=? AND revision=? AND active=0').bind(scopeId, id, expectedRevision).run();
      if (!deleted.meta.changes) conflict();
      return reply({deleted: true, id, serverNow: now}, guestId);
    }
    if (!['start', 'pause', 'resume', 'interrupt'].includes(String(body.action))) bad('Unknown run action.');
    exact(body, ['action', 'id', 'requestId', 'expectedRevision']);
    const id = uuid(body.id), commandId = uuid(body.requestId), expectedRevision = revision(body.expectedRevision);
    if (commandId === id) bad('Command ID must differ from the creation request ID.');
    const commandJSON = canonicalJSON({action: body.action, id, requestId: commandId, expectedRevision});
    const found = await readRun(db, scopeId, id);
    if (!found) throw new ApiError('NOT_FOUND', 'Run not found.', 404);
    const row = await settle(db, scopeId, found, now);
    if (!row) conflict();
    // Latest-command replay returns the current state. Older retries are stale
    // (409); they can never repeat elapsed-time changes or rewind the run.
    if (row.last_command_id === commandId) {
      if (row.last_command_json !== commandJSON) conflict('This request ID already has different input.');
      return reply({run: expose(row, now), serverNow: now, duplicate: true}, guestId);
    }
    if (row.revision !== expectedRevision) conflict();
    const next = transitionRun(JSON.parse(row.state), JSON.parse(row.timing), body.action as 'start' | 'pause' | 'resume' | 'interrupt', now);
    const active = next.status === 'completed' || next.status === 'interrupted' ? 0 : 1;
    const updated = await db.prepare('UPDATE demo_class_runs SET state=?,active=?,updated_at=?,revision=revision+1,last_command_id=?,last_command_json=? WHERE scope_id=? AND id=? AND revision=?').bind(JSON.stringify(next), active, new Date(now).toISOString(), commandId, commandJSON, scopeId, id, expectedRevision).run();
    const current = await readRun(db, scopeId, id);
    if (!current) conflict();
    if (!updated.meta.changes && (current.last_command_id !== commandId || current.last_command_json !== commandJSON)) conflict();
    return reply({run: expose(current, now), serverNow: now, duplicate: updated.meta.changes === 0}, guestId);
  } catch (error) {
    if (error instanceof ApiError) return reply({error: error.message, code: error.code}, guestId, error.status);
    if (error instanceof RunError) return reply({error: error.message, code: error.code}, guestId, error.code === 'INVALID_INPUT' ? 400 : 409);
    console.error('class_run_action_failed', String(error));
    return reply({error: 'The run could not be saved. Please try again.', code: 'UNAVAILABLE'}, guestId, 503);
  }
}

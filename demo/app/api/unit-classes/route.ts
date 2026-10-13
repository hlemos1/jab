import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { resolveDemoIdentity } from '@/lib/identity';
import { planClass, validateClassInput, PlannerError, type ClassInput, type ClassPlan } from '@/lib/class-planner';
import { createRunState, projectRun, transitionRun, validateTiming, RunError, type Timing, type RunState, type RunAction } from '@/lib/class-run';
import { UnitError, unitId, unitName, strictKeys, type UnitRole } from '@/lib/units';
import type { UnitClass } from '@/lib/unit-classes';

export const dynamic = 'force-dynamic';
const MAX_BODY_BYTES = 20_000;
type Access = {my_role: UnitRole; member_id: string | null};
type Row = {unit_id: string; id: string; created_at: string; updated_at: string; revision: number; request_input: string; input: string; plan: string; timing: string; state: string; active: number; last_command_id: string | null; last_command_json: string | null};
const ACCESS_SQL = `SELECT CASE WHEN u.owner_scope=? THEN 'owner' ELSE m.role END AS my_role,m.id AS member_id
  FROM demo_units u LEFT JOIN demo_unit_members m ON m.unit_id=u.id AND m.scope_id=? AND m.active=1
  WHERE u.id=? AND (u.owner_scope=? OR m.id IS NOT NULL)`;
// These predicates run inside the mutation statement, so a stale authorization
// read cannot allow a removed or demoted coach to write.
const MANAGER_SQL = `EXISTS (SELECT 1 FROM demo_units u WHERE u.id=? AND (u.owner_scope=? OR EXISTS
  (SELECT 1 FROM demo_unit_members m WHERE m.unit_id=u.id AND m.scope_id=? AND m.active=1 AND m.role='coach')))`;
function reply(data: unknown, status = 200): Response { return Response.json(data, {status, headers: {'Cache-Control': 'no-store'}}); }
function fail(code: string, message: string, status: number): never { throw new UnitError(code, message, status); }
function conflict(message = 'The class changed. Reload before trying again.'): never { return fail('CONFLICT', message, 409); }
function database(): D1Database { if (!env.DB) throw new Error('Database unavailable'); return env.DB; }
async function actor(): Promise<string> {
  const user = await getChatGPTUser();
  if (!user) fail('AUTH_REQUIRED', 'Sign in to open unit classes.', 401);
  return (await resolveDemoIdentity(user, crypto.randomUUID())).scopeId;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
function revision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail('INVALID_INPUT', 'Invalid revision.', 400);
  return value as number;
}
async function access(db: D1Database, scope: string, id: string, manager = false): Promise<Access> {
  const result = await db.prepare(ACCESS_SQL).bind(scope, scope, id, scope).first<Access>();
  if (!result || (manager && result.my_role === 'athlete')) fail('FORBIDDEN', 'You do not have access to this action.', 403);
  return result;
}
async function readManagerRun(db: D1Database, scope: string, unit: string, id: string): Promise<Row | null> {
  return db.prepare(`SELECT * FROM demo_unit_classes WHERE unit_id=? AND id=? AND ${MANAGER_SQL}`).bind(unit, id, unit, scope, scope).first<Row>();
}
function expose(row: Row, now: number, memberId?: string): UnitClass {
  const input = JSON.parse(row.input) as ClassInput, plan = JSON.parse(row.plan) as ClassPlan;
  const timing = JSON.parse(row.timing) as Timing, state = JSON.parse(row.state) as RunState;
  return {id: row.id, unitId: row.unit_id, name: input.name, createdAt: row.created_at, updatedAt: row.updated_at,
    revision: row.revision, timing, state, clock: projectRun(state, timing, now),
    athletes: input.athletes.filter(a => memberId === undefined || a.id === memberId).map(a => ({memberId: a.id, name: a.name,
      stations: plan.rounds.map(round => round.assignments.find(assignment => assignment.athleteId === a.id)!.station)}))};
}
async function settle(db: D1Database, scope: string, unit: string, original: Row, now: number): Promise<Row | null> {
  let row: Row | null = original;
  for (let attempt = 0; attempt < 3 && row; attempt++) {
    const state = JSON.parse(row.state) as RunState, timing = JSON.parse(row.timing) as Timing;
    const clock = projectRun(state, timing, now);
    if (state.status !== 'running' || clock.status !== 'completed') return row;
    const next: RunState = {status: 'completed', elapsedMs: clock.totalMs, startedAt: null};
    await db.prepare(`UPDATE demo_unit_classes SET state=?,active=0,updated_at=?,revision=revision+1
      WHERE unit_id=? AND id=? AND revision=? AND active=1 AND ${MANAGER_SQL}`)
      .bind(JSON.stringify(next), new Date(now).toISOString(), unit, row.id, row.revision, unit, scope, scope).run();
    row = await readManagerRun(db, scope, unit, row.id);
  }
  return row;
}
async function settleActive(db: D1Database, scope: string, unit: string, now: number): Promise<void> {
  const row = await db.prepare(`SELECT * FROM demo_unit_classes WHERE unit_id=? AND active=1 AND ${MANAGER_SQL}`).bind(unit, unit, scope, scope).first<Row>();
  if (row) await settle(db, scope, unit, row, now);
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) fail('INVALID_INPUT', 'JSON required.', 400);
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); fail('BODY_TOO_LARGE', 'Request too large.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(joined));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { return fail('INVALID_INPUT', 'Invalid JSON.', 400); }
}
function errorResponse(error: unknown): Response {
  if (error instanceof UnitError) return reply({error: error.message, code: error.code}, error.status);
  if (error instanceof PlannerError) return reply({error: error.message, code: error.code}, error.code === 'INVALID_INPUT' ? 400 : error.code === 'INFEASIBLE' ? 422 : 503);
  if (error instanceof RunError) return reply({error: error.message, code: error.code === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'CONFLICT'}, error.code === 'INVALID_INPUT' ? 400 : 409);
  console.error('unit_class_action_failed');
  return reply({error: 'Could not load or update unit classes. Please try again.', code: 'UNAVAILABLE'}, 503);
}
export async function GET(request: Request): Promise<Response> {
  try {
    const scope = await actor(), unit = unitId(new URL(request.url).searchParams.get('unitId')), db = database(), now = Date.now();
    const current = await access(db, scope, unit);
    if (current.my_role !== 'athlete') await settleActive(db, scope, unit, now);
    // D1 batch gives both reads one transactional view of current membership.
    // Even demotion between the preliminary read and this batch cannot leak a roster.
    const result = await db.batch([
      db.prepare(ACCESS_SQL).bind(scope, scope, unit, scope),
      db.prepare(`SELECT c.* FROM demo_unit_classes c JOIN demo_units u ON u.id=c.unit_id
        LEFT JOIN demo_unit_members m ON m.unit_id=u.id AND m.scope_id=? AND m.active=1
        WHERE c.unit_id=? AND (u.owner_scope=? OR (m.id IS NOT NULL AND
          (m.role='coach' OR EXISTS (SELECT 1 FROM json_each(c.input,'$.athletes') a WHERE json_extract(a.value,'$.id')=m.id))))
        ORDER BY c.created_at DESC,c.id DESC LIMIT 20`).bind(scope, unit, scope),
    ]);
    const permission = result[0].results[0] as Access | undefined;
    if (!permission) fail('FORBIDDEN', 'You no longer belong to this unit.', 403);
    return reply({unitId: unit, myRole: permission.my_role, runs: (result[1].results as Row[]).map(row => expose(row, now, permission.my_role === 'athlete' ? permission.member_id! : undefined)), serverNow: now});
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply({error: 'Origin not allowed.', code: 'ORIGIN'}, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply({error: 'JSON required.', code: 'CONTENT_TYPE'}, 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return reply({error: 'Request too large.', code: 'BODY_TOO_LARGE'}, 413);
  try {
    const scope = await actor(), body = await readBody(request), unit = unitId(body.unitId), db = database(), now = Date.now();
    await access(db, scope, unit, true);
    if (body.action === 'create') {
      strictKeys(body, ['action', 'unitId', 'requestId', 'name', 'athletes', 'timing']);
      const id = unitId(body.requestId), name = unitName(body.name, 80), timing = validateTiming(body.timing);
      if (!Array.isArray(body.athletes) || body.athletes.length < 1 || body.athletes.length > 11) fail('INVALID_INPUT', 'Select 1–11 active athletes.', 400);
      const selected = body.athletes.map((item: unknown) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) fail('INVALID_INPUT', 'Invalid athlete.', 400);
        const athlete = item as Record<string, unknown>; strictKeys(athlete, ['memberId', 'excludedStations']);
        return {id: unitId(athlete.memberId), name: 'Selected athlete', excludedStations: athlete.excludedStations};
      });
      const validated = validateClassInput({name, athletes: selected});
      const requestInput = canonical({name: validated.name, athletes: validated.athletes.map(a => ({memberId: a.id, excludedStations: a.excludedStations})), timing});
      const existing = await readManagerRun(db, scope, unit, id);
      if (existing) {
        if (existing.request_input !== requestInput) conflict('This request ID already has different input.');
        const current = await settle(db, scope, unit, existing, now);
        await access(db, scope, unit, true);
        if (!current) conflict();
        return reply({run: expose(current, now), serverNow: now, duplicate: true});
      }
      const members = await db.prepare("SELECT id,name FROM demo_unit_members WHERE unit_id=? AND active=1 AND role='athlete'").bind(unit).all<{id: string; name: string}>();
      const input = validateClassInput({name: validated.name, athletes: validated.athletes.map(a => {
        const member = members.results.find(m => m.id === a.id);
        if (!member) fail('INVALID_INPUT', 'Every selected person must be an active athlete in this unit.', 400);
        return {...a, name: member.name};
      })});
      const seed = crypto.getRandomValues(new Uint32Array(1))[0], plan = planClass(input, seed);
      await settleActive(db, scope, unit, now);
      const eligible = input.athletes.map(() => "EXISTS (SELECT 1 FROM demo_unit_members m WHERE m.unit_id=? AND m.id=? AND m.name=? AND m.active=1 AND m.role='athlete')").join(' AND ');
      const bindings = input.athletes.flatMap(a => [unit, a.id, a.name]);
      const timestamp = new Date(now).toISOString();
      const inserted = await db.prepare(`INSERT OR IGNORE INTO demo_unit_classes(unit_id,id,created_at,updated_at,revision,request_input,input,plan,timing,state,active)
        SELECT ?,?,?,?,0,?,?,?,?,?,1 WHERE ${MANAGER_SQL} AND ${eligible}
        AND (SELECT COUNT(*) FROM demo_unit_classes WHERE unit_id=?)<20`)
        .bind(unit, id, timestamp, timestamp, requestInput, JSON.stringify(input), JSON.stringify(plan), JSON.stringify(timing), JSON.stringify(createRunState()), unit, scope, scope, ...bindings, unit).run();
      await access(db, scope, unit, true);
      const saved = await readManagerRun(db, scope, unit, id);
      if (!saved) {
        const active = await db.prepare('SELECT id FROM demo_unit_classes WHERE unit_id=? AND active=1').bind(unit).first();
        if (active) fail('ACTIVE_RUN', 'End the current unit class before creating another.', 409);
        const count = await db.prepare('SELECT COUNT(*) AS count FROM demo_unit_classes WHERE unit_id=?').bind(unit).first<{count: number}>();
        if ((count?.count ?? 0) >= 20) fail('RUN_LIMIT', 'The unit has 20 saved classes. Delete a finished class first.', 429);
        conflict('The selected athletes changed. Reload the team.');
      }
      if (saved.request_input !== requestInput) conflict('This request ID already has different input.');
      return reply({run: expose(saved, now), serverNow: now, duplicate: inserted.meta.changes === 0});
    }
    if (body.action === 'delete') {
      strictKeys(body, ['action', 'unitId', 'id', 'expectedRevision']);
      const id = unitId(body.id), expected = revision(body.expectedRevision);
      const found = await readManagerRun(db, scope, unit, id);
      if (!found) { await access(db, scope, unit, true); fail('NOT_FOUND', 'Class not found.', 404); }
      const row = await settle(db, scope, unit, found, now);
      if (!row || row.revision !== expected) conflict();
      if (row.active) fail('ACTIVE_RUN', 'Only finished or interrupted classes can be deleted.', 409);
      const deleted = await db.prepare(`DELETE FROM demo_unit_classes WHERE unit_id=? AND id=? AND revision=? AND active=0 AND ${MANAGER_SQL}`).bind(unit, id, expected, unit, scope, scope).run();
      if (!deleted.meta.changes) { await access(db, scope, unit, true); conflict(); }
      return reply({deleted: true, id, serverNow: now});
    }
    if (!['start', 'pause', 'resume', 'interrupt'].includes(String(body.action))) fail('INVALID_INPUT', 'Unknown action.', 400);
    strictKeys(body, ['action', 'unitId', 'id', 'requestId', 'expectedRevision']);
    const id = unitId(body.id), commandId = unitId(body.requestId), expected = revision(body.expectedRevision);
    if (id === commandId) fail('INVALID_INPUT', 'Command ID must differ from creation request ID.', 400);
    const commandJSON = canonical({action: body.action, unitId: unit, id, requestId: commandId, expectedRevision: expected});
    const found = await readManagerRun(db, scope, unit, id);
    if (!found) { await access(db, scope, unit, true); fail('NOT_FOUND', 'Class not found.', 404); }
    const row = await settle(db, scope, unit, found, now);
    if (!row) { await access(db, scope, unit, true); conflict(); }
    if (row.last_command_id === commandId) {
      if (row.last_command_json !== commandJSON) conflict('This request ID already has different input.');
      await access(db, scope, unit, true);
      return reply({run: expose(row, now), serverNow: now, duplicate: true});
    }
    if (row.revision !== expected) conflict();
    const next = transitionRun(JSON.parse(row.state), JSON.parse(row.timing), body.action as RunAction, now);
    const active = next.status === 'completed' || next.status === 'interrupted' ? 0 : 1;
    const changed = await db.prepare(`UPDATE demo_unit_classes SET state=?,active=?,updated_at=?,revision=revision+1,last_command_id=?,last_command_json=?
      WHERE unit_id=? AND id=? AND revision=? AND ${MANAGER_SQL}`)
      .bind(JSON.stringify(next), active, new Date(now).toISOString(), commandId, commandJSON, unit, id, expected, unit, scope, scope).run();
    const current = await readManagerRun(db, scope, unit, id);
    await access(db, scope, unit, true);
    if (!current || (!changed.meta.changes && (current.last_command_id !== commandId || current.last_command_json !== commandJSON))) conflict();
    return reply({run: expose(current, now), serverNow: now, duplicate: changed.meta.changes === 0});
  } catch (error) { return errorResponse(error); }
}

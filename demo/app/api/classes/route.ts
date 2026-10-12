import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { demoGuestId, resolveDemoIdentity } from '@/lib/identity';
import { validateClassInput, planClass, PlannerError, type ClassInput, type ClassPlan } from '@/lib/class-planner';

export const dynamic = 'force-dynamic';
const COOKIE = 'strikex_demo_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 20_000;
type Row = {id: string; created_at: string; input: string; plan: string};
type SavedClass = {id: string; createdAt: string; input: ClassInput; plan: ClassPlan};

function expose(row: Row): SavedClass {
  return {id: row.id, createdAt: row.created_at, input: JSON.parse(row.input), plan: JSON.parse(row.plan)};
}
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

export async function GET(request: Request): Promise<Response> {
  const guestId = guest(request);
  try {
    const {scopeId} = await resolveDemoIdentity(await getChatGPTUser(), guestId);
    const rows = await database().prepare('SELECT id,created_at,input,plan FROM demo_class_plans WHERE scope_id=? ORDER BY created_at DESC,id DESC LIMIT 20').bind(scopeId).all<Row>();
    return reply({plans: rows.results.map(expose)}, guestId);
  } catch (error) {
    console.error('class_plans_read_failed', String(error));
    return reply({error: 'Could not load your class plans. Please try again.', code: 'UNAVAILABLE'}, guestId, 503);
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
    try { body = JSON.parse(raw); } catch { return reply({error: 'Invalid JSON.', code: 'INVALID_INPUT'}, guestId, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({error: 'Invalid request.', code: 'INVALID_INPUT'}, guestId, 400);
    const {scopeId} = await resolveDemoIdentity(await getChatGPTUser(), guestId);
    const db = database();
    if (body.action === 'delete') {
      if (typeof body.id !== 'string' || !UUID.test(body.id)) return reply({error: 'Invalid plan ID.', code: 'INVALID_INPUT'}, guestId, 400);
      const deleted = await db.prepare('DELETE FROM demo_class_plans WHERE scope_id=? AND id=?').bind(scopeId, body.id.toLowerCase()).run();
      if (!deleted.meta.changes) return reply({error: 'Class plan not found.', code: 'NOT_FOUND'}, guestId, 404);
      return reply({deleted: true, id: body.id.toLowerCase()}, guestId);
    }
    if (body.action !== 'generate' || typeof body.requestId !== 'string' || !UUID.test(body.requestId)) return reply({error: 'Generate requires a valid request ID.', code: 'INVALID_INPUT'}, guestId, 400);
    const id = body.requestId.toLowerCase();
    const saved = await db.prepare('SELECT id,created_at,input,plan FROM demo_class_plans WHERE scope_id=? AND id=?').bind(scopeId, id).first<Row>();
    // Compare the original accepted request before applying today's planner rules.
    if (saved) {
      if (canonicalJSON(JSON.parse(saved.input)) !== canonicalJSON(body.input)) return reply({error: 'This request ID already has different input.', code: 'CONFLICT'}, guestId, 409);
      return reply({plan: expose(saved), duplicate: true}, guestId);
    }
    const input = validateClassInput(body.input);
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const plan = planClass(input, seed);
    // The single conditional insert is the capacity gate, even for parallel requests.
    const inserted = await db.prepare('INSERT OR IGNORE INTO demo_class_plans(scope_id,id,created_at,input,plan) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM demo_class_plans WHERE scope_id=?)<20').bind(scopeId, id, new Date().toISOString(), JSON.stringify(body.input), JSON.stringify(plan), scopeId).run();
    const existing = await db.prepare('SELECT id,created_at,input,plan FROM demo_class_plans WHERE scope_id=? AND id=?').bind(scopeId, id).first<Row>();
    if (!existing) return reply({error: 'You have 20 saved plans. Delete an old plan before generating another.', code: 'PLAN_LIMIT'}, guestId, 429);
    if (canonicalJSON(JSON.parse(existing.input)) !== canonicalJSON(body.input)) return reply({error: 'This request ID already has different input.', code: 'CONFLICT'}, guestId, 409);
    return reply({plan: expose(existing), duplicate: inserted.meta.changes === 0}, guestId);
  } catch (error) {
    if (error instanceof PlannerError) {
      const status = error.code === 'INVALID_INPUT' ? 400 : error.code === 'INFEASIBLE' ? 422 : 503;
      return reply({error: error.message, code: error.code}, guestId, status);
    }
    console.error('class_plan_action_failed', String(error));
    return reply({error: 'The class plan could not be saved. Please try again.', code: 'UNAVAILABLE'}, guestId, 503);
  }
}

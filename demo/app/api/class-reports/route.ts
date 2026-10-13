import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { demoGuestId, resolveDemoIdentity } from '@/lib/identity';
import { buildReport, validateParticipants, canonicalReportJSON, ReportError, type ReportRun, type SavedReport } from '@/lib/class-report';

export const dynamic = 'force-dynamic';
const COOKIE = 'strikex_demo_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 20_000;
type ReportRow = {id: string; created_at: string; request_id: string; payload: string; hash: string};
type RunRow = {id: string; plan_id: string; created_at: string; updated_at: string; revision: number; input: string; plan: string; timing: string; state: string; active: number};
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
function conflict(message: string): never { throw new ApiError('CONFLICT', message, 409); }
function uuid(value: unknown): string { if (typeof value !== 'string' || !UUID.test(value)) bad('A valid ID is required.'); return value.toLowerCase(); }
function expose(row: ReportRow): SavedReport { return {id: row.id, createdAt: row.created_at, payload: JSON.parse(row.payload), hash: row.hash}; }
function runSnapshot(row: RunRow): ReportRun {
  return {id: row.id, planId: row.plan_id, createdAt: row.created_at, updatedAt: row.updated_at, revision: row.revision, input: JSON.parse(row.input), plan: JSON.parse(row.plan), timing: JSON.parse(row.timing), state: JSON.parse(row.state)};
}
async function readReport(db: D1Database, scope: string, id: string): Promise<ReportRow | null> {
  return db.prepare('SELECT id,created_at,request_id,payload,hash FROM demo_class_reports WHERE scope_id=? AND id=?').bind(scope, id).first<ReportRow>();
}
async function checkRequest(db: D1Database, scope: string, requestId: string, runId: string): Promise<void> {
  const used = await db.prepare('SELECT id FROM demo_class_reports WHERE scope_id=? AND request_id=?').bind(scope, requestId).first<{id: string}>();
  if (used && used.id !== runId) conflict('This request ID belongs to another report.');
}
function replay(row: ReportRow, participants: unknown): SavedReport {
  const report = expose(row);
  const validated = validateParticipants(participants, report.payload.run);
  if (canonicalReportJSON(validated) !== canonicalReportJSON(report.payload.participants.map(({athleteId, status, roundsCompleted}) => ({athleteId, status, roundsCompleted})))) conflict('This run already has a different immutable report.');
  return report;
}
export async function GET(request: Request): Promise<Response> {
  const guestId = guest(request);
  try {
    const {scopeId} = await resolveDemoIdentity(await getChatGPTUser(), guestId);
    const rows = await database().prepare('SELECT id,created_at,request_id,payload,hash FROM demo_class_reports WHERE scope_id=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(scopeId).all<ReportRow>();
    return reply({reports: rows.results.map(expose)}, guestId);
  } catch (error) {
    console.error('class_reports_read_failed', String(error));
    return reply({error: 'Could not load your reports. Please try again.', code: 'UNAVAILABLE'}, guestId, 503);
  }
}
export async function POST(request: Request): Promise<Response> {
  const guestId = guest(request);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply({error: 'Origin not allowed.', code: 'ORIGIN'}, guestId, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply({error: 'JSON required.', code: 'CONTENT_TYPE'}, guestId, 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return reply({error: 'Request too large.', code: 'BODY_TOO_LARGE'}, guestId, 413);
  try {
    let raw: string | null;
    try { raw = await readBody(request); } catch { bad('Invalid request body.'); }
    if (raw === null) return reply({error: 'Request too large.', code: 'BODY_TOO_LARGE'}, guestId, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { bad('Invalid JSON.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) bad('Invalid request.');
    const keys = ['action', 'runId', 'requestId', 'participants'];
    if (Object.keys(body).some(key => !keys.includes(key)) || keys.some(key => !(key in body)) || body.action !== 'finalize') bad('Unexpected or missing request fields.');
    const id = uuid(body.runId), requestId = uuid(body.requestId);
    const {scopeId} = await resolveDemoIdentity(await getChatGPTUser(), guestId);
    const db = database();
    await checkRequest(db, scopeId, requestId, id);
    const existing = await readReport(db, scopeId, id);
    if (existing) return reply({report: replay(existing, body.participants), duplicate: true}, guestId);
    const row = await db.prepare('SELECT id,plan_id,created_at,updated_at,revision,input,plan,timing,state,active FROM demo_class_runs WHERE scope_id=? AND id=?').bind(scopeId, id).first<RunRow>();
    if (!row) throw new ApiError('NOT_FOUND', 'Run not found.', 404);
    if (row.active) throw new ApiError('RUN_NOT_ENDED', 'End this run and refresh the coach panel before closing it out.', 409);
    const report = await buildReport(runSnapshot(row), body.participants, new Date(Date.now()).toISOString());
    // Source existence, terminal state, revision and report limit are checked
    // atomically with insertion. The report keeps its snapshot after deletion.
    const inserted = await db.prepare('INSERT OR IGNORE INTO demo_class_reports(scope_id,id,created_at,request_id,payload,hash) SELECT ?,?,?,?,?,? FROM demo_class_runs WHERE scope_id=? AND id=? AND revision=? AND active=0 AND (SELECT COUNT(*) FROM demo_class_reports WHERE scope_id=?)<100').bind(scopeId, id, report.createdAt, requestId, canonicalReportJSON(report.payload), report.hash, scopeId, id, row.revision, scopeId).run();
    await checkRequest(db, scopeId, requestId, id);
    const saved = await readReport(db, scopeId, id);
    if (saved) return reply({report: replay(saved, body.participants), duplicate: inserted.meta.changes === 0}, guestId);
    const count = await db.prepare('SELECT COUNT(*) AS total FROM demo_class_reports WHERE scope_id=?').bind(scopeId).first<{total: number}>();
    if (count && count.total >= 100) throw new ApiError('REPORT_LIMIT', 'You have reached the limit of 100 immutable demonstration reports.', 429);
    conflict('The source run changed or was deleted. Refresh before trying again.');
  } catch (error) {
    if (error instanceof ApiError) return reply({error: error.message, code: error.code}, guestId, error.status);
    if (error instanceof ReportError) return reply({error: error.message, code: error.code}, guestId, error.code === 'RUN_NOT_ENDED' ? 409 : 400);
    console.error('class_report_finalize_failed', String(error));
    return reply({error: 'The report could not be saved. Please try again.', code: 'UNAVAILABLE'}, guestId, 503);
  }
}

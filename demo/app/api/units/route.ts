import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { resolveDemoIdentity } from '@/lib/identity';
import { UnitError, UNIT_LIMITS, unitName, unitId, invitedRole, inviteCode, strictKeys, hashInvite, type InvitedRole, type UnitDetail, type UnitInvite, type UnitSnapshot } from '@/lib/units';

export const dynamic = 'force-dynamic';
type UnitRow = {id: string; owner_scope: string; name: string; owner_name: string; created_at: string};
type MemberRow = {id: string; scope_id: string; name: string; role: InvitedRole; joined_at: string; active: number};
type InviteRow = {id: string; unit_id: string; role: InvitedRole; created_at: string; expires_at: string; revoked_at: string | null; claimed_by: string | null; claimed_at: string | null; claim_nonce: string | null};
const MAX_BODY_BYTES = 20_000;
function reply(data: unknown, status = 200): Response { return Response.json(data, {status, headers: {'Cache-Control': 'no-store'}}); }
function fail(code: string, message: string, status: number): never { throw new UnitError(code, message, status); }
async function actor(): Promise<string> {
  const user = await getChatGPTUser();
  if (!user) fail('AUTH_REQUIRED', 'Sign in to manage test units.', 401);
  return (await resolveDemoIdentity(user, crypto.randomUUID())).scopeId;
}
function database(): D1Database { if (!env.DB) throw new Error('Database unavailable'); return env.DB; }
function exposeInvite(row: InviteRow, now: string): UnitInvite {
  return {id: row.id, role: row.role, createdAt: row.created_at, expiresAt: row.expires_at,
    status: row.claimed_by ? 'used' : row.revoked_at ? 'revoked' : row.expires_at <= now ? 'expired' : 'pending'};
}
async function snapshot(db: D1Database, scope: string): Promise<UnitSnapshot> {
  const rows = await db.prepare('SELECT u.* FROM demo_units u WHERE u.owner_scope=? OR EXISTS (SELECT 1 FROM demo_unit_members m WHERE m.unit_id=u.id AND m.scope_id=? AND m.active=1) ORDER BY u.created_at DESC,u.id').bind(scope, scope).all<UnitRow>();
  const now = new Date().toISOString();
  const units: UnitDetail[] = [];
  for (const row of rows.results) {
    const members = await db.prepare('SELECT id,scope_id,name,role,joined_at,active FROM demo_unit_members WHERE unit_id=? AND active=1 ORDER BY joined_at,id').bind(row.id).all<MemberRow>();
    const isOwner = row.owner_scope === scope;
    const me = members.results.find(m => m.scope_id === scope);
    // Membership may have been removed between these two reads.
    if (!isOwner && !me) continue;
    const myRole = isOwner ? 'owner' : me!.role;
    const unit: UnitDetail = {id: row.id, name: row.name, createdAt: row.created_at, myRole, memberCount: members.results.length + 1,
      members: [
        ...(myRole !== 'athlete' ? [{id: 'owner', name: row.owner_name, role: 'owner' as const, joinedAt: row.created_at, isSelf: isOwner}] : []),
        ...members.results.filter(m => myRole !== 'athlete' || m.scope_id === scope).map(m => ({id: m.id, name: m.name, role: m.role, joinedAt: m.joined_at, isSelf: m.scope_id === scope})),
      ]};
    if (isOwner) {
      const invites = await db.prepare('SELECT * FROM demo_unit_invites WHERE unit_id=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(row.id).all<InviteRow>();
      unit.invitations = invites.results.map(invite => exposeInvite(invite, now));
    }
    units.push(unit);
  }
  return {units, ownedUnitId: units.find(u => u.myRole === 'owner')?.id ?? null};
}
async function owner(db: D1Database, scope: string, id: string): Promise<UnitRow> {
  const unit = await db.prepare('SELECT * FROM demo_units WHERE id=?').bind(id).first<UnitRow>();
  if (!unit) fail('NOT_FOUND', 'Unit not found.', 404);
  if (unit.owner_scope !== scope) fail('FORBIDDEN', 'Only the unit owner can do this.', 403);
  return unit;
}
async function readBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';
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
  try { return new TextDecoder('utf-8', {fatal: true}).decode(joined); } catch { return fail('INVALID_INPUT', 'Invalid JSON.', 400); }
}
function errorResponse(error: unknown): Response {
  if (error instanceof UnitError) return reply({error: error.message, code: error.code}, error.status);
  // Never log bodies, invitation secrets, or D1 error bindings.
  console.error('test_unit_action_failed');
  return reply({error: 'Could not update test units. Please try again.', code: 'UNAVAILABLE'}, 503);
}
export async function GET(): Promise<Response> {
  try { const scope = await actor(); return reply(await snapshot(database(), scope)); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply({error: 'Origin not allowed.', code: 'ORIGIN'}, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply({error: 'JSON required.', code: 'CONTENT_TYPE'}, 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return reply({error: 'Request too large.', code: 'BODY_TOO_LARGE'}, 413);
  try {
    const scope = await actor();
    let body: Record<string, unknown>;
    try { body = JSON.parse(await readBody(request)); } catch (error) { if (error instanceof UnitError) throw error; return fail('INVALID_INPUT', 'Invalid JSON.', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('INVALID_INPUT', 'Invalid request.', 400);
    const db = database(); const now = new Date().toISOString();
    if (body.action === 'create') {
      strictKeys(body, ['action', 'requestId', 'name', 'displayName']);
      const id = unitId(body.requestId), name = unitName(body.name, 80), displayName = unitName(body.displayName, 60);
      const result = await db.prepare('INSERT OR IGNORE INTO demo_units(id,owner_scope,name,owner_name,created_at) VALUES(?,?,?,?,?)').bind(id, scope, name, displayName, now).run();
      const saved = await db.prepare('SELECT * FROM demo_units WHERE id=?').bind(id).first<UnitRow>();
      if (saved && (saved.owner_scope !== scope || saved.name !== name || saved.owner_name !== displayName)) fail('CONFLICT', 'This request ID already has different input.', 409);
      if (!saved) fail('UNIT_LIMIT', 'You already own a test unit.', 429);
      return reply({...await snapshot(db, scope), duplicate: result.meta.changes === 0});
    }
    if (body.action === 'invite') {
      strictKeys(body, ['action', 'unitId', 'requestId', 'role']);
      const id = unitId(body.unitId), requestId = unitId(body.requestId), role = invitedRole(body.role);
      await owner(db, scope, id);
      const existing = await db.prepare('SELECT * FROM demo_unit_invites WHERE id=?').bind(requestId).first<InviteRow>();
      if (existing) {
        if (existing.unit_id !== id || existing.role !== role) fail('CONFLICT', 'This request ID already has different input.', 409);
        return reply({...await snapshot(db, scope), invitation: exposeInvite(existing, now), inviteCode: null, duplicate: true});
      }
      const code = [...crypto.getRandomValues(new Uint8Array(16))].map(v => v.toString(16).padStart(2, '0')).join('');
      const hash = await hashInvite(code), expires = new Date(Date.parse(now) + UNIT_LIMITS.inviteDays * 86400000).toISOString();
      const created = await db.prepare(`INSERT OR IGNORE INTO demo_unit_invites(id,unit_id,role,code_hash,created_at,expires_at)
        SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM demo_unit_invites WHERE unit_id=?)<100
        AND (SELECT COUNT(*) FROM demo_unit_invites WHERE unit_id=? AND claimed_by IS NULL AND revoked_at IS NULL AND expires_at>?)<10`).bind(requestId, id, role, hash, now, expires, id, id, now).run();
      const saved = await db.prepare('SELECT * FROM demo_unit_invites WHERE id=?').bind(requestId).first<InviteRow>();
      if (!saved) fail('INVITE_LIMIT', 'Invitation limit reached.', 429);
      if (saved.unit_id !== id || saved.role !== role) fail('CONFLICT', 'This request ID already has different input.', 409);
      return reply({...await snapshot(db, scope), invitation: exposeInvite(saved, now), inviteCode: created.meta.changes ? code : null, duplicate: !created.meta.changes});
    }
    if (body.action === 'accept') {
      strictKeys(body, ['action', 'code', 'displayName']);
      const hash = await hashInvite(inviteCode(body.code)), name = unitName(body.displayName, 60);
      const nonce = crypto.randomUUID(), memberId = crypto.randomUUID();
      // D1 batch is a transaction. Only the invocation that claims this nonce can insert.
      await db.batch([
        db.prepare(`UPDATE demo_unit_invites SET claimed_by=?,claimed_at=?,claim_nonce=? WHERE code_hash=? AND claimed_by IS NULL AND revoked_at IS NULL AND expires_at>?
          AND EXISTS (SELECT 1 FROM demo_units u WHERE u.id=demo_unit_invites.unit_id AND u.owner_scope<>?)
          AND NOT EXISTS (SELECT 1 FROM demo_unit_members m WHERE m.unit_id=demo_unit_invites.unit_id AND m.scope_id=? AND m.active=1)
          AND (SELECT COUNT(*) FROM demo_unit_members m WHERE m.unit_id=demo_unit_invites.unit_id AND m.active=1)<49
          AND (SELECT COUNT(*) FROM demo_unit_members m WHERE m.scope_id=? AND m.active=1)<10`).bind(scope, now, nonce, hash, now, scope, scope, scope),
        db.prepare(`INSERT INTO demo_unit_members(unit_id,scope_id,id,name,role,joined_at,active)
          SELECT unit_id,?,?,?,role,?,1 FROM demo_unit_invites WHERE code_hash=? AND claim_nonce=? AND claimed_by=?
          ON CONFLICT(unit_id,scope_id) DO UPDATE SET name=excluded.name,role=excluded.role,joined_at=excluded.joined_at,active=1`).bind(scope, memberId, name, now, hash, nonce, scope),
      ]);
      const invite = await db.prepare('SELECT * FROM demo_unit_invites WHERE code_hash=?').bind(hash).first<InviteRow>();
      if (!invite) fail('INVALID_INVITE', 'Invitation is unavailable.', 409);
      const membership = await db.prepare('SELECT id,scope_id,name,role,joined_at,active FROM demo_unit_members WHERE unit_id=? AND scope_id=?').bind(invite.unit_id, scope).first<MemberRow>();
      if (invite.claimed_by === scope && membership?.active) return reply({...await snapshot(db, scope), duplicate: invite.claim_nonce !== nonce});
      if (invite.claimed_by || invite.revoked_at || invite.expires_at <= now) fail('INVALID_INVITE', 'Invitation is unavailable.', 409);
      const unit = await db.prepare('SELECT * FROM demo_units WHERE id=?').bind(invite.unit_id).first<UnitRow>();
      if (membership?.active || unit?.owner_scope === scope) fail('ALREADY_MEMBER', 'You already belong to this unit.', 409);
      const joined = await db.prepare('SELECT COUNT(*) AS count FROM demo_unit_members WHERE scope_id=? AND active=1').bind(scope).first<{count: number}>();
      if ((joined?.count ?? 0) >= UNIT_LIMITS.joined) fail('UNIT_LIMIT', 'You have reached the joined-unit limit.', 429);
      const count = await db.prepare('SELECT COUNT(*) AS count FROM demo_unit_members WHERE unit_id=? AND active=1').bind(invite.unit_id).first<{count: number}>();
      if ((count?.count ?? 0) >= UNIT_LIMITS.members - 1) fail('MEMBER_LIMIT', 'This unit is full.', 429);
      fail('INVALID_INVITE', 'Invitation is unavailable.', 409);
    }
    if (body.action === 'revoke_invite') {
      strictKeys(body, ['action', 'unitId', 'id']);
      const id = unitId(body.unitId), invitationId = unitId(body.id); await owner(db, scope, id);
      const changed = await db.prepare('UPDATE demo_unit_invites SET revoked_at=? WHERE unit_id=? AND id=? AND claimed_by IS NULL AND revoked_at IS NULL AND expires_at>?').bind(now, id, invitationId, now).run();
      if (!changed.meta.changes) fail('CONFLICT', 'Invitation is no longer pending.', 409);
      return reply(await snapshot(db, scope));
    }
    if (body.action === 'set_role' || body.action === 'remove_member') {
      strictKeys(body, body.action === 'set_role' ? ['action', 'unitId', 'memberId', 'role'] : ['action', 'unitId', 'memberId']);
      const id = unitId(body.unitId);
      if (body.memberId === 'owner') fail('FORBIDDEN', 'The owner role cannot be changed.', 403);
      const memberId = unitId(body.memberId); await owner(db, scope, id);
      const result = body.action === 'set_role'
        ? await db.prepare('UPDATE demo_unit_members SET role=? WHERE unit_id=? AND id=? AND active=1').bind(invitedRole(body.role), id, memberId).run()
        : await db.prepare('UPDATE demo_unit_members SET active=0 WHERE unit_id=? AND id=? AND active=1').bind(id, memberId).run();
      if (!result.meta.changes) fail('NOT_FOUND', 'Active member not found.', 404);
      return reply(await snapshot(db, scope));
    }
    if (body.action === 'leave') {
      strictKeys(body, ['action', 'unitId']); const id = unitId(body.unitId);
      const unit = await db.prepare('SELECT * FROM demo_units WHERE id=?').bind(id).first<UnitRow>();
      if (unit?.owner_scope === scope) fail('FORBIDDEN', 'The unit owner cannot leave.', 403);
      const changed = await db.prepare('UPDATE demo_unit_members SET active=0 WHERE unit_id=? AND scope_id=? AND active=1').bind(id, scope).run();
      if (!changed.meta.changes) fail('NOT_FOUND', 'Active membership not found.', 404);
      return reply(await snapshot(db, scope));
    }
    fail('INVALID_INPUT', 'Unknown action.', 400);
  } catch (error) { return errorResponse(error); }
}

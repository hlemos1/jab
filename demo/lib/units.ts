/** Test-unit membership. These roles never grant access to private demo classes. */
export type UnitRole = 'owner' | 'coach' | 'athlete';
export type InvitedRole = Exclude<UnitRole, 'owner'>;
export type UnitMember = {id: string; name: string; role: UnitRole; joinedAt: string; isSelf: boolean};
export type UnitInvite = {id: string; role: InvitedRole; createdAt: string; expiresAt: string; status: 'pending' | 'used' | 'revoked' | 'expired'};
export type UnitDetail = {id: string; name: string; createdAt: string; myRole: UnitRole; memberCount: number; members: UnitMember[]; invitations?: UnitInvite[]};
export type UnitSnapshot = {units: UnitDetail[]; ownedUnitId: string | null};
export type UnitResponse = UnitSnapshot & {invitation?: UnitInvite; inviteCode?: string | null; duplicate?: boolean};
export class UnitError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = 'UnitError'; }
}
export const UNIT_LIMITS = {owned: 1, joined: 10, members: 50, pendingInvites: 10, totalInvites: 100, inviteDays: 7} as const;
export function unitName(value: unknown, max: number): string {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f]/.test(value)) throw new UnitError('INVALID_INPUT', 'Invalid name.');
  const clean = value.trim();
  if (!clean || [...clean].length > max) throw new UnitError('INVALID_INPUT', 'Invalid name length.');
  return clean;
}
export function unitId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new UnitError('INVALID_INPUT', 'Invalid ID.');
  return value.toLowerCase();
}
export function invitedRole(value: unknown): InvitedRole {
  if (value !== 'coach' && value !== 'athlete') throw new UnitError('INVALID_INPUT', 'Invalid role.');
  return value;
}
export function inviteCode(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{32}$/i.test(value.trim())) throw new UnitError('INVALID_INPUT', 'Invalid invitation code.');
  return value.trim().toLowerCase();
}
export function strictKeys(body: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(body).some(key => !keys.includes(key)) || keys.some(key => !(key in body))) throw new UnitError('INVALID_INPUT', 'Invalid request fields.');
}
export async function hashInvite(code: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('');
}

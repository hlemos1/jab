/** Server-side scope selection. Pass only the identity returned by Sites auth. */
export type SiteUser = { userId: string; fullName: string | null };
export type DemoIdentity = {
  mode: 'account' | 'guest';
  displayName: string | null;
  signInUrl: string;
  signOutUrl: string;
};
const RETURN_TO = encodeURIComponent('/?view=account');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function demoGuestId(cookieValue: string | undefined): string {
  return cookieValue && UUID.test(cookieValue) ? cookieValue : crypto.randomUUID();
}
export async function resolveDemoIdentity(user: SiteUser | null, guestId: string): Promise<{scopeId: string; identity: DemoIdentity}> {
  const identity: DemoIdentity = {
    mode: user ? 'account' : 'guest',
    displayName: user?.fullName || null,
    signInUrl: `/signin-with-chatgpt?return_to=${RETURN_TO}`,
    signOutUrl: `/signout-with-chatgpt?return_to=${RETURN_TO}`,
  };
  if (!user) return { scopeId: demoGuestId(guestId), identity };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.userId));
  const scopeId = 'account:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return { scopeId, identity };
}
export function validDemoProfile(name: unknown, avatar: unknown): {name: string; avatar: string} | null {
  if (typeof name !== 'string' || typeof avatar !== 'string') return null;
  const clean = name.trim();
  if (!clean || [...clean].length > 32 || /[\u0000-\u001f\u007f-\u009f]/.test(clean) || !['01', '02', '03', '04'].includes(avatar)) return null;
  return { name: clean, avatar };
}

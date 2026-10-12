import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's native TypeScript runner requires explicit extension.
import { demoGuestId, resolveDemoIdentity, validDemoProfile } from '../lib/identity.ts';
const first='11111111-1111-4111-8111-111111111111';
const second='22222222-2222-4222-8222-222222222222';
test('account scope is stable across cookies and distinct across users and guests',async()=>{
  const a=await resolveDemoIdentity({userId:'site-user-A',fullName:'Ana'},first);
  const b=await resolveDemoIdentity({userId:'site-user-A',fullName:'Ana'},second);
  const other=await resolveDemoIdentity({userId:'site-user-B',fullName:'Ana'},first);
  assert.equal(a.scopeId,b.scopeId);
  assert.match(a.scopeId,/^account:[a-f0-9]{64}$/);
  assert.notEqual(a.scopeId,other.scopeId);
  assert.equal((await resolveDemoIdentity(null,first)).scopeId,first);
  assert.notEqual(a.scopeId,first);
  assert.equal(a.identity.mode,'account');
  assert.equal(a.identity.displayName,'Ana');
  assert.ok(!JSON.stringify(a.identity).includes('site-user-A'));
});
test('untrusted cookie cannot choose an account namespace',async()=>{
  const target=(await resolveDemoIdentity({userId:'victim',fullName:null},first)).scopeId;
  assert.notEqual(demoGuestId(target),target);
  assert.notEqual((await resolveDemoIdentity(null,target)).scopeId,target);
  assert.equal(demoGuestId(first),first);
  for(const invalid of ['../account', '-'.repeat(36), 'a'.repeat(36), ''])assert.notEqual(demoGuestId(invalid),invalid);
});
test('identity exposes native auth return links and no email fallback',async()=>{
  const identity=(await resolveDemoIdentity({userId:'A',fullName:null},first)).identity;
  assert.equal(identity.displayName,null);
  assert.equal(identity.signInUrl,'/signin-with-chatgpt?return_to=%2F%3Fview%3Daccount');
  assert.equal(identity.signOutUrl,'/signout-with-chatgpt?return_to=%2F%3Fview%3Daccount');
});
test('profile bounds reject invalid data instead of silently truncating it',()=>{
  assert.deepEqual(validDemoProfile('  Henrique  ','01'),{name:'Henrique',avatar:'01'});
  assert.ok(validDemoProfile('A'.repeat(32),'04'));
  for(const [name,avatar] of [['','01'],['  ','01'],['A'.repeat(33),'01'],['A\nB','01'],['A','00'],['A','05'],['A','01<script>'],[{},'01'],['A',null]])assert.equal(validDemoProfile(name,avatar),null);
});

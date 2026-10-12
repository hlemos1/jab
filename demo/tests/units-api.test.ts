import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
// @ts-expect-error Native test runner needs the extension.
import * as identity from '../lib/identity.ts';

const id = (n: number) => `dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12,'0')}`;
const account = (userId: string) => ({userId,fullName:userId});
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Actual migrated SQLite and actual route, replacing only Sites auth and D1.
 * D1 batch is one transaction: no sequential async mock that leaks partial writes. */
function harness() {
  let user: {userId:string;fullName:string|null}|null = account('owner');
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const execute = (sql:string,args:any[]) => {
    const stmt=sqlite.prepare(sql);
    const results=stmt.columns().length ? stmt.all(...args) : [];
    const changes=results.length ? results.length : (stmt.columns().length ? 0 : Number(stmt.run(...args).changes));
    return {success:true,results,meta:{changes}};
  };
  const db = {
    prepare(sql:string) {
      let args:any[]=[];
      return {bind(...values:any[]){args=values;return this;},_execute:()=>execute(sql,args),async first(column?:string){const row=sqlite.prepare(sql).get(...args)??null;return row&&column?row[column]:row;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return execute(sql,args);}};
    },
    async batch(statements:any[]) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {const results=statements.map(s=>s._execute());sqlite.exec('COMMIT');return results;}
      catch(error){sqlite.exec('ROLLBACK');throw error;}
    },
  };
  const modules:Record<string,unknown>={'cloudflare:workers':{env:{DB:db}},'@/app/chatgpt-auth':{getChatGPTUser:async()=>user},'@/lib/identity':identity};
  function load(relative:string) {
    const code=ts.transpileModule(readFileSync(new URL(relative,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const result:any={};new Function('require','exports',code)((name:string)=>{assert.ok(name in modules,name);return modules[name];},result);return result;
  }
  modules['@/lib/units']=load('../lib/units.ts');
  const api=load('../app/api/units/route.ts');
  const request=(body?:unknown,headers:Record<string,string>={})=>new Request('https://demo.example/api/units',{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://demo.example',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {api,sqlite,db,request,setUser:(value:typeof user)=>{user=value;},post:(value:unknown)=>api.POST(request(value)),get:()=>api.GET(request())};
}
async function body(response:Response,status=200):Promise<any>{assert.equal(response.status,status,await response.clone().text());return response.json();}
const create = (n=1,name='Carcavelos') => ({action:'create',requestId:id(n),name,displayName:'Henrique'});
const invite = (unitId:string,n=2,role='coach') => ({action:'invite',unitId,requestId:id(n),role});
const accept = (code:string,displayName='Ana') => ({action:'accept',code,displayName});
async function denied(response:Response){assert.ok([403,404].includes(response.status),`${response.status}: ${await response.text()}`);}

test('units require trusted account identity; cookies, body and forged headers cannot substitute',async()=>{
  const h=harness();h.setUser(null);
  await body(await h.get(),401);
  await body(await h.post(create()),401);
  await body(await h.api.POST(h.request({...create(),scopeId:'account:'+hash('owner')},{cookie:'strikex_demo_v1='+id(1),'x-user-id':'owner'})),401);
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM demo_units').get()!.n,0);h.sqlite.close();
});

test('creation retries preserve original unit and one account cannot own two',async()=>{
  const h=harness();const saved=await body(await h.post(create()));
  assert.equal(saved.units.length,1);assert.equal(saved.units[0].myRole,'owner');assert.equal(saved.units[0].members[0].isSelf,true);
  assert.equal(saved.ownedUnitId,id(1));
  const replay=await body(await h.post(create()));assert.equal(replay.duplicate,true);assert.deepEqual(replay.units,saved.units);
  await body(await h.post(create(1,'Different')),409);
  const second=await h.post(create(2));assert.ok([409,429].includes(second.status));
  h.setUser(account('stranger'));assert.deepEqual((await body(await h.get())).units,[]);
  await denied(await h.post(invite(id(1))));
  const response=await h.get();assert.equal(response.headers.get('cache-control'),'no-store');h.sqlite.close();
});

test('invitation secret appears only once and storage contains only its SHA256 hash',async()=>{
  const h=harness();await body(await h.post(create()));
  const made=await body(await h.post(invite(id(1))));assert.match(made.inviteCode,/^[a-f0-9]{32}$/);
  assert.equal(Date.parse(made.invitation.expiresAt)-Date.parse(made.invitation.createdAt),7*24*60*60*1000);
  const row=h.sqlite.prepare('SELECT * FROM demo_unit_invites').get()!;assert.equal(row.code_hash,hash(made.inviteCode));
  assert.ok(!JSON.stringify(row).includes(made.inviteCode));
  const replay=await body(await h.post(invite(id(1))));assert.equal(replay.duplicate,true);assert.equal(replay.inviteCode,null);
  const snapshot=JSON.stringify(await body(await h.get()));assert.ok(!snapshot.includes(made.inviteCode));assert.ok(!snapshot.includes(row.code_hash as string));
  await body(await h.post(invite(id(1),2,'athlete')),409);h.sqlite.close();
});

test('coach sees roster, athlete only self; only owner can manage membership',async()=>{
  const h=harness();await body(await h.post(create()));
  const coach=await body(await h.post(invite(id(1),2,'coach')));
  const athlete=await body(await h.post(invite(id(1),3,'athlete')));
  h.setUser(account('coach'));await body(await h.post(accept(coach.inviteCode,'Coach')));
  h.setUser(account('athlete'));const joined=await body(await h.post(accept(athlete.inviteCode,'Athlete')));
  assert.equal(joined.units[0].members.length,1);assert.equal(joined.units[0].members[0].name,'Athlete');assert.equal(joined.units[0].memberCount,3);
  assert.equal(joined.units[0].invitations,undefined);const athleteId=joined.units[0].members[0].id;
  h.setUser(account('coach'));const roster=await body(await h.get());assert.equal(roster.units[0].members.length,3);assert.equal(roster.units[0].invitations,undefined);
  for(const command of [invite(id(1),4),{action:'set_role',unitId:id(1),memberId:athleteId,role:'coach'},{action:'remove_member',unitId:id(1),memberId:athleteId},{action:'revoke_invite',unitId:id(1),id:id(3)}])await denied(await h.post(command));
  h.setUser(account('owner'));await body(await h.post({action:'set_role',unitId:id(1),memberId:athleteId,role:'coach'}));
  h.setUser(account('athlete'));assert.equal((await body(await h.get())).units[0].myRole,'coach');h.sqlite.close();
});

test('same account retry is idempotent; another account cannot consume claimed invite',async()=>{
  const h=harness();await body(await h.post(create()));const made=await body(await h.post(invite(id(1))));
  h.setUser(account('coach'));const first=await body(await h.post(accept(made.inviteCode)));
  const retry=await body(await h.post(accept(made.inviteCode)));assert.equal(retry.duplicate,true);assert.deepEqual(retry.units,first.units);
  h.setUser(account('other'));const response=await h.post(accept(made.inviteCode));assert.ok([404,409,410].includes(response.status));
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM demo_unit_members WHERE active=1').get()!.n,1);h.sqlite.close();
});

test('removal blocks old invite replay; fresh invite rejoins with stable member ID',async()=>{
  const h=harness();await body(await h.post(create()));let made=await body(await h.post(invite(id(1))));
  h.setUser(account('coach'));const first=await body(await h.post(accept(made.inviteCode)));const memberId=first.units[0].members.find((m:any)=>m.isSelf).id;
  h.setUser(account('owner'));await body(await h.post({action:'remove_member',unitId:id(1),memberId}));
  h.setUser(account('coach'));assert.equal((await body(await h.get())).units.length,0);
  assert.notEqual((await h.post(accept(made.inviteCode))).status,200);
  h.setUser(account('owner'));made=await body(await h.post(invite(id(1),3,'athlete')));
  h.setUser(account('coach'));const rejoined=await body(await h.post(accept(made.inviteCode,'New name')));
  assert.equal(rejoined.units[0].members[0].id,memberId);assert.equal(rejoined.units[0].myRole,'athlete');
  await body(await h.post({action:'leave',unitId:id(1)}));assert.equal((await body(await h.get())).units.length,0);h.sqlite.close();
});

test('invites cannot change active roles and owner cannot leave or demote self',async()=>{
  const h=harness();const own=await body(await h.post(create()));const memberId=own.units[0].members[0].id;
  assert.notEqual((await h.post({action:'leave',unitId:id(1)})).status,200);
  assert.notEqual((await h.post({action:'set_role',unitId:id(1),memberId,role:'coach'})).status,200);
  assert.notEqual((await h.post({action:'remove_member',unitId:id(1),memberId})).status,200);
  const initial=await body(await h.post(invite(id(1),2,'athlete')));const upgrade=await body(await h.post(invite(id(1),3,'coach')));
  h.setUser(account('athlete'));await body(await h.post(accept(initial.inviteCode)));await body(await h.post(accept(upgrade.inviteCode)),409);
  assert.equal((await body(await h.get())).units[0].myRole,'athlete');
  assert.equal(h.sqlite.prepare('SELECT claimed_by FROM demo_unit_invites WHERE id=?').get(id(3))!.claimed_by,null);h.sqlite.close();
});

test('expired and revoked invitations cannot be accepted',async()=>{
  const h=harness();await body(await h.post(create()));const expired=await body(await h.post(invite(id(1),2)));const revoked=await body(await h.post(invite(id(1),3)));
  h.sqlite.prepare('UPDATE demo_unit_invites SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',id(2));
  await body(await h.post({action:'revoke_invite',unitId:id(1),id:id(3)}));
  h.setUser(account('invitee'));for(const code of [expired.inviteCode,revoked.inviteCode])assert.notEqual((await h.post(accept(code))).status,200);
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM demo_unit_members').get()!.n,0);h.sqlite.close();
});

test('unit boundary validates names, explicit roles, strict payload, origin and byte limit',async()=>{
  const h=harness();
  for(const patch of [{name:''},{name:'x'.repeat(81)},{displayName:'x'.repeat(61)},{name:'Bad\u0000name'},{displayName:'Bad\nname'},{ownerScope:'forged'}])await body(await h.post({...create(),...patch}),400);
  await body(await h.api.POST(h.request(create(),{Origin:'https://evil.example'})),403);
  await body(await h.api.POST(h.request(create(),{'Content-Type':'text/plain'})),415);
  await body(await h.post({...create(),padding:'💥'.repeat(6000)}),413);
  await body(await h.post({...create(),name:'  Lisboa  ',displayName:'  Rão  '}));
  const unit=(await body(await h.get())).units[0];assert.equal(unit.name,'Lisboa');assert.equal(unit.members[0].name,'Rão');
  await body(await h.post(invite(id(1),2,'owner')),400);h.sqlite.close();
});

test('D1 test double rolls back an entire failed batch',async()=>{
  const h=harness();
  await assert.rejects(h.db.batch([h.db.prepare('INSERT INTO demo_units(id,owner_scope,name,owner_name,created_at) VALUES(?,?,?,?,?)').bind(id(1),'scope','Unit','Owner','now'),h.db.prepare('INSERT INTO missing_table VALUES(1)')]));
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM demo_units').get()!.n,0);h.sqlite.close();
});

test('owning another unit does not allow cross-unit member or invite mutation',async()=>{
  const h=harness();await body(await h.post(create()));const made=await body(await h.post(invite(id(1))));
  h.setUser(account('member'));const joined=await body(await h.post(accept(made.inviteCode)));const memberId=joined.units[0].members.find((m:any)=>m.isSelf).id;
  h.setUser(account('second-owner'));await body(await h.post(create(10,'Other unit')));
  await denied(await h.post({action:'remove_member',unitId:id(1),memberId}));
  await body(await h.post({action:'remove_member',unitId:id(10),memberId}),404);
  await denied(await h.post({action:'set_role',unitId:id(1),memberId,role:'athlete'}));
  await denied(await h.post({action:'revoke_invite',unitId:id(1),id:id(2)}));
  h.setUser(account('member'));assert.equal((await body(await h.get())).units[0].myRole,'coach');h.sqlite.close();
});

test('at capacity API rejects new invites but permits exact request replay',async()=>{
  const h=harness();await body(await h.post(create()));
  for(let i=2;i<12;i++)await body(await h.post(invite(id(1),i)));
  assert.equal((await body(await h.post(invite(id(1),12)),429)).code,'INVITE_LIMIT');
  assert.equal((await body(await h.post(invite(id(1),2)))).duplicate,true);
  h.sqlite.exec("UPDATE demo_unit_invites SET revoked_at='2026-10-12T00:00:00.000Z'");
  await body(await h.post(invite(id(1),12)));h.sqlite.close();
});

test('full unit rejects acceptance without burning the invitation',async()=>{
  const h=harness();await body(await h.post(create()));const made=await body(await h.post(invite(id(1))));
  for(let n=0;n<49;n++)h.sqlite.prepare('INSERT INTO demo_unit_members(unit_id,scope_id,id,name,role,joined_at,active) VALUES(?,?,?,?,?,?,1)').run(id(1),'seed-'+n,id(100+n),'Seed','athlete','2026-10-12T00:00:00.000Z');
  h.setUser(account('new-member'));
  assert.equal((await body(await h.post(accept(made.inviteCode)),429)).code,'MEMBER_LIMIT');
  assert.equal(h.sqlite.prepare('SELECT claimed_by FROM demo_unit_invites WHERE id=?').get(id(2))!.claimed_by,null);
  h.sqlite.prepare('UPDATE demo_unit_members SET active=0 WHERE id=?').run(id(100));
  await body(await h.post(accept(made.inviteCode)));h.sqlite.close();
});

test('a failed membership insert rolls back invitation claim through actual API',async()=>{
  const h=harness();await body(await h.post(create()));const made=await body(await h.post(invite(id(1))));
  h.sqlite.exec("CREATE TRIGGER fail_join BEFORE INSERT ON demo_unit_members BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  h.setUser(account('new-member'));await body(await h.post(accept(made.inviteCode)),503);
  assert.equal(h.sqlite.prepare('SELECT claimed_by FROM demo_unit_invites').get()!.claimed_by,null);
  h.sqlite.exec('DROP TRIGGER fail_join');await body(await h.post(accept(made.inviteCode)));h.sqlite.close();
});

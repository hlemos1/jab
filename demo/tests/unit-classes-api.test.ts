import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const id=(n:number)=>`eeeeeeee-eeee-4eee-8eee-${String(n).padStart(12,'0')}`;
const scope=(name:string)=>'account:'+createHash('sha256').update(name).digest('hex');
const timing={workSeconds:5,restSeconds:0};
const create=(requestId=id(100),unitId=id(1),members=[id(11),id(12)])=>({action:'create',unitId,requestId,name:'Morning class',athletes:members.map(memberId=>({memberId,excludedStations:[]})),timing});
const command=(action:string,expectedRevision:number,requestId=id(200+expectedRevision),runId=id(100),unitId=id(1))=>({action,unitId,id:runId,requestId,expectedRevision});

/** Actual migrated SQLite and actual handlers. Only trusted auth, time and the D1
 * transport are substituted. Hooks simulate membership changes before SQL writes. */
function harness(){
  let user:{userId:string;fullName:string|null}|null={userId:'owner',fullName:'Owner'};
  let now=1_790_000_000_000;
  let beforeWrite:((sql:string)=>void)|null=null;
  let beforeBatch:(()=>void)|null=null;
  const sqlite=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const execute=(sql:string,args:any[])=>{
    if(/^\s*(?:INSERT|UPDATE|DELETE)/i.test(sql))beforeWrite?.(sql);
    const stmt=sqlite.prepare(sql);
    if(stmt.columns().length){const results=stmt.all(...args);return {success:true,results,meta:{changes:results.length}};}
    return {success:true,results:[],meta:{changes:Number(stmt.run(...args).changes)}};
  };
  const db={prepare(sql:string){let args:any[]=[];return {bind(...values:any[]){args=values;return this;},_execute:()=>execute(sql,args),async first(column?:string){const row=execute(sql,args).results[0]??null;return row&&column?row[column]:row;},async all(){return execute(sql,args);},async run(){return execute(sql,args);}};},async batch(statements:any[]){beforeBatch?.();sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s._execute());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  class ClockDate extends Date{static now(){return now;}}
  const modules:Record<string,any>={'cloudflare:workers':{env:{DB:db}},'@/app/chatgpt-auth':{getChatGPTUser:async()=>user}};
  function load(path:string):any{
    if(path in modules)return modules[path];
    const result:any={};modules[path]=result;
    const file=path.startsWith('@/')?'../'+path.slice(2)+'.ts':path;
    const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','exports','Date',code)((name:string)=>{if(name.startsWith('./'))return load('@/lib/'+name.slice(2));assert.ok(name.startsWith('@/')||name in modules,name);return load(name);},result,ClockDate);
    return result;
  }
  const api=load('../app/api/unit-classes/route.ts');
  const request=(body?:unknown,unitId=id(1),headers:Record<string,string>={})=>new Request('https://demo.example/api/unit-classes?unitId='+unitId,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://demo.example',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const seedUnit=(unitId=id(1),owner='owner')=>sqlite.prepare('INSERT INTO demo_units(id,owner_scope,name,owner_name,created_at) VALUES(?,?,?,?,?)').run(unitId,scope(owner),'Unit '+unitId,'Owner private name',new Date(now).toISOString());
  const seedMember=(memberId:string,name:string,role='athlete',unitId=id(1),active=1)=>sqlite.prepare('INSERT INTO demo_unit_members(unit_id,scope_id,id,name,role,joined_at,active) VALUES(?,?,?,?,?,?,?)').run(unitId,scope(name),memberId,name,role,new Date(now).toISOString(),active);
  seedUnit();seedMember(id(10),'coach','coach');seedMember(id(11),'Alice Private');seedMember(id(12),'Bob Private');seedMember(id(13),'not-enrolled');
  return {sqlite,api,request,seedUnit,seedMember,post:(value:unknown)=>api.POST(request(value)),get:(unitId=id(1))=>api.GET(request(undefined,unitId)),setUser:(name:string|null)=>{user=name?{userId:name,fullName:name}:null;},now:()=>now,advance:(ms:number)=>{now+=ms;},hook:(value:typeof beforeWrite)=>{beforeWrite=value;},hookBeforeBatch:(value:typeof beforeBatch)=>{beforeBatch=value;}};
}
async function body(response:Response,status=200):Promise<any>{assert.equal(response.status,status,await response.clone().text());return response.json();}
async function denied(response:Response){assert.ok([403,404].includes(response.status),`${response.status}: ${await response.text()}`);}

 test('unit classes require trusted sign-in; forged identity headers/cookies never grant access',async()=>{
  const h=harness();h.setUser(null);await body(await h.get(),401);await body(await h.post(create()),401);
  await body(await h.api.POST(h.request(create(),id(1),{'x-user-id':'owner',cookie:'strikex_demo_v1='+id(1)})),401);
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM demo_unit_classes').get()!.n,0);h.sqlite.close();
});

test('owner and current coach share the same immutable class snapshot',async()=>{
  const h=harness();const saved=await body(await h.post(create()));assert.equal(saved.run.unitId,id(1));assert.equal(saved.run.state.status,'ready');assert.equal(saved.run.revision,0);assert.equal(saved.serverNow,h.now());
  assert.deepEqual(saved.run.athletes.map((a:any)=>a.name),['Alice Private','Bob Private']);assert.ok(saved.run.athletes.every((a:any)=>a.stations.length===12));
  h.setUser('coach');assert.deepEqual((await body(await h.get())).runs[0],saved.run);
  h.sqlite.prepare('UPDATE demo_unit_members SET name=? WHERE id=?').run('Renamed',id(11));
  assert.deepEqual((await body(await h.get())).runs[0].athletes,saved.run.athletes);
  assert.equal((await h.get()).headers.get('cache-control'),'no-store');h.sqlite.close();
});

test('athlete response contains only own enrollment and no teammate name, ID, assignment or scope',async()=>{
  const h=harness();await body(await h.post(create()));h.setUser('Alice Private');const visible=await body(await h.get());
  assert.equal(visible.runs.length,1);assert.equal(visible.runs[0].athletes.length,1);assert.equal(visible.runs[0].athletes[0].memberId,id(11));assert.equal(visible.runs[0].athletes[0].stations.length,12);
  const serialized=JSON.stringify(visible);for(const secret of ['Bob Private',id(12),'Owner private name','account:',scope('Alice Private')])assert.ok(!serialized.includes(secret),secret);
  assert.equal(visible.runs[0].input,undefined);assert.equal(visible.runs[0].plan,undefined);assert.equal(visible.runs[0].request_input,undefined);
  h.setUser('not-enrolled');assert.deepEqual((await body(await h.get())).runs,[]);h.sqlite.close();
});

test('athletes cannot create, control, delete, or replay privileged class actions',async()=>{
  const h=harness();await body(await h.post(create()));h.setUser('Alice Private');
  for(const payload of [create(),create(id(101)),command('start',0),command('pause',0),command('resume',0),command('interrupt',0),{action:'delete',unitId:id(1),id:id(100),expectedRevision:0}])await denied(await h.post(payload));
  h.setUser('owner');assert.equal((await body(await h.get())).runs[0].state.status,'ready');h.sqlite.close();
});

test('outsiders and another unit owner cannot read or mutate this unit',async()=>{
  const h=harness();await body(await h.post(create()));h.seedUnit(id(2),'other-owner');h.setUser('other-owner');
  await denied(await h.get());await denied(await h.post(command('start',0)));await denied(await h.post(create()));
  assert.deepEqual((await body(await h.get(id(2)))).runs,[]);await body(await h.post(command('start',0,id(201),id(100),id(2))),404);
  h.setUser('stranger');await denied(await h.get());h.sqlite.close();
});

test('removal and coach demotion take effect immediately without erasing the stored class',async()=>{
  const h=harness();await body(await h.post(create()));h.sqlite.prepare('UPDATE demo_unit_members SET active=0 WHERE id=?').run(id(11));h.setUser('Alice Private');await denied(await h.get());
  h.sqlite.prepare("UPDATE demo_unit_members SET role='athlete' WHERE id=?").run(id(10));h.setUser('coach');await denied(await h.post(command('start',0)));assert.deepEqual((await body(await h.get())).runs,[]);
  h.setUser('owner');assert.equal((await body(await h.get())).runs[0].athletes.length,2);h.sqlite.close();
});

test('roster accepts only unique active athlete members belonging to this unit',async()=>{
  const h=harness();h.seedUnit(id(2),'other-owner');h.seedMember(id(14),'foreign','athlete',id(2));h.seedMember(id(15),'removed','athlete',id(1),0);
  for(const members of [[],[id(10)],[id(14)],[id(15)],[id(999)],[id(11),id(11)]])await body(await h.post(create(id(100),id(1),members)),400);
  await body(await h.post({...create(),athletes:[{memberId:'owner',excludedStations:[]}]}),400);
  for(let n=20;n<32;n++)h.seedMember(id(n),'athlete-'+n);
  await body(await h.post(create(id(100),id(1),Array.from({length:12},(_,i)=>id(i+20)))),400);
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM demo_unit_classes').get()!.n,0);h.sqlite.close();
});

test('payload cannot inject athlete names, scopes, plan, elapsed time or privileged role',async()=>{
  const h=harness();
  for(const patch of [{scopeId:scope('owner')},{plan:{rounds:[]}},{role:'owner'},{athletes:[{memberId:id(11),name:'Forged',excludedStations:[]}]}])await body(await h.post({...create(),...patch}),400);
  await body(await h.post(create()));await body(await h.post({...command('start',0),elapsedMs:999999}),400);h.sqlite.close();
});

test('create retry preserves original randomized snapshot and rejects changed request input',async()=>{
  const h=harness();const saved=await body(await h.post(create()));const retry=await body(await h.post(create()));assert.equal(retry.duplicate,true);assert.deepEqual(retry.run,saved.run);
  for(const patch of [{name:'Changed'},{timing:{workSeconds:6,restSeconds:0}},{athletes:[{memberId:id(11),excludedStations:[]}]}])await body(await h.post({...create(),...patch}),409);
  h.sqlite.prepare('UPDATE demo_unit_members SET name=? WHERE id=?').run('Different name now',id(11));assert.deepEqual((await body(await h.post(create()))).run,saved.run);h.sqlite.close();
});

test('two coaches cannot create simultaneous open classes in one unit',async()=>{
  const h=harness();h.setUser('coach');const replies=await Promise.all([h.post(create()),h.post(create(id(101)))]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
  assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM demo_unit_classes WHERE active=1').get()!.n,1);h.sqlite.close();
});

test('clock persists pause/resume and completion releases open-class slot once',async()=>{
  const h=harness();await body(await h.post(create()));await body(await h.post(command('start',0)));h.advance(12500);const paused=await body(await h.post(command('pause',1)));assert.equal(paused.run.state.elapsedMs,12500);
  h.advance(90000);assert.equal((await body(await h.get())).runs[0].clock.elapsedMs,12500);await body(await h.post(command('resume',2)));h.advance(47500);
  const completed=(await body(await h.get())).runs[0];assert.equal(completed.clock.status,'completed');assert.equal(completed.clock.elapsedMs,60000);
  const again=(await body(await h.get())).runs[0];assert.equal(again.revision,completed.revision);
  await body(await h.post(create(id(101))));await body(await h.post(command('pause',completed.revision,id(209))),409);h.sqlite.close();
});

test('parallel identical command retries execute once; competing revision writes cannot rewind',async()=>{
  const h=harness();await body(await h.post(create()));const responses=await Promise.all([h.post(command('start',0)),h.post(command('start',0))]);const results=await Promise.all(responses.map(r=>body(r)));
  assert.equal(results.filter(r=>r.duplicate).length,1);assert.ok(results.every(r=>r.run.revision===1));h.advance(4000);
  const race=await Promise.all([h.post(command('pause',1,id(300))),h.post(command('interrupt',1,id(301)))]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  await body(await h.post(command('start',0)),409);const latest=(await body(await h.get())).runs[0];assert.equal(latest.revision,2);assert.equal(latest.clock.elapsedMs,4000);h.sqlite.close();
});

test('only terminal classes can be deleted and deletion requires current revision',async()=>{
  const h=harness();await body(await h.post(create()));await body(await h.post({action:'delete',unitId:id(1),id:id(100),expectedRevision:0}),409);await body(await h.post(command('interrupt',0)));
  await body(await h.post({action:'delete',unitId:id(1),id:id(100),expectedRevision:0}),409);await body(await h.post({action:'delete',unitId:id(1),id:id(100),expectedRevision:1}));assert.deepEqual((await body(await h.get())).runs,[]);h.sqlite.close();
});

test('twenty saved classes is enforced while exact creation retry remains available',async()=>{
  const h=harness();for(let n=0;n<20;n++){await body(await h.post(create(id(100+n))));await body(await h.post(command('interrupt',0,id(400+n),id(100+n))));}
  assert.equal((await body(await h.get())).runs.length,20);assert.equal((await body(await h.post(create(id(120))),429)).code,'RUN_LIMIT');assert.equal((await body(await h.post(create()))).duplicate,true);h.sqlite.close();
});

test('membership removal between roster read and insert cannot produce an ineligible class',async()=>{
  const h=harness();let fired=false;h.hook(sql=>{if(!fired&&/INSERT[\s\S]*demo_unit_classes/i.test(sql)){fired=true;h.sqlite.prepare('UPDATE demo_unit_members SET active=0 WHERE id=?').run(id(11));}});
  await body(await h.post(create()),409);assert.equal(fired,true);assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM demo_unit_classes').get()!.n,0);h.sqlite.close();
});

test('coach demotion between authorization and insert prevents the write',async()=>{
  const h=harness();h.setUser('coach');let fired=false;h.hook(sql=>{if(!fired&&/INSERT[\s\S]*demo_unit_classes/i.test(sql)){fired=true;h.sqlite.prepare("UPDATE demo_unit_members SET role='athlete' WHERE id=?").run(id(10));}});
  const response=await h.post(create());assert.ok([403,409].includes(response.status),await response.text());assert.equal(fired,true);assert.equal(h.sqlite.prepare('SELECT count(*) AS n FROM demo_unit_classes').get()!.n,0);h.sqlite.close();
});

test('coach removal between command read and update prevents execution',async()=>{
  const h=harness();await body(await h.post(create()));h.setUser('coach');let fired=false;h.hook(sql=>{if(!fired&&/UPDATE\s+demo_unit_classes/i.test(sql)){fired=true;h.sqlite.prepare('UPDATE demo_unit_members SET active=0 WHERE id=?').run(id(10));}});
  const response=await h.post(command('start',0));assert.ok([403,409].includes(response.status),await response.text());assert.equal(fired,true);assert.equal(JSON.parse(h.sqlite.prepare('SELECT state FROM demo_unit_classes').get()!.state as string).status,'ready');h.sqlite.close();
});

test('request boundary validates unit ID, origin, JSON, body size, timing and impossible exclusions',async()=>{
  const h=harness();await body(await h.get('bad'),400);await body(await h.api.POST(h.request(create(),id(1),{Origin:'https://evil.example'})),403);await body(await h.api.POST(h.request(create(),id(1),{'Content-Type':'text/plain'})),415);await body(await h.post({...create(),padding:'💥'.repeat(6000)}),413);
  await body(await h.post({...create(),timing:{workSeconds:0,restSeconds:0}}),400);await body(await h.post({...create(),athletes:[{memberId:id(11),excludedStations:['fake']}]}),400);
  await body(await h.post({...create(),athletes:[{memberId:id(11),excludedStations:['volume','technique','power','speed','vr','reflex']}]}),422);h.sqlite.close();
});


test('demotion before GET transactional snapshot returns only the former coach own enrollment',async()=>{
  const h=harness();h.sqlite.prepare("UPDATE demo_unit_members SET role='athlete' WHERE id=?").run(id(10));
  await body(await h.post(create(id(100),id(1),[id(10),id(11),id(12)])));
  h.sqlite.prepare("UPDATE demo_unit_members SET role='coach' WHERE id=?").run(id(10));h.setUser('coach');
  let fired=false;h.hookBeforeBatch(()=>{h.hookBeforeBatch(null);fired=true;h.sqlite.prepare("UPDATE demo_unit_members SET role='athlete' WHERE id=?").run(id(10));});
  const result=await body(await h.get());assert.equal(fired,true);assert.equal(result.myRole,'athlete');assert.equal(result.runs.length,1);
  assert.deepEqual(result.runs[0].athletes.map((a:any)=>a.memberId),[id(10)]);assert.equal(result.runs[0].athletes[0].stations.length,12);
  const serialized=JSON.stringify(result);for(const secret of ['Alice Private','Bob Private',id(11),id(12),'account:'])assert.ok(!serialized.includes(secret),secret);
  h.sqlite.close();
});

test('rejoining with stable member ID restores own history without changing saved name or assignments',async()=>{
  const h=harness();const saved=(await body(await h.post(create()))).run.athletes.find((a:any)=>a.memberId===id(11));
  h.sqlite.prepare('UPDATE demo_unit_members SET active=0 WHERE id=?').run(id(11));h.setUser('Alice Private');await denied(await h.get());
  h.sqlite.prepare('UPDATE demo_unit_members SET active=1,name=? WHERE id=?').run('Alice renamed on rejoin',id(11));
  const restored=await body(await h.get());assert.equal(restored.runs.length,1);assert.deepEqual(restored.runs[0].athletes,[saved]);
  assert.equal(restored.runs[0].athletes[0].name,'Alice Private');assert.equal(restored.runs[0].athletes[0].memberId,id(11));
  assert.ok(!JSON.stringify(restored).includes('Bob Private'));h.sqlite.close();
});

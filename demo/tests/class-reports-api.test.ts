import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
// @ts-expect-error Native test runner needs the extension.
import * as identity from '../lib/identity.ts';
// @ts-expect-error Native test runner needs the extension.
import * as receipt from '../lib/class-report.ts';

const guestA = '11111111-1111-4111-8111-111111111111';
const guestB = '22222222-2222-4222-8222-222222222222';
const runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = (n: number) => `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12,'0')}`;
const participants = [{athleteId:'a',status:'completed',roundsCompleted:12},{athleteId:'b',status:'absent',roundsCompleted:0}];
const finalize = {action:'finalize',runId,requestId,participants};
function harness() {
  let user: {userId: string; fullName: string | null} | null = null;
  let beforeInsert: (() => void) | null = null;
  const sqlite = new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  const db = {prepare(sql: string) {
    let args: any[] = [];
    return {bind(...values: any[]) {args=values;return this;}, async first() {return sqlite.prepare(sql).get(...args)??null;}, async all() {return {results:sqlite.prepare(sql).all(...args)};},async run() {if(sql.startsWith('INSERT OR IGNORE INTO demo_class_reports') && beforeInsert) {const fn=beforeInsert;beforeInsert=null;fn();} const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};}};
  }};
  const modules: Record<string,unknown> = {'cloudflare:workers':{env:{DB:db}},'@/app/chatgpt-auth':{getChatGPTUser:async()=>user},'@/lib/identity':identity,'@/lib/class-report':receipt};
  const code=ts.transpileModule(readFileSync(new URL('../app/api/class-reports/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const api:any={};new Function('require','exports',code)((name:string)=>{assert.ok(name in modules,name);return modules[name];},api);
  const request=(body?:unknown,cookie=guestA,headers:Record<string,string>={})=>new Request('https://demo.example/api/class-reports',{method:body===undefined?'GET':'POST',headers:{cookie:'strikex_demo_v1='+cookie,'Content-Type':'application/json',Origin:'https://demo.example',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const seed=async(run=runId,status='completed',elapsed=60000,cookie=guestA)=>{
    const {scopeId}=await identity.resolveDemoIdentity(user,cookie);
    const input={name:'Class',athletes:[{id:'a',name:'Ana',excludedStations:[]},{id:'b',name:'Bia',excludedStations:[]}]};
    const plan={rulesVersion:'demo',capacities:{volume:3,technique:3,power:2,speed:1,vr:1,reflex:1},rounds:Array.from({length:12},(_,i)=>({round:i+1,assignments:[{athleteId:'a',station:i%2?'power':'volume'},{athleteId:'b',station:i%2?'volume':'power'}]}))};
    sqlite.prepare('INSERT INTO demo_class_runs(scope_id,id,plan_id,created_at,updated_at,revision,input,plan,timing,state,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(scopeId,run,id(999),'2026-10-12T00:00:00.000Z','2026-10-12T00:01:00.000Z',2,JSON.stringify(input),JSON.stringify(plan),JSON.stringify({workSeconds:5,restSeconds:0}),JSON.stringify({status,elapsedMs:elapsed,startedAt:status==='running'?Date.now():null}),['completed','interrupted'].includes(status)?0:1);
  };
  return {api,sqlite,seed,request,setUser:(value:typeof user)=>{user=value;},beforeInsert:(fn:()=>void)=>{beforeInsert=fn;}};
}
async function body(response:Response,status=200):Promise<any>{assert.equal(response.status,status,await response.clone().text());return response.json();}

test('immutable reports replay, hash consistently, survive source deletion and remain isolated',async()=>{
  const h=harness();await h.seed();
  const response=await h.api.POST(h.request(finalize));
  assert.equal(response.headers.get('cache-control'),'no-store');
  const saved=await body(response);assert.equal(saved.duplicate,false);assert.equal(saved.report.payload.source,'demo_declared');
  assert.equal(saved.report.hash,createHash('sha256').update(receipt.canonicalReportJSON(saved.report.payload)).digest('hex'));
  const replay=await body(await h.api.POST(h.request({...finalize,requestId:id(1),participants:[...participants].reverse()})));
  assert.equal(replay.duplicate,true);assert.deepEqual(replay.report,saved.report);
  await body(await h.api.POST(h.request({...finalize,participants:[{...participants[0],status:'partial',roundsCompleted:11},participants[1]]})),409);
  assert.equal((await body(await h.api.GET(h.request(undefined,guestB)))).reports.length,0);
  await body(await h.api.POST(h.request(finalize,guestB)),404);
  h.sqlite.exec('DELETE FROM demo_class_runs; DELETE FROM demo_class_plans;');
  assert.deepEqual((await body(await h.api.POST(h.request(finalize)))).report,saved.report);
  assert.deepEqual((await body(await h.api.GET(h.request()))).reports,[saved.report]);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM demo_sessions').get()!.n,0);
  h.sqlite.close();
});

test('account scope survives guest changes and stays separate from other accounts',async()=>{
  const h=harness();h.setUser({userId:'A',fullName:'A'});await h.seed();await body(await h.api.POST(h.request(finalize)));
  assert.equal((await body(await h.api.GET(h.request(undefined,guestB)))).reports.length,1);
  h.setUser({userId:'B',fullName:'B'});assert.equal((await body(await h.api.GET(h.request()))).reports.length,0);
  h.setUser(null);assert.equal((await body(await h.api.GET(h.request()))).reports.length,0);h.sqlite.close();
});

test('simultaneous closeouts have one winner and same input returns original report',async()=>{
  const h=harness();await h.seed();
  const results=await Promise.all([h.api.POST(h.request(finalize)),h.api.POST(h.request({...finalize,requestId:id(2)}))]);
  const values=await Promise.all(results.map(r=>body(r)));
  assert.equal(values.filter(v=>v.duplicate).length,1);assert.deepEqual(values[0].report,values[1].report);
  await h.seed(id(3));
  const race=await Promise.all([h.api.POST(h.request({...finalize,runId:id(3),requestId:id(4)})),h.api.POST(h.request({...finalize,runId:id(3),requestId:id(5),participants:[{...participants[0],status:'partial',roundsCompleted:10},participants[1]]}))]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);h.sqlite.close();
});

test('request ID cannot create another report, including simultaneous different runs',async()=>{
  const h=harness();await h.seed();await h.seed(id(1));
  const race=await Promise.all([h.api.POST(h.request(finalize)),h.api.POST(h.request({...finalize,runId:id(1)}))]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal((await body(await h.api.GET(h.request()))).reports.length,1);h.sqlite.close();
});

test('only terminal runs can close and declarations cannot overclaim elapsed rounds',async()=>{
  const h=harness();await h.seed(runId,'running',0);
  assert.equal((await body(await h.api.POST(h.request(finalize)),409)).code,'RUN_NOT_ENDED');
  h.sqlite.exec('DELETE FROM demo_class_runs');await h.seed(runId,'interrupted',12500);
  await body(await h.api.POST(h.request(finalize)),400);
  const result=await body(await h.api.POST(h.request({...finalize,participants:[{...participants[0],status:'partial',roundsCompleted:2},participants[1]]})));
  assert.equal(result.report.payload.availableRounds,2);h.sqlite.close();
});

test('source deletion during finalization prevents insertion',async()=>{
  const h=harness();await h.seed();h.beforeInsert(()=>h.sqlite.exec('DELETE FROM demo_class_runs'));
  await body(await h.api.POST(h.request(finalize)),409);assert.equal((await body(await h.api.GET(h.request()))).reports.length,0);h.sqlite.close();
});

test('immutable report cap is enforced and existing report replay is still available',async()=>{
  const h=harness();await h.seed();await body(await h.api.POST(h.request(finalize)));
  const row=h.sqlite.prepare('SELECT * FROM demo_class_reports').get()!;
  for(let i=0;i<99;i++)h.sqlite.prepare('INSERT INTO demo_class_reports(scope_id,id,created_at,request_id,payload,hash) VALUES(?,?,?,?,?,?)').run(row.scope_id,id(i),row.created_at,id(i+200),row.payload,row.hash);
  await h.seed(id(101));assert.equal((await body(await h.api.POST(h.request({...finalize,runId:id(101),requestId:id(500)})),429)).code,'REPORT_LIMIT');
  assert.equal((await body(await h.api.POST(h.request(finalize)))).duplicate,true);h.sqlite.close();
});

test('boundary rejects extra fields, malicious origins, invalid IDs, missing roster and oversized bytes',async()=>{
  const h=harness();await h.seed();
  await body(await h.api.POST(h.request(finalize,guestA,{Origin:'https://evil.example'})),403);
  await body(await h.api.POST(h.request(finalize,guestA,{'Content-Type':'text/plain'})),415);
  await body(await h.api.POST(h.request({...finalize,padding:'💥'.repeat(6000)})),413);
  for(const request of [{...finalize,scopeId:guestB},{...finalize,closedAt:'2000-01-01'},{...finalize,runId:'bad'},{...finalize,participants:participants.slice(0,1)},{...finalize,participants:[participants[0],participants[0]]}]) await body(await h.api.POST(h.request(request)),400);
  h.sqlite.close();
});

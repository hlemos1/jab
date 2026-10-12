import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
// @ts-expect-error Native test runner needs the extension.
import * as identity from '../lib/identity.ts';
// @ts-expect-error Native test runner needs the extension.
import * as engine from '../lib/class-run.ts';

const guestA = '11111111-1111-4111-8111-111111111111';
const guestB = '22222222-2222-4222-8222-222222222222';
const planId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const runId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ids = Array.from({length: 30}, (_, index) => `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, '0')}`);
const timing = {workSeconds: 5, restSeconds: 0};
const create = {action: 'create', requestId: runId, planId, timing};
const command = (action: string, expectedRevision: number, requestId = ids[expectedRevision], id = runId) => ({action, expectedRevision, requestId, id});

// Execute actual handlers and actual migrated SQL. Only the platform auth,
// clock, and asynchronous D1 interface are substituted.
function harness() {
  let user: {userId: string; fullName: string | null} | null = null;
  let now = 1_790_000_000_000;
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  const db = {prepare(sql: string) {
    let args: any[] = [];
    return {
      bind(...values: any[]) {args = values; return this;},
      async first() {return sqlite.prepare(sql).get(...args) ?? null;},
      async all() {return {results: sqlite.prepare(sql).all(...args)};},
      async run() {const result = sqlite.prepare(sql).run(...args); return {meta: {changes: Number(result.changes)}};},
    };
  }};
  const modules: Record<string, unknown> = {
    'cloudflare:workers': {env: {DB: db}}, '@/app/chatgpt-auth': {getChatGPTUser: async () => user},
    '@/lib/identity': identity, '@/lib/class-run': engine,
  };
  const source = readFileSync(new URL('../app/api/class-runs/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const api: any = {};
  class ClockDate extends Date {static now() {return now;}}
  new Function('require', 'exports', 'Date', code)((name: string) => {assert.ok(name in modules, name); return modules[name];}, api, ClockDate);
  const request = (body?: unknown, cookie = guestA, headers: Record<string, string> = {}) => new Request('https://demo.example/api/class-runs', {
    method: body === undefined ? 'GET' : 'POST', headers: {cookie: 'strikex_demo_v1=' + cookie, 'Content-Type': 'application/json', Origin: 'https://demo.example', ...headers},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const seedPlan = async (cookie = guestA) => {
    const {scopeId} = await identity.resolveDemoIdentity(user, cookie);
    sqlite.prepare('INSERT OR IGNORE INTO demo_class_plans(scope_id,id,created_at,input,plan) VALUES(?,?,?,?,?)').run(scopeId, planId, new Date(now).toISOString(), JSON.stringify({name: 'Test', athletes: [{id:'athlete-1', name:'Ana', excludedStations:[]}]}), JSON.stringify({rounds: Array.from({length:12}, (_, i) => ({round:i+1, assignments:[{athleteId:'athlete-1',station: i%2 ? 'power' : 'volume'}]}))}));
  };
  return {api, request, sqlite, seedPlan, now: () => now, advance: (ms: number) => {now += ms;}, setUser: (value: typeof user) => {user = value;}};
}

async function body(response: Response, status = 200): Promise<any> {assert.equal(response.status, status, await response.clone().text()); return response.json();}

test('runs persist immutable plan snapshot, scoped ownership and account portability', async () => {
  const h = harness(); await h.seedPlan();
  const created = await body(await h.api.POST(h.request(create)));
  assert.equal(created.run.state.status, 'ready'); assert.equal(created.run.revision, 0);
  assert.equal(created.serverNow, h.now()); assert.equal(created.duplicate, false);
  assert.equal((await body(await h.api.GET(h.request(undefined, guestB)))).runs.length, 0);
  await body(await h.api.POST(h.request(command('start',0), guestB)),404);
  h.sqlite.exec('DELETE FROM demo_class_plans');
  const replay = await body(await h.api.POST(h.request(create)));
  assert.equal(replay.duplicate, true); assert.deepEqual(replay.run.input, created.run.input);
  assert.equal(replay.run.plan.rounds.length, 12);
  h.setUser({userId:'account-A',fullName:'Ana'}); await h.seedPlan();
  await body(await h.api.POST(h.request(create)));
  const signed = await h.api.GET(h.request(undefined, guestB));
  assert.equal((await body(signed)).runs.length,1);
  assert.match(signed.headers.get('set-cookie')!, new RegExp('^strikex_demo_v1='+guestB));
  h.setUser({userId:'account-B',fullName:'Bea'});
  assert.equal((await body(await h.api.GET(h.request()))).runs.length,0);
  h.sqlite.close();
});

test('server timer survives pause/reload/resume and completes exactly once', async () => {
  const h = harness(); await h.seedPlan(); await body(await h.api.POST(h.request(create)));
  const started = await body(await h.api.POST(h.request(command('start',0))));
  assert.equal(started.run.state.startedAt,h.now());
  h.advance(12500);
  const paused = await body(await h.api.POST(h.request(command('pause',1))));
  assert.equal(paused.run.state.elapsedMs,12500); assert.equal(paused.run.revision,2);
  h.advance(90000);
  const reload = await body(await h.api.GET(h.request()));
  assert.equal(reload.runs[0].clock.elapsedMs,12500);
  await body(await h.api.POST(h.request(command('resume',2))));
  h.advance(47500);
  const completed = (await body(await h.api.GET(h.request()))).runs[0];
  assert.equal(completed.state.status,'completed'); assert.equal(completed.revision,4); assert.equal(completed.clock.elapsedMs,60000);
  assert.equal((await body(await h.api.GET(h.request()))).runs[0].revision,4);
  await body(await h.api.POST(h.request(command('pause',4))),409);
  await body(await h.api.POST(h.request({action:'delete',id:runId,expectedRevision:4})));
  assert.equal((await body(await h.api.GET(h.request()))).runs.length,0);
  h.sqlite.close();
});

test('parallel commands and retries never duplicate or rewind elapsed state', async () => {
  const h=harness(); await h.seedPlan(); await body(await h.api.POST(h.request(create)));
  const responses=await Promise.all([h.api.POST(h.request(command('start',0))),h.api.POST(h.request(command('start',0)))]);
  const results=await Promise.all(responses.map(response=>body(response)));
  assert.equal(results.filter(result=>result.duplicate).length,1);
  assert.equal(results[0].run.revision,1); h.advance(4000);
  const competing=await Promise.all([h.api.POST(h.request(command('pause',1,ids[5]))),h.api.POST(h.request(command('interrupt',1,ids[6])))]);
  assert.deepEqual(competing.map(response=>response.status).sort(),[200,409]);
  await body(await h.api.POST(h.request(command('start',0))),409);
  const current=(await body(await h.api.GET(h.request()))).runs[0];
  assert.equal(current.revision,2); assert.equal(current.state.elapsedMs,4000);
  h.sqlite.close();
});

test('active uniqueness, invalid transitions, strict input, mismatch and terminal deletion', async()=>{
  const h=harness(); await h.seedPlan(); await body(await h.api.POST(h.request(create)));
  await body(await h.api.POST(h.request({...create,timing:{...timing,workSeconds:6}})),409);
  assert.equal((await body(await h.api.POST(h.request({...create,requestId:ids[20]})),409)).code,'ACTIVE_RUN');
  await body(await h.api.POST(h.request(command('pause',0))),409);
  await body(await h.api.POST(h.request({...command('start',0),elapsedMs:9999})),400);
  await body(await h.api.POST(h.request({...command('start',0),scopeId:guestB})),400);
  await body(await h.api.POST(h.request({action:'delete',id:runId,expectedRevision:0})),409);
  await body(await h.api.POST(h.request(command('interrupt',0))));
  await body(await h.api.POST(h.request({...command('start',0)})),409);
  await body(await h.api.POST(h.request({...create,requestId:ids[20]})));
  h.sqlite.close();
});

test('completed open run releases capacity when creating another and history limit is atomic',async()=>{
  const h=harness(); await h.seedPlan();
  await body(await h.api.POST(h.request(create))); await body(await h.api.POST(h.request(command('start',0))));
  h.advance(60000);
  for(let i=0;i<19;i++){
    await body(await h.api.POST(h.request({...create,requestId:ids[i]})));
    await body(await h.api.POST(h.request(command('interrupt',0,runId,ids[i]))));
  }
  assert.equal((await body(await h.api.GET(h.request()))).runs.length,20);
  assert.equal((await body(await h.api.POST(h.request({...create,requestId:ids[20]})),429)).code,'RUN_LIMIT');
  assert.equal((await body(await h.api.POST(h.request(create)))).duplicate,true);
  h.sqlite.close();
});

test('request boundary rejects foreign origins, oversized bodies and unsupported JSON',async()=>{
  const h=harness();
  await body(await h.api.POST(h.request(create,guestA,{Origin:'https://evil.example'})),403);
  await body(await h.api.POST(h.request(create,guestA,{'Content-Type':'text/plain'})),415);
  await body(await h.api.POST(h.request({...create,padding:'💥'.repeat(6000)})),413);
  await body(await h.api.POST(h.request({...create,timing:{workSeconds:0,restSeconds:0}})),400);
  await body(await h.api.POST(h.request({...create,requestId:'bad'})),400);
  await body(await h.api.POST(h.request(create)),404);
  h.sqlite.close();
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
// @ts-expect-error Native test runner needs the extension.
import * as identity from '../lib/identity.ts';

const guestA = '11111111-1111-4111-8111-111111111111';
const guestB = '22222222-2222-4222-8222-222222222222';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const input = {name: 'Test class', athletes: [{id: 'athlete-1', name: 'Ana', excludedStations: []}]};
class PlannerError extends Error {
  code: string;
  constructor(code: string, message: string) {super(message); this.code = code;}
}

// Exercise the actual route; substitute only platform services and the separately
// tested planner boundary. Real SQLite checks cover the SQL and concurrency.
function harness() {
  let user: {userId: string; fullName: string | null} | null = null;
  let generationCount = 0;
  let plannerError: PlannerError | null = null;
  const rows = new Map<string, any>();
  const key = (scope: string, id: string) => scope + ':' + id;
  const db = {prepare(sql: string) {
    let args: any[] = [];
    return {
      bind(...values: any[]) {args = values; return this;},
      async first() {
        assert.ok(sql.startsWith('SELECT id,created_at,input,plan FROM demo_class_plans WHERE scope_id=? AND id=?'));
        return rows.get(key(args[0], args[1])) ?? null;
      },
      async all() {
        assert.ok(sql.includes('WHERE scope_id=? ORDER BY created_at DESC,id DESC LIMIT 20'));
        return {results: [...rows.values()].filter(row => row.scope_id === args[0]).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, 20)};
      },
      async run() {
        if (sql.startsWith('INSERT OR IGNORE')) {
          const [scope, id, createdAt, rawInput, plan] = args;
          if (rows.has(key(scope, id)) || [...rows.values()].filter(row => row.scope_id === scope).length >= 20) return {meta: {changes: 0}};
          rows.set(key(scope, id), {scope_id: scope, id, created_at: createdAt, input: rawInput, plan});
          return {meta: {changes: 1}};
        }
        assert.equal(sql, 'DELETE FROM demo_class_plans WHERE scope_id=? AND id=?');
        return {meta: {changes: Number(rows.delete(key(args[0], args[1])))}};
      },
    };
  }};
  const modules: Record<string, unknown> = {
    'cloudflare:workers': {env: {DB: db}},
    '@/app/chatgpt-auth': {getChatGPTUser: async () => user},
    '@/lib/identity': identity,
    '@/lib/class-planner': {
      PlannerError,
      validateClassInput: (value: unknown) => {if (plannerError) throw plannerError; return value;},
      planClass: (_value: unknown, seed: number) => {
        assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
        generationCount++;
        return {rulesVersion: 'test-v1', rounds: [{round: 1, assignments: [{athleteId: 'athlete-1', station: 'volume'}]}]};
      },
    },
  };
  const source = readFileSync(new URL('../app/api/classes/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const api: any = {};
  new Function('require', 'exports', code)((name: string) => {assert.ok(name in modules); return modules[name];}, api);
  const request = (body?: unknown, cookie = guestA, extraHeaders: Record<string, string> = {}) => new Request('https://demo.example/api/classes', {
    method: body === undefined ? 'GET' : 'POST',
    headers: {cookie: 'strikex_demo_v1=' + cookie, ...(body !== undefined ? {'Content-Type': 'application/json', Origin: 'https://demo.example'} : {}), ...extraHeaders},
    ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
  });
  return {api, request, rows, setUser: (value: typeof user) => {user = value;}, failPlanner: (value: PlannerError | null) => {plannerError = value;}, generations: () => generationCount};
}

test('class plans isolate visitors and accounts; server ignores body ownership', async () => {
  const h = harness();
  assert.equal((await h.api.POST(h.request({action: 'generate', requestId, input, scopeId: guestB}))).status, 200);
  assert.equal((await (await h.api.GET(h.request())).json()).plans.length, 1);
  assert.equal((await (await h.api.GET(h.request(undefined, guestB))).json()).plans.length, 0);
  h.setUser({userId: 'account-A', fullName: 'Ana'});
  assert.equal((await (await h.api.GET(h.request())).json()).plans.length, 0);
  await h.api.POST(h.request({action: 'generate', requestId, input}));
  const otherBrowser = await h.api.GET(h.request(undefined, guestB));
  assert.equal((await otherBrowser.json()).plans.length, 1);
  assert.match(otherBrowser.headers.get('set-cookie'), new RegExp('^strikex_demo_v1=' + guestB + ';'));
  h.setUser({userId: 'account-B', fullName: 'Bea'});
  assert.equal((await (await h.api.GET(h.request())).json()).plans.length, 0);
  assert.equal((await h.api.POST(h.request({action: 'delete', id: requestId}))).status, 404);
  h.setUser(null);
  assert.equal((await (await h.api.GET(h.request())).json()).plans.length, 1);
});

test('identical replay returns persisted matrix before consulting new rules; edits conflict', async () => {
  const h = harness();
  const generated = await (await h.api.POST(h.request({action: 'generate', requestId, input}))).json();
  assert.equal(generated.duplicate, false);
  h.failPlanner(new PlannerError('INVALID_INPUT', 'New rules would reject this old request.'));
  const replay = await h.api.POST(h.request({action: 'generate', requestId, input: {athletes: input.athletes, name: input.name}}));
  assert.equal(replay.status, 200);
  const body = await replay.json();
  assert.equal(body.duplicate, true);
  assert.deepEqual(body.plan, generated.plan);
  assert.equal(h.generations(), 1);
  assert.equal((await h.api.POST(h.request({action: 'generate', requestId, input: {...input, name: 'Changed'}}))).status, 409);
});

test('delete removes only the selected scoped plan', async () => {
  const h = harness();
  await h.api.POST(h.request({action: 'generate', requestId, input}));
  await h.api.POST(h.request({action: 'generate', requestId, input}, guestB));
  assert.equal((await h.api.POST(h.request({action: 'delete', id: requestId}))).status, 200);
  assert.equal((await h.api.POST(h.request({action: 'delete', id: requestId}))).status, 404);
  assert.equal((await (await h.api.GET(h.request(undefined, guestB))).json()).plans.length, 1);
});

test('planner validation, infeasibility and search exhaustion preserve error status', async () => {
  const h = harness();
  for (const [code, status] of [['INVALID_INPUT', 400], ['INFEASIBLE', 422], ['SEARCH_LIMIT', 503]] as const) {
    h.failPlanner(new PlannerError(code, 'Planner explanation'));
    const response = await h.api.POST(h.request({action: 'generate', requestId, input}));
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
  assert.equal(h.rows.size, 0);
});

test('boundary rejects foreign origins, invalid IDs, non-JSON and oversized byte bodies', async () => {
  const h = harness();
  const body = {action: 'generate', requestId, input};
  assert.equal((await h.api.POST(h.request(body, guestA, {Origin: 'https://attacker.example'}))).status, 403);
  assert.equal((await h.api.POST(h.request(body, guestA, {'Content-Type': 'text/plain'}))).status, 415);
  assert.equal((await h.api.POST(h.request({...body, requestId: 'not-a-uuid'}))).status, 400);
  assert.equal((await h.api.POST(h.request({...body, padding: 'a'.repeat(20_001)}))).status, 413);
  assert.equal((await h.api.POST(h.request({...body, padding: '💥'.repeat(6000)}))).status, 413);
  const invalid = new Request('https://demo.example/api/classes', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{bad'});
  assert.equal((await h.api.POST(invalid)).status, 400);
  assert.equal(h.rows.size, 0);
});

test('plan limit preserves saved data and a replay works at capacity', async () => {
  const h = harness();
  for (let index = 0; index < 20; index++) {
    const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`;
    assert.equal((await h.api.POST(h.request({action: 'generate', requestId: id, input}))).status, 200);
  }
  const blocked = await h.api.POST(h.request({action: 'generate', requestId, input}));
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, 'PLAN_LIMIT');
  const replay = await h.api.POST(h.request({action: 'generate', requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000000', input}));
  assert.equal((await replay.json()).duplicate, true);
  assert.equal(h.rows.size, 20);
});

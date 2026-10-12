import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
// @ts-expect-error Native runner requires explicit extension.
import * as identity from '../lib/identity.ts';
const cookieA='11111111-1111-4111-8111-111111111111';
const cookieB='22222222-2222-4222-8222-222222222222';
// Execute the actual route with its platform imports substituted at the boundary.
function harness(){
  let user:{userId:string;fullName:string|null}|null=null;
  const profiles=new Map<string,{name:string;avatar:string}>();
  const sessions=new Map<string,any>();
  const db={prepare(sql:string){let args:any[]=[];return {bind(...values:any[]){args=values;return this;},async first(){
    if(sql.startsWith('SELECT name,avatar')||sql.startsWith('SELECT id FROM demo_profiles'))return profiles.get(args[0])??null;
    if(sql.startsWith('SELECT COALESCE('))return {balance:0};
    if(sql.startsWith('SELECT * FROM demo_sessions WHERE guest_id=? AND id=?'))return sessions.get(args[0]+':'+args[1])??null;
    throw new Error('Unexpected first '+sql);
  },async all(){return {results:[]};},async run(){
    if(sql.startsWith('INSERT INTO demo_profiles'))profiles.set(args[0],{name:args[1],avatar:args[2]});
    else if(sql.startsWith('DELETE FROM demo_profiles'))profiles.delete(args[0]);
    else if(!sql.startsWith('DELETE FROM'))throw new Error('Unexpected write '+sql);
    return {meta:{changes:1}};
  }};},async batch(statements:any[]){return Promise.all(statements.map(s=>s.run()));}};
  const modules:Record<string,unknown>={
    'cloudflare:workers':{env:{DB:db}},
    '@/app/chatgpt-auth':{getChatGPTUser:async()=>user},
    '@/lib/identity':identity,
    '@/lib/effort':{validateSession:()=>{throw new Error('Historical replay must not revalidate against newer rules.');}},
    '@/lib/solana':{},
  };
  const source=readFileSync(new URL('../app/api/demo/route.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exported:any={};
  new Function('require','exports',code)((name:string)=>{if(!(name in modules))throw new Error(name);return modules[name];},exported);
  const request=(body?:unknown,cookie=cookieA)=>new Request('https://demo.example/api/demo',{method:body?'POST':'GET',headers:{cookie:'strikex_demo_v1='+cookie,...(body?{'Content-Type':'application/json',Origin:'https://demo.example'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {api:exported,profiles,sessions,request,setUser:(value:typeof user)=>{user=value;}};
}
test('actual route ignores body ownership and keeps account and guest profiles separate',async()=>{
  const h=harness();
  await h.api.POST(h.request({action:'profile',name:'Visitante',avatar:'01'}));
  h.setUser({userId:'A',fullName:'Ana'});
  const result=await h.api.POST(h.request({action:'profile',name:'Atleta',avatar:'02',guestId:cookieA,userId:'victim',scopeId:cookieA}));
  assert.equal(result.status,200);
  assert.match(result.headers.get('set-cookie'),new RegExp('^strikex_demo_v1='+cookieA+';'));
  const fromOtherBrowser=await (await h.api.GET(h.request(undefined,cookieB))).json();
  assert.deepEqual(fromOtherBrowser.profile,{name:'Atleta',avatar:'02'});
  assert.equal(fromOtherBrowser.identity.mode,'account');
  h.setUser({userId:'B',fullName:'Bea'});
  assert.equal((await (await h.api.GET(h.request())).json()).profile,null);
  h.setUser(null);
  assert.equal((await (await h.api.GET(h.request())).json()).profile.name,'Visitante');
});
test('account reset preserves visitor data, cookie and authenticated identity',async()=>{
  const h=harness();
  await h.api.POST(h.request({action:'profile',name:'Visitante',avatar:'01'}));
  h.setUser({userId:'A',fullName:null});
  await h.api.POST(h.request({action:'profile',name:'Atleta',avatar:'02'}));
  const reset=await h.api.POST(h.request({action:'reset'}));
  assert.equal((await reset.json()).identity.mode,'account');
  assert.match(reset.headers.get('set-cookie'),new RegExp('^strikex_demo_v1='+cookieA+';'));
  assert.equal((await (await h.api.GET(h.request())).json()).profile,null);
  h.setUser(null);
  assert.equal((await (await h.api.GET(h.request())).json()).profile.name,'Visitante');
});
test('historical exact replay returns saved rules and reward; changed data is rejected',async()=>{
  const h=harness();
  await h.api.POST(h.request({action:'profile',name:'Visitante',avatar:'01'}));
  const input={sessionId:'session-old',source:'simulator',rounds:[],events:[]};
  h.sessions.set(cookieA+':session-old',{id:'session-old',input:JSON.stringify(input),result:JSON.stringify({rulesVersion:'demo-1.0.0',reward:16}),hash:'saved-digest',created_at:'old',chain_status:'not_submitted'});
  const replay=await h.api.POST(h.request({action:'complete',input:{events:[],rounds:[],source:'simulator',sessionId:'session-old'}}));
  assert.equal(replay.status,200);
  const body=await replay.json();
  assert.equal(body.duplicate,true);
  assert.equal(body.session.result.reward,16);
  assert.equal(body.session.result.rulesVersion,'demo-1.0.0');
  assert.equal((await h.api.POST(h.request({action:'complete',input:{...input,source:'sensor'}}))).status,409);
});

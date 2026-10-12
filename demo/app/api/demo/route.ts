import { env } from 'cloudflare:workers';
import { validateSession, type SessionInput } from '@/lib/effort';
import { anchorReceipt, verifyReceipt } from '@/lib/solana';

export const dynamic = 'force-dynamic';
const COOKIE = 'strikex_demo_v1';
const ID = /^[a-zA-Z0-9_-]{8,100}$/;
type Row = {id:string;created_at:string;result:string;input:string|null;hash:string;chain_status:string;signature:string|null;chain_error:string|null;anchor_at:string|null};
const expose = (s:Row) => ({id:s.id,createdAt:s.created_at,result:JSON.parse(s.result),hash:s.hash,input:s.input?JSON.parse(s.input):null,chainStatus:s.chain_status,signature:s.signature,chainError:s.chain_error});
function guest(request:Request) {
  const value = request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  return value && /^[0-9a-f-]{36}$/.test(value) ? value : crypto.randomUUID();
}
function reply(data:unknown, id:string, status=200) {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store','Set-Cookie':`${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`}});
}
function database(){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
async function balance(db:D1Database,id:string){
  const row=await db.prepare('SELECT COALESCE((SELECT SUM(reward) FROM demo_sessions WHERE guest_id=?),0)-COALESCE((SELECT SUM(cost) FROM demo_redemptions WHERE guest_id=?),0) AS balance').bind(id,id).first<{balance:number}>();
  return row?.balance??0;
}
export async function GET(request:Request){
  const id=guest(request);
  try {
    const db=database();
    const [profile,sessions,redemptions,b]=await Promise.all([
      db.prepare('SELECT name,avatar FROM demo_profiles WHERE id=?').bind(id).first(),
      db.prepare('SELECT * FROM demo_sessions WHERE guest_id=? ORDER BY created_at DESC LIMIT 30').bind(id).all<Row>(),
      db.prepare('SELECT benefit,cost,created_at AS createdAt FROM demo_redemptions WHERE guest_id=? ORDER BY created_at DESC').bind(id).all(),balance(db,id)
    ]);
    return reply({profile,sessions:sessions.results.map(expose),redemptions:redemptions.results,balance:b},id);
  }catch(error){console.error('demo_read_failed',String(error));return reply({error:'Could not load your demo. Please try again.'},id,503);}
}
export async function POST(request:Request){
  const id=guest(request);
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin)return reply({error:'Origin not allowed.'},id,403);
  if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},id,415);
  if(Number(request.headers.get('content-length')||0)>180000)return reply({error:'Request too large.'},id,413);
  try {
    const raw=await request.text();if(raw.length>180000)return reply({error:'Request too large.'},id,413);
    let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON.'},id,400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request.'},id,400);
    const db=database();const now=new Date().toISOString();
    if(body.action==='profile'){
      const name=typeof body.name==='string'?body.name.trim().slice(0,32):'';
      const avatar=typeof body.avatar==='string'?body.avatar.slice(0,24):'01';
      if(!name)return reply({error:'Please enter a display name.'},id,400);
      await db.prepare('INSERT INTO demo_profiles(id,name,avatar,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,avatar=excluded.avatar').bind(id,name,avatar,now).run();
      return reply({profile:{name,avatar}},id);
    }
    const profile=await db.prepare('SELECT id FROM demo_profiles WHERE id=?').bind(id).first();
    if(!profile)return reply({error:'Create your demo profile first.'},id,401);
    if(body.action==='complete'){
      const result=validateSession(body.input);
      if(!result.valid)return reply({error:'Session rejected.',result},id,422);
      const input=body.input as SessionInput;
      if(!ID.test(input.sessionId))return reply({error:'Invalid session ID.'},id,400);
      const canonical=JSON.stringify({sessionId:input.sessionId,source:'simulator',rulesVersion:result.rulesVersion,rounds:input.rounds,events:input.events,result});
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical)))).map(v=>v.toString(16).padStart(2,'0')).join('');
      const inserted=await db.prepare('INSERT OR IGNORE INTO demo_sessions(id,guest_id,created_at,result,hash,reward,input) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM demo_sessions WHERE guest_id=?)<30').bind(input.sessionId,id,now,JSON.stringify(result),hash,result.reward,JSON.stringify(input),id).run();
      const existing=await db.prepare('SELECT * FROM demo_sessions WHERE guest_id=? AND id=?').bind(id,input.sessionId).first<Row>();
      if(!existing)return reply({error:'Demo limit reached. Reset your demo to start again.'},id,429);
      if(existing.hash!==hash)return reply({error:'This session ID already exists with different data.'},id,409);
      return reply({session:expose(existing),duplicate:inserted.meta.changes===0,balance:await balance(db,id)},id);
    }
    if(body.action==='redeem'){
      const benefits:Record<string,number>={'guest-pass':10,'gear-credit':25};
      const benefit=String(body.benefit||'');const cost=benefits[benefit];
      if(!cost)return reply({error:'Unknown benefit.'},id,400);
      const r=await db.prepare('INSERT OR IGNORE INTO demo_redemptions(guest_id,benefit,cost,created_at) SELECT ?,?,?,? WHERE COALESCE((SELECT SUM(reward) FROM demo_sessions WHERE guest_id=?),0)-COALESCE((SELECT SUM(cost) FROM demo_redemptions WHERE guest_id=?),0)>=?').bind(id,benefit,cost,now,id,id,cost).run();
      const existing=await db.prepare('SELECT benefit,cost,created_at AS createdAt FROM demo_redemptions WHERE guest_id=? AND benefit=?').bind(id,benefit).first();
      if(!existing)return reply({error:'Not enough demo JAB.'},id,409);
      return reply({redemption:existing,duplicate:r.meta.changes===0,balance:await balance(db,id)},id);
    }
    if(body.action==='anchor'){
      const sessionId=String(body.sessionId||'');
      const s=await db.prepare('SELECT * FROM demo_sessions WHERE guest_id=? AND id=?').bind(id,sessionId).first<Row>();
      if(!s)return reply({error:'Session not found.'},id,404);
      if(s.chain_status==='confirmed')return reply({session:expose(s)},id);
      if(s.chain_status==='anchoring' && s.anchor_at && Date.now()-Date.parse(s.anchor_at)<60000)return reply({session:expose(s),pending:true},id,202);
      const locked=await db.prepare("UPDATE demo_sessions SET chain_status='anchoring',anchor_at=? WHERE guest_id=? AND id=? AND chain_status=? AND signature IS ? AND anchor_at IS ? AND chain_status!='confirmed'").bind(now,id,sessionId,s.chain_status,s.signature,s.anchor_at).run();
      if(!locked.meta.changes)return reply({session:expose(s),pending:true},id,202);
      const outcome=s.signature?await verifyReceipt(s.signature,sessionId,s.hash):await anchorReceipt({sessionId,hash:s.hash,onPrepared:async(signature:string)=>{const claimed=await db.prepare("UPDATE demo_sessions SET signature=? WHERE guest_id=? AND id=? AND chain_status='anchoring' AND anchor_at=? AND signature IS NULL").bind(signature,id,sessionId,now).run();if(claimed.meta.changes!==1)throw new Error('Receipt claim expired; no broadcast performed.');}});
      await db.prepare('UPDATE demo_sessions SET chain_status=?,signature=?,chain_error=? WHERE guest_id=? AND id=? AND anchor_at=?').bind(outcome.status,outcome.signature??s.signature,outcome.error??null,id,sessionId,now).run();
      const updated=await db.prepare('SELECT * FROM demo_sessions WHERE guest_id=? AND id=?').bind(id,sessionId).first<Row>();
      if(!updated)return reply({error:'Demo was reset during this request.'},id,409);
      return reply({session:expose(updated),chain:outcome},id);
    }
    if(body.action==='reset'){
      await db.batch([db.prepare('DELETE FROM demo_redemptions WHERE guest_id=?').bind(id),db.prepare('DELETE FROM demo_sessions WHERE guest_id=?').bind(id),db.prepare('DELETE FROM demo_profiles WHERE id=?').bind(id)]);
      return reply({profile:null,sessions:[],redemptions:[],balance:0},crypto.randomUUID());
    }
    return reply({error:'Unknown action.'},id,400);
  }catch(error){console.error('demo_action_failed',String(error));return reply({error:'The operation could not be completed. Your saved results remain available.'},id,503);}
}

import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { demoGuestId, resolveDemoIdentity, validDemoProfile } from '@/lib/identity';
import { isSessionId, validateSession, type SessionInput } from '@/lib/effort';
import { sessionReceiptHash } from '@/lib/session-receipt';
import { anchorReceipt, verifyReceipt } from '@/lib/solana';

export const dynamic = 'force-dynamic';
const COOKIE = 'strikex_demo_v1';
type Row = {id:string;created_at:string;result:string;input:string|null;hash:string;chain_status:string;signature:string|null;chain_error:string|null;anchor_at:string|null};
const expose = (s:Row) => ({id:s.id,createdAt:s.created_at,result:JSON.parse(s.result),hash:s.hash,input:s.input?JSON.parse(s.input):null,chainStatus:s.chain_status,signature:s.signature,chainError:s.chain_error});
function guest(request:Request) {
  const value = request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  return demoGuestId(value);
}
function reply(data:unknown, id:string, status=200) {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store','Set-Cookie':`${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`}});
}
function canonicalJSON(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJSON((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value) ?? 'null';
}
function database(){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
async function balance(db:D1Database,id:string){
  const row=await db.prepare('SELECT COALESCE((SELECT SUM(reward) FROM demo_sessions WHERE guest_id=?),0)-COALESCE((SELECT SUM(cost) FROM demo_redemptions WHERE guest_id=?),0) AS balance').bind(id,id).first<{balance:number}>();
  return row?.balance??0;
}
export async function GET(request:Request){
  const guestId=guest(request);
  try {
    const {scopeId:id,identity}=await resolveDemoIdentity(await getChatGPTUser(),guestId);
    const db=database();
    const [profile,sessions,redemptions,b]=await Promise.all([
      db.prepare('SELECT name,avatar FROM demo_profiles WHERE id=?').bind(id).first(),
      db.prepare('SELECT * FROM demo_sessions WHERE guest_id=? ORDER BY created_at DESC LIMIT 30').bind(id).all<Row>(),
      db.prepare('SELECT benefit,cost,created_at AS createdAt FROM demo_redemptions WHERE guest_id=? ORDER BY created_at DESC').bind(id).all(),balance(db,id)
    ]);
    return reply({profile,sessions:sessions.results.map(expose),redemptions:redemptions.results,balance:b,identity},guestId);
  }catch(error){console.error('demo_read_failed',String(error));return reply({error:'Could not load your demo. Please try again.'},guestId,503);}
}
export async function POST(request:Request){
  const guestId=guest(request);
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin)return reply({error:'Origin not allowed.'},guestId,403);
  if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},guestId,415);
  if(Number(request.headers.get('content-length')||0)>180000)return reply({error:'Request too large.'},guestId,413);
  try {
    const raw=await request.text();if(raw.length>180000)return reply({error:'Request too large.'},guestId,413);
    let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON.'},guestId,400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request.'},guestId,400);
    const {scopeId:id,identity}=await resolveDemoIdentity(await getChatGPTUser(),guestId);
    const db=database();const now=new Date().toISOString();
    if(body.action==='profile'){
      const validated=validDemoProfile(body.name,body.avatar);
      if(!validated)return reply({error:'Enter a display name of 1–32 characters and choose an available avatar.'},guestId,400);
      const {name,avatar}=validated;
      await db.prepare('INSERT INTO demo_profiles(id,name,avatar,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,avatar=excluded.avatar').bind(id,name,avatar,now).run();
      return reply({profile:{name,avatar}},guestId);
    }
    const profile=await db.prepare('SELECT id FROM demo_profiles WHERE id=?').bind(id).first();
    if(!profile)return reply({error:'Create your demo profile first.'},guestId,401);
    if(body.action==='complete'){
      const requestedId=(body.input && typeof body.input==='object' && !Array.isArray(body.input))?(body.input as Record<string,unknown>).sessionId:null;
      if(isSessionId(requestedId)){
        const saved=await db.prepare('SELECT * FROM demo_sessions WHERE guest_id=? AND id=?').bind(id,requestedId).first<Row>();
        if(saved?.input){
          if(canonicalJSON(JSON.parse(saved.input))!==canonicalJSON(body.input))return reply({error:'This session ID already exists with different data.'},guestId,409);
          return reply({session:expose(saved),duplicate:true,balance:await balance(db,id)},guestId);
        }
      }
      const result=validateSession(body.input);
      if(!result.valid)return reply({error:'Session rejected.',result},guestId,422);
      const input=body.input as SessionInput;
      if(!isSessionId(input.sessionId))return reply({error:'Invalid session ID.'},guestId,400);
      const hash=await sessionReceiptHash(input,result);
      const inserted=await db.prepare('INSERT OR IGNORE INTO demo_sessions(id,guest_id,created_at,result,hash,reward,input) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM demo_sessions WHERE guest_id=?)<30').bind(input.sessionId,id,now,JSON.stringify(result),hash,result.reward,JSON.stringify(input),id).run();
      const existing=await db.prepare('SELECT * FROM demo_sessions WHERE guest_id=? AND id=?').bind(id,input.sessionId).first<Row>();
      if(!existing)return reply({error:'Demo limit reached. Reset your demo to start again.'},guestId,429);
      if(existing.hash!==hash)return reply({error:'This session ID already exists with different data.'},guestId,409);
      return reply({session:expose(existing),duplicate:inserted.meta.changes===0,balance:await balance(db,id)},guestId);
    }
    if(body.action==='redeem'){
      const benefits:Record<string,number>={'guest-pass':10,'gear-credit':25};
      const benefit=String(body.benefit||'');const cost=benefits[benefit];
      if(!cost)return reply({error:'Unknown benefit.'},guestId,400);
      const r=await db.prepare('INSERT OR IGNORE INTO demo_redemptions(guest_id,benefit,cost,created_at) SELECT ?,?,?,? WHERE COALESCE((SELECT SUM(reward) FROM demo_sessions WHERE guest_id=?),0)-COALESCE((SELECT SUM(cost) FROM demo_redemptions WHERE guest_id=?),0)>=?').bind(id,benefit,cost,now,id,id,cost).run();
      const existing=await db.prepare('SELECT benefit,cost,created_at AS createdAt FROM demo_redemptions WHERE guest_id=? AND benefit=?').bind(id,benefit).first();
      if(!existing)return reply({error:'Not enough demo JAB.'},guestId,409);
      return reply({redemption:existing,duplicate:r.meta.changes===0,balance:await balance(db,id)},guestId);
    }
    if(body.action==='anchor'){
      const sessionId=String(body.sessionId||'');
      const s=await db.prepare('SELECT * FROM demo_sessions WHERE guest_id=? AND id=?').bind(id,sessionId).first<Row>();
      if(!s)return reply({error:'Session not found.'},guestId,404);
      if(s.chain_status==='confirmed')return reply({session:expose(s)},guestId);
      if(s.chain_status==='anchoring' && s.anchor_at && Date.now()-Date.parse(s.anchor_at)<60000)return reply({session:expose(s),pending:true},guestId,202);
      const locked=await db.prepare("UPDATE demo_sessions SET chain_status='anchoring',anchor_at=? WHERE guest_id=? AND id=? AND chain_status=? AND signature IS ? AND anchor_at IS ? AND chain_status!='confirmed'").bind(now,id,sessionId,s.chain_status,s.signature,s.anchor_at).run();
      if(!locked.meta.changes)return reply({session:expose(s),pending:true},guestId,202);
      const outcome=s.signature?await verifyReceipt(s.signature,sessionId,s.hash):await anchorReceipt({sessionId,hash:s.hash,onPrepared:async(signature:string)=>{const claimed=await db.prepare("UPDATE demo_sessions SET signature=? WHERE guest_id=? AND id=? AND chain_status='anchoring' AND anchor_at=? AND signature IS NULL").bind(signature,id,sessionId,now).run();if(claimed.meta.changes!==1)throw new Error('Receipt claim expired; no broadcast performed.');}});
      await db.prepare('UPDATE demo_sessions SET chain_status=?,signature=?,chain_error=? WHERE guest_id=? AND id=? AND anchor_at=?').bind(outcome.status,outcome.signature??s.signature,outcome.error??null,id,sessionId,now).run();
      const updated=await db.prepare('SELECT * FROM demo_sessions WHERE guest_id=? AND id=?').bind(id,sessionId).first<Row>();
      if(!updated)return reply({error:'Demo was reset during this request.'},guestId,409);
      return reply({session:expose(updated),chain:outcome},guestId);
    }
    if(body.action==='reset'){
      await db.batch([db.prepare('DELETE FROM demo_redemptions WHERE guest_id=?').bind(id),db.prepare('DELETE FROM demo_sessions WHERE guest_id=?').bind(id),db.prepare('DELETE FROM demo_profiles WHERE id=?').bind(id)]);
      return reply({profile:null,sessions:[],redemptions:[],balance:0,identity},guestId);
    }
    return reply({error:'Unknown action.'},guestId,400);
  }catch(error){console.error('demo_action_failed',String(error));return reply({error:'The operation could not be completed. Your saved results remain available.'},guestId,503);}
}

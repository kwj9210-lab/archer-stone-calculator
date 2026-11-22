import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  nicknameKey, validPassword, hashPassword, checkPassword, digest, newSession,
  readCookie, sessionCookie, clearSessionCookie, getMember
} from '../lib/access.js';
import { GET, POST, PATCH } from '../api/access.js';

const url='https://calculator.test/api/access';
function request(path=url, init={}){return new Request(path,init)}
function asCookie(token){return {cookie:'__Host-archer_sid='+token}}

test('nickname normalization rejects invalid and ambiguous identities',()=>{
  assert.deepEqual(nicknameKey(' 궁수왕 '),{display:'궁수왕',key:'궁수왕'});
  assert.deepEqual(nicknameKey('PLAYER_123'),{display:'PLAYER_123',key:'player_123'});
  for(const x of ['a','', 'name@foo', '<script>', 'very-very-very-long-nickname']) assert.equal(nicknameKey(x),null);
});
test('password scrypt storage and verification',async()=>{
  const pass='A-secret-password-123!';
  assert.equal(validPassword(pass),true);
  assert.equal(validPassword('tiny'),false);
  const hashed=await hashPassword(pass);
  assert.match(hashed,/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(await checkPassword(pass,hashed),true);
  assert.equal(await checkPassword('different-pass',hashed),false);
  assert.equal(await checkPassword(pass,'invalid'),false);
});
test('opaque session cookie is secure and not a raw DB token',()=>{
  const token=newSession();
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  assert.match(sessionCookie(token),/HttpOnly; Secure; SameSite=Strict/);
  assert.match(clearSessionCookie(),/Max-Age=0/);
  assert.equal(readCookie(request(url,{headers:asCookie(token)})),token);
  assert.notEqual(digest(token),token);
  assert.equal(digest(token).length,64);
});
test('no existing login cookie means no database access',async()=>{
  assert.equal(await getMember(request()),null);
  const unauth=await GET(request());
  assert.equal(unauth.status,401);
});
test('mutating requests reject cross-site origins',async()=>{
  const post=await POST(request(url,{method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json'},body:JSON.stringify({action:'signup',nickname:'궁수왕',password:'ValidPass12345'})}));
  assert.equal(post.status,403);
  const patch=await PATCH(request(url,{method:'PATCH',headers:{origin:'https://attacker.test','content-type':'application/json'},body:'{}'}));
  assert.equal(patch.status,403);
});
test('session authorization checks DB status every time',async()=>{
  const prevFetch=globalThis.fetch,prevUrl=process.env.SUPABASE_URL,prevKey=process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL='https://mock.supabase.co';
  process.env.SUPABASE_SECRET_KEY='sb_secret_local_test';
  const token=newSession();
  const req=request(url,{headers:asCookie(token)});
  let status='approved',readCount=0;
  globalThis.fetch=async input=>{
    const value=String(input);readCount++;
    if(value.includes('/access_sessions?'))return Response.json([{id:'session-1',member_id:'user-1',expires_at:new Date(Date.now()+60000).toISOString()}]);
    if(value.includes('/access_members?'))return Response.json([{id:'user-1',nickname:'궁수왕',role:'member',status,login_count:2}]);
    throw new Error('Unexpected mocked query: '+value);
  };
  try{
    assert.equal((await getMember(req)).nickname,'궁수왕');
    status='blocked';
    assert.equal(await getMember(req),null);
    assert.equal((await GET(req)).status,401);
    assert.ok(readCount>=6);
  }finally{
    globalThis.fetch=prevFetch;
    if(prevUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=prevUrl;
    if(prevKey===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=prevKey;
  }
});
test('SQL and middleware guard stay in source without modifying existing calculator logic',()=>{
  const sql=readFileSync(new URL('../supabase/sql/access-control.sql',import.meta.url),'utf8');
  const proxy=readFileSync(new URL('../proxy.js',import.meta.url),'utf8');
  for(const table of ['access_members','access_sessions','access_rate_limits'])assert.match(sql,new RegExp(''+table+' enable row level security'));
  assert.match(sql,/revoke execute on function public\.access_throttle/);
  assert.match(proxy,/getMember\(request\)/);
  assert.match(proxy,/pathname === '\/admin\.html'/);
  assert.match(proxy,/\/login\.html/);
  assert.match(readFileSync(new URL('../awakening.html',import.meta.url),'utf8'),/const MAX=120000/);
  assert.match(readFileSync(new URL('../calculator.html',import.meta.url),'utf8'),/id="tabCore"/);
});

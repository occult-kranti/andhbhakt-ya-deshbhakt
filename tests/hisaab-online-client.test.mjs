import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnlineClient, OnlineError } from '../editions/hisaab/online/client.mjs';
import { STORAGE } from '../lib/storage-names.mjs';

const token = 'a'.repeat(64);
const memory = () => { const values = new Map(); return { getItem:k=>values.get(k) || null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k), values }; };
const response = (data, status=200) => new Response(JSON.stringify(data), { status, headers:{'Content-Type':'application/json'} });
const session = { id:'player-one', nickname:'Rani', email:'rani@example.org', profileComplete:true, adultConfirmed:true, termsVersion:'beta-1', expiresAt:Date.now()+86400000, onlineXp: 90 };
const profile = { nickname:'Rani', email:'rani@example.org', adultConfirmed:true, termsVersion:'beta-1' };

test('online transport does not contact an unconfigured or insecure endpoint', async () => {
  let calls=0;
  for (const url of ['', 'http://remote.example/game', 'javascript:bad']) {
    const client=createOnlineClient({url,fetcher:async()=>{calls++;}});
    await assert.rejects(client.connect(profile), e=>e.code==='UNCONFIGURED');
  }
  assert.equal(calls,0);
});
test('server profile credential stays in header and resumes without creating another identity', async () => {
  const storage=memory(); const calls=[];
  const fetcher=async(url,opts)=>{calls.push({url,opts}); return response({ok:true,serverNow:5000,session,...(JSON.parse(opts.body).action==='session'?{token}:{})});};
  const client=createOnlineClient({url:'https://server.example/game',storage,fetcher});
  await client.connect(profile);
  assert.equal(calls[0].opts.headers['x-hisaab-session'],undefined);
  assert.equal(JSON.parse(storage.getItem(STORAGE.serverSession)).token,token);
  const resumed=createOnlineClient({url:'https://server.example/game',storage,fetcher});
  await resumed.connect();
  assert.equal(JSON.parse(calls[1].opts.body).action,'profile');
  assert.equal(calls[1].opts.headers['x-hisaab-session'],token);
  assert.equal(calls[1].opts.headers['x-region'],'ap-south-1');
  assert.ok(!calls[1].url.includes(token));
  assert.ok(!calls[1].opts.body.includes(token));
  assert.equal(calls[1].opts.credentials,'omit');
  assert.equal(resumed.session.onlineXp,90, 'cumulative XP comes from the server profile, not local progression');
});
test('server projection clock uses monotonic request midpoint and best RTT', async () => {
  let now=1000; let server=9000; let delay=20;
  const client=createOnlineClient({url:'https://server.example/game',clock:()=>now,fetcher:async()=>{now+=delay;return response({ok:true,serverNow:server,session,token});}});
  await client.connect(profile);
  assert.equal(client.now(),9010); now+=40;assert.equal(client.now(),9050);
  server=20000;delay=100;await client.request('profile');
  assert.equal(client.latencyMs,20);assert.equal(client.now(),9150);
});
test('malformed and expired credentials cannot silently become a fresh identity',async()=>{
 const storage=memory();storage.setItem(STORAGE.serverSession,JSON.stringify({token:'bad',session}));
 const bad=createOnlineClient({url:'https://server.example/game',storage});assert.equal(bad.session,null);
 storage.setItem(STORAGE.serverSession,JSON.stringify({token,session}));let calls=0;
 const expired=createOnlineClient({url:'https://server.example/game',storage,fetcher:async()=>{calls++;return response({ok:false,error:{code:'SESSION_EXPIRED',message:'Guest identity expired.'}},401);}});
 await assert.rejects(expired.connect(),e=>e.code==='SESSION_EXPIRED');assert.equal(calls,1);assert.equal(expired.session.id,session.id);
 expired.forget();assert.equal(expired.session,null);assert.equal(storage.getItem(STORAGE.serverSession),null);
});
test('answer retry sends identical idempotency payload; transport does not score locally',async()=>{
 const storage=memory();storage.setItem(STORAGE.serverSession,JSON.stringify({token,session}));const payloads=[];let attempts=0;
 const client=createOnlineClient({url:'https://server.example/game',storage,fetcher:async(_,opts)=>{payloads.push(JSON.parse(opts.body));if(attempts++===0)throw new Error('Dropped after commit');return response({ok:true,serverNow:5000,match:{receipt:{correct:true,xp:30}}});}});
 const answer={roomId:'room',round:1,choice:2,requestId:'stable-request'};
 await assert.rejects(client.request('answer',answer),e=>e.code==='NETWORK' && e.message==='Connection interrupted. Retry to check the server’s latest state.');const data=await client.request('answer',answer);
 assert.deepEqual(payloads[0],payloads[1]);assert.equal(data.match.receipt.xp,30);assert.equal(storage.values.size,1);
});
test('abort signals stop poll requests; denied storage permits current-tab profile play',async()=>{
 const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');},removeItem(){throw new Error('denied');}};
 const client=createOnlineClient({url:'https://server.example/game',storage:denied,fetcher:async(_,opts)=>{if(opts.signal.aborted)throw new Error('aborted');return response({ok:true,serverNow:1,session,token});}});
  await client.connect(profile);assert.equal(client.session.id,session.id);assert.equal(client.persistent,false);assert.equal(client.rememberedRoom(),null);client.rememberRoom('room');
 const controller=new AbortController();controller.abort();await assert.rejects(client.request('snapshot',{roomId:'room'},{signal:controller.signal}),e=>e.code==='CANCELLED');
});
test('session subscriptions expose stable immutable snapshots and trusted XP only',async()=>{
 const storage=memory();let emitted=0;let reply={ok:true,serverNow:1,session:{...session,balance:100,savings:100},token};
 const client=createOnlineClient({url:'https://server.example/game',storage,fetcher:async()=>response(reply)});
 const stop=client.subscribe(()=>emitted++);
 await client.connect(profile);const first=client.session;
 assert.equal(client.session,first);assert.equal(emitted,1);
 reply={ok:true,serverNow:2,match:{economy:{balance:60,reserved:40,savings:100},receipt:{xp:9999}}};
 await client.request('snapshot',{roomId:'room'});assert.notEqual(client.session,first);assert.equal(first.balance,100);assert.equal(client.session.onlineXp,90);assert.equal(client.session.savings,100);assert.equal(emitted,2);
 const second=client.session;await client.request('snapshot',{roomId:'room'});assert.equal(client.session,second);assert.equal(emitted,2);
 assert.equal(JSON.parse(storage.getItem(STORAGE.serverSession)).session.onlineXp,90);
 reply={ok:true,serverNow:3,session:{...session,onlineXp:120,balance:60,savings:100}};
 await client.request('profile');assert.equal(client.session.onlineXp,120);assert.equal(JSON.parse(storage.getItem(STORAGE.serverSession)).session.onlineXp,120);assert.equal(emitted,3);
 client.forget();assert.equal(client.session,null);assert.equal(emitted,4);stop();client.forget();assert.equal(emitted,4);
});
test('late old-identity profile cannot overwrite a new profile or resurrect forgotten credentials',async()=>{
 const storage=memory();storage.setItem(STORAGE.serverSession,JSON.stringify({token,session}));let finishOld;
 const newer={...session,id:'player-two',nickname:'New player',onlineXp:0,balance:100,savings:100};
 const client=createOnlineClient({url:'https://server.example/game',storage,fetcher:async(_,opts)=>JSON.parse(opts.body).action==='profile'?new Promise(resolve=>{finishOld=resolve;}):response({ok:true,serverNow:2,session:newer,token:'b'.repeat(64)})});
 const old=client.request('profile');client.forget();await client.connect({...profile,nickname:'New guest'});
 finishOld(response({ok:true,serverNow:1,session:{...session,onlineXp:9999,title:{name:'stale'}}}));
 await assert.rejects(old,{code:'SESSION_CHANGED'});assert.equal(client.session.id,newer.id);assert.equal(client.session.onlineXp,0);assert.equal(client.session.title,undefined);
 assert.equal(JSON.parse(storage.getItem(STORAGE.serverSession)).session.id,newer.id);
});

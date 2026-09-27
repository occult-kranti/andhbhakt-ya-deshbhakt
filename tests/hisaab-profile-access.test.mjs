import test from 'node:test';
import assert from 'node:assert/strict';
import { publicProfileRoute } from '../editions/hisaab/app/shell/profile-route.mjs';
import { createOnlineClient } from '../editions/hisaab/online/client.mjs';
import { STORAGE } from '../lib/storage-names.mjs';

const token = 'a'.repeat(64), recoveryCode = 'b'.repeat(64);
const session = { id:'one', nickname:'Rani', email:'rani@example.org', profileComplete:true, adultConfirmed:true, termsVersion:'beta-1', expiresAt:Date.now()+86_400_000 };
const response = body => new Response(JSON.stringify(body), { status:200, headers:{'Content-Type':'application/json'} });
const storage = () => { const m = new Map(); return { getItem:k=>m.get(k) ?? null, setItem:(k,v)=>m.set(k,v), removeItem:k=>m.delete(k), m }; };

test('every playable route including direct practice and room links requires profile', () => {
  for (const route of ['online','duel','pass','room','aaj','taster','route','files','money','circles']) assert.equal(publicProfileRoute(route, null), false, route);
  for (const route of ['home','start','rules','settings','receipts','ledger']) assert.equal(publicProfileRoute(route, null), true, route);
  assert.equal(publicProfileRoute('me', 'certificate'), true, 'existing local certificate is readable');
});

test('new server identity returns one-time recovery code without storing it with bearer', async () => {
  const saved = storage(), calls=[];
  const client = createOnlineClient({ url:'https://server.example/game', storage:saved, fetcher:async(_,opts)=>{ calls.push(JSON.parse(opts.body)); return response({ ok:true, session, token, recoveryCode }); } });
  const result = await client.createProfile({ nickname:'Rani', email:'rani@example.org', adultConfirmed:true, termsVersion:'beta-1', avatar:'spark', locale:'hi' });
  assert.equal(result.recoveryCode,recoveryCode);
  assert.equal(result.session.profileComplete,true);
  assert.deepEqual(calls[0], { nickname:'Rani', email:'rani@example.org', adultConfirmed:true, termsVersion:'beta-1', avatar:'spark', locale:'hi', action:'session' });
  assert.ok(!saved.getItem(STORAGE.serverSession).includes(recoveryCode), 'recovery secret is never written to local storage');
});

test('recovery sends code without stale bearer and rotates local session atomically', async () => {
  const saved=storage(); saved.setItem(STORAGE.serverSession, JSON.stringify({token,session}));
  const restored={...session,id:'two',nickname:'Other'}; let headers, body;
  const client=createOnlineClient({url:'https://server.example/game', storage:saved, fetcher:async(_,opts)=>{ headers=opts.headers; body=JSON.parse(opts.body); return response({ok:true,token:'c'.repeat(64),session:restored}); }});
  const result=await client.recover(recoveryCode);
  assert.equal(headers['x-hisaab-session'],undefined);
  assert.deepEqual(body,{recoveryCode,action:'recover'});
  assert.equal(result.session.id,'two'); assert.equal(client.session.id,'two');
  assert.equal(JSON.parse(saved.getItem(STORAGE.serverSession)).token,'c'.repeat(64));
});

test('incomplete legacy identity cannot create a new match, but can finish and leave an active one', async () => {
  const saved=storage(); saved.setItem(STORAGE.serverSession, JSON.stringify({token,session:{...session,email:null,profileComplete:false}}));
  const calls=[]; const client=createOnlineClient({url:'https://server.example/game',storage:saved,fetcher:async(_,opts)=>{calls.push(JSON.parse(opts.body).action); return response({ok:true,match:{receipt:{xp:0}}});}});
  for (const action of ['create','join','queue','ready']) await assert.rejects(client.request(action),e=>e.code==='PROFILE_REQUIRED');
  for (const action of ['snapshot','answer','next','leave']) await client.request(action,{roomId:'old-room'});
  assert.deepEqual(calls,['snapshot','answer','next','leave']);
});

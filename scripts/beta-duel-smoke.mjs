/** Two independent HTTP beta profiles. Defaults to local; live writes require an explicit URL + --allow-live.
 * Creates private QA rooms only, then revokes only its own two beta profile credentials. Never prints tokens/codes.
 * Local uses the real Edge handler/validator and PostgreSQL schema; it is not a multi-connection lock test.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { BANK } from '../editions/hisaab/bank/index.mjs';
import { startLocalEdge } from './beta-local-edge.mjs';

if (process.argv.includes('--help')) {
  console.log('node scripts/beta-duel-smoke.mjs --local\nnode scripts/beta-duel-smoke.mjs --url=https://PROJECT.supabase.co/functions/v1/hisaab-game --allow-live\nOptional: --out=/tmp/report.json; HISAAB_API_KEY (publishable only), HISAAB_REGION. Local: PGLITE_MODULE_PATH.');
  process.exit(0);
}
const value = name => process.argv.find(arg => arg.startsWith(`${name}=`))?.slice(name.length+1);
let api = value('--url'), local;
if (!api) { local = await startLocalEdge(); api = local.url; }
const endpoint = new URL(api);
if (!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname) && !process.argv.includes('--allow-live')) throw Error('Remote profile mutations require explicit --allow-live after backend deployment.');
if (!['http:','https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw Error('Use an explicit HTTP(S) game endpoint without URL credentials.');
const out = resolve(value('--out') || '/tmp/ayd-beta-smoke/report.json');
mkdirSync(dirname(out), {recursive:true});
const report = { startedAt:new Date().toISOString(), target:api, mode:local?'local-real-edge-postgres-wasm':'live-two-profile-http', checks:[], requests:[], cleanup:[], limitations:local?['PGlite serializes one SQL connection: no production concurrency or gateway proof.']:['Private QA rooms; not a load test or latency-neutrality proof.'] };
const sessions=[]; const rooms=new Set(); const known = new Map(BANK.map(q=>[q.id,q]));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const save=()=>writeFileSync(out,JSON.stringify(report,null,2));
async function request(session, action, payload={}) {
  const headers={'Content-Type':'application/json'};
  if(session) headers['x-hisaab-session']=session.token;
  if(process.env.HISAAB_API_KEY) headers.apikey=process.env.HISAAB_API_KEY;
  if(process.env.HISAAB_REGION) headers['x-region']=process.env.HISAAB_REGION;
  const started=performance.now();
  const response=await fetch(api,{method:'POST',headers,body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  report.requests.push({action,status:response.status,ms:Math.round(performance.now()-started),code:data.error?.code||null});
  return {data,status:response.status};
}
async function call(session,action,payload) {const {data,status}=await request(session,action,payload);assert.equal(status,200,`${action}: ${data.error?.code}`);assert.equal(data.ok,true,action);return data;}
async function check(name,run){const started=performance.now();try{const evidence=await run();report.checks.push({name,ok:true,ms:Math.round(performance.now()-started),evidence});console.log(`PASS ${name}`);}catch(error){report.checks.push({name,ok:false,error:error.message});throw error;}finally{save();}}
const profile=async client=>(await call(client,'profile')).session;
async function createPair(host,guest,stake,file='all') {
  const match=(await call(host,'create',{stake,file})).match;rooms.add(match.id);
  assert.equal(match.stake,stake);assert.equal(match.file,file);assert.equal(match.mode,'private');
  const joined=(await call(guest,'join',{code:match.code})).match;
  assert.equal(joined.players.length,2);assert.equal(joined.question,null);
  return match;
}
function sealed(match){assert.equal(match.receipt,null);assert.equal(match.result,null);for(const key of ['correctIndex','sourceUrl','explanation','deck','tokenHash','token_hash'])assert.ok(!JSON.stringify(match).includes(`"${key}":`),`unanswered projection leaks ${key}`);}
function rightChoice(question) {const q=known.get(question.id);assert.ok(q,'live item must match the reviewed public seed');const index=question.options.findIndex(option=>option.en===q.options[q.correctIndex]);assert.ok(index>=0,'shuffle preserves correct option text');return index;}
async function play(host,guest,room) {
  for(let round=1;round<=5;round++) {
    const action=round===1?'ready':'next';
    const replies=await Promise.all([host,guest].map(s=>call(s,action,{roomId:room.id,stake:room.stake})));
    const countdown=replies.map(x=>x.match).find(x=>x.phase==='countdown');assert.ok(countdown,'both ready opens countdown');assert.equal(countdown.question,null);
    await pause(Math.max(0,countdown.startsAt-countdown.serverNow+70));
    const pair=await Promise.all([host,guest].map(s=>call(s,'snapshot',{roomId:room.id})));
    pair.forEach(x=>{assert.equal(x.match.phase,'question');sealed(x.match);});
    const h=pair[0].match,g=pair[1].match;assert.equal(h.question.id,g.question.id);assert.equal(h.round,round);
    const choice=rightChoice(h.question),requestId=crypto.randomUUID();
    if(round===2) {
      const attempts=[{session:host,choice,requestId},{session:guest,choice:(choice+1)%4,requestId:crypto.randomUUID()}];
      const replies=await Promise.all(attempts.flatMap(a=>[0,1].map(()=>call(a.session,'answer',{roomId:room.id,round,choice:a.choice,requestId:a.requestId}))));
      assert.ok(replies.some(r=>r.match.result),'simultaneous answer acknowledgements include the settlement');
      const together=await Promise.all([host,guest].map(s=>call(s,'snapshot',{roomId:room.id})));
      assert.deepEqual(together[0].match.result,together[1].match.result);
      assert.equal(together[0].match.result.answers.length,2,'concurrent duplicates seal exactly one answer per seat');
      continue;
    }
    const mine=(await call(host,'answer',{roomId:room.id,round,choice,requestId,elapsedMs:0,score:99999,xp:99999})).match;
    assert.equal(mine.receipt.correct,true);assert.ok([10,20,30].includes(mine.receipt.xp));assert.equal(mine.result,null);
    sealed((await call(guest,'snapshot',{roomId:room.id})).match);
    if(round===1) {
      const duplicates=await Promise.all([0,1].map(()=>call(host,'answer',{roomId:room.id,round,choice,requestId})));
      duplicates.forEach(d=>assert.deepEqual(d.match.receipt,mine.receipt));
    }
    const ended=(await call(guest,'answer',{roomId:room.id,round,choice:round===1?choice:(choice+1)%4,requestId:crypto.randomUUID()})).match;
    assert.equal(ended.phase,round===5?'finished':'result');assert.equal(ended.result.answers.length,2);
  }
  const final=await Promise.all([host,guest].map(s=>call(s,'snapshot',{roomId:room.id})));
  assert.equal(final[0].match.winnerId,host.id);assert.equal(final[1].match.winnerId,host.id);
  return final.map(x=>x.match);
}

try {
  await check('two independent profile credentials and starter balances',async()=>{
    for(const tag of ['A','B']) {const d=await call(null,'session',{nickname:`AYD_QA_${Date.now().toString(36)}_${tag}`,email:`ayd-qa-${crypto.randomUUID()}@example.invalid`,adultConfirmed:true,termsVersion:'beta-1'});assert.match(d.token,/^[a-f0-9]{64}$/);assert.match(d.recoveryCode,/^[a-f0-9]{64}$/);assert.equal(d.session.profileComplete,true);sessions.push({...d.session,token:d.token});assert.equal(d.session.balance,100);}
    assert.notEqual(sessions[0].id,sessions[1].id);assert.notEqual(sessions[0].token,sessions[1].token);return {clients:2,balanceEach:100};
  });
  const [host,guest]=sessions;
  await check('explicit stake confirmation, duplicate ready and pre-start refund',async()=>{
    const r=await createPair(host,guest,20);assert.equal((await request(host,'ready',{roomId:r.id,stake:0})).data.error.code,'STAKE_CONFIRMATION');
    const ready=(await call(host,'ready',{roomId:r.id,stake:20})).match;assert.equal(ready.economy.balance,80);assert.equal(ready.economy.reserved,20);
    const repeat=(await call(host,'ready',{roomId:r.id,stake:20})).match;assert.equal(repeat.economy.balance,80);
    await call(host,'leave',{roomId:r.id});assert.equal((await profile(host)).balance,100);assert.equal((await profile(guest)).balance,100);
    return {reservedOnce:20,refunded:20};
  });
  await check('post-ready forfeit pays the pot exactly once and can leave a zero balance',async()=>{
    const r=await createPair(host,guest,100);await Promise.all([host,guest].map(s=>call(s,'ready',{roomId:r.id,stake:100})));
    const ended=(await call(host,'leave',{roomId:r.id})).match;assert.equal(ended.reason,'player-left-forfeit');assert.equal(ended.winnerId,guest.id);
    await call(host,'leave',{roomId:r.id});await call(guest,'snapshot',{roomId:r.id});
    assert.equal((await profile(host)).balance,0);assert.equal((await profile(guest)).balance,200);return {host:0,guest:200,reward:ended.economy.reward};
  });
  await check('zero-balance profile completes a zero-stake five-round human duel',async()=>{
    assert.equal((await request(host,'create',{stake:1,file:'all'})).data.error.code,'INSUFFICIENT_BALANCE');
    const r=await createPair(host,guest,0);const final=await play(host,guest,r);
    assert.deepEqual(final.map(m=>m.economy.reward),[10,10]);assert.equal((await profile(host)).balance,10);assert.equal((await profile(guest)).balance,210);
    return {rounds:5,stake:0,completionRewardEach:10,privateReceiptSealed:true,concurrentReadyAndAnswers:true,duplicateAnswerIdempotent:true};
  });
  await check('staked x10 media duel settles pot separately from completion rewards',async()=>{
    const before=await Promise.all([host,guest].map(profile));const r=await createPair(host,guest,5,'media');const final=await play(host,guest,r);
    assert.equal(final[0].rewardMultiplier,10);assert.deepEqual(final.map(m=>m.economy.reward),[100,100]);assert.deepEqual(final.map(m=>m.economy.payout),[10,0]);
    const after=await Promise.all([host,guest].map(profile));assert.equal(after[0].balance,before[0].balance+5+100);assert.equal(after[1].balance,before[1].balance-5+100);
    await Promise.all([host,guest].map(s=>call(s,'snapshot',{roomId:r.id})));
    const retry=await Promise.all([host,guest].map(profile));assert.deepEqual(retry.map(s=>s.balance),after.map(s=>s.balance));
    return {stakeEach:5,pot:10,completionRewardEach:100,balancesBefore:before.map(s=>s.balance),balancesAfter:after.map(s=>s.balance),conservedStakeSum:true,concurrentReadyAndAnswers:true,duplicateSettlementIdempotent:true};
  });
  await check('private QA games excluded from daily competitive standings',async()=>{
    for(const s of sessions)assert.equal((await call(s,'leaderboards',{period:'daily'})).self,null);
    return {privateMatchesOnly:true};
  });
} catch(error) {report.failure=error.message;process.exitCode=1;console.error(error.message);}
finally {
  for(const session of sessions) {try{const data=await call(session,'deleteSession');report.cleanup.push({deleted:data.deleted===true});}catch(error){report.cleanup.push({deleted:false,error:error.message});process.exitCode=1;}}
  report.finishedAt=new Date().toISOString();save();await local?.close();console.log(`Report: ${out}`);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { answerXp, createStopwatch, XP_BANDS } from '../editions/hisaab/engine/scoring.mjs';
import { DUEL_MODE_DURATION as JHK_DURATIONS, TIMED_ANSWER_XP as JHK_XP } from '../lib/edition-rules.mjs';
import { createDuelController } from '../editions/hisaab/engine/duel-controller.mjs';
register('../editions/hisaab/node-aliases.mjs', import.meta.url);
const { emptyProfile, reduceProfile, readProfile } = await import('../lib/passport.mjs');
const { emptyProgression, reduceProgression } = await import('../lib/progression.mjs');
const { ACTIVE_EXPEDITIONS } = await import('../lib/expeditions.mjs');
const { QUESTIONS } = await import('../lib/server/bank.mjs');
const { MODE_DURATION, normalizeConfig } = await import('../lib/server/room-engine.mjs');
const { dealDaily, dailyRoundId } = await import('../editions/hisaab/engine/daily.mjs');
const AT = 1_800_000_000_000;

test('XP exact boundaries, wrong answers, invalid times and unbounded careful reading', () => {
  for (const [ms, xp] of [[0,30], [7999,30], [7999.999,30], [8000,20], [14999,20], [15000,10], [1e9,10]]) {
    assert.equal(answerXp(true, ms), xp, String(ms));
    assert.equal(answerXp(false, ms), 0);
  }
  for (const ms of [null, undefined, NaN, Infinity, -1]) assert.equal(answerXp(true, ms), 10);
  assert.deepEqual(XP_BANDS.map(b => b.xp), [30,20,10]);
});

test('stopwatch locks once, does not start before paint, and includes background duration', () => {
  let now = 100;
  const c = createStopwatch(() => now);
  assert.equal(c.lock(), null);
  c.start(); now = 8100; c.start();
  assert.equal(c.elapsed(), 8000);
  now = 19100; // Simulates a hidden tab with no draw/tick callbacks.
  assert.equal(c.lock(), 19000);
  now = 25100;
  assert.equal(c.lock(), 19000);
  assert.equal(c.elapsed(), 19000);
  const safe = createStopwatch(() => now);
  safe.start(); now += 12; assert.equal(safe.elapsed(), 12);
  now -= 8; assert.equal(safe.elapsed(), 12, 'never draws time backwards');
});

test('edition config makes all bands reachable without changing JHK defaults', () => {
  assert.deepEqual(JHK_DURATIONS, {quick:10,trilogy:7,gauntlet:5});
  assert.equal(JHK_XP, null);
  assert.deepEqual(MODE_DURATION, {quick:30,trilogy:30,gauntlet:30});
  for (const mode of Object.keys(MODE_DURATION)) assert.equal(normalizeConfig({mode,duration:30,stake:0,opponent:'bot'}, QUESTIONS).duration,30);
});

test('daily XP reaches real progression; repeated dispatch and reload do not pay again', () => {
  const card = dealDaily('2027-01-15', QUESTIONS).cards[0];
  for (const [elapsedMs, correct, expected] of [[7999,true,30],[8000,true,20],[15000,true,10],[4000,false,0]]) {
    let p = emptyProfile('epoch-time', AT);
    const a = { type:'practice', epoch:p.epoch, at:AT+1, fact:card, choice:correct?card.correctIndex:(card.correctIndex+1)%4, elapsedMs, roundId:dailyRoundId('2027-01-15',0) };
    const next = reduceProfile(p,a);
    assert.equal(next.progression.log.find(e=>e.kind==='discovery').xp, expected);
    assert.ok(next.progression.xp >= expected);
    assert.equal(next.journal.rounds[0].elapsedMs,elapsedMs);
    assert.equal(reduceProfile(next,{...a,at:AT+2,elapsedMs:0}),next,'first accepted answer wins');
    p = readProfile(JSON.parse(JSON.stringify(next)));
    assert.equal(p.journal.rounds[0].elapsedMs,elapsedMs);
    assert.equal(reduceProfile(p,{...a,at:AT+3}).progression.xp,p.progression.xp);
  }
});

test('all six route answers persist time, double taps are ignored, replay answer and completion XP are zero', async () => {
  const route=ACTIVE_EXPEDITIONS[0];
  const { dispatch } = await import('../lib/server/duel-service.mjs');
  const { cards } = await dispatch(null, { action: 'expedition', routeId: route.id });
  let p=emptyProfile('route-clock',AT), at=AT;
  const act=a=>(p=reduceProfile(p,{epoch:p.epoch,at:++at,routeId:route.id,...a}));
  for (let run=1;run<=2;run++) {
    const runId=`timer-run-${run}`;
    act({type:'journey-start',runId,previousRunId:run===1?null:'timer-run-1',cards});
    for(let index=0;index<6;index++) {
      const elapsedMs=[7999,8000,15000][index%3];
      const a={type:'journey-answer',runId,index,choice:cards[index].correctIndex,elapsedMs};
      act(a);
      assert.equal(p.progression.log.find(e=>e.kind==='expedition-answer').xp,run===1?answerXp(true,elapsedMs):0);
      const xp=p.progression.xp;
      const locked=p.journeys[route.key].run.answers[index];
      act({...a,elapsedMs:1,choice:(cards[index].correctIndex+1)%4});
      assert.equal(p.progression.xp,xp);
      assert.deepEqual(p.journeys[route.key].run.answers[index],locked);
      assert.equal(locked.elapsedMs,elapsedMs);
      act({type:'journey-next',runId,index});
    }
    assert.equal(p.journeys[route.key].last.correct,6);
    if(run===2) assert.equal(p.progression.log.find(e=>e.kind==='expedition-complete').xp,0);
    p=readProfile(JSON.parse(JSON.stringify(p)));
    assert.equal(p.journeys[route.key].run.answers[0].elapsedMs,7999);
  }
});

test('duel base XP is deterministic and Surprise Audit is a separate exact bonus', () => {
  for (const [elapsedMs,base] of [[7999,30],[8000,20],[15000,10]]) {
    const p=reduceProgression(emptyProgression(),[{kind:'round',correct:true,elapsedMs,bot:true,topic:'Health',difficulty:'extreme',combo:5,wild:3,matchId:'test-match',index:0}],AT);
    assert.equal(p.log.find(e=>e.kind==='round').xp,base);
    assert.equal(p.log.find(e=>e.meta?.bonus==='surprise-audit').xp,base*2);
  }
  const p=reduceProgression(emptyProgression(),[{kind:'round',correct:false,elapsedMs:50,bot:true,topic:'Health',wild:3,matchId:'miss',index:0}],AT);
  assert.equal(p.log.find(e=>e.kind==='round').xp,0);
  assert.equal(p.log.some(e=>e.meta?.bonus==='surprise-audit'),false);
});

test('live duel freezes displayed and submitted time at first input; resend cannot improve it', async () => {
  let now=100, calls=[];
  const room={id:'a'.repeat(32),revision:1,seat:0,phase:'playing',settled:false,config:{duration:30},round:{id:'round-one',issuedAt:100,scheduledAt:0,question:{question:'?',options:['A','B','C','D']},answerLocked:[false,false],result:null}};
  const controller=createDuelController({perfNow:()=>now, pollMs:{active:60000,waiting:60000,hidden:60000},request:async b=>{calls.push(b);return {room:{...room,revision:2}};}});
  controller.adopt({room});
  assert.equal(await controller.answer(0),false);
  controller.markShown();
  now=15100;
  const results=await Promise.all([controller.answer(2),controller.answer(0),controller.answer(1)]);
  assert.deepEqual(results,[true,false,false]);
  assert.equal(calls.length,1);
  assert.equal(calls[0].elapsedMs,15000);
  now=28100;
  assert.equal(controller.snapshot().elapsedMs,15000);
  await controller.resend();
  assert.equal(calls[1].elapsedMs,15000);
  assert.equal(calls[1].attemptId,calls[0].attemptId);
  controller.dispose();
});


test('pass-and-play shows each answer time while its shared-round verdict ignores speed', async () => {
  const { startPassAndPlay, reducePassAndPlay, passAndPlayView } = await import('../editions/hisaab/p2p/pass-and-play.mjs');
  let s=startPassAndPlay({mode:'quick',rng:()=>0.5});
  const correct=s.deck[0].correctIndex;
  s=reducePassAndPlay(s,{type:'ready'});
  s=reducePassAndPlay(s,{type:'answer',choice:correct,answerTimeMs:1000});
  assert.deepEqual(passAndPlayView(s).answers,[{locked:true},null]);
  s=reducePassAndPlay(s,{type:'ready'});
  s=reducePassAndPlay(s,{type:'answer',choice:correct,answerTimeMs:90000});
  assert.equal(s.rounds[0].result.reason,'both-correct');
  assert.deepEqual(s.scores,[0,0]);
  assert.deepEqual(s.rounds[0].answers.map(a=>a.answerTimeMs),[1000,90000]);
});


test('evicting 200 journal rows cannot repay taster or same-day daily; the next daily date remains eligible', () => {
  const day='2027-01-15';
  const card=dealDaily(day,QUESTIONS).cards[0];
  let p=emptyProfile('eviction-clock',AT), at=AT;
  const act=a=>(p=reduceProfile(p,{epoch:p.epoch,at:++at,...a}));
  const practice=(fact,roundId)=>({type:'practice',fact,choice:fact.correctIndex,elapsedMs:1000,roundId});
  act(practice(card,`practice:taster-${card.factId}:0`));
  act(practice(card,dailyRoundId(day,0)));
  for(let i=0;i<201;i++) {
    const q=QUESTIONS.find((q,index)=>index===i && q.id!==card.factId) || QUESTIONS[i+202];
    act(practice({...q,factId:q.id},`practice:taster-${q.id}:0`));
  }
  assert.equal(p.journal.rounds.length,200);
  assert.equal(p.journal.rounds.some(r=>r.id===dailyRoundId(day,0)),false);
  p=readProfile(JSON.parse(JSON.stringify(p)));
  const priorXp=p.progression.xp;
  const priorDiscoveries=p.progression.counters.discoveries;
  act(practice(card,`practice:taster-${card.factId}:0`));
  assert.equal(p.progression.xp,priorXp);
  act(practice(card,dailyRoundId(day,0)));
  assert.equal(p.progression.xp,priorXp);
  assert.equal(p.progression.counters.discoveries,priorDiscoveries);
  act(practice(card,dailyRoundId('2027-01-16',0)));
  assert.equal(p.progression.log.find(e=>e.kind==='discovery').xp,30);
  assert.equal(p.progression.counters.discoveries,priorDiscoveries+1);
});

/** Bounded profile contract check against both deployed game functions.
 * Four disposable private QA profiles use a reserved .invalid email domain. No email is sent.
 * Never records bearer tokens, recovery codes, emails or private invite codes.
 * Usage: HISAAB_GAME_URL=https://.../hisaab-game JHK_GAME_URL=https://.../jhk-game node scripts/beta-profile-live-smoke.mjs --allow-live
 * Optional public gateway keys: HISAAB_API_KEY, JHK_API_KEY. Local HTTP loopback needs no --allow-live.
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

const games=[
 {name:'AYD',url:process.env.HISAAB_GAME_URL,header:'x-hisaab-session',key:process.env.HISAAB_API_KEY,file:'all'},
 {name:'JHK',url:process.env.JHK_GAME_URL,header:'x-jhk-session',key:process.env.JHK_API_KEY,file:'science'},
];
for(const game of games){
 if(!game.url)throw Error(`Set ${game.name==='AYD'?'HISAAB_GAME_URL':'JHK_GAME_URL'}.`);
 const parsed=new URL(game.url);
 if(parsed.username||parsed.password||!['http:','https:'].includes(parsed.protocol))throw Error('Use an HTTP(S) endpoint without URL credentials.');
 if(!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname) && (parsed.protocol!=='https:'||!process.argv.includes('--allow-live')))throw Error('Remote QA mutations require HTTPS and --allow-live.');
 game.profiles=[];
}
const out=resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'/tmp/beta-profile-smoke/report.json');
mkdirSync(dirname(out),{recursive:true});
const report={startedAt:new Date().toISOString(),targets:games.map(({name,url})=>({name,url})),checks:[],cleanup:[]};
const save=()=>writeFileSync(out,JSON.stringify(report,null,2));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fail=(data,action)=>`${action}: ${data.error?.code||'unexpected response'}`;
async function request(game,action,payload={},profile){
 const response=await fetch(game.url,{method:'POST',headers:{'content-type':'application/json',...(game.key?{apikey:game.key}:{}),...(profile?{[game.header]:profile.token}:{})},body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();return {data,status:response.status};
}
async function call(game,action,payload={},profile){const {data,status}=await request(game,action,payload,profile);assert.equal(status,200,fail(data,action));assert.equal(data.ok,true,fail(data,action));return data;}
async function check(label,run){await run();report.checks.push(label);console.log(`PASS ${label}`);save();}
async function register(game,nickname,email){
 const response=await call(game,'session',{nickname,email,adultConfirmed:true,termsVersion:'beta-1'});
 assert.match(response.token,/^[a-f0-9]{64}$/);assert.match(response.recoveryCode,/^[a-f0-9]{64}$/);
 assert.equal(response.session.profileComplete,true);assert.equal(response.session.email,email);
 const profile={id:response.session.id,token:response.token,code:response.recoveryCode};game.profiles.push(profile);return profile;
}
async function recover(game,profile){
 const old=profile.token,restored=await call(game,'recover',{recoveryCode:profile.code});
 profile.token=restored.token;
 assert.equal(restored.session.id,profile.id);assert.equal((await request(game,'profile',{}, {token:old})).data.error?.code,'UNAUTHORIZED');
 assert.equal((await call(game,'profile',{},profile)).session.id,profile.id);
 const rotated=await call(game,'rotateRecovery',{},profile);
 assert.match(rotated.recoveryCode,/^[a-f0-9]{64}$/);assert.notEqual(rotated.recoveryCode,profile.code);
 assert.equal((await request(game,'recover',{recoveryCode:profile.code})).data.error?.code,'BAD_RECOVERY');
 profile.code=rotated.recoveryCode;
}
async function snapshot(game,profile,id){return (await call(game,'snapshot',{roomId:id},profile)).match;}
async function until(game,profile,id,predicate){
 const end=Date.now()+45000;
 while(Date.now()<end){const room=await snapshot(game,profile,id);if(predicate(room))return room;await pause(300);}
 throw Error(`${game.name} room transition timed out`);
}
async function duel(game,a,b,email){
 const created=(await call(game,'create',{file:game.file,stake:0},a)).match;
 const joined=(await call(game,'join',{code:created.code},b)).match;
 assert.equal(joined.id,created.id);
 for(const view of [created,joined]){assert.ok(!JSON.stringify(view).includes(email));assert.ok(!JSON.stringify(view).includes('"email"'));}
 for(let round=1;round<=5;round++){
  await Promise.all([a,b].map(p=>call(game,round===1?'ready':'next',{roomId:created.id,stake:0},p)));
  const active=await until(game,a,created.id,m=>m.phase==='question'&&m.round===round&&m.question);
  const rival=await until(game,b,created.id,m=>m.phase==='question'&&m.round===round&&m.question);
  assert.equal(rival.question.id,active.question.id);
  assert.ok(!JSON.stringify(active).includes(email));assert.ok(!JSON.stringify(active).includes('"email"'));
  await Promise.all([a,b].map(p=>call(game,'answer',{roomId:created.id,round,choice:0,requestId:crypto.randomUUID()},p)));
  await until(game,a,created.id,m=>round===5?m.phase==='finished':m.phase==='result');
 }
 const final=await snapshot(game,b,created.id);
 assert.equal(final.phase,'finished');assert.ok(!JSON.stringify(final).includes(email));
 const board=await call(game,'leaderboards',{period:'daily'},a);
 const circles=await call(game,'circles',{operation:'list'},a);
 for(const publicView of [board,circles])assert.ok(!JSON.stringify(publicView).includes(email));
}
try{
 const email=`qa-${crypto.randomUUID()}@example.invalid`;
 await check('mandatory email, age attestation and terms on both games',async()=>{
  for(const game of games){
   for(const payload of [{nickname:'QA Probe'},{nickname:'QA Probe',email,adultConfirmed:false,termsVersion:'beta-1'},{nickname:'QA Probe',email,adultConfirmed:true,termsVersion:'old'}]){
    const {data}=await request(game,'session',payload);
    if(data.ok&&data.token)game.profiles.push({id:data.session?.id,token:data.token}); // Clean up even if a deployed gate regresses.
    assert.equal(data.ok,false);
    assert.ok(['PROFILE_REQUIRED','AGE_CONFIRMATION_REQUIRED','TERMS_REQUIRED'].includes(data.error?.code));
   }
  }
 });
 await check('duplicate unverified email creates isolated private profiles',async()=>{
  for(const game of games){
   const a=await register(game,`QA ${game.name} A`,email),b=await register(game,`QA ${game.name} B`,email);
   assert.notEqual(a.id,b.id);assert.notEqual(a.token,b.token);assert.notEqual(a.code,b.code);
   assert.equal((await call(game,'profile',{},a)).session.email,email);
   assert.equal((await call(game,'profile',{},b)).session.email,email);
   const own=await call(game,'exportProfile',{},a);assert.equal(own.profile.email,email);
  }
 });
 await check('wrong and cross-game recovery codes never identify an account',async()=>{
  for(const game of games)assert.equal((await request(game,'recover',{recoveryCode:'f'.repeat(64)})).data.error?.code,'BAD_RECOVERY');
  for(const [source,target] of [[games[0],games[1]],[games[1],games[0]]]){
   const wrong=await request(target,'recover',{recoveryCode:source.profiles[0].code});
   assert.equal(wrong.data.error?.code,'BAD_RECOVERY');assert.equal(wrong.data.session,undefined);
  }
 });
 await check('recovery rotates bearer, code rotation invalidates old code',async()=>{
  for(const game of games)await recover(game,game.profiles[0]);
 });
 await check('five-round private duels and public projections hide email',async()=>{
  for(const game of games)await duel(game,game.profiles[0],game.profiles[1],email);
 });
} catch(error){report.failure=error.message;process.exitCode=1;console.error(error.message);}
finally{
 for(const game of games)for(const profile of game.profiles){
  try {const deleted=await call(game,'deleteSession',{},profile);const rejected=profile.code ? (await request(game,'recover',{recoveryCode:profile.code})).data.error?.code==='BAD_RECOVERY' : true;report.cleanup.push({game:game.name,deleted:deleted.deleted===true,recoveryRevoked:rejected});if(!deleted.deleted||!rejected)process.exitCode=1;}
  catch(error){report.cleanup.push({game:game.name,deleted:false,error:error.message});process.exitCode=1;}
 }
 report.finishedAt=new Date().toISOString();save();console.log(`Report: ${out}`);
}

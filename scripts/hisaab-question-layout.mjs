/** Bounded visual regression for a long existing-bank prompt. Fixtures verify layout only. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { BANK } from '../editions/hisaab/bank/index.mjs';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
const q=BANK.find(q=>q.question.includes("Arun Jaitley's Budget 2017"));assert.ok(q);
const HS=storageNames(STORAGE_NS),out='/tmp/hisaab-question-layout';mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/tmp/hisaab-chromium-runtime/chromium',args:['--no-sandbox']});const checks=[];
try{for(const width of [390,1440]){
 const c=await b.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 await c.addInitScript(({HS})=>{localStorage.setItem(HS.locale,'en');localStorage.setItem(HS.theme,'dark');localStorage.setItem(HS.serverSession,JSON.stringify({token:'f'.repeat(64),session:{id:'a',nickname:'Layout reader',expiresAt:Date.now()+999999,onlineXp:0}}));localStorage.setItem(HS.serverRoom,'00000000-0000-4000-8000-000000000000');},{HS});
 await c.route('**/functions/v1/hisaab-game',route=>{const now=Date.now();const req=route.request().postDataJSON();return route.fulfill({json:{ok:true,serverNow:now,...(req.action==='profile'?{session:{id:'a',nickname:'Layout reader',expiresAt:now+999999,onlineXp:0}}:{match:{id:'00000000-0000-4000-8000-000000000000',mode:'private',phase:'question',round:1,roundCount:5,startsAt:now,deadlineAt:now+30000,serverNow:now,selfId:'a',players:[{id:'a',nickname:'Layout reader',score:0},{id:'b',nickname:'Another reader',score:0}],question:{id:q.id,prompt:{en:q.question},options:q.options.map(en=>({en})),category:q.topic},receipt:null,result:null,winnerId:null}})}});});
 const p=await c.newPage();await p.goto('http://127.0.0.1:4190/#/online');await p.locator('.h-online__answers button').nth(3).waitFor();await p.evaluate(()=>document.fonts.ready);
 const stats=await p.evaluate(()=>{const h=document.querySelector('.h-online__question h1');const d=document.querySelectorAll('.h-online__answers button')[3];return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,promptHeight:h.getBoundingClientRect().height,promptFont:getComputedStyle(h).fontSize,lastAnswerBottom:d.getBoundingClientRect().bottom};});
 assert.ok(stats.scrollWidth<=width+1);if(width===1440)assert.ok(stats.lastAnswerBottom<=900,'All four desktop answers must be visible for this long prompt');checks.push(stats);await p.screenshot({path:`${out}/long-question-${width}.png`,fullPage:true});await c.close();
}}finally{await b.close();writeFileSync(out+'/report.json',JSON.stringify({evidence:'Existing question fixture; layout only',checks},null,2));}console.log(JSON.stringify(checks));

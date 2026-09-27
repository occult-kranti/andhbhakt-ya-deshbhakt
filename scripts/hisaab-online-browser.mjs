/** Real browser + deployed API smoke. Uses two disposable guests and never completes a ranked match. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';
const HS=storageNames(STORAGE_NS);
const base=process.env.HISAAB_TEST_BASE || 'http://127.0.0.1:4189/';
const out=process.env.HISAAB_TEST_OUT || '/tmp/hisaab-online-browser';
const api='https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/hisaab-game';
mkdirSync(out,{recursive:true});
const report={checks:[],screens:[],errors:[],startedAt:new Date().toISOString(),transport:process.env.HISAAB_TEST_PROXY_TLS==='1'?'Test browser trusts the execution proxy; production TLS configuration is unchanged.':'Normal browser TLS validation'};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/tmp/hisaab-chromium-runtime/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',...(process.env.HTTPS_PROXY?['--proxy-server='+process.env.HTTPS_PROXY,'--proxy-bypass-list=localhost;127.0.0.1']:[])]});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const check=(name,details={})=>{report.checks.push({name,ok:true,...details});console.log('PASS',name);};
let contexts=[];
try {
 for(const [i,width] of [390,1440].entries()) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',ignoreHTTPSErrors:process.env.HISAAB_TEST_PROXY_TLS==='1'}); contexts.push(context);
  await context.addInitScript(({theme,HS})=>{localStorage.setItem(HS.locale,'en');localStorage.setItem(HS.theme,theme);},{theme:i?'dark':'light',HS});
 }
 const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
 for(const p of [a,b]) { p.on('pageerror',e=>report.errors.push(e.message)); p.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')report.errors.push(`${r.method()} ${new URL(r.url()).hostname}: ${r.failure()?.errorText}`);}); }
 await Promise.all([a,b].map(p=>p.goto(base+'#/online',{waitUntil:'networkidle'})));
 async function shot(p,name){await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:join(out,name+'.png'),fullPage:true});const d=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.scrollingElement.scrollWidth,theme:document.documentElement.dataset.theme}));report.screens.push({name,...d});assert.ok(d.scrollWidth<=d.width+1,name+' horizontal overflow');}
 await shot(a,'online-mobile-entry');await shot(b,'online-desktop-entry');
 for(const [i,p] of [a,b].entries()) {
  await p.locator('#h-online-name').fill('HISAAB_QA_UI'+i+'_'+Date.now().toString().slice(-6));
  await p.getByRole('button',{name:'Connect to play',exact:true}).click();
  try { await p.getByRole('button',{name:'Create private room',exact:true}).waitFor({timeout:18000}); } catch { await p.getByRole('button',{name:'Retry connection',exact:true}).click(); await p.getByRole('button',{name:'Create private room',exact:true}).waitFor({timeout:25000}); check('Connection retry recovered a transient request'); }
 }
 check('Two independent browsers connect to deployed Supabase API');
 if(!process.env.HISAAB_SKIP_PRIVATE) {
 await a.getByRole('button',{name:'Create private room',exact:true}).click();
 const code=(await a.locator('.h-online__code').textContent({timeout:25000})).trim();
 assert.match(code,/^[A-F0-9]{12}$/);
 await b.locator('#h-online-code').fill(code);await b.getByRole('button',{name:'Join',exact:true}).click();
 await Promise.all([a,b].map(p=>p.getByRole('button',{name:'I’m ready',exact:true}).waitFor({timeout:20000})));
 await shot(a,'online-mobile-private-lobby');
 await Promise.all([a,b].map(p=>p.getByRole('button',{name:'I’m ready',exact:true}).click()));
 for(let round=1;round<=5;round++){
  await Promise.all([a,b].map(p=>p.locator('.h-online__answers button').first().waitFor({state:'visible',timeout:25000})));
  assert.equal(await a.locator('.h-online__question h1').textContent(),await b.locator('.h-online__question h1').textContent());
  if(round===1){
   await shot(b,'online-desktop-question');
   const t=Date.now(); await a.locator('.h-online__answers button').first().click();
   await a.locator('.h-online__receipt').waitFor({timeout:15000});
   check('Accepted answer produces personal receipt without waiting 30 seconds',{receiptMs:Date.now()-t});
   assert.equal(await b.locator('.h-online__receipt').count(),0);assert.equal(await b.locator('.h-online__answers button:not(:disabled)').count(),4);
   check('Unanswered opponent keeps four active options and no receipt');
   await shot(a,'online-mobile-personal-receipt');
   await a.reload({waitUntil:'domcontentloaded'});await a.locator('.h-online__receipt').waitFor({timeout:20000});
   check('Reload restores the same locked personal receipt');
   await b.locator('.h-online__answers button').first().click();
  }else await Promise.all([a,b].map(p=>p.locator('.h-online__answers button').first().click()));
  if(round<5){await Promise.all([a,b].map(p=>p.getByRole('button',{name:'Next round',exact:true}).waitFor({timeout:20000})));await Promise.all([a,b].map(p=>p.getByRole('button',{name:'Next round',exact:true}).click()));}
 }
 await Promise.all([a,b].map(p=>p.getByRole('button',{name:'Back to online desk',exact:true}).waitFor({timeout:20000})));
 check('Five-round private match settles through concurrent final answers');
 await a.getByRole('button',{name:'Read the standings',exact:true}).click();
 } else { await a.goto(base+'#/online/standings',{waitUntil:'domcontentloaded'}); }
 await a.locator('.h-online__standings').waitFor({timeout:20000});
 await a.getByRole('button',{name:'Tournament',exact:true}).click();await a.locator('.h-online__tournament').waitFor({timeout:15000});
 await a.setViewportSize({width:320,height:800});await shot(a,'online-320-tournament');
 check('Result links open tournament standings with no mobile overflow');
 await a.goto(base+'#/online/circles',{waitUntil:'domcontentloaded'});
 await a.getByLabel('Circle name',{exact:true}).fill('QA private family');await a.getByRole('combobox',{name:/Circle type/}).selectOption('family');
 await a.getByLabel('Your nickname in this circle',{exact:true}).fill('QA Nana');await a.getByRole('button',{name:'Create circle',exact:true}).click();
 await a.locator('.h-online__circle').waitFor({timeout:15000});await a.reload({waitUntil:'domcontentloaded'});await a.locator('.h-online__circle').waitFor({timeout:15000});
 assert.match(await a.locator('.h-online__members').textContent(),/QA Nana/);await shot(a,'online-320-family-circle');
 check('Server circle and personal family nickname survive reload');
 await Promise.all([a,b].map(p=>p.goto(base+'#/online',{waitUntil:'domcontentloaded'})));
 // B may restore a terminal local view; explicit finished match action opens the desk.
 if(await b.getByRole('button',{name:'Back to online desk',exact:true}).count())await b.getByRole('button',{name:'Back to online desk',exact:true}).click();
 await Promise.all([a,b].map(p=>p.getByRole('button',{name:'Find an opponent',exact:true}).waitFor({timeout:20000})));
 await Promise.all([a,b].map(p=>p.getByRole('button',{name:'Find an opponent',exact:true}).click()));
 await Promise.all([a,b].map(p=>p.getByRole('button',{name:'I’m ready',exact:true}).waitFor({timeout:20000})));
 check('Public matchmaking pairs the two real guest sessions');
 await a.getByRole('button',{name:'Settings',exact:true}).click();await a.getByRole('button',{name:'Leave game',exact:true}).click();await a.getByRole('button',{name:'Yes, leave match',exact:true}).click();
 await a.getByRole('button',{name:'Find an opponent',exact:true}).waitFor({timeout:15000});
 await b.getByText('The table has closed.',{exact:true}).waitFor({timeout:20000});
 check('Settings quit immediately exits and server closes the opponent table');
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));
} catch(e){for(const [i,c] of contexts.entries()){const p=c.pages()[0];if(p){await p.screenshot({path:join(out,`failure-${i}.png`),fullPage:true});console.error('Page',i,(await p.locator('[role="alert"]').allTextContents()).join(' '));}}report.checks.push({name:'browser flow',ok:false,error:String(e.stack||e)});console.error(e);console.error(report.errors);process.exitCode=1;}
finally {
 for(const context of contexts){try{const p=context.pages()[0];await p.evaluate(async(api)=>{const key=Object.keys(localStorage).find(k=>k.includes('server-session'));if(!key)return;const c=JSON.parse(localStorage.getItem(key));if(c?.token)await fetch(api,{method:'POST',headers:{'Content-Type':'application/json','x-hisaab-session':c.token},body:JSON.stringify({action:'deleteSession'})});},api);}catch{}}
 report.finishedAt=new Date().toISOString();writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();
}

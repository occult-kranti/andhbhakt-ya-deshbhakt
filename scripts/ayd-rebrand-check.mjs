/** Bounded rebrand review at narrow, phone and desktop sizes, including actual PNG exports. */
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const out=resolve(process.argv[2] || '/tmp/ayd-rebrand-review'); mkdirSync(out,{recursive:true});
const vite=await createServer({configFile:'vite.config.hisaab.ts',server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}}); await vite.listen();
const base=`http://127.0.0.1:${vite.httpServer.address().port}/andhbhakt-ya-deshbhakt/`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/tmp/hisaab-chromium-runtime/chromium',headless:true,args:['--no-sandbox']});
try {
 const errors=[];
 for(const width of [320,390,1440]) {
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.locator('.h-masthead').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`home overflow ${width}`);
  assert.doesNotMatch(await page.locator('body').innerText(),/HISAAB DO|Certified Anti-National/);
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://occult-kranti.github.io/andhbhakt-ya-deshbhakt/');
  await page.screenshot({path:`${out}/home-${width}.png`,fullPage:true});
  await page.goto(base+'#/me/certificate');await page.locator('.h-cert__art').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`certificate overflow ${width}`);
  assert.equal(await page.locator('.h-cert__art').getAttribute('aria-label'),'30% player portrait, 70% satirical caricature');
  await page.screenshot({path:`${out}/certificate-${width}.png`,fullPage:true});
  if(width===390) {
   await page.evaluate(async()=>{const{certificateBlob}=await import('/andhbhakt-ya-deshbhakt/app/share/index.ts');window.certificateBlob=certificateBlob;});
   for(const band of [0,1,8]) {
    const b64=await page.evaluate(async band=>{const blob=await window.certificateBlob({name:'Receipt Rani',band,receipts:1200,issuedOn:null});return await new Promise(resolve=>{const file=new FileReader();file.onload=()=>resolve(file.result.split(',')[1]);file.readAsDataURL(blob);});},band);
    writeFileSync(`${out}/export-${band}.png`,Buffer.from(b64,'base64'));
   }
  }
  await page.close();console.log(`PASS rebrand home and certificate ${width}px`);
 }
 assert.deepEqual(errors,[]);
 const social=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await social.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#f2eddf;color:#252219;padding:48px 64px;font-family:Georgia,serif}.top{border-top:5px double #252219;border-bottom:1px solid #252219;padding:17px 0;display:flex;justify-content:space-between;font:700 18px monospace;letter-spacing:2px}.name{font-size:108px;font-weight:900;letter-spacing:-6px;line-height:.92;margin:42px 0 30px}.name em{font-size:65px;font-weight:400}.name span{color:#4a22d4}.strap{font-size:27px;margin:0;max-width:900px;line-height:1.4}.foot{display:flex;justify-content:space-between;margin-top:46px;padding-top:17px;border-top:1px solid #252219;font:700 18px monospace}.button{background:#4a22d4;color:#fffaf0;padding:10px 18px;margin-top:-11px}</style></head><body><div class="top"><span>HUMAN DUELS · SOURCED ANSWERS</span><span>THE PUBLIC-MONEY QUIZ</span></div><div class="name">Andhbhakt<br><em>ya</em> Deshbhakt<span>.</span></div><p class="strap">Your next opponent has opinions.<br>Bring receipts. Earn your label.</p><div class="foot"><span>SATIRE. EVERY ANSWER SOURCED.</span><span class="button">PLAY A DUEL →</span></div></body></html>`);
 await social.screenshot({path:'editions/hisaab/public/social-card.png'});
 console.log('PASS complete name and 1200x630 social preview generated; no browser runtime errors');
} finally {await browser.close();await vite.close();}

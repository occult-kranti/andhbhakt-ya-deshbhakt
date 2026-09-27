/**
 * One bounded, real Trystero/WebRTC smoke attempt in independent browser contexts.
 * This is not a cross-Internet/NAT certification. No transport mock or fallback is used.
 * CHROME_PATH=/path/to/chromium node scripts/hisaab-webrtc-smoke.mjs <outDir> <baseUrl>
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';

const out = resolve(process.argv[2] || '/tmp/hisaab-webrtc-smoke');
const base = process.argv[3] || 'http://127.0.0.1:4174/fact-duel/hisaab/';
const HS = storageNames(STORAGE_NS);
const report = { startedAt: new Date().toISOString(), transport: 'Trystero/WebRTC', independentContexts: true, timeoutMs: 30000, completedSteps: [], messages: [], failures: [], ok: false };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
const contexts = [];
const pages = [];
let timer;
try {
  await Promise.race([
    (async () => {
      for (const label of ['host', 'guest']) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        contexts.push(context);
        await context.addInitScript(HS => { localStorage.setItem(HS.art, 'off'); localStorage.setItem(HS.motion, 'reduced'); }, HS);
        const page = await context.newPage(); pages.push(page);
        page.on('pageerror', e => report.failures.push({ label, kind: 'exception', text: e.message }));
        page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.messages.push({ label, kind: m.type(), text: m.text() }); });
        page.on('requestfailed', r => report.failures.push({ label, kind: 'request', url: r.url(), text: r.failure()?.errorText }));
        page.setDefaultTimeout(12000);
      }
      const [host, guest] = pages;
      await host.goto(base + '#/duel?vs=friend&mode=quick');
      await host.locator('.h-setup__launch .h-btn--primary').click();
      await host.waitForSelector('.h-lobby__big');
      const code = (await host.locator('.h-lobby__big').textContent()).trim();
      report.completedSteps.push('host generated genuine WebRTC room');
      await guest.goto(base + `#/duel/friend?code=${encodeURIComponent(code)}`);
      await guest.locator('form .h-btn--primary').click();
      await guest.waitForSelector('.h-lobby__big');
      report.completedSteps.push('guest joined room through real relay');
      for (const page of [host, guest]) {
        await page.waitForFunction(() => { const b = document.querySelector('.h-lobby__bar .h-btn--primary'); return b && !b.disabled; });
        await page.locator('.h-lobby__bar .h-btn--primary').click();
      }
      await Promise.all(pages.map(page => page.waitForSelector('.h-live .h-opt:not([disabled])')));
      report.completedSteps.push('both independent contexts received live question');
      await host.locator('.h-live .h-opt').first().click();
      await host.waitForSelector('.h-personal-receipt');
      await guest.locator('.h-live .h-opt').nth(1).click();
      await Promise.all(pages.map(page => page.waitForSelector('.h-arena[data-view="receipt"]')));
      report.completedSteps.push('private result then final receipt reached both peers');
      report.ok = true;
    })(),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Bounded 30 second WebRTC attempt expired')), 30000); }),
  ]);
} catch (error) {
  report.error = String(error.message || error);
} finally {
  clearTimeout(timer);
  for (const [i, page] of pages.entries()) {
    report[`${i ? 'guest' : 'host'}Text`] = await page.locator('body').innerText({ timeout: 1000 }).catch(() => 'Page unavailable');
    await page.screenshot({ path: join(out, `${i ? 'guest' : 'host'}.png`), fullPage: true, timeout: 2000 }).catch(() => {});
  }
  await browser.close();
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ ok: report.ok, steps: report.completedSteps, error: report.error, failureCount: report.failures.length }));
if (!report.ok) process.exitCode = 1;

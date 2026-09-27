/** Real-browser certificate contract: local portrait, export, online progress and honour revocation. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';

const out = resolve(process.argv[2] || 'outputs/certificate');
mkdirSync(out, { recursive: true });
process.env.VITE_HISAAB_SERVER_URL = 'https://certificate-test.invalid/game';
const vite = await createServer({ configFile: 'vite.config.hisaab.ts', server: { host: '127.0.0.1', port: 0 } });
await vite.listen();
const base = `http://127.0.0.1:${vite.httpServer.address().port}/fact-duel/hisaab/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/tmp/hisaab-chromium-runtime/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '#/me/certificate');
  await page.locator('.h-cert__art').waitFor();
  assert.equal(await page.locator('.h-cert__art').getAttribute('aria-label'), '30% player portrait, 70% satirical caricature');
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'navy'; ctx.fillRect(0, 0, 400, 400);
    ctx.fillStyle = 'white'; ctx.font = '140px sans-serif'; ctx.fillText('ME', 80, 240);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await page.locator('.h-cert__portrait img').waitFor();
  assert.match(await page.evaluate(() => localStorage.getItem('hisaab:portrait:v1')), /^data:image\/jpeg;base64,/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as image', exact: true }).click();
  await (await download).saveAs(`${out}/portrait-certificate.png`);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  assert.equal(await page.locator('.h-cert__portrait img').count(), 0);
  await page.screenshot({ path: `${out}/certificate-mobile.png`, fullPage: true });
  console.log('PASS local photo normalization, PNG download and removal');
  await page.close();

  const session = {
    id: 'player-a', nickname: 'Receipt Rani', onlineXp: 1_000_000, balance: 0, savings: 0, expiresAt: Date.now() + 86_400_000,
    title: { title: 'certified-antinational', name: 'Certified Anti-National', source: 'savings', rank: 1, awardedAt: Date.now() - 1000, expiresAt: Date.now() + 86_400_000, competitionId: 'savings:fixture' },
  };
  const signed = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  signed.on('pageerror', error => errors.push(error.message));
  await signed.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify({ token: 'a'.repeat(64), session })), { key: storageNames(STORAGE_NS).serverSession, session });
  await signed.route('https://certificate-test.invalid/game', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, serverNow: Date.now(), session }) }));
  await signed.goto(base + '#/me/certificate');
  await signed.waitForFunction(() => document.querySelector('.h-cert__art')?.getAttribute('aria-label') === '90% player portrait, 10% satirical caricature');
  assert.equal(await signed.locator('.h-cert__labelen').textContent(), 'Deshbhakt');
  await signed.locator('.h-certview__honourpick input').check();
  await signed.waitForFunction(() => document.querySelector('.h-cert__labelen')?.textContent === 'Certified Anti-National');
  const honour = signed.waitForEvent('download');
  await signed.getByRole('button', { name: 'Save as image', exact: true }).click();
  await (await honour).saveAs(`${out}/honour-certificate.png`);
  await signed.evaluate(async () => { const { online } = await import('/fact-duel/hisaab/online/runtime.ts'); online.forget(); });
  await signed.waitForFunction(() => document.querySelector('.h-cert__art')?.getAttribute('aria-label') === '30% player portrait, 70% satirical caricature');
  assert.equal(await signed.locator('.h-certview__honourpick').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS server XP advances personal title, live savings honour exports, forgetting identity removes online XP and honour');
} finally { await browser.close(); await vite.close(); }

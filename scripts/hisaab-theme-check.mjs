/** Bounded browser proof for Day/Night/Classic/Rotate and public-page theme parity. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';
import { rotatingEdition } from '../editions/hisaab/theme/preference.mjs';

const base = process.argv[2] || 'http://127.0.0.1:4192/fact-duel/hisaab/';
const out = resolve(process.argv[3] || '/tmp/hisaab-theme-check');
const keys = storageNames(STORAGE_NS);
const at = Date.UTC(2026, 8, 27, 23, 59, 59);
const grounds = { light: '#f2eddf', dark: '#14131b', classic: '#191813' };
const report = { date: new Date().toISOString(), checks: [], errors: [] };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/tmp/hisaab-chromium-runtime/chromium', args: ['--no-sandbox'] });
try {
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: 'dark' });
    await ctx.addInitScript(({ keys, at }) => {
      localStorage.setItem(keys.theme, 'classic');
      localStorage.setItem(keys.motion, 'reduced');
      localStorage.setItem(keys.art, 'off');
      Date.now = () => at;
    }, { keys, at });
    const page = await ctx.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(base + '#/settings');
    await page.getByRole('radio', { name: /Classic edition/ }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const [pref, label] of [['light', 'Day edition'], ['dark', 'Night edition'], ['classic', 'Classic edition'], ['rotate', 'Rotate editions'], ['system', 'Match phone']]) {
      await page.getByRole('radio', { name: new RegExp(label) }).check();
      const resolved = pref === 'rotate' ? rotatingEdition(at) : pref === 'system' ? 'dark' : pref;
      const state = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, ground: getComputedStyle(document.documentElement).getPropertyValue('--h-ground').trim(), overflow: document.documentElement.scrollWidth > innerWidth + 1, scheme: getComputedStyle(document.documentElement).colorScheme }));
      assert.equal(state.theme, resolved);
      assert.equal(state.ground, grounds[resolved]);
      assert.equal(state.scheme, resolved === 'light' ? 'light' : 'dark');
      assert.equal(state.overflow, false);
      report.checks.push({ viewport: width, pref, ...state });
    }
    await page.getByRole('radio', { name: /Rotate editions/ }).check();
    await page.evaluate(() => { Date.now = () => Date.UTC(2026, 8, 28, 12); });
    await page.emulateMedia({ colorScheme: 'light' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), rotatingEdition(at), 'rotation stays fixed across midnight and OS changes');
    await page.getByRole('radio', { name: /Classic edition/ }).check();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(out, `classic-settings-${width}.png`), fullPage: true });
    await page.goto(base + 'about.html');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'classic');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--h-ground').trim()), grounds.classic);
    report.checks.push({ viewport: width, publicClassic: true, noMidVisitRotation: true });
    await ctx.close();
  }
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
} finally {
  await browser.close();
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(`Theme browser checks: ${report.checks.length} passed.`);

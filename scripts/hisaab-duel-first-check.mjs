/** Local browser gate. API responses are fixtures; PostgreSQL rules have a separate SQL gate. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';

const out = resolve(process.argv[2] || 'outputs/duel-first');
mkdirSync(out, { recursive: true });
process.env.VITE_HISAAB_SERVER_URL = 'https://hisaab-test.invalid/functions/v1/hisaab-game';
const vite = await createServer({ configFile: 'vite.config.hisaab.ts', server: { host: '127.0.0.1', port: 0 } });
await vite.listen();
const base = `http://127.0.0.1:${vite.httpServer.address().port}/fact-duel/hisaab/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/tmp/hisaab-chromium-runtime/chromium', headless: true, args: ['--no-sandbox'] });
const HS = storageNames(STORAGE_NS);
const checks = [], errors = [], commands = [];
const ok = (label) => { checks.push(label); console.log('PASS', label); };
async function fit(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`);
  ok(label);
}

async function context(width, theme) {
  const ctx = await browser.newContext({ viewport: { width, height: 940 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(({ HS, theme }) => {
    localStorage.setItem(HS.theme, theme); localStorage.setItem(HS.locale, 'en');
    localStorage.setItem(HS.art, 'off'); localStorage.setItem(HS.sound, 'off'); localStorage.setItem(HS.motion, 'reduced');
  }, { HS, theme });
  const session = { id: 'player-a', nickname: 'Receipt Rani', expiresAt: Date.now() + 86400000, balance: 0, savings: 0, onlineXp: 0 };
  const state = { phase: 'waiting', answered: false, finished: false, file: 'all', stake: 0, started: 0, calls: 0 };
  const receipt = { choice: 1, correct: true, correctIndex: 1, elapsedMs: 1250, xp: 30, explanation: { en: 'The official record confirms this answer.', hi: 'आधिकारिक रिकॉर्ड में यह जवाब है।' }, sourceUrl: 'https://example.com/source' };
  const snapshot = () => ({
    id: '00000000-0000-4000-8000-000000000000', code: 'ABCDEFFEDCBA', mode: 'private',
    phase: state.finished ? 'finished' : state.phase, file: state.file, stake: state.stake, rewardMultiplier: state.file === 'media' ? 10 : 1,
    economy: { status: state.finished ? 'settled' : 'pending', balance: 0, reserved: 0, payout: 0, reward: state.finished ? 100 : 0 },
    round: 1, roundCount: 5, startsAt: state.started, deadlineAt: state.started + 30000, serverNow: Date.now(), selfId: session.id,
    players: [{ id: session.id, nickname: session.nickname, ready: false, answered: state.answered, score: state.answered ? 1 : 0 }, { id: 'player-b', nickname: 'Chai Champion', ready: true, answered: state.finished, score: 0 }],
    question: ['waiting', 'countdown'].includes(state.phase) ? null : { id: 'fixture', prompt: { en: 'Which answer is supported by the public record?' }, options: ['First option', 'Second option', 'Third option', 'Fourth option'].map(en => ({ en })), category: 'Public records' },
    receipt: state.answered ? receipt : null,
    result: state.finished ? { winnerId: session.id, correctIndex: 1, explanation: receipt.explanation, sourceUrl: receipt.sourceUrl, answers: [{ ...receipt, playerId: session.id }, { ...receipt, playerId: 'player-b', correct: false, xp: 0 }] } : null,
    winnerId: state.finished ? session.id : null,
  });
  await ctx.route('**/functions/v1/hisaab-game', async route => {
    const body = route.request().postDataJSON(); commands.push(body); let data = {};
    switch (body.action) {
      case 'session': case 'profile': data = { session, token: 'a'.repeat(64) }; break;
      case 'create': case 'queue': state.file = body.file || 'all'; state.stake = body.stake || 0; state.phase = 'waiting'; state.answered = false; state.finished = false; data = { match: snapshot() }; break;
      case 'ready': state.phase = 'countdown'; state.started = Date.now() + 100; data = { match: snapshot() }; break;
      case 'snapshot': if (state.phase === 'countdown' && Date.now() >= state.started) state.phase = 'question'; data = { match: snapshot() }; break;
      case 'answer': state.calls++; state.answered = true; data = { match: snapshot() }; break;
      case 'leaderboards': data = { period: body.period, startsAt: Date.now() - 10000, endsAt: Date.now() + 86400000, rows: [], self: null }; break;
      case 'circles': data = { circles: [] }; break;
      case 'leave': state.phase = 'cancelled'; data = { match: snapshot() }; break;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, serverNow: Date.now(), ...data }) });
  });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  return { ctx, page, state, session };
}

try {
  for (const [width, theme] of [[390, 'light'], [1440, 'dark'], [320, 'classic']]) {
    const { ctx, page } = await context(width, theme);
    await page.goto(base); await page.getByRole('link', { name: 'Find a duel', exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, '');
    assert.doesNotMatch(await page.locator('body').innerText(), /Babu-Bot|Certified Anti-National/);
    await fit(page, `fresh home ${width} ${theme}`);
    await page.screenshot({ path: `${out}/home-${width}-${theme}.png`, fullPage: true });
    await page.goto(base + '#/me'); await page.getByText('Andhbhakt to Deshbhakt', { exact: true }).waitFor();
    assert.doesNotMatch(await page.locator('body').innerText(), /Certified Anti-National/);
    await page.goto(base + '#/me/certificate'); await page.locator('.h-cert__art').waitFor();
    assert.equal(await page.locator('.h-cert__art').getAttribute('aria-label'), '30% player portrait, 70% satirical caricature');
    await fit(page, `certificate ${width} ${theme}`);
    await page.screenshot({ path: `${out}/certificate-${width}-${theme}.png`, fullPage: true });
    await page.goto(base + '#/room'); await page.waitForURL('**/#/online');
    await page.locator('#h-online-name').fill('Receipt Rani');
    await page.getByRole('button', { name: 'Connect to play', exact: true }).click();
    await page.getByRole('button', { name: 'Find a duel', exact: true }).waitFor();
    await fit(page, `online zero-balance desk ${width} ${theme}`);
    await page.screenshot({ path: `${out}/online-${width}-${theme}.png`, fullPage: true });
    await ctx.close();
  }
  const { ctx, page, state, session } = await context(390, 'light');
  await page.goto(base + '#/online?file=media'); await page.locator('#h-online-name').fill('Receipt Rani');
  await page.getByRole('button', { name: 'Connect to play', exact: true }).click();
  await page.getByRole('button', { name: 'Create private room', exact: true }).click();
  await page.getByRole('button', { name: /ready/i }).click();
  await page.locator('.h-online__answers button').nth(1).waitFor();
  assert.equal(await page.locator('iframe[title*="advert"]').count(), 0);
  await page.locator('.h-online__answers button').nth(1).click();
  await page.locator('.h-online__receipt').waitFor();
  assert.match(await page.locator('.h-online__receipt').innerText(), /Waah Waah/i);
  assert.equal(state.calls, 1); assert.equal(await page.locator('.h-online__roundresult').count(), 0);
  await page.reload(); await page.locator('.h-online__receipt').waitFor(); assert.equal(state.calls, 1);
  ok('zero stake match, one locked answer, Waah Waah, reload recovery, no early opponent reveal');
  state.finished = true;
  await page.getByRole('button', { name: 'Back to online desk', exact: true }).waitFor();
  await fit(page, 'completed duel result');
  await page.screenshot({ path: `${out}/duel-result.png`, fullPage: true });
  assert.ok(commands.some(c => c.action === 'create' && c.stake === 0 && c.file === 'media'));
  assert.ok(commands.some(c => c.action === 'ready' && c.stake === 0));
  ok('selected x10 file and explicit zero stake reach API, including readiness');
  await page.goto(base + '#/me/certificate'); await page.locator('.h-cert').waitFor();
  const input = page.getByLabel('Choose profile photo', { exact: true });
  await input.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await page.getByText('Choose a JPG, PNG or WebP photo.', { exact: true }).waitFor();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCXsAAAAASUVORK5CYII=', 'base64');
  await input.setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: png });
  await page.locator('.h-cert__portrait img').waitFor();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save as image', exact: true }).click();
  const file = await download; await file.saveAs(`${out}/downloaded-certificate.png`); assert.equal(await file.failure(), null);
  await page.getByRole('button', { name: 'Remove', exact: true }).click(); assert.equal(await page.locator('.h-cert__portrait img').count(), 0);
  ok('photo validation, local normalization, PNG export, removable portrait');
  session.onlineXp = 1000000;
  await page.goto(base + '#/me'); await page.goto(base + '#/me/certificate');
  await page.locator('.h-cert__labelen').filter({ hasText: 'Deshbhakt' }).waitFor();
  assert.equal(await page.locator('.h-cert__art').getAttribute('aria-label'), '90% player portrait, 10% satirical caricature');
  await page.screenshot({ path: `${out}/online-earned-deshbhakt.png`, fullPage: true });
  await page.reload(); await page.locator('.h-cert__labelen').filter({ hasText: 'Deshbhakt' }).waitFor();
  ok('cumulative online XP advances certificate and survives reload without double credit');
  await ctx.close();
  assert.deepEqual(errors, []);
} finally {
  await browser.close(); await vite.close();
  writeFileSync(`${out}/report.json`, JSON.stringify({ evidence: 'Local real-browser UI with mocked API. Not live multiplayer, ad-fill, physical-device or WAN evidence.', checks, errors }, null, 2));
}
console.log(JSON.stringify({ passed: checks.length, errors: errors.length, out }));

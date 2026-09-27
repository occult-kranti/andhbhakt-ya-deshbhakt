/**
 * Focused production QA for the September HISAAB session/brand revision.
 * Build and serve HISAAB, then:
 *   CHROME_PATH=/path/to/chromium node scripts/hisaab-session-check.mjs <outDir> <baseUrl>
 * ONLY_CHECK filters named checks. Writes a checkpoint after every check.
 * Two-page friend checks use BroadcastChannel: they prove local protocol/UI behaviour,
 * not Internet WebRTC/NAT availability or resistance to a modified client.
 */
import assert from 'node:assert/strict';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';

const out = resolve(process.argv[2] || '/tmp/hisaab-session-check');
const base = (process.argv[3] || 'http://127.0.0.1:4174/fact-duel/hisaab/').replace(/#.*$/, '');
const HS = storageNames(STORAGE_NS);
const report = { startedAt: new Date().toISOString(), base, checks: [], screens: [], errors: [] };
mkdirSync(out, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = () => writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));

async function check(name, run) {
  if (process.env.ONLY_CHECK && !new RegExp(process.env.ONLY_CHECK, 'i').test(name)) return;
  const started = Date.now();
  try {
    report.checks.push({ name, ok: true, ms: Date.now() - started, evidence: await run() });
    report.checks.at(-1).ms = Date.now() - started;
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, ok: false, ms: Date.now() - started, error: String(error.stack || error) });
    console.error(`FAIL ${name}: ${error.message || error}`);
  }
  save();
}

function listen(page) {
  page.on('pageerror', e => report.errors.push({ kind: 'exception', url: page.url(), text: e.message }));
  page.on('console', m => { if (m.type() === 'error') report.errors.push({ kind: 'console', url: page.url(), text: m.text() }); });
  page.on('response', r => { if (r.url().startsWith(new URL(base).origin) && r.status() >= 400) report.errors.push({ kind: 'http', url: r.url(), status: r.status() }); });
  page.on('request', r => { if (/googlesyndication|doubleclick|googleadservices/.test(r.url())) report.errors.push({ kind: 'ad', url: r.url() }); });
}

async function context(browser, { width = 390, height = 844, theme = 'dark', locale = 'en', name } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce' });
  await ctx.addInitScript(({ HS, theme, locale, name }) => {
    localStorage.setItem(HS.theme, theme);
    localStorage.setItem(HS.locale, locale);
    localStorage.setItem(HS.motion, 'reduced');
    localStorage.setItem(HS.art, 'off');
    localStorage.setItem(HS.sound, 'off');
    if (typeof name === 'string') localStorage.setItem(HS.name, name);
    // Observe incoming room projections, not application state or private host storage.
    window.__qaRooms = [];
    const Native = window.BroadcastChannel;
    window.BroadcastChannel = class extends Native {
      constructor(name) {
        super(name);
        if (String(name).startsWith(HS.p2pChannel)) this.addEventListener('message', e => {
          const room = e.data?.body?.result?.room;
          if (room) window.__qaRooms.push(structuredClone(room));
        });
      }
    };
  }, { HS, theme, locale, name });
  const page = await ctx.newPage();
  listen(page);
  return { ctx, page };
}

async function go(page, hash) {
  if (page.url() === 'about:blank') await page.goto(base + hash, { waitUntil: 'load' });
  else await page.evaluate(hash => { location.hash = hash; }, hash);
  await page.waitForSelector('.h-main [data-screen]');
  await page.waitForFunction(() => !document.querySelector('.h-main .h-skeleton'));
  await page.evaluate(() => document.fonts.ready);
  await pause(120);
}

async function shot(page, name) {
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true, animations: 'disabled' });
}

async function audit(page, name) {
  const result = await page.evaluate(() => {
    const visible = el => {
      const style = getComputedStyle(el), r = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && r.width > 1 && r.height > 1 && !el.closest('[inert], [hidden], [aria-hidden="true"], .h-sr');
    };
    const smallTargets = [...document.querySelectorAll('.h-main button, .h-main [role="button"], .h-main summary, .h-nav a, .h-main dialog a')]
      .filter(visible).filter(el => !el.disabled).filter(el => { const r = el.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; })
      .map(el => ({ label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 80), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }));
    const smallInputs = [...document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), select, textarea')]
      .filter(visible).filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(el => el.id || el.name);
    return { width: innerWidth, scrollWidth: document.scrollingElement.scrollWidth, smallTargets, smallInputs, theme: document.documentElement.dataset.theme, lang: document.documentElement.lang };
  });
  await shot(page, name);
  report.screens.push({ name, ...result });
  assert.ok(result.scrollWidth <= result.width + 1, `Overflow: ${JSON.stringify(result)}`);
  assert.deepEqual(result.smallTargets, [], 'Targets under 44 px');
  assert.deepEqual(result.smallInputs, [], 'Text inputs under 16 px');
  assert.equal(await page.locator('[data-screen="error"], [data-screen="not-found"]').count(), 0);
  return result;
}

async function headerGeometry(page) {
  const boxes = await page.locator('.h-roundhead__ids, .h-roundhead__score, .h-roundhead .h-matchsettings-trigger').evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect(); return { element: el.className, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: innerWidth };
  }));
  for (const a of boxes) assert.ok(a.x >= -1 && a.right <= a.width + 1, `Header outside viewport: ${JSON.stringify(a)}`);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const overlap = Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
    assert.equal(overlap, false, `Overlapping header regions: ${JSON.stringify([a, b])}`);
  }
  return boxes;
}

async function startBot(page, mode = 'quick') {
  await go(page, `#/duel?vs=bot&mode=${mode}`);
  await page.locator('.h-setup__launch .h-btn--primary').click();
  await page.waitForSelector('.h-live__card[data-shown] .h-opt:not([disabled])', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('.h-stopwatch__time')?.textContent !== '0.0 s');
}

async function profile(page) {
  return page.evaluate(dbName => new Promise((resolve, reject) => {
    const open = indexedDB.open(dbName);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('profile').objectStore('profile').get('player');
      request.onerror = () => { db.close(); reject(request.error); };
      request.onsuccess = () => { const value = request.result; db.close(); resolve(value); };
    };
  }), HS.playerDb);
}

async function assertPending(page) {
  assert.equal(await page.locator('.h-arena[data-view="live"] .h-opt:not([disabled])').count(), 4, 'unanswered peer lost its four options');
  assert.equal(await page.locator('.h-personal-receipt, .h-rreceipt, .h-receipt, .h-seatline, .h-opt[data-state="correct"], .h-opt[data-state="wrong-chosen"], .h-opt[data-state="correct-unchosen"]').count(), 0, 'answer/result markup reached unanswered peer');
  const liveText = await page.locator('.h-live').innerText();
  assert.doesNotMatch(liveText, /Read the noting|See the verdict|Round won|Your answer is (right|wrong)/i);
}

async function friendPair(browser, options = {}) {
  const owner = await context(browser, options);
  const host = owner.page;
  const guest = await owner.ctx.newPage();
  listen(guest);
  await go(host, '#/duel?vs=friend&mode=quick&via=tab');
  await host.locator('.h-setup__launch .h-btn--primary').click();
  await host.waitForSelector('.h-lobby__big');
  const code = (await host.locator('.h-lobby__big').textContent()).trim();
  await go(guest, `#/duel/friend?code=${encodeURIComponent(code)}&via=tab`);
  const joinButton = guest.locator('form .h-btn--primary');
  if (await joinButton.count()) await joinButton.click();
  await guest.waitForSelector('.h-lobby__big');
  for (const page of [host, guest]) {
    await page.waitForFunction(() => { const b = document.querySelector('.h-lobby__bar .h-btn--primary'); return b && !b.disabled; });
    await page.locator('.h-lobby__bar .h-btn--primary').click();
  }
  for (const page of [host, guest]) await page.waitForSelector('.h-live__card[data-shown] .h-opt:not([disabled])', { timeout: 15000 });
  return { ctx: owner.ctx, host, guest, code };
}

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const width of [320, 390, 1440]) for (const theme of ['light', 'dark']) for (const locale of ['en', 'hi']) {
    await check(`brand ${width} ${theme} ${locale}`, async () => {
      const { ctx, page } = await context(browser, { width, height: width === 1440 ? 900 : 844, theme, locale });
      try {
        for (const [hash, name] of [['#/', 'home'], ['#/files', 'files'], ['#/money/ledger', 'ledger'], ['#/circles', 'circles'], ['#/duel', 'duel'], ['#/settings', 'settings'], ['#/rules', 'rules']]) {
          await go(page, hash);
          if (hash === '#/' && await page.locator('[data-screen="start"]').count()) await go(page, '#/');
          await audit(page, `${width}-${theme}-${locale}-${name}`);
        }
        return '7 page audits; no overflow, undersized checked targets, tiny text inputs or crash screens';
      } finally { await ctx.close(); }
    });
  }

  await check('bot immediate receipt all three formats and first-tap burst', async () => {
    const evidence = [];
    for (const mode of ['quick', 'trilogy', 'gauntlet']) {
      const { ctx, page } = await context(browser);
      try {
        await startBot(page, mode);
        const started = Date.now();
        await page.locator('.h-live .h-opt').first().evaluate(button => {
          const buttons = [...document.querySelectorAll('.h-live .h-opt')];
          button.click();
          for (let i = 0; i < 99; i++) buttons[(i + 1) % 4].click();
        });
        await page.waitForSelector('.h-arena[data-view="receipt"]', { timeout: 1800 });
        const latencyMs = Date.now() - started;
        assert.ok(latencyMs < 1800, `Receipt waited ${latencyMs}ms`);
        await audit(page, `bot-${mode}-immediate-receipt`);
        const states = await page.locator('.h-rreceipt .h-opt').evaluateAll(buttons => buttons.map(b => b.dataset.state));
        assert.ok(['correct', 'wrong-chosen'].includes(states[0]), 'later same-tick click replaced the first answer');
        assert.equal(states.filter(s => ['correct', 'wrong-chosen'].includes(s)).length, 1, 'more than one submitted pick');
        evidence.push({ mode, latencyMs, optionStates: states });
      } finally { await ctx.close(); }
    }
    return evidence;
  });

  for (const firstSeat of ['host', 'guest']) {
    await check(`friend ${firstSeat} answers first: private receipt, no early XP or peer leak`, async () => {
      const pair = await friendPair(browser);
      const first = pair[firstSeat], second = pair[firstSeat === 'host' ? 'guest' : 'host'];
      try {
        const before = await profile(first);
        const started = Date.now();
        await first.locator('.h-live .h-opt').first().click();
        await first.waitForSelector('.h-personal-receipt', { timeout: 1800 });
        const latencyMs = Date.now() - started;
        await audit(first, `friend-${firstSeat}-private-receipt`);
        assert.equal(await first.getByRole('button', { name: /^(Next round|See the verdict)$/ }).count(), 0, 'private receipt enables progression before peer');
        await assertPending(second);
        await pause(700); // allow a poll/projection and any incorrect profile dispatch to land
        const announcement = await first.locator('.h-arena > p[aria-live="polite"]').innerText();
        assert.match(announcement, /Your answer: (correct|incorrect)\..*still answering\./, 'personal result announcement was cleared before reaching the standing live region');
        const pendingProfile = await profile(first);
        assert.equal(pendingProfile.progression.xp, before.progression.xp, 'XP filed before round settlement');
        assert.equal(pendingProfile.journal.rounds.length, before.journal.rounds.length, 'pending round filed prematurely');
        const received = await pair.guest.evaluate(() => window.__qaRooms.filter(room => room.round && !room.round.result));
        assert.ok(received.length > 0, 'no observed guest projections');
        for (const room of received) {
          const rd = room.round;
          assert.equal(rd.result, null);
          assert.ok(!rd.receipts || rd.receipts.every(r => r === null), 'shared receipt leaked');
          for (const key of ['correctIndex', 'explanation', 'sourceUrl', 'sourceLabel', 'factId']) assert.equal(rd.question?.[key], undefined, `shared question leaked ${key}`);
          if (firstSeat === 'host') assert.equal(rd.personalReceipt ?? null, null, 'host private receipt reached unanswered guest');
          else if (rd.personalReceipt) {
            assert.equal(rd.personalReceipt.choice, 0);
            assert.equal(typeof rd.personalReceipt.correct, 'boolean');
          }
        }
        await second.locator('.h-live__stem').focus();
        await second.keyboard.press('2');
        await Promise.all([first.waitForSelector('.h-arena[data-view="receipt"]', { timeout: 1800 }), second.waitForSelector('.h-arena[data-view="receipt"]', { timeout: 1800 })]);
        assert.equal(await first.locator('.h-personal-receipt').count(), 0);
        await audit(second, `friend-${firstSeat}-final-receipt`);
        return { firstSeat, latencyMs, guestProjectionsChecked: received.length, noPrematureXp: true, personalAnnouncement: announcement, secondAnsweredWithKeyboard: true, bothSettled: true };
      } finally { await pair.ctx.close(); }
    });
  }

  for (const locale of ['en', 'hi']) {
    await check(`game settings ${locale}: focus, keyboard shielding, timer, quit, reload recovery`, async () => {
      const { ctx, page } = await context(browser, { width: 320, locale });
      try {
        await startBot(page, 'trilogy');
        await audit(page, `320-dark-${locale}-bot-live`);
        await page.locator('.h-matchsettings-trigger').click();
        const modal = page.locator('dialog.h-matchsettings[open]');
        await modal.waitFor();
        assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog.h-matchsettings')), true);
        const focused = await page.evaluate(() => document.activeElement?.textContent.trim());
        assert.match(focused, /Back to game|खेल पर वापस/);
        const before = await page.locator('.h-stopwatch__time').innerText();
        await page.keyboard.press('1'); await page.keyboard.press('a');
        await pause(450);
        const after = await page.locator('.h-stopwatch__time').innerText();
        assert.notEqual(before, after, 'settings paused the answer stopwatch');
        assert.equal(await page.locator('.h-personal-receipt, .h-rreceipt').count(), 0, 'dialog key submitted answer behind modal');
        await audit(page, `320-dark-${locale}-game-settings`);
        const sound = modal.getByRole('switch');
        const soundBefore = await sound.getAttribute('aria-checked');
        await sound.click();
        assert.notEqual(await sound.getAttribute('aria-checked'), soundBefore, 'sound switch did not apply');
        await sound.click();
        assert.equal(await sound.getAttribute('aria-checked'), soundBefore);
        const theme = modal.locator('select');
        await theme.selectOption('light');
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        await theme.selectOption('dark');
        await modal.getByRole('button', { name: locale === 'hi' ? 'खेल छोड़ें' : 'Quit game', exact: true }).click();
        const safeFocus = await page.evaluate(() => document.activeElement?.textContent.trim());
        assert.match(safeFocus, /Keep playing|खेलते रहें/);
        await audit(page, `320-dark-${locale}-quit-confirm`);
        await page.keyboard.press('Escape');
        assert.equal(await modal.count(), 1, 'Escape in confirmation should return to settings');
        await page.keyboard.press('Escape');
        await modal.waitFor({ state: 'detached' });
        assert.equal(await page.locator('.h-matchsettings-trigger').evaluate(b => b === document.activeElement), true, 'Escape did not restore settings trigger focus');
        assert.equal(await page.locator('.h-live .h-opt:not([disabled])').count(), 4);
        await page.locator('.h-matchsettings-trigger').click();
        await modal.getByRole('button', { name: locale === 'hi' ? 'खेल छोड़ें' : 'Quit game', exact: true }).click();
        await modal.getByRole('button', { name: locale === 'hi' ? 'हाँ, खेल छोड़ें' : 'Yes, quit game', exact: true }).click();
        await page.waitForSelector('[data-screen="duel-setup"]');
        await pause(650);
        assert.equal(await page.locator('.h-arena, dialog[open]').count(), 0, 'quit resurrected a match or left modal open');
        await startBot(page);
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-screen="room-empty"]');
        assert.equal(await page.locator('.h-arena').count(), 0, 'reload silently resumed/recreated tab-local duel');
        return { dialogKeysShielded: true, clockContinues: true, safeFocus: true, escapeTwoStages: true, quitClean: true, reloadHonest: true };
      } finally { await ctx.close(); }
    });
  }

  for (const width of [320, 1440]) for (const locale of ['en', 'hi']) {
    await check(`round header ${width} ${locale}: long names friend and pass`, async () => {
      const name = locale === 'en' ? 'WWWWWWWWWWWWWWWWWWWWWWWW' : 'विश्वविद्यालय परिवार टीम';
      const pair = await friendPair(browser, { width, height: width === 1440 ? 900 : 844, locale, name });
      try {
        await audit(pair.host, `${width}-${locale}-long-name-friend-live`);
        await headerGeometry(pair.host);
        await go(pair.host, '#/duel/pass?mode=quick');
        await pair.host.locator('#h-pass-name-0').fill(name);
        await pair.host.locator('#h-pass-name-1').fill(name);
        await pair.host.locator('.h-pass__card .h-btn--primary').click();
        await pair.host.waitForSelector('.h-handover');
        await audit(pair.host, `${width}-${locale}-long-name-pass-handover`);
        await headerGeometry(pair.host);
        await pair.host.locator('.h-handover .h-btn--primary').click();
        await pair.host.waitForSelector('.h-pass__play .h-opt:not([disabled])');
        await audit(pair.host, `${width}-${locale}-long-name-pass-live`);
        await headerGeometry(pair.host);
        await pair.host.locator('.h-matchsettings-trigger').click();
        const modal = pair.host.locator('dialog.h-matchsettings[open]');
        await modal.waitFor();
        await audit(pair.host, `${width}-${locale}-pass-settings`);
        return { nameLength: name.length, friendHeader: true, passHandoverAndPlay: true, passSettings: true };
      } finally { await pair.ctx.close(); }
    });
  }

  for (const leavingSeat of ['host', 'guest']) {
    await check(`friend ${leavingSeat} quits: other player leaves private feedback cleanly`, async () => {
      const pair = await friendPair(browser);
      const leaving = pair[leavingSeat], remaining = pair[leavingSeat === 'host' ? 'guest' : 'host'];
      try {
        await remaining.locator('.h-live .h-opt').first().click();
        await remaining.waitForSelector('.h-personal-receipt');
        await leaving.locator('.h-matchsettings-trigger').click();
        const modal = leaving.locator('dialog.h-matchsettings[open]');
        await modal.getByRole('button', { name: 'Quit game', exact: true }).click();
        await modal.getByRole('button', { name: 'Yes, quit game', exact: true }).click();
        // A departing host cannot answer the guest's last state request; the documented
        // guest disconnect grace is 10 seconds. A departing guest settles at the host.
        await remaining.waitForSelector('.h-arena[data-view="result"]', { timeout: leavingSeat === 'host' ? 12000 : 5000 });
        assert.equal(await remaining.locator('.h-personal-receipt, .h-live').count(), 0, 'peer leave left a pending question');
        assert.match(await remaining.locator('.h-arena').innerText(), /cancel|stopped|left|connection|no result/i);
        await pause(900);
        assert.equal(await leaving.locator('.h-arena, dialog[open]').count(), 0, 'late response resurrected quit session');
        await audit(remaining, `friend-${leavingSeat}-quit-peer-result`);
        return { leavingSeat, peerResultVisible: true, departedSessionGone: true };
      } finally { await pair.ctx.close(); }
    });
  }

  await check('deadline settles under open quit confirmation without stealing focus', async () => {
    const { ctx, page } = await context(browser);
    try {
      await startBot(page, 'quick');
      await page.locator('.h-matchsettings-trigger').click();
      const modal = page.locator('dialog.h-matchsettings[open]');
      await modal.getByRole('button', { name: 'Quit game', exact: true }).click();
      await page.waitForSelector('.h-arena[data-view="receipt"]', { timeout: 35000 });
      await modal.getByRole('button', { name: 'Back to game', exact: true }).waitFor();
      assert.equal(await modal.getByRole('button', { name: 'Yes, quit game', exact: true }).count(), 0, 'stale unfinished-match confirmation survived settlement');
      assert.match(await modal.innerText(), /round.*finish|round.*complete|match.*finish|match.*complete/i);
      assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog.h-matchsettings')), true, 'settlement stole focus out of dialog');
      await audit(page, 'deadline-settled-open-settings');
      await page.keyboard.press('Escape');
      await modal.waitFor({ state: 'detached' });
      assert.equal(await page.locator('.h-matchsettings-trigger').evaluate(button => button === document.activeElement), true);
      return { realDeadlineObserved: true, dialogPreserved: true, confirmationRefreshed: true, focusRetained: true };
    } finally { await ctx.close(); }
  });

  await check('certificate exports current site host and a real PNG', async () => {
    const { ctx, page } = await context(browser);
    try {
      await go(page, '#/me/certificate');
      const expected = `${new URL(base).host}${new URL(base).pathname}`.replace(/\/$/, '');
      assert.equal((await page.locator('.h-cert__foot span').last().innerText()).trim(), expected);
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.getByRole('button', { name: /Save as image/ }).click(),
      ]);
      const path = join(out, 'certificate.png');
      await download.saveAs(path);
      assert.ok(statSync(path).size > 20000, 'certificate PNG is unexpectedly small');
      await audit(page, 'certificate-current-host');
      return { host: expected, filename: download.suggestedFilename(), bytes: statSync(path).size };
    } finally { await ctx.close(); }
  });

  for (const locale of ['en', 'hi']) {
    await check(`connection cancellation ${locale}: immediate exit survives late join timeout`, async () => {
      const { ctx, page } = await context(browser, { width: 320, locale });
      try {
        // A syntactically valid room with no host; deterministic transport, no external relay.
        await go(page, '#/duel/friend?code=ABCD-EFGH&via=tab');
        await page.locator('form .h-btn--primary').click();
        const cancel = page.getByRole('button', { name: locale === 'hi' ? 'कनेक्शन रद्द करें' : 'Cancel connection', exact: true });
        await cancel.waitFor();
        await audit(page, `320-${locale}-pending-join-cancel`);
        const before = Date.now();
        await cancel.click();
        await page.waitForSelector('[data-screen="duel-setup"]', { timeout: 1800 });
        const latencyMs = Date.now() - before;
        await pause(8500); // beyond the actual guest hello timeout (8 seconds)
        assert.equal(new URL(page.url()).hash.startsWith('#/duel?'), true);
        assert.equal(await page.locator('[data-screen="duel-setup"]').count(), 1);
        assert.equal(await page.locator('.h-lobby__big, .h-arena').count(), 0, 'late join completion reopened abandoned session');
        return { locale, latencyMs, waitedPastHelloTimeout: true, returnedSetupStable: true };
      } finally { await ctx.close(); }
    });
  }
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  report.summary = { passed: report.checks.filter(c => c.ok).length, failed: report.checks.filter(c => !c.ok).length, screens: report.screens.length, errors: report.errors.length };
  save();
}
console.log(JSON.stringify(report.summary));
if (report.summary.failed || report.summary.errors) process.exitCode = 1;

/**
 * Focused HISAAB release regression check. Run against the built edition:
 *   node scripts/hisaab-release-check.mjs <outDir> [http://localhost:4174/fact-duel/hisaab/]
 * CHROME_PATH optionally selects an installed Chromium. This is a browser/UI and bounded local
 * mutation check, not a load/capacity benchmark or proof of Internet peer connectivity.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { BANK } from '../editions/hisaab/bank/index.mjs';
import { answerXp, createStopwatch } from '../editions/hisaab/engine/scoring.mjs';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';
import { decodeInvite, encodeInvite, newCircle } from '../editions/hisaab/circles/model.mjs';
import { createCircleStore } from '../editions/hisaab/circles/store.mjs';

const out = resolve(process.argv[2] || '/tmp/hisaab-release-check');
const base = (process.argv[3] || 'http://localhost:4174/fact-duel/hisaab/').replace(/#.*$/, '');
const HS = storageNames(STORAGE_NS);
const report = { startedAt: new Date().toISOString(), base, checks: [], browserErrors: [] };
mkdirSync(out, { recursive: true });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function check(name, run) {
  if (process.env.ONLY_CHECK && !new RegExp(process.env.ONLY_CHECK, 'i').test(name)) return;
  const started = Date.now();
  try {
    const evidence = await run();
    report.checks.push({ name, ok: true, elapsedMs: Date.now() - started, evidence });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, ok: false, elapsedMs: Date.now() - started, error: String(error.stack || error) });
    console.error(`FAIL ${name}: ${error.message || error}`);
  }
}

async function context(browser, { width = 390, height = 844, theme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce' });
  await ctx.addInitScript(({ HS, theme }) => {
    localStorage.setItem(HS.theme, theme);
    localStorage.setItem(HS.motion, 'reduced');
    localStorage.setItem(HS.art, 'off');
  }, { HS, theme });
  const page = await ctx.newPage();
  page.on('pageerror', error => report.browserErrors.push({ url: page.url(), kind: 'pageerror', text: error.message }));
  page.on('console', msg => { if (msg.type() === 'error') report.browserErrors.push({ url: page.url(), kind: 'console', text: msg.text() }); });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(new URL(base).origin)) report.browserErrors.push({ url: response.url(), kind: 'http', status: response.status() });
  });
  page.on('request', request => {
    if (/googlesyndication|doubleclick|googleadservices/.test(request.url())) report.browserErrors.push({ url: request.url(), kind: 'unexpected-ad-request' });
  });
  return { ctx, page };
}

async function go(page, hash) {
  if (page.url() === 'about:blank') await page.goto(base + hash, { waitUntil: 'load' });
  else await page.evaluate(hash => { location.hash = hash; }, hash);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForSelector('.h-main [data-screen]', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('.h-main .h-skeleton'), null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await wait(150);
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

async function noConfidence(page) {
  const text = await page.locator('.h-main').innerText();
  assert.doesNotMatch(text, /\b(?:shayad|lagta hai|pakka)\b/i, 'retired confidence text remains');
  assert.equal(await page.locator('.h-conf, .h-confidence, [aria-label="Confidence"]').count(), 0);
}

async function noAds(page) {
  assert.equal(await page.locator('ins.adsbygoogle, iframe[src*="doubleclick"], iframe[src*="googlesyndication"], [data-ad-slot], [data-ad-placement], .h-ad').count(), 0, 'ad content exists during play');
}

async function audit(page, name) {
  const result = await page.evaluate(() => {
    const visible = el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && !el.closest('[inert], [hidden], [aria-hidden="true"]');
    };
    const smallInputs = [...document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), textarea, select')]
      .filter(visible).filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(el => el.id || el.name || el.tagName);
    const undersized = [...document.querySelectorAll('.h-main button, .h-main [role="button"], .h-nav a')]
      .filter(visible).filter(el => !el.disabled).filter(el => {
        const r = el.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5;
      }).map(el => ({ label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 60), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
    return { width: innerWidth, scrollWidth: document.scrollingElement.scrollWidth, smallInputs, undersized, theme: document.documentElement.dataset.theme };
  });
  await page.screenshot({ path: join(out, name + '.png'), fullPage: true, animations: 'disabled' });
  assert.ok(result.scrollWidth <= result.width + 1, JSON.stringify(result));
  assert.deepEqual(result.smallInputs, [], 'mobile inputs smaller than 16px');
  assert.deepEqual(result.undersized, [], 'interactive targets smaller than 44px');
  return result;
}

await check('XP thresholds + malformed elapsed values + 30,001 elapsed samples', () => {
  for (let ms = 0; ms <= 30000; ms += 1) {
    const expected = ms < 8000 ? 30 : ms < 15000 ? 20 : 10;
    assert.equal(answerXp(true, ms), expected);
    assert.equal(answerXp(false, ms), 0);
  }
  for (const ms of [NaN, Infinity, -Infinity, -1, undefined, null, '7']) {
    assert.equal(answerXp(true, ms), 10);
    assert.equal(answerXp(false, ms), 0);
  }
  let now = 0;
  const clock = createStopwatch(() => now);
  assert.equal(clock.lock(), null);
  clock.start(); now = 8000; assert.equal(clock.elapsed(), 8000);
  now = 7000; assert.equal(clock.elapsed(), 8000);
  now = 15000; assert.equal(clock.lock(), 15000);
  for (let n = 0; n < 10000; n++) { now += n; clock.start(); assert.equal(clock.lock(), 15000); }
  return 'Correct awards 30 / 20 / 10 XP; wrong 0; exactly 8s and 15s fall in next band; timer cannot rewind or relock.';
});

await check('circle API bounded mutation burst + malformed invites + limits', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const store = createCircleStore({ storage });
  try {
    const circle = newCircle({ name: 'QA परिवार', kind: 'family', nickname: 'दीदी' });
    const invite = encodeInvite(circle);
    assert.deepEqual(decodeInvite(invite), { id: circle.id, name: circle.name, kind: circle.kind });
    await Promise.all(Array.from({ length: 100 }, (_, i) => store.join(invite, `Member ${i}`)));
    assert.equal(store.getSnapshot().circles.length, 1, 'duplicate join creates duplicate circle');
    const before = JSON.stringify(store.getSnapshot());
    const malformed = ['', 'HD1.', '<script>alert(1)</script>', 'HD1.' + 'a'.repeat(32) + '.!!!!', 'X'.repeat(2049),
      ...Array.from({ length: 500 }, (_, i) => `HD${i + 2}.${String(i).padStart(32, '0')}.${'='.repeat(i % 19)}`)];
    for (const input of malformed) await assert.rejects(store.join(input, 'Guest'));
    assert.equal(JSON.stringify(store.getSnapshot()), before, 'malformed joins mutate stored records');
    const creates = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => store.create({ name: `Circle ${i}`, nickname: `Nick ${i}` })));
    assert.equal(creates.filter(x => x.status === 'fulfilled').length, 19);
    assert.equal(store.getSnapshot().circles.length, 20);
    const first = store.getSnapshot().circles[0], second = store.getSnapshot().circles[1];
    await store.update(first.id, { nickname: 'Only this circle' });
    assert.equal(store.getSnapshot().circles.find(x => x.id === second.id).nickname, second.nickname, 'nickname leaked between circles');
    await assert.rejects(store.update(first.id, { nickname: '<img onerror=alert(1)>' }));
    await assert.rejects(store.update(first.id, { nickname: 'x'.repeat(25) }));
    const reloaded = createCircleStore({ storage });
    assert.deepEqual(reloaded.getSnapshot().circles, store.getSnapshot().circles);
    reloaded.dispose();
    return { duplicateJoins: 100, malformedInvitesRejected: malformed.length, concurrentCreates: 30, circleLimit: 20, nicknameIsolation: true, storageReload: true };
  } finally { store.dispose(); }
});

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const width of [320, 390, 1440]) for (const theme of ['light', 'dark']) {
    await check(`responsive ${width} ${theme}`, async () => {
      const { ctx, page } = await context(browser, { width, height: width === 1440 ? 900 : 844, theme });
      try {
        const evidence = [];
        for (const [hash, label] of [['#/', 'front-page'], ['#/circles', 'circles'], ['#/duel', 'duel'], [`#/q/${BANK[0].id}`, 'question']]) {
          await go(page, hash);
          if (hash === '#/' && await page.locator('[data-screen="start"]').count()) await go(page, '#/');
          if (label === 'question') { await page.waitForSelector('.h-stopwatch__time'); await noConfidence(page); await noAds(page); }
          evidence.push(await audit(page, `${width}-${theme}-${label}`));
          if (label === 'circles') {
            await page.locator('[name="circle-name"]').fill(theme === 'light' ? 'परिवार की चाय' : 'A very long family newsroom circle name');
            await page.locator('[name="circle-kind"]').selectOption('family');
            await page.locator('[name="circle-nickname"]').fill('Receipt Rani');
            await page.getByRole('button', { name: 'Create my circle', exact: true }).click();
            await page.waitForSelector('[data-screen="circle-detail"]');
            evidence.push(await audit(page, `${width}-${theme}-circle-detail`));
          }
        }
        return evidence;
      } finally { await ctx.close(); }
    });
  }

  await check('circle create burst + separate browser invite + personal nickname + persistence', async () => {
    const host = await context(browser, { width: 320 }), guest = await context(browser);
    try {
      await go(host.page, '#/circles');
      await host.page.evaluate(key => localStorage.setItem(key, 'Global name unchanged'), HS.name);
      await host.page.locator('[name="circle-name"]').fill('परिवार की चाय');
      await host.page.locator('[name="circle-kind"]').selectOption('family');
      await host.page.locator('[name="circle-nickname"]').fill('Receipt Rani');
      await host.page.evaluate(() => {
        const form = document.querySelector('.h-circles__form');
        for (let n = 0; n < 100; n++) form.requestSubmit();
      });
      await host.page.waitForSelector('[data-screen="circle-detail"]');
      const hostCircles = await host.page.evaluate(key => JSON.parse(localStorage.getItem(key)), HS.circles);
      assert.equal(hostCircles.length, 1, 'create burst saved duplicate circles');
      assert.equal(hostCircles[0].kind, 'family');
      const invite = await host.page.locator('.h-circles__invite textarea').inputValue();
      assert.ok(invite.includes('#/circles?invite='));
      await audit(host.page, '320-light-circle-detail');

      await go(guest.page, '#/circles');
      await guest.page.getByRole('button', { name: 'Join circle', exact: true }).click();
      await guest.page.locator('[name="circle-invite"]').fill('HD1.invalid');
      await guest.page.locator('[name="circle-nickname"]').fill('Guest');
      await guest.page.getByRole('button', { name: 'Join this circle', exact: true }).click();
      await guest.page.locator('[role="alert"]').waitFor();
      await audit(guest.page, '390-light-invalid-circle-invite');
      assert.equal(await guest.page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]').length, HS.circles), 0);
      await guest.page.locator('[name="circle-invite"]').fill(invite);
      await guest.page.locator('[name="circle-nickname"]').fill('<img onerror=alert(1)>');
      await guest.page.getByRole('button', { name: 'Join this circle', exact: true }).click();
      await guest.page.getByText('Use a plain-text name', { exact: false }).waitFor();
      assert.equal(await guest.page.locator('.h-circles img').count(), 0);
      await guest.page.locator('[name="circle-nickname"]').fill('Family Fact Checker');
      await guest.page.getByRole('button', { name: 'Join this circle', exact: true }).click();
      await guest.page.waitForSelector('[data-screen="circle-detail"]');
      const guestCircles = await guest.page.evaluate(key => JSON.parse(localStorage.getItem(key)), HS.circles);
      assert.equal(guestCircles[0].id, hostCircles[0].id);
      assert.notEqual(guestCircles[0].memberId, hostCircles[0].memberId);
      assert.equal(guestCircles[0].nickname, 'Family Fact Checker');

      await host.page.getByLabel('Your nickname in this circle', { exact: false }).fill('नानी');
      await host.page.getByRole('button', { name: 'Save circle details', exact: true }).click();
      await host.page.getByText('Circle details saved on this device.', { exact: true }).waitFor();
      const detailHash = new URL(host.page.url()).hash;
      await host.page.reload({ waitUntil: 'load' });
      await host.page.waitForSelector('[data-screen="circle-detail"]');
      assert.equal(await host.page.locator('[name="circle-nickname"]').inputValue(), 'नानी');
      assert.equal(await host.page.evaluate(key => localStorage.getItem(key), HS.name), 'Global name unchanged');
      assert.equal(await guest.page.locator('[name="circle-nickname"]').inputValue(), 'Family Fact Checker');
      await go(host.page, '#/circles');
      await host.page.locator('[name="circle-name"]').fill('Friends newsroom');
      await host.page.locator('[name="circle-nickname"]').fill('Copy Editor');
      await host.page.getByRole('button', { name: 'Create my circle', exact: true }).click();
      await host.page.waitForSelector('[data-screen="circle-detail"]');
      await go(host.page, detailHash);
      assert.equal(await host.page.locator('[name="circle-nickname"]').inputValue(), 'नानी');
      await guest.page.getByRole('button', { name: 'Leave circle', exact: true }).click();
      await guest.page.getByRole('button', { name: 'Yes, leave circle', exact: true }).click();
      await guest.page.waitForSelector('[data-screen="circles"]');
      assert.equal(await guest.page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, HS.circles), 0);
      assert.equal(await host.page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, HS.circles), 2, 'guest leaving removed host membership');
      return { createBurst: 100, savedCirclesAfterBurst: 1, independentMemberIds: true, invalidInviteRejected: true, markupNicknameRejected: true, familyAndFriendsCreated: true, nicknamePersisted: true, globalNameUnchanged: true, guestLeaveLocalOnly: true };
    } finally {
      await host.page.screenshot({ path: join(out, 'circle-host-final.png'), fullPage: true }).catch(() => {});
      await guest.page.screenshot({ path: join(out, 'circle-guest-final.png'), fullPage: true }).catch(() => {});
      await host.ctx.close(); await guest.ctx.close();
    }
  });

  await check('taster keyboard + ticking stopwatch + burst answer + reload idempotency', async () => {
    const { ctx, page } = await context(browser);
    try {
      const card = BANK[0];
      await go(page, `#/q/${card.id}`);
      await page.waitForSelector('.h-stopwatch__time');
      await noConfidence(page); await noAds(page);
      const time0 = await page.locator('.h-stopwatch__time').innerText();
      await wait(350);
      const time1 = await page.locator('.h-stopwatch__time').innerText();
      assert.notEqual(time0, time1, 'stopwatch does not tick');
      const before = await profile(page);
      const options = page.locator('.h-qcard .h-opt');
      await options.nth(card.correctIndex).focus();
      assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('h-opt')), true);
      await page.evaluate(index => {
        const opts = [...document.querySelectorAll('.h-qcard .h-opt')];
        // Same event-loop burst forces guard checks before React can render a disabled state.
        for (let n = 0; n < 100; n++) opts[n === 0 ? index : n % 4].click();
      }, card.correctIndex);
      await page.waitForSelector('.h-cardres .h-receipt');
      await wait(250);
      const locked = await page.locator('.h-stopwatch__time').innerText();
      await wait(300);
      assert.equal(await page.locator('.h-stopwatch__time').innerText(), locked, 'stopwatch changes after answer lock');
      const after = await profile(page);
      assert.equal(after.journal.rounds.length, before.journal.rounds.length + 1, 'burst wrote more than one round');
      const latest = after.journal.rounds.find(r => !before.journal.rounds.some(b => b.id === r.id));
      assert.equal(latest.correct, true, 'later click replaced first answer');
      assert.ok(Number.isFinite(latest.elapsedMs) && latest.elapsedMs >= 0, 'journal lost answer time');
      const reward = after.progression.xp;
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('.h-cardres .h-receipt');
      const reloaded = await profile(page);
      assert.equal(reloaded.progression.xp, reward, 'reloading awards XP again');
      assert.equal(reloaded.journal.rounds.length, after.journal.rounds.length, 'reloading duplicates journal');
      const nextCard = BANK[1];
      await go(page, `#/q/${nextCard.id}`);
      await page.waitForSelector('.h-qcard .h-opt:not([disabled])');
      await page.locator('.h-qcard .h-opt').nth(nextCard.correctIndex).focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.h-cardres .h-receipt');
      return { burstEvents: 100, storedAnswerTimeMs: latest.elapsedMs, lockedDisplay: locked, roundDelta: 1, reloadXpStable: true, keyboardEnter: true };
    } finally { await ctx.close(); }
  });

  await check('daily + route + pass-and-play + live duel stay free of ads', async () => {
    const { ctx, page } = await context(browser);
    try {
      for (const hash of ['#/aaj', '#/route/state-up']) {
        await go(page, hash);
        await page.waitForSelector('.h-qcard .h-opt:not([disabled])');
        await page.waitForSelector('.h-stopwatch__time');
        await noAds(page); await noConfidence(page);
      }
      await go(page, '#/duel/pass?mode=quick');
      await page.locator('.h-main .h-btn--primary').click();
      await page.waitForSelector('.h-handover');
      await noAds(page);
      await page.locator('.h-handover .h-btn--primary').click();
      await page.waitForSelector('.h-pass__play .h-opt:not([disabled])');
      await noAds(page); await noConfidence(page);
      await go(page, '#/duel?vs=bot&mode=quick');
      await page.locator('.h-launch .h-btn--primary, .h-main .h-btn--primary').last().click();
      await page.waitForSelector('.h-arena[data-view="live"] .h-opt:not([disabled])', { timeout: 20000 });
      await noAds(page); await noConfidence(page);
      await page.waitForSelector('.h-stopwatch__time');
      await audit(page, '390-light-live-duel');
      const noise = await page.locator('.h-nav:visible, .h-toast:visible, .h-ceremony:visible, .h-scenehost canvas, .h-t3 canvas').evaluateAll(elements => elements.map(el => ({ node: el.tagName, class: el.className, text: el.textContent.slice(0, 80) })));
      assert.deepEqual(noise, [], 'live duel is not quiet: ' + JSON.stringify(noise));
      // The shared provider retains an empty 2D host. Absence of particles, not absence of that
      // transparent host element, is the live-screen requirement; 3D scene hosts must unmount.
      const painted = await page.locator('canvas.fx-canvas').evaluateAll(canvases => canvases.some(canvas => {
        const ctx = canvas.getContext('2d');
        if (!ctx || !canvas.width || !canvas.height) return false;
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 0) return true;
        return false;
      }));
      assert.equal(painted, false, 'particle canvas paints while live');
      return 'No ad slots on daily, route, pass handover, pass question, or live bot duel; no nav, overlays, 3D scene, or painted particles in live duel.';
    } finally { await ctx.close(); }
  });
} finally { await browser.close(); }

report.finishedAt = new Date().toISOString();
report.summary = { checks: report.checks.length, passed: report.checks.filter(x => x.ok).length, failed: report.checks.filter(x => !x.ok).length, browserErrors: report.browserErrors.length };
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary));
process.exitCode = report.summary.failed || report.summary.browserErrors ? 1 : 0;

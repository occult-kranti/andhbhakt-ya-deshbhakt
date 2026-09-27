/**
 * scripts/hisaab-screens.mjs — the HISAAB DO screen walker (the edition's phone gate).
 *
 * Usage:  node scripts/hisaab-screens.mjs <outDir> [baseUrl]
 *   outDir   where the PNGs and report.json land (required)
 *   baseUrl  the running edition (default http://localhost:4174/fact-duel/hisaab/ — `pnpm preview:hisaab
 *            --port 4174` over a `pnpm build:hisaab` output; a dev server works too)
 * Env:     ONLY=390x844        one viewport (any WxH)          THEMES=light   one theme
 *          SKIP_FLOWS=1        the matrix only                  SKIP_HI=1      no Hindi pass
 *          CHROME_PATH=…       another Chromium (default /opt/pw-browsers/chromium-1194/…)
 *
 * It drives the built app with playwright-core against the pre-installed Chromium (the same executable
 * scripts/screens.mjs and scripts/mobile-gate.mjs use), with software WebGL, so the Rapier set pieces
 * are exercised too.
 *
 * THE MATRIX — every viewport (360×740, 390×844, 414×896, 1440×900) × light and dark, plus the Hindi
 * locale at 390×844 in both themes. Each cell is a FRESH profile (a new browser context), walked the way
 * a new player walks it, so every screen is seen with real data behind it:
 *   first run (#/start) → its primary (Open today's file) → today's card, quiet → the first receipt
 *   and the inline label card → the rest of Aaj Ka Hisaab → its finish → the one-card taster → a state
 *   file (#/route/state-up): card, receipt, all six, the finish and its first-clear ceremony → every
 *   static screen (Home, the four Files views, the money trail hub, its four modes and the money
 *   ledger, the Vault and a receipt's detail, Me, the certificate, Settings, Rules, the duel setup, the
 *   P2P join form, Pass & Play, an empty #/room, a missing route) → a LIVE Triple Threat question vs
 *   Babu-Bot (audited while the clock runs: quiet — no toast, ceremony, nav or 3D canvas) → its round
 *   receipt → the result.
 *
 * WHAT IT ASSERTS on every screen (thresholds as in scripts/mobile-gate.mjs, with this edition's names):
 *  1. No horizontal overflow: `scrollingElement.scrollWidth <= innerWidth + 1`.
 *  2. Tap targets ≥ 44×44 for every visible button / a[href] / [role=button] / summary / label that
 *     wraps a radio or checkbox. Honoured WCAG 2.5.8 exception, detected in code: "Inline" — a link in
 *     a sentence, sized by the line-height around it (inline display, a text parent, 8+ other
 *     characters). Anything else needs a NAMED exception in EXCEPTIONS with its reason.
 *  3. Body text ≥ 14px: an element with ≥ 25 characters of its own text that is not a control's name
 *     and not an all-caps label (kickers and stamps are 12px caps by design, bible §4.3).
 *  4. Inputs ≥ 16px (iOS zooms under it).
 *  5. Zero page errors, console errors, failed requests or crashed screens (the "File missing. Babu is
 *     on leave." boundary) — each attributed to the step that raised it.
 *  5b. At most ONE visible violet primary (`.h-btn--primary`) per screen (bible §5: it is that screen's
 *     primary action). Controls behind an open ceremony are inert and not counted.
 *  6. The live question is quiet (bible §11.10): no toast, no ceremony, no nav, no set-piece canvas.
 *  7. (static, before the browser starts) No CSS block name is owned by two lanes: every screen's CSS
 *     is global once loaded, so `.h-mini` in Home and `.h-mini` in the route finish restyle each other
 *     as soon as a player has visited both. A block is "owned" where a rule's subject starts with it
 *     unscoped (`.h-mini {`, `.h-mini__link {`); `.h-rajya__grid .h-tile` or `.h-btn.h-set__danger` are
 *     scoped overrides and fine. The foundation (ui/, shell/, base.css) counts as one owner.
 *
 * THE FLOWS (390×844, light; SKIP_FLOWS=1 skips them) — end to end, each reported ok/failed:
 *   bot duels in all three formats → result → Rematch (a tap) reaching a new live question; Pass & Play
 *   through the hand-over to its result and Play again; a P2P duel host + guest in two pages over
 *   BroadcastChannel (`via=tab`) to the result in both; Home's every internal link opens a screen;
 *   Settings changes theme, language and Quiet everything and they apply; the certificate saves a PNG;
 *   the Rules page's report link carries a prefilled issue.
 *
 * OUTPUT: <outDir>/<cell>/<nn-step>.png, <outDir>/flows/*.png and <outDir>/report.json with a
 * `summary` block (screens, shots, failures per rule, console errors, failed requests, flows ok/failed).
 * Exit code 1 when anything failed. The gate measures; it does not judge — read the PNGs.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';

const out = process.argv[2] ? resolve(process.argv[2]) : null;
const base = (process.argv[3] || 'http://localhost:4174/fact-duel/hisaab/').replace(/#.*$/, '');
const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/** The edition's storage names (never a literal key — ENGINE §13). */
const HS = storageNames(STORAGE_NS);

export const THRESHOLDS = Object.freeze({ overflowSlack: 1, target: 44, bodyText: 14, input: 16, bodyTextChars: 25 });

/**
 * NAMED tap-target exceptions (a selector tested with `closest`) — each with the reason it is not a bug.
 * Keep this short: anything else below 44px is a bug to fix.
 */
export const EXCEPTIONS = Object.freeze([
  {
    match: '.h-sr',
    reason: 'Visually hidden text (skip links and screen-reader-only controls) has no visual target to size.',
  },
]);

/**
 * NAMED body-text exceptions: text the design sets below 14px on purpose, which is a label, not a
 * sentence (bible §4.3: 12px is for "kickers, tab labels, chips only").
 */
export const TEXT_EXCEPTIONS = Object.freeze([
  {
    match: '.h-kicker',
    reason: 'Kickers (the mono F.No. line and the sector · state · year line above a card) are 12px labels by the type scale (bible §4.3).',
  },
  {
    match: '.h-cert',
    reason: 'The certificate is a picture of the 1080×1350 PNG, scaled to fit (its type is sized in container units for the export); the words a player reads about it are outside it.',
  },
]);

const VIEWPORTS = [
  { w: 360, h: 740 },
  { w: 390, h: 844 },
  { w: 414, h: 896 },
  { w: 1440, h: 900 },
].filter((v) => !process.env.ONLY || process.env.ONLY === `${v.w}x${v.h}`);
if (process.env.ONLY && !VIEWPORTS.length) {
  const [w, h] = process.env.ONLY.split('x').map(Number);
  VIEWPORTS.push({ w, h });
}
const THEMES = (process.env.THEMES || 'light,dark').split(',').filter(Boolean);

/** Every static screen (hash, step name). The play surfaces are driven, not listed. */
const STATIC_SCREENS = [
  ['#/', 'home'],
  ['#/files', 'files-hub'],
  ['#/files/states', 'files-states'],
  ['#/files/sectors', 'files-sectors'],
  ['#/files/media', 'files-media'],
  ['#/files/forwards', 'files-forwards'],
  ['#/money', 'money-hub'],
  ['#/money/distribution', 'money-distribution'],
  ['#/money/relief', 'money-relief'],
  ['#/money/pre-election', 'money-pre-election'],
  ['#/money/years', 'money-years'],
  ['#/money/ledger', 'money-ledger'],
  ['#/receipts', 'receipts'],
  ['#/me', 'me'],
  ['#/me/certificate', 'me-certificate'],
  ['#/settings', 'settings'],
  ['#/rules', 'rules'],
  ['#/duel', 'duel-setup'],
  ['#/duel?vs=friend&via=tab', 'duel-setup-friend'],
  ['#/duel/friend', 'duel-friend-join'],
  ['#/duel/pass', 'pass-setup'],
  ['#/room', 'room-empty'],
  ['#/no-such-file', 'not-found'],
];

// ---- rule 7: CSS block ownership (static) ------------------------------------------------------------

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../editions/hisaab/app');

/** A selector list split at its top-level commas (not the ones inside `:is(…)` or `:not(…)`). */
function splitTopLevel(list) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

/** Block names (`h-mini` of `.h-mini__link`) whose unscoped rules live in more than one owner's CSS. */
export function cssClashes(root = APP) {
  const owners = new Map();
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.css')) {
        const rel = relative(root, p).split(/[\\/]/);
        const owner = rel[0] === 'screens' ? `screens/${rel[1]}` : ['ui', 'shell', 'base.css', 'fonts.css'].includes(rel[0]) ? 'foundation' : rel[0];
        const css = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const m of css.matchAll(/([^{}@;]+)\{/g)) {
          for (const part of splitTopLevel(m[1])) {
            const sel = part.trim().split('::')[0];
            const head = /^\.(h-[A-Za-z0-9_-]+)((?:\[[^\]]*\]|:[\w-]+(?:\([^)]*\))?)*)$/.exec(sel);
            if (!head) continue; // a descendant/child selector or a compound of two classes: scoped
            const block = head[1].split(/__|--/)[0];
            if (!owners.has(block)) owners.set(block, new Set());
            owners.get(block).add(owner);
          }
        }
      }
    }
  };
  walk(root);
  return [...owners].filter(([, o]) => o.size > 1).map(([block, o]) => ({ rule: 'css-clash', detail: `.${block} is owned by ${[...o].sort().join(' and ')}` }));
}

// ---- the in-page audit ---------------------------------------------------------------------------

/** Runs in the page. Returns every violation of rules 1–4 (and the counts it checked). */
function auditInPage({ target, bodyText, bodyTextChars, input, overflowSlack, exceptions, textExceptions }) {
  const fails = [];
  const path = (el) => {
    const bits = [];
    for (let n = el; n && n.nodeType === 1 && bits.length < 4; n = n.parentElement) {
      const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).slice(0, 2) : [];
      bits.unshift(n.tagName.toLowerCase() + (cls.length && cls[0] ? '.' + cls.join('.') : ''));
    }
    return bits.join(' > ');
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const shown = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    if (el.closest('[aria-hidden="true"], [inert], [hidden]')) return null;
    return { cs, r };
  };

  /* 1. horizontal overflow */
  const docWidth = document.scrollingElement.scrollWidth;
  if (docWidth > window.innerWidth + overflowSlack) {
    const wide = [...document.querySelectorAll('body *')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.right > window.innerWidth + overflowSlack)
      .sort((a, b) => b.r.right - a.r.right)
      .slice(0, 5)
      .map(({ el, r }) => `${path(el)} right=${Math.round(r.right)}`);
    fails.push({ rule: 'overflow', detail: `scrollWidth ${docWidth} > innerWidth ${window.innerWidth}`, widest: wide });
  }

  /* 2. tap targets (a label wrapping a radio/checkbox is the target of that input) */
  const controls = [
    ...document.querySelectorAll('button, a[href], [role="button"], summary, input[type="button"], input[type="submit"]'),
    ...[...document.querySelectorAll('input[type="radio"], input[type="checkbox"]')].map((i) => i.closest('label') || i),
  ];
  let targetCount = 0;
  for (const el of new Set(controls)) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
    const vis = shown(el);
    if (!vis) continue;
    targetCount += 1;
    const { cs, r } = vis;
    if (r.width + 0.5 >= target && r.height + 0.5 >= target) continue;
    const inline = cs.display.startsWith('inline');
    const parent = el.parentElement;
    const parentDisplay = parent ? getComputedStyle(parent).display : '';
    const flowed = !parentDisplay.includes('flex') && !parentDisplay.includes('grid');
    const parentText = (parent?.textContent || '').trim().length;
    const ownText = (el.textContent || '').trim().length;
    if (inline && flowed && parentText > ownText + 8) continue; // WCAG 2.5.8 "Inline"
    if (exceptions.some((ex) => el.closest(ex.match))) continue;
    fails.push({ rule: 'target', detail: `${Math.round(r.width)}x${Math.round(r.height)} < ${target}x${target}`, path: path(el), label: label(el) });
  }

  /* 3. body text */
  let textCount = 0;
  for (const el of document.body.querySelectorAll('*')) {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (own.length < bodyTextChars) continue;
    if (el.closest('button, a[href], [role="button"], label, summary, svg, .h-sr')) continue;
    if (textExceptions.some((ex) => el.closest(ex.match))) continue;
    const vis = shown(el);
    if (!vis) continue;
    const caps = vis.cs.textTransform === 'uppercase' || (own === own.toUpperCase() && /[A-Z]/.test(own));
    if (caps) continue;
    textCount += 1;
    const size = parseFloat(vis.cs.fontSize);
    if (size + 0.01 < bodyText) fails.push({ rule: 'body-text', detail: `${size}px < ${bodyText}px`, path: path(el), label: own.slice(0, 60) });
  }

  /* 4. inputs */
  let inputCount = 0;
  for (const el of document.querySelectorAll(
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select',
  )) {
    const vis = shown(el);
    if (!vis) continue;
    inputCount += 1;
    const size = parseFloat(vis.cs.fontSize);
    if (size + 0.01 < input) fails.push({ rule: 'input-text', detail: `${size}px < ${input}px`, path: path(el), label: el.id || label(el) });
  }

  /* 6. exactly one violet primary per screen (bible §5 h-btn): more than one visible is a design bug */
  const primaries = [...document.querySelectorAll('.h-btn--primary')].filter((el) => shown(el));
  if (primaries.length > 1)
    fails.push({ rule: 'one-primary', detail: `${primaries.length} violet primaries on screen`, label: primaries.map((el) => label(el)).join(' | ') });

  /* 5. a crashed screen */
  if (document.querySelector('[data-screen="error"]')) fails.push({ rule: 'crash', detail: 'the screen error boundary is showing' });

  return { fails, counts: { targets: targetCount, bodyText: textCount, inputs: inputCount } };
}

/** Runs in the page while a LIVE question is on screen: what must not be there (bible §11.10). */
function quietInPage() {
  const fails = [];
  if (document.querySelector('.h-toast')) fails.push('a toast is on screen');
  if (document.querySelector('.h-ceremony')) fails.push('a ceremony is open');
  if (document.querySelector('.h-nav')) fails.push('the nav is showing');
  if (document.querySelector('.h-scenehost canvas, .h-t3 canvas')) fails.push('a set-piece canvas is mounted');
  if (document.querySelector('.h-live .h-stamp, .h-live .h-tape')) fails.push('a stamp or tape on the live card');
  return fails;
}

// ---- helpers -------------------------------------------------------------------------------------

const report = {
  tool: 'scripts/hisaab-screens.mjs',
  base,
  startedAt: new Date().toISOString(),
  thresholds: THRESHOLDS,
  exceptions: EXCEPTIONS,
  textExceptions: TEXT_EXCEPTIONS,
  cells: [],
  flows: [],
  summary: null,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** `page.evaluate` and friends have no timeout of their own; one stuck step must not hang the run. */
function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms: ${what}`)), ms);
    }),
  ]);
}

/** Wire a page's error channels into `sink` (an array the current step drains). */
function listen(page, sink) {
  page.on('pageerror', (e) => sink.push({ kind: 'pageerror', text: String(e.message || e).slice(0, 400) }));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error') sink.push({ kind: 'console', text: text.slice(0, 400) });
    else if (m.type() === 'warning' && /\[hisaab\] screen failed/.test(text)) sink.push({ kind: 'crash', text: text.slice(0, 400) });
  });
  page.on('requestfailed', (r) => {
    const url = r.url();
    // An aborted image/media fetch on navigation is the browser tidying up, not a failure.
    const why = r.failure()?.errorText ?? '';
    if (/ERR_ABORTED/.test(why) && !/\.(js|css|woff2?)(\?|$)/.test(url)) return;
    sink.push({ kind: 'requestfailed', text: `${url} ${why}` });
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(new URL(base).origin)) sink.push({ kind: 'http', text: `${r.status()} ${r.url()}` });
  });
}

async function settle(page, ms = 500) {
  await withTimeout(
    page.evaluate(async () => {
      await document.fonts?.ready;
      const t0 = performance.now();
      // Lazy screens show the ruled skeleton while their chunk loads.
      while (document.querySelector('.h-main .h-skeleton') && performance.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 80));
    }),
    9000,
    'settle',
  ).catch(() => {});
  await sleep(ms);
}

async function go(page, hash, ms = 450) {
  await page.evaluate((h) => {
    if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = h;
  }, hash);
  await settle(page, ms);
}

async function closeOverlays(page) {
  for (let i = 0; i < 3; i += 1) {
    const btn = page.locator('.h-ceremony__card button').last();
    if (!(await btn.count())) break;
    await btn.click({ timeout: 2000 }).catch(() => {});
    await sleep(350);
  }
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.h-toast button')) b.click();
  });
}

/** Answer the untimed card on screen (`nth` option) and wait for its receipt. */
async function answerCard(page, nth = 0) {
  await page.waitForSelector('.h-qcard .h-opt:not([disabled])', { timeout: 10000 });
  await page.locator('.h-qcard .h-opt').nth(nth).click();
  await page.waitForSelector('.h-play__side .h-cardres, .h-play__side .h-receipt', { timeout: 10000 });
}

/** The primary in the sticky play bar (Next card / Close the file). */
async function nextCard(page) {
  const btn = page.locator('.h-playbar .h-btn--primary');
  await btn.waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForFunction(() => {
    const b = document.querySelector('.h-playbar .h-btn--primary');
    return b && !b.disabled && b.getAttribute('aria-busy') !== 'true';
  }, null, { timeout: 8000 });
  await btn.click();
}

/** The arena's phase: waiting | countdown | live | receipt | result (or null). */
const arenaView = (page) => page.evaluate(() => document.querySelector('.h-arena')?.getAttribute('data-view') ?? null);

/** Wait until the live question accepts taps. */
async function waitLive(page, timeout = 20000) {
  await page.waitForSelector('.h-arena[data-view="live"] .h-opt:not([disabled])', { timeout });
}

/**
 * Play a bot/P2P match in the arena to its result: answer every live question with option `pick`,
 * tap "Next round" / "See the verdict" on each receipt. `onLive` / `onReceipt` run once, first time.
 */
async function playMatch(page, { onLive, onReceipt, pick = 0, timeout = 210000 } = {}) {
  const t0 = Date.now();
  let liveSeen = 0;
  let receiptSeen = 0;
  while (Date.now() - t0 < timeout) {
    const view = await arenaView(page);
    if (view === 'result') return { liveSeen, receiptSeen };
    if (view === 'live') {
      const opt = page.locator('.h-arena[data-view="live"] .h-opt:not([disabled])').first();
      if (await opt.count()) {
        if (!liveSeen && onLive) await onLive();
        liveSeen += 1;
        await page.locator('.h-arena[data-view="live"] .h-opt').nth(pick).click({ timeout: 3000 }).catch(() => {});
      }
    } else if (view === 'receipt') {
      if (!receiptSeen && onReceipt) await onReceipt();
      receiptSeen += 1;
      const next = page.locator('.h-arena[data-view="receipt"] .h-btn--primary');
      if (await next.count()) {
        const disabled = await next.first().isDisabled().catch(() => true);
        if (!disabled) await next.first().click({ timeout: 3000 }).catch(() => {});
      }
      await sleep(600);
    }
    await sleep(200);
  }
  throw new Error(`the match did not reach its result in ${timeout / 1000} s (last view: ${await arenaView(page)})`);
}

// ---- one cell of the matrix ---------------------------------------------------------------------

async function runCell(browser, vp, theme, locale) {
  const cellName = `${vp.w}x${vp.h}-${theme}${locale === 'hi' ? '-hi' : ''}`;
  const dir = join(out, cellName);
  mkdirSync(dir, { recursive: true });
  const mobile = vp.w < 900;
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: theme,
  });
  if (locale === 'hi') await ctx.addInitScript(([k]) => localStorage.setItem(k, 'hi'), [HS.locale]);
  const page = await ctx.newPage();
  const sink = [];
  listen(page, sink);
  const cell = { cell: cellName, viewport: vp, theme, locale, steps: [] };
  report.cells.push(cell);
  let n = 0;

  /** Audit + screenshot the current screen as one step. */
  const step = async (name, { full = true, extra } = {}) => {
    n += 1;
    const file = `${String(n).padStart(2, '0')}-${name}.png`;
    const entry = { step: name, file: `${cellName}/${file}`, hash: await page.evaluate(() => location.hash), fails: [], counts: null, errors: [] };
    try {
      const audit = await withTimeout(page.evaluate(auditInPage, { ...THRESHOLDS, exceptions: EXCEPTIONS, textExceptions: TEXT_EXCEPTIONS }), 15000, `audit ${name}`);
      entry.fails.push(...audit.fails);
      entry.counts = audit.counts;
      if (extra) for (const e of await extra()) entry.fails.push({ rule: 'quiet', detail: e });
      await page.screenshot({ path: join(dir, file), fullPage: full, timeout: 20000 });
    } catch (e) {
      entry.fails.push({ rule: 'step', detail: String(e.message || e).slice(0, 300) });
    }
    entry.errors.push(...sink.splice(0));
    cell.steps.push(entry);
    return entry;
  };
  /** A driven step that failed before it could be audited. */
  const broke = async (name, e) => {
    n += 1;
    const file = `${String(n).padStart(2, '0')}-${name}-FAILED.png`;
    await page.screenshot({ path: join(dir, file), fullPage: false }).catch(() => {});
    cell.steps.push({ step: name, file: `${cellName}/${file}`, hash: await page.evaluate(() => location.hash).catch(() => ''), fails: [{ rule: 'flow', detail: String(e.message || e).slice(0, 300) }], counts: null, errors: sink.splice(0) });
  };

  try {
    await page.goto(`${base}#/`, { waitUntil: 'load' });
    await settle(page, 800);

    // First run: a fresh profile is sent to the poster.
    try {
      await page.waitForFunction(() => location.hash === '#/start', null, { timeout: 8000 });
      await settle(page, 400);
      await step('start');
      await page.locator('.h-main .h-btn--primary').first().click();
      await page.waitForFunction(() => location.hash === '#/aaj', null, { timeout: 8000 });
    } catch (e) {
      await broke('start', e);
      await go(page, '#/aaj');
    }

    // Aaj Ka Hisaab: the quiet card, the first receipt + the inline label card, the rest, the finish.
    try {
      await page.waitForSelector('.h-qcard .h-opt:not([disabled])', { timeout: 10000 });
      await settle(page, 300);
      await step('aaj-card', { full: false });
      await answerCard(page, 1);
      await sleep(1400);
      const label = await page.locator('.h-play__side .h-labelcard').count();
      const e = await step('aaj-first-receipt');
      if (!label) e.fails.push({ rule: 'flow', detail: 'no inline label card after the first receipt ever (bible §11.1)' });
      for (let i = 1; i < 5; i += 1) {
        await nextCard(page);
        await answerCard(page, i % 4);
        await sleep(250);
      }
      await nextCard(page);
      await page.waitForSelector('[data-screen="aaj-done"]', { timeout: 10000 });
      await settle(page, 1200);
      await closeOverlays(page);
      await step('aaj-finish');
    } catch (e) {
      await broke('aaj', e);
    }

    // The one-card taster (a forwarded receipt card's landing).
    try {
      await go(page, '#/q/hgh001');
      await page.waitForSelector('.h-qcard', { timeout: 10000 });
      await step('taster', { full: false });
      if (await page.locator('.h-qcard .h-opt:not([disabled])').count()) await answerCard(page, 2);
      await sleep(1200);
      await step('taster-receipt');
    } catch (e) {
      await broke('taster', e);
    }

    // A state file: card 1 (tape), its receipt, all six, the finish (first clear → the file ceremony).
    try {
      await go(page, '#/route/state-up');
      await page.waitForSelector('.h-qcard .h-opt:not([disabled])', { timeout: 12000 });
      await step('route-card', { full: false });
      if (await page.locator('.h-conf__opt').count()) throw new Error('Retired confidence controls are visible');
      await page.locator('.h-stopwatch__time').waitFor({ state: 'visible' });
      await answerCard(page, 0);
      await sleep(1300);
      await step('route-receipt');
      for (let i = 1; i < 6; i += 1) {
        await nextCard(page);
        await answerCard(page, i % 4);
        await sleep(250);
      }
      await nextCard(page);
      await page.waitForSelector('.h-finish', { timeout: 10000 });
      await settle(page, 1500);
      if (await page.locator('.h-ceremony').count()) await step('route-ceremony', { full: false });
      else cell.steps.push({ step: 'route-ceremony', fails: [{ rule: 'flow', detail: 'no file ceremony on the first clear of a state file' }], errors: [] });
      await closeOverlays(page);
      await sleep(400);
      await step('route-finish');
    } catch (e) {
      await broke('route', e);
    }

    // Every static screen, with this profile's data behind it.
    for (const [hash, name] of STATIC_SCREENS) {
      try {
        await go(page, hash, 700);
        await closeOverlays(page);
        await step(name);
        if (name === 'receipts') {
          const mini = page.locator('.h-vrow').first();
          if (await mini.count()) {
            await mini.click();
            await settle(page, 700);
            await step('receipts-detail', { full: false });
            await page.keyboard.press('Escape').catch(() => {});
            await go(page, '#/receipts', 300);
          }
        }
      } catch (e) {
        await broke(name, e);
      }
    }

    // A LIVE question vs Babu-Bot (Triple Threat): audited while the clock runs, then its receipt and result.
    try {
      await go(page, '#/duel?mode=trilogy', 600);
      await page.locator('.h-main .h-btn--primary').first().click();
      await page.waitForFunction(() => location.hash.startsWith('#/room'), null, { timeout: 8000 });
      await waitLive(page);
      await playMatch(page, {
        onLive: () => step('duel-live', { full: false, extra: () => page.evaluate(quietInPage) }),
        onReceipt: async () => {
          await sleep(1000);
          await step('duel-receipt');
        },
      });
      await settle(page, 1800);
      await closeOverlays(page);
      await step('duel-result');
    } catch (e) {
      await broke('duel', e);
    }
  } catch (e) {
    await broke('cell', e);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ---- the end-to-end flows (390, light) ------------------------------------------------------------

async function runFlows(browser) {
  const dir = join(out, 'flows');
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'light', acceptDownloads: true });
  const page = await ctx.newPage();
  const sink = [];
  listen(page, sink);

  const flow = async (name, fn) => {
    const entry = { flow: name, ok: false, detail: '', errors: [] };
    const t0 = Date.now();
    try {
      entry.detail = (await withTimeout(fn(), 180000, name)) || 'ok';
      entry.ok = true;
    } catch (e) {
      entry.detail = String(e.message || e).slice(0, 400);
      await page.screenshot({ path: join(dir, `${name}-FAILED.png` ) }).catch(() => {});
    }
    entry.errors = sink.splice(0);
    if (entry.errors.length) entry.ok = false;
    entry.ms = Date.now() - t0;
    report.flows.push(entry);
    console.log(`  flow ${entry.ok ? 'ok  ' : 'FAIL'} ${name} (${entry.ms} ms) ${entry.ok ? '' : entry.detail}${entry.errors.length ? ` · ${entry.errors.length} error(s): ${entry.errors[0].text}` : ''}`);
  };
  const shot = (name, full = false) => page.screenshot({ path: join(dir, `${name}.png`), fullPage: full });

  await page.goto(`${base}#/`, { waitUntil: 'load' });
  await settle(page, 800);

  await flow('first-run-to-label-card', async () => {
    await page.waitForFunction(() => location.hash === '#/start', null, { timeout: 8000 });
    await page.locator('.h-main .h-btn--primary').first().click();
    await page.waitForFunction(() => location.hash === '#/aaj', null, { timeout: 8000 });
    await answerCard(page, 0);
    await page.waitForSelector('.h-play__side .h-labelcard', { timeout: 6000 });
    await shot('first-receipt-label-card', true);
    return 'first run → Aaj card → first receipt → inline label card';
  });

  for (const mode of ['quick', 'trilogy', 'gauntlet']) {
    await flow(`bot-duel-${mode}`, async () => {
      await go(page, `#/duel?mode=${mode}`, 600);
      await page.locator('.h-main .h-btn--primary').first().click();
      await page.waitForFunction(() => location.hash.startsWith('#/room'), null, { timeout: 8000 });
      const played = await playMatch(page);
      await settle(page, 1500);
      await closeOverlays(page);
      await shot(`bot-${mode}-result`, true);
      const bot = await page.evaluate(() => /Babu-Bot · BOT/.test(document.body.textContent || ''));
      if (!bot) throw new Error('the result does not name Babu-Bot · BOT');
      if (mode !== 'quick') return `${played.liveSeen} live rounds → result`;
      // Rematch is a tap, and reaches a new live question.
      const rematch = page.locator('.h-result .h-btn--primary');
      await rematch.first().click();
      await waitLive(page, 20000);
      await shot('bot-quick-rematch-live');
      await playMatch(page);
      return 'result → Rematch → live → result';
    });
  }

  await flow('pass-and-play', async () => {
    await go(page, '#/duel/pass?mode=trilogy', 600);
    await page.locator('.h-main .h-btn--primary').first().click();
    let handovers = 0;
    for (let i = 0; i < 80; i += 1) {
      await sleep(250);
      if (await page.locator('.h-pass__result').count()) break;
      const cover = page.locator('.h-handover .h-btn--primary');
      if (await cover.count()) {
        if (!handovers) await shot('pass-handover');
        handovers += 1;
        await cover.click();
        continue;
      }
      const opt = page.locator('.h-pass__play .h-opt:not([disabled])');
      if (await opt.count()) {
        await opt.first().click();
        continue;
      }
      const next = page.locator('.h-pass__bar .h-btn--primary').first();
      if (await next.count()) await next.click().catch(() => {});
    }
    if (handovers < 2) throw new Error(`only ${handovers} hand-over cover(s) seen`);
    await page.waitForSelector('.h-pass__result', { timeout: 10000 });
    await settle(page, 1200);
    await shot('pass-result', true);
    const again = page.getByRole('button', { name: /Play again/ });
    await again.click();
    await sleep(500);
    return 'hand-over → answers → reveal → result → Play again';
  });

  await flow('p2p-broadcast-host-guest', async () => {
    const guest = await ctx.newPage();
    listen(guest, sink);
    try {
      await go(page, '#/duel?vs=friend&mode=trilogy&via=tab', 600);
      await page.locator('.h-main .h-btn--primary').first().click();
      await page.waitForSelector('.h-lobby__big', { timeout: 10000 });
      const code = (await page.locator('.h-lobby__big').first().textContent()).trim();
      await shot('p2p-host-lobby', true);
      await guest.goto(`${base}#/duel/friend?code=${encodeURIComponent(code)}&via=tab`, { waitUntil: 'load' });
      await settle(guest, 800);
      const joinButton = guest.locator('form .h-btn--primary');
      if (await joinButton.count()) await joinButton.first().click();
      await guest.waitForSelector('.h-lobby__big', { timeout: 15000 });
      for (const p of [page, guest]) {
        const ready = p.locator('.h-lobby__bar .h-btn--primary');
        await p.waitForFunction(() => {
          const b = document.querySelector('.h-lobby__bar .h-btn--primary');
          return b && !b.disabled;
        }, null, { timeout: 15000 });
        await ready.click();
      }
      await guest.screenshot({ path: join(dir, 'p2p-guest-ready.png'), fullPage: true });
      await Promise.all([playMatch(page, { onLive: () => shot('p2p-host-live') }), playMatch(guest)]);
      await settle(page, 1500);
      await closeOverlays(page);
      await closeOverlays(guest);
      await shot('p2p-host-result', true);
      await guest.screenshot({ path: join(dir, 'p2p-guest-result.png'), fullPage: true });
      return `room ${code}: host + guest over BroadcastChannel → result in both`;
    } finally {
      await guest.close().catch(() => {});
    }
  });

  await flow('home-every-link', async () => {
    await go(page, '#/', 800);
    await closeOverlays(page);
    const links = await page.evaluate(() => [...new Set([...document.querySelectorAll('.h-main a[href^="#"]')].map((a) => a.getAttribute('href')))]);
    const bad = [];
    for (const l of links) {
      await go(page, l, 500);
      const crashed = await page.evaluate(() => !!document.querySelector('[data-screen="error"], [data-screen="not-found"]'));
      if (crashed) bad.push(l);
    }
    if (bad.length) throw new Error(`these Home links open no screen: ${bad.join(', ')}`);
    return `${links.length} links: ${links.join(' ')}`;
  });

  await flow('settings-theme-locale-quiet', async () => {
    await go(page, '#/settings', 600);
    // Radio values are unique across the groups: theme light|dark|system, language en|hi, effects full|reduced|off.
    const pick = (_group, value) => page.locator(`input[type="radio"][value="${value}"]`).first().check({ force: true, timeout: 5000 });
    await pick('theme', 'dark');
    await sleep(300);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    if (theme !== 'dark') throw new Error(`theme did not switch (data-theme=${theme})`);
    await pick('lang', 'hi');
    await sleep(400);
    const lang = await page.evaluate(() => document.documentElement.lang);
    if (lang !== 'hi') throw new Error(`language did not switch (lang=${lang})`);
    await shot('settings-dark-hi', true);
    const quiet = page.getByRole('switch', { name: /Quiet everything|सब चुप/ });
    await quiet.click({ timeout: 5000 });
    await sleep(300);
    const effects = await page.evaluate(() => document.documentElement.dataset.effects);
    if (effects !== 'off') throw new Error(`Quiet everything did not turn Effects off (data-effects=${effects})`);
    await shot('settings-quiet', true);
    // Put it all back for the next flows.
    await quiet.click({ timeout: 5000 });
    await pick('lang', 'en');
    await sleep(300);
    await pick('theme', 'light');
    await pick('effects', 'full');
    await sleep(300);
    const back = await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.lang, document.documentElement.dataset.effects].join(' '));
    if (back !== 'light en full') throw new Error(`settings did not restore (${back})`);
    return 'dark + हिन्दी + Quiet everything applied, then restored';
  });

  await flow('certificate-png', async () => {
    await go(page, '#/me/certificate', 900);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.getByRole('button', { name: /Save as image/ }).click(),
    ]);
    const file = join(dir, 'certificate.png');
    await download.saveAs(file);
    const size = statSync(file).size;
    if (size < 20000) throw new Error(`the certificate PNG is only ${size} bytes`);
    await shot('certificate-view', true);
    return `saved ${download.suggestedFilename()} (${Math.round(size / 1024)} KB)`;
  });

  await flow('rules-report-link', async () => {
    await go(page, '#/rules', 700);
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href*="issues/new"], a[href^="mailto:"]')].map((a) => a.href));
    if (!hrefs.length) throw new Error('no report link on the Rules page');
    return hrefs[0].slice(0, 120);
  });

  await flow('dev-three-lab', async () => {
    await go(page, '#/dev/three', 1500);
    const ok = await page.evaluate(() => !document.querySelector('[data-screen="not-found"], [data-screen="error"]'));
    if (!ok) throw new Error('#/dev/three shows no lab');
    await shot('dev-three', true);
    return 'mounted';
  });

  await ctx.close();
}

// ---- main -----------------------------------------------------------------------------------------

async function main() {
  if (!out) {
    console.error('usage: node scripts/hisaab-screens.mjs <outDir> [baseUrl]');
    process.exit(2);
  }
  mkdirSync(out, { recursive: true });
  report.static = cssClashes();
  for (const c of report.static) console.log(`css-clash: ${c.detail}`);
  const browser = await chromium.launch({
    executablePath: exe,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const cells = [];
    for (const vp of VIEWPORTS) for (const theme of THEMES) cells.push([vp, theme, 'en']);
    if (!process.env.SKIP_HI) for (const theme of THEMES) cells.push([{ w: 390, h: 844 }, theme, 'hi']);
    for (const [vp, theme, locale] of cells) {
      const t0 = Date.now();
      await runCell(browser, vp, theme, locale);
      writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
      const c = report.cells.at(-1);
      const fails = c.steps.reduce((s, x) => s + x.fails.length, 0);
      const errs = c.steps.reduce((s, x) => s + (x.errors?.length ?? 0), 0);
      console.log(`${c.cell}: ${c.steps.length} steps, ${fails} failures, ${errs} errors (${Math.round((Date.now() - t0) / 1000)} s)`);
    }
    if (!process.env.SKIP_FLOWS) await runFlows(browser);
  } finally {
    await browser.close();
  }

  const steps = report.cells.flatMap((c) => c.steps);
  const byRule = {};
  for (const s of steps) for (const f of s.fails) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  for (const f of report.static) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  const errors = [...steps.flatMap((s) => s.errors ?? []), ...report.flows.flatMap((f) => f.errors)];
  const count = (k) => errors.filter((e) => e.kind === k).length;
  report.summary = {
    cells: report.cells.length,
    screens: steps.length,
    shots: steps.filter((s) => s.file && !/FAILED/.test(s.file)).length,
    failures: Object.values(byRule).reduce((a, b) => a + b, 0),
    failuresByRule: byRule,
    consoleErrors: count('console') + count('pageerror') + count('crash'),
    failedRequests: count('requestfailed') + count('http'),
    flows: { total: report.flows.length, ok: report.flows.filter((f) => f.ok).length, failed: report.flows.filter((f) => !f.ok).map((f) => f.flow) },
  };
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  const bad = report.summary.failures + report.summary.consoleErrors + report.summary.failedRequests + report.summary.flows.failed.length;
  process.exit(bad ? 1 : 0);
}

// Run when invoked as a script; importing it (a test, a REPL) only loads the rules and helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();

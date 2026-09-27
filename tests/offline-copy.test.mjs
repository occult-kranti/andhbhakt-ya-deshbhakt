/**
 * The offline demo is retired.
 *
 * Two things are checked here, and both are release gates rather than unit tests.
 *
 * Honesty of the label: the server-free build used to call itself an "offline demo", which told a
 * player nothing about which half of the game works. Every string it shows now names the one
 * thing that is missing — a server — and the two features that need one. No source file under
 * `app/`, `lib/` or `static/` may carry the old wording again, and every `*-static.*` twin has the
 * strings it exports read out of the module and checked as well, so a twin cannot smuggle one past
 * the grep by being the build's own copy.
 *
 * The hand-off: with `APP_URL` set at build time the quiz pages' "Play this as a duel" button
 * points at the live game, the served HTML says the game moved without needing the bundle, and the
 * static bundle renders the redirect card instead of the arena. With it unset every one of those
 * surfaces is exactly what it was. `lib/redirect-target.mjs` — which decides where a visitor goes,
 * and when nowhere — is tested here directly rather than through the card that calls it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BANNED } from '../lib/seo/intents.mjs';
import { buildFiles, renderHub, renderPage } from '../scripts/seo-pages.mjs';
import { INTENTS, UI, playUrl, selectQuestions } from '../lib/seo/intents.mjs';
import { QUESTIONS } from '../lib/server/bank.mjs';
import { ACTIVE_EXPEDITIONS } from '../lib/expeditions.mjs';
import { ENABLED_DOMAINS } from '../lib/content.mjs';
import { parseApp, redirectTarget } from '../lib/redirect-target.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

/** The wording this round retired, in both orders it was written. */
const RETIRED = /offline demo|demo offline/i;

/** The sentence the roadmap settled on for every "there is no server here" surface. */
const HONEST =
  'This preview has no server: friend duels and finding a rival will open once the live site is up.';

/* ------------------------------------------------------------------ the static client's copy */

test('the static duel client says what is missing, not that it is a demo', async () => {
  const { OFFLINE_BUILD, OFFLINE_NOTICE, request } = await import('../lib/duel-client-static.ts');
  assert.equal(OFFLINE_BUILD, true);

  // The messages the player actually reads, taken from the module rather than from its source.
  const shown = [OFFLINE_NOTICE.title, OFFLINE_NOTICE.body];
  for (const body of [
    { action: 'join' },
    { action: 'create', config: { opponent: 'friend' } },
    { action: 'cohort-ping' },
    { action: 'cohort-report' },
  ]) {
    const error = await request(body).then(
      () => assert.fail(`${body.action} should refuse without a server`),
      (e) => e,
    );
    assert.equal(error.status, 501);
    assert.equal(error.code, 'offline_build', 'the error code is a contract with the worker build');
    shown.push(error.message);
  }

  for (const line of shown) {
    assert.doesNotMatch(line, RETIRED, line);
    assert.doesNotMatch(line, BANNED, line);
    assert.doesNotMatch(line, /!/, line);
  }
  assert.ok(OFFLINE_NOTICE.body.startsWith(HONEST), OFFLINE_NOTICE.body);
  assert.ok(shown[2].startsWith(HONEST), shown[2]);
  assert.match(shown[2], /friend duels/i, 'the room screens match on this phrase');

  // The file itself, comments included: nothing left behind for the next reader to copy.
  assert.doesNotMatch(read('lib/duel-client-static.ts'), RETIRED);
});

/* --------------------------------------------------------------------------- the source grep */

/** Every text file under `dir`. Nothing is exempt: the twins are the build's own copy, and the
 * static entry, its stylesheet and its HTML are the first three things a visitor meets. */
function sources(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sources(rel, out);
    else if (/\.(ts|tsx|mjs|js|css|html)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

test('no screen, module or stylesheet under app/, lib/ or static/ calls this an offline demo', () => {
  const files = [...sources('app'), ...sources('lib'), ...sources('static')];
  assert.ok(files.length > 200, `expected the whole tree, walked ${files.length} files`);
  assert.ok(
    files.includes('static/static.css') && files.includes('lib/duel-client-static.ts'),
    'the walk must reach the static build and its twins, which is where the wording last survived',
  );
  const offenders = files.filter((rel) => RETIRED.test(read(rel)));
  assert.deepEqual(offenders, [], `retired wording in: ${offenders.join(', ')}`);
});

/* ------------------------------------------------ the static twins, by their exported strings */

/** The `@/lib/*-client` swaps the static build makes. Found rather than listed, so a new twin is
 * covered the day it lands. */
function twins() {
  return [...sources('lib'), ...sources('static')].filter((rel) => /-static\.(ts|tsx|mjs|js)$/.test(rel));
}

/** Every string reachable from a module's exports: the values a screen can end up rendering. */
function strings(value, depth = 0, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (depth < 4 && (Array.isArray(value) || (value?.constructor === Object && value !== null)))
    for (const inner of Object.values(value)) strings(inner, depth + 1, out);
  return out;
}

test('every static twin is checked by the strings it exports, not only by grep', async () => {
  const found = twins();
  assert.ok(found.length >= 3, `expected the duel, wallet and presence twins, found ${found.join(', ')}`);
  assert.deepEqual(
    found.filter((rel) => rel.endsWith('.tsx')),
    [],
    'a .tsx twin cannot be imported by node --test; move its strings into a .ts or .mjs module',
  );

  for (const rel of found) {
    const twin = await import(`../${rel}`);
    const shown = strings(Object.fromEntries(Object.entries(twin)));
    assert.ok(shown.length > 0, `${rel}: no exported strings to check`);
    for (const line of shown) {
      assert.doesNotMatch(line, RETIRED, `${rel}: ${line}`);
      assert.doesNotMatch(line, BANNED, `${rel}: ${line}`);
      assert.doesNotMatch(line, /!/, `${rel}: ${line}`);
    }
  }
});

/* ------------------------------------------------------------------------------- the hand-off */

const APP = 'https://jaanta-hai-kya.example.workers.dev';
const BASE = 'https://occult-kranti.github.io/fact-duel';
const ctas = (html) => [...html.matchAll(/<a class="cta" href="([^"]+)"/g)].map((m) => m[1]);

test('with APP_URL set every "Play this as a duel" button points at the live game', () => {
  const { files } = buildFiles({ base: BASE, appUrl: APP });
  for (const [rel, html] of Object.entries(files)) {
    if (!rel.endsWith('.html')) continue;
    const hrefs = ctas(html);
    assert.ok(hrefs.length > 0, `${rel}: a CTA`);
    for (const href of hrefs) assert.equal(href, `${APP}/`, rel);
  }

  // One page rendered directly, the way the script does it, with and without the variable.
  const intent = INTENTS[0];
  const selection = selectQuestions(intent, QUESTIONS);
  assert.deepEqual(ctas(renderPage(intent, selection, { base: BASE, appUrl: APP })), [`${APP}/`, `${APP}/`]);
  assert.deepEqual(ctas(renderPage(intent, selection, { base: BASE })), [`${BASE}/`, `${BASE}/`]);
  assert.deepEqual(ctas(renderHub({ base: BASE, appUrl: APP })), [`${APP}/`]);

  // A trailing slash on the variable must not double up.
  assert.equal(playUrl(BASE, `${APP}/`), `${APP}/`);
  assert.equal(playUrl(BASE, '  '), `${BASE}/`);
  assert.equal(playUrl(BASE, undefined), `${BASE}/`);
});

test('the pages, their canonicals and the sitemap do not move when the game does', () => {
  const home = buildFiles({ base: BASE });
  const away = buildFiles({ base: BASE, appUrl: APP });
  assert.equal(away.files['sitemap.xml'], home.files['sitemap.xml']);
  for (const rel of Object.keys(home.files)) {
    if (!rel.endsWith('.html')) continue;
    const canonical = (html) => html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    assert.equal(canonical(away.files[rel]), canonical(home.files[rel]), rel);
    const alternates = (html) => [...html.matchAll(/<link rel="alternate"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(alternates(away.files[rel]), alternates(home.files[rel]), rel);
  }
  // The button is the only difference, and only on the pages that carry one.
  for (const rel of Object.keys(home.files))
    if (rel.endsWith('.html'))
      assert.equal(away.files[rel].replaceAll(`${APP}/`, `${BASE}/`), home.files[rel], rel);
});

test('the quiz-page chrome still reads as a duel invitation in every language', () => {
  for (const ui of Object.values(UI)) {
    assert.ok(ui.play && ui.playHint);
    for (const line of [ui.play, ui.playHint]) assert.doesNotMatch(line, RETIRED, line);
  }
});

/* ------------------------------------------------------------- the build wiring, as written */

test('legacy hand-off remains available but Pages publishes the configured game directly', () => {
  const config = read('vite.config.static.ts');
  assert.match(config, /const appUrl = \(process\.env\.APP_URL \?\? ''\)\.trim\(\);/);
  assert.match(config, /'import\.meta\.env\.VITE_APP_URL': JSON\.stringify\(appUrl\)/);

  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /actions\/upload-pages-artifact@/);
  assert.match(workflow, /actions\/deploy-pages@/);
  assert.doesNotMatch(workflow, /vars\.APP_URL/);
  assert.match(workflow, /VITE_HISAAB_SERVER_URL: https:\/\/[^\s]+\/hisaab-game/);
  assert.match(workflow, /HISAAB_BASE: \/andhbhakt-ya-deshbhakt\//);
  assert.match(workflow, /pnpm build:hisaab/);

  // The entry renders the card instead of the arena, and the card is the only thing on the page.
  const main = read('static/main.tsx');
  assert.match(main, /import\.meta\.env\.VITE_APP_URL/);
  assert.match(main, /<RedirectNotice target=\{HANDOFF\} \/>/);
  const notice = read('app/redirect-notice.tsx');
  assert.match(notice, /now runs at \$\{host\}\. Taking you there…/);
  assert.doesNotMatch(notice, RETIRED);
});

test('the hand-off build does not carry the game: the arena is behind a dynamic import', () => {
  const main = read('static/main.tsx');
  // A static `import Arena from '../app/arena'` is in the entry chunk whichever branch runs, so
  // the card used to wait for the whole game — bank, screens and every screen's CSS — to download
  // and parse before its three-second countdown could start. Same for the in-page duel service,
  // which the preview banner's copy comes from and which pulls the question bank in behind it.
  assert.doesNotMatch(main, /^import .*from '\.\.\/app\/arena'/m, 'the arena must not be a static import');
  assert.doesNotMatch(
    main,
    /^import .*from '\.\.\/lib\/duel-client-static'/m,
    'the duel service must not be a static import',
  );
  assert.match(main, /import\('\.\.\/app\/arena'\)/);
  assert.match(main, /import\('\.\.\/lib\/duel-client-static'\)/);
});

test('the countdown is announced and can be stopped', () => {
  // WCAG 2.2.1 (level A) and technique F40: a timed redirect must be turnable off. These are
  // source assertions because the card is a React component and this suite has no DOM; the
  // behaviour they guard is the pair of effects in RedirectNotice.
  const notice = read('app/redirect-notice.tsx');
  assert.match(notice, /<h1 className="fd-redirect__line"/, 'the card leads with a heading');
  assert.match(notice, /aria-live="polite"/, 'the countdown is spoken');
  assert.doesNotMatch(notice, /aria-hidden=/, 'the countdown must not be hidden from a screen reader');
  assert.match(notice, /addEventListener\('pointerdown'/);
  assert.match(notice, /addEventListener\('keydown'/);
  assert.match(notice, /stay: 'Stay on this preview'/);
  // The declarative refresh cannot be cancelled from script, so it only runs where the card cannot.
  const config = read('vite.config.static.ts');
  assert.match(config, /tag: 'noscript',\n\s+children: `<meta http-equiv="refresh"/);
});

/* -------------------------------------------------------- where a visitor is sent, and when not */

/** `window.location` as the card reads it. */
const here = (pathname, search = '', hash = '', origin = 'https://occult-kranti.github.io') => ({
  origin,
  pathname,
  search,
  hash,
});

const PAGES_BASE = '/fact-duel/';

test('redirectTarget keeps the path the visitor asked for, minus the project base', () => {
  assert.equal(
    redirectTarget(APP, PAGES_BASE, here('/fact-duel/')),
    `${APP}/`,
    'the root of the Pages project is the root of the live host',
  );
  assert.equal(
    redirectTarget(APP, PAGES_BASE, here('/fact-duel/quiz/cricket-quiz/')),
    `${APP}/quiz/cricket-quiz/`,
    'a deep path loses the base and nothing else',
  );
  assert.equal(
    redirectTarget(APP, PAGES_BASE, here('/somewhere/else')),
    `${APP}/somewhere/else`,
    'a path that does not start with the base keeps its own shape',
  );
  // The live game under a sub-path, with and without the trailing slash the founder may paste.
  assert.equal(redirectTarget(`${APP}/play`, PAGES_BASE, here('/fact-duel/rules')), `${APP}/play/rules`);
  assert.equal(redirectTarget(`${APP}/play/`, PAGES_BASE, here('/fact-duel/rules')), `${APP}/play/rules`);
});

test('redirectTarget carries the query and the hash through', () => {
  assert.equal(
    redirectTarget(APP, PAGES_BASE, here('/fact-duel/', '?ref=whatsapp', '#events')),
    `${APP}/?ref=whatsapp#events`,
  );
  assert.equal(
    redirectTarget(APP, PAGES_BASE, here('/fact-duel/quiz/f1-quiz/', '?utm_source=x')),
    `${APP}/quiz/f1-quiz/?utm_source=x`,
  );
});

test('redirectTarget returns null when the target is the page the visitor is already on', () => {
  // The plausible mistake: "set APP_URL to where the game runs", pasted from the browser's bar
  // while looking at the preview. Without this guard the card would location.replace the same URL
  // every three seconds, leaving no history entry to go back to.
  const pages = 'https://occult-kranti.github.io/fact-duel/';
  assert.equal(redirectTarget(pages, PAGES_BASE, here('/fact-duel/')), null);
  assert.equal(redirectTarget(pages, PAGES_BASE, here('/fact-duel/rules', '?a=1', '#b')), null);
  // Same origin, different path: a real move, so it still goes.
  assert.equal(
    redirectTarget('https://occult-kranti.github.io/jhk/', PAGES_BASE, here('/fact-duel/')),
    'https://occult-kranti.github.io/jhk/',
  );
  // Without an origin there is nothing to compare against, and the path answer still stands.
  assert.equal(redirectTarget(pages, PAGES_BASE, { pathname: '/fact-duel/' }), pages);
});

test('redirectTarget returns null for anything that is not an absolute http(s) URL', () => {
  for (const junk of ['', '   ', undefined, null, 'jaantahaikya.com', '/fact-duel/', 'javascript:alert(1)']) {
    assert.equal(redirectTarget(junk, PAGES_BASE, here('/fact-duel/')), null, String(junk));
    assert.equal(parseApp(junk), null, String(junk));
  }
  assert.equal(parseApp(` ${APP} `)?.origin, APP, 'a pasted value with stray spaces still parses');
  // A null target is what makes the caller keep showing the preview instead of a card to nowhere,
  // and what keeps the quiz pages' button on the static host.
  assert.equal(playUrl(BASE, 'jaantahaikya.com'), `${BASE}/`);
  assert.equal(playUrl(BASE, 'javascript:alert(1)'), `${BASE}/`);
});

/* ---------------------------------------------------------- what the served page says it is */

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const description = (html) => html.match(/name="description"\s+content="([^"]*)"/)[1];

test('the preview page describes the game that is actually served', () => {
  const text = description(read('static/index.html'));
  assert.ok(!ENABLED_DOMAINS.includes('science'), 'science is hidden; this test assumes the founder decision');
  assert.doesNotMatch(text, /\bscience\b/i, 'the only description tag on the page may not promise a hidden domain');
  assert.ok(
    text.includes(`${NUMBER_WORDS[ACTIVE_EXPEDITIONS.length]} sports expeditions`),
    `the count must be ACTIVE_EXPEDITIONS.length (${ACTIVE_EXPEDITIONS.length}): ${text}`,
  );
  assert.doesNotMatch(text, /\bnine\b/i, `the retired count is still in the description: ${text}`);
  assert.doesNotMatch(text, /\d/, `spell the count, and only the one that is true: ${text}`);
  assert.doesNotMatch(text, BANNED, text);
  assert.doesNotMatch(text, /!/, text);
});

/** The `fd-static-assets` plugin as the build runs it, for a given APP_URL. */
async function staticPlugin(appUrl) {
  const before = process.env.APP_URL;
  if (appUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = appUrl;
  const loaded = await import(`../vite.config.static.ts?app=${encodeURIComponent(String(appUrl))}`);
  if (before === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = before;
  const config = await loaded.default({ mode: 'production', command: 'build' });
  return config.plugins.flat().find((plugin) => plugin?.name === 'fd-static-assets');
}

test('with APP_URL set the served HTML hands off on its own, with no bundle and no script', async () => {
  const plugin = await staticPlugin(APP);
  const { html, tags } = plugin.transformIndexHtml.handler(read('static/index.html'));
  const host = new URL(APP).host;

  // What a search result or a WhatsApp unfurl of the retired URL now says.
  assert.equal(description(html), `Jaanta Hai Kya now runs at ${host}. This page only sends you there.`);
  assert.doesNotMatch(description(html), /runs in your browser/, 'nothing runs on this page any more');

  // What a visitor sees and can click before — or instead of — the bundle arrives.
  assert.match(html, /<div id="root"><main class="fd-redirect">/);
  assert.match(html, new RegExp(`<a class="fd-redirect__go" href="${APP}/">Go now</a>`));
  assert.match(html, new RegExp(`<h1 class="fd-redirect__line">Jaanta Hai Kya now runs at ${host}\\.</h1>`));

  const find = (tag, attr) => tags.filter((t) => t.tag === tag && (!attr || t.attrs?.[attr]));
  assert.equal(find('link', 'rel').find((t) => t.attrs.rel === 'canonical').attrs.href, `${APP}/`);
  assert.equal(find('noscript').length, 1, 'exactly one declarative refresh');
  assert.equal(find('noscript')[0].children, `<meta http-equiv="refresh" content="3;url=${APP}/">`);
});

test('without APP_URL, or with junk in it, the served HTML is the preview, byte for byte', async () => {
  const source = read('static/index.html');
  for (const value of [undefined, '', '   ', 'jaantahaikya.com', 'javascript:alert(1)']) {
    const plugin = await staticPlugin(value);
    const { html, tags } = plugin.transformIndexHtml.handler(source);
    assert.equal(html, source, String(value));
    assert.deepEqual(
      tags.filter((t) => t.tag === 'noscript' || t.attrs?.rel === 'canonical'),
      [],
      String(value),
    );
  }
});

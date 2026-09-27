/**
 * HISAAB DO — the UI foundation: money-trail and Saal-dar-Saal route derivation (synthetic banks and
 * the real one), the hash router, the notification budget (charter §7, bible §9), the data helpers
 * (source chips, status lines, the certificate name rule, the BOT label), and the static rules the
 * edition's UI code must keep (tokens only, no JHK classes, every screen module present, the Tailwind
 * exclusion that keeps edition files out of JHK's CSS).
 *
 * The TypeScript modules (router.ts, budget.ts, data.ts) are loaded as they ship: node strips their
 * types, the edition alias hook swaps the shared modules, and a small hook here resolves `@/` and
 * extensionless imports the way Vite does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {
  deriveRoutes,
  moneyRoutes,
  yearRoutes,
  yearGroups,
  ERAS,
  MONEY_MIN,
  MONEY_TAGS,
  ROUTE_CARDS,
  ROUTE_MIN,
  YEAR_MIN,
  YEAR_SPAN,
} from '../editions/hisaab/engine/routes.mjs';
import { TAGS, STATES } from '../editions/hisaab/bank/schema.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ROOT_URL = new URL('../', import.meta.url).href;

register('../editions/hisaab/node-aliases.mjs', import.meta.url);
// Vite-style resolution for the edition's TypeScript: '@/x' is the repo root; extensionless relative
// imports try .ts, .tsx, /index.ts. Registered last, so it runs first and hands on to the alias hook.
register(
  `data:text/javascript,${encodeURIComponent(`
    const ROOT = ${JSON.stringify(ROOT_URL)};
    export async function resolve(specifier, context, next) {
      let spec = specifier.startsWith('@/') ? ROOT + specifier.slice(2) : specifier;
      try { return await next(spec, context); } catch (error) {
        if (!(spec.startsWith('.') || spec.startsWith('file:'))) throw error;
        for (const ext of ['.ts', '.tsx', '/index.ts']) {
          try { return await next(spec + ext, context); } catch {}
        }
        throw error;
      }
    }`)}`,
);

const LEVELS = ['simple', 'expert', 'extreme'];
let serial = 0;
/** A synthetic item with only what route derivation reads. */
function item({ state = 'IN', topic = 'Welfare & Subsidies', kind = 'scheme', year = 2020, tags, difficulty } = {}) {
  serial += 1;
  return {
    id: `hzz${String(serial).padStart(3, '0')}`,
    domain: 'civics',
    state,
    topic,
    kind,
    year,
    tags,
    difficulty: difficulty ?? LEVELS[serial % 3],
    question: `Q${serial}?`,
  };
}
const many = (n, fields) => Array.from({ length: n }, () => item(fields));
const byId = (list) => Object.fromEntries(list.map((r) => [r.id, r]));

function assertPlayable(r, bank) {
  assert.equal(r.ids.length, ROUTE_CARDS, `${r.id} has six cards`);
  assert.equal(new Set(r.ids).size, ROUTE_CARDS, `${r.id} cards are unique`);
  assert.match(r.id, /^[a-zA-Z0-9_-]{1,80}$/, 'lib/expeditions.mjs accepts the id');
  assert.equal(r.key, `${r.id}:1`);
  assert.equal(r.domain, 'civics');
  assert.equal(r.padded.length, 0, 'money-trail and year routes are never topped up');
  assert.equal(r.ownCount, ROUTE_CARDS);
  const cards = r.ids.map((id) => bank.find((q) => q.id === id));
  assert.ok(cards.every(Boolean), 'every card is a bank item');
  assert.deepEqual(new Set(cards.map((q) => q.topic)), new Set(r.topics));
  const order = cards.map((q) => LEVELS.indexOf(q.difficulty));
  assert.deepEqual(order, [...order].sort(), 'chapters run simple → expert → extreme');
  assert.ok(Object.isFrozen(r));
  return cards;
}

// ---------------------------------------------------------------------------------------------------
// Money-trail routes

test('money-trail routes: one "all" per tag, per era and per state only where the slice has six', () => {
  serial = 0;
  assert.deepEqual([...MONEY_TAGS], [...TAGS], 'the modes are the schema tags, in order');
  assert.equal(MONEY_MIN, 6);
  assert.deepEqual(
    ERAS.map((e) => [e.from, e.to, e.label]),
    [
      [2000, 2004, '2000–04'],
      [2005, 2009, '2005–09'],
      [2010, 2014, '2010–14'],
      [2015, 2019, '2015–19'],
      [2020, 2026, '2020–26'],
    ],
  );
  const bank = [
    ...many(7, { state: 'MP', year: 2023, tags: ['distribution', 'pre-election'] }), // MP: 7 → state route, era 2020–26
    ...many(3, { state: 'MP', year: 2008, tags: ['distribution'] }), // era 2005–09 has only 3 → no era route
    ...many(6, { state: 'IN', year: 2004, tags: ['distribution'] }), // Centre 6 → state-in; era 2000–04 = 6
    ...many(5, { state: 'WB', year: 2021, tags: ['distribution'] }), // WB 5 → no WB route
    ...many(5, { state: 'OD', year: 2019, tags: ['relief'] }), // relief total 5 → no relief routes at all
    ...many(4, { state: 'UP', year: 2022, topic: 'Health' }), // untagged: never in money routes
  ];
  const routes = moneyRoutes(bank);
  const ids = routes.map((r) => r.id);
  assert.deepEqual(ids, [
    'money-distribution',
    'money-distribution-2000-2004',
    'money-distribution-2020-2026',
    'money-distribution-in',
    'money-distribution-mp',
    'money-pre-election',
    'money-pre-election-2020-2026',
    'money-pre-election-mp',
  ]);
  const r = byId(routes);
  for (const route of routes) {
    const cards = assertPlayable(route, bank);
    assert.equal(route.kind, route.tag);
    assert.ok(cards.every((q) => q.tags?.includes(route.tag)), `${route.id}: only items tagged ${route.tag}`);
    if (route.scope === 'era') assert.ok(cards.every((q) => q.year >= route.years[0] && q.year <= route.years[1]), `${route.id}: inside its era`);
    if (route.scope === 'state') assert.ok(cards.every((q) => q.state === route.state), `${route.id}: one state`);
  }
  assert.equal(r['money-distribution'].scope, 'all');
  assert.equal(r['money-distribution'].poolSize, 21);
  assert.equal(r['money-distribution-2020-2026'].poolSize, 12, 'MP 2023 (7) + WB 2021 (5)');
  assert.deepEqual([...r['money-distribution-2020-2026'].years], [2020, 2026]);
  assert.equal(r['money-distribution-2020-2026'].era, '2020-2026');
  assert.equal(r['money-distribution-in'].title, 'Seedha Khaate Mein · Centre');
  assert.equal(r['money-distribution-mp'].title, 'Seedha Khaate Mein · Madhya Pradesh');
  assert.equal(r['money-distribution-mp'].code, 'KHAATA / MP');
  assert.equal(r['money-pre-election'].title, 'Chunav Se Pehle');
  assert.ok(!ids.some((id) => id.includes('relief')), 'a tag below six items has no routes');
  assert.ok(!ids.includes('money-distribution-wb'), 'a state slice below six has no route');
  assert.ok(!ids.includes('money-distribution-2005-2009'), 'an era slice below six has no route');
  assert.deepEqual(moneyRoutes(bank), routes, 'deterministic');
  // Stability: an unrelated tag landing leaves these routes' cards alone.
  const grown = moneyRoutes([...bank, ...many(9, { state: 'OD', year: 2019, tags: ['relief'] })]);
  for (const route of routes) assert.deepEqual(byId(grown)[route.id], route, `${route.id} is unchanged`);
  assert.ok(byId(grown)['money-relief'] && byId(grown)['money-relief-od'] && byId(grown)['money-relief-2015-2019']);
});

test('deriveRoutes appends money-trail and year routes after the existing kinds, leaving those as they were', () => {
  serial = 0;
  // year: null — no Saal-dar-Saal routes from these (an undefined year would take the helper's default).
  const base = [...many(7, { state: 'UP', topic: 'Farm & Food', year: null }), ...many(6, { topic: 'Health', year: null })];
  const before = deriveRoutes(base);
  assert.deepEqual(before.map((r) => r.id), ['state-up', 'sector-farm-food', 'sector-health']);
  const tagged = [...base, ...many(6, { state: 'TN', year: 2011, tags: ['distribution'] })];
  const after = deriveRoutes(tagged);
  const kinds = after.map((r) => r.kind);
  const firstMoney = kinds.findIndex((k) => MONEY_TAGS.includes(k) || k === 'year');
  assert.ok(kinds.slice(firstMoney).every((k) => MONEY_TAGS.includes(k) || k === 'year'), 'money and year routes come last');
  for (const r of before) assert.deepEqual(byId(after)[r.id]?.ids, r.ids, `${r.id} keeps its cards`);
  assert.deepEqual(ROUTE_MIN, { state: 4, sector: 6, media: 6, forward: 6 }, 'the earlier minimums are untouched');
});

// ---------------------------------------------------------------------------------------------------
// Saal-dar-Saal

test('year routes: a full year stands alone; thin adjacent years merge into a labelled range, never padded', () => {
  serial = 0;
  assert.equal(YEAR_MIN, 6);
  assert.deepEqual(YEAR_SPAN, { from: 2000, to: 2026 });
  const bank = [
    ...many(2, { year: 2003 }),
    ...many(2, { year: 2005 }), // 2003–2005: 4 … + 2007: 3 → 7 → one range 2003–2007
    ...many(3, { year: 2007 }),
    ...many(2, { year: 2009 }), // a thin tail of 2 before a full year: folds into 2003–2007? no — see below
    ...many(8, { year: 2014 }), // full
    ...many(3, { year: 2015 }), // an orphan run between two full years (3 < 6) → folds into 2014
    ...many(6, { year: 2016 }), // full
    ...many(1, { year: 1998 }), // outside the span: ignored
    ...many(5, { year: 2026 }), // a thin tail at the end → folds into the group before it (2016)
  ];
  const groups = yearGroups(bank);
  assert.deepEqual(
    groups.map((g) => [g.from, g.to, g.count]),
    [
      [2003, 2009, 9], // 2003+2005+2007 reach 7; the 2009 remainder (2) joins that range
      [2014, 2015, 11], // 2015's lone 3 cannot stand: it joins the group before it
      [2016, 2026, 11], // 2026's 5 at the end joins 2016
    ],
  );
  const routes = yearRoutes(bank);
  assert.deepEqual(routes.map((r) => r.id), ['year-2003-2009', 'year-2014-2015', 'year-2016-2026']);
  for (const r of routes) {
    const cards = assertPlayable(r, bank);
    assert.equal(r.kind, 'year');
    assert.ok(cards.every((q) => q.year >= r.years[0] && q.year <= r.years[1]), `${r.id}: no card from outside its years`);
    assert.equal(r.merged, r.years[0] !== r.years[1]);
    assert.equal(r.poolSize, bank.filter((q) => q.year >= r.years[0] && q.year <= r.years[1]).length);
  }
  assert.equal(routes[0].title, '2003–2009');
  assert.match(routes[0].subtitle, /2003 to 2009 share one file: 9 cards/);
  assert.equal(routes[0].code, 'SAAL / 2003-09');
  // Every year with items (inside the span) is in exactly one group.
  for (const y of new Set(bank.map((q) => q.year).filter((y) => y >= 2000 && y <= 2026))) {
    assert.equal(groups.filter((g) => y >= g.from && y <= g.to).length, 1, `${y} is covered once`);
  }
  assert.deepEqual(yearRoutes(bank), routes, 'deterministic');

  // A plain case: two full years and nothing thin → two single-year routes titled by the year.
  serial = 0;
  const simple = [...many(6, { year: 2019 }), ...many(9, { year: 2024 })];
  const two = yearRoutes(simple);
  assert.deepEqual(two.map((r) => [r.id, r.title, r.merged]), [
    ['year-2019', '2019', false],
    ['year-2024', '2024', false],
  ]);
  assert.match(two[0].subtitle, /Six receipts from 2019/);
  assert.deepEqual(yearGroups(many(5, { year: 2020 })), [], 'fewer than six items in the whole span: no year routes');
});

test('the real bank: every derived route is playable, year routes cover every year that has cards', async () => {
  const { BANK } = await import('../editions/hisaab/bank/index.mjs');
  const routes = deriveRoutes(BANK);
  assert.deepEqual(deriveRoutes(BANK), routes, 'deterministic');
  assert.equal(new Set(routes.map((r) => r.id)).size, routes.length, 'ids are unique');
  for (const r of routes) {
    assert.equal(r.ids.length, ROUTE_CARDS);
    assert.match(r.id, /^[a-zA-Z0-9_-]{1,80}$/);
  }
  const years = routes.filter((r) => r.kind === 'year');
  assert.ok(years.length > 0, 'the current bank already has Saal-dar-Saal routes');
  for (const y of new Set(BANK.map((q) => q.year).filter((y) => y >= YEAR_SPAN.from && y <= YEAR_SPAN.to))) {
    assert.equal(years.filter((r) => y >= r.years[0] && y <= r.years[1]).length, 1, `${y} has exactly one year file`);
  }
  for (const r of years) {
    for (const id of r.ids) {
      const q = BANK.find((b) => b.id === id);
      assert.ok(q.year >= r.years[0] && q.year <= r.years[1], `${r.id}: ${id} is from ${q.year}`);
    }
  }
  const { ACTIVE_EXPEDITIONS } = await import('../lib/expeditions.mjs');
  assert.deepEqual(
    ACTIVE_EXPEDITIONS.map((r) => r.id),
    routes.map((r) => r.id),
    'in the edition graph, lib/expeditions.mjs runs exactly these routes',
  );
  const { dispatch } = await import('../lib/server/duel-service.mjs');
  const { validExpeditionCards } = await import('../lib/expeditions.mjs');
  const year = years[years.length - 1];
  const { cards } = await dispatch(null, { action: 'expedition', routeId: year.id });
  assert.ok(validExpeditionCards(cards, year), 'the duel service deals a year route and its cards validate');
});

// ---------------------------------------------------------------------------------------------------
// The hash router

test('the router parses every screen route, the share shorthands and query strings', async () => {
  const { parseHash, href, queryString, absoluteUrl } = await import('../editions/hisaab/app/router.ts');
  const cases = [
    ['', 'home', null, 'home', 'full'],
    ['#', 'home', null, 'home', 'full'],
    ['#/', 'home', null, 'home', 'full'],
    ['#/start', 'start', null, null, 'top'],
    ['#/files', 'files', 'hub', 'files', 'full'],
    ['#/files/states', 'files', 'states', 'files', 'full'],
    ['#/files/sectors', 'files', 'sectors', 'files', 'full'],
    ['#/files/media', 'files', 'media', 'files', 'full'],
    ['#/files/forwards', 'files', 'forwards', 'files', 'full'],
    ['#/money', 'money', 'hub', 'files', 'full'],
    ['#/money/distribution', 'money', 'distribution', 'files', 'full'],
    ['#/money/relief', 'money', 'relief', 'files', 'full'],
    ['#/money/pre-election', 'money', 'pre-election', 'files', 'full'],
    ['#/money/years', 'money', 'years', 'files', 'full'],
    ['#/route/state-up', 'route', null, 'files', 'full'],
    ['#/aaj', 'aaj', null, 'home', 'full'],
    ['#/q/hsc001', 'taster', null, 'home', 'full'],
    ['#/duel', 'duel', 'setup', 'duel', 'full'],
    ['#/duel/friend', 'duel', 'friend', 'duel', 'full'],
    ['#/duel/pass', 'pass', null, 'duel', 'none'],
    ['#/room', 'room', null, 'duel', 'none'],
    ['#/receipts', 'receipts', null, 'receipts', 'full'],
    ['#/me', 'me', 'profile', 'me', 'full'],
    ['#/me/certificate', 'me', 'certificate', 'me', 'full'],
    ['#/settings', 'settings', null, 'me', 'full'],
    ['#/rules', 'rules', null, 'me', 'full'],
    ['#/dev', 'dev', 'engine', null, 'none'],
    ['#/dev/ui', 'dev', 'ui', null, 'full'],
    ['#/nowhere', 'not-found', null, null, 'full'],
    ['#/route/bad id!', 'not-found', null, null, 'full'],
  ];
  for (const [hash, name, view, tab, chrome] of cases) {
    const r = parseHash(hash);
    assert.deepEqual([r.name, r.view, r.tab, r.chrome], [name, view, tab, chrome], hash);
    assert.ok(Object.isFrozen(r));
  }
  assert.deepEqual(parseHash('#/route/money-distribution-2020-2026').params, { id: 'money-distribution-2020-2026' });
  assert.deepEqual(parseHash('#q=hsc001'), parseHash('#/q/hsc001') && { ...parseHash('#/q/hsc001'), hash: '#q=hsc001' });
  assert.equal(parseHash('#aaj').name, 'aaj');
  assert.deepEqual(parseHash('#/files/states?s=UP&view=list').query, { s: 'UP', view: 'list' });
  assert.equal(parseHash('#/files/states/').name, 'files', 'a trailing slash is fine');
  assert.equal(parseHash('#/files/states?s=UP').path, '/files/states', 'the path (visit key) excludes the query');
  assert.deepEqual(parseHash('#/duel/friend?code=7K2Q-9F3A').query, { code: '7K2Q-9F3A' });
  // Every href builder round-trips to its screen.
  assert.equal(parseHash(href.route('state-up')).params.id, 'state-up');
  assert.equal(parseHash(href.money('years', { y: 2019 })).query.y, '2019');
  assert.equal(parseHash(href.friend('ABCD-EFGH')).query.code, 'ABCD-EFGH');
  assert.equal(parseHash(href.taster('hsc001')).name, 'taster');
  assert.equal(parseHash(href.certificate()).view, 'certificate');
  assert.equal(queryString({ a: 1, b: '', c: null, d: 'x y' }), '?a=1&d=x%20y');
  assert.equal(absoluteUrl(href.aaj(), '/fact-duel/hisaab/', 'https://occult-kranti.github.io'), 'https://occult-kranti.github.io/fact-duel/hisaab/#/aaj');
});

// ---------------------------------------------------------------------------------------------------
// The notification budget

function fakeClock() {
  let t = 0;
  let timers = [];
  return {
    now: () => t,
    setTimer: (fn, ms) => {
      const timer = { fn, at: t + ms };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      timers = timers.filter((x) => x !== timer);
    },
    tick(ms = 0) {
      const end = t + ms;
      for (;;) {
        const due = timers.filter((x) => x.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers = timers.filter((x) => x !== due);
        t = Math.max(t, due.at);
        due.fn();
      }
      t = end;
    },
  };
}

test('budget: one toast per screen visit — later asks merge into it, then go to Activity; a new visit resets', async () => {
  const { createHisaabBudget, TOASTS_PER_VISIT } = await import('../editions/hisaab/app/budget.ts');
  assert.equal(TOASTS_PER_VISIT, 1);
  const clock = fakeClock();
  const b = createHisaabBudget({ clock });
  b.newVisit('/');
  const id = b.toast({ title: 'Quest done', body: 'Answer 3 questions', tone: 'quest' });
  clock.tick();
  assert.equal(b.getSnapshot().toasts.length, 1);
  assert.equal(b.toast({ title: 'Missed a day. 1 CL used. Streak safe.' }), id, 'a second ask while it is up merges');
  clock.tick();
  const shown = b.getSnapshot().toasts;
  assert.equal(shown.length, 1, 'still one toast on screen');
  assert.equal(shown[0].count, 2);
  assert.equal(shown[0].title, 'Quest done');
  assert.match(shown[0].body, /\+1 more: Missed a day/);
  b.dismissToast(id);
  clock.tick(5000);
  assert.equal(b.toast({ title: 'Third' }), null, 'after it is dismissed, the visit has no toast left');
  clock.tick(5000);
  assert.equal(b.getSnapshot().toasts.length, 0);
  const third = b.getSnapshot().activity.find((a) => a.title === 'Third');
  assert.ok(third && third.shown === false, 'logged in Activity, unshown — not lost');
  b.newVisit('/files');
  assert.ok(b.toast({ title: 'New screen, new allowance' }));
  clock.tick(5000);
  assert.equal(b.getSnapshot().toasts.length, 1);
  // A custom merge writes the words.
  b.newVisit('/aaj');
  b.toast({ title: 'q1', merge: (items) => ({ title: `+${items.length} quests` }) });
  b.toast({ title: 'q2' });
  clock.tick(2000);
  assert.equal(b.getSnapshot().toasts[0].title, '+2 quests');
});

test('budget: a live round holds everything; a toast still waiting when the visit ends is logged, not carried over', async () => {
  const { createHisaabBudget } = await import('../editions/hisaab/app/budget.ts');
  const clock = fakeClock();
  const b = createHisaabBudget({ clock });
  b.newVisit('/room');
  b.setLive(true);
  assert.equal(b.getSnapshot().live, true);
  b.toast({ title: 'Quest done' });
  b.ceremony({ kind: 'label', title: 'Receipt Maango', stamp: 'ISSUED · RECEIPT MAANGO' });
  clock.tick(10_000);
  assert.equal(b.getSnapshot().toasts.length, 0, 'nothing opens while live');
  assert.equal(b.getSnapshot().ceremony, null);
  b.setLive(false);
  clock.tick();
  assert.ok(b.getSnapshot().ceremony, 'the ceremony opens once the round is over');
  b.closeCeremony();
  clock.tick(3000);
  assert.equal(b.getSnapshot().toasts.length, 1, 'then the held toast');

  const release = b.hold();
  b.newVisit('/route/state-up');
  b.toast({ title: 'Held for the finish' });
  clock.tick(5000);
  assert.equal(b.getSnapshot().toasts.length, 0, 'held');
  assert.equal(b.getSnapshot().held, true);
  assert.equal(b.getSnapshot().live, false, 'a hold is not a live round (3D may mount)');
  b.newVisit('/');
  release();
  clock.tick(5000);
  assert.equal(b.getSnapshot().toasts.length, 0, 'the old visit’s toast did not follow the player');
  assert.ok(b.getSnapshot().activity.some((a) => a.title === 'Held for the finish' && !a.shown));

  b.setToastsOff(true);
  assert.equal(b.toast({ title: 'Quiet everything' }), null);
  assert.ok(b.getSnapshot().activity.some((a) => a.title === 'Quiet everything' && !a.shown));
});

test('budget: only label and file ceremonies exist; both at once make one ceremony with two stamps', async () => {
  const { createHisaabBudget, CEREMONY_KINDS } = await import('../editions/hisaab/app/budget.ts');
  assert.deepEqual([...CEREMONY_KINDS], ['label', 'file']);
  const clock = fakeClock();
  const b = createHisaabBudget({ clock });
  for (const kind of ['level', 'achievement', 'stamp', 'streak', 'rank']) {
    assert.equal(b.ceremony({ kind, title: `A ${kind}` }), null, `${kind} is downgraded`);
  }
  clock.tick(5000);
  assert.equal(b.getSnapshot().ceremony, null);
  assert.equal(b.getSnapshot().activity.filter((a) => a.kind === 'update').length, 5, 'in-place updates, logged');

  const file = b.ceremony({ kind: 'file', title: 'Uttar Pradesh ki file clear.', stamp: 'FILE CLEARED · 18/24' });
  const label = b.ceremony({ kind: 'label', title: 'Receipt Maango', stamp: 'ISSUED · RECEIPT MAANGO' });
  assert.equal(label, file, 'merged into the same ceremony');
  clock.tick();
  const open = b.getSnapshot().ceremony;
  assert.ok(open);
  assert.deepEqual(open.parts.map((p) => p.kind), ['label', 'file'], 'one ceremony, two stamps, the label as headline');
  assert.deepEqual(open.parts.map((p) => p.stamp), ['ISSUED · RECEIPT MAANGO', 'FILE CLEARED · 18/24']);
  b.closeCeremony();
  clock.tick(2000);
  assert.equal(b.getSnapshot().ceremony, null);
  b.ceremony({ kind: 'file', title: 'Bihar', stamp: 'FILE CLEARED' });
  clock.tick();
  assert.equal(b.getSnapshot().ceremony.parts.length, 1, 'after closing, the next is its own ceremony');
});

// ---------------------------------------------------------------------------------------------------
// Data helpers

test('data: source chips, status lines, labels, the BOT label and the certificate name rule', async () => {
  const data = await import('../editions/hisaab/app/data.ts');
  const kind = (sourceUrl, sourceLabel = '') => data.sourceKind({ sourceUrl, sourceLabel });
  assert.equal(kind('https://cag.gov.in/en/audit-report/details/1'), 'CAG');
  assert.equal(kind('https://api.sci.gov.in/supremecourt/2021/1.pdf'), 'COURT');
  assert.equal(kind('https://delhihighcourt.nic.in/x'), 'COURT');
  assert.equal(kind('https://sansad.in/getFile/loksabhaquestions/x.pdf'), 'SANSAD');
  assert.equal(kind('https://pib.gov.in/PressReleasePage.aspx?PRID=1'), 'PIB');
  assert.equal(kind('https://www.eci.gov.in/x'), 'ECI');
  assert.equal(kind('https://rbi.org.in/x'), 'RBI');
  assert.equal(kind('https://enforcementdirectorate.gov.in/x'), 'AGENCY');
  assert.equal(kind('https://www.sebi.gov.in/x'), 'AGENCY');
  assert.equal(kind('https://www.altnews.in/x'), 'FACT-CHECK');
  assert.equal(kind('https://www.thequint.com/news/webqoof/x'), 'FACT-CHECK');
  assert.equal(kind('https://prsindia.org/budgets'), 'RESEARCH');
  assert.equal(kind('https://www.bseindia.com/x'), 'FILING');
  assert.equal(kind('https://www.indiabudget.gov.in/doc/x.pdf'), 'OFFICIAL');
  assert.equal(kind('https://www.pmindia.gov.in/en/news_updates/x', 'PIB (PMO) — x'), 'PIB');
  assert.equal(kind('https://newsonair.gov.in/x'), 'PRESS', 'a public broadcaster’s news is a news report');
  assert.equal(kind('https://www.thehindu.com/news/x'), 'PRESS');
  assert.equal(kind('not a url'), 'PRESS');
  for (const q of data.BANK_ITEMS) assert.ok(data.SOURCE_KINDS.includes(data.sourceKind(q)), q.id);

  const withStatus = data.BANK_ITEMS.find((q) => q.status);
  assert.equal(data.statusLine(withStatus), withStatus.status, 'verbatim');
  assert.equal(data.statusWithAsOf(withStatus), `${withStatus.status} (as of ${data.monthLabel(withStatus.asOf)})`);
  assert.equal(data.statusLine(data.BANK_ITEMS.find((q) => !q.status)), null);
  assert.equal(data.asOfText('2026-09'), 'as of Sep 2026');
  assert.equal(data.asOfText('2026-09', 'hi'), 'Sep 2026 तक');
  assert.equal(data.itemById(withStatus.id), withStatus);
  assert.equal(data.itemForCard({ factId: withStatus.id }), withStatus);
  assert.equal(data.itemById('nope'), null);
  assert.equal(data.formatNumber(1234567), '12,34,567');

  assert.equal(data.seatName({ kind: 'bot', name: 'Lucky Guess · BOT' }), 'Babu-Bot · BOT');
  assert.equal(data.seatName({ kind: 'human', name: '  ' }), 'Anonymous Janta');
  assert.equal(data.seatName({ kind: 'human', name: 'Riya' }), 'Riya');
  assert.equal(data.babuRank('gold'), 'Under Secretary');
  assert.equal(data.babuRank(undefined), 'LDC');
  assert.equal('CONFIDENCE_DISPLAY' in data, false, 'removed choices are not exported for screens');

  assert.equal(data.LADDER_DISPLAY.length, 9);
  assert.equal(data.labelDisplay(0).hi, 'अंधभक्त');
  assert.equal(data.labelDisplay(8).en, 'Certified Anti-National');
  assert.equal(data.labelDisplay(6).aside, '(as per the forwards)');
  assert.equal(data.goalCopy(0), '4 levels to WhatsApp University Fresher');
  assert.equal(data.goalCopy(1e9), 'Top rung. Keep asking.');

  // Certificate names: never a real person from the bank.
  const person = data.BANK_ITEMS.flatMap((q) => q.people ?? []).find((n) => n.split(' ').length >= 2);
  assert.ok(person, 'the bank names people');
  assert.equal(data.certificateName(person), 'Anonymous Janta');
  assert.equal(data.certificateName(person.toUpperCase()), 'Anonymous Janta', 'case-insensitive');
  assert.equal(data.certificateName(`Dr. ${person}`), 'Anonymous Janta', 'honorifics ignored');
  assert.equal(data.certificateName(person.split(' ').reverse().join(' ')), 'Anonymous Janta', 'order-free');
  assert.equal(data.certificateName(`${person} fan`), 'Anonymous Janta', 'containing a full name');
  assert.equal(data.certificateName(''), 'Anonymous Janta');
  assert.equal(data.certificateName(null), 'Anonymous Janta');
  assert.equal(data.certificateName('Asha'), 'Asha');
  assert.equal(data.certificateName('A very very long player name indeed'), 'A very very long pla');
  assert.equal(data.normalizePersonName('Shri. N. Chandrababu  Naidu'), 'n chandrababu naidu');

  // …nor anyone who is, or looks like, a public figure, party, outlet, institution or community (bible
  // §8.5): the certificate is the one artefact that puts a label on a typed name, and it is forwarded.
  const neverPrinted = [
    'Mamata Banerjee', 'Yogi Adityanath', 'PM Modi', 'Modi ji', 'Kejriwal', 'नरेंद्र मोदी', 'मोदी जी',
    'Nаrendra Modi', // Cyrillic а
    'ᴍᴏᴅɪ', 'Ｍｏｄｉ', 'M0di', 'Mo​di', 'N a r e n d r a M o d i', 'NarendraModiFan',
    'Mamta Bannerjee', 'केजरीवाल', 'Kejriwal ji ki jai', 'Yogi ji', 'CM', 'Stalin Anna',
    'BJP', 'Congress', 'NDTV', 'Republic TV', 'Godi Media', 'IT Cell', 'Pappu', 'Didi', 'भाजपा', 'RSS',
    'Supreme Court', 'Prime Minister', 'Muslims', 'মমতা', // a script the gate cannot check
  ];
  for (const n of neverPrinted) assert.equal(data.certificateName(n), 'Anonymous Janta', `never prints ${JSON.stringify(n)}`);
  for (const n of ['Asha', 'Rahul', 'Priya Sharma', 'Sharma', 'Rohan Modi', 'Anna Shah', 'Yogi Sharma', 'Christian', 'आशा देवी']) {
    assert.equal(data.certificateName(n), n, `${n} prints`);
  }
  assert.equal(data.nameBlock('Ольга'), 'script');
  assert.equal(data.nameBlock('BJP'), 'public');
  assert.equal(data.nameBlock('  '), 'empty');
  assert.equal(data.certificateName('Asha‮'), 'Asha', 'bidi controls are never printed');
  const longHi = 'अभिषेक कुमार शर्मा वर्मा चतुर्वेदी त्रिपाठी';
  const clipped = data.certificateName(longHi);
  assert.ok(clipped.length < longHi.length && longHi.startsWith(clipped), 'a long Devanagari name is trimmed');
  assert.ok(!/[\u093C-\u094D]$/.test(clipped) || /[\u093E-\u094C]$/.test(clipped), 'never cut after a half letter');

  // The cartogram: every state once, the Centre as the drawer, Devanagari names for all.
  const cells = data.CARTOGRAM.flat().filter(Boolean);
  assert.equal(cells.length, 30);
  assert.deepEqual(new Set(cells), new Set(Object.keys(STATES).filter((c) => c !== 'IN')));
  assert.equal(data.CARTOGRAM_CENTRE.code, 'IN');
  for (const code of Object.keys(STATES)) assert.ok(data.STATE_NAMES_HI[code], code);
  assert.equal(data.stateName('IN'), 'Centre');
  assert.equal(data.stateName('UP'), 'Uttar Pradesh');
  assert.equal(data.pollLine({ poll: { label: 'MP Assembly 2023', month: '2023-11', gapDays: 160, result: 'BJP won 163 of 230' } }), 'MP Assembly 2023 · 160 days before polling · BJP won 163 of 230');
  assert.equal(data.enactedLine({ name: 'A B', role: 'Chief Minister, X', party: 'P' }), 'A B · Chief Minister, X · P');
});

// ---------------------------------------------------------------------------------------------------
// Static rules for the edition's UI code

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test('progression: with visitCreditsStreak off (the edition), 30 visit-only days earn no streak and no XP; JHK keeps its default', async () => {
  const { emptyProgression, reduceProgression, setProgressionOptions, progressionOptions } = await import('../lib/progression.mjs');
  assert.equal(progressionOptions().visitCreditsStreak, true, 'JHK default: a visit credits the streak');
  const DAY = 86_400_000;
  const start = Date.UTC(2026, 8, 1, 6);
  const days = (fn) => {
    let prog = emptyProgression();
    for (let d = 0; d < 30; d++) prog = fn(prog, start + d * DAY);
    return prog;
  };
  try {
    setProgressionOptions({ visitCreditsStreak: false });
    const visits = days((p, at) => reduceProgression(p, [{ kind: 'visit' }], at, { epoch: 'e' }));
    assert.equal(visits.streak.current, 0);
    assert.equal(visits.xp, 0);
    assert.equal(visits.quests.day.length > 0, true, 'a visit still rolls the daily quests');
    // A day with play still counts.
    const played = reduceProgression(emptyProgression(), [{ kind: 'visit' }, { kind: 'open', factId: 'hsc001', topic: 'Health' }], start, { epoch: 'e' });
    assert.equal(played.streak.current, 1);
  } finally {
    setProgressionOptions({ visitCreditsStreak: true });
  }
  const jhk = days((p, at) => reduceProgression(p, [{ kind: 'visit' }], at, { epoch: 'e' }));
  assert.equal(jhk.streak.current, 30, 'the default is unchanged');
});

test('progression: with rankHumanMatches off (the edition), a friend duel pays XP but never moves the Babu rank', async () => {
  const { emptyProgression, reduceProgression, setProgressionOptions } = await import('../lib/progression.mjs');
  const at = Date.UTC(2026, 8, 1, 6);
  const win = (bot) => [{ kind: 'match', mode: 'trilogy', outcome: 'win', bot, scores: [2, 1], topic: 'all', topics: [], matchId: `m-${bot}` }];
  const jhk = reduceProgression(emptyProgression(), win(false), at, { epoch: 'e' });
  assert.ok(jhk.rank.points > 0, 'JHK default: a win against a person moves the rank');
  try {
    setProgressionOptions({ rankHumanMatches: false });
    const friend = reduceProgression(emptyProgression(), win(false), at, { epoch: 'e' });
    assert.equal(friend.rank.points, 0, 'no rank from a friend duel');
    assert.ok(friend.xp > 0, 'it still pays XP');
    const bot = reduceProgression(emptyProgression(), win(true), at, { epoch: 'e' });
    assert.ok(bot.rank.points > 0, 'a bot duel still ranks');
  } finally {
    setProgressionOptions({ rankHumanMatches: true });
  }
});

test('the UI code keeps the design rules: tokens only, no JHK classes, every screen module present', () => {
  const edition = path.join(ROOT, 'editions/hisaab');
  // tokens.css defines the colours; app/dev-shell.tsx is the engine's unstyled debug page at #/dev.
  const exempt = [path.join('theme', 'tokens.css'), path.join('app', 'dev-shell.tsx')];
  const files = walk(edition).filter((f) => /\.(css|tsx)$/.test(f) && !exempt.some((e) => f.endsWith(e)));
  for (const f of files) {
    // Rules apply to code, not to comments that explain them.
    const text = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, `${path.relative(ROOT, f)}: raw hex (use --h- tokens)`);
    assert.doesNotMatch(text, /\bfd-/, `${path.relative(ROOT, f)}: JHK fd- class`);
    if (f.endsWith('.css')) assert.doesNotMatch(text, /!important/, `${path.relative(ROOT, f)}: !important`);
  }
  const screens = ['home', 'start', 'files', 'money', 'route', 'aaj', 'taster', 'duel', 'pass', 'room', 'receipts', 'me', 'settings', 'rules'];
  const registry = fs.readFileSync(path.join(edition, 'app/shell/screens.ts'), 'utf8');
  for (const name of screens) {
    assert.ok(fs.existsSync(path.join(edition, `app/screens/${name}/index.tsx`)), `screens/${name}/index.tsx exists`);
    assert.match(registry, new RegExp(`import\\('\\.\\./screens/${name}'\\)`), `${name} is lazily registered`);
  }
  // Emoji party symbols never appear in UI code (bible §2.4).
  for (const f of walk(path.join(edition, 'app')).filter((x) => /\.(ts|tsx|css)$/.test(x))) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /[🪷✋🧹🚲🐘⏰🏹🏮☭🌅🪁🌿]/u, `${path.relative(ROOT, f)}: party-symbol emoji`);
  }
});

test('builds: JHK’s Tailwind never scans edition files, and the edition build takes an output override', () => {
  const globals = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
  assert.match(globals, /^@source not "\.\.\/editions";$/m, 'app/globals.css excludes editions/ from Tailwind’s source detection');
  assert.ok(fs.existsSync(path.join(ROOT, 'app', '../editions')), 'the excluded path is the editions folder');
  const vite = fs.readFileSync(path.join(ROOT, 'vite.config.hisaab.ts'), 'utf8');
  assert.match(vite, /process\.env\.HISAAB_OUT/);
  assert.match(vite, /'dist-hisaab'/, 'the default output is still dist-hisaab/');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const dep of ['@fontsource-variable/akshar', '@fontsource/mukta', '@fontsource/sometype-mono', '@fontsource/kalam'])
    assert.ok(pkg.dependencies[dep], `${dep} is a dependency`);
  const fonts = fs
    .readFileSync(path.join(ROOT, 'editions/hisaab/app/fonts.css'), 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('@import'))
    .join('\n');
  assert.equal(fonts.split('\n').length, 5, 'exactly five eager stylesheets (bible §4.2)');
  assert.doesNotMatch(fonts, /latin-400|devanagari-400|latin-ext/, 'weight files, not per-subset files');
  assert.doesNotMatch(fonts, /kalam/i, 'Kalam is lazy');
});

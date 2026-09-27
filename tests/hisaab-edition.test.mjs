/**
 * HISAAB DO — the edition's engine wiring: routes derived from the bank, the label ladder over the
 * engine's bands, the daily five, and the edition module graph (civics topics reach the journal,
 * progression and the expedition reducer through the alias table in editions/hisaab/aliases.mjs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { deriveRoutes, pickCards, ROUTE_CARDS, ROUTE_MIN, MEDIA_SECTOR, slug } from '../editions/hisaab/engine/routes.mjs';
import { LABELS, labelFor, labelForLevel } from '../editions/hisaab/engine/labels.mjs';
import { dailyFive, dealDaily, dailyRoundId, localDay, DAILY_SIZE } from '../editions/hisaab/engine/daily.mjs';
import { SECTORS } from '../editions/hisaab/bank/schema.mjs';
import { EDITION_ALIASES } from '../editions/hisaab/aliases.mjs';
import { BANK } from '../editions/hisaab/bank/index.mjs';
import fs from 'node:fs';

register('../editions/hisaab/node-aliases.mjs', import.meta.url);

const LEVELS = ['simple', 'expert', 'extreme'];
let serial = 0;
/** A minimal bank item: only the fields route and daily derivation read. */
function item({ state = 'IN', topic = 'Health', kind = 'scheme', difficulty = LEVELS[serial % 3] } = {}) {
  serial += 1;
  return { id: `hxx${String(serial).padStart(3, '0')}`, domain: 'civics', state, topic, kind, difficulty, question: `Q${serial}?` };
}
const many = (n, fields) => Array.from({ length: n }, () => item(fields));

test('routes appear only when their pool is big enough, and every route is six unique bank cards', () => {
  serial = 0;
  const bank = [
    ...many(3, { state: 'KL', topic: 'Health' }), // 3 < 4: no Kerala route
    ...many(4, { state: 'AS', topic: 'Infrastructure' }), // 4: an Assam route, topped up from the Centre
    ...many(7, { state: 'UP', topic: 'Farm & Food' }), // 7: a UP route of its own
    ...many(5, { topic: 'Health' }), // Centre Health: 5 + Kerala's 3 = 8 Health items → a sector route
    ...many(3, { topic: 'Infrastructure' }), // Centre Infrastructure: tops up Assam first
    ...many(6, { topic: MEDIA_SECTOR, kind: 'media' }), // Kiska Media, and no Media & Speech sector file
    ...many(5, { topic: 'Jobs & Economy', kind: 'forward' }),
    ...many(1, { topic: 'Health', kind: 'forward' }), // 6 forwards across two sectors → Forward Court
  ];
  const routes = deriveRoutes(bank);
  const byId = Object.fromEntries(routes.map((r) => [r.id, r]));
  assert.ok(!byId['state-kl'], 'a state below the minimum has no route');
  assert.ok(byId['state-as'] && byId['state-up'] && byId['sector-health'] && byId['kiska-media'] && byId['forward-court']);
  assert.ok(!byId[`sector-${slug(MEDIA_SECTOR)}`], 'Media & Speech is Kiska Media, not a second route');
  assert.ok(!byId['sector-jobs-economy'], '5 items is below the sector minimum');
  const ids = new Set(bank.map((q) => q.id));
  for (const r of routes) {
    assert.equal(r.ids.length, ROUTE_CARDS);
    assert.equal(new Set(r.ids).size, ROUTE_CARDS);
    assert.ok(r.ids.every((id) => ids.has(id)));
    assert.equal(r.key, `${r.id}:1`);
    assert.equal(r.domain, 'civics');
    assert.equal(r.chapters.length, 3);
    assert.match(r.id, /^[a-zA-Z0-9_-]{1,80}$/, 'lib/expeditions.mjs accepts the id');
    const cards = r.ids.map((id) => bank.find((q) => q.id === id));
    assert.deepEqual(new Set(cards.map((q) => q.topic)), new Set(r.topics));
    assert.ok(r.topics.includes(r.topic));
    const order = cards.map((q) => LEVELS.indexOf(q.difficulty));
    assert.deepEqual(order, [...order].sort(), 'chapters run simple → expert → extreme');
    assert.ok(Object.isFrozen(r));
  }
  const assam = byId['state-as'];
  assert.equal(assam.ownCount, 4);
  assert.equal(assam.padded.length, 2);
  assert.ok(
    assam.padded.every((id) => bank.find((q) => q.id === id).topic === 'Infrastructure' && bank.find((q) => q.id === id).state === 'IN'),
    'the top-up is Centre items in the state’s own sector first',
  );
  assert.match(assam.subtitle, /4 receipts from Assam, 2 from the Centre/);
  assert.equal(byId['state-up'].padded.length, 0);
  assert.deepEqual([...byId['forward-court'].topics].sort(), ['Health', 'Jobs & Economy']);
  assert.equal(byId['forward-court'].topic, 'Jobs & Economy', 'the dominant sector');
  assert.deepEqual(
    routes.map((r) => r.id),
    ['state-up', 'state-as', 'sector-farm-food', 'sector-health', 'sector-infrastructure', 'kiska-media', 'forward-court'],
    'display order: states (charter order), sectors (SECTORS order), Kiska Media, Forward Court',
  );
  assert.deepEqual(deriveRoutes(bank), routes, 'deterministic');
  const grown = deriveRoutes([...bank, ...many(2, { state: 'GJ', topic: 'Energy & Mining' })]);
  assert.deepEqual(grown.find((r) => r.id === 'state-up'), byId['state-up'], 'an unrelated lane landing leaves a route alone');
  assert.deepEqual(ROUTE_MIN, { state: 4, sector: 6, media: 6, forward: 6 });
});

test('pickCards takes two per difficulty where it can and tops up from the rest', () => {
  serial = 0;
  const pool = [...many(4, { difficulty: 'simple' }), ...many(3, { difficulty: 'expert' }), ...many(1, { difficulty: 'extreme' })];
  const { cards, padded } = pickCards(pool, 'salt');
  assert.equal(cards.length, 6);
  assert.deepEqual(padded, []);
  const count = (level) => cards.filter((q) => q.difficulty === level).length;
  assert.equal(count('extreme'), 1);
  assert.equal(count('simple') + count('expert'), 5);
  assert.ok(count('simple') >= 2 && count('expert') >= 2);
});

test('the label ladder has one rung per engine band, in the charter’s order', async () => {
  const { LEVEL_TITLES, levelForXp, xpForLevel } = await import('../lib/progression.mjs');
  assert.equal(LABELS.length, LEVEL_TITLES.length);
  assert.equal(labelFor(0).label, 'Andhbhakt');
  assert.equal(labelFor(8).label, 'Deshbhakt');
  assert.equal(labelFor(99).label, 'Deshbhakt', 'clamped');
  assert.equal(labelFor(-1).label, 'Andhbhakt');
  for (let level = 1; level <= 60; level++) {
    const band = levelForXp(xpForLevel(level)).band;
    assert.equal(labelForLevel(level), labelFor(band), `level ${level}`);
    const rung = labelForLevel(level);
    assert.ok(level >= rung.from && (rung.to === null || level <= rung.to), `level ${level} inside ${rung.label}`);
  }
  assert.equal(labelForLevel(5).label, 'WhatsApp University Fresher');
  assert.equal(labelForLevel(40).label, 'Deshbhakt');
});

test('the daily five: same five for the same local day, five distinct cards, option order seeded too', () => {
  const day = '2026-09-25';
  const one = dealDaily(day, BANK);
  assert.deepEqual(dealDaily(day, BANK), one);
  assert.equal(one.cards.length, Math.min(DAILY_SIZE, BANK.length));
  assert.equal(new Set(one.cards.map((c) => c.factId)).size, one.cards.length);
  for (const card of one.cards) {
    const q = BANK.find((b) => b.id === card.factId);
    assert.equal(card.options[card.correctIndex], q.options[q.correctIndex], 'the key follows the shuffle');
  }
  const topics = new Set(dailyFive(day, BANK).map((q) => q.topic));
  assert.equal(topics.size, Math.min(DAILY_SIZE, new Set(BANK.map((q) => q.topic)).size), 'as many sectors as the bank allows');
  const week = new Set(['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28'].map((d) => dailyFive(d, BANK).map((q) => q.id).join()));
  assert.ok(week.size > 1, 'the set moves with the date');
  assert.equal(localDay(new Date(2026, 8, 5, 23, 59)), '2026-09-05');
  assert.equal(dailyRoundId(day, 2), 'practice:daily-2026-09-25:2');
});

test('the alias table names real files, and each twin exports what the module it replaces exports', async () => {
  for (const { from, to } of EDITION_ALIASES) {
    assert.ok(fs.existsSync(new URL(`../${from}`, import.meta.url)), from);
    assert.ok(fs.existsSync(new URL(`../${to}`, import.meta.url)), to);
  }
  const pairs = [
    ['../lib/content.mjs', '../editions/hisaab/engine/content.mjs'],
    ['../lib/events-data.mjs', '../editions/hisaab/engine/events-data.mjs'],
    ['../lib/storage-ns.mjs', '../editions/hisaab/storage-ns.mjs'],
    ['../lib/expedition-routes.mjs', '../editions/hisaab/engine/expedition-routes.mjs'],
  ];
  for (const [shared, twin] of pairs) {
    // Read the shared module's export names from source: importing it here would be redirected.
    const text = fs.readFileSync(new URL(shared, import.meta.url), 'utf8');
    const names = [...text.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    const mod = await import(twin);
    for (const name of names) assert.ok(name in mod, `${twin} exports ${name}`);
  }
});

test('in the edition graph, civics sectors are the topics of the journal, progression and quests', async () => {
  const { TOPIC_DOMAINS } = await import('../lib/journal.mjs');
  const { TOPICS, dailyQuests, emptyProgression } = await import('../lib/progression.mjs');
  const { ENABLED_DOMAINS } = await import('../lib/content.mjs');
  const { ACTIVE_EVENTS } = await import('../lib/events.mjs');
  assert.deepEqual(Object.keys(TOPIC_DOMAINS), [...SECTORS]);
  assert.ok(Object.values(TOPIC_DOMAINS).every((d) => d === 'civics'));
  assert.deepEqual([...TOPICS], [...SECTORS]);
  assert.deepEqual([...ENABLED_DOMAINS], ['civics']);
  assert.equal(ACTIVE_EVENTS.length, 0, 'no sports calendar in this edition');
  assert.deepEqual(Object.keys(emptyProgression().counters.byTopic), [...SECTORS]);
  for (let d = 1; d <= 28; d++) {
    for (const quest of dailyQuests('epoch', `2026-09-${String(d).padStart(2, '0')}`).items)
      if (quest.topic) assert.ok(SECTORS.includes(quest.topic), quest.label);
  }
});

test('in the edition graph, a route runs through the shared reducer and pays XP; mixed-topic routes validate', async () => {
  const { dispatch } = await import('../lib/server/duel-service.mjs');
  const { ACTIVE_EXPEDITIONS, validExpeditionCards, readExpeditions } = await import('../lib/expeditions.mjs');
  const { emptyProfile, reduceProfile, readProfile } = await import('../lib/passport.mjs');
  const { QUESTIONS } = await import('../lib/server/bank.mjs');
  assert.deepEqual(
    ACTIVE_EXPEDITIONS.map((r) => r.ids.join()),
    deriveRoutes(QUESTIONS).map((r) => r.ids.join()),
    'lib/expeditions.mjs runs the routes derived from the served bank',
  );
  const route = ACTIVE_EXPEDITIONS[0];
  const { cards } = await dispatch(null, { action: 'expedition', routeId: route.id });
  let p = emptyProfile('epoch-1', 1_800_000_000_000);
  let at = 1_800_000_000_000;
  const act = (action) => (p = reduceProfile(p, { epoch: 'epoch-1', at: (at += 1000), routeId: route.id, ...action }));
  act({ type: 'journey-start', runId: 'run-1', previousRunId: null, cards });
  for (let i = 0; i < 6; i++) {
    act({ type: 'journey-answer', runId: 'run-1', index: i, choice: cards[i].correctIndex, confidence: 'steady' });
    act({ type: 'journey-next', runId: 'run-1', index: i });
  }
  const record = p.journeys[route.key];
  assert.equal(record.first.correct, 6);
  assert.ok(p.progression.xp > 0, 'expedition XP was paid');
  assert.ok(Object.keys(p.journal.facts).length === 6, 'all six civics facts reached the journal');
  assert.deepEqual(readProfile(JSON.parse(JSON.stringify(p))).journeys, p.journeys, 'the record survives a reload');
  assert.ok(readExpeditions(p.journeys)[route.key].first);

  // A mixed-topic route (a state route) validates cards of any of its topics — and only those.
  const mixed = { ...route, topics: [cards[0].topic, 'Health'] };
  const cardsMixed = cards.map((c, i) => ({ ...c, topic: i % 2 ? 'Health' : cards[0].topic }));
  assert.ok(validExpeditionCards(cardsMixed, mixed));
  assert.equal(validExpeditionCards(cardsMixed.map((c) => ({ ...c, topic: 'Defence & Security' })), mixed), false);
});

test('in the edition graph, a bot duel is journalled as a civics fact and pays XP', async () => {
  const { dispatch } = await import('../lib/server/duel-service.mjs');
  const { MemoryRoomStore } = await import('../lib/duel-memory-store.mjs');
  const { emptyProfile, reduceProfile } = await import('../lib/passport.mjs');
  let t = 1_800_000_000_000;
  const store = new MemoryRoomStore({ clock: () => t });
  const seat = { roomId: 'b'.repeat(32), token: 'S'.repeat(40) };
  const opts = () => ({ now: t, useDatabaseClock: true, rng: () => 0.5 });
  await dispatch(store, { action: 'create', ...seat, invite: 'J'.repeat(40), name: 'Tester', config: { mode: 'quick', stake: 0, duration: 10, opponent: 'bot' } }, opts());
  await dispatch(store, { action: 'ready', ...seat, roundId: null }, opts());
  t += 3000;
  const shown = (await dispatch(store, { action: 'reveal', ...seat, roundId: `${seat.roomId}:0` }, opts())).room;
  const key = QUESTIONS_KEY(shown.round.question.question);
  t += 800;
  await dispatch(store, { action: 'answer', ...seat, roundId: shown.round.id, attemptId: 'attempt-0000000000001', choice: key(shown.round.question.options), elapsedMs: 780 }, opts());
  t += 10_000;
  const done = (await dispatch(store, { action: 'state', ...seat }, opts())).room;
  assert.equal(done.phase, 'complete');
  assert.equal(done.round.receipts[0].correct, true);
  const p = reduceProfile(emptyProfile('e', t), { type: 'room', room: done, epoch: 'e', at: t });
  assert.equal(p.journal.matches.length, 1);
  assert.equal(Object.values(p.journal.facts)[0].topic, done.round.question.topic);
  assert.ok(SECTORS.includes(done.round.question.topic));
  assert.ok(p.progression.xp > 0);
  assert.equal(p.progression.counters.byTopic[done.round.question.topic].correct, 1);
});

/** Look a question up in the edition bank and return a function mapping shuffled options to the key. */
function QUESTIONS_KEY(text) {
  const q = BANK.find((b) => b.question === text);
  assert.ok(q, 'dealt from the edition bank');
  return (options) => options.indexOf(q.options[q.correctIndex]);
}

test('route identities are stable: a bank edit that retires or regroups a route keeps its stored record', async () => {
  const { routeCatalogue, routeIdSpace, RETIRED_DOMAIN } = await import('../editions/hisaab/engine/routes.mjs');
  const { QUESTIONS } = await import('../editions/hisaab/server/bank.mjs');
  const { EXPEDITIONS, ACTIVE_EXPEDITIONS, validExpeditionCards } = await import('../lib/expeditions.mjs');
  const { emptyProfile, readProfile, reduceProfile } = await import('../lib/passport.mjs');
  const { dispatch } = await import('../lib/server/duel-service.mjs');

  // Every id the derivation produces lies in the data-independent id space, and the engine's catalogue
  // is the live routes plus one retired stub (same key, no cards, never offered) per other id.
  const space = routeIdSpace().map((r) => r.id);
  assert.equal(new Set(space).size, space.length, 'the id space has no duplicates');
  const live = deriveRoutes(QUESTIONS);
  for (const r of live) assert.ok(space.includes(r.id), `${r.id} is in routeIdSpace()`);
  assert.equal(EXPEDITIONS.length, space.length);
  assert.equal(new Set(EXPEDITIONS.map((r) => r.key)).size, EXPEDITIONS.length, 'keys are unique');
  assert.deepEqual(ACTIVE_EXPEDITIONS.map((r) => r.id), live.map((r) => r.id), 'retired stubs are never offered');

  // Synthetic banks: withdrawing one 2002 item merges 2002 into 2003 (year-2002-2003), withdrawing a
  // relief item retires the relief files and regroups the years, and adding one item from 2001
  // regroups year-2002 into year-2001-2002.
  serial = 0;
  const yearItem = (year, extra = {}) => ({ ...item(), year, ...extra });
  const bank = [
    ...Array.from({ length: 6 }, () => yearItem(2002)),
    ...Array.from({ length: 6 }, () => yearItem(2003)),
    ...Array.from({ length: 6 }, () => yearItem(2021, { state: 'MH', tags: ['relief'] })),
  ];
  const ids = (b) => new Set(deriveRoutes(b).map((r) => r.id));
  const before = ids(bank);
  const edits = {
    'withdraw a 2002 item': bank.filter((q) => q !== bank[0]),
    'withdraw a relief item': bank.filter((q) => q !== bank[17]),
    'add a 2001 item': [...bank, yearItem(2001)],
  };
  const expectGone = {
    'withdraw a 2002 item': ['year-2002', 'year-2003'],
    // 2021 drops to five items and folds into 2003 (year-2003-2021), so year-2003 goes too.
    'withdraw a relief item': ['money-relief', 'money-relief-2020-2026', 'money-relief-mh', 'year-2003', 'year-2021'],
    'add a 2001 item': ['year-2002'],
  };
  for (const [name, edited] of Object.entries(edits)) {
    const after = ids(edited);
    const gone = [...before].filter((id) => !after.has(id));
    assert.deepEqual(gone.sort(), expectGone[name].sort(), name);
    const catalogue = routeCatalogue(edited);
    for (const id of gone) {
      const stub = catalogue.find((r) => r.key === `${id}:1`);
      assert.ok(stub, `${name}: ${id} keeps its key in the catalogue`);
      assert.equal(stub.retired, true);
      assert.equal(stub.domain, RETIRED_DOMAIN);
      assert.deepEqual(stub.ids, []);
    }
    assert.deepEqual(
      catalogue.filter((r) => !r.retired).map((r) => r.id),
      deriveRoutes(edited).map((r) => r.id),
      `${name}: the live routes are unchanged`,
    );
  }

  // End to end on the served catalogue: a finished record on a retired route survives readProfile,
  // and the retired route can be neither dealt nor started.
  const stub = EXPEDITIONS.find((r) => r.retired);
  const result = { runId: 'run-1', at: 1_800_000_000_000, score: 12, correct: 6, bold: 0 };
  const record = { run: null, first: result, best: result, last: result, completions: 3, bestScore: 12, folded: false, foldedDay: null };
  let p = emptyProfile('epoch-1', 1_800_000_000_000);
  p = { ...p, journeys: { [stub.key]: record, [live[0].key]: record } };
  const read = readProfile(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(read.journeys[stub.key], record, `${stub.id}: first, best, last, completions and best score kept`);
  assert.deepEqual(read.journeys[live[0].key], record);
  await assert.rejects(dispatch(null, { action: 'expedition', routeId: stub.id }));
  const { cards } = await dispatch(null, { action: 'expedition', routeId: live[0].id });
  assert.equal(validExpeditionCards(cards, stub), false, 'no cards validate against a retired route');
  const started = reduceProfile(read, { type: 'journey-start', epoch: 'epoch-1', at: 1_800_000_100_000, routeId: stub.id, runId: 'run-2', previousRunId: null, cards });
  assert.equal(started.journeys[stub.key].run, null, 'a retired route cannot be started');
});

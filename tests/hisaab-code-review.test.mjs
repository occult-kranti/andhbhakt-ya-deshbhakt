/**
 * HISAAB DO — regression tests from the code review (docs/hisaab/review/code.md).
 *
 * Guards pin the live-question timing contract (ENGINE §6.3): no answer before `markShown()`, the
 * elapsed time runs from `markShown()` on the monotonic clock, and `markShown()` is idempotent per
 * round. The rest reproduce the code review's P2 findings (docs/hisaab/review/p2-backlog.md, "code")
 * and guard their fixes: the duel controller's epoch check after every await, the 150 ms ticker that
 * serves only the countdown, and the budget's sub-visit that returns to the SAME screen visit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('../editions/hisaab/node-aliases.mjs', import.meta.url);
const ROOT_URL = new URL('../', import.meta.url).href;
// Vite-style resolution for the edition's TypeScript (as tests/hisaab-ui-foundation.test.mjs does).
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

const { createDuelController } = await import('../editions/hisaab/engine/duel-controller.mjs');

/** A request() whose calls wait until the test settles them. */
function manualRequest() {
  const calls = [];
  const request = (body) =>
    new Promise((resolve, reject) => {
      calls.push({ body, resolve, reject });
    });
  return { calls, request };
}

const QUIET_POLLS = { active: 60_000, waiting: 60_000, hidden: 60_000 };
const ROOM_ID = 'a'.repeat(32);

function room(patch = {}) {
  return {
    id: ROOM_ID,
    revision: 1,
    seat: 0,
    phase: 'playing',
    roundIndex: 0,
    config: { mode: 'quick', duration: 10 },
    players: [
      { name: 'You', ready: false, kind: 'human' },
      { name: 'Lucky Guess · BOT', ready: false, kind: 'bot' },
    ],
    scores: [0, 0],
    settled: false,
    winner: null,
    reason: null,
    completedRounds: [],
    round: {
      id: `${ROOM_ID}:0`,
      scheduledAt: 0,
      issuedAt: 0,
      answerLocked: [false, false],
      question: { id: `${ROOM_ID}:0`, topic: 'Health', question: 'Q?', options: ['a', 'b', 'c', 'd'] },
      result: null,
    },
    ...patch,
  };
}

// ---- timing contract guards (pass today) ---------------------------------------------------------

test('timing contract: no answer before markShown(); elapsed runs from markShown() on the monotonic clock', async () => {
  const { calls, request } = manualRequest();
  let now = 1_000;
  const c = createDuelController({ request, perfNow: () => now, pollMs: QUIET_POLLS });
  c.adopt({ room: room() });
  assert.equal(await c.answer(1), false, 'a tap before the reveal marker is ignored');
  assert.equal(calls.length, 0, 'and nothing is sent');

  now = 2_000;
  c.markShown();
  now = 2_400;
  c.markShown(); // a second marker in the same round must not restart the clock
  assert.equal(c.snapshot().shownRoundId, `${ROOM_ID}:0`);

  now = 2_750;
  const sent = c.answer(2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.action, 'answer');
  assert.equal(calls[0].body.elapsedMs, 750, 'measured from the FIRST markShown() of the round');
  assert.equal(calls[0].body.choice, 2);
  assert.equal(await c.answer(3), false, 'first tap locks');
  calls[0].resolve({ room: room({ revision: 2, round: { ...room().round, answerLocked: [true, false] } }) });
  assert.equal(await sent, true);
  c.dispose();
});

test('timing contract: markShown() is a no-op once the result is in; an answer past the clock is refused locally', async () => {
  const { calls, request } = manualRequest();
  let now = 0;
  const c = createDuelController({ request, perfNow: () => now, pollMs: QUIET_POLLS });
  c.adopt({ room: room() });
  c.markShown();
  now = 10_000; // the 10 s clock has run out on this screen
  assert.equal(await c.answer(0), false);
  assert.equal(calls.length, 0);
  c.adopt({ room: room({ revision: 5, round: { ...room().round, result: { winner: null, reason: 'no-correct-answer' } } }) });
  c.markShown();
  assert.equal(c.snapshot().remainingMs, null, 'no clock after the result');
  c.dispose();
});

// ---- review P2s (fixed; these guard the fixes) -----------------------------------------------------

test(
  'duel controller: a poll that lands after reset() does not bring the old match back',
  async () => {
    const { calls, request } = manualRequest();
    const c = createDuelController({ request, pollMs: QUIET_POLLS });
    c.adopt({ room: room({ phase: 'complete', settled: true, reason: 'complete', revision: 7 }) });
    const inflight = c.refresh(); // e.g. a P2P poke, or a poll already on the wire
    c.reset(); // "Forget the match" (the rematch path in screens/room/index.tsx)
    assert.equal(c.room, null);
    calls[0].resolve({ room: room({ phase: 'complete', settled: true, reason: 'complete', revision: 8 }) });
    await inflight;
    const resurrected = c.room;
    c.dispose();
    assert.equal(resurrected, null, 'the forgotten room must stay forgotten');
  },
);

test(
  'duel controller: a response for the previous room does not replace a newly adopted room',
  async () => {
    const { calls, request } = manualRequest();
    const c = createDuelController({ request, pollMs: QUIET_POLLS });
    c.adopt({ room: room({ phase: 'waiting', round: null, revision: 3 }) });
    const inflight = c.refresh();
    const next = room({ id: 'b'.repeat(32), phase: 'waiting', round: null, revision: 1 });
    c.adopt({ room: next });
    calls[0].resolve({ room: room({ phase: 'waiting', round: null, revision: 4 }) });
    await inflight;
    const shown = c.room?.id;
    c.dispose();
    assert.equal(shown, 'b'.repeat(32), 'the adopted room stays on screen');
  },
);

test(
  'duel controller: no snapshot churn while the question is up (the 150 ms ticker only serves the countdown)',
  async () => {
    const { request } = manualRequest();
    let changes = 0;
    const c = createDuelController({ request, onChange: () => (changes += 1), pollMs: QUIET_POLLS });
    c.adopt({ room: room() }); // issuedAt is set: the question is out, the countdown is over
    c.markShown();
    changes = 0;
    await new Promise((resolve) => setTimeout(resolve, 700));
    c.dispose();
    assert.equal(changes, 0, 'nothing on the live card reads countdownMs/remainingMs from a re-render');
  },
);

test('duel controller: a ready() reply for the previous room does not replace a newly adopted room', async () => {
  const { calls, request } = manualRequest();
  const c = createDuelController({ request, pollMs: QUIET_POLLS });
  c.adopt({ room: room({ phase: 'waiting', round: null, revision: 3 }) });
  const ready = c.ready();
  c.adopt({ room: room({ id: 'c'.repeat(32), phase: 'waiting', round: null, revision: 1 }) });
  calls[0].resolve({ room: room({ phase: 'scheduled', revision: 4 }) });
  await ready;
  const shown = c.room?.id;
  c.dispose();
  assert.equal(shown, 'c'.repeat(32));
});

test('duel controller: a failure from before reset() is not shown as the new match\'s error', async () => {
  const { calls, request } = manualRequest();
  const c = createDuelController({ request, pollMs: QUIET_POLLS });
  c.adopt({ room: room({ phase: 'waiting', round: null, revision: 2 }) });
  const inflight = c.refresh();
  c.reset();
  calls[0].reject(Object.assign(new Error('Peer went away.'), { status: 500 }));
  await inflight;
  const { error } = c.snapshot();
  c.dispose();
  assert.equal(error, '', 'the old room\'s error stays with the old room');
  assert.equal(calls.length, 1, 'and the stale failure does not start another poll');
});

test('duel controller: an answer reply that lands after reset() leaves the controller empty', async () => {
  const { calls, request } = manualRequest();
  const c = createDuelController({ request, perfNow: () => 0, pollMs: QUIET_POLLS });
  c.adopt({ room: room() });
  c.markShown();
  const sent = c.answer(0);
  c.reset();
  calls[0].resolve({ room: room({ revision: 9, round: { ...room().round, answerLocked: [true, false] } }) });
  assert.equal(await sent, false, 'the answer belonged to the forgotten match');
  const after = c.room;
  c.dispose();
  assert.equal(after, null);
});

test('duel controller: a leave response after reset cannot revive a quit match', async () => {
  const { calls, request } = manualRequest();
  const c = createDuelController({ request, perfNow: () => 0, pollMs: QUIET_POLLS });
  c.adopt({ room: room() });
  const leaving = c.leave();
  assert.equal(calls[0].body.action, 'leave');
  c.reset();
  calls[0].resolve({ room: room({ phase: 'cancelled', settled: true, reason: 'player-left', revision: 9 }) });
  await leaving;
  assert.equal(c.room, null);
  assert.equal(c.snapshot().error, '');
  c.dispose();
});

test('duel controller: the ticker still re-renders the 3·2·1 before the reveal', async () => {
  const { request } = manualRequest();
  let changes = 0;
  const c = createDuelController({
    request,
    perfNow: () => 0,
    onChange: () => (changes += 1),
    pollMs: QUIET_POLLS,
  });
  // Scheduled 10 s out and not yet issued: the countdown is on screen and reads countdownMs.
  c.adopt({
    room: room({ phase: 'scheduled', round: { ...room().round, scheduledAt: 10_000, issuedAt: null, question: null } }),
  });
  changes = 0;
  await new Promise((resolve) => setTimeout(resolve, 500));
  const { countdownMs } = c.snapshot();
  c.dispose();
  assert.ok(changes >= 2, `the countdown ticks (${changes} changes in 500 ms)`);
  assert.equal(countdownMs, 10_000);
});

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

test(
  'budget: closing a sheet returns to the SAME screen visit — it does not grant the screen a second toast',
  async () => {
    const { createHisaabBudget } = await import('../editions/hisaab/app/budget.ts');
    const clock = fakeClock();
    const b = createHisaabBudget({ clock });
    b.newVisit('/receipts');
    const first = b.toast({ title: 'Quest done' });
    assert.ok(first, 'the Vault visit gets its one toast');
    clock.tick();
    b.dismissToast(first);
    clock.tick(5000);
    // What useVisit(open, 'receipt-sheet') does when a receipt sheet opens and closes:
    b.newVisit('/receipts#receipt-sheet');
    b.newVisit('/receipts');
    const second = b.toast({ title: 'Second quest done' });
    b.destroy();
    assert.equal(second, null, 'same screen visit: the second ask goes to Activity (bible §9 rule 1)');
  },
);

test('budget: a link inside an open sheet navigates — the sheet closing does not pull the visit back', async () => {
  const { createHisaabBudget } = await import('../editions/hisaab/app/budget.ts');
  const clock = fakeClock();
  const b = createHisaabBudget({ clock });
  b.newVisit('/receipts');
  // useVisit(open, 'receipt-sheet') opens the sheet's visit…
  b.newVisit('/receipts#receipt-sheet');
  // …the detail's "Report an error" link navigates: the shell's layout effect runs first,
  b.newVisit('/rules');
  // …then the sheet's passive cleanup.
  b.leaveVisit('/receipts#receipt-sheet', '/receipts');
  assert.equal(b.getSnapshot().visit, '/rules', 'the Rules visit stands');
  const t = b.toast({ title: 'Quest done' });
  b.destroy();
  assert.ok(t, 'and Rules keeps its own one toast');
});

test('budget: the sheet has its own toast; the screen keeps an unused allowance; a new route resets it', async () => {
  const { createHisaabBudget } = await import('../editions/hisaab/app/budget.ts');
  const clock = fakeClock();
  const b = createHisaabBudget({ clock });
  b.newVisit('/receipts');
  b.newVisit('/receipts#receipt-sheet');
  const inSheet = b.toast({ title: 'Quest done' });
  assert.ok(inSheet, 'a sheet counts as a visit of its own (bible §9 rule 1)');
  clock.tick();
  b.dismissToast(inSheet);
  b.leaveVisit('/receipts#receipt-sheet', '/receipts');
  assert.equal(b.getSnapshot().visit, '/receipts');
  const onScreen = b.toast({ title: 'Second quest' });
  assert.ok(onScreen, 'the screen had not used its toast before the sheet opened');
  clock.tick();
  b.dismissToast(onScreen);
  b.newVisit('/me');
  const onMe = b.toast({ title: 'Third quest' });
  b.destroy();
  assert.ok(onMe, 'a route change is a fresh visit');
});

// ---- review P2s in the edition's helpers (fixed; these guard the fixes) ------------------------------

test('duel names: a human seat never passes for the bot (only the real bot is labelled BOT)', async () => {
  const data = await import('../editions/hisaab/app/data.ts');
  const lib = await import('../editions/hisaab/app/screens/duel/lib.ts');
  for (const n of ['Babu-Bot · BOT', 'babu bot', 'BabuBot', 'BOT', 'Riya (bot)', 'Lucky Guess · BOT'])
    assert.equal(data.impersonatesBot(n), true, n);
  for (const n of ['Riya', 'Robot Raju', 'Bottle Baba', 'Abbott', 'Anonymous Janta'])
    assert.equal(data.impersonatesBot(n), false, n);
  assert.equal(data.seatName({ kind: 'human', name: 'Babu-Bot · BOT' }), data.ANONYMOUS, 'the other screen');
  assert.equal(data.seatName({ kind: 'bot', name: 'Lucky Guess · BOT' }), data.BOT_NAME, 'the real bot keeps its label');
  assert.equal(data.seatName({ kind: 'human', name: 'Riya' }), 'Riya');
  assert.equal(lib.seatNameFor('  Babu-Bot · BOT '), data.ANONYMOUS, 'the name sent to the room');
  assert.equal(lib.seatNameFor('Riya'), 'Riya');
});

test('Vault: a receipt first filed today and never re-checked is not "due" on day one', async () => {
  const { reviewQueue } = await import('../editions/hisaab/app/screens/receipts/lib.ts');
  const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
  const now = day(2026, 9, 26, 18);
  // As the engine files them (lib/passport.mjs): a fact met outside the Vault is due the moment it is met.
  const met = (at, surface, extra = {}) => ({
    topic: 'Health', seen: 1, correct: 1, firstAt: at, lastAt: at, lastCorrect: true, box: 0, due: at, lapses: 0,
    retiredAt: null, bySurface: { duel: 0, expedition: 0, discovery: 0, recall: 0, event: 0, [surface]: 1 }, ...extra,
  });
  const facts = {
    fresh: met(day(2026, 9, 26, 9), 'discovery'),
    older: met(day(2026, 9, 20), 'expedition', { lastCorrect: false, correct: 0 }),
    rechecked: met(day(2026, 9, 26, 8), 'discovery', {
      seen: 2, box: 0, due: day(2026, 9, 26, 10), bySurface: { duel: 0, expedition: 0, discovery: 1, recall: 1, event: 0 },
    }),
  };
  const rows = Object.keys(facts).map((id) => ({ id, options: ['a', 'b', 'c', 'd'], withdrawn: false }));
  assert.deepEqual(new Set(reviewQueue({ facts }, rows, now)), new Set(['older', 'rechecked']));
  // A deck seeded today (after a bad run, §3.5) is dealt as seeded, fresh cards included.
  const seeded = reviewQueue({ facts, seed: { at: day(2026, 9, 26, 17), factIds: ['fresh'] } }, rows, now);
  assert.ok(seeded.includes('fresh'));
  // Tomorrow the fresh card is due like any unscheduled one.
  assert.ok(reviewQueue({ facts }, rows, day(2026, 9, 27, 9)).includes('fresh'));
});

test('labels: every rung has a Devanagari one-liner for the Hindi locale', async () => {
  const data = await import('../editions/hisaab/app/data.ts');
  for (const rung of data.LADDER_DISPLAY) {
    assert.match(rung.lineHi, /[ऀ-ॿ]/, `${rung.en} lineHi is Devanagari`);
    assert.equal(data.labelLine(rung, true), rung.lineHi);
    assert.equal(data.labelLine(rung, false), rung.line);
    if (rung.aside) assert.match(rung.asideHi ?? '', /[ऀ-ॿ]/, `${rung.en} asideHi`);
  }
});

test('Activity and XP lines use the Stamp Register’s names, not JHK’s', async () => {
  const data = await import('../editions/hisaab/app/data.ts');
  assert.equal(data.achievementName('all-routes', 'Every stamp'), 'Nine files');
  assert.equal(data.achievementName('bold-master', 'Clean sweep'), 'Clean file');
  assert.equal(data.achievementName('friend-rival', 'Friendly rival'), 'Friendly rival', 'kept when the edition keeps it');
  const line = data.xpLogWords({ at: 0, kind: 'achievement', xp: 50, label: 'Every stamp', meta: { achievement: 'all-routes' } });
  assert.equal(line, 'Stamp Register: Nine files');
});

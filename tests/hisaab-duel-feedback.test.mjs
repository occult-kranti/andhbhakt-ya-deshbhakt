import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('../editions/hisaab/node-aliases.mjs', import.meta.url);
const { dispatch, D1RoomStore } = await import('../lib/server/duel-service.mjs');
const { MemoryRoomStore } = await import('../lib/duel-memory-store.mjs');
const { RULES, settleMatch } = await import('../lib/server/room-engine.mjs');
const { LocalD1 } = await import('./d1-local.mjs');
const { emptyProfile, reduceProfile } = await import('../lib/passport.mjs');

const token = () => crypto.randomUUID().replaceAll('-', '') + '1234567890abcdef';
async function fixture({ opponent = 'friend', mode = 'quick', store = new MemoryRoomStore() } = {}) {
  let now = 1_800_000_000_000;
  const host = { roomId: crypto.randomUUID().replaceAll('-', ''), token: token(), invite: token() };
  const guest = { roomId: host.roomId, token: token(), invite: host.invite };
  const call = (seat, action, extra = {}) => dispatch(store, { ...seat, action, ...extra }, { now, rng: () => 0.99 });
  const raw = async () => JSON.parse((await store.read(host.roomId)).state);
  await call(host, 'create', { name: 'Asha', config: { opponent, mode, duration: 30, stake: 0 } });
  if (opponent === 'friend') await call(guest, 'join', { name: 'Bilal' });
  async function prepare() {
    const before = await raw();
    const roundId = before.round?.id ?? null;
    await call(host, 'ready', { roundId });
    if (opponent === 'friend') await call(guest, 'ready', { roundId });
    let state = await raw();
    now = state.round.scheduledAt;
    await call(host, 'reveal', { roundId: state.round.id });
    if (opponent === 'friend') await call(guest, 'reveal', { roundId: state.round.id });
    return raw();
  }
  const answer = (seat, r, elapsedMs, choice = r.round.question.correctIndex, attemptId = token()) =>
    call(seat, 'answer', { roundId: r.round.id, attemptId, elapsedMs, choice });
  return { host, guest, store, call, raw, prepare, answer, setTime: (t) => (now = t) };
}

test('every HISAAB bot format resolves on answer response, preserving all precommitted bot plans', async () => {
  for (const mode of ['quick', 'trilogy', 'gauntlet']) {
    const f = await fixture({ opponent: 'bot', mode });
    const plans = (await f.raw()).botPlans;
    while (!(await f.raw()).settled) {
      const r = await f.prepare();
      const plan = plans[r.roundIndex];
      assert.ok(plan.elapsedMs > 15_000, 'the random bot would normally keep the player waiting');
      f.setTime(r.round.issuedAt[0] + 700);
      const { room } = await f.answer(f.host, r, 700);
      assert.ok(room.round.result, 'no state poll or clock advance was needed');
      assert.ok(['between', 'complete'].includes(room.phase));
      assert.equal(room.round.personalReceipt, null);
      assert.equal(room.round.receipts[1].choice, plan.choice);
      assert.equal(room.round.receipts[1].elapsedMs, plan.elapsedMs, 'early resolution is not a speed bonus');
      assert.equal(room.round.receipts[1].simulated, true);
      assert.deepEqual((await f.raw()).botPlans, plans, 'the answer cannot reroll any bot turn');
      assert.ok((await f.raw()).events.every((e) => e.at <= room.serverNow), 'no future event timestamps');
    }
  }
});

test('an early wrong human answer still loses to a slower precommitted correct bot', async () => {
  const f = await fixture({ opponent: 'bot' });
  const r = await f.prepare();
  // Pin an already committed correct plan rather than depending on shuffled option order.
  r.botPlans[0] = { choice: r.round.question.correctIndex, elapsedMs: 29_000 };
  const row = await f.store.read(f.host.roomId);
  await f.store.compareSwap(f.host.roomId, row.revision, r);
  f.setTime(r.round.issuedAt[0] + 400);
  const { room } = await f.answer(f.host, r, 400, (r.round.question.correctIndex + 1) % 4);
  assert.equal(room.phase, 'complete');
  assert.equal(room.winner, 1);
  assert.equal(room.round.result.reason, 'correct');
  assert.equal(room.round.receipts[1].elapsedMs, 29_000);
});

test('first human answer gets private feedback, unopened opponent receives no answer or source', async () => {
  const f = await fixture();
  const r = await f.prepare();
  f.setTime(r.round.issuedAt[0] + 800);
  const { room } = await f.answer(f.host, r, 800, (r.round.question.correctIndex + 1) % 4);
  assert.equal(room.phase, 'playing');
  assert.equal(room.round.result, null);
  assert.deepEqual(room.scores, [0, 0]);
  assert.equal(room.round.personalReceipt.correct, false);
  assert.equal(room.round.personalReceipt.elapsedMs, 800);
  assert.equal(room.round.personalReceipt.question.correctIndex, r.round.question.correctIndex);
  assert.equal(room.round.personalReceipt.question.sourceUrl, r.round.question.sourceUrl);
  assert.equal(room.round.question.correctIndex, undefined, 'shared question remains sealed');
  const before = emptyProfile('private-receipt-epoch', r.createdAt);
  const after = reduceProfile(before, { type: 'room', epoch: before.epoch, at: room.serverNow, room });
  assert.equal(after.progression.xp, before.progression.xp, 'a private receipt awards no provisional XP');
  assert.equal(after.journal.rounds.length, 0, 'only finalized shared rounds enter the reward journal');
  const other = (await f.call(f.guest, 'state')).room;
  assert.equal(other.round.personalReceipt, null);
  assert.equal(other.round.receipts, null);
  assert.equal(other.round.result, null);
  assert.deepEqual(other.completedRounds, []);
  for (const key of ['correctIndex', 'explanation', 'sourceUrl', 'sourceLabel', 'choice', 'correct'])
    assert.ok(!JSON.stringify(other).includes(`"${key}":`), `unanswered peer has no ${key}`);
  f.setTime(r.round.issuedAt[1] + 1100);
  const end = (await f.answer(f.guest, r, 1100)).room;
  assert.equal(end.phase, 'complete', 'the second answer response already contains the result');
  assert.equal(end.winner, 1, 'the first wrong answer did not end the other player’s turn');
  assert.equal(end.round.personalReceipt, null);
  assert.deepEqual(end.round.receipts.map((a) => a.elapsedMs), [800, 1100]);
});

test('retry after immediate finalization is idempotent and replacement content is rejected', async () => {
  const f = await fixture({ opponent: 'bot' });
  const r = await f.prepare();
  f.setTime(r.round.issuedAt[0] + 600);
  const attempt = token();
  const first = (await f.answer(f.host, r, 600, r.round.question.correctIndex, attempt)).room;
  const again = (await f.answer(f.host, r, 600, r.round.question.correctIndex, attempt)).room;
  assert.equal(again.revision, first.revision);
  assert.deepEqual(again.scores, first.scores);
  assert.equal(again.completedRounds.length, 1);
  await assert.rejects(f.answer(f.host, r, 500, r.round.question.correctIndex, attempt), { code: 'attempt_conflict' });
  await assert.rejects(f.answer(f.host, r, 600), { code: 'already_answered' });
  assert.equal((await f.raw()).events.filter((e) => e.type === 'settled').length, 1);
});

test('guest-first feedback is equally private: the host sees no guest pick, correctness or source', async () => {
  const f = await fixture();
  const r = await f.prepare();
  f.setTime(r.round.issuedAt[1] + 700);
  const { room } = await f.answer(f.guest, r, 700);
  assert.equal(room.round.personalReceipt.correct, true);
  assert.equal(room.round.personalReceipt.choice, r.round.question.correctIndex);
  const host = (await f.call(f.host, 'state')).room;
  assert.equal(host.round.personalReceipt, null);
  assert.deepEqual(host.round.answerLocked, [false, true]);
  for (const key of ['correctIndex', 'explanation', 'sourceUrl', 'sourceLabel', 'choice', 'correct'])
    assert.ok(!JSON.stringify(host).includes(`"${key}":`), `unanswered host has no ${key}`);
  assert.deepEqual(host.completedRounds, []);
  assert.deepEqual(host.scores, [0, 0]);
  f.setTime(r.round.issuedAt[0] + 1000);
  assert.equal((await f.answer(f.host, r, 1000)).room.winner, 1);
});

test('concurrent human submissions settle once through revision conflicts', async () => {
  for (let i = 0; i < 12; i++) {
    const f = await fixture({ store: new MemoryRoomStore({ yieldIO: true }) });
    const r = await f.prepare();
    f.setTime(r.round.issuedAt[0] + 900);
    const replies = await Promise.all([f.answer(f.host, r, 800), f.answer(f.guest, r, 900)]);
    assert.ok(replies.some((x) => x.room.round.result), 'a successful answer response delivers the shared result');
    const done = await f.raw();
    assert.equal(done.phase, 'complete');
    assert.equal(done.completedRounds.length, 1);
    assert.equal(done.events.filter((e) => e.type === 'round_closed').length, 1);
    assert.equal(done.events.filter((e) => e.type === 'settled').length, 1);
    assert.equal(done.round.result.reason, 'close-result');
  }
});

test('pending human retains their deadline, then a missing answer times out once', async () => {
  const f = await fixture();
  const r = await f.prepare();
  const issued = r.round.issuedAt[0];
  f.setTime(issued + 500);
  assert.ok((await f.answer(f.host, r, 500)).room.round.personalReceipt);
  const closeAt = issued + 30_000 + RULES.minTransportMs + RULES.settlementBufferMs;
  f.setTime(closeAt - 1);
  assert.equal((await f.call(f.host, 'state')).room.round.result, null);
  f.setTime(closeAt);
  const end = (await f.call(f.host, 'state')).room;
  assert.equal(end.phase, 'complete');
  assert.equal(end.winner, 0);
  assert.equal(end.round.receipts[1], null);
  await assert.rejects(f.answer(f.guest, r, 29_000), { code: 'round_closed' });
  assert.equal((await f.raw()).completedRounds.length, 1);
});

test('invalid timing never reveals private correctness or rewards a bot win', async () => {
  for (const opponent of ['friend', 'bot']) {
    const f = await fixture({ opponent });
    const r = await f.prepare();
    f.setTime(r.round.issuedAt[0] + 4000);
    const { room } = await f.answer(f.host, r, 200);
    assert.equal(room.round.personalReceipt, null);
    assert.deepEqual(room.scores, [0, 0]);
    if (opponent === 'bot') assert.equal(room.reason, 'timing-inconsistent');
    else {
      assert.equal(room.round.question.correctIndex, undefined);
      const done = (await f.answer(f.guest, r, 3900)).room;
      assert.equal(done.reason, 'timing-inconsistent');
    }
  }
});

test('leave after private feedback cancels the match without committing a provisional result', async () => {
  const f = await fixture();
  const r = await f.prepare();
  f.setTime(r.round.issuedAt[0] + 500);
  await f.answer(f.host, r, 500);
  const { room } = await f.call(f.guest, 'leave');
  assert.equal(room.reason, 'player-left');
  assert.equal(room.round.result, null);
  assert.equal(room.round.personalReceipt, null);
  assert.deepEqual(room.scores, [0, 0]);
  assert.deepEqual(room.completedRounds, []);
  f.setTime(r.round.issuedAt[0] + 40_000);
  assert.equal((await f.call(f.host, 'state')).room.reason, 'player-left');
});

test('a leave racing post-commit finalization wins its revision without being overwritten', async () => {
  const f = await fixture({ opponent: 'bot' });
  const r = await f.prepare();
  const compareSwap = f.store.compareSwap.bind(f.store);
  let race = true;
  f.store.compareSwap = async (id, revision, room) => {
    if (race && room.round?.result) {
      race = false;
      const latest = JSON.parse((await f.store.read(id)).state);
      settleMatch(latest, null, 'player-left', r.round.issuedAt[0] + 500);
      await compareSwap(id, revision, latest);
    }
    return compareSwap(id, revision, room);
  };
  f.setTime(r.round.issuedAt[0] + 500);
  const { room } = await f.answer(f.host, r, 500);
  assert.equal(room.reason, 'player-left');
  assert.equal(room.round.result, null);
  assert.deepEqual(room.scores, [0, 0]);
  assert.equal(room.completedRounds.length, 0);
});

test('D1 also seals the attempt before same-response finalization and returns one settled result', async (t) => {
  const db = new LocalD1();
  t.after(() => db.close());
  const f = await fixture({ opponent: 'bot', store: new D1RoomStore(db) });
  const r = await f.prepare();
  f.setTime(r.round.issuedAt[0] + 600);
  const { room } = await f.answer(f.host, r, 600);
  assert.equal(room.phase, 'complete');
  assert.equal(room.round.receipts[0].serverElapsedMs, 600);
  assert.equal(room.round.receipts[0].timingOK, true);
  assert.equal(room.completedRounds.length, 1);
  assert.deepEqual(room.staked, [false, false], 'free bot practice never stakes coins');
  assert.equal(room.escrow, 0);
  assert.deepEqual(room.balances, [0, 0]);
});

test('immediate result uses the sealed receipt timing verdict, never the optimistic pre-write answer', async () => {
  const f = await fixture({ opponent: 'bot' });
  const r = await f.prepare();
  const commit = f.store.commitAttempt.bind(f.store);
  f.store.commitAttempt = (id, rev, room, seat, options) =>
    commit(id, rev, room, seat, { ...options, now: options.now + 1000 });
  f.setTime(r.round.issuedAt[0] + 500);
  const { room } = await f.answer(f.host, r, 500);
  assert.equal(room.round.receipts[0].elapsedMs, 500);
  assert.equal(room.round.receipts[0].serverElapsedMs, 1500);
  assert.equal(room.round.receipts[0].timingOK, false, 'durable stamp overrides optimistic valid timing');
  assert.equal(room.reason, 'timing-inconsistent');
  assert.deepEqual(room.scores, [0, 0]);
});

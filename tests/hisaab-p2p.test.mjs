/**
 * HISAAB DO — Duel a Friend with no server (editions/hisaab/p2p), over the in-memory transport.
 *
 * The host runs the real duel service; the guest talks to it through the transport. These tests pin
 * that the verdicts are the engine's own (lib/server/room-engine.mjs roundVerdict) including the
 * 150 ms draw band and the timing checks, that both browsers deal the same deck from the shared seed,
 * that the handshake refuses mismatched builds, and that a leave settles the room. Pass & Play (one
 * device, untimed) is covered at the end.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('../editions/hisaab/node-aliases.mjs', import.meta.url);
const p2p = await import('../editions/hisaab/p2p/index.mjs');
const { roundVerdict, matchWinner, RULES, MODE_ROUNDS } = await import('../lib/server/room-engine.mjs');
const { createDuelController } = await import('../editions/hisaab/engine/duel-controller.mjs');
const { QUESTIONS } = await import('../editions/hisaab/server/bank.mjs');

const settle = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

/** A host and a guest on a fresh memory pair, the host on a virtual clock the test moves. */
async function pair({ mode = 'gauntlet', code = p2p.makeRoomCode(), config = {} } = {}) {
  const clock = { t: 1_800_000_000_000 };
  const [a, b] = p2p.createMemoryPair();
  const host = p2p.createP2PHost({ transport: a, code, name: 'Asha', config: { mode, ...config }, clock: () => clock.t });
  const guest = p2p.createP2PGuest({ transport: b, code, name: 'Bilal', timeoutMs: 2000 });
  const created = await host.start();
  const joined = await guest.join();
  return { clock, host, guest, created, joined, code, transports: [a, b] };
}

/** One round: both ready, the countdown passes, both reveal, both answer after the given times. */
async function playRound(ctx, { host: [hostCorrect, hostMs], guest: [guestCorrect, guestMs] }) {
  const { clock, host, guest } = ctx;
  let state = (await host.request({ action: 'state' })).room;
  const roundId = state.round?.id ?? null;
  await host.request({ action: 'ready', roundId, rttMs: 0, jitterMs: 0 });
  await guest.request({ action: 'ready', roundId, rttMs: 0, jitterMs: 0 });
  state = (await host.request({ action: 'state' })).room;
  assert.equal(state.phase, 'scheduled');
  clock.t = state.round.scheduledAt;
  await host.request({ action: 'reveal', roundId: state.round.id });
  const g = (await guest.request({ action: 'reveal', roundId: state.round.id })).room;
  assert.ok(guest.verify(g), 'the host dealt what the shared seed says');
  const key = guest.expectedDeck(g.config)[g.roundIndex].correctIndex;
  const pick = (correct) => (correct ? key : (key + 1) % 4);
  const issued = clock.t;
  // Receipts land a little after each browser's own reveal-to-input time, inside the transport grace.
  const answers = [
    { seat: 'host', at: issued + hostMs + 20, body: { choice: pick(hostCorrect), elapsedMs: hostMs } },
    { seat: 'guest', at: issued + guestMs + 40, body: { choice: pick(guestCorrect), elapsedMs: guestMs } },
  ].sort((x, y) => x.at - y.at);
  for (const answer of answers) {
    clock.t = answer.at;
    const session = answer.seat === 'host' ? host : guest;
    await session.request({ action: 'answer', roundId: g.round.id, attemptId: `${answer.seat}-attempt-${g.round.id}`.replace(/[^A-Za-z0-9_-]/g, '_'), ...answer.body });
  }
  const after = (await guest.request({ action: 'state' })).room;
  const round = after.completedRounds.find((r) => r.id === g.round.id);
  assert.ok(round, 'the round closed as soon as both answers were in');
  return { round, room: after };
}

test('room codes: 8 unambiguous characters, normalised from typed input, keys derived identically', async () => {
  const code = p2p.makeRoomCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(p2p.normalizeCode(code.toLowerCase().replace('-', ' ')), code);
  assert.equal(p2p.normalizeCode('ABCD-EFG'), null, 'too short');
  assert.equal(p2p.normalizeCode('ABCD-EFG0'), null, '0 is not in the alphabet');
  const [k1, k2] = await Promise.all([p2p.roomKeys(code), p2p.roomKeys(code.toLowerCase())]);
  assert.deepEqual(k1, k2);
  assert.match(k1.roomId, /^[a-f0-9]{32}$/);
  assert.match(k1.invite, /^[A-Za-z0-9_-]{32,64}$/);
  assert.notDeepEqual(await p2p.roomKeys('ABCD-EFGJ'), k1);
});

test('the shared seed deals the same deck on both browsers, out of the edition bank', async () => {
  const config = { mode: 'gauntlet' };
  const [k1, k2] = await Promise.all([p2p.roomKeys('HJKM-NPQR'), p2p.roomKeys('hjkm npqr')]);
  assert.equal(k1.seed, k2.seed, 'both browsers derive the same seed from the code');
  assert.deepEqual(p2p.dealFromSeed(k1.seed, config), p2p.dealFromSeed(k2.seed, config));
  const one = p2p.dealFromSeed('HJKM-NPQR', config);
  const two = p2p.dealFromSeed('hjkm npqr', config);
  assert.deepEqual(one, two);
  assert.equal(one.length, MODE_ROUNDS.gauntlet);
  const ids = new Set(QUESTIONS.map((q) => q.id));
  assert.ok(one.every((q) => ids.has(q.id) && q.domain === 'civics'));
  assert.notDeepEqual(p2p.dealFromSeed('HJKM-NPQS', config).map((q) => q.id + q.options.join()), one.map((q) => q.id + q.options.join()));
});

test('host and guest pair, and the guest takes seat 1 of a free friend room', async () => {
  const ctx = await pair({ mode: 'quick' });
  assert.equal(ctx.created.room.seat, 0);
  assert.equal(ctx.joined.room.seat, 1);
  assert.deepEqual(ctx.joined.room.players.map((p) => p.name), ['Asha', 'Bilal']);
  assert.equal(ctx.joined.room.config.opponent, 'friend');
  assert.equal(ctx.joined.room.config.stake, 0);
  assert.equal(ctx.joined.room.config.duration, 30, 'the 30 s HISAAB clock makes every stopwatch XP band reachable');
  const clock = await ctx.guest.request({ action: 'clock' });
  assert.equal(clock.serverNow, ctx.clock.t, 'the guest calibrates against the host clock');
  await ctx.host.close();
  await ctx.guest.close();
});

test('the verdicts are the engine rules: correctness first, then speed, 150 ms is a draw', async () => {
  const ctx = await pair({ mode: 'gauntlet' });
  const cases = [
    { host: [true, 1200], guest: [true, 1400] }, // both right, 200 ms apart → faster wins
    { host: [true, 2000], guest: [true, 2150] }, // exactly 150 ms → draw
    { host: [true, 900], guest: [false, 800] }, // only one right → that one, however slow
    { host: [false, 700], guest: [false, 3000] }, // neither → no point
    { host: [true, 4100], guest: [true, 1300] }, // guest faster by 2.8 s → guest
  ];
  const scores = [0, 0];
  for (const c of cases) {
    const { round, room } = await playRound(ctx, c);
    const expected = roundVerdict([
      { correct: c.host[0], elapsedMs: c.host[1] },
      { correct: c.guest[0], elapsedMs: c.guest[1] },
    ]);
    assert.equal(round.result.winner, expected.winner, JSON.stringify(c));
    assert.equal(round.result.reason, expected.reason, JSON.stringify(c));
    assert.equal(round.result.tieMs, RULES.tieMs);
    assert.deepEqual(
      round.receipts.map((r) => r.elapsedMs),
      [c.host[1], c.guest[1]],
      'each browser’s own reveal-to-input time is what was judged',
    );
    if (expected.winner !== null) scores[expected.winner] += 1;
    assert.deepEqual(room.scores, scores);
  }
  const final = (await ctx.host.request({ action: 'state' })).room;
  assert.equal(final.phase, 'complete');
  assert.equal(final.winner, matchWinner(scores));
  // The band's edge, as the engine draws it: 150 ms apart is a draw, 151 ms is not.
  assert.equal(roundVerdict([{ correct: true, elapsedMs: 1000 }, { correct: true, elapsedMs: 1150 }]).reason, 'close-result');
  assert.equal(roundVerdict([{ correct: true, elapsedMs: 1000 }, { correct: true, elapsedMs: 1151 }]).winner, 0);
  await ctx.host.close();
  await ctx.guest.close();
});

test('the engine’s timing check still applies: a forged-short time outside the grace cancels the match', async () => {
  const ctx = await pair({ mode: 'quick' });
  const { clock, host, guest } = ctx;
  await host.request({ action: 'ready', roundId: null });
  await guest.request({ action: 'ready', roundId: null });
  const state = (await host.request({ action: 'state' })).room;
  clock.t = state.round.scheduledAt;
  await host.request({ action: 'reveal', roundId: state.round.id });
  await guest.request({ action: 'reveal', roundId: state.round.id });
  // Claims 400 ms, arrives 4 s after the reveal: residual 3.6 s, far past the 500 ms minimum grace.
  clock.t += 4000;
  await guest.request({ action: 'answer', roundId: state.round.id, attemptId: 'forged-attempt-000001', choice: 0, elapsedMs: 400 });
  clock.t += 100;
  await host.request({ action: 'answer', roundId: state.round.id, attemptId: 'honest-attempt-000001', choice: 0, elapsedMs: 4000 });
  const done = (await guest.request({ action: 'state' })).room;
  assert.equal(done.reason, 'timing-inconsistent');
  assert.equal(done.winner, null);
  await host.close();
  await guest.close();
});

test('wire projections keep first-answer feedback private in both seating orders and immediately publish the second', async () => {
  for (const firstSeat of [0, 1]) {
    const ctx = await pair({ mode: 'quick' });
    const { clock, host, guest } = ctx;
    await host.request({ action: 'ready', roundId: null });
    await guest.request({ action: 'ready', roundId: null });
    const state = (await host.request({ action: 'state' })).room;
    clock.t = state.round.scheduledAt;
    await host.request({ action: 'reveal', roundId: state.round.id });
    await guest.request({ action: 'reveal', roundId: state.round.id });
    const key = guest.expectedDeck(state.config)[0].correctIndex;
    const sessions = [host, guest];
    clock.t += 600;
    const answered = (await sessions[firstSeat].request({ action: 'answer', roundId: state.round.id,
      attemptId: 'first-wire-attempt-00001', elapsedMs: 600, choice: key })).room;
    assert.equal(answered.round.personalReceipt.correct, true);
    const unanswered = (await sessions[1 - firstSeat].request({ action: 'state' })).room;
    assert.equal(unanswered.round.personalReceipt, null);
    assert.equal(unanswered.round.receipts, null);
    assert.equal(unanswered.round.result, null);
    for (const k of ['correctIndex', 'choice', 'correct', 'explanation', 'sourceUrl', 'sourceLabel'])
      assert.ok(!JSON.stringify(unanswered).includes(`"${k}":`), `seat ${1 - firstSeat} has no ${k}`);
    clock.t += 400;
    const final = (await sessions[1 - firstSeat].request({ action: 'answer', roundId: state.round.id,
      attemptId: 'second-wire-attempt-0001', elapsedMs: 1000, choice: key })).room;
    assert.equal(final.phase, 'complete', 'answer response itself carries the shared final result');
    assert.equal(final.winner, firstSeat);
    assert.equal(final.round.personalReceipt, null);
    await host.close();
    await guest.close();
  }
});

test('protocol 3 refuses version 2 clients that cannot present private answer feedback', async () => {
  assert.equal(p2p.P2P_PROTOCOL, 'hisaab-duel/3');
  const [a, b] = p2p.createMemoryPair();
  const host = p2p.createP2PHost({ transport: a, code: 'ABCD-EFGH', name: 'Asha' });
  await host.start();
  const failed = new Promise((resolve) => host.onError(resolve));
  b.send({ t: 'hello', protocol: 'hisaab-duel/2', bank: p2p.bankFingerprint(), role: 'guest' });
  assert.equal((await failed).code, 'p2p_mismatch');
  await host.close();
});

test('the guest checks the deal: a question that is not the seeded card fails verify()', async () => {
  const ctx = await pair({ mode: 'quick' });
  const room = structuredClone(ctx.joined.room);
  assert.ok(ctx.guest.verify(room), 'nothing revealed yet is trivially consistent');
  const expected = ctx.guest.expectedDeck(room.config)[0];
  room.round = { id: 'x', question: { question: expected.question, options: [...expected.options] } };
  assert.ok(ctx.guest.verify(room));
  room.round.question.options = [...expected.options].reverse();
  assert.equal(ctx.guest.verify(room), false, 'a reshuffled option order is caught');
  room.round.question = { question: 'Some other question?', options: expected.options };
  assert.equal(ctx.guest.verify(room), false);
  await ctx.host.close();
  await ctx.guest.close();
});

test('only guest actions cross the wire, and only the seated guest may act', async () => {
  const ctx = await pair({ mode: 'quick' });
  const [, b] = ctx.transports;
  const reply = (id) =>
    new Promise((resolve) => {
      const off = b.onMessage((m) => {
        if (m?.t === 'res' && m.id === id) {
          off();
          resolve(m);
        }
      });
    });
  const create = reply(9001);
  b.send({ t: 'req', id: 9001, body: { action: 'create', token: 'x'.repeat(40) } });
  assert.equal((await create).error.code, 'invalid_request');
  const addBot = reply(9002);
  b.send({ t: 'req', id: 9002, body: { action: 'add_bot', token: ctx.guest.token } });
  assert.equal((await addBot).error.code, 'invalid_request');
  const intruder = reply(9003);
  b.send({ t: 'req', id: 9003, body: { action: 'state', token: 'y'.repeat(40) } });
  assert.equal((await intruder).error.code, 'room_full');
  await ctx.host.close();
  await ctx.guest.close();
});

test('the handshake refuses a mismatched build, and a guest with no host times out honestly', async () => {
  const [a, b] = p2p.createMemoryPair();
  const host = p2p.createP2PHost({ transport: a, code: 'ABCD-EFGH', name: 'Asha' });
  await host.start();
  const failed = new Promise((resolve) => host.onError(resolve));
  b.send({ t: 'hello', protocol: p2p.P2P_PROTOCOL, bank: 'not-this-bank', role: 'guest' });
  const error = await failed;
  assert.equal(error.code, 'p2p_mismatch');
  await assert.rejects(host.request({ action: 'state' }), { code: 'p2p_mismatch' });
  await host.close();

  const [c] = p2p.createMemoryPair();
  const lonely = p2p.createP2PGuest({ transport: c, code: 'ABCD-EFGH', name: 'Bilal', timeoutMs: 60 });
  await assert.rejects(lonely.join(), { code: 'p2p_timeout' });
  await lonely.close();
});

test('a guest who disconnects mid-match settles the room as a leave, and the host hears it', async () => {
  const ctx = await pair({ mode: 'trilogy' });
  await ctx.host.request({ action: 'ready', roundId: null });
  await ctx.guest.request({ action: 'ready', roundId: null });
  const left = new Promise((resolve) => ctx.host.onPeer((event) => event === 'leave' && resolve()));
  await ctx.transports[1].close();
  await left;
  await settle(10);
  const room = (await ctx.host.request({ action: 'state' })).room;
  assert.equal(room.phase, 'cancelled');
  assert.equal(room.reason, 'player-left');
  await ctx.host.close();
});

test('end to end in real time: two duel controllers play a Quick Draw over the transport', async () => {
  const code = p2p.makeRoomCode();
  const [a, b] = p2p.createMemoryPair({ latencyMs: 15 });
  const host = p2p.createP2PHost({ transport: a, code, name: 'Asha', config: { mode: 'quick' } });
  const guest = p2p.createP2PGuest({ transport: b, code, name: 'Bilal' });
  const hc = createDuelController({ request: host.request, pollMs: { active: 100, waiting: 200, hidden: 200 } });
  const gc = createDuelController({ request: guest.request, pollMs: { active: 100, waiting: 200, hidden: 200 } });
  host.onPoke(() => void hc.refresh());
  guest.onPoke(() => void gc.refresh());
  hc.adopt(await host.start());
  gc.adopt(await guest.join());
  await hc.calibrate(3);
  await gc.calibrate(3);
  assert.ok(gc.snapshot().clock.rttMs >= 20, 'the guest measured the transport round trip');
  await hc.ready();
  await gc.ready();
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('the match did not finish')), 9000);
    const timer = setInterval(() => {
      for (const [c, right] of [
        [hc, true],
        [gc, false],
      ]) {
        const r = c.room;
        if (r?.round?.question && !r.round.result && c.snapshot().shownRoundId !== r.round.id) {
          c.markShown();
          const key = guest.expectedDeck(r.config)[r.roundIndex].correctIndex;
          setTimeout(() => void c.answer(right ? key : (key + 1) % 4), 120);
        }
      }
      if (hc.room?.settled && gc.room?.settled) {
        clearTimeout(deadline);
        clearInterval(timer);
        resolve();
      }
    }, 20);
  });
  assert.equal(gc.room.phase, 'complete');
  assert.equal(gc.room.winner, 0, 'the host answered correctly, the guest did not');
  assert.equal(gc.room.round.result.reason, 'correct');
  assert.ok(gc.room.round.receipts.every((r) => r && r.elapsedMs >= 100 && r.elapsedMs < 2000));
  assert.ok(guest.verify(gc.room));
  hc.dispose();
  gc.dispose();
  await host.close();
  await guest.close();
});

test('the BroadcastChannel transport pairs two tabs of one code and reports a leave', async () => {
  const one = p2p.createBroadcastTransport('ABCD-EFGH');
  const joined = new Promise((resolve) => one.onPeer((e) => e === 'join' && resolve()));
  const two = p2p.createBroadcastTransport('abcd-efgh');
  await joined;
  const got = new Promise((resolve) => two.onMessage(resolve));
  one.send({ t: 'poke', n: 1 });
  assert.deepEqual(await got, { t: 'poke', n: 1 });
  const left = new Promise((resolve) => one.onPeer((e) => e === 'leave' && resolve()));
  two.close();
  await left;
  one.close();
});

const sha256 = async (text) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
const b64u = (bytes) => Buffer.from(bytes).toString('base64url');

test('the WebRTC rendezvous never carries the short code: topic, password and room keys come from the stretched secret', async () => {
  const code = 'HJKM-NPQR';
  // The stretch, recomputed independently: PBKDF2-SHA-256 over the canonical code, OWASP-sized.
  assert.ok(p2p.P2P_KDF.iterations >= 600_000, 'a guess costs at least 600k PBKDF2 rounds');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(p2p.P2P_KDF.salt), iterations: p2p.P2P_KDF.iterations },
    material,
    256,
  );
  const secret = b64u(new Uint8Array(bits));
  assert.equal(await p2p.roomSecret('hjkm npqr'), secret, 'typed input stretches to the same secret');

  const keys = await p2p.roomKeys(code);
  const hexOf = async (label) => Buffer.from(await sha256(`${p2p.P2P_PROTOCOL}:${label}:${secret}`)).toString('hex');
  assert.equal(keys.topic, `duel-${(await hexOf('topic')).slice(0, 40)}`);
  assert.equal(keys.password, b64u(await sha256(`${p2p.P2P_PROTOCOL}:password:${secret}`)));
  assert.equal(keys.invite, b64u(await sha256(`${p2p.P2P_PROTOCOL}:invite:${secret}`)));
  assert.equal(keys.roomId, (await hexOf('room')).slice(0, 32));
  assert.equal(keys.seed, b64u(await sha256(`${p2p.P2P_PROTOCOL}:deal:${secret}`)));
  // Before the fix the invite was SHA-256 of the code itself: one fast hash from a 40-bit guess.
  assert.notEqual(keys.invite, b64u(await sha256(`${p2p.P2P_PROTOCOL}:invite:${code}`)));

  // What trystero is handed (and publishes a SHA-1 of) is the derived topic and password, never the code.
  const seen = [];
  const joinRoom = (config, roomId) => {
    seen.push({ config, roomId });
    return { makeAction: () => ({ send: async () => {} }), leave: async () => {} };
  };
  const transport = await p2p.createTrysteroTransport(code.toLowerCase(), { joinRoom });
  await transport.close();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].roomId, keys.topic);
  assert.equal(seen[0].config.password, keys.password);
  assert.equal(seen[0].config.appId, p2p.TRYSTERO_APP_ID);
  for (const value of [seen[0].roomId, seen[0].config.password])
    assert.ok(!/HJKM|NPQR/i.test(value) && value !== `duel-${code}`, `${value} does not carry the code`);
  await assert.rejects(p2p.createTrysteroTransport('nope', { joinRoom }), { code: 'invalid_code' });
});

test('rematch rooms come from the first room’s secret, agree on both sides and pair without a second stretch', async () => {
  const first = p2p.makeRoomCode();
  const [one, again, two] = await Promise.all([
    p2p.rematchCode(first, 1),
    p2p.rematchCode(first.toLowerCase(), 1),
    p2p.rematchCode(first, 2),
  ]);
  assert.equal(one, again, 'both browsers derive the same next room');
  assert.notEqual(one, two);
  assert.notEqual(one, first);
  assert.match(one, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const secret = await p2p.roomSecret(first);
  const next = b64u(await sha256(`${p2p.P2P_PROTOCOL}:rematch:1:${secret}`));
  assert.equal(one, p2p.makeRoomCode(await sha256(`${p2p.P2P_PROTOCOL}:rematch-code:${next}`)), 'from the secret');
  assert.notEqual(one, p2p.makeRoomCode(await sha256(`hisaab-rematch:${first}:1`)), 'not from the short code');
  assert.equal(await p2p.roomSecret(one), next, 'the rematch room’s secret is derived, not stretched from its code');
  await assert.rejects(p2p.rematchCode(first, 0), { code: 'invalid_request' });

  const ctx = await pair({ mode: 'quick', code: one });
  assert.equal(ctx.joined.room.seat, 1, 'the rematch room pairs');
  const { round } = await playRound(ctx, { host: [true, 900], guest: [false, 800] });
  assert.equal(round.result.winner, 0);
  await ctx.host.close();
  await ctx.guest.close();
});

test('the bank fingerprint covers content: the same ids with an edited question or answer key refuse to pair', async () => {
  const base = QUESTIONS.slice(0, 60);
  const fp = p2p.bankFingerprint(base);
  assert.equal(
    p2p.bankFingerprint(base.map((q) => Object.fromEntries(Object.entries(q).reverse()))),
    fp,
    'key order is not content',
  );
  const q = base[3];
  for (const patch of [
    { question: `${q.question} (edited)` },
    { correctIndex: (q.correctIndex + 1) % 4 },
    { options: [...q.options].reverse() },
    { explanation: `${q.explanation} Edited.` },
  ]) {
    const other = base.map((x, i) => (i === 3 ? { ...x, ...patch } : x));
    assert.deepEqual(other.map((x) => x.id), base.map((x) => x.id), 'same ids, same count');
    assert.notEqual(p2p.bankFingerprint(other), fp, `an edit to ${Object.keys(patch)[0]} changes the fingerprint`);
  }
  // The handshake: a guest on a build whose bank differs only in one item's text and key is refused.
  const edited = QUESTIONS.map((x, i) => (i === 3 ? { ...x, question: `${x.question} (edited)`, correctIndex: (x.correctIndex + 1) % 4 } : x));
  assert.notEqual(p2p.bankFingerprint(edited), p2p.bankFingerprint());
  const [a, b] = p2p.createMemoryPair();
  const host = p2p.createP2PHost({ transport: a, code: 'ABCD-EFGH', name: 'Asha' });
  await host.start();
  const failed = new Promise((resolve) => host.onError(resolve));
  b.send({ t: 'hello', protocol: p2p.P2P_PROTOCOL, bank: p2p.bankFingerprint(edited), role: 'guest' });
  assert.equal((await failed).code, 'p2p_mismatch');
  await host.close();
});

test('the trust label is on the protocol, where every screen can quote it', () => {
  assert.match(p2p.P2P_TRUST.label, /trust/i);
  assert.match(p2p.P2P_TRUST.body, /cheat/);
  assert.match(p2p.P2P_TRUST.code, /IP/, 'what a recovered code would expose is said, not implied away');
});

test('pass & play: one phone, untimed, engine verdicts with speed taken out', () => {
  let rng = 0.123;
  const next = () => (rng = (rng * 9301 + 49297) % 233280) / 233280;
  let s = p2p.startPassAndPlay({ mode: 'trilogy', names: ['Asha', ' '], rng: next });
  assert.deepEqual(s.names, ['Asha', 'Player 2']);
  assert.equal(p2p.passAndPlayView(s).question, null, 'nothing shows while the phone is handed over');
  const play = (right0, right1) => {
    const key = s.deck[s.roundIndex].correctIndex;
    s = p2p.reducePassAndPlay(s, { type: 'ready' });
    assert.equal(p2p.passAndPlayView(s).question.correctIndex, undefined, 'no key before the reveal');
    s = p2p.reducePassAndPlay(s, { type: 'answer', choice: right0 ? key : (key + 1) % 4 });
    assert.deepEqual(p2p.passAndPlayView(s).answers, [{ locked: true }, null], 'the first pick stays hidden');
    s = p2p.reducePassAndPlay(s, { type: 'ready' });
    s = p2p.reducePassAndPlay(s, { type: 'answer', choice: right1 ? key : (key + 2) % 4 });
    return p2p.passAndPlayView(s);
  };
  assert.equal(play(true, true).result.reason, 'both-correct');
  assert.deepEqual(s.scores, [0, 0]);
  s = p2p.reducePassAndPlay(s, { type: 'next' });
  assert.equal(play(false, true).result.winner, 1);
  s = p2p.reducePassAndPlay(s, { type: 'next' });
  const third = play(false, true);
  assert.equal(third.result.reason, 'correct');
  assert.deepEqual(s.scores, [0, 2]);
  s = p2p.reducePassAndPlay(s, { type: 'next' });
  assert.equal(s.phase, 'complete', 'Triple Threat ends at two wins');
  assert.equal(p2p.passAndPlayView(s).winner, 1);
  assert.equal(p2p.reducePassAndPlay(s, { type: 'answer', choice: 0 }), s, 'a finished match ignores input');
});

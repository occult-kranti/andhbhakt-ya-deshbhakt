/**
 * Bounded live API check. Creates exactly three disposable HISAAB_QA_ identities,
 * plays private friend rooms only, and revokes only its own tokens in finally.
 * No public queue entry, tournament result injection, or broad data cleanup.
 * Usage: node scripts/hisaab-online-check.mjs <outDir> <Edge Function URL>
 * Optional: HISAAB_API_URL, HISAAB_API_KEY (publishable key only), HISAAB_REGION.
 * Reports contain neither credentials nor private invite codes.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';

const out = resolve(process.argv[2] || '/tmp/hisaab-online-check');
const api = process.argv[3] || process.env.HISAAB_API_URL;
if (!api || !/^https?:\/\//.test(api)) throw new Error('Supply the explicit HISAAB game API URL.');
const report = { startedAt: new Date().toISOString(), api, kind: 'private-live-api', identities: [], checks: [], requests: [], cleanup: [] };
mkdirSync(out, { recursive: true });
const save = () => writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
const pause = ms => new Promise(r => setTimeout(r, ms));
const sessions = [];
const seed = Date.now().toString(36);
let activeRoom = null;

async function request(session, action, payload = {}, { rawBody, method = 'POST' } = {}) {
  const began = performance.now();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.token) headers['x-hisaab-session'] = session.token;
  if (process.env.HISAAB_API_KEY) headers.apikey = process.env.HISAAB_API_KEY;
  if (process.env.HISAAB_REGION) headers['x-region'] = process.env.HISAAB_REGION;
  const response = await fetch(api, { method, headers, body: method === 'POST' ? (rawBody ?? JSON.stringify({ action, ...payload })) : undefined, signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  report.requests.push({ action, status: response.status, ms: Math.round(performance.now() - began), code: body.error?.code || null, region: response.headers.get('x-sb-edge-region') });
  save();
  return { body, status: response.status };
}
async function call(session, action, payload) {
  const { body, status } = await request(session, action, payload);
  assert.ok(body.ok === true && status === 200, `${action} failed (${status}, ${body.error?.code || 'unknown'}).`);
  return body;
}
async function check(name, run) {
  const began = performance.now();
  try {
    const evidence = await run();
    report.checks.push({ name, ok: true, ms: Math.round(performance.now() - began), evidence });
    console.log(`PASS ${name}`);
  } catch (e) {
    report.checks.push({ name, ok: false, ms: Math.round(performance.now() - began), error: e.message });
    throw e;
  } finally { save(); }
}
function sealed(match) {
  assert.equal(match.receipt, null);
  assert.equal(match.result, null);
  for (const key of ['correctIndex', 'explanation', 'sourceUrl', 'deck', 'tokenHash', 'token_hash']) {
    assert.ok(!JSON.stringify(match).includes(`"${key}":`), `Unanswered projection contains ${key}.`);
  }
}
async function current(session) { return (await call(session, 'snapshot', { roomId: activeRoom })).match; }
async function openRound(host, guest, action) {
  const replies = await Promise.all([call(host, action, { roomId: activeRoom }), call(guest, action, { roomId: activeRoom })]);
  // The acknowledgement that opens the round proves its countdown projection.
  // A later snapshot can correctly arrive after that short countdown on a slow
  // connection; do not mistake transport delay for an early question leak.
  const round = replies.map(x => x.match).find(r => r.phase === 'countdown');
  assert.ok(round, 'One ready acknowledgement starts the countdown.');
  assert.equal(round.question, null, 'No prompt during countdown.');
  const wait = Math.max(0, round.startsAt - round.serverNow + 60);
  assert.ok(wait <= 3100, 'Countdown is bounded.');
  await pause(wait);
  const pair = await Promise.all([current(host), current(guest)]);
  for (const r of pair) { assert.equal(r.phase, 'question'); sealed(r); }
  assert.equal(pair[0].question.id, pair[1].question.id);
  assert.equal(pair[0].round, pair[1].round);
  return pair;
}

try {
  await check('HTTP and missing-token boundary', async () => {
    assert.equal((await request(null, 'profile')).status, 401);
    assert.equal((await request(null, 'profile', {}, { method: 'GET' })).status, 405);
    assert.equal((await request(null, 'profile', {}, { rawBody: '{' })).body.error.code, 'BAD_JSON');
    const oversized = await request(null, 'profile', { padding: 'x'.repeat(5000) });
    assert.equal(oversized.status, 413);
    assert.equal(oversized.body.error.code, 'TOO_LARGE');
    return { missingToken: 401, method: 405, malformedJson: 'BAD_JSON', oversizedBody: 413 };
  });
  await check('three independent disposable device identities', async () => {
    for (const suffix of ['A', 'B', 'C']) {
      const response = await call(null, 'session', { nickname: `HISAAB_QA_${seed}_${suffix}` });
      assert.match(response.token, /^[a-f0-9]{64}$/);
      sessions.push({ ...response.session, token: response.token });
      report.identities.push({ id: response.session.id, nickname: response.session.nickname });
    }
    assert.equal(new Set(sessions.map(s => s.id)).size, 3);
    return { count: 3, expiryDays: 30 };
  });
  const [host, guest, outsider] = sessions;
  await check('friend lobby access and outsider isolation', async () => {
    const made = await call(host, 'create'); activeRoom = made.match.id;
    assert.equal(made.match.mode, 'private');
    assert.equal(made.match.question, null);
    const joined = await call(guest, 'join', { code: made.match.code });
    assert.equal(joined.match.players.length, 2);
    for (const action of ['snapshot', 'ready', 'answer', 'leave']) {
      const denied = await request(outsider, action, { roomId: activeRoom, round: 1, choice: 0, requestId: crypto.randomUUID() });
      assert.equal(denied.body.error?.code, 'FORBIDDEN');
      assert.equal(denied.body.match, undefined);
    }
    assert.equal((await request(outsider, 'join', { code: made.match.code })).body.error?.code, 'ROOM_FULL');
    return { seats: 2, forbiddenActions: 4, thirdJoinRejected: true };
  });
  await check('private receipt, immutable release and forged timing rejection', async () => {
    const [h, g] = await openRound(host, guest, 'ready');
    const again = await current(host);
    assert.equal(again.startsAt, h.startsAt, 'Reconnect does not restart the stopwatch.');
    const requestId = crypto.randomUUID();
    await pause(200);
    const first = (await call(host, 'answer', { roomId: activeRoom, round: h.round, choice: 0, requestId, elapsedMs: 0, xp: 99999, score: 99999, playerId: outsider.id, correct: true })).match;
    assert.equal(first.phase, 'question');
    assert.ok(first.receipt.elapsedMs >= 150);
    assert.ok([0, 10, 20, 30].includes(first.receipt.xp));
    assert.equal(first.receipt.choice, 0);
    assert.equal(first.result, null);
    const other = await current(guest);
    sealed(other);
    assert.equal(other.players.find(p => p.id === host.id).score, g.players.find(p => p.id === host.id).score, 'Current correctness stays private.');
    const duplicates = await Promise.all(Array.from({ length: 4 }, () => call(host, 'answer', { roomId: activeRoom, round: h.round, choice: 0, requestId })));
    for (const d of duplicates) assert.deepEqual(d.match.receipt, first.receipt);
    const changed = (await call(host, 'answer', { roomId: activeRoom, round: h.round, choice: 3, requestId: crypto.randomUUID() })).match;
    assert.deepEqual(changed.receipt, first.receipt, 'First answer wins over changed body.');
    const second = (await call(guest, 'answer', { roomId: activeRoom, round: h.round, choice: first.receipt.correctIndex, requestId: crypto.randomUUID() })).match;
    assert.equal(second.phase, 'result');
    assert.equal(second.result.answers.length, 2);
    assert.ok(second.deadlineAt - second.serverNow > 0, 'Both-answer result is delivered before deadline.');
    const retry = (await call(host, 'answer', { roomId: activeRoom, round: h.round, choice: 0, requestId })).match;
    assert.deepEqual(retry.result, second.result);
    return { round: h.round, duplicateBurst: 4, serverElapsedMs: first.receipt.elapsedMs, immediateSharedResult: true };
  });
  await check('five-round game, concurrent answers and duplicate completion', async () => {
    const proofs = [];
    for (let round = 2; round <= 5; round++) {
      const [h] = await openRound(host, guest, 'next');
      assert.equal(h.round, round);
      const attempts = sessions.slice(0, 2).map((s, i) => ({ session: s, choice: i, requestId: crypto.randomUUID() }));
      const burst = await Promise.all(attempts.flatMap(a => Array.from({ length: 4 }, () => call(a.session, 'answer', { roomId: activeRoom, round, choice: a.choice, requestId: a.requestId }))));
      const [left, right] = await Promise.all([current(host), current(guest)]);
      assert.equal(left.phase, round === 5 ? 'finished' : 'result');
      assert.deepEqual(left.result, right.result);
      assert.equal(left.result.answers.length, 2);
      assert.deepEqual(left.players.map(p => p.score), right.players.map(p => p.score));
      for (const answer of left.result.answers) assert.ok(answer.elapsedMs >= 0 && answer.elapsedMs <= 30000);
      assert.ok(burst.some(x => x.match.result), 'At least one answer response already contains the shared result.');
      proofs.push({ round, simultaneousRequests: 8, receipts: left.result.answers.length, phase: left.phase });
    }
    return proofs;
  });
  await check('bounded snapshot burst, reconnect and private-board exclusion', async () => {
    const before = await call(host, 'profile');
    const rooms = await Promise.all(Array.from({ length: 8 }, (_, i) => current(sessions[i % 2])));
    assert.ok(rooms.every(r => r.phase === 'finished'));
    assert.equal(new Set(rooms.map(r => JSON.stringify(r.result))).size, 1);
    const after = await call(host, 'profile');
    assert.equal(before.session.onlineXp, after.session.onlineXp);
    const [daily, weekly, tournament] = await Promise.all([call(host, 'leaderboards', { period: 'daily' }), call(host, 'leaderboards', { period: 'weekly' }), call(host, 'tournaments')]);
    assert.equal(daily.self, null); assert.equal(weekly.self, null); assert.equal(tournament.standings.self, null);
    return { concurrentReads: 8, onlineXp: after.session.onlineXp, publicStanding: false };
  });
  await check('cloud circle privacy and personal group nickname', async () => {
    const made = await call(host, 'circles', { operation: 'create', kind: 'family', name: `HISAAB_QA_${seed}`, nickname: 'QA cousin' });
    const circle = made.circles[0];
    const joined = await call(guest, 'circles', { operation: 'join', code: circle.code, nickname: 'QA sibling' });
    assert.equal(joined.circles[0].nickname, 'QA sibling');
    assert.equal(joined.circles[0].members.length, 2);
    assert.deepEqual((await call(outsider, 'circles')).circles, []);
    const denied = await request(outsider, 'circles', { operation: 'rename', circleId: circle.id, nickname: 'Impostor' });
    assert.equal(denied.body.error?.code, 'FORBIDDEN');
    return { members: 2, outsiderExcluded: true, groupNickname: true };
  });
  await check('last circle member leave races safely with a new join', async () => {
    const made = await call(host, 'circles', { operation: 'create', kind: 'friends', name: `HISAAB_QA_race_${seed}`, nickname: 'QA host' });
    const circle = made.circles.find(c => c.name === `HISAAB_QA_race_${seed}`);
    assert.ok(circle);
    const [, joined] = await Promise.all([
      call(host, 'circles', { operation: 'leave', circleId: circle.id }),
      request(outsider, 'circles', { operation: 'join', code: circle.code, nickname: 'QA arriving' }),
    ]);
    const surviving = (await call(outsider, 'circles')).circles.find(c => c.id === circle.id);
    if (joined.body.ok) {
      assert.equal(surviving?.members.length, 1, 'An acknowledged join survives the leaving member.');
      assert.equal(surviving?.nickname, 'QA arriving');
    } else {
      assert.equal(joined.body.error?.code, 'CIRCLE_NOT_FOUND');
      assert.equal(surviving, undefined);
    }
    assert.ok(!(await call(host, 'circles')).circles.some(c => c.id === circle.id));
    return { joinAccepted: joined.body.ok === true, acknowledgedMembershipLost: false };
  });
  await check('quit makes a new private room non-playable', async () => {
    const made = await call(host, 'create'); activeRoom = made.match.id;
    await call(guest, 'join', { code: made.match.code });
    const left = await call(host, 'leave', { roomId: activeRoom });
    assert.equal(left.match.phase, 'cancelled');
    const reconnected = await current(guest);
    assert.equal(reconnected.phase, 'cancelled');
    assert.equal(reconnected.reason, 'player-left');
    return { reason: reconnected.reason, cancelled: true };
  });
} catch (error) {
  report.failure = error.message;
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const session of sessions) {
    try {
      const deleted = await call(session, 'deleteSession');
      assert.equal(deleted.deleted, true);
      const revoked = await request(session, 'profile');
      assert.equal(revoked.status, 401);
      report.cleanup.push({ id: session.id, revoked: true });
    } catch (error) {
      report.cleanup.push({ id: session.id, revoked: false, error: error.message });
      process.exitCode = 1;
    }
  }
  const successful = report.requests.filter(r => r.status === 200).map(r => r.ms).sort((a, b) => a - b);
  const quantile = fraction => successful[Math.min(successful.length - 1, Math.floor(successful.length * fraction))] ?? null;
  report.latency = { n: successful.length, p50Ms: quantile(0.5), p95Ms: quantile(0.95), maxMs: successful.at(-1) ?? null, scope: 'single test runner to deployed HTTP API; not multi-network fairness or a capacity benchmark' };
  report.actionCounts = report.requests.reduce((out, r) => ({ ...out, [r.action]: (out[r.action] || 0) + 1 }), {});
  report.completedAt = new Date().toISOString();
  save();
  console.log(JSON.stringify({ checks: report.checks.length, passed: report.checks.filter(x => x.ok).length, requests: report.requests.length, cleanup: report.cleanup, latency: report.latency }, null, 2));
}

/**
 * Transport/validation contract tests. These are deliberately not labelled a
 * database concurrency proof: authoritative room transitions run in Postgres.
 * scripts/hisaab-online-check.mjs exercises that deployed boundary separately.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVER_RULES, GameError, cleanNickname, validateInput,
  makeToken, hashToken, roundWinner, stopwatchXp,
} from '../editions/hisaab/server/core.mjs';

const roomId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const answer = () => ({ action: 'answer', roomId, round: 1, requestId, choice: 2 });

test('server stopwatch has exact 8 s and 15 s reward boundaries', () => {
  for (const [elapsedMs, expected] of [[0, 30], [7999, 30], [8000, 20], [14999, 20], [15000, 10], [30000, 10]]) {
    assert.equal(stopwatchXp(true, elapsedMs), expected, `correct at ${elapsedMs} ms`);
    assert.equal(stopwatchXp(false, elapsedMs), 0, `wrong at ${elapsedMs} ms`);
  }
  assert.equal(SERVER_RULES.roundMs, 30000);
});

test('correctness outranks speed and the 120 ms draw boundary is inclusive', () => {
  const receipt = (playerId, correct, elapsedMs) => ({ playerId, correct, elapsedMs });
  assert.equal(roundWinner([receipt('host', false, 100), receipt('guest', true, 29000)]), 'guest');
  assert.equal(roundWinner([receipt('host', false, 100), receipt('guest', false, 1000)]), null);
  assert.equal(roundWinner([receipt('host', true, 1000), receipt('guest', true, 1120)]), null);
  assert.equal(roundWinner([receipt('host', true, 1000), receipt('guest', true, 1121)]), 'host');
  assert.equal(roundWinner([receipt('host', true, 1121), receipt('guest', true, 1000)]), 'guest');
  assert.equal(roundWinner([]), null);
});

test('identity, correctness, timing, XP and score assertions are not forwarded from a client', () => {
  const forged = {
    ...answer(), sessionId: 'victim', playerId: 'victim', elapsedMs: 0,
    correct: true, correctIndex: 2, score: 9999, xp: 9999,
    serverNow: 1, tokenHash: 'another-session',
  };
  const checked = validateInput(forged);
  assert.deepEqual(checked, { action: 'answer', payload: { roomId, round: 1, requestId, choice: 2 } });
  assert.equal(forged.playerId, 'victim', 'validation does not mutate its input');
});

test('malformed or out-of-range answer actions fail before database dispatch', () => {
  for (const changed of [
    { choice: -1 }, { choice: 4 }, { choice: 0.5 }, { choice: '2' }, { choice: null },
    { round: 0 }, { round: 6 }, { round: 1.5 }, { round: '1' },
    { requestId: null }, { requestId: 'short' }, { requestId: 'g'.repeat(36) },
  ]) assert.throws(() => validateInput({ ...answer(), ...changed }), { code: 'BAD_ANSWER' });
  for (const action of ['snapshot', 'ready', 'answer', 'next', 'leave']) {
    assert.throws(() => validateInput({ ...answer(), action, roomId: null }), { code: 'BAD_ROOM' });
    assert.throws(() => validateInput({ ...answer(), action, roomId: 'not-a-room' }), { code: 'BAD_ROOM' });
  }
  for (const body of [null, false, 'answer', [], {}, { action: 'admin' }]) {
    assert.throws(() => validateInput(body), error => error instanceof GameError && error.code === 'BAD_ACTION');
  }
});

test('guest credentials use 256 random bits and only valid credentials are hashed', async () => {
  let requestedBytes = null;
  const deterministic = makeToken(bytes => {
    requestedBytes = bytes.length;
    bytes.forEach((_, i) => { bytes[i] = i; });
    return bytes;
  });
  assert.equal(requestedBytes, 32);
  assert.equal(deterministic, '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
  const token = makeToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  const hash = await hashToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(await hashToken(token), hash);
  for (const invalid of [undefined, '', 'a'.repeat(63), 'a'.repeat(65), 'z'.repeat(64)]) {
    await assert.rejects(hashToken(invalid), { code: 'UNAUTHORIZED', status: 401 });
  }
});

test('nicknames support Hindi, normalize whitespace and remove invisible control characters', () => {
  assert.equal(cleanNickname('  सवाल   पूछो  '), 'सवाल पूछो');
  assert.equal(cleanNickname('A\u200bsh\u0000a'), 'Asha');
  assert.equal(cleanNickname('Ａｓｈａ'), 'Asha');
  assert.equal(cleanNickname('🗞'.repeat(24)), '🗞'.repeat(24));
  for (const invalid of [null, {}, 'A', ' '.repeat(20), 'a'.repeat(25), '🗞'.repeat(25)]) {
    assert.throws(() => cleanNickname(invalid), { code: 'BAD_NICKNAME' });
  }
});

test('invite validation normalizes accepted codes without accepting arbitrary lookup strings', () => {
  assert.equal(validateInput({ action: 'join', code: ' ab12cd34 ' }).payload.code, 'AB12CD34');
  for (const invalid of ['', 'x'.repeat(12), 'AB12CD3', 'A'.repeat(17), "' OR true --"]) {
    assert.throws(() => validateInput({ action: 'join', code: invalid }), { code: 'BAD_CODE' });
  }
});

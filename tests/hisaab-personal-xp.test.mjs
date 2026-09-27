import test from 'node:test';
import assert from 'node:assert/strict';
import { personalXp } from '../editions/hisaab/engine/personal-xp.mjs';

test('personal progression adds cumulative online XP once, without modifying either source', () => {
  const session = Object.freeze({ id: 'player-a', onlineXp: 600 });
  for (let refresh = 0; refresh < 20; refresh++) assert.equal(personalXp(100, session), 700);
  assert.equal(personalXp(100, { ...session, onlineXp: 630 }), 730);
  assert.equal(session.onlineXp, 600);
});

test('forgetting/replacing an online identity removes only that identity’s online portion', () => {
  assert.equal(personalXp(100, { id: 'player-a', onlineXp: 600 }), 700);
  assert.equal(personalXp(100, null), 100);
  assert.equal(personalXp(100, { onlineXp: 600 }), 100);
  assert.equal(personalXp(100, { id: '', onlineXp: 600 }), 100);
  assert.equal(personalXp(100, { id: 'player-b', onlineXp: 30 }), 130);
});

test('malformed cumulative totals cannot create display progression', () => {
  for (const onlineXp of [-1, NaN, Infinity, '600', 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(personalXp(100, { id: 'player-a', onlineXp }), 100);
  assert.equal(personalXp(NaN, { id: 'player-a', onlineXp: 600 }), 600);
  assert.equal(personalXp(Number.MAX_SAFE_INTEGER, { id: 'player-a', onlineXp: 600 }), Number.MAX_SAFE_INTEGER);
});

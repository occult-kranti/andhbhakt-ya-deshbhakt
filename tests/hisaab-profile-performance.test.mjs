import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('../editions/hisaab/node-aliases.mjs', import.meta.url);
const root = new URL('../', import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(`
  const root = ${JSON.stringify(root)};
  export async function resolve(specifier, context, next) {
    const spec = specifier.startsWith('@/') ? root + specifier.slice(2) : specifier;
    try { return await next(spec, context); } catch (error) {
      if (!(spec.startsWith('.') || spec.startsWith('file:'))) throw error;
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        try { return await next(spec + ext, context); } catch {}
      }
      throw error;
    }
  }
`)}`);
const { duelPerformance } = await import('../editions/hisaab/app/screens/me/lib.ts');

test('profile performance uses settled duel counters without inventing legacy elapsed times', () => {
  assert.deepEqual(duelPerformance(null), { rounds: 0, correct: 0, accuracy: null, fastestCorrectMs: null });
  assert.deepEqual(duelPerformance({ counters: { rounds: 3, correct: 2 } }), {
    rounds: 3, correct: 2, accuracy: 67, fastestCorrectMs: null,
  });
  assert.deepEqual(duelPerformance({ counters: { rounds: 4, correct: 3, fastestCorrectMs: 7800, discoveries: 12, reviews: 20 } }), {
    rounds: 4, correct: 3, accuracy: 75, fastestCorrectMs: 7800,
  });
});

test('profile performance does not show impossible correctness or negative or missing times', () => {
  assert.deepEqual(duelPerformance({ counters: { rounds: 2, correct: 50, fastestCorrectMs: -1 } }), {
    rounds: 2, correct: 2, accuracy: 100, fastestCorrectMs: null,
  });
  assert.deepEqual(duelPerformance({ counters: { rounds: 2, correct: 0, fastestCorrectMs: 0 } }), {
    rounds: 2, correct: 0, accuracy: 0, fastestCorrectMs: null,
  });
  assert.equal(duelPerformance({ counters: { rounds: 1, correct: 1, fastestCorrectMs: 0 } }).fastestCorrectMs, 0);
  for (const fastestCorrectMs of [null, undefined, NaN, Infinity, '7800']) {
    assert.equal(duelPerformance({ counters: { rounds: 1, correct: 1, fastestCorrectMs } }).fastestCorrectMs, null);
  }
});

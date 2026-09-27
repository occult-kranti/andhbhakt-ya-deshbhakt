import test from 'node:test';
import assert from 'node:assert/strict';
import { href, parseHash } from '../editions/hisaab/app/router.ts';

test('old public and bot duel links enter the human online desk', () => {
  for (const hash of ['#/duel', '#/duel?vs=bot', '#/duel?mode=ranked']) {
    const route = parseHash(hash);
    assert.equal(route.name, 'online');
    assert.equal(route.view, 'play');
    assert.equal(route.tab, 'duel');
  }
  const generated = href.duel({ vs: 'bot', file: 'today' });
  assert.equal(parseHash(generated).name, 'online');
  assert.equal(parseHash(generated).query.file, 'today');
  assert.equal(parseHash(generated).query.vs, undefined);
});

test('human friend and shared-phone links preserve their distinct transports', () => {
  assert.deepEqual([parseHash(href.friend('ABCD')).name, parseHash(href.friend('ABCD')).view], ['duel', 'friend']);
  assert.equal(parseHash(href.pass()).name, 'pass');
});

test('daily and savings links preserve their intended desk selection', () => {
  assert.equal(parseHash(href.online('play', { file: 'today' })).query.file, 'today');
  const board = parseHash(href.online('standings', { period: 'savings' }));
  assert.equal(board.view, 'standings');
  assert.equal(board.query.period, 'savings');
  assert.equal(parseHash(href.aaj()).name, 'aaj');
});

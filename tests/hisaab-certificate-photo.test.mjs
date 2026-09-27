import test from 'node:test';
import assert from 'node:assert/strict';
import { certificateArt, honourLine, mascotAsset, spriteCrop } from '../editions/hisaab/app/share/certificate-art.mjs';
import { MAX_PHOTO_BYTES, PORTRAIT_KEY, photoInputError, readPortrait, savePortrait, validPortrait } from '../editions/hisaab/app/screens/me/portrait-store.mjs';

test('certificate art expands player area with progress and keeps every pose in the real 3x2 sheet', () => {
  const levels = Array.from({ length: 9 }, (_, band) => certificateArt(band));
  assert.equal(levels[0].portrait, 30); assert.equal(levels[0].mascot, 70);
  assert.equal(levels[8].portrait, 90); assert.equal(levels[8].mascot, 10);
  assert.equal(new Set(levels.map(level => level.caption)).size, 9, 'every earned band has its own caption');
  assert.equal(new Set(levels.map(level => level.medal)).size, 9, 'every band has its own medal');
  for (const [index, level] of levels.entries()) {
    assert.equal(level.portrait + level.mascot, 100);
    if (index) assert.ok(level.portrait > levels[index - 1].portrait);
    const crop = spriteCrop(level.frame, 1536, 1024);
    assert.equal(crop.width, 512); assert.equal(crop.height, 512);
    assert.ok(crop.x + crop.width <= 1536); assert.ok(crop.y + crop.height <= 1024);
  }
  assert.equal(certificateArt(0, true).expression, 'crying');
  assert.equal(certificateArt(0, true).portrait, 90);
  assert.equal(certificateArt(99).band, 8); assert.equal(certificateArt(NaN).band, 0);
  assert.equal(mascotAsset('/fact-duel/'), '/fact-duel/assets/hisaab/mascot-expressions.png');
  assert.equal(mascotAsset('/fact-duel'), '/fact-duel/assets/hisaab/mascot-expressions.png');
});

test('photo gate rejects SVG, remote strings, empty and oversized images before decoding', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(photoInputError({ type, size: MAX_PHOTO_BYTES }), null);
  for (const file of [null, 'https://example.com/photo.jpg', { type: 'image/svg+xml', size: 500 }, { type: 'image/gif', size: 500 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: MAX_PHOTO_BYTES + 1 }]) assert.ok(photoInputError(file));
  for (const value of ['https://example.com/x.jpg', 'data:image/svg+xml;base64,AAA=', 'data:image/jpeg;base64,<script>', 'data:image/jpeg;base64,' + 'A'.repeat(900000)]) assert.equal(validPortrait(value), false);
  assert.equal(validPortrait('data:image/jpeg;base64,AAAA'), true);
});

test('photo remains usable during storage failure, removal is explicit, and nothing needs a network', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem: (key, value) => entries.set(key, value), getItem: key => entries.get(key), removeItem: key => entries.delete(key) } });
  try {
    const portrait = 'data:image/jpeg;base64,AAAA';
    assert.equal(savePortrait(portrait).persisted, true); assert.equal(entries.get(PORTRAIT_KEY), portrait); assert.equal(readPortrait(), portrait);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
    assert.equal(savePortrait('data:image/jpeg;base64,BBBB').persisted, false); assert.equal(readPortrait(), 'data:image/jpeg;base64,BBBB');
    assert.equal(savePortrait(null).persisted, false); assert.equal(readPortrait(), null);
    assert.throws(() => savePortrait('https://example.com/x.jpg'));
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; }
});

test('an honour image carries the competition source and UTC expiry', () => {
  const line = honourLine({ source: 'savings', rank: 1, expiresAt: Date.UTC(2026, 8, 28) });
  assert.match(line, /UPI tax savings leader/); assert.match(line, /#1/); assert.match(line, /until 2026-09-28 00:00 UTC/);
  assert.equal(honourLine(null), '');
});

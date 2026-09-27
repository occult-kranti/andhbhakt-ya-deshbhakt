import test from 'node:test';
import assert from 'node:assert/strict';
import { adConfigFromEnv, adEligibility, adsTxt, normalizeAdConfig } from '../editions/hisaab/app/ads/policy.mjs';
import { mountAd, readAdConsent } from '../editions/hisaab/app/ads/runtime.mjs';

const config = normalizeAdConfig({ enabled: true, approved: true, autoAdsDisabled: true, client: 'ca-pub-1234567890123456', homeSlot: '1234567890', archiveSlot: '9876543210', cmpId: 'test-cmp', origin: 'https://hisaab.example' });
const context = { placement: 'home-footer', screen: 'home', origin: config.origin, hash: '#/' };
const consent = { status: 'ready', providerId: 'test-cmp', advertisingAllowed: true, storageAllowed: true, regionalRulesSatisfied: true, audience: 'adult' };

function fixture(initial = consent) {
  let value = initial;
  const handlers = new Map();
  const listeners = new Set();
  const scripts = [];
  const attrs = {};
  const element = { isConnected: true, dataset: {}, setAttribute: (k, v) => { attrs[k] = v; } };
  const win = { location: { origin: config.origin, hash: '#/', reloads: 0, reload() { this.reloads += 1; } }, addEventListener: (type, fn) => handlers.set(type, fn), hisaabAdConsent: { getSnapshot: () => value, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, openPreferences() {} } };
  const doc = { createElement: () => ({ dataset: {} }), head: { appendChild: (script) => scripts.push(script) } };
  return { win, doc, scripts, element, attrs, args: { config, placement: 'home-footer', screen: 'home', element, win, doc }, setConsent(next) { value = next; for (const fn of listeners) fn(); }, route(hash) { win.location.hash = hash; handlers.get('hashchange')?.(); } };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('advertising is fail-closed by default; strict env booleans never treat false text as true', () => {
  assert.equal(adEligibility(normalizeAdConfig(), context, consent).allowed, false);
  assert.equal(adConfigFromEnv({ HISAAB_ADS_ENABLED: 'false' }).enabled, false);
  assert.equal(adConfigFromEnv({ HISAAB_ADS_ENABLED: 'TRUE' }).enabled, false);
  assert.equal(adConfigFromEnv({ HISAAB_ADS_ENABLED: 'true' }).enabled, true);
  assert.equal(adsTxt({ client: '' }), null);
  assert.equal(adsTxt(config), 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
});

test('every incomplete publisher, deployment or consent state prevents eligibility', () => {
  for (const patch of [{ enabled: false }, { approved: false }, { autoAdsDisabled: false }, { client: 'test' }, { homeSlot: '' }, { cmpId: '' }, { origin: 'http://hisaab.example' }, { origin: 'https://hisaab.example/other' }]) {
    assert.equal(adEligibility({ ...config, ...patch }, context, consent).allowed, false, JSON.stringify(patch));
  }
  for (const next of [null, {}, { ...consent, status: 'loading' }, { ...consent, providerId: 'other' }, { ...consent, advertisingAllowed: false }, { ...consent, storageAllowed: false }, { ...consent, regionalRulesSatisfied: false }, { ...consent, audience: 'unknown' }, { ...consent, audience: 'minor' }]) {
    assert.equal(adEligibility(config, context, next).allowed, false, JSON.stringify(next));
  }
  assert.equal(adEligibility(config, { ...context, origin: 'https://other.example' }, consent).allowed, false);
  assert.equal(adEligibility(config, { ...context, familySession: true }, consent).allowed, false);
  assert.equal(adEligibility(config, { ...context, activeGame: true }, consent).allowed, false);
});

test('positive allowlist rejects all gameplay, invite, circle, future and mismatched routes', () => {
  for (const hash of ['#/aaj', '#/route/state-up', '#/q/hsc001', '#/duel', '#/duel/pass', '#/duel/friend', '#/room', '#/circles', '#/circles/abc', '#/receipts?item=hsc001', '#/future', '#/?invite=abc']) {
    assert.equal(adEligibility(config, { ...context, hash }, consent).allowed, false, hash);
  }
  assert.equal(adEligibility(config, context, consent).allowed, true);
  assert.equal(adEligibility(config, { ...context, placement: 'archive-footer', screen: 'receipts', hash: '#/receipts' }, consent).allowed, false);
  assert.equal(adEligibility(config, { ...context, hash: '#/receipts' }, consent).allowed, false);
  assert.equal(adEligibility(config, { ...context, placement: '__proto__' }, consent).allowed, false);
});

test('denied consent, missing bridge and disconnected slot create no script and no ad queue', async () => {
  for (const next of [null, { ...consent, advertisingAllowed: false }, { ...consent, audience: 'minor' }]) {
    const f = fixture(next);
    mountAd(f.args);
    await flush();
    assert.equal(f.scripts.length, 0);
    assert.equal(f.win.adsbygoogle, undefined);
  }
  const f = fixture();
  delete f.win.hisaabAdConsent;
  assert.equal(readAdConsent(f.win), null);
  mountAd(f.args);
  assert.equal(f.scripts.length, 0);
  const disconnected = fixture();
  disconnected.element.isConnected = false;
  mountAd(disconnected.args);
  assert.equal(disconnected.scripts.length, 0);
});

test('one SDK request; ad queues only after load, with one request per actual element', async () => {
  const f = fixture();
  mountAd(f.args);
  mountAd(f.args);
  assert.equal(f.scripts.length, 1);
  assert.equal(f.win.adsbygoogle, undefined);
  assert.match(f.scripts[0].src, /^https:\/\/pagead2\.googlesyndication\.com\//);
  f.scripts[0].onload();
  await flush();
  assert.equal(f.win.adsbygoogle.length, 1);
  assert.equal(f.win.adsbygoogle.requestNonPersonalizedAds, 1);
  assert.equal(f.attrs['data-ad-slot'], config.homeSlot);
});

test('consent withdrawal or route transition during SDK load prevents an impression and reloads the document', async () => {
  const f = fixture();
  mountAd(f.args);
  f.setConsent({ ...consent, advertisingAllowed: false });
  f.scripts[0].onload();
  await flush();
  assert.equal(f.win.adsbygoogle, undefined);
  assert.equal(f.win.location.reloads, 1);
  const g = fixture();
  mountAd(g.args);
  g.route('#/receipts');
  g.scripts[0].onload();
  await flush();
  assert.equal(g.win.adsbygoogle, undefined);
  assert.equal(g.win.location.reloads, 1);
});

test('unmounted slots and blocked SDK do not enqueue or retry ads', async () => {
  const f = fixture();
  const dispose = mountAd(f.args);
  dispose();
  f.scripts[0].onload();
  await flush();
  assert.equal(f.win.adsbygoogle, undefined);
  const g = fixture();
  let failures = 0;
  mountAd({ ...g.args, onFailure: () => { failures += 1; } });
  g.scripts[0].onerror();
  await flush();
  assert.equal(failures, 1);
  assert.equal(g.win.adsbygoogle, undefined);
  assert.equal(g.scripts.length, 1);
});

test('broken CMP access/subscription fails closed', () => {
  const f = fixture();
  f.win.hisaabAdConsent.getSnapshot = () => { throw new Error('not ready'); };
  assert.equal(readAdConsent(f.win), null);
  mountAd(f.args);
  assert.equal(f.scripts.length, 0);
  const g = fixture();
  g.win.hisaabAdConsent.subscribe = () => { throw new Error('not ready'); };
  mountAd(g.args);
  assert.equal(g.scripts.length, 0);
});

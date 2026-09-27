import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCadence, reduceCompletion, recordCompletion } from '../editions/hisaab/app/ads/cadence.mjs';
import { googleH5Provider, requestGameBreak } from '../editions/hisaab/app/ads/game-runtime.mjs';
import { gameAdEligibility, normalizeAdConfig } from '../editions/hisaab/app/ads/policy.mjs';

const config = normalizeAdConfig({ enabled: true, approved: true, autoAdsDisabled: true,
  client: 'ca-pub-1234567890123456', cmpId: 'test-cmp', origin: 'https://hisaab.example', h5Enabled: true, h5Approved: true });
const context = { origin: config.origin, phase: 'completed', activeGame: false, online: true };
const consent = { status: 'ready', providerId: 'test-cmp', advertisingAllowed: true, storageAllowed: true, regionalRulesSatisfied: true, audience: 'adult' };
const duel = (id, outcome) => ({ id, kind: 'duel', outcome });

test('mixed results count independently until an opportunity resets both tallies', () => {
  let state = emptyCadence();
  const outcomes = ['win', 'loss', 'draw', 'loss', 'win', 'loss', 'win', 'win'];
  const due = outcomes.map((outcome, i) => { const r = reduceCompletion(state, duel(String(i), outcome)); state = r.state; return r.due; });
  assert.deepEqual(due, [false, false, false, false, true, false, false, true]);
  assert.equal(state.wins, 0);
  assert.equal(state.losses, 0);
});

test('each practice run is eligible once; draws, cancelled and duplicate polls never advance counters', () => {
  let state = emptyCadence();
  for (let i = 0; i < 3; i++) {
    const c = { id: `run:${i}`, kind: 'practice' };
    const first = reduceCompletion(state, c); state = first.state;
    assert.equal(first.due, true);
    assert.equal(reduceCompletion(state, c).due, false);
  }
  const draw = reduceCompletion(state, duel('draw', 'draw')); state = draw.state;
  assert.equal(draw.due, false);
  assert.equal(reduceCompletion(state, duel('cancelled', 'cancelled')).recorded, false);
  assert.deepEqual([state.wins, state.losses], [0, 0]);
});

test('reload and repeated result mounts are deduplicated before any provider is called', async () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal((await recordCompletion(duel('persist-1', 'win'), { storage })).due, false);
  assert.equal((await recordCompletion(duel('persist-2', 'win'), { storage })).due, true);
  assert.equal((await recordCompletion(duel('persist-2', 'win'), { storage })).due, false);
  assert.equal((await recordCompletion(duel('persist-3', 'win'), { storage })).due, false);
});

test('storage blocked, malformed or full fails closed without a placement', async () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal((await recordCompletion({ id: 'blocked', kind: 'practice' }, { storage: blocked })).due, false);
  const corrupt = { getItem: () => '{oops', setItem() {} };
  assert.equal((await recordCompletion({ id: 'corrupt', kind: 'practice' }, { storage: corrupt })).due, false);
  const full = { getItem: () => JSON.stringify(emptyCadence()), setItem() { throw Error('quota'); } };
  assert.equal((await recordCompletion({ id: 'quota', kind: 'practice' }, { storage: full })).due, false);
});

test('Web Locks serialize concurrent mounts and retain exactly one due placement', async () => {
  let saved = JSON.stringify(emptyCadence()); let tail = Promise.resolve(); let lockCalls = 0;
  const storage = { getItem: () => saved, setItem: (_k, v) => { saved = v; } };
  const locks = { request(_key, run) { lockCalls++; const next = tail.then(run); tail = next; return next; } };
  const c = { id: 'same-practice', kind: 'practice' };
  const results = await Promise.all([recordCompletion(c, { storage, locks }), recordCompletion(c, { storage, locks })]);
  assert.equal(lockCalls, 2);
  assert.equal(results.filter((r) => r.due).length, 1);
});

function fixture() {
  let current = consent; const subscribers = new Set(); let callbacks; let starts = 0; let disposals = 0;
  const win = { hisaabAdConsent: { getSnapshot: () => current, subscribe: (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); }, openPreferences() {} } };
  const provider = { start(value) { starts++; callbacks = value; return () => { disposals++; }; } };
  return { args: { config, context, win, provider }, callbacks: () => callbacks, starts: () => starts, disposals: () => disposals,
    revoke() { current = { ...consent, advertisingAllowed: false }; for (const fn of subscribers) fn(); } };
}

test('separate approval, consent, online and completion gates prevent SDK loading', async () => {
  for (const patch of [{ h5Enabled: false }, { h5Approved: false }, { approved: false }, { enabled: false }])
    assert.equal(gameAdEligibility({ ...config, ...patch }, context, consent).allowed, false);
  for (const patch of [{ online: false }, { phase: 'answering' }, { activeGame: true }, { familySession: true }]) {
    const f = fixture();
    await requestGameBreak({ ...f.args, context: { ...context, ...patch } }).done;
    assert.equal(f.starts(), 0);
  }
  const f = fixture(); f.revoke();
  await requestGameBreak(f.args).done;
  assert.equal(f.starts(), 0);
});

test('no-fill and provider frequency caps finish once without waiting for beforeAd', async () => {
  for (const status of ['noAdPreloaded', 'frequencyCapped', 'notReady', 'error']) {
    const f = fixture(); const breakRun = requestGameBreak(f.args);
    f.callbacks().done({ breakStatus: status });
    assert.deepEqual(await breakRun.done, { status });
    f.callbacks().done({ breakStatus: 'viewed' }); breakRun.cancel();
    assert.equal(f.disposals(), 1);
  }
});

test('blocked SDK timeout and late callbacks cannot start another placement or hold play', async () => {
  const f = fixture(); const states = [];
  const breakRun = requestGameBreak({ ...f.args, loadTimeoutMs: 5, onState: (state) => states.push(state) });
  assert.equal((await breakRun.done).status, 'timeout');
  f.callbacks().beforeAd(); f.callbacks().done({ breakStatus: 'viewed' });
  assert.deepEqual(states, ['loading', 'done']);
  assert.equal(f.disposals(), 1);
});

test('ready and showing phases have a bounded watchdog; consent revocation cancels a shown ad', async () => {
  const f = fixture(); const r = requestGameBreak({ ...f.args, loadTimeoutMs: 5, showTimeoutMs: 10 });
  f.callbacks().ready(); f.callbacks().beforeAd();
  f.revoke();
  assert.equal((await r.done).status, 'consent-changed');
  assert.equal(f.disposals(), 1);
  const g = fixture(); const timeout = requestGameBreak({ ...g.args, showTimeoutMs: 5 });
  g.callbacks().beforeAd();
  assert.equal((await timeout.done).status, 'timeout');
});

test('synchronous provider errors dispose once and never strand the result', async () => {
  const f = fixture(); let disposals = 0;
  const r = requestGameBreak({ ...f.args, provider: { start(callbacks) { callbacks.error(); return () => { disposals++; }; } } });
  assert.equal((await r.done).status, 'unavailable');
  assert.equal(disposals, 1);
});

test('Google H5 queues an actual non-rewarded ad only on the Continue gesture and reloads on disposal', () => {
  const created = []; const appended = []; let reloads = 0; let shown = 0;
  const doc = { createElement(tag) { const handlers = {}; const el = { tag, handlers, setAttribute() {}, addEventListener: (k, fn) => { handlers[k] = fn; }, removeEventListener: (k) => delete handlers[k], remove() {}, focus() {} }; created.push(el); return el; }, head: { appendChild: (el) => appended.push(el) } };
  const win = { location: { reload: () => reloads++ } };
  const provider = googleH5Provider({ config, container: { appendChild() {} }, win, doc });
  const dispose = provider.start({ ready() {}, beforeAd: () => shown++, done() {}, error() {} });
  assert.equal(appended.length, 1);
  assert.match(appended[0].src, /^https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle.js\?client=ca-pub-/);
  assert.equal(win.adsbygoogle.length, 1, 'only readiness config before a gesture');
  win.adsbygoogle[0].onReady();
  assert.equal(win.adsbygoogle.length, 1, 'API readiness never shows an ad by itself');
  created.find((el) => el.tag === 'button').handlers.click();
  assert.equal(win.adsbygoogle.length, 2);
  assert.equal(win.adsbygoogle[1].type, 'next');
  assert.equal(win.adsbygoogle[1].beforeReward, undefined);
  win.adsbygoogle[1].beforeAd(); assert.equal(shown, 1);
  dispose(); dispose();
  assert.equal(reloads, 1);
  win.adsbygoogle[1].beforeAd(); assert.equal(shown, 1, 'late SDK callbacks are ignored');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { circleText, newCircle, encodeInvite, decodeInvite, normalizeCircles, randomCircleId, validPresence } from '../editions/hisaab/circles/model.mjs';
import { createCircleStore } from '../editions/hisaab/circles/store.mjs';
import { circleKeys, createCircleSession } from '../editions/hisaab/circles/live.mjs';

const input = { name: 'घर की बैठक', nickname: 'Receipt Rani', kind: 'family' };
const make = () => newCircle(input, webcrypto);
const storage = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; };
const turn = () => new Promise(resolve => setTimeout(resolve, 0));

test('circles use independent secure 128-bit invite and per-circle member identities', () => {
  const a = make(), b = make();
  assert.match(a.id, /^[a-f0-9]{32}$/); assert.notEqual(a.id, b.id); assert.notEqual(a.memberId, b.memberId);
  assert.throws(() => randomCircleId({}), /secure browser/);
  assert.equal(circleText('  Chai   Uncle  '), 'Chai Uncle');
  assert.throws(() => circleText('  '), /1–24/);
  for (const text of ['<script>x</script>', '\u202ename', 'a\u0000b', 'x'.repeat(25)]) assert.throws(() => circleText(text));
});

test('Unicode circle invite roundtrips through a URL fragment and rejects damaged metadata', () => {
  const a = make(), token = encodeInvite(a);
  const expected = { id: a.id, name: a.name, kind: a.kind };
  assert.deepEqual(decodeInvite(token), expected);
  const url = `https://example.test/hisaab/#/circles?invite=${encodeURIComponent(token)}`;
  assert.equal(new URL(url).search, ''); assert.deepEqual(decodeInvite(url), expected);
  for (const value of ['', 'HD1.bad.bad', `HD1.${a.id}.AA`, '#/duel?invite=x', 'a'.repeat(2050)]) assert.throws(() => decodeInvite(value));
  const bad = `HD1.${a.id}.${btoa(JSON.stringify({ n: '<img>', k: 'family' }))}`;
  assert.throws(() => decodeInvite(bad));
});

test('local create/join/nickname/rename/leave survive reload without sharing a profile name', async () => {
  const memory = storage(), store = createCircleStore({ storage: memory, cryptoApi: webcrypto });
  const a = await store.create(input), b = await store.create({ ...input, name: 'Friends', nickname: 'Chai Uncle' });
  await store.update(a.id, { nickname: 'New Name', name: 'My saved title' });
  assert.equal(store.getSnapshot().circles.find(c => c.id === b.id).nickname, 'Chai Uncle');
  const remote = createCircleStore({ storage: storage(), cryptoApi: webcrypto });
  const joined = await remote.join(encodeInvite(a), 'Aunty');
  assert.equal(joined.id, a.id); assert.notEqual(joined.memberId, a.memberId);
  await remote.join(encodeInvite(a), 'Other Aunty'); assert.equal(remote.getSnapshot().circles.length, 1);
  const loaded = createCircleStore({ storage: memory });
  assert.equal(loaded.getSnapshot().circles[0].nickname, 'New Name');
  await loaded.leave(a.id); assert.equal(loaded.getSnapshot().circles.length, 1);
  assert.equal(remote.getSnapshot().circles.length, 1, 'leaving does not claim to delete remote membership');
});

test('storage quota/corruption never falsely succeeds; cross-tab clear reloads the snapshot', async () => {
  let blocked = false;
  const memory = storage(), original = memory.setItem;
  memory.setItem = (k, v) => { if (blocked) throw new Error('QuotaExceededError'); original(k, v); };
  let listener;
  const events = { addEventListener(_type, fn) { listener = fn; }, removeEventListener() {} };
  const store = createCircleStore({ storage: memory, eventTarget: events });
  const a = await store.create(input); blocked = true;
  await assert.rejects(store.update(a.id, { nickname: 'Unsaved' }), /Could not save/);
  assert.equal(store.getSnapshot().circles[0].nickname, input.nickname);
  const corrupt = createCircleStore({ storage: { getItem: () => '{', setItem: () => assert.fail('must not overwrite damage') } });
  await assert.rejects(corrupt.create(input), /damaged/);
  blocked = false;
  const other = createCircleStore({ storage: memory }); await other.leave(a.id);
  listener({ key: null }); assert.equal(store.getSnapshot().circles.length, 0);
  store.dispose();
});

test('record normalization caps untrusted history and ignores injected/duplicate identities', () => {
  const a = make(); a.members = Array.from({ length: 60 }, (_, i) => ({ id: i.toString(16).padStart(32, '0'), nickname: `Person ${i}`, lastSeen: i }));
  assert.equal(normalizeCircles([a, a])[0].members.length, 32);
  assert.equal(normalizeCircles([a, a]).length, 1);
  assert.equal(validPresence({ v: 1, id: a.memberId, nickname: '<script>' }), null);
  assert.equal(validPresence({ v: 1, id: a.memberId, nickname: 'A', xp: -100 }).xp, 0);
});

function fakeNetwork() {
  const rooms = new Map(); let counter = 0;
  function joinRoom(_config, topic) {
    const id = `peer-${++counter}`, action = { onMessage: null, async send(data, options) {
      for (const [otherId, other] of rooms) if (otherId !== id && other.topic === topic && (!options?.target || options.target === otherId))
        queueMicrotask(() => other.action.onMessage?.(structuredClone(data), { peerId: id }));
    } };
    const room = { topic, action, onPeerJoin: null, onPeerLeave: null, makeAction: () => action, async leave() {
      rooms.delete(id); for (const other of rooms.values()) if (other.topic === topic) other.onPeerLeave?.(id);
    } };
    rooms.set(id, room);
    queueMicrotask(() => { for (const [otherId, other] of rooms) if (otherId !== id && other.topic === topic) { room.onPeerJoin?.(otherId); other.onPeerJoin?.(id); } });
    return room;
  }
  return { joinRoom, rooms };
}

test('multi-peer handshake shares only valid circle presence, updates names, and removes departures', async t => {
  const net = fakeNetwork(), a = make(), b = { ...a, nickname: 'Chai Uncle', memberId: randomCircleId() };
  let clock = 1000;
  const first = await createCircleSession({ circle: a, xp: 30, joinRoom: net.joinRoom, now: () => clock });
  t.after(() => first.close());
  const second = await createCircleSession({ circle: b, xp: 50, joinRoom: net.joinRoom, now: () => clock });
  t.after(() => second.close()); await turn();
  assert.equal(first.snapshot().peers[0].nickname, b.nickname);
  assert.equal(second.snapshot().peers[0].xp, 30);
  clock += 200; second.update({ nickname: 'Aunty', xp: 70 }); await turn();
  assert.equal(first.snapshot().peers[0].nickname, 'Aunty');
  const isolated = await createCircleSession({ circle: make(), joinRoom: net.joinRoom });
  t.after(() => isolated.close()); await turn(); assert.equal(isolated.snapshot().peers.length, 0);
  await second.close(); assert.equal(first.snapshot().peers.length, 0);
});

test('presence expires, frees connection capacity, and accepts a later valid transport peer', async t => {
  let room, action, clock = 1000;
  const session = await createCircleSession({ circle: make(), now: () => clock, heartbeatMs: 5, ttlMs: 20,
    joinRoom: () => (room = { makeAction: () => (action = { send: async () => {} }), leave: async () => {} }) });
  t.after(() => session.close());
  for (let i = 0; i < 32; i++) {
    room.onPeerJoin(`peer${i}`);
    action.onMessage({ v: 1, id: i.toString(16).padStart(32, '0'), nickname: `P${i}`, xp: 1 }, { peerId: `peer${i}` });
  }
  assert.equal(session.snapshot().peers.length, 32);
  clock += 21; await new Promise(resolve => setTimeout(resolve, 12));
  assert.equal(session.snapshot().peers.length, 0);
  action.onMessage({ v: 1, id: randomCircleId(), nickname: 'Returned', xp: 1 }, { peerId: 'late' });
  assert.equal(session.snapshot().peers[0].nickname, 'Returned');
});

test('connect failures reject cleanly and circle rendezvous keys do not expose the raw invite', async () => {
  const a = make(), keys = await circleKeys(a.id);
  assert.notEqual(keys.topic, a.id); assert.notEqual(keys.topic, keys.password);
  await assert.rejects(createCircleSession({ circle: a, joinRoom: () => { throw new Error('Network blocked'); } }), /Network blocked/);
});

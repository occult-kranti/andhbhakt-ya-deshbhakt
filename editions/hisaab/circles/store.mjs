import { STORAGE } from '../../../lib/storage-names.mjs';
import { CIRCLE_LIMITS, circleText, decodeInvite, newCircle, normalizeCircles, randomCircleId } from './model.mjs';

/** All writes re-read within a Web Lock where available; errors never pretend to have saved. */
export function createCircleStore({ storage, cryptoApi = globalThis.crypto, now = Date.now, locks, eventTarget } = {}) {
  const listeners = new Set();
  let snapshot = { circles: [], error: '' }, serialized = '';
  function load() {
    try {
      const raw = storage?.getItem(STORAGE.circles) ?? '[]';
      if (raw.length > 300000) throw new Error('Circle data is too large.');
      const circles = normalizeCircles(JSON.parse(raw));
      const text = JSON.stringify(circles);
      if (text !== serialized || snapshot.error) { serialized = text; snapshot = { circles, error: '' }; }
    } catch { snapshot = { ...snapshot, error: 'Circle storage is unavailable or damaged. Existing data was not overwritten. Enable browser storage or try another browser.' }; }
    return snapshot;
  }
  const emit = () => { for (const fn of listeners) fn(); };
  load();
  const onStorage = e => { if (e.key === STORAGE.circles || e.key === null) { load(); emit(); } };
  eventTarget?.addEventListener('storage', onStorage);
  async function mutate(fn) {
    const write = () => {
      const current = load();
      if (current.error) throw new Error(current.error);
      if (!storage) throw new Error('Enable browser storage to save circles.');
      const next = fn(structuredClone(current.circles));
      try { storage.setItem(STORAGE.circles, JSON.stringify(next)); }
      catch { throw new Error('Could not save this change. Browser storage is full or disabled.'); }
      load(); emit();
      return next;
    };
    return locks?.request ? locks.request(STORAGE.circles, write) : write();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async create(input) {
      const circle = newCircle(input, cryptoApi, now());
      await mutate(all => { if (all.length >= CIRCLE_LIMITS.circles) throw new Error('You can keep up to 20 circles. Leave one before adding another.'); return [...all, circle]; });
      return circle;
    },
    async join(invite, nickname) {
      const meta = decodeInvite(invite), nick = circleText(nickname);
      let joined;
      await mutate(all => {
        const previous = all.find(c => c.id === meta.id);
        if (previous) { previous.nickname = nick; joined = previous; return all; }
        if (all.length >= CIRCLE_LIMITS.circles) throw new Error('You can keep up to 20 circles. Leave one before adding another.');
        joined = { ...meta, nickname: nick, memberId: randomCircleId(cryptoApi), createdAt: now(), members: [] };
        return [...all, joined];
      });
      return joined;
    },
    async update(id, patch) {
      await mutate(all => {
        const circle = all.find(c => c.id === id);
        if (!circle) throw new Error('This circle has been left on this device.');
        if (patch.nickname !== undefined) circle.nickname = circleText(patch.nickname);
        if (patch.name !== undefined) circle.name = circleText(patch.name, 'name');
        return all;
      });
    },
    async remember(id, peers) {
      await mutate(all => {
        const circle = all.find(c => c.id === id);
        if (!circle) return all;
        const incoming = peers.filter(p => p.id !== circle.memberId).map(p => ({ id: p.id, nickname: circleText(p.nickname), lastSeen: now() }));
        circle.members = [...incoming, ...circle.members.filter(m => !incoming.some(p => p.id === m.id))].slice(0, CIRCLE_LIMITS.members);
        return normalizeCircles(all);
      });
    },
    async leave(id) { await mutate(all => all.filter(c => c.id !== id)); },
    dispose() { eventTarget?.removeEventListener('storage', onStorage); listeners.clear(); },
  };
}

let browserStore;
export function getCircleStore() {
  if (!browserStore) {
    let storage;
    try { storage = globalThis.localStorage; } catch { /* blocked browser storage */ }
    browserStore = createCircleStore({ storage, locks: globalThis.navigator?.locks, eventTarget: globalThis.window });
  }
  return browserStore;
}

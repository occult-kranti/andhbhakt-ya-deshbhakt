/**
 * Storage isolation between JHK and the HISAAB DO edition. Both are served from one GitHub Pages
 * origin, where IndexedDB, localStorage and BroadcastChannel are shared, so every name the engine
 * stores under is derived from lib/storage-ns.mjs and the edition build aliases that one module.
 *
 * Pinned here: (1) JHK's names are byte-identical to what shipped before the namespace existed;
 * (2) the edition's names all differ and cannot collide with JHK's; (3) the edition's module graph
 * really resolves to them; (4) no client code stores under a literal name that bypasses the table.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORAGE, storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../lib/storage-ns.mjs';
import { STORAGE_NS as HISAAB_NS } from '../editions/hisaab/storage-ns.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every name as JHK shipped it, literally, before lib/storage-names.mjs existed. */
const JHK_HISTORICAL = Object.freeze({
  playerDb: 'fact-duel-player',
  walletDb: 'fact-duel-wallet',
  playerChannel: 'fact-duel-player',
  walletChannel: 'fact-duel-wallet',
  p2pChannel: 'fact-duel-p2p-',
  legacyJournal: 'fact-duel-journal-v1',
  sound: 'fact-duel-online-sound',
  volume: 'fact-duel-volume',
  theme: 'fact-duel-online-theme',
  name: 'fact-duel-name',
  haptics: 'fact-duel-haptics',
  motion: 'fact-duel-motion',
  art: 'fact-duel-art',
  principal: 'fd-principal',
  pendingNonce: 'fd-pending-nonce',
  locale: 'fd-locale',
  gate: 'fd-gate',
  brainAwoke: 'fd.brain.awoke',
  onlineSeat: 'fact-duel-online-seat',
});

test('JHK storage names are byte-identical to the ones that shipped', () => {
  assert.deepEqual(STORAGE_NS, { long: 'fact-duel', short: 'fd' });
  assert.deepEqual(Object.fromEntries(Object.keys(JHK_HISTORICAL).map(key => [key, STORAGE[key]])), JHK_HISTORICAL);
  assert.equal(STORAGE.circles, 'fact-duel-circles-v1');
  assert.equal(STORAGE.circleChannel, 'fact-duel-circle-');
});

test('the edition namespace differs from JHK on every name, and no edition name can collide', () => {
  const edition = storageNames(HISAAB_NS);
  assert.deepEqual(Object.keys(edition), Object.keys(STORAGE));
  assert.notEqual(HISAAB_NS.long, STORAGE_NS.long);
  assert.notEqual(HISAAB_NS.short, STORAGE_NS.short);
  const jhk = new Set(Object.values(STORAGE));
  for (const [key, name] of Object.entries(edition)) {
    assert.notEqual(name, STORAGE[key], key);
    assert.ok(!jhk.has(name), `${key}: ${name} is also a JHK name`);
    assert.ok(!/^(fact-duel|fd[-.])/.test(name), `${key}: ${name} uses a JHK prefix`);
    assert.ok(name.startsWith(`${HISAAB_NS.long}-`) || name.startsWith(`${HISAAB_NS.short}-`) || name.startsWith(`${HISAAB_NS.short}.`), name);
  }
  // Neither prefix is a prefix of the other's names (a `startsWith` sweep of one must not catch the other).
  for (const name of Object.values(edition)) for (const prefix of [STORAGE_NS.long, `${STORAGE_NS.short}-`, `${STORAGE_NS.short}.`]) assert.ok(!name.startsWith(prefix));
});

test('the edition module graph resolves every storage name to the edition namespace', () => {
  // A fresh process, so the alias hook is in place before lib/storage-names.mjs is first loaded.
  const script = `
    import { register } from 'node:module';
    register(${JSON.stringify(new URL('../editions/hisaab/node-aliases.mjs', import.meta.url).href)});
    const { STORAGE } = await import(${JSON.stringify(new URL('../lib/storage-names.mjs', import.meta.url).href)});
    const { GATE } = await import(${JSON.stringify(new URL('../lib/profile-gate.mjs', import.meta.url).href)});
    const { PREF_STORAGE_KEYS } = await import(${JSON.stringify(new URL('../lib/fx/prefs.ts', import.meta.url).href)});
    const wallet = await import(${JSON.stringify(new URL('../lib/wallet-client-static.ts', import.meta.url).href)});
    console.log(JSON.stringify({ STORAGE, gate: GATE.storageKey, prefs: PREF_STORAGE_KEYS, principal: wallet.PRINCIPAL_KEY, nonce: wallet.PENDING_NONCE_KEY }));
  `;
  const out = JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' }).trim().split('\n').at(-1),
  );
  const edition = storageNames(HISAAB_NS);
  assert.deepEqual(out.STORAGE, { ...edition });
  assert.equal(out.gate, edition.gate);
  assert.deepEqual(out.prefs, { sound: edition.sound, volume: edition.volume, haptics: edition.haptics, motion: edition.motion });
  assert.equal(out.principal, edition.principal);
  assert.equal(out.nonce, edition.pendingNonce);
});

/** Client source that may run in either build. JHK-only internal tools are listed, with the reason. */
const ALLOWED = new Map([
  ['app/ops/dashboard.tsx', 'JHK operator page (/ops), server build only; never in an edition graph'],
  ['app/studio/studio.tsx', 'JHK roadmap studio (/studio), server build only; never in an edition graph'],
]);

function sources(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return ['node_modules', 'server'].includes(entry.name) ? [] : sources(rel);
    return /\.(m?js|tsx?)$/.test(entry.name) ? [rel] : [];
  });
}

test('no client code names a storage key, database or channel with a literal', () => {
  const direct = [
    /(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*['"`]/,
    /indexedDB\s*\.\s*open\s*\(\s*['"`]/,
    /new\s+BroadcastChannel\s*\(\s*['"`]/,
  ];
  const names = new Set(Object.values(JHK_HISTORICAL));
  const offenders = [];
  for (const file of ['app', 'lib', 'components', 'hooks', 'static', 'editions'].flatMap(sources)) {
    if (ALLOWED.has(file) || file === 'lib/storage-names.mjs') continue;
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const code = line.trim();
      if (code.startsWith('*') || code.startsWith('//') || code.startsWith('/*')) return;
      if (direct.some((re) => re.test(line))) offenders.push(`${file}:${i + 1} ${code}`);
      // A known name as a value in code (assigned, passed, or a property value); markup attributes such
      // as className="fd-gate" and UI copy are not storage.
      for (const m of line.matchAll(/(className|class|id|htmlFor|aria-[a-z]+)?\s*[=:(,]\s*['"`]([^'"`]+)['"`]/g))
        if (!m[1] && names.has(m[2])) offenders.push(`${file}:${i + 1} ${code}`);
    });
  }
  assert.deepEqual(offenders, [], 'route storage names through lib/storage-names.mjs');
});

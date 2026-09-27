/** Populated prior-schema -> current-schema upgrade in isolated PostgreSQL/WASM. No live access. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hashRecovery } from '../supabase/hisaab/functions/hisaab-game/core.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const from = process.argv.find(x => x.startsWith('--from='))?.slice(7) || 'b74c287';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href : '@electric-sql/pglite');
const db = new PGlite();
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const prior = name => execFileSync('git', ['show', `${from}:${name}`], { cwd: root, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
const rawRpc = async (hash, action, payload = {}) =>
  (await db.query('select public.hisaab_game($1,$2,$3::jsonb,$4) as data', [hash, action, JSON.stringify(payload), 'local-upgrade'])).rows[0].data;
const rpc = async (hash, action, payload = {}) => {
  const data = await rawRpc(hash, action, payload);
  assert.equal(data.ok, true, `${action}: ${data.error?.code}`); return data;
};
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(prior('supabase/hisaab/schema.sql'));
  await db.exec(prior('supabase/hisaab/seed-bank.sql'));
  const a = 'a'.repeat(64), b = 'b'.repeat(64);
  const host = (await rpc(a, 'session', { nickname: 'Upgrade Host' })).session;
  const guest = (await rpc(b, 'session', { nickname: 'Upgrade Guest' })).session;
  const historical = (await rpc(a, 'create')).match;
  await rpc(b, 'join', { code: historical.code });
  await db.query("insert into hisaab_private.answers(room_id,round,session_id,request_id,choice,correct,elapsed_ms,xp,received_at) select $1, n, s, gen_random_uuid(), 0, true, 1000, 30, now() from generate_series(1,5) n cross join unnest($2::uuid[]) s", [historical.id, [host.id, guest.id]]);
  await db.query("update hisaab_private.rooms set phase='finished',round=5,winner_id=$2,finished_at=now() where id=$1", [historical.id, host.id]);
  const pending = (await rpc(a, 'create')).match;
  await rpc(b, 'join', { code: pending.code });
  const current = read('supabase/hisaab/schema.sql'), seed = read('supabase/hisaab/seed-bank.sql');
  await db.exec(`begin;\n${current}\n${seed}\ncommit;`);
  await db.exec(current);
  const columns = (await db.query('select file,stake,economy_state from hisaab_private.rooms where id=$1', [pending.id])).rows[0];
  assert.deepEqual(columns, { file: 'all', stake: 0, economy_state: 'pending' });
  assert.equal((await db.query('select count(*)::int n from hisaab_private.answers')).rows[0].n, 10);
  for (const token of [a,b]) {
    assert.equal((await rpc(token, 'profile')).session.balance, 100);
    assert.equal((await rpc(token, 'profile')).session.profileComplete, false);
    await rpc(token, 'snapshot', { roomId: historical.id });
    assert.equal((await rawRpc(token, 'ready', { roomId: pending.id })).error.code, 'PROFILE_REQUIRED');
    const upgraded = await rpc(token, 'profile', { email: `${token[0]}@example.invalid`, adultConfirmed: true, termsVersion: 'beta-1', _recoveryHash: await hashRecovery(token[0].repeat(64)) });
    assert.equal(upgraded.session.profileComplete, true);
    assert.equal(upgraded.session.id, token === a ? host.id : guest.id);
    assert.equal(upgraded.session.balance, 100);
  }
  assert.equal((await db.query('select count(*)::int n from hisaab_private.reward_claims')).rows[0].n, 0, 'no retroactive reward');
  assert.equal((await db.query("select count(*)::int n from hisaab_private.wallet_entries where kind='starter'")).rows[0].n, 2, 'one lazy starter grant per old guest');
  await rpc(a, 'ready', { roomId: pending.id });
  assert.equal((await rpc(b, 'ready', { roomId: pending.id })).match.phase, 'countdown', 'old zero-stake clients can continue');
  await rpc(a, 'leave', { roomId: pending.id });
  assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname='hisaab_private' and not rowsecurity")).rows[0].n, 0);
  assert.equal((await db.query("select has_function_privilege('anon','public.hisaab_game(text,text,jsonb,text)','EXECUTE') as allowed")).rows[0].allowed, false);
  console.log(JSON.stringify({ suite: 'populated-prior-upgrade', from, result: 'pass', checks: ['legacy guest IDs retained by in-place profile upgrade', 'old answers retained', 'historical terminal rewards suppressed', 'starter grants idempotent', 'old waiting room zero defaults', 'incomplete legacy ready gated; upgraded zero-stake ready contract', 'canonical schema repeatable', 'all private tables RLS', 'anon RPC denied'], limitation: 'Isolated single-connection PostgreSQL/WASM; no production data or concurrent lock proof.' }, null, 2));
} finally { await db.close(); }

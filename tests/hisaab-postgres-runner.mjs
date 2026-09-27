/** Real PostgreSQL SQL execution in an isolated WASM instance. No production network calls.
 * npm install --prefix /tmp/hisaab-pg --no-audit --no-fund --save-exact @electric-sql/pglite@0.3.14
 * PGLITE_MODULE_PATH=/tmp/hisaab-pg/node_modules/@electric-sql/pglite/dist/index.js node tests/hisaab-postgres-runner.mjs
 * This proves SQL transitions/constraints, not concurrent connections or production throughput.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PGLITE_MODULE_PATH;
const { PGlite } = await import(modulePath ? pathToFileURL(modulePath).href : '@electric-sql/pglite');
const db = new PGlite();
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(read('supabase/hisaab/schema.sql'));
  await db.exec(read('supabase/hisaab/schema.sql')); // Canonical upgrade is repeatable.
  await db.exec(read('supabase/hisaab/seed-bank.sql'));
  for (const file of ['tests/hisaab-online-security.sql', 'tests/hisaab-online-economy.sql']) {
    const results = await db.exec(read(file));
    const evidence = results.flatMap(result => result.rows ?? []).find(row => row.evidence)?.evidence;
    assert.ok(evidence?.checks > 0, `${file} returned executed evidence`);
    console.log(JSON.stringify({ suite: evidence.suite, checks: evidence.checks, result: 'pass' }));
  }
  const remaining = await db.query('select count(*)::int n from hisaab_private.sessions');
  assert.equal(remaining.rows[0].n, 0, 'all SQL fixture transactions rolled back');
  const roleResult = await db.exec("begin; set local role service_role; select public.hisaab_game(repeat('a',64),'session','{\"nickname\":\"Service test\"}'::jsonb,'runner') as response; rollback;");
  assert.equal(roleResult.flatMap(r=>r.rows??[]).find(r=>r.response)?.response?.session?.balance,100,'service role runs actual invoker RPC with RLS/grants');
  console.log(JSON.stringify({suite:'upgrade-and-privileges',checks:3,result:'pass',concurrency:'not exercised by single-connection PGlite'}));
} finally { await db.close(); }

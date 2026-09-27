/**
 * The deploy manifest: what `scripts/deploy-prepare.mjs` changes in the generated
 * `dist/server/wrangler.json` and, just as much, what it leaves alone.
 *
 * The fixture is the manifest `pnpm build` produced on 2026-09-17 (vinext 1.0.0-beta.5, wrangler
 * 4.92.0), trimmed to the keys that matter plus a few it must not touch. `main`, the assets
 * directory and the `nodejs_compat` flag come from the build and must survive untouched; the
 * name, the database and the route are the deploy's to set. The placeholder database id is the
 * one `vite.config.ts` writes for local dev, and pinning that it is refused is the point: a deploy
 * that binds the placeholder would come up with no tables and no error.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';
import {
  ASSET_IGNORES,
  ASSETS_IGNORE_FILE,
  DEFAULT_DATABASE_NAME,
  DEFAULT_MIGRATIONS_DIR,
  DEFAULT_WORKER_NAME,
  DEPLOY_CONFIG,
  DEPLOY_FILE,
  GENERATED_CONFIG,
  PLACEHOLDER_DATABASE_ID,
  loadFileConfig,
  main,
  mergeConfig,
  prepare,
  readFileConfig,
  summarise,
} from '../scripts/deploy-prepare.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoFile = (relative) => readFileSync(path.join(repoRoot, relative), 'utf8');

const generated = () => ({
  topLevelName: 'site-creator-vinext-starter',
  dev: { ip: 'localhost', local_protocol: 'http', upstream_protocol: 'http', enable_containers: true },
  name: 'site-creator-vinext-starter',
  compatibility_date: '2026-05-15',
  compatibility_flags: ['nodejs_compat'],
  vars: {},
  durable_objects: { bindings: [] },
  kv_namespaces: [],
  queues: { producers: [], consumers: [] },
  r2_buckets: [],
  d1_databases: [
    { binding: 'DB', database_name: 'site-creator-d1', database_id: PLACEHOLDER_DATABASE_ID },
  ],
  legacy_env: true,
  main: 'index.js',
  migrations: [],
  triggers: {},
  rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
  build: { watch_dir: './src' },
  no_bundle: true,
  assets: { directory: '../client' },
  observability: { enabled: true },
});

const ID = '2f1c9a7e-5b3d-4c8e-9a1f-6d2b8c4e0a13';
const env = (extra = {}) => ({ CF_D1_DATABASE_ID: ID, ...extra });

test('a minimal env names the worker and the database and binds the real id', () => {
  const out = prepare(generated(), env());
  assert.equal(out.name, DEFAULT_WORKER_NAME);
  assert.deepEqual(out.d1_databases, [
    { binding: 'DB', database_name: DEFAULT_DATABASE_NAME, database_id: ID, migrations_dir: DEFAULT_MIGRATIONS_DIR },
  ]);
  assert.equal('routes' in out, false, 'no custom domain means no routes key at all');
  assert.equal(out.compatibility_date, '2026-05-15', "the build's own date is kept");
});

test('every key the build owns is preserved byte for byte', () => {
  const source = generated();
  const out = prepare(source, env());
  // Put the two deploy-owned keys back and the result must equal the input exactly.
  assert.deepEqual({ ...out, name: source.name, d1_databases: source.d1_databases }, source);
  assert.equal(out.main, 'index.js');
  assert.deepEqual(out.assets, { directory: '../client' });
  assert.deepEqual(out.compatibility_flags, ['nodejs_compat']);
  assert.deepEqual(out.triggers, {}, 'the manifest still has no cron slot; the sweep stays on Actions');
});

test('prepare is pure: the generated manifest is not mutated', () => {
  const source = generated();
  const before = JSON.stringify(source);
  prepare(source, env({ CF_CUSTOM_DOMAIN: 'play.example.com', CF_WORKER_NAME: 'x' }));
  assert.equal(JSON.stringify(source), before);
});

test('the custom domain becomes a single custom_domain route', () => {
  const out = prepare(generated(), env({ CF_CUSTOM_DOMAIN: 'play.example.com' }));
  assert.deepEqual(out.routes, [{ pattern: 'play.example.com', custom_domain: true }]);
});

test('a pasted URL or an upper-case domain is normalised to the bare hostname', () => {
  for (const raw of ['https://Play.Example.com/', 'PLAY.EXAMPLE.COM', 'play.example.com.', ' play.example.com ']) {
    const out = prepare(generated(), env({ CF_CUSTOM_DOMAIN: raw }));
    assert.deepEqual(out.routes, [{ pattern: 'play.example.com', custom_domain: true }], raw);
  }
});

test('an apex domain is accepted', () => {
  const out = prepare(generated(), env({ CF_CUSTOM_DOMAIN: 'example.com' }));
  assert.deepEqual(out.routes, [{ pattern: 'example.com', custom_domain: true }]);
});

test('a bad domain is refused rather than deployed as a route', () => {
  for (const bad of ['localhost', 'play', 'play_example.com', '-play.example.com', 'a b.example.com']) {
    assert.throws(() => prepare(generated(), env({ CF_CUSTOM_DOMAIN: bad })), /CF_CUSTOM_DOMAIN/, bad);
  }
});

test('an empty CF_CUSTOM_DOMAIN is the same as none', () => {
  assert.deepEqual(prepare(generated(), env({ CF_CUSTOM_DOMAIN: '' })), prepare(generated(), env()));
  assert.deepEqual(prepare(generated(), env({ CF_CUSTOM_DOMAIN: '   ' })), prepare(generated(), env()));
});

test('a missing, blank or malformed database id throws, and so does the local placeholder', () => {
  assert.throws(() => prepare(generated(), {}), /CF_D1_DATABASE_ID is required/);
  assert.throws(() => prepare(generated(), { CF_D1_DATABASE_ID: '   ' }), /CF_D1_DATABASE_ID is required/);
  assert.throws(() => prepare(generated(), { CF_D1_DATABASE_ID: 'not-a-uuid' }), /CF_D1_DATABASE_ID is not valid/);
  assert.throws(
    () => prepare(generated(), { CF_D1_DATABASE_ID: PLACEHOLDER_DATABASE_ID }),
    /placeholder/,
    'the id vite.config.ts writes for local dev must never reach production',
  );
});

test('the worker and database names are overridable and validated', () => {
  const out = prepare(generated(), env({ CF_WORKER_NAME: 'jhk-staging', CF_D1_DATABASE_NAME: 'jhk_staging' }));
  assert.equal(out.name, 'jhk-staging');
  assert.equal(out.d1_databases[0].database_name, 'jhk_staging');
  assert.throws(() => prepare(generated(), env({ CF_WORKER_NAME: 'Has Spaces' })), /CF_WORKER_NAME/);
  assert.throws(() => prepare(generated(), env({ CF_WORKER_NAME: '-leading' })), /CF_WORKER_NAME/);
  assert.throws(() => prepare(generated(), env({ CF_D1_DATABASE_NAME: 'no/slash' })), /CF_D1_DATABASE_NAME/);
});

test('the compatibility date and migrations dir can be pinned from the env', () => {
  const out = prepare(generated(), env({ CF_COMPATIBILITY_DATE: '2026-09-01', CF_D1_MIGRATIONS_DIR: '../.openai/drizzle' }));
  assert.equal(out.compatibility_date, '2026-09-01');
  assert.equal(out.d1_databases[0].migrations_dir, '../.openai/drizzle');
  assert.throws(() => prepare(generated(), env({ CF_COMPATIBILITY_DATE: 'yesterday' })), /CF_COMPATIBILITY_DATE/);
  assert.throws(() => prepare(generated(), env({ CF_D1_MIGRATIONS_DIR: '../x;rm -rf' })), /CF_D1_MIGRATIONS_DIR/);
});

test('other D1 bindings, if any appear, are carried through untouched', () => {
  const source = generated();
  source.d1_databases.push({ binding: 'ANALYTICS', database_name: 'stats', database_id: ID.replace('2f1c', 'aaaa') });
  const out = prepare(source, env());
  assert.deepEqual(out.d1_databases[1], source.d1_databases[1]);
  assert.equal(out.d1_databases[0].database_id, ID);
});

test('a manifest with no DB binding or no main is refused', () => {
  const noDb = generated();
  noDb.d1_databases = [];
  assert.throws(() => prepare(noDb, env()), /no D1 binding named DB/);
  const noMain = generated();
  delete noMain.main;
  assert.throws(() => prepare(noMain, env()), /no `main`/);
  assert.throws(() => prepare(null, env()), /not an object/);
  assert.throws(() => prepare([], env()), /not an object/);
});

test('idempotent: preparing a prepared manifest changes nothing', () => {
  for (const e of [env(), env({ CF_CUSTOM_DOMAIN: 'play.example.com', CF_WORKER_NAME: 'jhk' })]) {
    const once = prepare(generated(), e);
    const twice = prepare(once, e);
    assert.deepEqual(twice, once);
    assert.deepEqual(prepare(JSON.parse(JSON.stringify(once)), e), once, 'and after a JSON round trip');
  }
});

test('re-preparing with a different env replaces, never accumulates', () => {
  const withDomain = prepare(generated(), env({ CF_CUSTOM_DOMAIN: 'play.example.com' }));
  const withoutDomain = prepare(withDomain, env());
  assert.equal('routes' in withoutDomain, false, 'dropping the domain drops the route');
  const other = prepare(withDomain, env({ CF_CUSTOM_DOMAIN: 'duel.example.com' }));
  assert.deepEqual(other.routes, [{ pattern: 'duel.example.com', custom_domain: true }]);
});

test('the summary never prints the whole database id', () => {
  const out = prepare(generated(), env({ CF_CUSTOM_DOMAIN: 'play.example.com' }));
  const summary = summarise(out);
  assert.equal(summary.includes(ID), false);
  assert.match(summary, /2f1c9a7e…/);
  assert.match(summary, /jaanta-hai-kya/);
  assert.match(summary, /play\.example\.com/);
  assert.match(summary, /\.\.\/client/);
  assert.match(summarise(prepare(generated(), env())), /workers\.dev only/);
});

const builtTree = () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'deploy-prepare-'));
  mkdirSync(path.join(cwd, 'dist/server'), { recursive: true });
  mkdirSync(path.join(cwd, 'dist/client/product/compliance'), { recursive: true });
  writeFileSync(path.join(cwd, 'dist/client/product/compliance/checklist.site.html'), '<p>internal</p>');
  const original = `${JSON.stringify(generated())}\n`;
  writeFileSync(path.join(cwd, GENERATED_CONFIG), original);
  return { cwd, original };
};

test('main reads the generated file and writes the sibling deploy file, leaving the original alone', () => {
  const { cwd, original } = builtTree();
  const { target } = main(env({ CF_CUSTOM_DOMAIN: 'play.example.com' }), cwd);
  assert.equal(target, path.join(cwd, DEPLOY_CONFIG));
  assert.equal(readFileSync(path.join(cwd, GENERATED_CONFIG), 'utf8'), original, 'the generated file is untouched');
  const written = JSON.parse(readFileSync(target, 'utf8'));
  assert.deepEqual(written, prepare(generated(), env({ CF_CUSTOM_DOMAIN: 'play.example.com' })));
  assert.equal(written.assets.directory, '../client', 'the assets path is still relative to dist/server');
});

test('main writes .assetsignore next to the assets so public/product never reaches the domain', () => {
  const { cwd } = builtTree();
  const { ignoreFile } = main(env(), cwd);
  assert.equal(ignoreFile, path.join(cwd, 'dist/client', ASSETS_IGNORE_FILE));
  const lines = readFileSync(ignoreFile, 'utf8').split('\n').filter(Boolean);
  assert.deepEqual(lines, [...ASSET_IGNORES]);
  assert.ok(lines.includes('product/'), 'the compliance checklist lives under product/');
  assert.ok(
    existsSync(path.join(cwd, 'dist/client/product/compliance/checklist.site.html')),
    'the file itself is left on disk; only the upload skips it',
  );
});

test('main says to build first when the generated file or the assets directory is missing', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'deploy-prepare-'));
  assert.throws(() => main(env(), empty), /run `pnpm build` first/);
  const noAssets = mkdtempSync(path.join(tmpdir(), 'deploy-prepare-'));
  mkdirSync(path.join(noAssets, 'dist/server'), { recursive: true });
  writeFileSync(path.join(noAssets, GENERATED_CONFIG), JSON.stringify(generated()));
  assert.throws(() => main(env(), noAssets), /assets directory .* is missing/);
});

/* -------------------------------------------------------------------------------------------
 * deploy.config.json — the committed, non-secret account facts, so a fresh clone deploys with
 * two secrets and no repository variables. The environment always wins; the file fills gaps.
 * ---------------------------------------------------------------------------------------- */

/** The live database this repo deploys against. A wrong id here is a Worker bound to nothing. */
const LIVE_ID = '2c74ea74-4d0f-492a-9b21-6e29393bfb4b';
const file = (extra = {}) => ({
  workerName: 'jaanta-hai-kya',
  d1: { name: 'jhk-db', id: LIVE_ID },
  notes: 'not a secret',
  ...extra,
});

test('the file alone is enough: an empty environment still binds the real database', () => {
  const out = prepare(generated(), {}, file());
  assert.equal(out.name, 'jaanta-hai-kya');
  assert.deepEqual(out.d1_databases, [
    { binding: 'DB', database_name: 'jhk-db', database_id: LIVE_ID, migrations_dir: DEFAULT_MIGRATIONS_DIR },
  ]);
  assert.equal('routes' in out, false, 'the file carries no domain');
});

test('the environment wins over the file, field by field', () => {
  const out = prepare(
    generated(),
    { CF_D1_DATABASE_ID: ID, CF_D1_DATABASE_NAME: 'jhk_staging', CF_WORKER_NAME: 'jhk-staging' },
    file(),
  );
  assert.equal(out.name, 'jhk-staging');
  assert.equal(out.d1_databases[0].database_id, ID);
  assert.equal(out.d1_databases[0].database_name, 'jhk_staging');
});

test('the file fills only the gaps the environment leaves', () => {
  const out = prepare(generated(), { CF_WORKER_NAME: 'jhk-staging' }, file());
  assert.equal(out.name, 'jhk-staging', 'from the environment');
  assert.equal(out.d1_databases[0].database_id, LIVE_ID, 'from the file');
  assert.equal(out.d1_databases[0].database_name, 'jhk-db', 'from the file');
});

test('a blank environment value does not shadow the file', () => {
  const out = prepare(generated(), { CF_D1_DATABASE_ID: '   ', CF_WORKER_NAME: '' }, file());
  assert.equal(out.d1_databases[0].database_id, LIVE_ID);
  assert.equal(out.name, 'jaanta-hai-kya');
});

test('neither the environment nor a file: the same error as before', () => {
  const before = 'CF_D1_DATABASE_ID is required: the uuid `wrangler d1 create` printed.';
  assert.throws(() => prepare(generated(), {}), (e) => e.message === before);
  assert.throws(() => prepare(generated(), {}, null), (e) => e.message === before);
  assert.throws(() => prepare(generated(), {}, {}), (e) => e.message === before);
  assert.throws(() => prepare(generated(), {}, { d1: {} }), (e) => e.message === before);
});

test('the placeholder id is refused from the file too, and the message says where to fix it', () => {
  assert.throws(
    () => prepare(generated(), {}, file({ d1: { name: 'jhk-db', id: PLACEHOLDER_DATABASE_ID } })),
    (e) => /placeholder/.test(e.message) && e.message.includes(DEPLOY_FILE),
  );
  assert.throws(
    () => prepare(generated(), { CF_D1_DATABASE_ID: PLACEHOLDER_DATABASE_ID }, file()),
    (e) => /placeholder/.test(e.message) && !e.message.includes(DEPLOY_FILE),
    'an env placeholder must not blame the file',
  );
});

test('a malformed value in the file is refused, and the message names the file', () => {
  for (const bad of [{ d1: { name: 'jhk-db', id: 'not-a-uuid' } }, { d1: { id: LIVE_ID, name: 'no/slash' } }]) {
    assert.throws(() => prepare(generated(), {}, { ...file(), ...bad }), (e) => e.message.includes(DEPLOY_FILE));
  }
  assert.throws(() => prepare(generated(), {}, file({ workerName: 'Has Spaces' })), /CF_WORKER_NAME is not valid/);
});

test('readFileConfig: nothing, blanks and odd shapes', () => {
  assert.deepEqual(readFileConfig(null), {});
  assert.deepEqual(readFileConfig(undefined), {});
  assert.deepEqual(readFileConfig({}), {});
  assert.deepEqual(readFileConfig({ workerName: '  ', d1: { id: '', name: null } }), {});
  assert.deepEqual(readFileConfig({ d1: { id: `  ${LIVE_ID}  ` } }), { CF_D1_DATABASE_ID: LIVE_ID });
  assert.deepEqual(readFileConfig(file()), {
    CF_WORKER_NAME: 'jaanta-hai-kya',
    CF_D1_DATABASE_NAME: 'jhk-db',
    CF_D1_DATABASE_ID: LIVE_ID,
  });
  assert.deepEqual(readFileConfig({ notes: 'x', unknown: { deep: 1 } }), {}, 'unknown fields are ignored');
  for (const bad of ['x', 42, []]) assert.throws(() => readFileConfig(bad), /is not an object/);
  assert.throws(() => readFileConfig({ d1: 'jhk-db' }), /d1 must be an object/);
  assert.throws(() => readFileConfig({ d1: { id: 12 } }), /d1\.id must be a string/);
  assert.throws(() => readFileConfig({ workerName: ['x'] }), /workerName must be a string/);
});

test('mergeConfig says where every value came from', () => {
  const { values, sources } = mergeConfig({ CF_WORKER_NAME: 'jhk-staging', CF_CUSTOM_DOMAIN: 'play.example.com' }, file());
  assert.deepEqual(values, {
    CF_WORKER_NAME: 'jhk-staging',
    CF_D1_DATABASE_NAME: 'jhk-db',
    CF_D1_DATABASE_ID: LIVE_ID,
    CF_CUSTOM_DOMAIN: 'play.example.com',
  });
  assert.deepEqual(sources, {
    CF_WORKER_NAME: 'env',
    CF_D1_DATABASE_NAME: DEPLOY_FILE,
    CF_D1_DATABASE_ID: DEPLOY_FILE,
    CF_CUSTOM_DOMAIN: 'env',
  });
  assert.deepEqual(mergeConfig({}, null), { values: {}, sources: {} });
});

test('prepare mutates neither the manifest nor the file config', () => {
  const source = generated();
  const config = file();
  const before = [JSON.stringify(source), JSON.stringify(config)];
  prepare(source, { CF_CUSTOM_DOMAIN: 'play.example.com' }, config);
  assert.deepEqual([JSON.stringify(source), JSON.stringify(config)], before);
});

test('the summary names the fields the file supplied, and stays quiet when it supplied none', () => {
  const env2 = { CF_WORKER_NAME: 'jhk-staging' };
  const { values, sources } = mergeConfig(env2, file());
  const summary = summarise(prepare(generated(), env2, file()), sources);
  assert.match(summary, /from file {6}deploy\.config\.json: CF_D1_DATABASE_ID, CF_D1_DATABASE_NAME/);
  assert.equal(summary.includes(values.CF_D1_DATABASE_ID), false, 'still no whole database id');
  assert.equal(summarise(prepare(generated(), env()), mergeConfig(env(), null).sources).includes('from file'), false);
  assert.equal(summarise(prepare(generated(), env())).includes('from file'), false, 'and with no sources at all');
});

test('main reads deploy.config.json from the working directory, and the env still overrides it', () => {
  const { cwd } = builtTree();
  writeFileSync(path.join(cwd, DEPLOY_FILE), `${JSON.stringify(file(), null, 2)}\n`);
  const { target, summary } = main({}, cwd);
  const written = JSON.parse(readFileSync(target, 'utf8'));
  assert.equal(written.name, 'jaanta-hai-kya');
  assert.equal(written.d1_databases[0].database_id, LIVE_ID);
  assert.match(summary, /from file {6}deploy\.config\.json/);

  const overridden = main({ CF_D1_DATABASE_ID: ID, CF_WORKER_NAME: 'jhk-staging' }, cwd);
  const second = JSON.parse(readFileSync(overridden.target, 'utf8'));
  assert.equal(second.d1_databases[0].database_id, ID);
  assert.equal(second.name, 'jhk-staging');
  assert.equal(second.d1_databases[0].database_name, 'jhk-db', 'the file still fills the gap');
});

test('loadFileConfig: absent is not an error, unparseable is', () => {
  const { cwd } = builtTree();
  assert.equal(loadFileConfig(cwd), null);
  assert.throws(() => main({}, cwd), /CF_D1_DATABASE_ID is required/, 'and then the env must carry it');
  writeFileSync(path.join(cwd, DEPLOY_FILE), '{ not json');
  assert.throws(() => loadFileConfig(cwd), /deploy\.config\.json is not valid JSON/);
  assert.throws(() => main(env(), cwd), /deploy\.config\.json is not valid JSON/);
});

test("the repo's own deploy.config.json is the live database and deploys as it stands", () => {
  const parsed = JSON.parse(repoFile(DEPLOY_FILE));
  assert.deepEqual(Object.keys(parsed).sort(), ['d1', 'notes', 'workerName'], 'no room for a secret');
  assert.equal(parsed.workerName, DEFAULT_WORKER_NAME);
  assert.equal(parsed.d1.name, DEFAULT_DATABASE_NAME);
  assert.equal(parsed.d1.id, LIVE_ID);
  assert.equal(typeof parsed.notes, 'string');
  assert.ok(parsed.notes.length > 40, 'the notes say what the file is and why it is not secret');
  const withoutTheId = JSON.stringify(parsed).replaceAll(LIVE_ID, '');
  assert.deepEqual(
    withoutTheId.match(/[A-Za-z0-9_-]{30,}/g) ?? [],
    [],
    'nothing token-shaped belongs in a committed file',
  );

  const out = prepare(generated(), {}, parsed);
  assert.equal(out.name, 'jaanta-hai-kya');
  assert.deepEqual(out.d1_databases[0], {
    binding: 'DB',
    database_name: 'jhk-db',
    database_id: LIVE_ID,
    migrations_dir: DEFAULT_MIGRATIONS_DIR,
  });
});

/* -------------------------------------------------------------------------------------------
 * The workflow: two secrets and a dispatch. Parsed with js-yaml (a declared devDependency, so
 * these tests do not depend on what some other package happens to hoist) and then audited as
 * text, because valid YAML is only half of what GitHub demands.
 *
 * The other half is the expression contexts. GitHub does NOT expose the `secrets` context to a
 * step's `if:` — the availability table allows it in `env:` and in a job's own env, and nowhere
 * else. `if: ${{ secrets.OPS_TOKEN != '' }}` therefore does not evaluate to false when the secret
 * is unset: it fails workflow validation, and every push produces an instant red run with ZERO
 * jobs, which looks like nothing happened at all. js-yaml parses that file perfectly happily,
 * which is exactly why the audit below reads the raw text as well.
 * ---------------------------------------------------------------------------------------- */

const WORKFLOW = '.github/workflows/deploy-worker.yml';
const workflow = () => loadYaml(repoFile(WORKFLOW));

/**
 * Every line of a workflow that mentions the `secrets` context, tagged with the block it sits in:
 * 'env' under an `env:` mapping, 'run' inside a `run:` block scalar, 'comment' for a comment, and
 * 'other' for anywhere else — which is the only bucket that can fail the file at GitHub.
 */
function secretReferences(source) {
  const rows = [];
  let block = null; // { column, kind } — the innermost env:/run: we are inside
  for (const [index, raw] of source.split('\n').entries()) {
    const trimmed = raw.trim();
    const dash = /^-\s+/.exec(trimmed);
    const column = raw.length - raw.trimStart().length + (dash ? dash[0].length : 0);
    if (block && trimmed !== '' && column <= block.column) block = null;
    // A `run:` body is shell, so nothing inside it opens a YAML block; anywhere else, it does.
    const opener = block?.kind === 'run' ? null : /^(env|run):(\s|$)/.exec(trimmed.replace(/^-\s+/, ''));
    if (opener) block = { column, kind: opener[1] };
    if (trimmed.includes('secrets.'))
      rows.push({
        line: index + 1,
        text: trimmed,
        kind: trimmed.startsWith('#') ? 'comment' : (block?.kind ?? 'other'),
      });
  }
  return rows;
}

test('the audit itself catches a secrets reference in a step condition', () => {
  const bad = [
    'jobs:',
    '  deploy:',
    '    env:',
    '      OPS_TOKEN: ${{ secrets.OPS_TOKEN }}',
    '    steps:',
    '      - name: Set it',
    "        if: ${{ secrets.OPS_TOKEN != '' }}",
    '        run: |',
    '          echo "secrets.OPS_TOKEN is fine in here"',
  ].join('\n');
  assert.deepEqual(
    secretReferences(bad).map((row) => [row.line, row.kind]),
    [
      [4, 'env'],
      [7, 'other'],
      [9, 'run'],
    ],
  );
});

test('the legacy deploy workflow is valid YAML and requires an explicit manual dispatch', () => {
  const doc = workflow();
  const on = doc.on ?? doc[true];
  assert.ok('workflow_dispatch' in on, 'the founder can run it by hand');
  assert.equal(on.push, undefined, 'the current beta must not automatically deploy the legacy Worker');
  assert.equal(on.schedule, undefined);
  assert.equal(doc.jobs.deploy.if, "needs.preflight.outputs.configured == 'true'");
});

test('every `secrets.` in the workflow sits in an env: mapping, a run: block or a comment', () => {
  const rows = secretReferences(repoFile(WORKFLOW));
  assert.ok(rows.length >= 8, `the audit found only ${rows.length} references; it is not looking`);
  assert.deepEqual(
    rows.filter((row) => row.kind === 'other'),
    [],
    'the secrets context is unavailable outside env: and run:; GitHub rejects the whole file',
  );
  assert.ok(
    rows.some((row) => row.kind === 'env'),
    'and the optional secrets are still mapped somewhere',
  );
});

test('no step or job condition reads the secrets context', () => {
  const doc = workflow();
  const conditions = [];
  for (const [name, job] of Object.entries(doc.jobs)) {
    if (job.if) conditions.push([`jobs.${name}.if`, job.if]);
    for (const step of job.steps ?? [])
      if (step.if) conditions.push([`jobs.${name}: ${step.name ?? step.uses}`, step.if]);
  }
  assert.ok(conditions.length >= 7, 'the gate and the six optional-secret steps all have one');
  for (const [where, expression] of conditions)
    assert.equal(/secrets\./.test(expression), false, `${where}: ${expression}`);
});

test('each optional Worker secret is a job-level env var and a step gated on it', () => {
  const doc = workflow();
  const OPTIONAL = ['OPS_TOKEN', 'SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'MAIL_API_KEY', 'MAIL_FROM', 'APP_ORIGIN'];
  for (const secret of OPTIONAL) {
    assert.equal(
      doc.jobs.deploy.env[secret],
      `\${{ secrets.${secret} }}`,
      `${secret} must reach the step as an env var; a step if: cannot read secrets`,
    );
    const step = doc.jobs.deploy.steps.find((s) => s.name === `Set ${secret}`);
    assert.ok(step, `no step sets ${secret}`);
    assert.equal(step.if, `env.${secret} != ''`);
    assert.match(step.run, new RegExp(`wrangler secret put ${secret}\\b`));
    assert.equal(/\$\{\{/.test(step.run), false, 'the value goes through the environment, not the command line');
  }
});

test('preflight checks out the tree and reads the database id out of the file, not its name', () => {
  const steps = workflow().jobs.preflight.steps;
  assert.ok(
    steps.some((step) => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@')),
    'without a checkout it cannot see deploy.config.json',
  );
  const check = steps.find((step) => step.id === 'check');
  assert.match(check.run, /\[ -f deploy\.config\.json \]/);
  assert.match(check.run, /database_source/);
  // The gate is the VALUE. A file that exists with no d1.id must fall through to the green
  // not-configured exit, not send the job into a red `deploy:prepare` ten minutes later.
  assert.match(check.run, /d1\?\.id|d1"\]\?\.\["id"\]|\.d1\.id/, 'the check reads d1.id');
  assert.match(check.run, /file_id/);
  assert.equal(
    /elif \[ -f deploy\.config\.json \]; then\s*\n\s*database_source=/.test(check.run),
    false,
    'the mere existence of the file is not the gate any more',
  );
});

test('the preflight gate, run as shell, answers on the value of d1.id', () => {
  const check = workflow().jobs.preflight.steps.find((step) => step.id === 'check');
  // Everything above the `if [ "${HAS_TOKEN}" …` line: the part that decides database_source.
  const decide = check.run.slice(0, check.run.indexOf('if [ "${HAS_TOKEN}"'));
  assert.match(decide, /database_source=""/, 'the extracted fragment is the deciding one');
  const run = (config, vars = {}) => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'preflight-'));
    if (config !== null) writeFileSync(path.join(cwd, DEPLOY_FILE), config);
    const script = `${decide}\nprintf '%s' "\${database_source}"\n`;
    return execFileSync('bash', ['-c', script], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, CF_D1_DATABASE_ID: '', ...vars },
    });
  };
  assert.equal(run(`${JSON.stringify(file(), null, 2)}\n`), DEPLOY_FILE, 'a real id is configured');
  assert.equal(run('{}\n'), '', 'a file with no d1.id is NOT configured');
  assert.equal(run('{ "d1": {} }\n'), '', 'and neither is an empty d1 block');
  assert.equal(run('{ not json\n'), '', 'and neither is a file that does not parse');
  assert.equal(run(null), '', 'and neither is no file at all');
  assert.equal(run('{}\n', { CF_D1_DATABASE_ID: LIVE_ID }), 'vars.CF_D1_DATABASE_ID', 'the variable still wins');
});

test('the not-configured exit is green and names exactly the two secrets', () => {
  const check = workflow().jobs.preflight.steps.find((step) => step.id === 'check');
  assert.match(check.run, /configured=false/);
  assert.equal(/exit 1/.test(check.run), false, 'an unconfigured repo never goes red');
  const named = [...new Set(check.run.match(/secrets\.[A-Z_]+/g) ?? [])].sort();
  assert.deepEqual(named, ['secrets.CLOUDFLARE_ACCOUNT_ID', 'secrets.CLOUDFLARE_API_TOKEN']);
  assert.match(check.run, /Ten-minute path/, 'and points at the doc that gets them');
});

test('the prepare step still passes every override the founder may set', () => {
  const prepareStep = workflow().jobs.deploy.steps.find((step) => step.name === 'Prepare the deploy manifest');
  assert.deepEqual(Object.keys(prepareStep.env).sort(), [
    'CF_CUSTOM_DOMAIN',
    'CF_D1_DATABASE_ID',
    'CF_D1_DATABASE_NAME',
    'CF_WORKER_NAME',
  ]);
});

test('"Where it went" reads the deployed name from the manifest and hardcodes no default', () => {
  const doc = workflow();
  const step = doc.jobs.deploy.steps.find((s) => s.name === 'Where it went');
  assert.match(step.run, /DEPLOY_CONFIG/, 'the manifest prepare wrote is the source of the name');
  assert.match(step.run, /\.name/);
  assert.equal(
    step.run.includes(DEFAULT_WORKER_NAME),
    false,
    'a default here prints a workers.dev host that does not exist when the file names another Worker',
  );
  assert.equal('CF_WORKER_NAME' in (step.env ?? {}), false, 'the variable is not what was deployed; the manifest is');
  assert.match(step.run, /APP_URL/, 'and it still says what to do with the URL');
});

test('"Where it went", run as shell, prints the name the manifest carries', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'where-it-went-'));
  mkdirSync(path.join(cwd, 'dist/server'), { recursive: true });
  const step = workflow().jobs.deploy.steps.find((s) => s.name === 'Where it went');
  const shell = (env) =>
    execFileSync('bash', ['-c', step.run], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, DEPLOY_CONFIG, CF_CUSTOM_DOMAIN: '', ...env },
    });

  writeFileSync(path.join(cwd, DEPLOY_CONFIG), JSON.stringify(prepare(generated(), { CF_D1_DATABASE_ID: ID }, file({ workerName: 'jhk-live' }))));
  const out = shell({});
  assert.match(out, /Deployed Worker 'jhk-live'\./);
  assert.match(out, /https:\/\/jhk-live\.<your-subdomain>\.workers\.dev\//);
  assert.equal(out.includes(DEFAULT_WORKER_NAME), false, 'the hardcoded default is gone');

  const domain = shell({ CF_CUSTOM_DOMAIN: 'play.example.com' });
  assert.match(domain, /https:\/\/play\.example\.com\//);
  assert.equal(/workers\.dev/.test(domain), false, 'a custom domain replaces the workers.dev line');
});

test('js-yaml is a declared devDependency, not something a transitive dep happens to hoist', () => {
  const pkg = JSON.parse(repoFile('package.json'));
  assert.equal(pkg.devDependencies['js-yaml'], '4.1.1', 'these workflow tests gate the deploy; pin what they import');
  assert.equal('js-yaml' in (pkg.dependencies ?? {}), false, 'it is a test tool, not a runtime one');
});

test('the deploy doc opens with the Ten-minute path and its seven steps', () => {
  const doc = repoFile('docs/deploy-cloudflare.md');
  const lines = doc.split('\n');
  const tenMinute = lines.indexOf('## Ten-minute path');
  assert.ok(tenMinute > 0 && tenMinute < 30, `the section is at the top (line ${tenMinute})`);
  assert.ok(tenMinute < lines.indexOf('## What runs where'));
  const section = lines.slice(tenMinute, lines.indexOf('## What runs where')).join('\n');
  for (const step of [1, 2, 3, 4, 5, 6, 7]) assert.match(section, new RegExp(`\n### ${step}\\. `), `step ${step}`);
  assert.match(section, /Edit Cloudflare Workers/, 'the token template');
  assert.match(section, /\| Account \| D1 \| \*\*Edit\*\* \|/, 'the D1 row the template may not carry');
  assert.match(section, /dash\.cloudflare\.com\/<account-id>/, 'where the account id is');
  assert.match(section, /CLOUDFLARE_API_TOKEN/);
  assert.match(section, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(section, /https:\/\/jaanta-hai-kya\.<your-subdomain>\.workers\.dev/);
  assert.match(section, /`APP_URL`/, 'so the Pages site hands players over');
  assert.match(section, /Cloudflare Registrar/);
  assert.match(section, /CF_CUSTOM_DOMAIN/);
  assert.equal(/\b(bet|wager|odds|jackpot|casino|slots|gamble)\b/i.test(section), false);
});

test('the rest of the guide agrees with step 6: Pages is a preview until APP_URL, then a hand-off', () => {
  const doc = repoFile('docs/deploy-cloudflare.md');
  const lines = doc.split('\n');
  const section = (heading) => {
    const start = lines.indexOf(heading);
    assert.ok(start > 0, `no ${heading} section`);
    const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
    return lines.slice(start, end === -1 ? lines.length : end).join('\n');
  };

  // Step 6 sets APP_URL, after which static/main.tsx renders the hand-off card and never mounts
  // the arena. A table that still promises a playable mirror sends the founder to a redirect card.
  const runsWhere = section('## What runs where');
  const pagesColumn = (row) => {
    const line = runsWhere.split('\n').find((l) => l.startsWith(`| ${row} |`));
    assert.ok(line, `no "${row}" row`);
    return line.split('|')[2];
  };
  for (const row of ['Wallet', 'Duels']) {
    assert.match(pagesColumn(row), /preview/i, `${row}: the Pages side is the preview build`);
    assert.match(pagesColumn(row), /APP_URL/, `${row}: and names the switch`);
    assert.match(pagesColumn(row), /hand-off/i, `${row}: and what it becomes`);
  }
  assert.equal(
    /Both deployments serve the same game/.test(doc),
    false,
    'they do not, once APP_URL is set',
  );

  const tradeoff = section('## Pages: keep it or retire it');
  assert.match(tradeoff, /leave `APP_URL` unset/, 'keeping the mirror is stated as the actual switch');
  assert.match(tradeoff, /set `APP_URL`/, 'and so is handing over');
  assert.equal(/\b(bet|wager|odds|jackpot|casino|slots|gamble)\b/i.test(tradeoff), false);
});

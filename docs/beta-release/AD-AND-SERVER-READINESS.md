# AYD backend and ad readiness

Reviewed 27 September 2026. This document records the initial observation, local release gates and subsequent explicitly authorized live beta verification. Advertising remains disabled.

## Backend observation

Read-only inspection of existing project `wvupsqfevlrmhqfjreyx` found PostgreSQL 17.6, the original HISAAB tables, no wallet/escrow/reward tables or room economy columns, no `expire_rooms` function, and no `pg_cron` extension. The public command function was SECURITY INVOKER. Consequently the newly implemented optional stakes were not live at that inspection. The release owner subsequently applied the current schema and complete seed transaction, deployed matching Edge function v2, and installed the scheduler. A read-only post-deployment check confirmed all private tables have RLS, anonymous RPC execution is denied, and service-role execution is allowed. The subsequent live HTTP run passed all six gates and revoked both temporary guests; details are recorded below.

The new GitHub Pages workflow builds AYD at `/andhbhakt-ya-deshbhakt/` and points to the existing `hisaab-game` Edge endpoint. Internal `hisaab` names deliberately remain stable for protocol and storage compatibility.

## Exact upgrade gate

1. Inspect the existing project, active rooms, current grants and advisors. Keep `hisaab_private` outside the exposed Data API schemas. A paused project, an active long-running transaction or a mismatched deployment is a gate to resolve first.
2. Verify the tested revision, the seed check and the byte-for-byte Edge validator match. Run `node editions/hisaab/server/seed-bank.mjs --check`; do not print the seed into logs or browser UI.
3. Apply canonical `supabase/hisaab/schema.sql` and refreshed `seed-bank.sql` as one reviewed transaction/migration. If tool transport requires staging chunks, keep the application-facing switch atomic and validate all chunks before commit. The migration adds four economy tables and four room fields, replaces helper functions, and replaces the old no-argument `make_deck` function with its defaulted parameter form. It does not reset existing guest identities or answers.
4. Historical terminal rooms are marked settled/refunded before new settlement can run. This prevents retroactive completion rewards. Existing guests receive their 100-unit starter wallet lazily, once, on a later authenticated action. Existing waiting rooms default to file `all`, stake `0` and pending economy.
5. Deploy the matching `functions/hisaab-game/index.ts` and adjacent `core.mjs` with `verify_jwt=false`. Custom 256-bit guest tokens are still checked on every private action; the service-role key remains in the Edge environment. A publishable key is not guest authentication.
6. Enable the once-per-minute expiry scheduler below and verify an actual successful run. Without it, guest actions reconcile expiry, but an unattended pot can remain reserved while the site is idle.
7. Run the two-client HTTP harness against the newly deployed endpoint with explicit live authorization. It creates only two disposable QA guests and private rooms, then revokes those two guests. Check cleanup in its report. Do not imply that this is a load test.
8. Publish the matching GitHub Pages frontend only after the schema, seed and Edge validator agree. A legacy frontend remains compatible with the new schema because omitted stake means zero. A legacy Edge validator strips new file/stake fields, so new stake UI must not be published before the new Edge code.

The populated upgrade test passed against repository baseline `b74c287`: old guests and ten old answer rows retained; historical completion rewards suppressed; starter grants idempotent; existing waiting-room defaults correct; old omitted-stake ready calls open a countdown; reapplying canonical SQL succeeds; all private tables have RLS; anonymous RPC execution stays denied.

## Expiry scheduler

The release owner installed the job as a privileged database operator. This review did not execute deployment mutations. These are the reproducible deployment instructions:

```sql
create extension if not exists pg_cron;
select cron.schedule(
  'ayd-expire-rooms',
  '* * * * *',
  $$select hisaab_private.expire_rooms(clock_timestamp());$$
);
```

The named job should be unique and active. Inspect before scheduling to avoid creating a differently named duplicate. The function processes up to 100 eligible rooms per invocation with row locks and `SKIP LOCKED`. Monitor backlog; the beta batch limit is not a guarantee for unlimited traffic.

```sql
select jobid, jobname, schedule, command, active, username
from cron.job where jobname = 'ayd-expire-rooms';

select d.status, d.return_message, d.start_time, d.end_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname = 'ayd-expire-rooms'
order by d.start_time desc limit 5;

select count(*) as old_active_rooms
from hisaab_private.rooms
where phase not in ('finished', 'cancelled')
  and created_at < clock_timestamp() - interval '15 minutes';
```

Read-only verification found job `ayd-expire-rooms` active, owned by `postgres`, running every minute. Execution history included successful runs at 03:16 and 03:17 UTC on 27 September 2026. An active job row is configuration evidence; those successful runs provide execution evidence. Snapshot polling alone is not a scheduler. Before both players ready, leaving refunds any reserved stake. After both ready, including countdown, leaving forfeits the pot to the rival. Both absent or absolute room expiry refunds; one inactive player with an active rival can forfeit. SQL regression tests cover expiry and idempotent refunds.

## Reproducible checks

PGlite 0.3.14 is an optional local test dependency, not a browser/runtime dependency. Supply its installed module path; do not add its temporary installation directory to the repository.

```sh
PGLITE_MODULE_PATH=/path/to/pglite/dist/index.js node scripts/beta-upgrade-check.mjs
PGLITE_MODULE_PATH=/path/to/pglite/dist/index.js node tests/hisaab-postgres-runner.mjs
PGLITE_MODULE_PATH=/path/to/pglite/dist/index.js node scripts/beta-duel-smoke.mjs --local
```

After the release owner deploys the backend:

```sh
HISAAB_REGION=ap-south-1 node scripts/beta-duel-smoke.mjs \
  --url=https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/hisaab-game \
  --allow-live --out=/tmp/ayd-live-beta-smoke.json
```

Only supply `HISAAB_API_KEY` if required by the deployed gateway, and only a publishable key. Never put a service-role key in a client environment. Remote mutation requires `--allow-live`; the default harness starts a local HTTP server and runs the actual Edge entry/validator against isolated PostgreSQL/WASM. The server adapter serializes that one database connection, so it cannot prove production lock concurrency.

| Check executed locally | Result |
| --- | --- |
| Populated prior-schema upgrade | 9 assertions passed |
| Actual PostgreSQL security fixture | 51 checks passed |
| Actual PostgreSQL economy fixture | 41 checks passed |
| Canonical repeatability, rollback and service-role grant checks | 3 checks passed |
| Targeted Node server/security/economy/ad suites | 36 tests passed |
| Independent HTTP guest creation and initial balance | Passed |
| Stake confirmation, duplicate ready, pre-start refund | Passed |
| Post-ready 100-unit forfeit, no double settlement | Passed |
| Zero-balance guest completes five-round zero-stake duel | Passed |
| Staked media duel pays 10-unit pot separately from 100-unit rewards | Passed |
| Answer privacy, duplicate answer/settlement, private-board exclusion | Passed |
| Cleanup of exactly the harness's two guests | Passed |

## Authorized live result

The release owner authorized the live run after deploying the backend. It completed from **03:17:08 to 03:19:00 UTC on 27 September 2026**, using **122 actual HTTP requests** and exactly **two temporary private QA guests**. All six scenario checks passed; both authenticated `deleteSession` cleanup calls succeeded. No privileged live SQL mutations, direct balance edits or injected results were used by the harness.

| Live behavior | Observed evidence |
| --- | --- |
| Distinct credentials and starter wallets | Two independent guest IDs/tokens, 100 units each |
| Confirmation and reservation retry | Incorrect stake confirmation rejected; repeated ready reserved only 20 units |
| Pre-start leave | Reserved 20 units refunded; both wallets returned to 100 |
| Post-ready leave | 100-unit stake each; loser balance 0, rival balance 200, no completion reward |
| Zero-balance access | The zero-balance guest completed all five rounds at stake 0 |
| Concurrency and privacy | Concurrent ready, two-seat answer submissions and duplicate races settled once; unanswered peer projection remained sealed |
| Normal completion | Zero-stake duel awarded 10 units to each eligible participant |
| x10 media completion | Starting balances `[10, 210]`; stake 5 each; final balances `[115, 305]`, comprising conserved 10-unit pot plus 100 reward each |
| Settlement retries | Repeated terminal snapshots did not change the balances |
| Private standings and cleanup | No daily competitive standing for either QA guest; both guest credentials revoked |

Machine-readable report from this session: `/tmp/ayd-live-beta-smoke.json`. The script can reproduce it; tokens and invite codes are omitted. This validates the deployed command path and bounded simultaneous requests, not large-scale throughput, all network conditions or latency neutrality.

The HTTP harness uses answers from the already-public reviewed bank to exercise deterministic private QA outcomes. It does not query privileged live tables, inject results, alter balances directly or join public matchmaking. Reports omit guest tokens, invite codes and raw question banks. Default report: `/tmp/ayd-beta-smoke/report.json`.

## Advertising remains off

No publisher credentials, reviewed CMP deployment or actual H5 game approval were supplied. The example configuration explicitly sets display/H5 enablement, approval and H5 test flags to false. The AYD Pages workflow supplies no ad enablement variables. `normalizeAdConfig({})` fails closed; no placeholder or fabricated video makes advertising appear live.

To activate later, the publisher must provide the real `ca-pub-` ID, approved HTTPS origin, actual site and H5 approval, a reviewed CMP with both provider signals and `window.hisaabAdConsent`, and a verified account setting disabling Auto ads. The home display slot is separate from H5 interstitials. On GitHub Pages the origin is `https://occult-kranti.github.io`, while the game base path remains `/andhbhakt-ya-deshbhakt/`; required `ads.txt` belongs at the origin root, not inside the project directory. Verify control of that root before enabling.

The cadence is one opportunity per practice completion, every second cumulative duel win or every third cumulative loss. No completed result is counted twice by normal polling/reload. Google requires a direct user gesture for the `next` placement, so the actual request follows Continue. Provider fill, format and frequency limits determine whether an ad appears; a video is not guaranteed. No watched-ad reward is minted. No-fill, blocked scripts, offline state and timeouts return control; zero-stake play remains available. See `docs/hisaab/GAME-BREAKS.md` for the complete activation and lifecycle contract.

## Current authoritative references

- [Supabase Cron](https://supabase.com/docs/guides/cron): PostgreSQL scheduler, named jobs and run history.
- [Creating and managing Cron jobs](https://supabase.com/docs/guides/cron/quickstart): schedule SQL functions and inspect execution.
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth): gateway checks versus authentication inside the function.
- [Supabase changelog](https://supabase.com/changelog): reviewed 27 September 2026. The 25 September PostgreSQL 15.19/17.11 advisory covers ltree, legacy pgcrypto ciphers, btree_gist floats and custom operators. The AYD schema uses none of those features; that observation does not audit unrelated schemas in the shared project or perform a database version upgrade.
- [Google H5 example](https://developers.google.com/ad-placement/docs/example), [adBreak](https://developers.google.com/ad-placement/apis/adbreak) and [placement types](https://developers.google.com/ad-placement/docs/placement-types): actual SDK integration, direct gesture, no-fill callbacks and interstitial semantics.

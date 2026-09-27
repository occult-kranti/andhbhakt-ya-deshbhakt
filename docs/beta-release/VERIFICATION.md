# Beta release verification

## Andhbhakt ya Deshbhakt

- Full repository Node suite: **938 passed**, zero failures/skips (local final source before publication).
- Whole-repository TypeScript check and standalone production build passed.
- Static artifact verifier: **213 files, 62 local references**. All 29 font references resolve; Hindi font subsets are bundled.
- Visual/functional browser checks: home/certificate at 320, 390 and 1440 pixels; local photo resize/export/removal; online XP progression; temporary hidden title export and identity reset.
- Populated previous-version PostgreSQL upgrade: **9 assertions passed** preserving guests and historic answers and suppressing retroactive rewards.
- Local real-PostgreSQL security/economy/privilege suites: **95 checks passed**.
- Deployed SQL rollback suites: **51 security + 41 economy assertions passed**; fixtures rolled back.
- Deployed API: **122 real HTTP requests, six scenario groups passed**, two private guests deleted afterward. Confirmed concurrent ready/answer retries, zero-balance zero-stake completion, prestart refund, poststart forfeit, x10 rewards distinct from stake pot and terminal idempotency.
- Supabase Edge `hisaab-game` version **2** active. Private tables RLS-protected; anon RPC execution denied; service role allowed.
- `ayd-expire-rooms` cron active once per minute; successful executions observed.

## Jaanta Hai Kya

- Full repository Node suite: **950 passed**, zero failures/skips; TypeScript check passed.
- Isolated JHK server: **86 local PostgreSQL checks**, **83 deployed SQL rollback checks**.
- Deployed API: **17 scenario checks passed**, including a complete five-round duel, concurrent duplicate ready/answer requests, exactly-once XP/settlement, zero stake, refund, forfeit and both-direction cross-game credential rejection. QA guests cleaned up.
- Supabase Edge `jhk-game` version **1** active. `jhk-expire-rooms` cron verified active and successfully executed every minute.
- JHK browser/publication evidence is appended after the final UI gate and public Pages deployment.

The tests do not establish broad traffic capacity, geographic fairness, physical-phone behavior or ad fill. API checks used independently authenticated private QA guests; fixture-based certificate tests are identified separately. Ads remain disabled pending real approved configuration.

## Public publication

GitHub Pages deployment/run IDs, main commit SHAs and fetched `release.json` evidence will be recorded after publication. Passing a local build or a source push is not publication evidence.

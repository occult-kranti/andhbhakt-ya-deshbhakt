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
- Actual JHK two-browser UI gate: **11 checks passed, zero browser errors** at 320px dark and 1280px light. Completed five shared rounds, explicit stakes, reload/answer recovery, persistent XP/coins, leaderboard, learning route, and Player server card. Both QA guests deleted. This executor blocked direct Chromium API egress; an exact-endpoint Node fetch relay forwarded the real requests/responses without fixtures. Direct API OPTIONS preflight returned 204 with the required CORS origin/method/header permissions. Public Pages verification is recorded below.

The tests do not establish broad traffic capacity, geographic fairness, physical-phone behavior or ad fill. API checks used independently authenticated private QA guests; fixture-based certificate tests are identified separately. Ads remain disabled pending real approved configuration.

## Public publication

Both sites were fetched over HTTPS after successful GitHub Pages Actions deployments. Their public `release.json` records matched their published main commits. The public home screens and human-duel entry screens rendered in the cloud browser.

| Game | Initial live main commit | Successful Pages run | Observed build timestamp |
| --- | --- | --- | --- |
| Andhbhakt ya Deshbhakt | `848637cdcb0ebf20ebb133f02196bf49c60d8e79` | [36291398575](https://github.com/occult-kranti/andhbhakt-ya-deshbhakt/actions/runs/36291398575) | `2026-09-27T03:27:34.755Z` |
| Jaanta Hai Kya | `b7c506e53e5bb48b94d1d57971169c6c4e0a22eb` | [36291590820](https://github.com/occult-kranti/fact-duel/actions/runs/36291590820) | `2026-09-27T03:31:34.183Z` |

AYD social art, manifest and privacy page returned HTTP 200. The historical `/fact-duel/hisaab/` address returns a redirect page preserving the invite query/hash to the new AYD repository site. Both root Pages URLs returned HTTP 200. Each deployment publishes a fresh `release.json`; compare it to the current main commit when verifying a later release.

## Bounded post-publication correction

The public walkthrough exposed inherited offline mission promises and JHK rules/metadata. Home now shows only practice missions supported by actual local learning/Vault events, with an accurate visible count and no unreachable all-three reward promise. Online duel results remain server-managed and are explicitly separate from device practice missions. AYD's two focused mission tests, TypeScript and final standalone production build passed. JHK's online rules routes use the actual server timing, stake, refund and guest-identity contract; its metadata describes live human duels. JHK's 11 focused client/mission tests and TypeScript passed. Its bounded browser check at 320/1280 pixels verified supported missions, Online beta labels and all three footer rules paths, with zero page errors and no horizontal overflow; no server guests were created. The final production build and emitted description/canonical/OG asset assertions passed. These presentation/routing corrections do not modify deployed SQL, Edge handlers or settlement logic. The final source deployment runs the full repository test and TypeScript gates again.

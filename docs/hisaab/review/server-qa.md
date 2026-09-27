# Server multiplayer security and fairness review

This review covers the HISAAB server edition only. The existing local bot,
friend P2P, pass-and-play and learning paths retain their existing contracts.

## Evidence boundaries

`tests/hisaab-online-security.test.mjs` exercises the transport validators and
small rule helpers. Those checks do **not** prove database authorization,
transaction locking, leaderboard grants, or Internet delivery. The SQL
integration script and API exerciser are separate evidence for those boundaries.

The competition question bank is also available in the learning client. Keeping
unanswered receipts out of a room response prevents an accidental in-match leak;
it cannot prevent a modified client from consulting the public bank. Device
credentials do not establish one person per account. Server receipt timing also
includes network delay. None of these tests establish equal network conditions
or cheat-proof competition.

## Required release checks

| Boundary | Evidence required |
| --- | --- |
| Auth | Random bearer credential, hash-only persistence, expired/revoked credential rejected; other players cannot read or mutate a room |
| Projection | No future deck or answer key for an unanswered player; first-answer feedback stays private |
| Authority | Client-supplied elapsed time, score, XP, identity and winner cannot change server calculation |
| Attempt | First answer locks; duplicate delivery cannot replace an answer or award twice |
| Timing | Pre-start and post-deadline input rejected; 8/15-second XP and 120 ms tie boundaries verified |
| Lifecycle | Both-answer completion is immediate; deadline, leave and resume have deterministic outcomes |
| Competition | Private friend matches do not enter public standings; rank ordering is stable; title availability expires with its period |
| Database | Exposed roles cannot read private tables or invoke privileged functions directly |
| Regression | Existing local/P2P modes and the other game's rules remain unchanged |

## Safe live test policy

The live API script uses only `HISAAB_QA_` identities and private friend rooms.
It does not enter public matchmaking or tournaments, seed leaderboard results,
or delete real player data. Credentials are never included in its report. The
SQL suite runs inside one transaction and ends with `ROLLBACK`; its fixture
clock changes and competition rows cannot escape that transaction.

## Results

Executed on **27 September 2026**:

| Check | Actual result |
| --- | --- |
| Focused local regressions | **67/67 passed**: original JHK duel rules, HISAAB immediate bot/personal receipts, P2P/pass-and-play, new validation/token/rule helpers |
| Actual SQL authority | **51 assertions passed** in PGlite; the release owner then executed the same rollback-only file against the deployed Supabase database successfully |
| Fixture isolation | Local SQL post-rollback counts: **zero sessions, zero rooms**; all changes in the live SQL run were rolled back |
| Regional live API | **9/9 checks passed**, **115 requests**, five private rounds, four duplicate attempts per player per round (eight concurrent commands), eight concurrent snapshot reads |
| Live integrity | Both-answer results arrived in answer acknowledgements; receipt/replay consistency, no outsider room access, no public standing from private play, circle membership race and leave/reconnect passed |
| Live cleanup | All three identities created by the successful run were revoked. All three identities from the earlier routing attempt were also revoked. No public matchmaking/tournament entry occurred |
| Body limit | Separate deployed request exceeding 4 KiB returned **413 `TOO_LARGE`**. This check is now included in the reusable harness |

Evidence files are `online/sql-security-local.json`,
`online/api-regional-security.json`, and `online/security-regression.log`.
The SQL suite is `tests/hisaab-online-security.sql`. It uses a future competition
period for deterministic title fixtures and checks actual database function/table
privileges. This is not a simulation of authorization in JavaScript.

The first API attempt used automatic Edge routing to US regions. Its follow-up
snapshot arrived after the short countdown, exposing an invalid assumption in
the **test** that a network response must arrive within 2.5 seconds. The harness
now checks the ready acknowledgement that actually opens the countdown. That
attempt is retained in `online/api-automatic-routing-attempt.json`; it is not
counted as a passing end-to-end game. The successful run used the frontend's
`x-region: ap-south-1` routing.

## Findings addressed

- The current round's opponent score initially revealed whether their private
  answer was correct. The projection now excludes that answer until settlement.
- Countdown snapshots initially contained the playable prompt. Questions are now
  issued only after opening, with immutable per-seat dispatch timestamps.
- SQL variable/table alias collisions in matchmaking and circle deletion were
  reproduced and fixed before final deployment.
- A possible final-result foreign-key deadlock was removed by using
  `FOR NO KEY UPDATE` for the session lock. Room locks and unique result keys
  retain settlement serialization. The live private-game burst passed; ranked
  inserts and repeat settlement are covered by rollback SQL fixtures.
- Circle leave/delete now lock the relevant circle before membership cleanup.
  In the live leave/join race, leave won; the join returned `CIRCLE_NOT_FOUND`
  rather than acknowledging a membership that disappeared.

The Supabase advisor's new HISAAB informational messages about RLS without
policies describe the intentional deny-all browser boundary. Browser roles have
neither private-schema usage nor table/function access. Only the Edge service
role invokes the command RPC. Existing unrelated project warnings were not
changed as part of this edition.

## Remaining release limitation: measured latency

The successful regional run took approximately **152 seconds**. Across 102
successful HTTP responses, this runner measured **p50 3,794 ms**, **p95 7,936 ms**,
and **maximum 8,413 ms**. Answer requests measured p50 **4,469 ms**, with a minimum
of **476 ms**. These samples include duplicate/concurrent bursts, cold paths and
the execution environment's network proxy; they do not isolate database time.
All recorded responses in that run came from `ap-south-1`.

A read-only Supabase log query over the exact same time window found **102
successful function executions**, with **p50 418 ms**, **p95 934 ms**, and
**maximum 1,084 ms**. Only duration, response status and region aggregates were
collected; no player data, network addresses or bearer headers were retrieved.
See `online/api-regional-server-durations.json`. These aggregates indicate that
the runner's long tail is not entirely time executing the Edge function. They
do not identify the exact cause of individual network/gateway/proxy delays.

**P1 for a broad competitive launch:** repeat on actual phones across separate
networks before promising responsive, equal competition. No high-concurrency
capacity or low-latency claim follows from this small integrity test. A
functional online pilot is supported by the evidence; a latency/fairness
guarantee is not.

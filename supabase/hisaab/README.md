# HISAAB online server

This is an isolated Supabase backend for the HISAAB edition. It does not modify the other game's server, authentication, wallet, or tables.

## Deployment

1. Apply `schema.sql` as a reviewed migration. The `hisaab_private` schema must remain outside PostgREST's exposed schemas.
2. Apply `seed-bank.sql` using a privileged migration connection. It contains the existing reviewed learning bank and explicit file memberships. Future question revisions should update this seed from the source bank and be audited for factual accuracy.
3. Deploy `functions/hisaab-game/index.ts` and its adjacent `core.mjs` as Edge Function `hisaab-game`, with `verify_jwt = false`. The function **does its own authentication**: all non-creation commands require a 256-bit bearer secret in `x-hisaab-session`; only the SHA-256 hash reaches the database. Supabase's automatically provisioned service-role key remains server-side.
4. Configure the browser's function URL and publishable key. Send `x-region: ap-south-1` to keep game commands near the existing project's database. A publishable key is not a player identity.
5. Exercise the security SQL in a transaction rolled back after execution and the live two-guest API harness before releasing a changed schema.

No package dependency is required inside the Edge Function. `core.mjs` must exactly match the tested copy in `editions/hisaab/server/core.mjs`.

## HTTP contract

`POST /functions/v1/hisaab-game`, JSON `{action, ...payload}`, `Content-Type: application/json`, `x-hisaab-session: <token>` except for `session`. Success is `{ok:true, serverNow:<epoch ms>, ...data}`. Errors are `{ok:false,error:{code,message}}`; bad input is 400, missing/expired guest token 401, throttled 429, unavailable database 503. All responses are non-cacheable. Bodies are streamed with a 4096-byte cap.

| Action | Payload | Success data |
| --- | --- | --- |
| `session` | `{nickname}` | `{token, session:{id,nickname,expiresAt,onlineXp,balance,savings,title?}}` |
| `profile` | `{nickname?}` | `{session}` |
| `deleteSession` | `{}` | `{deleted:true}` |
| `create` | `{file?,stake?}` | `{match}`; private invitation room |
| `join` | `{code}` | `{match}`; 12-character private code |
| `queue` | `{mode:'ranked'\|'tournament',file?,stake?}` | `{match}` |
| `snapshot` | `{roomId}` | `{match}` |
| `ready` / `next` | `{roomId,stake?}` | `{match}` |
| `answer` | `{roomId,round,choice,requestId}` | `{match}`; choice 0–3, requestId UUID |
| `leave` | `{roomId}` | `{match}`; unfinished match cancelled |
| `leaderboards` | `{period:'daily'\|'weekly'\|'savings'}` | board fields below |
| `tournaments` | `{}` | `{tournaments:[{id,name,startsAt,endsAt,status,format,minimumMatches,minimumOpponents}],standings:<board>}` |
| `circles` | `{operation:'list'\|'create'\|'join'\|'rename'\|'leave',circleId?,code?,name?,kind?:'friends'\|'family',nickname?}` | `{circles:[{id,code,name,kind,nickname,members:[{id,nickname}]}]}` |

The browser persists the guest secret on its device, separately from local practice XP. Clearing browser data loses access. Guests expire after 30 days; this is credential expiry, **not an automatic data-deletion policy**. Authenticated `deleteSession` revokes the secret, removes the public ranking record and circle memberships, and anonymizes the retained historical match identity. It cancels active matches under the same disclosed forfeit/refund policy as leaving. This endpoint never imports locally claimed scores.

A snapshot contains `id, code, mode, phase, round, roundCount, startsAt, deadlineAt, nextAt, serverNow, selfId, players, question, receipt, result, winnerId, reason`.

- `phase`: `waiting`, `countdown`, `question`, `result`, `finished`, or `cancelled`.
- `players`: `{id,nickname,ready,answered,score}`. The opponent's score includes only previously settled rounds while the current question is open.
- `question`: `null` during waiting/countdown, otherwise `{id,prompt:{en,hi},options:[{en,hi}],category}`. Option positions are shuffled on the server for each match.
- `receipt`: only the requesting player's answer, immediately after it locks: `{choice,correct,correctIndex,elapsedMs,xp,explanation:{en,hi},sourceUrl}`.
- `result`: only after both answers or the server deadline: `{winnerId,correctIndex,explanation,sourceUrl,answers:[{playerId,choice,correct,elapsedMs,xp}]}`.
- `startsAt` becomes the requesting player's immutable first question-release timestamp. `deadlineAt` is the common hard cutoff; compute remaining time independently of elapsed time. The UI must render a prompt only when present, not infer it from a countdown.

## Match rules and timing

Both human players explicitly ready for a five-round match. No queue inserts a bot or silently broadens the selected file. Each round begins with a 2.5-second countdown, then a shared 30-second deadline. A question is released separately on each player's first valid question-phase snapshot, recorded exactly once. Reaction measurement starts at that server release preparation, rather than charging a random polling phase to the player. Answer time is captured at the database command's entry, before row locking. No claimed client timestamp, score, correctness, XP or identity is accepted.

This measurement still includes response delivery and answer network latency. It is **not latency-neutral** and is not a hardware reaction-time measurement. A 120 ms inclusive dead-heat band absorbs small differences; it does not eliminate differences between networks. Late arrivals do not extend the common deadline. Snapshots after reconnect cannot reset a release timestamp. A first answer locks permanently, duplicate requests cannot award twice, and settlement is idempotent under a room-row lock.

A round prioritizes correctness, then server-measured answer speed. Wrong or missing answers cannot win against a correct answer. A match prioritizes total correct answers, then the sum of measured times; wrong/missing answers contribute 30 seconds to that sum. An aggregate difference of 120 ms or less is a draw. Correct-answer XP is 30 below 8 seconds, 20 below 15 seconds, otherwise 10; incorrect/missing earns zero. Server answer XP is separate from practice XP and remains after quitting.

The next round starts after both players continue, or after a ten-second result break on the next snapshot. There is no continuously running timer process: commands reconcile deadlines and progression. Empty public queues expire after three minutes, private invitations and live rooms after fifteen minutes. Leaving before both players ready refunds any reserved stake. Leaving after both players ready (including the countdown) transfers the pot to the other seat, without a ranked result or completion reward. A one-sided absence beyond 90 seconds has the same consequence if the rival is still active; both absent or absolute room expiry refunds the stakes. Guest deletion follows the same policy, so deleting a losing identity cannot avoid a wager. Server records from completed matches remain available to their players.

## Competition and the hidden title

Daily boards reset at 00:00 UTC. Weekly boards and the recurring “The Weekly Edition” tournament run Monday 00:00 UTC to the following Monday. Public ranked and tournament results may contribute to the daily/weekly board. Private games never do. Both players must answer at least three questions for a completed public game to count.

Only the first eligible match against each opponent per UTC day contributes. A board needs at least three completed eligible matches and three distinct opponents. Daily/weekly points are cumulative. The tournament counts the best five eligible results, sorted by points, correct answers and time; its distinct-opponent qualification considers the whole eligible window.

A win earns three standings points, a draw one, a loss zero. Board order is points descending, correct answers descending, aggregate time ascending, last counted completion ascending, then stable player ID. Board output is `{period,competitionId,startsAt,endsAt,minimumMatches:3,minimumOpponents:3,rows:[...],self}`. Rows contain `{rank,id,nickname,matches,opponents,wins,points,correct,elapsedMs,title}`.

Only ranks 1–10 get a `title` envelope: `{title:'certified-antinational',name:'Certified Anti-National',source:'leaderboard'|'tournament',rank,awardedAt,expiresAt,competitionId}`. Eligibility is recalculated from authoritative standings. It expires with that competition window and disappears when the player leaves the top ten; it is not a permanent XP rank or a promise of a real-world distinction.

## Security and operational limits

All tables use RLS and deny `anon`/`authenticated` access. The private schema and internal functions are not a public API. The public RPC uses `SECURITY INVOKER`, an empty search path, and an explicit service-role-only execute grant. IDs and membership are checked for every room/circle read or write. A guest can join at most ten circles; a circle holds at most fifty members. Codes have 48-bit entropy for temporary rooms and 64-bit entropy for circles; do not place them in public marketing screenshots.

Guest creation has an hourly network-hash limiter; all guest actions have a per-minute database limiter. Edge gateway network headers are an abuse signal, not a verified identity. Pseudonymous guests can still create multiple accounts or cooperate. The learning bank is already public in the practice product: shuffling positions and suppressing answer keys before a response do **not** make questions secret or prevent lookup, bots, collusion, or answer sharing. These are casual beta standings, not a certified competition or a real-money product.

Start with adaptive snapshot polling, longer idle intervals, and stop polling after leaving/unmount. Watch Edge invocation and database usage before widening the audience. A future private Realtime broadcast may wake clients, but snapshots must remain authoritative; do not rely on a broadcast message for durable settlement. A private rotating bank, stronger identities, moderation/reporting, production monitoring, scheduled data cleanup and an explicit dispute policy are gates before prizes or a large organized competition.


## Optional UPI tax savings stakes and file rewards

“UPI tax savings” is a satirical label for free, nonredeemable game units. It does not refer to actual UPI payments or tax savings. There is no deposit, purchase, cash-out or payment API. Each guest receives 100 units once; an existing guest gets its wallet lazily on its next authenticated action. These device guest identities remain distinct from account login.

`file` is `all` (default), `today`, `subsidies`, `pre-election`, or `media`. `stake` is a whole number from 0 through 10,000, default 0, **per five-round match**, with the same amount for each player. Public matchmaking requires an exact file and stake match. The server selects reviewed bank items by explicit file metadata; media uses an enumerated ownership subset, pre-election uses existing editorial tags, and subsidies uses welfare/subsidy and distribution items. Today's file uses a deterministic UTC-date order; option positions still shuffle. No bank-size value appears in a game response.

`create`/`queue` checks affordability; a private `join` only reveals terms. `ready` must echo the room's exact stake (omitted zero remains backward compatible). Each confirmed seat reserves its stake exactly once before the first question; a failed second reservation cannot start play. Zero is always permitted, including at a zero balance. Winner receives the two reserved stakes. A draw refunds both stakes. Forfeits, cancellations and expiry follow the policy above. The x10 badge never multiplies the wager or pot.

Each participant earns a separate **10-unit completion reward**, or **100 units (x10)** in subsidies, pre-election and media files, when both humans answered at least three questions and that participant has at least one correct answer. Each guest can receive that reward once per file per UTC day. Cancelled/forfeited/idle matches receive no reward. The database's unique reward claim and room settlement state make retries idempotent. This limit reduces easy replay farming; disposable identities and cooperating humans can still game a casual beta economy.

The match includes `file`, `stake`, `rewardMultiplier` and `economy:{status,balance,savings,reserved,payout,reward}`. `status` is `pending`, `reserved`, `settled`, or `refunded`. `payout` includes an own-stake refund or whole-pot receipt, and `reward` is separately minted. Terminal forfeits retain phase `cancelled`, with `winnerId` and reason `player-left-forfeit`, `disconnect-forfeit`, or `profile-deleted-forfeit`; they never create standings credit. Profile responses expose spendable `balance`, owned `savings` (balance plus one's reserved stake), and freshly calculated `title` or null.

The savings leaderboard ranks current owned savings, including reserved stake so readiness alone cannot remove a title. At least one earned completion reward is required to appear; a starter grant alone never wins a title. Ties use stable player ID. Only current position 1 receives `{source:'savings',title:'certified-antinational',...}`. It expires at the next UTC day boundary and revokes immediately on displacement, deletion or guest expiry. Its balance is not a daily-reset metric. Existing eligible top-ten daily/weekly/tournament standings retain their original qualification and expiry rules, under the same renamed hidden title. Certificates must refresh `profile` and use its live grant; cached titles are not authority.

## Rollout and unattended expiry

This branch does not deploy or mutate production. Stage changes in this order: apply the canonical `schema.sql` in a transaction; apply refreshed `seed-bank.sql`; run both rollback SQL suites; deploy the matching Edge `core.mjs`/function; deploy the GitHub Pages build from an approved release. The canonical SQL adds columns/tables idempotently and marks historical terminal rooms settled/refunded so old matches cannot mint retroactive rewards. No account balance is imported from browser state.

Every authenticated command reconciles up to 100 expired rooms. For timely unattended release, configure a trusted database scheduler once per minute to run `select hisaab_private.expire_rooms(clock_timestamp());`. With the Supabase Cron extension already enabled, an operator can schedule this SQL under a privileged role. Keep `hisaab_private` unexposed. If no requests or scheduler run, expiry is reconciled on the next guest action; elapsed wall time alone is not a running process. All mutation helpers stay private, RLS-protected, and service-role-only. Review Supabase advisors and monitor queue/wallet errors before a wider release.

Run the existing `tests/hisaab-online-security.sql` and new `tests/hisaab-online-economy.sql` against a staging database in one transaction per complete file; each rolls back its fixtures. To reproduce locally without a Postgres daemon:

```sh
npm install --prefix /tmp/hisaab-pg --no-audit --no-fund --save-exact @electric-sql/pglite@0.3.14
PGLITE_MODULE_PATH=/tmp/hisaab-pg/node_modules/@electric-sql/pglite/dist/index.js node tests/hisaab-postgres-runner.mjs
node --test tests/hisaab-server-core.test.mjs tests/hisaab-online-security.test.mjs tests/hisaab-online-client.test.mjs tests/hisaab-online-economy.test.mjs
```

PGlite executes the real PostgreSQL functions, constraints and transactions. Its single connection does **not** test concurrent database connections, production traffic, real network timing or a deployed scheduler. Room locks, sorted wallet locks and unique ledger/claim keys are the concurrency design; multi-client staging tests remain a rollout gate.

## Sources checked September 2026

- Supabase changelog: <https://supabase.com/changelog.md> (September 25 PostgreSQL/pgcrypto legacy-cipher changes do not affect new SHA-256 guest hashes; no removed `logs.all` API is used).
- Supabase Edge authorization: <https://supabase.com/docs/guides/functions/auth> and <https://supabase.com/docs/guides/functions/auth-headers>.
- Supabase RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>.
- PostgreSQL explicit locking: <https://www.postgresql.org/docs/current/explicit-locking.html>.
- PostgreSQL transaction isolation: <https://www.postgresql.org/docs/current/transaction-iso.html>.

These are implementation references. Local unit checks and rollback integration tests demonstrate bounded behavior; they are not evidence of production-scale performance or cheat resistance.

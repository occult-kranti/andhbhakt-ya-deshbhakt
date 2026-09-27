# HISAAB online server

This is an isolated Supabase backend for the HISAAB edition. It does not modify the other game's server, authentication, wallet, or tables.

## Deployment

1. Apply `schema.sql` as a reviewed migration. The `hisaab_private` schema must remain outside PostgREST's exposed schemas.
2. Apply `seed-bank.sql` using a privileged migration connection. It contains the current 940-question learning bank. Future question revisions should update this seed from the source bank and be audited for factual accuracy.
3. Deploy `functions/hisaab-game/index.ts` and its adjacent `core.mjs` as Edge Function `hisaab-game`, with `verify_jwt = false`. The function **does its own authentication**: all non-creation commands require a 256-bit bearer secret in `x-hisaab-session`; only the SHA-256 hash reaches the database. Supabase's automatically provisioned service-role key remains server-side.
4. Configure the browser's function URL and publishable key. Send `x-region: ap-south-1` to keep game commands near the existing project's database. A publishable key is not a player identity.
5. Exercise the security SQL in a transaction rolled back after execution and the live two-guest API harness before releasing a changed schema.

No package dependency is required inside the Edge Function. `core.mjs` must exactly match the tested copy in `editions/hisaab/server/core.mjs`.

## HTTP contract

`POST /functions/v1/hisaab-game`, JSON `{action, ...payload}`, `Content-Type: application/json`, `x-hisaab-session: <token>` except for `session`. Success is `{ok:true, serverNow:<epoch ms>, ...data}`. Errors are `{ok:false,error:{code,message}}`; bad input is 400, missing/expired guest token 401, throttled 429, unavailable database 503. All responses are non-cacheable. Bodies are streamed with a 4096-byte cap.

| Action | Payload | Success data |
| --- | --- | --- |
| `session` | `{nickname}` | `{token, session:{id,nickname,expiresAt,onlineXp}}` |
| `profile` | `{nickname?}` | `{session}` |
| `deleteSession` | `{}` | `{deleted:true}` |
| `create` | `{}` | `{match}`; private invitation room |
| `join` | `{code}` | `{match}`; 12-character private code |
| `queue` | `{mode:'ranked'\|'tournament'}` | `{match}` |
| `snapshot` | `{roomId}` | `{match}` |
| `ready` / `next` | `{roomId}` | `{match}` |
| `answer` | `{roomId,round,choice,requestId}` | `{match}`; choice 0–3, requestId UUID |
| `leave` | `{roomId}` | `{match}`; unfinished match cancelled |
| `leaderboards` | `{period:'daily'\|'weekly'}` | board fields below |
| `tournaments` | `{}` | `{tournaments:[{id,name,startsAt,endsAt,status,format,minimumMatches,minimumOpponents}],standings:<board>}` |
| `circles` | `{operation:'list'\|'create'\|'join'\|'rename'\|'leave',circleId?,code?,name?,kind?:'friends'\|'family',nickname?}` | `{circles:[{id,code,name,kind,nickname,members:[{id,nickname}]}]}` |

The browser persists the guest secret on its device, separately from local practice XP. Clearing browser data loses access. Guests expire after 30 days; this is credential expiry, **not an automatic data-deletion policy**. Authenticated `deleteSession` revokes the secret, removes the public ranking record and circle memberships, and anonymizes the retained historical match identity. It cancels active matches. This endpoint never imports locally claimed scores.

A snapshot contains `id, code, mode, phase, round, roundCount, startsAt, deadlineAt, nextAt, serverNow, selfId, players, question, receipt, result, winnerId, reason`.

- `phase`: `waiting`, `countdown`, `question`, `result`, `finished`, or `cancelled`.
- `players`: `{id,nickname,ready,answered,score}`. The opponent's score includes only previously settled rounds while the current question is open.
- `question`: `null` during waiting/countdown, otherwise `{id,prompt:{en,hi},options:[{en,hi}],category}`. Option positions are shuffled on the server for each match.
- `receipt`: only the requesting player's answer, immediately after it locks: `{choice,correct,correctIndex,elapsedMs,xp,explanation:{en,hi},sourceUrl}`.
- `result`: only after both answers or the server deadline: `{winnerId,correctIndex,explanation,sourceUrl,answers:[{playerId,choice,correct,elapsedMs,xp}]}`.
- `startsAt` becomes the requesting player's immutable first question-release timestamp. `deadlineAt` is the common hard cutoff; compute remaining time independently of elapsed time. The UI must render a prompt only when present, not infer it from a countdown.

## Match rules and timing

Both players explicitly ready for a five-round match. Each round begins with a 2.5-second countdown, then a shared 30-second deadline. A question is released separately on each player's first valid question-phase snapshot, recorded exactly once. Reaction measurement starts at that server release preparation, rather than charging a random polling phase to the player. Answer time is captured at the database command's entry, before row locking. No claimed client timestamp, score, correctness, XP or identity is accepted.

This measurement still includes response delivery and answer network latency. It is **not latency-neutral** and is not a hardware reaction-time measurement. A 120 ms inclusive dead-heat band absorbs small differences; it does not eliminate differences between networks. Late arrivals do not extend the common deadline. Snapshots after reconnect cannot reset a release timestamp. A first answer locks permanently, duplicate requests cannot award twice, and settlement is idempotent under a room-row lock.

A round prioritizes correctness, then server-measured answer speed. Wrong or missing answers cannot win against a correct answer. A match prioritizes total correct answers, then the sum of measured times; wrong/missing answers contribute 30 seconds to that sum. An aggregate difference of 120 ms or less is a draw. Correct-answer XP is 30 below 8 seconds, 20 below 15 seconds, otherwise 10; incorrect/missing earns zero. Server answer XP is separate from practice XP and remains after quitting.

The next round starts after both players continue, or after a ten-second result break on the next snapshot. There is no continuously running timer process: commands reconcile deadlines and progression. Empty public queues expire after three minutes, private invitations and live rooms after fifteen minutes. Leaving cancels an unfinished match; it produces no ranked result, win, or loss. Server records from completed matches remain available to their players.

## Competition and the hidden title

Daily boards reset at 00:00 UTC. Weekly boards and the recurring “The Weekly Edition” tournament run Monday 00:00 UTC to the following Monday. Public ranked and tournament results may contribute to the daily/weekly board. Private games never do. Both players must answer at least three questions for a completed public game to count.

Only the first eligible match against each opponent per UTC day contributes. A board needs at least three completed eligible matches and three distinct opponents. Daily/weekly points are cumulative. The tournament counts the best five eligible results, sorted by points, correct answers and time; its distinct-opponent qualification considers the whole eligible window.

A win earns three standings points, a draw one, a loss zero. Board order is points descending, correct answers descending, aggregate time ascending, last counted completion ascending, then stable player ID. Board output is `{period,competitionId,startsAt,endsAt,minimumMatches:3,minimumOpponents:3,rows:[...],self}`. Rows contain `{rank,id,nickname,matches,opponents,wins,points,correct,elapsedMs,title}`.

Only ranks 1–10 get a `title` envelope: `{title:'desh-bhakt',name:'Desh Bhakt',source:'leaderboard'|'tournament',rank,awardedAt,expiresAt,competitionId}`. Eligibility is recalculated from authoritative standings. It expires with that competition window and disappears when the player leaves the top ten; it is not a permanent XP rank or a promise of a real-world distinction.

## Security and operational limits

All tables use RLS and deny `anon`/`authenticated` access. The private schema and internal functions are not a public API. The public RPC uses `SECURITY INVOKER`, an empty search path, and an explicit service-role-only execute grant. IDs and membership are checked for every room/circle read or write. A guest can join at most ten circles; a circle holds at most fifty members. Codes have 48-bit entropy for temporary rooms and 64-bit entropy for circles; do not place them in public marketing screenshots.

Guest creation has an hourly network-hash limiter; all guest actions have a per-minute database limiter. Edge gateway network headers are an abuse signal, not a verified identity. Pseudonymous guests can still create multiple accounts or cooperate. The learning bank is already public in the practice product: shuffling positions and suppressing answer keys before a response do **not** make questions secret or prevent lookup, bots, collusion, or answer sharing. These are casual beta standings, not a certified competition or a real-money product.

Start with adaptive snapshot polling, longer idle intervals, and stop polling after leaving/unmount. Watch Edge invocation and database usage before widening the audience. A future private Realtime broadcast may wake clients, but snapshots must remain authoritative; do not rely on a broadcast message for durable settlement. A private rotating bank, stronger identities, moderation/reporting, production monitoring, scheduled data cleanup and an explicit dispute policy are gates before prizes or a large organized competition.

## Sources checked September 2026

- Supabase changelog: <https://supabase.com/changelog.md> (September 25 PostgreSQL/pgcrypto legacy-cipher changes do not affect new SHA-256 guest hashes; no removed `logs.all` API is used).
- Supabase Edge authorization: <https://supabase.com/docs/guides/functions/auth> and <https://supabase.com/docs/guides/functions/auth-headers>.
- Supabase RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>.
- PostgreSQL explicit locking: <https://www.postgresql.org/docs/current/explicit-locking.html>.
- PostgreSQL transaction isolation: <https://www.postgresql.org/docs/current/transaction-iso.html>.

These are implementation references. Local unit checks and rollback integration tests demonstrate bounded behavior; they are not evidence of production-scale performance or cheat resistance.

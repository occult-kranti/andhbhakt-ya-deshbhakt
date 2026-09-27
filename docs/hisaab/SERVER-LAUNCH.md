# HISAAB DO — server launch and operating plan

Reviewed **27 September 2026**. This is the server expansion of the independent HISAAB site. Keep its source on `claude/loving-pasteur-s8xwtf`, its publication on the separate HISAAB Sites project, and Jaanta Kya Hai and `main` unchanged. Domain registration is deliberately excluded from the service list below.

## Architecture and release boundary

The selected architecture is the existing static Sites frontend plus a Supabase Edge command API and durable PostgreSQL match transactions in the existing Mumbai (`ap-south-1`) project. The release owner inspected project `wvupsqfevlrmhqfjreyx` as **ACTIVE_HEALTHY** during this server expansion; the inactive observation in the earlier static-release document is historical. Project health alone does not prove deployment of this game. The database is the referee: the browser submits an answer choice, never a score or an authoritative elapsed time. This does not require a continuously running virtual machine or a physics simulation.

The implementation lane uses a cryptographically random 256-bit guest bearer token, stored in the browser, with only its SHA-256 hash in the database and a 30-day server expiry. This is a device-bound guest profile, **not Supabase Auth, a verified person, or recoverable cross-device login**. Clearing storage or changing origin can lose access. Personal practice XP is separate from server-recorded competition results; do not import browser XP into public standings.

Short API calls read or change durable room state. A transaction locks the room, validates membership and phase, accepts the first valid answer, and settles each round/match once. Snapshots provide recovery after a disconnected or reloaded browser. Edge worker memory and browser timers are never the only record of a match. Supabase currently documents 150-second Free / 400-second paid worker lifetimes and 2 seconds of CPU per request; those limits are one reason not to keep an entire tournament in an in-memory function. [S2]

The initial delivery transport is HTTP commands and adaptive snapshot polling. It is a server-backed game, but it should not be advertised as a persistent WebSocket game. A later optimization can use private Realtime broadcasts as **wake-up notifications**, followed by authoritative snapshots. Supabase's May 2026 engineering article explicitly notes that Postgres Changes does not guarantee delivery; a notification stream cannot replace durable state and reconnect reads. [S3]

**Evidence boundary:** this document records reviewed architecture, operating requirements and acceptance gates. Source presence does not prove a deployed API, passing database authorization, two-network performance, or production capacity. The release owner must attach the actual deployment IDs, test results and measured limits before marking those gates complete. The earlier static release's successful deployment is not evidence for this new backend.

## What players can expect

| Mode | Result authority and purpose | Competition treatment |
| --- | --- | --- |
| Daily, files, ledger, solo and bot | Existing browser progression and source-linked learning; bot remains identified | Never promoted to server-ranked evidence |
| Pass-and-play | Shared-device casual play | No public rank |
| Server friend duel | Server receives and settles both players' answers; invite access | Private match, excluded from public standings |
| Public ranked duel | Five questions, 30-second question deadline, server settlement | Eligible completed matches feed the active board under its published rules |
| Tournament | Scheduled no-cash score competition using the same server duel rules | Separate competition window and standings; do not call this an elimination bracket |
| Circles | Friends/family identity and nicknames within each group | Private belonging first; no fabricated online member counts |

The application source initially sets five rounds, a 2.5-second countdown, a 10-second result break and a 120-millisecond dead-heat band. These are explicit game rules, not claims of measured network precision. Correct answers receive 30 XP below 8 seconds, 20 below 15 seconds and 10 thereafter; a wrong answer receives zero. The competition ranking formula must be shown separately from personal XP.

## Timing, fairness and trust

The following is the backend-confirmed design, cross-checked against `supabase/hisaab/schema.sql` on 27 September 2026. It still requires the release owner's deployed database and browser evidence before being called verified online behavior.

1. Both players join and ready up. A 2.5-second countdown sets a common opening time and a hard deadline 30 seconds after opening. Before opening, the projection contains no playable prompt or answer key. At each seat's first valid question fetch after opening, the server records an immutable `issued_at` for that seat and round. Later fetches cannot reset it. The browser estimates server time for display, but the database decides whether input is timely.
2. On the first tap, the control locks locally. The server acknowledgement produces the personal receipt. A retry after a network failure must reuse the same request identity; it must not create a second answer or score.
3. Elapsed time is the trusted answer-command entry time minus that player's first question-dispatch time, clamped to 0–30 seconds. The server does not subtract estimated RTT or accept a client's elapsed time. Answers arriving at or after the common deadline are not accepted. A late first fetch has less remaining time; dispatch does not grant another 30 seconds. Correctness decides a round first. If both players are correct, the recorded elapsed time decides; a difference of **120 ms or less is a draw**. Both wrong or both absent is also a draw. A fast incorrect answer never beats a correct answer.
4. The user sees their own feedback after accepted input. The shared round ends as soon as both answers are recorded, or at the deadline. It does not spend the rest of the question time waiting after both have answered. No opponent answer/key is exposed in the pre-result projection. Immediate personal correctness can still be shared out of band; this is one reason to avoid strong anti-collusion claims.
5. Capture the trusted receipt timestamp before waiting on a contended room lock. A queued transaction must not add avoidable lock-wait time to the second player's score. Never substitute a client-supplied timestamp, wall clock or claimed RTT for the trusted receipt time.
6. After five rounds, the player with more correct answers wins the match. On equal correct counts, compare total time: each correct answer contributes its recorded elapsed time and each wrong/missing answer contributes 30 seconds. A total difference of 120 ms or less is a match draw. Individual round wins are not summed to decide this result. A match win earns three competition points, a draw one, and a loss zero; these points are separate from answer XP.
7. Quit cancels an unfinished match and produces no completed-match standings credit, even if the other player is identified in the cancellation result. Waiting public rooms expire after three minutes; rooms older than 15 minutes are cancelled when reconciled. Result breaks end when both players continue or a subsequent request reconciles the 10-second break deadline. A locally dismissed screen must not silently continue queuing its player.

**Dispatch-to-answer time includes outbound question delivery, device scheduling, thinking/tapping, inbound answer delivery and server-path delay.** Recording dispatch separately for each seat avoids charging a player for time before the server first issues their question; it does not prove simultaneous on-screen reveal or eliminate connection differences. Hosting near the initial Indian audience, readiness and a draw band reduce some variability; none makes unequal networks equal. RTT/2 is not a reliable one-way-delay measurement, and blindly subtracting self-reported latency is exploitable. Do not advertise “zero lag”, “perfectly fair”, “cheat-proof” or millisecond-accurate human reaction measurement.

Show a connection check before ranked entry and a compact status when it changes. Bad connectivity should lead to retry or casual play, never a hidden handicap. Recommended later admission rule: measure several samples, reject unstable ranked sessions using an explicitly published threshold derived from pilot measurements, and separate regions only when traffic supports it. This admission rule is **planned unless an enforced server gate and tests exist**; a latency badge alone is not a gate.

Mumbai regional invocation can reduce function-to-database work for this architecture. Supabase supports `x-region` / `forceFunctionRegion`, but explicitly pinned requests are not automatically moved elsewhere during a regional outage. Verify `x-sb-edge-region` and benchmark automatic versus pinned routing; keep a documented outage switch and show service unavailable rather than silently changing competition rules mid-match. [S4]

## Leaderboards, tournaments and the hidden title

The durable XP ladder remains intact. **Desh Bhakt** is the hidden ninth *display entry*, before the existing final label, with no new XP threshold. It is an earned, temporary competition overlay. It is not a purchased perk, political affiliation or permanent replacement for the underlying label.

The approved eligibility contract is at least **three completed eligible matches against three distinct opponents** within the active window, followed by a current place in its top 10. A completed public ranked/tournament match is eligible only if both players submitted at least three answers across its five rounds; submission is not the same as correctness. Private rooms, bots, solo play, cancelled games and imported local progress do not qualify. Within each board's pool, only the first eligible encounter with the same opponent in a UTC day counts. These constraints deter easy repeat farming but do not stop a person creating multiple guest profiles.

| Competition | Window | Results that count |
| --- | --- | --- |
| Daily leaderboard | 00:00 UTC to the next 00:00 UTC | Sum eligible completed public ranked **and** tournament matches in that window, after the opponent/day cap |
| Weekly leaderboard | Monday 00:00 UTC to the next Monday 00:00 UTC | Sum eligible completed public ranked **and** tournament matches in that window, after the opponent/day cap |
| The Weekly Edition tournament | Monday 00:00 UTC to the next Monday 00:00 UTC | Tournament-mode matches only; sum the best five eligible matches after the opponent/day cap. Qualification counts distinct opponents across the whole eligible tournament window, not just the selected best five. |

The completion timestamp assigns a match to its window; a match beginning before midnight and finishing after it belongs to the later window. All windows are start-inclusive and end-exclusive. The same tournament result can count in its tournament table and the daily/weekly tables under each table's own opponent/day cap.

For every table, order players by competition points descending, correct-answer count descending, aggregate time ascending, then the earliest last-counted completion time, then stable player UUID. The final keys make a deterministic exact position; the 120-ms dead-heat rule applies to rounds and matches, **not** to table ordering. For the tournament, choose each player's best five by points, correct count, elapsed time, completion time and room ID. Expired/deleted guest profiles are not shown as current entrants.

Use absolute dates plus the viewer's local equivalent in the UI. A player's title grant contains its competition, rank and expiry; its `awardedAt` field currently represents the competition start, not a separately recorded first-earned event. Recheck eligibility from the server: the title stops being current when the player leaves the top 10 or the window ends, whichever comes first. An offline or stale cache must not extend it. If several grants exist, display one deterministically while retaining their provenance.

Keep the title's name out of the unearned ladder and promotional reward promises. Once earned, explain the rule and exact expiry plainly. “Hidden” means a discovery, not hidden scoring, hidden expiry, or arbitrary removal. Allow people to dismiss the reveal, retain their normal label, and continue playing without a reward modal chain. A sparse board may have fewer than 10 eligible people; do not create filler contestants or imply rarity not supported by actual qualification.

The best-five tournament caps counted contributions, not attempts: more play can still improve a player's selected results. Daily/weekly tables are cumulative and can reward participation volume. Do not describe either as time-neutral or purely a measure of skill. Publish these counting rules on entry. Do not add cash entry, cash prizes, paid retries, randomized rewards or a payment provider to this release.

## Services to connect or buy — excluding the domain

| Service | Needed now? | Concrete owner action / cost position |
| --- | --- | --- |
| Existing HISAAB Sites hosting | Already connected | Reuse `appgprj_6ab86670b86c8191b6f997fe9ef5aa90`. Confirm the account's actual hosting plan and access; no independent price has been verified here. Do not replace the original game's project. |
| Existing Supabase project | Required for server play | Use `wvupsqfevlrmhqfjreyx`, Mumbai, after successful migration/function deployment and permission tests. A bounded pilot can use available Free capacity. **Pro starts at US$25/month** and is recommended before broad public promotion for non-pausing service and daily backups; extra compute/usage/taxes can add cost. Pro is not an uptime SLA. [S1] |
| Cloudflare Turnstile or equivalent CAPTCHA | Recommended before opening anonymous registration broadly | A Turnstile Free account supports up to 20 widgets and unlimited challenges. Connect public site key plus server-only secret and validate server-side on guest creation / suspicious activity. It is not automatically installed by reading this plan, and it is not identity verification. No paid Cloudflare hosting is needed just to use Turnstile. [S5] |
| Real support/privacy inbox | Recommended before public promotion | Supply a monitored address, responsible owner and response process. Existing public GitHub issues are not a private mailbox. Provider and cost remain an owner choice. |
| Uptime/error monitoring | Recommended before public promotion | Start with Supabase function/database logs and host status; connect an independent synthetic uptime check and an alert destination. Add a client error service only after payload redaction. A specific paid monitoring plan is not required for the pilot. |
| Transactional email / SMTP | **Only when email login, recovery or invitations ship** | Not required for the guest-only server. If adding Supabase Auth email, connect a production SMTP service such as Resend, Postmark or SES, with verified sending identity and delivery monitoring. Supabase's default mail service is restricted development mail, currently two messages/hour to authorized team addresses. OAuth is another account path with its own setup. [S6] |
| Product analytics | Optional learning tool | Instrument minimal aggregate activation/completion/return events. Prefer server aggregates initially; do not add advertising trackers, session replay or personal answer histories to a third party by default. Provider and price depend on the approved data plan. |
| AdSense + applicable consent management | **Only when monetization is enabled** | Ads remain off. Need publisher approval, actual unit IDs and the reviewed consent integration. Google requires a certified TCF CMP for personalized ads in the EEA/UK/Switzerland. Keep ads outside live play, lobby, receipts and circle tasks. No ad income is assumed. [S7] |
| Separate VPS, Redis, TURN, payment gateway | **Not required for this command-based MVP** | Reconsider only if measurements justify another transport/server architecture or new product requirements. No paid services or upgrades are authorized merely by this document. |

As checked on 27 September 2026, Free includes 500,000 Edge invocations/month; Pro includes two million, then US$2 per extra million. Realtime has separate message and peak-connection charges: Pro includes five million messages and 500 peak connections; overages are US$2.50/million messages and US$10/1,000 peak connections. Those are billing quotas, **not tested HISAAB concurrency capacity**. [S8, S9]

Polling is a visible cost driver. For illustration only, two browsers polling once a second for a five-minute match create 600 reads before answers, lobbies, retries or reconnects. This arithmetic is not a prediction of actual match length, capacity or monthly cost. Poll faster only while needed, back off on errors, avoid overlapping reads, pause nonessential hidden-tab work and fetch promptly after a command. Measure calls per completed match before buying capacity or switching to private push notifications.

## Operating checks and bounded load testing

Use non-sensitive structured events: request ID, action, server match ID, result code, duration, region, state revision and counters. Do not log bearer tokens, authorization headers, raw IPs indefinitely, private invite codes, private nicknames or answer keys. Sample routine polling logs; preserve errors and settlement invariant failures. Give operational records a documented retention period and access policy.

The initial dashboard should show API p50/p95/p99 latency, 4xx/429/5xx by action, failed/duplicate settlements, queue wait and abandonment, completion ratio, reconnect recovery, calls per completed match, database connections/CPU/slow queries, storage growth and quota consumption. Any duplicate award or unauthorized read is an immediate incident. Suggested starting alerts—**proposed thresholds, not existing measurements**—are 5xx above 2% for five minutes with at least 50 requests; p95 answer acknowledgement above 1 second for five minutes; and 70%/90% quota warnings. Tune these to pilot data. Page an actual owner; a graph without an alert destination is not monitoring.

Before a public campaign, run the following gates against the actual release:

- Separate-player tests: guest A, guest B, outsider and missing/expired token; invalid choices/round IDs; forged score/time fields; no answer-key or opponent leakage before the appropriate reveal.
- Concurrency tests: simultaneous answers, identical request retry, conflicting second answer, simultaneous final-round settlement, third player joining full room, concurrent queue/cancel, reconnect after the deadline, and UTC window rollover. Awards remain single and balances/ranks recompute consistently.
- Abuse tests: body/field caps, request throttling, session-creation abuse controls, room/code guessing, stale tokens, reflected nickname markup, no secret in the frontend bundle, and direct `anon`/`authenticated` database access denied. CORS restricts browsers; it is not authentication or a general rate limiter.
- Two-network play: physical phones on Wi-Fi and mobile data, then a higher-latency pair. Record latency, countdown/reveal skew, answer acknowledgement and final settlement. Browser automation on one machine cannot establish Internet fairness.
- Bounded staged load: begin small on an isolated test dataset, then increase to an explicit pilot concurrency target; stop on errors or agreed resource thresholds. Record duration, completed matches, latency percentiles and integrity results. Do not claim a capacity figure from mock tests or provider benchmarks. Supabase recommends staging load testing and supplies k6 as an example. [S10]
- Recovery and operations: export/restore rehearsal appropriate to the plan; expiry/cleanup job; rollback preserving completed results; support/privacy pages matching server storage; leave/cancel without traps; ads still off; clear service-outage fallback to existing practice modes.

Do not make a new paid plan, project, public analytics integration or promotional promise a hidden deployment dependency. Ship a clearly described pilot once functional/security gates pass; the broader campaign follows real-network and operating evidence.

## Open-source alternatives considered

| Alternative | What the primary project provides | Decision for this release |
| --- | --- | --- |
| [Nakama](https://github.com/heroiclabs/nakama), Apache-2.0 | Server-authoritative match handlers, matchmaking, leaderboards and tournaments. Its tournament model can bound attempts; authoritative leaderboards reject direct client score submissions. | Useful design reference and future migration option. Operating another game-server stack is unnecessary for five-answer transactional rooms using an existing database. No Nakama deployment is claimed. [S11] |
| [Colyseus](https://github.com/colyseus/colyseus), MIT | Node.js authoritative rooms, synchronized state and reconnection/matchmaking APIs. | Strong option if persistent room sockets and higher-frequency interaction become required. It would add a server runtime and scaling responsibility. Its marketing wording is not proof that any application is cheat-proof. No Colyseus dependency is installed by this plan. [S12] |
| Supabase Realtime | Broadcast, Presence and Postgres change notifications with channel authorization | Potential transport improvement after measuring polling. Keep score authority in transactions, private channels authorized and snapshots as recovery. Do not broadcast private table rows wholesale. [S3, S13] |

## Primary source register

All links below were accessed **27 September 2026**. Prices, quotas and platform behavior must be rechecked before purchase or a major launch. These references inform implementation choices; they are not HISAAB performance evidence.

- **S1:** [Supabase pricing](https://supabase.com/pricing): plan base, compute credit, pausing, backups and SLA boundary.
- **S2:** [Edge Function limits](https://supabase.com/docs/guides/functions/limits): bounded worker lifetime, CPU and resource limits.
- **S3:** [Realtime or Pipelines?](https://supabase.com/blog/realtime-or-pipelines-how-to-choose-the-right-tool), 5 May 2026: transport roles, delivery limits and scaling trade-offs.
- **S4:** [Regional invocations](https://supabase.com/docs/guides/functions/regional-invocation): Mumbai support, region headers and failover limitation.
- **S5:** [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/), updated 14 August 2026: Free service scope and independent use.
- **S6:** [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp): production delivery and development restrictions.
- **S7:** [Google publisher CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en): geographic and personalized-ad scope, certification is not full legal compliance.
- **S8:** [Edge Function pricing](https://supabase.com/docs/guides/functions/pricing): included invocations and overage.
- **S9:** [Realtime pricing](https://supabase.com/docs/guides/realtime/pricing), [limits](https://supabase.com/docs/guides/realtime/limits) and [reports](https://supabase.com/docs/guides/realtime/reports): cost, limits and observability.
- **S10:** [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [API security](https://supabase.com/docs/guides/api/securing-your-api): operational and authorization checks; RLS is not rate limiting.
- **S11:** [Nakama authoritative multiplayer](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/), [leaderboards](https://heroiclabs.com/docs/nakama/concepts/leaderboards/) and [tournaments](https://heroiclabs.com/docs/nakama/concepts/tournaments/); [source/license](https://github.com/heroiclabs/nakama).
- **S12:** [Colyseus rooms](https://docs.colyseus.io/room), [state synchronization](https://docs.colyseus.io/state) and [source/license](https://github.com/colyseus/colyseus).
- **S13:** [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization): private Broadcast/Presence policies.
- **S14:** [Supabase changelog](https://supabase.com/changelog), latest reviewed entry 25 September 2026: PostgreSQL 15.19/17.11 advisory affecting some extension/operator use. Inspect the actual project before applying fixes; no automatic relevance or upgrade is asserted.

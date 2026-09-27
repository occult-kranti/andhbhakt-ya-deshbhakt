# Server expansion: technical, UX, psychology and marketing review

Date: **27 September 2026**. Baseline: `3370f9e647c643ed4df66c670e061d9f5d26877a` plus the server expansion being developed in this session. Scope: authoritative online duels, competition/title rules, familiar theme options and honest launch positioning. This is a finite two-round review of those decisions, not a claim of three additional implementation loops.

The role perspectives below are **AI role simulations by the launch-research lane**, informed by primary documents and concrete messages from the independent backend, frontend and marketing implementation lanes. They are not a meeting of hired professionals, a user study, or the authors' endorsement. Round 1 reviewed the existing code and requested behavior; round 2 challenged the chosen contract after the backend and frontend boundaries were specified. Browser usability and actual deployment remain release-owner evidence.

Skills applied: repository `gamification-advisor` and `panel-led-product-redesign`. The advisor's honesty gates prohibit fabricated presence, hidden bot fills, unclosable ads, automatic next-duel queues and coercive streak repair. No numerical usability score is assigned without observing the new screens.

## Evidence reviewed

- Baseline `editions/hisaab/engine/labels.mjs`: nine XP bands, with `Certified Anti-National` as the final earned label. Inserting another XP band would unexpectedly change existing progression.
- Baseline `STANDALONE-LAUNCH.md`: browser-local progression and peer transport, with real-network relay failure honestly recorded. Static publication alone was not authoritative competition.
- New `editions/hisaab/server/core.mjs`: five rounds, 30-second question deadline, 2.5-second countdown, 120-ms tie band, 30-day guest session; strips asserted score/identity/time inputs; server token hashing and first-answer contract delegated to transactional SQL.
- New `editions/hisaab/online/types.ts`: distinct waiting/countdown/question/result/finished/cancelled phases, personal receipt and shared result, rank grants with expiry, and server circle membership types. Type definitions alone do not prove the behavior.
- Backend lane contract: service-only database access, guest token hash, minimum three completed matches and three distinct opponents, one eligible encounter per opponent per UTC day, public competitions separate from private play, best-five tournament scoring.
- Primary research and documentation listed below and in `../SERVER-LAUNCH.md`. Book material reviewed is the available author synopsis/table of contents, not a claim to have read an entire copyrighted book.

## Round 1 — diagnose and decide

| Perspective | Finding and evidence | Decision | Acceptance check |
| --- | --- | --- | --- |
| Senior technical reviewer | Peer-hosted clients and local XP cannot be a trustworthy public referee; prior release docs explicitly distinguish them. | Supabase transaction state owns input acceptance, deadlines and settlement. Use short Edge commands and private tables. | Modified clients cannot submit score/time, outsiders cannot read a room, repeated final requests award once. |
| UX reviewer | A user expects feedback at the first answer; waiting through a blank countdown feels broken. Nielsen's status/control heuristics support prompt feedback and an obvious exit. | Keep a personal accepted-answer receipt; shared result follows both answers or deadline. Maintain visible settings/quit and queue cancel. | Both answer orders, deadline/quit races, keyboard focus, small-screen controls; no opponent key before settlement. |
| Game-psychology reviewer | Progress, choice and playing with familiar people can support competence/autonomy/relatedness. An opaque exclusive title can instead become pressure or arbitrary punishment. | Hidden title name before discovery; explicit eligibility and expiry after discovery; optional reveal; preserve ordinary XP title. | No reward locks normal play; expired/stale grant cannot display as current; no reminder threatens lost worth/status. |
| Brand/marketing reviewer | The newspaper masthead and receipts offer a coherent product promise; “real time and equal” could overpromise what networks permit. | Position as a source-linked civic duel with server-recorded answers. Preserve Day/Night identity; Classic is a preference, rotation changes only between sessions. | No claim of equal latency, official verification, measured retention, popularity or guaranteed ad revenue. |

**Moderator resolution:** ship one understandable online entry with public match and friend invite choices; keep existing local modes. Competition is an opt-in layer. The title is display entry nine before the existing final label, not a rewritten level curve. Newsprint styling should frame tasks, while options and clocks remain crisp and quiet during play. Public beta language stays until deployment/security evidence exists.

## Round 2 — challenge the selected contract

| Challenge | Resolution / owner | Observable result required |
| --- | --- | --- |
| A 120-ms draw band is not network compensation. DB lock contention could further penalize the second answer. | Backend: capture trusted arrival before room-lock waiting; correctness first; UI: disclose arrival timing, no self-reported elapsed accepted. | Simultaneous input test plus regional latency measurements. “Fairness improved” remains an engineering aim, not a measured equality claim. |
| New guest profiles are cheap; three opponents can still be fabricated by one person. | Backend: distinct-opponent/per-day limits and server results; release owner: registration abuse control and beta labeling. | Forged/replayed clients fail; document residual Sybil/collusion risk. No cash prizes or verified-person claim. |
| Unlimited play can reward available time more than skill; tiny boards cannot justify rarity language. | Backend/product: bounded best-five tournament format, visible counting/qualification; no fake players. | Ranking arithmetic/UTC boundary tests; fewer than 10 eligible players means fewer than 10 title holders. |
| A hidden name conflicts with informed participation if its eligibility is also hidden. | Theme/title and UI lanes: hide the unearned name, keep competition rules discoverable, show expiry and source when earned. | No permanent XP loss on expiry; dynamic rank fall and window end remove current status; cache cannot extend it. |
| Polling can cost more than the visible gameplay suggests; Edge workers can disappear. | Backend/UI: persist state, adaptive polling, bounded retries and recovery snapshots. | Actual request count/match; no overlapping reads, no duplicate award, reconnect restores authoritative state. |
| Classic/rotation may unexpectedly alter a timed question. | Theme lane: pin the chosen edition for an active session; never animate contrast changes mid-input. | Stored preferences persist and 320-pixel layouts remain usable for all appearances. |
| A deck can accidentally describe planned email recovery or tournaments as a proven growth engine. | Marketing lane: mark prototype/pilot/planned status and proposed experiments. | Every product claim maps to a working flow; every metric is measured or explicitly an assumption; no fabricated market size. |

**Round 2 verdict:** architecture is proportionate to a low-frequency question game, with a meaningful remaining operations gate. Proceed with implementation and bounded tests. Do not purchase a second server stack by default. Do not turn a successful unit suite into claims about mobile network fairness, production capacity or player retention.

## Healthy retention and tournament cadence

These are design hypotheses and a measurement plan, not demonstrated effects for HISAAB.

- **Daily receipt:** one short source-linked challenge, followed by an optional source read. Missed days do not erase learning or require a paid repair.
- **Weekly edition:** an optional bounded competition with the same clear counting rules for everyone. Dates are real server windows, not fabricated scarcity.
- **Circles:** choose a nickname and invite people through an explicit sharing action. Private shared participation is enough; no contact scraping, automatic messages or public family roster.
- **Mastery:** show accuracy and source exploration alongside speed. Wrong answers provide explanation, not humiliation. Preserve untimed practice for users who do not enjoy competition.
- **Discovery:** one dismissible title reveal; no auto-queued match, modal cascade, or promise that a rare badge improves odds.

Measure first completed duel, failed start/quit reasons, weekly returning players, source opening after a receipt, eligible competition completion and circle return. Use clear cohort definitions and privacy-reviewed collection. Pair returns with errors, voluntary exits and self-reported enjoyment; maximizing session length alone is not the goal. Run a bounded user test before saying the design improves retention or inclusion.

## Decision ledger and status

| Decision | Owner | Review status | Release evidence needed |
| --- | --- | --- | --- |
| Durable authoritative guest match service | `server_core` / root | Accepted, implementation in progress at review | Migration, deployed function, authorization/concurrency checks |
| Immediate personal receipt and explicit online states | `ui_online` | Accepted | Browser checks for both players and recovery/quit |
| Hidden temporary title, existing XP ladder retained | `theme_titles` / backend | Accepted | Eligibility, expiry, stale-cache and ordinal tests |
| Classic theme and safe rotation | `theme_titles` | Accepted | Persistence, contrast and active-match stability |
| Transparent no-cash tournament and UTC rules | Backend / UI | Accepted | Formula, opponent cap and rollover tests |
| Launch service matrix and bounded operational gates | `launch_research` | Documented in `SERVER-LAUNCH.md` | Owner-selected alert/support services and campaign readiness |
| Investor/social material with actual/planned distinction | `marketing_deck` | Accepted | Editable deck and draft assets reviewed against final shipped build |
| Multi-region matchmaking, persistent socket service, email recovery | Future roadmap | Deferred until required/measured | Separate implementation and verification; not assumed shipped |

## Sources and scope

Accessed 27 September 2026. Interpretations in this review are the panel lane's judgments.

1. Ryan, Rigby & Przybylski (2006), [The Motivational Pull of Video Games](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf): four studies relate need satisfaction and game motivation. Applied here as hypotheses about autonomy, competence and relatedness, not a promised retention lift or health claim.
2. Don Norman (2013), [The Design of Everyday Things, author page](https://jnd.org/books/the-design-of-everyday-things-revised-and-expanded-edition/): synopsis and contents identify feedback, signifiers, discoverability, constraints and recovery as design concerns. No whole-book review is claimed.
3. Jakob Nielsen, [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), last reviewed 30 January 2024: visible status, user control, recognition and error recovery inform the state/quit decisions.
4. Supabase [Edge limits](https://supabase.com/docs/guides/functions/limits), [API security](https://supabase.com/docs/guides/api/securing-your-api), [regional invocation](https://supabase.com/docs/guides/functions/regional-invocation), [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), and [May 2026 Realtime article](https://supabase.com/blog/realtime-or-pipelines-how-to-choose-the-right-tool): concrete infrastructure constraints, not a benchmark of this game.
5. Heroic Labs [authoritative leaderboards](https://heroiclabs.com/docs/nakama/concepts/leaderboards/) and [tournaments](https://heroiclabs.com/docs/nakama/concepts/tournaments/): reference patterns for server writes and bounded attempts; no code adoption is claimed.

The previous completed Day/Night redesign panel record remains in `night-edition-panels.md`. This focused expansion supplements it instead of inventing additional rounds against an unchanged artifact.

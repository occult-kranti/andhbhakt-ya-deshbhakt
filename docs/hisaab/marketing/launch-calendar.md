# Thirty-day launch calendar

Day 1 means the first day after the online release gate passes, not a promised calendar date. Solo-game content may run earlier. Owner approval is required before posting, sending invitations, paying for ads or announcing a tournament. No messages were sent by this task.

| Day | Work and public content | Evidence or release gate |
|---:|---|---|
| 1 | Publish the game introduction and a clean demo link | Product reachable; privacy/contact links correct |
| 2 | Recruit a small opt-in friend/family pilot | Volunteers understand guest device identity and beta limits |
| 3 | Show one source-linked receipt | Recheck that question and its current legal/status wording |
| 4 | Observe first-round onboarding with consent | Count start, completion and confusion; avoid leading questions |
| 5 | Share the English/Hindi switch and accessibility options | Verify the recorded paths on mobile |
| 6 | Hold a scheduled circle session | Host and backup host available; no promised prizes |
| 7 | Review pilot failures and correction requests | Publish specific fixes before expanding invitations |
| 8 | Introduce the online beta using gated post 4 | Deployed two-device evidence, visible rules and exit flow |
| 9 | Share an explanation of correctness and speed | Exact server scoring and latency wording match runtime |
| 10 | Invite one consenting community host to a demo | One clear opt-in ask; no mass messages |
| 11 | Show a state or sector file | Source link opens and date context remains clear |
| 12 | Test one alternative hook: receipt versus rivalry | Random assignment if feasible; same audience/time window |
| 13 | Run a hosted play session at a announced UTC time | Capacity and support owner confirmed |
| 14 | Review activation and first return cohorts | Report eligible denominators; no retention claim from tiny samples |
| 15 | Publish a short founder explanation of the satire | Aim at labels and habits, no community or religious targeting |
| 16 | Share a real product clip with participant consent | Remove private nicknames, invites and identifiers |
| 17 | Start a weekly competition window only if verified | Rules, eligibility, ties, expiry and outage policy visible |
| 18 | Share a “how to read the receipt” tutorial | Receipt/source opens without ad obstruction |
| 19 | Ask pilot players one neutral feedback question | “What would make you choose another round?” |
| 20 | Run a mobile reliability session across networks | Measure failed requests and completion; no equality guarantee |
| 21 | Publish the weekly result only after settlement | Winner consent for public nickname; no secret title teaser |
| 22 | Send an optional session reminder to subscribers | Only a consented channel; clear unsubscribe |
| 23 | Share a family-circle use case with fictional names | Say “example”; never invent a testimonial |
| 24 | Review content balance and recent source changes | Corrections queue owned and dated |
| 25 | Test a second opt-in community host | Compare completed games per host effort, not raw impressions |
| 26 | Share product changes prompted by real feedback | Quote only with permission and preserve context |
| 27 | Evaluate one commercial concept in interviews | No sales or ads activation implied; disclose proposed status |
| 28 | Review costs and reliability before broader reach | Cost per completed server match; failure and support volume |
| 29 | Prepare a factual investor update | Include cohort dates, exclusions, sample size and missing data |
| 30 | Choose next month's narrow experiment | Continue, revise or stop based on evidence and support capacity |

## Events and metrics

Event names are an instrumentation proposal, not evidence that analytics is installed: `game_started`, `answer_locked`, `receipt_opened`, `match_completed`, `invite_opened`, `circle_joined`, `source_opened`, `match_failed`, `report_submitted`, `session_returned`.

Collect event timestamps, edition/mode/version, a pseudonymous identity and result status only where needed. Do not collect answer text, private circle nicknames, invite secrets or full IPs in product analytics. Server operational logs may need short-lived security metadata with documented retention and restricted access. Do not put credentials or private data in URL parameters.

| Metric | Definition | Interpretation limit |
|---|---|---|
| First-round activation | Eligible new identities with a completed first round and a receipt open / eligible new identities starting | Guest identity is a device/session proxy |
| D1 return | Activated cohort identities active during the next UTC day / cohort with a full observation window | State the timezone and exclude immature cohorts |
| D7 return | Activated identities active on UTC day 7 / fully observed activated cohort | Retention, not learning or persuasion |
| Invite completion | Invite openers who join and complete a duel / eligible invite openers | Consent and attribution losses affect estimates |
| Match completion | Settled normal matches / started matches | Report quit, timeout and error separately |
| Request latency | p50/p95/p99 by region/network class from observed requests | Response time is not pure human reaction time |
| Cost per match | Allocated bill for game services / completed server matches | Separate fixed minimums and variable usage |
| Content health | Confirmed corrections per reviewed item, age of unresolved reports | Low reports may mean low awareness, not accuracy |

Do not optimise time spent alone. Monitor voluntary returns, receipt/source use, control/quit success and complaints. Set experiment sample size from the baseline and a pre-agreed minimum meaningful difference. Stop a test that harms match completion or produces unresolved fairness complaints. No numerical growth promise is justified before data exists.

# HISAAB DO — release roadmap

Team lead: Claude (this session). Branch: `claude/loving-pasteur-s8xwtf`. Charter: `CHARTER.md`.
Each lane below is one subagent with a written brief. A lane is done only when its acceptance
checks pass; the lead merges, reviews and deploys.

**Where it stands (26 Sep 2026).** Phases 0–3 are done. The build is feature-complete: 910 sourced
questions in 20 lanes, 130 live routes, every screen, bot, friend and Pass & Play duels, the money
ledger, and five review lenses plus a balance audit and an independent fact audit, all folded in.
Release (Phase 4) waits only on the `RELEASE` marker and a live check. How to run, test and deploy
the edition: `editions/hisaab/README.md`. The engine API: `ENGINE.md`.

## Current update — newspaper, stopwatch, circles

The owner's current instruction is to push to `claude/loving-pasteur-s8xwtf` without merging `main`.
The historical phase entries below remain a release history; older confidence and appearance
specifications are superseded by the current amendment in `CHARTER.md`.

Implementation lanes: stopwatch/progression; circles/peer connections; responsive editorial design;
profile/rules cleanup; advertising/launch configuration; independent QA. Current executable
contracts live in the edition modules and focused tests. Final validation is recorded in
`review/release-qa.md` and `review/release-summary.md` after execution.

The initial `RELEASE` marker already exists and the original edition was observed live. The current
update will use the same isolated `gh-pages/hisaab/` publishing workflow. A HISAAB-only custom domain
must use a separate static deployment; changing this repository's Pages CNAME would affect both games.

## Phase 0 — Charter (lead) ✅

Delivered in `6ffffbe`, `d6fa315`, `b70c99f`:
- `docs/hisaab/CHARTER.md`: product, label ladder, legal gates, schema, lanes, modes, notification budget.
- `editions/hisaab/bank/schema.mjs` + `scripts/hisaab-validate.mjs`: the bank contract as code.
- The `hisaab-editorial` skill (`.claude/skills/hisaab-editorial/`): the working card for research,
  sourcing, status dates and defamation-safe wording.
- `.github/workflows/pages-hisaab.yml` publishing into `gh-pages/hisaab/`, and `pages.yml` keeping
  that folder when it republishes JHK.

## Phase 1 — Research, content, design, engine ✅

| # | lane | delivered |
|---|---|---|
| 1.1 | Schemes & benefits | `bank/schemes.mjs`: 60 items; `research/schemes-notes.md` |
| 1.2 | Budget & spending | `bank/spending.mjs`: 49 items (hbx046 dropped in the audit as a duplicate of hmd027) |
| 1.3 | Scams & accountability | `bank/scams.mjs`: 60 national cases; a status on every named person |
| 1.4 | States — North | `bank/states-north.mjs`: 62 items, 10 states |
| 1.5 | States — West & South | `bank/states-west-south.mjs`: 66 items, 10 states |
| 1.6 | States — East & NE | `bank/states-east.mjs`: 52 items, 10 states |
| 1.7 | Media & speech | `bank/media.mjs`: 45 items (Kiska Media?), ownership sourced to filings and major outlets |
| 1.8 | Elections & money | `bank/elections.mjs`: 50 items on bonds, party funds, legislators and the ECI |
| 1.9 | Forward Court | `bank/forwards.mjs`: 40 viral claims from all sides, a fact-checker source on each |
| 1.10 | Discourse research | `research/discourse.md` (30 subreddits mapped, topics ranked, the label lexicon) and `scripts/research/reddit-pulse.mjs` |
| 1.11 | Design bible | LAL FEETA: `design-bible.md`, `editions/hisaab/theme/tokens.css`, the `hisaab-design` skill |
| 1.12 | Engine scaffold | `vite.config.hisaab.ts`, the alias table, storage isolation, routes from the bank, the daily five, the duel controller, P2P duels and Pass & Play, `ENGINE.md`; JHK tests unchanged and green |

**Added in this phase: the money trail, 2000–2026** (charter §4a). Eight lanes plus three gap-fill lanes,
each re-fetched by an independent verifier: `dist-centre` 45, `dist-north` 46, `dist-west-south` 45,
`dist-east` 39, `relief-centre` 41, `relief-states` 40, `poll-union` 42, `poll-states` 52,
`money-gaps-dist` 25, `money-gaps-relief` 26, `money-gaps-poll` 25. With the retagged older items,
352 cards are tagged `distribution`, 123 `relief` and 207 `pre-election`. The ledger builder turned
them into `editions/hisaab/data/money-ledger.json`: 389 measures, with the overview and known gaps in
`research/money-trail.md`.

## Phase 2 — Build ✅

| # | lane | delivered |
|---|---|---|
| 2.0 | Foundation (`4878295`) | app shell (top bar, bottom bar / 88px rail), hash router, the LAL FEETA component library, the notification budget, data helpers, self-hosted fonts, money-trail and Saal-dar-Saal routes |
| 2.1 | Shell + Home + onboarding + label ladder | first-run poster, Home, the nine-rung ladder with certificate; mobile gate clean at 360/390/414 |
| 2.2 | Modes | Files hub with the 30-state records-room cartogram, Sector Files, Kiska Media?, Forward Court, the money-trail hubs (Seedha Khaate Mein, Rahat Kosh, Chunav Se Pehle, Saal-dar-Saal), the untimed route player with confidence calls, stamps and printed receipts, the route finish, Aaj Ka Hisaab and the one-card taster. Every route is playable |
| 2.3 | Duels | Babu-Bot in three formats, P2P friend duels and Pass & Play, the quiet live surface, round receipts, the match result. Verdicts are the JHK engine's own |
| 2.4 | 3D set pieces (Rapier) | TIJORI, TARAZU, THAPPA, FILE PILE: lazy, dpr-capped, 2D fallbacks, never in a live round |
| 2.5 | Profile, Vault, share | Me, the Receipts Vault, Settings, Rules & Sources/Corrections, certificate and receipt PNG cards; share works without a server |
| 2.6 | Paisa Kahan Gaya? (`adf47a7`) | the money ledger at `#/money/ledger`: 389 measures as a timeline, table and chart (timing, never cause; no party colours), filters in the URL, CSV and XLSX downloads with a sources sheet |

`scripts/hisaab-screens.mjs` (the screen walker) is the phone gate: 370 screens in 10 cells and 11
end-to-end flows, 0 failures at the last run.

## Phase 3 — Review and harden ✅

| # | lane | delivered |
|---|---|---|
| 3.1 | Fact-check audit | Independent agents re-fetched every source of the nine original lanes (a "Fact audit (26 Sep 2026)" section in each lane's notes; the money-trail lanes have a "Verification" section from their own verifiers). About 275 fixes: cross-item answer giveaways, overstated findings, stale figures, distractors that were also true. Statuses dated 26 Sep 2026. An `otherSide` reply on 223 items, so the receipt's OTHER SIDE row prints the denial, clearance or official reply. `scripts/hisaab-giveaways.mjs` now finds cross-item giveaways by script |
| 3.2 | Balance audit | `review/balance.md`: even-handed overall; wording made symmetric where it wasn't; the route mix (F2: at most two scam cards per state or sector route, and every government with 3+ items on a state route dealt a card that is not a scam card, `ROUTE_MIX` in `engine/routes.mjs`, `tests/hisaab-routes.test.mjs`). Open findings are in Phase 5.4 |
| 3.3 | Gamification advisor loop | `review/advisor-loop1.md` |
| 3.4 | Code review + tests + mobile gate | `review/code.md` (both P1s fixed: the P2P lobby leak and the profile writes during a live question), `review/design-fidelity.md`, `review/mobile-a11y.md`, `review/legal-honesty.md`. 34 P0/P1 findings fixed across the five lenses, then the four P2 bugs and 36 P2 polish items. `review/p2-backlog.md` holds the rest (Phase 5.7) |
| 3.5 | P2P hardening | Room codes stretched with PBKDF2 (600,000 rounds) before anything touches a public relay; the residual exposure disclosed on screen; the pairing fingerprint covers every field of every item; rematch rooms derived from the first room's secret |
| 3.6 | Retired routes | A route that a bank edit retires keeps the player's record as a stub and brings it back with the route (`routeCatalogue`, ENGINE §7) |

The pre-release suite: tsc clean, the full `node --test tests/*.test.mjs` suite green, both builds green,
the bank valid.

## Phase 4 — Release

- [x] `.github/workflows/pages-hisaab.yml` builds on push to this branch and to `main`, runs tsc, the
  full suite and the bank validator, and publishes into `gh-pages/hisaab/` without touching the JHK
  files around it (plain push, rebase-and-retry, shared `pages` concurrency group).
- [x] `pages.yml` keeps `hisaab/` when it republishes JHK from `main`.
- [x] Commit `editions/hisaab/RELEASE` (present on the recovered source branch). Until it exists the workflow's preflight exits green and
  publishes nothing, so a half-built app is never live.
- [ ] Live check of `https://occult-kranti.github.io/fact-duel/hisaab/`: the walker against the live
  URL (`node scripts/hisaab-screens.mjs <outDir> https://occult-kranti.github.io/fact-duel/hisaab/`),
  a real two-phone friend duel over WebRTC, the ledger downloads, and JHK still intact at `/fact-duel/`.

## Phase 5 — After launch (not in this release)

### 5.1 Server PvP and matchmaking on the shared Worker
The JHK Worker already runs accounts, the room engine, matchmaking by lane and a D1 ledger
(`lib/server/duel-service.mjs`, `matchmaking.mjs`, `http-queue.mjs`; `.github/workflows/deploy-worker.yml`).
- Register the civics bank in the Worker behind an edition flag. Rooms and queue entries carry
  `edition: 'hisaab'`, so a JHK player is never dealt a civics card and the D1 tables stay shared.
- Allow the Pages origin by CORS and give the edition a server duel client: HTTP for human rooms,
  the in-page service for Babu-Bot. Keep the alias table as the one place the difference lives.
- Matchmaking lanes by format only (no stakes, no coins: charter). Show real queue counts or none; the
  presence rules (no fake presence, N-rules) apply as in JHK.
- Server-timed matches could be ranked. That is a charter decision: today `rankHumanMatches` is off
  because P2P times are self-reported. Friend duels over P2P stay unranked either way.
- Needs a `main` merge and the Cloudflare secrets. Port the P2P verdict tests to the server path.

### 5.2 A longer P2P secret in invite links
The typed code is about 40 bits, stretched to cost 600,000 PBKDF2 rounds per guess (`P2P_TRUST.code`
says what that leaves exposed). An invite **link** does not need to be typeable: let it carry a random
128-bit secret in the URL fragment next to the code (`#/duel/friend?code=ABCD-EFGH&k=<22 chars>`),
mixed into `roomSecret`. Rooms opened from a link are then out of reach of any offline search; a typed
code keeps working as today. Decide how the lobby tells the host which kind of room it opened (a guest
who types only the code cannot join a link room), bump `P2P_PROTOCOL`, and extend `tests/hisaab-p2p.test.mjs`.

### 5.3 Monthly status re-verification
Every lane's notes keep a stale-risk list (`docs/hisaab/research/*-notes.md`). Once a month, re-read a
new source for each item below, bump `asOf` only after that, update any ledger row that lists the item
(ENGINE §16), log the change in the Rules page's corrections log (`app/screens/rules/corrections.ts`),
and re-run the validator, the giveaway detector and the suite. The Vault already flags
receipts whose status is older than 6 months (`STALE_MONTHS`). Items the lane notes name:

- **Scams** (`scams-notes.md`): hgh002 Nirav Modi extradition; hgh001/003/004 Mehul Choksi (Belgian
  minister's decision); hgh005–007 Vijay Mallya; hgh009 DHFL; hgh010 ABG Shipyard; hgh012 Rana Kapoor;
  hgh013 Kochhar; hgh016 Rafale (France); hgh019 Adani (US, absent defendants); hgh024 NEET-UG 2026;
  hgh033 PMLA review bench; hgh045/046 Christian Michel; hgh047/048 2G appeal; hgh049/050 coal;
  hgh052 National Herald (Delhi HC, 12 Oct 2026); hgh053 INX Media; hgh055 Anil Ambani group;
  hgh056/057 Bhandari, Lalit Modi; hgh044 Sahara refunds (window to 31 Dec 2026); hgh035 CBI consent.
- **States — North** (`states-north-notes.md`): hst101/102 (Delhi HC, 5–6 Oct 2026), hst107, hst110,
  hst113, hst114, hst122, hst125/126, hst132, hst133, hst138 (highest risk in the lane), hst139, hst143,
  hst144, hst145, hst150 and hst156 (charge framing 30 Sep 2026), hst157, hst158, hst106.
- **States — West & South** (`states-west-south-notes.md`): hst200 Morbi, hst211 Dharavi, hst233 MUDA,
  hst234 Valmiki, hst226 Mahadev, hst227, hst245/246 (TN under TVK), hst252, hst253, hst259
  Kaleshwaram, hst261 Formula-E (30 Oct 2026), hst264, hst236, hst240, hst215; scheme amounts hst218,
  hst207/208, hst220, hst229, hst257.
- **States — East & NE** (`states-east-notes.md`): hst301, hst305 (CBI reply 15 Oct 2026), hst324,
  hst303, hst306, hst302/304, hst315, hst335, hst340, hst349, hst319/325, hst344, hst307.
- **Media** (`media-notes.md`): legal statuses hmd013, hmd014, hmd015, hmd017, hmd022, hmd042, hmd011,
  hmd030, hmd044; RSF (hmd024, hmd041) and Access Now (hmd031) yearly figures; MOM 2018–19 ownership
  data (hmd006, hmd008, hmd010, hmd021, hmd040), hmd001, hmd003, hmd007, hmd009; positions held.
- **Elections** (`elections-notes.md`): hel031/032 CEC law (larger bench), hel040, hel043, hel039,
  hel047 ONOE JPC, hel046, hel035/036 SIR, hel045 spending limit, hel023–025 ADR data (FY 2025-26).
- **Forward Court** (`forwards-notes.md`): hfw007, hfw008, hfw009 (open FIRs), hfw021 (IMF WEO,
  October 2026), hfw039 (weekly tracker), hfw040.
- **Schemes** (`schemes-notes.md`): hsc055, hsc029/030, hsc036/037, hsc023, hsc044, hsc025, hsc013,
  hsc002/004, hsc060, hsc057 (freebies case).
- **Spending** (`spending-notes.md`): Budget 2027-28 on 1 Feb 2027 supersedes hbx001–005, hbx008–013,
  hbx016–018, hbx020, and hbx002–004 must be repointed to the archived 2026-27 PDF; hbx025, hbx022,
  hbx037, hbx043, hbx018, hbx017, hbx008, hbx039.
- **Money trail — distribution**: dist-centre hdb045, hdb043, hdb040, hdb039, hdb035 and the running
  totals hdb024, hdb030, hdb031, hdb037, hdb042, hdb044; dist-east hdb338/307, hdb309, hdb310, hdb303,
  hdb321, hdb316, hdb331, hdb335, hdb322/323/327; dist-north hdb140, hdb143, hdb144, hdb141 (tag
  `pre-election` once Punjab 2027 is scheduled), hdb142/145 (Uttarakhand 2027), hdb113, hdb137,
  hdb138, hdb116, hdb105, hdb100; dist-west-south hdb200/217, hdb233, hdb234, hdb212/237, hdb242/243;
  money-gaps-dist hdb424 (TN, 2 Oct 2026), hdb414, hdb410, hdb412, hdb408, hdb423, hdb421/419, hdb411.
- **Money trail — relief**: relief-centre hrf005, hrf036, hrf037, hrf038, hrf039, hrf040, hrf041,
  hrf034, hrf002; relief-states hrf139, hrf128, hrf134, hrf123, hrf137/138, hrf130, hrf115/131 (every
  six months); money-gaps-relief hrf217, hrf223, hrf224, hrf225, hrf221, hrf222, hrf219, hrf205.
- **Money trail — before the vote**: poll-union hpe034 (freebies PIL), hpe038 (8th Pay Commission),
  hpe035, hpe025, hpe036, hpe004; poll-states hpe148, hpe145, hpe147, hpe143, hpe140, hpe149
  (by-elections Oct 2026); money-gaps-poll hpe220, hpe219, hpe221–224, hpe216.
- **Ledger-only statuses** (`money-trail.md` §7): the Mahila Rojgar petition (Patna HC), the Delhi
  Lakshmi PILs, the Punjab Mawan Dhiyan Satikar PIL (5 Oct 2026), the Himachal scholarship trial, the
  Sheopur case, the NFS (Amendment) draft, NSAP rates, the women's reservation amendment, and
  Telangana's unverified ₹2,500 Mahalakshmi cash.

### 5.4 Content gaps: thin eras, missing states and parties
From `review/balance.md` §9 and `research/money-trail.md` §7. Each lead needs a fetched source, a
dated status and the other side before it enters the bank.
- **Thin early eras.** 2000–2013 has 162 items and only 3 `scam` items (1 before 2010), so the
  Saal-dar-Saal files for 2000–2012 deal almost no accountability cards. Leads: NDA-I Centre (Tehelka
  2001, UTI 2001, petrol-pump allotments 2002), UPA Centre (cash-for-votes 2008, Adarsh 2010), and
  state cases of every party (Taj corridor, the Jagan DA case, the Karnataka mining report, fodder-scam
  convictions, Telgi). Add UPA-era credit and critique so 2004–14 is not mostly schemes.
- **2000–04 in the money trail** is the thinnest era (40 ledger rows, 19 of them Union). Before 2005, 16
  states have no row; no fetchable pre-poll handout was found for TN 2001, Delhi 2003, Chhattisgarh 2003
  or the Hindi-belt states, and RJD-led Bihar 2000–05 has only a relief row.
- **The North-East.** Nagaland and Arunachal have 1 ledger row each, Meghalaya and Manipur 2, Tripura 3,
  Sikkim 4; nothing before 2010 except Mizoram 2002 and Assam 2007. Unsourced leads: Majoni/Mamoni
  (Assam 2009), Meghalaya under Mukul Sangma, Nagaland under the NPF, Tripura's Left-era pensions,
  Manipur's CMHT.
- **Mode holes by state.** No pre-election row for UT, JK, MZ, MN, AR; no plain distribution row for JH
  and NL; no relief row for GA and ML.
- **Who gets named (F1).** The balance audit found 38 opposition politicians named as accused or under
  probe against 2 from the BJP. The `balance-cases` lane (30 items, hgh100+, 26 Sep 2026) adds 28 items
  naming 44 people on the BJP/NDA side, convictions and clearances alike (Tehelka, Barak, the coffin
  case, Laxmi Vilas, the Karnataka and Bellary mining cases, Vyapam, party-switch closures), 16 of them
  from 2000–2013. Re-run the balance tables in `review/balance.md` after the next content batch and
  keep the named-accused split proportionate to the documented record, not to a quota.
- **Parties that appear only as villains in their own lane.** TMC (`states-east`); LDF, BRS and YSRCP
  (`states-west-south`); JMM and AAP (`states-north`). Add audited credit items where the record
  supports them.
- **`otherSide` backfill** on 16 money-trail wrongdoing items (hrf010, hrf131, hrf135, hdb021, hpe016,
  hdb035, hdb040, hdb110, hdb111, hdb127, hdb128, hdb134, hdb140, hdb144, hdb236, hdb316), and
  government replies on CAG items (hst105, hst238, hst256, hst314, hst318, hst350).
- **Forward Court** has only 4 state-level forwards of 40. Add state forwards that flattered or attacked
  the TMC, DMK, LDF, BRS and BJP state governments; keep ≥ 40% each way.
- **Reserves already verified but not written** (a bank item first, then a ledger row): Bharat rice
  and atta, the ₹2 fuel cut of March 2024, the small-tax-demand withdrawal, PM-KISAN's 14th and 15th
  releases, Rythu Bima, UP's free-ration extension and Bal Seva Yojana, Delhi's festival LPG, Karnataka
  Bhagyalakshmi, the Ockhi helicopter bill, Surat flood relief, the NDRF recovery-window awards.
- **Ledger data holes:** 186 rows without `annualCost` and 184 without `reach` (RBI *State Finances* is
  the unused source), 10 `launchedApprox` dates, 46 rows with no named enactor, `gapDays` missing on 27
  of 164 poll rows, pre-May-2026 ECI results cited through outlets.
- **Editorial decisions:** adopt one `govt` rule bank-wide for wrongdoing items (the government in office
  when the alleged act happened) or add an `implicates` field (balance §8); decide "Kerala" vs "Keralam"
  after the 25 Aug 2026 renaming; replace hel048's distractor "He had a criminal conviction", which is
  about a real, identifiable nominee.

### 5.5 Hindi bank
The UI ships in English and Hindi, and the bank ships in English. Translating it means optional Hindi
fields in `bank/schema.mjs` (stem, options, explanation, status, other side), validator checks that the
options stay parallel and `correctIndex` unchanged, and screens, receipts and share cards that read
them in the Hindi locale. Constraints: status and other-side wording must keep its legal meaning (a
Hindi-reading editorial pass per lane), Sometype Mono has no Devanagari (receipt rows stay Latin
digits and ₹), the share-card canvas needs the Devanagari font loaded, and every translated item
changes the P2P fingerprint. Start with the daily-five pool and the state routes.

### 5.6 Reddit pulse refresh
`scripts/research/reddit-pulse.mjs` takes an aggregate snapshot of the 30 communities in
`research/discourse.md`: post counts, keywords, flairs, domains and hits on the bank's topic, case and
label dictionaries. It never reads authors, bodies or comments, and keeps titles only with
`--sample-titles`. This build environment cannot reach Reddit, so the product owner runs it monthly
on a machine that can:

```sh
node scripts/research/reddit-pulse.mjs --dry-run                         # offline self-check
export REDDIT_CLIENT_ID=… REDDIT_CLIENT_SECRET=… REDDIT_USERNAME=… REDDIT_PASSWORD=…
export REDDIT_USER_AGENT="script:hisaab-pulse:v1 (by /u/<account>)"
node scripts/research/reddit-pulse.mjs --out=/path/outside/the/repo/pulse.json
```

Credentials live only in the environment (charter §2.10). Review the raw keyword lists for slurs
before anything goes into `docs/`. Its `summary.topics` ranking replaces the surface counts in
`discourse.md` §2; fold new viral claims into Forward Court leads.

### 5.7 Remaining P2 UI items
From `review/p2-backlog.md`, still open in the code on 26 Sep 2026 (the rest of that file is fixed):
- `ui/stamp.tsx`: size `s` stamps are 16px, under the bible's 20px stamp floor.
- Kiska Media?: no ownership chain (`h-own`: Owner → Holding → Outlet) anywhere.
- `screens/files/media.css`: outlet chips are 12px mixed-case mono.
- `ui/file-card.css`: `.h-file__title` is 24px below 600px.
- `theme/tokens.css`: every `--h-fs-*` is in px, so the browser's text-size setting has no effect
  (page zoom works).
- `screens/room/receipt.tsx`: the noting, which carries the other side, is collapsed in duels.
- `screens/files/forwards.tsx`: sealed docket rows print the viral claim with no ruling beside it.
- `screens/route/finish.tsx`: the first-clear ceremony still celebrates a 0/6 run.
- `three/runtime.ts`: capable phones download the 3D chunk (about 1.1 MB gzip) on their first finish
  or result without asking.
- Home: once today's file is done and nothing is left to resume, the one violet button ("Duel
  Babu-Bot") sits at the bottom of a very long page on a phone.
- Economy (`lib/progression.mjs`, shared with JHK): the label mostly measures volume (a wrong answer on
  a new card pays 18 XP against 27 for a right one), the speed bonus rewards answering before reading,
  and the `night-owl` achievement pays +50 XP for playing between 23:00 and 04:00.
- The design bible still says "New file at 00:00 IST" while the engine keys the day to local time; the
  app's "midnight, your time" copy is the honest one, so fix the bible.
- Seen in the final verifier's PNGs, to re-check live: the "FILE CLEARED · 8/24" stamp wraps at 390,
  the 1440 result carousel clips its third card and stretches short cards, the 1440 cartogram's Centre
  drawer label reads "INCENTRE", and the Vault shows "Re-check 12 due" on day one.

### 5.8 Content cadence
About 25 new items a month through the `hisaab-editorial` skill, the validator, the giveaway detector
and an independent re-fetch; a ledger row for each new money-trail measure; statuses re-verified per
5.3 and never left older than 6 months.

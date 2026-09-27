# HISAAB DO — human-duel and certificate panel

Date: 27 September 2026 (UTC). Branch: `feat/hisaab-human-duels-certificates`.

This is the requested three-loop, two-round review. The advisor coordinates product, motivation,
design and skeptical review; separate implementation agents own flow, certificates and server work.
These are review perspectives, not interviews with external experts or a claim of user testing.
Rounds below are recorded only when performed. The latest user request supersedes older HISAAB
documents that preserve bot entry, make Desh Bhakt hidden, or place Anti-National at the XP endpoint.
GitHub is the requested delivery destination. Do not merge into `main` or `master` or publish to Sites.

## Loop 1 / round 1 — source inspection and proposal (performed)

Inspected `editions/hisaab/PRODUCT.md`, `DESIGN.md`, `app/README.md`, `engine/labels.mjs`,
`app/screens/home/index.tsx`, `app/ads/ad-slot.tsx`, `server/core.mjs`,
`docs/hisaab/CHARTER.md`, and targeted authoritative-server schema/README sections.

Observed starting defects against the new request:

1. Permanent band 8 is Certified Anti-National, while temporary server title is Desh Bhakt.
2. Home redirects a fresh profile to onboarding and prioritizes today's solo file; it imports bot
   language and does not yet offer the requested immediate human-duel entry.
3. Advertising currently supports only an optional home-footer slot. Requested between-game video
   opportunities require a real provider bridge and a no-fill/error path; an invented countdown is
   not an advertisement.
4. Existing server match authority protects answers and standings, but the inspected starting schema
   does not implement this update's simulated stake wallet and settlement.
5. Existing instructions contain historical contradictions. Root owns the current PRODUCT/DESIGN
   amendment so screen agents are not forced to obey superseded requirements.

Proposed outcome: a home with **Find a duel** as the primary action and **Today's file** adjacent,
an optional remembered daily landing preference, understandable optional stakes, and a funny personal
certificate whose composition makes mastery visible. Keep the receipt central to learning.

## Loop 1 / round 2 — skeptical decisions and implementation contract (performed)

| Decision | Contract | Failure to reject |
| --- | --- | --- |
| Progression | Nine existing earned XP bands remain; Andhbhakt begins the ladder and Deshbhakt ends it at band 8 / presentation slot 10. | Adding an unnecessary XP band or changing earned progress during a label swap. |
| Hidden title | Certified Anti-National replaces the server-issued hidden honour in slot 9. Require a current eligible competition grant with source, rank and expiry. Savings-board champion can qualify through its server grant. | Local XP unlocking the hidden title, an unearned teaser row, stale grants on certificates. |
| Home and daily | Direct human-duel entry on home, with Today's file visible. A landing preference may open today's file once per session; invite/deep links take priority. Login/return does not autoqueue or wager. | Forced daily play preventing the requested direct duel, or onboarding blocking entry. |
| Human duel | Public matchmaking, friend rooms, existing human pass-and-play remain honest about their transport. No bot fallback or bot entry in the HISAAB product flow. Practice files remain untimed learning. | A bot portrayed as a person or silently inserted during a wait. |
| Currency | Display **UPI tax savings** with concise simulated/no-cash-value context. Optional fixed per-match stake agreed by both players; zero stake is always playable. | Treating the satire label as actual tax savings, payment or withdrawable money. |
| Settlement | Server reserves stakes and settles each match once. Draw/cancellation refunds; balances cannot go negative. Stable seat locking prevents concurrent overspending. | Client-owned balances, reloaded result granting again, abandoned room trapping a stake. |
| x10 files | Selected subsidies, pre-election and media files explicitly show the base earned reward and x10 completion reward. Never multiply the stake pot. Final amount and anti-farming conditions are synchronized with server implementation. | An x10 badge without an actual reward, or a misleading tenfold payout promise. |
| Feedback | Correct answer: **Waah Waah**. A short win flourish and quieter loss encouragement appear after resolution, with source/review and next action intact. | Celebrating a loss as a monetary win, "win it back" copy, blocking confetti or autoplay sound. |
| Ads | After each completed practice file, and after two completed wins or three completed losses, create a between-game video opportunity. Receipt first; no live-question or unanswered-player interruption. Draws and cancelled matches do not increment outcome counters. Count each completion once. | Forced video before the answer/source, duplicate counter increments, claiming every opportunity is guaranteed fill. |
| Ad failure | Real publisher configuration/approval/consent is required for an active provider. No provider/no fill/error continues promptly. The provider may frequency-cap or return an interstitial instead of video; report that honestly. | Fake sponsor videos, unbounded wait, or a guaranteed-video claim without provider support. |
| Certificate | Player portrait share of the **image area** grows 30%→90% across the nine earned bands. The consistent Modi-inspired caricature occupies the inverse share and becomes less cheerful; hidden honour uses a crying expression. Name, game title and badge remain legible outside that area. | A large portrait obscuring title/source, generic art with no level differentiation, official-looking endorsement. |
| Photo/share | Optional user-selected profile image, locally normalized, explicit remove, usable no-photo fallback. Preview before Web Share/download; no automatic social posting. Label satire on the artifact. | Uploading without a stated destination, a broken image preventing sharing, stale hidden title in exported PNG. |
| Bank size | Remove public full-bank counts and collection totals that expose inventory. Round progress may remain so players understand the current session. | Hiding the progress needed to know when a current game ends, or claiming the public client bundle conceals the bank from inspection. |

The implementation uses the existing newspaper identity (paper/ink, ruled geometry, restrained
violet), not a new unrelated visual system. A medal communicates earned progress; a separate temporary
stamp communicates an active competition title. Photo composition is the main social joke. The
player chooses whether to share it.

Motivation interpretation: competence comes from accurate immediate feedback and readable receipts;
autonomy from direct duel/daily choice and optional stakes; relatedness from real human opponents and
voluntary certificates. These are design hypotheses. No retention uplift, learning gain, or conversion
claim has been measured in this update. Avoid loss-chasing, punishment streaks and artificial urgency.

Sources inspected for these decisions (accessed 27 September 2026):

- Przybylski, Rigby and Ryan (2010), [A Motivational Model of Video Game Engagement](https://selfdeterminationtheory.org/wp-content/uploads/2014/04/2010_PrzybylskiRigbyRyan_ROGP.pdf): competence, autonomy and relatedness provide a basis for the design hypotheses, not a prediction of product retention.
- Moller, Kornfield and Lu (2024), [Competition and Digital Game Design](https://selfdeterminationtheory.org/wp-content/uploads/2024/06/2024_MollerKornfieldLu_CompDigitalGame.pdf): competition should be designed with the quality of player motivation in view.
- Tyack and Mekler (2024), [Self-Determination Theory and HCI Games Research](https://arxiv.org/abs/2405.12639): a useful skeptical check against treating theory labels as evidence that a feature works.
- Google, [Ad Placement API `adBreak`](https://developers.google.com/ad-placement/apis/adbreak): placements/callbacks, no-fill and frequency-cap states, and `adBreakDone` support completion paths even when no ad appears.
- W3C, [Understanding SC 2.3.3: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html): nonessential feedback motion can be disabled; honor reduced-motion preferences. This is design guidance, not a claim that the whole product is WCAG certified.

## Loop 2 / round 3 — landed implementation review (performed)

Read the first landed changes to home, router, landing preference, label validation, certificate UI,
portrait normalization, certificate-art geometry, server economy/SQL, online stake controls and the
advertising cadence/provider modules. Root also reported current-product amendments and removal of
legacy bot CTAs in rules, receipts and friend fallbacks. Those reports are not test evidence.

Confirmed by source inspection:

- The permanent label becomes Deshbhakt without changing XP bands. The hidden grant requires
  `certified-antinational` and allows only rank 1 for the savings source.
- Fresh Home no longer redirects to the welcome poster. Home contains human-duel, daily-practice
  and daily-duel actions. The duel helper routes to the online desk and removes the old bot query.
- The server contract fixes ordinary completion reward at 10 and selected-file reward at 100
  (x10). Both seats must answer at least three questions; the recipient needs at least one correct
  answer. Rewards are once per guest/file/UTC day. The pot is separate.
- Savings rank uses balance plus reserved own stake, avoiding rank changes merely from confirming
  a room. Starter-only profiles do not qualify until receiving a completion reward. This limits
  easy farming within one guest identity; it does not prove unique humans or prevent collusion.
- Ad cadence keeps independent cumulative win/loss counters, deduplicates completion IDs, skips
  draws for those counters, and fails safely when persistence is unavailable. The provider has a
  bounded no-fill/error lifecycle; active real advertising remains a configuration/service matter.
- Portrait input is limited to JPG/PNG/WebP, normalized locally to a 640px JPEG, and can be removed.
  The art model uses an exact 30→90% portrait allocation.

Actionable critiques sent to the responsible lanes:

1. **Daily copy:** “new daily file … each visit” implies new content on every visit. Say daily and
   preserve the user's voluntary start. Flow owns the correction.
2. **Leaderboard link:** the Home UPI-savings link should actually select the savings board rather
   than the default points board. Flow owns the correction.
3. **Sprite geometry:** at this intermediate point, certificate-art PNG crop uses 5×2 while the UI
   CSS variables use 3×2. Make both match the final generated asset; the PNG and preview must agree.
4. **Honour lifecycle:** a hook that captures the online guest once must clear its grant if that
   guest is forgotten or replaced; an old guest's award must not appear on a new profile's card.
5. **Stake escape:** the initial cancellation-refund rule is too broad. The intermediate SQL refunds
   an intentional `player-left` cancellation even after play begins, letting a losing player avoid
   every stake loss. Root/server were asked to distinguish pre-start/system cancellation from an
   explicit post-start quit, and to disclose disconnect handling. This corrects the round-2 contract;
   it must not be hidden by calling all exits refunds.

## Loop 2 / round 4 — correction and source evidence review (performed)

Re-read the corrected flow, online settings/standings, certificate-art, competition-title hook,
certificate share guard, outcome feedback and completion-ad components after lane handoff.

- **Accepted:** daily return copy now says today's file is ready; the preference opens the daily
  duel desk on a bare visit without queueing. Shared/deep links retain priority. The savings link
  includes `period=savings`, and the standings component reads it.
- **Accepted:** final art is a 3×2 generated sheet. DOM background geometry and PNG cropping now
  use that same grid. Nine permanent certificate designs combine six facial poses with distinct
  captions, medal numbers and photo proportions; this is not a claim of nine unique drawings.
- **Accepted:** title display binds the grant to the current guest; certificate export re-reads the
  authoritative profile and rejects an unavailable/expired/displaced grant. The remaining bounded
  correction is consistent server-adjusted time in the actual card/export validators rather than
  mixing it with the device wall clock. Certificate agent owns that change.
- **Corrected decision:** root accepted pre-start/system cancellation and draw refunds; deliberate
  post-start quit forfeits the reserved stake to the opponent. A single absent seat gets 90 seconds
  while the rival remains active; both absent seats refund. Forfeits do not earn completion rewards
  or competitive standings. Online Ready text and Quit confirmation now disclose this rule. The
  server implementation and actual SQL evidence remain a round-5/6 gate.
- **Accepted:** online reward copy matches the 10→100 contract and explicitly separates completion
  bonus from stake. The zero-stake choice remains available when balance is zero.
- **Accepted:** win/loss/draw acknowledgement is inline, with a 650ms animation disabled by reduced
  motion and Effects Off. Loss copy recognizes learning without implying a financial win.
- **Accepted with service limit:** completion ads deduplicate before requesting a placement, defer
  until the result's short feedback has finished, and stay out of live/held/promotion states. A
  modal supports returning to the result and provider teardown. No active publisher is assumed.
- **Small correction requested:** the savings SQL response uses `matches:0` as an unused placeholder.
  Hide the Matches column on the savings table so the UI does not report a false count.

This round accepts the implementation direction after concrete corrections, not a runtime release.
Root is executing the focused HISAAB tests, production build and browser scenarios; server is
executing SQL checks. No result is inferred before those commands finish.

## Loop 3 / round 5 — integration evidence review (performed)

The integration review checks actual test output and rendered scenarios against these risks:

| Risk | Required evidence |
| --- | --- |
| Wager loss can be evaded | SQL post-start quit, one-seat absence, both-seat absence, duplicate settlement, refunds and balance conservation. |
| UI overstates backend support | Build/fixtures plus an explicit distinction between branch implementation and deployed schema/service. |
| New people cannot reach play | Fresh Home direct duel, legacy room/duel links, zero-balance desk and daily preference/deep-link browser scenarios. |
| Personal certificate breaks | Rendered low/high/hidden cards, photo add/remove, share/download, source/expiry and final sprite geometry. |
| Bank inventory remains public UI | Public file/rules surfaces omit bank/pool totals; current-round progress remains understandable. |
| Ad affects an active game | Deduplicated counters, terminal-only mounting, offline/consent/no-fill/timeout handling, teardown and reduced-motion evidence. |
| Hidden title becomes permanent | Title validation, freshness/identity/expiry checks, no ordinary ladder row, export server refresh. |

A browser using deterministic network fixtures can verify client rendering and interactions; it
does not verify the hosted multiplayer backend or real ad inventory. PGlite can execute PostgreSQL
logic locally; it does not establish multi-connection production lock behavior. Final results and
remaining limitations will be recorded after the outputs arrive.

Evidence already examined in this round:

- Advisor visually opened `/tmp/hisaab-certificate-export-8.png` and
  `/tmp/hisaab-certificate-mobile.png`. The final earned card shows the 90/10 image split and crying
  mascot; title, medal and satire footer remain legible. The no-photo mobile card and profile-photo
  controls fit the captured screen. Localhost in the test artifact is its observed test origin,
  not a production URL claim.
- Source recheck confirms server-adjusted time is used in certificate DOM, canvas and text
  validators. The savings table no longer presents the placeholder zero Matches column.
- **Integration defect identified by root:** online matches award cumulative `onlineXp`, but the
  incumbent profile/Home/certificate ladder reads only local practice XP. Consequently a player
  who only duels would never grow the requested personal certificate. Root assigned a shared
  read-only display total of practice XP plus the current guest's cumulative online XP. Repeated
  snapshots must not grant or accumulate the same XP again; the public board remains server-only.
  Certificate dates and receipt counts must not be invented from the combined XP. Identity removal
  must remove that guest's online contribution. This is a completion gate for the requested flow.

Resolution: the shared `usePersonalXp` hook subscribes to the current online session and derives the
two cumulative totals without writing local XP. Home, top bar, profile and certificate use it. The
client rejects late responses for a forgotten/replaced identity. Root's real-browser fixture gives
the current guest 1,000,000 online XP, verifies Deshbhakt and a 90/10 certificate, and repeats after
reload. Certificate lane separately verifies `online.forget()` restores the local Andhbhakt card
and removes the hidden honour immediately. No promotion timestamp or online receipt count is
fabricated; a missing historical promotion date remains undated.

The advisor read `outputs/duel-first/report.json` directly: 14 checks, no recorded page errors.
The advisor also opened its fresh mobile Home capture. That review found two remaining Home
records-room summaries saying “1 file · 6 cards”; root removed those collection-card totals while
keeping current-session question progress. This was the last requested copy correction, not a new
visual redesign.

## Loop 3 / round 6 — release decision and evidence (performed)

**Accepted for the requested feature-branch commit and GitHub push.** All three loops and six rounds
above were performed. The decision follows source defects, actual changes, skeptical corrections,
executed verification and rendered evidence. It is not approval of an untested production rollout.

| Evidence | Observed result and scope |
| --- | --- |
| Root: `node --test tests/*.test.mjs` | 938 passed, zero failed/skipped. Includes the edition and unrelated-game regression suite; do not add the smaller overlapping lane totals to this count. |
| Root: TypeScript check, `pnpm build:hisaab` and `git diff --check` | TypeScript clean; final build and whitespace check passed after the Home copy cleanup. |
| Root: HISAAB built-artifact verifier | `ok=true`, 212 files, 62 local references, 10,709,149 bytes. This checks the built edition, not hosted traffic. |
| Root: `node scripts/hisaab-duel-first-check.mjs` | 14 real-browser checks with mocked API, zero page errors. 390px light, 1440px dark and 320px Classic; zero balance/stake, selected x10 file and explicit Ready payload, answer lock/reload, Waah Waah, no early opponent reveal, completion view, photo validation/normalization/PNG/removal and online-XP progression. Advisor read the report and inspected captures. |
| Certificate lane: `scripts/hisaab-certificate-check.mjs` | Actual browser photo upload/normalization/download/removal; online XP advances the portrait; active hidden savings grant exports; forgetting identity immediately resets online progress and removes the honour. |
| Server lane: `tests/hisaab-postgres-runner.mjs` with PGlite | 51 security assertions + 41 economy assertions + 3 reapply/privilege checks = 95 SQL checks passed. Covers explicit stake confirmation, conservation, duplicate settlement, x10 caps, zero-balance play, strict files/daily IDs, pre-start refunds, post-start quit/deletion/one-seat-disconnect forfeits, both-absent refunds and immediate savings-title displacement. |
| Server lane: focused Node server/client suites | 25 checks passed, including immutable cumulative profile updates and rejection of an old guest's late response. Included/overlapping with the root suite, not 25 additional distinct tests. |

The test reports above identify their operator. Advisor-owned verification consisted of reading
the changed source, examining the browser report and opening the specified images; the advisor did
not rerun every lane's commands and does not claim to have done so.

Remaining delivery limits are concrete:

- This change is prepared on `feat/hisaab-human-duels-certificates`; `main` and `master` are not
  merged. GitHub push is the authorized handoff. No ChatGPT Sites deployment is part of this work.
- The new server schema, bank seed, matching Edge function and trusted expiry scheduler have not
  been applied to production by this branch. The existing public game therefore is not evidence
  that these new stakes/rewards are already live. Follow `supabase/hisaab/README.md` and
  `docs/hisaab/DUEL-FIRST-RELEASE.md` for release order and required services.
- PGlite proves executed PostgreSQL logic on one connection; concurrent production connections,
  load behavior, WAN timing and a running scheduled sweep remain staging/deployment checks.
- Ad opportunities and provider integration are implemented. Actual advertisements require a
  configured/approved publisher and consent integration; no-fill, provider limits and formats mean
  a video at every opportunity cannot be promised. This review did not buy or activate ads.
- Guests are browser identities. The earned-reward cap and savings ranking are reproducible, but
  disposable guests/collusion are not solved. These simulated units cannot be purchased, withdrawn
  or represented as actual UPI payments or tax savings.

Stop condition reached: the requested branch implementation is verified sufficiently for review
and push. Additional polish, retention experiments, production scaling and new modes are outside
this six-round completion; they are not grounds to delay the handoff.

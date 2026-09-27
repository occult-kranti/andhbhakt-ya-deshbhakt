# Profile and play release panel

This is a three-loop, two-round review of Jaanta Hai Kya (JHK) and Andhbhakt Ya Deshbhakt (AYD). The advisor/moderator, senior technical reviewer, and psychology/design reviewer are AI perspectives. Their judgments are not a human usability study, legal opinion, or professional endorsement.

## Scope and evidence rules

Required outcomes: a required profile with private, unverified contact email and no password/verification step; useful profile controls; preserved existing progress; at most three JHK progression notifications after a round and at most two visible overlays; genuine ad opportunities after two wins or three losses in both games; verified optional simulated-coin stakes and zero-coin JHK play; a source-backed launch checklist.

Email is contact information, not proof of identity. Possession of a recovery secret/bearer session authorizes a profile. Email alone must never resume another profile. Existing wallet and progression data must survive setup. No provider approval or ad fill may be fabricated.

Code observations, browser interactions, automated tests, and external research are recorded separately. An unrun check is pending. A successful build does not prove deployment or live interaction.

## Baseline

| Project | Baseline revision |
| --- | --- |
| AYD | `9be25a5c165f87e15c9260b1e047467b7a2044fb` |
| JHK / fact-duel | `3151a8f23c947db0e1b1f4a3a8c96da505296dc4` |

### Loop 1, round 1 — independent baseline assessment

Advisor code observations:

- `app/shell/profile-gate.tsx` has a visible guest exit and copy promising a verify-by-link step. Its local claim suppresses future prompts. These do not meet the requested required-profile flow.
- `lib/profile-gate.mjs` contains visit-based re-prompting after a skip. That logic is inappropriate for a required setup; legacy records need migration rather than erasure.
- JHK `app/screens/use-progression-feedback.tsx` submits all queued progression candidates. `components/fx/overlay-budget.ts` already limits visible weight to two but explicitly has no queue ceiling. The required per-round maximum is a distinct missing limit.
- The same budget's quiet mode stops new grants but leaves active overlays visible. The revised implementation must examine the transition into a live question.
- JHK `app/screens/play/match-settings.tsx` constructs `[0, ...economy.stakes]` and supports free practice. The required free entry exists; its zero-balance usability needs regression evidence.
- AYD `editions/hisaab/app/ads/game-runtime.mjs` already has provider/consent eligibility, load/show deadlines, and a direct Continue gesture. Preserve these constraints when sharing cadence with JHK.

Browser observations: none at this baseline round. Visual and interaction findings remain hypotheses until exercised.

### Loop 1, round 2 — moderated decisions

Independent backend review found existing UUID-keyed private sessions, 30-day bearer access and no profile email. Its accepted design is an in-place upgrade, a separate high-entropy recovery secret stored as a hash, duplicate unverified emails allowed, bearer rotation after successful recovery, and unchanged UUID/wallet/XP. The technical reviewer will exercise wrong-code refusal, migration and public-data boundaries.

Independent JHK and AYD interface reviews both identified guest/deep-link bypasses. Accepted design: gate each new playable task with a compact public nickname/private contact form; offer code-based restoration as a separate action; expose edit, export, deletion and recovery controls in the profile. AYD keeps its local ladder, certificates and photo preferences. Public rules, help and legal information remain accessible before setup. Existing active games may finish or leave; the next game requires setup.

The moderator accepted the release owner's explicit **18+ beta policy**, enforced as a self-attestation with no date-of-birth collection. It is not age verification. Generated recovery codes must be shown with a copy/save action and a warning that code possession grants access and email cannot recover a profile. Secrets must not appear in URLs, share outputs or public records. Form failures retain the person's input and allow retry.

Current launch research identified an unresolved operator/grievance contact. Do not invent an address or imply that technical publication fulfills a functioning contact channel. The dated launch checklist owns the precise source-backed legal assessment.

Independent feedback/ad review found an existing shared cadence policy and real Google H5 adapter, disabled by default and gated by publisher/origin/configuration/consent. The current five-second auto-open at the result is replaced with a voluntary Continue action at that natural break, preserving the result receipt as the primary content. The moderator accepted cumulative wins/losses since the last opportunity: two wins **or** three losses triggers; consume/reset both counters on that opportunity; draws count neither; stable result IDs prevent duplicate counting on reload. There is no catch-up queue of missed ads.

For progression, the existing capacity-two scheduler remains. A per-round scope selects at most three total progression presentations across ceremony and toast types, preserves other detail in history, and clears active/queued progression when the next question starts. Round 2 is complete; these bounded decisions define the implementation reviewed in loop 2.

## Acceptance ledger

| ID | Finding / task impact | Decision and owner | Observable acceptance | Result |
| --- | --- | --- | --- | --- |
| P1 | Guest exits allow play without the requested profile. | Required setup gates play, with no guest, password, or verify step. Profile implementer. | Fresh visitor and direct play route cannot start until valid name/email setup succeeds; failure keeps an actionable retry. | Accepted for configured production: public desktop gate/deep-link/practice checks and validation passed; live API setup passed. Full UI account completion was not performed. |
| P2 | Unverified contact could be mistaken for account ownership. | Keep email private and explicitly unverified; recovery secret/bearer owns access. Profile implementer. | Email alone cannot load another profile; wrong recovery code is rejected; correct recovery restores the intended profile. | Accepted: code boundary, actual Edge/SQL and live recovery tests passed. Public UI recovery switch observed; full UI recovery flow not exercised. |
| P3 | Existing local state can be lost during account migration. | Reuse/migrate existing storage and progress, asking only for missing setup data. Profile implementer. | Seeded wallet, progression, name, preferences survive setup and reload. | Accepted at migration/API level: actual SQL upgrade kept UUID, 345 coins, 30 XP; existing local storage paths retained. Seeded local UI reload remains pilot QA. |
| P4 | Required data collection needs visible purpose and controls. | Keep setup concise; provide edit contact/name and recovery controls in profile. Profile implementer. | Valid edits persist; private contact is absent from public profile/share/leaderboard payloads; recovery warning accurately describes limitations. | Accepted: private payload boundaries and functional endpoints tested; public setup/personalization reviewed. Full UI edit/export/delete flow remains pilot QA. |
| N1 | Two-at-once budget does not bound total progression interruptions. | Keep scheduler; select at most three progression presentations per completed round. JHK implementer. | Mixed level/badge/quest/streak burst emits no more than three; omitted detail remains in history/summary. | Scoped gate/lifecycle tests passed; actual caller wired. |
| N2 | Active overlays can spill into the next question. | Keep feedback out of live timed play and retain maximum visible capacity two. JHK implementer. | Advancing quickly cannot leave progression overlays over a question; ceremony occupies the full budget. | Accepted from scoped lifecycle/capacity tests and actual arena wiring; a complete live UI reward-burst observation was not performed. |
| A1 | Requested cadence applies to two games and must resist duplicate result effects. | Persist idempotent outcome counters; create one opportunity at two wins or three losses. Ads implementer. | Threshold boundaries, duplicate outcome, draw, reload, and counter consumption covered in meaningful policy tests. | Shared cadence tests passed; both result-screen mounts reviewed. |
| A2 | An opportunity is not guaranteed paid video fill. | Require approved configuration and consent; continue safely after decline, no-fill, timeout, or error. Ads implementer. | No SDK without eligibility; no blank blocking screen; no fake ad or reward; actual provider request only under configured conditions. | Policy/lifecycle tests passed. Live inventory remains disabled/unverified pending provider approval. |
| W1 | Stakes already include free entry. | Preserve optional simulated-coin wagers and zero-balance play. JHK implementer. | Zero wallet can start and complete free/practice play without an ad or top-up requirement. | Accepted from combined evidence: JHK SQL verifies zero-balance access/no debt; live checks verify zero-stake start and a full duel, optional stakes and settlement/refund/forfeit. AYD separately completed a full zero-balance duel. No ad/top-up requirement. |
| L1 | Publishing a build does not make all commercial/legal prerequisites complete. | Maintain dated primary-source checklist with owner decisions and concrete external blockers. Research/release owner. | Checklist distinguishes implemented safeguards, verified facts, owner actions, and items needing qualified advice/provider approval. | Dated launch checklist delivered, including operator/contact, current law, domains/DNS, optional identity-provider/SMTP setup, hosting and ad prerequisites. Owner/external tasks remain unchecked. |
| R1 | Source/build success can differ from live deployment. | Run required repository gates, publish under existing authorization, verify live routes. Release owner. | Record test/build outcomes, deployed revisions, and live setup/profile/play checks for both games. | Accepted: both Pages jobs succeeded and public release manifests match candidate revisions; live backend smoke/economy and bounded desktop UI checks passed. Limits below. |

## Loop 2 — changed implementation and critique

### Round 3 — repeat the tasks against the implementation

Review in progress against the working tree derived from the baseline revisions, not the unchanged baseline. Initial changed artifact inspected: AYD `editions/hisaab/app/shell/profile-access.tsx`, with server-backed required setup, private-email copy, adult/terms attestation and recovery-code flow.

Advisor found a concrete migration issue: the existing-session update branch retained only `response.session` and hard-coded `recoveryCode: ''`. If an upgrade response issues the initial recovery key, this discards the only display opportunity. Sent to implementation owner for correction. The remembered-room exemption also requires a bounded lifecycle: a legacy player may finish/leave the current game, but a stale remembered room must not authorize starting the next game. Server action gating and UI transition evidence are required.

Feedback candidate inspected: both `editions/hisaab/app/ads/cadence.mjs` and `completion-ad-break.tsx`, plus JHK `components/fx/fx-provider.tsx` and `app/screens/use-progression-feedback.tsx`. Accepted both-counter reset/consumption and voluntary result-screen entry. Requested corrections: wire the round identifier into the actual arena caller; bound progression presentations without swallowing operational wallet/error status; and distinguish new-round clearing from leaving a completed round so earned feedback is not erased before it can appear. Existing reported provider/cadence tests were 19 passing in AYD and 29 passing in JHK; these do not yet prove that React's round lifecycle invokes the new cap.

Cross-layer review found AYD's optional avatar glyph values did not match the server's supported stable avatar IDs. Sent to the frontend owner; optional settings must not make otherwise valid setup fail.

Backend changed artifacts inspected: both `supabase/*/schema.sql` files and Edge `{core.mjs,index.ts}`; AYD's mirrored core; both new profile-server tests. The advisor accepted explicit public snapshot/board/circle JSON that omits email, bearer-authenticated private profile/export payloads, game-bound recovery hashes, service-role-only RPC permissions, in-place row migration, and new-match gates. The technical owner reported actual PGlite SQL and AYD Edge integration passes, including preserved legacy UUID, 345-coin balance and 30 XP. Final verification must set `PGLITE_MODULE_PATH`; otherwise those integration tests are skipped.

Baseline regression evidence collected independently: `node --test tests/jhk-server.test.mjs tests/stake-advice.test.mjs` passed 17/17. This proves zero-default stake protocol and affordability fallback, not a full zero-wallet browser completion.

### Round 4 — corrections and decision review

Correction artifact inspected in the working tree:

- AYD setup now retains the full upgrade response, including its one-time recovery code. Avatar controls send supported stable IDs while retaining their visual marks. The gate subscribes to remembered-room changes; completion clears that remembered room rather than letting stale state authorize the next play entry.
- JHK feedback now tags progression separately from operational messages. `createRoundFeedbackGate` in `components/fx/overlay-budget.ts` caps only progression, preserves its scope through `null` on result/exit, and releases old progression only when a distinct new round begins. The hook likewise avoids clearing its pending queue merely on exit. The arena now receives a round identifier from live play.
- The advisor independently ran `node --test tests/overlay-budget.test.mjs tests/hisaab-game-break.test.mjs`: **30/30 passed, zero skips**. The focused lifecycle test covers three rewards, a preserved network error, null result exit, and next-round clearing.
- The backend reviewer reported final focused integration runs with `PGLITE_MODULE_PATH`: **AYD 10/10 and JHK 5/5, zero skips**, including legacy snapshot/leave permission, rejected new start before setup, migration preservation, wrong recovery, rotation and deletion.

The revised JHK gate adds background inertness and focus trapping. Result-phase quiet now permits toasts after a question. The JHK owner reports a deliberate release-owner-approved exemption for the old unconfigured/offline static build; **configured production builds still require server-proven setup and block on server failure**. Therefore final deployment verification must prove production configuration is present. Both profiles still need final narrow-layout/browser verification. These are functional acceptance checks, not aesthetic expansion.

The advisor also corrected deletion-copy scope: deactivation clears contact/recovery data and removes participation/results, while some pseudonymous match/ledger records remain. User-facing account text and privacy notice must state the actual behavior rather than promise total historical erasure.

## Loop 3 — evidence and release

### Round 5 — candidate verification

Independent advisor review accepted the revised JHK `app/screens/online/completion-ad-break.tsx` and its actual mount in `live-duel-screen.tsx`: only a finished server match records an outcome, the stable ID includes the player's seat, cancelled matches do not qualify, configuration defaults off, and the result remains available through no-fill/cancellation. Both editions use namespace-based cadence storage. Provider code retains a genuine user-gesture request, consent/approval gates, bounded deadlines, focus restoration and audio pause.

The actual arena now supplies local/live round identifiers and uses `liveState.playing` rather than the whole match lifetime for toast quiet, allowing bounded feedback on result phases. Full-screen ceremonies remain deferred out of live play.

Implementation-owner verification reported: both TypeScript checks, both HISAAB Vite builds and the actual JHK vinext build pass; final JHK focused feedback/ad/storage tests **34/34** and AYD ad tests **19/19** pass. AYD profile owner additionally reported 25 targeted tests passing. A JHK enabled-fixture build confirmed that public ad environment values are compiled, followed by a rebuilt default-off candidate. These code/test results do not establish human usability or actual paid-ad fill.

Final ad spot check also accepted the legacy JHK friend-room mount: it requires `phase === 'complete'`, `opponent === 'friend'`, settlement and a seat-specific ID/outcome. Shared-device pass-and-play and bot matches are excluded, explicitly documented rather than assigning an arbitrary human outcome. Both profile interfaces were reviewed for edit/export/recovery controls; AYD deletion copy now states deactivation and retained pseudonymous integrity records accurately. Final browser and deployment evidence remains pending.

JHK's final profile correction likewise explains retained pseudonymous records and links privacy information. The active-match exception includes the terminal receipt until Leave, preserving the player's result before setup resumes. Its implementation owner could not run the planned Chromium visual/keyboard check because the environment lacked a Chromium executable. TypeScript, static Vite build and targeted transport/storage/server tests passed; they are not substituted for a browser check.

Additional integration evidence from the technical owner: the new `scripts/beta-profile-live-smoke.mjs` completed five checks against both **local** Edge handlers/PGlite databases, finished a five-round duel in each game, and deactivated all four QA profiles with recovery revoked. This is reproducible local integration evidence; running it against deployed endpoints remains a release check. The actual GitHub Pages static build received a public-ad-environment replacement fix in `vite.config.static.ts`; build and TypeScript passed and the emitted bundle was inspected as default-off.

### Round 6 — release review

Release-owner evidence received:

- Full repository suites passed with pinned PGlite installed and **zero skips: AYD 946/946; JHK 958/958**. Both TypeScript checks passed.
- The actual AYD build, artifact validation and question-bank validation passed. The JHK static build and assembly passed, including inspection of the default-off ad environment replacement.
- Both Supabase migrations were applied after checking that no active rooms existed. `hisaab-game` version 3 and `jhk-game` version 2 are active with custom bearer authentication; the latest runs of both expiry jobs succeeded.
- The live cross-game profile smoke passed **5/5**, completing a five-round game in each game. Cleanup was verified **4/4**, with recovery revoked **4/4**.
- AYD live economy checks passed **6/6**, including a full five-round zero-balance game, ten-coin staked settlement, and cleanup **2/2**. JHK live checks passed **17**, including a full five-round game, exactly-once duplicate settlement, optional stakes, refunds and forfeit; the process exited 0 and all three QA profiles were cleaned up.
- Both Pages workflows succeeded: AYD run `36296603774`, JHK run `36296602511`. Public `release.json` files exactly matched AYD `274c53771ad574f8efa9582fc7eab85daae83dc2` and JHK `4beca042389daf42d71cc3586c800091cf071028`; both report `adsEnabled: false`.
- Public desktop browser observations: both profile screens rendered; JHK empty-email validation/focus, personalization, last-link Tab wrapping to nickname and recovery-mode switch worked. AYD `/online` required setup; empty-name validation worked; home remained browsable; choosing today's practice file required setup. Sampled console errors were browser-extension errors, with no application errors observed.
- All six public privacy, terms and contact URLs returned HTTP 200 with the new dated content. Post-test SQL reads confirmed zero open rooms in both games and zero remaining recent named QA profiles. Sanitized live reports and the release owner's `VERIFICATION.md` preserve the final evidence.

**Round 6 closes with bounded release acceptance.** All six review rounds assessed actual baseline, implementation, corrected candidate or release artifacts. No outstanding code blocker was identified for the deployed, ad-free, configured beta. A final evidence/documentation-only commit follows the verified implementation commits; it does not change game code.

Every ledger item passes at its stated evidence layer; none is promoted into an unperformed browser or human-study claim. The public browser check did **not** create an account, accept terms or complete the full account-management/game flow. It was desktop-only; there is no claim of a mobile/device/network matrix, a two-real-device onboarding study, measured retention improvement, or a full live UI reward-burst check. Those remain explicit pilot checks in the owner checklist.

Advertising remains disabled: approval, production consent integration and actual paid/video fill are not claimed. Operator/private grievance contact and applicable launch/commercial decisions remain owner work in the checklist. Technical release acceptance is not legal clearance or provider approval.

## Bounded decisions

- Preserve the existing economy and progression systems. Free play verification is in scope; economy redesign is not.
- Preserve approved-provider/consent gates. Acquiring provider approval is an external prerequisite, not a UI simulation.
- Do not promise email-based recovery, verified email ownership, cross-device recovery without a secret, or legal clearance.
- Do not claim human usability improvements from automated checks. Report AI design judgments as such.

## Design rationale sources

The release owner reviewed the following sources. Applying them to this product is a design inference, not evidence that these changes improve retention or measured usability:

- [W3C: Understanding Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages) informs restrained, accessible announcements and the risk of excessively chatty feedback.
- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) informs keeping required setup short while exposing optional preferences and detailed history when requested.
- [Przybylski, Rigby and Ryan (2010), A Motivational Model of Video Game Engagement](https://selfdeterminationtheory.org/SDT/documents/2010_PrzybylskiRigbyRyan_ROGP.pdf) informs the panel's hypotheses about autonomy through optional preferences/free stakes, competence through bounded feedback/history, and relatedness through human play. This is not a claim of psychological or clinical benefit.

Provider placement/frequency requirements and current launch/legal sources belong to the dated launch checklist and ad implementation evidence.

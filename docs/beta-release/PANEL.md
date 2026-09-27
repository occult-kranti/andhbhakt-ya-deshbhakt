# Two-game public beta panel

Date: 27 September 2026 UTC. AYD branch: `release/beta` in `andhbhakt-ya-deshbhakt`.
JHK branch: `feat/jhk-server-beta` in `fact-duel`.

This record covers the new request to publish the political quiz as a standalone public repository
and GitHub Pages game, and enable a separate server beta for Jaanta Hai Kya. It uses three actual
loops of two rounds. The earlier six-round HISAAB source review is inherited evidence, not six new
reviews. The advisor performs source/research/evidence review; implementation and deployment remain
with their named lanes. No external panel interviews or measured retention uplift are implied.

The new explicit deployment request supersedes older PRODUCT/release notes saying “do not deploy”.
**Later user steering, relayed by root during loop 1, also supersedes the initial no-merge boundary:**
the user now requests all completed changes live and merged to each repository's main/master after
verification. Work remains isolated on the listed branches until the reviewed integration step.
Do not create or update ChatGPT Sites. The source branches, merge commits, built artifacts, backend
schema/function versions and actual public URLs must be reported separately. A custom domain is
optional; working Pages and multiplayer are the requested beta delivery.

**Round 5 contract correction:** root applied the user's “everything a duel instead of a bot”
instruction to the public JHK beta too. This supersedes this panel's earlier acceptance of labelled
legacy bot formats. In the configured public build, all competitive duel entry points must reach
real human play; practice is expeditions/untimed learning. The predecessor bot engine can remain
in source and tests without an exposed public launcher.

## Loop 1, round 1 — architecture and experience proposal (performed)

Inspected both checkouts, current PRODUCT/release/README records, HISAAB build and online runtime,
JHK static aliases and Home launchers, and both existing Pages workflows. Starting observations:

1. AYD is based on the verified HISAAB feature branch, including human duels, optional stakes,
   x10 files, the swapped permanent/hidden titles, photo certificates and ad opportunities. This
   task needs rebranding, standalone deployment configuration and real-service verification.
2. Existing JHK Pages replaces its duel client with an in-process implementation. A static build
   alone cannot make those room IDs connect two independent browsers. JHK needs its own remote
   endpoint/client/screen, not a banner that calls the local MemoryRoomStore “online”.
3. Existing JHK Quick Draw, Triple Threat and Gauntlet use different formats/timers from the new
   five-round, thirty-second Supabase beta. The UI must describe the actual rules of each mode.
4. JHK already has quests, stamps, local XP, medals, cosmetics and a fact vault. Preserve those
   useful loops; the finite addition is a real human entry, understandable online record, and a
   voluntary result-sharing action if no existing equivalent is present.
5. The existing Pages workflows target `/fact-duel/` and `/fact-duel/hisaab/`. AYD needs its own
   base/canonical/manifest/share links. A cloned workflow that publishes JHK at the new root or
   still builds an extra `/hisaab/` path would be a wrong-product deployment.
6. Both inherited workflows publish by pushing `gh-pages` with `GITHUB_TOKEN`. Current GitHub docs
   say such workflow-token pushes do not trigger a Pages build. Root must use a working deployment
   action/configuration or another explicitly verified build trigger and inspect the public site;
   the branch push alone is insufficient.

Implementation lanes confirmed by root:

| Lane | Ownership |
| --- | --- |
| Certificate/brand | AYD public name, responsive wordmarks, metadata and certificate/export identity; retain the established design. |
| Feedback/backend readiness | AYD service/ad readiness and a live smoke harness; no advertising activation without real configuration. |
| Server | Separate JHK PostgreSQL schema, RPC, Edge function, sports/science seed and targeted checks. |
| Flow | JHK server client and UI, Home/Play entry and static build configuration; preserve existing practice. |
| Root | Repository creation, deployment configuration, real backend deployment, Pages publication, cross-lane integration and verification. |
| Advisor | This file only; source critique, bounded decisions and review of actual evidence. |

## Loop 1, round 2 — skeptical scope and release contract (performed)

| Area | Decision | Reject |
| --- | --- | --- |
| AYD product | Rename to **Andhbhakt ya Deshbhakt**; preserve paper/ink/violet, bilingual UI, Day/Night/Classic, receipts and verified duel/certificate mechanics. | A redesign delaying the requested launch or old public HISAAB name/canonical paths left on share cards. |
| AYD permanent/temporary progress | Andhbhakt→Deshbhakt is permanent progression; Certified Anti-National remains a fresh server-qualified temporary honour. | A rename resetting XP or making the hidden title a public ladder teaser. |
| JHK product | Keep sports/science identity, existing theme/art, medals, local quests and learning files. Add a clearly named human server beta. | Political titles, Modi art, UPI terminology or AYD question content leaking into JHK. |
| JHK server format | State five rounds, thirty seconds each, correctness first and the actual server tie rule. Other existing formats remain accurately labelled practice/casual. | Advertising Quick Draw or old 5/7/10-second formats while the server always serves five 30-second rounds. |
| Human entry | Home/Play primary reaches the remote human desk. Waiting state and errors describe real state; private invitations reach the correct endpoint. | Silent bot filling, invented player counts, or gating remote entry on an unrelated local wallet readiness state. |
| Server separation | AYD retains its verified authority; JHK uses `jhk_private`, `public.jhk_command`, `jhk-game` and `x-jhk-session` with separate guests/wallets/results/seed. | Cross-game credential acceptance, shared rank/wallet identity or changing another application's tables. |
| Local separation | Distinct browser storage namespaces for server identity/room/preferences; GitHub project paths share an origin. | Assuming different URL paths isolate localStorage or IndexedDB. |
| Rewards and wagers | AYD retains disclosed 10→100 selected-file rewards. JHK uses a neutral 10-unit completion reward and optional zero-default stakes. Preserve atomic reservation, settlement and disclosed quit/disconnect policy. | Cash language, hidden wager consent, forced stake when balance is zero, or x10 promises in JHK without a JHK implementation. |
| Progress evidence | Server totals must stay separate from editable local records; any personal combined display derives a cumulative total once, without replay awards. | Device-local “Arena Rank” presented as centrally verified competition. |
| Outreach | A JHK share action can publish the player's chosen nickname, actual completed score/topic and public invitation link through native share/copy. Retain medals and receipts as the supporting visual. | Auto-posting, fabricated rank, copying AYD's political certificate onto JHK, or new photo-account infrastructure in this bounded launch. |
| Ads | Preserve implemented opportunity/provider lifecycle and keep ads disabled without approved publisher/consent configuration. | Calling a placeholder or countdown a video ad, guaranteeing fill, or enabling paid services as an unrequested side effect. |
| Deployment | Match schema/seed/Edge and frontend versions. Verify public built assets, actual endpoint and live two-guest play after publication. | Treating a successful push/build or local mocked browser as evidence that the public multiplayer game works. |
| Expiry | Install or verify the trusted sweep needed for unattended refunds/forfeits; check a run record. | Claiming a scheduled function runs merely because SQL for it exists in the repository. |
| Scope | Preserve and connect the existing useful retention loops. Make this beta usable and honestly described. | Adding a payment system, new identity provider, generalized account migration, broad new game modes or invented retention metrics. |

Motivation/design rationale: real opponents support social play, clear receipts and earned medals
support a sense of competence, and voluntary practice/stakes/share support player choice. These are
design hypotheses. The existing quests and return-to-file affordances are sufficient for this beta;
they do not justify punishment streaks, loss-chasing or artificial scarcity.

Primary sources consulted for the contract:

- [Przybylski, Rigby and Ryan (2010), A Motivational Model of Video Game Engagement](https://selfdeterminationtheory.org/wp-content/uploads/2014/04/2010_PrzybylskiRigbyRyan_ROGP.pdf): motivation framework for competence, autonomy and relatedness; does not establish this game's retention.
- [Moller, Kornfield and Lu (2024), Competition and Digital Game Design](https://selfdeterminationtheory.org/wp-content/uploads/2024/06/2024_MollerKornfieldLu_CompDigitalGame.pdf): competition design should consider the quality of player motivation.
- [Tyack and Mekler (2024), Self-Determination Theory and HCI Games Research](https://arxiv.org/abs/2405.12639): skeptical check against treating theoretical labels as empirical proof.
- [GitHub: configuring a Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site): a publishing branch/workflow and built site configuration are distinct from merging the application's main branch.
- [Supabase: Securing Edge Functions](https://supabase.com/docs/guides/functions/auth): distinguish platform authentication from custom guest authorization; an anonymous gateway still needs the application's checks for private state.
- [Supabase: Cron](https://supabase.com/docs/guides/cron): scheduled execution and its run history are separate deployment evidence.
- [W3C: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html): retain nonessential-motion controls during new entry/share work.

The Supabase changelog index was fetched on 27 September 2026. The 25 September PostgreSQL minor
upgrade notice concerns specific extensions/operators and legacy pgcrypto encryption. The reviewed
guest-token path uses hashing, not the affected legacy encrypted payload design. Deployment lanes
still verify the actual database/Edge configuration; this observation is not a platform-wide audit.

## Loop 2, round 3 — landed implementation review (performed)

Read the landed JHK server/seed and first human-duel screen, and AYD brand components, PRODUCT,
metadata, manifest and replacement Pages workflow. The advisor opened AYD's real-browser 320px
home capture and exported top-rank card from `/tmp/ayd-rebrand-review/`.

Confirmed implementation direction:

- JHK has separate `jhk_private`/`jhk_command`/`jhk-game`/`x-jhk-session`, its own token store and a
  sports/science seed sourced from the existing repository bank. Its rule contract is five rounds,
  thirty seconds, a 120ms tie band, optional zero-default stakes and neutral 10-unit reward.
- The selected JHK topics each contain at least five source items, checked by loading the current
  bank. No extra or silently broadened topic is needed to construct a match. This is not a fresh
  fact-check of all existing items or a promise of deep coverage in every science topic.
- The new JHK screen uses server matches, explicit Ready/stake confirmation, locked-answer receipt,
  reload resume, cancellation/forfeit text and user-triggered native-share/copy result text. It
  uses JHK language rather than political labels/art/currency.
- AYD public branding is now Andhbhakt ya Deshbhakt. The narrow header uses a compact two-line
  lockup; the exported certificate also uses two lines, clear of file metadata. The inspected
  top-rank export retains the 90/10 portrait/caricature split, crying expression and satire footer.
- AYD's canonical, Open Graph URL/image and manifest point at the standalone public path. Internal
  `hisaab` module/storage names stay stable intentionally, preserving that game's browser data.
- The new AYD workflow uses `configure-pages`, `upload-pages-artifact` and `deploy-pages`; root
  confirmed Pages is being configured for workflow deployment. This addresses the inherited
  workflow-token push problem. A successful run and fetched public artifact are still required.

Concrete defects/risks relayed for correction:

1. The first JHK screen put the 100ms elapsed-time text in `role=status`. It would continually
   announce timer updates. The flow lane was asked to leave continuous time non-live and announce
   only discrete lock/deadline changes.
2. JHK's inherited `APP_URL` handoff can replace the actual arena with a redirect to a historical
   host. Root was asked to explicitly clear that build value when supplying the new backend URL.
3. JHK Home quests/events still call the old practice launchers. Preserve those learning activities
   with clear Practice/BOT labels; new Home/Play primary must reach the human desk without a silent
   bot substitution or a misleading old-format name.
4. Cross-product deployment needs actual rejection of the other game's guest token and separate
   local storage. Different GitHub project paths do not provide origin-level storage isolation.
5. Before applying AYD economy changes, the backend lane must test upgrade from the previously
   deployed schema, not only creating a new empty schema. Root reported no active old rooms at
   its inspection, and reported the scheduler extension was not yet installed; neither is itself
   evidence that migration or scheduling has finished.

The screenshots inspected here demonstrate local rendering under the new base. They are not
claims that the public URL, backend or advertisement inventory is live.

## Loop 2, round 4 — correction and integration critique (performed)

Re-read the corrected JHK human screen, Home callback and Arena navigation, isolated client storage,
both Pages workflows, and AYD's backend-readiness record. The previously flagged changes are now
concrete:

- JHK elapsed time no longer has a permanent live-region role. Only answer-lock/deadline messages
  become status announcements; its countdown uses `role=timer`.
- Home's primary callback is `onLive`, independent of the local practice `ready` condition. Play
  navigation opens the remote desk. Existing quests retain their practice handler and the Home
  section explicitly calls those device practice, with separate human server rank. The online
  profile card likewise distinguishes online XP/coins from practice medals, quests and stamps.
- JHK's Pages build explicitly clears `APP_URL` and supplies the JHK endpoint. AYD's build supplies
  its own base and HISAAB endpoint. Both use official Pages artifact/deployment actions.
- AYD's populated upgrade fixture passed nine assertions against prior deployed baseline
  `b74c287`: old guests/answers survive, historical rewards are not retroactively farmed, starter
  grants and reapplication are idempotent, and private-table/anonymous-access boundaries remain.
  This resolves the empty-database-only upgrade concern.
- Certificate lane's production-base build/artifact gate passed, reporting 213 files and 62 local
  references. Its font audit found all 29 referenced font files, including Devanagari. The
  canonical/social metadata and bundled endpoint were checked against the standalone destination.

The reviewed integration is ready for the live-service/evidence round. This is not acceptance of
Pages publication or JHK live play yet. Root owns deployment and merge; the remaining evidence
must show the actual built URL and backend behavior, not a second copy of source assertions.

## Loop 3, round 5 — executed evidence review (performed)

The advisor read the redacted live AYD report at `/tmp/ayd-live-beta-smoke.json`, which ran against
the real `hisaab-game` Edge endpoint from 03:17:08 to 03:19:00 UTC on 27 September. It contains six
passing scenario gates and 122 HTTP requests from two independent disposable private QA guests:

- explicit stake confirmation, concurrent duplicate Ready and a 20-unit pre-start refund;
- a post-start 100-unit forfeit settled once, leaving one guest at zero;
- that zero-balance guest completed a zero-stake five-round human duel;
- concurrent answer submissions preserved private receipt timing and duplicate-answer idempotence;
- a media duel with 5 units staked each paid the 10-unit pot separately from 100-unit completion
  rewards: balances `[10,210]` became `[115,305]`, with repeated settlement paying nothing extra;
- private QA matches stayed out of daily competitive standings, and both QA guests were revoked.

The backend lane additionally reports the named `ayd-expire-rooms` minute job active with two
successful run records, matching Edge v2/schema/seed, RLS on private tables, anonymous RPC denied
and service-role execution allowed. Those are deployment-lane observations, not load-test claims.
The real HTTP report proves bounded concurrent duplicate behavior on the deployed service; it does
not establish geographic fairness, high-volume performance or resistance to guest-account farming.

The server lane's durable `supabase/jhk/VERIFICATION.md` records the completed JHK deployed gates:
51 security and 32 economy/isolation assertions in rollback fixtures, followed by 17 real HTTP
checks with independent guest credentials. These include a completed five-round science game,
concurrent duplicate Ready/answers, exactly-once XP/pot/reward, zero stake, pre-start refund,
post-start forfeit, and both directions of cross-game token rejection. Cleanup found no active
synthetic QA guests in either namespace. The JHK minute cron is configured and active; the server
lane inspected a succeeded run at 03:23:00 UTC (returned one row). That proves invocation, not
that this particular sweep found an expired room. The earlier HTTP harness assertion was
corrected to allow an authoritative next-round snapshot after the ten-second result break; final
XP/coins still verify duplicate-credit behavior. No server rule was changed to satisfy the test.

Root's final AYD run reports 938 Node tests passing, production build/artifact verification,
213 files/62 local references, and all 29 referenced fonts present. These results supplement,
rather than replace, the real HTTP evidence above.

Round 5 also caught a scope mismatch in the earlier JHK proposal: labelled bot launchers would
still violate the requested human-only duel entry. Root has required the configured public build
to route all Home, Play, quest/event and old classic-format duel CTAs to humans, with expeditions
retained for learning practice. The flow lane is implementing that bounded correction. A direct
Chromium service request also encountered an execution-environment transport problem; any Node
relay browser evidence must be labelled as such, while actual CORS/preflight and published URLs
are checked separately. A relay is not evidence of a browser-native WAN connection.

The advisor's final source pass found and relayed a remaining direct `setTab('arena')` path from
collections, which bypassed the first per-CTA guards. The flow lane corrected it and added the
central public-build boundary: the legacy `PlayScreen` cannot render when the server is configured,
residual arena routes render the human desk, and the predecessor `create()` returns to that desk.
The advisor directly re-read those changes. Learning practice routes to expeditions.

The completed `/tmp/jhk-live-ui/report.json` contains eleven passing checks and no page errors:
two isolated browser guests share a real private room, complete five rounds, recover a locked
answer after reload, receive settlement, retain online XP/coins, open the board, navigate learning
to expeditions, return Play to the human desk and see the separate server record in Player. Both
temporary guests were deleted. The advisor opened the 320px desk, question and result captures;
the stake/reward distinction, readable answer/source receipt and voluntary share action are present.
This test relayed exact endpoint requests through Node because Chromium's direct egress was blocked;
responses and settlement came from the real deployed service, with no fabricated fixture answers.
It is UI-to-real-service integration evidence under that stated transport boundary.

Root independently observed both deployed OPTIONS responses at HTTP 204, allowing the public
origin and exact product session/header names, and opened AYD's published Home/duel controls in
the cloud browser. The advisor independently fetched AYD Home and `release.json` with HTTP 200;
the manifest identifies `848637cdcb0ebf20ebb133f02196bf49c60d8e79`, built at 03:27:34 UTC.
Root reports its Pages workflow run `36291398575` succeeded for that commit. The first attempt to
retrieve these URLs through the search renderer was unavailable; direct HTTP retrieval succeeded,
so the renderer limitation was not misreported as a site outage.

Root's final JHK source gate reports 950 Node tests passing, clean TypeScript and a successful
production build after the public-entry corrections. The API/player cleanup and UI reports are
kept distinct from these static gates. Advertising remains disabled because publisher/CMP/H5
approval is absent.

## Loop 3, round 6 — release critique and verdict (performed)

**Approve the completed code and authorized JHK merge/publication; AYD is already published.**
The first five rounds produced concrete architecture, scope, route, accessibility, migration and
deployment corrections. The final critique checked the actual evidence against the release
contract instead of adding new gamification or optional visual work:

| Release claim | Evidence and boundary |
| --- | --- |
| AYD retains the requested game under its new public identity | Production artifact/metadata checks, narrow and certificate exports, inherited functional certificate gate, published Home and live human service. |
| Both games have real server authority | Separate deployed namespaces/Edge functions, private role checks, actual HTTP matches, exactly-once wallet/XP tests and cross-game credential rejection. |
| Public JHK duels are human-only | Central configured-build source guards and browser navigation gate; untimed learning remains available. |
| Optional wagers do not exclude zero-balance play | Real AYD zero-balance completed duel, JHK zero-stake service gate, explicit Ready confirmation and visible stake/reward terms. |
| The game can recover and settle | JHK browser reload/receipt/result gate, bounded deployed duplicate races, refund/forfeit assertions and successful cron invocation in both namespaces. |
| Personal sharing is voluntary and honest | AYD current-grant/photo certificates preserved; JHK shares its actual completed result through an explicit button. No auto-post or measured virality claim. |
| Public release can be reproduced | Main-branch workflows build the correct product/base/backend, use Pages artifact deployment and emit commit manifests; both initial published manifests were fetched successfully as recorded below. |

At the close of round 6, the reviewed code was approved for the requested release, with JHK's Pages
workflow still pending. Both initial publications were then verified below. The live followup
found bounded inherited mission/copy defects; their corrections and final acceptance are recorded
after the publication entries rather than silently erasing the original review boundary.

Remaining product limits are explicit: guest profiles are not verified unique people or a
cross-device account system; the finite match tests are not a load benchmark or geographic timing
fairness guarantee; the public learning bank is not secret; paid video/display ads are off until
real publisher/CMP/H5 configuration and approval exist. These limits do not conceal fake players,
bot opponents, ad fill or adoption metrics. No ChatGPT Sites deployment was used.

### Publication record

- AYD: `https://occult-kranti.github.io/andhbhakt-ya-deshbhakt/`, initial release commit
  `848637cdcb0ebf20ebb133f02196bf49c60d8e79`; Pages success and public manifest independently verified.
- JHK: `https://occult-kranti.github.io/fact-duel/`, initial release commit
  `b7c506e53e5bb48b94d1d57971169c6c4e0a22eb`, built at 03:31:34 UTC. The advisor independently
  fetched Home and the matching manifest with HTTP 200; root opened the published Home and human
  duel CTA in the cloud browser.

### Post-publication correction — unsupported missions and stale copy (verified)

After the six rounds and initial AYD publication, root's live browser check found that a Home
mission labelled “Play Energy & Mining duel” generated an `online?topic=...` route unsupported by
the backend's five file choices. The duel desk silently broadened that advertised topic. This is
a real semantic defect discovered after the earlier gates, not a seventh panel round or optional
scope expansion. The certificate/brand lane corrected the mission surface to honestly labelled
local learning activities with their actual solo routes; no new backend topic was invented.
The lane found that server results do not emit the predecessor
local duel/mode/topic/speed quest events. The correction therefore filters all unsupported mission
templates and removes any bonus promise requiring hidden tasks, while preserving actual practice,
Vault and expedition events and their earned XP.

Root's live JHK review found the same predecessor mission mismatch and reopened the same narrow
correction there. The advisor also read a stale description in the successfully published JHK
HTML, claiming a bot and no server despite the correct new manifest. Root/flow were asked to update
that description and the inherited “Private playtest” label to the actual online beta. Both games'
source acceptance was reopened only for these honest mission/copy corrections and their
verification. Their already demonstrated server matches and published URLs remain valid.

The same bounded copy review found a material JHK rule-route mismatch: footer Play rules still
described the predecessor's 150ms/client-time comparison, 1,000-unit room grant, no public queue
and blanket post-reveal refunds. The live authority uses 120ms/server time, a 100-unit guest grant,
public human matching and the disclosed forfeit policy. Root/flow were asked to give the configured
public rule routes the actual live contract and keep predecessor/local-wallet rules scoped to
offline/device practice. This is required disclosure accuracy for the existing wager, not a new
economy or a general rewrite of historical documentation.

Correction verification is complete:

- AYD Home now shows only nine supported practice/Vault template types, labelled Practice
  missions, with the actual visible count and a useful empty-day practice link. Unsupported
  online/topic/mode/win/speed tasks and unreachable all-three bonus promises are absent. The
  six-correct task opens files rather than a five-card daily set. The advisor re-read the actual
  label/route/filter source; the lane passed two focused tests against real quest templates and
  accepted local event paths, plus TypeScript. Root's final production build passed.
- JHK's configured Home uses the equivalent supported learning routes, visible counts and local
  XP wording. Legacy competitive rank/wake prompts are absent from that Home, while practice
  medals/XP/stamps remain. Its live chrome says Online beta and omits the broken research link.
- JHK `RulesScreen` now returns the live rules component before any predecessor rules, coin,
  trust or timing branch. The advisor inspected this exact guard and its actual five-round/
  thirty-second, 120ms, 100-unit starter, 10-unit completion, zero-wager and forfeit contract.
  All three public footer routes reach that guarded contract.
- The advisor read `/tmp/jhk-followup-ui/report.json`: four scoped Home/rules checks passed at
  320px and 1280px, with no errors or overflow. The lane reports 11 focused tests and clean
  TypeScript. No synthetic guest was needed or created by this presentation-only followup.
- Root's final JHK production build and emitted description/canonical/Open Graph/asset checks
  passed. The production description now advertises actual human sports/science duels rather
  than the predecessor's no-server preview. Backend code and authority were unchanged, so the
  earlier real match/economy/cleanup evidence remains applicable.

**Final source verdict: approved; no open defect in this review's beta scope.** Freeze the panel
and publish these verified corrections. The release owner must verify the final correction deployments against their public `release.json`
manifests and report the live URLs. `VERIFICATION.md` retains the initial versions as evidence
for when the followup defects were discovered; each published manifest identifies its own build. Do not add
optional rounds, broad tests or design changes to this completed review.

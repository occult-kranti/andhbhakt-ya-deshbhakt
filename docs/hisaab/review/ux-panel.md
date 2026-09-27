# Match flow and control review — senior technical UX

Date: 27 September 2026. This records three implementation/review loops, each with two discussion rounds. Perspectives are agent reviews, not a study with human participants or a claim of professional endorsement.

## Evidence and decision tools

- Nielsen, *Usability Engineering* (1993), and his published [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): visibility of state, user control and freedom, recognition over recall. These support a visible settings/exit control, immediate answer feedback and plain pending-state words.
- W3C [APG modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): modal naming, focus containment, Escape, safe initial focus for destructive actions, and restoration to the trigger or logical replacement.
- Existing HISAAB charter and Design Partner interaction/accessibility guidance: preserve the quiet question, real clock, truthful bot/network status, 44px touch targets, readable Hindi, and all modes.

Sources were retrieved for the initial review. These principles are design hypotheses for this product, not measured retention or brand-recognition gains.

## Loop 1 — discover and implement

### Round 1: independent diagnosis

Observed in code: bot/friend live and receipt headers expose only an × exit; countdown has no control. Pass & Play uses a separate ×. The native quit confirmation already supports safe focus and cancellation. The existing live status says “waiting for the clock,” even after the player has answered. Network leave waits for the transport request, which can take 15 seconds during a disconnect.

Impact: players cannot discover settings in a match, cannot leave all phases consistently, and can mistake a completed answer for an unresponsive game. A slow leave path contradicts the visible exit.

Proposal: one gear plus Settings label in the match header; native modal using existing sound/theme preferences; explicit ongoing-clock notice; separate Quit game and confirmation; bounded leave notification followed by cleanup. Private own-answer receipt is distinct from a shared competitive verdict.

### Round 2: moderator, engine and psychology challenge

Accepted: bot round settles immediately using its precommitted random choice/time. Human players receive their own answer feedback immediately; the other player retains their answer window, so no winner or next-round action is shown until both finish or the deadline expires. Showing an opponent's answer key before they answer was rejected.

Quit semantics were checked against the engine: cancellation has no win/loss, and completed-round XP stays saved. No invented forfeit penalty. Pass & Play saves no profile score. A 750ms upper bound permits best-effort peer notification; reset invalidates late answers/polls before dispose/navigation.

Implementation: shared native settings dialog; gear+label on loading/countdown/live/private receipt/shared receipt/results and all Pass & Play phases; immediate sound/theme controls; Back to game receives initial focus; Quit requires a second explicit action with Keep playing initially focused; Escape goes from confirmation to settings, then closes settings; background answer shortcuts are suppressed. Own receipt contains real correctness, frozen elapsed time, choice, source/legal context and explanation without provisional XP or final winner. TypeScript passed after this slice.

## Loop 2 — implementation review

### Round 1: inspect the implemented states

The first integrated slice passed TypeScript. Review confirmed that settings retains control across live, own-receipt and shared-result states; native dialog blocks click-through while answer components also disable their single-key shortcuts. The brand designer inspected a 320px Hindi Night edition dialog: no horizontal overflow and initial focus on Back to game.

Challenges: a quit confirmation could describe an unfinished round after it finished in the background; Arena's phase-change effect could cancel the private receipt's delayed live-region announcement; the menu's mono name differed from the new shared wordmark. The passive in-play name also needed a strict small-screen budget.

### Round 2: resolve and implement bounded corrections

Moderator, UX, psychology and brand review agreed to preserve the open dialog when a round ends, discard stale quit confirmation, and announce once that the round has finished and settings can close to read its result. If the confirmation was open, safe focus returns to Back to game; otherwise the player's current settings control retains focus. This avoids both a surprise dismissal and a hidden completed state.

Arena now treats private receipt announcements like shared receipt announcements so its transition cleanup cannot erase them. The menu uses the shared HISAAB DO wordmark and violet full stop. A passive 17px wordmark appears in round headers from countdown onward, including Pass & Play. It adds no motion or action and does not mount after question reveal. Narrow-screen opponent names wrap within a bounded column so the wordmark and Settings control remain distinct. No palette expansion or new gameplay feature was introduced.

## Loop 3 — release review

### Round 1: review production evidence and bound remaining work

The first production QA run reported all 84 static viewport/theme/language cells passing. The measured private receipt appeared in 52ms for the first-answering host and 63ms for the first-answering guest, with no premature XP or key disclosure to the unanswered peer. English and Hindi settings checks passed focus entry, keyboard shielding, continuing clock, theme change, two-stage Escape and quit. A test-runner setup selector typo occurred after those checks and was corrected by QA; it was not counted as a product pass for that whole initial flow.

The panel retained four final acceptance checks on the revised artifact: the passive header name with maximum-length peer names, the updated confirmation during deadline settlement, both peer-quit directions, and a final look at the revised Night edition controls. No new feature or palette expansion was proposed.

### Round 2: final decisions

The moderator accepted the existing match flow and froze UX scope. The remaining gates are specifically the revised 320px compact-brand/long-name header, a round settling while quit confirmation is open, and host/guest quit cleanup. Only a reproduced blocker from those checks can reopen implementation. No extra controls, monetization prompts, forced registration, or replay auto-start were added.

Final integrated verification: the core production gate passed immediate bot feedback across all formats, private host/guest answer receipts, English/Hindi menu controls and quit/reload recovery, all Hindi/desktop long-name cases, guest-quit cleanup, and actual deadline settlement while confirmation was open. The targeted final publication gate then passed both remaining checks (2/2): 320px unbroken-name friend/pass geometry after the pill correction, and host departure observed within the existing 10-second disconnect grace. A separate release gate passed 5/5 covering private receipt announcements, English/Hindi pending-connection cancellation and certificate checks, with zero browser errors.

UX signoff: six discussion rounds completed; implementation frozen. The reviewer inspected actual 320px Hindi Night edition settings, 320px unbroken-name Pass & Play and mobile private-answer receipt screenshots. Browser keyboard/focus/DOM checks were performed; a screen-reader session and cross-device Internet WebRTC match were not verified. The external relay smoke failed in this execution environment, so its result is not represented as proof of production Internet reachability. No engine change was made to the established 10-second host disconnect grace; the person choosing Quit exits promptly.

The targeted long-name check reproduced one 320px overflow in the existing Pass & Play turn pill (24 unbroken `W` characters): body width was 341px while the header itself fit. The bounded correction constrains that pill to its container and permits long names to wrap. The live Settings entry and passive wordmark required no geometry change.

Observed blocker exception during the final discussion: the real WebRTC smoke could not complete its relay handshakes in this environment, and its screenshot exposed a connecting lobby with no cancel action. The moderator authorized a narrow fix: opening/joining now exposes Cancel connection, marks the attempt inactive synchronously, releases its transport in the background and returns to setup immediately. Late transport/session completion cannot reopen the cancelled lobby. No confirmation is required because no match has begun. A targeted pending-join cancellation check uses the local transport to verify this control independently of the external relay failure. Real Internet WebRTC availability remains a separate unverified launch dependency.

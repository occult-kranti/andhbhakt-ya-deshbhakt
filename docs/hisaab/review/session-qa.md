# HISAAB DO session and Night edition QA — 27 September 2026

This review covers the immediate answer feedback, in-game settings/quit controls and Night edition
brand revision. It records automated browser evidence and direct screenshot review, not human
participant research, a server-capacity benchmark or an accessibility certification.

## First production candidate

Artifact: `/tmp/hisaab-loop1-production`, built with `HISAAB_BASE=/`. Chromium ran against a local
HTTP server using `scripts/hisaab-session-check.mjs`, from **00:47:25 to 00:50:51 UTC**.

| Check | Observed result |
|---|---|
| 320, 390 and 1440 px × light/dark × English/Hindi | All **84 page audits** passed: Home, Files, money ledger, Circles, Duel setup, Settings and Rules. No horizontal overflow, checked enabled targets below 44 px, text inputs below 16 px or crash screens. |
| Bot immediate answer feedback | Quick Draw, Triple Threat and Gauntlet displayed the round receipt **39, 31 and 42 ms** after the answer respectively in this local run. |
| First answer wins a click burst | In each bot format, 100 synchronous clicks preserved the first selected answer and produced one displayed selection. |
| Human host answers first | Personal receipt appeared in **52 ms**. Ten guest projections carried no answer key, source, explanation, opponent receipt or personal feedback. |
| Human guest answers first | Personal receipt appeared in **63 ms**. Eleven guest projections retained shared-round redaction; the guest's own personal result belonged only to its submitted pick. |
| Human round completion | In both answer orders, the unanswered player retained all four enabled options; its keyboard answer settled both screens. No XP or journal round was filed while the peer was still answering. |
| English/Hindi settings on 320 px | Initial safe focus, answer-key shielding, continuing stopwatch, theme changes, two-stage Escape and quit actions passed. Both checks then stopped at an incorrect test selector for the returned setup page. |

The first report has **15 passed checks and two harness failures**, 95 screenshots and **zero
application exceptions, console errors, local HTTP errors or ad requests**. The harness selector
`[data-screen="duel"]` was corrected to the actual `[data-screen="duel-setup"]`; these checks must
be completed before being reported as passed. The final core pass below did complete both.

Direct visual inspection covered narrow light/dark Home, desktop dark Home, a personal answer
receipt and the Hindi settings dialog. The Night edition has warm light text, lavender actions and
separate near-black/paper-panel values; the old light palette remains recognizable. The receipt
explicitly distinguishes personal answer feedback from the still-pending shared round score.

## Real WebRTC attempt

`scripts/hisaab-webrtc-smoke.mjs` attempted one real Trystero connection in **two independent browser
contexts**, without a mocked transport or a fallback, at **00:50:52–00:51:06 UTC**. It used the built
site's ordinary friend flow. The host generated a genuine room code; the guest did not connect.

The browser logged **34 WebSocket `net::ERR_EMPTY_RESPONSE` errors** across all five selected public
Nostr relay endpoints (`nostr.tegila.com.br`, `social.amanah.eblessing.co`, `relay02.lnfi.network`,
`yabu.me` and `basspistol.org`). The guest's join step hit its 12-second limit before the overall
30-second budget. This is failed network evidence, not a successful multiplayer test. It establishes
that relay handshakes could not be completed from this execution environment; it does not isolate
whether the restriction belongs to the environment, relay availability or another network layer.

The deterministic friend checks above use real browser **BroadcastChannel** communication. They
verify protocol projections, answer ordering and local UI behavior; they do not prove cross-Internet
WebRTC connectivity, NAT traversal or availability under office/mobile network restrictions.

## Final core candidate and focused corrections

The root-path production artifact `/tmp/hisaab-online-final` was checked from **00:55:53 to
00:57:57 UTC**, after the panel's settings/announcement/header changes. The scoped pass produced
30 screenshots and zero application errors. It completed the previously interrupted English and
Hindi settings checks: sound/theme controls applied, keyboard shortcuts did not answer behind the
modal, the stopwatch continued, Escape restored the trigger, quitting returned to setup without a
late match revival, and reloading a live bot match showed the honest empty-room recovery screen.

The three bot formats again showed receipts immediately (**33, 31 and 34 ms**). Both human answer
orders passed private result, redaction, zero provisional XP and keyboard second-answer settlement
checks (**64 and 71 ms** personal feedback). The real 30-second deadline expired under an open quit
confirmation: the modal stayed open, refreshed to the finished-round state, discarded its obsolete
confirmation and retained focus. Escape then focused the replacement Settings trigger.

Long-name checks passed at 320 px in Hindi and 1440 px in both languages. The 320 px English
Pass & Play check identified a real defect: an unbroken 24-character player name widened the turn
pill and document to **341 px**. The pill was bounded to its container and given word wrapping.
This was separate from the new compact brand/header geometry, which fit. A focused post-fix check
is recorded with the final addendum below.

The first host-quit assertion used a five-second limit, shorter than the product's documented
10-second guest reconnect interval. It was corrected to a 12-second test ceiling; guest-quit
settlement already passed. The departing player does not wait for that reconnect interval. No
protocol behavior was changed merely to satisfy the test.

Reviewed screenshots are retained in `screenshots/qa-night-desktop-home.png`,
`screenshots/qa-night-mobile-home.png`, `screenshots/qa-personal-answer-receipt.png` and
`screenshots/qa-hindi-game-settings.png`.

## Final verification addendum

**The defined browser release gates pass.** The failed real WebRTC attempt remains a separate
launch limitation; it has not been converted into a pass.

| Frozen artifact / UTC completion | Focused checks | Result |
|---|---|---|
| `/tmp/hisaab-online-release` / 00:59:24 | Own-result screen-reader announcement; host quit and guest reconnect interval; current-origin certificate PNG; English and Hindi pending-connection cancellation | **5/5 passed**, six screenshots, zero application errors. |
| `/tmp/hisaab-online-publish` / 01:00:46 | Fixed 320 px English long-name friend/pass geometry; host quit with the documented reconnect interval | **2/2 passed**, five screenshots, zero application errors. |

The standing live region contained **“Your answer: incorrect. Anonymous Janta is still answering.”**
after the delayed announcement, proving the previous effect-order bug was resolved. In the
connection-cancel checks, the new visible control returned to setup in **62 ms (English)** and
**54 ms (Hindi)**; the page stayed there beyond the real eight-second guest handshake timeout.
No abandoned session reappeared. The certificate download produced a **134,386-byte PNG**, with
the test site's current host (`127.0.0.1:4174`) in its displayed footer.

The repaired long-name Pass & Play screen measured **320 px document width at a 320 px viewport**,
and its header regions did not overlap. Its final screenshot was visually inspected. Host departure
left the other player through the existing 10-second reconnect grace and reached a cancelled result
within the 12-second check ceiling; guest departure settled normally at the host. Neither departed
screen was revived by late responses.

The publication artifact changes only the observed turn-pill CSS after the release artifact. The
preceding release artifact adds only pending-connection cancellation/late-response guards after the
core artifact. Thus the earlier matrix and core-flow evidence applies to unchanged code; a full
matrix was not needlessly repeated. Raw reports retain their initial harness failures and the actual
overflow finding. Their passing follow-ups are recorded separately in `session-qa-results.json`.

Across those frozen artifacts, **27 distinct named checks have passing evidence**: 12 theme/locale/
viewport matrix cells, the three-format bot check, two human answer orders, two settings languages,
four long-name header cells, two peer-quit directions, the deadline/modal race, certificate export and
two connection-cancel languages. This count is not a statement that the first raw run had no failures.

## Reproduce

```sh
HISAAB_BASE=/ HISAAB_OUT=/tmp/hisaab-release pnpm build:hisaab
python -m http.server 4174 --bind 127.0.0.1 --directory /tmp/hisaab-release
CHROME_PATH=/path/to/chromium node scripts/hisaab-session-check.mjs /tmp/hisaab-session-check http://127.0.0.1:4174/
CHROME_PATH=/path/to/chromium node scripts/hisaab-webrtc-smoke.mjs /tmp/hisaab-webrtc-smoke http://127.0.0.1:4174/
```

`ONLY_CHECK` accepts a regular expression to rerun only a concrete changed behavior. The session
runner checkpoints a machine-readable report after every check and exits nonzero on any failed
assertion or application error. The WebRTC attempt has its own report and failure status so network
unavailability cannot be mistaken for a passed deterministic UI gate.

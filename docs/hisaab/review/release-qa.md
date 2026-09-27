# HISAAB DO release QA — 27 September 2026

**Verdict: the focused release checks passed.** The production artifact built at
`/tmp/hisaab-release-preview` was served through Vite preview and checked in Chromium with
Playwright. The final run completed at **2026-09-27 00:12:06 UTC**: **11 checks passed, none failed,
zero browser exceptions, console errors, local HTTP errors, or advertising requests**.

The reusable runner is `scripts/hisaab-release-check.mjs`. This review records that runner's
executed checks; the broader engine suite and all-mode screen walker are separate release gates.

## Executed coverage

| Area | Executed check | Result |
|---|---|---|
| XP bands | Every integer elapsed value from 0 to 30,000 ms, for correct and wrong answers; NaN, infinities, negative, missing and nonnumeric times | Correct: 30 XP below 8,000 ms, 20 below 15,000 ms, 10 from 15,000 ms. Wrong: 0. Invalid time earns no speed bonus. |
| Stopwatch | Monotonic clock rollback, repeated start/lock, 10,000 post-lock samples | Time never rewound and first lock stayed fixed. |
| Circle API | 100 concurrent joins of one invite, 505 malformed invites, 30 creation attempts, reload, nickname update | One joined circle; malformed inputs left records unchanged; 20-circle cap held; nicknames stayed scoped to their circle. |
| Responsive UI | 320, 390 and 1440 px, each in light and dark; front page, circle hub, populated circle detail, duel setup, question | 30 screen audits passed: no horizontal overflow, checked button/nav targets at least 44 px, text-entry controls at least 16 px. |
| Circle browser flow | Family circle creation with 100 synchronous form submissions, friends circle creation, independent-browser join, invalid invite and markup nickname, reload and leave | One creation after the burst; independent member identities; inline validation; personal nickname persisted; global profile name unchanged; leaving removed only the local membership. |
| First answer locks | 100 synchronous option clicks before a React rerender | First correct choice persisted as exactly one journal round with elapsed time. Later clicks did not replace it. |
| Timer and keyboard | Stopwatch tick, answer lock, keyboard Enter on another question | Timer advanced, stopped after the answer and Enter submitted an answer. |
| Reload | Reload answered taster after the click burst | XP and journal count stayed unchanged. |
| Retired controls | Question cards, daily, route, pass-and-play and live duel | No “shayad”, “lagta hai” or “pakka” confidence controls. |
| Quiet play and advertising | Daily, route, pass handover, pass question and live bot duel | No ad slots; no ad network requests anywhere in this run. Live duel had no nav, toast, ceremony, 3D scene or painted particle pixels. |

34 screenshots were captured. Visual inspection included the phone front page, dark desktop front
page, Hindi circle detail, long desktop circle title, invalid invite state and phone question.

A subsequent **six-screen check** of `/tmp/hisaab-release-fixed` completed at **00:14:11 UTC** after
the broader walker identified small start-page text and footer links. At **320 and 390 px**, the three
introductory lines measured **14 px**; About and Privacy each measured **44 × 44 px** and Contact &
corrections measured **106 × 44 px** on both Home and Rules. All six screens had zero horizontal
overflow. Six additional screenshots recorded this focused follow-up.

## Finding fixed during this review

A custom Hindi circle title initially rendered missing-glyph boxes under the new serif heading
style. The title-language detection and font fallback were corrected. The production screenshot at
320 px renders **“परिवार की चाय”** correctly and without overflow. The long English circle name also
fits the desktop layout.

Two initial runner findings were test-harness issues, corrected before the final run: an exact label
lookup included a readonly textarea's value, and a blanket canvas selector counted the shared,
empty 2D particle host. The quiet check now requires the particle canvas to contain no painted
pixels and requires 3D scene canvases to be absent.

## Scope of the evidence

- These are bounded browser and local API stress checks, not server-capacity measurements.
- Joining was verified in separate browser contexts using a genuine generated invite. Cross-Internet
  peer connectivity, relay availability, and restrictive NAT/firewall behavior were not exercised.
- Ads were disabled in this artifact. Active publisher delivery, consent-platform integration and
  AdSense approval require their real deployment configuration and are not proven by this run.
- The shared profile dispatcher deliberately falls back to in-memory activity on IndexedDB failure.
  Its exceptional rejecting-save retry path was inspected, not forced through an artificial browser
  transaction failure; ordinary storage failure resolves through the existing fallback contract.
- The responsive audit checks defined controls and dimensions; it is not a complete accessibility
  conformance certification or an assertion about every browser.

## Reproduce

Build and serve the edition, then run the check against that server:

```sh
pnpm build:hisaab
pnpm preview:hisaab --host 127.0.0.1 --port 4174
CHROME_PATH=/path/to/chromium node scripts/hisaab-release-check.mjs /tmp/hisaab-release-qa http://127.0.0.1:4174/fact-duel/hisaab/
```

`CHROME_PATH` is optional when Playwright's Chromium is installed. `ONLY_CHECK` accepts a regular
expression to rerun a particular check after a focused fix. The runner writes screenshots and a
machine-readable `report.json` to the requested output directory and exits nonzero on a failure.

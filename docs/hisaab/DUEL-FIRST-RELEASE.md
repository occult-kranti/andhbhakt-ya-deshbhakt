# HISAAB DO — duel-first review branch

Date: 27 September 2026. Branch: `feat/hisaab-human-duels-certificates`, based on `b74c28711d50801e164b6573b13228a33ba7faaa` (the latest HISAAB development branch). The requested delivery is source pushed to GitHub for review. This release does not merge main/master, publish a frontend, modify the live Supabase database, or create a ChatGPT-hosted site.

## Implemented experience

- Home opens directly with **Find a duel** and a prominent dated **Today’s file**. A saved arrival preference selects home or the daily duel desk. The player chooses when to enter; no automatic stake or timed queue. The existing identity remains a browser guest, not a new login system.
- Competitive entry points pair humans. Old bot links and the old room route lead to the online desk. Direct human friend and shared-phone play remain available. Learning files are clearly labelled solo practice.
- Nine permanent XP bands retain their thresholds and now end in **Deshbhakt**. The hidden temporary **Certified Anti-National** title is live server eligibility for existing qualifying top-ten competitions and the qualified savings leader. It is not shown in the unearned ladder. Permanent personal display progress combines cumulative practice and online XP without writing server points to local competitive standings or paying a snapshot twice.
- Optional **UPI tax savings** stakes default to zero and accept a whole number within the balance, up to 10,000. These are free simulated game coins, not tax savings, UPI transactions, money or cash prizes. Both seats confirm the disclosed stake; reservations and settlement are server-owned. Zero balance still plays at zero stake.
- Featured **Subsidies**, **Before the vote**, and **Who owns media?** files advertise **×10 = 100 earned coins**, compared with the 10-coin base reward. The existing subsidies/public-distribution file implements the requested money-benefits section; this is not a newly researched corporate-subsidiaries dataset. Both humans must answer at least three questions, the recipient must get at least one right, and the match must finish. The reward is once per guest/file/UTC day. It never multiplies the wager pot.
- Draws, pre-start cancellations and system expiry refund reservations. After both are ready, deliberate quitting or a one-sided absence over 90 seconds while the opponent remains active forfeits the pot to the remaining seat. Both absent refunds. A forfeit earns no completion reward or competition credit. The screen states these rules before stake confirmation.
- Correct feedback says **Waah Waah**. Short win and loss acknowledgements respect reduced motion and stay out of the live answer window.
- Optional photos are resized and retained locally, removable, and only included in user-initiated shares/downloads. Nine level designs use one consistent six-expression caricature sheet, distinct captions/medals and a 30→90% player / 70→10% cartoon art split. The high-rank character is comically crying. Images identify themselves as satire and retain current honour provenance/expiry when applicable.
- Bank inventory totals are removed from player-facing discovery. Counts describing a selected session and factual money-ledger records remain. The practice bank is still part of the public frontend; presentation hiding is not content secrecy.
- Ad eligibility records one event per completed practice run, or after two cumulative wins/three cumulative losses. Opportunities follow the result/receipt, never a live round. A real H5 provider adapter handles no fill, errors, timeouts, consent and SDK cleanup. It requires a user gesture and approved configuration; no fake ad/video is substituted.

## Panel and evidence

`review/DUEL-FIRST-PANEL.md` records three actual loops, two rounds each: product contract and critique; implementation review and correction; integration evidence and release decision. The advisor, server, screen, certificate, and feedback/ad lanes worked in parallel. Corrected defects include quit-to-avoid-loss, public bot entry points, title/portrait progression disconnected from online XP, stale identity responses and provider-incompatible advertising assumptions.

Executed checks:

| Check | Result | Boundary |
| --- | --- | --- |
| `node --test tests/*.test.mjs` | 938 passed; zero failed/skipped | Repository automated suite, including preserved original game |
| `pnpm exec tsc --noEmit` | Passed | Whole repository type check |
| `pnpm build:hisaab` | Passed | Static GitHub Pages-compatible build; existing large optional chunks warn |
| `node scripts/hisaab-verify-artifact.mjs dist-hisaab --base=/fact-duel/hisaab/` | Passed | Built artifact paths/entry checks |
| PostgreSQL runner | 95 checks passed | Real PostgreSQL functions/constraints in isolated single-connection PGlite; not multi-connection load |
| `node scripts/hisaab-duel-first-check.mjs` | 14 passed; zero browser errors | 320/390/1440px, Day/Night/Classic, fixture-backed online flow, locked-answer reload, zero stake, photo/PNG/removal, high online XP |
| `node scripts/hisaab-certificate-check.mjs <output>` | Passed by certificate lane | Real local browser photo normalization/export/removal, live-grant fixture refresh/revocation, online-XP identity reset |
| `git diff --check` | Passed | Whitespace validation |

The reviewed visual evidence covers the human duel home, zero-balance desk, completed answer/result, mobile certificate and exported high-rank certificate. This does not claim physical-phone, screen-reader, WAN-fairness or production ad-delivery validation.

## Before making this branch live

1. Stage the canonical schema and refreshed seed, run both rollback SQL suites, and deploy the matching Edge function. See `supabase/hisaab/README.md` for API and privileged scheduler setup. Multi-connection concurrency and one-minute unattended expiry remain staging gates. The current database is unchanged.
2. Build the frontend with the real endpoint and the `/fact-duel/hisaab/` base. Publish through the HISAAB GitHub Pages workflow only after the matching backend is ready. This branch is not in the automatic Pages push triggers. Main/master and the current `gh-pages` publication are unchanged by this delivery.
3. For ads, supply an approved Google H5 publisher/site configuration and working privacy adapter. `GAME-BREAKS.md` contains the required flags and lifecycle. Default flags stay false. Provider availability and format mean a video cannot be guaranteed on each opportunity.
4. Continue measuring guest abuse, competing requests, latency and match completion before promotion. Guest IDs are resettable; private matches can earn capped completion rewards but no points-board credit. The evidence does not establish anti-collusion or retention gains.

Existing GitHub Pages and Supabase are sufficient for the implementation. No new VPS, Redis, payment gateway or ChatGPT hosting is required. A configured Supabase scheduler and approved advertising/consent services are the outstanding integrations; no services were purchased.

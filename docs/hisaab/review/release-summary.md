# HISAAB DO — stopwatch, circles and Daily Edition release

Source branch: `claude/loving-pasteur-s8xwtf`. Base: `6e9f0c21a1546c394c103e4b39c49609b8336083`.
The owner's instruction is to publish this branch without merging `main`.

## Delivered

- Removed the three confidence choices. Real progression uses 30/20/10 correct-answer XP at the
  exact 8s/15s boundaries; wrong answers receive zero base answer XP. Existing bonuses remain
  separate, including Surprise Audit. Monotonic stopwatches freeze on the first input.
- Preserved all game modes, sourced receipts, money ledger/downloads, Vault, profile progression,
  quests, bilingual settings, theme, effects and sharing. All duel formats now allow 30 seconds.
  Daily/files/taster have no deadline; Pass & Play times do not affect its accuracy verdict or profile.
- Friends/family circles with invite links, nickname per circle, persistent local membership,
  live peer presence and casual device XP, and a friend-duel entry using the circle nickname.
- Cream/ink newspaper design with original masthead, editorial hierarchy, mobile navigation,
  retained violet/file/receipt identity, and Hindi glyph handling.
- Default-off, home-only manual advertising module, publication pages, configuration and domain
  handoff. No live advertising credentials, tracking calls, or invented Google approval.

## Evidence

| Check | Executed result |
| --- | --- |
| `pnpm exec tsc --noEmit` | Passed |
| `node --test tests/*.test.mjs` | 872 passed, 0 failed (both game engines) |
| `node scripts/hisaab-validate.mjs` | Bank schema/structural validation passed; this is not a new source fact-check |
| `pnpm build:hisaab` / `pnpm build:static` | Both passed |
| Standalone `HISAAB_BASE=/` build | Passed; root asset paths, publication pages and manifest present; no live ad script |
| Production focused release checker | 11/11 passed; zero browser errors; 34 primary + 6 focused screenshots |
| Design matrix | 32 entry/home views at 320/390/1100/1440, English/Hindi, light/dark; no overflow or undersized navigation targets |
| Contrast measurements | 47 readable token pairs per theme, all at least 4.5:1 |
| Secret scan | Attached credential absent from all changed/untracked release files |

The focused checker includes 30,001 elapsed values; exact boundary/malformed times; locked-clock
behavior; duplicate submissions; journal eviction/replay; malformed invites; bounded circle
storage; separate browser-context join; group nickname isolation; reload persistence; and absence
of ad requests in game views. Transport unit tests exercise peer handshake, changes, expiry,
isolation and departures. These are invariant and browser checks, not a hosted concurrency claim.

The original screen walker additionally runs the existing mode/result/rematch/settings/export
flows. Its current run and the small accessibility corrections are recorded with final results
below. Intro text and footer target corrections were verified on six screens at 320/390px. See `release-qa.md` for exact focused coverage and limitations.

## Practical limits and next input

The current app is static and browser-local. Circles have no cloud accounts, centrally verified
membership, asynchronous messages, admin removals or revocable invitations. Live WebRTC needs
reachable public signaling and compatible peer networks. Cross-carrier/two-phone connectivity
was not verified in this environment. Server-authoritative competition is not claimed.

To connect the HISAAB-only domain, supply the domain and authorize access to its DNS/hosting.
Use a separate static deployment; changing this repository's Pages CNAME would affect both games.
The game can launch with ads off. Ad activation separately requires the owner's publisher/unit
IDs, site approval, audience decisions, and a reviewed CMP adapter. See `../LAUNCH-AND-ADS.md`.

The source branch's existing workflow replaces only `gh-pages/hisaab/`. The final publication
check must compare the other root tree entries and confirm that the `main` ref is unchanged.

## Final original-walker result

Production walkthrough at 390px completed **37 screens and all 11 end-to-end flows**: first receipt,
Quick Draw + rematch, Triple Threat, Gauntlet, Pass & Play + replay, two-page peer duel,
every home link, theme/language/quiet settings, certificate PNG export, correction link, and 3D lab.
There were **zero console errors and zero failed requests**. Its seven measured style findings
were three 12px introductory lines and four narrow About/Privacy link instances; these were fixed
to 14px and at least 44×44px, then verified on six targeted screens at 320/390px against the rebuilt
artifact. All game-flow checks passed. The raw original run predates those two CSS corrections,
so its report is not described as zero-findings; the focused follow-up supplies the fix evidence.

Both builds retain existing large lazy 3D/engine chunk warnings. There were no build errors.
The current tests do not establish real-device performance on slow networks or cross-browser
conformance; the existing lazy-loading/quiet-surface controls remain in place.

# Required-profile release verification — 27 September 2026

This release adds required private-email profiles to both games, secure independent recovery codes, account controls, bounded progression feedback in JHK, and both games’ two-win/three-loss ad opportunities. Email is unverified contact data, never ownership proof. Ad delivery remains disabled.

## Source and integration checks

- AYD: 946 Node tests passed, zero failures/skips, with the pinned PGlite dependency running real SQL integration tests.
- JHK: 958 Node tests passed, zero failures/skips, with the same database harness.
- Both TypeScript checks passed. AYD production build, content validation and base-path artifact inspection passed. JHK actual static Pages build and assembled artifact passed.
- JHK’s static build replaces all nine public ad environment settings; emitted code has disabled defaults and no unresolved ad `process.env` references.
- Profile tests cover required fields, private email, same-email isolation, wrong/cross-game recovery, token rotation, legacy profile upgrades preserving balances/XP, pseudonymous deletion and recovery revocation. Migration reapplication passed locally.
- Existing optional wagers and zero-balance/zero-stake behavior remain server-owned. Result/cadence tests cover counters, repeated IDs and non-owned results. JHK progression feedback is capped at three per round and two visible; operational errors are not suppressed.

## Backend deployment

The live Supabase project is `wvupsqfevlrmhqfjreyx`. No active rooms existed immediately before migration. Both canonical schemas applied successfully. `hisaab-game` version 3 and `jhk-game` version 2 are active, using custom bearer authentication. Every private command still validates that credential; no service-role key is sent to the browser.

Both expiry cron jobs remain active every minute and their latest inspected runs succeeded. Security advisors continue to show intentional deny-by-default private-table RLS notices and pre-existing unrelated shared-project warnings for `public.set_updated_at`, `public.rls_auto_enable` execution grants and Supabase Auth leaked-password protection. This is not a whole-project security certification.

## Publication checks

Both candidate releases completed GitHub Actions build and deployment successfully. The public HTTPS `release.json` matched these source revisions with `adsEnabled: false`:

| Game | Verified implementation revision | Successful release run |
| --- | --- | --- |
| AYD | `274c53771ad574f8efa9582fc7eab85daae83dc2` | [36296603774](https://github.com/occult-kranti/andhbhakt-ya-deshbhakt/actions/runs/36296603774) |
| JHK | `4beca042389daf42d71cc3586c800091cf071028` | [36296602511](https://github.com/occult-kranti/fact-duel/actions/runs/36296602511) |

A subsequent documentation-only commit records these results; the published manifest identifies the current artifact independently.

- Cross-game live profile suite: **5/5 passed**. Both private five-round matches finished, all four QA profiles were deactivated and all four recovery codes revoked. Required fields, duplicate-email isolation, cross-game refusal, bearer/code rotation, private export and public-field projections passed.
- AYD live economy suite: **6/6 passed**, including a zero-balance player completing a zero-stake five-round match; positive stakes, ×10 media completion reward separate from the pot, duplicate-ready, cancellation refund and post-ready forfeit. Both QA profiles were deactivated.
- JHK live suite: **17 checks passed**, including a five-round positive-stake match, concurrent answer retries/XP exactly once, one pot/reward settlement, zero-stake entry, cancellation refund and post-start forfeit. Cleanup of its three QA profiles completed without errors.
- Both public profile screens rendered in the cloud browser at the available desktop viewport. JHK rejected empty email, focused the email field, expanded personalization, wrapped keyboard focus within the gate and exposed the recovery screen. AYD rejected an incomplete form, gated the direct duel route and gated practice from the public homepage. Public browsing of the homepage remains available; it does not start a game.
- Both games’ public privacy, terms and contact pages returned HTTP 200 with the new dated policy content.
- Browser checks did not create an account or accept terms. Complete account/recovery/game behavior is backed by live HTTP and source integration evidence, not represented as a full browser account journey. Mobile device, two-real-phone and broader network matrices remain owner pilot work.

The local browser could not reach the preview (`ERR_BLOCKED_BY_CLIENT`), and no local Chromium executable is installed. The updated browser smoke script has been syntax-checked but not represented as executed.

## Limits and owner actions

The tests establish these scenarios, not traffic capacity, universal timing equality, measured retention improvements or legal clearance. Email verification/OAuth, approved ad inventory and consent, private support/grievance contact, legal operator identity, a retention schedule, host commercial-use approval and broader load/abuse testing remain owner launch items. See [the launch checklist](LAUNCH-CHECKLIST.md). No domain was bought, paid plan changed, ad enabled or real player email used for testing.

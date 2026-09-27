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

Live profile/economy checks and public browser review are in progress during candidate publication. Their results will be appended after deployment; a successful build is not treated as live browser evidence. Each public `release.json` identifies its deployed commit.

The local browser could not reach the preview (`ERR_BLOCKED_BY_CLIENT`), and no local Chromium executable is installed. The updated browser smoke script has been syntax-checked but not represented as executed.

## Limits and owner actions

The tests establish these scenarios, not traffic capacity, universal timing equality, measured retention improvements or legal clearance. Email verification/OAuth, approved ad inventory and consent, private support/grievance contact, legal operator identity, a retention schedule, host commercial-use approval and broader load/abuse testing remain owner launch items. See [the launch checklist](LAUNCH-CHECKLIST.md). No domain was bought, paid plan changed, ad enabled or real player email used for testing.

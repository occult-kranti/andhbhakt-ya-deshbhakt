# Beta operations — September 2026

## Deployed architecture

| Game | GitHub Pages | Edge Function | Private schema | Expiry job |
| --- | --- | --- | --- | --- |
| Andhbhakt ya Deshbhakt | https://occult-kranti.github.io/andhbhakt-ya-deshbhakt/ | `hisaab-game` | `hisaab_private` | `ayd-expire-rooms` |
| Jaanta Hai Kya | https://occult-kranti.github.io/fact-duel/ | `jhk-game` | `jhk_private` | `jhk-expire-rooms` |

The existing Supabase project is `wvupsqfevlrmhqfjreyx`, region `ap-south-1`. Each game has its own bearer-session header, browser storage keys, Postgres identities, wallets, bank and rankings. Edge service-role access stays server-side. Private schemas are not exposed through the Data API; browser roles cannot execute game RPCs.

GitHub Actions builds from `main`, uploads a Pages artifact and deploys it. Pages must have build type **GitHub Actions**. Successful source/branch pushes alone do not prove publication. Fetch `release.json` from each live site and compare its commit to GitHub main.

## Updating a game

1. Verify the reviewed canonical schema/seed and browser contract together. Check active rooms before an upgrade that could change match rules.
2. Apply the schema and seed as one migration, run the transaction-rollback SQL suites, then deploy the matching Edge entrypoint and core with custom guest authentication.
3. Confirm the expiry job is active and inspect an actual successful run. Both jobs run once per minute under the database operator role and call only their private expiry function.
4. Exercise two distinct private guest clients: confirm stake, answer, settle once, retry, refund and forfeit. Delete the QA guests afterward.
5. Publish the matching browser build, compare `release.json`, and check the public page, shared image and assets over HTTPS.

The current SQL migration history is managed by Supabase. Canonical SQL source is in the game’s `supabase/` folder. Do not put a service-role key or GitHub token in source, frontend environment variables or an artifact.

## Database monitoring

Read `cron.job` and `cron.job_run_details` for the two named jobs. Monitor Edge error rate, duration and invocation usage, database connections, command errors, unfinished rooms, negative-balance violations and reward/escrow reconciliation. A 30-day guest expiry is credential expiry, not automatic historical data deletion.

Read-only Supabase security advisors found intentional RLS-with-no-policy information for private server-only game tables. Existing shared-project warnings concern `public.set_updated_at`, `public.rls_auto_enable()` and Auth leaked-password protection. These predate the game schemas and are outside the guest-auth path; this release does not silently alter unrelated apps’ functions or authentication settings. Remediation reference: https://supabase.com/docs/guides/database/database-linter . No claim of whole-project security certification is made.

## Domain readiness

The GitHub Pages addresses work without a purchase. After buying a domain:

- Configure each repository’s custom domain in Pages, verify domain ownership in GitHub, add the required DNS records, and enable HTTPS when the certificate is issued. Use distinct subdomains if desired, such as `play.example.com` and `quiz.example.com`.
- Change `HISAAB_BASE` or `STATIC_BASE` to `/`; update canonical/OG/share URLs and manifests for that game. Add the chosen domain in Pages only when the domain and DNS are available; no invented domain is committed now.
- The existing Supabase HTTPS endpoints remain valid. Custom guest headers and OPTIONS are allowed by the Edge CORS policy. Photos stay local and are not sent to Supabase Storage.
- Verify invite deep links, a shared certificate, the social-card URL and mobile reloads on the purchased host before announcing it.

Official domain setup: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site .

## What is live versus a launch prerequisite

Human duel servers, optional free stakes, zero-stake entry, source receipts, server XP/coins and bounded standings are part of this beta. Existing personal learning progression remains device-local and is identified separately. There are no bots presented as live opponents, deposits, purchases, cash prizes or redemption.

**Advertising is not active.** AYD records the requested practice/two-win/three-loss opportunities and has a real Google H5 adapter. A domain purchase alone does not activate ads: approved publisher/site identifiers, provider access and a tested consent adapter are required. No-fill/error must keep the game usable. Video fill cannot be guaranteed. JHK currently has no live ad integration.

**Identity is guest-based.** Browser storage deletion loses access; there is no verified account recovery or cross-device profile. This is suitable for testing a casual beta but is not a finished account product.

**Scale remains measured work.** Passing two-client/concurrent retry checks does not establish a public traffic capacity or fairness across networks. Start with a bounded invite group, measure actual latency/abandonment/error rates and support reports, then increase participation. Stronger identities, abuse/collusion controls and wider load testing are needed before valuable prizes or a broad ranked launch.

## Evidence

The panel record and release verification report distinguish source checks, local browser fixtures, deployed SQL rollback checks, live HTTP matches and public Pages verification. No retention, revenue, player-population or conversion lift is invented.

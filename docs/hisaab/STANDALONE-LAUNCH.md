# HISAAB DO: standalone launch and services

Reviewed 27 September 2026. This edition has its own static deployment; the source remains on `claude/loving-pasteur-s8xwtf`. Do not merge it into `main`, replace the original FACT//DUEL hosting project, or change the original repository's root Pages domain. Jaanta Kya Hai is a separate game.

## What can launch now

The current game is a browser application. Daily questions, state and sector files, money trails and ledger downloads, solo practice, Babu bot duels, pass-and-play, receipts, progression, certificates, settings, friend duels and circles ship in the same build. Moving that build to independent HTTPS hosting makes it an ordinary playable website; visitors do not need GitHub accounts.

The standalone game is published at **https://hisaab-do.whatswrong-inc.chatgpt.site**. The hosting
service reported a successful public deployment on **27 September 2026, 01:03:51 UTC**. Browser
checks were performed against the corresponding production artifacts; the existing Pages release
stays online in parallel. Real Internet WebRTC connectivity remains unverified as described below.

Publication identity: `appgprj_6ab86670b86c8191b6f997fe9ef5aa90`, version 1,
deployment `appgdep_6ab86b6cb9388191901bb56e6e5ad367`.
Application source: `fc0cf4b0044b9927311f394fa00a2cfbd62438e9`.
Publication source: `e1d229dbefd27a7008121dc2e9c73b39d7437be1`.

| Service | Needed for this release? | Current implementation / owner input |
| --- | --- | --- |
| Independent static hosting with HTTPS | Yes | A separate HISAAB Sites project serves the built game, fonts and downloads. Keep the original game's project intact. |
| Domain registration and DNS | Only for an owned brand domain | The hosted address is playable without buying a domain. For a custom address, supply the domain and access to its DNS; apply the host's exact verification/routing records. |
| Player database / Supabase | No for the current browser edition | Progress and circle membership are device-local. Supabase becomes necessary for the proposed cloud features below, not merely to change the website address. |
| Live friend connections | Included; real-network validation pending | Trystero uses public signaling and STUN services, then WebRTC between players. The release environment could not reach the external Nostr relays. No application-owned signaling or TURN fallback is configured. Test on two real networks before promising broad connectivity. |
| Private support email | Recommended before public promotion | Supply a real support/privacy address. Current public correction reports go to the GitHub tracker; do not describe it as a private mailbox. |
| Error and uptime monitoring | Recommended operational service | Select the host's logs and an uptime check; add a client error provider only with a reviewed data/redaction policy. None is silently added to this release. |
| AdSense + consent platform | Only to monetize | Ads remain off. Real publisher/unit IDs, approved site, disabled Auto ads, a reviewed CMP adapter and audience policy are required; see `LAUNCH-AND-ADS.md`. |

No subscription, hosting upgrade, domain purchase, backend restore or new paid service was initiated by this work. Hosting/account charges are determined by the actual provider plan; a domain, TURN traffic, SMTP and cloud database usage have separate cost drivers. There is no defensible monthly total without the selected accounts, expected concurrent players, session duration and region. Check the providers' current dashboards before authorizing paid capacity; do not treat a free-tier limit as a production guarantee.

## The Supabase connection

The connected account was inspected during this release. Its only visible project was reported **INACTIVE**. A connected plugin is not a live database integration. The game does not currently call that project, and no schema, Auth setting, billing plan or project lifecycle state was changed. The project may belong to another application, so its data and ownership must be identified before reuse.

Supabase is a reasonable choice for durable profiles and authenticated circles, once an active project is selected. It does not supply the missing application behavior just by adding a URL/key to the client.

| Desired capability | Services and code required before advertising it |
| --- | --- |
| Sign in and recover progress on another device | Supabase Auth; verified redirect URLs; profile tables with row-level authorization; explicit local-to-account import rules; logout/delete/export behavior; retry and conflict handling. |
| Email sign-in/password recovery | A configured transactional SMTP provider or Send Email hook; verified sending domain and authentication records; abuse limits/CAPTCHA as appropriate. Supabase's built-in email service is for restricted development use. OAuth can avoid email for normal sign-in but requires its own provider configuration and recovery design. |
| Durable family/friend roster, roles and revocable invites | Postgres circles/memberships/invites tables, transactional join/leave/admin operations, expiring hashed invite secrets, authorization tests and Realtime private-channel policies. Invite possession alone is not an administrator permission. |
| Live roster/presence | Supabase Realtime private channels after authentication and membership authorization. Presence is transient; the database remains the membership record. Realtime is messaging, not a match referee. |
| Casual WebRTC across restrictive networks | A managed or self-hosted TURN service and short-lived server-issued credentials; fallback UI and real-network checks. Do not bundle a permanent TURN secret into the app. Supabase does not replace TURN merely by being present. |
| Dependable signaling when public relays are unavailable | An application-owned signaling service or an authenticated Supabase Realtime transport, with room authorization, expiry and connection recovery. TURN handles media/data relay through NAT; it does not fix an unavailable signaling service by itself. |
| Authoritative competitive scoring / ranked matchmaking | A trusted match service with durable room state, server timestamps, first-answer locking, atomic settlement, replay/idempotency protection, reconnection and abuse control. Supabase can store accounts/results; a Worker/Durable Object or suitable server can run the referee. The current peer-hosted engine and self-reported XP must not be labeled cheat-proof. |

These are future integrations, not hidden switches implemented in this release. Solo and bot play remain usable if the peer connection services are unavailable. A static-host launch needs none of the cloud account features above.

Before a Supabase implementation: confirm the intended project and active status; inspect existing schemas without modifying them; review the current changelog and security advisors; choose staging and production boundaries; enable RLS on every exposed table and grant only necessary API privileges; use publishable client keys only; keep secret/service-role keys server-side. Verify permissions with separate owner, member, outsider and signed-out accounts. Realtime channels require membership authorization too. Test concurrent joins, revoked invites, duplicate results, expired sessions, deletion and restoration before release.

The September 2026 changelog includes a PostgreSQL minor-version change affecting some `ltree`, `pgcrypto`, `btree_gist` and custom-operator deployments. The existing inactive project was not queried or upgraded; its applicability is unknown. This static client has no Supabase SDK/schema to migrate.

## Build and package an independent release

`standalone-hosting.json` records the separate HISAAB deployment identity. Use it as the
`.openai/hosting.json` in the dedicated publication checkout; never copy it over this repository's
root hosting manifest, which belongs to the original game. The publication checkout tracks the
verified static artifact and its source-revision provenance; editable code stays on the HISAAB branch.

Run the normal release gates from the source branch, then build a root-based static artifact:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
node --test tests/*.test.mjs
node scripts/hisaab-validate.mjs
HISAAB_BASE=/ HISAAB_OUT=dist-hisaab-domain pnpm build:hisaab
```

Certificates and share/invite links derive the current browser origin and edition base. The checked-in CSV/XLSX remain the Pages edition's downloads. After building the standalone artifact, generate copies with the standalone address; source citations stay unchanged:

```sh
HISAAB_PUBLIC_URL=https://hisaab-do.whatswrong-inc.chatgpt.site/ \
HISAAB_DOWNLOADS_OUT=dist-hisaab-domain/downloads \
node editions/hisaab/app/screens/ledger/make-downloads.mjs

node scripts/hisaab-verify-artifact.mjs dist-hisaab-domain
```

The download generator requires Python with `openpyxl` (the existing generator dependency). Set `PYTHON` if needed. `HISAAB_PUBLIC_URL` must be HTTPS with no query, fragment or credentials; replace it with the actual new domain when that domain is ready. These two variables configure the download generator, not Vite. Never set a Supabase secret or GitHub token in a public build variable.

The artifact verifier checks the requested URL base, entry module, manifest, local HTML/CSS/font/icon references, publication pages, ledger files and obvious accidental source/private-file inclusion. It does not certify all secrets absent, verify third-party source facts, perform browser tests, or benchmark capacity. It rejects a Pages-path artifact when a root artifact is expected. For a Pages build explicitly use `--base=/fact-duel/hisaab/`.

Upload only the resulting artifact directory. Preserve hashed asset names and serve the correct MIME types. The router uses fragments, so a copied `#/q/...` or `#/circles?...` link needs the ordinary root document; no catch-all application server is required. Keep `index.html` revalidatable across deployments and use immutable caching only for fingerprinted assets if the host exposes cache configuration.

The manifest supports a standalone display preference. It is not an offline guarantee: there is no offline service worker or app-store package in this release. Installing a shortcut does not sync profiles.

## Data when moving addresses

Browser storage is scoped to an origin. Progress stored on `occult-kranti.github.io` does **not** automatically appear on the new host or a later custom domain. The old data remains on its old origin unless the player clears it. Settings exports a JSON archive, but there is currently **no import/restore interface**. Do not tell users that downloading the export migrates their account.

Circle invite codes can be pasted into Join circle on the new host; users then choose their nickname there. Old invite links still open the old deployment. Reissue links from the new host for a consistent release/version. A fresh local membership is not cloud recovery, and previously met nicknames/device XP are not synchronized by that operation. Keep the old site available while communicating the new address; do not auto-delete its data.

## Final live checks

Record the deployed version, URL and date. Check HTTPS and root loading, both themes on narrow/mobile and desktop views, a deep question link, all duel variants, the game menu's resume/quit path, independent-browser circle join, certificate host text, CSV/XLSX links and the publication pages. Check no ads are requested in the default release. A real two-phone test across Wi-Fi and mobile data is separate from local/two-tab transport simulation; record it honestly if not performed.

If changing to a custom domain later: update DNS with the host; verify TLS; rebuild download links; update promotion links; recheck the actual origin. Cloud Auth, if later implemented, also needs its Site URL and allowed redirects changed. Preserve the existing game's domain and deployment.

## Primary references reviewed

- [Supabase changelog](https://supabase.com/changelog) and [PostgreSQL 15.19 / 17.11 advisory](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes): current platform changes; applicability to an existing database requires inspection.
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod): RLS, production SMTP, availability and staging/load-test guidance.
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits): public email authentication setup and operational limits.
- [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization): private-channel access and RLS; not a substitute for durable membership.
- [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits): bounded function lifetimes must be considered before choosing a match-server design.
- [Trystero documentation](https://github.com/dmotz/trystero): WebRTC transport, signaling and custom RTC/TURN configuration.

Prices and quotas change. No traffic, uptime or revenue projection is claimed by this document.

# Andhbhakt ya Deshbhakt

A bilingual quiz about Indian public money and public records. Meet a human rival, lock an answer, then read the dated source receipt. Titles and certificates are political satire.

**Play:** https://occult-kranti.github.io/andhbhakt-ya-deshbhakt/

**Sports and science sister game:** https://occult-kranti.github.io/fact-duel/

GitHub Pages serves the browser game. Supabase owns online identity, human matchmaking, answer timing, balances, results and standings. The game uses the isolated `hisaab_private` schema and `hisaab-game` Edge Function; the historical internal edition name is retained to preserve existing guests. No ChatGPT-hosted site is part of this release.

## Play and progression

- Enter a human duel immediately, invite a friend, or select Today’s file. The remembered arrival preference can open the daily desk; it never automatically wagers or starts a timed match.
- Five rounds, four choices, one locked answer. Correctness comes first; server-measured answer time breaks ties. The 120 ms dead-heat band does not remove network/device differences.
- Optional **UPI tax savings** stakes start at zero. These are free, nonredeemable game coins, with no payments or actual tax savings. Zero balance always permits zero-stake play.
- Featured Subsidies, Before the vote, and Who owns media? files award **×10 = 100 earned coins**, separately from the wager pot, subject to the disclosed participation and daily caps.
- Nine permanent levels run from Andhbhakt to Deshbhakt. A temporary hidden honour is granted from qualifying live standings. The server controls its current eligibility and expiry.
- The optional profile photo stays on the device. Shareable PNG certificates use the consistent original caricature, with player/caricature area changing from 30:70 to 90:10 as the player progresses.
- Solo learning remains available, with dated sources. Competition never silently substitutes a bot.

## Run locally

```sh
pnpm install --frozen-lockfile
VITE_HISAAB_SERVER_URL=https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/hisaab-game pnpm dev:hisaab --host 127.0.0.1
```

The default project base is `/andhbhakt-ya-deshbhakt/`. For a custom domain, build with `HISAAB_BASE=/`; configure DNS and GitHub Pages only after the domain has been purchased. The server endpoint stays the same.

```sh
pnpm exec tsc --noEmit
node --test tests/*.test.mjs
VITE_HISAAB_SERVER_URL=https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/hisaab-game pnpm build:hisaab
node scripts/hisaab-verify-artifact.mjs dist-hisaab --base=/andhbhakt-ya-deshbhakt/
```

## Deployment and beta limits

`.github/workflows/pages.yml` validates and publishes the standalone app from `main` through the official GitHub Pages artifact deployment. `release.json` on the site identifies the deployed source commit. Backend migrations and Edge code are applied before the matching browser release; no service-role credential is bundled in the browser.

The existing Supabase project hosts separate game schemas. A privileged cron job calls `hisaab_private.expire_rooms(clock_timestamp())` once per minute. See [server setup](supabase/hisaab/README.md), [release operations](docs/beta-release/OPERATIONS.md), and the [six-round panel](docs/beta-release/PANEL.md).

This is a casual public beta: device guest credentials expire after 30 days and are lost when browser storage is cleared. It is not verified account login or cheat-proof ranked competition. No money, purchases, prizes or cash-out exist. Live checks demonstrate individual room behavior, not internet-wide latency equality or production-scale capacity.

Ad scheduling is implemented after each practice completion, two wins or three losses. **Ads are disabled in this release.** Enabling real delivery requires an approved publisher/site configuration and a working consent adapter; fill and video format are controlled by the provider. See [game breaks](docs/hisaab/GAME-BREAKS.md). Missing ads never block play.

The repository retains shared source/history from `fact-duel` for reproducibility. This deployment builds only `editions/hisaab`; the sister game deploys from its own repository.

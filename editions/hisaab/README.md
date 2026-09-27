# HISAAB DO

**Current edition update (27 September 2026):** stopwatch answer XP, friends/family circles with a
nickname per circle, and a newspaper-inspired interface. Work stays on
`claude/loving-pasteur-s8xwtf`; **do not merge into `main`**.

| Change | Behavior |
|---|---|
| Stopwatch answer XP | Correct below 8s: 30 XP; 8–<15s: 20 XP; 15s+: 10 XP; wrong: 0. Other progression bonuses are labeled separately. |
| Daily and files | No answer deadline; existing replay/first-answer guards prevent repeated awards. |
| Duels | All three formats retained; 30-second question window. Casual P2P remains unranked. |
| Circles | Friends/family invite links, nickname per circle, saved local membership, optional live peer presence and self-reported XP. |
| Editorial interface | Cream paper, ink rules, original masthead, violet actions, mobile navigation, light/dark and Hindi retained. |
| Advertising readiness | Manual home-footer placement, off by default. Real publisher configuration, site approval, and consent adapter required to activate. |

Circles do not require a separate backend, but are not cloud accounts: clearing browser storage
removes local membership; the invite can rejoin the circle. Live connections depend on WebRTC
and public signaling availability. No private contact list is uploaded.

The design rationale and verification reports live in `docs/hisaab/review/`; the custom-domain and
AdSense handoff is `docs/hisaab/LAUNCH-AND-ADS.md`. The older release history below describes the initial
edition and is superseded by this update where scoring or appearance differs.

*हिसाब दो — "Show us the accounts."* A quiz-duel game about Indian public money: government schemes
and benefits, where the Union's and the states' money went, the scams and the institutions meant to
catch them, who owns the news, election money, the viral forwards, and the money handed out directly
between 2000 and 2026. Every question carries its source, a dated legal status where people are
named, and the other side's reply.

It is the second edition of the Jaanta Hai Kya (JHK) engine in this repo. It shares JHK's duel service, verdict rules, progression, journal and routes, with edition-only
scoring and duration policies over its own civics bank. Its LAL FEETA file-and-receipt identity now
uses an original newspaper/magazine composition. It is a static site with no server: bot
duels, routes, the daily file and the Vault run in the browser, friend duels are peer-to-peer (WebRTC),
and everything a player has is stored on their device.

Your rank is a label: you start as an **Andhbhakt** and, receipt by receipt, work up to **Certified
Anti-National**. The satire is aimed at labelling and blind devotion, never at a community or a private
citizen (charter §1–2).

**Live:** https://occult-kranti.github.io/fact-duel/hisaab/ (next to JHK at `/fact-duel/`), once the
`RELEASE` marker is committed (see Deploy).

| what | where |
|---|---|
| The charter: product, legal gates, schema, lanes, modes, notification budget. **Wins on conflict** | `docs/hisaab/CHARTER.md` |
| Roadmap: what was delivered, what is next | `docs/hisaab/ROADMAP.md` |
| The engine API (aliases, bank, duels, routes, P2P, storage, ledger, tools) | `docs/hisaab/ENGINE.md` |
| The app foundation for screen engineers (router, budget, components, set pieces) | `editions/hisaab/app/README.md` |
| The design bible, per-screen specs | `docs/hisaab/design-bible.md` + skill `hisaab-design` |
| Editorial and legal working card | skill `hisaab-editorial` |
| Reviews (advisor, design fidelity, mobile + a11y, legal + honesty, code, balance, P2 backlog) | `docs/hisaab/review/` |
| Lane research notes, the money-trail overview, the discourse map | `docs/hisaab/research/` |

## What is in it

- **910 questions in 20 lanes** and **130 routes** ("files"), derived from the bank on load:
  - Rajya Rounds, one per state (30).
  - Sector Files (12), Kiska Media?, Forward Court.
  - The money trail, 2000–2026: Seedha Khaate Mein (transfers), Rahat Kosh (relief), Chunav Se Pehle
    (before the vote), by era and by state.
  - Saal-dar-Saal, one file per year.
- **Aaj Ka Hisaab**, the same five cards for everyone on a local day, and a one-card taster for shared links.
- **Duels**: Babu-Bot (always labelled BOT; it picks at random) in Quick Draw, Triple Threat and The
  Gauntlet; **Duel a Friend** peer-to-peer with a room code, casual and unranked; **Pass & Play** on one phone.
- **Paisa Kahan Gaya?** (`#/money/ledger`): 389 measures that handed out public money, as a timeline,
  table and chart, with CSV and XLSX downloads.
- Me (the label ladder and a certificate PNG), the Receipts Vault, Settings (theme, English/हिन्दी,
  effects), and Rules & Sources with a corrections log.

## Run, build, preview, test

Node ≥ 22.13 and pnpm 11 (`packageManager` in `package.json`). From the repo root:

```sh
pnpm install

pnpm dev:hisaab                       # http://localhost:5173/fact-duel/hisaab/
pnpm dev:hisaab --port 5181 --strictPort

pnpm build:hisaab                     # → dist-hisaab/ (gitignored), base /fact-duel/hisaab/
HISAAB_BASE=/ pnpm build:hisaab       # build for a site root instead
HISAAB_OUT=/tmp/me/dist pnpm build:hisaab   # build elsewhere (parallel agents, CI)

pnpm preview:hisaab --port 4174       # serve the build at http://localhost:4174/fact-duel/hisaab/
                                      # (HISAAB_OUT=… pnpm preview:hisaab serves that build)
```

Checks, in the order CI runs them:

```sh
pnpm exec tsc --noEmit                        # types, JHK and the edition together
node --test tests/hisaab-*.test.mjs           # the edition's tests (ENGINE §15)
node --test tests/*.test.mjs                  # the whole suite: JHK must stay green too
node scripts/hisaab-validate.mjs              # the bank contract, every lane
```

Before a release, also run these:

```sh
node scripts/hisaab-giveaways.mjs             # cross-item answer giveaways (advisory; read the pairs)
node scripts/hisaab-screens.mjs /tmp/me/walk  # the screen walker over `pnpm preview:hisaab --port 4174`
```

The walker drives Chromium through every screen at 360/390/414/1440 in light and dark, plus Hindi at
390, and through eleven end-to-end flows. It fails on overflow, small targets or text, console errors,
a second violet primary or a noisy live question. It measures and does not judge, so **read the
PNGs**. Unlinked debug pages: `#/dev` (the engine), `#/dev/ui` (the component gallery), `#/dev/three`
(the set-piece lab).

## Deploy

`.github/workflows/pages-hisaab.yml` publishes the edition into the **`hisaab/` folder of the
`gh-pages` branch**, next to the JHK game that `pages.yml` publishes at the root.

- **Triggers:** a push to `main` or `claude/loving-pasteur-s8xwtf` that touches the edition, the shared
  engine (`lib/`, `app/`, `components/`, `hooks/`, `static/`), the build config, the lockfile, `tests/`
  or the workflow; or a manual run (`workflow_dispatch`).
- **The `RELEASE` marker.** A preflight job publishes only when `editions/hisaab/RELEASE` exists (with
  `vite.config.hisaab.ts` and the `build:hisaab` script). Until the lead commits that file, the
  workflow says "nothing to publish" and exits green, so a half-built app is never live. To release:
  commit an `editions/hisaab/RELEASE` file (its contents are not read) and push.
- **The job:** `pnpm install --frozen-lockfile` → tsc, the full test suite and the bank validator →
  `pnpm build:hisaab` with `HISAAB_BASE=/<repo>/hisaab/` → clone `gh-pages`, replace only `hisaab/`,
  commit, and push without force, rebasing and retrying up to four times if the branch moved.
- **Coexistence with JHK:** `pages.yml` force-pushes the root from `main`, but first carries the live
  `hisaab/` folder over, and both workflows share the `pages` concurrency group, so they queue and can
  run in either order.
- **After a deploy:** open https://occult-kranti.github.io/fact-duel/hisaab/, point the walker at it
  (`node scripts/hisaab-screens.mjs <outDir> https://occult-kranti.github.io/fact-duel/hisaab/`), and
  check that JHK at `/fact-duel/` is untouched.

JHK and the edition share one origin, so every storage name is namespaced (`hisaab-*` / `hd-*`,
ENGINE §13). A player's JHK profile and HISAAB DO profile never see each other.

## The content pipeline

The bank is **evidence first**. Items are researched from fetched pages, never from memory, and
anything that names a person carries a dated legal status and the other side.

1. **Lanes.** Each lane is one file, `editions/hisaab/bank/<lane>.mjs`, exporting one frozen array, with
   an id prefix and target from charter §4. There are nine original lanes (schemes, spending, scams,
   states-north / west-south / east, media, elections, forwards) and eleven money-trail lanes (`dist-*`,
   `relief-*`, `poll-*`, `money-gaps-*`). Each lane has a notes file in `docs/hisaab/research/`: the
   sources, what was dropped, a **stale-risk list**, and the audit.
2. **The editorial card.** Load the `hisaab-editorial` skill before adding, editing, fact-checking or
   refreshing any item. It covers the legal gates, status wording (alleged / chargesheeted / convicted /
   acquitted), `otherSide`, balance and the wording rules.
3. **The contract.** `editions/hisaab/bank/schema.mjs` is the schema as code (`checkBank`), and
   `node scripts/hisaab-validate.mjs [lane files…]` runs it with a per-lane spread. `tests/hisaab-bank.test.mjs`
   fails the suite on any problem, and CI runs the validator before every deploy.
4. **The giveaway detector.** `node scripts/hisaab-giveaways.mjs` finds an item whose correct answer
   appears word for word in another item's text on the same subject (a player who meets that card first
   is handed the answer). Rewrite one side of each pair it prints.
5. **Registration.** `editions/hisaab/bank/index.mjs` is the only place a lane is wired in. A lane added
   to `LANES` is at once playable in duels, practice, routes and the daily five. New routes appear when a
   pool reaches its minimum.
6. **Independent check.** A second agent re-fetches every source of a new or changed batch and records
   what it fixed in the lane's notes, as the 26 Sep 2026 fact audit did.
7. **The money ledger.** A new or changed money-trail item also updates
   `editions/hisaab/data/money-ledger.json` (field reference: `money-ledger.schema.md`). Then regenerate
   the downloads with `node editions/hisaab/app/screens/ledger/make-downloads.mjs`, or
   `tests/hisaab-ledger.test.mjs` fails.
8. **Refresh.** Re-verify the stale-risk items monthly (ROADMAP 5.3). The Vault flags any receipt whose
   status is older than six months. Once live, log every correction to a served item the day it ships
   in `app/screens/rules/corrections.ts` (`CORRECTIONS`: date, id, what changed, why, source), which the
   Rules page prints. Add a new entry each time and never rewrite an old one.

Any change to any item changes the P2P bank fingerprint. Friends on different deploys are asked to
reload before they can duel (ENGINE §12).

## Where everything lives

```
editions/hisaab/
  README.md                  this file
  RELEASE                    the deploy marker (absent until release)
  index.html, main.tsx       entry: theme before first paint, font preloads, mounts app/app.tsx
  edition.ts                 the typed facade: EDITION, ROUTES, labels, money-trail helpers, todaysFive, DUEL_FORMATS
  aliases.mjs                THE list of shared JHK modules the edition swaps (build + tests)
  node-aliases.mjs           the same table as a node resolve hook, for tests
  storage-ns.mjs             the 'hisaab' / 'hd' storage namespace
  bank/                      schema.mjs (the contract), index.mjs (the registry), one file per lane
  data/                      money-ledger.json (389 measures) + money-ledger.schema.md
  engine/                    routes (derivation, mix, retired stubs), labels, the daily five, the duel controller,
                             content/events/profile-sync twins
  server/bank.mjs            the civics bank as the duel service sees it
  p2p/                       Duel a Friend: protocol (room secrets, deal, handshake), transports, Pass & Play
  theme/tokens.css           the LAL FEETA tokens
  public/                    favicon, manifest, downloads/ (the ledger's CSV + XLSX)
  app/                       the app, see app/README.md
    app.tsx, router.ts, budget.ts, data.ts   providers, hash router, notification budget, bank/label/legal helpers
    shell/                   top bar, bottom bar / rail, player context, progression watcher
    ui/                      the component library (files, tape, options, stamps, receipts, noting, certificate…)
    screens/<name>/          one lazily loaded module per screen (home, files, money, ledger, route, aaj, duel,
                             room, pass, receipts, me, settings, rules, start, taster)
    three/                   TIJORI, TARAZU, THAPPA, FILE PILE: lazy Rapier scenes with 2D fallbacks
    share/                   receipt, daily-grid, certificate and invite PNG cards + text
vite.config.hisaab.ts        the build (root editions/hisaab, alias plugin, HISAAB_BASE, HISAAB_OUT)
.github/workflows/pages-hisaab.yml   the deploy
scripts/hisaab-validate.mjs  the bank validator
scripts/hisaab-giveaways.mjs the cross-item giveaway detector
scripts/hisaab-screens.mjs   the screen walker (the phone gate)
scripts/research/reddit-pulse.mjs    the monthly Reddit pulse (ROADMAP 5.6)
tests/hisaab-*.test.mjs      the edition's tests
docs/hisaab/                 charter, roadmap, engine guide, design bible, research, reviews
.claude/skills/hisaab-design, hisaab-editorial   the design and editorial working cards
```

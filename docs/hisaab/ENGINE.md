# HISAAB DO — engine guide

> Current edition amendment (27 September 2026): `STOPWATCH-SCORING.md` supersedes the older
> confidence/XP/duration descriptions in this historical engine guide. `lib/edition-rules.mjs`
> retains JHK defaults; `editions/hisaab/engine/scoring.mjs` is the HISAAB-only alias.
> Circles are implemented in `editions/hisaab/circles/{model,store,live}.mjs`, routed at
> `#/circles` and `#/circles/:id`, with namespaced browser storage and optional live peer presence.
> `LAUNCH-AND-ADS.md` documents the default-off advertising module and standalone-domain build.


For the UI engineers building the edition's screens. This covers what the engine gives you, how to
drive it, and what not to break. The charter (`CHARTER.md`) takes precedence over this file.

**Status (26 Sep 2026, pre-release).** The edition builds as its own site (`dist-hisaab/`) and runs the
JHK engine unchanged over the civics bank: 910 items in 20 lanes, 130 live routes. `main.tsx` mounts the
real app (`app/app.tsx`; the screen engineers' guide is `editions/hisaab/app/README.md`). The engine
lane's placeholder UI (`app/dev-shell.tsx`) is still reachable at `#/dev` for engine debugging and is
never linked. Running, testing, the content pipeline and the deploy for the edition as a whole are in
`editions/hisaab/README.md`.

---

## 1. Run it

| command | what it does |
|---|---|
| `pnpm dev:hisaab` | Vite dev server at `http://localhost:5173/fact-duel/hisaab/` |
| `pnpm build:hisaab` | production build into `dist-hisaab/` (gitignored) |
| `pnpm preview:hisaab` | serves `dist-hisaab/` at the base path, e.g. `--port 4174` |
| `HISAAB_BASE=/ pnpm build:hisaab` | build for a site root instead of `/fact-duel/hisaab/` |
| `HISAAB_OUT=<dir> pnpm build:hisaab` | build somewhere else (parallel agents, CI); `preview:hisaab` reads the same variable |
| `node --test tests/hisaab-*.test.mjs` | the edition's tests (§15) |
| `node scripts/hisaab-validate.mjs editions/hisaab/bank/<lane>.mjs` | check a bank lane; no argument checks every lane in `bank/` |
| `node scripts/hisaab-giveaways.mjs [--json]` | cross-item answer giveaways in the bank (§17) |
| `node scripts/hisaab-screens.mjs <outDir> [baseUrl]` | the screen walker, the edition's phone gate (§17) |
| `node editions/hisaab/app/screens/ledger/make-downloads.mjs` | regenerate the money ledger's CSV and XLSX (§16) |

The deployment base is available at runtime as `EDITION.base` (from `editions/hisaab/edition.ts`),
which reads a `__HISAAB_BASE__` define. There is no `import.meta.env` typing in this repo, so use that.
Files in `editions/hisaab/public/` are copied to the site root. Vite rewrites root-absolute URLs in
`index.html`, but not URLs set from script: prefix those with `EDITION.base`.

The edition does **not** import JHK's CSS (`app/globals.css`, Tailwind, the Floodlight tokens). Styles
come from the design lane (`editions/hisaab/theme/`, skill `hisaab-design`).

## 2. Layout

```
vite.config.hisaab.ts           the build: root editions/hisaab, alias plugin, base, outDir dist-hisaab
editions/hisaab/
  index.html, main.tsx          entry: theme before first paint, font preloads, mounts app/app.tsx
  public/                       favicon.svg, manifest.webmanifest, downloads/ (the ledger's CSV + XLSX, §16)
  RELEASE                       the deploy marker (absent until release; see editions/hisaab/README.md)
  edition.ts                    typed facade: EDITION, ladder, ROUTES, money-trail + year helpers,
                                todaysFive, DUEL_FORMATS
  aliases.mjs                   THE list of shared modules the edition swaps (section 3)
  node-aliases.mjs              the same list as a node resolve hook, for tests
  storage-ns.mjs                'hisaab' / 'hd' storage namespace (alias target)
  bank/schema.mjs               the bank contract (lead)       bank/index.mjs   registry: LANES, BANK
  bank/<lane>.mjs               20 content lanes              bank/sample.mjs  old fixture, not registered
  data/money-ledger.json        the money ledger, 389 measures (+ money-ledger.schema.md), §16
  server/bank.mjs               QUESTIONS / ALL_QUESTIONS / HIDDEN_COUNT (alias target)
  engine/content.mjs            domain 'civics', TOPIC_DOMAINS = the 13 sectors (alias target)
  engine/routes.mjs             deriveRoutes(bank), routeCatalogue(bank): live routes + retired stubs (§7)
  engine/expedition-routes.mjs  EXPEDITIONS = routeCatalogue(QUESTIONS) (alias target)
  engine/labels.mjs             the nine-rung label ladder
  engine/daily.mjs              Aaj Ka Hisaab: dailyFive / dealDaily
  engine/duel-controller.mjs    one match through any request(): calibrate, poll, reveal, answer
  engine/events-data.mjs        empty event calendar (alias target)
  engine/profile-sync-static.ts no-server profile sync (alias target)
  app/use-duel.ts               useDuel / useQuestionShown hooks
  app/                          the app: shell, router, budget, ui/, screens/, three/, share/ (app/README.md)
  app/dev-shell.tsx             the engine's placeholder UI, now the #/dev debug page
  p2p/                          transports, host/guest protocol, room secrets, pass & play (§12)
```

Import paths: inside the edition, `@/…` is the repo root (as in JHK), so `@/lib/progression.mjs`,
`@/app/use-player`, `@/components/fx` all work, and **go through the alias table**.

## 3. What is aliased, and why

Every difference between JHK and the edition is one row of `editions/hisaab/aliases.mjs`.
`vite.config.hisaab.ts` applies it with a `resolveId` plugin keyed by the shared module's **resolved
absolute path**, so it catches every spelling of the import: `@/lib/content.mjs` in a screen,
`../content.mjs` inside `lib/`, `./bank.mjs` inside `lib/server/`. A twin may import the module it
replaces; imports from the twin itself are never redirected.

| shared module | edition twin | why |
|---|---|---|
| `lib/duel-client.ts` | `lib/duel-client-static.ts` | the duel service runs in the page (same as JHK's static build) |
| `lib/wallet-client.ts` | `lib/wallet-client-static.ts` | device wallet only; there is no `/api/wallet` |
| `lib/presence-client.ts` | `lib/presence-client-static.ts` | no live counts without a server |
| `lib/profile-sync.ts` | `engine/profile-sync-static.ts` | no `/api/auth` or `/api/profile` on Pages. The real module would POST on every load and log 404s |
| `lib/server/bank.mjs` | `server/bank.mjs` | the civics bank, so the duel service, practice, expeditions and catalogue all use it |
| `lib/content.mjs` | `engine/content.mjs` | domain `civics`; `TOPIC_DOMAINS` = the 13 SECTORS, so journal/progression keep civics facts |
| `lib/expedition-routes.mjs` | `engine/expedition-routes.mjs` | routes derived from the bank, not JHK's nine sports routes |
| `lib/events-data.mjs` | `engine/events-data.mjs` | no sports calendar (keeps 43 KB of fixtures out of the bundle) |
| `lib/storage-ns.mjs` | `storage-ns.mjs` | every IndexedDB, localStorage and BroadcastChannel name becomes `hisaab-*` / `hd-*` |
| `next/dynamic` | `static/next-dynamic-shim.tsx` | same shim as the static build (a plain `resolve.alias`) |

The duel client and the bank are swapped by the same table, so any screen that calls
`request()` from `@/lib/duel-client` is already talking to the in-page duel service over the civics bank.

**Tests use the same table.** `register('../editions/hisaab/node-aliases.mjs', import.meta.url)` at
the top of a test file makes every later **dynamic** `import()` resolve through it. Static imports run
before `register`. Each test file runs in its own process, so JHK's tests never see the hook.

## 4. Shared-code changes

All of them are additive and keep the defaults. With the JHK build, every value is unchanged: the full
suite gives the same results, and a clean-worktree build of `dist-static/` gives byte-identical CSS and
index.html apart from the script hash.

1. **Storage namespace.** New `lib/storage-ns.mjs` (`{ long: 'fact-duel', short: 'fd' }`) and
   `lib/storage-names.mjs` (`storageNames(ns)`, `STORAGE`). The literal names at these call sites now
   come from `STORAGE`, with the same values: `lib/profile-store.mjs`, `lib/wallet-store.mjs`,
   `lib/fx/prefs.ts`, `lib/profile-gate.mjs`, `lib/auth-client.ts`, `lib/queue-client.ts`,
   `lib/duel-client.ts`, `lib/wallet-client.ts`, `lib/wallet-client-static.ts`,
   `lib/duel-client-static.ts`, `lib/profile-sync.ts`, `app/use-player.ts`, `app/use-wallet.ts`,
   `app/use-locale.tsx`, `app/shell/settings-sheet.tsx`, `app/arena.tsx`,
   `components/three/hero-orb.tsx`. Not changed: `app/ops/dashboard.tsx` and `app/studio/studio.tsx`,
   which are JHK server-only tools that are never in an edition graph (listed as exceptions in
   `tests/hisaab-storage.test.mjs`).
2. **`TOPIC_DOMAINS` moved** from `lib/journal.mjs` to `lib/content.mjs`, with the same value.
   `lib/journal.mjs` imports it and re-exports it, so every existing import works. This lets one alias
   (content) define the edition's topics.
3. **Route catalogue split out.** JHK's nine routes moved verbatim to the new
   `lib/expedition-routes.mjs`. `lib/expeditions.mjs` imports and re-exports `EXPEDITIONS`.
   `validExpeditionCards` now accepts an optional `route.topics` array for mixed-topic routes. JHK's
   routes have no `topics`, so the check stays exactly `f.topic === route.topic`.
4. **Verdict made reusable.** `lib/server/room-engine.mjs` now exports `roundVerdict(answers, tieMs)`,
   `matchDecided(mode, roundIndex, scores)` and `matchWinner(scores)`, and `finishRound` calls them.
   The logic is the same code, moved.
5. `package.json`: dependency `trystero@0.25.4`; scripts `build:hisaab`, `dev:hisaab`,
   `preview:hisaab`. `pnpm-lock.yaml` is updated to match. `.gitignore` adds `/dist-hisaab/`.
6. **Progression switches** (`lib/progression.mjs`): `setProgressionOptions({ visitCreditsStreak,
   rankHumanMatches })`, both `true` by default, which is JHK's behaviour; JHK never calls it. The
   edition sets both to `false` once, in `app/shell/player.tsx`: a visit alone does not credit the streak
   (the ladder is climbed receipt by receipt), and friend duels pay XP but never move the Babu rank.
7. **Tailwind scope** (`app/globals.css`): `@source not "../editions";`, so JHK's CSS never picks up
   class names from edition files.

## 5. The bank

`editions/hisaab/bank/index.mjs` is the only place a lane is wired in:

```js
import { HISAAB_SCHEMES } from './schemes.mjs';
// … one import per lane
export const LANES = Object.freeze({ schemes: HISAAB_SCHEMES, spending: HISAAB_SPENDING, /* … 20 lanes */ });
export const BANK = Object.freeze(Object.values(LANES).flat());
```

Twenty lanes are registered: the nine original ones (schemes, spending, scams, the three state lanes,
media, elections, forwards) and the eleven money-trail lanes (`dist-*`, `relief-*`, `poll-*`,
`money-gaps-*`). `sample.mjs` stays in the repo as a small fixture and is not served.

Adding a lane there makes it playable everywhere at once: duels, practice, routes and the daily five.
`tests/hisaab-bank.test.mjs` runs `checkBank(LANES)` and requires it to report nothing. Items keep the JHK
question shape plus the charter fields, and the engine reads `id, domain, region, topic, subtopic,
difficulty, question, options, correctIndex, explanation, sourceUrl, sourceLabel`. Edition fields
(`state`, `kind`, `govt`, `asOf`, `status`, `people`, `year`, `sources`) are for the routes and your
screens, and so are the optional ones: `otherSide` (the receipt's OTHER SIDE row: the denial, clearance or
official reply; 223 items carry it), `tags` (money-trail modes), `poll` (`{ label, month, gapDays?,
result? }`, required with the `pre-election` tag), `enactedBy` (`[{ name, role, party }]`) and `outcome`.
Look an item up by `factId` in `BANK` to show its state, status line or `asOf`.

## 6. Duels vs the bot

### 6.1 `request(body)`

`import { request } from '@/lib/duel-client'` (in this build, the in-page duel service). It resolves
with the result, or throws an `Error` with `.code` and `.status`, the same contract as JHK's HTTP client.

| action | body (beyond `action`) | result |
|---|---|---|
| `clock` | — | `{ serverNow }` |
| `catalogue` | — | `{ catalogue: { count, topics[{topic,domain,count}], facets, rules: { tieMs, maxTransportMs } } }` |
| `practice` | `topic?` ('all') | `{ cards: Card[3] }` (open teaching cards, answers included) |
| `expedition` | `routeId` | `{ routeId, version, cards: Card[6] }` (options shuffled per call) |
| `create` | `roomId` (32 hex), `token`, `invite` (32–64 `[A-Za-z0-9_-]`), `name` (1–24), `config` | `{ room }` |
| `ready` | `roomId, token, roundId` (null before round 1), `rttMs, jitterMs` | `{ room }` |
| `reveal` | `roomId, token, roundId` | `{ room }` (the question is now in `room.round.question`) |
| `answer` | `roomId, token, roundId, attemptId` (16–64 chars), `choice` 0–3, `elapsedMs` | `{ room }` |
| `state` | `roomId, token` | `{ room }` (poll this) |
| `leave` | `roomId, token` | `{ room }` (settles: refund, no winner) |

`config` for a bot match: `{ mode, duration, stake: 0, opponent: 'bot', topic?, difficulty?, subtopic? }`.
Filters default to `'all'`. A filter that leaves fewer questions than the format needs throws `invalid_request`.

### 6.2 Formats and timers

| mode | name | rounds | clock | ends |
|---|---|---|---|---|
| `quick` | Quick Draw | 1 | 30 s maximum | after the round |
| `trilogy` | Triple Threat | up to 3 | 30 s maximum | first to 2 round wins |
| `gauntlet` | The Gauntlet | 5 | 30 s maximum | after 5; most rounds wins |

`DUEL_FORMATS` in `edition.ts` has these, taken from the edition rules. Legacy allowed durations are
5, 7 and 10 s; all current HISAAB formats use 30 s. The original game retains its own defaults.
Each round is scheduled 3 s after both seats are ready, and a seat must reveal within 12 s of that or
the match is cancelled (`player-not-connected`). The bot readies itself between rounds; the human seat
calls `ready` again.

**Verdict (the engine's, used for bot, friend and P2P alike):** correctness first. If only one seat is
right, that seat wins (`correct`). If both are right, the shorter reveal-to-input time wins
(`screen-time`) unless the two are within 150 ms, which is a draw (`close-result`). If neither is right,
the reason is `no-correct-answer`. A reported time that the receipt time contradicts beyond the transport
grace cancels the match (`timing-inconsistent`).

The practice bot is **Lucky Guess · BOT**. Its pick is uniform over the four options and its delay is
uniform between 1 s and duration minus 0.5 s. It never sees the question, and the receipts mark it as
`simulated` ("scheduled bot"). Always label it BOT.

The HISAAB-only `IMMEDIATE_DUEL_FEEDBACK` rule resolves that precommitted bot turn as soon as the
human's timing-valid answer is durably sealed. The sampled choice and duration do not change.
The answer response performs revision-checked settlement after the durable receipt write, so it
does not require an additional polling interval. Human rounds settle as soon as both answers are
in; until then, only the answered seat receives a private `personalReceipt`. It contains the locked
choice, correctness, elapsed time and sourced explanation. It is not a shared winner or an XP award.

### 6.3 The duel controller (use this instead of re-deriving the arena)

```ts
import { request } from '@/lib/duel-client';
import { useDuel, useQuestionShown } from '@/editions/hisaab/app/use-duel';

const { controller, snapshot } = useDuel(request);
useQuestionShown(controller, snapshot); // starts the answer clock 2 animation frames after the question mounts
await controller.createBot({ name, config: { mode: 'quick', duration: 30 } });
// render snapshot.room; on a tap: controller.answer(i)
```

`snapshot`: `{ room, error, busy, clock, shownRoundId, locked, countdownMs, remainingMs }`.
`countdownMs` covers the time before the reveal, and `remainingMs` the time left once
`markShown()` has run. The controller polls `state` every 500 ms while live and every 1500 ms while
waiting (3 s in a hidden tab), reveals at the shared countdown, ignores stale revisions and resends an
answer with the same attempt id. `adopt()`, `reset()` and `createBot()` each start a new **epoch**, and
every response is checked against the epoch it was sent in after its await, so a late reply never brings
back a forgotten room or replaces a newly adopted one. The 150 ms ticker re-renders only during the
countdown; once the question is out, the timer bar reads `controller.snapshot()` from its own rAF loop.
Other methods: `calibrate()`, `ready()`, `refresh()`, `resend()`, `leave()`, `reset()`, `adopt(data)`
(for P2P sessions), `dispose()`.

**Timing contract:** `elapsedMs` runs from `markShown()` to the tap on `performance.now()`. Call
`markShown` only once the question is actually painted (`useQuestionShown` does this). Keep the live
question surface quiet: no entrance animation, no layout shift, no renderer or ceremony during a round.

### 6.4 The room projection you render

`room`: `{ id, revision, seat, phase ('waiting'|'scheduled'|'playing'|'between'|'complete'|'cancelled'),
roundIndex, config, players[{ name, ready, kind: 'human'|'bot' }], scores[2], settled, winner (seat|null),
reason, completedRounds[], round }`.
`round`: `{ id, scheduledAt, issuedAt, answerLocked[2], question, personalReceipt, result, receipts }`.
`question` is `{ id, topic, subtopic, difficulty, question, options }` once revealed. When `result` is set
it also has `factId, domain, correctIndex, explanation, sourceUrl, sourceLabel`.
`result` is `{ winner, reason, tieMs }`, and `receipts[seat]` is `{ choice, correct, elapsedMs, simulated, … }`.
`completedRounds` holds the settled earlier rounds, which you need for the receipt screen.
`personalReceipt` is null for an unanswered seat, an invalid timing receipt, and after settlement.
No private feedback changes the opponent's question projection or permits early advancement.

### 6.5 Recording a duel to the profile

`usePlayer(room, profileEpoch)` files every settled round and match into the journal and progression
once, however often the room is re-polled. Pass the room you render and the `player.epoch()` captured
when you created it (see `DevShell`). Nothing else is needed for XP, streaks, quests and the Vault.

## 7. Routes (expeditions)

```ts
import { ROUTES, routesOfKind, routeById, type Route } from '@/editions/hisaab/edition';
```

Routes are derived from the bank (`engine/routes.mjs`) and are **the same objects** `lib/expeditions.mjs`
runs. `ROUTES` is the live list (`ACTIVE_EXPEDITIONS`), in display order: states (charter order),
sectors, Kiska Media, Forward Court, then the money trail and Saal-dar-Saal.

- **Rajya Rounds** (`kind: 'state'`, id `state-up`): one route per state with ≥ 4 items. A run is
  always **6 cards** (the engine's run length). A state with 4–5 items of its own is topped up with
  Centre items, taking its own sectors first. `ownCount` and `padded` report this, and your screen
  must say so: the subtitle reads "4 receipts from Assam, 2 from the Centre."
- **Sector Files** (`'sector'`, `sector-farm-food`): one per sector with ≥ 6 items, except Media & Speech.
- **Kiska Media?** (`'media'`, `kiska-media`): topic Media & Speech, ≥ 6 items.
- **Forward Court** (`'forward'`, `forward-court`): `kind: 'forward'`, ≥ 6 items, mixed sectors.
- **The money trail** (charter §4a, §6; `kind` = the tag: `'distribution'` Seedha Khaate Mein,
  `'relief'` Rahat Kosh, `'pre-election'` Chunav Se Pehle), from item `tags` and `year`. For each tag:
  one `all` route (`money-<tag>`), one per five-year **era** (`money-<tag>-2020-2026`, `MONEY_ERAS`),
  and one per **state** with the Centre first (`money-<tag>-in`, `money-<tag>-mp`), each only when that
  slice holds at least `MONEY_MIN` (6) items. Six cards, **never padded**; `poolSize` is the slice.
  Extra fields: `tag`, `scope` (`'all' | 'era' | 'state'`), `era`, `years: [from, to]`, `state`.
  `edition.ts`: `MONEY_MODES`, `moneyMode(tag)`, `moneyRoutes(tag)`, `MONEY_ERAS`, `MONEY_YEARS`.
- **Saal-dar-Saal** (`kind: 'year'`): one route per year 2000–2026 with at least `YEAR_MIN` (6) items,
  across every lane (`year-2019`). A run of thinner adjacent years is merged into a labelled range
  (`year-2004-2010`, `merged: true`, `years: [2004, 2010]`), and the title and subtitle say so. It is
  never padded with other years, and `from`/`to` are years that really have items (`yearGroups`).
  `edition.ts`: `yearRoutes()`, `routeForYear(y)`, `YEAR_MODE`.

A route has `{ id, kind, key, version, title, subtitle, code, stamp, chapters[3], topic, topics[],
ids[6], ownCount, padded[], poolSize, state?, sector? }`. The titles, subtitles and chapter names are
draft copy for the design lane to restyle or replace. Cards are picked two per difficulty and ordered
simple → expert → extreme across the three chapters. State and sector routes also keep to a **mix**
(`ROUTE_MIX`, balance review F2): at most two `kind: 'scam'` cards of six, and on a state route every
government with three or more items in the pool is dealt at least one card that is not a scam card (one
of its schemes when the pool has both). A state short of clean cards takes up to two from the Centre
instead, disclosed like any top-up. Money-trail, year, Kiska Media and Forward Court routes deal with no
mix. `deriveRoutes(bank, { mix: null })` deals every route the old way; which routes exist never
depends on the mix.

**Retired routes.** Route ids come and go with the data (a pool crossing a minimum, year ranges
regrouping), and `readExpeditions` keeps a stored record only for a key it finds in `EXPEDITIONS`. So
`EXPEDITIONS` is `routeCatalogue(bank)`: the live routes, then a **retired stub** for every other id the
derivation could ever produce (`routeIdSpace()`: every state, sector, money-trail tag × scope and year
or year range; 533 ids today). A stub has the live route's `id` and `key`, `domain: 'retired'`,
`retired: true`, no cards and `code: 'CLOSED'`. `enabledOnly` leaves it out of `ACTIVE_EXPEDITIONS`
(so `ROUTES` never shows it and the `expedition` action refuses it), but the player's finished results
on it survive the bank edit and come back with the route. An unfinished run on a stub is dropped,
because its cards no longer validate.

Playing one, as `DevShell.RoutePlayer` does:

```ts
const data = await request({ action: 'expedition', routeId: route.id });
if (data.version !== route.version || !validExpeditionCards(data.cards, route)) throw …;
await player.dispatch({ type: 'journey-start', routeId, runId: crypto.randomUUID(), previousRunId, cards: data.cards });
await player.dispatch({ type: 'journey-answer', routeId, runId, index, choice, confidence }); // 'steady'|'bold'|'called'
await player.dispatch({ type: 'journey-next', routeId, runId, index });                     // after the reveal
await player.fold(routeId, runId);                                                          // honest exit
```

The record is `player.profile.journeys[route.key]` (`{ run, first, best, last, bestScore, completions,
folded }`), and `expeditionStatus(record)` returns `'new' | 'continue' | 'complete'`. Confidence scoring:
Steady +2/0, Bold +3/−1, Called +4/−3 (`CONFIDENCE` in `lib/expeditions.mjs`). XP is the same at every
tier. Six cards run from −18 to 24 points.

With the 20 lanes registered on 26 September (910 items) the bank derives **130 live routes**: 30
states, 12 sectors, Kiska Media, Forward Court, 27 Seedha Khaate Mein, 11 Rahat Kosh, 22 Chunav Se Pehle
and 26 Saal-dar-Saal files. `tests/hisaab-ui-foundation.test.mjs` and `tests/hisaab-edition.test.mjs`
pin the derivation, and `tests/hisaab-routes.test.mjs` pins the mix.

## 8. Aaj Ka Hisaab (the daily five)

```ts
const { day, id, cards } = todaysFive();       // same five, same option order, for everyone that local day
player.dispatch({ type: 'practice', fact: cards[i], choice, roundId: dailyRoundId(day, i) });
```

The `practice` action journals the card and pays Discovery XP once per round id, so replaying the day
earns nothing more. It prefers five different sectors and at most two cards of any difficulty.

## 9. Progression selectors and the label ladder

```ts
const s = standing(player.progression?.xp ?? 0);
// { level, into, toNext, progress (0..1), band, title (engine band name), label: { label, line, from, to } }
```

`LADDER` holds the nine rungs, `labelFor(band)` and `labelForLevel(level)`. Band = floor(level / 5):
Andhbhakt (levels 1–4) … Certified Anti-National (40+). Show the **label**, never the engine's
`title`. From `player.progression`:

| field | meaning |
|---|---|
| `xp` | total XP (`levelForXp` in `lib/progression.mjs`) |
| `streak` | `{ current, best, lastDay, shields, frozenDays }` (local days; shields auto-cover a missed day) |
| `quests` | `{ day, seed, items[3]: { id, label, target, progress, xp, done } }`. "Play a {topic} duel" names a sector |
| `achievements` | id → unlock time. Hide `UNREACHABLE_ACHIEVEMENTS` (sports-fan, lab-coat) |
| `rank` | Arena Rank `{ points, tier, best, floor }` from duel results |
| `counters` | `rounds, correct, matches, wins, …, byTopic[sector], byMode[mode]` |
| `log` | the last 40 XP events `{ kind, xp, label, at }` |

The edition's notification rules (charter §7) are stricter than JHK's: no streak nags and no "come back"
prompts.

## 10. Profile hooks

`usePlayer(room?, roomEpoch?)` from `@/app/use-player` returns: `profile, journal, passport, summary,
progression, analytics, level, loaded, persistent, storageError, syncState ('off' here), dispatch,
epoch(), fold, open(roundId), recall, review, seedReview, save(question), clear() (reset), skin,
exportAll, report, visit, noteOpen, noteBeat, noteCount, equipCosmetic`. Every write goes through one
IndexedDB transaction (`hisaab-player`) and pings other tabs. Treat `loaded === false` as "not yet".
`useWallet()` (`@/app/use-wallet`) is the device coin wallet (`hisaab-wallet`), which you only need if
the design uses coins. Coins are free and simulated, and bot matches are always free.
`LocaleProvider` / `useLocale` (`@/app/use-locale`) persist `hd-locale`.

## 11. Feel: fx and juice

`import { FxProvider, useJuice, ToastStack, Ceremony, NumberCounter } from '@/components/fx'`. Mount
`<FxProvider>` once. `useJuice()` gives `burst(el, 'correct'|'wrong'|…)`, `toast`, `ceremony`,
`confetti`, `settle`, `shake`, `sound`, `haptic` (see skill `juice`). `ProgressionFeedback`
(`@/app/screens/use-progression-feedback`, takes `{ progression, quiet: { toasts, ceremonies } }`) turns
progression diffs into toasts and ceremonies. Under the charter budget, pass `quiet` so that there is at
most one toast per screen visit and ceremonies appear only for a label promotion or a finished file.
Prefs (sound, volume, haptics, motion) are in `lib/fx/prefs.ts` under `hisaab-*` keys. No sound plays
before the first tap.

## 12. Duel a Friend (P2P, no server) and Pass & Play

`import * as p2p from '@/editions/hisaab/p2p/index.mjs'`

**How it works.** The host's browser runs the real duel service on its own in-memory store. The guest
sends ordinary `request()` bodies (`join, ready, reveal, answer, state, leave, clock`) over a transport
and gets ordinary room projections back. The rules, timers, verdicts and timing checks are therefore
the engine's, and the duel controller drives both seats.

**The room secret.** The 8-character code (`ABCD-EFGH`, alphabet without 0/O/1/I/L, about 40 bits) is
what people read aloud and type. It never goes on the network as it is. `roomSecret(code)` stretches it
with PBKDF2 (`P2P_KDF`: PBKDF2-HMAC-SHA-256, 600,000 rounds, a fixed edition salt; about 0.1 s on a
laptop and around a second on a slow phone, cached per tab), and `roomKeys(code)` derives everything
else from that secret by SHA-256: the duel `roomId`, the `invite` token the second seat needs, the deal
`seed`, and the WebRTC rendezvous `topic` and `password`. The public relays therefore see only a hash of
the stretched secret, and every guess at a code costs 600,000 rounds. `P2P_TRUST.code` is the on-screen
line saying what that still leaves exposed (someone who spends the compute could later recover a code,
and with it both players' IP addresses).

**The deal.** The room secret seeds it: the host creates the room with `seededRng(roomKeys(code).seed)`,
so the deck is `dealFromSeed(seed, config)`. The guest deals the same deck from its own copy of the bank
(`expectedDeck(config)`) and checks every revealed question, text and option order, against it
(`verify(room)`).

**The handshake.** A hello compares the protocol (`P2P_PROTOCOL`, `'hisaab-duel/3'`) and the bank's
**content fingerprint** (`bankFingerprint()`: the item count plus an FNV-1a hash of every field of every
item, as canonical JSON with sorted keys). An editorial fix under the same id therefore changes it, and
two builds whose banks differ in any way refuse to pair (`p2p_mismatch`, "Both of you reload the page").
Two hosts or two guests are refused the same way.

**Rematches.** `rematchCode(first, n)` gives rematch `n` (1, 2, …) of the room that opened with code
`first`. It is derived from the first room's **secret**, not its code, and the new room's secret is
registered directly, so a rematch costs no second stretch. Both phones compute the same code after one
"rematch" message and keep the first room's transport; the rematch code is never typed.

**Label it honestly.** `P2P_TRUST.label` / `.body`: casual and trust-based. The host is authoritative,
and each browser reports its own reveal-to-input time, which a modified browser can forge. There are
no coins and no ranking. If you pass a P2P room to `usePlayer(room, epoch)` the way you would a bot
room, each device records its own side, and the match counts toward XP and the "Duel a friend" quest.

```ts
// Host
const code = p2p.makeRoomCode();                       // 'ABCD-EFGH', show it big
const transport = await p2p.createTrysteroTransport(code); // stretches the code while trystero loads
const host = p2p.createP2PHost({ transport, code, name, config: { mode: 'trilogy' } });
const created = await host.start();                    // { room } seat 0, 'waiting'
controller.adopt(created); host.onPoke(() => controller.refresh());
// Guest
const code = p2p.normalizeCode(typed);                 // null → "enter the 8-character code"
const guest = p2p.createP2PGuest({ transport: await p2p.createTrysteroTransport(code), code, name });
controller.adopt(await guest.join());                  // waits for the host's hello (timeoutMs: 8 s default; the lobby passes 15 s over WebRTC)
guest.onPoke(() => controller.refresh());
// Both: controller.calibrate(); controller.ready(); … same as a bot duel. session.onPeer('leave'), session.close()
// Rematch n on the same transport (both sides, after one 'rematch' message):
const next = await p2p.rematchCode(code, n);           // n = 1, 2, …
// then a new createP2PHost / createP2PGuest with `next` over the SAME transport. session.close() closes
// its transport, so give sessions a wrapper whose close() is a no-op (screens/duel/friend.tsx `attach`)
// and close the real transport once, when the lobby unmounts.
```

Use `useDuel(session.request)` inside a component keyed by the session. `session.request` already
carries the seat token, so attach with `adopt`, not `createBot`.

**Transports** (`{ send, onMessage, onPeer, close, kind }`):

- `createTrysteroTransport(code)`: WebRTC over trystero (MIT, npm, v0.25.4). It is lazy-loaded (a
  separate 60 KB chunk) and signals over **public Nostr relays**. The room id it joins is
  `roomKeys(code).topic` and its password is `roomKeys(code).password`, never the code itself (trystero
  publishes SHA-1 of the room id as a public Nostr tag). Caveats to show the player: both browsers must
  reach a public relay and form a direct connection. Strict NATs can fail because no TURN relay is
  configured, and adding one would mean running a server.
- `createBroadcastTransport(code)`: two tabs on one device (BroadcastChannel `hisaab-p2p-<CODE>`, from
  `STORAGE.p2pChannel`). The lobby uses it with `?via=tab`, which is how the walker tests a friend duel.
- `createMemoryPair()`: one realm (tests and the self-test).

**Disconnects.** If the guest leaves mid-match, the host settles the match as `player-left` (no winner).
If the host leaves, pending guest requests fail with `p2p_disconnected`. Error codes: `invalid_code`,
`p2p_timeout`, `p2p_mismatch`, `p2p_disconnected`, `p2p_closed` (the session was closed), `room_full`,
`not_ready` (the host is still opening the room), plus the duel service's own.

**Pass & Play** (two people, one phone, untimed; a pure reducer):

```ts
let s = p2p.startPassAndPlay({ mode: 'trilogy', names: ['Asha', 'Bilal'] });
s = p2p.reducePassAndPlay(s, { type: 'ready' });            // 'pass' → 'answer' (question shown)
s = p2p.reducePassAndPlay(s, { type: 'answer', choice });   // seat 0, then 'pass' to seat 1 …
s = p2p.reducePassAndPlay(s, { type: 'next' });             // after 'reveal' → next round or 'complete'
const view = p2p.passAndPlayView(s);                        // hides the key and the other pick until reveal
```

The verdict is the engine's `roundVerdict` with equal (zero) times, so both correct gives
`'both-correct'`. Pass & Play writes nothing to a profile because two people are sharing one.

## 13. Storage isolation

JHK and the edition share the `occult-kranti.github.io` origin. All storage names come from
`lib/storage-names.mjs`: `hisaab-player` (IndexedDB), `hisaab-wallet`, `hisaab-player` /
`hisaab-wallet` (BroadcastChannels), `hisaab-online-sound`, `hisaab-volume`, `hisaab-motion`,
`hisaab-haptics`, `hisaab-name`, `hd-principal`, `hd-locale`, `hd-gate`, … **Never write a literal key.**
Add a name to `storageNames()` and read it from `STORAGE`. `tests/hisaab-storage.test.mjs` fails on
literal storage keys in client code.

## 14. Pitfalls

- **Six cards per route.** The engine hard-codes it. Don't build shorter routes; top them up the way
  `deriveRoutes` does and say so on screen.
- **Routes move as lanes land.** A route's six can change when the bank changes, and a route can
  disappear (a pool drops below its minimum, a year range regroups). Finished results survive either
  way: a vanished route becomes a retired stub (§7) that keeps its record and never shows in `ROUTES`.
  An in-progress run whose cards no longer match is dropped on load (the route starts fresh). Don't
  cache route ids across releases, and read `ROUTES` (live), not `EXPEDITIONS` (live + stubs), for
  anything the player can open.
- **Any bank edit changes the P2P fingerprint.** Two players on different deploys cannot duel until
  both reload. That is the point (§12); say "reload" on screen, not "error".
- **Per-topic counters for mixed routes** go to the route's dominant sector (`route.topic`). The
  journal itself records each card's own sector.
- **Topics must be SECTORS.** The journal drops any fact whose topic is not a key of `TOPIC_DOMAINS`.
- **Small sectors make impossible quests.** "Play a {sector} duel" can name a sector with too few items
  for a duel filter. Any duel that includes that sector completes it.
- **Don't import `@/lib/duel-client` outside the edition build and expect civics.** Without the alias it
  is JHK's HTTP client and sports bank. Tests must `register` the node hook first.
- **JHK leftovers you may meet:** the export file is still named `fact-duel-player.json`
  (`usePlayer().exportAll`); the season/supporter code in `lib/season.mjs` lists sports (unused here).
  The engine's bot name is `Lucky Guess · BOT`.
- **Tailwind in JHK scans the repo.** JHK's `app/globals.css` uses Tailwind's automatic source
  detection. `editions/` is excluded (`@source not "../editions"`, §4), but stray files at the repo root
  can still add unused rules to JHK's CSS. Follow `hisaab-design` for the edition's class conventions,
  and don't leave scratch HTML in the repo.
- **Never put a renderer, ceremony or toast in a live round.** Rewards wait for the settled result.

## 15. Tests

| file | pins |
|---|---|
| `tests/hisaab-bank.test.mjs` | the contract (`checkBank(LANES)` reports nothing), bank exports, the duel service over the civics bank |
| `tests/hisaab-p2p.test.mjs` | codes, the stretched secret (`P2P_KDF` ≥ 600,000 rounds, `roomKeys` independent of case and spacing), `rematchCode`, the seeded deal, the content fingerprint, every verdict branch against `roundVerdict`, the timing check, the handshake, leave, a real-time controller match, BroadcastChannel, Pass & Play |
| `tests/hisaab-storage.test.mjs` | JHK names byte-identical, edition names disjoint, the edition graph resolves them, no literal keys |
| `tests/hisaab-edition.test.mjs` | route derivation and retired stubs, the ladder, the daily five, the alias table, civics through journal, progression, quests and the expedition reducer |
| `tests/hisaab-routes.test.mjs` | the route mix (`ROUTE_MIX`): the scam cap, government coverage, the Centre top-up and its disclosure, determinism |
| `tests/hisaab-ui-foundation.test.mjs` | money-trail and Saal-dar-Saal derivation, the hash router, the notification budget, the data helpers, and static rules (tokens only, no JHK classes, every screen module present, the Tailwind exclusion) |
| `tests/hisaab-ledger.test.mjs` | the money ledger's shaping (`screens/ledger/lib.ts`), `csv.mjs`, and the downloads: the CSV must match the data byte for byte, the XLSX must hold every row, a README and its sheets |
| `tests/hisaab-code-review.test.mjs` | the live-question timing contract, and guards for the code review's fixes (controller epochs, the quiet ticker, the one-toast visit) |

The JHK suite must stay green too: `node --test tests/*.test.mjs` (CI runs it before every deploy).

## 16. The money ledger (data file)

`editions/hisaab/data/money-ledger.json` is the dataset behind **Paisa Kahan Gaya?** (`#/money/ledger`,
`screens/ledger/`): a plain JSON array of **389 measures**, 2000–2026, that handed out public money
directly (transfers, relief funds, measures before a poll), sorted by `launched`, `state`, `id`. Every
field is defined in `editions/hisaab/data/money-ledger.schema.md`; the overview, counts and known gaps
are in `docs/hisaab/research/money-trail.md`.

- **It is derived from the bank, never researched on its own.** Each row lists the bank items behind it
  in `itemIds`, and every number, name, date and poll result in the row comes from one of them. When a
  bank item changes, search the JSON for its id and update each row that lists it.
- **The screen imports it at build time** (`import LEDGER_JSON from '../../../data/money-ledger.json'`)
  and shapes it with the pure functions in `screens/ledger/lib.ts`: timeline, table and year chart,
  filters kept in the URL query (`QUERY_KEYS`), facet counts, before-the-vote groups. It shows timing,
  never cause, and uses no party colours.
- **Downloads.** `public/downloads/hisaab-money-ledger.csv` and `.xlsx` are generated from the JSON by
  `node editions/hisaab/app/screens/ledger/make-downloads.mjs` (CSV via `csv.mjs`, XLSX via
  `make_xlsx.py` and openpyxl; `PYTHON=` picks the interpreter). Re-run it whenever the JSON changes:
  `tests/hisaab-ledger.test.mjs` fails when the CSV no longer matches the data.

## 17. Tools (scripts)

| script | what it does |
|---|---|
| `scripts/hisaab-validate.mjs [lane files…]` | the bank contract (`bank/schema.mjs` `checkBank`) per lane, with a per-lane spread of difficulty, kind, state and govt. No argument: every lane in `bank/`. Exit 1 on any problem. CI runs it before a deploy |
| `scripts/hisaab-giveaways.mjs [--json]` | cross-item **answer giveaways**: an item whose correct answer appears word for word in another item's stem, explanation, outcome, `otherSide`, status or `enactedBy` on the same subject, so a player who meets that card first is handed the answer. Only distinctive answers count (3+ digit numbers, numbers with a unit or %, 12+ letters); years, small numbers and institution names are skipped. Prints a summary and every pair. Advisory: it does not fail, so read its pairs before a release |
| `scripts/hisaab-screens.mjs <outDir> [baseUrl]` | the **screen walker**, the edition's phone gate. Over a running build (default `http://localhost:4174/fact-duel/hisaab/`) it walks every screen at 360/390/414/1440 × light/dark plus Hindi at 390 (fresh profile per cell), and runs the flows (three bot formats to a rematch, Pass & Play, a two-tab P2P duel, Home's links, Settings, the certificate PNG, the report link). It fails on horizontal overflow, targets under 44px (named exceptions only), sentences under 14px, inputs under 16px, console errors or failed requests, more than one violet primary, a noisy live question, and a CSS block owned by two lanes. Env: `ONLY=390x844`, `THEMES=light`, `SKIP_FLOWS=1`, `SKIP_HI=1`, `CHROME_PATH`. It writes PNGs and `report.json`; read the PNGs, because it measures and does not judge |
| `editions/hisaab/app/screens/ledger/make-downloads.mjs` | the ledger's CSV and XLSX (§16) |
| `scripts/research/reddit-pulse.mjs` | an aggregate monthly snapshot of Indian subreddits for the editorial lane (`--dry-run` works offline). Needs Reddit credentials in the environment and a network that reaches Reddit; see `docs/hisaab/ROADMAP.md` Phase 5 |

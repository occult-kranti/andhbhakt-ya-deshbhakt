# Jaanta Hai Kya (JHK) — Duels, Expeditions & Progression

Formerly FACT//DUEL. The repository, package and storage names keep the old identifier; only what a
person sees changed. Brand sheet: `docs/brand.md`.

A private sports and science knowledge club for friends or random practice bots.
All coins are free, per-room simulations with no monetary value.

## HISAAB DO — separate public-money edition

Play **[HISAAB DO](https://hisaab-do.whatswrong-inc.chatgpt.site)** on its independent public site.
The [GitHub Pages edition](https://occult-kranti.github.io/fact-duel/hisaab/) remains available.
HISAAB development stays on `claude/loving-pasteur-s8xwtf`; its deployment does not replace JHK.
See [standalone launch and services](docs/hisaab/STANDALONE-LAUNCH.md) and the
[six-round panel and verification record](docs/hisaab/review/night-edition-panels.md).

## Play

**Events** carries a curated calendar of real sports and science events — just finished, on right
now, and coming up — and turns them into limited-time modes that rotate every month. **Home** is the
arena hub: your level, XP, day streak, gems and Arena Rank, a one-tap duel against
the practice bot, the day's three quests, and whichever expedition you have in progress.
**Expeditions** has nine narrow sports and science routes using the existing 54-question sample.
**Play** builds a duel, **Player** holds your record, badges, stamps and the Locker, and **Vault**
keeps every fact you have met.

An expedition is six untimed questions in three chapters. Choose **Steady** (+2 correct, 0 wrong) or **Bold** (+3 correct, −1 wrong) before each answer. Your first choice locks. Each answer saves locally; pause and resume any route. After all six, **Finish & collect stamp** records the result and awards the same commemorative stamp at any score. First-run and best practice scores are separate. Replay uses the same questions with freshly shuffled options; no general skill ranking is implied.

For a bot duel, press Play now on Home or pick a format on Play. For two-screen play, choose
**Friend** on Play:

1. Open the site on two screens with access to the private site.
2. On the first screen, enter a name, choose a mode and filters, then create a duel.
3. Copy the invitation to the other screen, enter a different name, and join.
4. Press ready on both screens. Answer once on tap/click release or with keys 1–4.
5. Review the shared result, source, and timing table.

Quick Draw is one round; Triple Threat is up to three, first to two wins.
The Gauntlet plays all five questions; final score decides. Untimed Recall Lab
reviews already encountered facts from the local journal.
The clock is 5, 7 or 10 seconds and belongs to the format: Quick Draw opens on 10,
Triple Threat on 7, the Gauntlet on 5, and picking a format moves the timer with it.
A round ends on whichever comes first — both answers locked, or the clock plus the
transport grace. In Triple Threat and the Gauntlet the next round then starts on its
own after a short window on the fact; Start now skips it and Keep reading cancels it.
Coins are reserved once per match. A draw or cancelled match refunds the entry.
Rooms expire in two hours. Leaving, hiding an active page, or reloading after
reveal cancels the match. An invitation does not bypass private-site access.

## Timing contract

The browser reports its monotonic reveal-marker-to-input duration. When both
answers are correct, a difference at most 150 ms is a draw. The value is a casual
rule, not a measured device uncertainty bound. The server checks a capped
500–2000 ms transport envelope, but a modified browser can forge a passing time.
This is unsuitable for ranked competition or valuable stakes.

Connection probes use the primary database path. Reveal issuance and answer
acceptance are timestamped inside their respective successful writes.
The database stamps acceptance inside an atomic answer write before its receipt
deadline. A request read before a deadline but not successfully committed has
not been accepted. Both attempts remain sealed until closure. Coins, escrow,
scores and terminal settlement share one revision-guarded room state. A later
request finalizes committed attempts or persisted deadlines; no Worker timer is
assumed durable. There is no global wallet.

## Practice bot

Lucky Guess is explicitly labelled BOT. Each of the four options is equally
likely (25% correct in expectation, not a promised win rate). Its delay is sampled
uniformly in whole milliseconds from 1000 through `duration * 1000 - 500`.
The planner receives only the duration and RNG, never a question, answer key or
human response. All round plans are fixed and persisted before play. Retries do
not reroll them and public room projections never expose pending plans.

The bot's virtual clock begins with the human seat's atomic reveal timestamp.
An authenticated room request materializes a due bot response; a delayed poll
does not change its scheduled response time. This is a lazy scheduled simulation,
not a continuously running background process or a second device measurement.
The result table labels it accordingly. Human acceptance still uses the strict
database-write deadline and existing timing checks. Bot rounds use the same
correctness-first rule, 150 ms draw band and one-time coin settlement.

Bot-specific regressions cover all three modes and all timers, endpoint sampling,
hidden plans, auto-readiness, late polling, retry races, atomic reveal timing,
seat contention and cancellation. They supplement the existing human-vs-human
regressions; browser and cross-location testing remain separate.

## Verification

`node --test tests/*.test.mjs` runs engine, SQLite concurrency, progression and HTTP-handler
regressions (94 tests). `pnpm e2e` drives a real browser against a running dev server and asserts
the invariants unit tests cannot reach: the timing contract clauses, that no renderer or ceremony
appears during live play, that answer order survives a reveal, and that sticky call-to-action
buttons stay tappable. `node tests/stress.mjs /tmp/duel-stress.json` exercises the same room
service over localhost HTTP, with a real in-memory SQLite adapter and virtual
time. It does not measure Cloudflare D1, mobile devices, browser rendering or
cross-region capacity. Run `pnpm exec tsc --noEmit` for type checking.

The sample bank has 54 questions. The untimed `practice` API intentionally returns
three teaching cards including their answers; these share facts with the duel bank.
Active room projections still seal attempts and answer keys until closure. The
old offline predecessor also exposed these facts; this is not a secret ranked bank. Levels
are editorial, not empirically calibrated.

## Scale boundary

The current transport polls at 500 ms while active, 1500 ms while waiting, and stops
on terminal state. This is for a bounded private pilot. Before wider access,
add pre-storage endpoint limits, observed capacity and error budgets, durable
room actors with authenticated WebSockets, account/session identity, and a
reviewed content release pipeline. A room actor reduces polling overhead; it
cannot prove a browser's physical display or input time.

## Duel experience and shared systems

The default midnight/chartreuse identity and alternate cool light theme share
semantic controls, now expressed as one token set in `app/theme/tokens.css`: warm ember for the
competitive surfaces, cool cyan for the learning ones, gold for rewards. Home pairs a live 3D hero
with the day's quests and your record; the full match configurator lives on Play. Original sports
and science covers still support the routes. Every 3D scene is loaded lazily in the browser only,
after static art, and every action works without WebGL; scenes cap device pixel ratio, stop while
hidden or offscreen, respect reduced motion and dispose on unmount. An import cannot be cancelled
once it starts. No renderer is mounted during a room.

The server retains at most five completed-round snapshots, written only at
closure and exposing only the settled question, result and public receipt fields.
Live-room active/future answer keys, credentials and pending bot plans remain
private in room projections; open solo teaching packs are explicitly separate.
The result view uses a whole-match verdict plus independently inspectable round
receipts, including both selected options and explicit scheduled-bot/browser
clock labels. Cancelled later rounds preserve earlier completed receipts.
Journal recovery records every retained round once. Timeout counts use resolved
rounds, not only submitted attempts. Bot replay explicitly starts a new room;
friend replay is accurately labelled Set up rematch.

Question concerns are browser-local records containing the encountered snapshot,
a category and a note capped at 800 characters. Exact round/reason keys deduplicate
identical saves and allow note updates. Up to 50 issues appear in the Vault and
are included in export/reset. They are not sent to a support or editorial service.
An older version-2 profile initializes its missing issues list safely.

Discovery offers three untimed sourced questions before a first duel. The Fact
Vault revisits encountered questions, snapshots the recall deck so cross-tab
updates cannot swap the active card, and has bookmarks, explanations and export.
The Passport awards 10 activity points per stable fact, 5 for its first explicit
explanation opening and 5 for its first untimed attempt. The internal `recalled`
flag includes both Discovery and Vault attempts; the UI calls the combined measure
untimed attempts. It is not a mastery measure. First field notes, Field notes and
the mode tour unlock deterministic Orbit, Grid and Rally card finishes. These do
not affect answers, timing, coins or content access. Missions do not decay.

## Progression, quests and the Locker

`lib/progression.mjs` is a pure module that turns profile changes into progression. Its events are
derived by diffing the profile before and after every reducer run, so a duel room projection that is
re-delivered on each poll can never award XP twice. Everything it stores lives in the same
device-local IndexedDB profile (still version 2, default-filled and sanitised on read) and is cleared
by Reset. None of it is sent to a server, and none of it is a ranked or verified record.

Levels use `xpToNext(level) = round(80 * level^1.55)` with a title band every five levels, from
Rookie to Legend. XP comes from duel rounds (correctness, a speed bonus under two and four seconds,
a difficulty multiplier, an in-match combo multiplier at two or more consecutive correct answers),
match results, expedition cards and completions, first encounters with a fact, first explanation
opened, first untimed recall, saving a fact, Discovery attempts, daily quests, streak days and
achievement unlocks. Wild Rounds are decided deterministically from the round id and pay double or
triple XP; they are announced during the countdown, never after the answer.

Streaks count local calendar days on which you earned anything. A shield is granted every seventh
consecutive day, up to two, and is spent automatically to cover a missed day before the streak
resets. Three daily quests are generated from a seed made of your profile epoch and the date, so the
same device gets the same set all day; they claim themselves when complete and pay a bonus when all
three are done. Arena Rank is a device-local ladder from Bronze to Diamond whose points come from
duel results, with a floor at each tier you reach so a losing run cannot demote you. Gems are earned
from quests, levels and achievements, and are spent only when you choose to, in the Locker, on
frames, titles, banners and accent colours. There is no purchase of any kind and no real currency.

## Feel: motion, sound and effects

`lib/fx` and `components/fx` provide the feedback layer: a Web Audio engine that synthesises every
cue at runtime (there are no audio files), a pooled Canvas2D particle engine, confetti, element
shake, animated number counters, floating text, a toast stack and a focus-trapped ceremony overlay
used for level-ups, badges, stamps and streak milestones. Haptics mirror the sound layer through
`navigator.vibrate` where the browser supports it.

Sound now defaults to on but stays silent until your first tap, because browsers only allow audio
after a gesture. Settings holds independent switches for sound, volume, haptics and effects; the
effects setting offers full, reduced and off, and overrides the operating system preference in the
direction of less motion. Under reduced motion there is no shake, confetti or parallax, particle
bursts are small and short, and the 3D scenes render a single static frame. Every audio cue has a
visible twin and every colour meaning also carries an icon or a shape, so nothing depends on hearing
or on hue alone.

The live question surface is deliberately quiet. The question card is still mounted hidden until the
double animation-frame reveal marker, carries no entrance animation and causes no layout shift, the
timer track still has no transition, answer order is fixed for the round, and no renderer is mounted
inside a room. Press feedback happens on pointer down and never delays the click; the rest of the
juice waits for the settled round result.

## 3D scenes

`components/three` holds React Three Fiber scenes that are loaded only in the browser, through a
lazy wrapper, so no three.js code reaches the server bundle. The Home hero is a "knowledge core"
whose rings and brightness scale with your level; ceremonies show a reward medal; the Locker has a
Rapier physics gem tray whose WebAssembly chunk is fetched only when that section is opened. Scenes
cap device pixel ratio, pause when off-screen or hidden, dispose their resources on unmount and fall
back to static artwork when WebGL is missing or reduced motion is requested. The earlier standalone
showroom remains.

## Events and limited-time modes

`lib/events-data.mjs` holds a hand-curated calendar of real sports and science events. Every date and
result in it was found by one research pass and independently re-checked by another against a primary
or reference source, and each entry carries the URL it was checked against. It is **static data in the
repository**: there is no feed, no scores service and no results API anywhere in the app, and every
events surface says so along with the date a human last verified the list.

`lib/events.mjs` decides an event's status by whole local days (verified identical across five
timezones), groups the calendar into live, coming up and recently finished, and derives up to four
limited-time modes per month. The rotation is deterministic from the month and the dataset, so a new
month brings new modes with nothing to schedule or deploy. Each mode pairs an event with one of eight
templates — Final whistle and Mission window while something is on, Countdown and Prize watch before
it, Replay and Field report after it — and sets up that exact duel: mode, timer and topic.

Clearing a mode pays a small flat XP bonus times the template's multiplier and mints its badge the
first time only. Replaying is welcome and simply never pays the bonus twice. `pnpm exec node
scripts/events-check.mjs` reports the calendar's age, what is live, how many modes are open and which
topics are thin, and exits non-zero when the month needs a refresh; `public/product/events-calendar.md`
is the checklist for doing it.

## Investor material

`public/product/investor/` holds the seed deck (`factduel-seed-deck.pptx`, 26 slides with seven
plots), the same content as markdown for review in git, the scripts that regenerate both, and the
evidence behind every number: a bottom-up TAM/SAM/SOM, competitor figures taken from filings and
store listings, published benchmarks, a three-year model whose every figure is marked (P) as a plan
rather than a forecast, and an explicit register of what could not be verified. Claims that failed
verification are kept in their own file so they are never reused. The deck states plainly that the
product has no users and no revenue.

## Product Studio and local records

`/studio` has a Gamification tab rendering the Floodlight release record (design bible, roadmap,
decision record and research brief, generated from `public/product/gamification/*.md` by
`pnpm docs:product`) and tracks the 33 issues of the "Floodlight gamification" milestone. It also
contains current decisions, a searchable 32-observation review table
covering eight selected apps, a more than 7,500-word combined report, 73 distinct
source URLs, current and historical advisor reviews and a 73-issue roadmap. Historical v3 work
remains explicitly labeled. Status and evidence notes are browser-local and
exportable, not live telemetry or an unattended agent service. Research downloads
live in `public/product`; structured article data is in `lib/product`. Keep both
representations synchronized when editing a report.

The version-2 browser profile lives in IndexedDB (`fact-duel-player`, `profile`,
`player`). Every change reads/reduces/writes inside one transaction. BroadcastChannel
and focus refresh reconcile stored changes across tabs. The old localStorage
journal migrates once; no past awards or stable IDs are invented. At most 200
revealed rounds and 100 completed matches are retained. A separate ledger stores
up to 1,200 stable fact IDs and preserves earned awards beyond rolling history.
Client-local records are editable, not trusted rank or a global wallet.

Exports wait for initialization and prior writes, then read the latest persistent
profile. Reset clears expedition runs/stamps/scores, journal, saved facts, question issues, activity, missions and finishes while
keeping theme/sound preferences and room coins. Seat generations, captured before
create/join, reject old room observations after reset without comparing clocks.
A successful reset authoritatively replaces any ahead-of-storage temporary branch;
a failed previously persistent reset leaves the state and explains the failure.
Opening blocked storage falls back after four seconds. Visit-only fallback is
visible and exportable. No cross-device sync or import/restore UI is shipped.

The current release gate is 94 automated tests, the browser invariant gate, TypeScript checking and
the production build; exact results are in `public/product/expeditions/verification.md`. The rivalry advisor independently inspected the changed source and repair paths;
the earlier v4 review independently ran 15 targeted tests. No physical-device,
assistive-technology, GPU or WAN QA is claimed. Demand, content depth and production
capacity remain observed gates. Private access and simulated coins are unchanged.

## Current expedition release

The current design and technical decision record is `public/product/expeditions/decision-record.md`, also rendered in Studio. The seven-source research panel, two advisor passes, repair record and verification accompany it. Current roadmap: 73 issues, 38 marked done. This adds a coherent solo loop; it does not expand the question bank or claim observed retention gains.

`lib/expeditions.mjs` owns public manifests, signed scoring and pure local progression. The profile transaction stores one frozen six-card snapshot per route, first/best/latest summaries and explicit completion. Epoch/run/index guards cover reset, duplicate writes, partial resume and concurrent tabs. Expedition API responses deliberately contain open teaching answers; active live-room projections remain separate. These device-local records are not an anti-cheat or remote account system.

Current validation and unobserved browser/device/WAN gates are in `public/product/expeditions/verification.md`.

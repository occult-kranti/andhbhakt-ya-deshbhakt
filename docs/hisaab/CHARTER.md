# HISAAB DO — project charter

> **Latest duel-first amendment — 27 September 2026:** The owner’s current request supersedes older bot, label, art and advertising rules in this document. Competitive play is human-only, with separate clearly labelled learning practice. The permanent ladder ends in **Deshbhakt**; **Certified Anti-National** is the hidden temporary honour. Optional server-accounted **UPI tax savings** stakes default to zero; qualifying featured files earn ×10 completion rewards, never a multiplied pot. Profile-photo certificates use an original satirical Modi-inspired cartoon. Approved interstitials are requested only after completed receipts, between games. Bank inventory counts are not shown. Implement and push `feat/hisaab-human-duels-certificates` without merging or changing production. See `editions/hisaab/PRODUCT.md` and `docs/hisaab/review/DUEL-FIRST-PANEL.md` for the current contract. Historical sections below remain a record, not the current instruction where they conflict.


> **Current hosting instruction — 27 September 2026:** Use GitHub Pages at https://occult-kranti.github.io/fact-duel/hisaab/ for the public game. The owner does not want ChatGPT Sites hosting. Publish future frontend updates only through the HISAAB Pages workflow; Supabase remains the multiplayer backend. Keep `main` and the other game unchanged. Earlier Sites references are historical.

*हिसाब दो — "Show us the accounts."*
*Janta ka paisa. Janta ka sawaal.* (The people's money. The people's question.)

Owner of this document: the team lead. Every agent working on the edition reads it first. When this
file and any other instruction disagree, this file wins; flag the conflict in your report.

## Current product amendment — 27 September 2026

The owner requested this edition update on `claude/loving-pasteur-s8xwtf`; **do not merge it into
`main`**. The following changes supersede the older confidence and visual specifications below
and in the original design working card:

- Replace the Shayad / Lagta hai / Pakka choice with a stopwatch. Correct answers earn base answer
  XP of 30 below 8,000 ms; 20 from 8,000 through 14,999… ms; 10 at 15,000 ms and above. Wrong
  answers earn zero base answer XP. Existing separately named progression rewards remain explicit.
- Keep every game mode and the sourced receipt, ladder, Vault, money ledger, bilingual UI, theme,
  settings, sharing, and reduced-motion support. Daily/files have no answer deadline. Duels use a
  30-second answer window; Pass & Play remains casual and does not award either person's profile.
- Add friends/family circles with private invite links and a personal nickname for each circle.
  Stored membership is on the device; connected peers are live, self-reported, and casual. Do not
  imply a central account, verified leaderboard, offline message service, or guaranteed NAT traversal.
- Develop the existing file-and-receipt identity with original newspaper/magazine elements: cream
  paper, ink, restrained violet, editorial headings, rules, and clear columns. This authorizes serif
  Latin editorial headings and sharper page geometry; preserve readable Hindi and quiet questions.
- Prepare optional labeled AdSense placements below non-playing content. Ads are off by default,
  never inside a question or ahead of its receipt, and cannot activate without real publisher
  configuration and required approval/consent. Domain setup and ad activation are separate tasks.

The evidence, privacy, bot-labeling, storage-isolation, and no-secrets requirements still apply.
The question bank is preserved in this product update; its historical audits are not a fresh
fact-check of every source.

### Immediate feedback and standalone publication amendment

- A valid bot answer submission resolves the round immediately using the bot's independently
  precommitted choice and duration. Do not wait out unused clock time or reroll the opponent.
- A human player's locked answer receives a private personal receipt immediately. The shared
  verdict waits only for the other answer or deadline. Never disclose the key to an unanswered
  seat or mark provisional feedback as a winner or earned XP. A private receipt is permitted
  before `round.result`; the still-answering opponent's surface stays quiet and unrevealed.
- A labeled Settings action remains available throughout duel/pass phases. Its modal may change
  existing sound/theme preferences and offer a separate quit confirmation. Opening it does not
  pause a multiplayer clock; it must suppress underlying answer shortcuts and preserve focus.
- Preserve the approved light palette. Improve the dark palette as a warm charcoal-violet Night
  edition with legible layered paper surfaces and consistent HISAAB DO identity on every page.
- Publish HISAAB separately from the original FACT//DUEL Site. Keep the GitHub branch and Pages
  edition available; do not overwrite the original hosting identity or merge to `main`.
- Cloud accounts, cross-device progress and centrally stored circle rosters are not implied by
  static hosting. Document any unavailable services and browser-origin data boundaries plainly.

## 1. What we are building

### Server competition amendment — 27 September 2026

The owner subsequently requested online server-refereed play, competitions and a hidden ninth
label. These requirements supersede the earlier static-only limits for the new **Online beta**
mode, while preserving every existing solo and casual mode:

- Use the connected Supabase project through HISAAB-only tables and functions. Do not modify
  unrelated applications using that project. Server timestamps, answer locks and transactions
  determine online outcomes; browser XP and claimed client times never determine rankings.
- Add public matchmaking, private friend rooms, daily and weekly tables, tournament play and
  centrally stored circles with personal group nicknames. Distinguish guest device identities from
  verified accounts. No paid entry, cash prizes, hidden bot fills or automatic rematch queues.
- Reserve presentation slot **9** for **Desh Bhakt**, a temporary top-ten competition honour. Keep
  it entirely out of unearned ladders and public marketing teasers. Server eligibility, current rank
  and competition expiry determine whether it appears. The existing final permanent label becomes
  presentation slot **10**; its XP threshold and all nine earned progression bands stay unchanged.
- Preserve Day and Night. Restore the preceding palette as Classic and provide optional daily
  edition rotation that remains fixed during a visit, including across live rounds.
- Be precise about fairness: server authority prevents a client from assigning its own score, but
  does not remove network delay, guest-identity abuse, collusion or lookup of the public learning
  bank. This release is recreational online beta; broader competition needs measured operations
  and stronger abuse controls. Display the actual timing policy and do not promise cheat-proof play.
- Keep the independent HISAAB hosting identity and branch. Do not merge `main`, overwrite the
  original game's Site, publish social messages, buy services or enable advertising as a side effect.

See `SERVER-LAUNCH.md` and the server implementation for exact competition periods, qualifying
matches, time rules, guest data handling and the evidence collected before publication.

A second edition of the Jaanta Hai Kya (JHK) quiz-duel engine, about the last 5–12 years of Indian
public life: government schemes, subsidies and benefits, where public money went, the scams and
frauds around it, the people and institutions involved, and who owns the news that told you about
it. It reuses JHK's engine (duel service, practice bot, rounds and verdict rules, progression,
streaks, quests, journal/vault, expeditions) and ships a **completely new design**.

It deploys as its own GitHub Pages site next to JHK: `https://occult-kranti.github.io/fact-duel/hisaab/`.
Its independent public address is `https://hisaab-do.whatswrong-inc.chatgpt.site`. The original
FACT//DUEL Site and its root hosting manifest belong to the other game and must remain separate.

### The joke that carries the product

Your rank is a label — the ones Indian TV, WhatsApp and Reddit throw at people. You start as an
**Andhbhakt** (blind devotee — of anyone) and, receipt by receipt, you earn your way to
**Certified Anti-National** — the label you get for asking where the money went. The satire is
aimed at *labelling* and at *blind devotion*, never at a religion, caste, region or community, and
never at an individual private citizen.

The nine rungs map 1:1 onto the engine's nine title bands (`lib/progression.mjs` `LEVEL_TITLES`,
band = floor(level / 5)):

| band | levels | label | one-liner (draft — design lane may polish, not reorder) |
|---|---|---|---|
| 0 | 1–4 | Andhbhakt | Forwards first. Reads never. |
| 1 | 5–9 | WhatsApp University Fresher | Enrolled. Attendance: every group. |
| 2 | 10–14 | Prime-Time Loyalist | Knows the anchor's voice better than the budget. |
| 3 | 15–19 | Neutral Uncle | "Sab chor hain." Has not checked which ones. |
| 4 | 20–24 | Receipt Maango | Has started asking for the bill. |
| 5 | 25–29 | RTI Warrior | Files questions. Waits 30 days. |
| 6 | 30–34 | Urban Naxal (as per the forwards) | Reads CAG reports on the metro. |
| 7 | 35–39 | Tukde-Tukde Gang | Counts crores in tukdas. |
| 8 | 40+ | Certified Anti-National | Knows where the money went. Asks anyway. |

## 2. Non-negotiables (legal, honesty, safety)

These are release gates. A violation is a P0 finding in review.

1. **Every question is sourced.** `sourceUrl` must be a page that states the fact. Preferred
   order: court judgment/order, CAG report, Parliament answer (sansad.in / PIB), official data (ECI,
   RBI, indiabudget.gov.in, PRS), agency press release (CBI/ED/SEBI), then an established outlet
   (The Hindu, Indian Express, Hindustan Times, Times of India, NDTV, Scroll, The Wire, The Print,
   Reuters, BBC, Mint, Business Standard, Economic Times, Deccan Herald, The News Minute,
   Newslaundry, Alt News/BOOM/Factly for fact-checks). Wikipedia is acceptable only as a second
   source, never the only one for a claim about a named person.
2. **Legal status, dated, exactly.** Any item about wrongdoing states status precisely and with an
   `asOf` month: *alleged by X* / *FIR registered* / *arrested* / *chargesheeted* / *on bail* /
   *acquitted* / *convicted* / *case closed* / *court dismissed the petition*. **Never imply guilt
   of anyone not convicted.** Stems say "was named in", "was arrested by", "the CAG flagged",
   "Hindenburg Research alleged" — not "stole", "looted", "the corrupt minister".
3. **The other side's answer is part of the fact.** Where a person, company or government denied
   or contested the claim, or a court/agency cleared them, the explanation says so in one clause.
4. **Distractors never smear.** In a question whose answer is a person accused of something, the
   wrong options must NOT be other real, living, identifiable people. Ask for a role, party, state,
   agency, year, amount or scheme instead, or rephrase so all four options are non-person values.
5. **Balance across parties.** The Centre since 2014 is NDA-led, so central items will reflect
   that — that is proportionality, not bias. State lanes cover whichever party governed. Each lane
   records `govt` on every item; the review lane audits the distribution and flags any lane where
   one side is only ever the villain in cases where the record shows otherwise.
6. **No communal, caste or religious targeting; no hate speech; no slurs** against groups. Political
   labels that are the point of the satire (Andhbhakt, Anti-National, Urban Naxal, Tukde-Tukde,
   WhatsApp University, Godi Media, IT Cell, Neutral Uncle) are allowed. Group slurs are not, even in
   research notes (describe them abstractly: "a slur for X supporters").
7. **No private individuals.** Public office holders, candidates, public companies and their
   named executives acting in public matters only.
8. **No invented numbers, no invented presence.** Every figure comes from the source. Bots are
   labelled BOT. Live counts are real or absent. Coins are free and simulated.
9. **No State Emblem, no party symbols, no real logos** of parties or media houses in the art.
   Text names are fine; marks are not.
10. **Secrets never enter the repository.** Research credentials live in environment variables
    only; nothing under `docs/`, `scripts/` or `editions/` may contain a key, password or token.

## 3. The question schema (edition bank)

Every bank file is an ES module in `editions/hisaab/bank/` exporting one frozen array. Items keep
the JHK shape (so the engine deals them unchanged) plus edition fields:

```js
export const HISAAB_SCHEMES = Object.freeze([
  {
    id: 'hsc001',                  // /^h[a-z]{2}\d{3}$/ — prefix = lane (see §4), unique across all lanes
    domain: 'civics',              // always 'civics'
    region: 'India',               // always 'India' (engine field)
    state: 'IN',                   // 'IN' for national/central, else a state code from §5
    topic: 'Welfare & Subsidies',  // one of the SECTORS in §5, exactly
    subtopic: 'PM-KISAN',          // the scheme, case, outlet or institution — short
    kind: 'scheme',                // 'scheme' | 'spend' | 'scam' | 'media' | 'funding' | 'forward' | 'institution'
    difficulty: 'simple',          // 'simple' (headline fact) | 'expert' (followed the news) | 'extreme' (numbers/dates)
    year: 2019,                    // year the fact happened
    asOf: '2026-09',               // month the status in this item was last verified
    govt: 'NDA',                   // who governed at that level then: NDA, UPA, BJP, INC, AAP, TMC, DMK, AIADMK,
                                   // YSRCP, TDP, BRS, BJD, JMM, RJD, JDU, SP, BSP, SS, NCP, LDF, UDF, SKM, MNF,
                                   // NDPP, NPP, ZPM, CPI(M), President's Rule, Other
    question: '…',                 // ≤ 220 chars, plain English, no answer text inside it
    options: ['…', '…', '…', '…'], // four distinct, plausible, similar length; see §2.4
    correctIndex: 0,               // 0–3, spread evenly across the lane
    explanation: '…',              // ≤ 420 chars: the fact, its status as of asOf, the counterpoint if any
    status: '…',                   // REQUIRED when kind is 'scam' or a person is named: legal status line
    people: ['…'],                 // names of public persons mentioned anywhere in the item (audit only)
    sourceUrl: 'https://…',        // the page that states the answer
    sourceLabel: '…',              // "Publisher — title (date)"
    sources: ['https://…'],        // optional further URLs
  },
]);
```

### 3a. Optional fields (the money trail)

```js
    tags: ['distribution', 'pre-election'],     // modes: 'distribution' | 'relief' | 'pre-election'
    enactedBy: [{ name: 'Shivraj Singh Chouhan', role: 'Chief Minister, Madhya Pradesh', party: 'BJP' }],
    outcome: '…',                               // 20–320 chars: reach, cost, audit, election result
    otherSide: '…',                             // 10–240 chars: the denial, clearance, acquittal or official
                                                // reply in one clause — the receipt's OTHER SIDE row
    poll: { label: 'MP Assembly 2023', month: '2023-11', gapDays: 160, result: 'BJP won 163 of 230' },
                                                // required when tagged 'pre-election'; gapDays = days
                                                // from the announcement/first payment to polling day
```

Rules the test suite (`tests/hisaab-bank.test.mjs`) will enforce: unique ids and question text
across all lanes; four distinct options; answer text not contained in the question; `correctIndex`
spread (each slot > 1/8 of a lane); each difficulty ≥ 25% of every lane; `https` sources;
`status` present on every `scam` item and every item with `people`; `asOf` matches `/^20\d\d-\d\d$/`;
`topic` ∈ SECTORS; `state` ∈ STATES.

## 4. Lanes (content), id prefixes and targets

| lane | prefix | file | target | scope |
|---|---|---|---|---|
| Schemes & benefits | `hsc` | `bank/schemes.mjs` | 60 | Central schemes, subsidies, DBT, what they promised, what audits/Parliament found |
| Budget & spending | `hbx` | `bank/spending.mjs` | 50 | Union budget, subsidy bill, debt, capex, flagship project costs, ads, PM CARES, demonetisation, GST |
| Scams & accountability | `hgh` | `bank/scams.mjs` | 60 | National frauds and cases, agencies (CBI/ED/Lokpal/SEBI), conviction data, defections under probe |
| States — North & Hindi belt | `hst` 100–199 | `bank/states-north.mjs` | 60 | UP, UT, HP, PB, HR, DL, JK, RJ, BR, JH — ≥ 6 each |
| States — West & South | `hst` 200–299 | `bank/states-west-south.mjs` | 60 | GJ, MH, GA, MP, CT, KA, KL, TN, AP, TG — ≥ 6 each |
| States — East & North-East | `hst` 300–399 | `bank/states-east.mjs` | 50 | WB, OD, AS, AR, MN, ML, MZ, NL, SK, TR — ≥ 4 each, ≥ 6 for WB/OD/AS |
| Media & speech | `hmd` | `bank/media.mjs` | 45 | Who owns which outlet and their political links, press freedom, govt ad spend, raids on media |
| Elections & money | `hel` | `bank/elections.mjs` | 50 | Electoral bonds and donors, party income, criminal cases of legislators, defections, ECI |
| Forward Court | `hfw` | `bank/forwards.mjs` | 40 | Viral claims from all sides and what fact-checkers found |

Each lane also writes `docs/hisaab/research/<lane>-notes.md`: sources used, items dropped and why,
and anything the reviewer should double-check.

### 4a. The money trail, 2000–2026 (added by the owner, 25 Sep 2026)

Three modes follow public money handed out directly — who passed it, which party, and what
happened next — across **26 years (2000–2026)**, Centre and states:

| lane | prefix | file | target | scope |
|---|---|---|---|---|
| Distribution — Centre | `hdb` 001–099 | `bank/dist-centre.mjs` | 45 | Central cash and in-kind transfers: MGNREGA wages, JSY, PM-KISAN, PMGKAY, COVID cash to Jan Dhan women, LPG DBT, pensions, loan waivers |
| Distribution — North & Hindi belt | `hdb` 100–199 | `bank/dist-north.mjs` | 45 | UP, UT, HP, PB, HR, DL, JK, RJ, BR, JH — women's cash schemes, girl-child transfers, cycles/laptops/phones, pensions, farm transfers |
| Distribution — West & South | `hdb` 200–299 | `bank/dist-west-south.mjs` | 45 | GJ, MH, GA, MP, CT, KA, KL, TN, AP, TG — Ladli Laxmi/Ladli Behna, Ladki Bahin, Gruha Lakshmi, Magalir Urimai, Rythu Bandhu/Bharosa, Amma Vodi, TN TVs/mixers… |
| Distribution — East & North-East | `hdb` 300–399 | `bank/dist-east.mjs` | 35 | WB, OD, AS, AR, MN, ML, MZ, NL, SK, TR — Kanyashree, Lakshmir Bhandar, KALIA, Subhadra, Orunodoi… |
| Relief funds — Centre | `hrf` 001–099 | `bank/relief-centre.mjs` | 40 | PMNRF, PM CARES, NDRF/SDRF and Finance Commission disaster money, national disaster and COVID packages |
| Relief funds — States | `hrf` 100–199 | `bank/relief-states.mjs` | 35 | CM relief funds, Centre–state relief disputes, disaster packages, misuse and audit findings |
| Before the vote — Union | `hpe` 001–099 | `bank/poll-union.mjs` | 40 | Interim budgets, pre-poll announcements, bills and notifications in the months before Lok Sabha polls |
| Before the vote — States | `hpe` 100–199 | `bank/poll-states.mjs` | 50 | Pre-poll transfers, sops, budgets and bills before Assembly polls, and each result |

These lanes use the optional fields in §3a and tag every item into its mode(s).

### 4b. Rules specific to the money trail

1. **Naming who passed it is encouraged.** Announcing, presenting or passing a scheme, budget or bill
   is a public act, not an allegation: record it in `enactedBy` (name, role, party). For "who
   launched / presented / passed" questions, other real office-holders may be distractors — this is
   the one exception to §2.4, and it never extends to a question about wrongdoing.
2. **Timing is a fact; motive is not.** "Announced 47 days before polling" and "first instalment paid
   before the Model Code of Conduct" are facts. "Vote-buying", "bribe", "freebie" or "revdi" as a
   description is an opinion — attribute it to whoever said it, with their reply or a court's view.
3. **Results are the point.** `outcome` states what happened: reach, cost, audit findings,
   ineligible beneficiaries removed, and, for pre-poll items, the official election result. Say
   what caused the result only if a named study, survey or court says so, and cite it.
4. **Every party.** Handouts before elections are made by every party in power; each lane covers
   whoever governed, and the notes record the `govt` distribution.

## 5. Controlled vocabularies

**SECTORS** (`topic`): `Welfare & Subsidies`, `Farm & Food`, `Health`, `Education & Exams`,
`Infrastructure`, `Banking & Finance`, `Energy & Mining`, `Defence & Security`,
`Elections & Funding`, `Media & Speech`, `Governance & Institutions`, `Jobs & Economy`,
`Environment & Land`.

**STATES** (`state`): `IN` (national/central), `UP`, `UT` (Uttarakhand), `HP`, `PB`, `HR`, `DL`, `JK`,
`RJ`, `BR`, `JH`, `GJ`, `MH`, `GA`, `MP`, `CT` (Chhattisgarh), `KA`, `KL`, `TN`, `AP`, `TG`
(Telangana), `WB`, `OD`, `AS`, `AR`, `MN`, `ML`, `MZ`, `NL`, `SK`, `TR`.

## 6. Game modes (engine mapping)

| mode | what the player does | engine |
|---|---|---|
| **Aaj Ka Hisaab** (daily) | 5 questions, same for everyone that day | expedition-style run, date seed |
| **Rajya Rounds** (state-wise) | pick a state on the map → a 6-card route | expeditions, one route per state |
| **Sector Files** (sector-wise) | pick a sector file → a 6-card route | expeditions, one route per sector |
| **Kiska Media?** | media ownership and speech | route over `Media & Speech` |
| **Forward Court** | rule on viral forwards | route over `kind: 'forward'` |
| **Duel vs Bot** | Quick Draw / Triple Threat / Gauntlet vs the labelled practice bot | duel service in-process |
| **Duel a Friend** | same formats, peer-to-peer room code (no server) | P2P transport, same verdict rules |
| **Pass & Play** | two players, one phone, untimed | local |
| **Seedha Khaate Mein** (straight into the account) | cash and in-kind transfers 2000–2026 — who passed them, which party, what happened | route over `tags: 'distribution'`, filterable by state and year |
| **Rahat Kosh** (relief fund) | relief funds and disaster money — raised, released, disputed, audited | route over `tags: 'relief'` |
| **Chunav Se Pehle** (before the vote) | what was announced, paid or passed in the months before an election, and the result | route over `tags: 'pre-election'`, with the poll countdown on each card |
| **Saal-dar-Saal** (year by year) | pick a year 2000–2026 → that year's cards across all lanes | route over `year` |

## 7. Notification budget (fewer than JHK)

At most **one** transient toast per screen visit; **no** streak nags or "come back" prompts;
ceremonies only for a label promotion and a completed state/sector file; everything else is a quiet
in-place update. No sound until first tap. Settings can silence all of it.

## 8. Repository layout

```
editions/hisaab/            the edition: entry, config, screens, theme, bank, p2p
editions/hisaab/bank/       content lanes (one file per lane) + index.mjs registry
docs/hisaab/                charter, roadmap, design bible, research, reviews
tests/hisaab-*.test.mjs     edition tests
vite.config.hisaab.ts       the edition build → dist-hisaab/
.github/workflows/pages-hisaab.yml   publishes dist-hisaab into gh-pages/hisaab/
.claude/skills/hisaab-*     edition skills (design, editorial)
```

JHK must keep building and behaving exactly as before. Edition differences are made by aliasing
modules in the edition build or by additive, default-preserving options in shared modules.

# HISAAB DO — Design Bible: "LAL FEETA"

*हिसाब दो — Show us the accounts.* Owner: design lane (roadmap 1.11). Status: decided, September 2026.
Binding inputs: `CHARTER.md` (wins on conflict), the gamification-advisor gates N1–N14, the juice rules,
`lib/progression.mjs`. Working card for engineers: `.claude/skills/hisaab-design/SKILL.md`.
Tokens: `editions/hisaab/theme/tokens.css` (prefix `--h-`, classes `h-*`).

---

## 0. The decisions, in one screen

1. **Identity — LAL FEETA (red tape):** the *sarkari* file reprinted as a pop poster. Tappable things are
   **manila files** with typed file numbers; unopened files wear **red tape**; verdicts are **rubber
   stamps**; evidence is a **receipt**; explanations sit on the green **noting sheet**; your collection
   fills a **tijori**. On top: a **poster layer** of huge Devanagari + Latin type and one hot accent.
2. **One hot accent — SYAHI violet** (`#4a22d4` / night `#9e86ff`): stamp-pad ink, cyclostyle, the voter's
   inked finger; no party's colour. **One violet-filled button per screen = its primary action.**
3. **Fonts** (OFL, verified on npm 25 Sep 2026): display **Akshar**, UI **Mukta** 400/600, typewriter
   **Sometype Mono** 400/700 (real ₹), optional noting hand **Kalam** (lazy).
4. **Objects, not paper:** rounded corners, 2px ink outlines, hard offset shadows, flat colour. No grain,
   hairline grids, serif body or ticker — the rejected looks' signatures.
5. **The label ladder is the core progression.** Ceremonies only for a label promotion and a first-cleared
   state/sector file; everything else updates quietly in place.
6. **Every answer closes with a receipt:** stamp → source → legal status with `asOf` → the other side →
   noting. The receipt is the product.
7. **Notifications:** ≤ 1 toast per screen visit, nothing during a question, no push ever, no streak nags,
   silent until first tap.
8. **Four Rapier set pieces:** TIJORI, TARAZU, THAPPA, FILE PILE — lazy, dpr ≤ 1.5, never in a timed round.
9. **Growth:** WhatsApp-first, server-free — "Forward this — it's actually sourced": receipt cards, a daily
   grid, a certificate per rung, P2P duel links.
10. **Legal art:** no State Emblem/Chakra, no tricolour identity, no party symbols (not even emoji) or
    colours, no media logos, no India outline (tile cartogram), no government-document styling.

---

## 1. What the owner rejected and what we do instead

| Rejected ("Daily Desk", "Reading Room") | LAL FEETA |
|---|---|
| Cream newsprint / parchment page (`#F7F1E6`, `#F2EAD6`) with page-wide grain | Cool noting-sheet grey-green ground (`#e8ece1`) and flat photocopy-white paper. Grain nowhere. Texture only as small CSS halftone patches on poster moments |
| Zero radius everywhere, 1px hairlines, "cards-in-cards" editorial grid | Chunky objects: 12–16px radii, 2px ink outlines, 4px hard offset shadows; buttons press *down* into the page |
| Serif display (Fraunces, Spectral, Rozha One) + IBM Plex | Condensed sans poster type (Akshar), humanist UI sans (Mukta), typewriter mono (Sometype). Nothing from IBM Plex, no Rozha One |
| Muted brass/leather/editorial red; museum restraint | One saturated violet, plus props (manila, red tape, highlighter yellow, brass) used as objects rather than as page colour |
| Market ticker, masthead, newspaper columns | Poster headline, file covers, stamps, receipts, and a tijori that fills with physics coins |
| Seriousness as the brand | Satire as the brand, with sourcing as the proof. Funny at the top, rigorous in the receipt |

The failure mode is "paper = old": paper objects are **props on a bright, flat, modern stage** — the
page is never parchment.

---

## 2. Identity system

### 2.1 The metaphor map (use these words and objects consistently)

| Game thing | Object | Visual | Copy (EN / Hinglish) |
|---|---|---|---|
| Mode, route, state, sector | **File** (फ़ाइल) | manila cover, tab with typed `F.No.` | "Open file" / "File kholo" |
| Unstarted route | **Red tape** (लाल फ़ीता) | red ribbon band on the cover | "Sealed" / "Feeta bandha hai" |
| Starting a route | **Cutting the tape** | tape snaps and falls (endowed progress) | "Tape cut. 1 of 6." |
| Verdict | **Stamp** (ठप्पा) | rotated double-border stamp | SAHI · APPROVED / GALAT · OBJECTION / PENDING |
| Evidence | **Receipt** (रसीद) | thermal slip with zig-zag perforation | "Here's the receipt." / "Yeh rahi raseed." |
| Explanation | **Noting sheet** | pale green sheet with red margin rule | "Noting" |
| Collection | **Tijori** (safe) | glass-front steel safe filling with coins | "Your tijori: 214 receipts" |
| State picker | **Records room almirah** | 30 drawers + the Centre drawer (tile cartogram) | "Records room" |
| Practice bot | **Babu-Bot · BOT** | a clerk that stamps without reading | "Picks at random. Can't see the question." |
| Streak shield | **CL (Casual Leave)** | "CL" chip | "Missed a day. 1 CL used. Streak safe." |
| Duel rank | **Babu rank** (on this device) | LDC → Section Officer → Under Secretary → Joint Secretary → Secretary (Bronze…Diamond) | "Promoted to Under Secretary" (in place) |
| Wild Round | **Surprise Audit** ×2/×3 | brass chip on the between-round card | "Surprise Audit: ×2 XP this round" |
| Confidence calls | **Shayad / Lagta hai / Pakka** | 3-position switch showing points | Steady +2/0 · Bold +3/−1 · Called +4/−3 |
| Achievements | **Stamp Register** | silent entries on Profile | never toasted |

**Why Babu-Bot, not "Neta":** the engine's bot picks at random and cannot see the question
(`planBotAttempt`) — a clerk stamping without reading is exact, funny and honest. A "Neta" opponent makes
every loss "the politician wins", a partisan-feeling frame. TARAZU pans read **JANTA** vs **BABU-BOT**
(or two player names).

### 2.2 The poster layer

- At most **one poster line** per screen (`--h-fs-poster`, Akshar 700): Devanagari above in
  `--h-syahi-text`, Latin caps below in `--h-ink`. Slogans, never data: *जनता का पैसा। / JANTA KA SAWAAL.*
- Optional: a **highlighter swipe** (`--h-marker`) behind one word, once per visit; a riso **overprint**
  (`text-shadow: 3px 3px 0 var(--h-syahi-soft)`) on the Latin line.

### 2.3 Voice

Deadpan sarkari satire aimed at **institutions, labels and blind devotion** — never at the player's
politics, a party's voters, or any religion, caste, region or community. English base; Hinglish lines in
**Latin script** (the English locale never loads Mukta's Devanagari file); Hindi locale UI in Devanagari
(bank stays English until phase 5). Jokes live in empty states, loading lines and one-liners; stems,
receipts and status lines are plain and exact. **Nothing funny happens inside a receipt.**

### 2.4 Legal and political art rules (release gates, charter §2.9)

- No State Emblem, Ashoka Chakra motif, "Satyamev Jayate" lock-up, or tricolour/saffron-white-green
  identity. No "Government of India / भारत सरकार" text, seals or letterhead imitation — the certificate
  says **"Satire. Not a government document."**
- No party symbols in art, icons **or emoji** — banned: lotus 🪷, hand ✋, broom 🧹, bicycle 🚲, elephant 🐘,
  clock ⏰, bow-and-arrow 🏹, lantern 🏮, hammer-and-sickle ☭, rising sun 🌅, kite 🪁, two leaves 🌿. Share grids
  use ✅ ❌ only; when unsure, no emoji.
- No party colours as identity or teams; `govt` is a **neutral text chip** (`Govt then: NDA`) for everyone.
- No media logos, masthead lettering or brand colours; outlet names are set in our mono.
- No India outline — the tile cartogram (§11.3). No photos, caricatures or silhouettes of real people.
- Agency names (CAG, CBI, ED, SEBI, ECI) appear only as a **source-type chip on a receipt sourced to that
  agency**. We never slam a "CBI" stamp on anything — a stamp implies an action (a deliberate refinement
  of the brief's "CAG / CBI stamps").

---

## 3. Colour

### 3.1 Roles (60 / 30 / 10)

- **60% stage** (ground, paper, sheet, receipt) · **30% objects and ink** (manila, ink, ground-2) · **10% signal**
  (`--h-syahi`: primary action, selection, progress, focus).
- **Props** (tape, marker, brass) are metaphor and never carry meaning alone. **Verdicts** (pass APPROVED,
  fail OBJECTION, wait PENDING, noted = syahi) always come with a word and an icon.
- **Legal status** uses **one neutral pair** (`--h-legal`) for every status — ALLEGED is not red, ACQUITTED
  is not green. Colour must never imply guilt (charter §2.2).

### 3.2 Palette (light "Daftar by day" / dark "File room at night")

| token | light | dark | use |
|---|---|---|---|
| `--h-ground` | `#e8ece1` | `#121019` | page |
| `--h-ground-2` | `#dce2d2` | `#1c1926` | wells, option tab, skeleton |
| `--h-paper` | `#fbfbf6` | `#221e2d` | cards, options, sheets |
| `--h-sheet` | `#e2efd8` | `#18251e` | noting sheet (explanations, rules) |
| `--h-receipt` | `#ffffff` | `#2a2635` | receipts; certificate (always light when exported) |
| `--h-manila` / `-2` / `-ink` | `#e6c78c` / `#d4ac62` / `#1f1608` | `#3d3223` / `#5c4a2c` / `#f6ebd3` | files |
| `--h-ink` / `-2` / `-3` | `#17131f` / `#45414f` / `#75717f` | `#f3f0e8` / `#bcb7c8` / `#8c8799` | text; `-3` is UI-only |
| `--h-line` | `#17131f` | `#8e88a0` | 2px object outlines |
| `--h-syahi` / `-text` / `-soft` / `-ink` | `#4a22d4` / `#4a22d4` / `#e4ddff` / `#fff` | `#9e86ff` / `#b3a1ff` / `#2b2352` / `#120c2b` | the hot accent |
| `--h-tape` | `#cf2a1f` | `#ff5a4e` | red tape |
| `--h-marker` | `#ffe45c` | `#5e4d00` | highlighter behind ink text |
| `--h-brass` / `-text` | `#d4a12a` / `#7a5700` | `#f2c14e` / `#f5cd6a` | coins, XP |
| `--h-pass` | `#0b7a43` | `#3ed68e` | APPROVED / correct / won |
| `--h-fail` | `#c62a1f` | `#ff6a5c` | OBJECTION / wrong / lost |
| `--h-wait` | `#9a5800` | `#ffb547` | PENDING / timeout (ochre: a file gathering dust) |
| `--h-legal` / `-ink` | `#e4e2ea` / `#2e2a38` | `#2e2a3a` / `#e2deea` | every legal-status chip |
| `--h-slot-a…d` | violet / sky / manila / rose tints | deep tints | answer tab tint (third twin) |

**Why violet:** saffron, green, the tricolour, blue-yellow, BSP blue, red-green, CPI(M) red, BRS pink,
DMK red-black and TMC green-blue are party codes; violet is none of them, and the stamp pad and the
election-ink finger belong to every voter.

### 3.3 Colour-blind safety
Every colour has a non-colour twin: options = letter + shape + tint; verdicts = icon (✓ ✕ ⏳) + word +
pattern (wrong-chosen gets 135° hatching); tiles = fill + glyph; stamps are words.

### 3.4 Contrast report (WCAG 2.x, computed)
A scratch node script parses `tokens.css`, applies the WCAG relative-luminance formula and fails below
the floor: **66 pairs × 2 themes, 0 failures.** Floors: text 4.5:1; UI boundaries/focus 3:1; stamp words
3:1 (large-text floor — stamps are always ≥ 20px bold).

| foreground | on | floor | light (min–max) | dark (min–max) |
|---|---|---|---|---|
| `--h-ink` | ground, ground-2, paper, sheet, manila, receipt, marker, slot-a…d | text 4.5 | 11.23–18.27 | 7.27–16.56 |
| `--h-ink-2` | ground, ground-2, paper, sheet, manila, receipt | text 4.5 | 6.08–9.90 | 6.40–9.65 |
| `--h-ink-3` | paper, ground | UI 3.0 | 3.96–4.57 | 4.68–5.42 |
| `--h-manila-ink` | manila, manila-2 | text 4.5 | 8.39–10.98 | 7.18–10.57 |
| `--h-syahi-text` | paper, ground, manila, sheet, syahi-soft | text 4.5 | 5.23–8.19 | 5.63–8.49 |
| `--h-syahi-ink` | syahi (button label) | text 4.5 | 8.50 | 6.56 |
| `--h-syahi` | ground, paper, manila | UI 3.0 | 5.23–8.19 | 4.35–6.56 |
| `--h-pass-text` / `-ink` | paper, pass-soft / pass | text 4.5 | 5.44–6.37 / 5.41 | 7.77–9.80 / 9.18 |
| `--h-fail-text` / `-ink` | paper, fail-soft / fail | text 4.5 | 5.75–6.93 / 5.60 | 6.76–7.12 / 6.63 |
| `--h-wait-text` / `-ink` | paper, wait-soft / wait | text 4.5 | 6.17–6.96 / 5.57 | 8.87–10.42 / 9.59 |
| `--h-legal-ink` | legal | text 4.5 | 10.88 | 10.52 |
| `--h-brass-text` / `-ink` | paper, ground / brass | text 4.5 | 5.49–6.34 / 7.61 | 10.70–12.41 / 10.41 |
| `--h-tape-ink` | tape | text 4.5 | 5.24 | 6.06 |
| `--h-tape` | manila, paper | UI 3.0 | 3.22–5.05 | 4.06–5.28 |
| `--h-line` | ground, paper, manila, receipt, sheet | UI 3.0 | 11.23–18.27 | 3.68–5.55 |
| `--h-focus` | ground, paper, manila | UI 3.0 | 5.23–8.19 | 5.63–8.49 |
| `--h-pass` / `--h-fail` / `--h-wait` | paper, manila, receipt, sheet (stamps) | large 3.0 | 3.33–5.60 | 4.45–9.25 |

Consequences: `--h-ink-3` never carries words a player must read; stamps on **manila** are ≥ 24px bold
(light-theme stamps on manila measure 3.3–3.4:1).

---

## 4. Typography

### 4.1 Families (verified 25 Sep 2026 via `npm view` and the Fontsource API; glyphs checked with fontTools)

| role | family | why | coverage / notes |
|---|---|---|---|
| **Display** | **Akshar** (variable 300–700) | condensed poster grotesque with modern conjuncts (क्त, द्ध) — Teko's stacked ligatures read as "क्क" on phones; 46 KB Devanagari + 20 KB Latin for all weights | ₹ in latin-ext/devanagari; proportional digits — never for counters |
| **UI / body** | **Mukta** 400, 600 | humanist, large x-height, best Hindi UI readability we tested; Latin has `tnum` | use `tabular-nums` for scores |
| **Typewriter** | **Sometype Mono** 400, 700 | typewriter DNA and a real ₹ (Courier Prime has none); 9 KB per weight | **No monospace on Fontsource covers Devanagari (all 62 Devanagari families checked)** — mono slots hold Latin codes, digits and ₹ only; the stack falls back to Mukta |
| Noting hand (optional) | **Kalam** 400 | the babu's marginal note ("Noted. Pl. forward.") | lazy; certificate, share cards, noting sheet; one line per screen |

Rejected: Teko (conjuncts), Anek Devanagari (726 KB Devanagari file for its width axis), Baloo 2 (kids'
ed-tech), Rozha One and IBM Plex (the rejected designs), Google Sans (someone else's brand), Courier Prime (no ₹).

### 4.2 Fonts to install (engine lane runs this; the design lane does not touch `package.json`)

```sh
pnpm add @fontsource-variable/akshar@^5.3.0 @fontsource/mukta@^5.3.0 @fontsource/sometype-mono@^5.3.0 @fontsource/kalam@^5.3.0
```

```ts
// editions/hisaab entry (eager): only these five stylesheets
import '@fontsource-variable/akshar/wght.css'; // family 'Akshar Variable', wght 300–700
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/600.css';
import '@fontsource/sometype-mono/400.css';
import '@fontsource/sometype-mono/700.css';
// lazy, when the certificate / a share card / a noting-hand line first renders:
//   await import('@fontsource/kalam/400.css'); await document.fonts.load("400 18px Kalam");
```

Import the **weight files** (`400.css`), not per-subset files: each declares devanagari → latin-ext → latin,
and overlapping `unicode-range` faces are matched in reverse order, so ₹ (U+20B9) resolves to the small
**latin-ext** file — an English screen never fetches a Devanagari file just to draw ₹. Self-hosted: no
third-party request, works offline.

**Budget (woff2):**

| session | files | total |
|---|---|---|
| English | Akshar latin 20.1 + latin-ext 4.2 + devanagari 46.1 (poster lines) · Mukta latin 20.0 + 20.7 · Sometype latin 9.5 + 9.4 + latin-ext 6.6 + 6.5 · (Mukta latin-ext 14.3 + 14.6 only if ₹ appears in UI text) | **≈ 143 KB** (≈ 172 KB) |
| Hindi | English set + Mukta devanagari 97.0 + 100.2 | **≈ 370 KB** |
| Kalam (lazy) | latin 21.8 + latin-ext 11.9 (+ devanagari 106.8 in Hindi) | 34 KB (141 KB) |

Preload only `akshar-latin-wght` and `mukta-latin-400`; `font-display: swap` everywhere; fallback stacks in `tokens.css`.

### 4.3 Scale and use

| token | px | family / weight | use |
|---|---|---|---|
| `--h-fs-poster` | clamp 44–96 | display 700 caps | the one poster line |
| `--h-fs-5xl` | 64 | display 700 | certificate label, verdict word (desktop) |
| `--h-fs-4xl` | 48 | display 700 | verdict word (phone), label on Profile |
| `--h-fs-3xl` | 38 | display 700 | screen title |
| `--h-fs-2xl` | 30 | display 700 | file title, label on cards |
| `--h-fs-xl` | 24 | display 600 | card titles, stamp words |
| `--h-fs-stem` | clamp 20–26 | UI 600 | question stem |
| `--h-fs-m` / `-l` | 18 / 20 | UI 400/600 | options, lead |
| `--h-fs-s` | 16 | UI 400 | body, inputs (iOS zoom floor) |
| `--h-fs-xs` | 14 | UI 400 / mono 400 | meta, receipt lines; **floor for any sentence** |
| `--h-fs-2xs` | 12 | mono caps / UI 600 | kickers, tab labels, chips only (never a sentence) |

Latin display is always uppercase (`--h-lh-caps: .95`). Any display line containing Devanagari uses
`--h-lh-display-deva: 1.25`. Numbers that change (score, XP, timer) use Sometype Mono or Mukta with `tnum`.

### 4.4 Devanagari rules
1. **Never letter-space Devanagari** (it breaks the shirorekha): tracking only on Latin/`:lang(en)`;
   `letter-spacing: 0` on `:lang(hi)`.
2. No Devanagari in the mono face — mono is for codes (`F.No. S/UP/06`), digits and ₹.
3. Line height ≥ 1.25 display / 1.6 body (`:root[lang='hi']` swaps tokens). Don't set `line-height` on
   strings that wrap in Hindi; never `overflow: hidden` a text-tight box (matras clip).
4. Devanagari spans inside English screens get `lang="hi"`.
5. Latin digits in both locales, grouped `Intl.NumberFormat('en-IN')`; lakh/crore in both (`₹1.2 lakh
   crore` / `₹1.2 लाख करोड़`); `asOf` renders "as of Sep 2026".
6. Correct nukta and chandrabindu (फ़ाइल, माँगो); a Hindi reader reviews strings before release.
7. `word-break: normal`; `overflow-wrap: anywhere` only on URLs and codes. Budget ~30% more width for
   Hindi; buttons wrap to two lines, never truncate.

### 4.5 The nine labels (display set, Devanagari over Latin)

| band | Devanagari | Latin | one-liner (EN) | Hinglish line |
|---|---|---|---|---|
| 0 | अंधभक्त | ANDHBHAKT | Forwards first. Reads never. | "Forward pehle, padhna kabhi nahi." |
| 1 | व्हाट्सऐप यूनिवर्सिटी फ़्रेशर | WHATSAPP UNIVERSITY FRESHER | Enrolled. Attendance: every group. | "Admission ho gaya. Har group mein hazri." |
| 2 | प्राइम-टाइम लॉयलिस्ट | PRIME-TIME LOYALIST | Knows the anchor's voice better than the budget. | "Anchor ki awaaz yaad, budget nahi." |
| 3 | न्यूट्रल अंकल | NEUTRAL UNCLE | "Sab chor hain." Has not checked which ones. | "Sab chor hain — kaun, yeh check nahi kiya." |
| 4 | रसीद माँगो | RECEIPT MAANGO | Has started asking for the bill. | "Ab bill maangne lage ho." |
| 5 | आरटीआई योद्धा | RTI WARRIOR | Files questions. Waits 30 days. | "Sawaal file karo. 30 din ruko." |
| 6 | अर्बन नक्सल | URBAN NAXAL *(as per the forwards)* | Reads CAG reports on the metro. | "Metro mein CAG report padhta hai." |
| 7 | टुकड़े-टुकड़े गैंग | TUKDE-TUKDE GANG | Counts crores in tukdas. | "Crore ko tukdon mein ginta hai." |
| 8 | सर्टिफ़ाइड एंटी-नेशनल | CERTIFIED ANTI-NATIONAL | Knows where the money went. Asks anyway. | "Paisa kahan gaya, pata hai. Phir bhi poochta hai." |

A label always appears with its one-liner. The first Andhbhakt sighting adds **"Everyone starts here —
of anyone, for anything. Receipts get you out."**, keeping the rung about reading habits, not party.

---

## 5. Shape, surface and components (`h-*`)

**Global:** radii `--h-r-m` 12 (controls), `--h-r-l` 16 (files/cards), `--h-r-xl` 24 (sheets/ceremony);
outlines `--h-bw` 2px `--h-line`; shadows are hard (`--h-shadow-2` = 4px 4px 0). Blur shadows
(`--h-shadow-float`) and `backdrop-filter` are allowed only on overlays. Mobile first; breakpoints 600 / 900
(bottom bar ↔ rail) / 1200. `100dvh`, never bare `vh`. Gutters 16px. No horizontal scroll.

| component | anatomy | states | notes |
|---|---|---|---|
| **`h-btn`** | 52px min height, 2px outline, `--h-r-m`, `--h-shadow-2`; label UI 600 18px, trailing → | `--primary` (syahi fill, **one per screen**), `--paper`, `--ghost` (text + underline), disabled (`--h-ink-3`, no shadow) | **Press = print down:** on `pointerdown` translate(2px,2px) and shadow → `--h-shadow-0` over `--h-dur-tap`; never delays the click |
| **`h-file`** | manila cover, top-left tab (mono `F.No.`), title display 30px, meta UI 14px, optional meter, optional tape | `sealed` (tape band), `open` (meter), `cleared` (✓ CLEARED stamp in corner, syahi tab), `pressed` (manila-2) | the tappable unit for modes, routes and states; a whole-card link with ≥ 44px targets inside |
| **`h-tape`** | 12px red band across the lower third (cards) or bottom edge (tiles), never over text | idle / snapping (two halves rotate ±12° and fall, `--h-ease-tape`) | snapping plays once, on the first card of a route |
| **`h-opt`** (answer) | 60px min, paper, 2px outline, `--h-r-m`; left tab 52px holding letter (A/क) over shape glyph (▲◆●■) on `--h-slot-*`; label UI 18px | `idle`, `pressed`, `locked` (3px syahi ring + 🔒 "Locked"), `correct` (3px pass outline, tab pass-filled with ✓ + shape), `wrong-chosen` (tab fail-filled ✕ + shape, body hatched `--h-fail-soft`), `correct-unchosen` (dashed pass outline + ✓), `other` (opacity .55) | fixed order; `touch-action: manipulation`; `user-select: none`; keys 1–4 / A–D |
| **`h-stamp`** | display 600–700 caps, 3px border + 1.5px outline offset 2px, `--h-r-s`, rotate −6°…+8° (seeded by item id, never random per render) | `--pass` SAHI·APPROVED ✓, `--fail` GALAT·OBJECTION ✕, `--wait` PENDING ⏳, `--noted` NOTED/ISSUED/CLEARED | `mix-blend-mode: multiply` (light) / `screen` (dark); ≥ 20px, ≥ 24px on manila |
| **`h-receipt`** | receipt surface, mono 14px, rows with dashed leaders, zig-zag bottom via `mask` (tooth `--h-perf`) | printing (rows reveal top-down), static | rows: RECEIPT # · XP / SOURCE (label + ↗) / STATUS (legal chip + as of) / OTHER SIDE / GOVT THEN (chip) |
| **`h-sheet`** | `--h-sheet` fill, 2px outline, red margin rule at 18px, body UI 16px | collapsed (duels: "Read the noting") / open | explanations, rules, the Corrections page |
| **`h-chip`** | 28px, `--h-r-s`, mono 12px caps | `--legal` (neutral, every status), `--source` (COURT, CAG, SANSAD, PIB, ECI, RBI, AGENCY, PRESS, FACT-CHECK), `--govt` (neutral), `--kind` | the legal chip always pairs with an `as of` date |
| **`h-meter`** | 12px track, 2px outline, pill; syahi fill; optional tick every 1/5 (levels in a band) | animates width `--h-dur-slow` | goal-gradient copy sits beside it: "180 XP to Prime-Time Loyalist" |
| **`h-tile`** (cartogram) | square ≥ 44px, `--h-r-s`, 2px outline, display 700 code | `sealed` (manila + red tape band on the bottom edge), `progress` (manila + syahi bar, fraction), `cleared` (syahi fill + ✓ glyph top-right), `selected` (focus-ring style double ring) | the legend repeats glyphs; a list view with the same data is always one tap away |
| **`h-cert`** | receipt surface, 6px syahi hard shadow, typed header, label poster, THAPPA "ISSUED" stamp, Kalam note | preview / exporting | the export is always the light theme |
| **`h-top`** | 56px + safe-area top: wordmark हिसाब दो (display, `lang="hi"`, aria-label "Hisaab Do"), level chip, mute, settings | live question: replaced by the round header | — |
| **`h-nav`** | phone: bottom bar 64px + safe-area, five items (Home, Files, Duel, Receipts, Me) with lucide icons + labels; ≥ 900: left rail 88px | current = syahi text + 3px top/left bar | hidden in live rooms, pass-and-play and ceremonies |
| **`h-toast`** | paper, 2px outline, `--h-shadow-float`, top-centre under the top bar, max 360px, 4 s, swipe/× to close | — | `role="status"`; never during a question |
| **`h-ceremony`** | scrim + centred card `--h-r-xl`, 3D slot 240px, title, subtitle, one Continue button | — | `role="dialog" aria-modal`, focus trap, Esc = Continue |
| **`h-skeleton`** | ruled lines (`--h-ruled`) on paper, a static "F.No. ——" tab | — | no shimmer (calmer; reduced-motion safe) |

---

## 6. Motion, sound and haptics (the whole vocabulary)

| # | name | when | motion | sound cue (`lib/fx/sound`) | haptic |
|---|---|---|---|---|---|
| 1 | **Press** (दबाओ) | any button, option, file, tile | translate(2px,2px) + shadow to 0, 90 ms; release 140 ms | `tap` | light |
| 2 | **Lock** | answer chosen | tab fills, ring appears, 90 ms (no bounce) | `select` | light |
| 3 | **Stamp** (ठप्पा) | verdict on a receipt, file cleared, certificate issued | scale 1.6→0.94→1, opacity 0→1, rotate to seed angle, 420 ms `--h-ease-stamp` | `stamp` (+ `correct` for pass / `wrong` for fail) | success / error |
| 4 | **Print** (छपाई) | receipt appears | rows reveal top-down, `clip-path` in 6 steps over 360 ms | `tick` ×1 | — |
| 5 | **Tape snap** | first card of a route | tape halves rotate ±12° and fall 24px, fade, 360 ms `--h-ease-tape` | `whoosh` (short) | light |
| 6 | **File slide** | screen/card enter | translateY(12px × travel) + fade, 220 ms ease-out; exit fade 140 ms | — | — |
| 7 | **Count** | XP, score, receipts totals | NumberCounter over 700 ms, tabular digits | `xp` once at the end | — |
| 8 | **Fill** | meters, goal gradient | width over 360 ms ease-out | — | — |
| 9 | **Swipe** | the poster word highlight | marker `background-size` 0→100%, 360 ms, once per visit | — | — |
| 10 | **Paper chits** | ceremonies only | `confetti` preset recoloured to manila, syahi, tape, paper; 1.2 s | `levelUp` (label) / `stamp` (file) | heavy |

Not used: shake on wrong (the OBJECTION stamp is kinder), hit-stop, parallax, idle loops, tickers.
**Reduced motion** (OS or Effects = Reduced): `--h-travel: 0`, fades only, stamps simply appear, 3D shows one
settled frame. **Effects = Off**: no confetti, particles or WebGL (2D art instead).
**Sound:** silent until the first tap (charter §7), then on at engine trim; mute always in the top bar; cues
≤ 1.2 s, ≤ 3 within 100 ms, each with a visual twin. Later, optional procedural cues: `print`, `snip`,
`clink`, `clank`, `ding` — v1 maps to existing cues.

---

## 7. Accessibility

- **Contrast** per §3.4. **Targets** ≥ 44×44 (answers 60px, cartogram tiles ≥ 44px: 7 columns with a 4px
  gap at 390px, 3px at 360px). Inputs ≥ 16px.
- **Focus:** `box-shadow: var(--h-focus-ring)` (a 2px ground gap, then a 3px syahi ring), visible on every
  interactive element, including files and tiles. Never `outline: none` without it.
- **Twins:** shape + letter + tint on options; icon + word (+ hatching) on verdicts; glyph on tiles; words on stamps.
- **Live regions:** round verdict and score change `aria-live="polite"` ("Correct. Comptroller and Auditor
  General. You lead 2–1."); the timer announces only at 5 s and 2 s (`polite`), never every second;
  lobby peer state changes are polite; toasts are `role="status"`.
- **Screen reader names:** "Option A, triangle: Election Commission of India". Cartogram tiles: "Uttar
  Pradesh, 3 of 6 answered". The cartogram has an equivalent **list view** (alphabetical, searchable).
- **Dialogs:** sheets and ceremonies trap focus, restore it on close, and close with Esc.
- **3D:** every scene box is `role="img"` with a label stating the real numbers ("Tijori: 214 receipts");
  the 2D fallback carries the same label.
- **Text zoom** to 200% without loss: no fixed heights on text containers; buttons wrap.
- **Language:** `<html lang>` follows the locale; Devanagari spans in English get `lang="hi"`.

---

## 8. Psychology and growth model

### 8.1 The core loop (Hooked, adjusted to be honest)

| stage | HISAAB DO | mechanism |
|---|---|---|
| Trigger (external) | a forwarded receipt card, a daily grid, or a duel link on WhatsApp | social proof from a friend, not from us |
| Trigger (internal) | "Is that forward true?" and "Where did the money go?" | curiosity + civic itch |
| Action (≤ 2 taps) | open link → the question is already on screen (no account, no name) | minimal friction (N14) |
| Variable reward | the **receipt** (what the source actually says), the stamp, the physics set piece settling differently, Surprise Audit | curiosity gap closed **with evidence**; variability without money |
| Investment | the receipt is filed in your Vault, a coin drops in your tijori, a file gets closer to cleared, the next label comes nearer | endowment + goal gradient |

### 8.2 Identity ladder (the long loop)
- **Labels are identity, not points** — the joke *is* the progress model: you earn your way from being
  labelled to asking questions. Band = floor(level / 5) from `levelForXp` (source of truth).
- **Goal gradient:** a band meter with five level ticks; copy tightens near the top: "2 levels to Receipt
  Maango" → "180 XP to Receipt Maango" → "One good file away."
- **Endowed progress:** the first card cuts the tape ("Tape cut. 1 of 6."); the first receipt drops the
  first coin; the first quest counts the first answer.
- **SDT:** *competence* — calibrated calls (Shayad / Lagta hai / Pakka) with visible points and a
  calibration line at the finish; *autonomy* — every file open from day one, name optional, no forced
  order; *relatedness* — friend duels, pass-and-play, share cards, one daily set for everyone.

### 8.3 Loss framing, honestly
- The only stakes are real facts: ₹ figures in stems come from the source; we never invent a loss ("you
  lost ₹500"). XP and labels are all you earn.
- Loss aversion is used once — the streak — cushioned by **CL (casual leave)**: 1 per 7 days, max 2,
  auto-applied; after a miss the copy only reassures.
- Tijori coins are **not a currency** ("1 coin = 1 sourced receipt. Not money."). JHK gems, Locker and
  stakes are **not surfaced** in this edition — no second currency (N10).

### 8.4 The share loop (WhatsApp-first, server-free)

| artefact | format | content | link target |
|---|---|---|---|
| **Receipt card** | PNG 1080×1350 (4:5) via canvas + Web Share Level 2 (files); fallback download + copy text | question, the four options, **no answer** ("Challenge" variant) *or* answer + stamp + SOURCE + STATUS + as of ("Receipt" variant) | `…/hisaab/#q=<id>`: a one-card taster, no account |
| **Daily grid** | text | `HISAAB DO · Aaj Ka Hisaab · 25 Sep 2026` / `✅✅❌✅✅ 4/5` / `Label: RTI Warrior` / `Har sawaal ka source hai. Khud check karo: <url>` | `…/hisaab/#aaj` |
| **Certificate** | PNG 1080×1350, light theme always | §11.14 | `…/hisaab/` |
| **Duel invite** | text + `https://wa.me/?text=` + Web Share + copy | "Muqabla? Triple Threat on HISAAB DO. Room 7K2Q-9F: <link>" | P2P room link |

The share button says **"Forward this — it's actually sourced"** / *"Forward karo — iska source hai."*
Share honesty: an item with `status` shares its status line verbatim with `as of`; a share never states a
wrong option as fact; every image carries "Satire. Every question sourced."; the certificate name is the
player's display name (≤ 20 chars) — if it matches a person in the bank's `people` lists (normalised), it
prints **"Anonymous Janta"**, so nobody can "certify" a real politician.

**Referral loop:** receipt card → one-card taster → receipt → label reveal → "Duel the friend who sent
this" or "Open today's file". P2P invite links are the second loop (no account, no server).
**Honest metrics:** taster → first file, source-link opens per session, share → open, invites accepted,
D1/D7. **Not goals:** session length, notification opt-ins.

### 8.5 Dark patterns we refuse (N1–N14 are release gates)

| gate | what we will not do | the concrete HISAAB rule |
|---|---|---|
| N1 fabricated near-miss | fake "so close" | margin lines ("Round 3 went to 0.3 s") only from `result.reason`/`elapsedMs`; TARAZU settles to the true score |
| N2 fake countdown/scarcity | urgency theatre | no ticking "resets in" on Aaj Ka Hisaab (static "New file at 00:00 IST"); no limited-time labels |
| N3 streak repair for money/ads, alarmist nags | streak fear | CL shields are automatic; no streak push, no "your streak is dying" |
| N4 ads in rounds / before the receipt | — | no ads in this edition |
| N5 confirmshaming | "No thanks, I like being an Andhbhakt" | decline buttons read "Not now". Labels are **never** used to shame a choice |
| N6 silent devaluation / hidden rule changes | — | every XP number is on the Rules page; rule changes are logged in Corrections with a date |
| N7 hidden bot fills | — | Babu-Bot is labelled BOT everywhere, and its random behaviour is disclosed |
| N8 auto-queued next duel, overlay chains, nags | — | Rematch and Next are always taps; at most one toast per visit; ceremonies only in two kinds |
| N9 fake presence | "2,341 playing now" | no live counts in this edition; the P2P lobby shows only the real peer state |
| N10 hidden cost, bundles, second currency | — | no money, no currency; coins are a picture of receipts |
| N11 child-directed exhortation | — | tone is for adults and teens; no mascots urging play |
| N12 difficulty rigging, undisclosed mercy | — | bot and deal are fixed and disclosed; no loss-streak easing |
| N13 pre-selected opt-ins | — | nothing is pre-ticked; the name field is empty; no marketing consent exists |
| N14 forced account before play | — | play first, and a name only if you share a certificate or host a room |
| Vocabulary | "bet, wager, odds, jackpot, casino" | Pakka is a "confidence call", never a bet |

**Edition-specific refusals (political):** no party leaderboards ("most corrupt party"), no team colours
or "pick your side" onboarding, no outrage-ranked feeds, no "dunk on the other side" share copy, no
person-as-answer distractors (charter §2.4), no label applied to a real person, and no share card
that drops the status line.

---

## 9. Notification budget (charter §7, made concrete)

**Rule set** (it wraps `createOverlayBudget` from `components/fx/overlay-budget.ts`):
1. **Toasts:** ≤ **1 per screen visit** (route change or sheet open = new visit). Later requests merge into it
   (mergeKey `visit`) or go to Profile › Activity unshown — logged, not lost.
2. **Ceremonies:** only `label` (new band) and `file` (**first** completion of a state/sector/Kiska/Forward
   file); if both fire, **one** ceremony with two stamps. Every other kind (level, achievement, stamp,
   streak, rank) is **downgraded to in-place**.
3. **Quiet:** `setQuiet(true)` from countdown to `round.result` and during the pass-and-play hand-over.
4. **Inline, not toast:** confirmations ("Copied ✓" on the button), offline banners, errors.
5. **Never:** push (Push API never requested), e-mail, icon badges, "come back" prompts, streak-risk
   warnings, sound before the first tap.
6. **Settings › Quiet everything:** sound, haptics, Effects and toasts off (toasts go to Activity).

| screen | ceremony may | the one toast (if any) | quiet in-place updates | must be silent |
|---|---|---|---|---|
| First run | — | — | label reveal card (inline) | sound until tap |
| Home | label (only if a promotion was earned elsewhere and not yet shown) | CL used ("Missed a day. 1 CL used. Streak safe.") **or** quests-completed summary, not both | streak counter, quest ticks, tijori count, meter | "come back", streak risk |
| Files hubs / cartogram | — | — | tile states, best scores | — |
| Route card (untimed) | — | — | tape snap, stamp, receipt, XP on receipt | toasts (held for the finish) |
| Route finish | `file` (first clear) and/or `label` (merged) | quests completed (merged) | score, best improved, meters | level-ups inside a band |
| Aaj Ka Hisaab finish | `label` only | quests completed | grid, streak +1 | "tomorrow" countdown |
| Duel setup, P2P lobby | — | — | peer status, rank strip | presence counts |
| LIVE question | **none** | **none** | timer, lock state | everything else, including sound except tap/select |
| Round receipt | — | — | stamp, XP breakdown, combo, Surprise Audit | toasts |
| Match result | `label` | quests completed | XP count, Babu-rank delta, TARAZU | rank promotion ceremony (in place: "Promoted to Under Secretary") |
| Profile / Vault / Settings / Rules | — | — (Vault: "5 receipts due for re-check" is inline) | — | — |

---

## 10. 3D physics set pieces (R3F + @react-three/rapier)

**Common rules**
- Client-only lazy chunks (`React.lazy` in the Vite edition), never on first paint. `SceneFrame` gives dpr
  `[1, 1.5]`, the WebGL probe, context-loss fallback and offscreen pause. Rapier `timeStep 1/60`,
  `paused={!active}`, `frameloop="demand"` once all bodies sleep. One canvas at a time; unmount out of view.
- Low-poly, procedural materials, no network textures (decals from canvas textures).
- Load only when Effects = Full, no `saveData`, and `deviceMemory ≥ 4` where reported; otherwise 2D art.
- **Reduced motion:** step the world to rest off-screen (≤ 180 steps, < 30 ms), render **one** frame, `frameloop="never"`.
- **Hard rule:** the scene host reads the overlay-budget quiet flag and **refuses to mount** (and unmounts)
  from countdown until `round.result`. The only WebGL inside a room is TARAZU on the final result, and it
  unmounts before a rematch countdown.
- Physics decorates a **true number**: each scene's final state comes from real data, printed beside it.

| | **TIJORI** (safe) | **TARAZU** (balance scale) | **THAPPA** (rubber stamp) | **FILE PILE** (फ़ाइलों का ढेर) |
|---|---|---|---|---|
| Where | Home "Your tijori" panel (tap to open) and the Receipts Vault header | Match result (bot, friend, pass-and-play) | Aaj Ka Hisaab finish, the label-promotion ceremony, certificate issue | Route finish for state, sector, Kiska Media? and Forward Court files |
| Trigger | panel opened, or scrolled into view on capable devices after `requestIdleCallback` | 250 ms after the verdict text renders (text first) | the ceremony card is on screen | the finish screen renders |
| What happens | ₹ coins (1 per receipt collected) and note bundles (1 per 10) drop into a glass-front steel safe; only **new** receipts since the last open are animated (≤ 12), the rest start settled | one file-block weight drops into a player's pan per round won; the beam (revolute joint) tips; the final angle is **clamped to the true score** (diff × 6°, max 24°), a draw settles level | a wooden-handled stamp drops onto the receipt/certificate plane, bounces (restitution 0.3), leaves an ink decal on first contact, lifts away | six file covers drop 120 ms apart onto a desk, each with an APPROVED-green or OBJECTION-red edge by true result; a red-tape strap slides down and ties the pile; THAPPA stamps FILE CLEARED · 18/24 |
| Bodies | ≤ 60 dynamic coins (`InstancedRigidBodies`, cylinder colliders) + ≤ 12 bundles (cuboid); older bodies are merged into a static instanced "settled" stack; 5 static walls | 1 beam + ≤ 10 weights (Gauntlet 5 + 5), fulcrum static | 1 dynamic (compound: handle cylinder + base cuboid) + 1 static plane | 6 dynamic cuboids + 1 kinematic strap + THAPPA (1 dynamic) + desk |
| Budget | ≤ 12 draw calls, ≤ 60k tris, ≤ 6 ms JS/frame on a Snapdragon 6-series-class phone, canvas 280px (phone) / 360px (desktop) | ≤ 8 draw calls, settle ≤ 2.5 s then freeze, canvas 240 / 320px | the canvas lives ≤ 1.4 s, then unmounts; the 2D stamp remains | ≤ 10 draw calls, total ≤ 2.2 s, then freeze; canvas 260 / 340px |
| Fallback art (2D) | CSS glass box with stacked coin bars (height ∝ count, log-scaled after 100) + count | SVG scale rotated by the true angle, pans labelled | CSS stamp slam (motion #3) | CSS stack of six tabs with coloured edges + tape band + stamp |
| Sound twin | `gem` ping per landing, throttled ≤ 6/s, ±3 semitone variance | `stamp` thump per weight (low), `win`/`loss`/`draw` on settle | `stamp` + (`correct` for ISSUED) | `tick` per file, `whoosh` for the strap, `stamp` |
| Haptic twin | light on the first landing only | medium on settle | heavy once | light per file (≤ 3), heavy on the stamp |
| Label (a11y) | "Tijori: 214 receipts. 1 coin = 1 sourced receipt. Not money." | "Scale tips to you: 2 rounds to 1." | "Stamped: ISSUED — Receipt Maango." | "File cleared: Uttar Pradesh, 18 of 24." |

Reference implementation: `components/three/gem-vault.tsx` (instanced Rapier bodies, parking, nudge,
reduced-motion path) — TIJORI is its sibling.

---

## 11. Screens

Format per screen: **Primary** (the one violet button) · **390** · **1440** · **States** · **Copy**. Shared
states: `h-skeleton` loading; empty = one line of satire + one action; error = "File missing. Babu is on
leave." + Retry; offline = solo modes keep working (the bank ships in the build: "No network. The files are
already on your phone."), P2P and sharing say they need a network. Checked at 360/390/414 and 1440
(rail + max 1200 content).

### 11.1 First run (no account, name optional)
- **Primary:** Open today's file. Text links: "Pick a state instead", "Have a duel code?".
- **390:** full-height poster — kicker `F.No. 00/IN/2026`; *हिसाब दो / SHOW US THE ACCOUNTS*; "Janta ka
  paisa. Janta ka sawaal."; three typed lines ("Every answer comes with a receipt." · "30 states, 13
  sectors, one daily file." · "Satire on labels. Facts from sources."); EN/हिं toggle; footer "No account.
  Stored on this device. Rules & sources".
- **1440:** poster on a halftone patch with static TIJORI art (7 cols) | action card (5 cols).
- **After the first receipt:** an inline label card (not a ceremony): "You start as **ANDHBHAKT** — Forwards
  first. Reads never. Everyone starts here — of anyone, for anything. Receipts get you out." + meter "4
  levels to WhatsApp University Fresher".
- **Copy:** "Account? Zaroorat nahi. Seedha sawaal."

### 11.2 Home
- **Primary:** Open today's file → once done, **Resume <file>**, else **Duel Babu-Bot**.
- **390, top to bottom:** label block (kicker "You are · Level 7", label 30px with Devanagari above,
  one-liner, meter "180 XP to Prime-Time Loyalist") → **Today's file** (`h-file` + tape + `--h-shadow-3`,
  "5 questions · same for everyone today"; done → "4/5 · Share grid") → Resume ("Uttar Pradesh · 3 of 6")
  → **Your tijori** (static art + count; Open loads 3D) → **Aaj ke 3 kaam** (quests, in-place ticks) → four
  small files (Rajya, Sector, Kiska Media?, Forward Court) → Muqabla strip.
- **1440 (12 cols):** poster + label (1–7) | today's file (8–12); tijori 3D (1–5) | four files 2×2 (6–12);
  quests (1–6) | resume + duel (7–12).
- **States:** empty tijori "Tijori khaali hai. First receipt goes here."; offline inline banner.
- **Copy:** "Aaj ka hisaab ready hai." · "Streak: 6 days · 1 CL in hand".

### 11.3 Files hub + Rajya Rounds (records-room cartogram)
- The **Files** tab opens on a segmented control **Rajya · Sector · Kiska Media? · Forward Court** (default Rajya).
- **Cartogram** (7 × 7; `IN` is a 4-wide drawer). Not a map; makes no boundary claim. All 30 + Centre open.

```
r0:  .   .   JK  .   .   .   .
r1:  .   PB  HP  UT  .   .   AR
r2:  RJ  HR  DL  UP  BR  SK  AS
r3:  GJ  MP  CT  JH  WB  ML  NL
r4:  .   MH  TG  OD  .   TR  MN
r5:  GA  KA  AP  .   .   .   MZ
r6:  .   KL  TN  [ IN · CENTRE  ]
```
- **Primary:** Open file / Resume file (for the selected tile; default = last opened).
- **390:** *राज्य राउंड्स / RAJYA ROUNDS*, "Pick a state. 6 cards. Every answer has a receipt.", grid (~47px
  tiles), glyph legend, **file brief** card (`F.No. S/UP`, EN + Devanagari name, sectors covered, best
  score). "List view" toggle: alphabetical, searchable, same data.
- **1440:** 72px tiles with small names (left) | sticky brief panel (right); search above.
- **States:** fewer than 6 items → the real count ("4 cards"); skeleton tiles.
- **Copy:** "Kaunsa rajya? Sab ki file khuli hai." · sealed tile: "Sealed. Tape cut on first card."

### 11.4 Sector Files
- **Primary:** Open file (on the expanded file; the next unfinished one is pre-expanded).
- **390:** *सेक्टर फ़ाइलें / SECTOR FILES* — 13 stacked manila files (`F.No. X/WEL`, lucide icon, "6 cards",
  meter, tape if sealed); tap expands the brief inline. **1440:** 3-column cabinet + side brief.
- **Copy:** "Welfare & Subsidies: kisko mila, kitna mila." · empty: "Koi file clear nahi. Abhi tak."

### 11.5 Kiska Media?
- **Primary:** Open the press file.
- **390:** *किसका मीडिया? / KISKA MEDIA?* — "Who owns the news that told you?"; outlet names as **plain mono
  text chips** (no logos, masthead styles or brand colours). Cards add an **ownership chain** (`h-own`:
  Owner → Holding → Outlet, text boxes + arrows) in the noting; source chip `FILING` or `PRESS`.
  **1440:** chain renders horizontally beside the receipt.
- **Copy:** "Channel kiska, paisa kiska." · "Ownership facts across groups and parties."

### 11.6 Forward Court
- **Primary:** Court is in session.
- **390:** *फ़ॉरवर्ड अदालत / FORWARD COURT* — "Claims from every side. Rulings by fact-checkers." The claim
  sits in a **generic paper chat bubble** tagged "↪ Forwarded many times" (never WhatsApp green, ticks or
  chrome); receipt chip `FACT-CHECK` + the checker's name in text; the ruling reads in the receipt
  ("Fact-checkers: misleading"). **1440:** bubble left, options right.
- **Copy:** "Forward aaya? Pehle receipt." · empty: "No forwards left today. Rare."

### 11.7 Aaj Ka Hisaab + the route card (all untimed routes)
- **Primary:** Next card → on finish, **Share today's grid**.
- **390:** header `F.No. D/2026-09-25 · 2 of 5` + five-segment bar (× saves and exits). Card: kicker
  (sector · state · year) → stem → **confidence switch** (*Shayad* +2/0 · *Lagta hai* +3/−1 · *Pakka* +4/−3,
  default Shayad, numbers visible) → four `h-opt` → "No timer — take your time. First answer locks." After
  lock: stamp → receipt prints → noting → Next card; secondary **Open source ↗**, **Forward this — it's
  actually sourced**. **1440:** card (≤ 560) left | receipt + noting right.
- **Done:** ✅/❌ grid, score, streak +1, "New file at 00:00 IST" (static — no countdown).
- **Copy:** "Aaj ke 5 sawaal. Sabke liye same." · "Aaj ka hisaab ho gaya. Kal naya file."

### 11.8 Duel setup (Muqabla)
- **Primary** (sticky launch bar): Start vs Babu-Bot / Create room / Start pass & play.
- **390, one scroll:** Opponent radio cards — *Babu-Bot · BOT* ("Picks at random. Can't see the question."),
  *Friend* ("Peer-to-peer room code. No server."), *Pass & Play* ("Two players, one phone, untimed"); Format
  cards with real numbers — *Quick Draw* 1 q · 10 s, *Triple Threat* best of 3 · 7 s, *The Gauntlet* 5 q ·
  5 s; Topic chips (Mixed + 13 sectors); "Have a code? Join"; rank strip "Babu rank: Section Officer · on
  this device"; rule line "Faster correct answer wins; within 0.15 s is a tie." **1440:** three columns.
- **Copy:** "Muqabla karo. Babu-Bot bina padhe stamp lagata hai."

### 11.9 P2P lobby
- **Primary:** I'm ready (→ "Waiting for <friend>").
- **390:** room code in mono 48px (`7K2Q-9F`) + **WhatsApp** (wa.me), **Copy link**, **Share**; seats: You (name
  or "Anonymous Janta") and Friend ("Waiting…" / "Connecting directly…" / "Connected · peer-to-peer" /
  "Ready"); format + topic summary; both ready → typed 3·2·1 (Sometype 96px, no WebGL). **1440:** code
  card left | seats right.
- **States:** failed → "Couldn't connect directly — some networks block this." + buttons Pass & Play /
  Babu-Bot; leave → "Leave the room?" (Leave / Stay). No typing indicators, no presence beyond the real link.
- **Copy:** "Code bhejo, dost bulao." · "Direct connection. Hamare paas kuch nahi jaata."

### 11.10 LIVE question (quiet surface; JHK timing contract)
- **Primary:** none — the four answers are the only controls.
- **390:** header = format · "Round 2 of 3" + score pill `1–0` (aria "You 1, Babu-Bot 0"); stem top;
  answers in the thumb zone; **timer bar directly above the answers** (6px ink, continuous rAF,
  `transition: none`, never red or shaking); after a tap: "Locked · waiting for the clock / for <friend>".
  **1440:** centred 560px column, single column of answers, keys 1–4 / A–D.
- **Hard rules:** card `visibility:hidden` until the double-rAF reveal marker — no entrance animation,
  layout shift or work before it; fixed option order; no correctness styling before `round.result`; no
  WebGL, particles, halftone, tape, stamps, marker, toasts or nav; only press/lock feedback and
  `tap`/`select`; overlay budget quiet.
- **Pass & Play:** untimed; after P1 locks, a full-screen cover ("Hand the phone to Riya. Don't peek.")
  until P2 taps "I'm Riya — show the question".
- **States:** P2P drop → "Connection lost — waiting 10 s", then the engine settles (`player-not-connected`)
  and the result states that reason.

### 11.11 Round receipt
- **Primary:** Next round (= ready; shows the friend's ready state) / Next card. Secondary: Open source ↗.
- **390, ≤ 900 ms sequence:** option states → **stamp** (SAHI · APPROVED ✓ / GALAT · OBJECTION ✕ / PENDING ⏳
  "No answer") → round line only if true ("You were 0.4 s faster" / "Tie — within 0.15 s") → receipt
  prints: `RECEIPT #0215 · +32 XP` (base 20 · fast +15 · combo ×1.25 · Surprise Audit ×2 when applied),
  SOURCE (label ↗), STATUS (legal chip + "as of Sep 2026"), OTHER SIDE, GOVT THEN → noting (collapsed in
  duels: "Read the noting"). A *next-round* Surprise Audit is announced here, never on the question card.
  **1440:** answers left | receipt + noting right.
- **Copy:** "Receipt mil gayi." · "Galat. Par receipt toh le lo." · "File pending. Clock ne stamp laga diya."

### 11.12 Match result
- **Primary:** Rematch (a tap, never automatic; P2P needs the friend's ready). Secondary: All receipts,
  Share result ("Beat Babu-Bot 2–1 on HISAAB DO. Har sawaal sourced.").
- **390:** verdict word 48px **JEET / HAAR / BARABAR** + "You won 2–1" → **TARAZU** (240px or 2D) → true
  margin line (if any) → XP count-up with breakdown → Babu-rank delta in place ("+30 · Section Officer
  70/150") → quests touched → swipeable round receipts. **1440:** verdict + scale | XP, rank, receipts.
- **Ceremony:** a label promotion queues ≥ 1.2 s after the result renders.
- **Copy:** "Haar gaye. Receipts phir bhi aapke." · "Barabar. Babu bhi hairaan."

### 11.13 Route finish (state, sector, Kiska Media?, Forward Court)
- **Primary:** Next file (a suggestion — neighbouring tile or next sector; "Choose another" beside it).
- **390:** **FILE PILE** (260px) + THAPPA *FILE CLEARED · 18/24* (first clear → `file` ceremony wraps it;
  replays → in-place "Best: 14 → 18") → calibration ("Pakka calls: 2 of 3 landed. Shayad kept you safe on
  2.") → six mini receipts → XP → **Share this file** (receipt-card carousel). **1440:** scene | summary.
- **Copy:** "Uttar Pradesh ki file clear. Feeta khul gaya."

### 11.14 Profile (Me): label ladder + certificate
- **Primary:** Share certificate (current rung).
- **390:** **the ladder** is the hero — nine rows (Certified Anti-National on top), each with Devanagari +
  Latin label, one-liner, "Level 20+"; earned rungs carry ISSUED + date; the current rung expands with the
  band meter and certificate thumbnail; future rungs stay readable (knowing the joke is the pull). Then
  stats (receipts, states x/30, sectors y/13, streak + CL, Babu rank "on this device"), **Stamp Register**
  (silent achievements), **Activity** (in-place updates + merged toasts), optional name ("Name on
  certificates"). **1440:** ladder (5 cols) | certificate preview (7 cols).
- **Certificate** (1080×1350, light): header `CERTIFICATE OF LABELLING · F.No. L-4/2026-0214`; "This is to
  certify that **{name}** has, after **{n} sourced receipts**, been officially labelled"; label poster +
  one-liner; THAPPA "ISSUED · 25 SEP 2026"; Kalam "Noted. Pl. forward."; rung dots (n of 9); footer
  "Satire. Not a government document. Every question sourced. · occult-kranti.github.io/fact-duel/hisaab".
- **Copy:** "Aapka label, aapki receipts." · empty name → "Anonymous Janta".

### 11.15 Receipts Vault
- **Primary:** Re-check 5 due (when due > 0), else Open today's file.
- **390:** TIJORI header (static; tap for 3D) + count → filter chips (All · Collected · Pending re-check ·
  State · Sector · Source type) → list of receipt minis (short stem, mini stamp, source, legal chip + as
  of) → tap = sheet with full receipt, noting, Open source ↗, Forward this. **Dobara Jaanch** (JHK recall
  lab) runs due items as untimed cards. **1440:** filters | list | detail (master–detail).
- **States:** empty "No receipts yet. Every answer files one here."; a bank status update shows "Status
  updated Sep 2026" with the old line struck through beside the new one.

### 11.16 Settings (sheet on phone, panel on desktop)
- **Primary:** Done (everything applies instantly).
- **Controls:** Language (English / हिन्दी) · Theme (Office by day / File room at night / Match phone) · Sound
  + volume · Haptics · Effects (Full / Reduced / Off — "Off: no 3D, no confetti") · **Quiet everything** ·
  Name · Data ("Everything is stored on this device"; Export JSON; Delete my progress → confirm "Delete /
  Keep") · static line "We never send notifications." · links: Rules & Sources, Corrections, Report a problem.

### 11.17 Rules & Sources / Corrections (trust + legal)
- **Primary:** Report an error in a question (prefilled issue link or mail draft with the item id).
- **390:** long-read noting sheet with a TOC dropdown; **1440:** sticky TOC + 62ch column.
- **Sections:** (1) what this is — satire about labels, facts from sources; (2) how we source (charter
  order); (3) legal status words defined — alleged, FIR, arrested, chargesheeted, on bail, acquitted,
  convicted, case closed, petition dismissed — and **"Nobody named here is guilty unless convicted."**; (4)
  the other side's answer is part of every fact; (5) balance — the Centre since 2014 is NDA-led, state
  files cover whoever governed, `govt` distribution audited; (6) distractors never name real people; (7)
  game rules with real numbers — `XP` table, confidence points, Surprise Audit odds (~1 in 6 ×2, ~1 in 36
  ×3), streak + CL, Babu rank "on this device", 0.15 s tie, fixed order, Babu-Bot's randomness; (8)
  privacy — device-only, P2P shares name and answers with the peer only; (9) art policy; (10)
  **Corrections log** — date · item id · change · why · source.
- **Copy:** "Galti hui? Batao. Hum receipt ke saath sudhaarte hain."

---

## 12. Engineering hand-off notes

- **Class prefix `h-`**, one CSS file per screen/component, tokens only. No `!important`.
- **Edition aliases** (engine lane, rows in `editions/hisaab/aliases.mjs`): the bot display name "Babu-Bot · BOT" (the room engine hardcodes
  "Lucky Guess · BOT"); rank labels (Bronze→LDC, Silver→Section Officer, Gold→Under Secretary,
  Platinum→Joint Secretary, Diamond→Secretary); `LEVEL_TITLES` → the nine labels; confidence display names
  (Steady→Shayad, Bold→Lagta hai, Called→Pakka), keeping the engine's ids and points.
- **Overlay budget wrapper:** `toastsPerVisit: 1`, `ceremonyKinds: ['label', 'file']`, merge-or-log; quiet from
  countdown to `round.result`.
- **Progress feedback:** drive it from `progressionDiff(before, after)`, as JHK does, but map `level` (in-band) →
  in-place, `band` change → `label` ceremony, `achievement` → Stamp Register (silent), `rank` → in place.
- **Mobile gate:** run `scripts/mobile-gate.mjs` against the edition build at 360/390/414 × en/hi × both themes,
  and read the PNGs; add the edition's screens to the gate's matrix (Phase 3.4).

## Appendix A: sources for decisions
Fontsource API (`api.fontsource.org/v1/fonts?subsets=devanagari`, 62 families, 25 Sep 2026); `npm view` for every
package; fontTools 4.66 glyph and feature inspection (₹ U+20B9 location, `tnum`, axes); WCAG 2.2 SC 1.4.3,
1.4.11, 2.5.5/2.5.8; CSS Fonts 4 §4.5 (unicode-range and reverse-order matching); the JHK Floodlight bible
(gamification rationale only); `lib/progression.mjs`, `lib/expeditions.mjs`, `lib/server/room-engine.mjs`
(numbers quoted here); the gamification-advisor gates N1–N14; the Emblems and Names (Prevention of Improper Use)
Act 1950 and the State Emblem of India (Prohibition of Improper Use) Act 2005 (why no emblem, and
why the certificate says "not a government document").

## 13. Daily Edition update — 27 September 2026

The user's requested old newspaper/magazine direction supersedes the original restrictions against cream, editorial serif headlines and newspaper rules in §§1, 3 and 4. This is an evolution of LAL FEETA: retain Hindi identity, syahi, manila file objects, stamps, receipts, tijori, quiet question surfaces and all modes. Do not copy a real publication's nameplate or introduce party/media marks.

Ground: `#f2eddf`; paper: `#fffaf0`; primary ink: `#252219`; secondary ink: `#565044`. Dark ground: `#191813`; dark paper: `#292720`; secondary ink: `#c9c2b3`. Accent and verdict systems retain their semantic roles. Compact 2/3/4/5/8px corner tokens and 1/2/4px printed shadows replace the previous rounded poster defaults. `--h-font-editorial` is a system serif stack used only for selected English titles; Hindi and body/answer copy keep the original font system.

The first-run page and home share an original masthead with a local edition date. Home leads with the daily file, then the reader's desk and circles, with all record files, money routes, quests, tijori and duel modes preserved. The six-item navigation adds Circles. Speed XP is disclosed as 30 under 8 seconds, 20 from 8 to under 15 seconds and 10 at 15 seconds or more for a correct answer. The confidence selector is retired for this edition.

The independent color check covers 47 readable pairs per theme. All exceed 4.5:1: minimum light 4.9187, dark 5.4760. See `review/editorial-redesign.md` for the updated pair table, references, review scope and final runtime evidence. Previous §3.4 measurements describe the preceding palette and should not be used for the current ground colors.

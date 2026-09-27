# HISAAB DO — day and night identity review

Date: 27 September 2026. This is a recorded AI design panel and implementation review, not a claim of human expert consultation or a player study. The user's approved light theme is the invariant. The design hypothesis is that repeated type, a violet full stop, paper artifacts and source receipts can make the product recognisable without distracting from answers.

## Source basis

- Josef Albers, *Interaction of Color* (1963), through the [Albers Foundation's teaching account](https://www.albersfoundation.org/alberses/teaching/interaction-of-color): evaluate a color beside its actual neighbours. We use this as a comparison method, not as a claim that violet creates trust or any universal emotion.
- Ellen Lupton, *Thinking with Type*, third edition (2024), [publisher-provided book record](https://books.google.com/books/about/Thinking_with_Type.html?id=AnrsEAAAQBAJ): distinguish editorial headings, readable text, hierarchy and multilingual scripts. Existing Georgia/Akshar/Mukta/Sometype roles continue; no additional font download is required.
- [WCAG 2.2 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): normal readable text 4.5:1; meaningful control boundaries and focus 3:1. Decorative rules can be quieter; words/shapes still accompany status colors.

## Loop 1 — establish and implement the direction

### Round 1: independent diagnosis

Inspected the existing 390px dark home and 1440px dark duel screenshots, plus tokens, shared shell, masthead, screen headers and static publication CSS. The former night palette used brown/olive ground and similarly bright rules around most surfaces. That was legible but diminished the distinction between page, file and receipt. The mobile inner-page header omitted the Latin name; static About/Privacy/Contact fell back to browser-default Canvas/LinkText colors.

Proposed an ink-black night edition, warm reading text, separate slate-paper/manila/receipt layers and less prominent decorative rules. Preserve every light color and the established Hindi identity, violet action, factual receipts and quiet question field.

### Round 2: moderator synthesis and revised artifact

The moderator approved the direction and assigned theme/chrome/public-header ownership. Tradeoff: repeat one small original wordmark and its violet full stop instead of introducing a new badge or another accent. Keep the game name out of the timed question's competing controls; its settings sheet can carry the signature.

Implemented dark tokens and the OS mirror, a separate editorial-rule token, shared `BrandName`, compact bilingual header, static publication-page palette/headers, an original H/full-stop favicon and Day edition/Night edition preference labels. The light palette was compared against the prior Git revision with **zero changes to existing light color tokens**. Initial contrast computation passed **118 text/control/focus pairs** across both themes; the minimum of the 47 dark readable-text pairs was **6.3159:1**. Initial browser capture covered 390/1440px × day/night × home/duel/About: **12 views, no overflow, no JavaScript errors, all six nav targets at least 44×44px**.

## Loop 2 — review the revised artifact

### Round 1: independent critique

Read the new in-game settings code and examined the rendered desktop night home and mobile night duel setup. The reading hierarchy is coherent and the Latin signature remains visible on inner pages. Found one remaining signature mismatch: the game settings sheet prints a spaced mono HISAAB DO label instead of the new editorial mark and full stop. Recommend the shared mark in that sheet, with its actual dialog heading retaining the accessible name. Do not add another brand row inside the timed question header.

The static publication pages match the palette but currently follow the device's color-scheme preference; the app can be forced to a different theme. Flagged this for the moderator because consistency requires either a small shared first-paint preference bridge or an explicit decision to let static pages follow the device. Review continues with narrow Hindi settings screenshots.

### Round 2: moderator synthesis and corrections

Accepted the preference bridge. `publication-theme.js` is emitted at the build boundary from the shared `storageNames()` function plus the HISAAB namespace; it reads only the edition's theme preference. Day/night follow the stored choice, while System, missing/invalid preferences, unavailable storage and JavaScript-disabled pages retain the CSS/device fallback. The public pages now consume the same emitted `tokens.css` content as the game, avoiding palette duplication. The source helper's `--check` mode verifies bridge behavior and namespace isolation. Both the shared token sheet and preference bridge are served by the Vite plugin in development and emitted as standalone production assets; no duplicated palette or storage-key literal is kept in the public source directory.

The moderator also selected a small, passive brand mark in the round header as well as the settings sheet; the UI owner implements it and the 320px review must reject crowding. The 320/390px dark Hindi settings-sheet captures before that mark change showed no overflow or JavaScript errors, with initial focus on Back to game. The expanded color check covers **198 pairs** across both themes, including answer-slot text, soft semantic backgrounds, fill labels, manila labels, tertiary UI glyphs, focus/control boundaries and large verdict stamps. All passed; readable-text minima are **4.9187:1 day** and **6.3159:1 night**. Six preference-bridge checks passed, including denied storage and invalid settings.


## Loop 3 — final consistency review

### Round 1: independent challenge

The recurrent mark is now present in the game settings and the passive round header. One remaining first-paint mismatch was found by inspecting `index.html`: the dark browser metadata used the current ground, but its inline pre-bundle CSS still used the previous brown ground and ink. A theme could briefly change tone while loading. The manifest already matched the approved light color. Also checked every explicit dark token against the device-dark CSS fallback: all **50 overrides match exactly**.

### Round 2: moderator synthesis

Approved the two first-paint declarations changing to the existing Night edition ground/ink. No new palette or layout direction was introduced. The final check is limited to that correction, 320px passive-header/menu fit and forced-theme continuity across all three publication pages.

### Final evidence and bounded sign-off

The final **15 browser checks passed** against the Vite development build of the final source, using Chromium 153 and reduced motion. Details are in [brand-runtime-checks.json](brand-runtime-checks.json).

- All three public pages at 320px respected forced Day on a dark device and forced Night on a light device; their computed grounds match the app. No horizontal overflow occurred.
- Both themes at 320px in Hindi: the passive round mark, score and settings control have separate bounds, the settings target is at least 44×44px, the settings dialog has no horizontal overflow, and initial focus is on Back to game. The mark does not add an action or animation.
- Home at 390/1440px in Hindi, in both themes, retained clean horizontal reflow. No JavaScript errors were observed in the tested flows.
- With JavaScript disabled, About still used the device's dark preference through the shared token stylesheet.
- The build-derived preference helper separately passed six behavior checks; the color report contains 198 passing pairs and the unchanged day-color comparison. All 50 dark overrides match the CSS device fallback.

Inspected the actual night desktop/mobile home, 320px round header/settings, and forced-day public-page PNGs. Representative artifacts: [night desktop](screenshots/night-desktop-home.png), [night mobile](screenshots/night-mobile-home.png), [game settings](screenshots/night-mobile-game-settings.png), [round header](screenshots/night-mobile-round-header.png). No further visual changes are proposed for this release. This is a bounded color/layout/brand review; it does not establish improved recall in a player study, certify accessibility, or substitute for the release owner's production flow verification.

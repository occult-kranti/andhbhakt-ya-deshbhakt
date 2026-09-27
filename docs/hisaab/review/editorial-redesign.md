# Daily Edition — HISAAB DO editorial redesign

Date: 2026-09-27. Scope: the HISAAB edition only, preserving every existing mode and receipt workflow.

## Decision

Treat the app as a newspaper you can question. The user's request for old newspaper/magazine elements supersedes the earlier design card's ban on cream grounds, serif type and editorial rules. This is an original HISAAB nameplate, not a copy of any publication. The Hindi identity, syahi violet, manila files, sourced receipts, tijori and satire remain.

The first-run page now introduces the public-money quiz, five-question daily file and transparent speed XP. The returning home page has a date-bearing masthead, lead daily story, reader's desk, friends/family circles, complete records index, money trail, receipt collection, quests and duel actions. A narrow screen reads in task order; the desktop separates a broad daily/index column from a smaller personal column. Circles also have a permanent navigation entry. No modes are removed.

## Source-led rationale

These are design interpretations, not claims that a color or layout guarantees engagement.

| Source examined | Relevant idea | Implementation |
| --- | --- | --- |
| Josef Albers, *Interaction of Color*, via the [Josef & Anni Albers Foundation](https://www.albersfoundation.org/alberses/teaching/interaction-of-color) and [Yale](https://whc.yale.edu/interaction-of-color-by-josef-albers) | Color is perceived in context; exercise and comparison matter more than assigning universal emotions to a hue. | Warm paper and carbon ink retain a neutral civic tone; violet is reserved for the action/focus system. Both themes are measured separately. No claim that violet produces trust. |
| [Letterform Archive's Online Archive](https://letterformarchive.org/online-archive/), including its Emigre and periodicals collections | Printed artifacts distinguish headings, reading columns, marginal information and evidence through type, space and rules. | A nameplate, date strip, double rules and asymmetrical columns carry the newspaper reference. No copied masthead, texture photograph or extra image request. |
| Ellen Lupton, *Thinking with Type*, 3rd ed. (2024), [publisher-provided book record/preview](https://books.google.com/books/about/Thinking_with_Type.html?id=AnrsEAAAQBAJ) | Typography has separate roles for letters, reading text and layout, including hierarchy, multilingual scripts and responsive grids. | A local serif stack is restricted to English editorial headlines. Existing Akshar/Mukta continue for Hindi, controls and questions; Sometype Mono carries dates and numeric XP. No extra font download. |
| Przybylski, Rigby & Ryan, [*A Motivational Model of Video Game Engagement*](https://www.selfdeterminationtheory.org/SDT/documents/2010_PrzybylskiRigbyRyan_ROGP.pdf), 2010 | The authors frame engagement through competence, autonomy and relatedness. | Competence: disclose 30/20/10 speed XP and preserve sourced explanations. Autonomy: every mode and a no-account first game remain available. Relatedness: user-created circles and group-specific nicknames. These are design hypotheses to evaluate with players, not causal outcome guarantees. |
| [W3C WCAG 2.2: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Normal readable text requires at least 4.5:1; large text has a 3:1 minimum. | Token checks exceed 4.5:1 for all 47 evaluated readable pairs per theme; status continues to include words/shapes. |

## Typography and interaction

- English editorial headlines: `Georgia, Times New Roman, serif, Mukta`, a platform-local stack. Characterful but restricted to short headings; body and live questions retain the installed UI fonts.
- Brand identity: original Hindi wordmark, original HISAAB DO English nameplate, existing violet. Masthead date is the local game edition day, not a claim of newly reported news.
- Mobile: daily file first, then personal desk and circles. Six navigation targets each retain at least 44px height; at 320px each column is approximately 53px wide.
- Circles: one explicit entry in the home content and one navigation item. No fabricated member counts, fake presence, unsolicited invitations or activity pressure.
- Buttons retain press feedback, visible focus, native links and the existing sound/effects preferences. No new automatic animation or visual noise is introduced into live questions.
- Advertising: a single home-footer slot appears only through the advertising module's release gates, after all editorial/game entries. Publication links follow it. No faux advertisement or ad-adjacent answer controls.

## Palette verification

47 text/background pairs per theme were recomputed using WCAG relative luminance: seven readable foreground tokens on six surfaces, plus five filled semantic token/ink pairs. All passed 4.5:1. Minimum light: **4.9187**; minimum dark: **5.4760**.

| Foreground / background | Light | Dark |
| --- | ---: | ---: |
| Ink / ground | 13.59 | 15.61 |
| Secondary ink / ground | 6.84 | 10.03 |
| Secondary ink / paper | 7.68 | 8.43 |
| Secondary ink / manila | 6.09 | 7.06 |
| Violet text / ground | 7.27 | 8.01 |
| Violet text / paper | 8.17 | 6.73 |
| Violet text / manila | 6.48 | 5.63 |

Full release runtime/test evidence is recorded by the integration lane. Browser render review for the changed first-run/home surfaces is recorded below when completed. No screen-reader certification is claimed.

## Browser review completed

A real Chromium session exercised first-run and home at **320, 390, 1100 and 1440 CSS px**, in both **English/Hindi** and **light/dark** themes: **32 views**. Effects Off and reduced motion were set. Observed: zero horizontal overflow, zero page errors, no navigation target below 44 × 44px and no screen with more than one primary action. Mobile and desktop screenshots were visually inspected, including dark/Hindi renders. The Hindi headline uses the original Devanagari font; matras remained visible in reviewed renders. Initial image captures made during the entry fade were replaced with settled captures.

Reviewed branch artifacts: `screenshots/editorial-mobile-home.png` (390px) and `screenshots/editorial-desktop-home.png` (1440px). Screenshots show the fresh profile's honest zero-receipt state. No synthetic activity was injected.

This verifies the changed entry/home surfaces, responsive composition and selected adaptation states. It does not constitute a full screen-reader audit or prove all game paths; the integration lane runs the engine/UI regression gates separately.

Final QA found a mixed-script circle-name heading that inherited English while containing Devanagari. The shared screen header now labels detected Devanagari strings `lang="hi"`, and the editorial stack includes explicit Mukta glyph fallback after the platform serif. Circle headings also declare their detected language.

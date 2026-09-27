# HISAAB DO launch and investor pack

Prepared 27 September 2026. Public product: https://occult-kranti.github.io/fact-duel/hisaab

This is an editable launch package, not evidence of product-market fit. The proposed online beta uses a server referee. Claims about release status must follow the root release report, not the date on this pack. The deck deliberately distinguishes the existing browser game, the online beta under construction, and later commercial experiments.

- `investor-narrative.md`: slide narrative, speaker guidance and diligence gaps.
- `launch-calendar.md`: a 30-day sequence with release gates and a measurement plan.
- `social-posts.md`: six English/Hindi post pairs, ready for human scheduling. Nothing has been posted.
- `press-kit.md`: founder pitch, press description, boilerplate and correction process.
- `design-and-retention.md`: brand system, social art direction and finite review panel decisions.
- `assets/hisaab-launch-poster.png`: original generated concept art for the launch campaign. The illustration represents a fictional table scene. It contains no data claim or real-person depiction.
- `assets/day-edition-product.png` and `assets/night-edition-product.png`: product screenshots from the prior published release. They are not screenshots of the new online beta.
- `build-investor-deck.mjs`: editable PowerPoint source using the supplied Artifact Tool runtime. Output is delivered separately as `HISAAB-DO-investor-deck.pptx`.
- `assets/investor-deck-preview.webp`: rendered overview of the 10-slide deck. All ten slides were also inspected individually at full size.

The deck has no traction, revenue, valuation, TAM estimate, raise amount or fabricated team biography. The owner should fill the financing terms only after setting a budget and confirming company details. Public marketing must not disclose the hidden honour or promise money/prizes, exact network equality, account recovery, a measured learning benefit or proven retention.

Research grounding: Ryan, Rigby & Przybylski (2006) supports design hypotheses about autonomy, competence and relatedness; it does not establish HISAAB outcomes. Nielsen's heuristics inform visible match status and clear exits. Supabase pricing is a dated planning input, not a guarantee of the total bill. See `design-and-retention.md` and `../SERVER-LAUNCH.md` for sources and service details.

## Rebuilding the editable deck

Follow the current Presentations skill, including its artifact-operation marker and finalization guidance, before authoring. The builder is an ES module and uses `@oai/artifact-tool` from the supplied runtime. Copy the builder into a private build directory and link that directory's `node_modules` to `CODEX_PRIMARY_RUNTIME_NODE_MODULES`; do not add a runtime link to the repository.

Set `RUNTIME_NODE`, `RUNTIME_NODE_MODULES`, `RUNTIME_BIN_DIR` and `RUNTIME_PYTHON` to the supplied runtime locations. Set `HISAAB_DECK_WORKSPACE` to an absolute writable task directory and `HISAAB_MARKETING_SOURCE` to this source directory. `HISAAB_DECK_FILENAME` selects a new final filename for revisions; the finalizer deliberately refuses to overwrite an existing output. Run with the supplied runtime Node. The builder exports the PPTX, validates native text/tables and package structure, imports the exact final bytes, and renders every final slide for visual review.

The first delivered deck passed package integrity, geometry/font-policy checks, first-party reimport and both native table checks. It contains 10 slides, 10 source/assumption notes and no native charts or fabricated data. Full-slide inspection found no clipping or unintended overlap. This is not a claim of testing in Microsoft PowerPoint or Google Slides.

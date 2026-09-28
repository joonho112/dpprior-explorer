# Consolidated accessibility table (Step 11.3)

2026-09-25. One row per catalog id (72 ids), merged from the per-part audits below (Parts 1 to 5,
Steps 5.11 to 9.11) and completed for the ids those passes did not cover: the Phase 3-4 fast-track
widgets (P-05, P-07, P-08, M-01 to M-04, C-15), the ladder hub (P-16), the videos and talk material
(P-17, A-14 to A-16) and the Phase 10 studies (X-01, X-02, C-17). New column: the text alternative
(every chart has an aria-label; "data table" means a screen-reader table with the numbers). The new
rows were measured the same way as Part 5: each embed in a 375 px iframe in the browser pane (0 controls
without a name, 0 page overflow), dark mode by `?theme=dark`, reduced motion read from the code.

Result: **69 pass, 1 partial (X-02), 2 not built (C-17, X-01).**
X-02 is a third-party (R htmlwidgets) study page, kept for comparison; its plots are pointer-only and have
no text alternative, which the page says. X-01 and C-17 wait for the owner's approval to install their
tools (Phase 10).

Site-wide checks in the same step: every page at 375 px, including at first paint, has no horizontal
overflow (two new wide tables now scroll inside labelled, focusable regions; A-11 and A-12 start from the
container's real width instead of a 720 px default); `validate_palette` and `render_smoke` pass
(run_all). Screenshots: `verification/screenshots/mobile-dark-{P-05,P-07,A-11}.png`; see
`verification/responsive_audit.md`.

| Catalog | Widget or item | Keyboard | aria-live | Reduced motion | Dark | CVD | 375 px | Text alternative | Status |
|---|---|---|---|---|---|---|---|---|---|
| P-00 | finite-mixture | pass (5 controls, Enter redraws) | pass | pass (no animation) | pass | pass (Broderick family; dashed rest) | pass | pass (chart aria-labels + data table) | pass |
| P-01 | beta-lollipop | pass (11 controls, Enter draws) | pass | pass (auto-draw is user-started; no motion effects) | pass | pass | pass | pass (chart aria-labels + data table) | pass |
| P-02 | dirichlet-lollipop | pass (12 controls) | pass | pass | pass | pass (ternary: position) | pass | pass (chart aria-labels + data table) | pass |
| P-03 | paintbox | pass (8 controls incl. piece picker) | pass (read-out, piece note) | pass (markers land at once) | pass | pass (grey/blue also by the equal-cell grid) | pass | pass (chart aria-labels + read-out; no data table) | pass |
| P-04 | paintbox | pass (8 controls incl. piece picker) | pass (read-out, piece note) | pass (markers land at once) | pass | pass (grey/blue also by the equal-cell grid) | pass | pass (chart aria-labels + read-out; no data table) | pass |
| P-05 | stick-breaking | pass (12 controls: alpha slider, presets, Break, Play, Reset, seed) | pass (read-out) | pass (Play checks prefers-reduced-motion when pressed) | pass (dark-P-05, 375 px) | pass (pieces also ranked and labelled by size) | pass | pass (chart aria-labels + read-out; no data table) | pass |
| P-06 | hoppe-urn | pass (10 controls, Enter draws) | pass | pass (no growing balls; auto adds ten draws every 1.2 s) | pass (black ball kept dark with a light outline) | pass | pass | pass (chart aria-labels + data table) | pass |
| P-07 | crp | pass (13 controls: alpha slider, presets, Seat 1/10/100, Play, Reset, speed, seed, wording toggle) | pass (read-out) | pass (Play and seating animation check prefers-reduced-motion) | pass (dark-P-07) | pass (tables numbered by opening order; the new-table slot dashed) | pass (Step 11.3: the probability-bar sentence was clipped on phones, now shortened below 560 px) | pass (chart aria-labels + read-out; no data table) | pass |
| P-08 | crp-growth | pass (13 controls) | pass (read-out) | pass (no animation) | pass | pass (K_N staircase against the alpha log N guide, labelled) | pass | pass (chart aria-labels + data table) | pass |
| P-09 | dpmm | pass (8 controls incl. component picker) | pass (read-out, component note) | pass (no animation) | pass | pass | pass | pass (chart aria-labels + data table) | pass |
| P-10 | distributions-ladder | pass (6 controls; row buttons keep focus) | pass | pass (atoms placed at once) | pass | pass | pass | pass (chart aria-labels + read-out; no data table) | pass |
| P-11 | dp-atoms | pass (9 controls) | pass | pass (no animation) | pass | pass | pass | pass (chart aria-labels + data table) | pass |
| P-12 | dp-or-not | pass (9 controls) | pass | pass (no animation) | pass | pass (three lines differ in colour, legend and ceiling rules) | pass | pass (chart aria-labels + data table) | pass |
| P-13 | crp-gibbs | pass (13 controls, Enter steps a point) | pass (read-out, move note) | pass (no colour transitions; play advances one sweep every 400 ms) | pass | pass (new-cluster piece dashed; X marker) | pass | pass (chart aria-labels + read-out; no data table) | pass |
| P-14 | eppf-panel | pass (5 controls, Enter shuffles) | pass (read-out, factor line) | pass (no animation) | pass (labels by `labelOn`) | pass | pass | pass (chart aria-labels + read-out; no data table) | pass |
| P-15 | kj-replicates | pass (4 controls, Enter adds 100) | pass | pass (no animation) | pass | pass | pass | pass (chart aria-labels + data table) | pass |
| P-16 | DPM ladder hub (page, no widget) | pass (links only) | n/a (static) | n/a | pass | pass (status badges carry text) | pass | pass (page text) | pass |
| P-17 | video (media/stick_alpha.mp4) | pass (native video controls; no autoplay) | n/a (video) | pass (never autoplays) | n/a (light video frames on a dark page) | pass (numbers in the subtitle) | pass | pass (aria-label, key still, page text) | pass |
| M-01 | defaults-drift | pass (14 controls) | pass (read-out) | pass (no animation) | pass | pass (each default named at its line end) | pass | pass (chart aria-labels + data table) | pass |
| M-02 | defaults-drift (same widget as M-01) | pass (14 controls) | pass (read-out) | pass (no animation) | pass | pass (as M-01) | pass | pass (chart aria-labels + data table) | pass |
| M-03 | unintended-prior | pass (5 controls) | pass (read-out) | pass (no animation) | pass | pass (target and implied prior named in the legend and read-out) | pass | pass (chart aria-labels + data table) | pass |
| M-04 | method-problems-strip | pass (11 controls) | pass (read-out) | pass (no animation) | pass | pass (methods named per panel) | pass | pass (chart aria-labels + data table) | pass |
| M-05 | crp-unintended | pass (5 controls, restaurant picker) | pass | pass (fill skipped) | pass | pass | pass | pass (chart aria-labels + data table) | pass |
| M-06 | collapse | pass (9 controls) | pass (read-out, seating note) | pass (seating skipped) | pass | pass | pass | pass (chart aria-labels + data table) | pass |
| M-07 | prior-implications | pass (15 controls) | pass | pass (no animation) | pass | pass | pass | pass (chart aria-labels + data table) | pass |
| M-08 | method-timeline | pass (9 timeline nodes as `role="button"`, Enter or Space opens, arrows move, visible focus ring) | pass (read-out, card) | pass (no animation) | pass | pass (years and labels on every node; colour is secondary) | pass (vertical timeline below 560 px) | pass (chart aria-labels + data table) | pass |
| M-09 | doro-explorer | pass (6 controls) | pass | pass (no animation; path solved in the background) | pass | pass (target dashed, leak gold and beyond a rule) | pass | pass (chart aria-labels + data table) | pass |
| M-10 | scal-explorer | pass (2 controls) | pass | pass (no animation; path solved in the background) | pass | pass (tails also split by the threshold rule; shortcut as circles and dashes) | pass | pass (chart aria-labels + data table) | pass |
| M-11 | ssi-explorer | pass (14 controls incl. custom tails) | pass | pass (no animation) | pass | pass | pass | pass (chart aria-labels + data table) | pass |
| M-12 | quasi-degenerate | pass (11 controls) | pass | pass (no animation) | pass | pass (J curves also in a legend and read-out) | pass | pass (chart aria-labels + data table) | pass |
| M-13 | kn-diffuse | pass (7 controls) | pass | pass (no animation) | pass | pass (chosen n by line width; labels at each peak) | pass | pass (chart aria-labels + data table) | pass |
| M-14 | objective-priors | pass (4 controls) | pass | pass (no animation) | pass | pass (bars against a line; legend) | pass | pass (chart aria-labels + data table) | pass |
| M-15 | method-map | pass (5 controls; the "Strip for" list is the keyboard path to what hover shows) | pass (read-out, strip) | pass (no animation) | pass | pass (labelled priors; non-Gamma hollow; box and rule, not colour, carry the thresholds) | pass (short box label below 560 px) | pass (chart aria-labels + data table) | pass |
| M-16 | transported-vs-recalibrated | pass (5 controls) | pass | pass (no animation) | pass | pass (solid against dashed; legend) | pass | pass (chart aria-labels + data table) | pass |
| M-17 | dominance-ribbon | pass (7 controls, row picker) | pass (read-out, row note) | pass (no animation) | pass | pass | pass | pass (chart aria-labels + read-out; no data table) | pass |
| M-18 | sb-vs-ranked | pass (7 controls, row picker) | pass (read-out, row note) | pass (no animation) | pass | pass | pass | pass (chart aria-labels + read-out; no data table) | pass |
| M-19 | stirling-gamma | pass (3 controls) | pass | pass (no animation) | pass | pass (Sg dashed with dots, Gamma(2, 4) solid; legend) | pass | pass (chart aria-labels + data table) | pass |
| C-01 | tsmm-parity-table | pass (row buttons with `aria-pressed`; the table scrolls in a focusable region) | pass (path panel, read-out) | pass (no animation) | pass | pass (agree / differ / no-solution pills carry text) | pass (table scrolls sideways inside its region) | pass (chart aria-labels + data table) | pass |
| C-02 | tsmm-calibrator | pass (15 controls; Enter recalibrates) | pass (status tiles, read-out) | pass (no animation) | pass | pass (status in words; target mean dashed) | pass | pass (chart aria-labels + read-out; no data table) | pass |
| C-03 | vif-sensitivity | pass (16 controls incl. the nested C-04 panels) | pass (tiles, read-out) | pass (no animation) | pass | pass (current row highlighted and named in the tiles) | pass | pass (chart aria-labels + data table) | pass |
| C-04 | two-lenses | pass (9 controls) | pass | pass (no animation) | pass | pass | pass | pass (chart aria-labels + data table) | pass |
| C-05 | elicitation-form | pass (19 controls; number fields with labels, `aria-invalid` on bad input) | pass (tiles, read-out) | pass (no animation) | pass | pass (trigger pill in words; stated interval by opacity and in the text) | pass | pass (chart aria-labels + data table) | pass |
| C-06 | feasibility-map | pass (the draggable point is pointer-only; the mu_K and sigma^2 sliders are the keyboard route to the same two numbers) | pass (tiles, read-out; the chart label updates) | pass (no animation) | pass | pass (regions named on the chart and in a legend; bound marker labelled) | pass (short labels below 520 px) | pass (chart aria-labels + data table) | pass |
| C-07 | newton-path | pass (step slider, Play, 4 toggles) | pass | pass (Play jumps to the converged step) | pass | pass (R solid with dots, browser dashed with rings) | pass | pass (chart aria-labels + data table) | pass |
| C-08 | dual-anchor-frontier | pass (slider, 3 presets, 6 application buttons with `aria-pressed`) | pass | pass (no animation) | pass | pass (ineligible points grey and listed; the choice ringed and labelled) | pass | pass (chart aria-labels + data table) | pass |
| C-09 | reconcile-dashboard | pass (2 buttons, 2 sliders) | pass (tiles, read-out) | pass (the TSMM to Dual-Anchor move is immediate) | pass | pass (bar against labelled trigger and hard-bound rules) | pass | pass (chart aria-labels + data table) | pass |
| C-10 | bernoulli-sum | pass (3 sliders, Play) | pass | pass (Play jumps to all units added) | pass | pass (added units by line width; exact pmf as hollow dots) | pass | pass (chart aria-labels + data table) | pass |
| C-11 | timing-badges | pass (3 buttons) | pass (tiles, read-out) | pass (no animation) | pass | pass (sweep lines also solid, dashed and dotted, with a legend) | pass | pass (chart aria-labels + data table) | pass |
| C-12 | gamma-mixing | pass (9 controls + tick strip slider) | pass (read-out, node note) | pass (fade/morph skipped) | pass | pass (width cue) | pass | pass (chart aria-labels + data table) | pass |
| C-13 | workflow-stepper | pass (6 step buttons: Tab, Enter, left and right arrows; the diagram is a labelled picture that also takes clicks) | pass (step detail, read-out) | pass (no animation) | pass | pass (the fired branch is also thicker and says "yes: refine") | pass (vertical flow below 700 px) | pass (chart aria-labels + data table) | pass |
| C-14 | report-generator | pass (22 controls: labelled fields, 3 buttons) | pass (missing-item warning `role="status"`, copy result, read-out) | pass (no animation) | pass | pass (done / missing written in each cell and on each item) | pass | pass (chart aria-labels + read-out; no data table) | pass |
| C-15 | worked-example | pass (4 controls) | pass (read-out) | pass (no animation) | pass | pass (five labelled panels) | pass | pass (chart aria-labels + data table) | pass |
| C-16 | wmax-bounds | pass (8 controls) | pass | pass (no animation) | pass | pass | pass (incl. STAR panel) | pass (chart aria-labels + data table) | pass |
| C-17 | shinylive Studio-lite (not built: install approval pending) | not built | not built | not built | not built | not built | not built | not built | not built |
| A-01 | unit-caterpillar (star-caterpillar) | pass (12 controls) | pass (badges, read-out) | pass (the prior change animates only without reduced motion; checked at each change) | pass | pass (intervals excluding 0 thicker and listed; shift arrows labelled) | pass | pass (chart aria-labels + data table) | pass |
| A-02 | app-prior-strip | pass (8 controls) | pass | pass (no animation) | pass | pass (each prior in its own labelled row) | pass | pass (chart aria-labels + data table) | pass |
| A-03 | bd-forest | pass (10 controls) | pass | pass (as A-01) | pass | pass (raw estimates as squares, posterior as dots; REML benchmark labelled) | pass | pass (chart aria-labels + data table) | pass |
| A-04 | rasch-kpmf | pass (9 controls) | pass (tiles, read-out) | pass (no animation) | pass | pass (small-multiples view names each prior; Count-25 dashed) | pass | pass (chart aria-labels + data table) | pass |
| A-05 | rasch-density | pass (8 controls; follows the A-04 checkboxes) | pass | pass (no animation) | pass | pass (Gaussian benchmark grey and dashed; perfect scores gold with an outline and named in the tiles) | pass | pass (chart aria-labels + data table) | pass |
| A-06 | sim-dashboard | pass (13 controls) | pass | pass (no animation) | pass | pass (priors also by position, with short names on the axis; below 560 px two-letter names, rotated, and spelled out in the legend) | pass | pass (chart aria-labels + data table) | pass |
| A-07 | effects-vs-partition-tiles | pass (10 controls; the cell buttons are rebuilt per data mode) | pass | pass (no animation) | pass | pass (bars labelled by prior or lambda) | pass (bar-label margin fits the longest label) | pass (chart aria-labels + data table) | pass |
| A-08 | misspecification | pass (15 controls incl. the 3-stop r slider) | pass | pass (no animation) | pass | pass (Dual-Anchor dashed and DORO-Unif dotted besides colour; K* named at the line ends; rejected cells as crosses with a tooltip) | pass | pass (chart aria-labels + data table) | pass |
| A-09 | design-size | pass (13 controls incl. the 4-stop J slider) | pass | pass (no animation) | pass | pass (prior names at the line ends; thin subsets hollow; lambda badges in words) | pass | pass (chart aria-labels + data table) | pass |
| A-10 | ssi-truth | pass (14 controls) | pass | pass (no animation) | pass | pass (truth as a star, posterior as a bar and ring) | pass | pass (chart aria-labels + data table) | pass |
| A-11 | partition-vs-effects | pass (8 controls; the column heads are buttons with `aria-pressed` that pin a column, the keyboard route to the hover emphasis) | pass (badges, read-out) | pass (top-row changes and the column emphasis are immediate under reduced motion) | pass | pass (columns named; Vague baseline as a dashed black outline; unit effects neutral grey) | pass (segment labels move into the column heads below 170 px columns) | pass (chart aria-labels + data table) | pass |
| A-12 | spec-sensitivity | pass (6 controls; the HC3 button is `disabled` with a title for Bangert-Drowns) | pass (tiles, read-out) | pass (no animation) | pass | pass (primary fit as grey rings with an arrow to the new value; priors named on the axis) | pass (short prior names below 700 px) | pass (chart aria-labels + data table) | pass |
| A-13 | data-lineage-card | pass (26 controls: family filter, card links) | pass (the read-out announces the filter result: "N of 20 tables shown") | pass (no animation) | pass | pass (family named on every card and in the chart) | pass | pass (chart aria-labels + data table) | pass |
| A-14 | static PNGs (talk fallbacks) | pass (links and images only) | n/a (static) | n/a | pass | pass (still images of labelled widgets) | pass | pass (alt text on all 9 images) | pass |
| A-15 | reveal.js deck (reveal-poc/deck.html) | pass (reveal.js keyboard navigation: arrows, space, Esc overview) | n/a | pass (videos only on request; no auto-slide) | light deck theme only | as the embedded widgets | pass (1280 x 720 slides scale down) | pass (slide text; video aria-labels) | pass |
| A-16 | videos (media/crp_growth.mp4, k_prior_by_J.mp4) | pass (native video controls; no autoplay) | n/a (video) | pass (never autoplays) | n/a (light video frames on a dark page) | pass (tables numbered, counters in text; K pmf labelled) | pass | pass (aria-labels, key stills, page text) | pass |
| X-01 | Observable Framework (not built: install approval pending) | not built | not built | not built | not built | not built | not built | not built | not built |
| X-02 | R htmlwidgets (plotly frames; ggiraph shown as a picture) | partial (third-party: the plotly Play and slider take the mouse) | none (third-party) | partial (plotly frames play only when asked) | light only | pass (bars and one line, labelled axes) | pass (widgets scale; the size table scrolls inside a labelled region) | partial (the ggiraph picture has alt text; the plotly plot has none, its numbers are in alpha_sweep_J100.json) | partial |

# Per-part audits (history)

# Accessibility audit: Part 2 (CRP bridge) widgets

Step 5.11, 2026-09-24. Eight catalog widgets (nine embed pages: M-17 and M-18 share one
module). Checked in Chromium (the desktop app's browser pane) over http on the rendered
`docs/`, plus the headless-Chrome `file://` smoke of `verification/file_smoke.mjs`.

## Method

| Item | How it was checked |
|---|---|
| Keyboard | Every control is a native `<input type="range">`, `<button>` or `<input type="checkbox">` with a `<label>` or text; a script over each embed counted focusable controls without a name (0 in all) and controls with a negative `tabindex` (0 in all). Custom inspection in C-12 (tick strip, `role="slider"`, arrows/Home/End) was driven by `keydown` events. Enter runs the primary action where there is one (M-05, M-17/M-18, M-06). Canvas charts are not focusable; a labelled range input picks a row or restaurant instead. |
| aria-live | Each widget's read-out (`.dpx-readout`) is `aria-live="polite"`; hover and pick notes are live as well (C-12, M-17/M-18, M-06). Every `role="img"` element has a non-empty `aria-label` (0 missing). |
| Reduced motion | `window.matchMedia` was stubbed both ways in each animated widget. With *reduce*, the C-12 fade/morph, the M-05 fill (20 frames of 50 restaurants) and the M-06 seating (35 ms per customer) finish at once; with *no-preference* they animate (M-05 first frame "50 restaurants", M-06 first frame "1 seated", C-12 opacity .048 mid-transition). Note: the browser pane itself reports `prefers-reduced-motion: reduce`. |
| Dark mode | `?theme=dark` on every embed; colours come from `styles/tokens.css` through `palette()`, including Canvas fills, which are read at draw time. Screenshots: `verification/a11y/dark-m05.png`, `verification/a11y/dark-c12.png`. |
| CVD | Categorical colours are the validated families (`scripts/validate_palette.js`: Broderick and method families >= 40 sRGB under protan/deutan/tritan, light and dark). Meaning never rests on hue alone (CONTRACT 4): thresholds are dashed rules and positions, first pieces differ by opacity, node lines by width. The one close pair, `--dp-teal` against `--dp-slate` in dark mode under protan/deutan (11 to 25 sRGB), only co-occurs with a second cue: C-12 thin lines (1 to 1.4 px) against the 3.4 px sum, M-05 histogram bars against dots. |
| 375 px | Each embed was loaded in a 375 x 812 frame; `scrollWidth - clientWidth` was 0 on all nine, and no widget element extended past the right edge. Screenshot: `verification/a11y/mobile-375-m07.png`. |

## Results

| Catalog | Widget (embed) | Keyboard | aria-live | Reduced motion | Dark | CVD | 375 px |
|---|---|---|---|---|---|---|---|
| C-04 | two-lenses | pass (9 controls) | pass | pass (no animation) | pass | pass | pass |
| C-12 | gamma-mixing | pass (9 controls + tick strip slider) | pass (read-out, node note) | pass (fade/morph skipped) | pass | pass (width cue) | pass |
| M-05 | crp-unintended | pass (5 controls, restaurant picker) | pass | pass (fill skipped) | pass | pass | pass |
| M-17 | dominance-ribbon | pass (7 controls, row picker) | pass (read-out, row note) | pass (no animation) | pass | pass | pass |
| M-18 | sb-vs-ranked | pass (7 controls, row picker) | pass (read-out, row note) | pass (no animation) | pass | pass | pass |
| C-16 | wmax-bounds | pass (8 controls) | pass | pass (no animation) | pass | pass | pass (incl. STAR panel) |
| M-06 | collapse | pass (9 controls) | pass (read-out, seating note) | pass (seating skipped) | pass | pass | pass |
| M-07 | prior-implications | pass (15 controls) | pass | pass (no animation) | pass | pass | pass |

## Violations found and fixed

1. **Number labels on table circles** (P-07 `crp.js`, M-05 `crp-unintended.js`, M-06
   `collapse.js`) were white on every Broderick fill: 1.73:1 on yellow and 2.46:1 on orange
   in light mode, 1.48:1 on yellow in dark mode. New tokens `--label-light` / `--label-dark`
   and `chart.labelOn(fill)` pick the better of the two; `validate_palette.js` now checks the
   best label on each of the six fills in both schemes (lowest 4.67:1).
2. **Canvas charts as sliders** (M-05 wall, M-17/M-18 rows; found in Step 5.6): a canvas with
   `role="slider"` had no image description. The canvases are now `role="img"` with a summary
   `aria-label`, and a labelled range input ("Open restaurant", "Inspect row") does the picking.
3. **Log-axis labels** on the M-07 alpha tile overlapped for Gamma(0.037, 0.037)
   ("0.000001"); `logTickLabels` takes a formatter and writes `1e-6`.

## Not covered here

Screen-reader output was not recorded with VoiceOver; the audit checks names, roles and live
regions in the DOM. Contrast of text and interface colours is covered by the palette
validator in `run_all.sh`.

# Accessibility audit: Part 1 (DPM ladder) widgets

Step 6.13, 2026-09-24. Ten widget files, twelve embed pages (P-01 and P-02 share
`lollipop.js`; P-11 and P-12 share `dp-atoms.js`), checked the same way as Part 2 above.

| Catalog | Widget (embed) | Keyboard | aria-live | Reduced motion | Dark | CVD | 375 px |
|---|---|---|---|---|---|---|---|
| P-00 | finite-mixture | pass (5 controls, Enter redraws) | pass | pass (no animation) | pass | pass (Broderick family; dashed rest) | pass |
| P-01 | beta-lollipop | pass (11 controls, Enter draws) | pass | pass (auto-draw is user-started; no motion effects) | pass | pass | pass |
| P-02 | dirichlet-lollipop | pass (12 controls) | pass | pass | pass | pass (ternary: position) | pass |
| P-03, P-04 | paintbox | pass (8 controls incl. piece picker) | pass (read-out, piece note) | pass (markers land at once) | pass | pass (grey/blue also by the equal-cell grid) | pass |
| P-06 | hoppe-urn | pass (10 controls, Enter draws) | pass | pass (no growing balls; auto adds ten draws every 1.2 s) | pass (black ball kept dark with a light outline) | pass | pass |
| P-09 | dpmm | pass (8 controls incl. component picker) | pass (read-out, component note) | pass (no animation) | pass | pass | pass |
| P-10 | distributions-ladder | pass (6 controls; row buttons keep focus) | pass | pass (atoms placed at once) | pass | pass | pass |
| P-11 | dp-atoms | pass (9 controls) | pass | pass (no animation) | pass | pass | pass |
| P-12 | dp-or-not | pass (9 controls) | pass | pass (no animation) | pass | pass (three lines differ in colour, legend and ceiling rules) | pass |
| P-13 | crp-gibbs | pass (13 controls, Enter steps a point) | pass (read-out, move note) | pass (no colour transitions; play advances one sweep every 400 ms) | pass | pass (new-cluster piece dashed; X marker) | pass |
| P-14 | eppf-panel | pass (5 controls, Enter shuffles) | pass (read-out, factor line) | pass (no animation) | pass (labels by `labelOn`) | pass | pass |
| P-15 | kj-replicates | pass (4 controls, Enter adds 100) | pass | pass (no animation) | pass | pass | pass |

Measured by script on every embed: 0 controls without a name, 0 negative `tabindex`, every
`role="img"` with a non-empty label, a live read-out, and `scrollWidth - clientWidth` = 0
in a 375 px frame. Reduced motion was checked by stubbing `matchMedia` both ways in the
animated widgets (P-03 drop, P-06 auto and flash, P-10 relocation, P-13 play).

Fixed in this pass: the Hoppe urn's auto-play ran faster, not calmer, under reduced motion
(now ten draws every 1.2 s with no growing balls); its "black ball" turned white in dark mode
(now `--label-dark` with a `--fg` outline); its step strip text overflowed at 375 px (smaller
text placed after the balls below 420 px). Screenshots: `verification/a11y/dark-p03.png`,
`dark-p06.png`, `dark-p13.png`, `mobile-375-p06.png`.

The literal scan now covers these ten files as well (`verification/run_literal_scan.mjs`,
`WIDGETS`), with every numeric literal above 10 or non-integer allowlisted with a reason.

# Accessibility audit: Part 3 (problems) widgets

Step 7.14, 2026-09-25. Nine widget files, eleven catalog ids on eleven embed pages
(`ssi-truth` reuses `ssi-explorer.js` for A-10; `kn-diffuse` reuses `quasi-degenerate.js` for
M-13), checked the same way as Parts 1 and 2 above.

| Catalog | Widget (embed) | Keyboard | aria-live | Reduced motion | Dark | CVD | 375 px |
|---|---|---|---|---|---|---|---|
| M-08 | method-timeline | pass (9 timeline nodes as `role="button"`, Enter or Space opens, arrows move, visible focus ring) | pass (read-out, card) | pass (no animation) | pass | pass (years and labels on every node; colour is secondary) | pass (vertical timeline below 560 px) |
| M-09 | doro-explorer | pass (6 controls) | pass | pass (no animation; path solved in the background) | pass | pass (target dashed, leak gold and beyond a rule) | pass |
| M-10 | scal-explorer | pass (2 controls) | pass | pass (no animation; path solved in the background) | pass | pass (tails also split by the threshold rule; shortcut as circles and dashes) | pass |
| M-11 | ssi-explorer | pass (14 controls incl. custom tails) | pass | pass (no animation) | pass | pass | pass |
| A-10 | ssi-truth | pass (14 controls) | pass | pass (no animation) | pass | pass (truth as a star, posterior as a bar and ring) | pass |
| M-12 | quasi-degenerate | pass (11 controls) | pass | pass (no animation) | pass | pass (J curves also in a legend and read-out) | pass |
| M-13 | kn-diffuse | pass (7 controls) | pass | pass (no animation) | pass | pass (chosen n by line width; labels at each peak) | pass |
| M-14 | objective-priors | pass (4 controls) | pass | pass (no animation) | pass | pass (bars against a line; legend) | pass |
| M-19 | stirling-gamma | pass (3 controls) | pass | pass (no animation) | pass | pass (Sg dashed with dots, Gamma(2, 4) solid; legend) | pass |
| M-15 | method-map | pass (5 controls; the "Strip for" list is the keyboard path to what hover shows) | pass (read-out, strip) | pass (no animation) | pass | pass (labelled priors; non-Gamma hollow; box and rule, not colour, carry the thresholds) | pass (short box label below 560 px) |
| M-16 | transported-vs-recalibrated | pass (5 controls) | pass | pass (no animation) | pass | pass (solid against dashed; legend) | pass |

Measured by script on every embed at 375 px in the browser pane: 0 controls without a
name, 0 negative `tabindex`, every `role="img"` with a non-empty label, a live read-out, and
`scrollWidth - clientWidth` = 0. None of the nine files animates (the only timers fill the
M-09 and M-10 paths after the first paint), so reduced motion needs no branch. Dark mode:
`?theme=dark` on every embed (screenshots `verification/a11y/dark-m15.png`,
`dark-m12.png`); 375 px: `mobile-375-m08.png` (vertical timeline), `mobile-375-m15.png`.

Fixed in this phase: the visually hidden tables (`srTable`) widened pages at 375 px when
their cells held long sentences (a table ignores `width: 1px` under `white-space: nowrap`);
the class now sits on a wrapping `div` for all 20 widgets that use it. An embed caption with
an unbreakable `?preset=a|b|c` list overflowed; it is now a comma list. On the method map at
375 px the "hard bound" label moved to the empty left edge and the box label is shortened.
The file smoke's rule that every widget shows at least one `role="img"` chart led to the
timeline card's E K_J-by-J chart (the timeline itself is an interactive `role="group"`).

The literal scan covers these nine files too (`WIDGETS` in `run_literal_scan.mjs`); every
literal above 10 or non-integer has an allowlist row with a reason, and `grep '\.824'
js/widgets` finds nothing.

# Accessibility audit: Part 4 (DPprior principle) widgets

Step 8.15, 2026-09-25. Twelve new widget files on twelve embed pages (C-01 to C-03, C-05 to
C-11, C-13, C-14). C-04 (`two-lenses.js`, reused unchanged inside C-03) is in the Part 2 audit
above; C-12 (`gamma-mixing.js`, mounted again on the why-fast page) likewise.

| Catalog | Widget (embed) | Keyboard | aria-live | Reduced motion | Dark | CVD | 375 px |
|---|---|---|---|---|---|---|---|
| C-01 | tsmm-parity-table | pass (row buttons with `aria-pressed`; the table scrolls in a focusable region) | pass (path panel, read-out) | pass (no animation) | pass | pass (agree / differ / no-solution pills carry text) | pass (table scrolls sideways inside its region) |
| C-02 | tsmm-calibrator | pass (15 controls; Enter recalibrates) | pass (status tiles, read-out) | pass (no animation) | pass | pass (status in words; target mean dashed) | pass |
| C-03 | vif-sensitivity | pass (16 controls incl. the nested C-04 panels) | pass (tiles, read-out) | pass (no animation) | pass | pass (current row highlighted and named in the tiles) | pass |
| C-05 | elicitation-form | pass (19 controls; number fields with labels, `aria-invalid` on bad input) | pass (tiles, read-out) | pass (no animation) | pass | pass (trigger pill in words; stated interval by opacity and in the text) | pass |
| C-06 | feasibility-map | pass (the draggable point is pointer-only; the mu_K and sigma^2 sliders are the keyboard route to the same two numbers) | pass (tiles, read-out; the chart label updates) | pass (no animation) | pass | pass (regions named on the chart and in a legend; bound marker labelled) | pass (short labels below 520 px) |
| C-07 | newton-path | pass (step slider, Play, 4 toggles) | pass | pass (Play jumps to the converged step) | pass | pass (R solid with dots, browser dashed with rings) | pass |
| C-08 | dual-anchor-frontier | pass (slider, 3 presets, 6 application buttons with `aria-pressed`) | pass | pass (no animation) | pass | pass (ineligible points grey and listed; the choice ringed and labelled) | pass |
| C-09 | reconcile-dashboard | pass (2 buttons, 2 sliders) | pass (tiles, read-out) | pass (the TSMM to Dual-Anchor move is immediate) | pass | pass (bar against labelled trigger and hard-bound rules) | pass |
| C-10 | bernoulli-sum | pass (3 sliders, Play) | pass | pass (Play jumps to all units added) | pass | pass (added units by line width; exact pmf as hollow dots) | pass |
| C-11 | timing-badges | pass (3 buttons) | pass (tiles, read-out) | pass (no animation) | pass | pass (sweep lines also solid, dashed and dotted, with a legend) | pass |
| C-13 | workflow-stepper | pass (6 step buttons: Tab, Enter, left and right arrows; the diagram is a labelled picture that also takes clicks) | pass (step detail, read-out) | pass (no animation) | pass | pass (the fired branch is also thicker and says "yes: refine") | pass (vertical flow below 700 px) |
| C-14 | report-generator | pass (22 controls: labelled fields, 3 buttons) | pass (missing-item warning `role="status"`, copy result, read-out) | pass (no animation) | pass | pass (done / missing written in each cell and on each item) | pass |

Measured by script on every embed at 375 px in the browser pane (each embed in a 375 px iframe,
with a preset that shows its main state): 0 controls without an accessible name, 0 negative
`tabindex`, every `role="img"` with a non-empty label, at least two live regions, and
`scrollWidth - clientWidth` = 0. Reduced motion: C-07, C-09 and C-10 animate only on request
and check `prefers-reduced-motion` at the moment of the request (tested both ways: with the
pane's reduced-motion setting, and with `matchMedia` stubbed to false). Dark mode: `?theme=dark`
on every embed; screenshots `verification/a11y/dark-c07.png`, `dark-c10.png`, `dark-c13.png`;
375 px: `mobile-375-c06.png`, `mobile-375-c14.png`.

Fixed in this step: the C-11 sweep lines differed by colour only (now also by dash); the
not-yet-added part of the C-10 p_i line used the border colour and vanished in dark mode (now
muted text colour); the C-14 copy fallback kept a hidden textarea with `tabindex="-1"` in the
page (now created only while copying); C-02 printed E(alpha), CV(alpha) and sigma^2 below 1
without the leading zero (".846"), and its read-out for a point-mass answer said "0 Newton steps
from the A1 start Gamma(10000, …)" (now it names the point mass alpha* and the bound).

Literal rule: the twelve files are now in `WIDGETS` of `run_literal_scan.mjs` (38 files in
all); 361 (file, value) pairs got allowlist rows with a kind and a reason (1,255 rows). The
review found values typed in where they should be computed, five of them inside strings,
which the scan does not read: the C-07 path labels and alternative text ("(2.667, 2.608)",
"(1.4082, 1.0770)"), the C-03 reference row ("1.00"), the C-14 lambda-grid sentence, the C-13
normal quantile 1.2816 and its "VIF 2.5", and the C-11 warm-up prior (2.1, 3.1), a rounded copy
of the Vocabulary fit. All are now computed from the data or from dp-core. `grep '\.824'
js/widgets` finds nothing.

# Accessibility audit: Part 5 (evidence) widgets

Step 9.11, 2026-09-25. Twelve widget files on twelve embed pages (A-01 to A-09, A-11 to A-13) and
their caption helper `app-captions.js`. A-10 (`ssi-truth` embed) is in the Part 3 audit above;
A-14 and A-15 are static pictures and a slide deck without controls.

| Catalog | Widget (embed) | Keyboard | aria-live | Reduced motion | Dark | CVD | 375 px |
|---|---|---|---|---|---|---|---|
| A-01 | unit-caterpillar (star-caterpillar) | pass (12 controls) | pass (badges, read-out) | pass (the prior change animates only without reduced motion; checked at each change) | pass | pass (intervals excluding 0 thicker and listed; shift arrows labelled) | pass |
| A-02 | app-prior-strip | pass (8 controls) | pass | pass (no animation) | pass | pass (each prior in its own labelled row) | pass |
| A-03 | bd-forest | pass (10 controls) | pass | pass (as A-01) | pass | pass (raw estimates as squares, posterior as dots; REML benchmark labelled) | pass |
| A-04 | rasch-kpmf | pass (9 controls) | pass (tiles, read-out) | pass (no animation) | pass | pass (small-multiples view names each prior; Count-25 dashed) | pass |
| A-05 | rasch-density | pass (8 controls; follows the A-04 checkboxes) | pass | pass (no animation) | pass | pass (Gaussian benchmark grey and dashed; perfect scores gold with an outline and named in the tiles) | pass |
| A-06 | sim-dashboard | pass (13 controls) | pass | pass (no animation) | pass | pass (priors also by position, with short names on the axis; below 560 px two-letter names, rotated, and spelled out in the legend) | pass |
| A-07 | effects-vs-partition-tiles | pass (10 controls; the cell buttons are rebuilt per data mode) | pass | pass (no animation) | pass | pass (bars labelled by prior or lambda) | pass (bar-label margin fits the longest label) |
| A-08 | misspecification | pass (15 controls incl. the 3-stop r slider) | pass | pass (no animation) | pass | pass (Dual-Anchor dashed and DORO-Unif dotted besides colour; K* named at the line ends; rejected cells as crosses with a tooltip) | pass |
| A-09 | design-size | pass (13 controls incl. the 4-stop J slider) | pass | pass (no animation) | pass | pass (prior names at the line ends; thin subsets hollow; lambda badges in words) | pass |
| A-11 | partition-vs-effects | pass (8 controls; the column heads are buttons with `aria-pressed` that pin a column, the keyboard route to the hover emphasis) | pass (badges, read-out) | pass (top-row changes and the column emphasis are immediate under reduced motion) | pass | pass (columns named; Vague baseline as a dashed black outline; unit effects neutral grey) | pass (segment labels move into the column heads below 170 px columns) |
| A-12 | spec-sensitivity | pass (6 controls; the HC3 button is `disabled` with a title for Bangert-Drowns) | pass (tiles, read-out) | pass (no animation) | pass | pass (primary fit as grey rings with an arrow to the new value; priors named on the axis) | pass (short prior names below 700 px) |
| A-13 | data-lineage-card | pass (26 controls: family filter, card links) | pass (the read-out announces the filter result: "N of 20 tables shown") | pass (no animation) | pass | pass (family named on every card and in the chart) | pass |

Measured by script on every embed at 375 px in the browser pane (each embed in a 375 px iframe):
0 controls without an accessible name, 0 negative `tabindex`, every `role="img"` with a non-empty
label, two live regions (A-13: one, the read-out, which carries the filter result) and
`scrollWidth - clientWidth` = 0. Reduced motion: A-01, A-03 and A-11 animate with D3 and read
`prefers-reduced-motion` at each change (`reducedMotion()`); the A-11 column emphasis no longer
starts a zero-length transition (which applies its attributes a frame late). Dark mode:
`?theme=dark` on every embed; screenshots `verification/a11y/dark-a06.png`, `dark-a08.png`,
`dark-a11.png`; 375 px: `mobile-375-a06.png`, `mobile-375-a11.png`, `mobile-375-a12.png`.

Fixed in this step: A-06 hid its prior axis below 560 px, so the priors were told apart by colour
and order only (now rotated two-letter names, spelled out in the legend); A-08 drew TSMM and
Dual-Anchor with the same solid line, which overlap from mu_K = 10 on (now dashed and dotted for
Dual-Anchor and DORO-Unif, named in the legend); the A-11 column emphasis ran a zero-length
transition under reduced motion. Earlier in Phase 9: A-07, A-11 and A-12 got narrow-screen label
rules (Steps 9.7 and 9.10), and a functional dot radius was being passed through Plot's sqrt
radius scale, so the emphasized dots of A-08, A-09 and two earlier widgets were barely larger
(Step 9.9).

Literal rule: the thirteen files are now in `WIDGETS` of `run_literal_scan.mjs` (51 files in
all); 263 (file, value) pairs got allowlist rows with a kind and a reason (1,519 rows). Before the
rows were written, the values that are facts of the data were taken out of the code: the normal
quantile 1.959963984540054 in A-03 (now `dp.qnorm(0.975)`) and its point-mass threshold 1e4
(`dp.POINT_MASS_A`); the unit counts 79 and 48 in A-12 (read from `app_sensitivity.json`); the
simulation grids of A-06, A-08 and A-09 (K*, I, r, mu_K, J, read from the rows), with the axis
ticks, slider ranges and captions ("J = 100 sites, 200 replications per cell", "VIF 2.5",
"J = 25 → 200") built from them. A separate pass over the string text of the thirteen files
(which the scan does not read) found only design descriptions and labels (the prior names
N(0, .01) and N(0, 100), the 13-word checklist, N = 500 respondents, the citation year).

Captions: `verification/check_captions.mjs` (new, in `run_all.sh` as step 9 of 10) renders the six
evidence pages with widgets and finds the `app-captions.js` wording on each (read and kj
everywhere, retained on the simulation page, all four on the released-data page), and checks that
none of the twelve widget sources types a caption sentence itself.

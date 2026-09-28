# Responsive audit at 375 px (Step 11.3)

2026-09-25. Method: every rendered site page (56, `docs/**/*.html` without `embed/`, `apps/` and
`site_libs/`) loaded in a 375 px wide iframe in the browser pane from the local http server, measuring
`document.documentElement.scrollWidth - clientWidth` 120 ms after load (first paint, before a widget's
resize observer has fired) and again after 700 ms.

| Check | Before | After |
|---|---|---|
| Pages with horizontal overflow (after 700 ms) | 3: `pages/dpprior/plotly-alpha-sweep.html` (+219 px, the six-column cost table), `pages/tools.html` (+213 px, the status table), `pages/applications/partition-vs-effects.html` (+408 px at load) | 0 |
| Pages with overflow at first paint (120 ms) | `partition-vs-effects.html` (A-11 column heads and A-12 panel grid laid out for the 720 px default width) | 0 |

Fixes: wide Markdown tables go inside `::: {.dpx-table-scroll tabindex="0" role="region" aria-label="…"}`
(scrolls inside the region, keyboard focusable, with a visible focus ring; `styles/widgets.css`);
A-11 (`partition-vs-effects.js`) and A-12 (`spec-sensitivity.js`) start from
`ui.charts.getBoundingClientRect().width` instead of 720 px. Not a page overflow but found by the same
screenshots: the P-07 probability-bar sentence was clipped inside its SVG on phones (now a short form
below 560 px; the aria-label keeps the full sentence).

Mobile and dark screenshots (embed pages at 375 px with `?theme=dark`; `document.scrollWidth` 375 in each):

| Id | File | Query | scrollWidth |
|---|---|---|---|
| P-05 | `verification/screenshots/mobile-dark-P-05.png` | `embed/stick-breaking.html?alpha=2&theme=dark` | 375 |
| P-07 | `verification/screenshots/mobile-dark-P-07.png` | `embed/crp.html?alpha=1&theme=dark` | 375 |
| A-11 | `verification/screenshots/mobile-dark-A-11.png` | `embed/partition-vs-effects.html?app=star&theme=dark` | 375 |

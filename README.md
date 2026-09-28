# DPprior Explorer

Interactive visualizations for *Design-Conditional Prior Elicitation for Dirichlet
Process Mixtures* (Lee, 2026, [arXiv:2602.06301](https://arxiv.org/abs/2602.06301)). The pool
teaches the Dirichlet process mixture first (after Broderick's MLSS 2016 ladder), then uses the
same Chinese-restaurant and stick-breaking language to show what default hyperpriors on the
concentration parameter imply, and closes with the DPprior workflow and the paper's evidence.

**Author:** JoonHo Lee (jlee296@ua.edu), The University of Alabama.

**Status:** release 1.1.0. 72 catalog entries: 70 built, 2 waiting for tool installs (X-01
Observable Framework, C-17 shinylive). Site: https://joonho112.github.io/dpprior-explorer/

## Where the numbers come from and how they are checked

| | What | How it is checked |
|---|---|---|
| **Computes** | Prior quantities for any Gamma(a, b) or fixed alpha: the pmf and moments of K_J, Pr(K_J = 1), the size-biased and largest-weight tails, the TSMM calibration and its feasibility bounds, the default-method solvers (SSI, DORO, SCAL), simulated sticks, urns and restaurants | `dp-core` (TypeScript) against golden values from DPprior 2.0.0 and from base-R integrals that share no code with the engine: 17,351 comparisons in 147 groups, 0 failures, no skips (`verification/parity_report.md`); 63 engine tests |
| **Reads, never recomputes** | Every posterior result, simulation summary and application number: 20 released tables (1.30 MB) exported from the replication package | `verification/check_data_contract.mjs` (sources, rows, columns, licences, checksums, no individual-level fields outside one allowlisted file) |
| **Shows** | The numbers on the widget pages | `verification/check_readouts.mjs` opens the embed pages (and the prose of two site pages) and compares 117 displayed numbers in 28 cases on 20 widgets and 2 site pages with the R oracle, golden values, closed forms and released tables, and makes six paper cross-checks of the released tables; `verification/check_states.mjs` checks that each calibration status is shown as the engine returns it |
| **Refuses** | Posterior fitting in the browser, individual-level data (STAR pupils, OCRS records, raw responses), results typed into code, significance language | literal scan (no result typed into the engine or any of the 62 widget files, in code or in strings), vocabulary scan, caption check |

**Limits.** The checks cover listed rows and values, not every number on every page: parity
compares the golden rows named in `verification/parity_spec.csv`, and the read-out check the
cases listed in `verification/check_readouts.mjs`. The released tables are checked for
provenance, form and checksums, and in six paper cross-checks against the paper; they are copied
from the replication package's outputs, not re-derived here (MCMC is never rerun). The R
scripts that wrote the golden values and the tables are in `r-export/` and can be rerun from a
clone (`r-export/README.md`).

## What is in it

- **Five parts** (57 pages): 1 · Learn the DPM (a nine-rung ladder), 2 · CRP bridge, 3 · Default
  problems, 4 · DPprior (the workflow step by step), 5 · Evidence (STAR, Bangert-Drowns, a
  vocabulary test, the simulation, the partition against the effects).
- **72 visualizations**, each with a page and, for widgets, a standalone embed page
  (`embed/<name>.html`, URL parameters for presets). The [catalog](https://joonho112.github.io/dpprior-explorer/catalog.html)
  filters them by section, ladder rung and audience.
- **Learning paths:** 25 minutes for beginners, 45 for researchers, 90 for a course, with
  settings, times and instructor notes (`learning-paths.qmd`).
- **Talk material:** three short videos (gganimate), static fallbacks, and a reveal.js deck that
  embeds widgets offline (next to this repository, `reveal-poc/`).

## Use it

- Open the site, or a local copy of `docs/` from the file system: every widget is a small
  script bundle with vendored D3 and Observable Plot, so pages work offline and from `file://`.
- Put a widget in a slide or page with an iframe of its embed page, for example
  `embed/stick-breaking.html?alpha=2&theme=dark`, or mount it directly:
  `DPX["stick-breaking"].mountWidget(element, { alpha: 2 })` after loading
  `js/bundles/stick-breaking.js` (see `CONTRACT.md`).

## Related

| Resource | Link |
|---|---|
| Paper (arXiv) | https://arxiv.org/abs/2602.06301 |
| DPprior R package documentation (pkgdown) | https://joonho112.github.io/DPprior/ |
| DPprior Studio (Shiny app) | https://joonho.shinyapps.io/dpprior-studio/ |
| Replication package | https://github.com/joonho112/DPprior-paper-replication |
| This site | https://joonho112.github.io/dpprior-explorer/ |

## Layout

| Path | Role |
|---|---|
| `_quarto.yml`, `index.qmd`, `catalog.qmd`, `learning-paths.qmd`, `pages/` | Quarto website (renders to `docs/`, the GitHub Pages source) |
| `engine/` | TypeScript engine `dp-core` (library build to `js/dp-core.js`) and the bundler; not rendered |
| `js/` | built engine, widgets (`mountWidget(el, spec) -> {update, destroy}`), bundles, vendored Plot/D3 |
| `embed/` | one standalone HTML page per widget, for iframes and slides |
| `data/precomputed/`, `data/released/` | precomputed grids / released summary JSON with `data_contract.json` (source, checksum and licence scope of every file) |
| `media/`, `apps/` | videos and key stills; R htmlwidgets pages (X-02) |
| `verification/` | golden CSVs, parity runner, scans, catalog, data-contract, status, read-out and document checks, audits; not rendered (`verification/README.md`) |
| `r-export/` | the R scripts that wrote the golden values, precomputed grids and released JSON; need the DPprior 2.0.0 source and the replication package; not rendered (`r-export/README.md`) |
| `catalog/` | `catalog.json` (one entry per visualization), `schema/`, `thumbs/` |
| `styles/`, `scripts/` | design tokens, palette validator, Quarto pre/post-render hooks |
| `CONTRACT.md` | widget API, embedding, catalog, colour/accessibility and numerical rules |

## Build and check

```bash
cd engine && npm run build && npm run bundles   # dp-core (ES + UMD) and widget bundles
bash verification/run_all.sh                    # the full gate
```

`run_all.sh` has fourteen steps: palette (WCAG AA and colour-vision separation), engine unit tests
(63), parity against the R golden values, literal scan, vocabulary scan, catalog and data
contract, build, site render, jsdom render smoke, evidence captions, calibration statuses,
read-outs, headless-Chrome `file://` smoke, and document numbers (every count this README quotes
must match the run). `engine/node_modules` is not committed; `npm ci` in `engine/` restores it. The rendered site
in `docs/` is committed, so the site survives without the toolchain.

## Cite and licence

Please cite the paper (see `CITATION.cff`). Code: MIT (`LICENSE`). Text, figures and the
author's contribution to the released data: CC BY 4.0 (`LICENSE-DATA`); the per-unit inputs from
Project STAR and Bangert-Drowns et al. keep their upstream terms, and the vocabulary tables carry
the Item Response Warehouse's derived licence (each file's scope is in `data_contract.json`). Teaching widgets after Broderick are re-implemented from the
mathematics and attributed; no GPL code is ported (`ATTRIBUTION.md`).

This work was supported by the Institute of Education Sciences, U.S. Department of Education,
through Grant R305D240078. The opinions expressed are those of the author and do not represent
views of the Institute or the U.S. Department of Education.

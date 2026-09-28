# Changelog

## 1.1.0 (2026-09-28)

This release follows a full audit of 1.0.0 (numerics, checks, documents and release rights);
1.0.0 itself was never published.

- **TSMM near the edges** (C-02, C-05, C-06): a target just above the profile bound gets its
  exact Gamma solution (a one-dimensional profile solve on a concentrated grid) instead of an
  approximate point mass reported as calibrated; the support rule is the per-mean ceiling
  (mu_K - 1)(J - mu_K) instead of (J - 1)^2 / 4; `checkTarget` and `tsmmFit` share one
  feasibility rule; six statuses (ok, point-mass, approximate, infeasible, support,
  no-convergence), and a success always meets the tolerance.
- **Engine** (dp-core 0.2.0): Gamma priors with a > 1e4 are integrated on a concentrated grid
  (a true point mass only from a = 1e15); conditional moments use finite sums when alpha > J,
  where the digamma path cancelled (E K_J > J at J = 201, alpha = 1e12).
- **Widgets and pages:** the calibration widgets show the status, the target and the achieved
  moments; "point mass" now only describes an exact solution with CV(alpha) < .01; C-06 no
  longer overflows a 375-pixel screen.
- **Verification** (the gate has fourteen steps): parity has 17,351 comparisons in 147 groups,
  0 failures and no skips, with new golden files from base-R oracles (u-space integrals for the
  moments and P(K_J = 1), the exact W_max tail, TSMM near the bounds), and a spec row that
  compares nothing now fails; the literal scan reads all 62 widget files and the numbers inside
  strings; new checks for calibration statuses, read-outs (117 displayed numbers in 28 cases on
  20 widgets and 2 site pages, and six paper cross-checks of the released tables) and document
  numbers; 63 engine tests.
- **Release rights:** every released table states what its CC BY 4.0 licence covers
  (`license_scope`, `upstream`, `rights_record`, from `r-export/data_rights.csv`): the per-unit
  inputs of the STAR and Bangert-Drowns tables keep their upstream terms, and the vocabulary
  tables carry the IRW derived licence. The data contract check enforces the statement; the
  A-13 cards, the data page, `LICENSE-DATA` and `ATTRIBUTION.md` show it.
  `verification/audit_history.mjs` lists every third-party file in the repository's history with
  its licence and flags copyleft files; the published history holds none.
- **Wider checks:** every site page at 1280 and 375 pixels and in dark
  mode, and every embed in dark mode at 375 pixels, opened with real viewport emulation: no
  script error, no horizontal overflow, no empty widget. The elicitation example "[3, 10] with
  80% probability" (Pr(W_SB > .5) = .4002, just above the .40 trigger) is recomputed by the
  independent solver and checked on C-05 and on its page; the specification sensitivity on A-12
  and the simulation's size on C-11, A-13 and the data page are checked against the released
  tables.
- **Colour identity:** in the collapsed Gibbs sampler (P-13)
  a cluster keeps the lowest free colour for as long as it lives, so up to six clusters never
  share one (colours keyed on the growing cluster ids had clashed in most sweeps); P-00 and
  P-09 number their components on the scatter and on the stick.
- **Documents and reproducibility:** the home page and README separate the two routes of the
  numbers (computed prior quantities, read posterior and simulation tables) and state what the
  checks do not cover; CONTRACT sections 6, 7 and 12 match the code; the R exporters moved into
  the repository (`r-export/`, scripts 01 to 15) with required inputs, and
  `verification/compare_rerun.mjs` compares a rerun with the committed files.

## 1.0.0 (2026-09-25, not published)

The pool is complete: 72 catalog entries, 70 built and 2 waiting for tool installs.

- **Part 1 · Learn the DPM** (P-00 to P-17): a nine-rung ladder after Broderick's MLSS 2016
  lectures, from a finite mixture to the collapsed Gibbs sampler, with exercises and a video.
- **Part 2 · CRP bridge** (C-04, C-12, C-16, M-05 to M-07, M-17, M-18): one alpha read as a
  count (K_J) and as a weight (W_SB), Gamma mixing, dominance and collapse.
- **Part 3 · Default problems** (M-01 to M-04, M-08 to M-16, M-19, A-10): same default at different J, the
  unintended prior, DORO, SCAL and SSI, other defaults, the method map.
- **Part 4 · DPprior** (C-01 to C-03, C-05 to C-11, C-13 to C-15): TSMM calibration checked against R, elicitation,
  feasibility, the Newton path, the Dual-Anchor frontier, the workflow and a reporting checklist.
- **Part 5 · Evidence** (A-01 to A-16 except A-10): Project STAR, Bangert-Drowns, a vocabulary test, the
  simulation (Figures 4 to 6), the partition against the effects, specification sensitivity,
  released-data lineage, talk fallbacks and videos. Posterior results are read from 20 released
  tables, never recomputed.
- **Tools** (X-02 done; X-01, C-17 waiting): an R htmlwidgets study (plotly frames, ggiraph
  hover) with measured costs; Observable Framework and shinylive need the maintainer's approval
  to install.
- **Navigation:** catalog filters by section, ladder rung and audience; learning paths for
  beginners (25 min), researchers (45 min) and a course (90 min) with instructor notes.
- **Verification gate** (`verification/run_all.sh`, 11 steps): palette, 57 engine tests, parity
  (17,013 comparisons against DPprior 2.0.0, 0 failures, including the Dual-Anchor golden),
  literal scan (engine and 51 widget files), vocabulary scan, catalog and data contract, build,
  render, jsdom render smoke, evidence captions, headless-Chrome `file://` smoke.
- **Accessibility:** one audit table for all 72 ids (69 pass; X-02 partial as a third-party
  study; X-01 and C-17 not built); every page checked at 375 px.

## 0.1.0 (2026-09-24)

- Site skeleton (Quarto website rendered to `docs/`), design tokens and palette validator,
  `CONTRACT.md` (widget API, embedding, catalog, accessibility, numerical rules).
- `dp-core` engine (TypeScript): counts, Gamma mixtures, weights, elicitation, sampling;
  15,936 parity comparisons against DPprior 2.0.0 golden values, 0 failures.
- First widgets: M-01/M-02 "Same default, different J" (paper Fig. 2) and M-03 "The
  unintended prior" (paper Fig. 1), each with a page and a standalone embed.
- Verification gate `verification/run_all.sh`: palette, unit tests, parity, literal
  scan, catalog, build, render, jsdom smoke, headless-Chrome file:// smoke.

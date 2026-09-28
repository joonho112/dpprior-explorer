# Attribution

DPprior Explorer is original code (MIT) and text (CC BY 4.0) by JoonHo Lee. It draws on
the sources below. No third-party code is copied except the vendored libraries listed
at the end, and no slide or figure image from another author is embedded.

## The paper and its software

- Lee, J. (2026). *Design-Conditional Prior Elicitation for Dirichlet Process Mixtures:
  A Unified Framework for Cluster Counts and Weight Control.* arXiv:2602.06301.
  https://arxiv.org/abs/2602.06301
- DPprior R package (version 2.0.0 source): golden values in `verification/golden/` are
  computed with it (`pkgload::load_all`). Documentation: https://joonho112.github.io/DPprior/
- Replication package: https://github.com/joonho112/DPprior-paper-replication (code MIT,
  released summaries CC BY 4.0). Values cross-checked or reused from it are marked on
  each page and in the data files.
- DPprior Studio (Shiny app): https://joonho.shinyapps.io/dpprior-studio/

## Released data used in the browser

`data/released/` holds summary tables copied from the replication package's
`data-derived/` folder (`r-export/07_export_released_summaries.R`), with
`data_contract.json` recording each file's source, level, rows, columns, caption, sha256
and rights statement. They are posterior results of the paper's analyses: the site reads them and never
recomputes them (no MCMC is rerun). Simulation displays keep the paper's retained-fit
denominators: 8,607 of 9,000 planned fits in the 45 main cells (57,151 of 64,400 across all
suites). Application tables are school- (STAR, J = 79) or study-level (Bangert-Drowns,
J = 48); the vocabulary tables are score-group summaries of N = 500 respondents.
The replication package also contains an OCRS application; its contrasts are descriptive
school-level contrasts, not the study's original blocked intent-to-treat analysis, and this
site does not use them. No pupil-level STAR records, response-level IRW data, individual
posterior draws or OCRS records are redistributed here.

**What CC BY 4.0 covers.** The grant covers the author's contribution and nothing more
(`LICENSE-DATA`). The simulation and calibration tables are the author's own output and are
covered whole. The application tables hold the author's posterior summaries of data that
belong to others, and the per-unit inputs in `star_units.json` and `bd_units.json` (the
estimate `tau_hat`, its standard error `se` and the size `n_j`) come straight from those data:
Project STAR through the R package mlmRev, and Bangert-Drowns, Hurley and Wilkinson (2004)
through the R package metadat. Both packages are distributed under GPL (>= 2), a package
licence rather than a separate grant for the original study data, so these inputs keep their
upstream terms and are not relicensed here. The vocabulary tables derive from an Item Response
Warehouse table whose derived licence is CC BY 4.0, subject to upstream rights (collected by
the Open-Source Psychometrics Project; scale by Brotherton, French and Pickering, 2013). Each
file's `license_scope`, `upstream` and `rights_record` in `data_contract.json` say this per
table (`r-export/data_rights.csv`), following the replication package's `LICENSE-SCOPE.md` and
`provenance/data-rights.csv`.

One file holds anonymous respondent-level derived values: `data/released/rasch_respondents.json`
(`r-export/09_irw_respondents.R`) gives, for each of the N = 500 sampled respondents of the
vocabulary checklist, a new row number, the raw score on the 13 real words, the Warm WLE
and its standard error under the Dual-Anchor item difficulties, and a perfect-score flag.
It contains no responses, no source IDs and no ages, and its rows are ordered by raw score.
The source is the Item Response Warehouse table `gcbs_brotherton_2013_vcl` (IRW Data
Dictionary: Public; derived licence CC BY 4.0; original-licence field missing). The data
were collected by the Open-Source Psychometrics Project alongside its October 2016 survey for
the Generic Conspiracist Beliefs Scale (Brotherton, French, & Pickering, 2013) and are
distributed by the Item Response Warehouse. Our modifications follow the replication
package: a fixed 500-person sample, removal of the nonwords VCL6, VCL9 and VCL12 after
sampling, and scoring with fixed item difficulties. The file is shared under CC BY 4.0,
subject to upstream rights.

## Teaching material (re-implemented from the mathematics)

- Broderick, T. (2016). *Nonparametric Bayesian statistics.* Lectures at the Machine
  Learning Summer School (MLSS), Cádiz, parts I–III (slides and video recordings).
- Broderick, T. (2012). *Clusters and features from combinatorial stochastic processes.*
  Tutorial slides (13 September 2012).
- Broderick, T. `bnp_tutorial` R demonstrations (`ex1_beta.R` … `ex7_sampler.R`),
  licensed GPL-3. **No code from these scripts is ported.** The widgets re-implement the
  underlying mathematics (Beta, Dirichlet, GEM stick-breaking, the Chinese restaurant
  process, DP mixtures) from their published definitions, in MIT-licensed TypeScript and
  JavaScript. The demos' default settings (for example GEM with alpha = 1, 10, 100) and
  visual conventions (staircase stick-breaking; piece colours blue, orange, green,
  purple, red, yellow; grey for generated but unused components; white for remaining
  mass; a red marker for a uniform draw) are followed and credited on each page as
  "After Broderick (MLSS 2016; 2012 tutorial)".
- Correspondence between the demos and this site's widgets (each re-implemented, none
  ported): `ex1_beta.R` → P-01 Beta lollipop; `ex2_dirichlet.R` → P-02 Dirichlet
  lollipop and ternary view; `ex3` and `ex4` (large-K Dirichlet, order of appearance) →
  P-03 paintbox and P-04 staircase; `ex5_gem.R` → P-05 stick-breaking; `ex6` (DP mixture
  generation) → P-09 DP mixture generator; `ex7_sampler.R` → P-13 collapsed Gibbs sampler
  (engine `gibbs.ts`, Neal's Algorithm 3). Rung 0 (P-00), the Hoppe urn (P-06), the
  distributions ladder and DP atoms (P-10 to P-12) and the ladder hub (P-16) follow the
  lectures' slides rather than a demo script.

## Visual grammar

- Giordano, R. Presentation repository (slides on sensitivity, influence and
  approximation). Some pages borrow its visual grammar (annotated overlays on a fixed
  figure; side-by-side comparisons; a sensitivity curve with an uncertainty ribbon).
  No slide content or image is reproduced; pages that use the grammar say so.
- Giordano, R., Liu, R., Jordan, M. I., & Broderick, T. (2023). Evaluating sensitivity
  to the stick-breaking prior in Bayesian nonparametrics. *Bayesian Analysis.*
  arXiv:2107.03584. Cited where the sensitivity of the number of clusters to the
  concentration parameter is discussed.

## Vendored libraries

| Library | Version | Licence | File |
|---|---|---|---|
| D3 | 7.9.0 | ISC | `js/vendor/d3.min.js` (`js/vendor/d3.LICENSE`) |
| Observable Plot | 0.6.17 | ISC | `js/vendor/plot.min.js` (`js/vendor/plot.LICENSE`) |

Build and test tools (not shipped): TypeScript, Vite, esbuild, jsdom, Quarto.

## Funding

This work was supported by the Institute of Education Sciences, U.S. Department of
Education, through Grant R305D240078 to The University of Alabama. The opinions
expressed are those of the author and do not represent views of the Institute or the
U.S. Department of Education.

### Libraries in `apps/htmlwidgets/lib/` (X-02, Step 10.4)

Generated unmodified by the R packages plotly 4.12.0, htmlwidgets 1.6.4 and crosstalk 1.2.2 (all
MIT) when `r-export/08_plotly_frames.R` saves the plotly widget: plotly.js 2.25.2 (MIT), jQuery
3.5.1 (MIT), crosstalk 1.2.2 (MIT), the htmlwidgets and plotly bindings (MIT) and typedarray 0.1.
The GPL-licensed pieces those R packages can add are left out on purpose: ggiraph's JavaScript
(GPL-3; the ggiraph chart is shown as a static PNG) and htmltools' `fill.css` (GPL >= 2).


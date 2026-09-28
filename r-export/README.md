# r-export

R scripts that write the golden values in `verification/golden/`, the precomputed grids in
`data/precomputed/` and the released-summary JSON in `data/released/`. The site never runs R;
these scripts are how its fixed files were made, and how anyone can make them again.

Each script runs in its **own `Rscript` process**. A script that needs DPprior loads the
**2.0.0 source** with `pkgload::load_all()` and stops if an installed DPprior is attached; it never
installs or upgrades a package. Gamma mixtures are integrated with `integrate()` (never the
package default Gauss-Laguerre M = 80, which gives the stale .824 for `P(K_100 = 1)` under
Gamma(0.037, 0.037); the value is .8336). Numerical rules: `CONTRACT.md` sections 6 and 7.

## Inputs

| Variable | What | Needed by |
|---|---|---|
| `DPPRIOR_PKG` | the DPprior 2.0.0 source tree (`DESCRIPTION` says `Version: 2.0.0`) | 01–06, 08, 13, 14 |
| `REPL_DIR` | a checkout of [DPprior-paper-replication](https://github.com/joonho112/DPprior-paper-replication) | 02, 03, 05, 07, 09–13 |
| `EXPLORER_DIR` | the root of this repository (default `..`, so run the scripts from `r-export/`) | all |
| `IRW_RDS` | a local copy of the public IRW table `gcbs_brotherton_2013_vcl` (`.rds`) | 09 only |

`DPPRIOR_PKG` and `REPL_DIR` have no defaults (`_paths.R`): a script that needs one stops and
says which. R packages: `pkgload`, `jsonlite`, `yaml`, `metadat` (10); `ggplot2`, `gganimate` and
ffmpeg (04); `plotly`, `ggiraph`, `htmlwidgets`, `gdtools` (08).

## Scripts

| Script | Writes | Needs | Rerun check |
|---|---|---|---|
| `01_golden_closed_forms.R` | 14 golden CSVs (Stirling rows, conditional moments and pmf, log rising factorials, W_SB, rho, A1 start, elicitation conversions, marginal moments, pmf and quantiles, W_max) and `golden_manifest.csv` (keeps the other scripts' rows) | `DPPRIOR_PKG` | yes |
| `02_methods_catalog.R` | `data/precomputed/method_catalog.{json,js}`, golden `method_catalog.csv` | both | yes |
| `03_recalibrate_by_J.R` | `data/precomputed/count_prior_by_J.{json,js}`, golden `count_prior_by_J.csv` | both | yes |
| `04_gganimate.R` | `media/*.mp4` and key frames (P-17, A-16) | `DPPRIOR_PKG`, ffmpeg | no (video) |
| `05_golden_v2_solvers.R` | golden `solvers.csv`, `tsmm_fits.csv` | both | yes |
| `06_jeffreys_sg_grid.R` | `data/precomputed/jeffreys_sg.{json,js}` | `DPPRIOR_PKG` | yes |
| `07_export_released_summaries.R` | 15 files in `data/released/` with `.js` twins, `data_contract.{json,js}` (keeps the entries 09–12 add) | `REPL_DIR` | yes |
| `08_plotly_frames.R` | `data/precomputed/alpha_sweep_J100.json`, `apps/htmlwidgets/` (X-02) | `DPPRIOR_PKG`, plotly, ggiraph | no (htmlwidgets page) |
| `09_irw_respondents.R` | `data/released/rasch_respondents.{json,js}` (anonymous derived scores, no responses) | `REPL_DIR`, `IRW_RDS` | no (needs the IRW table) |
| `10_export_bd_moderator.R` | `data/released/bd_moderator.{json,js}` | `REPL_DIR` | yes |
| `11_export_rasch_posterior.R` | `data/released/rasch_posterior.{json,js}`, `rasch_gaussian.{json,js}` | `REPL_DIR` | yes |
| `12_export_app_sensitivity.R` | `data/released/app_sensitivity.{json,js}` | `REPL_DIR` | yes |
| `13_golden_dual_anchor.R` | golden `dual_anchor.csv` | both | yes |
| `14_golden_tsmm_boundary.R` | golden `tsmm_boundary.csv`: an independent u-space solver near the profile bound, with DPprior_fit for reference | `DPPRIOR_PKG` | yes |
| `15_oracle_u_space.R` | golden `oracle_u_space.csv`, `oracle_wmax.csv`: base-R integrals over u = F(alpha), no package code | none | yes |

Shared code: `_paths.R` (inputs and output root), `_helpers.R` (Gamma mixtures on log-alpha
panels; non-Gamma priors on alpha), `_oracle.R` (the u-space quadrature of 14 and 15, which
shares nothing with the log-alpha grids), `_rights.R` with `data_rights.csv` (the licence scope,
upstream source, terms and fields and the rights record of every released table; 07 and 09–12
apply it to `data_contract.json`). Each script that writes a golden CSV also writes its
row of `golden_manifest.csv` (sha256, rows, method, tolerances, R version, time).

## Rerun and compare

From a clone of this repository:

```bash
cd r-export
export DPPRIOR_PKG=/path/to/DPprior-R-package-v2
export REPL_DIR=/path/to/DPprior-paper-replication
mkdir -p logs
for s in 01 03 02 05 06 13 14 15 07 10 11 12; do Rscript ${s}_*.R > logs/${s}.log 2>&1 || { echo "script ${s} failed, see logs/${s}.log"; break; }; done
cd .. && node verification/compare_rerun.mjs
```

`compare_rerun.mjs` compares every file under `verification/golden/` and `data/` with the
committed version and passes when they differ only in `generated_at` timestamps (it also
accepts a different row order in `golden_manifest.csv`, where each script moves its own rows
to the end). In the order above the manifest rows come back in the committed order, so
`git diff` shows only timestamp lines; 15 must follow 05 and 13, whose golden files it reads.
Then `bash verification/run_all.sh` runs the full gate (after `npm ci` in `engine/`). `logs/` is not committed (the
logs name local paths). 04, 08 and 09 are left out of the loop: they make a video, an
htmlwidgets page and a file from the IRW table.


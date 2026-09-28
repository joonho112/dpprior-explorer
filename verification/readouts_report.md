# Read-out report

Written by `verification/check_readouts.mjs` on 2026-09-28T21:56:45.627Z from the rendered embeds in `docs/embed/`.

**Result: PASS**; 117 displayed numbers in 28 cases on 20 widgets and 2 site pages; 6 paper cross-checks of the released tables.

| case | embed page | shown | authority | result |
|---|---|---|---|---|
| P-05 alpha .5 | stick-breaking?alpha=0.5 | .667, .707 | closed form | pass |
| P-05 alpha 2 | stick-breaking?alpha=2 | .250 | closed form | pass |
| P-05 alpha 10 | stick-breaking?alpha=10 | .001 | closed form (.00098 prints as .001) | pass |
| P-07 E K_79 at alpha 1 | crp?alpha=1 | 4.95 | closed form (harmonic number) | pass |
| P-15 E K_100 at alpha 1 | kj-replicates?J=100&alpha=1&n=200&seed=1 | 5.19 | closed form (harmonic number) | pass |
| C-04 Gamma(1,1) J 100 | two-lenses?a=1&b=1&J=100 | 4.84, .591, .303 | oracle; closed form | pass |
| M-01 Gamma(1,1) E K_J | defaults-drift | 4.16, 4.84, 7.82, 8.73, .591, 4.12, 4.61, 6.44 | oracle (paper Fig. 2: 4.16 / 4.84 / 7.82 / 8.73); closed form | pass |
| M-03 Fig 1 tail | unintended-prior | 5, .487 | closed form (paper Fig. 1: .49) | pass |
| M-05 Fig 1 exact E K_50 | crp-unintended?a=1.6&b=1.22&J=50&seed=1 | 5.05 | oracle (paper Fig. 1 note: 5.05) | pass |
| M-06 Gamma(1,1) collapse | collapse?preset=g11 | .095, .192, .175, .168, .132 | closed form; oracle | pass |
| C-02 J = 50 TSMM | tsmm-calibrator?preset=j50 | 1.4082, 1.0770, .497 | golden tsmm_fits.csv (DPprior 2.0.0; paper Sec. 3.5: Gamma(1.4082, 1.0770), .497) | pass |
| C-08 Dual-Anchor choice | dual-anchor-frontier | .30, 2.3158, 1.4204, .398, 5.88 | golden dual_anchor.csv; oracle (paper: lambda .30, Gamma(2.3158, 1.4204), .398, 5.88) | pass |
| C-03 Table 2 VIF 2.5 | vif-sensitivity | 1.666, 1.646, .557, .233, .030 | golden tsmm_fits.csv; closed form; oracle (paper Table 2: (1.67, 1.65), .56, .23, .030) | pass |
| M-12 SCAL shortcut | prior-implications?preset=scal | 2.97, .896, .834 | oracle (never the stale .824); closed form | pass |
| M-04 strip | method-problems-strip?J=500 | .834, 10.05, .168, .591 | oracle; closed form (paper OSM Table F.4: SSI-Weight E K 10.05) | pass |
| A-02 STAR Vague | app-prior-strip?app=star&prior=Vague&view=post | 4.61, .591, 1.96, .560, .920 | oracle; closed form; released app_priors.json | pass |
| A-02 STAR Dual-Anchor | app-prior-strip?app=star&prior=Dual-Anchor&view=post | 6.24, .385, 4.47, .064, .724 | released app_priors.json; closed form | pass |
| A-03 Bangert-Drowns Vague | bd-forest | 1.89, .548 | released app_priors.json | pass |
| A-04 vocabulary | rasch-kpmf | 4.43, 6.73, 8.99 | released app_priors.json (the widget sums rasch_pmf.json) | pass |
| C-05 [3, 10] at 80% | elicitation-form?preset=i80 | 6.5, 7.459, 6.818, 4.822, 1.414, .4002 | tsmm_boundary.csv (u-space oracle, r-export/14); closed form | pass |
| C-05 [3, 10] at 95% | elicitation-form?preset=i95 | 3.189, 4.522, 1.386, 90.0 | tsmm_boundary.csv (profile bound by uniroot); normal proxy | pass |
| C-05 page prose | pages/dpprior/elicitation | 7.46, 6.82, 4.82, .4002, .070, 3.19, 4.52 | tsmm_boundary.csv (u-space oracle); closed form | pass |
| C-11 MCMC design | timing-badges | 57151, 64400 | released cell_summary.json (all suites) | pass |
| A-13 retained fits | data-lineage-card | 8607, 9000, 45 | released cell_summary.json (suite headline_n01) | pass |
| A-12 STAR wide scale | spec-sensitivity?app=star&preset=wide_scale | 1.96, 1.22, .560, .842, 4.47, 2.85, .064, .318, .003, .007 | released app_sensitivity.json | pass |
| A-12 STAR OLS/HC3 | spec-sensitivity?app=star&preset=hc3 | 1.96, 2.20, .560, .507, 4.47, 4.92, .064, .040, .169, .174 | released app_sensitivity.json | pass |
| A-12 Bangert-Drowns wide scale | spec-sensitivity?app=bd&preset=wide_scale | 1.89, 1.22, .548, .839, 3.31, 1.89, .190, .553, .003, .008 | released app_sensitivity.json | pass |
| A-13 page prose | pages/applications/data | 8607, 9000, 45, 57151, 64400 | released cell_summary.json | pass |
| paper | v3 Table 5 | 1.96, 0.560 | STAR Vague E(K | data), Pr(K = 1 | data) | pass |
| paper | v3 Table 5 | 4.47, 0.064 | STAR Dual-Anchor E(K | data), Pr(K = 1 | data) | pass |
| paper | v3 Table 5 | 1.89, 3.31 | Bangert-Drowns Vague and Dual-Anchor E(K | data) | pass |
| paper | v3 Table 5 | 4.43, 6.73, 8.99 | vocabulary Vague, Dual-Anchor, hard E(K | data) | pass |
| paper | v3 Sec. 5 and Table 4 | 5.134, 4.939, 15.770, 11.112 | STAR TSMM and Dual-Anchor (a, b) | pass |
| paper | v3 Sec. 4 | 64400, 57151, 9000, 8607 | simulation fits requested and admitted (all suites), planned and retained (45 main cells) | pass |

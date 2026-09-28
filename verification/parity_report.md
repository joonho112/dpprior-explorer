# Parity report

Written by `verification/run_parity.mjs` on 2026-09-28T21:55:06.797Z (node v25.8.1).
Engine: `engine/src/index.ts` bundled fresh with esbuild. Golden: `verification/golden/` (DPprior 2.0.0 via `pkgload::load_all`, and base-R u-space oracles that load no package code; see `golden_manifest.csv` and `r-export/README.md`).

**Result: PASS**; 17351 comparisons, 0 failures, 0 manifest issues, 0 documented skips.

| golden file | selector | column | cases | max error | tolerance | result |
|---|---|---|---:|---:|---|---|
| stirling_J50.csv | all | log_stirling | 1275 | 2.18e-16 | rel 1e-10 | pass |
| stirling_J500.csv | all | log_stirling | 927 | 2.14e-16 | rel 1e-10 | pass |
| selftest_rowsum.csv | all | logsumexp_row | 7 | 0.00e+0 | rel 1e-12 | pass |
| cond_moments.csv | method=finite_sum | mean | 56 | 1.43e-15 | rel 1e-6 | pass |
| cond_moments.csv | method=finite_sum | var | 56 | 1.16e-11 | rel 1e-6 | pass |
| cond_moments.csv | method=digamma | mean | 28 | 4.83e-15 | rel 1e-6 | pass |
| cond_moments.csv | method=digamma | var | 28 | 3.78e-11 | rel 1e-6 | pass |
| log_rising.csv | all | log_rising | 14 | 1.37e-15 | rel 1e-10 | pass |
| cond_pmf_J50.csv | all | pmf | 400 | 1.38e-14 | abs 1e-8 | pass |
| wsb.csv | kind=tail | value | 102 | 1.11e-16 | abs 1e-8 | pass |
| wsb.csv | density at w = 0: the limit a / b | value | 9 | 8.88e-16 | abs 1e-12 | pass |
| wsb.csv | kind=density | value | 135 | 2.73e-15 | rel 1e-6 | pass |
| wsb.csv | kind=cdf | value | 144 | 1.11e-16 | abs 1e-8 | pass |
| wsb.csv | kind=quantile | value | 45 | 1.11e-16 | abs 1e-8 | pass |
| wsb.csv | kind=cond_tail | value | 10 | 1.11e-16 | abs 1e-8 | pass |
| rho.csv | kind=cond_mean | value | 7 | 0.00e+0 | rel 1e-6 | pass |
| rho.csv | kind=cond_var | value | 7 | 0.00e+0 | rel 1e-6 | pass |
| rho.csv | kind=marg_mean | value | 16 | 4.22e-15 | abs 1e-8 | pass |
| rho.csv | kind=marg_mean,a>1e4 | value | 1 | 3.94e-15 | abs 1e-9 | pass |
| a1_init.csv | all | status | 12 | 0.00e+0 | exact 0 | pass |
| a1_init.csv | status=ok | a0 | 11 | 0.00e+0 | rel 1e-6 | pass |
| a1_init.csv | status=ok | b0 | 11 | 1.70e-16 | rel 1e-6 | pass |
| elicitation_conversions.csv | all | var_K | 15 | 3.65e-16 | rel 1e-6 | pass |
| elicitation_conversions.csv | all | support_ok | 15 | 0.00e+0 | exact 0 | pass |
| elicitation_conversions.csv | all | a1_ok | 15 | 0.00e+0 | exact 0 | pass |
| elicitation_conversions.csv | kind=interval_normal | z | 5 | 2.22e-16 | abs 1e-12 | pass |
| marginal_moments.csv | method=integrate | mean | 112 | 1.99e-13 | abs 1e-4 | pass |
| marginal_moments.csv | method=integrate | var | 112 | 9.65e-14 | abs_or_rel 1e-4|1e-6 | pass |
| marginal_moments.csv | a>1e4,true_gamma | mean | 7 | 1.81e-13 | abs 1e-9 | pass |
| marginal_moments.csv | a>1e4,true_gamma | var | 7 | 2.79e-12 | abs 1e-9 | pass |
| marginal_moments.csv | method=point_mass | mean | 7 | 3.55e-15 | abs 1e-12 | pass |
| marginal_moments.csv | method=point_mass | var | 7 | 8.88e-15 | abs 1e-12 | pass |
| marginal_pmf_J50_J100_J500.csv | method=integrate | pmf | 10400 | 1.83e-12 | abs 1e-8 | pass |
| marginal_pmf_J50_J100_J500.csv | a>1e4,true_gamma | pmf | 650 | 4.44e-13 | abs 1e-10 | pass |
| marginal_pmf_J50_J100_J500.csv | method=point_mass | pmf | 650 | 4.08e-15 | abs 1e-12 | pass |
| marginal_quantiles.csv | J<=500 | q05 | 55 | 0.00e+0 | exact 0 | pass |
| marginal_quantiles.csv | J<=500 | median | 55 | 0.00e+0 | exact 0 | pass |
| marginal_quantiles.csv | J<=500 | q95 | 55 | 0.00e+0 | exact 0 | pass |
| marginal_quantiles.csv | J<=500 | p_K1 | 55 | 1.83e-12 | abs 1e-8 | pass |
| marginal_quantiles.csv | J>500 | q05 | 51 | 0.00e+0 | exact 0 | pass |
| marginal_quantiles.csv | J>500 | median | 51 | 0.00e+0 | exact 0 | pass |
| marginal_quantiles.csv | J>500 | q95 | 51 | 0.00e+0 | exact 0 | pass |
| marginal_quantiles.csv | J>500 | p_K1 | 51 | 3.73e-11 | abs 1e-8 | pass |
| marginal_quantiles.csv | closed_form | p_K1 | 99 | 3.67e-11 | abs 1e-8 | pass |
| marginal_quantiles.csv | J<=500 | pr_alpha_lt_0.1 | 51 | 2.22e-16 | abs 1e-12 | pass |
| marginal_quantiles.csv | J>500 | pr_alpha_lt_0.1 | 48 | 2.22e-16 | abs 1e-12 | pass |
| wmax_mc.csv | bounds | lower_bound | 37 | 2.22e-16 | abs 1e-12 | pass |
| wmax_mc.csv | bounds | upper_bound | 37 | 4.44e-16 | abs 1e-12 | pass |
| wmax_mc.csv | method=deterministic | estimate | 36 | 1.31e-14 | abs 1e-8 | pass |
| wmax_mc.csv | bounds | inside | 6 | 0.00e+0 | exact 0 | pass |
| wmax_mc.csv | method=monte_carlo | estimate | 3 | 8.60e-4 | abs 5e-3 | pass |
| method_catalog.csv | quantity=pK1 | value | 17 | 1.33e-10 | abs 1e-8 | pass |
| method_catalog.csv | quantity=EK | value | 27 | 7.19e-10 | abs 1e-4 | pass |
| method_catalog.csv | quantity=S50 | value | 8 | 9.19e-11 | abs 1e-8 | pass |
| method_catalog.csv | quantity=a | value | 4 | 3.73e-6 | abs 5e-3 | pass |
| method_catalog.csv | quantity=b | value | 4 | 6.10e-6 | abs 5e-3 | pass |
| method_catalog.csv | quantity=leak | value | 4 | 2.19e-11 | abs 1e-8 | pass |
| method_catalog.csv | quantity=kl | value | 4 | 4.04e-12 | abs 1e-7 | pass |
| method_catalog.csv | quantity=pGEq | value | 6 | 5.33e-11 | abs 1e-8 | pass |
| method_catalog.csv | quantity=S90 | value | 1 | 6.38e-12 | abs 1e-8 | pass |
| method_catalog.csv | record quantity=EK | value | 99 | 1.14e-8 | abs 1e-4 | pass |
| method_catalog.csv | record quantity=pK1 | value | 99 | 5.48e-11 | abs 1e-8 | pass |
| method_catalog.csv | record quantity=S50 | value | 33 | 9.33e-11 | abs 1e-8 | pass |
| method_catalog.csv | record quantity=S90 | value | 33 | 8.23e-11 | abs 1e-8 | pass |
| method_catalog.csv | record quantity=a | value | 9 | 1.02e-6 | rel 1e-3 | pass |
| method_catalog.csv | record quantity=b | value | 9 | 1.38e-6 | rel 1e-3 | pass |
| method_catalog.csv | record quantity=kl | value | 9 | 6.15e-14 | abs 1e-6 | pass |
| method_catalog.csv | record quantity=leak | value | 3 | 1.14e-7 | abs 1e-4 | pass |
| solvers.csv | method=ssi | a | 3 | 5.24e-13 | abs 5e-3 | pass |
| solvers.csv | method=ssi | b | 3 | 2.53e-13 | abs 5e-3 | pass |
| solvers.csv | method=ssi | P_K1 | 3 | 2.56e-14 | abs 3e-3 | pass |
| solvers.csv | method=ssi | P_tail | 3 | 9.61e-15 | abs 3e-3 | pass |
| solvers.csv | method=ssi | E_K | 3 | 7.94e-13 | abs 1e-2 | pass |
| solvers.csv | method=ssi | S_half | 3 | 5.55e-17 | abs 3e-3 | pass |
| solvers.csv | method=doro | a | 3 | 1.25e-7 | abs 5e-3 | pass |
| solvers.csv | method=doro | b | 3 | 1.27e-8 | abs 5e-3 | pass |
| solvers.csv | method=doro | KL | 3 | 6.20e-13 | abs 1e-3 | pass |
| solvers.csv | method=doro | P_K1 | 3 | 3.54e-8 | abs 3e-3 | pass |
| solvers.csv | method=doro | E_K | 3 | 2.33e-5 | abs 1e-2 | pass |
| solvers.csv | method=doro | S_half | 3 | 3.88e-8 | abs 3e-3 | pass |
| solvers.csv | method=doro_unif | a | 1 | 7.84e-7 | abs 5e-3 | pass |
| solvers.csv | method=doro_unif | b | 1 | 1.04e-6 | abs 5e-3 | pass |
| solvers.csv | method=doro_unif | KL | 1 | 8.80e-14 | abs 1e-3 | pass |
| solvers.csv | method=doro_unif | P_K1 | 1 | 1.17e-8 | abs 3e-3 | pass |
| solvers.csv | method=doro_unif | P_tail | 1 | 3.30e-8 | abs 3e-3 | pass |
| solvers.csv | method=doro_unif | E_K | 1 | 2.83e-7 | abs 1e-2 | pass |
| solvers.csv | method=doro_unif | S_half | 1 | 1.68e-8 | abs 3e-3 | pass |
| solvers.csv | method=scal_exact | a | 6 | 1.06e-9 | abs 5e-3 | pass |
| solvers.csv | method=scal_exact | b | 6 | 8.13e-10 | abs 5e-3 | pass |
| solvers.csv | method=scal_exact | P_K1 | 6 | 1.87e-10 | abs 3e-3 | pass |
| solvers.csv | method=scal_exact | P_tail | 6 | 1.52e-10 | abs 3e-3 | pass |
| solvers.csv | method=scal_exact | E_K | 6 | 1.82e-9 | abs 1e-2 | pass |
| solvers.csv | method=scal_exact | S_half | 6 | 1.46e-10 | abs 3e-3 | pass |
| solvers.csv | method=scal_published | P_K1 | 6 | 3.92e-14 | abs 1e-8 | pass |
| solvers.csv | method=scal_published | P_tail | 6 | 1.01e-13 | abs 1e-8 | pass |
| solvers.csv | method=scal_published | E_K | 6 | 7.11e-15 | abs 1e-4 | pass |
| solvers.csv | method=scal_published | S_half | 6 | 1.11e-16 | abs 1e-8 | pass |
| solvers.csv | method=scal_shortcut | a | 6 | 1.11e-16 | abs 1e-15 | pass |
| solvers.csv | method=scal_shortcut | P_K1 | 6 | 5.74e-14 | abs 1e-8 | pass |
| solvers.csv | method=scal_shortcut | P_tail | 6 | 6.87e-14 | abs 1e-8 | pass |
| solvers.csv | method=scal_shortcut | E_K | 6 | 3.11e-15 | abs 1e-4 | pass |
| solvers.csv | method=scal_shortcut | S_half | 6 | 1.11e-16 | abs 1e-8 | pass |
| solvers.csv | method=scal_shortcut_rounded | P_K1 | 1 | 5.76e-14 | abs 1e-8 | pass |
| solvers.csv | method=scal_shortcut_rounded | P_tail | 1 | 6.84e-14 | abs 1e-8 | pass |
| solvers.csv | method=scal_shortcut_rounded | E_K | 1 | 1.78e-15 | abs 1e-4 | pass |
| solvers.csv | method=scal_shortcut_rounded | S_half | 1 | 0.00e+0 | abs 1e-8 | pass |
| count_prior_by_J.csv | block=recalibrated | E_K | 23 | 1.24e-9 | abs 1e-4 | pass |
| count_prior_by_J.csv | block=recalibrated | q05 | 23 | 0.00e+0 | exact 0 | pass |
| count_prior_by_J.csv | block=recalibrated | q95 | 23 | 0.00e+0 | exact 0 | pass |
| count_prior_by_J.csv | block=recalibrated | S50 | 23 | 1.14e-10 | abs 1e-8 | pass |
| count_prior_by_J.csv | block=recalibrated | P_K1 | 23 | 7.24e-11 | abs 1e-8 | pass |
| count_prior_by_J.csv | block=transported | E_K | 17 | 1.93e-11 | abs 1e-4 | pass |
| count_prior_by_J.csv | block=transported | q05 | 17 | 0.00e+0 | exact 0 | pass |
| count_prior_by_J.csv | block=transported | q95 | 17 | 0.00e+0 | exact 0 | pass |
| count_prior_by_J.csv | block=transported | P_K1 | 17 | 3.61e-13 | abs 1e-8 | pass |
| count_prior_by_J.csv | tsmm_target | E_K | 23 | 1.54e-9 | abs 1e-4 | pass |
| count_prior_by_J.csv | tsmm_target | Var_K | 23 | 3.60e-8 | abs 1e-3 | pass |
| dual_anchor.csv | all | S50 | 30 | 1.11e-16 | abs 1e-8 | pass |
| dual_anchor.csv | all | E_K | 30 | 2.61e-15 | rel 1e-6 | pass |
| dual_anchor.csv | all | Var_K | 30 | 1.96e-14 | rel 1e-6 | pass |
| dual_anchor.csv | released grid | a | 29 | 4.99e-8 | abs 5e-3 | pass |
| dual_anchor.csv | released grid | b | 29 | 4.87e-8 | abs 5e-3 | pass |
| dual_anchor.csv | released grid | selected | 29 | 0.00e+0 | exact 0 | pass |
| tsmm_fits.csv | all | status | 10 | 0.00e+0 | exact 0 | pass |
| tsmm_fits.csv | all | alpha_star | 10 | 3.51e-14 | abs 1e-6 | pass |
| tsmm_fits.csv | all | min_var | 10 | 8.35e-14 | abs 1e-2 | pass |
| tsmm_fits.csv | status=ok | a | 9 | 2.79e-8 | abs 5e-3 | pass |
| tsmm_fits.csv | status=ok | b | 9 | 2.90e-8 | abs 5e-3 | pass |
| tsmm_fits.csv | status=ok | E_K | 9 | 1.92e-8 | abs 1e-4 | pass |
| tsmm_fits.csv | status=ok | S50 | 9 | 2.06e-9 | abs 1e-4 | pass |
| oracle_wmax.csv | all | wmax_tail | 28 | 4.44e-15 | abs 1e-9 | pass |
| oracle_u_space.csv | all | E_K | 30 | 5.14e-12 | abs 1e-10 | pass |
| oracle_u_space.csv | all | Var_K | 30 | 6.93e-12 | rel 1e-10 | pass |
| oracle_u_space.csv | all | P_K1 | 30 | 6.16e-13 | abs 1e-12 | pass |
| oracle_u_space.csv | a<=1e4 | pr_alpha_lt_0.1 | 26 | 6.66e-16 | abs 1e-12 | pass |
| oracle_u_space.csv | a>1e4 | pr_alpha_lt_0.1 | 4 | 0.00e+0 | abs 1e-4 | pass |
| tsmm_boundary.csv | all | status | 21 | 0.00e+0 | exact 0 | pass |
| tsmm_boundary.csv | all | support_upper | 21 | 0.00e+0 | abs 1e-12 | pass |
| tsmm_boundary.csv | not support | alpha_star | 19 | 2.53e-14 | rel 1e-9 | pass |
| tsmm_boundary.csv | not support | min_var | 19 | 1.45e-13 | abs 1e-10 | pass |
| tsmm_boundary.csv | solved | E_K at the oracle fit | 17 | 2.92e-12 | abs 1e-8 | pass |
| tsmm_boundary.csv | solved | Var_K at the oracle fit | 17 | 1.68e-11 | abs 1e-8 | pass |
| tsmm_boundary.csv | solved | engine E_K - mu_K | 17 | 1.68e-11 | abs 1e-6 | pass |
| tsmm_boundary.csv | solved | engine Var_K - sigma^2 | 17 | 9.69e-10 | abs 1e-6 | pass |
| tsmm_boundary.csv | solved | log a gap / row tolerance | 17 | 4.85e-3 | abs 1 | pass |
| tsmm_boundary.csv | DPprior 2.0.0 converged | a | 8 | 1.20e-8 | rel 1e-4 | pass |
| tsmm_boundary.csv | DPprior 2.0.0 converged | b | 8 | 7.59e-9 | rel 1e-4 | pass |

## Manifest

All 22 golden files match their sha256 in golden_manifest.csv.

## Documented skips

None.

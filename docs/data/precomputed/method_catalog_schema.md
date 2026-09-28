# method_catalog.json: schema and source rules

Written by `r-export/02_methods_catalog.R` (DPprior 2.0.0 via `pkgload::load_all`, the
replication package's `calibration/policy.yml` and `docs/artifacts/osm-table-F.4.csv`).
Do not edit by hand; `method_catalog.js` is the same object as an ES module
(`export default {...}`) so pages work from `file://`.

## Numerical rules

- Gamma mixtures by `integrate()` on log-alpha panels; the mass on `[0, 1e-12]` goes to the
  alpha -> 0 limit (K_J = 1, weight tails = 1). Never Gauss-Laguerre M = 80: the shortcut's
  P(K_100 = 1) is .8336, the value M = 80 gets wrong.
- E(K_J) for J > 500 by the digamma path.
- DORO and DORO-Unif fits: Nelder-Mead on (log a, log b) in [-15, 15], minimising
  KL(uniform target || induced pmf) computed with `integrate()`. Starts: Dorazio's (2009)
  table (n <= 50), the previous n, `DPprior_a2_kl(method = "pmf", M = 320)`, or OSM Table F.4.
- SCAL: the two tail equations P(K_m = 1) = .34 and P(K_m >= ceil(2 ln m)) = .15 solved by
  Nelder-Mead on the squared residuals (residuals < 1e-9), started at the tabulated (a, b).
- SSI-Weight: `pcv_solve_ssi()` of the replication package (uniroot on log b, a in closed form).
- Jeffreys and Stirling-gamma priors are not Gamma: their densities are normalised by
  `integrate()` over the whole log-alpha line (unit panels on [-40, 40] plus both infinite end
  panels). The Jeffreys prior has an alpha^(-3/2) tail: truncating it at alpha = 1e4 loses 4.3%
  of its mass at n = 100 and moves E(K_100) from 49.8 to 47.6. The catalog uses the full line.
- Every Gamma and fixed-alpha number is checked by `verification/run_parity.mjs`
  (`golden/method_catalog.csv`, `parity_spec.csv` rows `method_catalog.csv`). Jeffreys and
  Stirling-gamma rows are R-only (dp-core has no non-Gamma mixing).

## Top level

| key | type | meaning |
|---|---|---|
| `source`, `dpprior`, `r_version`, `generated_at`, `method` | string | provenance |
| `schema` | string | this file |
| `references` | object | one-line source notes for the legacy blocks |
| `vague` | object | Gamma(1, 1) at J = 100: `a, b, J, pmf[k = 1..25], pK1, EK, S50, S90` (M-04) |
| `doro[]` | array | DORO-Unif at J = 48, 79, 100, 500: `label, J, muK, support_max, a, b, kl, leak, a2_kl_start {a, b}, pmf[k = 1..30], pK1, EK, S50, S90` (M-04) |
| `scal[]` | array | m = 6, 10, 25, 50, 75, 100: `m, q = ceil(2 ln m)`, and `exact` (solved), `published` (tabulated), `shortcut` (a = b = exp(-0.033 m)), each `a, b, pGEq = P(K_m >= q), pmf, pK1, EK, S50, S90` (M-04) |
| `ssi` | object | SSI-Weight: `a, b, S50, S90, EK_by_J[{J, EK}], pmf_J100` (M-04) |
| `J_set` | array | the J at which records are summarised: 50, 100, 500 |
| `records[]` | array | one per catalog point (below) |
| `timeline[]` | array | the nine M-08 nodes (below) |

## records[]

| field | type | meaning |
|---|---|---|
| `id` | string | unique id, e.g. `doro_n100`, `scal_shortcut_m100` |
| `family` | string | `fixed-alpha`, `vague`, `literature-default`, `k-diffuse`, `doro`, `doro-unif`, `scal`, `scal-shortcut`, `ssi`, `ssi-vicentini`, `quasi-degenerate`, `jeffreys`, `stirling-gamma`, `dpprior` |
| `label` | string | display name |
| `gamma` | boolean | true when the prior is Gamma(a, b) (then `a`, `b` are present) |
| `a`, `b` | number | shape and rate (Gamma records only) |
| `prior` | object | non-Gamma records: `{type: "point", alpha}`, `{type: "jeffreys", n}`, `{type: "sg", a, b, m}` |
| `J_rule` | string | how the rule sets (a, b): fixed, per n, per m, J-invariant, ... |
| `year` | number or null | year of the rule's source (null for the vague default) |
| `source` | string | where the rule and its (a, b) come from |
| `via` | string | present when the source was read second-hand (the PDF is not in the reference folder) |
| `E_alpha` | number | prior mean of alpha (absent for Jeffreys: no finite mean) |
| `E_K` | object | `{"50", "100", "500"}`: E(K_J) at J = 50, 100, 500 |
| `P_K1` | object | `{"50", "100", "500"}`: P(K_J = 1) |
| `S50`, `S90` | number | Pr(W_SB > .5), Pr(W_SB > .9) (J-free) |
| `design[]` | array | summaries at the record's own n, m or J: `J, E_K, q05, q95, P_K1` plus rule-specific extras (`KL`, `leak`, `support_max`, `q`, `P_tail`, `published_a/b`, `lambda`, starts) |
| `E_K_more[]` | array | SSI-Weight only: `{J, E_K}` at J = 25, 1000, 2000, 5000 |
| `one_line_error` | string | the rule's odd implication, without numbers (widgets show the numbers from the fields above, recomputed with dp-core for Gamma records) |

`q05` and `q95` are discrete quantiles (min k with cdf >= p), so `[q05, q95]` is the 90% interval.

## timeline[]

| field | type | meaning |
|---|---|---|
| `id`, `year`, `title` | string | node identity (`year` is a label such as `1993/95`) |
| `records` | array of ids | the records the card lists |
| `assumption`, `count`, `weight` | string | what the rule assumes, what it implies for the count and for the weights |
| `j_dependence` | string | how the rule depends on J |
| `one_line_error` | string | the card's headline |
| `evidence[]` | array | `{record, q, J?}`: `q` is `E_K`, `P_K1`, `S50`, `S90` or `design.<field>` (the design row with that `J`) |
| `explorers[]` | array | `{id, href}` catalog ids and site-relative pages of the matching explorers |

## Sources (as cited in `source` / `via`)

Antoniak (1974); West and Escobar (1993); West, Mueller and Escobar (1994); Escobar and West
(1995); Jara et al. (2007); Dorazio (2009); Murugiah and Sweeting (2012); Lunn et al. (2012);
Rodriguez (2013); Paganin et al. (2023); Zito, Rigon and Dunson (2024); Vicentini and Jermyn
(2025); the DPprior paper (arXiv:2602.06301) and its OSM Table F.4. Paganin et al. (2023) and
Rodriguez (2013) were read through the paper and Vicentini and Jermyn (2025), not from their PDFs.

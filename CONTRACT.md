# DPprior Explorer contract

This file fixes the rules every widget, page, data file and check in this repository
follows. When a rule changes, the change is made here first and recorded in the phase
log. Sections: [widget API](#1-widget-api), [embedding](#2-embedding),
[catalog](#3-catalog), [colour and accessibility](#4-colour-and-accessibility),
[Broderick idioms](#5-broderick-idioms), [numerical rules](#6-numerical-rules),
[parity tolerances](#7-parity-tolerances), [captions and vocabulary](#8-captions-and-vocabulary),
[data contract](#9-data-contract), [attribution](#10-attribution),
[shared files](#11-shared-files), [checks](#12-checks), [R exports](#13-r-exports).

## 1. Widget API

Every widget is a framework-free ES module in `js/widgets/<name>.js` that exports

```js
export function mountWidget(el, spec = {}) {
  // build DOM inside `el`, draw, wire controls
  return {
    update(partialSpec) { /* merge into state and redraw; returns nothing */ },
    destroy() { /* remove listeners, observers, timers, and el's children */ },
  };
}
```

- `el` is an empty block element. The widget owns everything inside it and nothing
  outside it (no global CSS, no `document`-level listeners except `keydown` scoped to
  focus inside `el`).
- `spec` holds initial state only (for example `{a: 1.6, b: 1.22, J: 50}`). Unknown keys
  are ignored. Values are clamped to the widget's documented ranges, never rejected.
- `update()` accepts a partial spec and must not re-create controls. `destroy()` is
  idempotent.
- All numbers come from `js/dp-core.js`. A widget never re-implements a formula that the
  engine exports, and never hard-codes a result. The literal scan
  (`verification/run_literal_scan.mjs`) enforces this for `engine/src/*.ts` and every file in
  `js/widgets/`: it reads the code with the TypeScript scanner and checks numbers in code and
  numbers inside strings and template text alike. Every numeric literal above 10 or
  non-integer is allowlisted in `verification/literal_allowlist.csv` by file, scope (code or
  string) and value, with a reason: layout, control range, preset input such as
  `(1.60, 1.22)`, design size, animation timing, policy constant or display rule. A row that no
  longer matches fails the scan, and `--self-test` plants four mistakes it must catch.
  Released and paper values are read from `data/`, never typed in.
- Shared building blocks live in `js/widgets/base.js` (controls, read-outs, resize,
  reduced-motion), `js/widgets/chart.js` (Plot wrappers that read the colour tokens)
  and `js/widgets/format.js` (display precision).
- A widget must work from `file://`: relative paths only, vendored libraries only
  (`js/vendor/d3.min.js`, `js/vendor/plot.min.js`), no runtime CDN, no `fetch()`.

### Delivery formats (why there are two)

Chrome and Safari refuse to load ES module files from `file://` (the page's origin is
`null`), and `fetch()` of local JSON fails there too. The talk fallbacks
(`file://docs/`, the offline deck) therefore cannot depend on module loading.

| Layer | Source of truth | Runtime file(s) |
|---|---|---|
| engine | `engine/src/*.ts` | `js/dp-core.js` (ES module) and `js/dp-core.umd.js` (global `dpCore`), both from one Vite build |
| libraries | npm `d3@7.9.0`, `@observablehq/plot@0.6.17` | `js/vendor/d3.min.js` (UMD, global `d3`), `js/vendor/plot.min.js` (UMD, global `Plot`, needs `d3` first) |
| widgets | `js/widgets/<name>.js` (ES modules; use the globals `Plot` and `d3`) | `js/bundles/<name>.js`: esbuild IIFE bundle (widget + dp-core + its data) that sets `window.DPX["<name>"] = {mountWidget}` |
| precomputed data | `data/precomputed/<name>.json` | twin `data/precomputed/<name>.js` (`export default {...}`) imported by widgets, so bundles inline it |

Pages, embeds and slides load classic scripts only:

```html
<script src="../js/vendor/d3.min.js"></script>
<script src="../js/vendor/plot.min.js"></script>
<script src="../js/bundles/defaults-drift.js"></script>
<script>DPX["defaults-drift"].mountWidget(document.getElementById("w"), {a: 1, b: 1});</script>
```

This works from `file://`, from `http(s)://` and inside iframes. The ES module path
(`import {mountWidget} from "../js/widgets/x.js"`) stays available for http contexts,
OJS cells and node tests. A stale bundle is a failed check (`run_all.sh` rebuilds and
compares hashes).

## 2. Embedding

Each widget has one standalone page `embed/<name>.html` built from
`embed/_template.html`.

- Query parameters give the initial state: `?a=&b=&J=&K=&alpha=&t=&n=&seed=&mu=&var=` (numbers;
  `K` is a number of components, `n` a node, point or draw count, `seed` a random seed and
  `mu`, `var` a count target's mean and variance, for the widgets that use them), plus
  `?theme=light|dark` (default: follow `prefers-color-scheme`) and `?preset=<name>`
  where a widget defines named presets. Unparseable values are ignored.
- The page has one `<h1>` (visually compact), the widget, a one-line caption, and the
  attribution line required by section 10.
- Embed pages load `../styles/tokens.css`, `../styles/widgets.css` and the classic
  scripts of section 1 by relative path, so the same file works under `docs/embed/` on
  GitHub Pages, from `file://docs/embed/`, and inside an iframe in the reveal.js deck.
- Site pages mount the same bundle (`../../js/bundles/x.js`) in a `<div>`; an `{ojs}`
  cell or a `<script type="module">` may import the ES module instead where the page is
  only ever served over http. There is no second implementation for slides.
- Widget pages use `toc: false` and put the host `<div>` in `column-page`, so charts get
  the full page width (Step 3.3).

## 3. Catalog

`catalog/catalog.json` is an array with one object per visualization, validated by
`catalog/schema/catalog.schema.json` and `verification/check_catalog.mjs`.

| Field | Rule |
|---|---|
| `id` | `P-NN` DPM teaching, `M-NN` method problems, `C-NN` DPprior principle, `A-NN` evidence and real data, `X-NN` complementary tools. Unique. The same id is used in file names, thumbnails, logs and captions. Draft "V-" numbers are retired. |
| `name` | short English title |
| `axis` | one of `dpm`, `problems`, `dpprior`, `evidence`, `complementary` |
| `concept` | one sentence: the idea the visualization carries |
| `does` | **required**, one sentence: what the viewer does |
| `sees` | **required**, one sentence: what the viewer sees |
| `engine` | the stack it runs on (for example `dp-core + Observable Plot 0.6.17`) |
| `page` | site path of the page that hosts it (relative, `.html`) |
| `embed` | path of its embed page, or `null` for static media |
| `step` | the build step that produced it (for example `Step 3.3`) |
| `thumb` | `catalog/thumbs/<id>.png` once captured, otherwise `null` |
| `status` | `planned`, `in-progress` or `done`; an entry is listed only after its widget mounts |
| `presets` | optional list of `{label, query}` embed presets |

The catalog page is rendered at build time: `scripts/pre-render.ts` writes
`_catalog-cards.md` from `catalog.json`, and `catalog.qmd` includes it. Quarto resolves
includes before its pre-render hook runs, so the generated file is committed; after
editing `catalog.json` run `quarto run scripts/pre-render.ts` (the gate does). Reading the
JSON in the browser would fail from `file://`.

## 4. Colour and accessibility

- Colours come only from `styles/tokens.css`. Three families: `--dp-*` (DPprior Studio
  identity), `--m-*` (method roles, the paper's Okabe-Ito role palette: Vague orange,
  DORO-Unif sky blue, TSMM green, Dual-Anchor reddish purple, hard vermillion,
  SSI-Weight blue, literature default black), `--b-1..--b-6` (Broderick pieces).
  The web hexes are adjusted for contrast and colour-vision separation and are not
  claimed to be the manuscript's exact colours.
- `node scripts/validate_palette.js` must pass: text tokens >= 4.5:1 (WCAG 2.1 AA) on
  `--bg` and `--bg-raised`; focus ring, slider track, accent and marker >= 3:1; every
  categorical family >= 40 in sRGB distance under normal vision and simulated
  protanopia, deuteranopia and tritanopia; light and dark; the two dark copies equal.
- Series colours below 3:1 against the page (reported as WARN) are allowed only with
  relief: outlined pieces (`--b-stroke`), direct labels, the paper's linetype/shape
  redundancy for methods (Vague solid circle, DORO dashed open triangle, TSMM solid
  square, Dual-Anchor solid triangle, hard dotted open square, SSI solid diamond,
  literature dot-dash cross), and a text alternative.
- Theme: site pages are light (`data-theme="light"`); embed pages follow
  `prefers-color-scheme` unless `?theme=` is given.
- Keyboard: every control is a native `<input>`, `<select>` or `<button>` with a visible
  label or `aria-label`; Tab reaches all of them in reading order; sliders step with
  arrow keys (Shift = 10 steps); Enter on a focused widget triggers its primary action
  ("Draw again", "Seat 1"). Focus is visible (`--focus`, 2 px outline).
- Every widget has one `aria-live="polite"` read-out that states the current key values
  in words, and every chart has a text alternative (`role="img"` + `aria-label`, or a
  visually hidden table).
- Motion: widgets read `matchMedia("(prefers-reduced-motion: reduce)")`; when true,
  animations jump to their end state and auto-play is off.
- Layout: no horizontal page scroll at 375 px width; charts resize with
  `ResizeObserver`; controls wrap.
- Log axes: Observable Plot 0.6.17 blanks the labels of 5 x 10^k ticks on log scales
  whatever `tickFormat` says; log axes set `tickFormat: () => ""` and add
  `chart.logTickLabels(ticks)`.

## 5. Broderick idioms

After Broderick (MLSS 2016 Cadiz; 2012 tutorial), re-drawn from the mathematics:

- Controls: "Draw again" (Enter), "Add N" (1, 10, 100, 1000), "Step" and "Auto-play".
- Replication: a "x20 rows" toggle shows 20 ghost draws under the live draw.
- Piece colours in order blue, orange, green, purple, red, yellow (`--b-1..--b-6`),
  cycling; grey (`--b-unused`) = generated but unused component; white (`--b-rest`) =
  remaining stick mass; red marker (`--b-marker`) = a uniform draw.
- Cycling colours must not be the only way to tell two clusters apart (since 1.1.0). Where a
  scatter colours points by cluster, the components are numbered as on the stick (P-00, P-09), or the clusters hold stable colour slots (`colourSlots` in
  `js/widgets/chart.js`, P-13: up to six living clusters in distinct colours, up to twelve in
  distinct looks with rings). Layouts that place each piece on its own row or position (the
  staircase, lollipops, atoms on an axis) need nothing more.
- Stick-breaking uses the staircase layout (one row per break); tables in the CRP are
  circles whose area grows with occupancy, with a dashed circle for the next new table.
- Notation on the site: `alpha` for concentration (Broderick 2016); the 2012 tutorial's
  `theta` is noted once in the vocabulary page.

## 6. Numerical rules

- **Counts.** `K_J` is the number of occupied components among J units. pmf arrays are
  indexed by count `k = 1..J` (the R package returns length J+1 with `P(K = 0) = 0`
  first; the golden CSVs carry an explicit `k` column and drop that entry).
  `E(K_J | alpha)` and `Var(K_J | alpha)` use finite sums for J <= 200, and for J > 200 the
  digamma/trigamma path `kappa = alpha (psi(alpha + J) - psi(alpha))`,
  `v = kappa - alpha^2 (psi'(alpha) - psi'(alpha + J))` when `alpha <= J` and the finite sums
  when `alpha > J` (there the digamma difference cancels: at J = 201 and alpha = 1e12 it gave
  `E K_J > J`; every term of the sums is positive). The paths agree to 1e-12 at J = 200.
  Unit tests hold `1 <= E <= J` and `Var >= 0` for J in {200, 201, 500, 2000, 5000} and alpha
  from 1e-12 to 1e12.
- **Quantiles** of a discrete K distribution are `min k with cdf(k) >= p`; the 90%
  interval is `[q05, q95]`.
- **Gamma mixtures** `E_{a,b}[h(alpha)]` (shape a, rate b) are split: the mass on
  `[0, 1e-12]`, `pgamma(1e-12; a, b)`, goes to the alpha -> 0 limit (`K_J = 1`, weight
  tails = 1); `[1e-12, qgamma(1 - 1e-15)]` is integrated on a log-alpha grid with
  `max(400, range / 0.02)` nodes (trapezoid in log alpha with the Euler-Maclaurin end
  correction, which matters for a < 1 where the integrand at 1e-12 is not small).
  Doubling the nodes must change moments by < 1e-4. (The plan's upper cut
  `1 - 1e-9` dropped ~1e-3 of `E[kappa^2]` at J = 5000 for Gamma(0.037, 0.037); widened
  in Step 2.6.) This grid serves `a <= 1e4`.
- **Concentrated Gamma** (`1e4 < a < 1e15`, `engine/src/mixing.ts`, since 1.1.0). The
  log-alpha grid cannot resolve a Gamma whose CV `1 / sqrt(a)` is below .01, so the engine
  integrates over `u = log(alpha b / a)`, whose density is proportional to
  `exp(-a (e^u - 1 - u))`: 401 nodes over the mean of u +/- 12 standard deviations, trapezoid
  weights normalised so that `E[1] = 1`, `e^u - 1 - u` by a series near 0. It agrees with R's
  integral of the true Gamma to 1e-9 (moments) and 1e-10 (pmf). `Pr(alpha < t)` uses the
  Wilson-Hilferty approximation above `a = 1e4` (error O(1/a); abs 1e-4 in parity).
- **Point mass.** Only `a >= 1e15` is computed as a true point mass at `alpha = a / b`
  (narrower than double precision can resolve). Above `a = 1e4` (`POINT_MASS_A`) the site
  *describes* a prior as nearly a point mass at `a / b` and draws it as a spike (the STAR and
  vocabulary hard-bound solutions, for example `a = 3.27e6`), but every number comes from the
  concentrated grid. Interactive `(a, b)` sliders are limited to `a, b in [0.01, 50]` on a log
  scale; such presets are selected, not slid.
- **Live cap.** Live marginal pmf, quantiles and bands are computed for J <= 500 only;
  J > 500 moments use the conditional-moment rule above, P(K_J = 1) uses the closed-form
  expectation `mixPK1` at any J, and J > 500 bands come from R-precomputed JSON (labelled
  "precomputed"; `data/precomputed/kj_bands_J_gt_500.json`).
- **Weights.** `S(t; a, b) = Pr(W_SB > t) = (b / (b + c_t))^a` with `c_t = -log(1 - t)`;
  the size-biased density is evaluated on `w in [0, 1 - 1e-4]` only. `Pr(W_max > t)` for
  t >= 1/2 is exact by the substitution `u = -log(1 - w)` (Simpson's rule on log u, checked
  against an R integral in `oracle_wmax.csv`); below 1/2 only the bounds
  `[S(t), min(1, S(t) / t)]` are shown.
- **Solvers** (`engine/src/solvers.ts`, Step 7.2). Published hyperprior rules are solved in
  the engine, not copied: SSI-Weight by bisection on log b (a in closed form); DORO and
  DORO-Unif by Nelder-Mead on `(log a, log b)` clamped to `[-15, 15]`, started from
  Dorazio's (2009) table, minimising `KL(uniform target || induced pmf)`; SCAL by Newton
  on `(log a, log b)` for `P(K_m = 1) = .34` and `P(K_m >= ceil(2 ln m)) = .15` from
  (0.5, 0.5) (no solution below m = 5; the result then says `converged: false`). Searches
  use a quarter of the alpha-grid nodes (the pmf changes by < 1e-13); reported values use
  the full grid. Each solve takes < 300 ms in the browser (DORO at n = 100: about 60 ms).
- **TSMM** (`engine/src/tsmm.ts`, Step 8.2; rewritten in 1.1.0). Two checks
  decide first whether a Gamma prior exists (`checkTarget` in `engine/src/elicit.ts` uses the
  same two):
  - *support*: `1 < mu_K < J` and `0 < sigma^2 < (mu_K - 1)(J - mu_K)`, the largest variance
    of a count on {1, ..., J} with mean mu_K (Bhatia-Davis; only the two-point law on {1, J}
    reaches it, so no Gamma does);
  - *profile bound*: `sigma^2 > v_J(alpha*)`, where `kappa_J(alpha*) = mu_K` (bisection on log
    alpha to 1e-13): the point-mass limit. Every target between the two bounds has an exact
    Gamma solution.

  Stage 1: the A1 closed form `a0 = (mu_K - 1)^2 / D`, `b0 = (mu_K - 1) log J / D`,
  `D = sigma^2 - (mu_K - 1)`; when `D < 0.25 (mu_K - 1)` (A1's own domain ends at `D = 0`) the
  start uses `D = 0.25 (mu_K - 1)` and is marked "projected". Stage 2: Newton on
  `(log a, log b)` with the analytic score Jacobian on the alpha grid, steps no longer than 2,
  backtracking line search, at most 50 steps (`maxIter`), `log a` kept in [-28, 28] and `log b`
  in [-40, 40]; the tolerance is `tolF = 1e-6` on `|F|`, and Newton goes on while the residual
  still falls (to 1e-10). Near the profile bound the solution has `a > 1e4` and
  `Var K_J - v_J(alpha*)` is close to `C / a`: when `sigma^2 < 1.05 v_J(alpha*)` and below the
  variance reached at `a = 1e4`, or when Newton stalls with `a >= 100`, a one-dimensional
  profile solve takes over (outer: secant with bisection on log a for the variance; inner:
  Newton on log b for the mean; at most 60 steps each) on the concentrated grid.

  Statuses: `ok` (`|F| <= tolF`, `a <= 1e4`); `point-mass` (`|F| <= tolF`, `a > 1e4`: an exact
  solution with CV(alpha) < .01, described as nearly a point mass at alpha*); `approximate` (a
  Gamma prior exists but the profile solve stopped with `|F| > tolF`; the target and the
  achieved moments are shown, never as calibrated); `infeasible` (at or below the profile
  bound); `support`; `no-convergence`. A success status (`ok`, `point-mass`) always has
  `|F| <= tolF` (unit test over targets up to 95% of the support ceiling). The result carries
  the achieved `(M1, V)`, `supportUpper`, `minVar`, `alphaStar` and the method (`newton`,
  `profile`). A fit takes about 1 ms in node at J = 50 to 2000, near the bound included.
- **Sampling.** Seeded PRNG (mulberry32); GEM stick-breaking stops when the remaining
  mass is < 1e-3 and shows the rest as one grey piece; `Beta(1, alpha)` by
  `1 - exp(log1p(-u) / alpha)`.
- **Rendering.** SVG for single draws; Canvas for ribbons or ghost stacks of more than
  20 rows, so alpha = 100 never freezes the page.
- **Display precision** (`js/widgets/format.js`): probabilities as `.591` (3 decimals,
  no leading zero); expected counts as `4.16` (2 decimals); Gamma parameters as
  `(1.4082, 1.0770)` when quoting the paper, else 3 significant digits.

## 7. Parity tolerances

`verification/run_parity.mjs` bundles `engine/src` and compares every row of
`verification/golden/*.csv` with per-file tolerances in `verification/parity_spec.csv` (147
groups). The golden values come from two kinds of R code (`r-export/`, section 13): DPprior
2.0.0 via `pkgload::load_all` (see `golden_manifest.csv`), and base-R oracles that load no
package code and integrate over `u = F(alpha)` instead of log alpha (`oracle_u_space.csv`,
`oracle_wmax.csv`, and the oracle columns of `tsmm_boundary.csv`). A group with no rows, a
missing file or a checksum that disagrees with the manifest fails; there are no skips.

| Quantity | Tolerance |
|---|---|
| Stirling rows, log rising factorials | rel 1e-10 |
| conditional moments, A1 start, conversions, rho | rel 1e-6 |
| W_SB tails, cdf and quantiles; pmf entries; P(K_J = 1); tail probabilities | abs 1e-8 |
| W_SB density at w = 0 (golden 0 on the boundary) against its limit a / b | abs 1e-12 |
| Gamma-mixture moments (log-alpha grid against `integrate()`) | abs 1e-4 (variance: or rel 1e-6) |
| concentrated Gamma (`a > 1e4`) against the true Gamma integral | moments abs 1e-9, pmf abs 1e-10, E rho abs 1e-9 |
| golden rows that R computed as a point mass (conditional functions at a / b) | abs 1e-12 |
| u-space oracle (`oracle_u_space.csv`) | E K_J abs 1e-10, Var K_J rel 1e-10, P(K_J = 1) abs 1e-12; Pr(alpha < .1) abs 1e-12 (Wilson-Hilferty rows abs 1e-4) |
| exact W_max tail (`oracle_wmax.csv`, `wmax_mc.csv` deterministic rows) | abs 1e-9 / abs 1e-8 |
| W_max Monte Carlo rows | abs 5e-3 (seed and n_draws recorded) |
| fitted `(a, b)`: solvers, TSMM fits, released Dual-Anchor grid | abs 5e-3 (DORO records rel 1e-3) |
| solver outputs (`solvers.csv`): KL / tails at the solved `(a, b)` | abs 1e-3 / abs 3e-3 |
| TSMM fits (`tsmm_fits.csv`): alpha* / profile minimum variance | abs 1e-6 / abs 1e-2 |
| TSMM near the bounds (`tsmm_boundary.csv`) | status exact; alpha* rel 1e-9; v_J(alpha*) abs 1e-10; moments at the oracle's solution abs 1e-8; achieved moments within tolF (1e-6); log a within the row's conditioning tolerance; `(a, b)` rel 1e-4 against DPprior_fit where it converged |

At release 1.1.0: 17,351 comparisons in 147 groups, 0 failures, 0 skips
(`verification/parity_report.md`).

Golden values never come from the package default Gauss-Laguerre M = 80 (it returns
the stale .824 for `P(K_100 = 1 | Gamma(0.037, 0.037))`; the value is .8336).

## 8. Captions and vocabulary

- Every evidence page states: "K_J is the number of fitted components (occupied
  clusters) among the J units."
- "Collapse" always says whether it is a prior or a posterior statement
  (prior `Pr(K_J = 1)` versus posterior `Pr(K_J = 1 | data)`).
- `W_SB` (size-biased first weight: the share of the cluster a randomly chosen unit
  belongs to) is never called the largest weight; `W_max` (largest population weight)
  and the observed largest share are named separately.
- Simulation displays give the retained-fit denominator (8,607 of 9,000 fits).
- Site text is English. Terms: components versus clusters, `rho_k = w_k`,
  `K_N = K_J`, alpha = concentration, size-biased order (see `pages/vocabulary.qmd`).

## 9. Data contract

- `data/released/` holds only summaries released under CC BY 4.0 by the replication
  package (`joonho112/DPprior-paper-replication`): cell, school, study or score-group
  level. No student-level STAR data, no individual posterior draws, no OCRS records.
- The single respondent-level exception is `data/released/rasch_respondents.json`
  (Step 5.12): anonymous derived values `row_id, raw_score, wle, se, perfect` for the
  N = 500 vocabulary sample, re-derived from the public IRW table; no response matrix.
- Rights (since 1.1.0). Every file carries `license: "CC BY 4.0"`, a
  `license_scope` defined in the contract's `license_scopes` (`author`: the whole file is the
  author's output; `author-contribution`: the grant covers the author's results, upstream data
  keep their terms; `irw-derived`: CC BY 4.0 under the IRW derived licence, subject to upstream
  rights), a `rights_record` pointing to the replication package's `LICENSE-SCOPE.md` and
  `provenance/data-rights.csv`, and, unless the scope is `author`, `upstream` with `source`,
  `terms` and `fields` (the columns that come straight from the upstream data). The one source
  is `r-export/data_rights.csv`, applied by `r-export/_rights.R`. Application and Rasch tables
  never claim the `author` scope, and school- and study-level tables list `tau_hat`, `se` and
  `n_j` as upstream fields.
- `verification/check_data_contract.mjs` enforces the field allowlist, the declared rows,
  columns and checksums, the rights statement and the `.js` twins.

## 10. Attribution

- Teaching widgets after Broderick carry "After Broderick (MLSS 2016; 2012 tutorial)".
  Her `bnp_tutorial-master` R code is GPL-3 and is **not ported**; the widgets
  re-implement the mathematics. Slide figures are re-drawn, never embedded.
- Visual devices borrowed from Giordano's presentations carry an attribution line.
- The reference folders stay outside this repository. `ATTRIBUTION.md` lists every
  source, and the code stays MIT.

## 11. Shared files

One editor at a time owns: `CONTRACT.md`, `catalog/catalog.json`,
`catalog/schema/catalog.schema.json`, `_quarto.yml`, `styles/tokens.css`,
`verification/parity_spec.csv`, `verification/literal_allowlist.csv`,
`verification/run_all.sh`, `verification/golden/golden_manifest.csv`,
`data/released/data_contract.json`. Widget work adds its own files and reports catalog and
allowlist rows for the integrator to merge.

## 12. Checks

`bash verification/run_all.sh` (or `npm run verify` in `engine/`) runs fourteen steps and
stops at the first failure:

1. palette validator (section 4);
2. engine unit tests (`engine/tests/`, 63 at 1.1.0);
3. parity against the golden values (section 7);
4. literal scan with its self-test (section 1);
5. vocabulary scan with its self-test (section 8);
6. catalog check and data contract check (section 9), each with its self-test;
7. engine and bundle build, precomputed-data extraction;
8. Quarto render (failing on warnings, and on `engine/`, `verification/`, `catalog/schema/`,
   `scripts/` or `r-export/` appearing in `docs/`);
9. jsdom render smoke of every page and embed;
10. evidence captions (section 8);
11. calibration statuses (`check_states.mjs`: C-02, C-05 and C-06 show each TSMM status as the
    engine returns it);
12. read-outs (`check_readouts.mjs`: displayed numbers on the embed pages and in the prose of
    chosen site pages against the u-space oracle, golden values, closed forms and released tables,
    and six paper cross-checks of the released tables);
13. headless-Chrome `file://` smoke (skipped when Chrome is absent);
14. document numbers (`check_docs.mjs`): every count that README, the home page, this file,
    the newest CHANGELOG entry, CITATION, DEPLOY and the `r-export/` and
    `verification/` READMEs quote (comparisons, groups, tests, gate steps, widget files, catalog
    entries, pages, released tables, read-outs) equals what this run measured.

`--quick` skips steps 8 and 13. Every check with a `--self-test` plants mistakes it must catch.
Quarto `resources` globs start with `/` so that `js/**` cannot match
`engine/node_modules/*/src/js/`.

## 13. R exports

`r-export/` holds the R scripts that wrote every golden CSV, precomputed grid and released
JSON (`r-export/README.md` lists them). Each runs in its own `Rscript` process; DPprior 2.0.0
is loaded from source with `pkgload::load_all()` and never installed. `DPPRIOR_PKG` (the
package source) and `REPL_DIR` (the replication package) are required inputs; outputs go to the
repository root. After a rerun, `node verification/compare_rerun.mjs` passes when every output
differs from the committed file only in `generated_at` timestamps. MCMC is never rerun: the
posterior and simulation tables are copied from the replication package's released summaries.

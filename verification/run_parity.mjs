#!/usr/bin/env node
/**
 * Parity runner: dp-core (engine/src, bundled fresh with esbuild) against the R golden
 * values in verification/golden/ (DPprior 2.0.0 via pkgload::load_all, and base-R u-space
 * oracles that load no package code; see golden_manifest.csv and r-export/README.md).
 * Adapted from the IRW reliability webapp's run_parity.mjs.
 *
 *  1. checks every golden file's sha256 against golden_manifest.csv, and that every golden
 *     CSV has a manifest row;
 *  2. bundles engine/src/index.ts (the real source, not the built js/) and imports it;
 *  3. compares every golden row with the tolerance in parity_spec.csv
 *     (file, selector, column, tol_kind, tol, note); a spec row that compares nothing fails;
 *  4. writes verification/parity_report.md and exits 1 on any failure.
 *
 * Usage: node verification/run_parity.mjs        (from dpprior-explorer/)
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const GOLDEN = join(HERE, "golden");
const require = createRequire(join(ROOT, "engine", "package.json"));
const esbuild = require("esbuild");

// ---------------------------------------------------------------- csv -------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const readCsv = (p) => parseCsv(readFileSync(p, "utf8"));
const N = (v) => (v === "NA" || v === "" || v === undefined ? Number.NaN : Number(v));

// ---------------------------------------------------------- manifest --------
const manifest = readCsv(join(GOLDEN, "golden_manifest.csv"));
const manifestIssues = [];
for (const m of manifest) {
  const sha = createHash("sha256").update(readFileSync(join(GOLDEN, m.file))).digest("hex");
  if (sha !== m.sha256) manifestIssues.push(`${m.file}: sha256 ${sha.slice(0, 12)} != manifest ${m.sha256.slice(0, 12)}`);
}
for (const f of readdirSync(GOLDEN).filter((x) => x.endsWith(".csv") && x !== "golden_manifest.csv")) {
  if (!manifest.some((m) => m.file === f)) manifestIssues.push(`${f}: no row in golden_manifest.csv`);
}

// ------------------------------------------------------------ engine --------
const tmp = mkdtempSync(join(tmpdir(), "dpcore-parity-"));
const bundlePath = join(tmp, "dp-core.mjs");
await esbuild.build({
  entryPoints: [join(ROOT, "engine", "src", "index.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: bundlePath,
  logLevel: "silent",
});
const dp = await import(pathToFileURL(bundlePath).href);
rmSync(tmp, { recursive: true, force: true });

// ------------------------------------------------------------- spec ---------
const spec = readCsv(join(HERE, "parity_spec.csv"));
function specFor(file, selector, column) {
  const hit = spec.find((s) => s.file === file && s.selector === selector && s.column === column);
  if (!hit) throw new Error(`parity_spec.csv has no row for ${file} [${selector}] ${column}`);
  return hit;
}
function withinTol(got, want, s) {
  if (Number.isNaN(want) && Number.isNaN(got)) return { ok: true, err: 0 };
  const abs = Math.abs(got - want);
  const rel = abs / Math.max(Math.abs(want), 1e-300);
  if (s.tol_kind === "abs") return { ok: abs <= Number(s.tol), err: abs };
  if (s.tol_kind === "rel") return { ok: rel <= Number(s.tol) || abs === 0, err: rel };
  if (s.tol_kind === "abs_or_rel") {
    const [ta, tr] = s.tol.split("|").map(Number);
    return { ok: abs <= ta || rel <= tr, err: Math.min(abs, rel) };
  }
  if (s.tol_kind === "exact") return { ok: got === want, err: abs };
  throw new Error(`unknown tol_kind ${s.tol_kind}`);
}

// ------------------------------------------------------------ checks --------
const results = new Map(); // key -> {file, selector, column, n, maxErr, failures:[]}
function record(file, selector, column, got, want, context) {
  const s = specFor(file, selector, column);
  const key = `${file}|${selector}|${column}`;
  if (!results.has(key)) results.set(key, { file, selector, column, spec: s, n: 0, maxErr: 0, failures: [] });
  const r = results.get(key);
  const { ok, err } = withinTol(got, want, s);
  r.n += 1;
  if (Number.isFinite(err)) r.maxErr = Math.max(r.maxErr, err);
  if (!ok) r.failures.push(`${context}: engine ${got} vs golden ${want}`);
}
const skipped = [];

// stirling
for (const f of ["stirling_J50.csv", "stirling_J500.csv"]) {
  for (const row of readCsv(join(GOLDEN, f))) {
    const J = N(row.J);
    const k = N(row.k);
    record(f, "all", "log_stirling", dp.logStirlingRow(J)[k], N(row.log_stirling), `J=${J} k=${k}`);
  }
}
for (const row of readCsv(join(GOLDEN, "selftest_rowsum.csv"))) {
  const J = N(row.J);
  record("selftest_rowsum.csv", "all", "logsumexp_row", dp.logSumExp(dp.logStirlingRow(J).subarray(1)), N(row.logsumexp_row), `J=${J}`);
}
for (const row of readCsv(join(GOLDEN, "cond_moments.csv"))) {
  const [J, a] = [N(row.J), N(row.alpha)];
  const dg = row.method === "digamma";
  const sel = dg ? "method=digamma" : "method=finite_sum";
  record("cond_moments.csv", sel, "mean", dg ? dp.condMeanDigamma(J, a) : dp.condMean(J, a), N(row.mean), `J=${J} alpha=${a}`);
  record("cond_moments.csv", sel, "var", dg ? dp.condVarDigamma(J, a) : dp.condVar(J, a), N(row.var), `J=${J} alpha=${a}`);
}
for (const row of readCsv(join(GOLDEN, "log_rising.csv"))) {
  record("log_rising.csv", "all", "log_rising", dp.logRising(N(row.alpha), N(row.J)), N(row.log_rising), `J=${row.J} alpha=${row.alpha}`);
}
for (const row of readCsv(join(GOLDEN, "cond_pmf_J50.csv"))) {
  record("cond_pmf_J50.csv", "all", "pmf", dp.condPmf(50, N(row.alpha))[N(row.k)], N(row.pmf), `alpha=${row.alpha} k=${row.k}`);
}
for (const row of readCsv(join(GOLDEN, "wsb.csv"))) {
  const [a, b, x] = [N(row.a), N(row.b), N(row.x)];
  const kind = row.kind;
  if (kind === "density" && x === 0) {
    // R's dgamma-based golden returns 0 on the boundary; the density's limit as w -> 0 is a / b
    // (compared with that closed form instead of skipped, since 1.1.0)
    record("wsb.csv", "density at w = 0: the limit a / b", "value", dp.wsbDensity(0, a, b), a / b, `(${row.a}, ${row.b})`);
    continue;
  }
  const got =
    kind === "tail" ? dp.wsbTail(x, a, b)
    : kind === "density" ? dp.wsbDensity(x, a, b)
    : kind === "cdf" ? dp.wsbCdf(x, a, b)
    : kind === "quantile" ? dp.wsbQuantile(x, a, b)
    : dp.wsbTailGivenAlpha(x, N(row.alpha));
  record("wsb.csv", `kind=${kind}`, "value", got, N(row.value), `(${row.a}, ${row.b}, alpha ${row.alpha}) x=${x}`);
}
for (const row of readCsv(join(GOLDEN, "rho.csv"))) {
  const kind = row.kind;
  if (kind === "cond_mean") record("rho.csv", "kind=cond_mean", "value", dp.meanRhoGivenAlpha(N(row.alpha)), N(row.value), `alpha=${row.alpha}`);
  else if (kind === "cond_var") record("rho.csv", "kind=cond_var", "value", dp.varRhoGivenAlpha(N(row.alpha)), N(row.value), `alpha=${row.alpha}`);
  else {
    const sel = N(row.a) > dp.POINT_MASS_A ? "kind=marg_mean,a>1e4" : "kind=marg_mean";
    record("rho.csv", sel, "value", dp.meanRho(N(row.a), N(row.b)), N(row.value), `(${row.a}, ${row.b})`);
  }
}
for (const row of readCsv(join(GOLDEN, "a1_init.csv"))) {
  const r = dp.a1Init(N(row.J), N(row.mu_K), N(row.var_K));
  const ctx = `J=${row.J} mu=${row.mu_K} var=${row.var_K}`;
  record("a1_init.csv", "all", "status", r.ok ? 1 : 0, row.status === "ok" ? 1 : 0, ctx);
  if (row.status === "ok") {
    record("a1_init.csv", "status=ok", "a0", r.a0, N(row.a0), ctx);
    record("a1_init.csv", "status=ok", "b0", r.b0, N(row.b0), ctx);
  }
}
for (const row of readCsv(join(GOLDEN, "elicitation_conversions.csv"))) {
  const mu = N(row.mu_K);
  let varK;
  if (row.kind === "vif" || row.kind === "confidence_vif") varK = dp.vifToVariance(mu, N(row.param));
  else if (row.kind === "cv_K") varK = dp.cvToVariance(mu, N(row.param));
  else {
    const m = dp.intervalToMoments(N(row.lo), N(row.hi), N(row.coverage), mu);
    varK = m.varK;
    record("elicitation_conversions.csv", "kind=interval_normal", "z", m.z, N(row.z), `coverage=${row.coverage}`);
  }
  const ctx = `${row.kind} ${row.param}${row.lo} ${row.hi}`;
  record("elicitation_conversions.csv", "all", "var_K", varK, N(row.var_K), ctx);
  const f = dp.checkTarget(N(row.J), mu, varK);
  record("elicitation_conversions.csv", "all", "support_ok", f.supportOk ? 1 : 0, row.support_ok === "TRUE" ? 1 : 0, ctx);
  record("elicitation_conversions.csv", "all", "a1_ok", f.a1Ok ? 1 : 0, row.a1_ok === "TRUE" ? 1 : 0, ctx);
}
const gridCache = new Map();
const gridOf = (a, b) => {
  const key = `${a}|${b}`;
  if (!gridCache.has(key)) gridCache.set(key, dp.alphaGrid(a, b));
  return gridCache.get(key);
};
for (const row of readCsv(join(GOLDEN, "marginal_moments.csv"))) {
  const [a, b, J] = [N(row.a), N(row.b), N(row.J)];
  // point-mass rows describe K_J given alpha = a / b; the engine integrates the true Gamma for a > 1e4
  const m = row.method === "point_mass" ? { mean: dp.condMean(J, a / b), var: dp.condVar(J, a / b) } : dp.mixMoments(J, a, b, gridOf(a, b));
  const sel = row.method === "point_mass" ? "method=point_mass" : a > dp.POINT_MASS_A ? "a>1e4,true_gamma" : "method=integrate";
  record("marginal_moments.csv", sel, "mean", m.mean, N(row.mean), `${row.label} J=${J}`);
  record("marginal_moments.csv", sel, "var", m.var, N(row.var), `${row.label} J=${J}`);
}
const condCache = new Map();
const condPmfOf = (J, alpha) => {
  const key = `${J}|${alpha}`;
  if (!condCache.has(key)) condCache.set(key, dp.condPmf(J, alpha));
  return condCache.get(key);
};
const pmfCache = new Map();
const pmfOf = (J, a, b) => {
  const key = `${J}|${a}|${b}`;
  if (!pmfCache.has(key)) pmfCache.set(key, dp.mixPmf(J, a, b, gridOf(a, b)));
  return pmfCache.get(key);
};
for (const row of readCsv(join(GOLDEN, "marginal_pmf_J50_J100_J500.csv"))) {
  const [a, b, J, k] = [N(row.a), N(row.b), N(row.J), N(row.k)];
  const sel = row.method === "point_mass" ? "method=point_mass" : a > dp.POINT_MASS_A ? "a>1e4,true_gamma" : "method=integrate";
  const got = row.method === "point_mass" ? condPmfOf(J, a / b)[k] : pmfOf(J, a, b)[k];
  record("marginal_pmf_J50_J100_J500.csv", sel, "pmf", got, N(row.pmf), `${row.label} J=${J} k=${k}`);
}
for (const row of readCsv(join(GOLDEN, "marginal_quantiles.csv"))) {
  const J = N(row.J);
  const fixed = Number.isFinite(N(row.alpha_fixed));
  const [a, b] = [N(row.a), N(row.b)];
  const pmf = fixed ? dp.condPmf(J, N(row.alpha_fixed)) : pmfOf(J, a, b);
  const s = dp.pmfSummary(pmf);
  const sel = J > 500 ? "J>500" : "J<=500";
  const ctx = `${row.label} J=${J}`;
  for (const col of ["q05", "median", "q95"]) record("marginal_quantiles.csv", sel, col, s[col], N(row[col]), ctx);
  record("marginal_quantiles.csv", sel, "p_K1", s.pK1, N(row.p_K1), ctx);
  if (!fixed) record("marginal_quantiles.csv", "closed_form", "p_K1", dp.mixPK1(J, a, b), N(row.p_K1), ctx);
  if (!fixed) record("marginal_quantiles.csv", sel, "pr_alpha_lt_0.1", dp.prAlphaBelow(0.1, a, b), N(row["pr_alpha_lt_0.1"]), ctx);
}
for (const row of readCsv(join(GOLDEN, "wmax_mc.csv"))) {
  const t = N(row.t);
  const fixed = Number.isFinite(N(row.alpha));
  const got = fixed ? dp.wmaxTailGivenAlpha(t, N(row.alpha)) : dp.wmaxTail(t, N(row.a), N(row.b));
  const ctx = `${row.label} t=${t}`;
  if (!fixed) {
    const bd = dp.wmaxBounds(t, N(row.a), N(row.b));
    record("wmax_mc.csv", "bounds", "lower_bound", bd.lower, N(row.lower_bound), ctx);
    record("wmax_mc.csv", "bounds", "upper_bound", bd.upper, N(row.upper_bound), ctx);
  }
  if (!Number.isFinite(N(row.estimate))) {
    // the package returned bounds only: check the engine inside them, and against the exact value
    // of oracle_wmax.csv below (before 1.1.0 this was a documented skip)
    const bd = dp.wmaxBounds(t, N(row.a), N(row.b));
    record("wmax_mc.csv", "bounds", "inside", got >= bd.lower - 1e-12 && got <= bd.upper + 1e-12 ? 1 : 0, 1, ctx);
    continue;
  }
  record("wmax_mc.csv", `method=${row.method}`, "estimate", got, N(row.estimate), ctx);
}

// method catalog (Step 4.6): engine recomputes each summary from the (a, b) the R script used
{
  const mc = JSON.parse(readFileSync(join(ROOT, "data", "precomputed", "method_catalog.json"), "utf8"));
  const abOf = (method, key, n) => {
    if (method === "vague") return [1, 1];
    if (method === "ssi") return [mc.ssi.a, mc.ssi.b];
    if (method === "doro") { const d = mc.doro.find((x) => x.label === key); return [d.a, d.b, d.support_max]; }
    const m = Number(n);
    const sc = mc.scal.find((x) => x.m === m);
    return method === "scal_exact" ? [sc.exact.a, sc.exact.b, sc.q] : [Math.exp(-0.033 * m), Math.exp(-0.033 * m), sc.q];
  };
  // Step 7.3 records: summaries at the record's (a, b) (or fixed alpha), and the DORO fits re-solved
  const recOf = (id) => mc.records.find((x) => x.id === id);
  const doroCache = new Map();
  const doroOf = (rec) => {
    if (!doroCache.has(rec.id)) {
      const d = rec.design[0];
      doroCache.set(rec.id, rec.family === "doro-unif" ? dp.doroKL(d.J, { muK: (d.support_max + 1) / 2 }) : dp.doroKL(d.J));
    }
    return doroCache.get(rec.id);
  };
  const recordRow = (row) => {
    const rec = recOf(row.key);
    const J = N(row.n);
    const q = row.quantity;
    let got;
    if (["a", "b", "kl", "leak"].includes(q)) got = doroOf(rec)[q];
    else if (rec.prior?.type === "point") {
      const al = rec.prior.alpha;
      if (q === "EK") got = dp.condMean(J, al);
      else if (q === "pK1") got = Math.exp(dp.lgamma(al + 1) + dp.lgamma(J) - dp.lgamma(al + J));
      else got = dp.wsbTailGivenAlpha(q === "S50" ? 0.5 : 0.9, al);
    } else if (q === "EK") got = dp.mixMoments(J, rec.a, rec.b).mean;
    else if (q === "pK1") got = dp.mixPK1(J, rec.a, rec.b);
    else got = dp.wsbTail(q === "S50" ? 0.5 : 0.9, rec.a, rec.b);
    record("method_catalog.csv", `record quantity=${q}`, "value", got, N(row.value), `${row.key}${Number.isFinite(J) ? ` J=${J}` : ""}`);
  };
  for (const row of readCsv(join(GOLDEN, "method_catalog.csv"))) {
    if (row.method === "record") {
      recordRow(row);
      continue;
    }
    const [a, b, extra] = abOf(row.method, row.key, row.n);
    const n = N(row.n);
    const q = row.quantity;
    if (row.method === "doro" && (q === "a" || q === "b")) {
      // the engine's own KL solver against the R fit (Step 7.3: Nelder-Mead on the integrate() KL)
      const d = mc.doro.find((x) => x.label === row.key);
      const fit = dp.doroKL(n, { muK: d.muK });
      record("method_catalog.csv", `quantity=${q}`, "value", fit[q], N(row.value), `${row.key} J=${n} muK=${d.muK} (engine KL ${fit.kl.toExponential(6)} vs catalog ${d.kl.toExponential(6)})`);
      continue;
    }
    let got;
    if (q === "S50") got = dp.wsbTail(0.5, a, b);
    else if (q === "S90") got = dp.wsbTail(0.9, a, b);
    else if (q === "EK") got = dp.mixMoments(n, a, b).mean;
    else {
      const pmf = pmfOf(n, a, b);
      if (q === "pK1") got = pmf[1];
      else if (q === "leak" || q === "pGEq") {
        const upto = q === "leak" ? extra : extra - 1;
        let s = 0;
        for (let k = 1; k <= upto; k += 1) s += pmf[k];
        got = 1 - s;
      } else if (q === "kl") {
        let s = 0;
        for (let k = 1; k <= extra; k += 1) s += (1 / extra) * Math.log(1 / extra / pmf[k]);
        got = s;
      }
    }
    record("method_catalog.csv", `quantity=${q}`, "value", got, N(row.value), `${row.method} ${row.key} n=${row.n}`);
  }
}

// solvers (Step 7.2): SSI-Weight, DORO, DORO-Unif and SCAL solved by the engine; the published
// and shortcut rows evaluate fixed (a, b)
{
  const SOLVED = new Set(["ssi", "doro", "doro_unif", "scal_exact"]);
  const cache = new Map();
  const solve = (method, n) => {
    const key = `${method}|${n}`;
    if (!cache.has(key)) {
      if (method === "ssi") cache.set(key, dp.ssiSolve());
      else if (method === "doro") cache.set(key, dp.doroKL(n));
      else if (method === "doro_unif") cache.set(key, dp.doroKL(n, { muK: 5 }));
      else cache.set(key, dp.scalSolve(n));
    }
    return cache.get(key);
  };
  for (const row of readCsv(join(GOLDEN, "solvers.csv"))) {
    const n = N(row.n_or_m);
    const sel = `method=${row.method}`;
    const ctx = `${row.method} n_or_m=${n}`;
    let a;
    let b;
    if (SOLVED.has(row.method)) {
      const r = solve(row.method, n);
      a = r.a;
      b = r.b;
      record("solvers.csv", sel, "a", a, N(row.a), ctx);
      record("solvers.csv", sel, "b", b, N(row.b), ctx);
      if (row.method === "doro" || row.method === "doro_unif") record("solvers.csv", sel, "KL", r.kl, N(row.KL), ctx);
    } else if (row.method === "scal_shortcut") {
      const sc = dp.scalShortcut(n);
      a = sc.a;
      b = sc.b;
      record("solvers.csv", sel, "a", a, N(row.a), ctx);
    } else {
      a = N(row.a);
      b = N(row.b);
    }
    const pmf = pmfOf(n, a, b);
    record("solvers.csv", sel, "P_K1", pmf[1], N(row.P_K1), ctx);
    if (row.method === "ssi") record("solvers.csv", sel, "P_tail", dp.wsbTail(0.9, a, b), N(row.P_tail), ctx);
    else if (row.method !== "doro") {
      const below = N(row.tail_q) - 1;
      let s = 0;
      for (let k = 1; k <= below; k += 1) s += pmf[k];
      record("solvers.csv", sel, "P_tail", 1 - s, N(row.P_tail), `${ctx} K >= ${row.tail_q}`);
    }
    record("solvers.csv", sel, "E_K", dp.mixMoments(n, a, b).mean, N(row.E_K), ctx);
    record("solvers.csv", sel, "S_half", dp.wsbTail(0.5, a, b), N(row.S_half), ctx);
  }
}

// count prior by J (Step 7.11): engine summaries at the R TSMM solutions and at the J = 500 prior
// carried to every J; the TSMM targets (E K = 5, Var K = 9.742) re-checked by the engine
{
  const cp = JSON.parse(readFileSync(join(ROOT, "data", "precomputed", "count_prior_by_J.json"), "utf8"));
  const abRecal = new Map(cp.recalibrated.filter((r) => r.feasible).map((r) => [r.J, [r.a, r.b]]));
  for (const row of readCsv(join(GOLDEN, "count_prior_by_J.csv"))) {
    if (row.quantity === "a" || row.quantity === "b") continue; // TSMM itself is solved in R (A2-MN); its moments are checked below
    const J = N(row.J);
    const [a, b] = row.block === "recalibrated" ? abRecal.get(J) : [cp.transported.a, cp.transported.b];
    let got;
    if (row.quantity === "E_K") got = dp.mixMoments(J, a, b).mean;
    else if (row.quantity === "S50") got = dp.wsbTail(0.5, a, b);
    else if (row.quantity === "P_K1") got = dp.mixPK1(J, a, b);
    else got = dp.pmfSummary(pmfOf(J, a, b))[row.quantity];
    record("count_prior_by_J.csv", `block=${row.block}`, row.quantity, got, N(row.value), `J=${J}`);
  }
  for (const r of cp.recalibrated.filter((x) => x.feasible)) {
    const m = dp.mixMoments(r.J, r.a, r.b);
    record("count_prior_by_J.csv", "tsmm_target", "E_K", m.mean, cp.target.mu_K, `J=${r.J}`);
    record("count_prior_by_J.csv", "tsmm_target", "Var_K", m.var, cp.target.var_K, `J=${r.J}`);
  }
}

// Dual-Anchor (Step 11.1): the engine's S(.5) and count moments at the golden (a, b) of the J = 50
// worked example, and the released dual_anchor_grid.json (read by C-08) against the recomputed grid
{
  const released = JSON.parse(readFileSync(join(ROOT, "data", "released", "dual_anchor_grid.json"), "utf8"));
  for (const row of readCsv(join(GOLDEN, "dual_anchor.csv"))) {
    const [a, b] = [N(row.a), N(row.b)];
    const ctx = `${row.mode}${row.mode === "dual_soft" ? ` lambda=${row.lambda}` : ""} (${a}, ${b})`;
    const m = dp.mixMoments(50, a, b);
    record("dual_anchor.csv", "all", "S50", dp.wsbTail(0.5, a, b), N(row.S50), ctx);
    record("dual_anchor.csv", "all", "E_K", m.mean, N(row.E_K), ctx);
    record("dual_anchor.csv", "all", "Var_K", m.var, N(row.Var_K), ctx);
    if (row.mode !== "dual_soft") continue;
    const g = released.find((r) => r.mode === "dual_soft" && Math.abs(r.lambda - N(row.lambda)) < 1e-9);
    record("dual_anchor.csv", "released grid", "a", g ? g.a : NaN, a, `${ctx}: released`);
    record("dual_anchor.csv", "released grid", "b", g ? g.b : NaN, b, `${ctx}: released`);
    record("dual_anchor.csv", "released grid", "selected", g && g.selected === (row.selected === "TRUE") ? 1 : 0, 1, `${ctx}: released selected ${g && g.selected}`);
  }
}

// TSMM (Step 8.2): the engine's Newton against DPprior_fit (A2-MN), and the profile bound
{
  for (const row of readCsv(join(GOLDEN, "tsmm_fits.csv"))) {
    const J = N(row.J);
    const r = dp.tsmmFit(J, N(row.mu_K), N(row.sigma2));
    const ctx = `${row.case} J=${J} (${row.mu_K}, ${row.sigma2})`;
    record("tsmm_fits.csv", "all", "status", r.status === row.status ? 1 : 0, 1, `${ctx}: engine ${r.status}, golden ${row.status}`);
    record("tsmm_fits.csv", "all", "alpha_star", r.alphaStar, N(row.alpha_star), ctx);
    record("tsmm_fits.csv", "all", "min_var", r.minVar, N(row.min_var), ctx);
    if (row.status !== "ok") continue;
    record("tsmm_fits.csv", "status=ok", "a", r.a, N(row.a), ctx);
    record("tsmm_fits.csv", "status=ok", "b", r.b, N(row.b), ctx);
    record("tsmm_fits.csv", "status=ok", "E_K", dp.mixMoments(J, r.a, r.b).mean, N(row.E_K), ctx);
    record("tsmm_fits.csv", "status=ok", "S50", dp.wsbTail(0.5, r.a, r.b), N(row.S50), ctx);
  }
}

// Exact Pr(W_max > t), t >= 1/2, against R integrate (r-export/15, oracle_wmax.csv)
{
  for (const row of readCsv(join(GOLDEN, "oracle_wmax.csv"))) {
    record("oracle_wmax.csv", "all", "wmax_tail", dp.wmaxTail(N(row.t), N(row.a), N(row.b)), N(row.wmax_tail), `${row.label} t=${row.t}`);
  }
}

// Gamma mixtures against an oracle that shares nothing with the log-alpha grid:
// r-export/15_oracle_u_space.R integrates over u in (0, 1) with alpha = qgamma(u, a, b).
{
  for (const row of readCsv(join(GOLDEN, "oracle_u_space.csv"))) {
    const [a, b, J] = [N(row.a), N(row.b), N(row.J)];
    const ctx = `${row.label} J=${J}`;
    const m = dp.mixMoments(J, a, b);
    record("oracle_u_space.csv", "all", "E_K", m.mean, N(row.E_K), ctx);
    record("oracle_u_space.csv", "all", "Var_K", m.var, N(row.Var_K), ctx);
    record("oracle_u_space.csv", "all", "P_K1", dp.mixPK1(J, a, b), N(row.P_K1), ctx);
    record("oracle_u_space.csv", a > dp.POINT_MASS_A ? "a>1e4" : "a<=1e4", "pr_alpha_lt_0.1", dp.prAlphaBelow(0.1, a, b), N(row["pr_alpha_lt_0.1"]), ctx);
  }
}

// TSMM near the edges: an independent R oracle (u-space integrate, nested root
// finding). The engine must reach the same status, the same profile bound and support ceiling, the
// target moments within tolF, and a shape within the row's conditioning-aware tolerance on log a.
{
  for (const row of readCsv(join(GOLDEN, "tsmm_boundary.csv"))) {
    const [J, mu, v] = [N(row.J), N(row.mu_K), N(row.var_K)];
    const r = dp.tsmmFit(J, mu, v);
    const ctx = `${row.case} J=${J} (${mu}, ${v})`;
    record("tsmm_boundary.csv", "all", "status", r.status === row.status ? 1 : 0, 1, `${ctx}: engine ${r.status}, oracle ${row.status}`);
    record("tsmm_boundary.csv", "all", "support_upper", r.supportUpper, N(row.support_upper), ctx);
    if (row.status === "support") continue;
    record("tsmm_boundary.csv", "not support", "alpha_star", r.alphaStar, N(row.alpha_star), ctx);
    record("tsmm_boundary.csv", "not support", "min_var", r.minVar, N(row.min_var), ctx);
    if (row.status === "infeasible") continue;
    const [aR, bR] = [N(row.a), N(row.b)];
    const atR = dp.tsmmMoments(J, aR, bR);
    record("tsmm_boundary.csv", "solved", "E_K at the oracle fit", atR.M1, N(row.E_K), ctx);
    record("tsmm_boundary.csv", "solved", "Var_K at the oracle fit", atR.V, N(row.Var_K), ctx);
    record("tsmm_boundary.csv", "solved", "engine E_K - mu_K", r.achieved.M1 - mu, 0, ctx);
    record("tsmm_boundary.csv", "solved", "engine Var_K - sigma^2", r.achieved.V - v, 0, ctx);
    record("tsmm_boundary.csv", "solved", "log a gap / row tolerance", Math.abs(Math.log(r.a) - Math.log(aR)) / N(row.tol_log_a), 0, `${ctx}: engine a ${r.a}, oracle ${aR}`);
    if (row.pkg_status === "converged" && row.status === "ok") {
      record("tsmm_boundary.csv", "DPprior 2.0.0 converged", "a", r.a, N(row.pkg_a), ctx);
      record("tsmm_boundary.csv", "DPprior 2.0.0 converged", "b", r.b, N(row.pkg_b), ctx);
    }
  }
}

// ------------------------------------------------------------ report --------
const rows = [...results.values()];
const failures = rows.flatMap((r) => r.failures.map((f) => `${r.file} [${r.selector}] ${r.column}: ${f}`));
// a spec row that compared nothing (a renamed column, an emptied golden file, a selector that
// no longer matches) would otherwise pass unseen
for (const s of spec) {
  if (!results.has(`${s.file}|${s.selector}|${s.column}`)) failures.push(`${s.file} [${s.selector}] ${s.column}: parity_spec.csv row compared no golden value`);
}
const lines = [];
lines.push("# Parity report");
lines.push("");
lines.push(`Written by \`verification/run_parity.mjs\` on ${new Date().toISOString()} (node ${process.version}).`);
lines.push("Engine: `engine/src/index.ts` bundled fresh with esbuild. Golden: `verification/golden/` (DPprior 2.0.0 via `pkgload::load_all`, and base-R u-space oracles that load no package code; see `golden_manifest.csv` and `r-export/README.md`).");
lines.push("");
lines.push(`**Result: ${failures.length === 0 && manifestIssues.length === 0 ? "PASS" : "FAIL"}**; ${rows.reduce((s, r) => s + r.n, 0)} comparisons, ${failures.length} failures, ${manifestIssues.length} manifest issues, ${skipped.length} documented skips.`);
lines.push("");
lines.push("| golden file | selector | column | cases | max error | tolerance | result |");
lines.push("|---|---|---|---:|---:|---|---|");
for (const r of rows) {
  lines.push(`| ${r.file} | ${r.selector} | ${r.column} | ${r.n} | ${r.maxErr.toExponential(2)} | ${r.spec.tol_kind} ${r.spec.tol} | ${r.failures.length ? `FAIL (${r.failures.length})` : "pass"} |`);
}
lines.push("");
lines.push("## Manifest");
lines.push("");
lines.push(manifestIssues.length ? manifestIssues.map((m) => `- ${m}`).join("\n") : `All ${manifest.length} golden files match their sha256 in golden_manifest.csv.`);
lines.push("");
lines.push("## Documented skips");
lines.push("");
lines.push(skipped.length ? skipped.map((m) => `- ${m}`).join("\n") : "None.");
if (failures.length) {
  lines.push("");
  lines.push("## Failures (first 50)");
  lines.push("");
  lines.push(failures.slice(0, 50).map((f) => `- ${f}`).join("\n"));
}
lines.push("");
writeFileSync(join(HERE, "parity_report.md"), lines.join("\n"));

console.log(`parity: ${rows.reduce((s, r) => s + r.n, 0)} comparisons in ${rows.length} groups; failures ${failures.length}; manifest issues ${manifestIssues.length}; skips ${skipped.length}`);
for (const f of [...manifestIssues, ...failures].slice(0, 20)) console.error(`  FAIL ${f}`);
console.log(failures.length === 0 && manifestIssues.length === 0 ? "parity: PASS" : "parity: FAIL");
process.exit(failures.length === 0 && manifestIssues.length === 0 ? 0 : 1);

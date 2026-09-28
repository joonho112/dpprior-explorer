#!/usr/bin/env node
/**
 * Read-out check (since 1.1.0): the numbers a reader sees, compared with their authority.
 * Opens rendered embed pages in jsdom with a query, reads the widget's read-out (or its tiles),
 * extracts the displayed numbers with a pattern, and compares each with an authority value at the
 * displayed precision (|shown - authority| <= half a unit of the last shown digit). Authorities:
 *   oracle   verification/golden/oracle_u_space.csv (R, u-space integrate; independent of dp-core)
 *   golden   verification/golden/tsmm_fits.csv, dual_anchor.csv, solvers.csv (DPprior 2.0.0 / R)
 *   closed   a closed form computed here (0.5^alpha, harmonic numbers, the W_SB tail)
 *   released data/released/app_priors.json and cell_summary.json (the frozen replication tables)
 *   bound    verification/golden/tsmm_boundary.csv (R, u-space nested solver; independent of dp-core
 *            and of DPprior's own solver), for the elicitation example "[3, 10] with 80% probability"
 *   paper    arXiv v3 values quoted in the case (Table 2, Sec. 3.5, Table 5), a cross-check of the
 *            released tables at the paper's precision
 * Cases with from: "page" read the prose of a rendered site page (docs/<page>.html) instead of a
 * widget: numbers typed into a page's text are checked the same way.
 * This complements the literal scan: a result typed into a widget, a wiring slip (wrong column, wrong
 * prior) or a formatting slip changes a displayed number and fails here.
 *
 * Usage: node verification/check_readouts.mjs [--self-test]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const GOLD = join(ROOT, "verification", "golden");
const require = createRequire(join(ROOT, "engine", "package.json"));
const { JSDOM, VirtualConsole } = require("jsdom");

// ---------------------------------------------------------------- authorities
function readCsv(file) {
  const text = readFileSync(join(GOLD, file), "utf8").trim().split("\n");
  const split = (l) => { const out = []; let f = ""; let q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(f); f = ""; } else f += ch; } out.push(f); return out; };
  const head = split(text[0]);
  return text.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}
const oracle = readCsv("oracle_u_space.csv");
const O = (label, J, col) => { const r = oracle.find((x) => x.label === label && Number(x.J) === J); if (!r) throw new Error(`oracle row ${label} J=${J} missing`); return Number(r[col]); };
const fits = readCsv("tsmm_fits.csv");
const F = (c, col) => Number(fits.find((x) => x.case === c)[col]);
const da = readCsv("dual_anchor.csv");
const DA = da.find((x) => x.mode === "dual_soft" && x.selected === "TRUE");
const solvers = readCsv("solvers.csv");
const apps = JSON.parse(readFileSync(join(ROOT, "data", "released", "app_priors.json"), "utf8"));
const A = (app, prior) => { const r = (apps.rows ?? apps).find((x) => x.app === app && x.prior === prior); if (!r) throw new Error(`app_priors ${app} ${prior} missing`); return r; };
const bound = readCsv("tsmm_boundary.csv");
const TB = (c, col) => { const r = bound.find((x) => x.case === c); if (!r) throw new Error(`tsmm_boundary row ${c} missing`); return Number(r[col]); };
const K80 = "ok_J100_3to10_80"; // "[3, 10] with 80% probability" at J = 100
const K95 = "infeasible_J100_3to10_95";
// simulation fits from the released cell table: all suites, and the 45 main cells (suite headline_n01)
const cells = JSON.parse(readFileSync(join(ROOT, "data", "released", "cell_summary.json"), "utf8"));
const simSum = (rows) => ({ manifest: rows.reduce((s, r) => s + r.n_manifest, 0), eligible: rows.reduce((s, r) => s + r.n_scientific_eligible, 0), cells: rows.length });
const SIM = { all: simSum(cells), headline: simSum(cells.filter((r) => r.suite === "headline_n01")) };
// specification sensitivity (A-12): the released comparison rows of the two applications
const sensRows = JSON.parse(readFileSync(join(ROOT, "data", "released", "app_sensitivity.json"), "utf8"));
const SENS = (app, spec, prior) => { const r = sensRows.find((x) => x.app === app && x.spec === spec && x.prior === prior); if (!r) throw new Error(`app_sensitivity ${app} ${spec} ${prior} missing`); return r; };
const sensCase = (app, spec) => {
  const v = SENS(app, spec, "Vague");
  const d = SENS(app, spec, "Dual-Anchor");
  const rms = sensRows.filter((x) => x.app === app && x.spec === spec).map((x) => x.rms_unit_shift);
  return [v.ref_E_K, v.sens_E_K, v.ref_p_K1, v.sens_p_K1, d.ref_E_K, d.sens_E_K, d.ref_p_K1, d.sens_p_K1, Math.min(...rms), Math.max(...rms)];
};
const SENS_PATTERN = /Vague E K_J ([.\d]+) → ([.\d]+), collapse ([.\d]+) → ([.\d]+);.*Dual-Anchor E K_J ([.\d]+) → ([.\d]+), collapse ([.\d]+) → ([.\d]+);.*RMS change ([.\d]+) to ([.\d]+)\./;
// standard normal cdf (Abramowitz-Stegun 7.1.26 for erf; error < 1.5e-7, ample for a percentage with one decimal)
const pnorm = (x) => {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
};
const H = (n) => { let s = 0; for (let i = 1; i <= n; i += 1) s += 1 / i; return s; }; // E K_n at alpha = 1
const wsb = (t, a, b) => (b / (b - Math.log(1 - t))) ** a;

// ------------------------------------------------------------------- cases
// each: page, query, from ("readout" | "tiles"), pattern with capture groups, expected [values], sources
const CASES = [
  { id: "P-05 alpha .5", page: "stick-breaking", query: "alpha=0.5", pattern: /E\[w1\] = 1\/\(1 \+ alpha\) = ([.\d]+), Pr\(w1 > \.5\) = 0\.5\^alpha = ([.\d]+)/, expect: () => [1 / 1.5, 0.5 ** 0.5], source: "closed form" },
  { id: "P-05 alpha 2", page: "stick-breaking", query: "alpha=2", pattern: /0\.5\^alpha = ([.\d]+)/, expect: () => [0.25], source: "closed form" },
  { id: "P-05 alpha 10", page: "stick-breaking", query: "alpha=10", pattern: /0\.5\^alpha = ([.\d<]+)/, expect: () => [0.5 ** 10], source: "closed form (.00098 prints as .001)" },
  { id: "P-07 E K_79 at alpha 1", page: "crp", query: "alpha=1", pattern: /Expected tables after 79: ([.\d]+)/, expect: () => [H(79)], source: "closed form (harmonic number)" },
  { id: "P-15 E K_100 at alpha 1", page: "kj-replicates", query: "J=100&alpha=1&n=200&seed=1", pattern: /E\(K_100 \| alpha\) = ([.\d]+)/, expect: () => [H(100)], source: "closed form (harmonic number)" },
  { id: "C-04 Gamma(1,1) J 100", page: "two-lenses", query: "a=1&b=1&J=100", pattern: /E K_J = ([.\d]+).*Pr\(W_SB > \.5\) = ([.\d]+), Pr\(W_SB > \.9\) = ([.\d]+)/, expect: () => [O("Gamma(1,1)", 100, "E_K"), wsb(0.5, 1, 1), wsb(0.9, 1, 1)], source: "oracle; closed form" },
  { id: "M-01 Gamma(1,1) E K_J", page: "defaults-drift", query: "", pattern: /E K_J = ([.\d]+) at J = 50, ([.\d]+) at 100, ([.\d]+) at 2000, ([.\d]+) at 5000\. Pr\(W_SB > \.5\) = ([.\d]+).*BD \(J = 48\) ([.\d]+), STAR \(79\) ([.\d]+), Vocab \(500\) ([.\d]+)/,
    expect: () => [50, 100, 2000, 5000].map((J) => O("Gamma(1,1)", J, "E_K")).concat([wsb(0.5, 1, 1)], [48, 79, 500].map((J) => O("Gamma(1,1)", J, "E_K"))), source: "oracle (paper Fig. 2: 4.16 / 4.84 / 7.82 / 8.73); closed form" },
  { id: "M-03 Fig 1 tail", page: "unintended-prior", query: "", pattern: /"About (\d+) clusters" and ([.\d]+) majority dominance/, expect: () => [5, wsb(0.5, 1.6, 1.22)], source: "closed form (paper Fig. 1: .49)" },
  { id: "M-05 Fig 1 exact E K_50", page: "crp-unintended", query: "a=1.6&b=1.22&J=50&seed=1", pattern: /exact E K_J = ([.\d]+)/, expect: () => [O("Gamma(1.6,1.22) Fig 1", 50, "E_K")], source: "oracle (paper Fig. 1 note: 5.05)" },
  { id: "M-06 Gamma(1,1) collapse", page: "collapse", query: "preset=g11", pattern: /Pr\(alpha < \.1\) = ([.\d]+); prior collapse P\(K_J = 1\) = ([.\d]+) at J = 50, ([.\d]+) at J = 79, ([.\d]+) at J = 100, ([.\d]+) at J = 500/,
    expect: () => [1 - Math.exp(-0.1)].concat([50, 79, 100, 500].map((J) => O("Gamma(1,1)", J, "P_K1"))), source: "closed form; oracle" },
  { id: "C-02 J = 50 TSMM", page: "tsmm-calibrator", query: "preset=j50", pattern: /TSMM gives Gamma\(([.\d]+), ([.\d]+)\).*Pr\(W_SB > \.5\) = ([.\d]+)/, expect: () => [F("J50", "a"), F("J50", "b"), F("J50", "S50")], source: "golden tsmm_fits.csv (DPprior 2.0.0; paper Sec. 3.5: Gamma(1.4082, 1.0770), .497)" },
  { id: "C-08 Dual-Anchor choice", page: "dual-anchor-frontier", query: "", pattern: /The paper's choice at J = 50 is lambda = ([.\d]+): Gamma\(([.\d]+), ([.\d]+)\), ([.\d]+), E K ([.\d]+)/,
    expect: () => [Number(DA.lambda), Number(DA.a), Number(DA.b), Number(DA.S50), O("Dual-Anchor J50 lambda .30", 50, "E_K")], source: "golden dual_anchor.csv; oracle (paper: lambda .30, Gamma(2.3158, 1.4204), .398, 5.88)" },
  { id: "C-03 Table 2 VIF 2.5", page: "vif-sensitivity", query: "", from: "tiles", pattern: /Gamma\(([.\d]+), ([.\d]+)\).*majority dominance Pr\(W_SB > \.5\)([.\d]+).*extreme dominance Pr\(W_SB > \.9\)([.\d]+).*Pr\(alpha < \.1\)([.\d]+)/,
    expect: () => { const a = F("J100_VIF2.5", "a"); const b = F("J100_VIF2.5", "b"); return [a, b, wsb(0.5, a, b), wsb(0.9, a, b), O("Table 2 VIF 2.5", 100, "pr_alpha_lt_0.1")]; }, source: "golden tsmm_fits.csv; closed form; oracle (paper Table 2: (1.67, 1.65), .56, .23, .030)" },
  { id: "M-12 SCAL shortcut", page: "prior-implications", query: "preset=scal", pattern: /E K_J = ([.\d]+); Pr\(W_SB > \.5\) = ([.\d]+); P\(K_J = 1\) = ([.\d]+)/,
    expect: () => [O("Gamma(0.037,0.037) SCAL shortcut", 100, "E_K"), wsb(0.5, 0.037, 0.037), O("Gamma(0.037,0.037) SCAL shortcut", 100, "P_K1")], source: "oracle (never the stale .824); closed form" },
  { id: "M-04 strip", page: "method-problems-strip", query: "J=500", pattern: /shortcut ([.\d]+)\. SSI-Weight: E K_J ([.\d]+) at J = 100.*Vague: P\(K_100 = 1\) ([.\d]+), Pr\(W_SB > \.5\) ([.\d]+)/,
    expect: () => [O("Gamma(0.037,0.037) SCAL shortcut", 100, "P_K1"), O("SSI-Weight", 100, "E_K"), O("Gamma(1,1)", 100, "P_K1"), wsb(0.5, 1, 1)], source: "oracle; closed form (paper OSM Table F.4: SSI-Weight E K 10.05)" },
  { id: "A-02 STAR Vague", page: "app-prior-strip", query: "app=star&prior=Vague&view=post", pattern: /prior E K_79 = ([.\d]+) .*Pr\(W_SB > \.5\) = ([.\d]+); posterior E\(K \| data\) = ([.\d]+) \[\d+, \d+\], collapse ([.\d]+), largest observed share ([.\d]+)/,
    expect: () => { const r = A("STAR", "Vague"); return [O("Gamma(1,1)", 79, "E_K"), wsb(0.5, r.a, r.b), r.post_EK, r.post_pK1, r.observed_largest_share]; }, source: "oracle; closed form; released app_priors.json" },
  { id: "A-02 STAR Dual-Anchor", page: "app-prior-strip", query: "app=star&prior=Dual-Anchor&view=post", pattern: /prior E K_79 = ([.\d]+) .*Pr\(W_SB > \.5\) = ([.\d]+); posterior E\(K \| data\) = ([.\d]+) \[\d+, \d+\], collapse ([.\d]+), largest observed share ([.\d]+)/,
    expect: () => { const r = A("STAR", "Dual-Anchor"); return [r.prior_EK, wsb(0.5, r.a, r.b), r.post_EK, r.post_pK1, r.observed_largest_share]; }, source: "released app_priors.json; closed form" },
  { id: "A-03 Bangert-Drowns Vague", page: "bd-forest", query: "", pattern: /posterior E\(K \| data\) = ([.\d]+) \[\d+, \d+\], collapse ([.\d]+)/, expect: () => { const r = A("Bangert-Drowns", "Vague"); return [r.post_EK, r.post_pK1]; }, source: "released app_priors.json" },
  { id: "A-04 vocabulary", page: "rasch-kpmf", query: "", pattern: /Vague Gamma\(1, 1\): ([.\d]+) \[.*Dual-Anchor: ([.\d]+) \[.*hard bound[^:]*: ([.\d]+) \[/,
    expect: () => [A("Vocabulary", "Vague").post_EK, A("Vocabulary", "Dual-Anchor").post_EK, A("Vocabulary", "Dual-Anchor (hard)").post_EK], source: "released app_priors.json (the widget sums rasch_pmf.json)" },
  // the elicitation example (.4002, just above the .40 trigger) against the independent u-space solver
  { id: "C-05 [3, 10] at 80%", page: "elicitation-form", query: "preset=i80",
    pattern: /mu_K = ([.\d]+), sigma\^2 = ([.\d]+); TSMM gives Gamma\(([.\d]+), ([.\d]+)\), E\(alpha\) = ([.\d]+); Pr\(W_SB > \.5\) = ([.\d]+), above \.40/,
    expect: () => { const a = TB(K80, "a"); const b = TB(K80, "b"); return [TB(K80, "mu_K"), TB(K80, "var_K"), a, b, a / b, wsb(0.5, a, b)]; }, source: "tsmm_boundary.csv (u-space oracle, r-export/14); closed form" },
  { id: "C-05 [3, 10] at 95%", page: "elicitation-form", query: "preset=i95",
    pattern: /sigma\^2 = ([.\d]+) is below ([.\d]+), the smallest variance of K_100 .*alpha\* = ([.\d]+)\)\. The same interval works at a probability below ([.\d]+)%/,
    expect: () => [TB(K95, "var_K"), TB(K95, "min_var"), TB(K95, "alpha_star"), 100 * (2 * pnorm(7 / (2 * Math.sqrt(TB(K95, "min_var")))) - 1)], source: "tsmm_boundary.csv (profile bound by uniroot); normal proxy" },
  { id: "C-05 page prose", page: "pages/dpprior/elicitation", from: "page",
    pattern: /asks for sigma\^2 = ([.\d]+) and gives Gamma\(([.\d]+), ([.\d]+)\), with Pr\(W_SB > \.5\) = ([.\d]+), just above the \.40 trigger, and Pr\(W_SB > \.9\) = ([.\d]+)\. The same interval at 95% asks for sigma\^2 = ([.\d]+), below ([.\d]+),/,
    expect: () => { const a = TB(K80, "a"); const b = TB(K80, "b"); return [TB(K80, "var_K"), a, b, wsb(0.5, a, b), wsb(0.9, a, b), TB(K95, "var_K"), TB(K95, "min_var")]; }, source: "tsmm_boundary.csv (u-space oracle); closed form" },
  // the simulation's size, typed into C-11 and the data page, against the released cell table
  { id: "C-11 MCMC design", page: "timing-badges", from: "tiles", pattern: /MCMC is for the data, not the prior([\d,]+) fitsThe paper's simulation requested ([\d,]+) fits/,
    expect: () => [SIM.all.eligible, SIM.all.manifest], source: "released cell_summary.json (all suites)" },
  { id: "A-13 retained fits", page: "data-lineage-card", pattern: /([\d,]+) of ([\d,]+) simulation fits retained in the (\d+) main cells/,
    expect: () => [SIM.headline.eligible, SIM.headline.manifest, SIM.headline.cells], source: "released cell_summary.json (suite headline_n01)" },
  // specification against prior sensitivity (A-12)
  { id: "A-12 STAR wide scale", page: "spec-sensitivity", query: "app=star&preset=wide_scale", pattern: SENS_PATTERN, expect: () => sensCase("star", "wide_scale"), source: "released app_sensitivity.json" },
  { id: "A-12 STAR OLS/HC3", page: "spec-sensitivity", query: "app=star&preset=hc3", pattern: SENS_PATTERN, expect: () => sensCase("star", "hc3"), source: "released app_sensitivity.json" },
  { id: "A-12 Bangert-Drowns wide scale", page: "spec-sensitivity", query: "app=bd&preset=wide_scale", pattern: SENS_PATTERN, expect: () => sensCase("bd", "wide_scale"), source: "released app_sensitivity.json" },
  { id: "A-13 page prose", page: "pages/applications/data", from: "page", pattern: /([\d,]+) of ([\d,]+) planned fits in the (\d+) main cells \(([\d,]+) of ([\d,]+) across all suites\)/,
    expect: () => [SIM.headline.eligible, SIM.headline.manifest, SIM.headline.cells, SIM.all.eligible, SIM.all.manifest], source: "released cell_summary.json" },
];

// paper v3 values against the released tables (at the paper's precision)
const PAPER = [
  { what: "STAR Vague E(K | data), Pr(K = 1 | data)", paper: [1.96, 0.56], got: () => [A("STAR", "Vague").post_EK, A("STAR", "Vague").post_pK1], dp: [2, 3], source: "v3 Table 5" },
  { what: "STAR Dual-Anchor E(K | data), Pr(K = 1 | data)", paper: [4.47, 0.064], got: () => [A("STAR", "Dual-Anchor").post_EK, A("STAR", "Dual-Anchor").post_pK1], dp: [2, 3], source: "v3 Table 5" },
  { what: "Bangert-Drowns Vague and Dual-Anchor E(K | data)", paper: [1.89, 3.31], got: () => [A("Bangert-Drowns", "Vague").post_EK, A("Bangert-Drowns", "Dual-Anchor").post_EK], dp: [2, 2], source: "v3 Table 5" },
  { what: "vocabulary Vague, Dual-Anchor, hard E(K | data)", paper: [4.43, 6.73, 8.99], got: () => ["Vague", "Dual-Anchor", "Dual-Anchor (hard)"].map((p) => A("Vocabulary", p).post_EK), dp: [2, 2, 2], source: "v3 Table 5" },
  { what: "STAR TSMM and Dual-Anchor (a, b)", paper: [5.134, 4.939, 15.77, 11.112], got: () => [A("STAR", "TSMM").a, A("STAR", "TSMM").b, A("STAR", "Dual-Anchor").a, A("STAR", "Dual-Anchor").b], dp: [3, 3, 3, 3], source: "v3 Sec. 5 and Table 4" },
  { what: "simulation fits requested and admitted (all suites), planned and retained (45 main cells)", paper: [64400, 57151, 9000, 8607], got: () => [SIM.all.manifest, SIM.all.eligible, SIM.headline.manifest, SIM.headline.eligible], dp: [0, 0, 0, 0], source: "v3 Sec. 4" },
];

// --------------------------------------------------------------- the check
function polyfill(window) {
  window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
}
async function textOf(page, query, from) {
  if (from === "page") {
    const file = join(DOCS, `${page}.html`);
    if (!existsSync(file)) throw new Error(`${file} missing (render the site first)`);
    const dom = new JSDOM(readFileSync(file, "utf8"));
    const text = (dom.window.document.querySelector("main") ?? dom.window.document.body).textContent.replace(/\s+/g, " ");
    dom.window.close();
    return text;
  }
  const file = join(DOCS, "embed", `${page}.html`);
  if (!existsSync(file)) throw new Error(`${file} missing (render the site first)`);
  const dom = await JSDOM.fromFile(file, { url: `${pathToFileURL(file).href}${query ? `?${query}` : ""}`, runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: new VirtualConsole(), beforeParse: polyfill });
  await new Promise((resolve) => { if (dom.window.document.readyState === "complete") resolve(); else dom.window.addEventListener("load", resolve); setTimeout(resolve, 8000); });
  await new Promise((r) => setTimeout(r, 200));
  const w = dom.window.document.querySelector(".dpx-widget");
  const text = from === "tiles" ? [...(w?.querySelectorAll(".dpx-tile") ?? [])].map((t) => t.textContent.replace(/\s+/g, " ")).join(" || ") : w?.querySelector(".dpx-readout")?.textContent ?? "";
  dom.window.close();
  return text;
}
const decimals = (s) => (s.includes(".") ? s.split(".")[1].length : 0);
const shownValue = (s) => (s === "<.001" ? { v: 0, lt: 0.0005 } : s === ">.999" ? { v: 1, gt: 0.9995 } : { v: Number(s.startsWith(".") ? `0${s}` : s) });
function compare(shown, want) {
  const sv = shownValue(shown);
  if (sv.lt !== undefined) return want < sv.lt;
  if (sv.gt !== undefined) return want > sv.gt;
  return Math.abs(sv.v - want) <= 0.5 * 10 ** -decimals(shown) + 1e-12;
}

const results = [];
for (const c of CASES) {
  const text = await textOf(c.page, c.query, c.from);
  const m0 = text.match(c.pattern);
  // a number never ends with a period: drop the sentence's full stop that the pattern may take
  // (and a thousands separator is not a decimal: "57,151" is 57151)
  const m = m0 ? [m0[0], ...m0.slice(1).map((s) => s.replace(/\.$/, "").replace(/,(?=\d{3}(?:\D|$))/g, ""))] : null;
  const want = c.expect();
  const problems = [];
  if (!m) problems.push(`pattern not found in: ${text.slice(0, 160)}`);
  else {
    const shown = m.slice(1);
    if (shown.length !== want.length) problems.push(`${shown.length} numbers shown, ${want.length} expected`);
    shown.forEach((s, i) => { if (!compare(s, want[i])) problems.push(`#${i + 1}: shown ${s}, authority ${want[i]}`); });
  }
  results.push({ c, problems, shown: m ? m.slice(1) : [] });
  console.log(`${problems.length ? "FAIL" : "ok  "} ${c.id} (${c.page}${c.query ? `?${c.query}` : ""}): ${m ? m.slice(1).join(", ") : "–"} | ${c.source}${problems.length ? ` | ${problems.join("; ")}` : ""}`);
}
const paperBad = [];
for (const p of PAPER) {
  const got = p.got();
  const bad = got.map((g, i) => Math.abs(Number(g.toFixed(p.dp[i])) - p.paper[i]) > 1e-12 ? `${g} vs paper ${p.paper[i]}` : null).filter(Boolean);
  if (bad.length) paperBad.push(`${p.what}: ${bad.join("; ")}`);
  console.log(`${bad.length ? "FAIL" : "ok  "} paper ${p.source}: ${p.what} = ${got.map((g, i) => g.toFixed(p.dp[i])).join(", ")}`);
}
const n = results.reduce((s, r) => s + r.shown.length, 0);
let selfOk = true;
if (process.argv.includes("--self-test")) {
  // a displayed number one unit off in its last digit must fail; so must a released value off by .01
  const r0 = results[5];
  const off = r0.shown.map((s, i) => (i === 0 ? String((shownValue(s).v + 10 ** -decimals(s)).toFixed(decimals(s))) : s));
  const caught1 = !off.every((s, i) => compare(s, r0.c.expect()[i]));
  const caught2 = Math.abs(Number((A("STAR", "Vague").post_EK + 0.01).toFixed(2)) - 1.96) > 1e-12;
  selfOk = caught1 && caught2;
  console.log(`read-outs self-test: ${selfOk ? "PASS" : "FAIL"} (a shown number one unit off: ${caught1 ? "caught" : "missed"}; a released value off by .01: ${caught2 ? "caught" : "missed"})`);
}
const failed = results.filter((r) => r.problems.length).length + paperBad.length;
const widgetPages = new Set(CASES.filter((c) => c.from !== "page").map((c) => c.page)).size;
const sitePages = new Set(CASES.filter((c) => c.from === "page").map((c) => c.page)).size;
const summary = `${n} displayed numbers in ${results.length} cases on ${widgetPages} widgets and ${sitePages} site pages; ${PAPER.length} paper cross-checks of the released tables`;
// verification/readouts_report.md: the table behind the summary (check_docs.mjs reads its counts)
const report = [
  "# Read-out report",
  "",
  `Written by \`verification/check_readouts.mjs\` on ${new Date().toISOString()} from the rendered embeds in \`docs/embed/\`.`,
  "",
  `**Result: ${failed ? "FAIL" : "PASS"}**; ${summary}.`,
  "",
  "| case | embed page | shown | authority | result |",
  "|---|---|---|---|---|",
  ...results.map((r) => `| ${r.c.id} | ${r.c.page}${r.c.query ? `?${r.c.query}` : ""} | ${r.shown.join(", ") || "-"} | ${r.c.source} | ${r.problems.length ? `FAIL: ${r.problems.join("; ")}` : "pass"} |`),
  ...PAPER.map((p) => `| paper | ${p.source} | ${p.got().map((g, i) => g.toFixed(p.dp[i])).join(", ")} | ${p.what} | ${paperBad.some((b) => b.startsWith(p.what)) ? "FAIL" : "pass"} |`),
  "",
];
writeFileSync(join(ROOT, "verification", "readouts_report.md"), report.join("\n"));
console.log(failed || !selfOk ? `read-outs: FAIL (${failed})` : `read-outs: PASS (${summary})`);
process.exit(failed || !selfOk ? 1 : 0);

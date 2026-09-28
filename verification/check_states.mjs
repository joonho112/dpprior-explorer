#!/usr/bin/env node
/**
 * Calibration status check (since 1.1.0): opens the rendered embed pages of the TSMM
 * calibrator (C-02), the feasibility map (C-06) and the elicitation form (C-05) in jsdom with a
 * query string, and checks what the reader is told for every status:
 *   - the widget's data-status equals the expected status;
 *   - a success status (ok, point-mass) meets the target: data-residual <= 1e-6 and the achieved
 *     mean and variance are within 1e-6 of the target (C-02), so an approximation is never shown
 *     as calibrated;
 *   - the read-out contains the expected phrase and none of the forbidden ones (e.g. the old
 *     "(J - 1)^2 / 4" support rule; "no Gamma hyperprior may reach it").
 * The cases include the three boundary targets that motivated 1.1.0.
 *
 * Usage: node verification/check_states.mjs [--self-test]
 *   --self-test  also runs the checks against deliberately wrong expectations, which must fail
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const require = createRequire(join(ROOT, "engine", "package.json"));
const { JSDOM, VirtualConsole } = require("jsdom");

const TOL = 1e-6;
const CASES = [
  // C-02: the calibrator
  { page: "tsmm-calibrator", query: "J=50&mu=5&var=10", status: "ok", target: [5, 10], has: ["Gamma(1.4082, 1.0770)"] },
  { page: "tsmm-calibrator", query: "J=50&mu=5&var=3.2219", status: "point-mass", target: [5, 3.2219], has: ["nearly a point mass", "it meets the target"], not: ["approximate"], note: "just above the profile bound" },
  { page: "tsmm-calibrator", query: "J=50&mu=2&var=100", status: "support", has: ["(mu_K - 1)(J - mu_K) = 48.0"], not: ["(J - 1)^2 / 4", "Newton did not converge"], note: "above the support ceiling" },
  { page: "tsmm-calibrator", query: "J=50&mu=5&var=3.5", status: "ok", target: [5, 3.5], has: ["Gamma(36.44"], not: ["no Gamma hyperprior may reach it"], note: "below mu_K - 1, still feasible" },
  { page: "tsmm-calibrator", query: "J=100&mu=6.5&var=3.19", status: "infeasible", has: ["no solution", "4.522"] },
  { page: "tsmm-calibrator", query: "J=50&mu=5&var=179", status: "no-convergence", has: ["of the ceiling", "two-point law"] },
  // C-06: the feasibility map
  { page: "feasibility-map", query: "J=50&mu=5&var=3.2219", status: "point-mass", has: ["nearly a point mass"] },
  { page: "feasibility-map", query: "J=50&mu=2&var=100", status: "support", has: ["48.0"] },
  { page: "feasibility-map", query: "J=100&mu=6.5&var=7.46", status: "ok", has: ["Gamma(6.815, 4.820)"] },
  { page: "feasibility-map", query: "J=100&mu=6.5&var=3.19", status: "infeasible", has: ["below the red curve"] },
  // C-05: the elicitation form
  { page: "elicitation-form", query: "preset=star", status: "ok", has: ["Gamma(5.134, 4.939)", "the dominance trigger fires"] },
  { page: "elicitation-form", query: "preset=i95", status: "infeasible", has: ["the smallest variance of K_100"] },
];

function polyfill(window) {
  window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
}

async function open(page, query) {
  const file = join(DOCS, "embed", `${page}.html`);
  if (!existsSync(file)) throw new Error(`${file} is missing (render the site first)`);
  const vc = new VirtualConsole();
  const errors = [];
  vc.on("jsdomError", (e) => { if (!/Not implemented/.test(String(e.message || e))) errors.push(String(e.message || e).split("\n")[0]); });
  const dom = await JSDOM.fromFile(file, { url: `${pathToFileURL(file).href}?${query}`, runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc, beforeParse: polyfill });
  await new Promise((resolve) => {
    if (dom.window.document.readyState === "complete") resolve();
    else dom.window.addEventListener("load", resolve);
    setTimeout(resolve, 8000);
  });
  await new Promise((r) => setTimeout(r, 100));
  const w = dom.window.document.querySelector(".dpx-widget");
  const out = { errors, status: w?.dataset.status, residual: Number(w?.dataset.residual), mean: Number(w?.dataset.achievedMean), variance: Number(w?.dataset.achievedVar), readout: w?.querySelector(".dpx-readout")?.textContent ?? "" };
  dom.window.close();
  return out;
}

function judge(c, r) {
  const problems = [];
  if (r.errors.length) problems.push(`script errors: ${r.errors.join(" | ")}`);
  if (r.status !== c.status) problems.push(`status ${r.status}, expected ${c.status}`);
  if ((r.status === "ok" || r.status === "point-mass") && c.page === "tsmm-calibrator") {
    if (!(r.residual <= TOL)) problems.push(`success with residual ${r.residual}`);
    if (c.target && !(Math.abs(r.mean - c.target[0]) <= TOL && Math.abs(r.variance - c.target[1]) <= TOL)) problems.push(`achieved (${r.mean}, ${r.variance}) is not the target (${c.target})`);
  }
  for (const s of c.has ?? []) if (!r.readout.includes(s)) problems.push(`read-out lacks "${s}"`);
  for (const s of c.not ?? []) if (r.readout.includes(s)) problems.push(`read-out contains "${s}"`);
  return problems;
}

const results = [];
for (const c of CASES) {
  const r = await open(c.page, c.query);
  const problems = judge(c, r);
  results.push({ c, r, problems });
  console.log(`${problems.length ? "FAIL" : "ok  "} ${c.page}?${c.query}: ${r.status}${c.note ? ` (${c.note})` : ""}${problems.length ? ` | ${problems.join("; ")}` : ""}`);
}
const failed = results.filter((x) => x.problems.length);

if (process.argv.includes("--self-test")) {
  // wrong expectations on real pages must be caught: a wrong status, a missing phrase, a success
  // that does not meet the target
  const planted = [
    { ...results[1].c, status: "ok" },
    { ...results[2].c, has: ["(J - 1)^2 / 4"] },
    { ...results[0].c, target: [5, 10.5] },
  ];
  const caught = planted.filter((c, i) => judge(c, results[[1, 2, 0][i]].r).length > 0).length;
  console.log(`states self-test: ${caught === planted.length ? "PASS" : "FAIL"} (${caught} of ${planted.length} planted mistakes caught)`);
  if (caught !== planted.length) process.exit(1);
}
console.log(failed.length ? `states: FAIL (${failed.length}/${results.length})` : `states: PASS (${results.length} cases on C-02, C-05, C-06)`);
process.exit(failed.length ? 1 : 0);

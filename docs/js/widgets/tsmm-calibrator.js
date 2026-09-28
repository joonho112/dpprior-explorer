// C-02 "Live TSMM calibrator". Owner of this file: Step 8.4 (statuses revised in 1.1.0).
//
// Choose J, the target mean mu_K and either the variance sigma^2 or a variance inflation factor
// (sigma^2 = VIF (mu_K - 1)); dp-core tsmmFit solves Gamma(a, b) at once: Stage 1 A1 start, Stage 2
// Newton, and near the profile bound a profile solve. Badges report (a, b), E(alpha) = a / b,
// CV(alpha) = 1 / sqrt(a), the achieved mean and variance of K_J with the residual, or why there is
// no fit: outside the support (1 < mu_K < J, 0 < sigma^2 < (mu_K - 1)(J - mu_K)), infeasible
// (sigma^2 at or below the profile minimum v_J(alpha*)), no convergence, or an approximation that
// misses the target (shown with target and achieved values, never as calibrated).
import * as dp from "../dp-core.js";
import { decadeLabel, decadeTicks, draw, logTickLabels, palette } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtGamma, fmtPct, fmtProb } from "./format.js";

/** Non-probabilities keep the leading zero ("0.846"); fmt() would print ".846". */
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "–");
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "–");

const J_MIN = 10;
const J_MAX = 500;
const VIFS = [1.25, 1.5, 2.5, 5];
const CELL_MIN = 336;
const PRESETS = {
  j50: { label: "J = 50: about 5, VIF 2.5", J: 50, mu: 5, v: 10 },
  star: { label: "STAR: J = 79, [2, 8] at 80%", J: 79, mu: 5, v: dp.intervalToMoments(2, 8, 0.8).varK },
  table2: { label: "Table 2: J = 100, VIF 2.5", J: 100, mu: 5, v: 10 },
  imposs: { label: "[3, 10] at 95%, J = 100", J: 100, mu: 6.5, v: dp.intervalToMoments(3, 10, 0.95).varK },
};

export function mountWidget(el, spec = {}) {
  const p0 = PRESETS[spec.preset] ?? PRESETS.j50;
  const state = {
    J: Math.round(num(spec, "J", p0.J, J_MIN, J_MAX)),
    mu: num(spec, "mu", p0.mu, 1.05, J_MAX - 1),
    v: num(spec, "var", p0.v, 0.05, 5000),
    mode: "var",
    vif: 2.5,
  };
  let fit = null;
  const ui = frame(el, { label: "Live TSMM calibrator: from a count target to Gamma(a, b)", className: "dpx-calibrator" });
  const badges = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pA = h("div", { class: "dpx-panel" });
  const pK = h("div", { class: "dpx-panel" });
  ui.charts.append(badges, pA, pK);
  ui.caption.textContent =
    "Two-stage moment matching (TSMM), solved in the browser by dp-core: Stage 1 starts from the A1 closed form, Stage 2 runs Newton on (log a, log b) until the prior's exact mean and variance of K_J, the number of fitted components among the J units, equal the target.";
  let width = 720;

  const solve = () => {
    const t0 = performance.now();
    fit = dp.tsmmFit(state.J, state.mu, state.v);
    fit.ms = performance.now() - t0;
  };

  const tile = (title, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: title }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const ok = fit.status === "ok" || fit.status === "point-mass";
    const pm = fit.status === "point-mass";
    const approx = fit.status === "approximate";
    const drawn = ok || approx; // a Gamma(a, b) to show; only ok and point-mass meet the target
    const nearCeiling = state.v > 0.9 * fit.supportUpper;
    const statusText = {
      ok: "calibrated: the target is met",
      "point-mass": "calibrated: nearly a point mass (CV(alpha) < .01)",
      approximate: `approximate only: |F| = ${fit.residual.toExponential(1)} misses the target`,
      infeasible: `no solution: sigma^2 must exceed ${fmt(fit.minVar, 3)}, the variance at the point mass alpha* = ${fmt(fit.alphaStar, 3)}`,
      support: `outside the support: need 1 < mu_K < J and sigma^2 below (mu_K - 1)(J - mu_K) = ${fmt(fit.supportUpper, 1)}`,
      "no-convergence": nearCeiling
        ? `no convergence: sigma^2 is within ${fmtPct(1 - state.v / fit.supportUpper, 0)} of the ceiling (mu_K - 1)(J - mu_K) = ${fmt(fit.supportUpper, 1)}, which only a two-point law on {1, J} reaches; the Gamma prior this close is too extreme to compute`
        : "Newton did not converge from the A1 start",
    }[fit.status];
    const pillClass = ok ? "dpx-pill-ok" : approx ? "dpx-pill-note" : "dpx-pill-bad";
    // near the profile bound three decimals hide the gap, so variances get five and the gap its exponent
    const nearBound = Number.isFinite(fit.minVar) && state.v - fit.minVar < 0.01;
    const fv = (x) => (Number.isFinite(x) ? x.toFixed(nearBound ? 5 : 3) : "–");
    badges.replaceChildren(
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "status" }), h("p", {}, h("span", { class: `dpx-pill ${pillClass}`, text: statusText }))),
      tile("Gamma(a, b)", drawn ? (fit.a >= dp.POINT_MASS_A ? fmtGamma(fit.a, fit.b) : fmtGamma(fit.a, fit.b, 4)) : "–", drawn ? (pm ? `the exact solution, concentrated at alpha* = ${f3(fit.alphaStar)}: the target is ${(state.v - fit.minVar).toExponential(1)} above the smallest variance ${fv(fit.minVar)}` : fit.method === "profile" ? `found on the profile curve near the bound ${fv(fit.minVar)}` : `A1 start ${fmtGamma(fit.start.a0, fit.start.b0, 3)}${fit.start.projected ? " (projected)" : ""}`) : null),
      tile("E(alpha) = a / b and CV(alpha) = 1 / sqrt(a)", drawn ? `${f3(fit.a / fit.b)} and ${f3(1 / Math.sqrt(fit.a))}` : "–"),
      tile("K_J achieved: mean, variance, residual |F|", drawn ? `${f3(fit.achieved.M1)}, ${fv(fit.achieved.V)}` : "–",
        drawn ? `target ${f3(state.mu)}, ${fv(state.v)}; |F| = ${fit.residual.toExponential(1)}${ok ? " (tolerance 1e-6)" : ", above the 1e-6 tolerance"}; ${fit.iter} ${fit.method === "profile" ? "profile" : "Newton"} steps, ${fmt(fit.ms, 1)} ms` : null),
    );
    const cols = Math.min(2, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    const w = Math.floor((width - 16 * (cols - 1)) / cols);
    if (drawn) {
      const LN10 = Math.log(10);
      const lo = Math.log10(Math.max(1e-6, dp.qgamma(1e-4, fit.a, fit.b)));
      const hi = Math.log10(dp.qgamma(1 - 1e-4, fit.a, fit.b));
      const dens = Array.from({ length: 121 }, (_, i) => { const x = lo + ((hi - lo) * i) / 120; return { x: 10 ** x, g: Math.exp(dp.dgammaLog(10 ** x, fit.a, fit.b) + x * LN10) * LN10 }; });
      const ticks = decadeTicks(10 ** lo, 10 ** hi).filter((t) => t >= 10 ** lo && t <= 10 ** hi);
      // a concentrated prior spans less than a decade: plain alpha ticks instead of decade labels
      const narrowAxis = ticks.length < 2;
      draw(pA, {
        width: w, height: 200, marginLeft: 44, marginBottom: 42,
        x: narrowAxis ? { type: "log", label: "alpha", labelOffset: 36, ticks: 4, tickFormat: (v) => fmt(v, 3) } : { type: "log", label: "alpha (log scale)", labelOffset: 36, ticks, tickFormat: () => "" },
        y: { label: "density per decade", grid: true },
        marks: [
          P.areaY(dens, { x: "x", y: "g", fill: c.methods.tsmm, fillOpacity: 0.25 }),
          P.line(dens, { x: "x", y: "g", stroke: c.methods.tsmm, strokeWidth: 2 }),
          P.ruleX([fit.a / fit.b], { stroke: c.fg, strokeDasharray: "4,3" }),
          narrowAxis ? null : logTickLabels(ticks, c.muted, decadeLabel),
        ],
      }, `Prior on alpha: ${fit.a >= dp.POINT_MASS_A ? fmtGamma(fit.a, fit.b) : fmtGamma(fit.a, fit.b, 4)}, mean ${f3(fit.a / fit.b)} (dashed), CV ${f3(1 / Math.sqrt(fit.a))}.`);
      pA.prepend(h("p", { class: "dpx-panel-title", text: ok ? "The calibrated prior on alpha" : "The closest prior found (not calibrated)" }));
      const pmf = dp.mixPmf(state.J, fit.a, fit.b);
      const s = dp.pmfSummary(pmf);
      const kmax = Math.min(state.J, Math.max(12, s.q95 + 3));
      const bars = Array.from({ length: kmax }, (_, i) => ({ k: i + 1, p: pmf[i + 1] }));
      draw(pK, {
        width: w, height: 200, marginLeft: 44, marginBottom: 42,
        x: { domain: [0.5, kmax + 0.5], label: `k (clusters among J = ${state.J})`, labelOffset: 36 },
        y: { label: "probability", grid: true },
        marks: [
          P.rectY(bars, { x1: (d) => d.k - 0.4, x2: (d) => d.k + 0.4, y: "p", fill: c.methods.tsmm, fillOpacity: 0.85 }),
          P.ruleX([state.mu], { stroke: c.fg, strokeWidth: 2, strokeDasharray: "4,3" }),
          P.ruleY([0], { stroke: c.borderStrong }),
        ],
      }, `Implied K_${state.J}: mean ${f3(fit.achieved.M1)} and variance ${f3(fit.achieved.V)}${ok ? " as asked" : `, against the target ${f3(state.mu)} and ${f3(state.v)}`} (target mean dashed); 90% interval [${s.q05}, ${s.q95}], P(K = 1) = ${fmtProb(pmf[1])}.`);
      pK.prepend(h("p", { class: "dpx-panel-title", text: ok ? `The implied K_${state.J}: mean and variance as asked` : `The implied K_${state.J}: achieved mean and variance miss the target` }));
    } else {
      pA.replaceChildren(h("p", { class: "dpx-panel-title", text: "No prior to draw" }), h("p", { class: "dpx-tile-note", text: statusText }));
      // still show where the target sits against the profile bound
      const J = state.J;
      const muMax = Math.min(J - 1, Math.max(3 * state.mu, 10));
      const curve = Array.from({ length: 41 }, (_, i) => { const mu = 1.2 + ((muMax - 1.2) * i) / 40; return { mu, v: dp.profileBound(J, mu).minVar, top: dp.supportUpperVariance(J, mu) }; });
      const high = fit.status === "support" || fit.status === "no-convergence";
      const yTop = high ? Math.max(state.v, ...curve.map((d) => d.top)) * 1.1 : Math.max(state.v, ...curve.map((d) => d.v)) * 1.1;
      draw(pK, {
        width: w, height: 200, marginLeft: 44, marginBottom: 42,
        x: { label: "mu_K", labelOffset: 36 },
        y: { label: "sigma^2", grid: true, domain: [0, yTop] },
        marks: [
          P.areaY(curve, { x: "mu", y: "v", fill: c.red, fillOpacity: 0.12 }),
          P.line(curve, { x: "mu", y: "v", stroke: c.red, strokeWidth: 2 }),
          high ? P.line(curve, { x: "mu", y: "top", stroke: c.slate, strokeWidth: 2, strokeDasharray: "5,3" }) : null,
          P.dot([{ mu: state.mu, v: state.v }], { x: "mu", y: "v", r: 6, fill: c.red, stroke: c.fg }),
        ],
      }, high
        ? `At J = ${J} a count variance must stay below the dashed ceiling (mu_K - 1)(J - mu_K) and above the red curve; the target (${f2(state.mu)}, ${f2(state.v)}) is marked.`
        : `At J = ${J} no Gamma prior has a count variance below the red curve; the target (${f2(state.mu)}, ${f2(state.v)}) is marked.`);
      pK.prepend(h("p", { class: "dpx-panel-title", text: high ? "Where the target sits: below the dashed ceiling and above the red curve a Gamma prior exists" : "Where the target sits: below the red curve no Gamma prior exists" }));
    }
    ui.readout.textContent = ok
      ? (pm
        ? `J = ${state.J}, mu_K = ${f2(state.mu)}, sigma^2 = ${fv(state.v)}: the target sits just above the smallest variance a Gamma prior can give (${fv(fit.minVar)}), so the exact solution ${fmtGamma(fit.a, fit.b)} is nearly a point mass at alpha* = ${f3(fit.alphaStar)} (CV(alpha) = ${f3(1 / Math.sqrt(fit.a))}); it meets the target (|F| = ${fit.residual.toExponential(1)}); Pr(W_SB > .5) = ${fmtProb(dp.wsbTail(0.5, fit.a, fit.b))}.`
        : `J = ${state.J}, mu_K = ${f2(state.mu)}, sigma^2 = ${f3(state.v)}: TSMM gives ${fmtGamma(fit.a, fit.b, 4)} in ${fit.iter} ${fit.method === "profile" ? "profile" : "Newton"} steps${fit.method === "profile" ? "" : ` from the A1 start ${fmtGamma(fit.start.a0, fit.start.b0, 3)}`}; E(alpha) = ${f3(fit.a / fit.b)}, CV(alpha) = ${f3(1 / Math.sqrt(fit.a))}, Pr(W_SB > .5) = ${fmtProb(dp.wsbTail(0.5, fit.a, fit.b))}.`)
      : approx
        ? `J = ${state.J}, target mu_K = ${f2(state.mu)}, sigma^2 = ${f3(state.v)}: ${statusText}. The closest prior found, ${fmtGamma(fit.a, fit.b)}, gives mean ${f3(fit.achieved.M1)} and variance ${f3(fit.achieved.V)}; it is not a calibrated prior.`
        : `J = ${state.J}, mu_K = ${f2(state.mu)}, sigma^2 = ${f3(state.v)}: ${statusText}.`;
    ui.root.dataset.renderMs = (performance.now() - t0 + fit.ms).toFixed(1);
    ui.root.dataset.status = fit.status;
    ui.root.dataset.a = String(fit.a);
    ui.root.dataset.b = String(fit.b);
    ui.root.dataset.residual = String(fit.residual);
    ui.root.dataset.achievedMean = String(fit.achieved.M1);
    ui.root.dataset.achievedVar = String(fit.achieved.V);
  };

  const run = () => { solve(); render(); };
  const syncVar = () => { if (state.mode === "vif") { state.v = state.vif * (state.mu - 1); sV.set(state.v); } };
  const sJ = slider({ label: "J (units)", min: J_MIN, max: J_MAX, value: state.J, log: true, format: (v) => String(Math.round(v)), onInput: (v) => { state.J = Math.round(v); run(); } });
  const sMu = slider({ label: "mu_K (target mean)", min: 1.05, max: 30, step: 0.05, value: state.mu, format: (v) => fmt(v, 2), onInput: (v) => { state.mu = v; syncVar(); run(); } });
  const sV = slider({ label: "sigma^2 (target variance)", min: 0.05, max: 150, value: state.v, log: true, format: f3, onInput: (v) => { state.v = v; state.mode = "var"; sMode.set("var"); run(); } });
  const sMode = segmented({ label: "variance from", options: [{ value: "var", label: "sigma^2" }, { value: "vif", label: "VIF" }], value: state.mode, onChange: (m) => { state.mode = m; syncVar(); run(); } });
  const sVif = segmented({ label: "VIF (sigma^2 = VIF (mu_K - 1))", options: VIFS.map((v) => ({ value: v, label: String(v) })), value: state.vif, onChange: (v) => { state.vif = v; state.mode = "vif"; sMode.set("vif"); syncVar(); run(); } });
  const sPre = segmented({ label: "Examples", options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })), value: spec.preset && PRESETS[spec.preset] ? spec.preset : null,
    onChange: (k) => { const p = PRESETS[k]; state.J = p.J; state.mu = p.mu; state.v = p.v; state.mode = "var"; sJ.set(p.J); sMu.set(p.mu); sV.set(p.v); sMode.set("var"); run(); } });
  const bRun = button({ label: "Calibrate", primary: true, onClick: run });
  ui.controls.append(sPre.root, sJ.root, sMu.root, sMode.root, sV.root, sVif.root, h("div", { class: "dpx-control dpx-buttons" }, bRun));
  const unbind = bindPrimaryKey(ui.root, run);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  run();
  ready = true;
  return {
    update(next = {}) {
      const p = PRESETS[next.preset];
      if (p) { state.J = p.J; state.mu = p.mu; state.v = p.v; sPre.set(next.preset); }
      if (next.J !== undefined) state.J = Math.round(num(next, "J", state.J, J_MIN, J_MAX));
      if (next.mu !== undefined) state.mu = num(next, "mu", state.mu, 1.05, J_MAX - 1);
      if (next.var !== undefined) state.v = num(next, "var", state.v, 0.05, 5000);
      sJ.set(state.J); sMu.set(state.mu); sV.set(state.v);
      run();
    },
    get fit() { return { ...fit }; },
    destroy() { stop(); unbind(); el.replaceChildren(); },
  };
}

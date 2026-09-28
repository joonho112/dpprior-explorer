// C-04 "One alpha, two lenses" (count view <-> weight view). Owner of this file: Step 5.3;
// Step 8.5 reuses it through spec only.
//
// The same concentration alpha (fixed, or a Gamma(a, b) prior on it) fixes both
//   the count view   K_J: how many clusters the J units occupy (depends on J), and
//   the weight view  W_SB: the share of a random unit's cluster (does not depend on J),
// plus the co-clustering probability E(rho) = E[1/(1 + alpha)]. Moving J changes only the left.
import * as dp from "../dp-core.js";
import { draw, logTickLabels, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, segmented, slider } from "./base.js";
import { fmt, fmtAlpha, fmtCount, fmtGamma, fmtProb } from "./format.js";

const PRESETS = [
  { key: "g11", label: "Gamma(1, 1)", a: 1, b: 1 },
  { key: "g24", label: "Gamma(2, 4)", a: 2, b: 4 },
  { key: "g13", label: "Gamma(1, 3)", a: 1, b: 3 },
];
const EXTREME_T = 0.9; // extreme dominance threshold (paper Table 2)

export function mountWidget(el, spec = {}) {
  const state = {
    mode: spec.alpha !== undefined && spec.a === undefined ? "fixed" : "gamma",
    alpha: num(spec, "alpha", 1, 0.01, 100),
    a: num(spec, "a", 1, 0.05, 50),
    b: num(spec, "b", 1, 0.05, 50),
    J: Math.round(num(spec, "J", 100, 10, 500)),
  };
  const ui = frame(el, { label: "One alpha, two lenses: the count view K_J and the weight view W_SB move together", className: "dpx-lenses" });
  const pK = h("div", { class: "dpx-panel" });
  const pA = h("div", { class: "dpx-panel" });
  const pW = h("div", { class: "dpx-panel" });
  const row = h("div", { class: "dpx-triple", style: "grid-column: 1 / -1" }, pK, pA, pW);
  ui.charts.append(row);
  ui.caption.textContent =
    "K_J is the number of fitted components (occupied clusters) among the J units. W_SB is the population share of the cluster a randomly chosen unit belongs to; rho is the probability that two random units share a cluster. Prior statements.";
  let width = 720;

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const third = width >= 680 ? Math.floor((width - 32) / 3) : width;
    const gamma = state.mode === "gamma";
    const { a, b, alpha, J } = state;
    const grid = gamma ? dp.alphaGrid(a, b) : null;
    const pmf = gamma ? dp.mixPmf(J, a, b, grid) : dp.condPmf(J, alpha);
    const s = dp.pmfSummary(pmf);
    const mom = gamma ? dp.mixMoments(J, a, b, grid) : { mean: dp.condMean(J, alpha), var: dp.condVar(J, alpha) };
    const S5 = gamma ? dp.wsbTail(dp.MAJORITY_T, a, b) : dp.wsbTailGivenAlpha(dp.MAJORITY_T, alpha);
    const S9 = gamma ? dp.wsbTail(EXTREME_T, a, b) : dp.wsbTailGivenAlpha(EXTREME_T, alpha);
    const rho = gamma ? dp.meanRho(a, b) : dp.meanRhoGivenAlpha(alpha);
    const name = gamma ? fmtGamma(a, b) : `alpha = ${fmtAlpha(alpha)}`;
    // left: count view
    const kmax = Math.min(J, Math.max(14, s.q95 + 4));
    const bars = [];
    for (let k = 1; k <= kmax; k += 1) bars.push({ k, p: pmf[k], inside: k >= s.q05 && k <= s.q95 });
    draw(pK, {
      width: third, height: 230, marginLeft: 42,
      x: { type: "band", label: `k (clusters among J = ${J})`, tickFormat: (d) => (d === 1 || d % 5 === 0 ? d : "") },
      y: { label: "P(K_J = k)", grid: true },
      marks: [P.barY(bars, { x: "k", y: "p", fill: c.teal, fillOpacity: (d) => (d.inside ? 0.9 : 0.35) }), P.ruleY([0], { stroke: c.borderStrong })],
    }, `Count view under ${name}: prior pmf of K_${J}, mean ${fmtCount(mom.mean)}, variance ${fmtCount(mom.var)}, 90% interval [${s.q05}, ${s.q95}].`);
    pK.prepend(h("p", { class: "dpx-panel-title", text: `Count view: K_${J}, mean ${fmtCount(mom.mean)}, 90% [${s.q05}, ${s.q95}]` }));
    pK.append(srTable(`P(K_${J} = k)`, ["k", "probability"], bars.map((d) => [d.k, fmtProb(d.p)])));
    // middle: alpha
    if (gamma) {
      const hi = Math.max(3, dp.qgamma(0.995, a, b));
      const dens = [];
      for (let i = 1; i <= 200; i += 1) { const x = (hi * i) / 200; dens.push({ x, d: Math.exp(dp.dgammaLog(x, a, b)) }); }
      draw(pA, {
        width: third, height: 230, marginLeft: 42,
        x: { domain: [0, hi], label: "alpha" },
        y: { label: "prior density", grid: true },
        marks: [P.areaY(dens, { x: "x", y: "d", fill: c.slate, fillOpacity: 0.25 }), P.lineY(dens, { x: "x", y: "d", stroke: c.fg, strokeWidth: 1.6 }), P.ruleX([a / b], { stroke: c.red, strokeDasharray: "4,3" })],
      }, `Prior on alpha: ${name}, mean ${fmt(a / b, 2)}.`);
    } else {
      const ticks = [0.01, 0.1, 1, 10, 100];
      draw(pA, {
        width: third, height: 230, marginLeft: 42, marginBottom: 42,
        x: { type: "log", domain: [0.01, 100], label: "alpha (log scale)", labelOffset: 38, ticks, tickFormat: () => "" },
        y: { domain: [0, 1], axis: null },
        marks: [P.ruleX([alpha], { stroke: c.red, strokeWidth: 3 }), logTickLabels(ticks, c.muted),
          P.text([{ x: alpha }], { x: "x", y: 0.85, text: () => `alpha = ${fmtAlpha(alpha)}`, dx: alpha > 10 ? -6 : 6, textAnchor: alpha > 10 ? "end" : "start", fill: c.fg, fontWeight: 700 })],
      }, `A fixed alpha = ${fmtAlpha(alpha)}.`);
    }
    pA.prepend(h("p", { class: "dpx-panel-title", text: "← the same alpha drives both views →" }));
    // right: weight view
    const wd = [];
    for (let i = 0; i <= 240; i += 1) {
      const w = Math.min(dp.W_DENSITY_MAX, i / 240);
      const d = gamma ? dp.wsbDensity(w, a, b) : alpha * Math.exp((alpha - 1) * Math.log1p(-w));
      wd.push({ w, d });
    }
    const top = Math.min(4, Math.max(2, ...wd.filter((x) => x.w <= 0.95).map((x) => x.d)) * 1.15);
    const clip = wd.map((x) => ({ ...x, d: Math.min(x.d, top) }));
    draw(pW, {
      width: third, height: 230, marginLeft: 42,
      x: { domain: [0, 1], label: "W_SB", ticks: [0, dp.MAJORITY_T, EXTREME_T], tickFormat: (d) => (d === 0 ? "0" : fmt(d, 1)) },
      y: { domain: [0, top], label: "density", grid: true },
      marks: [
        P.areaY(clip.filter((x) => x.w >= dp.MAJORITY_T), { x: "w", y: "d", fill: c.red, fillOpacity: 0.22 }),
        P.areaY(clip.filter((x) => x.w >= EXTREME_T), { x: "w", y: "d", fill: c.red, fillOpacity: 0.45 }),
        P.lineY(clip, { x: "w", y: "d", stroke: c.fg, strokeWidth: 1.6 }),
        P.ruleX([dp.MAJORITY_T, EXTREME_T], { stroke: c.red, strokeDasharray: "3,3" }),
      ],
    }, `Weight view under ${name}: Pr(W_SB > .5) = ${fmtProb(S5)}, Pr(W_SB > .9) = ${fmtProb(S9)}, E(rho) = ${fmtProb(rho)}; none of these depends on J.`);
    pW.prepend(h("p", { class: "dpx-panel-title", text: `Weight view: Pr(W_SB > .5) = ${fmtProb(S5)}, > .9 = ${fmtProb(S9)}` }));
    pW.append(h("div", { class: "dpx-gauge", role: "img", "aria-label": `E(rho) = ${fmtProb(rho)}` },
      h("span", { class: "dpx-gauge-label", text: `E(rho) = ${fmtProb(rho)}: two random units share a cluster` }),
      h("span", { class: "dpx-gauge-bar" }, h("span", { class: "dpx-gauge-fill", style: `width:${(100 * rho).toFixed(1)}%` }))));
    ui.readout.textContent = `${name}, J = ${J}: E K_J = ${fmtCount(mom.mean)}, Var ${fmt(mom.var, 1)}, 90% [${s.q05}, ${s.q95}]; Pr(W_SB > .5) = ${fmtProb(S5)}, Pr(W_SB > .9) = ${fmtProb(S9)}, E(rho) = ${fmtProb(rho)}. Change J: only the count view moves.`;
    presetSeg.set(gamma ? PRESETS.find((p) => p.a === a && p.b === b)?.key ?? null : null);
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };

  const modeSeg = segmented({ label: "alpha is", options: [{ value: "gamma", label: "Gamma(a, b)" }, { value: "fixed", label: "fixed" }], value: state.mode, onChange: (v) => { state.mode = v; render(); } });
  const presetSeg = segmented({ label: "Presets", options: PRESETS.map((p) => ({ value: p.key, label: p.label })), value: PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null,
    onChange: (v) => { const p = PRESETS.find((x) => x.key === v); state.a = p.a; state.b = p.b; state.mode = "gamma"; modeSeg.set("gamma"); sa.set(p.a); sb.set(p.b); render(); } });
  const sa = slider({ label: "a (shape)", min: 0.05, max: 50, value: state.a, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.a = v; state.mode = "gamma"; modeSeg.set("gamma"); presetSeg.set(null); render(); } });
  const sb = slider({ label: "b (rate)", min: 0.05, max: 50, value: state.b, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.b = v; state.mode = "gamma"; modeSeg.set("gamma"); presetSeg.set(null); render(); } });
  const sAl = slider({ label: "fixed alpha", min: 0.01, max: 100, value: state.alpha, log: true, format: fmtAlpha, onInput: (v) => { state.alpha = v; state.mode = "fixed"; modeSeg.set("fixed"); render(); } });
  const sJ = slider({ label: "J (units)", min: 10, max: 500, step: 1, value: state.J, format: (v) => String(Math.round(v)), onInput: (v) => { state.J = Math.round(v); render(); } });
  ui.controls.append(modeSeg.root, presetSeg.root, sa.root, sb.root, sAl.root, sJ.root);
  const stop = observeWidth(ui.charts, (w) => { width = w; render(); });
  render();
  return {
    update(next = {}) {
      if (next.a !== undefined) { state.a = num(next, "a", state.a, 0.05, 50); sa.set(state.a); state.mode = "gamma"; }
      if (next.b !== undefined) { state.b = num(next, "b", state.b, 0.05, 50); sb.set(state.b); state.mode = "gamma"; }
      if (next.alpha !== undefined && next.a === undefined) { state.alpha = num(next, "alpha", state.alpha, 0.01, 100); sAl.set(state.alpha); state.mode = "fixed"; }
      if (next.J !== undefined) { state.J = Math.round(num(next, "J", state.J, 10, 500)); sJ.set(state.J); }
      modeSeg.set(state.mode);
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}

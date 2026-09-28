// M-14 "Jeffreys vs DORO: two 'objective' priors that disagree". Owner of this file: Step 7.9.
//
// Two answers to "what is the uninformative choice?": DORO (Dorazio, 2009) wants K_n flat on
// {1, ..., n}; the Jeffreys prior for alpha (Rodriguez, 2013, as described by Vicentini and
// Jermyn, 2025) implies a K_n symmetric about n / 2: equal spikes at 1 and n (all units in one
// cluster, every unit alone) over a nearly flat floor. DORO's best Gamma is a spike at 1 and a
// hump near 0.9 n. Neither is flat, and they disagree about the ends. Jeffreys is
// not a Gamma, so its density and implied pmf come from r-export/06_jeffreys_sg_grid.R
// (jeffreys_sg.json, integrate over the whole log-alpha line); the DORO fit is solved live by
// dp-core doroKL.
import * as dp from "../dp-core.js";
import grid from "../../data/precomputed/jeffreys_sg.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented } from "./base.js";
import { fmt, fmtCount, fmtGamma, fmtProb } from "./format.js";

const N_SET = grid.jeffreys.map((j) => j.n); // 10 and 100

export function mountWidget(el, spec = {}) {
  const state = {
    n: N_SET.includes(Number(spec.n)) ? Number(spec.n) : N_SET[N_SET.length - 1],
    view: spec.preset === "density" ? "density" : "pmf",
  };
  const doroFits = new Map();
  const doroOf = (n) => { if (!doroFits.has(n)) doroFits.set(n, dp.doroKL(n)); return doroFits.get(n); };
  // where DORO's Gamma puts its second mode of K_n (the largest pmf value above k = 1)
  const doroHump = (n, d) => { const pmf = dp.mixPmf(n, d.a, d.b); let k0 = 2; for (let k = 3; k <= n; k += 1) if (pmf[k] > pmf[k0]) k0 = k; return k0; };
  const ui = frame(el, { label: "Jeffreys versus DORO: two objective priors on alpha that disagree about the number of clusters", className: "dpx-objective" });
  const pMain = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pMain);
  ui.caption.textContent =
    "Jeffreys prior p(alpha) proportional to the square root of the Fisher information of the partition at n units (Rodriguez, 2013, as described by Vicentini and Jermyn, 2025; the original paper was not consulted here); DORO after Dorazio (2009), solved live. Jeffreys values are integrated in R over the whole alpha line (r-export/06_jeffreys_sg_grid.R). K_n is the number of fitted components among the n units.";
  let width = 720;

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const jf = grid.jeffreys.find((j) => j.n === state.n);
    const d = doroOf(state.n);
    const n = state.n;
    const colJ = c.slate;
    const colD = c.methods.doro;
    if (state.view === "pmf") {
      const pmfD = dp.mixPmf(n, d.a, d.b);
      const rows = jf.pmf.map((p, i) => ({ k: i + 1, j: p, d: pmfD[i + 1] }));
      const yTop = Math.max(...rows.map((r) => Math.max(r.j, r.d)), 1 / n) * 1.15;
      draw(pMain, {
        width, height: 270, marginLeft: 48, marginBottom: 44,
        x: { domain: [0.5, n + 0.5], label: `k (clusters among n = ${n})`, labelOffset: 38 },
        y: { domain: [0, yTop], label: "probability", grid: true },
        marks: [
          P.rectY(rows, { x1: (r) => r.k - 0.42, x2: (r) => r.k + 0.42, y: "j", fill: colJ, fillOpacity: 0.75 }),
          P.line(rows, { x: "k", y: "d", stroke: colD, strokeWidth: 2.4 }),
          P.ruleY([1 / n], { x1: 0.5, x2: n + 0.5, stroke: c.fg, strokeDasharray: "6,4", strokeWidth: 1.5 }),
          P.text([{ k: n, y: 1 / n }], { x: "k", y: "y", text: () => "DORO target 1/n", dy: -8, textAnchor: "end", fill: c.fg, fontSize: 11 }),
        ],
      }, `Implied K_${n}: Jeffreys (bars) has E K = ${fmtCount(jf.summary.E_K)}, P(K = 1) = ${fmtProb(jf.summary.P_K1)} and P(K = ${n}) = ${fmtProb(jf.summary.P_Kn)}; DORO's flat target is ${fmt(1 / n, 3)} (dashed) and its best Gamma, ${fmtGamma(d.a, d.b)} (line), has E K = ${fmtCount(dp.mixMoments(n, d.a, d.b).mean)}.`);
      pMain.prepend(h("p", { class: "dpx-panel-title", text: `Implied K_${n}: Jeffreys (bars) against DORO's flat target (dashed) and its best Gamma (line)` }));
      pMain.append(srTable(`Implied pmf of K_${n}`, ["k", "Jeffreys", "DORO Gamma fit", "DORO target"], rows.filter((r) => r.k <= 10 || r.k > n - 3 || r.k % Math.ceil(n / 10) === 0).map((r) => [r.k, fmt(r.j, 4), fmt(r.d, 4), fmt(1 / n, 4)])));
    } else {
      const LN10 = Math.log(10);
      const rows = jf.log10_alpha.map((x, i) => ({ x, j: jf.density_per_decade[i], d: Math.exp(dp.dgammaLog(10 ** x, d.a, d.b) + x * LN10) * LN10 }));
      const yTop = Math.max(...rows.map((r) => Math.max(r.j, r.d))) * 1.12;
      draw(pMain, {
        width, height: 270, marginLeft: 48, marginBottom: 44,
        x: { domain: [-6, 6], label: "alpha (log scale)", labelOffset: 38, ticks: [-6, -4, -2, 0, 2, 4, 6], tickFormat: (v) => (v === 0 ? "1" : `1e${v}`) },
        y: { domain: [0, yTop], label: "density per decade", grid: true },
        marks: [
          P.areaY(rows, { x: "x", y: "j", fill: colJ, fillOpacity: 0.25 }),
          P.line(rows, { x: "x", y: "j", stroke: colJ, strokeWidth: 2.4 }),
          P.line(rows, { x: "x", y: "d", stroke: colD, strokeWidth: 2.4 }),
          P.ruleX([Math.log10(jf.mass.median_alpha)], { stroke: colJ, strokeDasharray: "4,3" }),
          P.text([{ x: Math.log10(jf.mass.median_alpha), y: yTop * 0.95 }], { x: "x", y: "y", text: () => `Jeffreys median alpha = ${fmt(jf.mass.median_alpha, 1)}`, dx: 6, textAnchor: "start", fill: c.fg, fontSize: 11 }),
        ],
      }, `Prior density of log10 alpha at n = ${n}: Jeffreys (grey, median ${fmt(jf.mass.median_alpha, 1)}, ${fmtProb(jf.mass.above_1e4)} of its mass above alpha = 1e4, no finite mean) and DORO's ${fmtGamma(d.a, d.b)} (blue).`);
      pMain.prepend(h("p", { class: "dpx-panel-title", text: `Prior on alpha at n = ${n}: Jeffreys (grey) against DORO's Gamma fit (blue)` }));
    }
    pMain.append(h("p", { class: "dpx-legend" },
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${colJ};height:0.6rem` }), "Jeffreys"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${colD};height:0.25rem;width:1.2rem` }), "DORO's best Gamma"),
      ...(state.view === "pmf" ? [h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.fg};height:0.12rem;width:1.2rem` }), "DORO's flat target")] : [])));
    const s = jf.summary;
    ui.readout.textContent = `n = ${n}: the Jeffreys prior implies E K_${n} = ${fmtCount(s.E_K)} with P(K = 1) = ${fmtProb(s.P_K1)} and P(K = ${n}) = ${fmtProb(s.P_Kn)} (90% interval [${s.q05}, ${s.q95}]) and Pr(W_SB > .5) = ${fmtProb(s.S50)}; DORO asks for 1/${n} on every k and gets ${fmtGamma(d.a, d.b)} with E K = ${fmtCount(dp.mixMoments(n, d.a, d.b).mean)} and Pr(W_SB > .5) = ${fmtProb(dp.wsbTail(0.5, d.a, d.b))}. Neither is flat: Jeffreys spikes at both ends, DORO's Gamma at one cluster and in a hump at k = ${doroHump(n, d)} of ${n}.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.eK = String(s.E_K);
    ui.root.dataset.pK1 = String(s.P_K1);
  };

  const sN = segmented({ label: "n", options: N_SET.map((x) => ({ value: x, label: String(x) })), value: state.n, onChange: (v) => { state.n = v; render(); } });
  const sV = segmented({ label: "Show", options: [{ value: "pmf", label: "implied count K_n" }, { value: "density", label: "prior on alpha" }], value: state.view, onChange: (v) => { state.view = v; render(); } });
  ui.controls.append(sN.root, sV.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (N_SET.includes(Number(next.n))) { state.n = Number(next.n); sN.set(state.n); }
      if (next.preset === "density" || next.preset === "pmf") { state.view = next.preset; sV.set(state.view); }
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}

// M-19 "Stirling-gamma vs Gamma(2, 4)" (after Zito, Rigon and Dunson, 2024). Owner of this file:
// Step 7.10.
//
// The Stirling-gamma prior Sg(a, b, m) pins E(K_m) = a / b at its reference size m; with m = n
// the expected count stays at 4 for Sg(4, 1, n) and Sg(1, 0.25, n) at every n. Gamma(2, 4), the
// default Zito et al. compare against, drifts like log n: 3.20 at n = 100, 4.35 at 1,000, 5.51 at
// 10,000 (dp-core digamma path). The second panel shows what the Sg papers did not report: to
// keep the count flat, Sg moves alpha toward 0 as n grows, and Pr(W_SB > .5) rises from about .3
// at n = 10 to about .77 at n = 2000. Sg values come from r-export/06_jeffreys_sg_grid.R
// (jeffreys_sg.json, n = 10 to 2000); Gamma(2, 4) is recomputed live.
import * as dp from "../dp-core.js";
import grid from "../../data/precomputed/jeffreys_sg.js";
import { draw, logTickLabels, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, slider, toggle } from "./base.js";
import { fmtCount, fmtProb } from "./format.js";

const N_MIN = 10;
const N_MAX = 10000;
const N_TICKS = [10, 100, 1000, 10000];
const GA = { a: 2, b: 4 }; // the comparison default (Escobar and West, 1995; Zito et al., 2024)
const CELL_MIN = 336;

/** Linear interpolation on log n within an Sg grid (null outside it). */
function sgAt(rows, n, key) {
  if (n < rows[0].n || n > rows[rows.length - 1].n) return null;
  const i = rows.findIndex((r) => r.n >= n);
  if (rows[i].n === n || i === 0) return rows[i][key];
  const lo = rows[i - 1];
  const hi = rows[i];
  const w = (Math.log(n) - Math.log(lo.n)) / (Math.log(hi.n) - Math.log(lo.n));
  return lo[key] + w * (hi[key] - lo[key]);
}

export function mountWidget(el, spec = {}) {
  const state = { n: Math.round(num(spec, "n", num(spec, "J", 1000, N_MIN, N_MAX), N_MIN, N_MAX)), show: grid.sg.map(() => true) };
  const ui = frame(el, { label: "Stirling-gamma versus Gamma(2, 4): a pinned expected count, and the weights that move instead", className: "dpx-sg" });
  const pK = h("div", { class: "dpx-panel" });
  const pW = h("div", { class: "dpx-panel" });
  ui.charts.append(pK, pW);
  ui.caption.textContent =
    "After Zito, Rigon and Dunson (2024). Stirling-gamma priors Sg(a, b, n) with the reference size equal to n, from r-export/06_jeffreys_sg_grid.R (n = 10 to 2000); Gamma(2, 4) recomputed with dp-core (digamma path above n = 200). Zito et al. did not examine the weights; the right panel computes them. K_n is the number of fitted components among the n units.";
  let width = 720;
  const gaCurve = [];
  for (let i = 0; i <= 48; i += 1) {
    const n = Math.round(N_MIN * (N_MAX / N_MIN) ** (i / 48));
    gaCurve.push({ n, e: dp.mixMoments(n, GA.a, GA.b).mean });
  }
  const gaS50 = dp.wsbTail(0.5, GA.a, GA.b);

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const cols = Math.min(2, Math.max(1, Math.floor((width + 16) / CELL_MIN)));
    const w = Math.floor((width - 16 * (cols - 1)) / cols);
    const sgCols = [c.teal, c.brod[3]];
    const shown = grid.sg.map((s, i) => ({ ...s, col: sgCols[i] })).filter((_, i) => state.show[i]);
    const eGa = dp.mixMoments(state.n, GA.a, GA.b).mean;
    const base = { width: w, height: 240, marginLeft: 44, marginBottom: 42, x: { type: "log", domain: [N_MIN, N_MAX], label: "n (log scale)", ticks: N_TICKS, tickFormat: () => "", labelOffset: 36 } };
    draw(pK, {
      ...base,
      y: { domain: [0, 7], label: "E K_n", grid: true },
      marks: [
        P.line(gaCurve, { x: "n", y: "e", stroke: c.methods.lit, strokeWidth: 2.4 }),
        ...shown.map((s) => P.line(s.rows, { x: "n", y: "E_K", stroke: s.col, strokeWidth: 2.4, strokeDasharray: "6,3" })),
        ...shown.map((s) => P.dot(s.rows, { x: "n", y: "E_K", r: 2.5, fill: s.col })),
        P.ruleX([state.n], { stroke: c.muted, strokeDasharray: "2,3" }),
        P.dot([{ n: state.n, e: eGa }], { x: "n", y: "e", r: 5.5, fill: c.methods.lit, stroke: c.raised }),
        P.text([{ n: state.n, e: eGa }], { x: "n", y: "e", text: () => fmtCount(eGa), dx: -8, dy: -10, textAnchor: "end", fill: c.fg, fontWeight: 700 }),
        P.text(gaCurve.slice(-1), { x: "n", y: "e", text: () => "Gamma(2, 4)", dy: -10, textAnchor: "end", fill: c.fg, fontSize: 11 }),
        logTickLabels(N_TICKS, c.muted),
      ],
    }, `E K_n: Gamma(2, 4) grows like log n (${fmtCount(dp.mixMoments(100, GA.a, GA.b).mean)} at 100, ${fmtCount(dp.mixMoments(1000, GA.a, GA.b).mean)} at 1,000, ${fmtCount(dp.mixMoments(10000, GA.a, GA.b).mean)} at 10,000; ${fmtCount(eGa)} at n = ${state.n}); ${shown.map((s) => `${s.label} stays at ${fmtCount(s.rows[0].E_K)}`).join(" and ")} from n = 10 to 2000.`);
    pK.prepend(h("p", { class: "dpx-panel-title", text: "Counts: Sg pins E K_n at 4; Gamma(2, 4) drifts like log n" }));
    pK.append(srTable("E K_n by n", ["n", "Gamma(2, 4)", ...grid.sg.map((s) => s.label)], [10, 100, 1000, 2000, 10000].map((n) => [n, fmtCount(dp.mixMoments(n, GA.a, GA.b).mean), ...grid.sg.map((s) => { const v = sgAt(s.rows, n, "E_K"); return v === null ? "not computed" : fmtCount(v); })])));
    const gaFlat = [{ n: N_MIN, s: gaS50 }, { n: N_MAX, s: gaS50 }];
    draw(pW, {
      ...base,
      y: { domain: [0, 1], label: "Pr(W_SB > .5)", grid: true },
      marks: [
        P.line(gaFlat, { x: "n", y: "s", stroke: c.methods.lit, strokeWidth: 2.4 }),
        ...shown.map((s) => P.line(s.rows, { x: "n", y: "S50", stroke: s.col, strokeWidth: 2.4, strokeDasharray: "6,3" })),
        ...shown.map((s) => P.dot(s.rows, { x: "n", y: "S50", r: 2.5, fill: s.col })),
        P.ruleX([state.n], { stroke: c.muted, strokeDasharray: "2,3" }),
        P.text([gaFlat[0]], { x: "n", y: "s", text: () => `Gamma(2, 4): ${fmtProb(gaS50)} at every n`, dx: 4, dy: -10, textAnchor: "start", fill: c.fg, fontSize: 11 }),
        logTickLabels(N_TICKS, c.muted),
      ],
    }, `Pr(W_SB > .5): Gamma(2, 4) stays at ${fmtProb(gaS50)}; ${shown.map((s) => `${s.label} rises from ${fmtProb(s.rows[0].S50)} at n = 10 to ${fmtProb(s.rows[s.rows.length - 1].S50)} at n = 2000`).join("; ")}.`);
    pW.prepend(h("p", { class: "dpx-panel-title", text: "Weights (not examined by the Sg papers): dominance rises with n" }));
    pW.append(h("p", { class: "dpx-legend" },
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.methods.lit};height:0.25rem;width:1.2rem` }), "Gamma(2, 4)"),
      ...grid.sg.map((s, i) => h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${sgCols[i]};height:0.25rem;width:1.2rem` }), s.label))));
    const sgNow = shown.map((s) => ({ s, e: sgAt(s.rows, state.n, "E_K"), w: sgAt(s.rows, state.n, "S50") }));
    ui.readout.textContent = `n = ${state.n}: Gamma(2, 4) gives E K_n = ${fmtCount(eGa)} and Pr(W_SB > .5) = ${fmtProb(gaS50)}. ${sgNow.map((x) => (x.e === null ? `${x.s.label}: computed up to n = 2000.` : `${x.s.label} keeps E K_n = ${fmtCount(x.e)} but Pr(W_SB > .5) = ${fmtProb(x.w)}.`)).join(" ")} Pinning the count at 4 pushes alpha toward 0 as n grows, so dominance rises.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.eGa = String(eGa);
  };

  const sN = slider({ label: "n (units)", min: N_MIN, max: N_MAX, value: state.n, log: true, format: (v) => String(Math.round(v)), onInput: (v) => { state.n = Math.round(v); render(); } });
  const toggles = grid.sg.map((s, i) => toggle({ label: s.label, checked: true, onChange: (v) => { state.show[i] = v; render(); } }));
  ui.controls.append(sN.root, h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "Stirling-gamma curves" }, ...toggles.map((t) => t.root)));
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      const n = next.n ?? next.J;
      if (n !== undefined) { state.n = Math.round(num({ n }, "n", state.n, N_MIN, N_MAX)); sN.set(state.n); }
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}

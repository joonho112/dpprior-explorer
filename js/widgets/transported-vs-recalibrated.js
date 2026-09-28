// M-16 "Transported versus recalibrated count priors". Owner of this file: Step 7.13.
//
// The vocabulary target, "about 5 clusters, between 2 and 10 with 80% probability", is
// calibrated by TSMM at each J (r-export/03_recalibrate_by_J.R, count_prior_by_J.json). Carried
// unchanged from a reference J (500 by default: Gamma(2.1062, 3.0789)) to smaller designs, the
// prior expects fewer clusters: 2.36 at J = 10. Recalibrated at each J, the expected count stays
// at 5, but the weights move: Pr(W_SB > .5) rises from .495 at J = 50 to .555 at 100 and .652 at
// 500. The transported curves are recomputed with dp-core from the reference J's (a, b).
import * as dp from "../dp-core.js";
import cp from "../../data/precomputed/count_prior_by_J.js";
import { draw, logTickLabels, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented, toggle } from "./base.js";
import { fmtCount, fmtGamma, fmtProb } from "./format.js";

const J_MIN = 10;
const J_MAX = 500;
const J_TICKS = [10, 20, 50, 100, 200, 500];
const J_CURVE = [10, 15, 20, 25, 30, 40, 50, 60, 79, 100, 125, 150, 200, 250, 300, 400, 500];
const REFS = [25, 50, 100, 500];

export function mountWidget(el, spec = {}) {
  const recal = cp.recalibrated.filter((r) => r.feasible);
  const infeasible = cp.recalibrated.filter((r) => !r.feasible).map((r) => r.J);
  const state = { ref: REFS.includes(Number(spec.J)) ? Number(spec.J) : 500, band: spec.preset !== "noband" };
  const ui = frame(el, { label: "Transported versus recalibrated count priors across J", className: "dpx-transport" });
  const pK = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pS = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pK, pS);
  ui.caption.textContent =
    `Target: ${cp.target.label} (mu_K = ${cp.target.mu_K}, var_K = ${cp.target.var_K.toFixed(3)}), calibrated by TSMM at each J (solid; DPprior 2.0.0, r-export/03_recalibrate_by_J.R) or once at the reference J and carried to the others (dashed; recomputed with dp-core). Bands: 5th to 95th percentile of K_J, the number of fitted components among the J units. No Gamma prior meets the target at J = ${infeasible.join(", ") || "none"}.`;
  let width = 720;
  const transported = (ref) => {
    const r = recal.find((x) => x.J === ref);
    return { a: r.a, b: r.b, rows: J_CURVE.map((J) => { const s = dp.pmfSummary(dp.mixPmf(J, r.a, r.b)); return { J, e: dp.mixMoments(J, r.a, r.b).mean, lo: s.q05, hi: s.q95 }; }) };
  };
  const cache = new Map();
  const tOf = (ref) => { if (!cache.has(ref)) cache.set(ref, transported(ref)); return cache.get(ref); };

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const tr = tOf(state.ref);
    const colR = c.methods.tsmm;
    const colT = c.fg;
    const recRows = recal.map((r) => ({ J: r.J, e: r.E_K, lo: r.q05, hi: r.q95, s: r.S50 }));
    const yMax = Math.max(...recRows.map((d) => d.hi), ...tr.rows.map((d) => d.hi)) + 1;
    const xBase = { type: "log", domain: [J_MIN, J_MAX], label: "J (log scale)", ticks: J_TICKS, tickFormat: () => "", labelOffset: 36 };
    const t10 = tr.rows[0];
    draw(pK, {
      width, height: 280, marginLeft: 44, marginBottom: 42,
      x: xBase,
      y: { domain: [0, yMax], label: "E K_J", grid: true },
      marks: [
        ...(state.band ? [
          P.areaY(recRows, { x: "J", y1: "lo", y2: "hi", fill: colR, fillOpacity: 0.14, curve: "step" }),
          P.areaY(tr.rows, { x: "J", y1: "lo", y2: "hi", fill: c.slate, fillOpacity: 0.12, curve: "step" }),
        ] : []),
        P.line(recRows, { x: "J", y: "e", stroke: colR, strokeWidth: 2.6 }),
        P.line(tr.rows, { x: "J", y: "e", stroke: colT, strokeWidth: 2.2, strokeDasharray: "6,4" }),
        P.dot(recRows, { x: "J", y: "e", r: 2.5, fill: colR }),
        P.ruleX([state.ref], { stroke: c.muted, strokeDasharray: "2,3" }),
        P.text([{ J: state.ref, e: yMax }], { x: "J", y: "e", text: () => `reference J = ${state.ref}`, dy: 10, dx: -4, textAnchor: "end", fill: c.muted, fontSize: 11 }),
        P.dot([{ J: J_MIN, e: t10.e }], { x: "J", y: "e", r: 5, fill: colT }),
        P.text([{ J: J_MIN, e: t10.e }], { x: "J", y: "e", text: () => `carried: ${fmtCount(t10.e)} at J = ${J_MIN}`, dx: 8, dy: 12, textAnchor: "start", fill: c.fg, fontSize: 11, fontWeight: 700 }),
        P.text(recRows.slice(-1), { x: "J", y: "e", text: (d) => `recalibrated: ${fmtCount(d.e)}`, dy: -10, textAnchor: "end", fill: colR, fontSize: 11, fontWeight: 700 }),
        logTickLabels(J_TICKS, c.muted),
      ],
    }, `E K_J for the target calibrated at each J (solid, ${fmtCount(recRows[0].e)} to ${fmtCount(recRows[recRows.length - 1].e)}) and for ${fmtGamma(tr.a, tr.b, 4)} carried from J = ${state.ref} (dashed): ${fmtCount(t10.e)} at J = 10, ${fmtCount(tr.rows.find((d) => d.J === 100).e)} at 100, ${fmtCount(tr.rows[tr.rows.length - 1].e)} at 500.`);
    pK.prepend(h("p", { class: "dpx-panel-title", text: `Counts: recalibrated at each J (solid) against carried from J = ${state.ref} (dashed)` }));
    pK.append(h("p", { class: "dpx-legend" },
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${colR};height:0.25rem;width:1.2rem` }), "recalibrated at each J (TSMM)"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${colT};height:0.2rem;width:1.2rem` }), `carried from J = ${state.ref}`),
      ...(state.band ? [h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.slate};opacity:.3;height:0.6rem` }), "5th to 95th percentile")] : [])));
    pK.append(srTable("E K_J and 90% band", ["J", "recalibrated E K", "recalibrated band", "carried E K", "carried band"], J_CURVE.map((J) => {
      const r = recRows.find((d) => d.J === J);
      const t = tr.rows.find((d) => d.J === J);
      return [J, r ? fmtCount(r.e) : "no solution", r ? `[${r.lo}, ${r.hi}]` : "", fmtCount(t.e), `[${t.lo}, ${t.hi}]`];
    })));
    const sT = dp.wsbTail(0.5, tr.a, tr.b);
    const marks = [50, 100, 500].map((J) => recRows.find((d) => d.J === J)).filter(Boolean);
    draw(pS, {
      width, height: 190, marginLeft: 44, marginBottom: 42,
      x: xBase,
      y: { domain: [0, 1], label: "Pr(W_SB > .5)", grid: true },
      marks: [
        P.line(recRows, { x: "J", y: "s", stroke: colR, strokeWidth: 2.6 }),
        P.ruleY([sT], { stroke: colT, strokeDasharray: "6,4", strokeWidth: 1.8 }),
        P.dot(marks, { x: "J", y: "s", r: 5, fill: colR, stroke: c.raised }),
        P.text(marks, { x: "J", y: "s", text: (d) => fmtProb(d.s), dy: -12, fill: c.fg, fontSize: 11, fontWeight: 700 }),
        P.text([{ J: J_MIN, s: sT }], { x: "J", y: "s", text: () => `carried from J = ${state.ref}: ${fmtProb(sT)} at every J`, dx: 4, dy: -8, textAnchor: "start", fill: c.fg, fontSize: 11 }),
        logTickLabels(J_TICKS, c.muted),
      ],
    }, `Pr(W_SB > .5) under the recalibrated priors rises with J: ${marks.map((d) => `${fmtProb(d.s)} at J = ${d.J}`).join(", ")}; the carried prior stays at ${fmtProb(sT)}.`);
    pS.prepend(h("p", { class: "dpx-panel-title", text: "Weights: recalibrating keeps the count at 5 and raises the dominance" }));
    const first = recRows[0];
    ui.readout.textContent = `Reference J = ${state.ref}: ${fmtGamma(tr.a, tr.b, 4)}. Carried to J = 10 it expects ${fmtCount(t10.e)} clusters (90% band [${t10.lo}, ${t10.hi}]) and to J = 500 ${fmtCount(tr.rows[tr.rows.length - 1].e)}. Recalibrated at each J the count stays at ${fmtCount(recRows[recRows.length - 1].e)}, but Pr(W_SB > .5) rises from ${fmtProb(first.s)} at J = ${first.J} to ${marks.map((d) => `${fmtProb(d.s)} at ${d.J}`).join(", ")}.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.t10 = String(t10.e);
  };

  const sRef = segmented({ label: "reference J (calibrated once)", options: REFS.map((j) => ({ value: j, label: String(j) })), value: state.ref, onChange: (v) => { state.ref = v; render(); } });
  const tBand = toggle({ label: "5th to 95th percentile bands", checked: state.band, onChange: (v) => { state.band = v; render(); } });
  ui.controls.append(sRef.root, tBand.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (REFS.includes(Number(next.J))) { state.ref = Number(next.J); sRef.set(state.ref); }
      if (next.preset === "noband") { state.band = false; tBand.set(false); }
      if (next.preset === "band") { state.band = true; tBand.set(true); }
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}

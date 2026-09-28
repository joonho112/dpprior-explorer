// C-16 "Size-biased tail and the W_max band (Proposition 1)". Owner of this file: Step 5.7.
//
// For t >= 1/2 the largest population weight satisfies
//   S(t) = Pr(W_SB > t) <= Pr(W_max > t) <= min(1, S(t) / t),
// and dp-core computes Pr(W_max > t) exactly there (u = -log(1 - w) substitution; CONTRACT.md
// section 6). The STAR panel reads the application's posterior summaries (paper Table 5) from
// data/released/app_priors.js; nothing in it is recomputed and no value is typed in here.
import * as dp from "../dp-core.js";
import appPriors from "../../data/released/app_priors.js";
import worked from "../../data/precomputed/worked_example_j50.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, segmented, slider, toggle } from "./base.js";
import { fmt, fmtGamma, fmtProb } from "./format.js";

const DA = worked.stages.find((s) => s.key === "da");
const STAR = appPriors.filter((r) => r.app === "STAR");
const STAR_DA = STAR.find((r) => r.prior === "Dual-Anchor");
const PRESETS = [
  { key: "g11", label: "Gamma(1, 1)", a: 1, b: 1 },
  { key: "g13", label: "Gamma(1, 3)", a: 1, b: 3 },
  { key: "da", label: `Dual-Anchor J = 50 ${fmtGamma(DA.a, DA.b)}`, a: DA.a, b: DA.b },
  { key: "star-da", label: `STAR Dual-Anchor ${fmtGamma(STAR_DA.a, STAR_DA.b)}`, a: STAR_DA.a, b: STAR_DA.b },
];
const T_MAX = 0.99;
const MEASURES = [
  { key: "observed_largest_share", label: "observed largest share (posterior mean)" },
  { key: "population_largest_weight", label: "largest occupied population weight (posterior mean)" },
  { key: "p_population_largest_weight_gt_05", label: "Pr(largest population weight > .5 | data)" },
  { key: "alpha_only_p_wsb_gt_05", label: "alpha-only Pr(W_SB > .5), posterior alpha" },
];
const PRIOR_KEY = { Vague: "vague", "DORO-Unif": "doro", TSMM: "tsmm", "Dual-Anchor": "da", "Dual-Anchor (hard)": "hard" };

export function mountWidget(el, spec = {}) {
  const preset = PRESETS.find((p) => p.key === spec.preset) ?? PRESETS[0];
  const state = {
    a: num(spec, "a", preset.a, 0.05, 50),
    b: num(spec, "b", preset.b, 0.05, 50),
    t: num(spec, "t", dp.MAJORITY_T, dp.MAJORITY_T, T_MAX),
    star: spec.star === true || spec.preset === "star-da",
  };
  const ui = frame(el, { label: "The largest weight W_max between the size-biased tail and its Proposition 1 upper bound", className: "dpx-wmax" });
  const pBand = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pStar = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pBand, pStar);
  ui.caption.textContent =
    "Prior statements under the chosen Gamma(a, b): W_SB is the share of a randomly chosen unit's cluster; W_max is the largest population weight. For t of one half or more, S(t) <= Pr(W_max > t) <= min(1, S(t)/t) (Proposition 1), and the solid line is the exact value.";
  let width = 720;
  const name = () => PRESETS.find((p) => p.a === state.a && p.b === state.b)?.label ?? fmtGamma(state.a, state.b);

  const render = () => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { a, b, t } = state;
    const pts = [];
    for (let i = 0; i <= 48; i += 1) {
      const tt = dp.MAJORITY_T + ((T_MAX - dp.MAJORITY_T) * i) / 48;
      const bnd = dp.wmaxBounds(tt, a, b);
      pts.push({ t: tt, lo: bnd.lower, hi: bnd.upper, ex: dp.wmaxTail(tt, a, b) });
    }
    const at = dp.wmaxBounds(t, a, b);
    const ex = dp.wmaxTail(t, a, b);
    draw(pBand, {
      width, height: 280, marginLeft: 46, marginRight: 20,
      x: { domain: [dp.MAJORITY_T, 1], label: "t", ticks: [0.5, 0.6, 0.7, 0.8, 0.9, 1], tickFormat: (d) => (d === 1 ? "1" : fmt(d, 1)) },
      y: { domain: [0, 1], label: "probability", grid: true, tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)) },
      marks: [
        P.areaY(pts, { x: "t", y1: "lo", y2: "hi", fill: c.slate, fillOpacity: 0.18 }),
        P.lineY(pts, { x: "t", y: "hi", stroke: c.slate, strokeDasharray: "4,3" }),
        P.lineY(pts, { x: "t", y: "lo", stroke: c.blue, strokeWidth: 2 }),
        P.lineY(pts, { x: "t", y: "ex", stroke: c.red, strokeWidth: 2.4 }),
        P.ruleX([t], { stroke: c.fg, strokeDasharray: "2,3" }),
        P.dot([{ t, y: at.lower }, { t, y: ex }, { t, y: at.upper }], { x: "t", y: "y", r: 4, fill: c.raised, stroke: c.fg }),
        P.text([{ t, y: ex }], { x: "t", y: "y", dx: 8, textAnchor: "start", text: () => `Pr(W_max > ${fmt(t, 2)}) = ${fmtProb(ex)}`, fill: c.red, fontWeight: 700, fontSize: 12 }),
        P.text([{ t, y: at.lower }], { x: "t", y: "y", dx: 8, dy: 10, textAnchor: "start", text: () => `S(${fmt(t, 2)}) = ${fmtProb(at.lower)}`, fill: c.blue, fontSize: 11 }),
      ],
    }, `Band between S(t) and min(1, S(t)/t) for t from .5 to .99 under ${name()}, with the exact Pr(W_max > t); at t = ${fmt(t, 2)}: ${fmtProb(at.lower)} <= ${fmtProb(ex)} <= ${fmtProb(at.upper)}.`);
    pBand.prepend(h("p", { class: "dpx-panel-title", text: `Prior under ${name()}: blue S(t) = Pr(W_SB > t), red exact Pr(W_max > t), grey band up to min(1, S(t)/t)` }));
    pBand.append(srTable(`Pr(W_max > t) and its bounds under ${name()}`, ["t", "S(t)", "Pr(W_max > t)", "min(1, S(t)/t)"],
      pts.filter((_, i) => i % 6 === 0).map((d) => [fmt(d.t, 2), fmtProb(d.lo), fmtProb(d.ex), fmtProb(d.hi)])));

    pStar.hidden = !state.star;
    if (state.star) {
      const order = STAR.map((r) => r.prior);
      const cellW = width >= 640 ? Math.floor((width - 16) / 2) : width;
      const grid = h("div", { class: "dpx-charts" });
      for (const m of MEASURES) {
        const cell = h("div", { class: "dpx-panel" });
        const rows = STAR.map((r) => ({ prior: r.prior, key: PRIOR_KEY[r.prior] ?? "neutral", v: r[m.key] }));
        draw(cell, {
          width: cellW, height: 150, marginLeft: 124, marginRight: 40, marginBottom: 28,
          x: { domain: [0, 1], label: null, grid: true, ticks: [0, 0.25, 0.5, 0.75, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 2)) },
          y: { domain: order, label: null },
          marks: [
            P.barX(rows, { y: "prior", x: "v", fill: (d) => c.methods[d.key], fillOpacity: (d) => (d.key === "da" ? 1 : 0.5) }),
            P.text(rows, { y: "prior", x: "v", text: (d) => fmtProb(d.v), dx: 4, textAnchor: "start", fill: c.fg, fontSize: 11, fontWeight: (d) => (d.key === "da" ? 700 : 400) }),
            P.ruleX([dp.MAJORITY_T], { stroke: c.red, strokeDasharray: "3,3" }),
          ],
        }, `STAR posterior, ${m.label}: ${rows.map((d) => `${d.prior} ${fmtProb(d.v)}`).join(", ")}.`);
        cell.prepend(h("p", { class: "dpx-panel-title", text: m.label }));
        grid.append(cell);
      }
      pStar.replaceChildren(
        h("p", { class: "dpx-panel-title", text: "STAR posterior (paper Table 5, J = 79 schools): four dominance summaries per prior, Dual-Anchor in full colour" }),
        grid,
        h("p", { class: "dpx-caption-note", text: "Posterior values released by the replication package (data/released/app_priors.json, CC BY 4.0): read, not recomputed. They condition on the STAR data, unlike the prior curves above." }),
        srTable("STAR posterior dominance summaries", ["prior", ...MEASURES.map((m) => m.label)], STAR.map((r) => [r.prior, ...MEASURES.map((m) => fmtProb(r[m.key]))])),
      );
    }
    ui.readout.textContent =
      `${name()}, t = ${fmt(t, 2)}: S(t) = ${fmtProb(at.lower)} <= Pr(W_max > t) = ${fmtProb(ex)} <= min(1, S(t)/t) = ${fmtProb(at.upper)}. ` +
      `A first piece above one half is the largest piece, so the size-biased tail never exceeds the W_max tail.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.exact = String(ex);
  };

  const presetSeg = segmented({ label: "Prior", options: PRESETS.map((p) => ({ value: p.key, label: p.label })), value: PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null,
    onChange: (v) => { const p = PRESETS.find((q) => q.key === v); state.a = p.a; state.b = p.b; sa.set(p.a); sb.set(p.b); render(); } });
  const sa = slider({ label: "a (shape)", min: 0.05, max: 50, value: state.a, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.a = v; presetSeg.set(null); render(); } });
  const sb = slider({ label: "b (rate)", min: 0.05, max: 50, value: state.b, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.b = v; presetSeg.set(null); render(); } });
  const st = slider({ label: "t", min: dp.MAJORITY_T, max: T_MAX, step: 0.01, value: state.t, format: (v) => fmt(v, 2), onInput: (v) => { state.t = v; render(); } });
  const starT = toggle({ label: "STAR posterior (Table 5)", checked: state.star, onChange: (v) => { state.star = v; render(); } });
  ui.controls.append(presetSeg.root, sa.root, sb.root, st.root, starT.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.preset !== undefined) {
        const p = PRESETS.find((q) => q.key === next.preset);
        if (p) { state.a = p.a; state.b = p.b; }
      }
      if (next.a !== undefined) state.a = num(next, "a", state.a, 0.05, 50);
      if (next.b !== undefined) state.b = num(next, "b", state.b, 0.05, 50);
      if (next.t !== undefined) { state.t = num(next, "t", state.t, dp.MAJORITY_T, T_MAX); st.set(state.t); }
      if (next.star !== undefined) { state.star = Boolean(next.star); starT.set(state.star); }
      sa.set(state.a);
      sb.set(state.b);
      presetSeg.set(PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null);
      render();
    },
    destroy() { stop(); el.replaceChildren(); },
  };
}

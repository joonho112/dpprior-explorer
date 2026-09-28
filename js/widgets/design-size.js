// A-09 "More sites do not fix the default" (paper Figure 6). Owner of this file: Step 9.9.
//
// The completed design-size grid of the paper (grand-mean prior N(0, 100), 200 replications per
// cell): J in {25, 50, 100, 200} by K* in {5, 10} by I in {.2, .8} under the five priors. Each prior
// is a trajectory over J (log axis) of the posterior mean of K_J or the collapse rate, with the
// 10%-90% range across replications. The J slider moves a marker along the trajectories; the tiles
// read the Vague collapse floor, the Dual-Anchor and SSI-Weight endpoints, and the Dual-Anchor
// lambda that the selection rule picks at each J (.70, .30, .16, .09 at K* = 5). Cells where fewer
// than 100 of 200 fits were admitted (I = .8 at J = 200) are drawn hollow: they are
// diagnostic-pass subsets. Everything is read from design_size.json (variant "balanced", the
// r = 1 calibrations; the J200 variant repeats the J = 200 rows).
import rowsAll from "../../data/released/design_size.js";
import { dodge, draw, logTickLabels, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented, slider, toggle } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const PRIORS = ["Vague", "DORO-Unif", "TSMM", "Dual-Anchor", "SSI-Weight"];
const TOKEN = { Vague: "vague", "DORO-Unif": "doro", TSMM: "tsmm", "Dual-Anchor": "da", "SSI-Weight": "ssi" };
// the grid (J, K*, I) is read from the balanced r = 1 rows
const GRID = rowsAll.filter((r) => r.variant === "balanced" && (r.r === 1 || r.r == null));
const uniq = (key) => [...new Set(GRID.map((r) => r[key]))].sort((a, b) => a - b);
const JS = uniq("J");
const KS = uniq("K_true");
const IS = uniq("I_target");
const THIN = 100; // admitted fits below this (of 200) are drawn hollow
const snapJ = (v) => JS.reduce((p, q) => (Math.abs(Math.log(q / v)) < Math.abs(Math.log(p / v)) ? q : p));

export function mountWidget(el, spec = {}) {
  const grid = GRID;
  const state = {
    K: KS.includes(Number(spec.K)) ? Number(spec.K) : 5,
    I: IS.includes(Number(spec.I)) ? Number(spec.I) : 0.2,
    metric: spec.preset === "collapse" ? "collapse" : "EK",
    J: JS.includes(Number(spec.J)) ? Number(spec.J) : JS[JS.length - 1],
    on: new Set(PRIORS),
  };
  const ui = frame(el, { label: `Design size: the posterior number of clusters and collapse from J = ${JS[0]} to J = ${JS[JS.length - 1]} sites`, className: "dpx-design-size" });
  const span = `J = ${JS[0]} → ${JS[JS.length - 1]}`;
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, panel);
  let width = 720;

  const cell = (prior, K, I, J) => grid.find((x) => x.prior === prior && x.K_true === K && x.I_target === I && x.J === J);
  const traj = (prior, K = state.K, I = state.I) => JS.map((J) => cell(prior, K, I, J));
  const val = (x) => (state.metric === "EK" ? x.mean_E_K : x.mean_p_K1);
  const f = (v) => (state.metric === "EK" ? fmtCount(v) : fmtProb(v));
  const lam = (x) => (x.selected_lambda == null ? "–" : x.selected_lambda >= 1 ? "1" : fmt(x.selected_lambda, 2));
  const tip = (x) => `${x.prior}, K* = ${x.K_true}, I = ${fmt(x.I_target, 1)}, J = ${x.J}\nposterior mean K_J ${fmtCount(x.mean_E_K)} (10%-90% ${fmtCount(x.q10_E_K)} to ${fmtCount(x.q90_E_K)})\ncollapse ${fmtProb(x.mean_p_K1)}\nadmitted ${x.n_scientific_eligible} of ${x.n_manifest}${x.n_scientific_eligible < THIN ? " (diagnostic-pass subset)" : ""}${x.prior === "Dual-Anchor" ? `\nselected lambda ${lam(x)}${x.selected_lambda >= 1 ? " (the trigger does not fire)" : ""}` : ""}`;

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const col = (p) => c.methods[TOKEN[p]];
    const shown = PRIORS.filter((p) => state.on.has(p));
    const EK = state.metric === "EK";
    const pts = grid.filter((x) => shown.includes(x.prior) && x.K_true === state.K && x.I_target === state.I).map((x) => ({ ...x, y: val(x), at: x.J === state.J, thin: x.n_scientific_eligible < THIN, tip: tip(x) }));
    const n = (x) => `${x.n_scientific_eligible}/${x.n_manifest}`;

    // tiles
    const vg = traj("Vague");
    const vgMin = vg.reduce((m, x) => (x.mean_p_K1 < m.mean_p_K1 ? x : m));
    const vgAll = grid.filter((x) => x.prior === "Vague").map((x) => x.mean_p_K1);
    const da = traj("Dual-Anchor");
    const ssi = traj("SSI-Weight");
    const other = KS.find((K) => K !== state.K); // the other K* row of the grid
    const ts = traj("TSMM");
    tiles.replaceChildren(
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `Vague at J = ${state.J} (K* = ${state.K}, I = ${fmt(state.I, 1)})` }), h("p", { class: "dpx-tile-big", text: `collapse ${fmtProb(cell("Vague", state.K, state.I, state.J).mean_p_K1)}` }), h("p", { class: "dpx-tile-note", text: `lowest over J here ${fmtProb(vgMin.mean_p_K1)} (J = ${vgMin.J}); over the whole grid at least ${fmtProb(Math.min(...vgAll))}: more sites do not rescue the default` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `Dual-Anchor, ${span}` }), h("p", { class: "dpx-tile-big", text: `${fmtCount(da[0].mean_E_K)} → ${fmtCount(da[da.length - 1].mean_E_K)}` }), h("p", { class: "dpx-tile-note", text: `posterior mean K_J; collapse ${fmtProb(da[0].mean_p_K1)} → ${fmtProb(da[da.length - 1].mean_p_K1)}. TSMM ${fmtCount(ts[0].mean_E_K)} → ${fmtCount(ts[ts.length - 1].mean_E_K)}` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `SSI-Weight, ${span}` }), h("p", { class: "dpx-tile-big", text: `${fmtCount(ssi[0].mean_E_K)} → ${fmtCount(ssi[ssi.length - 1].mean_E_K)}` }), h("p", { class: "dpx-tile-note", text: `the same at K* = ${other}: ${fmtCount(traj("SSI-Weight", other)[0].mean_E_K)} → ${fmtCount(traj("SSI-Weight", other).at(-1).mean_E_K)}; collapse ${fmtProb(ssi[0].mean_p_K1)} → ${fmtProb(ssi[ssi.length - 1].mean_p_K1)}` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `Dual-Anchor selected lambda, J = ${JS.join(", ")}` }), h("p", { class: "dpx-tile-big dpx-lambda-badges" }, ...da.map((x) => h("span", { class: `dpx-pill${x.J === state.J ? " is-on" : ""}`, title: `J = ${x.J}`, text: lam(x) }))), h("p", { class: "dpx-tile-note", text: da.every((x) => x.selected_lambda >= 1) ? "lambda = 1 at every J: at this K* the trigger does not fire, so Dual-Anchor is TSMM" : "the selection rule picks a smaller lambda as J grows: a policy trajectory, not a sample-size effect alone" })),
    );

    const w = Math.min(width, 820);
    const yMax = EK ? Math.max(state.K + 0.6, ...pts.map((d) => d.q90_E_K + 0.2)) : 1;
    const marks = [
      ...(EK ? [P.ruleY([state.K], { stroke: c.fg, strokeDasharray: "5,4", strokeOpacity: 0.8 })] : []),
      P.ruleX([state.J], { stroke: c.borderStrong, strokeWidth: 1 }),
      ...(EK ? [P.ruleX(pts, { x: "J", y1: "q10_E_K", y2: "q90_E_K", stroke: (d) => col(d.prior), strokeWidth: 3, strokeOpacity: 0.4 })] : []),
      ...shown.map((p) => P.line(pts.filter((d) => d.prior === p).sort((a, b) => a.J - b.J), { x: "J", y: "y", stroke: col(p), strokeWidth: 2.2 })),
      P.dot(pts, { x: "J", y: "y", fill: (d) => (d.thin ? c.bg : col(d.prior)), stroke: (d) => (d.thin ? col(d.prior) : c.fg), strokeWidth: (d) => (d.thin ? 2 : 0.6), r: (d) => (d.at ? 6 : 4), title: "tip" }),
      // the Dual-Anchor lambda at the slider's J (all four are in the badge tile), with a halo
      ...(state.on.has("Dual-Anchor") ? [P.text(pts.filter((d) => d.prior === "Dual-Anchor" && d.at), { x: "J", y: "y", text: (d) => `lambda ${lam(d)}`, textAnchor: "end", dx: -9, dy: -11, fill: c.methods.da, stroke: c.bg, strokeWidth: 4, paintOrder: "stroke", fontSize: 11, fontWeight: 700 })] : []),
      // prior names at the right end, spread apart so close endpoints stay readable (13 px)
      P.text(dodge(shown.map((p) => pts.find((d) => d.prior === p && d.J === JS[JS.length - 1])).filter(Boolean), "y", (13 * ((EK ? yMax : 1) - (EK ? 1 : 0))) / (400 - 72)), { x: "J", y: "yLabel", text: "prior", dx: 10, textAnchor: "start", fill: (d) => col(d.prior), fontSize: 11, fontWeight: 600 }),
      logTickLabels(JS, c.fg),
    ];
    draw(panel, {
      width: w, height: 400, marginLeft: 48, marginRight: 96, marginBottom: 48, marginTop: 24,
      r: { type: "identity" }, // dot r in pixels (the slider's J is larger), not a scaled channel
      x: { type: "log", domain: [JS[0] * 0.84, JS[JS.length - 1] * 1.18], ticks: JS, tickFormat: () => "", label: "J, the number of sites (log scale)", labelOffset: 40, grid: true },
      y: EK ? { domain: [1, yMax], label: "posterior mean K_J", grid: true } : { domain: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)), label: "collapse Pr(K_J = 1 | y)", grid: true },
      marks,
    }, `${EK ? "Posterior mean K_J" : "Collapse"} from J = ${JS[0]} to ${JS[JS.length - 1]} at K* = ${state.K}, I = ${fmt(state.I, 1)}: ${shown.map((p) => `${p} ${traj(p).map((x) => f(val(x))).join(", ")}`).join("; ")}.`);
    panel.prepend(h("p", { class: "dpx-panel-title", text: `${EK ? "Posterior mean K_J" : "Collapse"} as the design grows (K* = ${state.K}, I = ${fmt(state.I, 1)})${EK ? "; dashed: the true K*, bars: 10% to 90% across replications" : ""}; hollow: fewer than ${THIN} of 200 fits admitted` }));
    panel.append(h("p", { class: "dpx-legend" }, ...shown.map((p) => h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${col(p)}` }), p))));
    panel.append(srTable(`Design-size grid, K* = ${state.K}, I = ${fmt(state.I, 1)}`, ["prior", "J", "E K", "10%-90%", "collapse", "admitted", "selected lambda"],
      PRIORS.flatMap((p) => traj(p).map((x) => [p, x.J, fmtCount(x.mean_E_K), `${fmtCount(x.q10_E_K)}-${fmtCount(x.q90_E_K)}`, fmtProb(x.mean_p_K1), n(x), p === "Dual-Anchor" ? lam(x) : ""]))));
    const at = shown.map((p) => cell(p, state.K, state.I, state.J));
    ui.readout.textContent = `K* = ${state.K}, I = ${fmt(state.I, 1)}, J = ${state.J}: ${at.map((x) => `${x.prior} ${fmtCount(x.mean_E_K)} (collapse ${fmtProb(x.mean_p_K1)}, ${n(x)} admitted${x.prior === "Dual-Anchor" ? `, lambda ${lam(x)}` : ""})`).join("; ")}.`;
    ui.root.dataset.lambdas = da.map(lam).join(",");
  };

  const sK = segmented({ label: "True K*", options: KS.map((K) => ({ value: String(K), label: String(K) })), value: String(state.K), onChange: (v) => { state.K = Number(v); render(); } });
  const sI = segmented({ label: "Information I", options: IS.map((I) => ({ value: String(I), label: fmt(I, 1) })), value: String(state.I), onChange: (v) => { state.I = Number(v); render(); } });
  const sMetric = segmented({ label: "Metric", options: [{ value: "EK", label: "posterior mean K_J" }, { value: "collapse", label: "collapse" }], value: state.metric, onChange: (v) => { state.metric = v; render(); } });
  const sJ = slider({ label: "J (sites)", min: JS[0], max: JS[JS.length - 1], log: true, logStep: Math.log10(JS[1] / JS[0]), value: state.J, format: (v) => String(snapJ(v)), onInput: (v) => { state.J = snapJ(v); render(); } });
  const tg = PRIORS.map((p) => toggle({ label: p, checked: true, onChange: (v) => { if (v) state.on.add(p); else if (state.on.size > 1) state.on.delete(p); else tg[PRIORS.indexOf(p)].set(true); render(); } }));
  ui.controls.append(sK.root, sI.root, sMetric.root, sJ.root, h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "Priors" }, ...tg.map((t) => t.root)));
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.preset === "collapse") { state.metric = "collapse"; sMetric.set("collapse"); }
      if (KS.includes(Number(next.K))) { state.K = Number(next.K); sK.set(String(state.K)); }
      if (IS.includes(Number(next.I))) { state.I = Number(next.I); sI.set(String(state.I)); }
      if (JS.includes(Number(next.J))) { state.J = Number(next.J); sJ.set(state.J); }
      render();
    },
    cell(prior, K, I, J) { return cell(prior, K, I, J); },
    destroy() { stop(); el.replaceChildren(); },
  };
}

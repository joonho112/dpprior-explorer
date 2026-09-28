// A-06 "The simulation, cell by cell" (paper Figure 4). Owner of this file: Step 9.7.
//
// The paper's headline simulation: J = 100 sites, generating number of components K* in {5, 10, 30} by
// information level I in {.2, .5, .8}, five priors (Vague, DORO-Unif, TSMM, Dual-Anchor,
// SSI-Weight), 200 replications per cell. Each small panel is one (K*, I) cell; the metric selector
// shows the posterior mean of K_J (mean over replications, with the 10%-90% range across
// replications), the collapse rate Pr(K_J = 1 | y), the 95% coverage of K*, or the RMSE of the site
// effects. The grand-mean branch switches between the three released versions of the same 45 cells
// (N(0, 1) headline, N(0, .01), N(0, 100)). Everything is read from cell_summary.json; retained-fit
// counts are summed from the same rows.
import cells from "../../data/released/cell_summary.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented, toggle } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const PRIORS = ["Vague", "DORO-Unif", "TSMM", "Dual-Anchor", "SSI-Weight"];
const TOKEN = { Vague: "vague", "DORO-Unif": "doro", TSMM: "tsmm", "Dual-Anchor": "da", "SSI-Weight": "ssi" };
const SHORT = { Vague: "Vague", "DORO-Unif": "DORO", TSMM: "TSMM", "Dual-Anchor": "DA", "SSI-Weight": "SSI" };
const TINY = { Vague: "V", "DORO-Unif": "DO", TSMM: "TS", "Dual-Anchor": "DA", "SSI-Weight": "SS" }; // x labels below 560 px
const BRANCH = {
  n01: { suite: "headline_n01", label: "N(0, 1) (headline)" },
  n001: { suite: "headline_n001", label: "N(0, .01)" },
  n100: { suite: "fallback", label: "N(0, 100)" },
};
const METRIC = {
  EK: { label: "posterior mean K_J", col: "mean_E_K", fmt: fmtCount },
  collapse: { label: "collapse Pr(K_J = 1 | y)", col: "mean_p_K1", fmt: fmtProb },
  coverage: { label: "95% coverage of K*", col: "coverage95_K", fmt: fmtProb },
  rmse: { label: "RMSE of the site effects", col: "mean_tau_rmse", fmt: (x) => fmt(x, 4) },
};

// the headline design size, read from the headline rows (the grand-mean branches share it)
const HEADLINE_J = cells.find((r) => r.suite === "headline_n01" && r.is_headline).J;

export function mountWidget(el, spec = {}) {
  const pick = (branch) => cells.filter((r) => r.suite === BRANCH[branch].suite && r.is_headline && r.J === HEADLINE_J && r.weights === "equal" && (r.design === "A" || r.design === "E"));
  const state = { branch: BRANCH[spec.branch] ? spec.branch : "n01", metric: METRIC[spec.preset] ? spec.preset : "EK", on: new Set(PRIORS) };
  // the grid (K*, I) is read from the headline rows
  const Ks = [...new Set(cells.filter((r) => r.is_headline).map((r) => r.K_true))].sort((a, b) => a - b);
  const Is = [...new Set(cells.filter((r) => r.is_headline).map((r) => r.I_target))].sort((a, b) => a - b);
  const ui = frame(el, { label: "Simulation dashboard: the posterior number of clusters, collapse, coverage and RMSE in nine cells under five priors", className: "dpx-simdash" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, panel);
  let width = 720;

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const rows = pick(state.branch);
    const m = METRIC[state.metric];
    const narrow = width < 560; // rotated two-letter prior labels; the panel title names the metric
    const shown = rows.filter((r) => state.on.has(r.prior));
    const retained = rows.reduce((s, r) => s + r.n_scientific_eligible, 0);
    const planned = rows.reduce((s, r) => s + r.n_manifest, 0);
    ui.caption.textContent = `Headline design: J = ${rows[0].J} sites, equal cluster weights, ${rows[0].n_manifest} replications per cell; grand-mean prior ${BRANCH[state.branch].label}. ${state.branch === "n01" ? captionFor(["retained"]) : `This branch retains ${retained.toLocaleString("en-US")} of ${planned.toLocaleString("en-US")} planned fits.`} ${captionFor(["read", "kj"])}`;
    const cell = (K, I, p) => rows.find((r) => r.K_true === K && r.I_target === I && r.prior === p);
    const c52 = PRIORS.map((p) => cell(5, 0.2, p));
    tiles.replaceChildren(
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "K* = 5, I = .2: posterior mean K_J" }), h("p", { class: "dpx-tile-big", text: `${fmtCount(c52[0].mean_E_K)} to ${fmtCount(Math.max(...c52.map((r) => r.mean_E_K)))}` }), h("p", { class: "dpx-tile-note", text: c52.map((r) => `${r.prior} ${fmtCount(r.mean_E_K)}`).join(", ") })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "K* = 5, I = .2: collapse" }), h("p", { class: "dpx-tile-big", text: `${fmtProb(Math.min(...c52.map((r) => r.mean_p_K1)))} to ${fmtProb(Math.max(...c52.map((r) => r.mean_p_K1)))}` }), h("p", { class: "dpx-tile-note", text: c52.map((r) => `${r.prior} ${fmtProb(r.mean_p_K1)}`).join(", ") })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "RMSE of the site effects, all cells at I = .2" }), h("p", { class: "dpx-tile-big", text: `${fmt(Math.min(...rows.filter((r) => r.I_target === 0.2).map((r) => r.mean_tau_rmse)), 3)} to ${fmt(Math.max(...rows.filter((r) => r.I_target === 0.2).map((r) => r.mean_tau_rmse)), 3)}` }), h("p", { class: "dpx-tile-note", text: "the effects barely depend on the prior" })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "K* = 30: 95% coverage of K* under SSI-Weight" }), h("p", { class: "dpx-tile-big", text: Is.map((I) => fmtProb(cell(30, I, "SSI-Weight").coverage95_K)).join(" / ") }), h("p", { class: "dpx-tile-note", text: "at I = .2 / .5 / .8" })),
    );
    const col = (p) => c.methods[TOKEN[p]];
    const data = shown.map((r) => ({ ...r, K: `K* = ${r.K_true}`, I: `I = ${fmt(r.I_target, 1)}`, v: r[m.col], tip: PRIORS.map((p) => { const q = cell(r.K_true, r.I_target, p); return `${p}: E K ${fmtCount(q.mean_E_K)}, collapse ${fmtProb(q.mean_p_K1)}, coverage ${fmtProb(q.coverage95_K)}, RMSE ${fmt(q.mean_tau_rmse, 4)}`; }).join("\n") }));
    const truth = Ks.flatMap((K) => Is.map((I) => ({ K: `K* = ${K}`, I: `I = ${fmt(I, 1)}`, v: K })));
    const marks = [
      ...(state.metric === "EK" ? [P.ruleY(truth, { y: "v", fx: "K", fy: "I", stroke: c.fg, strokeDasharray: "3,3" }), P.ruleX(data, { x: "prior", y1: "q10_E_K", y2: "q90_E_K", fx: "K", fy: "I", stroke: (d) => col(d.prior), strokeWidth: 3, strokeOpacity: 0.5 })] : []),
      ...(state.metric === "coverage" ? [P.ruleY([0.95], { stroke: c.fg, strokeDasharray: "3,3" })] : []),
      P.dot(data, { x: "prior", y: "v", fx: "K", fy: "I", fill: (d) => col(d.prior), r: state.metric === "EK" ? 3.5 : 4.5, stroke: c.fg, strokeWidth: 0.5, title: (d) => `K* = ${d.K_true}, I = ${fmt(d.I_target, 1)} (${BRANCH[state.branch].label})\n${d.tip}` }),
    ];
    draw(panel, {
      width: Math.min(width, 900), height: 520, marginLeft: 48, marginBottom: narrow ? 40 : 30, marginTop: 26, marginRight: 50,
      x: { domain: PRIORS.filter((p) => state.on.has(p)), padding: 0.3, label: null, tickSize: 0, tickFormat: (p) => (narrow ? TINY[p] : SHORT[p]), tickRotate: narrow ? -90 : 0 },
      y: { label: narrow ? null : m.label, grid: true, ...(state.metric === "EK" ? { type: "log", domain: [0.9, 45], ticks: [1, 3, 10, 30], tickFormat: (d) => String(d) } : state.metric === "rmse" ? { tickFormat: (d) => fmt(d, 3) } : { domain: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)) }) },
      fx: { domain: Ks.map((K) => `K* = ${K}`), label: null },
      fy: { domain: Is.map((I) => `I = ${fmt(I, 1)}`), label: null, padding: 0.15 },
      marks,
    }, `${m.label} in the nine cells (K* by I) under ${[...state.on].join(", ")}, grand-mean prior ${BRANCH[state.branch].label}.`);
    panel.prepend(h("p", { class: "dpx-panel-title", text: `${m.label} by cell (columns K*, rows I; hover a dot for the whole cell)${state.metric === "EK" ? "; dashed: the true K*; bars: 10% to 90% across replications" : state.metric === "coverage" ? "; dashed: the nominal .95" : ""}` }));
    panel.append(h("p", { class: "dpx-legend" }, ...PRIORS.filter((p) => state.on.has(p)).map((p) => h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${col(p)}` }), narrow ? `${p} (${TINY[p]})` : p))));
    panel.append(srTable(`Simulation cells, ${BRANCH[state.branch].label}`, ["K*", "I", "prior", "E K", "10%-90%", "collapse", "coverage", "RMSE", "retained"],
      rows.map((r) => [r.K_true, r.I_target, r.prior, fmtCount(r.mean_E_K), `${fmtCount(r.q10_E_K)}-${fmtCount(r.q90_E_K)}`, fmtProb(r.mean_p_K1), fmtProb(r.coverage95_K), fmt(r.mean_tau_rmse, 4), `${r.n_scientific_eligible}/${r.n_manifest}`])));
    ui.readout.textContent = `Grand mean ${BRANCH[state.branch].label}, ${m.label}. At K* = 5, I = .2: ${c52.map((r) => `${r.prior} ${fmtCount(r.mean_E_K)} / ${fmtProb(r.mean_p_K1)}`).join(", ")} (E K / collapse); RMSE ${fmt(Math.min(...c52.map((r) => r.mean_tau_rmse)), 3)} to ${fmt(Math.max(...c52.map((r) => r.mean_tau_rmse)), 3)}.`;
    ui.root.dataset.cells = String(rows.length);
  };

  const sMetric = segmented({ label: "Metric", options: Object.entries(METRIC).map(([value, v]) => ({ value, label: v.label })), value: state.metric, onChange: (v) => { state.metric = v; render(); } });
  const sBranch = segmented({ label: "Grand-mean prior", options: Object.entries(BRANCH).map(([value, v]) => ({ value, label: v.label })), value: state.branch, onChange: (v) => { state.branch = v; render(); } });
  const tg = PRIORS.map((p) => toggle({ label: p, checked: true, onChange: (v) => { if (v) state.on.add(p); else if (state.on.size > 1) state.on.delete(p); else tg[PRIORS.indexOf(p)].set(true); render(); } }));
  ui.controls.append(sMetric.root, sBranch.root, h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "Priors" }, ...tg.map((t) => t.root)));
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (METRIC[next.preset]) { state.metric = next.preset; sMetric.set(next.preset); }
      if (BRANCH[next.branch]) { state.branch = next.branch; sBranch.set(next.branch); }
      render();
    },
    cell(K, I, p, branch = state.branch) { return pick(branch).find((r) => r.K_true === K && r.I_target === I && r.prior === p); },
    destroy() { stop(); el.replaceChildren(); },
  };
}

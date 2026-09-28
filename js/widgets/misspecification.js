// A-08 "When the elicited mean is wrong" (paper Figure 5). Owner of this file: Step 9.8.
//
// The completed medium-confidence grid of the paper's misspecification study (VIF 2.5, J = 100,
// grand-mean prior N(0, 100), 200 replications per cell): K* in {5, 10, 30} by I in {.2, .8} by
// r = mu_K / K* in {.5, 1, 2}. For each prior the posterior mean of K_J (or the collapse rate) is
// drawn against r on a log axis, one trajectory per K*. Cells that share an elicited mean mu_K but
// differ in K* are joined by a highlight line: (K* = 5, r = 2) and (K* = 10, r = 1) both have
// mu_K = 10 and give the same posterior, although the generating counts differ by a factor of two.
// The horizontal axis can also show mu_K itself, where the trajectories for different K* fall on
// one curve. Everything is read from misspecification.json (variant "medium"); the calibrations
// rejected at mu_K = 2.5 (no admitted fits) are drawn as crosses on the axis, not as missing runs.
import rowsAll from "../../data/released/misspecification.js";
import { draw, logTickLabels, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented, slider, toggle } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const PRIORS = ["TSMM", "Dual-Anchor", "DORO-Unif"];
const TOKEN = { TSMM: "tsmm", "Dual-Anchor": "da", "DORO-Unif": "doro", Vague: "vague" };
const DASH = { TSMM: null, "Dual-Anchor": "7,3", "DORO-Unif": "2,3" }; // a second cue besides colour (the lines overlap at mu_K >= 10)
const DASH_WORD = { TSMM: "solid", "Dual-Anchor": "dashed", "DORO-Unif": "dotted" };
// the grid (K*, I, r and the resulting mu_K) is read from the medium-confidence rows
const GRID = rowsAll.filter((r) => r.variant === "medium");
const uniq = (key) => [...new Set(GRID.map((r) => r[key]).filter((v) => v != null))].sort((a, b) => a - b);
const KS = uniq("K_true");
const IS = uniq("I_target");
const RS = uniq("r");
const MUS = uniq("mu_K");
const rLabel = (r) => (r < 1 ? fmt(r, 1) : String(r));
const muLabel = (m) => String(m);
const snapR = (v) => RS.reduce((p, q) => (Math.abs(Math.log(q / v)) < Math.abs(Math.log(p / v)) ? q : p));

export function mountWidget(el, spec = {}) {
  const grid = GRID;
  const fitted = (r) => r.n_scientific_eligible > 0 && r.mean_E_K != null;
  const state = {
    K: KS.includes(Number(spec.K)) ? Number(spec.K) : 10,
    I: IS.includes(Number(spec.I)) ? Number(spec.I) : 0.2,
    metric: spec.preset === "collapse" ? "collapse" : "EK",
    axis: spec.preset === "mu" ? "mu" : "r",
    on: new Set(["TSMM", "Dual-Anchor"]),
    vague: false,
    r: RS.includes(Number(spec.r)) ? Number(spec.r) : 1,
  };
  const ui = frame(el, { label: "Elicited-mean misspecification: the posterior number of clusters against r = mu_K / K*", className: "dpx-misspec" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, panel);
  const tsmm = grid.filter((r) => (r.prior === "TSMM" || r.prior === "Dual-Anchor") && fitted(r)).map((r) => r.n_scientific_eligible);
  const d0 = grid.find((r) => r.prior === "TSMM");
  ui.caption.textContent = `Medium-confidence grid (VIF ${d0.VIF}), J = ${d0.J} sites, grand-mean prior N(0, ${d0.grand_mean_variance}), ${d0.n_manifest} replications per cell; K* in {${KS.join(", ")}}, I in {${IS.map((I) => fmt(I, 1)).join(", ")}}, r = mu_K / K* in {${RS.map(rLabel).join(", ")}}. TSMM and Dual-Anchor cells admit ${Math.min(...tsmm)} to ${Math.max(...tsmm)} of ${d0.n_manifest} fits. Crosses: calibrations rejected at mu_K = ${MUS[0]} (fail-closed), not missing runs. ${captionFor(["read", "kj"])}`;
  let width = 720;

  const cell = (prior, K, I, r) => grid.find((x) => x.prior === prior && x.K_true === K && x.I_target === I && x.r === r);
  const val = (x) => (state.metric === "EK" ? x.mean_E_K : x.mean_p_K1);
  const f = (v) => (state.metric === "EK" ? fmtCount(v) : fmtProb(v));
  const tip = (x) => `${x.prior}, K* = ${x.K_true}, I = ${fmt(x.I_target, 1)}, r = ${rLabel(x.r)} (mu_K = ${muLabel(x.mu_K)})\nposterior mean K_J ${fmtCount(x.mean_E_K)} (10%-90% ${fmtCount(x.q10_E_K)} to ${fmtCount(x.q90_E_K)})\ncollapse ${fmtProb(x.mean_p_K1)}, coverage of K* ${fmtProb(x.coverage95_K)}\nadmitted ${x.n_scientific_eligible} of ${x.n_manifest}${x.prior === "Dual-Anchor" && x.selected_lambda != null ? `, selected lambda ${fmt(x.selected_lambda, 2)}` : ""}`;

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const col = (p) => c.methods[TOKEN[p]];
    const shown = PRIORS.filter((p) => state.on.has(p));
    const lead = shown[0];
    const X = (x) => (state.axis === "r" ? x.r : x.mu_K);
    const rows = grid.filter((x) => shown.includes(x.prior) && x.I_target === state.I && x.r != null);
    const pts = rows.filter(fitted).map((x) => ({ ...x, x: X(x), y: val(x), sel: x.K_true === state.K, tip: tip(x) }));
    const rejected = rows.filter((x) => !fitted(x)).map((x) => ({ ...x, x: X(x) }));

    // equal-mu_K pairs across K* (the highlight lines), per prior
    const pairs = [];
    for (const p of shown) {
      const byMu = new Map();
      for (const x of pts.filter((q) => q.prior === p)) byMu.set(x.mu_K, [...(byMu.get(x.mu_K) ?? []), x]);
      for (const [mu, g] of byMu) if (g.length > 1) pairs.push({ prior: p, mu, g: g.sort((a, b) => a.K_true - b.K_true) });
    }

    // tiles
    const chain = RS.map((r) => cell(lead, state.K, state.I, r));
    const p10 = [cell(lead, 5, state.I, 2), cell(lead, 10, state.I, 1)];
    const ts5 = cell("TSMM", 10, state.I, 0.5);
    const da5 = cell("Dual-Anchor", 10, state.I, 0.5);
    const gapHi = grid.filter((x) => x.prior === "TSMM" && x.I_target === state.I && x.mu_K >= 10 && fitted(x)).map((x) => {
      const d = cell("Dual-Anchor", x.K_true, x.I_target, x.r);
      return d && fitted(d) ? { gap: Math.abs(d.mean_E_K - x.mean_E_K), mu: x.mu_K } : null;
    }).filter(Boolean).sort((a, b) => b.gap - a.gap)[0];
    const atR = shown.map((p) => cell(p, state.K, state.I, state.r));
    tiles.replaceChildren(
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `${lead}, K* = ${state.K}, I = ${fmt(state.I, 1)}: r = .5, 1, 2` }), h("p", { class: "dpx-tile-big", text: chain.map((x) => (x && fitted(x) ? f(val(x)) : "rejected")).join(" → ") }), h("p", { class: "dpx-tile-note", text: `${state.metric === "EK" ? "posterior mean K_J" : "collapse"} as mu_K goes ${RS.map((r) => muLabel(r * state.K)).join(", ")}` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `Same mu_K = 10, different truth (${lead}, I = ${fmt(state.I, 1)})` }), h("p", { class: "dpx-tile-big", text: p10.every((x) => x && fitted(x)) ? `${f(val(p10[0]))} and ${f(val(p10[1]))}` : "rejected" }), h("p", { class: "dpx-tile-note", text: `K* = 5 with r = 2 and K* = 10 with r = 1; collapse ${p10.every((x) => x && fitted(x)) ? p10.map((x) => fmtProb(x.mean_p_K1)).join(" and ") : "not available"}` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `The weight anchor at mu_K = 5 (K* = 10, r = .5, I = ${fmt(state.I, 1)})` }), h("p", { class: "dpx-tile-big", text: `${fmtCount(ts5.mean_E_K)} → ${fmtCount(da5.mean_E_K)}` }), h("p", { class: "dpx-tile-note", text: `TSMM to Dual-Anchor; collapse ${fmtProb(ts5.mean_p_K1)} → ${fmtProb(da5.mean_p_K1)}. From mu_K = 10 on the two differ by at most ${fmt(gapHi.gap, 3)} (mu_K = ${gapHi.mu})` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: `Slider: r = ${rLabel(state.r)}, so mu_K = ${muLabel(state.r * state.K)} at K* = ${state.K}` }), h("p", { class: "dpx-tile-big", text: atR.map((x, i) => `${shown[i] === "Dual-Anchor" ? "DA" : shown[i] === "DORO-Unif" ? "DORO" : shown[i]} ${x && fitted(x) ? f(val(x)) : "rejected"}`).join(" · ") }), h("p", { class: "dpx-tile-note", text: atR.map((x, i) => `${shown[i]} admitted ${x ? x.n_scientific_eligible : 0} of ${d0.n_manifest}`).join("; ") })),
    );

    const w = Math.min(width, 820);
    const EK = state.metric === "EK";
    // log-axis padding: a little room on the left, room for the K* labels on the right
    const xTicks = state.axis === "r" ? RS : MUS;
    const xDom = [xTicks[0] * 0.84, xTicks[xTicks.length - 1] * 1.45];
    const vague = state.vague ? grid.filter((x) => x.prior === "Vague" && x.I_target === state.I && x.K_true === state.K)[0] : null;
    // the elicited mean itself: y = r K* for the emphasized K* on the r axis, the identity on the mu_K axis
    const selMu = state.axis === "r" ? RS.map((r) => ({ x: r, y: r * state.K })) : [MUS[0], MUS[MUS.length - 1]].map((m) => ({ x: m, y: m }));
    const marks = [
      // highlight: equal-mu_K pairs, under everything else
      ...pairs.map((pr) => P.line(pr.g, { x: "x", y: "y", stroke: c.accent, strokeWidth: 9, strokeOpacity: 0.28, strokeLinecap: "round" })),
      ...(EK ? [P.ruleY([state.K], { stroke: c.fg, strokeDasharray: "5,4", strokeOpacity: 0.8 }), P.line(selMu, { x: "x", y: "y", stroke: c.muted, strokeDasharray: "1.5,3", strokeWidth: 1.5 })] : []),
      ...(vague ? [P.ruleY([val(vague)], { stroke: c.methods.vague, strokeDasharray: "6,3", strokeWidth: 1.5 })] : []),
      P.ruleX([state.axis === "r" ? state.r : state.r * state.K], { stroke: c.borderStrong, strokeWidth: 1 }),
      ...(EK ? [P.ruleX(pts, { x: "x", y1: "q10_E_K", y2: "q90_E_K", stroke: (d) => col(d.prior), strokeWidth: 3, strokeOpacity: (d) => (d.sel ? 0.55 : 0.18) })] : []),
      ...shown.flatMap((p) => KS.map((K) => P.line(pts.filter((d) => d.prior === p && d.K_true === K).sort((a, b) => a.x - b.x), { x: "x", y: "y", stroke: col(p), strokeDasharray: DASH[p], strokeWidth: K === state.K ? 2.4 : 1.4, strokeOpacity: K === state.K ? 1 : 0.35 }))),
      P.dot(pts, { x: "x", y: "y", fill: (d) => col(d.prior), fillOpacity: (d) => (d.sel ? 1 : 0.4), stroke: c.fg, strokeWidth: 0.6, strokeOpacity: (d) => (d.sel ? 1 : 0.4), r: (d) => (d.sel ? 5 : 3.6), title: "tip" }),
      P.dot(rejected, { x: "x", frameAnchor: "bottom", dy: -6, symbol: "times", stroke: (d) => col(d.prior), strokeWidth: 2, r: 5, title: (d) => `${d.prior}, K* = ${d.K_true}, r = ${rLabel(d.r)}: calibration rejected at mu_K = ${d.mu_K} (fail-closed), no fits` }),
      // K* labels at the right end of each lead-prior trajectory (on the mu_K axis the trajectories
      // overlap, so only the emphasized K* is labelled)
      P.text(KS.filter((K) => state.axis === "r" || K === state.K).map((K) => pts.filter((d) => d.prior === lead && d.K_true === K).sort((a, b) => b.x - a.x)[0]).filter(Boolean), { x: "x", y: "y", text: (d) => `K* = ${d.K_true}`, dx: 9, textAnchor: "start", fill: c.fg, fontSize: 11 }),
      // the mu_K label on the lead prior's highlight pairs (r axis only)
      ...(state.axis === "r" ? [P.text(pairs.filter((pr) => pr.prior === lead).map((pr) => ({ x: Math.sqrt(pr.g[0].x * pr.g[pr.g.length - 1].x), y: Math.sqrt(pr.g[0].y * pr.g[pr.g.length - 1].y), mu: pr.mu })), { x: "x", y: "y", text: (d) => `same mu_K = ${d.mu}`, dy: -12, fill: c.accentInk, fontSize: 11, fontWeight: 600 })] : []),
      logTickLabels(xTicks, c.fg, (d) => (state.axis === "r" ? rLabel(d) : muLabel(d))),
    ];
    draw(panel, {
      width: w, height: 420, marginLeft: 52, marginRight: 70, marginBottom: 48, marginTop: 24,
      r: { type: "identity" }, // dot r in pixels (the emphasized K* is larger), not a scaled channel
      x: { type: "log", domain: xDom, ticks: xTicks, tickFormat: () => "", label: state.axis === "r" ? "r = mu_K / K* (log scale)" : "the elicited mean mu_K (log scale)", labelOffset: 40, grid: true },
      y: EK ? { type: "log", domain: [1, 62], ticks: [1, 2, 3, 10, 20, 30, 60], tickFormat: (d) => String(d), label: "posterior mean K_J (log scale)", grid: true } : { domain: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)), label: "collapse Pr(K_J = 1 | y)", grid: true },
      marks,
    }, `${EK ? "Posterior mean K_J" : "Collapse"} against ${state.axis === "r" ? "r" : "mu_K"} at I = ${fmt(state.I, 1)} under ${shown.join(", ")}; K* = ${state.K} emphasized: ${chain.map((x, i) => `r = ${rLabel(RS[i])} ${x && fitted(x) ? f(val(x)) : "rejected"}`).join(", ")}.`);
    panel.prepend(h("p", { class: "dpx-panel-title", text: `${EK ? "Posterior mean K_J" : "Collapse"} at I = ${fmt(state.I, 1)}; K* = ${state.K} in full colour${EK ? "; dashed: the true K*, dotted: the elicited mean r K*, bars: 10% to 90% across replications" : ""}; highlighted: cells with the same mu_K` }));
    panel.append(h("p", { class: "dpx-legend" }, ...shown.map((p) => h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${col(p)}` }), `${p} (${DASH_WORD[p]})`)), ...(vague ? [h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.methods.vague}` }), "Vague (dashed; no mu_K)")] : [])));
    panel.append(srTable(`Misspecification grid (medium confidence), I = ${fmt(state.I, 1)}`, ["prior", "K*", "r", "mu_K", "E K", "10%-90%", "collapse", "coverage", "admitted"],
      rows.map((x) => [x.prior, x.K_true, rLabel(x.r), muLabel(x.mu_K), fitted(x) ? fmtCount(x.mean_E_K) : "rejected", fitted(x) ? `${fmtCount(x.q10_E_K)}-${fmtCount(x.q90_E_K)}` : "", fitted(x) ? fmtProb(x.mean_p_K1) : "", fitted(x) ? fmtProb(x.coverage95_K) : "", `${x.n_scientific_eligible}/${x.n_manifest}`])));
    ui.readout.textContent = `${lead}, K* = ${state.K}, I = ${fmt(state.I, 1)}: ${state.metric === "EK" ? "posterior mean K_J" : "collapse"} ${chain.map((x, i) => `${x && fitted(x) ? f(val(x)) : "rejected"} at r = ${rLabel(RS[i])}`).join(", ")}. Same mu_K = 10 at (K* = 5, r = 2) and (K* = 10, r = 1): ${p10.every((x) => x && fitted(x)) ? p10.map((x) => f(val(x))).join(" and ") : "not available"}.`;
    ui.root.dataset.pairs = String(pairs.length);
  };

  const sK = segmented({ label: "True K*", options: KS.map((K) => ({ value: String(K), label: String(K) })), value: String(state.K), onChange: (v) => { state.K = Number(v); render(); } });
  const sI = segmented({ label: "Information I", options: IS.map((I) => ({ value: String(I), label: fmt(I, 1) })), value: String(state.I), onChange: (v) => { state.I = Number(v); render(); } });
  const sMetric = segmented({ label: "Metric", options: [{ value: "EK", label: "posterior mean K_J" }, { value: "collapse", label: "collapse" }], value: state.metric, onChange: (v) => { state.metric = v; render(); } });
  const sAxis = segmented({ label: "Horizontal axis", options: [{ value: "r", label: "r = mu_K / K*" }, { value: "mu", label: "mu_K" }], value: state.axis, onChange: (v) => { state.axis = v; render(); } });
  const sR = slider({ label: "r = mu_K / K*", min: RS[0], max: RS[RS.length - 1], log: true, logStep: Math.log10(RS[1] / RS[0]), value: state.r, format: (v) => rLabel(snapR(v)), onInput: (v) => { state.r = snapR(v); render(); } });
  const tg = PRIORS.map((p) => toggle({ label: p, checked: state.on.has(p), onChange: (v) => { if (v) state.on.add(p); else if (state.on.size > 1) state.on.delete(p); else tg[PRIORS.indexOf(p)].set(true); render(); } }));
  const tV = toggle({ label: "Vague (reference)", checked: state.vague, onChange: (v) => { state.vague = v; render(); } });
  ui.controls.append(sK.root, sI.root, sMetric.root, sAxis.root, sR.root, h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "Priors" }, ...tg.map((t) => t.root), tV.root));
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.preset === "collapse") { state.metric = "collapse"; sMetric.set("collapse"); }
      if (next.preset === "mu") { state.axis = "mu"; sAxis.set("mu"); }
      if (KS.includes(Number(next.K))) { state.K = Number(next.K); sK.set(String(state.K)); }
      if (IS.includes(Number(next.I))) { state.I = Number(next.I); sI.set(String(state.I)); }
      if (next.r) { state.r = snapR(Number(next.r)); sR.set(state.r); }
      render();
    },
    cell(prior, K, I, r) { return cell(prior, K, I, r); },
    destroy() { stop(); el.replaceChildren(); },
  };
}

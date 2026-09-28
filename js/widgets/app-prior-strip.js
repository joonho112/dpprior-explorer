// A-02 "STAR: the prior on K_79 and what the data leave" (paper Table 4). Owner of this file:
// Step 9.3.
//
// For each of the five priors of an application (app_priors.json), the prior pmf of K_J is
// computed here with dp-core (the hard bound, a > 1e4, is nearly a point mass at alpha = a / b), with its
// mean, 90% interval and Pr(W_SB > .5). The posterior summaries are read from the same released
// table and never recomputed: E(K_J | data) with its 95% interval, Pr(K_J = 1 | data) (collapse),
// the largest observed allocation share, the largest population weight and Pr(W_max > .5).
// The prior selector can follow the A-01 caterpillar on the same page (update({ prior })).
import * as dp from "../dp-core.js";
import appPriors from "../../data/released/app_priors.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const PRIORS = ["Vague", "DORO-Unif", "TSMM", "Dual-Anchor", "Dual-Anchor (hard)"];
const APP = { star: "STAR", bd: "Bangert-Drowns" };
const KMAX = 16;

export function mountWidget(el, spec = {}) {
  const app = APP[spec.app] ? spec.app : "star";
  const rows = PRIORS.map((p) => appPriors.find((r) => r.app === APP[app] && r.prior === p)).filter(Boolean);
  const J = rows[0].J;
  const info = rows.map((r) => {
    const pm = r.a > dp.POINT_MASS_A;
    const alpha = r.a / r.b;
    const pmf = dp.mixPmf(J, r.a, r.b);
    let mean = 0;
    for (let k = 1; k <= J; k += 1) mean += k * pmf[k];
    return { ...r, pm, alpha, pmf, mean, lo: dp.pmfQuantile(pmf, 0.05), hi: dp.pmfQuantile(pmf, 0.95), S5: dp.wsbTail(0.5, r.a, r.b) };
  });
  const label = (r) => (r.prior === "Dual-Anchor" && r.lambda != null ? `Dual-Anchor (lambda = ${fmt(r.lambda, 2)})` : r.prior === "Dual-Anchor (hard)" ? "hard bound" : r.prior);
  const prior = (p) => info.find((r) => r.prior === p);
  const state = { prior: PRIORS.includes(spec.prior) ? spec.prior : spec.preset === "da" ? "Dual-Anchor" : spec.preset === "hard" ? "Dual-Anchor (hard)" : "Vague", view: spec.view === "post" ? "post" : "prior" };

  const ui = frame(el, { label: `${APP[app]}: the prior on K_${J} under five hyperpriors and the posterior summaries`, className: "dpx-appstrip" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, panel);
  ui.caption.textContent = `${APP[app]}, J = ${J}. Prior pmfs, means, 90% intervals and Pr(W_SB > .5) computed with dp-core from the released (a, b); posterior summaries (95% intervals) read from app_priors.json. ${captionFor(["read", "kj"])}`;
  let width = 720;

  const tile = (t, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: t }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const r = prior(state.prior);
    const v = prior("Vague");
    tiles.replaceChildren(
      tile(`prior on K_${J}: ${label(r)}`, `${fmtCount(r.mean)} [${r.lo}, ${r.hi}]`, `${r.pm ? `nearly a point mass at alpha = ${r.alpha.toFixed(2)}; ` : ""}mean [90%]; Pr(W_SB > .5) = ${fmtProb(r.S5)}`),
      tile("posterior E(K_J | data) [95%]", `${fmtCount(r.post_EK)} [${r.post_q025_K}, ${r.post_q975_K}]`, r.prior === "Vague" ? "read, not recomputed" : `Vague: ${fmtCount(v.post_EK)}`),
      tile("collapse: Pr(K_J = 1 | data)", fmtProb(r.post_pK1), r.prior === "Vague" ? "one cluster for everything" : `Vague: ${fmtProb(v.post_pK1)}`),
      tile("largest observed share", fmtProb(r.observed_largest_share), `population largest weight ${fmtProb(r.population_largest_weight)}; Pr(W_max > .5) = ${fmtProb(r.p_population_largest_weight_gt_05)}`),
    );
    const w = Math.min(width, 760);
    if (state.view === "prior") {
      const bars = info.flatMap((q) => Array.from({ length: KMAX }, (_, i) => ({ prior: label(q), k: i + 1, p: q.pmf[i + 1], on: q.prior === state.prior, pm: q.pm })));
      draw(panel, {
        width: w, height: 70 * info.length + 50, marginLeft: 150, marginBottom: 36, marginTop: 8,
        x: { domain: [0.5, KMAX + 0.5], label: `k (clusters among J = ${J})`, labelOffset: 30 },
        y: { axis: null },
        fy: { domain: info.map(label), label: null, padding: 0.18 },
        marks: [
          P.rectY(bars, { x1: (d) => d.k - 0.4, x2: (d) => d.k + 0.4, y: "p", fy: "prior", fill: (d) => (d.pm ? c.methods.hard : c.methods.da), fillOpacity: (d) => (d.on ? 0.9 : 0.3) }),
          P.ruleY([0], { stroke: c.borderStrong }),
          P.text(info, { fy: label, frameAnchor: "top-right", text: (q) => `E K ${fmtCount(q.mean)} [${q.lo}, ${q.hi}], S(.5) ${fmtProb(q.S5)}${q.pm ? ", near point mass" : ""}`, dy: 2, dx: -2, fill: c.fg, fontSize: 11, fontWeight: 600 }),
        ],
      }, `Prior pmf of K_${J} under five hyperpriors: ${info.map((q) => `${label(q)} mean ${fmtCount(q.mean)}, 90% [${q.lo}, ${q.hi}], Pr(W_SB > .5) ${fmtProb(q.S5)}`).join("; ")}.`);
      panel.prepend(h("p", { class: "dpx-panel-title", text: `The prior on K_${J}: from Vague to the hard bound the mean rises and dominance falls (${label(r)} highlighted)` }));
    } else {
      const pts = info.flatMap((q) => [
        { prior: label(q), what: "prior mean [90%]", m: q.mean, lo: q.lo, hi: q.hi, on: q.prior === state.prior },
        { prior: label(q), what: "posterior mean [95%]", m: q.post_EK, lo: q.post_q025_K, hi: q.post_q975_K, on: q.prior === state.prior },
      ]);
      // dx / dy are constant options in Plot: one mark per series and one for the selected row
      const pr = pts.filter((d) => d.what.startsWith("prior"));
      const po = pts.filter((d) => !d.what.startsWith("prior"));
      draw(panel, {
        width: w, height: 60 * info.length + 40, marginLeft: 150, marginBottom: 36,
        x: { domain: [0.5, Math.max(...pts.map((d) => d.hi)) + 0.5], label: `K_${J}`, labelOffset: 30, grid: true },
        y: { domain: info.map(label), label: null },
        marks: [
          P.ruleY(pr, { x1: "lo", x2: "hi", y: "prior", dy: -7, stroke: c.slate, strokeWidth: 1.6 }),
          P.dot(pr, { x: "m", y: "prior", dy: -7, fill: c.slate, r: 4 }),
          P.ruleY(po, { x1: "lo", x2: "hi", y: "prior", dy: 7, stroke: c.methods.da, strokeWidth: 1.6 }),
          P.dot(po, { x: "m", y: "prior", dy: 7, fill: c.methods.da, r: 4 }),
          P.ruleY(pr.filter((d) => d.on), { x1: "lo", x2: "hi", y: "prior", dy: -7, stroke: c.slate, strokeWidth: 3.5 }),
          P.ruleY(po.filter((d) => d.on), { x1: "lo", x2: "hi", y: "prior", dy: 7, stroke: c.methods.da, strokeWidth: 3.5 }),
        ],
      }, `Prior mean of K_${J} with its 90% interval against the posterior mean with its 95% interval: ${info.map((q) => `${label(q)} ${fmtCount(q.mean)} -> ${fmtCount(q.post_EK)}`).join("; ")}.`);
      panel.prepend(h("p", { class: "dpx-panel-title", text: `What the data leave: the posterior K_${J} stays below the prior and follows it` }));
      panel.append(h("p", { class: "dpx-legend" },
        h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.slate}` }), "prior mean and 90% interval (above)"),
        h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.methods.da}` }), "posterior mean and 95% interval (below)")));
    }
    panel.append(srTable(`${APP[app]}: prior and posterior K_${J}`, ["hyperprior", "(a, b)", "prior E K [90%]", "Pr(W_SB > .5)", "posterior E K [95%]", "Pr(K = 1 | data)", "largest observed share"],
      info.map((q) => [label(q), q.pm ? `near point mass, alpha = ${q.alpha.toFixed(2)}` : `(${q.a.toFixed(3)}, ${q.b.toFixed(3)})`, `${fmtCount(q.mean)} [${q.lo}, ${q.hi}]`, fmtProb(q.S5), `${fmtCount(q.post_EK)} [${q.post_q025_K}, ${q.post_q975_K}]`, fmtProb(q.post_pK1), fmtProb(q.observed_largest_share)])));
    ui.readout.textContent = `${label(r)}: prior E K_${J} = ${fmtCount(r.mean)} [${r.lo}, ${r.hi}] (the released table says ${fmtCount(r.prior_EK ?? r.mean)}), Pr(W_SB > .5) = ${fmtProb(r.S5)}; posterior E(K | data) = ${fmtCount(r.post_EK)} [${r.post_q025_K}, ${r.post_q975_K}], collapse ${fmtProb(r.post_pK1)}, largest observed share ${fmtProb(r.observed_largest_share)}.`;
    ui.root.dataset.prior = state.prior;
    ui.root.dataset.priorMean = String(r.mean);
    ui.root.dataset.releasedMean = String(r.prior_EK);
  };

  const onPrior = typeof spec.onPrior === "function" ? spec.onPrior : null;
  const setPrior = (p, notify = true) => { state.prior = p; sPrior.set(p); render(); if (notify && onPrior) onPrior(p); };
  const sPrior = segmented({ label: "Prior", options: info.map((q) => ({ value: q.prior, label: label(q) })), value: state.prior, onChange: (p) => setPrior(p) });
  const sView = segmented({ label: "Show", options: [{ value: "prior", label: "prior pmf of K" }, { value: "post", label: "prior vs posterior K" }], value: state.view, onChange: (v) => { state.view = v; render(); } });
  ui.controls.append(sPrior.root, sView.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      const p = next.prior ?? (next.preset === "da" ? "Dual-Anchor" : next.preset === "hard" ? "Dual-Anchor (hard)" : next.preset === "vague" ? "Vague" : null);
      if (next.view === "post" || next.view === "prior") { state.view = next.view; sView.set(state.view); }
      if (p && PRIORS.includes(p)) setPrior(p, false); else render();
    },
    get priors() { return info.map((q) => ({ prior: q.prior, mean: q.mean, released: q.prior_EK, lo: q.lo, hi: q.hi, S5: q.S5, pm: q.pm })); },
    destroy() { stop(); el.replaceChildren(); },
  };
}

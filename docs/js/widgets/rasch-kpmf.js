// A-04 "Vocabulary Rasch: the posterior number of ability groups, K_500" (paper Figure 8).
// Owner of this file: Step 9.5.
//
// The posterior pmf of K_500 (latent ability groups among 500 respondents) under the five priors
// of the main arm (Vague, the literature default Gamma(1, 3), TSMM, Dual-Anchor, the hard bound)
// and the Count-25 sensitivity (TSMM with mu_K = 25), read from rasch_pmf.json; the means and
// 95% intervals are summed from those pmfs, Pr(2 <= K <= 10) is the elicited 80% statement
// checked against each posterior, and E(alpha | y) comes from rasch_posterior.json. Nothing is
// recomputed from the data.
import pmfRows from "../../data/released/rasch_pmf.js";
import post from "../../data/released/rasch_posterior.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, segmented, toggle } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmtCount, fmtProb } from "./format.js";

const FITS = [
  { key: "main/litdef", label: "Gamma(1, 3), literature default", token: "lit" },
  { key: "main/vague", label: "Vague Gamma(1, 1)", token: "vague" },
  { key: "main/tsmm", label: "TSMM", token: "tsmm" },
  { key: "main/dasoft", label: "Dual-Anchor", token: "da" },
  { key: "main/dahard", label: "hard bound (nearly a point mass at alpha = 2)", token: "hard" },
  { key: "sens/tsmm", label: "TSMM, Count-25 (mu_K = 25)", token: "tsmm", sens: true },
];
const ELICITED = { mean: 5, lo: 2, hi: 10 }; // "about five latent groups, between 2 and 10 with 80% probability"

export function mountWidget(el, spec = {}) {
  const fits = FITS.map((f) => {
    const [arm, role] = f.key.split("/");
    const rows = pmfRows.filter((r) => r.arm === arm && r.role === role).sort((p, q) => p.K - q.K);
    const sum = rows.reduce((s, r) => s + r.prob, 0);
    const mean = rows.reduce((s, r) => s + r.K * r.prob, 0);
    let cum = 0;
    let lo = null;
    let hi = null;
    for (const r of rows) { cum += r.prob; if (lo === null && cum >= 0.025 - 1e-12) lo = r.K; if (hi === null && cum >= 0.975 - 1e-12) hi = r.K; }
    const pIn = rows.filter((r) => r.K >= ELICITED.lo && r.K <= ELICITED.hi).reduce((s, r) => s + r.prob, 0);
    const p = post.find((x) => x.arm === arm && x.role === role);
    return { ...f, rows, sum, mean, lo, hi, pIn, alpha: p.alpha_mean, alphaLo: p.alpha_q025, alphaHi: p.alpha_q975, pK1: p.p_K1 };
  });
  const state = { on: new Set(["main/vague", "main/litdef", "main/tsmm", "main/dasoft", "main/dahard"]), sens: spec.preset === "count25", view: spec.view === "multiples" ? "multiples" : "overlay" };
  if (state.sens) state.on.add("sens/tsmm");
  const ui = frame(el, { label: "Vocabulary Rasch application: posterior pmf of K_500 under five priors", className: "dpx-rasch-k" });
  const tiles = h("div", { class: "dpx-tiles", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, panel);
  ui.caption.textContent = `Vocabulary checklist (13 words), N = 500 respondents; K_500 is the number of latent ability groups the mixture uses. Elicited statement: about ${ELICITED.mean} groups, between ${ELICITED.lo} and ${ELICITED.hi} with 80% probability. Posterior pmfs from rasch_pmf.json; means and 95% intervals summed from them; E(alpha | y) from rasch_posterior.json. ${captionFor(["read", "kj"])}`;
  let width = 720;

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const col = { lit: c.methods.lit, vague: c.methods.vague, tsmm: c.methods.tsmm, da: c.methods.da, hard: c.methods.hard };
    const shown = fits.filter((f) => state.on.has(f.key) && (!f.sens || state.sens));
    const kMax = Math.max(12, ...shown.map((f) => f.hi + 2));
    const bars = shown.flatMap((f) => f.rows.filter((r) => r.K <= kMax).map((r) => ({ fit: f.label, K: r.K, p: r.prob, token: f.token, sens: Boolean(f.sens) })));
    tiles.replaceChildren(...shown.map((f) => h("div", { class: "dpx-tile" },
      h("p", { class: "dpx-tile-note", text: f.label }),
      h("p", { class: "dpx-tile-big", text: `${fmtCount(f.mean)} [${f.lo}, ${f.hi}]` }),
      h("p", { class: "dpx-tile-note", text: `mean [95%]; Pr(${ELICITED.lo} <= K <= ${ELICITED.hi}) = ${fmtProb(f.pIn)}; E(alpha | y) = ${f.alpha.toFixed(2)}` }))));
    const w = Math.min(width, 820);
    if (state.view === "overlay") {
      draw(panel, {
        width: w, height: 300, marginLeft: 46, marginBottom: 40,
        x: { domain: [0.5, kMax + 0.5], label: "K_500 (latent ability groups)", labelOffset: 34, ticks: Array.from({ length: kMax }, (_, i) => i + 1).filter((k) => k % 2 === 1 || kMax <= 14) },
        y: { label: "posterior probability", grid: true },
        marks: [
          P.ruleX([ELICITED.mean], { stroke: c.fg, strokeDasharray: "2,3" }),
          ...shown.map((f) => P.line(f.rows.filter((r) => r.K <= kMax), { x: "K", y: "prob", stroke: col[f.token], strokeWidth: 2.2, strokeDasharray: f.sens ? "6,3" : null, curve: "step" })),
          ...shown.map((f) => P.dot(f.rows.filter((r) => r.K <= kMax), { x: "K", y: "prob", fill: col[f.token], r: 3 })),
        ],
      }, `Posterior pmfs of K_500: ${shown.map((f) => `${f.label} mean ${fmtCount(f.mean)}, 95% [${f.lo}, ${f.hi}]`).join("; ")}. Dotted line: the elicited ${ELICITED.mean}.`);
    } else {
      draw(panel, {
        width: w, height: 80 * shown.length + 50, marginLeft: 190, marginBottom: 40,
        x: { domain: [0.5, kMax + 0.5], label: "K_500 (latent ability groups)", labelOffset: 34 },
        y: { axis: null },
        fy: { domain: shown.map((f) => f.label), label: null, padding: 0.2 },
        marks: [
          P.rectY(bars, { x1: (d) => d.K - 0.4, x2: (d) => d.K + 0.4, y: "p", fy: "fit", fill: (d) => col[d.token], fillOpacity: 0.85 }),
          P.ruleX([ELICITED.mean], { stroke: c.fg, strokeDasharray: "2,3" }),
          P.ruleY([0], { stroke: c.borderStrong }),
        ],
      }, `Posterior pmfs of K_500 as small multiples: ${shown.map((f) => `${f.label} mean ${fmtCount(f.mean)}, 95% [${f.lo}, ${f.hi}]`).join("; ")}.`);
    }
    panel.prepend(h("p", { class: "dpx-panel-title", text: `Posterior K_500: the prior moves it from ${fmtCount(Math.min(...shown.map((f) => f.mean)))} to ${fmtCount(Math.max(...shown.map((f) => f.mean)))} groups (dotted: the elicited ${ELICITED.mean})` }));
    panel.append(h("p", { class: "dpx-legend" }, ...shown.map((f) => h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${col[f.token]}` }), `${f.label}${f.sens ? " (dashed)" : ""}`))));
    panel.append(srTable("Posterior K_500 by prior", ["prior", "mean", "95% interval", `Pr(${ELICITED.lo} <= K <= ${ELICITED.hi})`, "P(K = 1)", "E(alpha | y) [95%]", "pmf sum"],
      fits.map((f) => [f.label, fmtCount(f.mean), `[${f.lo}, ${f.hi}]`, fmtProb(f.pIn), fmtProb(f.pK1), `${f.alpha.toFixed(2)} [${f.alphaLo.toFixed(2)}, ${f.alphaHi.toFixed(2)}]`, f.sum.toFixed(8)])));
    ui.readout.textContent = `${shown.map((f) => `${f.label}: ${fmtCount(f.mean)} [${f.lo}, ${f.hi}], E(alpha | y) ${f.alpha.toFixed(2)}`).join("; ")}. 95% posterior intervals.`;
    ui.root.dataset.sums = fits.map((f) => f.sum.toFixed(10)).join(",");
  };

  const onSelect = typeof spec.onSelect === "function" ? spec.onSelect : null; // A-05 follows the checkboxes
  const tg = FITS.filter((f) => !f.sens).map((f) => toggle({ label: f.label, checked: state.on.has(f.key), onChange: (v) => { if (v) state.on.add(f.key); else state.on.delete(f.key); render(); if (onSelect) onSelect([...state.on].filter((k) => k.startsWith("main/"))); } }));
  const tSens = toggle({ label: "Count-25 sensitivity (TSMM, mu_K = 25)", checked: state.sens, onChange: (v) => { state.sens = v; if (v) state.on.add("sens/tsmm"); render(); } });
  const sView = segmented({ label: "View", options: [{ value: "overlay", label: "overlay" }, { value: "multiples", label: "small multiples" }], value: state.view, onChange: (v) => { state.view = v; render(); } });
  ui.controls.append(h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "Priors" }, ...tg.map((t) => t.root)), h("div", { class: "dpx-control dpx-toggle-group" }, tSens.root), sView.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) { if (next.preset === "count25") { state.sens = true; state.on.add("sens/tsmm"); tSens.set(true); } if (next.view) { state.view = next.view; sView.set(next.view); } render(); },
    get fits() { return fits.map((f) => ({ key: f.key, mean: f.mean, lo: f.lo, hi: f.hi, sum: f.sum, pIn: f.pIn, alpha: f.alpha })); },
    destroy() { stop(); el.replaceChildren(); },
  };
}

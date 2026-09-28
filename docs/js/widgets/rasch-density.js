// A-05 "Vocabulary Rasch: the fitted ability distribution and the person scores". Owner of this
// file: Step 9.6.
//
// Top: the fitted density of ability (theta, logits) under each prior, a posterior mean with a 95%
// band (rasch_density.json), and the Gaussian benchmark model in grey (rasch_gaussian.json).
// Bottom: the 500 respondents' Warm WLE scores against their raw scores (rasch_respondents.json,
// anonymous derived values; hover shows raw score, WLE and SE; the 63 perfect scores are
// highlighted), with the score-group WLE and its SE (rasch_wle.json). Tiles: the largest shift of a
// score group's posterior ability from Vague (rasch_posterior.json, .031 logits under Dual-Anchor)
// and of the WLE scores (at most .006): the number of ability groups moves with the prior, the
// person scores do not. The prior checkboxes can follow A-04 on the same page (update({ on })).
import dens from "../../data/released/rasch_density.js";
import gauss from "../../data/released/rasch_gaussian.js";
import wle from "../../data/released/rasch_wle.js";
import people from "../../data/released/rasch_respondents.js";
import post from "../../data/released/rasch_posterior.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, toggle } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt } from "./format.js";

const FITS = [
  { key: "main/litdef", label: "Gamma(1, 3)", wle: "Literature default", token: "lit" },
  { key: "main/vague", label: "Vague", wle: "Vague", token: "vague" },
  { key: "main/tsmm", label: "TSMM", wle: "TSMM", token: "tsmm" },
  { key: "main/dasoft", label: "Dual-Anchor", wle: "Dual-Anchor", token: "da" },
  { key: "main/dahard", label: "hard bound", wle: "Dual-Anchor (hard)", token: "hard" },
];
const STEP = 4; // draw every 4th grid point (0.1 logit)

export function mountWidget(el, spec = {}) {
  const series = Object.fromEntries(FITS.map((f) => { const [arm, role] = f.key.split("/"); return [f.key, dens.filter((r) => r.arm === arm && r.role === role)]; }));
  const lo = Math.min(...dens.filter((r) => r.mean > 1e-3).map((r) => r.x)) - 0.5;
  const hi = Math.max(...dens.filter((r) => r.mean > 1e-3).map((r) => r.x)) + 0.5;
  const thin = (rows) => rows.filter((r, i) => i % STEP === 0 && r.x >= lo && r.x <= hi);
  const ref = new Map(wle.filter((r) => r.role === "Vague").map((r) => [r.raw_score, r]));
  const wleShift = Object.fromEntries(FITS.map((f) => [f.key, Math.max(...wle.filter((r) => r.role === f.wle).map((r) => Math.abs(r.wle - ref.get(r.raw_score).wle)))]));
  const postShift = Object.fromEntries(FITS.map((f) => { const [arm, role] = f.key.split("/"); const p = post.find((x) => x.arm === arm && x.role === role); return [f.key, { d: p.max_abs_delta_r, score: p.max_abs_delta_r_score }]; }));
  const perfect = people.filter((r) => r.perfect);
  // how far each fitted density is from the Vague one, and the Gaussian benchmark from it
  const vagueMean = new Map(series["main/vague"].map((r) => [r.x, r.mean]));
  const densDiff = Object.fromEntries(FITS.map((f) => [f.key, Math.max(...series[f.key].map((r) => Math.abs(r.mean - vagueMean.get(r.x))))]));
  const gaussDiff = Math.max(...gauss.map((r) => Math.abs(r.mean - (vagueMean.get(r.x) ?? r.mean))));
  const seTop = wle.find((r) => r.role === "Dual-Anchor" && r.raw_score === Math.max(...people.map((x) => x.raw_score))).standard_error;
  const state = { on: new Set(FITS.map((f) => f.key)), gauss: spec.preset !== "no-gaussian", people: true };
  // deterministic jitter per respondent (row_id), so the dots do not move between renders
  // (everyone with the same raw score has the same WLE, so the spread is vertical only)
  const jit = (id) => { const s = Math.sin(id * 12.9898) * 43758.5453; return (s - Math.floor(s) - 0.5) * 0.9; };

  const ui = frame(el, { label: "Vocabulary Rasch: fitted ability densities under five priors and the respondents' WLE scores", className: "dpx-rasch-dens" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pD = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pW = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, pD, pW);
  ui.caption.textContent = `Top: fitted ability densities (posterior mean and 95% band) from rasch_density.json and the Gaussian benchmark model (grey) from rasch_gaussian.json. Bottom: ${people.length} respondents' Warm WLE scores (anonymous derived values; hover for the raw score, WLE and SE) with the score-group WLE and SE. ${captionFor(["read"])}`;
  let width = 720;

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const col = { lit: c.methods.lit, vague: c.methods.vague, tsmm: c.methods.tsmm, da: c.methods.da, hard: c.methods.hard };
    const shown = FITS.filter((f) => state.on.has(f.key));
    const da = postShift["main/dasoft"];
    const worst = FITS.reduce((a, f) => (postShift[f.key].d > postShift[a.key].d ? f : a));
    tiles.replaceChildren(
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "largest shift of a score group's posterior ability from Vague" }), h("p", { class: "dpx-tile-big", text: `${fmt(da.d, 3)} logits` }), h("p", { class: "dpx-tile-note", text: `Dual-Anchor (raw score ${da.score}); ${worst.label} ${fmt(postShift[worst.key].d, 3)}` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "largest shift of a WLE score from Vague" }), h("p", { class: "dpx-tile-big", text: `${fmt(Math.max(...shown.map((f) => wleShift[f.key])), 3)} logits` }), h("p", { class: "dpx-tile-note", text: "the person scores are the same" })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "perfect scores" }), h("p", { class: "dpx-tile-big", text: `${perfect.length} of ${people.length}` }), h("p", { class: "dpx-tile-note", text: `WLE SE ${seTop.toFixed(2)} at the top score` })),
      h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: "priors shown" }), h("p", { class: "dpx-tile-big", text: String(shown.length) }), h("p", { class: "dpx-tile-note", text: state.gauss ? "and the Gaussian benchmark (grey)" : "Gaussian benchmark hidden" })),
    );
    const w = Math.min(width, 860);
    const marks = [];
    if (state.gauss) {
      const g = thin(gauss);
      marks.push(P.areaY(g, { x: "x", y1: "lower", y2: "upper", fill: c.slate, fillOpacity: 0.18 }), P.line(g, { x: "x", y: "mean", stroke: c.slate, strokeWidth: 1.5, strokeDasharray: "4,3" }));
    }
    for (const f of shown) {
      const s = thin(series[f.key]);
      marks.push(P.areaY(s, { x: "x", y1: "lower", y2: "upper", fill: col[f.token], fillOpacity: 0.14 }), P.line(s, { x: "x", y: "mean", stroke: col[f.token], strokeWidth: 2 }));
    }
    draw(pD, {
      width: w, height: 240, marginLeft: 46, marginBottom: 36,
      x: { domain: [lo, hi], label: "ability theta (logits)", labelOffset: 30 },
      y: { label: "density", grid: true },
      marks,
    }, `Fitted ability densities under ${shown.map((f) => f.label).join(", ")}${state.gauss ? ", and the Gaussian benchmark" : ""}, with 95% bands.`);
    const dMax = Math.max(...shown.map((f) => densDiff[f.key]));
    pD.prepend(h("p", { class: "dpx-panel-title", text: `The fitted ability distribution: the same shape under every prior (largest difference from Vague ${fmt(dMax, 4)} in density); the Gaussian benchmark is flatter (${fmt(gaussDiff, 3)})` }));
    pD.append(h("p", { class: "dpx-legend" }, ...shown.map((f) => h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${col[f.token]}` }), f.label)),
      state.gauss ? h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.slate}` }), "Gaussian benchmark (dashed, band)") : null));

    // person scores
    const groups = wle.filter((r) => r.role === "Dual-Anchor");
    const pts = state.people ? people.map((r) => ({ ...r, y: r.raw_score + jit(r.row_id) })) : [];
    draw(pW, {
      width: w, height: 300, marginLeft: 46, marginBottom: 36,
      x: { domain: [lo, hi], label: "WLE (logits)", labelOffset: 30 },
      y: { domain: [-0.7, Math.max(...people.map((r) => r.raw_score)) + 0.7], label: "raw score (of 13)", grid: true, ticks: [0, 2, 4, 6, 8, 10, 12, 13] },
      marks: [
        // the SE rules behind, the respondents in the middle, a hollow diamond on top, a count at the right
        P.ruleY(groups, { x1: (g) => g.wle - g.standard_error, x2: (g) => g.wle + g.standard_error, y: "raw_score", stroke: c.muted, strokeWidth: 1.2 }),
        P.dot(pts.filter((r) => !r.perfect), { x: "wle", y: "y", r: 2.2, fill: c.methods.tsmm, fillOpacity: 0.55, title: (r) => `raw score ${r.raw_score}: WLE ${r.wle.toFixed(3)}, SE ${r.se.toFixed(3)}` }),
        P.dot(pts.filter((r) => r.perfect), { x: "wle", y: "y", r: 2.6, fill: c.gold, stroke: c.fg, strokeWidth: 0.4, title: (r) => `perfect score 13: WLE ${r.wle.toFixed(3)}, SE ${r.se.toFixed(3)}` }),
        P.dot(groups, { x: "wle", y: "raw_score", r: 5, fill: "none", stroke: c.fg, strokeWidth: 1.4, symbol: "diamond" }),
        P.text(groups, { x: (g) => g.wle + g.standard_error, y: "raw_score", text: (g) => `n = ${g.n}`, dx: 6, textAnchor: "start", fill: c.muted, fontSize: 10 }),
      ],
    }, `${people.length} respondents' WLE scores by raw score, ${perfect.length} perfect scores highlighted; score-group WLE with plus or minus one SE (SE ${seTop.toFixed(2)} at 13).`);
    pW.prepend(h("p", { class: "dpx-panel-title", text: `The person scores: ${people.length} WLE scores by raw score (black: score-group WLE ± 1 SE; gold: the ${perfect.length} perfect scores)` }));
    pW.append(srTable("Score groups (Dual-Anchor item difficulties)", ["raw score", "n", "WLE", "SE"], groups.map((g) => [g.raw_score, g.n, g.wle.toFixed(3), g.standard_error.toFixed(3)])));
    ui.readout.textContent = `The fitted ability distribution is the same under every prior (largest density difference from Vague ${fmt(Math.max(...Object.values(densDiff)), 4)}), a score group's posterior ability moves by at most ${fmt(postShift[worst.key].d, 3)} logits (${worst.label}; Dual-Anchor ${fmt(da.d, 3)}) and the WLE scores by at most ${fmt(Math.max(...FITS.map((f) => wleShift[f.key])), 3)}; ${perfect.length} of ${people.length} respondents score 13 of 13 (SE ${seTop.toFixed(2)}).`;
  };

  const tg = FITS.map((f) => toggle({ label: f.label, checked: true, onChange: (v) => { if (v) state.on.add(f.key); else state.on.delete(f.key); render(); } }));
  const tG = toggle({ label: "Gaussian benchmark", checked: state.gauss, onChange: (v) => { state.gauss = v; render(); } });
  const tP = toggle({ label: "respondent dots", checked: true, onChange: (v) => { state.people = v; render(); } });
  ui.controls.append(h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "Priors" }, ...tg.map((t) => t.root)), h("div", { class: "dpx-control dpx-toggle-group" }, tG.root, tP.root));
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (Array.isArray(next.on)) { state.on = new Set(next.on.filter((k) => FITS.some((f) => f.key === k))); FITS.forEach((f, i) => tg[i].set(state.on.has(f.key))); }
      render();
    },
    get shifts() { return { post: postShift, wle: wleShift, perfect: perfect.length, seTop }; },
    destroy() { stop(); el.replaceChildren(); },
  };
}

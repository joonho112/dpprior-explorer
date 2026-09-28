// A-03 "Bangert-Drowns: 48 writing-to-learn studies under five priors" (forest). Owner of this
// file: Step 9.4.
//
// Each row is one study: its standardised mean difference with a 95% confidence interval (grey,
// from the released SMD and SE) and its posterior mean with a 95% interval under the selected
// prior (bd_units.json; read, never recomputed). Posterior intervals that exclude 0 are red. The
// diamond is a classical random-effects benchmark (REML), computed here from the released SMDs
// and SEs: it is not a posterior quantity. Header tiles read the application summaries from
// app_priors.json; the elicitation statement is the TSMM target of the paper (tsmm_fits.json).
// The moderator view reads bd_moderator.json: posterior slopes of the study effects on grade and
// on length, a descriptive alignment, not causal moderation.
import bd from "../../data/released/bd_units.js";
import appPriors from "../../data/released/app_priors.js";
import moderators from "../../data/released/bd_moderator.js";
import tsmm from "../../data/precomputed/tsmm_fits.js";
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { frame, h, observeWidth, reducedMotion, segmented, toggle } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const PRIORS = ["Vague", "DORO-Unif", "TSMM", "Dual-Anchor", "Dual-Anchor (hard)"];
const Z = dp.qnorm(0.975); // normal 97.5% point for the raw 95% confidence intervals
const DUR = 650;
const f3 = (x) => x.toFixed(3);

/** REML random-effects benchmark from effects y and standard errors s (Fisher scoring). */
function reml(y, s) {
  const k = y.length;
  const w0 = s.map((x) => 1 / (x * x));
  const sw = w0.reduce((a, b) => a + b, 0);
  const fe = w0.reduce((a, w, i) => a + w * y[i], 0) / sw;
  const Q = w0.reduce((a, w, i) => a + w * (y[i] - fe) ** 2, 0);
  let t2 = Math.max(0, (Q - (k - 1)) / (sw - w0.reduce((a, w) => a + w * w, 0) / sw)); // DerSimonian-Laird start
  for (let it = 0; it < 500; it += 1) {
    const w = s.map((x) => 1 / (x * x + t2));
    const P = w.reduce((a, b) => a + b, 0);
    const mu = w.reduce((a, wi, i) => a + wi * y[i], 0) / P;
    const num = w.reduce((a, wi, i) => a + wi * wi * ((y[i] - mu) ** 2 - s[i] * s[i]), 0);
    const next = Math.max(0, num / w.reduce((a, wi) => a + wi * wi, 0) + 1 / P);
    if (Math.abs(next - t2) < 1e-12) { t2 = next; break; }
    t2 = next;
  }
  const w = s.map((x) => 1 / (x * x + t2));
  const P = w.reduce((a, b) => a + b, 0);
  const mu = w.reduce((a, wi, i) => a + wi * y[i], 0) / P;
  const se = Math.sqrt(1 / P);
  const typical = ((k - 1) * sw) / (sw * sw - w0.reduce((a, x) => a + x * x, 0)); // Higgins-Thompson
  return { mu, lo: mu - Z * se, hi: mu + Z * se, tau2: t2, I2: t2 / (t2 + typical), k };
}

export function mountWidget(el, spec = {}) {
  const d3 = globalThis.d3;
  const units = [...new Set(bd.map((r) => r.unit))].sort((p, q) => p - q);
  const byPrior = Object.fromEntries(PRIORS.map((p) => [p, new Map(bd.filter((r) => r.prior === p).map((r) => [r.unit, r]))]));
  const vague = byPrior.Vague;
  const apps = Object.fromEntries(appPriors.filter((r) => r.app === "Bangert-Drowns").map((r) => [r.prior, r]));
  const target = tsmm.rows.find((r) => r.case === "BD");
  const bench = reml(units.map((u) => vague.get(u).tau_hat), units.map((u) => vague.get(u).se));
  const label = (p) => (p === "Dual-Anchor" && apps[p]?.lambda != null ? `Dual-Anchor (lambda = ${fmt(apps[p].lambda, 2)})` : p === "Dual-Anchor (hard)" ? "hard bound" : p);
  const stats = Object.fromEntries(PRIORS.map((p) => {
    const m = byPrior[p];
    const sh = units.map((u) => m.get(u).posterior_mean - vague.get(u).posterior_mean);
    return [p, { rms: Math.sqrt(sh.reduce((s, x) => s + x * x, 0) / sh.length), excl: units.filter((u) => m.get(u).q025 > 0 || m.get(u).q975 < 0).length }];
  }));
  const state = {
    prior: PRIORS.includes(spec.prior) ? spec.prior : spec.preset === "da" ? "Dual-Anchor" : spec.preset === "hard" ? "Dual-Anchor (hard)" : "Vague",
    sort: ["effect", "se", "id"].includes(spec.sort) ? spec.sort : "effect",
    mods: spec.preset === "moderators",
  };

  const ui = frame(el, { label: `Bangert-Drowns: ${units.length} studies, raw effects and posterior effects under five priors`, className: "dpx-bdforest" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const pMod = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, pMod, panel);
  ui.caption.textContent = `Bangert-Drowns et al. (2004) writing-to-learn meta-analysis, J = ${units.length} studies (data via metadat::dat.bangertdrowns2004). Grey: the reported effect with its 95% confidence interval; coloured: the posterior mean and 95% interval under the selected prior. The diamond is a random-effects (REML) benchmark computed here from the released effects and standard errors. ${captionFor(["read", "kj"])}`;
  const title = h("p", { class: "dpx-panel-title" });
  const svg = d3.create("svg").attr("role", "img");
  const gGrid = svg.append("g");
  const gZero = svg.append("line");
  const gRows = svg.append("g");
  const gBench = svg.append("g");
  const gAxis = svg.append("g");
  const xLab = svg.append("text").attr("text-anchor", "end").attr("font-size", 11);
  const legend = h("p", { class: "dpx-legend" });
  const tbl = h("div");
  panel.append(title, svg.node(), legend, tbl);
  let width = 720;
  let first = true;
  const all = bd.flatMap((r) => [r.q025, r.q975, r.tau_hat - Z * r.se, r.tau_hat + Z * r.se]);
  const xDom = [Math.min(...all), Math.max(...all)];

  const tile = (t, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: t }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);

  const render = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const cur = byPrior[state.prior];
    const a = apps[state.prior];
    const va = apps.Vague;
    const st = stats[state.prior];
    tiles.replaceChildren(
      tile(`prior: ${label(state.prior)}`, a.a > dp.POINT_MASS_A ? `nearly a point mass at alpha = ${(a.a / a.b).toFixed(2)}` : `Gamma(${f3(a.a)}, ${f3(a.b)})`,
        state.prior === "TSMM" ? `from "about ${target.mu_K}, ${target.route.replace("interval ", "")}" at J = ${target.J}` : `TSMM target: about ${target.mu_K}, ${target.route.replace("interval ", "")}`),
      tile("posterior E(K_J | data) [95%]", `${fmtCount(a.post_EK)} [${a.post_q025_K}, ${a.post_q975_K}]`, state.prior === "Vague" ? "read, not recomputed" : `Vague: ${fmtCount(va.post_EK)}`),
      tile("collapse: Pr(K_J = 1 | data)", fmtProb(a.post_pK1), state.prior === "Vague" ? "one cluster for all studies" : `Vague: ${fmtProb(va.post_pK1)}`),
      tile("study effects", `RMS shift ${fmt(st.rms, 4)}`, `${st.excl} of ${units.length} posterior intervals exclude 0`),
    );

    // moderator view: posterior slopes on grade and length under this prior
    if (state.mods) {
      const rows = moderators.filter((r) => r.prior === state.prior);
      pMod.hidden = false;
      draw(pMod, {
        width: Math.min(width, 640), height: 140, marginLeft: 70, marginBottom: 44,
        x: { label: "slope of the study effect per unit of the moderator", labelOffset: 38, grid: true },
        y: { domain: rows.map((r) => r.moderator), label: null },
        marks: [
          P.ruleX([0], { stroke: c.fg, strokeDasharray: "3,3" }),
          P.ruleY(rows, { x1: "posterior_slope_q025", x2: "posterior_slope_q975", y: "moderator", stroke: c.methods.da, strokeWidth: 3 }),
          P.dot(rows, { x: "posterior_slope_mean", y: "moderator", r: 5, fill: c.methods.da }),
          P.dot(rows, { x: "observed_slope", y: "moderator", r: 5, stroke: c.slate, fill: "none", symbol: "diamond" }),
        ],
      }, `Posterior slopes under ${label(state.prior)}: ${rows.map((r) => `${r.moderator} ${f3(r.posterior_slope_mean)} [${f3(r.posterior_slope_q025)}, ${f3(r.posterior_slope_q975)}], Pr(> 0) ${fmtProb(r.posterior_prob_positive)}, observed ${f3(r.observed_slope)}`).join("; ")}.`);
      pMod.prepend(h("p", { class: "dpx-panel-title", text: `Moderators under ${label(state.prior)}: posterior slope (dot, 95% interval) and the unadjusted observed slope (diamond)` }));
      pMod.append(h("p", { class: "dpx-tile-note", text: `${rows.map((r) => `${r.moderator}: Pr(slope > 0) = ${fmtProb(r.posterior_prob_positive)} (${r.complete_units} of ${r.units} studies)`).join("; ")}. Descriptive alignment, not causal moderation; the slopes barely change with the prior.` }));
    } else pMod.hidden = true;

    // the forest
    const order = [...units].sort((p, q) => (state.sort === "id" ? p - q : state.sort === "se" ? vague.get(p).se - vague.get(q).se : vague.get(p).tau_hat - vague.get(q).tau_hat));
    const W = Math.max(300, width);
    const rowH = 11;
    const m = { l: 34, r: 16, t: 8, b: 58 };
    const H = m.t + m.b + rowH * units.length;
    const x = d3.scaleLinear().domain(xDom).nice().range([m.l, W - m.r]);
    const y = d3.scaleBand().domain(order).range([m.t, H - m.b]).padding(0.2);
    const t = reducedMotion() || first ? 0 : DUR;
    const tr = (sel) => (t ? sel.transition().duration(t) : sel);
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).style("color", c.fg);
    gGrid.selectAll("line").data(x.ticks(6)).join("line").attr("x1", (d) => x(d)).attr("x2", (d) => x(d)).attr("y1", m.t).attr("y2", H - m.b + 22).attr("stroke", c.border);
    gZero.attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t).attr("y2", H - m.b + 22).attr("stroke", c.fg).attr("stroke-dasharray", "3,3");
    gAxis.attr("transform", `translate(0,${H - m.b + 24})`).attr("color", c.muted).call(d3.axisBottom(x).ticks(W < 520 ? 4 : 8));
    xLab.attr("x", W - m.r).attr("y", H - 2).attr("fill", c.muted).text("standardised mean difference →");
    const excl = (u) => cur.get(u).q025 > 0 || cur.get(u).q975 < 0;
    const yc = (u) => y(u) + y.bandwidth() / 2;
    const g = gRows.selectAll("g.row").data(units, (u) => u).join((enter) => {
      const e = enter.append("g").attr("class", "row");
      e.append("title");
      e.append("line").attr("class", "raw");
      e.append("rect").attr("class", "rawpt");
      e.append("line").attr("class", "ci");
      e.append("circle").attr("class", "pm");
      return e;
    });
    g.select("title").text((u) => { const r = cur.get(u); return `study ${u} (n = ${r.n_j}): reported ${f3(r.tau_hat)} [${f3(r.tau_hat - Z * r.se)}, ${f3(r.tau_hat + Z * r.se)}]; ${label(state.prior)} ${f3(r.posterior_mean)} [${f3(r.q025)}, ${f3(r.q975)}]`; });
    tr(g.select("line.raw")).attr("x1", (u) => x(cur.get(u).tau_hat - Z * cur.get(u).se)).attr("x2", (u) => x(cur.get(u).tau_hat + Z * cur.get(u).se)).attr("y1", (u) => yc(u) - 2.5).attr("y2", (u) => yc(u) - 2.5).attr("stroke", c.slate).attr("stroke-opacity", 0.55);
    tr(g.select("rect.rawpt")).attr("x", (u) => x(cur.get(u).tau_hat) - 2.2).attr("y", (u) => yc(u) - 4.7).attr("width", 4.4).attr("height", 4.4).attr("fill", c.slate);
    tr(g.select("line.ci")).attr("x1", (u) => x(cur.get(u).q025)).attr("x2", (u) => x(cur.get(u).q975)).attr("y1", (u) => yc(u) + 2).attr("y2", (u) => yc(u) + 2)
      .attr("stroke", (u) => (excl(u) ? c.red : c.methods.da)).attr("stroke-width", (u) => (excl(u) ? 2.2 : 1.6));
    tr(g.select("circle.pm")).attr("cx", (u) => x(cur.get(u).posterior_mean)).attr("cy", (u) => yc(u) + 2).attr("r", 2.8).attr("fill", (u) => (excl(u) ? c.red : c.methods.da));
    const by = H - m.b + 10;
    gBench.selectAll("*").remove();
    gBench.append("path").attr("d", `M${x(bench.lo)},${by} L${x(bench.mu)},${by - 6} L${x(bench.hi)},${by} L${x(bench.mu)},${by + 6} Z`).attr("fill", c.gold).attr("stroke", c.fg).attr("stroke-width", 0.8);
    gBench.append("text").attr("x", x(bench.hi) + 6).attr("y", by + 4).attr("font-size", 11).attr("fill", c.fg).attr("paint-order", "stroke").attr("stroke", c.raised).attr("stroke-width", 3)
      .text(`random effects (REML) ${f3(bench.mu)} [${f3(bench.lo)}, ${f3(bench.hi)}], I² ${(100 * bench.I2).toFixed(1)}%`);
    first = false;
    title.textContent = `${units.length} studies under ${label(state.prior)}, sorted by ${state.sort === "effect" ? "the reported effect" : state.sort === "se" ? "the standard error" : "study number"}`;
    svg.attr("aria-label", `Forest of ${units.length} studies: reported effects with 95% confidence intervals and posterior means with 95% intervals under ${label(state.prior)}; ${st.excl} posterior intervals exclude 0; random-effects benchmark ${f3(bench.mu)} [${f3(bench.lo)}, ${f3(bench.hi)}], I-squared ${(100 * bench.I2).toFixed(1)}%.`);
    legend.replaceChildren(
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.slate}` }), "reported effect, 95% CI"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.methods.da}` }), "posterior mean, 95% interval"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.red}` }), "posterior interval excludes 0"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.gold}` }), "random-effects benchmark (REML)"));
    tbl.replaceChildren(srTable(`Bangert-Drowns under ${label(state.prior)}`, ["study", "n", "reported effect", "SE", "posterior mean", "2.5%", "97.5%"],
      order.map((u) => { const r = cur.get(u); return [u, r.n_j, f3(r.tau_hat), f3(r.se), f3(r.posterior_mean), f3(r.q025), f3(r.q975)]; })));
    ui.readout.textContent = `${label(state.prior)}: posterior E(K | data) = ${fmtCount(a.post_EK)} [${a.post_q025_K}, ${a.post_q975_K}], collapse ${fmtProb(a.post_pK1)}; study effects move by ${fmt(st.rms, 4)} RMS from Vague and ${st.excl} of ${units.length} intervals exclude 0. Random-effects benchmark ${f3(bench.mu)} [${f3(bench.lo)}, ${f3(bench.hi)}], I² ${(100 * bench.I2).toFixed(1)}%.`;
    ui.root.dataset.prior = state.prior;
    ui.root.dataset.excl = String(st.excl);
    ui.root.dataset.pooled = String(bench.mu);
    ui.root.dataset.i2 = String(bench.I2);
  };

  const sPrior = segmented({ label: "Prior", options: PRIORS.map((p) => ({ value: p, label: label(p) })), value: state.prior, onChange: (p) => { state.prior = p; render(); } });
  const sSort = segmented({ label: "Sort by", options: [{ value: "effect", label: "reported effect" }, { value: "se", label: "standard error" }, { value: "id", label: "study number" }], value: state.sort, onChange: (s) => { state.sort = s; render(); } });
  const tMod = toggle({ label: "moderator summary (grade, length)", checked: state.mods, onChange: (v) => { state.mods = v; render(); } });
  ui.controls.append(sPrior.root, sSort.root, h("div", { class: "dpx-control dpx-toggle-group" }, tMod.root));
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      const p = next.prior ?? (next.preset === "da" ? "Dual-Anchor" : next.preset === "hard" ? "Dual-Anchor (hard)" : next.preset === "vague" ? "Vague" : null);
      if (p && PRIORS.includes(p)) { state.prior = p; sPrior.set(p); }
      if (next.sort && ["effect", "se", "id"].includes(next.sort)) { state.sort = next.sort; sSort.set(next.sort); }
      render();
    },
    get benchmark() { return { ...bench }; },
    get stats() { return stats; },
    destroy() { stop(); el.replaceChildren(); },
  };
}

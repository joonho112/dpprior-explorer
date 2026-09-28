// A-01 "STAR: 79 schools under five priors" (caterpillar). Owner of this file: Step 9.2.
//
// School-level posterior means and 95% intervals of the treatment effect from the replication
// package (data/released/star_units.json; read, never recomputed). The prior selector moves every
// school at once with a D3 transition; the sort orders schools by the raw estimate, the posterior
// mean or the school number. "Shift arrows" draws the move from the Vague posterior mean (optionally
// magnified 10x, labelled); schools whose interval excludes 0 are highlighted. Badges (RMS and
// largest shift from Vague, intervals excluding 0) are computed here from the released rows.
// spec.app = "bd" draws the Bangert-Drowns studies from bd_units.json with the same code.
import star from "../../data/released/star_units.js";
import bd from "../../data/released/bd_units.js";
import appPriors from "../../data/released/app_priors.js";
import { palette, srTable } from "./chart.js";
import { frame, h, observeWidth, reducedMotion, segmented, toggle } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt } from "./format.js";

const PRIORS = ["Vague", "DORO-Unif", "TSMM", "Dual-Anchor", "Dual-Anchor (hard)"];
const APPS = {
  star: { data: star, name: "STAR", unit: "school", units: "schools", effect: "school effect (test-score SD)" },
  bd: { data: bd, name: "Bangert-Drowns", unit: "study", units: "studies", effect: "study effect (SMD)" },
};
const DUR = 650;
const f3 = (x) => x.toFixed(3);

export function mountWidget(el, spec = {}) {
  const d3 = globalThis.d3;
  const app = APPS[spec.app] ? spec.app : "star";
  const A = APPS[app];
  const rows = A.data;
  const units = [...new Set(rows.map((r) => r.unit))].sort((p, q) => p - q);
  const byPrior = Object.fromEntries(PRIORS.map((p) => [p, new Map(rows.filter((r) => r.prior === p).map((r) => [r.unit, r]))]));
  const vague = byPrior.Vague;
  const lam = Object.fromEntries(appPriors.filter((r) => r.app === (app === "star" ? "STAR" : "Bangert-Drowns")).map((r) => [r.prior, r.lambda]));
  const label = (p) => (p === "Dual-Anchor" && lam[p] != null ? `Dual-Anchor (lambda = ${fmt(lam[p], 2)})` : p === "Dual-Anchor (hard)" ? "hard bound" : p);
  const state = {
    prior: PRIORS.includes(spec.prior) ? spec.prior : spec.preset === "da" ? "Dual-Anchor" : spec.preset === "hard" ? "Dual-Anchor (hard)" : "Vague",
    sort: ["raw", "mean", "id"].includes(spec.sort) ? spec.sort : "raw",
    arrows: false, magnify: false, raw: true,
  };
  const stats = Object.fromEntries(PRIORS.map((p) => {
    const m = byPrior[p];
    const sh = units.map((u) => m.get(u).posterior_mean - vague.get(u).posterior_mean);
    return [p, { rms: Math.sqrt(sh.reduce((s, x) => s + x * x, 0) / sh.length), max: Math.max(...sh.map(Math.abs)), excl: units.filter((u) => m.get(u).q025 > 0 || m.get(u).q975 < 0).length }];
  }));

  const ui = frame(el, { label: `${A.name}: ${units.length} ${A.units}, posterior means and 95% intervals under five priors`, className: "dpx-caterpillar" });
  const tiles = h("div", { class: "dpx-tiles dpx-tiles-4", style: "grid-column: 1 / -1", "aria-live": "polite" });
  const panel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(tiles, panel);
  ui.caption.textContent = `${A.name}, J = ${units.length} ${A.units}. Dots: posterior means; lines: 95% posterior intervals; hollow rings: the raw estimate. ${captionFor(["read", "kj"])}`;
  const title = h("p", { class: "dpx-panel-title" });
  const svg = d3.create("svg").attr("role", "img");
  const gGrid = svg.append("g");
  const gZero = svg.append("line");
  const gRows = svg.append("g");
  const gAxis = svg.append("g");
  const xLab = svg.append("text").attr("text-anchor", "end").attr("font-size", 11);
  const legend = h("p", { class: "dpx-legend" });
  const tbl = h("div");
  panel.append(title, svg.node(), legend, tbl);
  let width = 720;
  let first = true;

  const all = rows.flatMap((r) => [r.q025, r.q975, r.tau_hat]);
  const xDom = [Math.min(...all), Math.max(...all)];

  const tile = (t, big, note) => h("div", { class: "dpx-tile" }, h("p", { class: "dpx-tile-note", text: t }), h("p", { class: "dpx-tile-big", text: big }), note ? h("p", { class: "dpx-tile-note", text: note }) : null);

  const render = () => {
    const c = palette(ui.root);
    const cur = byPrior[state.prior];
    const st = stats[state.prior];
    const order = [...units].sort((p, q) => (state.sort === "id" ? p - q : state.sort === "mean" ? cur.get(p).posterior_mean - cur.get(q).posterior_mean : vague.get(p).tau_hat - vague.get(q).tau_hat));
    const W = Math.max(300, width);
    const rowH = units.length > 60 ? 7 : 10;
    const m = { l: 34, r: 16, t: 8, b: 34 };
    const H = m.t + m.b + rowH * units.length;
    const x = d3.scaleLinear().domain(xDom).nice().range([m.l, W - m.r]);
    const y = d3.scaleBand().domain(order).range([m.t, H - m.b]).padding(0.15);
    const t = reducedMotion() || first ? 0 : DUR;
    // with no animation (first draw, reduced motion) set attributes at once: a zero-length D3
    // transition would only apply them on a later animation frame
    const tr = (sel) => (t ? sel.transition().duration(t) : sel);
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).style("color", c.fg);
    gGrid.selectAll("line").data(x.ticks(6)).join("line").attr("x1", (d) => x(d)).attr("x2", (d) => x(d)).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", c.border);
    gZero.attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", c.fg).attr("stroke-dasharray", "3,3");
    gAxis.attr("transform", `translate(0,${H - m.b})`).attr("color", c.muted).call(d3.axisBottom(x).ticks(W < 520 ? 4 : 8));
    xLab.attr("x", W - m.r).attr("y", H - 4).attr("fill", c.muted).text(`${A.effect} →`);
    const excl = (u) => cur.get(u).q025 > 0 || cur.get(u).q975 < 0;
    const k = state.magnify ? 10 : 1;
    const g = gRows.selectAll("g.row").data(units, (u) => u).join((enter) => {
      const e = enter.append("g").attr("class", "row");
      e.append("title");
      e.append("line").attr("class", "ci");
      e.append("line").attr("class", "arrow");
      e.append("circle").attr("class", "raw").attr("fill", "none");
      e.append("circle").attr("class", "pm");
      return e;
    });
    g.attr("transform", null);
    const yc = (u) => y(u) + y.bandwidth() / 2;
    g.select("title").text((u) => { const r = cur.get(u); const v = vague.get(u); return `${A.unit} ${u} (n = ${r.n_j}): raw ${f3(r.tau_hat)} (SE ${f3(r.se)}); ${label(state.prior)} mean ${f3(r.posterior_mean)} [${f3(r.q025)}, ${f3(r.q975)}]; shift from Vague ${f3(r.posterior_mean - v.posterior_mean)}`; });
    tr(g.select("line.ci")).attr("x1", (u) => x(cur.get(u).q025)).attr("x2", (u) => x(cur.get(u).q975)).attr("y1", yc).attr("y2", yc)
      .attr("stroke", (u) => (excl(u) ? c.red : c.muted)).attr("stroke-width", (u) => (excl(u) ? 2 : 1.2));
    tr(g.select("circle.raw")).attr("cx", (u) => x(vague.get(u).tau_hat)).attr("cy", yc).attr("r", 2.2)
      .attr("stroke", c.slate).attr("opacity", state.raw ? 0.7 : 0);
    tr(g.select("circle.pm")).attr("cx", (u) => x(cur.get(u).posterior_mean)).attr("cy", yc).attr("r", (u) => (excl(u) ? 3.2 : 2.6))
      .attr("fill", (u) => (excl(u) ? c.red : c.methods.tsmm));
    tr(g.select("line.arrow"))
      .attr("x1", (u) => x(vague.get(u).posterior_mean)).attr("x2", (u) => x(vague.get(u).posterior_mean + k * (cur.get(u).posterior_mean - vague.get(u).posterior_mean)))
      .attr("y1", yc).attr("y2", yc).attr("stroke", c.gold).attr("stroke-width", 3).attr("opacity", state.arrows && state.prior !== "Vague" ? 0.9 : 0);
    first = false;
    title.textContent = `${A.name}: ${units.length} ${A.units} under ${label(state.prior)}, sorted by ${state.sort === "raw" ? "the raw estimate" : state.sort === "mean" ? "the posterior mean" : `${A.unit} number`}`;
    svg.attr("aria-label", `${units.length} ${A.units}: posterior means and 95% intervals under ${label(state.prior)}; ${st.excl} intervals exclude 0; RMS shift from Vague ${fmt(st.rms, 4)}, largest ${fmt(st.max, 3)}.`);
    legend.replaceChildren(...[
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.methods.tsmm}` }), "posterior mean and 95% interval"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.red}` }), "interval excludes 0"),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.slate}` }), "raw estimate (ring)"),
      state.arrows ? h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.gold}` }), `shift from Vague${state.magnify ? ", drawn 10x longer" : ""}`) : null,
    ].filter(Boolean)); // replaceChildren would print a null as the text "null"
    tiles.replaceChildren(
      tile("prior", label(state.prior), `${units.length} ${A.units}`),
      tile("RMS shift of the posterior means from Vague", fmt(st.rms, 4), "school effects barely move"),
      tile("largest |shift| from Vague", fmt(st.max, 3), `${A.effect.split(" (")[0]}`),
      tile("95% intervals excluding 0", `${st.excl} of ${units.length}`, "highlighted in red"),
    );
    tbl.replaceChildren(srTable(`${A.name} under ${label(state.prior)}`, [A.unit, "n", "raw", "posterior mean", "2.5%", "97.5%", "shift from Vague"],
      order.map((u) => { const r = cur.get(u); return [u, r.n_j, f3(r.tau_hat), f3(r.posterior_mean), f3(r.q025), f3(r.q975), f3(r.posterior_mean - vague.get(u).posterior_mean)]; })));
    const others = PRIORS.filter((p) => p !== "Vague");
    const worst = others.reduce((a, p) => (stats[p].rms > stats[a].rms ? p : a));
    ui.readout.textContent = state.prior === "Vague"
      ? `Vague is the reference: the other four priors move the ${A.unit} means by at most ${fmt(stats[worst].rms, 4)} RMS (${label(worst)}, largest single shift ${fmt(stats[worst].max, 3)}); ${st.excl} of ${units.length} intervals exclude 0.`
      : `${label(state.prior)}: posterior means move by ${fmt(st.rms, 4)} RMS from Vague (largest ${fmt(st.max, 3)}); ${st.excl} of ${units.length} intervals exclude 0.`;
    ui.root.dataset.prior = state.prior;
    ui.root.dataset.rms = String(st.rms);
    ui.root.dataset.max = String(st.max);
    ui.root.dataset.excl = String(st.excl);
  };

  const onPrior = typeof spec.onPrior === "function" ? spec.onPrior : null;
  const setPrior = (p, notify = true) => { state.prior = p; sPrior.set(p); render(); if (notify && onPrior) onPrior(p); };
  const sPrior = segmented({ label: "Prior", options: PRIORS.map((p) => ({ value: p, label: label(p) })), value: state.prior, onChange: (p) => setPrior(p) });
  const sSort = segmented({ label: "Sort by", options: [{ value: "raw", label: "raw estimate" }, { value: "mean", label: "posterior mean" }, { value: "id", label: `${A.unit} number` }], value: state.sort,
    onChange: (s) => { state.sort = s; render(); } });
  const tArrow = toggle({ label: "shift arrows from Vague", checked: false, onChange: (v) => { state.arrows = v; render(); } });
  const tMag = toggle({ label: "draw shifts 10x longer", checked: false, onChange: (v) => { state.magnify = v; render(); } });
  const tRaw = toggle({ label: "raw estimates", checked: true, onChange: (v) => { state.raw = v; render(); } });
  ui.controls.append(sPrior.root, sSort.root, h("div", { class: "dpx-control dpx-toggle-group", role: "group", "aria-label": "Show" }, tArrow.root, tMag.root, tRaw.root));

  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) render(); });
  render();
  ready = true;
  return {
    update(next = {}) {
      const p = next.prior ?? (next.preset === "da" ? "Dual-Anchor" : next.preset === "hard" ? "Dual-Anchor (hard)" : next.preset === "vague" ? "Vague" : null);
      if (p && PRIORS.includes(p)) setPrior(p, false); else render();
    },
    get stats() { return stats; },
    destroy() { stop(); el.replaceChildren(); },
  };
}

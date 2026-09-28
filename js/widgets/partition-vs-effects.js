// A-11 "The partition moves, the effects do not" (2 x 3 grid). Owner of this file: Step 9.10.
//
// Columns: Vague, TSMM and Dual-Anchor, fitted to the same data (Project STAR, 79 schools, or
// Bangert-Drowns, 48 studies; primary scale-aligned fits). Top row: the posterior partition, in
// colour because it changes with the prior: either Pr(K_J = 1), Pr(K_J = 2) and Pr(K_J >= 3) as a
// stacked bar (Pr(K_J = 2) is the released Pr(K_J <= 2) minus Pr(K_J = 1)) with E(K_J | y) and its
// 95% interval, or the largest population atom weight with the largest observed share and a .5
// guide. The Vague baseline is drawn as a black outline in the other columns (Giordano's
// convention: the reference in black, colour only for what changes). Bottom row: the unit
// posterior means with 95% intervals, in neutral grey because they barely change (RMS shift from
// Vague .0088 for STAR and .0071 for Bangert-Drowns under Dual-Anchor), in the same order in every
// column. Switching the application or the top view animates the top row only. Everything is read
// from app_sensitivity.json (primary rows), app_priors.json and the unit tables.
import star from "../../data/released/star_units.js";
import bd from "../../data/released/bd_units.js";
import appPriors from "../../data/released/app_priors.js";
import sens from "../../data/released/app_sensitivity.js";
import { palette, srTable } from "./chart.js";
import { frame, h, observeWidth, reducedMotion, segmented } from "./base.js";
import { captionFor } from "./app-captions.js";
import { fmt, fmtCount, fmtProb } from "./format.js";

const COLS = ["Vague", "TSMM", "Dual-Anchor"];
const TOKEN = { Vague: "vague", TSMM: "tsmm", "Dual-Anchor": "da" };
const APPS = {
  star: { data: star, key: "STAR", name: "Project STAR", unit: "school", units: "schools", effect: "school effect (test-score SD)" },
  bd: { data: bd, key: "Bangert-Drowns", name: "Bangert-Drowns", unit: "study", units: "studies", effect: "study effect (SMD)" },
};
const DUR = 600;
const f4 = (x) => fmt(x, 4);

export function mountWidget(el, spec = {}) {
  const d3 = globalThis.d3;
  const state = { app: APPS[spec.app] ? spec.app : "star", view: spec.preset === "weight" ? "weight" : "K", focus: null, pinned: null };
  const ui = frame(el, { label: "The partition moves, the effects do not: posterior partition and unit effects under Vague, TSMM and Dual-Anchor", className: "dpx-pve" });
  const heads = h("div", { class: "dpx-pve-heads", style: "grid-column: 1 / -1", role: "group", "aria-label": "Columns" });
  const top = d3.create("svg").attr("role", "img");
  const bottom = d3.create("svg").attr("role", "img");
  const topWrap = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" }, h("p", { class: "dpx-panel-title", text: "The partition (changes with the prior)" }), top.node());
  const botTitle = h("p", { class: "dpx-panel-title" });
  const badges = h("div", { class: "dpx-pve-badges", "aria-live": "polite" });
  const botWrap = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" }, botTitle, badges, bottom.node());
  const tbl = h("div", { style: "grid-column: 1 / -1" });
  ui.charts.append(heads, topWrap, botWrap, tbl);
  const gTop = top.append("g");
  const gGuide = top.append("g");
  const gBot = bottom.append("g");
  // start from the container's real width: the column heads have pixel widths, and a first paint at
  // the 720 px default overflowed narrow screens until the resize observer fired
  let width = ui.charts.getBoundingClientRect().width || 720;
  let first = true;

  const summaries = (app) => {
    const A = APPS[app];
    return COLS.map((p) => {
      const s = sens.find((r) => r.app === app && r.prior === p && r.spec === "wide_scale");
      const a = appPriors.find((r) => r.app === A.key && r.prior === p);
      return {
        prior: p, EK: s.ref_E_K, lo: s.ref_q025_K, hi: s.ref_q975_K, p1: s.ref_p_K1, p2: s.ref_p_K_le2 - s.ref_p_K1, p3: 1 - s.ref_p_K_le2,
        atom: s.ref_population_largest_atom_weight, share: s.ref_observed_largest_share, excl: s.ref_intervals_excluding_zero,
        rms: a.rms_unit_shift_from_vague, maxShift: a.max_abs_unit_shift_from_vague, lambda: a.lambda,
      };
    });
  };

  const setFocus = (p) => {
    state.focus = p;
    const t = reducedMotion() ? 0 : 200;
    const op = (d) => (state.focus === null || d === state.focus ? 1 : 0.3);
    const cols = gTop.selectAll("g.col");
    (t ? cols.transition("focus").duration(t) : cols).attr("opacity", (d) => op(d.prior));
    gBot.selectAll("g.col").attr("opacity", (d) => op(d));
    heads.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.prior === state.pinned)));
  };

  const render = () => {
    const c = palette(ui.root);
    const A = APPS[state.app];
    const S = summaries(state.app);
    const vague = S[0];
    const t = reducedMotion() || first ? 0 : DUR;
    const tr = (sel) => (t ? sel.transition().duration(t) : sel);
    const W = Math.max(300, Math.min(width, 900));
    const gap = W < 520 ? 10 : 24;
    const colW = (W - 2 * gap) / 3;
    const xCol = (i) => i * (colW + gap);

    // header buttons (keyboard: pin a column)
    heads.replaceChildren(...COLS.map((p, i) => {
      const s = S[i];
      const b = h("button", { type: "button", class: "dpx-seg", "data-prior": p, "aria-pressed": String(state.pinned === p), title: `Emphasize the ${p} column`, style: `width:${colW}px` },
        h("span", { class: "dpx-swatch", style: `background:${c.methods[TOKEN[p]]}` }), p === "Dual-Anchor" && s.lambda != null && colW >= 170 ? `Dual-Anchor (lambda ${fmt(s.lambda, 2)})` : p);
      b.addEventListener("click", () => { state.pinned = state.pinned === p ? null : p; setFocus(state.pinned); });
      b.addEventListener("mouseenter", () => setFocus(p));
      b.addEventListener("mouseleave", () => setFocus(state.pinned));
      return b;
    }));
    heads.style.gap = `${gap}px`;

    // ---- top row: the partition ----
    const H = 250;
    const m = { t: 48, b: 20 };
    top.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
      .attr("aria-label", state.view === "K"
        ? `Posterior Pr(K_J = 1), Pr(K_J = 2), Pr(K_J >= 3) for ${A.name}: ${S.map((s) => `${s.prior} ${fmtProb(s.p1)}, ${fmtProb(s.p2)}, ${fmtProb(s.p3)} (E K ${fmtCount(s.EK)} [${s.lo}, ${s.hi}])`).join("; ")}.`
        : `Largest population atom weight and largest observed share for ${A.name}: ${S.map((s) => `${s.prior} ${fmtProb(s.atom)} and ${fmtProb(s.share)}`).join("; ")}.`);
    const y = d3.scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
    const barW = Math.min(90, colW * 0.42);
    const bx = (i) => xCol(i) + (colW - barW) / 2;
    const segs = (s) => (state.view === "K"
      ? [{ key: "k1", y0: 0, y1: s.p1, op: 1, lab: `K = 1: ${fmtProb(s.p1)}` }, { key: "k2", y0: s.p1, y1: s.p1 + s.p2, op: 0.55, lab: `K = 2: ${fmtProb(s.p2)}` }, { key: "k3", y0: s.p1 + s.p2, y1: 1, op: 0.25, lab: `K >= 3: ${fmtProb(s.p3)}` }]
      : [{ key: "k1", y0: 0, y1: s.atom, op: 1, lab: "" }, { key: "k2", y0: s.atom, y1: s.atom, op: 0, lab: "" }, { key: "k3", y0: s.atom, y1: 1, op: 0.18, lab: "" }]);
    const cols = gTop.selectAll("g.col").data(S, (d) => d.prior).join((en) => en.append("g").attr("class", "col"));
    cols.attr("transform", (d, i) => `translate(${bx(i)},0)`)
      .on("mouseenter", (e, d) => setFocus(d.prior)).on("mouseleave", () => setFocus(state.pinned));
    cols.each(function (s) {
      const g = d3.select(this);
      const col = c.methods[TOKEN[s.prior]];
      g.selectAll("rect.seg").data(segs(s), (d) => d.key).join((en) => en.append("rect").attr("class", "seg").attr("x", 0).attr("y", y(0)).attr("height", 0))
        .attr("width", barW).attr("fill", (d) => (state.view === "weight" && d.key === "k3" ? c.faint : col))
        .call((sel) => tr(sel).attr("y", (d) => y(d.y1)).attr("height", (d) => Math.max(0, y(d.y0) - y(d.y1))).attr("fill-opacity", (d) => d.op));
      // the Vague baseline as a black outline (not in the Vague column)
      const base = s.prior === "Vague" ? [] : segs(vague).filter((d) => d.key !== "k3" && d.y1 > d.y0);
      g.selectAll("rect.base").data(base, (d) => d.key).join("rect").attr("class", "base").attr("x", -3).attr("width", barW + 6)
        .attr("fill", "none").attr("stroke", c.fg).attr("stroke-width", 1.4).attr("stroke-dasharray", "4,2")
        .call((sel) => tr(sel).attr("y", (d) => y(d.y1)).attr("height", (d) => Math.max(0, y(d.y0) - y(d.y1))));
      // observed largest share tick (weight view)
      g.selectAll("line.share").data(state.view === "weight" ? [s] : []).join("line").attr("class", "share")
        .attr("x1", -8).attr("x2", barW + 8).attr("stroke", c.fg).attr("stroke-width", 2.5)
        .call((sel) => tr(sel).attr("y1", y(s.share)).attr("y2", y(s.share)));
      // segment labels to the right of the bar
      const labs = colW < 170 ? [] : segs(s).filter((d) => d.lab && y(d.y0) - y(d.y1) >= 13); // narrow: the heads carry the numbers
      g.selectAll("text.seg").data(labs, (d) => d.key).join("text").attr("class", "seg").attr("x", barW + 8).attr("font-size", 11).attr("fill", c.fg)
        .text((d) => d.lab).call((sel) => tr(sel).attr("y", (d) => (y(d.y0) + y(d.y1)) / 2 + 4));
      const head = state.view === "K" ? [`E K_J ${fmtCount(s.EK)} [${s.lo}, ${s.hi}]`, `Pr(K_J = 1) ${fmtProb(s.p1)}`] : [`largest atom ${fmtProb(s.atom)}`, `observed share ${fmtProb(s.share)}`];
      g.selectAll("text.head").data(head).join("text").attr("class", "head").attr("x", barW / 2).attr("y", (d, i) => 14 + i * 16).attr("text-anchor", "middle")
        .attr("font-size", (d, i) => (i ? 11 : 12)).attr("font-weight", (d, i) => (i ? 400 : 700)).attr("fill", c.fg).text((d) => d);
    });
    // .5 guide in the weight view
    gGuide.selectAll("line").data(state.view === "weight" ? [0.5] : []).join("line").attr("x1", 0).attr("x2", W)
      .attr("y1", y(0.5)).attr("y2", y(0.5)).attr("stroke", c.muted).attr("stroke-dasharray", "2,4");
    gGuide.selectAll("text").data(state.view === "weight" ? [0.5] : []).join("text").attr("x", 0).attr("y", y(0.5) - 4).attr("font-size", 10).attr("fill", c.muted).text(".5");
    topWrap.querySelector(".dpx-panel-title").textContent = state.view === "K"
      ? "The partition changes with the prior: Pr(K_J = 1), Pr(K_J = 2), Pr(K_J >= 3); dashed black outline: Vague"
      : "The partition changes with the prior: largest population atom weight (bar) and largest observed share (black tick); dashed outline: Vague";

    // ---- bottom row: the unit effects (redrawn, not animated) ----
    const rows = A.data;
    const vMap = new Map(rows.filter((r) => r.prior === "Vague").map((r) => [r.unit, r]));
    const order = [...vMap.values()].sort((p, q) => p.posterior_mean - q.posterior_mean).map((r) => r.unit);
    const nU = order.length;
    const HB = Math.max(260, nU * 5.4 + 50);
    const mb = { t: 8, b: 34 };
    const shown = rows.filter((r) => COLS.includes(r.prior));
    const x = d3.scaleLinear().domain(d3.extent(shown.flatMap((r) => [r.q025, r.q975]))).nice().range([0, colW - 8]);
    const yb = d3.scaleBand().domain(order).range([mb.t, HB - mb.b]).padding(0.2);
    bottom.attr("viewBox", `0 0 ${W} ${HB}`).attr("width", W).attr("height", HB)
      .attr("aria-label", `${A.name}: ${nU} ${A.units}' posterior means with 95% intervals under ${COLS.join(", ")}, ordered by the Vague mean; RMS shift from Vague ${S.map((s) => `${s.prior} ${f4(s.rms)}`).join(", ")}.`);
    gBot.selectAll("g.col").data(COLS, (d) => d).join((en) => en.append("g").attr("class", "col"))
      .attr("transform", (d, i) => `translate(${xCol(i) + 4},0)`)
      .on("mouseenter", (e, d) => setFocus(d)).on("mouseleave", () => setFocus(state.pinned))
      .each(function (p) {
        const g = d3.select(this);
        const data = rows.filter((r) => r.prior === p);
        g.selectAll("rect.bg").data([p]).join("rect").attr("class", "bg").attr("x", 0).attr("y", mb.t).attr("width", colW - 8).attr("height", HB - mb.t - mb.b).attr("fill", "transparent");
        g.selectAll("line.zero").data([0]).join("line").attr("class", "zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", mb.t).attr("y2", HB - mb.b).attr("stroke", c.borderStrong);
        g.selectAll("line.ci").data(data, (d) => d.unit).join("line").attr("class", "ci")
          .attr("x1", (d) => x(d.q025)).attr("x2", (d) => x(d.q975)).attr("y1", (d) => yb(d.unit) + yb.bandwidth() / 2).attr("y2", (d) => yb(d.unit) + yb.bandwidth() / 2)
          .attr("stroke", c.muted).attr("stroke-opacity", 0.55).attr("stroke-width", 1);
        g.selectAll("circle.pm").data(data, (d) => d.unit).join("circle").attr("class", "pm")
          .attr("cx", (d) => x(d.posterior_mean)).attr("cy", (d) => yb(d.unit) + yb.bandwidth() / 2).attr("r", Math.max(1.4, Math.min(2.4, yb.bandwidth() / 2))).attr("fill", c.fg);
        g.selectAll("g.axis").data([0]).join("g").attr("class", "axis").attr("transform", `translate(0,${HB - mb.b})`).attr("color", c.muted)
          .call(d3.axisBottom(x).ticks(colW < 200 ? 3 : 5).tickFormat((v) => (v === 0 ? "0" : fmt(v, 1))));
      });
    botTitle.textContent = `The ${A.units}' effects barely move: posterior means and 95% intervals, ${nU} ${A.units} in the Vague order (${A.effect})`;
    badges.replaceChildren(...S.map((s) => h("p", { class: "dpx-tile-note", style: `width:${colW}px`, text: s.prior === "Vague" ? `reference; ${s.excl} intervals exclude 0` : `RMS shift from Vague ${f4(s.rms)}, largest ${fmt(s.maxShift, 3)}; ${s.excl} intervals exclude 0` })));
    badges.style.gap = `${gap}px`;

    ui.caption.textContent = `${A.name}, J = ${nU} ${A.units}, primary scale-aligned fits (read from app_sensitivity.json, app_priors.json and ${state.app === "star" ? "star_units.json" : "bd_units.json"}). Pr(K_J = 2) is the released Pr(K_J <= 2) minus Pr(K_J = 1). ${captionFor(["read", "kj"])}`;
    ui.readout.textContent = `${A.name}: ${S.map((s) => `${s.prior} E K_J ${fmtCount(s.EK)} [${s.lo}, ${s.hi}], Pr(K_J = 1) ${fmtProb(s.p1)}, largest atom ${fmtProb(s.atom)}`).join("; ")}. The unit posterior means move from Vague by RMS ${S.slice(1).map((s) => `${f4(s.rms)} (${s.prior})`).join(" and ")}.`;
    tbl.replaceChildren(srTable(`${A.name}: partition and unit effects by prior`, ["prior", "E K_J [95%]", "Pr(K = 1)", "Pr(K = 2)", "Pr(K >= 3)", "largest atom", "largest observed share", "RMS unit shift from Vague", "intervals excluding 0"],
      S.map((s) => [s.prior, `${fmtCount(s.EK)} [${s.lo}, ${s.hi}]`, fmtProb(s.p1), fmtProb(s.p2), fmtProb(s.p3), fmtProb(s.atom), fmtProb(s.share), f4(s.rms), s.excl])));
    ui.root.dataset.rms = S.map((s) => f4(s.rms)).join(",");
    setFocus(state.pinned);
    first = false;
  };

  const sApp = segmented({ label: "Application", options: [{ value: "star", label: "Project STAR (79 schools)" }, { value: "bd", label: "Bangert-Drowns (48 studies)" }], value: state.app, onChange: (v) => { state.app = v; render(); } });
  const sView = segmented({ label: "Top row", options: [{ value: "K", label: "K_J = 1, 2, 3 or more" }, { value: "weight", label: "largest weight" }], value: state.view, onChange: (v) => { state.view = v; render(); } });
  ui.controls.append(sApp.root, sView.root);
  let ready = false;
  const stop = observeWidth(ui.charts, (wd) => { width = wd; if (ready) { first = true; render(); } });
  render();
  ready = true;
  return {
    update(next = {}) {
      if (APPS[next.app]) { state.app = next.app; sApp.set(next.app); }
      if (next.preset === "weight" || next.preset === "K") { state.view = next.preset; sView.set(next.preset); }
      render();
    },
    focus(p) { state.pinned = COLS.includes(p) ? p : null; setFocus(state.pinned); },
    get summaries() { return summaries(state.app); },
    destroy() { stop(); el.replaceChildren(); },
  };
}

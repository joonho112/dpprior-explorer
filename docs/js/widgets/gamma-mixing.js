// C-12 "Gamma mixing: nodes -> marginal pmf". Owner of this file: Step 5.4; Step 8.12 imports it.
//
// Under alpha ~ Gamma(a, b) the marginal pmf of K_J is a prior-weighted average of the
// conditional pmfs P(K_J = k | alpha). This widget cuts log alpha into n equal slices between
// the 1e-6 and 1 - 1e-6 prior quantiles (the two end slices keep the tails), puts one node at
// each slice centre and gives it the prior probability of its slice. Each thin line is one
// node's pmf, drawn as dark as that probability; the thick line is their sum. The error of
// this midpoint rule shrinks like 1/n^2. The dashed line is the engine's exact mixture
// (CONTRACT.md section 6), which uses a finer grid with end corrections.
import * as dp from "../dp-core.js";
import { palette, srTable } from "./chart.js";
import { frame, h, num, observeWidth, reducedMotion, segmented, slider } from "./base.js";
import { fmt, fmtAlpha, fmtCount, fmtGamma, fmtProb } from "./format.js";

const PRESETS = [
  { key: "g11", label: "Gamma(1, 1)", a: 1, b: 1 },
  { key: "fig1", label: "Gamma(1.60, 1.22)", a: 1.6, b: 1.22 },
];
const TAIL = 1e-6; // the didactic grid spans the TAIL and 1 - TAIL prior quantiles of alpha
const COARSE = 20; // the error panel's scale is the error of the coarsest grid
const MOVE_MS = 700;

/** n slice-centre nodes on log alpha; weight = prior probability of the slice (they sum to 1). */
export function sliceNodes(a, b, n) {
  const lo = Math.log(dp.qgamma(TAIL, a, b));
  const hi = Math.log(dp.qgamma(1 - TAIL, a, b));
  const step = (hi - lo) / n;
  const nodes = [];
  let below = 0;
  for (let i = 0; i < n; i += 1) {
    const upto = i === n - 1 ? 1 : dp.pgamma(Math.exp(lo + step * (i + 1)), a, b);
    nodes.push({ i, alpha: Math.exp(lo + step * (i + 0.5)), w: upto - below });
    below = upto;
  }
  return { nodes, lo, hi };
}

/** Weighted sum of the nodes' conditional pmfs (each node keeps its pmf and mean). */
export function mixNodes(J, nodes) {
  const pmf = new Float64Array(J + 1);
  let mean = 0;
  for (const nd of nodes) {
    nd.p = dp.condPmf(J, nd.alpha);
    nd.mean = dp.condMean(J, nd.alpha);
    for (let k = 1; k <= J; k += 1) pmf[k] += nd.w * nd.p[k];
    mean += nd.w * nd.mean;
  }
  return { pmf, mean };
}

const l1 = (p, q, J) => {
  let s = 0;
  for (let k = 1; k <= J; k += 1) s += Math.abs(p[k] - q[k]);
  return s;
};
const fmtSmall = (x) => (x >= 0.001 ? fmt(x, 3) : x.toExponential(1));

export function mountWidget(el, spec = {}) {
  const d3 = globalThis.d3;
  if (!d3) throw new Error("D3 is not loaded (js/vendor/d3.min.js)");
  const state = {
    a: num(spec, "a", 1, 0.05, 50),
    b: num(spec, "b", 1, 0.05, 50),
    J: Math.round(num(spec, "J", 100, 10, 500)),
    n: Math.round(num(spec, "n", COARSE, COARSE, 400)),
    mixed: spec.preset !== "fixed",
    sel: null,
  };
  const ui = frame(el, { label: "Gamma mixing: the conditional pmfs of K_J at alpha nodes add up to the marginal pmf", className: "dpx-mixing" });
  const clipId = `dpx-clip-${Math.random().toString(36).slice(2, 9)}`;
  const main = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const errPanel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const stripPanel = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const hover = h("p", { class: "dpx-caption-note dpx-hover-note", "aria-live": "polite" });
  const legend = h("p", { class: "dpx-legend" });
  ui.charts.append(main, stripPanel, errPanel);
  ui.caption.textContent =
    "Thin lines: P(K_J = k | alpha) at one alpha node each, as dark as the prior probability of the node's slice of log alpha. Thick line: their weighted sum. Dashed: the exact marginal pmf. K_J is the number of fitted components among the J units; prior statements.";

  // main chart: persistent layers so the thick line can move and the thin lines can fade
  const title = h("p", { class: "dpx-panel-title" });
  const svg = d3.create("svg").attr("role", "img");
  svg.append("clipPath").attr("id", clipId).append("rect");
  const gX = svg.append("g");
  const gY = svg.append("g");
  const xLabel = svg.append("text").attr("text-anchor", "end").attr("font-size", 11);
  const yLabel = svg.append("text").attr("font-size", 11).attr("x", 4).attr("y", 10).text("P(K_J = k)");
  const gThin = svg.append("g").attr("clip-path", `url(#${clipId})`).attr("fill", "none");
  const pExact = svg.append("path").attr("fill", "none").attr("stroke-width", 1.6).attr("stroke-dasharray", "5,4");
  const pMain = svg.append("path").attr("fill", "none").attr("stroke-width", 3.4).attr("clip-path", `url(#${clipId})`);
  const pSel = svg.append("path").attr("fill", "none").attr("stroke-width", 2.4).attr("clip-path", `url(#${clipId})`).attr("pointer-events", "none");
  const table = h("div");
  main.append(title, svg.node(), legend, hover, table);

  // node strip: prior density on log alpha with one tick per node (hover or arrow keys)
  const stripTitle = h("p", { class: "dpx-panel-title", text: "Prior on alpha (log scale): one tick per node, height = its weight" });
  const strip = d3.create("svg").attr("tabindex", 0).attr("role", "slider").attr("aria-label", "Inspect one alpha node (left and right arrows)");
  const sArea = strip.append("path");
  const sTicks = strip.append("g");
  const sAxis = strip.append("g");
  stripPanel.append(stripTitle, strip.node());

  // error panel: mixture minus exact, per k, on the scale of the 20-node error
  const errTitle = h("p", { class: "dpx-panel-title" });
  const err = d3.create("svg").attr("role", "img");
  const eBars = err.append("g");
  const eZero = err.append("line");
  const eAxis = err.append("g");
  errPanel.append(errTitle, err.node());

  let width = 720;
  let last = null; // the most recent computation, for hover and keys

  const describeNode = (nd) => {
    const dist = l1(nd.p, last.exact, last.J);
    return `Node ${nd.i + 1} of ${last.nodes.length}: alpha = ${fmtAlpha(nd.alpha)}, prior probability of its slice ${nd.w >= 0.0005 ? fmtProb(nd.w) : nd.w.toExponential(1)}; E(K_J | alpha) = ${fmtCount(nd.mean)}; L1 distance of this one pmf from the marginal = ${fmt(dist, 2)}.`;
  };
  const select = (i) => {
    if (!last) return;
    state.sel = i === null ? null : Math.max(0, Math.min(last.nodes.length - 1, i));
    const c = last.c;
    if (state.sel === null) {
      pSel.attr("d", null);
      hover.textContent = "Hover over the thin lines or the ticks below (or focus the tick strip and use the arrow keys) to inspect one alpha node.";
      strip.attr("aria-valuenow", null).attr("aria-valuetext", "no node selected");
    } else {
      const nd = last.nodes[state.sel];
      pSel.attr("d", last.line(Array.from(nd.p.subarray(1, last.kmax + 1)))).attr("stroke", c.red);
      hover.textContent = describeNode(nd);
      strip.attr("aria-valuenow", state.sel + 1).attr("aria-valuetext", `node ${state.sel + 1}, alpha ${fmtAlpha(nd.alpha)}`);
    }
    sTicks.selectAll("line").attr("stroke", (d) => (d.i === state.sel ? c.red : c.slate)).attr("stroke-width", (d) => (d.i === state.sel ? 2.5 : 1));
  };

  const render = (animate = false) => {
    const t0 = performance.now();
    const c = palette(ui.root);
    const { a, b, J, n, mixed } = state;
    const { nodes, lo, hi } = sliceNodes(a, b, n);
    const mix = mixNodes(J, nodes);
    const exact = dp.mixPmf(J, a, b);
    const mom = dp.mixMoments(J, a, b);
    const dist = l1(mix.pmf, exact, J);
    const coarse = n === COARSE ? mix.pmf : mixNodes(J, sliceNodes(a, b, COARSE).nodes).pmf;
    const aMean = a / b;
    const fixed = dp.condPmf(J, aMean);
    let cum = 0;
    let kmax = J;
    for (let k = 1; k <= J; k += 1) {
      cum += exact[k];
      if (cum >= 0.995) { kmax = k; break; }
    }
    kmax = Math.min(J, Math.max(12, kmax + 1));
    const ks = d3.range(1, kmax + 1);
    let scale = 0;
    for (let k = 1; k <= J; k += 1) scale = Math.max(scale, Math.abs(coarse[k] - exact[k]));
    scale = Math.max(1e-3, scale * 1.1);

    // main chart
    const W = width;
    const H = 280;
    const m = { l: 48, r: 14, t: 16, b: 36 };
    const x = d3.scaleLinear().domain([1, kmax]).range([m.l, W - m.r]);
    const peak = Math.max(d3.max(ks, (k) => exact[k]), d3.max(ks, (k) => mix.pmf[k]), d3.max(ks, (k) => fixed[k]));
    const y = d3.scaleLinear().domain([0, Math.min(1, peak * 1.3)]).nice().range([H - m.b, m.t]);
    const line = d3.line().x((_, i) => x(i + 1)).y((v) => y(v));
    last = { c, nodes, exact, J, kmax, line };
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg.select(`#${clipId} rect`).attr("x", m.l).attr("y", m.t - 2).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b + 2);
    gX.attr("transform", `translate(0,${H - m.b})`).attr("color", c.muted).call(d3.axisBottom(x).ticks(Math.min(kmax - 1, 12)).tickFormat(d3.format("d")));
    gY.attr("transform", `translate(${m.l},0)`).attr("color", c.muted).call(d3.axisLeft(y).ticks(5).tickFormat((v) => fmt(v, 2)));
    xLabel.attr("x", W - m.r).attr("y", H - 4).attr("fill", c.muted).text(`k (clusters among J = ${J})`);
    yLabel.attr("fill", c.muted);
    const wMax = d3.max(nodes, (d) => d.w);
    const thinWidth = n > 100 ? 1 : 1.4;
    const target = (d) => (mixed ? Math.max(0.05, 0.9 * (d.w / wMax)) : 0);
    const thin = gThin.selectAll("path").data(nodes, (d) => d.i).join((enter) => enter.append("path").attr("stroke-opacity", 0))
      .attr("d", (d) => line(Array.from(d.p.subarray(1, kmax + 1))))
      .attr("stroke", c.slate).attr("stroke-width", thinWidth).attr("pointer-events", mixed ? "stroke" : "none")
      .on("pointerenter", (_, d) => select(d.i));
    const move = animate && !reducedMotion();
    if (move) thin.transition().duration(MOVE_MS).attr("stroke-opacity", target);
    else thin.interrupt().attr("stroke-opacity", target);
    const mainPmf = mixed ? mix.pmf : fixed;
    const mainD = line(ks.map((k) => mainPmf[k]));
    pExact.attr("d", line(ks.map((k) => exact[k]))).attr("stroke", c.fg);
    pMain.attr("stroke", mixed ? c.teal : c.blue);
    if (move && pMain.attr("d")) pMain.transition().duration(MOVE_MS).attr("d", mainD);
    else pMain.interrupt().attr("d", mainD);
    title.textContent = mixed
      ? `${n} alpha nodes under ${fmtGamma(a, b)} → the marginal pmf of K_${J}`
      : `One alpha = E(alpha) = ${fmtAlpha(aMean)}, no mixing: the pmf is too narrow`;
    svg.attr("aria-label", mixed
      ? `${n} conditional pmfs of K_${J} and their weighted sum: mean ${fmtCount(mix.mean)} against the exact ${fmtCount(mom.mean)}; L1 distance ${fmtSmall(dist)}.`
      : `The pmf of K_${J} at the single alpha ${fmtAlpha(aMean)} (mean ${fmtCount(dp.condMean(J, aMean))}) against the exact marginal pmf (mean ${fmtCount(mom.mean)}).`);
    legend.replaceChildren(
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${mixed ? c.teal : c.blue};height:0.3rem` }), mixed ? `sum of ${n} nodes` : `alpha fixed at ${fmtAlpha(aMean)}`),
      h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:repeating-linear-gradient(90deg, ${c.fg} 0 5px, transparent 5px 9px)` }), "exact marginal"),
      mixed ? h("span", { class: "dpx-legend-item" }, h("span", { class: "dpx-swatch", style: `background:${c.slate};height:0.12rem` }), "one node") : null,
    );
    table.replaceChildren(srTable(`P(K_${J} = k): ${mixed ? `sum of ${n} nodes` : `alpha = ${fmtAlpha(aMean)}`} and exact marginal`, ["k", mixed ? "node sum" : "fixed alpha", "exact"],
      ks.map((k) => [k, fmtProb(mainPmf[k]), fmtProb(exact[k])])));

    // node strip
    const SH = 76;
    const sm = { l: m.l, r: m.r, t: 6, b: 22 };
    const sx = d3.scaleLog().domain([Math.exp(lo), Math.exp(hi)]).range([sm.l, W - sm.r]);
    const dens = d3.range(0, 161).map((i) => { const al = Math.exp(lo + ((hi - lo) * i) / 160); return [al, Math.exp(dp.dgammaLog(al, a, b)) * al]; });
    const dMax = d3.max(dens, (d) => d[1]);
    const sy = d3.scaleLinear().domain([0, dMax]).range([SH - sm.b, sm.t]);
    strip.attr("viewBox", `0 0 ${W} ${SH}`).attr("width", W).attr("height", SH)
      .attr("aria-valuemin", 1).attr("aria-valuemax", n);
    sArea.attr("d", d3.area().x((d) => sx(d[0])).y0(SH - sm.b).y1((d) => sy(d[1]))(dens)).attr("fill", c.slate).attr("fill-opacity", 0.18);
    sTicks.selectAll("line").data(nodes, (d) => d.i).join("line")
      .attr("x1", (d) => sx(d.alpha)).attr("x2", (d) => sx(d.alpha))
      .attr("y1", SH - sm.b).attr("y2", (d) => SH - sm.b - Math.max(2, (SH - sm.t - sm.b) * (d.w / wMax)));
    sAxis.attr("transform", `translate(0,${SH - sm.b})`).attr("color", c.muted)
      .call(d3.axisBottom(sx).ticks(6, "~g").tickSizeOuter(0));
    strip.on("pointermove", (ev) => {
      const [px] = d3.pointer(ev);
      const lx = Math.log(sx.invert(Math.max(sm.l, Math.min(W - sm.r, px))));
      select(Math.floor(((lx - lo) / (hi - lo)) * n));
    });

    // error panel
    const EH = 110;
    const em = { l: m.l, r: m.r, t: 8, b: 20 };
    const ex = d3.scaleBand().domain(ks).range([em.l, W - em.r]).padding(0.25);
    const ey = d3.scaleLinear().domain([-scale, scale]).range([EH - em.b, em.t]);
    err.attr("viewBox", `0 0 ${W} ${EH}`).attr("width", W).attr("height", EH)
      .attr("aria-label", `Node sum minus exact marginal, per k: largest absolute gap ${fmtSmall(d3.max(ks, (k) => Math.abs(mix.pmf[k] - exact[k])))}; the scale is fixed at the ${COARSE}-node gap, ${fmtSmall(scale / 1.1)}.`);
    const gap = (k) => Math.max(-scale, Math.min(scale, mix.pmf[k] - exact[k]));
    eBars.selectAll("rect").data(ks).join("rect")
      .attr("x", (k) => ex(k)).attr("width", ex.bandwidth())
      .attr("y", (k) => ey(Math.max(0, gap(k))))
      .attr("height", (k) => Math.abs(ey(gap(k)) - ey(0)))
      .attr("fill", (k) => (mix.pmf[k] >= exact[k] ? c.teal : c.red));
    eZero.attr("x1", em.l).attr("x2", W - em.r).attr("y1", ey(0)).attr("y2", ey(0)).attr("stroke", c.borderStrong);
    eAxis.attr("transform", `translate(${em.l},0)`).attr("color", c.muted)
      .call(d3.axisLeft(ey).ticks(3).tickFormat((v) => (v === 0 ? "0" : v.toExponential(0))));
    errTitle.textContent = `Node sum minus exact, per k (scale fixed at the ${COARSE}-node gap; L1 = ${fmtSmall(dist)})`;
    errPanel.hidden = !mixed;
    stripPanel.hidden = !mixed;

    ui.readout.textContent = mixed
      ? `${fmtGamma(a, b)}, J = ${J}, ${n} nodes: node-sum E K_J = ${fmt(mix.mean, 3)} (exact ${fmt(mom.mean, 3)}); L1 distance to the exact marginal pmf = ${fmtSmall(dist)}. Doubling the nodes cuts the gap about fourfold.`
      : `One alpha = ${fmtAlpha(aMean)} (the prior mean of alpha): E K_J = ${fmtCount(dp.condMean(J, aMean))}, Var ${fmt(dp.condVar(J, aMean), 1)}. Mixing over ${fmtGamma(a, b)} gives E K_J = ${fmtCount(mom.mean)}, Var ${fmt(mom.var, 1)}: the prior on alpha widens the pmf.`;
    if (state.sel !== null && state.sel >= n) state.sel = n - 1;
    select(mixed ? state.sel : null);
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.l1 = String(dist);
    ui.root.dataset.meanMix = String(mix.mean);
  };

  strip.on("keydown", (ev) => {
    if (!last) return;
    const n = last.nodes.length;
    const cur = state.sel ?? Math.floor(n / 2) - 1;
    const stepBy = ev.shiftKey ? 10 : 1;
    const to = { ArrowRight: cur + stepBy, ArrowUp: cur + stepBy, ArrowLeft: cur - stepBy, ArrowDown: cur - stepBy, Home: 0, End: n - 1 }[ev.key];
    if (to === undefined) return;
    ev.preventDefault();
    select(to);
  });

  const modeSeg = segmented({ label: "alpha", options: [{ value: true, label: "Gamma(a, b): mix the nodes" }, { value: false, label: "one alpha = E(alpha)" }], value: state.mixed,
    onChange: (v) => { state.mixed = v; render(true); } });
  const presetSeg = segmented({ label: "Presets", options: PRESETS.map((p) => ({ value: p.key, label: p.label })), value: PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null,
    onChange: (v) => { const p = PRESETS.find((q) => q.key === v); state.a = p.a; state.b = p.b; sa.set(p.a); sb.set(p.b); render(true); } });
  const sN = slider({ label: "alpha nodes", min: COARSE, max: 400, step: 1, value: state.n, format: (v) => String(Math.round(v)), onInput: (v) => { state.n = Math.round(v); render(); } });
  const sa = slider({ label: "a (shape)", min: 0.05, max: 50, value: state.a, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.a = v; presetSeg.set(null); render(); } });
  const sb = slider({ label: "b (rate)", min: 0.05, max: 50, value: state.b, log: true, format: (v) => v.toFixed(2), onInput: (v) => { state.b = v; presetSeg.set(null); render(); } });
  const sJ = slider({ label: "J (units)", min: 10, max: 500, step: 1, value: state.J, format: (v) => String(Math.round(v)), onInput: (v) => { state.J = Math.round(v); render(); } });
  ui.controls.append(modeSeg.root, presetSeg.root, sN.root, sa.root, sb.root, sJ.root);
  const stop = observeWidth(ui.charts, (w) => { width = w; render(); });
  render(true);
  return {
    update(next = {}) {
      if (next.a !== undefined) { state.a = num(next, "a", state.a, 0.05, 50); sa.set(state.a); }
      if (next.b !== undefined) { state.b = num(next, "b", state.b, 0.05, 50); sb.set(state.b); }
      if (next.J !== undefined) { state.J = Math.round(num(next, "J", state.J, 10, 500)); sJ.set(state.J); }
      if (next.n !== undefined) { state.n = Math.round(num(next, "n", state.n, COARSE, 400)); sN.set(state.n); }
      if (next.preset === "fixed" || next.preset === "mix") { state.mixed = next.preset === "mix"; modeSeg.set(state.mixed); }
      presetSeg.set(PRESETS.find((p) => p.a === state.a && p.b === state.b)?.key ?? null);
      render(true);
    },
    select,
    destroy() { stop(); el.replaceChildren(); },
  };
}

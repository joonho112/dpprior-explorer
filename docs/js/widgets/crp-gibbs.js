// P-13 "A collapsed Gibbs sampler for the CRP mixture" (after Broderick, MLSS 2016 part III,
// demo 7; re-implemented on dp-core gibbs.ts). Owner of this file: Step 6.9.
//
// One point at a time: take it out, then choose its cluster with probability proportional to
// (CRP prior weight) x (fit): n_c N(x | m_c, ...) for an existing cluster c, alpha N(x | 0, ...)
// for a new one. The two bars show the prior weights and the resulting posterior for the point
// marked with a large X. Broderick's demo fixes alpha = 0.01; the live slider shows how strong
// a prior that is: a new cluster costs one hundredth of a one-point cluster.
import * as dp from "../dp-core.js";
import { colourSlots, draw, palette } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, reducedMotion, segmented, slider, toggle } from "./base.js";
import { fmt, fmtAlpha, fmtProb } from "./format.js";

const SPEEDS = { slow: 200, normal: 40, fast: 4 }; // ms per point
const SIGMA = 1;
const SIGMA0 = 3;
const INITS = [{ value: "one", label: "one cluster" }, { value: "singletons", label: "singletons" }, { value: "random", label: "random (10)" }];

export function mountWidget(el, spec = {}) {
  const state = {
    alpha: num(spec, "alpha", 0.01, 0.01, 10),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    init: ["one", "singletons", "random"].includes(spec.preset) ? spec.preset : "one",
    truth: true,
    playing: false,
    speed: "normal",
    next: 0,
  };
  const { points } = dp.demoData(state.seed);
  let st = null;
  let last = null;
  let timer = 0;
  const ui = frame(el, { label: "Collapsed Gibbs sampler for a Dirichlet process mixture: prior weight times fit, one point at a time", className: "dpx-gibbs" });
  const pScatter = h("div", { class: "dpx-panel" });
  const pSide = h("div", { class: "dpx-panel" });
  ui.charts.append(pScatter, pSide);
  const scTitle = h("p", { class: "dpx-panel-title" });
  const d3 = globalThis.d3;
  const svg = d3.create("svg").attr("role", "img");
  const gTruth = svg.append("g");
  const gPts = svg.append("g");
  const gMeans = svg.append("g");
  const gX = svg.append("g");
  pScatter.append(scTitle, svg.node());
  const barBox = h("div");
  const traceBox = h("div");
  const note = h("p", { class: "dpx-caption-note", "aria-live": "polite" });
  pSide.append(barBox, note, traceBox);
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part III). Data: 100 points from four clusters at (+-3, +-3) with weights 5/11, 3/11, 2/11, 1/11 and sd 1; the sampler uses sigma = 1 and a N(0, 3^2) prior on cluster centres. A cluster keeps its colour while it lives; beyond six clusters the extra ones are drawn as rings and take a plain colour as soon as one is free, so up to six clusters never share a colour and up to twelve never look alike. Colours have no meaning of their own. Seeded.";
  let width = 720;
  const half = () => (width >= 640 ? Math.floor((width - 16) / 2) : width);

  const reset = () => {
    stopPlay();
    st = dp.createGibbs(points, { alpha: state.alpha, sigma: SIGMA, sigma0: SIGMA0, seed: state.seed * 7 + 1, init: state.init, kInit: 10 });
    slots.clear();
    last = null;
    state.next = 0;
  };
  const stepOne = () => {
    last = dp.stepPoint(st, state.next);
    state.next += 1;
    if (state.next === points.length) {
      state.next = 0;
      st.sweeps += 1;
      st.trace.push(st.clusters.length);
    }
  };
  const stepSweep = () => {
    // finish the current sweep point by point, then report on the last point
    do stepOne(); while (state.next !== 0);
  };

  // Colour slots (since 1.1.0): a colour keyed on id % 6 gave two of four
  // clusters the same colour in most sweeps, because cluster ids only grow. chart.js colourSlots
  // keeps up to six living clusters in distinct colours and up to twelve in distinct looks.
  const slots = colourSlots();
  const refreshSlots = () => slots.refresh(st.clusters.map((cl) => cl.id));
  const colourOf = (c, id) => c.brod[slots.slot(id) % 6];
  const ringed = (id) => Math.floor(slots.slot(id) / 6) % 2 === 1;

  const renderScatter = (animate) => {
    const c = palette(ui.root);
    const W = Math.min(half(), 440);
    const H = W;
    const m = 24;
    const x = d3.scaleLinear().domain([-7, 7]).range([m, W - m]);
    const y = d3.scaleLinear().domain([-7, 7]).range([H - m, m]);
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    gTruth.selectAll("*").remove();
    if (state.truth) {
      for (const t of dp.DEMO_MEANS) {
        gTruth.append("path").attr("d", `M${x(t.x) - 8},${y(t.y)}h16M${x(t.x)},${y(t.y) - 8}v16`).attr("stroke", c.fg).attr("stroke-width", 2.5).attr("opacity", 0.7);
      }
    }
    refreshSlots();
    const ids = st.clusters.map((cl) => cl.id);
    const idOf = (i) => ids[st.z[i]];
    const move = animate && !reducedMotion();
    const circles = gPts.selectAll("circle").data(points).join("circle")
      .attr("cx", (p) => x(p.x)).attr("cy", (p) => y(p.y)).attr("r", 4)
      .attr("stroke", (p, i) => (ringed(idOf(i)) ? colourOf(c, idOf(i)) : c.stroke))
      .attr("stroke-opacity", (p, i) => (ringed(idOf(i)) ? 1 : 0.35)).attr("stroke-width", (p, i) => (ringed(idOf(i)) ? 2 : 0.6));
    (move ? circles.transition().duration(150) : circles.interrupt()).attr("fill", (p, i) => (ringed(idOf(i)) ? c.bg : colourOf(c, idOf(i))));
    const means = dp.clusterMeans(st);
    gMeans.selectAll("path").data(means).join("path")
      .attr("d", (mu) => `M${x(mu.x)},${y(mu.y) - 6}l6,6l-6,6l-6,-6z`).attr("fill", (_, k) => (ringed(ids[k]) ? c.bg : colourOf(c, ids[k])))
      .attr("stroke", (_, k) => (ringed(ids[k]) ? colourOf(c, ids[k]) : c.fg)).attr("stroke-width", (_, k) => (ringed(ids[k]) ? 2.4 : 1.2));
    gX.selectAll("*").remove();
    if (last) {
      const p = points[last.i];
      gX.append("path").attr("d", `M${x(p.x) - 9},${y(p.y) - 9}l18,18M${x(p.x) + 9},${y(p.y) - 9}l-18,18`).attr("stroke", c.fg).attr("stroke-width", 3);
    }
    scTitle.textContent = `Sweep ${st.sweeps}${state.next ? `, point ${state.next} of ${points.length}` : ""}: K = ${st.clusters.length} clusters`;
    svg.attr("aria-label", `Scatter of 100 points coloured by current cluster; ${st.clusters.length} clusters; diamonds are cluster means${state.truth ? ", plus signs the true means" : ""}${last ? `; the X marks point ${last.i + 1}, just resampled` : ""}.`);
  };

  const renderSide = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    if (last) {
      const rows = ["CRP prior weight", "posterior (prior x fit)"];
      const seg = (vals, row) => { let x0 = 0; return vals.map((v, k) => { const s = { row, x1: x0, x2: x0 + v, k, isNew: k === vals.length - 1, id: last.ids[k] }; x0 += v; return s; }); };
      const segs = [...seg(last.prior, rows[0]), ...seg(last.probs, rows[1])];
      draw(barBox, {
        width: half(), height: 130, marginLeft: 150, marginRight: 8,
        x: { domain: [0, 1], label: null, ticks: [0, 0.5, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 1)) },
        y: { domain: rows, label: null },
        marks: [P.barX(segs, { x1: "x1", x2: "x2", y: "row", fill: (d) => (d.isNew ? c.rest : ringed(d.id) ? c.bg : colourOf(c, d.id)),
          stroke: (d) => (d.isNew ? c.marker : ringed(d.id) ? colourOf(c, d.id) : c.raised), strokeWidth: (d) => (d.isNew ? 1.5 : ringed(d.id) ? 2 : 0.8), strokeDasharray: (d) => (d.isNew ? "4,2" : null), inset: 0 })],
      }, `For point ${last.i + 1}: CRP prior weights ${last.prior.map(fmtProb).join(", ")} (last = new cluster); posterior ${last.probs.map(fmtProb).join(", ")}.`);
      barBox.prepend(h("p", { class: "dpx-panel-title", text: `Point ${last.i + 1} (the X): where it may go; dashed = a new cluster` }));
      const pNewPrior = last.prior[last.prior.length - 1];
      const pNew = last.probs[last.probs.length - 1];
      const chosen = last.chosen === last.probs.length - 1 ? "a new cluster" : `a cluster of ${st.clusters[last.chosen]?.n ?? "?"} points`;
      note.textContent = `Prior chance of a new cluster alpha/(n - 1 + alpha) = ${fmtProb(pNewPrior)}; after the fit ${fmtProb(pNew)}. The point went to ${chosen}.`;
    } else {
      barBox.replaceChildren(h("p", { class: "dpx-panel-title", text: "Press Step point (or Enter) to resample one point." }));
      note.textContent = "";
    }
    const tr = st.trace.map((K, s) => ({ s, K }));
    draw(traceBox, {
      width: half(), height: 170, marginLeft: 36,
      x: { domain: [0, Math.max(10, st.sweeps)], label: "sweep", grid: true },
      y: { domain: [0, Math.max(8, Math.min(30, ...tr.map((d) => d.K)) + 1)], label: "K", grid: true, clamp: true },
      marks: [
        P.ruleY([dp.DEMO_MEANS.length], { stroke: c.muted, strokeDasharray: "4,3" }),
        P.line(tr, { x: "s", y: (d) => Math.min(d.K, 30), stroke: c.brod[0], strokeWidth: 2, curve: "step-after" }),
        P.dot(tr.slice(-1), { x: "s", y: (d) => Math.min(d.K, 30), r: 4, fill: c.brod[0] }),
      ],
    }, `Number of clusters after each sweep: ${st.trace.slice(-12).join(", ")}; dashed: the true 4.`);
    traceBox.prepend(h("p", { class: "dpx-panel-title", text: "K after each sweep (dashed: the true 4; values above 30 clipped)" }));
  };

  const render = (animate = false) => {
    const t0 = performance.now();
    renderScatter(animate);
    renderSide();
    const recent = st.trace.slice(-10);
    const meanK = recent.reduce((a, b) => a + b, 0) / recent.length;
    ui.readout.textContent =
      `alpha = ${fmtAlpha(state.alpha)}, start: ${INITS.find((i) => i.value === state.init).label}. Sweep ${st.sweeps}: K = ${st.clusters.length} (mean of the last ${recent.length} sweeps ${fmt(meanK, 1)}; truth 4). ` +
      "Posterior = CRP prior weight x fit: with alpha = 0.01 a new cluster starts at one hundredth of the weight of a one-point cluster.";
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.k = String(st.clusters.length);
    ui.root.dataset.sweeps = String(st.sweeps);
    ui.root.dataset.trace = JSON.stringify(st.trace);
  };

  function stopPlay() {
    state.playing = false;
    clearTimeout(timer);
    timer = 0;
    playT?.set(false);
  }
  const tick = () => {
    if (!state.playing) return;
    if (reducedMotion()) { stepSweep(); render(false); timer = setTimeout(tick, 400); return; }
    stepOne();
    render(true);
    timer = setTimeout(tick, SPEEDS[state.speed]);
  };

  const initSeg = segmented({ label: "Start", options: INITS, value: state.init, onChange: (v) => { state.init = v; reset(); render(); } });
  const sAlpha = slider({ label: "alpha (live)", min: 0.01, max: 10, value: state.alpha, log: true, format: fmtAlpha, onInput: (v) => { state.alpha = v; dp.setAlpha(st, v); render(); } });
  const bPoint = button({ label: "Step point", primary: true, onClick: () => { stepOne(); render(true); } });
  const bSweep = button({ label: "Step sweep", onClick: () => { stepSweep(); render(false); } });
  const b10 = button({ label: "10 sweeps", onClick: () => { for (let s = 0; s < 10; s += 1) stepSweep(); render(false); } });
  const bReset = button({ label: "Reset", onClick: () => { reset(); render(); } });
  const playT = toggle({ label: "play", checked: false, onChange: (v) => { state.playing = v; clearTimeout(timer); if (v) tick(); } });
  const speedSeg = segmented({ label: "speed", options: Object.keys(SPEEDS).map((k) => ({ value: k, label: k })), value: state.speed, onChange: (v) => { state.speed = v; } });
  const truthT = toggle({ label: "true means", checked: state.truth, onChange: (v) => { state.truth = v; render(); } });
  ui.controls.append(initSeg.root, sAlpha.root, h("div", { class: "dpx-control dpx-buttons" }, bPoint, bSweep, b10, bReset), playT.root, speedSeg.root, truthT.root);
  const unbind = bindPrimaryKey(ui.root, () => bPoint.click());
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  reset();
  for (let s = 0; s < Math.round(num(spec, "n", 0, 0, 200)); s += 1) stepSweep();
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.alpha !== undefined) { state.alpha = num(next, "alpha", state.alpha, 0.01, 10); sAlpha.set(state.alpha); }
      if (next.preset !== undefined && INITS.some((i) => i.value === next.preset)) { state.init = next.preset; initSeg.set(state.init); }
      reset();
      for (let s = 0; s < Math.round(num(next, "n", 0, 0, 200)); s += 1) stepSweep();
      render();
    },
    setAlpha(a) { state.alpha = a; sAlpha.set(a); dp.setAlpha(st, a); render(); },
    sweeps(n) { for (let s = 0; s < n; s += 1) stepSweep(); render(false); },
    stepPoint() { stepOne(); render(true); },
    destroy() { stopPlay(); stop(); unbind(); el.replaceChildren(); },
  };
}

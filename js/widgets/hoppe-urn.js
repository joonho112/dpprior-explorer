// P-06 "Hoppe urn -> stick-breaking" (after Broderick, MLSS 2016 part II; re-implemented from
// the mathematics). Owner of this file: Step 6.4.
//
// The urn starts with one black ball of mass alpha. Each draw picks a ball with probability
// proportional to its mass: the black ball adds a ball of a new colour (and goes back), a
// coloured ball goes back with one more of its colour. This is the Chinese restaurant process.
// The colour shares converge to one draw of GEM(alpha) weights in order of appearance, so the
// first colour's long-run share is W_1 ~ Beta(1, alpha): the size-biased first weight.
import * as dp from "../dp-core.js";
import { draw, palette, srTable } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, reducedMotion, segmented, slider, toggle } from "./base.js";
import { fmt, fmtAlpha, fmtProb } from "./format.js";

const A_MIN = 0.1;
const A_MAX = 20;
const STRIP_STEPS = 4; // Step 0 .. Step 4
const SHOWN_BALLS = 160;
const REPS = 1000;
const REP_DRAWS = 500; // draws per repetition in the experiment
const BINS = 20;
const SPEEDS = { slow: 600, normal: 250, fast: 60 };
const REDUCED_MS = 1200;
const NARROW = 420; // px: below this the step strip uses smaller text right after the balls

/** First colour's share after `draws` draws, in `reps` seeded urns. */
export function firstColourShares(alpha, reps, draws, seed) {
  const rng = dp.makeRng(seed);
  const out = new Float64Array(reps);
  for (let r = 0; r < reps; r += 1) {
    const crp = new dp.Crp(alpha, rng);
    for (let i = 0; i < draws; i += 1) crp.seat();
    out[r] = crp.counts[0] / draws;
  }
  return out;
}

export function mountWidget(el, spec = {}) {
  const state = {
    alpha: num(spec, "alpha", 1, A_MIN, A_MAX),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    playing: false,
    speed: "normal",
  };
  let crp;
  let steps = []; // {n, isNew, table}
  let shares1 = []; // first colour's share after each draw
  let experiment = null;
  let timer = 0;
  const ui = frame(el, { label: "Hoppe urn: a black ball of mass alpha creates new colours; the colour shares converge to stick-breaking weights", className: "dpx-urn" });
  const pUrn = h("div", { class: "dpx-panel" });
  const pStrip = h("div", { class: "dpx-panel" });
  const pBar = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pExp = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  ui.charts.append(pUrn, pStrip, pBar, pExp);
  const urnTitle = h("p", { class: "dpx-panel-title" });
  const urnSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  urnSvg.setAttribute("role", "img");
  pUrn.append(urnTitle, urnSvg);
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part II). Colours follow the order in which they first appear (blue, orange, green, purple, red, yellow, repeating), as in the stick-breaking widget. Draws are seeded.";
  let width = 720;
  const half = () => (width >= 640 ? Math.floor((width - 16) / 2) : width);

  const reset = () => {
    crp = new dp.Crp(state.alpha, dp.makeRng(state.seed));
    steps = [];
    shares1 = [];
    experiment = null;
  };
  const drawOne = () => {
    const s = crp.seat();
    steps.push({ n: s.n, isNew: s.isNew, table: s.table });
    shares1.push(crp.counts[0] / crp.n);
  };

  const renderUrn = (flash) => {
    const c = palette(ui.root);
    const d3 = globalThis.d3;
    const W = half();
    const n = crp.n;
    const balls = [];
    crp.counts.forEach((cnt, k) => { for (let j = 0; j < cnt; j += 1) balls.push(k); });
    const shown = balls.slice(0, SHOWN_BALLS);
    const r = n > 80 ? 6 : n > 30 ? 9 : 12;
    const cols = Math.max(4, Math.floor((W - 40) / (2 * r + 3)));
    const blackR = 20;
    const H = Math.max(120, 40 + blackR * 2 + Math.ceil(shown.length / cols) * (2 * r + 3) + 16);
    urnSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    urnSvg.setAttribute("width", W);
    urnSvg.setAttribute("height", H);
    const sel = d3.select(urnSvg);
    sel.selectAll("*").remove();
    sel.append("rect").attr("x", 4).attr("y", 4).attr("width", W - 8).attr("height", H - 8).attr("rx", 18).attr("fill", "none").attr("stroke", c.borderStrong).attr("stroke-width", 2);
    // the black ball stays black in both themes (--label-dark), with a --fg outline for dark mode
    sel.append("circle").attr("cx", 20 + blackR).attr("cy", 16 + blackR).attr("r", blackR).attr("fill", c.labelDark).attr("stroke", c.fg).attr("stroke-width", 1.5);
    sel.append("text").attr("x", 20 + blackR).attr("y", 16 + blackR + 4).attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 700).attr("fill", c.labelLight).text("alpha");
    sel.append("text").attr("x", 20 + 2 * blackR + 10).attr("y", 16 + blackR + 4).attr("font-size", 12).attr("fill", c.muted)
      .text(`mass ${fmtAlpha(state.alpha)}: chance of a new colour ${fmtProb(state.alpha / (state.alpha + n))}`);
    const last = steps[steps.length - 1];
    shown.forEach((k, i) => {
      const cx = 20 + r + (i % cols) * (2 * r + 3);
      const cy = 16 + 2 * blackR + 16 + r + Math.floor(i / cols) * (2 * r + 3);
      const isFlash = flash && last && i === shown.length - 1 && !reducedMotion();
      const circ = sel.append("circle").attr("cx", cx).attr("cy", cy).attr("fill", c.brod[k % 6]).attr("stroke", c.stroke).attr("stroke-opacity", 0.4);
      if (isFlash) circ.attr("r", 0).transition().duration(200).attr("r", r);
      else circ.attr("r", r);
    });
    urnTitle.textContent = `The urn after ${n} ${n === 1 ? "draw" : "draws"}: ${crp.tables} ${crp.tables === 1 ? "colour" : "colours"}${balls.length > SHOWN_BALLS ? ` (first ${SHOWN_BALLS} balls shown)` : ""}`;
    urnSvg.setAttribute("aria-label", `Urn with the black ball of mass ${fmtAlpha(state.alpha)} and ${n} coloured balls in ${crp.tables} colours; counts ${crp.counts.join(", ") || "none"}.`);
  };

  const renderStrip = () => {
    const c = palette(ui.root);
    const d3 = globalThis.d3;
    const W = half();
    const H = 34 * (STRIP_STEPS + 1) + 10;
    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).attr("role", "img");
    const counts = [];
    const lines = [];
    for (let s = 0; s <= STRIP_STEPS; s += 1) {
      const y = 8 + s * 34;
      svg.append("text").attr("x", 4).attr("y", y + 16).attr("font-size", 11).attr("font-weight", 700).attr("fill", c.muted).text(`Step ${s}`);
      svg.append("circle").attr("cx", 64).attr("cy", y + 12).attr("r", 9).attr("fill", c.labelDark).attr("stroke", c.fg).attr("stroke-width", 1.2);
      let x = 82;
      counts.forEach((cnt, k) => { for (let j = 0; j < cnt; j += 1) { svg.append("circle").attr("cx", x).attr("cy", y + 12).attr("r", 7).attr("fill", c.brod[k % 6]).attr("stroke", c.stroke).attr("stroke-opacity", 0.4); x += 17; } });
      const nBalls = counts.reduce((a, b) => a + b, 0);
      const st = steps[s];
      let text = s === 0 ? "black ball only" : "";
      if (st && s < STRIP_STEPS) {
        const p = st.isNew ? state.alpha / (state.alpha + nBalls) : counts[st.table] / (state.alpha + nBalls);
        text = `next: ${st.isNew ? "black, new colour" : "same colour"} (p ${fmtProb(p)})`;
        if (st.isNew) counts.push(1); else counts[st.table] += 1;
      } else if (!st && s > 0) text = "(not drawn yet)";
      const narrow = W < NARROW;
      svg.append("text").attr("x", narrow ? x + 6 : Math.max(x + 6, 150)).attr("y", y + 16).attr("font-size", narrow ? 10 : 11).attr("fill", c.fg).text(text);
      lines.push(`Step ${s}: ${text}`);
    }
    svg.attr("aria-label", `The first ${STRIP_STEPS} draws: ${lines.join("; ")}.`);
    pStrip.replaceChildren(h("p", { class: "dpx-panel-title", text: "The first draws, step by step" }), svg.node());
  };

  const renderBar = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const n = crp.n;
    let x0 = 0;
    const segs = crp.counts.map((cnt, k) => { const s = { x1: x0, x2: x0 + cnt / Math.max(1, n), k, cnt }; x0 = s.x2; return s; });
    const trace = shares1.map((v, i) => ({ n: i + 1, v }));
    const W1 = 1 / (1 + state.alpha);
    draw(pBar, {
      width, height: 90, marginLeft: 12, marginRight: 12,
      x: { domain: [0, 1], label: null, ticks: [0, 0.25, 0.5, 0.75, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 2)) },
      y: { axis: null },
      marks: [P.barX(segs, { x1: "x1", x2: "x2", fill: (d) => c.brod[d.k % 6], stroke: c.raised, strokeWidth: 1 })],
    }, `Colour shares after ${n} draws in order of appearance: ${segs.slice(0, 8).map((s) => fmtProb(s.x2 - s.x1)).join(", ")}${segs.length > 8 ? ", ..." : ""}.`);
    pBar.prepend(h("p", { class: "dpx-panel-title", text: `Colour shares after ${n} draws, in order of appearance: the stick of one GEM(${fmtAlpha(state.alpha)}) draw taking shape` }));
    const line = h("div");
    pBar.append(line);
    if (trace.length) {
      draw(line, {
        width, height: 170, marginLeft: 44,
        x: { type: "log", domain: [1, Math.max(10, n)], label: "draws (log scale)", grid: true },
        y: { domain: [0, 1], label: "first colour's share", grid: true },
        marks: [
          P.lineY(trace, { x: "n", y: "v", stroke: c.brod[0], strokeWidth: 1.8 }),
          P.ruleY([W1], { stroke: c.muted, strokeDasharray: "4,3" }),
          P.text([{ y: W1 }], { y: "y", frameAnchor: "right", dy: -7, textAnchor: "end", text: () => `E(W_1) = 1/(1 + alpha) = ${fmtProb(W1)}`, fill: c.muted, fontSize: 11 }),
        ],
      }, `The first colour's share settles down as draws accumulate; its long-run value W_1 has mean ${fmtProb(W1)}.`);
    }
  };

  const renderExp = () => {
    pExp.replaceChildren();
    if (!experiment) {
      pExp.append(h("p", { class: "dpx-caption-note", text: `Press "Repeat ${REPS} times" to run ${REPS} fresh urns of ${REP_DRAWS} draws and compare the first colour's share with Beta(1, alpha).` }));
      return;
    }
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const { alpha, shares } = experiment;
    const counts = new Array(BINS).fill(0);
    for (const v of shares) counts[Math.min(BINS - 1, Math.floor(v * BINS))] += 1;
    const bars = counts.map((cnt, i) => ({ x1: i / BINS, x2: (i + 1) / BINS, d: (cnt / shares.length) * BINS }));
    const dens = [];
    for (let i = 1; i < 200; i += 1) { const x = i / 200; dens.push({ x, d: alpha * Math.exp((alpha - 1) * Math.log1p(-x)) }); }
    const top = Math.min(8, Math.max(...bars.map((b) => b.d), ...dens.filter((d) => d.x < 0.97).map((d) => d.d)) * 1.1);
    const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
    // mean absolute gap between the histogram and the Beta(1, alpha) probability of each bin
    const binProb = (i) => Math.exp(alpha * Math.log1p(-i / BINS)) - Math.exp(alpha * Math.log1p(-Math.min(1, (i + 1) / BINS)));
    const gap = counts.reduce((s, cnt, i) => s + Math.abs(cnt / shares.length - binProb(i)), 0) / BINS;
    draw(pExp, {
      width, height: 220, marginLeft: 44,
      x: { domain: [0, 1], label: "first colour's share after 500 draws", ticks: [0, 0.25, 0.5, 0.75, 1], tickFormat: (d) => (d === 0 || d === 1 ? String(d) : fmt(d, 2)) },
      y: { domain: [0, top], label: "density", grid: true },
      marks: [
        P.rectY(bars, { x1: "x1", x2: "x2", y: (d) => Math.min(d.d, top), fill: c.brod[0], fillOpacity: 0.45, inset: 0.5 }),
        P.lineY(dens.map((d) => ({ ...d, d: Math.min(d.d, top) })), { x: "x", y: "d", stroke: c.fg, strokeWidth: 2 }),
      ],
    }, `Histogram of the first colour's share in ${REPS} urns against the Beta(1, ${fmtAlpha(alpha)}) density; mean ${fmtProb(mean)} against ${fmtProb(1 / (1 + alpha))}.`);
    pExp.prepend(h("p", { class: "dpx-panel-title", text: `${REPS} urns at alpha = ${fmtAlpha(alpha)}: the first colour's share against the Beta(1, alpha) density (line)` }));
    pExp.append(h("p", { class: "dpx-readout", text: `Mean share ${fmtProb(mean)} against E(W_1) = 1/(1 + alpha) = ${fmtProb(1 / (1 + alpha))}; mean absolute gap per bin between the histogram and Beta(1, alpha) ${fmt(gap, 4)}.` }));
    pExp.append(srTable("First colour's share", ["bin", "share of urns", "Beta(1, alpha) probability"], counts.map((cnt, i) => [`[${fmt(i / BINS, 2)}, ${fmt((i + 1) / BINS, 2)})`, fmtProb(cnt / shares.length), fmtProb(binProb(i))])));
    ui.root.dataset.expMean = String(mean);
    ui.root.dataset.expGap = String(gap);
  };

  const render = (flash = false) => {
    const t0 = performance.now();
    renderUrn(flash);
    renderStrip();
    renderBar();
    renderExp();
    ui.readout.textContent = crp.n === 0
      ? `alpha = ${fmtAlpha(state.alpha)}: the urn holds only the black ball. Press Step (or Enter).`
      : `alpha = ${fmtAlpha(state.alpha)}, ${crp.n} draws: ${crp.tables} colours; the first colour holds ${fmtProb(crp.counts[0] / crp.n)} of the balls. Its long-run share W_1 is Beta(1, alpha), mean ${fmtProb(1 / (1 + state.alpha))}.`;
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
  };

  const stopPlay = () => { state.playing = false; clearInterval(timer); timer = 0; playT.set(false); };
  const step = (k = 1) => { for (let i = 0; i < k; i += 1) drawOne(); render(k === 1); };
  const sAlpha = slider({ label: "alpha (mass of the black ball)", min: A_MIN, max: A_MAX, value: state.alpha, log: true, format: fmtAlpha, onInput: (v) => { state.alpha = v; stopPlay(); reset(); render(); } });
  const b1 = button({ label: "Step", primary: true, onClick: () => step(1) });
  const b10 = button({ label: "+10", onClick: () => step(10) });
  const b100 = button({ label: "+100", onClick: () => step(100) });
  const bReset = button({ label: "Reset", onClick: () => { stopPlay(); state.seed += 1; reset(); render(); } });
  const bExp = button({ label: `Repeat ${REPS} times`, onClick: () => { experiment = { alpha: state.alpha, shares: firstColourShares(state.alpha, REPS, REP_DRAWS, state.seed * 104729 + 3) }; renderExp(); } });
  const playT = toggle({ label: "auto", checked: false, onChange: (v) => {
    clearInterval(timer);
    state.playing = v;
    // under reduced motion: ten draws at a time, twice as slowly as "slow", and no growing balls
    if (v) timer = reducedMotion() ? setInterval(() => step(10), REDUCED_MS) : setInterval(() => step(1), SPEEDS[state.speed]);
  } });
  const speedSeg = segmented({ label: "speed", options: Object.keys(SPEEDS).map((k) => ({ value: k, label: k })), value: state.speed, onChange: (v) => { state.speed = v; if (state.playing) { clearInterval(timer); timer = setInterval(() => step(1), SPEEDS[v]); } } });
  ui.controls.append(sAlpha.root, h("div", { class: "dpx-control dpx-buttons" }, b1, b10, b100, bReset, bExp), playT.root, speedSeg.root);
  const unbind = bindPrimaryKey(ui.root, () => step(1));
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  reset();
  for (let i = 0; i < Math.round(num(spec, "n", 0, 0, 5000)); i += 1) drawOne();
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.alpha !== undefined) { state.alpha = num(next, "alpha", state.alpha, A_MIN, A_MAX); sAlpha.set(state.alpha); }
      if (next.seed !== undefined) state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9));
      stopPlay();
      reset();
      for (let i = 0; i < Math.round(num(next, "n", 0, 0, 5000)); i += 1) drawOne();
      render();
    },
    step,
    experiment: () => bExp.click(),
    destroy() { clearInterval(timer); stop(); unbind(); el.replaceChildren(); },
  };
}

// P-09 "The DP mixture, generated" (after Broderick, MLSS 2016 part II, demo 6; re-implemented
// from the mathematics). Owner of this file: Step 6.5.
//
// Lazy stick-breaking: each new point draws u ~ U(0, 1); pieces w_k = V_k prod_{j<k}(1 - V_j),
// V_k ~ Beta(1, alpha), and their means mu_k ~ N(0, sigma0^2 I) are created only when u falls
// in the unbroken rest. The point joins the piece containing u and lands at
// x ~ N(mu_k, sigma^2 I). Three counters grow at different speeds: N points, the number of
// components created (pieces broken) and the number of clusters (pieces holding points).
// Components can stay empty: u skipped over them, and their mean (a black square) waits.
import * as dp from "../dp-core.js";
import { draw, labelOn, palette, srTable } from "./chart.js";
import { bindPrimaryKey, button, frame, h, num, observeWidth, slider } from "./base.js";
import { fmt, fmtAlpha, fmtProb } from "./format.js";

const N_MAX = 2000;

/** Generator state for the lazy DP mixture; add(n) appends n points. */
export function makeDpmm(alpha, sigma0, sigma, seed) {
  const rng = dp.makeRng(seed);
  const pieces = [];
  const points = [];
  const trace = [];
  let rest = 1;
  let lastU = null;
  const add = (n) => {
    for (let i = 0; i < n && points.length < N_MAX; i += 1) {
      const u = rng.next();
      let acc = 0;
      let z = -1;
      for (let k = 0; k < pieces.length; k += 1) {
        acc += pieces[k].w;
        if (u < acc) { z = k; break; }
      }
      while (z < 0) {
        const w = rest * dp.rbeta1(rng, alpha);
        rest -= w;
        pieces.push({ k: pieces.length, w, mx: sigma0 * dp.rnorm(rng), my: sigma0 * dp.rnorm(rng), count: 0 });
        acc += w;
        if (u < acc) z = pieces.length - 1;
      }
      const p = pieces[z];
      p.count += 1;
      points.push({ n: points.length + 1, z, x: p.mx + sigma * dp.rnorm(rng), y: p.my + sigma * dp.rnorm(rng) });
      lastU = u;
      trace.push({ n: points.length, components: pieces.length, clusters: pieces.filter((q) => q.count > 0).length });
    }
  };
  return { pieces, points, trace, add, get rest() { return rest; }, get lastU() { return lastU; } };
}

export function mountWidget(el, spec = {}) {
  const state = {
    alpha: num(spec, "alpha", 2, 0.1, 20),
    sigma0: num(spec, "sigma0", 1.5, 0.2, 5),
    sigma: num(spec, "sigma", 0.3, 0.05, 2),
    seed: Math.round(num(spec, "seed", 1, 1, 1e9)),
    hi: null,
  };
  let gen = null;
  const ui = frame(el, { label: "A Dirichlet process mixture drawn by lazy stick-breaking: points, components and clusters", className: "dpx-dpmm" });
  const pBar = h("div", { class: "dpx-panel", style: "grid-column: 1 / -1" });
  const pScatter = h("div", { class: "dpx-panel" });
  const pTrace = h("div", { class: "dpx-panel" });
  ui.charts.append(pBar, pScatter, pTrace);
  const barTitle = h("p", { class: "dpx-panel-title" });
  const barSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  barSvg.setAttribute("role", "img");
  const hoverNote = h("p", { class: "dpx-caption-note", "aria-live": "polite" });
  pBar.append(barTitle, barSvg, hoverNote);
  ui.caption.textContent =
    "After Broderick (MLSS 2016, part II). Top: the stick so far; coloured pieces hold points, grey pieces were broken but are still empty, white is the unbroken rest, the red mark is the last point's u. Bottom left: points coloured by cluster; black squares are the means of every component created, used or not. Draws are seeded.";
  let width = 720;
  const half = () => (width >= 640 ? Math.floor((width - 16) / 2) : width);

  const regenerate = (n) => {
    gen = makeDpmm(state.alpha, state.sigma0, state.sigma, state.seed);
    gen.add(n);
    state.hi = null;
  };

  const renderBar = () => {
    const c = palette(ui.root);
    const d3 = globalThis.d3;
    const W = width;
    const H = 58;
    const x = (v) => 8 + v * (W - 16);
    barSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    barSvg.setAttribute("width", W);
    barSvg.setAttribute("height", H);
    const sel = d3.select(barSvg);
    sel.selectAll("*").remove();
    let acc = 0;
    for (const p of gen.pieces) {
      const x0 = acc;
      acc += p.w;
      sel.append("rect").attr("x", x(x0)).attr("y", 16).attr("width", Math.max(0.5, p.w * (W - 16))).attr("height", 28)
        .attr("fill", p.count > 0 ? c.brod[p.k % 6] : c.unused).attr("stroke", state.hi === p.k ? c.fg : c.raised).attr("stroke-width", state.hi === p.k ? 2.5 : 1)
        .on("pointerenter", () => pick(p.k));
    }
    sel.append("rect").attr("x", x(acc)).attr("y", 16).attr("width", Math.max(0, (1 - acc) * (W - 16))).attr("height", 28).attr("fill", c.rest).attr("stroke", c.borderStrong);
    // component numbers on the pieces that hold points and are wide enough: the six colours repeat
    // from the seventh piece on, so the number names the component (since 1.1.0)
    acc = 0;
    for (const p of gen.pieces) {
      const px = x(acc + p.w / 2);
      acc += p.w;
      if (p.count > 0 && p.w * (W - 16) >= 16) {
        sel.append("text").attr("x", px).attr("y", 35).attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 700)
          .attr("fill", labelOn(c.brod[p.k % 6], c)).attr("pointer-events", "none").text(p.k + 1);
      }
    }
    if (gen.lastU !== null) {
      const ux = x(gen.lastU);
      sel.append("path").attr("d", `M${ux - 6},4 L${ux + 6},4 L${ux},14 Z`).attr("fill", c.marker);
      sel.append("line").attr("x1", ux).attr("x2", ux).attr("y1", 14).attr("y2", 44).attr("stroke", c.marker).attr("stroke-width", 1.5);
    }
    sel.on("pointerleave", () => pick(null));
    const clusters = gen.pieces.filter((p) => p.count > 0).length;
    barTitle.textContent = `N = ${gen.points.length} points · ${gen.pieces.length} components created · ${clusters} clusters · unbroken rest ${fmtProb(gen.rest)}`;
    barSvg.setAttribute("aria-label", `Stick with ${gen.pieces.length} broken pieces, ${clusters} of them holding points, and ${fmtProb(gen.rest)} unbroken.`);
  };

  const renderScatter = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const pts = gen.points;
    const hi = state.hi;
    const ext = Math.max(3, ...gen.pieces.map((p) => Math.max(Math.abs(p.mx), Math.abs(p.my))), ...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))) + 0.3;
    const side = Math.min(half(), 420);
    draw(pScatter, {
      width: side, height: side, marginLeft: 34,
      x: { domain: [-ext, ext], label: null, ticks: 5 },
      y: { domain: [-ext, ext], label: null, ticks: 5 },
      r: { type: "identity" }, // the piece markers' r is in pixels, not a scaled channel
      marks: [
        P.dot(pts, { x: "x", y: "y", r: 3, fill: (d) => c.brod[d.z % 6], fillOpacity: (d) => (hi === null || d.z === hi ? 0.85 : 0.12), stroke: c.stroke, strokeOpacity: 0.25, strokeWidth: 0.5 }),
        P.dot(gen.pieces, { x: "mx", y: "my", symbol: "square", r: (d) => (d.k === hi ? 7 : 4.5), fill: c.fg, stroke: (d) => (d.k === hi ? c.marker : c.fg), strokeWidth: (d) => (d.k === hi ? 2.5 : 1) }),
        P.text(gen.pieces.filter((p) => p.count > 0), { x: "mx", y: "my", text: (d) => String(d.k + 1), dx: 9, dy: -9, fill: c.fg, stroke: c.raised, strokeWidth: 3, paintOrder: "stroke", fontSize: 11, fontWeight: 700 }),
      ],
    }, `Scatter of ${pts.length} points coloured by cluster, with the means of all ${gen.pieces.length} components as black squares (${gen.pieces.filter((p) => p.count === 0).length} of them unused) and the numbers of the components that hold points.`);
    pScatter.prepend(h("p", { class: "dpx-panel-title", text: "Points by cluster; black squares = component means (used or not); numbers = components holding points, as on the stick" }));
  };

  const renderTrace = () => {
    const c = palette(ui.root);
    const P = globalThis.Plot;
    const tr = gen.trace;
    const long = tr.flatMap((d) => [{ n: d.n, v: d.components, s: "components created" }, { n: d.n, v: d.clusters, s: "clusters (K_N)" }]);
    const guide = [];
    for (let n = 1; n <= Math.max(10, tr.length); n = Math.ceil(n * 1.25)) guide.push({ n, v: dp.condMean(n, state.alpha) });
    draw(pTrace, {
      width: half(), height: 260, marginLeft: 36,
      x: { type: "log", domain: [1, Math.max(10, tr.length)], label: "N (log scale)", grid: true },
      y: { domain: [0, Math.max(4, ...long.map((d) => d.v)) + 1], label: "count", grid: true },
      color: { domain: ["components created", "clusters (K_N)"], range: [c.slate, c.brod[0]] },
      marks: [
        P.line(guide, { x: "n", y: "v", stroke: c.muted, strokeDasharray: "4,3" }),
        P.line(long, { x: "n", y: "v", stroke: "s", strokeWidth: 2, curve: "step-after" }),
      ],
    }, `Components created and clusters against N; dashed: E(K_N | alpha) = ${fmt(dp.condMean(Math.max(1, tr.length), state.alpha), 2)} at N = ${tr.length}.`);
    pTrace.prepend(h("p", { class: "dpx-panel-title", text: "Components created (grey) and clusters K_N (blue) against N; dashed: E(K_N | alpha)" }));
    pTrace.append(srTable("Counts", ["N", "components", "clusters"], tr.filter((d, i) => i === tr.length - 1 || [1, 10, 100, 1000].includes(d.n)).map((d) => [d.n, d.components, d.clusters])));
  };

  const describe = (k) => {
    const p = gen.pieces[k];
    return `Component ${k + 1}: weight ${p.w < 0.0005 ? p.w.toExponential(1) : fmtProb(p.w)}, mean (${fmt(p.mx, 2)}, ${fmt(p.my, 2)}), ${p.count} ${p.count === 1 ? "point" : "points"}${p.count ? "" : " (unused so far)"}.`;
  };
  function pick(k) {
    if (k === state.hi) return;
    state.hi = k;
    hoverNote.textContent = k === null ? "Hover over a piece of the stick (or use the component picker) to highlight its points." : describe(k);
    renderBar();
    renderScatter();
  }

  const render = () => {
    const t0 = performance.now();
    renderBar();
    renderScatter();
    renderTrace();
    if (!hoverNote.textContent) hoverNote.textContent = "Hover over a piece of the stick (or use the component picker) to highlight its points.";
    const clusters = gen.pieces.filter((p) => p.count > 0).length;
    picker.input.max = String(Math.max(1, gen.pieces.length));
    ui.readout.textContent =
      `alpha = ${fmtAlpha(state.alpha)}: N = ${gen.points.length} points, ${gen.pieces.length} components created, ${clusters} clusters (E(K_N | alpha) = ${fmt(dp.condMean(Math.max(1, gen.points.length), state.alpha), 2)}). ` +
      "Components can be created and stay empty; clusters are the components that hold points.";
    ui.root.dataset.renderMs = (performance.now() - t0).toFixed(1);
    ui.root.dataset.counts = JSON.stringify([gen.points.length, gen.pieces.length, clusters]);
  };

  const params = (key, label, min, max, onDone) => slider({ label, min, max, value: state[key], log: true, format: (v) => fmt(v, 2), onInput: (v) => { state[key] = v; regenerate(gen.points.length); onDone?.(); render(); } });
  const sAlpha = params("alpha", "alpha", 0.1, 20);
  const sS0 = params("sigma0", "sigma0 (spread of means)", 0.2, 5);
  const sS = params("sigma", "sigma (spread within a cluster)", 0.05, 2);
  const add = (n) => { gen.add(n); render(); };
  const b1 = button({ label: "Add 1", primary: true, onClick: () => add(1) });
  const b10 = button({ label: "Add 10", onClick: () => add(10) });
  const b100 = button({ label: "Add 100", onClick: () => add(100) });
  const bReset = button({ label: "Reset", onClick: () => { state.seed += 1; regenerate(0); render(); } });
  const picker = slider({ label: "Highlight component", min: 1, max: N_MAX, step: 1, value: 1, format: (v) => String(Math.round(v)), onInput: (v) => pick(Math.min(gen.pieces.length, Math.round(v)) - 1) });
  ui.controls.append(sAlpha.root, sS0.root, sS.root, h("div", { class: "dpx-control dpx-buttons" }, b1, b10, b100, bReset), picker.root);
  const unbind = bindPrimaryKey(ui.root, () => add(1));
  let ready = false;
  const stop = observeWidth(ui.charts, (w) => { width = w; if (ready) render(); });
  regenerate(Math.round(num(spec, "n", 50, 0, N_MAX)));
  render();
  ready = true;
  return {
    update(next = {}) {
      if (next.alpha !== undefined) { state.alpha = num(next, "alpha", state.alpha, 0.1, 20); sAlpha.set(state.alpha); }
      if (next.seed !== undefined) state.seed = Math.round(num(next, "seed", state.seed, 1, 1e9));
      regenerate(next.n !== undefined ? Math.round(num(next, "n", 0, 0, N_MAX)) : gen.points.length);
      render();
    },
    add,
    pick,
    destroy() { stop(); unbind(); el.replaceChildren(); },
  };
}
